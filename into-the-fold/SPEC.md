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
  src/save.js        versioned save (key "intothefold.save.v1"), sanitize/clamp every field on load
  src/daily.js       date → puzzle #N → board (pure given a date)
  src/render.js      canvas drawing + sprite caches
  src/audio.js       WebAudio synth
  src/game.js        state machine, input facade, animation
  src/main.js        boot, debug handle
  tools/gen.js       random board generator + accept filter
  tools/report.js    par-distribution report → tools/par-report.md
  tools/bake.js      deterministic seeded bake → levels/*.json (a below-band fallback never throws)
  tools/test.js      node unit checks for rules + solver
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
