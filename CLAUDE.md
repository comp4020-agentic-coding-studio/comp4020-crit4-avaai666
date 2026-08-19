# CLAUDE.md — COMP4020 C4: An instrument

## What this is
A playable bianzhong in the browser. Ten bells, two tones each. Web Audio
synthesis only, static site, GitHub Pages. See DESIGN.md — it is frozen.

## The one rule that matters
You cannot hear. You have no audio output and no way to evaluate timbre,
latency, balance or feel.

- Never write that something "sounds good", "sounds like a bell", "sounds
  better", or that the audio "works". You do not know.
- Report only what you can actually verify: numbers you produced, files you
  changed, and the real output of commands you ran.
- When a change touches synthesis, envelope, tuning, mix or timing, stop
  after making it and say: "This needs an ear. Run LISTENING.md."
- If I ask whether something sounds right, the correct answer is that you
  cannot tell, followed by what I should listen for.

## Never say done
"Done", "complete", "all working", "tests pass" without pasted output are
forbidden. Paste the real terminal output. If a command failed, paste the
failure.

## Hard constraints
- No audio files, samples or recordings. Every sound is synthesised live in
  the page from Web Audio primitives.
- No audio libraries. No Tone.js, no Howler, no wrappers. Raw Web Audio API.
- No external assets: no CDN, no web fonts, no network-fetched images.
- Do not create an AudioContext until the user's first gesture.
- Strikes fire on pointerdown, never on click.
- Do not modify anything in .github/. Do not weaken or skip any check.
- pnpm build must keep outputting to dist/.
- reflections/ must never be reachable from the deployed site.

## Things that must not exist
No score. No timer. No combo counter. No "correct" sequence. No fail state.
No tutorial modal. No "click to enable sound" overlay — the first bell IS
the start button. No instruction paragraph. No settings panel. No emoji.
If you find yourself adding a way for the player to be wrong, stop and ask.

## Architecture — pure logic, thin shell
- src/tuning.ts  ratios and the bell table. Pure data, pure functions.
- src/strike.ts  strike position to mode mix. Pure.
- src/voice.ts   frequency and bell to partial frequencies, gains, decays.
                 Pure. Returns numbers, not audio nodes.
- src/audio.ts   the only file allowed to touch Web Audio.
- src/ui.ts      the only file allowed to touch the DOM.
- spec/          tests import the pure modules only.

If a test needs jsdom to fake an AudioContext, the boundary is in the wrong
place. Move the logic into a pure module instead.

## Writing
Ava writes the words. Use her text verbatim.
- Do not merge her short sentences into paragraphs.
- Do not make her English more professional.
- Do not add explanatory prose she did not write.
- If a string is missing, ask. Do not draft one.

## Facts
Every historical or acoustic claim about the bianzhong goes in
FACT-CHECK.md with a source URL and the date checked. Anything inferred
rather than sourced is labelled "inferred, not sourced". Do not state a
fact about the Marquis Yi bells from memory.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so look at the deployed head when you add pages.

## The checks

`pnpm check` runs them (`pnpm check:evidence` is the extra gate before you
ship); CI runs the same plus links, secrets and the deploy. Read the failure.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## This file is yours

A starting point, not a rulebook. As you learn what your prototype needs --- a
convention the work has to hold to, a sensor that keeps catching you out (a
linter, say), a fact about the stack that is easy to get wrong --- write it down
here and wire it into `check`. Growing this file is the work.
