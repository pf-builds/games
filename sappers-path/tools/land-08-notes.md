# Zen World 7 Under the Sea: v7 lane D

## Install (2026-10-12)

Brief: the orchestrator's lane D install brief of 2026-10-12 (lane C's Under the Sea full set as Zen World 7; local only,
never pushed; no image model run). Inputs (lane C's, read only): workspace 04fac5c,
`game-research/sappers-path-v4/lands/08-under-the-sea/` (README, `picks-full.json`: landMain 50, spares 12, landManifest 62
lines with chroma and, on 10 lines, an `edit` note; `boards-full/`; `scripts/handoff-full.js`), sources
`/Users/peter/local-ai/outputs/lands/08-under-the-sea/fullsrc/` (an edited scene keeps its id, its file `<id>e.png`). Method:
World 5's and World 6's installs (`tools/land-06-notes.md`, `tools/land-07-notes.md`). Commits on `sappers-path`: `d4ac098`
(land folder), `73ffedf` (install), `f9e698f` (freeze), then these notes.

Records n **430-479** (Land 6 in the factory's numbering, era 14, ids z7-1..z7-50, world 7), shown on the page as Zen pictures
**280-329** (main.js zenNum: Worlds 1-6 hold 1-279). `scratch/state.json` re-seeded `{from: 430, sheet0: 58, gal0: 62}` (the
trial scaffold assumed 451-500 and sheet 60; World 6 ends at 429 and its 4 sheets at 57). The trial's scratch moved to
`scratch/trial/`.

### 1. Boards

- `handoff-full.js` on this worktree: **62 of 62 identical**.
- `pictures/manifest.json` = lane C's 62 landManifest lines **whole** (chroma, model, prompt, seed, `edit`), with one field filled:
  lane C's `url` is empty, and the check's licence gate needs a source, so `url` carries Dino Valley's words, "Generated locally
  with FLUX.1 [schnell] (4-bit GGUF), seed N; prompt in tools/lands/08-under-the-sea/pictures/manifest.json", and on the four
  parodies "; a parody after <the painting, painter, date>, public domain (a new composition, not a copy of any reproduction)"
  (us210 and us252 The Great Wave, us256 the Mona Lisa, us254 The Starry Night), as Dino Valley's rows do.
- `main` = lane C's landMain in their order (no reorder). Old trial sources removed; `prep` + `convert --force`: **50 of 50
  identical to boards-full**. Sources: 48 byte-identical to the hand-off's, us236 and us244 pixel-identical (Pillow 11 here,
  12 in lane C's venv: PNG encoding only).
- Sizes 42x42 44, 32x46 6. Colours 4-7; the one 4-colour board is **445 us267 Giant squid** (edited). 8 of the 50 are edited
  (us265 us205 us236 us267 us282 us270 us283 us315); their licence rows carry the note.

### 2. Moat probe

land.js `moatCan`: **36** ring-capable boards (lane C counts 36). Deal probe (a scratch script as Worlds 4-6: the bake's own
ring builder and `gen.deal` at the profile's deal setting, 6 rings x 20 attempts a tag, 64 s): **17 never dealt** (0 of 120 at
every tag: us257 us265 us221 us208 us288 us212 us260 us289 us302 us296 us225 us233 us283 us224 us250 us276 us277) and us290
dealt 3% / 1% / 0 (as World 6's fw041): all 18 in `moatSkip`. The rest dealt 1-100% (us299 100%, us267 88-90%, us312 72-84%,
us315 53-58%, us282 50-55%, us245 us308 33-43%, us201 30-32%, us269 19-47%, us252 10-17%, us236 us222 us210 us244 us270 2-6%,
us217 us256 us264 1%). One more went in after the bake (439, below): **moatSkip 19**.

### 3. Bake (Dino Valley's shipped profile, as the trial)

1. **Bake 1** (fresh plan E18/N26/H6 ending on a Hard, `--shard 2`, 261 s wall on 16 threads): **47 ok first time, 3 fallbacks**:
   437 us288 Night voyage (Normal, a link: fast tapper; 7 of 8 candidates "no deal in 96"), 439 us210 The Great Wave (Normal,
   ringed: 78.5%, two candidates 100%, five no deal), 471 us315 Jellyfish lamps (Normal, link + ring: fast tapper or pace under
   150 s on all 8).
2. **`--keep-plan --extra 16 --reuse`** on the three (52 s): **437 and 471 ok**. 439 still out: of 24 candidates 12 dealt, and
   11 of those won 99.5-100% of random-tap games (one 78.5%, one 50.7%).
3. **439 The Great Wave ringless.** The ring walls the wave off and leaves a trivial board, and it deals rarely (3% in the
   probe). us210 into `moatSkip` (the why on the line), re-baked on the kept plan with `--drop-moat`: 8 candidates, 6 at 93-100%,
   still out (53.3%); `--extra 16 --reuse`: **ok** (1 good of 24; 15 of 24 at 98-100%). It stays Normal in its slot, ringless.
   **No reorder, no swap.**

`map assemble check`: **PASS every gate** (`scratch/report.md`).

**Too-easy watch.** Only us210 The Great Wave (above). 445 us267 Giant squid (4 colours, 88-90% ring deals) sits in an Easy slot
with a mire ring and baked first time: 61.5% (6 of 8 candidates good, 1 at 100%). 479 us254 Starry Sea (the closing Hard)
dealt 1 candidate of 10 and that one passed (14.5%). No other level had a candidate at 100%.

### 4. The world as baked

| Level / Zen | Scene | Tag, features | Rate | Pace | Taps | Ring |
|---|---|---|---|---|---|---|
| 430 / 280 | us201 Octopus drummer | N, 2 ? | 41.8% | 258 s | 51 | water |
| 437 / 287 | us288 Night voyage | N, link | 35.5% | 230 s | 53 | (extras) |
| 439 / 289 | us210 The Great Wave | N | 42.5% | 193 s | 55 | none (moatSkip, extras) |
| 441 / 291 | us212 Treasure guard | H, link, 3 ? | 12.0% | 224 s | 51 | |
| 445 / 295 | us267 Giant squid (4 colours) | E | 61.5% | 174 s | 48 | mire |
| 451 / 301 | us302 Birthday whale | H, link, 3 ? | 13.0% | 217 s | 55 | |
| 458 / 308 | us270 Vampire squid | H, 3 ? | 19.5% | 252 s | 54 | water |
| 465 / 315 | us256 Mona Lisa fish | H, link, 3 ? | 16.3% | 219 s | 55 | water |
| 471 / 321 | us315 Jellyfish lamps | N, link | 31.3% | 209 s | 40 | water (extras) |
| 472 / 322 | us312 Squid basketball | H, link, 3 ? | 8.0% | 200 s | 44 | mire |
| 479 / 329 | us254 Starry Sea | H, 3 ? | 14.5% | 229 s | 55 | |

- **Tags E18 / N26 / H6 / X0**, ending on a Hard (479 Starry Sea). Hards: 441 Treasure guard, 451 Birthday whale, 458 Vampire
  squid, 465 Mona Lisa fish, 472 Squid basketball, 479 Starry Sea.
- Random-tap win rate: Easy mean **64.1%** (47.3-74.3, band 45-80), Normal **37.8%** (26.8-44.8, band 20-50), Hard **13.9%**
  (8.0-19.5, band 6-20). Careful player: Easy min 1.0, Normal min 0.75 (478 Volcano island), Hard min 0.94.
- Real pace 174-268 s, **median 227 s**. Taps 40-55 (21 levels on the 55 cap, as Dino Valley's). Longest tap 15.0 s at most.
- ? cards on 23 levels, linked squads on 18, **rings on 12** (430 440 445 446 449 453 458 465 467 470 471 472; 440 445 470 472
  mire), **0 mystery blocks, 0 locks, 0 archers, 0 Extreme, 0 fallbacks**.
- Profile: Dino Valley's as it ships (deal attempts 96 at the land-config squads); no `byLevel`, no 1.6x deal.

### 5. Map (lever 1: zero new image bytes)

Castle sheets **14** and **15** (The Mistmoor: a marsh of pools and channels, the most water of any sheet not taken), laid A, B,
A', B', A, B (**6 sheets**: 9 + 8 + 9 + 8 + 9 + 7 levels), each under the world's tint
`sepia(.2) hue-rotate(150deg) saturate(1.5) brightness(.9) contrast(1.1)`: the marsh turns a blue sea floor with darker violet
pools, the road a pale aqua; clearly apart from World 5's sepia and World 6's pale blue-green (shots). Tried in a browser on 13,
14, 15, 19-21 (The Shrouded Weald turns purple-magenta under any blue turn) and 16 (the lava cracks go cyan, the volcano read is
lost); 14/15 read most like the sea. Not 2/5, 7/1 or 4/6. Eggs two a sheet on the castle sheets' quest-spur tips (`eggTurns`, 3
repeats each): fish, bubble, glint, wisp on 14; reeds, glint, wisp, fish, bubble on 15. `map/` holds 31 image files before and
after. The top sheet holds 7 levels, so one of its eggs shows below the fog (World 6's top sheet did the same).

### 6. Words and credits

- Banner "World 7 · Under the Sea"; lore: "The road dives under the waves, where octopuses play drums, deep-sea fish glow in the
  dark, volcanoes smoke on the sea floor, aliens drop by and old ships sail at night, with a sunny beach or two on the way."
  (test.js word check passes.)
- No `byArtist`: the win line is the plain Zen one, "Octopus drummer, all dug out."
- **Credit line** (the brief's, exactly): "Under the Sea: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by
  Click it! Studios." on zen.json World 7 (`worldCredit`, the Zen map's foot after World 6's) and under the LICENSES.md heading.
- **LICENSES.md** "Zen World 7: Under the Sea (Land 6, levels 430-479 ...)": the credit line, then 50 rows keyed by Zen picture
  number then level (`zen.numbered`): "| 280 | 430 | Octopus drummer (us201) | Click it! Studios | Original work (generated with
  FLUX.1 [schnell], Apache 2.0) | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 7201; prompt in ... |", Dino
  Valley's style. The 8 edited rows add lane C's note to the licence cell (land.js `editOf` drops "(ops in edits.json)"), e.g.
  282: "... Apache 2.0). Painted for readability by lane C: the deep black ocean covered over 75% of the board: a coloured sea
  floor painted along the bottom". The file before World 7's heading is byte-identical.

### 7. Byte-identity (proven)

- zen.json: Worlds 1-6 entries and their 229 records JSON-identical to c4ddc88's; every other key identical; World 7 appended
  (229 -> 279 records).
- levels/: zen-1..zen-6.pk.json and every other packed file byte-identical; only `zen.pk.json` (the index) changed and
  `zen-7.pk.json` is new. levels.json, gallery.json (build data) and places.json untouched.
- Frozen set (`--snapshot`): frozen zen.json's Worlds 1-6 and 229 records identical to c4ddc88's, equal to build-data's;
  levels.json, gallery.json and castles snapshots byte-identical; frozen.json unchanged.

### 8. Gates (final tree)

| Gate | Result |
|---|---|
| land.js check | PASS every gate (430-479 e14, compile, wins, spaces, caps, pace and median 227 s, careful floor, no fallbacks, planCheck, Zen no mystery blocks, shades, 12 rings with reach and 1-2 ways, re-grade 0 of 450, map 48 px at 375, licences) |
| test.js | **716 passed, 0 failed** (new "zen World 7" block: records, numbering, Octopus drummer first with no painter, caps, careful, shades, moats, profile, re-grade, 6 reused sheets 14/15 in turn under its own tint (not World 5's or 6's), eggs on the spurs, 31 map images, 50 rows keyed Zen 280-329 then 430-479, each an original FLUX.1 work with its seed, the 8 edit notes on exactly the edited scenes, the credit line; World 1's world list and World 5's credit list grown) |
| freeze --require | PASS before the snapshot; after it: levels.json 2,405 checks, gallery.json 372, zen.json 279 / 2,511, shipped 591 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 2,511; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 2,511 |
| pack.js --check | the shipped files match the source (only `zen.pk.json` rewritten and `zen-7.pk.json` new; zen-1..6 byte-identical) |
| selfTest (selftest-lands.mjs) | **888/0 at 375x812@3, 890/0 at 1280x720, 888/0 at 360x640 (--small)**, 0 console (new World 7 block: records, map with castle sheets 14/15 under its tint on every image, first node 280 open, banner, fog, credits after World 6's, Octopus drummer plays and wins with the plain line) |
| space-v7/check.mjs | **43 ok, 0 FAIL** (OLD = c4ddc88's sappers-path from git archive, `OLD_DIR` set): bytes, lazy (Zen card "0 of 341 pictures", 329 nodes from the index), saves, sweep (Zen World 7 z7-1 added at 375 and 1280) |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 888/0 or 890/0 in every viewport and the hidden tab, 0 console messages |

Cache tag **`?v=74`** (index.html, style.css).

### 9. Payload

| | c4ddc88 (v6.6, live) | this build | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 13,980,547 B (76 files) | **14,077,206 B** (77 files) | **+96,659 B** |
| levels/zen-7.pk.json (new) | | **70,945 B** | +70,945 |
| levels/zen.pk.json (the index) | 30,085 | 37,215 | +7,130 |
| LICENSES.md (World 7 section) / src/main.js (selfTest block) | | | +14,180 / +4,404 |
| map/ | | | **0** |
| Bytes before the first tap (home interactive, 375x812 cold load) | 1,878,954 B | **1,890,488 B** | +11,534 (the index, the code) |
| to the first Zen level (World 1's file) | 5,414,899 B | 5,426,433 B | +11,534 |

World 7 packs to 1,419 B a level (World 6 1,420). 19 MB gate: **4.92 MB of room left**.

### 10. Shots (tools/shots-land-08/, gitignored; `tools/shots-land-08.mjs` remakes them; notes.txt says what each shows)

- `map-join-375.png`: the World 6 -> 7 join at 375x812@3 (277-279 done on World 6's river sheet, the World 7 banner and lore,
  280 current "Picture 280" on the blue Mistmoor sheet).
- `map-mid-375.png` (297-309), `map-top-375.png` (323-329, an egg below the fog, "More worlds on the way").
- `map-1280.png`: World 7 on desktop (9 of 50 cleared, 289 current).
- `play-opener-375.png` (Octopus drummer in play, its water ring), `play-opener-mid-375.png`, `play-opener-1280.png`;
  `win-375.png` ("Picture done", "Octopus drummer, all dug out.").
- `contact-installed.jpg`: the 50 as baked, numbered (`tools/land-contact.py tools/build-data/levels/zen.json 6 ... --world 7
  --zen-from 280`).
- Fit at 375 with all 329 Zen nodes: tightest number 222 (27 px in the disc's 28, World 5's, unchanged), closest nodes 56.5 px
  (302-303). 0 console messages.
- `harness/`: the harness's shots and report.

### 11. Known for the critic

- **The edit notes say "lane C"** ("Painted for readability by lane C: ...") in the public LICENSES.md, as lane C wrote them;
  World 6's read "Adapted for the board by Click it! Studios: ...". One manifest-line edit each and `land.js zen` if wanted.
- **439 The Great Wave** is the easiest-reading board: ringless (moatSkip), and 15 of its 24 Normal candidates won 98-100%; the
  pick is in band (42.5%) but sits on the 55-tap cap at the low end of pace (193 s).
- **Four parodies** (The Great Wave twice at 439 and 452, Mona Lisa fish 465, Starry Sea 479): AI "after" scenes in an AI world,
  credited as Dino Valley's are; Peter's famous-paintings rule is about not swapping a real painting for an AI one, which this
  isn't, but the call is his and lane C's.
- The map tint turns the marsh's pools violet-mauve rather than deep blue (one filter on the whole sheet); the overall read is a
  blue sea floor.
- 21 levels sit on the 55-tap cap (Dino Valley's AI boards did the same); 478 Volcano island's careful player is 0.75.
- No lore/beach order: the world doesn't end on a beach, so the lore names its scenes without a route.
- The Next up card and empty "Secrets found" line as on Worlds 4-6 (LATER.md).

---

## The trial (2026-10-11, commit b15e9e5)

Brief: the orchestrator's lane D brief (trial bake only of 3 boards from lane C's Under the Sea pilot; World 6's work untouched;
never pushed; no image model). Inputs (lane C's, read only): workspace 6edd7ab,
`game-research/sappers-path-v4/lands/08-under-the-sea/` (README, `trial.json`: 3 whole landManifest lines), sources
`/Users/peter/local-ai/outputs/lands/08-under-the-sea/fullsrc/`, lane C's boards in `.../boards/`. Method: the Floating World
trial's (`tools/land-07-notes.md`, its first section).

### T1. Scaffold (not installed)

`tools/lands/08-under-the-sea/`: land.json, `pictures/manifest.json` (the 3 trial lines whole), `src/` (3 sources from `prep`).

- k 6 (Land 6, era 14 = 8 + 6), `zen.k` 7, ids will be `z7-1..z7-50`; `scratch/state.json` seeded `{from: 451, sheet0: 60,
  gal0: 62}` (World 6 holds 401-450 on sheets 54-59).
- Profile: **Dino Valley's shipped profile copied whole** (AI full story scenes: E18/N26/H6/X0 ending on a Hard, ? cards,
  linked squads, gentle moats, no locks, archers, Extreme or mystery blocks, careful floor 0.5, deal attempts 96 at the
  land-config squads [20, 50]).
- `main` is a trial placeholder: the 3 scenes repeated in turn (us201, us203, us206) so the plan has 50 slots; lore, eggs and
  map are drafts. Lane C's 50 replace all of it.
- test.js's Zen-profile list gains `08-under-the-sea` (a Zen land with hidden off); 714/0.

### T2. Boards

No hand-off script in lane C's folder (only mgconvert.js, which writes their boards), so: `prep` + `convert` here, compared with
lane C's `boards/<id>.json` (grid, pal, shade): **3 of 3 identical**. us201 Octopus drummer 42x42, 7 colours; us203 Hot spring
spa 42x42, 6; us206 Night voyage 42x42, 4 (dark navy). Chroma 1.4 (boardOf's own) on all three.

### T3. Trial bake (Dino Valley's profile, it passed; World 5's 1.6x/400 not needed)

Each board in an Easy, a Normal and a Hard slot of the draft plan (`bake --keep-plan --list 451,484,472,473,461,479,453,465,462
--shard 1`): **9 of 9 ok first time, no fallback, no extra candidates, 112 s wall** on 16 threads.

| Level | Scene | Tag, features | Rate (band) | Pace | Taps | Longest tap | Careful | Fallback | Deal attempts |
|---|---|---|---|---|---|---|---|---|---|
| 484 | us201 Octopus drummer | Easy, plain | 60.75% (45-80) | 240 s | 55 | 14.96 s | 1.0 | no | 11 for 8 |
| 451 | us201 | Normal, 2 ? cards, **ring** (2 ways, 93 water) | 40.0% (20-50) | 265 s | 55 | 14.99 s | 1.0 | no | 23 for 8 |
| 472 | us201 | Hard, 2 linked pairs, 3 ? cards, **ring** (2 ways) | 11.0% (6-20) | 284 s | 52 | 14.96 s | 1.0 | no | 36 for 10 (1 bad link) |
| 473 | us203 Hot spring spa | Easy, plain | 69.75% (45-80) | 220 s | 50 | 14.85 s | 1.0 | no | 8 for 8 |
| 461 | us203 | Normal, plain | 32.5% (20-50) | 211 s | 47 | 14.69 s | 1.0 | no | 9 for 8 |
| 479 | us203 | Hard, 3 ? cards | 13.5% (6-20) | 220 s | 48 | 14.96 s | 1.0 | no | 15 for 10 |
| 453 | us206 Night voyage | Easy, 2 ? cards | 71.0% (45-80) | 222 s | 44 | 14.27 s | 1.0 | no | 8 for 8 |
| 465 | us206 | Normal, 2 ? cards | 46.0% (20-50) | 208 s | 50 | 14.95 s | 1.0 | no | 9 for 8 |
| 462 | us206 | Hard, 2 linked pairs, 3 ? cards | 11.5% (6-20) | 183 s | 41 | 14.99 s | 1.0 | no | 15 for 10 |

- **Rings:** us201 carries one (ringed at Normal and Hard, both ok); us203 and us206 can't ("a picture colour (or shade)
  within 20/14 of every water colour"). No moat probe needed for a trial of one ring board; the full set gets one.
- **us206 Night voyage (dark, 4 colours): not too easy.** Unlike World 6's 405/449 (100% on every candidate at every squad
  size), it tunes into every band: Easy candidates 65-82%, Normal 38-49%, Hard 6-21%. It sits high in the Normal band (picked
  46%; all 8 candidates 38-49%), so on Normal slots it will read easy-ish but legal; it takes Hard comfortably. Dark boards look
  fine to bake; 4 colours is the floor, so watch for 4-colour scenes with big flat areas (the 405/449 failure).
- Edges: 451 and 484 at 55 taps (the cap); 472 at 284 s (the range is 150-300 s).
- Deals came easily on Dino Valley's squads (8-36 attempts a level), so the max-box painting setting isn't needed for these
  AI scenes.

### T4. Not done

No install, no zen.json, levels, LICENSES.md or pack output, no freeze, no map, no check step. Bake outputs stay in the
gitignored `scratch/`.
