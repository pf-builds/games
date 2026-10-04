#!/bin/zsh
# Critic v5 re-run (v5 R2): rules diff + known answers + real pace, against the re-laid levels (about 2 min).
#   ./tools/critic-v5/run.sh
# The v4.3 browser pass (critic-v4.3/play.mjs) checked v4.3's 6/4 spaces and old ids; the v5 critic writes its own.
cd "$(dirname "$0")/../.." || exit 1
N=~/.local/opt/node/bin/node
$N tools/critic-v5/diff.mjs --patient 8 --rushed 8 --power 16 | grep -v '^park limits' && $N tools/critic-v5/edge.mjs && $N tools/critic-v5/pace.mjs || exit 1
