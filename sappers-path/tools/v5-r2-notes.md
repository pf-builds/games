# Sapper's Path v5 R2: notes (the re-lay of levels 1-100 and the 60 pictures, 2026-10-04)

Source of every decision: `game-research/sappers-path-v4/rules-review.md` ("Confirmed", "The feature ladder", "Tags mean
how many features a level uses", "Reuse map", "Build order") and `tools/v5-r1-notes.md` §5. Checklist and commits:
`tools/v5-progress.md` (R2 section). Per-level table: `tools/v5-r2-relay.md`. Screens: `tools/shots-v5-r2/` (gitignored).

## 0. The harness before any change

`tools/harness.mjs` on R1's head (101a097): **all passed, 3:24 wall** (106 s user), every viewport and the hidden tab, 0
console messages. No timeout and no hang. The orchestrator's late-night timeouts were not reproduced on an idle machine;
the likeliest cause is load (a harness started while a bake or another session's harness held the CPUs: the screenshot
waits and the 20-minute wall budget are wall-clock). Nothing in the code needed a change for it.

## 1. The slot map (tools/relay.js; bake-config `relay`)

DECISIONS_PLACEHOLDER
