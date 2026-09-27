# Sapper's Path: M1 notes

Builder notes for M1 (the playable core loop in the browser). Decisions are also in SPEC §7 (the 2026-09-27 M1 entry).

## Run
```
# server (no-store, worktree root): the game is at http://127.0.0.1:8491/sappers-path/
nohup python3 /Users/peter/Documents/Claude/.claude/serve.py 8491 /Users/peter/Documents/Claude/business/D-click-it-studios/repos/games-sappers-path > /dev/null 2>&1 &
export PATH="$HOME/.local/opt/node/bin:$PATH"
PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/harness.mjs     # about 25 s, exit 0 = gate passed
```
Open `?debug=1` for `window.SP`. `SP.selfTest()` returns `{ok, levels, solved, stuck, buttons, ms, fails}`.

## Files (M1 owns these)
- `index.html`: DOM shell. Every script and the CSS carry `?v=2`; `main.js` reads its own `?v=` and puts it on the `config.json` and `levels/levels.json` fetches. Meta no-cache.
- `style.css`: portrait first (top bar, stage, bottom rail); `body.wide` (set by `layout()`) is the desktop 16:9 layout.
- `config.json`: `input` (twoTap, keepPick), `stars`, `save`, `layout`, `fx` (every duration and effect size), `art` (the placeholder palette), `selfTest`.
- `src/save.js`: `sappers-path.v1`. `sanitize(raw, ids, maxCrews)` clamps stars to 0–3, drops unknown ids, drops a best below 1, keeps `last` only if the id exists. `record()` only raises stars and only lowers best. `open()`/`write()` never throw; a throwing localStorage falls back to memory.
- `src/game.js`: pure controller over the engine state: the pick, the tap results (`pick`, `unpick`, `break`, `blocked`, `empty`, `iron`, `clear`, `over`), the feedback stamps (on the sim clock), `blockers()` (the SPEC §7 rule), `solveFrom()` (BFS for the fewest further breaks, on copies), `stars()`.
- `src/render.js`: canvas renderer. Tile sprites per cell size, a cached board layer (re-baked on `game.ver` or cell change), cached dim and glow layers for the pick, then per-frame effects that walk the engine's typed arrays and a preallocated dust ring. M2 swaps art by replacing `PAINT` (tiles) and `ICON` (crew icons, shared with the cards).
- `src/main.js`: boot, screens, layout, input handlers, panels, the rAF loop and the facade.
- `tools/harness.mjs`: the M1 gate (below).

## Input and feedback (SPEC §1 + §4)
- Two-tap default. Tap 1 picks by card or by section (the section pulses). Tap 2 on any reachable section of that crew breaks it and clears the pick, so a stray third tap never breaks another wall.
- Picking lights every reachable standing section of that material (glow outline, pulsing) and dims everything else by `fx.dimAlpha`.
- Out-of-reach tap: picks that crew, shakes the section, flashes the walls in the way (blink × `fx.flashBlinks`). Verified by frame capture: on The Wrong Wall, tapping the inner stone flashes the timber, which is the lesson the board teaches.
- Crew at 0: tapping its section or its card flashes the card (CSS blink while the sim clock is inside `fx.cardFlashMs`).
- Crumble: the broken tiles shrink and fade over the new ground, plus dust (5 per tile, pool 700).
- Win: the keep sprite opens (crown), a burst of rays, then the stars panel after `fx.winPanelMs`. Stuck: plain panel (Undo, Restart) after `fx.stuckPanelMs`. Unlimited undo refunds the crew (engine re-derive). Keyboard: 1–4 pick the shown cards, u/z/Backspace undo, r restart, Escape unpick, Enter/n = panel primary.
- Ground cut off from the outside is drawn in shadow, so the reachable area reads at a glance.

## Layout
- Portrait 375×812: top bar 56 px (menu 44 px, `W-N` badge + name, `used / min ★`), teaching text when the level has one, the board as large as the stage allows (width-bound at 375: about 350 CSS px square), rail at the bottom: crew cards (76 px tall) and Undo/Restart (48 px). Every rail button's centre measured in the bottom third (harness asserts it).
- Desktop 1280×720: the board centred (638×638 device px at DPR 1), cards in a 210 px column beside it. The win/stuck card is centred over the board with a light veil.
- Adaptive DPR: `min(devicePixelRatio, layout.maxDpr)`, cell snapped to whole device pixels, canvas placed on whole CSS pixels, re-fit on every ResizeObserver tick.
- Win/stuck panel is a bottom sheet in portrait, so its buttons sit under the thumb.

## Facade (`?debug=1`)
`SP.state()`, `load(id)`, `tapCell(x, y)`, `tapCrew(type)`, `undo()`, `restart()`, `solve()` (clone: full-level solver result with the line as `[x, y]`, plus `fromHere`), `tick(ms)` (manual clock, capped at 60 s per call), `renderSignature()` (draws, then id | cell | dpr | size | pick | engine serialize | 48×48 pixel hash | opaque share), `selfTest()`. Harness helpers: `levels()`, `cellCenter(x, y)`, `buttons()`, `stuckLine(world)`, `blankTiles()`, `dropCaches()`, `bench(n)`.
`tapCell`/`tapCrew`/`undo`/`restart` are the same functions the canvas `pointerdown`, card `click` and button handlers call.

## selfTest (SPEC §5)
On a memory save, with the test clock (`step`), through the facade functions:
- title-screen buttons; `solve()` leaves the stored string and the live save byte-identical; the stars offsets; `record()` never lowers stars.
- every level (36 in the current bake, 30 in the first): tap 1 picks (alternating board tap and card tap) without breaking, tap 2 breaks, undo after move 1 is exact (`serialize`) and refunds the crew, the line wins at 3 stars with used = min, the win panel comes up on the clock, 3 stars and best are saved, `elementFromPoint` at every panel button.
- one stuck board per world (seeded random legal line): stuck panel, panel Undo is exact, redo is stuck again, panel Restart returns to the start.
- blocked tap (shake + flash > 0, no move), zero-crew tap (card flash, card tap also `empty`), `twoTap=false` breaks on one tap, sprite caches opaque and rebuilt after a drop, sanitize junk (never throws, clamps), bad JSON in storage.
- hands the player's game, screen and save back; checks their stored save string is unchanged.

## Gate results (harness, 2026-09-27, bake v2 with 36 levels)
| | desktop 1280×720 mouse | phone 375×812 touch (DPR 3) |
|---|---|---|
| selfTest | ok, 36/36 solved, 34 ms | ok, 36/36 solved, 35 ms |
| wins (real taps, 3 stars) | w1-05, w2-05, w3-06, w4-06 | same |
| stucks (real taps; panel Undo, rail Restart) | w1-t3, w2-02, w3-02, w4-02 | same |
| Play → level 1 | 1 tap | 1 tap |
| rAF frames, crew picked on 11×11 (glow redraws every frame) | mean 16.7, p95 16.8 ms | mean 16.7, p95 16.8 ms |
| `SP.bench(300)` script time per draw | 0.007 ms (638²) | 0.007 ms (1051²) |
| console errors / warnings | 0 / 0 | 0 / 0 |
The first run (bake v1, 30 levels) passed the same way: 30/30, wins w1-05 w2-05 w3-05 w4-04, stucks w1-t3 w2-01 w3-01 w4-01. The bench is script-side only (canvas work is GPU-deferred); the rAF numbers are the real signal.

Hidden-tab load (document.hidden and visibilityState faked, rAF held from the first script until shown): selfTest ok while hidden; a whole level played on `SP.tick` with the panel null before the tick and `win` after; after show the loop ran (clock +383 ms), the board canvas is fully opaque, no blank sprites. Cache drop proxy: 25 canvases blanked (22 sprite checks read blank), `visibilitychange` → 0 blank, 1 rebuild. 0 console errors.

Screenshots: `tools/shots/m1/{1280x720,375x812}-{midplay,win,stuck}.png` and `hidden-load-after-show.png`; every number in `tools/shots/m1/report.json`. The shots are not committed (they are harness output in a Pages deploy repo).

## Cut or waived
- Nothing on the cut list was cut (keyboard shortcuts, the desktop column and the blocking-wall flash all shipped).
- M2 items not started, by design: walk-ins, the 2× speed toggle (the `fast` setting is saved and unused), audio and the mute toggle (`muted` saved, unused), the world map, level locks, real pixel art.
- `LATER.md` is outside this milestone's file list, so the ideas below are parked here for the orchestrator to move.

## For LATER.md
- Hint on a lost position ("no way through from here"): `Game.solveFrom` already answers it in well under a millisecond on these boards.
- A section sealed by moat can never be reached (seen on the old bake's w3-07). It only shakes when tapped. Worth a generator rule (no permanently unreachable decoys) for readability.
- Baked names repeat the world name ("The Hedge Garden 2"); the select screen and top bar would read better with real names.
- Board sits centred with ~130 CSS px of air above and below at 375×812; M2 could use it for the walk-in lane or the crowned goblin.

## Engine
No engine bugs found. Everything goes through `parse / start / apply / undo / restart / sectionAt / isCrewSection / serialize / fromMoves / legalMoves`; `E.CREWS` is the card order. The page loads `solver.js` only for `SP.solve()`.
