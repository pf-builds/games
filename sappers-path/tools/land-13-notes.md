# Zen World 11 Cloud Kingdom: v7 lane D

## Install (2026-10-13)

Brief: the orchestrator's lane D brief of 2026-10-13 (lane C's Cloud Kingdom as Zen World 11, in two phases: phase 1 in the
land folder only while Puppy Park and Harvest Festival were installed in the same worktree, phase 2 after Harvest's 649e0ad;
local only, never pushed; no image model run; Peter approved the world order and the unattended run). Inputs (lane C's, read
only): `game-research/sappers-path-v4/lands/13-cloud-kingdom/` (README, `picks-full.json`, `boards-full/`,
`scripts/handoff-full.js`), sources `/Users/peter/local-ai/outputs/lands/13-cloud-kingdom/fullsrc/` (an edited picture keeps its
id, its file `<id>e.png`). Method: Harvest Festival's (`tools/land-12-notes.md`). Commits on `sappers-path`: `954f8d2` (land
folder), `a7bc21e` (install), `c5775a0` (freeze), then these notes.

Records n **588-617** (Land 10 in the factory's numbering, era 18 = 8 + 10, ids z11-1..z11-30, world 11), shown on the page as
Zen pictures **438-467** (main.js zenNum: Worlds 1-10 hold 1-437). `scratch/state.json` seeded `{from: 588, sheet0: 78, gal0:
62}`, checked at install against 649e0ad's end state (last record 587, World 10's 5 sheets ending at 77, gallery 62, no side
quests). The sheet numbers don't ship.

### 1. Two rounds of picks (lane C's workspace 4867271, then 540d88d)

1. **39** (4867271): `handoff-full.js` **51 of 51 identical**; `prep` + `convert` 39 of 39 identical to boards-full (sources
   byte-identical; `LAND_PYTHON` = the local-ai venv, Pillow as lane C's). Moat probe: 27 ring-capable; 10 never deal, ck002b 1
   of 360. Fresh bake (Harvest's profile at 39, E14/N20/H5): 36 ok; 616 ck023b Sky lighthouse ringed played 117-146 s on all 24
   candidates (fixed ringless, `--drop-moat`); **592 ck004b Sky whale and 624 ck030 Shooting star too easy**: every candidate
   won 100% (8, then 24 with `--extra 16 --reuse`, then 8 more on World 5's 1.6x squads and 400 deal attempts, a trial taken back
   out), no same-subject spare. One spare swap for mud: 589 ck002b Cloud castle (a white cloud with orange bits, the castle only
   nameable from the title) to ck002, re-baked ok. Lane D's pre-read at about 375 px (each board at 9 px a cell) flagged as mud
   or title-only: ck050b Dragon flight (the closing Hard: an orange ball), ck046b Balloon dog, ck040 Sun nap, ck047 Weather vane,
   ck025 Butterfly (reads as a flower), ck037 Sky pirate, ck005 Airship (reads as a fish; its spare worse). That round's scratch
   is in `scratch/phase1-39/`.
2. **30** (540d88d, this install): lane C dropped the 2 too easy and the 7 near-mud, no swaps; the castle is ck002 (file
   ck002e.png). Handoff **41 of 41 identical**; the 41 lines replaced whole; `prep` + `convert` **30 of 30 identical** to
   boards-full, sources byte-identical to the hand-off's.

- `pictures/manifest.json` = lane C's 41 landManifest lines **whole** (model, prompt, seed, size, raw, chroma where set, and on
  the edited ones `edit`), with `url` filled in Dino Valley's words: "Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed
  N; prompt in tools/lands/13-cloud-kingdom/pictures/manifest.json". No parodies.
- `main` = lane C's landMain with **one reorder**: slots 28 and 30 swapped, so 617 ck045 Cloud castle gate closes the world on
  its Hard (the road reaches the castle; the planned closer ck050b was dropped) and ck029 Rocket sits at 615.
- All 30 boards 42x42, colours 4-7; 4-colour boards: 589 ck002 Cloud castle, 598 ck010 Moon and star, 599 ck011b Cloud sheep,
  604 ck016 Storm cloud. **14 of the 30 are edited** (a tighter crop, the plain sky split into a deep blue band and a
  cloud-white band); their licence rows carry "Adapted for the board by Click it! Studios: ...".

### 2. Moat probe

The Worlds 4-10 scratch script (`scratch/moat-probe.js`: the bake's own ring builder and `gen.deal` at the profile's deal
setting, 6 rings x 20 attempts a tag, 8 s), re-run on the 30: **22 can carry a ring** (lane C counts 22). **moatSkip 9**: ck001
Hot-air balloon, ck003 Rainbow, ck006 Kite, ck007 Eagle, ck009 Sun face, ck017b Windmill, ck018b Flamingo, ck039 Umbrella float
(0 of 360 each) and ck023b Sky lighthouse (deals 52-55%, but ringed it never made pace in round 1). The rest dealt 2-82% (ck042
Kite tangle 2-8% kept, as Worlds 7 and 10 kept theirs).

### 3. Bake (fresh plan, Harvest's profile)

Harvest's profile (Dino Valley's as it ships) with tag shares E.37/N.50/H.13: the plan is **E11/N15/H4/X0, ending on a Hard**.
1. **Bake 1** (`--shard 2`): **29 ok first time**; 601 ck014 Balloon bunch (Easy, mire ring) lost the real-pace replay on all 8
   candidates (413-476 s).
2. **`--keep-plan --list 601 --extra 16 --shard 2 --reuse`**: ok (62.5%, 165 s, 45 taps, still ringed).
**No swap, no other reorder.** Too-easy watch: none failed; 594 ck035 Rainbow slide (Normal) had 2 of 8 candidates at 100%, the
pick 35.0%. `map assemble check`: **PASS every gate** (after the rename to `zen`, again).

### 4. The world as baked

| Level / Zen | Picture | Tag, features | Rate | Pace | Taps |
|---|---|---|---|---|---|
| 588 / 438 | ck001 Hot-air balloon | N, 2 ? | 42.0% | 232 s | 53 |
| 589 / 439 | ck002 Cloud castle | N, link, ring | 34.3% | 206 s | 53 |
| 596 / 446 | ck009 Sun face | H, 3 ? | 12.5% | 211 s | 49 |
| 601 / 451 | ck014 Balloon bunch | E, ring (mire) | 62.5% | 165 s | 45 (extras) |
| 603 / 453 | ck015b Parrot | H, link, 3 ? | 8.0% | 242 s | 49 |
| 610 / 460 | ck042 Kite tangle | H, link, 3 ?, ring | 15.3% | 199 s | 51 |
| 617 / 467 | ck045 Cloud castle gate | H, link, 3 ? | 15.5% | 224 s | 46 |

- **Tags E11 / N15 / H4 / X0**, ending on a Hard (617). Random-tap win rate: Easy mean **67.4%** (62.5-76.3, band 45-80), Normal
  **35.1%** (28.0-42.0, band 20-50), Hard **12.8%** (8.0-15.5, band 6-20). Careful player: Easy min 1.0, Normal min 0.875 (588),
  Hard min 1.0.
- Real pace 165-274 s, **median 217 s** (the check's 216 s before the rename). Taps 40-55 (3 levels on the 55 cap). Longest tap
  15.0 s at most.
- ? cards on 14 levels, linked squads on 11, **rings on 9** (589 592 594 600 601 609 610 611 614; 601 mire), **0 mystery
  blocks, 0 locks, 0 archers, 0 Extreme, 0 fallbacks**. The plain Zen win line ("Hot-air balloon, all dug out.").

### 5. Map (lever 1: zero new image bytes)

Castle sheets **13** (the Mistmoor: cloud land, sky-gap pools) and **10** (Twinspire's castle: the palace in the clouds), laid A,
B, A', B' (**4 sheets**: 8 + 8 + 8 + 6 levels), each under `grayscale(.8) brightness(1.4) contrast(.8) sepia(.3)
hue-rotate(160deg) saturate(2.4)` (tools/map-plan-v7.md section 3). Eggs per `eggTurns` (2 repeats each): on 13 its far-apart
spur pair of three (637,1101) and (352,293), bubble/wisp then glint/bubble; on 10 (659,1112) and (583,567), raven/butterfly then
glint/raven. The top sheet holds 6 levels; its raven sits below the fog. `map/` unchanged (31 image files).

### 6. Words and credits

- Banner "World 11 · Cloud Kingdom"; lore: "The road climbs up above the clouds: hot-air balloons and kites, birds of every kind,
  rainbows, a dragon kite and a rocket, and a palace sitting right on top of the clouds." **"Palace", not "castle":** the
  selfTest's Zen word check bans goblin/fort/assault/siege/raze/castle/throne on the Zen map (the first draft said castle and
  failed it; picture titles like "Cloud castle gate" are not on the map's text).
- **Credit line** exactly: "Cloud Kingdom: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it! Studios."
  on zen.json World 11 (`worldCredit`, the Zen map's foot after World 10's) and under the LICENSES.md heading.
- **LICENSES.md** "Zen World 11: Cloud Kingdom (Land 10, levels 588-617 ...)": the credit line, 30 rows keyed by Zen picture
  number then level (`zen.numbered`), the 14 edited rows with their note. The file before World 11's heading is byte-identical.

### 7. Byte-identity (proven)

- zen.json: every top-level key but `worlds`/`levels` identical; Worlds 1-10 entries and the first 387 records JSON-identical to
  649e0ad's; World 11 appended (387 -> 417 records, all world 11, era 18).
- levels/: zen-1..zen-10.pk.json and every other packed file byte-identical; `zen.pk.json` (the index) rewritten with Worlds
  1-10's entries identical and every other key unchanged; `zen-11.pk.json` new. levels.json, gallery.json, places.json untouched.
- Frozen set (`--snapshot`): frozen zen.json 387 -> 417 records, the old 387 and Worlds 1-10 identical, equal to build-data's;
  frozen.json, levels.json, gallery.json, castles.json snapshots byte-identical.

### 8. test.js and selfTest

- test.js: a "zen World 11" block (Harvest's, for 30 at 588-617, era 18, sheets 13/10, 4 sheets, Zen 438-467, 14 edit rows,
  `edited.size >= 10`); the world list and World 5's credit list grow by World 11; the D8 Zen-profile list gains
  `13-cloud-kingdom`. One change of shape: sheet 13 has **three** quest spurs and the eggs use its far-apart pair (0 and 2), so
  World 11's egg check is "each egg on one of the template's quest spots, the two apart" rather than spot i for egg i. Passes with
  the untracked `14-clockwork-town` and `16-holiday-lights` folders present (both under `zenPhase2`).
- selfTest (main.js): a "World 11" block as World 10's (records, map with castle sheets 13/10 under its tint on every image, first
  node 438 open, banner, fog, credits after World 10's, Hot-air balloon plays and wins with the plain line).
- check.mjs: "0 of 479 pictures"; the sweep loads z11-1.

### 9. Gates (final tree)

| Gate | Result |
|---|---|
| land.js check | PASS every gate (588-617 e18, median 216 s, 9 rings, Zen no mystery blocks, map 48 px at 375, licences) |
| test.js | **720 passed, 0 failed** (shipped 14,326,792 B, 81 files) |
| freeze --require | PASS before the snapshot (zen.json 387 / 3,483) and after: levels.json 2,405 checks, gallery.json 372, zen.json 417 / 3,753, shipped 729 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 3,753; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 3,753 |
| pack.js --check | the shipped files match the source |
| selfTest (selftest-lands.mjs) | **904/0 at 375x812@3, 906/0 at 1280x720, 904/0 at 360x640 (--small)**, 0 console |
| space-v7/check.mjs | **51 ok, 0 FAIL** (OLD = e072a9d's sappers-path from git archive, `OLD_DIR` set): bytes, lazy ("0 of 479 pictures"), saves, sweep (Zen World 11 z11-1 at 375 and 1280) |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 904/0 or 906/0 in every viewport and the hidden tab, 0 console messages (`tools/shots-land-13/harness/`) |

Cache tag **`?v=79`** (index.html, style.css).

### 10. Payload

| | 649e0ad (World 10, unshipped) | this build | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 14,273,900 B (80 files) | **14,326,792 B** (81 files) | **+52,892 B** |
| levels/zen-11.pk.json (new) | | **33,654 B** | +33,654 |
| levels/zen.pk.json (the index) | 53,526 | 58,199 | +4,673 |
| LICENSES.md (World 11 section) / src/main.js (selfTest block) | | | +10,053 / +4,512 |
| map/ | | | **0** |
| Bytes before the first tap (home interactive, 375x812 cold load) | 1,920,263 B | **1,929,448 B** | +9,185 (the index, the code) |
| to the first Zen level (World 1's file) | 5,456,208 B | 5,465,393 B | +9,185 |

Against e072a9d (v6.7, live): shipped +249,914 B, first tap +38,960 B. World 11 packs to 1,122 B a level. 19 MB gate: **4.67 MB
of room left**. check.mjs's "to the first Campaign level" read 4,414,113 B this run (audio 2,484,665 of the 3,481,134 the
previous runs counted): a request timing difference on the Campaign tap, nothing this build changed (no audio or Campaign file
touched).

### 11. Shots (tools/shots-land-13/, gitignored; `tools/shots-land-13.mjs` remakes them; notes.txt says what each shows)

- `map-join-375.png`: the World 10 -> 11 join at 375x812@3 (436-437 done on World 10's pumpkin sheet, the World 11 banner, 438
  current "Picture 438" on the pale sky Mistmoor sheet).
- `map-mid-375.png` (447-458), `map-top-375.png` (461-467 on Twinspire's sheet, the palace in the clouds, a raven egg, "More
  worlds on the way").
- `map-1280.png`: World 11 on desktop (9 of 30 cleared, 447 current).
- `play-opener-375.png` (Hot-air balloon in play), `play-opener-mid-375.png`, `play-opener-1280.png`; `win-375.png` ("Picture
  done", "Hot-air balloon, all dug out.").
- `contact-installed.jpg`: the 30 as baked, numbered (`tools/land-contact.py tools/build-data/levels/zen.json 10 ... --world 11
  --zen-from 438 --cols 6`).
- Fit at 375 with all 467 Zen nodes: tightest number 222 (27 px in the disc's 28, unchanged), closest nodes 56.5 px (302-303).
  0 console messages.

### 12. Known for the critic

- The pre-read's milder flags stayed in by lane C's call: 594 ck035 Rainbow slide (a pale bunny on a pale sky), 592 ck033 Kite
  flyer (the kite a red blob), 607 ck018b Flamingo (thin, maroon). 594 is also the one board with 100% candidates (2 of 8).
- 601 ck014 Balloon bunch plays short (165 s) with its mire ring; 611 ck022 Hummingbird 174 s.
- Cloud-white ground bands on the edited pictures sit on the cream-white frame tone; they read as ground at 375 (contact sheet).
- The top sheet holds 6 levels; one egg is below the fog (as Worlds 5-10).

### 13. End state for the next land (Clockwork Town)

Last record **617**, last sheet **81** (World 11's 4 sheets are 78-81), gallery **62** (no side quests): seed `{from: 618,
sheet0: 82, gal0: 62}`; Zen numbers continue at 468.
