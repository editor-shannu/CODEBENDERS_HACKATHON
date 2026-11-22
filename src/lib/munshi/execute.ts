import "server-only";
import { db } from "../db";
import { fromKey, monthKey, todayIST, toKey } from "../dates";
import { sumPaid } from "../invoice-status";
import { createInvoiceFor, recalcInvoice } from "../invoices";
import { settlePlanForPayment } from "./plan";
import { learnFromHistory } from "./memory";

/**
 * Munshi's write actions. Every write tool lands here, either straight away (low-risk work the
 * autonomy dial allows) or when the tutor approves it in the inbox.
 */
export type WriteType = "REMIND" | "NUDGE" | "PROMISE" | "PAYMENT" | "DUE_DATE" | "INVOICE" | "FLAG";

/** Low-risk actions AUTO may run on its own. Money actions always wait for approval. */
export const LOW_RISK: WriteType[] = ["REMIND", "NUDGE", "PROMISE", "FLAG"];
export const MONEY: WriteType[] = ["PAYMENT", "INVOICE", "DUE_DATE"];

export function canAutoRun(type: string, autonomy: string, payload: Record<string, unknown> = {}): boolean {
  // Money actions always wait for the tutor, whatever the dial says.
  if (MONEY.includes(type as WriteType)) return false;
  // SUGGEST and ASK: everything goes to the approval inbox.
  if (autonomy !== "AUTO") return false;
  if (type === "REMIND") return (payload.tone ?? "GENTLE") === "GENTLE";
  return LOW_RISK.includes(type as WriteType);
}

const parse = (s: string): Record<string, unknown> => {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
};

/** Performs the effect of one action. Returns a short line for the log. */
export async function performAction(type: string, familyId: string | null, payload: Record<string, unknown>): Promise<string> {
  switch (type) {
    case "REMIND":
      // drafts are never sent by Munshi: the tutor opens WhatsApp from the brief or queue
      return "Reminder draft ready to send";
    case "NUDGE": {
      if (!familyId) return "No family";
      const day = typeof payload.date === "string" ? fromKey(payload.date) : todayIST();
      await db.reminder.create({ data: { familyId, tone: String(payload.tone ?? "GENTLE"), language: String(payload.language ?? "te"), status: "SCHEDULED", scheduledFor: day, note: String(payload.note ?? "") } });
      return `Nudge scheduled for ${toKey(day)}`;
    }
    case "PROMISE": {
      if (!familyId || typeof payload.date !== "string") return "No date";
      await db.payPromise.create({ data: { familyId, promisedDate: fromKey(payload.date), amount: Math.round(Number(payload.amount ?? 0)), note: String(payload.note ?? ""), source: "MUNSHI" } });
      return `Promise recorded for ${payload.date}`;
    }
    case "PAYMENT": {
      if (!familyId) return "No family";
      let left = Math.round(Number(payload.amount ?? 0));
      const invoices = await db.invoice.findMany({ where: { familyId, status: { not: "DRAFT" } }, include: { payments: true }, orderBy: { dueDate: "asc" } });
      for (const inv of invoices) {
        const bal = inv.amount - sumPaid(inv.payments);
        if (bal <= 0 || left <= 0) continue;
        const part = Math.min(bal, left);
        await db.payment.create({ data: { invoiceId: inv.id, amount: part, mode: String(payload.mode ?? "CASH") === "UPI" ? "UPI" : "CASH", date: todayIST(), reference: null } });
        await recalcInvoice(inv.id);
        left -= part;
      }
      const paid = Math.round(Number(payload.amount ?? 0)) - left;
      await settlePlanForPayment(familyId, paid);
      await learnFromHistory(familyId);
      return `Payment of ${paid} recorded`;
    }
    case "DUE_DATE": {
      const dueDay = Number(payload.dueDay);
      if (!familyId || !(dueDay >= 1 && dueDay <= 28)) return "Bad due day";
      await db.student.updateMany({ where: { familyId, active: true }, data: { dueDay } });
      return `Due date moved to day ${dueDay}`;
    }
    case "INVOICE": {
      if (!familyId) return "No family";
      const inv = await createInvoiceFor(familyId, String(payload.month ?? monthKey(todayIST())), "DRAFT");
      return inv ? `Draft invoice ${inv.number} created` : "Invoice already exists for that month";
    }
    case "FLAG":
      return "Flagged";
    default:
      return "Nothing to do";
  }
}

/** Creates the AgentAction for a write tool: runs it now if the dial allows, else leaves it PENDING for approval. */
export async function proposeOrRun(input: { type: WriteType; familyId: string | null; title: string; detail?: string; reason?: string; payload: Record<string, unknown>; autonomy: string; source: "AI" | "RULES" }) {
  const auto = canAutoRun(input.type, input.autonomy, input.payload);
  const result = auto ? await performAction(input.type, input.familyId, input.payload) : null;
  const action = await db.agentAction.create({
    data: {
      type: input.type,
      familyId: input.familyId,
      title: input.title,
      detail: input.detail ?? "",
      reason: input.reason ?? "",
      payload: JSON.stringify(input.payload),
      status: auto ? "DONE" : "PENDING",
      source: input.source,
    },
  });
  return { id: action.id, status: auto ? ("DONE" as const) : ("PENDING" as const), result };
}

/** Approving an inbox action carries it out (money actions included, since the tutor approved them). */
export async function approveAction(id: string) {
  const a = await db.agentAction.findUnique({ where: { id } });
  if (!a || a.status !== "PENDING") return null;
  const line = await performAction(a.type, a.familyId, parse(a.payload));
  await db.agentAction.update({ where: { id }, data: { status: "DONE", detail: a.detail ? `${a.detail} · ${line}` : line } });
  return line;
}

export const AUTONOMY_LABEL: Record<string, string> = {
  SUGGEST: "Suggest: Munshi only suggests, everything waits in your inbox",
  ASK: "Ask: Munshi drafts, you approve every action",
  AUTO: "Auto: gentle reminder drafts, nudges and promises run on their own; money actions still wait for you",
};

/** In AUTO, gentle brief reminders are drafted and logged on their own, once a day per family. */
export async function autoRunBrief(items: { key: string; type: string; familyId?: string; title: string; detail: string; reason: string; payload?: Record<string, unknown> }[], today: Date) {
  const done = await db.agentAction.findMany({ where: { createdAt: { gte: today }, reason: { startsWith: "brief:" } }, select: { reason: true } });
  const seen = new Set(done.map((a) => a.reason.split(" ")[0]));
  let n = 0;
  for (const item of items) {
    if ((item.type !== "REMIND" && item.type !== "FOLLOW_UP") || (item.payload?.tone ?? "GENTLE") !== "GENTLE") continue;
    const tag = `brief:${item.key}`;
    if (seen.has(tag)) continue;
    await db.agentAction.create({ data: { type: item.type, familyId: item.familyId ?? null, title: `Auto-drafted: ${item.title}`, detail: item.detail, reason: `${tag} ${item.reason}`, payload: JSON.stringify(item.payload ?? {}), status: "APPROVED", source: "RULES" } });
    n++;
  }
  return n;
}
