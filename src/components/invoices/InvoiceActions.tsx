"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { confirmClaim, createSingleInvoice, generateMonthInvoices, issueDrafts, rejectClaim } from "@/app/actions";

export function GenerateInvoicesButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="font-mono text-xs text-plaster/70">{msg}</span>}
      <Button disabled={pending} onClick={() => start(async () => { const r = await generateMonthInvoices(); setMsg(r.ok ? r.message ?? "Done" : r.error); })}>
        {pending ? "Generating…" : "Generate this month"}
      </Button>
    </div>
  );
}

export function IssueDraftsButton({ ids, label = "Issue all" }: { ids?: string[]; label?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="font-mono text-xs text-plaster/70">{msg}</span>}
      <Button variant="lamp" disabled={pending} onClick={() => start(async () => { const r = await issueDrafts({ ids }); setMsg(r.ok ? r.message ?? "Issued" : r.error); })}>
        {pending ? "Issuing…" : label}
      </Button>
    </div>
  );
}

export function ClaimButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button variant="lamp" className="min-h-9 px-3" disabled={pending} onClick={() => start(async () => void (await confirmClaim(id)))}>Confirm</Button>
      <Button variant="danger" className="min-h-9 px-3" disabled={pending} onClick={() => start(async () => void (await rejectClaim(id)))}>Reject</Button>
    </div>
  );
}

export function PrintButton() {
  return <Button variant="plaster" className="no-print" onClick={() => window.print()}>Download PDF</Button>;
}

export function CopyButton({ text, label = "Copy pay link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button variant="ghost" className="no-print" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? "Copied" : label}
    </Button>
  );
}

/** "New invoice": one family, month defaults to the current one; opens the invoice when saved. */
export function NewInvoiceButton({ families, familyId, month }: { families?: { id: string; name: string }[]; familyId?: string; month: string }) {
  const [open, setOpen] = useState(false);
  const [fam, setFam] = useState(familyId ?? "");
  const [m, setM] = useState(month);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!open) return <Button variant="ghost" onClick={() => setOpen(true)}>New invoice</Button>;
  return (
    <div className="flex flex-wrap items-center gap-2 border border-plaster/25 p-2">
      {!familyId && (
        <select aria-label="Family" value={fam} onChange={(e) => setFam(e.target.value)} className="min-h-10 border border-plaster/25 bg-dusk-deep px-2 text-sm text-plaster">
          <option value="">Pick a family</option>
          {families?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      )}
      <input aria-label="Month" type="month" value={m} onChange={(e) => setM(e.target.value)} className="min-h-10 border border-plaster/25 bg-dusk-deep px-2 font-mono text-sm text-plaster" />
      <Button variant="lamp" disabled={pending || !fam} onClick={() => start(async () => {
        const r = await createSingleInvoice({ familyId: fam, month: m });
        if (r.ok && r.id) router.push(`/invoices/${r.id}`);
        else setMsg(r.ok ? "Done" : r.error);
      })}>{pending ? "Creating…" : "Create invoice"}</Button>
      <Button variant="ghost" onClick={() => { setOpen(false); setMsg(null); }}>Cancel</Button>
      {msg && <span className="w-full font-mono text-xs text-plaster/80">{msg}</span>}
    </div>
  );
}
