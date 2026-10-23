import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/lib/types';

const ACTIVE_GROUP_KEY = 'pix.activeGroupId';

type GroupState = {
  groups: Group[];
  active: Group | null;
  loading: boolean;
  setActiveId: (id: string) => void;
  refresh: () => Promise<Group[]>;
};

const GroupContext = createContext<GroupState | null>(null);

export function GroupProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  // Which user the groups were loaded for. Deriving `loading` from this (rather than a flag set in an
  // effect) means it is already true in the same render the session appears, so the root layout
  // never briefly sees "signed in with no groups" and flashes onboarding.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = !!userId && loadedFor !== userId;

  const refresh = useCallback(async () => {
    // RLS limits this to groups the user belongs to.
    const { data, error } = await supabase.from('groups').select('*').order('created_at');
    if (error) throw error;
    setGroups(data);
    return data as Group[];
  }, []);

  useEffect(() => {
    if (!userId) {
      setGroups([]);
      setLoadedFor(null);
      return;
    }
    let cancelled = false;
    Promise.all([refresh(), AsyncStorage.getItem(ACTIVE_GROUP_KEY)])
      .then(([, stored]) => {
        if (!cancelled) setActiveIdState(stored);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoadedFor(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);

  const setActiveId = useCallback((id: string) => {
    setActiveIdState(id);
    AsyncStorage.setItem(ACTIVE_GROUP_KEY, id).catch(console.error);
  }, []);

  const active = groups.find((g) => g.id === activeId) ?? groups[0] ?? null;

  return (
    <GroupContext value={{ groups, active, loading, setActiveId, refresh }}>{children}</GroupContext>
  );
}

export function useGroups() {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroups must be used inside GroupProvider');
  return ctx;
}

// For screens that only render once a group exists (everything behind onboarding).
export function useActiveGroup(): Group {
  const { active } = useGroups();
  if (!active) throw new Error('useActiveGroup called with no group');
  return active;
}
