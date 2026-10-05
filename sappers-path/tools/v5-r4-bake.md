# Sapper's Path v5 R4 bake (levels 101-200)

Written by tools/bake.js (v5 R4): a full run of 101-200, fix-up runs merged (tools/v5-r4-notes.md §3). Levels 1-100 are byte-identical to the frozen ones. The bake log lists only the last merge.

<!-- bake:start -->
### Bands (each level's random-tap rate on its own tag)

| Band | Levels | Tags E/N/H | In band | Exempt (teaching) | Rate min | median | max |
|---|---|---|---|---|---|---|---|
| early 85.0%-100.0% | 15 | 4/8/3/0 | 12/12 | 3 | 95.5% | 100.0% | 100.0% |
| saw0 62.0%-80.0% | 10 | 4/6/0/0 | 9/9 | 1 | 65.8% | 74.3% | 79.0% |
| saw1 46.0%-64.0% | 14 | 0/14/0/0 | 14/14 | 0 | 49.0% | 55.0% | 60.5% |
| saw2 30.0%-48.0% | 6 | 0/0/6/0 | 6/6 | 0 | 37.3% | 41.3% | 46.8% |
| hard 0.0%-10.0% | 66 | 0/66/0/0 | 66/66 | 0 | 0.0% | 3.5% | 9.5% |
| hardest 0.0%-5.0% | 69 | 0/0/51/18 | 69/69 | 0 | 0.0% | 1.3% | 4.3% |
| relief 25.0%-60.0% | 18 | 18/0/0/0 | 13/13 | 5 | 41.0% | 48.0% | 85.8% |
| boss 0.0%-5.0% | 2 | 0/0/1/1 | 2/2 | 0 | 1.3% | 1.3% | 4.0% |

### Variety (picture cells matching within an era; gate 40.0%)

| Era | Generated pictures | Median match | 10th percentile | Most alike pair |
|---|---|---|---|---|
| 1 | 21 | 19.3% | 9.3% | 7 and 17, 72.9% |
| 2 | 24 | 21.4% | 9.3% | 38 and 43, 66.4% |
| 3 | 24 | 22.1% | 11.4% | 61 and 64, 81.4% |
| 4 | 24 | 33.6% | 22.1% | 76 and 94, 74.3% |
| 5 | 24 | 30.0% | 15.0% | 111 and 119, 65.0% |
| 6 | 24 | 35.7% | 25.0% | 138 and 144, 68.6% |
| 7 | 24 | 36.4% | 24.3% | 154 and 168, 65.0% |
| 8 | 26 | 30.7% | 17.9% | 185 and 188, 73.6% |

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
| 101 | 5 | normal | hard | ? 3, linked 2 | 42×41 | 1520 | 9 | 25.5 | 51 (53) | 4.8% | 8.0% | 8.0% | 93.8% / 93.8% | 217 s | WWW | 571 s | 15 s |  |
| 102 | 5 | hard | hardest | moat, gates 1, ? 2, linked 1, key lock | 42×41 | 1412 | 9 | 26.0 | 49 (50) | 2.3% | 10.0% | 2.3% | 100.0% / 100.0% | 222 s | WWW | 513 s | 15 s |  |
| 103 | 5 | normal | hard | moat, ? 2 | 42×41 | 1400 | 10 | 25.5 | 52 (52) | 7.5% | 10.0% | 8.0% | 100.0% / 81.3% | 227 s | WWW | 593 s | 15 s |  |
| 104 | 5 | normal | hard | moat, gates 1, ? 3 | 42×41 | 1412 | 10 | 26.0 | 52 (52) | 5.5% | 12.0% | 7.7% | 100.0% / 93.8% | 226 s | WWW | 574 s | 15 s |  |
| 105 | 5 | hard | hardest | moat, gates 1, ? 2, linked 1, colour lock 1 | 42×41 | 1412 | 10 | 25.4 | 42 (43) | 3.0% | 6.0% | 1.7% | 93.8% / 100.0% | 231 s | WWW | 471 s | 15 s |  |
| 106 | 5 | easy | relief | linked 1 | 42×41 | 1520 | 9 | 25.5 | 46 (47) | 55.5% | 98.0% | 53.7% | - | 221 s | WWW | 517 s | 15 s |  |
| 107 | 5 | normal | hard | moat, gates 1, linked 1 | 42×41 | 1412 | 9 | 26.2 | 45 (46) | 3.5% | 1.0% | 0.0% | - | 242 s | WWW | 513 s | 15 s |  |
| 108 | 5 | hard | hardest | moat, gates 2, ? 3, linked 2, key lock | 42×41 | 1412 | 10 | 25.4 | 43 (45) | 0.8% | 0.0% | 0.0% | 87.5% / 68.8% | 225 s | WWW | 487 s | 15 s |  |
| 109 | 5 | normal | hard | moat, ? 2, linked 1 | 42×41 | 1400 | 9 | 26.2 | 45 (46) | 6.3% | 7.0% | 3.3% | 100.0% / 100.0% | 229 s | WWW | 531 s | 15 s |  |
| 110 | 5 | normal | hard | moat, ? 3, linked 2 | 42×41 | 1400 | 9 | 25.5 | 50 (52) | 3.8% | 0.0% | 3.0% | 93.8% / 81.3% | 223 s | WWW | 565 s | 15 s |  |
| 111 | 5 | hard | hardest | moat, gates 2, ? 4, linked 2, colour lock 1 | 42×41 | 1412 | 10 | 25.4 | 46 (48) | 2.5% | 10.0% | 0.0% | 81.3% / 87.5% | 235 s | WWW | 579 s | 15 s |  |
| 112 | 5 | normal | hard | ? 2, linked 2 | 42×41 | 1520 | 9 | 26.2 | 49 (51) | 4.8% | 12.0% | 5.0% | 93.8% / 93.8% | 228 s | WWW | 550 s | 15 s |  |
| 113 | 5 | normal | hard | moat, ? 2, linked 1 | 42×41 | 1400 | 9 | 25.5 | 45 (46) | 2.5% | 6.0% | 1.3% | 100.0% / 100.0% | 224 s | WWW | 467 s | 15 s |  |
| 114 | 5 | hard | hardest | moat, gates 2, ? 4, linked 2, colour lock 3 | 42×41 | 1412 | 9 | 26.0 | 42 (44) | 0.3% | 0.0% | 0.3% | 93.8% / 68.8% | 230 s | WWW | 483 s | 15 s |  |
| 115 | 5 | easy | relief | moat | 42×41 | 1400 | 9 | 25.5 | 47 (47) | 43.0% | 91.0% | 42.7% | - | 227 s | WWW | 518 s | 15 s |  |
| 116 | 5 | normal | hard | moat, ? 2 | 42×41 | 1400 | 9 | 25.5 | 52 (52) | 6.0% | 19.0% | 7.0% | 93.8% / 93.8% | 224 s | WWW | 574 s | 15 s |  |
| 117 | 5 | hard | hardest | moat, gates 2, ? 4, linked 1, colour lock 4 | 42×41 | 1409 | 9 | 26.2 | 43 (44) | 2.0% | 7.0% | 2.7% | 93.8% / 100.0% | 230 s | WWW | 461 s | 15 s |  |
| 118 | 5 | normal | hard | ? 4, linked 2 | 42×41 | 1520 | 9 | 25.5 | 43 (45) | 1.3% | 1.0% | 0.0% | 81.3% / 93.8% | 230 s | WWW | 471 s | 15 s |  |
| 119 | 5 | normal | hard | moat, gates 1, ? 2 | 42×41 | 1412 | 10 | 25.4 | 45 (45) | 3.3% | 5.0% | 4.0% | 93.8% / 87.5% | 221 s | WWW | 520 s | 15 s |  |
| 120 | 5 | hard | hardest | moat, gates 1, ? 3, linked 1, colour lock 1 | 42×41 | 1412 | 9 | 25.4 | 41 (42) | 0.3% | 1.0% | 0.0% | 56.3% / 75.0% | 222 s | WWW | 457 s | 15 s |  |
| 121 | 5 | normal | hard | moat, gates 1 | 42×41 | 1412 | 9 | 25.4 | 50 (50) | 6.5% | 17.0% | 8.3% | - | 226 s | WWW | 508 s | 15 s |  |
| 122 | 5 | normal | hard | moat, linked 2 | 42×41 | 1400 | 10 | 26.0 | 44 (46) | 7.5% | 0.0% | 2.0% | - | 209 s | WWW | 466 s | 15 s |  |
| 123 | 5 | hard | hardest | moat, gates 1, ? 3, linked 1, colour lock 5 | 42×41 | 1412 | 10 | 25.4 | 42 (43) | 1.3% | 6.0% | 0.0% | 100.0% / 100.0% | 227 s | WWW | 474 s | 15 s |  |
| 124 | 5 | hard | hardest | moat, gates 1, ? 2, linked 1, key lock | 42×41 | 1412 | 11 | 26.0 | 48 (49) | 3.3% | 19.0% | 3.0% | 100.0% / 100.0% | 226 s | WWW | 524 s | 15 s |  |
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
| 151 | 7 | hard | hardest | moat, gates 2, archers 2, ? 3, linked 1, colour lock 12 | 42×41 | 1412 | 12 | 26.0 | 52 (53) | 0.5% | 12.0% | 0.0% | 81.3% / 93.8% | 225 s | WWW | 538 s | 15 s |  |
| 152 | 7 | normal | hard | moat, ? 3 | 42×41 | 1391 | 10 | 25.7 | 49 (49) | 4.0% | 12.0% | 4.7% | 100.0% / 100.0% | 228 s | WWW | 530 s | 15 s |  |
| 153 | 7 | extreme | hardest | moat, gates 1, archers 3, ? 3, linked 1, key lock | 42×41 | 1397 | 12 | 26.0 | 54 (55) | 1.3% | 6.0% | 0.7% | 75.0% / 75.0% | 245 s | WWW | 583 s | 15 s |  |
| 154 | 7 | hard | hardest | moat, gates 2, archers 3, ? 3, linked 1, colour lock 7 | 42×41 | 1412 | 12 | 26.0 | 51 (52) | 0.0% | 22.0% | 0.0% | 93.8% / 100.0% | 277 s | WWW | 514 s | 15 s |  |
| 155 | 7 | normal | hard | moat, gates 1 | 42×41 | 1412 | 9 | 25.7 | 50 (50) | 1.0% | 6.0% | 1.0% | - | 225 s | WWW | 545 s | 15 s |  |
| 156 | 7 | hard | hardest | moat, gates 1, archers 2, ? 3, linked 1, colour lock 9 | 42×41 | 1412 | 10 | 25.7 | 54 (55) | 0.5% | 9.0% | 1.0% | 87.5% / 100.0% | 258 s | WWW | 547 s | 15 s |  |
| 157 | 7 | extreme | hardest | moat, gates 1, archers 3, ? 4, linked 2, key lock | 42×41 | 1412 | 9 | 26.0 | 49 (51) | 1.0% | 21.0% | 0.3% | 87.5% / 100.0% | 206 s | WWW | 531 s | 15 s |  |
| 158 | 7 | easy | relief | - | 42×41 | 1520 | 10 | 25.7 | 48 (48) | 49.3% | 100.0% | 46.0% | - | 244 s | WWW | 536 s | 15 s |  |
| 159 | 7 | hard | hardest | moat, gates 1, archers 3, linked 2, colour lock 8 | 42×41 | 1412 | 9 | 26.0 | 55 (57) | 0.0% | 11.0% | 0.0% | - | 256 s | WWW | 642 s | 15 s |  |
| 160 | 7 | hard | hardest | moat, gates 1, archers 3, ? 2, linked 1, colour lock 5 | 42×41 | 1412 | 10 | 26.0 | 52 (53) | 0.3% | 9.0% | 0.0% | 81.3% / 93.8% | 267 s | WWW | 552 s | 15 s |  |
| 161 | 7 | normal | hard | moat, archers 1 | 42×41 | 1395 | 9 | 26.0 | 51 (51) | 7.2% | 5.0% | 6.3% | - | 224 s | WWW | 586 s | 15 s |  |
| 162 | 7 | extreme | hardest | moat, gates 2, archers 2, ? 3, linked 1, colour lock 4 | 42×41 | 1412 | 9 | 26.0 | 55 (56) | 2.3% | 20.0% | 0.0% | 100.0% / 87.5% | 248 s | WWW | 615 s | 15 s |  |
| 163 | 7 | hard | hardest | moat, gates 1, archers 3, ? 3, linked 2, colour lock 11 | 42×41 | 1412 | 12 | 26.0 | 55 (57) | 0.5% | 22.0% | 0.0% | 100.0% / 100.0% | 217 s | WWW | 576 s | 15 s |  |
| 164 | 7 | normal | hard | archers 1, linked 1 | 42×41 | 1520 | 11 | 25.7 | 55 (56) | 3.3% | 12.0% | 1.3% | - | 218 s | WWW | 567 s | 15 s |  |
| 165 | 7 | hard | hardest | moat, gates 1, archers 2, ? 2, linked 2, key lock | 42×41 | 1409 | 12 | 25.7 | 55 (57) | 2.8% | 9.0% | 0.7% | 87.5% / 100.0% | 232 s | WWW | 569 s | 15 s |  |
| 166 | 7 | extreme | hardest | moat, gates 2, archers 3, ? 4, linked 1, key lock | 42×41 | 1412 | 9 | 25.7 | 51 (52) | 0.8% | 20.0% | 1.0% | 68.8% / 87.5% | 224 s | WWW | 548 s | 15 s |  |
| 167 | 7 | easy | relief | archers 1 | 42×41 | 1520 | 9 | 26.0 | 55 (55) | 46.0% | 100.0% | 48.0% | - | 225 s | WWW | 560 s | 15 s |  |
| 168 | 7 | hard | hardest | moat, gates 1, archers 3, ? 2, colour lock 7 | 42×41 | 1412 | 11 | 26.0 | 54 (54) | 0.0% | 22.0% | 0.0% | 62.5% / 81.3% | 218 s | WWW | 557 s | 15 s |  |
| 169 | 7 | hard | hardest | moat, gates 1, ? 2, linked 2, colour lock 7 | 42×41 | 1412 | 9 | 26.0 | 41 (43) | 0.0% | 4.0% | 1.7% | 93.8% / 93.8% | 203 s | WWW | 471 s | 15 s |  |
| 170 | 7 | normal | hard | moat, ? 3 | 42×41 | 1400 | 10 | 26.0 | 49 (49) | 5.5% | 11.0% | 6.3% | 100.0% / 100.0% | 241 s | WWW | 543 s | 15 s |  |
| 171 | 7 | extreme | hardest | moat, gates 2, archers 2, ? 4, linked 2, key lock | 42×41 | 1412 | 9 | 26.0 | 48 (50) | 0.8% | 21.0% | 0.0% | 93.8% / 100.0% | 223 s | WWW | 509 s | 15 s |  |
| 172 | 7 | hard | hardest | moat, gates 1, archers 3, linked 1, colour lock 9 | 42×41 | 1412 | 10 | 26.0 | 55 (56) | 2.3% | 12.0% | 0.3% | - | 221 s | WWW | 541 s | 15 s |  |
| 173 | 7 | normal | hard | archers 2, linked 1 | 42×41 | 1520 | 11 | 26.0 | 50 (51) | 5.8% | 0.0% | 5.3% | - | 236 s | WWW | 531 s | 15 s |  |
| 174 | 7 | extreme | hardest | moat, gates 1, archers 3, ? 2, linked 2, key lock | 42×41 | 1412 | 9 | 26.0 | 52 (54) | 2.5% | 18.0% | 1.3% | 87.5% / 75.0% | 235 s | WWW | 540 s | 15 s |  |
| 175 | 8 | hard | hardest | moat, gates 1, archers 3, linked 2, colour lock 4 | 42×41 | 1412 | 9 | 26.0 | 50 (52) | 2.3% | 23.0% | 1.7% | - | 216 s | WWW | 578 s | 15 s |  |
| 176 | 8 | extreme | hardest | moat, gates 2, archers 4, ? 2, linked 1, key lock | 42×41 | 1412 | 11 | 25.4 | 50 (51) | 0.5% | 7.0% | 0.3% | 93.8% / 93.8% | 245 s | WWW | 522 s | 15 s |  |
| 177 | 8 | normal | hard | ? 4, linked 1 | 42×41 | 1520 | 10 | 26.0 | 55 (56) | 2.8% | 17.0% | 5.7% | 87.5% / 100.0% | 232 s | WWW | 611 s | 15 s |  |
| 178 | 8 | hard | hardest | moat, archers 2, ? 3, linked 2, colour lock 5 | 42×41 | 1400 | 9 | 25.4 | 51 (53) | 0.8% | 15.0% | 0.0% | 93.8% / 100.0% | 264 s | WWW | 526 s | 15 s |  |
| 179 | 8 | extreme | hardest | moat, gates 2, archers 2, ? 3, linked 2, key lock | 42×41 | 1412 | 10 | 26.0 | 49 (51) | 2.5% | 7.0% | 0.7% | 75.0% / 87.5% | 249 s | WWW | 503 s | 15 s |  |
| 180 | 8 | easy | relief | - | 42×41 | 1520 | 10 | 26.0 | 55 (55) | 48.8% | 99.0% | 51.0% | - | 253 s | WWW | 605 s | 15 s |  |
| 181 | 8 | hard | hardest | moat, archers 3, ? 3, linked 2, key lock | 42×41 | 1400 | 11 | 25.4 | 44 (46) | 3.0% | 12.0% | 0.0% | 93.8% / 93.8% | 229 s | WWW | 451 s | 15 s |  |
| 182 | 8 | normal | hard | moat, archers 1, linked 2 | 42×41 | 1400 | 9 | 26.0 | 48 (50) | 3.3% | 14.0% | 0.0% | - | 219 s | WWW | 487 s | 15 s |  |
| 183 | 8 | extreme | hardest | moat, gates 1, archers 2, ? 3, linked 1, key lock | 42×41 | 1412 | 12 | 26.0 | 54 (55) | 2.0% | 22.0% | 0.7% | 93.8% / 93.8% | 242 s | WWW | 589 s | 15 s |  |
| 184 | 8 | hard | hardest | moat, gates 1, archers 2, ? 4, linked 1, colour lock 11 | 42×41 | 1412 | 11 | 26.0 | 47 (48) | 0.0% | 10.0% | 1.3% | 100.0% / 100.0% | 249 s | WWW | 515 s | 15 s |  |
| 185 | 8 | extreme | hardest | moat, gates 2, archers 2, ? 4, linked 1, colour lock 11 | 42×41 | 1412 | 12 | 26.0 | 55 (56) | 1.5% | 19.0% | 0.0% | 93.8% / 100.0% | 236 s | WWW | 566 s | 15 s |  |
| 186 | 8 | normal | hard | moat, linked 1 | 42×41 | 1400 | 9 | 25.4 | 45 (46) | 4.8% | 0.0% | 0.7% | - | 245 s | WWW | 496 s | 15 s |  |
| 187 | 8 | hard | hardest | moat, archers 2, ? 2, linked 1, colour lock 1 | 42×41 | 1400 | 11 | 26.0 | 51 (52) | 1.5% | 4.0% | 0.0% | 87.5% / 100.0% | 236 s | WWW | 577 s | 15 s |  |
| 188 | 8 | extreme | hardest | moat, gates 2, archers 2, ? 4, linked 1, colour lock 8 | 42×41 | 1412 | 11 | 26.0 | 55 (56) | 1.0% | 12.0% | 2.7% | 100.0% / 100.0% | 256 s | WWW | 637 s | 15 s |  |
| 189 | 8 | easy | relief | - | 42×41 | 1520 | 10 | 25.4 | 52 (52) | 48.0% | 97.0% | 41.7% | - | 217 s | WWW | 530 s | 15 s |  |
| 190 | 8 | hard | hardest | moat, gates 1, archers 2, ? 2, linked 2, key lock | 42×41 | 1412 | 12 | 26.0 | 55 (57) | 2.0% | 5.0% | 0.0% | 93.8% / 87.5% | 218 s | WWW | 654 s | 15 s |  |
| 191 | 8 | normal | hard | moat, gates 1, ? 4 | 42×41 | 1412 | 10 | 25.4 | 50 (50) | 0.8% | 19.0% | 0.3% | 100.0% / 100.0% | 224 s | WWW | 549 s | 15 s |  |
| 192 | 8 | extreme | hardest | moat, gates 1, archers 2, ? 3, linked 2, colour lock 5 | 42×41 | 1412 | 11 | 26.0 | 53 (55) | 0.0% | 5.0% | 0.3% | 93.8% / 75.0% | 254 s | WWW | 557 s | 15 s |  |
| 193 | 8 | hard | hardest | moat, gates 2, archers 3, ? 4, linked 2, key lock | 42×41 | 1412 | 9 | 26.0 | 52 (54) | 2.5% | 16.0% | 3.7% | 75.0% / 93.8% | 224 s | WWW | 576 s | 15 s |  |
| 194 | 8 | extreme | hardest | moat, gates 2, archers 2, ? 3, linked 2, colour lock 9 | 42×41 | 1412 | 10 | 26.0 | 51 (53) | 0.3% | 4.0% | 0.0% | 100.0% / 93.8% | 275 s | WWW | 547 s | 15 s |  |
| 195 | 8 | normal | hard | moat | 42×41 | 1400 | 10 | 26.0 | 52 (52) | 5.5% | 13.0% | 6.7% | - | 207 s | WWW | 589 s | 15 s |  |
| 196 | 8 | hard | hardest | moat, gates 1, ? 2, linked 1, key lock | 42×41 | 1412 | 11 | 26.0 | 53 (54) | 1.3% | 7.0% | 0.7% | 100.0% / 87.5% | 220 s | WWW | 537 s | 15 s |  |
| 197 | 8 | extreme | hardest | moat, gates 1, archers 2, ? 4, linked 1, colour lock 4 | 42×41 | 1412 | 10 | 25.4 | 48 (49) | 2.8% | 8.0% | 0.0% | 100.0% / 100.0% | 242 s | WWW | 486 s | 15 s |  |
| 198 | 8 | easy | relief | - | 42×41 | 1520 | 9 | 26.0 | 50 (50) | 45.0% | 96.0% | 42.7% | - | 231 s | WWW | 532 s | 15 s |  |
| 199 | 8 | hard | hardest | moat, gates 1, archers 2, linked 2, key lock | 42×41 | 1412 | 9 | 26.0 | 52 (54) | 0.8% | 9.0% | 0.0% | - | 228 s | WWW | 566 s | 15 s |  |
| 200 | 8 | extreme | boss | moat, gates 2, archers 4, ? 3, linked 2, colour lock 4 | 42×43 | 1349 | 11 | 25.4 | 50 (52) | 1.3% | 8.0% | 1.0% | 100.0% / 100.0% | 263 s | WWW | 498 s | 15 s |  |

### Bake log

```
bake v12: 200 levels, 98 generated on 16 threads (only 101-200)
bake: 100 levels outside 101-200 kept as they are from levels/levels.json
level 104 candidate 11: no deal in 48 attempts
level 105 candidate 3: no deal in 48 attempts
level 105 candidate 22: no deal in 48 attempts
level 108 candidate 6: a linked partner more than a row from its card
level 108 candidate 9: a linked partner more than a row from its card
level 108 candidate 21: no deal in 48 attempts
level 108 candidate 23: a linked partner more than a row from its card
level 109 candidate 13: no deal in 48 attempts
level 110 candidate 12: a linked partner more than a row from its card
level 111 candidate 9: a linked partner more than a row from its card
level 111 candidate 13: a linked partner more than a row from its card
level 111 candidate 22: a linked partner more than a row from its card
level 114 candidate 16: a linked partner more than a row from its card
level 114 candidate 26: a linked partner more than a row from its card
level 114 candidate 28: a linked partner more than a row from its card
level 119 candidate 6: no deal in 48 attempts
level 126 candidate 7: no deal in 48 attempts
level 126 candidate 8: no deal in 48 attempts
level 126 candidate 13: no deal in 48 attempts
level 126 candidate 14: no deal in 48 attempts
level 126 candidate 15: no deal in 48 attempts
level 126 candidate 18: no deal in 48 attempts
level 126 candidate 19: no deal in 48 attempts
level 127 candidate 0: no deal in 48 attempts
level 127 candidate 20: no deal in 48 attempts
level 127 candidate 27: a linked partner more than a row from its card
level 127 candidate 28: no deal in 48 attempts
level 128 candidate 4: no deal in 48 attempts
level 128 candidate 8: no deal in 48 attempts
level 128 candidate 11: no deal in 48 attempts
level 128 candidate 18: no deal in 48 attempts
level 129 candidate 0: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 1: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 2: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 3: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 4: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 5: no deal in 48 attempts
level 129 candidate 6: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 7: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 8: no deal in 48 attempts
level 129 candidate 9: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 10: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 11: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 12: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 13: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 14: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 15: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 16: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 17: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 18: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 19: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 20: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 21: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 22: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 23: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 24: no deal in 48 attempts
level 129 candidate 25: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 26: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 27: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 28: error: Cannot read properties of undefined (reading 'hold')
level 129 candidate 29: error: Cannot read properties of undefined (reading 'hold')
level 129: NO LEVEL (no winnable candidate)
level 130 candidate 14: a linked partner more than a row from its card
level 130 candidate 26: no deal in 48 attempts
level 132 candidate 11: no deal in 48 attempts
level 133 candidate 0: no deal in 48 attempts
level 133 candidate 10: no deal in 48 attempts
level 133 candidate 28: no deal in 48 attempts
level 134 candidate 8: no deal in 48 attempts
level 134 candidate 15: no deal in 48 attempts
level 134 candidate 16: no deal in 48 attempts
level 135 candidate 11: no deal in 48 attempts
level 135 candidate 12: no deal in 48 attempts
level 135 candidate 15: no deal in 48 attempts
level 136 candidate 1: no deal in 48 attempts
level 136 candidate 2: no deal in 48 attempts
level 136 candidate 19: no deal in 48 attempts
level 136 candidate 27: a linked partner more than a row from its card
level 137 candidate 4: no deal in 48 attempts
level 137 candidate 11: no deal in 48 attempts
level 137 candidate 12: no deal in 48 attempts
level 137 candidate 18: no deal in 48 attempts
level 137 candidate 19: no deal in 48 attempts
level 138 candidate 0: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 1: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 2: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 3: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 4: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 5: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 6: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 7: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 8: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 9: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 10: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 11: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 12: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 13: no deal in 48 attempts
level 138 candidate 14: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 15: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 16: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 17: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 18: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 19: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 20: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 21: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 22: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 23: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 24: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 25: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 26: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 27: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 28: error: Cannot read properties of undefined (reading 'hold')
level 138 candidate 29: error: Cannot read properties of undefined (reading 'hold')
level 138: NO LEVEL (no winnable candidate)
level 139 candidate 2: no deal in 48 attempts
level 139 candidate 17: no deal in 48 attempts
level 140 candidate 2: no deal in 48 attempts
level 141 candidate 5: no deal in 48 attempts
level 141 candidate 7: no deal in 48 attempts
level 141 candidate 11: no deal in 48 attempts
level 142 candidate 0: no deal in 48 attempts
level 142 candidate 6: no deal in 48 attempts
level 142 candidate 12: no deal in 48 attempts
level 142 candidate 19: no deal in 48 attempts
level 143 candidate 0: no deal in 48 attempts
level 143 candidate 2: no deal in 48 attempts
level 143 candidate 3: no deal in 48 attempts
level 143 candidate 17: no deal in 48 attempts
level 143 candidate 26: no deal in 48 attempts
level 144 candidate 10: no deal in 48 attempts
level 144 candidate 11: no deal in 48 attempts
level 144 candidate 15: no deal in 48 attempts
level 144 candidate 18: no deal in 48 attempts
level 145 candidate 9: no deal in 48 attempts
level 145 candidate 17: no deal in 48 attempts
level 146 candidate 0: no deal in 48 attempts
level 146 candidate 4: no deal in 48 attempts
level 146 candidate 12: no deal in 48 attempts
level 147 candidate 0: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 1: no deal in 48 attempts
level 147 candidate 2: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 3: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 4: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 5: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 6: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 7: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 8: no deal in 48 attempts
level 147 candidate 9: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 10: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 11: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 12: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 13: a linked partner more than a row from its card
level 147 candidate 14: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 15: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 16: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 17: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 18: no deal in 48 attempts
level 147 candidate 19: no deal in 48 attempts
level 147 candidate 20: no deal in 48 attempts
level 147 candidate 21: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 22: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 23: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 24: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 25: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 26: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 27: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 28: error: Cannot read properties of undefined (reading 'hold')
level 147 candidate 29: error: Cannot read properties of undefined (reading 'hold')
level 147: NO LEVEL (no winnable candidate)
level 148 candidate 10: a linked partner more than a row from its card
level 148 candidate 18: no deal in 48 attempts
level 149 candidate 0: no deal in 48 attempts
level 149 candidate 1: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 2: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 3: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 4: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 5: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 6: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 7: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 8: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 9: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 10: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 11: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 12: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 13: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 14: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 15: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 16: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 17: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 18: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 19: no deal in 48 attempts
level 149 candidate 20: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 21: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 22: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 23: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 24: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 25: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 26: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 27: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 28: error: Cannot read properties of undefined (reading 'hold')
level 149 candidate 29: no deal in 48 attempts
level 149: NO LEVEL (no winnable candidate)
level 151 candidate 0: error: level: a colour lock's colour has no card
level 151 candidate 1: error: level: a colour lock's colour has no card
level 151 candidate 2: error: level: a colour lock's colour has no card
level 151 candidate 3: error: level: a colour lock's colour has no card
level 151 candidate 4: error: level: a colour lock's colour has no card
level 151 candidate 5: error: level: a colour lock's colour has no card
level 151 candidate 6: error: level: a colour lock's colour has no card
level 151 candidate 7: error: level: a colour lock's colour has no card
level 151 candidate 8: error: level: a colour lock's colour has no card
level 151 candidate 9: error: level: a colour lock's colour has no card
level 151 candidate 10: error: level: a colour lock's colour has no card
level 151 candidate 11: error: level: a colour lock's colour has no card
level 151 candidate 12: error: level: a colour lock's colour has no card
level 151 candidate 13: error: level: a colour lock's colour has no card
level 151 candidate 14: error: level: a colour lock's colour has no card
level 151 candidate 15: error: level: a colour lock's colour has no card
level 151 candidate 16: error: level: a colour lock's colour has no card
level 151 candidate 17: error: level: a colour lock's colour has no card
level 151 candidate 18: error: level: a colour lock's colour has no card
level 151 candidate 19: error: level: a colour lock's colour has no card
level 151 candidate 20: error: level: a colour lock's colour has no card
level 151 candidate 21: error: level: a colour lock's colour has no card
level 151 candidate 22: error: level: a colour lock's colour has no card
level 151 candidate 23: error: level: a colour lock's colour has no card
level 151 candidate 24: error: level: a colour lock's colour has no card
level 151 candidate 25: error: level: a colour lock's colour has no card
level 151 candidate 26: error: level: a colour lock's colour has no card
level 151 candidate 27: error: level: a colour lock's colour has no card
level 151 candidate 28: error: level: a colour lock's colour has no card
level 151 candidate 29: error: level: a colour lock's colour has no card
level 151: NO LEVEL (no winnable candidate)
level 153 candidate 0: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 1: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 2: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 3: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 4: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 5: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 6: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 7: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 8: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 9: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 10: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 11: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 12: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 13: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 14: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 15: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 16: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 17: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 18: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 19: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 20: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 21: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 22: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 23: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 24: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 25: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 26: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 27: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 28: error: Cannot read properties of undefined (reading 'hold')
level 153 candidate 29: error: Cannot read properties of undefined (reading 'hold')
level 153: NO LEVEL (no winnable candidate)
level 154 candidate 0: error: level: a colour lock's colour has no card
level 154 candidate 1: error: level: a colour lock's colour has no card
level 154 candidate 2: error: level: a colour lock's colour has no card
level 154 candidate 3: error: level: a colour lock's colour has no card
level 154 candidate 4: error: level: a colour lock's colour has no card
level 154 candidate 5: error: level: a colour lock's colour has no card
level 154 candidate 6: error: level: a colour lock's colour has no card
level 154 candidate 7: error: level: a colour lock's colour has no card
level 154 candidate 8: error: level: a colour lock's colour has no card
level 154 candidate 9: error: level: a colour lock's colour has no card
level 154 candidate 10: error: level: a colour lock's colour has no card
level 154 candidate 11: error: level: a colour lock's colour has no card
level 154 candidate 12: error: level: a colour lock's colour has no card
level 154 candidate 13: error: level: a colour lock's colour has no card
level 154 candidate 14: error: level: a colour lock's colour has no card
level 154 candidate 15: error: level: a colour lock's colour has no card
level 154 candidate 16: error: level: a colour lock's colour has no card
level 154 candidate 17: error: level: a colour lock's colour has no card
level 154 candidate 18: error: level: a colour lock's colour has no card
level 154 candidate 19: error: level: a colour lock's colour has no card
level 154 candidate 20: error: level: a colour lock's colour has no card
level 154 candidate 21: error: level: a colour lock's colour has no card
level 154 candidate 22: error: level: a colour lock's colour has no card
level 154 candidate 23: error: level: a colour lock's colour has no card
level 154 candidate 24: error: level: a colour lock's colour has no card
level 154 candidate 25: error: level: a colour lock's colour has no card
level 154 candidate 26: error: level: a colour lock's colour has no card
level 154 candidate 27: error: level: a colour lock's colour has no card
level 154 candidate 28: error: level: a colour lock's colour has no card
level 154 candidate 29: error: level: a colour lock's colour has no card
level 154: NO LEVEL (no winnable candidate)
level 156 candidate 0: error: level: a colour lock's colour has no card
level 156 candidate 1: error: level: a colour lock's colour has no card
level 156 candidate 2: error: level: a colour lock's colour has no card
level 156 candidate 3: error: level: a colour lock's colour has no card
level 156 candidate 4: error: level: a colour lock's colour has no card
level 156 candidate 5: error: level: a colour lock's colour has no card
level 156 candidate 6: error: level: a colour lock's colour has no card
level 156 candidate 7: error: level: a colour lock's colour has no card
level 156 candidate 8: error: level: a colour lock's colour has no card
level 156 candidate 9: error: level: a colour lock's colour has no card
level 156 candidate 10: error: level: a colour lock's colour has no card
level 156 candidate 11: error: level: a colour lock's colour has no card
level 156 candidate 12: error: level: a colour lock's colour has no card
level 156 candidate 13: error: level: a colour lock's colour has no card
level 156 candidate 14: error: level: a colour lock's colour has no card
level 156 candidate 15: error: level: a colour lock's colour has no card
level 156 candidate 16: error: level: a colour lock's colour has no card
level 156 candidate 17: error: level: a colour lock's colour has no card
level 156 candidate 18: error: level: a colour lock's colour has no card
level 156 candidate 19: error: level: a colour lock's colour has no card
level 156 candidate 20: error: level: a colour lock's colour has no card
level 156 candidate 21: error: level: a colour lock's colour has no card
level 156 candidate 22: error: level: a colour lock's colour has no card
level 156 candidate 23: error: level: a colour lock's colour has no card
level 156 candidate 24: error: level: a colour lock's colour has no card
level 156 candidate 25: error: level: a colour lock's colour has no card
level 156 candidate 26: error: level: a colour lock's colour has no card
level 156 candidate 27: error: level: a colour lock's colour has no card
level 156 candidate 28: error: level: a colour lock's colour has no card
level 156 candidate 29: error: level: a colour lock's colour has no card
level 156: NO LEVEL (no winnable candidate)
level 157 candidate 0: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 1: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 2: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 3: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 4: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 5: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 6: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 7: a linked partner more than a row from its card
level 157 candidate 8: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 9: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 10: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 11: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 12: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 13: no deal in 48 attempts
level 157 candidate 14: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 15: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 16: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 17: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 18: a linked partner more than a row from its card
level 157 candidate 19: no deal in 48 attempts
level 157 candidate 20: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 21: no deal in 48 attempts
level 157 candidate 22: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 23: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 24: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 25: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 26: no deal in 48 attempts
level 157 candidate 27: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 28: error: Cannot read properties of undefined (reading 'hold')
level 157 candidate 29: error: Cannot read properties of undefined (reading 'hold')
level 157: NO LEVEL (no winnable candidate)
level 159 candidate 0: error: level: a colour lock's colour has no card
level 159 candidate 1: error: level: a colour lock's colour has no card
level 159 candidate 2: error: level: a colour lock's colour has no card
level 159 candidate 3: error: level: a colour lock's colour has no card
level 159 candidate 4: error: level: a colour lock's colour has no card
level 159 candidate 5: error: level: a colour lock's colour has no card
level 159 candidate 6: error: level: a colour lock's colour has no card
level 159 candidate 7: error: level: a colour lock's colour has no card
level 159 candidate 8: error: level: a colour lock's colour has no card
level 159 candidate 9: error: level: a colour lock's colour has no card
level 159 candidate 10: error: level: a colour lock's colour has no card
level 159 candidate 11: error: level: a colour lock's colour has no card
level 159 candidate 12: error: level: a colour lock's colour has no card
level 159 candidate 13: error: level: a colour lock's colour has no card
level 159 candidate 14: error: level: a colour lock's colour has no card
level 159 candidate 15: error: level: a colour lock's colour has no card
level 159 candidate 16: error: level: a colour lock's colour has no card
level 159 candidate 17: error: level: a colour lock's colour has no card
level 159 candidate 18: error: level: a colour lock's colour has no card
level 159 candidate 19: error: level: a colour lock's colour has no card
level 159 candidate 20: error: level: a colour lock's colour has no card
level 159 candidate 21: error: level: a colour lock's colour has no card
level 159 candidate 22: error: level: a colour lock's colour has no card
level 159 candidate 23: error: level: a colour lock's colour has no card
level 159 candidate 24: error: level: a colour lock's colour has no card
level 159 candidate 25: error: level: a colour lock's colour has no card
level 159 candidate 26: error: level: a colour lock's colour has no card
level 159 candidate 27: error: level: a colour lock's colour has no card
level 159 candidate 28: error: level: a colour lock's colour has no card
level 159 candidate 29: error: level: a colour lock's colour has no card
level 159: NO LEVEL (no winnable candidate)
level 160 candidate 0: error: level: a colour lock's colour has no card
level 160 candidate 1: error: level: a colour lock's colour has no card
level 160 candidate 2: error: level: a colour lock's colour has no card
level 160 candidate 3: error: level: a colour lock's colour has no card
level 160 candidate 4: error: level: a colour lock's colour has no card
level 160 candidate 5: error: level: a colour lock's colour has no card
level 160 candidate 6: error: level: a colour lock's colour has no card
level 160 candidate 7: error: level: a colour lock's colour has no card
level 160 candidate 8: error: level: a colour lock's colour has no card
level 160 candidate 9: error: level: a colour lock's colour has no card
level 160 candidate 10: error: level: a colour lock's colour has no card
level 160 candidate 11: error: level: a colour lock's colour has no card
level 160 candidate 12: error: level: a colour lock's colour has no card
level 160 candidate 13: error: level: a colour lock's colour has no card
level 160 candidate 14: error: level: a colour lock's colour has no card
level 160 candidate 15: error: level: a colour lock's colour has no card
level 160 candidate 16: error: level: a colour lock's colour has no card
level 160 candidate 17: error: level: a colour lock's colour has no card
level 160 candidate 18: error: level: a colour lock's colour has no card
level 160 candidate 19: error: level: a colour lock's colour has no card
level 160 candidate 20: error: level: a colour lock's colour has no card
level 160 candidate 21: error: level: a colour lock's colour has no card
level 160 candidate 22: error: level: a colour lock's colour has no card
level 160 candidate 23: error: level: a colour lock's colour has no card
level 160 candidate 24: error: level: a colour lock's colour has no card
level 160 candidate 25: error: level: a colour lock's colour has no card
level 160 candidate 26: error: level: a colour lock's colour has no card
level 160 candidate 27: error: level: a colour lock's colour has no card
level 160 candidate 28: error: level: a colour lock's colour has no card
level 160 candidate 29: error: level: a colour lock's colour has no card
level 160: NO LEVEL (no winnable candidate)
level 162 candidate 0: error: level: a colour lock's colour has no card
level 162 candidate 1: error: level: a colour lock's colour has no card
level 162 candidate 2: error: level: a colour lock's colour has no card
level 162 candidate 3: error: level: a colour lock's colour has no card
level 162 candidate 4: error: level: a colour lock's colour has no card
level 162 candidate 5: error: level: a colour lock's colour has no card
level 162 candidate 6: error: level: a colour lock's colour has no card
level 162 candidate 7: error: level: a colour lock's colour has no card
level 162 candidate 8: error: level: a colour lock's colour has no card
level 162 candidate 9: error: level: a colour lock's colour has no card
level 162 candidate 10: error: level: a colour lock's colour has no card
level 162 candidate 11: error: level: a colour lock's colour has no card
level 162 candidate 12: error: level: a colour lock's colour has no card
level 162 candidate 13: error: level: a colour lock's colour has no card
level 162 candidate 14: error: level: a colour lock's colour has no card
level 162 candidate 15: error: level: a colour lock's colour has no card
level 162 candidate 16: error: level: a colour lock's colour has no card
level 162 candidate 17: error: level: a colour lock's colour has no card
level 162 candidate 18: error: level: a colour lock's colour has no card
level 162 candidate 19: error: level: a colour lock's colour has no card
level 162 candidate 20: error: level: a colour lock's colour has no card
level 162 candidate 21: error: level: a colour lock's colour has no card
level 162 candidate 22: error: level: a colour lock's colour has no card
level 162 candidate 23: error: level: a colour lock's colour has no card
level 162 candidate 24: error: level: a colour lock's colour has no card
level 162 candidate 25: error: level: a colour lock's colour has no card
level 162 candidate 26: error: level: a colour lock's colour has no card
level 162 candidate 27: error: level: a colour lock's colour has no card
level 162 candidate 28: error: level: a colour lock's colour has no card
level 162 candidate 29: error: level: a colour lock's colour has no card
level 162: NO LEVEL (no winnable candidate)
level 163 candidate 0: error: level: a colour lock's colour has no card
level 163 candidate 1: error: level: a colour lock's colour has no card
level 163 candidate 2: error: level: a colour lock's colour has no card
level 163 candidate 3: error: level: a colour lock's colour has no card
level 163 candidate 4: error: level: a colour lock's colour has no card
level 163 candidate 5: error: level: a colour lock's colour has no card
level 163 candidate 6: error: level: a colour lock's colour has no card
level 163 candidate 7: error: level: a colour lock's colour has no card
level 163 candidate 8: error: level: a colour lock's colour has no card
level 163 candidate 9: error: level: a colour lock's colour has no card
level 163 candidate 10: error: level: a colour lock's colour has no card
level 163 candidate 11: error: level: a colour lock's colour has no card
level 163 candidate 12: error: level: a colour lock's colour has no card
level 163 candidate 13: error: level: a colour lock's colour has no card
level 163 candidate 14: error: level: a colour lock's colour has no card
level 163 candidate 15: error: level: a colour lock's colour has no card
level 163 candidate 16: error: level: a colour lock's colour has no card
level 163 candidate 17: error: level: a colour lock's colour has no card
level 163 candidate 18: error: level: a colour lock's colour has no card
level 163 candidate 19: error: level: a colour lock's colour has no card
level 163 candidate 20: error: level: a colour lock's colour has no card
level 163 candidate 21: error: level: a colour lock's colour has no card
level 163 candidate 22: error: level: a colour lock's colour has no card
level 163 candidate 23: error: level: a colour lock's colour has no card
level 163 candidate 24: error: level: a colour lock's colour has no card
level 163 candidate 25: error: level: a colour lock's colour has no card
level 163 candidate 26: error: level: a colour lock's colour has no card
level 163 candidate 27: error: level: a colour lock's colour has no card
level 163 candidate 28: error: level: a colour lock's colour has no card
level 163 candidate 29: error: level: a colour lock's colour has no card
level 163: NO LEVEL (no winnable candidate)
level 164 candidate 11: no deal in 48 attempts
level 165 candidate 1: a linked partner more than a row from its card
level 165 candidate 3: no deal in 48 attempts
level 165 candidate 6: no deal in 48 attempts
level 165 candidate 11: no deal in 48 attempts
level 165 candidate 12: no deal in 48 attempts
level 165 candidate 19: no deal in 48 attempts
level 165 candidate 21: no deal in 48 attempts
level 165 candidate 26: no deal in 48 attempts
level 165 candidate 29: no deal in 48 attempts
level 166 candidate 0: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 1: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 2: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 3: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 4: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 5: no deal in 48 attempts
level 166 candidate 6: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 7: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 8: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 9: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 10: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 11: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 12: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 13: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 14: no deal in 48 attempts
level 166 candidate 15: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 16: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 17: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 18: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 19: no deal in 48 attempts
level 166 candidate 20: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 21: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 22: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 23: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 24: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 25: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 26: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 27: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 28: error: Cannot read properties of undefined (reading 'hold')
level 166 candidate 29: error: Cannot read properties of undefined (reading 'hold')
level 166: NO LEVEL (no winnable candidate)
level 168 candidate 0: error: level: a colour lock's colour has no card
level 168 candidate 1: error: level: a colour lock's colour has no card
level 168 candidate 2: error: level: a colour lock's colour has no card
level 168 candidate 3: error: level: a colour lock's colour has no card
level 168 candidate 4: error: level: a colour lock's colour has no card
level 168 candidate 5: error: level: a colour lock's colour has no card
level 168 candidate 6: error: level: a colour lock's colour has no card
level 168 candidate 7: error: level: a colour lock's colour has no card
level 168 candidate 8: error: level: a colour lock's colour has no card
level 168 candidate 9: error: level: a colour lock's colour has no card
level 168 candidate 10: error: level: a colour lock's colour has no card
level 168 candidate 11: error: level: a colour lock's colour has no card
level 168 candidate 12: error: level: a colour lock's colour has no card
level 168 candidate 13: error: level: a colour lock's colour has no card
level 168 candidate 14: error: level: a colour lock's colour has no card
level 168 candidate 15: error: level: a colour lock's colour has no card
level 168 candidate 16: error: level: a colour lock's colour has no card
level 168 candidate 17: error: level: a colour lock's colour has no card
level 168 candidate 18: error: level: a colour lock's colour has no card
level 168 candidate 19: error: level: a colour lock's colour has no card
level 168 candidate 20: error: level: a colour lock's colour has no card
level 168 candidate 21: error: level: a colour lock's colour has no card
level 168 candidate 22: error: level: a colour lock's colour has no card
level 168 candidate 23: error: level: a colour lock's colour has no card
level 168 candidate 24: error: level: a colour lock's colour has no card
level 168 candidate 25: error: level: a colour lock's colour has no card
level 168 candidate 26: error: level: a colour lock's colour has no card
level 168 candidate 27: error: level: a colour lock's colour has no card
level 168 candidate 28: error: level: a colour lock's colour has no card
level 168 candidate 29: error: level: a colour lock's colour has no card
level 168: NO LEVEL (no winnable candidate)
level 169 candidate 0: error: level: a colour lock's colour has no card
level 169 candidate 1: error: level: a colour lock's colour has no card
level 169 candidate 2: error: level: a colour lock's colour has no card
level 169 candidate 3: error: level: a colour lock's colour has no card
level 169 candidate 4: error: level: a colour lock's colour has no card
level 169 candidate 5: error: level: a colour lock's colour has no card
level 169 candidate 6: error: level: a colour lock's colour has no card
level 169 candidate 7: error: level: a colour lock's colour has no card
level 169 candidate 8: error: level: a colour lock's colour has no card
level 169 candidate 9: error: level: a colour lock's colour has no card
level 169 candidate 10: error: level: a colour lock's colour has no card
level 169 candidate 11: error: level: a colour lock's colour has no card
level 169 candidate 12: error: level: a colour lock's colour has no card
level 169 candidate 13: error: level: a colour lock's colour has no card
level 169 candidate 14: error: level: a colour lock's colour has no card
level 169 candidate 15: error: level: a colour lock's colour has no card
level 169 candidate 16: error: level: a colour lock's colour has no card
level 169 candidate 17: error: level: a colour lock's colour has no card
level 169 candidate 18: error: level: a colour lock's colour has no card
level 169 candidate 19: error: level: a colour lock's colour has no card
level 169 candidate 20: error: level: a colour lock's colour has no card
level 169 candidate 21: error: level: a colour lock's colour has no card
level 169 candidate 22: error: level: a colour lock's colour has no card
level 169 candidate 23: error: level: a colour lock's colour has no card
level 169 candidate 24: error: level: a colour lock's colour has no card
level 169 candidate 25: error: level: a colour lock's colour has no card
level 169 candidate 26: error: level: a colour lock's colour has no card
level 169 candidate 27: error: level: a colour lock's colour has no card
level 169 candidate 28: error: level: a colour lock's colour has no card
level 169 candidate 29: error: level: a colour lock's colour has no card
level 169: NO LEVEL (no winnable candidate)
level 171 candidate 0: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 1: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 2: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 3: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 4: no deal in 48 attempts
level 171 candidate 5: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 6: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 7: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 8: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 9: a linked partner more than a row from its card
level 171 candidate 10: a linked partner more than a row from its card
level 171 candidate 11: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 12: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 13: no deal in 48 attempts
level 171 candidate 14: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 15: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 16: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 17: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 18: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 19: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 20: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 21: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 22: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 23: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 24: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 25: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 26: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 27: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 28: error: Cannot read properties of undefined (reading 'hold')
level 171 candidate 29: error: Cannot read properties of undefined (reading 'hold')
level 171: NO LEVEL (no winnable candidate)
level 172 candidate 0: error: level: a colour lock's colour has no card
level 172 candidate 1: error: level: a colour lock's colour has no card
level 172 candidate 2: error: level: a colour lock's colour has no card
level 172 candidate 3: error: level: a colour lock's colour has no card
level 172 candidate 4: error: level: a colour lock's colour has no card
level 172 candidate 5: error: level: a colour lock's colour has no card
level 172 candidate 6: error: level: a colour lock's colour has no card
level 172 candidate 7: error: level: a colour lock's colour has no card
level 172 candidate 8: error: level: a colour lock's colour has no card
level 172 candidate 9: error: level: a colour lock's colour has no card
level 172 candidate 10: error: level: a colour lock's colour has no card
level 172 candidate 11: error: level: a colour lock's colour has no card
level 172 candidate 12: error: level: a colour lock's colour has no card
level 172 candidate 13: error: level: a colour lock's colour has no card
level 172 candidate 14: error: level: a colour lock's colour has no card
level 172 candidate 15: error: level: a colour lock's colour has no card
level 172 candidate 16: error: level: a colour lock's colour has no card
level 172 candidate 17: error: level: a colour lock's colour has no card
level 172 candidate 18: error: level: a colour lock's colour has no card
level 172 candidate 19: error: level: a colour lock's colour has no card
level 172 candidate 20: error: level: a colour lock's colour has no card
level 172 candidate 21: error: level: a colour lock's colour has no card
level 172 candidate 22: error: level: a colour lock's colour has no card
level 172 candidate 23: error: level: a colour lock's colour has no card
level 172 candidate 24: error: level: a colour lock's colour has no card
level 172 candidate 25: error: level: a colour lock's colour has no card
level 172 candidate 26: error: level: a colour lock's colour has no card
level 172 candidate 27: error: level: a colour lock's colour has no card
level 172 candidate 28: error: level: a colour lock's colour has no card
level 172 candidate 29: error: level: a colour lock's colour has no card
level 172: NO LEVEL (no winnable candidate)
level 174 candidate 0: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 1: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 2: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 3: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 4: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 5: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 6: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 7: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 8: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 9: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 10: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 11: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 12: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 13: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 14: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 15: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 16: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 17: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 18: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 19: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 20: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 21: no deal in 48 attempts
level 174 candidate 22: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 23: a linked partner more than a row from its card
level 174 candidate 24: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 25: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 26: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 27: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 28: error: Cannot read properties of undefined (reading 'hold')
level 174 candidate 29: no deal in 48 attempts
level 174: NO LEVEL (no winnable candidate)
level 175 candidate 0: error: level: a colour lock's colour has no card
level 175 candidate 1: error: level: a colour lock's colour has no card
level 175 candidate 2: error: level: a colour lock's colour has no card
level 175 candidate 3: error: level: a colour lock's colour has no card
level 175 candidate 4: error: level: a colour lock's colour has no card
level 175 candidate 5: error: level: a colour lock's colour has no card
level 175 candidate 6: error: level: a colour lock's colour has no card
level 175 candidate 7: error: level: a colour lock's colour has no card
level 175 candidate 8: error: level: a colour lock's colour has no card
level 175 candidate 9: error: level: a colour lock's colour has no card
level 175 candidate 10: error: level: a colour lock's colour has no card
level 175 candidate 11: error: level: a colour lock's colour has no card
level 175 candidate 12: error: level: a colour lock's colour has no card
level 175 candidate 13: error: level: a colour lock's colour has no card
level 175 candidate 14: error: level: a colour lock's colour has no card
level 175 candidate 15: error: level: a colour lock's colour has no card
level 175 candidate 16: error: level: a colour lock's colour has no card
level 175 candidate 17: error: level: a colour lock's colour has no card
level 175 candidate 18: error: level: a colour lock's colour has no card
level 175 candidate 19: error: level: a colour lock's colour has no card
level 175 candidate 20: error: level: a colour lock's colour has no card
level 175 candidate 21: error: level: a colour lock's colour has no card
level 175 candidate 22: error: level: a colour lock's colour has no card
level 175 candidate 23: error: level: a colour lock's colour has no card
level 175 candidate 24: error: level: a colour lock's colour has no card
level 175 candidate 25: error: level: a colour lock's colour has no card
level 175 candidate 26: error: level: a colour lock's colour has no card
level 175 candidate 27: error: level: a colour lock's colour has no card
level 175 candidate 28: error: level: a colour lock's colour has no card
level 175 candidate 29: error: level: a colour lock's colour has no card
level 175: NO LEVEL (no winnable candidate)
level 176 candidate 0: no deal in 48 attempts
level 176 candidate 1: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 2: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 3: no deal in 48 attempts
level 176 candidate 4: no deal in 48 attempts
level 176 candidate 5: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 6: no deal in 48 attempts
level 176 candidate 7: no deal in 48 attempts
level 176 candidate 8: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 9: no deal in 48 attempts
level 176 candidate 10: no deal in 48 attempts
level 176 candidate 11: no deal in 48 attempts
level 176 candidate 12: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 13: no deal in 48 attempts
level 176 candidate 14: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 15: no deal in 48 attempts
level 176 candidate 16: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 17: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 18: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 19: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 20: no deal in 48 attempts
level 176 candidate 21: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 22: no deal in 48 attempts
level 176 candidate 23: no deal in 48 attempts
level 176 candidate 24: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 25: no deal in 48 attempts
level 176 candidate 26: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 27: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 28: error: Cannot read properties of undefined (reading 'hold')
level 176 candidate 29: no deal in 48 attempts
level 176: NO LEVEL (no winnable candidate)
level 178 candidate 0: error: level: a colour lock's colour has no card
level 178 candidate 1: error: level: a colour lock's colour has no card
level 178 candidate 2: error: level: a colour lock's colour has no card
level 178 candidate 3: error: level: a colour lock's colour has no card
level 178 candidate 4: error: level: a colour lock's colour has no card
level 178 candidate 5: error: level: a colour lock's colour has no card
level 178 candidate 6: error: level: a colour lock's colour has no card
level 178 candidate 7: error: level: a colour lock's colour has no card
level 178 candidate 8: error: level: a colour lock's colour has no card
level 178 candidate 9: error: level: a colour lock's colour has no card
level 178 candidate 10: error: level: a colour lock's colour has no card
level 178 candidate 11: error: level: a colour lock's colour has no card
level 178 candidate 12: error: level: a colour lock's colour has no card
level 178 candidate 13: error: level: a colour lock's colour has no card
level 178 candidate 14: error: level: a colour lock's colour has no card
level 178 candidate 15: error: level: a colour lock's colour has no card
level 178 candidate 16: error: level: a colour lock's colour has no card
level 178 candidate 17: error: level: a colour lock's colour has no card
level 178 candidate 18: error: level: a colour lock's colour has no card
level 178 candidate 19: error: level: a colour lock's colour has no card
level 178 candidate 20: error: level: a colour lock's colour has no card
level 178 candidate 21: error: level: a colour lock's colour has no card
level 178 candidate 22: error: level: a colour lock's colour has no card
level 178 candidate 23: error: level: a colour lock's colour has no card
level 178 candidate 24: error: level: a colour lock's colour has no card
level 178 candidate 25: error: level: a colour lock's colour has no card
level 178 candidate 26: error: level: a colour lock's colour has no card
level 178 candidate 27: error: level: a colour lock's colour has no card
level 178 candidate 28: error: level: a colour lock's colour has no card
level 178 candidate 29: error: level: a colour lock's colour has no card
level 178: NO LEVEL (no winnable candidate)
level 179 candidate 0: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 1: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 2: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 3: no deal in 48 attempts
level 179 candidate 4: no deal in 48 attempts
level 179 candidate 5: no deal in 48 attempts
level 179 candidate 6: no deal in 48 attempts
level 179 candidate 7: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 8: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 9: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 10: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 11: no deal in 48 attempts
level 179 candidate 12: no deal in 48 attempts
level 179 candidate 13: no deal in 48 attempts
level 179 candidate 14: no deal in 48 attempts
level 179 candidate 15: no deal in 48 attempts
level 179 candidate 16: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 17: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 18: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 19: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 20: no deal in 48 attempts
level 179 candidate 21: no deal in 48 attempts
level 179 candidate 22: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 23: no deal in 48 attempts
level 179 candidate 24: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 25: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 26: no deal in 48 attempts
level 179 candidate 27: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 28: error: Cannot read properties of undefined (reading 'hold')
level 179 candidate 29: no deal in 48 attempts
level 179: NO LEVEL (no winnable candidate)
level 181 candidate 0: no deal in 48 attempts
level 181 candidate 2: no deal in 48 attempts
level 181 candidate 3: no deal in 48 attempts
level 181 candidate 8: no deal in 48 attempts
level 181 candidate 12: no deal in 48 attempts
level 181 candidate 17: no deal in 48 attempts
level 181 candidate 18: no deal in 48 attempts
level 181 candidate 19: no deal in 48 attempts
level 181 candidate 22: no deal in 48 attempts
level 181 candidate 23: no deal in 48 attempts
level 181 candidate 24: no deal in 48 attempts
level 181 candidate 25: no deal in 48 attempts
level 181 candidate 28: no deal in 48 attempts
level 182 candidate 2: no deal in 48 attempts
level 182 candidate 3: no deal in 48 attempts
level 182 candidate 9: no deal in 48 attempts
level 182 candidate 19: no deal in 48 attempts
level 183 candidate 0: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 1: no deal in 48 attempts
level 183 candidate 2: no deal in 48 attempts
level 183 candidate 3: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 4: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 5: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 6: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 7: no deal in 48 attempts
level 183 candidate 8: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 9: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 10: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 11: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 12: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 13: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 14: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 15: no deal in 48 attempts
level 183 candidate 16: no deal in 48 attempts
level 183 candidate 17: no deal in 48 attempts
level 183 candidate 18: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 19: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 20: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 21: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 22: no deal in 48 attempts
level 183 candidate 23: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 24: no deal in 48 attempts
level 183 candidate 25: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 26: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 27: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 28: error: Cannot read properties of undefined (reading 'hold')
level 183 candidate 29: error: Cannot read properties of undefined (reading 'hold')
level 183: NO LEVEL (no winnable candidate)
level 184 candidate 0: error: level: a colour lock's colour has no card
level 184 candidate 1: error: level: a colour lock's colour has no card
level 184 candidate 2: error: level: a colour lock's colour has no card
level 184 candidate 3: error: level: a colour lock's colour has no card
level 184 candidate 4: error: level: a colour lock's colour has no card
level 184 candidate 5: error: level: a colour lock's colour has no card
level 184 candidate 6: error: level: a colour lock's colour has no card
level 184 candidate 7: error: level: a colour lock's colour has no card
level 184 candidate 8: error: level: a colour lock's colour has no card
level 184 candidate 9: error: level: a colour lock's colour has no card
level 184 candidate 10: error: level: a colour lock's colour has no card
level 184 candidate 11: error: level: a colour lock's colour has no card
level 184 candidate 12: error: level: a colour lock's colour has no card
level 184 candidate 13: error: level: a colour lock's colour has no card
level 184 candidate 14: error: level: a colour lock's colour has no card
level 184 candidate 15: error: level: a colour lock's colour has no card
level 184 candidate 16: error: level: a colour lock's colour has no card
level 184 candidate 17: error: level: a colour lock's colour has no card
level 184 candidate 18: error: level: a colour lock's colour has no card
level 184 candidate 19: error: level: a colour lock's colour has no card
level 184 candidate 20: error: level: a colour lock's colour has no card
level 184 candidate 21: error: level: a colour lock's colour has no card
level 184 candidate 22: error: level: a colour lock's colour has no card
level 184 candidate 23: error: level: a colour lock's colour has no card
level 184 candidate 24: error: level: a colour lock's colour has no card
level 184 candidate 25: error: level: a colour lock's colour has no card
level 184 candidate 26: error: level: a colour lock's colour has no card
level 184 candidate 27: error: level: a colour lock's colour has no card
level 184 candidate 28: error: level: a colour lock's colour has no card
level 184 candidate 29: error: level: a colour lock's colour has no card
level 184: NO LEVEL (no winnable candidate)
level 185 candidate 0: error: level: a colour lock's colour has no card
level 185 candidate 1: error: level: a colour lock's colour has no card
level 185 candidate 2: error: level: a colour lock's colour has no card
level 185 candidate 3: error: level: a colour lock's colour has no card
level 185 candidate 4: error: level: a colour lock's colour has no card
level 185 candidate 5: error: level: a colour lock's colour has no card
level 185 candidate 6: error: level: a colour lock's colour has no card
level 185 candidate 7: error: level: a colour lock's colour has no card
level 185 candidate 8: error: level: a colour lock's colour has no card
level 185 candidate 9: error: level: a colour lock's colour has no card
level 185 candidate 10: error: level: a colour lock's colour has no card
level 185 candidate 11: error: level: a colour lock's colour has no card
level 185 candidate 12: error: level: a colour lock's colour has no card
level 185 candidate 13: error: level: a colour lock's colour has no card
level 185 candidate 14: error: level: a colour lock's colour has no card
level 185 candidate 15: error: level: a colour lock's colour has no card
level 185 candidate 16: error: level: a colour lock's colour has no card
level 185 candidate 17: error: level: a colour lock's colour has no card
level 185 candidate 18: error: level: a colour lock's colour has no card
level 185 candidate 19: error: level: a colour lock's colour has no card
level 185 candidate 20: error: level: a colour lock's colour has no card
level 185 candidate 21: error: level: a colour lock's colour has no card
level 185 candidate 22: error: level: a colour lock's colour has no card
level 185 candidate 23: error: level: a colour lock's colour has no card
level 185 candidate 24: error: level: a colour lock's colour has no card
level 185 candidate 25: error: level: a colour lock's colour has no card
level 185 candidate 26: error: level: a colour lock's colour has no card
level 185 candidate 27: error: level: a colour lock's colour has no card
level 185 candidate 28: error: level: a colour lock's colour has no card
level 185 candidate 29: error: level: a colour lock's colour has no card
level 185: NO LEVEL (no winnable candidate)
level 187 candidate 0: error: level: a colour lock's colour has no card
level 187 candidate 1: error: level: a colour lock's colour has no card
level 187 candidate 2: error: level: a colour lock's colour has no card
level 187 candidate 3: error: level: a colour lock's colour has no card
level 187 candidate 4: error: level: a colour lock's colour has no card
level 187 candidate 5: error: level: a colour lock's colour has no card
level 187 candidate 6: error: level: a colour lock's colour has no card
level 187 candidate 7: error: level: a colour lock's colour has no card
level 187 candidate 8: error: level: a colour lock's colour has no card
level 187 candidate 9: error: level: a colour lock's colour has no card
level 187 candidate 10: error: level: a colour lock's colour has no card
level 187 candidate 11: error: level: a colour lock's colour has no card
level 187 candidate 12: error: level: a colour lock's colour has no card
level 187 candidate 13: error: level: a colour lock's colour has no card
level 187 candidate 14: error: level: a colour lock's colour has no card
level 187 candidate 15: error: level: a colour lock's colour has no card
level 187 candidate 16: error: level: a colour lock's colour has no card
level 187 candidate 17: error: level: a colour lock's colour has no card
level 187 candidate 18: error: level: a colour lock's colour has no card
level 187 candidate 19: error: level: a colour lock's colour has no card
level 187 candidate 20: error: level: a colour lock's colour has no card
level 187 candidate 21: error: level: a colour lock's colour has no card
level 187 candidate 22: error: level: a colour lock's colour has no card
level 187 candidate 23: error: level: a colour lock's colour has no card
level 187 candidate 24: error: level: a colour lock's colour has no card
level 187 candidate 25: error: level: a colour lock's colour has no card
level 187 candidate 26: error: level: a colour lock's colour has no card
level 187 candidate 27: error: level: a colour lock's colour has no card
level 187 candidate 28: error: level: a colour lock's colour has no card
level 187 candidate 29: error: level: a colour lock's colour has no card
level 187: NO LEVEL (no winnable candidate)
level 188 candidate 0: error: level: a colour lock's colour has no card
level 188 candidate 1: error: level: a colour lock's colour has no card
level 188 candidate 2: error: level: a colour lock's colour has no card
level 188 candidate 3: error: level: a colour lock's colour has no card
level 188 candidate 4: error: level: a colour lock's colour has no card
level 188 candidate 5: error: level: a colour lock's colour has no card
level 188 candidate 6: error: level: a colour lock's colour has no card
level 188 candidate 7: error: level: a colour lock's colour has no card
level 188 candidate 8: error: level: a colour lock's colour has no card
level 188 candidate 9: error: level: a colour lock's colour has no card
level 188 candidate 10: error: level: a colour lock's colour has no card
level 188 candidate 11: error: level: a colour lock's colour has no card
level 188 candidate 12: error: level: a colour lock's colour has no card
level 188 candidate 13: error: level: a colour lock's colour has no card
level 188 candidate 14: error: level: a colour lock's colour has no card
level 188 candidate 15: error: level: a colour lock's colour has no card
level 188 candidate 16: error: level: a colour lock's colour has no card
level 188 candidate 17: error: level: a colour lock's colour has no card
level 188 candidate 18: error: level: a colour lock's colour has no card
level 188 candidate 19: error: level: a colour lock's colour has no card
level 188 candidate 20: error: level: a colour lock's colour has no card
level 188 candidate 21: error: level: a colour lock's colour has no card
level 188 candidate 22: error: level: a colour lock's colour has no card
level 188 candidate 23: error: level: a colour lock's colour has no card
level 188 candidate 24: error: level: a colour lock's colour has no card
level 188 candidate 25: error: level: a colour lock's colour has no card
level 188 candidate 26: error: level: a colour lock's colour has no card
level 188 candidate 27: error: level: a colour lock's colour has no card
level 188 candidate 28: error: level: a colour lock's colour has no card
level 188 candidate 29: error: level: a colour lock's colour has no card
level 188: NO LEVEL (no winnable candidate)
level 190 candidate 4: no deal in 48 attempts
level 190 candidate 6: no deal in 48 attempts
level 190 candidate 11: no deal in 48 attempts
level 190 candidate 12: no deal in 48 attempts
level 190 candidate 13: no deal in 48 attempts
level 190 candidate 14: no deal in 48 attempts
level 190 candidate 20: no deal in 48 attempts
level 190 candidate 21: no deal in 48 attempts
level 190 candidate 26: no deal in 48 attempts
level 190 candidate 27: no deal in 48 attempts
level 190 candidate 28: no deal in 48 attempts
level 191 candidate 10: no deal in 48 attempts
level 191 candidate 14: no deal in 48 attempts
level 191 candidate 17: no deal in 48 attempts
level 192 candidate 0: error: level: a colour lock's colour has no card
level 192 candidate 1: error: level: a colour lock's colour has no card
level 192 candidate 2: error: level: a colour lock's colour has no card
level 192 candidate 3: error: level: a colour lock's colour has no card
level 192 candidate 4: error: level: a colour lock's colour has no card
level 192 candidate 5: error: level: a colour lock's colour has no card
level 192 candidate 6: error: level: a colour lock's colour has no card
level 192 candidate 7: error: level: a colour lock's colour has no card
level 192 candidate 8: error: level: a colour lock's colour has no card
level 192 candidate 9: error: level: a colour lock's colour has no card
level 192 candidate 10: error: level: a colour lock's colour has no card
level 192 candidate 11: error: level: a colour lock's colour has no card
level 192 candidate 12: error: level: a colour lock's colour has no card
level 192 candidate 13: error: level: a colour lock's colour has no card
level 192 candidate 14: error: level: a colour lock's colour has no card
level 192 candidate 15: error: level: a colour lock's colour has no card
level 192 candidate 16: error: level: a colour lock's colour has no card
level 192 candidate 17: error: level: a colour lock's colour has no card
level 192 candidate 18: error: level: a colour lock's colour has no card
level 192 candidate 19: error: level: a colour lock's colour has no card
level 192 candidate 20: error: level: a colour lock's colour has no card
level 192 candidate 21: error: level: a colour lock's colour has no card
level 192 candidate 22: error: level: a colour lock's colour has no card
level 192 candidate 23: error: level: a colour lock's colour has no card
level 192 candidate 24: error: level: a colour lock's colour has no card
level 192 candidate 25: error: level: a colour lock's colour has no card
level 192 candidate 26: error: level: a colour lock's colour has no card
level 192 candidate 27: error: level: a colour lock's colour has no card
level 192 candidate 28: error: level: a colour lock's colour has no card
level 192 candidate 29: error: level: a colour lock's colour has no card
level 192: NO LEVEL (no winnable candidate)
level 193 candidate 4: no deal in 48 attempts
level 193 candidate 5: no deal in 48 attempts
level 193 candidate 6: no deal in 48 attempts
level 193 candidate 7: no deal in 48 attempts
level 193 candidate 11: no deal in 48 attempts
level 193 candidate 12: no deal in 48 attempts
level 193 candidate 13: no deal in 48 attempts
level 193 candidate 14: no deal in 48 attempts
level 193 candidate 16: no deal in 48 attempts
level 193 candidate 19: no deal in 48 attempts
level 193 candidate 20: no deal in 48 attempts
level 193 candidate 21: no deal in 48 attempts
level 193 candidate 25: no deal in 48 attempts
level 193 candidate 28: no deal in 48 attempts
level 193 candidate 29: no deal in 48 attempts
level 194 candidate 0: error: level: a colour lock's colour has no card
level 194 candidate 1: error: level: a colour lock's colour has no card
level 194 candidate 2: error: level: a colour lock's colour has no card
level 194 candidate 3: error: level: a colour lock's colour has no card
level 194 candidate 4: error: level: a colour lock's colour has no card
level 194 candidate 5: error: level: a colour lock's colour has no card
level 194 candidate 6: error: level: a colour lock's colour has no card
level 194 candidate 7: error: level: a colour lock's colour has no card
level 194 candidate 8: error: level: a colour lock's colour has no card
level 194 candidate 9: error: level: a colour lock's colour has no card
level 194 candidate 10: error: level: a colour lock's colour has no card
level 194 candidate 11: error: level: a colour lock's colour has no card
level 194 candidate 12: error: level: a colour lock's colour has no card
level 194 candidate 13: error: level: a colour lock's colour has no card
level 194 candidate 14: error: level: a colour lock's colour has no card
level 194 candidate 15: error: level: a colour lock's colour has no card
level 194 candidate 16: error: level: a colour lock's colour has no card
level 194 candidate 17: error: level: a colour lock's colour has no card
level 194 candidate 18: error: level: a colour lock's colour has no card
level 194 candidate 19: error: level: a colour lock's colour has no card
level 194 candidate 20: error: level: a colour lock's colour has no card
level 194 candidate 21: error: level: a colour lock's colour has no card
level 194 candidate 22: error: level: a colour lock's colour has no card
level 194 candidate 23: error: level: a colour lock's colour has no card
level 194 candidate 24: error: level: a colour lock's colour has no card
level 194 candidate 25: error: level: a colour lock's colour has no card
level 194 candidate 26: error: level: a colour lock's colour has no card
level 194 candidate 27: error: level: a colour lock's colour has no card
level 194 candidate 28: error: level: a colour lock's colour has no card
level 194 candidate 29: error: level: a colour lock's colour has no card
level 194: NO LEVEL (no winnable candidate)
level 195 candidate 0: no deal in 48 attempts
level 195 candidate 4: no deal in 48 attempts
level 195 candidate 10: no deal in 48 attempts
level 196 candidate 9: no deal in 48 attempts
level 196 candidate 13: no deal in 48 attempts
level 196 candidate 20: no deal in 48 attempts
level 197 candidate 0: error: level: a colour lock's colour has no card
level 197 candidate 1: error: level: a colour lock's colour has no card
level 197 candidate 2: error: level: a colour lock's colour has no card
level 197 candidate 3: error: level: a colour lock's colour has no card
level 197 candidate 4: error: level: a colour lock's colour has no card
level 197 candidate 5: error: level: a colour lock's colour has no card
level 197 candidate 6: error: level: a colour lock's colour has no card
level 197 candidate 7: error: level: a colour lock's colour has no card
level 197 candidate 8: error: level: a colour lock's colour has no card
level 197 candidate 9: error: level: a colour lock's colour has no card
level 197 candidate 10: error: level: a colour lock's colour has no card
level 197 candidate 11: error: level: a colour lock's colour has no card
level 197 candidate 12: error: level: a colour lock's colour has no card
level 197 candidate 13: error: level: a colour lock's colour has no card
level 197 candidate 14: error: level: a colour lock's colour has no card
level 197 candidate 15: error: level: a colour lock's colour has no card
level 197 candidate 16: error: level: a colour lock's colour has no card
level 197 candidate 17: error: level: a colour lock's colour has no card
level 197 candidate 18: error: level: a colour lock's colour has no card
level 197 candidate 19: error: level: a colour lock's colour has no card
level 197 candidate 20: error: level: a colour lock's colour has no card
level 197 candidate 21: error: level: a colour lock's colour has no card
level 197 candidate 22: error: level: a colour lock's colour has no card
level 197 candidate 23: error: level: a colour lock's colour has no card
level 197 candidate 24: error: level: a colour lock's colour has no card
level 197 candidate 25: error: level: a colour lock's colour has no card
level 197 candidate 26: error: level: a colour lock's colour has no card
level 197 candidate 27: error: level: a colour lock's colour has no card
level 197 candidate 28: error: level: a colour lock's colour has no card
level 197 candidate 29: error: level: a colour lock's colour has no card
level 197: NO LEVEL (no winnable candidate)
level 199 candidate 1: a linked partner more than a row from its card
level 199 candidate 3: no deal in 48 attempts
level 199 candidate 7: no deal in 48 attempts
level 199 candidate 8: no deal in 48 attempts
level 199 candidate 9: no deal in 48 attempts
level 199 candidate 13: a linked partner more than a row from its card
level 199 candidate 16: no deal in 48 attempts
level 199 candidate 17: no deal in 48 attempts
level 199 candidate 18: no deal in 48 attempts
level 199 candidate 21: a linked partner more than a row from its card
level 199 candidate 22: no deal in 48 attempts
level 199 candidate 24: no deal in 48 attempts
level 199 candidate 28: no deal in 48 attempts
level 200 candidate 0: error: level: a colour lock's colour has no card
level 200 candidate 1: error: level: a colour lock's colour has no card
level 200 candidate 2: error: level: a colour lock's colour has no card
level 200 candidate 3: error: level: a colour lock's colour has no card
level 200 candidate 4: error: level: a colour lock's colour has no card
level 200 candidate 5: error: level: a colour lock's colour has no card
level 200 candidate 6: error: level: a colour lock's colour has no card
level 200 candidate 7: error: level: a colour lock's colour has no card
level 200 candidate 8: error: level: a colour lock's colour has no card
level 200 candidate 9: error: level: a colour lock's colour has no card
level 200 candidate 10: error: level: a colour lock's colour has no card
level 200 candidate 11: error: level: a colour lock's colour has no card
level 200 candidate 12: error: level: a colour lock's colour has no card
level 200 candidate 13: error: level: a colour lock's colour has no card
level 200 candidate 14: error: level: a colour lock's colour has no card
level 200 candidate 15: error: level: a colour lock's colour has no card
level 200 candidate 16: error: level: a colour lock's colour has no card
level 200 candidate 17: error: level: a colour lock's colour has no card
level 200 candidate 18: error: level: a colour lock's colour has no card
level 200 candidate 19: error: level: a colour lock's colour has no card
level 200 candidate 20: error: level: a colour lock's colour has no card
level 200 candidate 21: error: level: a colour lock's colour has no card
level 200 candidate 22: error: level: a colour lock's colour has no card
level 200 candidate 23: error: level: a colour lock's colour has no card
level 200 candidate 24: error: level: a colour lock's colour has no card
level 200 candidate 25: error: level: a colour lock's colour has no card
level 200 candidate 26: error: level: a colour lock's colour has no card
level 200 candidate 27: error: level: a colour lock's colour has no card
level 200 candidate 28: error: level: a colour lock's colour has no card
level 200 candidate 29: error: level: a colour lock's colour has no card
level 200 candidate 30: error: level: a colour lock's colour has no card
level 200 candidate 31: error: level: a colour lock's colour has no card
level 200 candidate 32: error: level: a colour lock's colour has no card
level 200 candidate 33: error: level: a colour lock's colour has no card
level 200 candidate 34: error: level: a colour lock's colour has no card
level 200 candidate 35: error: level: a colour lock's colour has no card
level 200 candidate 36: error: level: a colour lock's colour has no card
level 200 candidate 37: error: level: a colour lock's colour has no card
level 200 candidate 38: error: level: a colour lock's colour has no card
level 200 candidate 39: error: level: a colour lock's colour has no card
level 200: NO LEVEL (no winnable candidate)
bake: 168 levels picked in 6068.6 s; forts 3028, deals 19267, tune evaluations 321680, full grades 1309 (each on its level's tag)
bake: 168 levels in 6215.8 s (candidates 6069 s, second pass 147 s)
bake: 53 graded candidate decks per second across 16 threads
bake: lookahead player on hard (on each level's tag): median 12.0%, max 25.0% over 66 levels
bake: lookahead player on hardest (on each level's tag): median 7.0%, max 24.0% over 38 levels
bake: lookahead player on boss (on each level's tag): median 0.0%, max 0.0% over 1 levels
bake: patient play-through on the stored line at 1x (generated levels): median 529 s, max 679 s; early 66 s-86 s; all levels median 520 s, 47 s-679 s
bake: longest single tap on the stored line: median 15 s, max 15 s (cap 15 s)
bake: real pace (stored order on the level's tag, a tap the moment a space is free, x 1.77) on generated levels 26+: median 224 s, 184 s-286 s; boss 234 s; replays that lost 0; by tag easy 225 s (15), normal 224 s (80), hard 224 s (43), extreme -
bake: variety, era 1: median match 19.3% over 21 generated pictures (gate 40.0%), most alike 7 and 17 at 72.9%
bake: variety, era 2: median match 21.4% over 24 generated pictures (gate 40.0%), most alike 38 and 43 at 66.4%
bake: variety, era 3: median match 22.1% over 24 generated pictures (gate 40.0%), most alike 61 and 64 at 81.4%
bake: variety, era 4: median match 33.6% over 24 generated pictures (gate 40.0%), most alike 76 and 94 at 74.3%
bake: tags easy 26, normal 94, hard 48, extreme 0; taps per level: max 55 (cap 55), median 48; cards max 57
real	103m35.911s
user	1062m34.298s
sys	1m33.994s
bake v12: 200 levels, 32 generated on 16 threads (only 125-200)
bake: 166 levels outside 125-200 kept as they are from /private/tmp/claude-501/-Users-peter-Documents-Claude/50e4189c-f3c6-41cd-9db1-ea6c441f2b40/scratchpad/r4/full/levels.json
level 129 candidate 5: no deal in 48 attempts
level 129 candidate 8: no deal in 48 attempts
level 147 candidate 1: no deal in 48 attempts
level 147 candidate 8: no deal in 48 attempts
level 149 candidate 0: no deal in 48 attempts
level 151 candidate 2: no deal in 48 attempts
level 156 candidate 2: no deal in 48 attempts
level 157 candidate 7: a linked partner more than a row from its card
level 159 candidate 0: no deal in 48 attempts
level 160: variety, the least alike candidate meeting every target is 42.9% alike its era's earlier picks (median; target 40.0%)
level 162 candidate 9: no deal in 48 attempts
level 166 candidate 5: no deal in 48 attempts
level 168: variety, the least alike candidate meeting every target is 42.1% alike its era's earlier picks (median; target 40.0%)
level 171 candidate 4: no deal in 48 attempts
level 171 candidate 9: a linked partner more than a row from its card
level 172 candidate 1: no deal in 48 attempts
level 172 candidate 6: no deal in 48 attempts
level 175 candidate 0: no deal in 48 attempts
level 175 candidate 1: no deal in 48 attempts
level 175 candidate 9: no deal in 48 attempts
level 176 candidate 0: no deal in 48 attempts
level 176 candidate 3: no deal in 48 attempts
level 176 candidate 4: no deal in 48 attempts
level 176 candidate 6: no deal in 48 attempts
level 176 candidate 7: no deal in 48 attempts
level 176 candidate 9: no deal in 48 attempts
level 178 candidate 4: no deal in 48 attempts
level 178 candidate 5: a linked partner more than a row from its card
level 178 candidate 6: no deal in 48 attempts
level 178 candidate 7: no deal in 48 attempts
level 178 candidate 9: no deal in 48 attempts
level 179 candidate 3: no deal in 48 attempts
level 179 candidate 4: no deal in 48 attempts
level 179 candidate 5: no deal in 48 attempts
level 179 candidate 6: no deal in 48 attempts
level 179: fallback, lookahead 34.0% over 25.0%
level 179: lookahead fallback, 34.0% over the 25.0% target (5 in-band candidates)
level 183 candidate 1: no deal in 48 attempts
level 183 candidate 2: no deal in 48 attempts
level 183 candidate 7: no deal in 48 attempts
level 184 candidate 0: no deal in 48 attempts
level 184 candidate 7: no deal in 48 attempts
level 184 candidate 8: no deal in 48 attempts
level 185 candidate 0: no deal in 48 attempts
level 185 candidate 1: no deal in 48 attempts
level 185 candidate 3: no deal in 48 attempts
level 185 candidate 4: no deal in 48 attempts
level 185 candidate 9: no deal in 48 attempts
level 185: fallback, lookahead 28.0% over 25.0%
level 185: lookahead fallback, 28.0% over the 25.0% target (5 in-band candidates)
level 187 candidate 4: no deal in 48 attempts
level 187 candidate 6: no deal in 48 attempts
level 187 candidate 7: no deal in 48 attempts
level 187: fallback, lookahead 31.0% over 25.0%
level 187: lookahead fallback, 31.0% over the 25.0% target (6 in-band candidates)
level 188 candidate 0: no deal in 48 attempts
level 188 candidate 1: no deal in 48 attempts
level 188 candidate 2: no deal in 48 attempts
level 188 candidate 7: no deal in 48 attempts
level 188: fallback, lookahead 29.0% over 25.0%
level 188: lookahead fallback, 29.0% over the 25.0% target (6 in-band candidates)
level 192 candidate 9: no deal in 48 attempts
level 194 candidate 0: no deal in 48 attempts
level 194 candidate 1: no deal in 48 attempts
level 194 candidate 2: no deal in 48 attempts
level 194 candidate 5: no deal in 48 attempts
level 194 candidate 7: no deal in 48 attempts
level 194 candidate 9: no deal in 48 attempts
level 197 candidate 0: no deal in 48 attempts
level 197 candidate 1: no deal in 48 attempts
level 197 candidate 9: no deal in 48 attempts
level 200 candidate 0: no deal in 48 attempts
level 200 candidate 1: no deal in 48 attempts
level 200 candidate 2: no deal in 48 attempts
level 200 candidate 3: no deal in 48 attempts
level 200 candidate 4: no deal in 48 attempts
level 200 candidate 5: no deal in 48 attempts
level 200 candidate 6: no deal in 48 attempts
level 200 candidate 7: no deal in 48 attempts
level 200 candidate 8: a linked partner more than a row from its card
level 200 candidate 9: no deal in 48 attempts
level 200 candidate 10: no deal in 48 attempts
level 200 candidate 11: no deal in 48 attempts
level 200: NO LEVEL (no winnable candidate)
bake: 199 levels picked in 3385.3 s; forts 428, deals 4994, tune evaluations 46919, full grades 249 (each on its level's tag)
bake: 199 levels in 4093.4 s (candidates 3385 s, second pass 708 s)
bake: 14 graded candidate decks per second across 16 threads
bake: lookahead player on hard (on each level's tag): median 12.0%, max 25.0% over 66 levels
bake: lookahead player on hardest (on each level's tag): median 10.0%, max 34.0% over 69 levels
bake: lookahead player on boss (on each level's tag): median 0.0%, max 0.0% over 1 levels
bake: patient play-through on the stored line at 1x (generated levels): median 531 s, max 679 s; early 66 s-86 s; all levels median 530 s, 47 s-679 s
bake: longest single tap on the stored line: median 15 s, max 15 s (cap 15 s)
bake: real pace (stored order on the level's tag, a tap the moment a space is free, x 1.77) on generated levels 26+: median 225 s, 184 s-300 s; boss 234 s; replays that lost 0; by tag easy 225 s (15), normal 224 s (80), hard 224 s (56), extreme 242 s (18)
bake: variety, era 1: median match 19.3% over 21 generated pictures (gate 40.0%), most alike 7 and 17 at 72.9%
bake: variety, era 2: median match 21.4% over 24 generated pictures (gate 40.0%), most alike 38 and 43 at 66.4%
bake: variety, era 3: median match 22.1% over 24 generated pictures (gate 40.0%), most alike 61 and 64 at 81.4%
bake: variety, era 4: median match 33.6% over 24 generated pictures (gate 40.0%), most alike 76 and 94 at 74.3%
bake: variety, era 5: median match 30.0% over 24 generated pictures (gate 40.0%), most alike 111 and 119 at 65.0%
bake: variety, era 6: median match 35.7% over 24 generated pictures (gate 40.0%), most alike 138 and 144 at 68.6%
bake: variety, era 7: median match 36.4% over 24 generated pictures (gate 40.0%), most alike 154 and 168 at 65.0%
bake: variety, era 8: median match 31.4% over 25 generated pictures (gate 40.0%), most alike 176 and 185 at 65.7%
bake: tags easy 26, normal 94, hard 61, extreme 18; taps per level: max 55 (cap 55), median 49; cards max 57
real	68m13.451s
user	110m29.377s
sys	0m17.809s
bake v12: 200 levels, 5 generated on 16 threads (only 179-200)
bake: 195 levels outside 179-200 kept as they are from /private/tmp/claude-501/-Users-peter-Documents-Claude/50e4189c-f3c6-41cd-9db1-ea6c441f2b40/scratchpad/r4/fix1/levels.json
level 179 candidate 3: no deal in 48 attempts
level 179 candidate 4: no deal in 48 attempts
level 179 candidate 5: no deal in 48 attempts
level 179 candidate 6: no deal in 48 attempts
level 179 candidate 11: no deal in 48 attempts
level 179 candidate 12: no deal in 48 attempts
level 179 candidate 13: no deal in 48 attempts
level 179 candidate 14: no deal in 48 attempts
level 179 candidate 15: no deal in 48 attempts
level 185 candidate 0: no deal in 48 attempts
level 185 candidate 1: no deal in 48 attempts
level 185 candidate 3: no deal in 48 attempts
level 185 candidate 4: no deal in 48 attempts
level 185 candidate 9: no deal in 48 attempts
level 185 candidate 11: no deal in 48 attempts
level 185 candidate 14: no deal in 48 attempts
level 187 candidate 4: no deal in 48 attempts
level 187 candidate 6: no deal in 48 attempts
level 187 candidate 7: no deal in 48 attempts
level 187 candidate 11: no deal in 48 attempts
level 187 candidate 13: no deal in 48 attempts
level 187: fallback, lookahead 31.0% over 25.0%
level 187: lookahead fallback, 31.0% over the 25.0% target (10 in-band candidates)
level 188 candidate 0: no deal in 48 attempts
level 188 candidate 1: no deal in 48 attempts
level 188 candidate 2: no deal in 48 attempts
level 188 candidate 7: no deal in 48 attempts
level 188 candidate 10: no deal in 48 attempts
level 188 candidate 12: no deal in 48 attempts
level 200 candidate 0: no deal in 48 attempts
level 200 candidate 1: no deal in 48 attempts
level 200 candidate 2: no deal in 48 attempts
level 200 candidate 3: no deal in 48 attempts
level 200 candidate 4: no deal in 48 attempts
level 200 candidate 5: no deal in 48 attempts
level 200 candidate 6: no deal in 48 attempts
level 200 candidate 7: no deal in 48 attempts
level 200 candidate 8: no deal in 48 attempts
level 200 candidate 10: no deal in 48 attempts
level 200 candidate 12: no deal in 48 attempts
level 200 candidate 13: no deal in 48 attempts
level 200 candidate 14: no deal in 48 attempts
level 200 candidate 15: no deal in 48 attempts
level 200 candidate 17: no deal in 48 attempts
level 200 candidate 18: no deal in 48 attempts
level 200 candidate 19: no deal in 48 attempts
bake: 200 levels picked in 187.0 s; forts 128, deals 2483, tune evaluations 8454, full grades 48 (each on its level's tag)
bake: 200 levels in 283.2 s (candidates 187 s, second pass 96 s)
bake: 45 graded candidate decks per second across 16 threads
bake: lookahead player on hard (on each level's tag): median 12.0%, max 25.0% over 66 levels
bake: lookahead player on hardest (on each level's tag): median 10.0%, max 31.0% over 69 levels
bake: lookahead player on boss (on each level's tag): median 0.0%, max 8.0% over 2 levels
bake: patient play-through on the stored line at 1x (generated levels): median 531 s, max 679 s; early 66 s-86 s; all levels median 529 s, 47 s-679 s
bake: longest single tap on the stored line: median 15 s, max 15 s (cap 15 s)
bake: real pace (stored order on the level's tag, a tap the moment a space is free, x 1.77) on generated levels 26+: median 225 s, 184 s-300 s; boss 234 s; replays that lost 0; by tag easy 225 s (15), normal 224 s (80), hard 224 s (56), extreme 242 s (19)
bake: variety, era 1: median match 19.3% over 21 generated pictures (gate 40.0%), most alike 7 and 17 at 72.9%
bake: variety, era 2: median match 21.4% over 24 generated pictures (gate 40.0%), most alike 38 and 43 at 66.4%
bake: variety, era 3: median match 22.1% over 24 generated pictures (gate 40.0%), most alike 61 and 64 at 81.4%
bake: variety, era 4: median match 33.6% over 24 generated pictures (gate 40.0%), most alike 76 and 94 at 74.3%
bake: variety, era 5: median match 30.0% over 24 generated pictures (gate 40.0%), most alike 111 and 119 at 65.0%
bake: variety, era 6: median match 35.7% over 24 generated pictures (gate 40.0%), most alike 138 and 144 at 68.6%
bake: variety, era 7: median match 36.4% over 24 generated pictures (gate 40.0%), most alike 154 and 168 at 65.0%
bake: variety, era 8: median match 30.7% over 26 generated pictures (gate 40.0%), most alike 185 and 188 at 73.6%
bake: tags easy 26, normal 94, hard 61, extreme 19; taps per level: max 55 (cap 55), median 49; cards max 57
real	4m43.248s
user	16m23.436s
sys	0m5.381s
bake v12: 200 levels, 1 generated on 16 threads (only 187-187)
bake: 199 levels outside 187-187 kept as they are from /private/tmp/claude-501/-Users-peter-Documents-Claude/50e4189c-f3c6-41cd-9db1-ea6c441f2b40/scratchpad/r4/fix2/levels.json
level 187 candidate 4: no deal in 48 attempts
level 187 candidate 6: no deal in 48 attempts
level 187 candidate 7: no deal in 48 attempts
level 187 candidate 11: no deal in 48 attempts
level 187 candidate 13: no deal in 48 attempts
level 187 candidate 28: no deal in 48 attempts
level 187 candidate 29: no deal in 48 attempts
bake: 200 levels picked in 355.3 s; forts 32, deals 559, tune evaluations 5169, full grades 25 (each on its level's tag)
bake: 200 levels in 497.1 s (candidates 355 s, second pass 142 s)
bake: 15 graded candidate decks per second across 16 threads
bake: lookahead player on hard (on each level's tag): median 12.0%, max 25.0% over 66 levels
bake: lookahead player on hardest (on each level's tag): median 10.0%, max 24.0% over 69 levels
bake: lookahead player on boss (on each level's tag): median 0.0%, max 8.0% over 2 levels
bake: patient play-through on the stored line at 1x (generated levels): median 531 s, max 679 s; early 66 s-86 s; all levels median 529 s, 47 s-679 s
bake: longest single tap on the stored line: median 15 s, max 15 s (cap 15 s)
bake: real pace (stored order on the level's tag, a tap the moment a space is free, x 1.77) on generated levels 26+: median 225 s, 184 s-286 s; boss 234 s; replays that lost 0; by tag easy 225 s (15), normal 224 s (80), hard 224 s (56), extreme 242 s (19)
bake: variety, era 1: median match 19.3% over 21 generated pictures (gate 40.0%), most alike 7 and 17 at 72.9%
bake: variety, era 2: median match 21.4% over 24 generated pictures (gate 40.0%), most alike 38 and 43 at 66.4%
bake: variety, era 3: median match 22.1% over 24 generated pictures (gate 40.0%), most alike 61 and 64 at 81.4%
bake: variety, era 4: median match 33.6% over 24 generated pictures (gate 40.0%), most alike 76 and 94 at 74.3%
bake: variety, era 5: median match 30.0% over 24 generated pictures (gate 40.0%), most alike 111 and 119 at 65.0%
bake: variety, era 6: median match 35.7% over 24 generated pictures (gate 40.0%), most alike 138 and 144 at 68.6%
bake: variety, era 7: median match 36.4% over 24 generated pictures (gate 40.0%), most alike 154 and 168 at 65.0%
bake: variety, era 8: median match 30.7% over 26 generated pictures (gate 40.0%), most alike 185 and 188 at 73.6%
bake: tags easy 26, normal 94, hard 61, extreme 19; taps per level: max 55 (cap 55), median 49; cards max 57
bake: merged fix-up level(s)  into /private/tmp/claude-501/-Users-peter-Documents-Claude/50e4189c-f3c6-41cd-9db1-ea6c441f2b40/scratchpad/r4/merged/levels.json; fallbacks now 0
```
<!-- bake:end -->
