# Sapper's Path v3 M1 rebake

Peter's M0 review asked for three tuning changes before the M1 page: judge the late band by the thinking player, cap late levels at about 55 taps, and keep every band and the three-difficulty win guarantee. The full per-level table is in the bake section of `tools/v3-m0-report.md` (rewritten by `node tools/bake.js`). Numbers below are from the final bake on 2026-09-28.

## Result

| Measure | M0 bake | M1 bake |
|---|---|---|
| Normal bands in range (generated levels) | 70 / 70 | 70 / 70, zero fallbacks |
| Winnable on Easy, Normal and Hard | 75 / 75 | 75 / 75 (node tests replay all 225) |
| Lookahead player, late hard slots: median / max | 14% / 71% | **13% / 25%** |
| Lookahead player, hardest slots: median / max | 10% / 85% (level 49) | **18% / 24%** (level 49 now 24%) |
| Lookahead fallbacks (a slot that missed its 25% target) | not measured | **0** |
| Taps per level: max (all) / late median / late max | 84 / 51 / 84 | **53** / 38 / 53 |
| Random-tap Normal, hard / hardest median | 4.0% / 2.1% | 4.3% / 1.8% |
| Bake time (16 threads) | 51 s | 181 s |
| `node tools/test.js` | 128 / 128 | 128 / 128 |

Relief levels stay easy for a thinking player (lookahead median 100%), as a relief should. On Hard, 15 of the 25 Era 3 levels still measure 0% random-tap (all winnable); that's unchanged and is the "Hard is severe" risk from the M0 report, left for Peter's playtest.

## What changed (all numbers in `tools/bake-config.json`, version 5)

- **`maxTaps: 55`.** A deal with more cards is dropped, and the tuner's split move can't take a deck past it.
- **Bigger squads:** `dealBy.late.size` [3, 12] -> [7, 18] and `dealBy.mid.size` [4, 14] -> [5, 15]. This is what brought the late band from 84 taps to 53.
- **Lookahead target for late hard slots:** `lookahead: {hard: 0.25, hardest: 0.25}`. The narrow stage now measures the lookahead player with 128 playouts (was 64), takes up to 400 steps (was 150), and stops at `stopAt: 0.08` rather than driving every level to 0%, so the band stays hard without turning into a wall. Late hard slots get 12 candidates (`perLevelBy`), and the picker prefers in-band candidates at or under the target, nearest the band centre among them. A pick over the target is logged as a lookahead fallback; this bake had none.
- **`perLevelBy.saw1: 8`.** Bigger mid squads had pushed level 20 just outside its band in a trial bake; two more candidates fixed it.

Two trial bakes before the final one, for the record: without the stop floor the lookahead medians fell to 3% (hard) and 2% (hardest), which reads as a wall for most players; with a 10% floor and 64 playouts, level 46 landed at 49% because the 64-playout estimate was too noisy.

## Accepted and logged in SPEC-v3 §9

- The colour ramp past the design table (Era 1 up to 7-9 colours).
- The lookahead measure standing in for the literal "1-3 winning orders" target.
- Holding capacity per difficulty stays in `config.json` `v3.rules` (Easy 6, Normal 5, Hard 4, archers lethal on Hard) so it can be turned after playtest. The baker reads the same rules.
- Gilt (keys) moved from pink #ffb6d9 to amber bronze #c7861a, and every key block carries a key glyph (M1 page).
