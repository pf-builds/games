# Sapper's Path v4: Critics 2 fix pass notes (2026-09-30)

Brief: one fix pass after Critics 2 (`tools/critic-v4-2-visual.md`: 0 blocking, 2 major, 10 minor; `tools/critic-v4-2-functional.md`: PASS, 1 minor). Fix both majors and the cheap minors, park the rest, no rule changes; level data changes only in the Gallery (four paintings' palettes and slot 33). Decisions: `SPEC-v4.md` §9, the Critics 2 fix entry. Parked items: `LATER.md`, "From v4 Critics 2".

Page: http://127.0.0.1:8491/sappers-path/?debug=1. Cache tag `?v=23` everywhere.

## Commits (branch `sappers-path`)

| Commit | What |
|---|---|
| `869c078` | Critic reports, the functional critic's scripts (`tools/critic-v4-2/`) and the visual critic's two scripts (`tools/shots-v4-critic2/*.mjs`, force-added; shots stay ignored) |
| `3ead9e2` | Gallery data: the converter's step 7 (paintings' display lift), `gallery.json` (four palettes, slot 33 Trophy), manifest, LICENSES, bake report, `fade.js --gallery` per painting |
| `a0ce5dc` | The page: coach fit, the Gallery's payoff, buy states, Recall icon, bar sizes, home chip, report cards, wide win sheet, rod lanes; selfTest checks; harness at 375×667 and 414×736; `tools/shots-v4-fix2.mjs`; cache tag |
| docs commit | SPEC-v4 §9, this file, LATER, the top-bar coach's start font (19), both critics' diff results |

## Every finding

| Finding | Result | What |
|---|---|---|
| **V1 (major)** coach clips on 375×667 (62, 77) and 414×736 (76) | **Fixed** | `fitBoard`: a coached level tries 3 rows with the band above the board, then 2 rows with the band, then the top bar (3 rows if the board keeps 8 px with them). Top bar: the step's `short` line (new for 35, 62, 76), font `layout.coachTopFontPx` 19 → 13 on one line, then two lines (`body.coach-top #coach.two`). Harness now runs 375×667 and 414×736 (selfTest there checks every teaching step). |
| **V2 (major)** Gallery has no payoff | **Fixed** | Win report: "Picture complete!", "{title} is in your Gallery now." and the finished picture on a gilt frame above the report cells (4 CSS px a cell, at most 136 px, shrunk to the room); where the sheet has no room (812×375) the picture hangs over the razed board (`#stage-pic`). Gallery screen: the first uncleared picture wears a breathing gold frame and a "Play" chip, and the screen scrolls to it. Cleared pictures stay in colour (selfTest compares their pixels with the palette). |
| m1 faded painting pairs | **Fixed** | Converter step 7 (`fadeFloor` 16, paintings): display lightness only, grids unchanged. Table below. |
| m1 Teapot and Fruit | **Replaced** | Trophy (`noto-1f3c6`), the cleanest stored spare (5 colours, reads at 34 cells). Section below. |
| m2 unaffordable buy looks affordable | **Fixed** | `.pw.poor`: muted "+", price in red on pale red, "need N" under the badge on wide screens, aria "you need N more"; still tappable for the toast. |
| m3 Recall icon reads as a pipe | **Fixed** | A gold U-turn arrow (back, pointing down-left) over a steel sapper helmet, drawn by `recallRows` in `art.js` through the same ink-halo glyph helper as the crate. |
| m4 iframe badges 41 px | **Fixed** | 44 px in the ≤640 px frames (`--pw-d`), the badge sits over the band's 2 px rims (`align-content: center`), so the board loses nothing. selfTest asserts `selfTest.minTapPx` (44) at every viewport. |
| m5 landscape power panel mostly padding | **Fixed** | `sizePowers` for short wide screens picks the biggest fit: a row beside the coins, a row under them (`.head`) or 2 × 2 (`.grid`). Level 40 at 812×375: 50 → 78 px badges under the coins (it was 42 px of padding above and below). |
| m6 home era chip on the crew | **Fixed** | The chip lies on the title scene's river at the castle's foot: `Art.title` returns its base, `paintTitle` sets `--river-y`; clear of the crew (13 scene px lower) and the keep at every size (checked at 375×667, 375×812, 414×736, 812×375, 1280×720, the iframe; selfTest checks its centre is on the river and it overlaps no logo, pill or button). A first try under the logo collided with the keep's flag on short screens. |
| m7 era report card, settings Speed row | **Fixed** | `.rc` is a band: cleared, three 22 px medal discs with counts, the coin total with its icon. Settings Speed row: a fast-forward icon on the left and "1×/2×/3×" on the right like the other rows. |
| m8 thin siege win moment | **Part fixed** | Wide screens: the win sheet is the rail's height, or its content's when taller, from the rail's top (no 150 px of empty cream; the power-up bar stays in view). Banner in the razed ground and the bin burst parked (LATER). |
| m9 / Critics 1 N6 two links in one gutter | **Fixed** | `drawRods` collects every rod first; two gutter runs at the same x over overlapping rows take a lane each, `rod.lane` 2 px either side (never past the tiles' edges), the second in `rod.metal2` (steel). selfTest `laneClash` along levels 62, 67, 78, 89 and the debug levels; level 78 step 13 screens below. |
| m10 wide paintings on portrait phones | **Parked** | Needs portrait crops and a rebake of those pictures (LATER). |
| Functional S1 same-instant event order | **Fixed (SPEC)** | SPEC-v4 §9 states the order exactly: tap reveals, the pair's events, batch order, pops (EAT, TOWER, UNLOCK, GATE), arrows, homes and FREE, power-ups (REVEAL before POWER for the Quartermaster and Scout; POWER then FREE for Recall), and sapper ids as labels. |

## Measurements

### Coach fit (`tools/shots-v4-fix2.mjs`, `before-measure.json` / `after-measure.json`)

Mode, queue rows, font, lines, fit, the board's CSS px a cell. "Lines clipped" counts coach states that don't fit along every teaching level's stored Normal order (levels 3, 26, 35, 51, 62, 76, 77).

| Viewport | Level 62 before → after | Level 76 before → after | Level 77 before → after | Lines clipped | Badges |
|---|---|---|---|---|---|
| 375×667 | top, 3 rows, 15 px, CLIPPED, 9 → above, 2 rows, 21 px, 10 | above, 2 rows, 21 px, 8 → same | top, 2 rows, 15 px, CLIPPED, 9 → top, 2 rows, 17 px, 2 lines, 9 | 9 → 0 | 58 |
| 414×736 | above, 3 rows, 21 px, 9 → same | top, 3 rows, 15 px, CLIPPED, 8.67 → above, 2 rows, 21 px, 9.33 | top, 3 rows, 17 px, 8 → above, 2 rows, 21 px, 8.67 | 8 → 0 | 58 |
| 375×812 | above, 3 rows, 21 px, 11.33 | above, 3 rows, 9.33 | above, 3 rows, 8.67 | 0 → 0 | 58 |
| 390×844 | above, 3 rows, 12.33 | above, 3 rows, 10.33 | above, 3 rows, 9.67 | 0 → 0 | 58 |
| 1280×720 | side, 22 | side, 18 | side, 17 | 0 → 0 | 108 |
| 812×375 | side, 2 rows, 11.33 | side, 2 rows, 11 | side, 2 rows, 10.33 | 0 → 0 | 50 → 78 |
| 400×600 iframe | above, 2 rows, 9.5 | above, 2 rows, 8 | top, 2 rows, one line, 8.5 | 0 → 0 | 41 → 44 |
| 360×640 (extra) | above, 2 rows, 11 | above, 2 rows, 9 | above, 2 rows, 8.5 | 0 → 0 | 41 → 44 |

All nine teaching levels (1, 2, 3, 26, 35, 51, 62, 76, 77) fit at load at every viewport after the fix; only level 77 uses the top bar (375×667 two lines, the iframe one line). The iframe's 77 shows at 17 px (the box is exactly as wide as the line at 19; it was 19 before).

### Smallest board cell (harness, every Siege board and every Gallery board, CSS px)

| Viewport | Era 1 | Era 2 | Era 3 | Era 4 | Gallery |
|---|---|---|---|---|---|
| 375×812 | 12 | 11 | 11 | 8.5 (L77) | 8.0 (Red Fuji) |
| 375×667 | 8.5 | 8.0 | 8.0 | 8.0 | 8.0 |
| 414×736 | 9.67 | 9.0 | 9.0 | 8.0 | 8.67 |
| 812×375 | 10.33 | 10.0 | 10.0 | 9.33 (turned) | 9.67 |
| 1280×720 | 20 | 19 | 19 | 16 | 16 |
| 400×600 iframe | 10 | 9.5 | 9.5 | 8.0 | 8.5 |

Every board is 8 CSS px a cell or more everywhere.

### Paintings' faded pairs (ΔE00, a colour faded to a queue row against another at the front; `node tools/fade.js --gallery`)

| # | Painting | Smallest before | After | Pairs under 20 before → after | Colours moved |
|---|---|---|---|---|---|
| 5 | Red Fuji | 15.2 (navy row 2 vs slate) | **18.7** | 2 → 2 | slate #2d829d → #3a8ca8 |
| 12 | The Great Wave | 22.6 | 22.6 | 0 → 0 | none |
| 19 | Wheat Field with Cypresses | 17.3 | 17.3 | 3 → 3 | none (over 16) |
| 26 | Irises | 14.2 (slate vs grey) | **16.0** | 6 → 5 | grey #7d9aae → #87a5b9 ("sky") |
| 33 | Teapot and Fruit | 12.0 | replaced (Trophy 22.3) | 11 → 0 | |
| 40 | Roses | 14.6 (grey vs sand) | **16.5** | 11 → 8 | sand #bbb6a4 → #c6c1af ("cream"), dark green #007443 → #006a3a, charcoal #213d3e → #183435 ("black") |
| 47 | Oleanders | 18.2 | 18.2 | 3 → 3 | none (over 16) |
| 54 | Apples and Primroses | 14.6 (black vs dark brown) | **16.2** | 6 → 6 | black #1a2126 → #12191e, dark brown #5d4935 → #67523e ("brown"; the old "brown" #ba6a00 is now "orange") |

Gallery overall: 42 → 27 pairs under 20 (of 2,472 → 2,368), smallest 12.0 → 16.0, per-level median 23.0. Unfaded smallest pair per painting unchanged or up (Roses 20.3 → 21.5). The first rarer-first lift left Apples at 14.8 (lifting dark brown pushed it into olive); the step now takes the move that leaves the best smallest pair over the whole picture, which darkens black instead.

### Slot 33: Trophy

- Source: `noto-1f3c6` (Noto Emoji, Apache 2.0), stored under `tools/gallery-src/` since M4 (no download). Manifest: Trophy kept at 33 (`swapped` note), Teapot and Fruit `keep: false` with the reason. LICENSES.md row 33 replaced.
- Converted: 34×34 board, 5 colours (blue ground, yellow, black outline, brown base, white glint), min ΔE00 30.9, smallest faded pair 22.3, 176 outline cells.
- Baked into the hard slot (10-30% Normal random-tap) by `tools/gallery-bake.js` (full bake to a scratch folder first, 640 s on 16 threads, 0 fallbacks): Normal **22.0%** (in band), Easy 32.8%, Hard 11.0%, lookahead 100% (as Plumed Helm, the hard slots' narrowing found no lower deal), fast tapper 22.0%, patient 145 s, longest tap 14.3 s, 42 taps (42 cards), 9 black squads, first breach on tap 6.
- The scratch bake against the shipped file, level by level: only levels 5, 26, 40, 54 (`pal`, `convert`) and 33 (everything) differ, plus the file's wall-clock `bake.seconds` (622.6 → 639.9). The installed file is the shipped one with those five levels spliced in, so it keeps 622.6; with that one field set to the scratch bake's it equals the scratch bake byte for byte.

### Other sizes

- Report picture: 100×128 CSS px picture (4 px a cell) in a 114×142 frame on every portrait size and 1280×720; at 812×375 the sheet has no room, so it shows over the razed board at 208×261.
- Badges (level 40): 58 px on 3-row phones, 48 on 2-row phones (compact bar), 44 in the iframe and 360×640, 78 at 812×375, 84-108 on desktop.
- Wide win sheet (1280×720, level 8): the rail's height (it was the whole column, about 150 px of empty cream above and below the content).

## Verification

| Check | Result |
|---|---|
| `node tools/test.js` | **327 passed, 0 failed** |
| `SP.selfTest()` | **0 fail** at 375×667 (1015), 414×736 (1015), 375×812 (1015), 390×844 (1015), 1280×720 (1016), 812×375 (1016), 400×600 iframe (1015), hidden tab (1015); new checks: the Gallery's next tile, the report picture's colours and fit, no picture on a siege report, `.poor` buys, 44 px badges, the wide win sheet, the era chip on the river, rod lanes on level 78 |
| `node tools/harness.mjs` | **all passed** at 375×812, 375×667, 414×736, 812×375, 1280×720, the 400×600 iframe and the hidden tab; 0 console errors or warnings; payload 911 KB; frames p95 16.7-16.8 ms |
| `node tools/regrade.js` | 100 levels, 755 checks, **0 differences** |
| `node tools/regrade.js --gallery` | 60 levels, 480 checks, **0 differences** (against the new file) |
| Critics 1 diff (`critic-v4-1/diff.mjs --patient 6 --rushed 5`, `edge.mjs`) | 3,744 games, **0 mismatching**, 312/312 stored replays, 0 grade mismatches; edge cases agree |
| Critics 2 diff (`critic-v4-2/diff.mjs --patient 4 --rushed 4 --power 8`, `edge.mjs`) | 8,364 games, **0 mismatching**, 0 grade mismatches; refused power-ups byte-identical (39,411); same-instant order-only differences 656 (the S1 gap, now written in the SPEC; their script still sorts within an instant). `edge.mjs` prints "differing: 1" for "Recall a wary squad, re-tap": only the HIT event's sapper id (game 2, theirs 1); the output is identical at `869c078` (before this pass) |
| `debug-v4.js --check`, `teach-v4.js --check` | match |
| `tools/fade.js` (siege) | unchanged: 0 of 312 pairs under 20, smallest 20.0 |
| Shots script | `tools/shots-v4-fix2.mjs` before and after: 0 console errors or warnings |

Level files (md5):
- `levels/levels.json` 8c14f6087dc6a4b72fce9057017a8d2a (unchanged)
- `levels/debug-v4.json` bf16dce84f16a9dac42c35c1f961eb29 (unchanged)
- `tools/build-data/teaching.json` 4d43d838aee040236449a6bf410b562b (unchanged)
- `levels/gallery.json` 65039b783eb6b25fcef2523e7dee963a → f10582638e7386daaf0df5eba79750f1 (levels 5, 26, 40, 54: `pal` and `convert` only; level 33 replaced)
- `levels/gallery-manifest.json` 3cbeeb7f3278078c6e47d038cb5ac382 → 390659b5215c80482890d9b6f0d660aa

## Screens (`tools/shots-v4-fix2/`, gitignored)

`before-*` from the critics' build (`138fd66` page, before any page edit), `after-*` from this pass; named `<tag>-<viewport>-<what>.png`, viewports 667 (375×667), 736 (414×736), 812 (375×812), 844, 1280, land (812×375), iframe, 640.
- V1: `*-667-teach-l62`, `-l76`, `-l77`; `*-736-teach-l62`, `-l76`, `-l77` (and 62/77 at every other size).
- V2: `*-<vp>-gal-win` (Pizza Slice's report; `after-land-gal-win` has the picture over the board), `*-812/667/1280-gal-win-painting` (Red Fuji), `*-<vp>-gallery-1` (one cleared, the next marked), `*-812/667/1280-gallery-3`.
- m1: `*-1280-paint-met-57007`, `-436528`, `-436534`, `-435882` (the queues), `before-1280-paint-met-437999` (Teapot), `after-1280-paint-noto-1f3c6` (Trophy).
- m2-m5: `*-<vp>-bar-broke` (10 coins), `*-<vp>-bar-half` (90 coins: Ladder and Recall short, Recall owned), `*-iframe-bar-*`, `*-land-bar-*`.
- m6: `*-<vp>-home-mid`. m7: `*-812/667/1280-map-top`, `-settings`. m8: `*-812/667/1280-win-report`. m9: `*-812/667/1280-l78-step13`.
- Harness screens and report: `tools/shots-v4-fix2/harness/`.

## Open

- Parked in LATER.md ("From v4 Critics 2"): m10 portrait crops, the siege win's banner and bin burst, a rebuild animation or a bigger picture on Gallery wins, a lighter panel behind the Gallery grid, the desktop Gallery sheet covering the bar's coin pill, the era card's coins wrapping at 375, the remaining painting pairs between 16 and 20, the critic's sapper-id label.
- Not touched: the critics' `diff-result.json` files change on every run (timings, and the Gallery's counts with slot 33); committed with the docs.
