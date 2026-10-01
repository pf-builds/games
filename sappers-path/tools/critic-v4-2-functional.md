# Sapper's Path v4, Critics 2: functional critic (M4 Gallery, M5 meta, full game)

**Verdict: PASS. 0 blocking, 0 major, 1 minor.**

The rules I rebuilt from the SPEC text match the game on all 8,364 games across all 164 levels. That includes ring entry and all four power-ups. Every browser checklist item passes at all five sizes. The one finding is a gap in the SPEC: it doesn't say what order a few log events come in when they happen at the same instant.

Build: worktree `games-sappers-path`, branch `sappers-path`, HEAD `138fd66`, cache tag `?v=22`. Local server on :8492 (stopped when I finished). Headless Chromium through Playwright, Node v24.

`SP.selfTest()`: **pass 1010, fail []**, 4.4 s.

## Re-run

Part 1 (about 45 s):

```
cd sappers-path; N=~/.local/opt/node/bin/node; $N tools/critic-v4-2/diff.mjs --patient 4 --rushed 4 --power 8 && $N tools/critic-v4-2/edge.mjs
```

Part 2:

```
nohup python3 ~/Documents/Claude/.claude/serve.py 8492 /Users/peter/Documents/Claude/business/D-click-it-studios/repos/games-sappers-path > /dev/null 2>&1 &
export PLAYWRIGHT_MODULE=$(~/.local/opt/node/bin/npm root -g)/playwright/index.mjs
$N tools/critic-v4-2/play.mjs && $N tools/critic-v4-2/play2.mjs && $N tools/critic-v4-2/play3.mjs; lsof -ti tcp:8492 | xargs kill
```

What's in `tools/critic-v4-2/`:
- `rules.mjs`: my rules, written from SPEC-v3 §1-§9, SPEC-v4 §9 (M1-M5 and the Critics 1 rules text), `config.json` numbers, and the format comment at the top of `src/engine.js`.
- `diff.mjs`: the black-box diff. Results go to `diff-result.json`.
- `edge.mjs`: hand-made boards.
- `play.mjs`, `play2.mjs`, `play3.mjs`: the browser checks. Results go to `play-result.json` and `play2-result.json`.

Screenshots are in `tools/shots-v4-critic2/functional/`. The scripts saved 18, which is over the 10 budget. I only looked at 2 of them, and every pass/fail result comes from DOM and state reads, not pictures.

---

## Part 1: rules from the SPEC text, diffed against the game

I drove the engine only through its exports: `compile`, `sim`, `rulesOf(v3, d, meta)`, `play`, `power`, `canPower`, `advanceTo(nextAt)`, `ev`, `hidden`, `save`, `hash`, `used`. I didn't read the rest of `src/engine.js`, `tools/ref.js`, `grade.js` or `gen.js`.

**Scope: 164 levels × Easy, Normal and Hard = 8,364 games.** That's the 100 Siege levels, the 4 debug levels and the 60 Gallery levels.

| Check | Games | Mismatches |
|---|---|---|
| Stored winning orders (patient): all win; same events and outcome on both sides | 492 (180 of them Gallery) | 0 |
| Stored `grade` numbers (`len` = taps = plays, `peak`, `ms` = everyone home) | 480 (180 Gallery) | 0 |
| Random legal patient play | 1,968 | 0 |
| Rushed play (random gaps of 0-1.5 s, refused taps included) | 1,968 | 0 |
| Patient play mixed with power-ups (up to 3 tries per rest, random targets, refusals included) | 1,968 | 0 |
| Rushed play mixed with power-ups (mid-show, 30% of actions) | 1,968 | 0 |

Every game compares:
- the status and fail reason, plus `jamWhy` on a jam
- every tap, refused or taken
- every power-up's result (taken, refused, or no-play)
- `hidden()` for every card after every action: 4,095,845 checks
- the full timed log of block pops, frees, reveals, power-ups, unlocks and kills

Coverage:

| Power-up | Taken | Refused |
|---|---|---|
| Ladder | 3,113 | 9,206 |
| Quartermaster | 3,939 | 8,671 |
| Scout | 593 | 11,724 |
| Recall | 1,879 | 10,044 |

- Refusals hit, on my side: the per-level limit, front card, card too deep, card not in a column, nothing hidden, empty space, invalid space, sappers out, and linked squad.
- **Every one of the 39,645 refused power-ups left the engine's save buffer, its hash and its use counts identical.**
- `canPower()` agreed with `power()` on all 49,169 tries.
- After every power-up game ended, I called each power-up again. All 15,744 calls came back no-play and changed nothing.
- Outcomes: 4,352 won, 3,711 jam, 301 short. Jams by `jamWhy`: 0 (3,258), 1 (7), 2 (446). 228 games opened the lock.

**Proof that the ring rule is really being tested.** I re-ran the Gallery with the siege tie-break swapped in (`CRITIC_SIEGE_TIE=1`). Then 1,190 of 1,260 games and all 180 stored grades mismatch. With the ring tie-break from the SPEC, it's 0.

**Hand-made boards (`edge.mjs`), 5 of 5 agree:**
- A Quartermaster pull at rest that would leave no legal front is refused (the jam test). The same pull mid-show is taken.
- A squad that turned wary is recalled, the tower falls, then the card is tapped again. The new squad isn't wary and wins.
- Ladder with the lock still shut, on Hard: open spaces 3 → 4, total 4 → 5, and a second Ladder is refused at the per-level limit.
- A Quartermaster reveal, then Scout, then a second Scout refused at the per-level limit.

### Findings, Part 1

**MINOR S1: the SPEC doesn't say what order events come in when several happen at the same instant.**
- The two sides log the same events at the same times. Only the order within one instant differs, in 656 of 8,364 games. The diff sorts within each instant before comparing.
- **Scout and Quartermaster:** the game logs `REVEAL` before `POWER`. For Recall the SPEC spells out "POWER 3 space, then FREE". For Scout and Quartermaster it doesn't say.
  - Repro: `node tools/critic-v4-2/edge.mjs`, the case "Scout after QM reveal". The game logs `0:REVEAL:2 0:POWER:1`.
- **A linked tap whose partner was hidden:** the game reveals the tapped column's new front first, then the pulled partner.
  - Repro: v4-all, Easy, stored order. At 0 ms the game logs `REVEAL 1, REVEAL 6`; reading the text, I logged 6 first.
- **Impact:** none on the rules. It only matters if the page's animation reads the log in order.
- **Fix:** one sentence in SPEC-v4 §9.

Not findings:
- Ladder's 8-space maximum can't be reached while the per-level limit is 1 (Easy goes 6 → 7 at most).
- Recall's "has sappers waiting" never decides anything: a squad with nobody waiting and nobody out has already freed its space.

---

## Part 2: browser

Sizes: 375×812 touch, 375×667 touch, 1280×720, 812×375 touch, and the 400×600 iframe via `tools/iframe-host.html`.

| Item | Result | Evidence |
|---|---|---|
| Zero console errors or warnings | **PASS** | 0 in every run: Siege win and loss, Gallery win and loss, power-ups, saves, lives forced on, all five sizes. |
| Home screen, 1 tap to gameplay | **PASS** | Fresh save shows progress 0/100, 400 coins, "Level 1", no hearts, Gallery tab "Opens at 25". Play opens e1-01 in 37-173 ms. Play, settings, map and Gallery buttons pass `elementFromPoint` at all 5 sizes. |
| Win report: time, taps, coins, best, medals | **PASS** | Level 1 played at 3× with real taps, waiting for rest. Report says 7,033 ms ("0:07"); my wall clock to the deciding moment was 7,068 ms. Taps 6, coins +30 (10 + 20 "New medal"), "First win", N medal lit, balance 400 → 430. |
| Report time leaves out pauses | **PASS** | A 3,051 ms blur pause mid-level. Report 7,116 ms against 7,015 ms (wall time minus the pause). |
| Repeat win | **PASS** | +10 only. "Best 0:07", "Best 6". |
| Coins by difficulty | **PASS** | Hard first win +60, Easy first win +15, Hard repeat +20 (shown and credited). A debug level earns 0. |
| Fail reports (Siege) | **PASS** | e2-46 jam, real taps. Sheet shows "Line jammed" plus chips; crew names are in the aria-label. Coins and lives unchanged; Retry resets. |
| Fail reports (Gallery) | **PASS** | g-met-57007 Normal with a jam order my rules found (`12431431030323340111212212344401100202300`). Jam sheet, aria "Line jammed: Brown and Slate can't reach a block." (the picture's own colour names), no coins. |
| Buying with coins, and the short-of-coins refusal | **PASS** | At 50 coins, a Ladder "+" shows "Ladder costs 120: you have 50 coins"; nothing spent. Buying Ladder takes 400 → 280 and Quartermaster 280 → 200, each with a "bought (-N coins)" toast. |
| Ladder | **PASS** | Using it: 5 → 6 spaces (6 slots drawn), inventory 1 → 0, badge shows "spent". A second Ladder in the same level: "Ladder: 1 per level", not spent, still 6 spaces. |
| Quartermaster | **PASS** | Badge turns on pick mode; tapping the badge again cancels and costs nothing. Picking a row-2 tile moves it to the front (col 0 "27 45" → "45 27"). Inventory 1 → 0, plays unchanged. |
| Scout | **PASS** | With nothing hidden: "No hidden squads to scout", not spent. On v4-mystery: hidden 11 → 0, no `.mys` tiles left. |
| Recall | **PASS** | An empty space in pick mode keeps the pick ("Pick a waiting squad to recall"), not spent. A working squad is refused ("No squad is waiting with all its sappers home"), not spent. A stuck squad goes back to its column's front (col 3: 37 → 45) and the line empties. |
| Gallery locked before 25, open after | **PASS** | With 24 Siege wins, the tab doesn't open. With 25, it opens a grid of 60, "0/60 cleared", a credits line and no links. |
| Gallery full win, picture shown in colour | **PASS** | g-tw-1f355 with real taps: "Picture razed! Pizza Slice cleared on Normal", "Next picture", +30 coins. The top-bar button goes back to the Gallery, which then shows "1/60 cleared". The cleared tile is in colour (average chroma 119 against 15 for an uncleared one), with title and N medal. |
| Save and reload | **PASS** | Coins, inventory, best (`e1-01: [0,7033,0,0,6,0,40]`) and progress are identical after reload. |
| Pre-M5 save | **PASS** | 30 Siege wins, no coins, inventory, best or Gallery fields. Loads as 30/100, "Level 31", 400 coins, empty inventory, Gallery open. |
| Junk save | **PASS** | coins "lots" loads as 0, and 1e12 is capped at 9,999,999. Inventory 500 → 99; -3 and "x" → 0. A best entry for an unknown id is dropped. Best times and taps on unwon difficulties are zeroed (1e9 → 0, 9999 → 0). A Gallery mask of 9 → 1; an unknown id and a non-number are dropped. |
| Lives off on the shipped build | **PASS** | Hearts pill hidden, no visible heart icon anywhere, `meta().lives.on` false. |
| Lives forced on (`SP.forceLives`) | **PASS** | With 1 life, the pill reads "1 · 20:00". A Siege fail costs it: "-1 life (0 left)". Retry goes home. Play reads "Next life 19:59" and tapping it gives "No lives left: the next one comes in 19:59" and starts nothing. With the clock 20 minutes on, lives refill to 5. Not tested: the "clock went back" restart. |
| Settings | **PASS** | The gear opens a sheet with Sound, Speed (cycles) and Colour-blind marks. All three save (`muted`, `speed`, `cb`); Done closes it. |
| Pause on blur | **PASS** | Engine clock frozen (350 stays 350 over 500 ms). The Paused sheet carries the colour-blind and mute toggles, and the resuming tap plays no card. |
| 2-row queue rule | **PASS** | Rows per board over all 160 Siege and Gallery boards: 375×812 has 0 two-row boards; 375×667 has 57 (the SPEC says 57); 812×375 and the iframe have 160 (short frames). |
| ≥ 8 CSS px a cell | **PASS** | Smallest cell over all 160 boards: 8.0 (375×812), 8.0 (375×667), 16 (1280×720), 9.5 (812×375), 8.0 (iframe). Every time it's g-met-57007. |
| Viewport checks on level 1 and the largest Gallery board | **PASS** | No overflow either way. Power badges, front tiles, map, retry and speed all pass `elementFromPoint`. Report buttons pass and the sheet fits the screen, at all five sizes. |
| Busiest moment, largest Gallery board | **PASS** | g-met-436528 (42×34), Easy, 4× CPU throttle, every front rushed three times: peak 62 runners. rAF p50 16.7, p95 16.7, max 16.8 ms; 0 frames over 33 ms; 0 long tasks. `SP.perf(30)` at 4×: 0.06 ms mean, 0.6 ms max per draw. |
| Payload and load time | **PASS** | 14 files, 886 KB (the local server doesn't gzip). Biggest: main.js 184 KB, levels.json 172 KB, gallery.json 142 KB, font 78 KB. Home ready 35 ms after reload, DOMContentLoaded 11 ms. |
| Map era report cards | covered by selfTest | My selector didn't match the card markup, so I didn't check the cards in the browser. selfTest checks each card's cleared count, coins and medals against the save (`main.js` ~1701), and it passes. |
| `SP.selfTest()` | **PASS** | 1010 pass, 0 fail. |

### Findings, Part 2
None.

### Notes (not counted)
- The jam sheet's visible text is only colour chips with counts (for example "51373"). The crew and colour names are only in the aria-label. That is what the Critics 1 fix pass asked for.
- Opening the Gallery with `SP.unlockTo(25)` only writes the save; the tab state updates after a reload or the next render. Debug facade only.
