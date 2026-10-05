# Sapper's Path v5 R4 bake (levels 101-200)

Written by tools/bake.js (v5 R4): a full run of 101-200, fix-up runs merged (tools/v5-r4-notes.md §3). v5 R4 fix pass: 101-124 and 175-200 re-baked on the new Mistmoor and throne generators, with two lookahead fix-ups, merged (tools/v5-r4-notes.md §10); this report and its log are that merge's. Levels 1-100 are byte-identical to the frozen ones. The bake log lists only the last merge.

<!-- bake:start -->
### Bands (each level's random-tap rate on its own tag)

| Band | Levels | Tags E/N/H | In band | Exempt (teaching) | Rate min | median | max |
|---|---|---|---|---|---|---|---|
| early 85.0%-100.0% | 15 | 4/8/3/0 | 12/12 | 3 | 95.5% | 100.0% | 100.0% |
| saw0 62.0%-80.0% | 10 | 4/6/0/0 | 9/9 | 1 | 65.8% | 74.3% | 79.0% |
| saw1 46.0%-64.0% | 14 | 0/14/0/0 | 14/14 | 0 | 49.0% | 55.0% | 60.5% |
| saw2 30.0%-48.0% | 6 | 0/0/6/0 | 6/6 | 0 | 37.3% | 41.3% | 46.8% |
| hard 0.0%-10.0% | 66 | 0/66/0/0 | 66/66 | 0 | 0.0% | 3.5% | 9.5% |
| hardest 0.0%-5.0% | 69 | 0/0/51/18 | 69/69 | 0 | 0.0% | 1.0% | 4.3% |
| relief 25.0%-60.0% | 18 | 18/0/0/0 | 13/13 | 5 | 38.3% | 47.5% | 85.8% |
| boss 0.0%-5.0% | 2 | 0/0/1/1 | 2/2 | 0 | 1.8% | 1.8% | 4.0% |

### Variety (picture cells matching within an era; gate 40.0%)

| Era | Generated pictures | Median match | 10th percentile | Most alike pair |
|---|---|---|---|---|
| 1 | 21 | 19.3% | 9.3% | 7 and 17, 72.9% |
| 2 | 24 | 21.4% | 9.3% | 38 and 43, 66.4% |
| 3 | 24 | 22.1% | 11.4% | 61 and 64, 81.4% |
| 4 | 24 | 33.6% | 22.1% | 76 and 94, 74.3% |
| 5 | 24 | 27.9% | 7.9% | 115 and 120, 60.0% |
| 6 | 24 | 35.7% | 25.0% | 138 and 144, 68.6% |
| 7 | 24 | 36.4% | 24.3% | 154 and 168, 65.0% |
| 8 | 26 | 22.9% | 12.9% | 190 and 192, 62.1% |

### Every level

Every measure is on the level's own tag (v4.3: Easy 6 spaces, Normal 5, Hard 4 with archers lethal). Rate = the random-tap rate (400 games); lookahead = the one-move-lookahead player (100); fast = the fast tapper (300, from level 46); ? planner = the sampling planner honest / all-seeing (16 games); patient time and longest wait = patient play on the stored line at 1x; real pace = the stored order replayed tapping the moment a space is free, times 1.77 (Peter's pace; * the replay lost, patient time shown); thinking = the same replay waiting 1 / 2 / 4 s after each tap, won (W) or lost (L); R = dealt rushed (a Hard level with standing archers: its stored order also wins at real pace); taps = the stored order's taps (cards); ΔE = the smallest CIEDE2000 between two colours standing in the level.

| # | Era | Tag | Band | Twists | Board | Pixels | Colours | Min ΔE00 | Taps (cards) | Rate | Lookahead | Fast | ? planner | Real pace | Thinking | Patient | Longest wait | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | easy | early | - | 17×18 | 240 | 4 | 26.8 | 8 (8) | 100.0% | 100.0% | - | - | 23 s | WWW | 47 s | 9.1 s | teaching: tray |
| 2 | 1 | easy | early | - | 18×19 | 272 | 5 | 26.8 | 12 (12) | 100.0% | 100.0% | - | - | 32 s | WWW | 72 s | 12 s | teaching: holding |
| 3 | 1 | easy | early | - | 18×19 | 272 | 6 | 26.8 | 12 (12) | 100.0% | 100.0% | - | - | 32 s | WWW | 78 s | 12 s | teaching: overshoot |
| 4 | 1 | normal | early | - | 18×20 | 288 | 4 | 26.8 | 10 (10) | 100.0% | 100.0% | - | - | 32 s | WWW | 76 s | 11 s |  |
| 5 | 1 | normal | early | - | 18×21 | 304 | 4 | 26.8 | 10 (10) | 100.0% | 100.0% | - | - | 36 s | WWW | 71 s | 14 s |  |
| 6 | 1 | hard | early | - | 18×20 | 288 | 4 | 26.8 | 8 (8) | 100.0% | 100.0% | - | - | 28 s | WWW | 66 s | 15 s |  |
| 7 | 1 | normal | early | - | 18×21 | 304 | 5 | 26.8 | 11 (11) | 100.0% | 100.0% | - | - | 34 s | WWW | 75 s | 13 s |  |
| 8 | 1 | normal | early | - | 19×20 | 306 | 5 | 26.8 | 12 (12) | 100.0% | 100.0% | - | - | 33 s | WWW | 85 s | 14 s |  |
| 9 | 1 | normal | early | - | 19×20 | 306 | 5 | 26.8 | 13 (13) | 100.0% | 100.0% | - | - | 33 s | WWW | 77 s | 13 s |  |
| 10 | 1 | hard | early | - | 18×20 | 288 | 5 | 26.8 | 13 (13) | 100.0% | 100.0% | - | - | 44 s | WWW | 86 s | 14 s |  |
| 11 | 1 | easy | early | - | 18×20 | 288 | 6 | 26.1 | 12 (12) | 100.0% | 100.0% | - | - | 32 s | WWW | 67 s | 9.3 s |  |
| 12 | 1 | normal | early | - | 18×21 | 304 | 5 | 26.8 | 12 (12) | 98.8% | 100.0% | - | - | 35 s | WWW | 76 s | 11 s |  |
| 13 | 1 | normal | early | - | 19×20 | 306 | 7 | 26.0 | 12 (12) | 95.5% | 100.0% | - | - | 38 s | WWW | 83 s | 11 s |  |
| 14 | 1 | normal | early | - | 19×21 | 323 | 7 | 26.8 | 12 (12) | 100.0% | 100.0% | - | - | 35 s | WWW | 80 s | 14 s |  |
| 15 | 1 | hard | early | - | 18×20 | 288 | 7 | 26.8 | 9 (9) | 100.0% | 100.0% | - | - | 32 s | WWW | 72 s | 12 s |  |
| 16 | 1 | normal | saw0 | - | 19×22 | 340 | 7 | 26.0 | 17 (17) | 71.8% | 100.0% | - | - | 45 s | WWW | 128 s | 15 s |  |
| 17 | 1 | normal | saw1 | - | 20×22 | 360 | 8 | 26.0 | 18 (18) | 60.5% | 100.0% | - | - | 41 s | WWW | 104 s | 14 s |  |
| 18 | 1 | normal | saw1 | - | 20×22 | 360 | 8 | 26.8 | 16 (16) | 52.3% | 100.0% | - | - | 39 s | WWW | 103 s | 14 s |  |
| 19 | 1 | hard | saw2 | - | 20×21 | 342 | 8 | 26.8 | 14 (14) | 46.8% | 100.0% | - | - | 43 s | WWW | 91 s | 13 s |  |
| 20 | 1 | easy | saw0 | - | 19×22 | 340 | 7 | 26.8 | 22 (22) | 75.5% | 100.0% | - | - | 36 s | WWW | 104 s | 13 s |  |
| 21 | 1 | normal | saw1 | - | 19×22 | 340 | 8 | 26.1 | 12 (12) | 53.3% | 100.0% | - | - | 38 s | WWW | 81 s | 14 s |  |
| 22 | 1 | normal | saw0 | - | 20×21 | 342 | 7 | 26.8 | 14 (14) | 75.5% | 100.0% | - | - | 36 s | WWW | 95 s | 13 s |  |
| 23 | 1 | normal | saw1 | - | 20×22 | 360 | 8 | 26.0 | 15 (15) | 55.8% | 100.0% | - | - | 40 s | WWW | 98 s | 14 s |  |
| 24 | 1 | hard | saw2 | - | 19×22 | 340 | 9 | 26.0 | 21 (21) | 44.8% | 100.0% | - | - | 37 s | WWW | 122 s | 15 s |  |
| 25 | 2 | easy | saw0 | moat | 38×37 | 1116 | 6 | 26.0 | 27 (27) | 79.0% | 100.0% | - | - | 134 s | WWW | 314 s | 15 s | teaching: moat |
| 26 | 2 | normal | saw1 | moat | 42×41 | 1210 | 7 | 26.1 | 43 (43) | 55.3% | 97.0% | - | - | 214 s | WWW | 424 s | 15 s |  |
| 27 | 2 | normal | saw1 | moat | 42×41 | 1210 | 8 | 26.1 | 44 (44) | 55.5% | 100.0% | - | - | 224 s | WWW | 461 s | 15 s |  |
| 28 | 2 | hard | saw2 | moat | 42×41 | 1400 | 8 | 26.8 | 45 (45) | 41.3% | 98.0% | - | - | 223 s | WWW | 555 s | 15 s |  |
| 29 | 2 | normal | saw1 | moat | 42×41 | 1400 | 7 | 26.0 | 38 (38) | 56.3% | 100.0% | - | - | 238 s | WWW | 420 s | 15 s |  |
| 30 | 2 | normal | saw1 | moat | 42×41 | 1400 | 7 | 26.8 | 38 (38) | 52.3% | 100.0% | - | - | 240 s | WWW | 434 s | 15 s |  |
| 31 | 2 | normal | saw0 | moat | 42×41 | 1400 | 8 | 26.1 | 39 (39) | 77.3% | 100.0% | - | - | 196 s | WWW | 413 s | 15 s |  |
| 32 | 2 | hard | saw2 | moat | 42×41 | 1200 | 8 | 26.8 | 41 (41) | 38.5% | 78.0% | - | - | 191 s | WWW | 450 s | 15 s |  |
| 33 | 2 | easy | saw0 | moat | 42×41 | 1210 | 7 | 26.0 | 38 (38) | 70.0% | 96.0% | - | - | 212 s | WWW | 475 s | 15 s |  |
| 34 | 2 | normal | saw0 | moat | 42×41 | 1200 | 8 | 26.0 | 44 (44) | 65.8% | 96.0% | - | - | 237 s | WWW | 494 s | 15 s |  |
| 35 | 2 | normal | saw1 | moat | 42×41 | 1400 | 8 | 26.0 | 41 (41) | 55.0% | 100.0% | - | - | 213 s | WWW | 421 s | 15 s |  |
| 36 | 2 | normal | saw1 | moat | 42×41 | 1200 | 7 | 26.0 | 50 (50) | 57.0% | 99.0% | - | - | 199 s | WWW | 582 s | 15 s |  |
| 37 | 2 | hard | saw2 | moat | 42×41 | 1400 | 8 | 26.1 | 48 (48) | 43.3% | 100.0% | - | - | 222 s | WWW | 488 s | 15 s |  |
| 38 | 2 | normal | saw1 | moat | 42×41 | 1200 | 7 | 26.8 | 43 (43) | 49.0% | 60.0% | - | - | 184 s | WWW | 463 s | 15 s |  |
| 39 | 2 | normal | saw1 | moat | 42×41 | 1400 | 6 | 26.1 | 29 (29) | 59.0% | 100.0% | - | - | 228 s | WWW | 355 s | 15 s |  |
| 40 | 2 | normal | saw0 | moat | 42×41 | 1400 | 8 | 26.0 | 44 (44) | 74.3% | 100.0% | - | - | 214 s | WWW | 470 s | 15 s |  |
| 41 | 2 | hard | saw2 | moat | 42×41 | 1400 | 7 | 26.8 | 49 (49) | 37.3% | 100.0% | - | - | 233 s | WWW | 556 s | 15 s |  |
| 42 | 2 | easy | saw0 | moat | 42×41 | 1400 | 10 | 26.0 | 48 (48) | 73.0% | 100.0% | - | - | 267 s | WWW | 543 s | 15 s |  |
| 43 | 2 | normal | saw0 | moat | 42×41 | 1200 | 7 | 26.8 | 45 (45) | 77.5% | 96.0% | - | - | 207 s | WWW | 469 s | 15 s |  |
| 44 | 2 | normal | saw1 | moat | 42×41 | 1200 | 6 | 26.1 | 41 (41) | 54.5% | 91.0% | - | - | 190 s | WWW | 400 s | 15 s |  |
| 45 | 2 | normal | saw1 | moat | 42×41 | 1400 | 7 | 26.1 | 44 (44) | 55.0% | 100.0% | - | - | 217 s | WWW | 469 s | 15 s |  |
| 46 | 2 | hard | hardest | moat | 42×41 | 1400 | 10 | 26.0 | 48 (48) | 3.3% | 10.0% | 2.0% | - | 210 s | WWW | 533 s | 15 s |  |
| 47 | 2 | normal | hard | moat | 42×41 | 1400 | 10 | 26.0 | 52 (52) | 5.3% | 20.0% | 6.0% | - | 244 s | WWW | 560 s | 15 s |  |
| 48 | 2 | normal | hard | moat | 42×41 | 1400 | 9 | 26.0 | 48 (48) | 0.0% | 19.0% | 0.7% | - | 226 s | WWW | 498 s | 15 s |  |
| 49 | 2 | hard | hardest | moat | 42×41 | 1210 | 8 | 26.0 | 45 (45) | 2.3% | 11.0% | 1.0% | - | 213 s | WWW | 455 s | 15 s |  |
| 50 | 3 | easy | relief | moat, gates 1 | 38×37 | 1128 | 9 | 26.0 | 38 (38) | 49.0% | 100.0% | 42.0% | - | 172 s | WWW | 433 s | 15 s | teaching: gate |
| 51 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 12 | 26.0 | 55 (55) | 0.5% | 24.0% | 0.0% | - | 221 s | WWW | 613 s | 15 s |  |
| 52 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 55 (55) | 3.5% | 17.0% | 2.7% | - | 233 s | WWW | 622 s | 15 s |  |
| 53 | 3 | hard | hardest | moat, gates 1, colour lock 8 | 42×41 | 1412 | 10 | 26.0 | 54 (54) | 1.0% | 7.0% | 2.0% | - | 236 s | WWW | 501 s | 15 s |  |
| 54 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 11 | 25.7 | 55 (55) | 2.8% | 14.0% | 4.7% | - | 217 s | WWW | 539 s | 15 s |  |
| 55 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 51 (51) | 3.0% | 9.0% | 1.0% | - | 221 s | WWW | 572 s | 15 s |  |
| 56 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 12 | 26.0 | 55 (55) | 5.0% | 20.0% | 4.3% | - | 209 s | WWW | 572 s | 15 s |  |
| 57 | 3 | hard | hardest | moat, gates 1, colour lock 2 | 42×41 | 1412 | 9 | 25.7 | 37 (37) | 0.0% | 4.0% | 0.0% | - | 220 s | WWW | 433 s | 15 s |  |
| 58 | 3 | easy | relief | moat | 42×41 | 1400 | 8 | 26.0 | 44 (44) | 41.0% | 100.0% | 45.3% | - | 211 s | WWW | 457 s | 15 s |  |
| 59 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 54 (54) | 0.0% | 12.0% | 0.0% | - | 229 s | WWW | 573 s | 15 s |  |
| 60 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 11 | 25.7 | 55 (55) | 2.5% | 6.0% | 2.7% | - | 224 s | WWW | 534 s | 15 s |  |
| 61 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 11 | 25.7 | 55 (55) | 5.5% | 17.0% | 6.0% | - | 230 s | WWW | 604 s | 15 s |  |
| 62 | 3 | hard | hardest | moat, gates 1, colour lock 8 | 42×41 | 1412 | 11 | 26.0 | 55 (55) | 0.3% | 10.0% | 1.0% | - | 237 s | WWW | 576 s | 15 s |  |
| 63 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 51 (51) | 2.0% | 4.0% | 3.0% | - | 222 s | WWW | 584 s | 15 s |  |
| 64 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 11 | 25.7 | 54 (54) | 2.0% | 15.0% | 3.0% | - | 210 s | WWW | 568 s | 15 s |  |
| 65 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 12 | 26.0 | 54 (54) | 0.8% | 22.0% | 1.3% | - | 229 s | WWW | 583 s | 15 s |  |
| 66 | 3 | hard | hardest | moat, gates 1, colour lock 12 | 42×41 | 1412 | 12 | 26.0 | 46 (46) | 0.0% | 2.0% | 0.3% | - | 224 s | WWW | 489 s | 15 s |  |
| 67 | 3 | easy | relief | moat | 42×41 | 1400 | 8 | 26.0 | 53 (53) | 54.8% | 100.0% | 62.3% | - | 224 s | WWW | 636 s | 15 s |  |
| 68 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 54 (54) | 3.5% | 12.0% | 1.3% | - | 221 s | WWW | 679 s | 15 s |  |
| 69 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 12 | 26.0 | 51 (51) | 1.3% | 13.0% | 1.3% | - | 214 s | WWW | 521 s | 15 s |  |
| 70 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 9 | 25.7 | 51 (51) | 5.5% | 8.0% | 4.7% | - | 243 s | WWW | 592 s | 15 s |  |
| 71 | 3 | hard | hardest | moat, gates 1, colour lock 3 | 42×41 | 1412 | 12 | 26.0 | 53 (53) | 2.8% | 15.0% | 1.0% | - | 223 s | WWW | 552 s | 15 s |  |
| 72 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 51 (51) | 4.5% | 17.0% | 6.0% | - | 224 s | WWW | 565 s | 15 s |  |
| 73 | 3 | normal | hard | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 52 (52) | 1.3% | 25.0% | 1.3% | - | 237 s | WWW | 546 s | 15 s |  |
| 74 | 3 | hard | hardest | moat, gates 1, colour lock 9 | 42×41 | 1412 | 10 | 26.0 | 48 (48) | 0.0% | 22.0% | 0.0% | - | 196 s | WWW | 483 s | 15 s |  |
| 75 | 4 | easy | relief | moat, gates 2, linked 1 | 34×33 | 844 | 10 | 26.0 | 28 (29) | 41.3% | 56.0% | 18.3% | - | 131 s | WWW | 252 s | 15 s | teaching: linked |
| 76 | 4 | normal | hard | moat, gates 2, linked 1 | 42×41 | 1300 | 11 | 26.0 | 54 (55) | 2.5% | 25.0% | 3.7% | - | 189 s | WWW | 588 s | 15 s |  |
| 77 | 4 | normal | hard | moat, gates 2 | 42×41 | 1372 | 12 | 26.0 | 50 (50) | 0.8% | 5.0% | 1.3% | - | 238 s | WWW | 594 s | 15 s |  |
| 78 | 4 | hard | hardest | moat, gates 2, linked 2, colour lock 8 | 42×41 | 1372 | 11 | 26.0 | 42 (44) | 0.3% | 6.0% | 0.3% | - | 222 s | WWW | 423 s | 15 s |  |
| 79 | 4 | normal | hard | moat, gates 2, linked 2 | 42×41 | 1372 | 10 | 26.0 | 51 (53) | 6.5% | 4.0% | 1.0% | - | 193 s | WWW | 541 s | 15 s |  |
| 80 | 4 | normal | hard | moat, gates 2 | 42×41 | 1372 | 9 | 26.0 | 48 (48) | 0.5% | 4.0% | 0.7% | - | 225 s | WWW | 562 s | 15 s |  |
| 81 | 4 | normal | hard | moat, gates 2 | 42×41 | 1372 | 11 | 26.0 | 55 (55) | 2.3% | 4.0% | 3.0% | - | 236 s | WWW | 571 s | 15 s |  |
| 82 | 4 | hard | hardest | moat, gates 2, linked 2, colour lock 9 | 42×41 | 1372 | 11 | 26.0 | 42 (44) | 1.3% | 13.0% | 1.0% | - | 227 s | WWW | 479 s | 15 s |  |
| 83 | 4 | easy | relief | moat | 42×41 | 1344 | 9 | 26.0 | 47 (47) | 47.5% | 100.0% | 40.7% | - | 204 s | WWW | 558 s | 15 s |  |
| 84 | 4 | normal | hard | moat, gates 2 | 42×41 | 1372 | 11 | 26.0 | 54 (54) | 0.3% | 16.0% | 0.0% | - | 214 s | WWW | 576 s | 15 s |  |
| 85 | 4 | normal | hard | moat, gates 2, linked 2 | 42×41 | 1372 | 10 | 26.0 | 52 (54) | 1.5% | 16.0% | 0.0% | - | 223 s | WWW | 520 s | 15 s |  |
| 86 | 4 | normal | hard | moat, gates 2 | 42×41 | 1372 | 11 | 25.7 | 47 (47) | 4.3% | 6.0% | 2.3% | - | 237 s | WWW | 477 s | 15 s |  |
| 87 | 4 | hard | hardest | moat, gates 2, linked 2, key lock | 42×41 | 1372 | 11 | 26.0 | 43 (45) | 0.0% | 6.0% | 0.0% | - | 286 s | WWW | 488 s | 15 s |  |
| 88 | 4 | normal | hard | moat, gates 2 | 42×41 | 1372 | 11 | 26.0 | 55 (55) | 1.5% | 14.0% | 1.3% | - | 186 s | WWW | 579 s | 15 s |  |
| 89 | 4 | normal | hard | moat, gates 2 | 42×41 | 1372 | 11 | 26.0 | 55 (55) | 9.5% | 12.0% | 14.0% | - | 215 s | WWW | 528 s | 15 s |  |
| 90 | 4 | normal | hard | moat, gates 2 | 42×41 | 1372 | 9 | 26.0 | 52 (52) | 8.0% | 9.0% | 11.7% | - | 205 s | WWW | 537 s | 15 s |  |
| 91 | 4 | hard | hardest | moat, gates 2, linked 2, colour lock 2 | 42×41 | 1372 | 11 | 26.0 | 49 (51) | 2.0% | 0.0% | 0.7% | - | 226 s | WWW | 542 s | 15 s |  |
| 92 | 4 | easy | relief | moat | 42×41 | 1344 | 10 | 26.0 | 51 (51) | 57.5% | 82.0% | 29.7% | - | 204 s | WWW | 501 s | 15 s |  |
| 93 | 4 | normal | hard | moat, gates 2, linked 2 | 42×41 | 1372 | 9 | 26.0 | 43 (45) | 4.5% | 0.0% | 3.3% | - | 219 s | WWW | 496 s | 15 s |  |
| 94 | 4 | normal | hard | moat, gates 2 | 42×41 | 1300 | 11 | 26.0 | 55 (55) | 3.3% | 10.0% | 5.0% | - | 212 s | WWW | 615 s | 15 s |  |
| 95 | 4 | normal | hard | moat, gates 2 | 42×41 | 1372 | 11 | 26.0 | 48 (48) | 2.5% | 23.0% | 3.0% | - | 233 s | WWW | 529 s | 15 s |  |
| 96 | 4 | hard | hardest | moat, gates 2, linked 1, key lock | 42×41 | 1372 | 11 | 26.0 | 41 (42) | 0.0% | 4.0% | 0.7% | - | 223 s | WWW | 464 s | 15 s |  |
| 97 | 4 | normal | hard | moat, gates 2 | 42×41 | 1300 | 11 | 25.7 | 48 (48) | 8.8% | 2.0% | 7.0% | - | 248 s | WWW | 503 s | 15 s |  |
| 98 | 4 | normal | hard | moat, gates 2 | 42×41 | 1372 | 12 | 26.0 | 54 (54) | 3.3% | 7.0% | 3.3% | - | 219 s | WWW | 573 s | 15 s |  |
| 99 | 4 | hard | boss | moat, gates 2, linked 3, key lock | 42×41 | 1372 | 12 | 26.0 | 52 (55) | 4.0% | 0.0% | 0.7% | - | 234 s | WWW | 518 s | 15 s |  |
| 100 | 5 | easy | relief | moat, gates 1, ? 3 | 38×37 | 1128 | 7 | 26.4 | 26 (26) | 61.0% | 98.0% | 56.0% | 100.0% / 100.0% | 121 s | WWW | 295 s | 15 s | teaching: mystery |
| 101 | 5 | normal | hard | ? 3, linked 2 | 42×41 | 1520 | 9 | 25.5 | 42 (44) | 9.5% | 2.0% | 2.7% | 100.0% / 87.5% | 208 s | WWW | 464 s | 15 s |  |
| 102 | 5 | hard | hardest | moat, gates 1, ? 2, linked 1, key lock | 42×41 | 1412 | 9 | 25.5 | 41 (42) | 0.8% | 14.0% | 0.0% | 93.8% / 81.3% | 237 s | WWW | 457 s | 15 s |  |
| 103 | 5 | normal | hard | moat, ? 2 | 42×41 | 1400 | 10 | 25.5 | 46 (46) | 7.0% | 23.0% | 7.0% | 100.0% / 100.0% | 236 s | WWW | 512 s | 15 s |  |
| 104 | 5 | normal | hard | moat, gates 1, ? 3 | 42×41 | 1395 | 10 | 25.6 | 55 (55) | 3.5% | 3.0% | 5.3% | 100.0% / 100.0% | 222 s | WWW | 614 s | 15 s |  |
| 105 | 5 | hard | hardest | moat, gates 1, ? 2, linked 1, colour lock 5 | 42×41 | 1412 | 9 | 25.5 | 42 (43) | 3.3% | 25.0% | 2.7% | 100.0% / 100.0% | 225 s | WWW | 486 s | 15 s |  |
| 106 | 5 | easy | relief | linked 1 | 42×41 | 1520 | 9 | 25.6 | 45 (46) | 42.8% | 99.0% | 52.3% | - | 249 s | WWW | 473 s | 15 s |  |
| 107 | 5 | normal | hard | moat, gates 1, linked 1 | 42×41 | 1412 | 9 | 25.6 | 43 (44) | 5.8% | 0.0% | 3.0% | - | 242 s | WWW | 450 s | 15 s |  |
| 108 | 5 | hard | hardest | moat, gates 1, ? 3, linked 2, key lock | 42×41 | 1412 | 10 | 25.5 | 38 (40) | 0.5% | 15.0% | 0.3% | 81.3% / 93.8% | 215 s | WWW | 419 s | 15 s |  |
| 109 | 5 | normal | hard | moat, ? 2, linked 1 | 42×41 | 1384 | 9 | 25.5 | 53 (54) | 2.8% | 12.0% | 3.0% | 81.3% / 100.0% | 274 s | WWW | 571 s | 15 s |  |
| 110 | 5 | normal | hard | moat, ? 3, linked 2 | 42×41 | 1400 | 9 | 25.5 | 51 (53) | 4.8% | 21.0% | 0.3% | 87.5% / 100.0% | 249 s | WWW | 563 s | 15 s |  |
| 111 | 5 | hard | hardest | moat, gates 2, ? 3, linked 2, colour lock 6 | 42×41 | 1412 | 9 | 25.5 | 40 (42) | 1.5% | 0.0% | 1.3% | 100.0% / 93.8% | 231 s | WWW | 445 s | 15 s |  |
| 112 | 5 | normal | hard | ? 2, linked 2 | 42×41 | 1520 | 10 | 25.5 | 43 (45) | 4.0% | 6.0% | 0.0% | 100.0% / 100.0% | 232 s | WWW | 469 s | 15 s |  |
| 113 | 5 | normal | hard | moat, ? 2, linked 1 | 42×41 | 1400 | 9 | 25.6 | 50 (51) | 2.8% | 14.0% | 1.3% | 93.8% / 93.8% | 224 s | WWW | 534 s | 15 s |  |
| 114 | 5 | hard | hardest | moat, gates 2, ? 4, linked 2, colour lock 7 | 42×41 | 1412 | 9 | 25.5 | 42 (44) | 1.8% | 5.0% | 2.7% | 87.5% / 100.0% | 223 s | WWW | 473 s | 15 s |  |
| 115 | 5 | easy | relief | moat | 42×41 | 1400 | 9 | 25.5 | 51 (51) | 42.3% | 72.0% | 51.3% | - | 246 s | WWW | 562 s | 15 s |  |
| 116 | 5 | normal | hard | moat, ? 2 | 42×41 | 1397 | 9 | 25.5 | 50 (50) | 1.8% | 11.0% | 1.7% | 100.0% / 100.0% | 272 s | WWW | 524 s | 15 s |  |
| 117 | 5 | hard | hardest | moat, gates 2, ? 4, linked 1, colour lock 5 | 42×41 | 1412 | 9 | 25.6 | 43 (44) | 1.0% | 9.0% | 1.3% | 68.8% / 75.0% | 212 s | WWW | 474 s | 15 s |  |
| 118 | 5 | normal | hard | ? 4, linked 2 | 42×41 | 1520 | 9 | 25.5 | 41 (43) | 5.0% | 10.0% | 8.3% | 100.0% / 100.0% | 242 s | WWW | 444 s | 14 s |  |
| 119 | 5 | normal | hard | moat, gates 1, ? 2 | 42×41 | 1412 | 9 | 25.5 | 53 (53) | 0.8% | 9.0% | 0.3% | 100.0% / 100.0% | 225 s | WWW | 535 s | 15 s |  |
| 120 | 5 | hard | hardest | moat, gates 1, ? 3, linked 1, colour lock 3 | 42×41 | 1412 | 10 | 25.5 | 42 (43) | 0.5% | 4.0% | 0.0% | 81.3% / 100.0% | 233 s | WWW | 488 s | 15 s |  |
| 121 | 5 | normal | hard | moat, gates 1 | 42×41 | 1412 | 10 | 25.5 | 53 (53) | 4.3% | 7.0% | 4.0% | - | 219 s | WWW | 572 s | 15 s |  |
| 122 | 5 | normal | hard | moat, linked 2 | 42×41 | 1400 | 9 | 25.5 | 49 (51) | 3.5% | 14.0% | 5.0% | - | 228 s | WWW | 535 s | 15 s |  |
| 123 | 5 | hard | hardest | moat, gates 1, ? 3, linked 1, colour lock 1 | 42×41 | 1411 | 10 | 25.5 | 51 (52) | 2.3% | 5.0% | 1.3% | 100.0% / 100.0% | 232 s | WWW | 603 s | 15 s |  |
| 124 | 5 | hard | hardest | moat, gates 1, ? 2, linked 1, key lock | 42×41 | 1412 | 9 | 25.5 | 49 (50) | 1.8% | 6.0% | 2.0% | 100.0% / 100.0% | 245 s | WWW | 512 s | 15 s |  |
| 125 | 6 | easy | relief | moat, archers 1 | 38×37 | 1116 | 8 | 25.6 | 37 (37) | 76.3% | 100.0% | 77.0% | - | 161 s | WWW | 438 s | 15 s | teaching: tower |
| 126 | 6 | normal | hard | moat, archers 1 | 42×41 | 1400 | 9 | 25.6 | 54 (54) | 4.5% | 20.0% | 5.7% | - | 227 s | WWW | 574 s | 15 s |  |
| 127 | 6 | hard | hardest | moat, archers 2, ? 2, linked 2, colour lock 8 | 42×41 | 1400 | 8 | 25.4 | 51 (53) | 2.0% | 2.0% | 0.0% | 75.0% / 87.5% | 221 s | WWW | 542 s | 15 s |  |
| 128 | 6 | normal | hard | moat, gates 1, ? 2 | 42×41 | 1412 | 8 | 25.3 | 55 (55) | 4.8% | 19.0% | 5.3% | 93.8% / 93.8% | 218 s | WWW | 566 s | 15 s |  |
| 129 | 6 | extreme | hardest | moat, gates 2, archers 2, ? 3, linked 1, key lock | 42×41 | 1412 | 9 | 25.4 | 51 (52) | 0.3% | 23.0% | 0.0% | 100.0% / 100.0% | 235 s | WWW | 520 s | 15 s |  |
| 130 | 6 | hard | hardest | moat, gates 2, archers 2, linked 2, colour lock 8 | 42×41 | 1412 | 9 | 25.3 | 51 (53) | 1.8% | 12.0% | 0.0% | - | 217 s | WWW | 530 s | 15 s |  |
| 131 | 6 | easy | relief | ? 2 | 42×41 | 1520 | 8 | 25.4 | 52 (52) | 46.0% | 96.0% | 49.7% | 100.0% / 100.0% | 238 s | WWW | 564 s | 15 s |  |
| 132 | 6 | normal | hard | moat, linked 1 | 42×41 | 1400 | 8 | 25.3 | 44 (45) | 5.0% | 0.0% | 2.7% | - | 220 s | WWW | 507 s | 15 s |  |
| 133 | 6 | hard | hardest | moat, gates 1, archers 3, ? 3, linked 1, colour lock 5 | 42×41 | 1412 | 9 | 25.6 | 53 (54) | 0.0% | 5.0% | 0.0% | 93.8% / 100.0% | 226 s | WWW | 567 s | 15 s |  |
| 134 | 6 | hard | hardest | moat, gates 2, archers 2, linked 1, key lock | 42×41 | 1412 | 9 | 25.6 | 55 (56) | 2.0% | 5.0% | 0.3% | - | 221 s | WWW | 578 s | 15 s |  |
| 135 | 6 | normal | hard | ? 3, linked 1 | 42×41 | 1520 | 8 | 25.6 | 47 (48) | 4.8% | 14.0% | 6.3% | 93.8% / 100.0% | 264 s | WWW | 499 s | 15 s |  |
| 136 | 6 | hard | hardest | moat, gates 1, archers 3, ? 4, linked 2, key lock | 42×41 | 1412 | 9 | 25.6 | 48 (50) | 1.5% | 7.0% | 1.0% | 100.0% / 100.0% | 220 s | WWW | 541 s | 15 s |  |
| 137 | 6 | normal | hard | archers 1, ? 3 | 42×41 | 1520 | 8 | 25.4 | 55 (55) | 3.0% | 10.0% | 1.0% | 81.3% / 87.5% | 231 s | WWW | 623 s | 15 s |  |
| 138 | 6 | extreme | hardest | moat, gates 2, archers 2, ? 3, linked 1, key lock | 42×41 | 1412 | 8 | 25.4 | 54 (55) | 1.8% | 21.0% | 1.0% | 93.8% / 100.0% | 247 s | WWW | 528 s | 15 s |  |
| 139 | 6 | hard | hardest | moat, gates 1, archers 3, ? 2, linked 2, colour lock 4 | 42×41 | 1412 | 8 | 25.6 | 41 (43) | 2.5% | 18.0% | 0.3% | 100.0% / 100.0% | 214 s | WWW | 440 s | 15 s |  |
| 140 | 6 | easy | relief | moat | 42×41 | 1400 | 8 | 25.6 | 45 (45) | 44.0% | 100.0% | 39.7% | - | 228 s | WWW | 514 s | 15 s |  |
| 141 | 6 | normal | hard | moat, archers 1, ? 3 | 42×41 | 1400 | 8 | 25.3 | 55 (55) | 3.8% | 6.0% | 2.7% | 75.0% / 75.0% | 238 s | WWW | 625 s | 15 s |  |
| 142 | 6 | hard | hardest | moat, gates 2, archers 2, ? 2, linked 2, key lock | 42×41 | 1412 | 9 | 25.6 | 53 (55) | 2.0% | 24.0% | 4.0% | 56.3% / 56.3% | 224 s | WWW | 549 s | 15 s |  |
| 143 | 6 | hard | hardest | moat, gates 1, archers 3, ? 2, linked 1, key lock | 42×41 | 1412 | 10 | 25.3 | 53 (54) | 4.3% | 17.0% | 3.3% | 100.0% / 100.0% | 225 s | WWW | 553 s | 15 s |  |
| 144 | 6 | normal | hard | moat, archers 2, ? 4 | 42×41 | 1400 | 9 | 25.6 | 55 (55) | 2.0% | 13.0% | 1.0% | 93.8% / 93.8% | 222 s | WWW | 617 s | 15 s |  |
| 145 | 6 | hard | hardest | moat, archers 2, ? 3, linked 1, key lock | 42×41 | 1400 | 10 | 25.6 | 54 (55) | 2.8% | 24.0% | 0.0% | 81.3% / 100.0% | 220 s | WWW | 574 s | 15 s |  |
| 146 | 6 | normal | hard | moat, ? 3 | 42×41 | 1400 | 8 | 25.3 | 55 (55) | 1.3% | 4.0% | 1.3% | 87.5% / 68.8% | 224 s | WWW | 588 s | 15 s |  |
| 147 | 6 | extreme | hardest | moat, gates 2, archers 2, ? 3, linked 2, colour lock 4 | 42×41 | 1412 | 10 | 25.4 | 55 (57) | 0.8% | 20.0% | 0.0% | 81.3% / 81.3% | 225 s | WWW | 568 s | 15 s |  |
| 148 | 6 | hard | hardest | moat, gates 1, archers 3, ? 2, linked 2, colour lock 3 | 42×41 | 1412 | 8 | 25.4 | 49 (51) | 0.3% | 9.0% | 0.3% | 87.5% / 93.8% | 225 s | WWW | 583 s | 15 s |  |
| 149 | 6 | extreme | hardest | moat, gates 1, archers 2, ? 2, linked 1, colour lock 5 | 42×41 | 1412 | 10 | 25.4 | 53 (54) | 3.3% | 6.0% | 0.0% | 75.0% / 93.8% | 217 s | WWW | 592 s | 15 s |  |
| 150 | 7 | easy | relief | moat | 38×37 | 1116 | 9 | 26.0 | 36 (36) | 85.8% | 100.0% | 86.7% | - | 174 s | WWW | 413 s | 15 s | teaching: hidden |
| 151 | 7 | hard | hardest | moat, gates 2, archers 2, ? 3, linked 1, colour lock 12 | 42×41 | 1412 | 12 | 25.5 | 52 (53) | 0.5% | 12.0% | 0.0% | 81.3% / 93.8% | 225 s | WWW | 538 s | 15 s |  |
| 152 | 7 | normal | hard | moat, ? 3 | 42×41 | 1391 | 10 | 25.5 | 49 (49) | 4.0% | 12.0% | 4.7% | 100.0% / 100.0% | 228 s | WWW | 530 s | 15 s |  |
| 153 | 7 | extreme | hardest | moat, gates 1, archers 3, ? 3, linked 1, key lock | 42×41 | 1397 | 12 | 25.5 | 54 (55) | 1.3% | 6.0% | 0.7% | 75.0% / 75.0% | 245 s | WWW | 583 s | 15 s |  |
| 154 | 7 | hard | hardest | moat, gates 2, archers 3, ? 3, linked 1, colour lock 7 | 42×41 | 1412 | 12 | 25.5 | 51 (52) | 0.0% | 22.0% | 0.0% | 93.8% / 100.0% | 277 s | WWW | 514 s | 15 s |  |
| 155 | 7 | normal | hard | moat, gates 1 | 42×41 | 1412 | 9 | 26.0 | 50 (50) | 1.0% | 6.0% | 1.0% | - | 225 s | WWW | 545 s | 15 s |  |
| 156 | 7 | hard | hardest | moat, gates 1, archers 2, ? 3, linked 1, colour lock 9 | 42×41 | 1412 | 10 | 26.0 | 54 (55) | 0.5% | 9.0% | 1.0% | 87.5% / 100.0% | 258 s | WWW | 547 s | 15 s |  |
| 157 | 7 | extreme | hardest | moat, gates 1, archers 3, ? 4, linked 2, key lock | 42×41 | 1412 | 9 | 25.5 | 49 (51) | 1.0% | 21.0% | 0.3% | 87.5% / 100.0% | 206 s | WWW | 531 s | 15 s |  |
| 158 | 7 | easy | relief | - | 42×41 | 1520 | 10 | 25.5 | 48 (48) | 49.3% | 100.0% | 46.0% | - | 244 s | WWW | 536 s | 15 s |  |
| 159 | 7 | hard | hardest | moat, gates 1, archers 3, linked 2, colour lock 8 | 42×41 | 1412 | 9 | 25.5 | 55 (57) | 0.0% | 11.0% | 0.0% | - | 256 s | WWW | 642 s | 15 s |  |
| 160 | 7 | hard | hardest | moat, gates 1, archers 3, ? 2, linked 1, colour lock 5 | 42×41 | 1412 | 10 | 26.0 | 52 (53) | 0.3% | 9.0% | 0.0% | 81.3% / 93.8% | 267 s | WWW | 552 s | 15 s |  |
| 161 | 7 | normal | hard | moat, archers 1 | 42×41 | 1395 | 9 | 26.0 | 51 (51) | 7.2% | 5.0% | 6.3% | - | 224 s | WWW | 586 s | 15 s |  |
| 162 | 7 | extreme | hardest | moat, gates 2, archers 2, ? 3, linked 1, colour lock 4 | 42×41 | 1412 | 9 | 26.0 | 55 (56) | 2.3% | 20.0% | 0.0% | 100.0% / 87.5% | 248 s | WWW | 615 s | 15 s |  |
| 163 | 7 | hard | hardest | moat, gates 1, archers 3, ? 3, linked 2, colour lock 11 | 42×41 | 1412 | 12 | 25.5 | 55 (57) | 0.5% | 22.0% | 0.0% | 100.0% / 100.0% | 217 s | WWW | 576 s | 15 s |  |
| 164 | 7 | normal | hard | archers 1, linked 1 | 42×41 | 1520 | 11 | 25.5 | 55 (56) | 3.3% | 12.0% | 1.3% | - | 218 s | WWW | 567 s | 15 s |  |
| 165 | 7 | hard | hardest | moat, gates 1, archers 2, ? 2, linked 2, key lock | 42×41 | 1409 | 12 | 25.5 | 55 (57) | 2.8% | 9.0% | 0.7% | 87.5% / 100.0% | 232 s | WWW | 569 s | 15 s |  |
| 166 | 7 | extreme | hardest | moat, gates 2, archers 3, ? 4, linked 1, key lock | 42×41 | 1412 | 9 | 26.1 | 51 (52) | 0.8% | 20.0% | 1.0% | 68.8% / 87.5% | 224 s | WWW | 548 s | 15 s |  |
| 167 | 7 | easy | relief | archers 1 | 42×41 | 1520 | 9 | 26.0 | 55 (55) | 46.0% | 100.0% | 48.0% | - | 225 s | WWW | 560 s | 15 s |  |
| 168 | 7 | hard | hardest | moat, gates 1, archers 3, ? 2, colour lock 7 | 42×41 | 1412 | 11 | 25.5 | 54 (54) | 0.0% | 22.0% | 0.0% | 62.5% / 81.3% | 218 s | WWW | 557 s | 15 s |  |
| 169 | 7 | hard | hardest | moat, gates 1, ? 2, linked 2, colour lock 7 | 42×41 | 1412 | 9 | 26.0 | 41 (43) | 0.0% | 4.0% | 1.7% | 93.8% / 93.8% | 203 s | WWW | 471 s | 15 s |  |
| 170 | 7 | normal | hard | moat, ? 3 | 42×41 | 1400 | 10 | 25.6 | 49 (49) | 5.5% | 11.0% | 6.3% | 100.0% / 100.0% | 241 s | WWW | 543 s | 15 s |  |
| 171 | 7 | extreme | hardest | moat, gates 2, archers 2, ? 4, linked 2, key lock | 42×41 | 1412 | 9 | 26.0 | 48 (50) | 0.8% | 21.0% | 0.0% | 93.8% / 100.0% | 223 s | WWW | 509 s | 15 s |  |
| 172 | 7 | hard | hardest | moat, gates 1, archers 3, linked 1, colour lock 9 | 42×41 | 1412 | 10 | 25.5 | 55 (56) | 2.3% | 12.0% | 0.3% | - | 221 s | WWW | 541 s | 15 s |  |
| 173 | 7 | normal | hard | archers 2, linked 1 | 42×41 | 1520 | 11 | 25.5 | 50 (51) | 5.8% | 0.0% | 5.3% | - | 236 s | WWW | 531 s | 15 s |  |
| 174 | 7 | extreme | hardest | moat, gates 1, archers 3, ? 2, linked 2, key lock | 42×41 | 1412 | 9 | 26.0 | 52 (54) | 2.5% | 18.0% | 1.3% | 87.5% / 75.0% | 235 s | WWW | 540 s | 15 s |  |
| 175 | 8 | hard | hardest | moat, gates 1, archers 2, linked 2, colour lock 4 | 42×41 | 1412 | 10 | 25.6 | 50 (52) | 1.5% | 25.0% | 2.0% | - | 223 s | WWW | 563 s | 15 s |  |
| 176 | 8 | extreme | hardest | moat, gates 2, archers 3, ? 4, linked 1, key lock | 42×41 | 1412 | 10 | 25.4 | 45 (46) | 1.8% | 8.0% | 1.0% | 93.8% / 93.8% | 218 s | WLW | 488 s | 15 s |  |
| 177 | 8 | normal | hard | ? 4, linked 1 | 42×41 | 1520 | 10 | 25.4 | 54 (55) | 8.8% | 21.0% | 10.3% | 81.3% / 93.8% | 252 s | WWW | 539 s | 15 s |  |
| 178 | 8 | hard | hardest | moat, archers 2, ? 3, linked 2, colour lock 9 | 42×41 | 1400 | 9 | 25.6 | 51 (53) | 0.0% | 14.0% | 0.0% | 100.0% / 75.0% | 228 s | WWW | 522 s | 15 s |  |
| 179 | 8 | extreme | hardest | moat, gates 2, archers 2, ? 3, linked 2, key lock | 42×41 | 1412 | 11 | 25.4 | 53 (55) | 0.8% | 18.0% | 0.3% | 100.0% / 93.8% | 254 s | WWW | 564 s | 15 s |  |
| 180 | 8 | easy | relief | - | 42×41 | 1524 | 10 | 25.7 | 49 (49) | 55.8% | 100.0% | 44.7% | - | 221 s | WWW | 535 s | 15 s |  |
| 181 | 8 | hard | hardest | moat, archers 3, ? 3, linked 2, key lock | 42×41 | 1400 | 10 | 25.4 | 55 (57) | 4.0% | 11.0% | 6.0% | 100.0% / 93.8% | 238 s | WWW | 513 s | 15 s |  |
| 182 | 8 | normal | hard | moat, archers 1, linked 2 | 42×41 | 1400 | 9 | 25.4 | 55 (57) | 1.5% | 12.0% | 1.0% | - | 199 s | WWW | 561 s | 15 s |  |
| 183 | 8 | extreme | hardest | moat, gates 1, archers 3, ? 3, linked 1, key lock | 42×41 | 1412 | 10 | 25.4 | 43 (44) | 0.0% | 7.0% | 0.0% | 50.0% / 68.8% | 196 s | WWW | 453 s | 15 s |  |
| 184 | 8 | hard | hardest | moat, gates 1, archers 3, ? 4, linked 1, colour lock 4 | 42×41 | 1412 | 10 | 25.7 | 55 (56) | 0.5% | 13.0% | 0.3% | 93.8% / 93.8% | 234 s | WWW | 580 s | 15 s |  |
| 185 | 8 | extreme | hardest | moat, gates 2, archers 2, ? 4, linked 1, colour lock 4 | 42×41 | 1412 | 9 | 25.6 | 45 (46) | 1.8% | 19.0% | 0.7% | 100.0% / 100.0% | 199 s | WWW | 504 s | 15 s |  |
| 186 | 8 | normal | hard | moat, linked 1 | 42×41 | 1400 | 10 | 25.4 | 50 (51) | 3.5% | 15.0% | 1.3% | - | 240 s | WWW | 533 s | 15 s |  |
| 187 | 8 | hard | hardest | moat, archers 2, ? 2, linked 1, colour lock 8 | 42×41 | 1400 | 9 | 25.4 | 47 (48) | 0.5% | 8.0% | 0.0% | 93.8% / 100.0% | 242 s | WWW | 486 s | 15 s |  |
| 188 | 8 | extreme | hardest | moat, gates 2, archers 2, ? 4, linked 1, colour lock 5 | 42×41 | 1412 | 9 | 25.6 | 52 (53) | 0.3% | 15.0% | 0.0% | 68.8% / 81.3% | 236 s | WWW | 561 s | 15 s |  |
| 189 | 8 | easy | relief | - | 42×41 | 1520 | 10 | 25.4 | 53 (53) | 38.3% | 90.0% | 35.0% | - | 224 s | WWW | 657 s | 15 s |  |
| 190 | 8 | hard | hardest | moat, gates 1, archers 2, ? 2, linked 2, key lock | 42×41 | 1412 | 11 | 25.3 | 54 (56) | 2.0% | 23.0% | 0.7% | 100.0% / 93.8% | 219 s | WWW | 612 s | 15 s |  |
| 191 | 8 | normal | hard | moat, gates 1, ? 4 | 42×41 | 1412 | 10 | 25.7 | 51 (51) | 5.3% | 17.0% | 2.7% | 100.0% / 87.5% | 224 s | WWW | 603 s | 15 s |  |
| 192 | 8 | extreme | hardest | moat, gates 1, archers 2, ? 3, linked 2, colour lock 3 | 42×41 | 1412 | 11 | 25.4 | 53 (55) | 3.3% | 9.0% | 0.0% | 87.5% / 100.0% | 231 s | WWW | 617 s | 15 s |  |
| 193 | 8 | hard | hardest | moat, gates 2, archers 2, ? 4, linked 2, key lock | 42×41 | 1412 | 10 | 25.4 | 48 (50) | 2.3% | 8.0% | 0.0% | 100.0% / 100.0% | 231 s | WWW | 468 s | 15 s |  |
| 194 | 8 | extreme | hardest | moat, gates 2, archers 3, ? 3, linked 2, colour lock 3 | 42×41 | 1412 | 10 | 25.6 | 49 (51) | 0.5% | 23.0% | 0.0% | 81.3% / 93.8% | 226 s | WWW | 542 s | 15 s |  |
| 195 | 8 | normal | hard | moat | 42×41 | 1400 | 9 | 25.4 | 45 (45) | 5.3% | 6.0% | 7.0% | - | 212 s | WWW | 479 s | 15 s |  |
| 196 | 8 | hard | hardest | moat, gates 1, ? 2, linked 1, key lock | 42×41 | 1412 | 9 | 25.7 | 50 (51) | 0.3% | 2.0% | 0.0% | 68.8% / 81.3% | 227 s | WWW | 602 s | 15 s |  |
| 197 | 8 | extreme | hardest | moat, gates 1, archers 2, ? 4, linked 1, colour lock 1 | 42×41 | 1412 | 9 | 25.4 | 54 (55) | 0.0% | 19.0% | 0.3% | 81.3% / 87.5% | 246 s | WWW | 545 s | 15 s |  |
| 198 | 8 | easy | relief | - | 42×41 | 1520 | 9 | 25.4 | 55 (55) | 48.3% | 83.0% | 53.7% | - | 217 s | WWW | 600 s | 15 s |  |
| 199 | 8 | hard | hardest | moat, gates 1, archers 2, linked 2, key lock | 42×41 | 1412 | 12 | 25.3 | 55 (57) | 0.3% | 6.0% | 0.0% | - | 257 s | WWW | 607 s | 15 s |  |
| 200 | 8 | extreme | boss | moat, gates 2, archers 4, ? 3, linked 2, colour lock 7 | 42×43 | 1382 | 11 | 25.6 | 44 (46) | 1.8% | 0.0% | 0.0% | 100.0% / 100.0% | 259 s | WWW | 493 s | 15 s |  |

### Bake log

```
bake v12: 200 levels, 50 generated on 16 threads (only 101-200)
bake: 150 levels outside 101-200 kept as they are from /private/tmp/claude-501/-Users-peter-Documents-Claude/50e4189c-f3c6-41cd-9db1-ea6c441f2b40/scratchpad/keep.json
level 110 candidate 3: a linked partner more than a row from its card
level 112 candidate 0: a linked partner more than a row from its card
level 112 candidate 2: a linked partner more than a row from its card
level 122 candidate 8: a linked partner more than a row from its card
level 175 candidate 2: no deal in 48 attempts
level 175 candidate 6: no deal in 48 attempts
level 175 candidate 8: no deal in 48 attempts
level 176 candidate 5: no deal in 48 attempts
level 176 candidate 8: no deal in 48 attempts
level 176: fallback, lookahead 26.0% over 25.0%
level 176: lookahead fallback, 26.0% over the 25.0% target (7 in-band candidates)
level 178 candidate 0: no deal in 48 attempts
level 178 candidate 1: no deal in 48 attempts
level 178 candidate 2: no deal in 48 attempts
level 178 candidate 3: no deal in 48 attempts
level 178 candidate 7: no deal in 48 attempts
level 178 candidate 8: no deal in 48 attempts
level 178 candidate 9: no deal in 48 attempts
level 179 candidate 2: no deal in 48 attempts
level 179 candidate 4: no deal in 48 attempts
level 179 candidate 5: no deal in 48 attempts
level 179 candidate 8: no deal in 48 attempts
level 179: fallback, lookahead 29.0% over 25.0%
level 179: lookahead fallback, 29.0% over the 25.0% target (6 in-band candidates)
level 181 candidate 0: no deal in 48 attempts
level 181 candidate 2: no deal in 48 attempts
level 181 candidate 5: no deal in 48 attempts
level 181 candidate 7: no deal in 48 attempts
level 181 candidate 9: no deal in 48 attempts
level 182 candidate 0: no deal in 48 attempts
level 182 candidate 2: no deal in 48 attempts
level 182 candidate 7: no deal in 48 attempts
level 182 candidate 8: no deal in 48 attempts
level 182 candidate 10: no deal in 48 attempts
level 182 candidate 11: no deal in 48 attempts
level 182: fallback, lookahead 52.0% over 25.0%
level 182: lookahead fallback, 52.0% over the 25.0% target (4 in-band candidates)
level 183 candidate 0: no deal in 48 attempts
level 183 candidate 1: no deal in 48 attempts
level 183 candidate 2: no deal in 48 attempts
level 183 candidate 8: no deal in 48 attempts
level 184 candidate 0: no deal in 48 attempts
level 184 candidate 2: no deal in 48 attempts
level 184 candidate 3: no deal in 48 attempts
level 184 candidate 4: no deal in 48 attempts
level 184 candidate 8: no deal in 48 attempts
level 185 candidate 2: no deal in 48 attempts
level 185 candidate 3: no deal in 48 attempts
level 185 candidate 6: no deal in 48 attempts
level 185 candidate 9: no deal in 48 attempts
level 187 candidate 2: no deal in 48 attempts
level 187 candidate 5: no deal in 48 attempts
level 187 candidate 6: no deal in 48 attempts
level 187 candidate 8: no deal in 48 attempts
level 188 candidate 0: no deal in 48 attempts
level 188 candidate 5: no deal in 48 attempts
level 188 candidate 6: no deal in 48 attempts
level 188 candidate 8: no deal in 48 attempts
level 188: fallback, lookahead 31.0% over 25.0%
level 188: lookahead fallback, 31.0% over the 25.0% target (5 in-band candidates)
level 190 candidate 1: no deal in 48 attempts
level 190 candidate 3: no deal in 48 attempts
level 190: fallback, lookahead 28.0% over 25.0%
level 190: lookahead fallback, 28.0% over the 25.0% target (6 in-band candidates)
level 192 candidate 9: no deal in 48 attempts
level 193 candidate 1: no deal in 48 attempts
level 193 candidate 3: no deal in 48 attempts
level 193 candidate 4: no deal in 48 attempts
level 193 candidate 9: no deal in 48 attempts
level 194 candidate 1: no deal in 48 attempts
level 194 candidate 2: no deal in 48 attempts
level 194 candidate 4: no deal in 48 attempts
level 194 candidate 9: no deal in 48 attempts
level 194: fallback, lookahead 36.0% over 25.0%
level 194: lookahead fallback, 36.0% over the 25.0% target (3 in-band candidates)
level 195 candidate 4: no deal in 48 attempts
level 196 candidate 7: no deal in 48 attempts
level 197 candidate 1: no deal in 48 attempts
level 197 candidate 5: no deal in 48 attempts
level 199 candidate 1: no deal in 48 attempts
level 199 candidate 2: no deal in 48 attempts
level 199 candidate 8: no deal in 48 attempts
level 199 candidate 9: no deal in 48 attempts
level 200 candidate 2: no deal in 48 attempts
level 200 candidate 3: no deal in 48 attempts
level 200 candidate 5: no deal in 48 attempts
level 200 candidate 6: no deal in 48 attempts
level 200 candidate 7: no deal in 48 attempts
bake: 200 levels picked in 484.0 s; forts 892, deals 5651, tune evaluations 71054, full grades 452 (each on its level's tag)
bake: 200 levels in 852.4 s (candidates 484 s, second pass 368 s)
bake: 148 graded candidate decks per second across 16 threads
bake: lookahead player on hard (on each level's tag): median 12.0%, max 52.0% over 66 levels
bake: lookahead player on hardest (on each level's tag): median 11.0%, max 36.0% over 69 levels
bake: lookahead player on boss (on each level's tag): median 0.0%, max 0.0% over 2 levels
bake: patient play-through on the stored line at 1x (generated levels): median 531 s, max 679 s; early 66 s-86 s; all levels median 528 s, 47 s-679 s
bake: longest single tap on the stored line: median 15 s, max 15 s (cap 15 s)
bake: real pace (stored order on the level's tag, a tap the moment a space is free, x 1.77) on generated levels 26+: median 225 s, 184 s-286 s; boss 234 s; replays that lost 0; by tag easy 224 s (15), normal 224 s (80), hard 225 s (56), extreme 235 s (19)
bake: variety, era 1: median match 19.3% over 21 generated pictures (gate 40.0%), most alike 7 and 17 at 72.9%
bake: variety, era 2: median match 21.4% over 24 generated pictures (gate 40.0%), most alike 38 and 43 at 66.4%
bake: variety, era 3: median match 22.1% over 24 generated pictures (gate 40.0%), most alike 61 and 64 at 81.4%
bake: variety, era 4: median match 33.6% over 24 generated pictures (gate 40.0%), most alike 76 and 94 at 74.3%
bake: variety, era 5: median match 27.9% over 24 generated pictures (gate 40.0%), most alike 115 and 120 at 60.0%
bake: variety, era 6: median match 35.7% over 24 generated pictures (gate 40.0%), most alike 138 and 144 at 68.6%
bake: variety, era 7: median match 36.4% over 24 generated pictures (gate 40.0%), most alike 154 and 168 at 65.0%
bake: variety, era 8: median match 22.9% over 26 generated pictures (gate 40.0%), most alike 187 and 194 at 57.1%
bake: tags easy 26, normal 94, hard 61, extreme 19; taps per level: max 55 (cap 55), median 49; cards max 57
bake v12: 200 levels, 6 generated on 16 threads (only 176-194)
bake: 194 levels outside 176-194 kept as they are from /private/tmp/claude-501/-Users-peter-Documents-Claude/50e4189c-f3c6-41cd-9db1-ea6c441f2b40/scratchpad/bake1/levels.json
level 176 candidate 5: no deal in 48 attempts
level 176 candidate 8: no deal in 48 attempts
level 179 candidate 2: no deal in 48 attempts
level 179 candidate 4: no deal in 48 attempts
level 179 candidate 5: no deal in 48 attempts
level 179 candidate 8: no deal in 48 attempts
level 179 candidate 10: no deal in 48 attempts
level 179 candidate 15: no deal in 48 attempts
level 179 candidate 16: no deal in 48 attempts
level 182 candidate 0: no deal in 48 attempts
level 182 candidate 2: no deal in 48 attempts
level 182 candidate 7: no deal in 48 attempts
level 182 candidate 8: no deal in 48 attempts
level 182 candidate 10: no deal in 48 attempts
level 182 candidate 11: no deal in 48 attempts
level 182 candidate 13: no deal in 48 attempts
level 182 candidate 17: no deal in 48 attempts
level 182 candidate 18: no deal in 48 attempts
level 188 candidate 0: no deal in 48 attempts
level 188 candidate 5: no deal in 48 attempts
level 188 candidate 6: no deal in 48 attempts
level 188 candidate 8: no deal in 48 attempts
level 188 candidate 13: no deal in 48 attempts
level 188 candidate 17: no deal in 48 attempts
level 190 candidate 1: no deal in 48 attempts
level 190 candidate 3: no deal in 48 attempts
level 190 candidate 10: no deal in 48 attempts
level 190 candidate 14: no deal in 48 attempts
level 190 candidate 15: no deal in 48 attempts
level 190 candidate 16: no deal in 48 attempts
level 190 candidate 17: no deal in 48 attempts
level 190: fallback, lookahead 28.0% over 25.0%
level 190: lookahead fallback, 28.0% over the 25.0% target (8 in-band candidates)
level 194 candidate 1: no deal in 48 attempts
level 194 candidate 2: no deal in 48 attempts
level 194 candidate 4: no deal in 48 attempts
level 194 candidate 9: no deal in 48 attempts
level 194 candidate 15: no deal in 48 attempts
bake: 200 levels picked in 201.9 s; forts 302, deals 2367, tune evaluations 14727, full grades 74 (each on its level's tag)
bake: 200 levels in 310.4 s (candidates 202 s, second pass 108 s)
bake: 73 graded candidate decks per second across 16 threads
bake: lookahead player on hard (on each level's tag): median 12.0%, max 25.0% over 66 levels
bake: lookahead player on hardest (on each level's tag): median 11.0%, max 28.0% over 69 levels
bake: lookahead player on boss (on each level's tag): median 0.0%, max 0.0% over 2 levels
bake: patient play-through on the stored line at 1x (generated levels): median 533 s, max 679 s; early 66 s-86 s; all levels median 529 s, 47 s-679 s
bake: longest single tap on the stored line: median 15 s, max 15 s (cap 15 s)
bake: real pace (stored order on the level's tag, a tap the moment a space is free, x 1.77) on generated levels 26+: median 225 s, 184 s-286 s; boss 234 s; replays that lost 0; by tag easy 224 s (15), normal 224 s (80), hard 225 s (56), extreme 231 s (19)
bake: variety, era 1: median match 19.3% over 21 generated pictures (gate 40.0%), most alike 7 and 17 at 72.9%
bake: variety, era 2: median match 21.4% over 24 generated pictures (gate 40.0%), most alike 38 and 43 at 66.4%
bake: variety, era 3: median match 22.1% over 24 generated pictures (gate 40.0%), most alike 61 and 64 at 81.4%
bake: variety, era 4: median match 33.6% over 24 generated pictures (gate 40.0%), most alike 76 and 94 at 74.3%
bake: variety, era 5: median match 27.9% over 24 generated pictures (gate 40.0%), most alike 115 and 120 at 60.0%
bake: variety, era 6: median match 35.7% over 24 generated pictures (gate 40.0%), most alike 138 and 144 at 68.6%
bake: variety, era 7: median match 36.4% over 24 generated pictures (gate 40.0%), most alike 154 and 168 at 65.0%
bake: variety, era 8: median match 22.9% over 26 generated pictures (gate 40.0%), most alike 188 and 196 at 59.3%
bake: tags easy 26, normal 94, hard 61, extreme 19; taps per level: max 55 (cap 55), median 49; cards max 57
bake v12: 200 levels, 1 generated on 16 threads (only 190-190)
bake: 199 levels outside 190-190 kept as they are from /private/tmp/claude-501/-Users-peter-Documents-Claude/50e4189c-f3c6-41cd-9db1-ea6c441f2b40/scratchpad/bake2/levels.json
level 190 candidate 1: no deal in 48 attempts
level 190 candidate 3: no deal in 48 attempts
level 190 candidate 10: no deal in 48 attempts
level 190 candidate 14: no deal in 48 attempts
level 190 candidate 15: no deal in 48 attempts
level 190 candidate 16: no deal in 48 attempts
level 190 candidate 17: no deal in 48 attempts
level 190 candidate 26: no deal in 48 attempts
level 190 candidate 28: no deal in 48 attempts
level 190 candidate 29: no deal in 48 attempts
level 190 candidate 30: no deal in 48 attempts
level 190 candidate 31: no deal in 48 attempts
bake: 200 levels picked in 212.2 s; forts 46, deals 684, tune evaluations 4199, full grades 20 (each on its level's tag)
bake: 200 levels in 235.7 s (candidates 212 s, second pass 24 s)
bake: 20 graded candidate decks per second across 16 threads
bake: lookahead player on hard (on each level's tag): median 12.0%, max 25.0% over 66 levels
bake: lookahead player on hardest (on each level's tag): median 11.0%, max 25.0% over 69 levels
bake: lookahead player on boss (on each level's tag): median 0.0%, max 0.0% over 2 levels
bake: patient play-through on the stored line at 1x (generated levels): median 533 s, max 679 s; early 66 s-86 s; all levels median 530 s, 47 s-679 s
bake: longest single tap on the stored line: median 15 s, max 15 s (cap 15 s)
bake: real pace (stored order on the level's tag, a tap the moment a space is free, x 1.77) on generated levels 26+: median 224 s, 184 s-286 s; boss 234 s; replays that lost 0; by tag easy 224 s (15), normal 224 s (80), hard 225 s (56), extreme 231 s (19)
bake: variety, era 1: median match 19.3% over 21 generated pictures (gate 40.0%), most alike 7 and 17 at 72.9%
bake: variety, era 2: median match 21.4% over 24 generated pictures (gate 40.0%), most alike 38 and 43 at 66.4%
bake: variety, era 3: median match 22.1% over 24 generated pictures (gate 40.0%), most alike 61 and 64 at 81.4%
bake: variety, era 4: median match 33.6% over 24 generated pictures (gate 40.0%), most alike 76 and 94 at 74.3%
bake: variety, era 5: median match 27.9% over 24 generated pictures (gate 40.0%), most alike 115 and 120 at 60.0%
bake: variety, era 6: median match 35.7% over 24 generated pictures (gate 40.0%), most alike 138 and 144 at 68.6%
bake: variety, era 7: median match 36.4% over 24 generated pictures (gate 40.0%), most alike 154 and 168 at 65.0%
bake: variety, era 8: median match 22.9% over 26 generated pictures (gate 40.0%), most alike 190 and 192 at 62.1%
bake: tags easy 26, normal 94, hard 61, extreme 19; taps per level: max 55 (cap 55), median 49; cards max 57
bake: merged fix-up level(s) 176, 179, 182, 188, 190, 194, 190 into /private/tmp/claude-501/-Users-peter-Documents-Claude/50e4189c-f3c6-41cd-9db1-ea6c441f2b40/scratchpad/bake1/levels.json; fallbacks now 0
```
<!-- bake:end -->
