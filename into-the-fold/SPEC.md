# Into the Fold: SPEC (v1)

Approved 2026-09-26 (Phase 0). Design source: `claude-workspace/business/D-click-it-studios/game-research/ewe-turn-kickoff-prompt.md` (renamed "Ewe Turn" → "Flockstop" after a name collision, then → "Into the Fold" 2026-09-26 because "Flock" now reads as Flock Safety cameras). This file is the build contract. Where it's silent, the builder decides and writes the decision here.

**One line:** a daily sliding puzzle. Swipe and every loose sheep in the pasture sprints that way until something stops it. Pen every sheep in as few swipes as you can, scored against a solver-proven par.

## 1. Rules (exact)

### Board
- Rectangular grid, W×H cells, fenced on the outside edge (the outer fence is a wall).
- Cell types: `grass` (default), `rock` (wall), `mud`, `pond`, `pen`.
- A **pen** has an open side (N/E/S/W) and a colour (`white` or `black`). It's fenced on the other three sides. Capacity 1.
- Sheep: `white` or `black`. Pieces sit on grass or mud cells; they never start on a pen, rock or pond.
- Pens count = sheep count, per colour (1 black sheep ↔ 1 black pen when present).

### A swipe in direction d
1. Order the loose sheep by how far along d they already are, furthest first (the 2048 rule).
2. Each sheep in that order moves one cell at a time along d until the next cell is blocked. Blocked means any of: the outer fence, a rock, a loose sheep that has already stopped this swipe, a filled pen, a pen entered through a fenced side, or a pen of the wrong colour.
3. **Entering a pen:** if the next cell is an empty pen of the sheep's colour and the sheep enters through the open side (the sheep is moving opposite to the open side's direction), the sheep moves in and is **penned**. It stays for good, and the pen is a wall from then on (including for sheep later in the same swipe).
4. **Mud:** a sheep that moves onto a mud cell stops there. A sheep that starts the swipe on mud moves normally.
5. **Pond:** if any sheep's path would move it onto a pond cell, the whole swipe **splashes**. The board ends exactly as it was before the swipe, the splash animation plays, and the swipe **counts**.
6. A swipe that would move no sheep (and doesn't splash) is a **no-op**: it doesn't count, and it shows a small bump/shake. (Builder's call in Phase 0: counting a wasted input would feel unfair, not honest.)
- **Win:** every sheep penned. There's no lose state; the score is the medal.

### Undo, restart, count
- Undo (unlimited) steps back one board state. Restart returns to the start board. **Neither refunds swipes:** the swipe counter only goes up (DeJam's "undo doesn't refund" rule).
- Undo and restart never count as swipes themselves.

### Score
- `swipes` vs `par` (the BFS minimum). Medal thresholds live in `config.json`:
  - Gold fleece: `swipes <= par`
  - Silver: `swipes <= par + 3`
  - Bronze: anything above

## 2. Daily system

- **Puzzle #N:** `N = daysBetween(config.launchDate, localToday) + 1`, clamped to ≥ 1. Use the local calendar date, not UTC.
- **Difficulty follows the weekday** (Mon easiest, Sun hardest). The bake produces **7 weekday pools**. The daily for a date picks `pool[weekday][k]`, where k counts how many of that weekday have happened since launch. Changing `launchDate` therefore never needs a rebake.
- **Past the bake horizon:** `pool[w][k mod len]` under board symmetry `floor(k/len) mod 8`, excluding the identity after the first cycle. Par doesn't change under symmetry. On a non-square board, only use the symmetries that keep W×H, or transpose consistently.
- A countdown to the next flock (local midnight) shows on the result screen. When the date rolls over while the page is open, the next interaction or visibility change loads the new daily. No setTimeout drives state; check the date on `visibilitychange`, `focus`, and in the frame loop at most once per second.
- **Resume:** the in-progress daily (history, swipe count, share squares) is saved on every swipe, so a reload can't reset the count.
- **Share** (`navigator.share` when available and on a touch device, otherwise the clipboard, with a visible "Copied" toast):
  ```
  Into the Fold #N 🐑 9/7 🥇
  🟩⬜🟩🟦⬜🟩🟩
  🟩⬜
  https://pf-builds.github.io/games/into-the-fold/
  ```
  - One square per counted swipe, in play order, including swipes later undone. 🟩 means at least one sheep was penned on that swipe, ⬜ nothing penned, 🟦 splash. Rows hold at most 7 squares.
  - The medal emoji is 🥇/🥈/🥉.
  - It **must never contain directions** or anything that encodes them.
- **Stats** (local): played, current streak, max streak, par-or-better %, and a histogram of swipes over par (buckets: par or under, +1, +2, +3, +4, +5 or more). The streak counts consecutive local dates with a finished daily.
- **Practice mode** unlocks after today's daily is finished. It plays from a separate baked pool of 500 in a fixed order, with its own progress index. It never touches the streak or the daily stats.
- **Tutorial:** on first launch, the page opens straight into tutorial board 1 of 3. They're hand-made boards with a one-line inline hint each: (1) swipe moves every sheep, pen one; (2) sheep stop on each other, so use one as a stopper; (3) pens only open on one side. A "Skip" link goes to today's daily. The help button replays the tutorial. After the tutorial (or on every later visit), the page opens straight onto today's board: **0 clicks to play.**
- New elements get a one-time inline hint the first time they appear (mud, black sheep, pond).

## 3. Weekday ramp: APPROVED by Peter 2026-09-26

M0 measured before setting any target (`tools/par-report.md`, 2000 random layouts per config). The numbers below are the builder's proposal. They live in `tools/bake-config.json`, so a retune is a config edit plus a rebake (about 1 minute).

| Day | Size | Sheep | Elements | Par band | Dead-end floor | Extra rules | Baked median par |
|---|---|---|---|---|---|---|---|
| Mon | 6×6 | 3 white | rocks 3-6 | 4-6 | ≥ 1 | | 5 |
| Tue | 6×6 | 4 white | rocks 3-6 | 5-7 | ≥ 3 | | 6 |
| Wed | 7×7 | 4 white | rocks 4-8, mud 1-3 | 6-8 | ≥ 5 | stopper needed | 7 |
| Thu | 7×7 | 3 white + 1 black | rocks 4-8, mud 1-3 | 7-8 | ≥ 10 | stopper; no pen on swipe 1 | 8 |
| Fri | 7×7 | 3 white + 1 black | rocks 4-8, mud 1-2, pond 1-2 | 8-10 | ≥ 10 | stopper; no pen on swipe 1 | 9 |
| Sat | 8×8 | 4 white + 1 black | rocks 6-10, mud 1-3, pond 1-2 | 10-12 | ≥ 40 | stopper; no pen on swipe 1 | 11 |
| Sun | 8×8 | 4 white + 1 black | rocks 6-10, mud 1-3, pond 1-2 | 12-14 | ≥ 100 | stopper; no pen on swipe 1 | 13 |

Accept criteria per board (all enforced by `tools/gen.js` `rejectReason`, M0 definitions):
- par inside the weekday band
- **dead-end floor:** at least N dead-end branches. A dead-end branch is a move from a state that can still be won into one that can't (splash and no-op swipes aren't moves). The count tracks search-space size, so it's used as a "not trivial" floor, not a difficulty dial.
- **Wed+ stopper needed:** every shortest solution contains a swipe where a sliding sheep is stopped by another loose sheep (checked on the par-only move graph with those swipes removed). This is lenient on purpose: two sheep stacking against a fence counts.
- **Thu+ no pen on swipe 1:** none of the four opening swipes pens a sheep.
- no two baked boards identical up to symmetry, across the daily and practice pools together
- Recommendation from the data: at most 1 black sheep in v1. Two black sheep push median par to 20, and 4% of layouts hit the solver's 250k state cap.

**M0 builder decisions**
- Generator: pens never sit on another pen's doorstep (the cell in front of the open side). Ponds never sit on a pen's doorstep, because that would lock the pen for good. Sheep may start on mud. `penEdge` 0.5 is the chance a pen sits on the fence line opening inward (0.2 measured no different).
- Ties in the 2048 order can't matter: sheep only interact within their own row or column, and the furthest one along d always resolves first.
- On a splash, `swipe()` still returns the would-be `paths` (the splashing sheep ends on its pond cell with `stop:"pond"`) so the renderer can animate the splash. The returned state equals the old one.
- The solver explores the whole reachable graph, not just up to the first win, so it can count dead ends. Measured on all 735 baked dailies in Node: mean 0.1 ms (Mon) to 22 ms (Sat/Sun), worst 140 ms (a Saturday board, 113k states). One `swipe()` costs about 0.3 µs. In the page, `solve()` is for debug and selfTest only.
- Tutorial boards are 5×5 and hand-made, with no dead ends: tut-1 par 2 (EW, or WE, both win), tut-2 par 2 (needs the stopper), tut-3 par 3.
- Practice: 500 boards, interleaved Mon→Sun kits in a fixed order (board i uses the kit of weekday i mod 7), from a separate seed.

## 4. Controls

- **Touch:** swipe anywhere on the board area (threshold about 24 CSS px, the dominant axis wins, one swipe per touch). **Mouse:** click-drag works the same way. **Keys:** arrows and WASD; Z or Backspace = undo; R = restart (R asks for confirmation if swipes > 0 on a daily, because a quick tap must never do something irreversible, and restart loses the board state).
- Input that arrives during a swipe animation is queued (max 1) and not dropped.
- Buttons: Undo, Restart, and a menu (Stats, How to play, Sound on/off, Practice when unlocked). Every primary button must pass an `elementFromPoint` hit test at 375×812 and at 1280×800.

## 5. Screen layout

- **Portrait-first.** From top to bottom: header (logo + "#N · Wednesday"), HUD (`Swipes 4 · Par 7` plus the medal target), the board (square, as large as fits), then the Undo and Restart buttons.
- **Desktop 16:9:** the board is centred with the same column; the side space holds the pasture backdrop, not extra UI.
- Result panel over the board: medal, swipes/par, share button, stats histogram, countdown, Practice button.
- Fonts: system stack only (`ui-rounded, "SF Pro Rounded", system-ui, sans-serif`). No Google Fonts or other external requests.

## 6. Look and sound

- Procedural pixel art drawn in code (canvas), cached to offscreen canvases. There's no third-party art.
- Soft pastoral palette. The sheep are round wool puffs with little legs: squash on stop, a gate that swings shut on penning, a one-time hop per penned sheep, and a flock jump on a win. There's a gentle splash for the pond.
- Tweened slides at 60 fps; the whole swipe resolves in ≤ 400 ms (durations in `config.json`).
- WebAudio synth only: a short whistle per swipe, pitch-varied bleats on stop/pen, a gate latch, a splash, and a win jingle. Sound can be toggled and the setting persists. Audio unlocks on the first gesture.

## 7. Architecture

```
into-the-fold/
  index.html         shell; every script/CSS tag carries ?v=N
  style.css
  config.json        all tuning: launchDate, medal thresholds, anim durations, swipe threshold, dataVersion
  levels/daily.json      {version, pools:{mon:[...],...,sun:[...]}}
  levels/practice.json   {version, boards:[...]}
  levels/tutorial.json   3 hand-made boards
  src/rules.js       PURE rules engine, no DOM; UMD so Node and browser share it
  src/solver.js      PURE BFS solver (uses rules.js)
  src/sym.js         8 board symmetries (pure)
  src/save.js        versioned save (key "intothefold.save.v1"), sanitize/clamp every field on load; pure stats helpers
  src/daily.js       date → puzzle #N → board (pure given a date)
  src/render.js      canvas drawing + sprite caches
  src/audio.js       WebAudio synth
  src/game.js        state machine, input facade, animation
  src/main.js        boot, debug handle
  tools/gen.js       random board generator + accept filter
  tools/report.js    par-distribution report → tools/par-report.md
  tools/bake.js      deterministic seeded bake → levels/*.json (a below-band fallback never throws)
  tools/test.js      node unit checks for rules, solver, daily picker, save and the game state machine
```

- Run Node with `~/.local/opt/node/bin/node`.
- **fetch() of levels/config carries its own `?v=` data version**, and `index.html` must revalidate (a `<meta http-equiv="Cache-Control" content="no-cache">` hint plus versioned tags).
- Board JSON format (compact, human-readable): `{"id":"wed-012","w":7,"h":7,"rows":["..R....","..."],"pens":[{"x":3,"y":0,"open":"S","c":"w"}],"par":8,"sol":"NESWNESW"}`. The row legend lives in rules.js (`.` grass, `R` rock, `M` mud, `~` pond, `P` pen, `w`/`b` sheep, `W`/`B` sheep standing on mud). `sol` is one optimal line for selfTest. It's never shown to the player and never put in the share text. Tutorial boards also carry `hint`.
- rules.js API (M0): `parseBoard(json)`, `initialState(B)`, `swipe(B, state, dir)` → `{state, moved, counts, penned, splash, noop, paths}`, `isWin(B, state)`, `play(B, dirs)`. Directions are `"N","E","S","W"` (aliases `up/right/down/left`). State is `{sheep:[{x,y,c,penned}]}`, and the sheep order is row-major from the board. solver.js: `solve(board, {cap})`. sym.js: `apply(k, board)`, `mapDir(s)`, `canonicalKey`, `keepsDims`.

## 8. Debug and test hooks (`?debug=1` only)

`window.ITF` exposes (the pure modules live on the `window.IntoTheFold` namespace: `.rules`, `.sym`, `.solver`):
- `state()`: a deep copy of the current state.
- `swipe(dir)`: goes through the **same input facade** as touch and keys.
- `undo()`, `restart()`
- `solve()`: runs on a **cloned** state. It must leave the stored save byte-identical.
- `tick(now)`: a manual frame step for hidden tabs.
- `setDate("YYYY-MM-DD")`: overrides "today" for date-rollover tests.
- `selfTest()`: loads 20 baked dailies spread across the weekdays, plays each solver solution through `ITF.swipe`, and asserts a win at exactly par. It also asserts undo/restart counting, splash counting, the no-direction share text, and that the save is byte-identical after `solve()`. It returns `{pass, failures[]}`. The run happens on a scratch save namespace, so it never touches the player's real save.

**M1 builder decisions (2026-09-26)**
- **Dates before launch** play launch day's board as #1 (header "#1 · Monday"), so the page never shows #0 and the weekday label always matches the pool. `config.launchDate` is 2026-09-28 for now.
- **Rollover** (superseded for a finished daily by the M2 fix pass below): a finished or untouched daily swaps to the new date at once (checked at most once per second in the frame loop, plus `focus`/`visibilitychange`). A daily in progress keeps going until the page is hidden and shown again, so the board is never swapped under a live swipe.
- **State commits when an action applies; animation only replays it.** One action is queued during an animation. If one is already queued, the running animation snaps to its end, the queued action applies and the new one takes the slot, so no input is ever dropped. The page and `ITF` share one facade, `act()` → `game.input()`.
- **Timing** (`config.anim`): constant speed within a swipe (ease-out per sheep, `cellMs` 48, longest slide capped at `slideMaxMs` 270) + `stopMs` 110 squash = 380 ms max. Splash: slide ≤ 170 + hold 110 + rewind 120 = 400 ms. Undo glides back (≤ 270 ms). Restart snaps.
- A splash leaves the board unchanged, so it pushes no undo state; Undo after a splash steps back to the last real board.
- **Restart confirm** is an in-page panel (never `window.confirm`), shown only on a daily with swipes > 0 that isn't already at the start. R opens it; Y / N / Esc answer; the buttons are Restart / Keep playing. Tutorial restarts need no confirm.
- Keys with Cmd/Ctrl/Alt are ignored (Cmd+R must reload, not restart). Key repeat is ignored except for undo.
- **HUD medal target** shows the best medal still reachable ("🥇 ≤ 7", then "🥈 ≤ 10", then "🥉"); after a win it shows the medal earned.
- **Help** replays the tutorial without discarding the daily: the daily's game stays in memory keyed by puzzle #N, so Help → tutorial → "Back to today" can't reset the swipe count. `tutorialSeen` is written on Skip or when board 3's result shows.
- **Result panel (M1):** medal, "N swipes · par P", "A new flock arrives at midnight.", How to play. Tutorial: Next / Play again, then "Play today's flock". M2 fills `#res-extra` (share, stats, countdown, Practice).
- Pens show a faint ghost sheep of their colour while empty; the gate stands open (pointing out of the open side; redrawn in the M2 fix pass) and swings shut when a sheep is penned. The black pen has a slate floor, the white pen straw.
- `config.json` is fetched with its own `?v=` (a constant in main.js); the level files carry `config.dataVersion`, which a rebake bumps.
- **selfTest (M1):** the daily picker (launch = #1, pre-launch = #1, past-horizon symmetry, determinism); 20 dailies at launch + 41·i days (all 7 weekdays, 2 past the horizon under symmetry) solved in-page from the start via `ITF.solve()` and played through `ITF.swipe`, asserting a win at exactly par, plus the baked `sol` replayed through rules; undo/restart never refund and never count; `solve()` leaves the live game unchanged; a splash counts, logs `s`, and leaves the board as it was; a no-op is free; three rapid swipes inside one slide all land. It runs on scratch games and a memory save, on a virtual clock through `ITF.tick`, then asserts the player's stored save is byte-identical. About 0.2 s. The share-text check lands with share in M2.
- `window.ITF` also has `tutorial(i)`, and `setDate(null)` clears the override.

**M2 builder decisions (2026-09-26)**
- **Resume = the action log.** Every effective action is appended to `g.log` (`N/E/S/W` for counted swipes incl. splashes, `u` undo, `r` restart; no-ops aren't logged). The save keeps `daily: {n, id, log}` and writes it on every action (from `act()` and from the frame loop, so a queued swipe applied on frame time is saved too). A reload replays the log through the same `apply()` with no animation or events, which restores history, swipe count and share squares exactly. The resume is used only when both #N and the board id match (a rebake that changes a board drops it). A log over `config.save.limits.maxLog` (20000) stops updating the resume.
- **Streak runs on puzzle numbers**, not wall dates: finishing #N extends the streak if the last finish was #N-1. So a daily finished after midnight still counts for its own day, and the player can then play the new one too. The shown streak is 0 once a day is missed (last finish older than yesterday's puzzle); max streak is kept. Pre-launch dates all play #1, so #1 finished early stays finished on launch day.
- **Stats are recorded the moment the win commits** (not when the result shows), in the same write as the resume, guarded by `lastN` so nothing counts twice. Played = the histogram's sum; par-or-better % = bucket 0 / played. Buckets: `config.stats.buckets` (6) with labels `≤par +1 +2 +3 +4 +5+`.
- **Sanitize:** every count is floored and clamped to [0, `maxCount`]; streak ≤ max streak ≤ played; streak 0 when there's no last finish; a resume with a bad char, #0, a non-string id or an over-long log is dropped; unknown fields are dropped.
- **Share:** built from the square log alone (`Game.shareText(cfg, n, swipes, par, squares)`), so it can't carry a direction. Touch = `matchMedia("(pointer: coarse)")`; there `navigator.share({text})` is used (AbortError is silent, any other error falls back to the clipboard). Elsewhere: `clipboard.writeText`, then a hidden-textarea `execCommand("copy")` fallback, then "Couldn't copy". The toast hides on frame time.
- **Result panel (daily):** medal, swipes/par, Share, stats tiles + histogram (today's bucket highlighted), "Next flock in H:MM:SS" (refreshed once a second from the frame loop), Practice. The result and stats overlays cover the whole stage (the card is too tall for the board on a phone); the restart confirm still covers the board only. The finished daily's result stays up (no close button; see LATER).
- **Practice:** `levels/practice.json` loads behind the first board. Unlocked when `stats.lastN >= today's #N`. "Practice #k" (k = index + 1) plays `boards[index mod 500]`; the index bumps the moment a practice win commits. Practice restarts need no confirm (nothing on the record). An unfinished practice board stays in memory while the player visits the daily. After a midnight rollover practice relocks; "Next practice" then goes to today's flock.
- **Menu** (header ≡ button, replaces M1's "?"): Stats, How to play, Sound on/off, Practice (only when unlocked, hidden otherwise), Today's flock (when not on the daily). Stats can open over the result panel. Esc closes the menu and stats.
- **First-time hints:** a board queues its unseen elements (mud, black sheep, pond, in that order). The first shows on open; each counted swipe shows the next; the last stays until the win. Each is marked seen when shown. The hint line keeps its height when empty so the board never resizes mid-play.
- **Events:** `apply()` pushes timed events (swipe, stop, pen, splash, win, bump) into a 32-slot ring; the frame loop drains those due and sends them to `Audio.play()` and the particle pool. A fast-forward (third rapid input) drops the snapped animation's unheard events, so there's no burst of stale bleats. Bleats on plain stops are capped at `audio.bleat.maxPerSwipe` (2) per swipe; pens always bleat (higher) and latch.
- **Audio:** WebAudio synth, all parameters in `config.audio`. The context is created/resumed inside the first pointerdown/keydown/touchend (and again whenever it's suspended). `Audio.play()` counts every call even when muted, silenced or locked; selfTest silences it and checks the counts on its real swipe path.
- **Art:** kept M1's look; added flowers, lily pads, straw, moss, rail highlights, wool highlights and blush, two trot frames while a sheep runs, a separate ground shadow (a hop lifts the sheep, not its shadow), penned sheep settle to `pennedScale` as the gate shuts, one hop per penning (after the gate shuts), a staggered two-hop flock jump on a win (`resultDelayMs` raised to 900 so it plays before the panel), and particles: splash droplets, pen sparkles, win wool puffs, tiny stop dust. Particles spawn inside the grid and use a fixed 64-slot pool with positions computed from spawn time.
- **Cache check:** on `pageshow`, `visibilitychange` (to visible) and `focus`, `Render.check()` reads the centre pixel of the field layer and a sheep sprite through a 1×1 `willReadFrequently` probe; if either is blank it drops the caches so the next draw rebuilds them once.
- **Versions:** scripts/CSS `?v=3`, `config.json?v=3`, levels `?v=1-20261001-105-r3` (`config.dataVersion`; the `-rN` suffix bumps without a rebake).
- **selfTest (M2 additions):** the audio hook fires on the 20-board real swipe path (a whistle per swipe, a latch per penned sheep, a win per board); share text is exactly header + squares (≤ 7 a row, one per counted swipe, splash included) + URL, via a full-string regex, and carries no direction run or `sol`; the action log replays to the same swipes, squares, history and board; stats maths (streak, gap, max, buckets, no double count); a practice finish bumps only the practice index; a corrupted save sanitizes; the render caches read non-blank.

## 9. Studio checklist (every milestone)

- `?v=` bumps on scripts, the CSS link, **and** every `fetch()`; `index.html` revalidates.
- Test once in a tab loaded while hidden (rAF starves, so use `tick`).
- selfTest asserts through the player's own entry points.
- `elementFromPoint` check on every primary button.
- No `setTimeout` for state transitions; run animation and delays on frame time.
- Solver/simulate calls in the page use cloned state, and the stored save stays byte-identical.
- A quick tap never does something irreversible.
- Clamp and sanitize every numeric field on save load.
- Zero console errors through a full solve, a bronze finish, and a restart.
- Total payload ≤ 20 MB (expect well under 1 MB).

## 10. Out of v1

See `LATER.md`.

**M2 fix pass (2026-09-26, critic `into-the-fold-critic-m2.md`)**
- **Rollover never touches a finished daily's result.** Only an untouched daily swaps at once. A daily in progress, or won and waiting for its result, or with its result on screen, stays; `pendingRollover` is set instead. When the date turns while the result is up (or before it shows), the result keeps its Share and stats and swaps its footer to "A new flock is ready." with a **Today's flock** button (the menu shows Today's flock too). The swap happens when the player leaves the result, or on the next `pageshow`/`visibilitychange`/`focus` once the result has shown. The countdown hands over to the date check the moment the local date changes, so it never shows a fresh 24 hours. selfTest §12 replays the critic's repro on the live page path (Sat #6 one swipe short, date to #7, win, a page show while the result is pending) and asserts no swap, #6's share text and Share button, stats `lastN` 6, and that leaving the result opens #7.
- **Pens read as doorways.** No rail on the open side; the floor runs out to the cell edge. A flat doorstep mat (straw for white, pale slate for black) with a chevron pointing in sits on the ground in front of the open side, drawn under the terrain. The gate is a double gate on two doorway posts that stands swung INTO the pen (`config.board.gateOpenDeg`, 80) and swings shut to meet across the doorway on penning. Nothing is drawn on the ground outside a pen except the mat. The black pen's slate floor has flagstone joints.
- **Mud is flat ground:** a wide low brown spread with a damp halo into the grass, one long puddle with a sky sheen and a short trail of cloven hoof prints. No raised rim, highlight or cast shadow, so it can't read as a rock (and it's darker and flatter than a rock in greyscale).
- **Black sheep** get a light cream rim (`woolLine.b`, wider than the white sheep's), so they read on slate, mud and shadow.
- **Layout:** the column is centred (auto margins above the header and below the toolbar), the stage is exactly the board's height (`layout()` sizes the board from the app's inner height minus everything else, observing `#app` and `#hint`), phones run the board edge to edge, and tall phones (≤ 480 wide, ≥ 740 tall) get a roomier header/HUD and 56 px buttons. Result and stats cover the column below the header and only their cards take taps, so the menu button stays live. The menu card is placed under the menu button in JS; the toast sits at the bottom.
- **Hint line** is 44 px tall (48 on tall phones) and the tutorial Skip link is a 44 px hit area.
- **Versions:** `style.css`, `render.js`, `main.js` `?v=4`; `config.json?v=4` (new `board.gateOpenDeg`); levels unchanged.
