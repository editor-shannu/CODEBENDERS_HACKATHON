import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { addDays, dateInMonth, todayIST } from "./dates";
import { computeStatus, sumPaid } from "./invoice-status";
import { familyMonthlyFee } from "./family-stats";

/** True when a student's Fee Pause covers the month (YYYY-MM). */
export function isPaused(pausedMonths: string | null | undefined, month: string): boolean {
  return (pausedMonths ?? "").split(",").map((m) => m.trim()).includes(month);
}

/** Invoice number prefix from the centre's initials ("Lakshmi Teaching Point" -> "LTP"); "INV" when unset. */
export function invoicePrefix(centreName: string): string {
  const initials = centreName.split(/\s+/).map((w) => w.replace(/[^A-Za-z]/g, "")[0] ?? "").join("").toUpperCase().slice(0, 4);
  return initials.length >= 2 ? initials : "INV";
}

/** Creates one family's invoice for a month (sibling discount applied). Returns null when it exists or no student is active. */
export async function createInvoiceFor(familyId: string, month: string, status: "DRAFT" | "SENT" = "DRAFT") {
  const f = await db.family.findUnique({ where: { id: familyId }, include: { students: true, invoices: { where: { month } } } });
  if (!f || f.invoices.length) return null;
  // Fee Pause: a student paused for this month is left off the invoice
  const active = f.students.filter((s) => s.active && !isPaused(s.pausedMonths, month));
  if (!active.length) return null;
  const sorted = [...active].sort((a, b) => b.monthlyFee - a.monthlyFee);
  const amount = familyMonthlyFee(active);
  const gross = active.reduce((s, x) => s + x.monthlyFee, 0);
  const settings = await db.settings.findFirst({ select: { centreName: true } });
  const prefix = invoicePrefix(settings?.centreName ?? "");
  const n = (await db.invoice.count({ where: { month } })) + 1;
  let number = `${prefix}-${month}-${String(n).padStart(3, "0")}`;
  if (await db.invoice.findFirst({ where: { number } })) number = `${number}-${randomBytes(2).toString("hex")}`;
  return db.invoice.create({
    data: {
      number,
      familyId,
      month,
      amount,
      discount: gross - amount,
      dueDate: dateInMonth(month, sorted[0].dueDay),
      status,
      payToken: randomBytes(12).toString("base64url"),
      lines: JSON.stringify(sorted.map((s, i) => ({ name: s.name, batch: s.batch, fee: s.monthlyFee, discount: i === 0 ? 0 : Math.round(s.monthlyFee * 0.1) }))),
    },
  });
}

/** Recomputes an invoice's status from its payments; a full payment keeps the family's open promises and closes chase actions. */
export async function recalcInvoice(invoiceId: string) {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true } });
  const status = computeStatus(inv.amount, sumPaid(inv.payments), inv.status as "SENT");
  await db.invoice.update({ where: { id: invoiceId }, data: { status } });
  if (status === "PAID") {
    const today = todayIST();
    const open = await db.payPromise.findMany({ where: { familyId: inv.familyId, kept: null } });
    for (const p of open) await db.payPromise.update({ where: { id: p.id }, data: { kept: p.promisedDate >= addDays(today, -1) } });
    await db.agentAction.updateMany({ where: { familyId: inv.familyId, planId: null, status: { in: ["PENDING", "APPROVED"] }, type: { in: ["REMIND", "FOLLOW_UP"] } }, data: { status: "DONE" } });
  }
  return status;
}
