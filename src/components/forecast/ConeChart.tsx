"use client";

import { Area, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { ForecastPoint } from "@/lib/forecast";
import { formatINR, formatINRShort } from "@/lib/money";

const fmtDay = (k: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${k}T00:00:00Z`));

export function ConeChart({
  points,
  ghost,
  rentDate,
  keyDates = [],
  mini = false,
  height = 280,
}: {
  points: ForecastPoint[];
  ghost?: ForecastPoint[];
  rentDate?: string;
  keyDates?: { name: string; start: string; end: string }[];
  mini?: boolean;
  height?: number;
}) {
  const data = points.map((p, i) => ({
    date: p.date,
    band: [p.p10, p.p90] as [number, number],
    p50: p.p50,
    p10: p.p10,
    p90: p.p90,
    gBand: ghost ? ([ghost[i].p10, ghost[i].p90] as [number, number]) : undefined,
    g50: ghost ? ghost[i].p50 : undefined,
  }));
  const first = points[0]?.date, last = points[points.length - 1]?.date;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={mini ? { top: 4, right: 0, left: 0, bottom: 0 } : { top: 10, right: 8, left: 0, bottom: 0 }}>
          {!mini && <CartesianGrid stroke="#0E0E0E" strokeOpacity={0.08} vertical={false} />}
          {!mini && (
            <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontFamily: "var(--font-plex-mono)", fontSize: 11, fill: "#0E0E0E" }} interval={13} tickLine={false} axisLine={{ stroke: "#0E0E0E", strokeOpacity: 0.3 }} />
          )}
          {!mini && (
            <YAxis tickFormatter={(v: number) => formatINRShort(v)} tick={{ fontFamily: "var(--font-plex-mono)", fontSize: 11, fill: "#0E0E0E" }} width={56} tickLine={false} axisLine={false} />
          )}
          {mini && <XAxis dataKey="date" hide />}
          {mini && <YAxis hide domain={["dataMin", "dataMax"]} />}
          {keyDates
            .filter((k) => k.end >= first && k.start <= last)
            .map((k) => (
              <ReferenceArea key={k.name} x1={k.start < first ? first : k.start} x2={k.end > last ? last : k.end} fill="#E2A529" fillOpacity={0.18} ifOverflow="hidden" label={mini ? undefined : { value: k.name.replace(" holidays", ""), position: "insideTop", fontSize: 10, fill: "#7a5a10" }} />
            ))}
          <ReferenceLine y={0} stroke="#B3262D" strokeWidth={1.5} />
          {rentDate && <ReferenceLine x={rentDate} stroke="#B3262D" strokeDasharray="4 3" label={mini ? undefined : { value: "Rent", position: "insideTopRight", fontSize: 11, fill: "#B3262D" }} />}
          {ghost && <Area dataKey="gBand" stroke="none" fill="#3FB68B" fillOpacity={0.12} isAnimationActive={false} />}
          <Area dataKey="band" stroke="none" fill="#0E0E0E" fillOpacity={0.14} isAnimationActive={false} />
          <Line dataKey="p90" stroke="#0E0E0E" strokeOpacity={0.35} strokeWidth={1} dot={false} isAnimationActive={false} />
          <Line dataKey="p10" stroke="#B3262D" strokeOpacity={0.6} strokeWidth={1} dot={false} isAnimationActive={false} />
          <Line dataKey="p50" stroke="#0E0E0E" strokeWidth={2} dot={false} isAnimationActive={false} />
          {ghost && <Line dataKey="g50" stroke="#1f7a55" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />}
          {!mini && (
            <Tooltip
              contentStyle={{ background: "#F3EAD7", border: "1px solid #0E0E0E", borderRadius: 0, fontFamily: "var(--font-plex-mono)", fontSize: 12 }}
              labelFormatter={(l) => fmtDay(String(l))}
              formatter={(v, name) => {
                const label = name === "p50" ? "Likely" : name === "p10" ? "Worst" : name === "p90" ? "Best" : name === "g50" ? "What-if" : null;
                if (!label) return [null, null] as unknown as [string, string];
                return [formatINR(Number(v)), label];
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
