# Critic re-check: Zen World 5 Masterpiece Gallery after rounds 2-3, 2026-10-10

Build: branch sappers-path, head c0e5666, served on 127.0.0.1:8508 (Playwright chromium; server killed after). Setup under `?debug=1` (SP.zenTo, SP.load, SP.winOrder, SP.lossPlan); map and level-open shots on the plain URL. Shots, composites and raw data in `tools/critic-land-06-recheck/` (rc1.json, rc2.txt, boards/z5-01..50.png).

## selfTest
`tools/selftest-lands.mjs --url http://127.0.0.1:8508/`: 375x812@3 **880/0**, 1280x720 **882/0**, 360x640@3 (`--small`) **880/0**, 0 console messages. My own three scripts: **0 console messages, 0 page errors**.

## Counts
BLOCKER 0 · MAJOR 0 · MINOR 4 (all new or carried, none blocking)

## Earlier findings

**B1 credits: CLOSED.** Plain URL, Map, Zen, foot of map (`#map-credits`, shot `credits-zen-375.png`): the Gallery line, then "Masterpiece Gallery: Public domain paintings from the Art Institute of Chicago, National Gallery of Art, The Met and Cleveland Museum of Art open access (CC0)." All four museums named. Toggle to Campaign: the line is the unchanged `gallery.credits` (Twemoji, Noto, The Met) with no World 5 line; toggle back to Zen and it returns. zen.pk.json: only world 5 carries `credit`; worlds 1-4 null, so their credit text is the same as before. No overflow (credits box 347 px wide, page scrollWidth 375).

**B2 La Grande Jatte: CLOSED (on Peter's series design), one MINOR left.** `comp-series-375.jpg`, `comp-series-1280.jpg`, `comp-wins-fail.jpg`.
- 352 / Zen 202 (mg003, the parasol couple, 32x46): yes, someone who knows the painting names it. The woman's bustle profile is one big slate shape on the lawn, the top-hatted man is the black column beside her, the parasol is the dark mass top right. Contrast between her slate dress and the dark-green shade band is low at 375, but the silhouette holds; on the win-sheet thumbnail it reads instantly.
- 351 / Zen 201 (mg003c, the left bank, 36x46): not unaided. It's a busy park scene (water top left, standing orange figures, the dark reclining group, the orange lady at the bottom). A fan would say "a Seurat park" before "La Grande Jatte". As part 1 of a titled series that 202 resolves one tap later, it does its job. See m1.
- Series: titles "La Grande Jatte (1 of 2)" / "(2 of 2)", win lines "...(1 of 2) by Georges Seurat, all dug out." / "(2 of 2)...". Same palette family across the pair. Map: 201 and 202 consecutive on the same sheet just above the World 5 banner, no sheet join between them; node distance 74 px at 375 and 86 px at 1280 (202-203: 66 / 76), so they sit side by side like any pair (`comp-map-series.jpg`).

**M1 mud boards: CLOSED.** Every changed board judged against its source on `comp-changed-a.jpg` / `comp-changed-b.jpg` (source left, in-game frame at 375 right). Note: the brief's list uses round-2 numbers; after round 3's shift, 352-370 moved down one and Water Lilies (old 371) left the world. Verdicts by current number / map id:

| Level | Id | Picture | Recognisable | Note |
|---|---|---|---|---|
| 359 | mg001 | Woman with a Parasol | weak | green parasol reads; figure still dissolves into the clouds (m2) |
| 360 | mg073 | Arlesiennes | yes | two shawled women, low fame |
| 363 | mg085 | Woman with Red Hair | yes | head and hair whole now (old m5 closed) |
| 367 | mg012 | The Boating Party | weak | pink baby and green boat; mother and oarsman blur (m2) |
| 368 | mg024 | The Eagle (swap) | yes | diving eagle clear; won in play |
| 374 | mg076 | Madame Cezanne (swap) | yes | face and red dress, ring around her |
| 379 | mg032 | Japanese Footbridge | yes, borderline | blue rail bands over the green pond; no arch in the crop |
| 380 | mg123 | Girl in Green | yes | head whole now (bad crop closed) |
| 381 | mg048 | The Letter (swap) | weak | dark hair and blue dress; face and letter melt into the beige wallpaper (m2) |
| 382 | mg056 | Children on the Beach | yes, borderline | girl in white with pail |
| 385 | mg058 | Allies Day | yes | stars, stripes and the red ensign |
| 388 | mg018 | The Child's Bath (swap) | yes | mother, child, striped dress |
| 391 | mg049 | The Acrobats (swap) | yes | two girls in costume on yellow |
| 392 | mg025 | The Asakusa Cat (swap) | yes, borderline | cat on the sill under the window grille |
| 393 | mg093 | Kohada Koheiji (swap) | yes | the big skull face |
| 394 | mg031 | Basket of Apples | yes | basket, bottle, apples, cloth |
| 397 | mg010 | Sudden Shower | yes, borderline | bridge arc and walkers; still no rain lines |

0 mud, 0 heads cut off. 14 yes (5 borderline), 3 weak (nameable with the title). Before: 9 unreadable plus one headless. That clears the major.

**m1 (old) titles at 375: CLOSED.** All 50 levels loaded at 375x812 and 360x640: `#lvl-name` scrollWidth never exceeds clientWidth (0 overflows). Smallest title font 14.2 px at 375 (202) and 15.9 px at 360 (202); the old 9 px shrink is gone.

**M2 tinted map, m2 Next up side quest:** Peter accepted / known. Still present (Next up on the 1280 map reads "Side quest 12 ... Quartermaster +1"), not re-graded.

## Play
- Win 351 (Zen 201): 49 taps, "Picture done / La Grande Jatte (1 of 2) by Georges Seurat, all dug out."
- Win 352 (Zen 202): 40 taps, "(2 of 2)" line.
- Win swapped 368 The Eagle: 49 taps, "The Eagle by Utagawa Hiroshige, all dug out."
- Fail 381 The Letter (swapped) via lossPlan prefix 0042222123103201: status failed / jam, "A little stuck", "Line jammed: [5 chips] can't reach a block. Have another look.", Continue 250 and Retry offered (`comp-wins-fail.jpg`).
- Plain URL: map Play opens 201 then 202 with the right bar at 375 and 1280.
- Regression: Campaign level 30 (e2-30) won, "The goblin king flees. Level 30 cleared." Zen World 4 #25 won, "Ballet stegosaurus, all dug out."
- 0 console messages across all runs.

## MINORS
- **m1. The world still opens on its least readable La Grande Jatte half.** 201 (left bank) is a generic park scene unaided and is also the long deal: 49 taps, longest tap 14.95 s (notes §00). Peter chose this order; the cheap mitigation is wording, e.g. map label or lore line hinting "in two halves". Repro: plain URL, Zen map, Play picture 201.
- **m2. Three swapped/re-cropped boards are only nameable with the title:** 359 Woman with a Parasol (figure lost in clouds), 367 The Boating Party, 381 The Letter (face melts into wallpaper). Evidence `comp-changed-a.jpg`, `comp-changed-b.jpg`. Polish, not mud.
- **m3. 352's dress vs shade band contrast** at 375 is low (slate on dark green), so the couple reads as one mass rather than two figures. Evidence `comp-series-375.jpg` right.
- **m4. Brief/notes numbering drift:** the critic brief's M1 list (358, 359, 362, 366, 367, 371...) is round-2 numbering; after round 3 those are 359, 360, 363, 367, 368, and 371 is no longer Water Lilies. Docs only; anyone using the brief's numbers will check the wrong boards.

## Verdict
**Ship.** B1, B2, M1 and the title clip are closed; no new blockers or majors; selfTest clean at three sizes, 0 console errors.
