#!/bin/zsh
# Critic v4.3 re-run. ./tools/critic-v4.3/run.sh        rules diff + known answers + real pace (about 1.5 min)
#                     ./tools/critic-v4.3/run.sh --browser  also the browser pass (own server on 8492, stopped after)
cd "$(dirname "$0")/../.." || exit 1
N=~/.local/opt/node/bin/node
$N tools/critic-v4.3/diff.mjs --patient 8 --rushed 8 --power 16 | grep -v '^park limits' && $N tools/critic-v4.3/edge.mjs && $N tools/critic-v4.3/pace.mjs || exit 1
if [[ "$1" == "--browser" ]]; then
  nohup python3 ~/Documents/Claude/.claude/serve.py 8492 "$(cd .. && pwd)" > /dev/null 2>&1 &
  sleep 1
  PLAYWRIGHT_MODULE=$(~/.local/opt/node/bin/npm root -g)/playwright/index.mjs $N tools/critic-v4.3/play.mjs
  lsof -ti tcp:8492 | xargs kill
fi
