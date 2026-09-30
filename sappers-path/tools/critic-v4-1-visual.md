# Sapper's Path v4, Critics 1: VISUAL critic

HEAD `6bbd6e5` (branch `sappers-path`), served on :8493. 2026-09-30.

**Portal verdict: not rejected on sight. It reads as a finished, coherent mid-tier web game. Next to Food Hunt it looks darker, busier and cheaper. CrazyGames would likely take it at a basic tier once B1 is fixed. Poki would pass on the look.**

**Counts: 1 blocking, 10 major, 8 minor.**

- selfTest: `SP.selfTest()` gives 761 pass, 0 fail, 2.3 s. No console errors or warnings in any capture run.
- Captures: `tools/shots-v4-critic1/visual/`. There are 99 PNGs at 375×812 (dpr 3, touch), 1280×720, 812×375 (dpr 3, touch) and the 400×600 iframe host (dpr 2).
- Contact sheets: `visual/sheets/s1..s10`.
- Scripts: `tools/shots-v4-critic1/visual-shots.mjs` (captures and the rod scan) and `visual-measure.mjs` / `visual-measure2.mjs` (DOM measurements). Measurements are in `visual/notes.json`.
- One capture failed because of a bug in my own script: the single 375 swarm frame. The six-frame swarm strip covers it.

---

## 1. Blind framing (sheet `s1-blind.png`: Food Hunt 5, Food Hunt 7, `375-l88-rest`, `375-l40-rest`)

**Food Hunt looks like the finished portal game on sight.** The visible reasons:

- **Value key.** The chrome is light: warm wood and cream. Every saturated colour pops against it, and the faded back rows go pastel but keep their hue.
- **One focal object.** The picture fills the top half, and there is air around it. Nothing else draws the eye.
- **Four clean tiers.** Picture, then 5 white slots, then a 4×3 queue, then the power-up bar. Each tier has its own band and spacing.
- **Chunky tiles.** They are soft and 3D, with big white numbers and a drop shadow. The UI is rounded and consistent everywhere.
- **Product signals.** The power-up bar has illustrated icons and green "+" buy badges, and there is a 3× pill and a gear. It looks complete and monetised.
- **Almost no text on screen.** Only "Level 1492".

**Sapper's Path looks like a competent indie or jam game.** The visible reasons:

- **Dark chrome.** About 65% of the phone screen is dark brick (`--bg #2e2935` plus wall texture). On l40 the bottom third is five black sockets and dark brick, which reads as a void.
- **The board carries a lot of small detail.** Tree dots, grass tufts, dashed archer rings (M6), and a strip of 6–12 bins that reads like a colour legend (M7).
- **Muddy back rows.** Queue rows 2–3 fade by opacity over the dark wall, so they turn murky and change hue (M2).
- **Small, dim labels.** "Squads out" and "5 free" are small grey pixel-font labels, and the top bar holds 5 buttons plus the level name. There is more text and more chrome than in Food Hunt.
- **No product signals yet.** No power-ups and no economy. That is expected until M5, but it is part of why it reads unfinished.
- **Tile quality is not the problem.** The front tiles, the flat studs and the palette hold up well against Food Hunt. The gap is the chrome, the clutter and the back rows.

**Plain answer:** a portal would not reject Sapper's Path on sight. Nothing looks broken at a glance, apart from B1, which only appears once linked squads are stuck. It would not be featured on looks. The desktop 16:9 layout that portals open first (M10) is the weakest view.

---

## 2. Findings

### BLOCKING

**B1. A linked squad's count is hidden under its chain badge.**
- **Screenshots:** `375-linked-leaving.png` and sheet `s5-375-twists.png`, bottom left.
- **Repro:** `?debug=1`, `SP.load("v4-linked","normal")`, `SP.tick(40)`, tap the first `.tile.card.linked` (column 1), then `SP.tick(350)`.
- **Measured at 375** (`visual-measure2.mjs`):
  - The first slot's count "3" has a glyph box of 14×39 px. The 18×18 `.lk` chain covers 14×18 of it, so the whole top half of the digit is gone.
  - The second slot's "21" has 15×18 covered by the chain and another 10×18 covered by the stuck men.
  - This is the core number of an M2 feature, and it is unreadable every time a linked pair sits in the line.
- **Fix:**
  - Move the chain to the bottom-left corner, under the lock: `.slot.linked .lk { top:auto; bottom:3px; left:3px; width:14px; height:14px }`.
  - Keep the count right-aligned with `padding-right:6px`.
  - In the stuck state, keep `.men` inside the left 40% of the slot, or hide them. Stuck men carry no information the hatch and lock don't already give.
  - Re-check with a 2-digit count (21) in a 69 px slot, and in the 400×600 iframe (74×36 slot, 26 px count).

### MAJOR

**M1. The dark chrome puts the whole lower screen in a low value key.**
- **Screenshots:** `s1-blind.png`, `375-l40-rest.png`, `375-l8-rest.png`.
- **What's wrong:**
  - The rail (line and queue) sits straight on the dark brick wall.
  - Empty sockets are near-black (`#1b1720`-ish) on dark brick, so five empty sockets read as holes, not slots.
  - Food Hunt's slots are white on light wood.
- **Fix:**
  - Put the holding line and the queue on one warm stone or parchment tray panel (about `#e6dbc4` face, `#b39c74` 3 px border, 10 px radius).
  - Make empty sockets a lighter recessed tone, `#cbbd9f` with a 2 px inner shadow, not black.
  - Keep the brick only as the page margin behind the board and the tray.
  - This keeps the siege skin (the board and field are untouched) and fixes most of M2 as well.

**M2. Faded queue rows lose their colour identity over the dark wall.**
- **Screenshots:** `375-teach-l62.png`, `375-l64-rest.png`, `375-teach-l76.png`, `375-v4-all-rest.png`. The fade is `.next.d1 {opacity:.66}` and `.d2 {opacity:.38}` over `#2e2935`.
- **ΔE00 between a faded tile and a full front tile of a different colour** (both in the same level's queue):

  | Faded tile | Looks like this front tile | ΔE00 | Levels where both appear |
  |---|---|---|---|
  | Ashlar (white) at .38 | Rubble stone (grey) | 8.9 | 60 |
  | Ashlar (white) at .66 | Rubble stone (grey) | 10.3 | 60 |
  | Thatch (yellow) at .66 | Gilt | 10.5 | 60 |
  | Brick (lime) at .66 | Hedge | 10.2 | 36 |

- **In play:** on l62, the white-faded "36" in column 0 row 2 reads as the same grey material as the "19" front tile above it.
- **Contrast with the background:** Rubble stone at .38 is only ΔE00 13 from the page background. The mystery tiles at .38 ("?9", "?14" on `v4-all`) nearly vanish.
- **Fix:**
  - Stop fading by opacity. Draw d1 and d2 at full opacity with `filter: brightness(.82) saturate(.9)` and `brightness(.64) saturate(.8)`, and step the scale (d1 `scale(.94)`, d2 `scale(.88)`) so depth still reads.
  - Keep the count at full-opacity white.
  - With M1's light tray you could instead copy Food Hunt: fade toward the tray colour (a pastel) rather than toward black.

**M3. Linked rods are 16 px nubs at a four-tile corner, and some cross a third tile.**
- **Screenshots:** `375-linked-rest.png`, `375-teach-l62.png`, `375-teach-l77.png`, `375-l100-boss.png`, `375-v4-all-rest.png`, and the zoom in `s9-zoom.png` bottom right.
- **Short rods are ambiguous:**
  - Measured at 375, each adjacent-row rod is a 16 px path (3 strokes at 11/7/1 px) that sits in the gap where four tiles meet.
  - On l62 the only thing that tells 17↔36 apart from 19↔12 is whether a 16 px stub leans "/" or "\".
  - Food Hunt's rod is long and lands on both tile faces.
- **Some rods cross a third tile:**
  - The rod scan (every linked level, along its stored Normal order) found a rod over one or two tiles that are not its own in levels 67, 71, 82, 89, 91 and `v4-all`.
  - These are 80 px diagonals between rows 0 and 2 of neighbouring columns. They pass over both d1 tiles, e.g. `v4-all` at rest: "14" to "?14" crosses "?26" and "?13".
- **Fix:**
  - Draw every rod centre to centre, below the count layer but above the tile face, so it visibly lands on both tiles.
  - Make it 8 px thick with a 10 px rivet disc on each tile.
  - Add a small chain badge (12 px, top-right) on both linked tiles so the pair reads even without the rod.
  - For partners two rows apart, route the rod as an elbow through the 6–8 px column gutter instead of across tiles, or tighten `v3.twists.linkRowGap` to 1 in the dealer.

**M4. The coach banner hides fort blocks, and it stays up after the player taps.**
- **Screenshots:** `400-teach-l62.png`, `400-teach-l35.png`, `400-teach-l76.png`, `812-teach-l35.png`, `375-teach-l62.png`, `1280-teach-l62.png`.
- **Measured** (`visual-measure.mjs`; coach rect against the board's grid rows, using each level's grid):

  | Viewport | Level | Coach overlap | Fort rows covered | Fort cells hidden |
  |---|---|---|---|---|
  | 400×600 iframe | l62 | 36 px | 3 | 40 |
  | 400×600 iframe | l35 | | 2 | 12 |
  | 400×600 iframe | l76 | | | 9 |
  | 400×600 iframe | l77 | | | 12 |
  | 812×375 | l35 | | | 12 |
  | 375, 1280 | l62 | | | 2 |

- **It persists:** on l62 in the iframe the coach was still showing after 4 s idle, then after 2 taps with 3 s of ticks each.
- It also cuts the archer ring on l62.
- **Fix:** subtract the coach's height plus 6 px from the board's fit height whenever a level has a coach line, so the banner sits above the frame, not on it. Alternatively, dock the coach under `#top` outside `#frame`. At `max-height:640`, drop the coach to 16 px on one line.

**M5. The coach arrow covers other information.**
- **Screenshots:** `375-teach-l35.png` and `375-teach-l76.png` (sheet `s3`), `1280-teach-l76.png`, `400-teach-l76.png`.
- **l35:** the arrow points at the row-2 "?29" tile, but its shaft sits on the front tile's "27" count, which is the tap target right above it.
- **l76:** the arrow over the locked socket sits on the line head's "4 free", which reads as "ree".
- **Fix:**
  - For a back-row target, bring the arrow in from the left side of the tile, pointing right, and never across a row above.
  - For the socket, place the arrow above the socket's top edge and nudge `#line-cnt` left by the arrow width while the arrow shows. Or give the arrow `z-index` below `#line-head` and a 10 px offset.

**M6. Archer range rings clutter Era 3–4 boards.**
- **Screenshots:** `375-l100-boss.png`, `400-l100-boss.png` (8 px cells, zoom in `s9`), `1280-l100-boss.png`, `375-teach-l77.png`, `375-l88-rest.png`.
- **What's wrong:**
  - The boss draws 8 overlapping dashed red circles across the entire castle.
  - At 8–10.7 px cells they cross grey walls, red blocks, gates and keys, and the castle stops reading as a plan.
  - This is the single biggest source of noise on the late boards.
- **Fix:**
  - Draw a ring only while it matters: while a squad whose colour lies inside the ring is in the line, or on long-press or hover of a tower.
  - Otherwise use a 1 px, 25%-alpha dash.
  - Or draw only the ring the next front card's path enters.

**M7. The yard bins read as a colour legend.**
- **Screenshots:** `375-l64-rest.png`, `375-l100-boss.png` (two rows of 6), `375-teach-l76.png`, `812-l100-boss.png` (on a turned board they become a sidebar column).
- **What's wrong:**
  - 6–12 wide boxes sit inside the board frame, each with a small block label and a dark inside.
  - At rest they are empty and look like a palette key or a debug strip. They take about 40 px of board height on l100 and compete with the queue for the eye.
- **Fix:**
  - Show a bin only once its colour has hauled something, and grow it in.
  - Or collapse the bins into one 6 px progress strip per colour along the yard edge.
  - Or move them out of the frame, below it and above the line, at 60% size.

**M8. The jam sheet names crews the player can no longer see.**
- **Screenshots:** `375-jam-sheet.png`, `1280-jam-sheet.png`, `400-jam-sheet.png`.
- **What's wrong:** the sheet says "Line jammed: Axemen, Stonecutters, Torchbearers and 1 more can't reach a block." Since M1 no tile or slot shows a crew name (colour-first, plan decision 4), so the player can't map "Axemen" to a colour.
- **Fix:** replace the names with inline colour chips, e.g. a 14 px swatch in the material's colour with the count ("■44 ■18 ■9 can't reach a block"). The crew names can stay in `aria-label`.

**M9. At 375 the jam sheet slices through the holding line.**
- **Screenshot:** `375-jam-sheet.png` (sheet `s4`, bottom left).
- **What's wrong:** the panel starts at y 601, but the line spans 576–626. The top 25 px of the five stuck slots peek above the sheet with half-cut counts. It looks like a layout mistake, and it hides the cause of the loss.
- **Fix:** anchor the fail sheet's top to `#line` bottom + 6 px, so the whole jammed line stays visible above the sheet and the sheet covers only the queue. Or cover from `#line-wrap` top. Do the same for the win sheet (`panel` top 582 at 375).

**M10. The desktop 16:9 layout parks a phone UI in a brick void.**
- **Screenshots:** `1280-l40-rest.png`, `1280-l100-boss.png` (sheet `s6`). Portals open games at 16:9 desktop first.
- **Measured:** the board and rail cover 55% of 1280×720. The rail (header, line and queue: 520×427, from y 146 to 574) floats vertically centred, with bare brick above and below. The header sits mid-screen, not level with the board top.
- **Fix:**
  - Top-align the rail column with the board (header top = board top, 18 px).
  - Stretch the rail column to the board's height (684 px), with the line and queue under the header.
  - Reserve the bottom of the column for the M5 power-up bar, aligned to the board's bottom edge.
  - Centre board plus rail as one block, and put M1's light tray behind the rail.

### MINOR

**m1. The line head is crowded at 375.**
- **Screenshots:** `375-line-full.png`, `375-refused.png`.
- **Measured:** "Line full: wait for a squad to come home" (237 px) and "3 stuck · 2 working" (110 px) sit 8 px apart at 17 px. In the 400 iframe the head drops to 14 px.
- **Fix:** make `fullText` just "Line full". The toast already says "wait for a squad to come home".

**m2. The landscape title is cramped.**
- **Screenshot:** `812-title.png`.
- **What's wrong:** the "Colour-blind" button wraps to "Colour- / blind", and the logo sits over the keep's flag.
- **Fix:** at `max-height:480`, show the colour-blind toggle as an icon-only square (44×44) with its `aria-label`, and move the logo 24 px up or scale it to 0.85.

**m3. The coach text clips on narrow boards.**
- **Screenshot:** `812-v4-all-rest.png` shows "Mystery, linked squads and a locke" (overflow measured).
- **What's wrong:** the coach's width is tied to the board's width (192 px), and `fitText` stops at its minimum size. This case is a debug level, but any long line on a narrow or turned board will clip.
- **Fix:** allow 2 lines (`white-space:normal; -webkit-line-clamp:2`), or size the coach to the stage width instead of the board width.

**m4. Mystery tiles read as "disabled", not as a hidden card.**
- **Screenshots:** `375-mystery-rest.png`, `375-v4-all-rest.png`, `s9` zoom.
- **What's wrong:** the tile is dark hatched grey with a "?" at 22.4 px (56% of the 40 px count), set like a superscript in the top-left corner. In row 3 the tiles nearly vanish (see M2).
- **Fix:**
  - Make the mystery face a light neutral (`#d9d0e2`) with a dark "?" as the main glyph (60% tile height) and the count beside it.
  - Or use a playful face-down pattern (diagonal gold dots), so it reads as a card turned over, not as greyed out.

**m5. The win and the victory march have little payoff.**
- **Screenshots:** `375-win-sheet.png`, `1280-win-sheet.png`, `375-march-f0..f5.png` (sheet `s10`, bottom row).
- **What's wrong:**
  - The win sheet sits over an empty brown rectangle.
  - The "Victory march ×1.5" is 6–8 white sappers drifting across empty dirt. It reads as the last squad finishing, not a march.
  - The swarm itself reads well: 55 sappers leave as a column and fan onto the bite front (sheet `s10`, top row).
- **Fix:**
  - On the win, plant a banner sprite in the razed ground and burst the bins (particles from each full bin).
  - For the march, send every crew out of the camp in one column across the field and back.

**m6. The map doesn't show which levels are locked, and text shows under the sticky bar.**
- **Screenshots:** `375-map-top.png`, `375-map-era4.png`.
- **What's wrong:**
  - Locked level nodes (2–100) are the same grey button as an open one, with no padlock or dimming. Only "1" is highlighted.
  - The sticky "Play level 1" bar lets the era text show underneath it ("fenced yard." below the button at 375).
  - The map is a spreadsheet grid. That's acceptable for now, but M5 should give it a path.
- **Fix:**
  - Locked nodes at 45% opacity with a 12 px padlock.
  - Completed nodes show their medal colour.
  - Give the sticky bar a solid backdrop down to the screen bottom (`padding-bottom: env(safe-area-inset-bottom)` plus the background).

**m7. The space key and a gate key differ only in a 2 px outline.**
- **Screenshots:** `375-crop-lockkey.png` and `375-crop-gatekey.png` (both magnified in `s9`), `375-teach-l76.png`.
- **What's wrong:**
  - At 2× the space key's cream corner brackets and the gate key's closed ring are clearly different.
  - At 1× on 13–17 px cells, both read as "a key block with a light outline". Only the space key's pulse separates them.
  - When a gate's tint is yellow (l40's upper gate), the ring colour sits close to the cream.
- **Fix:**
  - Draw the space key's marker as the same dashed square as the locked socket (2 px cream dash, matching `.slot` dashed border), so it visibly rhymes with the socket it opens.
  - Exclude cream and yellow from gate tints.
  - Optional: a tiny socket pictogram replacing the key glyph on the space key.

**m8. With colour-blind mode off, some pairs are indistinguishable in grey or for colour-blind players.**
- The pairs below are palette pairs that appear in the same level's queue (78 such pairs; counts are the number of levels).
- **Grayscale, |ΔL\*| < 1:**

  | Pair | Levels |
  |---|---|
  | Palisade / Slate | 24 |
  | Hedge / Gilt | 53 |
  | Thatch / Brick | 43 |
  | Warded stone / Crystal | 31 |
  | Timber / Rubble stone | 69 |

  In `s9`'s grayscale l88, the pink and grey front tiles are identical.
- **Deuteranopia (Machado 1.0), ΔE00:**

  | Pair | ΔE00 | Levels |
  |---|---|---|
  | Palisade / Hedge | 1.3 | 39 |
  | Hedge / Gilt | 3.0 | |
  | Palisade / Gilt | 3.2 | |
  | Thatch / Brick | 3.3 | |

  9 pairs are under 12.
- **Protanopia:** Thatch / Brick 3.1; 5 pairs under 12.
- **Tritanopia:** Warded stone / Crystal 5.6.
- **Colour-blind mode fixes all of this.** Its glyphs are legible at 13 px (`375-cb-l88.png`, `375-cb-l100.png`, `1280-cb-l88.png`).
- **Fix:** keep the palette. Add the colour-blind toggle to the M5 settings sheet and the pause menu, not only the title and map. Consider offering it once after a jam where two stuck squads were a low-ΔE pair.

### Checked and fine
- **Near-jam warning** (`375-near-jam.png`, `812-near-jam.png`): the head turns salmon, reads "One space left", and the last free socket gets a red outline. Clear at all sizes.
- **Refused tap** (`375-refused.png`, `400-refused.png`): the blocked lock badges on the front tiles and the cream toast are readable.
- **Stuck and working slots:** hatch plus lock, and gold rim plus walking men with "▲n" out. They read, except for B1.
- **Locked socket:** the dashed socket with a padlock, and the open padlock after the unlock (`375-locked-before/after.png`), are clear.
- **Counts:** 40 px front counts at 375 (28 px in the iframe) are readable everywhere.
- **Iframe queue:** nothing is clipped at 400×600 (tray bottom 594 of 600).
- **Castles at rest:** Eras 1–3 (l8, l40, l64) read as top-down forts. l88 reads as concentric rings. l100 would read once the rings are gone (M6).
- **Boss at 8 px in the iframe:** the studs, seams and colours still separate.

---

## 3. What the M5 home screen and power-up bar must match (Food Hunt shots 5–6)

**Power-up bar (Food Hunt 5):**
- **Layout:** a full-width band of its own under the queue, with 4 round badges about 64 px across. Each has a large illustrated icon on a light disc, and a green "+" buy badge (or an owned count) at the bottom-right.
- **Size:** the icons are bigger than any tile. They are the only round shapes on screen, so they read as a different class of control.
- **Theme:** keep our skin, e.g. +1 space, scout (reveal a "?"), petard (blast a 3×3), trebuchet (clear one colour).
- **Space budget, 375×812:** the rail is 264 px today. A 72 px bar takes about 3 px a cell from the boss (10.67 to about 9.5). Decide whether the bar replaces the third queue row on short screens.
- **Space budget, 400×600 iframe:** there is no spare room (tray bottom 594 of 600). Plan the bar there explicitly: two queue rows at `max-height:640`, or power-ups in the top bar as 36 px icons.
- **Desktop:** the bar anchors the bottom of the rail column (M10).
- **No dead buttons.** Unowned powers show the "+" state, never a disabled grey.

**Home screen (Food Hunt 6):**
- **One dominant Play button:** green or gold, about 70% width, about 64 px tall, labelled with the next level ("Level 41").
- **Hero:** the level number or picture as the hero in the middle. Our title castle scene is the one screen already in Food Hunt's bright value key, so build the home on it, not on the brick.
- **Top row:** settings gear (sound, speed, colour-blind), era progress (x/100), and lives or coins only if `meta.lives` is on (off on the web).
- **Bottom tab bar:** 3 tabs (Siege map, Home, Gallery). Gallery shows a padlock until level 25.
- **No text paragraph.** The current title card's 5-line story goes to a first-run coach or the map.
- **Shared style:** the same rounded chunky button style as the in-game controls, one accent colour for primary actions, and white numerals with drop shadows.

---

## Re-check (after fix pass)

HEAD `bec1975` (branch `sappers-path`, `?v=19`), my own server on :8493. 2026-09-30.

**Updated portal verdict: not rejected on sight, and the phone screen is now in the same league as Food Hunt.** The lower half is bright, the tiles pop, and the late boards are quiet. The two things that still read unfinished:
- The rods now draw through the counts (N1).
- On desktop and in landscape, the side column is a tall blank cream slab (N2).

CrazyGames would accept it. Poki is closer, but its desktop view would still fail the look test.

**Counts now:** 0 blocking, 2 major (both new, both side effects of fixes), 3 minor (new). Two more minors are parked (m5, m8).

Of the original findings, B1, M1–M10, m1–m4, m6 and m7 are fixed. None regressed outright. M3 and M10 each introduced a new major (N1, N2).

**How I checked** (I did not use the builder's numbers):
- `SP.selfTest()`: 788 pass, 0 fail.
- My capture script (`visual-shots.mjs --out recheck`): 0 console errors or warnings.
- My probes:
  - `visual-measure.mjs` and `visual-measure2.mjs` (the original measurements, re-run).
  - The rod scan inside `visual-shots.mjs`.
  - Two new probes: `visual-recheck.mjs` (B1, coach, hand, depth) and `visual-rivets.mjs` (rods against counts).
  - The fade ΔE00 recomputed in Python from `config.json` with the page's sRGB mix.
- **Captures:** `tools/shots-v4-critic1/recheck/`, with 131 files. Contact sheets are `recheck/sheets/r1..r9`, and the measurements are in `recheck/recheck.json`, `measure1.json` and `measure2.json`.
- **Note on `measure1.json`:** its `coachOver` at 1280 and 812 (75–127 px) is a false positive. That old probe checks vertical overlap only, and the coach now sits in the side column. True rectangle intersection with the board is 0 px everywhere (`recheck.json`).

### Status of each reported item

| Item | Status | Evidence |
|---|---|---|
| **B1** chain and men over the linked count | **Fixed** | See B1 note below. |
| **M1** dark lower screen | **Fixed** | See M1 note below. |
| **M2** muddy back rows | **Fixed** | Smallest faded-vs-other ΔE00 is 20.0 (Slate row 2 vs Crystal front, 42 levels). The critic's three pairs are now 25–26. Judgement on depth under "The builder's two calls". |
| **M3** rods: ambiguous nubs and third-tile crossings | **Fixed**, with new **N1** | Rod scan along every linked level's stored Normal order (19 levels + 2 debug): 0 third-tile crossings. Before, levels 67, 71, 82, 89, 91 and v4-all crossed. Rods now run centre to centre (88 px at 375, 127 px at 1280), with rivets and chain tags on both tiles. Partners two rows apart get an elbow down the column gutter. `r8`, `r9`, `375-linked-rest.png`, `375-rods-l67..l91.png`. |
| **M4** coach over fort blocks | **Fixed** | Coach and board intersect 0 px for levels 1, 2, 3, 35, 51, 62, 76, 77 at all 4 viewports. Before: 40 cells on the iframe's level 62. Cost: smaller cells (375 level 62: 15 → 13.67 px; iframe level 76: 9.5 → 8.0 px). |
| **M5** arrow over counts | **Fixed** | Hand box against every count, `#line-lab` and `#line-cnt`: 0 overlaps at load on the same 8 levels × 4 viewports. On level 35 the arrow now comes in from the side at "?29" (`r2`). On level 76 it sits above the socket and "4 free" steps aside. |
| **M6** archer rings | **Fixed** | On level 100 at rest the rings are faint (`375-l100-boss.png`, `400-l100-boss.png`). A ring turns loud only when it matters: `375-l64-mid.png`, and `375-teach-l51.png` with the coach's ring. |
| **M7** bins as a legend | **Fixed**, with new minor **N5** | No bins at rest. Bins grow in once hauled (`375-l64-mid.png`). |
| **M8** jam sheet names | **Fixed** | Inline colour chips with counts, no crew names (`375-jam-sheet.png`, `1280-jam-sheet.png`, `400-jam-sheet.png`). |
| **M9** sheet slices the line | **Fixed** | At 375 the fail sheet starts under the line, so the full jammed line stays visible (`r4`). In the iframe it floats above the line. The win sheet covers the whole rail. |
| **M10** desktop layout | **Fixed as asked**, with new **N2** | The side column is top- and bottom-aligned with the board. Board + column cover 70% of 1280×720 (was 55%). |
| **m1** head crowding | **Fixed** | The head reads "Line full", with a 180 px gap to "3 stuck · 2 working". |
| **m2** landscape title | **Fixed** | Colour-blind is now an icon-only square, and nothing wraps. Residual: the logo still grazes the keep's flag (`812-title.png`). Cosmetic, not re-listed. |
| **m3** coach clipping | **Fixed** | The coach fits in its band on one line or two. The 812 v4-all line now fits (`r6`). |
| **m4** mystery tiles | **Fixed** | Mystery tiles are a navy face-down card with a gold lattice and a gold "?" (`375-mystery-rest.png`, `r2`, `r4`). They read as a hidden card at every row. |
| **m6** map | **Fixed** | Locked nodes are dimmed with a padlock. The sticky Play bar has a solid backdrop (`375-map-top.png`, `375-map-era4.png`). |
| **m7** space key vs gate key | **Fixed** | The space key has a dashed cream square. Gate keys have a solid cyan or violet ring. They are now distinct in both colour and pattern at 1× (`375-crop-lockkey.png` vs `375-crop-gatekey.png` in `r8`). |

**B1 note.**
- **Measured:** count glyph against chain, lock, men and out-marker: 0 px overlap at all 4 viewports. Cases checked:
  - the v4-linked pair while leaving and 3 s later;
  - a full Easy line of 6 on level 40;
  - a line on level 100 with a linked pair.
- **Side effect, acceptable:** the slot count shrank from 36 px to 28 px at 375, and to 23.4 px on the 6-space line at 812. Both still read.

**M1 note.**
- **What changed:** the line and queue now sit on a light stone tray (`#ddd3c0`) with recessed sockets (`#c3b697`). The brick stays only as the margin. `r1` shows it beside Food Hunt.
- **Siege skin and trade dress:** the board, field and camp are untouched. The tray is a flat, cool stone or parchment panel with a dark ink rim. There is no grain and no orange-tan, and it sits in brick. It does not read as Food Hunt's wood table: ΔE00 is 12–17 from Food Hunt's wood tones.
- **Suggestion:** the tray is plain. A faint stone-block texture or a 1 px mortar pattern would make it belong to the siege world.

### The builder's two calls

**(1) Weak back-row fade, depth from the size step: acceptable, but the depth is weak.**
- **Measured at 375:**
  - Row sizes: front 63×52 with a 40 px count, row 2 57×47 with 36 px, row 3 50×42 with 32 px.
  - A tile's own colour changes by only ΔE00 0.5–3.5 at row 2 and at most 7.0 at row 3. So the colour adds almost no depth.
- **What reads:** the front row reads as the tap row, thanks to its raised lip, ink rim and larger size.
- **What doesn't:** rows 2 and 3 read as two rows of slightly smaller flat tiles, not as rows stepping back. All three rows are equally saturated, so the back rows pull as much attention as the front one (`r1`, `r2`, `r8`).
- **The call is right to hold ΔE00 ≥ 20.** Add a depth cue that doesn't touch the tile faces (listed as N3).

**(2) Level 77's coach over the top bar in the 400×600 iframe: acceptable as a fallback, but not as built.** See N4.

### New findings

**N1 (MAJOR, introduced by the M3 fix). Rods and rivets draw through the counts.**
- **Screenshots:** `recheck/sheets/r9-rivets.png` and `375-rods-l67.png`, `375-rods-l82.png`, `375-rods-l89.png`, `375-rods-l91.png`, `375-teach-l62.png`.
- **What's wrong:** the counts sit above the SVG (z 3 over 2), so no pixel of a digit is hidden. But a centre-to-centre rod runs straight through the digits, and the 10–12 px rivet lands inside or beside them.
- **Examples at 375:**
  - Level 67 after 20 taps: the white "20" reads as "2θ" or "28".
  - Level 62: "17" looks struck through.
  - Level 82: the pink "7" gets a crossbar.
  - Level 89: the "12" has a ring on its "2".
- **Measured** (`visual-rivets.mjs`, 543 queue states along the stored orders of every linked level): 123 cases of a rivet over a count's glyph box, and 1,626 rod samples inside glyph boxes.
- **Why it matters:** these are the numbers the player plans with, on the one feature that needs them most.
- **Fix:**
  - Give each count a 3–4 px halo in its tile's own colour (`.tile .n { -webkit-text-stroke: 4px var(--mc); paint-order: stroke fill; }`, or 4 stacked text-shadows in `--mc`). The rod then visibly breaks around the digits.
  - Move the rivets off the digit box, to the tile's edge facing the partner, about 8 px in from that edge and in the lower third of the face.
  - Add both checks to selfTest: rivet box against count glyph, and rod against glyph with the halo.

**N2 (MAJOR, introduced by M1 + M10). On desktop and in landscape, the side column is a tall blank cream slab.**
- **Screenshots:** `1280-l40-rest.png`, `1280-l100-boss.png`, `1280-teach-l62.png` (sheet `r5`), `812-l8-rest.png` (sheet `r6`).
- **Measured at 1280×720:**
  - The column runs from y 82 to 707.
  - The queue ends at y 408 (level 100), 419 (level 88) and 466–515 (teaching levels).
  - That leaves 204–215 px of blank tray above the 84 px empty power-up reserve: about 46% of the column is empty light stone.
- **Why it matters:** it is the brightest area on the screen and it holds nothing, so it reads as a placeholder. It is more conspicuous than the brick it replaced, and it is the first thing a portal reviewer sees at 16:9.
- **Fix:**
  - End the tray panel at the queue's bottom + 12 px, and let the brick show below.
  - Give `#powers` its own panel pinned to the column foot, with no panel at all until M5.
  - Or scale the rail's tiles up to fill the height: at 1280 the column is 520 px wide, so a 110 px tile is possible. Or centre line + queue in the column.

**N3 (MINOR). The back rows don't step back.**
- **Screenshots:** `r1`, `r2`, `r8`. The measurements are under "The builder's two calls" (1).
- **Fix:** keep the tile faces. Seat row 2 on a tray band 6% darker than the tray and row 3 on one 12% darker. Alternatively, give only the front row a 3 px ink drop shadow, or set rows 2–3 in a lighter weight. This adds depth without touching the faces or ΔE.

**N4 (MINOR). The iframe level 77 coach covers the level number, name and difficulty.**
- **Screenshot:** `400-teach-l77.png` (`r7`, magnified strip).
- **Measured:** the coach box (51, 0, 214×38) covers `#lvl-num` by 32×31, `#lvl-name` by 62×15 and `#diff-chip` by 40×13.
- **What's wrong:**
  - The line wraps badly ("All twists at once. Linked squads: 2" / "spaces.").
  - The box touches the iframe's top edge with no margin.
- **Why only a minor:** it is the only level at the portal size where the coach band doesn't fit, and the teaching line matters more than the name there.
- **Fix:**
  - Keep `#lvl-num` visible by starting the coach after it.
  - Use `text-wrap: balance`, or shorten the line to "All twists at once. Linked: 2 spaces."
  - Add a 3 px top margin.

**N5 (MINOR). With no bins, the board foot is a bare band.**
- **Screenshots:** `375-l40-rest.png`, `375-l64-rest.png`, `375-linked-jam.png`, `1280-l40-rest.png`.
- **What's wrong:**
  - At rest the yard under the camp is empty dark ground, about 8–10% of the frame's height, and reads as dead space.
  - Once bins appear they keep their fixed slots, so a lone bin sits far right with a gap before it (`375-l64-mid.png`: pink and grey on the left, gilt alone on the right).
- **Fix:** trim the yard to 1 row until the first haul and grow it with the first bin. Pack bins left to right in the order they first haul, not in fixed slots.

### What the M5 screens still need (update)

The earlier list still stands. Add the following:
- The power-up bar must not become more blank tray on desktop (N2).
- Size the bar to the column width. At 1280, four 96 px badges fit in the 84 px reserve height only if the badges shrink to about 72 px, so raise `--pw-h` to about 110 px or lay the badges out 2×2.
- In the 400×600 iframe, the queue now ends at y 586 of 600, so the bar still has no room there. Decide it explicitly (see §3).

---

## Re-check 2

HEAD `a1760a3` (branch `sappers-path`, `?v=20`), my own server on :8493. 2026-09-30.

**Checks:**
- `SP.selfTest()`: 791 pass, 0 fail. 0 console errors or warnings.
- Probes: `visual-recheck2.mjs` (rods, rivets, tray, coach) and `visual-gutter.mjs` (rods sharing a gutter).
- Captures: `visual-shots.mjs --out recheck2`.
- Everything is in `tools/shots-v4-critic1/recheck2/`, with sheets `q1`–`q3`.

| Item | Status | Evidence |
|---|---|---|
| **N1** rods and rivets through counts | **Fixed** | See N1 note below. |
| **N2** blank desktop tray | **Fixed** | Blank tray below the queue: 15 px at 1280 (levels 40, 88, 100) and 11 px at 812. Below the tray the column shows brick, with the 84 px `#powers` reserve at its foot (`q2`). |
| **N3** rows don't step back | **Fixed** | Rows 2 and 3 sit on bands 6% and 12% darker, each with a light shelf edge. The queue now reads as shelves stepping back, and the tile faces are unchanged (`q2`, `q3`). |
| **N4** iframe level 77 coach | **Fixed** | See N4 note below. |
| **N5** bare board foot | **Fixed** | See N5 note below. |

**N1 note.**
- Measured over 543 queue states along every linked level's stored Normal order, at each of 375, 1280 and the 400×600 iframe:
  - 0 rivets over a count;
  - 0 rod samples inside a count's glyph box;
  - 0 rod samples on any tile face;
  - 0 third-tile crossings.
- Rods now run in the gaps, with a rivet on each tile's rim and a chain tag on both tiles. Every count is clean (`q1`: levels 67, 82, 91, 62 and v4-all).

**N4 note.**
- In the iframe, level 77's coach is one line, "Linked squads: 2 spaces.", at 19 px.
- It starts after the level number (0 px overlap) and is not clipped.
- It still covers the name and difficulty. That is acceptable for this one fallback.
- At 375, 812 and 1280 the coach sits in its band or side dock with 0 overlaps.

**N5 note.**
- At rest the yard holds dark, uncoloured crates. They fill the band without reading as a legend.
- Bins pack left to right in first-use order (`375-l64-mid.png`: pink, gilt, grey from the left).

**New finding.**

**N6 (MINOR). Two links can share one gutter and read as a single line.**
- **Measured** (`visual-gutter.mjs`): on level 78, steps 13–29 of the stored order (17 of 543 states, at both 375 and 1280), two rod paths run within 5 px of each other.
- **What it looks like** (`375-rods-l78-step13.png`, `q3`): the col 3/4 gutter carries one line with rivets on "2" (row 2) and "8" (row 3), plus a stub going below the tray. It reads as one link touching three things.
- **Also visible** (`375-linked-rest.png`, debug level v4-linked at rest): the 3↔21 rod and 6's stub share the col 0/1 gutter. My 5 px threshold did not flag it, but it looks the same.
- **Why only a minor:** the chain tags still mark every linked tile. But which tile pairs with which is ambiguous there.
- **Fix:** when a gutter is already taken, draw the second rod 4 px to the side (two parallel lanes), or run its stub along the tile's bottom rim. Alternatively, tint each pair's rivets and tags differently (brass and iron).

**Carry-forward for M5 (not a finding).** At 1280 the lower ~40% of the side column (282 px on level 40, including the 84 px reserve) is bare brick until the power-up bar lands. M5's bar, and any level or progress card, must fill that foot.

**Final counts for Critics 1 visual:** 0 blocking, 0 major, 1 minor open (N6). m5 and m8 stay parked in LATER.md.

**Portal verdict: not rejected on sight.** CrazyGames would accept the phone and iframe screens as they stand. The remaining gap to Poki is meta and payoff, not defects: the M5 home screen, the power-up bar filling the desktop column, and the win payoff (m5).
