# Sapper's Path v4.1: VISUAL critic

HEAD `f933ab6` (branch `sappers-path`, `?v=24`), my own server on :8493. 2026-10-02.

**Portal verdict: not rejected on sight by either portal.**
- **CrazyGames: accept.** The castle pictures make the play screen brighter and closer to Food Hunt than v4 was.
- **Poki: would not reject on sight.** A reviewer who plays 5–10 levels will see the same picture again and again (V1). That is the one thing that now reads as unfinished.

**Counts: 0 blocking, 1 major, 4 minor.**
- `SP.selfTest()`: 1017 pass, 0 fail. 0 console errors or warnings in every run.
- **Captures:** `tools/shots-v4.1-critic/visual/`. There are 182 PNGs at 375×812, 375×667, 1280×720, 812×375 and the 400×600 iframe, including 6-frame bottom-entry strips. Contact sheets are `visual/sheets/a..e`.
- **Probes** (`visual/`):
  - `probe.json`: coach fit at 8 viewports, bar, Gallery next tile and win picture.
  - `rods-tray.json`: rods.
  - `gutter.json`: gutter lanes.
  - The variety metric is computed below from `levels/levels.json`.

---

## 1. Does the Siege read like the Gallery pictures? Yes.

**At 375×812, 1280×720, 812×375 and the iframe:**
- Every castle is now a bright front-view picture: sky, sun and clouds, a black outline and flat studs. It is the same look as the Gallery (sheet `b`, `c`).
- Cells are bigger than v4 on most boards:
  - 375×812: Era 1 17 px, Era 3 14 px, level 100 11.33 px (v4: 15 / 13 / 9.33).
  - 1280: 22 px.
  - Iframe: level 100 9.5 px.
- The pictures read at a glance at all of these.

**At 375×667 it still reads, but Era 4 is small** (minor m3):
- Level 88 is 8.5 px a cell and level 100 is 8.0 px.
- The board is 170–200 px wide on a 375 px screen.

**One thing that reads oddly** (minor m2): the Era 3/4 keep (cream, two black windows over a black door, blue towers either side) reads first as a smiling face with ears (`375-l64-rest.png`, `375-l100-boss.png`, `1280-l100-boss.png`).

## 2. Variety: MAJOR (V1)

**Measured** from `levels/levels.json`:
- **Colours:** every colour role has exactly 1 colour across all 100 levels. That covers sky, cloud, grass, forest, timber, earth, thatch, roof, banner, stone, slate, ashlar, black and drawbridge.
- **Layouts:** I resampled each level's picture to a 10×14 map of roles and compared every pair within an era (teaching levels excluded):

  | Era | Median share of matching cells | 10th percentile | Most alike pair |
  |---|---|---|---|
  | 1 | 0.67 | 0.56 | 0.93 |
  | 2 | 0.66 | 0.54 | 0.94 |
  | 3 | 0.60 | 0.48 | 0.92 |
  | 4 | 0.53 | 0.36 | 0.91 |

- **For comparison:** Gallery emoji and our own pictures, 0.23. Era 3 against Era 4, 0.39.
- **On the contact sheet** (`tools/shots-v4.1/contact-sheet.png`):
  - The 100 levels are four pictures with small changes: a brown stockade with yellow thatch, a salmon motte with a tower over a moat, a grey keep between blue towers, and the same keep with a second wall.
  - Every one has the same cyan sky and the same green hill.
  - Era 4 is Era 3 with an extra band, so the last 50 levels share one face.
- **Why it's major:** over 100 levels this flattens the sense of progress. Era 1's levels 4–25 are 22 versions of one picture, and a portal listing's screenshots will all look alike. It doesn't break play, so it isn't blocking. After the Gallery set the bar, the Siege now looks generated in a way the Gallery doesn't.

**Variety levers for `tools/castle.js`, ranked by impact against risk to the palette rules** (co-occurring colours ΔE00 ≥ 25, faded ≥ 20). My numbers already show what is fixed today: one colour per role and median layout matches of 0.53–0.67.

1. **Layout and silhouette variation. Highest impact, zero palette risk.**
   - Castle placement: left, centre or right third, and offset on the hill.
   - Keep shapes: square, round with a cone roof, tall narrow, twin keeps.
   - 1–4 towers at different heights.
   - Roof styles: cone, flat with crenellations, pitched.
   - Gatehouse styles, wall length and curtain steps.
   - Target: within-era median match ≤ 0.40 (Gallery-like is 0.23). Gate the bake on it, the way the dedupe already gates near-duplicates.
2. **Ground and horizon shapes. High impact, zero palette risk.**
   - One hill, two hills, a cliff edge, a river bend in the foreground, a lake behind, distant mountains (reusing stone or slate), a rocky outcrop.
3. **Foreground props. Medium-high impact, low risk** (they reuse existing roles):
   - Siege engines (a catapult, trebuchet or ram in timber), haystacks (thatch), banners on poles (banner), rock piles (stone), more or fewer trees (forest), a cart.
   - They also give the bottom-entry walk something to pass.
4. **Scene palettes per level: time of day and season. Highest visual impact, highest palette risk.**
   - Dawn: peach sky. Dusk: violet sky. Night: navy sky with a moon and stars. Overcast: grey sky. Autumn: an olive-orange hill. Winter: a white hill with snow caps.
   - Risks: night navy against slate and black; snow white against ashlar and cloud; autumn orange against earth and thatch; overcast grey against stone.
   - Do it as 5–6 pre-validated scene palettes: each one searched once with the same OKLCH search and the ΔE00 25 / faded 20 check against every role it can co-occur with, and roles dropped when they clash (no clouds at night; stars in cloud white). Rotate them by level, about 1 in 3 levels not daytime.
   - Era identity can ride on it: Era 1 summer, Era 2 autumn, Era 3 dusk, Era 4 winter, with day levels mixed in.
5. **Banner and pennant colour per level. Low-medium impact, low risk.** Pick from 3–4 banner hues each pre-checked against that level's palette. Also vary the number of flags and where they fly.
6. **Weather overlays (rain streaks, falling snow) drawn over the studs as a non-block effect. Medium impact, no palette risk.** Watch readability at 8 px; keep them to ≤ 10% opacity, or to the title and win screens only.
7. **Give Era 4 its own identity. High impact, no palette risk.** Era 3 against Era 4 matches at 0.39 and reads the same at a glance. Use a different silhouette family for Era 4: a water castle on a lake (the moat as the whole foreground), a cliff-top fortress, or a wide two-keep layout.

## 3. Bottom entry: reads, one minor

- **Screenshots:** `375-strip-l40-f0..f5`, `375-strip-l88-f0..f5`, `375-strip-pizza-f0..f5` (sheet `d`, 300 ms a frame).
- **What reads:**
  - Sappers file out along the bottom frame row and climb both side frame columns.
  - They eat the picture from its bottom corners and the bottom edge inward. On Pizza the light-blue background goes from the bottom corners up both sides.
  - It reads clearly as "from the bottom, round the frame". No jank in the frames: runners keep to the frame and the bank paths, and bins grow in at the yard.
- **m1 (MINOR): the entry square is barely marked.**
  - It is a 2–3 cell gap in the bottom frame drawn as two small dark slots (sheet `b`, under every board). The runners appear to come from the crate yard rather than through a gate.
  - **Fix:** draw the entry as a small wooden arch or gate (timber role, 3 cells wide, 1 cell tall over the gap), or a dirt path from the crate row to the gap, so the eye sees where the column comes from.

## 4. Smaller boards and 24×24 Gallery pictures

- **Gallery (sheet `e`, top row, v4 beside v4.1):**
  - Dragon loses its cheek curls and some shading at 24×24 but still reads at once.
  - Trophy, Cat and Goblin King's Hoard read as well as before.
  - The cells are bigger on phones (375 Gallery 14–15 px, against 11 px in v4), which helps.
- **m4 (MINOR): a small loss of detail on the busiest emoji.**
  - Dragon is the clearest case.
  - Accept it. If a picture loses its identity, prefer a 24×28 portrait box for that one picture over shrinking everything.
- **Moats and drawbridges:**
  - At 375×812 and up the moat is a clean blue wave band across the board, and the drawbridge is a grey block with a cyan padlock. Both read (`375-l30-rest.png`, `375-l88-rest.png`).
  - At 375×667 on level 100 (8 px) the drawbridge is a 2-cell grey mark with a padlock dot: visible, but small.

## 5. Regression pass (Critics 1 and 2): clean

- **Coach fit:** 0 clipped, 0 over the board, 0 over the level number on levels 1, 2, 3, 35, 51, 62, 76 and 77 at all 8 viewports (375×667, 414×736, 375×812, 390×844, 1280×720, 812×375, the iframe, 360×640). The 375×667 level 77 coach is now "above" (it was "top"), so Critics 2's n1 is gone.
- **Rods:** 0 rivets or rod samples on counts or tile faces and 0 third-tile crossings over 500 states each at 375, 1280 and the iframe. The gutter scan now flags only the debug levels (v4-linked 2 states, v4-all 1).
- **Power-up bar:** 58 px badges on phones, 44 px in the iframe, 78 px at 812×375. The poor, own and buy states hold.
- **Reports and Gallery payoff:**
  - "Picture complete!" with the picture (now 102×102, from 24×24 boards).
  - Siege reports have no picture. The fail sheet keeps its chips.
  - The Gallery's next tile keeps its gold border and Play chip (sheet `e`, bottom row).
- **Tray, bands, home and settings:** unchanged and clean.

## 6. Findings summary

| Severity | Finding | Fix |
|---|---|---|
| MAJOR | V1: Siege variety. One colour per role over 100 levels; within-era layout match medians 0.53–0.67 (Gallery 0.23); Era 3 against Era 4 0.39. | Levers 1–3 and 7 first (no palette risk). Then lever 4 as pre-validated scene palettes. Gate the bake on a within-era match ≤ 0.40. |
| MINOR | m1: the entry square is barely marked. | A timber arch or gate over the 3-cell gap, or a path from the crates. |
| MINOR | m2: the Era 3/4 keep reads as a face. | Move the door off-centre or make it a gate arch, use 3 windows or arrow slits, or put the banner over the middle. |
| MINOR | m3: 375×667 Era 4 boards are small (8.0–8.5 px, 170–200 px wide). | Accept, or let Era 4 pictures run a column or two wider (landscape-ish 22×26) so phones use the width. |
| MINOR | m4: 24×24 emoji lose fine detail (Dragon). | Accept; per-picture 24×28 where identity suffers. |

**Portal verdict:** CrazyGames accepts. Poki would not reject on sight, but V1 is what a reviewer would remember after a few levels. Fix the layout and silhouette variety (levers 1–3 and 7) before a Poki submission.
