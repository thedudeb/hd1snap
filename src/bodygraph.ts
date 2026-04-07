// Stylized Human Design BodyGraph as an animated SVG.
// Renders the 9 centers in their canonical layout and pulses the center
// that contains the given active gate.

export const GATE_TO_CENTER: Record<number, Center> = (() => {
  const map: Record<number, Center> = {};
  const groups: Array<[Center, number[]]> = [
    ["head",   [64, 61, 63]],
    ["ajna",   [47, 24, 4, 17, 43, 11]],
    ["throat", [62, 23, 56, 16, 20, 31, 8, 33, 35, 12, 45]],
    ["g",      [1, 2, 7, 10, 13, 15, 25, 46]],
    ["heart",  [21, 26, 40, 51]],
    ["spleen", [18, 28, 32, 44, 48, 50, 57]],
    ["solar",  [6, 22, 30, 36, 37, 49, 55]],
    ["sacral", [3, 5, 9, 14, 27, 29, 34, 42, 59]],
    ["root",   [19, 38, 39, 41, 52, 53, 54, 58, 60]],
  ];
  for (const [center, gates] of groups) for (const g of gates) map[g] = center;
  return map;
})();

export type Center =
  | "head" | "ajna" | "throat" | "g" | "heart"
  | "spleen" | "solar" | "sacral" | "root";

const CENTER_LABELS: Record<Center, string> = {
  head: "Head",
  ajna: "Ajna",
  throat: "Throat",
  g: "G",
  heart: "Heart",
  spleen: "Spleen",
  solar: "Solar Plexus",
  sacral: "Sacral",
  root: "Root",
};

// Layout: 400 × 400 square viewBox so it fits the 1:1 image slot exactly.
const CENTER_GEOM: Record<Center, { shape: "triangle-up" | "triangle-down" | "square"; cx: number; cy: number; size: number }> = {
  head:   { shape: "triangle-down", cx: 200, cy: 38,  size: 22 },
  ajna:   { shape: "triangle-up",   cx: 200, cy: 88,  size: 22 },
  throat: { shape: "square",        cx: 200, cy: 138, size: 20 },
  g:      { shape: "square",        cx: 200, cy: 195, size: 20 }, // rotated 45° → diamond
  heart:  { shape: "triangle-down", cx: 260, cy: 195, size: 20 },
  spleen: { shape: "triangle-up",   cx: 105, cy: 245, size: 20 },
  sacral: { shape: "square",        cx: 200, cy: 252, size: 20 },
  solar:  { shape: "triangle-up",   cx: 295, cy: 245, size: 20 },
  root:   { shape: "square",        cx: 200, cy: 312, size: 20 },
};

function shapePath(c: { shape: string; cx: number; cy: number; size: number }) {
  const { shape, cx, cy, size } = c;
  const h = size;
  if (shape === "triangle-down") {
    return `M ${cx - h} ${cy - h * 0.6} L ${cx + h} ${cy - h * 0.6} L ${cx} ${cy + h * 0.7} Z`;
  }
  if (shape === "triangle-up") {
    return `M ${cx - h} ${cy + h * 0.6} L ${cx + h} ${cy + h * 0.6} L ${cx} ${cy - h * 0.7} Z`;
  }
  // square (G is rotated visually via the rect in render)
  return `M ${cx - h} ${cy - h} L ${cx + h} ${cy - h} L ${cx + h} ${cy + h} L ${cx - h} ${cy + h} Z`;
}

// Adjacency: which center pairs have at least one channel between them.
const CHANNELS: Array<[Center, Center]> = [
  ["head", "ajna"],
  ["ajna", "throat"],
  ["throat", "g"],
  ["throat", "heart"],
  ["throat", "spleen"],
  ["throat", "solar"],
  ["throat", "sacral"],
  ["g", "heart"],
  ["g", "sacral"],
  ["g", "spleen"],
  ["heart", "spleen"],
  ["heart", "solar"],
  ["spleen", "sacral"],
  ["spleen", "root"],
  ["sacral", "solar"],
  ["sacral", "root"],
  ["solar", "root"],
];

export function renderBodyGraph(activeGate: number, activeLine: number): string {
  const activeCenter = GATE_TO_CENTER[activeGate] ?? "g";

  // Channel lines drawn first so the centers sit on top of them.
  const channelLines = CHANNELS.map(([a, b]) => {
    const A = CENTER_GEOM[a];
    const B = CENTER_GEOM[b];
    const isActiveChan = a === activeCenter || b === activeCenter;
    const stroke = isActiveChan ? "#a78bfa" : "#2a2a45";
    const sw = isActiveChan ? 2 : 1.2;
    const op = isActiveChan ? 0.85 : 0.6;
    return `<line x1="${A.cx}" y1="${A.cy}" x2="${B.cx}" y2="${B.cy}" stroke="${stroke}" stroke-width="${sw}" opacity="${op}" stroke-linecap="round" />`;
  }).join("\n  ");

  const centers = (Object.keys(CENTER_GEOM) as Center[]).map((key) => {
    const geom = CENTER_GEOM[key];
    const isActive = key === activeCenter;
    const fill = isActive ? "url(#activeGrad)" : "#1a1a2e";
    const stroke = isActive ? "#a78bfa" : "#3a3a5a";
    const strokeW = isActive ? 3 : 1.5;

    let shapeEl: string;
    if (key === "g") {
      // diamond
      shapeEl = `<rect x="${geom.cx - geom.size}" y="${geom.cy - geom.size}" width="${geom.size * 2}" height="${geom.size * 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" transform="rotate(45 ${geom.cx} ${geom.cy})" />`;
    } else {
      shapeEl = `<path d="${shapePath(geom)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" />`;
    }

    const label = `<text x="${geom.cx}" y="${geom.cy + 3}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="8" font-weight="600" fill="${isActive ? "#ffffff" : "#6b6b8a"}">${CENTER_LABELS[key]}</text>`;

    // Pulse ring on active center
    const pulse = isActive
      ? `<circle cx="${geom.cx}" cy="${geom.cy}" r="${geom.size + 2}" fill="none" stroke="#a78bfa" stroke-width="1.5" opacity="0.6">
           <animate attributeName="r" from="${geom.size + 2}" to="${geom.size + 14}" dur="2.2s" repeatCount="indefinite" />
           <animate attributeName="opacity" from="0.7" to="0" dur="2.2s" repeatCount="indefinite" />
         </circle>`
      : "";

    return pulse + shapeEl + label;
  }).join("\n");

  // Active gate label below the bodygraph
  const gateLabel = `<text x="200" y="378" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="#a78bfa">Gate ${activeGate} · Line ${activeLine}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <radialGradient id="activeGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#a78bfa" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#6d28d9" stop-opacity="0.5" />
    </radialGradient>
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#0a0a1a" />
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bgGrad)" />
  ${channelLines}
  ${centers}
  ${gateLabel}
</svg>`;
}
