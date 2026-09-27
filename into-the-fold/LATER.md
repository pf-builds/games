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
- Phone layout: (M2 fix pass) the column is now centred, the board runs edge to edge and tall phones get a roomier HUD and bigger buttons, so the spare height frames the column (about 90 px above and below at 375×812 with no safe-area insets) instead of opening bands around the board. A later pass could still use it for something (a pens-filled row under the board, or trimming the fence margin on tall phones).
- (Resolved in M2) A daily finished after midnight still counts for its own day: the streak runs on puzzle numbers.
- Result panel close ("See board"): the finished daily's result stays up, so the player can't admire the penned flock. A close button plus a "Result" item in the menu would do it. The M2 critic flagged it again: the card covers the board on phone and desktop.
- Hint pacing: first-time hints advance on each counted swipe. If playtests show players miss one, advance on the second swipe instead, or show all unseen ones stacked.
- Practice resume across a reload (M2 keeps an unfinished practice board in memory only; the index only moves on a finish).
- `prefers-reduced-motion`: skip the trot bob, the hops and the flock jump.
- Haptics: `navigator.vibrate` on pen and splash for Android.
- Share preview image (a tiny rendered board of the final state, no directions) for the share sheet.
- Clock skew (M2 critic): `stats.lastN` is clamped to [0, 1e7] but not to today's #N. A forward-dated save (clock set ahead, then corrected) freezes stats, keeps a stale streak showing and unlocks Practice early. Clamp it to today's #N on load, or reset it when it's in the future.
- Stats tiles overflow their card at the clamped maximum (1e7 in every bucket); only a corrupt save gets there (M2 critic).
- First-time hint lost on reload mid-board: a hint is marked seen when shown, so a reload drops the one on screen, while SPEC says the last one stays until the win. Mark it seen on the win, or save the showing hint with the resume (M2 critic).
