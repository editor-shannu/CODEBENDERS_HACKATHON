"use client";

import { useState, useTransition } from "react";
import { Button, inputClass, labelClass } from "@/components/ui/Button";
import { submitJoinRequest } from "@/app/join-actions";

const LANGS = [
  { id: "te", label: "తెలుగు" },
  { id: "en", label: "English" },
  { id: "hi", label: "हिंदी" },
];

/** Public form a parent fills from the tutor's WhatsApp link. No account, no phone number stored. */
export function JoinForm({ code, batches }: { code: string; batches: string[] }) {
  const [parentName, setParent] = useState("");
  const [language, setLang] = useState("te");
  const [kids, setKids] = useState([{ name: "", batch: "" }]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (msg?.ok) {
    return (
      <div className="text-center">
        <p className="font-display text-3xl">Thank you!</p>
        <p className="mt-2 text-sm text-dusk-deep/70">{msg.text}</p>
      </div>
    );
  }

  const setKid = (i: number, k: Partial<{ name: string; batch: string }>) => setKids((all) => all.map((x, j) => (j === i ? { ...x, ...k } : x)));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await submitJoinRequest({ code, parentName, language, kids: kids.filter((k) => k.name.trim()), note });
          setMsg(r.ok ? { ok: true, text: r.message ?? "Sent" } : { ok: false, text: r.error });
        });
      }}
    >
      <div>
        <label className={labelClass} htmlFor="jp">Parent&apos;s name</label>
        <input id="jp" className={inputClass} value={parentName} onChange={(e) => setParent(e.target.value)} placeholder="e.g. Srinivasa Rao" autoComplete="name" required />
      </div>
      {kids.map((k, i) => (
        <div key={i} className="grid grid-cols-[1fr_9rem] gap-2">
          <div>
            <label className={labelClass} htmlFor={`jk${i}`}>Child {kids.length > 1 ? i + 1 : ""}</label>
            <input id={`jk${i}`} className={inputClass} value={k.name} onChange={(e) => setKid(i, { name: e.target.value })} placeholder="Child's name" required={i === 0} />
          </div>
          <div>
            <label className={labelClass} htmlFor={`jb${i}`}>Class</label>
            <input id={`jb${i}`} list="join-batches" className={inputClass} value={k.batch} onChange={(e) => setKid(i, { batch: e.target.value })} placeholder="e.g. Class 8" required={i === 0} />
          </div>
        </div>
      ))}
      <datalist id="join-batches">{batches.map((b) => <option key={b} value={b} />)}</datalist>
      {kids.length < 4 && (
        <button type="button" className="font-mono text-[11px] uppercase tracking-widest text-brick" onClick={() => setKids((a) => [...a, { name: "", batch: "" }])}>
          + Add another child
        </button>
      )}
      <div>
        <span className={labelClass}>Messages in</span>
        <div className="flex gap-2">
          {LANGS.map((l) => (
            <button key={l.id} type="button" onClick={() => setLang(l.id)} className={`min-h-10 flex-1 border px-2 text-sm ${language === l.id ? "border-dusk-deep bg-dusk-deep text-plaster" : "border-dusk-deep/30"}`}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="jn">Anything the tutor should know (optional)</label>
        <input id="jn" className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Pays after the 10th" maxLength={200} />
      </div>
      {msg && !msg.ok && <p role="alert" className="font-mono text-xs text-brick">{msg.text}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Sending…" : "Join the class"}</Button>
      <p className="text-center text-[11px] text-dusk-deep/60">No account needed. Your tutor confirms the fee before anything is due.</p>
    </form>
  );
}
