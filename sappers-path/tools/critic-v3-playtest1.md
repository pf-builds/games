# Sapper's Path v3 playtest-1: functional critic (critic 2)

Build: branch `sappers-path`, HEAD 83672f4, `?v=12`, served on :8492. Scratch code: `/private/tmp/claude-501/sp-critic2/` (`mine.js` re-implementation, `diff.js`, `pace.js`, `exploit.js`, `page.mjs`, `win.mjs`). Frames: `tools/shots-v3-critic2/`.

**Verdict: PASS WITH FIXES.** The timed dispatch engine matches an independent re-implementation exactly under patient play (225 games, 6,438 checkpoints, 0 divergences) and under 600 rushed fuzz games once three SPEC ambiguities are pinned to the engine's reading. All four of Peter's notes hold in the real page. No blockers. Two majors: the level-3 coach tells the player something false about the new core rule, and "rushing is never easier" is false for a player who times their taps.

Counts: 0 blocker, 2 major, 6 minor.

Disclosure: to learn the level format, I read the header comment of `src/engine.js` (lines 1-12 and 25-36) before writing `mine.js`. Those lines also contain a few rule sentences, including the hit time formula. Because I had seen it, I ran my SPEC-literal reading and the engine's reading side by side and report both. I did not read `tools/ref.js` or the engine body.

## Checks

| # | Check | Result |
|---|---|---|
| 0 | `SP.selfTest()` at 375×812 | 528 pass, 0 fail, 790 ms, 0 console errors |
| 1a | Re-implementation: stored orders, patient (tap, quiet), Easy/Normal/Hard, all 75 levels | 225 games, 6,438 state checks after each tap and after each quiet (grid, pixLeft, line [mat, waiting, out], status, reason, engine time). **0 divergences.** Engine time at every quiet matches, and the final times equal the baked `grade.normal.ms` |
| 1b | Rushed fuzz, 600 games (every level × 3 difficulties × gaps 0-300 ms / 0-1 s / 0-3 s / 0-6 s), 8,000+ checkpoints | Engine's reading of the ambiguities: 5/600 divergent (all Hard "short" timing, where the engine is right; see m1). My SPEC-literal reading: 63/600 divergent, all on Era 3 archer levels (51+). **Every non-archer level: 0 divergences on every reading.** See m1 |
| 2.1 | Note 1: a second tap leaves the first squad working | PASS. L1 Normal: tapped Diggers, then a second Diggers card 700 ms later. Line right after the second tap: `[Diggers 0 waiting/8 out]`, `[Diggers 7/1]`. 1.8 s later both are still out, runners 9→13, pixels 43→31. Strip `strip-n1-second-tap.png` (6 frames, 300 ms apart) |
| 2.2 | Note 2: 1× slower than 2×, 2× not frantic | PASS. Measured 1,500 engine ms per 1,503 wall ms at 1× and 3,000 per 1,501 at 2×. Walk is 80 ms a tile at 1× and 40 at 2×. At 2× on L40, 3 squads still take about 1.5 s to go out and come back, and the fort barely changes. Readable, not frantic (`strip-2x-l40-plus-fullline.png`) |
| 2.3 | Note 3: spam overflows with a clear reason | PASS. L20 Normal, 6 card clicks 150 ms apart. The 6th tap fails. After the squads come home (1.5 s), the sheet reads "Assault failed / Too many squads out: no space left for the Miners." (`n3-overflow-sheet.png`) |
| 2.4 | Note 4: a squad bigger than N open sends exactly N, the rest wait visibly | PASS. L3 Normal: Sawyers 10 with `SP.reachable(4)` = 4. The line goes 9/1, 8/2, 7/3, 6/4 (120 ms stagger), stays 6 waiting / 4 out through the pops, and 6 wait at the space as the card count (`strip-n4-dispatch.png`, 8 frames, 400 ms apart). Played patiently, the waiting 6 go once the Diggers open more timber (patient diff, L3). The waiting sappers show only as a number, not as figures (m5) |
| 3 | Exploits: rushing, timing, a stuck squad freed by another colour | **Timing beats patience on 9/34 saw2/hard/hardest levels** (M2). A stuck squad freed by another colour is the rule as written in §9 ("whoever opened it") and costs a space, so it isn't an exploit. Blind spam fails (note 3) |
| 4 | Pacing claim (median 97 s, max 179 s, early 41-69 s) | Times reproduce exactly on 12 sampled levels. From `levels.json`: median **89.2 s** (not 97), max 179.4, levels 4-15 40.8-69.2, L1 21.1. Where the dead time is: see m3 |
| 5a | Coach text on levels 1, 2, 3, 26, 51 under the new rules | 1, 2, 26, 51 are true. **Level 3 is false** (M1) |
| 5b | Full-line danger and fatal marks | PASS. L46 Normal, 5 rapid taps: `#line-wrap.full`, 5/5, every live front card `.fatal` with a red ×, "No free space: wait for a squad to get home". Wording nit in m4 |
| 5c | Win and fail sheets after settling | PASS. L4 Easy: last tap → won 8.4 s → all home 11.2 s → sheet 13.4 s ("Fort razed!"). L12: 2.2 → 3.5 → 5.9 s. The overflow sheet waited until out = 0 |
| 5d | Retry mid-show | PASS. L5, 700 ms into a 23-sapper show (6 runners): Retry leaves line [], runners 0, plays 0, pixLeft back to 168 |
| 5e | Skip (board tap) | PASS. busy false, runners 0, line [] right after |
| 5f | Map, save, mute | PASS. The save writes `done`, mute persists across a reload (aria-pressed true/true). A win on a still-locked level was dropped on reload, which is the documented rule |
| 5g | Pause on blur | PASS. Blur pauses. Engine time held at 249 ms over 800 ms of wall time, the Paused sheet shows, and the resume tap unpauses without playing a card |
| 5h | Portal shape | PASS. Fresh save: one click on Play reaches `screen: play`. 0 external requests in any context |
| 5i | Console errors at 375×812, 812×375, 1280×720 and 400×600 iframe (Play + 3 taps + show) | 0 errors and 0 warnings in all four |
| 5j | p95 frame time, 3 rapid taps | L65 1×: 16.7 ms, L65 2×: 16.8 ms, L70 1×: 16.7 ms (max 16.8) |
| 6 | Visual pass at 375×812 (waiting, runners, carry, haul) | Readable. Runners are coloured by crew, carried blocks read, and bins fill. The yard gets busy with 3 squads but stays legible (`strip-vis-l40.png`). Line badge legibility in m5 |

## Findings

### Blockers
None.

### Major

**M1. The level-3 coach states a false count under the new rule: "10 Sawyers, 16 timber in reach: 16 go."**
- Repro: `?debug=1`, `SP.load(3,'normal')`. The coach reads "10 Sawyers, 4 timber in reach: 4 go." (correct). Tap the stored first move (col 1, Diggers) and wait about 1.2 s. The coach now reads "10 Sawyers, 16 timber in reach: 16 go."
- Cause (config): `config.json` `teach.e1-03[0]` is `"{n} {crew}, {reach} timber in reach: {reach} go."` with `"if": "short:4"`. The `if` is only checked when the step comes up. The text re-fills live after more timber opens, and "{reach} go" is not min(n, reach).
- Why it matters: this is the level that teaches the foundational pillar, and it tells the player 16 go from a squad of 10.
- Fix: say `min({n},{reach})` go, and drop or re-word the step once `reach ≥ n`.

**M2. "Rushing is never easier" (§9, notes, `tools/rush.js`) holds only for random tapping. A player who times their taps beats patient play on several late levels.**
- Method (`exploit.js`, 150 games per cell, Normal, same noisy greedy card choice for both players):
  - Patient: tap the card whose squad can send the biggest share now, then wait for quiet.
  - Timed rusher: taps whenever a space is free and some front squad can send its whole count right now; otherwise it waits (checks every 400 ms, or 120 ms for "rush-fast").
- Results, patient → timed:

  | Level | Band | Patient | Timed | Timed fast |
  |---|---|---|---|---|
  | L59 | hardest | 0% | 17% | 13% |
  | L63 | hard | 15% | 33% | 39% |
  | L48 | hard | 51% | 60% | 71% |
  | L52 | hard | 33% | 48% | 44% |
  | L66 | hard | 75% | 89% | 90% |
  | L49 | hardest | 5% | 12% | 11% |
  | L61 | hard | 23% | 25% | 34% |

  The timed player is better by more than 5 points on 9 of 34 saw2/hard/hardest levels (27, 48, 49, 52, 59, 61, 63, 66, 74). It is worse on others (L33 99%→59%).
- Consequences:
  - Bands, lookahead rates and "hardest" labels are all graded on patient play only, so they misstate difficulty for the natural way to play (overlap taps).
  - A patient-graded 0% level (L59) is beatable by timing.
- Peter's note 3 is not violated: blind spam still fails. But the SPEC claim is false, and the bake has no rushed or timed grade.
- Fix: at minimum, correct the claim in §9. Better, add a timed-player rate to the grade and band on the max of patient and timed.

### Minor

**m1. SPEC §9 is ambiguous in three places my re-implementation had to guess. The engine picks one reading each time, and the SPEC should state it.**
- (a) "hit halfway out". The engine lands the hit at dispatch + yardMs + ceil(tiles/2)·tileMs. The literal half of the walk, (yardMs + tiles·tileMs)/2, is different.
- (b) When the squad turns wary. The engine makes it wary at dispatch of the hit-bound sapper, so no second sapper follows it into the ring. The SPEC sentence reads as if it happens at the hit.
  - With wary-at-hit, 60+ of 600 rushed games diverge (grid, line and pixLeft on L51-L75 archer levels). Example: L57 Easy, taps `[[4,858],[1,1351],[0,3684]]`. At t=3684 the out counts are 10 (mine) vs 7 (engine) and pixLeft 261 vs 259.
- (c) "a colour left with fewer sappers than pixels". The engine counts only sappers who can still eat, excluding carriers already walking home. A literal count includes them.
  - L68 Hard, taps `[[3,3764],[4,6819],[1,9050]]`: the engine fails "short" at the first kill (t < 9050) with 9 out + 66 in the tray vs 75 pixels by the literal count.
  - My literal model later ends at 67 pixels vs 66 sappers without ever calling it short.
  - The engine's reading is the right one. The remaining 5/600 divergences are all this.
- Also: "no move" is worded as "every space held by a squad that can't move" in §9 but "every front card would overflow" in the engine header. They are equivalent only while `mergeLeftovers` is false.

**m2. The duration claim doesn't match the data.** The notes and §9 say median 97 s. The shipped `levels.json` grades give median 89.2 s (max 179.4 s, levels 4-15 40.8-69.2 s). The numbers are actually closer to target, but the doc is stale.

**m3. Pacing: patient play has long stretches with no block breaking.** Measured with `pace.js` on 12 levels, stored Normal line, 1×:
- **Carry-home tail.** The time after a tap's last pop until everyone is home is 22-38% of the level: L1 8.1 of 21.1 s, L58 41.6 of 148.8 s, L66 52.5 of 154.3 s. The player can't safely reuse the space during it.
- **First-pop lag** (tap to first block) adds 6.8 s on L1 and 34.7 s on L66 (about 1.3 s a tap).
- **Longest single-tap waits:** L22 36.4 s (19 gaps between pops of more than 1 s, max 2.8 s), L74 26.7 s, L58 25.9 s, L40 25.3 s.
- **End of level:** L4's last tap takes 8.4 s to win and 13.4 s to reach the sheet.
- The waiting is only dead if the player plays patiently. M2 shows overlap pays, so a real player will fill it. That makes M2 and this one design question: is timing the intended skill?

**m4. The full-line text can mislead.** Repro: L46 Normal, 5 rapid taps. Three of the 5 spaces hold squads with nothing in reach and 0 out (`Hexbreakers 12/0, Masons 4/0, Axemen 7/0`), yet the line says "wait for a squad to get home". Those three never get home on their own.

**m5. The line badge doesn't say which number is which.** Each space shows a big number (waiting) and a small ▲n (out) with no legend. The waiting sappers are drawn only as that number, never as figures at the space. It's readable once learned, but not self-explaining at 375 px (`strip-n1-second-tap.png`, `strip-vis-l40.png`).

**m6. `SP.state().line` and the engine use `spW`/`spO` with no doc of meaning in the notes' facade section.** Critics and harnesses have to guess which is waiting and which is out. Add a line to `v3-playtest1-notes.md`.

## Evidence files (`tools/shots-v3-critic2/`)
- `strip-n1-second-tap.png` (note 1)
- `strip-n4-dispatch.png` (note 4)
- `n3-overflow-sheet.png` (note 3)
- `strip-2x-l40-plus-fullline.png` (2× pace and the full line)
- `strip-vis-l40.png` (1× visual)
- `full-line-375.png`
- `vp-375x812.png`, `vp-812x375.png`, `vp-1280x720.png`, `vp-iframe-400x600.png`
- the individual frames behind each strip
