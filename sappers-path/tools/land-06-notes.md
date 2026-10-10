# Zen World 5 Masterpiece Gallery installed: v7 lane D (2026-10-10)

Brief: the orchestrator's lane D brief of 2026-10-10 (install lane C's real famous CC0 paintings, La Grande Jatte at level 1,
as Zen World 5; local only, never pushed). Plan: `game-research/sappers-path-v4/v7-worlds-plan.md`. Inputs (lane C's, read
only): `game-research/sappers-path-v4/lands/06-masterpiece-gallery/` (README, `picks-full.json`: landMain 50, trial 3, spares
12, held 3, landManifest 62 lines; `boards-full/`), sources `/Users/peter/local-ai/outputs/lands/06-masterpiece-gallery/fullsrc/`.
No image model was run. Commits on `sappers-path`: `5ea7a14` (land folder, land.js), `157b581` (install), `daa7949` (freeze),
then these notes.

Records n 351-400 (Land 4 in the factory's numbering, era 12, ids z5-1..z5-50, world 5), shown on the page as Zen pictures
201-250 (main.js zenNum: Worlds 1-4 hold 1-200).

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
