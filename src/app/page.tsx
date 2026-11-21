import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { ConeChart } from "@/components/forecast/ConeChart";
import { WeatherStrip } from "@/components/forecast/Weather";
import { RemindButton } from "@/components/actions/RemindButton";
import { BriefActions } from "@/components/munshi/BriefActions";
import { loadDashboard } from "@/lib/board-view";
import { dbHealth } from "@/lib/db-health";
import { SetupNotice } from "@/components/setup/SetupNotice";
import { formatDate, fromKey, daysBetween, toKey } from "@/lib/dates";
import { formatINR } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const health = await dbHealth();
  if (!health.ok) return <SetupNotice health={health} />;
  const { board, forecast, brief, payloads, pendingClaims } = await loadDashboard();
  const { families, today, totalPending, overdueTotal, settings } = board;
  const owing = families.filter((f) => f.stats.balance > 0);
  const chase = [...owing].sort((a, b) => b.stats.chaseScore - a.stats.chaseScore).slice(0, 3);
  const promises = families
    .filter((f) => f.stats.openPromise)
    .map((f) => ({ f, p: f.stats.openPromise! }))
    .sort((a, b) => +a.p.promisedDate - +b.p.promisedDate);
  const rent = forecast.rent;
  const risky = rent && rent.risk >= 0.4;
  const critical = rent && rent.risk >= 0.7;

  return (
    <div>
      <div className="mb-5">
        <Eyebrow className="text-turmeric opacity-100">Namaskaram, {settings.tutorName.split(" ")[0]} garu</Eyebrow>
        <h1 className="font-display text-4xl leading-none md:text-5xl">Here&apos;s your back office today.</h1>
      </div>

      <div className="grid-bento">
        {/* Total pending */}
        <Link href="/owes" className="col-span-2 row-span-2 block">
          <Card variant="ink" className="flex h-full min-h-56 flex-col justify-between border-ledger/25 p-5 hover:border-turmeric">
            <Eyebrow>Baaki · pending fees</Eyebrow>
            <div>
              <p className="big-number text-[64px] text-ledger md:text-[88px]">{formatINR(totalPending)}</p>
              <p className="mt-3 font-mono text-sm text-ledger/70">
                <span className="text-khata">{formatINR(overdueTotal)} overdue</span> across {owing.length} families
              </p>
            </div>
            <p className="font-mono text-xs uppercase tracking-widest text-turmeric">Who owes →</p>
          </Card>
        </Link>

        {/* Runway clock */}
        <Link href="/forecast" className="col-span-2 block">
          <Card variant={critical ? "khata" : risky ? "turmeric" : "ledger"} ruled={false} className="h-full p-5">
            <Eyebrow>Runway clock</Eyebrow>
            {rent ? (
              risky ? (
                <>
                  <p className="big-number mt-2 text-5xl">{Math.round(rent.risk * 100)}%</p>
                  <p className="mt-1 font-display text-xl">chance you&apos;re short for rent</p>
                  <p className="mt-1 font-mono text-xs opacity-80">
                    {formatINR(rent.amount)} due {formatDate(fromKey(rent.date))} · {rent.daysUntil} days
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 font-display text-xl">Rent safe for</p>
                  <p className="big-number text-5xl">{rent.daysUntil} days</p>
                  <p className="mt-1 font-mono text-xs opacity-70">{formatINR(rent.amount)} due {formatDate(fromKey(rent.date))}</p>
                </>
              )
            ) : (
              <p className="mt-2 font-display text-xl">Add your rent in Settings</p>
            )}
          </Card>
        </Link>

        {/* Munshi brief */}
        <Card variant="ledger" className="col-span-2 md:row-span-2">
          <div className="flex items-baseline justify-between">
            <Eyebrow>Munshi&apos;s morning brief</Eyebrow>
            <Link href="/munshi" className="font-mono text-[11px] uppercase tracking-widest text-khata">Open →</Link>
          </div>
          <p className="mb-3 font-display text-2xl">{Math.min(3, brief.length)} things today</p>
          <ol className="space-y-3">
            {brief.slice(0, 3).map((item, i) => (
              <li key={item.key} className="hairline-b pb-3 last:border-0">
                <div className="flex gap-3">
                  <span className="font-mono text-sm text-khata">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{item.title}</p>
                    <p className="text-sm text-ink/70">{item.detail}</p>
                    <details className="mt-1">
                      <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-ink/50">Why?</summary>
                      <p className="mt-1 text-sm text-ink/70">{item.reason}</p>
                    </details>
                    <div className="mt-2">
                      <BriefActions item={item} payload={item.familyId ? payloads[item.familyId] : undefined} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {brief.length === 0 && <p className="text-sm">Nothing needs you today. Teach well.</p>}
          </ol>
        </Card>

        {/* Cash cone */}
        <Link href="/forecast" className="col-span-2 block">
          <Card className="h-full">
            <div className="flex items-baseline justify-between">
              <Eyebrow>Cash cone · 90 days</Eyebrow>
              <span className="font-mono text-[11px] text-ink/60">likely {formatINR(forecast.end90.p50)}</span>
            </div>
            <ConeChart points={forecast.points.slice(0, 61)} rentDate={rent?.date} mini height={110} />
            <p className="font-mono text-[11px] text-ink/60">Band = best to worst of 500 simulated futures</p>
          </Card>
        </Link>

        {/* Chase queue */}
        <Card variant="ink" className="col-span-2">
          <div className="flex items-baseline justify-between">
            <Eyebrow>Chase queue</Eyebrow>
            <Link href="/owes" className="font-mono text-[11px] uppercase tracking-widest text-turmeric">All →</Link>
          </div>
          <ul className="mt-2 divide-y divide-ledger/10">
            {chase.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/families/${f.id}`} className="min-w-0">
                  <p className="truncate">{f.parentName}</p>
                  <p className="font-mono text-xs text-ledger/60">
                    <MoneyText amount={f.stats.balance} /> · <span className="text-khata">{f.stats.oldestDaysLate}d late</span>
                  </p>
                </Link>
                <RemindButton p={payloads[f.id]} variant="ghost" className="min-h-9 shrink-0 px-3 text-ledger" />
              </li>
            ))}
          </ul>
        </Card>

        {/* Money weather */}
        <Link href="/forecast" className="col-span-2 block">
          <Card className="h-full" ruled={false}>
            <Eyebrow>Money weather · next 6 weeks</Eyebrow>
            <div className="mt-3">
              <WeatherStrip weeks={forecast.weeks} compact />
            </div>
          </Card>
        </Link>

        {/* Promises due */}
        <Card variant="ledger" className="col-span-1">
          <Eyebrow>Promises due</Eyebrow>
          <p className="big-number mt-2 text-5xl">{promises.length}</p>
          {promises[0] && (
            <p className="mt-2 text-sm leading-snug">
              {promises[0].f.parentName.split(" ")[0]}: {formatINR(promises[0].p.amount)}{" "}
              <span className="font-mono text-xs text-ink/60">
                {(() => {
                  const d = daysBetween(today, promises[0].p.promisedDate);
                  return d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
                })()}
              </span>
            </p>
          )}
        </Card>

        {/* Confirmations */}
        <Link href="/invoices?filter=claims" className="col-span-1 block">
          <Card variant={pendingClaims ? "turmeric" : "ink"} ruled={false} className="h-full">
            <Eyebrow>Parent payments to confirm</Eyebrow>
            <p className="big-number mt-2 text-5xl">{pendingClaims}</p>
            <p className="mt-2 font-mono text-[11px] opacity-70">via pay links</p>
          </Card>
        </Link>
      </div>
      <p className="mt-4 text-center font-mono text-[11px] text-ink-muted">As of {formatDate(today)} · {toKey(today)} IST</p>
    </div>
  );
}
