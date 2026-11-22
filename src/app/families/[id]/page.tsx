import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Eyebrow, PageHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { HouseStatus, houseStatusOf } from "@/components/ui/HouseStatus";
import { MoneyText } from "@/components/ui/MoneyText";
import { Stamp } from "@/components/ui/Stamp";
import { Guard } from "@/components/setup/Guard";
import { RemindButton } from "@/components/actions/RemindButton";
import { RecordPaymentButton } from "@/components/actions/RecordPayment";
import { AddPromiseButton } from "@/components/actions/AddPromise";
import { FamilyEditButton } from "@/components/families/FamilyEdit";
import { loadDashboard } from "@/lib/board-view";
import { balanceOf, isOverdue } from "@/lib/invoice-status";
import { formatDate, formatMonth, relativeDue, toKey } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { memoryOf } from "@/lib/munshi/rules";
import { FeePause } from "@/components/students/FeePause";
import { addMonths, formatMonthShort, monthKey, monthStart } from "@/lib/dates";

export const dynamic = "force-dynamic";

const LANG: Record<string, string> = { te: "Telugu", en: "English", hi: "Hindi" };

export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Guard>
      {async () => {
        const { board, payloads } = await loadDashboard();
        const f = board.families.find((x) => x.id === id);
        if (!f) notFound();
        const today = board.today;
        const mem = memoryOf(f);
        const invoices = [...f.invoices].sort((a, b) => +b.dueDate - +a.dueDate);
        return (
          <div>
            <PageHeader title={f.parentName} kicker={`Family · ${LANG[f.language] ?? f.language} messages`}>
              <div className="flex flex-wrap items-center gap-2">
                <HouseStatus status={houseStatusOf(f.stats.balance, !!f.stats.openPromise)} size={44} />
                <FamilyEditButton f={f} />
                <LinkButton href={`/students/new?family=${f.id}`} variant="ghost">Add sibling</LinkButton>
              </div>
            </PageHeader>

            <div className="grid gap-4 md:grid-cols-3">
              <Card variant={f.stats.balance > 0 ? "brick" : "dusk"} ruled={false}>
                <Eyebrow>Balance due</Eyebrow>
                <p className="big-number mt-2 text-5xl">{formatINR(f.stats.balance)}</p>
                <p className="mt-2 font-mono text-xs opacity-80">{f.stats.oldestDaysLate ? `${f.stats.oldestDaysLate} days late` : f.stats.balance ? "Not yet overdue" : "All clear"}</p>
                {f.stats.balance > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {payloads[f.id] && <RemindButton p={payloads[f.id]} variant="plaster" />}
                    <AddPromiseButton familyId={f.id} amount={f.stats.balance} today={toKey(today)} parent={f.parentName.split(" ")[0]} />
                  </div>
                )}
              </Card>
              <Card>
                <Eyebrow>Payment habits</Eyebrow>
                <ul className="mt-2 space-y-1 font-mono text-sm">
                  <li>Usually pays {Math.round(f.stats.avgDelay)} days after due</li>
                  <li>Promises kept {f.stats.promisesKept} · broken {f.stats.promisesBroken}</li>
                  <li>Monthly fee {formatINR(f.stats.monthlyTotal)}</li>
                  {f.stats.lastReminder && <li>Last reminder {formatDate(f.stats.lastReminder)}</li>}
                </ul>
              </Card>
              <Card>
                <Eyebrow>Munshi&apos;s notes</Eyebrow>
                {f.notes && <p className="mt-2 text-sm">{f.notes}</p>}
                <ul className="mt-2 space-y-1 font-mono text-xs text-dusk-deep/70">
                  {Object.entries(mem).map(([k, v]) => <li key={k}>{k.replace(/([A-Z])/g, " $1").toLowerCase()}: {v}</li>)}
                </ul>
                {!f.notes && !Object.keys(mem).length && <p className="mt-2 text-sm text-dusk-deep/60">Nothing learned yet.</p>}
              </Card>
            </div>

            <section className="mt-6">
              <Eyebrow className="mb-2">Children</Eyebrow>
              <Card className="divide-y divide-dusk-deep/10 p-0">
                {f.students.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className={`font-display text-xl ${s.active ? "" : "line-through opacity-50"}`}>{s.name}</p>
                      <p className="font-mono text-[11px] text-dusk-deep/60">{s.batch} · due on the {s.dueDay}{s.pausedMonths ? ` · fee paused ${s.pausedMonths.split(",").map(formatMonthShort).join(", ")}` : ""}</p>
                      {s.active && <FeePause studentId={s.id} paused={(s.pausedMonths ?? "").split(",").filter(Boolean)} months={[0, 1, 2, 3].map((i) => { const k = monthKey(addMonths(monthStart(today), i)); return { key: k, label: formatMonthShort(k) }; })} />}
                    </div>
                    <div className="flex items-center gap-3">
                      <MoneyText amount={s.monthlyFee} className="text-sm" />
                      <Link href={`/students/${s.id}/edit`} className="font-mono text-[11px] uppercase tracking-widest text-dusk-deep/60 hover:text-brick">Edit</Link>
                    </div>
                  </div>
                ))}
              </Card>
            </section>

            <section className="mt-6">
              <Eyebrow className="mb-2">Invoices</Eyebrow>
              <Card className="divide-y divide-dusk-deep/10 p-0">
                {invoices.map((inv) => {
                  const bal = balanceOf(inv);
                  const overdue = isOverdue(inv, today);
                  return (
                    <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <HouseStatus status={bal === 0 ? "paid" : houseStatusOf(bal, !!f.stats.openPromise)} size={28} />
                        <div>
                        <Link href={`/invoices/${inv.id}`} className="font-display text-lg hover:text-brick">{formatMonth(inv.month)}</Link>
                        <p className="font-mono text-[11px] text-dusk-deep/60">{inv.number} · {bal ? relativeDue(inv.dueDate, today) : `paid ${formatINR(inv.amount)}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {bal === 0 ? <Stamp kind="PAID" /> : overdue ? <Stamp kind="OVERDUE" /> : bal < inv.amount ? <Stamp kind="PARTIAL" /> : null}
                        {bal > 0 && <MoneyText amount={bal} tone="red" />}
                        {bal > 0 && <RecordPaymentButton invoiceId={inv.id} balance={bal} title={`${f.parentName.split(" ")[0]} · ${formatMonth(inv.month)}`} today={toKey(today)} className="min-h-9 px-3" />}
                      </div>
                    </div>
                  );
                })}
                {!invoices.length && <p className="px-4 py-3 text-sm text-dusk-deep/60">No invoices yet.</p>}
              </Card>
            </section>

            {f.promises.length > 0 && (
              <section className="mt-6">
                <Eyebrow className="mb-2">Promises</Eyebrow>
                <Card className="divide-y divide-dusk-deep/10 p-0">
                  {[...f.promises].reverse().map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3 font-mono text-sm">
                      <span>{formatINR(p.amount)} by {formatDate(p.promisedDate)}</span>
                      <span className={p.kept === true ? "text-lamp" : p.kept === false ? "text-brick" : "text-dusk-deep/60"}>{p.kept === true ? "Kept" : p.kept === false ? "Broken" : "Open"}</span>
                    </div>
                  ))}
                </Card>
              </section>
            )}
          </div>
        );
      }}
    </Guard>
  );
}
