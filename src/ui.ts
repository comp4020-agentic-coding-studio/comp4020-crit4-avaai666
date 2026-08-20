import { createEngine } from "./audio";
import { INITIAL_STATE, rackVisible, transition, type State } from "./reveal";
import { centreMarkBox, cornerMarkLeftBox, tierOrder } from "./layout";
import { CREAM, FRAME_GRADIENT_BOTTOM, FRAME_GRADIENT_TOP, MARK_EDGE, MARK_FILL } from "./color";
import { melodyToStrikes, MOLIHUA_OPENING } from "./melody";
import { bells } from "./tuning";

const rack = document.querySelector<HTMLElement>("#rack");

// Fractions from src/layout.ts, written once as CSS custom properties so
// styles.css positions the marks without holding its own copy of any of
// these numbers. width=1, height=1 makes every box's x/w a fraction of
// the bell's width and y/h a fraction of its height — exactly what a CSS
// % of the button's own (aspect-ratio-derived) box means for
// left/width and top/height respectively. The lu label and romanisation
// are no longer bell-face geometry — they're static caption markup in
// index.html, positioned by plain CSS in the frame below each bell.
function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(4)}%`;
}

function applyLayoutVars(root: HTMLElement): void {
  const centre = centreMarkBox(1, 1);
  const corner = cornerMarkLeftBox(1, 1);

  root.style.setProperty("--mark-w", pct(centre.w));
  root.style.setProperty("--mark-centre-y", pct(centre.y + centre.h / 2));
  root.style.setProperty("--mark-corner-x", pct(corner.x + corner.w / 2));
  root.style.setProperty("--mark-corner-y", pct(corner.y + corner.h / 2));
}

// Colour tokens from src/color.ts, written the same way — so the page and
// the contrast tests never drift apart from having two copies of a hex
// value. The bell's own gradient stops aren't here: they're SVG
// presentation attributes in index.html, which can't take a CSS custom
// property, so they're mirrored there by hand instead — see the comment
// on index.html's #bell-gradient.
function applyColorVars(root: HTMLElement): void {
  root.style.setProperty("--cream", CREAM);
  root.style.setProperty("--mark-fill", MARK_FILL);
  root.style.setProperty("--mark-edge", MARK_EDGE);
  root.style.setProperty("--frame-gradient-top", FRAME_GRADIENT_TOP);
  root.style.setProperty("--frame-gradient-bottom", FRAME_GRADIENT_BOTTOM);
}

applyLayoutVars(document.documentElement);
applyColorVars(document.documentElement);

if (rack) {
  const engine = createEngine();
  const bellButtons = [...rack.querySelectorAll<HTMLButtonElement>("button[data-bell]")];
  const firstBell = bellButtons.find((b) => b.dataset.bell === "1") ?? null;
  const mallet = document.querySelector<HTMLElement>("#mallet");

  // Tier order (bug fix): no positional selector anywhere near this — see
  // src/layout.ts's tierOrder. Set directly on the grid item (.bell-cell),
  // not the button, since .bell-cell is what CSS `order` reorders.
  for (const button of bellButtons) {
    const cell = button.closest<HTMLElement>(".bell-cell");
    const bellIndex = Number(button.dataset.bell);
    if (cell) cell.style.order = String(tierOrder(bellIndex));
  }

  const keyMap = new Map<string, { button: HTMLButtonElement; x: number }>();
  for (const button of bellButtons) {
    const zhengguCode = button.dataset.keyZhenggu;
    const ceguCode = button.dataset.keyCegu;
    if (zhengguCode) keyMap.set(zhengguCode, { button, x: 0.5 });
    if (ceguCode) keyMap.set(ceguCode, { button, x: 0 });
  }

  let revealState: State = INITIAL_STATE;

  function render(state: State): void {
    rack.classList.toggle("opened", rackVisible(state));
    if (rackVisible(state)) {
      for (const button of bellButtons) button.removeAttribute("inert");
    }
  }

  function dispatch(event: Parameters<typeof transition>[1]): void {
    const next = transition(revealState, event);
    if (revealState !== next) {
      revealState = next;
      render(revealState);
    }
  }

  // Strike feedback, struck bell only: a swing (styles.css .bell--struck)
  // and a ripple that starts at the exact point struck. --strike-y
  // interpolates between the centre mark (80%) and the corner marks
  // (92.5%) using the same distance-from-centre measure as strike.ts's
  // mix(), so the ripple's origin tracks where the marks actually are.
  // The class is removed and re-added (via a reflow) so a strike can
  // retrigger the animation before the previous one has finished.
  function showStrikeFeedback(button: HTMLButtonElement, x: number): void {
    const d = Math.abs(x - 0.5) * 2;
    const yPercent = 80 + d * 12.5;
    button.style.setProperty("--strike-x", `${x * 100}%`);
    button.style.setProperty("--strike-y", `${yPercent}%`);
    button.classList.remove("bell--struck");
    void button.offsetWidth;
    button.classList.add("bell--struck");
  }

  for (const button of bellButtons) {
    button.addEventListener("animationend", (event) => {
      if (event.target === button) button.classList.remove("bell--struck");
    });
  }

  // Mallet (D1): follows the pointer over the rack, swings on strike, at
  // the exact point struck. Mouse only — event.pointerType distinguishes
  // it from touch (which also fires PointerEvents); keyboard never fires
  // pointer events at all, so it's excluded with no extra code.
  // prefers-reduced-motion hides it entirely, in styles.css.
  function updateMalletPosition(clientX: number, clientY: number): void {
    if (!mallet) return;
    const rackRect = rack.getBoundingClientRect();
    mallet.style.setProperty("--mallet-x", `${clientX - rackRect.left}px`);
    mallet.style.setProperty("--mallet-y", `${clientY - rackRect.top}px`);
  }

  function swingMallet(): void {
    if (!mallet) return;
    mallet.classList.remove("mallet--swing");
    void mallet.offsetWidth;
    mallet.classList.add("mallet--swing");
  }

  if (mallet) {
    rack.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      updateMalletPosition(event.clientX, event.clientY);
      mallet.classList.add("mallet--visible");
    });
    rack.addEventListener("pointerleave", () => {
      mallet.classList.remove("mallet--visible");
    });
  }

  let dragActive = false;
  let lastStruck: HTMLButtonElement | null = null;

  // Sweep-intent: a touch/pen drag starting on a bell doesn't declare
  // itself a sweep (and doesn't capture the pointer) until it has moved
  // far enough to say which way. A finger dragging downward off a bell
  // must still scroll the page — calling setPointerCapture on pointerdown,
  // before any movement exists to judge, is what was blocking that native
  // scroll. Mouse is exempt: a mouse drag never scrolls the page by
  // itself, so it keeps capturing (and sweeping) immediately, as before.
  const SWEEP_INTENT_THRESHOLD_PX = 10;
  let pendingSweep: { pointerId: number; startX: number; startY: number } | null = null;

  function strike(button: HTMLButtonElement, x: number): void {
    const isFirstBell = button === firstBell;
    if (!rackVisible(revealState) && !isFirstBell) return;

    engine.strike(Number(button.dataset.bell), x);
    showStrikeFeedback(button, x);
    dispatch({ type: "strike" });
  }

  function bellAtPoint(clientX: number, clientY: number): HTMLButtonElement | null {
    const el = document.elementFromPoint(clientX, clientY);
    return el instanceof Element ? el.closest<HTMLButtonElement>("button[data-bell]") : null;
  }

  function xWithin(button: HTMLButtonElement, clientX: number): number {
    const rect = button.getBoundingClientRect();
    return (clientX - rect.left) / rect.width;
  }

  rack.addEventListener("pointerdown", (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("button[data-bell]")
        : null;
    if (!button) return;
    lastStruck = button;
    if (event.pointerType === "mouse") {
      rack.setPointerCapture(event.pointerId);
      dragActive = true;
      updateMalletPosition(event.clientX, event.clientY);
      swingMallet();
    } else {
      pendingSweep = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    }
    strike(button, xWithin(button, event.clientX));
  });

  // Sweep: while the pointer stays down, a bell strikes the moment the
  // pointer enters it. Pointer capture keeps these events coming to the
  // rack even though the cursor has moved over other elements. For a
  // touch/pen pointer still pending a sweep-intent decision, the pointer
  // is not yet captured — direction is judged first, below.
  rack.addEventListener("pointermove", (event) => {
    if (pendingSweep && event.pointerId === pendingSweep.pointerId) {
      const dx = event.clientX - pendingSweep.startX;
      const dy = event.clientY - pendingSweep.startY;
      if (Math.hypot(dx, dy) < SWEEP_INTENT_THRESHOLD_PX) return;
      const { pointerId } = pendingSweep;
      pendingSweep = null;
      if (Math.abs(dx) <= Math.abs(dy)) return; // vertical intent: let the page scroll natively
      rack.setPointerCapture(pointerId);
      dragActive = true;
    }
    if (!dragActive) return;
    const button = bellAtPoint(event.clientX, event.clientY);
    if (button && button !== lastStruck) {
      lastStruck = button;
      if (event.pointerType === "mouse") swingMallet();
      strike(button, xWithin(button, event.clientX));
    }
  });

  const endDrag = (): void => {
    dragActive = false;
    lastStruck = null;
    pendingSweep = null;
  };
  rack.addEventListener("pointerup", endDrag);
  rack.addEventListener("pointercancel", endDrag);

  for (const button of bellButtons) {
    // A native click from Enter/Space carries detail 0; a pointer-driven
    // click doesn't, and pointerdown above has already struck that one.
    button.addEventListener("click", (event) => {
      if (event.detail !== 0) return;
      strike(button, 0.5);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    const entry = keyMap.get(event.code);
    if (!entry) return;
    strike(entry.button, entry.x);
  });

  // The tune (B4): plays src/melody.ts's MOLIHUA_OPENING through the same
  // strike() above — same synthesis, same mallet feedback, same mark
  // highlight, nothing pre-rendered. Never starts itself; only this
  // button's own click starts it, and that click is also this page's
  // first-gesture AudioContext unlock whenever it happens to be the
  // player's first interaction (engine.strike() creates the context
  // lazily — see src/audio.ts — so no separate unlock code is needed
  // here). Interruptible by any pointerdown on the rack or any keydown,
  // per the brief.
  const playButton = document.querySelector<HTMLButtonElement>("#play-tune");
  if (playButton) {
    const idleLabel = playButton.dataset.labelIdle ?? playButton.textContent?.trim() ?? "";
    const playingLabel = playButton.dataset.labelPlaying ?? idleLabel;
    const strikes = melodyToStrikes(MOLIHUA_OPENING, bells);

    let timers: number[] = [];
    let playing = false;

    function stopPlayback(): void {
      for (const t of timers) window.clearTimeout(t);
      timers = [];
      if (playing) {
        playing = false;
        playButton.textContent = idleLabel;
      }
    }

    function startPlayback(): void {
      dispatch({ type: "strike" });
      playing = true;
      playButton.textContent = playingLabel;
      for (const s of strikes) {
        const target = bellButtons.find((b) => Number(b.dataset.bell) === s.bell);
        if (!target) continue;
        timers.push(window.setTimeout(() => strike(target, s.x), s.atMs));
      }
      const lastAtMs = strikes.at(-1)?.atMs ?? 0;
      timers.push(window.setTimeout(stopPlayback, lastAtMs + 50));
    }

    playButton.addEventListener("click", () => {
      if (playing) stopPlayback();
      else startPlayback();
    });

    rack.addEventListener("pointerdown", stopPlayback);
    document.addEventListener("keydown", (event) => {
      if (!event.repeat) stopPlayback();
    });
  }
}

// Diagnostic only (Part C): once, on load, note whether the page needed
// a scrollbar it shouldn't have. Nothing the player sees — console only.
window.addEventListener(
  "load",
  () => {
    const { scrollHeight, scrollWidth } = document.documentElement;
    const { innerHeight, innerWidth } = window;
    if (scrollHeight > innerHeight || scrollWidth > innerWidth) {
      console.log("page overflows viewport:", { scrollHeight, innerHeight, scrollWidth, innerWidth });
    }
  },
  { once: true },
);
