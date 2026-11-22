"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { addDays, dateInMonth, fromKey, monthKey, todayIST, toKey } from "@/lib/dates";
import { familyMonthlyFee } from "@/lib/family-stats";
import { computeStatus, sumPaid } from "@/lib/invoice-status";
import { seedDemo } from "@/lib/seed-data";
import { billSchema, claimSchema, paymentSchema, promiseSchema, settingsSchema, studentSchema } from "@/lib/validators";

export type ActionResult = { ok: true; message?: string; status?: string } | { ok: false; error: string };

const refreshAll = () => revalidatePath("/", "layout");

async function recalcInvoice(invoiceId: string) {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true } });
  const status = computeStatus(inv.amount, sumPaid(inv.payments), inv.status as "SENT");
  await db.invoice.update({ where: { id: invoiceId }, data: { status } });
  // a payment keeps any open promise from this family
  if (status === "PAID") {
    const today = todayIST();
    const open = await db.payPromise.findMany({ where: { familyId: inv.familyId, kept: null } });
    for (const p of open) await db.payPromise.update({ where: { id: p.id }, data: { kept: p.promisedDate >= addDays(today, -1) } });
    await db.agentAction.updateMany({ where: { familyId: inv.familyId, status: { in: ["PENDING", "APPROVED"] }, type: { in: ["REMIND", "FOLLOW_UP"] } }, data: { status: "DONE" } });
  }
  return status;
}

export async function recordPayment(input: { invoiceId: string; amount: number; mode: string; reference?: string; date?: string }): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse({ ...input, date: input.date ?? toKey(todayIST()) });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
  const { invoiceId, amount, mode, reference, date } = parsed.data;
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!inv) return { ok: false, error: "Invoice not found" };
  const balance = inv.amount - sumPaid(inv.payments);
  if (amount > balance) return { ok: false, error: `Only ${balance} is due on this invoice` };
  await db.payment.create({ data: { invoiceId, amount, mode, reference: reference || null, date: fromKey(date) } });
  const status = await recalcInvoice(invoiceId);
  refreshAll();
  return { ok: true, status };
}

/** Records one payment for a family, settling its oldest unpaid invoices first (Chase Queue "Mark paid"). */
export async function recordFamilyPayment(input: { familyId: string; amount: number; mode: string; reference?: string; date?: string }): Promise<ActionResult> {
  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter the amount received" };
  if (input.mode !== "CASH" && input.mode !== "UPI") return { ok: false, error: "Pick cash or UPI" };
  const invoices = await db.invoice.findMany({ where: { familyId: input.familyId }, include: { payments: true }, orderBy: { dueDate: "asc" } });
  const open = invoices.map((i) => ({ inv: i, bal: i.amount - sumPaid(i.payments) })).filter((x) => x.bal > 0);
  const due = open.reduce((s, x) => s + x.bal, 0);
  if (!open.length) return { ok: false, error: "Nothing is due from this family" };
  if (amount > due) return { ok: false, error: `Only ${due} is due from this family` };
  let left = amount;
  let status = "PARTIAL";
  for (const { inv, bal } of open) {
    if (left <= 0) break;
    const part = Math.min(left, bal);
    const res = await recordPayment({ invoiceId: inv.id, amount: part, mode: input.mode, reference: input.reference, date: input.date });
    if (!res.ok) return res;
    left -= part;
  }
  if (amount === due) status = "PAID";
  refreshAll();
  return { ok: true, status };
}

export async function addPromise(input: { familyId: string; promisedDate: string; amount: number; note?: string; source?: string }): Promise<ActionResult> {
  const parsed = promiseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
  await db.payPromise.create({
    data: { familyId: parsed.data.familyId, promisedDate: fromKey(parsed.data.promisedDate), amount: parsed.data.amount, note: parsed.data.note ?? "", source: input.source ?? "MANUAL" },
  });
  refreshAll();
  return { ok: true, message: "Promise recorded" };
}

export async function logReminder(familyId: string, tone: string, language: string): Promise<ActionResult> {
  await db.reminder.create({ data: { familyId, tone, language } });
  refreshAll();
  return { ok: true };
}

export async function generateMonthInvoices(): Promise<ActionResult> {
  const today = todayIST();
  const month = monthKey(today);
  const families = await db.family.findMany({ include: { students: true, invoices: { where: { month } } } });
  const count = await db.invoice.count({ where: { month } });
  let n = count;
  let created = 0;
  for (const f of families) {
    const active = f.students.filter((s) => s.active);
    if (!active.length || f.invoices.length) continue;
    const sorted = [...active].sort((a, b) => b.monthlyFee - a.monthlyFee);
    const amount = familyMonthlyFee(active);
    const gross = active.reduce((s, x) => s + x.monthlyFee, 0);
    n++;
    await db.invoice.create({
      data: {
        number: `LTP-${month}-${String(n).padStart(3, "0")}`,
        familyId: f.id,
        month,
        amount,
        discount: gross - amount,
        dueDate: dateInMonth(month, sorted[0].dueDay),
        status: "SENT",
        payToken: randomBytes(12).toString("base64url"),
        lines: JSON.stringify(sorted.map((s, i) => ({ name: s.name, batch: s.batch, fee: s.monthlyFee, discount: i === 0 ? 0 : Math.round(s.monthlyFee * 0.1) }))),
      },
    });
    created++;
  }
  refreshAll();
  return { ok: true, message: created ? `Created ${created} invoices for this month` : "This month's invoices already exist" };
}

export async function saveStudent(input: Record<string, unknown> & { id?: string }): Promise<ActionResult> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
  const d = parsed.data;
  if (input.id) {
    await db.student.update({ where: { id: String(input.id) }, data: { name: d.name, batch: d.batch, monthlyFee: d.monthlyFee, dueDay: d.dueDay } });
    refreshAll();
    return { ok: true, message: "Saved" };
  }
  let familyId = d.familyId;
  if (!familyId) {
    if (!d.parentName || d.parentName.length < 2) return { ok: false, error: "Add the parent's name" };
    const fam = await db.family.create({ data: { parentName: d.parentName, language: d.language ?? "te" } });
    familyId = fam.id;
  }
  await db.student.create({ data: { familyId, name: d.name, batch: d.batch, monthlyFee: d.monthlyFee, dueDay: d.dueDay } });
  refreshAll();
  return { ok: true, message: "Student added" };
}

export async function setStudentActive(id: string, active: boolean): Promise<ActionResult> {
  await db.student.update({ where: { id }, data: { active } });
  refreshAll();
  return { ok: true };
}

export async function updateFamily(input: { id: string; parentName: string; language: string; notes: string }): Promise<ActionResult> {
  if (!input.parentName || input.parentName.trim().length < 2) return { ok: false, error: "Add the parent's name" };
  await db.family.update({ where: { id: input.id }, data: { parentName: input.parentName.trim(), language: input.language, notes: input.notes } });
  refreshAll();
  return { ok: true, message: "Saved" };
}

export async function saveSettings(input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
  await db.settings.upsert({ where: { id: 1 }, update: parsed.data, create: { id: 1, ...parsed.data } });
  refreshAll();
  return { ok: true, message: "Settings saved" };
}

export async function saveBill(input: Record<string, unknown> & { id?: string }): Promise<ActionResult> {
  const parsed = billSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the bill" };
  if (input.id) await db.bill.update({ where: { id: String(input.id) }, data: parsed.data });
  else await db.bill.create({ data: parsed.data });
  refreshAll();
  return { ok: true };
}

export async function deleteBill(id: string): Promise<ActionResult> {
  await db.bill.delete({ where: { id } });
  refreshAll();
  return { ok: true };
}

export async function saveKeyDate(input: { id?: string; name: string; start: string; end: string; factor: number }): Promise<ActionResult> {
  if (!input.name || !input.start || !input.end) return { ok: false, error: "Name, start and end are required" };
  const data = { name: input.name, startDate: fromKey(input.start), endDate: fromKey(input.end), collectionFactor: Math.min(1, Math.max(0, input.factor)) };
  if (input.id) await db.keyDate.update({ where: { id: input.id }, data });
  else await db.keyDate.create({ data });
  refreshAll();
  return { ok: true };
}

export async function deleteKeyDate(id: string): Promise<ActionResult> {
  await db.keyDate.delete({ where: { id } });
  refreshAll();
  return { ok: true };
}

export async function resetDemo(): Promise<ActionResult> {
  await seedDemo(db);
  refreshAll();
  return { ok: true, message: "Demo data reset to today" };
}

/* ---------- Parent Pay Link ---------- */
export async function submitClaim(input: { token: string; amount: number; reference: string }): Promise<ActionResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
  const inv = await db.invoice.findUnique({ where: { payToken: parsed.data.token } });
  if (!inv) return { ok: false, error: "This payment link is not valid" };
  await db.paymentClaim.create({ data: { invoiceId: inv.id, amount: parsed.data.amount, reference: parsed.data.reference } });
  refreshAll();
  return { ok: true, message: "Thank you! The teacher will confirm shortly." };
}

export async function confirmClaim(id: string): Promise<ActionResult> {
  const claim = await db.paymentClaim.findUnique({ where: { id }, include: { invoice: { include: { payments: true } } } });
  if (!claim || claim.status !== "PENDING") return { ok: false, error: "Already handled" };
  const balance = claim.invoice.amount - sumPaid(claim.invoice.payments);
  await db.payment.create({ data: { invoiceId: claim.invoiceId, amount: Math.min(balance, claim.amount), mode: "UPI", reference: claim.reference, date: todayIST() } });
  await db.paymentClaim.update({ where: { id }, data: { status: "CONFIRMED" } });
  const status = await recalcInvoice(claim.invoiceId);
  refreshAll();
  return { ok: true, status };
}

export async function rejectClaim(id: string): Promise<ActionResult> {
  await db.paymentClaim.update({ where: { id }, data: { status: "REJECTED" } });
  refreshAll();
  return { ok: true };
}

/* ---------- Munshi ---------- */
export async function applyDueDate(familyId: string, dueDay: number, reason = ""): Promise<ActionResult> {
  if (dueDay < 1 || dueDay > 28) return { ok: false, error: "Due day must be 1 to 28" };
  await db.student.updateMany({ where: { familyId, active: true }, data: { dueDay } });
  await db.agentAction.create({ data: { type: "DUE_DATE", familyId, title: `Due date moved to day ${dueDay}`, reason, status: "DONE", source: "RULES" } });
  refreshAll();
  return { ok: true, message: `Due date moved to the ${dueDay}` };
}

export async function deferBill(billId: string, days: number, reason = ""): Promise<ActionResult> {
  const bill = await db.bill.findUnique({ where: { id: billId } });
  if (!bill) return { ok: false, error: "Bill not found" };
  await db.bill.update({ where: { id: billId }, data: { deferDays: Math.max(0, Math.min(20, days)) } });
  await db.agentAction.create({ data: { type: "DEFER_BILL", title: `Pushed "${bill.name}" by ${days} days`, reason, status: "DONE", source: "RULES" } });
  refreshAll();
  return { ok: true, message: `${bill.name} pushed by ${days} days` };
}

export async function logAgentAction(input: { type: string; title: string; detail?: string; reason?: string; familyId?: string; status?: string; source?: string }): Promise<ActionResult> {
  await db.agentAction.create({
    data: { type: input.type, title: input.title, detail: input.detail ?? "", reason: input.reason ?? "", familyId: input.familyId ?? null, status: input.status ?? "DONE", source: input.source ?? "RULES" },
  });
  refreshAll();
  return { ok: true };
}

export async function setActionStatus(id: string, status: "APPROVED" | "DONE" | "SKIPPED"): Promise<ActionResult> {
  await db.agentAction.update({ where: { id }, data: { status } });
  refreshAll();
  return { ok: true };
}

export async function readReplyAction(familyId: string, text: string) {
  const { parseReply } = await import("@/lib/munshi/agent");
  const { familyStats } = await import("@/lib/family-stats");
  const f = await db.family.findUnique({
    where: { id: familyId },
    include: { students: true, invoices: { include: { payments: true } }, promises: true, reminders: true },
  });
  if (!f || !text.trim()) return { ok: false as const, error: "Pick a family and paste their reply" };
  const today = todayIST();
  const balance = familyStats(f, today).balance;
  const r = await parseReply(text.trim(), today, balance, f.parentName);
  await db.agentAction.create({ data: { type: "NOTE", familyId, title: `Read reply from ${f.parentName}`, detail: text.slice(0, 200), reason: r.summary, status: "DONE", source: r.source } });
  refreshAll();
  return { ok: true as const, result: r, balance };
}

export async function askMunshiAction(question: string) {
  if (!question.trim()) return { ok: false as const, error: "Ask a question" };
  const { askMunshi } = await import("@/lib/munshi/agent");
  const { loadDashboard } = await import("@/lib/board-view");
  const { board, forecast } = await loadDashboard();
  const r = await askMunshi(question.trim().slice(0, 500), { families: board.families, forecast, totalPending: board.totalPending, today: board.today });
  return { ok: true as const, ...r };
}

export async function createPlanFromSteps(input: { title: string; goal: string; steps: { type: string; familyId?: string; title: string; detail: string; reason: string; payload: Record<string, unknown> }[] }): Promise<ActionResult> {
  await db.agentPlan.updateMany({ where: { status: { in: ["PROPOSED", "ACTIVE"] } }, data: { status: "DISMISSED" } });
  await db.agentPlan.create({
    data: {
      title: input.title,
      goal: input.goal,
      status: "PROPOSED",
      actions: { create: input.steps.map((s, i) => ({ type: s.type, familyId: s.familyId ?? null, title: s.title, detail: s.detail, reason: s.reason, payload: JSON.stringify(s.payload), step: i + 1 })) },
    },
  });
  refreshAll();
  return { ok: true, message: "Plan sent to your approval inbox" };
}
