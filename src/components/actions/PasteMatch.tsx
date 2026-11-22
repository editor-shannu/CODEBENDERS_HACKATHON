"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, inputClass, labelClass } from "@/components/ui/Button";
import { RecordPaymentButton } from "@/components/actions/RecordPayment";
import { matchUpiSmsAction, readScreenshotAction } from "@/app/actions";
import { formatINR } from "@/lib/money";

type Result = Extract<Awaited<ReturnType<typeof matchUpiSmsAction>>, { ok: true }>;

const SAMPLE = "Rs.1,800.00 credited to your A/c XX1234 on 21-11-26 by UPI from ANITHA VASUPALLI. UPI Ref No 432198765432.";

/** Paste a bank or UPI SMS: Baaki reads amount, UTR, payer and date and offers the likeliest invoice. */
export function PasteMatch({ initialText = "", initialImage = "" }: { initialText?: string; initialImage?: string }) {
  const [text, setText] = useState(initialText);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [shot, setShot] = useState(initialImage);
  const ran = useRef(false);

  const match = (t: string) => start(async () => { setError(null); const r = await matchUpiSmsAction(t); if (!r.ok) return setError(r.error); setRes(r); });
  const readShot = (dataUrl: string) =>
    start(async () => {
      setError(null);
      setRes(null);
      const r = await readScreenshotAction(dataUrl);
      if (!r.ok) return setError(r.error);
      setText(r.text);
      const m = await matchUpiSmsAction(r.text);
      if (!m.ok) return setError(m.error);
      setRes(m);
    });

  // something shared to Baaki: read it straight away
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (initialImage) readShot(initialImage);
    else if (initialText.trim()) match(initialText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass} htmlFor="sms">Paste a UPI or bank SMS</label>
        <textarea id="sms" rows={3} className={`${inputClass} py-2`} value={text} onChange={(e) => { setText(e.target.value); setRes(null); }} placeholder="Rs.1,800 credited… UPI Ref No…" />
        <button className="mt-1 font-mono text-[11px] text-dusk-deep/60 underline" onClick={() => { setText(SAMPLE); setRes(null); }}>Try a sample</button>
      </div>
      <div>
        <label className={labelClass} htmlFor="shot">…or a GPay / PhonePe screenshot</label>
        <input
          id="shot"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-sm file:mr-3 file:min-h-10 file:border file:border-dusk-deep file:bg-transparent file:px-3 file:font-mono file:text-[11px] file:uppercase"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 4_000_000) return setError("That image is too big (max 4 MB)");
            const r = new FileReader();
            r.onload = () => { const url = String(r.result); setShot(url); readShot(url); };
            r.readAsDataURL(f);
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {shot && <img src={shot} alt="Payment screenshot" className="mt-2 max-h-48 border border-dusk-deep/20" />}
      </div>
      {error && <p className="font-mono text-sm text-brick">{error}</p>}
      <Button variant="plaster" disabled={pending || !text.trim()} onClick={() => match(text)}>
        {pending ? "Reading…" : "Match"}
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
