import { createEngine } from "./audio";

// How long the two strike marks stay fully visible before fading, and how
// long the fade itself takes. Guesses — see LISTENING.md.
const MARK_VISIBLE_MS = 200;
const MARK_FADE_MS = 3000;

const rack = document.querySelector<HTMLElement>("#rack");

if (rack) {
  const engine = createEngine();
  const bellButtons = [...rack.querySelectorAll<HTMLButtonElement>("button[data-bell]")];

  const keyMap = new Map<string, { button: HTMLButtonElement; x: number }>();
  for (const button of bellButtons) {
    const zhengguCode = button.dataset.keyZhenggu;
    const ceguCode = button.dataset.keyCegu;
    if (zhengguCode) keyMap.set(zhengguCode, { button, x: 0.5 });
    if (ceguCode) keyMap.set(ceguCode, { button, x: 0 });
  }

  let opened = false;
  let dragging = false;
  let lastStruck: HTMLButtonElement | null = null;

  function revealMarks(button: HTMLButtonElement): void {
    button.classList.add("show-marks");
    window.setTimeout(() => button.classList.add("marks-fading"), MARK_VISIBLE_MS);
    window.setTimeout(() => {
      button.classList.remove("show-marks", "marks-fading");
    }, MARK_VISIBLE_MS + MARK_FADE_MS);
  }

  function strike(button: HTMLButtonElement, x: number): void {
    const isFirstBell = button.dataset.bell === "1";
    if (!opened && !isFirstBell) return;

    engine.strike(Number(button.dataset.bell), x);

    if (!opened) {
      opened = true;
      rack.classList.add("opened");
      revealMarks(button);
    }
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
    dragging = true;
    lastStruck = button;
    strike(button, xWithin(button, event.clientX));
  });

  // Sweep: while the pointer stays down, a bell strikes the moment the
  // pointer enters it. Pointer capture keeps these events coming to the
  // rack even though the cursor has moved over other elements.
  rack.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const button = bellAtPoint(event.clientX, event.clientY);
    if (button && button !== lastStruck) {
      lastStruck = button;
      strike(button, xWithin(button, event.clientX));
    }
  });

  const endDrag = (): void => {
    dragging = false;
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
