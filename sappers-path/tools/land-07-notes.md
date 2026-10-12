# Zen World 6 The Floating World: v7 lane D

## Round 5 (2026-10-12): reinstalled fresh as 29 levels (Peter via lane C 2cf16e0)

The critic of the 50-level install (`tools/critic-land-07.md`, games 39b0ddd) found 7 boards that read, 21 weak and 22 mud at
the 375 phone size. Peter chose bold repaints and a shorter world. Lane C's round 5 (`README.md` "Round 5"): 29 picks (7 kept
from round 1 as they read: fw001 fw004 fw095 fw029 fw100 fw055 fw084; 22 bold repaints, 6 of them Fuji boards), 12 spares, 41
landManifest lines, 26 of the 29 with an `edit` note. World 6 never shipped, so its 50 records were replaced outright. Not
pushed. No image model run. Commits: `aae1b54` (reinstall), `4b46e1c` (freeze), then these notes. Sections 1-11 below are the
50-level install's record (rounds 1-4); where round 5 changed a number, this section has it.

- **Inputs.** `handoff-full.js` on this worktree: **41 of 41 identical**. The 41 lines copied whole into `pictures/manifest.json`;
  `prep` + `convert --force`: **29 of 29 identical to boards-full**. Old sources removed, the 29 re-made.
- **Numbering.** land.json `count` 29: records n **401-429**, ids z6-1..z6-29, Zen pictures **251-279**, era 13.
- **The plan for 29.** land-plan's tags at 29 from the 50-level shares (0.36 / 0.52 / 0.12) would be E10/N16/H3; the profile's
  shares are now 0.36 / 0.50 / 0.14, so **E10 / N15 / H4**, ending on a Hard (the casual mix in proportion). No Extreme, locks,
  archers or mystery blocks.
- **Moat probe** (6 rings x 20 attempts a tag at the profile's deal setting): 5 boards can carry a ring and all 5 deal (fw046
  95%, fw005 63%, fw043 6-12%, fw103 1-6%, fw083 1-2%), so `moatSkip` is empty. Round 1's moatSkip and 424's byLevel cleared.
- **Bake** (fresh plan, World 5's shipped profile with the 1.6x/400 deal, `--shard 2`, 342 s): 25 of 29 ok first time.
  `--keep-plan --extra 16 --reuse` fixed 409 fw032 Fuji Reflected (Hard), 412 fw102 Yellowtail (Normal) and 417 fw046 The Moon
  Pine (Hard, ringed).
- **The reorder (orchestrator's OK, 2026-10-12).** 416 fw100 Rabbits in Moonlight could not fit its Normal slot: at the land's
  1.6x squads 22 of 24 candidates won 100% or near it and the in-band one failed the fast tapper (`--extra 16 --reuse`); at
  squads [20, 50], [26, 65] and [40, 100] (`profile.bake.byLevel`, tried and removed) it stayed at 73-100%. It is not too easy
  for every band: in a scratch copy with 415 and 416 traded it baked as an Easy. So lane D traded the two slots in the land's
  order (lane C's picks note: lane D owns the layout): **415 = fw100 Rabbits in Moonlight (Easy, plain)**, **416 = fw065 The
  Cushion Pine (Normal, a link)**, both re-baked on the kept plan with `--extra 8`: 415 79.75% (band 45-80), 244 s, 54 taps,
  15.0 s, careful 1.0; 416 37.5%, 195 s, 45 taps, 14.89 s, careful 1.0. land.json `mainNote` records it.
- **Too-easy watch:** none of the six Fuji boards (fw025 fw032 fw065 fw024 fw071 fw021) or the 4-colour boards (fw005 fw082 fw102
  fw044 fw017, and fw101) hit 100% on every candidate or failed every band. fw021 Cranes at Umezawa, too easy as round 1's crop,
  now closes the world as a Hard (13.5%).
- **`map assemble check`: PASS every gate.**

### The world as baked (round 5)

- **Tags E10 / N15 / H4 / X0**, ending on a Hard. Hards: 409 Fuji Reflected, 417 The Moon Pine (ringed), 424 Dawn at Isawa, 429
  Cranes at Umezawa.
- Random-tap win rate: Easy mean 71.0% (63.7-79.8, band 45-80), Normal 40.6% (35.5-46.8, band 20-50), Hard 14.1% (12.8-16.3,
  band 6-20). Careful player: Easy min 0.94, Normal 0.75, Hard 0.5 (the floor).
- Real pace 168-284 s, **median 224 s**. Taps 33-55. Longest tap 15.0 s at most. 0 fallbacks.
- ? cards on 14 levels, linked squads on 11, **rings on 4** (405 fw005 mire, 414 fw083, 417 fw046, 423 fw103; fw043 at 422 is
  ring-capable but its Easy slot wasn't planned one), 0 mystery blocks, 0 locks.

### Map, words, credits

- Sheets 7 and 1 as before, now **4 sheets** (A 9, B 8, A' 9, B' 3 levels; the top sheet's 3 like World 5's top 2), the same
  tint and eggTurns (trimmed to the 2 repeats each). Lore and banner unchanged.
- **Credit line** (the brief's, exactly): "The Floating World: Japanese woodblock prints by Katsushika Hokusai and Utagawa
  Hiroshige from the Art Institute of Chicago open access (CC0); most adapted for the game by Click it! Studios." on zen.json
  World 6 (the Zen map's foot, after World 5's) and under its LICENSES.md heading (critic m1).
- **LICENSES.md World 6: 29 rows keyed by Zen picture number then level** (critic m5): "| Zen picture | Level | Picture | Artist
  | Licence | Source |", rows 251/401 .. 279/429. New land.json `zen.numbered` (land.js zenInstall `zenRows`: the Zen number
  counts every earlier world's levels, a land world's from levels.json, as main.js zenNum does). 26 rows carry their edit note.
  Worlds 1-5's sections are untouched (the file before World 6's heading is byte-identical).

### Byte-identity (proven)

- zen.json: Worlds 1-5 entries and their 200 records JSON-identical to 39b0ddd's; version and note identical; World 6's 50
  records replaced by its 29 (250 -> 229 records).
- levels/: zen-1..zen-5.pk.json and every other packed file byte-identical; only `zen.pk.json` (the index) and `zen-6.pk.json`
  changed.
- Frozen set (`--snapshot`): frozen zen.json's Worlds 1-5 and 200 records identical to 39b0ddd's, equal to build-data's;
  levels.json, gallery.json and castles.json snapshots byte-identical; frozen.json only its date.

### Gates (round 5, final tree)

| Gate | Result |
|---|---|
| land.js check | PASS every gate (401-429 e13, median 224 s, careful floor, no fallbacks, planCheck at 29, Zen no mystery blocks, shades, 4 rings, re-grade 0, map, licences) |
| test.js | **715 passed, 0 failed** (World 6 block for 29: z6-1..z6-29, 401-429, E10/N15/H4 planCheck, 4 sheets 7/1 under the tint, 29 rows keyed Zen 251-279 then 401-429, 26 edit notes on exactly the edited prints, the new credit line) |
| freeze --require | PASS after the snapshot: levels.json 2,405 checks, gallery.json 372, zen.json 229 / 2,061, shipped 541 records, castles 283, all 0 |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 2,061; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 2,061 |
| pack.js --check | the shipped files match the source |
| selfTest | **884/0 at 375x812@3, 886/0 at 1280x720, 884/0 at 360x640 (--small)**, 0 console (World 6 block for 29) |
| space-v7/check.mjs | **41 ok, 0 FAIL** (OLD 10d77f4; Zen card "0 of 291 pictures") |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 884/0 or 886/0 in every viewport, 0 console |

Cache tag stays `?v=72` (unshipped; no gate needed a bump).

### Payload (round 5)

| | 10d77f4 (live) | round 5 | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 13,916,475 B | **13,979,970 B** (76 files) | **+63,495 B** |
| levels/zen-6.pk.json / zen.pk.json | - / 25,446 | **41,125** / 30,086 | +41,125 / +4,640 |
| LICENSES.md / src/main.js / LATER.md | | | +11,998 / +4,597 / +1,135 |
| map/ | | | 0 |
| Bytes before the first tap | 1,869,718 B | **1,878,955 B** | +9,237 |

World 6 packs to 1,418 B a level. 19 MB gate: **5.02 MB of room left**.

### Shots (re-taken; tools/shots-land-07/, gitignored)

`map-join-375.png` (249-250 then the World 6 banner and 251), `map-mid-375.png` (258-267), `map-top-375.png` (275-279 and "More
worlds on the way"), `map-1280.png`, `play-opener-375.png`, `play-opener-mid-375.png`, `play-opener-1280.png`, `win-375.png`
("The Cooper's Barrel by Katsushika Hokusai, all dug out."), `contact-installed.jpg` (29, `--world 6 --zen-from 251`), `harness/`.
Fit at 375 with 279 Zen nodes: tightest 222 (1 px spare, World 5's), closest 60.1 px. 0 console messages.

### Known for the critic (round 5)

- The lore still names "bridges, waterfalls, boats and snow"; the 29 have 1 bridge, 2 falls, 1 ship and 1 snow scene and lean
  on Fuji, flowers and fish. A lore line is one land.json edit, `land.js zen`, pack and a re-snapshot.
- The contact sheet is larger than a phone board; judge the 29 at play size (the critic's method).
- Hard 429 fw021 Cranes at Umezawa closes the world; its careful-player rate is at the floor (0.5) on one Hard.
- fw095's date "n.d." (museum data), the Next up / Secrets found cards and the map tint (M3) as before.

---

# Rounds 1-4: the 50-level install (2026-10-11)

Brief: the orchestrator's lane D install brief of 2026-10-11 (lane C's Japanese woodblock prints, Peter's OK via lane C, as Zen
World 6; local only, never pushed). Inputs (lane C's, read only): `game-research/sappers-path-v4/lands/07-floating-world/`
(README rounds 1-4, `picks-full.json`: landMain 50, spares 12, landManifest 62 lines; `edits.json`; `boards-full/`), workspace
b09b37d then f02643f (round 4: the 405/449 swaps), sources `/Users/peter/local-ai/outputs/lands/07-floating-world/fullsrc/`.
No image model was run. Commits on `sappers-path`: `0dbce04` (trial), `098fac7` (land folder for install, land.js byLevel and
licence edit notes), `6072a03` (install), then the freeze and these notes.

Records n 401-450 (Land 5 in the factory's numbering, era 13, ids z6-1..z6-50, world 6), shown on the page as Zen pictures
251-300 (main.js zenNum: Worlds 1-5 hold 1-250). `scratch/state.json` seeded `{from: 401, sheet0: 54, gal0: 62}`.

## 1. Boards

Lane C's `scripts/handoff-full.js` on this worktree: **62 of 62 identical** (b09b37d, and again on f02643f). The 62
landManifest lines copied whole into `pictures/manifest.json` (chroma, srcCrop, museum, date and, on 13, `edit`); `main` =
lane C's landMain in their order. `prep` + `convert --force`: **50 of 50 identical to boards-full**. Round 4 (lane C's swaps):
the manifest lines unchanged, `main` changed at 405 (fw021 -> fw089 The Paulownia Grove) and 449 (fw067 -> fw087 Sanno
Festival); convert again 50 of 50, and against round 1's boards exactly 405 and 449 changed. Sizes as delivered: 42x45 21,
38x46 20, 42x46 3, 42x40 2, 42x41 2, 42x42 1, 42x44 1.

The 13 repainted prints (lane C round 3, Peter: "make artistic changes to the pixels to make things easier to read"): fw001
The Cooper's Barrel, fw097 White Heron, fw095 Crane over a Wave, fw029 The Big Ship, fw027 Riders by the Sumida, fw100 Rabbits
in Moonlight, fw043 Peonies and Butterfly, fw038 Hanging-Cloud Bridge, fw013 Through the Pines, fw042 Morning Glories, fw058
The Monkey Bridge, fw036 Ono Falls, fw039 The Eight-Plank Bridge. Each carries its edit note on its licence row (§6).

## 2. Moat probe

land.js `moatCan` finds **16** ring-capable boards in round 3's 50 (lane C's README counts 18 with its own check; 15 after the
round 4 swaps). A deal probe (the bake's own moat builder and `gen.deal` at the profile's deal setting, 6 rings x 20 attempts
a tag; a scratch script, not in the repo) found 6 that never deal with a ring at Normal and Hard: fw017, fw021, fw024, fw012,
fw058 (0 of 120 at every tag), fw041 (2 / 0 / 0). They're in `land.json moatSkip` (fw021 has since gone to the spares).
The rest dealt 1-100% (fw097 100%, fw040 58-69%, fw038 fw057 fw067 21-25%, fw016 8%, fw043 fw053 fw106 2-4%, fw042 1%); round
4's fw087 2-4% at Easy, 2 of 120 at Normal, 1 at Hard.

## 3. Bake

1. **Bake 1** (fresh plan, shipped profile, `--shard 2`, 614 s wall on 16 threads): 43 ok first time, **7 fallbacks**: 405
   fw021 (100% vs 20-50%), 414 fw097 (59.5%), 421 fw088 (fast tapper), 424 fw055 (62%, fast tapper, careful 0.25), 431 fw100
   (fast tapper), 440 fw042 (pace 302 s), 449 fw067 (100%).
2. **`--keep-plan --extra 16 --reuse`** on the 7 (324 s): 414, 421, 431, 440 ok. 405, 424, 449 still fallbacks.
3. **405 fw021 and 449 fw067: too easy at any band.** Every one of 24 candidates won 100% of random-tap games; the same at
   squads [20, 50] and [26, 65] (a scratch copy). Reported; lane C swapped them (round 4, f02643f): **405 fw089** and **449
   fw087**, both re-baked on the kept plan, **ok first time**: 405 Normal ? cards 36.25%, 212 s, 49 taps, 14.93 s, careful
   1.0; 449 Normal ? cards **with its ring** (mire, 2 ways, 79 water), 43.75%, 217 s, 44 taps, 14.90 s, careful 1.0 (718 deal
   attempts for its 8 candidates: the ring deals rarely, but deals). No `--drop-moat` needed.
4. **424 fw055 Fudo Falls: the fast tapper.** At the land's 1.6x squads its fast tapper beat patient play on every one of 56
   candidates (`--extra 48 --reuse`); at the land-config default squads [20, 50] it passed first time. New land.js
   `profile.bake.byLevel {n: bake}` (one level's own bake merged over the land's; `overOf`), set for 424 only:
   `{deal: {size: [20, 50]}}`. Re-baked: Normal, linked, ok, 217 s, 55 taps. The grader's counts are unchanged, so re-grade
   reads it as any other level.

`map assemble check`: **PASS every gate** (`scratch/report.md`). No spare chosen by lane D; lane C chose both swaps.

## 4. The world as baked

- **Tags E18 / N26 / H6 / X0**, ending on a Hard. Hards: 412 Cherry over the River, 422 Lilies, 429 Riders by the Sumida, 436
  Moon-Viewing Room, 443 Crossing the River, 450 The Wave.
- Random-tap win rate: Easy mean 69.8% (61.0-78.8, band 45-80), Normal 38.1% (32.0-47.3, band 20-50), Hard 14.3% (10.5-18.0,
  band 6-20). Careful player: Easy min 0.81, Normal min 0.5 (the floor), Hard min 0.94.
- Real pace 186-280 s, **median 233 s** (gate 200-250). Taps 40-55. Longest tap 15.0 s at most.
- Features: ? cards on 23 levels, linked squads on 18, **moat rings on 9** (407 414 434 436 439 440 441 446 449; 441 and 449
  mire), **0 mystery blocks, 0 locks, 0 archers, 0 Extreme**, 0 fallbacks.
- Profile: World 5's as it ships (Dino Valley's tags and features plus the deal setting `{size: [32, 80], attempts: 400}`),
  plus 424's byLevel.

## 5. Map (lever 1: zero new image bytes)

Castle sheets **7** (The Ironhollows: misty peaks and pines, the road to the mountain) and **1** (The Greenmarch: a river with
two bridges and a cottage), laid A, B, A', B', A, B (6 sheets: 9 + 8 + 9 + 8 + 9 + 7 levels), each under the world's tint
`hue-rotate(30deg) saturate(.75) sepia(.18) brightness(1.08) contrast(1.1)`: the greens toward a pale blue-green paper, the
water indigo, clearly apart from World 5's warm sepia (shots). Not 2/5 (World 5's) or 4/6 (Water Lily Isle). A vermilion lean
isn't possible with one filter on the whole image (it turns the water pink; tried in a CSS-filter emulation on the two sheets).
Eggs two a sheet on the castle sheets' quest-spur tips (eggTurns): raven, grass, mushrooms on the peaks; fish, reeds, butterfly
on the river. `map/` holds 31 image files before and after. The top sheet holds 7 levels, so one of its eggs sits below the
fog and shows (World 5's top sheet held 2, so none did); the selfTest allows that.

## 6. Words and credits

- Banner "World 6 · The Floating World"; lore: "The road climbs from old Edo toward Mount Fuji, past bridges, waterfalls, boats
  and snow in Hokusai's and Hiroshige's woodblock prints, each one waiting to be dug out a block at a time." (test.js word
  check passes.)
- **Win line names the print and the artist** (byArtist, `zen.text.winLineBy`): "The Cooper's Barrel by Katsushika Hokusai,
  all dug out."
- **Credit line** (the brief's, exactly): "Japanese woodblock prints by Katsushika Hokusai and Utagawa Hiroshige from the Art
  Institute of Chicago open access (CC0); some adapted for the game by Click it! Studios." It is zen.json World 6's `credit`
  (shown on the Zen map's foot after the Gallery's and World 5's) and the line under the LICENSES.md heading.
- **LICENSES.md** "Zen World 6: The Floating World (Land 5, levels 401-450 ...)": the credit line, then 50 rows: full title (id),
  artist, date (Art Institute of Chicago), "Public domain (CC0, Art Institute of Chicago open access)", the museum's page. The
  13 repainted prints' licence cells add their edit note, e.g. 401: "Adapted for the board by Click it! Studios: the barrel
  ring was pale on pale paper: a bold wood ring, a blue sky, a small Fuji inside the ring". land.js (new `editOf`) drops lane
  C's own pointers "(ops in edits.json)" and "(pass 2)" from the note; the manifest keeps them whole.

## 7. Gates (final tree)

| Gate | Result |
|---|---|
| land.js check | PASS every gate (numbering 401-450 e13, compile, wins, spaces, caps, pace and median 233 s, careful floor, no fallbacks, planCheck, Zen no mystery blocks, shade floors, 9 rings with reach and 2 ways, re-grade 0 of 450, map 48 px at 375, licences) |
| test.js | **715 passed, 0 failed** (new "zen World 6" block: records, numbering, The Cooper's Barrel by Hokusai first, caps, careful, shades, moats, profile, re-grade, 6 reused sheets 7/1 in turn under its own tint (not World 5's), eggs on the spurs, 31 map images, 50 licence rows with Hokusai or Hiroshige, AIC, CC0 and the museum page, the 13 edit notes on exactly the 13 repainted prints, the credit line in LICENSES.md and on the world; World 1's world list grown; World 5's credit check now "5,6"; Zen-profile list grown) |
| freeze | `--require` PASS before the snapshot; `--snapshot`: frozen zen.json 200 -> 250 records, the 200 byte-identical, Worlds 1-5 identical, World 6 appended, equal to build-data's; levels.json and gallery.json snapshots byte-identical; frozen.json only its date; `--require` PASS: levels.json 250 / 2,405 checks, gallery.json 62 / 372, zen.json 250 / 2,250, shipped 562 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 2,250; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 2,250 |
| pack.js --check | the shipped files match the source (only `zen.pk.json` rewritten and `zen-6.pk.json` new; zen-1..5 byte-identical) |
| selfTest (selftest-lands.mjs) | **884/0 at 375x812@3, 886/0 at 1280x720, 884/0 at 360x640 (--small)**, 0 console messages (new World 6 block: records, map with castle sheets 7/1 under its tint on every image, first node 251 open, banner, fog, credits after World 5's, The Cooper's Barrel plays and wins with Hokusai's line) |
| space-v7/check.mjs | **41 ok, 0 FAIL** (OLD = 10d77f4's sappers-path from git archive, `OLD_DIR` set): bytes, lazy (Zen card "0 of 312 pictures", 300 nodes from the index), saves, sweep (Zen World 6 z6-1 added) |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 884/0 or 886/0 in every viewport and the hidden tab, 0 console messages |

Cache tag `?v=72` (index.html, style.css).

## 8. Payload

| | 10d77f4 (v6.5.1, live) | this build | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 13,916,475 B (75 files) | **14,033,154 B** (76 files) | **+116,679 B** |
| levels/zen-6.pk.json (new) / zen.pk.json (the index 25,446 -> 32,254 B) | | **88,059 B** | +88,059 / +6,808 |
| LICENSES.md (World 6 section) / LATER.md | | | +16,104 / +1,135 |
| src/main.js (selfTest block) | | | +4,573 |
| map/ | | | **0** |
| Bytes before the first tap (home interactive, 375x812 cold load) | 1,869,718 B | **1,881,099 B** | +11,381 (the index, the code) |
| to the first Zen level (World 1's file) | 5,405,663 B | 5,417,044 B | +11,381 |

World 6's own cost is 0.12 MB; its records pack to 1,761 B a level (World 5 1,891). 19 MB gate: **4.97 MB of room left**.
(check.mjs's "to the first Campaign level" reads 4,377,181 B on NEW against 5,350,852 on OLD: the music had not finished
loading at network idle on that run, so the audio part is short; not a real change.)

## 9. Shots (tools/shots-land-07/, gitignored; `tools/shots-land-07.mjs` remakes them; notes.txt says what each shows)

- `map-join-375.png`: the World 5 -> 6 join at 375x812@3 (249, 250 done under World 5's sepia, the World 6 banner, 251
  current "Picture 251" on the tinted peaks sheet).
- `map-mid-375.png` (268-278 on the peaks), `map-top-375.png` (292-300 on the river sheet with both bridges, "More worlds on
  the way").
- `map-1280.png`: World 6 on desktop (realm card "World 6 of 6 · The Floating World", 9/50 cleared, next up 260).
- `play-opener-375.png`, `play-opener-mid-375.png` (part dug), `play-opener-1280.png`; `win-375.png` (the win sheet: "Picture
  done", "The Cooper's Barrel by Katsushika Hokusai, all dug out.", the finished picture).
- `contact-installed.jpg`: the 50 as baked, numbered (level / Zen number, id, title; tag and features; size and moat; artist
  and date): `tools/land-contact.py tools/build-data/levels/zen.json 5 ... --world 6 --zen-from 251`.
- Fit at 375 with all 300 Zen nodes: tightest number 222 (27 px in the disc's 28, World 5's, unchanged), closest nodes 60.1
  px (255-256). 0 console messages.
- `harness/`: the harness's shots and report.

## 10. Known for the critic

- The credit line is the brief's exact words, with no "The Floating World:" in front, so on the Zen map's foot it follows World
  5's "Masterpiece Gallery: ..." as a plain sentence. LATER.md.
- The tint reads as pale blue-green paper with indigo water; a vermilion lean isn't possible with one filter (LATER.md). At
  1280 the peaks sheet reads soft green more than woodblock.
- fw095 Crane over a Wave's date is "n.d." (the museum's own data) on its licence row and contact tile.
- 424 Fudo Falls bakes on the land-config default squads (`profile.bake.byLevel`), the only level not on the land's 1.6x.
- 449 Sanno Festival's ring is mire (brown), not water, since its colours sit near the water's.
- Normal's careful-player minimum is exactly the floor (0.5).
- The Next up card names Kitten Forest's side quest 12 and "Secrets found" is empty, as on Worlds 4 and 5 (LATER.md).
- One egg shows on the top sheet below the fog (the sheet holds 7 levels); World 5's top sheet held 2 and showed none.

## 11. The trial (2026-10-10, before lane C's round 2-4 changes; commit 0dbce04)

Trial bake of fw001, fw101 and fw006 on the round 1 boards (fw001 was repainted in round 3 and re-baked in the install). The land folder was a scaffold then (k 5, World 5's profile, state seeded from 401).

In their own slots of lane C's order on the land's fresh plan (`bake --list 401,403,408 --shard 1`): 401 Normal with a linked
pair, 403 Easy plain, 408 Normal with 2 ? cards. The plan put no Hard on any of the three, so fw006 was also baked in the Hard
slot 412 (linked + ? cards, 3 cards, 2 pairs) from a scratch copy of the land with fw006 and fw052 swapped (`--keep-plan`,
same tags and features; both pictures ringless).

| Level | Print | Board | Tag, features | Rate (band) | Pace | Taps | Longest tap | Careful | Fallback | Deal attempts |
|---|---|---|---|---|---|---|---|---|---|---|
| 401 | fw001 The Cooper's Barrel | 42x42, 5 colours | Normal, 1 linked pair | 40.75% (20-50) | 224 s | 50 | 15.00 s | 0.875 | no | 16 for 8 candidates, 0 no-deal |
| 403 | fw101 Bonito | 42x45, 5 colours | Easy, plain | 68.50% (45-80) | 234 s | 51 | 14.98 s | 1.0 | no | 8 for 8, 0 no-deal |
| 408 | fw006 The Boatman at Haneda | 38x46, 7 colours | Normal, 2 ? cards | 39.00% (20-50) | 254 s | 55 | 14.94 s | 1.0 | no | 14 for 8, 0 no-deal |
| 412 (extra) | fw006 The Boatman at Haneda | 38x46 | Hard, 2 linked pairs + 3 ? cards | 14.00% (6-20) | 232 s | 49 | 14.96 s | 1.0 | no | 14 for 10, 0 no-deal |

- **All ok first time on the shipped profile**, no fallback, no extra candidates. Each stored order replays to a win with no
  power-up and `E.check` is clean (engine replay on the bake records; the land's full check needs all 50 and the map).
- **Rings:** none of the three can carry one (land.js `moatCan`, matching lane C's picks): fw001 "the ring shuts in 100 cells
  of the subject", fw101 and fw006 "a picture colour (or shade) within 20/14 of every water colour". So no ringed run; their
  slots were planned ringless. 19 of the 50 can carry a ring; whether they deal with one is for the full bake (World 5 needed
  moatSkip for 8 of 19).
- **Edge of the caps:** 408 sits on the 55-tap cap and at 254 s; 401 at the 15.00 s tap cap. Legal, and World 5's 351 was the same.
- **Time:** 66 s wall for the three (24 candidate shards, 16 threads); 70 s for the Hard extra.

**Was World 5's deal setting needed? Yes.** The same three on the land-config default deal (squads 20-50 at sizeRef 1400,
32 attempts; a scratch copy without `profile.bake.deal`) also passed (401 Normal 38.25%, 196 s, 55 taps; 403 Easy 73.0%, 226 s,
55 taps; 408 Normal 44.25%, 223 s, 52 taps; careful 1.0), but deals came hard: 401 7 of 8 candidates dealt, about 8% of attempts
(122 attempts, one "no deal in 32"), 408 6 of 8, about 7% (151 attempts, two no-deals), and two levels sat on the 55-tap cap.
The 1.6x squads dealt 50-100% of attempts. Woodblock prints are max-box boards like World 5's paintings; keep the profile.

Also from the first, mis-swapped Hard copy: fw052 Cherry over the River at 412 Hard, 16.5%, 239 s, 46 taps, 14.99 s, careful
1.0, ok (40 deal attempts for 10 candidates).

