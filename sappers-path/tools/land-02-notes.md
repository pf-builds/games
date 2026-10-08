# Zen World 3 Snack Galaxy installed: v6 lane D, piece D7 (2026-10-08)

## 0. D8 fix pass (2026-10-08): no mystery blocks in Zen + the World 3 critic's should-fix items

Inputs: Peter's rule of 2026-10-08 (`game-research/sappers-path-v4/land-factory.md`, "No mystery blocks in Zen") and the
critic's report (`tools/critic-land-02.md`, functional PASS, 0 blockers, 4 should-fix, 7 minor; evidence in
`tools/critic-land-02/`). Sections 1-8 below are D7's record; where D8 changed a level, this section has the new numbers.

**No mystery blocks (11 levels: 251 252 254 260 264 268 272 278 286 297 300).** `tools/zen-unhide.js` takes `hidden`,
`hideC`, `hideQ` and the "hidden" feature off each bake result in `scratch/bake/` and grades the level again on its own seed
(land-bake `gradeLevel`, the bake's counts). The engine never reads `hidden` (information only), so the stored order, the real
pace, the longest tap and the taps are byte for byte the same; the tool refuses a level where they aren't. Every player that
reads the view was graded again: random-tap rate, careful player and fast tapper came out identical on all 11 (the careful
player already saw every block); the lookahead moved on two (272 0.51 to 0.53, 278 0.81 to 0.96). All 11 met every bake
target, so **none needed a re-deal**. Same boards, decks, ? cards, links, moats and fills (the chocolate fill stays in
land-config for the Campaign; no Zen level draws it now).

**Swaps (lane C's eligible spares, `picks-full.json`, boards identical to `boards-full/`; prep with the local-ai venv's
Pillow, no image model run).** Each slot kept its tag and its planned features minus hidden (`bake --keep-plan`, below):

| Level | Old | New | Why |
|---|---|---|---|
| 300 (Hard, links + ? cards; was + mystery blocks) | sg282 Broccoli mech | sg296 Coffee cup UFO (7 colours) | The finale didn't read. A big red-and-white saucer over an orange moon on a sunset sky reads at once at 375. Hard slot keeps 7+ colours. Picked with a new Hard careful floor (below): 17.0%, careful 1, 242 s, 53 taps |
| 296 (Easy, links) | sg250 Kitten and the laser | sg264 Comet bowling (4) | The kitten was a 6x5 smudge. A big red cherry rolling at three white pins on a cream hill fills the frame. 79.3%, 212 s |
| 262 (Hard, links + ? cards + moat) | sg330 Lemonade waterfall | sg238, retitled "Saturn fly-by" (5) | Read as abstract shapes. A big rocket passing a ringed planet, ringed by the moat, reads clearly. 11.0%, careful 1, 209 s, 46 taps |
| 298 (Easy, none) | sg339 Gravity spill | sg331 Saturn's hula hoop (5) | One of the three cream-crescent-on-navy pictures (264, 281, 298). A smiling planet in a big gold ring on purple. 67.8%, 203 s |
| 287 (Easy, moat) | sg262 Crater golf | sg258 Asteroid surfing (4) | One of the two full-frame grey moon discs (282, 287). A hot dog surfing a purple wave past a big ringed planet. 58.8%, 153 s |
| 283 | sg234 Rocket out of gas | kept | No spare was clearly better: the rocket spare (sg238) went to 262, and 283's neighbours are rockets and UFOs |

- **Swap trials.** sg233 Wrong landing (the only 7-colour spare that can carry a ring) failed on 262 twice (34 candidates):
  the side opening set shuts the subject in (332 cells) and the front+far set never deals. Three trial bakes of 5-colour
  ring spares on 262 in scratchpad copies of the land: sg238 (11.0%, careful 1), sg284 Sushi space battle (16.8%, careful 1),
  sg294 Bubble tea saucer (15.0%, careful 0). sg238 reads best by far; its bake file and board are the trial's (board
  identical to the land's own convert). So 262 is a 5-colour Hard; Kitten Forest's "busiest on the Hards" was a layout
  preference, not a gate.
- **sg238's title.** Lane C named it "Hot dog in a hurry" (its prompt asked for a hot dog rocket); the picture is a plain
  rocket, the same title-picture mismatch the critic flagged on 283. Its manifest line is "Saturn fly-by" now
  (`titleNote` says why); LICENSES.md follows.
- **Variety.** Picked to avoid moons, crescents and full-frame moon discs, and kept off the 1-4 group spacing: 296 sport (287
  surfing 9 back), 298 clever (300 kinds), 287 sport (278 soccer 9 back). Known soft misses: 262's rocket sits between 259
  Rocket repair and 265 Pizza delivery (both rockets, 3 apart); 300's saucer has a tiny alien next to 299 Alien bakery.
- **Careful floor on the Hards.** The first 300 bake picked a deal where the careful player never won (0 of 16): the bake
  has no Hard floor and took the candidate nearest the band's middle. land.json `profile.carefulFloor.hard` 0.5 (data); the
  re-pick (`--reuse`, same candidates) took k8 at careful 1. Every World 3 Hard now sits at 0.75 or more, and the check gates it.
- **Plan.** A fresh plan would move moats (the plan gives each tag's features to the levels with the fewest so far, so taking
  hidden out moves 6 moat slots). `bake --keep-plan` re-bakes on the plan in `scratch/state.json` with hidden taken out and
  each slot's cant read again. 300's new picture can't carry a ring (subject 62%), so its record says `cant: ["moat"]`; its
  slot had no moat planned.
- **Old sources** sg330 sg262 sg250 sg339 sg282 left `src/` (src holds the 50 main pictures; all five are spares in the
  manifest and `prep` makes them again).

**Minor items.** 5: the glowcap eggs are off the space sheets: land.json `eggs` wisp, glint, ember, bubble, and in `eggTurns`
the three glowcaps became ember (sheet 1), glint (sheet 3) and bubble (sheet 6), same spots, ids z3-<sheet>-<i> unchanged
(only `map.layout[].eggs[].kind` moved in zen.json). 11: the desktop map card's next up names the world, "World 1 · Picture
1" (main.js `mapCards`, Zen's `eye` word plus the picture; config.json untouched), as the home's Zen card pairs world and
picture. 6 (the 250 to 251 road, layout.json) left as briefed. 7, 8, 9, 10: LATER.md.

**Final, all 50:** random-tap mean Easy 65.9% (18), Normal 38.5% (26), Hard 13.7% (6); careful Easy and Normal min 0.875, every Hard 0.75+;
real pace median **211 s** (was 215); 18 ringed; 0 levels with mystery blocks. Contact sheet `tools/land-02/contact.png`
re-made.

Land 2 (the land factory's levels 251-300) plays as Zen World 3, ids z3-1..z3-50. Peter OKed lane C's picks on 2026-10-08.
Inputs (lane C's, read only): `game-research/sappers-path-v4/lands/02-snack-galaxy/` at workspace cffda1d, README section
"Full story scenes", `picks-full.json` (50 picks and 17 spares, kind painting, no chroma), `boards-full/`, and the map
folder (`land-02-a.webp`, `land-02-b.webp`, `templates.json`). The sources come from
`/Users/peter/local-ai/outputs/lands/02-snack-galaxy/fullsrc/`. No image model was run.

**Checks (D8, the whole pass):** land check PASS for Worlds 2 and 3 (new gates "Zen: no mystery blocks" and, World 3,
the Hard careful floor), World 1's zen-world check PASS; test.js 705/0 (new: no Zen level of any world has mystery blocks, every
Zen profile leaves hidden out, land.js refuses one that doesn't); regrade 0 of 2,405, `--gallery` 0 of 372, `--zen` 0 of 774;
critic-v5 0 mismatching games of 10,527, 0 grade mismatches, known answers 0 wrong, pace 312/312 (diff-result.json's
counts follow the levels: fewer mystery-block shows); freeze re-snapshot, diff vs fdd0aea's: levels.json exactly the 11
Kitten Forest records (1-200 identical), zen.json exactly 23 records (W1 8, W3 15) plus World 3's three egg kinds,
gallery.json, castles.json and frozen.json identical; `--require` PASS. levels.json, zen.json, LICENSES.md (World 3's 5 rows)
and the cache tag are the only shipped files changed besides main.js; gallery.json, layout.json, config.json and places.json
untouched. Cache `?v=58`. selfTest 871/0 at 375x812@3, 873/0 at 1280x720, harness all passed, 0 console messages.

**Payload:** tracked files outside tools/ **19,893,378 B** (was 19,999,953; -106,575: the stripped hidden rows in levels.json,
zen.json and their frozen copies). Now 106,622 B under 20 MB; this pass did not move it over. Portal build ≈ **15,276,031 B**
(15.28 MB). No files moved out of the game folder.

## 1. What shipped

| File | Change |
|---|---|
| `levels/zen.json` | World 3's entry (k 3, era 10, name, lore, `map.layout` of 7 sheets with their egg coins) and its 50 records (n 251-300, world 3, no land). World 1 and 2 are byte-identical. |
| `map/land-02-a.webp`, `map/land-02-b.webp` | the 2 sheets (231 KB + 187 KB) |
| `LICENSES.md` | "Zen World 3: Snack Galaxy" table, 50 rows |
| `src/main.js` | `modes()` builds a world whose sheets live in zen.json (`w.map.layout`); a selfTest block for World 3 |
| `tools/test.js` | the world list now has 3 worlds, plus a World 3 block (records, gates, profile, re-grade, sheets, eggs, licences) |
| `tools/land-config.json` | a sixth mystery-block fill, chocolate `#342410`, added last (§4) |
| `tools/land-contact.py` | `--world K` (a Zen world's records), water drawn blue, a board-size and moat line on each tile |
| `tools/lands/02-snack-galaxy/` | land.json, pictures/manifest.json (67 lines: 50 picks + 17 spares), src/ (50), map/ |
| `tools/build-data/frozen/zen.json` | re-snapshot: 36 → 86 records, the 36 byte-identical |
| `index.html`, `style.css` | `?v=57` |

Not touched, per Peter's rule: `levels/levels.json`, `levels/gallery.json`, `map/layout.json`, `config.json` and `places.json`
(no new gallery pictures). World 3's numbers (251-300) collide with no other world: World 1 is 1-36 and World 2 is 201-250.

## 2. Boards

`land.js prep` used the local-ai venv's Pillow (`LAND_PYTHON=/Users/peter/local-ai/.venv/bin/python`, the same as lane C's
hand-off), then `convert` (painting kind, shade on, boardOf's chroma steps). **All 67 boards (50 picks and 17 spares) are
identical to lane C's `boards-full/`** in grid, palette and shade, and so are the 50 sources and boards.json's 50 mains.
Most boards are 42x42; seven are portrait: 32x46 for sg281, sg339, sg292, sg278, sg325 and sg231, and 31x45 for sg282.

## 3. Profile and layout

- **Profile:** Kitten Forest's casual profile as it ships, including `carefulFloor` easy/normal 0.5 (its `hidden.byLevel`
  is Kitten Forest's own and was left out). The result is E18/N26/H6/X0, ending on a Hard. No Extreme, no locks, no
  archers. ? cards go on 2-3 slots, linked squads on 1-2, and mystery blocks hide 0.25-0.40 of the eligible blocks.
- **Gentle moats:** `features.moat` by tag is easy 0.2, normal 0.4 and hard 0.67, with `ways` [0, 1]. That means always
  2 ways in (front+far, or left+right). Plain water is used, or mire where a picture colour sits too close to water.
  18 levels are ringed (36%); 270 and 286 use mire.
- **Moat slots:** I worked out the plan with every picture allowed a ring. The 18 moat slots were 255 257 261 262 265 270
  272 274 276 279 280 282 283 284 286 287 290 299, and the 11 pictures that can't carry a ring went elsewhere. The real
  plan then came out the same, with cant on exactly those 11: 260 266 267 269 277 278 281 292 293 295 297.
- **Order:** an annealing solver (session scratchpad, not kept) with these rules:
  - **Hard rules:** no can't-ring picture on a moat slot; 5 colours or fewer on an Easy slot; 7 or more on a Hard slot.
  - **Variety penalties:** the same group within 1-4 levels (kittens within 6); the same dominant sky colour within 1-3,
    or the same colour family next door; shared motifs within 5. The motifs are rocket, moon, crescent, astronaut, alien,
    donut, pizza, milk, UFO, dino, kitten, planet, cookie, volcano and sunset.
  - **Pinned:** 251 Kitten flag (the world's opener) and 300 Broccoli mech (the closing Hard).
  - **Result:** kittens sit at 251, 260, 268, 277, 284, 289 and 296; the dinos at 261 and 269; Easy levels have 4-5
    colours; the Hards are the busiest scenes. After the bake I made 2 swaps (§4).
- **Coordinator's layout flags (arrived after the bake):**
  - *Fill gap:* 278, 272 and 300 sit on mystery-block slots. Their fill gap is closed by the chocolate fill instead
    (25 / 23 / 25 from every colour). sg319 is on a slot with no mystery blocks.
  - *Broccoli mech:* dealt on Hard 300 first time with no fallback (54 taps).
  - *Seven-colour pictures:* they sit on 5 of the 6 Hards, as Kitten Forest's busiest-on-Hards rule says. Their taps are
    51-55, inside the cap. Nothing failed, so nothing was moved. If the critic wants them spread, it's a swap and re-bake
    of a few slots.
- **Eggs:** the land has no side quests, so each sheet's 2 eggs sit on the template's 2 painted quest-spur tips (World 1's
  rule). This uses `eggTurns` with the quest spots' coordinates; kinds cycle glowcap, wisp, glint, ember and bubble. The
  README's donut, alien, star and comet aren't drawn yet. Egg ids are z3-<sheet>-<i>. The top sheet's 2 eggs sit above
  the frontier fog, so they aren't drawn, the same as World 2's top sheet before World 3 existed.
- **Banner and lore:** "World 3 · Snack Galaxy"; lore: "The road drifts up into a starry sky of donut planets and cheese
  moons, where snacks, kittens and the odd dinosaur float by at their own pace." test.js's word check passes (no goblin,
  fort, assault, siege, raze or throne).

## 4. Bake

1. **First run:** `bake --shard 2`, 206 shards, about 4.5 min. 46 of 50 came out ok on the first pass.
   - 255 sg237 Popcorn eruption (mystery + moat) and 257 sg255 Saxophone sunrise (linked + moat): no deal in 96 attempts
     on every candidate.
   - 262 sg285 Cake volcano (Hard, moat): fallback, every candidate's real-pace replay was lost.
   - 286 sg277 Planet sleepover: fallback (fast tapper).
2. **Swap trials:** three copies of the land in the scratchpad, each baking one swap pair. I took the one with the lowest
   variety cost:
   - 255 ↔ 252: Space high five onto the moat slot, Popcorn onto 252 (mystery blocks).
   - 257 ↔ 258: Moon cheese grater onto the moat slot, Saxophone onto 258 (? cards).
   - All four baked ok, and their bake files went into the land's scratch (same picture, plan and seed).
3. `bake --list 262,286 --extra 12 --reuse`: 286 ok. 262 still lost its pace, so I swapped 262 ↔ 290: Lemonade waterfall
   onto the Hard and Cake volcano onto Normal 290 (mystery + moat0). 262 came out ok. 290 needed `--extra 16` (steady-rhythm
   fallback first).
4. **Check:** the mystery-block fill gate failed on 272 Burger planet, 278 Planet soccer kick and 300 Broccoli mech. Every
   one of land-config's 5 fills sat under 20 from a picture colour (14.6 / 18.4 / 13.9 best). I added a sixth fill,
   chocolate `#342410` with a cream ?, as the last entry. `fillOf` takes the first fill at 22+, else the farthest, so
   every level that already had a fill keeps it. Shipped Kitten Forest and World 1 records store their fill, so nothing
   shipped changes. Those 3 levels draw it now (23-25 from every colour).
5. **No spare used.** Re-baked: 252, 255, 257, 258, 262, 286 and 290.

Final, as graded (all 50):

| | Easy (18) | Normal (26) | Hard (6) |
|---|---|---|---|
| random-tap win rate (mean) | 65.0% (band 45-80) | 38.5% (20-50) | 13.5% (6-20) |
| careful player (3 ahead) | 1.0 every level | min 0.875, mean 0.995 | min 0.75, mean 0.958 |

- Real pace runs 157-285 s; **the land's median is 215 s** (gate 200-250).
- Taps run 38-55 and the longest tap is 15.0 s.
- No fallbacks, every stored order wins with no power-up, and at most 5 spaces are in use.
- Mystery blocks (blocks, fill): 251 292, 252 291, 254 371, 260 318, 264 310, 268 183, 272 270 (chocolate), 278 321
  (chocolate), 286 235, 297 273, 300 235 (chocolate).
- The land report's per-level table is in `tools/lands/02-snack-galaxy/scratch/report.md` (scratch: re-make it with
  `land.js ... check`). The contact sheet of the 50 as installed is `tools/land-02/contact.png`; one map shot at 375 px
  (the World 2 / World 3 join) is `tools/land-02/map-375.png`.

## 5. Checks

- **land.js check:** PASS on every gate. That covers numbering, compile, wins, spaces, caps, pace and median, the careful
  floor, no fallbacks, planCheck, mystery fills, shade floors, moats (18 ringed, reach, 2 ways), side quests (none),
  re-grade 0 of 450, the map (48 px at 375) and licences.
- **test.js:** 704 passed, 0 failed (the new "zen World 3" block, and the world list with 3 worlds).
- **regrade.js:** 0 differences of 2,405 (250 levels); `--gallery` 0 of 372; `--zen` 0 of 774 (86 records).
- **critic-v5:** 0 mismatching games of 10,527, 0 grade mismatches, tags and ladder 0 problems, known answers 0 wrong,
  real pace 312/312. It doesn't read zen.json, so its counts are unchanged; diff-result.json's only change was the run
  time, so I reverted it.
- **Freeze:** `--snapshot` re-taken. Against the old snapshot, levels.json, gallery.json, castles.json and frozen.json are
  identical. In zen.json all 36 old records are byte-identical and the 50 added are all world 3; worlds 1-2 are identical
  and world 3 is appended. `--require` PASS: 2,405 / 372 / 774, castles 283, 0 differences.
- **Cache `?v=57`.** `SP.selfTest()` under `?debug=1` (tools/selftest-lands.mjs, served by serve.py on 8497): 871/0 at
  375x812@3 and 873/0 at 1280x720, 0 console messages. The new checks:
  - World 3's 50 are numbered 251-300, with no Zen number twice and no side quests.
  - Its 7 sheets and 12 drawn eggs show on the map, with its banner and the fog after picture 50.
  - The card names Snack Galaxy with no side-quest row.
  - Picture 1 plays in Zen, wins "Picture done" and opens picture 2.
- **Harness:** all passed, 0 console messages.

## 6. Payload

- **Tracked files outside tools/: 19,999,953 B** (40e3b39: 18,983,270; +1,016,683). The additions are zen.json
  (+293 KB), the frozen zen.json copy (+293 KB, never loaded), the sheets (418 KB) and main.js.
- **Portal build ≈ 15,329,117 B (15.33 MB)**, leaving out tools/build-data/frozen, the bake pools, gallery-manifest.json and the
  *.md docs (was 14.62 MB).
- The portal build stays under 18 MB, so I did not stop. **But the whole tracked folder now sits 47 bytes under 20.00 MB**,
  CrazyGames' cap if anyone ships the folder whole. The next world must ship from a portal build, or tools/build-data/frozen and
  the pools have to move out of the game folder.

## 7. Known for the critic

- World 2's last sheet holds only levels 249-250, then about one sheet of empty road and spots up to World 3's banner. That
  sheet is Kitten Forest's in layout.json, and Peter's rule keeps layout.json as it is. It was already that way when World
  2 was the top world; now the road runs on into World 3.
- World 3's top sheet holds 2 levels (49, 50) and then the fog, the same as World 2 before.
- Cake volcano (7 colours) plays as a Normal at 290. The Hards are Lemonade waterfall (262), Burger planet (272), Planet
  painting (279), Planet sleepover (286), Donut abduction (293) and Broccoli mech (300).

## 8. From the stopped World 3 run (2026-10-06), kept short

- On the branch from D1: `land.json` `"quests": "none"` (a land with no side quests) and the `zen` install step. The
  `main.js` `modes()` line it needed is in now (D7).
- The outlined-kind findings (mystery-block room, the lifted dark ground fixed in D3, the Egg choir and Dango pace, the
  readability swaps) applied to the old outlined picks. Lane C's full story scenes replaced them (painting kind, room 300+
  everywhere), so they don't apply to this install.
- Pace still follows board area. The 32x46 portraits here played 169-245 s, and the 42x42 squares 157-285 s.
- Deal failures with a moat happen on some pictures in some slots (Samosa and Kiwi then, Popcorn and Saxophone now). The
  fix is the same: swap the picture to a slot with no ring and put one that deals on the moat slot.
