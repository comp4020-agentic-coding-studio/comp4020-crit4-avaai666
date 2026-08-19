// The opening reveal sequence, as a pure state machine. No DOM, no
// Web Audio, no timers — src/ui.ts calls transition() and renders
// whatever state comes back.
//
// waiting:    only bell 1 is interactive. Nothing else is visible.
// marksShown: bell 1 has been struck once. Its two strike marks are
//             shown at full opacity. The other nine bells stay hidden.
// revealed:   the other nine bells are shown. Terminal — nothing moves
//             the machine back out of it.
export type State = "waiting" | "marksShown" | "revealed";

export type Event = { type: "strike"; ceguGain: number } | { type: "tick" };

// How long the marks hold before the rack reveals itself even if the
// corner is never found. Guess — see LISTENING.md.
export const REVEAL_TIMEOUT_MS = 6000;
// A strike counts as landing on the corner above this cegu gain (mix()
// gives cegu 1 at the edges, 0 at the centre — 0.5 is partway between).
export const CORNER_GAIN_THRESHOLD = 0.5;

export const INITIAL_STATE: State = "waiting";

// elapsedMs is the time since marksShown was entered; it's ignored in
// every other state.
export function transition(state: State, event: Event, elapsedMs: number): State {
  if (state === "revealed") return "revealed";

  if (state === "waiting") {
    return event.type === "strike" ? "marksShown" : "waiting";
  }

  if (elapsedMs >= REVEAL_TIMEOUT_MS) return "revealed";
  if (event.type === "strike" && event.ceguGain > CORNER_GAIN_THRESHOLD) return "revealed";
  return "marksShown";
}

export function marksVisible(state: State): boolean {
  return state === "marksShown";
}

export function rackVisible(state: State): boolean {
  return state === "revealed";
}
