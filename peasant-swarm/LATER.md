# Peasant Swarm — LATER

Parked ideas and open follow-ups from v1 and the v2 build (M1-M8), grouped by the milestone that parked them. Items closed during v2 are at the bottom, struck through with the milestone that closed them.

## Ideas beyond v1
- Multiplayer (real rivals) — needs a backend; Supabase project queue
- Multiple maps / biomes (winter village, marsh)
- Unit types (archers, knights) and buildings (mill = passive recruits)
- Meta progression between matches
- Global leaderboard (biggest swarm / fastest sweep)
- Smarter AI flee (kite along camps) and AI-vs-AI alliances against the leader

## QA follow-ups from the v2 B0 harness pass (2026-09-24)
- Hidden-tab load test in `tools/harness.mjs` (lesson 29): v2 M1 added the `PS.debugDropCaches` proxy and cache recovery on visibilitychange/pageshow; `sprites.js outline()` still reads back the same canvas until M5 deletes it

## Parked during v2 M1 World (2026-09-24)
- Match-start hitch: the visible ground chunks bake in the first frame of a new map (about 10-20 ms desktop). Could pre-bake them while the title iris or the PLAY press plays
- Terrain gen is 80-120 ms on the very first call in a cold page (JIT warm-up), 11-25 ms after. A throwaway gen during boot, or baking the first map in idle time, would hide it
- Minimap walks every agent once per team per frame (five passes); one pass with a colour switch would do
- Rock plateau "lit" cells are a placeholder speckle; M5 replaces the whole terrain paint (dual-grid cliffs, strata, foam)
- PS.bench("capclash") runs 4 teams with no fog on the first fallback map's most open spot; M3/M4 should extend it to 6 teams with fog on, as SPEC-v2 §13 names the scene

## Parked during v2 M2 Routing and combat (2026-09-24)
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
- Fog JS under the CDP 4x throttle: the per-frame mean is 0.83-1.44 ms on the phone viewport and 1.04-1.56 ms on desktop 1280x720, while p90 is 1.6-2.4 (phone) and 1.6-2.5 (desktop). The throttle runs the page in ~0.2 ms bursts between ~0.5 ms pauses, so any timed segment that straddles a pause reads 0.5 ms more (a 0.03 ms stamp segment reads 0.7 ms at p90). A real-phone trace (M7) is the true test; the remaining floor is the one full-screen blit of a canvas that changes every frame (0.09-0.11 ms at 1x in SwiftShader)
- If the fog pass must shrink further: bake the cloud drift into the mask at the 5 Hz re-put (clouds then step at 5 Hz, visibly), or drop the fog canvas to a lower pixel cap (the look softens at the sight edge)
- The fog canvas is 1/8 CSS size with a 7000-pixel cap. On a large desktop (2560x1440) that is 111x62 fog px for 2560 CSS px: fine for the blurred 16 px mask, but check the hole edge on a real 4K screen
- Clouds and the in-hole vignette are programmer tuning (fog.cloudAlpha 0.5, fog.holeVignette 0.25): M5's art pass owns the look (R7's blue-slate unexplored, desaturated explored)
- Dust puffs share the edge-marker cap at the lowest priority; with 4 higher markers they never show. Fine for now; revisit if playtests miss them
- AI explore is minimal (12 sampled points 400-1000 px out, 3 s commit). M4's personalities replace it (Sly lurks, Greedy follows smoke)
- The danger cue fires only for a rival in the hunt state with you as prey. A rival that is fleeing into you, or wandering past, gives dust only
- Headless bench methodology: an unflushed synchronous bench lets Chrome batch several frames' raster into one flush (fog-on draw p50 1.8 ms, p90 24.6 ms in one run, mean below M2's). The harness's --bench-flush forces a 1 px readback per frame in both builds; keep it for every later draw gate
- performance.now() is quantised to 0.1 ms unless the page is cross-origin isolated. A COOP/COEP server gives 5 us timing for fog-segment profiling; the arcade does not need isolation, so this is QA-only
- The hold fixture: with combat.localMode "fighting", 20 holders at the 64 px exit break a 60-column (the column routs first). R3/R8's pass-holding fantasy now works; M8 should check it is not too strong (a 20 holding against 100?)
- Danger cues are uneven: 2 to 12 per harness round of 7 matches (0-8 per match). Sight is symmetric (340 + 10 sqrt(n) for everyone), so an AI that sees you is usually also seen by you. The cue needs asymmetry: a bigger rival (a larger sight disc), memory-led hunts, or M4's Sly lurking. Check the rate after M4 and tune fog.danger if it stays near zero
- ELIMINATED (banner and sound) stays global for hidden rivals, like the live pips. If playtests read it as a leak, fold it into the clash ping instead

## Parked during v2 M4 Rivals and match (2026-09-24)
- A player who hangs back in the finale can win by being the last one standing while the valley brawls over the crown. Watch for it in Peter's playtest
- Scattered survivors of a crowned rout are recruitable by anyone once their 6 s escape window ends, the crowned team included (spec reading: "scatter as neutrals"). Rally orbs no longer absorb them inside the window (M4 fix). If the crown still feeds on them, give scattered neutrals a longer no-recruit window for the crowned team only
- AI noise: clashes are heard (difficulty hearing radius). Dust from big swarms is not a separate AI input: explore steers away from bigger swarms the AI remembers (ai.ghostKeep 20 s) instead
- Sly's lurk objective is the nearest power-up beacon within ai.objectiveSight, else the busiest camp it knows; Stubborn claims a camp cluster outside its home meadow. M6's villages, chests and bandit camps become their real objectives
- Bully tracks a scent only while it is at least ai.personalities.bully.trackRatio x the hunt threshold (0.8); a much bigger player gets the pings but no visit. Check in playtest whether Bully ever arrives
- Pile-on uses public live counts. With six swarms after grace it triggers about 1-6 times a match (banner at most every 30 s). The banner may nag when the lead flips back and forth across 1.6x
- The hold fixture (M2 critic MAJOR-1) is a knife edge: the 20 holders beat the 60-column at a column pace of exactly 0.92, and break first at 0.88, 0.90 and 0.95. The fixture now pins its column to fixtures.holdPace 0.92 so the difficulty's rival pace (Normal 0.88 in M4) does not move it. M8 should look at pass holding as a range, not one pace M8 range check on the retuned config: both hold positions pass at a column pace of 0.90 and 0.92, one of two at 0.86, 0.88 and 0.95, neither at 1.00. The fixture keeps holdPace 0.92; pass holding is still a narrow band
- The crowned chip has no crown mark in the pip strip yet (the minimap, edge marker and world crown carry it)

## Parked during v2 M5 Valley art (2026-09-24)
- Chunk bake cost: a full re-bake of the 64 chunks plus water pairs is about 300 ms in headless Chromium (4.5 ms per chunk). A new match bakes the visible chunks in its first frame (4-9 chunks, 20-40 ms here, maybe 4x that on a phone), then one per frame. If Peter's phone shows a hitch at match start: bake the visible chunks on the title screen for the next map, or split a chunk's paint across two frames
- Zoom steps on DPR 1 (0.75, 1.25) put an art pixel on 1.5 or 2.5 device pixels, so pixels are uneven on 1x desktop screens. DPR 2 phones and Macs land on whole pixels at every step. Snapping DPR-1 zoom to 0.5 / 1.0 / 1.5 changes how far a big swarm sees on desktop, so it waits for Peter's desktop read (R7 item 1)
- Three of the six fixed team hexes sit under 70% HSL saturation (blue 68%, violet 67%, crimson 60%); in HSV violet is 56%. The brief fixed the hexes, so they stay; the hat ramps are built from them. If a playtest mixes crimson and orange, darken crimson's hat shade rather than change the brand colours
- Banner tier 1 (10-49 peasants) uses the same small cross emblem for every team; the team emblems (pitchfork, sun, diamond, star, sword, moon) show from tier 2 (50+). Colour carries the small tiers
- Pass floors use the pass mask (dilated one cell), so the dirt around crossings and home exits is broad. Narrow it to the un-dilated pass cells if it reads as mud
- The plateau top is a khaki stone ramp so it never matches walkable highland grass. If playtests read the plateaus as walkable, add a grass-tuft rim or darken the top one step
- Bridge decks are the crossing's 2 cells, so bridges are short and square. A longer deck needs terrain.bridgeWidth, which moves fairness and routing: M8
- Decal mushrooms and flowers are the only saturated pixels in the ground (0.01% of a terrain crop over 45%). Keep them rare
- Hit flash is one baked frame (white wash at art.flashWhite) shown while the flash timer is above art.flashMin, not a fade: it keeps one draw per agent. M7's clash cues may want two flash levels (a second atlas row)
- Remnant "hands up" is still two cream rects over the plain frame; M7's surrender frame belongs in the atlas (M7: the rout wave draws the same hands-up pixels plus a dropped fork; an atlas row is still the better frame)
- Relic overlays (helmet, tines, shield) are hooks in sprites.js (RELIC, the relics argument of peasantSet): M6 fills them, and each combination becomes its own cached atlas (done in M6: Arms I-III set the hat band, crest and tines; one atlas per team per Arms tier, the old one zeroed)

## Parked during v2 M6 Spoils (2026-09-24)
- AI rivals know every landmark site from the start (SPEC-v2 §7) and beeline for their region's chest and village (chests taken at 3-7 s in a live probe). If the rivals out-grow a new player in the first minute, give sites a knowledge radius like camps (ai.campKnowStart) instead of the whole map
- Stubborn still claims a camp cluster and Sly still lurks near a power-up or camp (M4's stand-ins). Point them at villages and bandit camps (claimSite / lurkSpot) once spoils pacing is tuned
- AI swarms do not route around bandit camps they cannot take: a forage target past a camp can walk them into its reach. Add bandit reach to the camp-avoidance list when it shows in playtests
- Villages sort by their gate: peasants inside the palisade are drawn behind the huts. If swarms walking through a village read as vanishing, draw the palisade as ground and the huts in the y-sort
- A team at its cap on an axis walks over a relic or chest of that axis without opening it (it stays for others). Muster grants +1 on its axis, so Horn I from a chest plus the 15 milestone makes Horn II
- A routed leader drops only when the rout group is at least progression.dropMinShare (0.3) of it: a 20-peasant skirmish at the edge of a 300 swarm is not "routed". The drops land where the winner's flipped peasants stand (C1 E); the winner usually takes them
- The heavy chest counter shows the ring's leading count (a rival's, if it leads the ring); the pick-of-two relics can be taken by anyone
- Arms parity is measured with PS.fight at 40 and 60 per side: break-even ~1.2x (I), ~1.36x (II), ~1.55x (III) at 7% per tier (8% put Arms II at ~1.40x, on the gate). Fights sit on the rout rule's knife edge, so single points need 9+ seeded runs

## Parked during v2 M7 Polish and mobile (2026-09-24)
- Phone sim cost: the packed hash, the idle-neutral skip and the folded passes cut PS.bench("capclash") update p90 at 4x from about 4.8 to about 4.0 ms at the old 700 touch cap; spawn.touchAgentCap went 700 -> 640 (the brief's last lever) for margin (about 3.3-3.6 ms). A 24 px hash would scan a third fewer candidates but changes the neighbour order, and with it which enemy each fighter picks: 60 v 40 went from 4.9 s to 6.2 s. It needs an order-independent target pick (nearest, ties by id) and an M8 re-tune of combat before it can land M8 changed numbers only, so the 24 px hash and its combat re-tune stay open
- Draw at 4x in headless SwiftShader is 35-45 ms p90 on the phone scene: that is software raster, not JS. Adaptive DPR (2 -> 1.5 -> 1 on a p90 over 20 ms for 3 s) is the real-phone answer; Peter's iPhone with ?debug=1 is the true reading
- The first rival is not seeded smaller within ~900 px (SPEC-v2 §10 onboarding): the six spawns sit on a ring about 1550 px apart and every swarm starts as one peasant (you get the Easy / Normal start bonus). A seeded weak neighbour needs a spawn-slot or start-count rule: M8 M8: parked with a measurement. The first rival the bot sees is already weaker than it in 38 of 40 Easy and 32 of 40 Normal matches (rivals start as one peasant, you with the start bonus). A rival within ~900 px needs a new spawn ring (neighbouring slots are ~1550 px apart), which moves terrain fairness; SPEC decision 12
- The painted title replaced the attract match (the title no longer runs a sim behind it). If portals want the live valley as the menu, draw the attract world at a low tick rate behind the painted sky instead
- Win and lose staging draw over the frozen world in screen space; the lose screen's grey frame is one canvas at the main canvas size (zeroed when you leave it). A dedicated surrender frame and a proper planted-banner animation (pole driven into the hill) are polish for later
- Poster mode stages seed 1000's first ford at a fixed moment; if the arcade card wants a tighter crop or a mid-clash moment, add polish.posterStep (seconds of sim before the freeze)
- Crowd murmur and the other new sounds are untested by ear (headless is silent): Peter's phone with the ringer on and off is the check (the session is "ambient" where the browser offers navigator.audioSession). P1: Peter heard "static" on desktop; see the P1 section
- Hints are one-shot per match; a first-ever flag could stop them repeating in match two

## Parked during v2 M8 Tune and hand-off (2026-09-24)
- Scripted win rates lean on the harness bot's simple policy (flee rivals over 1.4x, hunt under 0.7x, else forage): with the M8 remnant rule it rarely finishes a rival off, so it wins mostly by being biggest at the bell. Easy / Normal / Hard land at 68% / 35% / 20% over 40 seeds each (20 used for tuning, 20 fresh) (targets >= 60 / 35-45 / 15-25), set with `huntMult` and `aiSpeed` mostly. A human plays differently; Peter's first matches per difficulty are the real read
- First sighting stays under the 30-90 s target (all-AI 15 s, bot on Normal 24 s). Grace 75 and 90 s change nothing (sighting is not a hunt), a home meadow of 12 cells with 3 starter camps made it earlier (17 s), and a 45 s truce moved the bot's to 31 s. The real levers are sight-blocking valley walls (SPEC decision 7 says terrain never blocks sight) or giving objective sites a knowledge radius so rivals do not beeline out of home at once (see M6 item above)
- The bot's first fight comes at 34 s on Normal: it is the bot's own hunt of a smaller rival (grace binds AIs, not the player). AI-vs-AI first fights land at 66 s. A 45 s truce moved the bot's to 55 s and cut its Normal win rate to 15%; M8 left `combat.truceSeconds` at 0
- All-AI bell readings are noisy at 20 seeds: near-identical configs read 55-90%. Gate future tunes on 40+ seeds or paired seed sets (the M8 sweep runner steps matches deterministically with the frame loop stopped, so the same seed replays exactly)
- `ai.aiVsAiHuntMult` 1.8-2.0 (more AI-vs-AI hunting) cut the all-AI bell from 45% to 15-20% on the M7 config; 2.6 was within noise of 2.2. It stays 2.2
- Muster 400 (Arms I) is almost never reached: 0 of 40 Normal and 3 of 80 Easy / Hard bot matches, 0 of 240 AI teams in the final runs (muster 200 in 32 of 40 Normal matches). If Peter misses the third muster banner, 50 / 200 / 300 is the next step; it would add tiers late, where the end median already sits one over target
- The heavy chest ring grew 80 → 100 px so a 100-weight chest can hold 100 peasants (an 80 px ring never opened in the heavy-chest check). A ring that scales with the weight would be tidier than one radius for both
- A routed leader still drops every tier, so a few bot matches end on 0-1 tiers after one late loss (range 0-6 on Normal). Fine by the rules; watch whether it reads as harsh
- The M8 sweep runner (`game-research/peasant-swarm-v2/M8-sweep/`) could move into `tools/` next to the harness (a `--patch` flag on the harness would do the same for its matches)

## Parked during v2 P1 Playtest fixes (2026-09-24)
- The slowdown (agent.speed 170 -> 155) moved where a small force holds a pass. Over 20 fresh seeds, 20 holding at the 64 px exit against a 60 column went from 15/20 to 0/20, holding inside the pass from 3/20 to 10/20, and the column's head breaking at an exit ambush from 20/20 to 13/20. Combat runs on fixed time (1 s swings, the break and brace timers) and the enemy hard push is a per-tick distance, so slower walkers give ground faster relative to the fight. P1 turned both fixtures into rates over 8 seeds and did not retune combat (the brief). If the exit hold should come back, scale the fight clock or the hard push with speed
- Stragglers under fog take the known-ground rejoin field (unexplored cells block). The team field stays optimistic about the dark (unknown costs as grass) by SPEC §3, so the main body can still route into unexplored rock and learn it the hard way; the re-plan now covers every agent's route
- The brief's "no same-team neighbour within ~60 px" straggler test is not used: the neighbour scan stops at 34 px for cost (M2), and inside that radius the path tests (band past the median, detour past the straight line) already decide. A lone agent in open ground steers the same either way
- ~~Mix levels are set by measurement, not by ear: the murmur sits about 15 dB under a melee at 400 peasants (it was 8 dB), and hits and deaths fire at most 11 and 6 a second (were 25 and 16). Peter's ear on a real speaker is the check; every number is in config.audio~~ superseded in P2 (Peter still heard static at large swarm sizes; the mix was redesigned, see below)
- Safari was not tested: the container has Chromium only. Chromium collected every finished node on GC even before P1; WebKit is the engine where un-disconnected nodes are known to linger, and P1 disconnects every cue voice on end and never makes nodes for the crowd sounds, so the graph stays at 19 fixed nodes plus the live cues either way
- encampments.banditSpeed went 150 -> 137 with the slowdown so bandits stay 0.88x your pace (at 150 they would run 0.97x). One number to put back if bandit camps feel too easy

## Parked during v2 P2 Audio pass (2026-09-24)
- The tonal murmur is untested by ear. If it reads as a drone rather than a crowd, `audio.murmur.max: 0` drops it (the brief's fallback); the ?debug=1 mixer mutes it live for an A/B
- The other cues keep their noise parts (the rout's 0.5 s low-passed burst, the scatter and cheer bursts, the horns' breath, the rumble, the win shimmer): the brief fixed the crowd sounds only. They carry 15% of the noise-like energy in the before mix at 700 agents and 1% after. If Peter still hears hiss on a rout or a village cheer, those are the next to go tonal
- The hit's square blip and the death's sawtooth run unfiltered (harmonics to the top of the band, tonal: flatness 0.05 and 0.12, 4% and 10% of their power above 2 kHz). If a clash reads as buzzy rather than hissy, one low-pass per tone lane (two nodes) is the lever
- The level bound's `audio.lanePeak` (0.1) is the lanes' and beds' RMS in a 700-agent clash, not their peak: counting their rare peak (about 0.4) left no room for a second cue, and the 60-agent scene dropped the elimination cue that follows a rout. A cue stack over the ceiling is ducked (a rout plays at about -9 dBFS peak), and the limiter holds the rare coincidence above -6 dBFS
- The brief's full-band spectral flatness cannot see low-passed noise (white noise 0.99, noise low-passed at 1.2 kHz 0.03, a square wave 0.00), so the before mix already passed its bar (0.019). selfTest also asserts the noise-like share of the A-weighted power (the render as heard minus its tonal part, same seed), which does see it: 34% per second before, 7% after at 700 agents
- The selfTest audio part is about 11 s of wall time (the 120 s node soak 8 s, the 20 s render check 3 s). On a slower machine, `fixtures.audioSoakSeconds` or `audio.qa.sampleRate` 22050 buys headroom under the harness's 15 s per part
- Safari still untested (Chromium only in the container). The P2 graph is 40 fixed nodes plus the live cues

## Closed in v2 (kept for the record)

### Ideas beyond v1
- ~~Title-screen attract mode (AI-only sim as background)~~ superseded in M7: a code-painted valley title (src/title.js)
- ~~CrazyGames SDK integration + portal submission pass~~ adapter in M7 (src/portal.js, no-op unless ?portal=crazygames|poki); the submission pass stays open
- ~~Per-team secondary colour cue (hat colour or pennant) for colour-vision deficiency, on top of the Okabe-Ito-ish palette~~ done in M5 (hat silhouettes, banner emblems)
- ~~Pixel-art sound icon instead of the emoji speaker~~ done in M7 (pixel SVG icons for sound, muted and pause)
- ~~Rout animation: stagger the flip further and add a horn-blast screen flash~~ done in M7 (the rout wave: hands up, then the colour turns outward from the contact over 0.6 s)

### QA follow-ups from the v2 B0 harness pass (2026-09-24)
- ~~Seed override for replayable worlds~~ done in v2 M1: `?seed=N`, every sim draw on `S.rng`, selfTest replay check
- ~~Two one-line v1 fixes (trickle cap overshoot, negative `raw`)~~ done in v2 M1

### Parked during v2 M1 World (2026-09-24)
- ~~M1 swarms still seek directly, so AI rivals rarely leave their walled home meadows~~ fixed in M2: every swarm routes by its flow field; rivals leave home at 4-7 s and reach the central meadow in 13-45 s
- ~~The debug overlay text runs under the desktop minimap~~ done in M7 (a DOM readout with the nofog toggle)
- ~~The harness bot routes with its own BFS on PS.terrain~~ done in M2: the bot sets goals with PS.aim and the game's field routes them (BFS only ranks camps)

### Parked during v2 M2 Routing and combat (2026-09-24)
- ~~Exit ambushes favour the column: local strength counts everyone within combat.localRadius, including a column queued in a pass that cannot reach the fight, while frontage caps the kills. A 150-column beats a waiting 30 at a 64 px exit every time (strung or dense); the head only breaks against 45-60. If the design wants small swarms to hold passes (R3, R8 open question 3), try a frontage-aware L in M8 (count agents within localRadius by path distance, or weight queued non-fighters down)~~ done in M3 (M2 critic MAJOR-1): combat.localMode "fighting" counts only engaged agents, morale is group survivors over group peak; the spec's 150 v 30 exit ambush now breaks only the head

### Parked during v2 M4 Rivals and match (2026-09-24)
- ~~The finale is a massacre. All-AI matches (Normal rivals) keep 6 / 5 / 5 swarms at 1:00 / 2:00 / 3:00 and 5 at the horn, then every swarm but one dies inside 20-35 s: 0 of 4 reached the bell in a seed sweep (finale.underdogRatio 0.75: 1 of 4). Cause: every rival converges on the crown, contact fights between attackers are full-flip (SPEC-v2 §6), and a converging brawl eliminates groups one by one. Levers for M8: keep the remnant rule in non-crown finale fights, a higher finale.underdogRatio (more attackers wait for a partner), attackers that avoid each other on the way in, or a later horn. Measured on the ten harness seeds (all-AI, Normal): spec settings 2/10 bells; finale.underdogRatio 0.75: 1/10; ai.finalFleeRatio 1.3: 1/10; world.finalSeconds 45: 1/10; finale.fullFlip false (keep the remnant rule after the horn): 7/10 bells, leader wins 4/10, fights 21 -> 34. The bell target (>= 60%) needs the remnant rule in the finale or an equivalent; that reverses SPEC-v2 decision 1, so it is the orchestrator's call (the switch is in config, default true = spec)~~ done in M8: the remnant rule stays in the finale (M4) and M8 set `combat.remnant.minLoser` 20 → 12, `escapeSeconds` 6 → 9 and `finale.underdogRatio` 0.3 → 0.8. All-AI bell 83% over 40 seeds (M7 config on the same 40 seeds: 38%); the 3:45 leader wins 20%
- ~~Six pips wrap to two rows on a 375 px phone (four and two). The clash panel, edge markers and hint moved down to clear them. M7's portrait layout (five 60x24 pips under the top bar) replaces this~~ done in M7

### Parked during v2 M6 Spoils (2026-09-24)
- ~~Spoils come fast. With villages (80 garrison peasants), six fixed chests, heavy chests, six bandit camps and the trickle chest, the fog-honest bot had 4-6 relic tiers at 1:00 and 5-6 at the bell in the first 5-match pass (acceptance 3-6); AI rivals end at 2-7. Heavy chests went 4 -> 2 and fixed chests moved to 600-1600 px from their spawn after that pass. M8 levers: fewer heavy chests, later trickle chests (progression.trickleChestAfter), higher muster milestones, bandit camps that cost more (encampments.banditHp / banditDamage: a 45-swarm clears an orange camp with no losses today)~~ done in M8: muster 50 / 200 / 400, heavy chests 50 / 100 (ring 100 px), trickle chest from 2:30 every 60 s (max 2), bandits 20 hp / 3 dmg. The harness bot now sits at a median 3 tiers at 3:00 and 5 on Normal (4 on Hard) at the end (was 5 and 6); the end is one over the target of 4 since the heavy ring grew (see M8 below)
- ~~Relic onboarding (the first muster relic flying into the strip) and the portrait HUD layout for the relic strip are M7's (SPEC-v2 §10)~~ done in M7

### Parked during the post-v2 feedback pass (2026-09-24)
- `fixture_ambush_head_only` fails in selfTest at 1/8 against a 0.5 bar, identically on the pre-change build (games cfe9a0b). It's the pass-ambush drift noted above from the 170 -> 155 slowdown, not the keyboard or bridge changes. Decide whether the bar or the fight clock moves.
- Fords got the same rotated-rectangle art as bridges but stay 4-5 cells wide. If they read as too wide next to 3-cell bridges, narrow `terrain.fordWidth`.
