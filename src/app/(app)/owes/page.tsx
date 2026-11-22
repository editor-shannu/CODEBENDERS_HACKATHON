import Link from "next/link";
import { Card, EmptyState, Eyebrow, PageHeader } from "@/components/ui/Card";
import { HouseStatus, houseStatusOf } from "@/components/ui/HouseStatus";
import { MoneyText } from "@/components/ui/MoneyText";
import { RemindButton } from "@/components/actions/RemindButton";
import { ChaseQueue, type QueueCard } from "@/components/owes/ChaseQueue";
import { loadDashboard } from "@/lib/board-view";
import { dbHealth } from "@/lib/db-health";
import { SetupNotice } from "@/components/setup/SetupNotice";
import { formatMonthShort, formatDate, toKey } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { memoryOf } from "@/lib/munshi/rules";
import { kidsLabel } from "@/lib/messages";

export const dynamic = "force-dynamic";

export default async function OwesPage() {
  const health = await dbHealth();
  if (!health.ok) return <SetupNotice health={health} />;
  const { board, payloads } = await loadDashboard();
  const owing = board.families.filter((f) => f.stats.balance > 0).sort((a, b) => b.stats.oldestDaysLate - a.stats.oldestDaysLate);
  const maxLate = Math.max(30, ...owing.map((f) => f.stats.oldestDaysLate));
  const cards: QueueCard[] = [...owing]
    .sort((a, b) => b.stats.chaseScore - a.stats.chaseScore)
    .map((f) => ({
      familyId: f.id,
      parent: f.parentName,
      kids: kidsLabel(f.students.map((s) => s.name)),
      amount: formatINR(f.stats.balance),
      days: f.stats.oldestDaysLate,
      tone: f.stats.suggestedTone,
      promise: f.stats.promisesBroken ? `${f.stats.promisesBroken} broken promise${f.stats.promisesBroken > 1 ? "s" : ""}` : f.stats.openPromise ? `promised ${formatDate(f.stats.openPromise.promisedDate, { year: false })}` : `promise score ${Math.round(f.stats.promiseScore * 100)}%`,
      chaseScore: f.stats.chaseScore,
      bestTime: memoryOf(f).bestTime,
      payload: payloads[f.id],
      status: houseStatusOf(f.stats.balance, !!f.stats.openPromise),
      balance: f.stats.balance,
    }));

  return (
    <div>
      <PageHeader title="Who owes" kicker="Baaki board" />
      <div className="mb-8 flex flex-wrap items-end gap-x-6 gap-y-2">
        <p className="big-number text-[72px] md:text-[104px]">{formatINR(board.totalPending)}</p>
        <p className="pb-3 font-mono text-sm text-plaster/70">
          pending from {owing.length} families · <span className="text-brick">{formatINR(board.overdueTotal)} overdue</span>
        </p>
      </div>

      {owing.length === 0 ? (
        <EmptyState title="Nobody owes you anything." body="Every invoice is paid. Enjoy the quiet." />
      ) : (
        <div className="grid gap-8 md:grid-cols-[1fr_1.3fr]">
          <section>
            <Eyebrow className="mb-3">Chase queue · ranked by who to chase first</Eyebrow>
            <ChaseQueue cards={cards} today={toKey(board.today)} />
          </section>
          <section>
            <Eyebrow className="mb-3">Oldest first</Eyebrow>
            <ul className="space-y-2">
              {owing.map((f) => (
                <li key={f.id}>
                  <Card className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/families/${f.id}`} className="flex min-w-0 items-center gap-3">
                        <HouseStatus status={houseStatusOf(f.stats.balance, !!f.stats.openPromise)} size={32} />
                        <span className="min-w-0">
                        <p className="truncate font-semibold">{f.parentName}</p>
                        <p className="truncate text-sm text-dusk-deep/60">
                          {kidsLabel(f.students.map((s) => s.name))} · {[...new Set(f.stats.unpaid.map((i) => formatMonthShort(i.month)))].join(", ")}
                        </p>
                        </span>
                      </Link>
                      <div className="text-right">
                        <MoneyText amount={f.stats.balance} className="text-xl font-semibold" />
                        <p className="font-mono text-xs text-brick">{f.stats.oldestDaysLate ? `${f.stats.oldestDaysLate} days late` : "not yet due"}</p>
                      </div>
                    </div>
                    <div className="mt-2 h-2 w-full bg-dusk-deep/5">
                      <div className="late-bar h-2" style={{ width: `${Math.max(4, (f.stats.oldestDaysLate / maxLate) * 100)}%` }} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="font-mono text-[11px] text-dusk-deep/60">
                        Promises {f.stats.promisesKept} kept · {f.stats.promisesBroken} broken
                        {f.stats.lastReminder ? ` · reminded ${formatDate(f.stats.lastReminder, { weekday: false, year: false })}` : ""}
                      </p>
                      <RemindButton p={payloads[f.id]} variant="plaster" className="min-h-9 px-3" />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
