# Sapper's Path v3 M1 notes (the page)

M1 replaced the v2 page with the v3 game on the v2 shell. Peter's brief after M0: "I want to see its next version. Like the sappers running up and bring the colors back." Tuning changes are in `tools/v3-m1-rebake.md`; rule and design decisions are in SPEC-v3 §9.

Page: http://localhost:8491/sappers-path/ (`?debug=1` for the `SP` facade). Screenshots from the harness: `tools/shots-v3-m1/`.

## Files

| File | What it is |
|---|---|
| `index.html`, `style.css` | New v3 page. v2's skin: stone and gold buttons, parchment panels, Jersey 10, castle-wall background. All at `?v=7`. |
| `src/board.js` | New. The block renderer, the yard and crates, and the run-and-carry show. |
| `src/main.js` | New. Boot, screens, tray, holding line, map, panel, save, frame loop, and the facade with selfTest. |
| `src/save.js` | Rewritten for `sappers-path.v3`: a win bit per difficulty, settings, last level, sanitized on load. |
| `src/art.js`, `src/audio.js` | Reused from v2 (title scene, wall texture, crowned goblin sheet; the WebAudio synth and cues). |
| `src/engine.js` | Unchanged from M0. |
| `tools/harness.mjs` | Replaced (v3). |
| Deleted | v2's `src/game.js`, `solver.js`, `show.js`, `render.js`, `tools/artmeta.js`, `artview.js`. Git tag `sappers-path-v2-fixed` keeps them. |

## The look

- **Blocks.** Each pixel is a rounded, bevelled block: a dark grout square, a rounded face in the material colour, a light top-left bevel, a dark bottom-right bevel and a stud glint. The face also carries a mark per material, so the fort reads in grayscale: bar, posts, hatch, planks, stones, dressed square, arrow loop (slate towers), chevron, bond, bars (iron gates), leaves, diamond rune, facets, and a key glyph on Gilt. Every number is in `config.json` `board`.
- **Ground** is the dark muted palette from `v3.ground`, with a light speckle so it doesn't look flat. The fort pops against it.
- **Frame.** The board sits in a light wooden frame (Food Hunt).
- **Yard.** Three rows under the grid hold a wooden crate per colour on the board. Crates fill bottom-up with mini blocks: one per pixel hauled while the colour fits the crate, scaled when it doesn't. A chip of the colour sits on each crate's lip. Two small tents mark the camp.
- **Sappers.** 8×8 pixel figures scaled crisp: a helmet in the crew's colour, a goblin-green face and a dark tunic, with two walk frames. A crew reads by its helmet. They're drawn at 1.25 cells.
- **Tray.** Solid colour cards with a block chip, a big count and the crew name; the next three cards are faded strips below, as in Food Hunt. Text is dark on light colours and white on dark ones.
- **Holding line.** Dashed empty spaces (6/5/4 by difficulty, from `v3.rules`). A filled space takes the colour, shows the count, and has up to four little sappers standing in it.
- **Archer ranges** are dashed red discs, drawn while any pixel of their tower is still on the board.

## The show (how the run-and-carry works)

1. **Tap.** `playCol` lands any running show (`fastForward`), then plays the card in the engine with the event log on. The tray, the line, and any win or fail update at once.
2. **`startShow`** reads the log. EAT events come in resolution order, and a RESUME starts a new segment. The eats are dealt to runners in batches of `ceil(eats / 96)` consecutive eats of one segment. Start times are staggered by `min(34 ms, 0.45 × cap / runners)`, which is what makes the lines.
3. **Launch** is lazy. A runner's route is built when its start time comes: a BFS from the camp over a working grid (the display grid plus every earlier runner's eats, gate cells included), walked down to the camp, then crate → camp cell → route → the face of the pixel. A fast-forward never pays for a BFS.
4. **Timing.** Walking costs 40 ms a cell and a bite 120 ms a pixel (3 pixels at most). If a runner's round trip wouldn't finish by `capMs` (3,000 ms), that runner is sped up just enough. At 2× the show clock runs double.
5. **Pops.** When the runner arrives, its pixels pop one by one: the cell is repainted as ground in the cached layer, and the block swells and fades. A key pops its whole gate. Each pop plays the rising tick. The runner then carries up to three mini blocks on its head back to its crate.
6. **Skip.** A board tap lands the show. A tap during the goblin skips to the panel.

**Performance.** Everything per-frame lives in typed arrays sized once: runners, routes, pop ring and event lists. Each frame draws one blit of the cached layer, the range discs, live pops, up to 96 runners (two `drawImage` calls each) and the idle camp sappers.
- Busiest play in the game (level 65, tap 16, 76 eats with its cascade): JS draw cost 0.05 ms mean and 0.2–0.3 ms max. Live rAF frames p95 16.8 ms at 375×812 and 16.7 ms at 1280×720 (headless Chromium).

## Screens and flow

- **Title:** v2's painted castle, the blurb, difficulty (Easy/Normal/Hard) and Play. Play opens the first unwon level: one tap from load to gameplay. The Era map button is under it.
- **Era map:** difficulty again, and three era chapters. Each has its one-line history note (from design.md Decisions §5, in `config.json` `eras`), a won count and 25 level nodes. Won nodes are gold with E/N/H marks, the next node pulses, locked ones are grey. A sticky "Play level N" button.
- **Level:** top bar with map, level number and era name, difficulty chip, Retry, 2× and mute. Teaching levels show their hint over the board until the first tap.
- **Win:** the goblin hops where the last pixel went and runs off the top; then the panel with "Fort razed!", **Next level** and Retry.
- **Fail:** the panel with the reason (overflow, no move, stuck, short), **Retry** and Era map.
- **Keys:** 1–5 play a column, R retries, Space skips.

## Facade (`?debug=1`)

- `SP.play(col)` is `playCol`, the same function the card's click handler calls.
- `SP.state()`, `SP.load(id | n, diff?)`, `SP.retry()`, `SP.tick(ms)` (16 ms steps, capped at 600 s), and `SP.solve(nodes?)` (DFS from the current position on a clone).
- `SP.selfTest()` runs all the checks below.
- Extras for the harness: `SP.winOrder(diff?)`, `SP.lossOrder(id?, diff?)`, `SP.busiest()`, `SP.perf(n)`, `SP.sprites()`, `SP.screen(name)` and `SP.skip()`.

## selfTest (480 checks, about 0.9 s)

- **Stored wins.** Every level's stored winning order, on each difficulty (225 replays), through `playCol`. Each must win, and the board display must match the rules state once the show lands.
- **Overflow.** A seeded careless order that overflows on level 46 (Normal), through `playCol`. The fail panel must name the reason, with Retry as its hittable primary button.
- **Key and gate.** On level 26, the gate stays iron until the play that eats the key, then every gate cell is open ground on the board.
- **Archers.** A hit on Easy and Normal (the sappers wait on the line) and a kill on Hard, on level 51, through `playCol`.
- **Show cap.** Every play of the largest fort, ticked to the end: longest 3,008 ms at 1× and 1,504 ms at 2×, with runners within the pool.
- **Save.** `solve()` finds a win and leaves the save byte-identical. The real save is byte-identical after the whole selfTest (it runs on a memory store).
- **Hit tests.** `elementFromPoint` on title Play, map Play, every front card, Retry and the win panel's Next.
- **Sprites.** Every opaque cache (blocks, mini blocks, ground tiles, the board layer) has no transparent pixel. The check copies each cache to a scratch canvas and never reads back from the cache itself (lesson 27). The page repeats it on `visibilitychange` and `pageshow` and rebuilds once if it fails (lesson 28).

## Harness (`tools/harness.mjs`, all passed)

Runs at 375×812 (touch taps) and 1280×720 (mouse clicks):
- selfTest passes.
- Title Play reaches level 1 in one tap.
- Level 1 is won through the card buttons. The goblin runs, the win panel shows, and Next opens level 2.
- An overflow loss is played through the card buttons on level 46. The fail panel names it, and one Retry tap restarts.
- A live rAF frame sample, and the draw cost, on the busiest play.
- The map button works.
- A garbage save sanitizes (only reachable wins survive; a bad difficulty clamps to Normal).

A hidden-tab run (`document.hidden` faked, rAF never fires) passes selfTest, wins level 10 on Hard and reaches its panel on `SP.tick` alone, with opaque sprites. Zero console errors or warnings across all three runs.

## Waived or left for M2

Teaching polish, gate/key/archer art beyond readable, archer-hit animation (a toast for now), the full juice and audio pass (v2 cues reused: pop on tap, rising tick per pixel, fanfare, chime, bad), portal-shape hardening (pause on blur, iframe resize), and the landscape-phone board size. All logged in LATER.md.
