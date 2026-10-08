# Sapper's Path v5 R4: functional critic (levels 101-200, four realms, map to 25 sheets)

Branch `sappers-path`, head `89f8b59`, 2026-10-05. Read-only on code. Served on 8492 (killed after). Scratch scripts (not
committed): `r4check.mjs` (rules), `r4play.mjs` / `r4cont.mjs` / `r4pay.mjs` (Playwright) in the session scratchpad.

**Verdict: PASS. 0 blockers, 0 majors, 4 minors.**

## Results by check

| # | Check | Result |
|---|---|---|
| 1 | Rules from the SPEC text | PASS |
| 2 | The ladder, tags, lessons, Volley unlock, boss | PASS |
| 3 | Freeze, old saves | PASS |
| 4 | Hand play at 375x812 (touch) and 1280x720 | PASS, 0 console messages |
| 5 | Map past 100, quests, eggs, long tail, end state | PASS |
| 6 | Re-runs | PASS (all green) |
| 7 | Payload | PASS: 1.72 MB to play, 12.46 MB without tools/ |

### 1. Rules (my own reading, built on `tools/critic-v5/rules.mjs` plus what it leaves out)

The repo's critic-v5 does **not** model the Volley or mystery blocks: its power ops cover k 0-3 only, and its header says
so. So I extended it in a scratch subclass, written only from SPEC-v4 §9:
- Mystery-block exposure: a "?" on the picture's outer two rings shows from the start. Otherwise a "?" is exposed when it
  is 4-adjacent to connected ground, checked after every pop, clear and gate, with `SHOW`.
- The Volley (power 4): the colour checks, clears in the clear order (d², then the tie-break), cards cut and partners
  unlinked, squads leaving and their spaces freeing, walkers cut loose, a colour lock opening.
- The clear order.

Results:
- **Stored orders 101-200, no power-ups (my rules and the engine both):** 100/100 win.
  - Taps max 55; longest wait max 15.0 s (my own tap-to-rest and the grade agree); 5 spaces on every level.
  - 0 kills, 0 hits on stored orders (they're dealt hit-free).
  - All 57 locks start shut and open on the stored line. A colour lock never opens before its colour's first TAP. Every
    colour lock is 1-14, not 10, with cards in the deck. Every key lock is a plain gilt cell that is no gate's key.
- **Mystery blocks:**
  - 0 non-edge "?" exposed at load.
  - 8,161 SHOW events, identical as sets and times to the engine's.
  - Every engine EAT of a hidden block comes at or after its SHOW, and no claim or pop ever lands on a still-hidden block
    (checked in my sim).
- **Volley differential, levels 125-200, 6 rushed games each:** 456 games, 323 Volleys taken, 1,421 refused (bad colour,
  10, nothing left, per-level cap), mixed with taps. 0 mismatching games (status, reason, every
  EAT/CLEAR/FREE/REVEAL/POWER/UNLOCK/GATE/TOWER/SHOW). 0 kills.
- **Archers:** repo critic-v5 has 8,712 games, killGames 0, known answer K6 (Hard arrow knocks back) right. My Volley games
  also had 0 kills.
- **Power-ups never needed:** every stored order wins with all powers at 0.
- **Mystery colour in the UI (code read plus play):**
  - The board draws every hidden cell as `S.blk[0]`, one slate "?" stud (board.js 400).
  - A hidden block cleared by a continue or Volley pops as "?" (board.js 592, m = 0).
  - The Volley picker only offers face-up tiles and squads (`pickTargets`, `pickTile`), so it can't reveal a hidden
    block's colour.
  - The jam sheet's chips name squads only.
  - The boss screenshot at both sizes shows uniform "?" studs.

### 2. Ladder and tags (my reading of rules-review "The feature ladder" / "Tags mean..." and SPEC v5 R2/R4)
- **No feature before its milestone:** 0 problems. Mystery cards (non-front flag) are first used at 100, towers at 125,
  hidden blocks at 150.
- **Density, 101-200:** 0 violations.
  - Easy: at most one feature, no lock (158, 180, 189, 198 use none).
  - Normal: 2 or more, never all, no lock.
  - Hard from 125: all but at most one, plus a lock. Hard before 125: all, plus a lock.
  - Extreme: every unlocked feature plus a lock, never before 125.
- **Tags by realm (E/N/H/X):** realm 5 3/13/9/0, realm 6 3/8/10/4, realm 7 3/6/10/6, realm 8 3/5/9/9. Realm 5's 3 Easy
  includes the frozen lesson 100.
- **Realm ends:** 124 Hard; 149, 174 and 200 Extreme. 200 has `band: "boss"`, and no levels exist past 200.
- **Lesson 125** (Easy, lava moat and one tower). Coach lines in order: "Archers shoot inside the red ring. Tower
  first!", "Tower down: the ring is safe now.", "New power-up! The Volley clears one colour."
- **Lesson 150** (Easy). Coach lines: "? blocks hide their colour until dug beside.", "Dig next to a ? and its colour
  shows for good."
- **Volley unlock:**
  - At 124 (reach 124): `got` has no volley and the badge is hidden.
  - On starting 125: `got.volley` 1, `inv.volley` 1 (the free use), the intro tip is up (`meta().tip` = 4), and the badge
    shows.

### 3. Freeze and saves
- `node tools/freeze.js --require` **PASS**: 100 levels 555 checks, gallery 60/360, castles 283 cases, all 0 differences.
- Independently: levels.json levels 1-100 are byte-equal (JSON) to the pre-R4 base `abbeccb`. `levels/gallery.json` and
  `src/engine.js` are unchanged since `abbeccb`. The only frozen-dir change is the new `castles.json`.
- **Old saves** (both viewports):
  - v3 → e2-31 (30 done), v4 → e2-41 (40 done), v4.1 → e3-62 (61 done), **v4.2 (100 done) → e5-101**.
  - A v5-shaped save at level 100 (built with `SP.unlockTo(100)`), loaded **without** `?debug=1`: the title's Play goes
    straight into "101 The Mistmoor". 0 console messages.

### 4. Hand play (real Playwright taps at 375x812 3x touch, real clicks at 1280x720)
- **Wins** on real taps of the queue tiles following each level's order (0 refused or missed): 105 (Hard, colour lock),
  130 (Hard, towers, colour lock), 160 (Hard, hidden blocks), 200 (boss, Extreme). All won at both sizes, 0 kills.
- **Losses** (jam plan by real taps): 105, 130, 160, 200 all jam at both sizes.
  - The fail sheet shows "Continue 250"; its button is the top element at its centre.
  - A real tap or click takes it: status back to playing, line empty, coins 5000 → 4750.
  - Note: the sheet opens on a page-clock delay after the jam, so a script that reads it at once sees no panel. Not a bug.
- **Power-ups by hand on 160 mid-play:** Ladder, Scout, Quartermaster (badge then a glowing tile), Recall (badge then a
  space) and the Volley (badge then a face-up front tile). Each badge was visible, each use was counted (`used`
  [1,1,1,1,1]), and play went on.
- **Console:** 0 errors or warnings in every context: selfTest, play, map, saves, payload.
- **How the boss feels:**
  - It's busy and readable: two moats with locked drawbridges and keys, four archer huts with red rings over the inner
    ward, a sky full of "?" studs, two "?" mystery cards and a link bar in the queue, and the colour lock on the 5th
    space.
  - It plays like a strong Extreme, not a set piece: 50 taps, 263 s real pace against realm 8's Extreme 236-275 s, and a
    board two rows taller than the realm's.
  - Nothing in play marks it as the boss. The header shows the realm name "The Goblin King's Throne" and EXTREME, and
    `grep -i boss src/main.js config.json` finds nothing. See m3.

### 5. Map past 100
- **Progression:** focus and Play follow the cleared count at every step checked.

  | Cleared | Focus | Play button |
  |---|---|---|
  | 100 | e5-101 | "Play level 101" |
  | 101 | e5-102 | "Play level 102 Hard" |
  | 124 | e6-125 | "Play level 125 Easy" |
  | 149 | e7-150 | |
  | 174 | e8-175 | |
  | 199 | e8-200 | "Play level 200 Extreme" |
  | 200 | the long tail | "Play picture 51" |

- **Side quests 26-50:** they open after 104, 107, 112, ..., 196, 200, every 3-5 levels. The open state matched
  `after <= cleared` at every step checked from 100 to 200 (0 mismatches).
  - Volley prizes on **37 (after 148), 43 (after 171), 49 (after 196)**, and 55 in the tail.
  - Quest 37 won twice: the first win paid one Volley (inv 1 → 2), the second paid nothing (2 → 2).
- **Eggs:** visible eggs follow the reached realm. 30 at reach 101 (sheets up to 15), 36 at reach 125 (to 18), 42 at
  reach 150 (to 21), 50 at reach 175 (to 25). Nothing appears early: the counts are the same at 101 as at 100, and at
  125 as at 124.
- **Long tail:** 199 cleared plus 50 pictures gives no tail node, and picture 51 is closed. With 200 cleared, picture 51
  shows, then 52, 53 ... 60, one node at a time.
- **All cleared** (200 levels, 60 pictures): "Every level and picture cleared. Tap any of them to play it again.", the
  Play button hidden, no tail node.

### 6. Re-runs (all on 8492)

| Check | Result |
|---|---|
| `node tools/test.js` | 565 passed, 0 failed |
| `./tools/critic-v5/run.sh` | 0 mismatching games of 8,712 on 264 levels. Ladder 0, tags 0, picture-format 0, grade 0/260, maxWait 0 differ, known answers 0 wrong, real pace 260/260 identical. `diff-result.json` changed only `ms` and was restored with `git checkout` |
| `node tools/regrade.js` | 200 levels, 1155 checks, 0 differences |
| `node tools/regrade.js --gallery` | 60 levels, 360 checks, 0 differences |
| `node tools/freeze.js --require` | PASS |
| `SP.selfTest()` at 375x812 3x | 756/0 on a fresh save, at 155 cleared plus 30 pictures, and all cleared (map opened first) |
| `SP.selfTest()` at 1280x720 | 758/0 on the same three saves |

### 7. Payload
- **Bytes to gameplay**, measured: fresh load, no debug, title, a real tap on Play into level 1. **15 files, 1.72 MB.**
  The biggest are levels.json 723 KB, main.js 286 KB and gallery.json 168 KB.
- **Game folder without tools/:** 12.46 MB tracked, under the 20 MB cap. 9.87 MB without `tools/build-data/pools/pool-e2..e4.json`.
  On disk, tools/ is about 726 MB of gitignored shots and never ships.

## Findings

**Blockers:** none. **Majors:** none.

**m1 MINOR: the SPEC doesn't fix the same-instant order of `SHOW`.** The rules-as-text can't reproduce the exact event
order.
- Repro: replay any 150+ stored order in my scratch sim (SHOW logged after the pop's FREE, cells in index order) against
  the engine.
- Evidence: 90 games differ in order only. 45 are FREE vs SHOW: e7-150 at t=17090, the engine logs `SHOW 648` before
  `FREE 0`. The other 45 are SHOW vs SHOW: e7-151 at t=163650, the engine logs `SHOW 1029` before `SHOW 986`. Sets and
  times agree.
- SPEC-v4 §9 places SHOW "after the EAT/CLEAR and TOWER/UNLOCK/GATE" but says nothing about FREE, or about several
  SHOWs from one pop.
- Fix: one sentence in the same-instant order entry. No rule reads SHOW, so this is a spec gap only.

**m2 MINOR: the repo's independent critic can't see the Volley or mystery blocks.** R4 relies on them from 125 and 150,
so "critic-v5 0 mismatches" doesn't cover them.
- Repro: `tools/critic-v5/run.sh`. Its "power ops" arrays have 4 entries, and rules.mjs line 5 lists the Volley,
  continue and mystery blocks as not modelled.
- Evidence: this pass's scratch extension covered both (456 Volley games, 8,161 SHOWs, 0 mismatches).
- Fix: fold that extension into `tools/critic-v5` so future rounds re-check it.

**m3 MINOR (feel): 200 doesn't present as a boss in play.**
- Repro: `SP.unlockTo(199)`, play 200.
- Evidence: the header reads "200 The Goblin King's Throne EXTREME", the same as 176-199. There's no boss intro or name,
  and nothing in main.js or config mentions a boss.
- It's 50 taps and 263 s, in line with realm 8's Extremes (207-275 s).
- The map's king beside 200 is the only boss signal. The R4 notes already park "a bigger boss with looser caps" in LATER.
  Peter should decide whether 200 needs a moment of its own (a name or intro card).

**m4 MINOR: about 2.6 MB of bake pools sit in the game folder.** `tools/build-data/pools/pool-e2/e3/e4.json` are tracked, never loaded
at runtime (absent from the 15 files to play), and 2.56 MB.
- Repro: `git ls-files levels/pool-*`.
- They're under the cap either way. The portal build must keep excluding them, as the notes say it does.

Counts: 0 blocker, 0 major, 4 minor.
