// Colour tokens and WCAG 2.x contrast. Pure — no DOM. The relative-luminance
// formula linearises each sRGB channel before weighting it; it is not
// approximated from the raw 0-255 values.
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance

export type Hex = string;

export const CREAM: Hex = "#fff8ea"; // lu label, romanisation
export const MARK_FILL: Hex = "#e3c07a"; // strike marks — paler/yellower than the bell metal
export const MARK_EDGE: Hex = "#7a5a26"; // strike mark border
export const PAGE_BG: Hex = "#f4f1ea";
export const FOOTER_TEXT: Hex = "#4a4a4a";

// Bell body gradient (styles.css .bell-outline): lighter at the shoulder
// where light would catch, darker toward the rim.
export const BELL_GRADIENT_TOP: Hex = "#b27337";
export const BELL_GRADIENT_BOTTOM: Hex = "#382411";

// Frame gradient (styles.css .rack-frame): lighter at the top edge, darker
// toward the bottom.
export const FRAME_GRADIENT_TOP: Hex = "#8b6038";
export const FRAME_GRADIENT_BOTTOM: Hex = "#362516";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: Hex): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function srgbChannelToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * srgbChannelToLinear(rgb.r) +
    0.7152 * srgbChannelToLinear(rgb.g) +
    0.0722 * srgbChannelToLinear(rgb.b)
  );
}

export function contrastRatio(a: Hex, b: Hex): number {
  const l1 = relativeLuminance(hexToRgb(a));
  const l2 = relativeLuminance(hexToRgb(b));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function lerpChannel(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// The colour a vertical linear-gradient shows at a given fraction down its
// own box (0 = top stop, 1 = bottom stop) — used to test text/marks against
// the exact point of the gradient they sit on, not its average.
export function gradientColorAt(top: Hex, bottom: Hex, tFrac: number): Rgb {
  const a = hexToRgb(top);
  const b = hexToRgb(bottom);
  return {
    r: lerpChannel(a.r, b.r, tFrac),
    g: lerpChannel(a.g, b.g, tFrac),
    b: lerpChannel(a.b, b.b, tFrac),
  };
}

export function contrastRatioRgb(hex: Hex, rgb: Rgb): number {
  const l1 = relativeLuminance(hexToRgb(hex));
  const l2 = relativeLuminance(rgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
