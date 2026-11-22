"use client";

import { useRef, useState, useTransition } from "react";
import { Button, inputClass, labelClass } from "@/components/ui/Button";
import { RecordPaymentButton } from "@/components/actions/RecordPayment";
import { voiceKhataAction } from "@/app/actions";
import { formatINR } from "@/lib/money";

type Found = Extract<Awaited<ReturnType<typeof voiceKhataAction>>, { ok: true }>;
type Rec = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };

const LANGS = [
  { id: "en-IN", label: "English" },
  { id: "te-IN", label: "తెలుగు" },
  { id: "hi-IN", label: "हिंदी" },
];

/** Speak "Ravi paid 1500 cash" (Web Speech API, en-IN, te-IN or hi-IN) or type it; opens RecordPayment prefilled. */
export function VoiceKhata() {
  const [text, setText] = useState("");
  const [lang, setLang] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const rec = useRef<Rec | null>(null);

  const read = (t: string) =>
    start(async () => {
      setError(null);
      setFound(null);
      const r = await voiceKhataAction(t);
      if (!r.ok) return setError(r.error);
      setFound(r);
    });

  const listen = () => {
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return setError("Voice isn't supported in this browser. Type it instead.");
    if (listening) return rec.current?.stop();
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript ?? "";
      setText(t);
      if (t) read(t);
    };
    r.onerror = () => setError("Couldn't hear that. Try again or type it.");
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {LANGS.map((l) => (
          <button key={l.id} onClick={() => setLang(l.id)} className={`min-h-9 flex-1 border px-2 text-sm ${lang === l.id ? "border-dusk-deep bg-dusk-deep text-plaster" : "border-dusk-deep/25"}`}>{l.label}</button>
        ))}
      </div>
      <Button variant={listening ? "lamp" : "plaster"} className="w-full" onClick={listen}>{listening ? "Listening… tap to stop" : "Tap and speak"}</Button>
      <div>
        <label className={labelClass} htmlFor="vk">Or type it</label>
        <div className="flex gap-2">
          <input id="vk" className={inputClass} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && text.trim() && read(text)} placeholder="Ravi paid 1500 cash" />
          <Button variant="plaster" disabled={pending || !text.trim()} onClick={() => read(text)}>{pending ? "…" : "Go"}</Button>
        </div>
      </div>
      {error && <p className="font-mono text-sm text-brick">{error}</p>}
      {found && (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-dusk-deep/20 bg-white/50 p-3">
          <p className="font-mono text-xs">
            {found.parent} · {found.note.amount ? formatINR(found.note.amount) : "amount?"} · {found.note.mode?.toLowerCase() ?? "mode?"} · owes {formatINR(found.balance)}
          </p>
          {found.balance > 0 ? (
            <RecordPaymentButton familyId={found.familyId} balance={found.balance} today={found.today} title={`Payment from ${found.parent}`} label="Record payment" className="min-h-9 px-3" defaults={{ amount: found.note.amount ?? undefined, mode: found.note.mode ?? "CASH" }} />
          ) : (
            <p className="font-mono text-xs">Nothing due from this family.</p>
          )}
        </div>
      )}
    </div>
  );
}
