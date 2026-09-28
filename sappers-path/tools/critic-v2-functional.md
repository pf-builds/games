# Sapper's Path v2: functional critic

Target: frozen copy of commit 1ccf125, served at `http://127.0.0.1:8492/sappers-path/`. Headless Playwright (Chromium). Phone: 375×812, DPR 3, `isMobile`, `hasTouch`, `touchscreen.tap`. Desktop: 1280×720, `mouse.click`. Scratch scripts and raw results are in `scratchpad/critic-v2-func/` (`myrules.js`, `diff.js`, `plans.js`, `h.js`, `perf.js`, `trace.js`, `*-result.json`).

**Verdict: 0 BLOCKER, 3 MAJOR, 6 MINOR.** Mechanically it's clean: every rule, flag, input path, save path and studio check passed. All three majors are about depth and feel. They're for Peter's playtest to judge, and none of them stops the build from going on his phone.

## selfTest
`SP.selfTest()` on the phone: `ok: true`, 38/38 solved through `call()`, 276 button checks, 223 flag checks, stucks w1-t3/w2-02/w3-02/w4-02, 279 ms, `fails: []`. It also passes while the tab is hidden (see check 6).

## Pass/fail by check

| # | Check | Result |
|---|---|---|
| 1 | Rules re-implementation, diff, own BFS | PASS. 0 mismatches (details below) |
| 2 | Flags = the section the call breaks, through real taps | PASS. 116 flag checks over 8 full levels, 2 per world, both viewports |
| 3 | Full loop, real input, both viewports | PASS |
| 4 | Tap abuse | PASS |
| 5 | Save | PASS |
| 6 | Studio checklist | PASS (the hidden tab is emulated) |
| 7 | Depth and feel against Food Hunt | Concerns: 3 MAJOR |
| 8 | Performance and payload | PASS, with 1 MINOR hitch |

### 1. Rules diff
I wrote my own implementation of SPEC-v2 §2 from the spec text only (`myrules.js`). It covers:
- sections computed once
- connected ground flooded from `P` only (edges aren't outside)
- chests, the lever cascade capped at W×H passes, and a multi-cell keep
- walk distance as a BFS from every camp cell
- Rule A: smallest `dist`, then the Chebyshev distance from the nearest tile to the nearest keep cell, then the lowest `(y,x)` first tile
- the legal rule and stuck

I diffed it against `src/engine.js` on all 38 levels: each level's `line` plus 200 seeded random legal sequences per level. That's 7,600 sequences and 55,993 compared states. At every state I compared the legal mask, each material's target section, remaining crews, every chest claim, every iron door, won/stuck, and whether `E.targets()` agreed with `st.target`. I also spot-checked undo exactness on each sequence.

- **Mismatches: 0.** The first run showed 1,909 "target" diffs. Every one was a won state: the engine clears targets once the keep is reached, and my version didn't. The spec is silent there and no call is legal after a win, so it isn't a bug.
- **`min`:** my BFS matches all 38 levels (38/38).
- **Shipped lines:** all 38 replay under my rules, win in exactly `min` calls, and match `lineCells` (38/38).
- **Ties:** no tie-break decides any call on any shipped line (0). Among random-play states, 1,202 calls were decided by a tie-break, mostly in w1-08, w2-04, w3-07, w4-03 and w4-10. None of them sit on an optimal line.

### 2. Flags
Before every real card tap, I checked each flag in `SP.flags()` (the renderer's planted flags) against my rules. Two things had to hold: the set of flagged crews equals my legal set, in card order, and each flag's contact tile lies inside the section my rules say that crew breaks. After each tap I checked the section the engine broke (from `renderSignature`'s serialized state) against the section that had been flagged.
- Phone: w1-09, w2-09, w3-10, w4-10. Desktop: w1-05, w2-05, w3-06, w4-06. Plus w1-t1 on both.
- 116 flag checks, 0 failures. No flags remain after any win.

### 3. Full loop (both viewports, real input)
- **Title → map → level 1:** 2 taps on both viewports (Play, then the pulsing node).
- **Map locks:** a fresh save opens 1 of 38 nodes. Tapping a locked node stays on the map. After the w1-t1 win, w1-t2 opens and w1-t3 stays locked.
- **Wins:**
  - Phone: w1-t1, w1-09, w2-09, w3-10, w4-10.
  - Desktop: w1-t1, w1-05, w2-05, w3-06, w4-06.
  - All 3 stars, with the win panel shown.
- **Stucks:** phone w1-t3, w2-02, w3-05, w4-02; desktop w1-04, w2-07, w3-02, w4-06. Every one showed the stuck panel with every visible card dimmed. The panel's Undo restored the exact pre-stuck state and refunded the crew. Rail Restart went back to 0 moves with the full muster.
- **Undo:** on 8 levels, after call 2, the rail Undo button left a state that serializes the same as `fromMoves(moves)` and refunded the crew (for example w4-10 timber 0→1). A redo re-tap reproduced the same state.
- **Next:** after w1-t1, Next went to w1-t2 on both viewports. Desktop w1-05→w1-06, w2-05→w2-06, w3-06→w3-07, w4-06→w4-07. After a world's last level on a partial save, the primary button reads "Map", because the next world isn't unlocked yet (`worldNeeds`). That's correct.
- **Stars only go up:** after a 3-star w1-09, a 6-call win showed a 2-star panel and the saved value stayed at 3.
- **Disabled cards:** 18 taps on dimmed cards. Every one had `aria-disabled=true` and a toast that explains why, for example "Masons can't reach any stone yet" and "No axemen left". None changed the state.
- **Board taps:** 5 cells per step (a flag tile, corners, the centre, the keep) on 3 steps of each of 9 levels per viewport. The serialized state never changed.
- **Button hit tests:** `elementFromPoint` passed on every primary button of every screen: title 1, map 20 (phone) and 40 (desktop), play 6, win panel 6, stuck panel 5, debug select 39. Every button is at least 40 px.

### 4. Tap abuse
On w4-10 (phone), I made 30 real taps on random cards with gaps of 15 to 1300 ms: 22 while idle, 5 mid-walk, 3 mid-eat. All 30 landed on cards. I replayed the tap list through my rules, accepting a tap only when that call was legal. The expected move list was `31122302332`, and the engine's was identical. Remaining crews matched in the engine, my rules and the card counters (`0,0,0,1`). No section was broken twice, no crew was double-spent, and none was lost.

### 5. Save (`sappers-path.v2`)
- **Corrupt-save injection:** 7 payloads, each loaded before boot:
  - not JSON, `[]`, `null`, `42`, a truncated object
  - a bad-types object: stars 99 / -4 / "3" / 2.7, a `__proto__` key, an unknown id, best -1 and 1e9, muted "yes", fast 1, last "zzz"
  - wrong container types
  
  All 7 loaded without an error. The rewritten save was clamped: stars `{w1-t1:3, w4-10:2}`, best `{w4-10:99}`, settings booleans false, last null.
- **`SP.solve()`:** mid-level, the save is byte-identical before and after.
- **Mute and 2×:** set with real taps, both persisted across a reload, and `aria-pressed` was restored on all toggle copies.

### 6. Studio checklist
- **Console:** 0 errors, 0 warnings, 0 page errors across every context (phone, desktop, 7 corrupt saves, perf and hidden).
- **Hidden tab:** headless Chromium can't truly background a tab, so I emulated one. `visibilityState`/`hidden` were forced to "hidden" and `requestAnimationFrame` callbacks were withheld until reveal.
  - While hidden, the page booted and `selfTest` passed 38/38. I loaded w4-10 and made a call, and the show stayed pending.
  - After reveal, the show finished, flags equalled targets (2 each), and the board was fully opaque (`hidden-after-show.png`: board, both flags and the cards render correctly).
- **`?v=`:** every one of the 14 requests has `?v=5` except the page itself. That includes the CSS, the font (preload and `@font-face`), all 9 scripts, `config.json` and `levels/levels.json`.
- **Timers:** `grep setTimeout|setInterval src/` finds only a comment in `main.js` saying none are used.
- **Resize mid-level:** mid-show on w4-10, 375×812 → 812×375 → 375×812. The cell went 43 → 30 → 43 device px, and the board rect stayed inside the landscape viewport (293,48 to 539,374 in 812×375). The move count held at 1, flags equalled targets afterwards, and there were no errors.

### 8. Performance
Busiest eat (`SP.busiest(4)`): w4-t1 call 1, 144 blocks, 37 rings, show 2.14 s at 1×. rAF frame deltas after warm-up:

| run | frames | mean | p95 | max | >33 ms | long tasks |
|---|---|---|---|---|---|---|
| phone 1× | 157 | 17.09 | 16.7 | **83.4** | 1 | 96 ms |
| phone 4× CPU | 155 | 16.67 | 16.8 | 16.8 | 0 | none |
| desktop 1× | 155 | 16.67 | 16.8 | 16.8 | 0 | none |
| desktop 4× CPU | 154 | 16.67 | 16.7 | 16.8 | 0 | none |

Payload: 14 files, 345.5 KB cold, 0 external. The largest are the font (75.9 KB), `main.js` (58.6 KB) and `levels.json` (44.1 KB).

### 7. Depth and feel (my own play, from the board and the flags, not from `line`)
I read each board as ASCII with the flags marked (`show.js`, `trace.js`), planned a line, and counted a full restart as an attempt. The flags after each call were visible to me, as they are to a player.

| level | min | my result | attempts | notes |
|---|---|---|---|---|
| w1-t1 | 1 | win, 1 call | 1 | trivial, as a teaching board should be |
| w1-09 (W1 finale) | 5 | win, 5 calls, 3★ | 1 | **Masons ×5.** Tapping one card five times is the optimal line. No thought needed. |
| w2-t1 | 2 | win, 2 calls | 1 | Goats, then the chest mason. Clear. |
| w2-09 (W2 finale) | 7 | win, 7 calls, 3★ | 3 | **The best board of the eight.** Try 1 (h,t,s,s,s,s) and try 2 (t,s,s,s,s,h,t) failed. The flags showed the 4th mason going to the left column instead of the keep. The fix was to open the lower bailey from the right and spend both axemen before the last mason, so the keep wall becomes closest. That's real "reshape closest" planning. |
| w3-t1 | 3 | win, 3 calls | 1 | Ice, timber, stone. Clear. |
| w3-10 (W3 finale) | 10 | **not solved** | 3 | See below. |
| w4-t1 | 2 | win, 2 calls | 1 | Stone, then timber, and the lever throws. Clear. |
| w4-10 (W4 finale) | 12 | **not solved** | 1 | Try 1 used all 12 calls (t,t,h,i,i,i,i,h,h,i,h,h). The last goat went to the outer left hedge instead of the lever house. The line is t,t,h,h,i,i,i,i,i,h,h,h, so one goat call in the wrong slot decides the level, and nothing on the board says which slot. |

On w3-10, the "closest" rule kept surprising me despite the flags:
- The second mason goes to the right curtain, because it touches the broken gatehouse.
- The left curtain came before the corner stones, even though my count on the board said otherwise.
- The fifth mason goes to the inner curtain rather than the keep's stone.

The winning line (s,i,i,h,s,s,s,h,h,s) differs from my attempts only in which order the goats and masons interleave. That order changes whether the keep stone or the inner curtain is a tile or two closer, across a 20×28 board.

## Findings

### BLOCKER
None.

### MAJOR
**M1. World finales and late levels feel like guessing with undo, not planning (W3-W4).**
- Repro: play w3-10 and w4-10 from the board. Evidence: the table above, 0 wins in 4 attempts on the two finales.
- Each flag makes the next step legible, which meets §3's "never surprised". But the plan hinges on walk distances between far-apart sections differing by 1-2 tiles, and those are invisible until the flag moves.
- The level metrics agree: `decisions` is 6 and `trapRate` 0.29-0.35 on these boards, with random wins at 2.5% and 3%. A player can't reason 10-12 calls ahead on a 560-768 block board, so they'll probe one call and undo until the flags line up.
- Food Hunt's late boards stay readable. The v1 spec calls "harder to read than Food Hunt's late game" a defect.
- Peter should judge this on the phone. It is the core question of v2.

**M2. The difficulty curve is not monotonic; several World 1 levels are harder than World 3-4 levels.**
Random-tap win rate per level (200 seeded runs each, from `diff.js`):

| World | Levels (random win rate) |
|---|---|
| W1 | t1 1.0, t2 1.0, t3 .55, 04 .78, **05 .13, 06 .12**, 07 .90, **08 .07**, 09 .49 |
| W2 | t1 1.0, 02 .73, 03 .17, 04 .03, 05 .07, 06 .03, 07 .41, 08 .66, 09 .45 |
| W3 | t1 1.0, 02 .49, 03 .10, 04 .52, 05 .22, 06 .05, 07 .11, 08 .04, 09 .48, 10 .03 |
| W4 | t1 1.0, **02 .45**, 03 .07, 04 .03, **05 .41**, 06 .19, **07 .43**, 08 .02, 09 .23, 10 .03 |

- w1-08 (6.5%) is harder by blind tapping than w4-02, w4-05 and w4-07 (41-45%).
- w1-07 (90%) and w2-02 (73%) are near-free.
- Levels are ordered by `min` only, so the curve swings from level to level.

**M3. Single-card-spam lines, including the World 1 finale.**
- Repro: load w1-09 and tap Masons 5 times. It wins with 3 stars.
- Six shipped levels are won by tapping one card repeatedly: w1-05 (timber ×3), w1-06 (timber ×3), w1-08 (timber ×4), w1-09 (stone ×5), w2-04 (hedge ×4), w2-06 (hedge ×4).
- On those boards "closest" makes the choice for you. They teach "tap the big number" rather than the path idea Peter asked for.

### MINOR
- **m1. Stars are binary on 31 of 38 levels.** No 2-star or 1-star win exists on them: every win uses exactly `min` calls, and any extra call ends stuck. Only w1-09, w3-02, w3-05, w3-09, w4-05, w4-09 and w4-10 allow a slower win (BFS in `plans.js`). Stars carry almost no information, and "stars only go up" can only happen on those 7.
- **m2. 16 of 38 levels have no spare crew (muster = min):** w1-t1, t2, t3, 04, 07; w2-t1, 02, 07, 08, 09; w3-t1, 04; w4-t1, 02, 06, 07. That's fine by v1 §2 (0-1 spare), but together with m1 every wrong call is fatal, and the game becomes all-or-undo.
- **m3. One 83 ms frame (a 96 ms long task) at the tap on the busiest eat.**
  - Repro: phone 375×812 DPR 3 at 1×, cold context, `SP.load('w4-t1')`, then a real tap on Masons.
  - It didn't recur at 4× CPU or on desktop, so it's probably first-use work (the prev-picture bake or JIT). It's a one-frame hitch at the start of the walk.
- **m4. `sanitize` accepts inconsistent records.** A corrupt save gave stars `w4-10: 2` with best `99` calls, on a locked level with `min` 12, and it kept both. It's harmless today because best isn't shown, but it isn't a real clamp.
- **m5. Doc drift.** The `src/save.js` header still names the key `"sappers-path.v1"`; the config key is v2, and the payload `v` is 1.
- **m6. Engine-internal detail (not a spec break).** Once `won` is true, `derive` returns no targets. The spec says nothing about targets after a win, so a tool reading `st.target` on a won state gets -1. I've noted it only so a later tool doesn't trip on it.

## Ready for Peter's phone playtest
**Yes.** Nothing functional blocks it: 0 rule mismatches, flags exact, the loop, save and abuse checks clean, 0 console output. Take M1-M3 to the playtest as the questions to ask him:
- Do the World 3-4 finales feel like planning?
- Does the order feel like it gets harder?
- Is tap-the-same-card-five-times acceptable in World 1?
