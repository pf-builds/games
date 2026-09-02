# Peasant Swarm — Build Spec (v1, approved 2026-09-01)

Swarm battler: crowd × open arena. Fourth Click it! Studios cabinet. Peter's original concept (canonical record: `memory/projects/peasant-swarm.md`).

## Mechanic
- You start as **one peasant**. Neutral peasants stand in small camps scattered across a large scrolling map. Touch one and it joins your color.
- Your swarm moves as one blob toward the pointer (boids: seek + separation + cohesion). Hold **huddle** to tighten the blob (defensive, focused contact line).
- Three AI rival swarms recruit, hunt power-ups, and engage when count favors them. Each has a personality (Greedy / Bully / Wary) with its own hunt and flee ratios.
- **Combat** is local: peasants only fight enemies within engage range, so the contact line and blob shape matter (local superiority, not global count). Each peasant has HP, a pitchfork, and an attack timer. Multiple attackers on one target focus it down.
- **Rout**: once two swarms have been engaged ≥1s and one side falls under the break ratio of the other, the smaller side breaks and its survivors **flip to the winner** (the original map's "winner absorbs the loser"). A tiny swarm (< minRoutSize) fights to the death instead.
- **Power-ups** (timed, per team): Speed, Armor, Frenzy (double damage), Rally (instantly recruits every neutral within a big radius).
- Neutrals trickle onto the map over time so it never runs dry.

## Difficulty
Title-screen picker (Easy / Normal / Hard), persisted in localStorage. Scales rival speed, reaction time, and hunt eagerness; Normal starts the player with 2 extra peasants, Easy with 4. Values in `config.json` → `difficulty`.

## Win / Lose
- Win: all three rivals eliminated, OR the biggest swarm when the 4-minute bell rings.
- Lose: your count hits zero (killed or routed), OR a rival is biggest at the bell.
- Both end screens show stats (recruited, kills, routs, peak size, time) and restart without reload.

## Controls
- Mouse: swarm follows the cursor while it's over the arena. Space = huddle.
- Touch: floating joystick. First touch sets an anchor; the drag vector from the anchor is the direction (magnitude scales speed via the arrive radius); lifting resets. Second finger ignored. On-screen HUDDLE button.
- Keyboard: WASD/arrows nudge the target; P pause; M mute; 1/2 pace.

## Entities
peasant (neutral / player / 3 AI colors) · tree and rock obstacles (circular collision, agents slide around) · neutral camps (dirt patch) · power-ups (4 types) · particles · floaters · banners.

## Screen layout (16:9 desktop)
Full-bleed canvas, camera follows your centroid, zoom scales with viewport (0.7 on phones, 1.0 desktop). Top bar: team chips (swatch + name + live count), timer, pace/pause/sound. Bottom-right minimap. Bottom-left active buffs. Portrait phone: same, with the huddle button bottom-center.

## Art
Procedural pixel art drawn in code (`src/sprites.js`): 10×11 peasants with tunic in team color, 2 walk frames + lunge frame, cached per team and flipped. Grass tiles (3 variants), dirt camps, trees, rocks, power-up icons. Chunky 2× scale, imageSmoothing off.

## Sound
All WebAudio synthesis (`src/audio.js`): recruit pop, pitchfork hit, death cry, rout horn, power-up chime, elimination sting, win/lose fanfares, ambient battle drum while engaged.

## Performance bar
300+ agents on screen at steady 60fps; 700 total agent cap. Spatial hash (48px cells), one neighbor gather per agent per frame, zero per-frame allocation in hot paths, pooled particles. `?debug=1` exposes `window.PSS` and keeps simulating in background tabs.

## Tuning
Everything in `config.json`: world size, spawn density, agent stats, flock weights, combat ratios, power-up values, AI personalities, timer. Retunable without code changes.

## Asset manifest
See `LICENSES.md` — 100% owned (procedural art + synthesized audio + Google Fonts UI font).
