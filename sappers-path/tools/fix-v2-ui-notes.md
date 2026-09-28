# Sapper's Path v2: UI fix pass notes

This is the UI-side fix pass after the v2 critics: `tools/critic-v2-visual.md` (0 blockers, 7 MAJOR, 13 MINOR) and the UI half of `tools/critic-v2-functional.md`. The generator side (castle shape, camp size, density, the `art` metadata, closest margin, curve) landed separately in 6aefd5f, and this pass renders on that bake.

Files: `index.html`, `style.css`, `config.json`, `src/art.js`, `src/render.js`, `src/show.js`, `src/main.js`, `src/save.js`, `tools/harness.mjs`. The engine, solver, levels and generator were not touched.

## Run
```
nohup python3 /Users/peter/Documents/Claude/.claude/serve.py 8491 /Users/peter/Documents/Claude/business/D-click-it-studios/repos/games-sappers-path > /dev/null 2>&1 &
export PATH="$HOME/.local/opt/node/bin:$PATH"
PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/harness.mjs   # about 2 min, exit 0 = gate passed; shots in tools/shots/v2fix/harness/
```

## Visual critic MAJORs

| # | Finding | Status | What shipped |
|---|---|---|---|
| 1 | The board reads as a floor plan (render half) | **Fixed** | See the detail under this table. |
| 2 | The camp is invisible, and no crew shows at rest (render half) | **Fixed** | See the detail under this table. |
| 3 | The chest badge and the flag are the same sprite | **Fixed** | See the detail under this table. Tested on w4-10 and w4-09, where a chest and a flag sit next to the keep (`after-chestflag-w4-10*.png`, `wip-info`). |
| 4 | Levers are unreadable at 375 | **Fixed** | See the detail under this table. |
| 5 | The eat dissolves instead of crumbling | **Fixed** | See the detail under this table. |
| 6 | The win shrank with the cell | **Fixed** | See the detail under this table. |
| 7 | The landscape board is 10 px a cell | **Fixed** (see the note under this table) | See the detail under this table. |

MAJOR 7 note: the cell is 11 px in landscape, not the 12 px target. At 375 px of height, 32 rows plus margins top out at 11.2 px, so 12 needs a rotated board. Rotating the board changes Rule A's tie-breaks, which would put the baked lines at risk, so that stays in LATER.

**1. Castle picture** (`art.js compose`, from `level.art`):
- **Towers:** each tower rect gets a cap over its standing blocks only.
  - Square towers get a merlon ring round a darker roof walk.
  - Square footprints get a round cap (a circular merlon ring) when chosen by position.
  - Ground south of a tower gets a 4 px shadow, against 3 px for a wall.
- **Gates:** each gate gets an arched portcullis on its `side`. The material texture still shows through the arch.
- **Decor:** bush, well, cart, flowers and barrel are 8×8 sprites. `path` is lightened trodden earth.
- **Battlements:** every wall edge that faces open ground now carries merlons and crenels (2 px). Before, it was a flat bevel.
- **Rubble:** rubble takes the ground of the nearest open cell (see MINOR 7).
- **No metadata:** without `art`, the picture still works. You get battlements, shadows and the camp, but no caps, gates or decor.

**2. Camp:**
- **Trodden earth:** the P cells plus `campPad` 1 of field get trodden earth, and it runs into the margin ring.
- **Tents:** 13×11 art px, about 1.6 blocks, with striped canvas, a door and a crew-coloured pennant. They stand along the outer camp row.
- **Standard:** a red and gold swallowtail war standard stands at the far end.
- **Idle crews** (`render.js drawCamp`):
  - One sprite per crew the level uses, in card order, spread along the inner camp row.
  - A crew is dimmed to `campDimAlpha` 0.35 at 0 left, and it's away while its crew walks.
  - Each bobs 1 art px on its own beat (`campBobMs`).

**3. Flag vs chest:**
- **Flag:** a wood pole with a gold finial and a 26×18 art-px swallowtail banner in the crew card's colour (`art.flagFill`). The crew's icon sits on a cream plate. The banner ripples in 3 frames every `flagWaveMs` 240, so a flag moves.
- **Chest:** the chest is a 12×10 art-px pixel chest in the picture. Above it sits a static 28×16 chip: the crew icon on cream, plus a gold "+1".
- **Grayscale:** they differ in shape (pole and swallowtail against a box and chip).

**4. Levers:**
- A 14×14 art-px sprite (1.75 blocks, 25 CSS px at 375 on W4).
- Gold plate with a highlight and a dark slot, a wood handle and a red knob. When thrown, the handle is mirrored and the knob is gold.
- A white four-point glint on the knob: 330 ms in every 1500 ms (`leverGlint*`).
- The show patches the whole sprite while the lever swings.

**5. Crumble:**
- **Swell and pop:** each block swells to `popSwell` 1.3 with a white flash, then shrinks away.
- **Wave order:** blocks the wave hasn't reached stay exactly as they were. There's no global fade.
- **Rubble chunks:** sized in CSS px (`chunkMinCss` 4; 4 to 5.7 CSS px at 375 on W4), inked, and sprayed away from the contact tile (`chunkSpray`).
- **Dust:** puffs are at least 5 CSS px and swell 60% as they fade.
- **Helpers** (`show.js`): one mini-crew per `helperCells` 24 blocks, at most 4. They fan out from the crew along the wave front, each taking the nearest cell of every ring and chewing on the work frames, then fade as the crew heads home.
- **Cap:** still `eatMaxMs` 900. w4-t1's 144 blocks run 37 rings in 900 ms.

**6. Win:**
- **Rays:** they reach `raysMinCss` 130 CSS px past the keep (v1: about 105).
- **Line width:** at least `rayWCss` 7.
- **Board flash:** the whole board flashes (`boardFlash*`).
- **Goblin:** the frame is at least `goblinMinCss` 66 CSS px (v1: about 63; v2 before: about 46).
- **Confetti:** 140 flakes, at least 4 CSS px. Half burst from the keep at `confettiBoard` 1.3 board heights a second; half rain from the top across the width.
- **Evidence:** `after-win-w4-{260,500,1100}.png`.

**7. Landscape:**
- **Layout** (`body.wide`): the top bar folds into the side column (map and HUD on one row, level number and name below).
- **Compact** (height 480 or less): the banner scene goes, leaving the world tag and toggles, and the side column narrows to `sidePxCompact` 196.
- **Board at 812×375:** 271×359 at 11 CSS px a cell, at y 8 to 367, so it's off the bottom edge with an 8 px margin.
- **`fit()`:** no longer clamps the cell up past the box, so the board can never overflow again.
- **Desktop 1280:** the cell is 21 (it was 19). See MINOR 11.

## Visual critic MINORs (13/13 in my files fixed; none belonged to the generator)
1. **Flags overlap:** **fixed.** Flags within `flagFanCells` 2 of each other fan apart. The outer ones lean out on angled poles (`flagLeanCells` 0.45), the left ones mirrored; a middle one stands taller.
2. **Ice flag invisible:** **fixed.** The banner fill is `flagFill[3]` `#3f86b0`, and every banner is its material colour, not a white disc.
3. **Target extent not shown:** **fixed.** Each flagged section gets an ink and glow inner rim (`targetRim`, `targetRimAlpha` 0.55). It's baked once per flag set and fades in with the flags.
4. **Disabled cards hard to read:** **fixed.** The card goes dark (`#544e5c`) and the icon fades to 0.45, but the count and label stay cream at full strength: 6.7:1 (it was 2.6-3.1:1).
5. **Mixed pixel scale:** **fixed for flags and chips.**
   - Flag banners and chest chips are pixel art, scaled by a whole number k (about 0.6 of the board's art pixel, never smaller than an 11 CSS px icon). The lever and chest are drawn on the board's own grid.
   - `blockPx` stays 8, because the textures are designed on 8 px blocks; W4 at 6 is noted in LATER.
6. **Mixed fonts:** **fixed.** Jersey 10 is used for the card labels (18 px, 22 px on desktop), hint text (20), panel line (22), title blurb (21) and the load note.
7. **Rubble looked like placeholder tiles:** **fixed.** Every wall cell takes the ground of its nearest open cell, found by a BFS through walls. Outer walls in the field leave grass with a few overgrown chunks; inner walls leave courtyard rubble.
8. **Hint covers the board:** **fixed.**
   - Portrait: the hint docks over the banner, and the toggles move into the top bar while it shows (`body.hinting`).
   - Wide: it takes the banner's place in the side column.
   - It only sits over the board when there is no banner.
9. **Claimed chest looked unclaimed:** **fixed.** A claimed chest is drawn open and empty, with the lid thrown back, and loses its chip.
10. **Misleading toast:** **fixed.** A 0-count card whose crew is waiting in an unclaimed chest says "Open the chest to get masons".
11. **Wide desktop gutters:** **fixed (desktop).** The folded top bar gives the board the full height: 1280×720 W4 is 21 px a cell (was 19), 516×684.
    - 768×1024 is height-bound at 22 px either way, so `#app` max-width stays.
12. **Grayscale moat and grass:** **fixed.** The moat base is `#316296` (about 15% darker). Luminance is now 0.12 for the moat against 0.35 for the grass (the moat was 0.17).
13. **Map 4-4-1:** **fixed.** `mapCols()` drops to 3 per row when 4 would leave a lone node, so 9-level worlds snake 3-3-3 (`after-map.png`).

## Functional critic, UI half
- **M1, make "closest" readable: fixed.**
  - An info tap on a wall its crew can reach draws two dotted walks from the camp until the next tap: to the crew's flagged wall (dots in the crew colour) and to this wall (cream dots). Each ends in a ring on its contact tile.
  - The note gives both step counts (for example "Torchbearers: flagged wall 9 steps / this wall 28 steps"), or "break this next / N steps from the camp" when they're the same wall.
  - Unreachable walls say so and draw nothing.
  - A card tap, undo, restart, or any other board tap clears it. It never changes state.
  - selfTest now checks the game serializes the same (and `ver` is unchanged) across every info tap, the note's step counts, and that the walks clear on the next tap.
- **m3, the hitch at the tap: fixed and diagnosed.**
  - The 83-100 ms frame is the browser's first `new AudioContext()` (`Audio.unlock`: 104-106 ms, measured). It only happens on the page's first gesture in a fresh browser process, and the before build shows it too. In play the first gesture is always the title's Play, never a card.
  - The game's own work at a call was also cut: the pre-call layer becomes the prev layer (`Render.adoptPrev`), so a call bakes one picture instead of two, and that one a frame later (`draw()` shows the prev picture for the walk's first frame, which has the same pixels).
  - The harness `tapRun` (a fresh browser, real Play tap, then a real card tap on w4-t1's 144-block eat) measured, over 3 runs:
    - Play tap: one long task of 104-109 ms (the audio start)
    - card tap, cold: max frame 16.8 ms, 0 long tasks
    - warm: 16.8 ms
- **m4, sanitize: fixed.** `sanitize(raw, ids, maxCrews, rules)` checks each record against the level's rules:
  - best at least min, or it is dropped
  - stars equal what that best earns under the offsets
  - locked levels, judged on the sanitized stars before them, keep nothing
  - `last` must be open
  - It never throws; the whole body is in a try block.
  - selfTest covers raise, lower, below-min, locked, gap and junk (`__proto__`, NaN, ±Infinity, arrays).
- **m5, doc drift: fixed.** The `save.js` header names `sappers-path.v2` and says `v` is the payload format. The format didn't change, so `v` stays 1.

## Gate (harness, final run: see the numbers at the bottom)
| | desktop 1280×720 mouse | phone 375×812 touch (DPR 3) |
|---|---|---|
| `SP.selfTest()` | ok, 38/38, 296 button checks, 211 flag checks | ok, 38/38, 276 button checks, 211 flag checks |
| wins (real card taps, 3 stars) | w1-05, w2-05, w3-06, w4-06 | same |
| stucks (real card taps; panel Undo, rail Restart) | w1-t3, w2-02, w3-02, w4-02 | same |
| busiest eat (w4-t1: 144 blocks, 37 rings, 900 ms), rAF | mean 16.7, p95 16.7, max 16.8 ms | mean 16.7, p95 16.7, max 16.8 ms |
| console errors / warnings | 0 / 0 | 0 / 0 |

- `elementFromPoint`: every primary button on every screen: title, map, play with the hint, play, every win and stuck panel, 390×844, 768×1024, 812×375, and the hidden-tab run.
- Payload: 14 files, 445 KB cold, 0 external. It was 345 KB; the growth is the generator's `levels.json` with `art`, not code.
- `?v=6` on every script, the CSS, the font preload and `@font-face`, and via main.js on `config.json` and `levels.json`.
- `node tools/test.js`: 120 passed.

## Screenshots (`tools/shots/v2fix/`, not committed)
- `before-*` are from a frozen copy of 1ccf125; `after-*` are from this pass, on the new bake. Harness shots are in `harness/`.
- Pairs:
  - `w1-375`, `w1-05-375`, `w2-08-375`, `w4-375` (the `art` render at 375)
  - `camp-w1-05`, `camp-w4-10`
  - `chestflag-w4-10`, `chestflag-w4-10-zoom`
  - `lever-w4-10`
  - `crumble-{1045,1165,1300}`
  - `win-w4-{260,500,1100}`
  - `landscape-812-w{1,4}`, `desktop-1280-w4`
  - `hint-w3t1`, `toast-w2t1`, `cards-off-w4-10`, `gray-w3-09`, `map`, `flags-w4-08`, `flags-w3-05`, `rubble-w4-10`
- The info walks: `after-info-walks-*.png` (w4-09, when the scan finds a "closer" tap).
- Level ids are the same before and after, but the generator rebake changed the grids, so the pairs show the same level id, not the same board.

## For LATER (appended to LATER.md)
- Rotate the W4 boards in landscape for 12 px or more a cell (it needs the tie-break order proven rotation-safe).
- `blockPx` 6 on W4 for chunkier board pixels.
- A camp count chip on each idle crew. The victory lap (every remaining wall crumbling in a fast wave).
- The browser's first AudioContext is a ~100 ms long task on the page's first gesture (the title's Play). If it ever shows, give Play its pressed state before starting the audio.
