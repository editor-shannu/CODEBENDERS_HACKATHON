import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { addDays, dateInMonth, todayIST } from "./dates";
import { computeStatus, sumPaid } from "./invoice-status";
import { familyMonthlyFee } from "./family-stats";

/** Creates one family's invoice for a month (sibling discount applied). Returns null when it exists or no student is active. */
export async function createInvoiceFor(familyId: string, month: string, status: "DRAFT" | "SENT" = "DRAFT") {
  const f = await db.family.findUnique({ where: { id: familyId }, include: { students: true, invoices: { where: { month } } } });
  if (!f || f.invoices.length) return null;
  const active = f.students.filter((s) => s.active);
  if (!active.length) return null;
  const sorted = [...active].sort((a, b) => b.monthlyFee - a.monthlyFee);
  const amount = familyMonthlyFee(active);
  const gross = active.reduce((s, x) => s + x.monthlyFee, 0);
  const n = (await db.invoice.count({ where: { month } })) + 1;
  let number = `LTP-${month}-${String(n).padStart(3, "0")}`;
  if (await db.invoice.findUnique({ where: { number } })) number = `${number}-${randomBytes(2).toString("hex")}`;
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
