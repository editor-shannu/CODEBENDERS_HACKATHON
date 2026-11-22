import * as THREE from "three";

/** A Qutb Shahi pointed arch: straight jambs up to the springing line, then two arcs meeting at the apex. */
export function archPath(path: THREE.Path | THREE.Shape, cx: number, y0: number, w: number, h: number) {
  const r = w * 0.8; // arc radius > half-width gives the pointed (four-centred-ish) profile
  const spring = y0 + h - Math.sqrt(r * r - (r - w / 2) ** 2);
  path.moveTo(cx - w / 2, y0);
  path.lineTo(cx + w / 2, y0);
  path.lineTo(cx + w / 2, spring);
  // right arc: centre at (cx + w/2 - r, spring)
  const steps = 10;
  const a0 = 0;
  const a1 = Math.acos((r - w / 2) / r);
  for (let s = 1; s <= steps; s++) {
    const a = a0 + ((a1 - a0) * s) / steps;
    path.lineTo(cx + w / 2 - r + r * Math.cos(a), spring + r * Math.sin(a));
  }
  for (let s = steps - 1; s >= 0; s--) {
    const a = a0 + ((a1 - a0) * s) / steps;
    path.lineTo(cx - w / 2 + r - r * Math.cos(a), spring + r * Math.sin(a));
  }
  path.lineTo(cx - w / 2, y0);
  return path;
}

export function archShape(w: number, h: number) {
  return archPath(new THREE.Shape(), 0, 0, w, h) as THREE.Shape;
}

/** A wall panel w x h (bottom-centred) with arch openings cut out, extruded to depth d. */
export function archedWall(w: number, h: number, d: number, arches: { cx: number; y: number; w: number; h: number }[]) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.lineTo(-w / 2, h);
  s.lineTo(-w / 2, 0);
  for (const a of arches) {
    const hole = new THREE.Path();
    archPath(hole, a.cx, a.y, a.w, a.h);
    s.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -d / 2);
  return g;
}

/** Minaret profile for a lathe: shaft with two balconies, a fluted cap and an onion-shaped dome with finial. */
export function minaretProfile(scale = 1) {
  const p: [number, number][] = [
    [1.9, 0], [1.75, 20], [2.6, 20.2], [2.6, 21.2], [1.6, 21.6], [1.5, 33], [2.4, 33.2], [2.4, 34.1], [1.4, 34.5],
    [1.3, 44], [2.0, 44.2], [2.0, 45], [1.25, 45.4], [1.2, 49], [1.55, 49.3], [1.7, 50.4], [1.5, 51.6], [1.0, 52.6], [0.4, 53.4], [0.12, 54.6], [0.06, 56], [0, 56.2],
  ];
  return p.map(([x, y]) => new THREE.Vector2(x * scale, y * scale));
}

/** Hand-painted shop signboard as a canvas texture. Telugu falls back to the device's Telugu font. */
export function signTexture(lines: { text: string; font: string; y: number }[], bg: string, fg: string, w = 768, h = 192) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const telugu = getComputedStyle(document.documentElement).getPropertyValue("--font-telugu").split(",")[0].trim() || "'Noto Sans Telugu'";
  // only the web font goes to fonts.load (its local() fallback face makes the promise reject); system Telugu fonts stay as fallbacks for painting
  const family = `${telugu}, 'Noto Sans Telugu', 'Nirmala UI', 'Kohinoor Telugu', Gautami, sans-serif`;
  const resolved = lines.map((l) => ({ ...l, font: l.font.replace("TELUGU", family) }));
  const toLoad = lines.filter((l) => l.font.includes("TELUGU")).map((l) => ({ font: l.font.replace("TELUGU", telugu), text: l.text }));
  const paint = () => drawSign(c, resolved, bg, fg);
  paint();
  // canvas text needs the web font loaded first; repaint once it is
  if (document.fonts) {
    Promise.all(toLoad.map((l) => document.fonts.load(l.font, l.text)))
      .then(() => {
        paint();
        t.needsUpdate = true;
      })
      .catch(() => {});
  }
  return t;
}

function drawSign(c: HTMLCanvasElement, lines: { text: string; font: string; y: number }[], bg: string, fg: string) {
  const w = c.width;
  const h = c.height;
  const g = c.getContext("2d")!;
  g.globalAlpha = 1;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const l of lines) {
    g.font = l.font;
    g.fillText(l.text, w / 2, l.y * h, w - 40);
  }
  // weathering: a few paler speckles so it doesn't read as a print
  g.globalAlpha = 0.12;
  g.fillStyle = "#ffffff";
  for (let i = 0; i < 120; i++) g.fillRect((i * 97) % w, (i * 53) % h, 2 + (i % 3), 1 + (i % 2));
}

/** Rolling shutter: corrugated stripes. */
export function shutterTexture(colour = "#7d8288") {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = colour;
  g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 8) {
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.fillRect(0, y, 64, 2);
    g.fillStyle = "rgba(255,255,255,0.10)";
    g.fillRect(0, y + 3, 64, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Old-city facade paints: lime white, mint, rose, powder blue, haldi cream. */
export const FACADE = ["#ece6d6", "#a9c7a4", "#e3b2a3", "#a3c0cf", "#e8d590", "#d9cbb8", "#c7d9c1", "#e9c9b3"];

/** Ground-floor shops seen on old-city lanes. */
export const SHOPS = [
  { en: "Bismillah Bangle Store", te: "బిస్మిల్లా గాజుల దుకాణం", bg: "#1f6b4f" },
  { en: "Sri Sai Kirana & General", te: "శ్రీ సాయి కిరాణా", bg: "#b3302b" },
  { en: "Deccan Mobile Point", te: "డెక్కన్ మొబైల్ పాయింట్", bg: "#1b2444" },
  { en: "Laxmi Ladies Tailors", te: "లక్ష్మి లేడీస్ టైలర్స్", bg: "#7a2e5a" },
  { en: "Nawab Attar House", te: "నవాబ్ అత్తర్ హౌస్", bg: "#3b5f2a" },
  { en: "Venkateshwara Xerox", te: "వెంకటేశ్వర జిరాక్స్", bg: "#c7861a" },
];
