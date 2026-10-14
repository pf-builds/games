# Zen World 14 Farm Friends: v7 lane D

## Install (2026-10-13/14)

Brief: the orchestrator's lane D brief of 2026-10-13 (lane C's Farm Friends as Zen World 14, in two phases: phase 1 in the land
folder only while Worlds 10-13 were installed and reworked in the same worktree, phase 2 after the Worlds 11-13 refill's
8e4fc93; local only, never pushed; no image model run; Peter approved the world order and the unattended run). Inputs (lane C's,
read only): `game-research/sappers-path-v4/lands/17-farm-friends/` (README, `picks-full.json`, `boards-full/`,
`scripts/handoff-full.js`), sources `/Users/peter/local-ai/outputs/lands/17-farm-friends/fullsrc/`. Method: Holiday Lights'
(`tools/land-16-notes.md`). Commits on `sappers-path`: `b5e019b` (land folder), `ceef55e` (install), `b8f0e9b` (freeze), then
these notes.

Records n **685-727** (Land 13 in the factory's numbering, era 21 = 8 + 13, ids z14-1..z14-43, world 14), shown on the page as
Zen pictures **535-577** (main.js zenNum: Worlds 1-13 hold 1-534). `scratch/state.json` seeded `{from: 685, sheet0: 91, gal0:
62}`, the end state 8e4fc93 left (last record 684, World 13's 5 sheets ending at 90, gallery 62, no side quests). The sheet
numbers don't ship.

### 1. Five rounds of picks (lane C's workspace 35e0c62, 2ce4b22, 6e61320, a0bad2b, b554176)

Each round: `handoff-full.js` on lane C's latest, `pictures/manifest.json` replaced **whole** with lane C's landManifest lines
(url filled in Dino Valley's words: "Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed N; prompt in
tools/lands/17-farm-friends/pictures/manifest.json"), `src/` wiped and re-prepped (pixels equal to the hand-off's), `prep` +
`convert --force` identical to boards-full. Every round's scratch is kept in `scratch/phase1-<N>/`.

1. **41** (35e0c62; 22 portraits, 19 scenes, 16 on real farm backgrounds): handoff **53/53**, convert 41/41. Moat probe: 35
   ring-capable, 9 never deal. Fresh bake (E15/N21/H5): 38 ok; 669 ff001 Cow too slow (~500 s on every candidate), 680 ff107
   Horse in a field (Hard) and 690 ff119 Cow and calf (Normal) 100% on nearly every candidate. Two two-slot reorders and
   `--extra 16`: all ok, check PASS. Pre-read at about 375 px (9 px a cell) flagged mud or title-only boards (ff105 ff110 ff114
   ff121 ff119 ff129 ff044b ff046 "Apple tree" that showed a horse), red that reads as blood (ff022b Pig in mud strongest, ff121,
   ff002b) and four horse-like boards.
2. **35** (2ce4b22): lane C dropped ff022b ff121 ff002b ff114 ff119 ff129, swapped ff105 -> ff038b, ff044b -> ff044, ff046 ->
   ff034b, ff110 -> ff032b. Handoff **56/56**. Fresh bake (E13/N18/H4): 31 ok; 669 ff001 slow again, 673 ff103 no deal in 96
   attempts, 675 ff038b fast tapper, 679 ff107 100% on all 8. One reorder (ff107 to Easy, ff106 Duck pond to the Normal ? cards,
   ringless) and `--extra 16`: all ok.
3. **34** (6e61320): ff044 Piglet nap (the Hard, still mush) dropped; ff034b retitled "Woolly sheep", ff032b "Hen on her nest".
   `landTags(34)` is the 35's pattern less one Normal, so ff106 moved into ff044's Hard on ff044's plan entry (? cards, no ring),
   everything else kept its plan and bake (`scratch/carry34.py`); only 695 ff106 baked (9.2%).
4. **44** (a0bad2b): lane C's 10 refill portraits in a real setting (ids ff2NN). The 34's tag string embeds in `landTags(44)`
   (E16/N23/H5) in order (`scratch/embed44.py`, nearest lane C's suggested places 4, 8, ... 40; none without some refills side
   by side), so every kept board keeps its tag, plan entry and bake (`scratch/carry44.js`: bake records renamed with `n` set;
   seeds are stored per record); the refills fill the gaps, placed apart from look-alikes, on a fresh land-plan's entries for
   those slots. Refill moat probe: ff205 Duck by the pond never deals (moatSkip). Only the 10 refill slots baked: all ok first
   time.
5. **43** (b554176, this install): ff204 Horse by a tree dropped (a fifth horse-like board); four retitles (ff211 Calf in the
   meadow, ff207 Donkey in the wheat, ff212 Barn owl at dusk, ff210 Fluffy alpaca), boards unchanged. Handoff **66/66**.
   `landTags(43)` is the 44's pattern less its Normal at slot 16, so ff207 moved into the Normal ff204 left and ff205 into
   ff207's (`scratch/carry43.py`): **nothing re-baked**. No duplicate titles left.

Phase 2: seed sheet0 90 -> 91 (Holiday's fifth sheet). `map assemble check --force`: the 43 out/ records identical to the
sheet0-90 run, the map layout identical but each sheet's number (`scratch/r-sheet90/`); no re-bake.

### 2. Moat probe

The Worlds 4-13 scratch script (`scratch/moat-probe.js`, 6 rings x 20 attempts a tag, run on 8 threads), re-run each round.
**moatSkip 8**: ff101 Pig mud puddle (deals only at Easy, 4/120), ff038b Goat on a roof, ff009 Donkey, ff205 Duck by the pond,
ff118 Horse and foal, ff017 Calf, ff034b Woolly sheep (0/120 each), ff106 Duck pond (1/120). 36 of the 43 can carry a ring.

### 3. The world as baked

- **Tags E16 / N22 / H5 / X0**, ending on a Hard (727 Sunflower). Hards: 696 ff011b Bunny, 704 ff017 Calf, 713 ff206 Rooster
  at sunrise, 720 ff106 Duck pond, 727 ff030b Sunflower.
- Random-tap win rate: Easy mean **66.4%** (56.2-73.8, band 45-80), Normal **37.8%** (30.2-48.5, band 20-50), Hard **12.2%**
  (9.2-16.5, band 6-20). Careful player 0.69 or more at every level (floor 0.5).
- Real pace 163-278 s, **median 215 s**. Taps 40-55 (6 on the 55 cap). Longest tap 15.0 s at most.
- ? cards on 19 levels, linked squads on 16, **rings on 12** (694 697 699 700 701 706 708 711 712 715 724 727), **0 mystery
  blocks, 0 locks, 0 archers, 0 Extreme, 0 fallbacks**. The plain Zen win line ("Cow, all dug out.").
- **Too-easy watch:** none failed. 705 ff210 Fluffy alpaca (4 colours, Easy) had 6 of 8 candidates at 100%, the pick 72.0%;
  714 ff126 Turkey strut 1 of 8 at 100%, the pick 67.8%. 11 of lane C's first boards were 4-colour flat animals; the ones that
  stayed bake in band.

### 4. Map (lever 1: zero new image bytes)

The castle's Goblin King's Throne sheets **22** and **24**, laid A, B, A', B', A, B (**6 sheets** 91-96: 8 + 7 + 8 + 7 + 8 + 5
levels; 24 holds 7 spots), each under `sepia(.3) hue-rotate(48deg) saturate(1.7) brightness(1.15) contrast(1.04)`
(tools/map-plan-v7.md section 7): pasture green, the thatched huts read as farmsteads, a blue-green strip of water at 22's bottom.
The painted road shares the ground's hue on these sheets and turns **pale mint**; at 375 it stays lighter than the pasture and
the route's dashes and nodes read over it (phase-1 check `scratch/tint375.html`, and `map-join-375.png`). Eggs per `eggTurns`
on the two quest spurs of each sheet (22 at (561,791) (623,533); 24 at (380,1070) (150,485)): kitten/grass, woodpile/mushrooms,
butterfly/kitten, raven/kitten, grass/butterfly, woodpile/mushrooms. `map/` unchanged (31 image files). The top sheet holds 5
levels (573-577); the fog sits after 577.

### 5. Words and credits

- Banner "World 14 · Farm Friends"; lore: "The road rolls out to a friendly farm: cows, pigs and sheep, ducks on the pond, a goat
  on the roof and a pony in the field, a red barn and a tractor, a scarecrow in the corn and sunflowers along the fence."
- **Credit line** exactly: "Farm Friends: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it! Studios."
  on zen.json World 14 (`worldCredit`, the Zen map's foot after World 13's) and under the LICENSES.md heading.
- **LICENSES.md** "Zen World 14: Farm Friends (Land 13, levels 685-727 ...)": the credit line, 43 rows keyed by Zen picture
  number then level (`zen.numbered`). No edited picture. "lane C" nowhere.

### 6. Byte-identity (proven)

- zen.json: every top-level key but `worlds`/`levels` identical to 8e4fc93's; Worlds 1-13 entries and the first 484 records
  JSON-identical; World 14 appended (484 -> 527 records, all world 14, era 21).
- levels/: every packed file byte-identical but `zen.pk.json` (modified) and `zen-14.pk.json` (new); the index's Worlds 1-13
  entries and every other key identical. levels.json, gallery.json, places.json untouched.
- LICENSES.md: the old file (170,238 B) is a byte prefix of the new (181,117 B).
- Frozen set (`--snapshot`): frozen zen.json 484 -> 527 records, the old 484, Worlds 1-13 and every other key identical, the
  whole equal to build-data's. `--snapshot` rewrote frozen.json's `made` date (10-13 -> 10-14, UTC); reverted, so frozen.json
  is byte-identical.

### 7. test.js and selfTest

- test.js: a "zen World 14" block (World 13's, for 43 at 685-727, era 21, sheets 22/24, 6 sheets, tint apart from Worlds 5-13,
  Zen 535-577, no edited rows, easy + normal >= 0.88 (E16/N22/H5 at 43 is 0.884); the 8 moatSkip pictures ringless, lane D's
  drops and swapped-out pictures out of `main`, the closer ff030b a Hard); the world list, World 5's credit list and the D8
  Zen-profile list grow by World 14 / `17-farm-friends`. Passes with the untracked 18-safari and 19-naturalists-book folders
  present (their land.json still has `zenPhase2`, so the D8 list leaves them out).
- selfTest (main.js): a "World 14" block as World 13's (records, map with castle sheets 22/24 under its tint on every image,
  first node 535 open, banner, fog, credits after World 13's, Cow plays and wins with the plain line).
- check.mjs: "0 of 589 pictures"; the sweep loads z14-1.

### 8. Gates (final tree)

| Gate | Result |
|---|---|
| land.js check | PASS every gate (18 of 18 with the Zen gate; 685-727 e21, median 215 s, 12 rings, re-grade 0 differences, map 48 px at 375, licences) |
| test.js | **723 passed, 0 failed** (shipped 14,529,647 B, 84 files; untracked 18-safari and 19-naturalists-book present) |
| freeze --require | PASS before the snapshot (zen.json 484 / 4,356, 0 differences) and after: levels.json 2,405 checks, gallery.json 372, zen.json 527 / 4,743, shipped 839 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 4,743; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 4,743 |
| pack.js --check | the shipped files match the source |
| selfTest (selftest-lands.mjs) | **916/0 at 375x812@3, 918/0 at 1280x720, 916/0 at 360x640 (--small)**, 0 console |
| space-v7/check.mjs | **57 ok, 0 FAIL** (OLD = e072a9d via `OLD_DIR`): Zen card "0 of 589 pictures", 577 nodes from the index, sweep z14-1 at 375 and 1280 |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 916/0 or 918/0 in every viewport and the hidden tab, 0 console (`tools/shots-land-17/harness/`) |

No gate needed a re-run for a load spike. (Two combined-flag regrades were first launched with their flags fused into one
argument by the shell and ran the plain set; re-run with the flags apart, as above.)

Cache tag **`?v=84`** (index.html, style.css).

### 9. Payload

| | 8e4fc93 (Worlds 11-13 refill) | this build | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 14,452,362 B (83 files) | **14,529,647 B** (84 files) | **+77,285 B** |
| levels/zen-14.pk.json (new) | | **55,247 B** | +55,247 |
| levels/zen.pk.json (the index) | 68,991 | 75,617 | +6,626 |
| LICENSES.md (World 14 section) / src/main.js (selfTest block) | 170,238 / 471,175 | 181,117 / 475,708 | +10,879 / +4,533 |
| map/ | | | **0** |
| Bytes before the first tap (home interactive, 375x812 cold load) | 1,949,312 B | **1,960,471 B** | +11,159 (the index, the code) |
| to the first Zen level (World 1's file) | 5,485,257 B | 5,496,416 B | +11,159 |

Against e072a9d (v6.7, live): shipped +452,769 B, first tap +69,983 B (1,890,488 -> 1,960,471). World 14 packs to 1,285 B a
level. 19 MB gate: **4.47 MB of room left**.

### 10. Shots (tools/shots-land-17/, gitignored; `tools/shots-land-17.mjs` remakes them; notes.txt says what each shows)

- `map-join-375.png`: the World 13 -> 14 join at 375x812@3 (534 done on World 13's snow sheet, the World 14 banner on the green
  sheet, 535 current "Play picture 535").
- `map-mid-375.png` (550-559), `map-top-375.png` (570-577 on the green sheet, "More worlds on the way").
- `map-1280.png`: World 14 on desktop ("World 14 of 14", 9/43 cleared, 544 current, the lore on the realm card).
- `play-opener-375.png` (Cow in play), `play-opener-mid-375.png`, `play-opener-1280.png`; `win-375.png` ("Picture done", "Cow,
  all dug out.").
- `contact-installed.jpg`: the 43 as baked, numbered (`tools/land-contact.py tools/build-data/levels/zen.json 13 ... --world 14
  --zen-from 535 --cols 6`).
- Fit at 375 with all 577 Zen nodes: tightest number 222 (27 px in the disc's 28, unchanged), closest nodes 56.5 px (302-303).
  0 console messages.

### 11. Known for the critic

- Pre-read flags still in, mild: 694 ff201 Cow by the barn (barn red rings the cow's head), 713 ff206 Rooster at sunrise (a big
  red bird, maroon specks low right), 705 ff210 Fluffy alpaca (head and neck only, reads as a llama; a second alpaca with 711
  ff123), 697 ff032b Hen on her nest (no eggs show), 686 ff101 Pig mud puddle and 687 ff102 Hen on a fence (small subjects),
  714 ff126 Turkey strut (a brown fan blob).
- Look-alikes: four horse-like boards (692 ff008, 693 ff107, 703 ff118, 712 ff020b Mule); orange bovines 704 ff017 Calf, 709
  ff211 Calf in the meadow and 716 ff024b Ox; two barn owls (706 ff212 at dusk, 717 ff025) and two donkeys (695 ff009, 719
  ff207), titled apart. Refills side by side: 705-706, 709-710, 718-719.
- The road on these sheets is pale mint (map plan section 7).
- The desktop Next up card shows "Side quest 12" and the realm card an empty "Secrets found" line, as on Worlds 4-13 (LATER.md).

### 12. End state for the next land (Safari)

Last record **727**, last sheet **96** (World 14's 6 sheets are 91-96), gal0 **62** (no side quests); Zen numbers end at
**577**, 527 records in zen.json. Seed `{from: 728, sheet0: 97, gal0: 62}`.
