"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { archedWall, minaretProfile } from "./oldcity";
import type { StageControl } from "../LaneStage";
import { nightAt } from "./Rig";
import { HOUSE_GAP } from "./Lane";

/**
 * Charminar (1591): a 20 m square of four great pointed arches, an arcaded upper gallery and a
 * mosque storey, with four 56 m minarets, each ringed by two balconies and capped by a bulbous dome.
 * Built here at its real proportions from extruded arch shapes and lathed minarets.
 */
export function Charminar({ control }: { control: StageControl }) {
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const lamps = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const n = nightAt(control.progress.current);
    if (glow.current) glow.current.emissiveIntensity = n * 2.4;
    if (lamps.current) lamps.current.emissiveIntensity = n * 3.5;
  });
  const geo = useMemo(() => {
    const face = archedWall(20, 21, 2.2, [{ cx: 0, y: 0, w: 11, h: 18.5 }]);
    const arcade = archedWall(20, 5, 1.2, Array.from({ length: 7 }, (_, k) => ({ cx: -7.8 + k * 2.6, y: 0.6, w: 1.7, h: 3.6 })));
    const minaret = new THREE.LatheGeometry(minaretProfile(1), 14);
    const dome = new THREE.LatheGeometry(
      [[0, 0], [2.4, 0], [2.8, 0.8], [2.6, 2], [1.6, 3.2], [0.5, 3.9], [0.1, 4.6], [0, 4.8]].map(([x, y]) => new THREE.Vector2(x, y)),
      14,
    );
    return { face, arcade, minaret, dome };
  }, []);
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: "#cdbb98", roughness: 0.95 }), []);
  const sides = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  return (
    <group position={[22, 0, -95]} rotation={[0, -0.35, 0]} scale={1.05}>
      {/* four arched faces and the glowing inner vault */}
      {sides.map((r) => (
        <group key={r} rotation={[0, r, 0]}>
          <mesh geometry={geo.face} material={stone} position={[0, 0, 10]} />
          <mesh geometry={geo.arcade} material={stone} position={[0, 23.5, 10]} />
          <mesh position={[0, 21.7, 10.6]} material={stone}>
            <boxGeometry args={[21, 1.4, 1.6]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 9, 0]}>
        <boxGeometry args={[17.6, 18, 17.6]} />
        <meshStandardMaterial ref={glow} color="#2a231b" emissive="#ffc27a" emissiveIntensity={0} roughness={1} toneMapped={false} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 20.5, 0]} material={stone}>
        <boxGeometry args={[19, 1.5, 19]} />
      </mesh>
      <mesh position={[0, 26, 0]} material={stone}>
        <boxGeometry args={[20.5, 1, 20.5]} />
      </mesh>
      {/* the mosque storey on top, set back */}
      <mesh position={[0, 28.5, -3]} material={stone}>
        <boxGeometry args={[14, 4, 8]} />
      </mesh>
      {/* minarets at the four corners */}
      {[[-10, -10], [10, -10], [-10, 10], [10, 10]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh geometry={geo.minaret} material={stone} />
          <mesh position={[0, 21.3, 0]}>
            <torusGeometry args={[2.5, 0.08, 4, 20]} />
            <meshStandardMaterial ref={x === -10 && z === -10 ? lamps : undefined} color="#3a3026" emissive="#ffd08a" emissiveIntensity={0} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* small domes over the mosque storey */}
      {[-4.5, 4.5].map((x) => (
        <mesh key={x} geometry={geo.dome} material={stone} position={[x, 30.5, -3]} scale={0.55} />
      ))}
    </group>
  );
}

export function CityBlocks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 420;
  const data = useMemo(() => {
    const rnd = mulberry(7);
    const out: { x: number; z: number; w: number; h: number; d: number; c: THREE.Color }[] = [];
    const tints = ["#d9c7b0", "#cbb79a", "#e3d2b5", "#b7a58c", "#c9c2b2", "#d8bfa0"];
    while (out.length < count) {
      const x = (rnd() - 0.5) * 260;
      const z = -150 + rnd() * 170;
      if (Math.abs(z + 2) < 11 && Math.abs(x) < 50) continue; // keep the lane clear
      if (Math.hypot(x - 26, z + 105) < 30) continue; // and Charminar's square
      const h = 3 + rnd() * rnd() * 14;
      out.push({ x, z, w: 3 + rnd() * 5, h, d: 3 + rnd() * 5, c: new THREE.Color(tints[Math.floor(rnd() * tints.length)]) });
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    data.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x, b.h / 2, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
      ref.current?.setMatrixAt(i, m);
      ref.current?.setColorAt(i, b.c);
    });
    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    }
  }, [data]);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -60]}>
        <planeGeometry args={[400, 260]} />
        <meshStandardMaterial color="#6e5f50" roughness={1} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <boxGeometry />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
    </>
  );
}

/** A neem tree whose leaves breathe in the evening breeze. */
export function NeemTree({ position }: { position: THREE.Vector3Tuple }) {
  const crown = useRef<THREE.Group>(null);
  const blobs = useMemo(() => {
    const rnd = mulberry(3);
    return Array.from({ length: 14 }, () => ({ p: [(rnd() - 0.5) * 3.2, 5 + rnd() * 2.2, (rnd() - 0.5) * 2.6] as THREE.Vector3Tuple, s: 0.8 + rnd() * 0.7, c: rnd() > 0.5 ? "#4d6b33" : "#5c7a3a" }));
  }, []);
  useFrame(({ clock }) => {
    if (!crown.current) return;
    crown.current.rotation.z = Math.sin(clock.elapsedTime * 0.8) * 0.02;
    crown.current.rotation.x = Math.sin(clock.elapsedTime * 0.6 + 1) * 0.015;
  });
  return (
    <group position={position}>
      <mesh position={[0, 2.4, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.3, 4.8, 8]} />
        <meshStandardMaterial color="#4a3a2c" roughness={1} />
      </mesh>
      <group ref={crown}>
        {blobs.map((b, i) => (
          <mesh key={i} position={b.p} scale={b.s} castShadow>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={b.c} roughness={1} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Irani chai stall with steam rising from the kettle. */
export function ChaiStall({ position }: { position: THREE.Vector3Tuple }) {
  const steam = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    steam.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.35 + i / 6) % 1;
      c.position.set(Math.sin(t * 6 + i) * 0.12, 1.3 + t * 1.4, 0);
      c.scale.setScalar(0.12 + t * 0.35);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.22;
    });
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.8, 1.1, 0.9]} />
        <meshStandardMaterial color="#2f5d62" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.1, 0.1]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[2.3, 0.06, 1.4]} />
        <meshStandardMaterial color="#b4432e" roughness={0.9} />
      </mesh>
      {[-1.05, 1.05].map((x) => (
        <mesh key={x} position={[x, 1.1, 0.5]}>
          <cylinderGeometry args={[0.03, 0.03, 2.1, 6]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}
      <mesh position={[0.4, 1.2, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.26, 12]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.8} roughness={0.35} />
      </mesh>
      <group ref={steam} position={[0.4, 0, 0]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color="#e8e4dc" transparent opacity={0.15} depthWrite={false} />
          </mesh>
        ))}
      </group>
      {[-0.6, 0.2, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.25, 1.1]}>
          <cylinderGeometry args={[0.18, 0.18, 0.5, 10]} />
          <meshStandardMaterial color="#6b4a33" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function AutoBody({ lit = false }: { lit?: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.9, 0.7, 1.1]} />
        <meshStandardMaterial color="#e2b13c" roughness={0.6} />
      </mesh>
      <mesh position={[-0.15, 1.15, 0]} castShadow>
        <boxGeometry args={[1.5, 0.6, 1.05]} />
        <meshStandardMaterial color="#1c1f22" roughness={0.7} />
      </mesh>
      <mesh position={[0.97, 0.7, 0]}>
        <circleGeometry args={[0.1, 12]} />
        <meshStandardMaterial color="#fff2cf" emissive="#fff0c2" emissiveIntensity={lit ? 4 : 0.2} toneMapped={false} />
      </mesh>
      {[
        [0.7, 0],
        [-0.65, 0.45],
        [-0.65, -0.45],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.2, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.12, 12]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
    </group>
  );
}

/** Two parked autos, a scooter, and one auto that putters down the lane with its headlight on. */
export function Traffic() {
  const moving = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!moving.current) return;
    const t = (clock.elapsedTime / 22) % 1;
    moving.current.position.set(-40 + t * 80, Math.sin(clock.elapsedTime * 18) * 0.012, 0.6);
  });
  return (
    <>
      <group position={[-HOUSE_GAP * 1.6, 0, -1.6]} rotation={[0, 0.15, 0]}>
        <AutoBody />
      </group>
      <group position={[HOUSE_GAP * 2.4, 0, -1.4]} rotation={[0, Math.PI - 0.1, 0]}>
        <AutoBody />
      </group>
      <group position={[HOUSE_GAP * 0.9, 0, -1.9]} rotation={[0, 0.5, 0]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[1.2, 0.35, 0.35]} />
          <meshStandardMaterial color="#7d1f22" roughness={0.6} />
        </mesh>
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} position={[x, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.08, 12]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        ))}
      </group>
      <group ref={moving}>
        <AutoBody lit />
        <pointLight position={[2.2, 0.6, 0]} intensity={6} distance={8} decay={2} color="#fff0c8" />
      </group>
    </>
  );
}

/** Electric poles with tangled sagging wires and a clothes line between balconies. */
export function Wires() {
  const tubes = useMemo(() => {
    const poles = [-14, -6.5, 5, 13.5].map((x) => new THREE.Vector3(x, 6.2, -0.9));
    const out: THREE.TubeGeometry[] = [];
    for (let i = 0; i < poles.length - 1; i++) {
      for (let k = 0; k < 4; k++) {
        const a = poles[i].clone().add(new THREE.Vector3(0, -k * 0.18, (k % 2) * 0.15));
        const b = poles[i + 1].clone().add(new THREE.Vector3(0, -((k + 1) % 4) * 0.18, 0));
        const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -0.6 - k * 0.15, 0.1 * k));
        out.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, 0.018, 4));
      }
      // a drop to a house
      const a = poles[i].clone();
      const b = new THREE.Vector3(poles[i].x + 1.5, 4.4, -2.7);
      out.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -0.4, 0)), b), 16, 0.015, 4));
    }
    return { poles, out };
  }, []);
  const line = useMemo(() => new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-HOUSE_GAP * 2 + 1, 2.9, -2.4), new THREE.Vector3(-HOUSE_GAP * 1.5, 2.55, -2.3), new THREE.Vector3(-HOUSE_GAP + -1, 2.9, -2.4)), 16, 0.01, 4), []);
  const clothes = ["#b4432e", "#e9e2d0", "#2f5d62", "#e2b13c", "#7b5ea7"];
  return (
    <>
      {tubes.poles.map((p) => (
        <mesh key={p.x} position={[p.x, 3.1, p.z]} castShadow>
          <cylinderGeometry args={[0.08, 0.11, 6.4, 8]} />
          <meshStandardMaterial color="#8d8a84" roughness={1} />
        </mesh>
      ))}
      {tubes.out.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#121418" roughness={0.8} />
        </mesh>
      ))}
      <mesh geometry={line}>
        <meshStandardMaterial color="#d8d2c4" />
      </mesh>
      {clothes.map((c, i) => (
        <mesh key={c} position={[-HOUSE_GAP * 2 + 1.4 + i * 0.55, 2.45 + Math.abs(i - 2) * 0.08, -2.35]}>
          <planeGeometry args={[0.38, 0.55]} />
          <meshStandardMaterial color={c} side={THREE.DoubleSide} roughness={1} />
        </mesh>
      ))}
    </>
  );
}

/** One bird crossing the sky every so often. */
export function Bird() {
  const g = useRef<THREE.Group>(null);
  const l = useRef<THREE.Mesh>(null);
  const r = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime % 30) / 9;
    if (!g.current) return;
    g.current.visible = t < 1;
    g.current.position.set(-30 + t * 60, 14 + Math.sin(t * 3) * 1.5, -18);
    const flap = Math.sin(clock.elapsedTime * 10) * 0.6;
    if (l.current) l.current.rotation.z = flap;
    if (r.current) r.current.rotation.z = -flap;
  });
  return (
    <group ref={g}>
      <mesh ref={l} position={[-0.25, 0, 0]}>
        <boxGeometry args={[0.5, 0.03, 0.15]} />
        <meshBasicMaterial color="#1a1c20" />
      </mesh>
      <mesh ref={r} position={[0.25, 0, 0]}>
        <boxGeometry args={[0.5, 0.03, 0.15]} />
        <meshBasicMaterial color="#1a1c20" />
      </mesh>
    </group>
  );
}

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
