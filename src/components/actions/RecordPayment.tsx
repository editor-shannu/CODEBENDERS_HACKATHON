"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button, inputClass, labelClass } from "@/components/ui/Button";
import { Stamp } from "@/components/ui/Stamp";
import { recordFamilyPayment, recordPayment } from "@/app/actions";
import { formatINR } from "@/lib/money";

export function RecordPaymentButton({
  invoiceId,
  balance,
  title,
  today,
  label = "Mark paid",
  variant = "lamp",
  className = "",
  familyId,
  onRecorded,
}: {
  invoiceId?: string;
  balance: number;
  title: string;
  today: string;
  label?: string;
  variant?: "lamp" | "ghost" | "plaster" | "primary";
  className?: string;
  /** When set, the payment settles the family's oldest invoices first. */
  familyId?: string;
  onRecorded?: (status: "PAID" | "PARTIAL") => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(balance));
  const [mode, setMode] = useState<"CASH" | "UPI">("UPI");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [stamped, setStamped] = useState<null | "PAID" | "PARTIAL">(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const res = familyId
        ? await recordFamilyPayment({ familyId, amount: Number(amount), mode, reference, date })
        : invoiceId
          ? await recordPayment({ invoiceId, amount: Number(amount), mode, reference, date })
          : ({ ok: false, error: "Nothing to pay" } as const);
      if (!res.ok) return setError(res.error);
      const kind = res.status === "PAID" ? "PAID" : "PARTIAL";
      setStamped(kind);
      setTimeout(() => {
        setOpen(false);
        setStamped(null);
        onRecorded?.(kind);
      }, 1300);
    });

  return (
    <>
      <Button variant={variant} className={className} onClick={() => { setAmount(String(balance)); setOpen(true); }}>
        {label}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        {stamped ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3">
            <Stamp kind={stamped} animate className="text-3xl" />
            <p className="font-mono text-sm">{formatINR(Number(amount))} recorded</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="font-mono text-sm">Balance due: <strong>{formatINR(balance)}</strong></p>
            <div>
              <label className={labelClass} htmlFor="amt">Amount received (₹)</label>
              <input id="amt" inputMode="numeric" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
              <div className="mt-2 flex gap-2">
                <button className="min-h-9 border border-dusk-deep/25 px-3 font-mono text-xs" onClick={() => setAmount(String(balance))}>Full</button>
                <button className="min-h-9 border border-dusk-deep/25 px-3 font-mono text-xs" onClick={() => setAmount(String(Math.round(balance / 2)))}>Half</button>
              </div>
            </div>
            <div>
              <p className={labelClass}>Mode</p>
              <div className="grid grid-cols-2 border border-dusk-deep/25">
                {(["UPI", "CASH"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} className={`min-h-11 font-mono text-xs font-semibold tracking-widest ${mode === m ? "bg-dusk-deep text-plaster" : ""}`}>{m}</button>
                ))}
              </div>
            </div>
            {mode === "UPI" && (
              <div>
                <label className={labelClass} htmlFor="ref">UPI reference (optional)</label>
                <input id="ref" className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="12-digit UTR" />
              </div>
            )}
            <div>
              <label className={labelClass} htmlFor="date">Received on</label>
              <input id="date" type="date" max={today} className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {error && <p className="font-mono text-sm text-brick">{error}</p>}
            <Button variant="lamp" className="w-full" onClick={submit} disabled={pending}>{pending ? "Saving…" : "Record payment"}</Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
