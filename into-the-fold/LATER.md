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
- Phone layout: at 375×812 the board sits centred with open sky above and below it. M2 added clouds and hills to that space; a later pass could use it for something useful (a pens-filled row under the board, or a larger board on tall phones by trimming the fence margin).
- (Resolved in M2) A daily finished after midnight still counts for its own day: the streak runs on puzzle numbers.
- Result panel close ("See board"): the finished daily's result stays up, so the player can't admire the penned flock. A close button plus a "Result" item in the menu would do it.
- Hint pacing: first-time hints advance on each counted swipe. If playtests show players miss one, advance on the second swipe instead, or show all unseen ones stacked.
- Practice resume across a reload (M2 keeps an unfinished practice board in memory only; the index only moves on a finish).
- `prefers-reduced-motion`: skip the trot bob, the hops and the flock jump.
- Haptics: `navigator.vibrate` on pen and splash for Android.
- Share preview image (a tiny rendered board of the final state, no directions) for the share sheet.
