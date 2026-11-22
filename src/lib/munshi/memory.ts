import type { PrismaClient } from "@prisma/client";
import { db } from "../db";
import { daysBetween, fromKey } from "../dates";
import { learnedDay, ordinal } from "./rules";

/**
 * Family memory that learns. Stored as Family.memory (JSON of short strings, shown on the
 * family page). Munshi rewrites the learned keys after payments, promises and replies, and keeps
 * anything the tutor or seed wrote (bestTime, tone, ...).
 */
export type Memory = Record<string, string>;

const read = (s: string): Memory => {
  try {
    const j = JSON.parse(s || "{}");
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
};

/** The day-of-month a family usually pays on, read back from memory ("usual pay day": "5th"). */
export function usualDayOf(mem: Memory): number | null {
  return learnedDay(mem);
}

async function save(familyId: string, update: (m: Memory) => Memory, client: PrismaClient = db) {
  const f = await client.family.findUnique({ where: { id: familyId }, select: { memory: true } });
  if (!f) return;
  const next = update(read(f.memory));
  await client.family.update({ where: { id: familyId }, data: { memory: JSON.stringify(next) } });
}

/** Recomputes usual pay day, usual method, lateness and promise habit from the family's history. */
export async function learnFromHistory(familyId: string, client: PrismaClient = db) {
  const [payments, invoices, promises] = await Promise.all([
    client.payment.findMany({ where: { invoice: { familyId } }, orderBy: { date: "asc" } }),
    client.invoice.findMany({ where: { familyId }, include: { payments: true } }),
    client.payPromise.findMany({ where: { familyId } }),
  ]);
  await save(familyId, (m) => {
    const out = { ...m };
    const recent = payments.slice(-4);
    if (recent.length >= 2) {
      const days = recent.map((p) => p.date.getUTCDate()).sort((a, b) => a - b);
      const median = days[Math.floor(days.length / 2)];
      const spread = days[days.length - 1] - days[0];
      if (spread <= 5) out.usualPayDay = ordinal(median);
      else delete out.usualPayDay;
      const upi = recent.filter((p) => p.mode === "UPI").length;
      out.usualMethod = upi * 2 > recent.length ? "UPI" : upi * 2 < recent.length ? "Cash" : "Cash or UPI";
    }
    const delays = invoices
      .filter((i) => i.payments.length && i.payments.reduce((s, p) => s + p.amount, 0) >= i.amount)
      .map((i) => Math.max(0, daysBetween(i.dueDate, i.payments.reduce((d, p) => (p.date > d ? p.date : d), i.payments[0].date))));
    if (delays.length >= 2) {
      const avg = Math.round(delays.reduce((a, b) => a + b, 0) / delays.length);
      out.lateness = avg <= 1 ? "Pays on time" : `Usually ${avg} days after the due date`;
    }
    const kept = promises.filter((p) => p.kept === true).length;
    const broken = promises.filter((p) => p.kept === false).length;
    if (kept + broken) out.promises = broken === 0 ? `Keeps promises (${kept} of ${kept})` : kept === 0 ? `Misses promise dates (${broken} broken)` : `${kept} kept, ${broken} broken`;
    return out;
  }, client);
}

/** Learns from a parent's reply read by the Reply Reader: salary-day payers, preferred method, a stated date. */
export async function learnFromReply(familyId: string, text: string, promisedDate: string | null) {
  const t = text.toLowerCase();
  await save(familyId, (m) => {
    const out = { ...m };
    if (/salary|jeetham|tankha|tankhwah|first week/.test(t) && promisedDate) {
      const day = fromKey(promisedDate).getUTCDate();
      if (day <= 28) out.salaryDay = `Pays after salary, around the ${ordinal(day)}`;
    }
    if (/gpay|phonepe|paytm|upi/.test(t)) out.usualMethod = "UPI";
    else if (/cash|nagadu|nakad/.test(t)) out.usualMethod = "Cash";
    if (promisedDate) out.lastReply = `"${text.slice(0, 60)}" → promised ${promisedDate}`;
    return out;
  });
}
