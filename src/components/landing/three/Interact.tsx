"use client";

import { Html } from "@react-three/drei";
import { useSyncExternalStore } from "react";
import { formatINR } from "@/lib/money";
import type { LandingFamily } from "../landing-data";

/** What the cursor is doing on the lane: which house it hovers, and what the visitor has clicked. */
type Action = "chased" | "paid";
type State = { hover: { f: LandingFamily; at: [number, number, number] } | null; acted: Record<string, Action> };

let state: State = { hover: null, acted: {} };
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export const lane = {
  get: () => state,
  subscribe: (fn: () => void) => {
    subs.add(fn);
    return () => subs.delete(fn);
  },
  hover(f: LandingFamily | null, at?: [number, number, number]) {
    state = { ...state, hover: f && at ? { f, at } : null };
    if (typeof document !== "undefined") document.body.style.cursor = f ? "pointer" : "";
    emit();
  },
  /** Click: an owing house gets a reminder (its lamp flickers on, a promise); a promised one pays. */
  act(f: LandingFamily) {
    const now = state.acted[f.id];
    const next: Action = f.status === "owed" && !now ? "chased" : "paid";
    state = { ...state, acted: { ...state.acted, [f.id]: next } };
    emit();
  },
};

export function useLane() {
  return useSyncExternalStore(lane.subscribe, lane.get, lane.get);
}

/** The ledger tag that hangs off the hovered house, like a chit pinned to a door. */
export function LedgerTag() {
  const { hover, acted } = useLane();
  if (!hover) return null;
  const { f, at } = hover;
  const a = acted[f.id];
  const status = a === "paid" || f.status === "paid" ? "Paid" : a === "chased" ? "Reminder sent" : f.status === "promised" ? "Promised" : "Owes";
  const hint = status === "Paid" ? "Window lit. Thank-you note sent." : status === "Owes" ? "Click to send a reminder in Telugu." : "Click to mark it paid.";
  const tone = status === "Paid" ? "#b97c06" : status === "Owes" ? "#b3302b" : "#1b2444";
  return (
    <Html position={at} center distanceFactor={9} zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
      <div
        style={{ transform: "translateY(-70%) rotate(-2deg)", width: 210, background: "#fbf6ea", color: "#1b2444", border: "2px solid #1b2444", boxShadow: "4px 4px 0 #b3302b", padding: "10px 12px", fontFamily: "var(--font-courier), monospace" }}
      >
        <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: tone }}>{status}</div>
        <div style={{ fontFamily: "var(--font-rozha), serif", fontSize: 22, lineHeight: 1.05, marginTop: 2 }}>{f.name}</div>
        <div style={{ fontSize: 11, opacity: 0.75 }}>for {f.kids}</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6, color: tone }}>{formatINR(f.amount)}</div>
        <div style={{ fontSize: 10, marginTop: 6, borderTop: "1px dashed #1b244455", paddingTop: 6 }}>{hint}</div>
      </div>
    </Html>
  );
}
