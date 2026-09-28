## Reading (builder's summary, written against the numbers below)

**Headline.** Worlds 3 and 4 are now concentric castles, and the depth target is reached on the shipped boards.
- World 3 raw median min calls went 5 to 8 (p10-p90 6-10). World 4 went 5 to 8 (p10-p90 6-11, and 15 of 300 boards reach 12).
- Boards with a decision point: World 3 38% to 65%, World 4 32% to 53%. Median trap rate 0.00 to 0.13 and 0.08. Median random win 1.00 to 0.53 and 0.73, so a random tapper no longer wins the typical board.
- The bake: World 3 levels run 6 6 7 7 7 8 8 10 10, World 4 7 7 7 9 9 10 10 11 12, each with 2-6 decision points. Nothing was forced: the bands just filter, and the pools are 60 and 37 boards.
- Worlds 1-2 are untouched in shape (same medians, same coverage). World 2's band widened to 4-7, and the bake happens to include one 7.

**What makes the depth.** Full wall layers. The unlimited-crew lower bound (walls between camp and keep) is now 4-6 on the baked World 3 boards and 3-5 on World 4 plus the lever house, against 3-4 and 1-3 on the M0 v2 bake:
1. palisade across the front field (on about a quarter of boards now: the barbican, moat and outworks take the front rows first)
2. moat bridge (every World 3-4 board now; World 4's moat went from 60% to 100%)
3. barbican or outer curtain
4. the bailey, then the inner curtain (its gatehouse on a random side, so the bailey is a walk)
5. the keep ring (World 3) or the lever house in front of the iron ring (World 4)
- Scarcity and the closest rule sit on top of that, as in M0 v2: the musters come from the solver's frontier, and the bailey cross walls, buildings, gardens and outworks are nearer walls of the same material, so "closest" has something to point at. The surprise rate is 94-96%.

**Density.** Crew-wall coverage (S T H I blocks over the whole board): World 3 41% to 50%, World 4 32% to 48% (all walls including iron: 50% and 50%). Every baked World 3-4 board is at least 41%.
- The "about 25%" in the brief is lower than what this tool measures on the M0 v2 generator. Counting every S T H I block over every board cell, M0 v2 was 41% / 32% in Worlds 3-4 and 45% / 49% in Worlds 1-2. The front field and the bailey are still open ground, which is what the crews walk on.
- The new pieces: an inner curtain with its own corner towers and gatehouse, 1-3 cross walls spanning the bailey (2 thick), bailey buildings and hedge gardens, ward buildings, a barbican (a walled gate passage in front of the gatehouse; the moat wraps around it) on 23% of World 3 and 51% of World 4 boards, and 0-3 earthwork outworks in the front field (mean 0.5 and 0.9). Per board on average: 1.5 / 1.9 bailey cross walls, 1.4 / 2.0 bailey buildings, 0.4 / 0.8 gardens, 0.3 / 1.4 ward buildings (World 3 / World 4).

**Readability on a phone.**
- Crew sections went 16 to 24 (World 3) and 17 to 29 (World 4), averaging 11.6 and 12.9 blocks. The caps are 30 and 34 wall sections (iron counted); the p90 is 27 and 33.
- No crew section is a single block on any baked level (tested). Two-block sections exist on about a third of World 3-4 boards: they are bridges over a one-wide moat, the same as M0 v2.
- That is a lot more to read than M0 v2. It is the price of the depth: every extra layer is more sections. The M1 art has to carry it with region textures and clear outlines. If the playtest says World 4 is too busy, the first dials are `radial.n`, `buildings.n` and `outworks.n` in `bake-config.json`.

**Towers.** Towers are coloured after their ring's arcs and prefer a material none of their neighbours use; in Worlds 3-4 a ring's towers share one material, so they read as a set. Measured as "no touching wall shares the tower's material": 98% in Worlds 2-4 (it was already 97-98%) and 65% in World 1 (63%). World 1 has only two materials, so a corner tower between a stone arc and a timber arc can't differ from both. The tower change was cheap and mostly confirms what M0 v2 already did.

**Ties.** Concentric castles are close to symmetric, so equal walks are more common: a tie decides a solution call on 27% (World 3) and 38% (World 4) of raw boards, up from 12% and 23%. The bands reject those boards, and no shipped line has a tie on any call (tested). It costs accept rate, not quality.

**Solver.** In-game solve p95 is 4 ms (World 3) and 3 ms (World 4), max 20 ms, 0 capped, cap unchanged at 150,000 states. The generation-time frontier is p95 95 ms in World 4. Nothing needed a bigger cap.

**Honest read on the pictures.** They read as castles now: two curtains with towers, a bailey you walk around, a gatehouse with a barbican, a keep in its own ring, a moat you bridge. They are denser, not packed. Half of each board is still ground: the front field (6-8 rows for the camp, moat, palisade and outworks) and a 2-block bailey all round. The pictures are also more regular than a real castle plan, because both curtains are rectangles with rounded corner towers. A curved or polygonal inner ring is the next step if Peter wants them to read less like a diagram (LATER).
