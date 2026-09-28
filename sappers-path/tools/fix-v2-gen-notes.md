# Sapper's Path: fix-v2 generator notes

Builder notes for the generator-side fix pass after the v2 critics (`critic-v2-visual.md` MAJOR-1/2, generator half; `critic-v2-functional.md` M1-M3, m1, m2, m6). The numbers are in `fix-v2-gen-report.md`; the format and rules are in SPEC-v2 §8 (the "fix-v2, generator side" entry). The UI builder owned `index.html`, `style.css`, `config.json`, the other `src/*` files and the harness, and ran in parallel.

## Run
```
export PATH="$HOME/.local/opt/node/bin:$PATH"
node tools/test.js                                   # 120 checks, about 0.4 s, exit 1 on failure
node tools/bake.js                                   # about 40 s on 16 threads → levels/levels.json + pool-w{1..4}.json (atomic)
node tools/fixgen-report.js <before levels.json>     # → tools/fix-v2-gen-report.md (before = git show 1ccf125:sappers-path/levels/levels.json)
node tools/artview.js w2-05                          # one level as ASCII with its art overlay
```
The bake is deterministic: two runs give byte-identical levels.json and pools (checked with shasum).

## What changed, by file
- `src/engine.js`: a camp may be deeper than one row. Every `P` must join a `P` on the board edge through `P` cells (it used to throw for any `P` off the edge). Nothing else changed.
- `src/solver.js`: `solve()` adds `maxWin` (the longest win; a state's call count is fixed by its key, so it's exact), `slowWin` (`maxWin > min`, so 2 stars are reachable) and `margin` (the closest margin along the line).
- `tools/gen.js`:
  - `castle()`: two gatehouse towers flank the outer gate (`gate.flank`). They start at the curtain's second row, so the inner row stays behind them and breaking one is never a breach. The first try ran them through the whole curtain; that opened a breach beside the gate and made one-card spam trivial in World 1.
  - The camp is `camp.w` × `camp.depth` (4-6 × 2), centred on the bottom edge ±`camp.shift`. Side camps are gone.
  - `keep.avoidGate` (Worlds 1-2): the keep ring avoids the outer gate's material, so the way in takes two kinds of crew.
  - `info.art`: tower rects (every tower piece), gate rects with their side, and the keep.
  - `musterize(…, band)`: scores candidates with `mscore` (spam −12, margin under band −6). With `band.noSpam`, no candidate may cover a one-material frontier vector (`fail: "mono"` when none is left).
  - The spare now has to keep the min, keep band.decisions, keep a required chest really required (`chestNeeded`: take the chest off the board, and the win must vanish or get longer), not allow spam, and not drop the margin. The one leaving a slower win is preferred.
  - `measure()` adds `spam`, `lineMats`, `margin`, `slowWin`, `maxWin` and `crewSingles`. `chestKind` "required" now also needs `chestNeeded`.
  - `accept()` adds `spam`, `one-material`, `margin`, `single-block` and (off by default) `no-slow-win`.
- `tools/artmeta.js` (new): `artFor(L, hints, C)` builds a level's `art`. `walkMarks` enumerates every reachable state and marks every crew walk (the same descent as `engine.pathTo`/`show.js`), every Rule B walk, and the win march. `decorate` places decor on the rest.
  - Order: a cart and up to 2 barrels at the camp's end; a well per courtyard of at least `wellMin` cells, at the free cell with 8 open neighbours nearest its middle.
  - Then a clustered value-noise field (lattice `noise` blocks): bushes along the board edge and walls, flower patches in the field, flower beds and barrels against courtyard walls, and flagstone paths in courtyards.
  - Never on a camp cell or beside one, or on a walked cell.
  - `ground(L)` gives the report's coverage, empty ground and largest blank square.
- `tools/bake.js`: every level and pool board gets `art`. The composite `difficulty` (`bake.difficulty`) orders levels. `bake.stepUp`: each world draws from pool boards at or above the previous world's median difficulty. `pickSlow` spreads the picks across the difficulty order, then swaps a pick without a slower win for a neighbour within 2 places that has one. New metrics go into each level. The new reject reasons join the near-miss order.
- `tools/bake-config.json`:
  - All worlds: `towers.p` 1 (inner rings too), `gate.flank` {w 2, out 1}, `camp` {w 4-6, depth 2, shift ±1}, palisade and outworks `clear` 3, `spare` 1, `slack` [0, 0].
  - World 1: front margin 5-6, buildings 1-3, barbican 0.35, outworks 0-1, depth 3-5, randWin ≤ 0.8, chunks 1000.
  - World 2: front margin 5-7, buildings 1-3, gardens 1-2, barbican 0.4, outworks 0-2, depth 4-7, chunks 400.
  - World 3 chunks 200, World 4 300.
  - Bands: `margin` 3, `noSpam`, `lineMats` 2, `slow` false.
  - New blocks: `bake.difficulty`, `bake.stepUp` and `decor`.
- `levels/teaching.json`: camps are 2 deep (a second row over the first). Each board has a hand-authored `art` with 4 corner towers on the ring corners and a gate rect on the camp-facing wall. The grids are otherwise unchanged, so the teaching tests (mins, Closest First's counts, frontier, greedy, playouts) still pass as they were.
- `levels/*`: rebaked. 38 levels (9/9/10/10), pools 14/60/60/55. `names.json` is unchanged.
- `tools/test.js`: 14 new checks (120 in total).
  - Parse: a 2-deep camp works, and a camp cell not joined to the edge throws.
  - The order check is now composite difficulty, not min.
  - fix-v2: `art` present on every level and pool board; rects in bounds and on wall; gate sides valid; the keep rect is exactly K; decor is a known kind, on plain ground, one per cell.
  - Decor never blocks: an independent enumeration with `engine.targets` + `engine.pathTo` plus the win march finds no decor on any walked cell.
  - The camp is a 4-6 × 2 patch centred on the bottom edge (levels and pools).
  - Margin ≥ band on every baked line; no one-card spam; ≥ 2 kinds of crew on every line; a slower win on ≥ 3/4 of baked levels (25/32); the step-up curve.
  - Worlds 1-2: empty ground ≤ 40% and no blank square over 5×5.
- `tools/artview.js` (new): ASCII art overlay viewer. `tools/fixgen-report.js` (new): the report.
- `tools/m0c-report.md`: its bake block was refreshed by the bake, as before.

## Decisions
- **Margin 3 kept, as briefed.** Raw boards mostly have margin 0-1 (World 1: 2,186 of 4,406 at 0), so margin 3 is a strong filter: about 0.3% of World 1 boards pass everything, and 2-3% in Worlds 2-4.
  - I raised the bake volume instead of lowering N: World 1 1000 chunks, World 2 400. That's about 16,000 boards in 40 s.
  - World 1's pool is 14, enough for 6 picks with some choice. If the playtest wants more World 1 variety, raise `bake.chunks.1` or drop World 1's margin to 2.
- **m6 documented, not changed.** Targets on a won state stay empty. No call is legal after a win, and the UI relies on "no flags after a win". The rule is in SPEC-v2 §8.
- **Teaching boards keep muster = min.** The critic asked for spares on non-teaching levels only. The slower-win count is 25/38 overall and 25/32 on baked levels.
- **World 1 random win capped at 0.8.** With the spare crew, World 1's pool sat at 0.85-0.9 (random tapping wins), which the functional critic called near-free. At ≤ 0.8 the World 1 levels run 0.73-0.80, then 0.26 and 0.09 for the last two.
- **No side camps.** The brief asks for a camp centred on its edge, 2 deep. A side camp centred on a side would sit beside the castle's walls with no field, so every camp is on the bottom now.

## Waived, cut, flagged
- **Nothing cut.** All six decor kinds and World 2 density shipped.
- **Coverage barely moved in World 1** (43% → 45% median crew wall). The front margin grew by a row for the 2-deep camp and the palisade gap, so the castle is a little smaller. The added pieces fill it (buildings, barbican, outworks, flank towers), and decor takes the empty ground from 53% to 27%. The largest blank square went from 4-5 to 3-4.
- **World 1 has fewer decision points** (1-3, was 1-4) and 2/6 slower wins. Scarcity plus no-spam plus margin 3 leaves few World 1 boards with more than one decision point. It stays approachable at 3-4 calls.
- **Ties.** Centring the camp makes the left-right walks more symmetric, so ties rose (about half of raw World 1 boards tie on a solution call). The bands reject them; no shipped line has one.
- **Names.** `names.json` is keyed by id, so each rebaked board inherited its slot's old name (for example "The Barbican" may not have a barbican now). Worth a naming pass before release.
- **Round tower rects** are the circle's bounding box, so a rect's corners can hold ground cells (and, in this bake, the odd decor item). The renderer should draw the tower as a circle inside the rect.
