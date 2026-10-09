# Zen World 4 Dino Valley installed: v6 lane D, piece D12 (2026-10-08)

Lane C's Dino Valley v2 (full story scenes) plays as Zen World 4: records n 301-350, ids z4-1..z4-50, `world: 4`, era 11,
shown on the page as Zen pictures 137-186 (main.js `zenNum`, nothing set). Peter OKed the picks on 2026-10-08 (relayed by
lane C). Same job as World 3 Snack Galaxy (`tools/land-02-notes.md`, D7 then the D8 fix pass), done the same way.

Inputs (lane C's, read only, nothing re-converted or edited): `game-research/sappers-path-v4/lands/05-dino-valley/` at
workspace 7fea315: README "v2 full story scenes" and "Hero outlines", `design-brief.md`, `picks-full.json` (50 picks, 36
spares, 8 held out for trade dress), `boards-full/`, `boards-outlined/`, the map folder (`land-05-a.webp`, `land-05-b.webp`,
`templates.json`). Sources from `/Users/peter/local-ai/outputs/lands/05-dino-valley/` (`fullsrc/`, and `outlined/fullsrc/`
for the six hero-outline picks dv201 dv205 dv216 dv293 dv314 dv308). No image model was run.

## 1. What shipped

| File | Change |
|---|---|
| `levels/zen.json` | World 4's entry (k 4, era 11, name, lore, `map.layout` of 7 sheets with their egg coins) and its 50 records (n 301-350, world 4, no land). Worlds 1-3 and their 86 records byte-identical. |
| `map/land-05-a.webp`, `map/land-05-b.webp` | the 2 sheets (234 KB + 244 KB) |
| `LICENSES.md` | "Zen World 4: Dino Valley (Land 3, levels 301-350 in the land factory's numbering)", 50 rows |
| `src/main.js` | selfTest only: a World 4 block (records, map, card, play; first node reads 137), and World 3's block no longer assumes World 3 is the top world (its 14 eggs show and the fog sits past it once World 4 follows) |
| `tools/test.js` | the world list has 4 worlds; a World 4 block (records, gates, profile, re-grade, sheets, eggs, licences); the Zen-profile list includes 05-dino-valley |
| `tools/land-contact.py` | `--zen-from N` labels each tile with its Zen number; the world header now draws in the header font (it drew in the default) |
| `tools/shots-land-05.mjs`, `tools/land-05/` | the map shots (below), the contact sheet, notes.txt |
| `tools/lands/05-dino-valley/` | land.json, pictures/manifest.json (86 lines), src/ (50), map/ |
| `tools/build-data/frozen/zen.json`, `frozen.json` | re-snapshot: 86 → 136 records, the 86 byte-identical; frozen.json's only change is its `made` date |
| `index.html`, `style.css` | `?v=61` |

Not touched: `levels/levels.json`, `levels/gallery.json`, `map/layout.json`, `config.json`, `levels/places.json` (no new
gallery pictures).

## 2. Numbering (land k, era, from)

- **Land 3, era 11.** The runbook's `k` is the land's number in the factory's numbering (Land 1 = 201-250, Land 2 =
  251-300), so Dino Valley is Land 3 = 301-350, era = castleRealms 8 + 3 = 11, ids `e11-<n>` inside the land run (the zen
  step renames them z4-*). The folder keeps lane C's slug `05-dino-valley` (the old factory plan called it Land 5); land.json
  `sourceNote` and the licence heading say so. Zen World 4 (`zen.k` 4).
- **from 301.** land.js takes the next level after levels.json's last (250, Kitten Forest), which would collide with Snack
  Galaxy's 251-300 in zen.json. `scratch/state.json` was seeded `{from: 301, sheet0: 40, gal0: 62}` before the first run
  (sheet0 = Snack Galaxy's 33 + 7; neither sheet0 nor gal0 reaches zen.json). The check's numbering gate and test.js both
  confirm 301-350 and that no other world (1-36, 201-250, 251-300) uses one of them. LATER.md: land.js should take `from` past
  zen.json's records for a Zen land.

## 3. Boards

`prep` with the local-ai venv's Pillow, then `convert` (painting kind, shade on). **The 50 boards are identical to lane C's
`boards-full/`** (grid, palette, shade), and the six hero-outline picks to `boards-outlined/` too. Lane C's own hand-off
(`scripts/handoff-full.js`, run against this head) gives **86 of 86 identical**. 41 boards are 42x42, nine 32x46 portraits.
Colours: 4: 4, 5: 11, 6: 20, **7: 15** (the README says 5: 14 and 7: 12; picks-full.json's own counts agree with the boards,
so the README line is stale; LATER.md). 12 can't carry a ring (the bake's own read matches lane C's list).

## 4. Layout

**Profile:** Snack Galaxy's as it ships (casual E18/N26/H6/X0 ending on a Hard; ? cards on 2-3 slots, linked squads on 1-2;
no locks, archers or Extreme; hidden share 0; gentle moats easy 0.2 / normal 0.4 / hard 0.67 with `ways` [0, 1], so always
2 ways in; careful floor 0.5 on every tag). The tags and the plan come from land-plan (seed 301): Hards at 312, 322, 329,
336, 343, 350; 18 moat slots 304 305 307 309 312 314 315 320 322 325 328 329 330 331 334 335 340 350.

**Order:** an annealing solver (session scratchpad, not kept), every picture tagged by group, species, hero colour, setting
colour and motifs (water/wave, night/moon, volcano, kitten, cake, sunglasses, beach/palms, portrait parody, road, canyon...):
- Hard rules: on a moat slot only a picture that **deals** with a ring (below); 301 Hatching day (a triceratops by its eggs
  under a smoking volcano: the valley's opener) and 350 Hot-air balloon pinned.
- 7-colour pictures spread: target Easy 3 / Normal 9 / Hard 3 (got exactly that). Hards 6+ colours. Easy mostly 4-5.
- Penalties: same group within 1-3, shared motif within 5, same setting colour within 2, same species and hero colour within
  4, two portraits side by side. Final cost 1.5. Result: famous parodies at 302 306 315 319 336 342 348; kittens 304 and 324;
  cakes 310 and 338; volcanoes 301 317 333; the waves (325 Surfing, 336 The Great Wave) 11 apart.

**Why the finale moved (first bake).** The first layout (finale 350 The Great Wave) baked 40 of 50; all 10 failures were
moat slots with "no deal in 96 attempts" on every candidate. A deal probe (the bake's own moat builder and `gen.deal`, 6
candidates each, both opening sets, Easy, Normal and Hard rules; scratchpad) found 20 of the 38 ring-capable pictures deal
with a ring and 18 never do (busy 6-7 colour scenes where the ring and bank leave no deal under the 15 s and 55-tap caps).
The 350 slot is a Hard with a moat, and The Great Wave is one that never deals with one. So the second layout puts only the
20 dealers on the 18 moat slots, **350 = Hot-air balloon** (dv266: a blue dino in a big rainbow-striped balloon over green
hills, ringed by the moat, 7 colours, reads at once at 375) and The Great Wave on the no-moat Hard 336.

**Eggs:** the land has no side quests, so each sheet's 2 eggs sit on its template's 2 painted quest-spur tips (sandy jungle
clearings), via `eggTurns`, each repeat of a sheet its own pair. Kinds from the drawn set that suit the valley: grass, glint
(an amber-like gem in a rock), woodpile (a campfire), mushrooms, and bubble (a lava crust bubble) only on sheet A's upper
clearing, beside the painted volcano. Not the space kinds (wisp, ember). The map README's hatchling, raptor, amber and
pterosaur aren't drawn (LATER.md). The top sheet's 2 eggs sit past the fog while World 4 is the top world.

**Banner and lore:** "World 4 · Dino Valley"; "The road comes back down to earth in a warm green valley of ferns, rivers and
smoking volcanoes, where dinosaurs fish, play music and get up to all sorts of things." (test.js's word check passes.)

## 5. Bake

1. Bake 1 (first layout, `--shard 2`, 206 shards): 40 ok, 10 moat slots no deal (above). Results kept in the scratchpad only.
2. Bake 2 (second layout, all 50 fresh): 48 ok; 319 Starry Night fallback (fast tapper), 328 Sunset watch fallback (real
   pace 148 s, a 4-colour board with a ring).
3. `bake --list 319,328 --extra 12 --shard 2 --reuse`: 319 ok (236 s); 328 still 148 s.
4. Swap 328 ↔ 337 (both dealers, both ring-capable, so the plan is unchanged): Skateboard trick onto the moat slot 328 (181 s),
   Sunset watch onto plain Easy 337 (151 s). Both ok first time.
5. **No spare used.** Re-bakes: 319, 328, 337 (plus the whole layout once).

Final, as graded (all 50):

| | Easy (18) | Normal (26) | Hard (6) |
|---|---|---|---|
| random-tap win rate (mean) | 66.2% (band 45-80) | 37.6% (20-50) | 11.5% (6-20) |
| careful player (3 ahead), min / mean | 0.75 / 0.986 | 0.813 / 0.990 | 1.0 every Hard |
| 7-colour pictures | 3 (303 313 346) | 9 | 3 (329 343 350) |

- Real pace 151-284 s, **median 224 s** (gate 200-250). Taps 39-55; the 15 seven-colour boards take 49-55 (seven at 55, the
  cap). Longest tap 15.0 s.
- 18 ringed, always 2 ways in; 307, 312, 340 and 350 use mire (a picture colour too close to water). 0 mystery blocks.
- Hards: 312 Wizard dino, 322 Dino president, 329 Tuba blast, 336 The Great Wave, 343 Bike ride, 350 Hot-air balloon.

## 6. Checks

- **land.js check:** PASS on every gate (numbering 301-350 e11, compile, wins, spaces, caps, pace and median 224 s, careful
  floor, no fallbacks, planCheck, Zen no mystery blocks, shade floors, moats 18 ringed with reach and 2 ways, side quests
  none, re-grade 0 of 450, map 48 px at 375, licences).
- **test.js:** 707 passed, 0 failed (the new "zen World 4" block; the world list with 4 worlds; every Zen profile hidden-free
  incl. 05-dino-valley). Shipped-folder guard: 69 files, 16,449,204 B (under 19 MB).
- **regrade.js:** 0 differences of 2,405 (250 levels); `--gallery` 0 of 372; `--zen` 0 of 1,224 (136 records).
- **critic-v5:** 0 mismatching games of 10,527, 0 grade mismatches, tags and ladder 0 problems, known answers 0 wrong, real
  pace 312/312. It doesn't read zen.json; diff-result.json's only change was the run time, reverted.
- **Freeze:** `--snapshot` re-taken. Against the old snapshot: levels.json, gallery.json, castles.json identical; frozen.json
  only its `made` date; zen.json's 86 old records byte-identical, worlds 1-3 identical, 50 added, all world 4, world 4
  appended. `--require` PASS: zen.json 136 levels, 1,224 checks, 0 differences; castles 283, 0 differences.
- **Cache `?v=61`.** `SP.selfTest()` under `?debug=1` (tools/selftest-lands.mjs on serve.py 8512): **875/0 at 375x812@3,
  877/0 at 1280x720**, 0 console messages. World 4: 50 numbered 301-350, no record number twice, no side quests; 7 sheets,
  12 drawn eggs, banner, fog after its last level; first node reads 137, open, the next locked; card names Dino Valley; its
  first picture plays in Zen and wins "Picture done". D10's zen-numbers check now runs 1-186 with worlds starting 1, 37, 87,
  137.
- **Harness:** all passed on 8512, 0 console messages.
- **Shots** (`tools/shots-land-05.mjs`, 375x812@3, plain URL after Worlds 1-3 cleared): `tools/land-05/map-375.png` the
  World 3 → 4 seam (135 136 done, 137 current with "Picture 137" and "Play picture 137", World 4's banner); `map-top-375.png`
  (185, 186, "More worlds on the way"); `level-win-375.png` (z4-2 plays as "138 The Scream", wins). Fit at 375 with all 186
  nodes: tightest number 122 (22.5 px in 28), current 137 is 27.5 px in the 36 px disc, closest nodes 68 px.
- **Contact sheet** `tools/land-05/contact.png` (level / Zen number, picture, title, tag, features, board size, moat).

## 7. Payload

- **Portal build (the folder without tools/): 16,449,204 B (16.45 MB)**, was 15.68 MB (+766 KB: zen.json's 50 records and
  the 2 sheets). Under 18 MB, so no stop.

## 8. Known for the critic

- World 3's top sheet holds 2 levels (135, 136), then about a sheet of empty space road up to World 4's banner, the same as
  World 2's top sheet before World 3 (D7 §7). The seam crossfades space into jungle.
- 18 of the 38 ring-capable pictures never deal with a ring at these caps, so the moat slots hold the 20 that do; every
  busy 7-colour scene except Tuba blast, Cool shades, Convertible and Hot-air balloon plays without one.
- Mud bath (347) and Kitten nap (324) are two of the hero-outline picks; at 42 cells the outline is what keeps their hero
  readable.
