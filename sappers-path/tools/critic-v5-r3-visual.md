# Sapper's Path v5 R3: visual critic (journey map)

Head `565bb48`, branch `sappers-path`. Served on 8493, Playwright headless Chromium, 375x812 @3x (touch) and 1280x720 @1x.
62 screenshots of my own in `tools/critic-v5-r3-visual/` (plus `notes.json` with DOM overlap and font measurements).
0 console errors or warnings in every run. I did not use the builder's shots.

## Verdict

**Pass, with should-fixes. No blocking findings.** Would CrazyGames reject this level-select map on sight? No. It reads as a
competent Food Hunt-style scrolling map: the overlay route sits on the painted road on all 13 sheets, realm joins are
hidden under the banners, the seams inside realms don't show, nodes and badges are consistent, and the top-bar pixel
UI sits cleanly on the painting. Reasons a reviewer *could* dock it (none would get it rejected by themselves): the
Goblin King is a flat glyph at the top of a painted map, the 35-picture thumbnail grid looks pasted on, one quest node
overlaps a level node, and the all-cleared end state contradicts itself.

## Shots taken (phone- and desk- prefixes)

home; fresh; quest-open (1-6 cleared); current node in each realm: fresh (R1, L1), cur-31 (R2), cur-56 (R3), cur-81
(R4), cur-100 (R5); all 12 sheet seams on phone (`phone-seam-01-2` ... `phone-seam-12-13`; joins of realms are 03-4,
06-7, 09-10, 12-13), the 4 realm joins on desktop; walked-route seams 7-8 and 8-9; eggs before/after on sheet 1
(woodpile) and dark sheet 8 (glint); realm 4 banner tapped open; top: top-fresh, top-100clear (picture 26 node),
top-tail-mid (15 long-tail won), top-tail-all (all 35 won), each also as `-open` (the map's opening scroll);
skipped-quest clutter on sheets 2, 5, 8 (`phone-skipped-quests-sheet*.png`, levels 1-74 cleared, no pictures).

## Findings

### Blocking

None.

### Should-fix (6)

1. **Quest 15 overlaps level 60 (sheet 8).** Layout centres are 70 sheet px apart, which is 34 CSS px at 375 wide.
   Both discs are about 44 px, so they overlap by about 10 px and their tap targets overlap too. It's the only pair on the
   map under 100 sheet px (I checked every level, quest and egg on all 13 sheets). The quest also sits in the road's
   bend, so its detour stones lead back to the same road it's sitting on.
   Repro: `SP.unlockTo(74)`, open the map, scroll to sheet 8. Evidence: `phone-skipped-quests-sheet8.png` (60 and the
   quest disc touching, centre right), `phone-walked-seam-7-8.png`, `phone-seam-07-8.png`.
   Fix: move Q15 (503,971) about 40 sheet px down and right, off the bend.

2. **The all-cleared end state contradicts itself.** With levels 1-100 and pictures 1-60 won, the desktop next-up card
   reads "Every level cleared" over a button reading "Play level 100" with an EASY tag. The phone foot bar reads
   "Play level 100" too. "The road goes on" still shows in the fog when nothing is left.
   Repro: `SP.unlockTo(100); SP.clearPictures(60)`, open the map. Evidence: `desk-top-tail-all.png`,
   `phone-top-tail-all.png`.
   Fix: end-state copy, e.g. "Replay any level" or a "You beat the Goblin King" line, and swap the fog text.

3. **The long-tail thumbnail grid looks pasted on.** With all 35 won, the block is a 7x5 grid of bright, gold-framed
   squares (about 170x245 CSS px on phone) in the top-left of the dark wash. It reads as an inventory panel laid over the
   painting, sits beside the Goblin King, and runs down to the faded road. With 15 won it's already a hard-edged block.
   Evidence: `phone-top-tail-all.png`, `phone-top-tail-mid.png`, `desk-top-tail-all.png`.
   Fix: smaller dimmed thumbs, or a "Pictures past the road (35)" chip that opens a sheet.

4. **Prize bubbles and the open banner collide with the route, nodes and eggs.** Measured with DOM rects:
   - Realm 4's banner, tapped open, covers the sheet 10 woodpile egg (44x25 px on phone, 44x19 on desktop). Its top
     edge also sits on the "Level 75 EASY" label (label x egg 44x10). Repro: `SP.unlockTo(74)`, tap the realm 4 banner.
     Evidence: `phone-banner-r4-open.png`.
   - Quest 14's bubble overlaps the cleared level 56 node by 4x34 px (same save, sheet 7/8).
   - At cur-81, quest 20's bubble sits right under node 81 and covers the walked red route between 80 and 81.
     Evidence: `phone-cur-81.png` (centre).
   The side picker counts nodes, eggs and banners, but it doesn't count the route, cleared nodes in that state, or the
   banner's open height.

5. **Quest 23 sits on a painted castle (sheet 12).** At (696,1084) it's on the right-hand castle tower at the column's
   edge, and its locked prize icon hangs over the tower too. Evidence: `phone-seam-11-12.png`, right edge at about
   y 290 CSS. Fix: move it onto open ground left of the tower, or onto the painted spur by 92.

6. **The Play-bar tag hangs off the button.** On phone the EASY pill is at (329,734) 43x23. The button is at
   (8,742) 359x58, so the pill sits 8 px above the button and 5 px past its right edge, wedged against the foot strip's
   top (729). It reads as a stray sticker. The approved mockup puts the tag inside the button ("Play Level 6 HARD"), and
   the desktop next-up card has the same overhang. Evidence: `phone-fresh.png`, `phone-cur-100.png`, `desk-fresh.png`
   (bottom right of the button).

### Nits (8)

7. **Goblin King.** A flat black glyph, about 40 CSS px, with two detached triangles for arms and red-dot eyes, next to
   a flag whose tip is 5 px from the column edge. It matches the approved mockup's glyph, but it's the climax of a
   painted map and reads as a placeholder. `phone-top-fresh.png`, `phone-top-tail-all.png`.
8. **Tag pills under cleared nodes are tiny.** Jersey 10 at 12 px, so HARD/EASY is barely legible at 375.
   `phone-quest-open.png` (under 6 and 3).
9. **Every open quest shows a PRIZE bubble** (18 at once when a player skips quests: two per sheet), which dilutes the
   gold-ringed "next" one. `phone-skipped-quests-sheet2/5/8.png`.
10. **Desktop cards are top-aligned and uneven.** Realm card 290x324, next-up 290x254, with about 318 px of empty brick
    below them on a 720 screen. This is close to the mockup, so it's only a nit. Past 100 the next-up card says
    "Side quest 26" over "Play picture 26", then repeats "Side quest 26" in the quest row below.
    `desk-top-100clear-open.png`.
11. **Faint crossfade ghosting at Ironhollows seams 8/9 and 9/10.** A soft, double-exposed grey band with ghosted trees.
    No hard line anywhere. `phone-seam-08-9.png`, `phone-seam-09-10.png` (mid-screen).
12. **Bridge density on sheets 5-6.** Three bridges within about 300 CSS px around levels 41-45, and the top one's left
    end rests on land. `phone-seam-05-6.png`.
13. **Realm 5 is a single level.** The card reads "1/1 cleared" and "Side quests 1/1", which looks thin for a realm.
    `desk-cur-100.png`. This is a design note rather than execution.
14. **Won quests change shape.** They go from a round purple disc to a square gold-framed thumbnail (the same frame as
    the long-tail grid), so a won quest reads as a different object type. `phone-top-100clear.png` (picture 25).

## Checked and passing

- **Seams:** none visible at 375 on any of the 12 joins (`phone-seam-*`). Realm joins sit under the banners.
- **Road overlay vs painted road:** walked dashes and ahead dashes stay on the painted road on every sheet, both sides of
  each seam, in fresh and walked states.
- **Nodes on the road:** all 100 levels are within 12 sheet px of the road polyline. No level sits on a painted
  building. The "Level N" label covers painted buildings at times (castle left of 81), which is fine for a UI chip.
- **Bridges:** all 14 sit across painted water, and sheet 12's crossing is bridged. No floating bridge. See #12.
- **Art:** no fake lettering or frames on any sheet. The horizon on sheet 13 is fully under the wash.
- **Locked nodes on dark sheets:** number rgb(179,171,190) on rgb(90,84,99) is about 3.3:1, which passes large-text AA
  at 27 px, and the dark ring separates them from the Ironhollows and Mistmoor painting.
  `phone-seam-07-8.png`, `phone-seam-12-13.png`.
- **Eggs:** the before sprites read as part of the scene, the after sprites are clear, and the coins count updates
  (400 to 410, 400 to 414). `phone-egg-s1-*`, `phone-egg-s8-*`.
- **Text at 375:** card and label text is 15-36 px. Only the 12 px tag pills and the 13 px PRIZE word are small.
- **Pixel UI over the painting:** the top bar, foot bar, banners and node styles are consistent with the mockup and
  sit cleanly. The banner scroll is the best join between the two styles.
