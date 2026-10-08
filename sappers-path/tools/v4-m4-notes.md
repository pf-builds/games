# Sapper's Path v4 M4 notes: the Gallery (2026-09-30)

Brief: picture levels made from licensed or our own images: a converter, a license manifest, outline-breach tuning, about 60 baked Gallery levels and a Gallery screen, with the Siege (levels 1-100) unchanged. Plan: `game-research/sappers-path-v4/plan.md` (feature 4, outline breach; feature 5, content split; "Gallery (bonus picture levels)"; "Look": art levels are all-pixel boards entered from all four edges). Decisions: `SPEC-v4.md` §9, the M4 entry. Bake report (tables and log): `tools/v4-m4-gallery.md`.

Page: http://127.0.0.1:8491/sappers-path/?debug=1. Cache tag `?v=21` everywhere (scripts, CSS, the font URL in style.css; config, levels, debug-levels and the new `levels/gallery.json` fetches take it from the script tag).

## Commits (branch `sappers-path`)

| Commit | What |
|---|---|
| `cf61b0e` | Engine: ring levels (entry from all four edges, the ring tie-break), the reference rules, tests |
| `7917383` | The converter (`tools/convert.js`), the stored sources (`tools/gallery-src/`, `tools/gallery-src.py`), the manifest |
| `7768917` | The Gallery bake (`levels/gallery.json`, `tools/gallery-bake.js`, `tools/gallery-config.json`), the dealer's `capOf`, the converter's faded-colour rule, the save's `gal`, LICENSES.md, tests, `regrade.js --gallery`, `fade.js --gallery` |
| `7826e22` | The page: Gallery screen, picture palettes, ring entry and exit, selfTest, harness, `tools/shots-v4-m4.mjs` |
| docs commit | This file, SPEC-v4 §9, LATER.md |

## Files

| File | What changed |
|---|---|
| `src/engine.js` | `ring: true` levels: compile checks the ring (border all camp, nothing else camp); the tie-break rank uses `ringKey` on ring levels; `ringKey` exported. Siege levels take the old path unchanged. |
| `tools/ref.js` | The ring tie-break, written independently from the rules text (`ringTie`). |
| `tools/convert.js` (new) | Picture -> ring level plan; PNG decode/encode (zlib only); `--sheet` contact sheets, `--png` previews. |
| `tools/gallery-src.py` (new), `tools/gallery-src/` (88 PNGs, 2.2 MB) | The converter's inputs: every candidate downscaled (emoji native, ours 256 px, paintings 160 px long side). |
| `levels/gallery-manifest.json` (new) | Every candidate: source URL, author, license, date; ours: model, prompt, seed, size, steps; `keep: false` with `why`; `order` (the Gallery's order). |
| `tools/gallery-config.json` (new) | `convert` (the converter's numbers) and `bake` (the Gallery bake's). |
| `tools/gallery-bake.js` (new) | The Gallery bake, workers per picture, writes `levels/gallery.json` and the tables in `tools/v4-m4-gallery.md`. |
| `tools/gen.js` | `deal()` takes an optional `D.capOf` {m: [first, rest]} (the outline's squads). Without it a deal is exactly as before (a trial bake of siege levels 4-8 reproduced `levels.json` byte for byte). |
| `tools/regrade.js`, `tools/fade.js` | `--gallery` modes. |
| `tools/test.js` | Ring levels (compile, ringKey, known answers, the outline, engine vs reference on 40 random ring boards), the converter on a hand image, PNG round trip, the Gallery file's invariants, engine vs reference on the Gallery's boards, the save's Gallery wins (272 checks, was 245). |
| `src/board.js` | Per-level palette (`V.pal`, sprites rebuilt on a palette change), ring entry and exit for runners, no idle sappers on a ring level, `sides()`. |
| `src/main.js` | Gallery index and screen, the locked buttons, the level flow (top bar, sheets, next picture), `usePalette` (tiles, spaces, chips, helmets, aria names), selfTest section 24, SP `unlockGallery`, `gallery`, `sides`. |
| `src/save.js` | `gal` {id: mask}, sanitized against the Gallery's ids; `record(..., "gal")`. |
| `index.html`, `style.css`, `config.json` | The Gallery screen and its two buttons; `config.gallery` (text, unlock level, thumbnail size, credits). |
| `tools/harness.mjs` | The Gallery at every viewport (locked, opened by a real tap, a painting played by real taps, edge entry, every Gallery board's cell size); the hidden-tab load polls by time. |
| `tools/shots-v4-m4.mjs` (new) | The M4 screens (below). |
| `LICENSES.md` | The Gallery's sources and a line per shipped picture. |

## 1. Ring levels (rules as built)

- **Format.** `ring: true`. The grid's border (x = 0, y = 0, x = w-1, y = h-1) is camp (`#`) and no other cell is; compile throws otherwise. A Gallery board is the picture plus that ring.
- **Everything else is the siege's rules with the ring as the camp.** Connected ground starts at every ring cell; a pixel's distance is the smallest BFS distance of a walkable neighbour in connected ground (ring cells are 0); tiles = distance + 1; timing, dispatch, spaces, jams: unchanged.
- **The tie-break** (equal distances only). The siege's "nearest the camp row, then lower x" would send every equal-walk squad to the top edge first. On a ring level: layer = min(x, y, w-1-x, h-1-y); with a = layer, x1 = w-1-a, y1 = h-1-a, the cell is on its layer's top side if y = a and x < x1 (pos = x - a), else the right if x = x1 and y < y1 (pos = y - a), else the bottom if y = y1 and x > a (pos = x1 - x), else the left if x = a and y > a (pos = y1 - y), else (the centre of an odd square) the top with pos 0. Order: layer, then pos, then side (top, right, bottom, left). So equal walks go outside in, and along a layer the four sides take turns from their clockwise-first corner: a squad of 40 on the outer layer starts 10 sappers at each corner, each group working clockwise along its side. Known answer (5x5): (1,1), (3,1), (3,3), (1,3), (2,1), (3,2), (2,3), (1,2).
- **The outline needs no rule of its own (confirmed).** Background cells touch the ring, so they are the only colour in reach at the start; the ink outline round the subject (8-adjacent, so no 4-connected path gets past it) becomes the frontier once the background in front of it is gone, and nothing inside is in reach until a black squad eats a hole in it. Tests: `outline: ...` (a 7x6 board: the inside squad and the black squad both wait while the background stands; then background, breach, inside, razed) and the converter's hand image (the same order on a converted plan).
- **Where the breach opens** is where the background was eaten first and how many black sappers go (they take the outline cells nearest the ring first, by the tie-break above). The dealer caps the outline's squads (`bake.capOf` [12, 24]: the first black squad at most 12, the later ones at most 24), so the first breach is a narrow hole, not the whole ring, and black comes in 9 squads per picture (median); the tuner's column moves then decide where those cards sit. In the bake, the first black card starts at the front of a column on 32 of 52 outlined pictures (a player who taps it early parks a squad in a space until the background in front of the outline is gone) and is sent on tap 3 of the stored Normal line (median).
- **Engine vs reference**: 240 games on 40 random ring boards (24,080 pops), and 150 games on the Gallery's own boards (Normal patient and rushed on all 60, Easy and Hard patient on every fourth): 0 differences.

## 2. Per-level palette

- `pal: {id: {c, n}}` on a level: its colours and their names. Pictures use ids 1-9 and 11-13 (by population), never 10 (iron gates) or 14 (gilt keys), and no Gallery level has gates, towers or a lock, so 10 and 14 keep their meaning.
- The page uses it everywhere a colour shows: the board's studs, crumbs, bins and the sappers' helmets (`V.pal`, sprites rebuilt when it changes), the queue tiles, their faded rows and the holding spaces (`app.mats`, `fadeRows`), the jam sheet's chips and the sappers in the line. Where the siege reads a crew name (aria-labels, the jam sheet's label) a picture reads its colour's name ("Navy, 16 sappers"). Colour-blind marks stay by id.

## 3. The converter (`tools/convert.js`, numbers in `tools/gallery-config.json` `convert`)

1. **Crop and mask.** The manifest's `crop` (fractions; the paintings lose their print borders), then the subject: alpha >= 128 (emoji), a flood from the image border over colours within ΔE00 12 of the border's median (ours: flat generated backgrounds), or everything (paintings).
2. **Fit.** The subject's box plus a 2-cell margin into the picture box (emoji and ours 32x32, paintings 40x32, columns x rows without the ring), keeping its aspect; the board is cropped to it. Boards: 576-1280 picture cells, 20-42 columns x 26-34 rows with the ring.
3. **Palette.** k-means in CIELAB (24 clusters, seeded, over a 5-bit histogram); the ink (#1f1b24) and the background pinned; then clusters one at a time by sqrt(population) x distance to the nearest kept colour, kept when at least 0.6% of the subject and ΔE00 >= 25 from every kept colour (paintings 20), up to 12. Paintings scale chroma by 1.4 first (old varnish reads muddy at 40 cells). An emoji's background is the first of 11 candidates (pale ones first) 6 past minDE from every subject colour; ours keep their own (the flood's mean), lightened if it is near the ink.
4. **Cells.** A majority vote of the source pixels each cell covers (each votes background or its nearest kept colour), so edges stay crisp and no in-between colours appear.
5. **Outline.** Every background cell 8-adjacent to the subject turns ink (1 ring), joining the picture's own dark lines (which select into the ink).
6. **Faded check** (`fadeDE` 20, not paintings). The queue's rows behind the front mix 10% and 20% of the tray into a tile (Critics 1, M2), so a picture's colours must also stay ΔE00 20 apart with one of them faded, as the siege's do (`tools/fade.js`): a pair under it has its rarer colour's lightness moved 4 L* away (up to 4 times), else that colour goes. Emoji and ours: smallest faded pair 20.4. Paintings are exempt: their tones are posterized already and keeping them was worth more than the queue rule; 42 of their faded pairs are under 20 (smallest 12.0, Teapot and Fruit's navy at row 2 against slate). The visual critic should judge those.
7. **Ids, names, ring.** Ids by population; names from 36 colour names (nearest CIEDE2000, all different within a picture); the camp ring.

## 4. Pictures

**Sources and downloads** (Peter's approved list only). 22 Twemoji (72 px, jsDelivr), 24 Noto Emoji (128 px), 18 Met Open Access works (`primaryImageSmall`, all `isPublicDomain: true`) and their API records: **2.63 MB** in all (Twemoji 25 KB, Noto 118 KB, Met images 2.39 MB, Met JSON 101 KB, plus a few small search responses). Two notes:
- **Noto's PNGs moved.** The brief's URL (`noto-emoji/main/png/128/...`) returns 404: the repo now keeps them under `2D/png/128/` (same repo, same files, same Apache 2.0 license per its README). I used the new path; it is recorded per picture in the manifest. Flagged for the orchestrator.
- **No NGA images.** Finding an NGA picture's IIIF id needs its open-data image table (tens of MB), past the download budget, so all paintings are from the Met. Four extra Met prints (Hokusai and Hiroshige landscapes, about 380 KB) were fetched as candidates when the first paintings converted badly; none of the four read at board size either.

**Generated (ours).** 24 candidates, FLUX.1 [schnell] (Apache 2.0) with city96's 4-bit GGUF transformer, 512x512, 4 steps, guidance 0, seeds 101-124, one image per run (a script that checks swap before each run and stops if a run takes over twice the first): load 6-12 s, generate 18 s, about 26 s a run, peak 14 GB resident, swap 0.00 M before every run. Prompt template: "simple cute flat cartoon icon of {subject}, chunky shapes, thick bold black outlines, few flat solid colors, minimal detail, centered, whole figure in frame, plain solid {pale colour} background, no text, no shadow". No real people, no trademarked characters. Full prompts and seeds in the manifest.

**Kept 60 of 88** (32 emoji: 16 Twemoji, 16 Noto; 8 paintings; 20 ours). The brief's split was about 30 / 12 / 20: only 8 paintings read at 40 cells, so the other slots went to emoji. Every converted board was looked at (contact sheets, then the game's own renderer: `tools/shots-v4-m4/contact-sheet.png`). Builder picks; Peter vetoes at the playtest (the 28 dropped are in the manifest with their reason, sources stored, so a swap is a manifest edit and a rebake).

- **Emoji: 32 kept** (of 46): Pizza Slice (Twemoji), Cat (Noto), Fox (Twemoji), Cherries (Noto), Panda (Twemoji), Mushroom (Noto), Watermelon (Twemoji), Burger (Noto), Penguin (Twemoji), Dog (Noto), Strawberry (Twemoji), Taco (Noto), Octopus (Twemoji), Lion (Noto), Doughnut (Twemoji), Honeybee (Noto), Crab (Twemoji), Cupcake (Noto), Unicorn (Twemoji), Owl (Noto), Avocado (Twemoji), Pig (Noto), Castle (Twemoji), Dragon (Noto), Frog (Twemoji), Lollipop (Noto), Crown (Twemoji), Alien (Noto), Rocket (Twemoji), Rainbow (Noto), Jack-o'-Lantern (Twemoji), Sunflower (Noto).
  Dropped (14): Ice Cream (`tw-1f366`): the cone merges into the swirl at board size (one cream blob); Pineapple (`tw-1f34d`): spare: reads, but plainer than the fruit already kept; Gem (`tw-1f48e`): spare: three flat colours, too plain; Ghost (`tw-1f47b`): spare: reads; one ghost is enough (ours-g09 is kept); Turtle (`tw-1f422`): spare: short and plain (3 colours); Snail (`tw-1f40c`): spare: reads; room for the paintings and ours; Whale (`noto-1f433`): spare: reads, but the spout and eye get lost; Chick (`noto-1f425`): spare: three colours, a plain yellow blob; Robot (`noto-1f916`): the eyes are lost at board size; Cactus (`noto-1f335`): spare: reads; plainer than the kept plants; Shield (`noto-1f6e1`): spare: plain grey shield; Crossed Swords (`noto-2694`): spare: reads; thin blades take most of the board as background; Trophy (`noto-1f3c6`): spare: reads; room for the paintings and ours; Balloon (`noto-1f388`): spare: a plain red balloon.
- **Paintings and prints: 8 kept** (of 18): Red Fuji, The Great Wave, Wheat Field with Cypresses, Irises, Teapot and Fruit, Roses, Oleanders, Apples and Primroses.
  Dropped (10): Sunflowers (`met-436524`): the flower heads turn into one olive blob at 40 cells; Shoes (`met-436533`): reads only as a brown patch; The Repast of the Lion (`met-438822`): too dark: the lion and the jungle merge; The Gulf Stream (`met-11122`): too dark: the boat is a small patch; Kirifuri Waterfall (`met-55019`): the waterfall's lines turn to noise; Warbler on a Plum Branch (`met-56942`): too narrow for the board (14 columns); Kajikazawa (`met-56727`): the fisherman and the rock are lost; a wash of blue; Mishima Pass (`met-36499`): the tree is lost in the sky; Ejiri in the Wind (`met-56988`): the wind and the travellers are lost; Evening Snow at Kanbara (`met-56915`): snow on sand: almost nothing reads.
- **Ours (generated): 20 kept** (of 24): Goblin's Lunch, Sir Whiskers, Night Watch, Frog Prince, Duck Knight, Crown Too Big, Cake Castle, Mimic, Melon Catapult, Happy Potion, Iron Pig, Mushroom House, The Sapper, Hatchling, Plumed Helm, Sheep Knight, Sword in the Stone, Party Slime, Wise Old Owl, Goblin King's Hoard.
  Dropped (4): Toasty (`ours-g03`): the dragon is tiny in its frame; Slow Charge (`ours-g05`): the knight and the snail merge into brown and grey; Bear Bard (`ours-g14`): the lute is lost; a brown bear shape; Apple Hog (`ours-g17`): the hedgehog reads as a brown blob.

## 5. The bake (`tools/gallery-bake.js`, `tools/gallery-config.json` `bake`, version 1)

- **Per picture**: 6 candidates (saw2 8, hard 10), each a deal simulated as a winning order under Hard's dealing rules (4 spaces), so the stored order wins on Easy, Normal and Hard; the outline's squads capped (`capOf`); the siege's dead-time cap (15 s a tap), tap cap (55) and parking rules; tuned into the slot's Normal band (card moves, splits, merges; hard slots also narrow the one-move-lookahead player toward 35%); graded on all three difficulties (400 random games each), the lookahead player (100), the fast tapper (300) and the patient time on the stored Normal line. The pick: every target met (band, 240 s, 15 s, fast tapper, 55 taps), nearest the band's centre, not a near-duplicate; else the least total miss, logged. 16 threads, 623 s; a second bake from scratch gave a byte-identical file (apart from the wall-clock seconds).
- **Twists**: none in the Gallery (no gates, towers, "?" cards, links or lock). The outline is its twist; mixing in the siege's twists is parked in LATER.
- **The curve** (the Gallery is a bonus side mode from level 25, where the player has met the siege's mid band; every picture is open once the Gallery is, so the curve is the order of the grid, not a gate): the first 4 pictures in an intro band (62-90% Normal random-tap), then the pattern saw0 (62-80), saw1 (46-64), saw2 (30-48), saw1, hard (10-30), relief (62-85), repeating. 60 pictures: intro 4, saw0 10, saw1 19, saw2 9, hard 9, relief 9: mostly mid-band, a harder one every sixth, a relief after each.

| Slot | Band | Levels | In band | Normal min / median / max | Fast tapper median | Lookahead median |
|---|---|---|---|---|---|---|
| intro | 62-90% | 4 | 4/4 | 75.3 / 76.5 / 80.5% | 80.0% | 100% |
| saw0 | 62-80% | 10 | 10/10 | 69.3 / 71.3 / 72.5% | 73.7% | 100% |
| saw1 | 46-64% | 19 | 19/19 | 52.8 / 55.0 / 58.0% | 54.7% | 100% |
| saw2 | 30-48% | 9 | 9/9 | 37.5 / 39.0 / 40.0% | 39.3% | 100% |
| hard | 10-30% | 9 | 9/9 | 18.0 / 21.0 / 25.8% | 19.7% | 61% (40-100%) |
| relief | 62-85% | 9 | 9/9 | 71.8 / 74.5 / 82.3% | 78.0% | 100% |

- **Results**: 60/60 winnable on Easy, Normal and Hard with stored orders; 60/60 in band; **0 fallbacks**. Easy 26-100%, Hard 5.5-67.5% random-tap.
- **Time** (patient play on the stored Normal line at 1x): median **124 s**, 79-217 s; emoji median 116 s (max 152), ours 119 s (max 199), paintings 181 s (max 217). Longest single tap **15.0 s** (cap 15 s). Taps 24-54 (cap 55).
- **Fast tapper vs patient**: from -10.1 to +9.5 points; none flagged (the siege's rule: 10 points, or 1.75x and 3 points). The fast tapper is not much better anywhere.
- **Lookahead (one-move thinking player)**: 100% on every non-hard slot (70% at the lowest), as in the siege's mid band (96-99% median); the hard slots 40-100% (median 61%): a thinking player loses a hard picture about 4 times in 10. Plumed Helm (51) stayed at 100% (narrowing found no deal lower in band).
- **Colours**: 3-9 per picture; smallest pair ΔE00 25.0 (emoji and ours) and 20.3 (paintings); faded pairs: see section 3.

## 6. The Gallery screen and the save

- **Unlock**: `config.gallery.openAt` = `e1-25` (siege level 25 won on any difficulty, Decision 1). Before that the title's Gallery button (under Play) and the map's (beside Play, in its foot) are padlocked stone with the hint "Win level 25 to open" on them (aria-disabled; a tap shakes them and plays the blocked sound; the screen can't be asked for). After: a frame icon and "12/60 cleared".
- **Screen**: the map's top bar (back to the title, "The Gallery", the count), a grid of the 60 pictures in the bake's order (phone 3 columns, desktop 8): a picture not yet won is its thumbnail with only its lightness, squeezed into dark greys (`gallery.dim`), and its number; a won one is in its colours on a parchment card with its title and its E/N/H medals. Under the grid, the plain-text credits line (`gallery.credits`; no links, no `<a>` anywhere on the screen). Tap a picture to play it: every picture is open once the Gallery is.
- **A picture level**: the top bar shows its number and title; its map button goes back to the Gallery. Win sheet: "Picture razed!", "{title} cleared on {difficulty}.", the difficulty medals, primary "Next picture" (the first not yet won after it, wrapping round), secondary Retry. Fail sheet: Retry, secondary The Gallery.
- **Save**: `gal: {id: mask}` in the v3 save, a bit per difficulty like `done`; sanitized on load against the Gallery's ids (unknown ids and non-numbers dropped, masks clamped to 3 bits); a save from before M4 loads with an empty `gal`. Gallery wins never touch the siege's progress or `last`.
- **Portal rules**: the title's Play is still one tap to the siege; no outbound links; the Gallery file is one more same-origin fetch (`levels/gallery.json?v=21`); a page without it simply hides the two buttons.
- **Hauling on a ring level**: a sapper comes in from just outside the edge its route starts on (top, left, right; the bottom edge enters from its space's point across the yard as in the siege) and carries its block back out the same way: off the board for the top, left and right edges, into its colour's bin in the yard for the bottom edge. Every block lands in its bin's count at the engine's home time either way, so the yard crates fill as in the siege.

## 7. Every Gallery level

Normal / Easy / Hard = random-tap win rates (400 games); lookahead = the one-move-lookahead player (100); fast = the fast tapper (300); time and longest tap = patient play on the stored Normal line at 1x; min ΔE00 = the closest pair of its colours; min faded = the closest pair with one faded to a queue row behind the front; breach = black squads, the stored Normal line's tap that sends the first, where the first black card starts (column/row, row 0 = the front). Paintings have no outline.

| # | Id | Title | Kind | Slot | Board | Colours | Min ΔE00 | Min faded | Taps (cards) | Normal | Easy | Hard | Lookahead | Fast | Time | Longest tap | Breach |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tw-1f355 | Pizza Slice | emoji | intro | 29×34 | 4 | 35.6 | 28.5 | 30 (30) | 77.0% | 87.0% | 67.5% | 100.0% | 75.7% | 110 s | 14 s | 6 squads, tap 2, starts 1/0 |
| 2 | ours-g01 | Goblin's Lunch | ours | intro | 27×34 | 6 | 32.8 | 24.5 | 27 (27) | 75.3% | 84.5% | 60.0% | 100.0% | 80.0% | 160 s | 14 s | 9 squads, tap 2, starts 1/0 |
| 3 | noto-1f431 | Cat | emoji | intro | 34×31 | 4 | 32.7 | 30.6 | 29 (29) | 76.5% | 85.3% | 63.5% | 100.0% | 80.0% | 116 s | 9.8 s | 8 squads, tap 2, starts 1/0 |
| 4 | tw-1f98a | Fox | emoji | intro | 34×31 | 4 | 31.7 | 26.2 | 32 (32) | 80.5% | 88.8% | 67.0% | 100.0% | 81.0% | 102 s | 6.8 s | 10 squads, tap 2, starts 1/0 |
| 5 | met-57007 | Red Fuji | painting | saw0 | 42×29 | 6 | 23.5 | 15.2 | 51 (51) | 70.5% | 95.8% | 33.3% | 100.0% | 80.0% | 147 s | 14 s | no outline |
| 6 | ours-g02 | Sir Whiskers | ours | saw1 | 26×34 | 5 | 26.5 | 22.7 | 28 (28) | 53.3% | 69.8% | 34.3% | 100.0% | 54.7% | 117 s | 15 s | 8 squads, tap 4, starts 3/0 |
| 7 | noto-1f352 | Cherries | emoji | saw2 | 28×34 | 4 | 40.7 | 32.7 | 36 (36) | 39.8% | 61.5% | 21.0% | 98.0% | 40.7% | 128 s | 12 s | 10 squads, tap 11, starts 0/4 |
| 8 | tw-1f43c | Panda | emoji | saw1 | 32×34 | 5 | 30.9 | 20.5 | 37 (37) | 53.5% | 70.3% | 35.0% | 100.0% | 53.7% | 109 s | 8.8 s | 13 squads, tap 2, starts 4/0 |
| 9 | ours-g09 | Night Watch | ours | hard | 30×34 | 5 | 25.6 | 20.4 | 38 (38) | 18.0% | 26.3% | 9.8% | 60.0% | 18.0% | 131 s | 13 s | 11 squads, tap 1, starts 1/0 |
| 10 | noto-1f344 | Mushroom | emoji | relief | 33×34 | 5 | 26.3 | 23.7 | 37 (37) | 72.5% | 83.0% | 61.3% | 100.0% | 74.0% | 125 s | 15 s | 7 squads, tap 6, starts 0/1 |
| 11 | tw-1f349 | Watermelon | emoji | saw0 | 34×26 | 5 | 34.2 | 28.8 | 28 (28) | 72.5% | 79.8% | 63.0% | 100.0% | 75.3% | 99 s | 15 s | 5 squads, tap 3, starts 3/0 |
| 12 | met-45434 | The Great Wave | painting | saw1 | 42×29 | 3 | 32.3 | 22.6 | 42 (42) | 55.5% | 79.0% | 24.5% | 100.0% | 53.0% | 164 s | 10 s | no outline |
| 13 | ours-g04 | Frog Prince | ours | saw2 | 29×34 | 5 | 27.1 | 22.1 | 34 (34) | 39.0% | 54.3% | 25.8% | 100.0% | 40.7% | 113 s | 12 s | 9 squads, tap 4, starts 2/0 |
| 14 | noto-1f354 | Burger | emoji | saw1 | 32×34 | 5 | 26.6 | 20.4 | 38 (38) | 55.0% | 68.8% | 37.5% | 100.0% | 46.7% | 130 s | 14 s | 7 squads, tap 3, starts 2/0 |
| 15 | tw-1f427 | Penguin | emoji | hard | 32×34 | 4 | 32.2 | 29.3 | 33 (33) | 21.3% | 37.3% | 12.3% | 74.0% | 19.7% | 111 s | 10 s | 14 squads, tap 2, starts 0/0 |
| 16 | ours-g12 | Duck Knight | ours | relief | 34×32 | 5 | 26 | 20.8 | 37 (37) | 74.3% | 87.8% | 60.3% | 100.0% | 78.0% | 176 s | 13 s | 11 squads, tap 2, starts 1/0 |
| 17 | noto-1f436 | Dog | emoji | saw0 | 34×31 | 4 | 32.3 | 22.2 | 35 (35) | 72.3% | 89.0% | 53.5% | 100.0% | 74.7% | 121 s | 12 s | 8 squads, tap 3, starts 2/1 |
| 18 | tw-1f353 | Strawberry | emoji | saw1 | 29×34 | 5 | 35.6 | 28.5 | 31 (31) | 56.0% | 70.8% | 42.3% | 100.0% | 57.7% | 105 s | 9.3 s | 6 squads, tap 4, starts 3/1 |
| 19 | met-436535 | Wheat Field with Cypresses | painting | saw2 | 42×33 | 5 | 23 | 17.3 | 54 (54) | 37.5% | 100.0% | 6.3% | 98.0% | 34.7% | 195 s | 14 s | no outline |
| 20 | ours-g10 | Crown Too Big | ours | saw1 | 28×34 | 7 | 26.2 | 21.0 | 36 (36) | 55.3% | 76.8% | 27.5% | 100.0% | 56.0% | 154 s | 15 s | 10 squads, tap 1, starts 0/0 |
| 21 | noto-1f32e | Taco | emoji | hard | 34×29 | 5 | 35 | 28.7 | 31 (31) | 22.5% | 34.5% | 9.8% | 59.0% | 23.0% | 114 s | 15 s | 4 squads, tap 6, starts 4/2 |
| 22 | tw-1f419 | Octopus | emoji | relief | 34×34 | 3 | 32.2 | 29.1 | 38 (38) | 74.8% | 87.3% | 55.3% | 100.0% | 76.0% | 125 s | 11 s | 8 squads, tap 3, starts 0/1 |
| 23 | ours-g07 | Cake Castle | ours | saw0 | 31×34 | 5 | 31.5 | 21.5 | 35 (35) | 71.5% | 85.8% | 51.5% | 100.0% | 68.7% | 119 s | 10 s | 9 squads, tap 5, starts 3/1 |
| 24 | noto-1f981 | Lion | emoji | saw1 | 31×34 | 4 | 32.5 | 22.3 | 36 (36) | 56.0% | 71.8% | 41.0% | 100.0% | 60.7% | 123 s | 15 s | 8 squads, tap 5, starts 3/1 |
| 25 | tw-1f369 | Doughnut | emoji | saw2 | 34×28 | 6 | 29.9 | 21.9 | 33 (33) | 39.0% | 55.5% | 18.0% | 100.0% | 43.3% | 115 s | 14 s | 6 squads, tap 2, starts 2/0 |
| 26 | met-436528 | Irises | painting | saw1 | 42×34 | 5 | 20.4 | 14.2 | 53 (53) | 54.0% | 82.5% | 17.3% | 100.0% | 49.7% | 217 s | 15 s | no outline |
| 27 | ours-g13 | Mimic | ours | hard | 34×32 | 4 | 25.5 | 22.4 | 40 (40) | 25.8% | 35.0% | 14.5% | 62.0% | 24.3% | 112 s | 9.9 s | 18 squads, tap 5, starts 2/2 |
| 28 | noto-1f41d | Honeybee | emoji | relief | 34×32 | 4 | 41.8 | 37.3 | 37 (37) | 76.8% | 85.5% | 64.5% | 100.0% | 80.0% | 128 s | 9.4 s | 14 squads, tap 3, starts 3/0 |
| 29 | tw-1f980 | Crab | emoji | saw0 | 34×34 | 3 | 35.6 | 28.5 | 39 (39) | 69.3% | 83.5% | 55.3% | 100.0% | 70.0% | 134 s | 14 s | 13 squads, tap 4, starts 3/0 |
| 30 | ours-g11 | Melon Catapult | ours | saw1 | 34×29 | 6 | 27.9 | 21.6 | 41 (41) | 55.8% | 67.3% | 38.0% | 100.0% | 45.7% | 199 s | 13 s | 9 squads, tap 1, starts 0/0 |
| 31 | noto-1f9c1 | Cupcake | emoji | saw2 | 28×34 | 6 | 28.9 | 26.3 | 36 (36) | 40.0% | 50.2% | 26.0% | 100.0% | 35.0% | 97 s | 5.7 s | 5 squads, tap 5, starts 3/2 |
| 32 | tw-1f984 | Unicorn | emoji | saw1 | 34×34 | 5 | 26.8 | 24.9 | 46 (46) | 52.8% | 66.3% | 37.0% | 91.0% | 52.7% | 152 s | 13 s | 10 squads, tap 5, starts 3/2 |
| 33 | met-437999 | Teapot and Fruit | painting | hard | 42×31 | 9 | 21.8 | 12.0 | 42 (42) | 20.5% | 48.3% | 5.5% | 45.0% | 16.3% | 181 s | 14 s | no outline |
| 34 | ours-g15 | Happy Potion | ours | relief | 24×34 | 4 | 29.7 | 25.7 | 26 (26) | 74.5% | 83.8% | 64.8% | 100.0% | 80.3% | 101 s | 14 s | 7 squads, tap 2, starts 3/0 |
| 35 | noto-1f989 | Owl | emoji | saw0 | 26×34 | 5 | 28 | 22.1 | 34 (34) | 70.0% | 81.8% | 49.5% | 100.0% | 73.7% | 111 s | 9.9 s | 8 squads, tap 3, starts 3/1 |
| 36 | tw-1f951 | Avocado | emoji | saw1 | 34×33 | 5 | 26.9 | 21.5 | 49 (49) | 54.5% | 64.5% | 41.3% | 100.0% | 46.3% | 142 s | 7.9 s | 8 squads, tap 3, starts 2/1 |
| 37 | ours-g08 | Iron Pig | ours | saw2 | 28×34 | 4 | 28.3 | 23.0 | 31 (31) | 38.8% | 54.5% | 23.5% | 100.0% | 43.0% | 124 s | 12 s | 8 squads, tap 4, starts 0/1 |
| 38 | noto-1f437 | Pig | emoji | saw1 | 34×31 | 4 | 26 | 22.6 | 36 (36) | 58.0% | 70.5% | 41.5% | 100.0% | 55.0% | 114 s | 13 s | 9 squads, tap 3, starts 2/1 |
| 39 | tw-1f3f0 | Castle | emoji | hard | 34×31 | 4 | 31.1 | 24.4 | 36 (36) | 20.5% | 42.0% | 9.3% | 75.0% | 24.3% | 121 s | 9.3 s | 6 squads, tap 4, starts 2/1 |
| 40 | met-436534 | Roses | painting | relief | 30×34 | 5 | 20.3 | 14.6 | 28 (28) | 82.3% | 88.8% | 46.5% | 100.0% | 79.3% | 135 s | 13 s | no outline |
| 41 | ours-g16 | Mushroom House | ours | saw0 | 27×34 | 7 | 25.4 | 23.0 | 32 (32) | 71.0% | 85.3% | 50.2% | 95.0% | 72.0% | 112 s | 13 s | 10 squads, tap 4, starts 3/0 |
| 42 | noto-1f432 | Dragon | emoji | saw1 | 32×34 | 6 | 30.2 | 26.6 | 46 (46) | 53.8% | 83.8% | 27.0% | 100.0% | 58.0% | 147 s | 12 s | 13 squads, tap 2, starts 2/0 |
| 43 | tw-1f438 | Frog | emoji | saw2 | 34×31 | 4 | 33.4 | 30.5 | 38 (38) | 38.3% | 49.3% | 25.8% | 100.0% | 39.3% | 106 s | 8.4 s | 10 squads, tap 3, starts 2/0 |
| 44 | ours-g18 | The Sapper | ours | saw1 | 34×31 | 6 | 29.6 | 21.1 | 37 (37) | 54.5% | 71.5% | 36.5% | 100.0% | 60.7% | 131 s | 12 s | 11 squads, tap 7, starts 1/2 |
| 45 | noto-1f36d | Lollipop | emoji | hard | 33×34 | 6 | 25 | 23.2 | 38 (38) | 21.0% | 36.8% | 12.8% | 40.0% | 14.3% | 149 s | 15 s | 10 squads, tap 2, starts 3/0 |
| 46 | tw-1f451 | Crown | emoji | relief | 34×31 | 6 | 34.8 | 30.4 | 38 (38) | 74.5% | 83.3% | 60.0% | 100.0% | 76.0% | 108 s | 13 s | 8 squads, tap 3, starts 2/0 |
| 47 | met-436530 | Oleanders | painting | saw0 | 41×34 | 5 | 22.4 | 18.2 | 51 (51) | 71.5% | 83.0% | 35.0% | 100.0% | 74.0% | 187 s | 15 s | no outline |
| 48 | ours-g19 | Hatchling | ours | saw1 | 29×34 | 7 | 25.9 | 21.1 | 42 (42) | 56.0% | 68.5% | 39.3% | 100.0% | 58.3% | 159 s | 15 s | 11 squads, tap 2, starts 2/0 |
| 49 | noto-1f47d | Alien | emoji | saw2 | 32×34 | 3 | 34.5 | 32.0 | 35 (35) | 39.0% | 50.5% | 27.8% | 100.0% | 39.3% | 104 s | 9.7 s | 12 squads, tap 4, starts 1/0 |
| 50 | tw-1f680 | Rocket | emoji | saw1 | 34×34 | 5 | 31.6 | 26.2 | 39 (39) | 53.0% | 63.0% | 42.8% | 100.0% | 51.7% | 146 s | 14 s | 8 squads, tap 3, starts 2/1 |
| 51 | ours-g22 | Plumed Helm | ours | hard | 24×34 | 4 | 29.2 | 24.5 | 30 (30) | 23.8% | 34.5% | 10.8% | 100.0% | 25.3% | 85 s | 7.0 s | 8 squads, tap 4, starts 3/0 |
| 52 | noto-1f308 | Rainbow | emoji | relief | 31×34 | 6 | 31.4 | 27.4 | 33 (33) | 71.8% | 84.3% | 58.8% | 100.0% | 68.7% | 112 s | 11 s | 6 squads, tap 3, starts 2/1 |
| 53 | tw-1f383 | Jack-o'-Lantern | emoji | saw0 | 34×34 | 5 | 31.7 | 24.5 | 42 (42) | 71.8% | 83.8% | 44.8% | 100.0% | 71.3% | 138 s | 14 s | 6 squads, tap 2, starts 1/0 |
| 54 | met-435882 | Apples and Primroses | painting | saw1 | 42×34 | 6 | 21.3 | 14.6 | 52 (52) | 55.8% | 89.8% | 9.0% | 70.0% | 60.0% | 209 s | 13 s | no outline |
| 55 | ours-g23 | Sheep Knight | ours | saw2 | 27×34 | 5 | 25.9 | 22.4 | 31 (31) | 39.5% | 50.2% | 23.8% | 100.0% | 32.3% | 111 s | 15 s | 9 squads, tap 4, starts 1/0 |
| 56 | noto-1f33b | Sunflower | emoji | saw1 | 27×34 | 5 | 32.9 | 28.2 | 35 (35) | 57.3% | 71.5% | 42.5% | 100.0% | 59.0% | 132 s | 12 s | 11 squads, tap 4, starts 2/0 |
| 57 | ours-g20 | Sword in the Stone | ours | hard | 28×34 | 4 | 28.9 | 22.9 | 39 (39) | 20.3% | 27.8% | 10.3% | 61.0% | 15.3% | 104 s | 7.7 s | 8 squads, tap 5, starts 2/2 |
| 58 | ours-g21 | Party Slime | ours | relief | 20×34 | 5 | 32.1 | 24.0 | 24 (24) | 74.8% | 94.5% | 52.8% | 100.0% | 82.0% | 79 s | 9.5 s | 8 squads, tap 3, starts 2/0 |
| 59 | ours-g06 | Wise Old Owl | ours | saw0 | 24×34 | 4 | 27.3 | 21.6 | 29 (29) | 71.3% | 79.5% | 62.5% | 100.0% | 74.0% | 130 s | 12 s | 12 squads, tap 2, starts 1/0 |
| 60 | ours-g24 | Goblin King's Hoard | ours | saw1 | 31×34 | 5 | 26.1 | 22.8 | 42 (42) | 53.5% | 69.8% | 36.0% | 95.0% | 50.0% | 191 s | 13 s | 12 squads, tap 2, starts 1/0 |

## Verification

| Check | Result |
|---|---|
| `node tools/test.js` | **272 passed, 0 failed** (was 245): ring compile and known answers, the outline, engine vs reference on 40 random ring boards (240 games, 24,080 pops) and on the Gallery's boards (150 games), the converter's hand image and PNG round trip, the Gallery file's invariants, the save's `gal` |
| `SP.selfTest()` | **982 pass, 0 fail** at 375x812, 812x375, 1280x720, the 400x600 iframe and the hidden tab (was 791): 180 Gallery replays (60 x 3 difficulties through `playCol`), the palette on tiles, spaces and board, sappers entering from 3+ edges, locked and open buttons and screen, a win into `gal` and Next picture, the thumbnail in colour after the win, the save's `gal` through sanitize |
| `node tools/harness.mjs` | **all passed**, 0 console errors or warnings; the Gallery at every viewport: padlocked before 25, a real tap opens it, a real tap on a painting plays it, a real card tap sends sappers in from the edges, the top bar goes back to the grid |
| Smallest Gallery board cell (CSS px) | 375x812: **8.0** (Red Fuji, 42 columns); 812x375: 9.33 (Irises); 1280x720: 16; 400x600 iframe: 8.5. All >= 8. |
| Frames on Gallery boards | 78 runners live on Red Fuji, 50 on Apples and Primroses: p95 16.8 ms, draw 0.04-0.09 ms mean, 0.4 ms max (375 and 1280) |
| `node tools/regrade.js` (siege) | 100 levels, 755 checks, **0 differences** |
| `node tools/regrade.js --gallery` | 60 levels, 480 checks, **0 differences** |
| Critic diff `diff.mjs --patient 6 --rushed 5 && edge.mjs` | 3,744 games, **0 mismatching**, 0 grade mismatches; edge boards agree |
| `debug-v4.js --check`, `teach-v4.js --check` | match |
| Siege files | `levels/levels.json` md5 **8c14f6087dc6a4b72fce9057017a8d2a**, `levels/debug-v4.json` md5 **bf16dce84f16a9dac42c35c1f961eb29**, `tools/build-data/teaching.json` 4d43d838aee040236449a6bf410b562b: all unchanged |
| Siege dealer | `gen.deal` without `capOf` is unchanged: a trial bake of levels 4-8 reproduced their entries in `levels.json` exactly |
| `node tools/palette.js`, `tools/fade.js` | siege unchanged (min pair 25.5; 0 of 312 faded pairs under 20); `fade.js --gallery`: 42 of 2,472 under 20, all paintings |
| Gallery bake determinism | two bakes from scratch: identical but for the wall-clock seconds |
| `tools/shots-v4-m4.mjs` | 0 console errors or warnings |

**Payload**: 806 KB on a phone load (harness, every same-origin request; was 594 KB at M3): `levels/gallery.json` 142 KB (27 KB gzipped) plus the code. Portal cap 20 MB. `tools/gallery-src/` (2.2 MB) and the manifest are never fetched.

## Screens (`tools/shots-v4-m4/`, gitignored)

- `contact-sheet.png`: all 60 boards at rest, numbered and titled, drawn by the game (for Peter's veto).
- 375 and 1280: `*-title-gallery-locked`, `*-map-gallery-locked`, `*-title-gallery-open`, `*-gallery-open` (12 won, the rest dimmed), `*-gallery-credits`; four pictures (Pizza Slice, Goblin's Lunch, Cat, The Great Wave) each `-rest`, `-entry` (600 ms into the first squad: sappers on three or four edges) and `-breach` (1.4 s into the first black squad: a hole in the outline).
- The smallest-cell Gallery board at each viewport: `375-`, `1280-`, `812-`, `400-gallery-smallest-cell.png`. The harness's own screens and report: `tools/shots-v4-m4/harness/`.

## Open

- **Peter's veto** at the playtest: 60 kept, 28 spares in the manifest. A swap is a manifest edit (`keep`, `order`) and `node tools/gallery-bake.js` (10 minutes).
- **Paintings**: 8 read at 40 cells, not 12. Their faded queue pairs go under the siege's 20 (smallest 12.0); the visual critic should judge them against the tiles' size step and bands.
- **Noto's moved path** (above): same repo and license, a different URL from the brief's.
- **Apache 2.0's notice**: LICENSES.md names the license with its URL; if a portal wants the full text shipped, it is one more file (a download not on the approved list, so not fetched now).
- **The lookahead player** wins every non-hard picture, as in the siege's mid band; the Gallery's hard slots are the only place it loses (median 61%). If Peter wants the Gallery to bite more, narrow more slots (`narrowFor`).
- Parked in LATER.md (M4 section).
