# Sapper's Path v5.3: the home's painted siege

Peter, 2026-10-06: "s23 is the winner, use it for both desktop and mobile, and crop it to fit a mobile screen." Also fix the
home scene drifting off-centre on medium-wide windows. SPEC-v4 §9 has the decision entry.

## The art

- Source: `/Users/peter/local-ai/outputs/sapper-card/home-h-s23.png`, 1344x768, SDXL base 1.0 text-to-image
  (`sapper_card.py --variant h --seed 23 --w 1344 --h 768`). Content untouched. No new generation was run.
- `tools/home-art.py` (PIL in `/Users/peter/local-ai/.venv`): Lanczos 2x to 2688x1536 plus UnsharpMask(radius 2,
  percent 60, threshold 2); master saved beside the source as `home-h-s23-2x.png` (not in the repo). No img2img pass:
  the Lanczos master held up at phone 3x and 1920 wide in the shots, and it cannot move the composition.
- Castle centre: the keep, walls from x 697 to 858 in the source, centre 778 (0.5789 of the width). The keep is the
  visual anchor; the curtain wall runs off the right edge, so a "whole castle" midpoint would sit far right.
- Exports (progressive JPEG, 4:2:0, highest quality under 450 KB):
  - `art/home-wide.jpg` 1920x1097, quality 90, 436,886 B (the whole painting; castleX 0.5789)
  - `art/home-tall.jpg` 1080x1920, quality 92, 385,620 B (9:16 of the full height, source x 562-994; castleX 0.5)
- `index.html`: `<picture>` with `<source media="(orientation: portrait)">` for the tall one and the wide `<img>`
  otherwise, so one device class downloads one image. Harness checks one art request per load, of the right kind.

## The bug

`paintTitle()` sized the pixel canvas to `window.innerWidth/innerHeight` and drew the castle at the canvas's middle. The
home (`#title`) is absolutely positioned inside `#app`, which is a 560 px column unless the window is "wide"
(layout.wideMinPx 760 and aspect 1.15). So on a window that is wide-ish but not wide (portrait tablets, narrow desktop
windows) the canvas was window-wide, anchored at the column's left, and the castle landed at the window's centre: right of
the column's centre and clipped. Narrow windows (column = window) and wide windows (no column) looked right.

Fix: the painting is `position: absolute; inset: 0` inside `#title` with `object-fit: cover`, so it is sized by the box,
never the window. `main.js fitTitle()` (on showing the home, on resize, on the image's load) computes the cover scale from
the box and config `title.art[k]` and sets `--art-x` so the castle sits at the box's centre, clamped so the image always
covers. `homeArt()` returns the geometry; `SP.homeArt()` exposes it.

## Castle centre, measured (tools/shots-v5-3-home.mjs; share of the home box's width)

- Portrait and column boxes (320-768 at 800 and 812 tall, 1024 and 1143 wide windows): 0.0%.
- 1280x800 3.9%, 1366x800 6.8%, 1366x768 7.9%, 1920x1080 7.9%, landscape phones 0.6-7.9%.
- The 7.9% cases are boxes as wide as the painting's aspect or wider: no horizontal slack, so the painting's own
  composition (keep at 58%) shows. Limit `title.art.maxOff` 0.1. Zooming in to centre it would cost sky; not done.

## Over the painting

- `#title` background: a sky-to-field gradient sampled from the painting (#8e8d84, #6c624a, #534a34); the image fades in
  over .6 s on load (none under reduced motion).
- Shades: top 30% from rgba(20,16,28,.5) to clear; foot 42% from clear to .6. Enough for the logo (ink outline) over the keep.
- Realm line: off the river (gone) into `.home-foot` above Play, on its solid `--bg` chip, 22 px. Contrast (selfTest,
  backing judged on white as the worst case): realm line and pills all well over 4.5:1.
- Dropped: `Art.title` (the pixel castle, the four crews and the goblin on the keep, the iced river), `--river-y`, the
  selfTest's river check, config `title.artW/artH/artMin/artMax/baseFrac/baseFracWide`, `app.lastW/lastH`. Kept
  `title.wallArtPx` (the brick texture). The pixel figures would read as stickers on an oil painting.

## Bytes to the home's first paint (all responses until the home shows and its painting has loaded, ?debug=1)

- Before (v5.2): 1,774,147 B at every size.
- After: phone 375x812@3 2,162,227 B (+388,080, the tall JPEG); desktop 1280x720 and 1920x1080 2,213,493 B
  (+439,346, the wide JPEG). Both under the ~450 KB budget for one device class.

## Checks

- selfTest: the realm line clear of the logo, pills and buttons, inside the box, 4.5:1 or more with the pills; the
  painting covers `#title`'s box exactly and the castle is within maxOff of its centre; `--art-x` matches the geometry.
- harness: per viewport, the painting fades in with one art request of the right kind (before the bytes count); a sweep
  of `title.art.widths` at 812 (touch) and 800 tall plus six landscape phones, each within maxOff and covering the box.
- Shots: `tools/shots-v5-3-home/` (gitignored): 375x812 3x, 414x896, 768x1024, 1143x800, 1366x768, 1920x1080, and
  812x375 as a short desktop window (a phone held sideways shows the upright card, as before).
- Results are in the commit messages and the orchestrator report.
