# Sapper's Path v7 lane T (space budget): functional critic

2026-10-09. Branch `space-v7` at 0907f41, compared with a11e9bf (v6.3) exported to scratch with `git archive`.
New build served on 8481, base on 8482. Headless Playwright only. The scripts are mine and were written without the
builder's tools: `tools/critic-space-v7/equiv.mjs`, `saves.mjs`, `lazy.mjs`, `lazy2.mjs`, `race.mjs`, and their `*-out.json`
files. The harness screenshots are in `tools/critic-space-v7/harness/`.

## BLOCKING

**B1. A Zen level still waiting on its world file takes over a level the player has already started.**
Base never does this; it's new code (`wantLevel` / `startLevel`, main.js).
- Repro (`race.mjs` / `lazy.mjs` S4; Fast 3G through CDP, fresh storage): open the Zen map and tap picture 1 so World 1
  loads and plays. Go to the home, then back to the Zen map. Tap picture 101 (World 3). The map stays put, and after 300 ms
  it shows "Opening World 3...". While World 3 is still loading, tap picture 1. It starts at once and the player starts
  playing it. When `zen-3.pk.json` arrives, the game drops picture 1 and starts picture 101 with no tap.
- Evidence (lazy-out.json `s4`): mid `{screen: play, num: "1", pend: {id: "z3-1", toast: true}}`, then after the load
  `{screen: play, num: "101"}`, `SP.state().id = "z3-1"`, `plays 0`. `app.pend` was never cleared.
- Cause: `startLevel` of a level that's already loaded doesn't cancel `app.pend`. Only `showScreen(name !== "play")` does.
  Switching the map to Campaign clears it (checked: no hijack), but another Zen node, a Zen side quest or the tail tile
  doesn't. Fix: `cancelPend()` in `startLevel` whenever the level being started isn't the pending one, or have the
  resolve check `app.screen === "map"`.
- This breaks the "zero change to how anything plays" promise on any slow connection. The fix is one line.

## SHOULD-FIX

**S1. Merge recipe §8 step 2: the check gives the wrong answer from the game folder, and the recipe mixes working
directories.**
- I dry-ran the recipe on a scratch clone (`git clone` of the common dir, not a worktree). A simulated lane D branch from
  a11e9bf edited a title in zen.json and a hint in levels.json, added a tool reading `../levels/zen.json`, and bumped `?v=66`.
- What worked: `git merge space-v7` carried both edits into `tools/build-data/levels/*` by rename detection. The only
  conflicts were index.html and style.css (the cache tag). Step 6's grep found the new tool, and its perl replace fixed
  it (the tool then ran). `pack.js` wrote levels.pk.json and zen-4.pk.json with lane D's edits, and `pack.js --check`
  passed. No plain level file was left in `levels/`.
- What's wrong: run from `sappers-path/`, `git diff --quiet a11e9bf HEAD -- sappers-path/levels/zen.json` exits 0
  ("unchanged") for all three files, because the pathspec is relative to the working directory. From the repo root it
  exits 1. Steps 6 and 8a use root paths (`sappers-path/tools`), while 8b and 9 use game paths (`tools/pack.js`,
  `tools/test.js`).
- In my run rename detection did the work anyway, so nothing was lost. But the check meant to catch a failed carry
  can't catch one. Fix: say "repo root" once, and use `git -C "$(git rev-parse --show-toplevel)"` or `:/sappers-path/...`
  pathspecs.

## MINOR

**M1. Slow-network waits moved to the first Zen tap** (Fast 3G, `lazy.mjs` / `lazy2.mjs`). The home is much faster:
14.4 s against 23.3 s. Opening the map takes 123 ms (base 203 ms) and requests no world file.
- First tap on the Zen card, cold: 1,264 ms (base 178 ms), with the "Opening World 1..." toast.
- Opening a world cold from the Zen map: 10.0-10.9 s for each of the 4 worlds. The world file waits behind the map
  sheets that are loading at the same time.
- Crossing World 1 to 2: win picture 50, then Back to map, then tap 51 takes 1,759 ms (base 8 ms). The prefetch on the
  win had been requested but hadn't landed yet.
- Suggestion: fetch the frontier world when the Zen map or the Zen card is shown, not only when Zen was the last mode
  played. The behaviour is otherwise correct: nothing on screen changes until 300 ms, the toast is right, and the
  level starts once the file is in.

**M2. Stale names in docs and comments (none reach the page):**
- `tools/map-gen/README.md:16` still says assemble.py writes `map/sheet-NN.jpg`.
- `config.json` (gallery note) and the comments at main.js:57 and :250 still name `levels/gallery.json` and
  `levels/zen.json`.
- The `tools/playtest-bundle.py` docstring (lines 6-7) still lists `levels/levels.json` and `gallery.json`.

No page, CSS, preload, manifest, iframe host or thumb references a castle `.jpg`. I counted 0 requests with status 400
or above across all runs.

## Verified (no finding)

- **Equivalence (my own code).**
  - Each page's own files gave the same set of 462 records on both builds (250 levels.json, 62 gallery, 150 Zen), with
    the same ids. With DROP removed from base, there were 0 field differences.
  - `E.compile` output was the same for all 462. `worlds` are deep-equal.
  - Through the page: `SP.load` was run for all 462 (Campaign 1-200, the 62 Gallery ids, every Zen id), recording
    state, line, fronts, cap, w/h, links, hidden, locked, tag, lvl-num, lvl-name and the stored win order. 0 differences.
  - `SP.zen()` and `SP.gallery()` lists are identical.
  - DROP fields: an independent grep of src/ and index.html finds no read of any of the 18, and engine.js is unchanged.
- **Play with the same taps on both builds:**
  - Wins: 1, 5, 100, 200, g-ours-g01, z1-1, z3-1, z4-1.
  - Losses: 37 (a jam). For 150 and z4-1 my loss plan didn't jam, but both builds ended identically.
  - All 11 runs had the same status, reason, plays, win line, and the whole of localStorage (coins and records).
- **Saves.**
  - Built on the base page: the v6.2 fixture plus wins on 38, 39, z3-8, z4-4 and z1-13, a speed change, Zen played
    last, 1002 coins.
  - Read on both builds at 375x812 and 1280x800: identical home pills, cards, labels, toggles, SP2 code, mode, the first
    level of each card, `SP.map()`, and every map button's label, position and hidden state, for both maps. localStorage
    after the reads was identical.
  - SP2 code loaded through Settings > Load: the same message ("Level 40, 1002 coins, 5 side quests, 3 easter eggs; Zen:
    29 of 212 pictures") and the same result.
  - SP1 code (v5-era places): the same on both builds.
  - v5-style storage (Campaign key only): identical, and the Zen card plays picture 1 "Red Fuji" on both.
- **Lazy loading.**
  - A fresh home and the Zen map request no world file. The map has 200 nodes.
  - Backing out mid-load, then opening World 4, plays 151, and World 3 never starts.
  - With World 4 blocked: "Couldn't open World 4. Check the connection and try again." The map stays, the toast
    clears, and an unblocked retry plays 151.
  - Reloading mid-World 3 prefetches zen-3 only, and the Zen card plays 108 in 42 ms.
  - A Campaign-only player fetches no Zen file.
- **Bytes** (unthrottled, files as served):
  - Base: home 3,457,047 B, Campaign 6,938,181 B, Zen 6,938,181 B. All exact.
  - New: home 1,854,397, Campaign 5,335,531, Zen 5,390,342. Each is 111 B over the builder's figure, which doesn't matter.
- **Sizes** (`find` + `stat`, everything except `tools/` and dot files):
  - Totals: base 16,530,429 B against 13,794,070 B.
  - Castle WebP 5,840,706 B over 25 sheets. Land sheets 1,365,988 B. Audio 3,505,381 B. Art 822,506 B.
    src 777,053 B. Fonts 82,127 B.
  - Levels: levels.pk 227,170; Zen index 18,008; world files 54,811 / 57,482 / 62,533 / 72,893; gallery.pk 79,714;
    other files 115,631.
  - Every row of the §7 table matches.

## Gates

| Gate | Result |
|---|---|
| tools/test.js | 713 passed, 0 failed (exit 0) |
| tools/freeze.js --require | PASS: 2,405 / 372 / 1,350 checks, shipped 462 records, castles 283, all 0 differences (557 s) |
| regrade.js full / --gallery / --zen | 0 / 0 / 0 differences (2,405 / 372 / 1,350 checks) |
| regrade.js --shipped / --gallery --shipped / --zen --shipped | 0 / 0 / 0 differences |
| pack.js --check | shipped files match the source |
| selfTest (selftest-lands.mjs --wide 1280x800) | 876/0 at 375x812@3, 878/0 at 1280x800, 0 console messages |
| harness.mjs | all passed (selfTest 876 and 878 on each viewport), 0 console messages |
| Console on the new build, all my runs | 0 errors or warnings. The one exception is the browser's own net::ERR_FAILED for the deliberately aborted zen-4 request. |

**Verdict:** the packing, WebP and lazy loading do what the notes promise, but one new bug blocks it. A Zen level still
waiting on its world file can take over a level the player has already started (B1). Fix B1 (one line) and S1, then ship.
