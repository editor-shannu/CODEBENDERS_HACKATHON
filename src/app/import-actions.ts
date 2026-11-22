"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { fromKey, monthKey, todayIST, toKey, addMonths, monthStart } from "@/lib/dates";
import { sumPaid } from "@/lib/invoice-status";
import { createInvoiceFor, recalcInvoice } from "@/lib/invoices";
import { learnFromHistory } from "@/lib/munshi/memory";
import { chat, llmEnabled, parseReplyRules } from "@/lib/munshi/agent";
import { suggestedFee } from "@/lib/join";
import { buildCandidates, guessTutor, parseChat, type ImportCandidate } from "@/lib/whatsapp-import";

export type AnalyzeResult =
  | { ok: true; senders: { name: string; count: number }[]; tutor: string | null; candidates: (ImportCandidate & { fees: number[] })[]; ai: boolean; range: { from: string; to: string } }
  | { ok: false; error: string };

/** Reads a WhatsApp export and proposes families. Nothing is saved until the tutor confirms. */
export async function analyzeChatAction(text: string, tutorOverride?: string): Promise<AnalyzeResult> {
  if (typeof text !== "string" || text.length < 20) return { ok: false, error: "Paste the exported chat, or pick the .txt file WhatsApp made" };
  if (text.length > 3_000_000) return { ok: false, error: "That chat is too big. Export a shorter range or without media." };
  const messages = parseChat(text);
  if (messages.length < 2) return { ok: false, error: "That doesn't look like a WhatsApp export. In WhatsApp: open the group → ⋮ → More → Export chat → Without media." };
  const counts = new Map<string, number>();
  for (const m of messages) counts.set(m.sender, (counts.get(m.sender) ?? 0) + 1);
  const senders = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  const tutor = tutorOverride && counts.has(tutorOverride) ? tutorOverride : guessTutor(messages);
  let candidates = buildCandidates(messages, tutor);
  let ai = false;

  // Munshi fills in the children and classes the rules missed (only from what the parents wrote)
  if (llmEnabled() && candidates.length) {
    try {
      const sample = candidates.slice(0, 40).map((c) => ({
        sender: c.sender,
        messages: messages.filter((m) => m.sender === c.sender).slice(-12).map((m) => m.text.slice(0, 200)),
        tutorMentions: messages.filter((m) => m.sender === tutor && m.text.toLowerCase().includes(c.parentName.split(" ")[0].toLowerCase())).slice(-3).map((m) => m.text.slice(0, 200)),
      }));
      const msg = await chat(
        [
          {
            role: "system",
            content:
              'You read an Indian home tutor\'s parents WhatsApp group (English, Telugu, Hindi, Tenglish, Hinglish). For each sender, list the children they are parent of and each child\'s class, ONLY if the messages say it. Never invent names. Return JSON {"families":[{"sender":"...","kids":[{"name":"First name as written","class":"Class 8" or ""}]}]}.',
          },
          { role: "user", content: JSON.stringify(sample) },
        ],
        undefined,
        true,
      );
      const j = JSON.parse(msg.content ?? "{}") as { families?: { sender: string; kids?: { name?: string; class?: string }[] }[] };
      const bySender = new Map((j.families ?? []).map((f) => [f.sender, f.kids ?? []]));
      candidates = candidates.map((c) => {
        const kids = (bySender.get(c.sender) ?? []).filter((k) => k.name && k.name.length >= 2 && k.name.length <= 40).slice(0, 4);
        if (!kids.length) return c;
        // keep only names that actually appear in the chat
        const all = messages.map((m) => m.text).join("\n").toLowerCase();
        const real = kids.filter((k) => all.includes(String(k.name).split(" ")[0].toLowerCase()));
        if (!real.length) return c;
        return { ...c, kids: real.map((k) => ({ name: String(k.name), batch: String(k.class ?? "") || c.kids[0]?.batch || "" })) };
      });
      ai = true;
    } catch (e) {
      console.warn("[baaki] chat import AI step skipped:", e instanceof Error ? e.message : e);
    }
  }

  const students = await db.student.findMany({ select: { batch: true, monthlyFee: true, active: true } });
  const withFees = candidates.map((c) => {
    const lastPay = c.payments[c.payments.length - 1]?.amount;
    const split = lastPay && c.kids.length ? Math.round(lastPay / c.kids.length) : null;
    return { ...c, fees: c.kids.map((k) => split ?? suggestedFee(k.batch, students)) };
  });
  return { ok: true, senders, tutor, candidates: withFees, ai, range: { from: toKey(messages[0].at), to: toKey(messages[messages.length - 1].at) } };
}

const rowSchema = z.object({
  parentName: z.string().trim().min(2).max(60),
  language: z.enum(["te", "en", "hi"]).default("te"),
  dueDay: z.coerce.number().int().min(1).max(28),
  kids: z.array(z.object({ name: z.string().trim().min(2, "Every child needs a name").max(60), batch: z.string().trim().max(40).default(""), fee: z.coerce.number().int().min(100).max(50000) })).min(1).max(4),
  payments: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amount: z.coerce.number().int().min(1).max(200000) })).max(40).default([]),
  promiseText: z.string().max(300).nullable().default(null),
  promiseAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
});

/** Saves the confirmed families: students, last 3 months of reported payments (with invoices), and open promises. */
export async function importChatAction(rows: unknown[]): Promise<{ ok: true; families: number; students: number; payments: number; promises: number } | { ok: false; error: string }> {
  if (!Array.isArray(rows) || !rows.length) return { ok: false, error: "Pick at least one family" };
  if (rows.length > 150) return { ok: false, error: "Import at most 150 families at a time" };
  const parsed = rows.map((r) => rowSchema.safeParse(r));
  const bad = parsed.findIndex((p) => !p.success);
  if (bad >= 0) {
    const p = parsed[bad];
    return { ok: false, error: `Row ${bad + 1}: ${!p.success ? p.error.issues[0]?.message : ""}` };
  }
  const today = todayIST();
  const oldest = monthKey(addMonths(monthStart(today), -2));
  const thisMonth = monthKey(today);
  let families = 0, students = 0, payments = 0, promises = 0;

  for (const p of parsed) {
    if (!p.success) continue;
    const r = p.data;
    let fam = await db.family.findFirst({ where: { parentName: { equals: r.parentName, mode: "insensitive" } }, include: { students: true } });
    if (!fam) {
      fam = await db.family.create({ data: { parentName: r.parentName, language: r.language, notes: "Imported from WhatsApp" }, include: { students: true } });
      families++;
    }
    for (const k of r.kids) {
      if (fam.students.some((s) => s.name.toLowerCase() === k.name.toLowerCase())) continue;
      await db.student.create({ data: { familyId: fam.id, name: k.name, batch: k.batch || "General", monthlyFee: k.fee, dueDay: r.dueDay } });
      students++;
    }
    // reported payments in the last three months: one invoice per month, payment recorded on the day they wrote
    const byMonth = new Map<string, { date: string; amount: number }[]>();
    for (const pay of r.payments) {
      const m = pay.date.slice(0, 7);
      if (m < oldest || m > thisMonth || pay.date > toKey(today)) continue;
      byMonth.set(m, [...(byMonth.get(m) ?? []), pay]);
    }
    for (const [month, pays] of byMonth) {
      const inv = (await createInvoiceFor(fam.id, month, "SENT")) ?? (await db.invoice.findFirst({ where: { familyId: fam.id, month } }));
      if (!inv || inv.status === "DRAFT") continue;
      const withPays = await db.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: { payments: true } });
      let left = withPays.amount - sumPaid(withPays.payments);
      for (const pay of pays) {
        if (left <= 0) break;
        const amt = Math.min(left, pay.amount);
        await db.payment.create({ data: { invoiceId: inv.id, amount: amt, date: fromKey(pay.date), mode: "UPI", reference: "WhatsApp" } });
        left -= amt;
        payments++;
      }
      await recalcInvoice(inv.id);
    }
    // a promise still in the future becomes a tracked promise on this month's fee
    if (r.promiseText && r.promiseAt) {
      const inv = (await createInvoiceFor(fam.id, thisMonth, "SENT")) ?? (await db.invoice.findFirst({ where: { familyId: fam.id, month: thisMonth }, include: { payments: true } }));
      if (inv && inv.status !== "DRAFT") {
        const full = await db.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: { payments: true } });
        const bal = full.amount - sumPaid(full.payments);
        const read = parseReplyRules(r.promiseText, fromKey(r.promiseAt), bal);
        if (bal > 0 && read.promisedDate && read.promisedDate >= toKey(today)) {
          await db.payPromise.create({ data: { familyId: fam.id, promisedDate: fromKey(read.promisedDate), amount: Math.min(bal, read.amount ?? bal), note: `WhatsApp: “${r.promiseText.slice(0, 120)}”`, source: "MUNSHI" } });
          promises++;
        }
      }
    }
    await learnFromHistory(fam.id).catch(() => {});
  }
  revalidatePath("/", "layout");
  return { ok: true, families, students, payments, promises };
}
