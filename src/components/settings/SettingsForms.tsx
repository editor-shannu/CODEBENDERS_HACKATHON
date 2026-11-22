"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, inputClass, labelClass } from "@/components/ui/Button";
import { deleteBill, deleteKeyDate, resetDemo, saveBill, saveKeyDate, saveSettings } from "@/app/actions";
import { formatINR } from "@/lib/money";

type S = { tutorName: string; centreName: string; upiId: string; upiName: string; startingBalance: number; autonomy: string };

const AUTONOMY = [
  { id: "SUGGEST", label: "Suggest", hint: "Munshi only suggests" },
  { id: "ASK", label: "Ask", hint: "Drafts, you approve" },
  { id: "AUTO", label: "Auto", hint: "Gentle reminders on its own" },
];

export function SettingsForm({ s }: { s: S }) {
  const [v, setV] = useState(s);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const field = (k: keyof S, label: string, numeric = false) => (
    <div>
      <label className={labelClass} htmlFor={k}>{label}</label>
      <input id={k} className={inputClass} inputMode={numeric ? "numeric" : undefined} value={String(v[k])} onChange={(e) => setV({ ...v, [k]: numeric ? e.target.value.replace(/[^\d-]/g, "") : e.target.value })} />
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {field("tutorName", "Tutor name")}
        {field("centreName", "Centre name")}
        {field("upiId", "UPI ID")}
        {field("upiName", "UPI display name")}
        {field("startingBalance", "Cash in hand today (₹)", true)}
      </div>
      <div>
        <p className={labelClass}>Munshi autonomy</p>
        <div className="grid grid-cols-3 border border-dusk-deep/25">
          {AUTONOMY.map((a) => (
            <button key={a.id} onClick={() => setV({ ...v, autonomy: a.id })} className={`min-h-12 border-r border-dusk-deep/15 px-2 text-left last:border-r-0 ${v.autonomy === a.id ? "bg-dusk-deep text-plaster" : ""}`}>
              <span className="block font-mono text-xs font-semibold uppercase tracking-widest">{a.label}</span>
              <span className="block text-[11px] opacity-70">{a.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={pending} onClick={() => start(async () => { const r = await saveSettings({ ...v, startingBalance: Number(v.startingBalance) || 0 }); setMsg(r.ok ? r.message ?? "Saved" : r.error); })}>Save settings</Button>
        {msg && <span className="font-mono text-xs">{msg}</span>}
      </div>
    </div>
  );
}

export function BillsEditor({ bills }: { bills: { id: string; name: string; amount: number; dueDay: number; flexible: boolean }[] }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [flexible, setFlexible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-dusk-deep/10 border border-dusk-deep/15">
        {bills.map((b) => (
          <li key={b.id} className="flex items-center justify-between px-3 py-2 font-mono text-sm">
            <span>{b.name} · day {b.dueDay}{b.flexible ? " · flexible" : ""}</span>
            <span className="flex items-center gap-3">{formatINR(b.amount)}<button className="text-[11px] uppercase text-brick" disabled={pending} onClick={() => start(async () => void (await deleteBill(b.id)))}>Remove</button></span>
          </li>
        ))}
        {!bills.length && <li className="px-3 py-2 text-sm text-dusk-deep/60">No bills yet. Add rent so Munshi can protect it.</li>}
      </ul>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <input aria-label="Bill name" className={`${inputClass} col-span-2`} placeholder="e.g. Rent" value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="Amount" inputMode="numeric" className={inputClass} placeholder="₹" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        <input aria-label="Due day" inputMode="numeric" className={inputClass} placeholder="Day" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ""))} />
        <label className="flex items-center gap-2 font-mono text-xs"><input type="checkbox" checked={flexible} onChange={(e) => setFlexible(e.target.checked)} /> Flexible</label>
      </div>
      {error && <p className="font-mono text-sm text-brick">{error}</p>}
      <Button variant="plaster" disabled={pending} onClick={() => start(async () => { const r = await saveBill({ name, amount, dueDay, flexible }); if (!r.ok) return setError(r.error); setName(""); setAmount(""); setError(null); })}>Add bill</Button>
    </div>
  );
}

export function KeyDatesEditor({ dates }: { dates: { id: string; name: string; start: string; end: string; label: string; factor: number }[] }) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [factor, setFactor] = useState("0.6");
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-dusk-deep/10 border border-dusk-deep/15">
        {dates.map((d) => (
          <li key={d.id} className="flex items-center justify-between px-3 py-2 font-mono text-sm">
            <span>{d.name} · {d.label}</span>
            <span className="flex items-center gap-3">{Math.round(d.factor * 100)}% collections<button className="text-[11px] uppercase text-brick" disabled={pending} onClick={() => run(async () => void (await deleteKeyDate(d.id)))}>Remove</button></span>
          </li>
        ))}
        {!dates.length && <li className="px-3 py-2 text-sm text-dusk-deep/60">Add festivals and exams that slow down payments.</li>}
      </ul>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <input aria-label="Name" className={inputClass} placeholder="e.g. Sankranti" value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="Start" type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
        <input aria-label="End" type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
        <select aria-label="Collections" className={inputClass} value={factor} onChange={(e) => setFactor(e.target.value)}>
          <option value="0.4">Slow (40%)</option>
          <option value="0.6">Slower (60%)</option>
          <option value="0.8">Bit slower (80%)</option>
        </select>
      </div>
      {error && <p className="font-mono text-sm text-brick">{error}</p>}
      <Button variant="plaster" disabled={pending} onClick={() => run(async () => { const r = await saveKeyDate({ name, start, end, factor: Number(factor) }); if (!r.ok) return setError(r.error); setName(""); setStart(""); setEnd(""); setError(null); })}>Add key date</Button>
    </div>
  );
}

export function ResetDemoButton() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (!confirm("Reset all data to the demo centre, dated from today?")) return;
          start(async () => { const r = await resetDemo(); setMsg(r.ok ? r.message ?? "Reset" : r.error); router.refresh(); });
        }}
      >
        {pending ? "Resetting…" : "Reset demo data"}
      </Button>
      {msg && <span className="font-mono text-xs">{msg}</span>}
    </div>
  );
}
