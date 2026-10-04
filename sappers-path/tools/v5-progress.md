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
| 4 | Continue on a jam (250 coins, once per attempt, ad hook) | done | (this commit) |
| 5 | Quartermaster rework (any visible card straight out) | todo | |
| 6 | Volley power-up (clear one colour) | todo | |
| 7 | Speed: 1x, 2x bought per round, 3x debug only | todo | |
| 8 | Power-up unlocks, free first use, tooltips | todo | |
| 9 | Mystery blocks (hidden board pixels) | todo | |
| 10 | Extreme tag (data, display, coins) | todo | |
| 11 | Freeze test (tool + fixture) | todo | |
| 12 | SPEC-v4 §9 v5 R1 entry, `tools/v5-r1-notes.md`, cache tag `?v=30`, harness and selfTest pass | todo | |
