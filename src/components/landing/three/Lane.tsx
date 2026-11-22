"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { LandingData, LandingFamily } from "../landing-data";
import type { StageControl } from "../LaneStage";
import { PLASTER_TINTS, useLaneTextures } from "./materials";

export const HOUSE_GAP = 3.4;
export const LANE_Z = -4;

/** x position for house i (alternating left and right of the centre at x = 0). */
export function houseX(i: number) {
  const k = Math.floor(i / 2) + 1;
  return (i % 2 === 0 ? -1 : 1) * k * HOUSE_GAP;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How lit a family's window is (0..1) at scroll progress p, following the month. */
export function litAt(p: number, f: LandingFamily, order: { paid: number; paidCount: number; defense: number }, t: number) {
  const all = smooth(5.6, 6.2, p);
  let lit = 0;
  if (f.status === "paid") lit = smooth(1.5 + (order.paid / Math.max(1, order.paidCount)) * 0.8, 1.6 + (order.paid / Math.max(1, order.paidCount)) * 0.8, p);
  if (f.status === "promised") lit = smooth(2.6, 3.0, p) * (0.32 + 0.06 * Math.sin(t * 9 + order.paid) + 0.04 * Math.sin(t * 23));
  if (order.defense >= 0) lit = Math.max(lit, smooth(4.7 + order.defense * 0.3, 4.85 + order.defense * 0.3, p));
  return Math.max(lit, all);
}

function House({ f, i, data, control, tex }: { f: LandingFamily; i: number; data: LandingData; control: StageControl; tex: ReturnType<typeof useLaneTextures> }) {
  const floors = 2 + ((i * 7) % 3 === 0 ? 1 : 0);
  const w = 2.7;
  const h = floors * 2.1;
  const d = 2.6;
  const tint = PLASTER_TINTS[i % PLASTER_TINTS.length];
  const win = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useRef<THREE.PointLight>(null);
  const paidOrder = data.families.filter((x) => x.status === "paid").indexOf(f);
  const order = { paid: paidOrder, paidCount: data.families.filter((x) => x.status === "paid").length, defense: data.defense.indexOf(f.id) };

  useFrame(({ clock }) => {
    const lit = litAt(control.progress.current, f, order, clock.elapsedTime);
    if (win.current) {
      win.current.emissiveIntensity = lit * 3.2;
      win.current.color.setScalar(0.05 + lit * 0.4);
    }
    if (glow.current) glow.current.intensity = lit * 2.2;
  });

  const wallMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: tex.plaster, normalMap: tex.plasterN, color: tint, roughness: 0.95 });
    return m;
  }, [tex, tint]);

  return (
    <group position={[houseX(i), 0, LANE_Z - (i % 3) * 0.4]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow material={wallMat}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {/* floor bands and a balcony with an iron grill on the first floor */}
      {Array.from({ length: floors - 1 }).map((_, k) => (
        <mesh key={k} position={[0, 2.1 * (k + 1), d / 2 + 0.05]} castShadow>
          <boxGeometry args={[w + 0.1, 0.12, 0.2]} />
          <meshStandardMaterial color="#b9a88f" roughness={1} />
        </mesh>
      ))}
      <group position={[0, 2.1, d / 2 + 0.45]}>
        <mesh castShadow>
          <boxGeometry args={[w * 0.8, 0.1, 0.9]} />
          <meshStandardMaterial color="#a89880" roughness={1} />
        </mesh>
        {Array.from({ length: 9 }).map((_, k) => (
          <mesh key={k} position={[-w * 0.38 + (k * w * 0.76) / 8, 0.45, 0.42]}>
            <boxGeometry args={[0.03, 0.8, 0.03]} />
            <meshStandardMaterial color="#1f2328" metalness={0.6} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 0.85, 0.42]}>
          <boxGeometry args={[w * 0.8, 0.05, 0.05]} />
          <meshStandardMaterial color="#1f2328" metalness={0.6} roughness={0.5} />
        </mesh>
        {/* potted tulsi */}
        <mesh position={[w * 0.3, 0.2, 0.2]}>
          <cylinderGeometry args={[0.12, 0.09, 0.22, 10]} />
          <meshStandardMaterial color="#9a4f33" roughness={1} />
        </mesh>
        <mesh position={[w * 0.3, 0.42, 0.2]}>
          <icosahedronGeometry args={[0.16, 0]} />
          <meshStandardMaterial color="#4f6b34" roughness={1} />
        </mesh>
      </group>
      {/* the family's window: lit means paid */}
      <mesh position={[0, 3.05, d / 2 + 0.01]}>
        <planeGeometry args={[1.1, 0.9]} />
        <meshStandardMaterial ref={win} color="#0d1118" emissive="#ffb35c" emissiveIntensity={0} roughness={0.4} toneMapped={false} />
      </mesh>
      <pointLight ref={glow} position={[0, 3.05, d / 2 + 0.6]} color="#ffb35c" intensity={0} distance={4} decay={2} />
      {/* ground floor window grill and door */}
      <mesh position={[-0.6, 1.1, d / 2 + 0.01]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshStandardMaterial color="#1a1d22" roughness={0.6} />
      </mesh>
      <mesh position={[0.65, 0.95, d / 2 + 0.01]}>
        <planeGeometry args={[0.75, 1.9]} />
        <meshStandardMaterial color="#5b3a26" roughness={0.9} />
      </mesh>
      {/* hip roof in clay tiles */}
      <mesh position={[0, h + 0.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.hypot(w, d) / 2 + 0.25, 1.1, 4]} />
        <meshStandardMaterial map={tex.roof} normalMap={tex.roofN} color="#c98a6a" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Lakshmi Teaching Point: first-floor classroom with a hand-painted signboard and the rent clock. */
function Centre({ data, tex, clockTexture }: { data: LandingData; tex: ReturnType<typeof useLaneTextures>; clockTexture?: THREE.Texture }) {
  const sign = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 200;
    const g = c.getContext("2d")!;
    g.fillStyle = "#b4432e";
    g.fillRect(0, 0, 1024, 200);
    g.strokeStyle = "#f3ead8";
    g.lineWidth = 8;
    g.strokeRect(14, 14, 996, 172);
    g.fillStyle = "#f3ead8";
    g.font = "italic 700 78px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(data.centre, 512, 92);
    g.font = "500 30px Georgia, serif";
    g.fillText("Maths · Science · Classes 6 to 10", 512, 158);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [data.centre]);

  return (
    <group position={[0, 0, LANE_Z - 0.6]}>
      <mesh position={[0, 3.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 6.6, 3]} />
        <meshStandardMaterial map={tex.plaster} normalMap={tex.plasterN} color="#f1e6cf" roughness={0.95} />
      </mesh>
      <mesh position={[0, 5.4, 1.52]}>
        <planeGeometry args={[3.0, 0.6]} />
        <meshStandardMaterial map={sign} roughness={0.8} />
      </mesh>
      {/* classroom window: always warm, the camera settles here */}
      <mesh position={[0, 3.3, 1.51]} name="centre-window">
        <planeGeometry args={[1.8, 1.1]} />
        <meshStandardMaterial color="#3a2a18" emissive="#ffbe6b" emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 3.3, 2.3]} color="#ffbe6b" intensity={3} distance={6} decay={2} />
      {clockTexture && (
        <mesh position={[1.25, 4.45, 1.52]}>
          <circleGeometry args={[0.32, 32]} />
          <meshStandardMaterial map={clockTexture} roughness={0.7} />
        </mesh>
      )}
      <mesh position={[0, 0.95, 1.51]}>
        <planeGeometry args={[0.9, 1.9]} />
        <meshStandardMaterial color="#4a2f1f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 6.75, 0]}>
        <boxGeometry args={[3.4, 0.3, 3.2]} />
        <meshStandardMaterial color="#cdbfa6" roughness={1} />
      </mesh>
    </group>
  );
}

export function Lane({ data, control, clockTexture }: { data: LandingData; control: StageControl; clockTexture?: THREE.Texture }) {
  const tex = useLaneTextures();
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 24]} />
        <meshStandardMaterial map={tex.dirt} normalMap={tex.dirtN} color="#b89a7a" roughness={1} />
      </mesh>
      <Centre data={data} tex={tex} clockTexture={clockTexture} />
      {data.families.map((f, i) => (
        <House key={f.id} f={f} i={i} data={data} control={control} tex={tex} />
      ))}
    </group>
  );
}
