# Sapper's Path v4 M3 rebake (the Siege to 100)

The full rebake for M3: 100 levels in four eras, the v4 twists placed through the campaign, bigger boards and squads, the new `v3.time` swarm values, and the new time targets. Bake config version 8 (`tools/bake-config.json`), seed 20260930, 16 threads, **1,042 s** (17.4 min: candidates 1,028 s, second pass 14 s). The tables between the markers below are written by `node tools/bake.js`; the per-level table has every level's era, band, twists, board, colours, smallest colour distance, taps, the random, one-move-lookahead and fast-tapper rates, the sampling planner (mystery levels), the patient play-through and the longest single tap. Method and decisions: `tools/v4-m3-notes.md` and `SPEC-v4.md` §9.

## Invariants (final bake, every one checked against `levels/levels.json`)

| Invariant | Result |
|---|---|
| The grader grades patient play (tap, wait until nothing moves, tap) | Yes: every rate, stored order and time in the file is from patient play (`tools/grade.js`); the fast tapper is reported beside it, never graded on. |
| Every level winnable on Easy, Normal and Hard with a stored order per difficulty | **100/100** (300 stored orders; each replays to a win through the engine with no refused tap; `SP.selfTest()` replays all 300 through the page's play entry point). |
| Normal bands hold (teaching levels exempt) | **91/91** generated levels in band; 9 teaching levels exempt (1, 2, 3, 26, 35, 51, 62, 76, 77). |
| Time targets (patient play at 1x on the stored Normal line) | Median **129 s** over all 100 (generated median 139 s). Levels 4-15: **66-86 s** (teaching 1-3: 22, 25, 27 s, exempt as tutorials). Max **248 s** (level 100, the boss), the only level over 240 s. |
| Dead-time cap: no single-tap wait over about 15 s | Longest single tap **15.0 s** (cap 15 s, never over), median per level 13.7 s. |
| 55-tap cap | Max **48** taps (median 20); cards max 50 (a linked pair is one tap, two cards). |
| Late lookahead targets (`lookahead`: 25% on hard, hardest and the boss) | **40/40**: hard median 11% (max 25%), hardest median 12% (max 24%), boss 4%. Zero lookahead fallbacks. |
| Power-ups never needed | Nothing in the bake, the grader or the page assumes a power-up; every stored order is plain taps. |
| No near-duplicates | 0 pairs of levels with 90% or more of the same cells. |
| The baker never throws; every fallback reported | 1 fallback: **level 100**, "duration 248 s outside 0-240 s" (the boss; 4 min 8 s, "about 4 minutes"). No level missing. |
| Palette: every pair of materials standing together is ΔE00 25 or more | Min **25.5** (Earth bank / Gilt, as after M1); no new material. |
| Fast tapper: no late level much easier tapped fast | 0 flagged (threshold: fast - patient >= 10 points, or fast > 1.75x patient and >= 3 points over it); largest fast-minus-patient 7.3 points (a relief). |
| Deterministic | `node tools/regrade.js` against the new file: **100 levels, 755 checks, 0 differences**. Two independent bakes differing only in the hardest slots' candidate count (20 against 30) gave 96 byte-identical levels; only the 4 hardest slots whose candidates changed differ. |

<!-- bake:start -->
### Bands on Normal

| Band | Levels | In band | Exempt (teaching) | Normal min | median | max |
|---|---|---|---|---|---|---|
| early 85.0%-100.0% | 15 | 12/12 | 3 | 88.0% | 100.0% | 100.0% |
| saw0 62.0%-80.0% | 10 | 10/10 | 0 | 68.8% | 70.0% | 73.5% |
| saw1 46.0%-64.0% | 10 | 8/8 | 2 | 52.5% | 55.5% | 100.0% |
| saw2 30.0%-48.0% | 10 | 10/10 | 0 | 35.8% | 38.8% | 44.5% |
| hard 0.0%-10.0% | 32 | 28/28 | 4 | 0.0% | 2.5% | 100.0% |
| hardest 0.0%-5.0% | 11 | 11/11 | 0 | 0.0% | 1.8% | 4.0% |
| relief 25.0%-60.0% | 11 | 11/11 | 0 | 36.0% | 40.8% | 56.8% |
| boss 0.0%-5.0% | 1 | 1/1 | 0 | 1.0% | 1.0% | 1.0% |

### Every level

Normal random = the random-tap rate (400 games); lookahead = the one-move-lookahead player (100); fast = the fast tapper (300, from level 46); ? planner = the sampling planner honest / all-seeing (16 games); time and longest tap = patient play on the stored Normal line at 1x; ΔE = the smallest CIEDE2000 between two colours standing in the level.

| # | Era | Band | Twists | Board | Pixels | Colours | Min ΔE00 | Taps (cards) | Normal random | Easy | Hard | Lookahead | Fast | ? planner | Time | Longest tap | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | early | - | 20×18 | 104 | 2 | 54.7 | 6 (6) | 100.0% | 100.0% | 100.0% | 100.0% | - | - | 22 s | 5.9 s | teaching: tray |
| 2 | 1 | early | - | 20×18 | 110 | 3 | 30.9 | 6 (6) | 100.0% | 100.0% | 100.0% | 100.0% | - | - | 25 s | 5.3 s | teaching: holding |
| 3 | 1 | early | - | 20×19 | 108 | 3 | 30.9 | 7 (7) | 100.0% | 100.0% | 100.0% | 100.0% | - | - | 27 s | 5.2 s | teaching: overshoot |
| 4 | 1 | early | - | 23×29 | 280 | 3 | 27.8 | 10 (10) | 100.0% | 100.0% | 100.0% | 100.0% | - | - | 80 s | 14 s |  |
| 5 | 1 | early | - | 22×30 | 294 | 3 | 27.8 | 10 (10) | 100.0% | 100.0% | 98.0% | 100.0% | - | - | 77 s | 11 s |  |
| 6 | 1 | early | - | 20×26 | 235 | 3 | 27.8 | 10 (10) | 100.0% | 100.0% | 99.3% | 100.0% | - | - | 73 s | 15 s |  |
| 7 | 1 | early | - | 22×27 | 412 | 4 | 27.8 | 12 (12) | 97.0% | 100.0% | 91.5% | 100.0% | - | - | 86 s | 12 s |  |
| 8 | 1 | early | - | 22×28 | 356 | 4 | 27.8 | 10 (10) | 93.8% | 98.5% | 87.0% | 100.0% | - | - | 74 s | 11 s |  |
| 9 | 1 | early | - | 22×25 | 310 | 4 | 27.8 | 10 (10) | 100.0% | 100.0% | 100.0% | 100.0% | - | - | 77 s | 14 s |  |
| 10 | 1 | early | - | 19×27 | 283 | 5 | 27.8 | 12 (12) | 91.8% | 96.8% | 82.3% | 100.0% | - | - | 86 s | 13 s |  |
| 11 | 1 | early | - | 23×27 | 388 | 6 | 27.8 | 10 (10) | 94.3% | 99.0% | 88.8% | 100.0% | - | - | 66 s | 12 s |  |
| 12 | 1 | early | - | 23×27 | 339 | 5 | 27.8 | 12 (12) | 100.0% | 100.0% | 100.0% | 100.0% | - | - | 76 s | 14 s |  |
| 13 | 1 | early | - | 22×25 | 299 | 7 | 27.8 | 11 (11) | 93.0% | 96.8% | 84.8% | 100.0% | - | - | 74 s | 12 s |  |
| 14 | 1 | early | - | 20×28 | 329 | 7 | 27.8 | 14 (14) | 96.8% | 100.0% | 85.5% | 100.0% | - | - | 81 s | 10 s |  |
| 15 | 1 | early | - | 24×24 | 270 | 7 | 26.6 | 9 (9) | 88.0% | 95.3% | 73.0% | 100.0% | - | - | 73 s | 12 s |  |
| 16 | 1 | saw0 | - | 22×27 | 265 | 7 | 25.8 | 14 (14) | 68.8% | 76.8% | 60.8% | 100.0% | - | - | 72 s | 13 s |  |
| 17 | 1 | saw1 | - | 21×28 | 293 | 8 | 27.4 | 17 (17) | 55.0% | 74.0% | 32.8% | 95.0% | - | - | 88 s | 15 s |  |
| 18 | 1 | saw2 | - | 19×30 | 377 | 9 | 25.8 | 19 (19) | 44.5% | 61.3% | 31.8% | 100.0% | - | - | 117 s | 14 s |  |
| 19 | 1 | saw0 | - | 19×29 | 285 | 8 | 27.4 | 26 (26) | 69.8% | 80.3% | 57.0% | 100.0% | - | - | 131 s | 15 s |  |
| 20 | 1 | saw1 | - | 24×25 | 331 | 7 | 25.8 | 14 (14) | 55.5% | 83.3% | 30.5% | 85.0% | - | - | 84 s | 14 s |  |
| 21 | 1 | saw2 | - | 20×26 | 259 | 8 | 26.6 | 15 (15) | 38.8% | 56.3% | 21.0% | 77.0% | - | - | 73 s | 14 s |  |
| 22 | 1 | saw0 | - | 20×25 | 261 | 8 | 25.8 | 16 (16) | 70.0% | 82.3% | 60.8% | 100.0% | - | - | 85 s | 9.7 s |  |
| 23 | 1 | saw1 | - | 21×25 | 301 | 7 | 26.6 | 18 (18) | 56.8% | 70.5% | 42.0% | 100.0% | - | - | 100 s | 12 s |  |
| 24 | 1 | saw2 | - | 22×28 | 301 | 8 | 25.8 | 24 (24) | 37.0% | 52.5% | 21.8% | 100.0% | - | - | 120 s | 15 s |  |
| 25 | 1 | saw0 | - | 21×29 | 404 | 8 | 27.4 | 18 (18) | 68.8% | 75.5% | 54.5% | 100.0% | - | - | 125 s | 14 s |  |
| 26 | 2 | saw1 | gates 1 | 16×19 | 54 | 5 | 25.5 | 7 (7) | 100.0% | 100.0% | 100.0% | 100.0% | - | - | 33 s | 10 s | teaching: gate |
| 27 | 2 | saw2 | gates 1 | 22×32 | 341 | 8 | 25.5 | 20 (20) | 38.8% | 53.3% | 23.8% | 93.0% | - | - | 149 s | 14 s |  |
| 28 | 2 | saw0 | gates 1 | 21×27 | 247 | 8 | 25.5 | 11 (11) | 71.0% | 87.8% | 42.8% | 100.0% | - | - | 76 s | 12 s |  |
| 29 | 2 | saw1 | gates 1 | 24×26 | 319 | 8 | 25.5 | 15 (15) | 54.8% | 75.5% | 29.3% | 97.0% | - | - | 98 s | 14 s |  |
| 30 | 2 | saw2 | gates 1 | 24×26 | 317 | 9 | 25.5 | 18 (18) | 39.3% | 56.8% | 14.2% | 100.0% | - | - | 138 s | 14 s |  |
| 31 | 2 | saw0 | gates 2 | 22×25 | 184 | 7 | 25.5 | 12 (12) | 70.0% | 87.8% | 44.8% | 97.0% | - | - | 61 s | 15 s |  |
| 32 | 2 | saw1 | gates 1 | 22×27 | 277 | 7 | 25.5 | 18 (18) | 53.0% | 73.3% | 35.5% | 92.0% | - | - | 103 s | 15 s |  |
| 33 | 2 | saw2 | gates 2 | 22×30 | 273 | 8 | 25.5 | 17 (17) | 39.3% | 57.0% | 24.3% | 99.0% | - | - | 117 s | 13 s |  |
| 34 | 2 | saw0 | gates 1 | 23×28 | 298 | 7 | 25.5 | 15 (15) | 73.5% | 97.3% | 45.3% | 96.0% | - | - | 81 s | 8.3 s |  |
| 35 | 2 | saw1 | gates 1, ? 3 | 22×24 | 232 | 6 | 25.5 | 11 (11) | 79.0% | 97.3% | 60.0% | 100.0% | - | 100.0% / 100.0% | 68 s | 12 s | teaching: mystery |
| 36 | 2 | saw2 | gates 1, ? 3 | 23×28 | 353 | 9 | 25.5 | 21 (21) | 39.5% | 67.5% | 15.3% | 100.0% | - | 100.0% / 100.0% | 157 s | 14 s |  |
| 37 | 2 | saw0 | gates 1, ? 2 | 22×26 | 254 | 8 | 25.5 | 15 (15) | 71.5% | 85.0% | 42.5% | 95.0% | - | 100.0% / 100.0% | 103 s | 13 s |  |
| 38 | 2 | saw1 | gates 2 | 24×26 | 234 | 7 | 25.5 | 13 (13) | 55.8% | 75.3% | 25.5% | 92.0% | - | - | 83 s | 11 s |  |
| 39 | 2 | saw2 | gates 1 | 25×29 | 358 | 8 | 25.5 | 18 (18) | 38.5% | 61.3% | 20.0% | 100.0% | - | - | 133 s | 14 s |  |
| 40 | 2 | saw0 | gates 2 | 25×32 | 311 | 9 | 25.5 | 18 (18) | 70.3% | 88.0% | 41.3% | 87.0% | - | - | 113 s | 15 s |  |
| 41 | 2 | saw1 | gates 1, ? 3 | 24×30 | 389 | 8 | 25.5 | 21 (21) | 58.5% | 78.0% | 35.5% | 98.0% | - | 100.0% / 100.0% | 157 s | 14 s |  |
| 42 | 2 | saw2 | gates 2 | 23×29 | 276 | 9 | 25.5 | 13 (13) | 40.8% | 59.3% | 17.0% | 86.0% | - | - | 86 s | 15 s |  |
| 43 | 2 | saw0 | gates 2, ? 3 | 25×28 | 240 | 8 | 25.5 | 15 (15) | 71.0% | 85.8% | 44.5% | 99.0% | - | 100.0% / 100.0% | 92 s | 13 s |  |
| 44 | 2 | saw1 | gates 1 | 25×32 | 344 | 8 | 25.5 | 15 (15) | 52.5% | 76.0% | 26.8% | 96.0% | - | - | 104 s | 14 s |  |
| 45 | 2 | saw2 | gates 2, ? 3 | 22×32 | 278 | 9 | 25.5 | 16 (16) | 35.8% | 58.5% | 11.0% | 63.0% | - | 100.0% / 100.0% | 113 s | 14 s |  |
| 46 | 2 | hard | gates 1 | 23×31 | 376 | 11 | 25.5 | 22 (22) | 5.5% | 9.8% | 2.8% | 18.0% | 4.3% | - | 158 s | 15 s |  |
| 47 | 2 | hard | gates 1, ? 2 | 26×27 | 371 | 10 | 25.5 | 20 (20) | 6.0% | 17.8% | 1.3% | 10.0% | 7.7% | 100.0% / 100.0% | 121 s | 14 s |  |
| 48 | 2 | hard | gates 1 | 25×30 | 392 | 10 | 25.5 | 28 (28) | 5.8% | 13.0% | 1.5% | 3.0% | 5.0% | - | 172 s | 14 s |  |
| 49 | 2 | hardest | gates 1 | 24×31 | 334 | 11 | 25.5 | 27 (27) | 2.3% | 14.5% | 0.3% | 3.0% | 1.7% | - | 141 s | 14 s |  |
| 50 | 2 | relief | gates 1 | 22×25 | 245 | 10 | 25.5 | 15 (15) | 41.3% | 62.7% | 22.5% | 100.0% | 42.7% | - | 79 s | 12 s |  |
| 51 | 3 | hard | archers 1 | 18×18 | 64 | 4 | 26.6 | 6 (6) | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | - | 20 s | 4.8 s | teaching: archers |
| 52 | 3 | hard | gates 1, archers 4, ? 3 | 24×30 | 311 | 12 | 25.5 | 25 (25) | 2.3% | 10.0% | 0.0% | 11.0% | 0.3% | 68.8% / 75.0% | 170 s | 14 s |  |
| 53 | 3 | hard | gates 1, archers 2, ? 3 | 23×30 | 294 | 12 | 25.5 | 26 (26) | 1.5% | 4.3% | 0.0% | 7.0% | 0.0% | 50.0% / 37.5% | 160 s | 14 s |  |
| 54 | 3 | hardest | gates 1, archers 2 | 23×30 | 328 | 12 | 25.5 | 26 (26) | 2.0% | 6.5% | 0.0% | 21.0% | 2.3% | - | 178 s | 15 s |  |
| 55 | 3 | relief | gates 1, archers 2, ? 2 | 22×22 | 170 | 9 | 26.6 | 11 (11) | 40.5% | 57.3% | 5.8% | 100.0% | 44.3% | 100.0% / 100.0% | 50 s | 8.3 s |  |
| 56 | 3 | hard | gates 1, archers 3, ? 2 | 22×31 | 347 | 11 | 25.5 | 31 (31) | 1.3% | 51.2% | 0.0% | 7.0% | 0.3% | 75.0% / 62.5% | 193 s | 14 s |  |
| 57 | 3 | hard | gates 1, archers 2 | 24×28 | 322 | 12 | 25.5 | 29 (29) | 2.0% | 7.2% | 0.0% | 14.0% | 0.7% | - | 168 s | 14 s |  |
| 58 | 3 | hard | gates 1, archers 3, ? 2 | 25×27 | 338 | 12 | 25.5 | 30 (30) | 1.0% | 1.5% | 0.0% | 21.0% | 1.0% | 100.0% / 100.0% | 163 s | 13 s |  |
| 59 | 3 | hardest | gates 1, archers 3 | 23×31 | 327 | 12 | 25.5 | 27 (27) | 4.0% | 6.5% | 0.0% | 17.0% | 1.0% | - | 229 s | 15 s |  |
| 60 | 3 | relief | gates 1, archers 3 | 19×26 | 194 | 9 | 25.5 | 11 (11) | 40.3% | 61.8% | 4.8% | 100.0% | 38.7% | - | 70 s | 15 s |  |
| 61 | 3 | hard | gates 1, archers 4, ? 2 | 24×32 | 392 | 12 | 25.5 | 35 (35) | 4.3% | 7.2% | 0.0% | 6.0% | 2.0% | 87.5% / 75.0% | 206 s | 14 s |  |
| 62 | 3 | hard | archers 1, linked 1 | 23×28 | 348 | 7 | 26.6 | 14 (15) | 88.3% | 94.5% | 12.8% | 100.0% | 87.0% | - | 94 s | 13 s | teaching: linked |
| 63 | 3 | hard | gates 1, archers 3, ? 2 | 22×31 | 314 | 12 | 25.5 | 29 (29) | 4.3% | 6.3% | 0.0% | 9.0% | 2.3% | 87.5% / 93.8% | 187 s | 14 s |  |
| 64 | 3 | hardest | gates 1, archers 2 | 24×32 | 387 | 11 | 25.8 | 33 (33) | 2.8% | 19.0% | 0.0% | 23.0% | 4.3% | - | 215 s | 14 s |  |
| 65 | 3 | relief | gates 1, archers 4, ? 4 | 22×26 | 269 | 9 | 25.8 | 15 (15) | 40.8% | 57.8% | 4.8% | 100.0% | 40.7% | 100.0% / 100.0% | 101 s | 15 s |  |
| 66 | 3 | hard | gates 1, archers 2, linked 1 | 25×29 | 354 | 11 | 25.5 | 46 (47) | 3.5% | 7.0% | 0.0% | 4.0% | 0.0% | - | 233 s | 15 s |  |
| 67 | 3 | hard | gates 1, archers 2, ? 3, linked 2 | 22×27 | 270 | 11 | 25.5 | 27 (29) | 4.3% | 11.3% | 0.0% | 11.0% | 0.3% | 100.0% / 100.0% | 126 s | 13 s |  |
| 68 | 3 | hard | gates 1, archers 4, ? 2 | 21×30 | 347 | 12 | 25.5 | 22 (22) | 2.0% | 7.2% | 0.0% | 15.0% | 1.7% | 81.3% / 87.5% | 142 s | 13 s |  |
| 69 | 3 | hardest | gates 1, archers 3, ? 4 | 24×27 | 315 | 11 | 25.5 | 27 (27) | 1.0% | 4.5% | 0.0% | 12.0% | 1.0% | 43.8% / 56.3% | 171 s | 13 s |  |
| 70 | 3 | relief | gates 1, archers 2, linked 1 | 20×28 | 216 | 10 | 25.8 | 22 (23) | 39.8% | 61.3% | 3.5% | 100.0% | 26.7% | - | 126 s | 9.8 s |  |
| 71 | 3 | hard | gates 1, archers 3, linked 1 | 21×31 | 317 | 12 | 25.5 | 28 (29) | 2.5% | 8.0% | 0.0% | 7.0% | 1.3% | - | 190 s | 14 s |  |
| 72 | 3 | hard | gates 1, archers 3 | 21×32 | 353 | 11 | 25.8 | 30 (30) | 2.3% | 7.0% | 0.0% | 11.0% | 3.3% | - | 211 s | 14 s |  |
| 73 | 3 | hard | gates 1, archers 4, ? 3 | 24×31 | 396 | 12 | 25.5 | 30 (30) | 2.3% | 5.8% | 0.0% | 10.0% | 2.3% | 62.5% / 68.8% | 195 s | 13 s |  |
| 74 | 3 | hardest | gates 1, archers 2 | 25×29 | 344 | 11 | 25.8 | 26 (26) | 1.8% | 54.0% | 0.0% | 24.0% | 1.3% | - | 160 s | 13 s |  |
| 75 | 3 | relief | gates 1, archers 2, linked 2 | 20×26 | 199 | 9 | 25.8 | 9 (11) | 56.8% | 69.3% | 24.8% | 100.0% | 64.0% | - | 55 s | 13 s |  |
| 76 | 4 | hard | gates 2, archers 1, lock | 27×33 | 327 | 8 | 26.4 | 14 (14) | 58.5% | 76.8% | 13.8% | 100.0% | 58.3% | - | 106 s | 12 s | teaching: lock |
| 77 | 4 | hard | gates 2, archers 3, ? 2, linked 1, lock | 30×36 | 381 | 8 | 26.6 | 18 (19) | 30.0% | 41.3% | 6.3% | 100.0% | 29.0% | 100.0% / 100.0% | 139 s | 14 s | teaching: mixed |
| 78 | 4 | hard | gates 2, archers 3, linked 2 | 26×35 | 361 | 12 | 25.5 | 48 (50) | 2.8% | 6.8% | 0.0% | 14.0% | 0.3% | - | 234 s | 12 s |  |
| 79 | 4 | hardest | gates 2, archers 5, linked 1 | 27×32 | 375 | 11 | 25.8 | 32 (33) | 1.8% | 3.8% | 0.0% | 11.0% | 0.3% | - | 215 s | 14 s |  |
| 80 | 4 | relief | gates 2, archers 4, ? 3 | 26×34 | 393 | 10 | 25.5 | 35 (35) | 42.8% | 57.5% | 3.8% | 100.0% | 47.0% | 100.0% / 100.0% | 207 s | 15 s |  |
| 81 | 4 | hard | gates 2, archers 3, ? 4, lock | 27×34 | 429 | 11 | 25.5 | 21 (21) | 3.0% | 22.3% | 0.0% | 11.0% | 2.0% | 93.8% / 100.0% | 139 s | 14 s |  |
| 82 | 4 | hard | gates 2, archers 3, linked 2 | 29×36 | 413 | 11 | 25.8 | 27 (29) | 0.0% | 0.3% | 0.0% | 12.0% | 0.3% | - | 160 s | 14 s |  |
| 83 | 4 | hard | gates 2, archers 5, ? 4 | 29×35 | 466 | 11 | 25.8 | 33 (33) | 2.3% | 5.3% | 0.0% | 23.0% | 1.7% | 93.8% / 93.8% | 222 s | 14 s |  |
| 84 | 4 | hardest | gates 2, archers 3, ? 3, lock | 29×32 | 435 | 11 | 25.5 | 37 (37) | 3.0% | 6.0% | 0.0% | 3.0% | 3.7% | 62.5% / 68.8% | 236 s | 14 s |  |
| 85 | 4 | relief | gates 2, archers 3, ? 4, linked 2 | 27×32 | 307 | 9 | 26.4 | 28 (30) | 39.8% | 51.7% | 1.8% | 100.0% | 8.7% | 100.0% / 100.0% | 158 s | 13 s |  |
| 86 | 4 | hard | gates 2, archers 3, ? 3, lock | 26×35 | 416 | 11 | 25.5 | 30 (30) | 5.3% | 20.5% | 0.0% | 23.0% | 5.3% | 93.8% / 100.0% | 176 s | 14 s |  |
| 87 | 4 | hard | gates 2, archers 4, ? 4, linked 2, lock | 29×35 | 470 | 11 | 25.8 | 33 (35) | 8.5% | 22.5% | 0.0% | 5.0% | 0.0% | 100.0% / 100.0% | 211 s | 14 s |  |
| 88 | 4 | hard | gates 2, archers 4, ? 4 | 26×33 | 316 | 11 | 25.8 | 33 (33) | 0.0% | 0.8% | 0.0% | 8.0% | 0.0% | 87.5% / 93.8% | 222 s | 15 s |  |
| 89 | 4 | hardest | gates 2, archers 5, linked 1, lock | 29×33 | 440 | 11 | 25.8 | 33 (34) | 0.3% | 1.5% | 0.0% | 17.0% | 0.0% | - | 237 s | 15 s |  |
| 90 | 4 | relief | gates 2, archers 3, lock | 26×34 | 394 | 9 | 25.5 | 31 (31) | 36.0% | 57.3% | 0.3% | 100.0% | 36.7% | - | 223 s | 14 s |  |
| 91 | 4 | hard | gates 2, archers 3, linked 2 | 28×32 | 412 | 11 | 25.5 | 34 (36) | 2.3% | 4.3% | 0.0% | 23.0% | 0.0% | - | 234 s | 15 s |  |
| 92 | 4 | hard | gates 2, archers 3, ? 3, lock | 27×34 | 431 | 11 | 25.5 | 39 (39) | 0.3% | 1.5% | 0.0% | 4.0% | 0.0% | 62.5% / 81.3% | 215 s | 14 s |  |
| 93 | 4 | hard | gates 2, archers 4, ? 2 | 29×32 | 406 | 11 | 25.5 | 30 (30) | 1.0% | 1.8% | 0.0% | 19.0% | 0.0% | 100.0% / 100.0% | 198 s | 15 s |  |
| 94 | 4 | hardest | gates 2, archers 4, ? 2 | 28×34 | 344 | 11 | 25.5 | 34 (34) | 0.0% | 0.0% | 0.0% | 9.0% | 0.0% | 62.5% / 68.8% | 190 s | 13 s |  |
| 95 | 4 | relief | gates 2, archers 3, linked 2 | 26×32 | 347 | 9 | 26.6 | 36 (38) | 41.0% | 49.0% | 0.5% | 100.0% | 43.0% | - | 226 s | 13 s |  |
| 96 | 4 | hard | gates 2, archers 3, ? 3, lock | 29×35 | 454 | 11 | 25.8 | 38 (38) | 1.3% | 5.8% | 0.0% | 10.0% | 1.3% | 100.0% / 100.0% | 209 s | 13 s |  |
| 97 | 4 | hard | gates 2, archers 3, ? 4 | 29×32 | 420 | 12 | 25.5 | 36 (36) | 3.0% | 8.8% | 0.0% | 25.0% | 2.3% | 100.0% / 100.0% | 220 s | 14 s |  |
| 98 | 4 | hardest | gates 2, archers 4, lock | 29×33 | 442 | 11 | 25.8 | 37 (37) | 1.5% | 7.5% | 0.0% | 9.0% | 0.7% | - | 229 s | 12 s |  |
| 99 | 4 | relief | gates 2, archers 5, ? 4, linked 2 | 27×32 | 364 | 9 | 26.6 | 24 (26) | 47.5% | 63.0% | 0.5% | 95.0% | 2.3% | 100.0% / 100.0% | 165 s | 15 s |  |
| 100 | 4 | boss | gates 2, archers 8, ? 4, linked 3, lock | 32×39 | 489 | 12 | 25.5 | 36 (39) | 1.0% | 2.0% | 0.0% | 4.0% | 0.0% | 62.5% / 56.3% | 248 s | 13 s | duration 248 s outside 0-240 s |

### Bake log

```
bake v8: 100 levels, 91 generated on 16 threads
level 31 candidate 3: no deal in 24 attempts
level 32 candidate 5: no deal in 24 attempts
level 36 candidate 5: no deal in 24 attempts
level 39 candidate 3: no deal in 24 attempts
level 41 candidate 6: no deal in 24 attempts
level 47 candidate 18: no deal in 24 attempts
level 48 candidate 5: no deal in 24 attempts
level 48 candidate 9: no deal in 24 attempts
level 48 candidate 14: no deal in 24 attempts
level 49 candidate 4: no deal in 24 attempts
level 49 candidate 6: no deal in 24 attempts
level 49 candidate 10: no deal in 24 attempts
level 49 candidate 19: no deal in 24 attempts
level 49 candidate 25: no deal in 24 attempts
level 49 candidate 28: no deal in 24 attempts
level 49 candidate 29: no deal in 24 attempts
level 50 candidate 1: no deal in 24 attempts
level 52 candidate 0: no deal in 24 attempts
level 52 candidate 3: no deal in 24 attempts
level 52 candidate 4: no deal in 24 attempts
level 52 candidate 6: no deal in 24 attempts
level 52 candidate 7: no deal in 24 attempts
level 52 candidate 10: no deal in 24 attempts
level 52 candidate 11: no deal in 24 attempts
level 52 candidate 17: no deal in 24 attempts
level 52 candidate 19: no deal in 24 attempts
level 53 candidate 2: no deal in 24 attempts
level 53 candidate 3: no deal in 24 attempts
level 53 candidate 5: no deal in 24 attempts
level 53 candidate 7: no deal in 24 attempts
level 53 candidate 9: no deal in 24 attempts
level 53 candidate 12: no deal in 24 attempts
level 53 candidate 13: no deal in 24 attempts
level 53 candidate 14: no deal in 24 attempts
level 53 candidate 16: no deal in 24 attempts
level 53 candidate 17: no deal in 24 attempts
level 53 candidate 18: no deal in 24 attempts
level 54 candidate 0: no deal in 24 attempts
level 54 candidate 3: no deal in 24 attempts
level 54 candidate 4: no deal in 24 attempts
level 54 candidate 9: no deal in 24 attempts
level 54 candidate 10: no deal in 24 attempts
level 54 candidate 12: no deal in 24 attempts
level 54 candidate 16: no deal in 24 attempts
level 54 candidate 18: no deal in 24 attempts
level 54 candidate 22: no deal in 24 attempts
level 54 candidate 23: no deal in 24 attempts
level 54 candidate 24: no deal in 24 attempts
level 54 candidate 27: no deal in 24 attempts
level 55 candidate 3: no deal in 24 attempts
level 55 candidate 5: no deal in 24 attempts
level 55 candidate 7: no deal in 24 attempts
level 56 candidate 7: no deal in 24 attempts
level 56 candidate 8: no deal in 24 attempts
level 56 candidate 9: no deal in 24 attempts
level 56 candidate 17: no deal in 24 attempts
level 57 candidate 1: no deal in 24 attempts
level 57 candidate 3: no deal in 24 attempts
level 57 candidate 6: no deal in 24 attempts
level 57 candidate 9: no deal in 24 attempts
level 57 candidate 10: no deal in 24 attempts
level 57 candidate 14: no deal in 24 attempts
level 57 candidate 15: no deal in 24 attempts
level 57 candidate 17: no deal in 24 attempts
level 57 candidate 18: no deal in 24 attempts
level 58 candidate 1: no deal in 24 attempts
level 58 candidate 4: no deal in 24 attempts
level 58 candidate 5: no deal in 24 attempts
level 58 candidate 8: no deal in 24 attempts
level 58 candidate 9: no deal in 24 attempts
level 58 candidate 10: no deal in 24 attempts
level 58 candidate 11: no deal in 24 attempts
level 58 candidate 12: no deal in 24 attempts
level 58 candidate 14: no deal in 24 attempts
level 58 candidate 16: no deal in 24 attempts
level 58 candidate 17: no deal in 24 attempts
level 58 candidate 18: no deal in 24 attempts
level 59 candidate 0: no deal in 24 attempts
level 59 candidate 7: no deal in 24 attempts
level 59 candidate 9: no deal in 24 attempts
level 59 candidate 11: no deal in 24 attempts
level 59 candidate 13: no deal in 24 attempts
level 59 candidate 16: no deal in 24 attempts
level 59 candidate 17: no deal in 24 attempts
level 59 candidate 19: no deal in 24 attempts
level 59 candidate 21: no deal in 24 attempts
level 59 candidate 24: no deal in 24 attempts
level 59 candidate 26: no deal in 24 attempts
level 59 candidate 28: no deal in 24 attempts
level 59 candidate 29: no deal in 24 attempts
level 60 candidate 1: no deal in 24 attempts
level 60 candidate 5: no deal in 24 attempts
level 61 candidate 0: no deal in 24 attempts
level 61 candidate 1: no deal in 24 attempts
level 61 candidate 2: no deal in 24 attempts
level 61 candidate 3: no deal in 24 attempts
level 61 candidate 5: no deal in 24 attempts
level 61 candidate 7: no deal in 24 attempts
level 61 candidate 9: no deal in 24 attempts
level 61 candidate 14: no deal in 24 attempts
level 61 candidate 18: no deal in 24 attempts
level 63 candidate 1: no deal in 24 attempts
level 63 candidate 3: no deal in 24 attempts
level 63 candidate 5: no deal in 24 attempts
level 63 candidate 8: no deal in 24 attempts
level 63 candidate 15: no deal in 24 attempts
level 63 candidate 18: no deal in 24 attempts
level 64 candidate 2: no deal in 24 attempts
level 64 candidate 3: no deal in 24 attempts
level 64 candidate 5: no deal in 24 attempts
level 64 candidate 6: no deal in 24 attempts
level 64 candidate 7: no deal in 24 attempts
level 64 candidate 9: no deal in 24 attempts
level 64 candidate 18: no deal in 24 attempts
level 64 candidate 21: no deal in 24 attempts
level 64 candidate 27: no deal in 24 attempts
level 64 candidate 29: no deal in 24 attempts
level 65 candidate 7: no deal in 24 attempts
level 66 candidate 0: no deal in 24 attempts
level 66 candidate 1: no deal in 24 attempts
level 66 candidate 3: no deal in 24 attempts
level 66 candidate 4: no deal in 24 attempts
level 66 candidate 5: no deal in 24 attempts
level 66 candidate 7: no deal in 24 attempts
level 66 candidate 13: no deal in 24 attempts
level 66 candidate 14: no deal in 24 attempts
level 66 candidate 15: no deal in 24 attempts
level 66 candidate 19: no deal in 24 attempts
level 67 candidate 0: a linked partner more than a row from its card
level 67 candidate 1: no deal in 24 attempts
level 67 candidate 3: no deal in 24 attempts
level 67 candidate 4: no deal in 24 attempts
level 67 candidate 5: no deal in 24 attempts
level 67 candidate 7: no deal in 24 attempts
level 67 candidate 9: no deal in 24 attempts
level 67 candidate 11: no deal in 24 attempts
level 67 candidate 13: no deal in 24 attempts
level 67 candidate 15: no deal in 24 attempts
level 67 candidate 18: no deal in 24 attempts
level 67 candidate 19: no deal in 24 attempts
level 68 candidate 2: no deal in 24 attempts
level 68 candidate 5: no deal in 24 attempts
level 68 candidate 11: no deal in 24 attempts
level 68 candidate 12: no deal in 24 attempts
level 68 candidate 16: no deal in 24 attempts
level 68 candidate 17: no deal in 24 attempts
level 69 candidate 1: no deal in 24 attempts
level 69 candidate 6: no deal in 24 attempts
level 69 candidate 7: no deal in 24 attempts
level 69 candidate 9: no deal in 24 attempts
level 69 candidate 10: no deal in 24 attempts
level 69 candidate 11: no deal in 24 attempts
level 69 candidate 12: no deal in 24 attempts
level 69 candidate 14: no deal in 24 attempts
level 69 candidate 18: no deal in 24 attempts
level 69 candidate 20: no deal in 24 attempts
level 69 candidate 21: no deal in 24 attempts
level 69 candidate 22: no deal in 24 attempts
level 69 candidate 23: no deal in 24 attempts
level 69 candidate 28: no deal in 24 attempts
level 70 candidate 3: no deal in 24 attempts
level 71 candidate 0: no deal in 24 attempts
level 71 candidate 1: no deal in 24 attempts
level 71 candidate 3: no deal in 24 attempts
level 71 candidate 6: no deal in 24 attempts
level 71 candidate 8: no deal in 24 attempts
level 71 candidate 9: no deal in 24 attempts
level 71 candidate 10: no deal in 24 attempts
level 71 candidate 14: no deal in 24 attempts
level 71 candidate 15: no deal in 24 attempts
level 71 candidate 18: no deal in 24 attempts
level 71 candidate 19: no deal in 24 attempts
level 72 candidate 0: no deal in 24 attempts
level 72 candidate 1: no deal in 24 attempts
level 72 candidate 3: no deal in 24 attempts
level 72 candidate 7: no deal in 24 attempts
level 72 candidate 8: no deal in 24 attempts
level 72 candidate 9: no deal in 24 attempts
level 72 candidate 12: no deal in 24 attempts
level 72 candidate 14: no deal in 24 attempts
level 72 candidate 15: no deal in 24 attempts
level 72 candidate 16: no deal in 24 attempts
level 72 candidate 17: no deal in 24 attempts
level 72 candidate 18: no deal in 24 attempts
level 72 candidate 19: no deal in 24 attempts
level 73 candidate 0: no deal in 24 attempts
level 73 candidate 2: no deal in 24 attempts
level 73 candidate 7: no deal in 24 attempts
level 73 candidate 8: no deal in 24 attempts
level 73 candidate 9: no deal in 24 attempts
level 73 candidate 10: no deal in 24 attempts
level 73 candidate 11: no deal in 24 attempts
level 73 candidate 17: no deal in 24 attempts
level 73 candidate 19: no deal in 24 attempts
level 74 candidate 0: no deal in 24 attempts
level 74 candidate 2: no deal in 24 attempts
level 74 candidate 6: no deal in 24 attempts
level 74 candidate 10: no deal in 24 attempts
level 74 candidate 13: no deal in 24 attempts
level 74 candidate 14: no deal in 24 attempts
level 74 candidate 15: no deal in 24 attempts
level 74 candidate 16: no deal in 24 attempts
level 74 candidate 18: no deal in 24 attempts
level 74 candidate 19: no deal in 24 attempts
level 74 candidate 23: no deal in 24 attempts
level 74 candidate 25: no deal in 24 attempts
level 74 candidate 29: no deal in 24 attempts
level 75 candidate 1: no deal in 24 attempts
level 78 candidate 0: no deal in 24 attempts
level 78 candidate 2: no deal in 24 attempts
level 78 candidate 5: no deal in 24 attempts
level 78 candidate 9: no deal in 24 attempts
level 78 candidate 10: no deal in 24 attempts
level 78 candidate 11: a linked partner more than a row from its card
level 79 candidate 1: no deal in 24 attempts
level 79 candidate 6: no deal in 24 attempts
level 79 candidate 9: no deal in 24 attempts
level 79 candidate 14: no deal in 24 attempts
level 79 candidate 18: no deal in 24 attempts
level 79 candidate 19: no deal in 24 attempts
level 79 candidate 20: no deal in 24 attempts
level 79 candidate 22: no deal in 24 attempts
level 79 candidate 23: no deal in 24 attempts
level 79 candidate 27: no deal in 24 attempts
level 79 candidate 28: no deal in 24 attempts
level 80 candidate 2: no deal in 24 attempts
level 80 candidate 5: no deal in 24 attempts
level 81 candidate 3: no deal in 24 attempts
level 81 candidate 4: no deal in 24 attempts
level 81 candidate 16: no deal in 24 attempts
level 81 candidate 17: no deal in 24 attempts
level 81 candidate 18: no deal in 24 attempts
level 82 candidate 1: no deal in 24 attempts
level 82 candidate 2: no deal in 24 attempts
level 82 candidate 3: no deal in 24 attempts
level 82 candidate 4: no deal in 24 attempts
level 82 candidate 13: no deal in 24 attempts
level 82 candidate 18: no deal in 24 attempts
level 83 candidate 2: no deal in 24 attempts
level 83 candidate 6: no deal in 24 attempts
level 83 candidate 7: no deal in 24 attempts
level 83 candidate 8: no deal in 24 attempts
level 83 candidate 11: no deal in 24 attempts
level 83 candidate 12: no deal in 24 attempts
level 83 candidate 18: no deal in 24 attempts
level 83 candidate 19: no deal in 24 attempts
level 84 candidate 4: no deal in 24 attempts
level 84 candidate 6: no deal in 24 attempts
level 84 candidate 7: no deal in 24 attempts
level 84 candidate 8: no deal in 24 attempts
level 84 candidate 11: no deal in 24 attempts
level 84 candidate 12: no deal in 24 attempts
level 84 candidate 13: no deal in 24 attempts
level 84 candidate 17: no deal in 24 attempts
level 84 candidate 18: no deal in 24 attempts
level 84 candidate 22: no deal in 24 attempts
level 84 candidate 23: no deal in 24 attempts
level 84 candidate 27: no deal in 24 attempts
level 84 candidate 28: no deal in 24 attempts
level 84 candidate 29: no deal in 24 attempts
level 85 candidate 1: no deal in 24 attempts
level 85 candidate 2: no deal in 24 attempts
level 85 candidate 3: no deal in 24 attempts
level 86 candidate 10: no deal in 24 attempts
level 86 candidate 14: no deal in 24 attempts
level 86 candidate 15: no deal in 24 attempts
level 86 candidate 19: no deal in 24 attempts
level 87 candidate 3: no deal in 24 attempts
level 87 candidate 4: no deal in 24 attempts
level 87 candidate 10: no deal in 24 attempts
level 87 candidate 11: no deal in 24 attempts
level 87 candidate 16: no deal in 24 attempts
level 88 candidate 0: no deal in 24 attempts
level 88 candidate 4: no deal in 24 attempts
level 88 candidate 7: no deal in 24 attempts
level 88 candidate 8: no deal in 24 attempts
level 88 candidate 9: no deal in 24 attempts
level 88 candidate 11: no deal in 24 attempts
level 88 candidate 18: no deal in 24 attempts
level 89 candidate 1: no deal in 24 attempts
level 89 candidate 3: no deal in 24 attempts
level 89 candidate 4: no deal in 24 attempts
level 89 candidate 7: no deal in 24 attempts
level 89 candidate 15: no deal in 24 attempts
level 89 candidate 19: no deal in 24 attempts
level 89 candidate 22: no deal in 24 attempts
level 89 candidate 27: no deal in 24 attempts
level 91 candidate 2: no deal in 24 attempts
level 91 candidate 7: no deal in 24 attempts
level 91 candidate 9: no deal in 24 attempts
level 91 candidate 11: no deal in 24 attempts
level 91 candidate 13: no deal in 24 attempts
level 91 candidate 15: no deal in 24 attempts
level 91 candidate 19: no deal in 24 attempts
level 92 candidate 1: no deal in 24 attempts
level 92 candidate 2: no deal in 24 attempts
level 92 candidate 4: no deal in 24 attempts
level 92 candidate 5: no deal in 24 attempts
level 92 candidate 7: no deal in 24 attempts
level 92 candidate 8: no deal in 24 attempts
level 92 candidate 12: no deal in 24 attempts
level 92 candidate 16: no deal in 24 attempts
level 92 candidate 17: no deal in 24 attempts
level 93 candidate 0: no deal in 24 attempts
level 93 candidate 2: no deal in 24 attempts
level 93 candidate 9: no deal in 24 attempts
level 93 candidate 11: no deal in 24 attempts
level 93 candidate 16: no deal in 24 attempts
level 93 candidate 17: no deal in 24 attempts
level 94 candidate 3: no deal in 24 attempts
level 94 candidate 4: no deal in 24 attempts
level 94 candidate 5: no deal in 24 attempts
level 94 candidate 7: no deal in 24 attempts
level 94 candidate 10: no deal in 24 attempts
level 94 candidate 11: no deal in 24 attempts
level 94 candidate 12: no deal in 24 attempts
level 94 candidate 14: no deal in 24 attempts
level 94 candidate 16: no deal in 24 attempts
level 94 candidate 18: no deal in 24 attempts
level 94 candidate 19: no deal in 24 attempts
level 94 candidate 22: no deal in 24 attempts
level 94 candidate 24: no deal in 24 attempts
level 94 candidate 26: no deal in 24 attempts
level 94 candidate 27: no deal in 24 attempts
level 94 candidate 29: no deal in 24 attempts
level 95 candidate 0: no deal in 24 attempts
level 95 candidate 1: no deal in 24 attempts
level 95 candidate 6: no deal in 24 attempts
level 96 candidate 0: no deal in 24 attempts
level 96 candidate 1: no deal in 24 attempts
level 96 candidate 3: no deal in 24 attempts
level 96 candidate 5: no deal in 24 attempts
level 96 candidate 6: no deal in 24 attempts
level 96 candidate 8: no deal in 24 attempts
level 96 candidate 10: no deal in 24 attempts
level 96 candidate 11: no deal in 24 attempts
level 96 candidate 18: no deal in 24 attempts
level 97 candidate 0: no deal in 24 attempts
level 97 candidate 1: no deal in 24 attempts
level 97 candidate 3: no deal in 24 attempts
level 97 candidate 4: no deal in 24 attempts
level 97 candidate 5: no deal in 24 attempts
level 97 candidate 15: no deal in 24 attempts
level 97 candidate 16: no deal in 24 attempts
level 97 candidate 18: no deal in 24 attempts
level 98 candidate 6: no deal in 24 attempts
level 98 candidate 9: no deal in 24 attempts
level 98 candidate 12: no deal in 24 attempts
level 98 candidate 13: no deal in 24 attempts
level 98 candidate 16: no deal in 24 attempts
level 98 candidate 20: no deal in 24 attempts
level 98 candidate 21: no deal in 24 attempts
level 98 candidate 25: no deal in 24 attempts
level 98 candidate 28: no deal in 24 attempts
level 99 candidate 1: no deal in 24 attempts
level 99 candidate 2: no deal in 24 attempts
level 99 candidate 3: no deal in 24 attempts
level 100 candidate 4: a linked partner more than a row from its card
level 100 candidate 6: no deal in 24 attempts
level 100 candidate 13: a linked partner more than a row from its card
level 100 candidate 15: a linked partner more than a row from its card
level 100 candidate 21: a linked partner more than a row from its card
level 100 candidate 30: a linked partner more than a row from its card
level 100 candidate 31: no deal in 24 attempts
level 100 candidate 36: a linked partner more than a row from its card
level 100 candidate 38: a linked partner more than a row from its card
level 100: fallback, duration 248 s outside 0-240 s
bake: 100 levels picked in 1027.5 s; forts 4979, deals 10521, tune evaluations 172731, full grades 928 (x3 difficulties)
bake: 100 levels in 1041.7 s (candidates 1028 s, second pass 14 s)
bake: 171 graded candidate decks per second across 16 threads
bake: lookahead player on hard (Normal): median 11.0%, max 25.0% over 28 levels
bake: lookahead player on hardest (Normal): median 12.0%, max 24.0% over 11 levels
bake: lookahead player on boss (Normal): median 4.0%, max 4.0% over 1 levels
bake: patient play-through on the stored Normal line at 1x (generated levels): median 139 s, max 248 s; early 66 s-86 s; all levels median 126 s, 20 s-248 s
bake: longest single tap on the stored Normal line: median 14 s, max 15 s (cap 15 s)
bake: taps per level: max 48 (cap 55), median 20; cards max 50
```
<!-- bake:end -->
