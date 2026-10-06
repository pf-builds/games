# Sapper's Path v6 lane B: Campaign and Zen modes (2026-10-06)

Brief: the orchestrator's lane B brief of 2026-10-06; spec: `game-research/sappers-path-v4/v6-plan.md`, "Lane B: UX
approved" (every bullet there is Peter's decision) and Step 0 (the Gallery split). Resume table: `tools/v5-progress.md`,
"v6 lane B". Shots: `tools/shots-zen/` (gitignored; `tools/shots-zen.mjs` remakes them). Dev server 8495 (worktree root,
game at `/sappers-path/`).

## 1. What the player sees

- **Home:** the painted home keeps its art. Play is now two cards, Campaign and Zen, side by side (down to 320 px). Each
  card is one button: its name, its progress line ("Fort 38 of 200"; "12 of 98 pictures", side quests included) and Play
  with the next level ("Level 38" or the boss's line; "World 2 · 5"), its tag chip as Play's. A tap plays that mode's next
  level. The mode played last is lit gold, the other is stone whatever its tag. The realm line above the cards is the lit
  mode's ("Realm 2 · Fenwater Vale", "World 2 · Kitten Forest"). The castle progress pill is hidden (the cards carry it).
  Still exactly two tabs, Map and Home.
- **Map:** the Map tab opens the mode played last. Where the map's title was, a two-way chip (Campaign | Zen) switches
  the map; the title stays for screen readers. Each mode's map is built when first shown and rebuilt on a switch (about
  25 or 12 sheets of DOM; nothing runs on scroll).
- **Campaign:** levels 1-200 and the castle Gallery's side quests on castle sheets 1-25; the map ends at the summit (the
  Goblin King by 200, the long tail's fog past it, as before the lands). Words unchanged: "Fort razed!", "Assault
  failed"; a side quest wins "Picture complete!" and fails "Assault failed". The boss's first win now says the road
  ends at the throne (`lands.epilogue.none`): the lands are Zen's.
- **Zen:** one journey of worlds from the same map code. World 1 The Gallery (36 pictures, no side quests) at the bottom
  on castle sheets 1-5 mirrored, World 2 Kitten Forest (201-250 and its 12 Wandering Gallery side quests) above on its
  own sheets. Every world's first level is open from the start; inside a world they open one by one. A world's levels
  are numbered from 1 on the map, the play bar and Play. Banners say "World k", the realm card "World k of t". No Goblin
  King, a calm story line, "More worlds on the way" in the fog. Every Zen level and side quest wins "Picture done" with
  "{title}, all dug out." (the finished picture on the report) and fails "A little stuck", the jam's reason, then "Have
  another look."; the win's beat has its dust and shake but no keep and no goblin (`board.js goblin(on, quiet)`); the
  Volley's tip names the picture, not the fort (`zen.text.powerTips`).
- **Music per mode** (`config audio.music.modes`, `audio.js pick`): the Campaign plays the theme on its map and carries it
  into its levels and side quests (realm 8 still takes the boss loop: a call, §8); Zen plays the calm level loop on its
  map and in its levels; the home keeps the theme.
- **Settings:** Reset asks which mode (a two-way choice, opening on the mode in use). Copy save code writes SP2.

## 2. Data files (all new except where named)

- `levels/zen.json` (one line, 118 KB): `worlds` (in order, bottom of the Zen map to top) and `levels` (World 1's 36
  records). A world: `k`, `name`, `lore`, `era`, then either `land: k` (its levels are `levels.json`'s with that land,
  its side quests `gallery.json`'s, its sheets `map/layout.json`'s, all as `tools/land.js install` put them) or
  `map.sheets: [{from, mirror, levels: [first, last]}]` (castle sheet `from`'s painting, road, eggs and level spots,
  its levels on that sheet's spots in road order). Zen ids `z<k>-<n>` (`bySlot`'s `/^e\d{1,2}-(\d{1,4})$/` can't match
  them). World 1's era is 101 (`100 + k` for a world of its own; a land world keeps its land's era, 8 + land).
- `tools/lands/z1-gallery/world.json`: World 1's bake input (profile, source ids, the level order `plan` chose).
- `tools/zen-world.js`: makes a Zen world from pictures the game already has (plan, bake, assemble, check, install into
  `zen.json`). A world from new pictures is a land (`tools/land.js`).
- `config.json`: a new `zen` section (save key, every Zen word) and `audio.music.modes`. Nothing else changed in config.
- **No shared one-line JSON changed:** `levels/levels.json`, `levels/gallery.json` and `map/layout.json` are byte-identical to
  b22e863 (`git diff --stat b22e863 -- ...` is empty). `map/zen-layout.json` was not needed: World 1's sheets are
  described inside its zen.json entry and resolved at run time from layout.json.

## 3. World 1 (The Gallery): the 36 re-dealt

The 36 Step 0 pictures (the everyday emoji and the 7 museum paintings) copied from `gallery.json` by id (title, kind,
src, credit, palette and board kept; `from` names the source) and dealt again with Kitten Forest's casual profile
(`tools/land-01-notes.md` §10.1) through `tools/land-bake.js bakeOne` (8 candidates a level, 10 a Hard; seeds from
1000 x k + i). Tags E13/N19/H4/X0, ending on a Hard; ? cards, linked pairs and mystery blocks light (fills 20+ from each
picture), no locks. The picture order: the busiest boards on the 4 Hard slots, the fewest colours on the Easy slots,
each tag's slots in the Gallery's own order (so kinds stay mixed). Check PASS on every gate in one run, no fallbacks:
stored order wins on its tag with no power-up, at most 5 spaces, longest tap 14.3-15.0 s, 38-55 taps, the steady 1 s
replay wins with no wait between taps over 15 s, real pace 161-261 s, **median 197 s** (gate 180-250 s: these are the
Gallery's 36 x 41-class boards, smaller than a land's max phone board, so the aim is the Gallery's 200 s, not a land's
225 s), re-grade 0 differences of 324 checks. Per-level table: `tools/lands/z1-gallery/scratch/report.md` (scratch;
regenerate with `zen-world.js ... check`).

## 4. The page (src/main.js unless named)

- `modes(raw, zen)` builds `app.modes.campaign` and `app.modes.zen` ({levels, order, gal, lay, eras, jr, save}; Zen also
  `worlds`, `info` (each level's world and number), `pos` (a level number's place in the Zen order)). `useMode(m)` swaps
  them onto `app` (so the existing code reads one mode) and remembers the mode in the Zen save. `startLevel` switches to
  a level's own mode first; `csave()`/`zsave()` give either save whatever the mode.
- Openness: a Zen order carries `starts` (each world's first id); `save.js isOpen` honours it. `nextOf()`: Zen continues
  in the world of the level last played, else the first open level not cleared. `focusOf()` centres the Zen map on it.
- Side quests in Zen: `questAt` reads a quest's `after` level by its place in the Zen order; quest nodes are found by
  picture number (`app.gal[q - 1]` was the castle's assumption).
- The campaign leaves out lands' levels, pictures and sheets, and the 36 pictures World 1 took (those named `from` in
  zen.json: trivial and keyed to my own file, as the brief allowed). So on this branch the campaign shows 24 side
  quests (Step 0's keepers) plus nothing for the 36 slots until lane A's 26 arrive.
- Egg ids: castle `s<sheet>-<i>` (unchanged); Zen `z<world>-<sheet in its world>-<i>`, coins from the sheet's own
  config `map.eggCoins` row (the castle sheet it reuses, or the land sheet's).
- Power-ups unlock by the Campaign's reach in either mode (the wallet is shared); a Zen-only player has the Ladder
  (unlocks at 1) and whatever Zen side quests give. A call, §8.
- A side quest a win just opened is scrolled into view on a short screen (`questsInView`), keeping the current node in
  view: selfTest's v5.1 check now exercises picture 2's spot (after level 8), whose node sat just below a 1280x720 view.

## 5. Saves and migration (src/save.js)

- `sappers-path.v3` stays the Campaign save and holds the **shared wallet** (coins, inv, got, lives) and the settings. It
  is sanitized against every level and picture the game has (lands too), so nothing in it is dropped while the campaign
  shows 1-200.
- `sappers-path.zen.v1` (config `zen.save.key`): `{v: 1, done, gal, eggs, best, last, moved, mode}`. `openZen` gives a data
  object whose wallet fields (coins, inv, got, lives, settings) are non-enumerable accessors onto the Campaign data, read
  at each access (a Campaign reset or load shows at once); `write()` writes the Zen key and the Campaign save.
- **The one-time move** (`zenMove`, run at boot when the Zen save has no `moved` flag, and on an SP1 code's load): a
  union, never removing anything from either save. Rules: a Gallery picture won in `gal` whose World 1 copy exists ->
  that `z1-<n>` cleared (no best row: it is dealt again); a land level in `done` -> cleared in Zen with its best row (same
  deal); a land side quest in `gal` -> won in Zen with its best; a land sheet's castle egg `s<sheet>-<i>` -> the Zen egg of
  that sheet; a campaign `last` that is a land level becomes Zen's `last` when Zen has none. Then `moved = 1`.
  Idempotent (a second run adds 0); safe on a fresh save (moves nothing, sets the flag), a format-1 v3/v4 save (masks
  read through `sanitize` first), a format-2 save, a renamed-slot save, and a blocked store (the memory-store fallback:
  a fresh Zen save, writes return false, never throws). A Zen reset keeps `moved`, so it never re-imports.
- **SP2 code:** `SP2.` + base64url(the Campaign body exactly as SP1's, then Zen: format, cleared levels as (world, number,
  best row), won pictures by their place in gallery.json with best rows, eggs (world, sheet, i), last (world, number)) +
  CRC-32. `decodeAny` reads SP1 (Campaign only; the page then runs the move on it, so an old code's Zen-bound progress
  arrives in Zen) and SP2. `decode()` alone still treats SP2 as "newer" (an old page).
- **Reset:** the sheet asks Campaign or Zen. Campaign: as v5.4 (its progress and the wallet; Zen stays). Zen: Zen
  progress only (the wallet and the Campaign stay).

## 6. How lane D adds a world (Snack Galaxy, Dino Valley, ...)

1. Build and install it as a land with `tools/land.js` exactly as `tools/land-runbook.md` says (it goes into levels.json,
   gallery.json, layout.json, config `lands.list`, LICENSES.md). Use a casual profile (Kitten Forest's).
2. Append one entry to `levels/zen.json` `worlds`: `{"k": 3, "land": 2, "era": 10, "name": "Snack Galaxy", "lore": "..."}`
   (era = 8 + land k; lore with no goblins, forts or assaults). Nothing else: its levels, side quests, sheets, eggs (ids
   `z3-<sheet>-<i>`) and egg coins come from the land's data. The campaign leaves every land out automatically.
3. Checks: test.js (its Zen section reads every world), selfTest (its Zen section plays every Zen level's stored order),
   regrades, freeze, critic-v5, harness. Bump the cache tag.
A world of pictures the game already has: a `world.json` and `tools/zen-world.js` (plan, bake, assemble, check, install),
then an entry with `map.sheets` (castle sheets reused mirrored; no new image bytes).

## 7. What lane E must do at merge (campaign-v6 into sappers-path)

- `levels/gallery.json` comes from lane A (the 36 removed, 26 new added). **Zen World 1 does not depend on gallery.json:**
  its records carry their own boards and palettes. But `from` (each World 1 record's source id) drives two things that
  must be re-checked after the merge: (a) the campaign's run-time filter of the 36 (a no-op once lane A removed them);
  (b) the move's picture rule, which reads `gal[<old gallery id>]` from old saves; it keeps working as long as the old
  ids are the ones lane A removed (they are never re-used for new pictures). If lane A renumbers or re-ids pictures,
  `save.js` SP2 still encodes pictures by their place in gallery.json; a code made before the merge then maps to the new
  order (the same issue the SP1 code has for any gallery change; worth a line in lane E's checks).
- test.js "zen World 1 (Step 0)" asserts the campaign keeps exactly the 24 named pictures among gallery n <= 60; after
  lane A it should read "the 24 plus lane A's 26": update that one check.
- selfTest's campaign map checks read the campaign picture list generically (e0 = the first campaign picture), so lane
  A's list should pass as is; its long-tail checks assume at least 5 tail pictures.
- `levels/levels.json` 1-200 come from lane A; Kitten Forest (201-250) stays as on this branch. The freeze baseline is
  re-taken at ship (Peter's one-time lift): 1-200 from lane A; zen.json's World 1 and 201-250 are not in it yet.
- config.json: both lanes edited it; mine are the new `zen` section and `audio.music.modes` (text-local, easy to merge).
- The epilogue: the campaign's boss now says `lands.epilogue.none`; lane A owns campaign texts and may reword it.

## 8. Calls I made

1. World 1's median pace gate 180-250 s (land gate 200-250): the Gallery's boards are smaller; median 197 s.
2. Hid the 36 from the campaign on this branch (keyed to zen.json `from`), rather than showing duplicates.
3. Kept the boss loop in realm 8 under "Campaign carries the map track into its levels".
4. Power-ups unlock by the Campaign's reach in Zen too.
5. Zen level numbers count from 1 in each world; World 2 shows 1-50 (ids stay e9-201..).
6. The castle progress pill on the home is hidden when Zen exists; the cards carry progress.
7. World 1's map: castle sheets 1-5 mirrored (8, 8, 8, 8, 4 levels); their painted quest spurs stay (no nodes on them);
   eggs keep each sheet's own kinds and spots; config bridges follow the mirrored road.
8. SP1 load replaces Zen with what the move derives from the code (a load replaces the device's progress).
9. The Zen fail line keeps the jam's reason (chips) and adds "Have another look." after it.

## 9. Checks (final)

See `tools/v5-progress.md`, "v6 lane B", row B9 for the numbers of the final run.
