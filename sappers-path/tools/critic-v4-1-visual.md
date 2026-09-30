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
