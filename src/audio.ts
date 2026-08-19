import { bells } from "./tuning";
import { mix } from "./strike";
import { partials } from "./voice";

// All numeric values in this file (attack time, release floor, noise
// duration/gain, master gain, voice cap, compressor settings) are guesses,
// to be tuned by ear against LISTENING.md.
const ATTACK_SECONDS = 0.002;
// exponentialRampToValueAtTime can't target 0, so decay ramps toward this
// instead — small enough to read as silence.
const RELEASE_FLOOR = 0.0001;
const NOISE_SECONDS = 0.008;
const NOISE_GAIN = 0.15;
const MASTER_GAIN = 0.6;
const MAX_VOICES = 32;

interface Engine {
  strike(bellIndex: number, x: number): void;
}

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  noiseBuffer: AudioBuffer;
}

interface Voice {
  osc: OscillatorNode;
  gainNode: GainNode;
}

function buildGraph(ctx: AudioContext): Graph {
  // Master gain into a compressor, so ten bells struck at once get squashed
  // together instead of clipping at the destination.
  const compressor = ctx.createDynamicsCompressor();
  compressor.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(compressor);

  // One shared noise buffer for every mallet transient — cheaper than a
  // fresh buffer per strike, and the transient is short enough that reuse
  // is inaudible.
  const length = Math.max(1, Math.round(ctx.sampleRate * NOISE_SECONDS));
  const noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  return { ctx, master, noiseBuffer };
}

function playPartial(
  g: Graph,
  now: number,
  freq: number,
  gain: number,
  decaySeconds: number,
): Voice {
  const osc = g.ctx.createOscillator();
  osc.frequency.value = freq;

  const gainNode = g.ctx.createGain();
  gainNode.gain.value = 0;
  // Linear ramp up avoids the click a hard jump to full gain would cause.
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(gain, now + ATTACK_SECONDS);
  gainNode.gain.exponentialRampToValueAtTime(RELEASE_FLOOR, now + ATTACK_SECONDS + decaySeconds);

  osc.connect(gainNode);
  gainNode.connect(g.master);

  osc.start(now);
  osc.stop(now + ATTACK_SECONDS + decaySeconds + 0.05);

  return { osc, gainNode };
}

function playNoiseTransient(g: Graph, now: number, gain: number): void {
  const source = g.ctx.createBufferSource();
  source.buffer = g.noiseBuffer;

  const gainNode = g.ctx.createGain();
  gainNode.gain.value = gain;

  source.connect(gainNode);
  gainNode.connect(g.master);

  source.start(now);
  source.stop(now + NOISE_SECONDS);
}

export function createEngine(
  AudioContextCtor: typeof AudioContext = globalThis.AudioContext,
): Engine {
  let graph: Graph | null = null;
  const voices: Voice[] = [];

  function addVoice(voice: Voice): void {
    voices.push(voice);
    // Once the node stops sounding, drop it from the list — nothing else
    // references it, so it's free to be collected.
    voice.osc.onended = () => {
      const i = voices.indexOf(voice);
      if (i >= 0) voices.splice(i, 1);
    };
    // Cap concurrent voices: steal the oldest still-sounding one rather
    // than let the graph grow without bound during a fast pile-up.
    while (voices.length > MAX_VOICES) {
      const oldest = voices.shift();
      oldest?.osc.stop();
    }
  }

  return {
    strike(bellIndex: number, x: number): void {
      const bell = bells[bellIndex - 1];
      if (!bell) return;

      if (!graph) {
        const ctx = new AudioContextCtor();
        // Deliberately not awaited — see DESIGN.md "Opening".
        void ctx.resume();
        graph = buildGraph(ctx);
      }
      const g = graph;
      const now = g.ctx.currentTime;

      const { zhenggu, cegu } = mix(x);
      const tones: [number, { freq: number }][] = [
        [zhenggu, bell.zhenggu],
        [cegu, bell.cegu],
      ];
      for (const [toneGain, tone] of tones) {
        if (toneGain <= 0) continue;
        for (const p of partials(tone.freq, bellIndex)) {
          addVoice(playPartial(g, now, p.freq, p.gain * toneGain, p.decay));
        }
      }
      playNoiseTransient(g, now, NOISE_GAIN * Math.max(zhenggu, cegu));
    },
  };
}
