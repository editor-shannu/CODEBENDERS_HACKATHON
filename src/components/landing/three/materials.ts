"use client";

import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

const SRC = {
  plaster: "/3d/painted_plaster_wall_diff.webp",
  plasterN: "/3d/painted_plaster_wall_nor_gl.webp",
  roof: "/3d/clay_roof_tiles_02_diff.webp",
  roofN: "/3d/clay_roof_tiles_02_nor_gl.webp",
  dirt: "/3d/dirt_diff.webp",
  dirtN: "/3d/dirt_nor_gl.webp",
};

/** Poly Haven CC0 textures (public/3d), repeat-wrapped. */
export function useLaneTextures() {
  const t = useTexture(SRC);
  return useMemo(() => {
    for (const [k, tex] of Object.entries(t)) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      if (!k.endsWith("N")) tex.colorSpace = THREE.SRGBColorSpace;
    }
    t.dirt.repeat.set(12, 3);
    t.dirtN.repeat.set(12, 3);
    return t;
  }, [t]);
}

/** Washed plaster tints seen on Hyderabad colony houses. */
export const PLASTER_TINTS = ["#efe2c8", "#e9cfa7", "#d9c7b0", "#e6d3ad", "#c9d2c4", "#ead9c0", "#e2c2a6", "#d8d0bd"];
