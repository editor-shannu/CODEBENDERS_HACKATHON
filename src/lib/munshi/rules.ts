import { addDays, daysBetween, formatDate, fromKey } from "../dates";
import type { FamilyWithStats } from "../data";
import type { ForecastResult } from "../forecast";
import { paydayPattern } from "../family-stats";
import { formatINR } from "../money";

export type BriefItem = {
  key: string;
  type: "REMIND" | "FOLLOW_UP" | "PLAN" | "DUE_DATE" | "CONFIRM";
  familyId?: string;
  title: string;
  detail: string;
  reason: string;
  priority: number;
  payload?: Record<string, unknown>;
};

export function memoryOf(f: { memory: string }): Record<string, string> {
  try {
    return JSON.parse(f.memory || "{}");
  } catch {
    return {};
  }
}

const toneWord = (t: string) => t.toLowerCase();

export function buildBrief(opts: { families: FamilyWithStats[]; today: Date; forecast: ForecastResult; pendingClaims: number }): BriefItem[] {
  const { families, today, forecast } = opts;
  const items: BriefItem[] = [];

  if (opts.pendingClaims > 0)
    items.push({
      key: "claims",
      type: "CONFIRM",
      title: `Confirm ${opts.pendingClaims} UPI payment${opts.pendingClaims > 1 ? "s" : ""} parents reported`,
      detail: "Check your bank app, then confirm with one tap.",
      reason: "Parents used their pay link and entered a UPI reference.",
      priority: 100,
    });

  if (forecast.rent && forecast.rent.risk >= 0.4)
    items.push({
      key: "rent",
      type: "PLAN",
      title: `Rent at risk: ${Math.round(forecast.rent.risk * 100)}% chance you're short on ${formatDate(fromKey(forecast.rent.date), { year: false })}`,
      detail: `${formatINR(forecast.rent.amount)} rent is due in ${forecast.rent.daysUntil} days. I can build a Rent Defense Plan.`,
      reason: `In ${Math.round(forecast.rent.risk * 500)} of 500 simulated futures, your balance on rent day is below zero, based on how late each family usually pays.`,
      priority: 90,
    });

  for (const f of families) {
    const p = f.stats.openPromise;
    if (!p || f.stats.balance <= 0) continue;
    const d = daysBetween(today, p.promisedDate);
    if (d < 0 || d > 2) continue;
    const mem = memoryOf(f);
    items.push({
      key: `promise-${f.id}`,
      type: "FOLLOW_UP",
      familyId: f.id,
      title: `${f.parentName} promised ${formatINR(p.amount)} ${d === 0 ? "today" : d === 1 ? "tomorrow" : `on ${formatDate(p.promisedDate, { year: false })}`}`,
      detail: `Send a gentle thank-you nudge${mem.bestTime ? `, ${mem.bestTime.toLowerCase()}` : ""}.`,
      reason: `Promise score ${Math.round(f.stats.promiseScore * 100)}%. A friendly nudge on the day keeps the promise top of mind.`,
      priority: 70 - d,
      payload: { tone: "GENTLE" },
    });
  }

  const chase = families
    .filter((f) => f.stats.balance > 0 && f.stats.oldestDaysLate > 0)
    .filter((f) => !f.stats.lastReminder || daysBetween(f.stats.lastReminder, today) >= 2)
    .sort((a, b) => b.stats.chaseScore - a.stats.chaseScore);
  chase.slice(0, 3).forEach((f, idx) => {
    const mem = memoryOf(f);
    const s = f.stats;
    const why: string[] = [];
    if (s.promisesBroken >= 2) why.push(`${s.promisesBroken} broken promises, so a final reminder`);
    else if (s.oldestDaysLate >= 15) why.push(`${s.oldestDaysLate} days late, so a firm tone`);
    else why.push("still early, so a gentle tone");
    if (s.delays.length) why.push(`usually pays ${Math.round(s.avgDelay)} days after the due date`);
    if (mem.tone) why.push(mem.tone.toLowerCase());
    items.push({
      key: `chase-${f.id}`,
      type: "REMIND",
      familyId: f.id,
      title: `Chase ${f.parentName}: ${formatINR(s.balance)}, ${s.oldestDaysLate} days late`,
      detail: `${toneWord(s.suggestedTone)[0].toUpperCase() + toneWord(s.suggestedTone).slice(1)} reminder in ${f.language === "te" ? "Telugu" : f.language === "hi" ? "Hindi" : "English"}${mem.bestTime ? `. Best time: ${mem.bestTime.toLowerCase()}` : ""}.`,
      reason: `Chase score ${s.chaseScore}: ${why.join("; ")}.`,
      priority: 60 - idx * 5,
      payload: { tone: s.suggestedTone },
    });
  });

  for (const f of families) {
    const active = f.students.filter((s) => s.active);
    if (!active.length) continue;
    const day = paydayPattern(f.stats.payDays, active[0].dueDay);
    if (!day) continue;
    items.push({
      key: `payday-${f.id}`,
      type: "DUE_DATE",
      familyId: f.id,
      title: `Move ${f.parentName.split(" ")[0]}'s due date from the ${ordinal(active[0].dueDay)} to the ${ordinal(day)}`,
      detail: `They pay on the ${ordinal(day)} almost every month.`,
      reason: `Last ${Math.min(4, f.stats.payDays.length)} payments landed on the ${f.stats.payDays.slice(-4).map(ordinal).join(", ")}. Matching their payday stops them showing as late and saves you a reminder.`,
      priority: 40,
      payload: { dueDay: day },
    });
  }

  return items.sort((a, b) => b.priority - a.priority);
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export type PlanStep = { type: "REMIND" | "DISCOUNT" | "DEFER_BILL"; familyId?: string; billId?: string; title: string; detail: string; reason: string; payload: Record<string, unknown> };

export function buildRentPlan(opts: {
  families: FamilyWithStats[];
  forecast: ForecastResult;
  bills: { id: string; name: string; amount: number; dueDay: number; flexible: boolean; deferDays: number }[];
  today: Date;
}): { title: string; goal: string; gap: number; steps: PlanStep[] } | null {
  const { forecast, families, today } = opts;
  if (!forecast.rent) return null;
  const rentDay = forecast.rent.daysUntil;
  const before = forecast.points[Math.max(0, rentDay - 1)];
  const gap = Math.max(1000, Math.round((forecast.rent.amount - before.p50 + forecast.rent.amount * 0.15) / 100) * 100);
  const rentDate = fromKey(forecast.rent.date);
  const steps: PlanStep[] = [];

  const owing = families
    .filter((f) => f.stats.balance > 0)
    .map((f) => ({ f, likely: (forecast.payBeforeRent[f.id] ?? 0) * 0.5 + f.stats.promiseScore * 0.5 }))
    .sort((a, b) => b.likely * b.f.stats.balance - a.likely * a.f.stats.balance);
  for (const { f, likely } of owing.slice(0, 3)) {
    steps.push({
      type: "REMIND",
      familyId: f.id,
      title: `Chase ${f.parentName} for ${formatINR(f.stats.balance)}`,
      detail: `${f.stats.suggestedTone[0] + f.stats.suggestedTone.slice(1).toLowerCase()} reminder with pay link`,
      reason: `${Math.round(likely * 100)}% likely to pay before rent day if reminded now.`,
      payload: { tone: f.stats.suggestedTone },
    });
  }

  const reliable = families
    .filter((f) => f.stats.balance === 0 && f.students.some((s) => s.active) && f.stats.delays.length >= 2 && f.stats.avgDelay <= 1)
    .sort((a, b) => b.stats.monthlyTotal - a.stats.monthlyTotal)
    .slice(0, 2);
  for (const f of reliable) {
    steps.push({
      type: "DISCOUNT",
      familyId: f.id,
      title: `Offer ${f.parentName.split(" ")[0]} ₹100 off to pay next month's ${formatINR(f.stats.monthlyTotal)} early`,
      detail: `Pay by ${formatDate(addDays(rentDate, -2), { year: false })}`,
      reason: `Pays on time every month (${f.stats.delays.length} of ${f.stats.delays.length}), so an early-pay offer is likely to land before rent.`,
      payload: { discount: 100, by: addDays(rentDate, -2).toISOString().slice(0, 10) },
    });
  }

  const flex = opts.bills
    .filter((b) => b.flexible)
    .map((b) => ({ b, d: daysBetween(today, nextDue(today, b.dueDay)) }))
    .filter(({ d }) => d >= 0 && d <= rentDay + 3)
    .sort((a, b) => b.b.amount - a.b.amount)[0];
  if (flex)
    steps.push({
      type: "DEFER_BILL",
      billId: flex.b.id,
      title: `Push "${flex.b.name}" (${formatINR(flex.b.amount)}) by a week`,
      detail: "Ask the vendor for 7 more days",
      reason: "It's marked flexible and falls just before rent.",
      payload: { days: 7 },
    });

  return {
    title: `Rent Defense: cover ${formatINR(forecast.rent.amount)} by ${formatDate(rentDate, { year: false })}`,
    goal: `Close a likely gap of about ${formatINR(gap)} before rent day.`,
    gap,
    steps,
  };
}

function nextDue(today: Date, day: number) {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), day));
  return d >= today ? d : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, day));
}
