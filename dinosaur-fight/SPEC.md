# Dinosaur Fight! — SPEC

Concept by Henry (age 5). A 2D side-scrolling platformer: you are a Compy
(Compsognathus) fighting "baddies" (humans with guns). Superpower: grow huge or
shrink tiny, Ant-Man style. Clear all baddies in the level, then reach the exit.

## Visual target
16-bit SNES jungle side-scroller (reference: Jurassic Park 2: The Chaos
Continues, SNES — style homage ONLY, zero names/logos/trade dress).
Chunky-pixel rendering: 480×272 logical canvas, integer-ish upscale,
imageSmoothing off. All sprites are code-defined pixel maps owned by
Click it! Studios.

## Core loop
run right → pounce/stomp baddies → use GROW/SHRINK to solve blockers →
clear all baddies → exit flag opens → fanfare + star rating (eggs) → next level.

## Controls
- Keyboard: ←/→ or A/D move · Space/W/↑ jump (press again = double jump) ·
  X/J = pounce (forward lunge; also stomp by landing on heads) ·
  C/K = GROW toggle · Z/L = SHRINK toggle · P/Esc = pause
- Touch: left/right pad (bottom-left), JUMP + POUNCE buttons (bottom-right),
  GROW + SHRINK buttons above them. All ≥44px.

## Player (Compy)
- 5 hearts. Hit = lose 1 heart + brief invulnerability + knockback. 0 hearts =
  "OUCH!" screen with big TRY AGAIN (restart level, no game-over spiral).
- Checkpoints (C tiles): respawn point on falling in water/pits (costs 1 heart).
- Power meter (0–100): GROW drains while big, SHRINK drains while small; refills
  from eggs and slowly regenerates when normal size.
  - BIG: ~1.9×, stomps kill instantly, bullets bounce off (ding), smash crates.
  - SMALL: ~0.55×, fits 1-tile tunnels, shooter bullets fly over your head.
- Pounce: short forward lunge, kills normal baddies on contact. Stomp: landing
  on a baddie's head. Both trigger comic "poof" — stars, spin-away, NO blood.

## Baddies
- Walker: patrols a ledge, turns at edges. 1 hit.
- Shooter: aims with a visible telegraph line (~1s), then fires a horizontal
  bullet. 1 hit.
- Netter: lobs an arcing net; netted = slowed ~2s. 2 hits.
- Boss ("Big Boss Baddie"): marches, charge attack into walls → dizzy → stomp
  him. 5 stomps. HP bar. Occasional 3-bullet fan.

## Levels (levels.json, tile strings, 16px tiles)
1. Jungle Trail — flat-ish, walkers + 1 shooter, generous eggs. A 5-year-old
   beats this unassisted: no precision jumps, wide platforms.
2. Riverside — water pits, netter debut, a shrink tunnel secret, crate walls
   (grow to smash).
3. Baddie Camp — crate mazes, more shooters, vertical bits, checkpoint mid-way.
4. Boss Arena — flat arena, Big Boss Baddie.

Exit flag stays "locked" (grey) until baddies-remaining = 0; HUD shows count.

## Win/lose/restart
Title → level select (stars remembered, localStorage) → play → win (fanfare,
stars 1–3 by eggs) → next level. Lose → TRY AGAIN → same level. No reload
needed anywhere.

## Assets
All procedural: pixel-map sprites (sprites.js), WebAudio-synth SFX + music
(audio.js). LICENSES.md ledger. Nothing external.

## Tuning
All dials in config.json; level layouts in levels.json.

---

## World 2: Swamp & Cave (v2, 2026-09-03)

Levels 5–8. Each world is three stages plus a boss; the level select has a tab
per world (World 2 unlocks when Boss Baddie falls). Save format `df2` migrates
the World 1 `df1` save (stars + unlocked) on first load.

### New tiles
- `_` **mud** (shallow water at grade): the T-rex stands on it and wades (splashes,
  squelch SFX). Normal and small sink like deep water (1 heart, back to checkpoint).
- `c` **cracked floor**: solid for normal/small. When the T-rex stands on it the whole
  run shivers for ~0.3s and collapses tile by tile. Used as a bridge over mud (the
  T-rex crashes into the mud and strides out) and as the lid of the golden-egg chamber.
- `|` **vine**: only the tiny compy climbs. Hold JUMP to climb, let go to slide,
  move sideways to hop off. Reaching the top pops you onto the ledge. Vines gate
  the shaft in Vine Hollow (crawl in small, climb up, walk off the wall top) and the
  high route in Deep Dark.
- `E` **golden egg**: one hidden per World 2 stage. Fills power, toasts GOLDEN EGG!,
  and hatches on the win screen into a hat.

### New baddies
- **Armored baddie** (`a`): steel helmet and chest plate. Pounce and normal stomps
  just bonk (safe bounce, ding). Only the T-rex flattens him. On-screen hint
  "↑ GROW!" while he's near and you're not big.
- **Swamp Jeep** (`J`, boss of level 8): drives laps, revs (the "!" tell), then
  charges. Flips belly-up when it crashes into a wall OR when the T-rex bumps it.
  Any contact while flipped scores (5 hits). Lobs a net every 5s while driving.
  Eggs in the arena regrow every 9s so a little T-rex never runs dry.

### Roar (V / M, 📣 on touch)
Pure fun button, no cost, 3s cooldown. Normal roar: nearby walkers and armored
baddies panic and run away (they won't leap off ledges, they just shake), gunners
and netters flinch and stop aiming. T-rex roar: bigger radius, RAWR!!!. Tiny roar:
"squeak!", does nothing. Roaring at a boss provokes its charge (useful: aim it at a wall).

### Hats
Golden eggs hatch into hats, one per stage: Party Hat, Miner Helmet, Crown, Race
Helmet. Picked on the level select HATS row (thumbnails of the compy wearing them),
drawn as an overlay on the compy's head at every size. Saved locally.

### Levels
5. **Mucky Marsh** (swamp) — mud debut. Four marshes (4, 9, 10, 4 wide); the first is
   double-jumpable, the rest are wade-only. Golden egg on a 7-high stone pillar
   (T-rex double-jump). Checkpoint mid.
6. **Vine Hollow** (cave) — armored debut, cracked bridge over mud, the vine wall
   (crawlspace → shaft → wall top → stairs), golden egg in a cracked-floor chamber.
   Checkpoint after the wall.
7. **Deep Dark** (cave) — everything: mud, a vine to a high platform holding the
   golden egg and a netter, cracked bridge, 5-high crate wall, two armored, a
   crawlspace mound. Checkpoint mid.
8. **Jeep Jam!** (bog) — flat walled arena, Swamp Jeep, 4 regrowing eggs, 2 hearts.

### Themes
`swamp` (murky jungle + ground mist), `cave` (no sky, rock pillars, stalactite
fringe, glowing fungus, rock-styled ground tiles, stalactite/mushroom decor),
`bog` (dead trees + mist, pale sun) for the arena.

### Tools
`tools/levels-src.js` is the level source. Bake with `node tools/build-levels.mjs`
or, on a Mac without node, `tools/bake.sh` (macOS JavaScriptCore).
