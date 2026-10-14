# Critic: Zen World 12 Clockwork Town (v7 lane D), 2026-10-13

Build: the exported snapshot of commit 9c1aa71 (`scratchpad/w12-critic/sappers-path/`). The snapshot has no `.claude/`, so I served it from the snapshot dir on 127.0.0.1:8555 with the threaded `/Users/peter/Documents/Claude/.claude/serve.py`. No file failed to load. The server was killed afterwards. Shots and data are in `tools/critic-land-14/` (untracked). The harness is the World 11 critic's, retargeted: `boards.mjs`, `func.mjs`, `back.mjs`, `blind.py`, `zoom.py` in the session scratchpad `w12run/`.

Numbering: records 611-642, Zen 461-492, ids z12-1..z12-32 (Zen = 460 + N). **Fixes are keyed by board id (ctNNN)**.

## selfTest
`tools/selftest-lands.mjs` on the snapshot (page wait raised to 60 s): **375x812@3 908 passed / 0 failed; 1280x720 910 / 0; 0 console messages.** I trust it for records, numbering, sheets and tint, the banner, the fog, credits order, no mystery blocks and the win line.

My own runs (32 boards at 1x, the opener won with real taps, a loss, Retry, a second loss, Back to map, the in-play map button, the map at 375@3 and 1280): **0 console messages, 0 page errors.**

## Counts
BLOCKER 0 · MAJOR 2 · MINOR 6

## How the boards were judged
Each board was loaded in play at 375x812 (DPR 1, touch) and captured as `#board` at CSS size (336x360, 8 px a cell). I judged from the numbers-only sheets (`blind-1..4.png`) and wrote down each blind read **before** printing titles, ids or prompts. Then I checked each against lane C's prompt and the 1.6x nearest-neighbour zooms (`zoom-a.png`, `zoom-b.png`). I had not seen these pictures before this pass. I didn't open `shots-land-14/contact-installed.jpg` until after the blind read; the in-game order matches LICENSES.md row for row.

Same bar as Worlds 10-11. Kind: S = the prompt sets a scene or an action, P = a single subject on "a plain background".

**Result: 22 read, 9 weak, 1 mud (69%).** World 11 had 63% in round 1 and 84% after its fixes; World 10 had 78%.

| Zen | Level | Id | Title | Kind | Tag | Rating | Blind read, then reason |
|---|---|---|---|---|---|---|---|
| 461 | 611 | ct001 | Clockwork owl | P | N | reads | An owl with a monocle eye. Good opener |
| 462 | 612 | ct003b | Pocket watch | P | N | reads (borderline) | A gold disc with a crown on red. The face is lost; the crown carries it |
| 463 | 613 | ct033 | Clock repair | S | E | **weak** (builder flag) | Blind: "a grey-pink animal beside a clock face". The clock reads; the mouse inventor is a pink-grey blob, and no fixing shows |
| 464 | 614 | ct004 | Steam train | P | N | **weak** | Blind: "a red and slate machine in a ring, a locomotive front?" Front-on, with no wheels or funnel shape, it reads as a red-and-black cabinet or throne |
| 465 | 615 | ct005b | Gear | P | N | reads | A gold gear on navy, ringed |
| 466 | 616 | ct006 | Robot dog | P | E | **weak** (builder flag) | Blind: "a pale animal with brown ears". A cream dog on the cream band; the legs break into specks on the slate band. Pale on pale |
| 467 | 617 | ct035 | Robot band | S | N | **weak** | Blind: "a robot holding an orange ball". The drum reads as a basketball; "band" is lost |
| 468 | 618 | ct007b | Clockwork bird | P | N | reads (borderline) | A yellow bird with a key, ringed. The ring's L-shaped arm round the base is busy but reads as a frame |
| 469 | 619 | ct008b | Inventor goggles | P | E | reads | A girl with brass goggles on her head. Clear face, friendly |
| 470 | 620 | ct009 | Lightbulb | P | N | reads | A yellow bulb on navy. Excellent |
| 471 | 621 | ct040 | Clock tower owl | S | H | reads (borderline) | An owl with a clock face for a body under a moon, ringed |
| 472 | 622 | ct010 | Wind-up mouse | P | E | reads (borderline) | A tan mouse on red. A few red specks at the paws and feet (m2) |
| 473 | 623 | ct011 | Robot cat | P | N | reads (borderline) | A teal robot cat or bear with dark eye patches |
| 474 | 624 | ct012b | Cuckoo clock | P | E | reads | A wooden cuckoo clock with a blue and white bird, ringed. Good |
| 475 | 625 | ct043b | Balloon engine | S | N | reads (borderline) | A tan balloon on a pink sky over mountains. The engine is a small brown lump |
| 476 | 626 | ct013 | Telescope | P | E | **weak** | Blind: "a gold gramophone horn". The tube and stand read as a gramophone, and 483 is a gramophone |
| 477 | 627 | ct016b | Robot owl | P | N | **weak** | Blind: "an orange fox or raccoon with goggles". The owl is lost in a round copper body |
| 478 | 628 | ct044 | Robot chef | S | H | **weak** | Blind: "a robot with a visor, arms out, on a counter". The robot reads; no pan and no pancakes, so "chef" is lost. **A Hard** |
| 479 | 629 | ct017b | Clock tower | P | E | **weak** (builder flag) | Blind: "a thin white and red tower". It reads as a lighthouse or rocket; the clock face is a white slab |
| 480 | 630 | ct018 | Wind-up fish | P | N | reads (borderline) | A pale green fish in a ring on dark teal |
| 481 | 631 | ct019b | Robot bear | P | E | reads | A teal teddy bear on red. The eyes are near-black maroon; they read as dark eyes, not red (checked in `zoom-a.png`) |
| 482 | 632 | ct045 | Submarine | S | N | reads | A yellow submarine with teal portholes in teal water, ringed. See m3 and the look-alike note |
| 483 | 633 | ct020 | Gramophone | P | E | reads | A gold horn on a red-brown box |
| 484 | 634 | ct021 | Brass beetle | P | N | **mud** (builder flag) | Blind: "a bell, a clock in a bell jar, a lantern?" A navy dome over an olive disc with orange legs. It reads as an emblem; nameable from the title only |
| 485 | 635 | ct022 | Robot face | P | H | reads | A pale green robot head with orange lamp eyes, ringed |
| 486 | 636 | ct049 | Robot reading | S | E | **weak** | Blind: "a grey creature in a red coat". The red book reads as the robot's body; the kitten is a grey lump |
| 487 | 637 | ct024 | Tin rabbit | P | N | reads | A brown rabbit with a navy body and a key. Good |
| 488 | 638 | ct025 | Compass | P | E | reads (borderline) | A teal dial with a star in a gold and brown ring on red |
| 489 | 639 | ct026b | Copper teapot | P | N | reads | An orange teapot with steam. Excellent |
| 490 | 640 | ct027 | Robot chicken | P | E | reads | An orange hen with a red comb |
| 491 | 641 | ct029 | Monocle frog | P | N | reads | A frog in a top hat, ringed. Good |
| 492 | 642 | ct030 | Zeppelin | P | H | reads (borderline) (builder flag) | Blind: "a pale grey zeppelin on pink". Long body, fins and a window row. It reads; it's the palest closer so far |

### Portrait vs scene read rate

| | Boards | Read | Weak | Mud | Read rate |
|---|---:|---:|---:|---:|---:|
| Portraits (P) | 25 | 19 | 5 | 1 | **76%** |
| Scenes (S) | 7 | 3 | 4 | 0 | **43%** |
| World 12 total | 32 | 22 | 9 | 1 | 69% |

- **Scenes fail on the action again:** 463 (no fixing), 467 (no drum), 478 (no pancakes), 486 (no book or kitten). The robot or the mouse reads, but what it's doing doesn't. That's the same pattern as Worlds 10 and 11.
- **The weak portraits fail on shape or identity:** 464 (front-on train), 476 (telescope reads as a gramophone), 477 (owl lost), 479 (clock tower reads as a lighthouse), 466 (pale on pale). 484 is mud.
- Hards: 471, 485 and 492 read (471 and 492 borderline). **478 Robot chef is weak.** The closer, 492, reads.

### Plain-band backgrounds (information for Peter, not a finding)
- **16 of 32 use lane C's edit** (an orange top band, the original plain colour, a slate bottom band): 461 462 465 466 467 468 470 471 472 476 480 483 484 486 490 492. They match the 16 "Adapted for the board" rows exactly.
- **13 sit on one flat colour:** 463 (teal), 464 (pale blue), 469 (orange), 473 (orange), 474 (pale blue), 477 (yellow), 478 (orange, with a counter strip), 481 (red), 485 (purple), 487 (green), 488 (red), 489 (blue), 491 (orange).
- **3 have a real background:** 475 (pink sky, clouds, mountains), 482 (sky and sea) and 479 (orange with two teal trees; only partly a scene).
- **Orange dominates:** an orange band or an orange ground is on **21 of 32** boards (the 16 edited plus 469, 473, 478, 479 and 491). That's the strongest sameness signal in the world (m4).

## MAJORS

**M1. 484 ct021 Brass beetle (Normal) is mud.** Repro: `?debug=1`, `SP.load("z12-24")` at 375x812. See `boards/b24.png` and `zoom-b.png` (bottom right). Blind, it read as "a bell, a clock in a bell jar, a lantern": a navy dome over an olive disc with orange legs, centred like a badge. Nothing says beetle without the title. The builder flagged it. Same class as World 11's ck018b, so the same call: **drop it or swap it**.

**M2. 10 boards are weak or mud (31%), one of them a Hard.** In priority order for the art lane:
1. ct021 Brass beetle (484 / 634): mud (M1).
2. ct044 Robot chef (478 / 628): the weak Hard, with no pancakes.
3. ct013 Telescope (476 / 626): reads as a gramophone, in the same world as ct020 Gramophone.
4. ct033 Clock repair (463 / 613): the inventor is a blob (builder flag). It's the world's third board.
5. ct006 Robot dog (466 / 616): pale on pale, with specky legs (builder flag). It's the sixth board.
6. ct049 Robot reading (486 / 636): no book, no kitten.
7. ct035 Robot band (467 / 617): the drum reads as a ball.
8. ct004 Steam train (464 / 614): a front-on cabinet.
9. ct017b Clock tower (479 / 629): a lighthouse (builder flag).
10. ct016b Robot owl (477 / 627): the owl is lost.

If only a few can go: 1 to 5. That covers the mud board, the weak Hard, the duplicate-looking subject, and the two weak boards in the opening six.

## MINORS
- **m1. Rings.** 10 boards carry a ring: 464 465 468 471 474 479 480 482 485 491. **One reads as a stray line:** on **482 ct045 Submarine** the ring climbs from the hull into a tall triangle peak in the white sky above the conning tower (`zoom-b.png`, top right), so it reads as a sail. If ct045 stays as is: `moatSkip` ct045, `--drop-moat`, and re-bake 632. 468's L-shaped arm round the key and base is busy but reads as a frame. The other eight hug their subject. **Keep those.**
- **m2. 472 ct010 Wind-up mouse:** about 6 single red cells at the feet and the key, plus a small red patch at the paws, on tan (`zoom-a.png`, top left). At 1x they're specks and don't read as blood, but ct010b was swapped out for exactly this. Optional: recolour the specks to the tan or brown in `edits.json`.
- **m3. Look-alikes.** I checked every robot and vehicle against Among Us, Thomas the Tank Engine, Wall-E, EVE, BB-8 and BMO: **none match.**
  - 464 Steam train has no face and is black and red, so it's not Thomas.
  - 478 is a visor-faced humanoid on legs, and 485 a square green head with orange eyes. Neither is Wall-E, EVE, BB-8 or BMO.
  - 473 and 481 are generic teal robot pets.
  - 469's inventor girl is generic.
  - 487 Tin rabbit is brown with a key, not the White Rabbit.
  - The Among Us risk (ct002b) was dropped in round 1.
  - **482 Submarine** is a plain yellow hull with portholes. It has none of the Beatles film's design (periscopes, trims, colours), and the title is just "Submarine". Low risk. Keep the title, and never call it "Yellow submarine".
- **m4. Sameness:** orange on 21 of 32 boards, plus the repeated orange-over-slate band frame on 16. Combined with the orange-brown map, the world reads as one hue. Later: lean any swaps toward non-orange grounds.
- **m5. LICENSES rows point to `tools/lands/14-clockwork-town/pictures/manifest.json`**, which doesn't ship. This carries over from Worlds 7-11.
- **m6. Map and desktop carry-overs.** The brass tint on the lava sheets reads as a cracked, khaki badland more than brass machinery. It's readable and distinct from World 11's ice blue; this is a theme nuance only. At 1280: "Side quest 12 ... Quartermaster +1" in Next up, the empty "Secrets found" line, and 0 coins on the realm card (known, LATER.md).

## Kid and portal safety, the rest
- **No lettering on any board.**
- **Red:** nothing reads as blood. Checked: 472 (m2, specks), 481 (maroon-black eyes read as dark eyes), 464 (a red buffer beam), 486 (the red book), 462 and 488 (red grounds), 490 (the hen's comb) and 479 (two maroon corner cells).
- **Faces:** all friendly. 469's girl smiles. 481's bear has one slanted eye patch, which reads as a sleepy teddy.

## Checks that passed
- **Opener at 375@3, real taps:** "Play picture 461" opened z12-1 "461 Clockwork owl". 55 real taps gave "Picture done", "**Clockwork owl, all dug out.**", Time 0:03, Taps 55, First clear +20, coins +17, and Back to map / Retry (`win-375.png`).
- **Loss, Retry, Back to map at 375@3, real taps:** 492 Zeppelin (Hard) took a 5-tap lossPlan and gave "A little stuck", HARD, "Line jammed: Sky can't reach a block. Have another look.", with Continue 250 / Retry / Back to map (`fail-375.png`).
  - Retry (`#p-primary`) restarted z12-32 at 0 plays.
  - A second loss, then Back to map (`#p-secondary`), showed the map (`jr: true`) with "Picture 462" current (`back-map-375.png`).
  - The map's Play loaded 462, and the in-play map button returned to the map.
  - 0 console messages.
- **The 11→12 join (375):** 460 is done (Hard) on World 11's pale sky sheet, and the road runs up to the banner "WORLD 12 Clockwork Town" with 461 current, "Play picture 461" (`map-join-375.png`). The change from ice blue to brass is obvious. World 11's lone 460 on its top sheet means a long road before the banner; it's cosmetic, as noted in the World 11 round 2 re-check. No horizontal overflow.
- **Top and fog:** 485-492 are on the top sheet, 492 is the last node (492 nodes), and "More worlds on the way" sits in the fog above it (`map-top-375.png`).
- **Numbers fit their discs:** the tightest World 12 number is 462, 25.9 px in the disc's 28 (2.1 px spare), at both 375 and 1280. The closest nodes are 465-466, at 57.9 px (375) and 66.4 px (1280). Nothing overlaps.
- **Brass tint:** World 12's images are sheets 17 and 18 under `sepia(0.85) saturate(1.3) hue-rotate(5deg) brightness(1.1) contrast(1.25)`. World 11's sheets 13 and 10 keep the sky tint. Same at 375 and 1280.
- **1280 map:** the realm card reads "WORLD 12 OF 12 Clockwork Town" with the lore ("A town that runs on gears and steam: ... a steam train, a submarine and a zeppelin, all in brass and copper."), "9/32 cleared", and 470 current with "Play picture 470" (`map-1280.png`). Everything the lore names is on a board.
- **Credits line:** it ends "... Cloud Kingdom: original pictures ... **Clockwork Town: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it! Studios.**" In order, after World 11.
- **LICENSES.md:** the section "Zen World 12: Clockwork Town (Land 11, levels 611-642 ...)" has its credit line and **32 rows**, 461/611 to 492/642, in game order. Each has its id and seed, and exactly **16** carry the "Adapted for the board" note. None of the dropped ct023, ct014, ct002b, ct050 or ct010b appears.

## Verdict: **ship after fixes**

**Blocking (the ship list):**
1. **M1 ct021 Brass beetle (484 / 634): mud.** Drop or swap.

**Non-blocking (recommended in the same batch, so the renumbering happens once):**
- M2 drops or swaps, in order: ct044 (the weak Hard), ct013, ct033, ct006, ct049, ct035, ct004, ct017b, ct016b.
- m1: if ct045 stays, `moatSkip` it and re-bake its slot.
- m2: recolour the red specks on ct010 (optional).
- m4 sameness, m5 the LICENSES pointer, m6 the tint and carry-overs: later.

### One list for lane C (all board fixes, by id)
| Priority | Id | Title | Now (Zen / level) | Fix |
|---|---|---|---|---|
| **Blocking** | ct021 | Brass beetle | 484 / 634 | Drop or swap (mud) |
| 1 | ct044 | Robot chef | 478 / 628 | Drop or swap (weak Hard); keep the Hard count with a reading board |
| 2 | ct013 | Telescope | 476 / 626 | Drop or swap (reads as a gramophone) |
| 3 | ct033 | Clock repair | 463 / 613 | Drop or swap (builder flag) |
| 4 | ct006 | Robot dog | 466 / 616 | Drop or swap (pale on pale; builder flag) |
| 5 | ct049 | Robot reading | 486 / 636 | Drop or swap |
| 6 | ct035 | Robot band | 467 / 617 | Drop or swap |
| 7 | ct004 | Steam train | 464 / 614 | Drop or swap |
| 8 | ct017b | Clock tower | 479 / 629 | Drop or swap (builder flag) |
| 9 | ct016b | Robot owl | 477 / 627 | Drop or swap |
| ring | ct045 | Submarine | 482 / 632 | `moatSkip` + re-bake (the ring reads as a sail) |
| optional | ct010 | Wind-up mouse | 472 / 622 | Recolour the red specks via `edits.json` |

## Files (tools/critic-land-14/)
`blind-1..4.png` (the numbers-only sheets), `boards/b01..b32.png` + `meta.json` (the 32 boards at CSS size), `zoom-a.png` (472 481 486 / 464 469 463), `zoom-b.png` (468 479 482 / 478 485 484), `map-join-375.png`, `map-top-375.png`, `map-1280.png`, `win-375.png`, `fail-375.png`, `fail2-375.png`, `back-map-375.png`, `phone-4.png` (join, top, win, fail at CSS size), `func.json`.
