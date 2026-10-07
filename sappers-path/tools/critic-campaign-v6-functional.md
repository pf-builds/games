# Functional critic: Sapper's Path campaign v6 lane A (Challenge Mode), branch campaign-v6 @ 2474574

One round. Served on 127.0.0.1:8471 (serve.py). Scripts, raw output and 5 screenshots are in `tools/critic-campaign-v6-functional/`
(`analyze.js` A-E, `spectrum.js`, `find.js`, `run.mjs`, `run2.mjs`, `run3.mjs`, `*.json`, `run.out`, `shots/`). Nothing in game code or data was touched.

## Verdict

**Not ready to call the difficulty goal met.** The rules, stored orders, quests, saves, mobile and console checks all pass, with no
functional bugs found. The problem is the measuring stick. Every tag and ceiling was gated on the careful player
(3 taps deep, all-seeing). That player is non-monotone: on several of the "walls" it scores 0 while a 1-deep player wins
100% and the honest 1-ply lookahead player (`grade.js greedy`, which the file itself calls "a human proxy") wins 50-95%. So the
claim that "191-199 and 176 are close to walls" doesn't hold for a simple player, and the late game is uneven: some levels are
real walls and some are pushovers wearing an Extreme tag.

## selfTest
`SP.selfTest()`: **918/0 at 1280x720** (11.7 s) and **916/0 at 375x812 3x touch** (8.8 s). Notes §3.5 says 932/934. That was
before the quests merge, which collapsed the 16-check long-tail block (§4.6), so the counts are consistent. 0 fails.

## Findings

### BLOCKING

**B1. The difficulty gate (careful player, depth 3) doesn't track difficulty. Several 150+ Extreme and Hard levels are easy for a simple player.**
- Depth sweep, 32 fresh-seed games each (`analyze.js E`):

  | Level | Depth 1 | Depth 2 | Depth 3 |
  |---|---|---|---|
  | 176 X | 1.00 | 0.41 | 0.00 |
  | 185 X | 1.00 | 0.03 | 0.03 |
  | 192 X | 1.00 | 0.28 | 0.00 |
  | 80 H | 0.53 | 0.00 | 0.16 |
  | 64 H | 0.00 | 0.28 | 0.00 |

  Thinking deeper often does worse. Save/load round trips are exact (4,127 checks, 0 bad), so this is the player model and not a sim bug.
- The stored honest 1-ply lookahead rate (`grade.<tag>.greedy`, which the bake already wrote) is at least 0.5 on **18 of the 48 non-Easy levels from 150**:
  156, 157, 169, 170, 171, 175, 176, 177, 178, 184, 185, 187, 190, 192, 193, 195, 196, 198. Highlights:
  - 192 X: 0.95
  - 157 X (the first two-lock level): 0.84
  - 198 H: 0.78
  - 185 X: 0.71
  - 196 X: 0.70
  - 195 H: 0.64
  - 193 X: 0.62
- An honest sampling planner (`grade.plan`, 4 samples, sees only what a player sees, 8 games) wins **191-199 at 0.62-1.00**, with 7 of 9 at 0.875 or more. It wins 200 at 0.75.
- Across 1-200, 92 non-Easy levels have greedy or obvious above their tag's careful ceiling: 29 Normal, 34 Hard, 29 Extreme. The list is in the analyze output.
- Why it's blocking: the brief's goal is "150+ extremely hard, 200 the end game." Levels 176, 185 and 192 are won 30 of 30 by "send the squad that leaves the fewest blocks and doesn't jam." 192 is a final-stretch Extreme.
- Fix: gate each level on the max of careful, obvious and greedy (or the honest planner) against the tag ceiling, then re-deal the levels that fail. 176, 185, 192, 157, 193, 196, 198 and 195 first.
- Repro: `node tools/critic-campaign-v6-functional/analyze.js E` and `node tools/critic-campaign-v6-functional/spectrum.js`.

### SHOULD-FIX

**S1. Stored careful grades carry selection bias from a single seeded measurement.**
- Re-run with the stored seed: 20 of 20 reproduce exactly.
- With 3 fresh seeds on the same 20 random levels, the mean goes from 0.260 stored to 0.298 fresh.
- Two levels cross their ceiling on fresh seeds:
  - 10 Normal: stored 0.563, fresh 0.875 / 0.875 / 0.813 (ceiling 0.75).
  - 117 Extreme: stored 0.188, fresh 0.563 / 0.188 / 0.25 (ceiling 0.25).
- 134 Hard: stored 0.000, fresh mean 0.167.
- The tuner picked candidates whose one 16-game draw came out low. Fix: grade the final pick on fresh seeds before installing.
- Repro: `analyze.js B`; results in `B.json`.

**S2. No coach line or toast for two locks.**
- On 157, the first two-lock level, `#coach` is empty (seen at both sizes). Same on 159 and 160.
- The player meets 3 of 5 spaces open, a key socket and a colour socket, with no words. Every other new rule (lock at 53, key lock at 87, pin at 64, kill at 66) has a line.
- Repro: open 157 from the map with 1-156 cleared and read `#coach`.

**S3. Level 11, the first Hard, is a near-wall three levels after the tutorial.**
- careful 0/16, obvious 0.10, random tap 0.75%.
- Realm 1 Hard careful mean is 0.06 against the curve's 0.50 aim.
- It is fine for the honest planner (won on the first try), but it is a sharp spike for a new player in the "gentle" realm. Consider a softer deal for 11 only.

### MINOR

- **M1. No signal for which archer rule applies on knock-back tower levels.** On 125 (Easy, 1 tower), 187 (Normal) and similar, no toast shows. 125's coach line "Archers shoot inside the red ring. Tower first!" doesn't say these archers only knock back, and the player has already learned pin (64) and kill (66).
- **M2. Notes and curve totals disagree.** `campaign-v6-notes.md` §3.2 says totals "26/73/61/40". The data and the corrected curve both give **25/72/61/42** (counted from levels.json).
- **M3. Stale feature-ladder text.** `config.json v5.density.note` still lists "archer towers 125" while `unlock.tower` is 60. Doc only.
- **M4. Realm 7 plateau.** 157-166 run H X X H X X H X X with no breather (the builder flagged this). The sawtooth reads well everywhere else: each realm ends on X and an E follows each peak.
- **Info.** A tap on the short sheet's Retry within about 0.3 s of the sheet appearing did nothing (first run). After 1.5 s it restarts the level at both sizes. It looks like a deliberate tap guard, so it isn't a finding.

## Checklist results

1. **Rules. PASS at both sizes, with real taps (mouse, and touch at 3x).**
   - 64 (from its map node):
     - The calm toast "Archers pin here..." and the coach line "Archer towers are back!..." both show.
     - Game `00034401114320234340040334444133303444002222222111`: 4 hits, up to 4 sappers shown pinned, released, **won**.
     - Pin jam `2030113132444400340`: "Assault failed / Line jammed: [chips] can't reach a block. Archers have pinned sappers until their towers fall." 10 chips. Buttons: Continue 250, Retry, Back to map.
   - 66:
     - The red toast "Deadly archers..." and the coach line "Deadly archers: bring their tower down..." both show.
     - Kill `224411304240`: short fail with reason `short`. Sheet reads "Not enough [Timber chip] sappers left: archers shot one down." (aria names Timber). **No Continue**, only Retry and Back to map. Retry restarts and the stored order then wins with 0 hits.
   - Two locks:
     - 157 (key + colour), 159 (two colours), 200 (two colours): the stored orders win by real taps.
     - Sockets go `oooLL` to `ooooL` to `ooooo`.
     - 160, whose stored order opens lock 1 first (tap 13): the **right** socket pops alone (`oooLL` to `oooLo`), then the left. Each lock opens its own socket.
   - 200: the boss wins by its stored order (49 taps). Coach "The Goblin King sits in his hall...".
2. **Stored orders. PASS on all 200 levels, not a sample.**
   - Patient replay wins, 0 arrows landed (hits 0, kills 0), 0 refused taps.
   - Taps at most 55, peak at most 5 spaces.
   - Real pace replays at 0 / 1 / 2 / 4 s thinking all win.
   - No power-ups used (engine only).
3. **Difficulty feel. See B1, S3 and M4.**
   - I did not hand-play 12 levels by eye; it doesn't fit a 40-call budget. Scripted players at three strengths stand in, and the honest planner is the "careful human" (fresh tries, no stored order).

   | Level | Tag | Random | Greedy (honest 1-ply) | Obvious (1-deep) | Careful (3-deep) | Planner tries to win |
   |---|---|---|---|---|---|---|
   | 5 | N | 1.00 | | 1.00 | 1.00 | 1 |
   | 8 | N | 1.00 | | 1.00 | 1.00 | 1 |
   | 11 | H | 0.0075 | | 0.10 | 0.00 | 1 |
   | 19 | N | 0.07 | | 0.73 | 0.44 | 1 |
   | 33 | N | 0.04 | | 0.07 | 0.38 | 1 |
   | 64 | H pin | 0.0125 | 0.60 | 0.00 | 0.06 | 1 |
   | 66 | X kill | 0.00 | | 0.00 | 0.06 | 1 |
   | 103 | H | 0.01 | | 0.17 | 0.06 | 1 |
   | 130 | N | 0.09 | 0.09 | 0.67 | 0.44 | 1 |
   | 146 | H | 0.02 | 0.66 | 0.60 | 0.13 | 1 |
   | 158 | H | 0.0025 | 0.47 | 0.00 | 0.00 | 1 |
   | 163 | X kill | 0.00 | | 0.00 | 0.03 | 1 |
   | 167 | E | 0.51 | | 1.00 | 1.00 | 1 |
   | 176 | X kill | 0.0025 | 0.51 | 1.00 | 0.00 | 1 |
   | 185 | X kill | 0.0075 | 0.71 | 1.00 | 0.00 | 1 |
   | 192 | X kill | 0.00 | 0.95 | 1.00 | 0.00 | 1 |
   | 193 | X kill | 0.00 | 0.62 | 0.00 | 0.00 | 1 |
   | 197 | X kill | 0.00 | 0.08 | 0.00 | 0.00 | 1 |
   | 200 | X kill | 0.00 | 0.29 | 0.00 | 0.00 | 2 |

   Random-tap rates are tiny everywhere above Easy, so the levels aren't luck-driven. Strong play is rewarded. 1-8 still teach (every player wins). Breathers (E after X) are felt except 157-166.
4. **Independent careful grades. Reproduce exactly on the stored seed (20/20).** Fresh seeds show the bias in S1. Levels sampled: 7, 10, 38, 47, 62, 67, 78, 90, 96, 113, 114, 117, 134, 137, 156, 164, 179, 188, 197, 198.
5. **Coach lines and tooltips. PASS except S2 and M1.**
   - Lines at the right levels: 53 lock, 64, 66, 87 key lock, 125 towers.
   - Power-up unlocks at the right levels: Ladder 1, Quartermaster 25, Recall 50, Scout 100, Volley 125.
   - The wording reads correctly for the new tags. The coach shows over the toast on 64 and 66, and both are readable.
6. **Side quests. PASS.**
   - 50 in place order with `after` ascending, 6-7 per realm; 62 map entries (50 plus 12 wander).
   - Each node's aria names its prize before play ("prize: one Quartermaster").
   - Played from their nodes by real taps (each with its stored order, won "Picture complete!", prize +1, replay paid nothing):
     - cq34 Ballista (after 80, Hard).
     - cq13 Raven Messenger (after 139).
     - cq03 The Big Key (after 192, Hard, past 150).
     - Kept g07 Cake Castle (after 168): plays its stored gallery order.
7. **Saves. PASS.**
   - The v5.4-shaped save: 180 done, gal with 3 kept and 2 dropped ids, best, coins 1234, inv, got, last, tail on a dropped id, settings.
   - It loaded with no errors. 180 done kept, the kept clears (g01, g12, noto-1f432) survive, the dropped ids are gone, tail is empty, coins 1234.
   - The map shows the kept quest nodes as won. `SP.code()` gives 1,010 chars.
   - Hold-to-reset works at both sizes (120 done to 0, coins back to 400).
   - SP1 decode was not independently tested (`Save` isn't global); the selfTest covers the code round trip.
8. **Economy. Plain read: enough, with one catch.**
   - First-clear coins by level: 1,830 by 49, 4,140 by 99, 6,630 by 149, 9,135 by 190, 9,975 by 200, plus the 400 start.
   - A player who hasn't spent much reaches 150 with about 5-7k coins, which is 20-28 continues at 250 or several Ladders (120). Volley (750) is an occasional treat.
   - Replays pay only 5-30 a win, so once spent the bank refills slowly. That fits "almost requiring gold".
   - The catch: a continue is offered only on a jam. On the killing levels (every Extreme with towers, 34 of them, 26 from 150) a short fail is Retry only, so coins can't rescue the commonest late-game loss.
9. **Mobile and desktop. PASS.**
   - All rule, lock, quest and boss checks ran at 375x812 3x touch and 1280x720 mouse, with the page reloaded for each size.
   - **0 console errors or warnings** across both full runs: full wins (66, 157, 159, 160, 200, 4 quests), a pin-level win (64), a kill short fail (66) and a jam (64).
10. **Payload and load time. PASS, unchanged in kind.**
    - levels.json is 975,646 B (was 1,000,861, -2.5%).
    - gallery.json is 256,849 B (was 221,795, +16% for the 26 new pictures).
    - Page load is 17 requests, about 2.67 MB, ready in about 180 ms locally.
