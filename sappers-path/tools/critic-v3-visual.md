# Sapper's Path v3, M2: visual critic

**Verdict: a portal would not reject this on sight. There's nothing broken and nothing that looks like a placeholder, and the UI shell is consistent and finished. It isn't at Food Hunt's level yet: 0 blockers, 6 majors, 12 minors.** The biggest gap is the board. Food Hunt shows a full, many-colour picture. Our boards are flat geometric rings on large areas of empty dark ground, and the desktop (1280) layout, which a CrazyGames reviewer sees first, leaves more than half the screen as empty brick.

Setup: served on :8493, headless Playwright (Chromium). The viewports were 375×812 at dpr 2 (touch), 812×375 at dpr 2 (touch), 1280×720 at dpr 1, and `tools/iframe-host.html` with a 400×600 frame. Scenes were set up through `?debug=1` `SP`. No page errors or console errors in any viewport. All shots are in `tools/shots-v3-critic/`, and the DOM measurements are in `tools/shots-v3-critic/metrics.json`. Food Hunt references: all 4 PNGs plus the README in `game-research/sappers-path-v3/reference/`. I ignored the numbered panels and lock tiles, as briefed.

## Blind comparison

*"Which of these looks like a finished game a portal would accept? List every visible reason."*

**Food Hunt looks finished. Sapper's Path looks like a well-made game whose boards are still diagrams.** Specific reasons:

1. **The picture fills the frame.** Every Food Hunt cell is part of an illustration (heist, horse race, castle landscape, apple), edge to edge. Our forts cover about 25–45% of the board, and the rest is dark olive grass and dark-brown dirt (`375-rest-e1.png`, `375-teach-1.png`, `375-teach-51.png`).
2. **Colour count and variety.** Food Hunt pictures use 10–20 hues, with shading ramps inside a single object: the apple has 4 reds and a highlight, and the horse has 3 browns. Ours are flat single-colour bands. Era 1 L4 is an orange ring, a red ring and green squares. Era 3 L70 is mostly two neutrals, Rubble `#a3aab4` and Ashlar `#f4f1ea`, so the late boards read grey (`375-rest-e3.png`).
3. **Subject matter.** Food Hunt shows a recognisable thing, which makes eating it satisfying. Our Era 1 palisade reads as a wreath or a pizza (`375-rest-e1.png`). Era 2 reads as a motte and bailey. Era 3 reads as a keep with corner towers, which is the best of the three.
4. **Board chrome.** Food Hunt has a thick, light wooden frame on a warm wood background. Ours is a thin tan rim on dark stone brick. It's consistent, but it's darker and heavier overall.
5. **The eaters.** Both have visible little figures in lines. Ours read well at Era 1 (`375-e1-show.png` looks like Food Hunt's ant stream).
6. **Tray.** Both use big numbers on solid colour cards with the next cards visible. Ours is as clear as Food Hunt's and arguably clearer, since it adds crew names and a glyph per material. This is where we match.
7. **Where we're ahead of a bare puzzle:**
   - the coach line and arrow
   - era history notes
   - medals
   - the archer arrow show with a floating label
   - the goblin fleeing with the crown

   These all look deliberate and finished.

## What passes (checked, no finding)

- **Grayscale Era 3 (L70), SPEC §6.** Every material carries a distinct glyph: dots (Rubble), hollow square (Ashlar), X (Crystal), plus (Slate), chevron (Roof tile), stripes (Gilt key), and panels (Hedge/Warded). The fort, the towers, the dashed range rings, the key and the padlock all still read with the filter on (`375-rest-e3-gray.png`). Slate and Roof tile have almost the same luminance (0.166 vs 0.173), so glyph alone separates them. It works at 10 px.
- **Towers and range.** A blue disc with a hooded archer and a red dashed ring reads at a glance (`375-teach-51.png`).
- **Key.** A gold key glyph inside a pulsing ring of the gate's tint (`375-teach-26.png`).
- **Archer hit.** The "13 driven back to the line!" label is legible, the hit runners stop at the ring edge, and the line fills at once (`375-archer-hit.png`).
- **Gate opening.** The lock tumbles and the bars drop (`375-gate-opening.png`, `375-gate-after.png`).
- **Win sequence.** The keep pieces fly, the crowned goblin appears on the ruin, and the blocks pile into the crates. The "Fort razed!" panel has an E/N/H medal row. The N medal pops in and is visible once settled (`375-win-1-collapse.png` → `375-win-2-goblin.png` → `375-win-panel-settled.png`). In `375-win-3-panel.png` the N medal hasn't appeared yet, because it's mid pop-in.
- **Fail panel.** "Assault failed", a named reason ("The holding line overflowed: no space left for the Torchbearers."), and Retry primary (`375-fail.png`).
- **Four-of-five line.** The last free space pulses with a red dashed border (`375-line-4of5.png`; the DOM class is `slot last`).
- **Title → level transition.** Four frames at about 60 ms show no blank or half-laid-out frame. The coach line fades in (`375-trans-0..3.png`).
- **Map at 375.** It scrolls through all 3 eras with titles and history notes. The sticky "Play level 1" never hides the last node row (last node bottom 699 px, button top 734 px) (`375-map-0/1/2.png`).
- **No page scroll** at any viewport (`docScroll` in metrics).

## Findings

### Blockers
None.

### Major

**M1. The level title is truncated in the header on every level at 375 px, and hidden entirely at 812×375.**
- **Evidence:**
  - At 375, `#lvl-name` shows 69 of 144 px for "Palisade stockade", 61 of 132 for "Motte and bailey" and 61 of 90 for "Stone keep".
  - The screens show "Palisad…", "Motte…", "Stone…", "Open G…", "The L…", "The C…" and "The Wa…".
  - At 812×375 the name is `display:none` (`body.wide.short #lvl-name`).
- **Shots:** `375-rest-e1.png`, `375-teach-26.png`, `375-teach-51.png`, `812-rest-e3.png`.
- **Why it matters:** "The C…" and "The L…" on the teaching levels are the most visible truncations in the game.
- **Fix:** Any one of these:
  - Give the name its own row by moving `#lvl-name` under `#lvl-num` at 11–13 px of Jersey.
  - Collapse the "Normal" chip to a one-letter badge (N) to free about 60 px.
  - Show the full name as a 1.5 s banner over the board on level start and keep only the number in the header.

**M2. At 812×375 every tray card's crew name is truncated.**
- **Evidence:** The cards are 51 px wide with 16 px labels. `labTrunc: true` on all 5: "Quarr…", "Sawy…", "Brazi…", "Axem…", "Torch…", "Digge…".
- **Also at 375:** "Torchbea…" (`375-teach-26.png` / `375-gate-after.png`).
- **Shots:** `812-rest-e3.png`, `812-line-near-full.png`.
- **Why it matters:** The crew name is one of the three things SPEC §6 puts on a card.
- **Fix:**
  - In `body.wide.short`, drop the label to 12–13 px. The 67 px portrait cards fit "Quarrymen" at 14 px, so 51 px needs about 11 px.
  - Or widen the rail: the right half of the 812 layout has about 40 px of dead margin on each side of it.
  - Or add a short-name field (Quarry, Torch).

**M3. The boards are sparse diagrams, not pictures.** This is the root cause in the blind comparison.
- **Evidence:**
  - Material covers well under half of the board's area, and the rest is flat dark ground.
  - Forts are 3–6 flat bands of one colour each.
  - Era 3 is dominated by two greys.
- **Shots:** `375-rest-e1.png`, `375-rest-e2.png`, `375-rest-e3.png`, `375-teach-1.png`, `375-teach-51.png`.
- **Fix:** Without changing the rules or the 36×48 cap:
  - Crop the board to the fort's bounding box plus a two-cell margin and the camp, so blocks get bigger and the frame is full.
  - Paint non-material ground decoration: trodden paths from camp to gate, tufts, flowers, a moat shimmer on water, and banners on towers.
  - Give Era 3 accent materials real area, for example roofs (Roof tile) on the keep and towers, and banners. At least 5 materials should be visible in bulk on any late board.
  - Shade Ashlar/Rubble walls with a 2-tone ramp at render time only, so the grey mass has form.

**M4. Holding-line urgency disappears at maximum danger.**
- **Evidence:**
  - At 4 of 5, the free space pulses red, which is correct.
  - At 5 of 5, when any new colour overflows, there's no cue at all: five coloured slots, no red and no "FULL" (DOM: no `.last`, no warning class).
  - The line label "Holding line" is 15 px, wraps to two lines, and is the smallest text on the rail.
- **Shots:** `375-line-near-full.png` vs `375-line-4of5.png`.
- **Fix:** When `line.length === cap`:
  - give the whole `#line` a red rim and a slow pulse
  - swap the label to "FULL" in red
  - on the tray, mark every front card whose colour has nothing in reach and no merge target (a red corner flag). Those are the taps that lose.

**M5. The haul bins don't read at rest.**
- **Evidence:**
  - Each bin is an empty brown open box, and its colour key is a chip of about 3–4 CSS px floating above it.
  - Era 3 has 11 bins, about 25 px each, across the board's bottom edge, and at 375 px this reads as a brown fence strip (`375-rest-e3.png`, and the zoom in the "e1 camp" crop).
  - They only read once blocks pile inside (`375-win-2-goblin.png`).
- **Fix:**
  - Tint each bin's front plank in its material colour, or hang a pennant in the colour.
  - Draw the material glyph at 8–10 px on the plank.
  - Use at least a 6 px key chip.

**M6. The 1280×720 desktop layout wastes the screen, and this is the first view a CrazyGames reviewer gets.**
- **Evidence:**
  - The board is 396×600 at 12 px cells. The rail is about 220 px of cards in a 1280 px window, so more than half the viewport is empty brick.
  - The header stretches the full width: the map button is at x≈50, and the Normal chip, retry, 2× and mute sit at x≈1000–1190, far from the play area.
  - The holding-line label is tiny (8–9 px apparent).
  - On the fail screen, the faded tray rows stick out below the fail sheet.
- **Shots:** `1280-rest-e3.png`, `1280-mid-show.png`, `1280-fail.png`.
- **Fix:**
  - In wide layouts, size the cell from the available height (48 rows into about 660 px gives 13–14 px, and Era 1 at 36 rows gives about 18 px).
  - Scale the rail cards with the viewport (about 100 px wide cards, 56 px counts).
  - Constrain `#top` to the width of the play column.
  - Make the fail/win sheet cover the whole rail.

### Minor

1. **Tents read as traffic cones, and idle sappers are stacked sprite-on-sprite.**
   - The camp tents are about 6 px red triangles with a white stripe.
   - The idle sappers stand in two vertical pairs, one directly on top of the other, which reads as totems.
   - Shots: the "e1 camp" zoom and `375-rest-e1.png`.
   - Fix: make the tents at least 10–12 px wide in canvas colours with a door slit and a pole flag, and scatter the idle sappers horizontally.
2. **In the 400×600 iframe, Era 3 cells are 7.5 CSS px,** below the harness's own `MIN_CELL = 8`, and the board is 248×375. The cards are 48 px tall with 13 px labels, and the third faded tray row sits on the frame's bottom edge.
   - Shot: `iframe-rest-e3.png` (L70, metrics `cs: 7.5`).
   - Fix: in short-portrait frames, hide the third faded card row and give the height to the board.
3. **The 812×375 map loses its era titles and the difficulty switch.** The three columns are unlabelled blocks of history text plus numbers, and the Play button sits over rows 16–20, 36–45 and 66–70 at rest.
   - Shot: `812-map-0.png`.
   - Fix: keep "Era N · name" as a one-line column header, and put the difficulty buttons in the map top bar.
4. **The map has no visual progression.** Levels 2–75 are identical grey tiles, so you can't tell locked from available, there's no path, and there's no era art. Only node 1 is highlighted.
   - Shot: `375-map-1.png`.
   - Fix: dim and lock-glyph unreachable nodes, and add an era header band with that era's fort silhouette.
5. **The fail sheet hides the thing that failed.** At 375 and in the iframe, the sheet covers the holding line and tray, so after "The holding line overflowed" the player can't see the line.
   - Shots: `375-fail.png`, `iframe-fail.png`.
   - Fix: anchor the sheet over the board, or leave `#line-wrap` above the sheet with the overflow flash still running.
6. **The coach arrow sits on the "Holding line" label**, which then reads "Holc" or "Holding" (L1, L26, L51).
   - Shots: `375-teach-1.png`, `375-teach-26.png`, `375-teach-51.png`.
   - Fix: offset the arrow when the target card is in column 0, or move the label above the slots.
7. **Holding-slot counts overlap the little-men strip.** For example, "14" on the white Ashlar slot and "23" on grey: the digits sit on the sprites.
   - Shot: "line slots mid" zoom, `375-mid-show.png`.
   - Fix: raise the number or give it a 1 px ink outline, and keep the men strip clear of it (right-aligned or under it).
8. **Crew-name contrast.** 14 px white labels measure:
   - Hexbreakers `#0fb5a6`: 2.57:1
   - Looters `#c7861a`: 3.06:1
   - Sawyers `#ff3fa4`: 3.23:1
   - Goats `#16a34a`: 3.30:1

   Small text needs 4.5:1. Fix: use the ink `#221a26` text these cards already use for Diggers, Miners and Braziers (5.1–6.6:1).
9. **The range tint recolours stones.** Rubble blocks inside a tower's disc are washed pinkish-mauve, so they look like a different material in a colour-matching game.
   - Shots: `375-rest-e3.png` near the top-right tower, and the "e3 colour" zoom.
   - Fix: tint only ground cells under the disc and keep the dashed outline, or draw the disc under the blocks.
10. **Unexplained bare dirt rectangles on the grass.** Examples: L26 has a large square left of centre, L46 a square below the fort, and L65 one at the lower left. At rest they look like leftovers.
    - Shots: `375-gate-after.png`, `375-line-near-full.png`, `375-mid-show.png`.
    - Fix: texture them as a trodden siege yard or siege works, or leave them out of the render.
11. **The runner stream smears at scale.** On the busiest play (L65 tap 16, 76 eaters) the runners merge into one column about 2 cells wide, so figures and carried blocks become a white smear.
    - Shot: `375-mid-show.png`, "runners" zoom.
    - Fix: fan runners across 3–4 lanes (a lateral jitter of ±1 cell by runner index).
12. **The 812 title's goblin and flag sprite covers the logotype** between "Sapper's" and "Path".
    - Shot: `812-title.png`.
    - Fix: in short landscape, place the castle art below the logo band, or scale the logo down.

## Out of the checklist's reach
- **Only one transition was sampled** (title → play). Map → play and retry weren't frame-sampled.
- **The pause sheet wasn't photographed.** The harness covers it functionally.
