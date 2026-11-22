"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { StageControl } from "../LaneStage";

/** Camera keyframes, one per chapter: [position, look-at]. 0 starts high over Hyderabad. */
const KEYS: [THREE.Vector3Tuple, THREE.Vector3Tuple][] = [
  [[6, 70, 95], [14, 0, -60]], // Day 1: high above the city, Charminar in haze
  [[0, 5.5, 13], [0, 2.6, -4]], // Day 5: down in the lane
  [[3, 5, 12.5], [0, 3, -4]], // Day 10: windows light
  [[-3.5, 4.6, 12], [-1, 3, -4]], // Day 15: promises
  [[0, 7.5, 16], [0, 5, -8]], // Day 20: sky and rent clock
  [[0, 15, 9], [0, 0.5, -2]], // Day 25: looking down on the chalk line
  [[2, 8, 24], [10, 9, -60]], // Rent day: the whole lane and Charminar
  [[0, 3.6, 6.5], [0, 3.3, -4]], // Selection: the teaching point's window
];
const DIVE: [THREE.Vector3Tuple, THREE.Vector3Tuple] = [[0, 3.3, -2.6], [0, 3.3, -6]];

const v = (t: THREE.Vector3Tuple) => new THREE.Vector3(...t);
const ease = (t: number) => t * t * (3 - 2 * t);

export function nightAt(p: number) {
  return ease(Math.min(1, Math.max(0, (p - 5.4) / 0.9)));
}

/** Moves the camera along the month as the page scrolls, with a gentle hand-held drift. */
export function Rig({ control }: { control: StageControl }) {
  const smoothP = useRef(0);
  const look = useRef(new THREE.Vector3(0, 3, -4));
  const tmpA = useRef(new THREE.Vector3());
  const tmpB = useRef(new THREE.Vector3());

  useFrame(({ clock, camera, pointer }, dt) => {
    const target = Math.min(KEYS.length - 1, Math.max(0, control.progress.current));
    smoothP.current = THREE.MathUtils.damp(smoothP.current, target, 3, Math.min(dt, 0.05));
    const p = smoothP.current;
    const i = Math.min(KEYS.length - 2, Math.floor(p));
    const t = ease(p - i);
    const pos = tmpA.current.copy(v(KEYS[i][0])).lerp(v(KEYS[i + 1][0]), t);
    const at = tmpB.current.copy(v(KEYS[i][1])).lerp(v(KEYS[i + 1][1]), t);
    if (control.dive.current !== null) {
      const d = ease(Math.min(1, (performance.now() - control.dive.current) / 900));
      pos.lerp(v(DIVE[0]), d);
      at.lerp(v(DIVE[1]), d);
    } else {
      pos.x += Math.sin(clock.elapsedTime * 0.25) * 0.08 + pointer.x * 0.25;
      pos.y += Math.sin(clock.elapsedTime * 0.31) * 0.05 + pointer.y * 0.12;
    }
    camera.position.copy(pos);
    look.current.lerp(at, 0.2);
    camera.lookAt(look.current);
  });
  return null;
}
