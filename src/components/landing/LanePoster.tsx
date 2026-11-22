import type { HouseState } from "@/components/ui/HouseStatus";
import { houseStateAt, type LandingData } from "./landing-data";

/**
 * Flat illustration of the lane, used as the instant poster behind the 3D canvas and as the
 * full fallback (reduced motion, no WebGL, low FPS). Each house's window follows the chapter.
 */
export function LanePoster({ data, chapter, className = "" }: { data: LandingData; chapter: number; className?: string }) {
  const houses = data.families;
  const n = Math.max(houses.length, 1);
  const night = chapter >= 6;
  const cloudy = chapter === 4 && !!data.rent?.atRisk;
  const W = 1200;
  const groundY = 560;
  const slot = (W - 120) / (n + 1);
  const centreIndex = Math.floor((n + 1) / 2);
  const plaster = ["#e8d6b8", "#d9c3a0", "#efe0c4", "#cdb38e", "#e3cfae", "#d6bd96"];
  const windowFill = (s: HouseState) => (s === "paid" ? "#f2b35a" : s === "promised" ? "#a7773a" : "#1b2333");

  const items: { kind: "house" | "centre"; i: number }[] = [];
  let hi = 0;
  for (let k = 0; k < n + 1; k++) items.push(k === centreIndex ? { kind: "centre", i: -1 } : { kind: "house", i: hi++ });

  return (
    <svg viewBox={`0 0 ${W} 700`} preserveAspectRatio="xMidYMax slice" className={`h-full w-full ${className}`} role="img" aria-label={`${data.centre} lane at dusk, one house per family`}>
      <rect width={W} height="700" fill={night ? "#0c1220" : "#1d2740"} />
      <rect y="300" width={W} height="260" fill={night ? "#141c2b" : "#5a4a5c"} opacity="0.55" />
      <rect y="420" width={W} height="140" fill={night ? "#141c2b" : "#a0644a"} opacity="0.35" />
      {/* Charminar, hazy on the skyline */}
      <g transform="translate(860 300)" fill={night ? "#f2b35a" : "#2a3350"} opacity={night ? 0.55 : 0.6}>
        <rect x="0" y="40" width="10" height="120" />
        <rect x="110" y="40" width="10" height="120" />
        <rect x="14" y="90" width="92" height="70" />
        <path d="M-2 40 h14 l-7 -16 z M108 40 h14 l-7 -16 z" />
        <path d="M38 160 v-38 a22 22 0 0 1 44 0 v38 z" fill={night ? "#0c1220" : "#1d2740"} />
      </g>
      {cloudy && (
        <g fill="#3a4258" opacity="0.85">
          <ellipse cx="300" cy="140" rx="220" ry="40" />
          <ellipse cx="520" cy="120" rx="180" ry="34" />
          <ellipse cx="860" cy="160" rx="240" ry="44" />
        </g>
      )}
      {/* road */}
      <rect y={groundY} width={W} height={700 - groundY} fill="#6b5b4a" />
      <rect y={groundY} width={W} height="6" fill="#4d4033" />
      {items.map((it, k) => {
        const x = 60 + slot * k + slot * 0.08;
        const w = slot * 0.84;
        if (it.kind === "centre") {
          const h = 300;
          const y = groundY - h;
          return (
            <g key="centre">
              <rect x={x} y={y} width={w} height={h} fill="#f3ead8" />
              <rect x={x} y={y + h * 0.48} width={w} height="6" fill="#8c6f52" />
              <rect x={x + w * 0.12} y={y + 22} width={w * 0.76} height={30} fill="#b4432e" />
              <text x={x + w / 2} y={y + 42} textAnchor="middle" fontSize={Math.min(14, w / 11)} fill="#f3ead8" fontFamily="serif">{data.centre}</text>
              <rect x={x + w * 0.2} y={y + 70} width={w * 0.6} height={56} fill={chapter >= 7 || night ? "#f2b35a" : "#e6a24c"} />
              <rect x={x + w * 0.35} y={y + h - 70} width={w * 0.3} height={70} fill="#6b4a33" />
            </g>
          );
        }
        const f = houses[it.i];
        if (!f) return null;
        const state = houseStateAt(chapter, f, data.defense);
        const h = 150 + ((it.i * 53) % 3) * 55;
        const y = groundY - h;
        const floors = Math.round(h / 80);
        return (
          <g key={f.id}>
            <title>{`${f.name}: ${state}`}</title>
            <rect x={x} y={y} width={w} height={h} fill={plaster[it.i % plaster.length]} />
            <path d={`M${x - 6} ${y} L${x + w / 2} ${y - 26} L${x + w + 6} ${y} Z`} fill="#9c4a32" />
            {Array.from({ length: floors }).map((_, fl) => (
              <rect key={fl} x={x + w * 0.22} y={y + 24 + fl * 78} width={w * 0.56} height={34} fill={windowFill(state)} />
            ))}
            {state === "promised" && <rect x={x + w * 0.22} y={y + 41} width={w * 0.56} height={17} fill="#f2b35a" opacity="0.8" />}
            <rect x={x + w * 0.38} y={groundY - 46} width={w * 0.24} height={46} fill={state === "owed" ? "none" : "#6b4a33"} stroke={state === "owed" ? "#b4432e" : "none"} strokeWidth="3" />
            {chapter === 5 && data.defense.includes(f.id) && (
              <circle cx={x + w / 2} cy={groundY + 30} r="6" fill="#f3ead8" />
            )}
          </g>
        );
      })}
      {/* tangled wires */}
      <path d={`M0 250 Q ${W / 4} 300 ${W / 2} 262 T ${W} 270`} stroke="#0c1220" strokeWidth="2" fill="none" />
      <path d={`M0 270 Q ${W / 3} 320 ${(2 * W) / 3} 280 T ${W} 300`} stroke="#0c1220" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
