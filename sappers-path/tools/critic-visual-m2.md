# Sapper's Path M2: visual critic report

Date 2026-09-27. Target: frozen copy at `http://127.0.0.1:8492/sappers-path/` (files in the scratchpad `critic-m2/sappers-path/`). Driven headless with Playwright at 375×812 (DPR 3, touch), 390×844 (DPR 3, touch), 768×1024 (DPR 2, touch) and 1280×720 (DPR 1, mouse). Screens driven through the `?debug=1` facade (`SP.load`, `SP.tapCell`, `SP.hold`, `SP.tick`), plus one full level (w1-05) played with real `touchscreen.tap` at 375.

Screenshot folder, written `$V` below:
`/private/tmp/claude-501/-Users-peter-Documents-Claude/e84ef9ae-3587-408d-915e-5e4b23213819/scratchpad/critic-vis/`
Per-viewport files are `$V/<viewport>-<screen>.png`. Contact sheets: `$V/S1-375-flow.png`, `$V/S2-375-play.png`, `$V/S3-375-show.png` (board crops of walk, crumble, lever, chest, keep, goblin, pick), `$V/S4-375-panels.png`, `$V/S5-gray-zoom.png`, `$V/S6-768-1280.png`. Food Hunt reference: `$V/ref/fh-sheet.jpg` (App Store shots 1, 3, 4, 6). Raw numbers: `$V/report.json`. The capture scripts are `$V/cap.mjs` and `$V/rt.mjs`.

## selfTest and console

- `SP.selfTest()` passed at 375×812 (36/36 solved, stuck on w1-t3/w2-02/w3-02/w4-02, 272 button checks, 86 ms, 0 fails) and at 1280×720 (36/36, 283 button checks, 0 fails).
- 0 console errors and 0 game warnings at all four viewports. The one warning in the log came from my own `getImageData` readback.
- Real touch play of w1-05 at 375 won with 3 stars. The panel was up with 1 star lit, and all 3 were lit by +700 ms.
- Every visible button at every viewport is at least 44×44 CSS px (DOM audit on title, map, hint, play, win and stuck).

## Counts

BLOCKER 0 · MAJOR 8 · MINOR 14

---

## 1. Blind framing against Food Hunt

**Which one looks like a finished game a portal would accept? Food Hunt.** These are the visible reasons, from the side-by-side of `$V/ref/fh-sheet.jpg` against `$V/S1-375-flow.png` and `$V/S2-375-play.png`:

1. **Type.** Food Hunt sets every number and label in a chunky rounded display face with a dark outline and drop shadow. Sapper's Path uses the system font for everything: title, HUD, cards, panels and map headers. It reads as a web app.
2. **Buttons and containers.** Food Hunt's are glossy and bevelled, with a darker bottom lip and a drop shadow, so everything looks pressable. Sapper's Path uses flat dark-grey rounded rectangles (`#2f2a38` on `#1d1a24`) for Undo, Restart, the cards and the panels.
3. **Background.** Food Hunt has a warm wood texture edge to edge and no void anywhere. Sapper's Path has a flat near-black void behind the title, the rail, the top bar and the panels. At 375 the title leaves about 155 px empty above the art and about 190 px below Play.
4. **Life on screen.** Food Hunt always has dozens of animated ants moving. Sapper's Path shows one crew sprite, about 1 cell tall, only during a break. At rest the board is static except the moat.
5. **Palette.** Food Hunt's candy palette is shared by the board and the UI. Here the board is muted (sand, grey, brown) and the UI is dark grey, so the two don't share a palette.
6. **Reward visibility.** Food Hunt's picture fills in as you play, so progress is the art. Sapper's Path's reward is a 1-cell goblin and thin yellow rays.
7. **Content polish.** Food Hunt has no placeholder text. Here 32 of 36 level names are "<World name> N", and w3-t1 is named just "The Frozen Moat".

What Sapper's Path does well, stated plainly:
- The board pixel art is coherent and clean.
- The materials read at a glance in colour.
- Nothing is broken, misaligned or overflowing.
- The layout is disciplined: everything in the thumb zone, and every target at least 44 px.

Against Kingdom Rush, the secondary bar:
- KR goblins are big-headed, thick-outlined and hand-shaded, with exaggerated poses. The goblin here is a 16×16 sprite that sits at 1 cell on the board (30.7 CSS px on 11×11 at 375).
- KR castles use warm stone with a strong top-left light and chunky outlines. The title castle here is generic flat-lit grey. The banner "tower" in Worlds 1-3 is a flat green silhouette block that looks like a placeholder next to the detailed wall.

**Would a portal reject this on sight? No.** It clears a basic-launch look test on CrazyGames as a clean, working small puzzle. It would not earn a featured or full launch in this skin. The gap is the UI chrome (type, buttons, background) and the payoff moments, not the board.

## 2. Readability at 375 px

- **Reachable walls in under 3 s:** only after you pick a crew. With a crew picked, the 0.55 dim veil plus the glow makes it instant (`$V/375x812-picked.png`). At rest on 10×10 and 11×11 boards, no. Reachable and sealed sections draw the same texture and the same bright badge; only the ground under them carries a cue (see MAJOR-5).
- **Which crew breaks what:** yes for goat and torch. Pickaxe and axe are weak (MAJOR-4).
- **Crews left:** yes, in under a second. Counts are 26 px, weight 850, 11.6:1 contrast, and zero cards are greyed.
- **Badges at the smallest cell (11×11, 375):** the cell is 30.7 CSS px. The badge disc is 20.7 CSS px (`br = round(92 × 0.34) = 31` device px) and the glyph box is about 12.4 CSS px. The goat and torch glyphs read. The pickaxe reads as a "T" or "7" and the axe as a hook or sickle.
- **Text:** all DOM text is at least 12 px. There are two WCAG AA failures:
  - the banner world tag at 1.68:1 (MAJOR-3)
  - the map level stars at 2.39:1 (MINOR-1)

  Everything else is 6.66:1 or better. Card labels are 12 px at 6.66:1: they pass, but they're small.
- **Hierarchy:** top bar, then banner, then board, then rail. It's clear. The banner takes 236 px (29% of the height) with decoration that repeats the world name already in the top bar. It doesn't steal size from the board, which is width-bound at 356 px.

## 3. Grayscale (`$V/S5-gray-zoom.png` top row, `$V/gray-w1-05.png` … `$V/gray-w4-02.png`)

Median relative luminance Y per cell type, sampled from the live board canvas at 375 (L* in brackets), with texture SD:

| Type | Y (L*) | SD | Reads without colour? |
|---|---|---|---|
| Stone | 0.311 (62.6) | 0.17 | Yes, brick courses |
| Timber | 0.205 (52.4) | 0.14 | Yes, vertical grain |
| Hedge | 0.152 (45.9) | 0.13 | Yes, leaf clumps |
| Ice | 0.767 (90.2) | 0.17 | Yes, brightest tile |
| Iron | 0.066 (30.9) | 0.06 | Yes, darkest, rivet grid |
| Chest | 0.091 (36.2) | 0.08 | Yes, box shape |
| Keep | 0.21 (53.0) | 0.20 | Yes, castle glyph plus frame |
| Lever | 0.212 (53.2) | 0.21 | Weak: small glyph, same tone as timber and keep (MINOR-3) |
| Moat | 0.187 (50.3) | 0.12 | Weak against ground: 2 L* apart, only the dash texture differs (MINOR-2) |
| Ground | 0.174 (48.7) | 0.015 | Flat |

The spec requirement passes: every material, the door, the chest and the keep can be told apart by texture. Lever and moat are the weak spots.

## 4. Feel

- **Crumble:** it doesn't read as satisfying (MAJOR-7). w3-05's 3-tile ice section crumbles in 285 ms (`popT0` → `crumbleEnd`). The tiles flash pale and vanish, with dust specks about 2 CSS px across. That's too small and too quick to register as the payoff, where Food Hunt's eating is the show itself.
- **Win and goblin march:** both are undersized (MAJOR-8). You get thin 1-px yellow rays, a 1-cell goblin that walks up to 6 tiles, and a flat system-font sheet. On desktop the panel covers the keep.

---

## BLOCKER

None.

## MAJOR

**MAJOR-1. The UI chrome and title read as a web page, not a game.**
- **Screens:** title, map, play, win and stuck, at all viewports.
- **Screenshots:** `$V/375x812-title.png`, `$V/768x1024-title.png`, `$V/375x812-win-panel.png`, and `$V/S1-375-flow.png` against `$V/ref/fh-sheet.jpg`.
- **Evidence:**
  - Everything is set in the system font.
  - Every button and panel is a flat `#2f2a38` rounded rectangle on a flat `#1d1a24` void.
  - At 375 the title card leaves about 155 px empty above the art and about 190 px empty below Play.
  - At 768 the title art is 240 CSS px wide in a 768 px screen.
- **Fix:**
  - Bundle one pixel or display font (OFL) for the title, HUD numbers, card counts, panel titles and map headers.
  - Give the buttons a 3 px darker bottom lip, a 1 px light top edge and a drop shadow, with a pressed state that drops the lip.
  - Replace the flat void with the banner scene: sky gradient plus the stone-wall strip, full bleed on the title, and a subtle stone texture behind the rail.
  - Make the title art full width at 375 and scale it up (artPx 4-5) at 768.

**MAJOR-2. The map world headers wrap on phones.**
- **Screen:** world map, fresh and with progress.
- **Viewports:** 375×812 and 390×844.
- **Screenshots:** `$V/375x812-map-fresh.png`, `$V/375x812-map-fresh-bottom.png`, `$V/390x844-map-fresh.png`.
- **Evidence:**
  - At 375, "World 2: The Hedge Garden" (18 px) is 217×42, so 2 lines, and the lock note "Win 6 in World 1" (16 px) is 112×36, so 2 lines. It breaks as "Win 6 in / World 1".
  - Worlds 3 and 4 wrap the same way.
  - At 390 it's worse: the lock note breaks as "Win 6 in World / 1", leaving the digit orphaned.
  - The wrapped second line sits about 10 px above the first node row.
- **Fix:**
  - Put the lock note on its own row under the title, or shorten it to a lock icon plus "6 wins in W1".
  - Split the header into a small "WORLD 2" eyebrow and the name on its own line.
  - Set `white-space: nowrap` on the lock note.
  - Re-check at 360 px width.

**MAJOR-3. The banner world tag fails contrast in Worlds 1-3.**
- **Screen:** play, win, stuck and hint.
- **Viewports:** all. Worst on phones, where the tag is on the brightest sky.
- **Screenshots:** `$V/375x812-mid-w1-05.png`, `$V/375x812-mid-w3-05.png`, `$V/375x812-hint-w3-t1.png`.
- **Evidence:** white "WORLD 1" (12 px, weight 700) and "The Outer Bailey" (16 px) sit on sky `#8fd0f2`. That's 1.68:1, rescued only by a 1 px text shadow. The eyebrow is visibly washed out.
- **Fix:** put the tag on a dark translucent pill (`rgba(20,16,28,.72)`, 6 px radius, 4×8 padding), or use dark ink on the day sky. Target at least 4.5:1.

**MAJOR-4. The mason pickaxe and axeman axe badges are ambiguous, and board badges drop the crew colour.**
- **Screen:** play board and crew cards.
- **Viewport:** worst at 375 on 11×11 boards.
- **Screenshots:** `$V/board-w4-05-crop.png` (native DPR 3 crop), `$V/cards.png`, `$V/S5-gray-zoom.png` bottom row, `$V/375x812-mid-w4-05.png`.
- **Evidence:**
  - The badge is 20.7 CSS px and the glyph about 12.4 CSS px.
  - The pickaxe is a thin T with a curled end, which reads as "T" or "7" on the board and on the Masons card.
  - The axe is a thin hook that reads as a sickle or hockey stick.
  - Both are thin black strokes on the same cream disc, so at arm's length they differ only by the texture under them.
  - The cards give each crew a coloured rim (grey, brown, green, ice); the board badges don't.
- **Fix:**
  - Redraw the pickaxe with a wide, curved, double-pointed head at least 3 art px thick across most of the 12 px box, and a short handle.
  - Redraw the axe with a filled wedge blade.
  - Draw board badges with the same per-crew rim or disc tint as the cards.
  - Test the redraw at a 20 px badge.

**MAJOR-5. Reachable walls are not readable at rest on big boards.**
- **Screen:** play, W3 and W4.
- **Viewport:** 375×812.
- **Screenshots:** `$V/375x812-mid-w4-05.png`, `$V/375x812-mid-w3-05.png`, `$V/390x844-mid-w4-05.png`.
- **Evidence:**
  - Every standing section draws the same texture and the same full-brightness badge, whether it's reachable or sealed.
  - The only cue is the 42% black veil on unconnected ground (`render.js:133`), so you have to trace the ground to infer reachability.
  - w4-05 has about 20 bright badges on an 11×11 board. You can't pick out the 2-3 you can act on in 3 s without first picking a crew.
- **Fix:** at rest, dim the badges of sealed sections to about 35% opacity (or hide them), and keep reachable sections' badges full brightness with the crew-tinted rim. The badge layer is already re-baked on `game.ver`, so this costs nothing per frame.

**MAJOR-6. Level names look like placeholders, and the header repeats the banner.**
- **Screen:** play (top bar).
- **Viewports:** all.
- **Screenshots:** `$V/375x812-mid-w4-05.png`, `$V/375x812-hint-w3-t1.png`.
- **Evidence:**
  - 32 of 36 names are "<World name> N", for example "4-5 The Goblin Keep 5". It sits directly above the banner's "WORLD 4 / The Goblin Keep".
  - w3-t1, the ice teaching board, is named just "The Frozen Moat", while the other three teaching boards have real names ("One Wall", "Goats and a Chest", "Iron and a Lever").
- **Fix:** either give every level a short name (the bake can draw from a word list per world) or show only "Level 4-5" in the top bar. Name w3-t1 after its lesson (for example "Melt the Bridge").

**MAJOR-7. The crumble is too small and too fast to feel like a payoff.**
- **Screen:** play, mid-break.
- **Viewport:** 375×812.
- **Screenshots:** `$V/375x812-walk.png`, `$V/375x812-crumble-a.png`, `$V/375x812-crumble-b.png`, `$V/S3-375-show.png` top row.
- **Evidence:**
  - The w3-05 ice section (3 tiles) goes from first pop to gone in 285 ms.
  - The tiles flash pale and disappear, and the dust specks are about 2 CSS px.
  - There's no debris in the material's colour, no hit-stop and no board shake on a successful break (the nudge is only used for bad taps).
  - In Food Hunt the eating is the entertainment, with visible, sustained progress.
- **Fix:**
  - Go from 55 to about 90 ms per ring and from 230 to about 320 ms per pop.
  - Spawn 4-8 debris chunks per tile in the material's colours, 3-4 art px each, that hop, fall and settle for about 400 ms.
  - Add a 2-frame hit-stop plus a 2 px board shake on the last ring.
  - Rise the tick pitch per ring.
  - For stone, add a brief crack overlay on the swing frames before the pop.

**MAJOR-8. The win and goblin march are undersized, and the desktop panel covers the keep.**
- **Screen:** win.
- **Viewports:** all. Desktop is worst.
- **Screenshots:** `$V/375x812-keep-open.png`, `$V/375x812-goblin-march.png`, `$V/375x812-win-panel.png`, `$V/1280x720-win-panel.png`, `$V/S3-375-show.png` bottom row.
- **Evidence:**
  - The keep burst is 1 px yellow rays about 1.5 cells in radius.
  - The goblin is 1 cell (30.7 CSS px at 11×11, 375) and walks up to 6 tiles.
  - The panel is a flat sheet: "Keep breached!" in the system font with three 44 px glyph stars.
  - At 1280 the panel card spans y 290-486 over a board at 61-700, which covers rows 4-7 of 11, including the keep where the goblin taunts.
  - At 375 and 768 the panel covers the bottom 36 px of the board (a whole row at 375).
- **Fix:**
  - Scale the goblin 2× and give it a bounce on the taunt, with the crown glinting.
  - Burst material-coloured confetti from the keep and add a short zoom punch on the keep.
  - Put the goblin (or a crown icon) on the panel.
  - Make the star pops bigger with a scale overshoot.
  - On desktop, place the panel in the side column or under the board. On phones, dock it below the board edge or delay it until the goblin stops.

## MINOR

**MINOR-1. Map level stars fail WCAG AA.**
- **Screen:** map with progress. **Viewports:** all.
- **Screenshot:** `$V/375x812-map-progress.png`.
- **Evidence:** 11 px stars in `#c98d10` on the done node `#ffe9a8` are 2.39:1.
- **Fix:** use a darker ink (`#7a4e00` is about 5:1), 13 px, or put the stars on a small dark pill under the node.

**MINOR-2. Moat and ground are nearly the same tone in grayscale.**
- **Screen:** play, W3-W4.
- **Screenshots:** `$V/gray-w3-02.png`, `$V/gray-w4-02.png`.
- **Evidence:** moat is Y 0.187 (L* 50.3) and ground is Y 0.174 (L* 48.7). Only the thin wave dashes tell them apart.
- **Fix:** darken the moat base to about Y 0.10 and give the wave crests a bright highlight, so impassable water reads as darker than walkable ground.

**MINOR-3. The lever is easy to miss.**
- **Screen:** play, W4.
- **Screenshots:** `$V/375x812-lever-a.png`, `$V/gray-w4-02.png`, `$V/375x812-mid-w4-05.png`.
- **Evidence:** the lever is a small stick glyph (about 10 CSS px at 11×11) on a grey tile with no badge. It's Y 0.212, the same tone as timber and the keep. It's the one W4 element a player must find, and it's the least visible.
- **Fix:**
  - Draw the lever larger, with a bright red knob and a dark socket plate.
  - Add the existing iron-door icon (`m = 4`) as a badge, or a chain line from the lever to its door.

**MINOR-4. A claimed chest looks unclaimed.**
- **Screenshots:** `$V/chest-shut.png`, `$V/chest-open.png`, `$V/375x812-chest-c.png`.
- **Evidence:** after the claim the chest is the same closed box, just brighter with a gold band. At 1x it reads as still available.
- **Fix:** show an open lid with an empty interior, or fade the chest to 50% and draw a small check mark.

**MINOR-5. Ground and rubble tiles stamp an identical pattern on every cell.**
- **Screenshots:** `$V/375x812-lever-b.png`, `$V/375x812-chest-b.png`, `$V/S3-375-show.png`.
- **Evidence:** on open boards, every tile repeats the same speckle or dash marks, forming a regular wallpaper grid.
- **Fix:** 3-4 variants per ground and rubble type, picked by a hash of (x, y), plus random flips.

**MINOR-6. The banner is identical in Worlds 1-3.**
- **Screenshots:** `$V/375x812-mid-w1-05.png`, `$V/375x812-mid-w2-03.png`, `$V/375x812-mid-w3-05.png`.
- **Evidence:** it's the same day sky, flat green tower and goblin in all three. "The Frozen Moat" shows no ice or snow. The tower is a single flat green silhouette, which looks like a placeholder beside the detailed wall.
- **Fix:** give each world a palette and a prop (hedges in W2; snow, ice floes and a pale sky in W3), and shade the tower like the title castle.

**MINOR-7. The pixel scale is mixed and non-integer.**
- **Evidence:**
  - The banner and title are 3 CSS px per art pixel (9 device px at DPR 3).
  - Board tiles run from 1.9 CSS px per art pixel (11×11 at 375, where cell 92 / 16 = 5.75 device px, so pixel widths alternate between 5 and 6) up to 5 CSS px (7×7 at 1280).
  - On one screen, the banner goblin is visibly chunkier than the board goblin.
- **Fix:** snap the cell to a multiple of 16 device px where the fit allows, and pick the banner's artPx to match the board's effective pixel size.

**MINOR-8. The desktop side column is cramped and empty at the same time.**
- **Viewport:** 1280×720.
- **Screenshots:** `$V/1280x720-mid-w4-05.png`, `$V/1280x720-hint-w1-t1.png`.
- **Evidence:**
  - The banner is squeezed into a narrow portrait strip that is mostly empty night sky.
  - The hint text wraps to 3 lines in a 190 px column.
  - The top bar runs the full 1280 px, with the level title at x = 66 and the score at x = 1206, so it's detached from the board group.
- **Fix:** constrain the top bar to the board group's width, widen the side column, or move the world tag and hint above the board.

**MINOR-9. The panel overlaps the board on phones and tablets.**
- **Screen:** win and stuck.
- **Evidence:** the panel top is at 618 and the board bottom at 654 at 375, so it covers 36 px (1.2 rows). At 768 the panel top is at 830 and the board bottom at 866.
- **Fix:** see MAJOR-8, or shrink the board by one cell while a panel is up.

**MINOR-10. The HUD reads ambiguously.**
- **Evidence:** "3 / 5★" means crews used against the 3-star mark, but it scans as "3 of 5 crews left".
- **Fix:** show "Used 3 · ★★★ at 5", or put a crew icon before the 3.

**MINOR-11. A fresh map is a wall of grey locks.**
- **Screenshot:** `$V/375x812-map-fresh.png`.
- **Evidence:** 35 identical dark lock circles across four strips.
- **Fix:** collapse locked worlds to one banner row showing the world art and "Win 6 in World N", and reveal the nodes on unlock.

**MINOR-12. The chest "+1" fly has no "+1".**
- **Screenshot:** `$V/375x812-chest-a.png`.
- **Evidence:** a 1.5-cell crew badge arcs to the card, but no number shows.
- **Fix:** draw "+1" in outlined type beside the flying badge.

**MINOR-13. The teaching hints don't point at anything.**
- **Screenshots:** `$V/375x812-hint-w1-t1.png`, `$V/375x812-hint-w3-t1.png`.
- **Fix:** add a bouncing hand or arrow over the card, then over the wall, for W1 level 1 (Food Hunt's pattern).

**MINOR-14. On the lever break, the courtyard stays in shadow while the lever throws.**
- **Screenshots:** `$V/375x812-lever-a.png`, `$V/375x812-lever-b.png`, `$V/375x812-lever-c.png`, taken on w4-t1 at 130, 310 and 570 ms after the crumble.
- **Evidence:** the courtyard the lever sits in is still veiled while the lever swings and the doors fold. So the lever appears to be thrown from unreached ground.
- **Fix:** light the newly connected ground before the lever event, as the M2 notes describe. Check whether this is intended.

## Note (not graded)

Under `SP.hold(true)`, `SP.tick(6000)` brings the win panel up but never advances the star reveal: `starsShown` stayed 0 at all four viewports. In real time the stars reveal correctly. This only affects frozen-clock screenshots and harnesses. Anyone capturing win panels with `hold` will see empty stars (`$V/375x812-win-panel.png` shows this; `$V/375x812-win-realtime.png` is correct).
