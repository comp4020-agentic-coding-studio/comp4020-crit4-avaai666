// A melody as jianpu (numbered notation) would write it: a scale degree
// plus an octave shift, not a bell index — src/tuning.ts's bells decide
// which bell (if any) can actually produce that pitch. Pure: no DOM, no
// Web Audio, no timers.
import { LU_TABLE } from "./tuning";

export interface MelodyNote {
  degree: number; // jianpu scale degree, 1-7
  octave: number; // 0 = written octave, 1 = one octave up, -1 = one octave down
  atMs: number;
  gain: number;
}

export interface Strike {
  bell: number; // 1..12, matches data-bell
  x: number; // strike position, 0..1 — see src/strike.ts's mix()
  atMs: number;
  gain: number;
}

interface StrikeableTone {
  ratio: number;
}

interface StrikeableBell {
  zhenggu: StrikeableTone;
  cegu: StrikeableTone;
}

// The five gong-mode pentatonic degrees this rack's tuning has a ratio
// for, read off LU_TABLE by name rather than re-typed as fractions, so
// this can't drift from src/tuning.ts's own numbers:
//   1 gong = huangzhong (LU_TABLE[0]), 2 shang = taicu (LU_TABLE[2]),
//   3 jue = guxian (LU_TABLE[4]), 5 zhi = linzhong (LU_TABLE[7]),
//   6 yu = nanlu (LU_TABLE[9]).
// Degrees 4 and 7 have no entry: this rack has no bell built for either,
// so a melody using one must throw, not round to a neighbour.
const DEGREE_RATIO: Record<number, number> = {
  1: LU_TABLE[0].ratio,
  2: LU_TABLE[2].ratio,
  3: LU_TABLE[4].ratio,
  5: LU_TABLE[7].ratio,
  6: LU_TABLE[9].ratio,
};

const RATIO_EPSILON = 1e-9;

// Which bell and strike position produces a given ratio, if any. Checks
// every bell's zhenggu first, then every bell's cegu — a fixed, documented
// scan order, not a per-pitch judgment call. For this rack's twelve-bell
// table this scan order happens to land on exactly one bell per required
// degree (see FACT-CHECK.md "The tune"): bell 1 zhenggu (gong), bell 2
// zhenggu (shang), bell 3 zhenggu (jue), bell 10 zhenggu (zhi), bell 11
// zhenggu (yu), bell 11 cegu (gong', ratio 2/1).
function findStrike(ratio: number, bells: readonly StrikeableBell[]): { bell: number; x: number } | null {
  for (let i = 0; i < bells.length; i++) {
    if (Math.abs(bells[i].zhenggu.ratio - ratio) < RATIO_EPSILON) return { bell: i + 1, x: 0.5 };
  }
  for (let i = 0; i < bells.length; i++) {
    if (Math.abs(bells[i].cegu.ratio - ratio) < RATIO_EPSILON) return { bell: i + 1, x: 0 };
  }
  return null;
}

export function melodyToStrikes(melody: readonly MelodyNote[], bells: readonly StrikeableBell[]): Strike[] {
  return melody.map((note) => {
    const base = DEGREE_RATIO[note.degree];
    if (base === undefined) {
      throw new Error(
        `melodyToStrikes: scale degree ${note.degree} is not one of this rack's tuned pentatonic degrees (1, 2, 3, 5, 6)`,
      );
    }
    const ratio = base * Math.pow(2, note.octave);
    const match = findStrike(ratio, bells);
    if (!match) {
      throw new Error(
        `melodyToStrikes: scale degree ${note.degree} at octave ${note.octave} (ratio ${ratio}) has no matching bell`,
      );
    }
    return { bell: match.bell, x: match.x, atMs: note.atMs, gain: note.gain };
  });
}

// 茉莉花 (Jasmine Flower), Jiangsu folk song, public domain — opening
// phrase only ("好一朵美丽的茉莉花"). Source: Jianpu Space,
// https://jianpu.space/en/songList/28, checked 2026-08-20 — see
// FACT-CHECK.md "The tune" for the note-by-note derivation, including the
// two octave-up digits (rendered on that page as small circles above the
// glyph, confirmed against the page's own literal "1'" title text) and
// why only this phrase is used (the rest of the song uses two degrees a
// full octave below this rack's lowest bell, which this rack cannot
// produce).
//
// Timing is even 450ms spacing and gain is a flat 1 — guessed, not
// sourced or measured; the source gives pitches, not a tempo. Ear-and-eye
// judgement per CLAUDE.md, not evaluated here.
const BEAT_MS = 450;
const DEGREES: number[] = [3, 3, 5, 6, 1, 1, 6, 5, 5, 6, 5];
const OCTAVES: number[] = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0];

export const MOLIHUA_OPENING: MelodyNote[] = DEGREES.map((degree, i) => ({
  degree,
  octave: OCTAVES[i],
  atMs: i * BEAT_MS,
  gain: 1,
}));
