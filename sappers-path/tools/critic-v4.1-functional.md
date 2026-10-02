# Sapper's Path v4.1: functional critic (castle pictures, bottom entry)

**Verdict: PASS. 0 blocking, 0 major, 1 minor.**

The game matches my rules on all 8,364 games across all 164 levels. Event order now matches exactly within each instant, with nothing sorted before comparing.

Build: HEAD `f933ab6`, branch `sappers-path`, cache tag `?v=24`. Local server on :8492, stopped afterwards. Rules come only from the SPEC text: SPEC-v3, SPEC-v4 §9 including the Critics 2 fix entry and the v4.1 entry, `config.json`, and the format comment in `src/engine.js`.

`SP.selfTest()`: **pass 1017, fail []**, 3.5 s.

## Re-run (from `sappers-path/`)

Part 1 (about 20 s):

```
N=~/.local/opt/node/bin/node; $N tools/critic-v4.1/diff.mjs --patient 4 --rushed 4 --power 8 && $N tools/critic-v4.1/edge.mjs
```

Part 2 (needs the server):

```
nohup python3 ~/Documents/Claude/.claude/serve.py 8492 /Users/peter/Documents/Claude/business/D-click-it-studios/repos/games-sappers-path > /dev/null 2>&1 &
PLAYWRIGHT_MODULE=$(~/.local/opt/node/bin/npm root -g)/playwright/index.mjs $N tools/critic-v4.1/play.mjs; lsof -ti tcp:8492 | xargs kill
```

What's in `tools/critic-v4.1/` (built from `critic-v4-2/`):
- `rules.mjs`: ring levels now throw. Taps, pops and power-ups log events in the Critics 2 fix order. There's a picture-format checker.
- `diff.mjs`: event order compared exactly, with tower and gate events added. Also a format check on every level, the dealer's park limits along each stored order, and `grade.maxWait`.
- `edge.mjs`: the three known-answer boards, plus the five power-up edge cases from Critics 2.
- `play.mjs`: the browser pass.

## What changed in my rules for v4.1

- Ring entry is gone.
- No new movement rule, as the SPEC says: the entry square is the camp, and the camp row is the bottom row. My Siege rules handled picture boards without any change.
- I implemented the same-instant event order from the Critics 2 fix entry (the S1 finding from my last report). Within each instant:
  - **Tap:** reveal the tapped column's new front, then the hidden partner, then the partner column's new front.
  - **Block pop:** EAT, then TOWER, then UNLOCK, then GATE.
  - **Quartermaster and Scout:** REVEAL before POWER.
  - **Recall:** POWER, then FREE.

## Part 1: diff against the game

164 levels (100 Siege, 4 debug, 60 Gallery) × Easy, Normal, Hard = **8,364 games, 0 mismatches**. Each game compares, in exact log order and with times:
- block pops, frees, reveals, power-ups, unlocks, kills, gates and towers
- the status, fail reason and `jamWhy`
- which taps and power-ups are refused
- `hidden()` for every card after every action (2,464,157 checks)

| Check | Result |
|---|---|
| Stored orders win | 492 / 492 |
| Grades (`len`, `peak`, `ms`) | 480 checked, 0 mismatches |
| `grade.maxWait` against my longest patient tap on the stored Normal line | 160 checked, 0 differ |
| Games by kind | stored 492, patient 1,968, rushed 1,968, patient + power-ups 1,968, rushed + power-ups 1,968 |
| Power-ups | 9,489 taken; 33,150 refused, every refusal leaving the save, hash and use counts unchanged; `canPower` = `power` on every call; 15,744 calls after the game ended all returned no-play |
| Outcomes | 4,305 won, 3,874 jam (`jamWhy` 0/1/2/3 = 3,456/3/412/3), 185 short; 268 games opened the lock |
| Picture format | **0 of 164** levels break it. Frame is open ground; the entry square is 3 cells on odd widths and 2 on even; water only on the side columns; no camp anywhere else; `pic: true`; no `ring` |

**Known-answer boards (`edge.mjs`).** Expected pops were worked out by hand; the reasoning is in the file's comments. Both sides match every pop and its time exactly.

- **K1, the SPEC's own example.** 7 × 5, picture `aaaaa/abbba/aaaaa`, squad of 12.
  - Expected pops: (2,3) at 380 ms, (3,3) 410, (4,3) 440, (1,3) 550, (5,3) 580, (1,2) 850, (5,2) 880, (1,1) 990, (5,1) 1020, (2,1) 1290, (4,1) 1320, (3,1) 1430.
- **K2, ties.** 6 × 5, even width (entry x 2-3), picture `aaaa/aaaa/a..a`; the inner grass joins the camp.
  - (4,3) at distance 1 goes before (2,2) at distance 1, despite its higher x: its smaller distance to the bottom row wins.
  - Left goes before right at every equal distance, and the top row comes last.
  - Expected pops: (1,3) at 460 ms, (4,3) 490, (2,2) 520, (3,2) 550, (1,2) 820, (4,2) 850, (1,1) 960, (4,1) 990, (2,1) 1260, (3,1) 1290.
- **K3, moat and drawbridge.** 7 × 7. The b blocks sit beyond a water band that also cuts the frame; the iron bridge's key is at (5,4) on the near side.
  - With the bridge closed, the b squad waits and nothing of it pops.
  - The key pops at 700 ms, the bridge opens, and b goes at once: (3,1) at 1400, (2,1) 1510, (4,1) 1540, (1,1) 1650, (5,1) 1680.
- **The five power-up cases from Critics 2** still agree, now including the Recall/wary case with the sapper-id labels left out (the fix pass says the ids are only labels).

### Findings, Part 1

**MINOR P1: three shipped levels break the dealer's park limits along their stored winning orders, and the SPEC doesn't say whether the limits apply there.**
- **The limits:** SPEC-v4's v4.1 entry says no squad may wait at rest with more than `parkMax` (6) sappers, and at most 2 squads wait at rest. The M3 entry adds that none may wait while an archer tower stands.
- **Where they don't hold:**
  - g-tw-1f43c: 2 squads wait, one of them with 7 sappers (over 6), at rest before taps 14-17.
  - g-met-436530: 3 squads wait (over 2) before taps 12-13.
  - e4-94: a squad of 1 waits while a tower stands, before tap 6.
  - All three happen on Easy, Normal and Hard, because the stored order is the same string on all three.
- **Two more hits I treated as exempt:** e1-03 (the teaching level about squads bigger than what's open) and v4-locked (a debug copy with re-solved orders).
- **Repro:** `diff.mjs`, line "park limits along stored orders". Details are in `tools/critic-v4.1/diff-result.json` under `park`.
- **Impact:** none on play or on fairness. Every level wins and matches its grade, and the longest wait is the stored `maxWait` (under 15 s).
- **Fix:** either say the limits bind only the dealer's own line (not the tuner's output or the stored order), or check them on the stored order in the bake.

---

## Part 2: browser (375×812 touch and the 400×600 iframe)

Three levels at each size, all with real taps: e2-26 (a moat with a drawbridge), e3-52 (towers and a gate) and g-tw-1f355 (a Gallery picture).

| Level | Win | Loss (jam order from my rules) | Refused tap | Power-ups via the badges |
|---|---|---|---|---|
| e2-26 (moat) | "Fort razed!" | jam: "Black, Timber, Earth and 1 more…" | 1 refused, plays 5 stay 5, "No space…" | Ladder 5 → 6 open; Quartermaster "12 7 9" → "7 12 9"; both spent |
| e3-52 (towers) | "Fort razed!" | jam: "Ashlar, Stone and Black…" | same | Ladder 5 → 6; Quartermaster "18 5 4 ?" → "5 18 4 ?" |
| g-tw-1f355 | "Picture complete!" | jam: "Red and Yellow…" | same | Ladder 5 → 6; Quartermaster "27 48 48" → "48 27 48" |

- All 6 runs pass, and there were **zero console errors or warnings**.
- Smallest cell size: 14-15 CSS px on the phone, 12-13 in the iframe.
- selfTest checks that every runner starts on its crate and enters through an entry cell, and it passes.

Screenshots: `tools/shots-v4.1-critic/functional/` (2, the moat level won at each size).

### Findings, Part 2
None.
