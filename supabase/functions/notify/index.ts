// Sends group activity push notifications. Called by the ping_notify database trigger with
// { table, op, record }. The record is only used to find the row: everything is re-read with the
// service role, and notified_events makes sure each event is sent at most once.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { json, serve } from '../_shared/http.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Inserts older than this are ignored, so replaying old rows can't send anything.
const MAX_AGE_MS = 5 * 60 * 1000;

type Message = { groupId: string; actorId: string; title: string; body: string; data: Record<string, string> };

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const fresh = (iso?: string) => !!iso && Date.now() - new Date(iso).getTime() < MAX_AGE_MS;

async function groupName(id: string) {
  const { data } = await db.from('groups').select('name').eq('id', id).single();
  return (data?.name as string) ?? 'Your group';
}

async function personName(id: string) {
  const { data } = await db.from('profiles').select('display_name').eq('id', id).single();
  return ((data?.display_name as string) || 'Someone').split(' ')[0];
}

async function buildMessage(table: string, op: string, record: Record<string, unknown>): Promise<[string, Message] | null> {
  if (table === 'saved_places') {
    const { data: p } = await db.from('saved_places').select('*').eq('id', record.id).single();
    if (!p) return null;
    const [group, who] = await Promise.all([groupName(p.group_id), personName(p.added_by)]);
    if (op === 'INSERT') {
      if (!fresh(p.created_at)) return null;
      const place = p.name as string;
      const msg = pick([
        { title: `${group} really wants to go to ${place} 👀`, body: `${who} just added it. Clear your calendar.` },
        { title: `${who} has a new obsession`, body: `${place} is on the list now. You know what to do.` },
        { title: `New addition to the list 📍`, body: `${who} added ${place}. Plan it before it becomes another "someday".` },
        { title: `${place}? ${place}.`, body: `${who} says ${group} is going. No further questions.` },
      ]);
      return [`place-added:${p.id}`, { groupId: p.group_id, actorId: p.added_by, ...msg, data: { placeRowId: p.id } }];
    }
    if (op === 'UPDATE' && p.status === 'visited') {
      const msg = pick([
        { title: `${group} finally went to ${p.name}! 🎉`, body: 'One less "we should go there sometime".' },
        { title: `Checked off: ${p.name} ✅`, body: 'Go rate it before you forget how good it was.' },
      ]);
      // The actor isn't recorded for a status change, so everyone except whoever added it hears.
      return [`place-visited:${p.id}`, { groupId: p.group_id, actorId: p.added_by, ...msg, data: { placeRowId: p.id } }];
    }
    return null;
  }

  if (table === 'memories' && op === 'INSERT') {
    const { data: m } = await db.from('memories').select('*').eq('id', record.id).single();
    if (!m || !fresh(m.created_at)) return null;
    const who = await personName(m.created_by);
    const msg = pick([
      { title: `New memory: ${m.title} 📸`, body: `${who} just saved it. Go see the photos.` },
      { title: `${who} is feeling sentimental`, body: `"${m.title}" is now in your memories. Bring tissues.` },
      { title: 'Fresh memory just dropped 📸', body: `${who} saved "${m.title}". Main character energy.` },
    ]);
    return [`memory-added:${m.id}`, { groupId: m.group_id, actorId: m.created_by, ...msg, data: { memoryId: m.id } }];
  }

  if (table === 'important_dates' && op === 'INSERT') {
    const { data: d } = await db.from('important_dates').select('*').eq('id', record.id).single();
    if (!d || !fresh(d.created_at)) return null;
    const who = await personName(d.created_by);
    const when = new Date(`${d.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const msg = pick([
      { title: `${who} added ${d.title} 🗓️`, body: `It's on ${when}. Pix will remind you, but maybe also remember.` },
      { title: `Save the date: ${d.title}`, body: `${when}. ${who} is trusting you with this one.` },
    ]);
    return [`date-added:${d.id}`, { groupId: d.group_id, actorId: d.created_by, ...msg, data: { tab: 'dates' } }];
  }

  if (table === 'group_members' && op === 'INSERT') {
    const groupId = record.group_id as string;
    const userId = record.user_id as string;
    const { data: gm } = await db.from('group_members').select('*').eq('group_id', groupId).eq('user_id', userId).single();
    if (!gm || !fresh(gm.joined_at)) return null;
    const [group, who] = await Promise.all([groupName(groupId), personName(userId)]);
    return [
      `member-joined:${groupId}:${userId}`,
      { groupId, actorId: userId, title: `${who} joined ${group} 🎉`, body: 'The group just got better. Go add some places.', data: { tab: 'places' } },
    ];
  }

  return null;
}

async function send(msg: Message) {
  const { data: members } = await db.from('group_members').select('user_id').eq('group_id', msg.groupId);
  const recipients = (members ?? []).map((m) => m.user_id as string).filter((id) => id !== msg.actorId);
  if (recipients.length === 0) return 0;

  const { data: tokens } = await db.from('push_tokens').select('token').in('user_id', recipients);
  const list = (tokens ?? []).map((t) => t.token as string);
  if (list.length === 0) return 0;

  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch.map((to) => ({ to, title: msg.title, body: msg.body, data: msg.data, sound: 'default' }))),
    });
    const out = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    // Forget phones that uninstalled the app or turned notifications off for good.
    const dead = (out.data ?? [])
      .map((r, j) => (r.details?.error === 'DeviceNotRegistered' ? batch[j] : null))
      .filter((t): t is string => !!t);
    if (dead.length) await db.from('push_tokens').delete().in('token', dead);
  }
  return list.length;
}

serve(async (req) => {
  const { table, op, record } = await req.json();
  if (typeof table !== 'string' || typeof op !== 'string' || !record) return json({ error: 'bad request' }, 400);

  const built = await buildMessage(table, op, record);
  if (!built) return json({ sent: 0 });
  const [key, msg] = built;

  // Claim the event; if it was already claimed, it's been sent.
  const { error } = await db.from('notified_events').insert({ key });
  if (error) return json({ sent: 0, duplicate: true });

  return json({ sent: await send(msg) });
});
