"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, TiltShift2, Vignette } from "@react-three/postprocessing";
import { Suspense, useEffect, useRef, useState } from "react";
import type { LandingData } from "../landing-data";
import type { StageControl } from "../LaneStage";
import { Atmosphere } from "./Atmosphere";
import { Lane } from "./Lane";
import { Bird, ChaiStall, Charminar, CityBlocks, NeemTree, Traffic, Wires } from "./Props";
import { Rig } from "./Rig";
import { ChalkLine, Clouds, Slips, useRentClock } from "./Story";

type Props = { data: LandingData; control: StageControl; onReady: () => void; onFallback: () => void };

/**
 * The WebGL lane: a tilt-shift miniature of a Hyderabad colony at dusk.
 * dpr capped at 1.5; PerformanceMonitor drops to low quality, then to the poster; the loop pauses when hidden.
 */
export default function Scene({ data, control, onReady, onFallback }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [high, setHigh] = useState(true);
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
        dpr={high ? [1, 1.5] : 1}
        shadows={high}
        frameloop={visible ? "always" : "never"}
        camera={{ position: [6, 70, 95], fov: 36, near: 0.1, far: 500 }}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      >
        <PerformanceMonitor onDecline={() => setHigh(false)} onIncline={() => setHigh(true)} flipflops={3} onFallback={onFallback}>
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
                <TiltShift2 blur={0.16} taper={0.6} />
                <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} />
                <Noise opacity={0.05} premultiply />
                <Vignette offset={0.25} darkness={0.6} />
              </EffectComposer>
            ) : (
              <EffectComposer multisampling={0} enableNormalPass={false}>
                <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.8} />
                <Vignette offset={0.25} darkness={0.6} />
              </EffectComposer>
            )}
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
