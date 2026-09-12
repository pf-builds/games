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

---

# DeJam v2 "Big Lot" (approved 2026-09-11)

## What changed
- **Side-street exits.** Besides the taxi's glowing exit, each lot has 1–3 grey side streets on
  the walls. Any blocker in that lane can be slid out through it and is gone for good (poof, lane
  clears). The taxi only leaves through its own exit; blockers never use the taxi's. The solver
  treats "slide out" as one move, so par is still the machine minimum.
- **Four tiers, four lot sizes.** Easy 6×6 · Medium 7×7 · Hard 8×8 · Expert 9×9, 15 baked levels
  each (60). Vehicle counts, par ranges, exit counts and budget slack are per tier in config.json.
- **Moves budget.** HUD shows MOVES LEFT = par + tier slack (Easy +8, Medium +6, Hard +4, Expert +3).
  Undo restores the board but does not refund the move. Hitting zero unsolved = "Out of moves"
  overlay → Try again (same lot, fresh budget) / Level select. Stars: ≤ par 3★, ≤ par+2 2★, else 1★.
- **Endless is a streak.** Lot size ramps with the streak (config `endless.ramp`: 6×6 for lots 1–3,
  7×7 for 4–7, 8×8 for 8–12, 9×9 after). Same budget rules; one loss ends the run. Best streak is
  saved locally and shown on the title. Lots come from a baked **Endless pool** (12 per size in
  levels.json) served under a random one of the 8 board symmetries (par is invariant), so they're
  instant and always at the tier's real par. Runtime generation (seed + time-boxed hardening)
  remains as the fallback if the pool is missing.

### Balance note (measured 2026-09-11)
Hill-climb hardening that took 6×6 lots to par 14–22 in v1 stalls on 8×8/9×9 under the BFS state
cap (most runs sit at par 5–9; one in ten reaches 14). Side exits also lower par by design. So the
big tiers get their difficulty from density, exits and a tight budget rather than deep par:
Baked result: Hard 8×8 = par 7–11 with 15–19 cars, Expert 9×9 = par 6–8 with 19–24 cars
(14 of 15 Expert lots are below-range fallbacks), both with 1–2 side streets and slack +4 / +3.
Bake time on the Mac (jsc): 32 min for 60 levels + the 48-lot pool. Config parMin now matches
(Hard 7, Expert 6). Critic's balance read: Expert is "a puzzle, not a coin flip, but a narrow one":
only 4–6 of its 19–24 cars move in the minimal solution, so it plays as a read-the-chain planning
test under a +3 budget rather than a deeper puzzle than Hard; no Expert minimal solution uses a
side street (Hard: 3 of 15 do). Candidates for a v2.1 pass: Expert slack +4, or a generator
constraint that forces one slide-out into the minimal line. The baker ships a below-range fallback (par ≥ parMin−2, still solver-
verified) after 10 failed rounds rather than dying; the bake log reports how many.
- **Tap-to-slide never ejects a blocker.** A quick tap sends a car to the wall; leaving through a
  side street takes a deliberate drag past the edge. (Functional critic: a stray tap was a third of
  Expert's budget.) The taxi may still tap out to win.
- **Baker runs without node:** `tools/bake.sh` (macOS JavaScriptCore) or `node tools/bake-levels.mjs`;
  both run `tools/bake-src.js`. Level records now carry `board` and `exits[]` (v1 `exit` still loads).

## Data
Level `{ board, tier, par, exits: [{side, index, goal}], vehicles: [...] }`. Save keys are
namespaced by the levels.json version, so v1 bests never masquerade as v2 records.

## Debug (`?debug=1`)
`window.DJ`: `cur`, `start(tier, n)`, `endless(streak)`, `move(i, to)` (to > N−len or < 0 slides
out), `bounds(i)`, `solve()`, `levels()`, `cfg()`, `progress()`.
