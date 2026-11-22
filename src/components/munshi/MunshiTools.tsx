"use client";

import { useState, useTransition } from "react";
import { Button, inputClass, labelClass } from "@/components/ui/Button";
import { RemindButton } from "@/components/actions/RemindButton";
import { addPromise, askMunshiAction, deferBill, dismissRentPlan, logAgentAction, readReplyAction, setActionStatus, startRentPlan } from "@/app/actions";
import { discountOfferText, waLink } from "@/lib/messages";
import type { ReminderPayload } from "@/lib/data";
import type { PlanStep } from "@/lib/munshi/rules";
import type { ReadReply, TraceStep } from "@/lib/munshi/agent";
import { formatINR } from "@/lib/money";

export function PlanStepAction({ step, payload, discount }: { step: PlanStep; payload?: ReminderPayload; discount?: { language: string; parent: string; kids: string; month: string; amount: string; by: string; tutor: string; token: string | null } }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <span className="font-mono text-xs text-lamp">Done</span>;
  if (step.type === "REMIND" && payload)
    return <RemindButton p={{ ...payload, suggestedTone: (step.payload.tone as ReminderPayload["suggestedTone"]) ?? payload.suggestedTone }} label="Approve & send" variant="plaster" className="min-h-9 px-3" onSent={() => setDone(true)} />;
  if (step.type === "DISCOUNT" && discount)
    return (
      <Button
        variant="plaster"
        className="min-h-9 px-3"
        disabled={pending}
        onClick={() => {
          const link = discount.token ? `${window.location.origin}/pay/${discount.token}` : window.location.origin;
          window.open(waLink(discountOfferText(discount.language, { ...discount, discount: formatINR(Number(step.payload.discount ?? 100)), link })), "_blank", "noopener");
          start(async () => { await logAgentAction({ type: "DISCOUNT", familyId: step.familyId, title: step.title, reason: step.reason }); setDone(true); });
        }}
      >
        Approve & send
      </Button>
    );
  if (step.type === "DEFER_BILL" && step.billId)
    return (
      <Button variant="plaster" className="min-h-9 px-3" disabled={pending} onClick={() => start(async () => { await deferBill(step.billId!, Number(step.payload.days ?? 7), step.reason); setDone(true); })}>
        Approve
      </Button>
    );
  return null;
}

export function PlanControls({ active }: { active: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {active ? (
        <Button variant="ghost" className="min-h-9 px-3" disabled={pending} onClick={() => start(async () => void (await dismissRentPlan()))}>End plan</Button>
      ) : (
        <Button variant="plaster" className="min-h-9 px-3" disabled={pending} onClick={() => start(async () => { const r = await startRentPlan(); if (!r.ok) setError(r.error); })}>{pending ? "Starting…" : "Start plan and track it"}</Button>
      )}
      {error && <p className="font-mono text-xs">{error}</p>}
    </div>
  );
}

export function InboxButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button variant="lamp" className="min-h-9 px-3" disabled={pending} onClick={() => start(async () => void (await setActionStatus(id, "DONE")))}>Approve</Button>
      <Button variant="ghost" className="min-h-9 px-3" disabled={pending} onClick={() => start(async () => void (await setActionStatus(id, "SKIPPED")))}>Skip</Button>
    </div>
  );
}

const SAMPLES = ["sir next week pakka istanu", "kal de dunga sir", "salary vachaka 5th ki pay chestha", "Will pay 1500 on Friday madam"];

export function ReplyReader({ families }: { families: { id: string; parentName: string }[] }) {
  const [familyId, setFamilyId] = useState(families[0]?.id ?? "");
  const [text, setText] = useState("");
  const [res, setRes] = useState<(ReadReply & { balance: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass} htmlFor="rf">Reply from</label>
        <select id="rf" className={inputClass} value={familyId} onChange={(e) => { setFamilyId(e.target.value); setRes(null); }}>
          {families.map((f) => <option key={f.id} value={f.id}>{f.parentName}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="rt">Paste their WhatsApp reply</label>
        <textarea id="rt" rows={2} className={`${inputClass} py-2`} value={text} onChange={(e) => { setText(e.target.value); setRes(null); setSaved(false); }} placeholder="sir next week pakka istanu" />
        <div className="mt-1 flex flex-wrap gap-2">
          {SAMPLES.map((s) => <button key={s} className="font-mono text-[11px] text-dusk-deep/60 underline" onClick={() => { setText(s); setRes(null); setSaved(false); }}>{s}</button>)}
        </div>
      </div>
      {error && <p className="font-mono text-sm text-brick">{error}</p>}
      <Button variant="plaster" disabled={pending || !text.trim()} onClick={() => start(async () => { setError(null); const r = await readReplyAction(familyId, text); if (!r.ok) return setError(r.error); setRes({ ...r.result, balance: r.balance }); })}>
        {pending ? "Reading…" : "Read reply"}
      </Button>
      {res && (
        <div className="border border-dusk-deep/20 bg-white/50 p-3">
          <p className="text-sm">{res.summary}</p>
          <p className="mt-1 font-mono text-[11px] text-dusk-deep/60">Confidence {res.confidence} · {res.source === "AI" ? "AI" : "offline rules"}</p>
          {res.promisedDate && !saved && (
            <Button
              variant="lamp"
              className="mt-2 min-h-9 px-3"
              disabled={pending}
              onClick={() => start(async () => { const r = await addPromise({ familyId, promisedDate: res.promisedDate!, amount: res.amount ?? res.balance, note: text.slice(0, 200), source: "MUNSHI" }); if (!r.ok) return setError(r.error); setSaved(true); })}
            >
              Save as promise
            </Button>
          )}
          {saved && <p className="mt-2 font-mono text-xs text-lamp">Promise saved. Munshi will follow up if it&apos;s missed.</p>}
        </div>
      )}
    </div>
  );
}

const QUESTIONS = ["Who should I chase today?", "Will I make rent?", "How much is pending?"];

export function AskMunshi({ aiOn }: { aiOn: boolean }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [source, setSource] = useState<string>("");
  const [pending, start] = useTransition();
  const ask = (question: string) =>
    start(async () => {
      setQ(question);
      const r = await askMunshiAction(question);
      if (!r.ok) return setAnswer(r.error);
      setAnswer(r.answer);
      setTrace(r.trace);
      setSource(r.source);
    });
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input aria-label="Ask Munshi" className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && q.trim() && ask(q)} placeholder="Ask about fees, families, rent…" />
        <Button variant="plaster" disabled={pending || !q.trim()} onClick={() => ask(q)}>{pending ? "…" : "Ask"}</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUESTIONS.map((x) => <button key={x} className="font-mono text-[11px] text-dusk-deep/60 underline" onClick={() => ask(x)}>{x}</button>)}
      </div>
      {answer && (
        <div className="border border-dusk-deep/20 bg-white/50 p-3">
          <p className="text-[15px] leading-relaxed">{answer}</p>
          {trace.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-dusk-deep/60">Agent trace · {source === "AI" ? "AI with tool calls" : "offline rules"}</summary>
              <ol className="mt-2 space-y-1 font-mono text-[11px]">
                {trace.map((t, i) => (
                  <li key={i} className={t.kind === "tool" ? "text-brick" : t.kind === "answer" ? "text-lamp" : "text-dusk-deep/70"}>
                    <span className="uppercase">{t.kind}</span> {t.text}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
      {!aiOn && <p className="font-mono text-[11px] text-dusk-deep/50">Running offline. Add LLM_API_KEY to switch on the AI agent.</p>}
    </div>
  );
}
