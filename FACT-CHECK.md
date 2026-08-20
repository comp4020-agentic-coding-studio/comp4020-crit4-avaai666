# Fact check

Historical and acoustic claims about the bianzhong, per CLAUDE.md: source URL
and date checked, or labelled inferred/not sourced.

## Bell silhouette (index.html bell-shape symbol, styles.css .bell-outline etc.)

Source: Smithsonian National Museum of Asian Art, "Resound: Bells of Ancient
China" interactive, https://asia.si.edu/interactives/resound/bianzhong.html
— checked 2026-08-20. It shows photographs of five bells. The anatomy and
proportions below are read off those photographs by Ava, not inferred from
a general idea of the object, so this section is sourced. The exact
viewBox coordinates are still my translation of her stated ratios into
numbers — I did not measure the photographs myself — so treat the
coordinates as "matches the sourced ratio", not as an independent
measurement.

Anatomy, from the photographs:
  - Body: nearly rectangular, very slightly wider at the bottom. Current
    path (`M12 40 L88 40 L90 160 Q50 100 10 160 Z`) is 76 units wide at
    the top and 80 at the bottom — a flare of 80/76 ≈ 1.053, against the
    ~1.05 stated. Body height (40 to 160) is 120 units against a width of
    80, exactly the stated 1.5x.
  - Bottom rim (yu kou): a single quadratic Bézier from corner to corner,
    control point pulled up to y=100 against corners at y=160 — a 60-unit
    rise into a 120-unit-tall body, read as "deep". The two corners
    (xian) are the path's lowest points, as stated.
  - Top plate (wu): a flat 10-unit band (`.bell-wu`, x12–88, y40–50) in a
    different fill from the body, directly under the shank.
  - Shank (yong): a rectangular block, y0–40 — exactly a third of the
    120-unit body height, as stated. No animal-mask head, per instruction
    to keep it simple.
  - Upper body (y50–95) is split by a central vertical divider (zheng) at
    x=50, with a block of nine bosses (mei), 3 rows of 3, either side —
    18 total, replacing the previous 24-boss/four-panel layout, which was
    not what was described.
  - Lower body (gu, y95–160): left undecorated. The strike marks (`.mark`)
    and the bell-face text (`.bell-text`) are positioned inside this
    region.

The previous shape in this repo drew the lens-shaped cross-section
mentioned in DESIGN.md's "Tuning" section as if it were a front elevation,
which is a different view of the object, and flared far more sharply
(36 units to 80, a factor of 2.2) than the photographs show — see
CLAUDE.md, "You cannot see either", for how that was caught.

## Strike marks (styles.css .mark, .mark-centre, .mark-corner-left/right)

Source: the same Smithsonian interactive, checked 2026-08-20 (re-checked
2026-08-20 for this revision — same source, not re-fetched). On the
photographed bells the strike points are visibly marked on the smooth
lower body (gu) in a paler metal: one near the centre, one toward each
corner — three marks per bell, both corners marked. As of this revision
the interface shows all three (previously it showed two: one per
playable strike position, zhenggu and centre-only cegu, and only for a
few seconds before fading — undercounting the object and hiding the
target behind a timer for no reason tied to the object itself). Marks
are now permanent: visible on every revealed bell from the moment it's
shown, never faded or hidden. Cegu strikes are still mapped to a single
tone regardless of which physical edge is struck — an existing
simplification, unchanged this session; showing both corner marks is
about matching the object's appearance, not about exposing two different
playable positions.

CORRECTED as of this revision: for one week the mark diameter was forced
up to 1/3 of the bell's own width (src/layout.ts MARK_FRAC), on the
reasoning that the drawn mark also had to double as its own 44px hit
region at the smallest bell (132/3=44). That reasoning conflated two
different things — the drawn circle and the touch hit region are not the
same rectangle. The hit region is the button itself (one third of the
bell's width, unaffected by MARK_FRAC); the drawn mark is now back down
to 0.16 of the bell's width, close to the photographs' "roughly one
fifth" (0.20). See "Bell face layout" below for what forcing it to 1/3
had cost, and the numbers now that it's undone.

## Bell face layout (src/layout.ts)

Not a claim about the real bells — a computed record of what src/layout.ts
places where, done to catch what CLAUDE.md's "you cannot see" rule means I'd
otherwise miss. All numbers below are printed output of the actual module
(`npx tsx`, this revision), not estimates.

This revision corrects the error the previous entry recorded honestly:
sizing the drawn mark to 1/3 of the bell so it would double as its own
44px hit region pushed the mark up out of the gu and into six of the
eighteen boss circles (bell-nubs). The fix separates the two concerns —
MARK_FRAC (the drawn circle, now 0.16, no floor of its own) from the hit
region (the button, one third of the bell's width, already ≥44px from
src/scale.ts's 132px floor) — and re-derives CENTRE_Y_FRAC/CORNER_X_FRAC/
CORNER_Y_FRAC so all three marks sit inside the gu. Also, per this
session's instruction, the lu label and romanisation have moved off the
bell face entirely, onto a caption strip in the frame (index.html
.bell-caption) — so there is no longer a label box to check against the
wu/boss geometry at all; that whole failure mode is gone by construction,
not patched.

At width=100, height=160 (the viewBox's own units, so these read directly
against index.html's coordinates):

  - centre: x=42, y=104, w=16, h=16 — insideOutline: true, y ≥ 95 (gu): true
  - corner-left: x=14, y=112, w=16, h=16 — insideOutline: true, y ≥ 95: true
  - corner-right: x=70, y=112, w=16, h=16 — insideOutline: true, y ≥ 95: true
  - no pair of the three intersects (checked all three pairs)
  - none of the three overlaps any of the eighteen boss circles (bell-nubs
    at x=40/60, y=60/72/84, r=2.2 each) — all three marks' y ranges
    (104–120 and 112–128) start well below the lowest boss row (86.2)

Confirmed at four bell widths (132, 100, 189.55, 213 — the smallest,
a round number, bell 5, and the largest) via `npx tsx`, not by hand
arithmetic: the same containment and no-overlap results hold at every
size, as they must given the fixed 1.6 aspect ratio the fractions are
computed against.

## Colour and contrast (src/color.ts)

Not a claim about the real bells — a method record for the WCAG checks in
spec/crit-4.test.ts. Relative luminance uses the sRGB transfer function
per channel before applying the 0.2126/0.7152/0.0722 weights (no shortcut
formula), and contrast is (lighter + 0.05) / (darker + 0.05), per
https://www.w3.org/TR/WCAG21/#dfn-relative-luminance, checked 2026-08-20.

Every number below is printed output of src/color.ts (`npx tsx`, this
revision):

  - Strike marks (#e3c07a) against the bell gradient, evaluated at each
    mark's own top edge — its lightest, so worst-case, point under that
    mark. Centre mark (y-fraction 0.65): gradient colour
    rgb(98.70, 63.65, 30.30), contrast 5.321:1. Both corner marks
    (y-fraction 0.70, identical by symmetry): gradient colour
    rgb(92.60, 59.70, 28.40), contrast 5.705:1. All three moved this
    revision (CENTRE_Y_FRAC/CORNER_Y_FRAC changed to keep every mark in
    the gu — see "Bell face layout" above); all three still clear the
    3:1 floor, with more margin than the previous position (3.644:1) had.
  - Caption text (cream) against the frame gradient: checked against
    FRAME_GRADIENT_TOP (#8b6038) directly, the single lightest colour the
    frame gradient can ever show at any row — a conservative upper bound
    on brightness that covers every actual row position, not a specific
    y-fraction. Contrast 5.190:1. This bullet used to be "romanisation
    only" (the lu label was checked against the bell gradient instead,
    since it still lived on the bell face); now both the lu name and the
    romanisation are in the same frame caption strip, so both are covered
    by this one check.
  - Footer text (#4a4a4a) against the page background (#f4f1ea): 7.857:1.
  - Mark fill (#e3c07a) is not equal to the cream text colour (#fff8ea) —
    a direct string inequality, not a perceptual claim.

The method — test the point a piece of text or a mark actually sits on,
not the gradient's average — only works because index.html's SVG
gradient uses `gradientUnits="userSpaceOnUse"` with y1/y2 spanning the
full 100x160 symbol viewBox, the same space layout.ts's y-fractions are
computed in. See "Metal finish" below.

## Metal finish (D2)

Borrowed element, not a claim about the real bells' surface — see
Attribution below. Bell body: SVG `<linearGradient>` in index.html,
BELL_GRADIENT_TOP #b27337 to BELL_GRADIENT_BOTTOM #382411, lighter at the
shoulder and darker toward the rim. Frame: CSS `linear-gradient()` in
styles.css, FRAME_GRADIENT_TOP #8b6038 to FRAME_GRADIENT_BOTTOM #362516,
lighter at the top edge.

Judgment call, not specified by the brief: the bell got an SVG gradient
because the bell is already SVG; the frame got a CSS gradient because the
frame is a plain decorative div, not SVG, and wrapping it in SVG solely to
satisfy "SVG gradients only" would have been an abstraction the task
didn't ask for. Both are still gradients defined by explicit stops, no
images, no CDN.

The two gradients' stop colours were chosen only to clear the contrast
floors in the Colour and contrast section above — the exact hues beyond
that constraint are a guess, not a measurement or a source.

## Rack tier order (styles.css .bell order property)

Inferred, not sourced. Bells 6-10 (the octave above 1-5) are placed on the
visual top row and bells 1-5 on the bottom row, on the reasoning that on a
real bianzhong rack the large, low bells hang on the bottom tier and the
small high ones sit above. I have not checked this against a photograph of
the full Marquis Yi (Zenghouyi) rack — flagged for Ava to verify.

Addendum, 2026-08-20: this is now implemented with CSS `order` (bells 6-10
given order 1-5, bells 1-5 given order 6-10) rather than explicit
grid-column/grid-row placement, because the rack's column count is no
longer fixed at five — see "Bell size and rack sizing" below. `order`
changes visual paint order only; DOM order and tab order both stay 1..10.
The two-tier split holds whenever the row is wide enough for roughly five
or more bells; at narrower widths, where fewer bells fit per row, it
degrades to two stacked runs rather than two rows, and at one column
(see below) there is no row for it to apply to at all.

Addendum, 2026-08-20 (twelve-bell revision): the rack grew from ten bells
to twelve, and the two tiers changed meaning along with it. Bells 1-6 now
carry the six lu (yang, even powers of 3 in the fifth-chain) and bells
7-12 carry the six lü (yin, odd powers of 3) — see DESIGN.md's Tuning
section. `tierOrder` now gives bells 7-12 order 1-6 (top row) and bells
1-6 order 7-12 (bottom row). This is explicitly NOT an octave
relationship the way the old bells 6-10/1-5 split was — column i's
upper-tier zhenggu is not double column i's lower-tier zhenggu, it's a
different lü entirely. The placement reasoning above (large low bells on
the bottom tier, small high ones above) still applies in spirit — the six
lu tier's bells are graded larger overall than the six lü tier's, per
"Bell size and rack sizing" below — but I have still not checked either
split against a photograph of the full Marquis Yi rack.

Addendum, previous revision — investigated per that session's Part D3: a
screenshot of the revealed (post-strike) rack showed what read as a
doubled lu name near the top-left, not reproducible in the cold-open
state. I concluded, from the code alone, that this was bell 6
(huangzhong's upper octave — same Chinese characters and romanisation as
bell 1) landing visually adjacent to bell 1 via the `order` values then
in effect, and said so explicitly as an unconfirmed, code-only inference.

Correction, this revision: that explanation was wrong. Measured directly
in a live Chrome (not inferred from code): before this revision, `.rack`
had eleven children, not ten — `div.mallet` sat first, ahead of all ten
`.bell-cell`s. The stray element at the top-left of the screenshot was
the mallet itself, parked at the rack's origin (`--mallet-x`/`--mallet-y`
default to 0 until the pointer first moves), not a doubled caption. It
read as text-like because it happened to sit near bell 1's real caption.

That extra sibling also fully explains the `order`/`--bell-w` chaos this
revision fixes (see "Rack tier order" below): `:nth-child(N)` counts
every sibling, so the mallet's presence shifted which bell each
`:nth-child` rule actually matched. Fixed by moving the mallet out of
.rack entirely (now a sibling in .rack-frame) and by keying both `order`
and `--bell-w` off `data-bell`/a pure function instead of DOM position —
see src/layout.ts's `tierOrder` and styles.css's `.bell-cell[data-bell]`
rules. My original D3 conclusion was reasonable from the code available
at the time and was correctly labelled unconfirmed; it was simply wrong,
and I would not have caught it without a measurement from a live
browser — something I have no way to take myself.

## Bell size and rack sizing (src/scale.ts, styles.css --bell-w, .rack)

Inferred, not sourced — a design decision, not a claim about the real
bells' dimensions. Each bell's width is graded by its own zhenggu
frequency (src/scale.ts), largest at bell 1 (lowest pitch) down to
smallest at bell 12 (highest, as of the twelve-bell revision — bell 10
in the previous ten-bell version), on the general physical reasoning that
lower-pitched bells are larger — I have no source for the real Marquis
Yi bells' relative dimensions or weights, only for their existence and
appearance (see "Bell silhouette" above). The specific range, 132px to
213px (ratio 0.62), and the interpolation method (linear in frequency)
are both decided, not measured or sourced. Grading is by zhenggu
frequency across all twelve bells, sorted by pitch, not by array index —
bell-index order and pitch order no longer coincide once the six lu and
six lü tiers interleave (see "Rack tier order" above).

The rack's grid column floor (190px) and max-width (1150px) were chosen
by hand-computing the auto-fit column count so the previously-confirmed
five-bells-per-row split holds at a ~1270px viewport, at the cost of the
rack falling to a single column at ~390px rather than two — see the
session's report for the worked numbers. This is an engineering
trade-off, not a claim about the object, so it isn't otherwise logged
here as a "fact."

## Strike feedback (styles.css .bell--struck, bell-swing, bell-ripple)

Not a factual claim — an interaction convention (a swing and a ripple
on the struck bell, replaced by a colour flash under
prefers-reduced-motion), acknowledged in the same source design doc as
"borrowed" — see the Attribution section below. The specific numbers
(5°/-3° swing, 450ms/500ms/300ms durations, 70% max ripple size) are
guesses, not measurements, and are ear-and-eye values per CLAUDE.md —
not evaluated here.

## Attribution

Borrowed: bells graded in size by register, tiers arranged with the
large low bells low, visible strike feedback.

Not borrowed, and deliberately different: that project tunes in equal
temperament (261.63 Hz to 329.63 Hz for its two tones); this one uses
the exact sanfen sunyi ratio 81/64. That project splits the bell into a
left half and a right half; this one blends the two modes continuously
by strike position at constant power. That project labels bells with
Western note names; this one does not, because the tuning is not equal
temperament.

Source: https://hiyascott.github.io/scott-portfolio/research/instrument-simulator/bianzhong/design-doc.html
— checked 2026-08-20.

Addendum, this revision: also borrowed a mallet that follows the pointer
over the rack and swings into the bell struck. Its exact dimensions
(18x46px), swing angle (18°) and swing duration (220ms) are guesses, not
measurements taken from that project or anywhere else. It's hidden
entirely for touch and keyboard input (no PointerEvent with
pointerType "mouse" for either) and fully hidden under
prefers-reduced-motion — "suppressed" was read as full display:none,
the simplest reading of the instruction, not otherwise specified.

## Link-preview card (public/card.png)

Decorative and inferred, not sourced. Replaced the starter-template
placeholder image with a 1200x630 PNG built by a one-off script (not
committed — run through `node`, not part of the app), not a screenshot
or a rendering of the deployed page.

The image reuses the exact same bell-shape coordinates as index.html's
#bell-shape symbol (see "Bell silhouette" above), scaled by k=2.6, drawn
as flat fills with no stroke, no anti-aliasing, and no text — the meta
description tag carries the words, not the image. Colours are the same
five hex values already in styles.css (#f4f1ea background, #3b2a17
frame border/divider/nub, #6b4a2b frame fill, #8a6d3b bell outline,
#6b542e shank). Checked numerically, not visually: decoded the PNG back
into raw pixel data and confirmed pixel(2,2), pixel(160,95) and
pixel(600,130) exactly match the intended hex values, and that a
1200x630 grid sample contains exactly five distinct colours. Whether
the composition reads as three bells on a rack is not something I can
check.

STALE as of 2026-08-20: the bell-shape coordinates changed in this session
(see "Bell silhouette" above) and card.png was not regenerated, so the
claim above ("reuses the exact same bell-shape coordinates") is no longer
true of the file currently in public/. The card still shows the old,
over-flared silhouette. Not fixed here — out of scope for this pass.

## Rack frame (styles.css .rack-frame)

Decorative and inferred, not sourced. Meant to read as one stand the bells
hang from rather than twelve separate floating objects. No source checked
for frame proportions, colour, or construction.

## Six-lu / six-lü division (twelve-bell revision, DESIGN.md Tuning section)

The claim that the twelve lü split into "six lu" (六律) and "six lü" (六呂)
by yang/yin, and that this is standard terminology for the fifth-chain's
even- and odd-numbered generations, is asserted in DESIGN.md but has no
source URL checked here. Flagged for Ava to supply a source; not stated
as historical fact from memory, per CLAUDE.md.

Addendum, 2026-08-20 (about.html sourcing pass): fetched directly (not
just WebSearch-summarised) Jonathan Service, "Chinese Music Theory",
https://soundingchina.fas.harvard.edu/Service.html — checked 2026-08-20.
This source confirms two things, and does not confirm a third:

  - CONFIRMED: the sanfen sunyi construction method itself — "This method
    involved alternately rising a fifth and descending a fourth through
    the subtraction or addition of a third of the length" of the
    preceding pitch pipe.
  - CONFIRMED, but not in the same words: the twelve pitches split into
    two sets of six correlated with yin and yang — this source calls them
    "the six pitches of 'inferior generation'" (correlated with Yin) and
    "the six pitches of 'superior generation'" (correlated with Yang), and
    separately gives "lülü 律呂" as a compound name for the system as a
    whole (from a legend of male and female phoenix calls).
  - NOT CONFIRMED: that "six lu" (六律) and "six lü" (六呂) — two different
    characters, both romanised close to "lü/lu" — is the specific standard
    English gloss for this split. This source uses different English
    terms ("superior"/"inferior generation") for the yin/yang pair, and
    only uses "律呂" together, as one word for the whole twelve-tone
    system, not as two half-names. Also checked directly this session:
    Wikipedia's dedicated "Shi'er lü" article
    (https://en.wikipedia.org/wiki/Shi'er_l%C3%BC, checked 2026-08-20)
    does not mention sanfen sunyi by name, and does not describe any
    six/six split at all — it lists all twelve names as one set.

Net effect on about.html: the yin/yang six-and-six split and the
sanfen-sunyi construction method are now sourced enough to state in
general terms (a fifth-chain of twelve pitches, generated by alternately
adding and subtracting a third of a pipe's length, traditionally grouped
into two sets of six by yin and yang). The specific romanised label pair
"six lu" / "six lü" used internally in DESIGN.md and this codebase is
still not independently confirmed as standard terminology, so about.html
does not use that specific pair of English words — it describes the split
without naming it "six lu, six lü."

The property actually used to build the bell table — that huangzhong,
taicu, guxian, ruibin, yize and wuyi are 3^0, 3^2, 3^4, 3^6, 3^8, 3^10
(even exponents), and dalü, jiazhong, zhonglü, linzhong, nanlü, yingzhong
are 3^1, 3^3, 3^5, 3^7, 3^9, 3^11 (odd exponents), each reduced into one
octave — is arithmetic, verified directly against the twelve exact
fractions in DESIGN.md's twelve-lü table (spec/crit-4.test.ts's Check 5),
not read from a source. This is self-verified arithmetic, not a sourced
fact, and the two are not the same claim: the naming convention (six-lu
vs six-lü) could turn out to be wrong or non-standard even though the
underlying exponent parity is correct by construction.

## Vertical centring and scroll reachability

Referenced from styles.css's `main` and `.rack-frame` comments but never
actually written up here until now — a gap, not a missing fact: filling
it in for the cross-reference to resolve.

A previous session's finding: `main { align-items: center; }` centred
`.rack-frame` on `main`'s cross axis. When the frame's content was taller
than `main`'s own box, the overflow split evenly above and below the
frame's box — but only the portion below the document's flow origin is
ever reachable by scrolling; the portion pushed above it is not, by how
scrolling works generally (there is no negative scroll position). Fixed
by removing `align-items: center` from `main` (default is `stretch`) and
adding `margin: auto 0` to `.rack-frame` instead: auto margins split
leftover space evenly when there is any (same visual centring when the
frame fits), but per the flexbox spec cannot go negative, so they collapse
to 0 when the frame is taller than `main` — the frame sits flush against
`main`'s top edge instead, and all the overflow flows downward, inside the
scrollable range. Confirmed still in place, and still doing this
correctly, this session (see "Touch-action blocked scroll on the
coarse-pointer branch" below) — the regression reported this session had
a different cause.

## Touch-action blocked scroll on the coarse-pointer branch

Not a historical or acoustic claim — a measured behaviour finding, recorded
here because it drove a fix to styles.css. Reported this session: at a
phone viewport the page would not scroll far enough to reach the last row,
again, after the twelve-bell revision took the coarse-pointer rack from
five rows (ten bells) to six.

Measured directly (Playwright + Chromium, iPhone 12/SE, Pixel 5, Galaxy
S9+ emulation, this session, 2026-08-20), not inferred: `lastRowReachable`
did NOT fire a warning at any of the four profiles tested, and a
programmatic `window.scrollTo(0, 999999)` reached the full bottom of the
content in every case (e.g. iPhone 12: `scrollHeight` 1931,
`lastElementBottomAbs` 1817.125, `bottomPaddingPx` 24 — reachable with 90px
to spare). The align-items/margin:auto fix from the previous session (see
"Vertical centring" reasoning in styles.css's `main` rule) is still in
place and still correct: the document's scroll range genuinely does cover
the whole rack. That ruled out the centring bug recurring.

The actual cause, found by simulating a real touch gesture instead of a
programmatic scroll (Chrome DevTools Protocol `Input.dispatchTouchEvent`,
a vertical swipe, not `window.scrollTo`): `.rack` had `touch-action: none`.
A swipe starting anywhere over the rack's bounding box — at a 390px-wide
viewport, the rack plus its frame padding spans roughly 280px of the
390px width, leaving only ~55px margins on each side — produced zero
scroll (`scrollY` stayed at 0 across a full swipe). The identical swipe
starting in the ~55px margin outside the rack scrolled normally. This is
a browser gesture-recognition property, not a layout/geometry one:
`lastRowReachable`'s scrollHeight arithmetic has no way to see it, by
construction (it takes three numbers, none of them a CSS property value),
so the check correctly did not fire — it was never wired to catch this
class of bug. That is the "second bug in the check" itself: its scope,
not its arithmetic.

Why this tracks with the row-count change without being caused by it:
`touch-action: none` blocked the gesture at any row count. At five rows
(ten bells) the rack's content, per this session's hand computation from
the coarse-layout constants (132px bell width, 1.6 aspect ratio → 211.2px
bell height, 52px caption strip, 32px row gap), is roughly 1444px tall
before frame/body chrome — evidently short enough, on the phone heights
tested, that no scroll was ever needed, so the dead gesture zone was never
exercised. At six rows the same arithmetic gives roughly 1739px, taller
than the tested viewports, so scrolling became necessary and the dead
zone became visible. The bug was latent at five rows, not absent.

Fixed by changing `.rack`'s `touch-action` from `none` to `pan-y`:
verified (src/ui.ts) that no touch-pointer logic depends on suppressing
native gestures — the mallet's drag-tracking explicitly ignores
`pointerType !== "mouse"`, and strikes fire on `pointerdown` alone, before
any gesture recognition would matter. Re-ran both the touch-swipe
simulation (now scrolls, e.g. 0 → 612 → 1217px across two swipes) and a
single-tap strike simulation (rack still opens on one touch tap) after
the change.

## Scroll reachability check measured the wrong page, and the wrong element

Not a historical or acoustic claim — a measured behaviour finding about
`checkLastRowReachable` (src/ui.ts) itself, recorded because it drove a
fix to both src/ui.ts and styles.css. Reported this session, a third time:
the page still could not be scrolled to the last row at a phone viewport,
with no console warning.

Checked directly against the built bundle first (`grep` on
`dist/assets/index-*.js`, 2026-08-20): the `lastRowReachable` wiring is
present in the built output, not just in source — that possibility is
ruled out.

Checked next with Playwright + Chromium (390×700, `hasTouch`, this
session): `document.querySelectorAll(".bell-caption")` returns all 12
elements even before the reveal, because `display: none` (the cold-open
state, styles.css `.bell-cell:not(.bell-cell--first)`) still leaves an
element in the DOM for `querySelectorAll` to find — it just collapses its
`getBoundingClientRect()` to a zero-size box at the cell's own position,
so it doesn't skew `Math.max(...)` upward. The real fault is `load` timing:
`checkLastRowReachable` runs once, on `window`'s `load` event, which fires
long before the reveal (`.rack.opened`, only added on the first strike —
a user gesture `load` cannot wait for). At that moment `scrollHeight` and
`innerHeight` were both 700 in the measured case: a correctly-laid-out
one-bell page, not the twelve-bell page the player goes on to reveal. No
other event re-ran the check after the reveal — only `resize` did, which
revealing bells does not fire. So the check could not have warned on a
genuinely unreachable revealed state, regardless of whether one existed:
it was never looking at that state at all.

A second, independent fault, found by extending the same probe past the
reveal: `.bell-caption`'s own bottom is no longer the lowest point on the
page. Measured (same session): `lastCaptionBottomAbs` 1817.125,
`footerBottomAbs` 1966.125 — the footer, which grew a play-tune button and
an about-link this session, sits 149px below the last caption. The check
never looked at the footer at all, so a footer-reachability failure would
pass silently even with the timing fixed.

Neither fault was live breakage in this measured case — a real touch swipe
(CDP `Input.dispatchTouchEvent`, six swipes, 375×667) did reach the bottom
(`scrollY` 1323, `scrollHeight` 1990, `innerHeight` 667 — the
already-fixed `touch-action` and the align-items/margin:auto fix both
still hold, as of before this session's further changes below). The bug
is in the check's ability to have ever told us either way, not in a
reproduced-live overflow this session.

Fixed two ways. First, src/ui.ts's `render()` now calls
`checkLastRowReachable` again (via `requestAnimationFrame`, so the
`.opened` class toggle's layout has flushed) whenever the rack becomes
visible, in addition to `load` and `resize`. Second, the check now
measures the bottom of `document.body`'s own direct children (header,
main, footer — whatever they are) instead of `.bell-caption` specifically,
so it can't silently stop covering the true lowest content again the next
time the footer, or anything else on the page, grows.

## Vertical centring, removed rather than patched a third time

Two rounds of patching the same bug class (`align-items: center` → `main`
"Vertical centring" above, then `touch-action` → `.rack` above) rather than
removing the mechanism outright. This session: all vertical centring is
removed from `html`, `body`, `main`, `.rack-frame` and `.rack` — no
`align-items: center`, `justify-content: center`, `place-content`, auto
block margins, or `transform: translateY` on any of them. `main`'s
`justify-content: center` and `.rack-frame`'s `margin: auto 0` (both
described above) are gone; `.rack-frame` now centres horizontally only,
via `margin-inline: auto`. Vertical position comes from ordinary block
flow — the rack sits directly after `header` in body's normal document
flow, and the page scrolls normally past it. `body`'s `min-height: 100vh`
is now `100dvh` (a phone's browser chrome can make `100vh` taller than
what's actually visible, per the `dvh` spec).

This is not a smaller-scoped fix than the previous two: it removes the
entire mechanism that both prior bugs were fixes *within*, not another
fix *of*. Block flow cannot overflow above its own origin the way a
centred flex item can — there is no leftover space for a centring rule to
distribute, at any row count or footer height, because nothing in this
layout ever centres on the vertical axis at all.

## about.html basic facts — material, mounting, playing, two-tone

Source: Wikipedia, "Bianzhong", https://en.wikipedia.org/wiki/Bianzhong —
fetched directly and quoted (not just WebSearch-summarised), checked
2026-08-20. Used for about.html's first two copy blocks, alongside the
already-cited Smithsonian interactive (see "Bell silhouette" above, same
checked date).

Direct quotes:
  - Material: "consisting of a set of bronze bells, played melodically."
  - Mounting: "They were hung in a wooden frame and struck with a mallet."
    The Marquis Yi set specifically was "mounted on intersecting racks
    set at 90 degrees to each other."
  - Playing: "Using a wooden hammer and a rod to beat the bronze bell can
    make different pitch."
  - Two-tone phenomenon: cross-section is "lens-shaped (rather than
    circular)," giving "the remarkable ability to produce two different
    musical tones. Striking the center of the bell produces the primary
    tone, while the left or right corners produce a secondary pitch
    either a major or minor third higher."

Also fetched directly, https://en.wikipedia.org/wiki/Bianzhong_of_Marquis_Yi_of_Zeng,
checked 2026-08-20: confirms 64 bells across the full excavated set, hung
on "two sets of wooden racks... perpendicular to each other," and that the
"wooden hammers used to strike the bells were also unearthed from the
Tomb of Marquis Yi of Zeng." Confirms "each bell can play two tones with
three degrees' interval between them," but does not itself say the two
tones come from striking centre versus corner — that detail is sourced
from the Bianzhong article above, not this one.

## Twelve lü — basic structure

Source: Wikipedia, "Shi'er lü", https://en.wikipedia.org/wiki/Shi'er_l%C3%BC
— fetched directly, checked 2026-08-20. Confirms: a named system of twelve
pitches, "the Chinese chromatic scale," built from "3:2 ratios (8:9,
16:27, 64:81, etc.)." Does not name the sanfen sunyi method and does not
describe a six/six split (see the addendum on the "Six-lu / six-lü
division" section above for where the method and the split are sourced
from instead, and what is and isn't confirmed about their naming).

## The tune — 茉莉花 (Jasmine Flower)

Source: Jianpu Space, https://jianpu.space/en/songList/28 — checked
2026-08-20. A numbered-notation (jianpu) transcription, not staff
notation, chosen deliberately over a staff-notation PDF I also found
(gmajormusictheory.org's "Chinese Folk Song: Jasmine Flower") because
reading digits out of structured page text carries far less
transcription risk than reading notehead positions off a rendered
image — I did not use the PDF as a source, only as an unused
cross-check candidate.

The notation was NOT read by eye off a screenshot. I fetched the live
page with Playwright and read the literal SVG markup each note is drawn
from (`<title>` attributes on each line's SVG, e.g.
`33_5_6_1'_1'_6_| 好 一 朵 美 _ 麗 的`), not `innerText` — an
`innerText`-only read of the same page silently drops the octave-up
marks (see below), which would have produced a wrong transcription
without my noticing.

Full song, degrees only, digit-for-digit off the page's own `<title>`
strings (apostrophe = one octave up, comma = one octave down, matching
standard jianpu convention):

    33_5_6_1'_1'_6_ | 55_6_5- | 5553_5_ | 665- |
    32_3_53_2_ | 11_2_1- | 3_2_1_3_2.3_ | 56_1'_5- |
    23_5_2_3_1_6,_ | 5,-6,1 | 2.3_1_2_1_6,_ | 5,-00

Every degree in the song is one of 1, 2, 3, 5, 6 — the gong-mode
pentatonic set, confirmed against the mapping below; degrees 4 and 7
never appear anywhere in the piece.

Octave marking, resolved: the two digits transcribed elsewhere (e.g. in
an earlier web search snippet, before I loaded the live page myself) as
`1'` are rendered on this page as a plain "1" glyph plus a separate
`<circle>` element positioned above it (`<text ...>1</text><circle
cx="90.5" cy="18" r="1.5">`, at y=18 against the digit's own text
baseline at y=34) — a drawn octave dot. No other digit in either of the
two SVGs for this phrase carries that circle. The page's own `<title>`
attribute for that line independently spells the same phrase out as
`33_5_6_1'_1'_6_`, confirming the circle is exactly the apostrophe/dot.
Both signals agree, so this is not a guess: those two notes are one
octave up.

Six-pitch mapping, verified note-by-note against src/tuning.ts's `bells`
(scanning every bell's zhenggu ratio first, bells 1 to 12, then every
bell's cegu ratio, and taking the first exact match — a fixed scan
order, not a per-note judgment call):

    degree 1 (gong)  ratio 1      → bell 1 zhenggu  (huangzhong)
    degree 2 (shang) ratio 9/8    → bell 2 zhenggu  (taicu)
    degree 3 (jue)   ratio 81/64  → bell 3 zhenggu  (guxian)
    degree 5 (zhi)   ratio 3/2    → bell 10 zhenggu (linzhong)
    degree 6 (yu)    ratio 27/16  → bell 11 zhenggu (nanlu)
    degree 1' (gong, +1 octave), ratio 2 → bell 11 cegu (nanlu's cegu)

This is exactly the mapping given for this task, produced by the scan
order rather than assumed — printed by running src/melody.ts's
`findStrike` against src/tuning.ts's `bells`, not hand-matched.

Notes in the source that are NOT in this set, reported rather than
rounded: from "送给别人家" onward the song uses degree 6 one octave
DOWN (comma-marked, ratio 27/32) and degree 5 one octave down (ratio
3/4) — both below 1, and every ratio in this rack's twelve-bell table is
≥ 1, so neither note has any matching bell, at any strike position, on
this rack. This rack cannot play the whole song.

Judgement call, disclosed: only the opening phrase — "好一朵美丽的茉莉花"
("what a lovely jasmine flower"), the eleven notes up to and including
the first "花" — is wired up for playback (src/melody.ts's
`MOLIHUA_OPENING`). Every degree in that phrase is one of the six the
rack can produce; nothing in it is rounded or transposed. This was my
choice, not a request — it's also the tune's most recognisable line.
Timing (450ms per note, flat) and gain (flat 1) for that phrase are
guesses, not sourced or measured; the source gives pitches only, no
tempo.

## Existing claims (carried over, unchanged this session)

The "Bianzhong damp faster than European church bells" claim in DESIGN.md's
Timbre section is already marked there as inferred, not sourced. Not
re-checked here.
