# Zen World 5 Masterpiece Gallery installed: v7 lane D (2026-10-10)

Brief: the orchestrator's lane D brief of 2026-10-10 (install lane C's real famous CC0 paintings, La Grande Jatte at level 1,
as Zen World 5; local only, never pushed). Plan: `game-research/sappers-path-v4/v7-worlds-plan.md`. Inputs (lane C's, read
only): `game-research/sappers-path-v4/lands/06-masterpiece-gallery/` (README, `picks-full.json`: landMain 50, trial 3, spares
12, held 3, landManifest 62 lines; `boards-full/`), sources `/Users/peter/local-ai/outputs/lands/06-masterpiece-gallery/fullsrc/`.
No image model was run. Commits on `sappers-path`: `5ea7a14` (land folder, land.js), `157b581` (install), `daa7949` (freeze),
then these notes.

Records n 351-400 (Land 4 in the factory's numbering, era 12, ids z5-1..z5-50, world 5), shown on the page as Zen pictures
201-250 (main.js zenNum: Worlds 1-4 hold 1-200).




## 000. Round 4 (2026-10-10, Peter via lane C, workspace 8cdbb58): tighter crops for three

Lane C's handoff here: **62 of 62**. Only three landManifest lines changed (`srcCrop`, and mg012's chroma); those three replaced
whole in `pictures/manifest.json`, their sources re-made; `convert --force`: 50 of 50 identical to boards-full, exactly
359, 367 and 381 changed. Re-baked on the kept plan (`bake --keep-plan --drop-moat --list 359,367,381`; no ring planned on
any of the three, so none dropped):

| Level / Zen | Picture | Board | Tag, features | Rate | Pace | Taps | Longest tap | Careful |
|---|---|---|---|---|---|---|---|---|
| 359 / 209 | mg001 Woman with a Parasol (chroma 2.4) | 33x46, 7 colours | Easy, links | 72.0% | 218 s | 42 | 14.96 s | 1.0 |
| 367 / 217 | mg012 The Boating Party (chroma 2.4) | 42x42, 7 colours | Normal, ? cards | 36.0% | 231 s | 54 | 14.95 s | 1.0 |
| 381 / 231 | mg048 The Letter (boardOf's chroma) | 42x43, 5 colours | Normal, links | 32.8% | 237 s | 47 | 14.96 s | 1.0 |

381's first pick was a fallback (real pace 315 s, over 300); 16 more candidates (`--extra 16 --reuse`) gave the ok pick.

**The other 47 records byte-identical** to round 3 (land out/ and zen.json both; worlds unchanged; LICENSES.md unchanged: the
rows carry no crop). World median real pace 220 s; rings 5. Freeze re-taken: only 359, 367, 381 changed in the frozen zen.json,
the other 197 records and all 5 worlds byte-identical; `--require` PASS (2,405 / 372 / 1,800, shipped 512, castles 283).

**Readability at 375 (my call, `tools/shots-land-06/play-359-parasol-375.png`, `play-367-boating-375.png`,
`play-381-letter-375.png`):** 359 reads: the green parasol over a standing figure against sky, though the white dress still
half melts into the clouds. 367 is weak: a pink child against a teal mother on navy water, but no boat and no oarsman, so it
needs the title. 381 reads: a dark-haired woman in blue against patterned wallpaper with a pale letter, though the face is
a plain pale shape.

**Gates:** test.js 714/0 (shipped 13,916,708 B); pack --check clean; selfTest 880/0 (375x812@3), 882/0 (1280x720), 880/0
(360x640); check.mjs 39 ok, 0 FAIL; sweep-map 126/0; regrades and harness in v5-progress D21; 0 console. Cache `?v=70`.
Contact sheet re-rendered.

## 00. Round 3 (2026-10-10, Peter via lane C, workspace bf9a4c5): La Grande Jatte as a two-level series

Folded in before round 2 was committed, so the commit carries both. Lane C's round 3 `picks-full.json`: 351 = **mg003c** (the
left bank, 36x46, 5 colours, boardOf's own chroma, "La Grande Jatte (1 of 2)"), 352 = **mg003** (the parasol couple, 32x46,
chroma 1.2, "La Grande Jatte (2 of 2)"), round 2's 352-370 each one place down (353-371), mg008 Water Lilies out to the spares,
372-400 unchanged. Their `handoff-full.js` here: **62 of 62**; `convert --force`: **50 of 50 identical to boards-full**, 29 of
29 boards at 372-400 the same as round 2.

- **Re-baked 351-371** on the kept plan (`bake --keep-plan --drop-moat --list 351..371`): every slot keeps its tag and deck
  features; 21 ok, 354 (the straw-hat self-portrait on a new slot) out of band first and ok with 16 more candidates
  (`--extra 16 --reuse`). Two more planned rings dropped for pictures that can't carry one (361 mg061, 365 mg013): **5 rings**
  (362 372 374 386 390).
- **The series:** 351 La Grande Jatte (1 of 2) Normal 40.0%, 201 s, 49 taps, longest tap 14.95 s, careful 1.0, ? cards; 352
  (2 of 2) Normal 40.5%, 165 s, 40 taps, 14.99 s, careful 1.0, ? cards. Both on sheet A's first two spots, consecutive nodes
  201 and 202 on the same sheet. Win lines "La Grande Jatte (1 of 2) by Georges Seurat, all dug out." and "(2 of 2) ...".
- **372-400: 29 of 29 records byte-identical to round 2.** Against round 1, 7 records are untouched (372 376 383 386 390 395
  400); every other World 5 record moved, was re-baked or took a new short title.
- **Whole world:** E18/N26/H6; Easy mean 67.8%, Normal 39.0%, Hard 14.5%; careful min 1.0 / 0.94 / 0.75; median real pace **218
  s**, 158-285 s, 38-55 taps; ? cards 23, links 18, rings 5, 0 mystery blocks, 0 locks. land.js check PASS every gate.
- **LICENSES.md:** World 5's table re-written (351 mg003c and 352 mg003 both rows of the AIC painting; Water Lilies gone).
- **Freeze** re-taken: the other 150 Zen records and Worlds 1-4 byte-identical; `--require` PASS (2,405 / 372 / 1,800 checks,
  shipped 512, castles 283, all 0).
- **Gates:** test.js 714/0 (World 5 block now checks the series: mg003c then mg003, neither Hard, both on the first sheet's
  first two spots); pack --check clean; selfTest 880/0 (375x812@3), 882/0 (1280x720), 880/0 (360x640); check.mjs bytes 2,
  lazy 15, saves 4, sweep 18, 0 FAIL; sweep-map 126/0; regrades and harness in v5-progress D20. Shipped folder 13,916,559 B;
  first-tap bytes 1,869,718. Cache `?v=69`.
- **Shots:** `contact-installed.jpg` (re-rendered), `play-grande-jatte-375.png` (201, the left bank), `play-grande-jatte-2-375.png`
  (202, the couple), plus the map and win shots, all from `tools/shots-land-06.mjs`.

## 0. Round 2 fix pass (2026-10-10; critic `tools/critic-land-06.md`, lane C round 2 at workspace 79cade2)

Sections 1-10 below are round 1's record; where round 2 changed a number, this section has the new one.

- **Inputs.** Lane C's round 2 `picks-full.json` (landMain and the 62 landManifest lines, whole, chroma kept). Their
  `handoff-full.js` run here: **62 of 62 identical**. `prep` + `convert --force`: **50 of 50 identical to boards-full**; against
  round 1's boards exactly the 19 named slots changed and the other 31 are identical. Dates kept from round 1 where lane C's
  line had none (mg128).
- (Round 3 above re-ordered 351-371; the numbers in this section are round 2's.)
- **Re-baked 19 on the kept plan** (`bake --keep-plan --drop-moat --list ...`: each slot keeps its tag and deck features):
  351 mg003 (the parasol couple, 32x46), re-crops 358 359 362 366 371 379 380 382 385 394 397, swaps 367 mg060->mg024 The Eagle,
  374 mg028->mg076 Madame Cezanne, 381 mg072->mg048 The Letter, 388 mg065->mg018 The Child's Bath, 391 mg094->mg049 The
  Acrobats, 392 mg127->mg025 The Asakusa Cat, 393 mg057->mg093 Kohada Koheiji. 18 ok first time; 388 was a fallback (careful
  0.125) and passed with 16 more candidates (`--extra 16 --reuse`). No spare used.
- **Rings 10 -> 7.** New land.js flag `--drop-moat` (keptPlan): a slot planned with a ring whose new picture can't carry one
  bakes ringless instead of refusing. 367 mg024 carries a ring but dealt 0 of 60 with one (moatSkip), 371 mg008's re-crop and
  385 mg058's can't carry one. moatSkip also lists mg093 and mg031 (ringless slots; 0 ring deals) for any later fresh plan.
  Ringed now: 361 362 365 372 374 386 390.
- **The 19 as baked** (tag, rate, pace, taps; longest tap 14.9-15.0 s, careful 0.94-1.0): 351 La Grande Jatte N 40.0% 197 s 51
  (was 55 taps at both caps); 358 N 36.0% 205 s 52; 359 E 74.3% 230 s 55; 362 H 16.0% 208 s 55 (ring); 366 E 59.3% 216 s 44;
  367 N 34.5% 205 s 52; 371 N 41.2% 219 s 55; 374 N 44.8% 169 s 39 (ring); 379 H 11.7% 285 s 54; 380 E 69.0% 237 s 44; 381 N
  31.2% 219 s 49; 382 E 74.3% 224 s 55; 385 N 32.8% 211 s 55; 388 N 36.0% 234 s 54; 391 E 57.3% 225 s 55; 392 N 35.5% 218 s 50;
  393 H 13.8% 201 s 44; 394 E 62.5% 226 s 44; 397 N 41.5% 204 s 47.
- **Whole world:** E18/N26/H6, Easy mean 68.2%, Normal 37.1%, Hard 14.5%; median real pace **218 s**, 158-285 s, 39-55 taps;
  ? cards 23, links 18, rings 7, 0 mystery blocks, 0 locks. land.js check PASS every gate.
- **Short titles (data only).** Lane C's new `short` (24 characters or fewer) is each record's title. Against round 1's
  records: 9 levels byte-identical (355 365 372 376 383 386 390 395 400), 22 differ in `title` only (352 353 354 356 357 360 361
  363 364 368 369 370 373 375 377 378 384 387 389 396 398 399, exactly the brief's list), 19 re-baked.
- **B1 credits.** New `zen.json` world field `credit` (land.json `worldCredit`, written by `land.js zen`). The map's credits
  line (`#map-credits`, the only place the game shows picture credits) is `gallery.credits` plus, on the Zen map, each world's
  credit: "Masterpiece Gallery: Public domain paintings from the Art Institute of Chicago, National Gallery of Art, The Met
  and Cleveland Museum of Art open access (CC0)." The Campaign map and Worlds 1-4 are unchanged (`gallery.credits` still names
  Twemoji, Noto and The Met). Tests: test.js (World 5 alone carries a credit, with the four museums; the Gallery line kept) and
  selfTest (the Zen map's foot reads the Gallery line then World 5's).
- **LICENSES.md:** World 5's table re-written by `land.js zen`; the 7 swapped rows name the new paintings.
- **Left as is:** the map tint (M2, Peter's call) and the Next up side quest (m2, LATER.md).
- **Freeze:** re-snapshot. Frozen zen.json: the other 150 records and Worlds 1-4 byte-identical; World 5's entry gains
  `credit`; its records 41 changed (19 re-baked, 22 titles), 9 identical. `--require` PASS (2,405 / 372 / 1,800 checks, shipped
  512, castles 283, all 0).
- **Gates:** test.js 714/0 (shipped 13,916,765 B); pack --check clean; selfTest 880/0 (375x812@3), 882/0 (1280x720), 880/0
  (360x640); check.mjs bytes 2, lazy 15, saves 4, sweep 18, 0 FAIL; sweep-map 126/0; regrades and harness: see v5-progress
  D20. Cache `?v=69`. First-tap bytes 1,869,718 (round 1 1,868,788; 6a7d1a5 1,857,289). zen-5.pk.json 94,951 B.
- **Shots:** `tools/shots-land-06/contact-installed.jpg` (re-rendered, numbered, as baked) and `play-grande-jatte-375.png` (the
  couple in play: the dark silhouette with the parasol on the lawn; "La Grande Jatte by Georges Seurat, all dug out." on the win).

## 1. Boards

`prep` (local-ai venv Pillow) then `convert` on the 62 landManifest lines copied whole into `pictures/manifest.json` (chroma
kept; `srcCrop` left as information, the converter's `crop` at its default). Lane C's own hand-off (`scripts/handoff-full.js`
on 6a7d1a5) gives **62 of 62 identical**; the land's convert gives **50 of 50 identical** to `boards-full/`. Sizes as
delivered, nothing shrunk: 42x45 20, 38x46 20, 42x46 8, 34x46 1, 42x40 1.

Manifest edits (display only, the boards untouched): mg127 Chrysanthemums and mg128 Lucie Berard had no date; filled from the
AIC API (`date_display` 1881-82 and 1883, a `dateNote` on each line). The two NGA/AIC Van Gogh self-portraits' shorts
"Self-Portrait (NGA)" / "(AIC)" became "Self-Portrait (1889)" / "(1887)" for the play bar and the win line.

## 2. Trial bake (mg003, mg002, mg038)

In their slots of the land's plan (351 normal with ? cards, 400 hard with links and ? cards, 399 normal with ? cards):

| Run | 351 La Grande Jatte | 399 Self-Portrait (NGA) | 400 The Bedroom |
|---|---|---|---|
| land-config defaults (squads 20-50 at sizeRef 1400, 96 attempts) | FAIL: no deal in 96 attempts, every candidate | FAIL: same | ok, 237 s, 55 taps |
| squads 1.6x (32-80), 32 attempts | FAIL | ok, 228 s, 44 taps | ok, 224 s, 50 taps |
| squads 1.6x, 400 attempts (shipped profile) | **ok**: Normal 39.5% (band 20-50), 221 s, 55 taps, longest tap 14.9 s, careful 1.0 | **ok**: 39.5%, 228 s, 44 taps, 14.8 s, careful 1.0 | **ok**: Hard 16.5% (6-20), 224 s, 50 taps, 14.9 s, careful 0.75 |

Every trial level wins on its stored order with no power-up (the check's gate), no fallback.

**Why the default failed.** A deal probe (gen.deal with the bake's own settings, 12 seeded attempts a board, normal rules)
dealt **none** on 25 of the 50 boards. Without the 15 s longest-tap cap every board deals in 35-55 taps; without the tap cap
few do. Lane C's paintings are max-box boards (1,890+ cells) whose colours lie in many scattered pieces, so a small squad's
last sappers walk a long way and the tap runs past 15 s, and smaller squads push the count past 55. Bigger squads help:
1.3x left 11 boards with none, 1.6x 4, 2.0x 3 (and `deep` 0 helped a little more); La Grande Jatte deals about 1 time in 200
at 1.6x-2x, so the attempts went to 400 (a deal that lands early stops the loop, so only the hard boards pay). The caps are
unchanged. `land.json profile.bake.deal: {size: [32, 80], attempts: 400}` with a note.

## 3. Bake and swaps

1. **Bake 1** (lane C's order, all 50 at the shipped profile): 44 ok; **6 failures, all moat slots**: 363 mg053 The Bridge at
   Argenteuil, 379 mg032 The Japanese Footbridge, 388 mg065 La Berceuse, 393 mg057 Study for La Grande Jatte, 395 mg026 Oiwa,
   396 mg109 The Lighthouse at Honfleur (no deal in 400 attempts on every candidate).
2. **Moat probe** (the bake's own moat builder and gen.deal, 6 rings x 20 attempts at each tag) on lane C's 19 ring-capable
   picks and the 6 ring-capable spares: 8 picks never deal with a ring (the six above plus mg077 Still Life with Apples and
   Pears, mg123 Girl in a Green Blouse). They're listed in `land.json moatSkip` (new in land.js: moatCan reports them as unable,
   so the plan leaves them ringless), the same finding as Dino Valley's.
3. **Bake 2** (fresh plan, all 50): **50 of 50 ok first time, no fallback.** `map assemble check`: **PASS every gate.**

**No spares used, no picture swapped, no re-conversion.** Lane C's order kept as delivered (La Grande Jatte 351, The Bedroom 400).

## 4. The world as baked

- **Tags E18 / N26 / H6 / X0** (casual, ending on a Hard): Hards 362 Woman with Red Hair, 372 Boy on the Rocks, 379 The
  Japanese Footbridge, 386 Boating, 393 Study for La Grande Jatte, 400 The Bedroom.
- Random-tap win rate: Easy mean 68.8% (58-77, band 45-80), Normal 37.6% (30-46, band 20-50), Hard 14.7% (9-20, band 6-20).
  Careful player: Easy 1.0 every level, Normal min 0.94, Hard min 0.75 (floor 0.5).
- Real pace 158-269 s, **median 221 s** (gate 200-250). Taps 39-55. Longest tap 15.0 s at most.
- Features: ? cards on 23 levels, linked squads on 18, **moat rings on 10** (361 362 365 367 371 372 374 385 386 390, 2 ways
  in each), **0 mystery blocks, 0 locks, 0 archers, 0 Extreme**.
- Profile: Dino Valley's as it ships (tools/lands/05-dino-valley/land.json) plus the deal change above.

## 5. Map (lever 1: zero new image bytes)

Castle sheets **2** (The Greenmarch: meadows, cottages, a river) and **5** (Fenwater Vale: a river garden), the "sunny
riverside" of the Impressionists, reused through new land.js support: `map.reuse` with `map.fromLayout [2, 5]` (their roads,
8 level spots each, quest spurs and bridges from `map/layout.json` and config `map.bridges`), laid A, B, A', B', A, B, A'
(7 sheets, 8 + 8 + ... + 2 levels), each under the world's own tint `sepia(.35) saturate(1.3) hue-rotate(-14deg)
brightness(1.06) contrast(1.04)` (a warm, varnished look, so they never read as the Campaign's green sheets). The check finds the
files in the game's `map/`; `zen` copies nothing. `map/` holds 31 image files before and after. Eggs: two a sheet on the castle
sheets' painted quest-spur tips (eggTurns): grass, butterfly, mushrooms, reeds (the river garden only). Not sheet 4 or 6,
which the plan earmarks for Water Lily Isle.

World 4's top sheet (Dino Valley's jungle) holds 199-200, then the World 5 banner and 201 on the same sheet; the castle sheet
crossfades in above (the same seam as every world before). Shots below.

## 6. Words and credits

- Banner "World 5 · Masterpiece Gallery"; lore: "The road wanders into a sunny riverside of famous old paintings, from a
  Sunday on La Grande Jatte to Van Gogh's bedroom, each one waiting to be dug out a block at a time." (test.js word check passes.)
- **Win line names the painting and the painter:** records carry `by` (land.json `byArtist`); config `zen.text.winLineBy`
  "{title} by {by}, all dug out." and `winLineAgainBy` (main.js uses them when the record has `by`). La Grande Jatte wins
  "A Sunday on La Grande Jatte by Georges Seurat, all dug out." Other worlds unchanged.
- **LICENSES.md** "Zen World 5: Masterpiece Gallery (Land 4, levels 351-400 ...)": the credits line ("Public domain paintings
  from the Art Institute of Chicago, National Gallery of Art, The Met and Cleveland Museum of Art open access (CC0)" plus one
  sentence on crops), then 50 rows: full title (id), artist, date (museum), licence (CC0 and the museum's open-access
  programme), the museum's own page. (land.js: land.json `credit`; a manifest line's `museum` and `date` join the artist.)

## 7. Gates (final tree)

| Gate | Result |
|---|---|
| land.js check | PASS every gate (numbering 351-400 e12, compile, wins, spaces, caps, pace and median 221 s, careful floor, no fallbacks, planCheck, Zen no mystery blocks, shade floors, 10 rings with reach and 2 ways, re-grade 0 of 450, map 48 px at 375, licences) |
| test.js | **714 passed, 0 failed** (new "zen World 5" block: records, numbering, La Grande Jatte first, caps, careful, shades, moats, profile, re-grade, 7 reused sheets in turn under one tint, eggs on the spurs, 31 map images, 50 licence rows with museum/CC0/source and the credits line; world list and Zen-profile list grown) |
| freeze | `--require` PASS before the snapshot; `--snapshot`: zen.json 150 -> 200 records, the 150 byte-identical, worlds 1-4 identical, World 5 appended, frozen.json only its date; `--require` PASS: levels.json 250 / 2,405 checks, gallery.json 62 / 372, zen.json 200 / 1,800, shipped 512 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 1,800; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 1,800 |
| pack.js --check | the shipped files match the source |
| selfTest (selftest-lands.mjs) | **879/0 at 375x812@3, 881/0 at 1280x720, 879/0 at 360x640 (--small)**, 0 console messages (new World 5 block: records, map with castle sheets 2/5 under the tint on every image, first node 201 open, banner, fog, La Grande Jatte plays and wins with the painter's line) |
| space-v7/check.mjs | bytes 2/2, lazy 15/15, saves 4/4, sweep 18/18 (World 5 added), 0 FAIL. Two fixed numbers fixed in the tool: the Zen map's node count now read from the index (was 200), and the old/new save comparison leaves out the Zen card's total ("of 212" vs "of 262 pictures") |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, hidden-tab selfTest 879/0, 0 console messages |

Cache tag `?v=68` (index.html, style.css).

## 8. Payload

| | 6a7d1a5 (v6.4) | this build | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 13,797,446 B (74 files) | **13,917,651 B** (75 files) | **+120,205 B** |
| of which levels/ (zen-5.pk.json 98,231 B; the index 18,008 -> 25,275 B) | | | +105,498 |
| LICENSES.md (World 5 section) | | | +10,475 |
| src/main.js (selfTest block, win line) / config.json | | | +3,977 / +255 |
| map/ | | | **0** |
| Bytes before the first tap (home interactive, 375x812 cold load) | 1,857,289 B | **1,868,788 B** | +11,499 (the index) |
| to the first Campaign level | 5,338,423 B | 5,349,922 B | +11,499 |
| to the first Zen level (World 1's file) | 5,393,234 B | 5,404,733 B | +11,499 |

World 5's own cost is 0.12 MB (the plan's lever 1-3 estimate); its records pack to 1,965 B a level (Dino Valley 1,458: bigger,
busier boards). 19 MB gate: 5.08 MB of room left.

## 9. Shots (tools/shots-land-06/, gitignored; `tools/shots-land-06.mjs` remakes them; notes.txt says what each shows)

- `map-join-375.png`: the World 4 -> 5 join at 375x812@3 (199, 200 done, the World 5 banner, 201 current "Picture 201").
- `map-mid-375.png` (217-227 on the tinted sheets, a bridge, an egg), `map-top-375.png` (247-250, "More worlds on the way").
- `map-1280.png`: World 5 on desktop (realm card "World 5 of 5 · Masterpiece Gallery", 9/50 cleared, next up 210).
- `play-grande-jatte-375.png`, `-mid-375.png` (part dug), `play-grande-jatte-1280.png`; `win-375.png` (the win sheet: "Picture
  done", "A Sunday on La Grande Jatte by Georges Seurat, all dug out.", the finished picture).
- `contact-installed.jpg`: the 50 as baked, numbered (level / Zen number, id, title; tag and features; size and moat; artist
  and date): `tools/land-contact.py ... --world 5 --zen-from 201` (new fourth line for a record with a painter).
- Fit at 375 with all 250 Zen nodes: tightest number 222 (27 px in the disc's 28), closest nodes 62.5 px. 0 console messages.

## 10. Known for the critic

- The Next up card on the Zen map names the oldest unwon side quest of any world (on World 5 it showed Kitten Forest's side
  quest 12 under a debug save that clears levels only); 6a7d1a5's World 4 shows the same. LATER.md.
- La Grande Jatte's crop is a field of small shapes; on the win sheet's thumbnail it reads soft. The board is lane C's; Peter's
  playtest call.
- 351 takes 55 taps (the cap) and 14.9 s on its longest tap: a full, legal deal at the edge of both caps.
- Three Van Gogh self-portraits at 354, 374, 399 and nine Van Goghs in all (lane C's call, kept).
