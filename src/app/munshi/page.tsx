import { Card, EmptyState, Eyebrow, PageHeader } from "@/components/ui/Card";
import { Guard } from "@/components/setup/Guard";
import { ApproveAllBrief, BriefActions } from "@/components/munshi/BriefActions";
import { AskMunshi, InboxButtons, PlanControls, PlanStepAction, ReplyReader } from "@/components/munshi/MunshiTools";
import { loadActivePlan } from "@/lib/munshi/plan";
import { AUTONOMY_LABEL, autoRunBrief } from "@/lib/munshi/execute";
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
        const autonomy = board.settings.autonomy;
        const autoRan = autonomy === "AUTO" ? await autoRunBrief(brief, board.today) : 0;
        const plan = buildRentPlan({ families: board.families, forecast, bills: board.bills, today: board.today });
        const [inbox, log, active] = await Promise.all([
          db.agentAction.findMany({ where: { status: "PENDING", planId: null }, orderBy: { createdAt: "asc" }, take: 20 }),
          db.agentAction.findMany({ where: { status: { not: "PENDING" }, planId: null }, orderBy: { createdAt: "desc" }, take: 15 }),
          loadActivePlan(),
        ]);
        const aiOn = llmEnabled();
        const nextMonth = formatMonthShort(monthKey(addMonths(monthStart(board.today), 1)));
        const famName = new Map(board.families.map((f) => [f.id, f.parentName]));
        return (
          <div className="space-y-6">
            <PageHeader title="Munshi" kicker={`${aiOn ? "AI clerk · online" : "Clerk · offline rules"} · ${autonomy.toLowerCase()} mode`} />
            <p className="font-mono text-[11px] text-plaster/60">
              Autonomy · {AUTONOMY_LABEL[autonomy] ?? AUTONOMY_LABEL.ASK}
              {autoRan ? ` · drafted ${autoRan} gentle reminder${autoRan > 1 ? "s" : ""} on its own today` : ""} · change it in Settings
            </p>

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <Eyebrow>Today&apos;s brief</Eyebrow>
                {brief.length > 0 && <ApproveAllBrief />}
              </div>
              {brief.length ? (
                <Card className="divide-y divide-dusk-deep/10 p-0">
                  {brief.slice(0, 6).map((item) => (
                    <div key={item.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg leading-snug">{item.title}</p>
                        <p className="text-sm text-dusk-deep/70">{item.detail}</p>
                        <p className="font-mono text-[11px] text-dusk-deep/50">Why: {item.reason}</p>
                      </div>
                      <BriefActions item={item} payload={item.familyId ? payloads[item.familyId] : undefined} />
                    </div>
                  ))}
                </Card>
              ) : (
                <EmptyState title="Nothing needs you today" />
              )}
            </section>

            {active ? (
              <section id="plan">
                <Eyebrow className="mb-2">Rent Defense Plan · {active.done} of {active.total} steps done</Eyebrow>
                <Card variant={active.covered >= active.gap ? "dusk" : "brick"} ruled={false}>
                  <p className="font-display text-2xl">{active.title}</p>
                  <p className="text-sm opacity-80">{active.goal}</p>
                  <p className="mt-2 font-mono text-sm">
                    Covered {formatINR(Math.min(active.covered, active.gap))} of {formatINR(active.gap)} gap
                    {active.covered >= active.gap ? " · rent is covered" : ` · ${formatINR(active.gap - active.covered)} to go`}
                    {forecast.rent ? ` · rent risk now ${Math.round(forecast.rent.risk * 100)}%` : ""} · runway {forecast.runwayDays >= 90 ? "90+" : forecast.runwayDays} days
                  </p>
                  <div className="mt-2 h-2 w-full bg-plaster/20">
                    <div className="h-2 bg-lamp" style={{ width: `${Math.min(100, Math.round((active.covered / Math.max(1, active.gap)) * 100))}%` }} />
                  </div>
                  <div className="mt-3"><PlanControls active /></div>
                </Card>
                <Card className="divide-y divide-dusk-deep/10 p-0">
                  {active.steps.map((s) => {
                    const f = s.familyId ? board.families.find((x) => x.id === s.familyId) : undefined;
                    const discount = s.type === "DISCOUNT" && f
                      ? { language: f.language, parent: f.parentName.split(" ")[0], kids: kidsLabel(f.students.filter((k) => k.active).map((k) => k.name)), month: nextMonth, amount: formatINR(f.stats.monthlyTotal - Number(s.payload.discount ?? 100)), by: formatDate(fromKey(String(s.payload.by)), { weekday: false, year: false }), tutor: board.settings.tutorName, token: f.invoices[f.invoices.length - 1]?.payToken ?? null }
                      : undefined;
                    const step = { type: s.type as "REMIND" | "DISCOUNT" | "DEFER_BILL", familyId: s.familyId ?? undefined, billId: s.billId ?? undefined, amount: s.amount, title: s.title, detail: s.detail, reason: s.reason, payload: s.payload };
                    return (
                      <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] text-dusk-deep/50">Step {s.step} · {s.status === "DONE" ? "done" : s.collected > 0 ? `${formatINR(s.collected)} of ${formatINR(s.amount)} in` : "pending"}</p>
                          <p className={`font-display text-lg leading-snug ${s.status === "DONE" ? "line-through opacity-60" : ""}`}>{s.title}</p>
                          <p className="text-sm text-dusk-deep/70">{s.detail}</p>
                          <p className="font-mono text-[11px] text-dusk-deep/50">Why: {s.reason}</p>
                        </div>
                        {s.status === "DONE" ? <span className="font-mono text-xs text-lamp">Done</span> : <PlanStepAction step={step} payload={s.familyId ? payloads[s.familyId] : undefined} discount={discount} />}
                      </div>
                    );
                  })}
                </Card>
              </section>
            ) : plan && forecast.rent && (
              <section id="plan">
                <Eyebrow className="mb-2">Rent Defense Plan</Eyebrow>
                <Card variant={forecast.rent.risk >= 0.4 ? "brick" : "dusk"} ruled={false}>
                  <p className="font-display text-2xl">{plan.title}</p>
                  <p className="text-sm opacity-80">{plan.goal} Rent risk today: {Math.round(forecast.rent.risk * 100)}%.</p>
                  <div className="mt-3"><PlanControls active={false} /></div>
                </Card>
                <Card className="divide-y divide-dusk-deep/10 p-0">
                  {plan.steps.map((s, i) => {
                    const f = s.familyId ? board.families.find((x) => x.id === s.familyId) : undefined;
                    const discount = s.type === "DISCOUNT" && f
                      ? { language: f.language, parent: f.parentName.split(" ")[0], kids: kidsLabel(f.students.filter((k) => k.active).map((k) => k.name)), month: nextMonth, amount: formatINR(f.stats.monthlyTotal - Number(s.payload.discount ?? 100)), by: formatDate(fromKey(String(s.payload.by)), { weekday: false, year: false }), tutor: board.settings.tutorName, token: f.invoices[f.invoices.length - 1]?.payToken ?? null }
                      : undefined;
                    return (
                      <div key={i} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] text-dusk-deep/50">Step {i + 1} · {formatINR(s.amount)}</p>
                          <p className="font-display text-lg leading-snug">{s.title}</p>
                          <p className="text-sm text-dusk-deep/70">{s.detail}</p>
                          <p className="font-mono text-[11px] text-dusk-deep/50">Why: {s.reason}</p>
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
                <Card className="divide-y divide-dusk-deep/10 p-0">
                  {inbox.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg">{a.title}</p>
                        {a.reason && <p className="font-mono text-[11px] text-dusk-deep/50">Why: {a.reason}</p>}
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
                <Card className="divide-y divide-dusk-deep/10 p-0">
                  {log.map((a) => (
                    <div key={a.id} className="px-4 py-2">
                      <p className="text-sm">{a.title}{a.familyId && famName.get(a.familyId) && !a.title.includes(famName.get(a.familyId)!) ? ` · ${famName.get(a.familyId)}` : ""}</p>
                      <p className="font-mono text-[11px] text-dusk-deep/50">{formatDate(a.createdAt)} · {a.status.toLowerCase()} · {a.source === "AI" ? "AI" : "rules"}{a.reason ? ` · ${a.reason}` : ""}</p>
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
