# Land runbook: how a land of levels past 200 is made

For the agents in the factory loop (`game-research/sappers-path-v4/land-factory.md`). One land = 50 main levels (pictures in
one theme) plus about 12 side quests from the Wandering Gallery, on 2 painted map sheets. Everything below runs from the
game folder `repos/games-sappers-path/sappers-path/` with `N=~/.local/opt/node/bin/node`. Background on every piece:
`tools/lands-foundation-notes.md`.

## 1. Inputs

```
tools/lands/<NN-slug>/            one folder per land (in git, except scratch/)
  land.json                       the land (below)
  pictures/manifest.json          its main pictures: [{id, title, artist, date, kind, licence, url, file, crop?, chroma?, bg?}]
  src/<id>.png                    the 160 px sources (made by the prep step; in git)
  map/<file>.webp                 its 2 painted sheets (the map stage; copied into map/ on install)
  map/templates.json              the 2 sheets' layout templates (below)
  scratch/                        everything the run makes (gitignored)
tools/lands/_gallery/             the Wandering Gallery, shared by every land
  gallery.json                    {raw: where its downloads sit}
  manifest.json                   its pictures, in the order lands use them (Peter OKs the downloads first)
  src/<id>.png
```

`land.json`:

```json
{"k": 1, "slug": "01-kitten-forest", "name": "Kitten Forest", "lore": "One line for the banner and the realm card.",
 "count": 50, "source": "ai", "features": ["linked", "mystery", "hidden", "lock"], "eggs": ["grass", "mushrooms", "wisp", "owl"],
 "shade": true, "raw": "/Users/peter/local-ai/outputs/lands/01-kitten-forest",
 "profile": {"tags": {"shares": {"easy": 0.1, "normal": 0.4, "hard": 0.3, "extreme": 0.2}}, "features": {"mystery": {"share": 0.6}}},
 "main": ["id-of-level-201", "...", "id-of-level-250"],
 "map": {"files": ["land-01-a.webp", "land-01-b.webp"], "templates": "map/templates.json"}}
```

- `k` is the land's number (Land 1 = levels 201-250, era 9, ids `e9-201`...). Levels always start right after the game's
  last level; sheets after its last sheet; side-quest pictures after its last picture.
- `features`: the deck features its levels may use (`linked`, `mystery`, `hidden`, `lock`). A later board feature (moat
  rings from 251, the Extreme-only hazard from 351) is added as one builder in `tools/land-bake.js` `FEATURES` plus its
  share in the profile; until then the plan refuses an unknown name.
- `profile`: merged over `tools/land-config.json` `profile` (so only what changes goes here). Raise it land by land:
  more `?` cards, more hidden blocks, more links, more Hard and Extreme, lower bands. Keys: `tags` (shares, breathers per
  50, run [shortest, longest], end), `features` (per feature: share and its amount: `mystery.cards`, `hidden.of`,
  `linked.pairs`, `lock.key`), `bands` (Normal random-tap win rate per tag), `lookahead` (ceiling per tag), `pace` (range,
  aim in ms).
- `eggs`: kinds from `src/journey.js` EGGS (2 per sheet, used in turn).
- `shade`: true to shade within a colour (`tools/shade.js`); good for paintings and soft AI art.
- `map.templates`: 2 layout-shaped entries, one per sheet: `{road, entry, exit, levels: [{x, y}] (8 spots in road order),
  quests: [{x, y, branch}], eggs: [{kind, x, y}], bridges: [[road sample, kind?]]}`, in that sheet's own pixels, made by
  the map stage (map-gen's guide gives the road and the spots; nudge them onto the painted road as `assemble.py` does).
  The road must meet x = 384 at the top and bottom of both. For a trial, `"fromLayout": [7, 3]` copies them from the
  game's own sheets 7 and 3. New sheets are WebP with no baked crossfade: the page crossfades them (`fade`).
- `map.perSheet` (optional): use only the first N level spots of each sheet (fewer levels a sheet, more sheets).

## 2. Run it

```sh
$N tools/land.js tools/lands/01-kitten-forest            # prep convert sheet bake map assemble check (resumable)
$N tools/land.js tools/lands/01-kitten-forest bake --list 212,230 --extra 6  # re-bake a few levels (in parallel), 6 more candidates each
$N tools/land.js tools/lands/01-kitten-forest convert sheet --force           # after a picture or crop change
$N tools/land.js tools/lands/01-kitten-forest check
$N tools/land.js tools/lands/01-kitten-forest install                         # only after check passes
```

Options: `--game DIR` (another game copy, for trials), `--gallery DIR`, `--threads N`, `--force` (redo a step's work),
`LAND_CONFIG=FILE` (a trial land-config), `LAND_PYTHON` (a Python with Pillow; default `python3`).

| Step | Makes (in `scratch/`) | Notes |
|---|---|---|
| prep | `../src/*.png`, `_gallery/src/*.png` | `tools/land-src.py`: paintings 160 px long side, ours 256, emoji as they are |
| convert | `boards.json` | the max phone board (42 x 46 with the frame, 40 x 43 picture with 8+ colours, landscape capped by width), a painting's chroma stepped up to 5 colours, then the shade step |
| sheet | `contact.png` | source / flat / shaded per picture, with size, colours and shades: the visual critic's pick sheet |
| bake | `bake/m-<n>.json`, `bake/s-<n>.json`, `state.json` (tags, plan) | worker threads; about 1-3 min a level wall clock on 16 threads, Hard and Extreme longest |
| map | `map.json` | entries A, B, A', B', A, B, A' (7 for 50 levels: 8 spots a sheet), side quests on template spots (else made spots), egg coins |
| assemble | `out/levels.json`, `out/gallery.json`, `out/land.json`, `out/licences.md` | the records exactly as they will ship |
| check | `report.md` | every gate below; a per-level table and the shares the land reached |

## 3. The gates (check)

All must pass before install: the level numbering; compiles and `E.check` clean; the stored order wins on its tag with
no power-up; at most 5 spaces in use; longest tap 15 s or less; 55 taps or fewer; real pace in the profile's range (side
quests 120-300 s) and the land's median in 200-250 s; no fallback picks; the profile (tags, density floor, features per
level rising with the tag, Hard/Extreme runs, the end); shade colours on their floors (14 from other squads, 12 from
faded cards); side quests every 3-5 levels, all slots filled, plain boards; a re-grade with the grader's own counts at 0
differences; a spot for every level and side quest, sheets alternating file and mirror, nodes 48 CSS px apart at 375 px;
a licence and source for every picture.

A failing level: `bake --only N-N --extra 6` first; if a picture can't meet the pace (small landscape boards play short),
swap it or crop it taller (a crop is a new picture) in `pictures/manifest.json`, then `convert --force` and re-bake it.

## 4. Install and bank

`install` appends to `levels/levels.json`, `levels/gallery.json`, `map/layout.json`, copies the 2 sheets into `map/`,
adds the land to `config.json` `lands.list` and a row per new sheet to `map.eggCoins`, and appends the licence table to
`LICENSES.md`. It refuses a land already there, or a game that moved on since the land was planned. Then:

1. `$N tools/test.js` (its lands section checks every built land against its own land.json), `$N tools/regrade.js`,
   `$N tools/regrade.js --gallery`, `./tools/critic-v5/run.sh`.
2. `$N tools/freeze.js --snapshot` (the land joins the frozen set; later lands never change it), then
   `$N tools/freeze.js --require`.
3. Bump the cache tag (`?v=` in `index.html` and `style.css`), `SP.selfTest()` under `?debug=1` at 375x812@3x and
   1280x720, `PLAYWRIGHT_MODULE=$(~/.local/opt/node/bin/npm root -g)/playwright/index.mjs $N tools/harness.mjs` last.
4. Commit on `sappers-path` ("Sapper's Path Land <k>: ..."), update `tools/v5-progress.md`. Never push.

## 5. Things to know

- Only one land touches `levels/`, `config.json` and `map/layout.json` at a time. The next land's prep, convert, sheet and
  map can run while this one bakes.
- Pace follows board area. A 42 x 28 landscape board plays about 120-200 s even with small squads; a portrait or square
  board reaches the 3:45 aim. Pick portrait or square pictures, or crop wide ones taller.
- The long tail (the castle's pictures 51-60) always waits past the last built land (`journey.js tailAfter`); nothing to
  do per land.
- A land's sheets are its 2 files used over and over; the map shows them mirrored every other pair. The castle's summit
  sheet (25) has fog painted at its top: the first land's bottom crossfade sits over it.
