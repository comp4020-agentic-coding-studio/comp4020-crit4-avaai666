// The opening reveal sequence, as a pure state machine. No DOM, no
// Web Audio, no timers — src/ui.ts calls transition() and renders
// whatever state comes back.
//
// waiting:  only bell 1 is interactive. Its strike marks are already
//           visible — permanent, not staged by this state machine. See
//           index.html/styles.css, not this file.
// revealed: the other eleven bells are shown. Terminal — nothing moves
//           the machine back out of it.
export type State = "waiting" | "revealed";

export type Event = { type: "strike" };

export const INITIAL_STATE: State = "waiting";

export function transition(state: State, event: Event): State {
  if (state === "revealed") return "revealed";
  return event.type === "strike" ? "revealed" : "waiting";
}

export function rackVisible(state: State): boolean {
  return state === "revealed";
}
