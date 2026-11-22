"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { StageControl } from "../LaneStage";
import { nightAt } from "./Rig";

/** Dusk to night: sky, sun, fog and the street lamp all follow the scroll. */
export function Atmosphere({ control, shadows }: { control: StageControl; shadows: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const fogDusk = new THREE.Color("#7a6f86");
  const fogNight = new THREE.Color("#111827");

  useFrame(({ scene }) => {
    const n = nightAt(control.progress.current);
    scene.backgroundIntensity = THREE.MathUtils.lerp(0.6, 0.06, n);
    scene.environmentIntensity = THREE.MathUtils.lerp(0.55, 0.08, n);
    if (sun.current) sun.current.intensity = THREE.MathUtils.lerp(1.2, 0.05, n);
    if (hemi.current) hemi.current.intensity = THREE.MathUtils.lerp(0.35, 0.12, n);
    if (lamp.current) lamp.current.intensity = THREE.MathUtils.lerp(4, 9, n);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(fogDusk).lerp(fogNight, n);
      // Wide haze from high above the city on Day 1, a closer haze once we're in the lane.
      const down = Math.min(1, Math.max(0, control.progress.current));
      scene.fog.near = THREE.MathUtils.lerp(80, 28, down);
      scene.fog.far = THREE.MathUtils.lerp(340, 150, down);
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#ffcf9a", "#2a3350", 0.35]} />
      <directionalLight
        ref={sun}
        position={[-25, 10, 6]}
        intensity={1.2}
        color="#ff9f6a"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={15}
        shadow-camera-bottom={-10}
      />
      {/* tungsten street lamp on a pole by the chai stall */}
      <pointLight ref={lamp} position={[-4.6, 5.2, 0.6]} color="#ffb067" intensity={4} distance={14} decay={2} />
      <fog attach="fog" args={["#7a6f86", 28, 150]} />
    </>
  );
}
