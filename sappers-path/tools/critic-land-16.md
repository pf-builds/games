# Critic: Zen World 13 Holiday Lights (v7 lane D), 2026-10-13

Build: the exported snapshot of commit 7cabc57 (`scratchpad/w13-critic/sappers-path/`). The snapshot has no `.claude/`, so I served it from the snapshot dir on 127.0.0.1:8556 with the threaded `/Users/peter/Documents/Claude/.claude/serve.py`. No file failed to load, and the server was killed afterwards. Shots and data are in `tools/critic-land-16/` (untracked). The harness is the World 12 critic's, retargeted: `boards.mjs`, `func.mjs`, `back.mjs`, `blind.py`, `zoom.py` in the session scratchpad `w13run/`.

Numbering: records 643-668, Zen 493-518, ids z13-1..z13-26 (Zen = 492 + N). A rework is adding 9 refill boards and will move this world to 650-684, so **every fix below is keyed by board id (hlNNN)**. Zen and record numbers only locate the board in this snapshot.

## selfTest
`tools/selftest-lands.mjs` on the snapshot (page wait raised to 60 s): **375x812@3 912 passed / 0 failed; 1280x720 914 / 0; 0 console messages.** I trust it for records, numbering, the sheets and their tint, the banner, the fog, credits order, no mystery blocks and the win line.

My own runs logged **0 console messages and 0 page errors**. They covered:
- all 26 boards at 1x
- the opener won with real taps
- a loss, Retry, a second loss and Back to map
- the in-play map button
- the map at 375@3 and at 1280

## Counts
BLOCKER 0 · MAJOR 1 · MINOR 6

## How the boards were judged
Each board was loaded in play at 375x812 (DPR 1, touch) and captured as `#board` at CSS size (336x360, 8 px a cell). I judged from the numbers-only sheets (`blind-1.png`, `blind-2.png`) and wrote each blind read down **before** printing titles, ids or prompts. Then I checked them against lane C's prompts and the 1.6x nearest-neighbour zoom (`zoom-a.png`). I had not seen these pictures before this pass, and I opened the contact sheet only afterwards. The in-game order matches LICENSES.md row for row.

Same bar as Worlds 10-12. Kind: S = the prompt sets a scene or an action, P = a single subject on "a plain background".

**Result: 23 read, 3 weak, 0 mud (88%).** That's the best world of v7 so far: World 12 was 69%, World 11 84% after its fixes, World 10 78%.

| Zen | Level | Id | Title | Kind | Tag | Rating | Blind read, then reason |
|---|---|---|---|---|---|---|---|
| 493 | 643 | hl001 | Christmas tree | P | N | reads | A decorated tree with a star on navy over snow. Red specks on the snow under it (m2) |
| 494 | 644 | hl002b | Snowman | P | N | reads | A snowman in a Santa hat and a red scarf, ringed. The ring's stub runs up to the top edge (m1) |
| 495 | 645 | hl003 | Reindeer | P | E | reads | A brown reindeer with big antlers and a green scarf on a pink disc. Dark nose |
| 496 | 646 | hl038 | Snow angel | S | N | reads (borderline) | A child in a red jumper and pink hat, arms and legs spread on white. It reads as a kid in the snow; the angel imprint is implied by the pose only |
| 497 | 647 | hl004 | Present | P | N | reads | A red box with a gold bow on lime. Excellent |
| 498 | 648 | hl005 | Penguin | P | E | reads | A penguin in a red hat. Excellent |
| 499 | 649 | hl006 | Gingerbread | P | N | reads | A gingerbread man, ringed. Excellent |
| 500 | 650 | hl008 | Snowflake | P | N | reads | A white snowflake on blue |
| 501 | 651 | hl007 | Candy cane | P | H | reads | A red and white cane on green |
| 502 | 652 | hl009 | Mitten | P | E | **weak** (builder flag) | Blind: "a red heart, or a mitten". The thumb sits where a heart's lobe would; the cuff is a faint shadow |
| 503 | 653 | hl042b | Snowman building | S | N | **weak** (builder flag) | Blind: "three figures merged in a ring". The penguins and the snowman share one cream mass and one ring |
| 504 | 654 | hl011 | Polar bear cub | P | E | reads | A white cub with a pink scarf on cyan |
| 505 | 655 | hl012b | Bauble | P | N | reads | A red bauble on yellow |
| 506 | 656 | hl013b | Wreath | P | H | reads | A green wreath with a red bow, ringed. Good |
| 507 | 657 | hl045b | Tree topper | S | E | reads | An orange cat reaching a star up to a small tree. The action shows |
| 508 | 658 | hl014 | Bell | P | N | reads | A gold bell with holly on red, ringed |
| 509 | 659 | hl015 | Star | P | E | reads | A smiling gold star in a night sky |
| 510 | 660 | hl016 | Santa hat cat | P | N | **weak** | Blind: "a brown puppy or bear in a Santa hat". The hat reads; the cat doesn't |
| 511 | 661 | hl017b | Stocking | P | E | reads | A red stocking with white trim |
| 512 | 662 | hl050 | Winter cabin | S | N | reads (borderline) (builder flag) | A brown building with a lit yellow window, snow on the roof, snowy trees. The brown mass is heavy, but cabin-in-snow comes through |
| 513 | 663 | hl022 | Fox in snow | P | H | reads | A red fox trotting on snow. Good |
| 514 | 664 | hl023 | Holly | P | E | reads | Holly leaves with red berries, ringed |
| 515 | 665 | hl024 | Snow globe | P | N | reads | A globe on a stand on purple. The little house is a tan blob, but the globe is plain |
| 516 | 666 | hl027 | Nutcracker | P | E | reads (borderline) | A nutcracker soldier with a black shako, a moustache and a red coat, ringed. Cropped at the left edge |
| 517 | 667 | hl029 | Sled | P | N | reads (borderline) | A red sled on snow, ringed |
| 518 | 668 | hl030 | Clock midnight | P | H | reads (borderline) (builder flag) | Blind: "an alarm clock with a blue face, a white jumble at the bottom". The clock reads; midnight doesn't (M1) |

### Portrait vs scene read rate

| | Boards | Read | Weak | Mud | Read rate |
|---|---:|---:|---:|---:|---:|
| Portraits (P) | 22 | 20 | 2 | 0 | **91%** |
| Scenes (S) | 4 | 3 | 1 | 0 | **75%** |
| World 13 total | 26 | 23 | 3 | 0 | 88% |

- Portraits are strong. The Christmas icons (present, bauble, candy cane, stocking, bell, wreath, holly, snowflake) are bold shapes in red, green and gold, and they read at a glance.
- The one weak scene (503) fails the usual way: several characters merge into one mass. 507 Tree topper is the best action scene in v7 so far.
- Hards: 501, 506 and 513 read cleanly. **518, the closer, is borderline** (M1).

### Plain-band backgrounds (information for Peter, not a finding)
- **12 of 26 use lane C's edit** (a deep blue top band, the original plain colour, a snow-white ground band): 493 498 499 500 501 502 509 511 513 514 517 518. They match the 12 "Adapted for the board" rows exactly. On a winter world the white ground band reads as snow, which helps.
- **11 sit on one flat colour:** 494 (pale blue), 495 (white with a pink disc), 497 (lime), 504 (cyan), 505 (yellow), 506 (cream), 507 (purple with a grass patch), 508 (red), 510 (green), 515 (purple), 516 (green).
- **3 have a real background:** 496 (snow with a grey slope), 503 (sky and snow), 512 (a snowy night with trees). All three are scenes. The refill boards being added will change this count.

## MAJOR

**M1. 518 hl030 Clock midnight (the closing Hard) is a jumble in its lower third (builder flag).** Repro: `?debug=1`, `SP.load("z13-26")` at 375x812. See `boards/b26.png` and `zoom-a.png` (top right).
- The alarm clock reads: orange bells, an orange rim, a navy face. But the snow-white ground band cuts across the bottom of the face, so the lower third breaks into white and blue specks.
- The hands are a few brown cells pointing nowhere near twelve. The confetti is 6-8 scattered orange and brown cells that read as noise.
- At 1x it's "a clock with a mess at the bottom", not "midnight". It's the last board of the world.
- **Fix, in order of cost:**
  1. In `edits.json`, keep the face navy (end the ground band below the clock, or skip the band split on this picture) and re-bake 668.
  2. Or swap the closer for a Hard that reads cleanly. 513 Fox in snow and 506 Wreath are both Hard already.
- Not blocking: the subject reads. But a world should end on its best board, and this is the one visible flaw in an otherwise strong world.

## MINORS
- **m1. Rings.** 8 boards carry a ring: 494 499 503 506 508 514 516 517 (from zen.json's feats). **One reads as a stray line:** on **494 hl002b Snowman**, the ring runs from the hat straight up to the board's top edge as a two-cell-wide strip (`zoom-a.png`, top middle). Above the hat it's a blue line to nowhere. If hl002b stays as is: `moatSkip` hl002b, `--drop-moat`, and re-bake 644. 503's ring wraps the three figures as one blob, which adds to that board's weak read. The rest hug their subject: 499, 506, 508, 514, 516 (along the cropped left side), 517. **Keep those.**
- **m2. 493 hl001 Christmas tree (the opener):** about 8 single red cells on the white snow under the lowest branches, plus a red pot at the trunk (`zoom-a.png`, top left).
  - At 1x they read as baubles on the branch tips and a pot, not blood. The builder flagged it too.
  - But red drops on white snow on the very first board is the one place a parent might look twice.
  - Recommended: recolour the loose red cells below the branch line to gold (the bauble colour) via `edits.json`, and keep the pot.
- **m3. 494 hl002b Snowman's eyes** are two pink-red dashes (closed smiling eyes in a rosy tone). They read as happy closed eyes at 1x, so they're fine. Noted only because red eyes caught World 10's hf012b. No action.
- **m4. The snow road.** White road, grey dashes, pale blue-white ground. At 375 it **is readable**: the grey dashes and the node discs carry it, and the road's blue-grey edge shadow shows it on the darker snow patches (`map-join-375.png`, `map-top-375.png`). It's the lowest road contrast in v7, though, and on the brightest snow patches the edge disappears for a short run. No action unless playtesters lose the path.
- **m5. The top sheet holds only 517-518**, then a long empty road into the fog. It's the same pattern as World 11's lone 460, cosmetic and likely to change with the refill. Also: the LICENSES rows point to `tools/lands/16-holiday-lights/pictures/manifest.json`, which doesn't ship (carried over from Worlds 7-12).
- **m6. Desktop carry-overs:** "Side quest 12 ... Quartermaster +1" in Next up, the empty "Secrets found" line, and 0 coins on the realm card (known, LATER.md).

## Kid and portal safety, the rest
- **No lettering on any board.** 509's star and 518's clock have no digits.
- **Red:** nothing reads as blood. I checked:
  - 493 (m2) and 494's eyes (m3)
  - 516 Nutcracker: its open mouth shows a row of teeth over dark red. That's normal nutcracker design; at 1x it reads as a grin.
  - 513 (a red fox on snow, with no stains)
  - 505, 508, 511 and 501 (red objects)
  - 496's red jumper
- **Look-alikes: none.**
  - **Rudolph:** 495's reindeer has a dark brown nose and a green scarf, with no red nose and no glow.
  - **Frosty:** 494's snowman wears a red Santa hat and a scarf, with no black top hat, pipe or button nose.
  - **Olaf:** no twig hair, no buck tooth, no separate head on a body, and the snowman stands in a ring, not on stick legs.
  - **The Grinch:** nothing green-furred or grinning.
  - 516's nutcracker is the generic toy (black shako, red coat), not a film design.
  - 504's polar bear and 498's penguin are generic.

## Checks that passed
- **Opener at 375@3, real taps:** "Play picture 493" opened z13-1 "493 Christmas tree". 50 real taps gave "Picture done", "**Christmas tree, all dug out.**", First clear, and Back to map / Retry (`win-375.png`).
- **Loss, Retry, Back to map at 375@3, real taps:**
  - 518 Clock midnight (Hard) took a 25-tap lossPlan and gave "A little stuck", HARD, "Line jammed: Brown and Navy can't reach a block. Have another look.", with Continue 250 / Retry / Back to map (`fail-375.png`).
  - Retry (`#p-primary`) restarted z13-26 at 0 plays.
  - A second loss (`fail2-375.png`), then Back to map (`#p-secondary`), showed the map (`jr: true`) with "Picture 494" current (`back-map-375.png`).
  - The map's Play loaded 494, and the in-play map button returned to the map.
  - 0 console messages.
- **The 12→13 join (375):** 491-492 are done on World 12's brass sheet, 492 Hard. Then the banner "WORLD 13 Holiday Lights" sits on the seam, with 493 current, "Picture 493" and "Play picture 493" on the snow sheet (`map-join-375.png`). Brass to snow is a sharp, clean change. No horizontal overflow.
- **Top and fog:** 514-518 are in view, 518 is the last node (518 nodes), and "More worlds on the way" sits in the fog (`map-top-375.png`).
- **Numbers fit their discs:** the tightest World 13 number is 25.9 px in the disc's 28 (2.1 px spare): 496 at 375, 493 at 1280. The closest nodes are 496-497, at 64.6 px (375) and 74.1 px (1280). Nothing overlaps.
- **Snow tint:** World 13's images are sheets 19 and 20 under `grayscale(1) brightness(1.75) contrast(1.05) sepia(0.3) hue-rotate(165deg) saturate(2)`. They read as a snowy wood, pale blue-white with frosted trees. World 12's sheets 17 and 18 keep the brass tint. Same at 375 and 1280.
- **1280 map:** the realm card reads "WORLD 13 OF 13 Holiday Lights" with the lore ("The road winds into a snowy wood lit up for the winter holidays: ... and a clock ticking down to a new year that everyone can join."), "9/26 cleared", and 502 current with "Play picture 502", Easy (`map-1280.png`). The road and the dashed trail read well at desktop size. Everything the lore names is on a board.
- **Credits line:** it ends "... Clockwork Town: original pictures ... **Holiday Lights: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it! Studios.**" In order, after World 12.
- **LICENSES.md:** the section "Zen World 13: Holiday Lights (Land 12, levels 643-668 ...)" has its credit line and **26 rows**, 493/643 to 518/668, in game order. Each has its id and seed, and exactly **12** carry the "Adapted for the board" note.

## Verdict: **ship**

**Blocking:** none. No mud, no blood read, no lettering, no look-alikes, and every functional check passed.

**Non-blocking (recommended, batched into the refill rework so the renumbering happens once):**
- M1: clean up hl030 Clock midnight's lower face, or close the world on a Hard that reads.
- The 3 weak boards: hl042b, hl009, hl016.
- m1: the hl002b ring stub. m2: the hl001 red specks.

### One list for lane C (all board fixes, by id)
| Priority | Id | Title | Now (Zen / level) | Fix |
|---|---|---|---|---|
| 1 | hl030 | Clock midnight | 518 / 668 | Keep the face navy (no ground band across it) and re-bake, or swap the closer (M1) |
| 2 | hl042b | Snowman building | 503 / 653 | Drop or swap (the figures merge; builder flag) |
| 3 | hl009 | Mitten | 502 / 652 | Drop or swap (reads as a heart; builder flag) |
| 4 | hl016 | Santa hat cat | 510 / 660 | Drop or swap (the cat reads as a puppy or bear) |
| ring | hl002b | Snowman | 494 / 644 | `moatSkip` + re-bake (the ring stub runs to the top edge) |
| optional | hl001 | Christmas tree | 493 / 643 | Recolour the loose red cells on the snow to gold via `edits.json` |

Borderline but keep: hl050 Winter cabin, hl038 Snow angel, hl027 Nutcracker, hl029 Sled.

## Files (tools/critic-land-16/)
- `blind-1.png`, `blind-2.png`: the numbers-only sheets
- `boards/b01..b26.png` + `meta.json`: the 26 boards at CSS size
- `zoom-a.png`: 493 494 518 / 503 516 495
- `map-join-375.png`, `map-top-375.png`, `map-1280.png`
- `win-375.png`, `fail-375.png`, `fail2-375.png`, `back-map-375.png`
- `phone-4.png`: join, top, back-to-map and fail at CSS size
- `func.json`
