# Sapper's Path v4.2: VISUAL critic

HEAD `35e760f` (branch `sappers-path`, `?v=26`), my own server on :8493. 2026-10-03.

**Portal verdict:**
- **Portrait phones and desktop: accept.** On portrait phones and desktop, v4.2 is the best-looking build yet. Boards fill the phone, the castles and Gallery pictures read as detailed pictures, and nothing regressed. CrazyGames would accept it on desktop and portrait mobile today.
- **Landscape phones: fix first.** Before claiming landscape support, fix B1 and V1, or declare the game portrait-only and show a "turn your phone upright" screen.
- **Poki:** the same.

**Counts: 1 blocking, 1 major, 5 minor.**
- `SP.selfTest()`: 1017 pass, 0 fail. 0 console errors or warnings in every run.
- **Captures:** `tools/shots-v4.2-critic/visual/`, at 375×812, 375×667, 1280×720, 812×375 and the 400×600 iframe. Contact sheets are `visual/sheets/s1..s4`.
- **Probes:**
  - `visual-fill.mjs` (`fill.json`): stage against frame and cell size at 7 viewports, and 2-digit count fit.
  - `visual-turned.mjs` (`turned.json`): rotated boards on landscape phones.
  - `visual-probe.mjs` (`probe.json`): coach, bar and Gallery.
  - My Critics 1 rod and gutter scans.
  - The variety measures, re-run on 26–100.

---

## 1. Does the board fill the phone?

These are the CSS px of the stage (the board area) left unused by the board frame, from `fill.json`:

| Viewport | Levels 26+ (42×41) | Teaching (38×37) | Level 77 (34×33) | Gallery emoji | Gallery paintings | Level 25 (unchanged) |
|---|---|---|---|---|---|---|
| 375×812 | 8.0 px, unused 13 w × 54 h, 84% fill | 8.67 px, 20 × 67, 80% | 9.33 px, 76% | 8.33–9 px, 81–89% | 8.0 px, 13 × 158, 61% | 15.67 px, 89% |
| 390×844 | 8.33 px, 14 × 71, 81% | 9.33 px, 82% | 10.33 px, 83% | 8.67–10 px, 78–98% | 8.33 px, 58% | 16.67 px |
| 375×667 (2 rows) | 8.0 px, 13 × 0, 97% | 9 px, 99% | 8 px, 65% | 8 px, 82–87% | 8 px, 84% (3 rows) | 11 px, 129 px unused width, 62% |
| 414×736 (2 rows) | 9.0 px, 10 × 0, 98% | 8.5 px, 65 × 63, 71% | 9.5 px, 73% | 8–9 px, 82–83% | 9 px, 84% | 12.5 px, 138 px unused width, 63% |
| 400×600 iframe | 7.5 px, 61 × 15, 81% | 8.5 px, 83% | 8 px, 61% | 8–8.5 px, 77–92% | 8.5 px, 74% | 13.5 px, 72% |
| 812×375 | 8.33 px, 97%, **turned** (V1) | 9.33 px, 98% | 10.33 px | 8.67–9.33 px | 9.67 px | 13.67 px |
| 1280×720 | 15 px, 96% | 17 px, 97% | 18 px | 15–16 px | 16 px, 74% | 22 px, 82% |

**Verdict: yes on portrait phones.**
- **375×812:** the board is width-bound at 8 px and fills the width. The 54 px of spare height splits above and below, and doesn't read as wasted (sheet `s1`, top row).
- **375×667 and 414×736:** 97–98% fill.
- **Residual gaps** (minor m1):
  - The teaching boards at 414×736: 65 px each side.
  - Level 77 at 375×667: 65% fill.
  - Paintings on portrait phones: 58–61%, a landscape aspect (already LATER m10).

**The iframe at 7.5 px** (minor m2): level 100 reads, but it's dense (sheet `s1`, bottom right). It's inside the small-frame floor of 6.

### B1 (BLOCKING): small landscape phones draw a thumbnail board

- **Screenshots:** `667x375-l64.png` (sheet `s4`, right).
- **Measured:**
  - At 667×375 (iPhone SE/8 landscape) the page keeps the stacked phone layout: the rail is 544 px wide under the board. The board is 105×113 CSS px: **2.5 px cells** on levels 40, 64, 100 and Pizza.
  - At 740×360 (common Android landscape) the cells are 1–2.5 px.
- **It predates v4.2:** level 1 is 6 px and level 25 is 5 px at 667×375, and their boards haven't changed. v4.2's bigger boards take it to unplayable.
- **Why it's blocking:** any player who holds a small phone sideways gets an unplayable game.
- **Fix, either one:**
  - (a) Treat any viewport with `w > h && h < 480` as the short-wide layout (board left, rail right), whatever the width. `wideMinPx` (760) currently gates it.
  - (b) Below 760 px wide in landscape, show a full-screen "turn your phone upright" card, and declare portrait on the portal.

  (b) is one CSS media query and an overlay.

### V1 (MAJOR): landscape phones draw the pictures sideways

- **Screenshots:** `812-turned-64.png` (sheet `s4`, left), `812-l100-boss.png` (sheet `s3`).
- **Measured** (`turned.json`): at 812×375 and 844×390, 75 of 100 Siege levels (every level from 26) and 39 of 60 Gallery pictures draw `turned`, rotated 90°, with the sky on the left.
- **Why it's major:** for a picture game a sideways castle or pizza is a clear defect. v4.1's smaller boards stayed upright here, so this is a regression caused by the bigger boards crossing `layout.rotateBelowCss`.
- **Fix:** never turn a `pic` board. An upright 42×45 board (yard included) in the 367 px stage is 8.1 px a cell, above the landscape floor of 6. Remove the rotate path for picture boards, or set its threshold under the floor.

## 2. Bigger castles and variety

**Reading as pictures: better.**
- At 40×39 the castles get windows, crenellations, cone roofs, banners, trees and bank paths (sheet `s1`). At 8 px the one-cell black outline is still the heaviest line on the board, and the silhouette reads first.
- The 2× zoom of level 88 (sheet `s3`) shows clean studs with no muddy cells. Sappers stay visible against the walls.
- **Clutter:** none added. Archer rings are quiet at rest.

**Variety on 26–100** (my 10×14 measures, frame and teaching levels excluded; medians):

| Era | Layout | Colour | Silhouette | v4.1 fix (layout / silhouette) |
|---|---|---|---|---|
| 2 | 0.37 | 0.21 | 0.66 | 0.43 / 0.71 |
| 3 | 0.35 | 0.20 | 0.71 | 0.39 / 0.74 |
| 4 | 0.41 | 0.33 | 0.76 | 0.41 / 0.74 |

**Variety held, and improved in Eras 2–3.** The skies on 26–100 are day 29, night 18, dawn 15, winter 10 and dusk 3.

**m3 (MINOR, carried from v4.1): Era 4's silhouette median is 0.76.** The towers flanking a cream keep still dominate Eras 3–4 at thumbnail size.

## 3. Gallery pictures at full size: better than v4.1

- **Sheet `s2`:**
  - Emoji are converted from the source at the 39-cell box, not upscaled, so there's no blockiness or doubled pixels.
  - Pizza, Cat, Dragon and Goblin King's Hoard read crisp.
  - Dragon gets its cheek curls back (v4.1's m4 is resolved).
- **Paintings:**
  - The Great Wave reads well.
  - Red Fuji reads, but sits letterboxed (61% fill) on a portrait phone.
- No picture reads worse than v4.1.

## 4. Level 25 to 26: fine

- **At 375×812** the cells halve, from 15.67 px to 8.67 px, and the picture gets far more detailed (sheet `s1`, the first two).
- **Why it works:** the change lands on the Era 2 opener and a teaching level with its coach ("A locked gate! Dig out its gold key first."). It reads as a new chapter, not a glitch.
- **m4 (MINOR):** at 375×667 and 414×736, levels 1–25 leave 129–138 px of unused width (62–63% fill). Those boards fit the height and stay narrow. Peter kept 1–25 as they are, so accept it; the one cheap option is to let Era 1 boards on short phones take 2 queue rows like 26+ do.

## 5. Two-digit counts up to 99: fit everywhere

- **Measured:** the widest count glyph takes at most 0.48 of its tile's width: 375×812 (36 px in 57 px tiles), 390×844 0.45, 375×667 0.40, 414×736 0.42, the iframe 0.30, 812×375 0.42 and 1280 0.44.
- **Slots:** "60" is 21 px of a 65 px slot at 375×812, 24/65 at 375×667, 20/71 in the iframe and 33/95 at 1280.
- **Jam sheet chips:** "66 5 45 67 60" fit (`375-fail-report.png`, sheet `s3`).
- No overlaps with badges.

## 6. Regression: clean

- **Coach fit:** 0 clipped, 0 over the board, 0 over the level number on levels 1, 2, 3, 35, 51, 62, 76 and 77 at all 8 viewports. 375×667 and the iframe use "top" for one level, without clipping. Minimum cell 8.0 px.
- **Rods:** 0 on counts, 0 on faces, 0 third-tile crossings over 892 states each at 375, 1280 and the iframe. The gutter scan finds 0 shared gutters (level 78's lanes are gone, along with the old deal).
- **Power-up bar:** 58 px badges at 375×812, 48 px at 375×667 (the compact 2-row bar), 44 px in the iframe and 77 px at 812×375. The poor, own and buy states hold.
- **Reports:** win and fail sheets are unclipped.
- **Gallery payoff:** the win picture is 157×153 with "Picture complete!", and the next tile has its gold border and Play chip.

## Findings

| Severity | Finding | Fix |
|---|---|---|
| BLOCKING | B1: at 667×375 and 740×360 landscape the stacked layout draws 1–2.5 px cells (it predates v4.2; v4.2 makes it unplayable). | Short-wide layout for any `w > h && h < 480`, or a "turn upright" overlay plus portrait-only on the portal. |
| MAJOR | V1: at 812×375 and 844×390, 75/100 Siege and 39/60 Gallery boards draw rotated 90° (a regression from v4.1). | Never turn `pic` boards; upright is 8.1 px. |
| MINOR | m1: teaching boards at 414×736 (71% fill), level 77 at 375×667 (65%), paintings on portrait phones (58–61%). | Accept, or size the teaching boards per phone; paintings are LATER m10. |
| MINOR | m2: the iframe Siege at 7.5 px is dense. | Accept (floor 6), or let the iframe drop to 1 queue row on 42×41 boards. |
| MINOR | m3: Era 4 silhouette median 0.76. | A second Era 4 silhouette family (carried from v4.1). |
| MINOR | m4: levels 1–25 leave 129–138 px of width unused on 375×667 and 414×736. | Accept per Peter, or give Era 1 boards 2 rows on short phones. |
| MINOR | m5: Red Fuji and the other landscape paintings letterbox on portrait phones. | LATER m10 (portrait crops). |

---

## Re-check (after fix pass)

HEAD `110e51a` (branch `sappers-path`, `?v=27`), my own server on :8493. 2026-10-03.

**How I checked:**
- Probe: `tools/shots-v4.2-critic/recheck-upright.mjs`, results in `recheck/upright.json`.
- Screenshots: `recheck/`, with sheet `recheck/sheets/r1-upright.png`.
- 0 console errors or warnings.

| Item | Status | Evidence |
|---|---|---|
| **B1** small landscape phones | **Fixed** | See B1 note below. |
| **V1** rotated pictures | **Fixed** | See V1 note below. |
| Portrait phones | **Unchanged** | See portrait note below. |

**B1 note.**
- **Touch phones held sideways** (667×375, 740×360, 844×390, mid-play on level 64): each shows the "Turn your phone upright" card, a phone icon with a turning arrow, in gold on the wall.
  - The game pauses: `SP.paused()` is true, and the clock moved 0 ms over 1.2 s of real time.
  - The home screen shows the card too.
  - Turned upright (375×667, 360×740, 390×844) the card hides and play resumes: the clock moved 800 ms in 800 ms. Cells are 8 / 7.5 / 8.5 px, upright.
  - Turned sideways again, the card returns.
- **Never shown on desktop or the portal iframe:** 900×500, 1280×720, 812×375 desktop, 844×390 desktop and the 400×600 iframe. 0 cards and 0 pauses over 7 boards each.

**V1 note.**
- 0 turned boards anywhere.
- 812×375 desktop: level 64 and level 100 are 8 px upright; Pizza 8, Cat 8.5, Red Fuji 9.5.
- 844×390 desktop: 8 / 8 / 8.5 / 9 / 10.5.
- 900×500: 10.5 px.
- The castle sits upright beside the side column (`812x375desk-l100.png`, `844x390desk-l100.png`).

**Portrait note.** The cell sizes match my pre-fix `fill.json`, rounded to the half-pixel steps of dpr 2:
- 375×812: 26 8.5, 40 8, 100 8, Pizza 9, Red Fuji 8.
- 375×667: 8–9.
- 414×736: 8.5–9.5.
- 390×844: 8.5–10.

No card and no turn on any of them.

**Observations, not defects:**
- On a touch phone held sideways, a landscape portal iframe (740×360) also shows the card. That's correct: the alternative is 1 px cells. A portal's own rotate prompt may show on top of it; let the portal listing declare portrait.
- The auto-resume when the phone turns upright is immediate. A 3-2-1 or a "Tap to play" would give the player a beat to grip the phone. That's optional polish.

**New finding.**

**n1 (MINOR). 360-wide Android phones draw 7.5 px cells.**
- **Measured:** at 360×740, upright, the 42×41 boards draw 7.5 px cells. That's under the notes' 8 px phone floor; the board is width-bound.
- **It isn't from the fix pass:** v4.2's board width sets it.
- **Why only a minor:** 7.5 px reads the same as the iframe, which is fine.
- **Fix:** below 380 px wide, trim the stage's side gutter from 8 to 4 px. That gives 8 px cells, or accept.

**Final counts:**
- 0 blocking, 0 major.
- 6 minor: m1–m5 from the first pass (carried, unchanged) and n1.

**Portal verdict:**
- **CrazyGames: accept.** Desktop, portrait phones and the portal iframe all play well. A phone held sideways gets a clean "turn upright" card instead of a broken board.
- **Poki: would not reject on sight.** Declare the game portrait-only on mobile.
