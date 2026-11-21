import "server-only";
import { db } from "./db";
import { todayIST, toKey } from "./dates";
import { familyStats, type FamilyLite, type FamilyStats } from "./family-stats";
import type { ForecastInput } from "./forecast";
import { balanceOf } from "./invoice-status";
import { formatDate, formatMonthShort, addDays } from "./dates";
import { formatINR } from "./money";
import { kidsLabel } from "./messages";

export async function getSettings() {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  return (
    s ?? {
      id: 1,
      tutorName: "Lakshmi Devi",
      centreName: "Lakshmi Teaching Point",
      city: "Vizianagaram",
      upiId: "lakshmi.tuition@okaxis",
      upiName: "Lakshmi Teaching Point",
      startingBalance: 0,
      autonomy: "ASK",
    }
  );
}

export async function loadFamilies(): Promise<FamilyLite[]> {
  return db.family.findMany({
    include: {
      students: { orderBy: { name: "asc" } },
      invoices: { include: { payments: { orderBy: { date: "asc" } } }, orderBy: { dueDate: "asc" } },
      promises: { orderBy: { promisedDate: "asc" } },
      reminders: { orderBy: { sentAt: "desc" } },
    },
    orderBy: { parentName: "asc" },
  });
}

export type FamilyWithStats = FamilyLite & { stats: FamilyStats };

/** Promises whose date has passed while money is still due become "broken" (live, from today's date). */
async function settlePromises(today: Date) {
  const open = await db.payPromise.findMany({ where: { kept: null, promisedDate: { lt: today } } });
  if (!open.length) return;
  for (const p of open) await db.payPromise.update({ where: { id: p.id }, data: { kept: false } });
}

export async function loadBoard() {
  const today = todayIST();
  await settlePromises(today);
  const [families, settings, bills, keyDates] = await Promise.all([
    loadFamilies(),
    getSettings(),
    db.bill.findMany({ orderBy: { dueDay: "asc" } }),
    db.keyDate.findMany({ orderBy: { startDate: "asc" } }),
  ]);
  const withStats: FamilyWithStats[] = families.map((f) => ({ ...f, stats: familyStats(f, today) }));
  const totalPending = withStats.reduce((s, f) => s + f.stats.balance, 0);
  const overdueTotal = withStats.reduce(
    (s, f) => s + f.stats.unpaid.filter((i) => i.dueDate < today).reduce((a, i) => a + balanceOf(i), 0),
    0,
  );
  return { today, families: withStats, settings, bills, keyDates, totalPending, overdueTotal };
}

export function buildForecastInput(board: Awaited<ReturnType<typeof loadBoard>>): ForecastInput {
  return {
    today: toKey(board.today),
    startingBalance: board.settings.startingBalance,
    families: board.families
      .filter((f) => f.students.some((s) => s.active) || f.stats.balance > 0)
      .map((f) => {
        const active = f.students.filter((s) => s.active);
        return {
          id: f.id,
          name: f.parentName,
          monthlyTotal: f.stats.monthlyTotal,
          dueDay: active[0]?.dueDay ?? f.students[0]?.dueDay ?? 10,
          studentCount: active.length,
          delays: f.stats.delays,
          avgDelay: f.stats.avgDelay,
          promiseScore: f.stats.promiseScore,
          openPromise: f.stats.openPromise
            ? { date: toKey(f.stats.openPromise.promisedDate), amount: f.stats.openPromise.amount }
            : null,
          unpaid: f.stats.unpaid.map((i) => ({ amount: balanceOf(i), dueDate: toKey(i.dueDate) })),
        };
      }),
    bills: board.bills.map((b) => ({ name: b.name, amount: b.amount, dueDay: b.dueDay, deferDays: b.deferDays })),
    keyDates: board.keyDates.map((k) => ({ name: k.name, start: toKey(k.startDate), end: toKey(k.endDate), factor: k.collectionFactor })),
  };
}

export type ReminderPayload = {
  familyId: string;
  phone: string;
  language: string;
  parent: string;
  kids: string;
  amount: string;
  months: string;
  days: number;
  by: string;
  token: string | null;
  suggestedTone: "GENTLE" | "FIRM" | "FINAL";
  centre: string;
  tutor: string;
};

export function reminderPayload(f: FamilyWithStats, settings: { centreName: string; tutorName: string }, today: Date): ReminderPayload {
  const months = [...new Set(f.stats.unpaid.map((i) => formatMonthShort(i.month)))];
  const monthsLabel = months.length > 1 ? `${months.slice(0, -1).join(", ")} & ${months[months.length - 1]}` : months[0] ?? "";
  const kids = kidsLabel(f.students.map((s) => s.name));
  return {
    familyId: f.id,
    phone: f.phone,
    language: f.language,
    parent: f.parentName.split(" ")[0],
    kids,
    amount: formatINR(f.stats.balance),
    months: monthsLabel,
    days: f.stats.oldestDaysLate,
    by: formatDate(addDays(today, 3), { weekday: false, year: false }),
    token: f.stats.unpaid[0]?.payToken ?? null,
    suggestedTone: f.stats.suggestedTone,
    centre: settings.centreName,
    tutor: settings.tutorName,
  };
}
