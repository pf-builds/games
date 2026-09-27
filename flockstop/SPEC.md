# Flockstop: SPEC (v1)

Approved 2026-09-26 (Phase 0). Design source: `claude-workspace/business/D-click-it-studios/game-research/ewe-turn-kickoff-prompt.md` (the game was renamed from "Ewe Turn" after a name collision). This file is the build contract. Where it's silent, the builder decides and writes the decision here.

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
  Flockstop #N 🐑 9/7 🥇
  🟩⬜🟩🟦⬜🟩🟩
  🟩⬜
  https://pf-builds.github.io/games/flockstop/
  ```
  - One square per counted swipe, in play order, including swipes later undone. 🟩 means at least one sheep was penned on that swipe, ⬜ nothing penned, 🟦 splash. Rows hold at most 7 squares.
  - The medal emoji is 🥇/🥈/🥉.
  - It **must never contain directions** or anything that encodes them.
- **Stats** (local): played, current streak, max streak, par-or-better %, and a histogram of swipes over par (buckets: par or under, +1, +2, +3, +4, +5 or more). The streak counts consecutive local dates with a finished daily.
- **Practice mode** unlocks after today's daily is finished. It plays from a separate baked pool of 500 in a fixed order, with its own progress index. It never touches the streak or the daily stats.
- **Tutorial:** on first launch, the page opens straight into tutorial board 1 of 3. They're hand-made boards with a one-line inline hint each: (1) swipe moves every sheep, pen one; (2) sheep stop on each other, so use one as a stopper; (3) pens only open on one side. A "Skip" link goes to today's daily. The help button replays the tutorial. After the tutorial (or on every later visit), the page opens straight onto today's board: **0 clicks to play.**
- New elements get a one-time inline hint the first time they appear (mud, black sheep, pond).

## 3. Weekday ramp (provisional; M0 measures and proposes, Peter approves)

| Day | Size | Elements | Par band |
|---|---|---|---|
| Mon | 6×6 | pens, rocks | TBD by M0 data |
| Tue | 6×6 or 7×7 | + more sheep | TBD |
| Wed | 7×7 | + mud | TBD |
| Thu | 7×7 | + black sheep/pen | TBD |
| Fri | 7×7 or 8×8 | + pond | TBD |
| Sat | 8×8 | all | TBD |
| Sun | 8×8 | all | TBD |

Accept criteria per board (M0 proposes the exact thresholds from data):
- par inside the weekday band
- at least N dead-end branches, so it isn't trivial
- Wed+: the solution needs at least one sheep-as-stopper move
- Thu+: no sheep can be penned on swipe 1
- no two baked boards identical up to symmetry

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
flockstop/
  index.html         shell; every script/CSS tag carries ?v=N
  style.css
  config.json        all tuning: launchDate, medal thresholds, anim durations, swipe threshold, dataVersion
  levels/daily.json      {version, pools:{mon:[...],...,sun:[...]}}
  levels/practice.json   {version, boards:[...]}
  levels/tutorial.json   3 hand-made boards
  src/rules.js       PURE rules engine, no DOM; UMD so Node and browser share it
  src/solver.js      PURE BFS solver (uses rules.js)
  src/sym.js         8 board symmetries (pure)
  src/save.js        versioned save (key "flockstop.save.v1"), sanitize/clamp every field on load
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
- Board JSON format (compact, human-readable): `{"w":7,"h":7,"rows":["..R....","..."],"pens":[{"x":3,"y":0,"open":"S","c":"w"}],"par":8,"id":"wed-012"}`. The row legend lives in rules.js.

## 8. Debug and test hooks (`?debug=1` only)

`window.FS` exposes:
- `state()`: a deep copy of the current state.
- `swipe(dir)`: goes through the **same input facade** as touch and keys.
- `undo()`, `restart()`
- `solve()`: runs on a **cloned** state. It must leave the stored save byte-identical.
- `tick(now)`: a manual frame step for hidden tabs.
- `setDate("YYYY-MM-DD")`: overrides "today" for date-rollover tests.
- `selfTest()`: loads 20 baked dailies spread across the weekdays, plays each solver solution through `FS.swipe`, and asserts a win at exactly par. It also asserts undo/restart counting, splash counting, the no-direction share text, and that the save is byte-identical after `solve()`. It returns `{pass, failures[]}`. The run happens on a scratch save namespace, so it never touches the player's real save.

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
