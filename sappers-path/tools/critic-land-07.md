# Critic: Zen World 6 The Floating World (v7 lane D), 2026-10-11

Build: branch sappers-path, head 883e6df (not pushed), served on 127.0.0.1:8517 (Playwright, chromium). Shots and data in `tools/critic-land-07/` (untracked, not committed).
Setup under `?debug=1` (SP.zenTo, SP.load, SP.winOrder, SP.lossPlan); the map, the join and the map's Play were judged on the plain URL. Card taps in play were real touchscreen taps on the visible cards.

## selfTest
`tools/selftest-lands.mjs --url http://127.0.0.1:8517/`: **375x812@3 884 passed / 0 failed; 1280x720 886 / 0; 360x640 (--small) 884 / 0; 0 console messages.** Trusted for records, numbering, caps, shades, moats, map tint presence, win line wiring, credits order.
My own runs (board renders, play, map at 375 and 1280): **0 console messages, 0 page errors.**

## Counts
BLOCKER 1 · MAJOR 3 · MINOR 5

## How the boards were judged
Every board was loaded in play (`SP.load("z6-N")`) at 375x812 and the `#board` canvas captured at its CSS size (304x392 or 336x344-392 px, 7-8 px a cell), so the sheets are exactly what a phone shows, at 1x. A 3x phone is sharper, but the cell count is the same. I judged them blind first, from sheets with only the Zen number (`blind-1.png` .. `blind-5.png`), then checked each against the AIC source (`pairs-mud.png`, `pairs-weak.png`) to give the reason. The question each time: could a player name what the picture shows without the title bar? In Zen nothing is hidden, so the starting board is the whole picture the player gets.

Result: **7 read, 21 weak (need the title), 22 mud.** 43 of 50 fail the bar. World 5 had 17 weak-or-worse with 9 unreadable.

## BLOCKER

**B1. 22 of the 50 boards are mud** (item 1). Repro: `?debug=1`, `SP.zenTo(6,0); SP.load("z6-N")` at 375x812, look at the board (or `tools/critic-land-07/boards/bNN.png`, `blind-*.png`).

| Level | Zen | Id | Title | Why it's mud at play size |
|---|---|---|---|---|
| 408 | 258 | fw006 | The Boatman at Haneda | The oar and leg are a dark diagonal across yellow-green; a water band at the foot. Nothing nameable. |
| 415 | 265 | fw044 | Okiku at the Well | The ghost is a grey smear at the top right; the well and the face are gone. |
| 417 | 267 | fw049 | Bamboo Yards by Moon | Dark verticals on pale green. The bridge, the moon and the boat don't survive. |
| 420 | 270 | fw065 | The Cushion Pine | A dark blue mass on pink. No Fuji, and the pine reads as a hill. |
| 425 | 275 | fw103 | Flying Fish | A diagonal dark band and an orange star. No fish shape and no head. |
| 428 | 278 | fw041 | Iris and Grasshopper | Green stalks on yellow. The iris blooms are brown specks and there's no grasshopper. |
| 429 | 279 | fw027 | Riders by the Sumida (Hard, repainted) | Red and yellow blobs on green. No riders, no horses. |
| 430 | 280 | fw035 | Roben Falls | Orange and teal confetti around a thin streak. |
| 432 | 282 | fw012 | Sazai Hall | Blue blocks on a yellow floor. The figures and Fuji don't read. |
| 434 | 284 | fw043 | Peonies and Butterfly (repainted) | An orange smudge in dark leaves, with the blue moat line snaking across. No butterfly. |
| 435 | 285 | fw071 | Dawn at Isawa | Brown silhouettes. Fuji is flattened to a dark band. |
| 436 | 286 | fw053 | Moon-Viewing Room (Hard) | A green rectangle inside a blue moat line. No room and no view. |
| 437 | 287 | fw038 | Hanging-Cloud Bridge (repainted) | Green trees on tan. The bridge is the subject and it isn't visible. |
| 438 | 288 | fw013 | Through the Pines (repainted) | Teal, blue and orange noise. The pines, Fuji and the travellers are gone. |
| 440 | 290 | fw042 | Morning Glories (repainted) | Brown rings inside a looping blue moat line. The flowers read as doughnuts. |
| 441 | 291 | fw106 | Cuckoo and Moon | A yellow moon and teal shapes with the mire outline. The cuckoo isn't legible. |
| 442 | 292 | fw058 | The Monkey Bridge (repainted) | Olive, red and teal blocks. No bridge and no gorge. |
| 443 | 293 | fw014 | Crossing the River (Hard) | Blue and cream noise. The figures and Fuji are lost. |
| 445 | 295 | fw036 | Ono Falls (repainted) | Orange, red and blue blocks around a thin falls. |
| 446 | 296 | fw016 | Cherry at Goten Hill | Pale clouds and a green hill, with the blue moat line looping through. No cherry and no people. |
| 447 | 297 | fw068 | The Rock Gate | Orange beams and green fields. Nothing a player would name. |
| 449 | 299 | fw087 | Sanno Festival | A brown block on the left and the mire outline across green. The parasol and the procession are gone. |

Notes for the art lane:
- **7 of the 13 repainted prints are still mud** (279, 284, 287, 288, 290, 292, 295) and 2 are weak (264, 298). Only 4 repaints worked: 251, 268, 273, 281. The repaint pass didn't fix busy scenes. What worked is one large subject in flat contrasting colour on a plain ground (the crane, the rabbit, the sail, the ring).
- **Fuji doesn't survive** at 5-7 colours wherever it's small or pale (266, 270, 276, 285, 288, 293). A road that "climbs toward Mount Fuji" barely shows the mountain.
- Busy figure scenes (279, 282, 288, 293, 299) can't be saved at 42 columns. Swap them for spares. The 12 spares are untried at play size.
- Fix: swap or re-crop to one subject, re-bake, then show Peter a contact sheet **at play size** (not `contact-installed.jpg`, which is larger than a phone board and flatters them).

## MAJORS

**M1. 21 boards are weak: nameable only with the title** (item 1). Same repro.

| Level | Zen | Id | Title | Reason |
|---|---|---|---|---|
| 402 | 252 | fw050 | The Festival Banner | The red streamer reads as a red bird or figure; the banner and bay don't resolve. |
| 403 | 253 | fw101 | Bonito | A blue wedge on paper. The head and eye aren't on the board, so it reads as a wave or a slope. |
| 405 | 255 | fw089 | The Paulownia Grove | A tree by a pond. Generic. |
| 406 | 256 | fw046 | The Moon Pine | A brown branch loop over a view. The loop reads, the pine doesn't. |
| 407 | 257 | fw040 | Hydrangea and Swallow | The swallow silhouette reads. The hydrangea is a grey blob inside the blue moat line. |
| 410 | 260 | fw102 | Yellowtail and Blowfish | A navy diagonal fish with no clear head. The blowfish isn't there. |
| 411 | 261 | fw034 | Yoro Falls | The falls are a faint pale streak in teal and cream noise. |
| 412 | 262 | fw052 | Cherry over the River (Hard) | White blossom blobs on blue, a river band and a red post. |
| 413 | 263 | fw017 | Under Mannen Bridge | The arch is only a brown curve. The nets and the boat are lost. |
| 414 | 264 | fw097 | White Heron (repainted) | A white lump with black marks inside the moat line. It reads as a sheep. No neck, no legs. |
| 416 | 266 | fw024 | Tago Bay | Fuji's cone doesn't read: a blue slope over green stripes. |
| 419 | 269 | fw080 | Yahagi Bridge | A brown timber lattice on yellow. It's a bridge only once you know. |
| 421 | 271 | fw088 | Willow at Yatsumi | Green drips over water. |
| 422 | 272 | fw082 | Lilies (Hard) | Orange petal shards and dark leaves. No lily head. |
| 426 | 276 | fw025 | Fuji above the Pass | The dark ridge reads, but the Fuji cone, which is the subject, doesn't. |
| 427 | 277 | fw094 | Zojo Pagoda | A red pagoda sliver on the right edge, with roofs in teal noise. |
| 433 | 283 | fw045 | The Armor Pine | A small tree over water. Generic. |
| 439 | 289 | fw057 | The Circle Pine | The red torii reads, beside the moat line. No pine and no circle. |
| 444 | 294 | fw105 | Sparrows in Snow | Snowy twigs read, but the sparrows are specks. |
| 448 | 298 | fw039 | The Eight-Plank Bridge (repainted) | Orange zig-zag posts. It's a bridge only with the title. |
| 450 | 300 | fw107 | The Wave (Hard, the world's last) | Blue curved bands read as water. The crest and the boat are lost. |

**Read well (7):** 401/251 fw001 The Cooper's Barrel (a ring with Fuji in it, a good opener), 404/254 fw004 Amida Falls, 409/259 fw084 Cotton Roses, 418/268 fw095 Crane over a Wave, 423/273 fw029 The Big Ship, 424/274 fw055 Fudo Falls, 431/281 fw100 Rabbits in Moonlight.

**M2. The moat rings make 4 boards worse.** Repro: SP.load z6-34, z6-36, z6-40, z6-46 at 375 (`boards/b34.png` b36 b40 b46). On 284, 286, 290 and 296 the ring's 1-cell blue line loops through background or a non-subject area. It reads as a stray river drawn over the print and is the strongest line on the board. On 257, 264 and 289 it frames the subject acceptably; 291 and 299 (mire) add a dark outline to boards that are already mud. Cheapest fix if the boards stay: add fw043, fw053, fw042 and fw016 to `land.json moatSkip` and re-bake those 4. Moats would drop to 5.

**M3. The map tint is distinct from World 5, but it doesn't read as woodblock** (item 3). Repro: plain URL, Zen map, World 6 at 375 (`map-top-375.png`, `comp-phone.jpg`) and 1280 (`map-1280.png` against World 5's `map-w5-1280.png`, `comp-desk.jpg`). Against World 5's warm sepia it's clearly another world: cool pale green-blue, darker indigo water. But it's the Campaign's watercolour castle map in a green wash, with a European thatched cottage and plank bridges under lore about "old Edo" and Mount Fuji. No ukiyo-e cue (flat colour, indigo key lines, a red cartouche, a stylised wave or Fuji). It reads as washed-out green, as the builder's notes admit. This is the same zero-byte lever World 5's critic graded M2. It can ship as a known compromise if Peter accepts it. A cheap upgrade: a small flat Fuji or wave cartouche on the World 6 banner, or one new sheet.

## MINORS

- **m1. The credits line.** The Zen map foot reads "...Masterpiece Gallery: Public domain paintings from the Art Institute of Chicago, National Gallery of Art, The Met and Cleveland Museum of Art open access (CC0). Japanese woodblock prints by Katsushika Hokusai and Utagawa Hiroshige from the Art Institute of Chicago open access (CC0); some adapted for the game by Click it! Studios." Grammatically it isn't a run-on; each part is a proper sentence. But with no label it reads as a second sentence of the Masterpiece Gallery credit, which credits World 5 with the woodblock prints. Fix: prefix "The Floating World: " to match. Known (LATER.md).
- **m2. None of the 6 Hards reads.** 279, 286 and 293 are mud and 262, 272 and 300 are weak. The world also ends on a weak Hard (300). The Hards are where a player stares longest. When the art lane swaps boards, put the clearest boards on the Hard slots, or re-plan the tags.
- **m3. The realm and Next up cards at 1280** show "Side quest 12 ... Quartermaster +1" (a World 1 quest), an empty "Secrets found" and a 0 coin count (`comp-desk.jpg`). Known and pre-existing (LATER.md).
- **m4. The tightest World 6 node number** has 1.0 px spare in its disc at 375 (all 50 fit). It passes, and it's the same margin as World 5's 222.
- **m5. Licence rows are keyed by the factory's 401-450**, while the game shows Pictures 251-300, so a player can't look up "Picture 263" by number. This is pre-existing (World 5 does the same). fw095's date is "n.d." (the museum's own data, known).

## Item checks that passed

- **Win at 375x812 (real taps):** 251 The Cooper's Barrel from the map's Play button (plain URL opened "251 The Cooper's Barrel"); then via debug 46 taps on the winOrder gave "Picture done", "**The Cooper's Barrel by Katsushika Hokusai, all dug out.**", First clear +20, Back to map / Retry (`win-375.png`). The painter is named.
- **Loss:** 300 The Wave (Hard), lossPlan 36 real taps gave "A little stuck", Hard chip, "Line jammed: Cyan, Blue and Tan can't reach a block. Have another look.", Continue (250 coins) offered, Retry / Back to map (`fail-375.png`). Retry restarted 300 (playing, 5 cards). The top-bar retry restarted mid-play with no stray sheet. The map button returned to the map.
- **Map join at 375 (plain URL):** 249 and 250 done under World 5's sepia, then the banner "World 6 The Floating World" with the lore, then 251 current ("Picture 251", "Play picture 251"). The fog label is "More worlds on the way". No horizontal overflow at 375 or 1280.
- **Tint:** all 6 World 6 sheet images carry `hue-rotate(30deg) saturate(0.75) sepia(0.18) brightness(1.08) contrast(1.1)` (sheets 7/1 alternating). World 5's carry their own sepia filter. Eggs are on the spurs (butterfly and grass seen).
- **Desktop 1280:** the realm card reads "World 6 of 6 · The Floating World", 12/50 cleared. Next up is Picture 263 (Easy), and the map sits centred with no overflow.
- **Titles at 375:** none of the 50 overflows the play bar. The smallest auto-fit is 14.4 px (257, 258).
- **LICENSES.md World 6 section:** the heading, the credit line, then **50 rows** (401-450), 50 artic.edu URLs, and CC0 on every row. **13 rows carry "Adapted for the board by Click it! Studios: ..."**, exactly fw001, fw013, fw027, fw029, fw036, fw038, fw039, fw042, fw043, fw058, fw095, fw097, fw100, matching the install notes' list.
- **Difficulty spread:** E18 / N26 / H6 / X0, ending on a Hard. ? cards on 23 levels, links on 18, moats on 9, no mystery blocks, no locks. The opener is a Normal with one linked pair, 46 taps. The pace and rate bands are in gate per land.js (trusted).

## Ship verdict
**Ship after fixes.**

Blocking:
- B1: the 22 mud boards (258, 265, 267, 270, 275, 278, 279, 280, 282, 284, 285, 286, 287, 288, 290, 291, 292, 293, 295, 296, 297, 299; ids above). Swap them for spares or re-crop them to one big subject, re-bake, and show Peter a contact sheet rendered at play size before pushing.

Non-blocking:
- M1: the 21 weak boards. Fix as many as the spares and crops allow, prioritising the Hard slots (m2) and the closer, 300.
- M2: drop the moats on fw043, fw053, fw042 and fw016 if those boards stay.
- M3: the map look is Peter's call as a known compromise.
- m1: add the "The Floating World: " prefix to the credit line.
- m3-m5: as listed.

---

# Round 2 re-check (round 5 install, 29 levels), 2026-10-12

Build: head 36cb8ea (not pushed), served on 127.0.0.1:8517. Shots in `tools/critic-land-07/r2/` (untracked): `boards/bNN.png` (each board at its CSS size in play at 375x812), `blind-1.png` / `blind-2.png` (Zen numbers only), `zoom-rings.png` (255, 264, 267, 273, 269, 277 at 1.4x), `comp-phone.jpg` (join, top of world, win, loss), `func-notes.txt`.

## selfTest
**375x812@3 884 / 0; 1280x720 886 / 0; 0 console messages.** My runs (29 boards, play, map at 375 and 1280): 0 console messages, 0 page errors.

## Counts
BLOCKER 0 · MAJOR 1 · MINOR 5

## Boards at play size (same method: each board loaded with SP.load at 375x812 and captured at its CSS size, judged blind, then against the title)

**23 read, 6 weak, 0 mud.** This is a different world from round 1's 7 / 21 / 22.

| Zen | Level | Id | Title | Rating | Reason |
|---|---|---|---|---|---|
| 251 | 401 | fw001 | The Cooper's Barrel | reads | Fuji inside a bold wooden ring |
| 252 | 402 | fw040 | Hydrangea and Swallow | reads | Blue flower clusters on yellow, with the swallow dark at the top right |
| 253 | 403 | fw101 | Bonito | reads (borderline) | A big fish spindle on orange. No eye, but the shape is a fish |
| 254 | 404 | fw025 | Fuji above the Pass | reads | A navy cone with a white cap on a yellow sky |
| 255 | 405 | fw005 | The Carp Streamer | **weak** | The top half is a blue carp with an eye. The lower half is speckle, and the mire ring is a dark box around grey noise. Without the title it's "a blue shape" |
| 256 | 406 | fw082 | Lilies | reads | One big orange lily on teal |
| 257 | 407 | fw004 | Amida Falls | reads | A white waterfall |
| 258 | 408 | fw095 | Crane over a Wave | reads | A white crane with a red crown on blue |
| 259 | 409 | fw032 | Fuji Reflected | reads | Fuji with its mirror image. The best board in the world |
| 260 | 410 | fw052 | Cherry over the River | reads | Pink blossoms on blue over a river bank |
| 261 | 411 | fw041 | Iris and Grasshopper | reads | Purple irises and green blades (no grasshopper, which is fine) |
| 262 | 412 | fw102 | Yellowtail and Blowfish | reads | A navy fish with a white eye |
| 263 | 413 | fw029 | The Big Ship | reads | A sail, a mast and a hull |
| 264 | 414 | fw083 | Bell-Flowers | reads | Magenta flowers and leaves. The ring hugs the cluster (see below) |
| 265 | 415 | fw100 | Rabbits in Moonlight | reads | A white rabbit under the moon |
| 266 | 416 | fw065 | The Cushion Pine | reads | Fuji on a pink sky over a dark hill. It reads as Fuji more than as a pine |
| 267 | 417 | fw046 | The Moon Pine (Hard) | **weak** | Brown branches and a loop. The ring is a blue rectangle along the bottom. "A tree", but not the pine framing a view |
| 268 | 418 | fw042 | Morning Glories | reads | Blue flowers on yellow |
| 269 | 419 | fw099 | Pheasant in Snow | **weak** | A brown bird-or-bear blob with a blue outline on a blue sky. No head shape and no snow |
| 270 | 420 | fw024 | Tago Bay | reads | Fuji on a blue sky over green fields |
| 271 | 421 | fw050 | The Festival Banner | **weak** | A red ribbon or figure on beige with red leaves. The banner and the bay don't resolve |
| 272 | 422 | fw043 | Peonies | reads | A big pink flower mass with leaves. It's busy, but anyone says "pink flowers" |
| 273 | 423 | fw103 | Flying Fish | reads | A dark fish with a white eye. The ring is a stray line (below) |
| 274 | 424 | fw071 | Dawn at Isawa (Hard) | reads | Fuji on an orange sky over dark village shapes |
| 275 | 425 | fw055 | Fudo Falls | reads | A waterfall between dark cliffs |
| 276 | 426 | fw084 | Cotton Roses | reads | Pink flowers and dark leaves |
| 277 | 427 | fw044 | Okiku at the Well | **weak** (close to mud) | A black hair mass and a white crescent face on navy. A kid sees a black shape and a moon |
| 278 | 428 | fw017 | Under Mannen Bridge | **weak** | Tan diagonal beams over blue water. It's a bridge only once you know |
| 279 | 429 | fw021 | Cranes at Umezawa (Hard) | reads, **title wrong** | It reads as Fuji. There are no cranes on the board (see m1) |

**The coordinator's flags:** confirmed weak: 255, 269, 271, 277, 278. Rejected: 272 Peonies reads. I add 267 The Moon Pine.

## MAJOR

**R2-M1. 6 weak boards** (255/405 fw005, 267/417 fw046, 269/419 fw099, 271/421 fw050, 277/427 fw044, 278/428 fw017). That's 21% of the world, with none mud. This doesn't block shipping. It's clearly visible, though, and 267 is one of the 4 Hards. Art lane: swap them for spares, or simplify further (one subject, a plain ground, no ring on 255 and 267).

## MINORS

- **R2-m1. 279 Cranes at Umezawa has no cranes.** The board is only a Fuji cone on a dawn sky over green. The licence edit note confirms it: "Fuji repainted as one bold navy cone with a white cap on a dawn sky". The world's closing level has a title that doesn't match its picture. Fix: retitle (e.g. "Fuji from Umezawa"), or paint the cranes back into the foreground.
- **R2-m2. Fuji repeats.** There are **6** Fuji cones, not 4: 254, 259, 266, 270, 274 and 279. None are back to back, but 266, 270, 274 and 279 fall every 4-5 levels in the last 14, and the world ends on its sixth. 254 and 279 are near twins: a centred navy cone with a white cap on a yellow-orange sky. 259 (the reflection) and 266 (pink sky) are distinct enough. Fix: retitle or recolour 279's sky (it closes the world), or move 270 or 274 earlier so the run spreads out.
- **R2-m3. Rings** (`zoom-rings.png`).
  - **405 (mire):** reads as a stray dark box around grey speckle in the carp's lower half.
  - **423:** two parallel blue lines run diagonally across the fish and the sky. Stray.
  - **417:** a blue rectangle along the bottom. It could pass for a pond edge, but it's boxy.
  - **414:** hugs the flower cluster's outline, with a short stray arm at the left. Reads as part of the picture.
  - Fix: moatSkip fw005 and fw103 (and fw046 if it moves off the Hard), then re-bake.
- **R2-m4. The lore line is stale.** It names "bridges, waterfalls, boats and snow", and the 29 have 1 bridge, 2 falls, 1 ship and 1 snow scene. A plain replacement: "The road climbs from old Edo to Mount Fuji, with flowers, fish and birds along the way, all from Hokusai's and Hiroshige's woodblock prints and waiting to be dug out a block at a time."
- **R2-m5. Carried over:** the 1280 realm and Next up cards still show "Side quest 12 ... Quartermaster +1" and an empty "Secrets found". The map tint is still a green wash of the Campaign sheets (round 1's M3, Peter's call). fw095 is still "n.d.".

## Checks that passed

- **Win on 251** (plain URL, then real taps in play): the map's Play opened "251 The Cooper's Barrel". 46 taps gave "Picture done" and "The Cooper's Barrel by Katsushika Hokusai, all dug out.".
- **Loss on 279** (Hard): 25 lossPlan taps gave "A little stuck", "Line jammed: Cream and Mint can't reach a block. Have another look.", with Continue offered. Retry restarted 279. The top-bar retry and the map button both work.
- **Join and fog with 29 nodes:** 249 and 250 done, then the "World 6 The Floating World" banner, then 251 current. The top of the world shows 277, 278 and 279, then "More worlds on the way". All 29 node numbers fit their discs (the tightest has 1.0 px spare). No horizontal overflow at 375 or 1280. The 1280 realm card reads "26/29 cleared".
- **Credits:** the Zen map foot now reads "... Masterpiece Gallery: ... (CC0). The Floating World: Japanese woodblock prints by Katsushika Hokusai and Utagawa Hiroshige from the Art Institute of Chicago open access (CC0); most adapted for the game by Click it! Studios." The two worlds are clearly separated now. Round 1's m1 is fixed.
- **LICENSES.md World 6:** the heading reads 401-429, the credit line matches, and the header is "| Zen picture | Level | Picture | Artist | Licence | Source |". There are **29 rows** keyed "| 251 | 401 |" .. "| 279 | 429 |", with 29 artic.edu URLs and CC0 on every row. **26 rows carry the edit note.** The 3 without one are fw004, fw055 and fw084, the kept prints that were never edited. Round 1's m5 is fixed.
- **Titles at 375:** none of the 29 overflows. The smallest auto-fit is 14.4 px (252).
- **Spread:** E10 / N15 / H4. Of the Hards, 259 and 274 read, 279 reads but has the wrong title, and 267 is weak.

## Ship verdict (round 2)
**Ship.** Nothing blocks.

Worth doing before the push, since they're cheap text and data edits: the 279 title (R2-m1) and the lore line (R2-m4). Dropping the rings on fw005 and fw103 (R2-m3) needs a re-bake of 405 and 423.

For the art lane, when there's time: weak boards fw005, fw046, fw099, fw050, fw044, fw017. Also give 279's Fuji (fw021) a different look from 254's (fw025).
