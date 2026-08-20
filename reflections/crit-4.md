# Reflection — Crit 4

## What was the breakthrough that moved the work forward?

It wasn't a fix. It was writing "you cannot hear" and "you cannot see
either" into CLAUDE.md as rules, not as reminders to myself. Once they
were rules, the agent had to act on them every time, not just when I
happened to be watching. It started saying "I set X to this number" and
stopping there, instead of "this should sound right." That's a small
sentence-level change but it's the one that made the rest of the crit
possible — I stopped having to catch the same overclaim twice.

The second half of the breakthrough was requiring it to report what it
guessed at, unprompted, at the end of a prompt. That's how the seven-entry
lü table surfaced. I didn't go looking for it. It told me.

## What did this work change about who I want to be as a software developer?

I used to think a thorough test suite was the safety net. The fifth-chain
test taught me a test can be green and still be checking the wrong thing
— membership in a table that's missing five entries, a tolerance wide
enough to swallow the actual bug. Green isn't evidence by itself. I have
to read what the assertion is actually comparing, not just whether it
passed.

I also don't think "the agent can't test this" is a fact anymore. Both
times it said that this crit, the fix was to move the boundary — inject
the constructor, count the calls — not to accept the claim. I want to be
the kind of developer who treats "untestable" as a design decision I
haven't made yet, not a property of the code.
