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

// Deterministic pseudo-random so the starfield is stable across renders of
// the same gate (looks janky if stars jump on every request).
function seeded(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildStarfield(seed: number, count = 70): string {
  const rnd = seeded(seed);
  const stars: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round(rnd() * 400);
    const y = Math.round(rnd() * 400);
    const r = +(rnd() * 1.3 + 0.2).toFixed(2);
    const op = +(rnd() * 0.55 + 0.2).toFixed(2);
    const dur = +(rnd() * 2.5 + 1.8).toFixed(2);
    const delay = +(rnd() * 3).toFixed(2);
    stars.push(
      `<circle cx="${x}" cy="${y}" r="${r}" fill="#e9d5ff" opacity="${op}">
        <animate attributeName="opacity" values="${op};${(op * 0.15).toFixed(2)};${op}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />
      </circle>`,
    );
  }
  return stars.join("\n");
}

export function renderBodyGraph(activeGate: number, activeLine: number): string {
  const activeCenter = GATE_TO_CENTER[activeGate] ?? "g";
  const starfield = buildStarfield(activeGate * 97 + activeLine);

  // Channel lines drawn first so the centers sit on top of them.
  const channelLines = CHANNELS.map(([a, b]) => {
    const A = CENTER_GEOM[a];
    const B = CENTER_GEOM[b];
    const isActiveChan = a === activeCenter || b === activeCenter;
    const stroke = isActiveChan ? "#c4b5fd" : "#2a2a45";
    const sw = isActiveChan ? 2 : 1.1;
    const op = isActiveChan ? 0.85 : 0.45;
    const filter = isActiveChan ? ` filter="url(#softGlow)"` : "";
    return `<line x1="${A.cx}" y1="${A.cy}" x2="${B.cx}" y2="${B.cy}" stroke="${stroke}" stroke-width="${sw}" opacity="${op}" stroke-linecap="round"${filter} />`;
  }).join("\n  ");

  const centers = (Object.keys(CENTER_GEOM) as Center[]).map((key) => {
    const geom = CENTER_GEOM[key];
    const isActive = key === activeCenter;
    const fill = isActive ? "url(#activeGrad)" : "url(#dormantGrad)";
    const stroke = isActive ? "#e9d5ff" : "#3a3a5a";
    const strokeW = isActive ? 2 : 1.2;
    const filter = isActive ? ` filter="url(#softGlow)"` : "";

    let shapeEl: string;
    if (key === "g") {
      shapeEl = `<rect x="${geom.cx - geom.size}" y="${geom.cy - geom.size}" width="${geom.size * 2}" height="${geom.size * 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" transform="rotate(45 ${geom.cx} ${geom.cy})"${filter} />`;
    } else {
      shapeEl = `<path d="${shapePath(geom)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"${filter} />`;
    }

    const label = `<text x="${geom.cx}" y="${geom.cy + 3}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="8" font-weight="500" letter-spacing="0.5" fill="${isActive ? "#ffffff" : "#5b5b7a"}">${CENTER_LABELS[key]}</text>`;

    // Layered pulse rings on the active center for a mystical "breathing" feel.
    const pulse = isActive
      ? `<circle cx="${geom.cx}" cy="${geom.cy}" r="${geom.size + 2}" fill="none" stroke="#c4b5fd" stroke-width="1.2" opacity="0.55">
           <animate attributeName="r" from="${geom.size + 2}" to="${geom.size + 18}" dur="3s" repeatCount="indefinite" />
           <animate attributeName="opacity" from="0.65" to="0" dur="3s" repeatCount="indefinite" />
         </circle>
         <circle cx="${geom.cx}" cy="${geom.cy}" r="${geom.size + 2}" fill="none" stroke="#a78bfa" stroke-width="1" opacity="0.4">
           <animate attributeName="r" from="${geom.size + 2}" to="${geom.size + 22}" dur="3s" begin="1s" repeatCount="indefinite" />
           <animate attributeName="opacity" from="0.5" to="0" dur="3s" begin="1s" repeatCount="indefinite" />
         </circle>`
      : "";

    return pulse + shapeEl + label;
  }).join("\n");

  // Serif, letter-spaced gate label — feels more occult.
  const gateLabel = `<text x="200" y="378" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" font-weight="400" letter-spacing="3" fill="#c4b5fd">GATE ${activeGate} · LINE ${activeLine}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <radialGradient id="activeGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#c4b5fd" stop-opacity="0.95" />
      <stop offset="55%" stop-color="#7c3aed" stop-opacity="0.75" />
      <stop offset="100%" stop-color="#4c1d95" stop-opacity="0.45" />
    </radialGradient>
    <radialGradient id="dormantGrad" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#1e1b4b" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#0f0f23" stop-opacity="0.95" />
    </radialGradient>
    <radialGradient id="bgGrad" cx="50%" cy="42%" r="85%">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="55%" stop-color="#0b0820" />
      <stop offset="100%" stop-color="#050514" />
    </radialGradient>
    <radialGradient id="nebula" cx="50%" cy="50%" r="45%">
      <stop offset="0%" stop-color="#6d28d9" stop-opacity="0.22" />
      <stop offset="70%" stop-color="#6d28d9" stop-opacity="0" />
    </radialGradient>
    <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <rect width="400" height="400" fill="url(#bgGrad)" />
  <rect width="400" height="400" fill="url(#nebula)" />

  <!-- Starfield -->
  ${starfield}

  <!-- Decorative ring behind the bodygraph -->
  <circle cx="200" cy="195" r="175" fill="none" stroke="#3a2e6b" stroke-width="1" opacity="0.45" stroke-dasharray="2 5" />
  <circle cx="200" cy="195" r="182" fill="none" stroke="#2a2450" stroke-width="0.6" opacity="0.6" />

  ${channelLines}
  ${centers}
  ${gateLabel}
</svg>`;
}
