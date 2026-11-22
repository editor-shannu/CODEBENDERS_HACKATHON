import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Eyebrow, PageHeader } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { Guard } from "@/components/setup/Guard";
import { PrintButton } from "@/components/invoices/InvoiceActions";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/data";
import { addMonths, dateInMonth, formatDate, formatMonth, monthKey, todayIST } from "@/lib/dates";
import { buildReport } from "@/lib/report";

export const dynamic = "force-dynamic";

const dayWord = (d: number) => (d < 0 ? `${-d} day${d === -1 ? "" : "s"} early` : d === 0 ? "on the due date" : `${d} day${d === 1 ? "" : "s"} late`);

/** Month Report Card: collected vs due, on-time rate, promises kept, best and slowest payers. Printable. */
export default async function ReportPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) notFound();
  return (
    <Guard>
      {async () => {
        const today = todayIST();
        const start = dateInMonth(month, 1);
        const end = addMonths(start, 1);
        const [invoices, promises, settings] = await Promise.all([
          db.invoice.findMany({ where: { month, status: { not: "DRAFT" } }, include: { family: { select: { parentName: true } }, payments: true } }),
          db.payPromise.findMany({ where: { promisedDate: { gte: start, lt: end } }, select: { kept: true } }),
          getSettings(),
        ]);
        const r = buildReport(invoices.map((i) => ({ familyId: i.familyId, parent: i.family.parentName, amount: i.amount, dueDate: i.dueDate, payments: i.payments })), promises, today);
        const prev = monthKey(addMonths(start, -1));
        const next = monthKey(end);
        const pct = r.due ? Math.round((r.collected / r.due) * 100) : 0;
        return (
          <div>
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-4 font-mono text-xs">
                <Link href={`/report/${prev}`} className="text-plaster/70 hover:text-lamp">← {formatMonth(prev)}</Link>
                {next <= monthKey(today) && <Link href={`/report/${next}`} className="text-plaster/70 hover:text-lamp">{formatMonth(next)} →</Link>}
              </div>
              <PrintButton />
            </div>
            <PageHeader title={`Report card · ${formatMonth(month, false)}`} kicker={settings.centreName} />
            {r.invoices === 0 ? (
              <Card><p className="font-display text-xl">No issued invoices for {formatMonth(month, false)}.</p></Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <Eyebrow>Collected vs due</Eyebrow>
                  <p className="mt-1 font-mono text-lg"><MoneyText amount={r.collected} /> of <MoneyText amount={r.due} /> · {pct}%</p>
                  <div className="mt-2 h-2 w-full bg-dusk-deep/10"><div className="h-2 bg-lamp" style={{ width: `${pct}%` }} /></div>
                  <p className="mt-2 font-mono text-xs text-dusk-deep/70">{r.outstanding > 0 ? <>Still out: <MoneyText amount={r.outstanding} tone="red" /></> : "Everything collected"}</p>
                </Card>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <Eyebrow>On-time rate</Eyebrow>
                    <p className="big-number mt-1 text-5xl">{Math.round(r.onTimeRate * 100)}%</p>
                    <p className="font-mono text-xs text-dusk-deep/70">{r.onTime} of {r.invoices} invoices paid in full by the due date · {r.paidInFull} paid in full</p>
                  </Card>
                  <Card>
                    <Eyebrow>Promises</Eyebrow>
                    <p className="big-number mt-1 text-5xl">{r.promisesKept}<span className="text-2xl"> kept</span></p>
                    <p className="font-mono text-xs text-dusk-deep/70">{r.promisesBroken} broken · promises dated in {formatMonth(month)}</p>
                  </Card>
                  <Card>
                    <Eyebrow>Best payers</Eyebrow>
                    <ol className="mt-1 space-y-1">{r.best.map((b) => <li key={b.parent} className="text-sm">{b.parent} <span className="font-mono text-xs text-dusk-deep/60">· {dayWord(b.days)}</span></li>)}</ol>
                    {!r.best.length && <p className="text-sm">Nobody paid in full yet.</p>}
                  </Card>
                  <Card>
                    <Eyebrow>Slowest payers</Eyebrow>
                    <ol className="mt-1 space-y-1">{r.slowest.map((b) => <li key={b.parent} className="text-sm">{b.parent} <span className="font-mono text-xs text-dusk-deep/60">· {dayWord(b.days)}{b.open ? ", still open" : ""}</span></li>)}</ol>
                    {!r.slowest.length && <p className="text-sm">Nobody was late.</p>}
                  </Card>
                </div>
              </div>
            )}
            <Eyebrow className="mt-4 text-center">Computed live from today, {formatDate(today)}</Eyebrow>
          </div>
        );
      }}
    </Guard>
  );
}
