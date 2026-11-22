"use client";

import { useEffect, type ReactNode } from "react";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-dusk-deep/60" aria-label="Close" onClick={onClose} />
      <div className="sheet-in bg-plaster relative max-h-[90dvh] w-full max-w-lg overflow-y-auto border-t-4 border-slate-mute p-5 text-dusk-deep md:border">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl leading-tight">{title}</h2>
          <button onClick={onClose} className="min-h-11 min-w-11 font-mono text-xs uppercase tracking-widest text-dusk-deep/60" aria-label="Close">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
