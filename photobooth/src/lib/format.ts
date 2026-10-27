export function prettyType(type?: string | null): string {
  if (!type) return 'Place';
  const label = type.replace(/_restaurant$/, '').replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function priceLabel(level?: number | null): string {
  return level ? '$'.repeat(level) : '';
}

export function distanceLabel(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

// Dates are stored as YYYY-MM-DD; parse them as local dates, not UTC.
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dayLabel(day: string): string {
  return parseDay(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Next time this date comes around (today counts), or null if it is a past one-off.
export function nextOccurrence(day: string, repeatsYearly: boolean): Date | null {
  const date = parseDay(day);
  const today = startOfToday();
  if (!repeatsYearly) return date >= today ? date : null;
  const next = new Date(today.getFullYear(), date.getMonth(), date.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return next;
}

export function daysUntil(date: Date): number {
  return Math.round((date.getTime() - startOfToday().getTime()) / 86_400_000);
}

export function countdownLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}
