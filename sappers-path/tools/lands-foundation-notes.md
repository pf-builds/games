# Sapper's Path lands foundation (2026-10-06)

Step 0 of the land factory (`game-research/sappers-path-v4/land-factory.md`): the one-time engine, data and tooling work so
levels past 200 can be built 50 at a time as themed picture lands. Brief: the orchestrator's foundation brief of
2026-10-06, plus Peter's scope notes the same day (difficulty data-driven per land; the play screen's gear; side quests
from the Wandering Gallery). How to run a land: `tools/land-runbook.md`. Resume table: `tools/v5-progress.md`, "Lands
foundation".

Nothing about the live game changes until a land is installed: the map still ends at 200 with the long tail above it,
levels 1-200 and pictures 1-60 are byte-identical (the freeze snapshot now holds all 200), and no shipped level carries
shade rows, so every board draws exactly as before. The one visible change is the play screen's gear.

## 1. Lands in data

- `config.json` `lands`: `castleEnd` 200, `castleRealms` 8, `perLand` 50, the words (`text`: Land k where a realm says
  Realm), the `epilogue`, the `shadeTip`, and `list`, one entry per BUILT land (empty on the branch): k, slug, name,
  lore, from, to, source, features, eggs, sheets [first, last], files. `tools/land.js install` writes it.
- A land's levels are era `castleRealms + k` (Land 1 is era 9, ids `e9-201` ...), so everything keyed by era (banners,
  eggs reached, the realm card, music) works unchanged; `app.eras` = the castle realms then one entry per land.
- Words: `main.js realmEye(era, kind)` picks the realm's text or the land's (banner eye, banner label, realm card, home
  line, top bar fallback). The realm card reads "Land k of t" (t = lands built).
- The end of the castle story: the boss's first win adds `lands.epilogue.first` ("The castle road ends here. Past the
  throne it runs on into {name}.") once a land exists, else `none` ("... fades into the mist, for now."). The road then
  runs on up the map into Land 1.

## 2. Picture main levels past 200, and the difficulty profile (data per land)

- A level past 200 is a converted picture played with the existing rules: 5 spaces, no new engine rule. Deck features
  on any board: linked squads, ? cards, mystery blocks (hidden board pixels; `land-bake.js hidePic`, since `gen.js hide`
  needs a castle's open sky) and the Hard/Extreme lock (a colour lock, or a key lock when the gilt key clears every
  picture colour by 20 ΔE00).
- Peter's scope note: difficulty must keep climbing past 200, tuned per land without code. So every land carries a
  **profile** (`tools/land-config.json` `profile` with the land's `land.json` `profile` merged over it,
  `tools/land-plan.js`):
  - **tags**: shares of Easy/Normal/Hard/Extreme, breathers (Easy levels per 50), run [shortest, longest] of Hard and
    Extreme in a row, the end tag. `landTags` lays them out as a sawtooth: Normal levels, a run of Hard rising to its
    Extreme peak, an Easy breather; later runs get the Extremes first, so the land climbs. Default 50: E5/N20/H15/X10,
    runs of 4-5, ends Extreme.
  - **features**: per feature its share of the land's levels and its amount (? cards per level, share of the picture
    hidden, linked pairs, lock share and key share). `landPlan` gives each feature to Extreme levels first (Extreme
    uses every feature and the lock), then Hard, Normal, Easy in a seeded order; amounts rise with the tag. Default:
    mystery 0.6 (2-4 cards), hidden 0.5 (8-16% of eligible blocks), linked 0.6 (1-2 pairs), lock 0.5 (30% key).
  - **bands** per tag (Normal random-tap win rate) and **lookahead** ceilings, and the **pace** range and aim.
  The density rule past 200 (`tags.js landDensityOK` per level, `land-plan.js planCheck` per land): nothing outside the
  land's features or a picture's reach; Easy at most 1 feature and no lock; Normal no lock; Extreme everything and the
  lock; features per level never fall as the tag rises; Hard/Extreme runs within the profile; every land ends Hard or
  Extreme. Raising a later land's profile (more ?, more hidden, more links, more Hard/Extreme, lower bands) is a
  land.json edit.
- **Extension points for the later feature drops** (not built here): a land's `features` list is what the bake reads,
  and `tools/land-bake.js FEATURES` holds one builder per feature. A new board feature (Peter's decided schedule:
  organic moat rings round the subject with 1-2 openings from level 251; an Extreme-only hazard from 351 where a sapper
  sent at a covered block is lost, the level lost if a colour can no longer finish, the stored order never triggering
  it) is one more builder, its share in the profile, its name in the land's features, and its engine rule and critic
  model; `land-plan.js` refuses a feature name with no builder.
- **The bake** (`tools/land-bake.js`, workers, seeds from the level number): build the board features, deal (squads
  20-50 on a board of 1,400 cells, scaled with the board's area: the max board needs bigger squads to stay inside 55
  taps, a small landscape board smaller ones to reach the pace), link pairs, tune into the tag's band (all-seeing past
  mystery blocks, as bake.js), grade on the tag, pick the candidate meeting every target, then place the ? cards
  (bake.js's mystify rule). The grader's counts come from `bake-config.json` (main levels) and `gallery-config.json`
  bake (side quests), so `regrade.js` and `freeze.js` re-grade a banked land with 0 differences.
- **Invariants** (land.js check gates): stored winning order on the tag, no power-up in it, at most 5 spaces, longest
  tap 15 s or less, 55 taps or fewer, real pace in the profile's range (150-300 s) with the land's median in 200-250 s
  (aim 225 s, about 3:45), no fallback picks.
- **Pace follows board area.** At the max phone size a portrait painting (38-42 x 46) plays 200-290 s; a wide landscape
  (42 x 26-28) only 120-200 s even with small squads, which is why the per-level floor is 150 s (the Gallery's) while
  the land's median holds 200-250 s. The picture stage should prefer portrait and square pictures or crop wide ones
  taller (runbook §5). Two Sisters (38 x 46) could not deal at all with fixed 20-50 squads (55 taps); area scaling fixed it.

## 3. Shading within a colour

- `tools/shade.js` is the test's `scripts/shade.js` made a converter step (any kind; the ink and a masked picture's
  background are never shaded). Numbers: `gallery-config.json` `convert.shade` (the test's `shade-config.json`).
  **Ported exactly: on the test's 20 sources, crops and chroma, 20/20 boards give byte-identical shade rows and shade
  colours** (scratch check against `pd-art-test/shading/boards/*.json`).
- `tools/convert.js`: steps 1-2 (crop, mask, fit) moved into `fit()`, shared with shade.js; the 60 Gallery plans are
  byte-identical after the change (checked).
- `src/board.js`: `setLevel(..., shade)`; a level's `shade` rows set each block's tone to its digit and `S.tb[m]` holds
  the base and each shade's stud (same seam, highlight, foot and colour-blind mark); pops fall in their shade. Without
  shade rows the old path runs (the lit/shade tones, off), so 1-200 and the Gallery draw identically. Cards, bins,
  crumbs, helmets and mystery blocks keep the base colour; the engine never reads shade (a flat/shaded twin compiles to
  the same board).
- The coach tip: on a shaded level with no script of its own, `lands.shadeTip` ("Lighter and darker blocks belong to
  their colour.") until the player has cleared any shaded level or picture (worked out from the save; no new field).
- Checks: `shade.js checkLevel` (14 ΔE00 from other squads' bases and shades, 12 from their faded cards, rows sane) in
  land.js check and test.js; selfTest's shaded twin of picture 1 (same board, tones = digits, studs in the shade
  colours, the tip, a win; picture 1 itself unchanged).

## 4. The map every 50 levels

- A layout entry may reuse a sheet `file` with `mirror: true`. `journey.js layoutOf` (at load) mirrors levels, quests
  and their branch, road, eggs, entry, exit, tail, king and fortress about x = 384; the page flips the image
  (`.jr-sheet.mir`). Bridges sit on road samples, so they follow; a land entry carries its own `bridges`.
- `fade: true` entries crossfade into the sheet below on the page (a CSS mask over the 80 px overlap), since a baked
  crossfade only fits the sheet it was painted over, and land sheets are reused in any order.
- **WebP, no JPEG fallback.** Every target browser decodes WebP (Safari 14+, every Chrome, Edge and Firefox in use,
  and the portals' webviews); the demo's two sheets re-encoded from JPEG at q82 are 107 and 96 KB against 312 and 279
  KB. New land sheets are WebP; the castle's 25 JPEGs stay as they are.
- A land's entries: its 2 sheets in turn, A, B, A', B', A, B, A' (8 spots a sheet gives 7 entries for 50 levels;
  `map.perSheet` can use fewer). The frontier (fog and the long-tail node) moves to the land's last entry's first
  unused spot (or its top), through `journey.js frontier` unchanged. Until a land is built nothing changes.

## 5. Side quests inside lands: the Wandering Gallery

- Peter's call: side quests past 200 are famous public-domain art off every land's theme, one shared list
  (`tools/lands/_gallery/`: gallery.json with the raw folder, manifest.json, src/), used in order across lands. land.js
  takes the next pictures no land has used (gallery.json pictures with `wander: true`).
- Placement: `quests.js landQuestsOf`: after main level from - 1 + first (204), then the castle's gaps 4, 3, 5, 4 in
  turn, inside the land: 12 in a 50-level land. Prizes continue the castle's turn (quests.js rules: the Volley every
  6th). Records go on the end of `levels/gallery.json` (n 61, 62, ...; `land`, `wander`), so save codes keep every
  castle picture's place. On the map: a template quest spot near the level when free, else a made spot off the road.
- **Pictures 26-50 stay exactly where they are. 51-60 stay the long tail after the last built land**: their stored
  `after` (203-240) is untouched; `journey.js tailAfter` moves a castle picture past 200 on by how far the lands reach
  (51 is after 253 with Land 1 built), so they wait past the last land and open one at a time once every level is
  cleared, as now. A land's own side quests never move.

## 6. Factory tooling

`tools/land.js` (steps prep, convert, sheet, bake, map, assemble, check, install; resumable, writes to the land's
`scratch/` and copies into the game only on install after a passing check), `tools/land-src.py` (sources),
`tools/land-sheet.py` (contact sheet), `tools/land-config.json`, `tools/land-plan.js`, `tools/land-bake.js`,
`tools/shade.js`. Install appends levels, pictures, layout entries, sheets, the config entry and egg coins (text
insertion keeps config.json's layout) and the licence table, and refuses a land already there or a game that moved on.

## 7. The play screen's gear (Peter, 2026-10-06)

The top bar's quick mute is now a gear (`#btn-pset`) that opens the same Settings sheet as the home and the map (Music,
Sound effects, Colour-blind marks, Speed in debug, save code, Reset). While it or one of its sheets shows, the level
holds still (`app.held`: the engine and the show stop, the app clock runs so the reset's hold still fills); Done plays
on with no jump. The Paused sheet keeps its quick toggles. Same face as Retry (42 px at 375 wide, 36 px at 360x640,
as the bar's other buttons); every play-bar button now takes its tap 4 px past its face (`#top button.round::after`,
the bar stacked over the stage's top edge), so a 36 px face takes a 44 px tap; the bar fits 360 px (selfTest at
360x640@3x: 781 passed, 0 failed). selfTest and the harness use the gear and the Paused sheet's quick mute now.

## 8. Checks (final run)

On the branch (no land; the live game): `tools/test.js` all passed (611+; the castle checks now read a castle-scoped view,
and a lands section checks config, mirror math, the long-tail move, the profile and tags, the extension point, land side
quests, shading on a hand image, the land bake on a fixture, config insertion, and that levels 1-200 and pictures 1-60
equal the freeze snapshot byte for byte); `freeze.js --require` PASS (snapshot re-taken to hold 1-200: 200 levels, 1,155
checks, 60 pictures, 360 checks, 283 castle cases, 0 differences); `regrade.js` 0 of 1,155 and `--gallery` 0 of 360;
`critic-v5/run.sh` 0 mismatching games of 8,712, 0 grade mismatches, tags 0 problems; `SP.selfTest()` 0 failures at
375x812@3x and 1280x720 (`tools/selftest-lands.mjs`), 0 console messages; harness (see the progress table).

On a game copy with the demo land installed (`tools/land.js ... install --game COPY`, tools copied in): test.js all
passed (its per-land loop ran on the land), regrades 0 of 1,215 and 0 of 372, freeze PASS, critic-v5 0 mismatching
games of 9,108 (276 levels, tags 0 problems), selfTest 803 and 805 passed, 0 failed, 0 console messages.

## 9. The demo land ("Land 0 test", never shipped)

- Built in the session scratchpad (`demo/lands/00-test`, Wandering Gallery `demo/lands/_gallery`, game copy
  `demo/game`), never in `levels/` on the branch. 10 of the 20 CC0 Impressionist test paintings as levels 201-210 (the
  7 clear yeses plus The Boating Party, Stacks of Wheat and La Grande Jatte), 2 more as Wandering Gallery side quests
  (after 204 and 208: a Volley and a Ladder), map from the castle's sheets 7 and 3 re-encoded as WebP (107 and 96 KB),
  4 levels a sheet (`perSheet`) so the third sheet shows mirrored.
- Default profile: E1/N4/H3/X2, sawtooth N N H H E N N H X / ends X; features reached exactly their shares (mystery,
  linked 0.6; hidden, lock 0.5). Every gate passed after one fix-up (`--extra 8` on 201, 203, 204, 210, which first
  fell back on pace 146 s, the fast tapper, and lookahead 0.43 and 0.28). Real pace 154-252 s, median 208 s; longest
  tap 14.4-15.0 s (every level presses the 15 s cap: the factory's critics should watch for slow-feeling waits); taps
  43-55; bake about 4 min wall for all 12 on 16 threads, a one-level fix-up about 3-5 min (one thread).
- `tools/shots-lands-foundation/` (gitignored; remade by `tools/shots-lands-foundation.mjs`): `contact.png` (source,
  flat, shaded), `report.md` (the gates and per-level table), phone 375x812@3x `phone-201-start` (the shade tip),
  `phone-201-mid`, `phone-205-mid` (Extreme: the colour lock, ? cards, mystery blocks), `phone-202-mid` (a 38 x 46
  portrait), `phone-map-land` and `phone-map-frontier` (levels 205-210, a side quest, the mirrored sheet in the fog),
  `phone-map-banner` (the castle summit running into Land 1's banner), `phone-boss-epilogue` (the boss's first win:
  "... The castle road ends here. Past the throne it runs on into Test Isle."), `desktop-202-mid`.
- What the demo taught: fixed squad sizes fail big portrait boards (no deal under 55 taps) and leave landscape boards
  short of pace, so squads scale with board area; a fix-up of one level runs on one thread; the top bar should show the
  picture's title on a land level (done). La Grande Jatte reads as a maybe even shaded, as the test found.

## 10. For the factory loop to decide

- Land 1's real profile (the default is a starting point: tag shares, feature shares, bands). The default bands are
  set like the castle's late levels (Normal 5-20%, Hard 0-10%, Extreme 0-6% random-tap) so 201 does not drop below 200.
- Map templates: `tools/map-gen` has no land mode yet (LATER). Land 1's map stage writes `map/templates.json` for its 2
  sheets, or a trial copies castle sheets with `fromLayout`.
- The Wandering Gallery list (`tools/lands/_gallery/manifest.json`, empty): Peter OKs its downloads; about 12 pictures
  per land.
