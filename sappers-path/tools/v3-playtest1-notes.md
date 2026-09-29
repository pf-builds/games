# Sapper's Path v3 playtest 1 notes

Peter's notes after playing the fix-pass build:
1. A second tap made the first squad finish instantly. Squads should stay on the board.
2. Too fast.
3. Spamming the next squad got around stuck ones. That should fail.
4. The foundation: only as many sappers go as can reach a block at that moment, and the next round goes as those pop.

Build `?v=12`. Decisions are in SPEC-v3 §9.

## What changed
| File | Change |
|---|---|
| `src/engine.js` | `sim` rewritten as a timed dispatch simulation (header comment has the rules). The whole state lives in one Int32Array: grid, per-colour heaps of unclaimed reachable pixels, spaces, sappers in flight, an event heap on (time, sequence), and the clock. Adds `play(col, t)`, `advanceTo(t)`, `quiet()` and `playSquad`; `replay` is patient; also `rulesOf(v3, d)` and `timeOf`. Log events: TAP, DISP, EAT, GATE, TOWER, HIT, KILL, HOME, FREE. |
| `tools/ref.js` | Rewritten as a slow reference of the same model: a full BFS per target pick, a scan of every pixel, and a linear event scan. |
| `tools/test.js` | Rewritten. Hand-made boards: 2 open with a squad of 14, claims, a space freeing at its home time, spam overflow against a patient win, the merge flag, cascades, gates, archers per difficulty, determinism, save/load. Then the engine-vs-ref differential (patient and rushed) and the stored orders played patiently. |
| `tools/grade.js`, `tools/gen.js` | Every game is played patiently. |
| `tools/bake.js`, `tools/bake-config.json` | Bake v7: engine timing passed in, the new `duration` target in the picks and report, and `--out DIR` for a trial bake. Smaller forts (about 0.7× per side) and bigger squads (about 1.6×), with column minimum 1. |
| `tools/rush.js` | New: random orders played patiently against rushed (a random 0-3 s or 0-1 s wait between taps). |
| `src/board.js` | The show draws engine state: pooled runners keyed by sapper id, routes from the slot point over the current ground, pops and hauls on engine events, hit and kill runners from engine times. |
| `src/main.js` | Engine clock at `show.pace` (×2 on 2×) with the log synced every step. Sheets wait for the squads to settle, with a 6 s cap; skip runs the engine to quiet. The line comes from the engine's spaces. Fatal marks appear when every space is taken. Coach `wait` condition. New selfTest, plus `SP.settle/lossPlan/runners/reachable/fast`. |
| `config.json` | New keys: `v3.time`, `v3.flags`, `show.pace/settleCapMs/maxRunners`. New texts: line label, full-line text, hit/kill labels, and the coach lines on levels 1-3. |
| `tools/harness.mjs` | Patient win, rushed overflow, frame times with 3 rapid taps on L65/L70 at 1× and 2×, overlap screenshots and frame strips. |

## Results
**Bands (Normal, random order, patient):**
| Band | In band | Median |
|---|---|---|
| early | 12/12 | 100% |
| saw0 | 10/10 | 71.0% |
| saw1 | 9/9 | 54.8% |
| saw2 | 10/10 | 39.5% |
| hard | 17/17 | 5.0% |
| hardest | 6/6 | 2.5% |
| relief | 6/6 | 41.3% |

There were zero fallbacks. All 75 levels are winnable on Easy, Normal and Hard with stored orders.

**Lookahead player (Normal):** hard median 13% (max 24%), hardest median 10% (max 23%), both under the 25% target.

**Duration (patient, 1×, stored Normal line):** median 97 s, max 179 s, early 41-69 s. All levels, teaching ones included, run 21-179 s. Before the new sizes, the old levels ran median 151 s and max 498 s.

**Taps:** max 26 per level (cap 55).

**Bake speed:** 209 s on 16 threads, 877 graded candidate decks a second. The engine plays about 33,000 random patient playouts a second on late levels (one thread).

**Rushing (`tools/rush.js`, 300 games per level, Normal):**
| Level | Band | Patient | Rushed, 0-3 s waits | Rushed, 0-1 s waits |
|---|---|---|---|---|
| 5 | early | 100% | 21.7% | 0% |
| 12 | early | 99% | 0% | 0% |
| 18 | saw2 | 44% | 2.3% | 0% |
| 24 | saw2 | 26.7% | 0% | 0% |
| 33 | saw2 | 41% | 0% | 0% |
| 40 | saw0 | 68.7% | 0% | 0% |
| 47 | hard | 10% | 0% | 0% |
| 58 | hard | 5.7% | 0% | 0% |
| 66 | hard | 3.3% | 0% | 0% |
| 74 | hardest | 0.7% | 0% | 0% |

No level is easier rushed.

**Pacing:** walk 80 ms a tile at 1× (it was 40, then squeezed into a 3 s cap per play), 40 at 2×. A 20-tile round trip is about 2 s out and 2 s back.

## Tests
| Check | Result |
|---|---|
| `node tools/test.js` | 136 / 136 |
| Engine vs `ref.js` differential | 450 games (patient and rushed, every level and difficulty), 0 divergences |
| `SP.selfTest()` | 528 pass, 0 fail on every viewport and the hidden tab |
| Harness | All passed at 375×812, 812×375, 1280×720 and the 400×600 iframe; zero console errors or warnings |
| Frame time p95, 3 rapid taps | 16.7-16.8 ms on L65 and L70 at 1× and 2× |

selfTest covers:
- all 225 stored orders played patiently through `play()`
- 4 of them on real 16 ms ticks
- 4 of 10 Sawyers going on level 3
- three overlapping squads
- a rushed overflow whose sheet waits for the squads
- Retry clearing the runners
- the gate and archer shows per difficulty
- the full-line fatal marks
- tick determinism
- the win, pause, the coach and the sprites

## Screenshots (`tools/shots-v3-playtest1/`)
- Squads: `375-two-squads`, `375-three-squads`, `1280-two-squads`, `1280-three-squads`.
- `375-strip-overlap`: the first squad still working while the second heads out; 6 frames 300 ms apart.
- `375-strip-next-round`: level 3, where 4 of 10 Sawyers go and the rest follow as blocks pop.
- The M2 set, refreshed.

## Waived or later
- A `spaceOnTap` flag: in the timed model every tap needs a space, so there is nothing to switch.
- The duration median is 97 s against "about 90". Shrinking forts further starts to thin Era 3.
