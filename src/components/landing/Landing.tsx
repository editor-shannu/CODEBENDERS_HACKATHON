"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatINR } from "@/lib/money";
import { LaneStage, type StageControl } from "./LaneStage";
import { chaptersFor, type LandingData } from "./landing-data";
import { lane } from "./three/Interact";

const MONTH = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "Asia/Kolkata" }).format(new Date());

/**
 * The landing: one month on one screen. No long scroll. A tear-off wall calendar turns the month a
 * day at a time (click it, wheel, swipe, arrow keys or the date ruler) and the lane behind it follows:
 * slips go out, windows light, clouds gather over rent, Munshi draws the defense line, rent day.
 * The lane itself answers the cursor: hover a house for its ledger chit, click to chase or light it.
 */
export function Landing({ data }: { data: LandingData }) {
  const chapters = useMemo(() => chaptersFor(data), [data]);
  const last = chapters.length - 1;
  const [active, setActive] = useState(0);
  const [tearing, setTearing] = useState<{ from: number; dir: 1 | -1 } | null>(null);
  const [is3D, setIs3D] = useState(false);
  const router = useRouter();
  const progress = useRef(0);
  const dive = useRef<number | null>(null);
  const control = useMemo<StageControl>(() => ({ progress, dive }), []);
  const lock = useRef(0);

  const at = useRef(0);
  const go = useCallback(
    (next: number) => {
      const n = Math.max(0, Math.min(last, next));
      const cur = at.current;
      if (n === cur) return;
      at.current = n;
      progress.current = n; // the camera rig damps toward it
      lane.hover(null); // the chit belongs to the old view
      setTearing({ from: cur, dir: n > cur ? 1 : -1 });
      setActive(n);
    },
    [last],
  );
  const step = useCallback(
    (d: 1 | -1) => {
      const now = performance.now();
      if (now - lock.current < 650) return;
      lock.current = now;
      go(at.current + d);
    },
    [go],
  );

  // wheel, keys and swipe each turn one page; the page itself never scrolls
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 12) return;
      step(e.deltaY > 0 ? 1 : -1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        step(1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        step(-1);
      }
    };
    let y0: number | null = null;
    let x0: number | null = null;
    const onStart = (e: TouchEvent) => {
      y0 = e.touches[0].clientY;
      x0 = e.touches[0].clientX;
    };
    const onEnd = (e: TouchEvent) => {
      if (y0 === null || x0 === null) return;
      const dy = y0 - e.changedTouches[0].clientY;
      const dx = x0 - e.changedTouches[0].clientX;
      const d = Math.abs(dy) > Math.abs(dx) ? dy : dx;
      if (Math.abs(d) > 40) step(d > 0 ? 1 : -1);
      y0 = x0 = null;
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [step]);

  useEffect(() => {
    if (!tearing) return;
    const id = setTimeout(() => setTearing(null), 620);
    return () => clearTimeout(id);
  }, [tearing]);

  const runCentre = useCallback(() => {
    if (is3D) {
      dive.current = performance.now();
      setTimeout(() => router.push("/home"), 900);
    } else router.push("/home");
  }, [is3D, router]);

  const paid = data.families.filter((f) => f.status === "paid").length;
  const dayNum = (i: number) => {
    const m = /\d+/.exec(chapters[i].day);
    return m ? m[0] : String(data.rent?.dueDay ?? 30);
  };
  const c = chapters[active];

  return (
    <div className="fixed inset-0 overflow-hidden bg-dusk-deep text-plaster">
      <LaneStage data={data} chapter={active} control={control} on3D={setIs3D} />

      {/* wordmark */}
      <div className="pointer-events-none absolute left-4 top-3 z-20 md:left-6 md:top-5">
        <p className="font-display text-3xl leading-none text-lamp md:text-4xl">Baaki</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-plaster/70">{data.centre}</p>
        {data.viewer && <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-lamp/80">Namaste, {data.viewer.name.split(" ")[0]}</p>}
      </div>
      <Link
        href={data.viewer ? "/home" : "/login"}
        className="absolute right-3 top-3 z-30 inline-flex min-h-11 items-center border border-plaster/30 bg-dusk-deep/80 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-plaster hover:border-lamp hover:text-lamp"
      >
        {data.viewer ? "Open dashboard" : "Sign in"}
      </Link>
      <Link href="/pricing" className="absolute right-3 top-[7.25rem] z-30 inline-flex min-h-9 items-center px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-plaster/80 hover:text-lamp md:right-[290px] md:top-4">
        Pricing
      </Link>
      {!data.viewer && (
        <a
          href="/api/demo"
          className="absolute right-3 top-16 z-30 inline-flex min-h-11 items-center border border-lamp bg-lamp px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-dusk-deep hover:bg-plaster md:right-[150px] md:top-3"
        >
          Try the demo
        </a>
      )}

      {/* the chapter: one chit at a time, swapped in place */}
      <div className="pointer-events-none absolute inset-x-3 bottom-[148px] z-20 md:bottom-10 md:left-8 md:right-auto md:w-[min(520px,42vw)]">
        <div key={c.id} className="chit-in pointer-events-auto border-l-4 border-brick bg-dusk-deep/85 p-5 backdrop-blur-[2px] md:p-6" aria-live="polite">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lamp">{c.day}</p>
          {active === 0 ? (
            <h1 className="mt-2 font-display text-3xl leading-[1.05] md:text-5xl">{c.title}</h1>
          ) : (
            <h2 className="mt-2 font-display text-3xl leading-[1.05] md:text-5xl">{c.title}</h2>
          )}
          <p className="mt-3 text-[15px] text-plaster/85 md:text-base">{c.body}</p>
          {active === 2 && (
            <p className="mt-3 font-mono text-sm">
              <span className="text-lamp">{formatINR(data.collected)} collected</span> · <span className="text-brick">{formatINR(data.owed)} still owed</span> · {paid}/{data.families.length} lit
            </p>
          )}
          {active === last ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={runCentre} className="min-h-14 border border-lamp bg-lamp px-4 text-left font-mono text-sm font-semibold uppercase tracking-[0.1em] text-dusk-deep">
                I run the centre
                <span className="block text-[11px] font-normal normal-case tracking-normal">{data.viewer ? "Open the dashboard" : "Sign in with Google"}</span>
              </button>
              {!data.viewer && (
                <a href="/api/demo" className="flex min-h-14 flex-col justify-center border border-lamp px-4 font-mono text-sm font-semibold uppercase tracking-[0.1em] text-lamp hover:bg-lamp hover:text-dusk-deep sm:col-span-2">
                  Try the demo
                  <span className="block text-[11px] font-normal normal-case tracking-normal text-plaster/70">No sign-in. A sample centre with synthetic data.</span>
                </a>
              )}
              <Link href="/parent" className="flex min-h-14 flex-col justify-center border border-plaster/40 px-4 font-mono text-sm font-semibold uppercase tracking-[0.1em] text-plaster hover:border-lamp">
                I&apos;m a parent
                <span className="block text-[11px] font-normal normal-case tracking-normal text-plaster/70">See and pay your fee</span>
              </Link>
            </div>
          ) : (
            <p className="mt-4 font-mono text-[11px] text-plaster/60">{is3D ? "Hover a house to read its chit. Click it to chase." : "Turn the calendar to move through the month."}</p>
          )}
        </div>
      </div>

      {/* tear-off wall calendar: the month's only control */}
      <div className="absolute bottom-3 right-3 z-30 flex items-end gap-3 md:bottom-8 md:right-8">
        <button type="button" onClick={() => step(-1)} disabled={active === 0} aria-label="Previous day" className="min-h-11 min-w-11 border border-plaster/30 bg-dusk-deep/80 font-mono text-plaster disabled:opacity-30">
          ‹
        </button>
        <button type="button" onClick={() => step(1)} disabled={active === last} aria-label={active === last ? "Last page" : `Turn to ${chapters[Math.min(last, active + 1)].day}`} className="group relative h-[128px] w-[112px] text-left md:h-[156px] md:w-[136px]">
          {/* the nail and the binding */}
          <span className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#2a2a2a] shadow-[0_1px_0_#000]" />
          <span className="absolute inset-x-0 top-0 h-5 bg-brick" />
          <span className="absolute inset-x-0 top-5 bottom-0 bg-[#e9dfc8]" />
          {/* current page */}
          <Page num={dayNum(active)} label={chapters[active].day} month={MONTH} />
          {/* the page being torn off */}
          {tearing && tearing.dir === 1 && <Page num={dayNum(tearing.from)} label={chapters[tearing.from].day} month={MONTH} tearing />}
          <span className="absolute -bottom-5 right-0 font-mono text-[10px] uppercase tracking-[0.14em] text-plaster/60 group-disabled:hidden">Tear ›</span>
        </button>
      </div>

      {/* date ruler: jump to any day */}
      <nav aria-label="Days of the month" className="absolute left-1/2 top-3 z-20 hidden -translate-x-1/2 md:flex">
        {chapters.map((ch, i) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => go(i)}
            aria-current={i === active ? "step" : undefined}
            className={`min-h-11 border-b-2 px-3 font-mono text-[11px] uppercase tracking-[0.12em] ${i === active ? "border-lamp text-lamp" : "border-plaster/20 text-plaster/60 hover:text-plaster"}`}
          >
            {i < last - 1 ? dayNum(i) : ch.day}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Page({ num, label, month, tearing = false }: { num: string; label: string; month: string; tearing?: boolean }) {
  return (
    <span className={`absolute inset-x-0 top-5 bottom-0 flex flex-col items-center justify-center bg-paper text-dusk-deep shadow-[0_2px_0_#00000033] ${tearing ? "tear-off" : ""}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brick">{month}</span>
      <span className="font-display text-5xl leading-none md:text-6xl">{num}</span>
      <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-dusk-deep/70">{label}</span>
      <span className="absolute inset-x-2 top-0 border-t border-dashed border-dusk-deep/30" />
    </span>
  );
}
