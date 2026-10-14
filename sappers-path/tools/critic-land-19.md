# Critic: Zen World 16 The Naturalist's Book (v7 lane D), 2026-10-14

Build: the exported snapshot of commit 8f2f69b (`scratchpad/w16-critic/sappers-path/`). The snapshot has no `.claude/`, so I served it from the snapshot dir on 127.0.0.1:8559 with the threaded `/Users/peter/Documents/Claude/.claude/serve.py`. No file failed to load. The server was killed afterwards. Shots and data are in `tools/critic-land-19/` (untracked). Nothing else in the worktree was touched. The harness is the World 15 critic's, retargeted (`boards.mjs`, `func.mjs`, `back.mjs`, `blind.py`, `zoom2.py`), plus `wins.mjs`, which wins all 11 and reads each win line. All of it is in the session scratchpad `w16run/`.

Numbering: records 767-777, Zen 617-627, ids z16-1..z16-11 (Zen = 616 + N). **Every fix is keyed by plate id (nbNN), as same-count swaps.**

## selfTest
`tools/selftest-lands.mjs` on the snapshot (page wait raised to 60 s): **375x812@3 924 passed / 0 failed; 1280x720 926 / 0; 0 console messages.**

My own runs logged **0 console messages and 0 page errors**. They covered all 11 boards at 1x, all 11 won with their winOrder, the opener won with real taps, a loss, Retry, a second loss and Back to map, the in-play map button, and the map at 375@3 and 1280.

## Counts
BLOCKER 0 · MAJOR 2 · MINOR 6

## How the boards were judged
Each board was loaded in play at 375x812 (DPR 1, touch) and captured as `#board` at CSS size. The plates keep their own aspect, so the boards run from 241x393 to 289x393 portrait, and 621 is landscape at 337x289. I judged from the numbers-only sheet (`blind-1.png`) and wrote each blind read down before printing titles. Then I checked each against the 1.3x nearest-neighbour zoom (`zoom-a.png`: 621 619 625 626). One note on the blind sheet: 621 is landscape, so it's clipped by its neighbour there. I judged it from `boards/b05.png` and the zoom. These plates were new to me.

All 11 are single-subject plates: 8 birds and 3 flowers. The portrait-versus-scene split doesn't apply.

**Result: 8 read, 3 weak, 0 mud (73%).**

| Zen | Level | Id | Title, painter | Tag | Ring | Rating | Blind read, then reason |
|---|---|---|---|---|---|---|---|
| 617 | 767 | nb01 | American Flamingo, Audubon | N | | reads | A pink flamingo with its neck bent down, on a grey-green shore. A fine opener |
| 618 | 768 | nb28 | American White Pelican, Audubon | E | | reads | A white pelican with a yellow bill on dark slate. Excellent |
| 619 | 769 | nb49 | The Blue Heron, Catesby | N | | reads (borderline) | A navy-blue heron on a gold ground. The pale bill is lost to the page; 3 stray navy cells sit top right (m3) |
| 620 | 770 | nb55 | Eclectus Parrots, Lear | E | | reads (borderline) | Two green parrots with red on a branch, with the sky and grass bands |
| 621 | 771 | nb18 | Scarlet Ibis, Audubon | N | | **weak, and see M1** (builder flag) | Blind: "a red wedge, a red bird?" A crimson diagonal tapering to a pink tip, with thin pink legs hanging below it |
| 622 | 772 | nb06 | Blue Jay, Audubon | H | | reads (borderline) | Blue birds among grey-green branches. Busy, but the blue jays come through |
| 623 | 773 | nb52 | Crown Imperial, Redouté | E | | reads | An orange bell-flower under a leaf crown on a tall stalk |
| 624 | 774 | nb50 | Scarlet Lily, Redouté | N | ring | reads (borderline) | Red lily heads on a long stem, ringed. Two grey smudges sit beside it (Redouté's bulb studies, m6) |
| 625 | 775 | nb04 | Snowy Owl, Audubon | E | ring | **weak** (builder flag) | Blind: "a white shape on the sky band, a grey-brown mottled mass below". The upper owl dissolves into the sky and the cream page; the lower owl is a mottled block. The ring hangs from the top edge (m1) |
| 626 | 776 | nb09 | Brown Pelican, Audubon | N | ring | **weak** (builder flag) | Blind: "a brown long-billed bird on a diagonal, ringed". A tan diagonal under a dark neck; the pelican's pouch and head don't separate |
| 627 | 777 | nb53 | Empress Josephine Rose, Redouté | H | | reads | A pink rose with leaves on the cream page. A clean closer |

Hards: 622 is borderline, and 627 reads.

### Background types (information for Peter)
- **4 band edits** (cream page split into a sky band and a grass band): 620, 623, 624 and 625. They match the 4 "Adapted for the board" rows exactly. The bands help the flowers (623, 624) but not the snowy owl: a white owl on a pale sky band is the pale-on-pale failure again (625).
- **7 keep the plate's own ground:** 617 (shore), 618 (slate), 619 (gold), 621 (shore and hills), 622, 626 and 627 (the cream page).

## MAJORS

**M1. 621 nb18 Scarlet Ibis: a crimson slash with drips (builder flag).** Repro: `?debug=1`, `SP.load("z16-5")` at 375x812. See `boards/b05.png` and `zoom-a.png` (left).
- The bird is a solid crimson wedge running diagonally across the cream page, about 20x14 cells, tapering to a pale pink tip.
- Below it, 3-4 thin pink vertical lines (the legs) hang down onto the brown ground.
- At 1x the head doesn't separate. So a child or a portal reviewer sees a red slash with pink drips, not a bird.
- It is plumage, and there's no wound in the plate. But the read is the problem, and a recolour can't fix it without losing the subject.
- **Fix: same-count swap** for another plate.

**M2. 3 of 11 plates are weak (27%), all builder-flagged:** 621 (above), **625 nb04 Snowy Owl** and **626 nb09 Brown Pelican**. In an 11-board world each one weighs heavily. The two Audubon water birds that read (617, 618) are big, single and high-contrast against their ground; 625 and 626 are neither. Fix: same-count swaps if the plate pool has spares (any big single-bird Audubon plate on a contrasting ground). If not, they can stay; 625 also needs m1.

## MINORS
- **m1. Rings.** Three boards carry a ring: 624, 625 and 626.
  - **625 nb04:** the ring's two legs start at the top edge and run down through the sky band either side of the upper owl (`zoom-a.png`, third). They read as two blue lines hanging from the top. If nb04 stays: `moatSkip` nb04 and re-bake 775.
  - **624:** the ring is a long narrow loop down the lily stem. It follows the stem, so keep it.
  - **626:** the ring frames the whole bird, so keep it.
- **m2. Licence rows: engravers and years.**
  - The six Audubon rows name the engraver: "engraved by Robert Havell". The plate years are right for the Havell edition of *The Birds of America*: 1838 Flamingo, 1836 White Pelican, 1837 Scarlet Ibis, 1831 Blue Jay, 1831 Snowy Owl, 1835 Brown Pelican.
  - Catesby (1731-43, *Natural History of Carolina*; he etched his own plates) and Lear (ca. 1830-32, *Psittacidae*; he drew his own lithographs) need no separate engraver.
  - **The three Redouté rows (623, 624, 627) give the painter and years** (1802-16 *Les Liliacées*, 1817-24 *Les Roses*) **but no engraver.** Those plates were stipple-engraved by others. Optional: add the engraver from the museum record, where the record names one.
- **m3. 619 nb49 Blue Heron:** 3 stray navy cells at the top right, part of the bill tip whose pale middle is lost to the page. They're not lettering, but they read as specks. Optional: clean them in `edits.json`.
- **m4. The book-page tint.** Sheets 4 and 6 sit under `sepia(0.5) saturate(1.15) hue-rotate(-4deg) brightness(1.22) contrast(0.9)`. At 375 the map reads as an aged sage and cream page with soft teal rivers (`phone-4.png`: join, middle, top).
  - **It's distinct** from Safari's gold below the seam and from Farm Friends' saturated green.
  - **It's readable:** the cream road, its dashes and the node discs all stand out.
  - It looks more sage than "cream" because the sheet's own fields show through. That's fine for a naturalist's book. No action.
- **m5. Carry-overs:** desktop "Side quest 12 ... Quartermaster +1", the empty "Secrets found" line, and 0 coins on the realm card (LATER.md).
- **m6. 624 nb50 Scarlet Lily:** Redouté's two grey studies of the bulb and seed pod are two grey smudges beside the stem. They're harmless and part of the plate. No action.

## Kid and portal safety, the rest
- **No lettering.** No plate caption, plate number or script title survives: every top and bottom row is page colour, checked on all 11 at 1x and on the zoomed four.
- **No prey and no blood**, apart from M1's read. The Golden Eagle and Barn Owl plates are out. 617's flamingo has a few dark red cells on the neck, which are plumage and read as shading.
- **No look-alikes:** these are museum plates.

## Checks that passed
- **Win lines, all 11, read "{title} by {painter}, all dug out."** For example "American Flamingo by John James Audubon", "The Blue Heron by Mark Catesby", "Eclectus Parrots by Edward Lear", "Crown Imperial by Pierre-Joseph Redouté", and the closer "Empress Josephine Rose by Pierre-Joseph Redouté".
- **Opener at 375@3, real taps:** "Play picture 617" opened z16-1 "617 American Flamingo". 52 real taps gave "Picture done", "**American Flamingo by John James Audubon, all dug out.**", and Back to map / Retry (`win-375.png`).
- **Loss, Retry, Back to map at 375@3, real taps:**
  - 627 Empress Josephine Rose (Hard) took a 17-tap lossPlan and gave "A little stuck", HARD, "Line jammed: Dark green, Blush and Rose can't reach a block. Have another look.", with Continue 250 / Retry / Back to map (`fail-375.png`).
  - Retry restarted z16-11 at 0 plays.
  - A second loss, then Back to map, showed the map (`jr: true`) with "Picture 618" current (`back-map-375.png`).
  - The map's Play loaded 618, and the in-play map button returned to the map.
  - 0 console messages.
- **The 15→16 join (375):** 615-616 are done on Safari's gold sheet, 616 Hard. Then come the banner "WORLD 16 The Naturalist's Book", and 617 current with "Picture 617" and "Play picture 617" on the book-page sheet (`map-join-375.png`). It's a clean change. No horizontal overflow.
- **The world end:** 623-627 sit on the top sheet, 627 is the last node (627 nodes), and "More worlds on the way" sits in the fog above it (`map-top-375.png`).
- **Numbers fit their discs:** the tightest World 16 number is 27 px in the disc's 28 (1 px spare): 622 at 375, 623 at 1280. The closest nodes are 620-621, at 60.6 px (375) and 69.4 px (1280). Nothing overlaps.
- **1280 map:** the realm card reads "WORLD 16 OF 16 The Naturalist's Book" with the lore ("The road wanders through an old naturalist's book of hand-coloured plates: flamingos, herons and pelicans by the water, a snowy owl, parrots and a jay, and a few garden flowers ..."), and 622 current (`map-1280.png`).
- **Credits line:** it ends "... Safari: ... **The Naturalist's Book: natural-history plates by John James Audubon and others from the National Gallery of Art, The Met and Cleveland Museum of Art open access (CC0); some adapted for the game by Click it! Studios.**" In order, after World 15.
- **LICENSES.md:** the section "Zen World 16: The Naturalist's Book (Land 15, levels 767-777 ...)" has its credit line and **11 rows**, 617/767 to 627/777. Each has the painter, the year, the engraver where it applies (m2), the CC0 source, the museum link, and an "Adapted" note on exactly the 4 band-edited plates.

## Verdict: **ship after fixes**

**Blocking (the ship list):** **M1 nb18 Scarlet Ibis**, a same-count swap. The red-slash-with-drips read can't be recoloured away.

**Non-blocking:** M2 swaps for nb04 and nb09 if the pool has strong single-bird spares; otherwise `moatSkip` nb04 (m1). Optional: the m2 Redouté engraver credits and the m3 heron specks.

### One list (all fixes, by id, same-count)
| Priority | Id | Title | Now (Zen / level) | Fix |
|---|---|---|---|---|
| **Ship fix** | nb18 | Scarlet Ibis | 621 / 771 | Same-count swap (it reads as a red slash with pink drips) |
| 1 | nb04 | Snowy Owl | 625 / 775 | Same-count swap (white owl on a pale sky band); if it stays, `moatSkip` + re-bake (the ring hangs from the top edge) |
| 2 | nb09 | Brown Pelican | 626 / 776 | Same-count swap (the bird doesn't separate) |
| optional | nb49 | The Blue Heron | 619 / 769 | Clean the 3 navy specks at the top right |
| optional | nb52, nb50, nb53 | Redouté plates | 623, 624, 627 | Add the engraver to the licence rows |

## Files (tools/critic-land-19/)
- `blind-1.png`: the numbers-only sheet (621 is clipped there; see `boards/b05.png`)
- `boards/b01..b11.png` + `meta.json`: the 11 boards at CSS size
- `zoom-a.png`: 621 619 625 626
- `map-join-375.png`, `map-mid-375.png`, `map-top-375.png`, `phone-4.png` (join, middle, top and fail at CSS size), `map-1280.png`
- `win-375.png`, `fail-375.png`, `fail2-375.png`, `back-map-375.png`
- `func.json`
