# Sapper's Path M2: functional critic

Date: 2026-09-27. Target: the frozen copy at `http://127.0.0.1:8492/sappers-path/?debug=1` (files in the session scratchpad `critic-m2/sappers-path/`). Driven with headless Playwright: desktop 1280×720 with a mouse, phone 375×812 with touch (isMobile, DPR 3). Scripts and raw output are in the session scratchpad `critic-func/` (`rules.js`, `fuzz.js`, `plan.js`, `loop.mjs`, `extra.mjs`, `hidden2.mjs`, `loop.json`, `extra.json`, plus the screenshots).

**Counts: 0 BLOCKER, 1 MAJOR, 7 MINOR.**

**Verdict:** one small fix away from Peter's phone playtest. The engine, save, flow, locks, input safety and performance all hold up. The one MAJOR is readability: a chest doesn't show which crew it holds, and 21 of the 36 levels have a chest the best line needs. Fix that first, or Peter will spend his playtest guessing at chests.

## selfTest
| | desktop | phone |
|---|---|---|
| `SP.selfTest()` | ok, 36/36 solved, 283 button checks, 48 ms | ok, 36/36 solved, 272 button checks, 59 ms |

## 1. Rules re-implementation: PASS
I wrote my own SPEC §1 implementation from the spec text (`critic-func/rules.js`). It covers sections, connected ground, exposure, the lever cascade to a fixed point capped at W×H, chests, win, stuck and remaining crews. It shares no code with `engine.js`. I compared the two by section first tile, so the diff doesn't depend on section numbering.

| Check | Result |
|---|---|
| Steps compared on the 36 levels (legal moves, remaining crews, chests claimed, levers thrown, doors opened, win, stuck, used) | 39,120 steps, **0 mismatches** |
| The level's `line`, all 36 | 36/36 legal at every step, win at the end, length = `min` |
| Seeded random legal sequences | 250 per level (9,000 total), 0 mismatches |
| Illegal breaks probed on the engine (one random illegal section every step) | 0 accepted |
| `min` against my own BFS over broken sets | **36/36 match** |
| Reachable-state counts against baked `metrics.states` | 36/36 match |
| Extra: 3,000 random adversarial boards (edge levers, lever chains up to 3 cascade rounds, chests behind doors, edge keeps), 20 random sequences each | 305,469 steps, **0 mismatches** |

## 2. Full loop with real input: PASS (both viewports)
- Title → map → level 1 takes **2 taps** (Play, node 1-1). Tapping locked node 1-2 leaves you on the map.
- I won all 36 levels with real taps (two taps per break), going level to level with the win panel's **Next**. On w4-10 the panel says "Map". The map ends at ★ 108 / 108.
- I hit a stuck in every world with real taps: **w1-08, w2-05, w3-10, w4-10**. In each one the stuck panel's Undo stepped back one move and refunded exactly that crew. Then the rail's Restart went back to 0 moves.
- Undo refund, spot-checked on w3-02: the timber went 0 → 1 and moves went 1 → 0.
- Locks: I wrote my own §7 rule from the saved stars and compared it after every win, including the map DOM `locked` class at 4 points. That's **1,440 checks per viewport, 0 fails.** World 2 stays locked after 5 World 1 wins (tapped node 2-1, stayed on the map) and opens after the 6th.
- Stars only go up. On w2-06: won with 5 crews (1★, saved 1), then Replay with 3 crews (3★, saved 3), then Replay with 5 crews (the panel shows 1★, saved stays 3).

## 3. Two-tap safety: PASS (see MINOR 1)
- A single tap on a reachable section only picks. Moves stay 0 and the pick = timber.
- A rapid double-tap on the same section **is a break**: `dblclick` on desktop, two fast `touchscreen.tap`s on the phone, 1 move each. A triple-tap is still exactly 1 break, because the third tap skips the show and lands on rubble. This is by design (tap 1 picks, tap 2 commits) and Undo refunds it. MINOR 1 covers the thumb-bounce risk.
- Taps during a walk-in or crumble: I broke a section and then tapped the next line step twice while the show was running. The show fast-forwarded, the second break committed, and there was no double spend. The engine state matched my own derive of the page's move list.
- Hammer: after a break I fired 30 random fast taps (70% board, 20% crew cards, 10% Undo) on w1-07 and w4-05 at both viewports. In every case the page state (moves, used, remaining, won, stuck, legal count) matched my independent derive of `renderSignature()`'s move list, with no duplicate moves.
- With `twoTap:false` (config served through a route override), one tap on a reachable section breaks it. One tap on an unreachable one only picks and shakes.

## 4. Save: PASS
- I injected 12 corrupt saves and reloaded after each: garbage text, `NaN` text, an array, `null`, a string, a number, mixed bad values (`1e999`, −5, 2.7, `"3"`, 99, unknown ids, `__proto__`, `constructor`), wrong types, nested objects, −Infinity, a future `v:999`, and a huge one (300,000 unknown ids, loaded in 37 ms). The results:
  - 0 page errors and 0 console messages.
  - Every stored field came back sane after the next write: stars 1–3 only for known ids, best whole 1–99 and only with stars, boolean settings, and `last` a known id or null.
- The stored string is byte-identical after `SP.solve()` ×3 plus a tap, and byte-identical after a full `SP.selfTest()`.
- Mute and 2× (real taps on the banner toggles) survive a reload: `muted`/`fast` true, `aria-pressed="true"`.

## 5. Studio checklist: PASS
- **Console:** 0 errors, 0 warnings and 0 page errors across every run above (both viewports, 438 real taps each, saves, resize, hidden load, perf).
- **Hidden-tab load:** headless Chromium reports a background tab as `visible`, so I couldn't test a real one. I faked it instead: `document.hidden` true and rAF held from the first script. While hidden, selfTest passed. I then played w4-10 entirely on `SP.tick` (the panel was null before the tick and "win" after). After the reveal: 0 blank sprites, board opaque 1.000, and a real-touch win on w4-t1 afterwards. Screenshot: `hidden-fake-after-reveal.png`.
- **elementFromPoint** at the centre of every visible button: title (Play), map (every node in view, both scroll positions), play with the hint card (Got it, toggles, cards, Undo/Restart), play, the win panel, and the stuck panel on 4 levels. Every primary button is hittable. The only "covered" hits were play-screen buttons sitting under the title and map overlays (MINOR 6) and rail buttons under the phone's bottom sheet, which offers its own Undo/Restart.
- **`?v=`:** all 9 scripts, `style.css`, `config.json` and `levels/levels.json` load with `?v=3`, and `index.html` has meta no-cache.
- **Timers:** `grep setTimeout|setInterval src/*.js` finds only the comment at `main.js:8`.
- **Resize/orientation mid-show:**
  - Phone 375×812 → 812×375 → 375×812 during a w4-05 crumble. The layout switches to wide, the board (298 px) fits, there's no page scroll, and a tap in landscape picked the right crew (ice). The commit after rotating back broke it (moves 2).
  - Desktop 1280×720 → 700×1000 → 1920×1080 → 1024×600 → 1280×720 during a w3-10 show. Every button stayed hittable and the next break landed.
  - The landscape rail clips (MINOR 4).

## 6. Feel against Food Hunt
- **Taps from load to the first break: 4** (Play, level node, pick, commit). Every break costs two board taps, so a 6-crew level is 12 board taps. Food Hunt is one tap a move. That was the Phase 0 decision and the `twoTap` dial works, so this is for Peter to judge on the phone rather than a defect.
- **Thumb targets at 375×812** (bottom third means centre y ≥ 541):
  - In the bottom third: the crew cards (y 702, 104×76) and Undo/Restart (y 774, 175×48). So are the win and stuck panel buttons (y 772, 106×48).
  - Outside it: the map button (y 28), the 2× and mute toggles (y 84) and the hint card's Got it (y 144).
  - The board spans y 297–654, so on an 11×11 board rows 0–6 sit above the bottom third. That's unavoidable with a width-filling board, and it's the same as Food Hunt. See MINOR 3.
- **Solve times** (I solved these by reading the board, before comparing with `line`; my solutions for w2-08, w3-10 and w4-10 match the baked lines):

| Level | Estimated time, competent player | Read notes |
|---|---|---|
| w1-t1 One Wall | ~5 s | trivial |
| w1-08 | 20–40 s | Reads fine. The L-shaped inner timber hugging the keep takes a second look to see as one section. |
| w2-t1 Goats and a Chest | ~10 s | The hint says the chest gives a mason. It's the only place a chest's crew is ever stated. |
| w2-08 | 1.5–3 min | Dense 9×9 of one-thick walls. The top inner timber (row 1 plus column 7) sits against the outer hedge and inner hedge, and it took me the longest to separate. There's only one route: right timber, inner stone, top timber, chest pocket, inner timber. **Confusing to read.** |
| w3-t1 | 10–15 s | trivial |
| w3-10 | 2–3 min | The bottom hedge gap is the only way through the moat. The line needs **3 goats with 2 in the muster**, and the third comes from the chest. The board doesn't show that (MAJOR 1), so the first attempt is a guess. |
| w4-t1 Iron and a Lever | ~10 s | The hint explains it. |
| w4-10 | 3–5 min | A one-way trap (a goat on the right moat gap loses), a lever sealed by two one-tile walls, and two timber sections touching only at a diagonal (the two badges save it). At the top of Food Hunt's late-game read load, and a restart is likely. |

- **Show pace at 1×, 2× and skip:**
  - At 1×, a non-winning break show runs a median of 1.18 s (p90 1.40 s, max 1.95 s; 69 breaks over W3–W4).
  - From the winning tap to the panel: 3.86 s on w4-06 (show 3.40 s) and 2.29 s on w1-05.
  - **2× halves it exactly** (w4-06 win panel in 1.93 s).
  - **Skip is snappy:** a tap right after the winning tap cut the show at once and brought the panel in 200 ms.
  - Nothing gates input, because the state commits at the tap. The 1× W4 win wait is on the slow side for a Food Hunt pace (MINOR 2).

## 7. Performance: PASS
- **Busiest show on an 11×11 board:** the w4-t1 winning break, which crumbles the 24-tile timber ring, then the lever and doors, the keep, and the goblin march (3.6 s show).
  - At CPU 1×: rAF mean 16.67 ms, p95 16.7, max 16.8, 0 frames over 20 ms, 0 long tasks. `Render.draw` (wrapped at runtime to time it) mean 0.08 ms, max 1.1 ms.
  - At CPU 4× throttle: frames unchanged, draw max 4.5 ms.
  - Caveat: headless has no real GPU compositing, so treat this as script-side headroom. On that measure, the headroom is large.
- **Payload** on a cold load: **197,776 bytes (193 KB), 13 files, 0 external requests.**

## Findings

### BLOCKER
None.

### MAJOR
**1. A chest doesn't show which crew it holds, so levels that need a chest can't be planned from the board.**
- `art.js` paints one chest tile (`t("C", …TILE.chest(P, A, 0, false))`) and `render.js:130` draws `T.C` for every chest whatever its `crew`. A tap on a chest returns `clear` and shows nothing. You only learn the crew when the +1 flies to its card after you've claimed it.
- 26 levels have a chest. The baked metrics mark 21 of them `required`.
- Example: w3-10 has 2 goats in the muster, but its 5-crew line breaks 3 hedges. The third goat is the chest at (2,6). The player can't see that, so the level reads as unwinnable until they stumble into the chest. The same goes for w2-02 and w2-07 (hedge chests) and w3-06, w3-07 and w3-09 (ice chests with 0 torches in the muster).
- This breaks the SPEC's readability rule: anything harder to read than Food Hunt's late game is a defect.
- Repro: load `?debug=1`, `SP.load("w3-10")` at 375×812, and look at (2,6). It's a plain chest with no crew icon, and the Goats card says 2. Screenshots: `phone-w4-10-start.png` (chest at (7,7), timber, unmarked) and `phone-stuck-w4-10.png`.
- Fix: draw the crew's badge icon on or above the chest until it's claimed.

### MINOR
1. **A double-tap or thumb bounce breaks a wall.**
   - Two taps on the same reachable section within a few ms commit the break (desktop `dblclick` = 1 break; two fast touch taps = 1 break).
   - Undo refunds it fully, so it's reversible. Still, two-tap commit is there to stop accidental breaks, and a bounce gets through.
   - Repro: w3-02, double-tap (1,0) on the timber: moves 0 → 1.
   - Suggestion: ignore a commit on the same section within ~150–200 ms of the pick.
2. **The win wait is long at 1× in World 4.**
   - Winning tap to panel: 3.86 s (show 3.40 s plus `winPanelMs` 450). A typical break show is 1.18 s median.
   - A tap skips it to 200 ms, and 2× halves it. But a player who waits at 1× waits nearly 4 s every W4 win.
   - Repro: w4-06, play the line and time the last break to `SP.state().panel === "win"`.
   - Consider trimming `show.marchTileMs`/`marchMaxTiles`/`keepDelayMs` or `winPanelMs`.
3. **Some thumb targets sit at the top at 375×812.**
   - The 2× and mute toggles (centre y 84), the hint card's Got it (y 144) and the map button (y 28) are all far from a one-handed thumb. The rail and panels are fine.
   - Repro: `SP.load("w1-t1")` at 375×812 and measure the button rects (`extra.json` → `phone.thumbPlay`).
   - Got it and the toggles are optional, so this is polish. Moving the toggles to the rail row or the panel would finish the job.
4. **In phone landscape (812×375) the rail overflows.**
   - Undo and Restart are clipped at the bottom edge, with about the lower 10 px of the 48 px buttons cut off. Their centres are still on screen and hittable.
   - Repro: rotate to 812×375 mid-level. Screenshot: `phone-landscape-w4-05.png`.
5. **The mason pickaxe badge reads as a letter "T" at phone size.**
   - That's the same letter as the timber grid code, and next to the axe badge it's easy to take a stone wall for timber at a glance. The textures do disambiguate.
   - The builder already flagged this icon as the weakest.
   - Screenshot: `phone-w4-10-start.png`, stone sections.
6. **Play-screen buttons stay live under the title and map screens.**
   - The menu, toggles, crew cards and Undo/Restart are not `hidden` while the title or map covers them. They're keyboard-focusable and visible to assistive tech behind the overlay. The pointer is fine, since `elementFromPoint` returns the overlay.
   - Repro: on the title screen, press Tab repeatedly, or check `document.getElementById("btn-undo").closest("[hidden]")`, which is null.
7. **The save sanitizer drops some values instead of clamping them.**
   - `stars: 1e999` (Infinity) is dropped rather than clamped to 3.
   - A `best` below the level's `min` is kept (e.g. `best["w1-t2"] = 1` with min 2).
   - `best` isn't shown anywhere in the UI, so nothing visible breaks.
   - Repro: the `mixed`/`future` payloads in `extra.mjs`.

## Builder claims checked
Everything I could check matched the builder's notes: the 2× ratio of exactly 0.5, skip → panel in 200 ms, a 193 KB payload, 0 console messages, the unlock rule, the 16.7 ms frames and mute persistence. The one note I'd push back on is "the card holds the +1 back". It's accurate, but it also hides the chest's value until the moment it's claimed, which is MAJOR 1.
