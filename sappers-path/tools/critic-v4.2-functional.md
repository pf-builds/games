# Sapper's Path v4.2: functional critic (full-screen boards, real pace)

**Verdict: PASS. 0 blocking, 0 major, 2 minor.**

No rule changed. The game matches my rules on all 8,364 games. My recompute of the real-pace measure matches the stored value on all 135 levels that have one. Both minors are about how the grade numbers are defined, not about play.

Build: HEAD `35e760f`, branch `sappers-path`, cache tag `?v=26`. Local server on :8492, stopped afterwards. Rules come only from the SPEC text: SPEC-v3, SPEC-v4 §9 through the v4.2 entry, `config.json`, `tools/bake-config.json` for the pace factor, and the format comment in `src/engine.js`.

`SP.selfTest()`: **pass 1017, fail []**, 7.1 s.

## Re-run (from `sappers-path/`)

Rules and pace (about 2.5 min):

```
N=~/.local/opt/node/bin/node; $N tools/critic-v4.1/diff.mjs --patient 4 --rushed 4 --power 8 && $N tools/critic-v4.1/edge.mjs && $N tools/critic-v4.2/pace.mjs --all
```

Browser (needs the server):

```
nohup python3 ~/Documents/Claude/.claude/serve.py 8492 /Users/peter/Documents/Claude/business/D-click-it-studios/repos/games-sappers-path > /dev/null 2>&1 &
PLAYWRIGHT_MODULE=$(~/.local/opt/node/bin/npm root -g)/playwright/index.mjs $N tools/critic-v4.2/play.mjs; lsof -ti tcp:8492 | xargs kill
```

New this pass, in `tools/critic-v4.2/`:
- `pace.mjs`: the real pace recomputed from the SPEC text with my rules.
- `play.mjs`: the browser pass.

The rules and the diff are unchanged from `tools/critic-v4.1/`.

## The SPEC text: did any rule change?

No.
- The v4.2 entry changes sizes, the dealer (cards of 90-99, `deal.best`), a new grade measure, and the page (`maxRunners` 640).
- It says outright that walk and swarm timing are unchanged and that no engine limit changed.
- My v4.1 implementation ran on the v4.2 levels unmodified, with 0 mismatches.

Three things a re-implementer needs that the v4.2 entry adds or leaves open:
- **The board limit is `MAXCELLS` 4096.** This is the first time the SPEC states an engine limit on board size. 42 × 41 = 1,722 fits.
- **The real pace's "engine time" isn't defined** (minor R1 below).
- **The rounding of `pace.ms` isn't stated** (also R1).

## Part 1: diff against the game

164 levels × Easy, Normal and Hard = **8,364 games, 0 mismatches**. That breaks down as:
- 492 stored orders
- 1,968 patient games
- 1,968 rushed games
- 3,936 games mixing taps and power-ups

Each game compares the full event log (in its exact same-instant order), the status, the fail reason, `jamWhy`, refusals and `hidden()`.

| Check | Result |
|---|---|
| Stored orders | 492 / 492 win; 480 grades match (`len`, `peak`, `ms`) |
| Power-ups | 12,780 taken; 69,200 refused, every refusal leaving the save, hash and use counts unchanged; `canPower` = `power` on every call; 15,712 calls after the game ended all returned no-play |
| Outcomes | 4,307 won, 3,726 jam, 312 short; 346 games opened the lock |
| Unfinished games | 19 games (rushed or with power-ups, on the long v4.2 boards) hit my per-game action cap while still playing. Both sides agreed up to the cap. |
| Picture format | 0 of 164 levels break it |
| Hidden checks | 7,013,858, 0 differences |
| Edge cases (`critic-v4.1/edge.mjs`) | All 3 known-answer bottom-entry boards (SPEC example, ties, moat and drawbridge) and all 5 power-up cases still agree |
| Park limits along stored orders | 84 rest states over the limits. The v4.1 fix pass says these limits bind only the dealer's own line, so this is not a finding. |

**Board sizes** (from the level files):
- Siege 26-100: 69 at 42 × 41, the teaching levels 26/35/51/62/76 at 38 × 37, and 77 at 34 × 33. That accounts for all 75.
- The Gallery fits inside 42 × 41.
- The largest card is 99 sappers; the most taps is 55.

## Real pace, recomputed from the SPEC text (`pace.mjs`)

My reading of the v4.2 text:
1. Replay the stored Normal order with my rules.
2. At each instant, after that instant's events, dispatch and checks, tap the next card in the order while its tap is legal (its column's front, and enough free spaces).
3. Otherwise run to the next event.
4. Raw = the engine time when everything is quiet after the last tap, with every squad home.
5. ms = round(raw × 1.77).

**The 10 levels asked for: 10/10 identical**, both `raw` and `ms`:

| Level | Stored raw / ms | Mine |
|---|---|---|
| e2-26 (teaching) | 94,500 / 167,265 | same |
| e2-31 | 106,820 / 189,071 | same |
| e2-40 | 110,290 / 195,213 | same |
| e3-51 (teaching) | 99,200 / 175,584 | same |
| e3-62 (teaching) | 101,170 / 179,071 | same |
| e4-76 (teaching) | 126,990 / 224,772 | same |
| e4-77 (teaching) | 75,970 / 134,467 | same |
| e4-88 | 137,940 / 244,154 | same |
| e4-100 (boss) | 136,310 / 241,269 | same |
| g-tw-1f355 | 113,580 / 201,037 | same |

**All levels with a pace grade: 135/135 identical.** Levels 1-25 carry no pace grade, as the SPEC says. Every non-teaching level is inside its v4.2 target: 180-300 s, the boss 180-420 s, the Gallery 150-300 s.

### Findings

**MINOR R1: the SPEC doesn't say when the real-pace clock stops, or how it rounds.**
- **SPEC text:** "The result is that engine time × duration.pace.factor".
- **What the game does:** "engine time" is when the replay goes quiet with every squad home, the same convention as `grade.ms`. `pace.ms` is that × 1.77, rounded to the nearest ms.
- **Why it matters:** reading it as the winning pop gives a raw 2.5-4.5 s lower on every level. On e2-31 that's 102,300 against 106,820 stored. The two readings never agree.
- **Fix:** one clause, "engine time when the replay is quiet after the last tap (every squad home), times 1.77, rounded to the nearest ms".
- **Repro:** `node tools/critic-v4.2/pace.mjs` prints both numbers for each level.

**MINOR R2: one stored `grade.normal.maxWait` doesn't match its own line.**
- **Which:** g-ours-g15 stores 14,770 ms.
- **What I measure:** the longest patient tap on its stored Normal line is 14,670 ms, from tap 20 at 205,290 ms to the moment the engine goes quiet. The last block pops at +10,410, the last space frees at +14,670, no archer hits.
- **The other 159** pictures and levels with a `maxWait` match the same measure exactly.
- **Two possible causes:**
  - the metric isn't "tap to quiet" (the SPEC never defines it beyond "keeps the siege moving"), or
  - the value was computed on a slightly different line than the one stored.
- **Impact:** none on play; it's under the 15 s cap either way.
- **Repro:** `diff.mjs`, line "grade.maxWait vs my longest patient tap".

## Part 2: browser (375×812 touch at 4× CPU throttle, and the 400×600 iframe)

All with real taps.

| Level | Win | Loss | Refused tap | Ladder | Busiest moment (all 5 fronts rushed) |
|---|---|---|---|---|---|
| e2-27, moat castle 42×41 | "Fort razed!" | jam: "Night sky can't reach a block." | 1 refused, plays 5 stay 5 | open 5 → 6, spent | 375 at 4×: peak 61 runners, rAF p95 16.8, max 16.8 ms, 0 frames over 33 ms, 0 long tasks, draw max 0.7 ms |
| e4-100, boss 42×41 | "Fort razed!" | n/a | 1 refused, plays 4 stay 4 | 4 → 5 | 375 at 4×: peak 57 runners, p95 16.7, max 16.8, 0 long tasks, draw max 0.8 ms |
| g-tw-1f98a, Gallery 41×37 | "Picture complete!" | n/a | 1 refused, plays 5 stay 5 | 5 → 6 | 375 at 4×: peak 79 runners, p95 16.7, max 16.8, 0 long tasks |

- The iframe gives the same results on all three levels: p95 16.7, max 16.8, 0 long tasks, draw max 0.2 ms.
- **Zero console errors or warnings.**
- Cells: 8 CSS px at 375×812; 7-8 in the iframe. The SPEC puts the iframe at 7.5 and sets its floor at 6.
- My rush reached 57-79 runners. The bake reports 126-139 at the boss's busiest moment; I didn't reproduce that peak, but nothing came near a dropped frame even at 4× throttle.
- Screenshots: `tools/shots-v4.2-critic/functional/` (the boss mid-rush at both sizes).

### Findings, Part 2
None.
