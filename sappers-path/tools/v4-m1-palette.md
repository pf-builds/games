# Sapper's Path v4 M1: palette report

The look pass retunes the 14 material colours for distance. Measured with `tools/palette.js` (CIEDE2000, checked against the Sharma, Wu and Dalal test pairs; sRGB D65 to CIELAB). Only pairs that stand together in at least one level of `levels/levels.json` count: 87 of the 91 possible pairs. `levels.json` is read, never written.

Reproduce: `~/.local/opt/node/bin/node tools/palette.js` (the config palette), `--try '[14 hex]'` (a candidate), `--opt 60000` (the search), `--md '[before hex]'` (this table).

## Result

| | Before (v3.1) | After (v4 M1) |
|---|---|---|
| Smallest pair in any level (ΔE00) | **12.3** (Earth bank / Gilt, levels 26–50) | **25.5** (Earth bank / Gilt) |
| Era 3's smallest pair | 13.3 (Slate / Roof tile, levels 51–75) | 25.8 (Thatch / Brick) |
| Levels with a pair under ΔE 20 | 64 of 75 | **0 of 75** |
| Pairs with a lightness gap of L* 10+ (grayscale) | 65 of 87 | 71 of 87 |
| Smallest gap from a material to the ground it sits on (iron excluded: gates always wear their bars) | 23.2 | 22.0 |

Target was no two materials in the same level under about ΔE 20. Every level now clears 25.

Closest pairs after: Earth bank/Gilt 25.5, Thatch/Brick 25.8, Brick/Hedge 25.9, Thatch/Gilt 26.4, Rubble stone/Ashlar 26.6, Slate/Crystal 26.7, Timber/Rubble stone 26.9, Hedge/Warded stone 27.4.
Closest pairs before: Earth bank/Gilt 12.3, Slate/Roof tile 13.3, Rubble stone/Ashlar 19.7, Thatch/Brick 19.8, Hedge/Warded stone 19.9, Rubble stone/Crystal 21.4, Warded stone/Crystal 21.5, Brick/Hedge 23.4.

## How it was picked

- A seeded search (simulated annealing in OKLCH) maximised the smallest pair, with a soft bonus for the 12 smallest pairs, the lightness spread and the ground gap.
- Each material had to stay in its family: an OKLCH hue window, a lightness band and a chroma floor (bright and saturated, Food Hunt's look), except the three neutrals (rubble grey, ashlar white, iron black). The bands are `PLAN` in `tools/palette.js`.
- Two hand edits after the search, both measured: Earth bank back to a true orange (`#ff8a3d`, the search had drifted to salmon) and Brick's neon lime softened slightly (`#8cf531`). Iron made a neutral black.
- The key colour: Gilt is now a dark old gold, 25.5+ from everything it stands with (it was 12.3 from Earth bank). Every key block still carries its key glyph and its gate's tinted ring, in both modes.
- Not copied from Food Hunt: the hues are ours, only the brightness target is theirs.

## The palette

| # | Material | Crew | Before | After | L* before → after |
|---|---|---|---|---|---|
| 1 | Earth bank | Diggers | `#ff8c1a` | `#ff8a3d` | 70 → 69 |
| 2 | Palisade | Axemen | `#e6262e` | `#e40932` | 50 → 48 |
| 3 | Thatch | Torchbearers | `#ffe21f` | `#ffd80b` | 90 → 87 |
| 4 | Timber | Sawyers | `#ff3fa4` | `#fd4bc0` | 59 → 61 |
| 5 | Rubble stone | Masons | `#a3aab4` | `#969196` | 69 → 61 |
| 6 | Ashlar | Stonecutters | `#f4f1ea` | `#fefbfb` | 95 → 99 |
| 7 | Slate | Quarrymen | `#2f62ff` | `#116fe3` | 48 → 48 |
| 8 | Roof tile | Roofers | `#8f45ff` | `#8d04cd` | 49 → 38 |
| 9 | Brick | Miners | `#9ee52a` | `#8cf531` | 84 → 88 |
| 10 | Iron (gates) | Smiths | `#1b1b22` | `#17161d` | 10 → 8 |
| 11 | Hedge | Goats | `#16a34a` | `#2b9601` | 59 → 54 |
| 12 | Warded stone | Hexbreakers | `#0fb5a6` | `#03c9b0` | 66 → 73 |
| 13 | Crystal | Braziers | `#3fd4ff` | `#1fbefe` | 79 → 72 |
| 14 | Gilt (keys) | Looters | `#c7861a` | `#9f7d00` | 61 → 54 |

## Every level: the smallest pair, before and after

"Gray-close" counts the pairs in the level whose lightness differs by less than L* 10 (they lean on hue alone in grayscale; colour-blind mode's marks cover them).

| Level | Colours | Min ΔE00 before (pair) | Min ΔE00 after (pair) | Gray-close pairs before → after |
|---|---|---|---|---|
| 1 | 2 | 52.9 (Earth bank / Hedge) | 54.7 (Earth bank / Hedge) | 0 → 0 of 1 |
| 2 | 3 | 30.3 (Earth bank / Thatch) | 30.9 (Earth bank / Thatch) | 0 → 1 of 3 |
| 3 | 3 | 30.3 (Earth bank / Thatch) | 30.9 (Earth bank / Thatch) | 0 → 1 of 3 |
| 4 | 3 | 28.7 (Earth bank / Palisade) | 27.8 (Earth bank / Palisade) | 0 → 0 of 3 |
| 5 | 3 | 28.7 (Earth bank / Palisade) | 27.8 (Earth bank / Palisade) | 0 → 0 of 3 |
| 6 | 3 | 28.7 (Earth bank / Palisade) | 27.8 (Earth bank / Palisade) | 1 → 1 of 3 |
| 7 | 4 | 25.8 (Palisade / Timber) | 27.8 (Earth bank / Palisade) | 1 → 1 of 6 |
| 8 | 4 | 23.4 (Brick / Hedge) | 25.9 (Brick / Hedge) | 1 → 1 of 6 |
| 9 | 4 | 28.7 (Earth bank / Palisade) | 27.8 (Earth bank / Palisade) | 1 → 1 of 6 |
| 10 | 5 | 25.8 (Palisade / Timber) | 27.8 (Earth bank / Palisade) | 4 → 3 of 10 |
| 11 | 6 | 19.8 (Thatch / Brick) | 25.8 (Thatch / Brick) | 4 → 4 of 15 |
| 12 | 5 | 19.8 (Thatch / Brick) | 25.8 (Thatch / Brick) | 2 → 2 of 10 |
| 13 | 7 | 25.8 (Palisade / Timber) | 27.8 (Earth bank / Palisade) | 4 → 2 of 21 |
| 14 | 7 | 19.9 (Hedge / Warded stone) | 27.4 (Hedge / Warded stone) | 7 → 4 of 21 |
| 15 | 7 | 19.8 (Thatch / Brick) | 25.8 (Thatch / Brick) | 6 → 7 of 21 |
| 16 | 7 | 19.8 (Thatch / Brick) | 25.8 (Thatch / Brick) | 7 → 5 of 21 |
| 17 | 7 | 19.8 (Thatch / Brick) | 25.8 (Thatch / Brick) | 5 → 3 of 21 |
| 18 | 8 | 19.7 (Rubble stone / Ashlar) | 26.6 (Rubble stone / Ashlar) | 10 → 7 of 28 |
| 19 | 7 | 19.8 (Thatch / Brick) | 25.8 (Thatch / Brick) | 5 → 4 of 21 |
| 20 | 7 | 19.8 (Thatch / Brick) | 25.8 (Thatch / Brick) | 7 → 5 of 21 |
| 21 | 8 | 19.8 (Thatch / Brick) | 25.8 (Thatch / Brick) | 6 → 3 of 28 |
| 22 | 7 | 19.8 (Thatch / Brick) | 25.8 (Thatch / Brick) | 6 → 7 of 21 |
| 23 | 8 | 19.7 (Rubble stone / Ashlar) | 26.6 (Rubble stone / Ashlar) | 8 → 4 of 28 |
| 24 | 8 | 19.8 (Thatch / Brick) | 25.8 (Thatch / Brick) | 6 → 3 of 28 |
| 25 | 7 | 19.8 (Thatch / Brick) | 25.8 (Thatch / Brick) | 5 → 4 of 21 |
| 26 | 6 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 4 → 4 of 15 |
| 27 | 9 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 8 → 7 of 36 |
| 28 | 8 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 9 → 10 of 28 |
| 29 | 8 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 10 → 7 of 28 |
| 30 | 9 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 8 → 7 of 36 |
| 31 | 8 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 7 → 4 of 28 |
| 32 | 9 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 10 → 11 of 36 |
| 33 | 9 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 10 → 11 of 36 |
| 34 | 10 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 12 → 8 of 45 |
| 35 | 8 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 7 → 6 of 28 |
| 36 | 9 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 8 → 7 of 36 |
| 37 | 8 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 5 → 4 of 28 |
| 38 | 8 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 7 → 7 of 28 |
| 39 | 9 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 11 → 7 of 36 |
| 40 | 10 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 11 → 11 of 45 |
| 41 | 8 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 7 → 7 of 28 |
| 42 | 9 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 11 → 8 of 36 |
| 43 | 10 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 9 → 5 of 45 |
| 44 | 8 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 7 → 7 of 28 |
| 45 | 10 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 11 → 10 of 45 |
| 46 | 11 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 15 → 11 of 55 |
| 47 | 11 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 13 → 8 of 55 |
| 48 | 11 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 13 → 8 of 55 |
| 49 | 11 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 16 → 12 of 55 |
| 50 | 10 | 12.3 (Earth bank / Gilt) | 25.5 (Earth bank / Gilt) | 10 → 10 of 45 |
| 51 | 4 | 13.3 (Slate / Roof tile) | 26.6 (Rubble stone / Ashlar) | 1 → 0 of 6 |
| 52 | 11 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 13 → 10 of 55 |
| 53 | 11 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 13 → 9 of 55 |
| 54 | 12 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 17 → 12 of 66 |
| 55 | 9 | 13.3 (Slate / Roof tile) | 26.6 (Rubble stone / Ashlar) | 9 → 5 of 36 |
| 56 | 11 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 13 → 9 of 55 |
| 57 | 11 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 13 → 9 of 55 |
| 58 | 12 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 17 → 12 of 66 |
| 59 | 11 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 13 → 10 of 55 |
| 60 | 9 | 13.3 (Slate / Roof tile) | 26.6 (Rubble stone / Ashlar) | 7 → 7 of 36 |
| 61 | 11 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 13 → 9 of 55 |
| 62 | 11 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 14 → 8 of 55 |
| 63 | 11 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 13 → 10 of 55 |
| 64 | 12 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 17 → 12 of 66 |
| 65 | 9 | 13.3 (Slate / Roof tile) | 26.6 (Rubble stone / Ashlar) | 9 → 5 of 36 |
| 66 | 11 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 14 → 8 of 55 |
| 67 | 11 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 14 → 8 of 55 |
| 68 | 12 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 17 → 12 of 66 |
| 69 | 11 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 13 → 9 of 55 |
| 70 | 9 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 8 → 4 of 36 |
| 71 | 12 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 17 → 12 of 66 |
| 72 | 11 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 13 → 10 of 55 |
| 73 | 12 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 17 → 12 of 66 |
| 74 | 11 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 13 → 10 of 55 |
| 75 | 10 | 13.3 (Slate / Roof tile) | 25.8 (Thatch / Brick) | 10 → 6 of 45 |
