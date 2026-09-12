# DeJam — deferred ideas (out of demo scope)

- Hints / solver-assist button (solver already exists; UI deferred)
- Daily challenge with shared seed + streak
- Themes/skins (night mode city, seasons)
- Move-replay / share-your-solution
- CrazyGames SDK integration + portal submission pass
- GLOBAL leaderboard (cross-device, all players): needs backend — this is the designated first Supabase learning project from the Field Map (one table + one edge function). Local per-device records shipped 2026-08-31 instead.

## Shipped in v2 (2026-09-11)
Multiple exits, four lot sizes to 9×9, moves budget, endless streak — see SPEC.md.

## v3 direction: "Clear the Lot" (Peter, 2026-09-12, playtest of v2)
Peter's original intent for DeJam, closer to Parking Jam 3D (iOS) than Rush Hour:
- **Every car has to leave the lot**, one at a time, in the right order. There is no taxi; the goal
  is an empty lot.
- **Click a car and it drives out** along its axis toward its exit (every lane end is a potential
  exit), unless another car is in the way — then it bumps, stops, and the move is spent.
- **A moves budget** caps how many taps you get to clear the whole lot; order is the puzzle
  (which car is unblocked now, which one unblocks two others).
- Larger lots and more cars per tier, same as v2. The v2 side-street exits, the moves budget,
  undo-without-refund and the streak Endless are all the right substrate; v3 changes the win
  condition and the input model (tap-to-drive instead of drag), and the generator has to bake
  lots where every car has a solver-verified path out within the budget.
- Not building now. Contract-ready once the arcade has a slot for it.

## After v2
- Hints / solver-assist button (solver already exists; UI deferred)
- Timed mode, new vehicle types (trucks, buses that need two lanes), story wrapper
- Exit gates that open only after N cars leave; one-way streets
- Daily challenge with shared seed + streak
