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
- ~~Exit ambushes favour the column: local strength counts everyone within combat.localRadius, including a column queued in a pass that cannot reach the fight, while frontage caps the kills. A 150-column beats a waiting 30 at a 64 px exit every time (strung or dense); the head only breaks against 45-60. If the design wants small swarms to hold passes (R3, R8 open question 3), try a frontage-aware L in M8 (count agents within localRadius by path distance, or weight queued non-fighters down)~~ done in M3 (M2 critic MAJOR-1): combat.localMode "fighting" counts only engaged agents, morale is group survivors over group peak; the spec's 150 v 30 exit ambush now breaks only the head
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

## Parked during v2 M3 Fog of war (2026-09-24)
- Fog JS under the CDP 4x throttle: the per-frame mean is under 1.5 ms on both viewports, but p90 is 1.6-1.8 (phone) and 2.3-2.5 (desktop 1280x720). The throttle runs the page in ~0.2 ms bursts between ~0.5 ms pauses, so any timed segment that straddles a pause reads 0.5 ms more (a 0.03 ms stamp segment reads 0.7 ms at p90). A real-phone trace (M7) is the true test; the remaining floor is the one full-screen blit of a canvas that changes every frame (0.09-0.11 ms at 1x in SwiftShader)
- If the fog pass must shrink further: bake the cloud drift into the mask at the 5 Hz re-put (clouds then step at 5 Hz, visibly), or drop the fog canvas to a lower pixel cap (the look softens at the sight edge)
- The fog canvas is 1/8 CSS size with a 7000-pixel cap. On a large desktop (2560x1440) that is 111x62 fog px for 2560 CSS px: fine for the blurred 16 px mask, but check the hole edge on a real 4K screen
- Clouds and the in-hole vignette are programmer tuning (fog.cloudAlpha 0.5, fog.holeVignette 0.25): M5's art pass owns the look (R7's blue-slate unexplored, desaturated explored)
- Dust puffs share the edge-marker cap at the lowest priority; with 4 higher markers they never show. Fine for now; revisit if playtests miss them
- AI explore is minimal (12 sampled points 400-1000 px out, 3 s commit). M4's personalities replace it (Sly lurks, Greedy follows smoke)
- The danger cue fires only for a rival in the hunt state with you as prey. A rival that is fleeing into you, or wandering past, gives dust only
- Headless bench methodology: an unflushed synchronous bench lets Chrome batch several frames' raster into one flush (fog-on draw p50 1.8 ms, p90 24.6 ms in one run, mean below M2's). The harness's --bench-flush forces a 1 px readback per frame in both builds; keep it for every later draw gate
- performance.now() is quantised to 0.1 ms unless the page is cross-origin isolated. A COOP/COEP server gives 5 us timing for fog-segment profiling; the arcade does not need isolation, so this is QA-only
- The hold fixture: with combat.localMode "fighting", 20 holders at the 64 px exit break a 60-column (the column routs first). R3/R8's pass-holding fantasy now works; M8 should check it is not too strong (a 20 holding against 100?)
- Danger cues are rare: 2 across 7 harness matches. Sight is symmetric (340 + 10 sqrt(n) for everyone), so an AI that sees you is usually also seen by you. The cue needs asymmetry: a bigger rival (a larger sight disc), memory-led hunts, or M4's Sly lurking. Check the rate after M4 and tune fog.danger if it stays near zero
- ELIMINATED (banner and sound) stays global for hidden rivals, like the live pips. If playtests read it as a leak, fold it into the clash ping instead
