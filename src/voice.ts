// Additive-synthesis partials for a struck tone. Pure: no Web Audio here,
// just the numbers src/audio.ts turns into oscillators.
//
// Every value below is a guess, to be tuned by ear against LISTENING.md —
// see DESIGN.md "Timbre". None of it is measured from a real bell.
const PARTIAL_RATIOS = [1, 2.0, 2.4, 3.0, 4.1, 5.4];
const PARTIAL_GAINS = [1, 0.35, 0.28, 0.18, 0.1, 0.06];
const DECAY_MULTIPLIERS = [1, 0.7, 0.6, 0.45, 0.3, 0.22];

// Decay time for the fundamental, bell 1 down to bell 10. Guess.
const DECAY_SECONDS_BELL_1 = 4.5;
const DECAY_SECONDS_BELL_10 = 1.6;

export function partials(
  fundamentalHz: number,
  bellIndex: number,
): { freq: number; gain: number; decay: number }[] {
  const t = (bellIndex - 1) / 9;
  const baseDecay = DECAY_SECONDS_BELL_1 + (DECAY_SECONDS_BELL_10 - DECAY_SECONDS_BELL_1) * t;
  return PARTIAL_RATIOS.map((ratio, i) => ({
    freq: fundamentalHz * ratio,
    gain: PARTIAL_GAINS[i],
    decay: baseDecay * DECAY_MULTIPLIERS[i],
  }));
}
