"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { LandingData } from "../landing-data";
import type { StageControl } from "../LaneStage";
import { houseX, LANE_Z } from "./Lane";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const doorstep = (i: number) => new THREE.Vector3(houseX(i) + 0.65, 0.03, LANE_Z - (i % 3) * 0.4 + 1.6);

/** Day 5: paper invoice slips flutter from the centre's window down to every doorstep. */
export function Slips({ data, control }: { data: LandingData; control: StageControl }) {
  const group = useRef<THREE.Group>(null);
  const paths = useMemo(() => {
    const from = new THREE.Vector3(0, 3.3, LANE_Z + 1.2);
    return data.families.map((_, i) => {
      const to = doorstep(i);
      const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 2.2, 1.2));
      return new THREE.QuadraticBezierCurve3(from, mid, to);
    });
  }, [data.families]);
  useFrame(({ clock }) => {
    const p = control.progress.current;
    group.current?.children.forEach((m, i) => {
      const t = clamp01((p - 0.55 - i * 0.04) / 0.7);
      m.visible = p > 0.5 && p < 2.4 && t > 0;
      paths[i].getPoint(t, m.position);
      const air = t < 1 ? 1 : 0;
      m.rotation.set(-Math.PI / 2 + air * Math.sin(clock.elapsedTime * 6 + i) * 0.7, air * clock.elapsedTime * 2 + i, air * Math.cos(clock.elapsedTime * 5 + i) * 0.5);
    });
  });
  return (
    <group ref={group}>
      {data.families.map((f) => (
        <mesh key={f.id} castShadow>
          <planeGeometry args={[0.32, 0.22]} />
          <meshStandardMaterial color="#f3ead8" side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Day 20: clouds roll in when the forecast says rent is at risk, and clear once the plan works. */
export function Clouds({ data, control }: { data: LandingData; control: StageControl }) {
  const group = useRef<THREE.Group>(null);
  const puffs = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({ x: -26 + (i % 8) * 7.5, y: 15 + (i % 3) * 1.6, z: -16 - Math.floor(i / 8) * 6, s: 3 + (i % 4) })),
    [],
  );
  useFrame(({ clock }) => {
    const p = control.progress.current;
    const k = data.rent?.atRisk ? clamp01((p - 3.4) / 0.6) * (1 - clamp01((p - 5.0) / 0.6)) : 0;
    if (!group.current) return;
    group.current.visible = k > 0.01;
    group.current.position.x = (1 - k) * -40 + Math.sin(clock.elapsedTime * 0.05) * 2;
    group.current.children.forEach((c) => (((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.75 * k));
  });
  return (
    <group ref={group} visible={false}>
      {puffs.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} scale={[c.s * 1.6, c.s * 0.6, c.s]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#5b6172" transparent opacity={0} depthWrite={false} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Draws the clock face; returns the texture and a redraw function. */
function makeClock() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  let shown = "";
  const draw = (label: string, colour: string) => {
    if (label + colour === shown) return;
    shown = label + colour;
    const g = canvas.getContext("2d")!;
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = "#f3ead8";
    g.beginPath();
    g.arc(128, 128, 122, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = "#0c1220";
    g.stroke();
    g.fillStyle = colour;
    g.font = `700 ${label.length > 2 ? 70 : 110}px Georgia, serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(label, 128, 118);
    g.fillStyle = "#0c1220";
    g.font = "600 28px monospace";
    g.fillText(label === "SAFE" ? "RENT" : "DAYS", 128, 200);
    texture.needsUpdate = true;
  };
  return { texture, draw };
}

/** The rent clock on the centre's wall: days until rent, brick when at risk, lamp once safe. */
export function useRentClock(data: LandingData, control: StageControl) {
  const clock = useMemo(() => makeClock(), []);
  useFrame(() => {
    const p = control.progress.current;
    const r = data.rent;
    if (!r) return clock.draw("--", "#8a97a8");
    if (p >= 5.6) return clock.draw("SAFE", "#f2b35a");
    const days = p >= 3.5 ? Math.max(0, Math.round(r.daysUntil - clamp01((p - 3.5) / 2) * Math.min(r.daysUntil, 5))) : r.daysUntil;
    clock.draw(String(days), r.atRisk && p < 4.9 ? "#b4432e" : "#f2b35a");
  });
  return clock.texture;
}

/** Day 25: a chalk line drawn on the road between the three houses of the Rent Defense Plan. */
export function ChalkLine({ data, control }: { data: LandingData; control: StageControl }) {
  const geo = useMemo(() => {
    const idx = data.defense.map((id) => data.families.findIndex((f) => f.id === id)).filter((i) => i >= 0);
    if (idx.length < 2) return null;
    const pts = idx.sort((a, b) => houseX(a) - houseX(b)).map((i) => doorstep(i).add(new THREE.Vector3(0, 0, 0.6)));
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.3);
    return new THREE.TubeGeometry(curve, 120, 0.05, 4);
  }, [data]);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!geo) return;
    const p = control.progress.current;
    const t = clamp01((p - 4.2) / 0.5);
    geo.setDrawRange(0, Math.floor((geo.index?.count ?? 0) * t));
    if (mat.current) mat.current.opacity = 0.85 * (1 - clamp01((p - 5.6) / 0.5));
  });
  if (!geo) return null;
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial ref={mat} color="#efeadf" transparent opacity={0.85} />
    </mesh>
  );
}
