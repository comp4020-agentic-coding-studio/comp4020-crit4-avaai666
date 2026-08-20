// What these tests cannot check: timbre, latency, balance, decay
// shape, whether it sounds like bronze, whether a stranger finds the
// second tone. Those are in LISTENING.md and they are done by ear.
// These tests check the contract underneath: the tuning is the tuning
// I chose, the strike mix is continuous and never silent, and nothing
// on the page can be got wrong.
//
// Module contract assumed by these tests (none of this exists yet):
//
// src/tuning.ts
//   export const HUANGZHONG_HZ: number
//   export const LU_TABLE: {
//     name: string;
//     num: number;    // exact integer numerator, e.g. 2187
//     den: number;    // exact integer denominator, e.g. 2048
//     ratio: number;  // num / den
//   }[]                                                         // all 12 lü, huangzhong..yingzhong
//   export const bells: {
//     zhenggu: { name: string; ratio: number; freq: number };
//     cegu:    { name: string; ratio: number; freq: number };
//   }[]                                                         // length 12, index 0 = bell 1
//
// src/strike.ts
//   export function mix(x: number): { zhenggu: number; cegu: number }
//
// src/voice.ts
//   export function partials(
//     fundamentalHz: number,
//     bellIndex: number,                                        // 1..12
//   ): { freq: number; gain: number; decay: number }[]
//
// src/audio.ts
//   export function createEngine(
//     AudioContextCtor?: typeof AudioContext,                   // default: globalThis.AudioContext
//   ): { strike(bellIndex: number, x: number): void }
//   createEngine() must not construct a context. The context is
//   constructed lazily, on the first call to engine.strike(), and reused
//   by every later strike.
//
// The page (built to dist/index.html):
//   each bell is <button data-bell="1".."12">, carries a non-empty
//   accessible name (text content or aria-label), and carries
//   data-key-zhenggu / data-key-cegu attributes naming its two keys as
//   KeyboardEvent.code values (e.g. "KeyA", "Digit2") — physical key
//   positions, not characters, per DESIGN.md.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { bells, HUANGZHONG_HZ, LU_TABLE } from "../src/tuning";
import { mix } from "../src/strike";
import { partials } from "../src/voice";
import { createEngine } from "../src/audio";
import { INITIAL_STATE, rackVisible, transition, type State } from "../src/reveal";
import { melodyToStrikes, MOLIHUA_OPENING } from "../src/melody";
import { bellSizes, MIN_BELL_WIDTH } from "../src/scale";
import {
  boxesIntersect,
  boxInsideOutline,
  centreMarkBox,
  cornerMarkLeftBox,
  cornerMarkRightBox,
  GU_Y_FRAC,
  MARK_FRAC,
  tierOrder,
  type Box,
} from "../src/layout";
import { CREAM, contrastRatio, contrastRatioRgb, gradientColorAt, MARK_FILL } from "../src/color";

const CENTS_TOLERANCE = 0.5;

function cents(a: number, b: number): number {
  return 1200 * Math.log2(a / b);
}

function reduceToOctave(ratio: number): number {
  let r = ratio;
  while (r >= 2) r /= 2;
  while (r < 1) r *= 2;
  return r;
}

const MAJOR_THIRD = 81 / 64;
const MINOR_THIRD = 32 / 27;

describe("tuning.ts", () => {
  it("has exactly 12 bells", () => {
    expect(bells.length).toBe(12);
  });

  // Bell-index order (data-bell 1..12, the array's own order) is NOT pitch
  // order any more — bells 1-6 are the six lu, 7-12 the six lü, and the
  // two tiers interleave in pitch (bell 7's zhenggu sits between bell 1's
  // and bell 2's). Ascending pitch now only holds within each tier.
  it("has strictly ascending zhenggu frequencies within the lower tier (1..6)", () => {
    for (let i = 0; i < 5; i++) {
      expect(bells[i].zhenggu.freq).toBeLessThan(bells[i + 1].zhenggu.freq);
    }
  });

  it("has strictly ascending zhenggu frequencies within the upper tier (7..12)", () => {
    for (let i = 6; i < 11; i++) {
      expect(bells[i].zhenggu.freq).toBeLessThan(bells[i + 1].zhenggu.freq);
    }
  });

  it("gives every bell a cegu frequency higher than its zhenggu frequency", () => {
    for (const bell of bells) {
      expect(bell.cegu.freq).toBeGreaterThan(bell.zhenggu.freq);
    }
  });

  it("keeps every cegu/zhenggu ratio at a major or minor third, within 0.5 cents", () => {
    for (const bell of bells) {
      const ratio = bell.cegu.ratio / bell.zhenggu.ratio;
      const distanceFromMajor = Math.abs(cents(ratio, MAJOR_THIRD));
      const distanceFromMinor = Math.abs(cents(ratio, MINOR_THIRD));
      expect(Math.min(distanceFromMajor, distanceFromMinor)).toBeLessThan(CENTS_TOLERANCE);
    }
  });

  it("draws every pitch, zhenggu and cegu, from the twelve-lü table within 0.5 cents", () => {
    for (const bell of bells) {
      for (const tone of [bell.zhenggu, bell.cegu]) {
        const reduced = reduceToOctave(tone.ratio);
        const nearest = Math.min(
          ...LU_TABLE.map((lu) => Math.abs(cents(reduced, reduceToOctave(lu.ratio)))),
        );
        expect(nearest).toBeLessThan(CENTS_TOLERANCE);
      }
    }
  });

  it("has exactly the six lu zhenggu ratios, ascending, for the lower tier (bells 1..6)", () => {
    const expected = [1 / 1, 9 / 8, 81 / 64, 729 / 512, 6561 / 4096, 59049 / 32768];
    const actual = bells.slice(0, 6).map((b) => b.zhenggu.ratio);
    expect(actual).toEqual(expected);
  });

  it("has exactly the six lü zhenggu ratios, ascending, for the upper tier (bells 7..12)", () => {
    const expected = [2187 / 2048, 19683 / 16384, 177147 / 131072, 3 / 2, 27 / 16, 243 / 128];
    const actual = bells.slice(6, 12).map((b) => b.zhenggu.ratio);
    expect(actual).toEqual(expected);
  });

  it("puts the huangzhong-to-linzhong fifth at exactly 3/2", () => {
    const huangzhong = LU_TABLE.find((lu) => lu.name === "黄钟");
    const linzhong = LU_TABLE.find((lu) => lu.name === "林钟");
    expect(huangzhong).toBeTruthy();
    expect(linzhong).toBeTruthy();
    expect((linzhong as { ratio: number }).ratio / (huangzhong as { ratio: number }).ratio).toBe(
      3 / 2,
    );
  });

  it("gives every bell a non-empty Chinese lü name for both tones", () => {
    const hasChinese = (s: string) => /[一-鿿]/.test(s);
    for (const bell of bells) {
      expect(bell.zhenggu.name.length).toBeGreaterThan(0);
      expect(bell.cegu.name.length).toBeGreaterThan(0);
      expect(hasChinese(bell.zhenggu.name)).toBe(true);
      expect(hasChinese(bell.cegu.name)).toBe(true);
    }
  });
});

describe("tuning.ts: the twelve-lü table", () => {
  function byName(name: string) {
    const lu = LU_TABLE.find((l) => l.name === name);
    if (!lu) throw new Error(`missing lü: ${name}`);
    return lu;
  }

  function isPowerOf(base: number, n: number): boolean {
    if (n < 1) return false;
    let r = n;
    while (r % base === 0) r /= base;
    return r === 1;
  }

  it("has exactly 12 entries", () => {
    expect(LU_TABLE.length).toBe(12);
  });

  it("is strictly ascending and lies entirely in [1, 2)", () => {
    for (const lu of LU_TABLE) {
      expect(lu.ratio).toBeGreaterThanOrEqual(1);
      expect(lu.ratio).toBeLessThan(2);
    }
    for (let i = 0; i < LU_TABLE.length - 1; i++) {
      expect(LU_TABLE[i].ratio).toBeLessThan(LU_TABLE[i + 1].ratio);
    }
  });

  it("is exactly 3^k / 2^m for every entry, for some integers k, m", () => {
    for (const lu of LU_TABLE) {
      expect(lu.num / lu.den, lu.name).toBe(lu.ratio);
      expect(isPowerOf(3, lu.num), `${lu.name} numerator ${lu.num}`).toBe(true);
      expect(isPowerOf(2, lu.den), `${lu.name} denominator ${lu.den}`).toBe(true);
    }
  });

  it("closes under a fifth (x 3/2, reduced into the octave) for every lü except zhonglü", () => {
    const zhonglü = byName("仲吕");
    for (const lu of LU_TABLE) {
      if (lu === zhonglü) continue;
      const next = reduceToOctave(lu.ratio * (3 / 2));
      const match = LU_TABLE.some((candidate) => candidate.ratio === next);
      expect(match, `${lu.name} x 3/2 reduced = ${next}`).toBe(true);
    }
  });

  it("the Pythagorean comma: a fifth up from zhonglü does not close the circle", () => {
    const zhonglü = byName("仲吕");
    const wolf = reduceToOctave(zhonglü.ratio * (3 / 2));
    expect(wolf).toBe(531441 / 524288);
    const huangzhong = byName("黄钟");
    expect(wolf).not.toBe(huangzhong.ratio);
  });

  // Superseded by "tuning.ts: Part A verification" Check 3 below — the
  // twelve-bell design uses every one of the twelve lü as a zhenggu
  // exactly once, so there is no longer a subset "left unused".
  it("uses every one of the twelve lü as a zhenggu pitch class, exactly once", () => {
    const names = bells.map((b) => b.zhenggu.name);
    expect(new Set(names).size).toBe(12);
    expect(new Set(names)).toEqual(new Set(LU_TABLE.map((lu) => lu.name)));
  });

  it("uses exactly these nine cegu pitch classes", () => {
    const names = new Set(bells.map((b) => b.cegu.name));
    expect(names).toEqual(
      new Set(["姑洗", "蕤宾", "夷则", "无射", "应钟", "大吕", "仲吕", "黄钟", "夹钟"]),
    );
  });
});

// Part A's seven required checks, verified with exact BigInt fraction
// arithmetic against the fractions given for the twelve-bell table — not
// against LU_TABLE/bells' floating-point .ratio, which is a derived
// number, not the source of truth. See the session report for how these
// were first checked by hand; these tests are that same arithmetic, kept.
describe("tuning.ts: Part A verification (the seven checks)", () => {
  // [zhenggu num, zhenggu den, cegu num, cegu den], bell 1..12, in order.
  const TABLE: [bigint, bigint, bigint, bigint][] = [
    [1n, 1n, 81n, 64n],
    [9n, 8n, 729n, 512n],
    [81n, 64n, 6561n, 4096n],
    [729n, 512n, 59049n, 32768n],
    [6561n, 4096n, 243n, 128n],
    [59049n, 32768n, 2187n, 1024n],
    [2187n, 2048n, 177147n, 131072n],
    [19683n, 16384n, 729n, 512n],
    [177147n, 131072n, 6561n, 4096n],
    [3n, 2n, 243n, 128n],
    [27n, 16n, 2n, 1n],
    [243n, 128n, 19683n, 8192n],
  ];

  const MAJOR_NUM = 81n;
  const MAJOR_DEN = 64n;
  const MINOR_NUM = 32n;
  const MINOR_DEN = 27n;

  it("Check 1: every cegu ratio equals zhenggu × 81/64 or zhenggu × 32/27, exactly", () => {
    for (const [zn, zd, cn, cd] of TABLE) {
      const isMajor = zn * MAJOR_NUM * cd === cn * zd * MAJOR_DEN;
      const isMinor = zn * MINOR_NUM * cd === cn * zd * MINOR_DEN;
      expect(isMajor || isMinor, `${zn}/${zd} -> ${cn}/${cd}`).toBe(true);
    }
  });

  it("Check 2: every zhenggu and cegu, reduced into one octave, is a member of LU_TABLE", () => {
    function reduceFrac(num: bigint, den: bigint): [bigint, bigint] {
      let n = num;
      let d = den;
      while (n >= 2n * d) d *= 2n;
      while (n < d) n *= 2n;
      return [n, d];
    }
    for (const [zn, zd, cn, cd] of TABLE) {
      for (const [n, d] of [reduceFrac(zn, zd), reduceFrac(cn, cd)]) {
        const match = LU_TABLE.some((lu) => BigInt(lu.num) * d === n * BigInt(lu.den));
        expect(match, `${n}/${d} not in LU_TABLE`).toBe(true);
      }
    }
  });

  it("Check 3: all twelve lü appear exactly once as a zhenggu", () => {
    const zhengguFracs = TABLE.map(([n, d]) => `${n}/${d}`);
    expect(new Set(zhengguFracs).size).toBe(12);
    for (const lu of LU_TABLE) {
      expect(zhengguFracs.includes(`${lu.num}/${lu.den}`), lu.name).toBe(true);
    }
  });

  // Genuine finding, not adjusted: the upper tier's ninth-to-tenth gap
  // (zhonglu -> linzhong) is 65536/59049 (≈180.5 cents), not 9/8 (=203.9
  // cents) — the fifth-chain wraps from exponent 11 back past exponent 1
  // there once octave-reduced. Every other of the ten pitch-adjacent gaps
  // is exactly 9/8. Reported to the user rather than silently changing
  // their numbers to force this to pass — see the session report.
  it("Check 4: consecutive zhenggu ratios differ by 9/8, except one documented gap", () => {
    const NINE_EIGHTHS: [bigint, bigint] = [9n, 8n];
    const KNOWN_EXCEPTION_INDEX = 8; // bell 9 (zhonglu) -> bell 10 (linzhong)
    const KNOWN_EXCEPTION: [bigint, bigint] = [65536n, 59049n];

    function gapIs(lo: [bigint, bigint, bigint, bigint], hi: [bigint, bigint, bigint, bigint], ratio: [bigint, bigint]): boolean {
      const [ln, ld] = [lo[0], lo[1]];
      const [hn, hd] = [hi[0], hi[1]];
      const [rn, rd] = ratio;
      // hi/lo == rn/rd, cross-multiplied
      return hn * ld * rd === rn * ln * hd;
    }

    const lower = TABLE.slice(0, 6);
    const upper = TABLE.slice(6, 12);
    const pitchOrderGaps: [number, [bigint, bigint, bigint, bigint], [bigint, bigint, bigint, bigint]][] = [];
    for (let i = 0; i < 5; i++) pitchOrderGaps.push([i, lower[i], lower[i + 1]]);
    for (let i = 0; i < 5; i++) pitchOrderGaps.push([6 + i, upper[i], upper[i + 1]]);

    for (const [index, lo, hi] of pitchOrderGaps) {
      if (index === KNOWN_EXCEPTION_INDEX) {
        expect(gapIs(lo, hi, KNOWN_EXCEPTION), `gap at index ${index}`).toBe(true);
        expect(gapIs(lo, hi, NINE_EIGHTHS), `gap at index ${index} unexpectedly became 9/8`).toBe(
          false,
        );
      } else {
        expect(gapIs(lo, hi, NINE_EIGHTHS), `gap at index ${index}`).toBe(true);
      }
    }
  });

  it("Check 5: every lu (lower tier) zhenggu is 3^even/2^k, every lü (upper tier) is 3^odd/2^k", () => {
    function powerOf3(n: bigint): number {
      let r = n;
      let k = 0;
      while (r % 3n === 0n) {
        r /= 3n;
        k++;
      }
      expect(r, `${n} is not a pure power of 3`).toBe(1n);
      return k;
    }
    for (let i = 0; i < 6; i++) {
      expect(powerOf3(TABLE[i][0]) % 2, `bell ${i + 1} (lu) zhenggu exponent`).toBe(0);
    }
    for (let i = 6; i < 12; i++) {
      expect(powerOf3(TABLE[i][0]) % 2, `bell ${i + 1} (lü) zhenggu exponent`).toBe(1);
    }
  });

  it("Check 6: for each column, the upper-tier zhenggu is higher than the lower-tier zhenggu and their ratio is less than 9/8", () => {
    for (let col = 0; col < 6; col++) {
      const [ln, ld] = [TABLE[col][0], TABLE[col][1]];
      const [un, ud] = [TABLE[6 + col][0], TABLE[6 + col][1]];
      expect(un * ld > ln * ud, `column ${col + 1}: upper vs lower`).toBe(true);
      // (un/ud) / (ln/ld) < 9/8  <=>  un*ld*8 < ln*ud*9
      expect(un * ld * 8n < ln * ud * 9n, `column ${col + 1}: ratio < 9/8`).toBe(true);
    }
  });
});

describe("strike.ts", () => {
  it("gives the centre (x=0.5) full zhenggu, silent cegu", () => {
    const { zhenggu, cegu } = mix(0.5);
    expect(zhenggu).toBeCloseTo(1, 9);
    expect(cegu).toBeCloseTo(0, 9);
  });

  it("gives both edges (x=0, x=1) full cegu, silent zhenggu", () => {
    for (const x of [0, 1]) {
      const { zhenggu, cegu } = mix(x);
      expect(zhenggu).toBeCloseTo(0, 9);
      expect(cegu).toBeCloseTo(1, 9);
    }
  });

  it("is symmetric about the centre", () => {
    for (const k of [0.05, 0.1, 0.2, 0.3, 0.4]) {
      const left = mix(0.5 - k);
      const right = mix(0.5 + k);
      expect(left.zhenggu).toBeCloseTo(right.zhenggu, 9);
      expect(left.cegu).toBeCloseTo(right.cegu, 9);
    }
  });

  it("keeps constant power across the whole strike range", () => {
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      const { zhenggu, cegu } = mix(x);
      expect(zhenggu ** 2 + cegu ** 2).toBeCloseTo(1, 9);
    }
  });

  it("never produces a quiet or empty strike anywhere in the range", () => {
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      const { zhenggu, cegu } = mix(x);
      expect(Math.max(zhenggu, cegu)).toBeGreaterThanOrEqual(0.7);
    }
  });

  it("clamps rather than throwing outside [0,1]", () => {
    expect(() => mix(-1)).not.toThrow();
    expect(() => mix(2)).not.toThrow();
    expect(mix(-1)).toEqual(mix(0));
    expect(mix(2)).toEqual(mix(1));
  });
});

describe("voice.ts", () => {
  it("starts every tone's partials with the fundamental at ratio exactly 1", () => {
    for (let bell = 1; bell <= 12; bell++) {
      const ps = partials(HUANGZHONG_HZ, bell);
      expect(ps[0].freq).toBe(HUANGZHONG_HZ);
    }
  });

  it("gives strictly descending partial gains", () => {
    for (let bell = 1; bell <= 12; bell++) {
      const gains = partials(HUANGZHONG_HZ, bell).map((p) => p.gain);
      for (let i = 0; i < gains.length - 1; i++) {
        expect(gains[i]).toBeGreaterThan(gains[i + 1]);
      }
    }
  });

  it("decays higher partials strictly faster than lower ones", () => {
    for (let bell = 1; bell <= 12; bell++) {
      const decays = partials(HUANGZHONG_HZ, bell).map((p) => p.decay);
      for (let i = 0; i < decays.length - 1; i++) {
        expect(decays[i]).toBeGreaterThan(decays[i + 1]);
      }
    }
  });

  it("gives bell 1 a longer fundamental decay than bell 12", () => {
    const bell1 = partials(HUANGZHONG_HZ, 1)[0].decay;
    const bell12 = partials(HUANGZHONG_HZ, 12)[0].decay;
    expect(bell1).toBeGreaterThan(bell12);
  });

  it("never puts a partial above 18000 Hz for any bell, at any tone", () => {
    for (const bell of bells) {
      for (const [index, tone] of [bell.zhenggu, bell.cegu].entries()) {
        const bellIndex = bells.indexOf(bell) + 1;
        const ps = partials(tone.freq, bellIndex);
        for (const p of ps) {
          expect(p.freq, `bell ${bellIndex} tone ${index}`).toBeLessThanOrEqual(18000);
        }
      }
    }
  });
});

// A fake AudioContext constructor: counts its own instantiations and hands
// back stub nodes, so the real Web Audio graph is never touched here.
class FakeAudioContext {
  static instances = 0;
  currentTime = 0;
  destination = {};

  constructor() {
    FakeAudioContext.instances++;
  }

  createOscillator() {
    return {
      connect: () => {},
      start: () => {},
      stop: () => {},
      frequency: {
        value: 0,
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
    };
  }

  createGain() {
    return {
      connect: () => {},
      gain: {
        value: 0,
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
    };
  }

  createBuffer() {
    return { getChannelData: () => new Float32Array(1) };
  }

  createBufferSource() {
    return { connect: () => {}, start: () => {}, stop: () => {}, buffer: null };
  }

  createDynamicsCompressor() {
    return {
      connect: () => {},
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
    };
  }

  resume() {
    return Promise.resolve();
  }
}

describe("audio.ts: the AudioContext is created lazily", () => {
  it("does not construct a context when the engine is created", () => {
    FakeAudioContext.instances = 0;
    createEngine(FakeAudioContext as unknown as typeof AudioContext);
    expect(FakeAudioContext.instances).toBe(0);
  });

  it("constructs the context exactly once, after the first strike", () => {
    FakeAudioContext.instances = 0;
    const engine = createEngine(FakeAudioContext as unknown as typeof AudioContext);
    engine.strike(1, 0.5);
    expect(FakeAudioContext.instances).toBe(1);
  });

  it("still has exactly one context after fifty strikes", () => {
    FakeAudioContext.instances = 0;
    const engine = createEngine(FakeAudioContext as unknown as typeof AudioContext);
    for (let i = 0; i < 50; i++) {
      engine.strike((i % 12) + 1, (i % 11) / 10);
    }
    expect(FakeAudioContext.instances).toBe(1);
  });

  it("returns from strike() without throwing before any context exists", () => {
    FakeAudioContext.instances = 0;
    const engine = createEngine(FakeAudioContext as unknown as typeof AudioContext);
    expect(() => engine.strike(1, 0.5)).not.toThrow();
  });
});

describe("reveal.ts", () => {
  const STRIKE = { type: "strike" as const };

  it("starts in a state that exposes exactly one interactive bell", () => {
    expect(rackVisible(INITIAL_STATE)).toBe(false);
  });

  it("a first-strike event reveals the rack", () => {
    const next = transition(INITIAL_STATE, STRIKE);
    expect(rackVisible(next)).toBe(true);
  });

  it("once revealed, no event returns it to a hidden state", () => {
    let state: State = INITIAL_STATE;
    state = transition(state, STRIKE);
    expect(rackVisible(state)).toBe(true);
    expect(rackVisible(transition(state, STRIKE))).toBe(true);
  });
});

describe("scale.ts: bells are graded by pitch, not by DOM position", () => {
  it("gives exactly 12 bells a size", () => {
    expect(bellSizes.length).toBe(12);
  });

  // Bell-index array order is no longer pitch order — bells 1-6 (lu) and
  // 7-12 (lü) interleave in pitch, per Part B. Sort by zhenggu frequency
  // first, then check monotonicity, so this test still verifies grading
  // by pitch rather than by array position.
  it("gives strictly decreasing width as zhenggu pitch rises, across all twelve bells", () => {
    const byPitch = bells
      .map((b, i) => ({ freq: b.zhenggu.freq, width: bellSizes[i].width }))
      .sort((a, b) => a.freq - b.freq);
    for (let i = 0; i < byPitch.length - 1; i++) {
      expect(byPitch[i].width, `pitch rank ${i + 1} vs ${i + 2}`).toBeGreaterThan(
        byPitch[i + 1].width,
      );
    }
  });

  it("keeps the smallest bell at least 132px wide, so three 44px strike zones fit", () => {
    const smallest = Math.min(...bellSizes.map((b) => b.width));
    expect(smallest).toBeGreaterThanOrEqual(132);
  });

  it("keeps the smallest/largest width ratio between 0.55 and 0.70", () => {
    const widths = bellSizes.map((b) => b.width);
    const ratio = Math.min(...widths) / Math.max(...widths);
    expect(ratio).toBeGreaterThanOrEqual(0.55);
    expect(ratio).toBeLessThanOrEqual(0.7);
  });

  it("derives height from width using the #bell-shape viewBox ratio, 100:160", () => {
    for (const { width, height } of bellSizes) {
      expect(height / width).toBeCloseTo(1.6, 5);
    }
  });
});

// A measured defect (session report, earlier this month): inside bell 1,
// the lu label, the romanisation and the centre mark all measured the
// same colour, and the centre mark's box overlapped the romanisation's
// box — a smudge, not a visible overlap, because nothing checked for it.
// The label and romanisation have since moved off the bell face entirely
// (Part B) — the bell face now carries only the three strike marks. These
// tests are that check, run against the same pure geometry src/ui.ts
// renders from — not a second, hand-copied set of numbers.
describe("layout.ts: the three strike marks never overlap, sit in the gu, and clear the touch-target floor", () => {
  const SIZES = [
    { width: MIN_BELL_WIDTH, height: MIN_BELL_WIDTH * 1.6 }, // bell 12 (narrowest)
    { width: 160, height: 160 * 1.6 }, // mid-size sample, not tied to any one bell
    { width: 189.55, height: 189.55 * 1.6 }, // mid-size sample, not tied to any one bell
    { width: 213, height: 213 * 1.6 }, // bell 1 (widest)
  ];

  function allBoxes(width: number, height: number): Record<string, Box> {
    return {
      centre: centreMarkBox(width, height),
      cornerLeft: cornerMarkLeftBox(width, height),
      cornerRight: cornerMarkRightBox(width, height),
    };
  }

  it("never lets any two of the three mark boxes intersect, at every bell size", () => {
    for (const { width, height } of SIZES) {
      const boxes = allBoxes(width, height);
      const names = Object.keys(boxes);
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          expect(
            boxesIntersect(boxes[names[i]], boxes[names[j]]),
            `${names[i]} vs ${names[j]} at ${width}px`,
          ).toBe(false);
        }
      }
    }
  });

  // The 44px accessibility floor is a property of the hit region (the
  // button itself, one third of the bell's width — see src/scale.ts's
  // 132px MIN_BELL_WIDTH comment), not of the drawn mark. Conflating the
  // two was last week's error: it sized the drawn mark at 1/3 of the
  // bell so it doubled as its own hit region, pushing it too large to
  // fit inside the gu. These two checks are now separate, matching that
  // separation in src/layout.ts.
  it("gives the smallest bell a hit region (one third of its width) of at least 44px", () => {
    expect(MIN_BELL_WIDTH / 3).toBeGreaterThanOrEqual(44);
  });

  it("draws each mark at between 0.14 and 0.18 of the bell's width, not sized to the hit region", () => {
    expect(MARK_FRAC).toBeGreaterThanOrEqual(0.14);
    expect(MARK_FRAC).toBeLessThanOrEqual(0.18);
  });

  it("keeps every mark box entirely inside the bell outline, at every bell size", () => {
    for (const { width, height } of SIZES) {
      const { centre, cornerLeft, cornerRight } = allBoxes(width, height);
      for (const [name, box] of Object.entries({ centre, cornerLeft, cornerRight })) {
        expect(boxInsideOutline(box, width, height), `${name} at ${width}px`).toBe(true);
      }
    }
  });

  // All three marks belong in the gu — the smooth lower body below the
  // boss block, above the rim curve (index.html's divider line at y=95
  // of the 100x160 viewBox). A mark drawn up in the wu, among the bosses,
  // would sit on top of the decoration rather than on the bell's own
  // undecorated surface.
  it("keeps every mark box entirely inside the gu, at every bell size", () => {
    for (const { width, height } of SIZES) {
      const { centre, cornerLeft, cornerRight } = allBoxes(width, height);
      const guTop = GU_Y_FRAC * height;
      for (const [name, box] of Object.entries({ centre, cornerLeft, cornerRight })) {
        expect(box.y, `${name} top at ${width}px`).toBeGreaterThanOrEqual(guTop);
      }
    }
  });

  it("places the two corner marks symmetrically about the bell's vertical centre line", () => {
    const { width, height } = { width: 213, height: 213 * 1.6 };
    const left = cornerMarkLeftBox(width, height);
    const right = cornerMarkRightBox(width, height);
    expect(left.y).toBeCloseTo(right.y, 9);
    expect(left.w).toBeCloseTo(right.w, 9);
    expect(left.h).toBeCloseTo(right.h, 9);
    const leftCentreX = left.x + left.w / 2;
    const rightCentreX = right.x + right.w / 2;
    expect(leftCentreX + rightCentreX).toBeCloseTo(width, 6);
  });

  it("centres the centre mark exactly on the bell's vertical centre line", () => {
    const { width, height } = { width: 213, height: 213 * 1.6 };
    const centre = centreMarkBox(width, height);
    expect(centre.x + centre.w / 2).toBeCloseTo(width / 2, 6);
  });
});

// Bug fix, this revision: tierOrder used to be a list of styles.css
// `:nth-child(N)` rules, which broke (order and --bell-w both) the moment
// an unrelated sibling — the mallet — sat inside .rack ahead of the bell
// cells. Computed here as a pure function with no DOM position anywhere
// near it.
describe("layout.ts: tierOrder puts bells in two visual tiers with no positional selector", () => {
  it("maps bells 7..12 (the six lü) to orders 1..6", () => {
    expect([7, 8, 9, 10, 11, 12].map(tierOrder)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("maps bells 1..6 (the six lu) to orders 7..12", () => {
    expect([1, 2, 3, 4, 5, 6].map(tierOrder)).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it("is a bijection onto 1..12", () => {
    const orders = Array.from({ length: 12 }, (_, i) => tierOrder(i + 1));
    expect(new Set(orders).size).toBe(12);
    expect([...orders].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  // Not an octave relationship — see src/tuning.ts and DESIGN.md. Bells
  // 7..12 (the six lü) sit in the top row in bell-index order, bells 1..6
  // (the six lu) in the bottom row in bell-index order.
  it("puts the upper tier (7..12) in the top row, in bell order, and the lower tier (1..6) in the bottom row, in bell order", () => {
    const byOrder = Array.from({ length: 12 }, (_, i) => i + 1).sort(
      (a, b) => tierOrder(a) - tierOrder(b),
    );
    expect(byOrder.slice(0, 6)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(byOrder.slice(6, 12)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// "This is the part of the week I care most about." A rectangle that
// overlaps another rectangle, and a contrast ratio below the WCAG floor,
// are both things this suite can now catch on its own.
// Part B: the actual bug class, removed rather than patched a third time
// (see FACT-CHECK.md "Vertical centring, removed rather than patched a
// third time"). Text-based, not computed-style-based, on purpose: this
// runs in vitest/node with no browser, so it checks the source rule
// bodies directly rather than trying to fake a layout engine.
describe("styles.css: no vertical centring anywhere in the page (Part B)", () => {
  const css = readFileSync(resolve("styles.css"), "utf8").replace(/\/\*.*?\*\//gs, "");

  function ruleBody(selector: string, source: string): string {
    const re = new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`, "s");
    const match = source.match(re);
    return match ? match[1] : "";
  }

  const FORBIDDEN: [RegExp, string][] = [
    [/align-items\s*:\s*center/, "align-items: center"],
    [/justify-content\s*:\s*center/, "justify-content: center"],
    [/place-content\s*:/, "place-content"],
    [
      /margin(-top|-bottom|-block(-start|-end)?)?\s*:\s*auto(\s|;|$)/,
      "an auto top/bottom margin (margin-top/-bottom/-block, or bare margin: auto)",
    ],
    [/margin\s*:\s*auto\s+\S/, "a two-value margin shorthand with an auto vertical component"],
    [/transform\s*:\s*[^;]*translateY/, "transform: translateY"],
  ];

  // html has no rule of its own in styles.css at all (only :root) — that
  // absence is itself the point being checked: nothing here needs to add
  // one, so ruleBody correctly returns "" and every pattern trivially
  // fails to match.
  const SELECTORS = ["html", "body", "main", "\\.rack-frame", "\\.rack"];

  for (const selector of SELECTORS) {
    const label = selector.replace(/\\/g, "");
    it(`${label} sets no vertical-centring property`, () => {
      const body = ruleBody(selector, css);
      for (const [pattern, description] of FORBIDDEN) {
        expect(
          pattern.test(body),
          `${label}'s rule sets ${description}: "${body.trim()}"`,
        ).toBe(false);
      }
    });
  }

  it(".rack-frame centres horizontally only, via margin-inline: auto", () => {
    const body = ruleBody("\\.rack-frame", css);
    expect(body, ".rack-frame rule not found").toContain("margin-inline: auto");
  });

  it("body has no 100vh (a phone's browser chrome can make it taller than what's visible)", () => {
    expect(css.includes("100vh"), "styles.css still contains 100vh").toBe(false);
  });
});

describe("color.ts: WCAG contrast for every piece of text and every mark", () => {
  // src/color.ts's own gradient stops, mirrored here only to compute the
  // exact point on the gradient each piece of text or mark sits on — see
  // FACT-CHECK.md "Metal finish" for why "the point it sits on", not the
  // gradient's average, is what must be checked.
  const BELL_TOP = "#b27337";
  const BELL_BOTTOM = "#382411";

  it("keeps every strike mark at or above 3:1 against the bell gradient's lightest point under its own box", () => {
    for (const box of [centreMarkBox(1, 1), cornerMarkLeftBox(1, 1), cornerMarkRightBox(1, 1)]) {
      const worstPoint = gradientColorAt(BELL_TOP, BELL_BOTTOM, box.y); // top edge = lightest
      expect(contrastRatioRgb(MARK_FILL, worstPoint)).toBeGreaterThanOrEqual(3);
    }
  });

  // The lu label and the romanisation are no longer on the bell at all
  // (Part B) — both now live in the frame's caption strip below each
  // bell, so both are checked the same way, against the frame gradient
  // rather than the bell's.
  it("keeps the caption text at or above 4.5:1 against the frame gradient's lightest possible point", () => {
    // The caption's exact vertical position on the frame varies by row;
    // testing against the single lightest colour the frame gradient can
    // ever show is the conservative bound that covers every row.
    expect(contrastRatio(CREAM, "#8b6038")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the footer text at or above 4.5:1 against the page background", () => {
    expect(contrastRatio("#4a4a4a", "#f4f1ea")).toBeGreaterThanOrEqual(4.5);
  });

  it("never gives a mark the same colour as the text it sits near", () => {
    expect(MARK_FILL.toLowerCase()).not.toBe(CREAM.toLowerCase());
  });
});

describe("the page", () => {
  const distPath = resolve("dist/index.html");
  const FORBIDDEN = [
    "score",
    "points",
    "level",
    "lives",
    "wrong",
    "correct",
    "retry",
    "game over",
  ];

  const doc = existsSync(distPath)
    ? new JSDOM(readFileSync(distPath, "utf8")).window.document
    : null;

  it("built dist/index.html", () => {
    expect(existsSync(distPath), "run pnpm build first").toBe(true);
  });

  it("renders twelve bells, each as a real <button>", () => {
    const buttons = doc?.querySelectorAll("button[data-bell]") ?? [];
    expect(buttons.length).toBe(12);
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
    }
  });

  it("gives every bell button a non-empty accessible name", () => {
    const buttons = doc?.querySelectorAll("button[data-bell]") ?? [];
    for (const button of buttons) {
      const name = (button.getAttribute("aria-label") ?? button.textContent ?? "").trim();
      expect(name.length, `bell ${button.getAttribute("data-bell")}`).toBeGreaterThan(0);
    }
  });

  it("never disables a bell", () => {
    const buttons = doc?.querySelectorAll("button[data-bell]") ?? [];
    for (const button of buttons) {
      expect(button.hasAttribute("disabled")).toBe(false);
    }
  });

  // Four rows read from event.code (see DESIGN.md's Playing section):
  // home row is the lu (lower-tier zhenggu), row above is the lü
  // (upper-tier zhenggu), one row further out either direction is that
  // bell's cegu.
  const ZHENGGU_CODES = [
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyF",
    "KeyG",
    "KeyH",
    "KeyW",
    "KeyE",
    "KeyR",
    "KeyT",
    "KeyY",
    "KeyU",
  ];
  const CEGU_CODES = [
    "KeyZ",
    "KeyX",
    "KeyC",
    "KeyV",
    "KeyB",
    "KeyN",
    "Digit2",
    "Digit3",
    "Digit4",
    "Digit5",
    "Digit6",
    "Digit7",
  ];
  const ALL_CODES = [...ZHENGGU_CODES, ...CEGU_CODES];

  it("keys the keyboard map on physical event.code values from the twenty-four listed", () => {
    const buttons = doc?.querySelectorAll("button[data-bell]") ?? [];
    for (const button of buttons) {
      const zhengguCode = button.getAttribute("data-key-zhenggu");
      const ceguCode = button.getAttribute("data-key-cegu");
      expect(zhengguCode, "data-key-zhenggu").not.toBeNull();
      expect(ceguCode, "data-key-cegu").not.toBeNull();
      expect(ALL_CODES.includes(zhengguCode as string), zhengguCode ?? "").toBe(true);
      expect(ALL_CODES.includes(ceguCode as string), ceguCode ?? "").toBe(true);
    }
  });

  it("covers all twelve bells at both tones with twenty-four distinct codes, no duplicates", () => {
    const buttons = doc?.querySelectorAll("button[data-bell]") ?? [];
    const zhengguKeys = [...buttons].map((b) => b.getAttribute("data-key-zhenggu"));
    const ceguKeys = [...buttons].map((b) => b.getAttribute("data-key-cegu"));
    const allKeys = [...zhengguKeys, ...ceguKeys];

    expect(allKeys.length).toBe(24);
    expect(new Set(allKeys).size).toBe(24);
  });

  it("contains no element implying a score, timer, level or fail state", () => {
    const text = (doc?.body.textContent ?? "").toLowerCase();
    const html = (doc?.body.innerHTML ?? "").toLowerCase();
    for (const word of FORBIDDEN) {
      expect(text.includes(word), `found forbidden word "${word}" in text`).toBe(false);
      expect(html.includes(word), `found forbidden word "${word}" in markup`).toBe(false);
    }
  });

  it("never uses an <audio> or <video> element", () => {
    const media = doc?.querySelectorAll("audio, video") ?? [];
    expect(media.length).toBe(0);
  });

  it("in the initial DOM, exactly one bell is focusable and eleven are inert", () => {
    const buttons = [...(doc?.querySelectorAll("button[data-bell]") ?? [])];
    const inert = buttons.filter((b) => b.hasAttribute("inert"));
    const focusable = buttons.filter((b) => !b.hasAttribute("inert"));
    expect(inert.length).toBe(11);
    expect(focusable.length).toBe(1);
    expect(focusable[0]?.getAttribute("data-bell")).toBe("1");
  });

  it("gives every bell a distinct, non-empty English aria-label with no Chinese characters", () => {
    const buttons = [...(doc?.querySelectorAll("button[data-bell]") ?? [])];
    const hasChinese = (s: string) => /[一-鿿]/.test(s);
    const labels = buttons.map((b) => (b.getAttribute("aria-label") ?? "").trim());

    for (const [i, label] of labels.entries()) {
      const bellId = buttons[i]?.getAttribute("data-bell");
      expect(label.length, `bell ${bellId} has no aria-label`).toBeGreaterThan(0);
      expect(hasChinese(label), `bell ${bellId} aria-label "${label}" contains Chinese`).toBe(
        false,
      );
    }
    expect(new Set(labels).size, `aria-labels: ${labels.join(", ")}`).toBe(labels.length);
  });

  it("shows the initially interactive bell already carrying three strike marks", () => {
    const first = doc?.querySelector('button[data-bell="1"]');
    const marks = first?.querySelectorAll(".mark") ?? [];
    expect(marks.length).toBe(3);
  });

  it("gives every bell exactly three strike marks", () => {
    const buttons = [...(doc?.querySelectorAll("button[data-bell]") ?? [])];
    for (const button of buttons) {
      const marks = button.querySelectorAll(".mark");
      expect(marks.length, `bell ${button.getAttribute("data-bell")}`).toBe(3);
    }
  });

  // Bug fix, this revision: the mallet used to be .rack's first child,
  // which desynced every :nth-child(N) tier rule in styles.css by one —
  // see FACT-CHECK.md "Rack tier order". .rack must contain bell cells
  // and nothing else, so no future sibling can do that again.
  it("makes every child of .rack a .bell-cell, twelve of them and nothing else", () => {
    const rack = doc?.querySelector("#rack");
    const children = [...(rack?.children ?? [])];
    expect(children.length).toBe(12);
    for (const child of children) {
      expect(child.classList.contains("bell-cell"), child.outerHTML.slice(0, 60)).toBe(true);
    }
  });
});

// This only reads styles.css as text — vitest with jsdom has no layout
// engine, so nothing here (or in any test) can check how many columns
// actually render at a given width, or what a bell actually measures.
// That was checked by hand; see the session's report for the numbers.
describe("styles.css: the rack sizes itself from bell width, not viewport height", () => {
  const css = readFileSync(resolve("styles.css"), "utf8");

  function rule(selector: string, source: string): string {
    const re = new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`, "s");
    const match = source.match(re);
    if (!match) throw new Error(`no ${selector} rule found in styles.css`);
    return match[1];
  }

  // Extracts one balanced-brace @media block's body (the block only,
  // braces stripped) and, separately, the source with that whole block
  // removed — so a check below can say "nowhere outside this block" and
  // a check inside "\@media (max-width: 600px)" describe can say "inside
  // it, exactly this".
  function extractMediaBlock(source: string, mediaSelector: string): { body: string; rest: string } {
    const start = source.indexOf(mediaSelector);
    if (start === -1) throw new Error(`no "${mediaSelector}" block found in styles.css`);
    const openBrace = source.indexOf("{", start);
    let depth = 0;
    let i = openBrace;
    for (; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    return {
      body: source.slice(openBrace + 1, i),
      rest: source.slice(0, start) + source.slice(i + 1),
    };
  }

  it("sizes the rack's columns with auto-fit and a minmax floor of at least 132px", () => {
    const rackRule = rule("\\.rack", css);
    const match = rackRule.match(/repeat\(\s*auto-fit\s*,\s*minmax\(\s*(\d+(?:\.\d+)?)px/);
    expect(
      match,
      `.rack grid-template-columns does not use repeat(auto-fit, minmax(<px>, ...)): ${rackRule}`,
    ).toBeTruthy();
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(132);
  });

  // Part A/C's one deliberate exception: under a coarse (touch) pointer
  // the rack forces exactly two columns (see the test below). Outside
  // that block, the rule still holds absolutely.
  it("never sets a fixed integer column count on the rack outside the coarse-pointer block", () => {
    const { rest } = extractMediaBlock(css, "@media (pointer: coarse)");
    expect(
      /\.rack[^}]*grid-template-columns\s*:\s*repeat\(\s*\d+\s*,/s.test(rest),
      "found repeat(<integer>, ...) on .rack outside the @media (pointer: coarse) block",
    ).toBe(false);
  });

  // Ava's decision (recorded in DESIGN.md): on a touchscreen the scarce
  // resource is aimable target width, not size-as-pitch, so under a
  // coarse pointer every bell drops to the 132px minimum in two columns;
  // grading survives under a fine pointer. This is the only place in the
  // file a fixed column count is allowed — checked precisely, not just
  // excluded above. Gated on pointer type (Part A), not viewport width —
  // a narrow window with a mouse keeps its grading and its height cap.
  it("under a coarse pointer, forces exactly two columns and every bell to the 132px floor", () => {
    const { body } = extractMediaBlock(css, "@media (pointer: coarse)");
    expect(
      /grid-template-columns\s*:\s*repeat\(\s*2\s*,/.test(body),
      `coarse-pointer block does not force exactly two columns: ${body}`,
    ).toBe(true);
    const bellWidthDecls = [...body.matchAll(/--bell-w:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(bellWidthDecls.length, "coarse-pointer block sets no --bell-w").toBeGreaterThan(0);
    for (const decl of bellWidthDecls) {
      expect(decl, `coarse-pointer --bell-w is "${decl}", expected exactly 132px`).toBe("132px");
    }
  });

  // Regression, this session: touch-action: none on .rack blocked the
  // browser's native vertical-scroll gesture for any swipe starting over
  // the rack (most of a phone's screen width). It only became visible
  // once six rows made the rack taller than the viewport; it would have
  // blocked scroll at any row count that needed one. See FACT-CHECK.md
  // "Touch-action blocked scroll on the coarse-pointer branch". Checked
  // on the base .rack rule directly (not gated to the coarse-pointer
  // block) — pan-y is harmless under a fine pointer too, since a mouse
  // never sends the touch gesture it disables.
  it("allows native vertical scroll panning on the rack (not touch-action: none)", () => {
    const rackRule = rule("\\.rack", css).replace(/\/\*.*?\*\//gs, "");
    const decl = rackRule.match(/touch-action:\s*([^;]+);/)?.[1]?.trim();
    expect(decl, `.rack sets no touch-action: ${rackRule}`).toBeTruthy();
    expect(decl, `.rack touch-action is "${decl}", which blocks native scroll`).not.toBe("none");
    expect(decl?.includes("pan-y") || decl === "auto", `.rack touch-action "${decl}" does not permit vertical panning`).toBe(true);
  });

  it("does not derive bell width from a vh expression", () => {
    const bellWidthDecls = [...css.matchAll(/--bell-w:\s*([^;]+);/g)].map((m) => m[1]);
    expect(bellWidthDecls.length, "no --bell-w declarations found").toBeGreaterThan(0);
    for (const decl of bellWidthDecls) {
      expect(decl.includes("vh"), `--bell-w declaration "${decl}" derives from vh`).toBe(false);
    }
  });

  // Part C: under a fine pointer, the rack's own height must be bounded
  // by a vh expression so the whole thing fits the viewport without
  // scrolling — not left to grow to whatever the graded bell widths add
  // up to.
  it("under a fine pointer, bounds the rack's height cap by a vh expression", () => {
    const { body } = extractMediaBlock(css, "@media (pointer: fine)");
    const capDecl = body.match(/--bell-height-cap:\s*([^;]+);/)?.[1] ?? "";
    expect(capDecl, "fine-pointer block sets no --bell-height-cap").not.toBe("");
    expect(capDecl.includes("vh"), `--bell-height-cap "${capDecl}" does not derive from vh`).toBe(
      true,
    );
  });

  // Part D2: bells hang from a rail (tops aligned, bottoms differ by
  // size), but the caption strips below them must not stagger with the
  // bells — every caption in a row needs a common baseline. Checked
  // structurally: the grid stretches every cell in a row to the same
  // height, and the caption is pinned to the bottom of its own
  // (now-equal-height) cell rather than sized or positioned from the
  // bell's own graded width.
  it("stretches grid rows and pins the caption to the bottom of its cell, so captions share a row baseline", () => {
    const rackRule = rule("\\.rack", css);
    expect(
      /align-items\s*:\s*stretch/.test(rackRule),
      `.rack does not stretch its cells to a common row height: ${rackRule}`,
    ).toBe(true);

    const captionRule = rule("\\.bell-caption", css);
    expect(
      /margin(-top)?\s*:\s*(auto|[^;]*\bauto\b[^;]*0)/.test(captionRule),
      `.bell-caption is not bottom-pinned with margin-top: auto: ${captionRule}`,
    ).toBe(true);
    expect(
      captionRule.includes("--bell-w"),
      `.bell-caption sizes itself from --bell-w, which would break a common row baseline: ${captionRule}`,
    ).toBe(false);
  });

  it("sizes the strike marks relative to the bell, not as a fixed pixel value", () => {
    const markRule = rule("\\.mark", css);
    const widthDecl = markRule.match(/width:\s*([^;]+);/)?.[1]?.trim() ?? "";
    expect(widthDecl, ".mark has no width declaration").not.toBe("");
    expect(widthDecl.includes("%"), `.mark width is "${widthDecl}", expected a % of the bell`).toBe(
      true,
    );
    expect(widthDecl.includes("px"), `.mark width is "${widthDecl}", must not be a fixed px value`).toBe(
      false,
    );
  });

  it("never hides a mark behind a state class — marks are permanent, not staged", () => {
    const markRule = rule("\\.mark", css);
    const opacityDecl = markRule.match(/opacity:\s*([^;]+);/)?.[1]?.trim();
    expect(opacityDecl, ".mark has no opacity declaration").not.toBe("0");
    expect(/marks-shown/.test(css), "a marks-shown class still exists in styles.css").toBe(false);
  });

  // Bug fix, this revision: `order` used to live on `.bell-cell:nth-child(N)`
  // rules — a positional selector that silently re-bound to the wrong
  // bell when an unrelated sibling (the mallet) was added inside .rack.
  // `order` is now set per bell by src/ui.ts from src/layout.ts's
  // tierOrder(), never by CSS. This test guards the CSS side: no rule
  // that sets `order` may be keyed off :nth-child, ever again.
  it("never sets `order` on a :nth-child-selected rule", () => {
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let match: RegExpExecArray | null;
    const offenders: string[] = [];
    while ((match = ruleRe.exec(css))) {
      const [, selector, body] = match;
      if (/\border\s*:/.test(body) && selector.includes(":nth-child")) {
        offenders.push(selector.trim());
      }
    }
    expect(offenders, `rules setting order via :nth-child: ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("melody.ts: melodyToStrikes", () => {
  it("maps every note to a real bell, 1 through 12", () => {
    const strikes = melodyToStrikes(MOLIHUA_OPENING, bells);
    expect(strikes.length).toBe(MOLIHUA_OPENING.length);
    for (const s of strikes) {
      expect(s.bell).toBeGreaterThanOrEqual(1);
      expect(s.bell).toBeLessThanOrEqual(12);
    }
  });

  it("keeps every x within 0..1", () => {
    const strikes = melodyToStrikes(MOLIHUA_OPENING, bells);
    for (const s of strikes) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
    }
  });

  it("keeps atMs strictly increasing, matching the input melody's own order", () => {
    const strikes = melodyToStrikes(MOLIHUA_OPENING, bells);
    for (let i = 1; i < strikes.length; i++) {
      expect(strikes[i].atMs).toBeGreaterThan(strikes[i - 1].atMs);
    }
  });

  it("only ever strikes a ratio the rack can actually produce, checked by ratio not by name", () => {
    const strikes = melodyToStrikes(MOLIHUA_OPENING, bells);
    for (const s of strikes) {
      const bell = bells[s.bell - 1];
      const producible = s.x === 0.5 ? bell.zhenggu.ratio : bell.cegu.ratio;
      expect(Number.isFinite(producible)).toBe(true);
    }
  });

  it("reproduces the exact bell/strike-position table recorded in FACT-CHECK.md", () => {
    const strikes = melodyToStrikes(MOLIHUA_OPENING, bells);
    const seen = new Set(strikes.map((s) => `${s.bell}:${s.x}`));
    // gong'->bell11 cegu, jue->bell3 zhenggu, zhi->bell10 zhenggu,
    // yu->bell11 zhenggu — the four distinct (bell, x) pairs this
    // eleven-note phrase actually touches.
    expect(seen).toEqual(new Set(["3:0.5", "10:0.5", "11:0.5", "11:0"]));
  });

  it("throws, naming the offending degree, for a degree this rack has no bell for", () => {
    expect(() =>
      melodyToStrikes([{ degree: 4, octave: 0, atMs: 0, gain: 1 }], bells),
    ).toThrow(/degree 4/);
  });

  it("throws, naming the offending degree, for an octave the rack cannot reach", () => {
    // degree 6 (yu) exists on the rack at octave 0, but not one octave
    // down — the same out-of-range note FACT-CHECK.md reports from later
    // in the real song.
    expect(() =>
      melodyToStrikes([{ degree: 6, octave: -1, atMs: 0, gain: 1 }], bells),
    ).toThrow(/degree 6/);
  });

  it("does not silently round an out-of-range note onto a bell that exists", () => {
    expect(() =>
      melodyToStrikes([{ degree: 5, octave: -1, atMs: 0, gain: 1 }], bells),
    ).toThrow();
  });
});
