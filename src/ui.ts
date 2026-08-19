import { createEngine } from "./audio";
import { mix } from "./strike";
import { INITIAL_STATE, marksVisible, rackVisible, transition, type State } from "./reveal";

const rack = document.querySelector<HTMLElement>("#rack");

if (rack) {
  const engine = createEngine();
  const bellButtons = [...rack.querySelectorAll<HTMLButtonElement>("button[data-bell]")];
  const firstBell = bellButtons.find((b) => b.dataset.bell === "1") ?? null;

  const keyMap = new Map<string, { button: HTMLButtonElement; x: number }>();
  for (const button of bellButtons) {
    const zhengguCode = button.dataset.keyZhenggu;
    const ceguCode = button.dataset.keyCegu;
    if (zhengguCode) keyMap.set(zhengguCode, { button, x: 0.5 });
    if (ceguCode) keyMap.set(ceguCode, { button, x: 0 });
  }

  let revealState: State = INITIAL_STATE;
  let marksShownAt = 0;
  let timeoutHandle: number | undefined;

  function render(state: State): void {
    rack.classList.toggle("marks-shown", marksVisible(state));
    rack.classList.toggle("opened", rackVisible(state));
    if (rackVisible(state)) {
      for (const button of bellButtons) button.removeAttribute("inert");
    }
  }

  function dispatch(event: Parameters<typeof transition>[1]): void {
    const elapsed = revealState === "marksShown" ? performance.now() - marksShownAt : 0;
    const next = transition(revealState, event, elapsed);
    if (revealState !== next) {
      revealState = next;
      if (marksVisible(next)) {
        marksShownAt = performance.now();
        window.clearTimeout(timeoutHandle);
        timeoutHandle = window.setTimeout(() => dispatch({ type: "tick" }), 6000);
      } else {
        window.clearTimeout(timeoutHandle);
      }
      render(revealState);
    }
  }

  let dragActive = false;
  let lastStruck: HTMLButtonElement | null = null;

  function strike(button: HTMLButtonElement, x: number): void {
    const isFirstBell = button === firstBell;
    if (!rackVisible(revealState) && !isFirstBell) return;

    engine.strike(Number(button.dataset.bell), x);
    dispatch({ type: "strike", ceguGain: mix(x).cegu });
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
    rack.setPointerCapture(event.pointerId);
    dragActive = true;
    lastStruck = button;
    strike(button, xWithin(button, event.clientX));
  });

  // Sweep: while the pointer stays down, a bell strikes the moment the
  // pointer enters it. Pointer capture keeps these events coming to the
  // rack even though the cursor has moved over other elements.
  rack.addEventListener("pointermove", (event) => {
    if (!dragActive) return;
    const button = bellAtPoint(event.clientX, event.clientY);
    if (button && button !== lastStruck) {
      lastStruck = button;
      strike(button, xWithin(button, event.clientX));
    }
  });

  const endDrag = (): void => {
    dragActive = false;
    lastStruck = null;
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
}
