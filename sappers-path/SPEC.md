# Sapper's Path: SPEC (v1)

Approved 2026-09-27 (Phase 0). Design source: `claude-workspace/business/D-click-it-studios/game-research/breachwork-kickoff-prompt.md` (renamed "Breachwork" → "Sapper's Path" at Phase 0 after a name collision with the itch game "Breachworks"). This file is the build contract. Where it's silent, the builder decides and writes the decision here.

**One line:** goblins stole the crown and walled themselves inside a keep of stone, timber, hedge and ice. Each of your crews can break one material. Break in from the outside, open a route to the keep, and don't run out of crews.

**Complexity target: Food Hunt: Pixel Puzzle** (Peter's daily game). It's one-tap, has no timer, and early boards are easy. Later boards get harder through more materials, a tighter muster and bigger boards, never through new rules. A typical level takes about 1–3 minutes and reads at a glance on a phone. Anything that makes a level harder to *read* than Food Hunt's late game is a defect, even if it's a good puzzle.

## 1. Rules (exact)

### Board
- A W×H grid, 7×7 at the smallest and 11×11 at the largest. Adjacency is orthogonal only (4-neighbour), everywhere in this spec.
- **Outside:** a virtual ring around the grid. Every edge cell touches the outside.
- Cell types:

| Code | Cell | Breakable by | Passable |
|---|---|---|---|
| `.` | open ground | n/a | yes |
| `~` | moat | never | no |
| `K` | keep (exactly one cell) | n/a | target |
| `S` | stone | masons | no, until broken |
| `T` | timber | axemen | no, until broken |
| `H` | hedge | goats | no, until broken |
| `I` | ice | torchbearers | no, until broken |
| `F` | iron door | no crew; levers only | no, until opened |
| `L` | lever | never (it's a switch set in the wall) | no |
| `C` | chest (open ground holding a chest) | n/a | yes |

- **Wall section:** a maximal 4-connected group of tiles of the same breakable material (S/T/H/I/F). Sections are computed once at level start. They never merge, because tiles only ever change from material to open.

### Derived state (recomputed after every change, until nothing changes)
1. **Connected ground:** the open (`.`/`C`) cells joined to the outside through open cells. An open edge cell is connected.
2. **Exposed:** a tile is exposed if it's on the edge or 4-adjacent to connected ground. A section is **reachable** if any of its tiles is exposed.
3. **Chests:** a chest on connected ground is claimed automatically, once. It adds +1 crew of its named type.
4. **Levers:** an exposed lever is thrown automatically. Every iron section 4-adjacent to it opens and becomes open ground. That can connect more ground, which can claim chests or expose more levers. Repeat until nothing changes, capped at W×H iterations.
5. **Win:** the keep is 4-adjacent to connected ground.

### A move
- Tap 1 picks a crew: tap its card, or tap a section. Tapping a section picks that section's crew and pulses the section.
- Tap 2 is a reachable section of that crew's material. The whole section becomes open ground, one crew of that type is spent, and derived state recomputes.
- **Stuck:** you haven't won and no remaining crew has a reachable matching section. Show it plainly with one-tap Undo and Restart.
- **Undo** is unlimited and steps back one move exactly, including chests, levers and the spent crew (the crew comes back). **Restart** returns to the start. Neither counts as a move.
- `config.input.twoTap` (default `true`). When `false`, tapping a reachable section breaks it in one tap. It's a playtest dial, because Food Hunt is one-tap and undo makes every break reversible.

### Stars (crews used = sections broken)
- 3 stars: win with the solver's minimum crews. 2 stars: minimum + 1. 1 star: any win. The offsets live in `config.json`.
- Best result per level is saved. Replaying can only raise stars.

## 2. Worlds and elements

| World | Name | Elements | Board sizes |
|---|---|---|---|
| 1 | The Outer Bailey | stone, timber | 7×7 – 8×8 |
| 2 | The Hedge Garden | + hedge, goats, chests | 8×8 – 9×9 |
| 3 | The Frozen Moat | + ice, torchbearers, moat | 9×9 – 10×10 |
| 4 | The Goblin Keep | everything + iron doors and levers | 10×10 – 11×11 |

- **v1 ships 6–10 levels per world (24–40 total).** 40 is the ceiling, not the target. The rest of the baked candidate pool stays in the repo, so more levels later is a bake-and-pick job.
- World 1 levels 1–3 are hand-authored teaching boards: one wall, then an order that matters, then a wrong wall that wastes your only mason. Each later world's first level teaches its new element on its own.
- Worlds 1–3 never combine more than two special elements in a level (chest, moat, ice counts as a material, not a special).
- Muster: the solver's minimum plus 0–1 spare, per level.

## 3. Content pipeline (Node, build time only)

- `src/engine.js` is pure: no DOM, no timers. It runs unchanged in Node (baker, tests) and the browser.
- **Solver:** search over the set of broken sections. Remaining crews, chests and doors all derive from that set, so the set is the whole state. Memoize it. It returns: win exists, minimum crews, one optimal line, and counts of reachable states, dead-end states and winning states. Hard cap on explored states. At the cap it reports `capped`, never throws.
- **Naive-player metrics per board:**
  - (a) **Greedy:** break the reachable section nearest the keep that you still have a crew for. Record the result.
  - (b) **Random playouts** (N from config, seeded): the win rate. This is the main difficulty proxy and the Food Hunt calibration axis.
- **Generator:** seeded blobs (flood or Voronoi) grown around a centred keep, materials assigned by ring with noise, and world elements placed by rule. Accept only if:
  - a win exists
  - greedy fails, or uses ≥2 more crews than the minimum (order must matter)
  - the random-playout win rate sits inside the world's band
  - World 2+: at least one optimal solution claims the chest, or skipping it costs a star
- **Measure before banding (DeJam lesson a):** M0 runs a few hundred boards per world and reports the distributions *before* any band is written here.
- **Bake:** deterministic seed, versioned `levels/levels.json`, candidate pools in `levels/pool-w{n}.json`. The baker never throws: it logs, falls back and says so in the report (DeJam lesson b).
- Level format (builder may extend, and documents it here): `{ id, name, w, h, grid: [row strings using the codes above], muster: {stone, timber, hedge, ice}, chests: [{x, y, crew}], min, metrics: {...} }`.
  - M0 extensions: `world` (1–4); `source` (`teaching`, `baked`, `pool`, or `near-miss:<reason>` when the baker had to fall back); `line` (the solver's optimal line as `[x, y]` of the first tile of each section, in break order, so selfTest can tap it through `tapCell`); `teaches` (teaching boards only: one-line lesson text); `seed`/`idx` (baked boards: the generator chunk and position, for reproduction).
  - `metrics`: `{ sections, randWin, greedyWin, greedyUsed, states, deadRatio, lostRatio, chestRequired, leversMatter }`.
  - `levels/levels.json`: `{ version, draft, note, seed, worlds: [{ world, name, band, levels: [...] }] }`. `levels/pool-w{n}.json`: `{ version, world, count, levels: [...] }`. `levels/teaching.json` holds the hand-authored world-1 boards.

## 4. Look, feel, layout

- **Art:** procedural pixel art drawn in code. Each material has a distinct texture and an icon, so the board reads in grayscale:
  - brick courses for stone
  - wood grain for timber
  - leaf clusters for hedge
  - cracked facets for ice
  - rivets for iron
  - one crew icon badge per section
- **Crews:** sprites walk in from the edge along connected ground to the section. The walk is short (config) and skippable by the next tap. A 2× speed toggle is Food Hunt parity. The logical state changes at commit; animation is presentation only and never gates input.
- **Breaking:** a crumble, then dust. The keep opens with a fanfare and the crowned goblin is marched out.
- **Feedback:**
  - A picked crew lights every reachable section of its material and dims the rest.
  - Tapping an unreachable section shakes it and flashes the wall sections in the way (builder's rule, documented here).
  - Tapping a section with no crews left flashes that crew card at 0.
- **Audio:** WebAudio synth only: pick clinks, axe thunks, goat bleat, ice sizzle, rubble, lever clank, chest chime, keep fanfare. A mute toggle is saved.
- **Portrait (primary, 375×812):**
  - Top bar: level name, crews used against the 3-star mark, menu.
  - The board as large as fits.
  - Bottom rail: crew cards with counts, plus Undo and Restart. Everything a thumb needs sits in the bottom third. Targets are ≥44 px.
- **Desktop 16:9:** the board centred, crew cards in a column beside it.
- **Flow:** title → world map → level. Level 1 is one tap from the world map. Win → stars panel → Next. Stuck → Undo / Restart panel. Menu → map.
- Tap-only input. Arrow and number keys are a bonus. System font stack.
- **Save:** `localStorage` key `sappers-path.v1`, holding `{ v, stars: {id: 0–3}, best: {id: crews}, settings: {muted, fast}, last }`. Clamp and sanitize every field on load. Drop unknown ids. Never throw.

## 5. Debug facade and tests (`?debug=1`)

- `window.SP` with: `state()`, `load(id)`, `tapCell(x, y)`, `tapCrew(type)`, `undo()`, `restart()`, `solve()` (on a clone), `tick(ms)` (manual clock for hidden tabs), `renderSignature()`, and `selfTest()`.
- `tapCell`/`tapCrew` are the same functions the pointer handlers call (lesson 31).
- `selfTest()` asserts through those entry points:
  - It solves at least 20 levels from the solver's line and checks the win and the stars.
  - It checks stuck detection and undo/restart.
  - It checks the saved `localStorage` string is byte-identical after any `solve()` (lesson 32).
  - It checks `elementFromPoint` at the centre of every primary button on the current screen (lesson 34).
  - It checks the sprite caches have opaque pixels (lessons 27–28).
- Node tests (`tools/test.js`): hand-made boards with known answers for the solver, and engine rules for chests, the lever cascade, stuck and win.

## 6. Studio checklist (every milestone)

- `?v=N` on every script tag, the CSS link and the `fetch()` of `levels.json`. `index.html` must revalidate (meta no-cache).
- Test once in a tab loaded while hidden.
- No `setTimeout`/`setInterval` for state transitions. Bound every loop.
- A quick tap never does anything irreversible (two-tap commit by default; undo always available).
- Zero console errors through a win and a stuck, on desktop and at 375×812.
- Tuning lives in `config.json`, never in code.
- Payload well under 20 MB, with no external requests.

## 7. Decisions log (builders append here)

- 2026-09-27 (Phase 0): name Sapper's Path. Food Hunt is the complexity reference. 24–40 levels. Two-tap commit with a `twoTap` dial. Undo refunds the crew (unlike Into the Fold, because stars are about the final line, not the attempts).
- 2026-09-27 (M0): engine (`src/engine.js`) and solver (`src/solver.js`) are UMD (`window.SappersPath.engine` / `.solver`). A level compiles once (`parse`). The state is the broken-section set; `derive` recomputes everything from it (a unique fixed point, because every step only opens ground). Undo = re-derive from the move list minus its last move, so it is exact by construction.
- 2026-09-27 (M0): iron sections are sections too, but never crew targets. A lever or door opens only through the cascade. A lever is permanent and impassable. An opened door is open ground.
- 2026-09-27 (M0): the keep does not count as passable. A keep on the board edge only wins if open ground touches it (the generator always centres the keep).
- 2026-09-27 (M0): solver = memoised DFS over the broken set (key = 16 section flags per char). Each state stores three distances to a win: any win, a win with at least one chest claimed, a win with none claimed. So "chest on an optimal line" and "chest required for 3 stars" are exact. A dead end = stuck (not won, no legal break). A lost state = no win reachable. The optimal line prefers a chest-claiming line when one is optimal.
- 2026-09-27 (M0): the generator sets the muster from the unlimited-crew optimal line (A* with a 0-1 BFS bound, which is exact without levers). So min crews is known before the real solve. The chest crew is one that a later step on that line uses, and the muster drops by one of it.
- 2026-09-27 (M0): random playouts are uniform over legal breaks (not crew first, then section). Greedy = the reachable section with a crew whose nearest tile is closest to the keep (Manhattan); ties go to the lowest section id.
- 2026-09-27 (M0): stars count crews used = sections broken. A chest's bonus crew doesn't change that. Min crews = the solver's min with the level's muster.
