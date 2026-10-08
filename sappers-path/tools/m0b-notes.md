# Sapper's Path: M0b notes

Builder notes for M0b, the generator rework to `tools/m0-decision.md`. Numbers, bands and examples are in `m0b-report.md`. Its narrative lives in `m0b-reading.md`, which `report.js` splices in. `m0-report.md` / `m0-reading.md` / `m0-notes.md` are the M0 record and are left as they were.

## Run
```
export PATH="$HOME/.local/opt/node/bin:$PATH"
node tools/test.js     # 91 checks, exit 1 on failure
node tools/report.js   # 2,400 boards (300 per world, before + after), about 1.5 s → tools/m0b-report.md (keeps the bake block)
node tools/bake.js     # about 3 s → levels/levels.json (draft: false) + levels/pool-w{1..4}.json, updates the bake block
```

## What changed, by file
- `src/solver.js`: **additive only.** New export `traps(B, {cap, line})` returns `{trapRate, traps, moves, winnable, decisions, choices, lineTrap, states, capped}`. It runs its own memoised search, so `solve()`, `quickest()`, `greedy()` and `playouts()` are byte-for-byte unchanged (a test checks `solve()` after `traps()`).
- `tools/gen.js`:
  - `castle(W, C, rng)` is the M0b generator.
  - `musterFor()` is the exhaustive mix search.
  - `measure()` adds `trapRate`, `decisions`, `choices`, `lineTrap`, `walls`, `singles`, `seals`, `chestKind`, `minChest`, `minNoChest`.
  - `acceptB()` is the M0b filter.
  - `generate()` and `accept()` are the M0 originals, kept for the report's before column.
  - `batch(C, wk, seed, n, mode)`: `mode: "m0"` runs the M0 generator on `C.m0.worlds`.
- `tools/par.js`: passes `task.mode` through.
- `tools/bake-config.json` (v2): `worlds` holds the castle params, `bands` the M0b bands, and `m0` the M0 worlds + bands (archived). `bake.chunks` is per world, `bake.detourShare` is 0.25, `musterTries` caps mixes per k (120, above the 84 maximum).
- `tools/bake.js`: M0b bands, teaching boards per world, the detour quota, and ordering by min crews then random win. Writes `draft: false`. Its bake block now goes to `m0b-report.md`.
- `tools/report.js`: rewritten for the before/after report. It now writes `m0b-report.md`, not `m0-report.md`.
- `tools/build-data/teaching.json` (v2): each board carries `world`. It adds w2-t1 Goats and a Chest, w3-t1 The Frozen Moat and w4-t1 Iron and a Lever.
- `levels/levels.json`: 36 levels, 8 / 8 / 10 / 10. Each world opens with its teaching board(s). The format is backward compatible (`metrics` gained fields, nothing removed).

## Generator design (castle)
- **Plan:** `W.plans[size]` is one role per Chebyshev ring from the keep: K, W curtain, F iron keep ring, O courtyard, M moat band. The edge always takes the last role. On even boards the keep sits off-centre by half a tile, so the near sides lose one ring. There the moat band (if it's that ring) becomes outer wall, and the middle curtain meets the outer curtain directly (a 2-thick layered wall on those sides).
- **Arcs:** consecutive W rings form one curtain. It's cut by angle into `W.segs[keep|mid|outer]` arcs with jittered cuts. A 2-thick arc splits into inner/outer layers with probability `W.layered`. Fragments and arcs under `W.minPiece` tiles fold into the best same-curtain neighbour. That's why stray singletons are 0.
- **Colour:** outside in. A material a piece of *another run* already touches is forbidden (hard), so a section never spans two rings. Neighbouring arcs of the same curtain avoid each other (soft). A forced repeat just makes a longer arc.
- **Gates:** a divider or bridge is a radial line across its band, never at a corner. It's 2 tiles wide in a 1-thick band, or 1 wide in a 2-thick band, so it's always at least 2 tiles. Gates never touch each other or a lever. A gate's material differs from every piece it touches, or the gate isn't placed.
- **World 4 lever 1:** a courtyard cell touching the iron keep ring. With `W.lever.sealBoth` (0.5) it's flanked by a seal wall on both sides along the ring; otherwise one side. The lever's outward neighbour is the middle curtain, so breaking that arc also exposes it. `W.lever.second` (0.3) adds an unsealed lever.
- **Muster (depth):** `quickest()` gives the straight route m0. For each k in `W.depth` with k ≥ m0, every mix of k crews over the board's materials is solved (at most 84 at k 6). Hits are mixes where min == k. The search picks a random k that has hits, then a random hit. With no hit it falls back to the straight line's mix (info.depth `straight`), and the band's min filter rejects those in Worlds 2-4.
- **Chest:** `W.detour` (0.5) of boards try a detour chest, in an open cell the optimal line never connects, holding a crew the muster lacks. The rest get a required chest, as in M0. The solver classifies: required (every 3-star line claims it), detour (not required, claimable for at most one extra break), or idle (rejected).
- **Spare:** the first material (random order) whose +1 keeps min unchanged. In practice it never lowered the min (0 of 1,200 boards needed the fallback).

## Measurements (headline; full tables in the report)
- Median wall sections, before → after: W1 18 → 6, W2 27 → 10, W3 30 → 13, W4 39 → 16. Stray singletons are 0 on every board (before: median 5-12).
- Min crews on accepted boards: W1 2 (before 2), W2 3 (before 2), W3 4-5 (before 3), W4 5-6 (before 3).
- Accept rates, before → after: W1 16% → 77% (greedy rule off), W2 20% → 2-5%, W3 29% → 23%, W4 7% → 14%.
- Levers matter: W4 36% → 100%. Chest detour share in the bake: 2/7, 2/9, 2/9.
- Speed: report 1.5 s for 2,400 boards, bake 3 s for 5,600 boards (16 threads). The heaviest part is the mix search on World 4.

## Waived, cut, flagged
- **World 1 "about 3" is unreachable.** See the report reading for the numbers. World 1 bakes at min 2, greedy rule off, decision point ≥ 1. This is a SPEC §3 deviation for World 1 only, logged in §7.
- **Deliberate cascades were cut** (cut-order item 1). A design worth doing in M2 or later: make the middle-curtain arc behind lever 1 an iron gate (door 2), with lever 2 as a courtyard tile touching door 2 in a different yard. Reaching lever 2's yard then throws lever 2 → door 2 → lever 1 → door 1 in one derive. Parked in LATER.md.
- **World 2's pool is the weakest** (36 accepted from 1,600). Enough for 8 levels, and the bake has 80 chunks for it. If Peter wants more World 2 levels, the lever is a plan with a 2-wide courtyard (`KWOOW` on 9×9 already exists), or relaxing greedy for its first two levels.
- **No engine bugs found.** The engine and solver behaved exactly to SPEC on every castle board. Every baked line replays to a win in min crews (bake check + test).
- The M0 `report.js` output (`m0-report.md`) can't be regenerated from this tree any more, because `report.js` now writes the M0b report. `m0-report.md` is kept as the M0 record.
