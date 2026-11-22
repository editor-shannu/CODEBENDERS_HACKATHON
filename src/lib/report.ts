import { daysBetween } from "./dates";
import { sumPaid } from "./invoice-status";

/** Month Report Card numbers, from one month's issued invoices and the promises dated in that month. Pure, so it is unit-tested. */
export type ReportInvoice = { familyId: string; parent: string; amount: number; dueDate: Date; payments: { amount: number; date: Date }[] };
export type ReportCard = {
  due: number;
  collected: number;
  outstanding: number;
  invoices: number;
  paidInFull: number;
  onTime: number;
  onTimeRate: number; // 0..1 of invoices paid in full by the due date
  promisesKept: number;
  promisesBroken: number;
  best: { parent: string; days: number }[]; // earliest payers (days after due, negative = early)
  slowest: { parent: string; days: number; open: boolean }[];
};

export function buildReport(invoices: ReportInvoice[], promises: { kept: boolean | null }[], today: Date): ReportCard {
  const due = invoices.reduce((s, i) => s + i.amount, 0);
  const collected = invoices.reduce((s, i) => s + Math.min(i.amount, sumPaid(i.payments)), 0);
  const rows = invoices.map((i) => {
    const paid = sumPaid(i.payments) >= i.amount;
    const last = i.payments.length ? i.payments.reduce((d, p) => (p.date > d ? p.date : d), i.payments[0].date) : null;
    const days = paid && last ? daysBetween(i.dueDate, last) : Math.max(0, daysBetween(i.dueDate, today));
    return { parent: i.parent, paid, days };
  });
  const paidRows = rows.filter((r) => r.paid);
  const onTime = paidRows.filter((r) => r.days <= 0).length;
  return {
    due,
    collected,
    outstanding: due - collected,
    invoices: invoices.length,
    paidInFull: paidRows.length,
    onTime,
    onTimeRate: invoices.length ? onTime / invoices.length : 0,
    promisesKept: promises.filter((p) => p.kept === true).length,
    promisesBroken: promises.filter((p) => p.kept === false).length,
    best: [...paidRows].sort((a, b) => a.days - b.days).slice(0, 3).map((r) => ({ parent: r.parent, days: r.days })),
    slowest: [...rows].filter((r) => r.days > 0).sort((a, b) => b.days - a.days).slice(0, 3).map((r) => ({ parent: r.parent, days: r.days, open: !r.paid })),
  };
}
