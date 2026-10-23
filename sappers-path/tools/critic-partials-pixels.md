# Critic: Partial's Pixels (branch partials-pixels, 5f86b87 / 0df3e49 / 1b36d36, notes d173c73)

2026-10-22. Single verification pass. Read-only on code. Screens in `tools/critic-partials-pixels/`. My scripts and logs are in the session scratchpad. They're not committed.

## Verdict: FIX FIRST

The mode works end to end. Saves are clean, SP2 is byte for byte, regressions are zero and there are 0 console messages. The art record is exact. Two things block shipping. The portal build includes the mode and fails because of it (Peter's web-only decision). The board draws every one of her pixels as a dark-bordered tile.

## Blockers

**B1. The portal build includes Partial's Pixels and now fails.** I ran `node tools/portal-build.mjs --dirty` on a `git archive HEAD` copy. It fails with `LICENSES.txt names files the build does not hold: pp-001-lighthouse.png` (the copy's git-checkout fails are copy artefacts; e152988 gives only those). The staged build ships `levels/pixels.pk.json` and `levels/pixels-1.pk.json` and `config.pixels`, and LICENSES.txt has 5 PartialVoid lines. So the mode would appear on the portal.
- Good news: the page already handles the mode being absent. In a scratch copy I deleted `config.pixels` and seeded a Pixels save plus a Zen save with `mode: "pixels"`. The card, the map chip and the reset radio were all hidden, selfTest ran 929/0 and there were 0 console messages.
- Fix touches four things:
  - portal-build: drop `pixels` from the config copy.
  - Stop the trace from following `levels/pixels.pk.json` (main.js:151 literal) and add both pixels pk files to `leftOut`.
  - Strip the LICENSES.md Partial's Pixels row (line 25) and the `partials-pixels:start…end` section from LICENSES.txt.
  - Add a build check that no runtime file in the zip names PartialVoid or Partial's Pixels. Optionally strip the hidden `#btn-pixels`, the chip and the radio markup from the index.html copy.

**B2. Every block gets a dark border, which is a shading variant or outline against brief item 1.** I sampled the canvas myself (not with SP.cells()) at level start, no ?debug=1.
- Centre colour matches 1600/1600 at both sizes.
- Exact-colour share per block is 71.4% at 375x812@3 and 78.2% at 1280x800.
- The rest is a seam at about 66% brightness of her colour, plus rounded corners. Examples: #06d6a0 gets #048d6a, #fffcf9 gets #a8a6a4 (grey), #004e39 gets #003326. So 7 colours draw as 14.
- By eye it reads as a tiled mosaic, not her flat drawing. White clouds get a grey grid and the lighthouse stripes look checkered. See `zoom-lighthouse-375.png` and `-1280.png` (her PNG on the left, the board on the right, 12x12 cells).
- The win sheet's picture is drawn flat and looks exactly like her art (`win-375.png`). That shows the board can too.
- The builder kept the seam on purpose (notes §7.1). If Peter accepts it, this drops to MAJOR.
- Fix: when `flatBlocks` is on, fill each intact block as a full square in her hex with no seam and no corner rounding. Players tap cards, not blocks, so block edges aren't needed to play.

## Should-fix

**S1. The map, judged as a long-term state with 1 to 3 pictures, is mostly empty fog.**
- At 375 with 1 picture: node 1 sits at y=596 in a 669 px viewport. About 60% of the screen above it is blank pale fog (`map-375.png`).
- With 3 pictures (scratch install): the nodes sit at y=489–596 and it still looks the same (`grow3-map-375.png`).
- At 1280 the road column is about two-thirds fog (`map-1280.png`).
- Node and banner placement are technically right. The banner sits at the road's start and "More pictures on the way" sits just past the last node.
- But for months it will read as a sparse, unfinished screen.
- Fix: for small counts, size or scroll the sheet to the populated stretch (nodes mid-screen, a short fog band above). Or use the empty fog as a wall of her finished pictures. Keep the tint.

**S2. Pipeline: a clean small picture fails the pace gate with no next step.** My 32x32, 6-colour fixture (pp-002) baked Easy at a real pace of 132 s, under the 150 s floor. The tool printed `FAIL real pace 150-300 s … a gate failed; nothing installed` and nothing else. `tag: "normal"` also failed (138 s). Only `--extra 3` got it in (Easy, 152 s, 33 taps). The runbook doesn't cover gate failures, so someone adding her next small picture gets stuck. Fix: retry with more candidates automatically, or scale the pace band by cell count for this mode, and print the exact next step. Add it to runbook step 5.

## Minors

- **m1. Map banner order.** It reads "BY PARTIALVOID · Partial's Pixels", and the DOM reads "1 BY PARTIALVOID Partial's Pixels". Zen banners put the world (`eye` "World {k}") in the eyebrow, so here the credit takes the slot and comes before the title. Fix: use "Pixel art" or "World 1" as the eyebrow and put the credit after the name. The foot and the 1280 side panel already credit her.
- **m2. Empty "Secrets found" label.** The 1280 left panel shows the label with nothing under it (`map-1280.png`). Hide it or say "none yet" when the mode has no eggs.
- **m3. Merge suggester can leave near-twin colours.** pp-003 (8 colours) got the suggestion #f4d35e→#ffd23f (3.9 ΔE00). It skipped a 1.3 ΔE00 twin pair because one colour sits inside the other. It installed with two colours a player can't tell apart and no warning. Fix: warn when the closest installed pair is under about 10 ΔE00, and treat pairs under about 3 as not a visible shape.
- **m4. Stale suggestion file.** `suggest/pp-003.md` still says "Not installed" after the merge installs. Delete it or mark it approved on install.
- **m5. Preview doesn't mark changed cells.** The before/after image has no marker on the 12 changed cells, so they're hard to spot. Outline them as the crop preview does.
- **m6. Misleading "wrote" on failed runs.** NOT OK runs still print `install: … wrote levels/pixels.pk.json…`. The files are unchanged byte for byte, but it reads like an install. Say "unchanged" when nothing changed.
- **Note: SP2 import clears Pixels progress.** Loading an SP2 code on a device with Pixels progress resets Pixels. That's by design, and the warning sheet lists the current Pixels count. No change needed.

## The four items from the builder's shots

- **(a) "Opens after Fort 5" pill on `home-open-375.png`:** a stale toast. A tap on the locked card shows the toast for 2.1 s at 375 (2.35 s at 1280). The builder's script took that shot 300 ms after the forced tap plus `SP.unlockTo(5)`. In the real flow (Fort 5 won by taps, then Home) there's no toast and the card reads "Picture 1" (`home-open-375.png` in my folder). Not a game bug.
- **(b) Mostly-empty map:** see S1. It isn't broken, but it is sparse long-term.
- **(c) Banner wording:** see m1.
- **(d) Chip:** it reads "Pixels" and fits (54 px at 375 and 74 px at 1280, not clipped). It has `aria-label="Partial's Pixels"` and `aria-pressed="true"` when on, and a visible keyboard focus ring. OK.

## Check table

| Check | Result |
|---|---|
| test.js | 737 passed, 0 failed |
| freeze.js --require | PASS, 0 differences (1006 s) |
| selfTest (selftest-lands.mjs) | 939/0 at 375x812@3, 941/0 at 1280x800, exit 0 |
| harness.mjs | all passed |
| pixels-check.mjs (builder's) | 1600/1600 at both sizes |
| My canvas vs PNG (no debug, centre pixel) | 1600/1600 at 375@3 (25 device px a cell) and 1280 (16 px) |
| Exact-hex share per block | 71.4% at 375, 78.2% at 1280. The rest is a dark seam (B2) |
| Source PNG | 1200x1200, 30 px cells, 40x40, 7 colours, 0 non-uniform cells |
| Shipped record / source record art gate | pass (test.js art gate; scratch reinstalls 2624/2624 and 3648/3648) |
| Pre-branch save (real one built on e152988: Fort 8, 2 Zen pictures won, 2 Gallery, eggs, 777 coins) on branch | campaign and zen JSON unchanged field for field; home shows the same plus the Pixels card; code identical |
| Old SP2 code imported on a fresh branch profile | Fort 9, 777 coins, egg, Zen 4/636 restored; re-export byte-identical |
| SP3 round trip | SP3 written with Pixels progress; reset all, import, Pixels save identical, re-export identical. e152988 page says "newer version" and disables Apply |
| Real player, no debug, 375 and 1280 | locked (aria "…: Opens after Fort 5", tap toasts and stays home); Fort 5 won by 10 real taps opens it; card goes to the level; map; Lighthouse won by 51 real taps (4:19); "Picture done / Lighthouse by PartialVoid, all dug out."; Back to map shows node 1 done; reload shows "1 of 1 pictures", Continue on the Pixels card |
| Campaign and Zen at 375, real taps | Red Fuji (Zen) won with 54 taps, Fort 6 won with 8 taps |
| Reset Pixels only / Everything | Pixels only: Pixels cleared, campaign and zen JSON byte-identical, toast "Partial's Pixels reset…". Everything: all cleared, Pixels included |
| Credits | card "Pixel art by PartialVoid", map foot "Pixel art by PartialVoid, used with the artist's permission.", 1280 side panel, win line, LICENSES.md row 25 and section (all rights reserved by the artist) |
| Three-card home | 375: 175x118 twice plus a 359x70 card underneath, nothing overflowing. 1280: 225x118 twice plus 460x70. Looks like it belongs |
| Console messages | 0 in every run (player, saves, map growth, art, no-pixels) |
| Pipeline (i) 8 colours | suggestion plus preview; source and pk md5 unchanged |
| Pipeline (ii) merge written | installs as picture 3, art gate 3648/3648, LICENSES row "merge #f4d35e to #ffd23f" |
| Pipeline (iii) blurry / oversize | blurry: "REFUSED … no clean pixel grid (219 colours; cells come out 1 px) … export at a whole-number scale with no smoothing". 64x60: crop suggestion `[0,16,40,44]` with an outlined preview. Both clear |
| Pipeline (iv) second clean picture | installs as picture 2, but only with `--extra 3` (S2); picture 1's record is byte-identical (source and pk); the map grew to spots [0,1,2]; a picture-1 save shows "1 of 3 pictures", node 1 done, Play picture 2 |
| Portal build (scratch) | FAIL: mode included, LICENSES.txt names pp-001 (B1) |
| Shipped size | 14,716,719 B (tracked, non-tools), under 19 MB |
| Cache tag | ?v=89 ×15 in index.html, font URL in style.css ?v=89, JS uses the V_ tag |
