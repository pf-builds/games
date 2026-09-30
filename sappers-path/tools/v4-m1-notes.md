# Sapper's Path v4 M1 notes: the look pass (2026-09-30)

Brief: presentation only. Flat tight studs, a palette retuned for distance, a colour-first 3-row queue, bigger holding spaces, Food Hunt's phone order, a 1×/2×/3× speed cycle, and a colour-blind setting. No rule change, no rebake. Plan: `game-research/sappers-path-v4/plan.md`. Decisions: `SPEC-v4.md` §9. Palette numbers: `tools/v4-m1-palette.md`.

Page: http://127.0.0.1:8491/sappers-path/ (`?debug=1` for `SP`). Cache tag `?v=16` everywhere (scripts, CSS, the font URL in style.css, the config and levels fetches).

## Files

| File | What changed |
|---|---|
| `src/board.js` | `block()` draws the flat stud (`board.stud`); marks only in colour-blind mode, and always on iron (bars) and gilt (key). `setCb()`, `glyph()` (a mark alone, for the tiles), `studInfo()` (selfTest). Mini blocks keep a 1 device px seam. Tones reuse the base stud when 0. The unused `chip` export is gone. |
| `src/main.js` | Queue built from `layout.queueRows` (front `button.tile.card`, behind `div.tile.next.d1/d2`); tiles show only the count (and the glyph in cb mode); `setSpeed`/`nextSpeed` (`show.speeds`), `setCb`; line and tray render before the board is fitted; selfTest checks 15-17; `SP.speed(k)` replaces `SP.fast(on)`; `SP.state()` has `speed` and `cb`. |
| `src/save.js` | `settings.speed` (whole number 1-3; an old `fast: true` loads as 2) and `settings.cb` (strict boolean). `fast` is dropped. |
| `index.html` | The speed button (`.tog-speed`, shows 1×/2×/3×), the colour-blind toggle on the title (beside Era map) and in the map's top bar (`.tog-cb`). |
| `style.css` | Tiles, sockets and their sizes as CSS variables per layout (`--tile-h`, `--tile-n`, `--tile-gap`, `--gl-s`, `--slot-h`, `--slot-n`, `--man`); `body.cb` shows the glyphs; the speed button is gold above 1×. |
| `config.json` | `v3.mats` colours; `board.stud` (replaces inset, radius, bevel, grout, stud, studAlpha); `board.tones` all 0; `show.speeds` [1, 2, 3] (replaces speedFast); `layout.queueRows` 3, `glyphPx`, `manPx` (labMinPx gone); `selfTest.queueLevel`. |
| `tools/palette.js` | New: CIEDE2000 per co-occurring pair, per-level minimum, grayscale and ground gaps, the palette search, the markdown report. |
| `tools/shots-v4-m1.mjs` | New: the M1 screens and the side-by-side. |
| `tools/harness.mjs` | Speed 1×/3× for the rapid-tap frames (peak runners and squads sampled during the window, since at 3× the squads can be home before it ends); speed and colour-blind persist across a reload; output to `tools/shots-v4-m1/harness/`. |
| `tools/test.js` | 4 save checks (speed and cb through sanitize). |

## 1. Flat studs (`board.stud`)

- Seam: `seamCss` 1 CSS px, as whole device px (2 at dpr 2, 3 at dpr 3), half from each block, in the block's colour toward black by `seam` (-0.34). White ashlar gets light grey seams, black iron near-black ones, like Food Hunt's cat.
- Face: rounded corners (`radius` 0.22 of the face), a soft top band (`hi` 0.14 toward white over `hiH` 0.12), a faint foot (`lo` -0.07 over `loH` 0.14) and a small glint top-left (`glint`, alpha 0.5). Tried first: a 22 % top band at 0.2, which read as bevelled bricks; cut back.
- 8 CSS px check: `tools/shots-v4-m1/320x500-l64-8px.png` (a 320×500 phone puts level 64 at exactly 8 CSS px a cell). The fort reads as a clean picture; every colour is separable.
- Cell sizes now (Era 3's smallest board unless named): 375×812 15 px, 1280×720 21 px, 812×375 10.67 px, 400×600 iframe 11 px, 320×500 8 px. Level 8 at 375: 18.5 px.

## 2. Palette

Min ΔE00 over pairs that stand together in a level: **12.3 → 25.5**. Levels with a pair under 20: 64 → 0. Grayscale (pairs 10+ apart in L*): 65 → 71 of 87. Ground gap min 22.0 (iron excluded). Full per-level table and method in `tools/v4-m1-palette.md`.

## 3. Colour-first queue

- Front row: raised tile, full brightness, the only tap target. Rows 2 and 3: the same size, flat, opacity .66 and .38. Rows past a column's end are hidden but keep their space.
- `aria-label` keeps the crew name for screen readers; the visible tile has only the count.
- Blocked (lock badge, dimmed) and safe marks unchanged. The level 1 coach's "the faded squads move up next" arrow still lands on the first row behind.

## 4. Holding spaces

50 px tall, 36 px count on a phone (62/44 in the wide panel). Empty: a dark socket. Taken: a solid tile. Stuck keeps the hatch and a bigger lock, and its count gets a dark outline so it reads over the hatch. Working keeps the gold rim (3 px now) and the marker.

## 5. Layout

- Phone order unchanged in structure: header, board, line, queue. The rail grew (3 full-size rows), so the board lost some height: level 64 went from 16 to 15 CSS px a cell at 375×812.
- **Found and fixed:** `startLevel` fitted the board before the line rendered, when all 8 line slots were still visible (two rows in a 5-column grid), so the board was fitted to a smaller stage and never refitted. At 375 that cost level 64 two CSS px a cell (13 instead of 15). The line and queue now render first.
- Wide and short-landscape keep their side panel; the variables shrink the tiles for short screens so all three rows fit at 812×375 and in the 400×600 iframe.

## 6. Speed

1× → 2× → 3× → 1×. Pace = `show.pace × max(speed, victoryPace while marching)`. selfTest drives the real button and checks label, pace, save, and that at 3× 160 ms of real time moves the engine 480 ms.

## 7. Colour-blind mode

Off by default. On: every block gets its v3 mark, the queue tiles a glyph (the mark as a CSS mask in the tile's text colour, top-left). The gate's bars and the key's glyph show in both modes. Toggling rebuilds the sprite caches and repaints the layer (a settings tap, not per frame).

## Verification

- `levels/levels.json`: byte-identical (`git diff --stat -- levels/` empty; md5 `94380893acb6baf798530cae7bac1360` before and after).
- `node tools/test.js`: 156 passed, 0 failed (152 before, plus 4 save checks).
- `SP.selfTest()`: 555 pass, 0 fail, about 0.7 s (546 before). New checks:
  - queue: 3 rows per column at full size, front bright and the rows behind fading; every tile matches the engine at load and after every tap of level 40's stored order (a row past the end hidden, no crew name)
  - colour-blind off: gate bars and key glyph present, no tile glyph; on (the title's real toggle): all 12 other materials gain their mark, gate and key unchanged, tiles show glyphs, the save keeps it and reads it back; off again (the map's toggle): studs byte-identical to before
  - save sanitize: a bad cb loads off, a bad speed falls back, the old 2× flag loads as 2
  - speed: the real button cycles 2×, 3×, 1× (label, pace, save); 3× runs the engine at 3× real time
  - victory march: at 2× and 3× the faster pace stays
- Harness (`tools/harness.mjs`): all passed at 375×812, 812×375, 1280×720 and the 400×600 iframe, plus the hidden tab; 0 console errors or warnings. New: speed and colour-blind persist across a reload.
- Frames, three rapid taps (p95, headless Chromium, vsync-bound): L65 16.7-16.8 ms at 1× and 3×, L70 16.7-16.8 ms at 1× and 3×, with up to 26 runners and 3 squads out. Draw cost mid-show: mean 0.02-0.03 ms, max 0.2 ms.

## Screens (`tools/shots-v4-m1/`, gitignored like every shots folder)

- 375×812: `375-l8-rest.png`, `375-l40-rest.png`, `375-l64-rest.png`, `375-l40-mid-show.png`, `375-full-line.png`, `375-l64-colourblind.png`, `375-title.png`, `375-map.png`
- `1280-l64-rest.png`, `812-era3-l59.png` (the Era 3 board with the smallest cells at 812×375), `320x500-l64-8px.png`
- `side-by-side-375-l64-vs-foodhunt-l1492.png`
- The harness's own screens and report: `tools/shots-v4-m1/harness/`

## Not done (out of M1)

No power-up bar (M5), no home screen, no mystery or linked cards (M2). Ideas parked in `LATER.md`: the full-line head text crowding at 360 px, a colour-blind simulation score in `palette.js`, a simpler tower marker, the working marker touching the figures in the small iframe.
