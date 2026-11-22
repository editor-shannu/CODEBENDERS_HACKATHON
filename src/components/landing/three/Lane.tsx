"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { LandingData, LandingFamily } from "../landing-data";
import type { StageControl } from "../LaneStage";
import { useLaneTextures } from "./materials";
import { lane, useLane } from "./Interact";
import { archShape, FACADE, SHOPS, shutterTexture, signTexture } from "./oldcity";

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
  const w = 2.9;
  const fh = 2.15;
  const h = floors * fh;
  const d = 2.6;
  const paint = FACADE[i % FACADE.length];
  const shop = SHOPS[i % SHOPS.length];
  const win = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useRef<THREE.PointLight>(null);
  const paidOrder = data.families.filter((x) => x.status === "paid").indexOf(f);
  const order = { paid: paidOrder, paidCount: data.families.filter((x) => x.status === "paid").length, defense: data.defense.indexOf(f.id) };
  const { hover, acted } = useLane();
  const hovered = hover?.f.id === f.id;
  const act = acted[f.id];
  const lift = useRef<THREE.Group>(null);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    let lit = litAt(control.progress.current, f, order, t);
    if (act === "paid") lit = Math.max(lit, 1);
    if (act === "chased") lit = Math.max(lit, 0.32 + 0.08 * Math.sin(t * 9) + 0.05 * Math.sin(t * 23));
    if (win.current) {
      win.current.emissiveIntensity = lit * 3.2 + (hovered ? 0.6 : 0);
      win.current.color.setScalar(0.05 + lit * 0.4);
    }
    if (glow.current) glow.current.intensity = lit * 2.2 + (hovered ? 1.2 : 0);
    if (lift.current) {
      const target = hovered ? 0.12 : 0;
      lift.current.position.y = THREE.MathUtils.damp(lift.current.position.y, target, 10, dt);
    }
  });

  const parts = useMemo(() => {
    const wall = new THREE.MeshStandardMaterial({ map: tex.plaster, normalMap: tex.plasterN, color: paint, roughness: 0.95 });
    const sign = signTexture(
      [
        { text: shop.te, font: "600 54px TELUGU", y: 0.36 },
        { text: shop.en.toUpperCase(), font: "700 44px Georgia, serif", y: 0.74 },
      ],
      shop.bg,
      "#f6eedb",
    );
    const shutter = shutterTexture(i % 2 ? "#6f7a83" : "#8a6a3c");
    const arch = new THREE.ShapeGeometry(archShape(0.95, 1.25), 8);
    return { wall, sign, shutter, arch };
  }, [tex, paint, shop, i]);

  const z = LANE_Z - (i % 3) * 0.4;
  return (
    <group
      position={[houseX(i), 0, z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        lane.hover(f, [houseX(i), h + 1.6, z + d / 2]);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        if (lane.get().hover?.f.id === f.id) lane.hover(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        lane.act(f);
      }}
    >
      <group ref={lift}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow material={parts.wall}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {/* ground floor: a shop with a rolling shutter half up and a painted signboard */}
      <mesh position={[0, 0.95, d / 2 + 0.01]}>
        <planeGeometry args={[w * 0.82, 1.9]} />
        <meshStandardMaterial map={parts.shutter} roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.35, d / 2 + 0.015]}>
        <planeGeometry args={[w * 0.82, 0.7]} />
        <meshStandardMaterial color="#2a1d12" emissive="#ffb35c" emissiveIntensity={0.25} roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.0, d / 2 + 0.08]}>
        <planeGeometry args={[w * 0.96, 0.42]} />
        <meshStandardMaterial map={parts.sign} roughness={0.85} />
      </mesh>
      {/* chajja sunshades over each upper floor, and the slab line */}
      {Array.from({ length: floors - 1 }).map((_, k) => (
        <group key={k}>
          <mesh position={[0, fh * (k + 1) + 0.25, d / 2 + 0.3]} rotation={[0.12, 0, 0]} castShadow>
            <boxGeometry args={[w + 0.15, 0.08, 0.6]} />
            <meshStandardMaterial color="#9c9286" roughness={1} />
          </mesh>
          <mesh position={[0, fh * (k + 2) - 0.25, d / 2 + 0.22]} castShadow>
            <boxGeometry args={[w * 0.75, 0.06, 0.45]} />
            <meshStandardMaterial color="#8f877c" roughness={1} />
          </mesh>
        </group>
      ))}
      {/* first-floor balcony with a wrought-iron grill and a tulsi pot */}
      <group position={[0, fh + 0.3, d / 2 + 0.45]}>
        <mesh castShadow>
          <boxGeometry args={[w * 0.8, 0.1, 0.9]} />
          <meshStandardMaterial color="#a2978a" roughness={1} />
        </mesh>
        {Array.from({ length: 11 }).map((_, k) => (
          <mesh key={k} position={[-w * 0.38 + (k * w * 0.76) / 10, 0.45, 0.42]}>
            <boxGeometry args={[0.025, 0.8, 0.025]} />
            <meshStandardMaterial color="#20262b" metalness={0.6} roughness={0.5} />
          </mesh>
        ))}
        {[0.05, 0.85].map((y) => (
          <mesh key={y} position={[0, y, 0.42]}>
            <boxGeometry args={[w * 0.8, 0.04, 0.04]} />
            <meshStandardMaterial color="#20262b" metalness={0.6} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[w * 0.3, 0.2, 0.2]}>
          <cylinderGeometry args={[0.12, 0.09, 0.22, 10]} />
          <meshStandardMaterial color="#9a4f33" roughness={1} />
        </mesh>
        <mesh position={[w * 0.3, 0.42, 0.2]}>
          <icosahedronGeometry args={[0.16, 1]} />
          <meshStandardMaterial color="#4f6b34" roughness={1} flatShading />
        </mesh>
      </group>
      {/* the family's window, a pointed arch: lit means paid */}
      <mesh position={[0, fh + 0.55, d / 2 + 0.012]} geometry={parts.arch}>
        <meshStandardMaterial ref={win} color="#0d1118" emissive="#ffb35c" emissiveIntensity={0} roughness={0.4} toneMapped={false} />
      </mesh>
      <pointLight ref={glow} position={[0, fh + 1.1, d / 2 + 0.6]} color="#ffb35c" intensity={0} distance={4} decay={2} />
      {/* upper floors: plain windows with green wooden shutters */}
      {Array.from({ length: floors - 1 }).map((_, k) => (
        <group key={`u${k}`} position={[0, fh * (k + 2) - 1.05, d / 2 + 0.012]}>
          {[-0.75, 0.75].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh>
                <planeGeometry args={[0.6, 0.9]} />
                <meshStandardMaterial color="#14181e" roughness={0.6} />
              </mesh>
              <mesh position={[-0.42, 0, 0.01]}>
                <planeGeometry args={[0.24, 0.9]} />
                <meshStandardMaterial color="#2f6b55" roughness={0.8} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {/* flat terrace: parapet, a black water tank and a dish */}
      <mesh position={[0, h + 0.3, d / 2 - 0.05]}>
        <boxGeometry args={[w, 0.6, 0.12]} />
        <meshStandardMaterial color={paint} roughness={1} />
      </mesh>
      <mesh position={[0, h + 0.05, 0]}>
        <boxGeometry args={[w + 0.06, 0.12, d + 0.06]} />
        <meshStandardMaterial color="#8d857a" roughness={1} />
      </mesh>
      <mesh position={[(i % 2 ? -1 : 1) * 0.7, h + 0.55, -0.4]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.9, 16]} />
        <meshStandardMaterial color="#15171a" roughness={0.55} />
      </mesh>
      {i % 3 === 1 && (
        <mesh position={[-0.8, h + 0.8, 0.4]} rotation={[0.5, 0.6, 0]}>
          <cylinderGeometry args={[0.3, 0.05, 0.12, 14]} />
          <meshStandardMaterial color="#d8d6d0" roughness={0.6} />
        </mesh>
      )}
      </group>
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
    g.fillStyle = "#e9a51c";
    g.fillRect(0, 0, 1024, 200);
    g.strokeStyle = "#1b2444";
    g.lineWidth = 8;
    g.strokeRect(14, 14, 996, 172);
    g.fillStyle = "#b3302b";
    g.font = "700 72px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(data.centre.toUpperCase(), 512, 84, 960);
    g.fillStyle = "#1b2444";
    g.font = "600 32px Georgia, serif";
    g.fillText("Maths · Science · Classes 6 to 10 · Ph. 98XXX XXXXX", 512, 154, 960);
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
