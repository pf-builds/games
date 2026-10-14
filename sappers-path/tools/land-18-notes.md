# Zen World 15 Safari: v7 lane D

## Install (2026-10-13/14)

Brief: the orchestrator's lane D brief of 2026-10-13 (lane C's Safari as Zen World 15, in two phases: phase 1 in the land folder
only while Worlds 11-14 were installed and reworked in the same worktree, phase 2 after Farm Friends' a1c84d3; local only, never
pushed; no image model run; Peter approved the world order and the unattended run). Inputs (lane C's, read only):
`game-research/sappers-path-v4/lands/18-safari/` (README, `picks-full.json`, `boards-full/`, `scripts/handoff-full.js`), sources
`/Users/peter/local-ai/outputs/lands/18-safari/fullsrc/`. Method: Farm Friends' (`tools/land-17-notes.md`). Commits on
`sappers-path`: land folder, install, freeze, then these notes.

Records n **728-766** (Land 14 in the factory's numbering, era 22 = 8 + 14, ids z15-1..z15-39, world 15), shown on the page as
Zen pictures **578-616** (main.js zenNum: Worlds 1-14 hold 1-577). `scratch/state.json` seeded `{from: 728, sheet0: 97, gal0:
62}`, the end state a1c84d3 left (last record 727, World 14's 6 sheets ending at 96, gallery 62, no side quests). The sheet
numbers don't ship.

### 1. Five rounds of picks (lane C's workspace 35e0c62, 327104f/fd4671d, a0bad2b, 80b23ee)

Each round: `handoff-full.js` on lane C's latest, `pictures/manifest.json` replaced **whole** with lane C's landManifest lines
(url filled in Holiday's words: "Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed N; prompt in
tools/lands/18-safari/pictures/manifest.json"), `src/` wiped and re-prepped (pixels equal to the hand-off's), `prep` +
`convert --force` identical to boards-full. Every round's scratch is kept in `scratch/phase1-<N>/`; `scratch/phase1.md` logs
each round.

1. **38** (35e0c62; 22 portraits in real settings, 16 scenes on real backgrounds): handoff **50/50**, convert 38/38. Moat probe:
   26 ring-capable, 10 never deal. Fresh bake (E14/N19/H5): 34 ok; sf014 Baby elephant (Easy) 87-100%, sf020 Pelican (Normal)
   100% on 8 of 8, sf021 Buffalo (Hard, 4 colours) 100% on 10 of 10, sf050 Hot-air balloon fast tapper. Two two-slot reorders
   (sf020 to a Hard with links and ? cards; sf021 to the last Hard with a ring too) and `--extra 16`/`--extra 40`: Buffalo 99-100%
   on 24 of 25, Pelican's fast tapper beat all 50 candidates. No same-subject spares (lane C's spares are scene re-seeds):
   **both dropped**. Re-plan for 36 (E13/N18/H5), fresh bake: 35 ok, sf014 ok on `--extra 16`; check PASS. Pre-read at about
   375 px (9 px a cell): mud or title-only sf029 Zebra crossing, sf035 Monkey swing, sf036 Croc and bird, sf041b Elephant family,
   sf019 Okapi, sf048 Pelican catch; look-alikes sf047b Baboon on a rock (Rafiki on Pride Rock), sf017 Warthog and sf013 Lion
   cub (milder); red: sf009 Meerkat's red desert ground, maroon patches on sf016 Leopard and sf015 Toucan (no wounds or kills).
2. **28** (fd4671d): lane C dropped those 6 muddy scenes, the Baboon and the Warthog (with a lion it nears the Lion King
   pairing); Meerkat, Lion cub, Leopard and Toucan kept. Handoff **45/45**. The 28 kept boards' tags were exactly
   `landTags(28)`'s E10/N14/H4, so each tag's pictures fill the pattern in lane C's order (every picture within 3 slots of its
   place) and every board keeps its plan entry; the 36 run's candidates copied to the new numbers: **0 new candidates, all 28
   picks identical**.
3. **42** (a0bad2b): lane C's 14 refill portraits in a real setting (ids sf2NN), interleaved. Handoff **59/59**. Per tag, a
   monotone least-displacement match put the 28 on their tag's slots of `landTags(42)` (E15/N22/H5) nearest lane C's places
   (`scratch/arr42.json`); the refills took the rest in lane C's order on a fresh land-plan's entries for those slots. Refill
   moat probe: sf204 Zebra foal never deals (moatSkip). Only the 14 refill slots baked: sf204 dealt nothing in 96 attempts on any
   candidate as a Normal with ? cards; swapped with sf203 Giraffe pair (sf204 Easy, no features: ok on `--extra 16`, 6 of 24
   candidates dealing). Pre-read of the 14: **sf216 "Lioness and cub" is a maned lion nuzzling a cub at sunset** (Mufasa and
   Simba); sf220 Crowned crane (red cheek reads as a smear) and sf208 Flamingo pair (the second bird a speck) muddy; sf218
   Giraffe smile and sf215 Hornbill generic.
4. **39** (80b23ee, this install): lane C dropped sf216, sf220 and sf208. Handoff **59/59**. The 39's tags in the 42 bake were
   exactly `landTags(39)`'s E14/N20/H5: the same per-tag fill in lane C's order (`scratch/arr39.json`), every plan entry kept,
   **0 new candidates, all 39 picks identical** to the 42 run's.

Seeds on the way: 710 (the brief), 703 (Farm 34), 729 (the 42), 728 (final). Phase 2: sheet0 94 -> 97 (the earlier worlds grew
in their rework). `map assemble check --force`: the 39 out/ records and licence rows byte-identical to the sheet0-94 run; the map
layout identical but each sheet's number and the entry's `sheets` span (`scratch/r-sheet94/`); **no re-bake**.

### 2. Moat probe

The Worlds 4-14 scratch script (`scratch/moat-probe.js`, 6 rings x 20 attempts a tag, run on 6 threads; `probe.log`, `probe42.log`).
**moatSkip 7**: sf003 Giraffe, sf026 Elephant shower, sf027 Giraffe snack, sf013 Lion cub, sf046b Zebra herd, sf204 Zebra foal
(0/120 every tag), sf009 Meerkat (1/360). 27 of the 39 can carry a ring by shape; less the 7, 20 can take one and 15 do;
sf008 Gorilla and sf022 Hyena deal 1-3% and still carry theirs.

### 3. The world as baked

- **Tags E14 / N20 / H5 / X0**, ending on a Hard (766 Hot-air balloon). Hards: 736 sf205 Hippo calf, 745 sf013 Lion cub, 752
  sf040 Giraffe at sunset, 759 sf023 Chameleon, 766 sf050 Hot-air balloon.
- Random-tap win rate: Easy mean **67.8%** (58.2-79.8, band 45-80), Normal **37.9%** (28.7-47.0, band 20-50), Hard **13.4%**
  (9.0-17.8, band 6-20). Careful player 0.81 or more at every level (floor 0.5).
- Real pace 178-271 s, **median 215 s**. Taps 44-55 (11 on the 55 cap). Longest tap 15.0 s at most.
- ? cards on 19 levels, linked squads on 13, **rings on 15** (728 731 738 739 740 741 742 750 751 754 756 759 761 765 766),
  **0 mystery blocks, 0 locks, 0 archers, 0 Extreme, 0 fallbacks**. The plain Zen win line ("Lion, all dug out.").
- **Too-easy watch:** none failed after the two drops. 744 sf009 Meerkat and 728 sf001 Lion (4 colours, Normal) 39.3% and 37.8%;
  borderline Easies 748 sf014 Baby elephant 75.3% (20 of 24 candidates at 82-100%), 762 sf046b Zebra herd 79.8% (one graded
  candidate), 750 sf209 Gorilla baby 73.3%, 764 sf025 Vulture 73.5%. 737 sf204 Zebra foal is a stingy dealer (18 of 24
  candidates no deal).

### 4. Map (lever 1: zero new image bytes)

Castle sheet **23** (dry open ground, scrub, rocks and a hut cluster) and the Mistmoor sheet **13** (its pools as waterholes;
Cloud Kingdom's too, four worlds back under the opposite pale-sky tint), laid A, B, A', B', A (**5 sheets** 97-101: 8 + 8 + 8 +
8 + 7), each under `sepia(.6) saturate(1.9) hue-rotate(2deg) brightness(1.15) contrast(1.05)` (tools/map-plan-v7.md section 8):
golden tan, 13's pools olive-khaki. The plan's 22/23 fallback (only if 13's two worlds sat next to each other) not needed. Eggs per
`eggTurns` on two quest spurs of each sheet (23 at (587,808) (300,430); 13 at (637,1101) (352,293), the far-apart pair of its
three): grass/raven, reeds/fish, glint/grass, bubble/reeds, raven/glint. `map/` unchanged (31 image files). The top sheet holds
7 levels (610-616); the fog sits after 616.

### 5. Words and credits

- Banner "World 15 · Safari"; lore: "The road heads out onto the warm savanna, where lions doze, elephants splash at the
  waterhole, giraffes nibble the treetops and zebras, rhinos and hippos go about their day under a big golden sky."
- **Credit line** exactly: "Safari: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it! Studios." on
  zen.json World 15 (`worldCredit`, the Zen map's foot after World 14's) and under the LICENSES.md heading.
- **LICENSES.md** "Zen World 15: Safari (Land 14, levels 728-766 ...)": the credit line, 39 rows keyed by Zen picture number then
  level (`zen.numbered`). No edited picture. "lane C" nowhere. Titles all different.

### 6. Byte-identity (proven)

- zen.json: every top-level key but `worlds`/`levels` identical to a1c84d3's; Worlds 1-14 entries and the first 527 records
  JSON-identical; World 15 appended (527 -> 566 records, all world 15, era 22, z15-1 n 728 .. z15-39 n 766).
- levels/: every packed file byte-identical but `zen.pk.json` (modified) and `zen-15.pk.json` (new); the index's Worlds 1-14
  entries and every other key identical. levels.json, gallery.json, places.json untouched.
- LICENSES.md: the old file (181,117 B) is a byte prefix of the new (190,734 B).
- Frozen set: `freeze --require` PASS before the snapshot (zen.json 527 / 4,743, 0 differences); `--snapshot`: frozen zen.json
  527 -> 566 records, the old 527, Worlds 1-14 and every other key identical, the whole equal to build-data's. `--snapshot`
  rewrote frozen.json's `made` date (10-13 -> 10-14); reverted, so frozen.json is byte-identical.

### 7. test.js and selfTest

- test.js: a "zen World 15" block (World 14's, for 39 at 728-766, era 22, sheets 23/13, 5 sheets, tint apart from Worlds 5-14,
  Zen 578-616, no edited rows, easy + normal >= 0.87 (E14/N20/H5 at 39 is 0.872); the 7 moatSkip pictures ringless, the 13
  dropped pictures out of `main`, the closer sf050 a Hard); the world list, World 5's credit list and the D8 Zen-profile list grow
  by World 15 / `18-safari`. Passes with the untracked 19-naturalists-book folder present (its land.json still has `zenPhase2`,
  so the D8 list leaves it out).
- selfTest (main.js): a "World 15" block as World 14's (records, map with castle sheets 23/13 under its tint on every image, first
  node 578 open, banner, fog, credits after World 14's, Lion plays and wins with the plain line).
- check.mjs: "0 of 628 pictures"; the sweep loads z15-1.

### 8. Gates (final tree)

| Gate | Result |
|---|---|
| land.js check | PASS every gate (18 of 18 with the Zen gate; 728-766 e22, median 215 s, 15 rings, re-grade 0 differences, map 48 px at 375, licences) |
| test.js | **724 passed, 0 failed** (shipped 14,612,185 B, 85 files; untracked 19-naturalists-book present) |
| freeze --require | PASS before the snapshot (zen.json 527 / 4,743, 0 differences) and after: levels.json 2,405 checks, gallery.json 372, zen.json 566 / 5,094, shipped 878 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 5,094; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 5,094 |
| pack.js --check | the shipped files match the source |
| selfTest (selftest-lands.mjs) | **920/0 at 375x812@3, 922/0 at 1280x720, 920/0 at 360x640 (--small)**, 0 console |
| space-v7/check.mjs | **59 ok, 0 FAIL** (OLD = e072a9d via `OLD_DIR`): Zen card "0 of 628 pictures", 616 nodes from the index, sweep z15-1 at 375 and 1280 |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 920/0 or 922/0 in every viewport and the hidden tab, 0 console (`tools/shots-land-18/harness/`) |

No gate needed a re-run for a load spike. (The two combined-flag regrades were first run with their flags fused into one argument,
zsh not splitting `$a`, and ran the plain set; re-run with the flags apart, as above.)

Cache tag **`?v=85`** (index.html, style.css).

### 9. Payload

| | a1c84d3 (World 14) | this build | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 14,529,647 B (84 files) | **14,612,185 B** (85 files) | **+82,538 B** |
| levels/zen-15.pk.json (new) | | **62,893 B** | +62,893 |
| levels/zen.pk.json (the index) | 75,617 | 81,109 | +5,492 |
| LICENSES.md (World 15 section) / src/main.js (selfTest block) | 181,117 / 475,708 | 190,734 / 480,244 | +9,617 / +4,536 |
| map/ | | | **0** |
| Bytes before the first tap (home interactive, 375x812 cold load) | 1,960,471 B | **1,970,499 B** | +10,028 (the index, the code) |
| to the first Zen level (World 1's file) | 5,496,416 B | 5,506,444 B | +10,028 |

Against e072a9d (v6.7, live): shipped +535,307 B, first tap +80,011 B (1,890,488 -> 1,970,499). World 15 packs to 1,613 B a
level. 19 MB gate: **4.39 MB of room left**.

### 10. Shots (tools/shots-land-18/, gitignored; `tools/shots-land-18.mjs` remakes them; notes.txt says what each shows)

- `map-join-375.png`: the World 14 -> 15 join at 375x812@3 (576-577 done on World 14's green sheet, the World 15 banner on the
  golden savanna sheet, 578 current "Play picture 578").
- `map-mid-375.png` (594-602), `map-top-375.png` (609-616 on the savanna sheet, "More worlds on the way").
- `map-1280.png`: World 15 on desktop ("World 15 of 15", 9/39 cleared, 587 current, the lore on the realm card).
- `play-opener-375.png` (Lion in play), `play-opener-mid-375.png`, `play-opener-1280.png`; `win-375.png` ("Picture done", "Lion,
  all dug out.").
- `contact-installed.jpg`: the 39 as baked, numbered (`tools/land-contact.py tools/build-data/levels/zen.json 14 ... --world 15
  --zen-from 578 --cols 6`).
- Fit at 375 with all 616 Zen nodes: tightest number 222 (27 px in the disc's 28, unchanged), closest nodes 56.5 px (302-303).
  0 console messages.

### 11. Known for the critic

- Same-subject neighbours from lane C's interleave and the tag-keeping fill: 731 Elephant calf and 732 Elephant shower; 734
  Giraffe pair and 735 Giraffe snack (both red-orange giraffes); 749 Gorilla snack and 750 Gorilla baby; 757 Hornbill and 758
  Toucan tree (751 Toucan near). Two cheetahs (739, 742), five elephants, five giraffes, three hippos, two zebras plus a herd and a
  foal, titled apart.
- Pre-read flags still in, mild: 735 sf027 Giraffe snack (the giraffe goes red-orange, branches merge), 762 sf046b Zebra herd
  (stripes merge with the trees), 739 sf007 Cheetah (busy face), 747 sf011 Crocodile (reads a little like a frog), 731 sf202
  Elephant calf (ears blend into the bank), 754 sf210 Kudu (busy, dark maroon lower right), 744 sf009 Meerkat (a flat red desert
  ground; lane C kept it), 755 sf016 Leopard and 751 sf015 Toucan (maroon patches, not blood).
- Look-alikes: 745 sf013 Lion cub (generic, Simba-adjacent; lane C kept it) beside 728 Lion. The Rafiki, Pumbaa and
  Mufasa-and-Simba boards are out.
- The desktop Next up card shows "Side quest 12" and the realm card an empty "Secrets found" line, as on Worlds 4-14 (LATER.md).

### 12. End state for the next land (The Naturalist's Book)

Last record **766**, last sheet **101** (World 15's 5 sheets are 97-101), gal0 **62** (no side quests); Zen numbers end at
**616**, 566 records in zen.json. Seed `{from: 767, sheet0: 102, gal0: 62}`.
