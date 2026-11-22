import { Card, EmptyState, Eyebrow, PageHeader } from "@/components/ui/Card";
import { Guard } from "@/components/setup/Guard";
import { BriefActions } from "@/components/munshi/BriefActions";
import { AskMunshi, InboxButtons, PlanStepAction, ReplyReader } from "@/components/munshi/MunshiTools";
import { loadDashboard } from "@/lib/board-view";
import { buildRentPlan } from "@/lib/munshi/rules";
import { llmEnabled } from "@/lib/munshi/agent";
import { db } from "@/lib/db";
import { formatDate, formatMonthShort, addMonths, monthKey, monthStart, fromKey } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { kidsLabel } from "@/lib/messages";

export const dynamic = "force-dynamic";

export default function MunshiPage() {
  return (
    <Guard>
      {async () => {
        const { board, forecast, brief, payloads } = await loadDashboard();
        const plan = buildRentPlan({ families: board.families, forecast, bills: board.bills, today: board.today });
        const [inbox, log] = await Promise.all([
          db.agentAction.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 20 }),
          db.agentAction.findMany({ where: { status: { not: "PENDING" } }, orderBy: { createdAt: "desc" }, take: 15 }),
        ]);
        const aiOn = llmEnabled();
        const nextMonth = formatMonthShort(monthKey(addMonths(monthStart(board.today), 1)));
        const famName = new Map(board.families.map((f) => [f.id, f.parentName]));
        return (
          <div className="space-y-6">
            <PageHeader title="Munshi" kicker={aiOn ? "AI clerk · online" : "Clerk · offline rules"} />

            <section>
              <Eyebrow className="mb-2">Today&apos;s brief</Eyebrow>
              {brief.length ? (
                <Card className="divide-y divide-ink/10 p-0">
                  {brief.slice(0, 6).map((item) => (
                    <div key={item.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg leading-snug">{item.title}</p>
                        <p className="text-sm text-ink/70">{item.detail}</p>
                        <p className="font-mono text-[11px] text-ink/50">Why: {item.reason}</p>
                      </div>
                      <BriefActions item={item} payload={item.familyId ? payloads[item.familyId] : undefined} />
                    </div>
                  ))}
                </Card>
              ) : (
                <EmptyState title="Nothing needs you today" />
              )}
            </section>

            {plan && forecast.rent && (
              <section id="plan">
                <Eyebrow className="mb-2">Rent Defense Plan</Eyebrow>
                <Card variant={forecast.rent.risk >= 0.4 ? "khata" : "ink"} ruled={false}>
                  <p className="font-display text-2xl">{plan.title}</p>
                  <p className="text-sm opacity-80">{plan.goal} Rent risk today: {Math.round(forecast.rent.risk * 100)}%.</p>
                </Card>
                <Card className="divide-y divide-ink/10 p-0">
                  {plan.steps.map((s, i) => {
                    const f = s.familyId ? board.families.find((x) => x.id === s.familyId) : undefined;
                    const discount = s.type === "DISCOUNT" && f
                      ? { language: f.language, parent: f.parentName.split(" ")[0], kids: kidsLabel(f.students.filter((k) => k.active).map((k) => k.name)), month: nextMonth, amount: formatINR(f.stats.monthlyTotal - Number(s.payload.discount ?? 100)), by: formatDate(fromKey(String(s.payload.by)), { weekday: false, year: false }), tutor: board.settings.tutorName, token: f.invoices[f.invoices.length - 1]?.payToken ?? null }
                      : undefined;
                    return (
                      <div key={i} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] text-ink/50">Step {i + 1}</p>
                          <p className="font-display text-lg leading-snug">{s.title}</p>
                          <p className="text-sm text-ink/70">{s.detail}</p>
                          <p className="font-mono text-[11px] text-ink/50">Why: {s.reason}</p>
                        </div>
                        <PlanStepAction step={s} payload={s.familyId ? payloads[s.familyId] : undefined} discount={discount} />
                      </div>
                    );
                  })}
                </Card>
              </section>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <section>
                <Eyebrow className="mb-2">Reply Reader</Eyebrow>
                <Card><ReplyReader families={board.families.filter((f) => f.stats.balance > 0).map((f) => ({ id: f.id, parentName: f.parentName }))} /></Card>
              </section>
              <section>
                <Eyebrow className="mb-2">Ask Munshi</Eyebrow>
                <Card><AskMunshi aiOn={aiOn} /></Card>
              </section>
            </div>

            {inbox.length > 0 && (
              <section>
                <Eyebrow className="mb-2">Approval inbox · {inbox.length}</Eyebrow>
                <Card className="divide-y divide-ink/10 p-0">
                  {inbox.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg">{a.title}</p>
                        {a.reason && <p className="font-mono text-[11px] text-ink/50">Why: {a.reason}</p>}
                      </div>
                      <InboxButtons id={a.id} />
                    </div>
                  ))}
                </Card>
              </section>
            )}

            <section>
              <Eyebrow className="mb-2">Activity log</Eyebrow>
              {log.length ? (
                <Card className="divide-y divide-ink/10 p-0">
                  {log.map((a) => (
                    <div key={a.id} className="px-4 py-2">
                      <p className="text-sm">{a.title}{a.familyId && famName.get(a.familyId) && !a.title.includes(famName.get(a.familyId)!) ? ` · ${famName.get(a.familyId)}` : ""}</p>
                      <p className="font-mono text-[11px] text-ink/50">{formatDate(a.createdAt)} · {a.status.toLowerCase()} · {a.source === "AI" ? "AI" : "rules"}{a.reason ? ` · ${a.reason}` : ""}</p>
                    </div>
                  ))}
                </Card>
              ) : (
                <EmptyState title="No activity yet" body="Approved actions and read replies show up here." />
              )}
            </section>
          </div>
        );
      }}
    </Guard>
  );
}
