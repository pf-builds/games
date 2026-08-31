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
