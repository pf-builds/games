# Sapper's Path: SPEC v3 (pixel siege)

Contract for the **v3 web build**. Design source: `claude-workspace/business/D-click-it-studios/game-research/sappers-path-v3/design.md` (decisions, eras, the road to 2,000, monetization, business case). There's also a concept page with a playable core-loop prototype: `.../sappers-path-v3/concept.html` (https://claude.ai/artifact/XeLcR7cDXnubmq9qKu7cRp). The prototype's `fit`, `deal` and `eatOne` are the reference behaviour.

Earlier builds are preserved: v1 at tag `sappers-path-v1-playtest`, v2 at tag `sappers-path-v2-fixed`. `SPEC.md` (v1) and `SPEC-v2.md` stay for history. **Where this file is silent, the builder decides and logs the decision in §9.**

## 1. The game in one line
Squads of sappers, each with a colour and a count, eat a top-down pixel fort from the siege camp outward-in, one pixel each, always the nearest reachable pixel of their colour. Raze every pixel to win. Sappers with nothing to reach wait on the holding line; if it overflows, the assault fails. The reference loop is Food Hunt: Pixel Puzzle.

## 2. Board
- A W×H grid, capped at 36×48 so every pixel reads on a 375 px phone. Era 1 is ≤28×36, Era 2 ≤32×40, Era 3 ≤36×48.
- Cell values:
  - a material id (> 0); up to 12 per fort, from the rainbow palette in the concept page's `MATS`
  - `GRASS`, `DIRT` or `CAMP`: walkable
  - `WATER`: blocked
- The camp is a strip on the bottom edge, about 4–8 cells wide and 2–3 deep.
- **Walkable** means grass, dirt or camp. **Connected ground** is walkable cells 4-connected to the camp.
- A material pixel is **reachable** if it's 4-adjacent to connected ground.
- **Distance to a pixel:** the smallest BFS distance, from the camp over connected ground, to a walkable neighbour of that pixel. Ties go to the smallest y-distance to the camp row, then the lowest x.

## 3. Squads, tray and holding line
- **Squad:** `{material, count}`.
- **Tray:** 5 columns (queues). Only the front card of each column can be played, and the next 3 cards are visible behind it.
- **Playing a card:** the squad eats `count` pixels one at a time, each time the nearest reachable pixel of its material. An eaten pixel becomes `DIRT`, and reachability updates after every pixel.
- **Leftovers:** if the squad runs out of reachable pixels, its remaining sappers join the **holding line**. They merge into an existing entry of the same material, or take a new space.
- **Holding capacity** is set by difficulty: Easy 6, Normal 5, Hard 4. A new entry past capacity means **fail**.
- **Resuming:** after every play, in line order, any holding entry that has a reachable pixel resumes automatically, and this repeats until nothing changes.
- **Logical resolution is instant at the tap,** including the cascade of resumes. Animation is presentation only and never blocks input; a tap during animation fast-forwards it.
- **Win:** no material pixels left.
- **Fail:**
  - the holding line overflows, or
  - the tray is empty and no holding entry can resume, or
  - the tray is non-empty but every front card's material has no reachable pixel and there's no room left to hold them. The builder confirms this rule in M0.
- **Retry:** one tap restarts the level. There's no undo in the base game; undo is a future power-up.

## 4. Obstacles in v3.0
- **Locked gate and key (Era 2+):** a gate is a set of iron pixels that can't be targeted until its key is eaten. The key is a Gilt pixel, eaten by the Looters crew. When the key goes, its gate opens and all its pixels become `DIRT`. The deal's winning order must take the key before the gate.
- **Archer towers (Era 3):** a tower is a set of its own material's pixels with a range R that's visible on the board.
  - **Intent:** while any tower pixel stands, a sapper whose target pixel lies inside the range is hit. The pixel isn't eaten.
  - On Easy and Normal, that sapper goes to the holding line. On Hard, it's lost (Peter's decision).
  - Tower pixels themselves can always be attacked.
  - **M0 finalises the exact rule from measurements** and logs it. It must stay deterministic and readable.

## 5. Levels and difficulty
- **v3.0 content:** the history tour's first half, Eras 1–3 with 25 levels each (75 total).
  - Each era opens with a hand-authored teaching level for its new mechanic.
  - Era 1 levels 1–3 teach the tray, then the holding line, then "squads bigger than what's open".
- **Difficulty is compressed for the web build,** so the portal test and Peter's playtest both reach the tight late-game feel. Graded by the solver:
  - **Levels 1–15:** random-tap win rate ≥ 85%.
  - **16–45:** 30–80%, saw-tooth.
  - **46–75:** mostly under 10%, with the hardest having 1–3 winning orders, and a relief level after each hard cluster.
  - The app build later stretches this curve to 2,000 levels.
- **Grading:**
  - the random-tap win rate over N seeded playouts (N in config)
  - a capped search count of winning orders (cap in config)
  - the length of the solution
  - the peak holding-line usage on the winning line
- **Knobs:** holding capacity; squad size against the reachable count at deal time; deal depth (how early deep materials sit in the columns); colour interleaving across layers; the obstacles. **Size is not a knob.**
- **Generation:**
  - era style rules with seeded parameters
  - deal by simulating a winning order (the concept `deal`), plus tightening passes (card swaps, squad resizing) until the level lands in its band
  - reject near-duplicates
  - deterministic bake to a versioned `levels/levels.json`, with pools kept
  - the baker never throws: it logs and falls back
- **Performance:** grading must be fast enough to bake several thousand candidates in minutes. Use incremental distance updates rather than a full BFS per pixel; the concept code is the slow reference.

## 6. Look and feel
- **Board:** Food Hunt's block look. Each pixel is a bevelled block in its material's rainbow colour, and ground and water are muted and dark. It must still read in grayscale (texture or pattern per material, at least on the stones).
- **Camp and animation:** tents plus idle sappers at the camp. On a play, sappers march out along connected ground and pop pixels one by one, with rising ticks. The show is capped, with 2× and tap-to-skip.
- **Tray and holding line:** tray cards show the colour swatch, crew name and a big count; the next 3 are faded behind. The holding line has visible spaces, and filled ones show their colour and count.
- **Win and fail:** win when the keep's last pixel goes and the crowned goblin flees. Fail shows a clear reason and a one-tap Retry.
- **Screens:** title, then the map (3 era chapters with history notes and level nodes), then the level. The map's Play button goes straight into the next unbeaten level.
- **Portal shape:** at most 1 click to gameplay, no outbound links, fonts self-hosted, iframe-safe resizing, pause on blur.
- **Reuse** the v2 shell wherever it fits: the skin, Jersey 10, audio synth, save pattern, map, facade and harness.
- **Save** under a versioned key (`sappers-path.v3`), sanitized and clamped on load.

## 7. Facade and tests (`?debug=1`)
- `SP.play(col)`: the same function the card tap calls.
- `SP.state()`, `SP.load(id)`, `SP.retry()`, `SP.tick(ms)`, `SP.solve()` (on a clone), `SP.selfTest()`.
- **selfTest** replays each level's stored winning order through `play()`. It asserts:
  - the win
  - a fail by overflow on a level built for it
  - the key and gate
  - an archer hit on each difficulty
  - the save is byte-identical after `solve()`
  - `elementFromPoint` on primary buttons
  - sprite caches are opaque
- **Node tests:** hand-made boards with known answers for reachability, the nearest-pixel tie-break, the holding merge and resume cascade, overflow, the key and gate, and archers.

## 8. Studio checklist
All the /game-forge lessons apply:
- `?v=` on scripts, CSS and every fetch
- `index.html` revalidates
- a hidden-tab load test
- no `setTimeout` for state
- bounded loops
- selfTest runs through the player's entry points
- `elementFromPoint` on every primary button
- the critic re-implements the rules and diffs them against every baked level (lesson 53)
- critics receive Food Hunt store screenshots (memory: reference screenshots first)

## 9. Decisions log (builders append)
- 2026-09-28: v3 approved in design.
  - win = raze every pixel
  - tray shows 3 cards behind the front
  - archers lethal on Hard only
  - Eras 1–3 first
  - one-line history per era
  - rainbow palette
  - phone cap 36×48
  - compressed difficulty curve for the web build
- 2026-09-28 (kickoff review, Peter approved):
  - **Winnable per difficulty.** A Hard archer kill takes sappers out of play, so the counts no longer sum to the fort. Grade each level on Easy, Normal and Hard separately, and store a winning order for each. A level ships only if all three are winnable. selfTest replays all three.
  - **No archer re-hit loop.** On Easy and Normal, a sapper sent to the holding line by an archer must not resume straight back into the same range and get hit again. M0 picks the rule, for example a hit entry stays parked until that tower falls, or resume skips covered pixels. Log it here. Resolution stays bounded.
  - **Bands are graded on Normal (5 spaces).** §5's 85% / 30–80% / under-10% bands refer to Normal. The report also lists the Easy and Hard rates for every level.
  - **Reference screenshots** are in the workspace at `business/D-click-it-studios/game-research/sappers-path-v3/reference/` (4 images plus a README). The visual critic gets all four. Numbered panels and lock tiles in them are out of scope.
  - **After the fix pass,** re-run the functional critic's rule re-implementation and level diff before the playtest gate. v2's fixes were never re-checked.
  - Peter hasn't played the concept prototype yet. The M0 report should include a quick feel check: a playable debug board of one level per band, so he can judge pixel size and holding-line tension before M1.
