# Sapper's Path: M2 fix-pass notes

Fix pass on M2 (1952406) after the two M2 critics (`tools/critic-visual-m2.md`, `tools/critic-functional-m2.md`: 0 blockers, 9 majors). Scope: every MAJOR, plus functional minors 2 (win wait) and 4 (landscape rail). Everything else from both reports is parked in `LATER.md`, grouped by source. Engine, solver and every level's grid, muster, chests, min and line are untouched (proof below). Decisions are also logged in SPEC §7 (the "M2 fix pass" entry).

## Status by item

| # | Item | Status |
|---|---|---|
| 1 | (Functional MAJOR) Chests show their crew | **Fixed.** Every unclaimed chest wears its crew's badge (material colour ring, with a gold "+") over its lid, drawn in the baked layer and during the show until the claim. At 11×11 on 375 the chest badge is 22 CSS px across. A tap on an unclaimed chest returns the new tap result `chest` (the pick clears) and shows "Reach it for +1 goat" (mason / axeman / goat / torchbearer) over the board for `fx.toastMs` on the sim clock. selfTest checks the result, the text and that it clears. |
| 2 | (Visual 1) Chrome reads as a web page | **Fixed.** Castle-wall brick texture (painted in `art.js`, set as a CSS background) replaces the flat void on every screen. Bevelled stone buttons (lit top edge, dark lip, drop shadow; pressed state drops the lip) and gold primaries, parchment panels with an inset edge, pixel-font HUD, cards, panel titles, map headers and logo. The title scene now fills the whole screen at a whole number of CSS px per art pixel (castle mid-screen, logo on the sky, crews on the green, the blurb and Play on a parchment panel at the foot), so the 155 px / 190 px voids at 375 are gone. |
| 3 | (Visual 2) Map headers wrap | **Fixed.** Two rows: "WORLD N" with the stars or a lock icon plus "Win 6 in World 1" (nowrap), then the world name (nowrap). Measured one line each at 360, 375 and 390 on a fresh save. |
| 4 | (Visual 3) Banner world tag contrast | **Fixed.** The tag sits on a dark pill (`rgba(20,16,28,.78)`). Sampled from the 375 screenshots: white name 11.5:1 and gold eyebrow 9.0:1 on the day sky (Worlds 1-3), 18.0:1 / 14.1:1 on the World 4 night. Worst case (pill over a white cloud) 9.4:1 / 7.3:1. M2 was 1.7:1. |
| 5 | (Visual 4) Crew icons | **Fixed.** Pickaxe: a thick crescent head hugging the top-right corner on a diagonal handle (no longer a "T"). Axe: a double-bit axe, two filled wedge blades on an upright handle (a single flared blade read as a flag, so it was redrawn again). Board badges now sit on the material's colour ring like the cards. Sizes at 11×11 on 375: badge 26 CSS px across with a 16 CSS px glyph (M2: 20.7 / 12.4); sections with a 2×2 block get a big badge, 37 CSS px with a 24 CSS px glyph, centred on the block. The glyph snaps to a whole number of device px per art pixel. |
| 6 | (Visual 5) Reachable at a glance | **Fixed.** Sections a crew can break right now (reachable, a crew section, one of that crew left) get a bright inner outline and a full badge; every other standing section's badge is dimmed to 0.38. Baked into the layer on `game.ver`, so it costs nothing per frame. Picking a crew still narrows to one material. |
| 7 | (Visual 6) Real level names | **Fixed.** 36 siege names in `levels/names.json` (keyed by id); `tools/bake.js` merges them (logs any shipped level without a name, or name without a level). w3-t1 is now "Melt the Bridge"; w2-t1 shortened to "Goats & a Chest" to fit 360 px. The top bar now reads "4-5 The Sally Port" under the banner's "WORLD 4 / The Goblin Keep", so it no longer repeats it. No top-bar name ellipsizes at 360, 375 or 390. |
| 8 | (Visual 7) Crumble | **Fixed.** Tile by tile in BFS order from the contact tile: each tile shudders and cracks (`show.crackMs`), then pops (a flash and a shrink) and throws 6 rubble chunks (3-4 art px, face and dark underside in the material's colours) that hop, land inside the tile and settle, plus dust puffs. Crumble length over all 128 baked-line breaks: 600-860 ms at 1× (M2: 285 ms on the w3-05 ice). One tick per tile with pitch rising across the wave (`show.tickRise`), and a small board thump on the last pop. Skippable as before; 2× halves the show exactly (ratio 0.500). |
| 9 | (Visual 8 + functional minor 2) Win | **Fixed.** The keep punches (swells and settles), a flash plus two rings of thick rays, 72 confetti flakes in the flag and material colours, and the goblin at 2.1 cells (M2: 1.2) bouncing on the keep with a crown glint, then marching. The panel comes 480 ms after the keep opens (the goblin keeps marching beside it). Winning tap to Next at 1×: max 2.38 s over all 36 levels (w4-t1), World 4 mean 2.29 s, w4-06 2.28 s (M2: 3.86 s). At 2×: max 1.19 s. A tap anywhere after the winning break brings the panel on the next frame (measured 50 ms with a real touch). On desktop the panel sits over the rail column, so the board and the keep stay fully in view at 1280. |
| 10 | (Functional minor 4) Landscape rail | **Fixed.** Wide and short screens (height ≤ 480) set the crew cards two by two, icon and count only. Rail bottom: 286 of 375 at 812×375, 293 of 390 at 844×390, 278 of 360 at 740×360. Every play and win-panel button is hittable in all three. |

Nothing on the cut list was cut (rising ticks and confetti both shipped). Nothing waived.

## Rebake proof (item 7)
- `node tools/bake.js` (3.5 s), then compared `levels/levels.json` against a copy taken before the pass: 36/36 ids in the same order; with `name` removed the whole file is identical; 462 of 462 non-name level fields byte-identical; grid, muster, chests, min and line each 36/36 identical; 32 names changed (the 30 baked "<world> N" names, plus teaching boards w3-t1 and w2-t1). `pool-w1..4.json` and `teaching.json` byte-identical. The bake's timing-only rewrite of `tools/m0b-report.md` was reverted.

## Gate (final run)
| | desktop 1280×720 mouse | phone 375×812 touch (DPR 3) |
|---|---|---|
| `SP.selfTest()` | ok, 36/36 solved, 80 ms | ok, 36/36 solved, 92 ms |
| harness wins (real taps, 3 stars) | w1-05, w2-05, w3-06, w4-06 | same |
| harness stucks (panel Undo, rail Restart) | w1-t3, w2-02, w3-02, w4-02 | same |
| elementFromPoint (harness) | title 1, map 39, play+hint 7, play 6, every win and stuck panel | title 1, map 26, play+hint 7, play 6, every panel |
| 2× ratio | 0.500 | 0.500 |
| frames during a show | mean 16.7, p95 16.8 ms | mean 16.7, p95 16.8 ms |
| `SP.bench(300)`, crew picked | 0.25 ms/draw (639²) | 0.96 ms/draw (1068², same as M2) |
| console errors / warnings | 0 / 0 | 0 / 0 |

- `node tools/test.js`: 91 passed, 0 failed. Harness exit 0 (`tools/harness.mjs --out tools/shots/fix/harness`), including the hidden-tab run (selfTest ok, manual-clock win, cache drop recovered) and the 390×844 / 768×1024 checks.
- Extra checks (scratchpad `verify.mjs`): map headers one line at 360/375/390; no top-bar name cut at 360/375/390; tap-to-panel 50 ms; win panel and chest toast leave every button hittable; landscape at 812×375, 844×390 and 740×360 fits with every button hittable, including the win panel.
- `?v=4` on all 9 scripts, `style.css`, the font (`@font-face` URL and the preload), and via main.js on `config.json` and `levels/levels.json`.
- Payload on a cold load: 14 files, 291.9 KB, 0 external requests (M2: 193 KB; the font is 77.7 KB).

## Font
Jersey 10 (SIL OFL 1.1, Sarah Cadigan-Fried / The Soft Type Project), downloaded from `raw.githubusercontent.com/google/fonts/main/ofl/jersey10/`, shipped unmodified as `fonts/Jersey10-Regular.ttf` with `fonts/OFL.txt`, row in `LICENSES.md`. I first tried Pixelify Sans (the brief's example) and dropped it: its 5 is the same glyph as its S at every weight, so "4-5" read "4-S" and "0 / 5" read "0 / S". Jersey 10 keeps 5 and S distinct and is condensed, so every level name fits the top bar at 360 px. Body copy stays on the system stack; `font-synthesis: none` stops faux-bold smearing the pixel face.

## Files
- `src/art.js`: new pickaxe and axe icons; crack overlay tile `X`; `wall()` brick texture; `title()` takes a base fraction so a full-screen canvas keeps the castle mid-screen.
- `src/render.js`: badges on the material ring in three sizes (small, big for 2×2 blocks, chest with "+"), anchors per section, the live-section outline and dimmed badges, chest badges; per-tile crack and pop; rubble chunks and dust (`popTile`), confetti pool (`confetti`), keep punch, stronger rays, the goblin at its own frame size with bounce and glint. Hot path still allocation-free (typed-array pools, reused show objects).
- `src/show.js`: the crumble is per tile (one TICK per tile, arg = its index), timed by `crumbleTileMs` clamped to `crumbleMinMs`/`crumbleMaxMs`, with a `crackMs` lead-in.
- `src/game.js`: `chest` tap result (`g.fx.chestI`).
- `src/main.js`: wall background, full-screen title, two-row map headers, chest toast, per-tile show events (rubble, rising tick, last-pop thump), confetti on the keep, win panel timing after the keep, tap-anywhere skip after a win, wide panel over the rail, compact landscape class, selfTest chest check.
- `index.html`, `style.css`: the skin, the font, `#toast`, the title markup, `?v=4`.
- `config.json`: every new tunable (`layout.title*`, `wallArtPx`, `map*`, `compactRailMaxH`, `panelWidePx`; `fx` chunk, dust, thump, badge, toast, keep punch, rays, confetti, goblin bounce and glint, `winPanelAfterKeepMs`, `skipPanelMs` 0; `show` crumble, crack, tick rise, faster walk/swing/lever/door/keep delays, `goblinScale` 2.1; `art.wall`, `art.reach`, `art.confetti`; a rising `tick` recipe).
- `tools/bake.js`, `levels/names.json`, `levels/levels.json` (names only).
- `LICENSES.md`, `LATER.md`, `SPEC.md` (§4 font line, §7 entry).

## Screenshots (not committed)
`tools/shots/fix/before-*.png` (M2 as committed) and `after-*.png`: `title-375`, `title-1280`, `map-375`, `map-375-bottom`, `map-390`, `map-390-bottom`, `w1-mid-375`, `w3-mid-375`, `w4-mid-375`, `w4-mid-1280`, `chest-375` (close-up), `chest-tap-375`, `crumble-w3-05-375`, `crumble-w4-t1-375`, `win-375`, `win-1280`, `landscape-812`; after only: `win-burst-375` and `landscape-win-{812,844,740}`. Harness shots in `tools/shots/fix/harness/`.

## For the next critic
- The board layer is baked in the committed state, so a section a break opens gets its bright outline as the show starts, a beat before the wall in front of it has crumbled (parked in LATER).
- The critic reports themselves (`tools/critic-*-m2.md`) are still untracked; this pass did not write them, so it did not commit them.
