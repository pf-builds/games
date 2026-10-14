# Zen World 12 Clockwork Town: v7 lane D

## Install (2026-10-13)

Brief: the orchestrator's lane D brief of 2026-10-13 (lane C's Clockwork Town as Zen World 12, in two phases: phase 1 in the
land folder only while Worlds 10 and 11 were reworked in the same worktree, phase 2 after their round 2 commit 4248f5c; local
only, never pushed; no image model run; Peter approved the world order and the unattended run). Inputs (lane C's, read only):
`game-research/sappers-path-v4/lands/14-clockwork-town/` (README, `picks-full.json`, `boards-full/`, `scripts/handoff-full.js`),
sources `/Users/peter/local-ai/outputs/lands/14-clockwork-town/fullsrc/` (an edited picture keeps its id, its file `<id>e.png`).
Method: Cloud Kingdom's (`tools/land-13-notes.md`). Commits on `sappers-path`: `9cb06e2` (land folder), `71ae42e` (install),
`99a191c` (freeze), then these notes.

Records n **611-642** (Land 11 in the factory's numbering, era 19 = 8 + 11, ids z12-1..z12-32, world 12), shown on the page as
Zen pictures **461-492** (main.js zenNum: Worlds 1-11 hold 1-460). `scratch/state.json` seeded `{from: 611, sheet0: 82, gal0:
62}`, the end state 4248f5c left (last record 610, World 11's 4 sheets ending at 81, gallery 62, no side quests). The sheet
numbers don't ship.

### 1. Two rounds of picks (lane C's workspace dd1f134, then 7bd77d0)

1. **36** (dd1f134): `handoff-full.js` **48 of 48 identical**; `prep` + `convert` 36 of 36 identical to boards-full (sources
   byte-identical; `LAND_PYTHON` = the local-ai venv). Moat probe: 26 ring-capable, 4 never deal. Fresh bake (Cloud Kingdom's
   profile at 36, E13/N18/H5): 33 ok; 627 ct008b (steady rhythm), 638 ct017b (ringed, pace 143 s) and 641 ct045 (20.5%, fast
   tapper) ok with `--extra 16 --reuse`. One spare swap on the pre-read: ct010b Wind-up mouse (a maroon smear on red under the
   mouse, a blood read) to ct010 (the other seed), ringless (`--drop-moat`). Lane D's pre-read at about 375 px (9 px a cell)
   flagged ct023 Hourglass and ct014 Tin soldier (title-only, red smears that could read as blood), ct002b Little robot (close
   to an Among Us crewmate) and ct050 Gear garden (a snail, no gears). Too-easy: none failed. That round's scratch is in
   `scratch/phase1-36/` (its `phase1.md`, pre-read sheets in `preread/`).
2. **32** (7bd77d0, this install): lane C dropped those 4 and kept ct010. Handoff **48 of 48 identical**; the 48 lines replaced
   whole (no line changed, only their order); `prep` + `convert --force` **32 of 32 identical** to boards-full, sources
   byte-identical; the 4 old sources removed from `src/`.

- `pictures/manifest.json` = lane C's 48 landManifest lines **whole** (model, prompt, seed, size, raw, chroma, and on the edited
  ones `edit`), with `url` filled in Dino Valley's words: "Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed N; prompt
  in tools/lands/14-clockwork-town/pictures/manifest.json". No parodies.
- `main` = lane C's landMain (32), unchanged; closer ct030 Zeppelin (a Hard).
- All 32 boards 42x42, colours 4-7; 4-colour boards ct010 Wind-up mouse, ct018 Wind-up fish, ct045 Submarine. **16 of the 32
  are edited** (a tighter crop, the plain background split into an orange sky band and a slate ground band); their licence rows
  carry "Adapted for the board by Click it! Studios: ...". ct005b Gear is the one unshaded board (as lane C's).

### 2. Moat probe

The Worlds 4-11 scratch script (`scratch/moat-probe.js`, 6 rings x 20 attempts a tag), re-run on the 32: **24 can carry a
ring**. **moatSkip 4**: ct001 Clockwork owl, ct003b Pocket watch, ct006 Robot dog, ct010 Wind-up mouse (0 of 360 each). The rest
dealt 11-100%.

### 3. Bake (fresh plan for 32, then renumbered for install)

Cloud Kingdom's profile with tag shares E.375/N.50/H.125: the plan is **E12/N16/H4/X0, ending on a Hard**.
1. **Bake 1** (`--shard 2`, at 618-649): **31 ok first time**; 636 ct017b Clock tower (Easy, ringed) played 147 s.
2. **`--keep-plan --list 636 --extra 16 --shard 2 --reuse`**: ok (172 s, 43 taps, still ringed).
3. **Renumbered, not re-baked** (phase 2): phase 1 was seeded at 618 on an older end state (Harvest 45, Cloud 30); after Worlds
   10/11 round 2 (Harvest 43 at 543-585, Cloud 25 at 586-610) the land starts at 611. Each `scratch/bake/m-N.json` and
   `scratch/cands/m-N.json` moved to `m-(N-7).json` with its `n`, `scratch/state.json` re-seeded `{from: 611, sheet0: 82, gal0:
   62}` with the tags, plan and moat list kept (the 618 run in `scratch/r618/`); `convert map assemble check --force` PASS. Proof:
   all 32 out/ records identical in every field but `n` and `id`; the map layout identical but `n` (the entry's from/to too).
   The egg coin values moved (drawn from a seed of the first level's number), as Worlds 9 and 11's did. A re-bake would have
   dealt new boards (a bake's seed comes from `n`), so none was run. sheet0 82 unchanged.

**No swap, no reorder.** Too-easy watch: none failed. ct045 Submarine (632, Normal) had 3 of 8 candidates at 100%, the pick
35.5%; ct018 Wind-up fish (630, Normal) 1 of 8, the pick 45.2%; ct030 Zeppelin (642, Hard) 1 of 10, the pick 18.0%; ct010
(622, Easy, 4 colours) 67-86%, the pick 68.2%.

### 4. The world as baked

- **Tags E12 / N16 / H4 / X0**, ending on a Hard (642 Zeppelin). Hards: 621 Clock tower owl, 628 Robot chef, 635 Robot face,
  642 Zeppelin.
- Random-tap win rate: Easy mean **66.4%** (58.5-76.8, band 45-80), Normal **38.0%** (29.0-45.2, band 20-50), Hard **14.1%**
  (7.8-18.0, band 6-20). Careful player: Easy min 1.0, Normal min 1.0, Hard min 0.94.
- Real pace 152-278 s, **median 214 s** (the check's). Taps 42-55 (9 on the 55 cap). Longest tap 15.0 s at most.
- ? cards on 14 levels, linked squads on 11, **rings on 10** (614 615 618 621 624 629 630 632 635 641), **0 mystery blocks, 0
  locks, 0 archers, 0 Extreme, 0 fallbacks**. The plain Zen win line ("Clockwork owl, all dug out.").

### 5. Map (lever 1: zero new image bytes)

The castle's lava sheets **17** and **18** (Emberwatch), laid A, B, A', B' (**4 sheets** 82-85: 8 + 9 + 8 + 7 levels), each under
`sepia(.85) saturate(1.3) hue-rotate(5deg) brightness(1.1) contrast(1.25)` (tools/map-plan-v7.md section 4): the crags dark
iron, the lava channels pale brass, the ground bronze plate; the config stone bridges read as iron bridges. Eggs per `eggTurns`
on the two quest spurs of each sheet (17 at (510,520) (473,338); 18 at (636,633) (500,320)): glint/ember, ember/bubble,
bubble/glint, glint/raven. `map/` unchanged (31 image files). The top sheet holds 7 levels; the fog sits after 492.

### 6. Words and credits

- Banner "World 12 · Clockwork Town" (the page builds it from zen.k and the name); lore: "A town that runs on gears and steam:
  clockwork owls and wind-up mice, robot pets, ticking clocks and pocket watches, a steam train, a submarine and a zeppelin,
  all in brass and copper." (no word the Zen word check bans).
- **Credit line** exactly: "Clockwork Town: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it!
  Studios." on zen.json World 12 (`worldCredit`, the Zen map's foot after World 11's) and under the LICENSES.md heading.
- **LICENSES.md** "Zen World 12: Clockwork Town (Land 11, levels 611-642 ...)": the credit line, 32 rows keyed by Zen picture
  number then level (`zen.numbered`), the 16 edited rows with their note. "lane C" nowhere.

### 7. Byte-identity (proven)

- zen.json: every top-level key but `worlds`/`levels` identical to 4248f5c's; Worlds 1-11 entries and the first 410 records
  JSON-identical; World 12 appended (410 -> 442 records, all world 12, era 19).
- levels/: zen-1..zen-11.pk.json and every other packed file byte-identical (git: only `zen.pk.json` modified, `zen-12.pk.json`
  new); the index's Worlds 1-11 entries and every other key identical. levels.json, gallery.json, places.json untouched.
- LICENSES.md: the old file (147,252 B) is a byte prefix of the new; World 12's section appended.
- Frozen set (`--snapshot`): frozen zen.json 410 -> 442 records, the old 410 and Worlds 1-11 identical, the whole byte-equal to
  build-data's. `--snapshot` also rewrote frozen.json's `made` date (2026-10-13 -> 10-14, the clock past midnight UTC); that
  one-field change was reverted so frozen.json stays byte-identical. levels.json, gallery.json, castles.json snapshots untouched.

### 8. test.js and selfTest

- test.js: a "zen World 12" block (World 11's, for 32 at 611-642, era 19, sheets 17/18, 4 sheets, tint apart from Worlds 5-11,
  Zen 461-492, 16 edit rows, `edited.size >= 10`, easy + normal >= 0.85; also the 4 moatSkip pictures ringless, the phase-1
  drops ct023 ct014 ct002b ct050 and ct010b out of `main`, the closer ct030 a Hard); the world list, World 5's credit list and
  the D8 Zen-profile list grow by World 12 / `14-clockwork-town`. Passes with the untracked 16-holiday-lights, 17-farm-friends
  and 18-safari folders present (their blocks under `zenPhase2`).
- selfTest (main.js): a "World 12" block as World 11's (records, map with castle sheets 17/18 under its tint on every image,
  first node 461 open, banner, fog, credits after World 11's, Clockwork owl plays and wins with the plain line).
- check.mjs: "0 of 504 pictures"; the sweep loads z12-1.

### 9. Gates (final tree)

| Gate | Result |
|---|---|
| land.js check | PASS every gate (611-642 e19, median 214 s, 10 rings, Zen no mystery blocks, re-grade 0 of 288, map 48 px at 375, licences) |
| test.js | **721 passed, 0 failed** (shipped 14,375,878 B, 82 files; untracked 16/17/18 land folders present) |
| freeze --require | PASS before the snapshot (zen.json 410 / 3,690) and after: levels.json 2,405 checks, gallery.json 372, zen.json 442 / 3,978, shipped 754 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 3,978; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 3,978 |
| pack.js --check | the shipped files match the source |
| selfTest (selftest-lands.mjs) | **908/0 at 375x812@3, 910/0 at 1280x720, 908/0 at 360x640 (--small)**, 0 console |
| space-v7/check.mjs | **53 ok, 0 FAIL** (OLD = e072a9d via `OLD_DIR`): Zen card "0 of 504 pictures", 492 nodes from the index, sweep z12-1 at 375 and 1280 |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 908/0 or 910/0 in every viewport and the hidden tab, 0 console messages (`tools/shots-land-14/harness/`) |

Cache tag **`?v=81`** (index.html, style.css).

### 10. Payload

| | 4248f5c (Worlds 10/11 round 2) | this build | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 14,316,130 B (81 files) | **14,375,878 B** (82 files) | **+59,748 B** |
| levels/zen-12.pk.json (new) | | **39,260 B** | +39,260 |
| levels/zen.pk.json (the index) | 57,945 | 62,964 | +5,019 |
| LICENSES.md (World 12 section) / src/main.js (selfTest block) | | | +10,948 / +4,521 |
| map/ | | | **0** |
| Bytes before the first tap (home interactive, 375x812 cold load) | 1,929,214 B | **1,938,754 B** | +9,540 (the index, the code) |
| to the first Zen level (World 1's file) | 5,465,159 B | 5,474,699 B | +9,540 |

Against e072a9d (v6.7, live): shipped +299,000 B, first tap +48,266 B. World 12 packs to 1,227 B a level. 19 MB gate: **4.62 MB
of room left**.

### 11. Shots (tools/shots-land-14/, gitignored; `tools/shots-land-14.mjs` remakes them; notes.txt says what each shows)

- `map-join-375.png`: the World 11 -> 12 join at 375x812@3 (460 done on World 11's pale sky sheet, the World 12 banner, 461
  current "Play picture 461").
- `map-mid-375.png` (469-480), `map-top-375.png` (485-492 on the brass lava sheet, "More worlds on the way").
- `map-1280.png`: World 12 on desktop ("World 12 of 12", 9/32 cleared, 470 current, the lore on the realm card).
- `play-opener-375.png` (Clockwork owl in play), `play-opener-mid-375.png`, `play-opener-1280.png`; `win-375.png` ("Picture
  done", "Clockwork owl, all dug out.").
- `contact-installed.jpg`: the 32 as baked, numbered (`tools/land-contact.py tools/build-data/levels/zen.json 11 ... --world 12
  --zen-from 461 --cols 6`).
- Fit at 375 with all 492 Zen nodes: tightest number 222 (27 px in the disc's 28, unchanged), closest nodes 56.5 px (302-303).
  0 console messages.

### 12. Known for the critic

- Pre-read milder flags still in: 616 ct006 Robot dog (legs break into specks on a pale band), 613 ct033 Clock repair (the
  repairer a grey-pink blob), 634 ct021 Brass beetle (reads as an emblem), 629 ct017b Clock tower (a thin white tower, could be a
  lighthouse), 642 ct030 Zeppelin closer (a pale grey shape, zeppelin or cloud).
- 632 ct045 Submarine (a yellow submarine on cyan): generic, but a trade-dress glance is the critic's call.
- The desktop Next up card shows "Side quest 12" and the realm card an empty "Secrets found" line, as on Worlds 4-11 (LATER.md).

### 13. End state for the next land (Holiday Lights)

Last record **642**, last sheet **85** (World 12's 4 sheets are 82-85), gal0 **62** (no side quests); Zen numbers end at
**492**, 442 records in zen.json. Seed `{from: 643, sheet0: 86, gal0: 62}`.
