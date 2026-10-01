# Sapper's Path v4, Critics 2: VISUAL critic

HEAD `138fd66` (branch `sappers-path`, `?v=22`), my own server on :8493. 2026-09-30. Full game: Siege 1–100, Gallery (60 pictures), M5 meta.

**Portal verdict: not rejected on sight by either portal.**
- **CrazyGames: accept.** It now has the shape of a finished casual title: a home with one Play button, coins, a power-up bar, reports and a collection mode.
- **Poki: borderline.** They would ask for polish rather than reject. The gaps are the Gallery's payoff (V2), clipped teaching lines on common small phones (V1), and the thin win moment.

**Counts: 0 blocking, 2 major, 10 minor.**
- `SP.selfTest()`: 1010 pass, 0 fail. 0 console errors or warnings in every capture run.
- **Captures:** `tools/shots-v4-critic2/visual/`. There are 100 PNGs at 375×812 (dpr 3), 375×667 (dpr 2), 1280×720, 812×375 (dpr 3) and the 400×600 iframe. Contact sheets are `visual/sheets/c1..c7`, and the measurements are in `visual/notes.json`.
- **Probes:** `visual-probe.mjs` (coach fit at 375×667, 360×640, 390×844 and 414×736; the "+" when broke; Gallery tiles), plus my Critics 1 rod, gutter and tray scans re-run (`visual/rods-tray.json`, `visual/gutter.json`).

---

## 1. Blind framing (sheet `c1-blind.png`)

The sheet puts Food Hunt 5, 6 and 7 beside our 375 home and our level 40 with the power-up bar.

Our screens now carry Food Hunt's whole structure:
- **Home:** one dominant "▶ Level 41" Play button (251×64), a top row (gear, 40/100, coins), a hero scene and a bottom tab bar.
- **Play:** the board, then sockets, then a 3-row queue on stepped bands, then a power-up bar of 4 round badges with "+" buy pills and owned counts. The coin balance sits in the bar.

What Food Hunt still does better on sight:
- A bigger, brighter reward language: the level number in a hole, event widgets with red badges, and a chunky 3D Play button.
- A purple power-up band with colourful icons, against our dark band with cream discs.
- Its picture stays the hero of the screen. Our siege board is a dark field.

None of this is a rejection reason. Our home is clean, has a clear hierarchy and is bright (the castle scene). The play screen reads as the same genre at the same level of finish.

---

## 2. Findings

### MAJOR

**V1. The teaching coach clips when it falls back to the top bar on common small phones.**
- **Screenshot:** `667-teach-l62.png` (sheet `c7`, 4th) reads "uads go out together: 2".
- **Measured** (`visual/probe.json`):

  | Viewport | Level | Coach box | Font | Clipped | Line |
  |---|---|---|---|---|---|
  | 375×667 (iPhone SE/8) | 62 | 124×38 | 15 px | yes | |
  | 375×667 | 77 | 124×38 | 15 px | yes | the short line "Linked squads: 2 spaces." |
  | 414×736 (iPhone 8 Plus) | 76 | 163×44 | 15 px | yes | "One space is locked. Its key is on the board." |

  360×640 and 390×844 are clean.
- **Why it matters:** these are the lines that teach linked squads and the locked space, on two of the most common phone sizes. This is a regression of Critics 1 m3/N4 at viewports the harness doesn't cover.
- **Fix:**
  - On a teaching level, try 2 queue rows with the coach band above the board *before* falling back to the top bar. At 375×667 the 2-row frame frees about 50 px, more than the 46 px band.
  - When "top" is still needed, let the coach span from after `#lvl-num` to `#btn-retry` (about 200 px at 375), use the `short` line, and allow 2 lines at 13–14 px.
  - Add 375×667 and 414×736 to the harness's coach-fit checks.

**V2. The Gallery has no visible payoff.**
- **Screenshots:** `375-gal-win.png` (sheet `c4`, 3rd), `375-gallery.png` and `1280-gallery.png` (sheet `c5`, top).
- **The win report:**
  - It says "Picture razed!" over an empty brown board with four full bins.
  - The picture the player just finished is never shown again. The only time the player sees it whole is at the start of the level.
  - In a collection mode the picture *is* the reward. "Razed" is the siege's word, and it reads wrong for a picture you're collecting.
- **The Gallery screen at 0/60:**
  - It is 60 grey silhouettes on dark brick, with the same style for every tile, so nothing says "start here".
  - The 375 view shows 3 columns. The header ("0/60 cleared E0 N0 H0 coins 0") is small.
- **Fix:**
  - In the Gallery win report, draw the finished picture above the three stat cells (its grid at 4 CSS px a cell, about 130 px tall, on its own background). Say "Picture complete!" with "Added to your Gallery".
  - Optionally play a 1 s rebuild: blocks fly back from the bins into the picture before the sheet slides up.
  - On the Gallery screen, give the first uncleared picture a gold border and a "Play" chip. Show cleared pictures in full colour (selfTest says they are; confirm the contrast against the dark wall). Consider a lighter panel behind the grid, like the stone tray.

### MINOR

**m1. Some painting colours are hard to tell apart in the queue.** The builder flagged 42 faded pairs.
- **My count:** 29 ordered pairs (one colour faded to row 2 or 3 against another at the front) under ΔE00 20, in 7 of the 9 paintings. None under 12.
  - Worst per painting: Teapot and Fruit 12.0 (navy faded vs slate, 7 pairs), Irises 14.2 (slate vs grey), Roses 14.6 (grey vs sand, 7 pairs), Apples and Primroses 14.6 (black vs dark brown), Red Fuji 15.2, Wheat Field 17.3, Oleanders 18.2.
  - Emoji and our own pictures have none.
- **Screenshots:** `1280-gal-met-437999.png` and `1280-gal-met-436528.png` (sheet `c6`, bottom).
- **What it looks like:**
  - Teapot's queue shows an olive family (45 / 14 / 11 / 3) and a navy family (42 / 46 / 36) that read alike.
  - Irises mixes white and cream (40 / 20 / 23 / 15).
  - Teapot is also the muddiest picture: dark ground, the teapot hard to find.
- **Judgement:** pairs of 15 and over are acceptable for paintings. The size step and the darker bands separate the rows, and front-row pairs keep 20.3 or more. Fix the four paintings under 15 with the converter's own lightness push (the emoji and our pictures already get it), with a floor of 16 for paintings, and drop or re-crop Teapot and Fruit.

**m2. An unaffordable "+" looks exactly like an affordable one.**
- **Screenshot:** `375-l40-bar-broke.png` (sheet `c3`, top right).
- **What happens:** with 10 coins, all four badges keep the green "+" and their price pill (class `pw buy`, opacity 1, no filter). A tap gives a toast ("Ladder costs 120: you have 10 coins"), so it isn't a dead button, but it promises a purchase it won't make.
- **Fix:** when coins are below the price, grey the "+" (`#8a8496`) and draw the price in red ink (`#c0392b`), while keeping the tap and toast.

**m3. The Recall icon is ambiguous.**
- **Screenshot:** sheet `c3`, at 34 px on phones.
- **What's wrong:** the ladder, the crate with its arrow and the spyglass read. The ivory recall horn reads as a pipe or a boot.
- **Fix:** a curled horn with a visible flared bell, or a back-arrow (↶) over a sapper helmet, since Recall pulls a squad home.

**m4. The iframe's badges are smaller than a comfortable tap target.**
- **Measured:** 41×41 px badges with 23 px icons in the 400×600 iframe, under the 44 px guideline. The compact bar at 375×667 is 48 px; the full bar on phones is 58 px.
- **Fix:** 44 px badges in the iframe. The bar has 46 px of height, so take 2 px from each side of the band and shrink the coin pill.

**m5. The landscape power panel is mostly padding.**
- **Measured:** at 812×375 the power panel is 348×134 with 50 px badges in one row (y 279–329), leaving 42 px above and 42 px below (sheet `c3`, 812 crop).
- **Fix:** use `pwFit`'s 2×2 rule here as on desktop. Two rows of about 56 px badges fit, or the panel shrinks to the badge row and the queue gets the height back.

**m6. On the home screen the era chip sits on the crew figures.**
- **Screenshots:** `667-home-mid.png`, `400-home-mid.png`, `812-home-mid.png`, `1280-home-mid.png` (sheet `c2`).
- **What's wrong:** "Era 2 · Motte and bailey" covers the middle two of the four figures standing on the grass. Only at 375×812 do they stand clear.
- **Fix:** anchor the figures to the grass line just above the chip's top minus 6 px, or place them beside the Play stack. Alternatively, drop the chip onto the river band.

**m7. The era report card and the settings sheet carry little information.**
- **Screenshots:** `375-map-top.png` (sheet `c4`, bottom right) and `375-settings.png` (sheet `c2`).
- **Report card:** it is one line of small text ("25/25 cleared E0 N25 H0 · 0").
- **Settings:** the Speed row shows no current value on the right, while Sound shows "On" and Colour-blind shows "Off".
- **Fix:**
  - Give the report card a band: three medal discs with counts at 16 px, and the coin total with its icon.
  - Show "1×", "2×" or "3×" at the right of the Speed row.

**m8. The siege win still has a thin visual moment.**
- **Screenshots:** `375-win-report.png`, `1280-win-report.png` (sheet `c4`).
- **What's good:** the three stat cells with "New best!" and the coin count-up are a real payoff (LATER m5 is partly met).
- **What's still thin:**
  - The sheet sits under an empty brown board.
  - On desktop it is a tall cream panel with its content in the middle and about 150 px of empty cream above and below.
- **Fix:** plant the banner on the razed ground and burst the bins (LATER m5). On wide screens, size the sheet to its content and centre it in the column.

**m9 (carried from Critics 1 N6). Two links can still share one gutter.**
- **Measured:** level 78, steps 13–29, 17 of 543 states, at 375 and 1280 (`visual/gutter.json`). Unchanged.
- **Fix:** as before: a second lane 4 px over, or a per-pair rivet tint.

**m10. Wide paintings waste a portrait phone's height.**
- **Screenshots:** `375-gal-met-57007.png`, `375-gal-mid-fuji.png`.
- **Measured:** Red Fuji (42×29) gets 8.0 px cells at 375×812, and the board fills about 40% of the stage's height, with dark brick above and below.
- **Judgement:** inherent to a landscape picture. Acceptable, but the converter could prefer portrait crops (≤ 34 columns) for paintings shown on phones.

---

## 3. What reads and what works (checked, no finding)

- **Pictures:**
  - Emoji and our own pictures read well at 8–11 px: Pizza Slice, Goblin King's Hoard, Dragon (`c5`).
  - Red Fuji and Irises read as their paintings. Teapot and Fruit is the weak one (m1).
  - Mid-play, the sappers enter from the board edges and eat inward, which reads like Food Hunt's ants (`375-gal-mid-pizza.png`).
- **Power-up bar:**
  - Owned (a dark count bubble) and buy (a green "+" with a price pill) are clearly different (`375-l40-bar-mixed.png`).
  - No dead buttons.
  - At 1280 the badges are 108 px with names under them and fill the side column's foot. The column is fully used (power panel 270 px; no blank tray).
- **Home:** one Play labelled with the level, progress and coins pills, a padlocked Gallery tab ("Opens at 25"), and a clear hierarchy at all five viewports.
- **Critics 1 regression:** all clean.
  - Rods: 0 rivets or rod samples on counts or tile faces and 0 third-tile crossings over 543 states each at 375, 1280 and the iframe.
  - B1 slots, the tray and its bands, the quiet rings on level 100, and the jam chips (`375-fail-report.png`) are all fine.
  - Smallest cells: level 100 at 9.33 px (375×812), 8.0 px (iframe, 2 rows) and 8.0 px (375×667, 2 rows).
  - The only open Critics 1 item is m9 (N6).

## 4. Portal verdict and counts

**Not rejected on sight by either portal.** CrazyGames accepts it as it stands. For Poki, fix V1 and V2 first, then m1–m2 and m8.

**Counts: 0 blocking, 2 major (V1, V2), 10 minor (m1–m10).**

---

## Re-check (after fix pass)

HEAD `984eb5d` (branch `sappers-path`, `?v=23`), my own server on :8493. 2026-09-30.

**How I checked** (I did not use the builder's numbers):
- `SP.selfTest()`: 1015 pass, 0 fail. 0 console errors or warnings.
- `visual-shots.mjs --out recheck`, with the Gallery set now Pizza Slice, Red Fuji, Trophy, Irises, Roses, and Apples and Primroses.
- `visual-recheck.mjs`: coach fit on 8 teaching levels at 8 viewports, buy states, badge sizes, the Gallery's next tile, and the Gallery win report.
- My Critics 1 rod and gutter scans re-run, the painting ΔE00 recomputed from `gallery.json`, and one extra probe for the era card and the rod lane tints.
- Everything is in `tools/shots-v4-critic2/recheck/`, with sheets `s1`–`s4` and `probe.json`.

| Item | Status | Evidence |
|---|---|---|
| **V1** coach clipped in the top-bar fallback | **Fixed** | See V1 note below. |
| **V2** Gallery payoff | **Fixed** | See V2 note below. |
| **m1** painting pairs and Teapot | **Fixed** | See m1 note below. |
| **m2** unaffordable "+" | **Fixed** | `.pw.poor`: a grey "+" (`rgb(125,117,136)`, against green `rgb(63,191,90)` when affordable) and a red price pill. "need N" shows under the badge on wide screens. The tap still gives the toast (`s3`, top row). |
| **m3** Recall icon | **Fixed** | A gold U-turn arrow over a steel helmet. It reads as "bring back", not a pipe (`s3`, `s4`). |
| **m4** iframe badges | **Fixed** | 44×44 px in the 400×600 iframe (was 41). 58 px on phones. |
| **m5** landscape power panel padding | **Fixed** | At 812×375 the badges are 78 px (was 50) and fill the 134 px panel (`s3`). |
| **m6** era chip on the crew | **Fixed** | The chip now lies on the river band. The four figures stand clear on the grass at 667, the iframe, 812 and 1280 (`s4`, top and middle). |
| **m7** era card and settings | **Fixed** | The era card is a 39 px band with 22 px medal discs and 20 px counts (probe). The settings Speed row shows "1×" on the right (`375-settings.png`). |
| **m8** thin siege win | **Part fixed** | On desktop the win sheet is sized to its content (panel 343 px tall, was a 623 px column of mostly cream) and the power-up bar stays in view (`1280-win-report.png`). The banner and bin burst are parked in LATER. |
| **m9 / Critics 1 N6** two links in one gutter | **Fixed in the campaign** | See m9 note below. |
| **m10** wide paintings on portrait | **Parked** (LATER) | Unchanged: Red Fuji at 8.0 px cells on 375×812. |

**V1 note.**
- **Measured:** 0 clipped, 0 coach-over-board and 0 coach-over-level-number on levels 1, 2, 3, 35, 51, 62, 76 and 77 at all 8 viewports: 375×667, 414×736, 375×812, 390×844, 1280×720, 812×375, the 400×600 iframe and 360×640.
- **Modes:** "above" on phones, "side" on wide screens. Only level 77 falls back to the top bar: at 375×667 (17 px, 2 lines) and in the iframe (19 px, 1 line).
- **Cost:** on short phones the teaching levels take 2 queue rows. Level 76 at 375×667 drops to 8.0 px cells, which is still at the floor.
- **Screenshots:** `coach-*.png`, sheet `s1`.

**V2 note.**
- **Win report:** "Picture complete!" with "Trophy is in your Gallery now." and the finished picture as a 142×142 canvas above the stat cells (`galwin-375-trophy.png`, `375-gal-win-fuji.png`, `1280-gal-win.png`).
- **Siege reports** keep "Fort razed!" with no picture (`siegewin-375-l8.png`).
- **Gallery screen:** the next picture has a gold border (`rgb(242,194,48)`) and a "▶ Play" chip. A cleared picture shows in full colour with its name, and the Play chip moves to the next one (`gallery-375-fresh.png`, `gallery-375-after.png`, `1280-gallery-after-win.png`; sheet `s2`).
- **Still true:** the uncleared wall is grey. That's acceptable now that "start here" is marked.

**m1 note.**
- **Measured** (my own ΔE00 recompute):
  - Faded-vs-front pairs under 20 are now 23 ordered pairs in 6 paintings (was 29 in 7). None are under 16.
  - Worst per painting: Irises 16.0, Apples and Primroses 16.2, Roses 16.5, Wheat Field 17.3, Oleanders 18.2, Red Fuji 18.7.
  - The smallest front pair per painting is 20.4 or more.
- **Trophy** (slot 33, `noto-1f3c6`) reads at once: a gold cup on blue with an outline and five distinct queue colours (`375-gal-noto-1f3c6.png`).
- **Visually:** Irises and Roses still carry close greens and creams in the queue (`s3`, `s4`). Each colour is now at least 16 apart, which meets the bar I set.

**m9 note.**
- **Level 78, steps 13–29:** the two rods in the col 3/4 gutter take their own lanes (x 270 and 274) in brass `rgb(176,143,106)` and steel `rgb(143,157,179)`, and read as two links (`375-rods-l78-step13.png`). My 5 px gutter scan still lists level 78 (17 states), because the lanes are 4 px apart by design. The tint is what separates them.
- **Residual, debug level only:** on v4-linked at rest, the 3↔21 rod and 6's stub share the col 0/1 gutter at x 67 and x 73, both brass, and still read as one line (`375-v4-linked-rest2.png`). It isn't in the Siege or the Gallery, so I'm noting it, not counting it.

**Regression pass:**
- Rods: 0 rivets or rod samples on counts or tile faces and 0 third-tile crossings, over 543 states each at 375, 1280 and the iframe.
- The tray, its bands and the B1 slots are clean in every capture.

**New finding.**

**n1 (MINOR). Level 77's top-bar coach at 375×667 wraps with an orphan.**
- **Screenshot:** `coach-375x667-l77.png` (sheet `s1`, 2nd). It reads "Linked squads: 2 / spaces." on two lines at 17 px.
- **Why only a minor:** it is readable and not clipped. The iframe fits the same line on one line at 19 px.
- **Fix:** add `text-wrap: balance`, or use a shorter top-bar line for 77 ("Linked: 2 spaces.").

**Final counts:**
- **Open:** 0 blocking, 0 major, 1 minor (n1).
- **Parked in LATER:** the rest of m8 (banner and bin burst) and m10 (portrait crops for wide paintings).

**Portal verdict:**
- **CrazyGames: accept.** No visible defect is left on any screen I captured.
- **Poki: would not reject on sight.** It is now a credible submission, with a home, meta, power-ups, a collection mode with a real payoff, and clean layouts from 360×640 to 1280×720. What separates it from a Poki feature is juice, not defects: the parked win celebration and a livelier Gallery wall.
