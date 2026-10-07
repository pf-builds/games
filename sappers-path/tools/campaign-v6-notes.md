# Sapper's Path campaign v6 (lane A, Campaign Challenge Mode): build notes

Branch `campaign-v6`, worktree `repos/games-sappers-campaign/`. The curve and Peter's calls: `tools/campaign-v6-curve.md`.
Rules as built: SPEC-v4 §9, the "Campaign v6 stage 1" entry. Resume checklist: `tools/v5-progress.md`, "Campaign v6 lane A".

## 1. Stage 1: the rules (killing towers, two locks), 2026-10-06

Rules, page and tooling only. No shipped level carries the new fields; `levels/levels.json` and `gallery.json` untouched.

### 1.1 What shipped

| Piece | Files | Commit |
|---|---|---|
| Engine + reference rules + known-answer tests | `src/engine.js`, `tools/ref.js`, `tools/test.js` | 60fe16c |
| Tooling (dealer, bake, tags, grader, regrade, critic-v5) | `tools/gen.js`, `bake.js`, `land-bake.js`, `tags.js`, `grade.js`, `regrade.js`, `bake-config.json`, `critic-v5/rules.mjs`, `critic-v5/diff.mjs` | a563ee2 |
| Debug levels + differentials | `levels/debug-v4.json`, `tools/debug-v4.js`, `tools/test.js` | eb721b0 |
| Page + selfTest + browser run | `src/main.js`, `src/board.js`, `config.json`, `index.html`, `style.css` (cache `?v=46`), `tools/shots-campaign-v6.mjs` | 73f8c32 |

### 1.2 Decisions (mine, inside the brief)

- **The kill is the level's flag `kill: true`.** A boolean; the engine never reads the tag. Restored from v4.3's code (git
  `fe49b1e^`): qK 3 at the send, KILL at the arrow, the dead sapper finished (frees its space, counts done in a pair),
  short when `sap[m] < left[m]`. New reason code 5 `short` (code 2 stays dealing mode's `hit`).
- **safeArchers retired cleanly:** accepted and ignored as since v5 R1, but `kill` + `safeArchers` throws (a level can't
  be both). No shipped level has safeArchers.
- **Volley vs a doomed walker:** a walker whose arrow hasn't landed is cut loose like any other; its arrow then only
  knocks it back (no kill, no short). Without this the arrow would have decremented a colour the Volley had zeroed and
  touched a space the Volley had freed. Engine, reference and critic all model it.
- **Continue on a short fail: not offered.** Retry and Back to map only. `revive()` already takes only a jam, and a
  continue finishes stuck squads; it can't give a dead sapper back. Words in config `layout.v6Note`.
- **Short sheet words:** "Not enough [colour chip] sappers left: archers shot one down." (aria "Not enough {crew} left:
  archers shot one down."). Plain, says what happened and why. Title stays "Assault failed".
- **The kill shown:** v4.3's doomed-runner animation is still in `board.js` (fall and fade, "Shot down by an archer!", the
  fall cue); it plays again now that the engine kills. Added a red toast as a killing level starts ("Deadly archers: a
  sapper they hit is lost") so the rule is known before the first loss. No new art.
- **Two locks keep their places (index-based, not a count).** Lock 0 shuts the left socket, lock 1 the right; whichever
  opens, its own socket pops and the other stays shut. The alternative (a count of shut spaces at the line's end) is the
  same rule for capacity but makes the shut marker jump sockets when lock 1 opens first. Placement: lowest space neither
  held nor shut. Ladder: the new space goes before the trailing shut run, so with one lock every space number and event
  is as before (test: `locks: [one]` equals `lock: one` event for event).
- **Each lock has its own marker:** a colour lock's socket shows its colour; each key lock's gilt key wears the dashed
  brackets while its lock is shut (two key locks look alike; either opens its own socket). The page pops a socket from
  the lock state (`app.lockWas`/`lockSock`), not from the UNLOCK hook, because a colour lock opens inside the tap, before
  the board's next sync.
- **Dealer and two locks:** every colour lock is dropped for the deal (a space fewer each), key locks kept (they open on
  their key pop in the deal as in play). So a two-colour-lock Extreme deals on 3 spaces.
- **Careful player by range:** `grade.careful.byRange: [{from: 150, to: 200, games: 32}]` (`grade.js carefulGames`); the
  `to: 200` matters: land levels 201+ store `careful` at 16 games and must regrade unchanged. `grade.careful.castle`
  (false) is the stage-2 switch that grades castle levels' careful player in `bake.js gradeLevel`.
- **critic-v5 extended** from the SPEC entry (a third implementation), since the debug levels it plays now carry both
  fields. Its known answers are unchanged.

### 1.3 Measurements

- `tools/test.js`: 647 passed, 0 failed (618 before). New: 28 known answers (kill, short, spare sapper, coupled pair kill,
  dealing mode, two-lock compile errors, `locks:[1]` = `lock`, independent opening, a squad past a shut space, a pair
  opening two locks, jamWhy 2), plus 6 killing + 8 two-lock injected levels in the no-hang, twists and power-up
  differentials (engine == reference; short fails seen).
- Freeze PASS: levels 200 / 1,155 checks, gallery 60 / 360, castles 283 cases, 0 differences.
- Regrade 0 of 1,605 (250 levels); `--gallery` 0 of 432 (72).
- critic-v5: 0 mismatching games of 10,824 (328 levels incl. 6 debug; 23 kill games, 1,234 unlock games), 13/13 known
  answers, real pace 322/322.
- selfTest (`tools/selftest-lands.mjs`): 911/0 at 375x812 3x, 913/0 at 1280x720; 0 console messages. New checks: the kill
  toast, a short game (doomed runner, label, kill), the short sheet (words, chip, no continue, Retry), Retry, the stored
  order winning with nobody shot; two sockets with their own markers, each opening its own socket with one cue, the win.
- Real-tap browser run (`tools/shots-campaign-v6.mjs`, shots in `tools/shots-campaign-v6/`, gitignored): 1280x720 and
  375x812 3x touch, from the map's debug row: v6-kill (toast; tap 3 then 0: kill, short sheet; Retry), v6-locks (3 of 5
  open; key opens the right socket alone, then the colour the left; 41 real taps win). 14/14 ok, 0 console messages.
- Harness (`tools/harness.mjs`): selfTest 911/0 at 375x812, 375x667, 414x736, 360x740 and the 400x600 iframe, 913/0 at
  812x375 and 1280x720, the hidden-tab run 911/0 and a win; 0 fails, 0 console messages (its report was written; the
  process then sat idle after the report and was stopped by hand).
- Careful player at 32 games, depth 3: 0.3-0.9 s a level (150, 160, 175, 190, 200 tried), so a 51-level pass is under a
  minute single-threaded; the tuner's hill-climb multiplies that by its evaluations.

### 1.4 For stage 2 (the re-deal)

- **Set the flags as data:** `kill: true` on Hard and Extreme levels with towers, and on every tower level from 150;
  Normal before 150 leaves it off (knock back). `locks: [a, b]` on Extreme from 150 (3 of 5 open). Lock order is the
  socket order: lock 0 left. Pick the colour lock's colour from the dealt order as now (`relay.lockAt`).
- **Measure, don't assume:** killing towers can make the careful player *better*, because a bad tap now fails at once
  and the 3-deep lookahead sees it. Level 175: careful 0.00 knocking back, 0.94 killing (32 games). Level 160: 0.78 to
  0.22. Gate on the careful player with the flag on.
- **Rush deals:** `rushOf` now reads `L.kill`; turn `deal.rushHard` on if killing levels should also win at real pace.
- **Feature ladder:** towers before 125 (about 60 on) need `config.json v5.density.unlock.tower` lowered, and then
  `tags.js densityOK` and critic-v5's `early` check follow it. Otherwise both flag towers in realms 3-5.
- **selfTest §6 (archers per tag):** its search wants a hit that leaves the level playing; on a tag whose tower levels
  all kill (Hard, Extreme) it must take v4.3's lethal branch again (a doomed runner and a short fail), else it fails.
- **Grading the careful player on the castle:** set `grade.careful.castle: true`; regrade then checks it (32 games from
  150).
- Debug levels stay re-solvable: `node tools/debug-v4.js --check` (6 levels match); `--add-v6` rebuilds the two v6 ones
  from the current `levels/levels.json` (it would change if 96 or 125 change).

## 2. Stage 1b: the archer gradient (Normal knock back, Hard pin, Extreme kill), 2026-10-06

Peter changed the rule mid-lane: the gradient applies at every level range and replaces "every tower kills from 150".
Rules as built: SPEC-v4 §9, "Campaign v6 stage 1b". Field `archers: "pin" | "kill"`; stage 1's `kill: true` now throws
(no shipped level used it).

| Piece | Commit |
|---|---|
| Engine + reference + known answers + differentials | 02d94a0 |
| Tooling (bake, grader notes, critic-v5 pins, debug v6-pin) | 140e6df |
| Page (pinned look, calm toast, jam sheet names pins, selfTest, real-tap run), `?v=47` | 8a073ba |

### 2.1 Decisions

- **Which tower pins:** the lowest-numbered standing tower whose ring covers the target, fixed at the send. That's
  deterministic and needs no geometry. The board draws that tower's archer shooting (`pinBy`), not the first ring the
  route crosses.
- **The target goes back unclaimed** (as for every hit), so another squad can take it.
- **Released:** it walks back to its space from where it lies (yard + half its walk, no knock pause), rejoins the
  waiting sappers and dispatches normally (still wary). That's the knocked-back path the engine already had, so a
  release is a scheduled home event. Releases go in send order, logged right after the tower's TOWER.
- **A pin whose tower fell before the arrow landed** is a plain knock back. Otherwise it could never be released.
- **Jam detection:** a pinned sapper isn't an event, so the clock rests with it pinned. At rest nothing can fell a
  tower, so "every front refused" is a jam, a loss, and that's correct. It covers the self-locking case, where the tower
  can only be reached through blocks the pinned squad holds. `stuck(s)` is false for a squad with anyone pinned (it has
  one out). jamWhy bit 8 marks pins at the jam, and the sheet names those squads.
- **Volley / continue:** a pinned sapper of the Volley's colour is cut loose (REL -1) and walks home. The continue
  treats pinned sappers as part of the stuck squad: their blocks are cleared too, and they are cut loose first. Both are
  deterministic and the reference models them. The critic models the Volley (it never modelled the continue).
- **Dealing:** unchanged and hit-free, so stored orders on pin levels never meet an arrow and never depend on a release
  (no luck). Pin difficulty shows up in the graders (random, lookahead, careful), which play the engine with pins.
- **Toast:** calm (the toast's normal style), where kill's is red.

### 2.2 Measurements

- test.js 663/0. New known answers: pinned at rest (holds its space, not stuck, no event), release time = tower fall,
  walk back = knock walk without the pause, win; a knock back when the tower fell first; a pin jam (jamWhy 8) and the
  reference agreeing; the continue clearing waiting + pinned blocks; the Volley cutting a pin loose; dealing mode. The
  differentials now inject 4 pin and 2 kill levels (plus the debug levels).
- Freeze PASS; regrade 0 of 1,605, gallery 0 of 432; critic-v5 0 of 10,857 games (pin games 23, jams with bit 8).
- selfTest 919/0 and 921/0; real-tap run (`tools/shots-campaign-v6.mjs`, port 8497) 22/22 ok, 0 console messages.
- Careful player (32 games, depth 3) on 10 Hard levels 125-200 with towers, current decks:

| Level | Knock back | Pin | Kill |
|---|---|---|---|
| 127 | 0.938 | 0 | 0.094 |
| 133 | 1 | 1 | 0.75 |
| 136 | 1 | 1 | 0.219 |
| 142 | 0.813 | 0.813 | 0.156 |
| 145 | 1 | 0 | 0.375 |
| 151 | 1 | 0.969 | 0.938 |
| 156 | 0.063 | 0 | 0.156 |
| 160 | 0.781 | 0.469 | 0.219 |
| 165 | 0.406 | 0.719 | 0.469 |
| 172 | 1 | 0.969 | 1 |
| Mean | 0.800 | 0.594 | 0.438 |

  Pin is harsher than knock back on average and on 6 of 10 (equal on 3). It isn't monotone: on 165 pinning helps (a
  pinned sapper stays out of a second round that would have jammed), and on 127 and 145 pin is harsher than kill (a
  pin can hold a space into a jam, while a kill frees it). So stage 2 should gate each level on its measured rate.

### 2.3 For stage 2

- Set `archers` per level from the tag: Hard "pin", Extreme "kill", Normal none. This replaces §1.4's "every tower
  kills from 150".
- selfTest §6 (archers per tag): Hard levels pin (a hit leaves play going, so its search still works, but its "knocked
  back runner" check must accept the pinned kind 3). Extreme levels kill (v4.3's lethal branch).

## 3. Stage 2: the re-deal of 1-200 on the approved curve, 2026-10-06/07

Every level of 1-200 re-tagged and (outside the lessons and the 4-8 tutorial) dealt again on its kept board, graded with its
archers rule on, and installed with 0 fallbacks. Rules as built: SPEC-v4 §9, "Campaign v6 stage 2: the re-deal". Tooling:
`tools/campaign-v6.js` (plan, bake, install, measure), `tools/campaign-v6-bake.js` (the worker); every number in
`tools/bake-config.json` (`tags.v6`, `v6`) and `config.json` (`v5.density` v6 rule, towers from 60, `v5.freeze.lift`).

### 3.1 What shipped

| Piece | Commit |
|---|---|
| Tooling (WIP), tags.v6, v6 config, density rule, gen.js knobs, selfTest §6, critic-v5 tags, test.js, freeze lift | 4a27166 |
| Bake data: levels 1-200, coach card on 53, after baseline | af0fe4c |
| Page + critic: `?v=48`, selfTest coach check, overlap level 63, critic-v5 cut-loose walk | 318a045 |
| Docs, harness first-Hard lookup, shots-campaign-v6-s2 | (this commit) |

### 3.2 The tags (bake-config `tags.v6`, one letter a level)

Counts per realm exactly the curve's: 6/14/3/1, 4/12/6/3, 3/11/8/3, 3/10/8/4, 3/9/9/4, 3/8/9/5, 2/5/10/8, 1/3/6/6, 191-199
0/0/2/7, 200 X (totals 26/73/61/40). Laid out by a small solver (scratchpad, not shipped) under the boards' constraints and
then fixed as data:
- a key-lock board (its gilt key is a board pixel) is Hard or Extreme; Easy needs a board with at most one feature (no gate);
  Extreme from 50 needs a gate (from 125 towers too); 53 stays the first colour lock and 87 the first key lock (their coach
  lines); teaching levels stay Easy; 1-8 stay a gentle tutorial (decks kept: 1-3 lessons, 4-8 kept and re-graded);
- the sawtooth: a Normal lead, a Hard run, an Extreme peak, an Easy breather after it, each realm ending Extreme. Realm 7
  can't give every peak a breather (2 Easy, 8 Extreme, and its gate-and-tower boards come at most two in a row), so its
  middle is a hard plateau (157-166: H X X H X X H X X) before the 167 breather. 175 opens on a Normal then 176 X (a key
  board). The longest gap between Hard/Extreme levels is 7 (58-63), so test.js's v5 "every 3-6" check reads 7.
- **Swap (logged, `v6.swaps`):** 188 N and 189 H traded tags. 189's open board (no moat or gate) kept the careful player at
  0.69 or more over 28 Hard candidates (ceiling 0.15); 188's moat, gate and tower carry the Hard (pin + lock): 188 H careful
  0.094, 189 N 0.219 (ceiling 0.35).

### 3.3 Decisions (mine, inside the brief)

- **Archers only where towers stand.** `archers` is set on Hard (pin) and Extreme (kill) levels that have towers; a Hard or
  Extreme without towers carries no field. The page shows the pin/kill toast from the field, so a tower-less level saying
  "Deadly archers" would be wrong. test.js checks the rule both ways.
- **The density rule reads every feature, board and deck** (`tags.js densityV6`, config `v5.density.v6`): Easy 0-1, no lock;
  Normal 1-2 (at least what is unlocked), no lock; Hard 2-3 + lock from 50; Extreme every unlocked feature + lock, towers
  optional before `towerFull` 125 (the curve's own counts put 3 towers in realms 4 and 5 against 4 Extremes). A board's moat,
  gate and towers count first and the deck (linked pairs, ? cards, mystery blocks) fills up to the tag's top in a seeded
  order. So a Hard in realms 6-8 on a moat + gate + tower board uses no deck features: the curve's 2-3 is a cap, and the
  difficulty comes from the deal. Normal never draws mystery blocks.
- **Towers.** Restored from the v4.3 boards (git `0a08325`): 64 (H, 2 towers: the first tower and first pin, coach line "Archer
  towers are back! Here a hit pins your sapper until its tower falls."), 66 (X, 3: the first kill, coach line "Deadly archers:
  bring their tower down before anyone walks into the ring."), 74 (X), 80 (H), 82 (X), 91 (X). 97 (v4.3's 4 towers) would not
  deal patiently at all (0 of 40) and 60 can't carry one on a Normal (moat + gate + tower is 3 features), so the first tower
  is 64. Painted (`paintTower`): 104, 115, 117 (realm 5) and 191, 195, 196, 198 (so every one of 191-199 has towers): a 5-wide
  slate tower on the bank path at the frame, 14 rows, merlons, slits, one solid ink outline where it meets the picture, range
  9.5; its colour the nearest (CIEDE2000) to the scene's slate that clears every board colour by 25 / faded 20 and water, lava,
  mire and the mystery slate by 25 (realm 5's fen palettes push it to violet: 104 #c74fc0, 115 #938b9e, 117 #bf87fb; realm 8
  stays slate-grey/teal). From 125 a Normal or Easy level's towers turn plain (187 keeps them, a knock-back Normal); 154 and
  172 (Hard) turned plain to land realm 7 at 14.
- **keepOnly (partial tower drops), 7 killing levels.** On a killing level the stored order must win replayed at real pace,
  with thinking time and at the steady rhythm (the invariants). With all their towers no deal of 82, 138, 139, 165, 179, 183
  or 200 survived that (each tower subset measured over 30 deals); they keep the subset that does (82 [2], 138 [1], 139 [0],
  165 [1], 179 [1], 183 [0, 2], 200 [1, 3]); the rest turn plain as v5 did. Logged in `v6.towers.keepOnly`.
- **Rushed dealing came back as half the candidates** (`v6.deal.rush [true, false]`, `rushOpen "both"`: the rushed
  simulations play the colour locks shut and open). Rushed deals rarely exist on killing boards, so every deal's order is
  also checked before the tuning (`replaysOK`: real pace, 1/2/4 s thinking, the 1 s steady rhythm), up to `attempts` deals a
  candidate, and the tuner only moves cards on an archer level (`v6.tune.rushed`), so the checked play is the stored play.
  gen.js also gained `towerFirst` and `rushSafe` (tried; neither raised the yield, left off).
- **Locks.** From 50 every Hard and Extreme: the board's key lock if it has one, else a colour lock (the colour whose first
  squad comes nearest 0.3 of the order); Extreme from 150 adds a colour lock (0.55): [key, colour] or [colour, colour]; two
  locks first at 157.
- **Mystery blocks** (from 150, Hard 15-25%, Extreme 25-35%): read as a share of the buried castle blocks a mystery block may
  sit on (gen.js hide's own measure, with plan.hidden's skip roles and group cap, and a new `gap` so the share asked is the
  share hidden). That is 4-14% of all the picture's blocks. Boards with no bank path above the fort (177's kind) can't carry
  them; the plan then picks another deck feature (180).
- **? cards** need rows 1-4 behind the front for 6-8 (mystify keeps two of a column a row apart). The honest-vs-seeing gap
  rule (0.2) cut 13 levels below their planned count: 108 4/6, 116 4/5, 138 4/6, 148 5/7, 160 4/7, 164 5/6, 165 5/7, 174 6/7,
  176 5/6, 183 5/6, 189 2/3, 191 6/8, 199 5/7. Kept: the gap rule is the luck guard.
- **Pace.** Realm medians are the curve's gate (200-250 s from realm 2); a single level may run 160-345 s (a locked, pinned or
  killing level runs long). Realm 1 keeps short boards (30-120 s).
- **More, smaller squads** in realms 1-2 (`v6.deal.byRealm`: squads of 10-30 and 40-80): realm 1's taps median 12 -> 19,
  realm 2's 44 -> 51.
- **Freeze.** `config.json v5.freeze.lift [1, 200]` (Peter's one-time lift): test.js compares the rest of the snapshot and the
  Gallery byte for byte; the snapshot is not re-taken (after the quests merge).

### 3.4 Measurements (before: git 285b8a5 and `campaign-v6-baseline-before.jsonl`; after: `campaign-v6-baseline-after.jsonl`)

| Realm | Tag | n before / after | Careful before / after | Obvious before / after | Random tap median before / after | Pace median s before / after | Taps median before / after |
|---|---|---|---|---|---|---|---|
| 1 | all | 24 / 24 | 1.00 / 0.64 | 1.00 / 0.62 | 100.00% / 12.75% | 35 / 46 | 12 / 19 |
| 1 | easy | 5 / 6 | 1.00 / 1.00 | 1.00 / 1.00 | 100.00% / 100.00% | 32 / 32 | 12 / 12 |
| 1 | normal | 14 / 14 | 1.00 / 0.65 | 1.00 / 0.61 | 95.50% / 12.25% | 36 / 46 | 12 / 19 |
| 1 | hard | 5 / 3 | 1.00 / 0.06 | 1.00 / 0.08 | 100.00% / 0.75% | 37 / 56 | 13 / 28 |
| 1 | extreme | 0 / 1 | - / 0.19 | - / 0.23 | -% / 0.00% | 0 / 54 | null / 29 |
| 2 | all | 25 / 25 | 0.99 / 0.46 | 0.86 / 0.34 | 55.00% / 5.50% | 214 / 228 | 44 / 51 |
| 2 | easy | 3 / 4 | 1.00 / 0.98 | 1.00 / 0.96 | 73.00% / 46.25% | 212 / 201 | 38 / 46 |
| 2 | normal | 16 / 12 | 0.99 / 0.48 | 0.93 / 0.20 | 55.25% / 7.00% | 214 / 224 | 43 / 49 |
| 2 | hard | 6 / 6 | 0.98 / 0.18 | 0.61 / 0.21 | 37.25% / 1.50% | 213 / 235 | 45 / 49 |
| 2 | extreme | 0 / 3 | - / 0.25 | - / 0.37 | -% / 0.25% | 0 / 222 | null / 54 |
| 3 | all | 25 / 25 | 0.87 / 0.35 | 0.48 / 0.34 | 2.50% / 3.50% | 223 / 231 | 53 / 50 |
| 3 | easy | 3 / 3 | 1.00 / 1.00 | 1.00 / 1.00 | 49.00% / 41.25% | 211 / 211 | 44 / 44 |
| 3 | normal | 16 / 11 | 0.90 / 0.36 | 0.42 / 0.42 | 2.50% / 7.00% | 222 / 224 | 54 / 52 |
| 3 | hard | 6 / 8 | 0.71 / 0.20 | 0.37 / 0.10 | 0.00% / 0.75% | 223 / 233 | 48 / 50 |
| 3 | extreme | 0 / 3 | - / 0.08 | - / 0.01 | -% / 0.00% | 0 / 227 | null / 51 |
| 4 | all | 25 / 25 | 0.84 / 0.35 | 0.55 / 0.20 | 2.50% / 2.25% | 222 / 222 | 50 / 48 |
| 4 | easy | 3 / 3 | 0.98 / 1.00 | 0.97 / 1.00 | 47.50% / 41.25% | 204 / 178 | 47 / 41 |
| 4 | normal | 16 / 10 | 0.83 / 0.42 | 0.43 / 0.14 | 2.50% / 4.00% | 219 / 209 | 52 / 46 |
| 4 | hard | 6 / 8 | 0.80 / 0.19 | 0.64 / 0.08 | 0.25% / 0.75% | 226 / 222 | 42 / 49 |
| 4 | extreme | 0 / 4 | - / 0.02 | - / 0.00 | -% / 0.00% | 0 / 250 | null / 48 |
| 5 | all | 25 / 25 | 0.76 / 0.32 | 0.45 / 0.37 | 3.25% / 2.75% | 232 / 231 | 45 / 45 |
| 5 | easy | 3 / 3 | 1.00 / 1.00 | 0.80 / 1.00 | 42.75% / 51.00% | 246 / 226 | 45 / 44 |
| 5 | normal | 13 / 9 | 0.72 / 0.32 | 0.36 / 0.30 | 4.00% / 7.50% | 232 / 231 | 50 / 47 |
| 5 | hard | 9 / 9 | 0.74 / 0.17 | 0.45 / 0.27 | 1.50% / 1.00% | 231 / 231 | 42 / 45 |
| 5 | extreme | 0 / 4 | - / 0.14 | - / 0.31 | -% / 0.25% | 0 / 219 | null / 48 |
| 6 | all | 25 / 25 | 0.60 / 0.24 | 0.29 / 0.43 | 2.50% / 2.00% | 224 / 227 | 53 / 50 |
| 6 | easy | 3 / 3 | 1.00 / 1.00 | 1.00 / 1.00 | 46.00% / 45.50% | 228 / 210 | 45 / 45 |
| 6 | normal | 8 / 8 | 0.38 / 0.32 | 0.08 / 0.58 | 3.75% / 9.25% | 224 / 228 | 55 / 49 |
| 6 | hard | 10 / 9 | 0.75 / 0.05 | 0.26 / 0.24 | 2.00% / 1.50% | 221 / 227 | 51 / 51 |
| 6 | extreme | 4 / 5 | 0.38 / 0.01 | 0.29 / 0.18 | 0.75% / 0.00% | 225 / 226 | 53 / 46 |
| 7 | all | 25 / 25 | 0.75 / 0.15 | 0.45 / 0.33 | 1.25% / 1.00% | 225 / 225 | 52 / 48 |
| 7 | easy | 3 / 2 | 1.00 / 1.00 | 0.88 / 1.00 | 49.25% / 50.50% | 225 / 174 | 48 / 36 |
| 7 | normal | 6 / 5 | 0.68 / 0.21 | 0.37 / 0.53 | 4.00% / 11.00% | 225 / 233 | 50 / 48 |
| 7 | hard | 10 / 10 | 0.66 / 0.05 | 0.38 / 0.17 | 0.25% / 1.00% | 225 / 225 | 54 / 50 |
| 7 | extreme | 6 / 8 | 0.85 / 0.02 | 0.44 / 0.25 | 1.00% / 0.25% | 224 / 223 | 51 / 48 |
| 8 | all | 26 / 26 | 0.54 / 0.08 | 0.38 / 0.26 | 1.75% / 0.50% | 227 / 234 | 51 / 50 |
| 8 | easy | 3 / 1 | 1.00 / 1.00 | 0.83 / 1.00 | 48.25% / 43.25% | 221 / 231 | 53 / 51 |
| 8 | normal | 5 / 3 | 0.79 / 0.21 | 0.43 / 0.46 | 5.25% / 7.75% | 224 / 221 | 51 / 51 |
| 8 | hard | 9 / 8 | 0.30 / 0.04 | 0.36 / 0.15 | 0.50% / 1.50% | 231 / 226 | 51 / 51 |
| 8 | extreme | 9 / 14 | 0.49 / 0.00 | 0.22 / 0.22 | 0.75% / 0.00% | 231 / 261 | 49 / 50 |

Coins a full first clear of 1-200 earns (meta.coins win + first, by tag): before 8580, after 9975.

Every careful ceiling is met on its stored grade (16 games before 150, 32 from 150; 200: 0 of 32). Random-tap bands met
on every dealt level. Realm pace medians 46 s (realm 1), then 228, 231, 222, 231, 227, 225, 234 s. Taps at most 55, longest
wait 15 s or less, peak 5 spaces, every stored order wins with no arrow landing and no power-up, every steady and thinking
replay wins (checked on the installed file). Coins a first clear of 1-200 earns (win + first): 8,580 -> 9,975.

Bake history: bake1 (all 186 dealt levels, 2,073 candidates, 85 min on 14 threads, 50 fallbacks), bake2 (`--reuse`, the
pace range and mystery-block fix, 48), bake3 (`--extra 16` on those, keepOnly, 240 deal attempts: 12), bake4 (`--extra 48`
on 13 incl. the swap: 1), bake5 (176, 400 attempts, `--extra 64`: 0). Candidates are cached per level in
`tools/campaign-v6-scratch/cands/` (gitignored).

### 3.5 Checks

test.js 663/0; regrade 0 differences of 2,205 (250 levels), `--gallery` 0 of 432 (72); freeze PASS (snapshot 1,155 + 360 checks,
castles 283); 201-250 byte-identical to 285b8a5 and gallery.json unchanged; critic-v5 0 mismatching games of 10,857 (421
kill games, 461 pin games), known answers 0 wrong, real pace 322/322; `debug-v4.js --check` matches; selfTest 932/0
(375x812) and 934/0 (1280x720), 0 console messages; the stage 1 real-tap run 22/22; `tools/shots-campaign-v6-s2.mjs` 26/26 at
1280x720 and 375x812 (64, 66, 159, 200 opened from their map nodes; a pin, a kill and its short sheet, the stored orders by
real taps, two sockets on 159); harness all passed (selfTest 932/0 at 375x812, 375x667, 414x736, 360x740 and the 400x600
iframe, 934/0 at 812x375 and 1280x720, the hidden-tab run 932/0 and a win on level 11, the first Hard), 0 console messages;
the font preload warning a ?v bump would have caused was caught here (style.css's font URL bumped with index.html).

### 3.6 For the critics

- The 191-199 run, 176 and 200 sit at or near 0 for the careful player: they are close to walls for a planning player
  (the curve's "almost requiring gold"). Their random-tap rates are 0-0.25%.
- Realm 5's painted towers are violet, not slate: worth a visual look (104, 115, 117).
- Hard levels in realms 6-8 on full boards use no deck features (the 2-3 cap); a playtester may read them as plainer than
  the old Hards, though the careful player finds them much harder.
- The coach on 64 and 66 shows over the toast; their wording is new.
- Realm 7's hard plateau without breathers (157-166).

## 4. The on-theme side quests (lane A, quests), 2026-10-06

Branch `campaign-v6-quests` (worktree `repos/games-sappers-campaign-quests/`, cut from `campaign-v6` at 285b8a5); the
orchestrator merges it into `campaign-v6`. This section is separate from §3 (the re-deal) so the two merge cleanly.
Source: `game-research/sappers-path-v4/v6-plan.md` Step 0 (Peter OK 2026-10-06), lane C's hand-off
(`game-research/sappers-path-v4/lands/campaign-quests/README.md`, `picks.json`). SPEC-v4 §9 "Campaign v6: the on-theme
side quests". Tool: `tools/quest-bake.js`; data: `tools/campaign-quests/`.

### 4.1 What shipped

- `levels/gallery.json`: the campaign's side quests are exactly 50, places 1-50: the 24 kept (stored levels byte for
  byte; only `n` and `quest` change) and lane C's 26 picks as new ids `g-ours-cq<NN>` (never an old id). The 36 that
  move to Zen World 1 left the file (their manifest and LICENSES.md lines stay for lane B). The Wandering Gallery's 12
  records are untouched (their `n` stays 61-72: land-config sideCycle and critic-v5 read it); they now sit in places
  51-62 of the file, and their map spots' `q` follow the places (51-62), since the page finds a quest's picture by
  place (`app.gal[q - 1]`).
- `map/layout.json`: quests 1-50 keep their spots, slots (after) and prizes; only their `id` changes. Wander spots' `q`
  renumbered as above. Nothing else in the map.
- `levels/gallery-manifest.json`: `order` = the 50; 26 new lines (kind `outlined`, source `tools/campaign-quests/src`).
- `LICENSES.md`: a "Campaign v6 side quests" section, one line per new picture (between `campaign-quests` markers).
- `tools/gallery-config.json`: `convert.kinds.outlined` (lane C's entry). Boards: `tools/land.js boardOf` from the stored
  160 px sources, shaded; all 26 grids, palettes, shade rows and rings identical to lane C's `boards/` (26/26; lane C's
  `handoff.js` against this worktree: 29/29).
- Prizes: `tools/quests.js` unchanged; the 50 slots carry the same afters and prizes as v5's places 1-50 (ladder 18,
  quartermaster 14, recall 9, scout 6, volley 3 at 148, 171, 196). Shown on the node before playing (unchanged page).

### 4.2 Decisions (mine, inside the brief)

- **Order** (`quests.json order`): kept and new alternate (new runs of 2 at 24-25 and 3 at 47-49), no two neighbours of
  one theme group (goblin 9, creature 16, knight 10, castle 8, siege 3, soldier 4), kept Easy pictures early, kept Hard
  ones one per realm from realm 2, the Goblin King's Hoard last (after 200). Goblin's Lunch stays picture 1 (the selfTest's
  shading fixture needs an unshaded picture 1). Lane C's simple-to-busy order roughly kept for the new ones. Found by a
  small swap search, then tags set by hand so no two Hard quests sit side by side.
- **Titles**: lane C's, with 5 retitled where Flux drew something else: cq20 Trusty Steed (a real horse, not a hobby
  horse), cq38 The Jester (standing), cq01 Apple Goblin (holds the apples), cq21 Round Shield (no reflection), cq10
  Birthday Dragon. Every new title fits the play bar whole at 360 and 375 px (17 and 20 px type), so none needs `short`.
- **Tags** of the 26 new: Normal 17, Hard 7 (one a realm from realm 3, 45 and 48 in realm 8), Easy 2 (10, 25). All 50:
  Easy 6, Normal 30, Hard 14; no Extreme.
- **Features** (`quests.json ladder`, `density`, `deck`, `amounts`): a feature only when the quest's main level is at or
  past its first level (the quest opens once that level is cleared): moats 25, the lock 53 (the campaign's first lock
  coach, not 50: a quest after 50-52 would show a lock before it is taught), linked 75, ? cards 100, mystery blocks 150;
  no archers. Easy at most 1 feature, Normal 2, Hard 3 plus a colour lock (colour locks only). The moat (lane C's ring,
  opening set 0, Hard 1) first, then deck features: Normal in turn by its count among the new quests, Hard newest first.
  Result: moat 23 (4 mire), linked 8, ? cards 10, mystery blocks 3, lock 7; realm 1 quests plain.
- **Mystery blocks only on Hard, with a looser face rule** (`quests.json landConfig`, merged over land-config for the bake
  via LAND_CONFIG): the default face rule reads every cell beside the ink outline as face detail (3 colours in a 3x3) and
  left 0 room on all 5 planned pictures ("no room for mystery blocks"). With detail 5, top 0.3, pad 1 and 16% of eligible
  blocks, the 3 Hard quests hide 28-47 blocks; the 2 Normal ones that had planned them take ? cards or links instead.
- **Bands** by tag and the main level: Easy 62-85%; Normal 46-64% (to 49), 30-48% (50-124), 20-40% (125+); Hard 10-30%,
  5-20% from 125 (random-tap, as the castle Gallery's). Pace 150-300 s, aim 200 s (the castle Gallery's). Every new quest
  baked by `land-bake.js bakeOne` as a side quest (gallery-config's grader, so `regrade.js --gallery` re-grades it),
  seed `300000 + cq number` (stable whatever its place). 26/26 good on the first pick, 0 fallbacks.
- **Kept levels unchanged**: none of the 24 needs a feature its slot requires (features are allowed, never required), so
  no re-deal.

### 4.3 Saves (checked, not changed)

- The stored save keys pictures by **id**: `gal: {id: mask}`, `best`, `tail: {id: 1}`. Quest slots are not stored
  (questOpen works them out from the list and each picture's `after`). So the 24 kept keep their clears, the 26 new ids
  can't inherit anyone's clear, and an old clear never credits a new picture.
- **But `Save.sanitize` keeps only ids in the current Gallery list**: a v5 save's clears of the 36 that left are dropped on
  the first load of this branch. Lane B's one-time move (`zenMoved`) must read them from the raw save before sanitize
  (or sanitize against the Zen ids too).
- **The SP1 save code keys pictures by place** (`encode`/`decode`: "pictures by Gallery place"). An SP1 code made on
  v5.4 decoded here credits whatever now sits in that place (v5 place 1 Pizza Slice would credit Goblin's Lunch). I did
  not change it (lane B's SP2). Lane B's SP1 decode must map places through the v5.4 list: `quests.json v5Places` (the 72
  ids in v5 order) is there for it.

### 4.4 The long tail

v5's long tail was pictures 51-60 (after 203-240). 6 of them are among the 24 kept (Plumed Helm, Sheep Knight, Sword in
the Stone, Party Slime, Wise Old Owl, the Hoard) and now sit inside 4-200; the other 4 (Rainbow, Jack-o'-Lantern, Apples
and Primroses, Sunflower) go to Zen. So the campaign has **no long tail**: `journey.js tail` returns no ids, the fog node
never shows. The mechanism is untouched (lane B/E's call). Tests: test.js runs the long tail's checks on v5's shape (the
50 plus 10 stand-ins after 203-240, `tailGal`) and adds "the castle has no long tail"; the selfTest's long-tail block
checks the empty case when there is nothing past the last level, and v5.1's "next node after the win" accepts no node
when every level is cleared and nothing waits in the fog (2 small selfTest edits in main.js, nothing else in the page).
With nothing past the last level, the fog node simply stays hidden.

### 4.5 Other files touched

- `tools/test.js`: tags read quests.json (new) or the frozen tag (kept); the mix over 50; the Gallery invariants allow a
  new quest's planned features and the outlined kind's floors (minDE 20, faded 16); quests = questsOf(50); the long tail
  on stand-ins; the freeze line split: levels 1-200 byte for byte as before, pictures: the 24 kept byte for byte but n and
  quest, the 26 ids new.
- `tools/critic-v5/diff.mjs`: a campaign quest's tag is its quests.json plan or the frozen one.
- `tools/harness.mjs`: the "locked quest among the first 25" now looks for a painting or a new quest (no painting left).
- No cache-tag bump (lane E bumps at ship; serve.py sends no-store). `levels/levels.json`, `src/engine.js`,
  `tools/ref.js` and the map code untouched.

### 4.6 Measurements

- `tools/quest-bake.js check`: PASS, 9 gates (real pace median 195 s, 160-263 s; taps 34-55; longest tap <= 15 s; 23 of
  26 ringed; re-grade 0 of 300 checks).
- test.js 665/0; `regrade.js` 0 differences of 1,605 checks (250 levels); `regrade.js --gallery` 0 differences of 372 checks (62 pictures); `freeze.js
  --require` PASS (1,155 + 360 checks, 283 castle cases); critic-v5 0 mismatching games of 10,527, 0 grade mismatches,
  tag problems 0, known answers 0 wrong, real pace 312/312.
- selfTest 903/0 (375x812@3) and 905/0 (1280x720), 0 console messages. Before: 919/0 and 921/0; the drop is the long-tail
  block (16 checks) becoming one check.
- Real browser (`tools/shots-campaign-quests.mjs`, port 8511): 16/16 ok at 1280x720 and 375x812: realms 1, 4 and 8 show 6,
  6 and 7 quest nodes, each with its prize icon and words, the open ones with the prize bubble; cq06 Goblin Soup (moat,
  linked; 47 real taps) and cq12 Spell-Book Cat (Hard: moat, ? cards, linked, colour lock; 37 real taps) played from
  their nodes to "Picture complete!", the prize toast ("Side quest prize: +1 Ladder" / "+1 Scout") and +1 once; Back to
  map shows the node won; a replay pays nothing. 0 console messages. Contact sheet: `tools/shots-campaign-v6/quests-50.jpg`.

### 4.7 The 50

| # | Id | Title | After | Prize | Tag | Kept/new | Features | Rate | Real pace | Taps |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | g-ours-g01 | Goblin's Lunch | 4 | ladder | easy | kept | - | 0.685 | 200 s | 44 |
| 2 | g-ours-cq17 | Tree Giant | 8 | ladder | normal | new | - | 0.5425 | 225 s | 51 |
| 3 | g-ours-g12 | Duck Knight | 11 | ladder | normal | kept | - | 0.7225 | 195 s | 50 |
| 4 | g-ours-cq42 | Bagpipes | 16 | ladder | normal | new | - | 0.5475 | 218 s | 53 |
| 5 | g-ours-g21 | Party Slime | 20 | ladder | normal | kept | - | 0.7175 | 177 s | 34 |
| 6 | g-ours-cq20 | Trusty Steed | 24 | quartermaster | normal | new | - | 0.54 | 205 s | 49 |
| 7 | g-ours-g15 | Happy Potion | 27 | ladder | normal | kept | - | 0.685 | 203 s | 34 |
| 8 | g-ours-cq08 | Baby Griffin | 32 | quartermaster | normal | new | moat | 0.6 | 166 s | 39 |
| 9 | g-ours-g23 | Sheep Knight | 36 | ladder | easy | kept | - | 0.69 | 195 s | 40 |
| 10 | g-ours-cq33 | Siege Tower | 40 | quartermaster | easy | new | moat | 0.7775 | 160 s | 42 |
| 11 | g-ours-g13 | Mimic | 43 | ladder | hard | kept | - | 0.24 | 178 s | 43 |
| 12 | g-ours-cq37 | The Forge | 48 | quartermaster | normal | new | moat | 0.5125 | 181 s | 48 |
| 13 | g-ours-g02 | Sir Whiskers | 52 | ladder | normal | kept | - | 0.605 | 203 s | 45 |
| 14 | g-ours-cq28 | Big Bow | 56 | quartermaster | hard | new | moat, lock | 0.1625 | 198 s | 50 |
| 15 | g-ours-g11 | Melon Catapult | 59 | recall | normal | kept | - | 0.6025 | 194 s | 40 |
| 16 | g-ours-cq21 | Round Shield | 64 | ladder | normal | new | moat (mire) | 0.3575 | 200 s | 45 |
| 17 | g-ours-g06 | Wise Old Owl | 68 | quartermaster | hard | kept | - | 0.13 | 194 s | 41 |
| 18 | g-ours-cq02 | Helmet Bed | 72 | recall | normal | new | moat | 0.335 | 191 s | 49 |
| 19 | g-tw-1f451 | Crown | 75 | ladder | easy | kept | - | 0.6475 | 247 s | 55 |
| 20 | g-ours-cq34 | Ballista | 80 | quartermaster | hard | new | moat, linked, lock | 0.23 | 195 s | 45 |
| 21 | g-ours-g19 | Hatchling | 84 | recall | normal | kept | - | 0.59 | 178 s | 50 |
| 22 | g-ours-cq06 | Goblin Soup | 88 | ladder | normal | new | moat, linked | 0.4 | 177 s | 47 |
| 23 | g-ours-g09 | Night Watch | 91 | quartermaster | hard | kept | - | 0.2075 | 200 s | 48 |
| 24 | g-ours-cq24 | The Charge | 96 | recall | normal | new | moat, linked | 0.41 | 208 s | 44 |
| 25 | g-ours-cq29 | Drummer Boy | 100 | ladder | easy | new | moat (mire) | 0.7275 | 194 s | 44 |
| 26 | g-ours-g10 | Crown Too Big | 104 | quartermaster | normal | kept | - | 0.535 | 195 s | 48 |
| 27 | g-ours-cq12 | Spell-Book Cat | 107 | scout | hard | new | moat, mystery, linked, lock | 0.1525 | 216 s | 37 |
| 28 | g-ours-g08 | Iron Pig | 112 | recall | easy | kept | - | 0.7125 | 205 s | 44 |
| 29 | g-ours-cq38 | The Jester | 116 | ladder | normal | new | moat, linked | 0.375 | 189 s | 46 |
| 30 | g-tw-1f984 | Unicorn | 120 | quartermaster | hard | kept | - | 0.225 | 195 s | 55 |
| 31 | g-ours-cq25 | Sun Shield | 123 | scout | normal | new | moat, mystery (mire) | 0.3975 | 190 s | 39 |
| 32 | g-tw-1f3f0 | Castle | 128 | recall | normal | kept | - | 0.465 | 217 s | 47 |
| 33 | g-ours-cq18 | Dragon Picnic | 132 | ladder | hard | new | moat, mystery, linked, lock | 0.17 | 189 s | 43 |
| 34 | g-ours-g18 | The Sapper | 136 | quartermaster | normal | kept | - | 0.5125 | 195 s | 47 |
| 35 | g-ours-cq13 | Raven Messenger | 139 | scout | normal | new | moat, mystery | 0.305 | 180 s | 52 |
| 36 | g-ours-g16 | Mushroom House | 144 | recall | hard | kept | - | 0.2925 | 175 s | 44 |
| 37 | g-ours-cq30 | Shield Wall | 148 | volley | normal | new | moat, linked | 0.2775 | 164 s | 44 |
| 38 | g-noto-1f432 | Dragon | 152 | ladder | normal | kept | - | 0.5675 | 199 s | 51 |
| 39 | g-ours-cq01 | Apple Goblin | 155 | quartermaster | hard | new | moat, hidden, mystery, lock | 0.1825 | 193 s | 55 |
| 40 | g-ours-g22 | Plumed Helm | 160 | scout | normal | kept | - | 0.45 | 191 s | 39 |
| 41 | g-ours-cq09 | Bridge Troll | 164 | recall | normal | new | moat, linked | 0.3475 | 229 s | 52 |
| 42 | g-ours-g07 | Cake Castle | 168 | ladder | hard | kept | - | 0.205 | 186 s | 43 |
| 43 | g-ours-cq11 | Knitting Dragon | 171 | volley | normal | new | moat, mystery | 0.3025 | 263 s | 47 |
| 44 | g-ours-g20 | Sword in the Stone | 176 | quartermaster | normal | kept | - | 0.3875 | 196 s | 43 |
| 45 | g-ours-cq04 | War Drum | 180 | scout | hard | new | moat, hidden, mystery, lock | 0.125 | 203 s | 48 |
| 46 | g-ours-g04 | Frog Prince | 184 | recall | normal | kept | - | 0.3175 | 206 s | 45 |
| 47 | g-ours-cq26 | Bullseye | 187 | ladder | normal | new | moat, mystery | 0.285 | 190 s | 48 |
| 48 | g-ours-cq03 | The Big Key | 192 | quartermaster | hard | new | moat, hidden, mystery, lock (mire) | 0.095 | 205 s | 49 |
| 49 | g-ours-cq10 | Birthday Dragon | 196 | volley | normal | new | moat, mystery | 0.33 | 190 s | 39 |
| 50 | g-ours-g24 | Goblin King's Hoard | 200 | scout | hard | kept | - | 0.1625 | 172 s | 40 |

### 4.8 For lane B and E

- Lane B's migration: read the 36's clears (ids in `quests.json v5Places` not in the 50) from the raw save before
  `sanitize` drops them; SP1 codes decode pictures by v5 place through `v5Places`.
- The wander pictures sit in places 51-62 with `n` 61-72; if lane B moves them to Zen, the castle file ends at 50.
- `tools/land.js` reads `gal0 = gallery.levels.length` for a new land's side-quest numbering when its scratch state has
  none: a land planned on this branch would number its side quests from 63, which collides with the wander pictures' n 63-72. Land 1 itself is unaffected (installed); lane B/D should number Zen worlds' quests in their own files.
- Weak picks lane C flagged and kept: Apple Goblin, Baby Griffin, Bridge Troll, Birthday Dragon, Trusty Steed, Round
  Shield. Spares (cq14 Baby Phoenix, cq16 Cheeky Gargoyle, cq35 Party Cannon) are in the manifest with `spare: true`; a
  swap is one line in quests.json and `quest-bake.js convert bake --only cqNN install check`.

## 6. The fix pass after the critic round: page and quests (lane A), 2026-10-07

Branch `campaign-v6-ui` (worktree `repos/games-sappers-campaign-ui/`, cut from `campaign-v6` at 2474574); a parallel
builder owns the levels, engine and configs in `repos/games-sappers-campaign/`. This section is separate from §5 so the
two merge cleanly. Sources: `tools/critic-campaign-v6-visual.md` (S2-S5, m1, m2, m5) and the functional critic's minors
(on the other branch). SPEC-v4 §9 "Campaign v6 fix pass (page and quests)". Untouched here: `levels/levels.json`, the
engine, `tools/ref.js`, the bake configs and `config.json`.

### 6.1 What shipped

| Fix | How | Files |
|---|---|---|
| S2 pinned in the line | A squad with a pinned sapper takes class `pinned`: red hatch at 45° (stuck's is 135°), a red rim, and its top-left badge turns into a red arrow badge with the number pinned (the walking triangle and gold rim stay only if others still walk). The head counts it apart: "1 stuck · 1 pinned · 3 free" (`readLine` li.pin; config's existing `pinnedWord`). `H.hit` and `H.tower` mark the line moved, so the badge lands with the arrow and clears with the tower. | main.js, style.css |
| S5 start toast over the line | `toast(text, bad, board)`: the pin and kill start toasts pass `board`, so on a wide screen they sit at the board's foot (as on a phone) instead of over the side column's tray, where they covered the line and the cards. Refusal toasts keep their tray spot (v4.3 m2). | main.js |
| S3, S4 three quest pictures | cq13 Raven Messenger, cq30 Shield Wall and cq42 Bagpipes out; cq14 Baby Phoenix, cq27 Castle Guard and cq36 Royal Roast in, on the same slots (6.2). | quests.json, pictures/manifest.json, gallery.json, map/layout.json, gallery-manifest.json, LICENSES.md, campaign-quests/src |
| m1 range rings | The quiet ring is a red dash 2 CSS px at 0.8 over a dark halo 4 px at 0.4, so it lifts off busy pixel art at 375 px; still a dash, so no block is hidden. The loud ring is unchanged. | board.js, style.css |
| m2 key socket | A key lock's socket (`klock`) moves its padlock left and shows the board's key block beside it: gilt, the key etched in, the dashed cream square the key wears on the board. A colour lock's socket already shows its colour. | main.js, style.css |
| m5 Extreme reads harder | The Extreme pill is gold on near-black with a red inner rim and a gold skull ahead of the word (map, play bar, every Play); an Extreme Play's face is blood red, darker than Hard's. | style.css |
| cq11 Knitting Dragon | Not acted on (the no-IP call is Peter's): an orange upright dragon near a well-known starter-monster silhouette. Flagged for him. | - |

Cache tag `?v=50` (index.html and style.css's font URL). selfTest: +4 checks (the start toast clear of the line and
cards; the pinned space's class, badge and head words; the marker clearing on release; the key socket's mark) and the
Extreme check now wants the skull.

### 6.2 Decisions (mine, inside the brief)

- **The ring numbers live in style.css `:root`** (`--ring-w`, `--ring-a`, `--ring-halo`, `--ring-halo-w`, `--ring-halo-a`),
  read once a level by board.js `ringQuiet` (config `board.ring.quietW`/`quietA` when absent). config.json is the other
  builder's in this pass; **at merge, moving these five into `config.json board.ring` is a one-line change** if the
  orchestrator prefers them there (the code then reads `K.ring` directly).
- **The pinned badge shows the pinned count, not the out count.** A pinned squad whose other sappers still walk keeps the
  gold working rim as well; the head counts it as pinned (a squad is pinned, working or stuck, never two).
- **Which pictures.** Of lane C's three spares only cq14 Baby Phoenix passes the ink-outline rule: cq16 Cheeky Gargoyle has
  isolated black specks in its base and its wall merges into it; cq35 Party Cannon's wheels are a checker of black spokes
  and tan (the broken-black look the critic faulted in cq30), and its outline vanishes on the slate ground. So two come
  from lane C's "maybe" list, as the brief allows: **cq27** (lane C's "Asleep on Duty": the sleep doesn't read, the guard
  does, so retitled **Castle Guard**; solid black outline, ring 112) and **cq36 Royal Roast** (the cook melts into the
  ground; the roast on its silver platter reads; solid outline). Lane C's other options failed on reading or on the floors:
  cq22 Fanfare, cq23 Brave Sir Squeak and cq41 The Squire miss the faded floor (15.6, 14.9, 13.4 < 16); cq05 Slingshot
  reads close to a well-known green film sage (IP); cq07, cq31, cq32 don't read.
- **Layout (no two neighbours of one group).** Slot 4 (after 16, between knight and creature) takes the castle-life Royal
  Roast; slot 35 (after 139, between goblin and castle) the creature Baby Phoenix; slot 37 (after 148, between castle and
  creature) the soldier Castle Guard. Groups per slot unchanged (castle, creature, soldier), so the 50's group counts are
  the same.
- **Same slot, same rules.** Each bakes on its slot with `quest-bake.js` (planOf: the slot's ladder, the tag's density and
  deck, the band by `after`), seed 300000 + cq number. Tags stay Normal; prizes stay (ladder 16, scout 139, volley 148).
  Features: Royal Roast none (the slot is before moats, as Bagpipes); Castle Guard moat + linked (as Shield Wall);
  Baby Phoenix ? cards + linked: its slate ground can't carry a ring (lane C), so the slot's moat goes to the next deck
  feature, still Normal's two. The Raven had moat + ? cards.
- **Ids:** g-ours-cq14, g-ours-cq27, g-ours-cq36 are new; g-ours-cq13/30/42 are retired, never reused. Their manifest
  lines stay (marked `dropped` in `tools/campaign-quests/pictures/manifest.json`), their sources stay, and LICENSES.md's
  section is rewritten by install (the three new lines in their places).
- **Saves:** no save can hold a clear of the three dropped ids except a test save of this unreleased branch; `sanitize`
  drops it. Nothing to migrate.

### 6.3 Measurements

- Boards: the three converted from the stored sources are identical to lane C's shaded boards (grid and palette); the 23
  other boards in the scratch are byte-identical before and after `convert --force`.
- Bake (first pick each, 0 fallbacks): 4 cq36 Normal [] rate 0.5575 in 0.46-0.64, real pace 264 s, 49 taps; 35 cq14
  Normal [mystery, linked] 0.32 in 0.2-0.4, 172 s, 38 taps; 37 cq27 Normal [moat, linked] 0.265 in 0.2-0.4, 161 s, 35 taps.
- gallery.json: exactly the three records at places 4, 35 and 37 changed; the 47 others and the Wandering Gallery's 12
  byte-identical.
- `quest-bake.js check` PASS (9 gates; taps 34-55, pace 160-264 s, median 195 s; 22 of 26 ringed).
- The start toast's overlap with the line and the cards, before -> after: 1280x720 17,157 px² on 64 and on 157 -> 0;
  375x812 and 400x600 0 -> 0.
- The pinned badge, before -> after (css px): 12.4x17 triangle "1" -> 25.6x17 red arrow badge at 1280; 11.8x14 -> 22.1x14 at
  375; 11.4x12 -> 19.8x12 at 400x600. The key socket's mark: 27, 22 and 16 px square at the three sizes.

### 6.4 Checks

- `tools/test.js` 665 passed, 0 failed. `tools/regrade.js --gallery` 0 differences of 372 checks (62 pictures);
  `tools/regrade.js` 0 of 2,205 (250 levels); `levels/levels.json` unchanged. `tools/freeze.js --require` PASS (levels
  1,155 checks incl. 201-250 byte-identical, gallery 360, castles 283; the Wandering Gallery's 12 records unchanged).
- critic-v5 (`tools/critic-v5/run.sh`): 0 mismatching games of 10,527 (319 levels), grade, tag and format problems 0,
  known answers 0 wrong, real pace 312/312. Its `diff-result.json` is not committed here (it only reorders; the merge
  regenerates it).
- selfTest (`tools/selftest-lands.mjs --url http://127.0.0.1:8473/`): 920/0 at 375x812 3x, 922/0 at 1280x720, 0 console
  messages (was 916/918: +4 checks).
- Harness (`tools/harness.mjs`): all passed; selfTest 920/0 at 375x812, 375x667, 414x736, 360x740, the 400x600 iframe
  and the hidden tab, 922/0 at 812x375 and 1280x720; 0 console messages.
- Real taps (`tools/shots-campaign-v6-fix.mjs after`, port 8473): 48/48 at 1280x720 mouse, 375x812 3x touch and 400x600,
  0 console messages: 64 and 157 opened from their map nodes; 64's start toast 0 px² over the line and cards at all three
  sizes (before: 17,157 px² at 1280x720); a pin by 11 real taps, the pinned space hatched with the arrow badge, the head
  "1 stuck · 1 pinned · 3 free"; the tower falls, the marker and count clear, 39 more taps win; 157's toast 0 px²
  (before 17,157 at 1280), the key socket's mark (27, 22, 16 px), 44 real taps open each socket and win; cq14, cq27 and
  cq36 won from their map nodes by 38, 35 and 49 real taps ("Picture complete!", the prize +1 once), their nodes then show
  won. The before run (`before`, the base at 2474574 served from a git archive): 37/39, the two desktop toast overlaps.
- Shots (gitignored as every `tools/shots-*/`): `tools/shots-campaign-v6-fix/before/` and `after/` (64 start, pinned,
  pinned line, released; 157 start, line, chip, unlocks; 74 and 91 rings; map realms 7 and 8; quests), each with run.json;
  `tools/shots-campaign-v6/quests-50.jpg` (`python3 tools/quest-sheet.py`), the 50 with the three new.

### 6.5 For the merge and the critics

- **Touches outside this lane's usual files:** `map/layout.json` (quest-bake install: three quest ids) and
  `index.html` (the cache tag, `?v=50`). Nothing in config.json; if the other builder also bumps to `?v=50`, the lines
  are identical.
- **SPEC-v4 §9 and v5-progress.md** get appends at their ends; if the other branch appends too, keep both (order free).
- The five ring numbers sit in style.css (6.2); move to `config.json board.ring` at merge if preferred.
- Still open from the visual critic, not in this brief: S1 (painted tower colours 104, 117, 198: the other builder's),
  m3 (the short sheet's black chip), m4 (coach and toast say the same on 64 and 66 at phone), m6 cq12 Spell-Book Cat,
  the weaker pictures cq26, cq21, cq02 (Peter's call), and cq11 Knitting Dragon's IP closeness (Peter's call).
