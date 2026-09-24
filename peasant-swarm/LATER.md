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
- Seed override for replayable worlds (e.g. `S.nextSeed` read once by newGame), so a harness or critic can replay a map; `Math.random` in the sim would still need a seeded source for exact replays
- Hidden-tab load test in `tools/harness.mjs` (lesson 29): `sprites.js outline()` still reads back and rewrites the same canvas
- Two one-line v1 fixes held back by the zero-gameplay-change rule: trickle overshoots `spawn.agentCap` by up to campMax-1 (check `agents + campSize <= cap`), and `frame()` should clamp `raw` to >= 0 (resume() and the debug fallback clock can hand it a negative dt)
