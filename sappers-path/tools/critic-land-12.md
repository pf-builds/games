# Critic: Zen World 10 Harvest Festival (v7 lane D), 2026-10-13

Build: the exported snapshot of commit 649e0ad (`scratchpad/w10-critic/sappers-path/`). I served it from the snapshot dir on 127.0.0.1:8552 with `/Users/peter/Documents/Claude/.claude/serve.py`, because the snapshot has no `.claude/` of its own. The server was killed afterwards. Shots and data are in `tools/critic-land-12/` (untracked). The harness is my own: `boards.mjs`, `func.mjs` and `back.mjs` in the session scratchpad `w10run/`. I read nothing through the browser except the game.

Numbering: records 543-587, Zen 393-437, ids z10-1..z10-45. Zen = 392 + N for `SP.load("z10-N")`. The board id (hfNNN) is the stable key for the art lane.

## selfTest
`tools/selftest-lands.mjs` on the snapshot (page wait raised to 60 s, nothing else changed): **375x812@3 900 passed / 0 failed; 1280x720 902 / 0; 0 console messages.** I trust it for records, numbering, caps, shades, moats, the tint on every sheet image, the banner, the fog, credits order, no mystery blocks and the win line.

My own runs (45 boards at 1x, the opener won with real taps, a loss, Retry, a second loss, Back to map, the in-play map button, the map at 375@3 and 1280): **0 console messages, 0 page errors.**

## Counts
BLOCKER 0 · MAJOR 2 · MINOR 8

## How the boards were judged
Each board was loaded in play at 375x812 (DPR 1, touch) and captured as the `#board` element at its CSS size (336x360, 8 px a cell for 42x42). I judged from sheets that show only the Zen number (`blind-1.png` .. `blind-4.png`) **before** printing any titles, ids or prompts. So this pass was properly blind. Afterwards I checked each board against lane C's prompt (`pictures/manifest.json`) and `zoom-safety.png` (crops at 1.5-2.5x, nearest-neighbour). The in-game boards match `shots-land-12/contact-installed.jpg` in content and order.

The bar: a portrait must read as its subject. A scene must also show its action or setting. Kind: S = the prompt sets a scene (field, door, orchard, table, pond, step and so on), P = a single subject on "a plain background".

**Result: 35 read, 10 weak, 0 mud (78%).** That's the same rate as World 9.

| Zen | Level | Id | Title | Kind | Tag | Rating | Reason |
|---|---|---|---|---|---|---|---|
| 393 | 543 | hf001 | Happy pumpkin | P | N | reads | A ringed jack-o'-lantern on purple. A thin red streak under the left eye (m2) |
| 394 | 544 | hf003 | Black cat | P | N | reads | A black cat with yellow eyes, pink ears and a bow. Excellent |
| 395 | 545 | hf041 | Pumpkin patch | S | E | reads | A pumpkin on a brown field. Plain; the mouse in the prompt is gone |
| 396 | 546 | hf042 | Trick or treat | S | N | **weak** | The big red door reads. The ghost kid is a white lump at its edge, with no bucket. The ring runs down from the top edge (m1) |
| 397 | 547 | hf005 | Wise owl | P | N | reads | An owl in a witch hat. Excellent |
| 398 | 548 | hf006 | Candy corn | P | E | reads (borderline) | A cream tip on an orange body with a face. A little blobby |
| 399 | 549 | hf007 | Cauldron | P | N | reads | A black pot, green bubbles, red fire. The ring frames the potion |
| 400 | 550 | hf045 | Apple picking | S | N | **weak** | A brown bear by a bare tree on grass. No apple on the board, so the "picking" is lost |
| 401 | 551 | hf049 | Carving | S | E | reads | A raccoon holding a jack-o'-lantern. The carving isn't shown, but the subject is clear |
| 402 | 552 | hf008 | Witch hat | P | N | reads (borderline) | A big purple pointed hat with an orange band, bent over a green hill. At first glance it's a purple blob |
| 403 | 553 | hf009b | Pumpkin kid | P | N | **weak** | A round orange figure with a leaf on top. The child's face is an orange-yellow smudge |
| 404 | 554 | hf010b | Sheet ghost kid | P | H | reads | A child with a white sheet pulled back and the face showing |
| 405 | 555 | hf038 | Bear with honey | P | E | **weak** | A brown upright animal. The face is lost, and the honey pot is an amber blob on its belly |
| 406 | 556 | hf051 | Haunted house | S | N | reads (borderline) | A crooked purple house with lit windows under an orange moon |
| 407 | 557 | hf011 | Little witch | P | N | **weak** | Purple and yellow shapes around a small brown face inside a ring. You can't find the girl or the wand |
| 408 | 558 | hf012b | Dragon costume | P | E | reads, **but see M1** | A toddler in a green dragon hood with horns. The eyes and cheeks are maroon |
| 409 | 559 | hf013 | Scarecrow | P | N | reads | A straw hat, red cheeks, a big smile. The ring hugs it |
| 410 | 560 | hf036b | Owl in leaves | P | N | **weak** | An orange owl in orange and red leaves on navy. The owl melts into the leaves (the builder's borderline call holds) |
| 411 | 561 | hf014b | Turkey | P | E | reads | A round turkey with a red-orange tail fan. Excellent |
| 412 | 562 | hf015 | Pumpkin pie | P | N | reads | A pie slice with a cream top |
| 413 | 563 | hf056 | Cat and cauldron | S | N | reads (borderline) | A black cat beside a green pot with green smoke |
| 414 | 564 | hf057 | Feast table | S | H | **weak** | A brown roast on a teal platter between pale chairs, on a loud red wall. It reads as "something on a table", not a feast |
| 415 | 565 | hf017 | Red apple | P | E | reads | Excellent |
| 416 | 566 | hf018 | Corn cob | P | N | reads | A yellow cob in a green husk on red |
| 417 | 567 | hf019b | Sunflower | P | E | reads | Excellent |
| 418 | 568 | hf040b | Lantern | P | N | reads (borderline) | An orange round with a yellow glow and a stem: a pumpkin lantern |
| 419 | 569 | hf020b | Squirrel | P | E | reads (borderline) | A red squirrel with a big acorn. The body and tail merge into one red shape |
| 420 | 570 | hf021 | Hedgehog | P | N | reads | A hedgehog with an apple. The ring hugs it |
| 421 | 571 | hf022 | Fox in a scarf | P | E | reads | A fox head over a green scarf |
| 422 | 572 | hf061 | Owl post | S | N | reads (borderline) | An owl in flight reads. The envelope is lost |
| 423 | 573 | hf063 | Sweater weather | S | H | reads | A grey bear holding a yellow mug. The sweater knit is a little muddy |
| 424 | 574 | hf023b | Cider mug | P | E | **weak** | A red mug on a red band. Only the white rim and handle carry it. The red saucer spreads like a spill (m3) |
| 425 | 575 | hf025b | Pumpkin cat | P | N | reads | A black cat on a pumpkin |
| 426 | 576 | hf026 | Ghost and pumpkin | P | E | reads | A friendly ghost hugging a pumpkin |
| 427 | 577 | hf064 | Monster mash dance | S | N | **weak** | A thin green figure with its arms up. It reads as a frog or a lizard, not a monster dancing |
| 428 | 578 | hf068 | Candle glow | S | E | reads (title mismatch) | A jack-o'-lantern. There's no candle, and the step is two thin maroon lines (m4) |
| 429 | 579 | hf027 | Skeleton dog | P | N | reads | A beagle face in a grey hood with a ribcage costume. Cute, not scary |
| 430 | 580 | hf028 | Candy bucket | P | H | reads (borderline) | A jack-o'-lantern with sweets on top. The bucket reads as a pumpkin |
| 431 | 581 | hf029 | Mummy cat | P | E | reads (borderline) | A calico cat sitting. The bandages read as white fur, so "mummy" is lost (safe) |
| 432 | 582 | hf070 | Ghost ship | S | N | reads (borderline) | A white ghost in a brown boat on teal water |
| 433 | 583 | hf030b | Spider pal | P | E | reads | A round purple spider with big eyes. Excellent and friendly |
| 434 | 584 | hf031 | Frankie pup | P | N | reads | A green monster pup with an underbite and two fangs (m6) |
| 435 | 585 | hf033 | Pie slice | P | E | **weak** | A lumpy yellow wedge on a plate. The lattice is gone, so it reads as cheese or bread |
| 436 | 586 | hf034b | Turkey hat | P | N | reads | A brown turkey in a black pilgrim hat |
| 437 | 587 | hf035 | Acorn | P | H | reads | A big ringed acorn. A good closer |

### Portrait vs scene read rate

| | Boards | Read | Weak | Mud | Read rate |
|---|---:|---:|---:|---:|---:|
| Portraits (P) | 33 | 27 | 6 | 0 | **82%** |
| Scenes (S) | 12 | 8 | 4 | 0 | **67%** |
| World 10 total | 45 | 35 | 10 | 0 | 78% |

- Portraits read better again (World 9: 89% vs 50%). The gap is smaller here because the scenes that pass have one big hero: 395, 401, 406, 413, 423, 428 and 432.
- **The weak portraits fail on the face or the colour, not the framing.** 403, 405 and 407 lose the face. 410 and 424 put the subject on its own hue (orange on orange, red on red). 435 loses its texture.
- **The weak scenes lose their action.** 396 has no visible kid or bucket, 400 no apple, 414 no feast and 427 no dance.

### Plain two-band backgrounds (information for Peter, not a finding)
- **24 of 45 boards use lane C's edit**: a tighter crop with the plain background split into a band at the top and a band at the bottom. Almost all of them have the same orange top stripe over a purple ground: 393 395 396 397 398 399 402 403 405 408 410 412 416 418 421 422 424 425 426 427 428 432 435 437. These are exactly the 24 rows with an "Adapted for the board" note.
- **18 sit on one flat colour:** 394 401 404 407 409 411 413 415 417 419 420 423 429 430 431 433 434 436.
- **Only 3 have a real background:** 400 (orchard, sky, grass and a tree), 406 (night sky and moon) and 414 (table and chairs). Two of those three are weak boards, so a real background alone isn't what makes a board read.
- That repeated orange-over-purple frame is the strongest "sameness" signal in the world. It shows across about half the boards.

## MAJORS

**M1. 408 hf012b Dragon costume (Easy): a toddler's face with maroon eyes and maroon cheek marks.** Repro: `?debug=1`, `SP.load("z10-16")` at 375x812. See `zoom-safety.png`, top row, second tile. Both eyes are dark maroon blocks (about 2x3 cells), with maroon smears on the forehead under the hood and on the left cheek. Nothing in the prompt asks for red ("a toddler in a green dragon costume"), so it's a FLUX artefact. At 1x it reads as a child with red, sore eyes or wounds. That's the same class as World 9's M1 (pp031, pp051): the one thing a parent or a portal reviewer bounces on sight. Fix: recolour the maroon swatch to near-black eyes and skin-tone cheeks via `edits.json` and re-bake slot 558, or swap it for a spare. **It goes on the ship list.**

**M2. 10 weak boards (22%), one of them a Hard.** In priority order for the art lane:
1. hf057 Feast table (414 / 564): a Hard, and the world's busiest red.
2. hf064 Monster mash dance (427 / 577): a thin lizard-like figure, with a ring tracing the thin limbs.
3. hf033 Pie slice (435 / 585): reads as cheese.
4. hf023b Cider mug (424 / 574): red on red, and the saucer looks like a spill (m3).
5. hf042 Trick or treat (396 / 546): the kid is lost, and the ring (m1) adds to it.
6. hf009b Pumpkin kid (403 / 553): no face.
7. hf011 Little witch (407 / 557): tangled.
8. hf038 Bear with honey (405 / 555): no face, no pot.
9. hf045 Apple picking (400 / 550): no apple.
10. hf036b Owl in leaves (410 / 560): orange on orange.

Same share as World 9 (22%) and World 7. Only 1 of the 5 Hards is weak (414). The other Hards read: 404, 423, 430 and 437.

## MINORS
- **m1. Ring on 396 hf042 Trick or treat (builder flag).** The ring starts at the top edge and runs as a vertical line down the door's right side (about 8 cells of it cross the orange sky band), then wraps the ghost kid's head (`zoom-safety.png`, top right). Below the sky it reads as a door frame. The stub through the sky reads as a stray line. If the board stays, add hf042 to `moatSkip`, `--drop-moat`, and re-bake 546. If it's swapped, the question goes away.
- **The ring on 428 hf068 Candle glow (builder flag) is fine.** It hugs the pumpkin. The stray-looking lines on that board are picture cells, not the ring (m4). **Keep its ring.** The other 15 rings hug their hero or frame it: 393 394 399 401 407 409 420 423 426 427 429 430 431 434 437. 399 frames the potion, not the pot, which is fine.
- **m2. 393 hf001 Happy pumpkin (the opener):** a one-cell red vertical streak under the left eye, red on orange. It reads as carving shading, not blood, but it is the first board of the world. Optional recolour to the dark brown of the mouth.
- **m3. 424 hf023b Cider mug:** the red saucer spreads on the purple ground like a puddle of red liquid. It doesn't read as blood next to a steaming mug, but it adds to the weak read. Fix it with the swap in M2.
- **m4. 428 hf068 Candle glow:** the title promises a candle that isn't on the board (it's a jack-o'-lantern). The "step" is two thin maroon horizontal lines that read as scratches. Rename it ("Pumpkin glow") or clean the lines in `edits.json`. Not blocking.
- **m5. Pumpkins and repeats.** Jack-o'-lanterns or pumpkins are the hero of 9 of the 45 boards: 393 395 401 403 418 425 426 428 430. Two of them, 393 and 428, are both a ringed jack-o'-lantern on dark purple. Add that to the 24 identical orange-over-purple frames. If anything is swapped, swap toward non-pumpkin subjects and real backgrounds.
- **m6. 434 hf031 Frankie pup:** a goofy green monster pup with an underbite and two fangs. It's slightly grim but fine for Halloween. **Trade dress: no look-alike.** Frankenweenie's Sparky is a white bull terrier with stitches. This is a generic green Frankenstein pup with bolts, and "Frankie" is a common name. No action needed.
- **m7. LICENSES rows point to `tools/lands/12-harvest-festival/pictures/manifest.json`**, which doesn't ship. This carries over from Worlds 7-9 (World 9 critic m5). It's consistent, but a reader of the public file can't follow the pointer.
- **m8. Carried over at 1280:** Next up shows "Side quest 12 ... Prize: Quartermaster +1", the realm card has an empty "Secrets found" line, and 0 coins (known, LATER.md). Separately, the World 10 tint (`sepia(0.95) saturate(2.8) hue-rotate(-22deg)`) makes the desktop map almost one orange hue. That's on theme, but the sheet detail is muddier than Worlds 5-9. Optional.

## Kid and portal safety, the rest
- **No lettering on any board.** The ghost party board with gibberish text was dropped in round 2.
- **Spooky subjects are all cute:** 429 Skeleton dog (a costume on a smiling beagle), 431 Mummy cat (reads as a plain calico cat), 427 monster (lizard-like), the ghosts 404, 426 and 432 (friendly), and 433 spider (round and big-eyed).
- **Red:** only M1 (408) reads as injury. m2 (393) and m3 (424) were checked and are fine. 399's red fire, 414's red wall and 416's red ground are plainly background or fire.
- **No other trade-dress look-alikes.** 394's black cat with a bow and 433's spider are generic.

## 545 Pumpkin patch: too easy?
Not by the grade. Its rate is 0.6725 in the Easy band 0.45-0.8, with peak 2 and 55 cards. Eight of the world's 16 Easies grade easier: 548 0.71, 551 0.70, 555 0.69, 567 0.69, 569 0.70, 574 0.72, 576 0.735 and 583 0.73. It is the plainest board to look at (a ball under three bands), so it *feels* quick. In third position that's fine. No change.

## Checks that passed
- **Opener at 375@3, real taps:** from the map, "Play picture 393" opened z10-1 "393 Happy pumpkin". 45 real taps on `#tray button.card` (its winOrder) gave "Picture done", "**Happy pumpkin, all dug out.**", Time 0:03, Taps 45, First clear +20, coins +16, and the buttons Back to map / Retry (`win-375.png`).
- **Loss, Retry, Back to map at 375@3, real taps:** 437 Acorn (Hard) took a 7-tap lossPlan and gave "A little stuck", Hard, "Line jammed: Brown and Orange can't reach a block. Have another look.", with Continue 250 / Retry / Back to map (`fail-375.png`). Retry (`#p-primary`) restarted z10-45 at 0 plays. A second loss, then a tap on Back to map (`#p-secondary`), showed the map with "Picture 394" current (`back-map-375.png`). The map's Play then loaded 394, and the in-play map button returned to the map. 0 console messages. (One harness artefact: my first run called `SP.screen()` with no argument after the tap, which re-shows a screen. The `back.mjs` re-run without that call is the evidence.)
- **The 9→10 join (375):** 391-392 are done on World 9's green park. Then come the banner "WORLD 10 Harvest Festival", 393 current with "Picture 393", and "Play picture 393" (`map-join-375.png`). The change from green meadow to pumpkin-orange parchment is clean and obvious. No horizontal overflow (scrollWidth - innerWidth = 0).
- **Top and fog:** 427-437 sit on the orange sheet, 437 is the last node (437 nodes), and "More worlds on the way" sits under the fog (`map-top-375.png`).
- **Numbers fit their discs:** the tightest World 10 number is 27 px in the disc's 28 at both 375 (396) and 1280 (393). The closest World 10 nodes are 61.5 px apart at 375 and 70.5 px at 1280 (408-409). Nothing overlaps.
- **1280 map:** the realm card reads "WORLD 10 OF 10 Harvest Festival" with the lore, "9/45 cleared", and 402 current with "Play picture 402" (`map-1280.png`).
- **Tint:** World 10's images are sheets 12 and 21, under `sepia(0.95) saturate(2.8) hue-rotate(-22deg) brightness(1.1) contrast(1.08)`. World 9's sheets 11 and 03 keep their own tint.
- **Credits line:** it ends "... Puppy Park: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it! Studios. **Harvest Festival: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it! Studios.**" That's in order, after World 9.
- **LICENSES.md:** the section "Zen World 10: Harvest Festival (Land 9, levels 543-587 ...)" has its credit line and **45 rows**, 393/543 to 437/587. Each has its id and seed, "Original work (generated with FLUX.1 [schnell], Apache 2.0)", and an "Adapted for the board" note on exactly the 24 edited boards.

## Verdict: **ship after fixes**

**Blocking (the ship list):**
1. **M1 hf012b Dragon costume (408 / 558):** recolour the maroon eyes and cheeks, or swap it for a spare, then re-bake the slot.

**Non-blocking (strongly recommended before Halloween if the art lane has time):**
- M2 swaps or regenerations, in order: hf057, hf064, hf033, hf023b, hf042, hf009b, hf011, hf038, hf045, hf036b. Prefer non-pumpkin subjects with a real background and one big hero.
- m1: if hf042 stays, `moatSkip` hf042 and re-bake 546. Keep the ring on hf068.
- m2 hf001: recolour the red streak. m4 hf068: rename it or clean the step lines.
- m5 sameness (the orange-over-purple frame, 9 pumpkins), m7 LICENSES pointer, m8 carry-overs and the heavy desktop tint: later.

## Files (tools/critic-land-12/)
`blind-1..4.png` (the numbers-only sheets), `boards/b01..b45.png` + `meta.json` (the 45 boards at CSS size), `zoom-safety.png` (393 408 434 396 / 428 424 429 427), `map-join-375.png`, `map-top-375.png`, `win-375.png`, `fail-375.png`, `fail2-375.png`, `back-map-375.png`, `map-1280.png`, `func.json`.

## Round 2 re-check (2026-10-13, snapshot 4248f5c)

Read-only. I served the snapshot at `scratchpad/w1011-critic/` on 127.0.0.1:8554 with the threaded `serve.py`, then stopped the server. Shots are in `tools/critic-land-12/r2/`. The full method is in `critic-land-13.md`, "Round 2 re-check".

**selfTest:** 375x812@3 **904 / 0**, 1280x720 **906 / 0**, 0 console messages. My runs logged 0 console messages and 0 page errors.

**Data:** World 10 is 43 levels, 543-585 (Zen 393-435), tagged E15/N23/H5 and ending on 585 Acorn (Hard). hf012b and hf057 are in neither zen.json nor LICENSES.md, and LICENSES has 43 rows. Rings sit on 543 544 549 551 557 558 568 571 574 575 576 577 578 579 582 585, so **546 hf042 is ringless**. That closes M1 (the maroon-eyed Dragon costume), M2's first item (Feast table, the weak Hard) and m1 (the hf042 ring stub).

### Map
- **9→10 join (375 and 1280):** 390-392 are done on World 9's green sheet. Above them come the "WORLD 10 Harvest Festival" banner on the seam, then 393-400 done on the orange sheet (`r2/join9-10b-375.png`, `r2/join9-10b-1280.png`). 392 and 393 are a long seam apart, so one phone screen doesn't show both, but the banner sits between them.
- **10→11 join:** 429-435 are done on the orange sheet, with 435 Hard. The World 11 banner is at the seam and 436 is on the sky sheet (`r2/join10-11-375.png`).
- **Numbers fit:** no node number overflows its disc among all 460 nodes, at 375 or 1280. The tightest is 393, 27 px in 28. The closest World 10 nodes are 408-409 at 61.5 px (375) and 70.5 px (1280).

### Quick win (real taps, 375@3)
z10-1, 393 Happy pumpkin: 45 taps, "Picture done", "**Happy pumpkin, all dug out.**" (`r2/win-z10-1.png`). 0 console messages.

### Round 2 verdict, World 10: **ship**
Blocking: none. Non-blocking (not re-judged this round, carried from round 1 M2 in order): hf064, hf033, hf023b, hf042 (now ringless, so its board is cleaner but the kid is still lost), hf009b, hf011, hf038, hf045, hf036b. Also m2 (hf001's red streak), m4 (hf068's title and step lines), m5, m7 and m8.
