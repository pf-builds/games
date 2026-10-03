# Sapper's Path v4.3: functional critic (new freeing, linked-at-front, tags, saves v2)

**Verdict: PASS. 0 blocking, 0 major, 1 minor.**

I rewrote my rules for both rule changes, working only from the v4.3 text. They match the game on every game and every known-answer board.

Build: HEAD `08fbc65`, branch `sappers-path`, cache tag `?v=28`. Local server on :8492, stopped afterwards. Rules come only from the SPEC text: SPEC-v3, SPEC-v4 §9 through the v4.3 entry, `config.json`, and the tag and pace numbers in `tools/bake-config.json` and `tools/gallery-config.json`. I didn't read engine, ref, grade or gen.

`SP.selfTest()`: **pass 502, fail []**.

## Re-run

```
./tools/critic-v4.3/run.sh             # rules diff + known answers + real pace, about 1.5 min
./tools/critic-v4.3/run.sh --browser   # adds the browser pass (own server on 8492, stopped after)
```

Run it from `sappers-path/`.

## My rules, updated from the v4.3 text (`tools/critic-v4.3/rules.mjs`)

**When a space frees:**
- A squad's sapper stops belonging to its space when its block pops. The carrier's walk home touches no space.
- A Hard kill leaves the squad at once.
- A hit sapper walking back still holds the space, and on arrival it waits again.
- The space frees at that instant once the squad has nobody waiting, walking out or walking back.
- A linked pair holds both spaces until both squads are done, then frees the earlier-placed first.
- Log order: `EAT`, `TOWER`, `UNLOCK`, `GATE`, then `FREE`; and `KILL`, then `FREE`.
- Rest still waits for every sapper home.

**Linked taps:**
- Legal only when the partner is its own column's front.
- Refusal reasons per column (`why`): 3 (partner buried) is checked before 2 (not enough spaces) and 1.
- `jamWhy` gains bit 4.

**Quartermaster:** the jam test is judged on the columns after the pull. The card it passed is no longer a front, so a linked card waiting on that one now waits too.

**Recall:** "none out" now means none walking out or back; carriers don't count.

## Part 1: diff against the game, every level on its own tag

164 levels (100 Siege, 4 debug, 60 Gallery), each on its tag only. **5,412 games, 0 mismatches.** That's:
- 164 stored orders
- 1,312 patient games
- 1,312 rushed games
- 2,624 games mixing taps and power-ups

Each game compares the full event log in exact same-instant order, the status, the fail reason, `jamWhy`, refusals and `hidden()` (5,555,533 checks).

| Check | Result |
|---|---|
| Stored orders | 164/164 win on their tag; no tap in any stored order is refused |
| Grades on the tag | 160 checked (`len`, `peak`, `ms`), 0 mismatches. `maxWait` matches on all 160 (measured to everyone home, the winning tap included) |
| Power-ups | 9,098 taken; 47,321 refused, every refusal leaving the save, hash and use counts unchanged; `canPower` = `power` on every call; 10,488 calls after the game ended all returned no-play |
| Outcomes | 2,704 won, 2,547 jam, 157 short; 242 games opened the lock |
| Jam reasons | `jamWhy` 0: 2,231, 1: 5, 2: 187, **4: 101, 6: 23** (the new buried-partner bit, in play) |
| Unfinished games | 4 long rushed or power-up games hit my per-game action cap while still playing; both sides agreed up to the cap |
| Tags | the SPEC's `tagOf` formula with the configs' numbers matches every level's tag: Siege 16 Easy / 60 Normal / 24 Hard, Gallery 8 / 38 / 14. `win` and `grade` are keyed by the tag only; debug levels are Normal |
| Cross-buried pairs at deal | 0 (the dealer's claim holds) |
| Picture format | 0 problems |
| Does the diff test the new freeing? | Yes. v4.1's rules (free when everyone is home) on the 4 debug levels: 51 of 52 games mismatch, the first difference always a `FREE` time. Example: v4-mystery space 2 frees at 24,300 (its last pop), not 27,560 (home) |

## Known-answer boards (`edge.mjs`): 10 of 10 correct on both sides

Expected events were worked out by hand from the SPEC text; the arithmetic is beside each board in the file.

| Board | Expected and found |
|---|---|
| K4, Normal, a squad of 3 next to the entry | Pops at 380/410/440, **FREE at 440** (the last pop, not 730 when the carriers are home). Rest at 730. |
| K4b, Hard, line full (3 squads stuck beyond a moat with no bridge, plus a squad of 3) | A tap at 439 is **refused**. At 440, the instant the last pop frees the space, the same tap is **taken**. |
| K5, Normal, an archer hit | Squad of 3: pops at 460 and 490. The third sapper is hit at 420 and back at 1080; no `FREE` at either. Tower squad: tower pops at 1700 (`TOWER`, its space 1 frees). The waiting sapper goes at once: pop at 2240, `FREE` space 0 at 2240, won. |
| K6, Hard kill | A squad of 1 aimed at a covered block: `KILL` at 360, then `FREE` space 0 at 360, then short. |
| K7, buried partner | Tapping A, whose partner is behind B, is refused (`why` 3) and changes nothing. Tapping B is taken. Tapping A again sends the pair. Won. |
| K8, cross-buried deadlock | Both linked fronts are refused (`why` 3,3). After the one unlinked card is spent: **jam, `jamWhy` 5** (a space free + buried partner). |
| K9, Quartermaster jam test | At rest, pulling Z is refused: F1 would stop being a front, so F0 waits, and Z's partner is buried. F0's pair is then tappable; the second pull is refused too. |
| K1-K3 (v4.1's bottom-entry answers) with v4.3's `FREE` | Every pop as before. `FREE` now at each squad's last pop: 1430, 1290, the key squad at 700 right after `GATE`, then 1680. |

## Real pace (`pace.mjs`)

My replay, on each level's tag:
1. Tap each next card the moment it's legal (the new linked rule included).
2. Raw = everyone home after the last tap.
3. ms = round(raw × 1.77).

**160/160 identical to `grade[tag].pace`** (raw and ms).

`grade[tag].thinks`: **160/160 identical**. I read it as "after each tap, the next tap waits at least 1, 2 or 4 s, then goes the moment it's legal". That includes the two levels that aren't all 1s: one stored [1,0,1] and one [0,0,1].

## Findings

**MINOR T1: the SPEC doesn't define `thinks` exactly.**
- **SPEC text:** "reports the replay with 1, 2 and 4 s of thinking after each tap".
- **What it leaves open:**
  - when the thinking starts: at the tap, or when the next tap becomes legal
  - whether the next tap then goes the moment it's legal, or at the end of the think
- My reading (from the tap; then the moment it's legal) reproduces all 160, including the non-monotonic [1,0,1]. A different reading could give different rows.
- **Impact:** grade-only, a report field. Nothing gates on it except the bake log.
- **Fix:** one sentence.

Not findings:
- **The v4.3 freeing and linked rules are written exactly enough to re-implement.** I did it from the text alone and found no ambiguity.
- **Best-row migration:** my first save seed gave a Hard-only mask a Normal best. The game migrated it to `[0,0,coins]`. That's exactly the SPEC ("min nonzero over the difficulties its mask has"), and v4.2's own sanitizer never writes such a row.

## Part 2: browser (375×812 touch and the 400×600 iframe)

Both sizes pass every item.

| Item | Result |
|---|---|
| Easy level (e1-01) | Tag "EASY" in the report, **6 spaces** (`cap` 6, 6 slots drawn). Win report: time, taps, "+5" coins, **no medals element**. |
| Hard level (e1-06) | Tag "HARD", **4 spaces**. Report "+20", no medals. Screenshots `tools/shots-v4.3-critic/functional/*-hard-report.png`. |
| Linked refusal | e3-62 at load: column 1's front waits for a buried partner. Tap refused (refused +1, plays 0, line and fronts unchanged), toast "Linked squads go together: bring both to the front". |
| Gallery one at a time | With Siege 25 cleared: picture 1 is "next", 2 and 3 locked. Picture 2 is `aria-disabled`, and a forced tap leaves the Gallery screen. Clearing picture 1 with real taps gives "Picture complete!", EASY, "+15 / First clear +10", no medals. Then picture 1 shows cleared, **picture 2 becomes next and opens**, picture 3 stays locked. |
| Old v4.2-shaped save (format 1) | Seeded: 30 Siege clears with masks 2/3/4, a Gallery mask 2, 777 coins, inventory, best rows in the 7-number form, `fast`-era speed 2, cb, muted, `diff` hard. Loads as 30/100, "Level 31", 777 coins. After one write: `v: 2`, 30 ids at 1, the Gallery id at 1. Bests `[7033,6,40]`, `[8000,11,30]` (min over Easy and Normal), `[7000,12,20]` (Hard-only mask). Settings kept, `diff` dropped, inventory kept. |
| Console | **0 errors or warnings** across both sizes |
