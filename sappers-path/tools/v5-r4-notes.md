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
