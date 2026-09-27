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
  - (c) **Trap rate** (M0b, `solver.traps`): across every reachable state from which a win is still reachable, the share of legal breaks that lose. **Decision points:** steps on the optimal line where at least one legal break loses.
- **Generator (M0b, castle plans; `tools/gen.js` `castle`):** a centred keep inside concentric rings read from a per-size plan (keep ring, courtyard, curtain, moat band; World 4's keep ring is iron). Curtains are 1-2 thick and cut into a few long arcs of different materials; courtyards get radial dividers and moat bands get radial bridges, never a single tile. Sections never span two rings. Depth comes from the muster: an exhaustive search over crew mixes finds one whose best line uses every crew, so the unlimited-crew straight route is unaffordable. Accept only if (numbers per world in `tools/bake-config.json` → `bands`):
  - a win exists, the min crews sit in the world's band, and the wall sections (iron included) and stray single tiles are within the world's caps
  - greedy fails, or uses ≥2 more crews than the minimum (order must matter). World 1 swaps this for "at least one decision point" (see §7).
  - the random-playout win rate and the trap rate sit inside the world's bands, and the decision points meet the world's floor
  - World 2+: the chest is required for 3 stars, or a detour (claimable for at most one extra break). About 25% of baked levels get a detour chest.
  - World 4: levers matter (no win without them).
- **Measure before banding (DeJam lesson a):** M0 runs a few hundred boards per world and reports the distributions *before* any band is written here.
- **Bake:** deterministic seed, versioned `levels/levels.json`, candidate pools in `levels/pool-w{n}.json`. The baker never throws: it logs, falls back and says so in the report (DeJam lesson b).
- Level format (builder may extend, and documents it here): `{ id, name, w, h, grid: [row strings using the codes above], muster: {stone, timber, hedge, ice}, chests: [{x, y, crew}], min, metrics: {...} }`.
  - M0 extensions: `world` (1–4); `source` (`teaching`, `baked`, `pool`, or `near-miss:<reason>` when the baker had to fall back); `line` (the solver's optimal line as `[x, y]` of the first tile of each section, in break order, so selfTest can tap it through `tapCell`); `teaches` (teaching boards only: one-line lesson text); `seed`/`idx` (baked boards: the generator chunk and position, for reproduction).
  - `metrics`: `{ sections, randWin, greedyWin, greedyUsed, states, deadRatio, lostRatio, chestRequired, leversMatter }`. M0b adds (additive only): `trapRate`, `decisions` (decision points), `walls` (wall sections, iron included), `singles` (stray single-tile sections; a lever's seal walls don't count), `chestKind` (`required`, `detour`, or null with no chest).
  - `levels/levels.json`: `{ version, draft, note, seed, worlds: [{ world, name, band, levels: [...] }] }`. `levels/pool-w{n}.json`: `{ version, world, count, levels: [...] }`. `levels/teaching.json` holds the hand-authored teaching boards, each with a `world` field: World 1 levels 1-3 and the first level of Worlds 2-4.

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
- 2026-09-27 (M1): input. Tap 1 on a section picks its crew (pulse if reachable). Tap 2 on any reachable section of the picked crew breaks it; the pick then clears (`config.input.keepPick`, default false), so a stray tap can never break a second wall. Tapping the picked card again unpicks; tapping ground, moat, the keep or rubble clears the pick. A tap on a section, or a card, whose crew is at 0 flashes that card and picks nothing. An iron door shakes. `twoTap=false` breaks a reachable section on the first tap. **Blocking-wall rule:** tapping an out-of-reach section picks its crew, shakes it, and flashes the fewest standing wall sections (iron included) whose breaking would expose it: a 0-1 BFS from connected ground and the board edge, where entering a new standing section costs 1 and moving inside one costs 0; moat, levers, the keep and the tapped section block; the first cheapest route found wins ties. A section no route reaches (sealed by moat) only shakes. Ground cut off from the outside is drawn in shadow, so the lit ground is where crews can walk. Panels come up on the sim clock (`fx.winPanelMs`, `fx.stuckPanelMs`); the win is saved at the break, not when the panel shows. Play (title) opens the first level without a win, so level 1 is one tap from load; the menu button opens a flat level select (all levels open; the world map is M2). Files: `src/save.js`, `src/game.js` (pick, feedback, blockers, pure), `src/render.js` (art swappable via its PAINT/ICON tables), `src/main.js` (DOM, layout, loop, facade).
- 2026-09-27 (M0b): generator rework to `tools/m0-decision.md`. Castle plans replace Voronoi blobs (§3). Depth comes from muster scarcity, found by an exhaustive mix search (at most 84 tight-muster solves per board, each well under 1 ms). New proxy: trap rate plus decision points (`solver.traps`, additive). Chest: generated as "required" (pocket the optimal line opens, crew a later step needs, muster drops it) or "detour" (pocket off the line); the solver classifies the result and the bake takes about 25% detours. World 4: the keep ring is iron door 1, and lever 1 sits in a courtyard divider, sealed by one or two single-tile walls (deliberate, not counted against the singleton cap); a second, unsealed lever appears on about 30% of boards. **Unreachable, waived:** World 1 min crews "about 3". With two materials and no cross-ring merges, scarcity almost never bites (min 3 on 0-4% of boards), and greedy solves 99% of readable two-ring castles. World 1 therefore bakes at min 2 with the greedy rule off, and requires at least one decision point instead (every accepted board has a losing wrong first break). **Cut** (cut-order item 1): deliberate lever cascades. Levers still matter on every World 4 board, because every route crosses the iron keep ring. Spare: 0 in World 1 and +1 in Worlds 2-4, as in M0. `draft: false`.

- 2026-09-27 (M2): content and finish.
  - **Unlock rule.** A level opens when the level before it in its world is won. The first level of a world opens when the first `config.unlock.worldNeeds` (6) levels of the world before it are all won (all of them if that world has fewer). World 1 level 1 is always open. Locks are derived from the saved stars, never stored. The flat M1 select (every level open) is reachable only under `?debug=1` (a button at the foot of the map).
  - **Flow.** Title (painted castle, Play) → world map → level, so level 1 is two taps from load. The menu button in play opens the map. Win panel: Next when the next level is open, otherwise Map.
  - **Scenery rule.** A section is scenery if no tile of it can ever be exposed, even with unlimited crews and every lever thrown: flood from the board edge through every cell that can ever be open (ground, chests and every wall, iron included), with moat, levers and the keep blocking. A section with no flooded tile is drawn muted, gets no badge, and a tap on it only clears the pick (tap result `scenery`). `Game.scenery(B)`, once per level. The final bake has 0 such sections; selfTest proves the rule on a hand-made board.
  - **The show** (`src/show.js`, pure). The engine commits at the tap; the show is presentation on the sim clock. The crew walks in from the edge along the ground connected *before* the break (the contact tile is the section tile with the shortest walk; long walks start at most `show.walkMaxTiles` from the wall and fade in), swings (`show.swings`, a work sound on each strike), then the section pops in rings by BFS distance from the contact tile (one rubble tick and a dust burst per ring). Then levers the break exposed clank, their doors swing open tile by tile, the newly connected ground comes out of shadow, claimed chests pop and fly +1 to the card (the card holds the +1 back until it lands), and on a win the keep opens with a fanfare and the crowned goblin marches toward the nearest edge. The panel comes up `fx.winPanelMs`/`fx.stuckPanelMs` after the show ends. **The next tap (board, card, Undo, Restart or Escape) fast-forwards the show and is then handled normally**; a tap after a win brings the panel in `fx.skipPanelMs`. **2×** (saved as `settings.fast`) multiplies every show duration by 1/`show.speedFast` when the show is built.
  - **Audio** (`src/audio.js`): WebAudio only, every cue a voice recipe in `config.audio.cues`. The context is created on the first pointerdown/keydown. Cues fire from the same functions the player's input calls (tapCell/tapCrew/undo/restart, button handlers) and from the show's events in the frame step. The last cue and per-cue counts are recorded even when muted or during selfTest (`SP.state().cue`, `SP.cues()`). Mute is saved (`settings.muted`).
  - **Art** (`src/art.js`): every tile, crew sheet, goblin sheet, badge icon and scene is painted in code on 16×16 (icons 12×12) logical grids and scaled with smoothing off. `render.js` keeps the board drawing and scales the art to the cell size; the sprite-cache opaque checks cover tiles, badges and all five character sheets.
  - **Layout.** Portrait: the rail at the bottom, the board directly above it as large as the width allows (`layout.marginCells` 0.3, gutter 8 px), and the spare height becomes the banner: the world name, the 2× and mute toggles, the teaching hint card, and the crowned goblin on the battlements. Desktop: side column (banner, world, toggles, hint) | board | rail. Teaching boards show a dismissible hint card with the level's `teaches` text (dismissed per session).
