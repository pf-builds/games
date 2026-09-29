# Sapper's Path v3 M0 report

M0 built the pixel rules engine, a fast grader, Era 1-3 generators, a baker that deals by simulating a winning order, a 75-level bake and a feel-check board. No M1 UI work. Everything below comes from `node tools/bake.js`, `node tools/test.js` and `tools/feel-check.mjs` on 2026-09-28.

## Summary

- **Every generated level landed in its Normal band on the final bake (70 of 70, zero fallbacks).** The five teaching levels are exempt, and are listed as such.
- **All 75 levels win on Easy, Normal and Hard** with a stored order for each, and the node tests replay all 225. The deal is simulated under Hard rules (4 spaces, lethal archers), so one order wins all three; the stored orders are identical across difficulties.
- **Bake: 51 s for 75 levels** on 16 threads: 616 forts, 500 deals, 105,513 tuning evaluations (64 or 256 playouts each) and 417 full grades on 3 difficulties. That's about 2,100 graded candidate decks per second, or 130 per thread. One random playout takes 20-40 µs on one thread (42,000-52,000 full-length playouts a second). A winning replay is 240-360x faster than the slow reference. Rebakes are byte-identical.
- **Tests: 128 of 128 pass.** They cover the hand-made boards plus a differential run of the engine against `tools/ref.js`: 675 random games and 14,532 taps across every level and difficulty, with zero mismatches.
- **Feel board:** http://localhost:8491/sappers-path/tools/feel.html (L8 early, L29 mid, L64 late; `?level=N&diff=hard` plays any level). The headless check found zero console messages and won L29 through the real card buttons.

## Win rates by band (Normal bands; Easy and Hard alongside)

| Band (Normal target) | Levels | Easy median | Normal min / median / max | Hard median | Lookahead player median | Taps (cards) |
|---|---|---|---|---|---|---|
| 1-15 early (>= 85%) | 12 + 3 teaching | 100% | 91.0 / 100 / 100% | 100% | 100% | 13-26 |
| 16-45 saw-tooth high (62-80%) | 10 | 91.5% | 67.2 / 72.5 / 76.0% | 50.7% | 100% | 30-57 |
| 16-45 saw-tooth mid (46-64%) | 9 + 1 teaching | 90.5% | 50.5 / 56.0 / 59.8% | 30.0% | 100% | 29-47 |
| 16-45 saw-tooth low (30-48%) | 10 | 65.9% | 35.0 / 40.1 / 44.0% | 23.0% | 95.5% | 31-57 |
| 46-75 hard (< 10%) | 17 + 1 teaching | 17.0% | 0.0 / 4.0 / 9.8% | 0.0% | 14% | 33-84 |
| 46-75 hardest (< 5%) | 6 | 11.9% | 1.5 / 2.1 / 5.0% | 0.0% | 24.5% | 40-84 |
| 46-75 relief (25-60%) | 6 | 74.6% | 37.5 / 42.6 / 43.5% | 0.6% | 99% | 41-80 |

The saw-tooth repeats high, mid, low every three levels from 16. The late band repeats hard, hard, hard, hardest, relief from 46. That gives a relief level at 50, 55, 60, 65, 70 and 75, and the Era 3 teaching level at 51 is a relief too. The per-level table below has every level's Easy, Normal and Hard rates.

Two late levels (52 and 63) measure 0.0% random-tap on Normal over 400 playouts. Both are winnable. A one-move-lookahead player wins them 4% and 12% of the time. On Hard, 15 of the Era 3 levels measure 0.0% random-tap.

## What drives difficulty (measured, and it bent the plan)

- **Colour count is the main pressure knob.** Normal can only overflow when six different colours are waiting at once, so any fort with 6 or fewer colours wins 100% of random games on Normal. The mid band needs 7-9 colours and the late band 10-12. The design table's "3-4 colours in Era 1" can't reach the 30-80% band. Era 1 therefore ramps from 3 colours (levels 4-6) to 7-9 (levels 16-25). This is logged in SPEC-v3 §9.
- **The column deal is the fine knob.** Any split of the winning order into five columns keeps that order a winner, because each column is a subsequence of it. The tuner moves single cards between columns, which sets how early the deep colours show at the fronts. It also splits and merges squads, re-checking the order each time. For late hard slots, a last stage lowers the lookahead player's win rate while holding the random-tap band.
- **"Winning orders" saturate.** Every generated level hits the cap (1000+ distinct tap orders); only the two tiny teaching boards count exactly (360). With about 50 cards in 5 columns, the tap sequences number around 5^40, and even a 2% level has astronomically many winners. **The "hardest have 1-3 winning orders" target isn't reachable as literally counted, so I didn't grind on it.** Two narrowness measures stand in for it:
  - **Lookahead player:** it skips taps that fail at once and prefers the shortest holding line. It wins a median 14% of the late hard levels and 24.5% of the hardest, with a range of 0-85%.
  - **Safe taps per turn:** at each turn of the winning line, the taps that still leave a win reachable (a solver check per tap, 20,000 nodes). The mean is 4.73 of about 5 on late levels. Only levels 73 and 74 have forced turns, meaning exactly one safe tap (two turns and one turn). 62 checks across the bake ran out of budget and count as unsafe, so these are lower bounds. Late levels are traps for the careless, not single-path puzzles.

## Rules finalised in M0 (also in SPEC-v3 §9)

**Archer rule.** While any pixel of a tower stands, its range (a disc of radius r around the tower's centroid, drawn on the board) covers every non-tower pixel inside it. Tower pixels are never covered. A card squad eats its colour's nearest pixels one at a time as usual. When its next target is covered, that sapper is hit, and since the target never moves, so is every sapper left in the squad. On Easy and Normal the hit sappers join the holding line (merging like leftovers). On Hard they die. A Hard kill that leaves a colour with fewer sappers than pixels ends the level at once ("short").

**Re-hit rule.** Sappers on the holding line are wary. An entry resumes only when its next target is uncovered, and a resuming entry stops before it would walk into range. It keeps its place in the line and waits. A parked entry can never be hit again, so there is no loop. It moves on its own once the tower falls, or once a nearer, uncovered pixel of its colour opens up. Every resume eats at least one pixel, so the cascade is bounded by the pixel count.

**Third fail rule (confirmed, with one correction).** "Tray non-empty but every front card's material has no reachable pixel and there's no room left to hold them." A card whose colour already has a holding entry merges into it without needing room, so the confirmed rule is: every front card would end the assault if tapped. Either its crew can't reach an uncovered pixel, the line has no entry of its colour, and the line is full, or (Hard only) its crew would walk into archer range and die short. This is checked after every play and at load, and reported as "no move". The other fails stay as specced: overflow (a new entry past capacity) and stuck (tray empty, line settled, pixels left). "Short" is the Hard archer fail above.

Other decisions (all in §9): the tie-break's "camp row" is the camp's top row, with the lower y as a last tie-break; overflow is checked the moment leftovers join, before the resume cascade; a resuming entry keeps its place in line; iron exists only as gate pixels (no Smiths cards); each Era 3 tower is a slate disc on a curtain corner.

## Open risks for M1

1. **Late levels are long.** Levels 46-75 run 33-84 taps (median 52) with 10-12 colours. Real play needs animation time per tap, so the portal session length needs checking at M1. The squad-size knob (`dealBy.late.size`) shortens them at some cost to tuning room.
2. **Hard is severe in Era 3.** Random-tap on Hard is 0% on 15 of 25 Era 3 levels (all winnable). One archer mistake ends the level. Peter should play a Hard Era 3 level on the feel board (`?level=64&diff=hard`) before M1 locks the difficulty picker.
3. **Palette readability.** Gilt keys (#ffb6d9) sit next to Timber (#ff3fa4), and a key inside a timber lodge is hard to spot at 10 px. M1 needs a key icon or a distinct key colour, plus the grayscale patterns SPEC §6 asks for.
4. **Difficulty proxies.** The bands are on random taps. The lookahead player shows the late band is uneven for thinking players (0-85%). Peter's feel check is the first human data. If the late band feels easy, the narrow stage (`tune.narrow`) can take more steps, or can pick by lookahead rate for every late slot.
5. **The v2 page no longer runs.** `index.html` and `src/main.js`, `game.js`, `solver.js` and `save.js` still target the v2 engine API and `levels.json` shape. M1 replaces them (reusing the skin, audio, save pattern and map), and the v2 harness goes with them.
6. **Fort art is placeholder-grade.** The plans read as forts at 10 px, but buildings are plain rectangles and some ditch corners have gaps. That's fine for M0; M1's look pass owns it.

<!-- bake:start -->
### Bands on Normal

| Band | Levels | In band | Exempt (teaching) | Normal min | median | max |
|---|---|---|---|---|---|---|
| early 85.0%-100.0% | 15 | 12/12 | 3 | 96.3% | 100.0% | 100.0% |
| saw0 62.0%-80.0% | 10 | 10/10 | 0 | 67.0% | 71.0% | 77.3% |
| saw1 46.0%-64.0% | 10 | 9/9 | 1 | 53.3% | 55.3% | 100.0% |
| saw2 30.0%-48.0% | 10 | 10/10 | 0 | 37.0% | 39.3% | 40.5% |
| hard 0.0%-10.0% | 18 | 17/17 | 1 | 2.3% | 5.0% | 100.0% |
| hardest 0.0%-5.0% | 6 | 6/6 | 0 | 1.5% | 2.5% | 3.5% |
| relief 25.0%-60.0% | 6 | 6/6 | 0 | 38.3% | 41.5% | 44.5% |

### Every level

| # | Era | Band | Target (Normal) | Easy | Normal | Hard | In band | Cards | Colours | Pixels | Peak line E/N/H | Winning orders (Normal, cap 1000) | Lookahead player (Normal) | Forced turns / mean safe taps | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | exempt | 6 | 2 | 44 | 0/0/0 | 360 | 100.0% | 0/3.4 | teaching: tray |
| 2 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | exempt | 7 | 3 | 52 | 0/0/0 | 1000+ | 100.0% | 0/3.83 | teaching: holding |
| 3 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | exempt | 7 | 3 | 56 | 0/0/0 | 1000+ | 100.0% | 0/3.5 | teaching: overshoot |
| 4 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 20 | 3 | 382 | 0/0/0 | 1000+ | 100.0% | 0/4.68 |  |
| 5 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 14 | 3 | 324 | 0/0/0 | 1000+ | 100.0% | 0/4.54 |  |
| 6 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 21 | 3 | 381 | 0/0/0 | 1000+ | 100.0% | 0/4.7 |  |
| 7 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 15 | 4 | 357 | 1/1/1 | 1000+ | 100.0% | 0/4.57 |  |
| 8 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 23 | 4 | 392 | 0/0/0 | 1000+ | 100.0% | 0/4.73 |  |
| 9 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 11 | 4 | 200 | 1/1/1 | 1000+ | 100.0% | 0/4.4 |  |
| 10 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 28 | 5 | 500 | 1/1/1 | 1000+ | 100.0% | 0/4.78 |  |
| 11 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 21 | 6 | 351 | 1/1/1 | 1000+ | 100.0% | 0/4.7 |  |
| 12 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 19 | 5 | 313 | 1/1/1 | 1000+ | 100.0% | 0/4.67 |  |
| 13 | 1 | early | 85.0%-100.0% | 100.0% | 97.5% | 71.0% | yes | 14 | 7 | 247 | 2/2/2 | 1000+ | 100.0% | 0/4.54 |  |
| 14 | 1 | early | 85.0%-100.0% | 100.0% | 96.3% | 82.3% | yes | 25 | 7 | 420 | 1/1/1 | 1000+ | 100.0% | 0/4.75 |  |
| 15 | 1 | early | 85.0%-100.0% | 100.0% | 99.8% | 92.8% | yes | 21 | 7 | 434 | 2/2/2 | 1000+ | 100.0% | 0/4.7 |  |
| 16 | 1 | saw0 | 62.0%-80.0% | 100.0% | 76.5% | 41.5% | yes | 41 | 7 | 422 | 3/3/3 | 1000+ | 100.0% | 0/4.58 |  |
| 17 | 1 | saw1 | 46.0%-64.0% | 100.0% | 57.0% | 28.5% | yes | 53 | 8 | 605 | 4/4/4 | 1000+ | 100.0% | 0/4.88 |  |
| 18 | 1 | saw2 | 30.0%-48.0% | 76.5% | 38.5% | 12.8% | yes | 53 | 9 | 513 | 2/2/2 | 1000+ | 100.0% | 0/4.87 |  |
| 19 | 1 | saw0 | 62.0%-80.0% | 98.3% | 69.8% | 31.3% | yes | 26 | 8 | 306 | 2/2/2 | 1000+ | 99.0% | 0/4.36 |  |
| 20 | 1 | saw1 | 46.0%-64.0% | 100.0% | 55.5% | 29.0% | yes | 47 | 7 | 405 | 1/1/1 | 1000+ | 100.0% | 0/4.76 |  |
| 21 | 1 | saw2 | 30.0%-48.0% | 63.7% | 39.3% | 24.3% | yes | 26 | 9 | 299 | 2/2/2 | 1000+ | 100.0% | 0/4.4 |  |
| 22 | 1 | saw0 | 62.0%-80.0% | 98.5% | 77.3% | 57.0% | yes | 45 | 8 | 537 | 2/2/2 | 1000+ | 100.0% | 0/4.75 |  |
| 23 | 1 | saw1 | 46.0%-64.0% | 100.0% | 54.8% | 27.0% | yes | 40 | 7 | 397 | 2/2/2 | 1000+ | 100.0% | 0/4.77 |  |
| 24 | 1 | saw2 | 30.0%-48.0% | 99.0% | 39.3% | 16.5% | yes | 45 | 8 | 519 | 2/2/2 | 1000+ | 100.0% | 0/4.75 |  |
| 25 | 1 | saw0 | 62.0%-80.0% | 91.0% | 72.3% | 58.3% | yes | 36 | 8 | 455 | 1/1/1 | 1000+ | 100.0% | 0/4.71 |  |
| 26 | 2 | saw1 | 46.0%-64.0% | 100.0% | 100.0% | 100.0% | exempt | 7 | 5 | 54 | 0/0/0 | 1000+ | 100.0% | 0/4 | teaching: gate |
| 27 | 2 | saw2 | 30.0%-48.0% | 100.0% | 40.5% | 19.8% | yes | 46 | 9 | 581 | 4/4/4 | 1000+ | 74.0% | 0/4.87 |  |
| 28 | 2 | saw0 | 62.0%-80.0% | 89.3% | 71.3% | 24.8% | yes | 23 | 8 | 293 | 4/4/4 | 1000+ | 88.0% | 0/4.5 |  |
| 29 | 2 | saw1 | 46.0%-64.0% | 100.0% | 58.3% | 35.0% | yes | 43 | 7 | 348 | 4/4/4 | 1000+ | 100.0% | 0/4.1 |  |
| 30 | 2 | saw2 | 30.0%-48.0% | 55.5% | 37.0% | 16.5% | yes | 41 | 8 | 465 | 4/4/4 | 1000+ | 41.0% | 0/4.85 |  |
| 31 | 2 | saw0 | 62.0%-80.0% | 86.5% | 71.0% | 49.8% | yes | 38 | 9 | 417 | 4/4/4 | 1000+ | 100.0% | 0/4.84 |  |
| 32 | 2 | saw1 | 46.0%-64.0% | 86.8% | 53.5% | 22.3% | yes | 36 | 7 | 401 | 3/3/3 | 1000+ | 90.0% | 0/4.83 |  |
| 33 | 2 | saw2 | 30.0%-48.0% | 56.8% | 39.5% | 27.3% | yes | 37 | 9 | 380 | 4/4/4 | 1000+ | 97.0% | 0/4.72 |  |
| 34 | 2 | saw0 | 62.0%-80.0% | 91.3% | 68.5% | 50.7% | yes | 55 | 8 | 541 | 3/3/3 | 1000+ | 100.0% | 0/4.87 |  |
| 35 | 2 | saw1 | 46.0%-64.0% | 74.5% | 53.3% | 32.0% | yes | 29 | 9 | 328 | 3/3/3 | 1000+ | 88.0% | 0/4.71 |  |
| 36 | 2 | saw2 | 30.0%-48.0% | 66.0% | 39.3% | 12.5% | yes | 41 | 8 | 453 | 4/4/4 | 1000+ | 74.0% | 0/4.85 |  |
| 37 | 2 | saw0 | 62.0%-80.0% | 100.0% | 72.5% | 35.5% | yes | 52 | 7 | 462 | 3/3/3 | 1000+ | 100.0% | 0/4.65 |  |
| 38 | 2 | saw1 | 46.0%-64.0% | 79.3% | 54.8% | 27.8% | yes | 41 | 8 | 474 | 4/4/4 | 1000+ | 100.0% | 0/4.67 |  |
| 39 | 2 | saw2 | 30.0%-48.0% | 62.3% | 39.8% | 21.5% | yes | 50 | 9 | 514 | 4/4/4 | 1000+ | 88.0% | 0/4.84 |  |
| 40 | 2 | saw0 | 62.0%-80.0% | 97.0% | 70.3% | 49.0% | yes | 41 | 9 | 413 | 2/2/2 | 1000+ | 100.0% | 0/4.45 |  |
| 41 | 2 | saw1 | 46.0%-64.0% | 84.5% | 56.5% | 31.3% | yes | 51 | 8 | 550 | 4/4/4 | 1000+ | 100.0% | 0/4.82 |  |
| 42 | 2 | saw2 | 30.0%-48.0% | 76.3% | 38.3% | 10.0% | yes | 31 | 8 | 380 | 4/4/4 | 1000+ | 71.0% | 0/4.73 |  |
| 43 | 2 | saw0 | 62.0%-80.0% | 86.8% | 67.0% | 29.5% | yes | 34 | 9 | 408 | 4/4/4 | 1000+ | 97.0% | 0/4.76 |  |
| 44 | 2 | saw1 | 46.0%-64.0% | 78.5% | 55.3% | 32.5% | yes | 29 | 9 | 404 | 3/3/3 | 1000+ | 92.0% | 0/4.79 |  |
| 45 | 2 | saw2 | 30.0%-48.0% | 60.8% | 40.3% | 29.3% | yes | 48 | 9 | 549 | 4/4/4 | 1000+ | 100.0% | 0/4.7 |  |
| 46 | 2 | hard | 0.0%-10.0% | 15.8% | 5.0% | 0.8% | yes | 33 | 11 | 387 | 3/3/3 | 1000+ | 12.0% | 0/4.26 |  |
| 47 | 2 | hard | 0.0%-10.0% | 49.8% | 5.5% | 0.8% | yes | 30 | 10 | 347 | 4/4/4 | 1000+ | 6.0% | 0/4.31 |  |
| 48 | 2 | hard | 0.0%-10.0% | 11.0% | 4.0% | 1.3% | yes | 35 | 11 | 458 | 3/3/3 | 1000+ | 14.0% | 0/4.62 |  |
| 49 | 2 | hardest | 0.0%-5.0% | 95.3% | 3.3% | 0.0% | yes | 33 | 11 | 402 | 4/4/4 | 1000+ | 10.0% | 0/4.56 |  |
| 50 | 2 | relief | 25.0%-60.0% | 100.0% | 44.5% | 15.3% | yes | 31 | 9 | 419 | 4/4/4 | 1000+ | 56.0% | 0/4.76 |  |
| 51 | 3 | hard | 0.0%-10.0% | 100.0% | 100.0% | 100.0% | exempt | 6 | 4 | 64 | 0/0/0 | 360 | 100.0% | 0/3.6 | teaching: archers |
| 52 | 3 | hard | 0.0%-10.0% | 24.8% | 4.0% | 0.0% | yes | 34 | 11 | 384 | 4/4/4 | 1000+ | 9.0% | 0/4.7 |  |
| 53 | 3 | hard | 0.0%-10.0% | 12.8% | 5.5% | 1.0% | yes | 34 | 12 | 458 | 3/3/3 | 1000+ | 7.0% | 0/4.64 |  |
| 54 | 3 | hardest | 0.0%-5.0% | 13.5% | 3.5% | 0.0% | yes | 52 | 11 | 755 | 4/4/4 | 1000+ | 5.0% | 0/4.86 |  |
| 55 | 3 | relief | 25.0%-60.0% | 67.5% | 42.8% | 2.5% | yes | 42 | 10 | 550 | 3/3/3 | 1000+ | 99.0% | 0/4.85 |  |
| 56 | 3 | hard | 0.0%-10.0% | 23.0% | 5.5% | 0.0% | yes | 51 | 11 | 689 | 2/2/2 | 1000+ | 16.0% | 0/4.88 |  |
| 57 | 3 | hard | 0.0%-10.0% | 11.3% | 3.8% | 0.0% | yes | 49 | 12 | 613 | 4/4/4 | 1000+ | 12.0% | 0/4.81 |  |
| 58 | 3 | hard | 0.0%-10.0% | 16.8% | 4.3% | 0.5% | yes | 54 | 12 | 697 | 3/3/3 | 1000+ | 23.0% | 0/4.73 |  |
| 59 | 3 | hardest | 0.0%-5.0% | 4.5% | 1.5% | 0.0% | yes | 55 | 12 | 790 | 4/4/4 | 1000+ | 22.0% | 0/4.85 |  |
| 60 | 3 | relief | 25.0%-60.0% | 73.5% | 38.3% | 0.0% | yes | 31 | 10 | 378 | 3/3/3 | 1000+ | 84.0% | 0/4.8 |  |
| 61 | 3 | hard | 0.0%-10.0% | 25.0% | 4.8% | 0.0% | yes | 45 | 12 | 642 | 3/3/3 | 1000+ | 10.0% | 0/4.55 |  |
| 62 | 3 | hard | 0.0%-10.0% | 43.5% | 5.3% | 0.0% | yes | 55 | 12 | 805 | 3/3/3 | 1000+ | 11.0% | 0/4.85 |  |
| 63 | 3 | hard | 0.0%-10.0% | 70.5% | 7.2% | 0.0% | yes | 34 | 12 | 398 | 2/2/2 | 1000+ | 11.0% | 0/4.76 |  |
| 64 | 3 | hardest | 0.0%-5.0% | 8.8% | 2.5% | 0.0% | yes | 51 | 12 | 710 | 4/4/4 | 1000+ | 7.0% | 0/4.74 |  |
| 65 | 3 | relief | 25.0%-60.0% | 62.5% | 41.5% | 8.5% | yes | 54 | 9 | 851 | 4/4/4 | 1000+ | 100.0% | 0/4.74 |  |
| 66 | 3 | hard | 0.0%-10.0% | 26.8% | 4.5% | 0.0% | yes | 33 | 11 | 437 | 4/4/4 | 1000+ | 9.0% | 0/4.39 |  |
| 67 | 3 | hard | 0.0%-10.0% | 11.5% | 3.5% | 0.0% | yes | 52 | 12 | 634 | 3/3/3 | 1000+ | 7.0% | 0/4.73 |  |
| 68 | 3 | hard | 0.0%-10.0% | 13.0% | 6.8% | 0.0% | yes | 38 | 11 | 499 | 4/4/4 | 1000+ | 14.0% | 0/4.68 |  |
| 69 | 3 | hardest | 0.0%-5.0% | 5.0% | 3.0% | 0.0% | yes | 44 | 12 | 517 | 2/2/2 | 1000+ | 2.0% | 0/4.72 |  |
| 70 | 3 | relief | 25.0%-60.0% | 82.0% | 44.5% | 0.5% | yes | 55 | 9 | 754 | 3/3/3 | 1000+ | 100.0% | 0/4.83 |  |
| 71 | 3 | hard | 0.0%-10.0% | 16.3% | 5.0% | 0.0% | yes | 47 | 11 | 666 | 4/4/4 | 1000+ | 7.0% | 0/4.69 |  |
| 72 | 3 | hard | 0.0%-10.0% | 17.0% | 5.0% | 0.0% | yes | 50 | 12 | 620 | 4/4/4 | 1000+ | 15.0% | 0/4.73 |  |
| 73 | 3 | hard | 0.0%-10.0% | 69.3% | 2.3% | 0.0% | yes | 48 | 12 | 603 | 4/4/4 | 1000+ | 3.0% | 0/4.87 |  |
| 74 | 3 | hardest | 0.0%-5.0% | 36.8% | 1.8% | 0.0% | yes | 52 | 12 | 632 | 4/4/4 | 1000+ | 9.0% | 0/4.71 |  |
| 75 | 3 | relief | 25.0%-60.0% | 69.5% | 41.5% | 0.5% | yes | 43 | 10 | 613 | 3/3/3 | 1000+ | 69.0% | 0/4.86 |  |

### Bake

```
bake v6: 75 levels, 70 generated on 16 threads
level 52 candidate 1: no deal in 24 attempts
level 52 candidate 3: no deal in 24 attempts
level 52 candidate 4: no deal in 24 attempts
level 52 candidate 11: no deal in 24 attempts
level 54 candidate 3: no deal in 24 attempts
level 56 candidate 0: no deal in 24 attempts
level 56 candidate 1: no deal in 24 attempts
level 56 candidate 2: no deal in 24 attempts
level 56 candidate 4: no deal in 24 attempts
level 57 candidate 3: no deal in 24 attempts
level 57 candidate 5: no deal in 24 attempts
level 58 candidate 1: no deal in 24 attempts
level 58 candidate 3: no deal in 24 attempts
level 58 candidate 7: no deal in 24 attempts
level 59 candidate 3: no deal in 24 attempts
level 62 candidate 3: no deal in 24 attempts
level 63 candidate 6: no deal in 24 attempts
level 63 candidate 8: no deal in 24 attempts
level 63 candidate 11: no deal in 24 attempts
level 64 candidate 2: no deal in 24 attempts
level 64 candidate 10: no deal in 24 attempts
level 66 candidate 0: no deal in 24 attempts
level 66 candidate 3: no deal in 24 attempts
level 66 candidate 10: no deal in 24 attempts
level 67 candidate 2: no deal in 24 attempts
level 67 candidate 8: no deal in 24 attempts
level 67 candidate 9: no deal in 24 attempts
level 68 candidate 2: no deal in 24 attempts
level 69 candidate 11: no deal in 24 attempts
level 70 candidate 3: no deal in 24 attempts
level 70 candidate 4: no deal in 24 attempts
level 71 candidate 10: no deal in 24 attempts
level 72 candidate 11: no deal in 24 attempts
level 73 candidate 2: no deal in 24 attempts
level 73 candidate 10: no deal in 24 attempts
level 74 candidate 8: no deal in 24 attempts
bake: 75 levels in 112.1 s; forts 808, deals 1550, tune evaluations 137985, full grades 560 (x3 difficulties)
bake: 1246 graded candidate decks per second across 16 threads (77.9 per thread)
bake: lookahead player on hard (Normal): median 11.0%, max 23.0% over 17 levels
bake: lookahead player on hardest (Normal): median 7.0%, max 22.0% over 6 levels
bake: taps per level: max 55 (cap 55); late band max 55
```
<!-- bake:end -->
