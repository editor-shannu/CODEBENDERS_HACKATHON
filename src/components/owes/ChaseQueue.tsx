"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { RemindSheet } from "@/components/actions/RemindButton";
import { Button } from "@/components/ui/Button";
import type { ReminderPayload } from "@/lib/data";

export type QueueCard = {
  familyId: string;
  parent: string;
  kids: string;
  amount: string;
  days: number;
  tone: string;
  promise: string;
  chaseScore: number;
  bestTime?: string;
  payload: ReminderPayload;
};

export function ChaseQueue({ cards }: { cards: QueueCard[] }) {
  const [queue, setQueue] = useState(cards);
  const [dx, setDx] = useState(0);
  const [remindFor, setRemindFor] = useState<QueueCard | null>(null);
  const startX = useRef<number | null>(null);
  const top = queue[0];

  const snooze = () => setQueue((q) => [...q.slice(1), q[0]]);
  const done = () => setQueue((q) => q.slice(1));

  if (!top)
    return (
      <div className="ruled-paper border border-ink/15 p-6 text-center text-ink">
        <p className="font-display text-2xl">Queue clear.</p>
        <p className="text-sm text-ink/70">Everyone has been chased today.</p>
      </div>
    );

  const onUp = () => {
    if (dx > 90) setRemindFor(top);
    else if (dx < -90) snooze();
    setDx(0);
    startX.current = null;
  };

  return (
    <div>
      <div className="relative h-[230px]">
        {queue.slice(1, 3).map((c, i) => (
          <div key={c.familyId} className="ruled-paper absolute inset-0 border border-ink/15" style={{ transform: `translateY(${(i + 1) * 8}px) scale(${1 - (i + 1) * 0.03})`, opacity: 0.6 - i * 0.2 }} />
        ))}
        <div
          className="swipe-card ruled-paper absolute inset-0 cursor-grab border border-ink/20 p-5 text-ink active:cursor-grabbing"
          style={{ transform: `translateX(${dx}px) rotate(${dx / 30}deg)`, transition: startX.current === null ? "transform .2s" : "none" }}
          onPointerDown={(e) => { startX.current = e.clientX; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
          onPointerMove={(e) => startX.current !== null && setDx(e.clientX - startX.current)}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {dx > 40 && <span className="absolute right-4 top-4 -rotate-6 border-2 border-mint px-2 font-mono text-xs font-bold tracking-widest text-mint">REMIND</span>}
          {dx < -40 && <span className="absolute left-14 top-4 rotate-6 border-2 border-ink/50 px-2 font-mono text-xs font-bold tracking-widest text-ink/60">SNOOZE</span>}
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/60">Chase score {top.chaseScore} · {queue.length} in queue</p>
          <Link href={`/families/${top.familyId}`} className="mt-1 block font-display text-3xl leading-tight">{top.parent}</Link>
          <p className="text-sm text-ink/70">for {top.kids}</p>
          <p className="big-number mt-3 text-5xl text-khata">{top.amount}</p>
          <p className="mt-2 font-mono text-xs">
            {top.days} days late · suggested <strong>{top.tone.toLowerCase()}</strong> · {top.promise}
          </p>
          {top.bestTime && <p className="font-mono text-xs text-ink/60">Best time: {top.bestTime}</p>}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Button variant="ghost" className="text-ledger" onClick={snooze}>← Snooze</Button>
        <Button variant="ghost" className="text-ledger" onClick={done}>Skip</Button>
        <Button onClick={() => setRemindFor(top)}>Remind →</Button>
      </div>
      <p className="mt-2 text-center font-mono text-[11px] text-ledger/50">Swipe right to remind, left to snooze</p>
      {remindFor && <RemindSheet key={remindFor.familyId} p={remindFor.payload} open onClose={() => setRemindFor(null)} onSent={done} />}
    </div>
  );
}
