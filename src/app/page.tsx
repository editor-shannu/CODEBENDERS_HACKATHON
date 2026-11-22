import { Landing } from "@/components/landing/Landing";
import { DEMO_LANDING, MAX_HOUSES, type LandingData } from "@/components/landing/landing-data";
import { houseStatusOf } from "@/components/ui/HouseStatus";
import { loadBoard } from "@/lib/data";
import { dbHealth } from "@/lib/db-health";
import { formatDate, monthKey } from "@/lib/dates";
import { sumPaid } from "@/lib/invoice-status";
import { kidsLabel } from "@/lib/messages";

export const dynamic = "force-dynamic";

/** Reads the real lane (one house per family) from the existing board; falls back to a static demo lane. */
async function landingData(): Promise<LandingData> {
  try {
    const health = await dbHealth();
    if (!health.ok) return DEMO_LANDING;
    const board = await loadBoard();
    if (!board.families.length) return DEMO_LANDING;
    const month = monthKey(board.today);
    const fams = [...board.families]
      .sort((a, b) => b.stats.monthlyTotal - a.stats.monthlyTotal)
      .slice(0, MAX_HOUSES);
    const families = fams.map((f) => ({
      id: f.id,
      name: f.parentName,
      kids: kidsLabel(f.students.filter((s) => s.active).map((s) => s.name)),
      amount: f.stats.monthlyTotal,
      status: houseStatusOf(f.stats.balance, !!f.stats.openPromise),
    }));
    const thisMonth = board.families.flatMap((f) => f.invoices.filter((i) => i.month === month));
    const collected = thisMonth.reduce((s, i) => s + Math.min(i.amount, sumPaid(i.payments)), 0);
    const owed = board.totalPending;
    const rentBill = board.bills.find((b) => /rent/i.test(b.name)) ?? board.bills[0] ?? null;
    const promised = fams.find((f) => f.stats.openPromise && f.stats.balance > 0);
    const munshiNote = promised?.stats.openPromise
      ? `${promised.parentName.split(" ")[0]} promised ${formatDate(promised.stats.openPromise.promisedDate, { weekday: false, year: false })}. I'll remind them the day after.`
      : DEMO_LANDING.munshiNote;
    const defense = fams
      .filter((f) => f.stats.balance > 0 && !f.stats.openPromise)
      .sort((a, b) => b.stats.balance - a.stats.balance)
      .slice(0, 3)
      .map((f) => f.id);
    return {
      source: "live",
      centre: board.settings.centreName,
      tutor: board.settings.tutorName,
      families,
      collected,
      owed,
      rent: rentBill ? { name: rentBill.name, amount: rentBill.amount, dueDay: rentBill.dueDay } : null,
      munshiNote,
      defense,
    };
  } catch (e) {
    console.error("[baaki] landing falls back to demo lane:", e instanceof Error ? e.message : e);
    return DEMO_LANDING;
  }
}

export default async function LandingPage() {
  const data = await landingData();
  return <Landing data={data} />;
}
