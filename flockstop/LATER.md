# Flockstop: LATER

Out of v1 by design (from the Phase 0 contract):
- Archive of past days
- Accounts / global leaderboard (Supabase project queue)
- Wolves, sheepdogs, one-way gates, ice
- Themed weeks
- CrazyGames SDK (reuse Peasant Swarm's portal kit once it's on GitHub)
- Hints
- Level editor

Found during the build:
- Two-black-sheep boards (a "Sunday special"): a faster solver would be needed first (bitboard state, not strings). With the current solver, 4% of those layouts hit the 250k cap. Measured in M0.
- Hints via solver distance-to-win: the solver already computes every state's distance, and the worst baked board solves in 140 ms.
- Practice difficulty picker: practice is already baked as seven weekday-kit slices, so filtering by kit is free.
