# DeJam — deferred ideas (out of demo scope)

- Hints / solver-assist button (solver already exists; UI deferred)
- Daily challenge with shared seed + streak
- Themes/skins (night mode city, seasons)
- Move-replay / share-your-solution
- CrazyGames SDK integration + portal submission pass
- Larger boards (7×7) for an "expert" tier
- GLOBAL leaderboard (cross-device, all players): needs backend — this is the designated first Supabase learning project from the Field Map (one table + one edge function). Local per-device records shipped 2026-08-31 instead.

## DeJam v2 "Big Lot" — next forge (Peter, 2026-09-04)
Contract-ready scope for a /game-forge run:
- **Multiple exits.** Lots gain 2–4 exit gaps on the walls, not just the taxi's. Any car pushed
  fully into an exit leaves the lot permanently (satisfying poof, lane clears). Exits can be
  placed by the generator so that some blockers are removable and some must be shuffled.
- **Bigger lots, more cars.** Level tiers scale lot size (6×6 → 7×7 → 8×8 → 9×9) and car count.
  Generator: keep the existing solver-verified reverse-shuffle approach; add exit-aware moves
  (a car that leaves through an exit is a legal "move" in the solver) so every level stays
  provably solvable and the minimum solution length is known.
- **Turn budget instead of par.** Each level shows MOVES LEFT (solver minimum + slack that shrinks
  with tier: e.g. +8 early, +3 late). Run out = LOSE, retry the same board. Stars can stay
  (finish under min+2 = 3★) but the pressure is the countdown, not a par number.
- **Endless stays**: procedural lots with the same rules; a Last Stand-style "how many lots can
  you clear" framing, one loss ends the streak.
- Out: new vehicle types, timers, story.
- Critic bars: every generated level solvable within its move budget by the solver; no level
  where an exit trivializes the board (solution ≤ 2 moves) past tier 1; touch drag still works
  on 9×9 at 375 px wide.
