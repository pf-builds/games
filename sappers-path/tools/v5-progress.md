# Sapper's Path v5 R1: progress checklist

The rules engine batch (rules and meta only; levels are re-laid in R2). Source of every decision:
`claude-workspace/business/D-click-it-studios/game-research/sappers-path-v4/rules-review.md`. Worktree
`repos/games-sappers-path/` (branch `sappers-path`), game in `sappers-path/`. Never push.

## How to resume

1. Read this file, then `tools/v5-r1-notes.md` (rules as built, decisions) and the SPEC-v4 §9 v5 R1 entry.
2. `git log --oneline` on the branch: every finished piece is its own commit "Sapper's Path v5 R1: <piece>".
3. Take the first piece below that is not `done`. Engine + `tools/ref.js` + `tools/test.js` first, then the page.
4. Checks: `~/.local/opt/node/bin/node tools/test.js` (level-data checks that need R2's re-lay print as DEFERRED, they
   are switched by `config.json` `v5.relaid`, false until R2), `SP.selfTest()` under `?debug=1` on
   http://127.0.0.1:8491/sappers-path/ (same switch), `node tools/harness.mjs`. Dev server:
   `nohup python3 ~/Documents/Claude/.claude/serve.py 8491 /Users/peter/Documents/Claude/business/D-click-it-studios/repos/games-sappers-path > /dev/null 2>&1 &`
5. Update the table and commit this file after each piece.

## Pieces

| # | Piece | State | Commit |
|---|---|---|---|
| 0 | Deferral switch (`v5.relaid`), this file | done | with 1 |
| 1 | 5 holding spaces on every level | done | 1b115ed |
| 2 | Archers never kill (no short fail, no kill path) | done | fe49b1e |
| 3 | Hard locks: key lock and colour lock | done | 10c98ac |
| 4 | Continue on a jam (250 coins, once per attempt, ad hook) | done | b5fa12d |
| 5 | Quartermaster rework (any visible card straight out) | done | 60c6770 |
| 6 | Volley power-up (clear one colour) | done | 180e37c |
| 7 | Speed: 1x, 2x bought per round, 3x debug only | done | 507bff8 |
| 8 | Power-up unlocks, free first use, tooltips | done | fd15383 |
| 9 | Mystery blocks (hidden board pixels) | done | 0775b71 |
| 10 | Extreme tag (data, display, coins) | done | 1d9ba42 |
| 11 | Freeze test (tool + fixture) | done | fed5164 |
| 12 | SPEC-v4 §9 v5 R1 entry, `tools/v5-r1-notes.md`, cache tag `?v=30`, harness and selfTest pass | done | (this commit) |

## State

R1 complete. Next is R2 (re-lay 1-100); its to-do list is `tools/v5-r1-notes.md` §5.

# R2: re-lay levels 1-100 and the 60 pictures (2026-10-04)

Source: the rules review's "Confirmed", "The feature ladder", "Tags mean how many features a level uses", "Reuse map",
"Build order", and `tools/v5-r1-notes.md` §5. Notes: `tools/v5-r2-notes.md`; per-level table `tools/v5-r2-relay.md`.

## How to resume (R2)

1. Read this section, then `tools/v5-r2-notes.md` (decisions so far) and `git log --oneline` (each piece is its own
   commit "Sapper's Path v5 R2: <piece>").
2. Take the first piece below that is not `done`. Bakes write to the scratchpad first (`--out DIR`) and are copied into
   `levels/` only after their checks pass; never leave `levels/` half-written between commits.
3. Checks as R1 (`tools/test.js`, `SP.selfTest()` under `?debug=1`, `tools/harness.mjs`), plus `tools/regrade.js`,
   `tools/regrade.js --gallery` and, after the close-out, `tools/freeze.js --require`.

## Pieces

| # | Piece | State | Commit |
|---|---|---|---|
| 0 | Harness on R1's head before any change | done: all passed, 3:24 wall (no timeout; see notes §0) | (this file) |
| 1 | Realms and tags in data (bake-config realms, tags.js realm-relative cycle, density rule, dealer settings) | done | (see git log) |
| 2 | The re-lay tool (`tools/relay.js`: the slot map, board and deck edits) and the bake's `--relay` mode (kept deck first) | done (also gallery-bake `--keep`, quests.js, critic-v5) | e71ee6f |
| 3 | Teaching levels 1, 2, 3, 25, 50, 75, 100 (teach-v4.js on the re-laid boards; coach lines) | done | (with 4) |
| 4 | Siege bake 1-100 under v5 (scratch, checked, copied in) | done: kept 28, tuned 25, dealt 37, new board 3; 0 fallbacks; regrade 0 | (this commit) |
| 5 | Gallery re-grade under v5, re-deal failures; side-quest slots and prizes; interim Gallery unlocks | done: kept 42, tuned 14, dealt 4; regrade 0 | (this commit) |
| 6 | Lore swap (realm names and lore in config; no real-world history) | done | (this commit) |
| 7 | Page: realms on the map, coach lines, texts (5 spaces, no kills) | done (text pass on any leftover 6/4-space lines in 8) | (this commit) |
| 8 | Close-out: `v5.relaid: true`, regrades 0, freeze snapshot, critic-v5 rules, tests, selfTest, harness, `?v=31`, SPEC, notes, screenshots | done | (this commit) |

### State
R2 complete. Levels, teaching, Gallery and page work landed together; close-out checks all pass (see `tools/v5-r2-notes.md` §8). Next is R3 (the journey map; `tools/v5-r2-notes.md` §10).
