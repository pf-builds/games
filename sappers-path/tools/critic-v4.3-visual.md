# Sapper's Path v4.3: VISUAL critic

HEAD `08fbc65` (branch `sappers-path`, `?v=28`), my own server on :8493. 2026-10-03.

**Portal verdict: not rejected on sight by either portal.**
- **CrazyGames: accept.** The tags, the linked waiting state, the sequential Gallery and the leaner reports all read cleanly.
- **Poki: would not reject on sight.** Fix T1, the home Play button's missing tag, before a submission.

**Counts: 0 blocking, 1 major, 7 minor.** v4.2's carried minors (fill gaps, iframe 7.5 px, Era 4 silhouette, levels 1–25 width, paintings letterbox) are not re-judged here.

**How I checked:**
- `SP.selfTest()`: 502 pass, 0 fail. 0 console errors or warnings in every run.
- **Captures:** `tools/shots-v4.3-critic/visual/`, at 375×812 (dpr 3), 375×667, 1280×720 and the 400×600 iframe. Contact sheets are `visual/sheets/a..d`.
- **Probes** (`visual/`):
  - `visual-shots.mjs`, with tag boxes, fonts and opacity, toasts and panel text in `notes.json`.
  - `home-tag.mjs`.
  - `visual-probe.mjs`: coach, bar and Gallery.
  - `rods-scan.mjs` and `upright.mjs`. These are my earlier tools updated to the one-order-per-level `SP.winOrder()`.

---

## 1. Tags

| Where | Size (CSS px) | Read |
|---|---|---|
| Map node corner | 12 px pixel font, 31×15 pill on a 48 px node (`375-map-era1/2.png`) | Readable at 375. Hard red, Easy teal, Normal unmarked. Locked nodes dim the node but the tag stays at full strength. |
| Level header, under the name | 14 px, 38×17 at 375 and 375×667; 12 px, 35×15 in the iframe; 17 px, 43×20 at 1280 | Clear at a glance (sheet `a`, middle strip). |
| Report, under the title | 20 px, 50×27 | Clear. |
| Gallery tile corner | 13 px, 34×16 | Readable. |
| **Home Play button** | **none** | **T1** |

**Hard reads as distinct but not alarming:** a red pill with cream text (contrast 4.71:1) and a dark inset foot, the same shape as Easy. Nothing flashes, and the board and header colours are unchanged.

### T1 (MAJOR): the home Play button never shows the tag

- **Measured** (`home-tag.mjs`): with the next level 42 (Hard), home shows "▶ Level 42" with 0 tags on the title screen. Level 1 (Easy) on a new save shows "▶ Level 1" untagged (`375-home-new.png`, `375-home-next42.png`).
- **Why it matters:** the home Play button is the main way into every level. A player goes from home into a Hard level with no warning until the board is up. Peter's note asks for the tag shown on the level, Food Hunt-style.
- **Fix:**
  - Put the next level's tag pill on the Play button's top-right corner at 16 px (the same `.tag-hard` / `.tag-easy`).
  - For Hard, also give the Play button a red-gold face (`#e8553a` top on the gold rim), the way Food Hunt colours its hard-level button.

### m6 (MINOR): the Easy pill's contrast is low

- **Measured:** cream on teal `#2f9e8f` is 3.17:1, at 12–13 px on map nodes and Gallery tiles. Hard is 4.71:1.
- **Fix:** darken the Easy face to `#1f7a6f` (5.0:1). It stays teal, but reads as firmly as Hard.

## 2. The linked waiting state and its toast: understood

- **Screenshots:** `375-linked-buried.png`, `1280-linked-buried.png`, `400-linked-buried.png` (sheet `b`, top).
- **The look:**
  - The waiting front card wears a veil, a dashed gold edge and a chain badge, and its rod runs to the buried partner ("?30" in the next column, row 2).
  - At rest it reads as "not ready, tied to that one".
- **The toast:** a tap shakes the card and toasts "Linked squads go together: bring both to the front". That names both the cause and the remedy.
- **m2 (MINOR): on wide screens the toast sits far from the tap.**
  - At 1280 the toast shows at the foot of the board (left), in small type (about 12 px), while the tapped card is in the side column.
  - **Fix:** on wide layouts, anchor the toast above `#tray` in the side column at 16 px, as phones effectively get.

## 3. The space freeing at pickup: reads correctly

- **Measured** (`375-pickup-f0..f3`, sheet `b`, bottom; level 27, the first tap): at 5.97 s the line is 5 free with `occ` 0, while 14 sappers are still out carrying blocks home. The head reads "Squads out · 5 free".
- **What the player sees:** the empty sockets and the little carriers walking down the frame to the bins. A socket doesn't look "free but busy", because the carriers are on the board, not in the line.
- **m1 (MINOR):** the head's "5 free" with sappers visibly walking can still prompt "why are they still going?".
  - **Fix:** add a quiet return count to the head while carriers are out, e.g. "5 free · ↩14", in the cream-soft colour. Or give the carriers a small block over their heads (they may already carry one; at 8 px it's hard to see).

## 4. Gallery with locked pictures: the next one stands out

- **Screenshots:** sheet `d`, at 375, 375×667, the iframe and 1280.
- **What works:**
  - Cleared pictures are full-colour tiles with names.
  - The next picture has a gold frame, a "▶ Play" chip and a dim silhouette.
  - Locked pictures are dark silhouettes under a padlock.
  - The eye goes to the gold tile first.
- **m4 (MINOR): the locked wall pulls focus in the wrong places.**
  - The locked tiles' tags are at full brightness (opacity 1), so the red HARD pills on the dark locked wall are the brightest things after the gold tile. They draw the eye down the wall.
  - Paintings (5, 12, 19) have no silhouette, so their locked tiles are blank dark rectangles.
  - **Fix:**
    - Show locked tiles' tags at 55% opacity.
    - Give locked paintings a frame outline (2 px cream at 30%) or a faint "?" so they read as pictures to come.
    - The wall is still inviting, because the next tile is clear and the silhouettes tease the shapes.

## 5. Report without medals: still a payoff, slightly thinner

- **Screenshots:** sheet `c`: `375-win-hard.png`, `375-win-easy.png`, `375-gal-win.png`, `400-win-hard.png`, `1280-win-hard.png`.
- **What's there:** "Fort razed!" or "Picture complete!", the tag pill, and Time, Taps and Coins with "New best!". Coins are tag-scaled (+5 Easy, +20 Hard). The Gallery report keeps its picture.
- **The medal row's removal left no gap.**
- **m3 (MINOR):** the medal stamp was the report's one moving beat, and nothing replaces it.
  - **Fix:** make the coin count-up the beat: a gold coin burst from the Coins cell. On a first clear, add a "First clear +20" ribbon across the cells. This is the cheap half of the parked m8 (banner, bin burst).
- **m5 (MINOR, carried layout): the desktop fail sheet is mostly blank.**
  - At 1280 the fail sheet is 520×512 with its content in the lower half: about 250 px of blank cream above "Assault failed" (`1280-fail.png`). The win sheet is content-sized at 343 px.
  - **Fix:** size the fail sheet to its content like the win sheet.

## 6. Leftovers from the removed picker: none

- **Home:** the Easy/Normal/Hard row is gone. The era chip sits on the river and the Play button follows; the gap is just grass in the scene.
- **Map:** the difficulty row above the eras is gone, and the eras' header flows straight on.
- **Settings:** Sound, Speed, Colour-blind marks, Done. No dead row (`375-settings.png`).

## 7. Regression: clean

- **Coach fit:** 0 clipped, 0 over the board, 0 over the level number on levels 1, 2, 3, 35, 51, 62, 76 and 77 at 8 viewports. Minimum cell 8.0 px.
- **Rods:** 0 on counts, 0 on faces, 0 third-tile crossings over 898 states each at 375, 1280 and the iframe.
- **Power-up bar:** 58 / 48 / 44 / 78 px with the poor, own and buy states.
- **Gallery win picture:** 157×153.
- **Upright card:**
  - Touch phones held sideways (667×375, 740×360, 844×390) show it, paused with the clock frozen. Upright resumes at 8 / 7.5 / 8.5 px.
  - Never shown at 900×500, 1280×720, 812×375 desktop, 844×390 desktop or the 400×600 iframe.
  - 0 turned boards.
- **n1 (MINOR, carried from v4.2):** 360-wide phones still draw 7.5 px cells.

## Findings

| Severity | Finding | Fix |
|---|---|---|
| MAJOR | T1: the home Play button shows no tag (next level 42, Hard: untagged). | A tag pill on the Play button; a red-gold face for Hard. |
| MINOR | m1: "5 free" with 14 carriers still walking. | "5 free · ↩14" in the head while carriers are out. |
| MINOR | m2: the 1280 linked toast is at the board's foot, small. | Anchor the toast above the tray in the side column, 16 px. |
| MINOR | m3: the report lost its one moving beat (medals). | Coin burst plus a "First clear" ribbon. |
| MINOR | m4: the locked Gallery wall: full-strength tags, blank painting tiles. | Locked tags at 55%; painting tiles get a frame outline or "?". |
| MINOR | m5: the 1280 fail sheet is 512 px with about 250 px blank. | Content-sized, like the win sheet. |
| MINOR | m6: the Easy pill is 3.17:1 at 12–13 px. | `#1f7a6f` (5.0:1). |
| MINOR | n1 (carried): 360-wide phones at 7.5 px. | A 4 px side gutter below 380 px. |

---

## Re-check (after fix pass)

HEAD `fdef7d9` (branch `sappers-path`, `?v=29`), my own server on :8493. 2026-10-03.

**How I checked:**
- `SP.selfTest()`: 508 pass, 0 fail. 0 console errors or warnings.
- Probe: `tools/shots-v4.3-critic/recheck.mjs`, results in `recheck/recheck.json`.
- Screenshots: `recheck/`, with sheet `recheck/sheets/r1.png`.

| Item | Status | Evidence |
|---|---|---|
| **T1** tag on every Play | **Fixed** | See T1 note below. |
| **m1** return count | **Fixed** | The line head reads "Squads out … 5 free ↩14" while 14 carriers walk home (level 27). The count drops as they arrive (↩12 by the screenshot, `sheets/r2-head.png`). |
| **m2** 1280 toast | **Fixed** | The toast sits above the side column's tray, 126 px from the tapped card (was about 809), at 20 px (`1280-toast.png`). |
| **m3** report beat | **Fixed** | See m3 note below. |
| **m4** locked Gallery wall | **Fixed** | Locked tiles' tags are at 0.55 opacity. Paintings show a two-tone stencil instead of a blank tile: Red Fuji, the next picture, reads as a dim landscape (`375-gallery.png`). |
| **m5** 1280 fail sheet | **Fixed** | 520×237, content-sized (was 512 tall) (`1280-fail.png`). |
| **m6** Easy contrast | **Fixed** | Easy face `rgb(31,122,111)` = `#1f7a6f`, 5.0:1. |
| **n1** 360-wide phones | **Fixed** | 360×640 and 360×740: levels 27, 64 and 100 at 8.0 px, Pizza at 8.5–9 px (`360x640-l64.png`). |

**T1 note.** Every Play now carries the tag:
- **Home:** a new save shows "▶ Level 1" with a 16 px EASY pill on the gold face. With level 6 (Hard) next it shows "▶ Level 6" with a HARD pill on a red-gold face (`#e8553a` inside the gold rim) (`375-home-hard.png`).
- **Map:** "Play level 6", red-gold with a HARD pill (`375-map-hard.png`).
- **Report:** "Next level", red-gold with a HARD pill after level 5 (`375-report-next-hard.png`); EASY after level 1.
- **Gallery:** the next tile carries a HARD pill and a red "Play" chip.

Hard reads as a clear warning without alarm.

**m3 note.**
- A first clear of level 1 shows the "First clear +10" ribbon (red-gold) and 8 coins bursting from the Coins cell (`coinfly`) (`375-first-clear.png`, `1280-first-clear.png`).
- **Under `prefers-reduced-motion`:** the ribbon shows with no animation, and the burst coins have no animation and opacity 0.

**Observation, not counted:** mid-burst, the flying coins pass over the end of the sheet's subtitle ("…cleared again.") for a moment (`375-report-next-hard.png`). It's transient. If wanted, start the burst under the subtitle line, or clip it to the stat cells.

**Final counts:**
- 0 blocking, 0 major, 0 minor open from this report.
- v4.2's carried minors (fill gaps on some boards, the iframe at 7.5 px, the Era 4 silhouette, levels 1–25 width on short phones, landscape paintings letterboxed) were not re-judged.

**Portal verdict:**
- **CrazyGames: accept.**
- **Poki: would not reject on sight.** Tags are on every entry point, and the report has its beat back.
