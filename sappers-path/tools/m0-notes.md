# Sapper's Path: M0 notes

Builder notes for M0 (engine + solver + generator + report + bake). The numbers and the band proposal are in `m0-report.md`. The narrative part of that report lives in `m0-reading.md`, and `report.js` splices it in.

## Run
```
export PATH="$HOME/.local/opt/node/bin:$PATH"
node tools/test.js     # 52 checks, exit 1 on failure
node tools/report.js   # 1,200 boards, under 1 s → tools/m0-report.md (keeps the last bake block)
node tools/bake.js     # about 1.2 s → levels/levels.json (draft) + levels/pool-w{1..4}.json, updates the bake block
```

## Files
- `src/engine.js`: pure rules, UMD. `parse`, `derive` (hot path, writes into scratch), `start/apply/undo/restart/canBreak/legalMoves`, `sectionAt/sectionCells/crewOf`, `serialize`.
- `src/solver.js`: `solve` (memoised DFS, cap, never throws), `quickest` (unlimited-crew A*), `greedy`, `playouts`, `mulberry32`.
- `tools/gen.js`: `generate`, `measure`, `batch`, `accept`. `tools/par.js`: worker-thread runner with results in task order.
- `tools/bake-config.json`: every generator and band number. The bands are under `proposedBands`, and are not written into SPEC.
- `levels/teaching.json`: the three hand-authored world-1 boards (min 1, 2, 2; The Wrong Wall's random win is 0.24).

## Decisions (also in SPEC §7)
- The state is the broken-section set. Undo re-derives from the move list, so parity holds by construction and is tested on the chest, lever and teaching boards.
- The chest bookkeeping in the solver is exact: three distances per state (any win, a chest-claimed win, a no-chest win).
- Generator: pieces by ring, with no cross-ring material merges, an always-walled edge, and a wobble that only thickens walls. The raw Voronoi pass gave min 1 on nearly every board, which is why the rings exist.
- The muster comes from the unlimited-crew optimal line, so min crews equals the line length whenever that line stays feasible (it always does, by construction).
- The draft bake orders levels easiest first by random win rate and picks evenly across the accepted pool's difficulty.

## Waived or cut
- **The World 4 generator polish was cut** (cut-order item 1). Levers matter on only about 40% of boards and cascades land on 4%. The fix is proposed in the report.
- **"Each later world's first level teaches its new element on its own"** isn't done. The draft bake just opens Worlds 2–4 with their easiest accepted board. Hand-authoring those three teaching boards belongs to M2 (or to an M1 follow-up once the bands are approved).
- The "Worlds 1–3 never combine more than two special elements" rule holds by construction: World 2 has a chest only, and World 3 has a chest plus moat.
- `twoTap`, the stars, the save and everything in the DOM are M1.
