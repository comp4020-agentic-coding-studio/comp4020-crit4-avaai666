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
//   }[]                                                         // length 10, index 0 = bell 1
//
// src/strike.ts
//   export function mix(x: number): { zhenggu: number; cegu: number }
//
// src/voice.ts
//   export function partials(
//     fundamentalHz: number,
//     bellIndex: number,                                        // 1..10
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
//   each bell is <button data-bell="1".."10">, carries a non-empty
//   accessible name (text content or aria-label), and carries
//   data-key-zhenggu / data-key-cegu attributes naming its two keys as
//   KeyboardEvent.code values (e.g. "KeyA", "Semicolon") — physical key
//   positions, not characters, per DESIGN.md.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { bells, HUANGZHONG_HZ, LU_TABLE } from "../src/tuning";
import { mix } from "../src/strike";
import { partials } from "../src/voice";
import { createEngine } from "../src/audio";
import {
  INITIAL_STATE,
  REVEAL_TIMEOUT_MS,
  marksVisible,
  rackVisible,
  transition,
  type State,
} from "../src/reveal";

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
  it("has exactly 10 bells", () => {
    expect(bells.length).toBe(10);
  });

  it("has strictly ascending zhenggu frequencies across bells 1..10", () => {
    for (let i = 0; i < bells.length - 1; i++) {
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

  it("makes bells 6..10 exactly double bells 1..5, both tones", () => {
    for (let i = 0; i < 5; i++) {
      expect(bells[5 + i].zhenggu.ratio).toBe(bells[i].zhenggu.ratio * 2);
      expect(bells[5 + i].cegu.ratio).toBe(bells[i].cegu.ratio * 2);
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

  it("has exactly the five pentatonic zhenggu ratios in the first octave", () => {
    const expected = [1 / 1, 9 / 8, 81 / 64, 3 / 2, 27 / 16];
    const actual = bells.slice(0, 5).map((b) => b.zhenggu.ratio);
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

  it("uses exactly these five zhenggu pitch classes", () => {
    const names = new Set(bells.map((b) => b.zhenggu.name));
    expect(names).toEqual(new Set(["黄钟", "太簇", "姑洗", "林钟", "南吕"]));
  });

  it("uses exactly these five cegu pitch classes", () => {
    const names = new Set(bells.map((b) => b.cegu.name));
    expect(names).toEqual(new Set(["姑洗", "蕤宾", "林钟", "应钟", "黄钟"]));
  });

  it("leaves dalü, jiazhong, zhonglü, yize and wuyi in the table but unused by any bell", () => {
    const unused = ["大吕", "夹钟", "仲吕", "夷则", "无射"];
    for (const name of unused) {
      expect(LU_TABLE.some((lu) => lu.name === name), `${name} missing from LU_TABLE`).toBe(true);
    }
    const used = new Set([...bells.map((b) => b.zhenggu.name), ...bells.map((b) => b.cegu.name)]);
    for (const name of unused) {
      expect(used.has(name), `${name} unexpectedly struck by a bell`).toBe(false);
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
    for (let bell = 1; bell <= 10; bell++) {
      const ps = partials(HUANGZHONG_HZ, bell);
      expect(ps[0].freq).toBe(HUANGZHONG_HZ);
    }
  });

  it("gives strictly descending partial gains", () => {
    for (let bell = 1; bell <= 10; bell++) {
      const gains = partials(HUANGZHONG_HZ, bell).map((p) => p.gain);
      for (let i = 0; i < gains.length - 1; i++) {
        expect(gains[i]).toBeGreaterThan(gains[i + 1]);
      }
    }
  });

  it("decays higher partials strictly faster than lower ones", () => {
    for (let bell = 1; bell <= 10; bell++) {
      const decays = partials(HUANGZHONG_HZ, bell).map((p) => p.decay);
      for (let i = 0; i < decays.length - 1; i++) {
        expect(decays[i]).toBeGreaterThan(decays[i + 1]);
      }
    }
  });

  it("gives bell 1 a longer fundamental decay than bell 10", () => {
    const bell1 = partials(HUANGZHONG_HZ, 1)[0].decay;
    const bell10 = partials(HUANGZHONG_HZ, 10)[0].decay;
    expect(bell1).toBeGreaterThan(bell10);
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
      engine.strike((i % 10) + 1, (i % 11) / 10);
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
  type Event = { type: "strike"; ceguGain: number } | { type: "tick" };
  const CENTRE: Event = { type: "strike", ceguGain: 0 };
  const CORNER: Event = { type: "strike", ceguGain: 0.9 };
  const TICK: Event = { type: "tick" };

  it("starts in a state that exposes exactly one interactive bell", () => {
    expect(rackVisible(INITIAL_STATE)).toBe(false);
  });

  it("a first-strike event moves to a state where the marks are shown and the rack is still hidden", () => {
    const next = transition(INITIAL_STATE, CENTRE, 0);
    expect(marksVisible(next)).toBe(true);
    expect(rackVisible(next)).toBe(false);
  });

  it("the rack does not appear in the marks-shown state, at any elapsed time below the timeout", () => {
    let state: State = INITIAL_STATE;
    state = transition(state, CENTRE, 0);
    for (let t = 0; t < REVEAL_TIMEOUT_MS; t += 250) {
      const next = transition(state, TICK, t);
      expect(rackVisible(next), `t=${t}ms`).toBe(false);
    }
  });

  it("a corner-strike event reveals the rack", () => {
    let state: State = INITIAL_STATE;
    state = transition(state, CENTRE, 0);
    state = transition(state, CORNER, 500);
    expect(rackVisible(state)).toBe(true);
  });

  it("a centre strike before the timeout does not reveal the rack", () => {
    let state: State = INITIAL_STATE;
    state = transition(state, CENTRE, 0);
    state = transition(state, CENTRE, 500);
    expect(rackVisible(state)).toBe(false);
  });

  it("reaching the timeout reveals the rack", () => {
    let state: State = INITIAL_STATE;
    state = transition(state, CENTRE, 0);
    state = transition(state, TICK, REVEAL_TIMEOUT_MS);
    expect(rackVisible(state)).toBe(true);
  });

  it("once revealed, no event returns it to a hidden state", () => {
    let state: State = INITIAL_STATE;
    state = transition(state, CENTRE, 0);
    state = transition(state, TICK, REVEAL_TIMEOUT_MS);
    expect(rackVisible(state)).toBe(true);
    for (const event of [CENTRE, CORNER, TICK]) {
      for (const t of [0, 1, REVEAL_TIMEOUT_MS, REVEAL_TIMEOUT_MS * 10]) {
        expect(rackVisible(transition(state, event, t)), `${event.type} at t=${t}`).toBe(true);
      }
    }
  });

  it("the marks-shown state and the rack-appearing state are never both active at the same elapsed time", () => {
    const allStates: State[] = ["waiting", "marksShown", "revealed"];
    for (const state of allStates) {
      expect(marksVisible(state) && rackVisible(state)).toBe(false);
    }
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

  it("renders ten bells, each as a real <button>", () => {
    const buttons = doc?.querySelectorAll("button[data-bell]") ?? [];
    expect(buttons.length).toBe(10);
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

  const ZHENGGU_CODES = [
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyF",
    "KeyG",
    "KeyH",
    "KeyJ",
    "KeyK",
    "KeyL",
    "Semicolon",
  ];
  const CEGU_CODES = [
    "KeyQ",
    "KeyW",
    "KeyE",
    "KeyR",
    "KeyT",
    "KeyY",
    "KeyU",
    "KeyI",
    "KeyO",
    "KeyP",
  ];
  const ALL_CODES = [...ZHENGGU_CODES, ...CEGU_CODES];

  it("keys the keyboard map on physical event.code values from the twenty listed", () => {
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

  it("covers all ten bells at both tones with twenty distinct codes, no duplicates", () => {
    const buttons = doc?.querySelectorAll("button[data-bell]") ?? [];
    const zhengguKeys = [...buttons].map((b) => b.getAttribute("data-key-zhenggu"));
    const ceguKeys = [...buttons].map((b) => b.getAttribute("data-key-cegu"));
    const allKeys = [...zhengguKeys, ...ceguKeys];

    expect(allKeys.length).toBe(20);
    expect(new Set(allKeys).size).toBe(20);
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
});

// This only reads styles.css as text — vitest with jsdom has no layout
// engine, so nothing here (or in any test) can check that the reflow
// actually renders as two columns with >=44px strike zones. That was
// checked by hand at 390x844.
describe("styles.css: mobile reflow (stylesheet text only, not rendering)", () => {
  const css = readFileSync(resolve("styles.css"), "utf8");

  function mediaBlocks(source: string): { condition: string; body: string }[] {
    const blocks: { condition: string; body: string }[] = [];
    const re = /@media([^{]*)\{/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) {
      const start = match.index + match[0].length;
      let depth = 1;
      let i = start;
      while (i < source.length && depth > 0) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}") depth--;
        i++;
      }
      blocks.push({ condition: match[1], body: source.slice(start, i - 1) });
      re.lastIndex = i;
    }
    return blocks;
  }

  const twoColumnBlock = mediaBlocks(css).find(
    (b) => /max-width/.test(b.condition) && /\.rack[^}]*repeat\(\s*2\s*,/s.test(b.body),
  );

  it("has a max-width media query that sets the rack to two columns", () => {
    expect(twoColumnBlock, "no max-width media query sets .rack to repeat(2, ...)").toBeTruthy();
  });

  it("gives the two-column rack a bell minimum width of at least 88px, so two 44px zones fit", () => {
    const widths = [...(twoColumnBlock?.body.matchAll(/minmax\(\s*(\d+)px/g) ?? [])].map((m) =>
      Number(m[1]),
    );
    expect(widths.length, "no minmax(...px, ...) token in that block").toBeGreaterThan(0);
    expect(Math.min(...widths), `minmax widths found: ${widths.join(", ")}`).toBeGreaterThanOrEqual(
      88,
    );
  });
});
