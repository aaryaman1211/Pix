import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { pastelAt } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Member } from '@/lib/types';

export type MemberInfo = { id: string; name: string; initial: string; color: string; role: Member['role'] };

// Several screens show members at once (avatars, "added by" badges), so they share one fetch per
// group. A fetch is reused for a short while, then the next screen that comes into view (or the
// app returning to the foreground) refreshes it, so people who just joined show up.
const FRESH_MS = 15_000;

type Entry = { at: number; promise: Promise<MemberInfo[]> };
const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<(m: MemberInfo[]) => void>>();

function fetchMembers(groupId: string): Promise<MemberInfo[]> {
  return Promise.resolve(
    supabase
      .from('group_members')
      .select('user_id, role, profiles(display_name)')
      .eq('group_id', groupId)
      .order('joined_at')
      .returns<Member[]>(),
  ).then(({ data, error }) => {
    if (error) throw error;
    return data.map((m, i) => {
      const name = m.profiles?.display_name?.trim() || 'Someone';
      return { id: m.user_id, name, initial: name.charAt(0).toUpperCase(), color: pastelAt(i + 1), role: m.role };
    });
  });
}

function load(groupId: string, force = false): Promise<MemberInfo[]> {
  const hit = cache.get(groupId);
  if (hit && !force && Date.now() - hit.at < FRESH_MS) return hit.promise;
  const promise = fetchMembers(groupId);
  cache.set(groupId, { at: Date.now(), promise });
  promise
    .then((members) => listeners.get(groupId)?.forEach((l) => l(members)))
    .catch((err) => {
      cache.delete(groupId);
      console.warn('members failed', err);
    });
  return promise;
}

export function invalidateMembers(groupId: string) {
  cache.delete(groupId);
}

export function useMembers(groupId: string | undefined): MemberInfo[] {
  const [members, setMembers] = useState<MemberInfo[]>([]);

  // Hear about refreshes started by any screen.
  useEffect(() => {
    if (!groupId) return;
    let set = listeners.get(groupId);
    if (!set) listeners.set(groupId, (set = new Set()));
    set.add(setMembers);
    return () => {
      set.delete(setMembers);
    };
  }, [groupId]);

  // Refresh when this screen comes into view (shares a recent fetch if there is one).
  useFocusEffect(
    useCallback(() => {
      if (!groupId) return;
      let cancelled = false;
      load(groupId)
        .then((m) => !cancelled && setMembers(m))
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [groupId]),
  );

  // And when the app comes back to the foreground.
  useEffect(() => {
    if (!groupId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load(groupId, true).catch(() => {});
    });
    return () => sub.remove();
  }, [groupId]);

  return members;
}
