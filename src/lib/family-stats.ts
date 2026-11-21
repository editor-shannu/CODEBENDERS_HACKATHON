import { balanceOf, daysLate, sumPaid } from "./invoice-status";
import { daysBetween } from "./dates";

export type Tone = "GENTLE" | "FIRM" | "FINAL";

export type InvoiceLite = {
  id: string;
  number: string;
  month: string;
  amount: number;
  dueDate: Date;
  status: string;
  payToken: string;
  payments: { amount: number; date: Date; mode: string }[];
};

export type FamilyLite = {
  id: string;
  parentName: string;
  phone: string;
  language: string;
  notes: string;
  memory: string;
  students: { id: string; name: string; batch: string; monthlyFee: number; dueDay: number; active: boolean }[];
  invoices: InvoiceLite[];
  promises: { id: string; promisedDate: Date; amount: number; kept: boolean | null }[];
  reminders: { tone: string; sentAt: Date }[];
};

export type FamilyStats = {
  balance: number;
  unpaid: InvoiceLite[];
  oldestDaysLate: number;
  monthlyTotal: number;
  delays: number[]; // historical days late per fully paid invoice
  avgDelay: number;
  promisesKept: number;
  promisesBroken: number;
  openPromise: { id: string; promisedDate: Date; amount: number } | null;
  promiseScore: number; // 0..1, smoothed
  chaseScore: number;
  suggestedTone: Tone;
  lastReminder: Date | null;
  payDays: number[]; // day-of-month of past payments
};

export function familyStats(f: FamilyLite, today: Date): FamilyStats {
  const unpaid = f.invoices.filter((i) => balanceOf(i) > 0).sort((a, b) => +a.dueDate - +b.dueDate);
  const balance = unpaid.reduce((s, i) => s + balanceOf(i), 0);
  const overdue = unpaid.filter((i) => i.dueDate < today);
  const oldestDaysLate = overdue.length ? daysLate(overdue[0].dueDate, today) : 0;
  const monthlyTotal = familyMonthlyFee(f.students);

  const delays: number[] = [];
  const payDays: number[] = [];
  for (const inv of f.invoices) {
    if (inv.payments.length === 0) continue;
    const paid = sumPaid(inv.payments);
    const last = inv.payments.reduce((m, p) => (p.date > m ? p.date : m), inv.payments[0].date);
    payDays.push(last.getUTCDate());
    if (paid >= inv.amount) delays.push(Math.max(0, daysBetween(inv.dueDate, last)));
  }
  const avgDelay = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 7;

  const promisesKept = f.promises.filter((p) => p.kept === true).length;
  const promisesBroken = f.promises.filter((p) => p.kept === false).length;
  const open = f.promises.filter((p) => p.kept === null).sort((a, b) => +a.promisedDate - +b.promisedDate)[0] ?? null;
  const promiseScore = (promisesKept + 1) / (promisesKept + promisesBroken + 2);

  const chaseScore = Math.round((balance * (oldestDaysLate + 1) * (1 + promisesBroken)) / (1 + promisesKept) / 1000);

  let suggestedTone: Tone = "GENTLE";
  if (promisesBroken >= 2) suggestedTone = "FINAL";
  else if (oldestDaysLate >= 15) suggestedTone = "FIRM";

  const lastReminder = f.reminders.length
    ? f.reminders.reduce((m, r) => (r.sentAt > m ? r.sentAt : m), f.reminders[0].sentAt)
    : null;

  return {
    balance,
    unpaid,
    oldestDaysLate,
    monthlyTotal,
    delays,
    avgDelay,
    promisesKept,
    promisesBroken,
    openPromise: open,
    promiseScore,
    chaseScore,
    suggestedTone,
    lastReminder,
    payDays,
  };
}

/** Sum of active students' fees, with a 10% sibling discount on the 2nd+ child. */
export function familyMonthlyFee(students: { monthlyFee: number; active: boolean }[]): number {
  const active = students.filter((s) => s.active).sort((a, b) => b.monthlyFee - a.monthlyFee);
  return active.reduce((sum, s, i) => sum + (i === 0 ? s.monthlyFee : Math.round(s.monthlyFee * 0.9)), 0);
}

export function siblingDiscount(students: { monthlyFee: number; active: boolean }[]): number {
  const gross = students.filter((s) => s.active).reduce((s, x) => s + x.monthlyFee, 0);
  return gross - familyMonthlyFee(students);
}

/** Detects a steady payday that differs from the due day (Payday Sync). */
export function paydayPattern(payDays: number[], dueDay: number): number | null {
  if (payDays.length < 3) return null;
  const recent = payDays.slice(-4);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const sd = Math.sqrt(recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length);
  const day = Math.round(mean);
  if (sd <= 2 && Math.abs(day - dueDay) >= 3 && day <= 28) return day;
  return null;
}
