"use client";

import { useState, useTransition } from "react";
import { Button, inputClass, labelClass } from "@/components/ui/Button";
import { approveJoinRequest, rejectJoinRequest } from "@/app/join-actions";
import { waLink } from "@/lib/messages";

export type JoinRow = { id: string; parentName: string; note: string; createdAt: string; kids: { name: string; batch: string; fee: number }[] };

/** Join link to share in the parents' WhatsApp group, plus the requests waiting for approval. */
export function JoinInbox({ url, qr, centre, rows }: { url: string; qr: string; centre: string; rows: JoinRow[] }) {
  const [copied, setCopied] = useState(false);
  const share = `Namaste! To join ${centre} or update your child's details, please fill this 20-second form: ${url}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR code for the join link" width={120} height={120} className="border border-dusk-deep/20" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm">Drop this link in your parents&apos; WhatsApp group. Each parent adds their own child, and you just approve.</p>
          <p className="truncate font-mono text-xs text-dusk-deep/70">{url}</p>
          <div className="flex flex-wrap gap-2">
            <a href={waLink(share)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center border border-dusk-deep bg-dusk-deep px-3 font-mono text-[11px] uppercase tracking-widest text-plaster">Share on WhatsApp</a>
            <Button variant="ghost" onClick={async () => { await navigator.clipboard.writeText(url).catch(() => {}); setCopied(true); }}>{copied ? "Copied" : "Copy link"}</Button>
          </div>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="space-y-3">
          <p className={labelClass}>Waiting for you · {rows.length}</p>
          {rows.map((r) => <Row key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}

function Row({ r }: { r: JoinRow }) {
  const [fees, setFees] = useState(r.kids.map((k) => k.fee));
  const [dueDay, setDue] = useState(5);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="border border-dusk-deep/20 p-3">
      <p className="font-display text-xl">{r.parentName}</p>
      {r.note && <p className="text-xs text-dusk-deep/60">“{r.note}”</p>}
      <div className="mt-2 space-y-2">
        {r.kids.map((k, i) => (
          <div key={i} className="grid grid-cols-[1fr_7rem] items-end gap-2">
            <p className="text-sm">{k.name} <span className="font-mono text-[11px] text-dusk-deep/60">· {k.batch}</span></p>
            <div>
              <label className={labelClass} htmlFor={`f-${r.id}-${i}`}>Fee ₹/month</label>
              <input id={`f-${r.id}-${i}`} type="number" inputMode="numeric" className={inputClass} value={fees[i]} onChange={(e) => setFees((a) => a.map((x, j) => (j === i ? Number(e.target.value) : x)))} />
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_7rem] items-end gap-2">
          <span className="text-xs text-dusk-deep/60">Fee prefilled from what others in the class pay.</span>
          <div>
            <label className={labelClass} htmlFor={`d-${r.id}`}>Due day</label>
            <input id={`d-${r.id}`} type="number" min={1} max={28} className={inputClass} value={dueDay} onChange={(e) => setDue(Number(e.target.value))} />
          </div>
        </div>
      </div>
      {err && <p role="alert" className="mt-2 font-mono text-xs text-brick">{err}</p>}
      <div className="mt-3 flex gap-2">
        <Button disabled={pending} onClick={() => start(async () => { const x = await approveJoinRequest({ id: r.id, fees, dueDay }); if (!x.ok) setErr(x.error); })}>{pending ? "Adding…" : "Approve"}</Button>
        <Button variant="ghost" disabled={pending} onClick={() => start(async () => { await rejectJoinRequest(r.id); })}>Not mine</Button>
      </div>
    </div>
  );
}
