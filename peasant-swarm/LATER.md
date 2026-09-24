# Peasant Swarm — LATER (out of v1 scope)

- Multiplayer (real rivals) — needs a backend; Supabase project queue
- Multiple maps / biomes (winter village, marsh)
- Unit types (archers, knights) and buildings (mill = passive recruits)
- Meta progression between matches
- Title-screen attract mode (AI-only sim as background)
- Global leaderboard (biggest swarm / fastest sweep)
- CrazyGames SDK integration + portal submission pass
- Per-team secondary colour cue (hat colour or pennant) for colour-vision deficiency, on top of the Okabe-Ito-ish palette
- Pixel-art sound icon instead of the emoji speaker
- Rout animation: stagger the flip further and add a horn-blast screen flash
- Smarter AI flee (kite along camps) and AI-vs-AI alliances against the leader

## QA follow-ups from the v2 B0 harness pass (2026-09-24)
- ~~Seed override for replayable worlds~~ done in v2 M1: `?seed=N`, every sim draw on `S.rng`, selfTest replay check
- Hidden-tab load test in `tools/harness.mjs` (lesson 29): v2 M1 added the `PS.debugDropCaches` proxy and cache recovery on visibilitychange/pageshow; `sprites.js outline()` still reads back the same canvas until M5 deletes it
- ~~Two one-line v1 fixes (trickle cap overshoot, negative `raw`)~~ done in v2 M1

## Parked during v2 M1 World (2026-09-24)
- M1 swarms still seek directly, so AI rivals rarely leave their walled home meadows (2 exits): simMatch counts sit at their starter camps until the finale. Not a LATER item, it is exactly what M2's flow fields fix; recorded here so nobody tunes pacing on an M1 build
- Match-start hitch: the visible ground chunks bake in the first frame of a new map (about 10-20 ms desktop). Could pre-bake them while the title iris or the PLAY press plays
- Terrain gen is 80-120 ms on the very first call in a cold page (JIT warm-up), 11-25 ms after. A throwaway gen during boot, or baking the first map in idle time, would hide it
- Minimap walks every agent once per team per frame (five passes); one pass with a colour switch would do
- The debug overlay text runs under the desktop minimap
- Rock plateau "lit" cells are a placeholder speckle; M5 replaces the whole terrain paint (dual-grid cliffs, strata, foam)
- The harness bot routes with its own BFS on PS.terrain; once M2 lands it can drive the game's player field instead and test routing end to end
- PS.bench("capclash") runs 4 teams with no fog on the first fallback map's most open spot; M3/M4 should extend it to 6 teams with fog on, as SPEC-v2 §13 names the scene
