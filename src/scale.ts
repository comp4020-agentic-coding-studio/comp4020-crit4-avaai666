// Bell size, graded by pitch. Pure: takes the frequencies already in
// src/tuning.ts and returns numbers, not DOM/CSS. Bigger bells ring
// lower — bell 1 (lowest zhenggu) is the widest, bell 12 (highest) the
// narrowest, everything else interpolated by where its frequency falls
// between them. Sizing goes by pitch, not by DOM or tier position, so it
// survives the tier swap in styles.css.
import { bells } from "./tuning";

// Floor: three 44px strike zones need to fit side by side on the
// smallest bell (see DESIGN.md's Playing section for the strike-zone
// idea). Ceiling: smallest/largest ~0.62, per the ratio worked out by
// hand against the rack's available width — see FACT-CHECK.md.
export const MIN_BELL_WIDTH = 132;
export const MAX_BELL_WIDTH = 213;

// Height from width, using the same 100:160 ratio as the #bell-shape
// viewBox in index.html, so the SVG is never stretched.
const HEIGHT_RATIO = 160 / 100;

export function bellWidth(freqHz: number, minFreqHz: number, maxFreqHz: number): number {
  const t = (freqHz - minFreqHz) / (maxFreqHz - minFreqHz);
  return MAX_BELL_WIDTH - (MAX_BELL_WIDTH - MIN_BELL_WIDTH) * t;
}

export function bellHeight(width: number): number {
  return width * HEIGHT_RATIO;
}

const zhengguFreqs = bells.map((b) => b.zhenggu.freq);
const minFreq = Math.min(...zhengguFreqs);
const maxFreq = Math.max(...zhengguFreqs);

export const bellSizes: { width: number; height: number }[] = zhengguFreqs.map((freq) => {
  const width = bellWidth(freq, minFreq, maxFreq);
  return { width, height: bellHeight(width) };
});
