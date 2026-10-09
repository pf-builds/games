# Sapper's Path v7 lane T: the space budget (2026-10-09)

Brief: the orchestrator's lane T brief of 2026-10-09, levers 2-4 of `game-research/sappers-path-v4/v7-worlds-plan.md`.
Branch `space-v7` from a11e9bf (v6.3), worktree `repos/games-sappers-space`. Goal: each new Zen world costs about 0.12 MB
instead of about 0.77 MB, today's shipped files shrink, and no level plays any differently.

Commits: stage 1 packed level data `6a33788`; stage 2 castle sheets to WebP `6237e8a`; stage 3 Zen worlds on demand
`17f1d9b`; stage 4 gates, budget and these notes (the commit after `17f1d9b`).

## 1. What changed, in one screen

- **The level files ship packed.** `levels/levels.json`, `gallery.json` and `zen.json` moved (git renames) to
  `tools/build-data/levels/`, where they stay plain JSON and stay the source of truth: every bake tool reads and writes
  them there. `node tools/pack.js` writes the files the page reads, `levels/*.pk.json`, byte for byte the same on every run.
  The page unpacks each record (`src/pack.js`, UMD) to exactly the source record less 18 bake-only fields (§3).
  Campaign 1,136 B a level (was 3,846), Gallery 1,286 (was 4,107), Zen 1,096-1,458 by world (was 4,608).
- **The 25 castle map sheets are WebP** at the land sheets' rule (§4): 7.23 MB to 5.84 MB.
- **Each Zen world loads when it is played.** `levels/zen.pk.json` is a 17.6 KB index (the worlds as zen.json has them
  plus what the home, map and saves read about each level); each world's records are `levels/zen-<k>.pk.json` (55-73 KB),
  fetched on the first start of one of its levels (§5).
- **Shipped folder 16.53 MB to 13.79 MB; bytes before the first tap 3.46 MB to 1.85 MB; one more Zen world 266 KB to
  86 KB** (§7). Nothing about play changed: the freeze, the re-grades, selfTest and a v6.2 save all read the same.

## 2. Design

**Source and shipped.** The brief offered two shapes; I took "the unpacked JSON stays the source of truth under tools/,
a deterministic pack writes the shipped files, test.js fails if shipped differs from pack(source)". Every tool keeps
reading and writing plain JSON (only the path changed: `levels/X.json` to `tools/build-data/levels/X.json`, a mechanical
replace over 52 tool files; `git show <old commit>:sappers-path/levels/...` reads of history were left alone, and so was the
LICENSES.md text quest-bake.js writes). Lane D's merge stays mechanical (§8).

**The packed record** (`src/pack.js`). Same keys in the same order; DROP left out; five fields stored as strings (an array
or object means "not packed", so packed and plain records both unpack):

| Field | Packed form | Share of the source |
|---|---|---|
| grid | run-length over the cells in reading order, a cell equal to the one above written `^` (`a12^40,`) | 41% to about 0.45 KB a level |
| shade | digits as letters (0 = A), run-length | 31% to about 0.1 KB |
| hidden | run-length | (32 Campaign records) |
| cols | columns joined by `,`, each card its colour as a letter, its count, then `.n` for any more numbers (`F26E21B30.1`) | 8% to about 0.2 KB |
| pal | `key:rrggbb:name`, then `:r:role` or `:s:` four shades | 7% to about 0.15 KB |

Run-length beat 4 bits a cell by measurement (4 bits is 0.67 characters a cell in base64 whatever the picture; run-length
with "same as above" is 0.27 on these flat-shape boards: 796 KB of grids to 214 KB). `pack()` unpacks every field it
packs and keeps the plain value if they differ, so an odd record ships larger, never wrong (none does today: every grid,
deck and palette of all 462 records is packed; test.js checks).

**Files.** `levels/levels.pk.json` (the Campaign's 200 + any land not in Zen), `gallery.pk.json` (all 62 pictures,
Kitten Forest's 12 side quests too: the map draws a won one's thumbnail), `zen.pk.json` (the index), `zen-<k>.pk.json`
(one a world). The bake's own notes and settings (`bake`, `note`) stay in the source.

## 3. Dropped fields and the evidence

The page reads a level only through `src/*.js` and `index.html`. A field is dropped only when no file there reads it:
I listed every key any record has (52) and searched each as a property access (`<anything>.field`) and as a quoted string.

| Field | Hits in src/ and index.html | Size in the source |
|---|---|---|
| grade, convert, inBand, edits, credit, cant, exempt, teaches, feats, palette, deck, scene, breach, wander | none | grade 105 KB, convert 16 KB, palette 5.7 KB, the rest under 6 KB each |
| seed | `V.seed` only (board.js's own sprite random, a view field) | 3.9 KB |
| target | `ev.target`, `q.target` only (DOM events) | 3.7 KB |
| v6 | three hits, all inside comments ("then).v6", "13z.v6", "them.v6") | 19 KB |
| mystery | `cfg.layout.mystery` / `LY.mystery` (config), `st.mystery` (a coach step), `"mystery"` as a sprite and feature name: never a level's | 4.8 KB |

No code iterates a level's keys (`Object.keys(L)`, spread, `JSON.stringify(L)`, `L[k]`: searched, none). Kept although
bake-ish: `band` (selfTest's jam search reads it), `source`, `hint`, `kind`, `from`, `title`, `short`, `name`, `gallery`,
`moat`, `group`. test.js now fails if any `L.<dropped>` or `L["<dropped>"]` appears in src/ or index.html.
The re-grade and freeze read the grades from the source, as before (§6).

## 4. Castle sheets to WebP

The land sheets were made by each land's `map/scripts/assemble.py` (`game-research/sappers-path-v4/lands/*/map/`): Pillow
`WEBP`, `method=6`, quality from 96 down by 2 until the file fits `webpMaxKB` 250 (plan.json `webpQuality [96, 70]`);
all six landed on q94 (map README: "WebP q94, the highest quality under 250 KB"). I used the same rule, not a flat q94
(q94 alone would have saved 1.0 MB; the rule saves 1.38): `tools/space-v7/webp-sheets.py`, re-encoded from the shipped
JPEGs (no masters on disk). Result per sheet: `tools/space-v7/webp-sheets.json`.

| Sheets | Quality |
|---|---|
| 01-05, 12, 13, 15, 17, 18, 22, 25 | q94 |
| 06, 16 | q96 |
| 07-11, 14, 19-21, 23, 24 | q92 |

All 25: 7,225,199 B as JPEG (257-320 KB each) to 5,840,706 B as WebP (209-254 KB each).

PSNR against the JPEGs 42.0-45.2 dB. `map/layout.json` names the `.webp` files (25 strings, nothing else changed), the
JPEGs are gone (git history keeps them: `git show a11e9bf:sappers-path/map/sheet-01.jpg`), LICENSES.md's map row and
`tools/map-gen/assemble.py` (now writes WebP by the same rule) follow. Nothing else names a castle sheet file (zen.json
worlds reuse sheets by layout number; the playtest bundle copies `map/*.webp`).

**Visual check.** `tools/space-v7/crops/sheet-NN.png` (01, 08 the busiest, 13, 16, 21, 25's fog): JPEG | WebP |
difference x8, 256 px at 2x. `tools/space-v7/seams/join-NN.jpg` (joins 1/2, 7/8, 12/13, 20/21, 24/25): the Campaign map as
the player sees it at 375x812@3 on a11e9bf and on this build, side by side with the difference x8 (mean 0.6-1.0 of 255;
`tools/space-v7/seams.mjs` + `seams.py`). No visible change at either size. The brief's "Zen World 1 shows castle sheets 1-5
mirrored and tinted" predates v6's fix pass: World 1 reuses Kitten Forest's land sheets (WebP already), so no Zen world
shows a castle sheet today; the castle joins are only on the Campaign map.

## 5. Zen worlds on demand

**The index** (`levels/zen.pk.json`, 17.6 KB): `worlds` exactly as zen.json has them (test.js checks they unpack to it),
a world's own map roads shortened (`packWorld`: "x,y:" then each step's dx, dy as one character; Snack Galaxy's and Dino
Valley's 16 KB maps to about 5 KB), and each world's `recs` (`src/pack.js recsOf`): `file`, `ids`, `n`, `tags` (a letter a
level), `era`, `world` or `land` (one value, or one a level), `from` (World 1's Gallery sources) and `shade` ("1" a level
with shade rows). About 0.8 KB a world.

**Stand-ins.** At boot the page builds every Zen level from its stand-in (`src/pack.js stub`: `{id, n, era, world | land,
tag, from, shade: true, stub: true}`), so the orders, the `starts`, `Z.info`, the running Zen numbers (D10), the saves'
sanitize, `zenMove`'s spec, SP2 codes, egg ids, the home cards and the whole Zen map are built exactly as from the full
records. A land world's stand-ins join the level list where levels.json had its records (after the Campaign's; tools/pack.js
refuses a levels.json where that wouldn't hold), so `app.allOrder` and the Campaign save's sanitize see the same ids in the
same order. What reads a level before it's played, and what the stand-in gives it: `tagOf` (tag), the map nodes and
labels (n, tag), `modes()` (world, land, from), `moveSpec` (from), `eggReached` / realm cards (era), `shadeTip` (shade,
truthy only), `zenDone` / `reach` / `nextOf` (ids). Everything else reads `app.entry.L` after `startLevel`.

**Loading** (`main.js loadWorld`): one fetch a world (`levels/<file>?v=`), the same promise for every caller; each
record unpacked, compiled and swapped into its entry (`e.L`). A failed fetch is forgotten, so the next tap tries again.
`startLevel` on a stand-in calls `wantLevel`: nothing on screen changes (no flash); after `zen.load.toastMs` (300) of the
page's clock (`step`, never a timer) a toast says "Opening World k..." (config `zen.text.loading`); when the records are in,
the level starts (the toast goes). Leaving the screen first (`showScreen` to the home or map) cancels it. A failed fetch:
"Couldn't open World k. Check the connection and try again." (`zen.text.loadFail`); the screen stays as it was.

**Prefetch** (`zen.load.prefetch`): two frames after the first paint, the world the Zen save continues into, only when Zen
is the mode played last (a Campaign player pays nothing for Zen until they open it). On a Zen win, the world of the level
Next will play if it isn't in yet (the boundary between worlds).

**Debug hooks:** `SP.load(id)` of a stand-in returns a promise that waits for its world; `SP.selfTest()` loads every world
first and then runs as before (it plays every Zen level's stored order); `SP.worlds()` and `SP.pend()` for tools.

**How lane D adds a world (still one entry).** Install the world as now (`tools/land.js ... zen`, or `zen-world.js
install`, or the one-entry append for a land): they write `tools/build-data/levels/zen.json`. Then `node tools/pack.js`:
it writes the world's `levels/zen-<k>.pk.json` and the index. test.js fails until it's run. `tools/land-runbook.md` §4 and
§6 say so.

## 6. Checks (final, on the stage 4 tree)

| Gate | Result |
|---|---|
| `tools/test.js` | 713 passed, 0 failed (709 at a11e9bf; new: shipped == pack(source) and no stray world file; unpack(pack(x)) == x less DROP for all 462 records and the shipped files hold each once; the page reads no dropped field; the index's stand-ins equal the records, each world in its own file only, its entry unpacks to zen.json's, the level order is levels.json's). Size gate unchanged (19 MB); it now allows the index's world files in `levels/` |
| `tools/freeze.js --require` | PASS: levels.json 250 levels 2,405 checks, gallery.json 62 / 372, zen.json 150 / 1,350, 0 differences; castles 283 cases 0; new: every frozen record unpacks from the shipped files byte for byte as the snapshot holds it, less DROP: 462 records, 0 differences |
| `tools/regrade.js` (source; full, `--gallery`, `--zen`) | 0 differences: 2,405 / 372 / 1,350 checks |
| `tools/regrade.js --shipped` (new: the page's own records over the source's grades and seeds) | 0 differences, all three |
| `tools/pack.js --check` | the shipped files match the source |
| selfTest (`tools/selftest-lands.mjs --wide 1280x800`) | 876/0 at 375x812@3, 878/0 at 1280x800 (and 878/0 at 1280x720), 0 console messages |
| `tools/harness.mjs` | all passed (its hidden-tab selfTest 876/0), 0 console messages |
| `tools/space-v7/check.mjs lazy` | 11 ok: no world file on a fresh home; the Zen card ("0 of 212 pictures", World 1, Picture 1) and the 200-node Zen map from the index alone; a slow world: at 150 ms the map unchanged and no toast, at 750 ms "Opening World 4...", then picture 151; leaving for the home mid-load: the level never starts; a failed fetch: the toast, the map stays, the next tap plays (51); with the v6.2 save (Zen last, World 4 next) only World 4 fetched after the first paint and the Zen card plays 154 at once |
| `check.mjs saves` | a save written by a11e9bf's own page (`tools/fixtures/v6.2-save.json`, made by `tools/space-v7/v62-fixture.mjs`: Campaign 1-37 and 5 side quests, coins 777, castle eggs, Music off, Colour-blind on; Zen World 2 (a land world) 1-4, World 1 1-12, World 3 1-7, World 4 1-3, three Zen eggs): both stored keys byte for byte untouched by this build's boot; this build's SP2 code of it equals a11e9bf's; a11e9bf and this build read it the same (code, mode, both home cards, coins, power-ups, unlocks); a11e9bf's SP2 code loaded through Settings reads back identically |
| `check.mjs sweep` | 16 runs, 0 console messages: fresh load, reload and load again of Campaign level 5, a Zen level in each of the 4 worlds, the Campaign map, the Zen map and Gallery picture 1, at 375x812@3 and 1280x800 |

Cache tag `?v=65` (index.html, style.css); `?v=66` after the fix pass (§11).

## 7. Budget

Shipped folder by part (the game minus tools/ and dot files, as test.js counts it; `tools/space-v7/budget.js`, raw bytes,
1 MB = 1,000,000 B):

| Part | a11e9bf (v6.3) | v7 lane T | Change |
|---|---:|---:|---:|
| map: castle sheets (25) | 7.23 MB | 5.84 MB | -1.38 MB |
| map: land sheets (6) | 1.37 MB | 1.37 MB | 0 |
| map: layout.json | 0.08 MB | 0.08 MB | 0 |
| audio | 3.51 MB | 3.51 MB | 0 |
| levels: Campaign (levels.json) | 0.96 MB | 0.23 MB | -0.73 MB |
| levels: Zen (zen.json; v7 the index) | 0.73 MB | 0.02 MB | -0.71 MB |
| levels: Zen world files (4) | none | 0.25 MB | +0.25 MB |
| levels: Gallery (gallery.json) | 0.25 MB | 0.08 MB | -0.17 MB |
| levels: places, tutorial, debug row, Gallery manifest | 0.12 MB | 0.12 MB | 0 |
| art | 0.82 MB | 0.82 MB | 0 |
| code (src/) | 0.76 MB | 0.78 MB | +0.02 MB |
| fonts | 0.08 MB | 0.08 MB | 0 |
| docs (LICENSES, SPEC, LATER) | 0.36 MB | 0.36 MB | 0 |
| page (index.html, css, config.json, thumb) | 0.27 MB | 0.27 MB | 0 |
| **Total** | **16.53 MB** | **13.80 MB** (13,796,962 B) | **-2.73 MB** |

Bytes the page asks for before the first tap (`check.mjs bytes`: a cold load at 375x812, files on disk, so before any gzip;
the tour's offer marked seen as the harness does):

| Milestone | a11e9bf | v7 lane T |
|---|---:|---:|
| the home interactive | 3,457,047 B | 1,857,289 B |
| to the first Campaign level (tap on the Campaign card) | 6,938,181 B | 5,338,423 B |
| to the first Zen level (tap on the Zen card) | 6,938,181 B | 5,393,234 B (World 1's file, 54,811 B, included) |

(Fix pass figures: +2.9 KB of code and CSS since the first measure; a new player still fetches no Zen world before a
tap on Zen.)

Level data before the home went from 1.96 MB (levels.json, gallery.json, zen.json, places, tutorial) to 0.34 MB. Of the
5.3 MB to a first level, 3.48 MB is the music (all three loops load on the first level; LATER) and no map sheet loads
until the map opens.

One more Zen world on reused sheets (lever 1), measured on Dino Valley (World 4, the largest boards of the four):

| | a11e9bf | v7 lane T |
|---|---:|---:|
| level data | 251.8 KB (5,158 B a level) | 71.2 KB (1,458 B a level) |
| its world entry (7 reused sheets, World 1's kind of map) | 1.9 KB | 2.7 KB (with its recs) |
| its LICENSES.md section | 12.5 KB | 12.5 KB |
| **total** | **266 KB (0.27 MB)** | **86 KB (0.09 MB)** |

The other worlds' files: World 1 54.8 KB, World 2 57.5 KB, World 3 62.5 KB. Worlds that still fit: under the 19 MB gate
9 before, **58 after**; under 20 MB 12 before, **70 after** (at Dino Valley's cost; the plan's 0.77 MB a world was with new
map art). All 16 planned lands and a finale with new art (about 0.5 MB) fit with room to spare.

## 8. Merge recipe for lane D

Run every command **from the repo root** of lane D's worktree (the folder holding `sappers-path/`), at a quiet point (no
bake running). Every path below starts at that root. Dry-run on a throwaway clone on 2026-10-09 (§8.1).

```sh
cd "$(git rev-parse --show-toplevel)"       # the repo root; stay here
N=~/.local/opt/node/bin/node

# 1. Merge without committing, so HEAD stays lane D's tip for step 2.
git merge --no-commit --no-ff space-v7

# 2. The three level sources. space-v7 only renamed them (sappers-path/levels/X.json -> sappers-path/tools/build-data/
#    levels/X.json, 100% renames: `git diff a11e9bf space-v7 -M100% --name-status`), so lane D's version is always the
#    merged one. This says which ones lane D changed, writes lane D's version to the new path whatever rename detection
#    did, and leaves no plain level file in sappers-path/levels/:
for f in levels gallery zen; do
  git diff --quiet a11e9bf HEAD -- sappers-path/levels/$f.json || echo "lane D changed $f.json after a11e9bf"
  git show HEAD:sappers-path/levels/$f.json > sappers-path/tools/build-data/levels/$f.json
  git rm -q --cached --ignore-unmatch sappers-path/levels/$f.json; rm -f sappers-path/levels/$f.json
  git add sappers-path/tools/build-data/levels/$f.json
done
for f in levels gallery zen; do git show HEAD:sappers-path/levels/$f.json | cmp -s - sappers-path/tools/build-data/levels/$f.json && echo "$f.json: lane D's, byte for byte" || echo "$f.json: DIFFERENT, stop"; done

# 3. map/layout.json: space-v7 changed only the 25 castle names (.jpg -> .webp). Take lane D's and re-apply them (right
#    whether or not it conflicted):
git show HEAD:sappers-path/map/layout.json > sappers-path/map/layout.json
perl -pi -e 's/"file":"sheet-(\d\d)\.jpg"/"file":"sheet-$1.webp"/g' sappers-path/map/layout.json
grep -o 'sheet-[0-9]*\.webp' sappers-path/map/layout.json | wc -l          # must print 25
git add sappers-path/map/layout.json
#    sappers-path/map/sheet-*.jpg are deleted on space-v7: keep them deleted.

# 4. Cache tag: both lanes bump ?v= (space-v7: 66). Take max + 1 in sappers-path/index.html and sappers-path/style.css.
# 5. sappers-path/config.json: space-v7 changed v5.ship.levels (+ packNote) and added zen.load and zen.text.loading /
#    loadFail; keep both sides.
# 6. Tools written on lane D after a11e9bf that read the old level paths. This must print nothing but `git show` reads of
#    old commits:
grep -rnE "levels/(levels|gallery|zen)\.json" sappers-path/tools --include='*.js' --include='*.mjs' --include='*.py' | grep -v "build-data/levels\|sappers-path/levels/\|Campaign v6 side quests\|space-v7/budget.js\|saves/make.js"
#    (budget.js reads an old export's levels/ on purpose; saves/make.js reads old commits through git show)
#    Fix any line it prints:
#    perl -pi -e 's#(?<!sappers-path/)(?<!build-data/)levels/(levels|gallery|zen)\.json#tools/build-data/levels/$1.json#g' FILE
# 7. Text merges, keep both sides: sappers-path/tools/test.js, freeze.js, regrade.js, land-runbook.md, LICENSES.md,
#    SPEC-v4.md, LATER.md, v5-progress.md. `git status` must show no unmerged path.
# 8. The shipped files from the merged sources (every world, lane D's new ones too):
$N sappers-path/tools/pack.js && $N sappers-path/tools/pack.js --check
git add sappers-path/levels
# 9. Gates (all from the root): $N sappers-path/tools/test.js; $N sappers-path/tools/freeze.js --require;
#    $N sappers-path/tools/regrade.js [--gallery | --zen] [--shipped]; then serve sappers-path/ and run
#    sappers-path/tools/selftest-lands.mjs --wide 1280x800, sappers-path/tools/space-v7/check.mjs (its lazy checks name worlds
#    1-4 and fixed numbers: a new or grown world moves them) and sappers-path/tools/harness.mjs last.
# 10. git commit (the merge, with the regenerated levels/*.pk.json).
```

### 8.1 Dry run (2026-10-09, fix pass)

A throwaway `git clone` of the local games repo in the scratchpad (no worktree or branch of the real repo touched;
deleted afterwards). A stand-in lane D branch from a11e9bf: a world's lore edited in zen.json, level 1's hint in
levels.json, a picture's title in gallery.json, an egg moved in map/layout.json, a new tool reading `../levels/zen.json`,
the cache tag bumped to 66; then the recipe above, literally, started from the clone's `sappers-path/` (the first line moves
to the root). Two runs, the clone deleted afterwards:
- **Run 1, plain merge.** Rename detection carried all three edits; conflicts only in index.html (the cache tag beside
  pack.js) and layout.json. Step 2 printed "lane D changed" for all three and "lane D's, byte for byte" for all three; step 3
  printed 25 and kept the moved egg; step 6 listed the new tool (fixed with the perl line, then it ran); `pack.js` wrote the
  lore into the index, the hint into levels.pk.json and the title into gallery.pk.json, `--check` clean, no plain level
  file left in `levels/`. test.js 711/2: the two failures were the freeze and World 1 checks, rightly catching my edits to a
  frozen level's hint and a frozen picture's title (not the recipe).
- **Run 2, `-Xno-renames`** (rename detection off, the case the step-2 check exists for), with edits that touch no frozen
  record (zen.json's World 4 lore, a top-level key in levels.json and gallery.json, the egg, the tool, `?v=66`):
  modify/delete conflicts on the old level paths, all resolved by step 2 (lane D's three files byte for byte at the new
  paths, the old paths removed); after step 4 (`?v=67`) no unmerged path; test.js **713 passed, 0 failed**.
- Step 6 also lists `tools/space-v7/budget.js` and `tools/saves/make.js` (both read old copies on purpose); the grep now
  leaves them out.

## 9. Calls I made

1. Packed gallery.json too (the brief's stage 1 named levels.json and zen.json; its round-trip list names the Gallery
   pictures): same module, 0.17 MB, and the tools' path change was the same replace.
2. WebP by the land sheets' rule (q96 down to fit 250 KB, landing q92-q96), not a flat q94: that is how every land sheet
   was made; a flat q94 saves 0.4 MB less.
3. Kitten Forest's 50 records moved into its world file too (it is a Zen world); its 12 side quests stay in the gallery
   file (the Zen map draws a won one's thumbnail before anything is played).
4. The index keeps each world's entry as zen.json has it (so "a world is one entry" stays literally true), only its own
   map roads shortened; layouts stay in the index because the Zen map draws every world at once.
5. Prefetch only when Zen is the mode played last, and on a Zen win across a world boundary; a new player (Campaign by
   default) fetches no Zen world until they open one.
6. The loading toast waits 300 ms of the page clock and the two new lines are config text (`zen.text.loading`,
   `loadFail`), not new UI.
7. `SP.selfTest` now returns a promise (it loads every world first); every caller in tools awaits it through Playwright's
   evaluate. selfTest's own checks are unchanged.
8. Bytes are reported raw (files on disk): the 20 MB rule counts files; GitHub Pages and portals gzip JSON on the wire,
   which shrinks the packed files less than it did the plain ones (the packed data is already dense).

## 10. Files

`src/pack.js`; `tools/pack.js`; `tools/build-data/levels/` (the sources); `levels/*.pk.json`; `map/sheet-*.webp`;
`tools/space-v7/` (budget.js and budget.json, check.mjs and check-last.json, v62-fixture.mjs, webp-sheets.py and .json,
seams.mjs, seams.py, crops/, seams/); `tools/fixtures/v6.2-save.json`; edits in `src/main.js` (boot, addLevel, zenIndex,
loadWorld, wantLevel, pendStep, prefetch, startLevel, showScreen, ended, SP), `config.json` (`v5.ship`, `zen.load`,
`zen.text`), `index.html` (pack.js, `?v=65`), `tools/test.js`, `tools/freeze.js`, `tools/regrade.js`,
`tools/selftest-lands.mjs` (`--wide`), `tools/playtest-bundle.py` (copies whatever levels/ files the page reads at the ref),
`tools/map-gen/assemble.py`, `tools/land-runbook.md`, `LICENSES.md`, and the path in 52 tool files.

## 11. Fix pass after the critics (2026-10-09; `tools/critic-space-v7-functional.md`, `tools/critic-space-v7-visual.md`)

- **B1 (blocking), a waiting level took over one already started.** `startLevel` (any level that starts, whatever started
  it: a node, the Play and Continue cards, the next-up card, the win's Next, the Gallery, the tour) and `retry` now cancel a
  pending world load; `showScreen` already did for every other screen (map, home, the map's mode switch). A repeat tap on the
  waiting level is ignored. There is no browser-history handling in the page, so Back can't start a level. New check
  (`check.mjs lazy`): World 3 delayed 2.5 s, tap its first node, then picture 1 mid-load: picture 1 keeps playing after zen-3
  arrives (id z1-1, no pending load, no busy button).
- **S1, the merge recipe**: §8 rewritten from the repo root with root paths, `git merge --no-commit` so HEAD is lane D's tip,
  step 2 writes lane D's three sources whatever rename detection did and checks them byte for byte; dry-run twice (§8.1).
- **Visual minor 1, busy state**: the button tapped (`app.tapEl`, a capture-phase listener) gets `.busy` (a slow brightness
  breathe, static under reduced motion) and `aria-busy` after `zen.load.toastMs`, with the toast; nothing before 300 ms.
  `tools/space-v7/fixpass-busy-card.png`.
- **Visual minor 2, the fail toast**: "Couldn't open World k. Check your connection." for `zen.load.failMs` (5 s) or until the
  next tap, in a `.wide` box (an absolute box at left 50% shrank to half the screen): 2 lines at 375 px.
  `tools/space-v7/fixpass-fail-toast.png`.
- **M1, prefetch**: also on the home when the Zen save has any progress (even with the Campaign played last), and whenever
  the Zen map opens; never before the first paint (`app.painted`). A new player's home and first Campaign level fetch no
  Zen world (bytes above). Checks: the Zen map fetches only the next world; a Zen-progress, Campaign-last save fetches World 4
  on the home.
- **M2**: stale names fixed in `tools/map-gen/README.md`, `retouch-25.py`, the config notes, main.js comments and the
  playtest bundle's docstring.
- Cache tag `?v=66` (main.js, style.css and config.json changed). Gates: test.js 713/0; freeze --require PASS (2,405 / 372 /
  1,350 checks, shipped 462, castles 283, all 0); regrade full, --gallery, --zen and each --shipped 0 differences;
  pack --check clean; selfTest 876/0 (375x812@3), 878/0 (1280x800); harness all passed; check.mjs lazy 15/15, saves 4/4,
  sweep 16/16, 0 console messages (but the aborted fetch's own network line in the failed-fetch test).
