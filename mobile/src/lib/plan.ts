// Types and pure helpers for outing polls, "Surprise me" and split-the-bill.
// Kept in their own file so the existing lib/types.ts is untouched.

import type { SavedPlace } from '@/lib/types';

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
