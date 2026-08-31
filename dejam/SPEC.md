# DeJam — Build Spec (v1, approved 2026-08-31)

Sliding-block traffic puzzle. Week-1 pipeline-shakedown game for the studio division.

## Mechanic
- 6×6 grid. Vehicles (length 2–3) locked in, each slides only along its own axis.
- Goal vehicle is a **yellow taxi**; the **exit position varies per level** (any wall, aligned with the taxi's lane).
- Slide vehicles to clear a path, drive the taxi out through the exit notch. Each completed slide gesture = 1 move.
- No lose state (genre-standard): stuck = undo/reset. "Complete loop" = start → play → win → next/restart without reload.

## Content
- 30 pre-baked levels shipped in levels.json (baked by tools/bake-levels.mjs, deterministic seed): 10 easy (par 4–8), 10 medium (par 9–13), 10 hard (par 14+, reached via solver-verified hill-climb hardening); par = solver minimum. The in-browser generator only runs for Endless mode.
- Endless mode: random-seed levels at medium/hard tier.
- Progress + best-move counts in localStorage (wrapped in try/catch, page fully works without it).

## Controls
- Pointer events: drag a vehicle along its axis, clamped by obstacles, snaps to cell. Mouse and touch identical. Undo (stack), Reset, Back.

## Screens
Title (Play / Levels / Endless / sound toggle) → Level select (tier tabs, stars: solved / solved-at-par) → Game (HUD: level, moves vs par, undo, reset, back) → Win overlay (moves vs par, next level).

## Layout
Mobile-first portrait (375×812): HUD top, square board centered, controls below. Desktop 16:9: same column centered. Canvas DPR-scaled.

## Entities
Vehicle {x, y, len 2–3, horiz, isGoal, colorIdx}. Exit {side, index}. Board 6×6.

## Assets
- All art canvas-drawn (flat rounded rects, windshield details, taxi checker stripe). Zero downloads.
- All audio WebAudio-synthesized (slide click, blocked thud, win arpeggio). Zero downloads.

## Tuning (externalized in config.json)
Tier par ranges, vehicle-count ranges per tier, generator attempt caps, BFS state cap, palette.

## Quality bar
Standard game-forge checklist, minus lose-state items (N/A per genre), plus: generator must never emit an unsolvable or <4-move level (solver-enforced at generation).
