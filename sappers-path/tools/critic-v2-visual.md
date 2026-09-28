# Sapper's Path v2: visual critic (M1 v2)

Date 2026-09-27. Target: frozen copy of 1ccf125 at `http://127.0.0.1:8492/sappers-path/?debug=1`. Headless Playwright only.

Viewports:
- 375×812 (DPR 3, touch)
- 390×844 (DPR 3, touch)
- 768×1024 (DPR 2, touch)
- 1280×720 (DPR 1, mouse)
- 812×375 (DPR 3, touch)

Frames were driven through `SP.load`, `SP.call`, `SP.hold` and `SP.tick`. The off-card test used a real `touchscreen.tap`.

Evidence folder, written `$V` below:
`/private/tmp/claude-501/-Users-peter-Documents-Claude/e84ef9ae-3587-408d-915e-5e4b23213819/scratchpad/critic-v2-vis/`

Contact sheets:

| Sheet | Contents |
|---|---|
| `$V/S-A-blind.png` | blind lineup: A, C and E are Food Hunt; B and D are Sapper's Path |
| `$V/S-B-screens.png` | title, map, hint, off-card tap |
| `$V/S-C-worlds.png` | W1-W4 mid-play boards, in colour and grayscale |
| `$V/S-D-zoom.png` | flags, keep, lever, camp, chests, rail at 3× |
| `$V/S-E-show.png` | walk, eat, chest, lever, win and stuck frames |
| `$V/S-F-closeups.png` | lever/door sequence, eat sequence, flag overlap, panels |
| `$V/S-G-viewports.png` | 390, 768, 1280, 812×375, settled win, max-flags board |

- Raw screenshots: `$V/*.png`.
- Numbers: `$V/cap.json`, `cap2.json`, `cap3.json`.
- Scripts: `$V/cap*.mjs` and `sheet.mjs`.
- Food Hunt references: `$V/fh1.png`, `fh2.png`, `fh3.png`, pulled from the App Store listing's mzstatic screenshots.

## Summary

- `SP.selfTest()` at 375×812: **ok**.
  - 38/38 solved, 303 ms
  - 276 button checks, 223 flag checks
  - 0 fails
- Console: 0 errors and 0 warnings from the game across all five viewports and three runs. The only warnings came from my own pixel-sampler canvas.
- Counts: **BLOCKER 0 · MAJOR 7 · MINOR 13**.
- Blind verdict: Food Hunt is the finished commercial game. Sapper's Path reads as a cohesive, competent indie build. A portal would **not** reject it on sight: nothing is broken or placeholder at first glance, and the skin, font and layout are consistent. It would not be featured next to Food Hunt, though. The board reads as a muddy floor plan rather than a picture, the camp and crews are nearly invisible at rest, and the win is small.
- Versus the v1 bar (`critic-recheck.md`), v2 falls below it in three places:
  - the win payoff (MAJOR-6)
  - the crumble legibility (MAJOR-5)
  - landscape (MAJOR-7)

  Everything else holds: chest badges, skin, map, banner contrast, the icons and names.

## 1. Blind framing next to Food Hunt

The question: which of these looks like a finished game a portal would accept?

**Food Hunt (A, C, E) wins on every visible axis:**
- **The subject.** The picture is a recognisable object (a watermelon, a sushi platter, a bento). It's framed on a light card, and you know what you're eating before you read anything.
- **Life on screen.** Dozens of coloured ants swarm at all times, so the screen is alive even at rest.
- **Palette.** It's bright and saturated. The picture pops off a warm wood background.
- **UI.** Chunky candy UI with big numerals, and the shooters sit in a clear queue.

**Sapper's Path (B, D) reads as finished but plain:**
- **Where it holds up.** It has a full game skin: pixel face, bevelled buttons, a banner scene, a level name, and a star HUD in the top bar. The board has real textures (brick courses, planks, leaf mottle, cracked ice). None of it looks like debug output.
- **The board is a plan, not a picture.** It's an earth-toned top-down maze of rectangles, and there's no focal subject except a 2×2 keep.
- **Empty ground.** On W1/W2, 40-50% of the board is plain sand courtyard and grass. D (W2 2-8) is mostly empty sand.
- **No crew is visible at rest.** The camp is a row, or on W4 a left-edge column, of 1-cell tents.
- **The palette** is muted green, tan and grey. The board doesn't separate from the dark brick frame the way Food Hunt's picture separates from its card.

**Would a portal reject it on sight?** No. Would it stand out in a portal's grid next to Food Hunt-style games? Also no. The gap is art direction (subject, life, colour), not finish.

## 2. Readability at 375 on the largest boards (W4 24×32)

Cell size is 14.3 CSS px (inside the 12-16 target). The board is 353×467.

| Can you tell it apart in under 3 s? | Result | Evidence |
|---|---|---|
| Materials (stone, timber, hedge, ice, iron) | **yes**, in colour and grayscale. Ice is brightest, iron darkest with rivets, timber has dark upright planks, hedge a dark mottle, stone mid-grey courses. | `$V/S-C-worlds.png` |
| Keep | **yes**: purple roof, gold eave, green flag | `$V/S-D-zoom.png` |
| Moat | **yes** in colour. Grayscale works only through the dash pattern (MINOR-12). | `$V/375-gray-w3.png`, `375-gray-w4.png` |
| Chests | **mostly**. An unclaimed chest wears the crew badge with a gold "+". A claimed chest stays as a 1-cell box (MINOR-9). | `$V/S-D-zoom.png` |
| Camp | **no** on W4 (MAJOR-2) | `$V/375-mid-w4.png` |
| Levers | **no** at 1× (MAJOR-4) | `$V/S-C-worlds.png` W4 |
| Each crew's flag and its card | **yes, when zoomed**. The white disc carries the card's icon with a thin ring in the material colour, and it matches the card. At 1× it relies on the glyph. The chest badge looks almost the same (MAJOR-3). | `$V/S-D-zoom.png` |
| Which walls are reachable now | **partly**. Flags mark one target per crew, and ground the camp can't reach sits in shade (dark brown inner courtyards on W3/W4, which reads in grayscale too). The extent of the section a crew will eat is not shown (MINOR-3). | `$V/S-C-worlds.png` |
| Block size too small anywhere | **yes, only in landscape**: 10 CSS px at 812×375 (MAJOR-7) | see below |

Measured cells in CSS px:

| Viewport | W1 | W2 | W3 | W4 |
|---|---|---|---|---|
| 375×812 | 21.3 | 19.0 | 17.3 | 14.3 |
| 390×844 | 22.3 | | | 15.0 |
| 768×1024 | 32.5 | | | 22.0 |
| 1280×720 | 31 | | | 19 |
| 812×375 | 15 | | | **10** |

## 3. Does the board read as a castle picture?

| Aspect | Rating | Notes |
|---|---|---|
| Density | W3/W4 **good**, W1/W2 **thin** | W4 4-10 and W3 3-9 are concentric rings that fill the board. W2 2-8 is a thin hedge/stone ring around a courtyard that is about half the board. |
| Silhouette | **weak** | Every wall is an axis-aligned rectangle or plus-shape. No round towers, no crenellation, no wall height. |
| Towers and gatehouse | **missing or implied** | Corner blocks in W1 read as square towers only by position. The only gatehouse-like shape I found is the timber gap between two stone stubs on w4-08. |
| Moat | **ok** | Stepped band along the bottom on W3/W4. The w4-02 moat is a straight side strip. |
| Empty ground | **reads as unfinished** on W1/W2 | See MAJOR-1 and MINOR-7. |

SPEC-v2 §4 asks for "round or square towers, a gatehouse, courtyards and a curving moat" and for the board to "look like a castle plan in pixel art, like Food Hunt's pictures". The courtyards and moat are there; the towers and gatehouse aren't. See MAJOR-1.

## 4. Polish

**Spacing at 375 (W4):**
- The stack is contiguous: top 0-56, banner 56-176, board 184-651, rail 652-812, with 8 px gutters.
- There's no dead band.
- The banner (92-148 px, varying by world) does not cost board size, because the board is width-bound on phones. I have no finding on banner height in portrait.

**Text wrap:**
- The hint wraps to 4 lines at 14 px and the stuck line to 2.
- There's no clipping or overflow at 375, 390 or 768.
- Page `scrollWidth`/`scrollHeight` equal the viewport everywhere.

**Contrast:**
- Method: the 97th/3rd percentile luminance inside each element's box on a DPR 3 screenshot, W4 play and win.

  | Element | Contrast |
  |---|---|
  | level name, star HUD | 15.1:1 |
  | world tag | 14.1:1 and 18.0:1 |
  | enabled card label (12 px) | 6.1:1 |
  | Undo / Restart | 10.9:1 |
  | panel title | 11.6:1 |
  | panel line | 6.4:1 |

- All pass AA. Disabled cards are the exception (MINOR-4).

**Pixel scale:** see MINOR-5.

**Win panel "bleed-through": FALSE ALARM, not a finding.**
- Early captures showed the rail's Undo/Restart ghosting through the panel.
- That was the `sheetin` animation (0.22 s, opacity 0.4 to 1) caught mid-flight by a snapshot taken right after a held-clock settle.
- After 700 ms of real time the opacity is 1 and the panel is clean (`$V/375-win-settled.png`).

**Landscape:** MAJOR-7.

## 5. Feel

**Walk:**
- One crew sprite (1.9 cells, about 27 CSS px on W4) walks from the tents with a faint footprint trail (`$V/375-midwalk.png`).
- Paths are often trivially short because the closest wall is next to the camp. w4-06 call 1 is 2 tiles, and the busiest W4 call (w4-t1) is 7.
- It reads, but it's a small event.

**Eat:** MAJOR-5.

**Win:** MAJOR-6.

---

## BLOCKER

None.

## MAJOR

### MAJOR-1: The board reads as a floor-plan maze, not a castle picture
- **Screen:** mid-play, all worlds. Worst on W1/W2.
- **Viewport:** 375×812 (same at every size).
- **Screenshots:** `$V/S-C-worlds.png`, `$V/S-A-blind.png` (B, D), `$V/375-mid-w2.png`.
- **Repro:** `SP.load("w2-08")`, then 3 line calls. Or `SP.load("w1-08")`, then 2 calls.
- **Evidence:**
  - Every wall is an axis-aligned rectangle or plus. There are no round towers, crenellations or gatehouse.
  - On w2-08 the sand courtyard plus the bottom grass band is about half the board.
  - Isolated hedge-plus and plank blocks sit in the grass at the bottom (w2-08) and as loose ice slabs outside the W4 moat (w4-10). They read as debris, not architecture.
  - Next to Food Hunt's watermelon or bento, there's no subject.
- **Fix, in the generator/bake (the art pipeline is fine):**
  - Stamp tower footprints (round 3×3/4×4 or square 3×3) at ring corners.
  - Stamp a gatehouse (two towers flanking a timber gate) on the camp-facing wall.
  - Draw a 1-art-pixel crenellation lip along each outer wall edge.
  - Cap plain courtyard at about 30% of the board: add inner buildings or walls as scenery, or shrink the ring.
  - Keep stray outer blocks attached to the castle silhouette, as outworks or barbicans.

### MAJOR-2: The camp is nearly invisible, and no crew shows at rest
- **Screen:** mid-play W4.
- **Viewport:** 375×812.
- **Screenshots:** `$V/375-mid-w4.png`, `$V/S-D-zoom.png` ("W4 camp").
- **Repro:** `SP.load("w4-10")`.
- **Evidence:**
  - The camp is a 1-cell-wide column of six red-white tents on the far left edge, each about 14 CSS px.
  - There are no crews, fire, banners or ground patch.
  - At 1× it reads as a red stripe on the board's edge.
  - On W1-W3 it's a bottom row of the same 1-cell tents.
  - Food Hunt's swarm is always visible; here, where the action starts is the hardest thing on the board to find.
- **Fix:**
  - Draw the camp as a 3-4 cell deep patch of trodden earth.
  - Scale the tents to 1.5-2 cells.
  - Stand one idle crew sprite per mustered crew (with its count) in front of the tents, so the camp shows the muster the way Food Hunt shows its ants.
  - The already-deferred fire, crates and flapping pennants belong here.

### MAJOR-3: The chest badge and the target flag are almost the same sprite
- **Screen:** mid-play W4, and w2-t1.
- **Viewport:** 375×812.
- **Screenshots:** `$V/S-D-zoom.png` ("W4 keep/iron/lever": goat badge with "+" below the keep; "W4 hedge flag": goat flag), `$V/375-mid-w4.png`.
- **Repro:** `SP.load("w4-10")`, then 5 line calls.
- **Evidence:**
  - Both are a white disc with the same crew glyph and the same thin material ring.
  - The flag adds a pole and pennant. The badge adds a 2-art-pixel gold "+".
  - On w4-10 there are two goat discs on the board at once: the flag at the top and the chest badge under the keep. The player asking "where do goats go?" has to find the pole.
  - In grayscale they're identical apart from the pole.
- **Fix:** give chests their own shape, for example:
  - a gold-rimmed square or diamond badge; or
  - the crew glyph floating over an open chest lid, with a gold "+1".

  Also pulse flags gently, so "target" is motion and "reward" is static.

### MAJOR-4: Levers are unreadable at phone size
- **Screen:** W4 mid-play and w4-t1.
- **Viewport:** 375×812.
- **Screenshots:** `$V/S-C-worlds.png` (W4, on the hedge left of the keep), `$V/S-D-zoom.png` ("W4 keep/iron/lever"), `$V/375-lever-0.png`.
- **Repro:** `SP.load("w4-10")` or `SP.load("w4-t1")`.
- **Evidence:**
  - The lever is a 1-cell grey plate with a thin diagonal handle (14 CSS px), sitting on a hedge or timber section.
  - At 3× it reads as a lever. At 1× it reads as a stone block or a smudge.
  - The lever is the W4 mechanic (it opens the iron). The brief's "tell levers apart in under 3 s" fails.
- **Fix:**
  - Draw the lever at 1.5-2 cells with a red knob and a gold base plate.
  - Tie it visually to its iron: a dotted chain line from lever to door, drawn once, or iron and lever sharing a colour-coded rivet.
  - Add a small idle wobble.

### MAJOR-5: The eat doesn't feel eaten (a regression below v1's crumble)
- **Screen:** mid-eat.
- **Viewport:** 375×812.
- **Screenshots:** `$V/375-mideat.png`, `$V/375-mideat2.png`, `$V/S-E-show.png` (row 1), `$V/S-F-closeups.png` (eat sequence).
- **Repro:** `SP.load("w4-t1")`, `SP.call("stone")`, then tick 1045 ms and 1165 ms.
- **Evidence:**
  - The 144-block ring is eaten in 37 rings within the 900 ms cap.
  - Blocks crack, then turn pale and vanish in a wave, including blocks 15+ cells from the one mason standing at the contact tile.
  - At 14 px cells the rubble chunks (`chunkPerTile` 3) are about 2-3 CSS px and barely register.
  - Nothing is carried off and nobody is at the far blocks. It reads as the wall dissolving, not being eaten.
  - v1's crumble at 30 px cells showed tiles popping with visible chunks (critic-recheck item 8). At v2's cell size the same effect is half as legible.
- **Fix:**
  - Scale the chunk and dust sprites in CSS px (a minimum of about 4 px), not per cell.
  - Spawn 3-6 mini-crew sprites that fan out along the wave front, Food Hunt-style, and trot back to camp at the end.
  - Or at least move the crew along the ring front.
  - Give each ring a visible pop (scale to 1.3, then gone) rather than a fade.

### MAJOR-6: The win payoff shrank with the cell (a regression below v1's win)
- **Screen:** win.
- **Viewport:** 375×812.
- **Screenshots:** `$V/375-win-payoff.png`, `$V/375-win-keep-w406.png`, `$V/S-F-closeups.png` ("keep +500").
- **Repro:** `SP.load("w4-06")`, play the line, and hold at `keepAt` + 260-500 ms.
- **Evidence:**
  - The rays (`raysR` 3 cells) and the goblin (`goblinScale` 3.2 cells) are sized in cells.
  - On W4 at 375 the burst is about 90 CSS px across, the goblin figure about 25 CSS px, and the confetti stays within about 4 cells of the keep.
  - That's roughly 5% of the 353×467 board.
  - v1 won with a goblin of about 60 CSS px (30 px cells).
  - The panel then covers the bottom quarter.
- **Fix:**
  - Size the win fx in CSS px, or with a floor: a goblin of at least 56 CSS px and rays of at least 120 CSS px.
  - Throw the confetti across the whole board.
  - Add a short camera punch-in on the keep or a flash of the whole board.
  - Consider every remaining wall crumbling in a fast wave as the victory lap.

### MAJOR-7: The landscape board is 10 px a cell beside a 230 px decorative column
- **Screen:** play and win.
- **Viewport:** 812×375.
- **Screenshots:** `$V/812L-mid-w4.png`, `$V/812L-win-settled.png`, `$V/S-G-viewports.png` (bottom right).
- **Repro:** open at 812×375 and `SP.load("w4-10")`.
- **Evidence:**
  - The board is 246×326 (x 293-539) at 10 CSS px a cell, below the 12-16 target. W1 is 15.
  - The banner column takes x 35-265, mostly empty night sky.
  - The top bar takes 48 px.
  - The board runs to y 374 of 375, past the stage's bottom at 359, with no bottom margin.
  - v1 landscape was usable at a larger cell. The builder's notes list this as cut order 3, but it's visible, and it's the orientation many portal players on phones use.
- **Fix:**
  - In landscape, drop the banner scene: keep only the world tag, stacked above the cards.
  - Fold the top bar into the side column.
  - Give the board the full height minus 16 px. That's about 359 px, which is 11.2 px per cell at 32 rows; with the top bar folded it's about 13.
  - Or rotate W4 boards to 32×24 in landscape.

## MINOR

1. **Flags overlap at adjacent contacts.**
   - Where: w4-08 at rest, the gate: the axe and goat discs overlap by about 40%, and the axe pennant is hidden.
   - Evidence: `$V/S-F-closeups.png` ("w4-08 gate flags").
   - Fix: when contacts are within 2 cells, fan the discs apart on angled poles. This is already noted for LATER.
2. **The ice flag's ring is pale blue on a white disc**, effectively invisible, so the torch flag relies on the glyph alone. In grayscale all four flags are the same disc.
   - Evidence: `$V/S-D-zoom.png` (W3 torch flag).
   - Fix: a darker ice ring (`#4f98bb`), and fill the pennant in the material colour.
3. **The extent of the target section isn't shown.** The flag marks only the contact tile. On W4, adjacent same-material sections are separated by a 1 px ink line, so you can't predict how much a call eats.
   - Fix: faintly tint the flagged section in the crew colour (at about 15% alpha), or outline it while its card is pressed.
4. **Disabled cards are hard to read.** At opacity 0.45 the label measures 2.64:1 and the count 3.07:1. That's exempt from AA, but "0" is the information the player needs.
   - Evidence: `$V/cap2.json` `cPlay`.
   - Fix: grey the card background but keep the count at full ink.
5. **Pixel scale is mixed.**
   - The board's art pixel is 1.8 CSS px on W4 (`blockPx` 8 at a 14.3 px cell) and 2.7 on W1.
   - The banner, title and card icons are chunkier.
   - Flags and chest badges are drawn smooth at device resolution.
   - The board looks like fine noise next to a chunky UI (`$V/S-D-zoom.png`).
   - Fix: draw flags and badges on the pixel grid, and consider `blockPx` 6 on W4 so the texture reads as pixels.
6. **Mixed fonts.** Card labels (12 px), hint text (14 px), the panel line (15 px) and the title blurb are system-ui; everything else is Jersey 10.
   - Fix: Jersey 10 at 16 px or more for labels, or accept it deliberately.
7. **Rubble footprints look like placeholder tiles.** Eaten outer blocks leave tan dotted squares in the grass outside the moat: w4-10 bottom, w3-09 bottom right, w4-02 bottom right.
   - Evidence: `$V/375-mid-w4.png`, `$V/375-stuck.png`.
   - Fix: blend the rubble into grass (a grass-tinted rubble tile), or fade it over a few seconds.
8. **The teaching hint covers the top 20% of the board.** On w3-t1 at 375, the hint spans y 164-259 of a board at 156-652, hiding the top timber wall and moat until "Got it".
   - Evidence: `$V/375-hint-w3t1.png`.
   - Fix: dock the hint over the banner strip (56-148), which is decorative.
9. **A claimed chest stays as a closed-looking 1-cell box** with no badge (W2 2-8, W3 3-9 mid). It reads like an unclaimed chest missing its badge.
   - Fix: draw it open or empty, or fade it out after the fly.
10. **Misleading toast.** On w2-t1, tapping the Masons card (count 0 at start; masons come from the chest) says "No masons left".
    - Evidence: `$V/375-offtap.png`.
    - Fix: when the muster is 0 and a chest holds that crew, say "Open the chest to get masons".
11. **Wide gutters on desktop.** At 1280×720 the board is 468×620, with the banner column (230×420) mostly empty night sky. At 768 there are 112 px dark gutters.
    - Evidence: `$V/1280-mid-w4.png`, `$V/768-mid-w4.png`.
    - Fix: optional. Let the board grow to about 690 px tall at 1280 by trimming the top bar margin.
12. **Grayscale moat and grass** have similar luminance on W3/W4. The moat separates only by its dashes.
    - Evidence: `$V/375-gray-w3.png`, `375-gray-w4.png`.
    - Fix: darken the moat's base (`#2b5d97`) by about 15%.
13. **The map lays 9-level worlds out 4-4-1**, leaving a lone node row (W1, W2).
    - Evidence: `$V/375-map.png`.
    - Fix: a 3-3-3 snake for 9-level worlds.

## Notes (not graded)

- **The 4-flag screen can't be captured, because no level ever has four targets at once.**
  - Along every baked line, 0 states have 4 targets.
  - Over 2,626 random playouts on the nine four-material levels (w3-03/05/07/08/09, w4-03/06/08/10), the maximum was 3 simultaneous targets.
  - The 3-flag case is `$V/375-flagsmax.png` (w3-05 at rest). It reads.
  - The 4-flag cluster is untested, but it's also unreachable in the current bake.
- **Hold versus CSS time:** `SP.hold` freezes the game clock but not CSS animations. Any critic snapshot taken right after a held settle can catch the sheet mid-rise. Wait 300 ms or more of real time before judging panels.
- **v1 bar check:**
  - Chest crew badges: held.
  - Game skin: held.
  - Map headers: held.
  - Banner tag contrast: held (14.1:1 measured).
  - Pickaxe/axe glyphs: held.
  - Names: held.
  - "Reachable at a glance": replaced by flags plus shaded unreachable ground, which works for the v2 rule.
  - Crumble, win and landscape fall below v1 (MAJOR-5, -6, -7).
