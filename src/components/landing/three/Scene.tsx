"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { Suspense, useEffect, useRef, useState } from "react";
import type { LandingData } from "../landing-data";
import type { StageControl } from "../LaneStage";
import { Atmosphere } from "./Atmosphere";
import { Lane } from "./Lane";
import { Bird, ChaiStall, Kite, Charminar, CityBlocks, NeemTree, Traffic, Wires } from "./Props";
import { Rig } from "./Rig";
import { ChalkLine, Clouds, Slips, useRentClock } from "./Story";
import { LedgerTag } from "./Interact";

type Props = { data: LandingData; control: StageControl; onReady: () => void };

/**
 * The WebGL lane: an old-city Hyderabad street at dusk, seen at eye level.
 * dpr capped at 1.5; PerformanceMonitor steps quality down (never back to the poster); the loop pauses when hidden.
 * The cursor plays with it: hover a house for its ledger tag, click to chase or light it, a kite follows the pointer.
 */
export default function Scene({ data, control, onReady }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  // quality tier: 2 full, 1 no shadows or tilt-shift, 0 bare. A slow machine steps down, never back to the poster.
  const [tier, setTier] = useState(2);
  const high = tier === 2;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let onScreen = true;
    const update = () => setVisible(onScreen && document.visibilityState === "visible");
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      update();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div ref={wrap} className="h-full w-full">
      <Canvas
        dpr={tier === 2 ? [1, 1.5] : tier === 1 ? 1 : 0.75}
        shadows={high}
        frameloop={visible ? "always" : "never"}
        camera={{ position: [-6, 9, 14], fov: 50, near: 0.1, far: 500 }}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      >
        <PerformanceMonitor bounds={() => [30, 55]} onDecline={() => setTier((t) => Math.max(0, t - 1))} onIncline={() => setTier((t) => Math.min(2, t + 1))} flipflops={4} onFallback={() => setTier(0)}>
          <Suspense fallback={null}>
            <Environment files="/3d/sky_1k.hdr" background backgroundIntensity={0.6} environmentIntensity={0.55} />
            <Atmosphere control={control} shadows={high} />
            <Rig control={control} />
            <CityBlocks />
            <Charminar control={control} />
            <StoryLane data={data} control={control} />
            <NeemTree position={[9.2, 0, -0.4]} />
            <ChaiStall position={[-5.2, 0, 1.6]} />
            <mesh position={[-4.6, 2.7, 0.6]}>
              <cylinderGeometry args={[0.06, 0.08, 5.4, 8]} />
              <meshStandardMaterial color="#3b3d40" />
            </mesh>
            <Traffic />
            <Wires />
            <Bird />
            {high ? (
              <EffectComposer multisampling={0} enableNormalPass={false}>
                <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.6} />
                <Noise opacity={0.035} premultiply />
                <Vignette offset={0.3} darkness={0.45} />
              </EffectComposer>
            ) : tier === 1 ? (
              <EffectComposer multisampling={0} enableNormalPass={false}>
                <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.8} />
                <Vignette offset={0.25} darkness={0.6} />
              </EffectComposer>
            ) : null}
            <Kite />
            <LedgerTag />
            <Ready onReady={onReady} />
          </Suspense>
        </PerformanceMonitor>
      </Canvas>
    </div>
  );
}

/** The lane plus the month's story beats: slips, clouds, the rent clock and the chalk line. */
function StoryLane({ data, control }: { data: LandingData; control: StageControl }) {
  const clock = useRentClock(data, control);
  return (
    <>
      <Lane data={data} control={control} clockTexture={clock} />
      <Slips data={data} control={control} />
      <Clouds data={data} control={control} />
      <ChalkLine data={data} control={control} />
    </>
  );
}

/** Mounts only once every texture in the Suspense boundary has loaded. */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}
