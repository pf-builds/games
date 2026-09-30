# Sapper's Path v4, Critics 1: functional critic (M1 look, M2 rules, M3 Siege to 100)

**Verdict: PASS. Counts: 0 blocking, 2 major, 4 minor.** The game matches my independent rules on all 3,744 games. The two majors are gaps in the SPEC text, not bugs in the code: read literally, the text gives a different game.

Build: worktree `games-sappers-path`, branch `sappers-path`, HEAD `6bbd6e5`. Local server on :8492, headless Chromium (Playwright), Node v24.

## Re-run (one command, from `sappers-path/`)

```
N=~/.local/opt/node/bin/node; $N tools/critic-v4-1/diff.mjs --patient 6 --rushed 5 && $N tools/critic-v4-1/edge.mjs
```

That covers Part 1 and takes about 4 s. For Part 2, also start the server and run the browser scripts:

```
nohup python3 ~/Documents/Claude/.claude/serve.py 8492 /Users/peter/Documents/Claude/business/D-click-it-studios/repos/games-sappers-path > /dev/null 2>&1 &
export PLAYWRIGHT_MODULE=$(~/.local/opt/node/bin/npm root -g)/playwright/index.mjs
$N tools/critic-v4-1/play.mjs && $N tools/critic-v4-1/play2.mjs && $N tools/critic-v4-1/nodebug.mjs; lsof -ti tcp:8492 | xargs kill
```

Files in `tools/critic-v4-1/`:
- `rules.mjs`: my rules implementation. I wrote it only from SPEC-v3 §1-§9, SPEC-v4 §9, `config.json` `v3.{time,rules,twists}` and the header comment of `src/engine.js`.
- `diff.mjs`: the level diff. `--waryAt hit|disp`, `--backWalk ...` and `--discLT` switch between the ambiguous readings.
- `edge.mjs`: hand-made boards.
- `dbg.mjs`: event trace for one game.
- `play.mjs`, `play2.mjs`, `nodebug.mjs`: the browser checklist.

Results are written to `diff-result.json`, `play-result.json` and `play2-result.json`. Screenshots are in `tools/shots-v4-critic1/functional/` (10).

`SP.selfTest()`: **pass 761, fail []**, in about 2.2 s. It was run on a fresh page and again after the whole phone checklist.

---

## Part 1: rules re-implemented from the SPEC text and diffed against the game

The game's engine was treated as a black box. I used only its exports (`compile`, `sim`, `rulesOf`, and the sim's `play`, `advanceTo`, `nextAt`, `quiet`, `ev`, `hidden`, `status`, `reason`, `jamWhy`, `peak`, `plays`, `now`) and stepped it event by event with `advanceTo(nextAt)` so every pop gets its time. I did not read the rest of `src/engine.js`, `tools/ref.js`, `grade.js`, `gen.js` or the tests.

**Scope:** 104 levels (100 in `levels.json` plus 4 in `debug-v4.json`), each on Easy, Normal and Hard: **3,744 games**.

| Check | Games | Mismatches |
|---|---|---|
| Stored winning order `win[d]`, played patiently: status, every pop's cell and time | 312 | 0 (all 312 win on both sides) |
| Stored `grade` numbers (`len` = taps = plays, `peak`, `ms`) | 300 (debug levels have no grade) | 0 (with `ms` read as all-home time, minor m2) |
| Random legal patient play (6 seeds per level and difficulty) | 1,872 | 0 |
| Rushed play (tap at random 0-1.5 s gaps, refused taps included) | 1,560 | 0 |
| `hidden()` for every card after every patient tap | 638,282 checks, 2,612 hidden | 0 |
| Engine `quiet()` against stepping by `nextAt` (final hash, status, time) | 312 | 0 |

Every compare looks at status, fail reason, `jamWhy` on jams, the full pop order with times, and whether each tap is refused.

**Coverage from my side, which equals the game's where both agree:**
- 596 games with archer hits and 193 with Hard kills
- 163 games where the lock opened
- 428 linked taps
- 24,830 refused taps, 1,108 of them linked
- jams with `jamWhy` 0 (1,567), 1 (5) and 2 (312)
- outcomes: patient 731 won / 1,039 jam / 102 short; rushed 624 won / 845 jam / 91 short

**Hand-made boards (`edge.mjs`):**
- Stuck (tray empty, a colour walled off): both sides say `stuck`.
- `jamWhy` 3 (a linked front with one free space and the lock still shut, on Hard): both sides say `jam`, `jamWhy` 3.
- A hidden partner pulled from behind a front: both sides agree.
- Stuck never happened in the 3,744 shipped-level games. The deals are exact, so on shipped content only the hand-made board reaches it.

**The readings the SPEC leaves open.** I ran each alternative reading over the full set to prove the diff can tell them apart:

| Reading | Mismatching games of 3,744 |
|---|---|
| Wary at the send (game) / at the hit (literal text) | 0 / **558** (4 stored-order grades wrong) |
| Walk back after a hit: `knockMs + yardMs + ceil(tiles/2)·tileMs` (game) | 0 |
| Same with `carryMs` in place of `tileMs` / without `yardMs` / carry pace without yard | **467 / 471 / 469** |
| Covered when `dx²+dy² ≤ r²` (game) / `< r²` | 0 / **36** |

### Findings, Part 1

**MAJOR 1: the SPEC doesn't say when a squad turns wary, and the literal reading is wrong.**
- **SPEC text:** SPEC-v3 §9 (playtest 1) says a sapper "sent at a covered pixel is hit halfway out; the pixel is never claimed, and its squad turns wary". The engine header says the same.
- **Why the literal reading fails:** it reads as wary at the hit. But the pixel is never claimed and the stagger is 30 ms, while the hit lands 200+ ms later. Under that reading, every sapper sent before the hit goes for the same covered pixel.
- **What the game does:** the squad turns wary at the send, so only one sapper is ever hit per squad.
- **Repro:** `node tools/critic-v4-1/diff.mjs --only e3-51 --patient 2 --rushed 0 --waryAt hit`. On e3-51 Easy with patient taps `104213`, pop #0 is cell 224 at 1,140 ms under the hit reading and 810 ms in the game.
- **Size:** 558 of 3,744 games diverge, including the stored grades of 4 level/difficulty pairs.
- **Fix:** one sentence in SPEC-v4 §9: "the squad turns wary the moment that sapper is sent".

**MAJOR 2: the walk back after an archer hit (Easy and Normal) is not defined.**
- **SPEC text:** the engine header says "home after knockMs and the walk". The `v3.time` note says "back knockMs plus the walk later". Neither says which pace or whether the yard counts.
- **What the game does:** `hit + knockMs + yardMs + ceil(tiles/2)·tileMs`. That is the outbound half-walk mirrored, at walking pace, not carry pace.
- **Repro:** `diff.mjs --only e3-51 --backWalk yardCarry` (or `tile`, or `carry`). On e3-51 Easy with taps `104213`, pop #12 is cell 129 at 2,600 ms in the game, against 2,620 / 2,400 / 2,420 under the other readings.
- **Size:** 467-471 games diverge for each of the three other readings.
- **Fix:** write the formula into SPEC-v4 §9.

**MINOR m1: the range disc's boundary is not stated.**
- **SPEC text:** "a disc of radius r around the group's centroid".
- **What the game does:** a cell is covered at `dx²+dy² ≤ r²` (inclusive), where the centroid is the mean of the tower group's cell (x, y) at load.
- **Size:** the strict reading (`<`) changes 36 games, on towers with whole-number radius such as r = 4 on level 100.
- **Fix:** say "within r (inclusive), centroid of the group's cell coordinates".

**MINOR m2: `grade.ms` is not defined.**
- **What the game does:** the stored `ms` is the time the last squad is home after the winning pop, not the winning pop. On e1-01 that is 22,200 ms against a last pop at 19,480.
- **SPEC text:** SPEC-v3 §9 ("patient play-through at 1×") doesn't say which end it means. This only affects the duration metric and the time targets.

**MINOR m3: short's sapper count is not defined.**
- **SPEC text:** "a colour left with fewer sappers than pixels" doesn't say which sappers count. My reading is tray cards, plus sappers waiting, plus sappers on their way to a claimed pixel.
- **Impact:** none you can see on shipped levels. The deals are exact, so any kill is short under every reading, and it matched on all 193 kill games. Worth a clause for the 2,000-level road.

---

## Part 2: browser checklist

Viewports: 375×812 (touch), 1280×720, 812×375 (touch), and a 400×600 iframe via `tools/iframe-host.html`.

| Item | Result | Evidence |
|---|---|---|
| Zero console errors or warnings | **PASS** | 0 across every run: full win, full loss, Retry, Next, all viewports, public page. |
| Start, play, win, Next level without reload | **PASS** | Level 1 won with real taps. Sheet: "Fort razed! / The goblin king flees. Level 1 won on Normal." Next loads e1-02; a window marker survives, so no reload. |
| Loss, Retry | **PASS** | e2-46 with order `0043222123104`, real taps. Sheet: "Line jammed: Miners, Masons, Sawyers and 1 more can't reach a block." Retry gives plays 0, panel null. |
| Title to gameplay in fewest taps | **PASS** | 1 tap (title Play) goes to e1-01, 165 ms to the level screen. |
| Map shows 4 eras / 100 levels | **PASS** | Public page (no debug): 4 eras (Palisade stockade, Motte and bailey, Stone keep, Concentric castle), 100 nodes, no debug row, no `SP`. |
| Progress unlocks in order; save survives reload; map Play | **PASS** | Fresh: level 1 open. After the win and a reload: 1/100, level 2 open. Map Play goes to e1-02. |
| Old v3-style save | **PASS** | Test save: `{done: e1..e3-75 on Normal, e4-90 on all three, bogus id, settings {fast:true, diff:"hard"}, last:"e3-75"}`. Loads as 75/100, 76 open, e4-90 and the bogus id dropped, speed 2, Hard. Map Play goes to e4-76. A garbage save loads to the title. |
| Mystery "?" until the front; nothing in the DOM leaks the colour | **PASS** | Checked on v4-mystery, e2-35, e4-100 and v4-all, colour-blind off and on. On every `.mys` tile, the outerHTML and the computed colours of the tile, its children and ::before/::after have no material hex, crew or material name, and no glyph data-URL (`--mc` neutral `#3d3747`, `--gl: none`, `aria-hidden`). Screenshot: `phone-mystery-cb.png`. |
| Mystery reveal | **PASS** | Tap col 0 on v4-mystery: hidden count 11 goes to 10. The new front is `tile card`, "Axemen, 12 sappers", `--mc #e40932`, no "?". |
| Linked tap: both out, partner's column closes up | **PASS** | v4-linked, link `[[0,1],[1,0]]`, tap col 1. Line: Torchbearers 3, then Axemen 21. Col 0 goes from "4 21 10" to "4 10 11". |
| Linked tap with 1 free space refused, nothing changes | **PASS** | free 1, tap the linked col 0: plays 4 stay 4, line and fronts unchanged, refused count +1, toast "Linked squads need 2 free spaces". |
| Linked jam sheet | **PASS** | Fixture `linkJamLevel`, taps 0, 1, 2, 3: "Line jammed: linked squads need 2 free spaces, and Axemen, Torchbearers, Sawyers and 1 more can't reach a block." Screenshot: `phone-linked-jam.png`. |
| Locked space opens when its key pops | **PASS** | Level 76 Normal: open 4 + locked 1 at the start. Unlocks after tap 7, the dashed `slot locked` goes away, the level is won. |
| Gates and keys | **PASS** | e2-26 stored order wins in the page. The key and gate are also covered by the engine diff above. |
| Archers on Easy, Normal and Hard | **PASS** | e3-52 order `00432`, real taps. Easy: 3 hits, 0 kills. Normal: 3 hits, 0 kills. Hard: 1 kill, failed short with "Archers cut down the Masons: too few left to finish." |
| Refused tap (no free space) | **PASS** | e2-46 after `SP.fill()` (line full): the tap is refused (+1), plays and fronts unchanged. Toast "No space: wait for a squad to come home", head "Line full: wait for a squad to come home". |
| Near-jam warning | **PASS** | `SP.stage(4,3,1)` on e1-05: "One space left", "3 stuck · 1 working · 1 free", the last slot pulses (`.slot.last`). Screenshot: `phone-near-jam.png`. |
| Stuck | not reachable in shipped content | 0 of 3,744 games. Both sides agree on a hand-made board (`edge.mjs`). |
| Short on Hard | **PASS** | See archers. |
| Victory march | **PASS** at 1×; minor m4 at 3× | 1×: march true, pace 1.5, head "Victory march ×1.5". |
| Speed 1×/2×/3× | **PASS** | Cycles 1, 2, 3, 1. aria-label "Speed 2x (tap for 3x)" and so on. |
| Colour-blind toggle | **PASS** | Map toggle sets `cb` true, glyphs show on the front tiles, no leak on hidden tiles (above). |
| Pause on blur / hidden tab | **PASS** | Blur: engine time frozen (416 stays 416 over 600 ms), Paused sheet shown. Tapping it resumes without playing a card (plays 1 stays 1). Hidden tab (`visibilitychange`): frozen (516 stays 516), `SP.paused()` true. |
| Tap-to-skip | **PASS** | Level 1: after each card, a board tap takes the state from busy to idle at once (6/6). |
| Teaching levels 1, 2, 3, 26, 35, 51, 62, 76, 77 | **PASS** | 3 random legal orders each, real taps. Every run ends (won or jam), no run hangs, and the hand is always on a live target. Coach trails, for example: 2 `0,1,2,-1`; 76 `0,1,2,-1` and `0,1,-1`; 77 `0,1,-1` and `0,2,-1`. Steps with an `if` condition are skipped when it never happens, which is by design (`config.teach`). |
| Busiest moment | **PASS** | e1-11 Easy (the biggest fronts in the file, 210 sappers), all 5 fronts rushed at 4× CPU throttle: peak 96 sappers out and drawn. rAF p50 16.7, p95 16.7, max 16.8 ms, 0 frames over 33 ms, 0 long tasks. Unthrottled: p95 16.8, max 16.8. Level 100 rush: max 16.8 ms. Screenshots: `phone-busiest-e1-11.png`, `phone-l100-swarm.png`. Headless rAF is only a proxy; the zero long tasks under 4× throttle is the stronger evidence. |
| Payload and load time | **PASS** | 12 files, 591 KB uncompressed (the local server doesn't gzip). Biggest: levels.json 172 KB, main.js 106 KB, fonts 78 KB. Title ready 41 ms, DOMContentLoaded 9 ms, level screen 165 ms after Play. |
| Viewport 375×812 | **PASS** | Levels 1, 62, 77 and 100: no horizontal or vertical overflow. Map, retry, speed and mute buttons and all 5 front tiles pass `elementFromPoint`. Sheet Next and Retry are hit-testable; Next goes to e1-02. Level 100 at 10.5 CSS px a cell. |
| Viewport 1280×720 | **PASS** | Same checks. Level 100 at 16 px a cell. |
| Viewport 812×375 | **PASS** | Same checks. Level 100 at 9.5 px a cell, turned. |
| 400×600 iframe | **PASS** | Same checks. Levels 77 and 100 at 8 px a cell, which is the SPEC floor. |
| `SP.selfTest()` | **PASS** | 761 pass, 0 fail. |

### Findings, Part 2

**MINOR m4: at 3× the victory march label shows the wrong speed.**
- **What happens:** at speed 3× the march runs at pace 3, but the line head still reads "Victory march ×1.5".
- **Cause:** `main.js:248` fills the label from `show.victoryPace`, not from the pace in use.
- **Repro:** set speed to 3×, load level 1, play the stored order, and tap the last card. `SP.state()` shows `{march: true, pace: 3}` and `#line-lab` reads "Victory march ×1.5".
- **Rule:** SPEC-v4 M1 says the march plays at the faster of the speed button and `victoryPace`, so the label should show the pace actually used.

### Note (outside the checklist, not counted)
Teaching levels 76 and 77 lose often under random play on Normal. The stored `grade.normal.rate` is 0.585 for 76 and 0.30 for 77, and 2 of my 3 random coach runs on 77 ended in a jam. Teaching levels are exempt from the bands, so this is Peter's call at playtest.
