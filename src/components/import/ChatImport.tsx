"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, inputClass, labelClass } from "@/components/ui/Button";
import { analyzeChatAction, importChatAction, type AnalyzeResult } from "@/app/import-actions";
import { formatINR } from "@/lib/money";

type Ok = Extract<AnalyzeResult, { ok: true }>;
type Row = { include: boolean; parentName: string; language: "te" | "en" | "hi"; dueDay: number; kids: { name: string; batch: string; fee: number }[]; payments: { date: string; amount: number }[]; promiseText: string | null; promiseAt: string | null; messages: number };

const toRows = (a: Ok): Row[] =>
  a.candidates.map((c) => ({
    include: c.messages >= 1,
    parentName: c.parentName,
    language: c.language,
    dueDay: 5,
    kids: c.kids.map((k, i) => ({ name: k.name, batch: k.batch, fee: c.fees[i] ?? 1500 })),
    payments: c.payments.map((p) => ({ date: p.date, amount: p.amount })),
    promiseText: c.promiseText,
    promiseAt: c.promiseAt,
    messages: c.messages,
  }));

/** WhatsApp group → families in one go. The tutor only checks names, children and fees. */
export function ChatImport({ initialText = "" }: { initialText?: string }) {
  const [text, setText] = useState(initialText);
  const [an, setAn] = useState<Ok | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const analyze = (t: string, tutor?: string) =>
    start(async () => {
      setErr(null);
      const r = await analyzeChatAction(t, tutor);
      if (!r.ok) { setErr(r.error); return; }
      setAn(r);
      setRows(toRows(r));
    });

  const setRow = (i: number, p: Partial<Row>) => setRows((all) => all.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const setKid = (i: number, k: number, p: Partial<Row["kids"][number]>) => setRows((all) => all.map((r, j) => (j === i ? { ...r, kids: r.kids.map((x, n) => (n === k ? { ...x, ...p } : x)) } : r)));

  if (done) {
    return (
      <div className="space-y-3">
        <p className="font-display text-3xl">Imported.</p>
        <p className="text-sm">{done}</p>
        <div className="flex gap-2">
          <Link href="/owes" className="inline-flex min-h-11 items-center border border-dusk-deep bg-dusk-deep px-4 font-mono text-[11px] uppercase tracking-widest text-plaster">See who owes</Link>
          <Link href="/students" className="inline-flex min-h-11 items-center border border-dusk-deep/40 px-4 font-mono text-[11px] uppercase tracking-widest">Students</Link>
        </div>
      </div>
    );
  }

  if (!an) {
    return (
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Open your parents&apos; WhatsApp group.</li>
          <li>Tap ⋮ → More → <b>Export chat</b> → <b>Without media</b>.</li>
          <li>Share it to Baaki (installed app), or save the .txt and pick it here.</li>
        </ol>
        <div>
          <label className={labelClass} htmlFor="chatfile">Chat file (.txt)</label>
          <input
            id="chatfile"
            type="file"
            accept=".txt,text/plain"
            className="block w-full text-sm file:mr-3 file:min-h-10 file:border file:border-dusk-deep file:bg-transparent file:px-3 file:font-mono file:text-[11px] file:uppercase"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.name.endsWith(".zip")) { setErr("That's a .zip. Open it and pick the .txt inside, or export again Without media."); return; }
              const t = await f.text();
              setText(t);
              analyze(t);
            }}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="chattext">…or paste the chat</label>
          <textarea id="chattext" rows={6} className={`${inputClass} font-mono text-xs`} value={text} onChange={(e) => setText(e.target.value)} placeholder={"03/11/26, 9:12 am - Srinivasa Rao: Madam fee sent 2200 by phonepe for Pranav"} />
        </div>
        {err && <p role="alert" className="font-mono text-xs text-brick">{err}</p>}
        <Button disabled={pending || text.length < 20} onClick={() => analyze(text)}>{pending ? "Munshi is reading…" : "Read the chat"}</Button>
      </div>
    );
  }

  const chosen = rows.filter((r) => r.include);
  const payCount = chosen.reduce((s, r) => s + r.payments.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <p className="text-sm">
          {an.candidates.length} parents found, {an.range.from} to {an.range.to}
          {an.ai ? " · children read by Munshi AI" : ""}.
        </p>
        <div className="min-w-48">
          <label className={labelClass} htmlFor="me">Which one is you?</label>
          <select id="me" className={inputClass} value={an.tutor ?? ""} onChange={(e) => analyze(text, e.target.value)}>
            {an.senders.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.count})</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className={`border p-3 ${r.include ? "border-dusk-deep/30" : "border-dusk-deep/10 opacity-50"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <input type="checkbox" aria-label={`Import ${r.parentName}`} checked={r.include} onChange={(e) => setRow(i, { include: e.target.checked })} className="h-5 w-5 accent-[#b3302b]" />
              <input aria-label="Parent name" className={`${inputClass} max-w-xs font-display text-lg`} value={r.parentName} onChange={(e) => setRow(i, { parentName: e.target.value })} />
              <span className="font-mono text-[11px] text-dusk-deep/60">{r.messages} messages</span>
            </div>
            {r.include && (
              <div className="mt-2 space-y-2 pl-8">
                {r.kids.map((k, n) => (
                  <div key={n} className="grid grid-cols-[1fr_8rem_6rem] gap-2">
                    <input aria-label="Child name" className={inputClass} value={k.name} placeholder="Child's name" onChange={(e) => setKid(i, n, { name: e.target.value })} />
                    <input aria-label="Class" className={inputClass} value={k.batch} placeholder="Class" onChange={(e) => setKid(i, n, { batch: e.target.value })} />
                    <input aria-label="Fee per month" type="number" className={inputClass} value={k.fee} onChange={(e) => setKid(i, n, { fee: Number(e.target.value) })} />
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                  {r.kids.length < 4 && <button type="button" className="uppercase tracking-widest text-brick" onClick={() => setRow(i, { kids: [...r.kids, { name: "", batch: r.kids[0]?.batch ?? "", fee: r.kids[0]?.fee ?? 1500 }] })}>+ child</button>}
                  <label className="flex items-center gap-1">due day <input type="number" min={1} max={28} className="w-14 border border-dusk-deep/30 bg-transparent px-1" value={r.dueDay} onChange={(e) => setRow(i, { dueDay: Number(e.target.value) })} /></label>
                  {r.payments.length > 0 && <span className="text-[#2f6b3a]">Paid {r.payments.length}× · last {formatINR(r.payments[r.payments.length - 1].amount)} on {r.payments[r.payments.length - 1].date}</span>}
                  {r.promiseText && <span className="text-brick">Promise: “{r.promiseText.slice(0, 60)}”</span>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {err && <p role="alert" className="font-mono text-xs text-brick">{err}</p>}
      <div className="sticky bottom-20 flex flex-wrap items-center gap-3 border border-dusk-deep/20 bg-plaster p-3">
        <Button
          disabled={pending || !chosen.length}
          onClick={() =>
            start(async () => {
              setErr(null);
              const res = await importChatAction(chosen.map(({ include: _i, messages: _m, ...r }) => ({ ...r, kids: r.kids.filter((k) => k.name.trim()) })));
              if (!res.ok) { setErr(res.error); return; }
              setDone(`${res.families} families and ${res.students} students added, ${res.payments} payments recorded from the chat, ${res.promises} promises tracked.`);
            })
          }
        >
          {pending ? "Saving…" : `Import ${chosen.length} families`}
        </Button>
        <span className="font-mono text-[11px] text-dusk-deep/60">{payCount} payments from the last 3 months will be recorded.</span>
        <button type="button" className="ml-auto font-mono text-[11px] uppercase tracking-widest" onClick={() => { setAn(null); setRows([]); }}>Start over</button>
      </div>
    </div>
  );
}
