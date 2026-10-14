# Zen World 10 Harvest Festival: v7 lane D

## Round 2 (2026-10-13): the critic's fixes (`tools/critic-land-12.md`, "ship after fixes", head 649e0ad), with World 11

One rework with Cloud Kingdom's (`tools/land-13-notes.md`, Round 2), from the orchestrator's round 2 brief and a follow-up. Lane
C's workspace ee1b129 (critic M1: hf012b Dragon costume, maroon eyes; M2's first: hf057 Feast table, the weak Hard; both
dropped). Not pushed; no image model run. The sections below "Install" are round 1's record; where round 2 changed a number,
this section has it. Commits: one round 2 commit for both worlds (land folders, install, freeze), then these notes.

- **Inputs.** `handoff-full.js`: **55 of 55 identical**; the 55 lines replaced whole (no line changed). `main` = lane C's 43
  (558 hf012b and 564 hf057 out, their sources removed); `convert --force`: **43 of 43 identical to boards-full**.
- **Kept plan, cut to 43.** The two slots taken out of `scratch/state.json` and their bake files dropped; the rest moved down
  with their `n` (round 1's in `scratch/r45/`). The profile's 43-level sawtooth (unchanged profile) is **E15/N23/H5**, ending on
  a Hard; it differs from the cut 45 at 5 slots, re-planned for their new tag. Plus **546 hf042 Trick or treat into `moatSkip`**
  (critic m1: the ring's stub through the sky band reads as a stray line), re-baked ringless with `--drop-moat` on its slot's
  other features. `bake --keep-plan --drop-moat --list 546,558,560,561,563,564 --shard 2` (106 s): **6 of 6 ok first time**.
  The other 37 records are round 1's, identical but `n` and `id`.

| Level / Zen | Picture | Was | Now | Rate | Pace | Taps | Careful |
|---|---|---|---|---|---|---|---|
| 546 / 396 | hf042 Trick or treat | N, link, ring | N, link, **no ring** | 33.2% | 171 s | 43 | 1.0 |
| 558 / 408 | hf013 Scarecrow | N, 2 ?, ring | E, ring | 64.0% | 181 s | 43 | 1.0 |
| 560 / 410 | hf014b Turkey | E, 2 ? | N, 2 ? | 36.5% | 237 s | 54 | 1.0 |
| 561 / 411 | hf015 Pumpkin pie | N, link | E, link | 66.0% | 189 s | 44 | 1.0 |
| 563 / 413 | hf017 Red apple | E | N, 2 ? | 40.5% | 240 s | 52 | 1.0 |
| 564 / 414 | hf018 Corn cob | N, link | H, 2 links, 3 ? | 11.8% | 235 s | 54 | 1.0 |

- **The world now:** 43 levels **543-585** (Zen **393-435**, ids z10-1..z10-43). **E15/N23/H5**, ending on a Hard (585 Acorn);
  Hards 554 Sheet ghost kid, 564 Corn cob, 571 Sweater weather, 578 Candy bucket, 585 Acorn. Easy mean 67.3% (60.2-73.5),
  Normal 39.0% (31.8-49.5), Hard 12.8% (8.8-16.8); careful min 1.0 / 1.0 / 0.75. Pace 153-248 s, **median 219 s**. ? cards 20,
  links 17, **rings 16** (543 544 549 551 557 558 568 571 574 575 576 577 578 579 582 585; 578 Candle glow's kept, as the
  critic said), 0 mystery blocks, 0 locks, 0 fallbacks.
- **Too-easy watch:** 545 Pumpkin patch unchanged (2 of 8 candidates at 100%; the critic: not too easy by the grade). No re-baked
  slot had a candidate at 98% or more.
- **Map:** 5 sheets 73-77 as before (9 + 9 + 9 + 9 + 7); the eggs on the same spurs.
- **Not done (critic, non-blocking, not in this brief):** M2's other weak boards, m2 (hf001's red streak), m4 (Candle glow's
  title and step lines), m5 sameness, m7 the LICENSES pointer, m8 the desktop tint.
- **test.js / selfTest / check.mjs:** World 10's blocks at 43 (543 + i, rows keyed 393-435 then 543-585; test.js also checks
  546 hf042 ringless and in `moatSkip`, and hf012b/hf057 out of `main`); check.mjs's Zen card count 472.

### Gates (round 2 tree, Worlds 10 and 11 together)

| Gate | Result |
|---|---|
| land.js check | World 10 PASS (543-585 e17, median 219 s, 16 rings, Zen no mystery blocks); World 11 PASS (586-610 e18, median 211 s, 5 rings) |
| test.js | **720 passed, 0 failed** (shipped 14,316,130 B, 81 files; re-run with the untracked 14-clockwork-town, 16-holiday-lights, 17-farm-friends and 18-safari present) |
| freeze --require | PASS after the snapshot: levels.json 2,405 checks, gallery.json 372, zen.json 410 / 3,690, shipped 722 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 3,690; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 3,690 |
| pack.js --check | the shipped files match the source (zen.pk.json, zen-10 and zen-11 rewritten; zen-1..9 byte-identical) |
| selfTest (selftest-lands.mjs) | **904/0 at 375x812@3, 906/0 at 1280x720, 904/0 at 360x640 (--small)**, 0 console |
| space-v7/check.mjs | **51 ok, 0 FAIL** (OLD = e072a9d via `OLD_DIR`): Zen card "0 of 472 pictures" (three earlier runs timed out on the home wait while another builder's 16-thread bake held the load at 12-27; passed on the next) |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 904/0 or 906/0 in every viewport and the hidden tab, 0 console messages (three earlier runs timed out on a 15 s page-reload wait at load 15-27; passed at load 3; shots in `tools/shots-land-12/harness-r2/`) |

Cache tag **`?v=80`**.

**Byte-identity (proven).** zen.json: Worlds 1-9 entries and their 342 records identical to 79eed50's, every other key
identical; World 10 replaced (45 -> 43 records, 6 re-baked), World 11 replaced (Round 2 in land-13-notes). levels/:
zen-1..zen-9.pk.json and every other packed file byte-identical; zen.pk.json, zen-10 and zen-11 rewritten. LICENSES.md
byte-identical up to World 10's heading (123,710 B); World 10 then World 11 in order; "lane C" nowhere. Frozen set
(`--snapshot`): only frozen/zen.json changed, its Worlds 1-9 and 342 records identical, the whole equal to build-data's.

Payload: shipped **14,316,130 B** (81 files; -10,662 B on 79eed50's 14,326,792; +239,252 on e072a9d's live 14,076,878; 4.68 MB
under 19 MB). `zen-10.pk.json` 50,988 B (53,416), `zen-11.pk.json` 27,740 B (33,654), `zen.pk.json` 57,945 B (58,199). Bytes
before the first tap 1,929,214 B (-234 on 79eed50, +38,726 on e072a9d).

Contact sheet re-taken: `tools/shots-land-12/contact-installed.jpg` (`--world 10 --zen-from 393`).

**End state:** World 10 ends at 585 on sheet 77; World 11 (Round 2 in `tools/land-13-notes.md`) ends at **610** on sheet **81**.

## Install (2026-10-13)

Brief: the orchestrator's lane D brief of 2026-10-13 (lane C's Harvest Festival as Zen World 10, in two phases: phase 1 in the
land folder only while Worlds 8 and 9 were reworked in the same worktree, phase 2 after their commit ac69b56; local only, never
pushed; no image model run; Peter approved the world order and the unattended run and wants it shipped by Halloween). Inputs
(lane C's, read only): `game-research/sappers-path-v4/lands/12-harvest-festival/` (README, `picks-full.json`, `boards-full/`,
`scripts/handoff-full.js`), sources `/Users/peter/local-ai/outputs/lands/12-harvest-festival/fullsrc/` (an edited scene keeps
its id, its file `<id>e.png`). Method: World 9's install (`tools/land-11-notes.md`) and World 7's (`tools/land-08-notes.md`,
AI pictures with edits). Commits on `sappers-path`: land folder, install, freeze, then these notes.

Records n **543-587** (Land 9 in the factory's numbering, era 17 = 8 + 9, ids z10-1..z10-45, world 10), shown on the page as
Zen pictures **393-437** (main.js zenNum: Worlds 1-9 hold 1-392). `scratch/state.json` seeded `{from: 543, sheet0: 73, gal0:
62}`, the end state ac69b56 left (last record 542, last sheet 72, no side quests). The sheet numbers don't ship.

### 1. Three rounds of picks (lane C's workspace 5358a9e, c75b243, 931393c)

1. **50** (5358a9e): `handoff-full.js` **55 of 55 identical**; `prep` + `convert` 50 of 50 identical to boards-full (4 sources
   byte-different, pixel-identical: PNG encoding). Bake on World 9's profile: 48 ok, 547 hf042 Trick or treat (pace 144 s)
   and 592 hf035 Acorn (20.8%) ok with `--extra 16 --reuse`. Check PASS. Lane D's readability pre-read at about 375 px flagged
   562 hf055 Ghost party (AI gibberish lettering left brown text specks along the bottom), mud or low contrast on hf016
   Cornucopia, hf050 Bobbing apples, hf058 Squirrel stash, hf060 Bat cave, hf004 Friendly bat, hf052 Scarecrow crow, hf069
   Sunflower field.
2. **47** (c75b243): lane C swapped hf055 hf016 hf050 hf058 hf060 for the spares hf036b hf037b hf038 hf039 hf040b and dropped
   hf004 hf052 hf069. Handoff 55/55, convert 47/47 (only the 5 new boards differ); fresh bake 47 ok first time; check PASS.
   Pre-read of the 5: hf037b Pumpkin stack (faces lost, an orange tower) and hf039 Corn kid (face a grey-brown smudge) weak.
3. **45** (931393c, this install): lane C dropped hf037b and hf039. Handoff **55 of 55 identical**; the 55 lines replaced
   whole (no line changed since round 1); `main` = lane C's landMain (45, their order). The two sources removed; `convert
   --force`: 45 of 45 identical to boards-full.

- `pictures/manifest.json` = lane C's 55 landManifest lines **whole** (model, prompt, seed, size, raw, chroma where set, and on
  the edited ones `edit`), with `url` filled in Dino Valley's words: "Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed
  N; prompt in tools/lands/12-harvest-festival/pictures/manifest.json". No parodies.
- All 45 boards 42x42, colours 4-7. 4-colour boards: 545 hf041 Pumpkin patch, 546 hf042 Trick or treat, 576 hf026 Ghost and
  pumpkin, 578 hf068 Candle glow, 586 hf034b Turkey hat. **24 of the 45 are edited** (lane C: a tighter crop, the plain
  background split into an orange sky band and a purple ground band); their licence rows carry "Adapted for the board by Click
  it! Studios: ..." (land.js `editOf` drops "(ops in edits.json)").

### 2. Moat probe

The Worlds 4-9 scratch script (the bake's own ring builder and `gen.deal` at the profile's deal setting, 6 rings x 20 attempts a
tag, 8 s on 16 threads), run on the 50 and again on the 47. **38 of the 45 can carry a ring** (moatCan). **moatSkip 9**, each
0 of 360: hf005 Wise owl, hf006 Candy corn, hf015 Pumpkin pie, hf018 Corn cob, hf030b Spider pal, hf061 Owl post, hf070 Ghost
ship, hf023b Cider mug, hf033 Pie slice (hf016 hf050 hf060 were in it until they left the land). The rest dealt 2-100% (hf045
Apple picking 4-5% and hf057 Feast table 2-6% kept, as World 7 kept its 1% boards).

### 3. Bake: 47 to 45 on the kept plan (Dino Valley's profile as World 9 ships it)

The 47's bake (fresh plan, `--shard 2`, 421 s) was kept and cut to 45:
- The two slots (563 hf037b Normal, 569 hf039 Easy) taken out of `scratch/state.json` (tags, plan, moat) and their bake files
  dropped; the rest **renumbered, not re-baked** (`m-N.json` moved down with its `n`; round 47's files in `scratch/r47/`), as
  World 9's round 2 did. Every board, seed and grade of those records is the 47's.
- planCheck wants the profile's own sawtooth for 45 (land-plan landTags): **E16/N24/H5**, which differs from the cut 47 at 8
  slots. Those 8 were re-planned for their new tag (Easy at most 1 feature, Hard links + ? cards, Normal one feature; a ring
  only where the picture deals one) and re-baked on the kept plan (`bake --keep-plan --list 551,552,554,561,562,563,564,567
  --shard 2`, 101 s): **8 of 8 ok first time**, no extras, no reorder, no swap. The other 37 records are the 47's.

| Level / Zen | Picture | Was | Now | Rate | Pace | Taps | Careful |
|---|---|---|---|---|---|---|---|
| 551 / 401 | hf049 Carving | H, 3 ?, ring | E, ring | 69.8% | 154 s | 36 | 1.0 |
| 552 / 402 | hf008 Witch hat | E | N, 2 ? | 36.8% | 237 s | 55 | 1.0 |
| 554 / 404 | hf010b Sheet ghost kid | N | H, 2 links, 3 ? | 13.0% | 232 s | 50 | 1.0 |
| 561 / 411 | hf014b Turkey | H, 3 ? | E, 2 ? | 64.2% | 224 s | 46 | 1.0 |
| 562 / 412 | hf015 Pumpkin pie | E | N, link | 39.5% | 237 s | 47 | 1.0 |
| 563 / 413 | hf056 Cat and cauldron | E, link | N, link | 40.2% | 245 s | 49 | 1.0 |
| 564 / 414 | hf057 Feast table | N, 2 ? | H, 2 links, 3 ? | 9.0% | 223 s | 55 | 0.88 |
| 567 / 417 | hf019b Sunflower | H, link, 3 ? | E, link | 69.2% | 210 s | 42 | 1.0 |

**Why H5, not the brief's "about H6".** The profile is World 9's unchanged (shares Easy .36, Normal .52, Hard .12); at 45 its
sawtooth gives 5 Hards (.12 x 45 = 5.4). An H6 sequence needs a Hard share near .125 and moves 9-12 slots against the 47's;
H5 keeps the profile identical to Worlds 7 and 9 and moves 8. A one-number change (`profile.tags.shares.hard`) if Peter or the
critic wants the sixth Hard.

**Too-easy watch.** 545 hf041 Pumpkin patch (Easy, 4 colours): 2 of 8 candidates won 100%; the pick is 67.2%. 552 hf008 Witch
hat, the 47's worst (4 of 8 at 100% as an Easy), is now a Normal at 36.8% (candidates 32-55%). 546 hf042 Trick or treat, the
50's pace fallback, baked first time as a Normal in the 47 (47.8%, 176 s). No other level had a candidate at 98% or more.

`map assemble check`: **PASS every gate** (with `zen` on: "Zen: no mystery blocks").

### 4. The world as baked

- **Tags E16 / N24 / H5 / X0**, ending on a Hard (587 Acorn). Hards: 554 Sheet ghost kid, 564 Feast table, 573 Sweater weather,
  580 Candy bucket, 587 Acorn.
- Random-tap win rate: Easy mean **66.3%** (55.0-73.5, band 45-80), Normal **39.2%** (31.8-49.5, band 20-50), Hard **12.3%**
  (8.8-16.8, band 6-20). Careful player: Easy min 1.0, Normal min 1.0, Hard min 0.75 (587 Acorn).
- Real pace 154-249 s, **median 219 s**. Taps 36-55 (6 on the 55 cap). Longest tap 15.0 s at most.
- ? cards on 20 levels, linked squads on 19, **rings on 17** (543 544 546 549 551 557 559 570 573 576 577 578 579 580 581 584
  587, all water), **0 mystery blocks, 0 locks, 0 archers, 0 Extreme, 0 fallbacks**.
- Profile: World 9's (Dino Valley's as it ships), copied whole with its own note; no `byLevel`.

### 5. Map (lever 1: zero new image bytes)

Castle sheets **12** and **21** (tools/map-plan-v7.md section 2), laid A, B, A', B', A (**5 sheets**, 9 x 5), each under the
plan's pumpkin tint `sepia(.95) saturate(2.8) hue-rotate(-22deg) brightness(1.1) contrast(1.08)`. In the shots the fields and
forest read a warm pumpkin-orange, sheet 12's castle towers a cozy manor, the road pale gold; clearly apart from World 9's
green park at the join. Eggs from the plan's eggTurns, trimmed to the repeats laid (sheet 12 three, 21 two): mushrooms and a
woodpile (bonfire), a raven, an owl and a wisp, glowcaps. `map/` holds 31 image files before and after. The top sheet is full
(9 levels), so the fog sits right after 437.

### 6. Words and credits

- Banner "World 10 · Harvest Festival"; lore: "The road rolls into a cozy autumn fair: smiling pumpkins, friendly little ghosts,
  owls and black cats, kids in costumes, apples, pies and a big harvest feast, with sunflowers and hay bales all along the way."
  (test.js word check passes.)
- No `byArtist`: the win line is the plain Zen one, "Happy pumpkin, all dug out."
- **Credit line** (the brief's, exactly): "Harvest Festival: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by
  Click it! Studios." on zen.json World 10 (`worldCredit`, the Zen map's foot after World 9's) and under the LICENSES.md heading.
- **LICENSES.md** "Zen World 10: Harvest Festival (Land 9, levels 543-587 ...)": the credit line, then 45 rows keyed by Zen
  picture number then level, the 24 edited ones with their note. "lane C" appears nowhere in LICENSES.md. The file before
  World 10's heading is byte-identical (its first 123,710 B).

### 7. Phase 1 alongside Worlds 8 and 9

Until ac69b56 the zen block sat under `zenPhase2` (test.js lists every Zen land folder by its `zen` key), and nothing outside
`tools/lands/12-harvest-festival/` was touched. Renamed to `zen` in phase 2 and the check re-run. test.js passes with the
untracked 13-cloud-kingdom and 14-clockwork-town folders present (their blocks still under `zenPhase2`).

### 8. Byte-identity (proven)

- zen.json: Worlds 1-9 entries and their 342 records JSON-identical to ac69b56's; every other key identical; World 10 appended
  (342 -> 387 records).
- levels/: zen-1..zen-9.pk.json and every other packed file byte-identical; only `zen.pk.json` (the index) changed and
  `zen-10.pk.json` is new. levels.json, gallery.json (build data) and places.json untouched.
- Frozen set: `freeze --require` PASS before the snapshot (zen.json 342 / 3,078); `--snapshot`: only frozen/zen.json changed,
  its Worlds 1-9 and 342 records identical to ac69b56's, the whole equal to build-data's; levels.json, gallery.json, castles
  and frozen.json byte-identical.

### 9. Gates (final tree)

| Gate | Result |
|---|---|
| land.js check | PASS every gate (543-587 e17, compile, wins, spaces, caps, pace and median 219 s, careful floor, no fallbacks, planCheck at 45, Zen no mystery blocks, shades, 17 rings with reach and 1-2 ways, re-grade 0 of 405, map 48 px at 375, licences) |
| test.js | **719 passed, 0 failed** (shipped 14,273,900 B; new "zen World 10" block: records, numbering, Happy pumpkin first with no painter, caps, careful, shades, moats, profile, re-grade, 5 reused sheets 12/21 in turn under its own tint (not Worlds 5-9's), eggs on the spurs, 31 map images, 45 rows keyed Zen 393-437 then 543-587 each an original FLUX.1 work with its seed, the 24 edit notes on exactly the edited scenes, the credit line, no mystery blocks; World 1's world list, the credit list and the Zen-profile list grown) |
| freeze --require | PASS after the snapshot: levels.json 2,405 checks, gallery.json 372, zen.json 387 / 3,483, shipped 699 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 3,483; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 3,483 |
| pack.js --check | the shipped files match the source |
| selfTest (selftest-lands.mjs) | **900/0 at 375x812@3, 902/0 at 1280x720, 900/0 at 360x640 (--small)**, 0 console (new World 10 block: records, map with castle sheets 12/21 under its tint on every image, first node 393 open, banner, fog, credits after World 9's, Happy pumpkin plays and wins with the plain line) |
| space-v7/check.mjs | **49 ok, 0 FAIL** (OLD = e072a9d via `OLD_DIR`): Zen card "0 of 449 pictures", 437 nodes from the index, sweep adds z10-1 (one earlier run timed out on a page wait at load average 20 while another builder baked; passed on the re-run) |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 900/0 or 902/0 in every viewport and the hidden tab, 0 console messages (shots in `tools/shots-land-12/harness/`) |

Cache tag **`?v=78`** (index.html, style.css).

### 10. Payload

| | ac69b56 (Worlds 8/9, unshipped) | this build | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 14,194,320 B (79 files) | **14,273,900 B** (80 files) | **+79,580 B** |
| levels/zen-10.pk.json (new) | | **53,416 B** | +53,416 |
| levels/zen.pk.json (the index) | 47,444 | 53,526 | +6,082 |
| LICENSES.md (World 10 section) / src/main.js (selfTest block) | | | +15,575 / +4,507 |
| map/ | | | **0** |
| Bytes before the first tap (home interactive, 375x812 cold load) | 1,909,674 B | **1,920,263 B** | +10,589 (the index, the code) |
| to the first Zen level (World 1's file) | 5,445,619 B | 5,456,208 B | +10,589 |

Against e072a9d (v6.7, live): shipped +197,022 B, first tap +29,775 B. World 10 packs to 1,187 B a level. 19 MB gate: **4.73 MB
of room left**.

### 11. Shots (tools/shots-land-12/, gitignored; `tools/shots-land-12.mjs` remakes them; notes.txt says what each shows)

- `map-join-375.png`: the World 9 -> 10 join at 375x812@3 (391-392 done on World 9's green park, the World 10 banner, 393 current
  "Picture 393" on the pumpkin-orange sheet).
- `map-mid-375.png` (410-420), `map-top-375.png` (427-437, the fog, "More worlds on the way").
- `map-1280.png`: World 10 on desktop (9 of 45 cleared, 402 current; "World 10 of 10", the lore on the realm card).
- `play-opener-375.png` (Happy pumpkin in play, its water ring), `play-opener-mid-375.png`, `play-opener-1280.png`; `win-375.png`
  ("Picture done", "Happy pumpkin, all dug out.").
- `contact-installed.jpg`: the 45 as baked, numbered (`tools/land-contact.py tools/build-data/levels/zen.json 9 ... --world 10
  --zen-from 393`).
- Fit at 375 with all 437 Zen nodes: tightest number 222 (27 px in the disc's 28, unchanged), closest nodes 56.5 px (302-303,
  unchanged). 0 console messages. The page load waits in `shots-land-12.mjs` are 60 s (two runs timed out at 20 s under load).

### 12. Known for the critic

- 546 hf042 Trick or treat and 578 hf068 Candle glow carry rings that hug a thin shape (the door edge, the pumpkin) and may read
  as stray lines, as World 9's critic found on pp073/pp080; `moatSkip` + `--drop-moat` if so.
- 545 Pumpkin patch (Easy, 4 colours) is the easiest-reading board: a small pumpkin under two bands; 2 of its 8 candidates won
  100%.
- 560 hf036b Owl in leaves: the orange owl blends into the orange and red leaves (lane D's pre-read: borderline).
- 578 "Candle glow" reads as a jack-o'-lantern; the candle the title names isn't visible.
- 584 hf031 Frankie pup: a green dog with neck bolts; generic, but a trade-dress glance is the critic's call.
- 5 Hards, not 6 (section 3).
- The Next up card on desktop shows "Side quest 12" and the realm card an empty "Secrets found" line, as on Worlds 4-9 (LATER.md).

### 13. The end state the next world builds on

Last record **587**, last sheet **77** (World 10's 5 sheets are 73-77), gal0 **62** (no side quests); Zen numbers end at
**437**, 387 records in zen.json. Seed Cloud Kingdom `{from: 588, sheet0: 78, gal0: 62}`.
