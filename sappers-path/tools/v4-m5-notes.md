# Sapper's Path v4 M5 notes: the meta layer (2026-09-30)

Brief: a home screen, a level report, coins, four power-ups and a lives system that is built but off on the web. No level changes. Plan: `game-research/sappers-path-v4/plan.md` ("Meta (main menu)", Decisions 1, 2 and 6). Visual brief: `tools/critic-v4-1-visual.md` §3 and its carry-forward lines; LATER's m5 (win payoff) and m8 (colour-blind in settings and pause). Decisions log: `SPEC-v4.md` §9, the M5 entry (the power-up rules are exact there).

Page: http://127.0.0.1:8491/sappers-path/?debug=1. Cache tag `?v=22` everywhere (scripts, CSS, the font, the fetches). New script `src/meta.js`.

## Commits (branch `sappers-path`)

| Commit | What |
|---|---|
| `a62e440` | Engine power-ups (`power`, `canPower`), the per-column card order, per-card counts and face-up flags; `tools/ref.js` power-ups written from the rules text; tests (known answers, refusals, limits, balance, identical play with none used, a random engine-vs-reference differential); `config.json` `meta` (uses and prices) |
| `6578d9c` | `src/meta.js` (coins, inventory, best results, lives, all with an explicit clock) and the save's new fields; tests |
| `ca9b196` | The page: home screen, settings sheet, level report, report cards, the power-up bar and its layouts, two-row short frames, pixel icons (`art.js`), the POWER hook (`board.js`), selfTest section 25 |
| `cc8b36b` | `tools/harness.mjs` (home, settings, power-ups by real taps) and `tools/shots-v4-m5.mjs` |
| docs commit | This file, SPEC-v4 §9, LATER.md |

The brief listed "home and report" and "power-up bar and layout" as two commits. They touch the same lines of `main.js`, `style.css`, `index.html` and `config.json` (the bar's size decides the board's room, the home shares the pills and icons), so they went in as one page commit (`ca9b196`) rather than a split that would leave a broken middle state.

## 1. The power-ups (rules as built; exact text in SPEC-v4 §9)

All four are engine operations at the engine's current time, like a tap: `S.power(k, a, t)` runs the clock to t, then takes or refuses. Taken: logged `POWER k a`, no engine time, not a play. Refused: `REFUSED`, the state byte-identical, nothing counted, and the page spends nothing. Not playing or dealing: `NOPLAY`. Uses per level (config `meta.powers[k].perLevel`): Ladder 1, Quartermaster 3, Scout 1, Recall 2. Rules without `powers` (the grader, the dealer, the critic's diff) allow none.

| Power-up | Taken when | What it does |
|---|---|---|
| **Ladder** | the line has fewer than 8 spaces | one more open space for this attempt; a locked space stays the last one (the new open space is just below it) |
| **Quartermaster** (a card) | the card is in its column, not the front, at most 2 cards back (`meta.pullDepth`); and at rest, some front card's tap would then be taken | the card moves to the front, the cards it passes step back one; hidden: revealed (`REVEAL`); linked: still linked |
| **Scout** | some card is hidden | every hidden card is revealed (`REVEAL` each) |
| **Recall** (a space) | the space holds an unlinked squad from a card with sappers waiting and none out | that card goes back to the front of the column it came from, its count = the sappers waiting; the space frees at once (`FREE`) |

Edges decided and logged:
- **What "waiting" means for Recall:** sappers at the space and none out (on Easy and Normal an archer-hit sapper walking back counts as out). At rest that is exactly a stuck squad; mid-show it can also be a squad whose next pixel isn't open yet.
- **Linked squads:** Recall refuses either squad of a pair (a pair frees together; returning half would break that). Quartermaster may pull a linked card; its tap still pulls the partner.
- **A mystery card pulled forward is revealed;** a card once face up stays face up even when a Quartermaster puts another card in front of it (the M2 rule, "revealed when it reaches the front", now tracked as a flag so a card pushed back doesn't hide again).
- **Ladder with the lock and the line maximum:** see the table; Easy's 6 + 1 is the most the shipped limit allows; the engine refuses past 8.
- **Mid-show:** everything acts at the current engine time; squads out keep walking. The Quartermaster's "would it jam" test applies only at rest (mid-show the line is judged when it comes to rest, as after any tap).
- **No power-up can end the level by itself:** after a Ladder, Scout or Recall a legal tap exists whenever one did; the Quartermaster refuses at rest when it would leave none.
- **Balance:** every colour's sappers (cards in the columns by their current counts, plus waiting and out) are unchanged by each power-up; at every patient rest state of the random differential they equal its pixels standing.
- **Grading ignores power-ups:** `grade.js`, `gen.js`, the stored orders and the baked grades are untouched; with none used, the power rules replay every stored order state for state (hash, clock and buffer, tested on the debug levels and every tenth baked level on all three difficulties).

The page: four round badges under the queue (the foot of the side column on wide screens), each a 20×20 pixel icon drawn in code (`art.js`: a siege ladder, the quartermaster's crate under a gold arrow, a brass spyglass, an ivory recall horn), with the count owned, or a green "+" and its price on a pill. "+" buys one in place (short of coins: the toast names the price and the balance; nothing spent). An owned Ladder or Scout is used at once; the Quartermaster and Recall ask for a target (the tiles or spaces the engine would take glow; a tap on one applies; the badge again, a front card or Escape cancels; with no target at all the tap is refused with the reason). A badge whose uses are gone shows a check. The coin balance sits at the left of the bar.

## 2. Coins and the economy (proposal; `config.json` `meta.coins`, `meta.powers`)

| | Easy | Normal | Hard |
|---|---|---|---|
| A win | 5 | 10 | 20 |
| First win on that difficulty (a new medal), added | 10 | 20 | 40 |

- Prices: Ladder 120, Quartermaster 80, Scout 60, Recall 100 (all four: 360).
- Starting balance 400: a new player can try each power-up once, with 40 spare. A first Normal clear earns 30, so a power-up costs two to four first clears or six to twelve replays.
- **Old saves:** a save from before M5 has no `coins` field and loads with the starting balance (400), the same as a new player; a junk coins value loads as 0. The inventory starts empty, no best results, full lives.
- Debug levels and selfTest fixtures earn nothing; Gallery pictures earn like siege levels.

## 3. The home screen, the report, settings, lives

- **Home** (replaces the title, the same `#title` screen and `#btn-play`): the bright title scene; a top row with the settings gear, the siege's progress (castle, x/100) and coins (lives only with `meta.lives` on); the logo; the next level's era chip, the difficulty switch and one gold Play, 70% wide and 64 px tall, labelled "Level 41" (one tap from load to that level); a tab bar: Siege map, Home, Gallery (padlocked, "Opens at 25", until siege 25 is won, as M4 built). The story paragraph moved to the top of the map. Landscape phones put the logo in the top row so it no longer sits on the keep (Critics 1 m2 leftover).
- **Settings sheet** (the gear): sound, speed (1×, 2×, 3×) and colour-blind marks, each showing its value; Done or the backdrop closes it. The Paused sheet carries colour-blind and sound (LATER m8; its toggles don't resume the game, a tap anywhere else does).
- **Level report** (the win sheet, LATER m5's payoff): time, taps and coins in three cells; the coins count up (`meta.report.countMs` after `countDelayMs`) with a coin cue; under time and taps the best ever on that difficulty ("New best!", "Best 1:05", "First win"); the E/N/H medals stamp as before. Time is real play time on the page's clock (pauses excluded; the speed button and skips make it shorter). The fail sheet keeps its reason and chips, plus "-1 life (4 left)" when lives are on. A Gallery picture gets the same report.
- **Report cards:** each era on the map (cleared x/25, medals E/N/H, coins earned there) and the Gallery screen (the same for its 60 pictures).
- **Lives** (`meta.lives` **false**; `livesMax` 5, `livesRefillMin` 20): when on, a fail costs one, one comes back every 20 minutes of real time (counted lazily from timestamps, never a timer), at 0 Play reads "Next life m:ss" and starts nothing (a toast says when), Retry goes home. Saved and sanitized. selfTest forces it on in a scratch copy of meta with a test clock, then checks the shipped default is off and no heart shows.

## 4. Layout measurements

The bar's sizes (selfTest note `powerBar`, the harness at each viewport):

| Viewport | Queue rows | Badge | Bar | Tile height |
|---|---|---|---|---|
| 375×812 | 3 | 58 px | 70 px band | 52 px |
| 400×600 iframe | 2 | 41 px | 46 px band | 38 px |
| 812×375 | 2 | 50 px | fills the column foot (88 px) | 46 px |
| 1280×720 | 3 | 84-108 px (median 108) | fills the column foot | 74 px |

Smallest CSS px per cell, M4 (`9899207`, served from a git archive) against M5, every siege level and Gallery picture:

| Viewport | Siege smallest | Boss (100) | Level 40 | Gallery smallest |
|---|---|---|---|---|
| 375×812 | 10.5 -> **8.5** (L77, coach band) | 10.5 -> 9 | 13 -> 11 | 8 -> 8 (width-limited) |
| 1280×720 | 16 -> 16 | 16 -> 16 | 19 -> 19 | 16 -> 16 |
| 812×375 | 9.5 -> 9.5 | 9.5 -> 9.5 | 11.5 -> 10 | 9 -> 9.5 |
| 400×600 | 8 -> **8** | 8 -> 8 | 9.5 -> 9.5 | 8.5 -> 8.5 |
| 375×667 | 8 -> 8 | 8.5 -> 8 | 10 -> 8 | 8 -> 8 |
| 360×640 | 8.67 -> 8.67 | 9 -> 9 | 11 -> 10.67 | 7.67 -> 7.67 (width-limited, as in M4) |

- **What the bar costs the board at 375×812:** the stage loses 75 px of height (499 -> 424), about 1.5 CSS px a cell on the boss (10.5 -> 9) and 2 on the smallest (10.5 -> 8.5, level 77 with its coach band). Every board stays at 8 or more.
- **Short frames (orchestrator's call, height ≤ 640):** two queue rows and a compact bar (41 px badges, 46 px band) under them, and 6 px kept round the frame instead of 16 (`layout.stageGapPx`). The iframe's boss is back to exactly 8.0 (it was 7.5 with the bar and the old gap).
- **Taller portrait phones (my addition, logged):** above 640 px the queue keeps 3 rows unless that level's board would then be under 8 CSS px a cell; that level shows 2 rows and the compact bar. At 375×812 and 390×844 no board needs it; 414×736: 1 of 160; 375×667: 57 of 160 (without it the boss fell to 6.5 there). The orchestrator's rule is unchanged for the 400×600 iframe.
- **Desktop blank:** the bar fills the side column's foot, sized to it (`layout.pwFit`: a row of four or 2×2, whichever gives the bigger badge, 84-112 px). Across all 160 boards the column not covered by the top bar, the tray and the bar is 1.3-2.0% (the gaps between them) at 1280×720, 1366×768, 1920×1080 and 1024×768, with no overflow (it was about 40% bare brick in M4's foot, per the Critics 1 carry-forward). 812×375: 1.6-2.0%.
- Frame times unchanged: p95 16.7-16.8 ms with three squads out on levels 65, 70 and 100 at 1× and 3×, every viewport.

## 5. Verification

- `node tools/test.js`: **327 passed, 0 failed** (was 272). New: power-ups on hand-made boards with known answers (each one's effect, POWER/REVEAL/FREE events, refusals, limits, the line maximum, the lock, the rest-jam refusal and the mid-show exemption, a face-up card staying face up, dealing mode and game over), identical replays with none used, and an engine-vs-reference differential with random taps and power-ups mixed in (120 games, 2,802 operations: 116 Ladders, 93 Quartermasters, 55 Scouts, 56 Recalls taken, 501 refused; 0 differences in acceptance, status, spaces, columns and counts, hidden cards, clock; canPower agrees with power every time; no rest state without a legal tap; balance at every patient rest state). Meta and save: coins, best, buying, lives with a test clock, old and junk saves.
- `SP.selfTest()`: **1010 pass, 0 fail** at 375×812, 812×375, 1280×720, the 400×600 iframe and the hidden-tab load (was 982). New section 25: home Play to level 1 (new save) and level 41 (mid-campaign) in one tap; progress, coins, no heart; the tabs; the settings sheet (sound, speed; colour-blind is section 16, now through the sheet); the bar's geometry (round, bigger than a tile, hittable, on screen, under the queue, two rows in short frames); buying and the Ladder through its badge; the Ladder's limit; a buy short of coins; Scout through its badge and refused with nothing hidden; Quartermaster asking, cancelled, then a real tile tap; Quartermaster on a "?" tile; Recall through its badge and a real space tap, and refused with nobody waiting; the report (a first win on Hard: +60 counted up, time, taps; again: +20, "New best!", tied taps); a debug level earns nothing; a Gallery picture's report; Era 1's report card; lives forced on (a fail costs one, none left blocks Play with the refill time, one back after 20 minutes), then off.
- `tools/harness.mjs`: **all passed**, 0 console errors or warnings, four viewports plus the hidden tab; new checks: the home's Play label, the settings sheet by real taps, a Ladder bought and used and a Quartermaster bought, asked for and applied by real taps.
- `tools/regrade.js`: 100 levels, 755 checks, **0 differences**; `--gallery`: 60 levels, 480 checks, **0 differences**.
- The functional critic's rule diff (`diff.mjs --patient 6 --rushed 5` and `edge.mjs`): **0 mismatching games** of 3,744, 312/312 stored replays, 0 grade mismatches; quiet vs stepped 0 differing.
- Level files, md5 unchanged:
  - `levels/levels.json` 8c14f6087dc6a4b72fce9057017a8d2a
  - `levels/gallery.json` 65039b783eb6b25fcef2523e7dee963a
  - `levels/debug-v4.json` bf16dce84f16a9dac42c35c1f961eb29
  - `levels/teaching.json` 4d43d838aee040236449a6bf410b562b
- Screens: `tools/shots-v4-m5/` (gitignored), 84 PNGs from `tools/shots-v4-m5.mjs` at 375×812, 1280×720, 812×375 and the 400×600 iframe: home new and mid-campaign, the Gallery tab locked and open, settings, the level with the bar, a buy, the Ladder used, the Quartermaster asking and done, Scout before and after, Recall asking and done, a win report, a fail report, the map's era cards, the Gallery's card, lives on and none left (forced on, debug only). Harness screens in `tools/shots-v4-m5/harness/`.

## 6. Open

- The economy's numbers and the uses per level are a first proposal; the playtest decides.
- Two-row fallback on taller short phones (375×667) changes the queue's depth between levels on that phone; LATER has the alternative.
- A jam is final: power-ups can't rescue a line that has already come to rest jammed (LATER: a "continue" offer would be a rule change).
- m5's banner and bin burst, and the one-time colour-blind offer after a low-ΔE jam, are in LATER.
- 360-wide phones: one painting stays width-limited under 8 px a cell, as in M4.
- Not touched: `tools/critic-v4-1/diff-result.json` shows a changed timing field from re-running the critic's diff; it was already modified when M5 started and is not committed.
