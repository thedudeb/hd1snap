/**
 * Simplified astronomical calculations for Human Design transits.
 * Solar longitude using Jean Meeus "Astronomical Algorithms" Ch.25 (low-precision).
 * Accurate to ~0.01° — more than enough for HD gate/line resolution.
 */

export interface SolarPosition {
  longitude: number; // ecliptic longitude in degrees [0, 360)
  gate: number;      // HD gate number (1–64)
  line: number;      // HD line (1–6)
}

export interface MoonPosition {
  phase: number;     // 0–1 (0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter)
  phaseName: string;
  emoji: string;
  longitude: number;
  gate: number;
  line: number;
}

// Mean daily motion in degrees (ecliptic longitude).
export const SUN_DAILY_MOTION  = 0.9856473598;
export const MOON_DAILY_MOTION = 13.176396;

// The 64 HD gates mapped sequentially around the solar wheel,
// starting at ~302.5° ecliptic longitude (≈ Jan 3, Gate 41 Line 1).
export const GATE_SEQUENCE: number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24,  2, 23,  8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33,  7,  4, 29, 59, 40, 64, 47,  6, 46, 18, 48, 57, 32, 50,
  28, 44,  1, 43, 14, 34,  9,  5, 26, 11, 10, 58, 38, 54, 61, 60,
];

const HD_START_LONGITUDE = 302.5; // Gate 41 Line 1 starts here
const GATE_SPAN = 360 / 64;       // 5.625° per gate
const LINE_SPAN = GATE_SPAN / 6;  // 0.9375° per line

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Compute approximate solar ecliptic longitude for a given date.
 */
export function getSolarLongitude(date: Date): number {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525;

  // Mean longitude
  let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  L0 = ((L0 % 360) + 360) % 360;

  // Mean anomaly
  let M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  M = ((M % 360) + 360) % 360;
  const Mrad = toRad(M);

  // Equation of center
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);

  // Apparent longitude (subtract aberration + nutation approx)
  const omega = 125.04 - 1934.136 * T;
  let lon = L0 + C - 0.00569 - 0.00478 * Math.sin(toRad(omega));
  lon = ((lon % 360) + 360) % 360;
  return lon;
}

/**
 * Map an ecliptic longitude to an HD gate + line.
 */
export function longitudeToGateLine(longitude: number): { gate: number; line: number } {
  const normalized = ((longitude - HD_START_LONGITUDE) % 360 + 360) % 360;
  const gateIndex = Math.floor(normalized / GATE_SPAN);
  const lineFloat = (normalized % GATE_SPAN) / LINE_SPAN;
  const line = Math.min(Math.floor(lineFloat) + 1, 6);
  return { gate: GATE_SEQUENCE[gateIndex % 64], line };
}

/**
 * Get full solar position for a date.
 */
export function getSolarPosition(date: Date): SolarPosition {
  const longitude = getSolarLongitude(date);
  const { gate, line } = longitudeToGateLine(longitude);
  return { longitude, gate, line };
}

/**
 * Earth is always exactly 180° opposite the Sun.
 * Returns the HD gate + line of the Earth for a given date.
 */
export function getEarthPosition(date: Date): { gate: number; line: number } {
  const sunLon = getSolarLongitude(date);
  const earthLon = (sunLon + 180) % 360;
  return longitudeToGateLine(earthLon);
}

/**
 * Approximate lunar phase and position.
 */
export function getMoonPosition(date: Date): MoonPosition {
  const JD = date.getTime() / 86400000 + 2440587.5;

  // Synodic month = 29.53058867 days
  // Known new moon: Jan 6, 2000 18:14 UTC = JD 2451549.259
  const KNOWN_NEW_MOON = 2451549.259;
  const SYNODIC_MONTH = 29.53058867;

  const phase = ((JD - KNOWN_NEW_MOON) % SYNODIC_MONTH + SYNODIC_MONTH) % SYNODIC_MONTH / SYNODIC_MONTH;

  let phaseName: string;
  let emoji: string;
  if (phase < 0.0625)      { phaseName = "New Moon";        emoji = "🌑"; }
  else if (phase < 0.1875) { phaseName = "Waxing Crescent"; emoji = "🌒"; }
  else if (phase < 0.3125) { phaseName = "First Quarter";   emoji = "🌓"; }
  else if (phase < 0.4375) { phaseName = "Waxing Gibbous";  emoji = "🌔"; }
  else if (phase < 0.5625) { phaseName = "Full Moon";       emoji = "🌕"; }
  else if (phase < 0.6875) { phaseName = "Waning Gibbous";  emoji = "🌖"; }
  else if (phase < 0.8125) { phaseName = "Last Quarter";    emoji = "🌗"; }
  else if (phase < 0.9375) { phaseName = "Waning Crescent"; emoji = "🌘"; }
  else                     { phaseName = "New Moon";        emoji = "🌑"; }

  // Approximate moon longitude: moon travels ~13.176° per day
  const MOON_START_LON = 218.316; // J2000 moon longitude
  const T_days = JD - 2451545.0;
  let moonLon = ((MOON_START_LON + MOON_DAILY_MOTION * T_days) % 360 + 360) % 360;

  const { gate, line } = longitudeToGateLine(moonLon);
  return { phase, phaseName, emoji, longitude: moonLon, gate, line };
}

/**
 * Compute the next gate and line boundary crossings for a body at the given
 * longitude, travelling at `dailyMotion` degrees per day. Returns ms until
 * each boundary plus the upcoming gate/line numbers.
 */
export function nextTransitions(longitude: number, dailyMotion: number) {
  const normalized = ((longitude - HD_START_LONGITUDE) % 360 + 360) % 360;

  const degreesIntoGate = normalized % GATE_SPAN;
  const degreesToNextGate = GATE_SPAN - degreesIntoGate;

  const degreesIntoLine = normalized % LINE_SPAN;
  const degreesToNextLine = LINE_SPAN - degreesIntoLine;

  const msPerDegree = 86_400_000 / dailyMotion;
  const msUntilNextGate = degreesToNextGate * msPerDegree;
  const msUntilNextLine = degreesToNextLine * msPerDegree;

  // Figure out what the next gate/line actually are.
  const currentGateIdx = Math.floor(normalized / GATE_SPAN);
  const nextGate = GATE_SEQUENCE[(currentGateIdx + 1) % 64];

  const currentLineInGate = Math.min(Math.floor(degreesIntoGate / LINE_SPAN) + 1, 6);
  const nextLine = currentLineInGate === 6 ? 1 : currentLineInGate + 1;

  return {
    msUntilNextGate,
    msUntilNextLine,
    nextGate,
    nextLine,
  };
}
