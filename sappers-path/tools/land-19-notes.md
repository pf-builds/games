# Zen World 16 The Naturalist's Book: v7 lane D

## Install (2026-10-13/14)

Brief: the orchestrator's lane D brief of 2026-10-13 (lane C's Naturalist's Book as Zen World 16, a short real-art world, in two
phases: phase 1 in the land folder only while Worlds 13-15 were installed in the same worktree, phase 2 after Safari's 679204b;
local only, never pushed; no image model run; Peter approved the world order and the unattended run). Inputs (lane C's, read
only): `game-research/sappers-path-v4/lands/19-naturalists-book/` (README, `picks-full.json`, `boards-full/`,
`scripts/handoff-full.js`), sources `/Users/peter/local-ai/outputs/lands/19-naturalists-book/fullsrc/` (raw/ links to the 10/8
download for 03-naturalists-book). Method: World 8 Poster Parade (`tools/land-09-notes.md`) and World 6 for the real-art side,
Safari (`tools/land-18-notes.md`) for the phases. Commits on `sappers-path`: land.js (the engraver), land folder, install,
freeze, then these notes.

Records n **767-777** (Land 15 in the factory's numbering, era 23 = 8 + 15, ids z16-1..z16-11, world 16), shown on the page as
Zen pictures **617-627** (main.js zenNum: Worlds 1-15 hold 1-616). `scratch/state.json` seeded `{from: 767, sheet0: 102, gal0:
62}`, the end state 679204b left (last record 766, Safari's 5 sheets ending at 101, gallery 62, no side quests).

### 1. Two rounds of picks (lane C's workspace a47ff54, b52fa92)

Each round: `handoff-full.js` on lane C's latest, `pictures/manifest.json` replaced **whole** with lane C's 18 landManifest lines
(main order, then spares), `prep` + `convert --force` identical to boards-full, `src/` byte-identical to the hand-off's.
`scratch/phase1.md` logs both; the 14-level run is kept in `scratch/phase1-14/`.

1. **14** (a47ff54): handoff **18/18**, convert 14/14. Moat probe: 5 ring-capable, nb53 Empress Josephine Rose never deals
   (moatSkip). Fresh bake (E5/N7/H2 at 14, Poster Parade's shares): **14 ok first time**, 0 fallbacks, no extras, no reorder, no
   spare. Pre-read at about 375 px (9 px a cell): mud or title-only nb22 Great Horned Owl (both owls melt into the branch) and
   nb30 Golden Eagle (a dark brown mass); weak nb21 Barn Owl, nb04 Snowy Owl, nb09 Brown Pelican; prey in the talons on the
   Golden Eagle (a hare) and the Barn Owl (a ground squirrel), both orange-brown, no red. No plate caption survives in any board.
   Manifest issues sent back: `date` was the download date, `artist` carried the engraver, Redouté spelled two ways.
2. **11** (b52fa92, this install): lane C dropped nb21, nb22 and nb30 (spares now, 7 in all) and fixed the lines: the plate's
   year in `date`, the painter alone in `artist`, the engraver in its own `engraver` field, Redouté with its accent. Handoff
   **18/18**, convert 11/11. `landTags(11)` gives NENENHENENH (E4/N5/H2); the 11 had baked E4/N6/H1, so each tag's pictures fill
   the pattern in lane C's order (a stable merge: nb28/nb49, nb06/nb52 and nb50/nb04 trade places, every picture within 1 slot of
   lane C's place) and nb06 Blue Jay (6 colours, the busiest Normal) takes the new Hard at slot 6 on nb22's old Hard plan
   (linked, 3 ? cards; it can't carry a ring either). `bake --keep-plan --reuse`: 82 candidates reused, 10 new (Blue Jay's);
   **11 ok**, 10 of 11 picks identical to the 14 run.

Seeds on the way: 731 (phase 1, sheet0 98), then the coordinator's 771, 770 and 767 as the earlier worlds settled. Phase 2:
`{767, 102, 62}`, the candidates moved with n (731 -> 767), `bake --keep-plan --reuse`: 0 new candidates, all 11 picks identical;
`map assemble check --force`: every record identical to the 731 run's but id and n (`scratch/r-731/`); sheets 102-103.

### 2. Moat probe

The Worlds 4-15 scratch script (`scratch/moat-probe.js`, 6 rings x 20 attempts a tag; `probe.log`, on the 14). **moatSkip 1**:
nb53 Empress Josephine Rose (0/360). Of the 11, 5 can carry a ring by shape (nb52 nb04 nb50 nb09 nb53); less nb53, 4 can take
one and 3 do (nb52 Crown Imperial's Easy slot plans none). nb04 deals 77-81%, nb09 49-53%, nb52 35-43%, nb50 22-23%.

### 3. The world as baked

| Level / Zen | Plate | Tag, features | Rate (band) | Pace | Taps |
|---|---|---|---|---|---|
| 767 / 617 | nb01 American Flamingo (Audubon) | N, 2 ? | 35.3% | 204 s | 52 |
| 768 / 618 | nb28 American White Pelican (Audubon) | E, link | 72.3% | 200 s | 53 |
| 769 / 619 | nb49 The Blue Heron (Catesby) | N, 2 ? | 42.8% | 232 s | 47 |
| 770 / 620 | nb55 Eclectus Parrots (Lear) | E | 67.8% | 221 s | 45 |
| 771 / 621 | nb18 Scarlet Ibis (Audubon, 42x33) | N, 2 ? | 41.3% | 226 s | 39 |
| 772 / 622 | nb06 Blue Jay (Audubon) | H, link, 3 ? | 15.3% | 253 s | 45 |
| 773 / 623 | nb52 Crown Imperial (Redouté) | E | 53.0% | 220 s | 49 |
| 774 / 624 | nb50 Scarlet Lily (Redouté) | N, 2 ?, ring | 27.3% | 178 s | 50 |
| 775 / 625 | nb04 Snowy Owl (Audubon) | E, ring | 72.8% | 229 s | 48 |
| 776 / 626 | nb09 Brown Pelican (Audubon) | N, link, ring | 37.8% | 167 s | 52 |
| 777 / 627 | nb53 Empress Josephine Rose (Redouté) | H, 3 ? | 15.0% | 225 s | 45 |

- **Tags E4 / N5 / H2 / X0**, ending on a Hard (777 Empress Josephine Rose).
- Random-tap win rate: Easy mean **66.4%** (53.0-72.8, band 45-80), Normal **36.9%** (27.3-42.8, band 20-50), Hard **15.1%**
  (15.0-15.3, band 6-20). Careful player 1.0 at every level (floor 0.5).
- Real pace 167-253 s, **median 221 s**. Taps 39-53. Longest tap 15.0 s at most.
- ? cards on 6 levels, linked squads on 3, **rings on 3** (774 775 776), **0 mystery blocks, 0 locks, 0 archers, 0 Extreme, 0
  fallbacks**. Profile: Poster Parade's (World 6's short-world shares, squads 1.6x, 400 deal attempts; no byLevel needed).
- **byArtist on:** every record's `by` is the painter alone, so a win reads "{title} by {painter}, all dug out." ("American
  Flamingo by John James Audubon", "Crown Imperial by Pierre-Joseph Redouté", accent kept).
- **Too-easy watch:** none failed. 774 Scarlet Lily (Normal) 5 of 8 candidates at 96-100%, the pick 27.3%; 768 White Pelican and
  775 Snowy Owl 72-73% (Easy, under 80); 776 Brown Pelican paces 167 s (low end of 150-300).

### 4. Map (lever 1: zero new image bytes)

Castle sheets **4** (river channels through a green meadow) and **6** (Fenwater's marsh: broad pools and tree islands), the pair
`tools/map-plan-v7.md` earmarked for the dropped Monet / Water Lily world, laid A, B (**2 sheets** 102-103: 8 + 3). 16 (lava) and
25 (the Goblin King's summit) don't suit. Tint `sepia(.5) saturate(1.15) hue-rotate(-4deg) brightness(1.22) contrast(.9)`: a
warm cream page with soft green, pale and low-contrast, chosen from 9 candidates rendered in headless Chromium beside Worlds 5,
6, 9, 11, 14 and 15's sheets (`tools/lands/19-naturalists-book/scratch/tint/`); greyer ones read drab, cooler ones too near World
6's sheet 1. Water goes a muted grey-teal, not an odd colour. Config bridges already sit on both sheets' painted water (4: 52,
146; 6: 27, 56, 93). Eggs per `eggTurns` on each sheet's two quest-spur tips (4 at (434,702) (355,296); 6 at (306,971)
(120,324)): reeds/butterfly, fish/owl. `map/` unchanged (31 image files). The top sheet holds 3 levels (625-627); the fog sits
after 627.

### 5. Words, credits and the engraver

- Banner "World 16 · The Naturalist's Book"; lore: "The road wanders through an old naturalist's book of hand-coloured plates:
  flamingos, herons and pelicans by the water, a snowy owl, parrots and a jay, and a few garden flowers, each one dug out a block
  at a time." (no prey left in the world; test.js word check passes).
- **Credit line** exactly: "The Naturalist's Book: natural-history plates by John James Audubon and others from the National
  Gallery of Art, The Met and Cleveland Museum of Art open access (CC0); some adapted for the game by Click it! Studios." on
  zen.json World 16 (the Zen map's foot after Safari's) and under the LICENSES.md heading.
- **land.js (commit 6ca692e):** a manifest line's `engraver` joins its licence row after the date: "John James Audubon, 1838,
  engraved by Robert Havell (National Gallery of Art)" (the 6 Audubon plates); the record's `by` stays the painter. And on a
  numbered row a `short` equal to the title isn't said twice (lane C's shorts are the titles; the row read "American Flamingo:
  American Flamingo"). No earlier land's manifest has an engraver, and no earlier numbered land has a short equal to its title, so
  a re-assemble of any of them writes the same rows.
- **LICENSES.md** "Zen World 16: The Naturalist's Book (Land 15, levels 767-777 ...)": the credit line, 11 rows keyed by Zen
  picture number then level (`zen.numbered`), each the painter, the plate's year, the engraver where there is one, the museum,
  CC0 and the museum page; the 4 edited plates (nb55 nb52 nb50 nb04: a tighter crop, the cream page split into a sky band and a
  grass band) carry their edit note. "lane C" nowhere.

### 6. Byte-identity (proven)

- zen.json: every top-level key but `worlds`/`levels` identical to 679204b's; Worlds 1-15 entries and the first 566 records
  JSON-identical; World 16 appended (566 -> 577 records, all world 16, era 23, z16-1 n 767 .. z16-11 n 777).
- levels/: every packed file byte-identical but `zen.pk.json` (modified) and `zen-16.pk.json` (new); the index's Worlds 1-15
  entries and every other key identical. levels.json, gallery.json, places.json untouched.
- LICENSES.md: the old file (190,734 B) is a byte prefix of the new (194,177 B).
- Frozen set: `freeze --require` PASS before the snapshot (zen.json 566 / 5,094, 0 differences); `--snapshot`: frozen zen.json
  566 -> 577 records, the old 566, Worlds 1-15 and every other key identical, the whole equal to build-data's. `--snapshot`
  rewrote frozen.json's `made` date (10-13 -> 10-14); reverted, so frozen.json is byte-identical.

### 7. test.js and selfTest

- test.js: a "zen World 16" block (World 15's, for 11 at 767-777, era 23, sheets 4/6, 2 sheets, tint apart from Worlds 5-15, Zen
  617-627, every record's by the manifest's painter with no comma; licence rows checked cell for cell against the manifest
  (painter, year, "engraved by" where the line has one, museum), the 6 Havell rows, the 4 edited rows; easy + normal >= 0.81
  (E4/N5/H2 at 11 is 0.818); nb53 ringless, nb21 nb22 nb30 out of `main`, the closer nb53 a Hard); the world list, World 5's
  credit list and the D8 Zen-profile list grow by World 16 / `19-naturalists-book`.
- selfTest (main.js): a "World 16" block as World 15's (records with a painter, map with castle sheets 4/6 under its tint on every
  image, first node 617 open, banner, fog, credits after Safari's), and its play as World 6's: American Flamingo plays and wins
  with the painter's line "American Flamingo by John James Audubon, all dug out."
- check.mjs: "0 of 639 pictures"; the sweep loads z16-1.

### 8. Gates (final tree)

| Gate | Result |
|---|---|
| land.js check | PASS every gate (18 of 18 with the Zen gate; 767-777 e23, median 221 s, 3 rings, re-grade 0 differences, map 48 px at 375, licences) |
| test.js | **725 passed, 0 failed** (shipped 14,639,169 B, 86 files), run before and after the snapshot |
| freeze --require | PASS before the snapshot (zen.json 566 / 5,094, 0 differences) and after: levels.json 2,405 checks, gallery.json 372, zen.json 577 / 5,193, shipped 889 records, castles 283, all 0 differences |
| regrade | full 0 of 2,405; `--gallery` 0 of 372; `--zen` 0 of 5,193; `--shipped` 0 of 2,405; `--gallery --shipped` 0 of 372; `--zen --shipped` 0 of 5,193 |
| pack.js --check | the shipped files match the source |
| selfTest (selftest-lands.mjs) | **924/0 at 375x812@3, 926/0 at 1280x720, 924/0 at 360x640 (--small)**, 0 console |
| space-v7/check.mjs | **61 ok, 0 FAIL** (OLD = e072a9d via `OLD_DIR`, a `git archive` of it served on its own port): Zen card "0 of 639 pictures", 627 nodes from the index, sweep z16-1 at 375 and 1280 |
| sweep-map.mjs | 63 sizes, 126 checks, 0 fails, 0 console |
| harness.mjs (last) | **all passed**, selfTest 924/0 or 926/0 in every viewport and the hidden tab, 0 console (`tools/shots-land-19/harness/`) |

No gate needed a re-run for a load spike. (The first freeze chain stopped after its first `--require` on a zsh `==` in an echo;
the snapshot and the second `--require` were run on their own.)

Cache tag **`?v=86`** (index.html, style.css).

### 9. Payload

| | 679204b (World 15) | this build | Change |
|---|---:|---:|---:|
| Shipped folder (minus tools/) | 14,612,185 B (85 files) | **14,639,169 B** (86 files) | **+26,984 B** |
| levels/zen-16.pk.json (new) | | **16,096 B** | +16,096 |
| levels/zen.pk.json (the index) | 81,109 | 83,779 | +2,670 |
| LICENSES.md (World 16 section) / src/main.js (selfTest block) | 190,734 / 480,244 | 194,177 / 485,019 | +3,443 / +4,775 |
| map/ | | | **0** |
| Bytes before the first tap (home interactive, 375x812 cold load) | 1,970,499 B | **1,977,944 B** | +7,445 (the index, the code) |
| to the first Zen level (World 1's file) | 5,506,444 B | 5,513,889 B | +7,445 |

Against e072a9d (v6.7, live): first tap +87,456 B (1,890,488 -> 1,977,944). World 16 packs to 1,463 B a level. 19 MB gate:
**4.36 MB of room left**.

### 10. Shots (tools/shots-land-19/, gitignored; `tools/shots-land-19.mjs` remakes them; notes.txt says what each shows)

- `map-join-375.png`: the World 15 -> 16 join at 375x812@3 (615-616 done on Safari's golden sheet, the World 16 banner on the
  cream river sheet, 617 current "Play picture 617").
- `map-mid-375.png` (617-627, the whole world in view), `map-top-375.png` (623-627 on the marsh sheet, "More worlds on the way").
- `map-1280.png`: World 16 on desktop ("World 16 of 16", 3/11 cleared, 620 current, the lore on the realm card).
- `play-opener-375.png` (American Flamingo in play), `play-opener-mid-375.png`, `play-opener-1280.png`; `win-375.png` ("Picture
  done", "American Flamingo by John James Audubon, all dug out.").
- `contact-installed.jpg`: the 11 as baked, numbered with painter and year (`tools/land-contact.py
  tools/build-data/levels/zen.json 15 ... --world 16 --zen-from 617 --cols 6`).
- Fit at 375 with all 627 Zen nodes: tightest number 222 (27 px in the disc's 28, unchanged), closest nodes 56.5 px (302-303).
  0 console messages.

### 11. Known for the critic

- Pre-read flags still in, mild: 775 nb04 Snowy Owl (the upper owl a white shape on the sky band, the lower one's face just
  readable) and 776 nb09 Brown Pelican (a tan diagonal under a dark neck) read weakly; 771 nb18 Scarlet Ibis, a crimson wedge on
  cream, may read as a red slash at 375 (plumage, no wound); 769 nb49 Blue Heron has 3 stray navy/grey specks top right (the
  beak tip, its pale middle lost to the page; not lettering); 774 nb50 Scarlet Lily keeps Redouté's grey bulb and seed-pod studies
  as two grey smudges.
- No plate caption, plate number or script title survives in any board (every top and bottom row is page colour). No prey: the
  Golden Eagle and Barn Owl are out.
- Two pelicans (768 White, 776 Brown) and three Redouté flowers (773, 774, 777), titled apart and spread out.
- The desktop Next up card shows "Side quest 12" and the realm card an empty "Secrets found" line, as on Worlds 4-15 (LATER.md).

### 12. End state for the next land

Last record **777**, last sheet **103** (World 16's 2 sheets are 102-103), gal0 **62** (no side quests); Zen numbers end at
**627**, 577 records in zen.json. Seed `{from: 778, sheet0: 104, gal0: 62}`.
