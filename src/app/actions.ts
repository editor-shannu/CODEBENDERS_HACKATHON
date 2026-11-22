"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { addDays, fromKey, monthKey, todayIST, toKey } from "@/lib/dates";
import { sumPaid } from "@/lib/invoice-status";
import { seedDemo } from "@/lib/seed-data";
import { settlePlanForBill, settlePlanForPayment } from "@/lib/munshi/plan";
import { createInvoiceFor, recalcInvoice } from "@/lib/invoices";
import { learnFromHistory, learnFromReply } from "@/lib/munshi/memory";
import { billSchema, claimSchema, paymentSchema, promiseSchema, settingsSchema, studentSchema } from "@/lib/validators";

export type ActionResult = { ok: true; message?: string; status?: string } | { ok: false; error: string };

const refreshAll = () => revalidatePath("/", "layout");

export async function recordPayment(input: { invoiceId: string; amount: number; mode: string; reference?: string; date?: string }): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse({ ...input, date: input.date ?? toKey(todayIST()) });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
  const { invoiceId, amount, mode, reference, date } = parsed.data;
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!inv) return { ok: false, error: "Invoice not found" };
  if (inv.status === "DRAFT") return { ok: false, error: "Issue this invoice before recording a payment" };
  const balance = inv.amount - sumPaid(inv.payments);
  if (amount > balance) return { ok: false, error: `Only ${balance} is due on this invoice` };
  await db.payment.create({ data: { invoiceId, amount, mode, reference: reference || null, date: fromKey(date) } });
  const status = await recalcInvoice(invoiceId);
  await settlePlanForPayment(inv.familyId, amount);
  await learnFromHistory(inv.familyId);
  refreshAll();
  return { ok: true, status };
}

/** Records one payment for a family, settling its oldest unpaid invoices first (Chase Queue "Mark paid"). */
export async function recordFamilyPayment(input: { familyId: string; amount: number; mode: string; reference?: string; date?: string }): Promise<ActionResult> {
  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter the amount received" };
  if (input.mode !== "CASH" && input.mode !== "UPI") return { ok: false, error: "Pick cash or UPI" };
  const invoices = await db.invoice.findMany({ where: { familyId: input.familyId, status: { not: "DRAFT" } }, include: { payments: true }, orderBy: { dueDate: "asc" } });
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
  // sending clears any nudge that was due by today
  await db.reminder.updateMany({ where: { familyId, status: "SCHEDULED", scheduledFor: { lte: todayIST() } }, data: { status: "DONE" } });
  refreshAll();
  return { ok: true };
}

export async function generateMonthInvoices(): Promise<ActionResult> {
  const month = monthKey(todayIST());
  const families = await db.family.findMany({ select: { id: true } });
  let created = 0;
  for (const f of families) if (await createInvoiceFor(f.id, month, "DRAFT")) created++;
  refreshAll();
  return { ok: true, message: created ? `Created ${created} draft invoices. Check them, then Issue all.` : "This month's invoices already exist" };
}

/** Issues drafts: they start counting as owed and their pay links work. */
export async function issueDrafts(input: { ids?: string[] } = {}): Promise<ActionResult> {
  const r = await db.invoice.updateMany({ where: { status: "DRAFT", ...(input.ids?.length ? { id: { in: input.ids } } : {}) }, data: { status: "SENT" } });
  refreshAll();
  return { ok: true, message: r.count ? `Issued ${r.count} invoice${r.count > 1 ? "s" : ""}` : "No drafts to issue" };
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
  if (!inv || inv.status === "DRAFT") return { ok: false, error: "This payment link is not valid" };
  await db.paymentClaim.create({ data: { invoiceId: inv.id, amount: parsed.data.amount, reference: parsed.data.reference } });
  refreshAll();
  return { ok: true, message: "Thank you! The teacher will confirm shortly." };
}

export async function confirmClaim(id: string): Promise<ActionResult> {
  const claim = await db.paymentClaim.findUnique({ where: { id }, include: { invoice: { include: { payments: true } } } });
  if (!claim || claim.status !== "PENDING") return { ok: false, error: "Already handled" };
  const balance = claim.invoice.amount - sumPaid(claim.invoice.payments);
  const paid = Math.min(balance, claim.amount);
  await db.payment.create({ data: { invoiceId: claim.invoiceId, amount: paid, mode: "UPI", reference: claim.reference, date: todayIST() } });
  await db.paymentClaim.update({ where: { id }, data: { status: "CONFIRMED" } });
  const status = await recalcInvoice(claim.invoiceId);
  await settlePlanForPayment(claim.invoice.familyId, paid);
  await learnFromHistory(claim.invoice.familyId);
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
  await settlePlanForBill(billId);
  refreshAll();
  return { ok: true, message: `${bill.name} pushed by ${days} days` };
}

/** Morning Brief "Approve all": approves every actionable brief item, logs each to AgentAction, returns how many. */
export async function approveAllBrief(): Promise<ActionResult & { count?: number }> {
  const { loadDashboard } = await import("@/lib/board-view");
  const { brief, board } = await loadDashboard();
  const today = board.today;
  const already = await db.agentAction.findMany({ where: { createdAt: { gte: addDays(today, 0) }, status: { in: ["APPROVED", "DONE"] }, reason: { startsWith: "brief:" } } });
  const seen = new Set(already.map((a) => a.reason.split(" ")[0]));
  let count = 0;
  for (const item of brief) {
    const tag = `brief:${item.key}`;
    if (seen.has(tag)) continue;
    if (item.type === "REMIND" || item.type === "FOLLOW_UP") {
      await db.agentAction.create({
        data: { type: item.type, familyId: item.familyId ?? null, title: item.title, detail: item.detail, reason: `${tag} ${item.reason}`, payload: JSON.stringify(item.payload ?? {}), status: "APPROVED", source: "RULES" },
      });
      count++;
    } else if (item.type === "DUE_DATE" && item.familyId) {
      const dueDay = Number(item.payload?.dueDay);
      if (dueDay >= 1 && dueDay <= 28) {
        await db.student.updateMany({ where: { familyId: item.familyId, active: true }, data: { dueDay } });
        await db.agentAction.create({ data: { type: "DUE_DATE", familyId: item.familyId, title: item.title, reason: `${tag} ${item.reason}`, payload: JSON.stringify({ dueDay }), status: "DONE", source: "RULES" } });
        count++;
      }
    }
  }
  // anything Munshi left waiting in the approval inbox that is not a money action is approved too
  const pending = await db.agentAction.findMany({ where: { status: "PENDING", type: { in: ["REMIND", "FOLLOW_UP", "NOTE", "PROMISE"] } } });
  for (const a of pending) {
    await db.agentAction.update({ where: { id: a.id }, data: { status: "APPROVED" } });
    count++;
  }
  refreshAll();
  return { ok: true, count, message: count ? `Approved ${count} action${count > 1 ? "s" : ""}` : "Nothing left to approve" };
}

export async function logAgentAction(input: { type: string; title: string; detail?: string; reason?: string; familyId?: string; status?: string; source?: string }): Promise<ActionResult> {
  await db.agentAction.create({
    data: { type: input.type, title: input.title, detail: input.detail ?? "", reason: input.reason ?? "", familyId: input.familyId ?? null, status: input.status ?? "DONE", source: input.source ?? "RULES" },
  });
  refreshAll();
  return { ok: true };
}

export async function setActionStatus(id: string, status: "APPROVED" | "DONE" | "SKIPPED"): Promise<ActionResult> {
  if (status === "DONE") {
    // approving a Munshi proposal carries it out (payment, promise, nudge, invoice, due date)
    const { approveAction } = await import("@/lib/munshi/execute");
    const line = await approveAction(id);
    if (line) {
      refreshAll();
      return { ok: true, message: line };
    }
  }
  await db.agentAction.update({ where: { id }, data: { status } });
  refreshAll();
  return { ok: true };
}

export async function readReplyAction(familyId: string, text: string) {
  const { parseReply } = await import("@/lib/munshi/agent");
  const { familyStats } = await import("@/lib/family-stats");
  const { loadDashboard } = await import("@/lib/board-view");
  const f = await db.family.findUnique({
    where: { id: familyId },
    include: { students: true, invoices: { include: { payments: true } }, promises: true, reminders: { where: { status: "SENT" } } },
  });
  if (!f || !text.trim()) return { ok: false as const, error: "Pick a family and paste their reply" };
  const today = todayIST();
  const balance = familyStats(f, today).balance;
  const r = await parseReply(text.trim(), today, balance, f.parentName);
  await learnFromReply(familyId, text.trim(), r.promisedDate);
  await db.agentAction.create({ data: { type: "NOTE", familyId, title: `Read reply from ${f.parentName}`, detail: text.slice(0, 200), reason: r.summary, status: "DONE", source: r.source } });

  let scheduled: { promiseDate: string; amount: number; followUpDate: string; riskBefore: number | null; riskAfter: number | null } | null = null;
  if (r.promisedDate && balance > 0) {
    const before = (await loadDashboard()).forecast.rent?.risk ?? null;
    const amount = Math.min(balance, Math.max(1, Math.round(r.amount ?? balance)));
    const promisedDate = fromKey(r.promisedDate);
    // one open promise per family: a new reply replaces the old date
    const open = await db.payPromise.findFirst({ where: { familyId, kept: null }, orderBy: { createdAt: "desc" } });
    if (open) await db.payPromise.update({ where: { id: open.id }, data: { promisedDate, amount, note: text.slice(0, 200), source: "MUNSHI" } });
    else await db.payPromise.create({ data: { familyId, promisedDate, amount, note: text.slice(0, 200), source: "MUNSHI" } });
    const followUp = addDays(promisedDate, 1);
    await db.reminder.deleteMany({ where: { familyId, status: "SCHEDULED", note: { startsWith: "promise-follow-up" } } });
    await db.reminder.create({ data: { familyId, tone: "GENTLE", language: f.language, status: "SCHEDULED", scheduledFor: followUp, note: `promise-follow-up ${r.promisedDate}` } });
    await db.agentAction.create({ data: { type: "PROMISE", familyId, title: `${f.parentName} promised ${amount} on ${r.promisedDate}; follow-up nudge on ${toKey(followUp)}`, reason: r.summary, status: "DONE", source: r.source } });
    const after = (await loadDashboard()).forecast.rent?.risk ?? null;
    scheduled = { promiseDate: r.promisedDate, amount, followUpDate: toKey(followUp), riskBefore: before, riskAfter: after };
  }
  refreshAll();
  return { ok: true as const, result: r, balance, scheduled };
}

export async function askMunshiAction(question: string) {
  if (!question.trim()) return { ok: false as const, error: "Ask a question" };
  const { askMunshi } = await import("@/lib/munshi/agent");
  const { loadDashboard } = await import("@/lib/board-view");
  const { getOrigin } = await import("@/lib/origin");
  const { board, forecast, input } = await loadDashboard();
  const r = await askMunshi(question.trim().slice(0, 500), {
    families: board.families,
    forecast,
    input,
    totalPending: board.totalPending,
    today: board.today,
    autonomy: board.settings.autonomy,
    centreName: board.settings.centreName,
    tutorName: board.settings.tutorName,
    origin: await getOrigin(),
  });
  if (r.actions?.length) refreshAll();
  return { ok: true as const, ...r };
}

export async function createPlanFromSteps(input: {
  title: string;
  goal: string;
  status?: "PROPOSED" | "ACTIVE";
  gap?: number;
  rentAmount?: number;
  rentDate?: string;
  steps: { type: string; familyId?: string; title: string; detail: string; reason: string; payload: Record<string, unknown> }[];
}): Promise<ActionResult> {
  await db.agentPlan.updateMany({ where: { status: { in: ["PROPOSED", "ACTIVE"] } }, data: { status: "DISMISSED" } });
  await db.agentPlan.create({
    data: {
      title: input.title,
      goal: input.goal,
      status: input.status ?? "PROPOSED",
      gap: input.gap ?? 0,
      rentAmount: input.rentAmount ?? 0,
      rentDate: input.rentDate ?? "",
      actions: { create: input.steps.map((s, i) => ({ type: s.type, familyId: s.familyId ?? null, title: s.title, detail: s.detail, reason: s.reason, payload: JSON.stringify(s.payload), step: i + 1 })) },
    },
  });
  refreshAll();
  return { ok: true, message: input.status === "ACTIVE" ? "Rent Defense Plan started" : "Plan sent to your approval inbox" };
}

/** Builds today's Rent Defense Plan and persists it as an ACTIVE AgentPlan whose steps each carry a family and an amount. */
export async function startRentPlan(): Promise<ActionResult> {
  const { loadDashboard } = await import("@/lib/board-view");
  const { buildRentPlan } = await import("@/lib/munshi/rules");
  const { board, forecast } = await loadDashboard();
  const plan = buildRentPlan({ families: board.families, forecast, bills: board.bills, today: board.today });
  if (!plan || !forecast.rent) return { ok: false, error: "No rent bill to defend. Add one in Settings." };
  return createPlanFromSteps({
    title: plan.title,
    goal: plan.goal,
    status: "ACTIVE",
    gap: plan.gap,
    rentAmount: forecast.rent.amount,
    rentDate: forecast.rent.date,
    steps: plan.steps.map((s) => ({ type: s.type, familyId: s.familyId, title: s.title, detail: s.detail, reason: s.reason, payload: { ...s.payload, amount: s.amount, billId: s.billId, collected: 0 } })),
  });
}

export async function dismissRentPlan(): Promise<ActionResult> {
  await db.agentPlan.updateMany({ where: { status: { in: ["PROPOSED", "ACTIVE", "DONE"] } }, data: { status: "DISMISSED" } });
  refreshAll();
  return { ok: true };
}

/* ---------- Paste & Match ---------- */
export async function matchUpiSmsAction(text: string) {
  if (!text.trim()) return { ok: false as const, error: "Paste the SMS first" };
  const { parseUpiSms, matchInvoices } = await import("@/lib/upi-sms");
  const today = todayIST();
  const parsed = parseUpiSms(text.slice(0, 600), today);
  const invoices = await db.invoice.findMany({ where: { status: { in: ["SENT", "PARTIAL"] } }, include: { payments: true, family: { include: { students: true } } } });
  const open = invoices
    .map((i) => ({ invoiceId: i.id, familyId: i.familyId, parent: i.family.parentName, kids: i.family.students.map((s) => s.name), balance: i.amount - sumPaid(i.payments), number: i.number, dueDate: toKey(i.dueDate) }))
    .filter((o) => o.balance > 0);
  const already = parsed.utr ? await db.payment.findFirst({ where: { reference: parsed.utr } }) : null;
  return { ok: true as const, parsed, matches: matchInvoices(parsed, open), duplicate: !!already, today: toKey(today) };
}

/* ---------- Voice Khata ---------- */
export async function voiceKhataAction(text: string) {
  const { parseKhata } = await import("@/lib/voice-khata");
  const note = parseKhata(text.slice(0, 300));
  if (!note.name) return { ok: false as const, error: "Say who paid, like \"Ravi paid 1500 cash\"" };
  const q = note.name.split(" ")[0];
  const families = await db.family.findMany({ include: { students: true, invoices: { where: { status: { not: "DRAFT" } }, include: { payments: true } } } });
  const fam = families.find((f) => f.parentName.toLowerCase().split(" ").some((w) => w.startsWith(q)) || f.students.some((s) => s.name.toLowerCase().split(" ")[0].startsWith(q)));
  if (!fam) return { ok: false as const, error: `No family or student called ${note.name}` };
  const balance = fam.invoices.reduce((s, i) => s + Math.max(0, i.amount - sumPaid(i.payments)), 0);
  return { ok: true as const, note, familyId: fam.id, parent: fam.parentName, balance, today: toKey(todayIST()) };
}

/* ---------- Fee Pause ---------- */
export async function setStudentPause(studentId: string, months: string[]): Promise<ActionResult> {
  const clean = [...new Set(months.filter((m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m)))].sort();
  const s = await db.student.update({ where: { id: studentId }, data: { pausedMonths: clean.join(",") } });
  await db.agentAction.create({ data: { type: "NOTE", familyId: s.familyId, title: clean.length ? `Fee paused for ${s.name}: ${clean.join(", ")}` : `Fee pause cleared for ${s.name}`, status: "DONE", source: "RULES" } });
  refreshAll();
  return { ok: true, message: clean.length ? `Paused for ${clean.length} month${clean.length > 1 ? "s" : ""}` : "Pause cleared" };
}
