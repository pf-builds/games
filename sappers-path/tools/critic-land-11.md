# Critic: Zen World 9 Puppy Park (v7 lane D), 2026-10-13

Build: the exported snapshot of commit b787301 (`scratchpad/w9-critic/sappers-path/`), served from the snapshot dir on 127.0.0.1:8542 (Playwright, chromium). The server was killed afterwards. Shots and data are in `tools/critic-land-11/` (untracked, not committed). The harness is the critic's own (`run.mjs` in the session scratchpad).

**Numbering.** In the snapshot, Puppy Park is records 501-550 and Zen 351-400. The live worktree is being renumbered (World 8 shrinks), so the same boards will be **493-542 / Zen 343-392**. That makes new = snapshot - 8. Everything below uses snapshot numbers plus the board id (ppNNN). The id is the stable key for the art lane.

Setup: `?debug=1` with `SP.zenTo` (Worlds 1-8 cleared), `SP.load("z9-N")`, `SP.winOrder` and `SP.lossPlan`. Card taps in play were real touchscreen taps on `#tray button.card[data-col]`, with `SP.settle` between taps.

## selfTest
`tools/selftest-lands.mjs` on the snapshot: **375x812@3 896 passed / 0 failed; 1280x720 898 / 0; 0 console messages.** I trust it for records, numbering, caps, shades, moats, the tint on every sheet image, the banner, the fog, credits order and win-line wiring.

Note on serving: on a bare `python3 -m http.server` (port 8541), the same selfTest got 8 `net::ERR_CONNECTION_RESET` and failed 4 checks: the Zen Worlds 6-9 play, where the world files never arrived. On `.claude/serve.py` it was clean. That's the server, not the game, but anyone re-running this brief on `http.server` will see those 4 false FAILs.

My own runs (50 boards at 1x, the win, the loss, retry and map at 375@3, map at 1280): **0 console messages, 0 page errors.**

## Counts
BLOCKER 0 · MAJOR 3 · MINOR 6

## How the boards were judged
Each board was loaded in play at 375x812 and captured as the `#board` element at its CSS size (336x360, 8 px a cell for 42x42). I judged from sheets showing only the Zen number (`blind-1.png` .. `blind-4.png`).

Caveat: the title list was printed in my console before I opened the sheets, so this was "numbers-only sheets" rather than fully blind. I rated by what the shape gives without the word, and I checked each doubtful board against lane C's prompt afterwards (`prompts.json`).

The bar is the one in the brief. A portrait must read as "a dog", ideally with the breed. A scene must also show its scene.

**Result: 39 read, 11 weak, 0 mud.** That's better than World 7's first round (38 / 9 / 3) with the same model.

| Zen (new) | Level (new) | Id | Title | Kind | Tag | Rating | Reason |
|---|---|---|---|---|---|---|---|
| 351 (343) | 501 (493) | pp001 | Golden smile | P | N | reads | A golden retriever, tongue out, on blue. A strong opener |
| 352 (344) | 502 (494) | pp002 | Corgi grin | P | N | reads | A corgi head and bib. The ring hugs it. The nose is a teal blob (odd but harmless) |
| 353 (345) | 503 (495) | pp003 | Pug in a party hat | P | E | reads | A pug with a pink cone hat |
| 354 (346) | 504 (496) | pp069 | Bath time | S | N | reads (borderline) | A blue clawfoot tub with a brown-and-white dog head. The dog is small but there |
| 355 (347) | 505 (497) | pp004 | Dachshund bandana | P | N | reads | A brown floppy-eared dog in a yellow bandana (the breed needs the title) |
| 356 (348) | 506 (498) | pp005 | Beagle ears | P | E | reads | A beagle face on orange |
| 357 (349) | 507 (499) | pp006 | Spotty | P | N | reads | A dalmatian with a green collar. The ring hugs it |
| 358 (350) | 508 (500) | pp070 | Dog house | S | N | reads | A yellow kennel on grass with a dark dog in the door |
| 359 (351) | 509 (501) | pp007 | Husky eyes | P | E | reads | A husky face. The ring hugs it |
| 360 (352) | 510 (502) | pp009 | Bulldog frown | P | N | reads | A bulldog face on yellow |
| 361 (353) | 511 (503) | pp010 | Shiba smile | P | N | reads (borderline) | An orange-and-cream pointy-eared animal. A kid may say "a fox" |
| 362 (354) | 512 (504) | pp073 | Big bone | S | H | **weak** | A bulldog's open mouth in a garden. The bone is lost (white on white), the pose is confused, and the ring wanders (M2) |
| 363 (355) | 513 (505) | pp011 | Chihuahua ears | P | E | reads | A chihuahua with big ears and a pink bib |
| 364 (356) | 514 (506) | pp013 | Border collie | P | N | reads (borderline) | A black-and-white dog, cropped and tilted. The ears and the coat carry it |
| 365 (357) | 515 (507) | pp014 | Saint Bernard | P | N | reads | A big brown-and-white dog face |
| 366 (358) | 516 (508) | pp075 | Skateboard | S | E | reads (borderline) | An orange bulldog lying on a green board. The board reads more as a log than a skateboard |
| 367 (359) | 517 (509) | pp015 | Schnauzer beard | P | N | reads | A schnauzer with a beard and eyebrows on red. Excellent |
| 368 (360) | 518 (510) | pp016 | Basset droop | P | N | reads | Long droopy ears. Excellent |
| 369 (361) | 519 (511) | pp018 | Boxer | P | E | reads | A boxer face and chest |
| 370 (362) | 520 (512) | pp078 | Car ride | S | N | reads (borderline) | A yellow dog with its tongue out in a red car's window. The ring traces the window frame (fine) |
| 371 (363) | 521 (513) | pp019 | Shaggy sheepdog | P | N | reads | A grey-and-white shaggy face |
| 372 (364) | 522 (514) | pp031 | Chef pup | P | H | reads, **but see M1** | A beagle in a white chef's hat. A maroon smear at the mouth and paws reads as blood |
| 373 (365) | 523 (515) | pp033 | Pirate pup | P | E | reads (borderline) | A black-and-white dog in a dark tricorn with a white skull. The hat is dark on dark |
| 374 (366) | 524 (516) | pp080 | Snowman pal | S | N | **weak** | The snowman with a red scarf reads. The husky pup is grey and black specks, and the ring cuts across the sky (M2) |
| 375 (367) | 525 (517) | pp036 | Big yawn | P | E | reads | A husky with an open mouth. The ring hugs it. It's the second husky (m3) |
| 376 (368) | 526 (518) | pp037 | Head tilt | P | N | **weak** | Big orange ears over a white body. The face is an orange-brown smear with no eyes or nose |
| 377 (369) | 527 (519) | pp038 | Surprised pug | P | E | reads | A pug with big eyes |
| 378 (370) | 528 (520) | pp084 | Sunflower field | S | N | reads (borderline) | Sunflowers read strongly. The small corgi among them is just visible |
| 379 (371) | 529 (521) | pp040 | Flower crown | P | H | **weak** | A standing yellow figure with a pink top. The poodle's face is lost, so it could be a teddy or a doll |
| 380 (372) | 530 (522) | pp041 | Bow tie | P | E | reads | A black French bulldog with a red bow tie. Excellent |
| 381 (373) | 531 (523) | pp042 | Superhero | P | N | **weak** | A brown dog face with a dark block over the muzzle. No cape. The mask reads as a muzzle or a smudge |
| 382 (374) | 532 (524) | pp085 | Picnic thief | S | E | **weak** | Orange-and-white shapes on a red blanket on grass. You can't find the dog's head, and the sandwich is a yellow wedge |
| 383 (375) | 533 (525) | pp044 | Wizard pup | P | N | reads | A grey terrier in a blue starry hat |
| 384 (376) | 534 (526) | pp045 | Cowboy | P | E | reads | A bulldog in a cowboy hat |
| 385 (377) | 535 (527) | pp086 | Umbrella | S | N | reads | A pug in a yellow raincoat under an orange umbrella |
| 386 (378) | 536 (528) | pp017 | Frenchie bat ears | P | H | reads (borderline) | A cream face with big ears and a wide maroon mouth. The ring hugs it |
| 387 (379) | 537 (529) | pp048 | Bubble bath | P | E | **weak** | A small orange head over a big cream block. It reads as a fox in a bucket, and the bubbles are specks |
| 388 (380) | 538 (530) | pp088 | Agility jump | S | N | reads | A collie leaping a red-and-white hurdle. Excellent |
| 389 (381) | 539 (531) | pp051 | Mud face | P | E | reads, **but see M1** | A white westie, but with dark-red eyes and a dark-red streak from the nose. It reads as a bloody muzzle, not mud |
| 390 (382) | 540 (532) | pp052 | Snow nose | P | N | reads | A husky face (the third, m3). There's no snow on the board |
| 391 (383) | 541 (533) | pp091 | Basket of pups | S | E | **weak** | An orange wicker basket reads. The pups in it are a brown-and-cream jumble |
| 392 (384) | 542 (534) | pp054 | Dog with a ball | P | N | reads | A golden retriever with a red ball. The ring hugs it |
| 393 (385) | 543 (535) | pp058 | Poodle glasses | P | H | reads | A black poodle with round glasses on yellow |
| 394 (386) | 544 (536) | pp097 | Hammock | S | E | **weak** | Two palms and a striped hammock read. The bulldog in it is lost in the stripes |
| 395 (387) | 545 (537) | pp059 | Bernese pup | P | N | reads (borderline) | A tricolour face, turned. The ring hugs it |
| 396 (388) | 546 (538) | pp061 | Greyhound sweater | P | E | reads (borderline) | A thin grey head over a striped sweater |
| 397 (389) | 547 (539) | pp099 | Ice cream | S | N | **weak** | Black-and-white spots with a pink blob. The cone and the licking don't read |
| 398 (390) | 548 (540) | pp064 | Puppy wink | P | E | reads | An orange shiba face winking. It's the second shiba (m3) |
| 399 (391) | 549 (541) | pp065 | Boxer kiss | P | N | reads | A boxer with a big pink tongue |
| 400 (392) | 550 (542) | pp104 | Teddy | S | H | **weak (borderline mud)** | The world's last board. The pup and the brown bear fuse into one tan blob with a small face. A kid says "a bear", not "a puppy hugging a bear" |

### Is the close-portrait rule working? (evidence for Peter)
Yes, clearly.

| | Boards | Read | Weak | Mud | Read rate |
|---|---:|---:|---:|---:|---:|
| Close portraits (P) | 36 | 32 | 4 | 0 | **89%** |
| Simple scenes (S) | 14 | 7 | 7 | 0 | **50%** |
| World 9 total | 50 | 39 | 11 | 0 | 78% |

- **Every scene that fails has the dog small or tangled with an object:** a bone, a snowman, a basket, a hammock, a cone, a teddy, a picnic. The scenes that pass have one clear silhouette on a flat ground: the hurdle jump, the umbrella, the kennel and the tub.
- **The 4 weak portraits fail on the face, not the framing:** 376 smears it, 381's mask hides it, 379's crown takes over the head, and 387 makes the head small. Face-forward, high-contrast breeds read best: the schnauzer, the basset, the Frenchie with a bow tie, the poodle with glasses.
- **The rule for the next lands:** keep portraits, and allow a scene only when the whole dog is the biggest single shape.

## MAJORS

**M1. Two boards read as blood. A kid or a portal reviewer would bounce on these.** Repro: `?debug=1`, `SP.load("z9-22")` and `SP.load("z9-39")` at 375x812. See `zoom-372-389-362-374.png`, top row.
- **372 (new 364) pp031 Chef pup (Hard):** a dark maroon smear across the mouth, and maroon at the paws on the bottom rows. The prompt has nothing red in it ("a beagle wearing a white chef hat"), so it's a FLUX artefact. On a red ground, the beagle looks like it has a bloody mouth.
- **389 (new 381) pp051 Mud face (Easy):** a white westie with dark-red eyes and a dark-red streak running down from the nose into the muzzle. The prompt asks for "a muddy brown face", but the board's darkest muzzle colour is a blood red. The board reads as a red-eyed dog with blood on its mouth.

Fix: recolour the maroon swatch on each board (372 to tongue pink or the beagle's brown; 389 to dark mud brown, eyes to near-black), via `edits.json`, then re-bake those 2 slots. Or swap them for spares: all 12 spares are portraits, for example pp066 Lab in a scarf and pp028 King corgi, which add breeds the world doesn't have yet.

I grade it MAJOR rather than BLOCKER because play works and the boards are readable. But I'd put it on the ship list: it's the one thing here a reviewer can reject on sight.

**M2. Two rings read as stray lines.** Repro: `SP.load("z9-12")` and `SP.load("z9-24")` at 375 (`zoom-372-389-362-374.png`, bottom row).
- **362 (new 354) pp073 Big bone (Hard):** the water ring runs as a straight line under the treetops to the left edge, then out along the left side. It loops round the dog's legs, cuts the garden into pieces, and adds to a board that's already weak.
- **374 (new 366) pp080 Snowman pal (Normal):** the ring climbs over the snowman, then steps down the sky in a staircase to the left edge, a dark line through empty blue.

Fix: add pp073 and pp080 to `moatSkip` and re-bake the 2 slots. Rings drop from 18 to 16. The other 16 rings hug their hero, and 370's frames the car window. They're fine: 352 357 359 364 366 370 372 375 379 381 386 390 391 392 395 397.

**M3. 11 weak boards (22%), 7 of them scenes.** The list for the art lane, in priority order:
1. pp104 Teddy (400 / new 392): the closing Hard, borderline mud. Swap it, or regenerate it as a portrait (a pup's face with a small bear tucked under its chin).
2. pp073 Big bone (362 / new 354): a Hard, also in M2.
3. pp040 Flower crown (379 / new 371): a Hard.
4. pp042 Superhero (381 / new 373).
5. pp085 Picnic thief (382 / new 374).
6. pp091 Basket of pups (391 / new 383).
7. pp097 Hammock (394 / new 386).
8. pp099 Ice cream (397 / new 389).
9. pp080 Snowman pal (374 / new 366).
10. pp037 Head tilt (376 / new 368).
11. pp048 Bubble bath (387 / new 379).

That's on a par with World 7's shipped 22% weak. 3 of the 6 Hards are weak: 362, 379 and 400. The spares are all portraits, so swapping weak scenes for spares raises the read rate but makes the world even more samey (m3).

## MINORS
- **m1. Two rings worth a glance, both fine:** 364's ring follows the collie down to the bottom edge, and 397's wraps a weak board. Keep both.
- **m2. 361 Shiba could read as a fox.** It's an orange-and-cream face with pointy ears on pale blue. 398 Puppy wink is the same subject and reads the same way. Keep them; just don't add more orange spitz faces.
- **m3. Near-duplicates.** None sit back to back, but across the 50 a player will feel "another husky".

  | Subject | Zen numbers |
  |---|---|
  | Huskies, all ringed white-mask faces | 359, 375, 390 (375 and 390 are 15 apart with the same pose) |
  | Pugs | 353, 377, 385 |
  | Orange spitz faces (shiba and corgi) | 352, 361, 376, 398 |
  | Bulldogs | 360, 362, 366, 384 |
  | Boxers | 369, 381, 399 |
  | Beagles | 356, 372, 382, plus 368's basset |
  | Goldens | 351, 392 |
  | Dalmatians | 357, 397 |

  If anything is swapped, cut a husky first (390 Snow nose has no snow), and use the spares' new breeds (labs, akitas, a pomeranian, a bernese).
- **m4. Too-easy watch** (from the notes): 361 and 365 (4 colours) are flat portraits and look quick. They're in band, so I don't flag them beyond the builder's note.
- **m5. LICENSES rows point to `tools/lands/11-puppy-park/pictures/manifest.json`, which doesn't ship** (the shipped folder excludes tools/). It's the same wording as Worlds 7-8, so it's consistent. A reader of the public file can't follow it. Optional: "prompt kept in the studio's records".
- **m6. Carried over at 1280:** Next up shows "Side quest 12 ... Prize: Quartermaster +1", the realm card has an empty "Secrets found" line, and 0 coins (known, LATER.md).

## Checks that passed
- **Functional at 375@3, opener:** the map's Play opened "351 Golden smile" (Normal). 51 real taps on its winOrder gave "Picture done", "**Golden smile, all dug out.**" and Back to map / Retry (`win-375.png`).
- **Functional at 375@3, loss, retry and back to the map:** 400 Teddy (Hard) took 28 lossPlan taps and gave "A little stuck", "Line jammed: ... can't reach a block. Have another look.", plus Continue 250 / Retry / Back to map (`fail-375.png`). Retry (`#p-primary`) restarted z9-50 at 0 plays. The Map button returned to the map, with "Picture 352" now current. 0 console messages.
- **Join (375):** 348-350 are done on World 8's ochre cliffs. Then comes the banner "WORLD 9 Puppy Park", then 351 current ("Picture 351", "Play picture 351") on the green meadow. No horizontal overflow (`map-join-375.png`). The change from ochre canyon to bright meadow is clean and obvious.
- **Top and fog:** 395-400 sit on the green sheet, and 400 is the last node (the map holds 400). "More worlds on the way" sits under the fog (`map-top-375.png`).
- **Numbers in discs at 375:** all 50 World 9 numbers fit, with 0 negatives. The tightest are 362, 363, 366 and 368 at 1.0 px spare, the same margin as Worlds 5-8. The closest pair is 355-356 at 62.5 px.
- **Map tint:** the World 9 images are `sheet-03.webp` and `sheet-11.webp` under `sepia(0.15) saturate(1.7) hue-rotate(15deg) brightness(1.14) contrast(1.02)`, distinct from World 8's `sepia(0.55) saturate(2.1) hue-rotate(-16deg) contrast(1.35)`. It reads bright yellow-green spring, with a blue-teal river, a beige road and sheet 11's castle as a park folly (`map-1280.png`). It suits "Puppy Park" better than the earlier worlds' zero-byte tints suited theirs.
- **1280:** the realm card reads "WORLD 9 OF 9 · Puppy Park", with the lore and "9/50 cleared". Next up is "World 9 · Picture 360". The map is centred, with no overflow.
- **Titles at 375:** 0 of 50 overflow. The smallest auto-fit is 17 px (355 Dachshund bandana); 396 Greyhound sweater is 17.2 px.
- **Credits:** the Zen map foot ends "... National Park Posters: ... **Puppy Park: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it! Studios.**" That's the brief's line, after World 8's.
- **LICENSES.md:**
  - The heading reads "Zen World 9: Puppy Park (Land 8, levels 501-550 ...)", followed by the credit line.
  - There are **50 rows**, from "| 351 | 501 | Golden smile (pp001) |" to "| 400 | 550 | Teddy (pp104) |", each an original FLUX.1 work with its seed.
  - "lane C" appears 0 times. There are no parodies and no edit notes.
- **Rest of the content:** the party hats, the pirate hat (a cartoon skull), the cowboy hat and the wizard hat are all benign. Apart from M1, there's nothing scary or gross.

## Ship verdict
**Ship after fixes.**

Blocking (for the ship, though graded MAJOR):
- **M1:** recolour or swap **pp031** Chef pup (372 / new 364) and **pp051** Mud face (389 / new 381), so nothing reads as blood. Re-bake those 2 slots and show Peter a play-size sheet.

Non-blocking:
- **M2:** add `moatSkip` for **pp073** and **pp080** and re-bake 512/524 (new 504/516). Do it with M1's re-bake.
- **M3:** weak boards for the art lane, in this order: **pp104** (the closing Hard), **pp073**, **pp040**, **pp042**, **pp085**, **pp091**, **pp097**, **pp099**, **pp080**, **pp037**, **pp048**.
- **m3:** if swapping, cut a husky first (**pp052** Snow nose) and pull new breeds from the spares.
- **m5** and **m6:** optional text polish, or already known.

---

# Round 2 re-check (renumber, ring drops, 3 swaps), 2026-10-13

Re-checked on the ac69b56 snapshot alongside World 8's round 2 (full method in `tools/critic-land-09.md`, "Round 2 re-check"; shots in `tools/critic-land-09/r2/`: `blind-w9-swaps.png`, `w9-all-small.png`, `boards/z9-NN.png`). selfTest 896/0 at 375x812@3 and 898/0 at 1280x720, 0 console messages. Puppy Park is now 493-542 (Zen 343-392). The 8->9 join is clean: the banner "WORLD 9 Puppy Park", then 343 open on the meadow.

**The 3 swaps, blind at 375:**
- 364 / 514 **pp028** King corgi (Hard, ringed): **reads**. A big orange-and-white corgi head on purple, with the ring hugging its outline. No crown shows, so "King" needs the title. It's also the world's third corgi head (344 and 368 too). Minor.
- 381 / 531 **pp027** Cool shades (Easy): **reads**. An orange dog in black sunglasses on pink.
- 392 / 542 **pp066** Lab in a scarf (Hard closer): **reads**. A yellow lab in a green scarf on navy. A good closer.

**Rings:** 354 / 504 pp073 Big bone and 366 / 516 pp080 Snowman pal now carry **no ring**. I checked this in the packed grids (no `~` cells) and on the boards. World 9 has 16 ringed records.

**Blood-red check:** I measured the deep-red share on all 50 boards. The top ones are 359 Schnauzer beard (49%, a flat poster-red backdrop), 362 Car ride (a red car) and 348 Beagle ears (a red mat). By eye on all 50 (`w9-all-small.png`), nothing reads as blood. The two flagged boards are gone.

**Verdict, World 9: ship.** M1 and M2 are closed. M3's weak list stands minus pp104, which was swapped out.
