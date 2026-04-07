/**
 * I Ching King Wen sequence — binary patterns for all 64 hexagrams.
 * Each entry is a 6-character string representing the lines from
 * BOTTOM to TOP. "1" = yang (solid line), "0" = yin (broken line).
 *
 * In Human Design, gates are numbered 1–64 corresponding to the
 * I Ching hexagrams in the King Wen sequence.
 */

export const HEXAGRAM_PATTERNS: Record<number, string> = {
  1:  "111111", 2:  "000000", 3:  "100010", 4:  "010001",
  5:  "111010", 6:  "010111", 7:  "010000", 8:  "000010",
  9:  "111011", 10: "110111", 11: "111000", 12: "000111",
  13: "101111", 14: "111101", 15: "001000", 16: "000100",
  17: "100110", 18: "011001", 19: "110000", 20: "000011",
  21: "100101", 22: "101001", 23: "000001", 24: "100000",
  25: "100111", 26: "111001", 27: "100001", 28: "011110",
  29: "010010", 30: "101101", 31: "001110", 32: "011100",
  33: "001111", 34: "111100", 35: "000101", 36: "101000",
  37: "101011", 38: "110101", 39: "001010", 40: "010100",
  41: "110001", 42: "100011", 43: "111110", 44: "011111",
  45: "000110", 46: "011000", 47: "010110", 48: "011010",
  49: "101110", 50: "011101", 51: "100100", 52: "001001",
  53: "001011", 54: "110100", 55: "101100", 56: "001101",
  57: "011011", 58: "110110", 59: "010011", 60: "110010",
  61: "110011", 62: "001100", 63: "101010", 64: "010101",
};

/**
 * Returns the Unicode hexagram glyph for a given gate.
 * The 64 hexagrams live at U+4DC0–U+4DFF in King Wen order.
 */
export function getHexagramGlyph(gate: number): string {
  return String.fromCodePoint(0x4dc0 + (gate - 1));
}

/**
 * Returns the 6 lines of a gate's hexagram as text strings,
 * ordered from line 6 (top) to line 1 (bottom) for visual rendering.
 * Each entry is { text, isYang, lineNumber }.
 */
export function getHexagramLineRows(
  gate: number
): Array<{ text: string; isYang: boolean; lineNumber: number }> {
  const pattern = HEXAGRAM_PATTERNS[gate] ?? "000000";
  const yangBar = "━━━━━━━━━━━";
  const yinBar  = "━━━━    ━━━━";

  const rows: Array<{ text: string; isYang: boolean; lineNumber: number }> = [];
  for (let lineIdx = 5; lineIdx >= 0; lineIdx--) {
    const isYang = pattern[lineIdx] === "1";
    rows.push({
      text: isYang ? yangBar : yinBar,
      isYang,
      lineNumber: lineIdx + 1,
    });
  }
  return rows;
}
