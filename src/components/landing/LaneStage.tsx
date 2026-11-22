"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type MutableRefObject } from "react";
import { LanePoster } from "./LanePoster";
import type { LandingData } from "./landing-data";

const Scene = dynamic(() => import("./three/Scene"), { ssr: false, loading: () => null });

export type StageControl = {
  /** Scroll position in chapters (0 = top of Day 1, 7 = selection). Written by the landing, read every frame. */
  progress: MutableRefObject<number>;
  /** Set to a timestamp when "I run the centre" is chosen: the camera dives into the window. */
  dive: MutableRefObject<number | null>;
};

function canUse3D() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * The sticky stage behind the chapters. The flat poster paints first (server-rendered); the WebGL
 * lane loads after hydration and fades in over it. Reduced motion, no WebGL or low FPS keep the poster.
 */
export function LaneStage({ data, chapter, control, on3D }: { data: LandingData; chapter: number; control: StageControl; on3D?: (on: boolean) => void }) {
  const [mode, setMode] = useState<"poster" | "loading" | "3d">("poster");

  useEffect(() => {
    // Decided after hydration so the server and first client paint are the same poster.
    const id = requestAnimationFrame(() => setMode(canUse3D() ? "loading" : "poster"));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => on3D?.(mode === "3d"), [mode, on3D]);

  return (
    <div className="sticky top-0 h-dvh w-full overflow-hidden" aria-hidden="true">
      <LanePoster data={data} chapter={chapter} className={`absolute inset-0 transition-opacity duration-700 ${mode === "3d" ? "opacity-0" : "opacity-100"}`} />
      {mode !== "poster" && (
        <div className={`absolute inset-0 transition-opacity duration-700 ${mode === "3d" ? "opacity-100" : "opacity-0"}`}>
          <Scene data={data} control={control} onReady={() => setMode("3d")} onFallback={() => setMode("poster")} />
        </div>
      )}
    </div>
  );
}
