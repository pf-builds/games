# Sapper's Path: M0 v2 notes

Builder notes for M0 v2 (rules engine, solver, high-res castle generator, comparison report, draft bake). The numbers, bands and examples are in `m0v2-report.md`. Its narrative lives in `m0v2-reading.md`, which `report.js` splices in. The v1 record (`m0*-report.md`, `m0*-notes.md`, `m0*-reading.md`) is left as it was, and v1's code lives on at tag `sappers-path-v1-playtest`.

## Run
```
export PATH="$HOME/.local/opt/node/bin:$PATH"
node tools/test.js                 # 82 checks, exit 1 on failure (needs levels/levels.json)
node tools/report.js               # 1,200 castle pictures × 3 variants, about 5 s → tools/m0v2-report.md (keeps the bake block)
node tools/bake.js                 # Rule A, about 5 s → levels/levels.json (draft: true) + levels/pool-w{1..4}.json
node tools/bake.js --rule B        # the same bake under Rule B (fills from logged near misses; B fails most bands)
node tools/bake.js --stacks        # Rule A + stacks (bake-config stacks.k columns)
```
The default rule for `bake.js` and the report's example column is `bake-config.json` → `rule` ("A") and `stacksInBake` (false).

## What changed, by file
- `src/engine.js`: v2 rules, replaced in place, UMD and pure.
  - A move is a **call**: `call(B, st, crew)`, or a column index in stacks mode.
  - `targets(B, st)` gives one entry per legal call: `{move, crew, mat, section, all, contact:[x,y], ground:[x,y], dist, tie}`. That's the flag data.
  - `pathTo(B, st, x, y)` is the walk from the camp.
  - `stepInto()` is the allocation-free move for the solver.
  - Kept from v1: `parse`, `scratch`, `derive`, `start`, `restart`, `undo`, `fromMoves`, `legalMoves`, `sectionAt`, `sectionCells`, `crewOf`, `isCrewSection`, `serialize`, `musterObj` and `touches`. `derive` now takes `(B, broken, spent, D)`.
  - Removed: `apply` and `canBreak` (v1's tap-a-wall move). New: `canCall`.
  - State fields added: `breaks` (sections per call), `spent`, `dist`, `sdist`, `contact`, `ground`, `target`, `tie`, `front`, `calls` and `legalMask`. Stars count `calls`, not `used` (Rule B breaks several sections per call).
- `src/solver.js`: v2, replaced in place.
  - `solve(B, {cap, traps})` returns the min, the line (moves) and `lineSecs`, plus the counts, the chest fields, trap rate, decision points, `tieAny`, `tieMove` and `reshapes`.
  - `frontier(B, {maxLen, cap})` returns the Pareto-minimal winning crew mixes with unlimited crews.
  - Also `greedy`, `playouts` and `bound`. `quickest` and `traps` are gone: `frontier` replaces the first, and `solve` does the second's work.
- `tools/gen.js`: rewritten.
  - `castle()` draws the picture, `musterize()` finds the scarce muster per rule, and `deal()` deals the stacks.
  - `measure()` and `batch(C, wk, seed, n, variants)` measure the boards, and `accept(m, band)` is the filter.
- `tools/par.js`: passes `task.variants` through.
- `tools/report.js`: rewritten. It writes `m0v2-report.md`.
- `tools/bake.js`: rewritten for v2. It has the `--rule` and `--stacks` switches and writes `draft: true`.
- `tools/bake-config.json`: now v3. Per-world castle parameters, bands, stacks and bake chunks. The v1 config is at the tag.
- `tools/test.js`: rewritten, 82 checks. It covers:
  - parse, camp connectivity, the closest pick and both tie-break steps, and Rule B
  - stacks, including the chest column
  - the multi-cell keep, chests, the lever cascade and distance rebuild, stuck, and undo parity (A, B, stacks, levers, chests)
  - the solver counts, frontier, greedy, playouts, the cap, and every baked level's replay
- `tools/build-data/teaching.json` (v3): six hand-authored teaching boards at world size. World 1 has One Wall, Outside In and Closest First (stone first gets stuck). World 2 has Goats and a Chest, World 3 The Frozen Moat, World 4 Iron and a Lever.
- `tools/build-data/names.json`: w1-t3 renamed Closest First, and w1-09 and w2-09 added.
- `levels/levels.json` and `pool-w*.json`: v2 draft bake.

## Engine decisions (also in SPEC-v2 §8)
- **Contact.** A section's walk is the smallest BFS distance to a connected ground cell beside any of its tiles. Ties go to the lowest ground cell index; the contact tile is a tile beside that cell. `pathTo` walks back by strictly falling distance, lowest cell on ties.
- **Rule A tie-break (SPEC-v2 §2).** Smallest walk, then Chebyshev distance from the section's nearest tile to the nearest keep cell, then the lowest first tile. Section ids follow the first tile's scan order, so the last step is "lowest id".
  - `tie[m]` records what decided it: 0 unique, 1 keep distance, 2 first tile.
- **Rule B.** It breaks every section of the material that is reachable **at the call** (a snapshot). A wall that the breaks themselves expose waits for the next call.
- **Stacks.**
  - The muster is the columns' contents. The level's `stacks` is an array of columns of crew names, front first.
  - Each claimed chest adds a one-token column (column K + chest index).
  - The state key includes the column heads.
- **Levers.** A door that opens mid-flood triggers a clean BFS over the final connected ground, so walking distances stay exact.
- **Validation.** `P` must be on the board edge, the keep must be one 4-connected block, and there must be at least one camp cell.

## Generator design
- **Picture.** The castle rectangle sits in a field, with side, top and front margins from config; the camp is usually on the front edge. Then:
  - The curtain is `curtain.thick` blocks thick. Corner towers (round or square, radius `towers.r`) bulge outward.
  - The gatehouse faces the camp (it can protrude one row either way).
  - The keep block (2×2 or 3×3) sits at the back of the courtyard inside a ring 1-2 thick, cut into 2-3 arcs. World 4's ring is iron.
  - World 4 adds a lever against the ring's outer face inside a 3×2 lever house.
  - Optional pieces: a cross wall across the courtyard (2-3 segments), 0-3 free-standing buildings with a clear ring (the decoys), and a palisade across the whole front field (2-3 segments).
  - World 3+ adds a moat. Its inner edge is fixed and its outer edge bulges by angle, so it curves but never thins. Bridges are 2-wide straight runs of moat cells, and the first faces the gate.
  - The curtain's remaining cells are cut by angle into `curtain.arcs` arcs. Fragments and pieces under `minPiece` fold into a neighbour in the same group.
- **Colour.** Order: outer, bridges, palisade, yard, inner ring.
  - Hard rule: touching pieces of different groups never share a material, so no section spans two layers.
  - Soft rule: avoid same-group neighbours. A tower keeps its arc's colour with probability 1 - `towers.contrast`.
- **Rejects.** A moat leak (a curtain tile touching the camp's ground at the start) or scenery (a section the camp can't reach even with every wall broken) rejects the picture.
- **Muster (depth).**
  1. `solver.frontier` lists every Pareto-minimal winning crew mix with unlimited crews, up to `depth[1]` calls. Rule A prunes with a wall-count lower bound. Rule B floods, so it isn't pruned.
  2. Any mix u has min(u) = the shortest frontier vector ≤ u. Candidates have min in `depth` and |u| - min in `slack`.
  3. Up to `musterEval` (12) candidates, dealt round-robin across mins, are solved. The kept one scores decision points × 4 + 2 if it has a reshape + trap rate + 0.25 × min − 8 if a tie decides a solution call.
  4. Then the chest (required: in a pocket the line opens, holding a crew a later call needs, with the muster one short; detour: in a pocket the line never opens) and `spare` (0 everywhere now; `slack` replaced it).
- **Stacks deal.** Shuffle the A level's crews and deal them round-robin into `stacks.k` columns. Of up to `stacks.eval` winnable deals, keep the best by the same score.

## Measurements (headline; full tables in the report)
- Min calls (Rule A / B / A + stacks), medians: W1 4/3/4, W2 4/3/4, W3 5/4/5, W4 5/3/5.
- Boards with a decision point: A 27/53/41/31%, B 2/26/44/38%, A + stacks 27/58/63/39%.
- Surprise rate (Rule A) 83-89%. The tie rate on a solution move is 11-17%, and those boards are rejected. A≠B: 83-93%.
- Crew sections: medians 10/15/16/17, 14-15 blocks each on average. 0 capped solves. Solves take 0-2 ms (p90).
- Report: 1,200 pictures × 3 variants in about 5 s on 16 threads. Bake: 2,400 pictures in 5.4 s.
- Bake: 38 levels (9/9/10/10), pools 47/38/37/35, 0 near-miss fallbacks, 0 replay failures.

## Waived, cut, flagged
- **Depth target 4-12 is not what the boards give.** The measured range is 3-8 calls, and 8+ appears on under 5% of World 3-4 boards. I didn't force it (the brief said measure). More depth needs more layers, such as a concentric castle. That's in LATER.
- **Detour chests barely exist under Rule A.** The bake got 1 of about 9 wanted. It logged it and filled with required chests. In LATER.
- **World 4 levers are minimal (cut-order item 2).** The iron keep ring plus one lever house, so levers matter on 100% of boards, but it's a single step. No gate lever, no cascade.
- **Stacks were measured on every board**, not cut. 5-9 of 300 boards per world had no winnable deal in 16 tries (reported as variant failures).
- **The UI is broken until M1 v2**, as expected. `src/game.js`, `main.js`, `render.js` and `show.js`, `tools/harness.mjs`, `index.html` and `style.css` are untouched and still call v1's `apply`/`canBreak` and the v1 level fields.
- **For M1 (the API the UI needs).**
  - `E.targets` for the flags, `E.call` for the card tap, `E.pathTo(B, st, ground[0], ground[1])` for the walk, `st.breaks[i]` for what broke.
  - `st.dist` for the eat wave origin: the contact tile is `targets()[i].contact`.
  - The level fields: `line` (crew names), `lineCells`, `rule`, and `stacks` when present.
- Not run: the local image model, the browser.
