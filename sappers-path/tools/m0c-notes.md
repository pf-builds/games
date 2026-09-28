# Sapper's Path: M0c notes (depth and density pass)

Builder notes for M0c. The numbers, bands, per-level table and ASCII examples are in `m0c-report.md`, whose narrative lives in `m0c-reading.md`. The M0 v2 record (`m0v2-*.md`) is left as it was, except that the bake log now goes to `m0c-report.md`.

## Run
```
export PATH="$HOME/.local/opt/node/bin:$PATH"
node tools/test.js                 # 106 checks (82 from M0 v2 + 24 M0c), exit 1 on failure
node tools/bake.js                 # about 7 s → levels/levels.json + pool-w{1..4}.json (atomic writes), bake log → m0c-report.md
node tools/m0c.js                  # 300 raw boards per world, about 3.5 s → tools/m0c-report.md (keeps the bake log)
node tools/m0c.js --snapshot       # re-measure and overwrite tools/m0c-before.json. Only on the OLD code: see below
```
`m0c-before.json` is the M0 v2 generator (commit ab0b68d) measured by this same tool with the same seeds. To rebuild it: copy `tools/gen.js`, `tools/par.js`, `tools/bake-config.json`, `src/engine.js` and `src/solver.js` from ab0b68d into a scratch folder with the current `tools/m0c.js`, add the one `info.towersRead` line after the colouring loop in the old gen.js, and run `--snapshot` there. Running `--snapshot` in the repo overwrites the before with the after.

## What changed, by file
- `tools/gen.js`, `castle()` rewritten around the same flow. New config blocks (all in `bake-config.json`, Worlds 3-4 unless noted):
  - `inner`: side / back / front bailey widths, thickness, the minimum ward size (`ward: [w, h]`, else reject `inner-room`), arcs, its own `towers` and `gate` (`sides`, `w`, `mats`).
  - `radial`: cross walls spanning the bailey from curtain to curtain. They never touch another bailey piece.
  - `gardens` (hedge-coloured blocks), `wardBuildings`, `outworks` (field blocks, placed before the palisade; the palisade then takes a row clear of them).
  - `barbican`: a U of walls against the curtain around the gate's front, with a passage inside. The passage counts as footprint so the moat wraps outside it (the first try let the moat into the passage and sealed the castle: `scenery` rejects).
  - `towers.own`: towers coloured after their ring's arcs and sharing one material per ring. Worlds 1-2 keep `own: false` (the M0 v2 order) because the reorder cost World 1-2 depth when tried; their `contrast` went 0.7 → 0.85.
  - New groups MID (inner curtain), WARD (ward pieces) and BARB (barbican); `RANK` gives the outside-in colouring order. The hard rule (different groups never share a material) now separates all eight layers.
  - `info` adds `towersRead`, `gardens`, `wardBuildings`, `radial`, `barbican`, `outworks`, `inner`, `innerGate`.
- `tools/bake-config.json`: Worlds 3-4 margins, curtains, towers, gate (no inner protrusion), keep (ring 1, yard 1, front 0), the new blocks above, moat p 1 in both, depth search W3 6-10 and W4 7-12; bands W2 4-7, W3 6-10 (cap 30), W4 7-12 (cap 34); `m0c.perWorld` 300.
- `tools/bake.js`: atomic writes (temp file, then rename) for levels.json and the pools, the M0c note in levels.json, bake log into `m0c-report.md`.
- `tools/m0c.js`: new. Before/after tables, bands, the per-level table with a fresh solve time per level, and the W3/W4 examples (the median baked level).
- `tools/test.js`: 24 new checks. Level count 36-40; names; teaching first then easiest first; min in band; section cap; no tie on any call of any shipped line; levers matter on every World 4 board; every required chest is required (no win or more calls without it); every level solves uncapped under 250 ms; no one-block crew section; World 3-4 coverage ≥ 40%; wall layers camp to keep (the solver's lower bound) ≥ 4 in World 3 and ≥ 3 in World 4; the generator is deterministic, never throws, and Worlds 3-4 castles all have an inner curtain.
- `levels/*`: rebaked, 38 levels (9/9/10/10), pools 51/42/60/37. `names.json`: w3-07 is now Twin Frost Walls and w4-07 The Inner Bailey; every level has a name.
- `levels.json` format is unchanged (still version 3, `draft: true`); the M1 builder's reader needs nothing new.

## Waived, cut, flagged
- **Cut: World 1-2 density** (cut-order item 2). Their generator shape is unchanged (coverage 45% / 49%). World 2's band widened to 4-7 calls.
- **Tower variety** turned out to be mostly done already: 97-98% of World 2-4 towers were already a different material from every touching wall. World 1 sits at 65% because it has two materials.
- **Ties rose** with the more symmetric concentric plans (27% / 38% of raw World 3/4 boards tie on a solution call). The bands reject them; no shipped line has one. A cheap fix later: jitter the inner ring off centre by a block.
- **Palisade is rarer** (about a quarter of World 3-4 boards) because the barbican, moat and outworks take the front rows first. The depth doesn't need it any more.
- **World 4 `inner-room` rejects** (about 1 in 5 pictures) when a thick curtain and wide margins leave no ward for the keep and lever house. Harmless, costs generation time only.
- No engine bugs found. `src/*` untouched. The browser was not used (tools only; M1 owns the UI).

## LATER (ideas outside this brief)
- A curved or polygonal inner ring, and inner rings off centre, so the plans read less like a diagram and tie less.
- A lever-opened iron inner gate in World 4 (a second lever, the old cascade idea) as an alternative route through the inner curtain.
- World 1-2 density: a barbican and outworks in World 2, gardens in World 2's courtyard.
