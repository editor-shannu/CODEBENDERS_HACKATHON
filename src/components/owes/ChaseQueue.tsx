"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { RemindSheet } from "@/components/actions/RemindButton";
import { Button } from "@/components/ui/Button";
import { HouseStatus, type HouseState } from "@/components/ui/HouseStatus";
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
  status: HouseState;
};

export function ChaseQueue({ cards }: { cards: QueueCard[] }) {
  const [queue, setQueue] = useState(cards);
  const [dx, setDx] = useState(0);
  const [remindFor, setRemindFor] = useState<QueueCard | null>(null);
  const startX = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const top = queue[0];

  const snooze = () => setQueue((q) => [...q.slice(1), q[0]]);
  const done = () => setQueue((q) => q.slice(1));

  if (!top)
    return (
      <div className="ruled-paper border border-dusk-deep/15 p-6 text-center text-dusk-deep">
        <p className="font-display text-2xl">Queue clear.</p>
        <p className="text-sm text-dusk-deep/70">Everyone has been chased today.</p>
      </div>
    );

  const onUp = () => {
    if (dx > 90) setRemindFor(top);
    else if (dx < -90) snooze();
    setDx(0);
    startX.current = null;
    setDragging(false);
  };

  return (
    <div>
      <div className="relative h-[230px]">
        {queue.slice(1, 3).map((c, i) => (
          <div key={c.familyId} className="ruled-paper absolute inset-0 border border-dusk-deep/15" style={{ transform: `translateY(${(i + 1) * 8}px) scale(${1 - (i + 1) * 0.03})`, opacity: 0.6 - i * 0.2 }} />
        ))}
        <div
          className="swipe-card ruled-paper absolute inset-0 cursor-grab border border-dusk-deep/20 p-5 text-dusk-deep active:cursor-grabbing"
          style={{ transform: `translateX(${dx}px) rotate(${dx / 30}deg)`, transition: dragging ? "none" : "transform .2s" }}
          onPointerDown={(e) => { startX.current = e.clientX; setDragging(true); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
          onPointerMove={(e) => startX.current !== null && setDx(e.clientX - startX.current)}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {dx > 40 && <span className="absolute right-4 top-4 -rotate-6 border-2 border-lamp px-2 font-mono text-xs font-bold tracking-widest text-lamp">REMIND</span>}
          {dx < -40 && <span className="absolute left-14 top-4 rotate-6 border-2 border-dusk-deep/50 px-2 font-mono text-xs font-bold tracking-widest text-dusk-deep/60">SNOOZE</span>}
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-dusk-deep/60">Chase score {top.chaseScore} · {queue.length} in queue</p>
          <Link href={`/families/${top.familyId}`} className="mt-1 flex items-center gap-3 font-display text-3xl leading-tight"><HouseStatus status={top.status} size={36} />{top.parent}</Link>
          <p className="text-sm text-dusk-deep/70">for {top.kids}</p>
          <p className="big-number mt-3 text-5xl text-brick">{top.amount}</p>
          <p className="mt-2 font-mono text-xs">
            {top.days} days late · suggested <strong>{top.tone.toLowerCase()}</strong> · {top.promise}
          </p>
          {top.bestTime && <p className="font-mono text-xs text-dusk-deep/60">Best time: {top.bestTime}</p>}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Button variant="ghost" className="text-plaster" onClick={snooze}>← Snooze</Button>
        <Button variant="ghost" className="text-plaster" onClick={done}>Skip</Button>
        <Button onClick={() => setRemindFor(top)}>Remind →</Button>
      </div>
      <p className="mt-2 text-center font-mono text-[11px] text-plaster/50">Swipe right to remind, left to snooze</p>
      {remindFor && <RemindSheet key={remindFor.familyId} p={remindFor.payload} open onClose={() => setRemindFor(null)} onSent={done} />}
    </div>
  );
}
