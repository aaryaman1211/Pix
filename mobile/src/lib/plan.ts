// Types, pure helpers, and storage for outing polls, "Surprise me" and split-the-bill.
// Kept in their own file so the existing lib/types.ts is untouched.
// Uses Supabase tables (`polls`, `expenses`, etc.) when present, and falls back to AsyncStorage
// if the migration has not been applied to the cloud database yet.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';
import type { SavedPlace } from '@/lib/types';
import { must } from '@/lib/use-query';

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------

export type Poll = {
  id: string;
  group_id: string;
  title: string;
  status: 'open' | 'closed';
  winner_option_id: string | null;
  created_by: string;
  created_at: string;
};

export type PollOption = {
  id: string;
  poll_id: string;
  group_id: string;
  place_id: string;
  name: string;
  address: string | null;
  locality: string | null;
  primary_type: string | null;
  types: string[];
  price_level: number | null;
  lat: number | null;
  lng: number | null;
};

export type PollVote = {
  poll_id: string;
  option_id: string;
  group_id: string;
  user_id: string;
  created_at: string;
};

export type OptionTally = { option: PollOption; votes: number; voterIds: string[] };

// Votes per option, highest first (ties keep the original option order).
export function tallyVotes(options: PollOption[], votes: PollVote[]): OptionTally[] {
  return options
    .map((option) => {
      const voterIds = votes.filter((v) => v.option_id === option.id).map((v) => v.user_id);
      return { option, votes: voterIds.length, voterIds };
    })
    .sort((a, b) => b.votes - a.votes);
}

// The option(s) in front. More than one means a tie.
export function leaders(tally: OptionTally[]): OptionTally[] {
  const top = tally[0]?.votes ?? 0;
  return top === 0 ? [] : tally.filter((t) => t.votes === top);
}

// ---------------------------------------------------------------------------
// Surprise me
// ---------------------------------------------------------------------------

export type SurpriseFilter = { maxPrice: number | null; type: string | null };

export function surpriseCandidates(places: SavedPlace[], filter: SurpriseFilter): SavedPlace[] {
  return places.filter(
    (p) =>
      p.status === 'want' &&
      (filter.maxPrice == null || p.price_level == null || p.price_level <= filter.maxPrice) &&
      (filter.type == null || p.primary_type === filter.type),
  );
}

// A random pick that avoids repeating the previous one whenever there is a choice.
export function pickRandom<T extends { id: string }>(items: T[], avoidId?: string): T | undefined {
  const pool = items.length > 1 && avoidId ? items.filter((i) => i.id !== avoidId) : items;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------------------------------------------------------------------------
// Split the bill. Money is whole paise (1 rupee = 100 paise) so nothing drifts.
// ---------------------------------------------------------------------------

export type Expense = {
  id: string;
  group_id: string;
  title: string;
  amount_minor: number;
  paid_by: string;
  spent_on: string; // YYYY-MM-DD
  memory_id: string | null;
  created_by: string;
  created_at: string;
};

export type ExpenseShare = { expense_id: string; group_id: string; user_id: string; share_minor: number };

export type Settlement = {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount_minor: number;
  created_by: string;
  created_at: string;
};

export type Transfer = { from: string; to: string; amount: number };

// "₹1,250" or "₹1,250.50" (paise only shown when there are some).
export function rupees(minor: number): string {
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const paise = abs % 100;
  const grouped = whole.toLocaleString('en-IN');
  return `${minor < 0 ? '-' : ''}₹${grouped}${paise ? `.${String(paise).padStart(2, '0')}` : ''}`;
}

// "250", "250.5" or "1,250.75" -> paise. Returns null when it is not a positive amount.
export function parseRupees(text: string): number | null {
  const clean = text.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const minor = Math.round(parseFloat(clean) * 100);
  return minor > 0 ? minor : null;
}

// Splits `total` between the people as evenly as whole paise allow; the leftover paise go one each
// to the first people, so the shares always add up to exactly `total`.
export function splitEvenly(total: number, userIds: string[]): ExpenseShareInput[] {
  if (userIds.length === 0) return [];
  const base = Math.floor(total / userIds.length);
  const extra = total - base * userIds.length;
  return userIds.map((user_id, i) => ({ user_id, share_minor: base + (i < extra ? 1 : 0) }));
}

export type ExpenseShareInput = { user_id: string; share_minor: number };

// Net balance per person: positive means the group owes them, negative means they owe the group.
export function balances(expenses: Expense[], shares: ExpenseShare[], settlements: Settlement[]): Map<string, number> {
  const net = new Map<string, number>();
  const add = (id: string, n: number) => net.set(id, (net.get(id) ?? 0) + n);
  for (const e of expenses) add(e.paid_by, e.amount_minor);
  for (const s of shares) add(s.user_id, -s.share_minor);
  // Paying someone back lifts what you owe and lowers what they are owed.
  for (const s of settlements) {
    add(s.from_user, s.amount_minor);
    add(s.to_user, -s.amount_minor);
  }
  return net;
}

// The fewest payments that clear every balance (greedy: biggest debtor pays biggest creditor).
export function suggestTransfers(net: Map<string, number>): Transfer[] {
  const debtors = [...net].filter(([, n]) => n < 0).map(([id, n]) => ({ id, n: -n }));
  const creditors = [...net].filter(([, n]) => n > 0).map(([id, n]) => ({ id, n }));
  debtors.sort((a, b) => b.n - a.n);
  creditors.sort((a, b) => b.n - a.n);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].n, creditors[j].n);
    if (amount > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].n -= amount;
    creditors[j].n -= amount;
    if (debtors[i].n === 0) i++;
    if (creditors[j].n === 0) j++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Storage (Supabase tables with transparent AsyncStorage fallback when unmigrated)
// ---------------------------------------------------------------------------

type LocalStore = {
  polls: Poll[];
  poll_options: PollOption[];
  poll_votes: PollVote[];
  expenses: Expense[];
  expense_shares: ExpenseShare[];
  settlements: Settlement[];
};

const STORE_KEY = 'pix.planStore.v1';

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    msg.includes('schema cache') ||
    msg.includes('does not exist')
  );
}

async function readLocal(): Promise<LocalStore> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as LocalStore;
  } catch {
    // ignore corrupt local state
  }
  return { polls: [], poll_options: [], poll_votes: [], expenses: [], expense_shares: [], settlements: [] };
}

async function writeLocal(store: LocalStore): Promise<void> {
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export async function loadPolls(groupId: string): Promise<{ polls: Poll[]; votes: PollVote[] }> {
  const res = await supabase.from('polls').select('*').eq('group_id', groupId).order('created_at', { ascending: false });
  if (isMissingTable(res.error)) {
    const store = await readLocal();
    const polls = store.polls
      .filter((p) => p.group_id === groupId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const pollIds = new Set(polls.map((p) => p.id));
    const votes = store.poll_votes.filter((v) => pollIds.has(v.poll_id));
    return { polls, votes };
  }
  const polls = must<Poll[]>(res);
  const votes = polls.length
    ? must<PollVote[]>(
        await supabase
          .from('poll_votes')
          .select('*')
          .in('poll_id', polls.map((p) => p.id)),
      )
    : [];
  return { polls, votes };
}

export async function loadPoll(pollId: string): Promise<{ poll: Poll; options: PollOption[]; votes: PollVote[] }> {
  const res = await supabase.from('polls').select('*').eq('id', pollId).single();
  if (isMissingTable(res.error)) {
    const store = await readLocal();
    const poll = store.polls.find((p) => p.id === pollId);
    if (!poll) throw new Error('Poll not found.');
    const options = store.poll_options
      .filter((o) => o.poll_id === pollId)
      .sort((a, b) => a.name.localeCompare(b.name));
    const votes = store.poll_votes.filter((v) => v.poll_id === pollId);
    return { poll, options, votes };
  }
  const poll = must<Poll>(res);
  const options = must<PollOption[]>(await supabase.from('poll_options').select('*').eq('poll_id', pollId).order('name'));
  const votes = must<PollVote[]>(await supabase.from('poll_votes').select('*').eq('poll_id', pollId));
  return { poll, options, votes };
}

export async function createPoll(
  groupId: string,
  userId: string,
  title: string,
  chosen: SavedPlace[],
): Promise<string> {
  const res = await supabase.from('polls').insert({ group_id: groupId, title }).select('id').single();
  if (isMissingTable(res.error)) {
    const store = await readLocal();
    const pollId = Crypto.randomUUID();
    const poll: Poll = {
      id: pollId,
      group_id: groupId,
      title,
      status: 'open',
      winner_option_id: null,
      created_by: userId,
      created_at: new Date().toISOString(),
    };
    const options: PollOption[] = chosen.map((p) => ({
      id: Crypto.randomUUID(),
      poll_id: pollId,
      group_id: groupId,
      place_id: p.place_id,
      name: p.name,
      address: p.address,
      locality: p.locality,
      primary_type: p.primary_type,
      types: p.types,
      price_level: p.price_level,
      lat: p.lat,
      lng: p.lng,
    }));
    store.polls.push(poll);
    store.poll_options.push(...options);
    await writeLocal(store);
    return pollId;
  }
  const poll = must<{ id: string }>(res);
  must(
    await supabase.from('poll_options').insert(
      chosen.map((p) => ({
        poll_id: poll.id,
        group_id: groupId,
        place_id: p.place_id,
        name: p.name,
        address: p.address,
        locality: p.locality,
        primary_type: p.primary_type,
        types: p.types,
        price_level: p.price_level,
        lat: p.lat,
        lng: p.lng,
      })),
    ),
  );
  return poll.id;
}

export async function castVote(groupId: string, pollId: string, optionId: string, userId: string): Promise<void> {
  const res = await supabase
    .from('poll_votes')
    .upsert({ poll_id: pollId, option_id: optionId, group_id: groupId, user_id: userId }, { onConflict: 'poll_id,user_id' });
  if (isMissingTable(res.error)) {
    const store = await readLocal();
    store.poll_votes = store.poll_votes.filter((v) => !(v.poll_id === pollId && v.user_id === userId));
    store.poll_votes.push({
      poll_id: pollId,
      option_id: optionId,
      group_id: groupId,
      user_id: userId,
      created_at: new Date().toISOString(),
    });
    await writeLocal(store);
    return;
  }
  if (res.error) throw new Error(res.error.message);
}

export async function closePollById(pollId: string, winnerOptionId: string): Promise<void> {
  const res = await supabase
    .from('polls')
    .update({ status: 'closed', winner_option_id: winnerOptionId })
    .eq('id', pollId);
  if (isMissingTable(res.error)) {
    const store = await readLocal();
    const poll = store.polls.find((p) => p.id === pollId);
    if (poll) {
      poll.status = 'closed';
      poll.winner_option_id = winnerOptionId;
      await writeLocal(store);
    }
    return;
  }
  if (res.error) throw new Error(res.error.message);
}

export async function deletePollById(pollId: string): Promise<void> {
  const res = await supabase.from('polls').delete().eq('id', pollId);
  if (isMissingTable(res.error)) {
    const store = await readLocal();
    store.polls = store.polls.filter((p) => p.id !== pollId);
    store.poll_options = store.poll_options.filter((o) => o.poll_id !== pollId);
    store.poll_votes = store.poll_votes.filter((v) => v.poll_id !== pollId);
    await writeLocal(store);
    return;
  }
  if (res.error) throw new Error(res.error.message);
}

export async function loadSplit(
  groupId: string,
): Promise<{ expenses: Expense[]; shares: ExpenseShare[]; settlements: Settlement[] }> {
  const [expensesRes, sharesRes, settlementsRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('*')
      .eq('group_id', groupId)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('expense_shares').select('*').eq('group_id', groupId),
    supabase.from('settlements').select('*').eq('group_id', groupId),
  ]);
  if (isMissingTable(expensesRes.error) || isMissingTable(sharesRes.error) || isMissingTable(settlementsRes.error)) {
    const store = await readLocal();
    const expenses = store.expenses
      .filter((e) => e.group_id === groupId)
      .sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at));
    const shares = store.expense_shares.filter((s) => s.group_id === groupId);
    const settlements = store.settlements.filter((s) => s.group_id === groupId);
    return { expenses, shares, settlements };
  }
  return {
    expenses: must<Expense[]>(expensesRes),
    shares: must<ExpenseShare[]>(sharesRes),
    settlements: must<Settlement[]>(settlementsRes),
  };
}

export async function createExpense(
  groupId: string,
  userId: string,
  input: {
    title: string;
    amount_minor: number;
    paid_by: string;
    spent_on: string;
    shares: ExpenseShareInput[];
  },
): Promise<void> {
  const res = await supabase
    .from('expenses')
    .insert({
      group_id: groupId,
      title: input.title,
      amount_minor: input.amount_minor,
      paid_by: input.paid_by,
      spent_on: input.spent_on,
    })
    .select('id')
    .single();

  if (isMissingTable(res.error)) {
    const store = await readLocal();
    const expenseId = Crypto.randomUUID();
    store.expenses.push({
      id: expenseId,
      group_id: groupId,
      title: input.title,
      amount_minor: input.amount_minor,
      paid_by: input.paid_by,
      spent_on: input.spent_on,
      memory_id: null,
      created_by: userId,
      created_at: new Date().toISOString(),
    });
    store.expense_shares.push(
      ...input.shares.map((s) => ({
        expense_id: expenseId,
        group_id: groupId,
        user_id: s.user_id,
        share_minor: s.share_minor,
      })),
    );
    await writeLocal(store);
    return;
  }

  if (res.error || !res.data) {
    throw new Error(res.error?.message ?? 'Could not save the expense.');
  }
  const sharesRes = await supabase
    .from('expense_shares')
    .insert(input.shares.map((s) => ({ expense_id: res.data.id, group_id: groupId, ...s })));
  if (sharesRes.error) {
    await supabase.from('expenses').delete().eq('id', res.data.id);
    throw new Error(sharesRes.error.message);
  }
}

export async function deleteExpenseById(expenseId: string): Promise<void> {
  const res = await supabase.from('expenses').delete().eq('id', expenseId);
  if (isMissingTable(res.error)) {
    const store = await readLocal();
    store.expenses = store.expenses.filter((e) => e.id !== expenseId);
    store.expense_shares = store.expense_shares.filter((s) => s.expense_id !== expenseId);
    await writeLocal(store);
    return;
  }
  if (res.error) throw new Error(res.error.message);
}

export async function createSettlement(
  groupId: string,
  userId: string,
  input: { from_user: string; to_user: string; amount_minor: number },
): Promise<void> {
  const res = await supabase.from('settlements').insert({
    group_id: groupId,
    from_user: input.from_user,
    to_user: input.to_user,
    amount_minor: input.amount_minor,
  });
  if (isMissingTable(res.error)) {
    const store = await readLocal();
    store.settlements.push({
      id: Crypto.randomUUID(),
      group_id: groupId,
      from_user: input.from_user,
      to_user: input.to_user,
      amount_minor: input.amount_minor,
      created_by: userId,
      created_at: new Date().toISOString(),
    });
    await writeLocal(store);
    return;
  }
  if (res.error) throw new Error(res.error.message);
}
