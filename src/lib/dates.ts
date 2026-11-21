/**
 * Every calendar date in Baaki is an IST (Asia/Kolkata) calendar day, represented as a
 * JS Date at 00:00 UTC of that day. Nothing is hard-coded: "today" always comes from the
 * real clock, read in IST.
 */
const DAY = 86_400_000;
export const TZ = "Asia/Kolkata";

export function istKey(d: Date = new Date()): string {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function fromKey(key: string): Date {
  return new Date(`${key.slice(0, 10)}T00:00:00Z`);
}

export function todayIST(now: Date = new Date()): Date {
  return fromKey(istKey(now));
}

export function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY);
}

export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}

export function dateInMonth(month: string, day: number): Date {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1, Math.min(day, last)));
}

export function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Next date (>= from) that falls on the given day of month. */
export function nextDayOfMonth(from: Date, day: number): Date {
  const thisMonth = dateInMonth(monthKey(from), day);
  if (thisMonth >= from) return thisMonth;
  return dateInMonth(monthKey(addMonths(monthStart(from), 1)), day);
}

/** "Sat, 21 Nov 2026" */
export function formatDate(d: Date, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const { weekday = true, year = true } = opts;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: weekday ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: year ? "numeric" : undefined,
  }).format(d);
}

/** "Nov 2026" from "2026-11" */
export function formatMonth(month: string, short = true): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: short ? "short" : "long", year: "numeric" }).format(
    fromKey(`${month}-01`),
  );
}

export function formatMonthShort(month: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "short" }).format(fromKey(`${month}-01`));
}

/** "due 3 days ago", "due today", "due in 4 days" */
export function relativeDue(due: Date, today: Date): string {
  const d = daysBetween(today, due);
  if (d === 0) return "due today";
  if (d === 1) return "due tomorrow";
  if (d === -1) return "due yesterday";
  return d < 0 ? `due ${-d} days ago` : `due in ${d} days`;
}

export function relativeDays(date: Date, today: Date): string {
  const d = daysBetween(today, date);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d < 0 ? `${-d} days ago` : `in ${d} days`;
}
