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
