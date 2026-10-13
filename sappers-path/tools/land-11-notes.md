# Zen World 9 Puppy Park: v7 lane D

## Round 2 (2026-10-13): renumbered after World 8's round 2, the critic's ring drops and lane C's 3 swaps

One rework with World 8's round 2 (`tools/land-09-notes.md`, Round 2), from the orchestrator's rework brief and two follow-ups
(the Puppy Park critic `tools/critic-land-11.md`: drop the rings on pp073 and pp080; lane C 2c116aa: 3 swaps). Not pushed; no
image model run. The sections below are round 1's record; where round 2 changed a number, this section has it.

- **Renumbered, not re-baked.** World 8 (now Poster Parade) ends at 492 on sheet 65, so Puppy Park is records **493-542** (Zen **343-392**), ids
  unchanged z9-1..z9-50. `scratch/state.json` re-seeded `{from: 493, sheet0: 66, gal0: 62}` with round 1's tags and plan kept;
  each `scratch/bake/m-N.json` moved to `m-(N-8).json` with its `n` (round 1's files in `scratch/bake-r0/`); `convert --force`,
  `map assemble check` (PASS). Proof: against round 1's installed records, all 50 out/ records were identical in every field but
  `id` and `n`, and the map layout identical but for `n` and the sheet numbers. A bake's seed comes from `n`, so a re-bake would
  have dealt new boards; the renumber keeps every board, tag and feature. One thing does move: the egg coin values (10-15 a
  coin), drawn from a seed of the first level's number in land.js `map`.
- **The critic's rings** (critic-land-11: they read as stray lines): pp073 Big bone and pp080 Snowman pal into `moatSkip`;
  re-baked ringless on the kept plan with `--drop-moat`.
- **Lane C's swaps** (2c116aa; pp031 and pp051 read as bloody, pp104 near mud): `handoff-full.js` **62 of 62 identical**; the 62
  lines replaced whole (url filled as before; no line changed, only their order); `main` changed at 514 pp031 Chef pup -> **pp028
  King corgi**, 531 pp051 Mud face -> **pp027 Cool shades**, 542 pp104 Teddy (the Hard closer) -> **pp066 Lab in a scarf**. The 3
  old sources removed, `prep` + `convert --force`: **50 of 50 identical to boards-full**. All three new boards are 4 colours.
- **Re-bake of the 5 slots** (`bake --keep-plan --drop-moat --list 504,514,516,531,542 --shard 2`): 4 ok first time; 514 King
  corgi (Hard, link + 3 ? cards + ring) fell back (8 of 10 candidates lost the real-pace replay or were out of band at 46-68%),
  then **ok with `--extra 16 --reuse`**. No reorder, no slot dropped (still 50), still ending on a Hard.

| Level / Zen | Picture | Tag, features | Rate (band) | Pace | Taps | Careful | Ring |
|---|---|---|---|---|---|---|---|
| 504 / 354 | pp073 Big bone | H, 3 ? | 14.5% | 225 s | 54 | 1.0 | none (was ringed) |
| 514 / 364 | pp028 King corgi (4 colours) | H, link, 3 ? | 9.25% | 225 s | 48 | 0.81 | ring (extras) |
| 516 / 366 | pp080 Snowman pal | N | 42.75% | 229 s | 55 | 1.0 | none (was ringed) |
| 531 / 381 | pp027 Cool shades (4 colours) | E | 66.75% | 201 s | 50 | 1.0 | |
| 542 / 392 | pp066 Lab in a scarf (4 colours) | H, link, 3 ? | 13.25% | 203 s | 40 | 1.0 | |

- **Too-easy watch on the swaps:** none. No candidate of the 5 slots won 98% or more; the only such board in the world is still
  501 (was 509) pp007 Husky eyes, 3 of 8 Easy candidates.
- **The world now:** E18/N26/H6 ending on a Hard (542 Lab in a scarf). Easy mean 64.6% (59.2-73.8), Normal 38.7% (28.7-47.8),
  Hard 14.0% (9.2-16.2); careful min 1.0 / 0.625 / 0.81. Pace 159-293 s, **median 217 s**. ? cards 23, links 18, **rings 16**,
  0 mystery blocks, 0 locks, 0 fallbacks. Hards: 504 Big bone, 514 King corgi, 521 Flower crown, 528 Frenchie bat ears, 535
  Poodle glasses, 542 Lab in a scarf. Only 5 World 9 records changed beyond their number (504 514 516 531 542).
- **Map:** sheets 66-72 (3 and 11 as before); the eggs on the same spurs.
- **test.js / selfTest:** World 9's blocks renumbered (493 + i, rows keyed 343-392 then 493-542); `tools/shots-land-11.mjs`
  moved to Zen 343 (World 8 at 13).
- **The end state the next world builds on:** last record **542**, last sheet **72**, gal0 **62** (no side quests); Zen numbers
  end at **392**, 342 records in zen.json. Seed the next land `{from: 543, sheet0: 73, gal0: 62}`.

### Gates (round 2 tree, Worlds 8 and 9 together)

| Gate | Result |
|---|---|
| land.js check | World 8 PASS (median 214 s, 4 rings); World 9 PASS (median 217 s, 16 rings) |
| test.js | **718 passed, 0 failed** (shipped 14,194,320 B) |
| freeze --require | PASS after the snapshot (taken again after the rename): levels.json 2,405 checks, gallery.json 372, zen.json 342 / 3,078, shipped 654 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 3,078; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 3,078 (run before the rename; the rename changed only World 8's world entry, every record identical to the ones regraded, zen-8/zen-9 packs untouched by it) |
| pack.js --check | the shipped files match the source (zen.pk.json, zen-8, zen-9 rewritten; zen-1..7 byte-identical) |
| selfTest (selftest-lands.mjs) | **896/0 at 375x812@3, 898/0 at 1280x720, 896/0 at 360x640 (--small)**, 0 console |
| space-v7/check.mjs | **47 ok, 0 FAIL** (OLD = e072a9d via `OLD_DIR`): Zen card "0 of 404 pictures", 392 nodes from the index, sweeps z8-1 and z9-1 |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 896/0 or 898/0 in every viewport and the hidden tab, 0 console messages (two earlier runs timed out on a 15 s page-load wait while another builder's 16-thread bake held the load average at 11-16; passed on the next run at load 2) |

Cache tag **`?v=77`**.

**Byte-identity (proven).** zen.json: Worlds 1-7 entries and their 279 records identical to b787301's, every other key identical;
World 8 replaced (21 -> 13 records), World 9 renumbered (5 records re-baked). levels/: zen-1..zen-7.pk.json and every other
packed file byte-identical; zen.pk.json, zen-8 and zen-9 rewritten. LICENSES.md byte-identical up to World 8's heading
(107,297 B). Frozen set (`--snapshot`): Worlds 1-7 and their 279 records identical, the whole equal to build-data's;
levels.json, gallery.json, castles and frozen.json byte-identical.

**Payload.** Shipped **14,194,320 B** (79 files; -17,357 B on b787301's 14,211,677, +117,442 on e072a9d's live 14,076,878; 4.81
MB under 19 MB). `zen-8.pk.json` 17,833 B (31,349 in round 1), `zen-9.pk.json` 64,009 B, `zen.pk.json` 47,444 B. Bytes before the
first tap 1,909,674 B (+19,186 on e072a9d). check.mjs's "to the first Campaign level" swings between runs (5,390,779 B on one,
4,394,339 B on the last): audio still loading when it measures; nothing in the Campaign changed.

Shots re-taken: `tools/shots-land-11/` (join 8 -> 9 at 342/343, mid, top, 1280, opener, win) and `contact-installed.jpg`
(`--world 9 --zen-from 343`).

## Install (2026-10-13)

Brief: the orchestrator's lane D brief of 2026-10-13 (lane C's Puppy Park as Zen World 9, in two phases: phase 1 in the land
folder only while World 8 was being installed in the same worktree, phase 2 after World 8's commit bfec7a7; local only, never
pushed; no image model run; Peter approved the world order and the unattended run). Inputs (lane C's, read only): workspace
fb28f37, `game-research/sappers-path-v4/lands/11-puppy-park/` (README, `picks-full.json`: landMain 50, spares 12, landManifest 62
whole lines; `boards-full/`; `scripts/handoff-full.js`), sources `/Users/peter/local-ai/outputs/lands/11-puppy-park/fullsrc/`.
Method: World 7's install (`tools/land-08-notes.md`, the closest: AI pictures on Dino Valley's profile). Commits on
`sappers-path`: `6cb39a2` (land folder), `d4b860f` (install), `192c0af` (freeze), then these notes.

Records n **501-550** (Land 8 in the factory's numbering, era 16 = 8 + 8, ids z9-1..z9-50, world 9), shown on the page as Zen
pictures **351-400** (main.js zenNum: Worlds 1-8 hold 1-350). `scratch/state.json` seeded `{from: 501, sheet0: 67, gal0: 62}`:
World 8 ends at 500 and its 3 sheets at 66 (its state `{from: 480, to: 500, sheet0: 64}`, 3 layout entries in zen.json),
re-read after bfec7a7 and unchanged, so no re-seed or re-bake. The sheet numbers don't ship (the zen step drops `sheet`).

### 1. Boards

- `handoff-full.js` on this worktree: **62 of 62 identical**.
- `pictures/manifest.json` = lane C's 62 landManifest lines **whole** (chroma, model, prompt, seed, size, raw), with one field
  filled: `url` (empty in lane C's lines) carries Dino Valley's words, "Generated locally with FLUX.1 [schnell] (4-bit GGUF),
  seed N; prompt in tools/lands/11-puppy-park/pictures/manifest.json". No parodies, no edits (`edits.json` is empty).
- `main` = lane C's landMain in their order (no reorder). `prep` (LAND_PYTHON = lane C's venv, Pillow 12) + `convert`: **50 of
  50 identical to boards-full**, and all 50 sources byte-identical to the hand-off's.
- All 50 boards 42x42. Colours 4-7; the 4-colour boards are 511 pp010 Shiba smile, 515 pp014 Saint Bernard and 536 pp017
  Frenchie bat ears.

### 2. Moat probe

land.js `moatCan`: **40** ring-capable boards (lane C counts 40). Deal probe (the Worlds 4-8 scratch script: the bake's own
ring builder and `gen.deal` at the profile's deal setting, 6 rings x 20 attempts a tag, 7 s on 16 threads): **pp070 Dog house
and pp065 Boxer kiss never dealt** (0 of 120 at every tag): both in `moatSkip`. The rest dealt 1-100%: close portraits on plain
backgrounds deal easily (pp010 pp009 pp019 pp037 pp052 98-100%, 13 more at 77-99%); pp075 8-11%, pp005 3-5%, pp085 Picnic thief
1-2% (kept: it deals at every tag, as World 7 kept its 1% boards). With the 10 the ring check refuses, 12 pictures can't carry a
ring.

### 3. Bake (Dino Valley's profile as World 7 ships it)

1. **Bake 1** (fresh plan E18/N26/H6 ending on a Hard, `--shard 2`, 335 s on 16 threads): **49 ok first time, 1 fallback**:
   513 pp011 Chihuahua ears (Easy): its 8 candidates were all in band (52-78%) but every one failed the real-pace replay or the
   steady-rhythm check. Not a too-easy board.
2. **`--keep-plan --list 513 --extra 16 --reuse`**: **ok** (Easy, 61.25%, 238 s, 48 taps).

**No swap, no reorder, no `--drop-moat`.** None of the 12 spares used.

**Too-easy watch.**
- 511 pp010 Shiba smile (4 colours), a Normal slot: 45.75%; its 8 candidates 40-56% (half over the 50% top of the band). It
  sits high in Normal and will read easy-ish, but no candidate came near 100%.
- 515 pp014 Saint Bernard (4 colours), a Normal slot: 47.75%; candidates 42-48%. Same read.
- 509 pp007 Husky eyes, an Easy slot with a ring: 3 of 8 candidates won 100% of random-tap games; the pick is 60%.
- No other level had a candidate at 98% or more.

`map assemble check`: **PASS every gate** in phase 1 (World 8 not yet installed: the steps read layout.json and config, not
zen.json), and again in phase 2 with the `zen` key on (adds the "Zen: no mystery blocks" gate).

### 4. The world as baked

| Level / Zen | Picture | Tag, features | Rate | Pace | Taps | Ring |
|---|---|---|---|---|---|---|
| 501 / 351 | pp001 Golden smile | N, link | 35.8% | 226 s | 51 | |
| 509 / 359 | pp007 Husky eyes | E | 60.0% | 190 s | 53 | ring |
| 511 / 361 | pp010 Shiba smile (4 colours) | N, 2 ? | 45.8% | 225 s | 48 | |
| 512 / 362 | pp073 Big bone | H, 3 ? | 12.3% | 211 s | 55 | ring |
| 513 / 363 | pp011 Chihuahua ears | E, 2 ? | 61.3% | 238 s | 48 | (extras) |
| 515 / 365 | pp014 Saint Bernard (4 colours) | N, 2 ? | 47.8% | 234 s | 50 | |
| 522 / 372 | pp031 Chef pup | H, link, 3 ? | 8.8% | 236 s | 53 | ring |
| 525 / 375 | pp036 Big yawn | E | 60.8% | 293 s | 50 | ring |
| 529 / 379 | pp040 Flower crown | H, 3 ? | 16.3% | 187 s | 46 | ring |
| 536 / 386 | pp017 Frenchie bat ears (4 colours) | H, link, 3 ? | 15.8% | 238 s | 43 | ring |
| 542 / 392 | pp054 Dog with a ball | N | 46.0% | 194 s | 52 | ring |
| 543 / 393 | pp058 Poodle glasses | H, link, 3 ? | 14.8% | 188 s | 50 | |
| 550 / 400 | pp104 Teddy | H, link, 3 ? | 13.5% | 211 s | 47 | |

- **Tags E18 / N26 / H6 / X0**, ending on a Hard (550 Teddy). Hards: 512 Big bone, 522 Chef pup, 529 Flower crown, 536 Frenchie
  bat ears, 543 Poodle glasses, 550 Teddy.
- Random-tap win rate: Easy mean **64.8%** (59.2-73.8, band 45-80), Normal **38.4%** (28.7-47.8, band 20-50), Hard **13.5%**
  (8.8-16.2, band 6-20). Careful player: Easy min 1.0, Normal min 0.625 (542 Dog with a ball), Hard min 0.75 (550 Teddy).
- Real pace 159-293 s, **median 216 s**. Taps 38-55 (6 levels on the 55 cap; World 7 had 21). Longest tap 15.0 s at most.
- ? cards on 23 levels, linked squads on 18, **rings on 18** (502 507 509 512 514 516 520 522 524 525 529 531 536 540 541 542
  545 547), **0 mystery blocks, 0 locks, 0 archers, 0 Extreme, 0 fallbacks**.
- Profile: World 7's (Dino Valley's as it ships), copied whole with its own note; no `byLevel`.

### 5. Map (lever 1: zero new image bytes)

Castle sheets **3** and **11** (tools/map-plan-v7.md section 1), laid A, B, A', B', A, B, A' (**7 sheets**: 8 x 6 + 2), each
under the plan's spring tint `sepia(.15) saturate(1.7) hue-rotate(15deg) brightness(1.14) contrast(1.02)`. In the shots the
meadow reads yellow-green and bright, the river blue-teal, the road beige, sheet 11's little castle a park folly; clearly apart
from World 8's ochre cliffs at the join. Eggs from the plan's eggTurns (sheet 3 four repeats, 11 three): butterfly and grass,
fish and reeds on 3; grass and mushrooms, butterfly and owl on 11. `map/` holds 31 image files before and after. The top sheet
holds 2 levels (399, 400), so its eggs sit in the fog, as in World 5.

### 6. Words and credits

- Banner "World 9 · Puppy Park"; lore: "The road wanders into a sunny park full of happy dogs: goofy grins, floppy ears, party
  hats and muddy noses, with a bath, a car ride and a stolen picnic on the way."
- No `byArtist`: the win line is the plain Zen one, "Golden smile, all dug out."
- **Credit line** (the brief's, exactly): "Puppy Park: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it!
  Studios." on zen.json World 9 (`worldCredit`, the Zen map's foot after World 8's) and under the LICENSES.md heading.
- **LICENSES.md** "Zen World 9: Puppy Park (Land 8, levels 501-550 ...)": the credit line, then 50 rows keyed by Zen picture number
  then level (`zen.numbered`), e.g. "| 351 | 501 | Golden smile (pp001) | Click it! Studios | Original work (generated with
  FLUX.1 [schnell], Apache 2.0) | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 8001; prompt in ... |". The file
  before World 9's heading is byte-identical (its first 113,519 B).

### 7. Phase 1 alongside World 8

test.js lists every Zen land folder by its land.json (`zen` key) and compares the list exactly, so a Puppy Park land.json with
`zen` would have failed World 8's builder's test.js. In phase 1 the block sat under `zenPhase2` (land.js uses `zen` only for the
no-mystery gate and the zen step; the plan and bake don't read it), renamed to `zen` in phase 2 and the check re-run. Nothing
outside `tools/lands/11-puppy-park/` was touched in phase 1.

### 8. Byte-identity (proven)

- zen.json: Worlds 1-8 entries and their 300 records JSON-identical to bfec7a7's; every other key identical; World 9 appended
  (300 -> 350 records).
- levels/: zen-1..zen-8.pk.json and every other packed file byte-identical; only `zen.pk.json` (the index; its 8 world entries
  identical, World 9's added) changed and `zen-9.pk.json` is new. levels.json, gallery.json (build data) and places.json untouched.
- Frozen set (`--snapshot`): frozen zen.json's Worlds 1-8 and 300 records identical to bfec7a7's, the whole equal to
  build-data's; levels.json, gallery.json, castles and frozen.json byte-identical.

### 9. Gates (final tree)

| Gate | Result |
|---|---|
| land.js check | PASS every gate (501-550 e16, compile, wins, spaces, caps, pace and median 216 s, careful floor, no fallbacks, planCheck, Zen no mystery blocks, shades, 18 rings with reach and 1-2 ways, re-grade 0 of 450, map 48 px at 375, licences) |
| test.js | **718 passed, 0 failed** (shipped 14,211,677 B; new "zen World 9" block: records, numbering, Golden smile first with no painter, caps, careful, shades, moats, profile, re-grade, 7 reused sheets 3/11 in turn under its own tint (not Worlds 5-8's), eggs on the spurs, 31 map images, 50 rows keyed Zen 351-400 then 501-550 each an original FLUX.1 work with its seed, the credit line, no mystery blocks; World 1's world list, World 5's credit list and the Zen-profile list grown) |
| freeze --require | PASS before the snapshot (zen.json 300 / 2,700); after it: levels.json 2,405 checks, gallery.json 372, zen.json 350 / 3,150, shipped 662 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 3,150; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 3,150 |
| pack.js --check | the shipped files match the source (only `zen.pk.json` rewritten and `zen-9.pk.json` new; zen-1..8 byte-identical) |
| selfTest (selftest-lands.mjs) | **896/0 at 375x812@3, 898/0 at 1280x720, 896/0 at 360x640 (--small)**, 0 console (new World 9 block: records, map with castle sheets 3/11 under its tint on every image, first node 351 open, banner, fog, credits after World 8's, Golden smile plays and wins with the plain line) |
| space-v7/check.mjs | **47 ok, 0 FAIL** (OLD = e072a9d's sappers-path from git archive, `OLD_DIR` set): bytes, lazy (Zen card "0 of 412 pictures", 400 nodes from the index), saves, sweep (Zen World 9 z9-1 added at 375 and 1280) |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 896/0 or 898/0 in every viewport and the hidden tab, 0 console messages (shots in `tools/shots-land-11/harness/`) |

Cache tag **`?v=76`** (index.html, style.css).

### 10. Payload

| | bfec7a7 (World 8, unshipped) | this build | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 14,122,661 B (78 files) | **14,211,677 B** (79 files) | **+89,016 B** |
| levels/zen-9.pk.json (new) | | **64,587 B** | +64,587 |
| levels/zen.pk.json (the index) | 40,932 | 48,480 | +7,548 |
| LICENSES.md (World 9 section) / src/main.js (selfTest block) | | | +12,469 / +4,412 |
| map/ | | | **0** |
| Bytes before the first tap (home interactive, 375x812 cold load) | 1,898,699 B | **1,910,659 B** | +11,960 (the index, the code) |
| to the first Zen level (World 1's file) | 5,434,644 B | 5,446,604 B | +11,960 |

Against e072a9d (v6.7, live): shipped +134,799 B, first tap +20,171 B. World 9 packs to 1,292 B a level (World 7 1,395). 19 MB
gate: **4.79 MB of room left**. check.mjs's "to the first Campaign level" reads 4,395,324 B on this build against 5,371,622 B on
e072a9d; that run only, not a change here (no Campaign file or audio touched), most likely audio still loading when it measured.

### 11. Shots (tools/shots-land-11/, gitignored; `tools/shots-land-11.mjs` remakes them; notes.txt says what each shows)

- `map-join-375.png`: the World 8 -> 9 join at 375x812@3 (349-350 done on World 8's ochre cliffs, the World 9 banner, 351
  current "Picture 351" on the green meadow by the river and its plank bridge).
- `map-mid-375.png` (371-381), `map-top-375.png` (393-400, the fog, "More worlds on the way").
- `map-1280.png`: World 9 on desktop (9 of 50 cleared, 360 current; "World 9 of 9", the lore on the realm card).
- `play-opener-375.png` (Golden smile in play), `play-opener-mid-375.png`, `play-opener-1280.png`; `win-375.png` ("Picture done",
  "Golden smile, all dug out.").
- `harness/`: the harness's shots and report.
- `contact-installed.jpg`: the 50 as baked, numbered (`tools/land-contact.py tools/build-data/levels/zen.json 8 ... --world 9
  --zen-from 351`).
- Fit at 375 with all 400 Zen nodes: tightest number 222 (27 px in the disc's 28, unchanged), closest nodes 56.5 px (302-303,
  unchanged). 0 console messages.

### 12. Known for the critic

- 511 Shiba smile and 515 Saint Bernard (4 colours) sit at the top of the Normal band (45.8%, 47.8%): legal, may read easy.
- 509 Husky eyes: 3 of its 8 Easy candidates won 100%; the pick is 60%.
- 542 Dog with a ball's careful player is 0.625 (floor 0.5).
- 36 of 50 are close portraits on flat backgrounds (Peter's 10/13 framing rule), so the world is samey by design; the 14 scenes
  are spread through it in lane C's order.
- The Next up card on desktop shows "Side quest 12" and the realm card an empty "Secrets found" line, as on Worlds 4-8 (LATER.md).
