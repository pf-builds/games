# Sapper's Path feature: organic moats (2026-10-06)

The land factory's first board feature, first used by Land 2 (levels 251-300). Peter's call (2026-10-06): "dynamic moats
like earlier levels, but instead of a straight line left to right, it could be around an image organically with 1 or 2
openings." Source: the orchestrator's feature brief of 2026-10-06; `game-research/sappers-path-v4/land-factory.md`;
`tools/lands-foundation-notes.md` (the `land-bake.js FEATURES` extension point). Peter was asleep: every call below is
mine and written down so he can overrule it. Resume table: `tools/v5-progress.md`, "Feature: organic moats". How a land
turns it on: `tools/land-runbook.md` §1.

Nothing about the live game changes: no land is installed on the branch, no shipped file under `src/`, `levels/`,
`map/`, `config.json` or `index.html` changed (no cache-tag bump needed), levels 1-200 and pictures 1-60 are
byte-identical (freeze PASS).

## 1. What a moat is

A ring of water round the picture's subject, one stud wide, standing a cell or two off it, with 1 or 2 ways in. A way
in is either where the subject itself meets the picture's edge (it is dug from the frame there, as any picture is) or a
gap cut through the water. When the ring has a cut, the bank between the water and the subject is a path of open ground
(as a castle's bank path behind its drawbridge, `tools/castle.js moat`): once the cut is dug through, the subject's
outline opens.

- **Engine: no change.** A picture board already takes water and open ground anywhere inside its frame (only the frame
  itself is limited: water there on the side columns only). Water is never eaten and never walked, open ground is
  walked; reachability, distance and the tie-break are SPEC-v3's. So a moat level is ordinary level data: `~` and `,`
  cells in `grid`, and `liquid` when it isn't plain water.
- **critic-v5: no change.** Its rules already read `~` as water and `,` as open ground on every board; no new rule.
- **The page: no change.** Picture boards draw water as the flat water stud with its wave (`board.pic.water`, or
  `board.pic.liquids[liquid]`), open ground as ground: the same look as every castle moat since realm 2. The ring is a
  staircase of studs that follows a smooth curve (shots in §6); I kept the stud style rather than a joined channel so
  the castle moats and the land moats read as the same thing.

## 2. How the ring is built (`tools/moat.js`; numbers in `tools/land-config.json` `plan.moat`)

1. **The subject.** The background is the run of background colours connected to the picture's outer ring: a masked
   picture's `bg`, else a set of the colours on the outer ring (every non-empty set of the top `bgTop` 3 with `bgMin`
   10% of the ring or more is tried). What is left, its biggest 8-connected part plus parts at least `partOf` 25% of
   it, closed by a disc of `close` 3 cells (bays between ears and arms filled) with its holes filled, is the subject.
   The set kept scores best on share - `contactWeight` x contact (contact: the share of the outer ring the subject
   covers), within `subject` 8-60% of the picture and `maxContact` 40%. On AI art with a plain backdrop (Kitten Forest,
   the style of Land 2) this is simply "everything that isn't the backdrop"; on paintings it is a guess (§7).
2. **The bank.** The subject grown by a disc of `gap` 1.5 cells, smoothed once by majority, never thinner than one cell
   round the subject (8-way).
3. **The ring.** The cells outside the bank that touch it 8-way: a one-stud channel whose steps share an edge, so it
   reads as a curve, not a dotted diagonal (`width` 2 would add a second row; not used). Water and path only ever
   replace cells outside the subject.
4. **The picture's edge.** Where the bank runs into the edge, the ring squeezes through along the edge on the bank's own
   edge cells; it stops only where the subject itself meets the edge, and the subject is dug from the frame there:
   that stretch is a way in. Two such stretches with `merge` 10 or fewer edge cells between are one (the notch between
   stays picture and its short arc goes dry). More than `maxEdge` 2: the picture can't carry a ring.
5. **Ways in (the openings rule).** The plan names faces: `front` (the ring nearest the entry), `far` (farthest from it),
   `left`, `right`. A face is served when a way in (an edge stretch or an earlier cut) lies within `serve` 8 cells of
   its best ring cell; otherwise the ring is cut there: a gap of open ground within `open` 1.5 cells of one of the
   `pick` 4 best crossing cells for that face (seeded by the candidate), `apart` 8 cells from every other way in and
   clear of the picture's edge (a cut on the edge would join the path to the frame at once). `maxWays` 2 in all. No
   drawbridge, no key: the castle's drawbridge rule doesn't apply.
6. **The path.** When the ring has a cut, the bank is open ground, except within `edgeKeep` 3 cells of an edge way in
   (those stay picture); with no cut the whole bank stays picture. The path never joins the frame before anything is
   dug (checked). §3 says why.
7. **Checks in the builder.** Every cell left is reachable 4-way from the frame once dug (a pocket of `pond` 4 cells or
   fewer outside the subject becomes water; a bigger one, or any of the subject, fails); `minRing` 24 cells of water.
8. **The water's colour.** Plain water unless a picture colour stands within `waterDE` [20, 14] CIEDE2000 of it (base
   colours 20, the converter's own floor between picture colours; shades 14, the shade floor), then the first of the
   profile's `liquids` that clears every colour (`mire`, then `lava` if a land lists it), else the picture can't carry
   one. Nothing new in config: the liquids are the castle's.

## 3. Why the path, and why only behind a cut (measured)

Three versions, measured by hard-rule deals inside the 15 s and 55-tap caps (16 tries a board and opening set,
`dealtest`) and by baking the demo's Extreme levels:

1. **The bank left as picture** (my first build, the brief's wording read literally). The inside opened one block at a
   time through a 3-cell gap and every sapper walked the long way round: deals fell to 0 on most ringed boards (kf05
   12 -> 0, kf08 10 -> 0, cliff walk 14 -> 0, against 0-16 without a ring). Short landings of path inside each gap (6
   or 12 steps) did not bring them back.
2. **The whole bank as a path** (the castle's answer: a bank path behind the drawbridge). Deals came back (kf05 10, kf08
   3, kf28 13 where it had 0 without a ring, cliff walk 15). But where the subject meets the edge, digging one edge
   block joined the path and opened the whole outline at once: the subject lost its depth. Stacks of Wheat as an Extreme
   level went from 0.75% random wins and lookahead 0.08 without a ring to 11.5% and 0.90 with it (band 0-6%, ceiling
   0.25), on all 8 candidates.
3. **The path only behind a cut, kept 3 cells off edge ways** (shipped). Ways in at the edge are dug as picture; a cut
   leads onto the path. Stacks of Wheat Extreme: 2.5% and 0.25 (extra candidates: 1.25%, 0.19); Blue Armchair Hard 5.5%
   and 0.22; Boating Normal fine. Deals on the 8-board kitten sample stay close to version 2 (kf08 lost its 3).

On a wider sample of Kitten Forest boards (kf26-kf56, 31 boards, version 2): 24 carry a ring; 20 of those deal with
front and far ways in, 13 with a single far way in; 24 deal at all without a ring (a ring helps some boards: it takes
blocks off).

## 4. Openings by tag, and the ladder

- `plan.moat.ways` (gentlest first): 0 `front + far`, 1 `left + right`, 2 `front`, 3 `far`. The profile's
  `features.moat.ways` [lo, hi] is the range a land uses (default [0, 3]); the tag picks inside it as for every other
  amount (`land-plan.js amt`): Easy 0, Normal 1, Hard 2, Extreme 3.
- **The ladder (my call).** A single far way in, or left and right ones, can walk a sapper past the 15 s cap (the sapper
  for a block near the entry walks round the whole ring). So a level's candidates step down from its planned set to the
  range's lowest in turn (planned, planned-1, ... lo, planned, ...), and the pick takes the planned set whenever a
  candidate on it meets every target (`land-bake.js`: good first, then the smallest step down). The bake records
  `moat: {set, drop, water, path, edge, cuts, ways, liquid}`; the report prints the ring and its ways per level.
- Ways in a level ends up with: 1 or 2. An edge stretch counts, so a subject sitting on the bottom edge serves `front`
  from there (a Hard level is then one way in at the bottom; an Easy one adds a far cut).

## 5. Plan, profile, density, factory

- **Tags/density** (`tools/tags.js`): `BOARD = ["moat"]`, a board feature a land may list. `featuresOf` already counted
  any water as `moat`. `landDensityOK` reads the land's features less the level's `cant` (below): Easy at most 1
  feature, Normal no lock, Extreme every feature the picture can carry and the lock; features per level never fall
  with the tag (`planCheck`); `sharesOf` reports the moat share.
- **Plan** (`tools/land-plan.js`): moat is assigned like a deck feature (Extreme first, then Hard, Normal, Easy; an Easy
  level only if it has no feature yet). New optional argument `can` ({moat: [bool per level]}): a picture that can't
  carry a ring is skipped for it, Extreme included, and its plan says `cant: ["moat"]`. The amount is `p.moat`, the
  ways index. A land without `moat` in its features plans exactly as before (Land 1 untouched).
- **Bake** (`tools/land-bake.js`): `FEATURES.moat` builds the ring first, before mystery blocks and the lock; the
  subject is worked out once a level. Also fixed on the way: a key dug in on a mystery block now drops that block's flag
  (the engine refuses a mystery flag on a key, so such a candidate used to be lost; Extreme levels hit it).
- **Factory** (`tools/land.js`): `bake` first asks each main picture whether it can carry a ring with the profile's
  gentlest set (state.json `moat: [{n, ok, why}]`, printed); `assemble` writes `liquid` and `cant` on a level and zeroes
  the shade digit on every cell the bake changed (water, path, a dug-in key: a shade belongs to the colour the picture
  drew there; the key cell was an old latent fail of the shade gate); `check` adds the gate "organic moats: water and
  path only off the subject (worked out again from the converted board), every block reachable from the frame once
  dug, 1 or 2 ways in; none in a land without moats", side quests must have no water, and the level table shows each
  ring ("ring 87, 1 way").
- **Numbers**: `land-config.json` `plan.moat` (how a ring is built) and `profile.features.moat` (`share` 0.5, `ways`
  [0, 3], `liquids` [null, "mire"]): the default profile, used only by a land that lists `moat`.

## 6. The demo ("Moat Test", never shipped)

Built on a scratch game copy (session scratchpad `moat-demo/game`, the land at `tools/lands/00-moat`, Wandering Gallery
`tools/lands/_gallery`), never in `levels/` on the branch. 8 of the 20 Impressionist test paintings
(`/Users/peter/local-ai/outputs/pd-art-test/`) as levels 201-208 with moats on (`profile.features.moat.share` 1,
liquids water, mire, lava), 2 more as side quests; map from the castle's sheets 7 and 3 (`fromLayout`), 4 levels a sheet.

The pick (my call): the brief asked for the "yes" paintings, but only 2 of the 7 clear yeses carry a ring (Boating,
Little Girl in a Blue Armchair), so I kept 2 yeses that can't (to show the `cant` path: Watering Can, a slate dress too
near every water colour; Two Sisters, a ring that would shut in 7 cells) and filled with "maybe" paintings that carry
one. Acrobats (no Extreme deal even without a ring) and Two Young Girls at the Piano (Extreme band 7.5-8% with or
without a ring) were tried at 204 and dropped for Stacks of Wheat.

| Level | Tag | Picture | Ring | Ways in | Path | Real pace | Taps | Rate (band) | Lookahead |
|---|---|---|---|---|---|---|---|---|---|
| 201 | Normal | Boating (Manet) | 118 water | 2: the subject's edge + a left cut (left+right planned) | 120 | 201 s | 47 | 16.3% (5-20) | 0.99 |
| 202 | Normal | A Girl with a Watering Can (Renoir) | can't carry one (colour) | - | - | 216 s | 55 | 16.0% (5-20) | 0.97 |
| 203 | Hard | The Child's Bath (Cassatt) | 87 water | 1: the subject's bottom edge (front) | 0 | 262 s | 53 | 4.5% (0-10) | 0.10 |
| 204 | Extreme | Stacks of Wheat (Monet) | 77 lava | 1: the subject's right edge (serves far) | 0 | 179 s | 41 | 2.5% (0-6) | 0.25 |
| 205 | Easy | The Boating Party (Cassatt) | 62 water | 2: the subject's edge (far) + a front cut | 80 | 162 s | 44 | 40.3% (25-60) | 0.98 |
| 206 | Normal | Two Sisters (Renoir) | can't carry one (pocket) | - | - | 221 s | 55 | 17.0% (5-20) | 0.85 |
| 207 | Hard | Little Girl in a Blue Armchair (Cassatt) | 91 water | 2: two edge stretches | 0 | 231 s | 53 | 5.5% (0-10) | 0.22 |
| 208 | Extreme | Cliff Walk at Pourville (Monet) | 109 lava | 2: the subject's edge + a front cut (far planned; stepped down to front+far) | 115 | 230 s | 48 | 4.8% (0-6) | 0.08 |

- **Every gate passed on the first fresh bake, no fix-ups** (`land.js` all steps, 3:20 wall on 16 threads): stored
  orders win on their tags with no power-up, 5 spaces, longest tap 14.4-15.0 s, taps 41-55, real pace 162-262 s with
  the land's median 216 s, 0 fallbacks, the profile and density, shades on their floors, the moat gate (6 of 8 ringed,
  2 can't), side quests plain, re-grade 0, the map, licences. Moat share reached 0.75.
- Installed on the copy (`land.js install --game COPY`, the branch's tools copied in): `tools/test.js` 616 passed, 0
  failed (its per-land loop ran on the land); `regrade.js` 0 of 1,203 and `--gallery` 0 of 372; `freeze.js --snapshot`
  then `--require` PASS (208 levels, 62 pictures, 283 castle cases, 0 differences); `critic-v5/run.sh` 0 mismatching
  games of 9,042 (274 levels), grade mismatches 0, tags 0 problems, known answers 0 wrong, real pace 270/270
  identical; `SP.selfTest()` 799 passed at 375x812@3x and 801 at 1280x720, 0 failed, 0 console messages.
- **Looked at** (`tools/shots-moats/`, gitignored; `tools/shots-moats.mjs` remakes the phone and desktop shots):
  `phone-201/203/205/208-start` and `-mid` (375x812@3x; mid = 14 taps of the stored order played patiently, then one
  more under way), `desktop-201-*`, `contact.png` (each level's converted picture beside its moat board) and
  `kitten-rings.png` (18 rings on 9 Kitten Forest boards, front+far and far: how rings read on Land 2's kind of art).
  Mid-play the outside is dug away and the ring stands round the subject like a moat round an island; on the AI
  boards the path reads as a shore inside the water. On the busier paintings the ring is harder to pick out (Blue
  Armchair's turquoise chairs beside the water), as expected from §7.

## 7. For the factory loop (Land 2 and on)

- Turn it on in the land's `land.json`: add `"moat"` to `features`; tune `profile.features.moat` (share, ways range,
  liquids) only if the default isn't right. Land 1 (Kitten Forest) doesn't list it: off.
- **Pictures that carry a ring well**: one subject on a plain backdrop with a few cells of room round it, touching at
  most two edges (sitting on the bottom edge is fine: that's the front way in), no colour close to water blue (or the
  land lists another liquid). 78 of the 103 Kitten Forest boards carry one geometrically (11 touch too many edges, 9
  fill too much or too little of the picture, 4 have a colour too near both water and mire, 1 shuts in a pocket). For
  Snack Galaxy's prompts: "centred, with space around it" for most pictures. Paintings are poor hosts (busy edges, blue
  skies, slate dresses): 7 of the 20 Impressionist test paintings carry one (9 with lava allowed), 2 of the 7 clear
  yeses.
- A picture that can't carry a ring is simply baked without one (`cant`); put moat-carrying pictures on the Extreme
  spots of the land's order so every Extreme level has one.
- Lookahead and band misses on Extreme are picture-dependent, as before moats (the demo's girls-at-the-piano misses the
  Extreme band without a ring too): `--extra` fix-ups first, then swap the picture.

## 8. Checks

On the branch (no land installed; the live game), final run: `tools/test.js` 615 passed, 0 failed; `freeze.js
--require` PASS (levels 1-200, pictures 1-60, 283 castle cases, 0 differences); `regrade.js` 0 of 1,155 and `--gallery`
0 of 360; `critic-v5/run.sh` 0 mismatching games of 8,712, tags 0 problems, known answers 0 wrong, real pace 260/260
identical (`diff-result.json` changed only its ms: restored); `SP.selfTest()` 781 passed at 375x812@3x and 783 at
1280x720, 0 failed, 0 console messages; `tools/harness.mjs` (run last) all passed, 0 console messages.
`tools/test.js` adds 5 checks (the ring, the edge, colour and reach, tags and plan, the fixture bake; the extension
point check now names the hazard as the feature with no builder).
