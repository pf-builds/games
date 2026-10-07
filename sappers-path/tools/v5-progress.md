# Sapper's Path v5 R1: progress checklist

The rules engine batch (rules and meta only; levels are re-laid in R2). Source of every decision:
`claude-workspace/business/D-click-it-studios/game-research/sappers-path-v4/rules-review.md`. Worktree
`repos/games-sappers-path/` (branch `sappers-path`), game in `sappers-path/`. Never push.

## How to resume

1. Read this file, then `tools/v5-r1-notes.md` (rules as built, decisions) and the SPEC-v4 §9 v5 R1 entry.
2. `git log --oneline` on the branch: every finished piece is its own commit "Sapper's Path v5 R1: <piece>".
3. Take the first piece below that is not `done`. Engine + `tools/ref.js` + `tools/test.js` first, then the page.
4. Checks: `~/.local/opt/node/bin/node tools/test.js` (level-data checks that need R2's re-lay print as DEFERRED, they
   are switched by `config.json` `v5.relaid`, false until R2), `SP.selfTest()` under `?debug=1` on
   http://127.0.0.1:8491/sappers-path/ (same switch), `node tools/harness.mjs`. Dev server:
   `nohup python3 ~/Documents/Claude/.claude/serve.py 8491 /Users/peter/Documents/Claude/business/D-click-it-studios/repos/games-sappers-path > /dev/null 2>&1 &`
5. Update the table and commit this file after each piece.

## Pieces

| # | Piece | State | Commit |
|---|---|---|---|
| 0 | Deferral switch (`v5.relaid`), this file | done | with 1 |
| 1 | 5 holding spaces on every level | done | 1b115ed |
| 2 | Archers never kill (no short fail, no kill path) | done | fe49b1e |
| 3 | Hard locks: key lock and colour lock | done | 10c98ac |
| 4 | Continue on a jam (250 coins, once per attempt, ad hook) | done | b5fa12d |
| 5 | Quartermaster rework (any visible card straight out) | done | 60c6770 |
| 6 | Volley power-up (clear one colour) | done | 180e37c |
| 7 | Speed: 1x, 2x bought per round, 3x debug only | done | 507bff8 |
| 8 | Power-up unlocks, free first use, tooltips | done | fd15383 |
| 9 | Mystery blocks (hidden board pixels) | done | 0775b71 |
| 10 | Extreme tag (data, display, coins) | done | 1d9ba42 |
| 11 | Freeze test (tool + fixture) | done | fed5164 |
| 12 | SPEC-v4 §9 v5 R1 entry, `tools/v5-r1-notes.md`, cache tag `?v=30`, harness and selfTest pass | done | (this commit) |

## State

R1 complete. Next is R2 (re-lay 1-100); its to-do list is `tools/v5-r1-notes.md` §5.

# R2: re-lay levels 1-100 and the 60 pictures (2026-10-04)

Source: the rules review's "Confirmed", "The feature ladder", "Tags mean how many features a level uses", "Reuse map",
"Build order", and `tools/v5-r1-notes.md` §5. Notes: `tools/v5-r2-notes.md`; per-level table `tools/v5-r2-relay.md`.

## How to resume (R2)

1. Read this section, then `tools/v5-r2-notes.md` (decisions so far) and `git log --oneline` (each piece is its own
   commit "Sapper's Path v5 R2: <piece>").
2. Take the first piece below that is not `done`. Bakes write to the scratchpad first (`--out DIR`) and are copied into
   `levels/` only after their checks pass; never leave `levels/` half-written between commits.
3. Checks as R1 (`tools/test.js`, `SP.selfTest()` under `?debug=1`, `tools/harness.mjs`), plus `tools/regrade.js`,
   `tools/regrade.js --gallery` and, after the close-out, `tools/freeze.js --require`.

## Pieces

| # | Piece | State | Commit |
|---|---|---|---|
| 0 | Harness on R1's head before any change | done: all passed, 3:24 wall (no timeout; see notes §0) | (this file) |
| 1 | Realms and tags in data (bake-config realms, tags.js realm-relative cycle, density rule, dealer settings) | done | (see git log) |
| 2 | The re-lay tool (`tools/relay.js`: the slot map, board and deck edits) and the bake's `--relay` mode (kept deck first) | done (also gallery-bake `--keep`, quests.js, critic-v5) | e71ee6f |
| 3 | Teaching levels 1, 2, 3, 25, 50, 75, 100 (teach-v4.js on the re-laid boards; coach lines) | done | (with 4) |
| 4 | Siege bake 1-100 under v5 (scratch, checked, copied in) | done: kept 28, tuned 25, dealt 37, new board 3; 0 fallbacks; regrade 0 | (this commit) |
| 5 | Gallery re-grade under v5, re-deal failures; side-quest slots and prizes; interim Gallery unlocks | done: kept 42, tuned 14, dealt 4; regrade 0 | (this commit) |
| 6 | Lore swap (realm names and lore in config; no real-world history) | done | (this commit) |
| 7 | Page: realms on the map, coach lines, texts (5 spaces, no kills) | done (text pass on any leftover 6/4-space lines in 8) | (this commit) |
| 8 | Close-out: `v5.relaid: true`, regrades 0, freeze snapshot, critic-v5 rules, tests, selfTest, harness, `?v=31`, SPEC, notes, screenshots | done | (this commit) |

### State
R2 complete. Levels, teaching, Gallery and page work landed together; close-out checks all pass (see `tools/v5-r2-notes.md` §8). Next is R3 (the journey map; `tools/v5-r2-notes.md` §10).

# R3: the journey map (2026-10-04)

Source: the rules review's "Refinement round 2" (map art) and "The feature ladder" (realms), Peter's pick of style B
(painted parchment, seed 61; `game-research/sappers-path-v4/map-mockups/README.md`), `tools/v5-r2-notes.md` §4, §5, §10.
Two pieces: (1) the map ART (13 painted sheets, layout, tools), (2) the map SCREEN in the game (next, separate brief).

## How to resume (R3)

1. Read this section, then `tools/map-gen/README.md` (prompts, seeds, strength, how to add a realm) and
   `git log --oneline` (each piece is its own commit "Sapper's Path v5 R3: <piece>").
2. Piece 1 runs SDXL base 1.0 locally, ONE image per run (`tools/map-gen/paint.py`), never in parallel with another
   generation; check `memory_pressure` and `sysctl vm.swapusage` between runs. Full-size candidates live in
   `/Users/peter/local-ai/outputs/sapper-v5-map/` (not in git).
3. No change to `src/`, `levels/`, `config.json` level data or the engine in piece 1; `tools/freeze.js --require` must pass.

## Piece 1: map art (sub-steps)

| # | Step | State | Commit |
|---|---|---|---|
| 1a | Plan (`tools/map-gen/plan.json`: sheet split, realm palettes, prompts), guide generator (`guide.py`), painter (`paint.py`) | done | 102cd30 |
| 1b | Sheet 1 strength tuning (stop rule: road must stay on the guide, look must match seed 61) | done: one pass failed the look; two passes (land 0.82, road 0.52) pass both; see map-gen README | (with 1d) |
| 1c | Sheets 2-13 painted and picked (2-6 land and 2 road candidates each) | done | (with 1d) |
| 1d | `assemble.py`: JPEGs with baked seam crossfade, `map/layout.json` (nodes nudged onto the painted road, eggs, Goblin King), `contact.png`, `contact-seams.png` | done | (this commit) |
| 1e | LICENSES.md row, README, freeze check (`freeze.js --require` PASS, 0 differences) | done | (this commit) |

## Piece 2: map screen (sub-steps; brief 2026-10-04, Peter's calls in it)

Resume: take the first row not `done`; notes go in `tools/v5-r3-notes.md`. Never touch `levels/` or the engine:
`tools/freeze.js --require` must stay at 0 differences. Dev server as R1 (port 8491). Each row is its own commit
"Sapper's Path v5 R3: <piece>".

| # | Step | State | Commit |
|---|---|---|---|
| 2a | Pure map logic `src/journey.js` (node and quest states, long tail, route split, sprites), save `eggs`, `Meta.egg`, config `map` (bridges found by eye, egg coins, texts), node tests | done: test.js 455/0 | (with 2b) |
| 2b | The map screen: 13 sheets lazy-loaded, per-sheet SVG overlay (route, detours, bridges, eggs, banners, fog and Goblin King), node buttons, desktop cards, foot Play; Gallery screen and tab gone; `?v=32` | done; selfTest through the map 519-521/0 at 4 viewports; freeze PASS | (this commit) |
| 2c | selfTest (done with 2b) and harness through the map (quests, eggs, long tail, scroll, lazy load, debug row) | done: harness all passed, 3:25 | (with 2d) |
| 2d | Screens `tools/shots-v5-r3/` (phone 3x, desktop), notes, SPEC-v4 §9, LATER, close-out checks | done: tests 455/0, freeze PASS, regrades 0/0 | (this commit) |

Notes for piece 2: `map/layout.json` is the contract (sheet pixels, draw sheet k+1 over sheet k at `step` px up; each
sheet's `road` is the painted centreline for route dashes; `quests[].branch` is where the detour leaves the road, and the
painted spur is often missing, so draw the detour). Egg coins (10-15) are not in the art data; they are in config.json `map`.

### State
R3 complete (art and screen). Next: critics on the map, then a real-phone pass; R4 builds levels 101-240 and their realms (LATER).

## Piece 3: critic fixes (2026-10-04)

Source: `tools/critic-v5-r3-functional.md`, `tools/critic-v5-r3-visual.md` (shots in `tools/critic-v5-r3-visual/`, PNGs
not committed) and the orchestrator's fix brief (Peter's call on old saves: map cleared levels by slot number). One fix pass.
Each row is its own commit "Sapper's Path v5 R3 fix: <what>". Notes: `tools/v5-r3-notes.md` §6.

| # | Fix | State | Commit |
|---|---|---|---|
| 3.0 | Critic reports committed, this checklist | done | b190c9a |
| 3.2 | Old saves keep levels by slot number (v4.3's e1-25, e2-50, e3-75, e4-100); tests on v4.2 and a v4.3-shaped save | done: test.js 458/0 | b190c9a |
| 3.1 | Long tail: fog node, one short row of the latest won pictures, a "N pictures" chip opening a sheet of 44+ px tiles | done: row of 3 at 44 px + chip, sheet of 56 px tiles; selfTest checks size and hits | see git log (fix: long tail, all cleared, ...) |
| 3.3 | All-cleared state: map Play, phone bar and desktop card agree | done: Play hidden, end line, card 'All cleared!'; 'Picture N' while pictures remain | see git log (fix: long tail, all cleared, ...) |
| 3.4 | Desktop next-up quest: the open, unwon quest nearest the current level | done: journey.js nearQuest; card, its tap and the gold ring | see git log (fix: long tail, all cleared, ...) |
| 3.5 | Tap-target spacing: Q15 off level 60, a test (48+ css px at 375 between every pair), fix what it finds | done: Q15 moved; test closest 54.3 px (46-47); none else under | 6a80e4f + test in fix commit |
| 3.6 | Collisions: realm 4 banner vs egg and label; bubbles avoid route, cleared nodes, banners | done: eggs moved, banners 3-4 +22, side picker weighs route and banners, bubbles below, label above/below; audit 0 overlaps | 6a80e4f + fix commit |
| 3.7 | Q23 off the painted tower | done: on the spur by 92 | 6a80e4f |
| 3.8 | Play bar tag inside the button | done | see git log (fix: long tail, all cleared, ...) |
| 3.9 | Cheap nits; skipped list in notes | done: tags 14 px, won quests keep purple; skipped list in notes §6 and LATER | see git log (fix: long tail, all cleared, ...) |
| 3.10 | Close-out: `?v=33`, checks, shots `tools/shots-v5-r3/` + fix shots, notes §6, SPEC-v4 §9 | done: tests 461/0, selfTest 525/527 0 fail, harness all passed, freeze PASS, regrades 0/0, critic-v5 0 mismatches, shots 0 console | (this commit) |

### State (piece 3)
Fix pass done; every brief item fixed, the skipped visual nits are in `tools/v5-r3-notes.md` §6 and LATER. Next: a critic re-check of the map, then a real-phone pass.

# R4a + R4b: castle levels 101-200 in four new realms (2026-10-05, overnight)

Source: the orchestrator's R4 brief (2026-10-05), the rules review's "The feature ladder", "Tags mean how many features a
level uses", "Confirmed", "Build order"; `tools/v5-r2-notes.md` (slot map, density rule, locks, dealer, teaching).
Notes: `tools/v5-r4-notes.md`. Boards: `tools/shots-v5-r4/boards/`. Another builder owns `map/`, `src/journey.js`, the
map code in `src/main.js` and config.json `map` (R4 map art, separate worktree): never edit those here.

## How to resume (R4)

1. Read this section, then `tools/v5-r4-notes.md` and `git log --oneline` (each piece: "Sapper's Path v5 R4a: <piece>"
   or "... R4b: <piece>").
2. Take the first row below that is not `done`. Bakes write to the scratchpad (`--out DIR`) and are copied into `levels/`
   only after their checks pass.
3. Freeze: levels 1-100 and the 60 pictures never change; eras 1-4 castles stay byte-identical (`tools/freeze.js`
   checks both). `node tools/freeze.js --require`, `tools/regrade.js`, `--gallery` 0 differences at the end.
4. Stop rule: if after the generators and a 10-level trial bake the invariants can't hold, write the problem in the
   notes and stop.

| # | Piece | State | Commit |
|---|---|---|---|
| a0 | Castle freeze fixture (eras 1-4 hashes) in freeze.js, before any castle.js change | done: 283 cases, 0 null; freeze --require PASS | (this commit) |
| a1 | Generators eras 5-8 (castle.js), realm scenes and roles (bake-config picture), lava liquid on the board | done: 12 scenes pass palette --scenes; castles 1-4 0 differences | (this commit) |
| a2 | Realms 6-8 in data (config eras, bake-config eras/realms/tags), contact sheet `tools/shots-v5-r4/boards/`, looked at | done (names, lore, gen; realm samples sheets realm5-8-samples.png looked at; tags in b1) | (this commit) |
| b1 | Bake planner for 101-200 (feature plan by tag, Extreme, hidden blocks, colour/key locks, boss 200) and density rule | done (bake.js planOf, gen.js hide, tags.js cycles + Hard/Extreme density, critic-v5 tag formula) | (this commit) |
| b2 | Trial bake of 10 levels; stop-rule check | done: 101-110 all in band, 0 fallbacks, real pace 217-242 s, taps <= 52, longest tap 15.0 s; stop rule not hit | (this commit) |
| b3 | Teaching levels 125 (towers) and 150 (mystery blocks), coach lines | done (teach-v4.js --add; 1-100 byte-identical in teaching.json; config teach e6-125, e7-150) | (this commit) |
| b4 | Full bake 101-200 (scratch, checked, copied in) | done: full run + 3 fix-up runs merged; 0 fallbacks; regrade 0 (200 levels); real pace median 227 s | (this commit) |
| b5 | Side quests 26-50 open off the new levels; tests (density, milestones, tags, teaching, quests) | done: test.js 564/0; critic-v5 0 mismatches; freeze PASS | (this commit) |
| b6 | Page checks (selfTest, map with levels past its spots), critic-v5, harness, `?v=35`, SPEC, notes, LATER | done: selfTest 697/2 and harness pass except the map's own checks (notes §7, for the map builder); critic 0; freeze PASS | (this commit) |

### State (R4)
R4a and R4b complete: levels 101-200 baked and checked. Open: the journey map has no spots for 101-200 (the other
builder's R4 map); until it merges, `src/main.js` scrollMap (line 698) throws on a save past 100 and selfTest's map checks
fail (`tools/v5-r4-notes.md` §7). Then critics and Peter's playtest of 101-200.

# R4c: the journey map's art and layout for levels 101-200 (2026-10-05, overnight)

Brief: the orchestrator's R4c brief of 2026-10-05 (worktree `repos/games-sappers-path-map/`, branch `sappers-path-map`).
Another builder bakes levels 101-200 on branch `sappers-path`; this branch touches only `map/`, `tools/map-gen/`,
`src/journey.js`, the journey-map parts of `src/main.js` and `style.css`, `config.json` `map`, map tests and selfTest,
and notes. Notes: `tools/v5-r4c-notes.md`. Candidates (not in git): `/Users/peter/local-ai/outputs/sapper-v5-map-r4/`.
Dev server: port 8495 (never 8491, the other builder's).

## How to resume (R4c)

1. Read this table; take the first row not `done`.
2. Art runs: `tools/map-gen/run.sh` (one SDXL base 1.0 image a run, memory logged); check `ps` for another session's
   generation first; picks go in `tools/map-gen/picks.json`; `python assemble.py` rebuilds `map/`.
3. Sheets 1-12 must stay byte-identical (md5 before/after assemble); levels never change (`freeze.js --require`).

| # | Step | State | Commit |
|---|---|---|---|
| c1 | Plan: realms 5-8 sheets (13 regenerated + 14-25), stops, fog and Goblin King on the top sheet, new feature drawers, new egg kinds, candidate dirs, guides | done | 10e028a |
| c2 | Paint: sheet 13 (no fog), 14-15 Mistmoor; stop-rule check on the first new sheet | done: road held (s72); fen prompt changed to moorland | b6bfcfb |
| c3 | Paint: 16-18 Emberwatch Crags | done: perspective peaks fixed by prompt + negExtra | b6bfcfb |
| c4 | Paint: 19-21 Shrouded Weald | done: canopy-from-above prompt; road held on a busy forest | b6bfcfb |
| c5 | Paint: 22-25 Goblin King's Throne (fortress summit, fog on top) | done: summit kept in perspective (all seeds) | b6bfcfb |
| c6 | Assemble: layout.json 25 sheets, eggs, manual fixes, bridges, contact-r4 + seams-r4, sizes | done: sheets 1-12 byte-identical; 6.95 MB map | b6bfcfb, f423bbb |
| c7 | Code: frontier, eggReached (no levels = not reached), new eggs and king, banners 6-8, tests both states | done | de30444 |
| c8 | Checks: test.js, freeze, selfTest 375x812@3 and 1280x720, harness on 8495; shots `tools/shots-v5-r4-map/` (both states) | done: 462/0, PASS, 527/529 (today) and 727/729 (fake 200) 0 fail, harness all passed, shots 0 console | (close-out) |
| c9 | Notes `tools/v5-r4c-notes.md`, merge notes, this table | done | (close-out) |

### State (R4c)
Done. Next: merge into `sappers-path` with levels 101-200 (merge notes: `tools/v5-r4c-notes.md` §5), then critics on the new realms.

# R4 merge: the map lane (R4c) into the levels lane (R4a + R4b) (2026-10-05)

Merge of `sappers-path-map` into `sappers-path` in the worktree `repos/games-sappers-path/`. Notes: `tools/v5-r4-notes.md`
§9. Shots: `tools/shots-v5-r4/merged/` (gitignored; `tools/shots-v5-r4-merged.mjs` remakes them).

| # | Step | State | Commit |
|---|---|---|---|
| m1 | `git merge sappers-path-map`: conflicts in test.js (map lane's checks kept), LATER and this file (both kept); config.json and main.js auto-merged | done | ade64f0 |
| m2 | Real data against the layout: levels.json `n` 1..200 in order, `era` = layout realm for all 200, every level has a spot, quests 1-50 branch between their level and the next, the long tail above 200 on sheet 25 | done: 0 mismatches, nothing to fix | (no change) |
| m3 | Cache tag `?v=36` in index.html (10) and style.css's font URL (1) | done | cf3c442 |
| m4 | Checks: test.js, freeze, regrades, critic-v5, selfTest (3 saves x 2 viewports), both map screens scripts, harness | done: 565/0, PASS, 0/0, 0 mismatches, 756/758 0 fail, 0 console, all passed | (close-out) |
| m5 | Screens: fresh, 110, 130, 160, 190, summit, all 200 + tail, lessons 125 and 150 in play | done | (close-out) |
| m6 | Payload, notes, SPEC §9 | done: play 1.72 MB, portal build 9.87 MB | (close-out) |

### State (R4 merge)
Merged and green. Next: critics on realms 5-8 and the new map, then Peter's playtest of 101-200.

# R4 fixes: the critics' one fix pass on levels 101-200 (2026-10-05)

Source: `tools/critic-v5-r4-functional.md` (PASS, 4 minors), `tools/critic-v5-r4-visual.md` (0 blockers, 7 should-fix,
8 nits; shots in `tools/critic-v5-r4-visual/`, PNGs not committed) and the orchestrator's fix brief. Notes:
`tools/v5-r4-notes.md` §10. Shots: `tools/shots-v5-r4/fixes/` (gitignored). Each row is its own commit "Sapper's Path v5
R4 fix: <what>". Frozen: levels 1-100, the 60 pictures, castles eras 1-4 (`node tools/freeze.js --require`). Levels
101-124 and 175-200 are re-baked to a scratch dir first and copied in after their checks.

| # | Fix | State | Commit |
|---|---|---|---|
| f0 | Critic reports committed, this checklist | done | cbf795b |
| f7 | S7 realm 8 banner: a long name wraps on the phone (no ellipsis) | done: whole at 360 wide (`fixes/phone360-banner-realm8.png`) | cbf795b |
| f6 | S6 archer towers: a stone-grey per scene in realms 6-8, 25+ ΔE00 from water, lava and every role; levels 125-174 repainted | done: smallest gap 25.3 (was 3.6); lesson 125 and teaching.json too | 75cb1ef, b4a2245 |
| f1 | S1 Mistmoor fog: fog skies (no sun), mist banks, willows, reeds, still dark water (a `mire` liquid), dusk and night misty | done | 75cb1ef |
| f2 | S2 Mistmoor variety: five fort families (stilt hall, causeway fort, reed palisade, sunken tower, island hold) | done: variety 27.9% | 75cb1ef |
| f3 | S3 Throne variety: five fortress families; mystery blocks capped and spread (no big flat "?" masses) | done: variety 22.9%; groups <= 28, off sky and outline | 75cb1ef |
| f3b | Re-bake 101-124 and 175-200 to scratch, checks, copy in; contact sheets looked at | done: 0 fallbacks, median 226 s (101-200) | b4a2245 |
| f4 | S4 + m3 the boss: name, Goblin King on the board, intro line, win line and celebration | done | b4a2245, 9d4a7e8 |
| f5 | S5 phone map labels: 189, 131, 159, 106, 110 and the audit to 0 contact (phone and desktop, 100-200) | done: `tools/label-audit.mjs` 0 contact in 204 states | 9d4a7e8 |
| f8 | m2 critic-v5 models the Volley and mystery blocks; 0 mismatches | done: 8,712 games, 0 | dbe3057 |
| f9 | Cheap nits (N1 locked-node contrast on dark sheets, ...); skipped ones in notes and LATER | done: N1, N2; N3-N8 and m4 in LATER | 9d4a7e8 |
| f10 | Close-out: `?v=37`, every check, shots, notes §10, SPEC-v4 §9, LATER | done | (close-out) |

### State (R4 fixes)
Every brief item fixed; nits N3-N8 and m4 parked in LATER. Next: Peter's playtest of 101-200.

# Lands foundation: levels past 200, built 50 at a time (2026-10-06)

Source: the orchestrator's foundation brief (2026-10-06) and `game-research/sappers-path-v4/land-factory.md` Step 0, with
Peter's scope notes of 2026-10-06 (difficulty data-driven per land; the play screen's gear; side quests from the Wandering
Gallery). Notes: `tools/lands-foundation-notes.md`. Runbook for the factory loop: `tools/land-runbook.md`. Demo land
(never shipped): scratch copy, shots in `tools/shots-lands-foundation/` (gitignored). Dev server 8494 (8491 was taken).

## How to resume (lands foundation)

1. Read this table, then `tools/lands-foundation-notes.md`; `git log --oneline` ("Sapper's Path lands foundation: ...").
2. Take the first row not `done`. Frozen: levels 1-200 and pictures 1-60 (`freeze.js --require`; the snapshot now holds
   1-200). The live game must look and play as before until a land is installed.

| # | Piece | State | Commit |
|---|---|---|---|
| L1 | Lands in data: config `lands`, realm words past 200 (Land k), epilogue on the boss's first win, era per land | done | (see git log) |
| L2 | Shading: `tools/shade.js` (port of the test, 20/20 identical), `convert.shade`, board draw, shade tip, selfTest twin | done | (see git log) |
| L3 | Map: `mirror` entries (journey.js layoutOf), WebP sheets, page crossfade (`fade`), bridges per entry, long tail past the last land (tailAfter) | done | (see git log) |
| L4 | Land profile (data per land: tag mix, feature shares, bands), land bake (`tools/land-bake.js`), side quests (`quests.js landQuestsOf`) | done | (see git log) |
| L5 | Factory: `tools/land.js` (prep, convert, sheet, bake, map, assemble, check, install), `land-src.py`, `land-sheet.py`, `land-config.json`, Wandering Gallery folder | done | (see git log) |
| L6 | The play screen's gear (Settings over a level, held still) | done | (see git log) |
| L7 | Tests (lands section, castle-scoped views), freeze snapshot 1-200, `?v=42` | done | c8d61a6 |
| L8 | Demo land (10 levels, scratch) + shots, selfTest/test/critic/freeze on a copy with it installed | done: every gate PASS, median pace 208 s; copy checks all green | (docs commit) |
| L9 | Checks on the branch (test.js, freeze, regrades, critic-v5, selfTest x2, harness), notes, SPEC §9, runbook | done: test.js 611/0; freeze PASS (200 + 60 + 283 castle cases, 0); regrades 0/0; critic-v5 0 of 8,712 games; selfTest 781/0 (375x812@3), 783/0 (1280x720), 781/0 (360x640@3); harness all passed, 0 console | d073545 + last |

### State (lands foundation)
Foundation built and checked; the live game is unchanged until a land is installed (except the play screen's gear).
Next: the factory loop builds Land 1 (`tools/land-runbook.md`); its profile, map templates and the Wandering Gallery
list are its first decisions (`tools/lands-foundation-notes.md` §10).

# Feature: organic moats (2026-10-06)

Source: the orchestrator's feature brief of 2026-10-06 (Peter's call: "dynamic moats like earlier levels, but ... around
an image organically with 1 or 2 openings"; first used by Land 2, 251-300). Notes: `tools/feature-moats-notes.md`.
Demo land "Moat Test" (never shipped) on a scratch game copy; shots in `tools/shots-moats/` (gitignored; remade by
`tools/shots-moats.mjs`). Dev server 8494 for the branch (serves the worktree), 8496 for the demo copy.

## How to resume (organic moats)

1. Read this table, then `tools/feature-moats-notes.md`; `git log --oneline` ("Sapper's Path feature: organic moats: ...").
2. Take the first row not `done`. Frozen: levels 1-200 and pictures 1-60 (`freeze.js --require`). No land is installed
   on the branch, so the live game must not change.

| # | Piece | State | Commit |
|---|---|---|---|
| M1 | Ring builder `tools/moat.js` (subject, path, ring, edge ways, cuts, pockets, water colour) | done | e1b9163 |
| M2 | Plan and density: `moat` a board feature (`tags.js BOARD`, `cant`), amount = opening set; profile + `plan.moat` numbers | done | e1b9163 |
| M3 | Bake: `FEATURES.moat`, the opening-set ladder, the pick prefers the planned set; key on a mystery block fixed | done | e1b9163 |
| M3b | The path only behind a cut, kept 3 cells off edge ways (`edgeKeep`): a full path let one edge block open the whole outline (Stacks of Wheat Extreme 11.5% vs 0-6%); report shows a stepped-down set | done | 4359d0b |
| M4 | Factory: `land.js` asks each picture first, shades zeroed on changed cells, the moat gate, the report column | done | e1b9163 |
| M5 | Tests: ring off the subject with a bank, path shut, reach, openings, edge, colour, plan/density, fixture bake | done | e1b9163 |
| M6 | Demo land (8 test paintings, moats on) to a passing check, installed on a copy, copy checks, shots + contact sheet | done: every gate PASS on the first fresh bake (6 ringed, 2 can't; median 216 s); copy: test.js 616/0, regrades 0/0, freeze PASS, critic-v5 0 of 9,042, selfTest 799/801 0 failed, 0 console | 1d6d3d3 |
| M7 | Notes, SPEC-v4 §9, runbook (how a land turns moats on), LATER | done | 1d6d3d3 |
| M8 | Branch checks: test.js, freeze, regrades, critic-v5, selfTest x2, harness last | done: test.js 615/0; freeze --require PASS (1-200, 60 pictures, 283 castle cases, 0); regrades 0 of 1,155 and 0 of 360; critic-v5 0 mismatching games of 8,712, tags 0, known answers 0 wrong; selfTest 781/0 (375x812@3x), 783/0 (1280x720), 0 console; harness all passed, 0 console | (this commit) |

### State (organic moats)
Built, demoed and checked; the live game is unchanged (no land installed, no shipped file touched). Next: Land 2
lists `"moat"` in its features (`tools/land-runbook.md` §1) and picks pictures that carry a ring
(`tools/feature-moats-notes.md` §7).

# Land 1 Kitten Forest: bake and install (2026-10-06, overnight)

Source: the orchestrator's Land 1 stages 4-5 brief (2026-10-06) and `game-research/sappers-path-v4/land-factory.md` (Peter's
calls: difficulty climbs past 200 with a sawtooth; Land 1 uses the deck features only, no moats; side quests are the
Wandering Gallery). Inputs: `game-research/sappers-path-v4/lands/01-kitten-forest/` (picks, map). Procedure:
`tools/land-runbook.md`. Notes: `tools/land-01-notes.md`. Shots: `tools/shots-land-01/` (gitignored). Dev server 8494.

## How to resume (Land 1)

1. Read this table, then `tools/land-01-notes.md`; `git log --oneline` ("Sapper's Path Land 1 Kitten Forest: ...").
2. Take the first row not `done`. The land's scratch (`tools/lands/01-kitten-forest/scratch/`, gitignored) keeps every
   bake; `tools/land.js tools/lands/01-kitten-forest` resumes. Frozen: levels 1-200 and pictures 1-60
   (`freeze.js --require`); 201-250 join the frozen set only after the critics.

| # | Piece | State | Commit |
|---|---|---|---|
| K1 | Land folder (land.json, manifest, sources, map sheets, templates); Wandering Gallery's first 12 pictures | done: boards identical to the judged ones (50/50 picks, 12/12 gallery) | 0c54c06 |
| K2 | Egg kinds kitten, yarn, butterfly (journey.js, config names) | done | a9ac01f |
| K3 | Difficulty profile (land.json) and trial bake; mystery-block gap rule; narrowing toward any ceiling, under it | done: E4/N21/H17/X8; bands N 1-7%, H/X 0-1%; ceilings 0.30/0.15/0.10 | d0fea6d, 0368913, 8a563b0 |
| K4 | Full bake 201-250 + 12 side quests, fix-ups, check PASS | done: 1 full run + 6 fix-up runs (16 pictures reordered); 0 fallbacks; median pace 243 s; check PASS | (scratch; installed in K6) |
| K5 | Sheet 25 retouch (top band); sheet 25's route above 200 on the painted road | done | 35dcf90, 9521c22 |
| K6 | Install; cache tag `?v=44` | done: test.js 616/0, freeze PASS (1-200 frozen; 201-250 not yet), regrades 0 of 1,455 and 0 of 432 | (this commit) |
| K7 | Checks: test.js, freeze, regrades, critic-v5, selfTest x2, harness last | done: 616/0; PASS; 0 of 1,455 and 0 of 432; 0 of 10,758 games; 893/895 (and 893 at 360x640) 0 failed; harness all passed after the 375x667 compact-chrome fix; 0 console | (this commit) |
| K8 | Shots, notes, playtest bundle + smoke | done: shots `tools/shots-land-01/`; notes `tools/land-01-notes.md`; bundle in the session scratchpad (`sp-bundle-land1`), smoke OK | (this commit) |

### State (Land 1)
Built, installed and checked on the branch; not pushed. Next: the functional and visual critics on 201-250 (notes §9 lists
what to look at), one fix pass, then `freeze.js --snapshot` so 201-250 and pictures 61-72 join the frozen set.

# Land 1 fixes (2026-10-06, the one fix pass after the Land 1 critics)

Source: the orchestrator's fix brief (Peter asleep), `tools/critic-land-01-functional.md` (0 blockers, 2 majors, 7 minors)
and `tools/critic-land-01-visual.md` (2 blockers, 5 should-fix, 6 nits). Notes: `tools/land-01-notes.md` §10. Shots:
`tools/shots-land-01/fixes/` (gitignored; `tools/shots-land-01-fixes.mjs` remakes them). Dev server 8494 (worktree root,
game at `/sappers-path/`). 201-250 are NOT added to the frozen set (the orchestrator decides after review).

| # | Fix | State | Commit |
|---|---|---|---|
| F1 | M1: careful player and steady-rhythm replay in the grader; harder profile baked and measured (careful 0.32/0.23/0.18 vs 151-200's 0.71/0.46/0.58), then, on Peter's direction change, replaced by a casual profile (E18/N26/H6/X0, light features, no locks, generous bands); thinking replays all won (m2), steady wait between taps <= 15 s (m3) | done: casual land installed; harder land measured, not installed (notes §10.0-10.2) | 390911c, (fix commits) |
| F2 | B1 mystery fill per level, 20+ CIEDE2000 from its picture (land levels only) | done: 11 levels, fills 22-32 | (fix commits) |
| F3 | B2 + S1 + S2: 7 swaps from spares, the 50 re-laid for variety | done (notes §10.3) | (fix commits) |
| F4 | S3 mystery blocks off the subject's face (faceOf) | done | 390911c |
| F5 | M2 calm land words ("Picture done", "A little stuck") | done | (fix commits) |
| F6 | m5 the long tail kept open for saves from before the lands | done | (fix commits) |
| F7 | S4 eggs per sheet repeat; S5 short quest titles; m4 44 px play-bar taps; m7 SPEC-v4 §9 Land 1 entry | done | (fix commits) |
| F8 | Checks: land check, test.js, freeze, regrades, critic-v5, selfTest x3, harness last; bundle | done: PASS; 618/0; PASS; 0 of 1,605 and 0 of 432; 0 of 10,758 games; 900/902/900, 0 messages; harness all passed; bundle smoke (notes §10.8) | (fix commits) |

### State (Land 1 fixes)
Casual Land 1 installed and checked on the branch; not pushed; 201-250 not frozen (the orchestrator decides). The harder
profile and its tooling are documented for the campaign rebalance (notes §10.2, §10.6).

# Campaign v6 lane A (Campaign Challenge Mode), 2026-10-06

Worktree `repos/games-sappers-campaign/` (branch `campaign-v6`), game in `sappers-path/`. Never push. Lane B works in
`repos/games-sappers-path/` in parallel: keep page edits small. Curve: `tools/campaign-v6-curve.md`; rules: SPEC-v4 §9
"Campaign v6 stage 1"; notes: `tools/campaign-v6-notes.md`.

## How to resume

1. Read this table, then the notes' newest section and the SPEC entry.
2. Dev server: `nohup python3 /Users/peter/Documents/Claude/.claude/serve.py 8496 /Users/peter/Documents/Claude/business/D-click-it-studios/repos/games-sappers-campaign/sappers-path > /dev/null 2>&1 &` (game at the root).
3. Checks: `node tools/test.js`; `node tools/freeze.js --require`; `node tools/regrade.js` and `--gallery`;
   `zsh tools/critic-v5/run.sh`; `node tools/debug-v4.js --check`; with `PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs`:
   `node tools/selftest-lands.mjs --url http://127.0.0.1:8497/`, `node tools/shots-campaign-v6.mjs`, `node tools/harness.mjs --url http://127.0.0.1:8497/`.

| # | Piece | State | Commit |
|---|---|---|---|
| A1 | Stage 1 engine + ref: `kill: true` (short fail), `locks: [a, b]` | done: test.js 647/0 | 60fe16c |
| A2 | Stage 1 tooling: dealer, bake, tags, careful games by range (32 for 150-200), critic-v5 | done: freeze PASS; regrades 0/1,605, 0/432; critic 0 of 10,824 | a563ee2 |
| A3 | Stage 1 debug levels v6-kill, v6-locks | done: `--check` matches | eb721b0 |
| A4 | Stage 1 page: kill toast + doomed runner, short sheet (Retry only), a socket per lock, `?v=46` | done: selfTest 911/0, 913/0; real taps 14/14; 0 console | 73f8c32 |
| A5 | Stage 1 docs: SPEC §9 entry, notes §1, this table | done | (this commit) |
| A6 | Stage 1b: the archer gradient (`archers: pin \| kill`; pins), engine + ref + tests | done: test.js 663/0 | 02d94a0 |
| A7 | Stage 1b tooling + debug v6-pin | done: freeze PASS; regrades 0/1,605, 0/432; critic 0 of 10,857 | 140e6df |
| A8 | Stage 1b page, `?v=47` | done: selfTest 919/0, 921/0; real taps 22/22 (port 8497); 0 console | 8a073ba |
| A9 | Stage 1b docs: SPEC §9 1b entry, notes §2, this table | done | (this commit) |
| A10 | Stage 2 tooling: `tools/campaign-v6.js` (plan, bake, install, measure), `tools/campaign-v6-bake.js` (worker), bake-config `tags.v6` + `v6`, config v5.density (towers from 60, v6 rule), tags.js densityV6, gen.js (hide gap, rushOpen), test.js / critic-v5 / selfTest §6 | in progress | |
| A11 | Stage 2 bake: `node tools/campaign-v6.js bake --threads 14` (scratch in `tools/campaign-v6-scratch/`, gitignored; `--reuse` keeps candidates; `--list N,N --extra K` for fix-ups), then `install`, then `measure` | bake1 186 levels / 50 fallbacks; bake2 (--reuse, pace range 160-330, mystery blocks only where a board carries them) 48; bake3 (--extra 16 on those, keepOnly towers on 7 killing levels, 240 deal attempts) 12 left: 52, 70, 131, 146, 152, 176, 180, 189, 191, 192, 194, 199 | |
| A12 | Stage 2 checks + docs (SPEC §9 stage 2, notes §3, after table `tools/campaign-v6-baseline-after.jsonl`) | todo | |
