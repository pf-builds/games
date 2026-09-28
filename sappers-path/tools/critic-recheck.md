# Sapper's Path M2: re-check critic (loop 2)

Date 2026-09-27. Target: frozen copy of 54de0db at `http://127.0.0.1:8492/sappers-path/?debug=1` (files in the scratchpad `critic-fix/sappers-path/`). Headless Playwright only: 375×812 DPR 3 touch, 360×780 and 390×844 DPR 3 touch, landscape 812×375, 844×390 and 740×360 DPR 3 touch, and 1280×720 DPR 1 mouse. Board moves were driven with real `touchscreen.tap` / `mouse.click` at `SP.cellCenter` unless a line says "facade".

Scope: the 10 items in `tools/fix-notes.md` (loop-1 MAJORs plus functional minors 2 and 4), plus a regression sweep. Nothing else from the loop-1 reports was re-graded.

Evidence folder, written `$C` below:
`/private/tmp/claude-501/-Users-peter-Documents-Claude/e84ef9ae-3587-408d-915e-5e4b23213819/scratchpad/critic-recheck/`
Contact sheets: `$C/S1-phone.png` (title, map, W1 play, chest tap, W4 win, W4 stuck at 375), `$C/S2-read.png` (glyph test, map with progress, W3/W4 boards at rest in colour and grayscale, cards), `$C/S3-show.png` (crumble frames, win frames, glyphs at device px), `$C/S4-wide.png` (1280 title and win, 812×375 play, 740×360 win, 360 play and map), `$C/S5-zoom.png` (badge and chest close-ups, 11 px glyph zoom). Raw numbers: `$C/phone.json`, `$C/phone2.json`, `$C/desk.json`, `$C/final.json`. Scripts: `$C/*.mjs`.

## Summary

- `SP.selfTest()`: ok at 375×812 (36/36 solved, 270 button checks, 75 ms, 0 fails) and at 1280×720 (36/36, 283 button checks, 56 ms, 0 fails). Also ok under an emulated hidden tab.
- All 10 items: **PASS**.
- Regressions: **none found**.
- Counts: BLOCKER 0 · MAJOR 0 · MINOR 4 (all new, all polish).
- Verdict: **ship to Peter's phone playtest as-is.**

## Item by item

### 1. Chests show their crew: PASS
- Pixel check (facade load, frozen clock) on all 26 chests in 26 levels at 375: I sampled 24 points on the badge ring annulus and matched them against the four material colours. 26/26 match the chest's own crew, 22-24 of 24 points each, 0 hits for any other material.
- Smallest case: w4-02 chest at (7,4), 11×11 board. Cell 30.7 CSS px, chest badge 22 CSS px, torch glyph on the ice ring with the gold "+". It reads at native size (`$C/S5-zoom.png`, "chest w4-02 smallest").
- Real tap on one chest per crew at 375:

  | Crew | Level (chest) | Toast | Pick after | Cleared by 2 s |
  |---|---|---|---|---|
  | stone | w2-t1 (5,5) | "Reach it for +1 mason" | none | yes |
  | hedge | w2-02 (2,5) | "Reach it for +1 goat" | none | yes |
  | timber | w2-04 (1,2) | "Reach it for +1 axeman" | none | yes |
  | ice | w3-06 (3,6) | "Reach it for +1 torchbearer" | none | yes |

- The badge is gone once the chest is claimed: on w2-t1 after the first line move, 0 of 24 ring points match.

### 2. Game UI skin: PASS
- Title, map, banner, buttons and panels now read as a game (`$C/S1-phone.png`, `$C/S4-wide.png`):
  - brick-wall texture behind every screen
  - bevelled stone buttons and gold primaries
  - parchment panels
  - the pixel face on the HUD, cards, headers, panel titles and logo
- No big empty bands at 375:
  - The title art canvas covers 0-813 of 812, with the logo at 28-94, the castle mid-screen and the foot panel at 613-794.
  - Play is top bar 0-56, banner 56-285, board 293-652, rail 652-812. That's contiguous. At 360 it's 0-56 / 56-268 / 276-620 / 620-780.
- Font loads, no silent fallback:
  - `document.fonts` holds one face, "Jersey 10", with status `loaded`.
  - `document.fonts.check('16px "Jersey 10"')` is true.
  - The request `fonts/Jersey10-Regular.ttf?v=4` returns 200 (77,732 B), fetched once (the preload and `@font-face` share the URL).
  - The screenshots show the pixel face, not the system stack.
- Smallest pixel-font size on a visible screen:
  - 16 px, the banner eyebrow "WORLD N" (uppercase, 1.5 px tracking).
  - 17 px, the map eyebrow.
  - Both read cleanly at 375.
  - The 36 elements at 11 px are the debug "All levels" list, which is hidden in normal play.
- Digits against letters (bitmap XOR at 11/16/21 px):
  - 5/S differs by 21-23%, and the loop-1 "4-S" problem is gone.
  - 1 carries a flag, so it separates from l/I.
  - 8/B and 6/G are close (4% and 6-9%) but visibly different at zoom.
  - 0/O are the same glyph. See MINOR-A.
- License:
  - `fonts/OFL.txt` is the full SIL OFL 1.1 text (93 lines) with the Soft Type Project copyright line.
  - `LICENSES.md` has a Jersey 10 row with the designer, the source URL, the license and the date.
  - `file` reports "TrueType Font data … Copyright 2023 The Soft Type Project Authors". I did not diff it against upstream (no download).

### 3. Map headers: PASS
- Checked 12 header elements per world strip (eyebrow, note, name) at 360, 375 and 390, each on a fresh save and on a save with W1-W3 won.
- 0 elements taller than one line, 0 ellipsized (`scrollWidth > clientWidth`), 0 past the header's right edge.
- The eyebrow-to-note gap is at least 120 px at 360.
- "Win 6 in World 1" stays on one line, with the lock icon (`$C/S4-wide.png`, 360 map).

### 4. Banner world tag contrast: PASS
- The tag pill is `rgba(20,16,28,.78)`.
- Method: I took the brightest banner-canvas pixel under the tag rect in each world and composited the pill over it. It was pure white in all four worlds (a cloud, the moon or a star).
- Worst-case background `rgb(72,69,78)`:
  - gold eyebrow `#ffe27a`: **7.34:1**
  - white name: **9.39:1**
- This holds in W1, W2, W3 and W4. Because the pill alpha bounds it, no sky can go lower. M2 was 1.68:1.

### 5. Pickaxe and axe badges: PASS
- 11×11 at 375, board badge 26 CSS px (`$C/S5-zoom.png`):
  - The pickaxe is a thick crescent head on a diagonal handle. It no longer reads as "T" or "7".
  - The axe is a double-bit axe with filled blades.
- Both hold in grayscale, and both stay recognisable when dimmed.
- The ring is the material colour, matching the cards: grey for stone, brown for timber, green for hedge, ice-blue for ice (`$C/S2-read.png` cards against the boards).

### 6. Reachable at a glance before a pick: PASS
- Boards at rest (`$C/S2-read.png`):
  - w3-10: 4 live of 16 standing sections (engine `legalMoves`)
  - w4-05: 4 of 16
  - w4-10: 3 of 17
- The live sections carry a bright inner outline and a full badge. Everything else has its badge at 0.38.
- On w4-05 the full-brightness set is exactly the 4 legal moves: top timber, left hedge, right ice and bottom stone.
- In grayscale, the dimmed and full badges separate clearly, and the outline reads as a light line.
- One wrinkle: chest badges are never dimmed (MINOR-B).

### 7. Level names, top bar: PASS
- There are 36 distinct names, none a placeholder. w3-t1 is "Melt the Bridge". The longest is "Iron and a Lever" (16 chars).
- The top bar shows "N-M Name" and the banner shows "WORLD N / world name". Examples: "4-6 Warlord's Yard" under "World 4 / The Goblin Keep", and "1-5 Mason's Knock" under "World 1 / The Outer Bailey". They no longer repeat.
- No top-bar name is cut at 360, 375 or 390 (0 of 36 at each).
- Data check (Node, my own compare of `levels/levels.json` against loop-1 `critic-m2/sappers-path/levels/levels.json`):
  - 36/36 ids in the same order.
  - grid, muster, chests, min and line are each 36/36 identical.
  - With every `name` key stripped, the whole file is byte-equal.
  - The world names are unchanged.
  - `pool-w1..4.json` and `teaching.json` are identical.

### 8. Crumble: PASS
- Facade, all 128 line breaks over 36 levels:
  - `crumbleEnd - popT0` is 600-860 ms at 1×.
  - At 2× the ratio is exactly 0.500 on every break, both the crumble and the full show (max 430 ms).
- It's tile by tile with rubble and dust (`$C/S3-show.png`):
  - w4-t1 first break (stone L), frame by frame:

    | Time | What shows |
    |---|---|
    | +80 ms | cracks |
    | +250 ms | tiles popping in order while others still stand |
    | +450/650 ms | grey rubble chunks on the ground |
    | +900 ms | settled rubble and faint dust |

  - w3-05 timber shows brown chunks the same way.
- Skippable with real input: I committed w3-05's first break (show 1270 ms) and tapped open ground 200 ms later. `show.active` went false at once.

### 9. Win payoff and timing: PASS
- Payoff (`$C/S3-show.png`, w4-06, keep +60/260/520/1000 ms):
  - a keep flash with two rings of thick rays
  - multicolour confetti
  - a goblin at about 2 cells on the keep, then marching
- Winning tap to panel at 1× with real input:

  | Viewport | w1-05 | w4-06 | w4-t1 |
  |---|---|---|---|
  | 375 | 1.31 s | 2.28 s | 2.38 s |
  | 1280 | 1.31 s | 2.28 s | not run |

- Facade over all 36 levels: max 2.375 s (w4-t1), World 4 mean 2.29 s, none over 2.5 s. The panel always lands 480 ms after the keep. The margin on w4-t1 is 125 ms.
- Primary is "Next" and hittable in every run. A real tap on Next after the w4-t1 win loaded w4-02.
- Tap to skip: the panel lands 247 ms after the winning tap at 375 (with the skip tap at about +150-200 ms), and 196 ms at 1280.
- At 1280 the card sits at x 998-1262 against the board at 331-970. That's 0 px of overlap with the board and 0 px with the keep, both at panel time and 1.5 s later (`$C/S4-wide.png`).

### 10. Landscape rail: PASS

| Viewport | Rail | Board | Page overflow | Play buttons hit | Win-panel buttons |
|---|---|---|---|---|---|
| 812×375 | 122-286 | 55-353 | none | 9/9 | all hit |
| 844×390 | 129-293 | 49-374 | none | 9/9 | all hit |
| 740×360 | 114-278 | 84-308 | none | 9/9 | all hit |

- "Page overflow" means `scrollHeight`/`scrollWidth` compared with the viewport.
- The compact 2×2 cards apply.
- A real-tap move works in all three.

## Regression sweep

- **selfTest:** ok at 375 and 1280 (above).
- **Real-input win and stuck, W1 and W4:**
  - At 375:
    - wins on w1-05, w4-06 and w4-t1, all 3 stars
    - stucks on w1-t3 and w4-02
    - the stuck panel's Undo by real tap backs out one move and closes the panel
  - At 1280:
    - wins on w1-05 and w4-06
    - stucks on w1-t3 and w4-02
    - the stuck panel's Restart by real click resets to 0 moves
- **Console:** 0 errors and 0 page errors in every context: phone, desktop, 3 landscape, 360/375/390 fresh and with a save, and hidden.
  - The only warnings logged were Chrome's Canvas2D "willReadFrequently" notice, raised by my own `getImageData` probes. Runs without probes logged 0.
- **elementFromPoint:**
  - Every visible control on each screen hits itself:
    - title: Play
    - map: 32 visible nodes plus back and mute at 375, 45 at 1280
    - level: 7/7
    - win: Next, Replay and Map
    - stuck: Undo and Restart
    - landscape: play and win
  - The only "misses" are play-screen controls sitting under the title and map overlays or under a panel. That's the known parked functional MINOR 6, not new.
- **Touch targets:** 0 visible buttons under 44×44 on title, play and win at 375, or on play at 812×375.
- **Hidden tab:** true background tabs aren't available in headless Chromium, so I emulated one:
  - `document.hidden`/`visibilityState` overridden to hidden and rAF parked, from before load.
  - While hidden: selfTest ok, a w1-05 win on the manual clock, 0 blank sprite caches.
  - On show: the queued rAF resumed, the clock advanced, 0 blank tiles and 0 errors.
- **Frames:** a real-time w4-t1 winning show at 375 ran mean 16.56 ms, p95 16.8, max 16.8, over 182 frames (headless, no GPU compositing).
- **Cache busting:** `?v=4` is on all 13 subresources: 9 scripts, `style.css`, the font, `config.json` and `levels/levels.json`. Only the HTML entry has no query, which is expected.
- **Payload, cold load:**
  - 14 files, 298,888 B (291.9 KiB)
  - 0 external requests, 0 failed
  - M2 was 193 KB, and the font is 77.7 KB of the increase.

## Findings

### BLOCKER
None.

### MAJOR
None.

### MINOR

**MINOR-A. Jersey 10 draws 0 and O as the same glyph.**
- Repro: render "0O" in the page's "Jersey 10" at 11, 16 or 21 px (`$C/S5-zoom.png`, bottom strip).
- Evidence: the two are identical by eye, and l and I are identical too. 1 is distinct.
- Impact: none today. Every numeric string (level tags, HUD, map stars) is digits only, and no level name has a digit.
- Keep it in mind before adding mixed strings such as codes or "W1-O".

**MINOR-B. Chest badges are never dimmed, so a buried chest looks as live as a breakable wall.**
- Repro: at 375, `SP.load("w4-05")` or `SP.load("w3-10")` and look before any pick. Grayscale makes it clearer (`$C/S2-read.png`).
- Evidence:
  - w4-05's torch chest deep in the courtyard and w3-10's goat chest draw at full brightness in the middle of 0.38-dimmed badges.
  - The chest body and gold "+" tell them apart on a second look.
- Fix idea: dim unclaimed chest badges whose chest cell isn't on connected ground yet, like sections.

**MINOR-C. The landscape win panel covers the board's right column.**
- Repro: on w4-05, win at 812×375, 844×390 or 740×360.
- Evidence (card left edge against board right edge):

  | Viewport | Card left | Board right | Overlap |
  |---|---|---|---|
  | 812×375 | 540 | 565 | 25 px |
  | 844×390 | 572 | 594 | 22 px |
  | 740×360 | 468 | 492 | 24 px |

  About two-thirds of a cell is covered (`$C/S4-wide.png`, 740 win). The keep isn't covered.
- Fix idea: cap the panel's left edge at the board's right edge in compact mode.

**MINOR-D. The chest toast sits over the board's top row for 1.8 s.**
- Repro: at 375, tap an unclaimed chest.
- Evidence: the toast is 41 px tall at y 303-344, and the board starts at 293 (`$C/S1-phone.png`, chest tap). It has `pointer-events: none`, so it never blocks a tap. It only hides the top-row art briefly.

## Builder claims checked

Everything I measured matches `tools/fix-notes.md`:
- the crumble range of 600-860 ms and the 0.500 ratio
- the win wait: max 2.38 s on w4-t1, World 4 mean 2.29 s
- the landscape rail bottoms: 286, 293 and 278
- the badge sizes: 26 CSS px, and 22 CSS px for the chest at 11×11
- the contrast worst case: 9.4:1 and 7.3:1
- the rebake proof
- `?v=4` everywhere
- the 291.9 KB payload
- 0 console messages from the game
