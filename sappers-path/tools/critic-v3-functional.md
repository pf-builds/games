# Sapper's Path v3, M2: functional critic

**Verdict: PASS. 0 blockers, 0 majors, 4 minors.**

Date 2026-09-28. Branch `sappers-path`, build `?v=8`. My server was on port 8492. I didn't edit any game code. Scratch files are in `/private/tmp/claude-501/sp-critic/`: `rules.mjs` (my rules), `diff.mjs`, `rate.mjs`, `pw.mjs`, `perf2.mjs`, `find51.mjs`, `rates.json` and `pw-out.json`.

## How I tested

- **selfTest:** `SP.selfTest()` ran first: **526 pass, 0 fail**, 717 ms. It covers wins 225/225, the overflow on e2-46, the gate on e2-26, and archer hits and kills on e3-51 for Easy, Normal and Hard. Show caps: 3008 ms at 1×, 1504 ms at 2×.
- **Rules re-implementation:** I wrote my own rules in `rules.mjs` from the SPEC-v3 §2–4 and §9 text before reading any of `engine.js`. The only exception was the level-format comment header that §9 points to.
- **Where I diffed:**
  - Against the game's engine in Node: full board, holding line, status and reason at every step.
  - Against the page's `SP.play` / `SP.state()` in headless Chromium: pixels left, line, status, reason and all 5 front cards at every step.
- **Real input:**
  - Playwright real mouse clicks and touch taps on `button.card`.
  - Clicks on the real cards in the Claude Browser pane (my own tab).

## Checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1a | Stored winning orders, every level × Easy/Normal/Hard, through my rules vs the engine | PASS | 225/225 won in both. 0 divergences. |
| 1b | Same through the page `SP.play` vs my rules | PASS | 225/225 won. 0 divergences over 12,512 compared steps. |
| 1c | Fuzz vs the engine (Node) | PASS | 400 random sequences, 16,315 steps, 0 divergences. Outcomes: 209 won, 158 overflow, 27 short, 6 no-move. |
| 1d | Fuzz vs the page `SP` | PASS | 240 random sequences, 0 divergences. Outcomes: 116 won, 99 overflow, 24 short, 1 no-move. |
| 1e | Does the no-move rule match the §9 text? | PASS | See the note below the table. |
| 2a | Random-tap win rate on Normal (300 playouts, **all 75 levels**) vs the §5 bands | PASS with 1 borderline | Levels 1–15: 0.90–1.00. Levels 16–45: 0.32–0.80, saw-tooth. Late hard and hardest slots: 0.00–0.08, except **L58 at 0.103** (MINOR-1). Reliefs 50/55/60/65/70/75: 0.41–0.51. None is more than 3 points off its own `target`, apart from L58. My rates are within 0.086 of the baked rates. |
| 2b | Every level wins on all 3 difficulties | PASS | 225/225, through my rules, the engine and the page. |
| 2c | Board caps and obstacles by era | PASS | Largest boards: Era 1 28×36, Era 2 32×40, Era 3 36×48. Most cards on a level: 53. Gates only from L26. Towers only from L51, on 25 levels. |
| 3a | Title → Play → L1 teaching flow, by clicks | PASS | 1 click reaches play. Coach step 0 says "Tap a squad…" with an arrow on col 0. After the first tap, step 1 says "The faded squads move up next…". The level wins and the panel reads "Fort razed!". Next goes to L2. |
| 3b | Mid-level win: L20 Normal, 48 card clicks | PASS | Won; the panel shows. |
| 3c | Overflow loss: L46 Normal, cards `00432221231` | PASS | Fails with reason overflow. The panel reads "The holding line overflowed: no space left for the Torchbearers." One tap on Retry gives plays 0 and 341 pixels. |
| 3d | Gate: L26 on Normal and Hard, by card clicks | PASS | Won on both. |
| 3e | Archers: L51 on Normal and Hard, by card clicks (Browser pane) | PASS | See the notes below the table. |
| 3f | Retry mid-show | PASS | After plays 1 with the show on, Retry gives plays 0, the show off and 0 runners. Nothing is left running 1 s later. |
| 3g | Tapping the board during the show (fast-forward) | PASS | `showing` goes from true to false within 80 ms. |
| 3h | Tapping cards during the show | PASS | Clicks 60 ms apart win every level tested. |
| 3i | 2× speed | PASS | The same play's show took 1312 ms at 1× and 677 ms at 2×. The toggle state is reflected. |
| 3j | Map, back, continue | PASS | The map button opens the map, which shows the count. Map Play opens the first unwon level, and Home returns to the title. |
| 3k | Difficulty switching on the map | PASS | Hard, then Play, opens the level with diff hard and a holding cap of 4. The caps read 6/5/4 across all 225 loads. |
| 3l | Mute persists over reload | PASS | `settings.muted` true is written, survives the reload, and the button shows `aria-pressed="true"`. |
| 3m | Save survives reload | PASS | `done` is kept. Wins on still-locked levels (made through the debug `SP.load`) are dropped in memory on load, as §9 says. |
| 3n | Corrupted save | PASS | See the note below the table. |
| 4a | 375×812, mobile preset, touch, reloaded | PASS | Page is 375×812 with no scroll. Title Play is 1 tap. Level 1 wins by taps. p-primary is 164×48, Retry and Map 42×42, all hit-tested. The L75 board is 342×409 CSS px at 9.5 CSS px a cell. All 5 cards are fully on screen. The Browser pane matches this (Android UA, 5 touch points). |
| 4b | 812×375, touch | PASS | No scroll. 1 tap to play. Level 1 wins. Buttons hit-tested (Retry and Map 38×38). All 5 cards are on screen. |
| 4c | 400×600 iframe (`tools/iframe-host.html`) | PASS | 1 click to play. The L75 cell is 9 device px, which is 9 CSS px at DPR 1. Retry and Map hit-tested. |
| 4d | Pause on blur and resume, zombie timers | PASS | Focus moved to the host button: `paused` true, and the clock and `showT` frozen for 1.5 s. The next tap in the frame unpauses and **plays no card** (plays 1 before and after). The clock then advances 999 ms per 1 s, and the show finishes. |
| 4e | Hidden-tab load | PASS | Loaded with `document.hidden` forced true and rAF held. Driven only by `SP.tick`, it reaches the title. selfTest passes 526/0, and L5 wins through `SP.play` + `tick`. |
| 4f | External requests | PASS | 0 in every Playwright context and in the Browser pane. Every request is same-origin, and every one carries `?v=8`. |
| 4g | Console errors and warnings | PASS | 0 in every context: the diff, play, 3 viewports, the iframe, the hidden tab, perf, the 6 corrupt saves, and the Browser pane. |
| 5a | `?v=` on scripts, CSS and fetches | PASS | 6 scripts, `style.css`, the font preload and the `@font-face` URL all carry `?v=8`. The two fetches (`config.json`, `levels.json`) use `?v=` from `currentScript` plus `cache: "no-cache"`. |
| 5b | `index.html` revalidates | PASS | A `Cache-Control: no-cache, must-revalidate` meta tag, and the server sends `no-store`. |
| 5c | No `setTimeout` for state | PASS | Grepping `src/` finds no `setTimeout` or `setInterval`, only the comment in main.js:10 saying so. |
| 5d | Bounded loops | PASS | Every `while` in main.js and board.js has a cap: tick at 600 s, the selfTest waits at 8 s and 20 s, the route walk has a guard, and the launch and pop loops are bounded by counts. Engine resolution was bounded in 16k fuzz steps (my own cascade has a hard guard, and it never tripped). |
| 5e | selfTest runs through the player's entry points | PASS | `SP.play` is `playCol`, the function the card tap calls, and selfTest replays `playOrder` through `playCol`. |
| 5f | `elementFromPoint` on primary buttons | PASS | selfTest covers it. I also checked it myself on p-primary and p-secondary (the win panel's Next and Retry), Retry and Map at 3 viewports and in the iframe. |
| 6 | Performance: busiest play | PASS | See the table in the next section. |

**Notes on the rows above**

- **1e, no-move rule.** The game matches the §9 text:
  - A card is dead if its colour has no reachable uncovered pixel, there's no line entry to merge into, and the line is full.
  - On Hard, a card is also dead if it would be killed.
  - I also ran a stricter variant: a card is dead if playing it fails at all (for example, it eats 2 pixels and then overflows). It differed in 8 fuzz positions. The game follows the text, not the stricter reading. See MINOR-3.
- **3e, archers on L51.**
  - **Normal:** tapping col 1 (Masons 13) first gets all 13 hit, and they wait in the line. The coach reads "Archers shoot the red ring. Tower first!". Tapping Quarrymen then brings the tower down, the Masons resume, and the line empties. The level then wins in 6 plays.
  - **Hard:** tapping col 1 first kills 13, and the level fails "short" at once, with the hit show still running. Retry mid-show restarts clean.
  - The stored orders win on both difficulties.
- **3n, corrupted save.** I tried six bad saves, one at a time, reloading after each:
  - `{garbage`, `null`, `[]` and `"str"`
  - `{done:5, settings:null}`
  - `{done:{e3-75:7, zz:1}, diff:"insane", …}`

  Each one loads to the title with diff normal and done 0. Play reaches L1, and there's no console output.

## Performance

Frame times are rAF deltas measured during the show at 1280×900.

| Play | Speed | p95 frame | Max frame | Draw cost |
|---|---|---|---|---|
| Largest Era 3 board: L61 (36×47), tap 26, 43 eats | 1× | 16.8 ms | 16.8 ms | mean 0.07 ms, max 1.2 ms |
| L61, same tap | 2× | 16.8 ms | 16.8 ms | max 2.0 ms |
| Busiest Era 3 play in the game: L65 tap 15, 76 eats (`SP.busiest()`) | 1× | 16.7 ms | – | – |
| L65, same tap | 2× | 16.8 ms | – | – |
| L65 under 4× CPU throttle | 1× | 16.8 ms | one 83 ms frame | – |
| L65 under 4× CPU throttle | 2× | 16.7 ms | 50 ms | – |

Show lengths were 3001 ms at 1× and 1502 ms at 2×, both inside the cap.

## Findings

### Blockers
None.

### Majors
None.

### Minors

- **MINOR-1: L58 sits on the edge of the late band.** (SPEC §5: 46–75 "mostly under 10%")
  - **Repro:** 300 seeded random-tap playouts on Normal (`rate.mjs`, seed 777, uniform over non-empty columns) give **0.103** (31/300). The baked rate is 0.0575.
  - **Why it's minor:** it's within about 2.6 standard errors, and "mostly" still holds: 22 of the 23 hard and hardest slots are under 10%. But it's the one level where an independent estimate lands outside the band.
  - **Fix:** re-grade L58 with a larger N, or tighten it one step.
- **MINOR-2: On Hard, the archer teaching level (L51) ends on the first tap for 3 of 5 openers.** (SPEC §4, §9 "A Hard kill always ends the level short")
  - **Repro:** Hard, L51, first tap col 1, 2 or 3 (Masons 13). All 13 are killed, and the level fails "short" instantly.
  - **Why it's minor:** this follows the spec, and the coach does point to the tower card first. But a teaching level whose random-tap Hard rate is 0.245, where the most common first tap loses at once, is harsh.
  - **Fix:** consider exempting teaching levels from lethal archers, or making the coach's ring more insistent on Hard.
- **MINOR-3: Doomed positions play on until you tap.** (SPEC §3 third fail rule, §9 "No move")
  - **What happens:** no-move only fires when every front card would die instantly. When every legal tap eats a few pixels and then overflows, the game stays "playing", and the player has to tap into a certain loss.
  - **Repro:** 8 fuzz positions show this, for example L47 Easy `23413` then any tap, and L72 Normal `040221104404` then any tap.
  - **Why it's minor:** this matches the §9 text exactly ("A card that can merge is a legal move"). It's a feel issue, not a rules bug: a dead game reads as live for one more tap.
  - **Fix:** optionally, widen no-move to "every front card leads to a fail" by simulating each on a clone. That's cheap: at most 5 clones.
- **MINOR-4: Easy is near-trivial on several late hard slots.** (SPEC §9 "report lists the Easy and Hard rates")
  - **Repro:** random-tap on Easy gives L64 (hardest) 0.84, L69 (hardest) 0.98, L71 (hard) 0.93 and L65 0.87. On Normal the same levels are 0.01–0.04.
  - **Why it's minor:** bands are graded on Normal by decision, so this isn't a violation. It's flagged so Peter knows Easy's sixth space collapses the late game.

### Notes, not findings

- **Pane screenshots were stale.** rAF in the Claude Browser pane was starved (the clock moved 100 ms per 1 s of wall time), so screenshots there showed stale frames. I verified behaviour from `SP.state()` plus `SP.tick`, and from the live headless run. This is a test-environment limit, not a game defect.
- **Every level is winnable by random taps early on.** Levels 1–13 are 1.00 random-tap on Normal and Hard alike, so no tap loses. This complies with §5 (≥85%).
- **`SP.lossOrder(51, d)` returns null.** It's a debug helper with a narrow predicate. It's not player-facing, and selfTest finds the archer hit and kill by its own search.
