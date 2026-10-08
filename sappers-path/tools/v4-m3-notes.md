# Sapper's Path v4 M3 notes: the Siege to 100 (2026-09-30)

Brief: a fourth era (the concentric castle), the M2 twists placed through the campaign, new teaching levels, bigger boards and squads, faster eating, the new time targets and the dead-time cap, and a full rebake of all 100 levels. Plan: `game-research/sappers-path-v4/plan.md` ("Content", "Bigger boards and time targets"). Decisions: `SPEC-v4.md` §9 (the M3 entry). Per-level table and the invariant summary: `tools/v4-m3-rebake.md`.

Page: http://127.0.0.1:8491/sappers-path/?debug=1. Cache tag `?v=18` everywhere (scripts, CSS, the font URL in style.css; the config, levels and debug-levels fetches take it from the script tag).

## Commits (branch `sappers-path`)

| Commit | What |
|---|---|
| `ac056f1` | Timing (`v3.time`) and generators: Era 4, the dealer, pairs, the lock key, the grader's dead time and planner, the bake, bake config v8 |
| `6af0a6e` | The rebake: levels, pools (Era 4's new), teaching and debug levels, `teach-v4.js`, `debug-v4.js`, the rebake report, tests |
| `5207f9d` | The page (coach, map, tile landing), style, index, config (eras, teach), harness, shots script |
| docs commit | This file, SPEC-v4 §9, LATER.md |

## Files

| File | What changed |
|---|---|
| `config.json` | `v3.time` (yardMs 200, biteMs 100, staggerMs 30); Era 4 on the map (`eras`); coach scripts for 35, 62, 76, 77 and the new pointers and conditions in `teach.note`. |
| `tools/gen.js` | `era4` (the concentric castle) and `ringCorners`; the dealer's dead-time cap, shrink loop and parking rules; `dealLine`, `linkUp`, `lockKey`, `deck` (columns with partners a row from their card); the tuner keeps pairs whole and skips decks with a partner too far away. |
| `tools/grade.js` | `line` reports the longest single tap (`maxWait`); `plan` is the sampling planner (the mystery grade). |
| `tools/bake.js` | 100 levels, four eras, the boss, the late pattern's run-in (`curve.late.overrides`), the twist schedule (`twistsOf`), `genBy` scaling, the picker's targets (band, time, dead time, fast tapper, pairs, lookahead) with a penalty-ranked fallback, a second pass (order counts, safe taps, the mystery flags and their planner grade), `--only`, `--teach`, the report in `tools/v4-m3-rebake.md`. |
| `tools/bake-config.json` | Version 8 (see below). |
| `tools/teach-v4.js` (new) | Builds `tools/build-data/teaching.json`: 1-3 redrawn, 26 and 51 kept, 35, 62, 76, 77 built; `--check` rebuilds and diffs. |
| `tools/debug-v4.js` | Re-solves the debug levels' stored orders in place (the v3 levels they were copied from are gone); `--check`, `--rebuild FILE` (M2's build from a v3 levels file), `--out`. |
| `tools/palette.js` | Exports `lab`, `de00`, `minPair` when required (the bake report's ΔE column); `--levels FILE`. |
| `tools/regrade.js` | Also checks the Normal line's `maxWait` and the fast tapper; `--levels FILE`. |
| `tools/test.js` | 100 levels in order, four eras, the dead-time and tap caps on every stored Normal line, a v3 save loading against the rebake, and two checks made twist-aware (245 checks, was 216). |
| `tools/harness.mjs` | Cell sizes on all 100 boards (smallest per era, 8 CSS px or more at every viewport, a screen of the smallest), frames on level 100 too, output to `tools/shots-v4-m3/harness/`. |
| `tools/shots-v4-m3.mjs` (new) | The M3 screens. |
| `src/main.js` | Coach pointers `mystery`, `linked`, `lockSlot`, ring `lockKey`; conditions `reveal`, `pair`, `unlock`, `locked`, `hidden`, `linkedFront`; `landTiles()` (a tile's flip or shake lands when a level starts); selfTest checks for the three twist lessons; the coach follower in selfTest taps only legal columns. |
| `style.css`, `index.html` | The wide map fits four eras (`auto-fit` columns, the debug row spans them); `?v=18`. |
| `levels/levels.json`, `tools/build-data/pools/pool-e1..e4.json`, `tools/build-data/teaching.json`, `levels/debug-v4.json` | The rebake (Era 4's pool is new). `tools/build-data/names.json` is a v2 leftover the page never reads; untouched. |

## 1. Timing (`config.json` `v3.time`), fixed before any bake

| Value | Before | After | Why |
|---|---|---|---|
| tileMs | 80 | 80 | Peter's walk speed (out) |
| carryMs | 90 | 90 | Peter's walk speed (home) |
| staggerMs | 120 | **30** | The swarm: a space sends one sapper per stagger, so a squad of 55 with room to go now leaves in 1.6 s instead of 6.6 s. At 120 they walk out in single file (a queue). |
| biteMs | 180 | **100** | Faster eating per block: less time standing at the face. |
| yardMs | 250 | **200** | Less time crossing the yard (both ways); still about the walk speed over the yard's rows. |
| knockMs | 300 | 300 | Archer knock-back, unchanged. |

- Seen in the page at 375×812: level 8 (v3 file) first tap, 42 sappers with 46 blocks in reach: 34 runners out at 1 s against 9 before. On the rebake, level 9's squad of 55 has 28 runners out 0.9 s after the tap and pours over the whole bank face (`tools/shots-v4-m3/375-swarm-strip-l9.png`, six frames 250 ms apart).
- Effect on time is small, because walking dominates: the v3 levels' patient median 89 s → 76 s, max 179 → 158 s. So the new time targets are met by board and squad sizes (section 2), not by timing.
- `show.maxRunners` stays 240. The busiest moment in the rebake: a fast tapper on level 5 has 177 sappers out at once (engine, 20 games a level, all 100 levels); in the page, tapping every legal card as spaces free, 120 runners live on level 5 with frames p95 16.7 ms, draw 0.1-0.2 ms, 0 runners dropped (375×812 and 1280×720).

## 2. Boards, squads and the time targets

The plan asked for 1.5-2× the pixel count per era and a 2-minute median with a 4-minute max. Both can't hold everywhere: patient time is set by walking. Measured on dealt forts, a block costs about 0.25 s of patient time on Era 1's open stockades and 0.45-0.55 s on moated, archer-covered Era 3-4 castles (bite, yard and stagger move that by a few per cent at most). The time targets are invariants, so the boards grow as far as they allow:

| Era | Board (median, after crop) | Blocks, median | vs v3 | Patient time, median |
|---|---|---|---|---|
| 1 Palisade | 22×27 | 300 | 1.72× | 77 s |
| 2 Motte and bailey | 23×28 | 311 | 1.57× | 104 s |
| 3 Stone keep | 23×30 | 322 | 1.16× | 168 s |
| 4 Concentric castle | 28×34 | 413 | 1.5× v3 Era 3 | 215 s |
| 100, the boss | 32×39 | 489 | | 248 s |

- Generator ranges (bake-config `eras`): Era 1 20-24 × 24-30, Era 2 22-26 × 26-32, Era 3 25-29 × 31-36, Era 4 30-33 × 35-40, the boss 36-39 × 42-46 (before the crop trims grass). Reliefs are scaled to 0.88 per side in Eras 1-3 and 0.95 in Era 4 (`genBy`), so they are quicker as well as easier; smaller Era 4 forts fail (the inner ring gets too thin).
- The cap of 42×52 is never reached; the biggest board is the boss at 32×39.
- Squads: `dealBy` early 20-56, mid 14-44, late 18-52 (`maxCard` 72). Taps per level median 20, max 48 (cap 55). Era 1 levels take 9-14 taps; Era 3-4 take 25-40, because the dead-time cap and the archers keep their squads at 10-16 a card while towers stand.
- Result: median 129 s over all 100 levels, levels 4-15 at 66-86 s, one level over 240 s (the boss, 248 s).

### Cell sizes (CSS px, the smallest board per era; harness)

| Viewport | Era 1 | Era 2 | Era 3 | Era 4 |
|---|---|---|---|---|
| 375×812 | 14 (L15) | 13 (L27) | 13 (L61) | **10.5** (L100) |
| 1280×720 | 20 (L5) | 19 (L27) | 19 (L56) | 16 (L100) |
| 812×375 | 10 (L18) | 10 (L33) | 10 (L52) | 9.33 (L100, turned) |
| 400×600 iframe | 10.5 (L5) | 9.5 (L27) | 9.5 (L61) | **8.0** (L100) |

Every board is 8 CSS px or more at every viewport, so the harness now asserts 8 everywhere. Screens of each viewport's smallest board: `tools/shots-v4-m3/{375,1280,812,400}-smallest-cell-l100.png`.

## 3. The dealer

- **Dead-time cap** (`maxWaitMs` 15000): a squad whose tap keeps the siege moving longer than 15 s (patient, from the tap until nothing moves, including squads it releases from the line) is dealt again at half its size, up to 5 times (`shrink` 0.5, `shrinks` 5), then another colour. The tuner's split and merge moves and the pair joiner check the same cap. The stored Normal line is the dealt order, so its longest tap is exactly what the dealer measured.
- **Parking.** At most 2 squads may wait on the line at rest (`park`), and none while any archer tower stands (`noParkUnderArchers`): on Hard a waiting squad released into a ring loses a sapper, which would make the deal fail later with no way back. Measured on 30 Era 3 forts, 136 of the old dealer's 148 dead ends were a line full of parked squads. On 27 Era 4 forts, 0-2 dealt before these rules, the tower lanes and the smaller ranges, 13 after.
- **Towers get lanes** (Era 4): the buildings within a cell of a tower's disc are cleared to yard, so a tower can always be walked up to without taking a covered block. A greedy hit-free dealer got stuck on all 5 test forts without lanes (the inner towers' rings covered every approach), on 2 of 5 with lanes, and on none with lanes and the smaller inner ranges.

## 4. Era 4: the concentric castle (`gen.js` `era4`)

From the outside in: a moat whose gatehouse bridge is an iron gate (key in a lodge beside the camp); the outer curtain (rubble, 2 thick) with 2-3 slate archer towers on its corners (range 4.5-5.5); the outer ward (3-4 wide) packed with buildings; in 70% of castles a water ring round the inner curtain whose only bridge is the inner gatehouse's iron gate (else the gate stands in the curtain), its key in the outer ward; the inner curtain (ashlar, 2 thick, a warded wall-walk) with 1-2 towers on its corners (range 3.5-4.5, so they cover the inner ward, not the outer ward's entry); the inner ward's buildings round a keep (ashlar walls, roof tile, a warded or crystal core). Two padlocked gates, a keep in the middle, rings of towers: it reads as a castle at 28×34. The boss: both moats, four towers on the outer ring and three or four on the inner, every twist, twelve colours. Map chapter: "Concentric castle", "Walls within walls: Edward I's castles in Wales put a high inner curtain behind the outer one. Beaumaris was begun in 1295."

## 5. Twists through the campaign

- **Schedule** (`bake.js` `twistsOf`, fixed by level number, the same for every candidate): each twist from its first level on with probability 0.45, forced after 3 levels without it; from 78 on every level carries at least one; the boss carries all. Mystery from 36 (2-4 cards), linked from 63 (1-2 pairs), the lock from 77. A teaching level counts as carrying what its data holds. Result: 35 levels with "?" cards, 17 with linked pairs, 12 with the lock; gates on every generated level from 26 and archers on every level from 51. Gates everywhere is new for Era 3: the candidate filter now asks every fort from Era 2 on for a gate, so Era 3 castles always have their moat (v3 had it on half). Era 2's motte gate and Era 4's two gatehouses are always there by design.
- **Linked squads** (`linkUp`, `deck`): two consecutive plays of different colours become one pair that goes out at once, kept only when the whole deal still wins patiently under dealing rules within the dead-time cap. The partner joins a neighbouring column at its end at that moment, so it never stands in front of a card the order taps earlier; the side that puts it exactly one row from its card is taken first, then the same row, never two. In the rebake 19 pairs are one row apart and 9 in the same row; `E.check` finds nothing on any level.
- **The lock** (`lockKey`): a block dug in one layer (it touches no ground but touches a block that does, counting every gate open and every yard as ground), never a gate, tower or key or next to a key, picked among the third of such blocks nearest the camp, turned gilt. The deal then deals its Looters like any key; per-colour sums equal the blocks. Dealing mode honours the lock (one open space fewer until the key pops).
- **Mystery** (`bake.js` `mystify`): 2-4 "?" flags on cards dealt in rows 2-3 (index 1-2 in their column), never a linked card, never two in a row in one column. Flags change nothing the random, one-move-lookahead or fast players read (they read front cards only, and no linked partner is ever hidden), so they go on after the pick and every other grade stands; `regrade.js` confirms it on the flagged file.

## 6. Mystery grading as built

- **The sampling planner** (`grade.plan`, the bake-speed version of M2's proposal). At each turn with a choice it scores every legal tap by 4 rollouts: in each, the hidden cards take colours drawn from what the player hasn't seen (each card on its own: a colour with at least its count unseen, weighted by the unseen count, as `look()` does), then the tap, then the one-move-lookahead player to the end; a rollout scores the share of the fort razed (1 = a win). The honest planner plays the best tap; the all-seeing one does the same with the true colours. 16 games each, common seeds. About 1 s a game on a late level, so it runs only on picked levels, in the second pass (14 s for all 100).
- **Use:** each placement is measured; the first with seeing - honest ≤ 20 points is kept, else the smallest gap after 4 tries with one flag fewer each (never under 2). Result: 35 mystery levels, gap median 0, max 18.8 points (level 92: 62.5% honest, 81.3% seeing), no mystery fallback.
- **What it captures:** the cost of a few "?" cards to a strong player who reads the board and the tray but doesn't count every block (the planner wins 44-100% of late levels the random player wins under 5% of). **What it doesn't:** a player who counts per-colour totals (with 2-4 "?" the colours are often deducible, so the real cost is lower for them), a weak player (the bands' random player can't feel "?" at all), and the noise of 16 games (±12 points). The bands stay on the random player and the lookahead targets on the one-move player, as M2 proposed.

## 7. The curve for 100 levels

- Bands unchanged: early 1-15 random ≥ 85% Normal; mid 16-45 saw-tooth 62-80 / 46-64 / 30-48; late 46-100 the pattern hard, hard, hard, hardest, relief (hard 0-10%, hardest 0-5%, relief 25-60%).
- The late pattern runs on through 97. The run-in to the boss is overridden (`curve.late.overrides`): 98 hardest, 99 relief, 100 boss (band 0-5%, lookahead 25%, 40 candidates, the biggest castle). Left as the plain pattern, 99 would be the hardest and 100 a relief.
- The picker takes the candidate that meets every target (band, time, dead time, fast tapper, pairs, lookahead) nearest its band's centre and not a near-duplicate; when none meets them all, the one with the least total miss (`penalty`: 1 band point, 30 s of time, 3 s of dead time, a fast-tapper flag, a missing pair or 25 lookahead points over target each count about 1). Before the penalty rank, trial bakes picked a 243 s candidate with a 99% lookahead over a 250 s one at 12%.
- Late hard and hardest slots take 20 and 30 candidates, the narrowing stage 600 steps (was 400). The final bake's 30 hardest candidates (the trial before had 20) fixed level 94, the last lookahead fallback.

## 8. Fast tapper

`grade.fast` (taps a random legal card the moment one exists; 300 games, 0 ms between taps) is reported for every level from 46. A level is *much easier tapped fast* when fast - patient ≥ 10 points, or fast > 1.75× patient and at least 3 points over it (level 61 in v3, 11.2% against 5.9%, is 1.9× and 5.3 points: flagged). The picker prefers candidates that pass. Result: none flagged; the largest fast-minus-patient is 7.3 points on relief 75 (56.8% → 64.0%). Late hard levels are mostly harder tapped fast. In the trial bakes the check caught levels 63, 66, 81, 95 and 99 (no passing candidate then); with more candidates the final picks all pass. v3's level 61 is a new level now: 4.3% patient, 2.0% fast.

## 9. Teaching levels

Nine teaching levels, all exempt from the bands, all winnable on Easy, Normal and Hard with stored orders, each with a coach script (one line and an arrow; steps advance on rules state; any tap order works; nothing waits).

| # | Name | Teaches | Board | Blocks | Normal random | Patient time |
|---|---|---|---|---|---|---|
| 1 | Open Gate | the tray | 20×18 | 104 | 100% | 22 s |
| 2 | The Waiting Line | the holding line | 20×18 | 110 | 100% | 25 s |
| 3 | Woodpile | a squad bigger than its reach | 20×19 | 108 | 100% | 27 s |
| 26 | The Locked Bridge | gate and key (v3) | 16×19 | 54 | 100% | 33 s |
| 35 | Hidden Colours | mystery cards | 22×24 | 232 | 79% | 68 s |
| 51 | The Corner Tower | archers (v3) | 18×18 | 64 | 100% | 20 s |
| 62 | Linked Squads | linked squads | 23×28 | 348 | 88% | 94 s |
| 76 | The Locked Space | the locked space (Era 4 opener) | 27×33 | 327 | 59% | 106 s |
| 77 | All at Once | everything mixed | 30×36 | 381 | 30% | 139 s |

- **The three twist lessons** (35, 62, 76) and the fourth new one (77) are built by `tools/teach-v4.js` from seeded generator forts of their era at a small size, dealt gently (big squads, nothing parked), with the twist placed where the coach can point at it from the first tap: three "?" cards in row 2 (35), a pair whose tapped card is a front card and whose partner is one row down in the next column (62), the lock key one layer in (76), and all of it (77). A seed is kept only if the level wins on every difficulty, stays inside the dead-time cap, has a gentle random rate, and is won on Normal by a player who always taps the first legal column (selfTest's coach check follows the arrow and taps that column when the arrow isn't on a card).
- **The two extra teaching levels, and why.** (a) **Level 77, All at Once**, the first everything-mixed level: from 78 every level mixes twists, and 77 is where a player first meets gates, towers, "?" cards, a pair and the lock in one castle; its coach names the pair, then the space key, then the rest. (b) **Levels 1-3 redrawn at the v4 size** (the same lessons and coach lines): the swarm is v4's new feel, and the v3 tutorials (44-56 blocks, squads of 4-10) never showed it, and the step from a 44-block level 3 to a 300-block level 4 was steep. Now level 1's first tap sends 22-24 Diggers pouring out of the camp. 26 and 51 stay: small, focused lessons on a known mechanic.
- New coach pointers and conditions (`main.js`): pointers `mystery` (a "?" tile in view), `linked` (a linked front card), `lockSlot` (the padlocked space), ring `lockKey`; conditions `reveal`, `pair`, `unlock`, `locked`, `hidden`, `linkedFront`. selfTest checks that 35's arrow is on a "?" tile, 62's on a linked front card with its rod drawn, and 76's on the padlocked space with the ring on its key.
- Levels 1-3 run 22-27 s patient, under the 60-90 s window for 1-15; exempt as tutorials (logged in LATER).

## 10. Save and the map

- Level ids are era and number (`e1-01` … `e4-100`); the rebake keeps every v3 id (Eras 1-3 are still 1-25, 26-50, 51-75). A v3 save loads by id: every win is kept, level 76 opens once 75 is won, 77 stays locked until 76 is (`tools/test.js`: a save with 75 wins loads with 75 kept and 76 next). The wins are against different fort layouts now; the medals carry over as they are.
- The map has four chapters; on wide screens they sit in a row (`auto-fit` columns of 240 px or more), the debug row spanning them.

## 11. Debug levels

`levels/debug-v4.json` keeps M2's four levels (copies of v3 levels 40, 20, 29, 38, with their twists) and re-solves their stored orders under the new timing (v4-linked's old Normal and Hard orders no longer won). `node tools/debug-v4.js --check` re-solves and diffs: match. They load and pass selfTest (12/12).

## 12. Found and fixed in the page

- **A mystery card's flip left mid-turn has no width.** The flip starts at `rotateY(90deg)`; selfTest runs synchronously, so after the first levels with "?" cards (new in the campaign), a front card kept zero width and every later `elementFromPoint` check on it failed. `landTiles()` finishes a tile's finite animations when a level starts or restarts (a flip from the last game has no business on the new one).
- selfTest's coach follower could tap a refused linked card forever; it now taps only legal columns.

## Verification

- `node tools/test.js`: **245 passed, 0 failed** (about 11 s; the differential runs 600 games with 11,030 taps against the reference on the 100 new levels, and 324 on twisted ones).
- `node tools/regrade.js` (full): **100 levels, 755 checks, 0 differences** (9.3 s).
- `node tools/debug-v4.js --check`: matches a fresh re-solve. `node tools/teach-v4.js --check`: matches a fresh build.
- `SP.selfTest()`: **761 pass, 0 fail**, 2.3-2.8 s (588 before), at all four viewports and in the hidden tab.
- Harness (`tools/harness.mjs`): **all passed** at 375×812, 812×375, 1280×720 and the 400×600 iframe, plus the hidden tab; 0 console errors or warnings. Frames with overlapping squads p95 16.7-16.8 ms (levels 65, 70, 100 at 1× and 3×); draw cost mid-show 0.013-0.021 ms mean, 0.1 ms max; payload 594 KB (levels.json 172 KB, was 90 KB); load to gameplay 84-202 ms.
- `node tools/palette.js`: min pair 25.5 over every level (74 of 91 standing pairs 10+ apart in lightness).
- Shots: `node tools/shots-v4-m3.mjs`, 0 console errors or warnings.

## Screens (`tools/shots-v4-m3/`, gitignored)

- 375×812 and 1280×720: `*-era1-l8-rest`, `*-era2-l40-rest`, `*-era3-l64-rest`, `*-era4-l88-rest`; `*-teach-l1`, `-l2`, `-l3`, `-l35`, `-l62`, `-l76`, `-l77` (each with its coach); `*-l100-boss`; `*-swarm-l9` and `*-swarm-strip-l9` (a squad of 55 mid-swarm, and six frames 250 ms apart); `*-map-era4`.
- The smallest-cell board at each viewport: `375-`, `1280-`, `812-`, `400-smallest-cell-l100.png`.
- The harness's own screens and report: `tools/shots-v4-m3/harness/`.

## Open

- The size-versus-time trade (section 2): Eras 3-4 are about 1.2× and 1.5× v3 Era 3 in blocks, under the plan's 1.5-2×, because the 4-minute max caps them. Bigger needs a longer max or a faster walk: Peter's call.
- The boss is 248 s, 8 s over the 240 s limit (logged as the one fallback).
- Teaching levels 1-3 are 22-27 s, under the early window (exempt).
- The rest is parked in `LATER.md` (M3 section).
