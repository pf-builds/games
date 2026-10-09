# Sapper's Path v7 lane T (space budget): visual critic

2026-10-09. Build space-v7 @ 0907f41 (served 8483) against base a11e9bf = v6.3 (git archive, served 8484). Headless
Playwright (Chromium), 375x812 DPR 3 (mobile, touch) and 1280x800 DPR 1. Pixel work in PIL/numpy. Builder's own crops
and seams were not used. Evidence images: `tools/critic-space-v7-visual/`.

**Verdict: no blocking or should-fix visual regressions. The WebP sheets are indistinguishable from the JPEGs at 1:1 and
2x; every sheet join, both sizes, matches base; Zen is pixel-identical to base. Two MINOR notes on the new loading toast.**

## BLOCKING
None.

## SHOULD-FIX
None.

## MINOR
1. **The loading and fail toasts sit far from the thing tapped, and the tapped card gives no busy state.** Repro: fresh
   profile, delay `levels/zen-1.pk.json` 2.5 s, tap the home Zen card (or the Zen map's "Play picture 1"). After 300 ms
   "Opening World 1..." appears at the top centre (box x114 y132 147x38 at 375 wide; x567 y132 at 1280). The thumb is at
   the bottom (Zen card y610-728; map Play y742 on mobile, right column on desktop) and the card itself does not change.
   On a slow portal connection a player may tap again before noticing. Readable and on-voice otherwise (contrast about
   14:1, cream box, the game's own toast). Evidence: `tools/critic-space-v7-visual/zen-loading-m.png` (panels 1-2), `tools/critic-space-v7-visual/zen-loading-d.png`.
2. **The fail line is up for the standard 2.4 s (config show.toastMs) but is 10 words over 3 lines on mobile**
   (box 188x80 at 375 wide). Gone by 4 s (measured). Short for a sentence that asks the player to do something; a longer
   time for "bad" toasts, or 2 lines, would help. Wording itself is plain and fine. Evidence: `tools/critic-space-v7-visual/zen-loading-m.png`
   (panels 3-4), `tools/critic-space-v7-visual/zen-loading-d.png` (panels 3-4).
3. Note, not a finding: `tools/map-gen/retouch-25.py` and `tools/map-gen/README.md` still describe `sheet-25.jpg`
   (history-only tool, not shipped).

## 1. Castle sheets, JPEG vs WebP (all 25)

Method: decode both with PIL, full-sheet PSNR, max channel difference, 99.9th percentile, the worst 32x32 block, the
mean RGB shift, and a max-diff x8 heatmap per sheet (`tools/critic-space-v7-visual/heat-NN.png`; data `tools/critic-space-v7-visual/metrics.json`). Same size
(768x1344) for every pair; both were already 4:2:0 chroma, so no new chroma loss on thin coloured ink.

| Sheet | JPEG KB | WebP KB | PSNR dB | Max ch diff | 99.9% diff | Worst 32px block PSNR @ | Mean RGB shift | Join s/s+1 step base→new (375@3 / 1280) |
|---|---:|---:|---:|---:|---:|---|---|---|
| 01 | 282 | 233 | 43.31 | 16 | 8 | 40.6 @(672, 672) | [0.05, 0.14, -0.03] | 3.9→3.8 / 13.5→13.5 |
| 02 | 265 | 219 | 43.82 | 13 | 8 | 40.1 @(736, 1184) | [0.03, 0.14, 0.0] | 2.9→2.9 / 12.8→12.8 |
| 03 | 272 | 227 | 43.99 | 12 | 7 | 40.6 @(736, 1184) | [0.03, 0.16, -0.08] | 10.7→10.7 / 4.7→4.8 |
| 04 | 277 | 224 | 43.23 | 12 | 8 | 40.1 @(640, 64) | [0.03, 0.12, 0.16] | 0.7→0.7 / 12.7→12.7 |
| 05 | 275 | 233 | 43.57 | 12 | 7 | 40.8 @(544, 1152) | [0.04, 0.13, 0.09] | 0.7→0.6 / 13.4→13.4 |
| 06 | 251 | 237 | 45.2 | 10 | 6 | 42.2 @(96, 384) | [0.07, 0.1, 0.16] | 11.4→11.4 / 13.5→13.5 |
| 07 | 304 | 231 | 42.31 | 14 | 8 | 39.2 @(384, 864) | [-0.01, 0.17, -0.06] | 3.8→3.8 / 13.5→13.5 |
| 08 | 312 | 247 | 42.24 | 14 | 8 | 39.3 @(384, 288) | [-0.01, 0.16, -0.03] | 3.7→3.7 / 14.9→14.9 |
| 09 | 294 | 227 | 42.33 | 13 | 8 | 39.3 @(544, 416) | [0.01, 0.17, -0.07] | 2.5→2.5 / 13.9→13.9 |
| 10 | 294 | 219 | 42.3 | 16 | 8 | 38.9 @(192, 256) | [0.05, 0.14, -0.01] | 2.0→2.1 / 12.5→12.5 |
| 11 | 299 | 230 | 42.23 | 14 | 8 | 38.8 @(544, 480) | [-0.0, 0.17, -0.0] | 3.0→3.0 / 12.7→12.7 |
| 12 | 268 | 218 | 43.87 | 13 | 7 | 40.9 @(704, 960) | [0.05, 0.13, 0.04] | 10.4→10.4 / 6.3→6.3 |
| 13 | 277 | 238 | 43.58 | 11 | 7 | 41.1 @(480, 224) | [0.07, 0.11, 0.08] | 0.1→0.1 / 12.7→12.7 |
| 14 | 289 | 207 | 42.02 | 14 | 8 | 39.9 @(352, 896) | [-0.03, 0.17, 0.05] | 1.5→1.5 / 15.3→15.3 |
| 15 | 264 | 216 | 43.64 | 11 | 7 | 40.9 @(160, 1216) | [0.07, 0.11, 0.09] | 16.9→16.9 / 3.3→3.3 |
| 16 | 256 | 241 | 44.7 | 15 | 8 | 39.6 @(448, 992) | [0.01, 0.11, 0.12] | 0.8→0.9 / 13.3→13.3 |
| 17 | 272 | 233 | 43.65 | 18 | 8 | 38.2 @(576, 928) | [-0.03, 0.14, -0.0] | 1.9→1.9 / 14.5→14.5 |
| 18 | 259 | 203 | 43.48 | 17 | 9 | 38.5 @(288, 768) | [-0.01, 0.14, 0.02] | 14.0→14.0 / 0.2→0.2 |
| 19 | 299 | 231 | 42.16 | 18 | 8 | 39.3 @(544, 288) | [-0.05, 0.17, -0.04] | 0.4→0.4 / 14.9→14.9 |
| 20 | 296 | 218 | 42.05 | 14 | 8 | 39.9 @(96, 384) | [-0.07, 0.18, 0.0] | 0.2→0.3 / 14.9→14.9 |
| 21 | 300 | 232 | 42.25 | 14 | 8 | 39.0 @(32, 64) | [-0.07, 0.17, -0.0] | 1.4→1.4 / 5.6→5.6 |
| 22 | 286 | 246 | 43.66 | 12 | 7 | 40.6 @(576, 96) | [0.04, 0.11, 0.04] | 0.3→0.3 / 13.3→13.3 |
| 23 | 291 | 237 | 42.7 | 14 | 8 | 39.0 @(256, 896) | [-0.04, 0.16, 0.01] | 0.8→0.8 / 15.3→15.3 |
| 24 | 286 | 219 | 42.77 | 13 | 8 | 39.2 @(544, 320) | [-0.03, 0.16, -0.0] | 0.8→0.9 / 12.0→12.0 |
| 25 | 276 | 224 | 43.78 | 11 | 7 | 41.0 @(192, 256) | [-0.0, 0.14, 0.12] | (top sheet; Goblin King view mean diff 0.83 / 0.32) |

Reading the table: PSNR 42.0-45.2 dB, max channel error 10-18 of 255, 99.9% of pixels within 9. Mean shift is a uniform
+0.1-0.2 in green on every sheet (YUV rounding), far below visibility. No tone or colour shift.

**The 5 worst by my metric** (lowest PSNR: 14, 20, 19; worst block: 17, 18). For each, 128 px regions at 2x nearest,
JPEG | WebP | diff x8, at the worst block, the busiest (edge energy), the darkest and the smoothest gradient:
`tools/critic-space-v7-visual/crop2x-14.png`, `crop2x-17.png`, `crop2x-18.png`, `crop2x-19.png`, `crop2x-20.png`; and 384 px 1:1
side by sides of the busiest region: `crop1x-NN.png`. Inspected 14 and 17 closely:
- 17 (lava realm), worst block: faint ringing round the small orange ember dots, visible only in the x8 diff; at 2x the
  pair cannot be told apart. No halo.
- 14, cross-hatching on the tree and grass, dark green water, smooth parchment: hatching kept line for line, no
  smoothing, no blocking, no banding in the gradient. Diff is uniform grain.
- No sheet is one a sharp eye would notice.

## 2. Campaign map in page (all 24 joins, both sizes)

Fresh profile, Campaign map (?debug=1 on both builds, so the debug row shows on both), the lower edge of sheet s+1's box
centred in the scroller, both images loaded and decoded before the shot. 25 sheet boxes, offsets identical on both builds
(scrollHeight 15,704 mobile, 17,955 desktop); no CSS filter, opacity or blend on any sheet image (no tinting on either
build). Data `tools/critic-space-v7-visual/joins-metrics.json`.

- Whole-view difference base vs new: mean 1.05-1.33 (mobile DPR 3), 0.41-0.52 (desktop) of 255; 99.9th percentile 5-7.
- The step across the seam line (mean luminance 2-12 px above vs below): base and new agree to 0.1 at every join, both
  sizes (table, last column). No new seam, tone step or misalignment anywhere.
- The only pixels over 30 apart (mobile join 2, 51 px) are the animated egg ripples, phase not art.
- Side by sides with diff x8 and the seam marked: `tools/critic-space-v7-visual/seam-m-02.png`, `seam-m-15.png`, `seam-m-20.png`,
  `seam-d-07.png`, `seam-d-24.png`. Goblin King end (top of sheet 25, the fog): `tools/critic-space-v7-visual/goblin-top-m.png`,
  `goblin-top-d.png` (mean diff 0.83 / 0.32, max 9). Realm banners sit on the joins and are in those shots unchanged.
- With Zen on the Campaign map ends at sheet 25, so there is no castle-to-land join (25/26) in play.

## 3. Other places castle sheets appear

grep over src/, index.html, the CSS and level data: the only loader of a map sheet is the journey map (main.js
`"map/" + sh.S.file`). Home art is `art/home-*.jpg` (unchanged); Gallery side quests are picture boards; the tutorial
uses none. Zen worlds' maps load only land sheets (land-01/02/05 a/b, already WebP before v7; confirmed in page from the
image srcs on both builds). No shipped file still names a castle JPEG; `map/*.jpg` is gone.

## 4. Zen

Both builds, both sizes, fresh profile: home, Zen map start, each of the 4 worlds' banners centred, and one level per
world (z1-1, e9-201, z3-1, z4-1 via SP.load, paused). All 20 pairs pixel-identical, except mobile World 4 map (max 6,
mean 0.002: an animated sparkle). Home Zen card identical text and box ("0 of 212 pictures", Picture 1). Data
`tools/critic-space-v7-visual/zen-metrics.json`.

New build only:
- Slow load (route delay 2.5 s on zen-1): no toast at 150 ms; "Opening World 1..." at 1 s, from the home card and from
  the Zen map Play; level 1 (Red Fuji) starts when the records arrive, toast cleared, no flash.
- Failed load (route abort): "Couldn't open World 1. Check the connection and try again." in the game's red-tinted toast,
  the screen stays as it was, gone by 4 s. Console shows only the two ERR_FAILED lines my abort caused.
- Layout jump on arrival: with a Zen-last save (tools/fixtures/v6.2-save.json) and World 4 delayed 2.5 s, the home's
  cards and tiles have the same boxes and text before and after the prefetch lands, both sizes. None.
- Placement and timing: see MINOR 1-2.

## 5. Overall

Nothing a portal reviewer or Peter would see as different or worse than v6.3, apart from the new toast only seen on a
slow or failed fetch. Note that WebP needs Safari 14+, but the land sheets were already WebP, so no new risk.
