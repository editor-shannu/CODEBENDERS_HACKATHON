"use client";

import { useMemo, useState } from "react";
import { ConeChart } from "./ConeChart";
import { WeatherStrip } from "./Weather";
import { runForecast, type ForecastInput, type WhatIf } from "@/lib/forecast";
import { formatINR } from "@/lib/money";
import { labelClass } from "@/components/ui/Button";

export function TimeMachine({ input, month }: { input: ForecastInput; month: string }) {
  const owing = useMemo(() => [...input.families].filter((f) => f.monthlyTotal > 0).sort((a, b) => b.monthlyTotal - a.monthlyTotal), [input.families]);
  const [who, setWho] = useState<string>("ALL");
  const [delay, setDelay] = useState(0);
  const [lose, setLose] = useState(0);
  const [raise, setRaise] = useState(0);
  const [add, setAdd] = useState(0);

  const base = useMemo(() => runForecast(input), [input]);
  const whatIf: WhatIf = useMemo(
    () => ({
      ...(delay ? { extraDelay: { familyId: who, days: delay } } : {}),
      ...(lose ? { loseStudents: { count: lose, fromMonth: month } } : {}),
      ...(raise ? { feeRaise: { amount: raise, fromMonth: month } } : {}),
      ...(add ? { addStudents: { count: add, fee: 800, fromMonth: month } } : {}),
    }),
    [who, delay, lose, raise, add, month],
  );
  const changed = delay || lose || raise || add;
  const sim = useMemo(() => (changed ? runForecast(input, whatIf) : base), [changed, input, whatIf, base]);
  const end = sim.points[sim.points.length - 1];

  const slider = (label: string, value: number, set: (n: number) => void, min: number, max: number, step: number, fmt: (n: number) => string) => (
    <div>
      <div className="flex justify-between"><span className={labelClass}>{label}</span><span className="font-mono text-xs">{fmt(value)}</span></div>
      <input type="range" className="w-full accent-[#b3302b]" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className={`border p-4 ${sim.rent && sim.rent.risk >= 0.4 ? "border-brick bg-brick text-plaster" : "border-plaster/20"}`}>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-70">Rent risk</p>
          <p className="big-number mt-1 text-5xl">{sim.rent ? `${Math.round(sim.rent.risk * 100)}%` : "–"}</p>
          <p className="mt-1 font-mono text-xs opacity-80">{sim.rent ? `${formatINR(sim.rent.amount)} in ${sim.rent.daysUntil} days` : "Add rent in Settings"}</p>
        </div>
        <div className="border border-plaster/20 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-70">Runway</p>
          <p className="big-number mt-1 text-5xl">{sim.runwayDays >= 90 ? "90+" : sim.runwayDays}</p>
          <p className="mt-1 font-mono text-xs opacity-80">days until the likely balance goes negative</p>
        </div>
        <div className="border border-plaster/20 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-70">In 90 days</p>
          <p className="big-number mt-1 text-4xl">{formatINR(end.p50)}</p>
          <p className="mt-1 font-mono text-xs opacity-80">likely · range {formatINR(end.p10)} to {formatINR(end.p90)}</p>
        </div>
      </div>

      <div className="ruled-paper border border-dusk-deep/15 p-3 text-dusk-deep">
        <ConeChart points={sim.points} ghost={changed ? base.points : undefined} rentDate={sim.rent?.date} keyDates={input.keyDates} height={300} />
        <p className="mt-1 font-mono text-[11px] text-dusk-deep/60">500 simulated futures from each family&apos;s real payment history. Band = 10th to 90th percentile.{changed ? " Faint band = before your changes." : ""}</p>
      </div>

      <div className="ruled-paper space-y-3 border border-dusk-deep/15 p-4 text-dusk-deep">
        <p className="font-display text-2xl">Time Machine</p>
        <div>
          <label className={labelClass} htmlFor="tm-who">Who pays late</label>
          <select id="tm-who" value={who} onChange={(e) => setWho(e.target.value)} className="mt-1 min-h-10 w-full border border-dusk-deep/30 bg-transparent px-2 font-mono text-sm">
            <option value="ALL">Everyone</option>
            {owing.map((f) => (
              <option key={f.id} value={f.id}>{f.name} · {formatINR(f.monthlyTotal)}/month</option>
            ))}
          </select>
          <div className="mt-2 flex flex-wrap gap-2">
            {owing[0] && (
              <button type="button" className="border border-brick px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-brick" onClick={() => { setWho(owing[0].id); setDelay(15); }}>
                Biggest family pays 15 days late
              </button>
            )}
          </div>
        </div>
        {slider(who === "ALL" ? "Everyone pays later by" : "This family pays later by", delay, setDelay, 0, 45, 1, (n) => `${n} days`)}
        {slider("Students leave", lose, setLose, 0, 6, 1, (n) => `${n}`)}
        {slider("Fee raise per student", raise, setRaise, 0, 300, 50, (n) => formatINR(n))}
        {slider("New admissions (₹800 each)", add, setAdd, 0, 6, 1, (n) => `${n}`)}
        {changed ? <button className="font-mono text-[11px] uppercase tracking-widest text-brick" onClick={() => { setWho("ALL"); setDelay(0); setLose(0); setRaise(0); setAdd(0); }}>Reset</button> : null}
      </div>

      <div className="border border-plaster/20 p-4">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] opacity-70">Money weather · next 6 weeks</p>
        <WeatherStrip weeks={sim.weeks} />
      </div>
    </div>
  );
}
