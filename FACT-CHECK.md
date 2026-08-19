# Fact check

Historical and acoustic claims about the bianzhong, per CLAUDE.md: source URL
and date checked, or labelled inferred/not sourced.

## Bell silhouette (index.html bell-shape symbol, styles.css .bell-outline etc.)

Inferred, not sourced. No source URL checked.

The front-elevation shape (shank/yong at top, body widening downward, concave
bottom rim, four panels of bosses/mei either side of two dividers) is drawn
from a general, unsourced idea of what a bianzhong bell looks like from the
front, not from a photograph, museum drawing, or cited description. The
previous shape in this repo drew the lens-shaped cross-section mentioned in
DESIGN.md's "Tuning" section as if it were a front elevation, which is a
different view of the object — see CLAUDE.md, "You cannot see either", for
how that was caught.

The exact proportions (trapezoid widening from 36 units wide at the shoulder
to 80 units at the base, bottom rim as a single quadratic Bézier control
point at (50, 76) giving a curve midpoint of (50, 84), 24 bosses in four
6-boss panels) are arbitrary numbers I set, not measurements of a real bell.

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

## Rack frame (styles.css .rack-frame)

Decorative and inferred, not sourced. Meant to read as one stand the bells
hang from rather than ten separate floating objects. No source checked for
frame proportions, colour, or construction.

## Existing claims (carried over, unchanged this session)

The "Bianzhong damp faster than European church bells" claim in DESIGN.md's
Timbre section is already marked there as inferred, not sourced. Not
re-checked here.
