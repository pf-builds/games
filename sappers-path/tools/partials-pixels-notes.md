# Partial's Pixels: the third mode (2026-10-22)

PartialVoid's original pixel art, one picture a level, exactly as she drew it. Branch `partials-pixels` (worktree
`repos/games-sappers-pixels`, cut from e152988, v6.9). Not pushed.

## Runbook: adding a picture

1. Drop the PNG into `tools/build-data/partials-pixels/art/`, named `<id>-<words>.png` (e.g. `pp-002-fox.png`). Any clean
   pixel grid works (the tool finds the cell size); 8-bit RGB, RGBA, grey or palette PNG, every pixel solid.
2. Append a line to `tools/build-data/partials-pixels/manifest.json` `pictures`: `{"id": "pp-002", "title": "Fox"}`. Always
   append, never reorder or remove (picture n is line n; ids, saves and numbers keep each picture's place).
3. Run it (from the game folder):

   ```sh
   ~/.local/opt/node/bin/node tools/partials-pixels.js
   ```

   It converts, bakes (about a minute a picture), checks every gate including the art gate, installs into
   `tools/build-data/levels/pixels.json`, writes `levels/pixels.pk.json` + `levels/pixels-1.pk.json`, rewrites its
   LICENSES.md section and lays the map out for the new count. Pictures already installed stay byte for byte.
4. If it says **doesn't fit as drawn**: nothing was installed. Read `tools/build-data/partials-pixels/suggest/<id>.md` and
   look at `<id>.png` (left as drawn, right the suggestion). If Peter approves, paste the line it gives into the picture's
   manifest entry (`"merge": {"#from": "#to"}` or `"crop": [x, y, w, h]`) and run the tool again. Colours not named stay
   exact; no pixel ever moves.
5. If it says **REFUSED**: the file can't be read as pixel art (smoothed or resized export, see-through pixels, 16-bit,
   interlaced, a merge naming a colour that isn't there). The message says which; fix the file or the line.
6. Then: `~/.local/opt/node/bin/node tools/test.js`, bump the cache tag (`?v=` in index.html and style.css), selfTest at
   375x812 and 1280x800 (`tools/selftest-lands.mjs --url ... --wide 1280x800`), `tools/pixels-check.mjs` (the art in the real
   page, and the side-by-side images), `tools/harness.mjs` last. Commit.

Other commands: `tools/partials-pixels.js check` (convert and check only, nothing baked or installed),
`--rebake pp-001` (deal an installed picture again), `--threads N`, `--extra K`.

## 1. What the player sees

- **Home:** three cards. Campaign and Zen side by side as before; Partial's Pixels on the row under them, the same gold card in
  two short lines: its name and Play ("Picture 1"), then "Pixel art by PartialVoid" and its progress ("0 of 1 pictures").
  Locked like Zen until Campaign level `pixels.openAfter` (5, the same as `zen.openAfter`) is won: greyed, a padlock,
  "Opens after Fort 5"; a tap toasts it and stays home. The mode played last wears Continue.
- **Map:** the mode chip reads Campaign | Zen | Pixels (short label in the chip, full name in its aria-label; the three sit
  tighter under 460 px). The Pixels map reuses castle sheets 6 and 5 (no new image bytes; no Zen world uses sheet 6) under its
  own violet tint, 8 pictures a sheet, eggs on the painted spurs' tips (ids `p1-<sheet>-<i>`), the banner "By PartialVoid ·
  Partial's Pixels", fog with "More pictures on the way" right past the last picture (the last sheet's `tail`), no Goblin
  King. The foot reads only "Pixel art by PartialVoid, used with the artist's permission." (`pixels.galleryCredits` false:
  the Gallery's line says the rest are Click it! Studios originals, which would be wrong here).
- **Levels:** "Picture n" everywhere (numbers run from 1), the title in the play bar, calm music (Zen's loop), no goblin on
  the win. The win says "Picture done" / "Lighthouse by PartialVoid, all dug out." with the finished picture.
- **Blocks are flat** in this mode (`pixels.flatBlocks`, board.js `setFlat`): her exact colour on the 1 CSS px seam, no
  highlight band, foot or glint (those lighten and darken about a quarter of every block). Measured at level start: 71% of
  every block's pixels are exactly her hex at 375x812@3, 78% at 1280x800 (the rest is the seam); with the studs it was 51%
  and 57%. Colour-blind marks still draw if the player turns them on (an accessibility choice).
- **Settings:** Reset asks Campaign, Zen, Pixels or Everything; Pixels clears only its own progress (wallet, Campaign and Zen
  kept); Everything clears it too. Copy save code writes SP3 while Partial's Pixels has progress, else SP2 byte for byte.

## 2. The art stays exactly as drawn

- One art pixel = one board cell. The PNG's cell size is the gcd of every run of equal pixels along every row and column, so
  every cell is one flat colour by construction (a smoothed or resized export comes out at 1 px cells and too big, and is
  refused with that explanation). The picture sits inside the game's 1-cell frame of open ground with the entry gate in its
  bottom row: all outside the 40x40 art. The Lighthouse board is 42x42.
- The palette is her hex values, one key per colour (keys 1-7, most cells first; never iron 10 or gilt 14), no shade rows,
  no roles. The bake is deck-only (? cards, linked pairs): it never touches the grid. No mystery blocks, moats, gates,
  towers, keys or locks, ever (gated).
- **The art gate** (`partials-pixels.js artCheck`, in the tool's check, test.js and selfTest): every picture cell of the
  record, read through its palette, equals the source PNG's cell colour; the palette is exactly the picture's colours; the
  frame holds only open ground and the gate. The Lighthouse: **1600 / 1600** in the source record, in the shipped record,
  and **on the board canvas at level start** at 375x812@3 and 1280x800 (`tools/pixels-check.mjs`, reading `SP.cells()`:
  each cell's centre pixel, from a copy of the canvas). Side-by-side images: `tools/shots-partials-pixels/side-by-side-p1-1-375.png`
  and `-1280.png` (PNG as drawn | board as drawn, cropped to the picture).

## 3. The Lighthouse

`pp-001-lighthouse.png`, 1200x1200 px, 30 px a cell, 40x40 cells, 7 colours exactly as briefed (#06d6a0 690, #004e39 408,
#028f6a 367, #fffcf9 52, #ffd166 38, #f78c6b 26, #ef476f 19). Closest pair 20.3 ΔE00 (the two lighter greens; the game's own
converter aims for 25, but her colours are kept). Baked as **Normal** (2 ? cards, no links), **51 taps, real pace 232 s**,
random-tap rate 0.445 (band 0.2-0.5), every gate passing, bake 51 s on 16 threads.

**Deal tuning (pixels-config profile.bake):** her pictures are solid boards (every cell a block), so a squad only ever reaches
the dug edge. With the land default squads (20-50 per 1,400 cells) every deal needed about 80 taps inside the 15 s longest-tap
cap: 0 of 96 attempts dealt. Measured over 120 tries each: squads 50-99 on this board (config 40-79 per 1,400 cells), deep
0.05, deal about one try in seven; 400 attempts. Easy 0.04, Hard 0.08 deep.

## 4. The pipeline (tools/partials-pixels.js, tools/pixels-config.json)

Read the PNG (own decoder: grey, RGB, palette 1-8 bit with tRNS, alpha), find the grid, apply the manifest's crop then merge,
fit check (colours <= `limits.maxColours` 7, size <= land-config box 40x44), board, bake (land-bake.js bakeOne, seed
50000 + n, tag from `tags` in turn: normal, easy, normal, normal, easy, normal, hard; or the line's own tag), assemble, check
(the Zen gates plus the art gate and the map spacing), install. Bake results cache in `tools/build-data/partials-pixels/scratch/`
(gitignored). The record keeps `convert` (file, cell px, cells, colours, min ΔE, hash, merge, crop: build-only, dropped by
the pack); a picture whose hash (cells, title, tag) is unchanged is kept byte for byte.

**Suggestions instead of refusals (Peter, mid-build):**
- **Too many colours:** merge a pair at a time until it fits: the closest pair by CIEDE2000, the colour with fewer cells into
  the other, and a pair where one colour sits inside the other (either colour's edge touching the other at
  `suggest.edgeShare` 50% or more, like an eye in a face) only when nothing else is left. The report lists each merge, the
  cells it changes, ΔE00 and the shared edge, plus the exact `"merge"` line to paste.
- **Too big:** the 40x44 window that keeps the most cells unlike the picture's commonest edge colour, as a `"crop"` line,
  with the window outlined on the preview.
- Nothing installs until the change is in the manifest, so every change to her art is explicit, recorded (also in its
  LICENSES.md row) and approved. A picture that needs a suggestion stops the run there: later lines wait (numbers run in
  manifest order).

## 5. The page (src/main.js unless named)

- **Picture modes:** `PICM = ["zen", "pixels"]`, `isPic(m)`, `picOn()`; where Zen and Partial's Pixels behave the same the
  page asks these and reads the mode's own config block `app.cfg[m]` (save, openAfter, load, text, eggPrefix,
  galleryCredits, flatBlocks). `PT(m)`: a picture mode's words, `pixels.text` merged over `zen.text`; `MT()` the mode in use.
  `modes()` builds the Campaign, then `picMode("zen", ...)` and `picMode("pixels", ...)` from each index (the old Zen body,
  generalized; Zen's output is the same). `modeOpen(m)` / `modeLocked(m)`, `msave(m)`, `lastMode()`, `doneIn(m)`.
- **Loading:** `levels/pixels.pk.json` (index, Zen's shape) at boot, its world file `levels/pixels-1.pk.json` on the first
  start (as a Zen world). World keys: Zen's stay its k; Pixels' are `"pixels:1"` (`wkey`), so the two World 1s never mix;
  entries carry `e.wk`. `SP.worlds()` still lists Zen's worlds only.
- **Saves (src/save.js):** its own key `sappers-path.pixels.v1` through `openZen` (egg pattern `p<w>-<s>-<i>`, `eggRe`), the
  Campaign's wallet shared as Zen's is; no move. The mode played last stays in the Zen save (`"pixels"` now allowed). SP3 =
  SP2's body exactly + the Pixels part in the Zen part's format (`partBody` / `partRead`, refactored out of SP2: SP2 codes are
  byte for byte the old ones, checked against the old save.js). An SP1 or SP2 code loads with Partial's Pixels afresh.
- Power-up reach counts Pixels pictures like Zen's (`picDone`). Music: `audio.music.modes.pixels`, audio.js `pick` treats any
  non-Campaign mode as Zen.
- Cache tag `?v=89`.

## 6. Checks

See the report numbers in the commit messages; the gates: `tools/test.js` (Pixels section: the Lighthouse's counts, the art
gate on every record source and shipped, converter refusals and both suggestions, the 8-colour fixture suggested then
installed end to end in a scratch game with its merge, the map growing for 1/8/9/17/40, saves, SP3, config), freeze,
selfTest both sizes (13p: lock, every stored order, the art on the canvas, the win, the map, three cards, SP3, reset),
`tools/pixels-check.mjs`, `tools/shots-partials-pixels.mjs` (real taps), harness.

## 7. Calls I made

1. Flat blocks for this mode (beyond the brief's minimum "dominant fill"): the stud's highlight and foot are light/dark
   variants inside every block, which the brief rules out for her boards. The seam stays.
2. Castle sheets 6 and 5 with a violet tint (6 is the one castle sheet no Zen world reuses), not Picture Garden's sheets: a
   third tint of Kitten Forest's sheets would read as World 1 or 2 again.
3. The chip says "Pixels" (the full name doesn't fit three across at 375 px); the card, banner, map title and labels say
   "Partial's Pixels".
4. The map's foot carries only her credit line, not the Gallery's.
5. The Lighthouse is Normal; the tag turn starts Normal (as Zen's picture 1).
6. Partial's Pixels levels are not in the freeze snapshot yet (it's re-taken at ship, as for each new Zen world).
7. "0 of 1 pictures" uses Zen's plural template as is.
