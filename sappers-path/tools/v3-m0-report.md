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
| early 85.0%-100.0% | 15 | 12/12 | 3 | 94.8% | 100.0% | 100.0% |
| saw0 62.0%-80.0% | 10 | 10/10 | 0 | 70.5% | 71.0% | 72.3% |
| saw1 46.0%-64.0% | 10 | 9/9 | 1 | 51.7% | 54.8% | 100.0% |
| saw2 30.0%-48.0% | 10 | 10/10 | 0 | 36.8% | 39.5% | 42.3% |
| hard 0.0%-10.0% | 18 | 17/17 | 1 | 0.5% | 5.0% | 100.0% |
| hardest 0.0%-5.0% | 6 | 6/6 | 0 | 2.0% | 2.5% | 3.0% |
| relief 25.0%-60.0% | 6 | 6/6 | 0 | 39.3% | 41.3% | 48.3% |

### Every level

| # | Era | Band | Target (Normal) | Easy | Normal | Hard | In band | Cards | Colours | Pixels | Peak line E/N/H | Winning orders (Normal, cap 1000) | Lookahead player (Normal) | Forced turns / mean safe taps | Patient time (Normal, 1x) | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | exempt | 6 | 2 | 44 | 1/1/1 | 360 | 100.0% | 0/3.4 | 21 s | teaching: tray |
| 2 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | exempt | 7 | 3 | 52 | 1/1/1 | 1000+ | 100.0% | 0/3.83 | 23 s | teaching: holding |
| 3 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | exempt | 7 | 3 | 56 | 1/1/1 | 1000+ | 100.0% | 0/3.5 | 25 s | teaching: overshoot |
| 4 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 6 | 3 | 193 | 1/1/1 | 360 | 100.0% | 0/3.8 | 45 s |  |
| 5 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 7 | 3 | 168 | 1/1/1 | 1000+ | 100.0% | 0/4 | 46 s |  |
| 6 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 6 | 3 | 172 | 1/1/1 | 360 | 100.0% | 0/3.8 | 54 s |  |
| 7 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 7 | 4 | 162 | 2/2/2 | 1000+ | 100.0% | 0/4 | 52 s |  |
| 8 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 8 | 4 | 193 | 1/1/1 | 1000+ | 100.0% | 0/4.14 | 61 s |  |
| 9 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 100.0% | yes | 5 | 4 | 124 | 1/1/1 | 120 | 100.0% | 0/3.5 | 52 s |  |
| 10 | 1 | early | 85.0%-100.0% | 98.0% | 95.3% | 86.0% | yes | 10 | 5 | 232 | 2/2/2 | 1000+ | 100.0% | 0/4.33 | 66 s |  |
| 11 | 1 | early | 85.0%-100.0% | 100.0% | 96.8% | 90.8% | yes | 9 | 6 | 163 | 1/1/1 | 1000+ | 100.0% | 0/4.25 | 56 s |  |
| 12 | 1 | early | 85.0%-100.0% | 100.0% | 98.3% | 92.3% | yes | 8 | 5 | 114 | 2/2/2 | 1000+ | 100.0% | 0/4.14 | 50 s |  |
| 13 | 1 | early | 85.0%-100.0% | 100.0% | 94.8% | 84.3% | yes | 9 | 7 | 145 | 3/3/3 | 1000+ | 100.0% | 0/4.25 | 68 s |  |
| 14 | 1 | early | 85.0%-100.0% | 100.0% | 100.0% | 72.8% | yes | 8 | 7 | 127 | 1/1/1 | 1000+ | 100.0% | 0/4.14 | 41 s |  |
| 15 | 1 | early | 85.0%-100.0% | 99.5% | 96.0% | 87.0% | yes | 10 | 7 | 195 | 2/2/2 | 1000+ | 100.0% | 0/4.33 | 69 s |  |
| 16 | 1 | saw0 | 62.0%-80.0% | 83.0% | 72.3% | 59.0% | yes | 14 | 7 | 200 | 2/2/2 | 1000+ | 100.0% | 0/4.54 | 106 s |  |
| 17 | 1 | saw1 | 46.0%-64.0% | 100.0% | 54.8% | 29.5% | yes | 7 | 7 | 157 | 2/2/2 | 720 | 76.0% | 0/4 | 63 s |  |
| 18 | 1 | saw2 | 30.0%-48.0% | 51.5% | 39.5% | 28.7% | yes | 12 | 8 | 128 | 2/2/2 | 1000+ | 100.0% | 0/3.91 | 48 s |  |
| 19 | 1 | saw0 | 62.0%-80.0% | 81.0% | 70.5% | 43.0% | yes | 11 | 7 | 206 | 2/2/2 | 1000+ | 100.0% | 0/4 | 75 s |  |
| 20 | 1 | saw1 | 46.0%-64.0% | 82.0% | 51.7% | 32.8% | yes | 16 | 7 | 234 | 3/3/3 | 1000+ | 100.0% | 0/4.2 | 88 s |  |
| 21 | 1 | saw2 | 30.0%-48.0% | 53.8% | 40.3% | 26.5% | yes | 13 | 8 | 265 | 2/2/2 | 1000+ | 100.0% | 0/4.5 | 136 s |  |
| 22 | 1 | saw0 | 62.0%-80.0% | 80.0% | 71.5% | 60.8% | yes | 14 | 7 | 213 | 2/2/2 | 1000+ | 100.0% | 0/4.54 | 115 s |  |
| 23 | 1 | saw1 | 46.0%-64.0% | 82.3% | 55.0% | 31.8% | yes | 12 | 8 | 212 | 2/2/2 | 1000+ | 75.0% | 0/4.45 | 77 s |  |
| 24 | 1 | saw2 | 30.0%-48.0% | 57.8% | 36.8% | 18.3% | yes | 11 | 8 | 177 | 2/2/2 | 1000+ | 63.0% | 0/4.4 | 59 s |  |
| 25 | 1 | saw0 | 62.0%-80.0% | 100.0% | 71.3% | 50.7% | yes | 7 | 7 | 138 | 2/2/2 | 1000+ | 100.0% | 0/4 | 40 s |  |
| 26 | 2 | saw1 | 46.0%-64.0% | 100.0% | 100.0% | 100.0% | exempt | 7 | 5 | 54 | 1/1/1 | 1000+ | 100.0% | 0/4 | 38 s | teaching: gate |
| 27 | 2 | saw2 | 30.0%-48.0% | 74.8% | 39.3% | 17.3% | yes | 12 | 8 | 195 | 4/4/4 | 1000+ | 100.0% | 0/4.45 | 87 s |  |
| 28 | 2 | saw0 | 62.0%-80.0% | 92.0% | 70.5% | 30.5% | yes | 16 | 7 | 219 | 4/4/4 | 1000+ | 100.0% | 0/4.6 | 100 s |  |
| 29 | 2 | saw1 | 46.0%-64.0% | 79.0% | 56.5% | 39.0% | yes | 14 | 7 | 213 | 3/3/3 | 1000+ | 64.0% | 0/4.31 | 74 s |  |
| 30 | 2 | saw2 | 30.0%-48.0% | 52.3% | 38.8% | 20.5% | yes | 16 | 8 | 210 | 4/4/4 | 1000+ | 93.0% | 0/4.57 | 113 s |  |
| 31 | 2 | saw0 | 62.0%-80.0% | 82.5% | 71.0% | 56.3% | yes | 11 | 7 | 194 | 4/4/4 | 1000+ | 88.0% | 0/4 | 82 s |  |
| 32 | 2 | saw1 | 46.0%-64.0% | 74.0% | 53.5% | 10.0% | yes | 10 | 8 | 173 | 4/4/4 | 1000+ | 87.0% | 0/3.33 | 73 s |  |
| 33 | 2 | saw2 | 30.0%-48.0% | 58.5% | 42.3% | 18.5% | yes | 17 | 8 | 239 | 4/4/4 | 1000+ | 100.0% | 0/4.63 | 118 s |  |
| 34 | 2 | saw0 | 62.0%-80.0% | 84.3% | 70.5% | 50.2% | yes | 19 | 9 | 223 | 4/4/4 | 1000+ | 90.0% | 0/4.65 | 106 s |  |
| 35 | 2 | saw1 | 46.0%-64.0% | 87.5% | 54.0% | 28.2% | yes | 12 | 7 | 144 | 3/3/3 | 1000+ | 78.0% | 0/4.45 | 63 s |  |
| 36 | 2 | saw2 | 30.0%-48.0% | 77.5% | 40.8% | 13.5% | yes | 16 | 8 | 258 | 3/3/3 | 1000+ | 83.0% | 0/4.6 | 91 s |  |
| 37 | 2 | saw0 | 62.0%-80.0% | 86.3% | 71.5% | 48.5% | yes | 9 | 7 | 169 | 3/3/3 | 1000+ | 100.0% | 0/4.25 | 55 s |  |
| 38 | 2 | saw1 | 46.0%-64.0% | 72.5% | 55.0% | 33.5% | yes | 17 | 7 | 243 | 3/3/3 | 1000+ | 100.0% | 0/4.44 | 129 s |  |
| 39 | 2 | saw2 | 30.0%-48.0% | 61.8% | 38.3% | 15.3% | yes | 12 | 8 | 193 | 4/4/4 | 1000+ | 87.0% | 0/4 | 101 s |  |
| 40 | 2 | saw0 | 62.0%-80.0% | 87.0% | 71.3% | 49.5% | yes | 16 | 9 | 254 | 4/4/4 | 1000+ | 94.0% | 0/4.27 | 101 s |  |
| 41 | 2 | saw1 | 46.0%-64.0% | 83.3% | 55.8% | 31.5% | yes | 12 | 7 | 179 | 3/3/3 | 1000+ | 85.0% | 0/4.27 | 71 s |  |
| 42 | 2 | saw2 | 30.0%-48.0% | 62.7% | 39.5% | 18.3% | yes | 10 | 8 | 157 | 3/3/3 | 1000+ | 91.0% | 0/4.33 | 65 s |  |
| 43 | 2 | saw0 | 62.0%-80.0% | 82.3% | 70.5% | 37.0% | yes | 19 | 9 | 176 | 4/4/4 | 1000+ | 100.0% | 0/3.56 | 98 s |  |
| 44 | 2 | saw1 | 46.0%-64.0% | 72.8% | 54.3% | 24.0% | yes | 10 | 7 | 180 | 4/4/4 | 1000+ | 88.0% | 0/4.25 | 89 s |  |
| 45 | 2 | saw2 | 30.0%-48.0% | 57.0% | 39.5% | 19.5% | yes | 15 | 9 | 193 | 4/4/4 | 1000+ | 91.0% | 0/4.57 | 111 s |  |
| 46 | 2 | hard | 0.0%-10.0% | 32.8% | 4.5% | 0.8% | yes | 19 | 10 | 201 | 4/4/4 | 1000+ | 3.0% | 0/4.5 | 89 s |  |
| 47 | 2 | hard | 0.0%-10.0% | 15.3% | 7.8% | 2.0% | yes | 16 | 10 | 249 | 4/4/4 | 1000+ | 5.0% | 0/4.6 | 97 s |  |
| 48 | 2 | hard | 0.0%-10.0% | 21.5% | 5.8% | 1.0% | yes | 17 | 10 | 248 | 4/4/4 | 1000+ | 17.0% | 0/3.75 | 109 s |  |
| 49 | 2 | hardest | 0.0%-5.0% | 5.5% | 2.5% | 0.0% | yes | 15 | 10 | 264 | 4/4/4 | 1000+ | 1.0% | 0/3.93 | 132 s |  |
| 50 | 2 | relief | 25.0%-60.0% | 74.8% | 43.3% | 22.8% | yes | 11 | 9 | 194 | 3/3/3 | 1000+ | 92.0% | 0/3.78 | 74 s |  |
| 51 | 3 | hard | 0.0%-10.0% | 100.0% | 100.0% | 100.0% | exempt | 6 | 4 | 64 | 1/1/1 | 360 | 100.0% | 0/3.6 | 26 s | teaching: archers |
| 52 | 3 | hard | 0.0%-10.0% | 9.5% | 2.3% | 0.0% | yes | 26 | 11 | 309 | 2/2/2 | 1000+ | 6.0% | 0/4.72 | 172 s |  |
| 53 | 3 | hard | 0.0%-10.0% | 12.0% | 2.3% | 0.0% | yes | 19 | 11 | 291 | 4/4/4 | 1000+ | 19.0% | 0/4.47 | 154 s |  |
| 54 | 3 | hardest | 0.0%-5.0% | 5.5% | 2.3% | 0.3% | yes | 25 | 12 | 328 | 4/4/4 | 1000+ | 10.0% | 0/4.3 | 179 s |  |
| 55 | 3 | relief | 25.0%-60.0% | 57.8% | 39.8% | 4.3% | yes | 18 | 9 | 238 | 3/3/3 | 1000+ | 100.0% | 0/4.29 | 89 s |  |
| 56 | 3 | hard | 0.0%-10.0% | 6.5% | 2.3% | 0.3% | yes | 18 | 11 | 275 | 4/4/4 | 1000+ | 6.0% | 0/4 | 99 s |  |
| 57 | 3 | hard | 0.0%-10.0% | 9.8% | 3.0% | 0.0% | yes | 25 | 11 | 283 | 4/4/4 | 1000+ | 23.0% | 0/4.04 | 155 s |  |
| 58 | 3 | hard | 0.0%-10.0% | 11.5% | 6.5% | 1.0% | yes | 20 | 12 | 293 | 3/3/3 | 1000+ | 21.0% | 0/4.47 | 149 s |  |
| 59 | 3 | hardest | 0.0%-5.0% | 6.8% | 2.8% | 0.0% | yes | 21 | 11 | 253 | 3/3/3 | 1000+ | 11.0% | 0/4.28 | 115 s |  |
| 60 | 3 | relief | 25.0%-60.0% | 100.0% | 46.0% | 18.0% | yes | 15 | 9 | 206 | 1/1/1 | 1000+ | 100.0% | 0/4.29 | 103 s |  |
| 61 | 3 | hard | 0.0%-10.0% | 22.3% | 4.3% | 1.0% | yes | 20 | 11 | 313 | 3/3/3 | 1000+ | 19.0% | 0/4.21 | 151 s |  |
| 62 | 3 | hard | 0.0%-10.0% | 13.0% | 6.3% | 1.8% | yes | 17 | 11 | 246 | 3/3/3 | 1000+ | 14.0% | 0/4.56 | 111 s |  |
| 63 | 3 | hard | 0.0%-10.0% | 12.8% | 5.3% | 0.0% | yes | 18 | 11 | 295 | 4/4/4 | 1000+ | 15.0% | 0/4.31 | 143 s |  |
| 64 | 3 | hardest | 0.0%-5.0% | 9.0% | 2.0% | 0.0% | yes | 22 | 12 | 317 | 3/3/3 | 1000+ | 7.0% | 0/4.62 | 167 s |  |
| 65 | 3 | relief | 25.0%-60.0% | 51.5% | 39.3% | 0.5% | yes | 18 | 9 | 241 | 2/2/2 | 1000+ | 100.0% | 0/3.82 | 110 s |  |
| 66 | 3 | hard | 0.0%-10.0% | 11.8% | 5.0% | 0.0% | yes | 26 | 11 | 273 | 4/4/4 | 1000+ | 8.0% | 0/4.72 | 154 s |  |
| 67 | 3 | hard | 0.0%-10.0% | 41.0% | 5.0% | 0.0% | yes | 24 | 11 | 279 | 4/4/4 | 1000+ | 4.0% | 0/4.68 | 131 s |  |
| 68 | 3 | hard | 0.0%-10.0% | 13.3% | 5.8% | 0.3% | yes | 24 | 12 | 293 | 4/4/4 | 1000+ | 12.0% | 0/4.43 | 152 s |  |
| 69 | 3 | hardest | 0.0%-5.0% | 8.3% | 2.5% | 0.5% | yes | 25 | 11 | 257 | 3/3/3 | 1000+ | 21.0% | 0/4.42 | 146 s |  |
| 70 | 3 | relief | 25.0%-60.0% | 72.8% | 41.3% | 3.3% | yes | 14 | 9 | 248 | 4/4/4 | 1000+ | 100.0% | 0/4.54 | 86 s |  |
| 71 | 3 | hard | 0.0%-10.0% | 18.0% | 8.8% | 0.3% | yes | 23 | 12 | 345 | 3/3/3 | 1000+ | 12.0% | 0/3.9 | 157 s |  |
| 72 | 3 | hard | 0.0%-10.0% | 14.8% | 6.5% | 0.5% | yes | 18 | 11 | 224 | 4/4/4 | 1000+ | 13.0% | 0/4.35 | 127 s |  |
| 73 | 3 | hard | 0.0%-10.0% | 5.3% | 0.5% | 0.0% | yes | 20 | 12 | 306 | 4/4/4 | 1000+ | 24.0% | 0/4.16 | 127 s |  |
| 74 | 3 | hardest | 0.0%-5.0% | 5.5% | 3.0% | 0.3% | yes | 20 | 11 | 219 | 3/3/3 | 1000+ | 23.0% | 0/4.05 | 128 s |  |
| 75 | 3 | relief | 25.0%-60.0% | 63.2% | 48.3% | 8.8% | yes | 13 | 10 | 238 | 3/3/3 | 1000+ | 100.0% | 0/4.5 | 86 s |  |

### Bake

```
bake v7: 75 levels, 70 generated on 16 threads
level 70 candidate 2: no deal in 24 attempts
bake: 75 levels in 209.3 s; forts 4799, deals 1059, tune evaluations 181411, full grades 721 (x3 difficulties)
bake: 877 graded candidate decks per second across 16 threads (54.8 per thread)
bake: lookahead player on hard (Normal): median 13.0%, max 24.0% over 17 levels
bake: lookahead player on hardest (Normal): median 10.0%, max 23.0% over 6 levels
bake: patient play-through on the stored Normal line at 1x (generated levels): median 97 s, max 179 s; early 41-69 s; all levels 21-179 s
bake: taps per level: max 26 (cap 55); late band max 26
```
<!-- bake:end -->
