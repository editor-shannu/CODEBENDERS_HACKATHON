"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, PerformanceMonitor } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import type { LandingData } from "../landing-data";
import type { StageControl } from "../LaneStage";
import { Lane } from "./Lane";

type Props = { data: LandingData; control: StageControl; onReady: () => void; onFallback: () => void };

/** The WebGL lane. dpr capped at 1.5, quality drops on slow devices, and the loop pauses when hidden. */
export default function Scene({ data, control, onReady, onFallback }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [dpr, setDpr] = useState(1.5);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting && document.visibilityState === "visible"));
    io.observe(el);
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div ref={wrap} className="h-full w-full">
      <Canvas
        dpr={[1, dpr]}
        shadows
        frameloop={visible ? "always" : "never"}
        camera={{ position: [0, 6, 14], fov: 38, near: 0.1, far: 400 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        onCreated={({ camera }) => camera.lookAt(0, 3, -4)}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} flipflops={3} onFallback={onFallback}>
          <Suspense fallback={null}>
            <Environment files="/3d/sky_1k.hdr" background backgroundIntensity={0.55} environmentIntensity={0.5} />
            <hemisphereLight args={["#ffcf9a", "#2a3350", 0.35]} />
            <directionalLight position={[-20, 12, 10]} intensity={1.1} color="#ffb27a" castShadow shadow-mapSize={[1024, 1024]} />
            <fog attach="fog" args={["#6d6a80", 30, 140]} />
            <Lane data={data} control={control} />
            <Ready onReady={onReady} />
          </Suspense>
        </PerformanceMonitor>
      </Canvas>
    </div>
  );
}

/** Mounts only once every texture in the Suspense boundary has loaded. */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}
