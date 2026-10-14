# Critic: Zen World 11 Cloud Kingdom (v7 lane D), 2026-10-13

Build: the exported snapshot of commit 79eed50 (`scratchpad/w11-critic/sappers-path/`). The snapshot has no `.claude/`, so I served it from the snapshot dir on 127.0.0.1:8553 with the threaded `/Users/peter/Documents/Claude/.claude/serve.py`. No world file failed to load. The server was killed afterwards. Shots and data are in `tools/critic-land-13/` (untracked). The harness is the World 10 critic's, retargeted to World 11: `boards.mjs`, `func.mjs`, `back.mjs`, `blind.py`, `zoom.py` in the session scratchpad `w11run/`. Nothing in the repo was read through the browser.

Numbering: records 588-617, Zen 438-467, ids z11-1..z11-30 (Zen = 437 + N). These will shift 2 lower when lane C's drops land, so **every fix below is keyed by board id (ckNNN)**. Zen and record numbers are given only to find the board in this snapshot.

## selfTest
`tools/selftest-lands.mjs` on the snapshot (page wait raised to 60 s, nothing else changed): **375x812@3 904 passed / 0 failed; 1280x720 906 / 0; 0 console messages.** I trust it for records, numbering, the castle sheets and their tint, the banner, the fog, credits order, no mystery blocks and the opener's win line.

My own runs (30 boards at 1x, the opener won with real taps, a loss, Retry, a second loss, Back to map, the in-play map button, the map at 375@3 and 1280): **0 console messages, 0 page errors.**

## Counts
BLOCKER 0 · MAJOR 2 · MINOR 7

## How the boards were judged
Each board was loaded in play at 375x812 (DPR 1, touch) and captured as the `#board` element at its CSS size (336x360, 8 px a cell for 42x42). I judged from sheets that show only the Zen number (`blind-1.png` .. `blind-4.png`) **before** printing any titles, ids or prompts, and wrote the blind read down first. Then I checked each board against lane C's prompt (`pictures/manifest.json`) and the nearest-neighbour zooms at 1.6x (`zoom-a.png`, `zoom-b.png`, `zoom-c.png`). The in-game order matches LICENSES.md row for row (the 28/30 swap is in: 465 Rocket, 467 Cloud castle gate).

The bar is World 10's. A portrait must read as its subject. A scene must also show its action or setting. **Mud** means I couldn't name it blind at all. Kind: S = the prompt sets a scene, P = a single subject on "a plain background". Ring = the board has a moat ring.

**Result: 19 read, 10 weak, 1 mud (63%).** World 10 was 78%, World 9 78%.

| Zen | Level | Id | Title | Kind | Tag | Rating | Blind read, then reason |
|---|---|---|---|---|---|---|---|
| 438 | 588 | ck001 | Hot-air balloon | P | N | reads | Red and yellow striped balloon with a basket. A strong opener |
| 439 | 589 | ck002 | Cloud castle | P | N | **weak** | Blind: "a white peak in a dark ring". A cream castle on a cream cloud (pale on pale), and the ring draws a pyramid down to both board edges, so it reads as a snowy mountain (m1) |
| 440 | 590 | ck031 | Balloon ride | S | E | **weak** | Blind: "a brown bear in front of a pale moon". The balloon is a cream disc on a pale blue sky. Pale on pale: the ride is lost |
| 441 | 591 | ck003 | Rainbow | P | N | reads | A bold rainbow on navy with two clouds. Excellent |
| 442 | 592 | ck033 | Kite flyer | S | N | **weak** (builder flag) | Blind: "a ring around a red square and an orange animal". The ring wraps fox and kite as one blob with a bridge between; the fox is a tangle of red-orange, the kite a flat red square |
| 443 | 593 | ck006 | Kite | P | E | reads | A red diamond kite with a ribbon tail |
| 444 | 594 | ck035 | Rainbow slide | S | N | **weak** (builder flag) | Blind: "a white thing on a rainbow arc". The rainbow reads; the bunny is a white and grey lump on a pale blue sky. Pale on pale |
| 445 | 595 | ck007 | Eagle | P | N | reads (borderline) | A big brown and gold bird with wide wings. The white head vanishes into the white background |
| 446 | 596 | ck009 | Sun face | P | H | reads | A yellow sun. The face is faint but the subject is plain |
| 447 | 597 | ck036b | Bird nest | S | E | reads (borderline) | A nest with yellow chicks and a brown bird above it. The cloud is gone |
| 448 | 598 | ck010 | Moon and star | P | N | reads | A yellow crescent and an olive star on purple |
| 449 | 599 | ck011b | Cloud sheep | P | E | reads (borderline) | A white woolly sheep with a brown face. White on the cloud-white band, but the blue sky carries the outline |
| 450 | 600 | ck013 | Owl pilot | P | N | reads | An owl with goggle eyes, ringed. The brows slant into a slight frown (fine) |
| 451 | 601 | ck014 | Balloon bunch | P | E | reads (borderline) | A ring of coloured balloons with a pink string. A busy blob at first glance |
| 452 | 602 | ck038 | Cloud bounce | S | N | **weak** | Blind: "an orange animal over a dark bench". The puppy breaks up into orange and grey bits; the trampoline is a black table; the cloud is lost |
| 453 | 603 | ck015b | Parrot | P | H | reads | A red and blue macaw on yellow. Excellent |
| 454 | 604 | ck016 | Storm cloud | P | E | reads (borderline) | A grey cloud with red cheeks. The pale yellow bolt nearly vanishes into the pale yellow ground (m3) |
| 455 | 605 | ck039 | Umbrella float | S | N | reads | A mouse hanging from a big red umbrella |
| 456 | 606 | ck017b | Windmill | P | E | **weak** | Blind: "a red tower with thin pink spokes on sand". The sails are thin pale pink lines on cyan, and the "cloud" is a yellow dune |
| 457 | 607 | ck018b | Flamingo | P | N | **mud** (builder flag) | Blind: "a stick or a branch". A pink and maroon diagonal on teal. The neck and head are a thin pink hook that only the zoom shows. Nameable from the title only |
| 458 | 608 | ck019b | Bubble | P | E | **weak** | Blind: "a pastel orb, a planet or a portal". Nothing says soap bubble at 1x |
| 459 | 609 | ck020 | Dragon kite | P | N | **weak** | Blind: "a green dragon with a teal shape". Reads as a dragon, not a kite; the ring cuts diagonally through the teal wing from the top edge (m1) |
| 460 | 610 | ck042 | Kite tangle | S | H | reads (borderline) | A tall orange and white cat with a red kite above. The ring's loops read as the tangled string, which helps |
| 461 | 611 | ck022 | Hummingbird | P | E | reads | Green with a red throat, ringed. Good |
| 462 | 612 | ck023b | Sky lighthouse | P | N | reads | A red lighthouse on clouds. Good |
| 463 | 613 | ck043b | Moon fishing | S | E | reads (borderline) | A brown bear on a yellow crescent at night. The rod and line are lost; the moon carries it |
| 464 | 614 | ck024 | Puffin | P | N | reads | A puffin head with a red and grey beak, ringed |
| 465 | 615 | ck029 | Rocket | P | E | reads (borderline) | A red rocket with a blue porthole and an orange flame. A little ragged |
| 466 | 616 | ck027b | Swallow | P | N | **weak** | Blind: "a navy bird over a yellow pear". The pale belly is a separate big yellow shape; the forked tail is lost in the blue band |
| 467 | 617 | ck045 | Cloud castle gate | S | H | **weak** | Blind: "a white castle on pink". The castle reads; the knight is a maroon lump at the gate's foot, and the ground is olive yellow, not cloud. **This is the world's closing Hard** |

### Portrait vs scene read rate

| | Boards | Read | Weak | Mud | Read rate |
|---|---:|---:|---:|---:|---:|
| Portraits (P) | 21 | 15 | 5 | 1 | **71%** |
| Scenes (S) | 9 | 4 | 5 | 0 | **44%** |
| World 11 total | 30 | 19 | 10 | 1 | 63% |

- **Scenes are the weak spot again, and worse than World 10 (67%).** Four of the five weak scenes fail the same way: the hero or its prop is pale on a pale sky (440 balloon, 444 bunny, 452 cloud) or tiny (467 knight). 442 fails on the ring.
- **The weak portraits fail on thin shapes or no contrast:** 456 and 457 are thin lines, 439 is cream on cream, 458 and 466 lose the idea (bubble, swallow).
- Hards: 446, 453 and 460 read. 467, the closer, is weak.

### Plain two-band backgrounds (information for Peter, not a finding)
- **14 of 30 use lane C's edit** (the deep blue band on top, the cloud-white band at the bottom, the original plain colour between): 438 439 441 443 446 448 449 452 455 457 462 463 465 466. They match the 14 "Adapted for the board" rows exactly. The cloud-white band reads as ground or cloud at 375 on all 14.
- **9 sit on one flat colour:** 445 (white), 450 (orange), 451 (pale grey-blue), 453 (yellow), 454 (pale yellow), 458 (navy), 459 (orange), 461 (yellow), 464 (pale blue).
- **7 have a real background:** 440, 442, 444, 447, 456, 460 and 467 (skies with clouds, hills, grass, a dune, a pink sky). **Five of those seven are weak.** In this world a real sky background is pale, and pale skies are what swallow the pale heroes. "More real backgrounds" will need darker skies or heroes with dark outlines to pay off here.
- The deep blue top band repeats on 14 boards, the same sameness signal World 10's orange-over-purple gave, though the blue fits the theme better.

## MAJORS

**M1. 457 ck018b Flamingo (Normal) is mud.** Repro: `?debug=1`, `SP.load("z11-20")` at 375x812. See `boards/b20.png` and `zoom-a.png` (bottom middle). Blind, it read as "a stick or a branch": a pink and maroon diagonal on teal, with the neck and head a thin pink hook. It's the one board in the world I couldn't name blind. Lane D's pre-read rule dropped boards like this. Builder flagged it. Fix: drop it, or swap in a flamingo standing on one leg with a thick body and a darker sky.

**M2. 11 boards are weak or mud (37%), including the closing Hard.** World 9 and World 10 were 22%. The pale-on-pale risk the builder named is real, and it reaches past the three flagged boards. In priority order for the art lane:
1. ck018b Flamingo (457 / 607): mud (M1).
2. ck045 Cloud castle gate (467 / 617): the closing Hard. The knight is lost and the ground isn't cloud. If it's dropped, a reading Hard needs to close the world. 453 Parrot or 446 Sun face would close cleanly; 460 Kite tangle is borderline.
3. ck035 Rainbow slide (444 / 594): white bunny on a pale sky (builder flag). It's also the board with 100% candidates.
4. ck031 Balloon ride (440 / 590): cream balloon on a pale sky.
5. ck002 Cloud castle (439 / 589): cream on cream, and the ring turns it into a mountain (m1). It's also World 11's second board, so it's one of the first impressions.
6. ck033 Kite flyer (442 / 592): fox and kite in one ring blob (builder flag).
7. ck038 Cloud bounce (452 / 602): the puppy breaks up; the cloud is lost.
8. ck017b Windmill (456 / 606): thin pale sails.
9. ck027b Swallow (466 / 616): reads as a bird on a pear.
10. ck019b Bubble (458 / 608): an orb.
11. ck020 Dragon kite (459 / 609): a dragon, not a kite, with a stray ring line (m1).

If the lane can only drop a few, 1 to 5 matter most: the mud board, the closer, and the three pale-on-pale boards in the first seven pictures of the world.

## MINORS
- **m1. Rings that read as stray lines.** 9 boards carry a ring: 439 442 444 450 451 459 460 461 464. Two read as stray lines:
  - **439 ck002 Cloud castle:** the ring runs from the castle's peak down to the left and right board edges at the cloud line, as a big triangle. It draws a mountain outline round the castle. If ck002 stays: `moatSkip` ck002, `--drop-moat`, re-bake 589 (`zoom-c.png`, top left).
  - **459 ck020 Dragon kite:** the ring enters from the top edge and cuts diagonally down through the teal wing (`zoom-a.png`, top right). If ck020 stays, `moatSkip` it and re-bake 609.
  - 442's ring with its bridge between fox and kite adds to that board's weak read (M2). The other six hug or frame their hero: 444 (bunny and rainbow edge), 450, 451, 460 (reads as the tangled string), 461, 464. **Keep those.**
- **m2. 467 ck045 Cloud castle gate:** the "knight" is a dark maroon lump at the foot of the gate, beside a maroon door. It doesn't read as blood, but it reads as a dark stain on the step more than a figure. It goes away with the M2 fix.
- **m3. 454 ck016 Storm cloud:** the cheeks are two red plus signs (5 cells each) on grey. They read as blush, not injury, and I'd keep them. The bolt is pale yellow on grey over a pale yellow ground and nearly vanishes. Optional: recolour the bolt to a stronger yellow in `edits.json`.
- **m4. 459 ck020 Dragon kite:** a short red streak at the dragon's mouth (a tongue) and three stray single red cells on the orange ground, bottom right. Not blood at 1x. They go away with the M2 drop, or clean the three dots.
- **m5. LICENSES rows point to `tools/lands/13-cloud-kingdom/pictures/manifest.json`**, which doesn't ship. This carries over from Worlds 7-10.
- **m6. The World 11 map tint** (`grayscale(0.8) brightness(1.4) contrast(0.8) sepia(0.3) hue-rotate(160deg) saturate(2.4)` on sheets 13 and 10) reads as a frosted, icy kingdom (pale blue trees and fields) more than a sky above the clouds. It's readable: the grey node discs and their numbers stand out, and the castle sheet on top fits. It's a theme nuance, not a fix.
- **m7. Carried over at 1280:** Next up shows "Side quest 12 ... Prize: Quartermaster +1", the realm card has an empty "Secrets found" line, and 0 coins on the card (known, LATER.md).

## Kid and portal safety, the rest
- **No lettering on any board.** Checked all 30 at 1x and the 18 zoomed.
- **Red:** nothing reads as blood. Checked 454 (blush crosses), 459 (tongue and stray dots), 464 (the puffin's red beak and a red cell by the eye: reads as beak), 467 (maroon knight and door), 442 (red kite), 455 (red umbrella), 462 (red lighthouse), 465 (red rocket).
- **Faces:** 450 Owl pilot has slanted brows that read as a slight frown, cute rather than scary. 454's grumpy face is barely there.
- **Look-alikes: none.** 465 Rocket is plain red with white fins and a blue porthole, with no red-and-white checks (no Tintin moon rocket). 455's mouse is a plain brown mouse, with no round black ears or red shorts. 450's owl, 453's macaw and 464's puffin are generic.

## Checks that passed
- **Opener at 375@3, real taps:** from the map, "Play picture 438" opened z11-1 "438 Hot-air balloon". 53 real taps on `#tray button.card` (its winOrder) gave "Picture done", "**Hot-air balloon, all dug out.**", Time 0:04, Taps 53, First clear +20, coins +17, and the buttons Back to map / Retry (`win-375.png`).
- **Loss, Retry, Back to map at 375@3, real taps:** 467 Cloud castle gate (Hard) took a 15-tap lossPlan and gave "A little stuck", HARD, "Line jammed: linked squads wait for partners buried in their columns, and Silver, White and Slate can't reach a block. Have another look.", with Continue 250 / Retry / Back to map (`fail-375.png`). Retry (`#p-primary`) restarted z11-30 at 0 plays. A second loss (`fail2-375.png`), then a tap on Back to map (`#p-secondary`), showed the map with "Picture 439" current (`back-map-375.png`). The map's Play then loaded 439, and the in-play map button returned to the map. 0 console messages. (`func.json`'s `mapVisible: false` on its own back-to-map step is the same harness artefact the World 10 critic noted; `back.mjs` is the evidence: `jr: true` after the tap.)
- **The 10→11 join (375):** 435-437 are done on World 10's orange pumpkin sheet. Then come the banner "WORLD 11 Cloud Kingdom", 438 current with "Picture 438", and "Play picture 438" on the pale sky sheet (`map-join-375.png`, `phone-4.png` first panel). The change from orange to pale blue is clean and obvious. No horizontal overflow (scrollWidth - innerWidth = 0).
- **Top and fog:** 461-467 sit on the top sheet with the palace in the clouds above 467, a raven egg beside the road, and "More worlds on the way" in the fog (`map-top-375.png`). 467 is the last node (467 nodes).
- **Numbers fit their discs:** the tightest World 11 number is 25.9 px in the disc's 28 (2.1 px spare) at both 375 (439) and 1280 (438). The closest World 11 nodes are 65.1 px apart at 375 and 74.7 px at 1280 (449-450). Nothing overlaps.
- **1280 map:** the realm card reads "WORLD 11 OF 11 Cloud Kingdom" with the lore ("The road climbs up above the clouds: hot-air balloons and kites, birds of every kind, rainbows, a dragon kite and a rocket, and a palace sitting right on top of the clouds."), "9/30 cleared", and 447 current with "Play picture 447", Easy (`map-1280.png`). The lore matches the boards.
- **Tint:** World 11's images are sheets 13 and 10 under the sky tint above; World 10's sheets 12 and 21 keep `sepia(0.95) saturate(2.8) hue-rotate(-22deg) ...`. Same at 375 and 1280.
- **Credits line:** it ends "... Harvest Festival: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it! Studios. **Cloud Kingdom: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it! Studios.**" In order, after World 10.
- **LICENSES.md:** the section "Zen World 11: Cloud Kingdom (Land 10, levels 588-617 ...)" has its credit line and **30 rows**, 438/588 to 467/617, in game order. Each has its id and seed, "Original work (generated with FLUX.1 [schnell], Apache 2.0)", and an "Adapted for the board" note on exactly the 14 edited boards.

## Verdict: **ship after fixes**

**Blocking (the ship list):**
1. **M1 ck018b Flamingo (457 / 607): mud.** Drop it or swap it.

**Non-blocking (strongly recommended, in the same batch so the renumbering happens once):**
- M2 drops or swaps, in order: ck045 (the closer; then pick a reading Hard to close), ck035, ck031, ck002, ck033, ck038, ck017b, ck027b, ck019b, ck020.
- m1: if ck002 or ck020 stays, `moatSkip` it and re-bake its slot.
- m3: optional bolt recolour on ck016. m4: optional red-dot clean on ck020 if it stays.
- m5 LICENSES pointer, m6 icy tint, m7 carry-overs: later.

### One list for lane C (all board fixes, by id)
| Priority | Id | Title | Now (Zen / level) | Fix |
|---|---|---|---|---|
| **Blocking** | ck018b | Flamingo | 457 / 607 | Drop or swap (mud) |
| 1 | ck045 | Cloud castle gate | 467 / 617 | Drop or swap (weak closing Hard); reorder so a reading Hard closes |
| 2 | ck035 | Rainbow slide | 444 / 594 | Drop or swap (pale bunny on pale sky) |
| 3 | ck031 | Balloon ride | 440 / 590 | Drop or swap (pale balloon on pale sky) |
| 4 | ck002 | Cloud castle | 439 / 589 | Drop or swap; if kept, `moatSkip` + re-bake (m1) |
| 5 | ck033 | Kite flyer | 442 / 592 | Drop or swap (ring blob) |
| 6 | ck038 | Cloud bounce | 452 / 602 | Drop or swap |
| 7 | ck017b | Windmill | 456 / 606 | Drop or swap (thin sails) |
| 8 | ck027b | Swallow | 466 / 616 | Drop or swap |
| 9 | ck019b | Bubble | 458 / 608 | Drop or swap |
| 10 | ck020 | Dragon kite | 459 / 609 | Drop or swap; if kept, `moatSkip` + re-bake (m1), clean 3 red dots (m4) |
| optional | ck016 | Storm cloud | 454 / 604 | Stronger yellow bolt via `edits.json` (m3) |

## Files (tools/critic-land-13/)
`blind-1..4.png` (the numbers-only sheets), `boards/b01..b30.png` + `meta.json` (the 30 boards at CSS size), `zoom-a.png` (454 464 459 / 467 457 456), `zoom-b.png` (440 444 442 / 460 452 466), `zoom-c.png` (439 450 451 / 461 458 445), `map-join-375.png`, `map-top-375.png`, `win-375.png`, `fail-375.png`, `fail2-375.png`, `back-map-375.png`, `phone-4.png` (join, top, win, fail at CSS size), `map-1280.png`, `func.json`.

## Round 2 re-check (2026-10-13, snapshot 4248f5c)

Read-only. I served the snapshot at `scratchpad/w1011-critic/` on 127.0.0.1:8554 with the threaded `/Users/peter/Documents/Claude/.claude/serve.py` (the snapshot has no `.claude/`), then stopped the server. Shots are in `tools/critic-land-13/r2/`. The harness is in the scratchpad `w1011run/`.

**selfTest:** 375x812@3 **904 / 0**, 1280x720 **906 / 0**, 0 console messages. The board capture, the joins and the wins also logged **0 console messages and 0 page errors**.

**Data:** World 11 is 25 levels, 586-610 (Zen 436-460), tagged E9/N12/H4 and ending on 610 Parrot (Hard). None of ck018b, ck045, ck035, ck031 or ck033 appears in zen.json or LICENSES.md. Rings sit on 595 596 603 604 607 only, so ck002 (587) and ck020 (602) are ringless. LICENSES has 25 rows.

### Boards at 375 (blind sheets `r2/blind-1.png`, `r2/blind-2.png`)
A caveat on "blind": I had seen these 25 pictures in round 1, so this pass is blind to numbering but not to the pictures. The pictures are unchanged. The only visible changes are the two removed rings, so I re-judged those two fresh and carried the other 23 ratings over after a second look at CSS size.

**Result: 21 read, 4 weak, 0 mud (84%)**, up from 63%. Portraits read 85% (17 of 20) and scenes 80% (4 of 5).

| Zen | Id | Title | Tag | Rating | Note |
|---|---|---|---|---|---|
| 436 | ck001 | Hot-air balloon | N | reads | |
| 437 | ck002 | Cloud castle | N | **reads (borderline), up from weak** | Without the ring, the pink spires stand against the blue sky and it reads as a castle on a cloud. The base is still cream on cream |
| 438 | ck003 | Rainbow | E | reads | |
| 439 | ck006 | Kite | N | reads | |
| 440 | ck007 | Eagle | N | reads (borderline) | White head on white |
| 441 | ck009 | Sun face | E | reads | |
| 442 | ck036b | Bird nest | N | reads (borderline) | |
| 443 | ck010 | Moon and star | **H** | reads | |
| 444 | ck011b | Cloud sheep | E | reads (borderline) | |
| 445 | ck013 | Owl pilot | N | reads | |
| 446 | ck014 | Balloon bunch | E | reads (borderline) | |
| 447 | ck038 | Cloud bounce | N | **weak** | Unchanged |
| 448 | ck016 | Storm cloud | **H** | reads (borderline) | Now a Hard. The pale bolt (m3) still nearly vanishes |
| 449 | ck039 | Umbrella float | E | reads | |
| 450 | ck017b | Windmill | N | **weak** | Unchanged |
| 451 | ck019b | Bubble | E | **weak** | Unchanged |
| 452 | ck020 | Dragon kite | N | **reads (borderline), up from weak** | Without the ring it's a clear green dragon with a face and a teal wing. The kite is still lost, and the three stray red cells (m4) remain |
| 453 | ck042 | Kite tangle | E | reads (borderline) | |
| 454 | ck022 | Hummingbird | N | reads | |
| 455 | ck023b | Sky lighthouse | **H** | reads | |
| 456 | ck043b | Moon fishing | E | reads (borderline) | |
| 457 | ck024 | Puffin | N | reads | |
| 458 | ck027b | Swallow | N | **weak** | Unchanged |
| 459 | ck029 | Rocket | N | reads (borderline) | |
| 460 | ck015b | Parrot | **H** | **reads, excellent** | The closer |

- **The Parrot closer reads.** It's the strongest portrait in the world, a big red and blue macaw on yellow. I won it with real taps: 49 taps, "Picture done", HARD, "**Parrot, all dug out.**", Time 0:03, First clear +40, coins +26 (`r2/win-z11-25.png`).
- **No mud left.** All four Hards read: 443, 448 (borderline), 455 and 460.
- **Remaining weak boards (non-blocking):** ck038 Cloud bounce, ck017b Windmill, ck019b Bubble, ck027b Swallow. 4 of 25 is 16%, under Worlds 9 and 10's 22%.

### Map
- **10→11 join (375 and 1280):** 429-435 are done on World 10's orange sheet, and 435 is Hard. The "WORLD 11 Cloud Kingdom" banner sits at the seam, with 436 just above on the blue sky sheet (`r2/join10-11-375.png`, `r2/join10-11-1280.png`).
- **World 11 end:** at 375, 457-460 are in view and 460 is the last node (460 nodes). "More worlds on the way" sits in the fog above it (`r2/end11-375.png`); at 1280 the same.
- **New minor (r2-m1):** the top sheet now holds 460 alone. Most of that sheet is empty road with a bridge leading into the fog, and the palace drawing sits up in the fog rather than beside the closer. It's cosmetic and reads as "more to come". Information only.
- **Numbers fit their discs:** at both 375 and 1280, **no node number overflows its disc** among all 460 nodes. The tightest number in Worlds 10-11 is 393, 27 px in 28. The closest nodes are 408-409, 61.5 px apart at 375 and 70.5 px at 1280. No horizontal overflow.
- **Tint:** World 11's sheets 13 and 10 keep the sky tint. World 10's sheets 12 and 21 keep theirs.

### Quick wins (real taps, 375@3)
- z11-1, 436 Hot-air balloon: 53 taps, "Hot-air balloon, all dug out." (`r2/win-z11-1.png`).
- z11-25, 460 Parrot: as above.

### Round 2 verdict, World 11: **ship**
Blocking: none (M1 is fixed, and so are the closer and the two rings). Non-blocking: ck038, ck017b, ck019b, ck027b (weak); m3 the bolt on ck016; m4 the three red cells on ck020; m5 the LICENSES pointer; m6 the icy tint; m7 the carry-overs; r2-m1 the lone top-sheet node.
