# Sapper's Path: M1 v2 notes

Builder notes for M1 v2: the browser game on the v2 path rules (SPEC-v2 §2-§3). Decisions are also in SPEC-v2 §8 (the "M1 v2" entry). The engine, solver, generator and levels are untouched (the M0c bake, 38 levels, 9/9/10/10, loaded as it landed).

## Run
```
nohup python3 /Users/peter/Documents/Claude/.claude/serve.py 8491 /Users/peter/Documents/Claude/business/D-click-it-studios/repos/games-sappers-path > /dev/null 2>&1 &
export PATH="$HOME/.local/opt/node/bin:$PATH"
PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/harness.mjs     # about 90 s, exit 0 = gate passed
node tools/test.js                                                              # 106 engine/solver checks (M0c's), unchanged
```
Open `?debug=1` for `window.SP`. `SP.selfTest()` returns `{ok, levels, solved, stuck, buttons, show, chest, info, flagChecks, scenerySections, cues, ms, fails}`.

## What changed, by file
- `src/game.js`: rewritten controller. `callCrew(g, m, now)` is the move (results `call`, `aim`, `empty`, `none`, `over`). `tapCell` is info only (`next`, `closer`, `far`, `empty`, `iron`, `chest`, `keep`, `scenery`, `clear`). `blockedWhy(g, m)` drives the dimmed cards. `scenery()` and `blockers()` flood from the camp, not the board edge (v2 edges are not outside). `solveFrom()` is a BFS over (broken, spent). Stars count `calls`.
- `src/show.js`: the walk follows the engine's camp-distance path (the same descent as `engine.pathTo`, done in place so the show allocates nothing per frame). The whole walk is capped at `walkMaxMs`. The eat is a multi-source BFS from each broken section's contact tile, grouped into rings (`ringStart`), with one TICK per ring. `ringMs` is squeezed so the eat never passes `eatMaxMs`. The goblin is marched along falling camp distance. `S.prev` and `S.id` let the renderer bake the prev picture lazily.
- `src/art.js`: new v2 picture pipeline (`textures`, `levelInfo`, `compose`, `moatFrame`).
  - Every material is a texture function of world pixel coordinates, painted once per level into a Uint32Array: brick courses, upright planks, leaf mottle, ice glints and cracks, riveted plates, water, grass and courtyard earth.
  - `compose` copies blocks from those arrays and adds, in pixels: region outlines and bevels, wall shadows, moat foam, rubble, levers, chests, the tents, the keep, and shade on ground the camp can't reach. It never builds a canvas.
  - v1's tiles, sheets, icons, title, banner and map strips are kept.
- `src/render.js`: rewritten around the picture.
  - The layer is the composed picture scaled up with smoothing off. The prev layer holds the state before the call.
  - The flag sprites are pole, pennant and badge. The chest badges are unchanged.
  - Every frame: the moat wave overlays, then the show (drawn from the prev layer: blocks not yet eaten, cracking, popping, doors, levers, chests, the shut keep, and the light crossfade), then the footprint trail, the crew, the flags with their pop-in, the keep punch, rays, confetti, the goblin, shake, the confirm-mode aim, flash, pulse, dust and rubble.
  - The frame path allocates nothing.
- `src/main.js`:
  - Cards call. Board taps show a toast.
  - `feedback(r, m)` covers every result. Cards get `.off` and `aria-disabled`.
  - The HUD and panel count calls.
  - The portrait layout folds the banner away. The show's TICK events pop a ring.
  - The facade adds `call`, `targets`, `flags`, `card`, `busiest`, a windowed `bench`, and `stuckLine` returning crew names.
  - The selfTest is rewritten for v2 (below).
- `index.html`: 2× and mute copies in the top bar (`.topt`, shown only with `body.nobanner`). The hint card moves into `#stage` (over the top of the board). New blurb. `?v=5` everywhere.
- `style.css`: `.crew.off`, `.topt`, `nobanner` rules, the hint position, `?v=5`.
- `config.json` (v3):
  - `input.confirm`, save key `sappers-path.v2`.
  - `layout.boardGapPx`, `bannerMinPx` 56, `bannerSmallPx`, `bannerSmallArtPx`, `minCellPx` 10.
  - `fx` flag, trail and chest-badge keys. `show` walk, ring and eat keys. `art.blockPx`, `tent`, `flagPole`, `footprint`.
  - v1's badge and crumble keys are gone.
- `tools/harness.mjs`: the v2 gate (below).

## Gate results (harness, 2026-09-27, final run, exit 0)
| | desktop 1280×720 mouse | phone 375×812 touch (DPR 3) |
|---|---|---|
| `SP.selfTest()` | ok, 38/38 solved through `call()`, 290 ms, 296 button checks, 223 flag checks | ok, 38/38, 334 ms, 276 button checks, 223 flag checks |
| wins (real card taps, 3 stars) | w1-05, w2-05, w3-06, w4-06 | same |
| stucks (real card taps; panel Undo, rail Restart) | w1-t3, w2-02, w3-02, w4-02 | same |
| flags = `SP.targets()` before every call of the four wins, none after | 27/27 | 27/27 |
| board tap is info only | "Masons break this next", no move | same |
| skip (card tap mid-show is handled) / 2× ratio | moves 2 / 0.500 | same |
| busiest eat (w4-t1 call 1: 144 blocks, 37 rings, capped 900 ms), rAF | mean 16.7, p95 16.7, max 16.8 ms | mean 16.7, p95 16.7, max 16.8 ms |
| script per frame on that eat (step + ring pops + draw) | 0.60 ms (468×620) | 1.27 ms (1058×1402) |
| console errors / warnings | 0 / 0 | 0 / 0 |

- selfTest also covers:
  - the unlock rule; `solve()` leaving the save byte-identical
  - the show (walk plus rings, a card tap mid-show, 2× halves it, sounds fire)
  - a chest on a line (w2-t1: +1 held back, then chime, pop and bump)
  - every level: flags agree with `targets()` before each call; each call breaks its `lineCells` wall; undo after call 1 is exact and refunds the crew; the win comes at 3 stars; no flags remain after the win; the panel, the saved stars and the buttons check out
  - one stuck per world (every card dimmed; panel Undo exact; redo stuck; Restart)
  - the board-tap cases far / next / closer / empty, and the no-target card (`none`)
  - the confirm dial, the scenery rule on a hand-made v2 board, the chest toast, the hint card, mute
  - opaque caches (4 chest badges, 4 flags, 5 sheets, the picture layer) and their rebuild after a drop; sanitize; save key v2
- Other sizes, W4 24×32 board:
  - 390×844: board 369×489, banner 130, cell 15 px.
  - 768×1024: board 541×717, banner 82, cell 22 px.
  - Landscape 812×375: board 246×326, cell 10 px, the compact 2×2 rail.
  - Every play and win-panel button is hittable. In portrait the cards and Undo/Restart sit in the bottom third.
- Phone 375×812, W4: board 353×467 (cell 14.3 CSS px, inside the 12-16 target), banner 120, rail from 652.
- Hidden-tab load: selfTest ok while hidden. w2-t1 was played on `SP.tick` alone. The loop ran after show. Cache drop: 14 of 16 read blank, 0 after wake, 1 rebuild. 0 console messages.
- Payload: 14 files, 345.5 KB cold, 0 external. The largest is the font at 77.7 KB, then main.js 60 KB and levels.json 45 KB.
- `?v=5` on all 9 scripts, the CSS, the font preload and `@font-face`, and via main.js on the config and levels fetches. No `setTimeout`/`setInterval` in `src/`.

Screenshots in `tools/shots/v2m1/` (not committed), plus `report.json` with every number:
- `375x812-`: `{title,map,midplay-w1..w4,midwalk,mideat,win,stuck,gray-w4}.png`
- `1280x720-`: `{midplay-w4,win,stuck}.png`
- `{390x844,768x1024,812x375}-{play,win}.png`
- `hidden-load-after-show.png`

## Look
- The castle reads as one picture: brick courses run along a whole wall, planks and leaves span their regions, each region has an ink outline and a lit or shaded bevel, and walls drop a short shadow onto the ground to their south and east.
- Grass is outside and courtyard earth is inside. Ground the camp can't reach yet sits in shade and brightens when a call connects it.
- Grayscale (`375x812-gray-w4.png`):
  - Ice is the brightest, with diagonal glints. Iron is the darkest, with a rivet grid.
  - Stone has brick courses. Timber has upright planks. Hedge is a dark mottle.
  - The moat has dashes, and the courtyard is plain dark earth.
  - The first pass used a flagstone courtyard, and in grayscale it read like stone courses, so it became plain earth.
- The keep has a goblin-purple roof with gold eaves and a green flag, so the goal never reads as another wall.
- Flags: disc radius max(9 CSS px, 0.6 cells), so an 18 CSS px disc on the W4 phone board, with a pole and a pennant in the material's colour.

## Cut, waived, flagged
- **Cut (cut order 1, partly):** the camp is tents with a pennant on every other tent. There are no cooking fires, no crates, and no animated banners.
- **Landscape (cut order 3):** it works (every button is hittable and the board fits), but the board is 10 px a cell at 812×375, and the top bar still takes 56 px. Not polished further.
- **Stacks mode is not wired in the UI.** Cards map to materials. `Game.callCrew` does find a stacks column, but the flags and the dimmed state assume no stacks. Nothing baked uses stacks (the M0 decision), so this is only a guard.
- **Engine: no bugs found.** I used `call`, `canCall`, `targets`, `st.target`, `st.contact`, `st.ground`, `st.dist`, `st.conn`, `breaks`, `legalMask`, `fromMoves`, `serialize` and `stepInto` as documented. One note: v2 `parse` no longer exposes `B.edge`, which v1's `game.js` and `show.js` used. Both are rewritten, and nothing needs it.

## For LATER.md (the orchestrator moves these; LATER.md is outside this milestone's files)
- The camp's decorative detail: a cooking fire, crates, pennants that flap.
- The landscape phone: fold the top bar into the side column and give the board the full height.
- A flag cluster rule for when two contact tiles are adjacent. Rare in the bake, but the pennants can overlap.
- The crew sprite is 1.9 cells tall (about 27 CSS px on W4 at 375). A larger walk-cycle sheet (24×24) would read better on the new boards.
