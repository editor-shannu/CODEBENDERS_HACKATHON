"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button, labelClass } from "@/components/ui/Button";
import { reminderText, waLink } from "@/lib/messages";
import type { Tone } from "@/lib/family-stats";
import type { ReminderPayload } from "@/lib/data";
import { logReminder } from "@/app/actions";

const TONES: { id: Tone; label: string; hint: string }[] = [
  { id: "GENTLE", label: "Gentle", hint: "Friendly nudge" },
  { id: "FIRM", label: "Firm", hint: "Clear date" },
  { id: "FINAL", label: "Final", hint: "Last reminder" },
];
const LANGS = [
  { id: "te", label: "తెలుగు" },
  { id: "en", label: "English" },
  { id: "hi", label: "हिंदी" },
];

export function RemindButton({ p, label = "Remind", variant = "primary", className = "", onSent }: { p: ReminderPayload; label?: string; variant?: "primary" | "ghost" | "ink"; className?: string; onSent?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <RemindSheet p={p} open={open} onClose={() => setOpen(false)} onSent={onSent} />
    </>
  );
}

export function RemindSheet({ p, open, onClose, onSent }: { p: ReminderPayload; open: boolean; onClose: () => void; onSent?: () => void }) {
  const [tone, setTone] = useState<Tone>(p.suggestedTone);
  const [lang, setLang] = useState(p.language);
  const [pending, start] = useTransition();

  const link = typeof window !== "undefined" && p.token ? `${window.location.origin}/pay/${p.token}` : `/pay/${p.token ?? ""}`;
  const text = reminderText(lang, tone, { parent: p.parent, kids: p.kids, centre: p.centre, tutor: p.tutor, amount: p.amount, months: p.months, days: p.days, by: p.by, link });

  const send = () => {
    window.open(waLink(text), "_blank", "noopener");
    start(async () => {
      await logReminder(p.familyId, tone, lang);
      onClose();
      onSent?.();
    });
  };

  return (
      <Sheet open={open} onClose={onClose} title={`Remind ${p.parent}`}>
        <p className={labelClass}>Tone dial</p>
        <div className="mb-1 grid grid-cols-3 border border-ink/25">
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={`min-h-12 border-r border-ink/15 px-2 text-left last:border-r-0 ${tone === t.id ? (t.id === "FINAL" ? "bg-khata text-ledger" : t.id === "FIRM" ? "bg-turmeric" : "bg-ink text-ledger") : ""}`}
            >
              <span className="block font-mono text-xs font-semibold uppercase tracking-widest">{t.label}</span>
              <span className="block text-[11px] opacity-70">{t.hint}</span>
            </button>
          ))}
        </div>
        {tone !== p.suggestedTone && <p className="mb-3 font-mono text-[11px] text-ink/60">Baaki suggests {p.suggestedTone.toLowerCase()} for this family.</p>}
        {tone === p.suggestedTone && <p className="mb-3 font-mono text-[11px] text-ink/60">Suggested from payment history and promises.</p>}

        <p className={labelClass}>Language</p>
        <div className="mb-4 flex gap-2">
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => setLang(l.id)} className={`min-h-11 flex-1 border px-2 text-sm ${lang === l.id ? "border-ink bg-ink text-ledger" : "border-ink/25"}`}>
              {l.label}
            </button>
          ))}
        </div>

        <p className={labelClass}>Message preview</p>
        <div className="mb-4 whitespace-pre-wrap border border-ink/15 bg-white/60 p-3 text-[15px] leading-relaxed">{text}</div>
        <Button className="w-full" onClick={send} disabled={pending}>
          {pending ? "Opening…" : "Open WhatsApp"}
        </Button>
        <p className="mt-2 text-center font-mono text-[11px] text-ink/50">Opens WhatsApp with this message ready. Pick {p.parent}&apos;s chat and tap send.</p>
      </Sheet>
  );
}
