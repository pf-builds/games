# Zen World 1 Picture Garden grows to 50: v6 lane D, piece D15 (2026-10-08/09)

Peter (2026-10-08, relayed by lane C): "bring picture garden up to an even 50" with "AI full garden scenes"; he OKed lane
C's 14 picks. World 1 now holds 50 pictures (records n 1-50, ids z1-1..z1-50, `world: 1`, era 101); the 36 it had are
byte-identical. Zen numbers: World 1 shows 1-50, Kitten Forest 51-100, Snack Galaxy 101-150, Dino Valley 151-200, all
through `main.js zenNum` with nothing set.

Inputs (lane C's, read only, nothing re-converted or edited): `game-research/sappers-path-v4/lands/00-picture-garden/` at
workspace 0809310: README, `picks-full.json` (14 picks + 2 spares, kind painting, no chroma), `boards-full/`. Sources from
`/Users/peter/local-ai/outputs/lands/00-picture-garden/fullsrc/`. No image model was run (land-src.py used the local-ai
venv's Pillow only).

## 1. What shipped

| File | Change |
|---|---|
| `levels/zen.json` | 14 records z1-37..z1-50 appended after z1-36; World 1's `map.sheets` + 2 sheets and its note. The 136 old records verbatim (each one's JSON a substring of the new file), worlds 2-4 identical, `version`/`note` identical. |
| `LICENSES.md` | "Zen World 1: Picture Garden, pictures 37-50", 14 rows (FLUX.1 [schnell], seed, prompt in the manifest) |
| `src/main.js` | selfTest only: World 1 has 50 (the 36 with a Gallery source, the 14 paintings without); a D15 block (below) |
| `tools/test.js` | World 1 split into the 36 and the 14; a D15 gates block; a D15 save block; the World 1 map check reads 50 spots and 7 sheets; World 1's eggs 7 sheets; places.json reads only World 1's Gallery 36 |
| `tools/zen-world.js` | `--add` (below) |
| `tools/lands/z1-gallery/` | world.json `add`; pictures/manifest.json (lane C's 16 lines); src/ (14 sources) |
| `tools/build-data/frozen/zen.json` | re-snapshot (diff below) |
| `index.html`, `style.css` | `?v=63` |
| `tools/shots-world-01-50.mjs`, `tools/world-01-50/` | the map shots, the contact sheet, notes.txt |

Not touched: `levels/levels.json`, `levels/gallery.json`, `map/layout.json`, `config.json`, `levels/places.json`. No new image
bytes (map or otherwise; the 14 boards are data).

## 2. The tool: `zen-world.js --add`

World 1 was made by `tools/zen-world.js` from pictures the game had; it only knew Gallery records. `--add` appends pictures
to an installed world so it stays one world entry (land.js's zen step would have made a second world with its own sheets).
`world.json add`: `first` 37, `raw`, `pictures` (a land-style manifest), `shade`, `profile` (merged over the world's:
`carefulFloor` 0.5 on every tag), `tags` (given: my layout), `bands` (one level's own band), `main` (ids in level order),
`sheets` (map.sheets entries), `mapNote`. Scratch in `scratch/add/`.

- `prep` / `convert`: land-src.py, then `land.js boardOf` (kind painting, shaded). `convert --against <boards-full>`:
  **14 of 14 identical**. Lane C's own `scripts/handoff-full.js` run against this head: **16 of 16 identical**.
- `plan`: the given tags, features from `land-plan landPlan` on World 1's profile (seed 1036).
- `bake`: land-bake bakeOne, seeds from 1000 x 1 + n (1037-1050, past the 36's 1001-1036); the job now takes the profile's
  careful ceiling, floor and obvious player like land.js (World 1's 36 had none, so the old path is unchanged).
- `assemble`: land-style records with Zen's id, numbering and `source: "zen"`; no `from` (the page's move and campaign
  hide key on `from` = a Gallery source; these have none), `src` the picture id, credit "Click it! Studios, 2026-10-08",
  `shade` (0 where the bake changed a cell: none here); licences.md.
- `check`: World 1's gates on the 14, plus the whole world (the installed 36 then these: tags, density, features per level
  rising with the tag, the longest Hard run, the end on a Hard), the careful floor, the shade floors, no moat, and the new
  sheets (in turn, a spot a level, eggs on the spurs, 48 CSS px at 375).
- `install`: World 1's records before 37 kept as they are, the 14 appended, sheets before 37 kept and the 2 appended.

## 3. Layout

Tags (sawtooth after 36's Hard): **37 E, 38 N, 39 N, 40 E, 41 N, 42 N, 43 H, 44 E, 45 N, 46 N, 47 E, 48 N, 49 N, 50 H**.
The world of 50: E17 N27 H6 X0 (34/54/12%, the profile's 36/52/12), longest Hard run 1, ends on a Hard. Easy slots only on
4-5 colour boards; the 7-colour boards on Normal and Hard.

Order: a small search (session scratchpad, not kept) over subject tags (insect, bird, hedgehog, apple, pumpkin, autumn,
earth, water, sunflower...) with a heavy penalty for a shared subject within 5 levels, counting 31-36 (Rocket, Pig,
Jack-o'-Lantern, Alien, Sunflower, Apples and Primroses). Result, with what it avoided:

| n | Tag | Picture | Colours | Note |
|---|---|---|---|---|
| 37 | E | Ant picnic (pg08) | 5 | big watermelon on a picnic cloth |
| 38 | N | Duckling bath (pg13) | 7 | water 7 away from 45's pond |
| 39 | N | Acorn stash (pg07) | 6 | autumn 9 away from 48 |
| 40 | E | Carrot pull (pg02) | 5 | brown earth 6 away from 46 |
| 41 | N | Strawberry hedgehog (pg01) | 6 | hedgehog 8 from 49's little one |
| 42 | N | Pumpkin house (pg12) | 7 | 9 from 33 Jack-o'-Lantern |
| 43 | H | Hummingbird (pg09) | 7 | big red flower, reads at once |
| 44 | E | Ladybug umbrella (pg04) | 4 | insect 7 from 37, 6 from 50 |
| 45 | N | Frog's cupcake (pg05) | 7 | pond |
| 46 | N | Flowerbed dig (pg11) | 7 | puppy |
| 47 | E | Butterfly chase (pg10) | 5 | cat on white |
| 48 | N | Wheelbarrow nap (pg15) | 6 | fox, autumn |
| 49 | N | Apple tree owl (pg14) | 5 | 13 from 36's apples |
| 50 | H | Sunflower bees (pg03) | 7 | the finale; 15 from 35 Sunflower |

Soft overlaps left: 38 duck and 43 hummingbird (both birds, 5 apart, nothing alike); 49 sunset and 50 sky.

**The finale.** Sunflower bees, a bright sunny scene that reads at once. Its first bake was the hardest new level (random
tap 9.0%, careful 0.75, obvious 0). To make it gentle, `add.bands` gives level 50 the top half of the Hard band (13-20%)
and it was baked again (`--list 50 --extra 6`): **17.3% random tap, careful 1.0, obvious 1.0, 48 taps, 204 s**, linked
pair and 3 ? cards. Its record's `target` says [0.13, 0.2].

## 4. Bake

One bake of 14 on 14 threads (328 s), then 50 again (173 s). No fallback, no spare used, no swap.

| n | Tag | Features | Random tap (band) | Careful | Real pace | Longest tap | Taps |
|---|---|---|---|---|---|---|---|
| 37 | easy | linked | 73.3% (45-80) | 1 | 166 s | 14.8 s | 41 |
| 38 | normal | linked | 36.3% (20-50) | 1 | 196 s | 14.8 s | 52 |
| 39 | normal | 2 ? | 34.8% | 1 | 178 s | 14.9 s | 54 |
| 40 | easy | - | 64.8% | 1 | 201 s | 15.0 s | 55 |
| 41 | normal | linked | 38.5% | 1 | 218 s | 14.6 s | 49 |
| 42 | normal | 2 ? | 38.0% | 1 | 221 s | 14.3 s | 55 |
| 43 | hard | 3 ? | 14.0% (6-20) | 1 | 212 s | 14.9 s | 52 |
| 44 | easy | 2 ? | 62.5% | 1 | 176 s | 14.9 s | 47 |
| 45 | normal | - | 33.0% | 1 | 258 s | 14.8 s | 53 |
| 46 | normal | 2 ? | 41.0% | 1 | 194 s | 14.8 s | 54 |
| 47 | easy | - | 68.3% | 1 | 198 s | 14.8 s | 47 |
| 48 | normal | 2 ? | 42.8% | 1 | 207 s | 14.9 s | 54 |
| 49 | normal | linked | 49.8% | 1 | 249 s | 14.9 s | 55 |
| 50 | hard | linked, 3 ? | 17.3% (13-20) | 1 | 204 s | 14.8 s | 48 |

Median real pace of the 14: 201 s; of all 50: 198 s (World 1's gate 180-250 s, zen-mode-notes §8 call 1). No
mystery blocks, no moats (World 1 has none), no locks, no Extreme. Per-level report: `tools/lands/z1-gallery/scratch/add/report.md`
(scratch).

## 5. Map

World 1's turn continues: B' A' B A' B, **then A' B** (from 26 mirrored, from 27), World 2 starting on A, so no file and
mirror twice running. Same tint, crossfaded seams, spots 0-4, 6, 7 (7 levels a sheet: 37-43, 44-50), so 50 sits where 36
did at the top of a B sheet and World 2's banner follows at once: no empty road, no orphan fork. Eggs on each new sheet's two
painted spur tips (`eggsAt: "quests"`): sheet 6 mushrooms, grass; sheet 7 owl, yarn (ids z1-6-0/1, z1-7-0/1; coins from the
reused sheets' rows). The whole World 1 egg list: butterfly mushrooms / owl glint / yarn grass / glowcap wisp / kitten
butterfly / mushrooms grass / owl yarn. Zero new image bytes.

At 375 px (tools/world-01-50/notes.txt, all 200 Zen nodes drawn): closest two consecutive nodes anywhere 68 px (107-108),
among 37-50 69.8 px (42-43); the check's spot/egg spacing 48 px holds on both new sheets; widest number "200" 24.8 px in the
28 px disc (3.3 spare). Seam: 50 to World 2's banner 122 px, banner to 51 33 px.

Shots (375x812@3, plain URL, World 1's 36 cleared): `map-37-375.png` (35, 36 done, 37 current "Picture 37 Easy", "Play
picture 37"), `map-top-375.png` (44-50, the World 2 banner, 51-53), `seam-375.png`. Contact sheet `contact.png`: 35-50 with
their Zen numbers, tags, features, board sizes.

## 6. Saves

- Openness is per world, one by one: with z1-1..36 done, z1-37 opens (the record after the last done), 38 stays shut;
  `nextOf()` (continue in the last played world) gives z1-37; the home Zen card reads "World 1 · Picture Garden",
  "Picture 37". selfTest D15 block and the shots check all of this in the page.
- SP2 codes encode a Zen clear as (world, place in world); a code made before the growth (36 clears) decodes to the same 36
  and its last; a code with z1-50 cleared and a best round-trips (test.js D15 save block). SP1 codes carry no Zen.
- The one-time move keys on `from` (the Gallery source); the 14 have none, so the move never touches them. Eggs on the old
  sheets keep their ids (z1-1..5-*).
- Power-up reach counts Zen pictures done: more pictures means more reach, never less.

## 7. Checks

- `zen-world.js check --add`: PASS every gate (numbering, compile, wins, 5 spaces, caps, steady replay, pace and median,
  no fallback, whole world, careful floor min 0.75 then 1.0 after the finale re-bake, shade floors, no moat, sheets, casual,
  no mystery blocks, re-grade 0 of 126).
- test.js **709 passed, 0 failed** (707 + the D15 gates and save blocks); shipped-folder guard 69 files, **16,529,295 B**.
- regrade: 0 of 2,405 (250 levels); `--gallery` 0 of 372; `--zen` 0 of 1,350 (150 records).
- critic-v5: 0 mismatching games of 10,527, grade mismatches 0, tags and ladder 0 problems, known answers 0 wrong, real pace
  312/312 (diff-result.json's only change was its run time, reverted).
- Freeze: `--snapshot` re-taken. Against the old snapshot: castles.json, frozen.json, gallery.json, levels.json identical;
  zen.json's 136 records verbatim, 14 added (z1-37..z1-50), worlds 2-4 identical, World 1 only its `map` (note and sheets
  6-7; sheets 1-5 identical). `--require` PASS (levels, gallery, zen 150 / 1,350 checks, castles 283, 0 differences).
- `SP.selfTest()` (tools/selftest-lands.mjs on serve.py 8531): **876/0 at 375x812@3, 878/0 at 1280x720**, 0 console.
- Harness: all passed, 0 console.

## 8. Payload

Portal build (the folder without tools/): **16,529,295 B (16.53 MB)**, was 16,451,916 B (+77 KB: the 14 records).

## 9. Calls I made

1. Extended zen-world.js (`--add`) rather than the land.js zen step, so World 1 stays one world entry.
2. The 14 carry no `from`: `from` means "a Gallery source" to the page's move and campaign filter.
3. The careful floor 0.5 applies to the 14 only; the 36 were baked before D5's rule and stay as they are.
4. Finale gentle by band: level 50's own band 13-20% (`add.bands`), re-baked once.
5. Egg kinds for the new sheets changed once after the first shots (grass/butterfly on sheet 7 repeated sheet 5's butterfly
   on the same spur): now mushrooms, grass and owl, yarn.

# D16: Picture Garden fix pass (2026-10-09)

The critic of D15 (`tools/critic-world-01-50.md`, evidence in `tools/critic-world-01-50/`, both committed here) passed it
functionally with 5 picture-level should-fix items. Lane C's fixes, read only: workspace da107ad (README "Critic fixes",
picks-full.json `fix10_9`) and c3c06f9 (README "Second fixes", `fix10_9b`). This pass started from a previous builder's
uncommitted tree (manifest, pg12 source, world.json, 39/42/47 baked) and finished it.

## 1. What changed

| n | Was | Now | Why |
|---|---|---|---|
| 37 | Ant picnic (pg08) | Watermelon picnic (pg08), same board | the ants are lost in conversion; the board reads as a watermelon on a cloth |
| 39 | Acorn stash (pg07) | Mud puddle pig (pg25) | autumn confetti at 375; the squirrel melts into the leaves |
| 42 | Pumpkin house (pg12) | the same, re-converted from lane C's regenerated source | 29 broken near-black pieces; now 0 (no colour under CIELAB L* 25) |
| 43 | Hummingbird (pg09) | Daisy crown lamb (pg29) | a red blob at 375 |
| 47 | Butterfly chase (pg10) | Butterfly chase (pg17) | pg10's red butterfly was a 5-cell red "+", the Red Cross shape; pg17 has a blue and purple butterfly, and its ladybug (a dark-pink "+") repainted as a leaf |

Also: World 1's sheet 7 eggs owl, yarn -> owl, glint (critic minor 11: two yarn eggs on one phone screen at the seam), and
the one deliberate World 2 change, Kitten Forest's lore "Past the Gallery the road runs on ..." -> "Past the Garden the
road runs on ..." (LATER item, now struck). LICENSES.md rows for 37, 39, 43 and 47 match the records.

Files: `levels/zen.json`, `LICENSES.md`, `index.html` + `style.css` (`?v=64`), `LATER.md`; tools: `lands/z1-gallery/`
(world.json `main` and `fix`, pictures/manifest.json = lane C's c3c06f9 landManifest with pg08 titled Watermelon picnic,
src/ pg12 re-prepped, pg17 re-prepped from `raw/pg17-s9017-noladybug.png`, pg25 and pg29 new; pg06, pg16, pg18 kept as
spare sources), `build-data/frozen/zen.json`, `world-01-50-swaps.py`, `shots-world-01-50-fix.mjs`, `world-01-50/`.

## 2. Boards and bakes

- `prep convert --add --against <c3c06f9 boards-full>`: **14 of 14 identical**. (prep keeps a source that exists, so
  src/pg17.png was removed first to re-prep it from the no-ladybug raw.) pg17's biggest colour 74.9% of its 1,600 cells
  (under the 75% gate); 6 colours.
- Bakes on the kept plan (`scratch/add/state.json`, seeds 1000 + n), `--list`, logs in `scratch/add/`:

| n | Tag | Features | Random tap (band) | Careful | Real pace | Longest tap | Taps | Log |
|---|---|---|---|---|---|---|---|---|
| 39 | normal | 2 ? | 40.5% (20-50) | 0.938 | 208 s | 14.9 s | 54 | bake-d16.log |
| 42 | normal | 2 ? | 36.8% (20-50) | 1 | 206 s | 14.8 s | 52 | bake-d16.log |
| 43 | hard | 3 ? | 15.3% (6-20) | 1 | 207 s | 14.9 s | 51 | bake-d16c-43.log (`--extra 12`, 543 s) |
| 47 | easy | - | 73.5% (45-80) | 1 | 222 s | 14.8 s | 54 | bake-d16c-47.log |

- `assemble check --add`: **PASS, all 18 gates** (no fallback, careful floor min 0.938, whole world of 50 E17 N27 H6,
  median real pace of all 50 198 s, re-grade 0 of 126).
- Cross and ink scan of the 14 installed records (one-colour plus shapes; pieces of colours under L* 25): 0 crosses on all
  14; ink pieces 0 except 46 (6), 49 (14), 50 (7), which are a subject's own small dark features (the puppy's eyes and nose,
  the owl's eyes, the bees' stripes), the critic's ruling on 50, applied the same way to 46 and 49.

## 3. The 43 slot

pg18 Lettuce tortoise (lane C's first spare) baked fine as a Hard (18.3%, careful 1, `--extra 12`; `bake-d16b.log`) and
passed the check, but failed the eye check at 375: 4 colours, and the shell and the soil are the same red-brown (557
cells), so the shell's lower half melts into the dirt and the eye is lost. Not installed. Lane C then offered pg28 Rooster's
wake-up, pg30 Cherry parrot and pg29 Daisy crown lamb. Flat at phone size (scratch only): **pg29 reads at once** (a white
lamb with a green crown on a daisy field under a pink sky); pg28 reads (a red rooster on a blue wheelbarrow) but repeats 48
Wheelbarrow nap 5 levels later; pg30 is the weakest (a blue bird hanging among red cherries, the bird's shape unclear). By
the brief's order (readability, then variety) pg29 first; it baked in band first time. Soft overlap left: 39 pig and 43
lamb are both farm animals 4 apart (a pink pig in mud vs a white lamb on grass, nothing alike on the board).

## 4. Eye check (375x812@3, in-level, `tools/shots-world-01-50-fix.mjs`)

`tools/world-01-50/play-{39,42,43,47}-375.png`, 0 console messages. 39: a pink pig lying in a brown puddle, reads. 42: the
pumpkin house with its door and window, the dark bush noise gone. 43: the lamb, reads at once. 47: the butterfly and the
grey cat, the leaf where the ladybug was, no cross. `swaps.png`: old | new for 39, 42, 43, 47 at about phone size (two-line
labels); `contact.png` re-made (35-50 as installed, `tools/land-contact.py --world 1 --zen-from 35` on a 35-50 subset).

## 5. Checks

- test.js **709 passed, 0 failed**; shipped folder 69 files, **16,530,513 B**.
- regrade 0 of 2,405 (250 levels); `--gallery` 0 of 372; `--zen` 0 of 1,350 (150 records).
- critic-v5: 0 mismatching games of 10,527, grade mismatches 0, tags 0 problems, known answers 0 wrong, real pace 312/312
  (diff-result.json's run time reverted).
- Freeze vs 476d985's snapshot (byte-identical to D15's zen.json): top keys `version`/`note` identical; 150 ids in the same
  order; changed records only **z1-37 (title)**, **z1-39, z1-42, z1-43, z1-47** (board, grade, win, seed; credit date and
  src on the swapped ones); worlds: **World 1 only `map.sheets[6].eggKinds`**, **World 2 only `lore`** (the one word);
  worlds 3-4 identical. `--snapshot` re-taken; `--require` **PASS** (gallery 372, zen 1,350, castles 283, 0 differences).
- `SP.selfTest()` (tools/selftest-lands.mjs, serve.py): **876/0 at 375x812@3, 878/0 at 1280x720**, 0 console. Harness:
  all passed, 0 console. Cache `?v=64`.

## 6. Payload

Portal build (the folder without tools/): **16,530,513 B**, was 16,529,295 B (+1,218 B: records and licence rows).
