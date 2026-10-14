# Lane P, Stage 1: the CrazyGames portal build (2026-10-14)

Branch `portal-cg` (from `sappers-path` d72193a, v6.8). Target: a CrazyGames Basic Launch with no SDK, so the whole build
counts against the size lines (`game-research/crazygames-rules-2026-10.md` §2). Tools only: no game file changed.

## 1. What was added

| File | What it does |
|---|---|
| `tools/portal-config.json` | Every number and list the two tools use: out folder, size and file gates, debug-only files, licence companions, the meta lines stripped, the banned words, the selftest's ports, subpath and viewports |
| `tools/portal-build.mjs` | Traces the files the page loads, stages a copy, writes `LICENSES.txt`, checks, zips. `node tools/portal-build.mjs [--dirty]` |
| `tools/portal-selftest.mjs` | Unzips the build under a CDN-like subpath, serves it, drives it in Playwright, prints PASS/FAIL per check |
| `.gitignore` | `sappers-path/tools/build-data/portal/` (the staged copy, the zip and build.json never go in git) |

Output: `tools/build-data/portal/sappers-path-crazygames.zip` (index.html at the zip root), the staged copy beside it,
and `build.json` (every file and its bytes, the scan, the gates).

## 2. How the file list is found

Nothing is hand-listed. The build starts from `index.html` and follows what the page asks for:

- `index.html`: every `src`, `href` and `srcset` (the 10 scripts, `style.css`, `tutorial.css`, the font preload, both home
  paintings: the `<picture>` picks one by orientation, so both ship).
- every stylesheet's `url()` (the font; the rest are data: URIs).
- every quoted literal path in `src/*.js` that names a data or media file under a folder, or `config.json` (main.js boot's
  getJSON calls: config, levels/levels.pk.json, gallery.pk.json, map/layout.json, zen.pk.json, places.json, and the
  debug file).
- every JSON the page fetches, walked to a fixpoint for `file` / `files` values, looked up as written, then under
  `levels/` and `map/` (the folders main.js and journey.js put in front): config's music tracks and the tutorial's
  file, layout.json's 27 sheets, zen.pk.json's 16 world files and their sheets, config `lands.list` sheets.

A traced file that is not in the folder fails the build. `levels/debug-v4.json` is the one traced file left out on
purpose (config `debugOnly`): main.js fetches it only under `?debug=1`.

Left out because nothing loads them: `tools/` (183 MB), every `.md`, `thumb.jpg` (the arcade's card), the two spare
jingles (`jingle-pizzi15`, `jingle-steel10`: LICENSES.md calls them spares; config plays `pizzi10`),
`levels/gallery-manifest.json`, `levels/debug-v4.json`. (No `levels/pool-*.json` or `levels/frozen/` exist any more;
they moved to `tools/build-data/` in v6 D9.)

Added: `LICENSES.txt` (LICENSES.md as plain text: headings underlined, each table row one "Header: value" line per
column, no markdown marks; Stage 3 rewrites the credit content, this is only the generation step) and `fonts/OFL.txt`
(the font's licence must travel with the font; nothing fetches it).

Two files change on the way; every other file is byte-identical to the Pages build:

- `index.html`: the 7 social-card `<meta>` lines go (`og:*`, `twitter:*`; `og:image` and `twitter:image` held the
  absolute pf-builds URL). Title, description, the Cache-Control meta and every `?v=87` stay.
- `config.json`: the 58 developer notes go (`note` and `*Note` keys, every one but `eras[].note`, the realm lore the map
  shows), and the whitespace. 73,699 -> 34,759 B, all of it before the first tap. Two of those notes named pf-builds
  and CrazyGames. selfTest in the unzipped build (924/0) is the proof nothing reads them.

## 3. Measurements (d72193a game files)

| | Bytes | Gate |
|---|---|---|
| Unzipped total | 14,127,566 (76 files) | under 20,971,520 (20 MiB) PASS, under 20,000,000 (20 MB) PASS; 1,500 files PASS |
| Zip | 12,324,390 | under both PASS |
| Before the first tap, 375x812 | 1,937,591 in 22 files (home-tall.jpg) | |
| Before the first tap, 1280x720 and 821x462 | 1,988,857 in 22 files (home-wide.jpg) | |
| After the walk (level 1, map both modes, music) | 8.68-8.81 MB | |

Before the first tap = response bodies the game's origin sent from navigation to the tap, after 2.5 s on the home
(fonts, CSS, 10 scripts, config, levels, gallery, layout, zen index, places, tutorial, one painting). No music before the
tap (the harness's own check agrees). For comparison, test.js's "shipped folder (minus tools/)" is 86 files,
14,632,166 B; the portal build is 10 files and ~0.5 MB smaller.

Headroom under 20 MB: ~5.9 MB unzipped. The lands-201-1,000 warning in the rules doc stands: new painted map sheets
(~230 KB each) eat it at about 25 sheets.

## 4. Outbound links

The game has no arcade back link and no anchor anywhere (0 `<a>` in index.html, none built in code; the pf-builds arcade
links to the game, not the other way). The only outbound URLs were the og:image / twitter:image tags; the build drops
them (a build-time transform, nothing at run time, the live site keeps its tags).

Proof (the build's scan of the unzipped copy, case-insensitive, `itch` as `itch.io` so "switch" passes):

| File | Hits |
|---|---|
| index.html, style.css, src/main.js | `https?://` only as `http://www.w3.org/2000/svg`, the SVG namespace inside data: URIs (1 / 16 / 2), never fetched |
| src/save.js | `crazygames` x1: the CLOUD HOOK comment names the host portal (reported, not fatal) |
| LICENSES.txt, fonts/OFL.txt | 163 and 2 plain-text source/licence URIs (opengameart, kenney, museums, openfontlicense.org). CC BY asks for the URI. Not links |
| every file | 0 x pf-builds, github.io, peterfrutchey, poki, itch.io |

The selftest's DOM check agrees: 0 off-origin `href` / `src` / `srcset` / `action` / meta URLs on the home, level 1,
the map in both modes and Settings, in every run.

## 5. Save keys and cache-busting on another origin

- localStorage keys: `sappers-path.v3` (Campaign), `sappers-path.zen.v1` (Zen), `sappers-path.tour.v1` (tour seen),
  plus a read-only probe of `sappers-path.probe`. All namespaced; no clash with other games on a shared CDN origin. No
  cookies, sessionStorage, IndexedDB, Cache API or service worker. Storage that throws falls back to memory (main.js
  storage(), save.js memoryStore).
- In a cross-site iframe (host at localhost, game at 127.0.0.1 under `/cdn/games/sappers-path/b1/`), Chromium's
  partitioned storage holds all three keys and they survive a reload of the host page.
- Cache tag: main.js reads `v` from `document.currentScript.src` (an absolute URL, so it is right on any origin and
  subpath) and puts it on every fetch and image (`config.json?v=87`, levels, worlds, sheets, music). In the framed run
  31 requests carried `?v=87`, none another tag, none untagged. Every path is relative (the build fails on an absolute
  `src`/`href`/`url()`), so the subpath needs nothing.
- Unknown, for the portal: whether CrazyGames' CDN keys its cache on the query string. If it ignores it, the tag does
  nothing there, and a re-upload relies on the portal giving each build version its own path (the usual way). Ask in
  the portal, or bump file names, if a stale-file report ever comes in.

## 6. The selftest (tools/portal-selftest.mjs)

Game origin `http://127.0.0.1:8612`, host page `http://localhost:8611`, both served from the script (closed at the end).
Last run:

```
FAIL 4 one tap      fresh profile: the tour's offer (New here? Show me / Skip) covers the home; level 1 in 2 taps (Skip, Play)
                    [375x812, 1280x720, 821x462, framed 1280x720]
                    returning player: one tap on Play -> level 1 [every viewport]
                    fresh profile: Show me is one tap into a playable practice fort
PASS 3 links        0 off-origin attributes on every screen, every run
PASS 1 load         0 console errors or warnings in all 5 runs
PASS 2 origin       0 requests off the game's origin (42-56 requests a run)
PASS 5 bytes        1,937,591 / 1,988,857 B before the first tap
PASS 6 selfTest     SP.selfTest 924 passed, 0 failed (375x812@3, ?debug=1, the unzipped build)
PASS 8 framed       31 requests on ?v=87 under the subpath; storage keys namespaced and kept over a host reload
PASS 7 files        283 requests, 0 not found; 49 of 76 zipped files asked for (never: 25 map sheets the map
                    loads lazily as it scrolls, LICENSES.txt, OFL.txt)
```

The one FAIL is a design question, not a build fault: on a fresh profile the intro tour's offer covers the home, so
Level 1 is two taps (Skip, Play), or one tap into a practice fort (Show me). Peter's call; options in LATER.md. The
selftest stays strict so it turns green only when that is decided.

The selfTest run answers `levels/debug-v4.json` from the source tree through a Playwright route (selfTest checks the v4
twist levels), so the shipped zip stays free of debug data while the shipped code is still self-tested.

## 7. Gates on portal-cg (tools only, so test.js and the harness)

| Gate | Result |
|---|---|
| test.js | 725 passed, 0 failed (shipped folder 86 files, 14,632,166 B) |
| pack.js --check | the shipped files match the source |
| harness.mjs (served at 127.0.0.1:8613) | all passed; hidden-tab selfTest 924/0, 0 console |
| portal-build.mjs | PASS (clean against HEAD after the commit) |
| portal-selftest.mjs | 7 of 8 PASS; 4 (one tap on a fresh profile) FAIL as above |

## 8. Left for later stages (not done here)

- `?debug=1` still works in the portal build (window.SP, the debug speed row; a 404 for debug-v4.json logs one console
  error). The rules doc's fix list says strip it; doing so needs a game-code switch and would stop the selftest running
  selfTest on the shipped build. Left as is.
- `config.saveCode.portalOn` (false) was written for a CrazyGames build with the SDK's cloud save. A Basic Launch has
  no cloud save, so the save code is the only way to move progress; the build leaves `saveCode.on` true.
- LICENSES.txt carries LICENSES.md's local paths (`/Users/peter/local-ai/...`) and the Twemoji/Met credit issues the
  rules doc lists: Stage 3.
- Escape closes sheets, "Turn your phone upright" on touch Chromebooks, the Ladder tooltip at 821x462, covers, video:
  rules doc fix list items 3-6, not Stage 1.

# Lane P, Stage 3: game fixes before the Basic Launch submission (2026-10-14)

Branch `portal-cg`, from bf8a5ca. Every change is in the game itself (it merges into `sappers-path` later), except the two
portal tools. One commit per fix, all prefixed "Sapper's Path lane P Stage 3:". Cache tag 87 -> 88 (if lane D bumps too, take
the higher number).

## 1. Peter's decisions and changes

| | What | Where |
|---|---|---|
| A | No "New here?" box on launch. `tutorial.offerOnLaunch` false: the home's Level 1 is the one tap, level 1's coach teaches. The tour stays under How to play (home and Settings); the switch brings the offer back. portal-selftest's one-tap check is stricter: anything over Play fails, the label must read "Level 1", exactly one tap reaches level 1 with the board drawn and the coach's first line up | src/tutorial.js offerMaybe, config tutorial, tools/portal-selftest.mjs walk |
| B | Zen opens once Campaign level `zen.openAfter` (5) is won; a Zen save with any picture, side quest or egg keeps it open; 0 opens it from the start. Locked: the home's Zen card greys with a padlock and "Opens after Fort 5" (`zen.text.locked`), a tap only toasts it; the map's Zen chip the same; a saved mode of zen never opens as the mode; the tour's closing card offers the Campaign alone | src/main.js zenOpen, zenLocked, livesPill, modeChip, playMode, switchMode, boot; src/tutorial.js closing; style.css `.locked` |
| C | Level 1's coach: "Goblins hold the gate. Tap a squad to tear it down!" (arrow on the card), then "Its sappers run for their colour. Faded squads move up next." "The Goblin King flees" in the siege's win line, the tour's win line and a config note (it was lowercase) | config teach e1-01, src/main.js showPanel, levels/tutorial.json |
| D | Nothing (Progress Save is a form answer) | |
| E | A board tap or Space no longer settles the run (the free speed hack). Both now call `skipShow()`: nothing while any sapper runs; once all are home it still skips the goblin's show and the sheet's wait. `skip()` stays for SP and selfTest (victory march's "skip still lands everything" uses it) | src/main.js skipShow, wire |
| F | Victory march at 2x (`show.victoryPace` 1.5 -> 2); the line reads "Victory march ×2". The harness reads the pace from config | config show, tools/harness.mjs |
| G | The bought speed is 3x (`meta.speed.x` 2 -> 3, price 100 unchanged). Final behaviour: every attempt starts at 1x; bought, it plays at 3x and the button toggles 1x/3x free until Retry or a new level; the victory march takes the faster of the button and 2x (so 1x marches at 2x, a bought 3x stays 3x); `?debug=1` still cycles 1x/2x/3x free | config meta.speed |

## 2. The known fix list

1. **Ladder tooltip over level 1's cards** (every size, not just 821x462; Zen picture 1 too). An unlock's intro now waits in the
   queue: while the level's coach has a line up, until that line points at the power-up's badge (levels 25, 50, 100, 125 do);
   with no coach line, until `meta.tipAfterPlays` (2) taps. On level 1 the tip comes after the coach's two lines. Screens:
   `scratchpad/stage3/level1-821x462-*.png` (0.3, 1.5, 3 and 5 s: no tip, the cards clear).
2. **"Turn your phone upright"** now needs a touch-only phone: `(pointer: coarse)`, no `(any-pointer: fine)` anywhere, and a device
   screen whose short side is at most `layout.upright.maxScreen` (540 CSS px). A touch laptop or Chromebook in the 821x462 frame,
   and a tablet, never get it. New selfTest check fakes matchMedia and screen for the three cases.
3. **Escape**: every binding gone (Settings, its sheets, the long-tail sheet, a power-up pick, the tour's offer and closing card);
   each keeps its visible button. No Ctrl/Cmd+W anywhere. Key bindings left, all in src/main.js unless noted: Space/Enter resume
   when paused; 1-5 play a column; R retries; Space skips the goblin's show (E); Space/Enter on the reset's hold button; the tour
   (src/tutorial.js) swallows R, 1-5 and Space under a done card.
4. **Credits.** In-game (`gallery.credits`, the map's foot): Twemoji and Noto "adapted (resized, pixelated and recoloured)" with
   CC BY 4.0 / Apache 2.0 URIs in plain text; paintings and prints from the Met, the Art Institute of Chicago, the National Gallery
   of Art and the Cleveland Museum of Art with the CC0 URI (it named the Met alone); the URIs wrap at 360 px. LICENSES.md: an
   at-a-glance table of every asset family (code art and sound; SDXL base 1.0 images with OpenRAIL++-M; FLUX.1 [schnell] images
   with Apache 2.0; paintings; LoC posters; Twemoji; Noto; music CC0; font OFL) and the licence URIs; the 6 land map sheets had no
   row (SDXL, added); the local path is gone; the third-party line no longer says "all CC0". `LICENSE-Apache-2.0.txt` (the
   licence's terms, 10,349 B) ships beside it. The portal's LICENSES.txt names only shipped files (`licences.rewrite` puts the
   studio's records and scripts in words, `dropRows` drops the thumbnail row) and the build fails on a local path or a file the
   build does not hold.
5. **Home title over the coins pill** (short screens): centred in the top row. A sweep of 124 sizes (480-1440 wide x 320-900
   tall, plus seven phones) finds no overlap with the top row, the mode cards or the tabs.
6. **selfTest's colour-blind check** (925/1 at d72193a): not flaky and not order-dependent: it fails at 821x462@1 every time and
   nowhere else of 7 viewports tried. At 9 device-px blocks the thatch, ashlar, roof tile, hedge and warded marks (1-px strokes
   and dots) antialias to soft edges with no pixel of their ink, so five materials read as a smudge. **The test was right; the art
   is fixed**: below `board.markCrisp.px` (14) a mark is snapped to whole pixels (`cover` 0.4 or more is solid ink). 821x462: 927/0.
   Screen: `scratchpad/stage3/cb-marks-821x462.png`.
7. **`?debug=1` in the portal build** stays (the selftest needs it). Nothing it adds shows without the query string, and the portal
   frames the game at its own URL, so a player cannot reach it; under it, debug-v4.json is not in the zip and logs one 404.

## 3. Stage 1 critic minors folded in

- **LICENSES.txt** (M1): above (item 4).
- **portal-build.mjs** (7a, 7b, M2): a game file named in a JSON under a key the trace does not follow fails the build; so does
  any tracked file of the game folder (git ls-files, minus tools/ and *.md) that is neither traced, a companion nor in the new
  `leftOut` (with its reason: thumb.jpg, the two spare jingles, the gallery manifest, debug-v4.json). Every shipped source must be
  tracked at HEAD. Developer notes leave every runtime JSON (80 keys, 39,767 B), all but `keepNotes`: config `eras[].note` and
  the tour's `steps[].jamNote`, which the page shows.
- **portal-selftest.mjs** (6a-6d): 5 is a gate (`maxBeforeTapBytes` 2.5 MB, no music before the tap); 7 answers only exact-case
  zipped names, adds a late-content walk (Campaign 1-5 won, both maps scrolled end to end) and fails on any zipped file never
  asked for but `neverFetchedOk` (the three licence texts); 8 fails on an untagged request and checks that progress survives a
  host reload in the cross-site frame.

## 4. Gates (portal-cg head, see the final run below)

| Gate | Result |
|---|---|
| test.js | 725 passed, 0 failed (shipped folder 87 files, 14,661,654 B) |
| freeze.js --require | 886 frozen records, 0 differences; castles 283 cases, 0 differences |
| regrade.js / --gallery | 250 levels, 2,405 checks, 0 differences / 62 levels, 372 checks, 0 differences |
| pack.js --check | the shipped files match the source |
| selftest-lands | 375x812@3 929/0, 1280x720 931/0, 360x640@3 929/0; 0 console messages |
| SP.selfTest elsewhere | 821x462 931/0 (it was 925/1), 1280x720@2, 1366x768, 1920x1080, 400x600, 375x812@2 all 0 fails |
| harness.mjs (127.0.0.1:8613) | all passed; hidden-tab selfTest 929/0; 0 console |
| portal-build.mjs (clean, 63c0512) | PASS: 77 files, 14,131,115 B unzipped, 12,330,310 B zipped |
| portal-selftest.mjs | 8 of 8 PASS incl. 4 one tap (1 tap, "Level 1", coach up, at 375x812, 1280x720, 821x462 and framed); before the first tap 1,942,338 B (375x812) / 1,993,604 B (1280x720, 821x462) in 22 files; 74 of 77 zipped files fetched, the 3 never fetched are the licence texts |

Screens: `/private/tmp/claude-501/-Users-peter-Documents-Claude/da1759a8-4ddf-49a1-b285-fc1840880945/scratchpad/stage3/`
(home-fresh-821x462, home-fresh-400x600, level1-821x462-0.3s/1.5s/3s/5s, zen-locked-card, zen-locked-tap-toast,
zen-locked-map-chip, cb-marks-821x462).

## 5. Left open

- Covers and videos (rules doc fix list 6), the 4.6(a) update process, the cold playtest and the portal account: not code.
- Once shown mid-play, an unlock's intro still sits over the tray and eats the tap that dismisses it (LATER.md).
- tools/shots-tutorial.mjs still expects the launch offer (LATER.md).
