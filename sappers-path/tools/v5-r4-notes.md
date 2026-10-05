# Sapper's Path v5 R4a + R4b: notes (castle levels 101-200, four new realms, 2026-10-05 overnight)

Source of every decision: the orchestrator's R4 brief (2026-10-05), `game-research/sappers-path-v4/rules-review.md`
("The feature ladder", "Tags mean how many features a level uses", "Confirmed", "Reuse map", "Build order"),
`tools/v5-r2-notes.md` (density rule, locks, dealer, teaching). Checklist: `tools/v5-progress.md` (R4 section).
Boards: `tools/shots-v5-r4/boards/` (gitignored, like every shots folder). Peter was asleep: every call below is mine and
written down so he can overrule it.

## 0. The freeze, before anything changed

- `levels/frozen/castles.json` (new): SHA-1 of `castle()`'s whole output for 283 cases of the eras 1-4 generators (40 seeds
  at each era's sample colours, fewer colours, every scene forced, the teaching sizes, the old boss, the archer-only era 3
  board, the small Era 1 boards). `tools/freeze.js` checks it on every run (`--require` fails when missing), so a shared
  helper changed for the new realms can't move an old realm's picture. 0 null cases, 0 differences at every commit.
- Levels 1-100 and the 60 pictures: never touched; `levels/levels.json` keeps them byte-identical (the bake's `--keep`), and
  the frozen snapshot re-grades with 0 differences.

## 1. R4a: the four realms' boards (tools/castle.js era5-era8; bake-config eras 5-8, picture.eras 5-8, 12 scenes)

Same picture style as eras 2-4 (40 x 39 picture in its 1-cell frame, feature scale 2, bold outline, entry at the bottom;
v4.2 sizing, so a phone shows about 8 CSS px a cell). Nothing the eras 1-4 draw changed: the new props are their own
small pixel drawings (`ART`), and the shared role logic only gained `P.must` (empty for eras 1-4).

Each painter takes the features the level's plan asks for: `moat` (else a plain bank path), `gates` (0: the bridge is
open ground, a causeway; 1: a drawbridge with its key in a lodge; 2: also a portcullis in the fort's door, its key in a
wall), `towers` ([a, b] archer towers, slate, each its own group on the bank path), and for the boss `inner` (a second
moat with its own drawbridge).

| Realm | Levels | The look | Scenes |
|---|---|---|---|
| 5 The Mistmoor | 100-124 | a timber fort on stilts over banks of mist (reeds at their feet), the long hall and huts under reed thatch, a watchtower with a pennant, a fence of stakes; fog sky, distant willows, mist banks; watch huts on legs as archer towers | fen (day fog), fenDusk, fenNight |
| 6 Emberwatch Crags | 125-149 | a basalt fort on a rock plinth, ember-lit windows, square/tall/twin keeps, a volcano behind with a glowing crater and a lava flow, crags, ash clouds; the moat is a **lava channel** | ember, ashDawn, emberNight |
| 7 The Shrouded Weald | 150-174 | a giant tree grown into a keep: flared roots, vines, glowing windows and lanterns, pod houses with leaf roofs on its branches, glowcap mushrooms, a palisade of living stakes; moonlit forest behind; a forest stream for the moat | moonlit, twilight, foxfire |
| 8 The Goblin King's Throne | 175-200 | a crooked grey fortress patched with odd stone and planks, uneven battlements, crooked side towers with red spiked roofs and goblin banners, leaning scrap-iron archer towers, the throne keep with the gold crown on top and the gold throne in its window; storm sky | throne, throneDusk, throneNight |

- **Colours.** The realms recolour and rename the existing role keys per scene (so the colour gate, `palette.js --scenes`
  and the crew names work unchanged). Palettes were searched near hand-picked targets (a seeded local search, scratch
  script, not shipped) until every pair of roles that can stand together (ink and gilt included) is 25+ CIEDE2000 and 20+
  with one faded to a queue row; all 12 new scenes pass `palette.js --scenes` (which now also counts each era's `extra`
  roles: the towers' slate and the gilt keys that only some plans bring). Emberwatch Crags drops timber and earth (too many
  warm colours to keep apart): its plinth, crags and volcano are ash; its fort is basalt.
- **Lava** (Peter's brief: "water-like, never eaten, never walked"): the level file says `liquid: "lava"`; the rules are
  water's (`~`), only the page draws it in `board.pic.liquids.lava` (orange with a yellow wave; `board.js setLevel`, one
  line in `main.js` passes it).
- **Looked at:** `tools/shots-v5-r4/boards/realm5-8-samples.png` (12 boards each, mixed plans). Rejected and redrawn on the
  way: the first fen palette (stilts drifted red, saturated greens), the first fen fort (stilts lost in dark reeds: the mist
  under the platform is now a subject, so no outline eats it), a volcano hidden behind ash, a tree crown that swallowed its
  pod houses, the throne's plank line floating in the sky, and the boss's inner moat being painted over by battlements.

## 2. R4b: tags by feature density, extended (tools/tags.js; bake-config tags.cycles; config.json v5.density)

- **Schedule** (`tags.cycles`, keyed by a realm's first level; its `start` and `end` tag): realm 5 gets its own cycle so the
  ladder's "about a third Hard" holds (101-124: 2 Easy, 13 Normal, 9 Hard; 124 Hard); realm 6 Hard-led with Extreme
  appearing; realms 7-8 Hard and Extreme. Every realm 6-8 ends **Extreme** (149, 174, 200); every realm has 2-3 Easy
  breathers; Hard or Extreme comes every 3-6 levels. Levels 1-100 keep their tags (the old rule, untouched).
- **Density** (`densityOK`, new `extremeFrom` 125, `hardSlack` 1): from 125 Hard uses all but at most one of the unlocked
  features plus the lock; Extreme uses every one plus the lock. Easy at most one, no lock; Normal two or more, no lock;
  lessons their new feature. Every level 1-200 passes (test.js, critic-v5).
- **The plan** (`bake.js planOf`, bake-config `plan`): each generated level's features are drawn from its tag (seeded by
  the level number): Extreme everything; Hard everything, from 125 one feature dropped 60% of the time (linked, mystery,
  tower, hidden or gate); Normal 2 (3 at 40%) of them, never all; Easy none (30%) or one. **A gate always brings its moat**
  (my call: a gate is a drawbridge; a portcullis in a wall would be a key with nothing to open, since every block is
  reachable from the frame). Hard/Extreme get a second gate 40% of the time. Locks: key 40%, colour 60%.
- **Locks** on every Hard and Extreme level (57 in 101-200: 33 colour, 24 key). The colour is the
  one whose first squad comes nearest 30% of the dealt order (R2's rule); the dealer plays it shut (a stand-in colour
  until the deal exists).

| Realm | Levels | Easy / Normal / Hard / Extreme | Real pace median (range) | Towers | Mystery blocks | Locks |
|---|---|---|---|---|---|---|
| 5 The Mistmoor | 101-124 | 2 / 13 / 9 / 0 | 226 s (209-242) | 0 | 0 | 9 (6 colour) |
| 6 Emberwatch Crags | 125-149 | 3 / 8 / 10 / 4 | 225 s (214-264) | 19 | 0 | 14 (7 colour) |
| 7 The Shrouded Weald | 150-174 | 3 / 6 / 10 / 6 | 228 s (203-277) | 19 | 18 | 16 (10 colour) |
| 8 The Goblin King's Throne | 175-200 | 3 / 5 / 9 / 9 | 236 s (207-275) | 18 | 20 | 18 (10 colour) |

## 3. R4b: the bake (tools/bake.js; report `tools/v5-r4-bake.md`)

- **Invariants, all 100 levels:** every level wins on its own tag with its stored order (patient and at real pace; the
  thinking replays all won); 5 spaces; **real-pace median 227 s (3:47)**, 203-300 s, by tag Easy 228, Normal 226, Hard
  225, Extreme 242 s; boss 263 s (in its 180-420 s range); longest single wait 15.0 s; taps max 55 (median 51); every
  level in its band; lookahead on Hard/Extreme median 10%, max 24% (target 25%); **0 fallbacks**; power-ups never needed
  (every stored order wins without them). Variety medians: realm 5 30.0%, 6 35.7%, 7 36.4%, 8 30.7% (gate 40%).
- **How it ran:** a trial of 101-110 (13 min; all targets met: the stop rule was not hit), then the full run of 101-200
  (104 min, 16 threads), which lost 32 levels to two bugs of mine (the bake had no rules for the Extreme tag; a colour
  lock's stand-in was compiled before its deck existed, on mystery-block levels) and graded lessons 125/150 without their
  lava and mystery blocks. Fix-up runs (`--list N,N,...`, new) merged with `--merge`: fix1 the 32 plus both lessons, fix2
  four lookahead misses and the boss, fix3 level 187. 34 levels came from fix-ups (`bake.fixups`, `bake.r4`).
- **`--r4fix` (my call, bake-config `r4fix`):** the tuner's narrowing stage (the one-move-lookahead hill-climb) dominates on
  Extreme boards, about 3 minutes a candidate and some 15, so the fix-ups ran 10-12 candidates (not 20-40) and a shorter
  climb (150 steps, 64 playouts). Every target is still graded in full; only the search is smaller. The first fix-up at
  full search ran 2 hours without finishing a level, which is why.
- **Mystery-block levels are tuned all-seeing** (`Lt`): the honest lookahead samples 4 boards a tap, too slow to
  hill-climb; the stored grade is the honest one and meets the target. (The full run's mystery-block levels that passed
  were tuned honest, before this change, so a fresh full rebake would differ on those; the level files are the record.)
- **The boss (200):** the Goblin King's throne with both moats and drawbridges, 4 archer towers, 2 linked pairs, 3 mystery
  cards, mystery blocks, a colour lock, at night. **Its board is 40 x 41 (42 x 43 framed), two rows taller than the realm's,
  not the 42 x 43 picture I first drew:** that one never dealt inside the 55-tap and 15 s caps (0 of 8 forts in a trial,
  either cap alone let it deal), and neither did 4-5 towers. Peter may want a bigger boss with looser caps (LATER).
- **Pools:** the bake's candidate pools for realms 5-8 (4.5 MB) are not committed; the bake is deterministic per level and
  the level files carry everything shipped.

## 4. Teaching (tools/teach-v4.js --add; config.json teach)

- **125 The Archer Tower** (Easy, Emberwatch board 38 x 37: lava moat with an open causeway, one tower): "Archers shoot
  inside the red ring. Tower first!" (the coach card is the tower's colour, the ring on the tower), "Tower down: the ring is
  safe now.", then the Volley's badge ("New power-up! The Volley clears one colour.", R1's unlock at 125).
- **150 Hidden Blocks** (Easy, Weald board 38 x 37: stream with an open bridge, a share of the castle hidden): "? blocks hide
  their colour until dug beside." with a new coach ring, `hidden` (the "?" block nearest the entry; main.js, 2 lines),
  then "Dig next to a ? and its colour shows for good."
- `teach-v4.js --add 125,150` builds only those and keeps every other lesson byte-identical (checked: 7 old lessons equal).

## 5. Side quests

Unchanged data (gallery.json is byte-identical to the frozen copy). Pictures 26-50 now open off levels 104-200 as each is
cleared; 51-60 (after 203-240) are the long tail, opening one at a time once all 200 are cleared (`save.js questOpen`
needed no change). test.js checks both, and the old-save tests now expect level 101 next after 1-100.

## 6. Checks at the end

- `tools/test.js` **564 passed, 0 failed** (new: eight realms, the four realm mixes and milestones, lessons 125/150, side
  quests 26-60, tags with cycles and Extreme, density with hardSlack, the boss's board).
- `tools/regrade.js` 0 differences (200 levels, 1155 checks); `--gallery` 0 (360). `tools/freeze.js --require` PASS: levels
  1-100 and the 60 pictures 0 differences, castles (eras 1-4) 283 cases 0 differences. levels.json's 1-100 are
  byte-identical to the frozen copies.
- `tools/critic-v5/run.sh`: 0 mismatching games of 8,712 on 264 levels, tag formula (with cycles) 0 problems, feature
  ladder (mystery blocks added) 0 problems, 13/13 known answers, real pace 260/260 identical. Its rules needed only the
  tag formula, Extreme locks and the mystery-block milestone; mystery blocks change no rule.
- `SP.selfTest()` (`?debug=1`): **697 passed, 2 failed** at 375x812 (DPR 3) and 1280x720. Both failures are the journey
  map's own checks, which the other builder owns (§7). With those three map lines guarded in a scratch copy (not
  committed), selfTest is 754/1 and 756/1, the one left being the map's "a banner for each of 8 realms" count.
- `tools/harness.mjs` (3:57 wall): every check passed except selfTest's map checks at each viewport (8 failures, all the
  same two lines); 0 console errors or warnings. Lava, mystery-block studs, the 150 ring and the boss checked by eye
  (`tools/shots-v5-r4/level125.png`, `level150.png`, `level200.png`).

## 7. For the R4 map builder (exactly where the map meets levels past 100)

**Resolved by the R4 merge (§9):** the map lane's frontier code gives every level 1-200 a spot; scrollMap no longer throws
and selfTest's map checks pass on saves past 100.

The map has spots for levels 1-100 only, so levels 101-200 have no `e.node`, `e.sheet` or `e.px`:
1. **Player-facing crash:** `src/main.js` line 698, `scrollMap()`: `worldY(e.sheet, e.px[1])` throws `Cannot read properties
   of undefined (reading '1')` when the focus is a level without a spot (any save with 1-100 cleared, opening the map).
   The map still renders and its Play starts level 101, but the scroll never happens and the error shows in the console.
2. **selfTest** (map section): line 2111 expects a node for every level (fails); line 2136 reads `e.node.tagName` for every
   level and **throws**, which stops the rest of selfTest; line 2301 reads `e.node.querySelector` the same way (reached
   only once 2136 is fixed). 2111 also expects a banner per config realm (8 now).
3. `tools/test.js` map-layout checks were loosened to "levels 1-N have spots, in order" and "one banner per realm the sheets
   reach"; tighten them again when the layout covers 200.
Nothing in map code, `map/` or `src/journey.js` was changed here.

## 8. The per-level map (101-200)

| # | Id | Tag | Board (style, scene) or lesson | Features | Real pace | Taps |
|---|---|---|---|---|---|---|
| 101 | e5-101 | normal | hall2-0t (fen) | linked, mystery | 217 s | 51 |
| 102 | e5-102 | hard | narrow-hall1-0t (fenDusk) | moat, gate, linked, mystery, key lock | 222 s | 49 |
| 103 | e5-103 | normal | hall2-0t (fen) | moat, mystery | 227 s | 52 |
| 104 | e5-104 | normal | hall2-0t (fenDusk) | moat, gate, mystery | 226 s | 52 |
| 105 | e5-105 | hard | hall2-0t (fen) | moat, gate, linked, mystery, colour lock | 231 s | 42 |
| 106 | e5-106 | easy | narrow-hall1-0t (fen) | linked | 221 s | 46 |
| 107 | e5-107 | normal | hall2-0t (fenNight) | moat, gate, linked | 242 s | 45 |
| 108 | e5-108 | hard | narrow-hall1-0t (fen) | moat, gate, linked, mystery, key lock | 225 s | 43 |
| 109 | e5-109 | normal | hall2-0t (fenNight) | moat, linked, mystery | 229 s | 45 |
| 110 | e5-110 | normal | hall2-0t (fen) | moat, linked, mystery | 223 s | 50 |
| 111 | e5-111 | hard | hall2-0t (fen) | moat, gate, linked, mystery, colour lock | 235 s | 46 |
| 112 | e5-112 | normal | hall2-0t (fenNight) | linked, mystery | 228 s | 49 |
| 113 | e5-113 | normal | narrow-hall1-0t (fen) | moat, linked, mystery | 224 s | 45 |
| 114 | e5-114 | hard | narrow-hall1-0t (fenDusk) | moat, gate, linked, mystery, colour lock | 230 s | 42 |
| 115 | e5-115 | easy | narrow-hall1-0t (fen) | moat | 227 s | 47 |
| 116 | e5-116 | normal | hall2-0t (fen) | moat, mystery | 224 s | 52 |
| 117 | e5-117 | hard | hall2-0t (fenNight) | moat, gate, linked, mystery, colour lock | 230 s | 43 |
| 118 | e5-118 | normal | narrow-hall1-0t (fen) | linked, mystery | 230 s | 43 |
| 119 | e5-119 | normal | hall2-0t (fen) | moat, gate, mystery | 221 s | 45 |
| 120 | e5-120 | hard | narrow-hall1-0t (fen) | moat, gate, linked, mystery, colour lock | 222 s | 41 |
| 121 | e5-121 | normal | hall2-0t (fen) | moat, gate | 226 s | 50 |
| 122 | e5-122 | normal | narrow-hall1-0t (fenDusk) | moat, linked | 209 s | 44 |
| 123 | e5-123 | hard | narrow-hall1-0t (fen) | moat, gate, linked, mystery, colour lock | 227 s | 42 |
| 124 | e5-124 | hard | hall2-0t (fenDusk) | moat, gate, linked, mystery, key lock | 226 s | 48 |
| 125 | e6-125 | easy | lesson: tower | moat, tower | 161 s | 37 |
| 126 | e6-126 | normal | twin-narrow-vl-1t (ember) | moat, tower | 227 s | 54 |
| 127 | e6-127 | hard | twin-narrow-vl-2t (ashDawn) | moat, linked, mystery, tower, colour lock | 221 s | 51 |
| 128 | e6-128 | normal | tall-narrow-vr-0t (emberNight) | moat, gate, mystery | 218 s | 55 |
| 129 | e6-129 | extreme | twin-narrow-vr-2t (ashDawn) | moat, gate, linked, mystery, tower, key lock | 235 s | 51 |
| 130 | e6-130 | hard | tall-vr-2t (emberNight) | moat, gate, linked, tower, colour lock | 217 s | 51 |
| 131 | e6-131 | easy | square-vl-0t (ashDawn) | mystery | 238 s | 52 |
| 132 | e6-132 | normal | tall-vl-0t (emberNight) | moat, linked | 220 s | 44 |
| 133 | e6-133 | hard | twin-vr-3t (ember) | moat, gate, linked, mystery, tower, colour lock | 226 s | 53 |
| 134 | e6-134 | hard | square-narrow-vl-2t (ember) | moat, gate, linked, tower, key lock | 221 s | 55 |
| 135 | e6-135 | normal | tall-vr-0t (ember) | linked, mystery | 264 s | 47 |
| 136 | e6-136 | hard | tall-vr-3t (ember) | moat, gate, linked, mystery, tower, key lock | 220 s | 48 |
| 137 | e6-137 | normal | tall-narrow-vr-1t (ashDawn) | mystery, tower | 231 s | 55 |
| 138 | e6-138 | extreme | square-narrow-vr-2t (ashDawn) | moat, gate, linked, mystery, tower, key lock | 247 s | 54 |
| 139 | e6-139 | hard | twin-narrow-vl-3t (ember) | moat, gate, linked, mystery, tower, colour lock | 214 s | 41 |
| 140 | e6-140 | easy | tall-narrow-vr-0t (ember) | moat | 228 s | 45 |
| 141 | e6-141 | normal | square-vr-1t (emberNight) | moat, mystery, tower | 238 s | 55 |
| 142 | e6-142 | hard | square-vl-2t (ember) | moat, gate, linked, mystery, tower, key lock | 224 s | 53 |
| 143 | e6-143 | hard | tall-vr-3t (emberNight) | moat, gate, linked, mystery, tower, key lock | 225 s | 53 |
| 144 | e6-144 | normal | tall-narrow-vr-2t (ember) | moat, mystery, tower | 222 s | 55 |
| 145 | e6-145 | hard | twin-vl-2t (ember) | moat, linked, mystery, tower, key lock | 220 s | 54 |
| 146 | e6-146 | normal | square-narrow-vr-0t (emberNight) | moat, mystery | 224 s | 55 |
| 147 | e6-147 | extreme | twin-narrow-vr-2t (ashDawn) | moat, gate, linked, mystery, tower, colour lock | 225 s | 55 |
| 148 | e6-148 | hard | square-vl-3t (ashDawn) | moat, gate, linked, mystery, tower, colour lock | 225 s | 49 |
| 149 | e6-149 | extreme | twin-vl-2t (ashDawn) | moat, gate, linked, mystery, tower, colour lock | 217 s | 53 |
| 150 | e7-150 | easy | lesson: hidden | moat, hidden | 174 s | 36 |
| 151 | e7-151 | hard | right-tree2-2t (moonlit) | moat, gate, linked, mystery, tower, hidden, colour lock | 225 s | 52 |
| 152 | e7-152 | normal | left-tree1-0t (twilight) | moat, mystery | 228 s | 49 |
| 153 | e7-153 | extreme | left-tree1-3t (moonlit) | moat, gate, linked, mystery, tower, hidden, key lock | 245 s | 54 |
| 154 | e7-154 | hard | right-tree1-3t (moonlit) | moat, gate, linked, mystery, tower, hidden, colour lock | 277 s | 51 |
| 155 | e7-155 | normal | mid-tree2-0t (twilight) | moat, gate, hidden | 225 s | 50 |
| 156 | e7-156 | hard | right-tree1-2t (twilight) | moat, gate, linked, mystery, tower, hidden, colour lock | 258 s | 54 |
| 157 | e7-157 | extreme | right-tree2-3t (foxfire) | moat, gate, linked, mystery, tower, hidden, key lock | 206 s | 49 |
| 158 | e7-158 | easy | right-tree1-0t (twilight) |  | 244 s | 48 |
| 159 | e7-159 | hard | right-tree1-3t (foxfire) | moat, gate, linked, tower, hidden, colour lock | 256 s | 55 |
| 160 | e7-160 | hard | right-tree1-3t (moonlit) | moat, gate, linked, mystery, tower, hidden, colour lock | 267 s | 52 |
| 161 | e7-161 | normal | right-tree2-1t (moonlit) | moat, tower | 224 s | 51 |
| 162 | e7-162 | extreme | mid-tree2-2t (moonlit) | moat, gate, linked, mystery, tower, hidden, colour lock | 248 s | 55 |
| 163 | e7-163 | hard | left-tree1-3t (moonlit) | moat, gate, linked, mystery, tower, hidden, colour lock | 217 s | 55 |
| 164 | e7-164 | normal | mid-tree3-1t (twilight) | linked, tower | 218 s | 55 |
| 165 | e7-165 | hard | right-tree1-2t (twilight) | moat, gate, linked, mystery, tower, hidden, key lock | 232 s | 55 |
| 166 | e7-166 | extreme | right-tree1-3t (twilight) | moat, gate, linked, mystery, tower, hidden, key lock | 224 s | 51 |
| 167 | e7-167 | easy | left-tree1-1t (moonlit) | tower | 225 s | 55 |
| 168 | e7-168 | hard | right-tree1-3t (moonlit) | moat, gate, mystery, tower, hidden, colour lock | 218 s | 54 |
| 169 | e7-169 | hard | mid-tree2-0t (moonlit) | moat, gate, linked, mystery, hidden, colour lock | 203 s | 41 |
| 170 | e7-170 | normal | left-tree1-0t (moonlit) | moat, mystery | 241 s | 49 |
| 171 | e7-171 | extreme | mid-tree2-2t (moonlit) | moat, gate, linked, mystery, tower, hidden, key lock | 223 s | 48 |
| 172 | e7-172 | hard | left-tree2-3t (foxfire) | moat, gate, linked, tower, hidden, colour lock | 221 s | 55 |
| 173 | e7-173 | normal | right-tree2-2t (moonlit) | linked, tower | 236 s | 50 |
| 174 | e7-174 | extreme | left-tree2-3t (moonlit) | moat, gate, linked, mystery, tower, hidden, key lock | 235 s | 52 |
| 175 | e8-175 | hard | throne-3t (throne) | moat, gate, linked, tower, hidden, colour lock | 216 s | 50 |
| 176 | e8-176 | extreme | throne-4t (throneNight) | moat, gate, linked, mystery, tower, hidden, key lock | 245 s | 50 |
| 177 | e8-177 | normal | throne-0t (throne) | linked, mystery, hidden | 232 s | 55 |
| 178 | e8-178 | hard | throne-2t (throneNight) | moat, linked, mystery, tower, hidden, colour lock | 264 s | 51 |
| 179 | e8-179 | extreme | throne-2t (throne) | moat, gate, linked, mystery, tower, hidden, key lock | 249 s | 49 |
| 180 | e8-180 | easy | throne-0t (throne) |  | 253 s | 55 |
| 181 | e8-181 | hard | throne-3t (throneNight) | moat, linked, mystery, tower, hidden, key lock | 229 s | 44 |
| 182 | e8-182 | normal | throne-1t (throne) | moat, linked, tower | 219 s | 48 |
| 183 | e8-183 | extreme | throne-2t (throne) | moat, gate, linked, mystery, tower, hidden, key lock | 242 s | 54 |
| 184 | e8-184 | hard | throne-2t (throne) | moat, gate, linked, mystery, tower, hidden, colour lock | 249 s | 47 |
| 185 | e8-185 | extreme | throne-2t (throneDusk) | moat, gate, linked, mystery, tower, hidden, colour lock | 236 s | 55 |
| 186 | e8-186 | normal | throne-0t (throneNight) | moat, linked, hidden | 245 s | 45 |
| 187 | e8-187 | hard | throne-2t (throne) | moat, linked, mystery, tower, hidden, colour lock | 236 s | 51 |
| 188 | e8-188 | extreme | throne-2t (throneDusk) | moat, gate, linked, mystery, tower, hidden, colour lock | 256 s | 55 |
| 189 | e8-189 | easy | throne-0t (throneNight) |  | 217 s | 52 |
| 190 | e8-190 | hard | throne-2t (throneDusk) | moat, gate, linked, mystery, tower, key lock | 218 s | 55 |
| 191 | e8-191 | normal | throne-0t (throneNight) | moat, gate, mystery | 224 s | 50 |
| 192 | e8-192 | extreme | throne-2t (throneDusk) | moat, gate, linked, mystery, tower, hidden, colour lock | 254 s | 53 |
| 193 | e8-193 | hard | throne-3t (throneDusk) | moat, gate, linked, mystery, tower, hidden, key lock | 224 s | 52 |
| 194 | e8-194 | extreme | throne-2t (throne) | moat, gate, linked, mystery, tower, hidden, colour lock | 275 s | 51 |
| 195 | e8-195 | normal | throne-0t (throne) | moat, hidden | 207 s | 52 |
| 196 | e8-196 | hard | throne-0t (throne) | moat, gate, linked, mystery, hidden, key lock | 220 s | 53 |
| 197 | e8-197 | extreme | throne-2t (throneNight) | moat, gate, linked, mystery, tower, hidden, colour lock | 242 s | 48 |
| 198 | e8-198 | easy | throne-0t (throneDusk) |  | 231 s | 50 |
| 199 | e8-199 | hard | throne-2t (throne) | moat, gate, linked, tower, hidden, key lock | 228 s | 52 |
| 200 | e8-200 | extreme | throne-moat-4t (throneNight) | moat, gate, linked, mystery, tower, hidden, colour lock | 263 s | 50 |

## 9. The R4 merge (map lane into levels lane, 2026-10-05)

Merged `sappers-path-map` (R4c, HEAD ffaafd1) into `sappers-path` (HEAD 32633b5); both branch from abbeccb. Nobody was
around: every call below is mine.

- **Merge commit ade64f0.** Conflicts: `tools/test.js` (two hunks: I took the map lane's map-layout and summit checks, which
  are the tight versions §7.3 asked for: spots for 1-200 on 25 sheets, every built level has one, 8 realm banners, the
  frontier at 100, 107, 200 and 0); `LATER.md` and `tools/v5-progress.md` (both lanes' sections kept; I dropped R4c's
  "realms 6-8 need real lore" line, since config `eras` 6-8 come from this lane). `config.json` (eras from here, `map`
  from there) and `src/main.js` (map code from there, the lava and the 150 ring from here) merged on their own.
- **Real data against the layout** (checked in Node): levels.json `n` = 1..200 in order; every level's `era` equals its
  layout sheet's realm (level 100 is `e5-100`, realm 5, matching the layout's 100-124); every level has a spot; quests
  1-50 each join the road (their `branch`) between their `after` level and the next; the long tail's spot is past level
  200 on sheet 25. Nothing to fix: the cloned levels the map lane tested with had the same numbers and realms.
- **Cache tag ?v=36** (cf3c442): index.html's ten tags and style.css's font URL; above 35 (levels) and 34 (map).
- **`tools/shots-v5-r3.mjs`**: its all-clear states hard-coded `unlockTo(100)` and pictures 1-25/40 (the long tail began
  at 26); with 200 levels its `.tchip` state timed out. Now `unlockTo(1e3)` (every level) and pictures 50/55/59.
- **New `tools/shots-v5-r4-merged.mjs`**: the brief's states on the real levels into `tools/shots-v5-r4/merged/` (phone
  3x and desktop): fresh, cur-110, cur-130, cur-160, cur-190, summit, all-200 (picture 51 in the fog), lesson-125 and
  lesson-150 in play (coach up). 0 console messages. Looked at: the realm card reads "Realm 6 of 8" with lore, lava and
  the tower ring in 125, the hidden blocks in 150, the king beside 200, "The road goes on" above it.

Checks after the merge (all on port 8491):

| Check | Result |
|---|---|
| `tools/test.js` | 565 passed, 0 failed |
| `tools/freeze.js --require` | PASS: levels 1-100 555 checks, gallery 360, castles 283 cases, 0 differences |
| `tools/regrade.js` / `--gallery` | 0 differences (200 levels, 1155 checks) / 0 (60, 360) |
| `tools/critic-v5/run.sh` | 0 mismatching games of 8,712; tags 0 problems; known answers 0 wrong; real pace 260/260 identical (diff-result.json only changed its ms; restored) |
| `SP.selfTest()` (`?debug=1`, map opened first) | 375x812 3x: 756/0 on a fresh save, past 150 (155 cleared, 30 pictures) and all 200 cleared; 1280x720: 758/0 on the same three; 0 console |
| `tools/shots-v5-r4-map.mjs` | selfTest 756/758 0 fail, 0 console; one named-state overlap: `today-tail` (now "1-100 cleared": level 101's label touches node 102 on the phone, pre-existing in R4c's own audit as "100: label x 102"); audit 100-200: 28 grazes phone, 8 desktop (LATER) |
| `tools/shots-v5-r3.mjs` | 0 console (after the fix above) |
| `tools/harness.mjs` | all passed, 0 console messages (4:04 wall) |

Payload (portal cap 20 MB applies to the build players get):
- **To reach play** (fresh load, title, a real tap on Play into level 1): 15 files, **1.72 MB** uncompressed (levels.json
  723 KB, main.js 286 KB, gallery.json 168 KB). Map sheets load lazily (251-312 KB each, the ones in view). The harness's
  whole-run figure (title, map, play, gallery) is 3.14-3.40 MB.
- **Portal build** (game folder without `tools/` and `levels/pool-*.json`, tracked files): **9.87 MB**. Without `tools/`
  only: 12.46 MB. The whole folder with `tools/`: 21.53 MB (over 20 MB, but `tools/` never ships).
