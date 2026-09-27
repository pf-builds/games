## Reading (builder's summary, written against the numbers below)

**The engine and solver are cheap.** 1,200 boards measure in under a second on 16 threads. Solve p95 is 1–2 ms. Nothing came near the 150k state cap, because a tight muster keeps the reachable set to tens or hundreds of states. The draft bake takes about 1.2 s.

**How the boards are built.** The first Voronoi pass gave min 1 on almost every board. Two materials merged into one section that ran from the edge to the keep. The generator now cuts blobs into *pieces by ring* (Chebyshev distance from the keep, with a per-blob wobble). Each ring takes a role from `bands` (wall, courtyard, moat band). A wall piece may never share a material with a wall piece on a neighbouring ring. The edge is always the outer wall, and the wobble can thicken a wall but never erase one. Courtyard "dividers" split the courtyard into compartments. The compartments are what make the first break a real choice.

**Proposed bands** (in `bake-config.json` → `proposedBands`, not in SPEC):

| world | muster spare | random win | min crews | max crew sections | extra |
|---|---|---|---|---|---|
| 1 | 0 | 0.06–0.50 | 2–3 | 22 | none |
| 2 | +1 | 0.04–0.30 | 2–3 | 30 | chest on an optimal line |
| 3 | +1 | 0.01–0.10 | 3–4 | 34 | chest on an optimal line |
| 4 | +1 | 0.004–0.06 | 3–5 | 40 | chest on an optimal line, levers must matter |

**Calibration against Food Hunt (a judgment on the proxy, not a measurement).**
- World 1 is easy. It opens with the three teaching boards (random win 1.00, 1.00, 0.24). Every baked board is 2 breaks among about 16 sections.
- World 4 is clearly the hardest world by the proxy (random win about 0.01, greedy fails 81%).
- But it *plays* short: 3–4 breaks. It also *reads* big: 38 crew sections median on 11×11. SPEC counts "harder to read than Food Hunt's late game" as a defect, so **World 4 is at risk of reading harder than it plays.** Fewer, bigger sections would fix it (see flags).

**Why spare +1 from World 2 on.** This runs against SPEC's "tighter muster later", so it's worth explaining. At spare 0 the random win rate sits on the floor in Worlds 3–4 (p50 0.00–0.01, which is 0–3 wins out of 300). There the proxy can't order boards any more. Spare +1 lifts it off the floor and is also kinder as boards grow. World 1 uses spare 0 because that's what makes the greedy rule bite (greedy solves 88% of World 1 at +1 and 70% at 0). If Peter wants a tighter World 4, the fix is a second difficulty proxy, not a tighter band on this one.

**Recommended level counts:** World 1 has 8 (3 teaching + 5). World 2 has 8 and World 3 has 8. World 4 has **6**, because its pool is the weakest (22 of 300 accepted, and levers are idle on 60% of boards). That's 30 in total. The draft bake uses these counts. The pools (60/60/60/40) stay in `levels/pool-w*.json`.

**Elements the data says aren't pulling their weight:**
1. **Iron doors and levers (World 4): flagged.** Levers change the answer on only 36–40% of boards. The cascade (a lever beside the previous door) lands on 4%. "Levers idle" rejects 46 of 300. *Proposed change:* put door 1 on the keep ring, so every route crosses iron. Seal lever 1 in a courtyard divider. Build the cascade on purpose: lever 2 is a tile of door 1 facing door 2. This is cut-order item 1 (World 4 generator polish), and I took the cut.
2. **Depth: flagged.** Min crews are 2 / 2–3 / 3 / 3–4 across the worlds. Min is bounded by the number of wall rings, and an 11×11 board fits about four. A level is a 2–4 break decision, so it's shorter than Food Hunt's 1–3 minutes. *Proposed change for Peter to choose from:* (a) accept short levels, since the puzzle is *which* 3 of ~30 and not how many; or (b) use thicker bands in Worlds 3–4 (two wall rings between courtyards) plus a larger `blobSize` (6–7). That should give min 4–6 with *fewer* sections, which also fixes the World 4 readability flag.
3. **Chest: works, but it's too uniform.** It's placed in a pocket that the unlimited-crew line opens, holding a crew that a later step on that line uses. So it sits on an optimal line about 100% of the time and is required for 3 stars on 74–95% of boards. It's a rule, not a choice, and the "on an optimal line" band criterion filters almost nothing. *Proposed change:* place about 25% of chests as detours off the line (costs a crew, returns a crew), so "detour or straight in" becomes a real decision. Then filter on "required for 3 stars" for the rest.
4. **Moat:** nothing is flagged. It's structural (a band of moat with breakable bridges), and World 3's min rises to 3 partly because of it. I didn't isolate it with a moat-off comparison.
5. **The greedy rule** is the main World 1 filter (209 of 300 rejected). The onion shape makes "nearest the keep" the right instinct. Generation is cheap, so the 16% accept rate still fills a 60-board pool from 800 boards.
