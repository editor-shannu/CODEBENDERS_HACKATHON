"use client";

import { useState, useTransition } from "react";
import { Button, inputClass, labelClass } from "@/components/ui/Button";
import { RecordPaymentButton } from "@/components/actions/RecordPayment";
import { matchUpiSmsAction } from "@/app/actions";
import { formatINR } from "@/lib/money";

type Result = Extract<Awaited<ReturnType<typeof matchUpiSmsAction>>, { ok: true }>;

const SAMPLE = "Rs.1,800.00 credited to your A/c XX1234 on 21-11-26 by UPI from ANITHA VASUPALLI. UPI Ref No 432198765432.";

/** Paste a bank or UPI SMS: Baaki reads amount, UTR, payer and date and offers the likeliest invoice. */
export function PasteMatch() {
  const [text, setText] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass} htmlFor="sms">Paste a UPI or bank SMS</label>
        <textarea id="sms" rows={3} className={`${inputClass} py-2`} value={text} onChange={(e) => { setText(e.target.value); setRes(null); }} placeholder="Rs.1,800 credited… UPI Ref No…" />
        <button className="mt-1 font-mono text-[11px] text-dusk-deep/60 underline" onClick={() => { setText(SAMPLE); setRes(null); }}>Try a sample</button>
      </div>
      {error && <p className="font-mono text-sm text-brick">{error}</p>}
      <Button variant="plaster" disabled={pending || !text.trim()} onClick={() => start(async () => { setError(null); const r = await matchUpiSmsAction(text); if (!r.ok) return setError(r.error); setRes(r); })}>
        {pending ? "Matching…" : "Match"}
      </Button>
      {res && (
        <div className="space-y-2 border border-dusk-deep/20 bg-white/50 p-3">
          <p className="font-mono text-[11px] text-dusk-deep/70">
            {res.parsed.amount !== null ? formatINR(res.parsed.amount) : "No amount"} · UTR {res.parsed.utr ?? "not found"} · {res.parsed.payer ?? res.parsed.vpa ?? "payer not found"} · {res.parsed.date ?? "today"}
          </p>
          {res.duplicate && <p className="font-mono text-xs text-brick">This UTR is already recorded.</p>}
          {res.matches.length ? (
            res.matches.map((m, i) => (
              <div key={m.invoiceId} className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-lg leading-snug">{i === 0 ? "Likely: " : ""}{m.parent}</p>
                  <p className="font-mono text-[11px] text-dusk-deep/60">{m.number} · owes {formatINR(m.balance)} · {m.why.join(", ")}</p>
                </div>
                <RecordPaymentButton
                  invoiceId={m.invoiceId}
                  balance={m.balance}
                  today={res.today}
                  title={`Payment from ${m.parent}`}
                  label="Record payment"
                  variant={i === 0 ? "lamp" : "ghost"}
                  className="min-h-9 px-3"
                  defaults={{ amount: res.parsed.amount ?? undefined, mode: "UPI", reference: res.parsed.utr ?? undefined, date: res.parsed.date ?? undefined }}
                />
              </div>
            ))
          ) : (
            <p className="text-sm">No open invoice matches. Record it from the family page.</p>
          )}
        </div>
      )}
    </div>
  );
}
