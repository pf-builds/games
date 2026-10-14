# Critic: Zen World 15 Safari (v7 lane D), 2026-10-14

Build: the exported snapshot of commit 679204b (`scratchpad/w15-critic/sappers-path/`). The snapshot has no `.claude/`, so I served it from the snapshot dir on 127.0.0.1:8558 with the threaded `/Users/peter/Documents/Claude/.claude/serve.py`. No file failed to load. The server was killed afterwards. Shots and data are in `tools/critic-land-18/` (untracked). The harness is the World 14 critic's, retargeted: `boards.mjs`, `func.mjs` (plus a World 8 comparison shot), `back.mjs`, `blind.py`, `zoom.py` in the session scratchpad `w15run/`.

Numbering: records 728-766, Zen 578-616, ids z15-1..z15-39 (Zen = 577 + N). **Every fix is keyed by board id (sfNNN)**, and the fixes are same-count swaps or recolours, so nothing renumbers.

## selfTest
`tools/selftest-lands.mjs` on the snapshot (page wait raised to 60 s): **375x812@3 920 passed / 0 failed; 1280x720 922 / 0; 0 console messages.** I trust it for records, numbering, sheets and tint, banner, fog, credits order, no mystery blocks and the win line.

My own runs logged **0 console messages and 0 page errors**. They covered all 39 boards at 1x; the opener won with real taps; a loss, Retry, a second loss and Back to map; the in-play map button; and the map at 375@3 and 1280.

## Counts
BLOCKER 0 · MAJOR 2 · MINOR 6

## How the boards were judged
Each board was loaded in play at 375x812 (DPR 1, touch) and captured as `#board` at CSS size (336x360, 8 px a cell). I judged from the numbers-only sheets (`blind-1..3.png`) and wrote each blind read down **before** printing titles, ids or prompts. Then I checked each against lane C's prompts and the 1.6x nearest-neighbour zooms (`zoom-a.png`, `zoom-b.png`). These pictures were new to me, and I opened the contact sheet only afterwards. The in-game order matches LICENSES.md row for row.

Same bar as Worlds 10-14. Every Safari prompt sets a real setting, so kind follows the builder's split. **S** = a scene with an action or two subjects (10). **P** = a portrait in a real setting (29).

**Result: 32 read, 6 weak, 1 mud (82%).**

| Zen | Level | Id | Title | Kind | Tag | Rating | Blind read, then reason |
|---|---|---|---|---|---|---|---|
| 578 | 728 | sf001 | Lion | P | N | reads | A lion face with a golden mane. The ring wraps the acacia at the edge, not the lion (m1) |
| 579 | 729 | sf002 | Elephant | P | N | reads | An elephant face-on, with tusks, on savanna |
| 580 | 730 | sf003 | Giraffe | P | E | reads | A giraffe neck among acacias under clouds |
| 581 | 731 | sf202 | Elephant calf | P | N | **mud** (builder flag) | Blind: "a brown mass with two blue windows in rings". The calf's ears are lost in the bank; the two rings frame river patches |
| 582 | 732 | sf026 | Elephant shower | S | N | **weak** | Blind: "a grey elephant under trees". No water spray shows, so the action is lost |
| 583 | 733 | sf004 | Zebra | P | E | reads | A bold zebra face on a pink sunset. Excellent |
| 584 | 734 | sf203 | Giraffe pair | S | N | reads (borderline) | Two red-orange giraffes on cyan, necks crossing |
| 585 | 735 | sf027 | Giraffe snack | S | N | reads (borderline) (builder flag) | A red-orange giraffe reaching into a tree. The branches merge, but the action reads |
| 586 | 736 | sf205 | Hippo calf | P | H | reads | A pink hippo face in water. Good |
| 587 | 737 | sf204 | Zebra foal | P | E | reads (borderline) | A zebra in a green valley |
| 588 | 738 | sf005 | Hippo | P | N | reads | A purple hippo with its mouth open, ringed. The pink-red mouth is just a mouth |
| 589 | 739 | sf007 | Cheetah | P | N | **weak** (builder flag) | Blind: "a tan standing animal with an orange crown, a meerkat or a cub?" The face is a jumble under orange grass tips |
| 590 | 740 | sf034b | Rhino mud bath | S | E | **weak** | Blind: "a grey mass lying in a ring on tan". The rhino's horn and head are lost |
| 591 | 741 | sf008 | Gorilla | P | N | reads | A silverback in the jungle, ringed. Good |
| 592 | 742 | sf206 | Cheetah cub | P | N | reads | A spotted cub face, ringed |
| 593 | 743 | sf010 | Flamingo | P | E | reads | A pink flamingo on a blue lake. Good |
| 594 | 744 | sf009 | Meerkat | P | N | reads (builder flag) | A meerkat standing up on a flat red ground with a dark mound. The red is loud but reads as desert |
| 595 | 745 | sf013 | Lion cub | P | H | reads | An orange cub face in green grass. See the look-alike note |
| 596 | 746 | sf207 | Rhino calf | P | E | reads | A rhino head on orange dunes |
| 597 | 747 | sf011 | Crocodile | P | N | **weak** (builder flag) | Blind: "a green frog standing among palms". Upright, with a pale belly: a frog, not a croc |
| 598 | 748 | sf014 | Baby elephant | P | E | reads (borderline) | A pale brown elephant on tan and pink |
| 599 | 749 | sf038 | Gorilla snack | S | N | reads | A gorilla with a banana. The action shows |
| 600 | 750 | sf209 | Gorilla baby | P | E | reads | A gorilla face, ringed |
| 601 | 751 | sf015 | Toucan | P | N | reads (builder flag) | A toucan in leaves, ringed. A maroon block hangs under the beak (m2) |
| 602 | 752 | sf040 | Giraffe at sunset | P | H | reads (borderline) | A giraffe on a purple sky with an orange sun |
| 603 | 753 | sf039 | Ostrich race | S | E | reads (borderline) | An ostrich under a big sun on an orange plain |
| 604 | 754 | sf210 | Kudu | P | N | **weak, and see M1** (builder flag) | Blind: "an antelope head with horns, ringed, a dark red mass beside it" |
| 605 | 755 | sf016 | Leopard | P | E | reads (builder flag) | A spotted cub on purple. The branch is a maroon band under it (m2) |
| 606 | 756 | sf018 | Lemur | P | N | reads | A ring-tailed lemur face, ringed. Good |
| 607 | 757 | sf215 | Hornbill | P | E | reads | A black and white bird with a big yellow beak in leaves |
| 608 | 758 | sf042b | Toucan tree | S | N | reads (borderline) | A small toucan in a tree with red berries |
| 609 | 759 | sf023 | Chameleon | P | H | reads (borderline) | A green lizard on a branch in an orange and pink jungle, ringed |
| 610 | 760 | sf045 | Hippo yawn | S | E | reads (borderline) | A purple-grey hippo head in a river, the mouth a dark opening |
| 611 | 761 | sf022 | Hyena | P | N | reads (borderline) | Blind: "a brown dog-like face, a hyena". Busy, ringed; the body is salmon with black spots |
| 612 | 762 | sf046b | Zebra herd | S | E | **weak** (builder flag) | Blind: "zebra-ish shapes among trees". The stripes merge with the trunks |
| 613 | 763 | sf217 | Elephant trunk up | S | N | reads | A blue elephant with a raised trunk against an orange sun |
| 614 | 764 | sf025 | Vulture | P | E | reads, **but see M1** | A tan vulture on a branch, a red sun behind. **Red eyes** |
| 615 | 765 | sf218 | Giraffe smile | P | N | reads | A giraffe face close up, ringed. Good |
| 616 | 766 | sf050 | Hot-air balloon | P | H | reads | A striped balloon over the savanna, ringed. A clean closer |

### Portrait vs scene read rate

| | Boards | Read | Weak | Mud | Read rate |
|---|---:|---:|---:|---:|---:|
| Portraits in a real setting (P) | 29 | 25 | 3 | 1 | **86%** |
| Scenes (S) | 10 | 7 | 3 | 0 | **70%** |
| World 15 total | 39 | 32 | 6 | 1 | 82% |

- **Portraits in real settings read well (86%).** That's close to Farm Friends' plain-ground portraits (90%), so the real backgrounds cost little when the animal fills the board (583, 586, 591, 593, 606, 615).
- The failures come from three causes:
  - **camouflage:** 581's calf in the bank, 612's stripes in the trunks, 589's cheetah in the grass
  - **pose:** 597 stands like a frog
  - **lost action:** 582 has no spray, 590 has no head
- Hards: 586, 595, 609 (borderline), 602 (borderline) and 616 read.

### Background types (information for Peter)
- **Band edits: 0. Real settings: all 39 by prompt.** That's savanna, acacias, rivers, jungle, dunes and sunsets.
- At 375, **3 read as nearly flat colour:** 594 (flat red ground with one mound), 613 (salmon with a sun disc) and 614 (white with a sun disc). Every other board shows a recognisable setting.

## MAJORS

**M1. Two boards carry a blood or creepy read (kid and portal safety).**
- **604 sf210 Kudu (builder flag).** Repro: `?debug=1`, `SP.load("z15-27")` at 375x812. See `boards/b27.png` and `zoom-a.png` (top right).
  - A large dark maroon mass fills the lower right of the board, under and beside the antelope's head and neck.
  - On its own it might be shadow. But this is a world of lions, cheetahs, hyenas and a vulture, and an antelope head beside a dark red pool reads as a kill.
  - The board is also weak: a busy head inside a jagged ring.
  - Fix: a **same-count swap**.
- **614 sf025 Vulture.** Repro: `SP.load("z15-37")`. See `boards/b37.png` and `zoom-a.png` (bottom left).
  - Each eye is a single bright red cell, on a vulture perched on a dead tree in front of a red sun.
  - It reads as a red-eyed scavenger, the same class as World 14's ff003 sheep and World 10's hf012b.
  - Fix: recolour the two red eye cells to black via `edits.json` and re-bake 764. No renumbering.

**M2. 581 sf202 Elephant calf (Normal) is mud (builder flag).** Repro: `SP.load("z15-4")`. See `boards/b04.png` and `zoom-b.png` (top middle).
- Blind it read as "a brown mass with two blue windows in rings". The calf's head is a brown block, its ears blend into the bank, and the two rings frame patches of river.
- It's also the first of three elephants in four boards (579, 581, 582).
- Fix: a **same-count swap to a non-elephant subject**, which also fixes the 581-582 neighbour pair.

## MINORS
- **m1. Rings.** 15 boards carry a ring: 578 581 588 589 590 591 592 600 601 604 606 609 611 615 616. Two read as stray lines:
  - **578 sf001 Lion, the opener:** the ring wraps the acacia at the right edge, not the lion. It reads as a blue squiggle beside the lion's face (`zoom-b.png`, top left). Fix: `moatSkip` sf001 and re-bake 728.
  - **581 sf202:** the two rings around river patches go away with M2's swap.
  - 604's ring goes away with M1's swap.
  - The rest hug or frame their animal, so **keep them**: 588, 591, 592, 600, 601, 606, 609, 611, 615, 616. On 589 and 590 the rings frame the animal but don't rescue it.
- **m2. Maroon patches (builder flags), not blood at 1x:**
  - **601 sf015 Toucan:** a 4x12-cell maroon block hangs under the yellow beak (`zoom-a.png`, top left). It reads as the beak's dark red underside. Optional: recolour it to the beak's orange.
  - **605 sf016 Leopard:** the branch is a maroon band across the bottom, under a predator cub, with a few maroon cells by the chest (`zoom-a.png`, top middle). At 1x it reads as a dark branch. **Recommended** in this world of predators: recolour the maroon to brown.
  - **611 sf022 Hyena:** the body is salmon with black spots, next to a dark open mouth. At 1x it reads as a spotted coat. No action.
  - **588 Hippo** and **610 Hippo yawn:** their open mouths are pink or dark, not red. **No predator has a wound or a kill.**
- **m3. Lion King look-alikes: none individually.**
  - 578 Lion has a golden mane, not Mufasa's dark red one.
  - 595 Lion cub is a generic orange cub with no head tuft. It's Simba-adjacent only by being a lion cub, as the builder said.
  - 594 Meerkat is a realistic meerkat: no hair tuft, no grin, not Timon.
  - 607 Hornbill is black and white with a yellow beak, not Zazu's blue body and red bill.
  - 611 Hyena is a single generic hyena.
  - Rafiki, Pumbaa and Mufasa-and-Simba are out.
  - **Taken together, though,** the world holds a lion, a lion cub, a meerkat, a "laughing" hyena (the prompt's word) and a hornbill. That's the film's cast list minus the warthog and the mandrill. Keep the titles plain (they are), and never name the cub, the meerkat or the hyena. Optional: swap the hyena, which is busy and borderline anyway.
- **m4. Same-subject neighbours** (the reorders are lane D's own job; each pair below swaps same-tag slots, so no tag plan changes):
  - **Elephants 581-582:** fixed by M2's swap to a non-elephant.
  - **Giraffes 584-585:** swap sf027 Giraffe snack (585, N) with sf007 Cheetah (589, N), or with whatever comes into slot 589 if sf007 is swapped. Avoid 588 Hippo: it would sit next to 586 Hippo calf.
  - **Gorillas 599-600:** swap sf209 Gorilla baby (600, E) with sf039 Ostrich race (603, E).
  - **Hornbill and toucan 607-608** (601 is a toucan too): swap sf042b Toucan tree (608, N) with sf022 Hyena (611, N).
- **m5. The golden tint against World 8's ochre.** Safari is `sepia(.6) saturate(1.9) hue-rotate(2deg) brightness(1.15) contrast(1.05)` on sheets 23 and 13. World 8 Poster Parade is `sepia(.55) saturate(2.1) hue-rotate(-16deg) contrast(1.35) brightness(1.02)`. Side by side at 375 (`phone-4.png`: join, middle, top, then World 8):
  - Both are the same tan-gold family.
  - World 8 is darker and redder, with canyons, pines and heavy shadow.
  - Safari is paler and yellower: dry khaki plain, scrub, a waterhole, huts.
  - They are **distinguishable, not identical**, and seven worlds apart. Safari is also near World 12's khaki brass tone. Fine to ship; if anything, a touch more yellow-green (hue-rotate 8-10deg) would separate it further. Optional.
- **m6. Carry-overs:** the LICENSES rows point to `tools/lands/18-safari/pictures/manifest.json`, which doesn't ship (from Worlds 7-14). Desktop: "Side quest 12 ... Quartermaster +1", an empty "Secrets found" line, and 0 coins on the realm card (LATER.md).

## Kid and portal safety, the rest
- **No lettering on any board.**
- **Predators:** the lion, lion cub, cheetah, cheetah cub, leopard, hyena and crocodile are all portraits at rest. There's no prey, no teeth on show apart from the hippo yawns, and no wounds. 604's maroon is the only kill-like read (M1).
- **Red:** 594's flat red desert is loud but plainly ground. 616's balloon stripes and 608's berries are fine.

## Checks that passed
- **Opener at 375@3, real taps:** "Play picture 578" opened z15-1 "578 Lion". 49 real taps gave "Picture done", "**Lion, all dug out.**", and Back to map / Retry (`win-375.png`).
- **Loss, Retry, Back to map at 375@3, real taps:**
  - 616 Hot-air balloon (Hard) took a 14-tap lossPlan and gave "A little stuck", HARD, "Line jammed: Red and Dark brown can't reach a block. Have another look.", with Continue 250 / Retry / Back to map (`fail-375.png`).
  - Retry (`#p-primary`) restarted z15-39 at 0 plays.
  - A second loss (`fail2-375.png`), then Back to map (`#p-secondary`), showed the map (`jr: true`) with "Picture 579" current (`back-map-375.png`).
  - The map's Play loaded 579, and the in-play map button returned to the map.
  - 0 console messages.
- **The 14→15 join (375):** 576-577 are done on World 14's green sheet, 577 Hard. The banner "WORLD 15 Safari" sits on the seam, with 578 current, "Picture 578" and "Play picture 578" on the gold sheet (`map-join-375.png`). Green to gold is a clean change. No horizontal overflow.
- **Top and fog:** 609-616 sit on the top sheet, 616 is the last node (616 nodes), and "More worlds on the way" sits in the fog (`map-top-375.png`).
- **Numbers fit their discs:** the tightest World 15 number is 582, 25.9 px in the disc's 28 (2.1 px spare), at both 375 and 1280. The closest nodes are 581-582, at 60.0 px (375) and 68.7 px (1280). Nothing overlaps.
- **1280 map:** the realm card reads "WORLD 15 OF 15 Safari" with the lore ("The road heads out onto the warm savanna, where lions doze, elephants splash at the waterhole, giraffes nibble the treetops ..."), "9/39 cleared", and 587 current with "Play picture 587", Easy (`map-1280.png`). The road and trail read well on the gold plain.
- **Credits line:** it ends "... **Safari: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it! Studios.**" In order, after World 14.
- **LICENSES.md:** the section "Zen World 15: Safari (Land 14, levels 728-766 ...)" has its credit line and **39 rows**, 578/728 to 616/766, in game order. Each has its id and seed, and **0** carry "Adapted for the board", which matches 0 edits.

## Verdict: **ship after fixes**

**Blocking (the ship list):**
1. **M1 sf210 Kudu (604 / 754):** same-count swap (the antelope head beside a dark red mass reads as a kill).
2. **M1 sf025 Vulture (614 / 764):** recolour the red eyes to black, then re-bake.
3. **M2 sf202 Elephant calf (581 / 731):** same-count swap to a non-elephant (mud). This also fixes the elephant neighbours.

**Non-blocking:**
- Swap the weak boards sf007, sf034b, sf011, sf046b and sf026.
- m1: turn off the ring on sf001 (the opener).
- m2: recolour the maroon on sf016 (recommended) and sf015 (optional).
- m4: the three two-slot reorders.
- m5: optionally shift the tint a little yellow-green.

### One list (all board fixes, by id)
| Priority | Id | Title | Now (Zen / level) | Fix |
|---|---|---|---|---|
| **Blocking** | sf210 | Kudu | 604 / 754 | Same-count swap (maroon kill read; weak) |
| **Blocking** | sf025 | Vulture | 614 / 764 | Recolour the red eye cells to black (`edits.json`), re-bake |
| **Blocking** | sf202 | Elephant calf | 581 / 731 | Same-count swap to a non-elephant (mud) |
| 1 | sf007 | Cheetah | 589 / 739 | Same-count swap (the face is a jumble) |
| 2 | sf011 | Crocodile | 597 / 747 | Same-count swap (reads as a frog) |
| 3 | sf046b | Zebra herd | 612 / 762 | Same-count swap (stripes merge with trees) |
| 4 | sf034b | Rhino mud bath | 590 / 740 | Same-count swap (no head or horn) |
| 5 | sf026 | Elephant shower | 582 / 732 | Same-count swap (no spray; three elephants in four boards) |
| ring | sf001 | Lion | 578 / 728 | `moatSkip` + re-bake (the ring wraps the tree, not the lion) |
| recolour | sf016 | Leopard | 605 / 755 | Maroon branch to brown (recommended) |
| optional | sf015 | Toucan | 601 / 751 | Maroon block under the beak to orange |
| optional | sf022 | Hyena | 611 / 761 | Swap (busy; the cast-list point in m3) |
| reorder | sf027 ↔ slot 589 | Giraffe snack | 585 ↔ 589 (both N) | Breaks up the giraffe pair |
| reorder | sf209 ↔ sf039 | Gorilla baby ↔ Ostrich race | 600 ↔ 603 (both E) | Breaks up the gorilla pair |
| reorder | sf042b ↔ sf022 | Toucan tree ↔ Hyena | 608 ↔ 611 (both N) | Breaks up the hornbill and toucan pair |

## Files (tools/critic-land-18/)
- `blind-1..3.png`: the numbers-only sheets
- `boards/b01..b39.png` + `meta.json`: the 39 boards at CSS size
- `zoom-a.png`: 601 605 604 / 614 588 611
- `zoom-b.png`: 578 581 589 / 597 612 609
- `map-join-375.png`, `map-mid-375.png`, `map-top-375.png`, `map-w8-375.png` (World 8 for the tint comparison), `phone-4.png` (those four side by side at CSS size), `map-1280.png`
- `win-375.png`, `fail-375.png`, `fail2-375.png`, `back-map-375.png`
- `func.json`
