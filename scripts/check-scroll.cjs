// This replaced src/layout.ts's lastRowReachable + src/ui.ts's
// checkLastRowReachable (an in-page console.warn heuristic, deleted this
// session): across a week that heuristic produced five warnings and zero
// real defects, sending four rounds of CSS changes after a bug that did
// not exist — it compared a rounded scrollHeight against an unrounded
// element bottom plus a padding term nobody asked for. This script
// measures a real rendered page with real gestures instead, which is the
// only thing that ever actually answered "can the last row be reached".
//
// Diagnostic only. Not wired into pnpm check, check:evidence, or CI — run
// by hand. Needs playwright resolvable but NOT added to this project's
// package.json/pnpm-lock.yaml: point NODE_PATH at a `pnpm dlx --package
// playwright` cache instead, e.g. (this session's exact invocation):
//
//   PW_DIR=$(realpath ~/.cache/pnpm/dlx/<hash-of-the-playwright-dlx-cache>/pkg/node_modules)
//   NODE_PATH="$PW_DIR" node scripts/check-scroll.cjs
//
// Find <hash> by grepping ~/.cache/pnpm/dlx/*/pkg/package.json for
// `"playwright"` if a fresh dlx run is needed first.
//
// Requires `pnpm build` to have produced dist/; this script runs that for
// you, then serves dist/ with `vite preview` and measures the rack's real
// scroll geometry on a 390x844 mobile viewport (isMobile, hasTouch,
// deviceScaleFactor 3 — a real phone, not a resized desktop window).
//
// IMPORTANT lesson from this session: do NOT take a `fullPage: true`
// screenshot before you've finished measuring. Playwright implements
// fullPage by temporarily resizing the actual viewport to the full
// content height, and on this page that resize itself changed the
// layout (documentElement.scrollHeight measured 1991px normally, 4022px
// immediately after a fullPage screenshot, before any scroll happened).
// Screenshots run last, after every number below is already captured.

const { chromium } = require("playwright");
const { spawnSync, spawn } = require("node:child_process");
const net = require("node:net");

console.log("--- pnpm build ---");
const build = spawnSync("pnpm", ["build"], { stdio: "inherit" });
if (build.status !== 0) {
  console.error("pnpm build failed");
  process.exit(1);
}

console.log("--- starting vite preview ---");
const preview = spawn("pnpm", ["exec", "vite", "preview", "--port", "4173", "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
preview.stdout.on("data", (d) => process.stdout.write(`[preview] ${d}`));
preview.stderr.on("data", (d) => process.stderr.write(`[preview] ${d}`));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function attempt() {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`port ${port} never opened`));
        } else {
          setTimeout(attempt, 200);
        }
      });
    }
    attempt();
  });
}

async function main() {
  await waitForPort(4173, 20000);
  await sleep(300);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    console.log(`[browser console:${msg.type()}]`, msg.text());
  });

  await page.goto("http://localhost:4173/");

  const firstBell = page.locator('.bell-cell[data-bell="1"] button, .bell-cell[data-bell="1"] .bell').first();
  await firstBell.click();

  await page.waitForFunction(() => {
    const cells = document.querySelectorAll(".bell-cell");
    if (cells.length < 12) return false;
    return Array.from(cells).every((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  });

  // Fire a resize event so layout has settled the same way a real phone
  // rotation or viewport-chrome resize would trigger it.
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await sleep(50);

  const before = await page.evaluate(() => {
    function computedOf(selector) {
      const el = document.querySelector(selector);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        height: cs.height,
        minHeight: cs.minHeight,
        maxHeight: cs.maxHeight,
        overflow: cs.overflow,
        position: cs.position,
        display: cs.display,
      };
    }

    // Literal answer to "the absolute bottom of the lowest element with a
    // non-zero box": html itself always ties this, since its own box is
    // exactly the document's content box. Reported for completeness.
    let lowestAny = null;
    document.querySelectorAll("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        if (!lowestAny || r.bottom > lowestAny.bottom) {
          lowestAny = { bottom: r.bottom, tag: el.tagName, className: el.className };
        }
      }
    });

    // The absolute bottom of body's direct children (header/main/footer),
    // not any specific bell — a landmark can grow (a footer gaining a
    // play-tune button and an about-link) without silently falling
    // outside what gets measured.
    const bodyChildren = [...document.body.children]
      .filter((el) => el instanceof HTMLElement)
      .map((el) => ({
        tag: el.tagName,
        className: el.className,
        bottomAbs: el.getBoundingClientRect().bottom + window.scrollY,
      }));
    const lastBodyChild = bodyChildren.reduce(
      (max, c) => (!max || c.bottomAbs > max.bottomAbs ? c : max),
      null,
    );

    // Which bell is actually LAST in visual order (CSS `order`, set by
    // src/layout.ts's tierOrder — not data-bell="12"; tierOrder maps
    // bells 1-6 to order 7-12 and bells 7-12 to order 1-6, so the
    // highest-order, visually-last cell is bell 6, not bell 12).
    const bellCells = [...document.querySelectorAll(".bell-cell[data-bell]")].map((el) => ({
      dataBell: el.getAttribute("data-bell"),
      order: parseInt(getComputedStyle(el).order, 10) || 0,
    }));
    const visuallyLastBell = bellCells.reduce(
      (max, c) => (!max || c.order > max.order ? c : max),
      null,
    );

    const rack = document.querySelector(".rack");
    const rackCs = rack ? getComputedStyle(rack) : null;
    const rows = rackCs ? rackCs.gridTemplateRows.split(" ").filter((s) => s.length > 0) : [];

    return {
      innerHeight: window.innerHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      bodyScrollHeight: document.body.scrollHeight,
      documentClientHeight: document.documentElement.clientHeight,
      lowestAnyElementBottom: lowestAny ? lowestAny.bottom : null,
      lowestAnyElementTag: lowestAny ? lowestAny.tag : null,
      lowestAnyElementClass: lowestAny ? lowestAny.className : null,
      bodyChildren,
      lastBodyChild,
      visuallyLastBell,
      computed: {
        html: computedOf("html"),
        body: computedOf("body"),
        main: computedOf("main"),
        rackFrame: computedOf(".rack-frame"),
        rack: computedOf(".rack"),
      },
      rackGridTemplateRows: rackCs ? rackCs.gridTemplateRows : null,
      rackGridTemplateRowsCount: rows.length,
    };
  });

  console.log("--- BEFORE SCROLL ---");
  console.log(JSON.stringify(before, null, 2));

  // Measure and scroll BEFORE taking any screenshot — see the header
  // comment: a fullPage screenshot changes the page's own layout on this
  // site, so it must never run before the real measurements.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(150);

  const after = await page.evaluate(() => {
    const visuallyLastBellEl = [...document.querySelectorAll(".bell-cell[data-bell]")].reduce(
      (max, el) => {
        const order = parseInt(getComputedStyle(el).order, 10) || 0;
        return !max || order > max.order ? { el, order } : max;
      },
      null,
    )?.el;
    const r = visuallyLastBellEl ? visuallyLastBellEl.getBoundingClientRect() : null;
    const inViewport = r ? r.top >= 0 && r.bottom <= window.innerHeight : false;

    const bodyChildren = [...document.body.children]
      .filter((el) => el instanceof HTMLElement)
      .map((el) => ({
        tag: el.tagName,
        className: el.className,
        bottomAbs: el.getBoundingClientRect().bottom + window.scrollY,
      }));

    return {
      scrollY: window.scrollY,
      documentScrollHeightAtScrollTime: document.documentElement.scrollHeight,
      visuallyLastBellDataBell: visuallyLastBellEl ? visuallyLastBellEl.getAttribute("data-bell") : null,
      visuallyLastBellRect: r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null,
      visuallyLastBellInViewport: inViewport,
      bodyChildrenAfterScroll: bodyChildren,
      innerHeight: window.innerHeight,
    };
  });

  console.log("--- AFTER SCROLL TO END ---");
  console.log(JSON.stringify(after, null, 2));

  // Screenshots last, after the real measurements are already captured, so
  // fullPage's viewport resize can't feed back into the numbers above.
  await page.screenshot({ path: "scroll-check-scrolled.png" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "scroll-check-full.png", fullPage: true });

  // --------------------------------------------------------------------
  // Part A: reproduce with a REAL gesture, not window.scrollTo.
  //
  // window.scrollTo (above) proved the page's own scroll range reaches
  // the last row. It says nothing about whether a real touch drag ever
  // gets to use that range: window.scrollTo bypasses gesture recognition
  // entirely, and Playwright's own page.mouse never dispatches
  // pointerType "touch" at all. Only a real touch input, run through
  // Chromium's actual touch/gesture pipeline, can show whether
  // touch-action: pan-y and this page's own pointerdown/pointermove
  // handlers (src/ui.ts) let the browser take the vertical pan. That
  // pipeline is only reachable over CDP's Input.dispatchTouchEvent —
  // page.touchscreen only exposes tap(), no drag — so a raw CDP session
  // drives touchStart/touchMove/touchEnd by hand below.
  //
  // Each of A1/A2/A3 gets its OWN fresh page (goto + reveal), not a
  // shared one reset with scrollTo(0, 0) between tests: a fast touch
  // flick leaves momentum/fling scrolling running in Chromium well past
  // touchend, and scrollTo(0, 0) does not cancel it. A first attempt at
  // this sharing one page found scrollY still drifting at the "before"
  // reading of the next test (e.g. 39, 95 instead of 0) and a bell-drag
  // that struck no bell at all — the touch had landed on whatever the
  // still-scrolling page happened to put under those coordinates, not
  // the bell measured a moment earlier. A fresh page per test has no
  // fling to inherit.
  const cdp = await context.newCDPSession(page);

  async function touchDrag(startX, startY, dx, dy, steps) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: startX, y: startY }],
    });
    for (let i = 1; i <= steps; i++) {
      const x = startX + (dx * i) / steps;
      const y = startY + (dy * i) / steps;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y }],
      });
      await sleep(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }

  // Count distinct bells struck during a gesture without any audio: every
  // strike() call in src/ui.ts adds the "bell--struck" class to the bell
  // it hit (showStrikeFeedback), even though the class is later removed
  // on animationend. A MutationObserver watching class changes on every
  // bell button, installed before the gesture and read after, counts
  // this without touching src/ui.ts itself.
  async function armStrikeObserver() {
    await page.evaluate(() => {
      window.__struckBells = new Set();
      const buttons = document.querySelectorAll("button[data-bell]");
      window.__struckObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.target.classList.contains("bell--struck")) {
            window.__struckBells.add(m.target.getAttribute("data-bell"));
          }
        }
      });
      for (const b of buttons) {
        window.__struckObserver.observe(b, { attributes: true, attributeFilter: ["class"] });
      }
    });
  }

  async function readStruckBells() {
    return page.evaluate(() => {
      window.__struckObserver.disconnect();
      return [...window.__struckBells];
    });
  }

  // The bell to drag from must actually be on screen at scrollY 0. Bell
  // data-bell="1" is NOT: tierOrder (src/layout.ts) paints the six lü
  // (bells 7-12) first and the six lu (bells 1-6, including bell 1) only
  // after them, so at a single-column phone width bell 1 sits around
  // y=962 in a page whose viewport is 844px tall — a touch dispatched
  // there lands below the visible viewport entirely, on nothing. Found by
  // first instrumenting src/ui.ts's pointerdown/pointermove listeners and
  // seeing zero events fire for a "drag starting on bell 1" (see the
  // debug run this session, /tmp/debug-a3.cjs). Picking the visually
  // topmost fully-on-screen bell instead guarantees a real bell under the
  // touch's start coordinates, whichever data-bell number that happens
  // to be.
  async function visibleBellCentre() {
    return page.evaluate(() => {
      const buttons = [...document.querySelectorAll("button[data-bell]")];
      let best = null;
      for (const el of buttons) {
        const r = el.getBoundingClientRect();
        if (r.top >= 0 && r.bottom <= window.innerHeight) {
          if (!best || r.top < best.rect.top) best = { rect: r, el };
        }
      }
      if (!best) return null;
      const r = best.rect;
      return {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        dataBell: best.el.getAttribute("data-bell"),
      };
    });
  }

  // A point inside .rack but not over any bell — the row-gap/column-gap
  // between cells, found from real rects rather than guessed, so it stays
  // valid regardless of exact bell sizing.
  async function backgroundPointInRack() {
    return page.evaluate(() => {
      const rack = document.querySelector(".rack");
      const rackRect = rack.getBoundingClientRect();
      const cellRects = [...document.querySelectorAll(".bell-cell")].map((el) =>
        el.getBoundingClientRect(),
      );
      function overAnyCell(x, y) {
        return cellRects.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
      }
      // Sweep a grid of candidate points across the rack's own box and
      // return the first one that lands on none of the cells.
      for (let fy = 0.02; fy < 1; fy += 0.02) {
        for (let fx = 0.02; fx < 1; fx += 0.02) {
          const x = rackRect.left + fx * rackRect.width;
          const y = rackRect.top + fy * rackRect.height;
          if (!overAnyCell(x, y)) return { x, y };
        }
      }
      return null;
    });
  }

  async function scrollY() {
    return page.evaluate(() => window.scrollY);
  }

  // Poll until scrollY stops changing (fling has decayed to a stop) or a
  // deadline passes, rather than a fixed sleep that might sample mid-fling.
  async function waitForScrollStable(maxWaitMs) {
    const deadline = Date.now() + maxWaitMs;
    let prev = await scrollY();
    while (Date.now() < deadline) {
      await sleep(60);
      const next = await scrollY();
      if (next === prev) return next;
      prev = next;
    }
    return prev;
  }

  // Fresh load + reveal for one isolated gesture test. Returns nothing;
  // the page is left ready (rack revealed, scrollY settled at 0) for the
  // caller to measure and act on.
  async function freshRevealedPage() {
    await page.goto("http://localhost:4173/");
    const bell = page.locator('.bell-cell[data-bell="1"] button, .bell-cell[data-bell="1"] .bell').first();
    await bell.click();
    await page.waitForFunction(() => {
      const cells = document.querySelectorAll(".bell-cell");
      if (cells.length < 12) return false;
      return Array.from(cells).every((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    });
    await waitForScrollStable(500);
  }

  console.log("--- PART A: real gesture reproduction (fresh page per test) ---");

  // A1: real vertical drag STARTING ON A BELL.
  await freshRevealedPage();
  const a1Before = await scrollY();
  const a1Bell = await visibleBellCentre();
  if (!a1Bell) throw new Error("A1: no bell is fully on screen at scrollY 0");
  await touchDrag(a1Bell.x, a1Bell.y, 0, -400, 10);
  const a1After = await waitForScrollStable(800);
  console.log("A1 (drag from a bell, vertical):", {
    before: a1Before,
    after: a1After,
    dataBell: a1Bell.dataBell,
  });

  // A2: same drag, starting on the frame background outside any bell.
  await freshRevealedPage();
  const a2Before = await scrollY();
  const bg = await backgroundPointInRack();
  if (!bg) throw new Error("A2: could not find a background point inside .rack");
  await touchDrag(bg.x, bg.y, 0, -400, 10);
  const a2After = await waitForScrollStable(800);
  console.log("A2 (drag from rack background, vertical):", { before: a2Before, after: a2After });

  // A3: horizontal drag starting on a bell — should sweep, not scroll.
  await freshRevealedPage();
  const a3Before = await scrollY();
  await armStrikeObserver();
  const a3Bell = await visibleBellCentre();
  if (!a3Bell) throw new Error("A3: no bell is fully on screen at scrollY 0");
  await touchDrag(a3Bell.x, a3Bell.y, 200, 0, 10);
  const a3After = await waitForScrollStable(800);
  const struck = await readStruckBells();
  console.log("A3 (drag from a bell, horizontal):", {
    before: a3Before,
    after: a3After,
    dataBell: a3Bell.dataBell,
    bellsStruck: struck,
    moreThanOneBellSounded: struck.length > 1,
  });

  await browser.close();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      process.kill(-preview.pid, "SIGTERM");
    } catch {
      preview.kill();
    }
  });
