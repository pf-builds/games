# Zen World 3 Snack Galaxy installed: v6 lane D, piece D7 (2026-10-08)

Land 2 (the land factory's levels 251-300) plays as Zen World 3, ids z3-1..z3-50. Peter OKed lane C's picks on 2026-10-08.
Inputs (lane C's, read only): `game-research/sappers-path-v4/lands/02-snack-galaxy/` at workspace cffda1d, README section
"Full story scenes", `picks-full.json` (50 picks and 17 spares, kind painting, no chroma), `boards-full/`, and the map
folder (`land-02-a.webp`, `land-02-b.webp`, `templates.json`). The sources come from
`/Users/peter/local-ai/outputs/lands/02-snack-galaxy/fullsrc/`. No image model was run.

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
| `levels/frozen/zen.json` | re-snapshot: 36 → 86 records, the 36 byte-identical |
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
- **Portal build ≈ 15,329,117 B (15.33 MB)**, leaving out levels/frozen, the bake pools, gallery-manifest.json and the
  *.md docs (was 14.62 MB).
- The portal build stays under 18 MB, so I did not stop. **But the whole tracked folder now sits 47 bytes under 20.00 MB**,
  CrazyGames' cap if anyone ships the folder whole. The next world must ship from a portal build, or levels/frozen and
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
