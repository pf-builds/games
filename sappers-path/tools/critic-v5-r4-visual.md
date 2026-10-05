# Sapper's Path v5 R4: visual critic (levels 101-200, map sheets 13-25)

Worktree `repos/games-sappers-path/`, branch `sappers-path`, head `89f8b59`. Served on 8493. Playwright (Node v24), 375x812 at DPR 3 (touch) and 1280x720. Screens in `sappers-path/tools/critic-v5-r4-visual/` (`phone-*` and `desk-*`; scripts `shoot.mjs`, `hits.mjs`, `labels.mjs`, `extra.mjs`, notes `notes-*.json`). Nothing in the game was changed.

## selfTest and console

- `SP.selfTest()` (`?debug=1`): **756 passed, 0 failed** at 375x812; **758 passed, 0 failed** at 1280x720.
- 0 console errors, warnings or page errors across every run (boards, map, audit, hits, labels).

## Verdict

**Would a portal reject this on sight? No.** A reviewer plays the first few levels and none of this content shows there. Even for a reviewer who does reach 101-200, the boards are crisp, the lava, forest and throne palettes are distinct, the map sheets join cleanly and the panels match realms 1-4. Here is every visible reason a reviewer who got that far would mark it down:
1. The Mistmoor (101-124) shows a sunny, clear-sky farmstead. It does not read as fog fens, and its 24 boards are one picture repeated.
2. The Goblin King's Throne (175-200) is one template 26 times: a crown at top centre, blue flank towers and navy "?" blobs.
3. Level 200 has nothing that marks it as the final boss. It has no name, the usual header and the usual win line.
4. On the phone map, the current-level label covers a prize bubble, eggs and neighbouring nodes at several states.
5. The realm 8 banner is cut off on the phone ("The Goblin King's Thro...").

**0 blocking, 7 should-fix, 8 nits.**

## Blocking

None. Play works, there are no errors, and every R4 feature renders.

## Should-fix

**S1. The Mistmoor does not read as fog fens.** The builder's own spec (v5-r4-notes §1) says "fog sky, distant willows, mist banks, reeds". On the 15 `fen` ("day fog") boards the sky is clear blue with a yellow sun and white cumulus. `fenDusk` (pink sky) and `fenNight` (teal sky) only recolour the sky. No mist band, willows or reeds are readable, and the white "mist" cells between the stilts read as windows or teeth.
- Repro: `SP.load(101|106|113|120|104|107); SP.tick(1200)` at 375x812.
- Evidence: `phone-b101-start.png`, `phone-b106-start.png`, `phone-b113-start.png`, `phone-b120-start.png`, `phone-b104-start.png` (dusk), `phone-b107-start.png` (night).

**S2. The Mistmoor boards repeat.** The 24 boards use 2 styles (`hall2-0t` x14, `narrow-hall1-0t` x10). Every one is the same thatched hall on a brown stilt fence with a sun in the top corner, and the four realm 5 starts are near-identical side by side. It also echoes realm 1's timber stockades rather than introducing anything new. Realm 5 is the only new realm with no towers and no hidden blocks on the board, so it has nothing else to vary it.
- Evidence: as S1, plus `levels.json` era 5 style counts.

**S3. The throne realm repeats, and hidden blocks muddy it.** All 26 boards use one `throne-*` template (`throne-2t` x12, `-0t` x8, `-3t` x3, `-4t`, `-1t`, `-moat-4t`). Every board has the gold crown at top centre, a grey keep and royal-blue flank towers. 20 of 26 have hidden blocks, drawn as large navy (58,63,99) blobs that read as storm clouds over the picture, so the castle silhouette is hard to make out at a glance.
- Repro: `SP.load(178|185|192|197)`.
- Evidence: `phone-b178-start.png`, `phone-b185-start.png`, `phone-b192-start.png`, `phone-b197-start.png`.

**S4. Level 200 does not feel like a boss.**
- The header shows only the realm name and EXTREME. The level has no `name` field.
- The board is the throne template split into three bands: the keep with the crown, then towers between two moats, then a bottom band with gold spikes and a hut. It reads as a busier realm 8 board, not a set piece. There is no king, throne figure or special frame on the board.
- The win line is the generic `"The goblin king flees. Level " + n + " cleared."` from `main.js:1001`, the same text level 160 shows (`phone-win160.png`). `main.js` has no boss or finale code at all.
- Repro: `SP.load(200)`.
- Evidence: `phone-b200-start.png`, `desk-b200-start.png`, `phone-b200-patient.png`.

**S5. Current-level label collisions on the phone map (the ones that matter).** My audit ran every current level from 99 to 200, label rect against nodes, eggs, quest bubbles and banners (CSS px²):
- 25 phone states and 12 desktop states have some contact.
- Worst, all in `phone-label-<n>.png`:
  - **189**: "Level 189 EASY" sits fully over the open quest's PRIZE bubble (1800 px², bubble hidden). This is the one to fix first.
  - **131**: the label covers egg s16-1 (1123 px²; the egg can't be tapped while 131 is current) and the top of node 130.
  - **159**: the label covers egg s20-1 (1026 px²).
  - **106**: the label covers node 105, so only "10" and "HA" peek out (595 px²).
  - **110**: the label overlaps node 111 (410 px²).
- The rest are grazes under 350 px² and can stay in LATER. Desktop is the same list at smaller areas.
- Repro: `SP.unlockTo(n-1); SP.clearPictures(floor((n-5)/4)); SP.screen("map")`.

**S6. Archer towers are the same blue as the moats.**
- Tower cells measure (97,144,221) and the moat (52,119,214). On 200 the four towers sit directly under the moat, separated only by the moat's wave texture (`phone-hit200.png`).
- In the Crags (125-149) the towers are bright royal-blue slabs on purple and grey basalt, which reads off-theme for a volcanic realm (`phone-b133-start.png`, `phone-hit133.png`, `phone-b125-start.png`).
- A slate grey or iron colour per realm would separate them from water and fit the theme.

**S7. The realm 8 banner is truncated on the phone.** The banner reads "REALM 8 The Goblin King's Thro..." at 375 wide. Desktop shows it whole, and the side card wraps it.
- Repro: all 200 cleared, scroll to the sheet 21/22 join.
- Evidence: `phone-seam-21-22.png`; compare `desk-seam-21-22.png`.

## Nits

**N1. Locked nodes are low-contrast on dark sheets.** The locked disc fill (90,84,99) against the sampled sheet gives contrast ratios of 1.03-1.05 on the Crags (nodes 131-134) and 1.03-1.72 on the Mistmoor (111-115). The nodes read only by their dark outline and numerals. They are legible, but faint on basalt.
- Evidence: `phone-label-131.png`, `phone-label-130.png`, `phone-label-110.png`.

**N2. The Goblin King sprite is tiny.** He is about 20x30 CSS px on the phone and about 25 px tall at 1280x720, smaller than a level node. He is readable (green skin, crown, red cloak, sceptre) but does not sell a final boss on the summit.
- Evidence: `phone-map-summit.png`, `desk-map-summit.png`.

**N3. Perspective art on a top-down map.** The summit fortress is a 3/4 spired castle with a horizon; the fog wash softens it. The goblin huts and the lookout on sheets 23-24 are also side-on (`phone-map-cur-190.png`). Above 200 the painted road runs up the middle while the dashed path turns right to the tail node (`phone-map-summit.png`). This is consistent with R3's sheet 12, so I left it as a nit.

**N4. The fog band at the top of the summit reads as a flat strip.** The top 15% of the view is a flat dark-grey-to-white gradient under the header, so it looks like a hard band rather than painted mist.
- Evidence: `phone-map-all-200.png`, `phone-map-top.png`.

**N5. Archer sprites are small and the range rings get noisy.** The archer sprites are about 13x15 CSS px. On 3-tower boards (133) the dashed range rings overlap into noise, and on lesson 125 the ring is clipped at the board's left edge.
- Evidence: `phone-hit133.png`, `phone-b125-start.png`.

**N6. Hidden blocks look the same in every realm.** The navy (58,63,99) "?" blocks sit close to the realm 7 indigo sky and the realm 8 teal sky. The "?" glyph is legible on the phone at 3x and on desktop at 1x (`desk-b150-start.png`), and blocks reveal correctly (`phone-b150-patient.png`).

**N7. The grass egg glyph looks like stray lettering.** The "-ΛΛΛ-" glyph on sheets 13, 22 and 25 reads as text marks.
- Evidence: `phone-seam-12-13.png`, `phone-seam-22-23.png`.

**N8. Mid-play shots (`*-mid.png`) were taken with rushed taps,** so 200's mid shot is an "Assault failed" jam. That is expected for impatient play and is not a defect; it does give a lose panel on a new-realm level.

## Checked and passing

- **Cell size:** 42-column boards come to about 8.4 CSS px a cell on the phone, the same as realms 2-4 (`phone-b66-start.png`, `phone-b80-start.png` for reference).
- **Realm themes:**
  - Emberwatch reads as volcanic (the orange lava moat, the lava-streaked peak).
  - The Weald reads as a moonlit forest (big trunks, canopy).
  - The throne palette (red or teal storm skies, gold crown) is distinct from realms 1-4.
- **Lessons:** 125 shows "Archers shoot inside the red ring. Tower first!" with its ring and archer (`phone-b125-start.png`). 150 shows "? blocks hide their colour until dug beside." with its hidden blocks (`phone-b150-start.png`, `-patient.png`).
- **Archers in action:** the first hit shows the "Arrow! Back to its space" floater, and the sapper is knocked back (`phone-hit133.png`, `phone-hit160.png`, `phone-hit200.png`; desktop the same).
- **Panels:**
  - The win panel ("Fort razed!") on 160 matches realms 1-4 (`phone-win160.png`, `desk-win160.png`).
  - The lose panel ("Assault failed", a jam on 101) is clean (`phone-lose.png`, `desk-lose.png`).
- **Map at a current node in each new realm** (`phone-map-cur-110/130/160/190.png`, desk the same): the road, nodes, quest bubbles and play bar are clean, apart from the S5 states.
- **All 13 joins from 12/13 to 24/25:** no visible hard seam at phone scale. The realm joins (12/13, 15/16, 18/19, 21/22) sit under the realm banners (`phone-seam-*.png`, `desk-seam-*.png`).
- **The summit:** 200, the king beside it, "The road goes on" and picture 51's node in the fog past 200 all render (`phone-map-summit.png`, `phone-map-all-200.png`).
