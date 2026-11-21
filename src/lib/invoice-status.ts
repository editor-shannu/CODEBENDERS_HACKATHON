import { daysBetween } from "./dates";

export type InvoiceStatus = "DRAFT" | "SENT" | "PARTIAL" | "PAID";

export function computeStatus(amount: number, paidTotal: number, current: InvoiceStatus = "SENT"): InvoiceStatus {
  if (paidTotal >= amount && amount > 0) return "PAID";
  if (paidTotal > 0) return "PARTIAL";
  return current === "DRAFT" ? "DRAFT" : "SENT";
}

export function sumPaid(payments: { amount: number }[]): number {
  return payments.reduce((s, p) => s + p.amount, 0);
}

export function balanceOf(inv: { amount: number; payments: { amount: number }[] }): number {
  return Math.max(0, inv.amount - sumPaid(inv.payments));
}

/** Overdue = not fully paid and due date strictly before today (IST day). */
export function isOverdue(inv: { amount: number; dueDate: Date; payments: { amount: number }[] }, today: Date): boolean {
  return balanceOf(inv) > 0 && inv.dueDate < today;
}

export function daysLate(dueDate: Date, today: Date): number {
  return Math.max(0, daysBetween(dueDate, today));
}
