# Sapper's Path: SPEC v2 (path rules)

Approved direction 2026-09-27, after Peter's v1 playtest. His notes:
- "Larger maps with slightly more resolution in pixels."
- "A path based game, you get a certain number of choices, you pick the color or type of material to go through, and it paths to the closest one, like Food Hunt."
- "I would like to go further... a more in depth game."

v1 is preserved at git tag `sappers-path-v1-playtest` (a1a0afb) and its contract stays in `SPEC.md`. **This file is the v2 contract.** Where it's silent, v1's SPEC applies. Builders log decisions in §8.

## 1. What changes from v1

| | v1 | v2 |
|---|---|---|
| A move | pick a crew, then tap the exact wall | **tap a crew card; the crew picks its own target** (closest reachable wall of its material) |
| Taps per move | 2 | **1** (undo covers mistakes) |
| Board | 7×7 – 11×11 cells | **about 16×20 to 24×32 blocks**, portrait-shaped, smaller blocks; the castle reads as a pixel picture |
| Crews enter from | any edge | **a siege camp** on the board edge; crews walk the open ground from there |
| Depth | 2–6 breaks | **target 4–12 calls** by world (measure first) |

Everything else carries over:
- materials and crews, chests, moat, iron doors and levers, the keep
- stars from the solver minimum, unlimited undo, stuck
- the art style and palette, audio, UI skin, world map, save, facade and harness

## 2. Rules (exact)

### Board
- A W×H grid of **blocks**, with the same cell codes as v1 §1, plus `P` for **camp**: one or more ground cells on the board edge where crews start. The camp counts as open ground.
- The **keep** may be a block of cells (for example 2×2 or 3×3). It's one keep.
- Sections: maximal 4-connected groups of one breakable material, computed once, as in v1.

### Derived state (recompute until stable, capped at W×H passes)
1. **Connected ground:** open cells (`.`, `C`, `P`) 4-connected to a camp cell. Board edges are **not** automatically outside any more. Only the camp's connected ground counts.
2. **Reachable section:** a section with a tile 4-adjacent to connected ground.
3. Chests on connected ground are claimed automatically (+1 crew).
4. An exposed lever (4-adjacent to connected ground) is thrown automatically. Adjacent iron sections open, and the cascade repeats.
5. **Win:** a keep cell is 4-adjacent to connected ground.

### Walking distance and the target rule
- `dist(section)`: a BFS over connected ground from all camp cells. It's the smallest distance to a ground cell 4-adjacent to one of the section's tiles.
- **Rule A, "closest"** (the default, Peter's rule): calling material *m* breaks the **one** reachable *m* section with the smallest `dist`. Ties go to the section closer to the keep (Chebyshev distance from its nearest tile to the keep), then the lowest `(y, x)` of its first tile.
  - The tie-break must be deterministic. The generator should avoid boards where ties decide an optimal move, and M0 measures how often ties occur.
- **Rule B, "all reachable"** (the M0 comparison only, Food Hunt's literal rule): calling *m* breaks **every** reachable *m* section at once. It costs one crew.
- **Stacks** (the M0 experiment only): the muster is dealt as K columns of crew tokens, and only the front token of each column can be called. This measures whether Food Hunt's queue adds depth.
- A call is legal only if that material has a crew left and at least one reachable section. A card with no target is disabled.
- **Stuck:** you haven't won and no call is legal.
- **Undo** is unlimited and exact. It steps back one call, including chests, levers and the spent crew. **Restart** returns to the start.

### Stars
Same as v1: 3 stars at the solver minimum calls, 2 at minimum + 1, 1 for any win.

## 3. Input and feedback
- **One tap on a crew card sends that crew.** There's no board targeting. Tapping the board is info only: it shows which crew breaks that wall, or "can't reach yet".
- **Target flags:** every callable crew card has a small flag in its crew colour and icon, planted on the board at the section it would break right now. The flags update after every call. The player should never be surprised by where a crew goes.
- `config.input.confirm` (default `false`). When `true`, the first tap on a card highlights its target and path, and a second tap sends the crew. It's a dial for the playtest.
- **The walk:** the crew leaves the camp and follows the shortest path over connected ground, with a faint trail. Then the section is **eaten block by block**, in a wave spreading out from the contact point, with a rising tick per ring. It's capped (config) so big walls never drag. 2× and tap-to-skip carry over from v1. The logical state changes at the tap, and animation never gates input.

## 4. Boards and worlds
- Sizes by world (the builder may tune after measuring): W1 about 16×20, W2 about 18×24, W3 about 20×28, W4 about 24×32. Portrait-first. Blocks are about 12–16 px on a 375 px phone.
- **The castle is the picture:**
  - curtain walls several blocks thick, split into a few big material regions
  - round or square towers, a gatehouse, courtyards and a curving moat
  - the camp on the edge (usually the bottom; the side on some levels)
  - Materials are drawn as textures that span a region (brick courses, planks, leaves, ice cracks), not one tile per cell. The board should look like a castle plan in pixel art, like Food Hunt's pictures.
- **Depth levers** to measure: the number of materials in play, how scarce the muster is, the "closest" rule putting the nearest wall where you don't want it (so you open something else first to change what's closest), chests, levers, the moat, and stacks.
- Worlds and elements are the same as v1 (W1 stone and timber; W2 + hedge, goats, chests; W3 + ice, torches, moat; W4 + iron and levers). Each world opens with a teaching board. The target is 36–40 levels, with pools kept.

## 5. M0 v2 measurement (the gate before any UI work)
For each world, generate a few hundred boards and report, **under Rule A, Rule B, and Rule A + stacks**:
- **Depth:** min calls, decision points (states with ≥2 legal calls where some lose), trap rate, random-playout win rate.
- **Greedy:** "call the material whose target is nearest the keep". Its fail rate and excess calls.
- **Tie rate:** how often a tie-break decides a target on any state along an optimal line.
- **Surprise rate:** how often the closest section is not the one on the optimal line, meaning the player has to reshape "closest" first.
- The share of boards where Rule A and Rule B give different minimums.
- Also: solve time, capped count, section count, blocks per section.

Recommend a rule and bands, and show 1 ASCII example per world. **Peter sees this report before M1.**

## 6. Carry-over checklist
Everything in v1 SPEC §5–§6, plus:
- The facade gets `call(material)` (the same function the card tap calls) and `targets()` (the current flag positions).
- selfTest solves at least 20 levels through `call()`.

## 7. Out of v2 (LATER)
Dailies, endless mode, an editor, hints beyond the target flags, and the portal SDK.

## 8. Decisions log (builders append)
- 2026-09-27: v2 direction approved by Peter ("go on with v2, I want to see these suggestions for a more in depth game"). v1 is tagged and unshipped.
- 2026-09-27 (M0 v2, engine): a move is a **call** (`engine.call(B, st, crew)`, or a column index in stacks mode). The state is (broken sections, spent), with spent = calls per material, then each column's head. Everything else derives from it, and undo replays the call list minus the last call.
  - **Walk.** A section's walk is the smallest BFS distance from the camp to a connected ground cell beside any of its tiles. Ties go to the lowest ground cell; the contact tile is beside it.
  - **Rule A tie-break.** Exactly §2: walk, then Chebyshev distance to the nearest keep cell, then the lowest first tile (= lowest section id). `tie` records which step decided it.
  - **Rule B.** Breaks the sections reachable at the moment of the call (a snapshot); walls the breaks expose wait for the next call.
  - **Stacks.** Each claimed chest becomes a one-token column of its own.
  - **Levers.** When a lever opens a door mid-flood, distances are rebuilt by a clean BFS.
  - **Validation.** `P` must be on the edge, and the keep must be one 4-connected block.
- 2026-09-27 (M0 v2, generator): castle pictures at 16×20, 18×24, 20×28 and 24×32.
  - A curtain 2-3 blocks thick in 3-7 arcs, corner towers, and a gatehouse facing the camp.
  - A keep block in its own ring (World 4: iron, with a lever house), plus optional courtyard buildings, a cross wall and a front palisade.
  - World 3+: a curving moat with 2-wide bridges.
  - **Depth.** The solver's Pareto frontier of winning crew mixes, plus 0-1 slack. The best of 12 candidate musters is kept, scored on decision points (details in `tools/m0v2-notes.md`).
- 2026-09-27 (M0 v2, measured; `tools/m0v2-report.md`): **Rule A, no stacks** is recommended to Peter.
  - Rule B is shallow: median random win 1.00, 1-3% of boards pass the bands.
  - Stacks add decision points (mostly World 3), but through queue order, not the castle.
  - Measured depth is 3-8 calls, not 4-12. §4's target is revised to the bands below until Peter says otherwise.
  - **Bands:** min calls 3-5 / 4-6 / 5-7 / 5-8; decision points ≥ 1 / 1 / 2 / 2; no tie-break on a solution call. The full band table is in the report.
  - **Levels:** 9 / 9 / 10 / 10 = 38, each world opening with its teaching board(s): Closest First teaches Rule A in World 1.
  - `levels.json` is `draft: true` until Peter reviews the report.
- **Level format v2** (`levels/levels.json`: `{version: 3, draft, rule, stacks, note, seed, worlds: [{world, name, band, levels}]}`; `levels/pool-w{n}.json`: `{version, world, rule, stacks, count, levels}`). A level is `{id, name, world, source, rule, w, h, grid, muster, chests, min, line, lineCells, metrics}`, plus the fields below:
  - `grid` uses v1's codes plus `P` (camp, on the edge). `K` may be a block.
  - `muster`: `{stone, timber, hedge, ice}`.
  - `stacks` (only when baked with `--stacks`): an array of columns of crew names, front first. The muster then equals their contents.
  - `line`: the solver's optimal line, as crew names (column indices in stacks mode), replayable through `call()`.
  - `lineCells`: `[x, y]` of the first tile of the first section each call breaks.
  - `metrics`: `{sections, blocks, walls, randWin, greedyWin, greedyUsed, states, trapRate, decisions, reshapes, tieAny, chestKind, leversMatter, minB}`.
  - Also `teaches` (teaching boards), and `seed`/`idx` (generated boards).
- 2026-09-27 (M0c, generator depth and density; `tools/m0c-report.md`): **Worlds 3-4 are concentric castles.** Rules unchanged.
  - An inner curtain (2 thick) inside the outer one, with a bailey between (2 blocks at the sides and back, 3-5 at the front), its own corner towers, and a gatehouse on a random side. The keep ring sits in the inner ward. Bailey cross walls (2 thick, curtain to curtain), bailey buildings and hedge gardens, ward buildings, a barbican in front of the outer gate, and earthwork outworks in the front field. The moat is on every World 3-4 board and wraps around the barbican.
  - Towers are coloured after their ring's arcs, avoid their neighbours' materials, and share one material per ring (Worlds 3-4).
  - **Bands revised:** min calls W1 3-5, W2 4-7, W3 6-10, W4 7-12. Wall-section caps 14 / 20 / 30 / 34. Everything else as M0 v2.
  - Measured (raw median min calls, before → after): W3 5 → 8, W4 5 → 8. Crew-wall coverage W3 41% → 50%, W4 32% → 48%. The bake is 38 levels (9/9/10/10); World 3 runs 6-10 calls and World 4 7-12.
  - Worlds 1-2 keep the single-ring generator (their density pass was cut for time).
- 2026-09-27 (M1 v2, the browser game; notes in `tools/v2m1-notes.md`):
  - **Input.** One tap on a crew card calls it (`Game.callCrew`, the same function as `SP.call`). A card with no crew left or no reachable target is dimmed (`.off`, `aria-disabled`) and a tap on it flashes it and says why ("No goats left", "Goats can't reach any hedge yet"). `config.input.confirm` (false): the first tap aims (target and walk lit), the second sends. A board tap never moves anything: it names the crew that breaks that wall next, says it goes for a closer wall first (and pulses the real target), or says it can't reach yet (shake plus the walls in the way flash, v1's blocking-wall rule seeded from the camp's ground only).
  - **Flags.** One per callable crew, at the contact tile of its target (`st.target`, `st.contact`), in card order. Hidden while a call's show plays and popped in when its light comes out, so they always match the state the player sees.
  - **Picture.** The board is one pixel picture at `art.blockPx` (8) logical px per block, textures in world coordinates, region outlines and bevels, wall shadows, shade on ground the camp can't reach yet. Grass is open ground joined to the board edge; every other open cell is courtyard earth. The keep is one block with a goblin-purple roof. Camp cells are tents with pennants. Per-section crew badges are gone (the flags replace them); chests keep theirs.
  - **Show.** The crew walks the engine's path from the camp (at most `show.walkMaxMs` for the whole walk), leaving footprints, then the called wall is eaten in rings from the contact tile, `ringMs` apart, squeezed so the whole eat never passes `eatMaxMs` (900 ms). One tick per ring, rising. The goblin is marched toward the camp. The prev-state picture is baked when a show starts and the show draws from it.
  - **Layout.** Portrait: the board first (width-bound at phone sizes), the banner takes what is left and folds away under `layout.bannerMinPx` (the toggles move into the top bar). The hint card sits over the top of the board.
  - **Save** key `sappers-path.v2`. Stars and the HUD count calls.
- 2026-09-27 (fix-v2, generator side; notes in `tools/fix-v2-gen-notes.md`, numbers in `tools/fix-v2-gen-report.md`). Fixes the visual critic's MAJOR-1/2 (generator half) and the functional critic's M1-M3, m1, m2 and m6.
  - **Camp.** A rectangle 4-6 blocks wide and 2 deep, centred on the bottom edge (±1). No side camps. The engine now accepts any camp cell joined through camp cells to a camp cell on the edge (it used to demand every `P` on the edge). Walks start from every camp cell, so the front row is distance 0. The teaching boards' camps are 2 deep too.
  - **Towers and gatehouse.** Every curtain corner gets a tower (Worlds 3-4: the inner ring's corners too). Two towers flank the outer gate, from the curtain's second row out one row past the gate; the curtain's inner row stays behind them, so a flank tower is never a breach. Worlds 1-2 add courtyard buildings (1-3), a barbican (35% / 40%), outworks (0-1 / 0-2), and in World 2 hedge gardens (1-2). In Worlds 1-2 the keep ring avoids the outer gate's material.
  - **`art` (additive, on every level in `levels.json` and every pool board):** `art: {towers: [[x, y, w, h], ...], gates: [[x, y, w, h, side], ...], keep: [x, y, w, h], decor: [[x, y, kind], ...]}`.
    - Rects are in blocks, top-left origin, `w`/`h` ≥ 1, inside the board. Every tower and gate rect covers wall cells.
    - `towers`: bounding rects of the tower pieces as generated (corner towers of both rings and the two gate towers). A round tower's rect is its circle's bounding box, so its corners can hold ground. A tower may share its material with the wall beside it; the rect is what makes it read. On teaching boards they are hand-authored (`levels/teaching.json` → `art`).
    - `gates`: the gate piece's rect plus the face it opens toward, `"n"`, `"e"`, `"s"` or `"w"`. The outer gate is always `"s"` (it faces the camp); Worlds 3-4 add the inner gate on its side.
    - `keep`: the K block's rect (exactly the K cells).
    - `decor`: cosmetic items, one per cell, `kind` one of `"bush"`, `"well"`, `"cart"`, `"flowers"`, `"barrel"`, `"path"`. Only on plain ground (`.`), never on a camp or chest cell or a cell beside the camp, and never on a cell any crew walk, aim line or win march crosses in **any** reachable state (the bake enumerates them all; `tools/test.js` re-checks with `engine.pathTo`). The engine ignores decor.
  - **Muster.** `slack` is 0 and every non-teaching level gets one spare crew (`spare: 1`) when a crew exists that keeps the min, keeps a required chest required (with the chest taken off the board there's no win or a longer one), keeps the band's decision points, and doesn't allow spam. Of those, the one that leaves a slower win is preferred.
  - **Band additions** (all worlds): `margin` 3, `noSpam`, `lineMats` 2, and a 1-block crew section is rejected. World 1's random-win ceiling is now 0.8. The depth search matches the bands: World 1 3-5, World 2 4-7.
    - **Closest margin:** along the optimal line, each called crew's target is at least `margin` blocks of walk nearer than the next-nearest reachable wall of the same material.
    - **No spam:** no muster covers a one-material winning mix, and calling any single card again and again never wins.
    - Every baked line uses at least 2 kinds of crew.
  - **Solver.** `solve()` also returns `maxWin` (the longest win), `slowWin` (a win in more than min calls exists, so 2 stars are reachable) and `margin`. A state's call count is fixed by its key, so `maxWin` is exact.
  - **Level metrics** add `margin`, `slowWin`, `maxWin`, `spam`, `lineMats` and `difficulty`.
  - **Order and curve.** `difficulty` = 1·min + 0.5·decision points + 4·trap rate + 6·(1 − random win), with the weights in `bake.difficulty`.
    - Within a world, teaching boards come first, then difficulty never falls.
    - Each world's baked levels come from pool boards no easier than the previous world's median (`bake.stepUp`).
    - Picks are spread across the pool's difficulty order, and a pick with no slower win swaps for a neighbour within two places that has one.
  - **m6, documented, not changed:** once `won` is true, `derive` returns no targets (`st.target` is -1 for every crew and `targets()` is empty), because no call is legal after a win. Tools that read targets on a won state must not expect any.
- 2026-09-27 (fix-v2 UI pass; notes in `tools/fix-v2-ui-notes.md`): every visual-critic MAJOR and MINOR in the UI files, plus the functional critic's UI half.
  - **Picture.** `level.art` draws tower caps (square or round merlon rings), gatehouse arches and decor; every wall edge facing open ground has battlements; rubble lies on the ground of its nearest open cell. The camp is trodden earth with tents, a war standard and one idle sprite per crew (dimmed at 0, away while it walks).
  - **Flags and chests.** A flag is a pole with a rippling swallowtail banner in the crew card's colour, and its section gets a faint rim. A chest is a pixel chest with a static "+1" chip; a claimed chest is drawn open and empty. Levers are 1.75 blocks on a gold plate with an idle glint.
  - **Show.** Blocks swell and pop in the wave with rubble sized in CSS px, and helpers chew along the wave front (at most 4). The win's rays, goblin and confetti are sized to the screen and the board.
  - **Info tap.** A board tap on a reachable wall draws the walks to the flagged wall and to this one, with both step counts. It never changes state.
  - **Layout.** On wide screens the top bar folds into the side column (in landscape the banner scene goes too). The hint docks over the banner. `fit()` never overflows its box.
  - **Save.** `sanitize` checks each record against the level's min, the star offsets and the unlock rule.
