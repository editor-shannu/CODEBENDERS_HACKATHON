import { Cloud, CloudLightning, Sun } from "lucide-react";
import type { ForecastResult } from "@/lib/forecast";

const fmt = (k: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${k}T00:00:00Z`));

export function WeatherStrip({ weeks, compact = false }: { weeks: ForecastResult["weeks"]; compact?: boolean }) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {weeks.map((w) => {
        const Icon = w.weather === "STORM" ? CloudLightning : w.weather === "CLOUDY" ? Cloud : Sun;
        const color = w.weather === "STORM" ? "text-brick" : w.weather === "CLOUDY" ? "text-lamp" : "text-lamp";
        return (
          <div key={w.start} className="flex flex-col items-center gap-1 text-center" title={`${w.weather.toLowerCase()} week`}>
            <Icon className={`size-6 ${color}`} strokeWidth={1.75} aria-label={w.weather.toLowerCase()} />
            <span className="font-mono text-[10px] leading-tight opacity-70">{fmt(w.start)}</span>
            {!compact && <span className="font-mono text-[10px] uppercase tracking-wider">{w.weather.toLowerCase()}</span>}
          </div>
        );
      })}
    </div>
  );
}
