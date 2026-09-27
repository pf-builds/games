# M0 gate decision (orchestrator, 2026-09-27)

Peter was away and asked the forge to keep going to a playable build. I made the M0 gate call myself. Peter reviews it at the playtest gate and can reverse any of it; every number here lives in `tools/bake-config.json`.

## What the M0 data showed
- The boards read as noise. World 1 has 16–22 sections on 7×7/8×8, many of them single tiles, in a stone/timber checkerboard. World 4 has 33–43 sections.
- Levels are shallow: minimum crews 2 / 2–3 / 3 / 3–4 by world. The puzzle is "find the gap", not "plan the order". Food Hunt's appeal is big readable colour regions and an order that matters.
- On the World 4 sample the optimal line ignores the iron doors entirely. Levers matter on about 40% of boards.
- The chest is on the optimal line about 100% of the time, so it acts as a rule rather than a choice.

## Call: take option (b), plus castle-shaped boards
1. **Readable castle plans, not noise:**
   - Concentric curtain walls 1–2 tiles thick, split into a few long segments of different materials, with courtyards of open ground between rings. World 3+ adds moat bands with breakable bridges.
   - Section caps: World 1 ≤ 10, World 2 ≤ 14, World 3 ≤ 18, World 4 ≤ 22.
   - At most 2 single-tile sections per board, unless one is a deliberate gate.
2. **More depth**, as a target to measure against rather than a promise:
   - Minimum crews: World 1 about 3 (the teaching boards are exempt), World 2 3–4, World 3 4–5, World 4 5–6.
   - Order should matter through material scarcity: the muster can't afford the straight route, so the player has to choose which walls to spend on.
3. **A second difficulty proxy.** A trap rate: across states on winning lines, the share of legal moves that lose. Also count the decision points. Bands are set from measurement, as before.
4. **Chest:** about 25% of chests become detours, where reaching one costs a crew and returns a crew. The rest are required for 3 stars.
5. **World 4:** use the builder's plan. Put door 1 on the keep ring so every route crosses iron, seal lever 1 in a courtyard divider, and build some cascades on purpose. Levers must matter on every accepted board.
6. **Teaching boards:** hand-author the first level of Worlds 2, 3 and 4 (goats and a chest, ice and the moat, iron and a lever).
7. **Level counts:** a floor of 6 per world and up to 10 if the pools are strong. Keep the pools.

This runs as M0b, the generator rework, in parallel with M1 (UI core loop). The two own separate files. The level JSON format stays backward compatible.
