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
