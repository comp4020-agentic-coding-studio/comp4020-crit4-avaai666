// Pure geometry for what sits on a bell's face: the three strike marks
// (zhenggu centre, two cegu corners). That is now everything — the lu
// label and the romanisation have moved off the bell face entirely, onto
// a caption strip in the frame below (index.html .bell-caption). Real
// bell inscriptions are small incised characters, not a caption laid
// over the object; every collision found this month traced back to
// putting text on the bell. src/ui.ts reads mark boxes from here rather
// than holding its own copy of any of these numbers.
//
// Mark size (MARK_FRAC) is the drawn diameter as a fraction of the
// bell's width, and nothing else: 0.16, no pixel floor. The 44px
// accessibility floor is a property of the *hit region* (bell width / 3,
// already guaranteed by src/scale.ts's 132px MIN_BELL_WIDTH: 132/3=44),
// not of the drawn circle. Conflating the two — sizing the drawn mark to
// 1/3 of the bell so it doubled as its own hit region — was last week's
// error: it pushed the mark so large it no longer fit below the boss
// line. See FACT-CHECK.md "Bell face layout" for the corrected numbers.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Every bell shares the SVG's own aspect ratio (viewBox 100x160).
const ASPECT = 1.6;

export const MARK_FRAC = 0.16;
const CENTRE_X_FRAC = 0.5;
const CENTRE_Y_FRAC = 0.7;
const CORNER_X_FRAC = 0.22;
const CORNER_Y_FRAC = 0.75;

// The gu (smooth lower body, below the boss block) starts at y=95 in the
// 100x160 viewBox — index.html's #bell-shape has the divider line at
// that y. All three marks belong below it and above the rim curve; see
// the "keeps every mark in the gu" test in spec/crit-4.test.ts.
export const GU_Y_FRAC = 95 / 160;

function markHeightFrac(): number {
  return MARK_FRAC / ASPECT;
}

function boxFromCentre(
  cxFrac: number,
  cyFrac: number,
  wFrac: number,
  hFrac: number,
  width: number,
  height: number,
): Box {
  const w = wFrac * width;
  const h = hFrac * height;
  return { x: cxFrac * width - w / 2, y: cyFrac * height - h / 2, w, h };
}

export function centreMarkBox(width: number, height: number): Box {
  return boxFromCentre(CENTRE_X_FRAC, CENTRE_Y_FRAC, MARK_FRAC, markHeightFrac(), width, height);
}

export function cornerMarkLeftBox(width: number, height: number): Box {
  return boxFromCentre(CORNER_X_FRAC, CORNER_Y_FRAC, MARK_FRAC, markHeightFrac(), width, height);
}

export function cornerMarkRightBox(width: number, height: number): Box {
  return boxFromCentre(1 - CORNER_X_FRAC, CORNER_Y_FRAC, MARK_FRAC, markHeightFrac(), width, height);
}

export function markBoxes(width: number, height: number): [Box, Box, Box] {
  return [centreMarkBox(width, height), cornerMarkLeftBox(width, height), cornerMarkRightBox(width, height)];
}

// Outline containment, derived analytically from the SVG path
// `M12 40 L88 40 L90 160 Q50 100 10 160 Z` in a 100x160 viewBox: two
// linear tapered sides and a quadratic-bezier bottom rim. Because the
// bezier's x-control-points (90, 50, 10) are in exact arithmetic
// progression, x(t) is exactly linear in t, so t — and so y — is directly
// computable from x with no root-finding.
function xLeftEdgeFrac(yFrac: number): number {
  const y = yFrac * 160;
  return (12 - (y - 40) / 60) / 100;
}

function xRightEdgeFrac(yFrac: number): number {
  const y = yFrac * 160;
  return (88 + (y - 40) / 60) / 100;
}

function bottomCurveYFrac(xFrac: number): number {
  const x = xFrac * 100;
  if (x < 10 || x > 90) return -Infinity;
  const t = (90 - x) / 80;
  return (160 - 120 * t * (1 - t)) / 160;
}

export function pointInsideOutline(xFrac: number, yFrac: number): boolean {
  if (yFrac < 40 / 160 || yFrac > 1) return false;
  if (xFrac < xLeftEdgeFrac(yFrac) || xFrac > xRightEdgeFrac(yFrac)) return false;
  const x100 = xFrac * 100;
  if (x100 >= 10 && x100 <= 90 && yFrac > bottomCurveYFrac(xFrac)) return false;
  return true;
}

export function boxInsideOutline(box: Box, width: number, height: number): boolean {
  const corners: [number, number][] = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ];
  return corners.every(([x, y]) => pointInsideOutline(x / width, y / height));
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// Tier order (bug fix, this revision): which visual row a bell paints in
// — bells 7-12 (upper tier, the six lü) on top, bells 1-6 (lower tier, the
// six lu) below, see FACT-CHECK.md "Rack tier order". Not an octave
// relationship: the upper tier is a distinct whole-tone scale, not the
// lower tier doubled. This used to be assigned in styles.css with
// `.bell-cell:nth-child(N)`, a positional selector: it silently re-bound
// to the wrong bell the moment an unrelated sibling (the mallet) was
// added inside .rack, because nth-child counts every sibling, not every
// bell. Computed here as a pure function instead, with no dependency on
// DOM position, and applied by src/ui.ts per bell. bellIndex is 1-based,
// matching data-bell.
export function tierOrder(bellIndex: number): number {
  return bellIndex <= 6 ? bellIndex + 6 : bellIndex - 6;
}
