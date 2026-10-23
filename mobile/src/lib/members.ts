import { useEffect, useState } from 'react';

import { pastelAt } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Member } from '@/lib/types';

export type MemberInfo = { id: string; name: string; initial: string; color: string; role: Member['role'] };

// Members rarely change, so share one fetch per group across every screen that shows avatars.
const cache = new Map<string, Promise<MemberInfo[]>>();

function load(groupId: string): Promise<MemberInfo[]> {
  let p = cache.get(groupId);
  if (!p) {
    p = Promise.resolve(
      supabase
        .from('group_members')
        .select('user_id, role, profiles(display_name)')
        .eq('group_id', groupId)
        .order('joined_at')
        .returns<Member[]>(),
    ).then(({ data, error }) => {
      if (error) {
        cache.delete(groupId);
        throw error;
      }
      return data.map((m, i) => {
        const name = m.profiles?.display_name?.trim() || 'Someone';
        return { id: m.user_id, name, initial: name.charAt(0).toUpperCase(), color: pastelAt(i + 1), role: m.role };
      });
    });
    cache.set(groupId, p);
  }
  return p;
}

export function invalidateMembers(groupId: string) {
  cache.delete(groupId);
}

export function useMembers(groupId: string | undefined): MemberInfo[] {
  const [members, setMembers] = useState<MemberInfo[]>([]);
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    load(groupId)
      .then((m) => !cancelled && setMembers(m))
      .catch((err) => console.warn('members failed', err));
    return () => {
      cancelled = true;
    };
  }, [groupId]);
  return members;
}
