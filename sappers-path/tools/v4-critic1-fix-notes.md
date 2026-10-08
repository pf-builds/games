# Sapper's Path v4: Critics 1 fix pass, notes

2026-09-30. Branch `sappers-path`, from `6bbd6e5`. Presentation and SPEC text only: no rule change, no rebake. Page: http://127.0.0.1:8491/sappers-path/?debug=1, cache tag `?v=19` everywhere (index.html, the font URL in style.css).

Inputs: `tools/critic-v4-1-visual.md` (1 blocking, 10 major, 8 minor) and `tools/critic-v4-1-functional.md` (PASS, 2 major, 4 minor, all SPEC text but the 3× march label). Decisions are logged in `SPEC-v4.md` §9 ("Critics 1 fix pass"); parked items are in `LATER.md` ("From v4 Critics 1").

Screens: BEFORE are the visual critic's own captures at `6bbd6e5`, copied to `tools/shots-v4-fix1/before/`. AFTER are `tools/shots-v4-fix1/after/` from `tools/shots-v4-fix1.mjs`, which also writes the measurements to `tools/shots-v4-fix1/measure.json`. Harness screens and report: `tools/shots-v4-fix1/harness/`.

## Verification

| Check | Result |
|---|---|
| `node tools/test.js` | 245 passed, 0 failed |
| `SP.selfTest()` | 788 pass, 0 fail at 375×812, 1280×720, 812×375, the 400×600 iframe and the hidden tab (was 761; the new checks are listed below) |
| `node tools/harness.mjs` | all passed, 0 console errors or warnings; frames p95 16.7-16.8 ms, max 16.8 at 1× and 3× (levels 65, 70, 100) |
| Smallest board cell per era (harness, all 100 boards) | 375: 14 / 13 / 13 / 10.5. 812: 10 / 10 / 10 / 9.33 (turned). 1280: 20 / 19 / 19 / 16. Iframe: 10 / 9.5 / 9.5 / 8.0 (level 76, with its coach band). All ≥ 8. |
| `node tools/regrade.js` | 100 levels, 755 checks, 0 differences |
| Functional critic's diff, `diff.mjs --patient 6 --rushed 5 && edge.mjs` | 3,744 games, 0 mismatching games, 0 grade mismatches; edge boards agree |
| `levels/` md5 | unchanged (below) |
| Console | 0 errors or warnings in every capture and harness run |

```
MD5 (levels/debug-v4.json) = bf16dce84f16a9dac42c35c1f961eb29
MD5 (levels/levels.json)   = 8c14f6087dc6a4b72fce9057017a8d2a
MD5 (tools/build-data/names.json)    = d55f5b04c5e819ebbf89a34639bd7e53
MD5 (tools/build-data/pools/pool-e1.json)  = 9aec1be5d491751ef1fbceee92c49637
MD5 (tools/build-data/pools/pool-e2.json)  = d6e6db978f5cfb9d9be4f8929836a1d4
MD5 (tools/build-data/pools/pool-e3.json)  = 464928833209b6294b8909126274460a
MD5 (tools/build-data/pools/pool-e4.json)  = 11c52c1c7265fbb9faf72736def42853
MD5 (tools/build-data/teaching.json) = 4d43d838aee040236449a6bf410b562b
```

New selfTest coverage (runs at every harness viewport): each teaching level's coach box off the board and its arrow off every count and the line head, at load and at every step of the stored order; the jam sheet's chips (one per jammed squad, its colour and count, no crew name in the text) and its aria-label; the fail sheet under the line and the win sheet over the whole line; the rods on v4-linked and v4-all after every tap of the stored order (every rod on its two tiles, never over a third) and no chain tag over any count; B1 (a linked pair leaving and at rest, and a full Easy line of working squads: every count clear of every badge); the queue rows stepping down at full opacity with their faded faces; the victory march label at 3×. Replaced, not deleted: the old opacity check (now faded face and size step), the jam text checks (now the aria-label plus chips), the coach "one line" check (now "fits its box, one line or two").

## Findings

### Blocking

**B1. Chain badge and stuck men over a linked squad's count.** Fixed. A holding space is now a CSS grid: the count in the right column, the badges in the left (stuck lock or working marker on top, chain or walking figures below). The figures hide when the squad is stuck or linked. Where a space is too narrow for both side by side (six spaces on a phone, the short landscape rail), `#line.tight` (set by `fitLine()` at layout from the space's width and the fonts in use) puts the badges on top and the count bottom right. Badge sizes are CSS variables per layout (`--bd`, `--lk-s`, `--out-n`).
Measured: count glyph box (a Range, as the critic measured) against the chain, the working marker, the figures and the stuck lock: 0 px overlap in every space, at all four viewports, for the linked pair leaving (350 ms) and at rest, a full Normal line and a full Easy line (6 spaces) of rushed squads with 2-digit counts. Before: the chain covered 14×18 of "3", and 15×18 (chain) plus 10×18 (figures) of "21". Screens: `375-linked-leaving`, `375-linked-stuck`, `375-easy-full-line`, `400-linked-leaving`.

### Major

**M1. Dark lower screen.** Fixed. The holding line and the queue sit on one light stone tray (`--tray #ddd3c0`, set from `layout.fade.tray`, ink rim, lit top, shaded foot); the brick stays as the margin. Empty spaces are recessed sockets (`--socket`); the head's words are dark on the tray with darker full, near and march colours. The board and field are untouched. Screens: `375-l8-rest`, `375-l40-rest`, `375-l64-rest`.

**M2. Muddy back rows.** Fixed. No opacity anywhere in the queue. Row d's face is its colour with `layout.fade.t[d]` of the tray mixed in (0.1, then 0.2; sRGB, `mixHex` in main.js), flat, with a rim of its own colour toward ink, and a size step (`--s1` 0.9, `--s2` 0.8 of the tile's width, height and count). `tools/fade.js` (same mix as the page) over all 104 levels:

| Faded tile vs front tile | Row 1 | Row 2 | Critic's before |
|---|---|---|---|
| Ashlar (white) vs Rubble stone | 26.0 | 25.4 | 8.9 (.38), 10.3 (.66) |
| Thatch (yellow) vs Gilt | 26.2 | 25.8 | 10.5 (.66) |
| Brick (lime) vs Hedge | 25.5 | 24.9 | 10.2 (.66) |
| the other way: Rubble vs Ashlar, Gilt vs Thatch, Hedge vs Brick | 24.4, 23.7, 23.7 | 22.5, 21.5, 21.6 | |
| smallest of all 312 ordered pairs dealt together | | Slate (row 2) vs Crystal 20.0 | |

Pairs under 20: 0. A stronger, Food Hunt-style pastel fade was measured and rejected: 0.3/0.55 keeps the critic's three pairs at 23.4-25.5 but puts 12 of 312 pairs under 20, the worst Roof tile (row 2) vs Timber at 12.8, and the reverse pairs at 16.6-17.5 (`node tools/fade.js --t 0,0.3,0.55`; parked in LATER). Depth reads from the size step, the flat face and the soft rim. Mystery tiles (m4) are now a face-down card (see Minors), so they no longer vanish. Screens: `375-teach-l62`, `375-l64-rest`, `375-v4-all-rest`.

**M3. Rods.** Fixed, presentation only (`linkRowGap` and the dealer untouched). Rods run centre to centre over the faces and under the counts (the counts sit above the SVG; to keep that true no tile is a stacking context: no opacity, transform or filter on tiles, and a blocked card is dimmed by a veil instead of a filter). 8 px thick with a 10 px rivet on each tile where the rod leaves it (`layout.rod`, scaled with the tile). Neighbouring columns at most one row apart: straight (a diagonal passes the four-tile corner). Two rows apart: an elbow down the gutter between the two columns. Partner below the visible rows: down the gutter past its column's last row, then two dots. Every linked tile wears a small chain tag on the bottom corner away from its rod, and its count steps away from the tag.
Measured (`measure.json`, the critic's scan plus endpoint check, along each level's stored Normal order): 0 rod samples over a third tile on all 19 linked levels plus the 2 debug levels at 375 (before: 67, 71, 82, 89, 91 and v4-all crossed), and on 62, 67, 71, 77, 82, 89, 91, 100 and the debug levels in the 400 iframe. selfTest checks v4-linked and v4-all after every tap, and that no chain tag covers any count. Screens: `375-linked-rest`, `375-rods-l67/71/82/89/91`, `375-v4-all-rest`.

**M4. Coach banner over fort blocks.** Fixed. A level with a coach keeps a `--coach-h` band for the whole level (no layout jump when the coach ends). Portrait: above the board if the board still gets `layout.minCellCss` (8) CSS px a cell with the band, else the coach sits over the level's name in the top bar. Wide screens: its own spot in the side column (`#coach-dock`). The coach is placed from its band's rect (fixed) and fits one line, else two (m3).
Measured, all nine teaching levels at each viewport: coach over the board 0 px everywhere (before: 36 px and 40 fort cells on the iframe's level 62; 12 cells on 35 at 812; 2 at 375 and 1280). Modes: 375 and the iframe "above" (iframe level 77 "top", 2 lines), 1280 and 812 "side". Cells with the band: 375 levels 62/76/77 at 13.67/11.33/10.33; iframe 62/76 at 9.5/8.0; iframe 77 (top) 8.5. Screens: `400-teach-l62`, `400-teach-l35`, `400-teach-l76`, `400-teach-l77`, `375-teach-l62`, `812-teach-l35`, `1280-teach-l62`.

**M5. Coach arrow over counts.** Fixed. A queue tile gets the arrow from the side at its middle (from the left; from the right in the first column), scaled (`layout.hand.sideScale` 0.56) with a shorter bob (`--bob` 4 px), over the neighbour's empty edge. A space gets it from above and the head's count steps aside (`--cnt-shift`); the whole line gets it over the head's gap between label and count, or no arrow (the line glows). Measured: the arrow's box at the far end of its bob against every count shown and both head labels: 0 overlaps on all nine teaching levels at four viewports, and at every coached step of the stored orders (selfTest). Screens: `375-teach-l35`, `375-teach-l76`.

**M6. Archer rings.** Fixed. At rest a ring is a faint dash (`board.ring`: 1 CSS px, 25% alpha, 4/4 dash). It turns loud (the old stroke) while it matters: a colour the player can send now (front cards and squads in the line, passed as `V.hot`) has a block in reach inside it (worked out once per board change, allocation-free), its archer shoots or has just hit someone (`show.labelMs`), or the coach points at a tower (level 51). Rings ease over `board.ring.fadeMs`. The ground tint inside a ring stays. Screens: `375-l100-boss` and `400-l100-boss` (the boss's eight rings quiet), `375-teach-l51` (loud, the lesson), `375-archer-hit` (level 52: the shooting towers' rings loud, the label).

**M7. Bins read as a legend.** Fixed (critic's first option). A bin draws only once its colour has hauled a block and grows in over `board.binGrowMs` (260). At rest the yard is bare ground. Screens: `375-l64-rest` (bare), `375-l64-mid` (the hauled colours' bins).

**M8. Jam sheet names crews the player can't see.** Fixed. The sheet shows one chip per jammed squad in its colour with its count (glyph too in colour-blind mode), up to `layout.jamChips` (6); the crew names are the sheet's aria-label. The linked jam reads "Line jammed: linked squads need 2 free spaces, and [chips] can't reach a block." The short sheet shows a chip without a count. Screens: `375-jam-sheet`, `375-linked-jam-sheet`.

**M9. Sheets slice the holding line at 375.** Fixed (`placeSheet()`). A fail sheet starts 6 px under the line (text stepped down, `.tight`, when the room is short), else floats above the line over the board's foot (`.float`); a win sheet covers the whole rail. Same inside the side column on wide screens. Measured: 375 jam sheet 634-812 against the line 578-628 (before: sheet from 601, line 576-626); 375 win 548-812 covers it; iframe jam floats 257-412 above the line 435-471; 1280 and 812 below the line. Screens: `375-jam-sheet`, `375-win-sheet`, `400-jam-sheet`.

**M10. Desktop 16:9.** Fixed. The top bar and rail sit in one side column (`#side`) the frame's height (`--blk-h`, set when the board is fitted), top-aligned with it; board and column are centred as one block; the column's foot keeps `--pw-h` (84 px) free for M5's power-up bar (`#powers`, empty, no buttons). Measured at 1280×720: top and bottom aligned to 0 px on levels 40 and 100; board + column cover 76% (level 40) and 79% (level 100) of the screen (before 55%); gaps left/right 122/119 and 103/100 px; 0 buttons in the reserve. Screens: `1280-l40-rest`, `1280-l100-boss`.

### Minor

- **m1** fixed: the full line's head reads "Line full" (`layout.fullText`); the toast still says to wait. Screen `375-line-full`.
- **m2** fixed: at max-height 480 the title's colour-blind toggle is icon-only (its aria-label stays) and the logo is smaller and higher. Screen `812-title`.
- **m3** fixed with M4: the coach fits one line or two, sized to the band, not the board.
- **m4** fixed: a hidden card is a face-down card (`layout.mystery.c #2b3566`, gold lattice and rim, a big gold "?" before its count); nothing of the hidden colour in the DOM (selfTest's leak check unchanged and passing, colour-blind off and on). Its back is ΔE00 19.2 or more from every material. Screens `375-mystery-rest`, `375-v4-all-rest`.
- **m5** parked (the win's banner and bin burst, a whole-camp victory march): juice for M5.
- **m6** fixed: locked map nodes at 45% with a padlock; the sticky Play bar has a solid backdrop to the screen's foot. Medal colours per difficulty left as they were (a won node is gold with its E/N/H letters). Screens `375-map-top`, `375-map-era4`.
- **m7** fixed: the space key wears a pulsing dashed cream square (`board.lockKey.dash`), the same dash as the locked space's rim; gate tints are cyan and violet (`board.gateTints`, no cream or yellow); coach lines for 76 and 77 say "dashed box". Screen `375-crop-lockkey`.
- **m8** parked: the colour-blind toggle belongs in M5's settings sheet and a pause menu.

### Functional (SPEC text)

All written into `SPEC-v4.md` §9 (Critics 1 entry), from the engine's code: the squad turns wary the moment the sapper sent at a covered pixel is sent; hit at dispatch + yardMs + ceil(tiles/2)·tileMs; Easy/Normal home at hit + knockMs + yardMs + ceil(tiles/2)·tileMs; the disc is (x−cx)²+(y−cy)² ≤ r² (edge covered) around the mean of the tower group's cell coordinates; short compares the colour's unspent sappers (deck total less pops less kills: tray, waiting, out) with its standing pixels at every kill; `grade.ms` is the engine time when the patient replay is quiet after its last tap (everyone home after the win). The 3× march label fix is in `main.js` (`renderLine`: the pace in use) with a selfTest check.

## Files

- `index.html`: `#side` wraps the top bar and the rail (dissolved on phones); `#coach-dock`, `#powers`; `?v=19`.
- `style.css`: tray variables and panel; slot grid and tight layout; queue fade/size/rim; mystery card; chain tags; counts above rods; coach box and modes; hand bob variable; sheet modes and chips; map minors; wide side column (M10); per-layout sizes.
- `src/main.js`: `fades()` / `paintMat(el, m, d)`; `drawRods()` rewritten; `sendable()` → `V.hot`; `fitLine()`; coach `placeCoach()`, `fitCoach()` (two lines), `placeHand()` (side / slot / line / ring); `fitBoard()` coach modes and `--blk-h`; `placeSheet()`; `sheetLine()` chips; march label; new selfTest checks.
- `src/board.js`: `fit()` / `fitCs()`; rings quiet or loud (`hotNow`, `V.ringA`); bins grow in; lock key dashed square.
- `config.json`: `board.ring`, `board.binGrowMs`, `board.lockKey` (dash, out), `board.gateTints`; `layout.fade`, `minCellCss`, `hand`, `jamChips`, `rod`, `mystery.c`, `fullText`, `fixNote`; two coach lines.
- `tools/fade.js` (ΔE00 of the fade), `tools/shots-v4-fix1.mjs` (screens and measurements), `tools/harness.mjs` (coach fits, jam chips and whole line).

## Fix 2 (after the visual critic's re-check of `bec1975`)

The critic's "Re-check (after fix pass)" section of `tools/critic-v4-1-visual.md` found 2 new majors (N1, N2) and 3 new minors (N3-N5), all side effects of the first pass. All five fixed; cache tag `?v=20`. After screens: `tools/shots-v4-fix1/after2/` (measurements `tools/shots-v4-fix1/after2-measure.json`, harness `tools/shots-v4-fix1/harness2/`). Decisions: `SPEC-v4.md` §9, "Critics 1 fix 2".

| Check | Result |
|---|---|
| `node tools/test.js` | 245 passed, 0 failed |
| `SP.selfTest()` | 791 pass, 0 fail at all four viewports and the hidden tab |
| Harness | all passed, 0 console errors; smallest cells per era 375: 14 / 13 / 13 / 10.5, 812: 10 / 10 / 10 / 9.33, 1280: 20 / 19 / 19 / 16, iframe: 10.5 / 9.5 / 9.5 / 8.0 |
| `node tools/regrade.js` | 0 differences |
| Functional critic's diff | 3,744 games, 0 mismatching |
| `levels/` md5 | unchanged (same as above) |

- **N1 (major), rods and rivets through the counts.** Fixed. Rivets sit on the rim of each tile's edge facing the partner, and the rod runs only in the gaps: straight where that line meets no tile, else down the column gutter. No part of a rod touches a tile face. Rod geometry also comes from layout offsets now, since a rod drawn while a mystery card was mid-flip had used that tile's zero-width rect. The critic's own scan (`visual-rivets.mjs` logic, in `shots-v4-fix1.mjs` as `rivets`), 543 queue states along every linked level's stored Normal order, gives 0 rivets on a count's glyph box and 0 rod samples inside one at 375×812, 1280×720 and the 400×600 iframe (before: 123 and 1,626 at 375). The third-tile scan is still 0. selfTest adds `rodGlyph()` on v4-linked, v4-all, 62, 67 and 89 after every tap. Screens: `after2/375-rods-l67.png` .. `l91`, `375-teach-l62.png`, `375-v4-all-rest.png`.
- **N2 (major), blank desktop tray.** Fixed. On wide screens the tray ends at the queue; `#powers` (M5's spot, empty) moved out of the tray to the column's foot; the rest of the column shows brick. Top alignment kept (0 px at levels 40 and 100). Blank tray below the queue at 1280×720: 3 px, 0.4% of the column (was 204-215 px, about 46%); the tray and top bar now fill 49% of the column. Screens: `after2/1280-l40-rest.png`, `1280-l100-boss.png`.
- **N3 (minor), rows don't step back.** Fixed. Rows 2 and 3 sit on tray bands with 6% and 12% black (`layout.fade.band`), each with a 1 px light shelf edge. Tile faces unchanged: `tools/fade.js` still gives 0 of 312 pairs under ΔE00 20 (smallest 20.0); a faded tile against its band is 11.3 or more.
- **N4 (minor), iframe level 77's coach.** Fixed. In the top bar the coach starts after the level number (number overlap 0 px), sits 3 px inside the bar and is one line; level 77's steps have `short` lines ("Linked squads: 2 spaces.", "Space key: the dashed box.", "? squads turn at the front.") that fit at 19 px, 17 px and 17 px. selfTest now also checks that the coach fits its box at every step of the stored orders. Screen: `after2/400-teach-l77.png`.
- **N5 (minor), bare yard.** Fixed without changing the yard's size (no board loses a cell). At rest the yard holds an empty wooden crate per colour (`board.crate`, no colour); a colour takes the next crate from the left on its first sapper out, and its bin grows in there on the first haul, so bins pack left to right in first-use order. Screens: `after2/375-l40-rest.png` (crates), `375-l64-mid.png` (packed bins).
- Left alone: the critic's re-check edits to `tools/critic-v4-1-visual.md` and `tools/shots-v4-critic1/visual-shots.mjs` (the critic's working tree, not mine). `tools/critic-v4-1/diff-result.json` was regenerated by the required diff run (0 mismatching games).
