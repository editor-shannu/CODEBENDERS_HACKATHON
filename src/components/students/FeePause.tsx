"use client";

import { useState, useTransition } from "react";
import { setStudentPause } from "@/app/actions";

/** Fee Pause: toggle the next few months off for one student; no invoice is generated for a paused month. */
export function FeePause({ studentId, paused, months }: { studentId: string; paused: string[]; months: { key: string; label: string }[] }) {
  const [sel, setSel] = useState<string[]>(paused);
  const [pending, start] = useTransition();
  const toggle = (k: string) => {
    const next = sel.includes(k) ? sel.filter((m) => m !== k) : [...sel, k];
    setSel(next);
    start(async () => void (await setStudentPause(studentId, next)));
  };
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-dusk-deep/50">Pause</span>
      {months.map((m) => (
        <button key={m.key} disabled={pending} onClick={() => toggle(m.key)} aria-pressed={sel.includes(m.key)} className={`min-h-7 border px-2 font-mono text-[10px] ${sel.includes(m.key) ? "border-dusk-deep bg-dusk-deep text-plaster" : "border-dusk-deep/25"}`}>
          {m.label}
        </button>
      ))}
    </div>
  );
}
