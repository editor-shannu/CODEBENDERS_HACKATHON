import Link from "next/link";
import { Card, EmptyState, Eyebrow, PageHeader } from "@/components/ui/Card";
import { HouseStatus, houseStatusOf } from "@/components/ui/HouseStatus";
import { MoneyText } from "@/components/ui/MoneyText";
import { Stamp } from "@/components/ui/Stamp";
import { Guard } from "@/components/setup/Guard";
import { ClaimButtons, GenerateInvoicesButton, IssueDraftsButton } from "@/components/invoices/InvoiceActions";
import { db } from "@/lib/db";
import { balanceOf, isOverdue } from "@/lib/invoice-status";
import { formatDate, formatMonth, relativeDue, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unpaid", label: "Unpaid" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
  { id: "claims", label: "To confirm" },
  { id: "drafts", label: "Drafts" },
] as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ filter?: string; month?: string }> }) {
  const { filter = "all", month } = await searchParams;
  return (
    <Guard>
      {async () => {
        const today = todayIST();
        const [invoices, claims] = await Promise.all([
          db.invoice.findMany({ include: { family: true, payments: true }, orderBy: [{ month: "desc" }, { number: "asc" }] }),
          db.paymentClaim.findMany({ where: { status: "PENDING" }, include: { invoice: { include: { family: true } } }, orderBy: { createdAt: "asc" } }),
        ]);
        const openPromise = new Set((await db.payPromise.findMany({ where: { kept: null }, select: { familyId: true } })).map((p) => p.familyId));
        const months = [...new Set(invoices.map((i) => i.month))];
        const list = invoices
          .filter((i) => !month || i.month === month)
          .filter((i) => {
            if (filter === "drafts") return i.status === "DRAFT";
            if (i.status === "DRAFT") return filter === "all";
            const bal = balanceOf(i);
            if (filter === "unpaid") return bal > 0;
            if (filter === "overdue") return isOverdue(i, today);
            if (filter === "paid") return bal === 0;
            return true;
          });
        const due = list.filter((i) => i.status !== "DRAFT").reduce((s, i) => s + balanceOf(i), 0);
        const drafts = invoices.filter((i) => i.status === "DRAFT");
        const q = (f: string, m?: string) => `/invoices?filter=${f}${m ? `&month=${m}` : ""}`;
        return (
          <div>
            <PageHeader title="Invoices" kicker={`${list.length} shown · ${formatINR(due)} due`}>
              <GenerateInvoicesButton />
              {drafts.length > 0 && <IssueDraftsButton label={`Issue all ${drafts.length}`} />}
            </PageHeader>
            <div className="mb-3 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <Link key={f.id} href={q(f.id, month)} className={`min-h-9 border px-3 py-2 font-mono text-[11px] uppercase tracking-widest ${filter === f.id ? "border-lamp bg-lamp text-dusk-deep" : "border-plaster/25"}`}>
                  {f.label}{f.id === "claims" && claims.length ? ` · ${claims.length}` : ""}{f.id === "drafts" && drafts.length ? ` · ${drafts.length}` : ""}
                </Link>
              ))}
            </div>
            {filter !== "claims" && (
              <div className="mb-4 flex flex-wrap gap-2">
                <Link href={q(filter)} className={`font-mono text-[11px] ${!month ? "text-lamp" : "text-plaster/60"}`}>All months</Link>
                {months.map((m) => (
                  <Link key={m} href={q(filter, m)} className={`font-mono text-[11px] ${month === m ? "text-lamp" : "text-plaster/60"}`}>{formatMonth(m)}</Link>
                ))}
              </div>
            )}

            {filter === "claims" ? (
              claims.length ? (
                <Card className="divide-y divide-dusk-deep/10 p-0">
                  {claims.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="font-display text-xl">{c.invoice.family.parentName}</p>
                        <p className="font-mono text-[11px] text-dusk-deep/60">Says paid {formatINR(c.amount)} by UPI · ref {c.reference} · {formatDate(c.createdAt)}</p>
                      </div>
                      <ClaimButtons id={c.id} />
                    </div>
                  ))}
                </Card>
              ) : (
                <EmptyState title="Nothing to confirm" body="When a parent taps “I've paid” on their pay link, it shows up here." />
              )
            ) : list.length ? (
              <Card className="divide-y divide-dusk-deep/10 p-0">
                {list.map((inv) => {
                  const bal = balanceOf(inv);
                  return (
                    <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-dusk-deep/5">
                      <div className="flex min-w-0 items-center gap-3">
                        <HouseStatus status={houseStatusOf(bal, openPromise.has(inv.familyId))} size={28} />
                        <div className="min-w-0">
                        <p className="truncate font-display text-lg">{inv.family.parentName}</p>
                        <p className="font-mono text-[11px] text-dusk-deep/60">{inv.number} · {formatMonth(inv.month)} · {inv.status === "DRAFT" ? "draft, not issued" : bal ? relativeDue(inv.dueDate, today) : "paid"}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {inv.status === "DRAFT" ? <span className="font-mono text-[11px] uppercase tracking-widest text-dusk-deep/60">Draft</span> : bal === 0 ? <Stamp kind="PAID" /> : isOverdue(inv, today) ? <Stamp kind="OVERDUE" /> : bal < inv.amount ? <Stamp kind="PARTIAL" /> : null}
                        <MoneyText amount={bal || inv.amount} tone={bal && inv.status !== "DRAFT" ? "red" : undefined} />
                      </div>
                    </Link>
                  );
                })}
              </Card>
            ) : (
              <EmptyState title="No invoices match" />
            )}
            <Eyebrow className="mt-4 text-center">Overdue is computed live from today, {formatDate(today)}</Eyebrow>
          </div>
        );
      }}
    </Guard>
  );
}
