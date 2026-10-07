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
  on reused sheets (§10), World 2 Kitten Forest (201-250 and its 12 Wandering Gallery side quests) above on its
  own sheets (fix pass: World 1 now reuses Kitten Forest's two sheets in a turn of its own, see §10). Every world's first level is open from the start; inside a world they open one by one. A world's levels
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
  `map.sheets: [{from, mirror, fade, tint, levels: [first, last], spots, eggsAt, eggKinds}]` (layout sheet `from`'s painting, road and level spots,
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
  config `map.eggCoins` row (the sheet it reuses).
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
then an entry with `map.sheets` (existing sheets reused; no new image bytes).

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

### 7.1 Merge pass: saves that survive lane A (2026-10-06)

Lane A (campaign-v6-quests, 25cbd94..f4b4a60) removes the 36 from gallery.json, adds 26 new campaign quests (`g-ours-cq*`,
no id reused), moves the Wandering Gallery (n 61-72) to file places 51-62 and leaves the campaign with no long tail.

- **The move reads the raw save.** `save.js rawOf` gives the stored Campaign save as parsed, before `sanitize` (which keeps
  only ids gallery.json still has). At boot the move runs on the raw save, then on the sanitized one (renamed slots).
  The same for a loaded code: `decodeAny` returns `raw` (the code's Campaign part before sanitize). The memory-store
  fallback has no stored save, so nothing to move. `zenMove` takes any shape (non-objects read empty, best rows only from
  a format-2 save, never throws).
- **`levels/places.json`, the save codes' picture places.** Append-only: the 72 v5.4 places first (byte-for-byte
  gallery.json's order at b22e863, the frozen 60 then the Wandering Gallery, and identical to lane A's `quests.json
  v5Places`: checked), then lane A's 26 new ids appended in lane A's gallery.json order. SP1 codes decode through it (so a
  v5.4 code's place 1 is Pizza Slice, not whatever sits first now); SP2 encodes and decodes pictures by it (SP2 never
  shipped, so its numbering changed on this branch only). The page appends any gallery id the registry lacks, in
  gallery.json order, as a safety net; test.js fails while one is missing.
- **No long tail:** with no picture past 200, the Campaign map draws no stepping stones, no fog, no node (`tailE()` empty);
  selfTest's long-tail block checks that case and skips the rest.
- **Proof against lane A's data** (test.js, "merge:"): `tools/fixtures/lane-a-gallery.json` is lane A's gallery.json. An old
  v5 save (two of the 36, a kept picture, picture 61, 201-202, a Kitten Forest egg) loaded on lane A's Gallery: the 36's
  clears land in World 1, the Campaign keeps its own, 61 lands in Zen; an SP1 code made on v5.4 decodes to the right ids
  under lane A's order (read by gallery order it would credit the wrong pictures); SP2 round-trips under both orders and
  a code made here loads there; lane A's campaign has 0 tail pictures. Also smoke-run in the page on a copy of this branch
  with lane A's gallery.json and layout.json: the old save moved (z1-3, z1-9, 201, picture 61, the egg), no fog, no tail
  stones, 0 console messages.

### 7.2 Lane E merge checklist

1. Merge campaign-v6 / campaign-v6-quests into sappers-path. Take lane A's `levels/gallery.json`, `levels/levels.json`
   1-200, `map/layout.json` and its main.js selfTest edits for the empty long tail (v5.1's "next node after the win" and
   the long-tail block); keep this lane's `levels/zen.json`, `levels/places.json`, `src/save.js`, the `zen` config
   section and every lane B edit in main.js. Where both edited the same selfTest line, keep both behaviours.
2. `levels/places.json`: already holds lane A's 26 ids. If lane A's final gallery.json has any id not in it (a swap from
   the spares), **append** it at the end; never reorder or remove (test.js "places.json" fails until it is there).
3. test.js "zen World 1 (Step 0)" asserts the campaign keeps exactly the 24 kept pictures among gallery n <= 60: change it
   to the 24 plus lane A's 26 (or drop it in favour of lane A's own list check). Then re-point the "merge:" fixture tests
   at the real gallery.json (they should pass unchanged; the fixture can stay as the record of lane A's order).
4. Run test.js, freeze (re-take the baseline at ship), regrades (levels, `--gallery`, `--zen`), critic-v5, selfTest at
   375x812, 1280x720 and 360x640, harness last (its v6 old-save block seeds two of the 36: they must arrive in Zen).
5. Seed a real v5.4 save and an SP1 code from the live game on the merged build; check Zen's card counts them.

## 8. Calls I made

1. World 1's median pace gate 180-250 s (land gate 200-250): the Gallery's boards are smaller; median 197 s.
2. Hid the 36 from the campaign on this branch (keyed to zen.json `from`), rather than showing duplicates.
3. Kept the boss loop in realm 8 under "Campaign carries the map track into its levels".
4. Power-ups: superseded by the fix pass (§10): one reach for both modes, owned ones always shown.
5. Zen level numbers count from 1 in each world; World 2 shows 1-50 (ids stay e9-201..).
6. The castle progress pill and the realm banner on the home are hidden when Zen exists; the cards carry both.
7. World 1's map: superseded by the fix pass (§10): Kitten Forest's sheets, eggs on the spur tips.
8. SP1 load replaces Zen with what the move derives from the code (a load replaces the device's progress).
9. The Zen fail line keeps the jam's reason (chips) and adds "Have another look." after it.

## 9. Checks (final)

See `tools/v5-progress.md`, "v6 lane B", rows B9 and C9 for the numbers of the final runs.

## 10. Fix pass after the critics (2026-10-06; `tools/critic-zen-functional.md`, `tools/critic-zen-visual.md`)

Peter's two calls during the pass: both home cards gold, the last played marked by something other than colour; World 1
on Kitten Forest's sheets (the mirrored castle sheets read as the Campaign map).

- **Power-ups (functional MAJOR-1):** one reach for both modes: the Campaign's reach (its first open level not cleared)
  plus every Zen picture done (main levels and side quests), against the same `unlockAt` numbers. A Zen-only player opens
  the Ladder at once, the Quartermaster at 24 pictures, the Recall at 49; the Scout (100) and the Volley (125) need some
  Campaign too, or a Zen prize: **any power-up the player owns shows its badge** (and keeps it for the level once its last
  one is used), so no prize lands in a hidden slot. A Zen side quest's win sheet names its prize ("..., all dug out. Side
  quest prize: +1 Volley"). Calls: the mapping (one picture = one level of reach) is mine; selfTest checks the
  Quartermaster opening at 24 Zen pictures with nothing in the Campaign.
- **Home cards (visual M1, m1, m2; Peter):** both cards gold from the first launch. The mode played last wears a cream
  ring, sits 3 px higher and carries a "Continue" chip on its top edge. Each card holds its own place line (Campaign: "Realm
  2 · Fenwater Vale"; Zen: "World 1 · The Gallery"), its progress, and Play with its tag inline (a long label puts the tag on
  the line below). A Hard level no longer turns the card red; its tag says Hard. The realm banner over the cards shows only
  when Zen doesn't exist.
- **World 1's map (visual M2, M3; Peter):** Kitten Forest's sheets `land-01-b`, `-a` in the turn B', A', B, A', B (World 2
  starts on A, so the join never shows one sheet twice; no two neighbours share a file), crossfaded seams like Land 1's, and
  a light warm tint (`tint`, a CSS filter) so World 1 reads apart from World 2. Zero new image bytes. 36 levels: 8 on the
  first sheet, 7 on each other (spot 5 skipped: measured, it leaves no gap wider than a sheet join), so level 36 sits at
  the top of the last sheet and World 2's banner follows at once (no empty road, no orphan fork). Every sheet's two eggs
  sit on its painted side-quest spurs' tips (`eggsAt: "quests"`, the same spots World 2's side quests use), kinds
  butterfly, mushrooms, owl, glint, yarn, grass, glowcap, wisp, kitten, butterfly: every spur leads to something.
- **Campaign end (visual M4):** with Zen on, the Campaign map's road stops at level 200 by the Goblin King: no mist, no
  puffs, no "The road goes on". The castle Gallery's long-tail pictures (6 on this branch) open as before once 1-200 are
  cleared; their node keeps its spot and a stepping-stone path from 200 to it shows only then. Mode-scoped (`ends` in
  buildMap). **For lane A/E:** if lane A keeps a long tail, it shows this way; if it drops it, nothing past 200 shows at
  all. The painted fog at sheet 25's top stays (art).
- **Words (m3, MINOR-1):** a Zen stop is a picture everywhere: node labels and the current-node label "Picture n", Play
  "Play picture n", the home "Picture n"; a Zen side quest is "Side quest n" (numbered in its world). The board's label in
  Zen is "The picture"; the Volley badge's label uses Zen's tip.
- **Reset (MINOR-2, m6):** three choices, Campaign, Zen and Everything. A single mode's reset never touches the shared wallet
  (`save.js resetCampaign` keeps coins, power-ups, unlocks and lives); Everything is v5.4's full wipe of both modes and the
  wallet (the only one that tells the cloud hook). The choice has room above and below it; it fits 320 px.
- **Tap sizes (m7, MINOR-3):** the home's gear and the map bar's Back and gear are 44 x 44 at every size.
- **Tips (m8):** a power-up's tip is put away when a win or fail sheet opens, so it never covers the finished picture.
- Skipped as briefed: m4 (mirrored sheets accepted), m5 (the painted home stays).

## 11. Fix pass: the map's width and the tour's load (2026-10-07)

- **Side cards only with room (Peter's desktop playtest).** The home and the map sat in `#app`'s 560 px column until the
  wide play layout switched on (aspect and width), while the map's side cards switched on at a fixed 1,100 px window:
  between the two the cards were clipped behind the map and the top bar shrank to 560. Now `#title` and `#map` always
  fill the window (`position: fixed; inset: 0`), and the cards show only when the map's real width holds the column
  (430 + 6), a gap and a card each side and a 16 px edge (`map.cardEdgePx`: 1,096 px), and both cards fit its height
  (`fitCards`, after a render; a resize asks again). Otherwise one column with the Play bar at its foot.
- **Sweep** (`tools/sweep-map.mjs`, sheets in `tools/shots-zen/sweep/`): widths 700-1,700 by 50 at heights 720, 900 and
  1,300, DPR 1, no touch, the window resized in place, both modes: every card hidden or whole in the window and clear of
  the column, the top bar the window's width, Play hittable, the home filling the window with both cards hittable.
  126 checks, 0 failures (cards from 1,100 px). The same sweep on e8210a6: 120 failures (top bar 560, home in a column,
  Play clipped at 1,300 x 1,100-1,250).
- **The tour at 1280x720.** `selftest-lands.mjs` calls `SP.selfTest()` the moment `window.SP` exists; the tour fetched
  `levels/tutorial.json` without boot waiting for it, so on the slower first desktop load the check ran first (not a
  merge loss: hooks, config and index.html were intact). `tutorial.js` now returns its load as `ready`, and boot awaits it
  before handing out `SP` (a failed load still resolves: no tour). selfTest 805/0 at 1280x720; Settings > How to play
  starts the tour there (shot `tools/shots-zen/sweep/how-to-play-1280.png`).
