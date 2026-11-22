"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { confirmClaim, generateMonthInvoices, rejectClaim } from "@/app/actions";

export function GenerateInvoicesButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="font-mono text-xs text-ledger/70">{msg}</span>}
      <Button disabled={pending} onClick={() => start(async () => { const r = await generateMonthInvoices(); setMsg(r.ok ? r.message ?? "Done" : r.error); })}>
        {pending ? "Generating…" : "Generate this month"}
      </Button>
    </div>
  );
}

export function ClaimButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button variant="mint" className="min-h-9 px-3" disabled={pending} onClick={() => start(async () => void (await confirmClaim(id)))}>Confirm</Button>
      <Button variant="danger" className="min-h-9 px-3" disabled={pending} onClick={() => start(async () => void (await rejectClaim(id)))}>Reject</Button>
    </div>
  );
}

export function PrintButton() {
  return <Button variant="ink" className="no-print" onClick={() => window.print()}>Download PDF</Button>;
}

export function CopyButton({ text, label = "Copy pay link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button variant="ghost" className="no-print" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? "Copied" : label}
    </Button>
  );
}
