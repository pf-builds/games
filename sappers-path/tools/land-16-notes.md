# Zen World 13 Holiday Lights: v7 lane D

## Polish pass (2026-10-14): lane C's same-count swap and retitle

**Holiday Lights stays 35 levels, records 650-684, Zen 500-534.** Lane C d157872. `handoff-full.js` on the workspace at 28508bd:
**53 of 53 boards identical**; manifest replaced whole (url filled); `prep` + `convert --force`: only 668's board changed (and
hl211's title).

- 668 hl213 -> **hl025 Robin** (hl213's red specks on the snow read as spatter): an edited source (tighter crop, sky and ground
  bands; edit note on its row). Easy with 2 ? cards on the kept plan (`--keep-plan --list 668`), 61.8% (was 78.5%), 184 s.
  hl025 can carry a ring by shape but never deals one (0/120); its slot plans none, so nothing changes.
- hl211 retitled "Giant candy cane" (hl007 is "Candy cane"); data only.
- `assemble check` PASS (median 215 s). **Changed records: z13-19 (swap), z13-25 (title).**
- Contact sheet re-taken (`--world 13 --zen-from 500`). Gates, proof and payload: `tools/land-18-notes.md` "Polish pass".

## Round 2 (2026-10-13): lane C's refill and critic-land-16's fixes, 26 -> 35

**Holiday Lights: 35 levels, records 650-684, Zen 500-534, ids z13-1..z13-35.** Handoff **52 of 52 identical**; convert 35 of 35
identical to boards-full. No drop. Tags `landTags(35)` on the unchanged shares (.35/.50/.15): **E12/N18/H5**. **5 sheets now**
(86-90: 19/20/19'/20'/19, 8+8+8+8+3), sheet0 86 unchanged.

- **critic-land-16 fix 1:** the closer is **hl022 Fox in snow** (reads); hl030 Clock midnight (weak lower face) is now a mid-world
  Hard at 679. Both were Hard slots, so their bake records and plan entries were swapped (n set): no re-bake.
- **critic-land-16 fix 2:** hl002b Snowman into moatSkip, re-baked ringless on its plan (`--drop-moat`, 651, 42.0%).
- Refills (9): 659 hl206 Fox in a hat (E), 660 hl209 Santa's cat (N; Santa hat cat hl016 at 676), 661 hl208 Sleigh (N), 663 hl203
  Penguin pair (N), 668 hl213 Robin (E), 669 hl201 Reindeer in snow (N), **672 hl207 Gingerbread house (H, the new fifth Hard, 7
  colours)**, 674 hl211 Candy cane (N; hl007 at 658), 675 hl202 Snowman with hat (E).
- Moat probe: hl206 100%, hl207 21-23%, hl202 15-17%, hl213 hl208 hl211 2-3% (kept: all dealt in the bake); hl201 hl203 hl209 can't.
- Bake: all 10 slots ok first time. Rates: 659 70.5%, 660 41.8%, 661 43.8%, 663 33.2%, 668 78.5%, 669 36.5%, 672 19.2%, 674 39.5%,
  675 61.0%, 651 42.0%. **Too-easy watch: none failed; no refill candidate reached 100%.**
- As baked: Easy mean 66.9% (57.5-78.5), Normal 37.9% (31.2-43.8), Hard 15.2% (8.8-19.2); careful 1.0; pace 153-263 s, median 216
  s; 11 rings. Hards 658 hl007, 667 hl013b, 672 hl207, 679 hl030, 684 hl022.
- Pre-read of the refills: **hl213 Robin: red specks scattered over the white ground could read as blood spatter (strongest
  flag; a robin was on lane C's own left-out list)**; hl201 Reindeer in snow is antlers over dark trees (mild); hl208 Sleigh's Santa
  is a pale blob; the rest read. Duplicate titles: "Candy cane" hl007/hl211.
- Shots: `tools/shots-land-16/` re-taken with `tools/shots-land-16.mjs` on the new numbering (12 -> 13 join at 499/500, mid,
  top 524-534 with the fog, map at 1280, opener and win), `contact-installed.jpg` (`--world 13 --zen-from 500`); 0 console; fit
  at 375 with 534 nodes unchanged (tightest 222, closest 56.5 px).

Brief: the orchestrator's refill rework (2026-10-13, head 7cabc57): lane C's combined refill batch (workspace a0bad2b,
real-setting portraits, ids x2NN, interleaved through Worlds 11-13), with two follow-ups folded in: critic-land-14's fixes (6
drops, ct045 ringless) and critic-land-16's (close on a Hard that reads, hl002b ringless). Not pushed; no image model run; the
untracked 17/18/19 land folders (other builders') left alone. All three worlds were reworked in one pass. Commits on
`sappers-path`: `182dda2` (the three land folders), `50f3e93` (reinstall), `4a7ea9b` (freeze), then these notes.

**Method (Farm Friends' refill, tools/lands/17-farm-friends/scratch/phase1.md).** `handoff-full.js` on lane C's latest; the
manifest lines replaced whole (no old line changed, url filled as before); `src/` wiped and re-prepped (pixels equal to the
hand-off's; 3 old sources whose PNG bytes differed with equal pixels kept at their committed bytes); `prep` + `convert` identical
to boards-full. The new tags are `landTags(N)` on the unchanged shares. The kept boards' old tag string embeds in them in order
(scratch embed.py: each kept board on a slot of its own tag, the gaps nearest lane C's suggested places), so every kept board
keeps its tag, plan entry and bake: its `scratch/bake/m-N.json` and `cands/` moved to its new number with `n` set (seeds are
stored per record; scratch carry.js; the pre-refill scratch is in `scratch/r-prerefill/`). The refills fill the gaps, placed
away from same-titled or look-alike boards; their slots take a fresh land-plan's entries (moat can = the ring check with
moatSkip). Refills moat-probed (`scratch/probe-refill.log`); only the refill slots and the two critic ring fixes baked (`bake
--keep-plan --list ... --shard 2`). Proof: every kept board's out/ record is identical to its pre-refill record in every field
but `n` and `id` (Cloud 25 of 25, Clockwork 25 of 26, Holiday 25 of 26; the one each is the ringless re-bake).

**Gates (the shared final tree).**

| Gate | Result |
|---|---|
| land.js check (x3) | PASS every gate: Cloud 586-616 median 211 s, 7 rings; Clockwork 617-649 median 211 s, 12 rings; Holiday 650-684 median 216 s, 11 rings |
| test.js | **722 passed, 0 failed** (shipped 14,452,362 B, 83 files; untracked 17/18/19 land folders present) |
| freeze --require | before the snapshot: 0 differences everywhere except 77 shipped records of the reworked worlds (z11-7..25, all of z12 and z13; as Worlds 10/11's round 2); after: **PASS**, zen.json 484 / 4,356, shipped 796, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 4,356; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 4,356 |
| pack.js --check | the shipped files match the source |
| selfTest (selftest-lands.mjs) | **912/0 at 375x812@3, 914/0 at 1280x720, 912/0 at 360x640 (--small)**, 0 console |
| space-v7/check.mjs | **55 ok, 0 FAIL** (OLD = e072a9d via `OLD_DIR`): "0 of 546 pictures", 534 nodes from the index, sweeps z11-1 z12-1 z13-1 at 375 and 1280. The first run's Campaign byte count read short (audio cut off under 7 parallel node gates); re-run clean |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 912/0 or 914/0 in every viewport and the hidden tab, 0 console (`tools/shots-land-16/harness-refill/`) |

**Byte-identity.** zen.json: every top-level key but `worlds`/`levels` identical to 7cabc57's; Worlds 1-10 entries and their 385
records identical (468 -> 484 records); Worlds 11-13 entries changed only in `map`. levels/: zen-1..zen-10.pk.json and every other
packed file byte-identical (only zen-11/12/13 and the index changed); the index's Worlds 1-10 entries and other keys identical.
LICENSES.md byte-identical up to the World 11 heading; the three sections rewritten (31 / 33 / 35 rows, Zen 436-466 / 467-499 /
500-534). Frozen zen.json: Worlds 1-10 and their 385 records identical, the whole equal to build-data's; frozen.json's `made`
date rewrite reverted.

**Payload.**

| | 7cabc57 | this build | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 14,423,791 B (83 files) | **14,452,362 B** (83 files) | **+28,571 B** |
| levels/zen-11 / zen-12 / zen-13.pk.json | 27,740 / 39,260 / 29,960 | 35,432 / 42,726 / 42,730 | +7,692 / +3,466 / +12,770 |
| levels/zen.pk.json (the index) / LICENSES.md | 67,656 / 166,930 | 68,991 / 170,238 | +1,335 / +3,308 |
| map/ | | | **0** |
| Bytes before the first tap (375x812 cold load) | 1,947,977 B | **1,949,312 B** | +1,335 |

Against e072a9d (v6.7, live): shipped +375,484 B, first tap +58,824 B. 19 MB gate: **4.55 MB of room left**. Cache tag `?v=83`.

**End state for the next land (Farm Friends).** Last record **684**, last sheet **90** (Cloud 78-81, Clockwork 82-85, Holiday
86-90), gal0 **62**; Zen numbers end at **534**, 484 records in zen.json. Seed `{from: 685, sheet0: 91, gal0: 62}` (Farm's
phase-1 seed had sheet0 90: one more sheet now, from Holiday's fifth).

The sections below are earlier rounds' record; where this round changed a number, this section has it.

## Install (2026-10-13)

Brief: the orchestrator's lane D brief of 2026-10-13 (lane C's Holiday Lights as Zen World 13, in two phases: phase 1 in the
land folder only while Worlds 10-12 were installed in the same worktree, phase 2 after Clockwork's 9c1aa71; local only, never
pushed; no image model run; Peter approved the world order and the unattended run). Inputs (lane C's, read only):
`game-research/sappers-path-v4/lands/16-holiday-lights/` (README, `picks-full.json`, `boards-full/`, `scripts/handoff-full.js`),
sources `/Users/peter/local-ai/outputs/lands/16-holiday-lights/fullsrc/` (an edited picture keeps its id, its file `<id>e.png`).
Method: Clockwork Town's (`tools/land-14-notes.md`). Commits on `sappers-path`: `5242680` (land folder), `f036694` (install),
`e6b3c49` (freeze), then these notes.

Records n **643-668** (Land 12 in the factory's numbering, era 20 = 8 + 12, ids z13-1..z13-26, world 13), shown on the page as
Zen pictures **493-518** (main.js zenNum: Worlds 1-12 hold 1-492). `scratch/state.json` seeded `{from: 643, sheet0: 86, gal0:
62}`, the end state 9c1aa71 left (last record 642, World 12's 4 sheets ending at 85, gallery 62, no side quests). The sheet
numbers don't ship.

### 1. Three rounds of picks (lane C's workspace 5bbfec1, then 2822569)

1. **31** (5bbfec1): `handoff-full.js` **43 of 43 identical**; `prep` + `convert` 31 of 31 identical to boards-full (sources
   byte-identical). Moat probe: 24 ring-capable, 4 never deal. Fresh bake (Clockwork's profile at 31, E11/N16/H4): 30 ok; 672
   hl021 Owl in snow failed: a random tapper won **100% on all 8** Normal candidates. Two-slot reorder (hl021 onto the 673 Hard,
   hl050 Winter cabin onto its Normal; `convert --force`, `bake --keep-plan --list 672,673 --extra 16 --shard 2`): hl050 ok,
   hl021 still **100% on all 26** Hard candidates. **Dropped** (lane C's rule: too easy is dropped, not swapped). Scratch in
   `scratch/phase1-31/`.
2. **30** (lane C's order less hl021, E11/N15/H4): fresh bake 30 ok, check PASS. Lane D's pre-read at about 375 px (9 px a
   cell) flagged hl048 Countdown (title-only: a brown blob), hl040b Gift wrap (a puppy in teal ribbon), hl020 Lantern (reads as
   a balloon), hl030 Clock midnight (the snow band breaks the lower face), milder hl042b hl050 hl009, and red reads: hl026b
   Sweater dog (a maroon patch under the mouth), hl001 (red specks on the snow). Scratch in `scratch/phase1-30/`.
3. **26** (2822569, this install): lane C dropped hl021, hl048, hl040b, hl020 and hl026b. Handoff **43 of 43 identical**; the 43
   lines replaced whole (no line changed, only their order); `src/` wiped and re-prepped, `prep` + `convert` **26 of 26
   identical** to boards-full, sources byte-identical.

- `pictures/manifest.json` = lane C's 43 landManifest lines **whole** (model, prompt, seed, size, raw, chroma, and on the edited
  ones `edit`), with `url` filled in Dino Valley's words: "Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed N; prompt
  in tools/lands/16-holiday-lights/pictures/manifest.json".
- `main` = lane C's landMain (26) with **one two-slot reorder**: slots 8 and 9 swapped (below). Closer hl030 Clock midnight (a Hard).
- All 26 boards 42x42, colours 4-7; 4-colour boards hl002b hl006 hl007 hl008 hl009 hl011 hl013b hl015 hl029. **12 of the 26 are
  edited** (a tighter crop, the plain background split into a navy sky band and a snow-white ground band); their licence rows
  carry "Adapted for the board by Click it! Studios: ...".

### 2. Moat probe

The Worlds 4-12 scratch script (`scratch/moat-probe.js`, 6 rings x 20 attempts a tag), run on the 31: **24 can carry a ring**.
**moatSkip 4**: hl007 Candy cane, hl008 Snowflake, hl009 Mitten, hl022 Fox in snow (0 of 360 each). The rest dealt 2-100% (hl014
3-7%, hl042b 2-4% kept; both baked fine). No new board in the 26, so no re-probe.

### 3. Bake (fresh plan for 26, then renumbered for install)

Profile = Clockwork's with tag shares E.35/N.50/H.15: the plan is **E9/N13/H4/X0, ending on a Hard** (the orchestrator's ask).
1. **Bake 1** (`--shard 2`, at 650-675): **25 ok**; 658 hl008 Snowflake (Hard) fallback: fast tapper (candidates 7-100%).
2. **`--keep-plan --list 658 --extra 16 --shard 2 --reuse`**: still fallback (20.3% vs 6-20%).
3. **Two-slot reorder**: hl007 Candy cane and hl008 Snowflake swapped (`convert --force`, `bake --keep-plan --list 657,658
   --extra 16 --shard 2`): both ok first time; Candy cane takes the Hard (16.0%), Snowflake plays Normal (37.5%).
4. **Renumbered, not re-baked** (phase 2): phase 1 was seeded at 650 on an older end state; Clockwork installed at 611-642, so
   the land starts at 643. Each `scratch/bake/m-N.json` and `scratch/cands/m-N.json` moved to `m-(N-7).json` with its `n`
   (the bake record's only field holding the number), `scratch/state.json` re-seeded `{from: 643, to: 668, sheet0: 86, gal0:
   62}` with the tags, plan and moat list kept (the 650 run in `scratch/r650/`); `convert map assemble check --force` PASS.
   Proof: all 26 out/ records identical in every field but `n` and `id`; the map layout identical but `n` (from/to) and the egg
   coins (drawn from a seed of the first level's number, as Worlds 9, 11 and 12's). A re-bake would have dealt new boards (a
   bake's seed comes from `n`), so none was run. sheet0 86 unchanged.

**Too-easy watch** (lane C named 11 four-colour boards): none failed in the 26. hl022 Fox in snow (663, Hard) had 2 of 7 graded
candidates at 100%, the pick 18.3%; hl008 Snowflake (650, Normal) 3 of 24 at 100%, the pick 37.5%; hl029 Sled (667, Normal) 1 of
8, the pick 36.5%; hl006 Gingerbread candidates up to 88%, the pick 35.3%. hl021 Owl in snow (above) was the one too-easy board.

### 4. The world as baked

- **Tags E9 / N13 / H4 / X0**, ending on a Hard (668 Clock midnight). Hards: 651 Candy cane, 656 Wreath, 663 Fox in snow,
  668 Clock midnight.
- Random-tap win rate: Easy mean **65.9%** (57.5-72.5, band 45-80), Normal **37.2%** (31.2-41.8, band 20-50), Hard **14.2%**
  (8.8-18.2, band 6-20). Careful player 1.0 at every tag.
- Real pace 153-240 s, **median 215 s** (the check's). Taps 41-55 (4 on the 55 cap). Longest tap 15.0 s at most.
- ? cards on 13 levels, linked squads on 10, **rings on 8** (644 649 653 656 658 664 666 667), **0 mystery blocks, 0 locks, 0
  archers, 0 Extreme, 0 fallbacks**. The plain Zen win line ("Christmas tree, all dug out.").

### 5. Map (lever 1: zero new image bytes)

The castle's forest sheets **19** and **20** (the Shrouded Weald), laid A, B, A', B' (**4 sheets** 86-89: 8 + 8 + 8 + 2 levels),
each under `grayscale(1) brightness(1.75) contrast(1.05) sepia(.3) hue-rotate(165deg) saturate(2)` (tools/map-plan-v7.md section
6): a snowy wood with blue-grey shadows, the glowing spots snowdrifts. No water, no bridges. Eggs per `eggTurns` on the two
quest spurs of each sheet (19 at (328,694) (98,536); 20 at (541,949) (639,455)): owl/glint, woodpile/ember, wisp/owl,
glint/owl. `map/` unchanged (31 image files). The top sheet holds only 2 levels (517-518); the fog sits after 518.

### 6. Words and credits

- Banner "World 13 · Holiday Lights" (the page builds it from zen.k and the name); lore: "The road winds into a snowy wood lit
  up for the winter holidays: twinkling trees and wrapped presents, snowmen and snow angels, penguins, foxes and polar bear
  cubs, cozy mittens and a crackling cabin, and a clock ticking down to a new year that everyone can join."
- **Credit line** exactly: "Holiday Lights: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it!
  Studios." on zen.json World 13 (`worldCredit`, the Zen map's foot after World 12's) and under the LICENSES.md heading.
- **LICENSES.md** "Zen World 13: Holiday Lights (Land 12, levels 643-668 ...)": the credit line, 26 rows keyed by Zen picture
  number then level (`zen.numbered`), the 12 edited rows with their note. "lane C" nowhere.

### 7. Byte-identity (proven)

- zen.json: every top-level key but `worlds`/`levels` identical to 9c1aa71's; Worlds 1-12 entries and the first 442 records
  JSON-identical; World 13 appended (442 -> 468 records, all world 13, era 20).
- levels/: zen-1..zen-12.pk.json and every other packed file byte-identical (only `zen.pk.json` modified, `zen-13.pk.json` new);
  the index's Worlds 1-12 entries and every other key identical. levels.json, gallery.json, places.json untouched.
- LICENSES.md: the old file (158,200 B) is a byte prefix of the new (166,930 B).
- Frozen set (`--snapshot`): frozen zen.json 442 -> 468 records, the old 442 and Worlds 1-12 identical, the whole equal to
  build-data's. `--snapshot` also rewrote frozen.json's `made` date (10-13 -> 10-14, UTC); reverted, so frozen.json is
  byte-identical. levels.json, gallery.json, castles.json snapshots untouched.

### 8. test.js and selfTest

- test.js: a "zen World 13" block (World 12's, for 26 at 643-668, era 20, sheets 19/20, 4 sheets, tint apart from Worlds 5-12,
  Zen 493-518, 12 edit rows, `edited.size >= 10`, easy + normal >= 0.84 (E9/N13/H4 at 26 is 0.846, as World 11); the 4 moatSkip
  pictures ringless, the phase-1 drops hl021 hl048 hl040b hl020 hl026b out of `main`, the closer hl030 a Hard); the world list,
  World 5's credit list and the D8 Zen-profile list grow by World 13 / `16-holiday-lights`. Passes with the untracked
  17-farm-friends, 18-safari and 19-naturalists-book folders present.
- selfTest (main.js): a "World 13" block as World 12's (records, map with castle sheets 19/20 under its tint on every image,
  first node 493 open, banner, fog, credits after World 12's, Christmas tree plays and wins with the plain line).
- check.mjs: "0 of 530 pictures"; the sweep loads z13-1.

### 9. Gates (final tree)

| Gate | Result |
|---|---|
| land.js check | PASS every gate (643-668 e20, median 215 s, 8 rings, Zen no mystery blocks, re-grade 0 of 234, map 48 px at 375, licences) |
| test.js | **722 passed, 0 failed** (shipped 14,423,791 B, 83 files; untracked 17/18/19 land folders present) |
| freeze --require | PASS before the snapshot (zen.json 442 / 3,978) and after: levels.json 2,405 checks, gallery.json 372, zen.json 468 / 4,212, shipped 780 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 4,212; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 4,212 |
| pack.js --check | the shipped files match the source |
| selfTest (selftest-lands.mjs) | **912/0 at 375x812@3, 914/0 at 1280x720, 912/0 at 360x640 (--small)**, 0 console |
| space-v7/check.mjs | **55 ok, 0 FAIL** (OLD = e072a9d via `OLD_DIR`): Zen card "0 of 530 pictures", 518 nodes from the index, sweep z13-1 at 375 and 1280 |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 912/0 or 914/0 in every viewport and the hidden tab, 0 console messages (`tools/shots-land-16/harness/`) |

Cache tag **`?v=82`** (index.html, style.css). No gate needed a re-run for a load spike.

### 10. Payload

| | 9c1aa71 (World 12) | this build | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 14,375,878 B (82 files) | **14,423,791 B** (83 files) | **+47,913 B** |
| levels/zen-13.pk.json (new) | | **29,960 B** | +29,960 |
| levels/zen.pk.json (the index) | 62,964 | 67,656 | +4,692 |
| LICENSES.md (World 13 section) / src/main.js (selfTest block) | | | +8,730 / +4,531 |
| map/ | | | **0** |
| Bytes before the first tap (home interactive, 375x812 cold load) | 1,938,754 B | **1,947,977 B** | +9,223 (the index, the code) |
| to the first Zen level (World 1's file) | 5,474,699 B | 5,483,922 B | +9,223 |

Against e072a9d (v6.7, live): shipped +346,913 B, first tap +57,489 B. World 13 packs to 1,152 B a level. 19 MB gate: **4.58 MB
of room left**.

### 11. Shots (tools/shots-land-16/, gitignored; `tools/shots-land-16.mjs` remakes them; notes.txt says what each shows)

- `map-join-375.png`: the World 12 -> 13 join at 375x812@3 (492 done on World 12's brass sheet, the World 13 banner on the snow
  sheet, 493 current "Play picture 493").
- `map-mid-375.png` (500-510), `map-top-375.png` (509-518 on the snow sheet, "More worlds on the way").
- `map-1280.png`: World 13 on desktop ("World 13 of 13", 9/26 cleared, 502 current, the lore on the realm card).
- `play-opener-375.png` (Christmas tree in play), `play-opener-mid-375.png`, `play-opener-1280.png`; `win-375.png` ("Picture
  done", "Christmas tree, all dug out.").
- `contact-installed.jpg`: the 26 as baked, numbered (`tools/land-contact.py tools/build-data/levels/zen.json 12 ... --world 13
  --zen-from 493 --cols 6`).
- Fit at 375 with all 518 Zen nodes: tightest number 222 (27 px in the disc's 28, unchanged), closest nodes 56.5 px (302-303).
  0 console messages.

### 12. Known for the critic

- Pre-read milder flags still in: 668 hl030 Clock midnight closer (the snow band breaks the lower face into a white/blue
  jumble; no hands at twelve read), 653 hl042b Snowman building (the three figures merge), 662 hl050 Winter cabin (a brown
  mass, the door the only cue), 652 hl009 Mitten (reads as a heart), 643 hl001 Christmas tree (red specks on the snow).
- No lettering; no look-alikes (the reindeer has no red nose, the snowman a Santa hat and scarf, no top hat or pipe; nothing
  Grinch-like; a generic nutcracker).
- The snow road on the snow sheets: the route's dashes carry it, but a white road on white ground is the critic's call at 375.
- The top sheet holds only 2 levels (517-518) before the fog.
- The desktop Next up card shows "Side quest 12" and the realm card an empty "Secrets found" line, as on Worlds 4-12 (LATER.md).

### 13. End state for the next land (Farm Friends)

Last record **668**, last sheet **89** (World 13's 4 sheets are 86-89), gal0 **62** (no side quests); Zen numbers end at
**518**, 468 records in zen.json. Seed `{from: 669, sheet0: 90, gal0: 62}`.
