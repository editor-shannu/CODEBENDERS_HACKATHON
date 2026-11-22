"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/money";
import { LaneStage, type StageControl } from "./LaneStage";
import { chaptersFor, type LandingData } from "./landing-data";

/**
 * The landing: one month in one scroll, from the 1st at the top to rent day at the bottom.
 * Flat HTML chapters over the lane. Lenis smooths the scroll and GSAP ScrollTrigger pins each
 * chapter and feeds the scene a continuous progress (0 = Day 1 … 7 = selection).
 */
export function Landing({ data }: { data: LandingData }) {
  const chapters = useMemo(() => chaptersFor(data), [data]);
  const [active, setActive] = useState(0);
  const [is3D, setIs3D] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const progress = useRef(0);
  const dive = useRef<number | null>(null);
  const control = useMemo<StageControl>(() => ({ progress, dive }), []);
  const last = chapters.length - 1;

  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);
      let lenis: import("lenis").default | null = null;
      let tick: ((t: number) => void) | null = null;
      if (!reduced) {
        const Lenis = (await import("lenis")).default;
        if (cancelled) return;
        lenis = new Lenis({ duration: 1.2, smoothWheel: true });
        lenis.on("scroll", ScrollTrigger.update);
        tick = (t: number) => lenis?.raf(t * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
      }
      const ctx = gsap.context(() => {
        const sections = gsap.utils.toArray<HTMLElement>("[data-chapter]");
        sections.forEach((sec, i) => {
          const card = sec.querySelector<HTMLElement>("[data-card]");
          if (card && i < sections.length - 1 && !reduced) {
            ScrollTrigger.create({ trigger: sec, start: "top top", end: "+=60%", pin: card, pinSpacing: false });
            gsap.fromTo(card, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, ease: "none", scrollTrigger: { trigger: sec, start: "top 80%", end: "top 30%", scrub: true } });
          }
        });
        // One continuous month: 0 at the top (Day 1) to the last chapter at the bottom.
        ScrollTrigger.create({
          trigger: root.current,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (self) => {
            progress.current = self.progress * (sections.length - 1);
            setActive(Math.min(sections.length - 1, Math.round(progress.current)));
          },
        });
      }, root);
      cleanup = () => {
        ctx.revert();
        if (tick) gsap.ticker.remove(tick);
        lenis?.destroy();
      };
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  const runCentre = useCallback(() => {
    if (is3D) {
      dive.current = performance.now();
      setTimeout(() => router.push("/home"), 900);
    } else router.push("/home");
  }, [is3D, router]);

  const paid = data.families.filter((f) => f.status === "paid").length;

  return (
    <div ref={root} className="relative bg-dusk-deep text-plaster">
      <Link
        href="/home"
        className="fixed right-3 top-3 z-50 inline-flex min-h-11 items-center border border-plaster/30 bg-dusk-deep/80 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-plaster hover:border-lamp hover:text-lamp"
      >
        Skip to dashboard
      </Link>

      <LaneStage data={data} chapter={active} control={control} on3D={setIs3D} />

      <div className="relative z-10 -mt-[100dvh]">
        {chapters.map((c, i) => (
          <section key={c.id} id={c.id} data-chapter={i} className={`flex min-h-[130dvh] flex-col px-5 ${i === last ? "min-h-dvh justify-end pb-[12vh]" : "justify-start pt-[12vh]"} ${i === 0 ? "min-h-[150dvh]" : ""}`}>
            <div data-card className="mx-auto w-full max-w-xl bg-dusk-deep/80 p-5 md:p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lamp">{c.day}</p>
              {i === 0 ? (
                <h1 className="mt-2 font-display text-4xl leading-[1.05] md:text-6xl">{c.title}</h1>
              ) : (
                <h2 className="mt-2 font-display text-4xl leading-[1.05] md:text-6xl">{c.title}</h2>
              )}
              <p className="mt-3 text-base text-plaster/80 md:text-lg">{c.body}</p>
              {i === 2 && (
                <p className="mt-4 font-mono text-sm">
                  <span className="text-lamp">{formatINR(data.collected)} collected</span> · <span className="text-brick">{formatINR(data.owed)} still owed</span> · {paid}/{data.families.length} lit
                </p>
              )}
              {i === last && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={runCentre} className="min-h-14 border border-lamp bg-lamp px-4 text-left font-mono text-sm font-semibold uppercase tracking-[0.1em] text-dusk-deep">
                    I run the centre
                    <span className="block text-[11px] font-normal normal-case tracking-normal">Open the dashboard</span>
                  </button>
                  <Link href="/parent" className="flex min-h-14 flex-col justify-center border border-plaster/40 px-4 font-mono text-sm font-semibold uppercase tracking-[0.1em] text-plaster hover:border-lamp">
                    I&apos;m a parent
                    <span className="block text-[11px] font-normal normal-case tracking-normal text-plaster/70">See and pay your fee</span>
                  </Link>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
