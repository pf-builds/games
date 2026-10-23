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
   If it says **a gate failed; nothing installed. Next steps:** the bake couldn't meet a target even after its automatic
   retries (config `retry.extra`: 4, then 8 more candidates). Do the first step it prints, usually
   `node tools/partials-pixels.js --rebake <id> --extra 12`; then give the picture's manifest line a tag (`"tag": "easy"` or
   `"normal"`); a very small picture (under about 30 x 30 cells) may play short whatever the deal, and lowering
   `paceByCells.floor` in tools/pixels-config.json is Peter's call. Installed pictures are never touched by a failed run.
   A **WARNING** that two colours are under 10 ΔE00 apart: the picture installs, but ask Peter whether players can tell them
   apart (a merge suggestion is his to approve).
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
  own violet tint, 8 pictures a sheet, eggs on the painted spurs' tips (ids `p1-<sheet>-<i>`), the banner "PIXEL ART ·
  Partial's Pixels · by PartialVoid", "More pictures on the way" in a band of fog just past the last picture (`pixels.fogBand`,
  260 sheet px: fix pass S1; the painted sheet stays clear above it, so with one picture or a few it reads as a finished place
  with the road going on; Zen and the Campaign keep fogging everything past their frontier), no Goblin King. The foot reads only "Pixel art by PartialVoid, used with the artist's permission." (`pixels.galleryCredits` false:
  the Gallery's line says the rest are Click it! Studios originals, which would be wrong here).
- **Levels:** "Picture n" everywhere (numbers run from 1), the title in the play bar, calm music (Zen's loop), no goblin on
  the win. The win says "Picture done" / "Lighthouse by PartialVoid, all dug out." with the finished picture.
- **Blocks are flat** in this mode (`pixels.flatBlocks`, board.js `setFlat`): fix pass B2, each block is one square of her
  exact colour, no seam, rounded corner, highlight band, foot or glint, so the board at level start is her drawing (measured:
  **100.0% of every block's pixels are exactly her hex** at 375x812@3 and 1280x800; with the studs it was 51% and 57%, with the
  first flat version and its seam 71% and 78%). Players tap squad cards, not blocks, so no block edge is needed; dug blocks
  leave open ground as on every board. Colour-blind marks still draw if the player turns them on (an accessibility choice).
- **Web only** (Peter, 2026-10-22; fix pass B1): `tools/portal-build.mjs` (config `webOnly` in tools/portal-config.json) drops
  `config.pixels` and its music mode, leaves out `levels/pixels*.pk.json`, takes the mode's card, chip and reset choice out of
  index.html, cuts its LICENSES rows and section, and fails if any file in the zip names Partial's Pixels, PartialVoid or the
  mode's level files. The page fetches the index only from `config.pixels.index` (no file name in the code). With no
  `config.pixels` the page shows no trace of the mode (checked by `tools/pixels-check.mjs`'s no-pixels page, selfTest 929/0
  there, and by the portal selftest). Shipped code comments call it "the third mode" so the scan stays clean.
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

Final run (2026-10-22, on 0df3e49 + these notes): test.js **737 passed, 0 failed** (726 before, 11 new); `freeze.js --require`
**PASS, 0 differences** (Zen's 574 levels, 886 shipped records, 283 castle cases); selfTest **939/0 at 375x812@3, 941/0 at
1280x800**, 0 console messages; `harness.mjs` **all passed** (its old-save check now expects three cards); `pixels-check.mjs`
**1600/1600 at both sizes**; `shots-partials-pixels.mjs` 18/18 with real taps, 0 console messages; `pack.js --check` clean;
shipped folder 14,716,719 B (cap 19,000,000). Home cards all hittable at 320x568, 360x640, 800x450 and 812x375.
`tools/space-v7/check.mjs lazy` fails at its second check on this branch and on e152988 alike (it predates the Zen lock: it
expects the Zen card's Play where the card now says "Opens after Fort 5"); not touched.

The gates: `tools/test.js` (Pixels section: the Lighthouse's counts, the art
gate on every record source and shipped, converter refusals and both suggestions, the 8-colour fixture suggested then
installed end to end in a scratch game with its merge, the map growing for 1/8/9/17/40, saves, SP3, config), freeze,
selfTest both sizes (13p: lock, every stored order, the art on the canvas, the win, the map, three cards, SP3, reset),
`tools/pixels-check.mjs`, `tools/shots-partials-pixels.mjs` (real taps), harness.

## 6b. Fix pass (2026-10-22, `tools/critic-partials-pixels.md`)

- B1 web only and B2 seamless blocks: above (§1).
- S1 the map: the fog band (§1). Shots with 1 picture (`map-375.png`, `map-1280.png`) and 3 (`map-3-pictures-375.png`,
  `-1280.png`, from a scratch install of two copies of the 32x32 fixture).
- S2 pace: a picture's pace floor and aim scale with its cells (`paceByCells`: ref 1600, floor 0.55; a 32x32 picture's range
  is 96-300 s); a pick that falls back is re-baked with 4 then 8 more candidates; a gate that still fails prints the next
  steps (runbook step 5). The critic's case, a 32x32 6-colour picture (`tools/fixtures/partials-pixels/fx-small-32-beach.png`,
  build-only): installs first time as picture 2, Easy, real pace 126 s, 33 taps, 14 s; tagged Normal, 139 s, 42 taps.
- m1 banner: eyebrow "Pixel art", the name, then "by PartialVoid" (`text.bannerBy`). m2: the desktop card's "Secrets found"
  had lost its value to a code comment in every mode (since lane D8); it now reads "found / in reach" and hides with none.
  m3: near twins under 3 ΔE00 never count as a drawn shape (merged first); a run warns when a picture's closest pair is under
  10. m4: an approved suggestion's .md says so at its top on install. m5: the merge preview outlines every changed cell.
  m6: install reports only files that changed ("every file unchanged" otherwise).
- The shots script reloads after unlocking (the critic's (a): the old shot caught the locked tap's toast).
- One fix to my own earlier slip: a sed in the first pass had touched an unrelated test.js cleanup line (line 1460); restored.

## 7. Calls I made

1. Flat blocks for this mode: one square of her colour, no seam (fix pass B2, Peter's "as close as possible").
2. Castle sheets 6 and 5 with a violet tint (6 is the one castle sheet no Zen world reuses), not Picture Garden's sheets: a
   third tint of Kitten Forest's sheets would read as World 1 or 2 again.
3. The chip says "Pixels" (the full name doesn't fit three across at 375 px); the card, banner, map title and labels say
   "Partial's Pixels".
4. The map's foot carries only her credit line, not the Gallery's.
5. The Lighthouse is Normal; the tag turn starts Normal (as Zen's picture 1).
6. Partial's Pixels levels are not in the freeze snapshot yet (it's re-taken at ship, as for each new Zen world).
7. "0 of 1 pictures" uses Zen's plural template as is.

## Peter's decisions (2026-10-22)
- **Violet tint:** keep it (castle sheets 6 and 5).
- **Web only for now:** Partial's Pixels ships on pf-builds only. Her permission is for the web game; portal builds (CrazyGames etc.) leave the mode out until Peter says otherwise. Revisit once she has made more art.
- **Pace:** new pictures will come slowly, over time. The mode has to look right with one or a few pictures for a long stretch, not as a placeholder for a big world.
