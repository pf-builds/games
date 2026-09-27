## Reading (builder's summary, written against the numbers below)

**What changed.** Voronoi blobs are gone. A board is now a castle plan read from the keep outward: keep ring, courtyard, curtain, moat band, outer curtain (World 4's keep ring is iron). Each curtain is cut into 2-6 long arcs of different materials. Courtyards get 2-tile radial dividers and moat bands get 2-tile bridges. A colouring rule keeps any section from spanning two rings. Depth no longer comes from more rings, because an 11×11 board only fits about four. It comes from the muster: an exhaustive search over crew mixes finds one whose best line spends every crew, so the unlimited-crew straight route can't be afforded and the player has to choose which walls to spend on.

**Readability (decision item 1): met in every world.** Median wall sections, before → after: 18 → 6, 27 → 10, 30 → 13, 39 → 16. Every accepted board sits under its cap (10 / 14 / 18 / 22). Stray single tiles went from a median of 5-12 per board to **0 on every board**. The only single tiles left are World 4's lever seals, which are deliberate. The examples below read as plans: a ring of wall, a yard, a wall around the keep, and a moat with two or three bridges in Worlds 3-4.

**Depth (decision item 2), by world.**
- **World 1: target "about 3", unreachable.** With two materials and no cross-ring merges, a mix that blocks every 2-crew route while allowing a 3-crew one exists on 0-4% of boards (0.7% in this report's sample). And greedy solves 99% of readable two-ring castles, because "nearest the keep" is right when the only question is which gate to use. **Proposed target: min 2**, with the greedy rule off and at least one decision point instead. Every accepted World 1 board has a first break that loses the level. World 1 is the tutorial world; the depth ramp starts in World 2.
- **World 2: 3-4 reached, narrowly.** Min 3 on about 35% of raw boards and min 4 on 2%. After the greedy rule, accept is 2-5% (the report's sample shows 2%; the bake found 36 in 1,600). The pool is the weakest of the four, and baked levels are min 3 with one min 4.
- **World 3: 4-5 reached.** Min 4 on 60% and min 5 on 9% of raw boards. Accept is 23%.
- **World 4: 5-6 reached.** Min 5 on 22% and min 6 on 5% of raw boards. Accept is 14%, twice M0's 7%.

**Second proxy (decision item 3).** The trap rate separates boards that random win can't. At spare +1, World 4's random win still sits near the floor (p50 0.02), while its trap rate spreads 0.36-0.58. Decision points rise with the worlds: median 1 / 2 / 3 / 4 on accepted boards. Before, boards had high trap rates (0.65-0.75) because a board of 20-40 small sections has many dead-end breaks. After, the trap rate is lower (0.33-0.58), but the traps sit on the line: most steps of the optimal line are a real choice.

**Bands chosen** (in `bake-config.json` → `bands`; the proxy bands trim roughly the 5% tails of the depth-qualified pool, and the main filters are min crews, greedy and the caps):

| world | spare | min crews | caps (walls / stray singles) | greedy rule | decision points | random win | trap rate | chest | levers |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 2-3 | 10 / 2 | off | ≥1 | 0.20-0.60 | 0.25-0.60 | none | n/a |
| 2 | +1 | 3-4 | 14 / 2 | on | ≥1 | 0.03-0.55 | 0.20-0.65 | required or detour | n/a |
| 3 | +1 | 4-5 | 18 / 2 | on | ≥2 | 0.005-0.30 | 0.20-0.65 | required or detour | n/a |
| 4 | +1 | 5-6 | 22 / 2 | on | ≥2 | 0.002-0.20 | 0.20-0.70 | required or detour | must matter |

**Chest (decision item 4).** It's generated either as required (in a pocket the line opens, holding a crew a later step needs, with the muster one short) or as a detour (in a pocket off the line). The solver then classifies the result. The bake takes 2 detours per world with chests: 2 of 7, 2 of 9 and 2 of 9, which is 22-29%. The rest are required for 3 stars.

**World 4 (decision item 5).** Door 1 is the whole keep ring, so every route crosses iron and levers matter on 100% of boards (M0: 36%). Lever 1 sits in a courtyard divider, sealed by one or two single-tile walls, so reaching it is a routing problem: the middle-curtain arc behind it, or a seal wall from a neighbouring yard. About 30% of boards add a second, unsealed lever. **Deliberate cascades were cut** (cut-order item 1).

**Level counts (decision item 7).** 8 / 8 / 10 / 10 = 36. Worlds 3 and 4 have strong pools (60 each), so they get 10. World 2's pool is 36, so it stays at 8. World 1 is shallow, so it stays at 8 (3 teaching + 5).
