# Into the Fold: LATER

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
- Restart glide (M1 snaps the flock home; a quick herd-back glide would read better, but sheep would cross rocks on the diagonal).
- Phone layout: at 375×812 the board sits centred with open sky above and below it. An M2 art pass could put the pasture backdrop in that space, or anchor the board under the HUD.
- In-progress daily across midnight: M1 lets it finish and swaps on the next page show. M2 should decide whether a daily finished after midnight still counts for the streak.
