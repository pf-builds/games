# Sapper's Path v5 R2: re-lay tables (bake.js --relay, gallery-bake.js --keep)

<!-- bake:start -->
### Bands (each level's random-tap rate on its own tag)

| Band | Levels | Tags E/N/H | In band | Exempt (teaching) | Rate min | median | max |
|---|---|---|---|---|---|---|---|
| early 85.0%-100.0% | 15 | 4/8/3/0 | 12/12 | 3 | 95.5% | 100.0% | 100.0% |
| saw0 62.0%-80.0% | 10 | 4/6/0/0 | 9/9 | 1 | 65.8% | 74.3% | 79.0% |
| saw1 46.0%-64.0% | 14 | 0/14/0/0 | 14/14 | 0 | 49.0% | 55.0% | 60.5% |
| saw2 30.0%-48.0% | 6 | 0/0/6/0 | 6/6 | 0 | 37.3% | 41.3% | 46.8% |
| hard 0.0%-10.0% | 34 | 0/34/0/0 | 34/34 | 0 | 0.0% | 2.5% | 9.5% |
| hardest 0.0%-5.0% | 13 | 0/0/13/0 | 13/13 | 0 | 0.0% | 0.3% | 3.3% |
| relief 25.0%-60.0% | 7 | 7/0/0/0 | 4/4 | 3 | 41.0% | 49.0% | 61.0% |
| boss 0.0%-5.0% | 1 | 0/0/1/0 | 1/1 | 0 | 4.0% | 4.0% | 4.0% |

### Variety (picture cells matching within an era; gate 40.0%)

| Era | Generated pictures | Median match | 10th percentile | Most alike pair |
|---|---|---|---|---|
| 1 | 21 | 19.3% | 9.3% | 7 and 17, 72.9% |
| 2 | 24 | 21.4% | 9.3% | 38 and 43, 66.4% |
| 3 | 24 | 22.1% | 11.4% | 61 and 64, 81.4% |
| 4 | 24 | 33.6% | 22.1% | 76 and 94, 74.3% |

### Every level

v5 R2: from = the v4.3 level the board came from; deck = kept (as re-laid), tuned (the kept squads re-tuned), dealt (dealt again on the board) or new board; edits = tools/relay.js's. Every level has 5 spaces and archers never kill. Every measure is on the level's own tag (v4.3: Easy 6 spaces, Normal 5, Hard 4 with archers lethal). Rate = the random-tap rate (400 games); lookahead = the one-move-lookahead player (100); fast = the fast tapper (300, from level 46); ? planner = the sampling planner honest / all-seeing (16 games); patient time and longest wait = patient play on the stored line at 1x; real pace = the stored order replayed tapping the moment a space is free, times 1.77 (Peter's pace; * the replay lost, patient time shown); thinking = the same replay waiting 1 / 2 / 4 s after each tap, won (W) or lost (L); R = dealt rushed (a Hard level with standing archers: its stored order also wins at real pace); taps = the stored order's taps (cards); ΔE = the smallest CIEDE2000 between two colours standing in the level.

| # | Era | Tag | Band | From | Deck | Edits | Twists | Board | Pixels | Colours | Min ΔE00 | Taps (cards) | Rate | Lookahead | Fast | ? planner | Real pace | Thinking | Patient | Longest wait | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | easy | early | - | teaching | - | - | 17×18 | 240 | 4 | 26.8 | 8 (8) | 100.0% | 100.0% | - | - | 23 s | WWW | 47 s | 9.1 s | teaching: tray |
| 2 | 1 | easy | early | - | teaching | - | - | 18×19 | 272 | 5 | 26.8 | 12 (12) | 100.0% | 100.0% | - | - | 32 s | WWW | 72 s | 12 s | teaching: holding |
| 3 | 1 | easy | early | - | teaching | - | - | 18×19 | 272 | 6 | 26.8 | 12 (12) | 100.0% | 100.0% | - | - | 32 s | WWW | 78 s | 12 s | teaching: overshoot |
| 4 | 1 | normal | early | e1-04 | kept | - | - | 18×20 | 288 | 4 | 26.8 | 10 (10) | 100.0% | 100.0% | - | - | 32 s | WWW | 76 s | 11 s |  |
| 5 | 1 | normal | early | e1-05 | kept | - | - | 18×21 | 304 | 4 | 26.8 | 10 (10) | 100.0% | 100.0% | - | - | 36 s | WWW | 71 s | 14 s |  |
| 6 | 1 | hard | early | e1-06 | kept | - | - | 18×20 | 288 | 4 | 26.8 | 8 (8) | 100.0% | 100.0% | - | - | 28 s | WWW | 66 s | 15 s |  |
| 7 | 1 | normal | early | e1-07 | kept | - | - | 18×21 | 304 | 5 | 26.8 | 11 (11) | 100.0% | 100.0% | - | - | 34 s | WWW | 75 s | 13 s |  |
| 8 | 1 | normal | early | e1-08 | kept | - | - | 19×20 | 306 | 5 | 26.8 | 12 (12) | 100.0% | 100.0% | - | - | 33 s | WWW | 85 s | 14 s |  |
| 9 | 1 | normal | early | e1-09 | kept | - | - | 19×20 | 306 | 5 | 26.8 | 13 (13) | 100.0% | 100.0% | - | - | 33 s | WWW | 77 s | 13 s |  |
| 10 | 1 | hard | early | e1-10 | kept | - | - | 18×20 | 288 | 5 | 26.8 | 13 (13) | 100.0% | 100.0% | - | - | 44 s | WWW | 86 s | 14 s |  |
| 11 | 1 | easy | early | e1-11 | kept | - | - | 18×20 | 288 | 6 | 26.1 | 12 (12) | 100.0% | 100.0% | - | - | 32 s | WWW | 67 s | 9.3 s |  |
| 12 | 1 | normal | early | e1-12 | kept | - | - | 18×21 | 304 | 5 | 26.8 | 12 (12) | 98.8% | 100.0% | - | - | 35 s | WWW | 76 s | 11 s |  |
| 13 | 1 | normal | early | e1-13 | kept | - | - | 19×20 | 306 | 7 | 26.0 | 12 (12) | 95.5% | 100.0% | - | - | 38 s | WWW | 83 s | 11 s |  |
| 14 | 1 | normal | early | e1-14 | kept | - | - | 19×21 | 323 | 7 | 26.8 | 12 (12) | 100.0% | 100.0% | - | - | 35 s | WWW | 80 s | 14 s |  |
| 15 | 1 | hard | early | e1-15 | kept | - | - | 18×20 | 288 | 7 | 26.8 | 9 (9) | 100.0% | 100.0% | - | - | 32 s | WWW | 72 s | 12 s |  |
| 16 | 1 | normal | saw0 | e1-16 | kept | - | - | 19×22 | 340 | 7 | 26.0 | 17 (17) | 71.8% | 100.0% | - | - | 45 s | WWW | 128 s | 15 s |  |
| 17 | 1 | normal | saw1 | e1-17 | kept | - | - | 20×22 | 360 | 8 | 26.0 | 18 (18) | 60.5% | 100.0% | - | - | 41 s | WWW | 104 s | 14 s |  |
| 18 | 1 | normal | saw1 | e1-18 | kept | - | - | 20×22 | 360 | 8 | 26.8 | 16 (16) | 52.3% | 100.0% | - | - | 39 s | WWW | 103 s | 14 s |  |
| 19 | 1 | hard | saw2 | e1-19 | tuned | - | - | 20×21 | 342 | 8 | 26.8 | 14 (14) | 46.8% | 100.0% | - | - | 43 s | WWW | 91 s | 13 s |  |
| 20 | 1 | easy | saw0 | e1-20 | tuned | - | - | 19×22 | 340 | 7 | 26.8 | 22 (22) | 75.5% | 100.0% | - | - | 36 s | WWW | 104 s | 13 s |  |
| 21 | 1 | normal | saw1 | e1-21 | kept | - | - | 19×22 | 340 | 8 | 26.1 | 12 (12) | 53.3% | 100.0% | - | - | 38 s | WWW | 81 s | 14 s |  |
| 22 | 1 | normal | saw0 | e1-22 | kept | - | - | 20×21 | 342 | 7 | 26.8 | 14 (14) | 75.5% | 100.0% | - | - | 36 s | WWW | 95 s | 13 s |  |
| 23 | 1 | normal | saw1 | e1-23 | kept | - | - | 20×22 | 360 | 8 | 26.0 | 15 (15) | 55.8% | 100.0% | - | - | 40 s | WWW | 98 s | 14 s |  |
| 24 | 1 | hard | saw2 | e1-24 | tuned | - | - | 19×22 | 340 | 9 | 26.0 | 21 (21) | 44.8% | 100.0% | - | - | 37 s | WWW | 122 s | 15 s |  |
| 25 | 2 | easy | saw0 | - | teaching | - | moat | 38×37 | 1116 | 6 | 26.0 | 27 (27) | 79.0% | 100.0% | - | - | 134 s | WWW | 314 s | 15 s | teaching: moat |
| 26 | 2 | normal | saw1 | - | new board | newBoard | moat | 42×41 | 1210 | 7 | 26.1 | 43 (43) | 55.3% | 97.0% | - | - | 214 s | WWW | 424 s | 15 s | new board |
| 27 | 2 | normal | saw1 | e2-27 | dealt | openGates | moat | 42×41 | 1210 | 8 | 26.1 | 44 (44) | 55.5% | 100.0% | - | - | 224 s | WWW | 461 s | 15 s |  |
| 28 | 2 | hard | saw2 | e2-28 | dealt | openGates | moat | 42×41 | 1400 | 8 | 26.8 | 45 (45) | 41.3% | 98.0% | - | - | 223 s | WWW | 555 s | 15 s |  |
| 29 | 2 | normal | saw1 | e2-29 | dealt | openGates | moat | 42×41 | 1400 | 7 | 26.0 | 38 (38) | 56.3% | 100.0% | - | - | 238 s | WWW | 420 s | 15 s |  |
| 30 | 2 | normal | saw1 | e2-30 | dealt | openGates | moat | 42×41 | 1400 | 7 | 26.8 | 38 (38) | 52.3% | 100.0% | - | - | 240 s | WWW | 434 s | 15 s |  |
| 31 | 2 | normal | saw0 | e2-31 | kept | openGates | moat | 42×41 | 1400 | 8 | 26.1 | 39 (39) | 77.3% | 100.0% | - | - | 196 s | WWW | 413 s | 15 s |  |
| 32 | 2 | hard | saw2 | e2-33 | dealt | openGates | moat | 42×41 | 1200 | 8 | 26.8 | 41 (41) | 38.5% | 78.0% | - | - | 191 s | WWW | 450 s | 15 s |  |
| 33 | 2 | easy | saw0 | e2-38 | dealt | openGates | moat | 42×41 | 1210 | 7 | 26.0 | 38 (38) | 70.0% | 96.0% | - | - | 212 s | WWW | 475 s | 15 s |  |
| 34 | 2 | normal | saw0 | e2-32 | dealt | openGates | moat | 42×41 | 1200 | 8 | 26.0 | 44 (44) | 65.8% | 96.0% | - | - | 237 s | WWW | 494 s | 15 s |  |
| 35 | 2 | normal | saw1 | e2-34 | dealt | openGates | moat | 42×41 | 1400 | 8 | 26.0 | 41 (41) | 55.0% | 100.0% | - | - | 213 s | WWW | 421 s | 15 s |  |
| 36 | 2 | normal | saw1 | e2-36 | dealt | openGates, dropMystery | moat | 42×41 | 1200 | 7 | 26.0 | 50 (50) | 57.0% | 99.0% | - | - | 199 s | WWW | 582 s | 15 s |  |
| 37 | 2 | hard | saw2 | e2-37 | tuned | openGates, dropMystery | moat | 42×41 | 1400 | 8 | 26.1 | 48 (48) | 43.3% | 100.0% | - | - | 222 s | WWW | 488 s | 15 s |  |
| 38 | 2 | normal | saw1 | e2-39 | tuned | openGates | moat | 42×41 | 1200 | 7 | 26.8 | 43 (43) | 49.0% | 60.0% | - | - | 184 s | WWW | 463 s | 15 s |  |
| 39 | 2 | normal | saw1 | e2-41 | dealt | openGates, dropMystery | moat | 42×41 | 1400 | 6 | 26.1 | 29 (29) | 59.0% | 100.0% | - | - | 228 s | WWW | 355 s | 15 s |  |
| 40 | 2 | normal | saw0 | e2-40 | kept | openGates | moat | 42×41 | 1400 | 8 | 26.0 | 44 (44) | 74.3% | 100.0% | - | - | 214 s | WWW | 470 s | 15 s |  |
| 41 | 2 | hard | saw2 | e2-42 | dealt | openGates | moat | 42×41 | 1400 | 7 | 26.8 | 49 (49) | 37.3% | 100.0% | - | - | 233 s | WWW | 556 s | 15 s |  |
| 42 | 2 | easy | saw0 | e2-47 | dealt | openGates, dropMystery | moat | 42×41 | 1400 | 10 | 26.0 | 48 (48) | 73.0% | 100.0% | - | - | 267 s | WWW | 543 s | 15 s |  |
| 43 | 2 | normal | saw0 | e2-43 | tuned | openGates, dropMystery | moat | 42×41 | 1200 | 7 | 26.8 | 45 (45) | 77.5% | 96.0% | - | - | 207 s | WWW | 469 s | 15 s |  |
| 44 | 2 | normal | saw1 | e2-44 | dealt | openGates | moat | 42×41 | 1200 | 6 | 26.1 | 41 (41) | 54.5% | 91.0% | - | - | 190 s | WWW | 400 s | 15 s |  |
| 45 | 2 | normal | saw1 | e2-45 | dealt | openGates, dropMystery | moat | 42×41 | 1400 | 7 | 26.1 | 44 (44) | 55.0% | 100.0% | - | - | 217 s | WWW | 469 s | 15 s |  |
| 46 | 2 | hard | hardest | e2-46 | tuned | openGates | moat | 42×41 | 1400 | 10 | 26.0 | 48 (48) | 3.3% | 10.0% | 2.0% | - | 210 s | WWW | 533 s | 15 s |  |
| 47 | 2 | normal | hard | e2-49 | dealt | openGates | moat | 42×41 | 1400 | 10 | 26.0 | 52 (52) | 5.3% | 20.0% | 6.0% | - | 244 s | WWW | 560 s | 15 s |  |
| 48 | 2 | normal | hard | e2-48 | dealt | openGates | moat | 42×41 | 1400 | 9 | 26.0 | 48 (48) | 0.0% | 19.0% | 0.7% | - | 226 s | WWW | 498 s | 15 s |  |
| 49 | 2 | hard | hardest | e2-50 | dealt | openGates | moat | 42×41 | 1210 | 8 | 26.0 | 45 (45) | 2.3% | 11.0% | 1.0% | - | 213 s | WWW | 455 s | 15 s |  |
| 50 | 3 | easy | relief | - | teaching | - | moat, gates 1 | 38×37 | 1128 | 9 | 26.0 | 38 (38) | 49.0% | 100.0% | 42.0% | - | 172 s | WWW | 433 s | 15 s | teaching: gate |
| 51 | 3 | normal | hard | e3-53 | kept | dropTowers, dropMystery | moat, gates 1 | 42×41 | 1412 | 12 | 26.0 | 55 (55) | 0.5% | 24.0% | 0.0% | - | 221 s | WWW | 613 s | 15 s |  |
| 52 | 3 | normal | hard | e3-52 | tuned | dropTowers, dropMystery | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 55 (55) | 3.5% | 17.0% | 2.7% | - | 233 s | WWW | 622 s | 15 s |  |
| 53 | 3 | hard | hardest | e3-55 | tuned | dropTowers, dropMystery, colourLock | moat, gates 1, colour lock 8 | 42×41 | 1412 | 10 | 26.0 | 54 (54) | 1.0% | 7.0% | 2.0% | - | 236 s | WWW | 501 s | 15 s |  |
| 54 | 3 | normal | hard | e3-54 | tuned | dropTowers | moat, gates 1 | 42×41 | 1412 | 11 | 25.7 | 55 (55) | 2.8% | 14.0% | 4.7% | - | 217 s | WWW | 539 s | 15 s |  |
| 55 | 3 | normal | hard | e3-56 | dealt | dropTowers, dropMystery | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 51 (51) | 3.0% | 9.0% | 1.0% | - | 221 s | WWW | 572 s | 15 s |  |
| 56 | 3 | normal | hard | e3-57 | kept | dropTowers | moat, gates 1 | 42×41 | 1412 | 12 | 26.0 | 55 (55) | 5.0% | 20.0% | 4.3% | - | 209 s | WWW | 572 s | 15 s |  |
| 57 | 3 | hard | hardest | e3-60 | dealt | dropTowers, colourLock | moat, gates 1, colour lock 2 | 42×41 | 1412 | 9 | 25.7 | 37 (37) | 0.0% | 4.0% | 0.0% | - | 220 s | WWW | 433 s | 15 s |  |
| 58 | 3 | easy | relief | - | new board | dropTowers | moat | 42×41 | 1400 | 8 | 26.0 | 44 (44) | 41.0% | 100.0% | 45.3% | - | 211 s | WWW | 457 s | 15 s | new board |
| 59 | 3 | normal | hard | e3-59 | tuned | dropTowers | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 54 (54) | 0.0% | 12.0% | 0.0% | - | 229 s | WWW | 573 s | 15 s |  |
| 60 | 3 | normal | hard | e3-58 | dealt | dropTowers, dropMystery | moat, gates 1 | 42×41 | 1412 | 11 | 25.7 | 55 (55) | 2.5% | 6.0% | 2.7% | - | 224 s | WWW | 534 s | 15 s |  |
| 61 | 3 | normal | hard | e3-61 | kept | dropTowers, dropMystery | moat, gates 1 | 42×41 | 1412 | 11 | 25.7 | 55 (55) | 5.5% | 17.0% | 6.0% | - | 230 s | WWW | 604 s | 15 s |  |
| 62 | 3 | hard | hardest | e3-64 | tuned | dropTowers, colourLock | moat, gates 1, colour lock 8 | 42×41 | 1412 | 11 | 26.0 | 55 (55) | 0.3% | 10.0% | 1.0% | - | 237 s | WWW | 576 s | 15 s |  |
| 63 | 3 | normal | hard | e3-63 | dealt | dropTowers, dropMystery | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 51 (51) | 2.0% | 4.0% | 3.0% | - | 222 s | WWW | 584 s | 15 s |  |
| 64 | 3 | normal | hard | e3-66 | tuned | dropTowers, dropLinks | moat, gates 1 | 42×41 | 1412 | 11 | 25.7 | 54 (54) | 2.0% | 15.0% | 3.0% | - | 210 s | WWW | 568 s | 15 s |  |
| 65 | 3 | normal | hard | e3-67 | kept | dropTowers, dropMystery, dropLinks | moat, gates 1 | 42×41 | 1412 | 12 | 26.0 | 54 (54) | 0.8% | 22.0% | 1.3% | - | 229 s | WWW | 583 s | 15 s |  |
| 66 | 3 | hard | hardest | e3-69 | dealt | dropTowers, dropMystery, colourLock | moat, gates 1, colour lock 12 | 42×41 | 1412 | 12 | 26.0 | 46 (46) | 0.0% | 2.0% | 0.3% | - | 224 s | WWW | 489 s | 15 s |  |
| 67 | 3 | easy | relief | e3-65 | kept | dropTowers, dropMystery, openGates | moat | 42×41 | 1400 | 8 | 26.0 | 53 (53) | 54.8% | 100.0% | 62.3% | - | 224 s | WWW | 636 s | 15 s |  |
| 68 | 3 | normal | hard | e3-68 | tuned | dropTowers, dropMystery | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 54 (54) | 3.5% | 12.0% | 1.3% | - | 221 s | WWW | 679 s | 15 s |  |
| 69 | 3 | normal | hard | e3-71 | kept | dropTowers, dropLinks | moat, gates 1 | 42×41 | 1412 | 12 | 26.0 | 51 (51) | 1.3% | 13.0% | 1.3% | - | 214 s | WWW | 521 s | 15 s |  |
| 70 | 3 | normal | hard | e3-70 | dealt | dropTowers, dropLinks | moat, gates 1 | 42×41 | 1412 | 9 | 25.7 | 51 (51) | 5.5% | 8.0% | 4.7% | - | 243 s | WWW | 592 s | 15 s |  |
| 71 | 3 | hard | hardest | e3-73 | dealt | dropTowers, dropMystery, colourLock | moat, gates 1, colour lock 3 | 42×41 | 1412 | 12 | 26.0 | 53 (53) | 2.8% | 15.0% | 1.0% | - | 223 s | WWW | 552 s | 15 s |  |
| 72 | 3 | normal | hard | e3-72 | kept | dropTowers | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 51 (51) | 4.5% | 17.0% | 6.0% | - | 224 s | WWW | 565 s | 15 s |  |
| 73 | 3 | normal | hard | e3-74 | tuned | dropTowers | moat, gates 1 | 42×41 | 1412 | 11 | 26.0 | 52 (52) | 1.3% | 25.0% | 1.3% | - | 237 s | WWW | 546 s | 15 s |  |
| 74 | 3 | hard | hardest | e3-75 | tuned | dropTowers, dropLinks, colourLock | moat, gates 1, colour lock 9 | 42×41 | 1412 | 10 | 26.0 | 48 (48) | 0.0% | 22.0% | 0.0% | - | 196 s | WWW | 483 s | 15 s |  |
| 75 | 4 | easy | relief | - | teaching | - | moat, gates 2, linked 1 | 34×33 | 844 | 10 | 26.0 | 28 (29) | 41.3% | 56.0% | 18.3% | - | 131 s | WWW | 252 s | 15 s | teaching: linked |
| 76 | 4 | normal | hard | e4-79 | tuned | dropTowers | moat, gates 2, linked 1 | 42×41 | 1300 | 11 | 26.0 | 54 (55) | 2.5% | 25.0% | 3.7% | - | 189 s | WWW | 588 s | 15 s |  |
| 77 | 4 | normal | hard | e4-83 | dealt | dropTowers, dropMystery | moat, gates 2 | 42×41 | 1372 | 12 | 26.0 | 50 (50) | 0.8% | 5.0% | 1.3% | - | 238 s | WWW | 594 s | 15 s |  |
| 78 | 4 | hard | hardest | e4-78 | dealt | dropTowers, colourLock | moat, gates 2, linked 2, colour lock 8 | 42×41 | 1372 | 11 | 26.0 | 42 (44) | 0.3% | 6.0% | 0.3% | - | 222 s | WWW | 423 s | 15 s |  |
| 79 | 4 | normal | hard | e4-99 | tuned | dropTowers, dropMystery | moat, gates 2, linked 2 | 42×41 | 1372 | 10 | 26.0 | 51 (53) | 6.5% | 4.0% | 1.0% | - | 193 s | WWW | 541 s | 15 s |  |
| 80 | 4 | normal | hard | e4-80 | dealt | dropTowers, dropMystery | moat, gates 2 | 42×41 | 1372 | 9 | 26.0 | 48 (48) | 0.5% | 4.0% | 0.7% | - | 225 s | WWW | 562 s | 15 s |  |
| 81 | 4 | normal | hard | e4-81 | tuned | dropTowers, dropMystery, dropLock | moat, gates 2 | 42×41 | 1372 | 11 | 26.0 | 55 (55) | 2.3% | 4.0% | 3.0% | - | 236 s | WWW | 571 s | 15 s |  |
| 82 | 4 | hard | hardest | e4-82 | dealt | dropTowers, colourLock | moat, gates 2, linked 2, colour lock 9 | 42×41 | 1372 | 11 | 26.0 | 42 (44) | 1.3% | 13.0% | 1.0% | - | 227 s | WWW | 479 s | 15 s |  |
| 83 | 4 | easy | relief | - | new board | dropTowers, openGates, dropLock | moat | 42×41 | 1344 | 9 | 26.0 | 47 (47) | 47.5% | 100.0% | 40.7% | - | 204 s | WWW | 558 s | 15 s | new board |
| 84 | 4 | normal | hard | e4-84 | tuned | dropTowers, dropMystery, dropLock | moat, gates 2 | 42×41 | 1372 | 11 | 26.0 | 54 (54) | 0.3% | 16.0% | 0.0% | - | 214 s | WWW | 576 s | 15 s |  |
| 85 | 4 | normal | hard | e4-85 | dealt | dropTowers, dropMystery | moat, gates 2, linked 2 | 42×41 | 1372 | 10 | 26.0 | 52 (54) | 1.5% | 16.0% | 0.0% | - | 223 s | WWW | 520 s | 15 s |  |
| 86 | 4 | normal | hard | e4-86 | dealt | dropTowers, dropMystery, dropLock | moat, gates 2 | 42×41 | 1372 | 11 | 25.7 | 47 (47) | 4.3% | 6.0% | 2.3% | - | 237 s | WWW | 477 s | 15 s |  |
| 87 | 4 | hard | hardest | e4-87 | dealt | dropTowers, dropMystery | moat, gates 2, linked 2, key lock | 42×41 | 1372 | 11 | 26.0 | 43 (45) | 0.0% | 6.0% | 0.0% | - | 286 s | WWW | 488 s | 15 s |  |
| 88 | 4 | normal | hard | e4-88 | tuned | dropTowers, dropMystery | moat, gates 2 | 42×41 | 1372 | 11 | 26.0 | 55 (55) | 1.5% | 14.0% | 1.3% | - | 186 s | WWW | 579 s | 15 s |  |
| 89 | 4 | normal | hard | e4-93 | tuned | dropTowers, dropMystery | moat, gates 2 | 42×41 | 1372 | 11 | 26.0 | 55 (55) | 9.5% | 12.0% | 14.0% | - | 215 s | WWW | 528 s | 15 s |  |
| 90 | 4 | normal | hard | e4-90 | tuned | dropTowers, dropLock | moat, gates 2 | 42×41 | 1372 | 9 | 26.0 | 52 (52) | 8.0% | 9.0% | 11.7% | - | 205 s | WWW | 537 s | 15 s |  |
| 91 | 4 | hard | hardest | e4-91 | dealt | dropTowers, colourLock | moat, gates 2, linked 2, colour lock 2 | 42×41 | 1372 | 11 | 26.0 | 49 (51) | 2.0% | 0.0% | 0.7% | - | 226 s | WWW | 542 s | 15 s |  |
| 92 | 4 | easy | relief | e4-92 | kept | dropTowers, dropMystery, openGates, dropLock | moat | 42×41 | 1344 | 10 | 26.0 | 51 (51) | 57.5% | 82.0% | 29.7% | - | 204 s | WWW | 501 s | 15 s |  |
| 93 | 4 | normal | hard | e4-95 | dealt | dropTowers | moat, gates 2, linked 2 | 42×41 | 1372 | 9 | 26.0 | 43 (45) | 4.5% | 0.0% | 3.3% | - | 219 s | WWW | 496 s | 15 s |  |
| 94 | 4 | normal | hard | e4-94 | tuned | dropTowers, dropMystery | moat, gates 2 | 42×41 | 1300 | 11 | 26.0 | 55 (55) | 3.3% | 10.0% | 5.0% | - | 212 s | WWW | 615 s | 15 s |  |
| 95 | 4 | normal | hard | e4-96 | dealt | dropTowers, dropMystery, dropLock | moat, gates 2 | 42×41 | 1372 | 11 | 26.0 | 48 (48) | 2.5% | 23.0% | 3.0% | - | 233 s | WWW | 529 s | 15 s |  |
| 96 | 4 | hard | hardest | e4-89 | dealt | dropTowers | moat, gates 2, linked 1, key lock | 42×41 | 1372 | 11 | 26.0 | 41 (42) | 0.0% | 4.0% | 0.7% | - | 223 s | WWW | 464 s | 15 s |  |
| 97 | 4 | normal | hard | e4-97 | dealt | dropTowers, dropMystery | moat, gates 2 | 42×41 | 1300 | 11 | 25.7 | 48 (48) | 8.8% | 2.0% | 7.0% | - | 248 s | WWW | 503 s | 15 s |  |
| 98 | 4 | normal | hard | e4-98 | dealt | dropTowers, dropLock | moat, gates 2 | 42×41 | 1372 | 12 | 26.0 | 54 (54) | 3.3% | 7.0% | 3.3% | - | 219 s | WWW | 573 s | 15 s |  |
| 99 | 4 | hard | boss | e4-100 | tuned | dropTowers, dropMystery | moat, gates 2, linked 3, key lock | 42×41 | 1372 | 12 | 26.0 | 52 (55) | 4.0% | 0.0% | 0.7% | - | 234 s | WWW | 518 s | 15 s |  |
| 100 | 5 | easy | relief | - | teaching | - | moat, gates 1, ? 3 | 38×37 | 1128 | 7 | 26.4 | 26 (26) | 61.0% | 98.0% | 56.0% | 100.0% / 100.0% | 121 s | WWW | 295 s | 15 s | teaching: mystery |

### Bake log

```
bake v12: 100 levels, 93 generated on 16 threads, re-laid from v4.3 (0a08325; 92 kept decks)
level 26 candidate 0: no fort with 5-5 colours in 120 seeds
level 26 candidate 1: no fort with 5-5 colours in 120 seeds
level 26 candidate 2: no fort with 5-5 colours in 120 seeds
level 26 candidate 3: no fort with 5-5 colours in 120 seeds
level 26 candidate 4: no fort with 5-5 colours in 120 seeds
level 26 candidate 5: no fort with 5-5 colours in 120 seeds
level 26 candidate 6: no fort with 5-5 colours in 120 seeds
level 26 candidate 7: no fort with 5-5 colours in 120 seeds
level 26: NO LEVEL (no winnable candidate)
level 55 candidate 17: no deal in 48 attempts
level 58 candidate 8: no deal in 48 attempts
level 58 candidate 9: no deal in 48 attempts
level 58 candidate 15: no deal in 48 attempts
level 58: its kept board would not deal; a new board at the same size
level 78 candidate 25: a linked partner more than a row from its card
level 79: variety, the least alike candidate meeting every target is 41.4% alike its era's earlier picks (median; target 40.0%)
level 82 candidate 7: a linked partner more than a row from its card
level 82 candidate 8: no deal in 48 attempts
level 82 candidate 15: no deal in 48 attempts
level 82 candidate 21: a linked partner more than a row from its card
level 82 candidate 24: no deal in 48 attempts
level 83: its kept board would not deal; a new board at the same size
level 87 candidate 7: a linked partner more than a row from its card
level 87: variety, the least alike candidate meeting every target is 40.7% alike its era's earlier picks (median; target 40.0%)
level 91 candidate 0: a linked partner more than a row from its card
level 91 candidate 1: no deal in 48 attempts
bake: 99 levels picked in 950.4 s; forts 976, deals 3460, tune evaluations 123470, full grades 831 (each on its level's tag)
bake: 99 levels in 963.6 s (candidates 950 s, second pass 13 s)
bake: 131 graded candidate decks per second across 16 threads
bake: lookahead player on hard (on each level's tag): median 12.0%, max 25.0% over 34 levels
bake: lookahead player on hardest (on each level's tag): median 7.0%, max 22.0% over 13 levels
bake: lookahead player on boss (on each level's tag): median 0.0%, max 0.0% over 1 levels
bake: patient play-through on the stored line at 1x (generated levels): median 494 s, max 679 s; early 66 s-86 s; all levels median 488 s, 47 s-679 s
bake: longest single tap on the stored line: median 15 s, max 15 s (cap 15 s)
bake: real pace (stored order on the level's tag, a tap the moment a space is free, x 1.77) on generated levels 26+: median 222 s, 184 s-286 s; boss 234 s; replays that lost 0; by tag easy 211 s (6), normal 221 s (47), hard 223 s (18), extreme -
bake: variety, era 1: median match 19.3% over 21 generated pictures (gate 40.0%), most alike 7 and 17 at 72.9%
bake: variety, era 2: median match 22.1% over 23 generated pictures (gate 40.0%), most alike 38 and 43 at 66.4%
bake: variety, era 3: median match 22.1% over 24 generated pictures (gate 40.0%), most alike 61 and 64 at 81.4%
bake: variety, era 4: median match 33.6% over 24 generated pictures (gate 40.0%), most alike 76 and 94 at 74.3%
bake: tags easy 15, normal 61, hard 23, extreme 0; taps per level: max 55 (cap 55), median 45; cards max 55
bake: the re-lay's decks: kept 28, tuned 25, dealt 37, new board 2 (generated slots)
bake v12: 100 levels, 1 generated on 16 threads (only 26-26), re-laid from v4.3 (0a08325; 0 kept decks)
bake: 99 levels outside 26-26 kept as they are from /private/tmp/claude-501/-Users-peter-Documents-Claude/f9b0d4b9-5a68-4cf6-ae7f-6e63467954c6/scratchpad/bake1/levels.json
level 26: the re-lay has no board for this slot; a new board
bake: 100 levels picked in 8.0 s; forts 8, deals 44, tune evaluations 263, full grades 8 (each on its level's tag)
bake: 100 levels in 8.1 s (candidates 8 s, second pass 0 s)
bake: 34 graded candidate decks per second across 16 threads
bake: lookahead player on hard (on each level's tag): median 12.0%, max 25.0% over 34 levels
bake: lookahead player on hardest (on each level's tag): median 7.0%, max 22.0% over 13 levels
bake: lookahead player on boss (on each level's tag): median 0.0%, max 0.0% over 1 levels
bake: patient play-through on the stored line at 1x (generated levels): median 494 s, max 679 s; early 66 s-86 s; all levels median 483 s, 47 s-679 s
bake: longest single tap on the stored line: median 15 s, max 15 s (cap 15 s)
bake: real pace (stored order on the level's tag, a tap the moment a space is free, x 1.77) on generated levels 26+: median 222 s, 184 s-286 s; boss 234 s; replays that lost 0; by tag easy 211 s (6), normal 221 s (48), hard 223 s (18), extreme -
bake: variety, era 1: median match 19.3% over 21 generated pictures (gate 40.0%), most alike 7 and 17 at 72.9%
bake: variety, era 2: median match 21.4% over 24 generated pictures (gate 40.0%), most alike 38 and 43 at 66.4%
bake: variety, era 3: median match 22.1% over 24 generated pictures (gate 40.0%), most alike 61 and 64 at 81.4%
bake: variety, era 4: median match 33.6% over 24 generated pictures (gate 40.0%), most alike 76 and 94 at 74.3%
bake: tags easy 15, normal 62, hard 23, extreme 0; taps per level: max 55 (cap 55), median 45; cards max 55
bake: the re-lay's decks: kept 0, tuned 0, dealt 0, new board 1 (generated slots)
bake: merged fix-up level(s) 26 into /private/tmp/claude-501/-Users-peter-Documents-Claude/f9b0d4b9-5a68-4cf6-ae7f-6e63467954c6/scratchpad/bake1/levels.json; fallbacks now 0
```
<!-- bake:end -->

## The Gallery (side quests)

<!-- gallery:start -->
### Bands (each picture's random-tap rate on its own tag)

| Slot | Band | Levels | Tags E/N/H | In band | Rate min | median | max | Fast tapper median | Lookahead median |
|---|---|---|---|---|---|---|---|---|---|
| intro | 62.0%-90.0% | 4 | 2/2/0/0 | 4/4 | 68.5% | 71.0% | 86.8% | 66.7% | 100.0% |
| saw0 | 62.0%-80.0% | 12 | 0/12/0/0 | 12/12 | 65.3% | 71.8% | 78.8% | 70.3% | 100.0% |
| saw1 | 46.0%-64.0% | 12 | 0/12/0/0 | 12/12 | 49.0% | 56.0% | 60.5% | 57.3% | 100.0% |
| saw2 | 30.0%-48.0% | 12 | 0/12/0/0 | 12/12 | 31.8% | 38.5% | 46.5% | 40.3% | 100.0% |
| hard | 10.0%-30.0% | 14 | 0/0/14/0 | 14/14 | 13.0% | 20.5% | 29.3% | 20.0% | 68.0% |
| relief | 62.0%-85.0% | 6 | 6/0/0/0 | 6/6 | 64.8% | 69.0% | 71.3% | 68.3% | 100.0% |

### Every level

Every measure is on the picture's own tag (v4.3). Rate = the random-tap rate (400 games); lookahead = the one-move-lookahead player (100); fast = the fast tapper (300); real pace = the stored order replayed tapping the moment a space is free, times 1.77 (* the replay lost, patient time shown); thinking = the same replay waiting 1 / 2 / 4 s after each tap, won (W) or lost (L); patient and longest wait = patient play on the stored line at 1x; ΔE = the smallest CIEDE2000 between two of its colours; breach = black squads, the tap that sends the first, where the first black card starts (column, row).

| # | Id | Title | Kind | Tag | Slot | Deck | Board | Colours | Min ΔE00 | Taps (cards) | Rate | Lookahead | Fast | Real pace | Thinking | Patient | Longest wait | Breach | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tw-1f355 | Pizza Slice | emoji | easy | intro | kept | 36×41 | 4 | 35.6 | 44 (44) | 71.0% | 100.0% | 64.7% | 246 s | WWW | 477 s | 15 s | 14, tap 2, 1/0 |  |
| 2 | ours-g01 | Goblin's Lunch | ours | easy | intro | tuned | 33×41 | 6 | 32.8 | 44 (44) | 68.5% | 100.0% | 66.7% | 200 s | WWW | 433 s | 15 s | 7, tap 2, 1/0 |  |
| 3 | noto-1f431 | Cat | emoji | normal | intro | kept | 41×38 | 4 | 32.7 | 50 (50) | 86.8% | 100.0% | 83.0% | 205 s | WWW | 451 s | 15 s | 12, tap 3, 2/0 |  |
| 4 | tw-1f98a | Fox | emoji | normal | intro | kept | 41×37 | 4 | 31.7 | 46 (46) | 78.5% | 100.0% | 74.0% | 221 s | WWW | 431 s | 14 s | 11, tap 2, 1/0 |  |
| 5 | met-57007 | Red Fuji | painting | hard | hard | tuned | 42×29 | 6 | 23.5 | 40 (40) | 28.2% | 100.0% | 32.3% | 162 s | WWW | 395 s | 15 s | - |  |
| 6 | ours-g02 | Sir Whiskers | ours | normal | saw1 | kept | 31×41 | 5 | 26.5 | 45 (45) | 60.5% | 100.0% | 57.7% | 203 s | WWW | 457 s | 15 s | 14, tap 2, 1/1 |  |
| 7 | noto-1f352 | Cherries | emoji | normal | saw2 | kept | 34×41 | 4 | 40.7 | 41 (41) | 38.5% | 55.0% | 42.7% | 180 s | WWW | 381 s | 15 s | 6, tap 6, 4/1 |  |
| 8 | tw-1f43c | Panda | emoji | normal | saw1 | kept | 39×41 | 5 | 30.9 | 46 (46) | 57.0% | 100.0% | 62.7% | 211 s | WWW | 438 s | 15 s | 13, tap 2, 0/0 |  |
| 9 | ours-g09 | Night Watch | ours | hard | hard | tuned | 36×41 | 5 | 25.6 | 48 (48) | 20.8% | 100.0% | 23.7% | 200 s | WWW | 413 s | 15 s | 9, tap 3, 2/2 |  |
| 10 | noto-1f344 | Mushroom | emoji | easy | relief | tuned | 40×41 | 5 | 26.3 | 48 (48) | 70.5% | 100.0% | 73.7% | 208 s | WWW | 476 s | 15 s | 12, tap 3, 0/1 |  |
| 11 | tw-1f349 | Watermelon | emoji | normal | saw0 | kept | 41×31 | 5 | 34.2 | 37 (37) | 75.3% | 100.0% | 71.7% | 189 s | WWW | 346 s | 14 s | 7, tap 3, 2/0 |  |
| 12 | met-45434 | The Great Wave | painting | normal | saw1 | kept | 42×29 | 3 | 32.3 | 40 (40) | 55.8% | 100.0% | 41.3% | 190 s | WWW | 327 s | 15 s | - |  |
| 13 | ours-g04 | Frog Prince | ours | normal | saw2 | kept | 36×41 | 6 | 27.1 | 45 (45) | 31.8% | 100.0% | 34.0% | 206 s | WWW | 393 s | 15 s | 10, tap 3, 2/0 |  |
| 14 | noto-1f354 | Burger | emoji | hard | hard | tuned | 39×41 | 5 | 26.6 | 49 (49) | 26.3% | 91.0% | 29.3% | 173 s | WWW | 472 s | 15 s | 10, tap 3, 2/0 |  |
| 15 | tw-1f427 | Penguin | emoji | normal | saw2 | kept | 38×41 | 4 | 32.2 | 44 (44) | 34.3% | 100.0% | 35.0% | 206 s | WWW | 398 s | 15 s | 13, tap 2, 4/0 |  |
| 16 | ours-g12 | Duck Knight | ours | normal | saw0 | kept | 41×39 | 5 | 26 | 50 (50) | 72.3% | 100.0% | 69.3% | 195 s | WWW | 426 s | 14 s | 11, tap 7, 1/1 |  |
| 17 | noto-1f436 | Dog | emoji | normal | saw0 | kept | 41×37 | 4 | 32.3 | 46 (46) | 78.8% | 100.0% | 82.0% | 226 s | WWW | 462 s | 15 s | 12, tap 4, 3/0 |  |
| 18 | tw-1f353 | Strawberry | emoji | hard | hard | tuned | 36×41 | 5 | 35.6 | 42 (42) | 14.0% | 61.0% | 15.3% | 165 s | WWW | 388 s | 15 s | 7, tap 2, 3/0 |  |
| 19 | met-436535 | Wheat Field with Cypresses | painting | easy | relief | tuned | 42×33 | 5 | 23 | 49 (49) | 70.8% | 89.0% | 72.3% | 239 s | WWW | 485 s | 15 s | - |  |
| 20 | ours-g10 | Crown Too Big | ours | normal | saw1 | kept | 34×41 | 7 | 26.2 | 48 (48) | 53.5% | 100.0% | 51.7% | 195 s | WWW | 451 s | 15 s | 7, tap 3, 2/0 |  |
| 21 | noto-1f32e | Taco | emoji | normal | saw2 | kept | 41×35 | 5 | 35 | 48 (48) | 40.3% | 100.0% | 41.0% | 222 s | WWW | 453 s | 15 s | 11, tap 3, 2/1 |  |
| 22 | tw-1f419 | Octopus | emoji | normal | saw0 | kept | 41×41 | 3 | 32.2 | 52 (52) | 75.3% | 100.0% | 71.7% | 243 s | WWW | 548 s | 15 s | 20, tap 3, 4/0 |  |
| 23 | ours-g07 | Cake Castle | ours | hard | hard | tuned | 38×41 | 5 | 31.5 | 43 (43) | 20.5% | 100.0% | 17.7% | 186 s | WWW | 386 s | 15 s | 10, tap 2, 3/1 |  |
| 24 | noto-1f981 | Lion | emoji | normal | saw1 | kept | 38×41 | 4 | 32.5 | 45 (45) | 56.0% | 100.0% | 58.7% | 189 s | WWW | 432 s | 15 s | 12, tap 5, 0/0 |  |
| 25 | tw-1f369 | Doughnut | emoji | normal | saw2 | kept | 41×34 | 6 | 29.9 | 44 (44) | 38.5% | 100.0% | 39.0% | 195 s | WWW | 421 s | 15 s | 10, tap 2, 1/0 |  |
| 26 | met-436528 | Irises | painting | normal | saw1 | kept | 42×34 | 5 | 20.4 | 43 (43) | 53.8% | 99.0% | 57.3% | 159 s | WWW | 379 s | 15 s | - |  |
| 27 | ours-g13 | Mimic | ours | hard | hard | kept | 41×39 | 4 | 25.5 | 43 (43) | 24.0% | 63.0% | 29.3% | 178 s | WWW | 397 s | 15 s | 17, tap 2, 1/0 |  |
| 28 | noto-1f41d | Honeybee | emoji | easy | relief | kept | 41×39 | 4 | 41.8 | 41 (41) | 66.8% | 100.0% | 73.0% | 237 s | WWW | 425 s | 15 s | 12, tap 3, 2/0 |  |
| 29 | tw-1f980 | Crab | emoji | normal | saw0 | kept | 41×41 | 3 | 35.6 | 44 (44) | 68.0% | 100.0% | 68.0% | 190 s | WWW | 429 s | 15 s | 13, tap 3, 2/0 |  |
| 30 | ours-g11 | Melon Catapult | ours | normal | saw1 | kept | 41×35 | 6 | 27.9 | 40 (40) | 60.3% | 100.0% | 61.3% | 194 s | WWW | 333 s | 15 s | 6, tap 4, 4/0 |  |
| 31 | noto-1f9c1 | Cupcake | emoji | normal | saw2 | kept | 34×41 | 6 | 28.9 | 50 (50) | 41.0% | 100.0% | 47.7% | 222 s | WWW | 475 s | 15 s | 13, tap 2, 1/0 |  |
| 32 | tw-1f984 | Unicorn | emoji | hard | hard | dealt | 41×41 | 5 | 26.8 | 55 (55) | 22.5% | 89.0% | 27.3% | 195 s | WWW | 502 s | 15 s | 14, tap 8, 1/1 |  |
| 33 | noto-1f3c6 | Trophy | emoji | normal | saw2 | kept | 41×40 | 5 | 30.9 | 52 (52) | 36.5% | 100.0% | 44.0% | 201 s | WWW | 479 s | 15 s | 12, tap 2, 2/0 |  |
| 34 | ours-g15 | Happy Potion | ours | normal | saw0 | tuned | 29×41 | 4 | 29.7 | 34 (34) | 68.5% | 100.0% | 56.0% | 203 s | WWW | 344 s | 15 s | 8, tap 2, 3/0 |  |
| 35 | noto-1f989 | Owl | emoji | normal | saw0 | kept | 32×41 | 5 | 28 | 41 (41) | 69.8% | 100.0% | 74.0% | 200 s | WWW | 411 s | 15 s | 11, tap 3, 2/0 |  |
| 36 | tw-1f951 | Avocado | emoji | hard | hard | dealt | 41×40 | 5 | 26.9 | 55 (55) | 16.3% | 55.0% | 16.3% | 242 s | WWW | 541 s | 15 s | 10, tap 2, 1/0 |  |
| 37 | ours-g08 | Iron Pig | ours | easy | relief | kept | 34×41 | 4 | 28.3 | 44 (44) | 71.3% | 100.0% | 68.3% | 205 s | WWW | 419 s | 15 s | 12, tap 5, 0/0 |  |
| 38 | noto-1f437 | Pig | emoji | normal | saw1 | tuned | 41×37 | 4 | 26 | 50 (50) | 58.8% | 100.0% | 68.0% | 223 s | WWW | 497 s | 15 s | 14, tap 3, 4/0 |  |
| 39 | tw-1f3f0 | Castle | emoji | normal | saw2 | kept | 41×37 | 4 | 31.1 | 47 (47) | 46.5% | 100.0% | 35.3% | 217 s | WWW | 425 s | 15 s | 11, tap 2, 1/0 |  |
| 40 | met-436534 | Roses | painting | normal | saw0 | kept | 36×41 | 5 | 21.5 | 51 (51) | 65.3% | 100.0% | 52.7% | 201 s | WWW | 480 s | 15 s | - |  |
| 41 | ours-g16 | Mushroom House | ours | hard | hard | kept | 33×41 | 7 | 25.4 | 44 (44) | 29.3% | 51.0% | 34.7% | 175 s | WWW | 379 s | 14 s | 10, tap 4, 3/0 |  |
| 42 | noto-1f432 | Dragon | emoji | normal | saw1 | kept | 39×41 | 6 | 30.2 | 51 (51) | 56.8% | 100.0% | 51.3% | 199 s | WWW | 523 s | 15 s | 13, tap 3, 2/0 |  |
| 43 | tw-1f438 | Frog | emoji | normal | saw2 | kept | 41×37 | 4 | 33.4 | 50 (50) | 38.0% | 100.0% | 45.3% | 197 s | WWW | 486 s | 15 s | 16, tap 5, 0/0 |  |
| 44 | ours-g18 | The Sapper | ours | normal | saw1 | kept | 41×37 | 6 | 29.6 | 47 (47) | 51.2% | 100.0% | 50.0% | 195 s | WWW | 401 s | 15 s | 13, tap 4, 1/0 |  |
| 45 | noto-1f36d | Lollipop | emoji | hard | hard | dealt | 40×41 | 6 | 25 | 55 (55) | 14.0% | 58.0% | 11.7% | 298 s | WWW | 522 s | 15 s | 9, tap 6, 3/0 |  |
| 46 | tw-1f451 | Crown | emoji | easy | relief | tuned | 41×38 | 6 | 34.8 | 55 (55) | 64.8% | 100.0% | 63.0% | 247 s | WWW | 489 s | 15 s | 16, tap 5, 3/0 |  |
| 47 | met-436530 | Oleanders | painting | normal | saw0 | kept | 42×35 | 5 | 22.4 | 44 (44) | 72.5% | 100.0% | 67.3% | 179 s | WWW | 447 s | 15 s | - |  |
| 48 | ours-g19 | Hatchling | ours | normal | saw1 | kept | 35×41 | 7 | 25.9 | 50 (50) | 59.0% | 100.0% | 58.7% | 178 s | WWW | 476 s | 15 s | 15, tap 2, 1/0 |  |
| 49 | noto-1f47d | Alien | emoji | normal | saw2 | kept | 39×41 | 3 | 34.5 | 55 (55) | 44.3% | 100.0% | 49.0% | 206 s | WWW | 445 s | 15 s | 14, tap 4, 3/0 |  |
| 50 | tw-1f680 | Rocket | emoji | hard | hard | dealt | 41×41 | 5 | 31.6 | 55 (55) | 22.8% | 100.0% | 25.3% | 200 s | WWW | 542 s | 15 s | 9, tap 3, 4/0 |  |
| 51 | ours-g22 | Plumed Helm | ours | normal | saw2 | kept | 30×41 | 4 | 29.2 | 39 (39) | 45.0% | 88.0% | 40.3% | 191 s | WWW | 329 s | 14 s | 10, tap 3, 2/1 |  |
| 52 | noto-1f308 | Rainbow | emoji | normal | saw0 | kept | 37×41 | 6 | 31.4 | 45 (45) | 69.3% | 100.0% | 70.7% | 190 s | WWW | 490 s | 15 s | 8, tap 3, 2/1 |  |
| 53 | tw-1f383 | Jack-o'-Lantern | emoji | normal | saw0 | kept | 41×41 | 5 | 31.7 | 54 (54) | 76.5% | 100.0% | 84.3% | 207 s | WWW | 498 s | 15 s | 12, tap 5, 4/0 |  |
| 54 | met-435882 | Apples and Primroses | painting | hard | hard | tuned | 42×34 | 6 | 21.3 | 41 (41) | 19.8% | 68.0% | 12.0% | 171 s | WWW | 407 s | 15 s | - |  |
| 55 | ours-g23 | Sheep Knight | ours | easy | relief | kept | 33×41 | 5 | 25.9 | 40 (40) | 69.0% | 100.0% | 64.3% | 195 s | WWW | 394 s | 14 s | 12, tap 2, 0/0 |  |
| 56 | noto-1f33b | Sunflower | emoji | normal | saw1 | kept | 33×41 | 5 | 32.9 | 45 (45) | 49.0% | 59.0% | 52.7% | 197 s | WWW | 459 s | 15 s | 15, tap 3, 2/0 |  |
| 57 | ours-g20 | Sword in the Stone | ours | normal | saw2 | kept | 34×41 | 4 | 28.9 | 43 (43) | 38.8% | 100.0% | 36.3% | 196 s | WWW | 340 s | 14 s | 12, tap 2, 4/1 |  |
| 58 | ours-g21 | Party Slime | ours | normal | saw0 | kept | 24×41 | 5 | 32.1 | 34 (34) | 71.8% | 100.0% | 70.3% | 177 s | WWW | 290 s | 15 s | 11, tap 3, 2/0 |  |
| 59 | ours-g06 | Wise Old Owl | ours | hard | hard | tuned | 30×41 | 4 | 27.3 | 41 (41) | 13.0% | 32.0% | 7.7% | 194 s | WWW | 351 s | 15 s | 16, tap 6, 2/0 |  |
| 60 | ours-g24 | Goblin King's Hoard | ours | hard | hard | tuned | 37×41 | 5 | 26.1 | 40 (40) | 16.3% | 69.0% | 20.0% | 172 s | WWW | 355 s | 15 s | 11, tap 4, 0/1 |  |

### Bake log

```
gallery bake v4: 60 pictures, 60 baked on 16 threads
picture 45 (noto-1f36d) candidate 1: no deal in 24 attempts
picture 45 (noto-1f36d) candidate 2: no deal in 24 attempts
picture 45 (noto-1f36d) candidate 3: no deal in 24 attempts
gallery bake: 60 levels in 987.2 s, 0 fallbacks
gallery bake: patient play-through on the stored line at 1x: median 431 s, 290 s-548 s; longest single tap max 15 s; taps max 55; tags easy 8, normal 38, hard 14, extreme 0
gallery bake: real pace (x 1.77, on each picture's tag): median 197 s, 159 s-298 s; replays that lost 0; by tag easy 208 s (8), normal 197 s (38), hard 178 s (14), extreme -
```
<!-- gallery:end -->
