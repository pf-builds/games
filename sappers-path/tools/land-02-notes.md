# Land 2 Snack Galaxy as Zen World 3: lane D notes (2026-10-06, stopped)

Lane D started installing Snack Galaxy as Zen World 3. Peter stopped it mid-bake: lane C (the art lane) is doing the
ink-outline rework of Snack Galaxy and Dino Valley itself. Nothing was installed. These notes are for whoever installs
World 3 after lane C delivers.

## What is on the branch

- `tools/gallery-config.json` `convert.kinds.outlined`: `{mask flood, box [40, 44], outline 1, margin 5, minDE 20,
  fadeDE 0, fadeFloor 16}`. This is lane A's exact text from `campaign-v6-quests`, with its `note`, so the hunk merges cleanly.
  A dry conversion of sg01's cleaned source gives 42x34, 7 colours, minDE 23.6, faded 18.2 and a 149-cell outline.
- `tools/land.js`:
  - `land.json` `"quests": "none"`: a land with no side quests. The Wandering Gallery's 12 pictures all belong to
    Kitten Forest, so World 3 has none. The check's side-quest gate then passes with none.
  - A new step, `zen`. After a passing check it writes the land into `levels/zen.json` only, using `land.json`
    `"zen": {"k": 3}`. The records keep their numbers (251-300), get ids `z3-1..z3-50` and `world: 3`, and drop
    `land`. The world entry carries its 7 sheets as layout entries (`map.layout`, each with its `eggCoins`). The sheets
    are copied into `map/` and the licence table goes into LICENSES.md. levels.json, gallery.json, layout.json and
    config.json are never touched, so the shared-file rule holds.
- **Not on the branch: the page half of that path.** `src/main.js` `modes()` needs one more branch for a world whose
  sheets live in zen.json. It goes after the `w.land` case:
  `: raw && w.map && w.map.layout ? w.map.layout.map((S) => Object.assign({}, S, { quests: S.quests || [], eggCoins: S.eggCoins || [] }))`.
  I reverted it because the branch must play exactly as 22aaf40. Note: World 3's numbers must stay 251-300. World 1
  uses 1-36, and the map's node lookup and `pos` key on `n`, so two worlds must never share a number.

## What the run learned (for lane C's rework and the next install)

1. **The outlined kind leaves far less room for mystery blocks.** `hidePic` never hides ink or a masked picture's
   ground, and the face mask removes the top half of the subject. At Kitten Forest's share (0.25-0.40 of the eligible
   blocks), 6 of 11 mystery-block levels fell under the 20-block floor ("no room for mystery blocks"). Raising the
   profile's `hidden.of` to 0.40-0.55 wasn't enough on its own. What worked was re-laying the pictures so every
   mystery-block slot holds a board with room for 24+ blocks at 0.45, and the moat-can status of each slot stays the
   same, so the plan doesn't change. My solver is in the session scratchpad and not kept. It's about 40 lines and easy
   to redo.
2. **A bug to know about: dark grounds lose their `bg` id.** When the converter lifts a dark ground off the ink (navy
   turns slate), `land.js boardOf` can't find `stats.bg` in the palette, so `board.bg` is 0. Then mystery blocks can
   land on the ground, and an ink check counts the whole outline as stray ink. It affected 12 of 50 picks (sg02, sg36,
   sg58, sg75, sg104, sg114 and other night grounds). Worth a fix in `boardOf`: match the lifted ground, or carry its
   id from `convert.js`.
   **Fixed (D3, 2026-10-07):** the root is convert.js step 7 (the fade-floor `lift`), which moves a colour's display
   lightness after the cells are final, so the pinned ground (and sometimes the ink) no longer matches `stats.bg` /
   `convert.ink`. `plan()` now returns `ids: {ink, bg}` (the pins' material ids, 0 when unused), and `land.js boardOf`
   and `shade.js shadeOf` take them by id. Re-measured at 0.45 (median of 5 seeds, live hidePic + faceOf on the board):
   kf34 Xylophone 29 (colour match 363), sg36 24 (235), sg58 0 (306), sg75 39 (312), sg104 100 (508), sg114 55 (394);
   sg02 was never lost on its current board (purple ground found, 63 either way), and sg48 is the sixth lost ground.
   The same lift moves the ink on 17 Kitten Forest and 6 Snack Galaxy outlined boards; by id they now skip it too, which
   lowers 8 Kitten Forest picks' room (kf54 28 to 24, kf56 21 to 19, kf100 98 to 61, kf20 32 to 30, kf62 41 to 37, kf95
   33 to 29, kf92 89 to 88, kf37 58 to 57; none newly under 24). Shipped data unchanged (every installed record's
   `convert.bg` is in its palette), but five shipped Campaign v6 quests have a lifted ink (cq09, cq12, cq14, cq24, cq34:
   black #110c17 / #17131c), so a re-bake of them through boardOf would now keep mystery blocks off the outline and
   give different levels. Their data is not touched. Shading: shadeOf skipped the ink by colour too, so on those
   lifted-ink boards it shaded the outline into three blacks (`sh` on the ink id). By id it no longer does: 17 Kitten
   Forest boards (kf03 kf09 kf16 kf20 kf23 kf24 kf28 kf37 kf38 kf45 kf54 kf56 kf62 kf74 kf92 kf95 kf100) and 4 Snack
   Galaxy boards (sg36 sg42 sg92 sg103) now convert with a solid black outline, grids unchanged, so lane C's
   `boards-ink/` and its `handoff-ink.js` 77/77 no longer match on those 17 (the install takes boardOf's output).
   Test: `tools/test.js` "lands (dark ground, D3)".
3. **Pace:** sg33 Egg choir (42x28 outlined) baked at 142 s on a Normal slot, under the 150 s floor. Boards of about
   1,100 cells and up met the pace (sg78 at 24x46 baked 234 s). sg69 Ice cream wizard (29x46) needed 16 extra
   candidates to reach 152 s.
4. **Deal failures:** sg83 Samosa (mystery + moat) and sg07 Kiwi (linked + moat, and again in a second slot) found no
   deal in 96 attempts. They need another slot or a swap.
5. **The pick review under the outline rule** (by eye: cleaned source, old painting board, outlined board):
   - **Floors:** 4 picks miss the 16 faded floor once outlined: sg09 Cherry twins, sg44 Karate onigiri, sg103 Waffle
     robot and sg106 Watermelon skate jump.
   - **Readability:**
     - sg55 Coconut hatch: the fig astronaut turns into a solid black silhouette.
     - sg17 Popping corn: the ground shadow becomes a black slab under the feet.
     - sg35 Meatball dunk: the hoop is lost.
     - sg91 Dango: a 42x21 board, too short for the pace.
     - sg98 Pepper siblings: the yellow pepper turns olive, and the 42x29 board misses the pace.
   - **The swaps I used:** sg02 Marshmallow moon nap, sg114 Pear ballet, sg32 Pineapple trumpet, sg66 Cake volcano,
     sg42 Walnut weights, sg05 Blueberry star hug, sg34 Cookie rock star, sg69 Ice cream wizard, sg53 Gingerbread
     landing and sg08 Sleeping-bag lemon.
   - **Ground shadows in other colours** survive the clean step and become slabs under the subject: sg41 brown, sg100
     red, sg112 green, sg23 grey.
6. **Eggs:** the map README's four new kinds (donut, alien, star, comet) aren't drawn yet, so I used glowcap, wisp,
   glint, ember and bubble. With no side quests, put the eggs on the painted quest spurs' tips (World 1's rule) so no
   spur leads nowhere.
7. **Payload:** the game folder without tools measures 18,339,923 bytes. World 3 would add about 690 KB (the sheets
   are 226 + 183 KB WebP, the records about 280 KB), for about 19.03 MB, under the 19.3 MB stop line.

## Where the stopped run's files are

- The land folder I built (`land.json` with the casual profile plus gentle moats, the manifest, sources, sheets,
  templates and scratch bakes) was moved out of the repo to the session scratchpad
  (`land-02-snack-galaxy-stopped/`). It's built on my outlined boards, so it's stale once lane C delivers.
- Outside the repo, in `game-research/sappers-path-v4/lands/02-snack-galaxy/`, I added `scripts/clean.py` (campaign-quests',
  unchanged), `scripts/run-ink.js` (the outlined kind), `scripts/preview.js`, `scripts/compose-ink.py`,
  `scripts/order-ink.py`, `scripts/order-ink.json`, `scripts/order-ink-2.json`, `boards-ink/` and `ink-results.json`.
  In `/Users/peter/local-ai/outputs/lands/02-snack-galaxy/` I added `clean/`, `preview-ink/`, `review-ink/` and
  `review-ink-spares/`. Lane C may want to reuse them or replace them.
