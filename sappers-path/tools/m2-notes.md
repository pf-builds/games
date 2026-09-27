# Sapper's Path: M2 notes

Builder notes for M2 (content and finish). Decisions are also in SPEC §7 (the 2026-09-27 M2 entry). Levels, engine, solver and generator are untouched (M0b bake, 36 levels).

## Run
```
nohup python3 /Users/peter/Documents/Claude/.claude/serve.py 8491 /Users/peter/Documents/Claude/business/D-click-it-studios/repos/games-sappers-path > /dev/null 2>&1 &
export PATH="$HOME/.local/opt/node/bin:$PATH"
PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/harness.mjs     # about 60 s, exit 0 = gate passed
node tools/test.js                                                              # 91 engine/solver checks, unchanged
```
Open `?debug=1` for `window.SP`. `SP.selfTest()` returns `{ok, levels, solved, stuck, buttons, show, chest, scenerySections, cues, ms, fails}`.

## Files
- `src/art.js` (new): all pixel art, painted in code on 16×16 logical grids (icons 12×12) and scaled with smoothing off. Tiles: ground, grass, rubble per material, stone brick courses, timber planks, hedge leaf clusters, cracked ice, riveted iron, moat (4 wave frames), lever (up / mid / thrown), chest (shut / open), keep with a goblin flag (shut / open). Character sheets (6 frames each: 0-3 walk, 4-5 work or taunt): mason, axeman, goat, torchbearer, crowned goblin. Scenes: title castle, portrait banner (goblin on the battlements, night sky in World 4), world-map strips (the trail runs through the node centres). Every colour is in `config.art`.
- `src/show.js` (new, pure, UMD so Node can check it): the presentation timeline for a break (walk, swings, crumble rings, lever, doors, light, chests, keep and goblin march), `advance()` for due events, `finish()` for the skip, `crewAt()`/`goblinAt()` into a reused object.
- `src/audio.js` (new): WebAudio synth driven by `config.audio.cues` recipes; the context is made on the first gesture (no autoplay warning); records the last cue and per-cue counts even when muted or quiet.
- `src/render.js`: board drawing only now. Scales `Art.sources()` to the cell size, bakes the layer (grass margin, rubble for broken walls, scenery muted, badges), draws the moat wave frame, the show overlays (standing tiles until they pop, the pop hop, door swing, lever frames, chest pop, closed keep until its moment, crew and goblin sprites), then the M1 effects. The frame path uses index tables (`matT`, `moatT`, `sheetT`) and inline edge tests, so it builds no strings or closures.
- `src/game.js`: `scenery(B)` and the `scenery` tap result (SPEC §7). Nothing else changed.
- `src/main.js`: title, world map (unlock rule, locks, stars, the pulsing next node), debug select, teaching hint card, banner, toggles (2×, mute; both saved), show wiring (sounds, dust per ring, chest fly and card bump, panel timing, skip), board nudge on bad taps, star reveal, facade and selfTest.
- `index.html` / `style.css`: `?v=3` on every script, the CSS and (via main.js) the config and levels fetches.
- `config.json` v2: `unlock`, `show`, `audio`, new `fx` and `layout` keys, the full art palette.
- `tools/harness.mjs`: the M2 gate (below).

## Feel
- A break: the crew walks in from the edge along lit ground (about 95 ms a tile, at most 5 tiles, fade-in when it starts further out), swings twice at the contact tile (clink / thunk / bleat then munch / sizzle), and the section pops ring by ring from the contact tile (55 ms a ring) with a tick and dust per ring. Newly connected ground brightens as the last ring goes. Mean show 1.57 s at 1× over all 128 baked-line breaks (max 3.6 s, a win with the goblin march); exactly half at 2×.
- Levers clank and swing through a mid frame; their doors fold open on the left hinge, tile by tile from the lever. A claimed chest hops open with a chime, a +1 badge arcs to its card, the card count bumps when it lands.
- A win: the keep stays shut until the light reaches it, then opens with a burst and a fanfare, the crowned goblin taunts on the keep and marches toward the nearest edge, the panel slides up and the stars pop in one at a time with a rising chime.
- Bad taps (blocked, iron, crew at 0): the M1 section shake and wall flash, plus a small board nudge and a low buzz. Locked map nodes shake with a lock sound.
- Skip: any tap during a show finishes it at once (no burst of queued sounds) and is then handled normally. A tap after a win brings the panel in 200 ms.

## Gate results (harness, 2026-09-27, exit 0)
| | desktop 1280×720 mouse | phone 375×812 touch (DPR 3) |
|---|---|---|
| selfTest | ok, 36/36 solved, 69 ms, 283 button checks | ok, 36/36 solved, 83 ms, 272 button checks |
| wins (real taps, 3 stars, stars revealed) | w1-05, w2-05, w3-06, w4-06 | same |
| stucks (real taps; panel Undo, rail Restart) | w1-t3, w2-02, w3-02, w4-02 | same |
| title → map → level 1 | 2 taps; a locked node (1-2) stays on the map with the lock cue | same |
| elementFromPoint (harness, per screen) | title 1, map 39, play+hint 7, play 6, each win and stuck panel | title 1, map 28, play+hint 7, play 6, same panels |
| skip | show active → a real tap mid-show → inactive, the tap picked | same |
| 2× | 1505 ms → 753 ms (ratio 0.500) | same |
| mute persists across reload | muted, aria-pressed true | same |
| rAF frames while a show plays | mean 16.7, p95 16.7 ms | mean 16.7, p95 16.8 ms |
| `SP.bench(300)` script time per draw, crew picked | 0.40 ms (639²) | 0.96 ms (1068²) |
| console errors / warnings | 0 / 0 | 0 / 0 |

- Other portrait sizes: 390×844 board 371 px, banner 252 px; 768×1024 board 541 px, banner 262 px. Every play button hittable, cards and Undo/Restart in the bottom third. 0 console messages.
- Portrait 375×812: board 356 px square (top at 298), banner 236 px above it, rail from 654. The M1 air above and below the board (about 130 px each) is now the banner.
- Hidden-tab load: selfTest ok while hidden; a whole level played on `SP.tick`: show active and panel null before the tick, win panel and show over after; after show the loop ran (+383 ms), board fully opaque, no blank sprites. Cache drop: 49 canvases blanked (33 checks read blank), `visibilitychange` → 0 blank, 1 rebuild.
- selfTest also covers: the unlock rule on a scratch save (fresh locks, world 2 opens on exactly the 6th world-1 win), the show (built on a break, fast-forwarded by the next tap, 2× halves it, its sounds fire), a chest on a line (w2-t1: the card holds the +1 back, then chime, arrival pop, bump, real count), the hint card (shown, hittable, dismissed, stays dismissed), mute, the scenery rule on a hand-made moat-sealed board, and the opaque checks on all five character sheets.
- Cues fired in one selfTest: ui 374, tick 211, star 108, undo 45, fanfare 36, clink 30, thunk 22, bleat 11, munch 11, clank 10, door 10, sizzle 9, bad 3, lock 1, chime 1, pop 1.
- Payload: 13 files, 193.1 KB total on a cold load, 0 external requests.
- Scenery sections in the final bake: 0 (the rule is live and tested, but nothing in the 36 levels triggers it).

Screenshots in `tools/shots/m2/` (not committed): `375x812-{title,map,midplay-w1..w4,crumble,stuck,win,gray-w4}.png`, `1280x720-{midplay,win,stuck}.png`, `390x844-{play,hint}.png`, `768x1024-{play,hint}.png`, `hidden-load-after-show.png`, and `report.json` with every number.

## Cut or waived
- Nothing on the cut list was cut: the desktop side column has the banner scene, the goblin march is a simple taunt then walk-out, and the moat moves (4 wave frames at 280 ms, redrawn only when the frame changes).
- The goblin march is the "simple version": the goblin taunts on the keep, walks up to 6 tiles toward the nearest edge, and waits there. Richer ideas are in LATER.md.
- Lever cascades animate all at once (every lever the break exposed, then every door). The bake has no deliberate multi-step cascades (cut in M0b), so this reads correctly on every level today.

## For the critic
- The show never gates input, but the card count for a chest crew shows the old number until the +1 lands (under 0.6 s at 1×). Tapping the card during that time skips the show first, so it is always playable.
- The pickaxe badge is the weakest icon at 11×11 boards on a phone. It reads, but it is the first candidate for a redraw.
