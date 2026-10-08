# Sapper's Path v5 R2: notes (the re-lay of levels 1-100 and the 60 pictures, 2026-10-04)

Source of every decision: `game-research/sappers-path-v4/rules-review.md` ("Confirmed", "The feature ladder", "Tags mean
how many features a level uses", "Reuse map", "Build order") and `tools/v5-r1-notes.md` §5. Checklist and commits:
`tools/v5-progress.md` (R2 section). Per-level table: `tools/v5-r2-relay.md`. Screens: `tools/shots-v5-r2/` (gitignored).

## 0. The harness before any change

`tools/harness.mjs` on R1's head (101a097): **all passed, 3:24 wall** (106 s user), every viewport and the hidden tab, 0
console messages. No timeout and no hang. The orchestrator's late-night timeouts were not reproduced on an idle machine;
the likeliest cause is load (a harness started while a bake or another session's harness held the CPUs: the screenshot
waits and the 20-minute wall budget are wall-clock). Nothing in the code needed a change for it.

## 1. The slot map (tools/relay.js; bake-config `relay`)

Every board of the v4.3 Siege gets a slot by realm; within a realm the boards are matched to the regular slots by least
total cost, solved exactly (Hungarian method, `relay.cost`: a tag that differs from the board's v4.3 tag 3, a 38x37 board
off an Easy slot 10, each edit 0.5, a Hard Twinspire slot without links 20, a key lock that stays -2, 0.1 a level moved).

- **1-24 The Greenmarch:** Era 1's levels 1-24 as they were, same slots, same tags. **The spare is v4.3's 25, dropped:**
  its 20x22 stockade can't reach the 3-minute target that holds from level 26, so it can't be a later breather.
- **25-49 Fenwater Vale:** 25 is v4.3's Locked Bridge lesson with its drawbridge opened (now The Open Bridge, the moat
  lesson). Every Era 2 board opens its drawbridges (the iron becomes ground; each gold key becomes a plain block of the
  colour most of its neighbours are, its Looters sapper moved to that colour's last squad) and drops its mystery flags.
  Era 2 gives 23 regular boards for 24 slots (its mystery lesson moves to 100), so **26 is a new Era 2 board**.
- **50-74 The Ironhollows:** 50 is v4.3's Linked Squads lesson board with towers plain and the link dropped (now The
  Locked Gate, the gates-and-keys lesson). Towers become plain blocks (the tower's colour stays; only the range goes),
  mystery flags and links go (a linked pair becomes two taps, the partner tapped right after). Easy levels open their gate
  (one feature at most); Hard levels get a colour lock.
- **75-99 Twinspire Reach:** 75 is v4.3's All at Once with towers plain, its flags and lock dropped (now Linked Squads).
  Towers plain, mystery dropped; Easy levels also open their gates and drop links and lock; Normal levels drop a lock;
  Hard levels keep a key lock or get a colour lock, and every Hard slot got a board that has links. **The old boss board
  (v4.3's 100) ends the realm at 99** (Hard, the boss band and its 180-420 s range).
- **100, The Mistmoor's opener:** v4.3's Hidden Colours lesson as it was (a moated motte with 3 mystery cards; Scout
  unlocks here). Chosen over an Era 4 board because it already is the mystery lesson (board, deck and coach), and a moat
  in the fens fits. A Mistmoor look comes with R4's boards.
- **New boards (3):** 26 (the shortfall above), 58 and 83. 58 and 83 got v4.3's two leftover lesson boards (e3-51, the
  tower lesson with no gate or moat; e4-76, the lock lesson) as Easy breathers, but at 38x37 they top out at 156 s and
  152 s of model time, under the 180 s floor (every kept, tuned and dealt candidate; the pools hold them), so the bake drew
  new realm forts. Peter could have them back as short breathers (LATER).

**Decks:** kept 28 (the re-laid deck met every target as it was), tuned 25 (the kept squads re-arranged into the band),
dealt 37 (a new deal on the kept board), new board 3; plus the 7 lessons (1-3, 75 and 100 kept their decks; 25 and 50 were
dealt again on their boards by teach-v4.js). Realm 2 is mostly dealt: an open drawbridge lets parked squads pour out
early, which moves the time and the band.

### The re-lay map (per level; the full measures are in `tools/v5-r2-relay.md`)

| New | Id | Tag | From (v4.3) | Deck | Edits | Features | Real pace |
|---|---|---|---|---|---|---|---|
| 1 | e1-01 | easy | e1-01 (lesson) | lesson | - | - | 23 s |
| 2 | e1-02 | easy | e1-02 (lesson) | lesson | - | - | 32 s |
| 3 | e1-03 | easy | e1-03 (lesson) | lesson | - | - | 32 s |
| 4 | e1-04 | normal | e1-04 | kept | - | - | 32 s |
| 5 | e1-05 | normal | e1-05 | kept | - | - | 36 s |
| 6 | e1-06 | hard | e1-06 | kept | - | - | 28 s |
| 7 | e1-07 | normal | e1-07 | kept | - | - | 34 s |
| 8 | e1-08 | normal | e1-08 | kept | - | - | 33 s |
| 9 | e1-09 | normal | e1-09 | kept | - | - | 33 s |
| 10 | e1-10 | hard | e1-10 | kept | - | - | 44 s |
| 11 | e1-11 | easy | e1-11 | kept | - | - | 32 s |
| 12 | e1-12 | normal | e1-12 | kept | - | - | 35 s |
| 13 | e1-13 | normal | e1-13 | kept | - | - | 38 s |
| 14 | e1-14 | normal | e1-14 | kept | - | - | 35 s |
| 15 | e1-15 | hard | e1-15 | kept | - | - | 32 s |
| 16 | e1-16 | normal | e1-16 | kept | - | - | 45 s |
| 17 | e1-17 | normal | e1-17 | kept | - | - | 41 s |
| 18 | e1-18 | normal | e1-18 | kept | - | - | 39 s |
| 19 | e1-19 | hard | e1-19 | tuned | - | - | 43 s |
| 20 | e1-20 | easy | e1-20 | tuned | - | - | 36 s |
| 21 | e1-21 | normal | e1-21 | kept | - | - | 38 s |
| 22 | e1-22 | normal | e1-22 | kept | - | - | 36 s |
| 23 | e1-23 | normal | e1-23 | kept | - | - | 40 s |
| 24 | e1-24 | hard | e1-24 | tuned | - | - | 37 s |
| 25 | e2-25 | easy | e2-26 (lesson) | lesson | - | moat | 134 s |
| 26 | e2-26 | normal | (new: Era 2 ran one board short) | new board | realm edits on a new fort | moat | 214 s |
| 27 | e2-27 | normal | e2-27 | dealt | openGates | moat | 224 s |
| 28 | e2-28 | hard | e2-28 | dealt | openGates | moat | 223 s |
| 29 | e2-29 | normal | e2-29 | dealt | openGates | moat | 238 s |
| 30 | e2-30 | normal | e2-30 | dealt | openGates | moat | 240 s |
| 31 | e2-31 | normal | e2-31 | kept | openGates | moat | 196 s |
| 32 | e2-32 | hard | e2-33 | dealt | openGates | moat | 191 s |
| 33 | e2-33 | easy | e2-38 | dealt | openGates | moat | 212 s |
| 34 | e2-34 | normal | e2-32 | dealt | openGates | moat | 237 s |
| 35 | e2-35 | normal | e2-34 | dealt | openGates | moat | 213 s |
| 36 | e2-36 | normal | e2-36 | dealt | openGates, dropMystery | moat | 199 s |
| 37 | e2-37 | hard | e2-37 | tuned | openGates, dropMystery | moat | 222 s |
| 38 | e2-38 | normal | e2-39 | tuned | openGates | moat | 184 s |
| 39 | e2-39 | normal | e2-41 | dealt | openGates, dropMystery | moat | 228 s |
| 40 | e2-40 | normal | e2-40 | kept | openGates | moat | 214 s |
| 41 | e2-41 | hard | e2-42 | dealt | openGates | moat | 233 s |
| 42 | e2-42 | easy | e2-47 | dealt | openGates, dropMystery | moat | 267 s |
| 43 | e2-43 | normal | e2-43 | tuned | openGates, dropMystery | moat | 207 s |
| 44 | e2-44 | normal | e2-44 | dealt | openGates | moat | 190 s |
| 45 | e2-45 | normal | e2-45 | dealt | openGates, dropMystery | moat | 217 s |
| 46 | e2-46 | hard | e2-46 | tuned | openGates | moat | 210 s |
| 47 | e2-47 | normal | e2-49 | dealt | openGates | moat | 244 s |
| 48 | e2-48 | normal | e2-48 | dealt | openGates | moat | 226 s |
| 49 | e2-49 | hard | e2-50 | dealt | openGates | moat | 213 s |
| 50 | e3-50 | easy | e3-62 (lesson) | lesson | - | moat, gate | 172 s |
| 51 | e3-51 | normal | e3-53 | kept | dropTowers, dropMystery | moat, gate | 221 s |
| 52 | e3-52 | normal | e3-52 | tuned | dropTowers, dropMystery | moat, gate | 233 s |
| 53 | e3-53 | hard | e3-55 | tuned | dropTowers, dropMystery, colourLock | moat, gate, colour lock 8 | 236 s |
| 54 | e3-54 | normal | e3-54 | tuned | dropTowers | moat, gate | 217 s |
| 55 | e3-55 | normal | e3-56 | dealt | dropTowers, dropMystery | moat, gate | 221 s |
| 56 | e3-56 | normal | e3-57 | kept | dropTowers | moat, gate | 209 s |
| 57 | e3-57 | hard | e3-60 | dealt | dropTowers, colourLock | moat, gate, colour lock 2 | 220 s |
| 58 | e3-58 | easy | (new: e3-51's 38x37 board tops out at 156 s) | new board | realm edits on a new fort | moat | 211 s |
| 59 | e3-59 | normal | e3-59 | tuned | dropTowers | moat, gate | 229 s |
| 60 | e3-60 | normal | e3-58 | dealt | dropTowers, dropMystery | moat, gate | 224 s |
| 61 | e3-61 | normal | e3-61 | kept | dropTowers, dropMystery | moat, gate | 230 s |
| 62 | e3-62 | hard | e3-64 | tuned | dropTowers, colourLock | moat, gate, colour lock 8 | 237 s |
| 63 | e3-63 | normal | e3-63 | dealt | dropTowers, dropMystery | moat, gate | 222 s |
| 64 | e3-64 | normal | e3-66 | tuned | dropTowers, dropLinks | moat, gate | 210 s |
| 65 | e3-65 | normal | e3-67 | kept | dropTowers, dropMystery, dropLinks | moat, gate | 229 s |
| 66 | e3-66 | hard | e3-69 | dealt | dropTowers, dropMystery, colourLock | moat, gate, colour lock 12 | 224 s |
| 67 | e3-67 | easy | e3-65 | kept | dropTowers, dropMystery, openGates | moat | 224 s |
| 68 | e3-68 | normal | e3-68 | tuned | dropTowers, dropMystery | moat, gate | 221 s |
| 69 | e3-69 | normal | e3-71 | kept | dropTowers, dropLinks | moat, gate | 214 s |
| 70 | e3-70 | normal | e3-70 | dealt | dropTowers, dropLinks | moat, gate | 243 s |
| 71 | e3-71 | hard | e3-73 | dealt | dropTowers, dropMystery, colourLock | moat, gate, colour lock 3 | 223 s |
| 72 | e3-72 | normal | e3-72 | kept | dropTowers | moat, gate | 224 s |
| 73 | e3-73 | normal | e3-74 | tuned | dropTowers | moat, gate | 237 s |
| 74 | e3-74 | hard | e3-75 | tuned | dropTowers, dropLinks, colourLock | moat, gate, colour lock 9 | 196 s |
| 75 | e4-75 | easy | e4-77 (lesson) | lesson | - | moat, gate, linked | 131 s |
| 76 | e4-76 | normal | e4-79 | tuned | dropTowers | moat, gate, linked | 189 s |
| 77 | e4-77 | normal | e4-83 | dealt | dropTowers, dropMystery | moat, gate | 238 s |
| 78 | e4-78 | hard | e4-78 | dealt | dropTowers, colourLock | moat, gate, linked, colour lock 8 | 222 s |
| 79 | e4-79 | normal | e4-99 | tuned | dropTowers, dropMystery | moat, gate, linked | 193 s |
| 80 | e4-80 | normal | e4-80 | dealt | dropTowers, dropMystery | moat, gate | 225 s |
| 81 | e4-81 | normal | e4-81 | tuned | dropTowers, dropMystery, dropLock | moat, gate | 236 s |
| 82 | e4-82 | hard | e4-82 | dealt | dropTowers, colourLock | moat, gate, linked, colour lock 9 | 227 s |
| 83 | e4-83 | easy | (new: e4-76's 38x37 board tops out at 152 s) | new board | realm edits on a new fort | moat | 204 s |
| 84 | e4-84 | normal | e4-84 | tuned | dropTowers, dropMystery, dropLock | moat, gate | 214 s |
| 85 | e4-85 | normal | e4-85 | dealt | dropTowers, dropMystery | moat, gate, linked | 223 s |
| 86 | e4-86 | normal | e4-86 | dealt | dropTowers, dropMystery, dropLock | moat, gate | 237 s |
| 87 | e4-87 | hard | e4-87 | dealt | dropTowers, dropMystery | moat, gate, linked, key lock | 286 s |
| 88 | e4-88 | normal | e4-88 | tuned | dropTowers, dropMystery | moat, gate | 186 s |
| 89 | e4-89 | normal | e4-93 | tuned | dropTowers, dropMystery | moat, gate | 215 s |
| 90 | e4-90 | normal | e4-90 | tuned | dropTowers, dropLock | moat, gate | 205 s |
| 91 | e4-91 | hard | e4-91 | dealt | dropTowers, colourLock | moat, gate, linked, colour lock 2 | 226 s |
| 92 | e4-92 | easy | e4-92 | kept | dropTowers, dropMystery, openGates, dropLock | moat | 204 s |
| 93 | e4-93 | normal | e4-95 | dealt | dropTowers | moat, gate, linked | 219 s |
| 94 | e4-94 | normal | e4-94 | tuned | dropTowers, dropMystery | moat, gate | 212 s |
| 95 | e4-95 | normal | e4-96 | dealt | dropTowers, dropMystery, dropLock | moat, gate | 233 s |
| 96 | e4-96 | hard | e4-89 | dealt | dropTowers | moat, gate, linked, key lock | 223 s |
| 97 | e4-97 | normal | e4-97 | dealt | dropTowers, dropMystery | moat, gate | 248 s |
| 98 | e4-98 | normal | e4-98 | dealt | dropTowers, dropLock | moat, gate | 219 s |
| 99 | e4-99 | hard | e4-100 | tuned | dropTowers, dropMystery | moat, gate, linked, key lock | 234 s |
| 100 | e5-100 | easy | e2-35 (lesson) | lesson | - | moat, gate, mystery | 121 s |
## 2. Tags by feature density (tools/tags.js; bake-config tags.realms; config.json v5.density)

- **The schedule runs per realm:** every realm ends on a Hard level (24, 49, 74, 99), opens with an Easy lesson (25, 50,
  75, 100) and restarts v4.3's cycle (normal, normal, hard, normal, normal, normal, hard, easy, normal) after it; realm 1
  keeps v4.3's numbering, so 1-24 kept their tags. Mix **15 Easy, 62 Normal, 23 Hard** (Hard every 3-5 levels; Easy
  breathers at 11, 20, 33, 42, 58, 67, 83, 92 besides the lessons). Extreme only from 125: none.
- **The density rule (`densityOK`):** no feature before its milestone (moats 25, gates 50, linked 75, mystery cards 100,
  towers 125, mystery blocks 150); Easy uses at most one feature and no lock; Normal at least two once two are unlocked,
  no lock; Hard every unlocked feature plus, from 50, the lock. A lesson uses its new feature and may keep older ones.
  Every level passes (test.js, and the critic's diff).
- Per realm that means: 1-24 none; 25-49 moats on every level; 50-74 Easy moat only, Normal moat and gate, Hard moat,
  gate and lock; 75-99 Easy moat only, Normal moat and gate (links where the board had them), Hard moat, gate, links and
  lock.

## 3. Locks (Hard levels from 50; config.json v5.locks)

12 Hard levels carry one: **colour locks** on 53, 57, 62, 66, 71, 74, 78, 82, 91 (the colour whose first squad comes
nearest 30% of the way through the stored order, `relay.lockAt`) and **key locks** on 87, 96, 99 (v4.3 boards whose lock
key was already dug in). None before 50, none on Easy or Normal. The dealer treats a colour lock as shut (it deals on 4
open spaces), so every deal wins without it.

## 4. Side quests (the 60 pictures; config gallery.quests, tools/quests.js, gallery.json `quest`)

- **Slots:** picture 1 after level 4, then one every 4, 3, 5, 4 levels in turn (always 3-5), in the Gallery's order:
  pictures 1-25 after levels 4-100; pictures 26-60 after levels 104-240, which R4 builds.
- **Prizes:** one use of a power-up the campaign has unlocked by then (a quest after level a is reached at a + 1): the
  everyday ones in turn (only Ladders before 25), and the Volley on every 6th quest once it unlocks at 125: 4 Volleys, all
  past level 125 (pictures 37, 43, 49, 55). **None is reachable before R4**, so the brief's "none yet" holds for play; I
  followed the ladder in the data because the brief's reason ("only from 125") is the rule.
- **The interim Gallery (until R3's map):** a picture opens once its quest's main level is cleared (optional: it never
  blocks the campaign); the ones past the last level open one at a time once every level is cleared (the long tail,
  `save.js questOpen`). Each tile wears its prize (the power-up's icon on a disc) until its first clear, which adds the
  prize to the inventory (`meta.js gift`) with a toast. A side quest won goes on to the next open quest, else to the next
  campaign level. The Gallery button opens at level 4 (`gallery.openAt` e1-04).
- **Re-graded under v5** (`gallery-bake.js --keep levels/gallery.json`): boards and palettes byte-identical; kept 42,
  tuned 14, dealt 4, **0 fallbacks**; tags as v4.3 (8/38/14: pictures use no feature, so density doesn't apply); real pace
  median 197 s (159-298 s).

| # | Picture | Tag | After level | Prize | Deck | Real pace |
|---|---|---|---|---|---|---|
| 1 | Pizza Slice | easy | 4 | ladder | kept | 246 s |
| 2 | Goblin's Lunch | easy | 8 | ladder | tuned | 200 s |
| 3 | Cat | normal | 11 | ladder | kept | 205 s |
| 4 | Fox | normal | 16 | ladder | kept | 221 s |
| 5 | Red Fuji | hard | 20 | ladder | tuned | 162 s |
| 6 | Sir Whiskers | normal | 24 | quartermaster | kept | 203 s |
| 7 | Cherries | normal | 27 | ladder | kept | 180 s |
| 8 | Panda | normal | 32 | quartermaster | kept | 211 s |
| 9 | Night Watch | hard | 36 | ladder | tuned | 200 s |
| 10 | Mushroom | easy | 40 | quartermaster | tuned | 208 s |
| 11 | Watermelon | normal | 43 | ladder | kept | 189 s |
| 12 | The Great Wave | normal | 48 | quartermaster | kept | 190 s |
| 13 | Frog Prince | normal | 52 | ladder | kept | 206 s |
| 14 | Burger | hard | 56 | quartermaster | tuned | 173 s |
| 15 | Penguin | normal | 59 | recall | kept | 206 s |
| 16 | Duck Knight | normal | 64 | ladder | kept | 195 s |
| 17 | Dog | normal | 68 | quartermaster | kept | 226 s |
| 18 | Strawberry | hard | 72 | recall | tuned | 165 s |
| 19 | Wheat Field with Cypresses | easy | 75 | ladder | tuned | 239 s |
| 20 | Crown Too Big | normal | 80 | quartermaster | kept | 195 s |
| 21 | Taco | normal | 84 | recall | kept | 222 s |
| 22 | Octopus | normal | 88 | ladder | kept | 243 s |
| 23 | Cake Castle | hard | 91 | quartermaster | tuned | 186 s |
| 24 | Lion | normal | 96 | recall | kept | 189 s |
| 25 | Doughnut | normal | 100 | ladder | kept | 195 s |
| 26 | Irises | normal | 104 (R4) | quartermaster | kept | 159 s |
| 27 | Mimic | hard | 107 (R4) | scout | kept | 178 s |
| 28 | Honeybee | easy | 112 (R4) | recall | kept | 237 s |
| 29 | Crab | normal | 116 (R4) | ladder | kept | 190 s |
| 30 | Melon Catapult | normal | 120 (R4) | quartermaster | kept | 194 s |
| 31 | Cupcake | normal | 123 (R4) | scout | kept | 222 s |
| 32 | Unicorn | hard | 128 (R4) | recall | dealt | 195 s |
| 33 | Trophy | normal | 132 (R4) | ladder | kept | 201 s |
| 34 | Happy Potion | normal | 136 (R4) | quartermaster | tuned | 203 s |
| 35 | Owl | normal | 139 (R4) | scout | kept | 200 s |
| 36 | Avocado | hard | 144 (R4) | recall | dealt | 242 s |
| 37 | Iron Pig | easy | 148 (R4) | volley | kept | 205 s |
| 38 | Pig | normal | 152 (R4) | ladder | tuned | 223 s |
| 39 | Castle | normal | 155 (R4) | quartermaster | kept | 217 s |
| 40 | Roses | normal | 160 (R4) | scout | kept | 201 s |
| 41 | Mushroom House | hard | 164 (R4) | recall | kept | 175 s |
| 42 | Dragon | normal | 168 (R4) | ladder | kept | 199 s |
| 43 | Frog | normal | 171 (R4) | volley | kept | 197 s |
| 44 | The Sapper | normal | 176 (R4) | quartermaster | kept | 195 s |
| 45 | Lollipop | hard | 180 (R4) | scout | dealt | 298 s |
| 46 | Crown | easy | 184 (R4) | recall | tuned | 247 s |
| 47 | Oleanders | normal | 187 (R4) | ladder | kept | 179 s |
| 48 | Hatchling | normal | 192 (R4) | quartermaster | kept | 178 s |
| 49 | Alien | normal | 196 (R4) | volley | kept | 206 s |
| 50 | Rocket | hard | 200 (R4) | scout | dealt | 200 s |
| 51 | Plumed Helm | normal | 203 (R4) | recall | kept | 191 s |
| 52 | Rainbow | normal | 208 (R4) | ladder | kept | 190 s |
| 53 | Jack-o'-Lantern | normal | 212 (R4) | quartermaster | kept | 207 s |
| 54 | Apples and Primroses | hard | 216 (R4) | scout | tuned | 171 s |
| 55 | Sheep Knight | easy | 219 (R4) | volley | kept | 195 s |
| 56 | Sunflower | normal | 224 (R4) | recall | kept | 197 s |
| 57 | Sword in the Stone | normal | 228 (R4) | ladder | kept | 196 s |
| 58 | Party Slime | normal | 232 (R4) | quartermaster | kept | 177 s |
| 59 | Wise Old Owl | hard | 235 (R4) | scout | tuned | 194 s |
| 60 | Goblin King's Hoard | hard | 240 (R4) | recall | tuned | 172 s |
## 5. Lore (config.json eras; layout.realmEye, mapName; meta.home.era)

The map's sections and the home line now name realms ("Realm 2 · Fenwater Vale"); the map button reads "Map".
1. **The Greenmarch:** "Meadows and timber stockades on earth banks, thrown up overnight by goblin raiders. The crown's trail starts here."
2. **Fenwater Vale:** "Rivers and reed marsh. Every motte has a moat, but the goblins left the drawbridges down in the fog."
3. **The Ironhollows:** "Stone keeps in iron-veined hills. The gates are locked here, and the goblins hide the gold keys in the walls."
4. **Twinspire Reach:** "Walls within walls and twin towers on every hold. The goblin captains send their crews out two by two."
5. **The Mistmoor:** "Fog lies thick on the fens. Squads march out of it unmarked: nobody knows their colour until they reach the front."

A grep of the game folder (code, config, page, level files) for Normans, 1066, Edward, Beaumaris, White Tower, London,
Wales and other real places, peoples and four-digit dates found only the four era notes. Kept on purpose: generic castle
terms (stockade, motte, keep, concentric walls) and the Gallery's artwork titles and credits (Red Fuji, The Great Wave,
painters' names), which are attributions, not lore. Old notes and critic reports in tools/ keep their history.

## 6. Dealer settings (bake-config deal, gallery-config deal)

`deal.hold` 5 (the spaces every level plays on; v4.3 dealt on Hard's 4); `rushHard` false (rushed dealing guarded against
a Hard kill leaving a colour short; with no kills a fast player can't run short). Dealing mode still fails a deal at any
arrow hit, so deals stay hit-free, and `noParkUnderArchers` stays. A colour lock is dealt shut (gen.js `shut`). The
colour ranges follow the realms (v4.3 left 26 and 51 out as lessons). `dealByLevel` keeps v4.3's keys (53, 83); they
only act on a re-deal of those slots.

## 7. Teaching and coach text (config.json teach)

- Lessons: 25 moats (ring `moat`: the bridge across the water, a new ring), 50 gates and keys (the key ringed, then the
  Looters), 75 linked squads, 100 mystery cards. Each realm's new power-up gets a last coach step pointing at its badge
  (new pointer `power`): Quartermaster at 25, Recall at 50, Scout at 100 (R1's unlock tip shows at level start too).
- The first lock levels carry coach lines without being lessons: 53 (the first colour lock: "One space is locked. Its
  colour opens it!", pointing at that colour's card or the padlocked space) and 87 (the first key lock: v4.3's lock
  lesson lines). selfTest checks every coach script; on these two Hard levels the arrow-follower must see every step but
  need not win.
- Text pass: no player-facing line mentions 6 or 4 spaces, Hard archers or kills (the old 51 hint went with its lesson;
  `show.killText` stays for R1's dealing-mode path and is never shown).

## 8. Invariants and checks

- Siege: every level winnable on its tag with its stored order (patiently and at real pace; the thinking replays
  stored); every generated level in its band; real pace 26+ **median 222 s (184-286 s)**, the boss (99) 234 s, by tag
  Easy 211 s, Normal 221 s, Hard 223 s (the x1.77 model; about 3:00 at Peter's measured pace); patient 4-15 at 66-86 s;
  longest tap 15.0 s; taps max 55, median 45; lookahead hard median 12% (max 25%), hardest 7% (max 22%); no fast-tapper
  flags; **0 fallbacks**. Variety medians 19.3 / 21.4 / 22.1 / 33.6% (gate 40%); 79 and 87 are logged at 41.4% and 40.7%
  against their realm's earlier picks (the gate is on the realm median). Palette gates as test.js checks them. Power-ups
  are never needed (every stored order wins without them).
- `tools/regrade.js` 0 differences (Siege, 555 checks); `--gallery` 0 (360 checks).
- `tools/freeze.js --snapshot` taken (`tools/build-data/frozen/`: levels.json and gallery.json); `--require` PASS, 0 differences.
- `tools/test.js` 444 passed, 0 failed, nothing deferred (`v5.relaid: true`).
- `SP.selfTest()` (debug): 509/0 at 375x812, 511/0 at 1280x720; the harness runs it at every viewport.
- `tools/harness.mjs`: **all passed** at every viewport plus the hidden tab, 0 console errors or warnings (the archer-hit
  screen is skipped: no towers before 125).
- `tools/critic-v5/run.sh`: the rules diff found 0 mismatching games of 5,412 (stored, patient, rushed and power-up games
  on all 164 levels); feature-ladder and tag-formula checks 0 problems; 13/13 known-answer boards; real pace 160/160.

## 9. The critic's rules (tools/critic-v5/)

Copied from critic-v4.3 and brought to the v5 R1 entry: 5 spaces, no kills (K6 now expects a knock-back), colour locks
(K10 stays shut and jams with bit 2; K11 opens on its colour's tap), the Quartermaster rework (K9, K12), the realm tag
formula and a feature-ladder check in diff.mjs. Its patient power-up games now wait for rest after the power-ups too (a
Quartermaster places a squad, so it can fill the line). The v4.3 browser pass (play.mjs) is not carried over: it checked
6/4 spaces and old ids. **Not modelled by the critic** (left to tools/ref.js and test.js, flagged for the next critic): the
Volley, the continue and mystery blocks, which no shipped level reaches yet. **SPEC ambiguities noticed:** (1) the
Quartermaster entry says the card "leaves its column" (revealed as it leaves) and then "Log POWER 1 a": I read the
REVEALs as logged before POWER, and the engine agrees; (2) the R1 entry doesn't say whether a colour lock may be gilt (the
Looters); R2 never picks it, but the SPEC allows it.

## 10. What R3 needs

1. **The journey map** in place of the level grid and the Gallery screen: realms from config.json `eras` (5 entries:
   1-24, 25-49, 50-74, 75-99, 100; each level's `era` is its realm), main nodes from levels.json (`n`, `tag`, cleared by
   id), side-quest detours from gallery.json `quest {after, prize}` (the node after main level `after`, its prize icon
   shown before playing). Openness is `save.js questOpen` (a quest opens once its main level is cleared and never
   blocks); prizes go in on the first clear (`questPrize` in main.js, `Meta.gift`). Move both onto the map's nodes.
2. **Quests past 100:** 35 pictures sit after levels 104-240. Decide whether the map shows them as fogged nodes (keeping
   the interim long tail: they open one at a time once 1-100 are cleared) or hides them until R4.
3. Easter eggs (10-15 coins), realm regions and art, the map button (`layout.mapName`, "Map" for now).
4. Keep `gallery.openAt` (e1-04, the first quest's level) or drop it with the Gallery screen.
5. Any engine change must keep `tools/freeze.js --require` at 0 differences (the baseline is these files).
