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
- ~~M1 swarms still seek directly, so AI rivals rarely leave their walled home meadows~~ fixed in M2: every swarm routes by its flow field; rivals leave home at 4-7 s and reach the central meadow in 13-45 s
- Match-start hitch: the visible ground chunks bake in the first frame of a new map (about 10-20 ms desktop). Could pre-bake them while the title iris or the PLAY press plays
- Terrain gen is 80-120 ms on the very first call in a cold page (JIT warm-up), 11-25 ms after. A throwaway gen during boot, or baking the first map in idle time, would hide it
- Minimap walks every agent once per team per frame (five passes); one pass with a colour switch would do
- The debug overlay text runs under the desktop minimap
- Rock plateau "lit" cells are a placeholder speckle; M5 replaces the whole terrain paint (dual-grid cliffs, strata, foam)
- ~~The harness bot routes with its own BFS on PS.terrain~~ done in M2: the bot sets goals with PS.aim and the game's field routes them (BFS only ranks camps)
- PS.bench("capclash") runs 4 teams with no fog on the first fallback map's most open spot; M3/M4 should extend it to 6 teams with fog on, as SPEC-v2 §13 names the scene

## Parked during v2 M2 Routing and combat (2026-09-24)
- Exit ambushes favour the column: local strength counts everyone within combat.localRadius, including a column queued in a pass that cannot reach the fight, while frontage caps the kills. A 150-column beats a waiting 30 at a 64 px exit every time (strung or dense); the head only breaks against 45-60. If the design wants small swarms to hold passes (R3, R8 open question 3), try a frontage-aware L in M8 (count agents within localRadius by path distance, or weight queued non-fighters down)
- Melee cohesion (combat.contactPull) was needed so pursuit chains stop drifting the melee apart (local strength reads drift as morale loss). It costs density in big clashes (neighbours per team agent 65 -> 77 in the cap-clash bench). Revisit with the M7 perf pass
- Swarm split at an equal-cost watershed is fixed by the corridor bias (flow.corridorDiscount). A team already split far apart (two groups hundreds of px apart) can be drawn toward the anchor's corridor when it saves 30%: watch for it in M4 playtests
- Cliff press: 2.5-2.8 velocity reversals per agent-second while pressed at a face (M1: 5.25; idle on grass 1.08). Agents at the wall still jostle between arrive, separation and push-out; a "settled at the wall" damping would remove the rest
- simMatch 240 s no longer fits the selfTest's 9 s wall guard now that rivals grow (0.85 ms per tick at ~840 agents vs M1's trapped ~300): the harness runs full matches; the selfTest reports the truncation
- Finale scatter: neutrals scattered by a crowned winner become recruitable by anyone (the crowned team too) once their 6 s escape ends. M4 decides whether the crown may re-recruit them
- The remnant "hands up, run" look is a placeholder (faded sprite plus two white pixels); M5/M7 draw the frame
- Route hysteresis applies to the player's cursor-follow and scripted targets only; AI targets change once per think, so AI fields rebuild fresh
- Second finger = HUDDLE while it is down (the HUDDLE button still works). Palm touches on big phones may trigger it: check on Peter's phone
- The zoom ease runs 1 s through non-step zooms (sprites stay nearest-neighbour, pixels uneven for that second)
- Flow-field route preview draws every second cell as a 4 px dot; M5 can swap in a proper dotted trail sprite
