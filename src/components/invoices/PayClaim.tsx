"use client";

import { useState, useTransition } from "react";
import { Button, inputClass, labelClass } from "@/components/ui/Button";
import { submitClaim } from "@/app/actions";

export function PayClaim({ token, balance, upi }: { token: string; balance: number; upi: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(balance));
  const [reference, setReference] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (msg) return <p className="border border-lamp p-4 text-center font-mono text-sm text-dusk-deep">{msg}</p>;
  return (
    <div className="space-y-3">
      <a href={upi} className="flex min-h-12 w-full items-center justify-center border border-brick bg-brick font-mono text-xs font-semibold uppercase tracking-[0.12em] text-plaster md:hidden">
        Pay with UPI app
      </a>
      {!open ? (
        <Button variant="lamp" className="w-full" onClick={() => setOpen(true)}>I&apos;ve paid</Button>
      ) : (
        <div className="space-y-3 border-t border-dusk-deep/15 pt-3">
          <div>
            <label className={labelClass} htmlFor="amt">Amount paid (₹)</label>
            <input id="amt" inputMode="numeric" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className={labelClass} htmlFor="utr">UPI reference / UTR</label>
            <input id="utr" className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="12-digit number from your UPI app" />
          </div>
          {error && <p className="font-mono text-sm text-brick">{error}</p>}
          <Button
            variant="lamp"
            className="w-full"
            disabled={pending}
            onClick={() => start(async () => { setError(null); const r = await submitClaim({ token, amount: Number(amount), reference }); if (!r.ok) return setError(r.error); setMsg(r.message ?? "Thank you!"); })}
          >
            {pending ? "Sending…" : "Tell the teacher"}
          </Button>
        </div>
      )}
    </div>
  );
}
