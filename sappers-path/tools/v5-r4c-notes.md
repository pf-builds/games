# Sapper's Path v5 R4c: notes (the journey map for levels 101-200, 2026-10-05)

Brief: the orchestrator's R4c brief of 2026-10-05, built overnight in the worktree `repos/games-sappers-path-map/` (branch
`sappers-path-map`) while another builder bakes levels 101-200 on `sappers-path`. Checklist: `tools/v5-progress.md` (R4c).
The art pipeline and every sheet's picks, prompts and lessons: `tools/map-gen/README.md` (the R4c section).
Screens: `tools/shots-v5-r4-map/` (gitignored; `tools/shots-v5-r4-map.mjs` remakes them and runs the checks).

## 1. What was built

- **Art.** Sheet 13 repainted (no fog: the road runs on at x = 384) and sheets 14-25 added with the R3 two-pass SDXL
  base 1.0 pipeline: realm 5 The Mistmoor 13-15 (levels 100-124), realm 6 Emberwatch Crags 16-18 (125-149), realm 7 The
  Shrouded Weald 19-21 (150-174), realm 8 The Goblin King's Throne 22-25 (175-200; 25 is the summit with 198-200, the
  fortress, the king and the long tail's spot in the fog). 69 SDXL runs, one image a run, memory 65-85% free and swap 0
  after every run. Sheets 1-12 are byte-identical to R3 (md5 checked after every assemble) and their layout records too.
- **Layout** (`map/layout.json`): spots for levels 1-200 and quests 1-50 (with branches), two eggs a sheet (50), the
  top sheet's `tail` (the long tail's node, with `fog`: the row the fog is full at), `fortress` and `goblinKing`.
- **Bridges** (config `map.bridges`): three stone bridges over lava (sheet 17 samples 46 and 97, sheet 18 sample 59),
  found by a lava-on-both-sides scan of the road and checked by eye; a bridge entry's third item `stone` draws stone.
- **Eggs**: five new kinds drawn in the existing ink style (`journey.js`): a bubble on the lava that becomes a lava
  salamander, a spark that becomes an ember sprite, blue caps that open into a glowcap cluster, eyes in the dark that
  become an owl, a rickety lookout whose goblin pops up waving. Realms 5-8: wisp, fish, reeds / bubble, ember, raven /
  glowcap, owl, wisp / lookout, glint, raven (grass where no painted host was found). Coins 10-15 each (config rows 14-25).
- **The Goblin King**: a new ink-and-wash SVG (green skin, long ears, gold crown, red cloak with a ragged hem, a crooked
  sceptre), standing at the fortress gate beside level 200 once 200 is built; until then he waits in the fog's wash as a
  teaser (R3's spot). His flag sits on his left (off quest 50).
- **Code: the frontier** (`journey.js frontier`, `main.js buildMap`). The map is built up to the first level not built
  yet (its spot), or, with every spot's level built, the summit's long-tail spot. Sheets past it are not built (no DOM,
  no image request); nodes only for levels that exist; a side quest only once its main level exists (later ones are the
  long tail, as before); eggs, bridges and realm banners only below the frontier's fog (a banner also needs a level in its
  realm). The fog is pale mist drawn in the frontier sheet's SVG: clear 40 sheet px under the frontier node, full 260 above
  it (at the summit: full at the layout's row 250, clear 200 below that, so the fortress shows). The road stops 6 samples
  into the fog and its dashes fade there. The long tail's node waits at the frontier, its label above it, the won pictures
  in the wash at the top-left. If a frontier ever sits within 420 sheet px of its sheet's top, one more sheet is built
  under full fog to hold the wash and the pictures (never the case with 1-100 or 1-200; checked in Node only).
- **eggReached**: a realm with no levels now counts as not reached (its eggs hide and pay nothing).
- **Side picker**: quest bubbles are placed first (now also off each other and off the long tail's bubble) and the
  current level's label then keeps off them and off the Goblin King. This applies to sheets 1-12 too: R3's own 1-99 audit
  went from 23 to 19 overlaps (the two bubble collisions there are gone).

## 2. Decisions I made

1. **Realm 8 has 4 sheets** (175-182, 183-190, 191-197, 198-200 + the summit), 25 sheets in all, so the summit sheet
   has room for the fortress and the fog. Realms 5-7 have 3 sheets each, 10-11 stops a sheet like R3.
2. **Prompts changed per realm** where SDXL drifted: the fen prompt made one big lake, so the Mistmoor became "moorland of
   tussock grass ... many small dark still pools"; "crags" drew perspective spires, so the Crags became "a dark grey
   volcanic plateau of cracked basalt slabs" with a realm `negExtra` (mountains, peaks, spires, cliffs, side view); the
   forest drew trunks side-on, so the Weald became "an enchanted forest canopy of round green treetops ... map of the woods"
   (negExtra: tree trunks, side view); the badlands drew cliffs, so realm 8 became "dusty brown scrubland ... small round
   goblin huts". The stop rule did not trip: the road held on every first sheet (13, 16, 19, 22) and the look stayed
   ink-and-wash parchment.
3. **The summit stays in perspective.** Six land seeds at two strengths all drew the fortress as a 3/4 castle with a
   horizon (like R3's castles on sheet 12). I kept the one whose fortress sits where the guide put it (left of 200) and
   whose road holds; its horizon is under the fog and wash. Above the long tail's node the painted road turns right while
   the layout's centreline goes up the middle; the fog covers both.
4. **No bridges in the Mistmoor or the Weald**: the Mistmoor road runs on painted causeways, the Weald's streams run beside
   the road. Sheet 16's lava crosses the road right at level 130's node, so no bridge there.
5. **The frontier is the next level's spot**, not a fixed road sample, so the long tail's node is spaced like a level
   (the 48 CSS px test covers it) and the map grows level by level as the other branch adds levels.
6. **R3's contact sheets were removed** (they showed 13 sheets): `contact-r4.png` (240 wide, 25 sheets, nodes, quests, eggs,
   tail and king drawn) and `contact-seams-r4.png` (24 joins, 120 px either side) replace them, to keep the folder near 20 MB.
7. **Layout fixes** from the tests and the overlap audit are `plan.json` `manual` entries with a `why` (quests 34, 37, 43,
   47, 48, 50 and eight eggs), so a re-assemble keeps them.

## 3. Checks (final)

- `tools/test.js`: **462 passed, 0 failed** (new: spots for 1-200 on 25 sheets and every built level has one; the summit
  holds 200, the king beside it, the tail above; the frontier at 100, 107, 200 and 0 built; spacing over all 301 targets
  48+ CSS px at 375, closest 54.3, as in R3).
- `tools/freeze.js --require`: **PASS**, 0 differences (no level touched).
- `SP.selfTest()` under `?debug=1` (run by the screens script): today (1-100) **527 at 375x812 (3x) and 529 at 1280x720,
  0 failed**; with 200 levels (fake, below) **727 and 729, 0 failed**. New selfTest checks: sheets built up to the
  frontier, no node past the last level, quests, eggs, banners and bridges counted against the frontier, the long tail's
  node at the frontier, the king's place; egg gating with "no levels = not reached".
- `tools/harness.mjs --url http://127.0.0.1:8495/sappers-path/`: **all passed**, 0 console messages.
- `tools/shots-v5-r4-map.mjs`: 0 console errors or warnings, 0 overlaps or unhittable buttons in the named states.
  The fake-200 state serves `levels/levels.json` with 101-200 cloned from 1-100 (ids f-<n>, era by realm) and config
  with eras 6-8 added, through Playwright routes; nothing in the game changes for it.
- Overlap audit at every current level 100-200 (a report): 20 label grazes on the phone, 5 on desktop (R3's 1-99 under
  the same rule: 19). Listed in LATER.
- Sizes: map art **6.95 MB** (25 JPEGs, 251-312 KB each, plus layout.json); the game without `tools/` **11.45 MB**; the
  whole folder with `tools/` **19.85 MB** (tracked files).

Screens in `tools/shots-v5-r4-map/` (phone 3x and desktop): `today-fresh`, `today-100` (level 100 under the fog, the king's
teaser), `today-tail` (picture 26 at level 101's spot), `r5-111`, `r6-137` (stone bridges), `r7-160`, `r8-185`, `summit`
(level 200, the fortress, the king), `tail-200` (picture 51 in the fog past 200), `tail-200-row` (won pictures row and
chip), `eggs-r6` and `eggs-r6-found` (lava salamander and ember sprite, 26 coins).

## 4. Not done or waived

- No cache-tag bump (the merge does it).
- The two remaining bubble/label touches (states 171 and 188) and the label grazes: LATER.
- The headroom-sheet case of the frontier is covered by the Node test only; neither real state uses it.

## 5. What the merge with `sappers-path` needs

1. **Files both branches touch**: `config.json` (this branch: `map` only; the other: `eras`), `src/main.js` (this
   branch: the header comment, the journey-map section and selfTest 24b), `tools/test.js` (the v5 R3 map block), and
   `tools/v5-progress.md` (both append a section at the end: keep both). Everything else here is `map/`,
   `tools/map-gen/`, `src/journey.js`, `LATER.md`, and new files.
2. **Levels**: 101-200 must carry `n` 101..200 in play order (the frontier reads the last level's number) and `era` by
   the realm table (100-124: 5, 125-149: 6, 150-174: 7, 175-200: 8): banners, egg gating and the realm card use `era`.
   A partial merge (say 101-150) just stops the map at 151's spot.
3. **Eras 6-8** in config `eras` (name and lore); without them the banners fall back to the layout's realm names with no
   lore and the realm card reads "Realm 6 of 5".
4. **After the merge**: bump the cache tag; run `tools/test.js` (the layout test then checks all 200 built levels have
   spots), `freeze.js --require`, the harness, and `tools/shots-v5-r4-map.mjs` (its fake200 mode clones only the levels
   still missing, so after the merge it runs on the real 200).
5. **Size**: the folder is 19.85 MB before the new levels; levels 101-200 will push it past 20 MB (levels/ is 3.5 MB for
   1-100 and the 60 pictures). The player payload stays near 12-14 MB. If the 20 MB line is for the whole folder, the
   contact sheets (3.4 MB) and the 69 run logs (1 MB) can leave git.
