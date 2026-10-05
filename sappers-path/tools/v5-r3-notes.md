# Sapper's Path v5 R3: notes (the journey map, 2026-10-04)

Piece 1 (the art: 13 painted sheets, `map/layout.json`) is in `tools/map-gen/README.md`. This file is piece 2: the map
SCREEN, built on that art from the orchestrator's brief of 2026-10-04 (Peter's calls in it) and the approved mockup
(`game-research/sappers-path-v4/map-mockups/b-parchment/`). Checklist and commits: `tools/v5-progress.md` (R3 section).
Screens: `tools/shots-v5-r3/` (gitignored, like every shots folder; `tools/shots-v5-r3.mjs` remakes them).

## 1. What was built

- **The map replaces the level grid and the Gallery screen.** The Gallery screen, its tab and its buttons are gone, and
  so are `gallery.openAt`, `title`, `btn`, `count`, `lockedHint`, `playChip`, `silhouette` and `meta.home.galTab`
  (`gallery.r3Note` says so). `showScreen("gallery")` lands on the map. The home keeps its one Play; its tab bar is Map
  and Home. The picture credits (CC BY attribution) moved to the foot of the map, under the first sheet, with the story.
- **Sheets.** The 13 JPEGs stack bottom to top in one scroller (`#jr`), sheet k+1 over sheet k, `step` (1264) sheet px
  apart. Each sheet is a box (CSS px from `layoutMap`) holding its image, one SVG in sheet pixels and a layer of buttons
  placed in percent of the sheet, so a resize moves 13 boxes and nothing else. The column is the screen's width up to
  `map.colMaxPx` (520); a screen at least `map.cardsMinW` (1100) wide gets a 430 px column between a realm card and a
  next-up card (the mockup's desktop). Below that, Play is a foot bar.
- **Lazy images.** An IntersectionObserver on the scroller requests a sheet's image once it is within `lazyMarginPx`
  (1400) of the view. Measured at open: 3-4 of 13 requested (selfTest, harness and the screens check it).
- **Opening the map** puts the current node `curAt` (0.6) down the scroller (measured 0.598-0.601 at four viewports),
  clamped so the story and credits stay below the fold and the top sheet's fog stays in view.
- **The route.** Each sheet's painted road centreline (`layout.json` `road`) is drawn twice: walked (red dashes over a
  pale underlay) up to the current node's road sample, faint ink dashes ahead. Only the sheet the cut sits on, and any
  sheet whose side flipped, gets new path strings on a render; nothing happens on scroll.
- **Levels 1-100** are buttons on their layout spots (44 px targets): cleared (gold, a check, its tag pill), current
  (parchment, a breathing glow, the label "Level N" with its tag beside it), open gap (parchment), locked (dark; a tap
  shakes with `lockedTap` and starts nothing). Aria labels as the old grid's.
- **Side quests 1-25**: a purple picture node off the road, joined to it by a drawn detour (a dashed curve with stepping
  stones every 30 sheet px; the painted spurs are mostly missing). Locked: dim, its prize icon on the corner, a tap
  shakes. Open: bright, a gold ring on the next one, and the prize bubble (the power-up's icon, "+1"). Won: the
  finished picture in its colours (`thumb()` at 1 canvas px a cell), tap to replay. The first clear still pays through
  `questPrize`/`Meta.gift` with its toast; a replay pays nothing.
- **A side quest won** keeps the existing flow (my call: the simplest, and it already had tests): the win sheet offers the
  next open quest, else the next level; the top bar's button and the fail sheet's second button go to the map.
- **Past 100.** On sheet 13 the road ahead fades out (a stroke gradient from y 470 to 300) into a fog band, under a dark
  wash with the Goblin King and his banner, which also covers the sheet's horizon line and the road's off-centre end
  (515,148); "The road goes on" sits in the fog. Once 1-100 are cleared one next-picture node appears there (road sample
  118): the first open picture of 26-60 (questOpen's one-at-a-time rule), with its prize bubble. The map's Play then
  reads "Play picture N" and starts it. Cleared long-tail pictures sit as small framed thumbnails in rows of 5 in the
  wash, top left, each a button to replay.
- **Easter eggs**: the 26 spots in `layout.json`, eight kinds, each an ink SVG with its own found look: woodpile to
  campfire (flicker), rustling tuft to a hare, ripples to a leaping fish, reeds to a frog on a lily pad, toadstools to a
  glowing fairy ring, a raven to a raven off with a gold coin, a glint on a rock to a gold nugget and gem, a faint light
  to a will-o'-the-wisp. The first tap pays `map.eggCoins` (10-15 each, 331 in all) through `Meta.egg` (once: the save's
  new `eggs: {id: 1}`; old saves load with none found), bounces the sprite, pops "+N" and updates the top bar's coins.
  Later taps only wiggle it.
- **Bridges**: 14 plank bridges where the road crosses painted water, found by eye on water-mask overlays of each sheet
  (`map.bridges`: [sheet, road sample]); four were nudged off nodes and quest spurs (a test keeps them 60+ sheet px from
  every node). Sheets 7-9 and 13 have no crossings.
- **Realm banners**: a parchment scroll on each realm's first sheet ("Realm 2 Fenwater Vale"); a tap shows the lore line
  under the name (aria-expanded). The desktop realm card shows the current realm's lore, cleared and coins (the old
  report card), side quests won and secrets found there.
- **Desktop cards**: realm (left) and next up (right: the next level and tag, Play, the next open side quest as a
  button).
- **Debug**: under `?debug=1` a row under the top bar holds the four v4 twists' levels (the harness taps them there).
- **Motion**: the glow, the egg sprites' idle loops and the pop's rise stop under reduced motion (the pop only fades).

## 2. Code layout

- `src/journey.js` (new, UMD, Node-testable): node and quest states, the long tail, the focus node, the route split and
  nearest sample, the label/bubble side picker, egg ids and coins, and the SVG sprites (bridge, detour and stones, the
  eight eggs before and after, the Goblin King, his flag). No DOM.
- `src/main.js` "the journey map" section: `buildMap` (once, at boot, after `map/layout.json` loads), `layoutMap`
  (column size, sheet boxes; keeps the view's middle on a resize), `scrollMap`, `renderMap` (classes, labels, route
  paths, quest looks, tail, eggs), `quest`, `eggLook`, `eggTap`, `mapPic`, `mapCards`. `SP.map()` reports the map for
  the harness and screens. Gone: `buildGallery`, `renderGallery`, `renderGalButtons`, `galOpen`, `galWon`,
  `silhouette`, the era sections.
- `src/save.js`: `eggs` (ids `s<sheet>-<i>`, values 1, at most 256). `src/meta.js`: `egg(data, id, coins)`.
- `config.json` `map`: every number and word of the screen (column sizes, lazy margin, route widths and dashes,
  bridges, stone gap, banner y, egg coins, the tail's spots, label and bubble sizes, texts and egg names).
- `index.html` `#map`; `style.css` "v5 R3: the journey map" block (the old map and Gallery rules removed).

## 3. Decisions I made

1. **The win of a side quest** keeps the existing chain (next open quest, else next level); see above.
2. **Labels and prize bubbles pick their side** (right, left, or for a bubble also above) to cover the fewest other
   nodes, eggs and banners, judged at a 360-wide phone's scale (`journey.js side`). The mockup's bubble-above collided
   with the next level on several sheets.
3. **Tags**: on the current node's label and as a small pill under cleared and open nodes; locked nodes show none (the
   brief's "open nodes"; it keeps a dark, unplayed stretch quiet).
4. **No `content-visibility`** on the sheets: it skipped hit-testing of a just-scrolled sheet until the next frame, which
   broke synchronous hit checks; Chromium culls offscreen paint anyway and the scroll measured smooth without it.
5. **Eggs are tappable from the start**, wherever the player scrolls (the brief set no gate). A player can collect all
   331 coins on day one by scrolling up; see §5.
6. **The map's top bar** is back, title, coins and the gear (the mockup's); colour-blind and sound moved off the bar into
   the settings sheet the gear opens (the harness and selfTest go that way now).
7. **The map's Play past 100** plays the fog's next picture ("Play picture 26"); the home's Play still reads the next
   level (the brief kept the home as it was).

## 4. Checks

- `tools/test.js`: **455 passed, 0 failed** (11 new: egg payout once and capped, the save's eggs, node states, quest
  openness, the long tail one at a time, the route split, layout vs levels/gallery/config, egg coins 10-15 (331 in all),
  bridges 60+ sheet px off every node, one banner a realm).
- `SP.selfTest()` under `?debug=1`: **519 (phones) to 521 (wide) passed, 0 failed** at 375x812, 375x667, 812x375 and
  1280x720; the Gallery-screen checks now run through the map's nodes, plus a new block for the map (24b).
- `tools/harness.mjs`: **all passed, 3:25 wall** (95 s user), every viewport and the hidden-tab run, 0 console messages;
  its Gallery block goes through the map with real taps (a locked quest stays, an open one plays, an egg pays once).
- `tools/freeze.js --require`: PASS, 0 differences. `tools/regrade.js`: 555 checks, 0 differences; `--gallery`: 360, 0.
- `tools/shots-v5-r3.mjs`: 0 console messages. Map open to its first sheets drawn: 61-69 ms (local server). Sheets
  requested at open: 3-7 of 13. Phone scroll at 4x CPU throttling, 40 px a frame for 150 frames: median 16.7 ms, p95
  16.7 ms, max 16.8 ms (no dropped frame in headless Chromium; a real-phone pass is still owed).

## 5. For the critics

- Egg economy: 331 coins on the map from minute one (about 1.3 power-ups' worth at today's prices). A gate (eggs only
  tappable once the sheet's realm is reached) is one line in `eggTap` if Peter wants it.
- The desktop realm card follows the current node's realm, not the realm under the view while scrolling.
- The fog label and the long-tail thumbnails sit in the dark wash at the top; with all 35 long-tail pictures won the
  thumbnail block is 7 rows tall (about 230 CSS px) and reaches the top of the faded road on a phone.
- Bridges are placed by eye on road samples; a few (sheet 5 sample 65, sheet 6 samples 56 and 93) sit on causeway
  water where the painted road already reads as a crossing; worth a look on a real phone.
- The quest prize bubble on a node near the column edge (quest 19 on sheet 10, x 659) picks the left side; the locked
  prize icon on that node's corner sits close to the column's edge.
