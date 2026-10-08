# Sapper's Path v4 M2 notes: the rules (2026-09-30)

Brief: three new twists (mystery cards, linked squads, a locked space) in the engine, the reference rules, the tests, the grader and the page, plus debug levels that show each one. No rebake. Plan: `game-research/sappers-path-v4/plan.md` items 1-3. Rules as built, precisely: `SPEC-v4.md` §9 (the M2 entry). Engine header: `src/engine.js`.

Page: http://127.0.0.1:8491/sappers-path/?debug=1 (the map's "v4 twists" row, or `SP.load("v4-linked")`). Cache tag `?v=17` everywhere (scripts, CSS, the font URL in style.css, the config, levels and debug-levels fetches).

## Commits (branch `sappers-path`)

| Commit | What |
|---|---|
| `f5f02f0` | Engine, reference rules, grader, tests, debug levels, rush.js, m2-measure.js, `v3.twists` in config |
| `ccd117e` | The page (main.js, board.js, style.css, index.html, page config), harness, shots script |
| docs commit | This file, SPEC-v4 §9, LATER.md, and the page solver fix (legal taps only) |

## Files

| File | What changed |
|---|---|
| `src/engine.js` | Card flags (mystery), `links`, `lock`; pulled cards (`gone`), paired spaces (`spL`), locked spaces and `jamWhy` in the one state buffer; `place`/`pair`/`advanceHead`; refusal needs 2 for a linked card; coupled freeing; unlock on the key's pop; generalized jam; events REVEAL, LINK, UNLOCK; accessors `open`, `locked`, `jamWhy`, `card(j, d)`, `refused(j)`, `hidden(ci)`, `partner(ci)`, `held(s)`; dealing `playPair`; `E.check` warnings; the hash covers pulled cards and pairs on linked levels. |
| `tools/ref.js` | The twists, written independently: columns as lists of cards, pairs as space references, a lock counter, the jam as "no front card's tap would be taken". |
| `tools/grade.js` | Legal taps only in every player; `view(S)` and `look(S)` (the info model); `fast` (the fast tapper). |
| `tools/rush.js` | Adds the fast tapper at 0 and 300 ms, a `--late` switch (levels 46-75) and a mean row. |
| `tools/test.js` | 60 new checks (216 total). |
| `tools/debug-v4.js`, `levels/debug-v4.json` | The four debug levels, solved and verified per difficulty; `--check` rebuilds and diffs. |
| `tools/m2-measure.js` | The grader measurements below (writes nothing). |
| `src/main.js` | Mystery tiles, rods and stubs, linked refusal (both tiles shake, the toast), linked and held spaces, the padlocked socket and its pop, jam text with the reason, the debug row, `SP.fixture(name)`, selfTest checks 18-22, legal taps in the page solver and search. |
| `src/board.js` | The space key's corner brackets; REVEAL, LINK, UNLOCK hooks. |
| `style.css`, `index.html` | Mystery tile, rods, padlock, chain, held; `?v=17`. |
| `config.json` | `v3.twists` (lockSpaces 1, linkRowGap 2); `layout` texts, `mystery`, `rod`, `debugRow`, `debugNum`; `show.flipMs`, `show.unlockMs`; `board.lockKey`; cues `unlock`, `flip`; selfTest fixtures `linkJamLevel`, `lockJamLevel`, `debugOrder`. |
| `tools/harness.mjs` | The debug row by real taps, a real linked tap; output to `tools/shots-v4-m2/harness/`. |
| `tools/shots-v4-m2.mjs` | The M2 screens. |

## Decisions (all logged in SPEC-v4 §9)

- Partners must be in different columns (compile throws); the validator warns at more than 2 rows apart and at non-neighbouring columns.
- Lock: `v3.twists.lockSpaces` = 1 on every difficulty (Easy 5 + lock, Normal 4 + lock, Hard 3 + lock), never all spaces.
- A linked tap is one play; the tapped squad takes the lower space; both dispatch at the same instant.
- A pair's spaces free together when the second squad finishes; a Hard-killed sapper counts as finished.
- The jam names only stuck squads (identical on old levels, where every squad at a jam is stuck).
- The space key reads apart from gate keys by shape and colour: cream corner brackets (the socket's colour) against a gate key's full ring in its gate's tint.
- The refused-linked toast is "Linked squads need 2 free spaces" whenever the refused card is linked.
- Debug levels are copies of baked levels. The builder picks links that keep the one-move lookahead winning, since an arbitrary link made e1-20 unwinnable for it (lookahead 0%).

## Grader measurements

### Mystery against the thinking player

Ten late levels (46, 48, 49, 52, 54, 57, 61, 64, 69, 73), Normal, four variants each:
- plain: baked;
- mystery: every card behind a front flagged;
- linked: 2 seeded links, kept only if Normal still solves;
- linked + mystery.

Columns: rand = random-tap rate (400 games); look1 = the one-move lookahead (`grade.greedy`, 400 games); look2 = a two-move lookahead prototype, honest (200 games); look2* = the same player knowing the hidden colours. `node tools/m2-measure.js 400 200`, 25 s.

| mean of 10 | rand | look1 | look2 | look2* |
|---|---|---|---|---|
| plain | 3.0% | 14.2% | 32.4% | |
| mystery | 3.0% | **14.2%** | 52.4% | 32.4% |
| linked | 1.8% | 37.0% | 40.4% | |
| linked + mystery | 1.8% | **32.0%** | 39.8% | 44.1% |

- **The one-move player can't feel mystery.** Its rate is identical with and without flags on all 10 levels, because it only ever reads front cards, which are always revealed.
- It feels mystery only through a hidden linked partner: 37.0% → 32.0% (−5 points) on the linked variants.
- **The two-move prototype reacts, but in the wrong direction.** Honest, it beats itself with full knowledge (52.4% against 32.4%). Its score, the line length, is a poor value, and averaging over colours works as a tie-breaker. So it doesn't measure what a "?" costs.
- **A sounder measure: a sampling planner.** At each turn it takes 8 colourings of the hidden cards drawn from the unseen counts and, for each legal tap, counts the colourings the patient solver still wins. `node tools/m2-measure.js --pimc 6`, 6 games a level, 526 s.
  - Mystery variants: honest **3.3%** against **100%** all-seeing.
  - Linked + mystery: honest **1.7%** against **100%** all-seeing.
- With every card behind the fronts hidden, a strong player who can't see them drops to the random floor. Random colourings of a tuned late deck are almost never solvable, so the samples carry no signal.

**Proposal for M3's grader.** Keep the bands on the random and one-move players, which are unchanged by mystery. Grade each mystery level with a sampling planner's honest-vs-all-seeing gap, and have the dealer place few flags: 2-4 hidden cards in the visible rows 2-3 rather than whole columns. The prototype with the full solver costs about 9 s a game on a late level, too slow for a bake of thousands of candidates. A bake-speed version should roll out each sample with the one-move player instead of the solver.

### Fast tapper against patient play, levels 46-75 (Normal)

`node tools/rush.js 400 --late`, 400 games per column per level:
- mean patient **15.2%**; fast tapper **14.6%** at 0 ms between taps, 14.7% at 300 ms; the old rushed players 14.8% (0-3 s waits) and 15.2% (0-1 s);
- largest fast-minus-patient gap: **+5.0 points, level 61** (11.0% against 6.0%). At 2,000 games level 61 is 11.2% fast against 5.9% patient, about twice as easy for a fast tapper;
- no other late level is more than 2.5 points easier fast. Several are harder fast (L55 33.0% against 43.8%, L60 43.0% against 48.3%).

| level | patient | fast 0 ms | fast 300 ms | level | patient | fast 0 ms | fast 300 ms |
|---|---|---|---|---|---|---|---|
| 46 | 5.0% | 3.8% | 4.0% | 61 | 6.0% | 11.0% | 9.5% |
| 47 | 9.3% | 8.3% | 9.0% | 62 | 5.0% | 5.5% | 5.5% |
| 48 | 3.5% | 3.3% | 3.5% | 63 | 2.8% | 2.0% | 2.0% |
| 49 | 1.8% | 2.0% | 2.8% | 64 | 2.0% | 1.8% | 1.8% |
| 50 | 48.3% | 49.3% | 49.3% | 65 | 39.8% | 38.3% | 38.3% |
| 51 | 100% | 100% | 100% | 66 | 3.0% | 3.0% | 2.5% |
| 52 | 3.0% | 2.3% | 2.5% | 67 | 4.3% | 4.8% | 4.8% |
| 53 | 2.5% | 3.3% | 3.3% | 68 | 5.0% | 3.8% | 3.8% |
| 54 | 2.8% | 2.8% | 2.5% | 69 | 2.5% | 2.5% | 2.3% |
| 55 | 43.8% | 33.0% | 34.8% | 70 | 43.8% | 43.5% | 43.5% |
| 56 | 2.3% | 1.3% | 1.3% | 71 | 7.5% | 5.0% | 5.0% |
| 57 | 3.0% | 3.8% | 3.5% | 72 | 5.8% | 5.5% | 5.5% |
| 58 | 5.8% | 7.5% | 7.5% | 73 | 0.8% | 1.0% | 1.0% |
| 59 | 1.8% | 1.0% | 1.3% | 74 | 0.8% | 2.0% | 2.0% |
| 60 | 48.3% | 43.0% | 43.0% | 75 | 46.3% | 44.3% | 44.3% |

### Throughput (grader speed), before → after

| run | before | after |
|---|---|---|
| `regrade.js --quick` (3 runs, wall) | 2.52 s | 2.61 s (+3.5%) |
| `regrade.js` full | 3.5 s | 3.6 s |
| `rate` 200 games × 75 levels (best of 5) | 454 ms | 457 ms (+0.7%) |
| `greedy` 60 games × levels 46-75 | 239 ms | 251 ms (+5%) |
| `solve` × 75 levels | 19 ms | 19 ms |

The lookahead's 5% is `look()`'s legality check and float scores. No hot loop allocates on a level without links.

## Verification

- `node tools/test.js`: **216 passed, 0 failed** (156 before).
  - No-hang sweep: 4,796 rest states in 738 random games on 41 twisted levels, 0 hung.
  - Differential on twists: 246 games, 3,326 taps (1,579 refused), 21,453 pops, 335 pairs, 55 unlocks, 522 reveals, 0 differences.
  - The original differential still passes: 450 games, 0 differences.
- `node tools/regrade.js` (full): **75 levels, 525 checks, 0 differences**, exit 0.
- `node tools/debug-v4.js --check`: matches a fresh build.
- `levels/levels.json` md5 `94380893acb6baf798530cae7bac1360` and `tools/build-data/teaching.json` md5 `6fc2ec5ed5f411c7e5b06ead49fd5537`, before and after. Not in any M2 diff.
- `SP.selfTest()`: **588 pass, 0 fail**, about 0.85 s (555 before). New:
  - every debug level's stored order wins on Easy, Normal and Hard through `playCol` (12/12);
  - mystery tiles, colour-blind off and on: hidden ones show only "?" and their count, nothing of their card in the markup; 42 flips seen;
  - rods at load; a pair leaves together (runners from both spaces, both chained); a stub;
  - a linked refusal with one space free is byte-identical (engine, tray, line, board), both tiles shake, the toast;
  - the padlock, the unlock cue once, the pop, the space open;
  - both jam sheets say why; both fixtures win with the right order.
- Harness (`tools/harness.mjs`): **all passed** at 375×812, 812×375, 1280×720 and the 400×600 iframe, plus the hidden tab; **0 console errors or warnings**.
  - New: each debug level from the map row by a real tap (cells 12-22 CSS px), and a real linked tap sending both squads.
  - Frames unchanged: p95 16.7-16.8 ms.
- Screens: `tools/shots-v4-m2/` (gitignored), 13 at 375×812 and 13 at 1280×720:
  - `*-v4-{mystery,linked,locked,all}-rest`, `*-mystery-reveal` (the flip frozen), `*-linked-leaving`, `*-linked-refused`;
  - `*-lock-before`, `*-lock-popping`, `*-lock-after`;
  - `*-jam-linked-sheet`, `*-jam-lock-sheet`, `*-map-debug-row`.

## What M3's dealer will need

- **Dealing a pair.**
  - Simulate it in dealing mode with `S.playPair(m1, n1, m2, n2)` at the moment both squads should go out. It needs 2 open spaces or the deal fails `overflow`.
  - In `play` (the dealt order) mark the pair. Then `assign`/`colsOf` must put the tapped card where the order taps it (its column's front at that moment), and the partner in a neighbouring column, within `v3.twists.linkRowGap` rows of it as dealt (`E.check` warns otherwise).
  - The partner need not be at a front; it is pulled from wherever it is.
- **Tuning moves** (`gen.js` `stage`, `narrowStage`) must keep links valid.
  - Moving a linked card to another column can break "different, neighbouring columns" or the row gap.
  - Splitting a linked card must keep the link on one half; merging must drop it or keep it on the merged card.
  - Re-run `E.check` after each move.
- **The lock.**
  - Add the key to the fort plan: a gilt pixel that is not a gate key, dug in one layer, like `tools/debug-v4.js` `lock()`.
  - Add a Looters card for it, keeping the per-colour sums equal to the pixels.
  - Deal with `lock` on the level: dealing mode honours it, with one fewer open space until the key pops.
- **Mystery** changes nothing in the deal. Flags go on after it; see the grading proposal for how many and where.
- **Grading.** `rate`, `greedy`, `orders`, `solve` and `narrow` already play legal taps only and handle every twist. `grade.fast` gives the fast-tapper rate per level (the plan's check). For mystery levels, add the sampling metric (proposal above).
- `tools/regrade.js` stays the no-regression check for levels without twists. After M3's rebake it becomes the check against the new file.

## Open

- Level 61: the fast tapper wins it about twice as often as patient play (11.2% against 5.9%). Information for M3; nothing retuned.
- The mystery grading metric is a proposal with a slow prototype. M3 decides.
- Rods between partners two rows apart and a column over cross the corner of a tile in between (visible in `375-v4-all-rest`). Fine for the debug levels; the dealer could prefer one row apart.
