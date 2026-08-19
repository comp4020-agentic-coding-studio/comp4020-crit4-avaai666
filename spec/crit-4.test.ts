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
//   export const LU_TABLE: { name: string; ratio: number }[]   // the lü used in this design
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
// The page (built to dist/index.html):
//   each bell is <button data-bell="1".."10">, carries a non-empty
//   accessible name (text content or aria-label), and carries
//   data-key-zhenggu / data-key-cegu attributes naming its two keys.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { bells, HUANGZHONG_HZ, LU_TABLE } from "../src/tuning";
import { mix } from "../src/strike";
import { partials } from "../src/voice";

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

  it("maps all ten bells at both tones to twenty distinct keys", () => {
    const buttons = doc?.querySelectorAll("button[data-bell]") ?? [];
    const zhengguKeys = [...buttons].map((b) => b.getAttribute("data-key-zhenggu"));
    const ceguKeys = [...buttons].map((b) => b.getAttribute("data-key-cegu"));
    const allKeys = [...zhengguKeys, ...ceguKeys];

    expect(zhengguKeys.every((k) => !!k)).toBe(true);
    expect(ceguKeys.every((k) => !!k)).toBe(true);
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
