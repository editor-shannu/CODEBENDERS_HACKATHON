"use client";

import { Bar, BarChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartData } from "@/lib/munshi/agent";
import { formatINR, formatINRShort } from "@/lib/money";

const fmtDay = (k: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${k}T00:00:00Z`));
const tick = { fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--color-dusk-deep)" };

/** Small chart under an Ask Munshi answer: before vs after cash (run_what_if) or owed by family (get_totals). */
export function AnswerChart({ chart }: { chart: ChartData }) {
  return (
    <figure className="mt-3">
      <figcaption className="mb-1 font-mono text-[11px] uppercase tracking-widest text-dusk-deep/60">{chart.title}</figcaption>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chart.kind === "cash" ? (
            <LineChart data={chart.points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tickFormatter={fmtDay} tick={tick} interval={6} tickLine={false} />
              <YAxis tickFormatter={(v: number) => formatINRShort(v)} tick={tick} width={48} tickLine={false} axisLine={false} />
              <ReferenceLine y={0} stroke="var(--color-brick)" />
              <Tooltip formatter={(v) => formatINR(Number(v))} labelFormatter={(l) => fmtDay(String(l))} />
              <Line dataKey="before" name="Now" stroke="var(--color-dusk-deep)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="after" name="What if" stroke="var(--color-brick)" strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
            </LineChart>
          ) : (
            <BarChart data={chart.bars} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={tick} tickLine={false} interval={0} />
              <YAxis tickFormatter={(v: number) => formatINRShort(v)} tick={tick} width={48} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => formatINR(Number(v))} />
              <Bar dataKey="owed" name="Owed" fill="var(--color-brick)" isAnimationActive={false} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {chart.kind === "cash" && <p className="font-mono text-[10px] text-dusk-deep/50">Solid: now · dashed: what if (likely balance, P50 of 500 runs)</p>}
    </figure>
  );
}
