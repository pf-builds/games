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

## 6. Fix pass after the critics (2026-10-04)

One fix pass on `tools/critic-v5-r3-functional.md` (1 blocker, 1 major, 3 minor) and `tools/critic-v5-r3-visual.md` (6
should-fix, 8 nits). Checklist: `tools/v5-progress.md` piece 3. Shots: `tools/shots-v5-r3/` (`fix-*`, see the script's
header), re-shot with the builder screens.

1. **Long tail (blocker).** The 7x5 grid of 30 px thumbnails is gone. The wash now holds the latest `map.tail.show` (3)
   cleared long-tail pictures in one row of 44 px frames (a won quest's purple frame) and, past three, a parchment chip
   "N pictures" (44 px tall) that opens a sheet (`#tailsheet`, the settings sheet's modal) of all of them as 56 px tiles;
   a tile closes the sheet and plays that picture; Done, the backdrop or Escape close it. Measured: every target 44 px
   (row and chip) or 56 px (sheet), all hittable at 375x812 and 1280x720. The block is 144 x 94 CSS px, clear of the
   Goblin King, the fog label and the road.
2. **Old saves by slot (major; Peter's call).** `save.js` `bySlot`: before sanitizing, a `done` or `best` key, or `last`,
   that the page does not have and reads "e<era>-<n>" moves to the page's level in slot n; a key the page has wins over a
   renamed one. Level ids carry the campaign slot as their number (e1-25 is slot 25), so n is read off the id; the brief's
   (e-1)*25+i formula would have mapped e2-50 to 75, so I used the id's own number. Only four ids moved in R2 (v4.3's
   e1-25, e2-50, e3-75, e4-100 are e2-25, e3-50, e4-75, e5-100). First-clear coins read `done`, so a migrated level never
   pays twice; `got`, coins, gal (picture ids never changed) and eggs need nothing. Tests: the shipped v3, v4, v4.1, v4.2
   saves now keep every cleared level (v4.2: all 100, last e5-100, the map centres on the fog); a built v4.3-shaped save
   (format 2, 100 cleared, pictures 1-25) loads with 100 cleared, bests and last moved, picture 25 and the long tail open,
   and `record` on the four renamed levels returns false (no first clear left).
3. **All cleared.** `mapPic()`: with every level cleared, the long tail's next picture, else (new) the open side quest
   nearest the end; null once every picture is cleared too (`allDone`). Then the map's Play is hidden and `#jr-end` shows
   "Every level and picture cleared. Tap any of them to play it again." (phone foot bar and desktop card); the card reads
   "All cleared!" with no tag and no side quest row. While pictures remain the card names "Picture N" (it said "Side quest
   N" over "Play picture N" before, and the quest row repeated it). "The road goes on" stays as the R4 teaser. The home's
   Play still reads "Level 100" (the brief kept the home).
4. **Next-up quest.** `journey.js nearQuest`: the open, unwon campaign quest whose main level is nearest the current level
   (ties: the lower picture). The desktop card's quest button, its tap and the gold ring on the map use it; the win sheet's
   "Next picture" keeps the first open one by number (unchanged flow). Realm 3, 1-55 cleared and pictures 1-3: picture 13
   (after 52, Ladder), not picture 4.
5. **Spacing.** Quest 15 moved to open ground left of the road between 59 and 60 (385,1020; detour from road sample 27 by
   level 59); test.js asserts every pair of levels, quests, eggs and the long-tail node (in world coordinates, so across
   sheet joins too) at least 48 CSS px apart at 375 wide. Closest now 54.3 (levels 46 and 47); nothing else was under.
6. **Collisions.** Realm 4's open banner covered sheet 10's woodpile egg and sat on the Level 75 label: both sheet 10 eggs
   moved up-left (grass 100,1045; woodpile 250,975), and realms 3 and 4's banners sit 22 sheet px lower
   (`map.bannerDy`), measured clear of level 50, the Level 75 label and level 74 when open. The side picker
   (`journey.js side`) now scores by how deep other nodes and eggs reach into the box, plus the route (the sheet's road
   samples, `route.underW` either side, counted once at half weight) and the realm banners (this sheet's and the one
   above's, `map.bannerPx`); bubbles may also go below ("s", new `.bz-s`), the current label above or below (`.up`,
   `.dn`) when neither side is clear. Quest 20's bubble now sits below it, off the walked route 80-81; quest 14's goes
   above, off level 56. An audit across 15 save states (0-100 cleared, no pictures, every banner opened) at 375 and 1280:
   0 bubble or banner overlaps with nodes, quests or eggs; two labels graze a neighbour's 44 px button box (56 over 55,
   60 px²; 86 over 85, 145 px², the badge edge, not its number); the bubbles of quests 14 and 19 and the fog picture's
   still touch 1-5 road samples at a corner (each has no side fully clear of the road on a 360-wide column). selfTest now
   checks the 74-cleared state: no bubble or the label covers another node by more than 8x8 px.
7. **Quest 23** moved off the painted tower onto the painted spur by 92 (668,930; detour from road sample 37).
8. **Play bar tag** sits inside the button after its words (20 px), on the phone bar and the desktop card.
9. **Nits fixed:** tag pills under nodes 12 -> 14 px; a won quest keeps its purple frame (rounded square, the level's
   green check) instead of turning into a gold square (the long-tail row and sheet use the same frame). **Skipped (LATER
   or design calls):** the Goblin King art (7), a prize bubble on every open quest (9: a design call; the gold ring marks
   the next one), desktop cards top-aligned (10), crossfade ghosting at Ironhollows seams (11: art), bridge density on
   sheets 5-6 (12), realm 5 a single level (13: R4 builds 101+).

Layout edits are recorded in `tools/map-gen/plan.json` `manual` (with a `why`, which `assemble.py` now skips), so a
re-assemble keeps them. The critics' 62 PNGs are not committed (gitignored); their reports and `notes.json` are.

Checks (after the fixes): `tools/test.js` **461 passed, 0 failed** (6 new: slot migration on a v4.3-shaped save, the
shipped v4.2 save and the id-wins rule; the nearest open quest; the side picker on route, banner and edge; tap targets
48+ CSS px apart, closest 54.3). `SP.selfTest()` under `?debug=1`: **525 (375x812) and 527 (1280x720) passed, 0 failed**
(new: the tail row, chip and sheet sizes and hits, a sheet tile plays, the all-cleared state, the nearest quest with its
ring, no bubble or label over another node at 74 cleared). At 375x812 with deviceScaleFactor 1 one colour-blind stud check
fails on this head and on 565bb48 alike (pixel sampling at 1x); the critic and the harness run 3x and pass. `tools/harness.mjs`:
**all passed**, 0 console messages. `tools/freeze.js --require`: PASS; `tools/regrade.js` 555 checks and `--gallery` 360
checks, 0 differences. `./tools/critic-v5/run.sh`: 5,412 games, 0 mismatches, known-answer boards wrong 0, real pace
160/160. `tools/shots-v5-r3.mjs`: 0 console messages; map open 61-63 ms; phone scroll at 4x CPU median 16.7 ms, max 16.8.
Cache tag `?v=33` (the font's URL in style.css too: a mismatched tag left the preload unused, which the harness caught).
