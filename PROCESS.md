# Process overview

## What I built

A playable bianzhong: bronze chime bells in the browser, tuned to the
twelve lü, each bell struck at two points for two pitches. Web Audio
only, no samples, no libraries.

## The moments that mattered

### 1. Contract before implementation, red on purpose

I opened with four commits before any module existed: DESIGN.md, CLAUDE.md,
LISTENING.md, then spec/crit-4.test.ts written against modules that didn't
exist yet.

The obvious move is to build the instrument first and backfill tests.
Instead I told the agent not to stub a module just to turn a test green,
and to stop and tell me if anything passed.

I knew it was right because `pnpm test` failed with module-not-found
errors. Red was the acceptance criterion, not a problem to fix.

[`2c484f2`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-avaai666/commit/2c484f2)
[`dfbbccc`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-avaai666/commit/dfbbccc)
[`441ca50`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-avaai666/commit/441ca50)
[`a7b8c22`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-avaai666/commit/a7b8c22)

### 2. A rule built from a mistake it had no way to catch

CLAUDE.md already said the agent can't hear its own output. Then it drew
the bell body from DESIGN.md's phrase "lens-shaped cross-section" as a
front elevation — a shape pointed at both ends. A cross-section is not a
front view, and it had no browser to notice the difference.

Instead of only fixing the shape, I added a second rule, "You cannot see
either," with the actual mistake written in as evidence, not a
hypothetical.

I knew it landed because later revisions started listing what they
hadn't verified, unprompted, and dropped the visual adjectives.

[`fc5069b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-avaai666/commit/fc5069b)
[`694851f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-avaai666/commit/694851f)

### 3. Twelve names is not twelve entries

DESIGN.md said "the twelve lü as frequency ratios" and listed seven. The
spec's membership assertion checked every note against that table, so it
was testing membership in a set of seven, and it was green.

I didn't find this by reading code. I require the agent to report
anything it guessed at, and it answered that DESIGN.md only named seven,
so it had treated those seven as the whole set.

I completed the table with the exact ratios and rewrote the assertion:
exactly twelve entries, strictly increasing, each in [1,2), each
reducible to a power of 3 over a power of 2.

[`4cfbf4c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-avaai666/commit/4cfbf4c)

### 4. Refusing a tolerance that would hide the next bug

I'd also asserted the fifth-chain closes: rise a fifth twelve times, drop
back an octave, land on the start. It doesn't — it lands 23.46 cents
sharp, exactly 531441/524288.

The agent offered three fixes: test eleven instead of twelve, add ~24
cents of tolerance, or drop the assertion. I refused all three — a
24-cent tolerance would also pass a genuine 20-cent tuning error, which
isn't a fix, it's the same failure renamed.

I rewrote it as two exact assertions: eleven closures exactly, the
twelfth pinned to its precise fraction. Both are rational equality, zero
tolerance.

[`4cfbf4c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-avaai666/commit/4cfbf4c)

### 5. "Can't test that" as a boundary problem, not a fact

It reported that deferred AudioContext creation couldn't be tested — a
runtime property, invisible to jsdom.

I didn't accept the framing. I asked it to inject the constructor
instead — `createEngine(AudioContextCtor = globalThis.AudioContext)` —
and test that with a fake constructor that counts its own calls.

I knew it was right because the resulting assertion is exact: zero calls
at creation, exactly one after the first strike, still exactly one after
fifty strikes.

[`fd8ae3d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-avaai666/commit/fd8ae3d)
