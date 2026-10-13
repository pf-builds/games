# Zen World 8 Poster Parade (was National Park Posters): v7 lane D

## Round 2 (2026-10-13): the critic's fixes (`tools/critic-land-09.md`, "ship after fixes"; lane C 772784d)

Built by the lane D builder that installed World 9, in one rework with World 9's renumbering (`tools/land-11-notes.md`, Round 2).
Not pushed; no image model run. The sections below "Install" are round 1's record; where round 2 changed a number, this section
has it.

- **Inputs.** Lane C re-cropped 8 posters clear of all lettering (variant x3: np001 np007 np016 np050 np042 np040 np038 np018)
  and dropped 8 more (np013 np014 np067 np051 np063 np035 np073 np046; np019 and np020 went in round 1). `handoff-full.js`:
  **13 of 13 identical**. `pictures/manifest.json` = lane C's 13 lines **whole** (the 10 dropped posters' lines go with it);
  `main` = lane C's landMain: np001, np026, np007, np016, np050, np030, np042, np040, np015, np043, np038, np018, np003. The 8
  dropped sources removed from `src/`, the 8 re-cropped made again (`prep`, LAND_PYTHON = lane C's venv), `convert --force`:
  **13 of 13 identical to boards-full** (np026's kept round 1 source differs from the hand-off's in bytes, not in board).
- **Sizes now:** np001 29x46 (the narrowest board in the game's Zen worlds), np042 32x46, np003 38x46, np018 40x46, np016
  42x44, np038 42x42, np026 np015 42x40, np050 42x39, np007 np040 42x38, np030 np043 42x34. Colours 4-6 (np015, np018 at 4).
- **Renamed "Poster Parade"** (Peter's decision, 2026-10-13, the critic's m1: the world holds zoo animals, a cattle show and
  travel posters as well as parks). World name and banner "World 8 · Poster Parade"; the LICENSES.md heading "Zen World 8:
  Poster Parade (Land 7, levels 480-492 ...)"; test.js and selfTest strings name it. The folder (`09-national-park-posters`),
  the ids (z8-*, np*) and the land's slug stay. land.json carries a `nameNote`.
- **Words.** Credit (zen.json world credit and the licence heading) exactly "Poster Parade: 1920s-40s WPA and travel posters
  from the Library of Congress (no known restrictions on publication)."; lore "The road heads out on a parade of old travel and
  park posters from the 1920s-40s: geysers, peaks and forests, wild animals and zoo animals, ski trails and snowy days, each one
  dug out a block at a time." (test.js word check passes). After the rename the World 8 world entry is the only change in
  zen.json (its records identical to the ones regraded); the LICENSES.md World 8 section re-written, then World 9's re-appended
  after it so the worlds stay in order.
- **Moat probe** (13 boards): 6 can carry a ring (np007 np030 np042 np040 np015 np038) and all 6 deal (np007 80%, np038 52-56%,
  np040 51-53%, np042 38-47%, np030 14-39%, np015 4%). `moatSkip`: np015 kept (round 1's fast-tapper reason); np067 gone with
  its board; np018 out (its re-crop can't carry a ring: subject 86%).
- **Re-plan and fresh bake** (round 1's scratch moved to `scratch/round1/`; state re-seeded `{from: 480, sheet0: 64, gal0:
  62}`): World 6's short-world shares give **E5/N6/H2** at 13, ending on a Hard. `bake --shard 2`: **13 of 13 ok first time**, no
  extras, no reorder, no fallback, no board dropped.

| Level / Zen | Poster | Tag, features | Rate (band) | Pace | Taps | Careful | Ring |
|---|---|---|---|---|---|---|---|
| 480 / 330 | np001 Old Faithful (29x46) | N | 37.0% | 155 s | 37 | 1.0 | |
| 481 / 331 | np026 Hereford Cow | E | 64.0% | 231 s | 48 | 1.0 | |
| 482 / 332 | np007 Bighorn Ram | N, link | 44.75% | 202 s | 52 | 1.0 | ring |
| 483 / 333 | np016 Spare Our Trees | E, 2 ? | 71.25% | 197 s | 53 | 0.94 | |
| 484 / 334 | np050 Zoo Panda | N, 2 ? | 47.0% | 214 s | 54 | 1.0 | |
| 485 / 335 | np030 Leaping Deer | H, 3 ? | 10.0% | 225 s | 44 | 1.0 | ring |
| 486 / 336 | np042 Skiing in the East | E, link | 65.5% | 209 s | 50 | 1.0 | |
| 487 / 337 | np040 Fire Wrecks a Forest | N, 2 ? | 35.0% | 213 s | 55 | 1.0 | ring |
| 488 / 338 | np015 Protect Your Parks | E | 76.0% | 227 s | 49 | 1.0 | |
| 489 / 339 | np043 They Like Winter | N, 2 ? | 31.75% | 156 s | 42 | 1.0 | |
| 490 / 340 | np038 Keep the Park Clean | E | 72.5% | 226 s | 49 | 1.0 | ring |
| 491 / 341 | np018 Let Them Grow | N, link | 41.0% | 216 s | 46 | 1.0 | |
| 492 / 342 | np003 Zion | H, link, 3 ? | 16.25% | 227 s | 49 | 1.0 | |

- **The world now:** 13 levels 480-492, Zen 330-342, ids z8-1..z8-13. Easy mean 69.8% (64.0-76.0), Normal 39.4% (31.8-47.0),
  Hard 13.1% (10.0-16.3); careful min 0.94 / 1.0 / 1.0. Pace 155-231 s, **median 214 s**. ? cards 6, links 4, **rings 4**
  (482 485 487 490), 0 mystery blocks, 0 locks, 0 fallbacks. `map assemble check`: PASS every gate.
- **Too-easy watch.** 480 Old Faithful (the narrow 29x46 opener): 6 of its 8 Normal candidates won 98-100% of random-tap games;
  the pick is 37.0% and paces 155 s, near the 150 s floor. 482 Bighorn Ram: 5 of 8 at 98-100%, the pick 44.75%. 489 They Like
  Winter (42x34) paces 156 s. All legal. In the contact sheet, Old Faithful's bottom two rows are a dark navy band with no letter
  shapes left (lane C's crop stops above the text).
- **Map:** 2 sheets now (9 then 8: 8 + 5 levels), sheets 64-65 in the factory's numbering; eggTurns trimmed to one repeat each.
  So World 9 starts at sheet 66.
- **test.js:** the World 8 block now wants 13 records, 2 sheets, 13 licence rows keyed 330-342 / 480-492, the 1920s-40s credit,
  the 10 dropped posters out of main; its "mostly Easy and Normal" share check reads `>= 0.84` (11 of 13; sharesOf rounds to
  0.38 + 0.46). selfTest's World 8 block: 13 levels, 2 sheets, the new credit. check.mjs: "0 of 404 pictures".
- Contact sheet `tools/shots-land-09/contact-installed.jpg` (13, `--world 8 --zen-from 330`) and the opener `play-opener-375.png`
  re-taken (the whole `tools/shots-land-09.mjs` set re-run, its middle and top moved for 13 levels).
- Gates and sizes: as `tools/land-11-notes.md` Round 2 (one build for both worlds).

## Install (2026-10-13, unattended run; Peter approved the world order, reviews before any push)

Brief: the orchestrator's lane D install brief of 2026-10-13 (lane C's National Park Posters as Zen World 8, a short world;
local only, never pushed; no image model run), then its go-ahead to drop the two boards that fit no slot. Inputs (lane C's, read
only): workspace aa512c7, `game-research/sappers-path-v4/lands/09-national-park-posters/` (README, `picks-full.json`: landMain
23, 23 whole landManifest lines, no spares; `boards-full/`; `scripts/handoff-full.js`), sources
`/Users/peter/local-ai/outputs/lands/09-national-park-posters/fullsrc/`. Map: `tools/map-plan-v7.md` §5 (ba81887). Method:
Worlds 6 and 7 (`tools/land-07-notes.md` round 5, `tools/land-08-notes.md`). Commits on `sappers-path`: `72110b8` (land folder),
`5fc4e24` (install), `c921924` (freeze), then these notes.

Records n **480-500** (Land 7 in the factory's numbering, era 15, ids z8-1..z8-21, world 8), shown as Zen pictures **330-350**
(main.js zenNum: Worlds 1-7 hold 1-329). `scratch/state.json` seeded `{from: 480, sheet0: 64, gal0: 62}` (World 7's 6 sheets end
at 63).

### 1. Boards

- `handoff-full.js`: **23 of 23 identical**. `pictures/manifest.json` = lane C's 23 lines whole (short title, artist, date,
  museum "Library of Congress, Prints & Photographs", licence, the LoC item URL, chroma, srcCrop). No field filled or changed.
- `prep` + `convert`: **23 of 23 identical to boards-full**; sources pixel-identical to the hand-off's.
- Sizes: 38x46 10, 42x40 2, 41x46 2, 42x33-35 5, 42x28-29 2, 40x46 1, 42x34 1. Colours 4-7; five 4-colour boards (np007 np016
  np015 np020 np046). Seven landscape boards (42 x 28-35) play short (the runbook's pace note).

### 2. Moat probe

`moatCan`: 9 of 23 can carry a ring. Deal probe (6 rings x 20 attempts a tag at the profile's deal setting, the Worlds 4-7 scratch
script): **np067 Zoo Monkey and np018 Let Them Grow never deal** (0 of 120 at every tag): `moatSkip`. The rest dealt np020 71-73%,
np030 22-43%, np042 18-21%, np038 16-21%, np015 8%, np007 3%, np014 2-3%. After the first bake **np015 Protect Your Parks** joined
`moatSkip`: ringed at its Normal slot its fast tapper beat patient play on all 24 candidates (and on every dealt one at the
default squads); ringless it bakes ok.

### 3. The 23-level bake and the two drops

Profile: World 6's as it ships (real art, max-box boards: squads 1.6x, 400 deal attempts); shares 0.36 / 0.50 / 0.14 give
E8/N12/H3 at 23. Bake 1 (`--shard 2`, 302 s): 19 ok, 4 fallbacks. `--extra 16 --reuse` fixed 499 np051 Brookside Panther; np015 ok
ringless (above). Two boards fit no slot:

- **np019 Zoo Elephant** (slot 488, Hard, 42x33, 5 colours): too easy at any band. At the land's squads 24 of 26 candidates won
  96-100% of random-tap games (one 47.5%, one 71.5%); at the land-config default squads [20, 50] (`profile.bake.byLevel`, tried
  and removed) 15 of 18 won 91-100%; real pace 117-170 s. One reorder tried (488 and 489 traded): as an Easy it still won 100% on
  all 16 candidates, and np040 then won 100% as the Hard. Reverted.
- **np020 Zoo Hippo** (slot 494, Normal, 42x33, 4 colours): too easy and too short: 18 of 24 candidates won 100%; real pace 91-140
  s on every candidate (floor 150 s), at both squad sizes and ringless too.

Reported to the orchestrator; lane C had pre-agreed to drop rather than pad (no spares). **Both left the main order** (their
manifest lines stay); `count` 21. The 23-level scratch is kept in `scratch/r23/`.

### 4. The 21-level bake

- Fresh plan for 21: **E8 / N10 / H3**, ending on a Hard (World 6's shares at 21). Bake (`--shard 2`, 249 s): **20 of 21 ok first
  time**. 488 np040 Fire Wrecks a Forest (Normal, a link) won 100% on 22 of 24 candidates (`--extra 16 --reuse`), the in-band two
  failing the fast tapper.
- **The reorder (the brief allows two slots):** 488 and 489 trade places, so **488 = np015 Protect Your Parks (Normal, a link)**
  and **489 = np040 Fire Wrecks a Forest (Easy, plain)**: np040 had baked ok as an Easy in the 23-level plan and np015 ok as a
  Normal. Re-baked on the kept plan: 489 ok first time (72.5%), 488 ok with `--extra 16 --reuse` (1 good of 24). land.json
  `mainNote` records it.
- `map assemble check`: **PASS every gate** (`scratch/report.md`).
- **Too-easy watch:** 489 np040 (7 of 8 Easy candidates at 100%, pick 72.5%), 488 np015 (4 of 24 at 100%), 482 np007 Bighorn Ram
  (1 of 8), 483 np016 (2 of 8), 499 np003 Zion (4 of 8). All picks in band.

### 5. The world as baked

| Level / Zen | Poster | Tag, features | Rate | Pace | Taps | Ring |
|---|---|---|---|---|---|---|
| 480 / 330 | np001 Old Faithful | N, 2 ? | 35.0% | 237 s | 51 | |
| 486 / 336 | np030 Leaping Deer | H, link, 3 ? | 11.3% | 176 s | 37 | mire |
| 488 / 338 | np015 Protect Your Parks | N, link | 42.3% | 204 s | 50 | (moatSkip) |
| 489 / 339 | np040 Fire Wrecks a Forest | E | 72.5% | 223 s | 54 | |
| 491 / 341 | np014 See America: Caverns | E | 61.8% | 194 s | 43 | mire |
| 493 / 343 | np046 Hiking | H, link, 3 ? | 14.2% | 218 s | 38 | |
| 495 / 345 | np038 Keep the Park Clean | N, 2 ? | 32.8% | 215 s | 49 | water |
| 500 / 350 | np035 Rainier | H, 3 ? | 15.3% | 223 s | 55 | |

- **Tags E8 / N10 / H3 / X0**, ending on a Hard (500 Rainier). Hards: 486 Leaping Deer, 493 Hiking, 500 Rainier.
- Random-tap win rate: Easy mean **66.0%** (51.5-75.3), Normal **41.5%** (32.8-49.5), Hard **13.6%** (11.3-15.3). Careful player
  min: Easy 1.0, Normal 0.94, Hard 0.88.
- Real pace 170-237 s, **median 219 s**. Taps 37-55. Longest tap 15.0 s at most.
- ? cards on 10 levels, linked squads on 8, **rings on 3** (486 mire, 491 mire, 495 water), **0 mystery blocks, 0 locks, 0
  archers, 0 Extreme, 0 fallbacks**.

### 6. Map (lever 1: zero new image bytes; tools/map-plan-v7.md §5)

Castle sheets **9** (A: cliffs and a meadow) and **8** (B: the peaks), laid A, B, A' (**3 sheets**: 8 + 8 + 5 levels), each under
`sepia(.55) saturate(2.1) hue-rotate(-16deg) contrast(1.35) brightness(1.02)`: a high-contrast warm ochre with dark pines (shots).
Eggs from the plan's eggTurns, trimmed to the 3 sheets used: woodpile and raven, then grass and woodpile on 9; owl and mushrooms
on 8. `map/` holds 31 image files before and after. The top sheet holds 5 levels, so an egg can show below the fog (as Worlds 6, 7).

### 7. Words and credits

- Banner "World 8 · National Park Posters"; lore: "The road heads out into the great outdoors on old 1930s park and travel
  posters: geysers, mountains, forests, ski trails and zoo animals, each one dug out a block at a time." (word check passes).
- **Win line: the plain Zen one** ("Old Faithful, all dug out."), the orchestrator agreeing: the LoC gives artists surname-first
  ("Powell, C. Don (Chester)") and 9 of the 21 are "unrecorded", so "{title} by {by}" would read oddly or be missing on half the
  world. No `byArtist`.
- **Credit line** (the brief's, exactly): "National Park Posters: 1930s WPA and travel posters from the Library of Congress (no
  known restrictions on publication)." on zen.json World 8 (the Zen map's foot, after World 7's) and under the LICENSES.md heading.
- **LICENSES.md** "Zen World 8: National Park Posters (Land 7, levels 480-500 ...)": the credit line, then 21 rows keyed by Zen
  picture number then level (`zen.numbered`): the game title then the LoC title and id, the artist as the LoC records it with
  date and "(Library of Congress, Prints & Photographs)", the line's licence text "Public domain (Library of Congress: no known
  restrictions on publication)", and the LoC item URL. The file before World 8's heading is byte-identical.

### 8. Byte-identity (proven)

- zen.json: Worlds 1-7 entries and their 279 records JSON-identical to e072a9d's; every other key identical; World 8 appended
  (279 -> 300 records).
- levels/: zen-1..zen-7.pk.json and every other packed file byte-identical; only `zen.pk.json` (the index) changed and
  `zen-8.pk.json` is new.
- Frozen set (`--snapshot`): frozen zen.json's Worlds 1-7 and 279 records identical to e072a9d's, equal to build-data's; levels.json, gallery.json and castles snapshots byte-identical; frozen.json only its date.

### 9. Gates (final tree)

| Gate | Result |
|---|---|
| land.js check | PASS every gate (480-500 e15, median 219 s, careful floor, no fallbacks, planCheck at 21, Zen no mystery blocks, shades, 3 rings, re-grade 0, map, licences) |
| test.js | **717 passed, 0 failed** (shipped 14,122,661 B; new "zen World 8" block: records, numbering, Old Faithful first with no painter, caps, careful, shades, moats, profile, re-grade, 3 reused sheets 9/8 in turn under its own tint (not World 5's, 6's or 7's), eggs on the spurs, 31 map images, 21 rows keyed Zen 330-350 then 480-500 with the LoC licence text and item URL, the credit line, np019/np020 out of main; World 1's world list, World 5's credit list and the Zen-profile list grown) |
| freeze --require | PASS after the snapshot: levels.json 2,405 checks, gallery.json 372, zen.json 300 / 2,700, shipped 612 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 2,700; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 2,700 |
| pack.js --check | the shipped files match the source (only `zen.pk.json` rewritten and `zen-8.pk.json` new; zen-1..7 byte-identical) |
| selfTest (selftest-lands.mjs) | **892/0 at 375x812@3, 894/0 at 1280x720, 892/0 at 360x640 (--small)**, 0 console (new World 8 block: records, map with sheets 9/8 under its tint on every image, first node 330 open, banner, fog, credits after World 7's, Old Faithful plays and wins with the plain line) |
| space-v7/check.mjs | **45 ok, 0 FAIL** (OLD = e072a9d's sappers-path from git archive, `OLD_DIR` set): bytes, lazy (Zen card "0 of 362 pictures", 350 nodes from the index), saves, sweep (Zen World 8 z8-1 added at 375 and 1280) |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 892/0 or 894/0 in every viewport and the hidden tab, 0 console messages |

Cache tag **`?v=75`**. (A first selfTest/check.mjs run on a server left up from the day before reset its connections; on a fresh
server, port 8474, every run passed. Not a game fault.)

### 10. Payload

| | e072a9d (v6.7, live) | this build | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 14,076,878 B (77 files) | **14,122,661 B** (78 files) | **+45,783 B** |
| levels/zen-8.pk.json (new) | | **31,349 B** | +31,349 |
| levels/zen.pk.json (the index) | 37,215 | 40,932 | +3,717 |
| LICENSES.md (World 8 section) / src/main.js (selfTest block) | | | +6,223 / +4,494 |
| map/ | | | **0** |
| Bytes before the first tap (home interactive, 375x812 cold load) | 1,890,488 B | **1,898,699 B** | +8,211 |
| to the first Zen level (World 1's file) | 5,426,433 B | 5,434,644 B | +8,211 |

World 8 packs to 1,493 B a level. 19 MB gate: **4.88 MB of room left**.

### 11. Shots (tools/shots-land-09/, gitignored; `tools/shots-land-09.mjs` remakes them; notes.txt says what each shows)

- `map-join-375.png`: the World 7 -> 8 join (328-329 done on World 7's blue sheet, the World 8 banner and lore, 330 current on
  the ochre cliffs).
- `map-mid-375.png` (336-345), `map-top-375.png` (345-350, an egg below the fog, "More worlds on the way").
- `map-1280.png` (5 of 21 cleared, 335 current).
- `play-opener-375.png` (Old Faithful in play), `play-opener-mid-375.png`, `play-opener-1280.png`; `win-375.png` ("Picture done",
  "Old Faithful, all dug out.").
- `contact-installed.jpg`: the 21 as baked (`tools/land-contact.py tools/build-data/levels/zen.json 7 ... --world 8 --zen-from 330`).
- Fit at 375 with 350 Zen nodes: tightest number 222 (World 5's, unchanged), closest nodes 56.5 px (302-303). 0 console messages.
- `harness/`.

### 12. Known for the critic

- **Lettering bits on some boards** (contact sheet): 483 Spare Our Trees shows a row of letters along its foot, 496 Let Them Grow
  and 497 Brookside Panther a band of letter shapes, 489 Fire Wrecks a Forest a red strip at the foot. Lane C's crops aimed
  clear of lettering; worth a look at play size.
- **489 Fire Wrecks a Forest** is the easiest-reading board (7 of 8 Easy candidates at 100%); np040 and np015 traded slots (above).
- **Hereford Cow** (481) comes from a cattle feeders' meeting poster and the four zoo posters are city zoos, not parks; the lore
  says "zoo animals" so it holds, but the world name promises parks.
- Two boards dropped (np019, np020): the world is 21, not 23.
- The licence rows carry the LoC's own artist form ("Clough, Stanley Thomas, 1905-, 1938", "unrecorded, between 1936 and 1939").
- The Next up card and empty "Secrets found" line as on Worlds 4-7 (LATER.md).
