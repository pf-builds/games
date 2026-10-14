# Critic: Zen World 14 Farm Friends (v7 lane D), 2026-10-14

Build: the exported snapshot of commit a1c84d3 (`scratchpad/w14-critic/sappers-path/`). The snapshot has no `.claude/`, so I served it from the snapshot dir on 127.0.0.1:8557 with the threaded `/Users/peter/Documents/Claude/.claude/serve.py`. No file failed to load. The server was killed afterwards. Shots and data are in `tools/critic-land-17/` (untracked). The harness is the World 13 critic's, retargeted: `boards.mjs`, `func.mjs`, `back.mjs`, `blind.py`, `zoom.py` in the session scratchpad `w14run/`. In that harness, Worlds 11-13 are set to their current sizes (31, 33 and 35).

Numbering: records 685-727, Zen 535-577, ids z14-1..z14-43 (Zen = 534 + N). **Every fix is keyed by board id (ffNNN)**. Same-count swaps are preferred, so no later world renumbers.

## selfTest
`tools/selftest-lands.mjs` on the snapshot (page wait raised to 60 s): **375x812@3 916 passed / 0 failed; 1280x720 918 / 0; 0 console messages.** I trust it for records, numbering, the sheets and their tint, the banner, the fog, credits order, no mystery blocks and the win line.

My own runs logged **0 console messages and 0 page errors**. They covered all 43 boards at 1x; the opener won with real taps; a loss, Retry, a second loss and Back to map; the in-play map button; and the map at 375@3 and 1280.

## Counts
BLOCKER 0 · MAJOR 2 · MINOR 6

## How the boards were judged
Each board was loaded in play at 375x812 (DPR 1, touch) and captured as `#board` at CSS size (336x360, 8 px a cell). I judged from the numbers-only sheets (`blind-1..4.png`) and wrote each blind read down **before** printing titles, ids or prompts. Then I checked against lane C's prompts and the 1.6x nearest-neighbour zoom (`zoom-a.png`). I had not seen these pictures before, and I opened the contact sheet only afterwards. The in-game order matches LICENSES.md row for row.

Same bar as Worlds 10-13. Kind: **S** = the prompt sets a real setting or an action (a barn, a meadow, a pond, a field, sky, a sunrise). **P** = a single subject on "a plain background".

**Result: 36 read, 6 weak, 1 mud (84%).**

| Zen | Level | Id | Title | Kind | Tag | Rating | Blind read, then reason |
|---|---|---|---|---|---|---|---|
| 535 | 685 | ff001 | Cow | P | N | reads | A black and white cow face with a pink muzzle and a bell. Red-pink inner ears (natural) |
| 536 | 686 | ff101 | Pig mud puddle | S | N | **weak** (builder flag) | Blind: "a farm landscape with a stream; a small pink shape in brown mud". The setting reads; the pig is too small to find |
| 537 | 687 | ff102 | Hen on a fence | S | E | reads (borderline) (builder flag) | A brown hen on a wooden fence over a green field. Small, but named blind |
| 538 | 688 | ff003 | Sheep | P | N | reads, **but see M1** | A black-faced sheep in white fleece on orange. **Red eyes** |
| 539 | 689 | ff103 | Cow in a meadow | S | N | reads | A cow on grass with a red barn and a windmill behind |
| 540 | 690 | ff007b | Duck | P | E | reads | A white duck with an orange beak on teal |
| 541 | 691 | ff038b | Goat on a roof | S | N | reads (borderline) | A white goat standing on a red barn roof. The action shows |
| 542 | 692 | ff008 | Horse | P | N | reads | A chestnut horse head with a white blaze. Excellent |
| 543 | 693 | ff107 | Horse in a field | S | E | reads | A brown horse galloping through golden wheat |
| 544 | 694 | ff201 | Cow by the barn | S | N | **weak, and see M1** (builder flag) | Blind: "a cow head, ringed, with red around it". Barn-red patches wrap the head; the ring runs through the face (m1) |
| 545 | 695 | ff009 | Donkey | P | N | reads | A grey donkey head on orange. Excellent |
| 546 | 696 | ff011b | Bunny | P | H | reads | A lop-eared bunny on a pink disc |
| 547 | 697 | ff032b | Hen on her nest | P | E | reads (borderline) (builder flag) | A white hen, ringed, on straw yellow. No eggs show, but the hen reads |
| 548 | 698 | ff202 | Sheep in a meadow | S | N | reads | A big white lamb face over green hills |
| 549 | 699 | ff012 | Farm dog | P | N | reads | A black and white puppy, ringed |
| 550 | 700 | ff111 | Piglets nap | S | E | reads | A pink pig asleep in straw against a red wall, ringed. The "two" piglets read as one; a ring stub sits in the straw (m1) |
| 551 | 701 | ff013 | Barn cat | P | N | reads | An orange tabby lying down, ringed |
| 552 | 702 | ff014 | Rooster | P | E | **weak** | Blind: "a pale hen in a golden disc". The rooster and its crowing are lost: a cream bird in a cream circle |
| 553 | 703 | ff118 | Horse and foal | S | N | reads | A mare and foal on grass with a barn behind. Good scene |
| 554 | 704 | ff017 | Calf | P | H | reads (borderline) | An orange bovine head on green. Reads as a calf or an ox |
| 555 | 705 | ff210 | Fluffy alpaca | S | E | **weak** (builder flag) | Blind: "a white column against a green bush". The head and neck only; reads as a llama at best |
| 556 | 706 | ff212 | Barn owl at dusk | S | N | reads (borderline) | A round tan owl with big eyes on a pink dusk sky with a barn, ringed |
| 557 | 707 | ff018b | Lamb | P | E | reads (borderline) | A white lamb on lilac. Pale on pale, but the legs and ears carry it |
| 558 | 708 | ff019 | Pony | P | N | **weak** | Blind: "a black and white spotted animal, a pony or a dalmatian". The pony shape is lost in the spots |
| 559 | 709 | ff211 | Calf in the meadow | S | E | reads | An orange calf in a green meadow |
| 560 | 710 | ff205 | Duck by the pond | S | N | **mud** | Blind: "a white path between two blue pools, orange specks". The duck is a white vertical shape that reads as a path or a waterfall. Nameable from the title only |
| 561 | 711 | ff123 | Alpaca on a hill | S | E | reads | A white alpaca, full body, on green hills, ringed. The alpaca 555 should have been |
| 562 | 712 | ff020b | Mule | P | N | reads (borderline) | A brown mule head with a hat brim, ringed |
| 563 | 713 | ff206 | Rooster at sunrise | S | H | reads, **see m2** (builder flag) | A big red rooster on a peach sunrise with a farmhouse. A maroon mass low right |
| 564 | 714 | ff126 | Turkey strut | S | E | reads (borderline) (builder flag) | A brown turkey with its fan by a fence |
| 565 | 715 | ff127 | Sheep shearing | S | N | reads (borderline) | A sheep in a barn doorway, the front half bare (pink), ringed |
| 566 | 716 | ff024b | Ox | P | E | reads | A shaggy orange ox with horns on blue |
| 567 | 717 | ff025 | Barn owl | P | N | reads | An owl with a heart-shaped face on navy. Excellent |
| 568 | 718 | ff209 | Farm cat | S | E | reads | An orange cat in front of a red barn door. Good |
| 569 | 719 | ff207 | Donkey in the wheat | S | N | reads | A grey donkey in golden wheat |
| 570 | 720 | ff106 | Duck pond | S | H | reads (borderline) | A white duck on a round pond, trees behind. The pond is green, not blue |
| 571 | 721 | ff026b | Mouse | P | E | reads | A grey mouse with a wheat ear. Excellent |
| 572 | 722 | ff034b | Woolly sheep | S | N | reads | A sheep by a fence under a blue sky |
| 573 | 723 | ff027 | Tractor | P | E | reads | A red tractor. Excellent |
| 574 | 724 | ff049b | Calf and dog | S | N | **weak** | Blind: "a white and orange cat and a brown dog, nose to nose". The calf reads as a cat; one ring wraps both |
| 575 | 725 | ff028b | Barn | P | E | reads | A red barn with white trim. Excellent |
| 576 | 726 | ff029b | Scarecrow | P | N | reads | A friendly scarecrow in a straw hat |
| 577 | 727 | ff030b | Sunflower | P | H | reads | A big ringed sunflower. A clean closer |

### Portrait vs scene read rate

| | Boards | Read | Weak | Mud | Read rate |
|---|---:|---:|---:|---:|---:|
| Portraits (P) | 21 | 19 | 2 | 0 | **90%** |
| Scenes, real backgrounds (S) | 22 | 17 | 4 | 1 | **77%** |
| World 14 total | 43 | 36 | 6 | 1 | 84% |

**Peter's question: do the real-background scenes read? Yes, mostly.** 17 of the 22 read, and that's the best scene rate in v7 (Worlds 10-13: 67%, 44%, 43%, 75%). The ones that work share three things:
- a big hero (539, 543, 553, 568, 569)
- mid-tone backgrounds (green grass, golden wheat, a red barn) that stay darker or more saturated than the hero
- a single animal per board

The 5 that fail lose the hero in one of three ways:
- **too small:** 536 (the pig)
- **white on a white or pale shape:** 560 (the duck reads as a path), 555 (a neck against a bush)
- **tangled with the background:** 544 (the barn red wraps the cow), 574 (two animals in one ring)

So the real-background push pays off here. The rule is "big, mid-tone hero, and only one of them".

### Background types (information for Peter)
- **Band edits: 0.** This is the first v7 world without lane C's two-band edit.
- **Real backgrounds: 22.** Barns, meadows, hills, wheat, ponds, fences, a sunrise and a dusk sky: 536 537 539 541 543 544 548 550 553 555 556 559 560 561 563 564 565 568 569 570 572 574.
- **Flat colour: 21.** 535 538 540 542 545 546 (with a pink disc) 547 549 551 552 (with a gold disc) 554 557 558 562 566 567 571 573 575 576 577.

## MAJORS

**M1. Two boards read as injury or a red-eyed animal (kid and portal safety).**
- **544 ff201 Cow by the barn (builder flag).** Repro: `?debug=1`, `SP.load("z14-10")` at 375x812. See `boards/b10.png` and `zoom-a.png` (top left).
  - The red barn shows only as bright red patches in the gaps round the cow's head: at the left cheek, under the jaw and down the right side of the neck.
  - At 1x a black and white cow head with red splashes round its jaw and neck reads as a hurt animal.
  - The ring also cuts down through the face (m1).
  - Fix: a **same-count swap** for a spare, or recolour the barn red in `edits.json` to a brown or grey barn tone, add ff201 to `moatSkip`, and re-bake 694. The swap is simpler, since the board is weak anyway.
- **538 ff003 Sheep.** Repro: `SP.load("z14-4")`. See `boards/b04.png` and `zoom-a.png` (top right).
  - Each eye is a dark socket with 2-3 bright red cells, and there's a red cell at the nostril.
  - It reads as a sheep with red, sore eyes. That's the same class as World 10's hf012b, which went on the ship list.
  - Fix: recolour the red eye cells to black via `edits.json` and re-bake 688. No renumbering.

**M2. 560 ff205 Duck by the pond (Normal) is mud.** Repro: `SP.load("z14-26")`. See `boards/b26.png`.
- Blind, it read as "a white path between two blue pools". The duck's body is a tall white shape running from the sky to the bottom edge, with an orange beak smudge. Nothing makes it a duck.
- Same call as World 11's ck018b and World 12's ct021: **swap it, same count.** 570 ff106 Duck pond, a Hard, already covers the subject and reads.

## MINORS
- **m1. Rings.** 12 boards carry a ring: 544 547 549 550 551 556 558 561 562 565 574 577. **Two read as stray lines:**
  - **544 ff201:** the ring runs down through the cow's face (`zoom-a.png`, top left). It goes away with M1's swap. If ff201 stays, `moatSkip` it.
  - **550 ff111 Piglets nap:** a short ring stub sits in the straw at the bottom right, apart from the pig (`zoom-a.png`, bottom middle). If it bothers the art lane, `moatSkip` ff111 and re-bake 700. It's minor, and the board reads.
  - 574's ring wraps calf and dog as one blob, which adds to that board's weak read. 577's ring runs down the stem to the bottom edge, but it follows the stem, so it reads as part of the flower. **Keep it.** The rest hug their subject.
- **m2. 563 ff206 Rooster at sunrise (builder flag):** the farmhouse low right is a dark maroon mass with vertical drips, right beside a red bird (`zoom-a.png`, top middle). At 1x it reads as a dark barn silhouette, not blood. But it's the one dark red stain-like shape in the world, on a Hard. Optional: recolour the maroon to the brown of the fence in `edits.json`.
- **m3. Repeats (builder noted):**
  - horses 542, 543, 553, 562
  - orange bovines 554, 559, 566
  - sheep 538, 548, 557, 565, 572
  - two alpacas (555, 561), two owls (556, 567), two donkeys (545, 569), two roosters (552, 563), two ducks besides 560 (540, 570)
  - The refills sit side by side at 555-556, 559-560 and 568-569.

  It feels like a farm, so it's fine, but the weak boards in the list are also the duplicates (552, 555, 558, 560). Swapping those for new subjects (a goose, a beehive, a pumpkin patch, a farmer's kid, a sheepdog herding) would cut the repetition at no count cost.
- **m4. Lore wording:** "a scarecrow in the corn and sunflowers along the fence" and "a pony in the field". 576 Scarecrow and 577 Sunflower are on plain backgrounds, and 558 Pony is on plain pink. It's a nit; reword or leave it.
- **m5. The LICENSES rows point to `tools/lands/17-farm-friends/pictures/manifest.json`**, which doesn't ship (carried over from Worlds 7-13).
- **m6. Desktop carry-overs:** "Side quest 12 ... Quartermaster +1" in Next up, the empty "Secrets found" line, and 0 coins on the realm card (known, LATER.md).

## Kid and portal safety, the rest
- **No lettering on any board.**
- **Red:** apart from M1 and m2, nothing reads as blood. Checked: 535's inner ears, 539's barn, 550's red wall, 568's barn door, 573 Tractor and 575 Barn (red objects), 576 Scarecrow's cheeks, and 548's single maroon chin cell (one cell, invisible at 1x).
- **Look-alikes: none.**
  - **Shaun the Sheep:** 538 and 572 are generic black-faced sheep (Suffolk-style), with no big white cartoon eyes and no Aardman shape.
  - **Peppa Pig:** 536 and 550 are naturalistic pigs, with no side-profile hairdryer head.
  - 549's farm dog and 562's mule in a hat are generic. Nothing evokes Babe, Barnyard, Charlotte's Web or Old MacDonald branding.

## Checks that passed
- **Opener at 375@3, real taps:** "Play picture 535" opened z14-1 "535 Cow". 50 real taps gave "Picture done", "**Cow, all dug out.**", Time 0:02, Taps 50, First clear +20, coins +16, and Back to map / Retry (`win-375.png`).
- **Loss, Retry, Back to map at 375@3, real taps:** 577 Sunflower (Hard) took an 11-tap lossPlan and gave "A little stuck", HARD, "Line jammed: linked squads wait for partners buried in their columns, and Orange and Lime can't reach a block. Have another look.", with Continue 250 / Retry / Back to map (`fail-375.png`).
  - Retry (`#p-primary`) restarted z14-43 at 0 plays.
  - A second loss (`fail2-375.png`), then Back to map (`#p-secondary`), showed the map (`jr: true`) with "Picture 536" current (`back-map-375.png`).
  - The map's Play loaded 536, and the in-play map button returned to the map.
  - 0 console messages.
- **The 13→14 join (375):** 533-534 are done on World 13's snow sheet, 534 Hard. Then the banner "WORLD 14 Farm Friends" sits on the seam, with 535 current, "Picture 535" and "Play picture 535" on the green sheet (`map-join-375.png`). Snow to green is a clean, obvious change. No horizontal overflow.
- **The green tint and the pale mint road:** World 14's images are sheets 22 and 24 under `sepia(0.3) hue-rotate(48deg) saturate(1.7) brightness(1.15) contrast(1.04)`. At 375 the mint road is clearly lighter than the pasture, and its dashes and node discs read over it (`map-join-375.png`, `map-top-375.png`). At 1280 the same holds (`map-1280.png`). **Readable.** World 13's sheets keep the snow tint.
- **Top and fog:** 571-577 sit on the top sheet, 577 is the last node (577 nodes), and "More worlds on the way" sits in the fog above it (`map-top-375.png`).
- **Numbers fit their discs:** the tightest World 14 number is 536, 25.9 px in the disc's 28 (2.1 px spare), at both 375 and 1280. The closest nodes are 538-539, at 61.0 px (375) and 70.0 px (1280). Nothing overlaps.
- **1280 map:** the realm card reads "WORLD 14 OF 14 Farm Friends" with the lore ("The road rolls out to a friendly farm: cows, pigs and sheep, ducks on the pond, a goat on the roof ..."), "9/43 cleared", and 544 current with "Play picture 544" (`map-1280.png`).
- **Credits line:** it ends "... **Farm Friends: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it! Studios.**" In order, after World 13.
- **LICENSES.md:** the section "Zen World 14: Farm Friends (Land 13, levels 685-727 ...)" has its credit line and **43 rows**, 535/685 to 577/727, in game order. Each has its id and seed. **0 rows** carry "Adapted for the board", which matches 0 edits.

## Verdict: **ship after fixes**

**Blocking (the ship list):**
1. **M1 ff003 Sheep (538 / 688):** recolour the red eyes to black, then re-bake. No renumbering.
2. **M1 ff201 Cow by the barn (544 / 694):** same-count swap, or recolour the barn red round the head plus `moatSkip`, then re-bake.
3. **M2 ff205 Duck by the pond (560 / 710):** same-count swap (mud).

**Non-blocking:** swap the weak boards ff014, ff019, ff210, ff049b and ff101 for new subjects (same count); the m1 ring stub on ff111; the m2 maroon on ff206; the m4 lore wording.

### One list for lane C (all board fixes, by id)
| Priority | Id | Title | Now (Zen / level) | Fix |
|---|---|---|---|---|
| **Blocking** | ff003 | Sheep | 538 / 688 | Recolour the red eye cells to black (`edits.json`), re-bake |
| **Blocking** | ff201 | Cow by the barn | 544 / 694 | Same-count swap (or recolour the barn red + `moatSkip`, re-bake) |
| **Blocking** | ff205 | Duck by the pond | 560 / 710 | Same-count swap (mud) |
| 1 | ff014 | Rooster | 552 / 702 | Same-count swap (pale bird in a pale disc; a rooster is also 563) |
| 2 | ff019 | Pony | 558 / 708 | Same-count swap (the spots hide the pony) |
| 3 | ff210 | Fluffy alpaca | 555 / 705 | Same-count swap (neck only; 561 is the good alpaca) |
| 4 | ff049b | Calf and dog | 574 / 724 | Same-count swap (the calf reads as a cat) |
| 5 | ff101 | Pig mud puddle | 536 / 686 | Same-count swap (the pig is too small); it's the world's second board |
| ring | ff111 | Piglets nap | 550 / 700 | Optional `moatSkip` + re-bake (a ring stub in the straw) |
| optional | ff206 | Rooster at sunrise | 563 / 713 | Recolour the maroon farmhouse to brown |

Borderline but keep: ff102, ff032b, ff038b, ff017, ff212, ff018b, ff020b, ff126, ff127, ff106.

## Files (tools/critic-land-17/)
- `blind-1..4.png`: the numbers-only sheets
- `boards/b01..b43.png` + `meta.json`: the 43 boards at CSS size
- `zoom-a.png`: 544 563 538 / 576 550 577
- `map-join-375.png`, `map-top-375.png`, `map-1280.png`
- `win-375.png`, `fail-375.png`, `fail2-375.png`, `back-map-375.png`
- `phone-4.png`: join, top, win and fail at CSS size
- `func.json`
