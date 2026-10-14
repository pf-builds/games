#!/bin/zsh
# Sapper's Path lane P Stage 5: re-cut both preview videos so their first frame is the chosen cover (one command).
#   zsh video-cover.sh <option: A-F> <stage5 dir>
# Needs the covers (compose.mjs) and the captured frames (<stage5>/video/frames-land, frames-port; capture.mjs) in place.
# Renders the chosen cover's portrait layout at 1080x1620 (compose.mjs --scale 1.35; D-F use cover-crop.py's
# art-<opt>-port@1080x1620.png, cut from the board at that size), then assemble.py for both videos.
set -e
O=${1:?option A-F}; S=${2:?stage5 dir}; H=${0:A:h}
export PLAYWRIGHT_MODULE=${PLAYWRIGHT_MODULE:-$(npm root -g)/playwright/index.mjs}
node $H/compose.mjs --game $S/game/sappers-path --art $S/covers/src --out $S/video --opts $O --sizes port --scale 1.35
python3 $H/assemble.py $S/covers/cover-$O-land.png $S/video/frames-land $S/video/sappers-path-preview-landscape-1920x1080.mp4
python3 $H/assemble.py $S/video/cover-$O-port@1080x1620.png $S/video/frames-port $S/video/sappers-path-preview-portrait-1080x1620.mp4
