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
