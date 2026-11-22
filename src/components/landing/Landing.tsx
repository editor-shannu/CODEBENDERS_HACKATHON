"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/money";
import { LanePoster } from "./LanePoster";
import { chaptersFor, type LandingData } from "./landing-data";

/**
 * The landing: one month in one scroll. Flat HTML chapters over a lane that changes with the
 * chapter. The lane is a flat poster here; the 3D layer mounts on top of it when it can.
 */
export function Landing({ data }: { data: LandingData }) {
  const chapters = useMemo(() => chaptersFor(data), [data]);
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const paid = data.families.filter((f) => f.status === "paid").length;
  const last = chapters.length - 1;

  return (
    <div className="relative bg-dusk-deep text-plaster">
      <Link
        href="/home"
        className="fixed right-3 top-3 z-50 inline-flex min-h-11 items-center border border-plaster/30 bg-dusk-deep/80 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-plaster hover:border-lamp hover:text-lamp"
      >
        Skip to dashboard
      </Link>

      <div className="sticky top-0 h-dvh w-full overflow-hidden" aria-hidden="true">
        <LanePoster data={data} chapter={active} />
      </div>

      <div className="relative z-10 -mt-[100dvh]">
        {chapters.map((c, i) => (
          <section
            key={c.id}
            id={c.id}
            data-index={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={`flex min-h-dvh flex-col px-5 ${i === last ? "justify-center" : "justify-start pt-[14vh]"}`}
          >
            <div className="mx-auto w-full max-w-xl bg-dusk-deep/85 p-5 md:p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lamp">{c.day}</p>
              <h2 className="mt-2 font-display text-4xl leading-[1.05] md:text-6xl">{c.title}</h2>
              <p className="mt-3 text-base text-plaster/80 md:text-lg">{c.body}</p>
              {i === 2 && (
                <p className="mt-4 font-mono text-sm">
                  <span className="text-lamp">{formatINR(data.collected)} collected</span> · <span className="text-brick">{formatINR(data.owed)} still owed</span> · {paid}/{data.families.length} lit
                </p>
              )}
              {i === last && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => router.push("/home")}
                    className="min-h-14 border border-lamp bg-lamp px-4 text-left font-mono text-sm font-semibold uppercase tracking-[0.1em] text-dusk-deep"
                  >
                    I run the centre
                    <span className="block text-[11px] font-normal normal-case tracking-normal">Open the dashboard</span>
                  </button>
                  <Link
                    href="/parent"
                    className="flex min-h-14 flex-col justify-center border border-plaster/40 px-4 font-mono text-sm font-semibold uppercase tracking-[0.1em] text-plaster hover:border-lamp"
                  >
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
