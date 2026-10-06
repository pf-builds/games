# Sapper's Path Land 1: Kitten Forest (levels 201-250), bake and install (2026-10-06, overnight)

Land factory stages 4-5 for the first land (`game-research/sappers-path-v4/land-factory.md`). Brief: the orchestrator's
Land 1 brief of 2026-10-06 (Peter asleep; every call below is mine and written down so he can overrule it). Procedure:
`tools/land-runbook.md`. Resume table: `tools/v5-progress.md`, "Land 1 Kitten Forest". Inputs: the picks and the map
from `game-research/sappers-path-v4/lands/01-kitten-forest/` (README and `map/README.md`).

**Update (fix pass, same day): §10.** After the critics, Land 1 was re-baked twice: first harder, then, on Peter's direction
change (the picture lands become a relaxed mode; difficulty goes to the castle campaign), as a casual land. §1-§9 below
describe the first install; §10 the land as it now stands.

**Result.** Kitten Forest is installed on the branch: levels 201-250 (era 9), 12 Wandering Gallery side quests (pictures
61-72), map sheets 26-32 from the land's 2 WebP sheets (A, B, A', B', A, B, A'), three new egg kinds, castle sheet 25's
top retouched. Every land.js gate passed (0 fallbacks, median real pace 243 s). On the branch: test.js 616/0, freeze PASS
(levels 1-200 and pictures 1-60 unchanged; 201-250 are NOT in the frozen set yet: `freeze.js --snapshot` after the
critics), regrades 0 of 1,455 and 0 of 432, critic-v5 0 mismatching games of 10,758, selfTest 893 and 895 passed, 0
failed, 0 console messages, harness (§8). Nothing pushed.

## 1. The land folder (`tools/lands/01-kitten-forest/`)

- `land.json`: k 1, "Kitten Forest", levels 201-250 (era 9, ids `e9-201`...), source `ai` (FLUX.1 [schnell], Apache-2.0,
  run on the studio's Mac), features linked, mystery, hidden, lock (no moat: moats start at 251), eggs kitten, yarn, fish,
  butterfly, shading on, the profile (§2), the 50 picks in the picks' difficulty order, the 2 map sheets and templates.
  Lore (banner and realm card): "Past the Goblin King's throne the road runs on into a lantern-lit wood of giant
  toadstools, where kittens nap, play and make mischief in every glade."
- `pictures/manifest.json`: all 77 "yes" boards (50 picks, 27 spares) from `picks.json` `landManifest`, each with its
  title, kind, licence ("Original work (generated with FLUX.1 [schnell], Apache 2.0)"), seed, prompt and model. As the
  picks README warns, `file` is the subject-cropped 160 px source with its fixed chroma, so convert gives back exactly the
  boards the picks were judged on: **50 of 50 grids, palettes and shade rows identical** to `boards/<key>.json` (checked).
  `url` holds the source line the licence gate asks for ("Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed N;
  prompt in tools/lands/01-kitten-forest/pictures/manifest.json"), as LICENSES.md words the Gallery's own pictures.
- `src/` (50 sources, 1.3 MB in git), `map/` (the 2 WebP sheets, 228 and 231 KB, and `templates.json`, copied from the
  map stage unchanged).

## 2. The difficulty profile (land.json `profile`, merged over land-config's default)

Peter's call: difficulty keeps climbing past 200 (playtesters find the early levels easy), with a sawtooth inside each
land. The brief: clearly harder than 101-200 on average, Hard and Extreme really hard (lower random-tap and lookahead
win rates than 151-200), every invariant kept.

- **Tags E4 / N21 / H17 / X8** (brief: about 4/20/18/8). `landTags` lays them out as five runs, each a Normal lead,
  a Hard run rising to an Extreme peak, and an Easy breather after it (none after the last):
  `NNNNN HHHH X E NNNN HHHH X E NNNN HHH XX E NNNN HHH XX E NNNN HHH XX` (201-205 Normal, 206-209 Hard, 210 Extreme,
  211 Easy, ... 250 Extreme). I took one Hard off the brief's 18 so every run is 5 long with 4 breathers (`run` [3, 5],
  the default's longest); 18 would have made a run of 6. Later peaks are 2 Extremes, so the land climbs.
- **Features** (deck only, no moats): ? cards on 40% (20 levels, 3-4 each), mystery blocks on 30% (15 levels, 23-30% of
  the picture), linked squads on 36% (18 levels, 2 pairs each), a lock on every Hard and Extreme (25: 21 colour, 4 key
  where the gilt clears the picture by 20 ΔE00), as 101-200 do. The plan gives each feature to Extreme first, then Hard,
  so at these shares the Normals are plain pictures (their difficulty is the band and the ceiling) and the features pile
  up in each hard run. Reached exactly: mystery 0.40, hidden 0.30, linked 0.36, lock 0.50.
- **Mystery blocks: a gap rule** (`land-config plan.hidden.gap` 1, `land-bake.js hidePic`). Asked for 0.26-0.34 of the
  buried blocks, the foundation's hidePic hid only about 15% of the picture: overlapping blobs merged into groups the
  24-block cap then trimmed (measured: 0.2, 0.3, 0.4 and 0.5 all came out 12-15%). Blobs now keep a cell clear of each
  other, so the share asked is the share hidden (0.3 -> 26%). `of` [0.18, 0.34] gives 23-30% of the picture.
- **Bands and lookahead ceilings** (the castle's 151-200: Normal 0-10%, Hard and Extreme 0-5%, a 0.25 ceiling on all
  three): Easy 20-45% (no ceiling: the breathers), Normal 1-7% and 0.30, Hard 0-1% and 0.15, Extreme 0-1% and 0.10.
  - The first full bake had no Normal ceiling (the default profile has none) and its Normals came out with a one-move-
    lookahead win rate of 0.86 against the castle Normals' 0.12. So `land-bake.js` now narrows any tag the profile gives
    a ceiling (not only narrowFor's Hard and Extreme), and toward `tune.narrow.under` 0.6 of it: narrowed to the ceiling
    itself, the grade's fresh sample landed over it about half the time.
  - Normal at 0.15 and 0.20 left 11 and 6 levels with no candidate under it in 22-30 tries: a plain picture's lookahead
    rate depends mostly on the picture (few colours, one big subject). 0.30 is where every Normal picture had one.
  - Hard and Extreme bands of 0-1%: the pick leans to the band's middle, so a 0-5% band picks around 2.5%.
- **Pictures moved, not swapped out**: the 4 pictures no Normal ceiling could hold (snow leopard cub kf85, bath time kf99,
  lion cub kf83, soccer kick kf36) took the 4 Easy breathers, and 6 that wouldn't go under the Hard ceiling traded places
  with Normal pictures that did: 16 of the 50 slots changed (204, 211-213, 218, 219, 221-225, 227, 231, 232, 241, 246).
  Same 50 pictures, no spares used; no two neighbours share a category (checked against picks.json).
- **Pace aim 200 s** (default 225): the locked Hard and Extreme levels play long (medians 268 and 265 s), so the pick
  leans the rest shorter. The land's median is 243 s (4:03), inside the 200-250 s gate but above the 3:45 aim; per level
  178-298 s. Shortening the locked levels would mean bigger squads or fewer locks, which I left alone.
- **Bake history**: one full run (13 min on 16 threads), then seven re-bake runs with 12-38 candidates a level as the
  ceilings moved (about 3 hours wall in all). Each level's record is the pick that met every target of the final
  profile; where two runs both met them (9 long Normals re-baked for pace), the shorter pick was kept.

**Measured against the castle** (stored picks, each level graded on its own tag):

| | 101-200 | 151-200 | Land 1 |
|---|---|---|---|
| Random-tap win rate, all levels (mean / median) | 7.85% / 2.00% | 6.50% / 1.50% | 4.30% / 0.75% |
| One-move lookahead, all levels (mean) | 0.212 | 0.211 | 0.188 |
| Normal: rate median, lookahead median | 4.0%, 0.11 | 5.25%, 0.12 | 4.0%, 0.18 |
| Hard: rate median, lookahead median | 1.0%, 0.09 | 0.50%, 0.11 | 0.25%, 0.09 |
| Extreme: rate median, lookahead median | 1.0%, 0.19 | 1.0%, 0.18 | 0.25%, 0.01 |
| Easy: rate median | 46% | 48% | 32% |
| Real pace median | 226 s | 227 s | 243 s |

Hard and Extreme are clearly harder on both measures (Extreme's lookahead 0.01: a one-move-lookahead player almost
never wins one). Easy breathers are harder. Normal levels are a little easier for a lookahead player than the castle's
(0.18 against 0.12) at a similar random-tap rate: the honest weak spot. The land as a whole is harder on every average.

## 3. The levels

Every level: the stored order wins on its tag with no power-up, at most 5 spaces in use, longest tap 14.1-15.0 s, 42-55
taps, real pace 178-298 s (median 243 s), in band, under its ceiling, 0 fallbacks; shades on their floors (14 / 12
ΔE00). Real pace is the critic's patient replay with thinking time (factor 1.77).

| Level | Picture | Board | Colours | Tag | Features | Rate (band) | Lookahead | Real pace | Longest tap | Taps |
|---|---|---|---|---|---|---|---|---|---|---|
| 201 | Teacup kitten (kf01) | 42x45 | 5 | normal | - | 2.00% (1-7) | 0.14 | 3:41 | 14.9 s | 55 |
| 202 | Too-big hat (kf15) | 35x46 | 5 | normal | - | 6.75% (1-7) | 0.13 | 3:26 | 14.6 s | 55 |
| 203 | Pumpkin peek (kf80) | 42x42 | 4 | normal | - | 4.25% (1-7) | 0.18 | 2:58 | 15.0 s | 55 |
| 204 | Apple weights (kf45) | 42x41 | 6 | normal | - | 2.75% (1-7) | 0.2 | 3:50 | 15.0 s | 52 |
| 205 | Marching drum (kf27) | 38x46 | 5 | normal | - | 5.25% (1-7) | 0.27 | 4:10 | 14.8 s | 55 |
| 206 | Cucumber fright (kf51) | 41x46 | 5 | hard | 4 ?, hidden 25%, 2 linked, colour lock | 0.75% (0-1) | 0.01 | 4:44 | 14.7 s | 53 |
| 207 | Heart balloon (kf10) | 34x46 | 5 | hard | 4 ?, 2 linked, colour lock | 0.00% (0-1) | 0.11 | 4:34 | 14.5 s | 55 |
| 208 | Slam dunk (kf37) | 42x44 | 4 | hard | 2 linked, colour lock | 0.00% (0-1) | 0.12 | 4:48 | 14.7 s | 55 |
| 209 | Glowing flower (kf62) | 42x39 | 4 | hard | hidden 26%, key lock | 0.00% (0-1) | 0.09 | 4:09 | 14.7 s | 54 |
| 210 | Violin (kf29) | 41x46 | 4 | extreme | 4 ?, hidden 28%, 2 linked, colour lock | 0.00% (0-1) | 0 | 4:30 | 14.8 s | 53 |
| 211 | Snow leopard cub (kf85) | 42x40 | 4 | easy | - | 32.25% (20-45) | 1 | 3:06 | 14.8 s | 48 |
| 212 | Upside down (kf20) | 35x46 | 4 | normal | - | 2.00% (1-7) | 0.23 | 4:08 | 14.7 s | 55 |
| 213 | Mirror lion (kf55) | 42x41 | 5 | normal | - | 4.00% (1-7) | 0.28 | 4:17 | 14.9 s | 52 |
| 214 | Kite flying (kf47) | 36x46 | 4 | normal | - | 4.50% (1-7) | 0.18 | 4:38 | 14.7 s | 55 |
| 215 | Big yawn (kf23) | 41x46 | 5 | normal | - | 4.25% (1-7) | 0.18 | 3:55 | 14.6 s | 54 |
| 216 | Tuba (kf28) | 42x46 | 5 | hard | 4 ?, colour lock | 0.75% (0-1) | 0.14 | 4:44 | 15.0 s | 54 |
| 217 | Paper bag (kf14) | 40x46 | 5 | hard | 3 ?, hidden 24%, colour lock | 0.25% (0-1) | 0.08 | 3:41 | 14.8 s | 55 |
| 218 | Fox friend (kf67) | 42x40 | 5 | hard | 3 ?, key lock | 0.00% (0-1) | 0.13 | 3:51 | 14.7 s | 55 |
| 219 | Skiing (kf44) | 36x46 | 5 | hard | 4 ?, hidden 26%, 2 linked, key lock | 0.25% (0-1) | 0.1 | 4:35 | 15.0 s | 55 |
| 220 | Firefly (kf61) | 40x46 | 5 | extreme | 4 ?, hidden 28%, 2 linked, colour lock | 0.25% (0-1) | 0 | 4:28 | 14.9 s | 55 |
| 221 | Bath time (kf99) | 42x44 | 4 | easy | - | 32.25% (20-45) | 1 | 3:06 | 14.8 s | 52 |
| 222 | Siamese (kf92) | 34x46 | 5 | normal | - | 4.00% (1-7) | 0.19 | 3:35 | 14.8 s | 54 |
| 223 | Scruff carry (kf96) | 41x46 | 5 | normal | - | 3.50% (1-7) | 0.09 | 4:00 | 14.7 s | 55 |
| 224 | Signpost nap (kf50) | 37x46 | 7 | normal | - | 4.50% (1-7) | 0.19 | 4:08 | 14.7 s | 54 |
| 225 | Dragonfly ride (kf73) | 42x41 | 8 | normal | - | 2.75% (1-7) | 0.06 | 3:53 | 15.0 s | 55 |
| 226 | Tiger cub (kf84) | 42x42 | 5 | hard | 3 ?, 2 linked, colour lock | 0.75% (0-1) | 0 | 4:09 | 14.7 s | 51 |
| 227 | Stuck up a tree (kf25) | 32x46 | 6 | hard | hidden 23%, key lock | 0.50% (0-1) | 0.03 | 3:26 | 15.0 s | 51 |
| 228 | Strawberry hug (kf08) | 42x39 | 6 | hard | 2 linked, colour lock | 0.25% (0-1) | 0.07 | 3:30 | 14.1 s | 54 |
| 229 | Red guitar (kf30) | 38x46 | 6 | extreme | 4 ?, hidden 27%, 2 linked, colour lock | 0.00% (0-1) | 0.07 | 3:51 | 14.9 s | 55 |
| 230 | Bread face (kf52) | 42x39 | 7 | extreme | 4 ?, hidden 29%, 2 linked, colour lock | 0.25% (0-1) | 0.05 | 4:25 | 14.9 s | 55 |
| 231 | Lion cub (kf83) | 42x39 | 4 | easy | - | 35.25% (20-45) | 1 | 3:32 | 15.0 s | 42 |
| 232 | Staring contest (kf56) | 42x39 | 5 | normal | - | 2.25% (1-7) | 0.25 | 4:34 | 14.8 s | 52 |
| 233 | Skateboard (kf38) | 42x44 | 6 | normal | - | 5.75% (1-7) | 0.19 | 3:54 | 14.8 s | 54 |
| 234 | Mushroom house (kf60) | 34x46 | 6 | normal | - | 5.00% (1-7) | 0.24 | 3:38 | 14.5 s | 53 |
| 235 | Calico stretch (kf95) | 40x46 | 6 | normal | - | 5.00% (1-7) | 0.28 | 4:22 | 14.8 s | 55 |
| 236 | Leaf on face (kf21) | 42x42 | 6 | hard | 4 ?, 2 linked, colour lock | 0.50% (0-1) | 0 | 4:03 | 14.7 s | 48 |
| 237 | Leaf surfing (kf39) | 42x45 | 6 | hard | 4 ?, colour lock | 0.50% (0-1) | 0.11 | 4:33 | 14.9 s | 55 |
| 238 | Heart curl (kf100) | 38x46 | 6 | hard | 3 ?, 2 linked, colour lock | 0.25% (0-1) | 0.1 | 4:41 | 14.9 s | 55 |
| 239 | Blanket bundle (kf06) | 34x46 | 7 | extreme | 4 ?, hidden 27%, 2 linked, colour lock | 0.00% (0-1) | 0.05 | 3:41 | 14.8 s | 54 |
| 240 | Conductor (kf33) | 38x46 | 7 | extreme | 4 ?, hidden 27%, 2 linked, colour lock | 0.25% (0-1) | 0.01 | 4:58 | 14.4 s | 55 |
| 241 | Soccer kick (kf36) | 42x35 | 5 | easy | - | 31.50% (20-45) | 1 | 3:20 | 14.6 s | 51 |
| 242 | Ocelot kitten (kf89) | 42x46 | 7 | normal | - | 2.25% (1-7) | 0.16 | 3:42 | 14.9 s | 54 |
| 243 | Rainbow slide (kf72) | 42x39 | 7 | normal | - | 2.25% (1-7) | 0.18 | 3:50 | 14.9 s | 55 |
| 244 | Big blue bow (kf03) | 39x45 | 8 | normal | - | 1.50% (1-7) | 0.13 | 4:20 | 14.8 s | 54 |
| 245 | Lynx kitten (kf87) | 42x42 | 5 | normal | - | 2.00% (1-7) | 0.15 | 3:14 | 14.8 s | 48 |
| 246 | Fish dream (kf54) | 42x45 | 5 | hard | colour lock | 0.25% (0-1) | 0 | 4:13 | 14.8 s | 54 |
| 247 | Serval kitten (kf91) | 42x43 | 7 | hard | 3 ?, hidden 24%, 2 linked, colour lock | 0.50% (0-1) | 0.05 | 4:28 | 14.8 s | 55 |
| 248 | Blueberry bucket (kf76) | 39x45 | 9 | hard | 3 ?, hidden 25%, 2 linked, colour lock | 0.00% (0-1) | 0.09 | 4:49 | 15.0 s | 55 |
| 249 | Green-eyed face (kf07) | 42x40 | 10 | extreme | 3 ?, hidden 30%, 2 linked, colour lock | 0.50% (0-1) | 0.1 | 3:43 | 14.8 s | 50 |
| 250 | Xylophone (kf34) | 42x43 | 11 | extreme | 4 ?, hidden 29%, 2 linked, colour lock | 0.50% (0-1) | 0 | 4:48 | 14.8 s | 55 |

## 4. Wandering Gallery side quests (pictures 61-72)

`tools/lands/_gallery/manifest.json`: the 12 test paintings that read "yes" once shaded (8 of 20 Impressionist, 4 of 20
Floating World), already downloaded for those tests with Peter's OK, copied (not fetched) from
`/Users/peter/local-ai/outputs/pd-art-test` and `pd-art-test-fw` into the gallery's raw folder. Each keeps the test's
crop and chroma, so its board is the one the verdict was given on (12 of 12 identical grids and shade rows). Order: the
two sets interleaved, portrait and landscape alternating where they can, the brightest first (Monet's poppies), Hiroshige's
cat in the middle of a kitten land. They open after levels 204, 208, 211, 216, 220, 224, 227, 232, 236, 240, 243, 248
(every 3-5), with the castle's prize turn (the Volley every 6th). Side-quest bands and pace are the castle Gallery's
(plain boards, no features): they stay the land's optional, gentler pictures.

| # | Title | Artist, date | Museum (object URL in the manifest) | Set | Board | After | Prize | Tag | Rate | Real pace | Taps |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 61 | Poppy Field (Giverny) | Claude Monet, 1890-91 | Art Institute of Chicago | Impressionist | 42x28, 5 colours | 204 | volley | normal | 51.2% | 167 s | 52 |
| 62 | Suido Bridge and Surugadai (the carp streamer) | Utagawa Hiroshige, 1857 | Art Institute of Chicago | Floating World | 31x45, 10 colours | 208 | ladder | easy | 72.5% | 217 s | 55 |
| 63 | A Girl with a Watering Can | Pierre-Auguste Renoir, 1876 | National Gallery of Art | Impressionist | 34x46, 7 colours | 211 | quartermaster | normal | 56.8% | 223 s | 54 |
| 64 | Hakone: View of the Lake | Utagawa Hiroshige, c. 1833-34 | Art Institute of Chicago | Floating World | 42x27, 6 colours | 216 | scout | hard | 17.3% | 219 s | 51 |
| 65 | Two Sisters (On the Terrace) | Pierre-Auguste Renoir, 1881 | Art Institute of Chicago | Impressionist | 38x46, 6 colours | 220 | recall | normal | 53.0% | 212 s | 50 |
| 66 | Boating | Edouard Manet, 1874 | The Met | Impressionist | 42x32, 6 colours | 224 | ladder | easy | 79.8% | 199 s | 47 |
| 67 | Asakusa Ricefields and Torinomachi Festival (the cat) | Utagawa Hiroshige, 1857 | Art Institute of Chicago | Floating World | 33x46, 6 colours | 227 | volley | normal | 44.8% | 205 s | 50 |
| 68 | Little Girl in a Blue Armchair | Mary Cassatt, 1878 | National Gallery of Art | Impressionist | 42x29, 7 colours | 232 | quartermaster | hard | 22.0% | 209 s | 55 |
| 69 | The Letter | Mary Cassatt, 1890-91 | Art Institute of Chicago | Impressionist | 30x46, 5 colours | 236 | scout | normal | 51.5% | 214 s | 54 |
| 70 | The Railway | Edouard Manet, 1873 | National Gallery of Art | Impressionist | 42x35, 5 colours | 240 | recall | easy | 75.0% | 184 s | 51 |
| 71 | Carp Swimming by Water Weeds | Katsushika Hokusai, 1831 | Cleveland Museum of Art | Floating World | 42x32, 5 colours | 243 | ladder | normal | 41.8% | 182 s | 45 |
| 72 | The Boating Party | Mary Cassatt, 1893-94 | National Gallery of Art | Impressionist | 42x33, 5 colours | 248 | quartermaster | hard | 14.0% | 199 s | 52 |

Licences: CC0 / public domain (Art Institute of Chicago, National Gallery of Art and Met open access, Cleveland Museum of
Art CC0); each line carries its object URL and is in LICENSES.md's Land 1 table. For later lands: the Wandering Gallery
now has no unused picture; Land 2 needs about 12 more OK'd downloads, and Impressionist Isle (351-400) must not reuse
these 8 paintings as main levels.

## 5. Eggs

The map stage painted Land 1's egg spots for 4 kinds: a kitten curled on A's giant toadstool, yarn in A's left glade,
the fish in B's stream (an existing kind) and a butterfly on B's red flower bush. The 3 new kinds are drawn in
`src/journey.js` EGGS in the map's ink style (the same 48 px box, ink `#2a1c12` outlines, flat fills, the existing
animation classes), each with a look before and after its tap, and named in config `map.text.eggs`:

| Kind | Before | After (tapped) |
|---|---|---|
| `kitten` | "a sleeping kitten": a ginger tabby curled up, eyes shut, z z twinkling | "a kitten awake and waving": sitting up, a paw waving (bob), a pink heart |
| `yarn` | "a ball of yarn": a red ball with its strands and a loose end | "yarn unrolled across the glade": a long thread and a small ball bobbing away, motion ticks |
| `butterfly` | "a butterfly at rest": wings folded on a yellow flower | "a butterfly on the wing": wings open over the flower, flapping, sparkles |

Not the fallback list: the 3 kinds were cheap to draw (about 15 lines of SVG), so `land.json` uses the recommended
`["kitten", "yarn", "fish", "butterfly"]`. Entry e takes kinds `eggs[2e]`, `eggs[2e+1]`, so every A sheet (26, 28, 30,
32) has the kitten and the yarn and every B sheet (27, 29, 31) the fish and the butterfly. Coins 12-15 each (land seed).

## 6. Castle sheet 25: the 2D retouch of its top

The map stage flagged it: once Kitten Forest sits above the summit, the fog no longer covers sheet 25's top, which shows
painted mist, a horizon at about row 100, a far tower and the painted road bending right to about x = 600, while the
forest's road comes down at x = 384. No image model (the GPU is Land 2's tonight; the brief allows none), so
`tools/map-gen/retouch-25.py` retouches rows 0-340 only:

1. Erases the mist band (rows 0-132), the road's right bend (within 24 px of it) and a faint track the new road would
   cross, feathered over 14 px.
2. Fills them with the sheet's own sepia ground: low frequencies from `cv2.inpaint` (Telea) on a quarter-size copy, then
   the watercolour mottling and the paper grain as blurred noise at the strengths measured on a clean patch of plain
   (noise, not a cloned tile: a mirrored tile showed diamond repeats on the first try).
3. Paints one road from the painted road's turn at (310, 305) up to x = 384 at the top, with the profile measured across
   the painted road lower down (a pale cream band about 26 px wide, uneven inside, a sharp darker edge, a faint wash
   outside).
4. Blends rows 0-150 toward sheet A's bottom row (column by column, blurred across), so the page's 80 px crossfade lands
   on matching ground and road, and the rest reads as haze between the badlands and the forest.

Rows from 352 down differ from the original only by the JPEG round trip (saved with the original's own quantization
tables, subsampling and progressive scan): max 3 levels, 154 pixels over 2 of 1.03 million. 284,371 -> 282,798 bytes.
Before/after: `tools/shots-land-01/sheet25-before-after.png` (the join as the page draws it). The original is in git
history (`git show 35dcf90~1:sappers-path/map/sheet-25.jpg`); `retouch-25.py ORIG A.webp OUT` remakes it.

## 7. The map

- Sheets 26-32: A, B, A' (mirrored), B', A, B, A', each with 8 level spots (sheet 32 holds 249-250; its third spot is
  the frontier, where the fog and the long tail now sit). 12 side quests on painted quest clearings (0 made spots), 14
  eggs (13 shown: one sits in the fog on 32), the plank bridge on every B. Every pair of tap targets is 48+ CSS px apart
  at 375 px (the gate). WebP sheets 228 + 231 KB, reused 7 times.
- **Sheet 25's route above level 200** (my call, `9521c22`): its layout road left the painted road just above 200 and
  crossed the fortress's roofs to the top, which the fog hid until now; with the land built it showed as red dashes over
  the fortress beside the painted road. It now follows the painted road (traced from the sheet) to the retouched road and
  up to x = 384. Only sheet 25's road samples past quest 50's branch changed; levels, quests, the King and eggs did not
  (test.js 615/0 on the castle alone, label positions unaffected).
- The 200 -> 201 join: `shots-land-01/phone-map-join-200-201.png`, `desktop-map-join-200-201.png`.

## 8. Checks (final, on the branch with the land installed)

- `tools/land.js ... check`: every gate PASS (`scratch/report.md`).
- `tools/test.js`: 616 passed, 0 failed (its per-land loop ran on Land 1).
- `tools/freeze.js --require`: PASS (levels 1-200, 60 pictures, 283 castle cases, 0 differences). **Not yet
  snapshotted**: `freeze.js --snapshot` adds 201-250 and pictures 61-72 to the frozen set after the critics (runbook §4.2).
- `tools/regrade.js`: 0 differences of 1,455 checks (250 levels); `--gallery`: 0 of 432 (72 pictures).
- `tools/critic-v5/run.sh`: 0 mismatching games of 10,758 (326 levels), grade mismatches 0, tags 0 problems, known
  answers 0 wrong, real pace 322/322 identical (`diff-result.json` committed with the new counts).
- `SP.selfTest()` under `?debug=1` (`tools/selftest-lands.mjs`): 893 passed at 375x812@3x, 895 at 1280x720, 0 failed,
  0 console messages.
- `tools/harness.mjs` (last): all passed, 0 console messages (4:46). Its first run failed one check: at 375x667 the
  side quest Suido Bridge (31x45, 10 colours) drew 7 CSS px a cell (gate 8). Measured on every board: at 375x667 34 Land
  1 levels and 5 side quests drew 7-7.5 px, and so did castle level 200 (7.5; the harness only measures levels 1-100 and
  the Gallery). 360x640 already gets 8 px from the short-phone rules (`@media (max-height: 640px)`), but 375x667 is just
  above them and keeps the full chrome. Fix (page, `src/main.js fitBoard` + `style.css`): a portrait phone whose board
  would still fall under `layout.minCellCss` with two queue rows sets `body.tight` and takes the same compact play chrome
  (top bar 38 px, line, tray, power bar), only on the play screen and only for those boards. Measured after: every board
  (castle and land) 8 px or more at 375x667, 360x640, 375x812, 414x736 and 360x740; selfTest 893/0 at 360x640@3x too.
  Screens: `shots-land-01/phone667-206-mid.png`.
- Shots (`tools/shots-land-01/`, gitignored; `tools/shots-land-01.mjs` remakes them, 0 console messages): phone (375x812
  @3x) and desktop (1280x720) each: `map-201`, `map-join-200-201`, `map-225-quest` (side quest 66 open with its ladder),
  `map-eggs-before` / `-after` (sheet 26's kitten and yarn), `201-start`, `206-mid` (Hard: mystery blocks, ? cards,
  links, colour lock, shading), `250-start` / `250-mid` (the Extreme finale), `quest-mid` (Poppy Field); plus
  `sheet25-before-after.png`.
- Playtest bundle: `python3 tools/playtest-bundle.py f934733 <scratchpad>/sp-bundle-land1 "Sapper's Path Land 1 Playtest"
  --jump 4,101,175,200,201,225,250` (14 MB; the bundler now carries `map/*.webp`). Smoke: `playtest-smoke.mjs` OK at
  375x812 and 1280x720; Jump to 201, 225 and 250 then the map (both WebP sheets 200, 7 sheets drawn), the home's
  "Land 1 · Kitten Forest" with Level 250 Extreme, 250 played, side quest 66 loaded; 0 console errors, 0 failed requests.
  Not published (the orchestrator's).

## 9. Calls I made (Peter asleep) and things for the critics

1. Tags E4/N21/H17/X8 (one Hard fewer than the brief's 18, so runs stay at the default's 5).
2. Normal levels are plain pictures (features go to Hard and Extreme first at the brief's shares); a Normal lookahead
   ceiling of 0.30 (the castle's is 0.25) because tighter ones had no candidate for many pictures.
3. 16 picture slots reordered (same 50 pictures); the few-colour ones are the Easy breathers.
4. Mystery-block gap rule and narrowing below the ceiling: two small bake changes, default for every later land.
5. Real-pace median 243 s, not 225: the locked levels play long. Within the gate.
5b. The compact play chrome at 375x667 for boards that would fall under 8 px (§8): a small page change, so the land's
   46-row pictures (and castle level 200) keep the 8 px cell the harness requires.
6. Eggs drawn (kitten, yarn, butterfly), not the fallback kinds.
7. Sheet 25: 2D retouch of rows 0-340, and its route above 200 moved onto the painted road (layout data only).
8. AI pictures' `url` holds a source line (the licence gate needs one; LICENSES.md's wording for our own pictures).
9. For the visual critic: mystery blocks on dark pictures (the black kitten at 206, the navy xylophone at 250) are close
   in tone to the picture's dark squads; the shade tip on 201 is pre-empted by a power-up tip when a save jumps straight
   to 201 (a jumped save has seen no tips); the Wandering Gallery is now empty for Land 2.

## 10. The fix pass after the critics (2026-10-06, morning)

The one fix pass on the functional critic's report (`tools/critic-land-01-functional.md`: 0 blockers, 2 majors, 7 minors)
and the visual critic's (`tools/critic-land-01-visual.md`: 2 blockers, 5 should-fix, 6 nits). Peter asleep: every call is
mine and written here. Checklist: `tools/v5-progress.md`, "Land 1 fixes". Shots: `tools/shots-land-01/fixes/`
(gitignored; `tools/shots-land-01-fixes.mjs` remakes them).

### 10.0 Direction change mid-pass: Land 1 is now a casual land

The brief's first item was M1 (make Land 1 harder than 151-200 for a player who plans). Partway through, the coordinator
passed on Peter's new direction: **the picture lands become a separate, relaxed "Zen" mode open from the start, and the
200-level castle campaign becomes "Campaign Challenge Mode", where difficulty goes up** (another chat rebalances 1-200).
For Land 1 that meant: drop the harder profile and its "careful player below 151-200" targets, use a casual profile
(mostly Easy and Normal, light features, no or very few locks, no Extreme, generous bands), keep every invariant, keep the
new grader tooling for the campaign rebalance, and still fix the steady-pace losses and the long idle waits. Everything
else in the brief stands. No Zen-mode UI was built and no data moved; Land 1 is a self-contained casual land on this
branch.

So §10.1 is the casual land as installed, and §10.2 records the harder profile I had baked and measured before the
change (it is not installed; the tooling it proved is).

### 10.1 The casual Land 1 (installed)

- **Tags E18/N26/H6/X0.** Pairs of Normals, an Easy breather after each, a lone Hard every 7-10 levels (212, 222, 229,
  236, 243, 250), ending on a Hard at 250:
  `nnEnnEnnEnnHEnnEnnEnnHEnEnEnHEnEnEnHEnEnEnHEnEnEnH`. `land-plan.js landTags` now spreads a casual land's few Hards
  evenly (only when there are fewer Hard runs than segments; every profile with more Hards lays out exactly as before:
  the default profile's layout is unchanged).
- **Light features.** ? cards (2-3) on 4 Easy, 13 Normal and all 6 Hard levels (23); linked squads (1-2 pairs) on 4, 10
  and 4 (18); mystery blocks on 8 Normals and 3 Hards (11), 14-24% of the picture, off the subject's face; no locks.
  Features per level: Easy 0.44, Normal 1.19, Hard 2.17. Per-tag shares are a new profile key (`features.<f>.by`, the
  levels with the fewest features first, so ? cards fill the Easy levels that have no link).
- **Generous bands, no ceilings.** Random-tap win rate bands Easy 45-80%, Normal 20-50%, Hard 6-20%; no lookahead or
  careful-player ceilings (the profile sets them to null). Both are still graded per level (`grade.greedy`,
  `grade.careful`, `grade.obvious`), so the campaign rebalance can read them.
- **Rhythm (the functional critic's m2, m3).** Every level now stores `grade.steady`, the stored order tapped at a
  steady 1 s rhythm (bake-config `duration.pace.steady`): every thinking replay (1, 2 and 4 s) must win, which fixes the
  232/247 kind of loss on every level, and the longest wait between two taps must be 15 s or less. Measured: every level's
  thinking replays win, the longest wait between taps is 14.3 s. **The end is not capped:** from the last tap to the
  win is 11-24 s on the steady replay (43 levels over 15 s), because at a 1 s rhythm several squads are still digging
  when the last card goes out; it is watching squads finish, not a wait for a legal tap. Capping it would mean tiny last
  squads on every level, so it is reported (`grade.steady.end`) and parked in LATER.
- **Invariants:** every stored order wins on its tag with no power-up, at most 5 spaces, longest tap 14.3-15.0 s, 42-55
  taps, real pace 201-265 s with the land's median 232 s (3:52; the 200-250 s gate). Land check PASS.
- **Measured with the functional critic's own players** (`players.mjs`, 400 random games and the 3-taps-ahead careful
  player on 6 seeds a level):

| 201-250 | Levels | Random-tap win, mean / median | Careful player (3 taps) |
|---|---|---|---|
| Easy | 18 | 65.7% / 63.0% | 1.00 |
| Normal | 26 | 39.3% / 39.3% | 1.00 |
| Hard | 6 | 10.5% / 10.3% | 0.78 |
| All | 50 | 45.3% / 42.5% | 0.97 |

  For comparison, the land as the critics saw it: random 4.2% mean, careful 0.79; castle 151-200: 6.9%, 0.61. Land 1 is
  now a relaxed land, as Peter asked.
- **The pictures for these tags** (all 50 re-placed): the few-colour boards on the Easy levels, the busiest on the Hards
  (Skateboard, Rainbow slide, Calico stretch, Blueberry bucket, Dragonfly ride, Xylophone at 250). No two neighbours
  share a category, a ground colour family or a coat; no orange cat within two levels of another; near-repeat ideas 10+
  levels apart (§10.3).
- **Bake:** 8 candidates a level (10 a Hard), up to 96 deal attempts each, sharded over the threads (§10.6): 48 of 50 met
  every target in one 5.5-minute run, 209 and 221 in a second run with 16 more candidates each.

### 10.2 The harder profile I baked before the change (measured, not installed)

For the record, and for the campaign rebalance, which will use the same tooling. Profile: E4/N14/H18/X14 (runs split by a
Normal dip), ? cards (3-6) on every Normal, Hard and Extreme level, links on 39 levels, mystery blocks on 29, a lock on
every Hard and Extreme; careful-player ceilings 0.75/0.625/0.5 (16 games) with the bake narrowing toward 0.625/0.5/0.44,
an obvious-player ceiling (one tap deep, 30 games: 0.8/0.6/0.6), lookahead ceilings 0.3/0.2/0.15. It passed the land check
and every game check (test.js 618/0, freeze, regrades, critic-v5 0 mismatches, selfTest x3, harness). With the functional
critic's own players (6 seeds a level, 400 random games):

| Careful player, 3 taps ahead | Normal | Hard | Extreme | All | Random-tap mean / median |
|---|---|---|---|---|---|
| 151-200 (castle) | 0.71 | 0.46 | 0.58 | 0.61 | 6.88% / 1.50% |
| Land 1 as the critics saw it | 0.88 | 0.67 | 0.69 | 0.79 | 4.19% / 0.75% |
| Land 1, harder profile | 0.32 | 0.23 | 0.18 | 0.30 | 4.04% / 0.50% |

The one-move greedy (the critic's m1 player) won no level more than 14 of 30. What it took, worth knowing for the castle:
- The careful player sees everything (it plays the engine), so ? cards and mystery blocks don't move it at all; removing a
  level's ? cards, mystery blocks or even its lock left its rate unchanged on every level I tried. Difficulty for it
  comes from the deal: which squads must wait, in which order, behind which cards.
- Candidates are bimodal (most at 1.0, about a quarter low); the gate plus more candidates and a careful-narrowing stage
  (card moves only) find the low ones. 3-4 linked pairs kept Hard levels out of their random-tap band, so pairs stayed 1-3.
- A full harder land cost about 50 minutes of bake on 16 threads once the candidates were sharded (§10.6).

### 10.3 Pictures: the swaps and the variety check (B2, S1, S2)

Out (7): 227 Stuck up a tree (kf25) and 237 Leaf surfing (kf39), the two that didn't read as kittens at phone size;
249 Green-eyed face (kf07, the near-repeat of Big blue bow and the second full-board orange face with the Lynx); 236 Leaf
on face (kf21, a third ginger front face); 247 Serval (kf91, the spotted wild kitten beside the Ocelot); and, during the
harder bakes, Conductor (kf33, no deal in about 1,900 attempts under the harder profile) and Fox friend (kf67, dealt
rarely and failed every slot). In (7 "yes" spares): kf77 Robin friend, kf13 Daisy crown, kf41 Tennis, kf16 Dandelion
sneeze, kf94 Maine Coon, kf74 Leaf umbrella, kf43 Goalie. Tried and dropped: kf82 Watermelon (deals about 1 in 30, failed
its slots) and kf66 Lotus pad (a white kitten with a pink flower would have sat 6 levels from Glowing flower).

The variety check (scratch `variety2.js` over picks.json's categories, a coat per picture and each prompt's ground colour
family) on the installed order: no neighbours share a category, ground family or coat; no orange cat within two levels
of another; orange or ginger in 241-249: 3 of 9 (was 7). The pairs the critic named, now: 244/249 and 245/249 and
242/247 and 236 are gone (one of each pair is out); 241 Soccer kick / 243 Rainbow slide: now 208 and 222. Watch-list
pairs and their distance: Ocelot 249 / Lynx 205 (44), Tiger cub 234 / Lynx 205 (29), Maine Coon 223 / Lynx 205 (18,
tufted ears), Big yawn 246 / Big blue bow 226 (20, ginger faces), Teacup 201 / Big blue bow 226 (25), Mirror lion 218 /
Lion cub 242 (24), Daisy crown 245 / Tennis 235 (10, cream kittens), Goalie 221 / Soccer kick 208 (13), Leaf umbrella 247 /
Robin friend 214 (33, grey kittens), Bath time 248 / Heart curl 220 (28) and Scruff carry 207 / Heart curl (13, moms).
Categories: forest 9, sport 8, species 8, cute 6, joke 6, music 5, funny 5, mom 3.

### 10.4 Mystery-block fill (B1)

A land level's mystery blocks now draw in their own fill, chosen at assemble from `land-config plan.hidden.fills` (castle
slate `#3a3f63`, plum `#6b4c8a`, forest green `#2e6b2e`, grey lavender `#8f8a9e`, raspberry `#9b2f6b`): the first that
stands 22 CIEDE2000 from every colour and shade of the picture, else the farthest. The level stores `hideC` and `hideQ`
(the "?" colour: cream on the dark fills, ink on the grey). `board.js setLevel` takes it (`hide`) and rebuilds the stud;
a level without one (every castle level) draws in `board.hidden`'s slate exactly as before. The land check and test.js
fail any fill under 20 (the floor between two squads). Installed: 11 levels with mystery blocks, fills 22-32 from their
pictures (plum 6, slate 3, green 1, raspberry 1, for Leaf umbrella, where none of the first four reached 20). selfTest
reads the drawn stud's pixel on a land level and a castle level. Shots: `fixes/mystery-fills.png`, the contact sheets.
(The finale's navy picture no longer has mystery blocks in the casual land; under the harder profile it took green, 28.)

### 10.5 Mystery blocks off faces (S3)

`land-bake.js faceOf` (land-config `plan.hidden.face`): the picture's subject (moat.js `subjectOf`, read loosely), its top
half and every cell whose 3 x 3 holds 3 or more colours (eyes, nose, mouth), grown by a cell, is off limits to `hidePic`.
On the 50 boards it covers 14-63% of the picture (most about a third), so the share asked of the eligible blocks went up
(`of` 0.25-0.40) to keep 14-24% of the picture hidden. Faces read in every shot; on a tall-hat picture (Too-big hat) the
muzzle under the brim can still take a blob.

### 10.6 Tooling (kept for the campaign rebalance)

- `tools/grade.js careful(B, rules, n, seed, depth)`: the critic's careful player. Graded on every land level as
  `grade.careful` (16 games, 3 taps; bake-config `grade.careful`) and `grade.obvious` (30 games, 1 tap; the critic's m1
  player); `pace()` also returns the longest gap between taps and the end, graded as `grade.steady` at 1 s. regrade.js
  checks all three where a level stores them (castle levels don't).
- Profile keys: `careful`, `carefulTune` (the narrowing target, so the gate can move without re-making candidates),
  `obvious` (per-tag ceilings, null for none), `features.<f>.by`, `features.mystery.rows`, `bake` (merged over
  land-config's bake for that land: candidates, deal attempts, deepAlt, careWeight).
- `gen.js carefulStage` narrows the careful player by card moves; `dealBy[tag].deepAlt` alternates deal depth by
  candidate; `careWeight` leans the pick under the careful ceiling.
- `land.js bake --shard S` shares each level's candidates over the threads and runs the picks (with their ? card
  measure) on the threads too; each level's candidates are kept in `scratch/cands/m-<n>.json` (keyed to the picture,
  plan and targets) and `--reuse` takes them back, so more candidates or a changed gate re-pick without re-making the
  old ones. `install --replace` swaps an installed land for a new bake (text-exact: removing Land 1 from config.json and
  LICENSES.md gives back the pre-install files byte for byte). `landTags` splits a run longer than the profile allows
  with a Normal and spreads a casual land's few Hards.

### 10.7 Page fixes

- **Words (M2):** a land level wins with "Picture done" and "Kitten Forest, level N, all dug out." (again: "dug out
  again.") and fails with "A little stuck" (config `lands.text`; calm, for the relaxed lands); a side quest keeps the
  Gallery's "Picture complete!" and fails with "A little stuck"; castle levels keep "Fort razed!" and "Assault failed".
  The map's story line still reads the castle's (LATER).
- **The long tail (m5):** a save from before the lands keeps the long-tail picture it had open. On load, a save without
  the new `lands` flag works out the castle rule over the castle alone (levels 1-200, the pictures' own quest levels);
  any tail picture that rule opens and the save hasn't won goes into `save.tail`, and `save.js questOpen` keeps it open
  wherever the tail now sits. The flag means a player who reaches 200 later waits past the lands as designed. A new
  save gets the flag at its first write. Not in the save code (LATER). test.js and selfTest check it (picture 52 open, 53
  still waiting).
- **Eggs (S4):** `land.json eggTurns` gives each repeat of a sheet its own two eggs, kind and spot (sheet pixels, on
  painted features: toadstool caps, glades, the stream, the flower bush): 26 kitten, yarn; 27 fish, butterfly; 28 owl,
  fairy ring; 29 frog in the reeds, kitten; 30 yarn, butterfly; 31 fish (the far bend), glowcaps; 32 kitten, hare. All 14
  now show (sheet 32's both sit under the frontier). Tiles: `fixes/egg-s*.png`.
- **Short quest titles (S5):** a Wandering Gallery picture may carry `short` (manifest); the play bar shows it, the win
  sheet keeps the full title: Poppy Field, Suido Bridge, Watering Can, Lake Hakone, Two Sisters, The Asakusa Cat, Blue
  Armchair, Carp in the Weeds. selfTest checks every short title fits whole.
- **Play-bar taps (m4):** round buttons sit 8 px apart (no box gives up 2 px to its neighbour) and, on a 38 px bar, reach
  7 px under their face: every one takes a 44 x 44 tap at 360x640, measured as the critic did (selfTest, every size).
- SPEC-v4 §9 has the Land 1 entry (m7). Cache tag `?v=45`.

### 10.8 Checks (final, casual land installed)

Land check PASS (every gate; median 232 s). test.js 618 passed, 0 failed. freeze.js --require PASS (1-200, pictures 1-60,
283 castle cases). regrade.js 0 differences of 1,605 checks (250 levels); --gallery 0 of 432 (72 pictures). critic-v5:
0 mismatching games of 10,758, 0 grade mismatches, tags 0 problems, known answers 0 wrong, real pace and thinks 322/322
identical (diff-result.json committed: the counts changed with the levels). selfTest 900/0 at 375x812@3, 902/0 at
1280x720, 900/0 at 360x640@3, 0 console messages. Harness all passed, 0 console messages (a first run failed one
frame-time check at 1280x720 on castle level 100, p95 33 ms, while my difficulty players and another session's image
job loaded the CPU; re-run on a quiet machine: all passed). 201-250 are NOT in the frozen set.

### 10.9 Calls I made

1. The casual profile's numbers (E18/N26/H6, bands, feature shares, no locks) are mine within the coordinator's outline.
2. `landTags` spreads a casual land's Hards (a small change that leaves every existing layout as it was).
3. Seven pictures swapped (§10.3), two more tried and dropped; the 50 re-laid for the casual tags.
4. The win and fail words: "Picture done", "..., all dug out.", "A little stuck".
5. The steady replay's end is reported, not capped (§10.1).
6. Five mystery fills, picked per level; a raspberry added when Leaf umbrella cleared none of the first four.
7. The harder bake's tooling kept and documented; the harder land itself is not installed.

### 10.10 Left (LATER.md, "Land 1 fix pass")

The map's story line in a land; egg drawings (butterfly at rest, unrolled yarn); sheet 25's retouch at desktop size;
levels.json split per land before Land 3-4; 320x568 cells; weak reads kept (Tiger cub, Upside down, Fish dream, Scruff
carry, Signpost nap); the save code and the kept tail; the steady replay's end; an honest careful player.

### 10.11 The levels (casual, installed)

Rate: random-tap win rate on the tag. Lookahead: the one-move-lookahead player. Careful: the careful player (16 games, 3
taps ahead). Steady: the stored order at a 1 s rhythm, its longest wait between taps and from the last tap to the end.
Fill: the mystery-block fill and its distance (CIEDE2000) from the picture.

| Level | Picture | Tag | Features | ? cards | Links | Hidden | Rate | Lookahead | Careful | Real pace | Longest tap | Steady gap / end | Taps | Fill |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 201 | Teacup kitten (kf01) | normal | 1 | 2 | - | - | 33.00% | 1 | 1 | 251 s | 14.9 s | 10.9 / 22.4 s | 52 | - |
| 202 | Red guitar (kf30) | normal | 1 | 2 | - | - | 42.75% | 0.96 | 1 | 247 s | 15.0 s | 13.3 / 20.0 s | 49 | - |
| 203 | Paper bag (kf14) | easy | 0 | - | - | - | 59.75% | 1 | 1 | 217 s | 14.9 s | 8.9 / 12.6 s | 52 | - |
| 204 | Heart balloon (kf10) | normal | 1 | 2 | - | - | 43.75% | 0.99 | 1 | 222 s | 14.9 s | 7.1 / 18.2 s | 48 | - |
| 205 | Lynx kitten (kf87) | normal | 1 | - | 1 | - | 40.00% | 0.96 | 1 | 222 s | 14.8 s | 10.7 / 18.0 s | 48 | - |
| 206 | Firefly (kf61) | easy | 1 | - | 1 | - | 62.25% | 1 | 1 | 251 s | 14.5 s | 10.6 / 20.7 s | 49 | - |
| 207 | Scruff carry (kf96) | normal | 1 | - | - | 17% | 38.75% | 0.99 | 1 | 235 s | 14.9 s | 7.6 / 14.0 s | 51 | #6b4c8a (24) |
| 208 | Soccer kick (kf36) | normal | 1 | - | - | 24% | 41.75% | 1 | 1 | 249 s | 14.8 s | 13.9 / 16.1 s | 51 | #6b4c8a (23) |
| 209 | Fish dream (kf54) | easy | 0 | - | - | - | 67.75% | 1 | 0.938 | 217 s | 14.8 s | 5.8 / 13.6 s | 54 | - |
| 210 | Snow leopard cub (kf85) | normal | 2 | 2 | - | 18% | 32.50% | 1 | 1 | 203 s | 14.3 s | 8.1 / 19.1 s | 51 | #6b4c8a (24) |
| 211 | Mushroom house (kf60) | normal | 1 | 2 | - | - | 33.25% | 1 | 1 | 223 s | 14.9 s | 9.5 / 19.2 s | 50 | - |
| 212 | Skateboard (kf38) | hard | 2 | 3 | - | 17% | 10.75% | 0.21 | 0 | 264 s | 14.8 s | 11.1 / 17.6 s | 55 | #3a3f63 (22) |
| 213 | Staring contest (kf56) | easy | 1 | 2 | - | - | 68.50% | 1 | 1 | 245 s | 14.5 s | 12.4 / 15.0 s | 50 | - |
| 214 | Robin friend (kf77) | normal | 1 | 2 | - | - | 35.25% | 0.98 | 1 | 260 s | 15.0 s | 8.8 / 21.2 s | 53 | - |
| 215 | Apple weights (kf45) | normal | 2 | - | 1 | 16% | 41.75% | 0.89 | 1 | 251 s | 14.5 s | 10.5 / 19.7 s | 52 | #6b4c8a (23) |
| 216 | Too-big hat (kf15) | easy | 1 | 2 | - | - | 61.75% | 1 | 1 | 223 s | 14.7 s | 12.0 / 20.2 s | 50 | - |
| 217 | Strawberry hug (kf08) | normal | 2 | 2 | - | 17% | 40.25% | 1 | 1 | 223 s | 14.3 s | 7.4 / 23.0 s | 55 | #3a3f63 (32) |
| 218 | Mirror lion (kf55) | normal | 1 | 2 | - | - | 46.00% | 1 | 1 | 232 s | 14.8 s | 7.9 / 18.8 s | 50 | - |
| 219 | Kite flying (kf47) | easy | 1 | - | 1 | - | 78.00% | 1 | 1 | 255 s | 15.0 s | 14.3 / 18.1 s | 47 | - |
| 220 | Heart curl (kf100) | normal | 1 | - | 1 | - | 29.00% | 0.92 | 1 | 221 s | 14.8 s | 7.3 / 17.5 s | 52 | - |
| 221 | Goalie (kf43) | normal | 1 | 2 | - | - | 38.50% | 1 | 1 | 221 s | 14.9 s | 7.8 / 23.3 s | 49 | - |
| 222 | Rainbow slide (kf72) | hard | 2 | 3 | - | 19% | 9.00% | 0.45 | 1 | 222 s | 14.5 s | 8.6 / 17.3 s | 51 | #3a3f63 (26) |
| 223 | Maine Coon (kf94) | easy | 0 | - | - | - | 66.50% | 1 | 1 | 219 s | 14.6 s | 11.1 / 11.4 s | 50 | - |
| 224 | Cucumber fright (kf51) | normal | 1 | 2 | - | - | 35.50% | 1 | 1 | 224 s | 14.3 s | 7.6 / 16.3 s | 55 | - |
| 225 | Upside down (kf20) | easy | 1 | 2 | - | - | 66.75% | 1 | 1 | 233 s | 14.7 s | 9.1 / 20.9 s | 52 | - |
| 226 | Big blue bow (kf03) | normal | 1 | - | 1 | - | 39.50% | 1 | 1 | 239 s | 14.8 s | 7.4 / 17.0 s | 50 | - |
| 227 | Glowing flower (kf62) | easy | 0 | - | - | - | 58.75% | 1 | 1 | 246 s | 14.9 s | 12.0 / 23.7 s | 44 | - |
| 228 | Bread face (kf52) | normal | 1 | - | - | 16% | 39.25% | 1 | 1 | 219 s | 14.5 s | 8.6 / 17.1 s | 46 | #6b4c8a (28) |
| 229 | Calico stretch (kf95) | hard | 3 | 3 | 2 | 18% | 14.00% | 0.34 | 1 | 265 s | 14.6 s | 10.9 / 21.4 s | 50 | #6b4c8a (22) |
| 230 | Marching drum (kf27) | easy | 1 | 2 | - | - | 67.00% | 1 | 1 | 254 s | 15.0 s | 7.9 / 21.8 s | 53 | - |
| 231 | Blanket bundle (kf06) | normal | 2 | - | 1 | 14% | 37.75% | 1 | 1 | 233 s | 15.0 s | 9.3 / 16.3 s | 53 | #2e6b2e (26) |
| 232 | Tuba (kf28) | easy | 1 | - | 1 | - | 77.50% | 1 | 1 | 253 s | 15.0 s | 10.7 / 16.6 s | 51 | - |
| 233 | Dandelion sneeze (kf16) | normal | 1 | - | 1 | - | 46.50% | 0.99 | 1 | 225 s | 14.8 s | 7.5 / 14.6 s | 55 | - |
| 234 | Tiger cub (kf84) | easy | 0 | - | - | - | 61.50% | 1 | 1 | 235 s | 14.6 s | 10.0 / 23.3 s | 51 | - |
| 235 | Tennis (kf41) | normal | 1 | 2 | - | - | 41.00% | 0.98 | 1 | 229 s | 14.9 s | 6.0 / 21.0 s | 52 | - |
| 236 | Blueberry bucket (kf76) | hard | 2 | 3 | 2 | - | 14.25% | 0.4 | 1 | 238 s | 14.9 s | 8.6 / 18.9 s | 52 | - |
| 237 | Siamese (kf92) | easy | 0 | - | - | - | 63.25% | 1 | 1 | 246 s | 14.9 s | 8.6 / 15.1 s | 49 | - |
| 238 | Skiing (kf44) | normal | 1 | 2 | - | - | 39.25% | 0.98 | 1 | 244 s | 14.8 s | 14.2 / 22.1 s | 52 | - |
| 239 | Violin (kf29) | easy | 0 | - | - | - | 74.75% | 1 | 1 | 231 s | 15.0 s | 8.8 / 17.7 s | 55 | - |
| 240 | Signpost nap (kf50) | normal | 1 | - | 1 | - | 27.50% | 0.89 | 0.938 | 226 s | 14.8 s | 6.3 / 14.5 s | 52 | - |
| 241 | Pumpkin peek (kf80) | easy | 1 | - | 1 | - | 76.00% | 1 | 1 | 221 s | 14.7 s | 8.7 / 21.3 s | 42 | - |
| 242 | Lion cub (kf83) | normal | 1 | - | 1 | - | 42.50% | 1 | 1 | 232 s | 14.9 s | 13.3 / 21.1 s | 46 | - |
| 243 | Dragonfly ride (kf73) | hard | 2 | 3 | 2 | - | 16.00% | 0.56 | 1 | 227 s | 15.0 s | 7.1 / 15.3 s | 50 | - |
| 244 | Slam dunk (kf37) | easy | 0 | - | - | - | 56.75% | 1 | 1 | 258 s | 14.9 s | 7.3 / 22.0 s | 47 | - |
| 245 | Daisy crown (kf13) | normal | 1 | - | 1 | - | 38.50% | 0.89 | 1 | 261 s | 14.7 s | 10.8 / 16.8 s | 52 | - |
| 246 | Big yawn (kf23) | easy | 0 | - | - | - | 62.75% | 0.78 | 1 | 232 s | 15.0 s | 7.8 / 15.9 s | 52 | - |
| 247 | Leaf umbrella (kf74) | normal | 2 | - | 1 | 18% | 40.25% | 0.94 | 1 | 201 s | 14.5 s | 6.1 / 19.0 s | 50 | #9b2f6b (24) |
| 248 | Bath time (kf99) | easy | 0 | - | - | - | 69.00% | 1 | 1 | 232 s | 14.9 s | 9.2 / 19.8 s | 50 | - |
| 249 | Ocelot kitten (kf89) | normal | 1 | 2 | - | - | 41.75% | 0.93 | 1 | 233 s | 14.8 s | 7.3 / 14.2 s | 52 | - |
| 250 | Xylophone (kf34) | hard | 2 | 3 | 2 | - | 9.75% | 0.06 | 0.625 | 225 s | 14.3 s | 8.6 / 18.0 s | 54 | - |
