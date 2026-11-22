import { Landing } from "@/components/landing/Landing";
import { DEMO_LANDING, MAX_HOUSES, type LandingData } from "@/components/landing/landing-data";
import { houseStatusOf } from "@/components/ui/HouseStatus";
import { getSessionUser } from "@/lib/auth/session";
import { loadDashboard } from "@/lib/board-view";
import { dbHealth } from "@/lib/db-health";
import { db } from "@/lib/db";
import { formatDate, monthKey } from "@/lib/dates";
import { sumPaid } from "@/lib/invoice-status";
import { kidsLabel } from "@/lib/messages";

export const dynamic = "force-dynamic";

/**
 * Visitors see the illustrated demo lane (Lakshmi Teaching Point). A signed-in tutor sees their own
 * name and centre, and their own families on the lane once they have added some.
 */
async function landingData(): Promise<LandingData> {
  try {
    const health = await dbHealth();
    if (!health.ok) return DEMO_LANDING;
    const user = await getSessionUser();
    if (!user) return DEMO_LANDING;
    const viewer = { name: user.name || user.email.split("@")[0] };
    const settings = await db.settings.findFirst();
    const tutor = settings?.tutorName || viewer.name;
    const centre = settings?.centreName || DEMO_LANDING.centre;
    if (!settings || !(await db.family.count())) return { ...DEMO_LANDING, viewer, tutor, centre };

    const { board, forecast } = await loadDashboard();
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
    const r = forecast.rent;
    const promised = fams.find((f) => f.stats.openPromise && f.stats.balance > 0);
    const munshiNote = promised?.stats.openPromise
      ? `${promised.parentName.split(" ")[0]} promised ${formatDate(promised.stats.openPromise.promisedDate, { weekday: false, year: false })}. I'll remind them the day after.`
      : owed > 0
        ? "I'm watching who owes and when rent falls due."
        : "Everyone is paid up. Nothing to chase today.";
    const defense = fams
      .filter((f) => f.stats.balance > 0 && !f.stats.openPromise)
      .sort((a, b) => b.stats.balance - a.stats.balance)
      .slice(0, 3)
      .map((f) => f.id);
    return {
      source: "live",
      viewer,
      centre: board.settings.centreName,
      tutor: board.settings.tutorName,
      families,
      collected,
      owed,
      rent: r ? { name: r.name, amount: r.amount, dueDay: Number(r.date.slice(8, 10)), daysUntil: r.daysUntil, atRisk: r.risk >= 0.4 } : null,
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
