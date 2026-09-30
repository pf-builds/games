# Sapper's Path: asset licenses and credits

**Concept:** Peter Frutchey's outside-in routing idea (Demo Bench, 2026-08-31), rethemed as a castle siege on 2026-09-27.

| Asset | Source | License | Date |
|---|---|---|---|
| All art (materials, crews, goblin, keep, title, banner and map scenes, icons, UI) | Procedural pixel art drawn in code (`src/art.js`, `src/board.js`) | Original work, Peter Frutchey | 2026-09-27 |
| All sound (clinks, thunks, bleat, sizzle, rubble ticks, lever, chest, fanfare, UI) | Synthesized at runtime via WebAudio from recipes in `config.json` (`src/audio.js`) | Original work, Peter Frutchey | 2026-09-27 |
| Arcade thumbnail (`thumb.jpg`) | Screenshot of the game itself | Original work, Peter Frutchey | 2026-09-29 |
| Levels | Generated and solver-verified by `tools/`, hand-ordered | Original work, Peter Frutchey | 2026-09-27 |
| Display font: Jersey 10 (`fonts/Jersey10-Regular.ttf`, headings, buttons and numbers). Copyright 2023 The Soft Type Project Authors, designer Sarah Cadigan-Fried | https://raw.githubusercontent.com/google/fonts/main/ofl/jersey10/Jersey10-Regular.ttf (license: https://raw.githubusercontent.com/google/fonts/main/ofl/jersey10/OFL.txt, shipped as `fonts/OFL.txt`) | SIL Open Font License 1.1 | 2026-09-27 |
| Body font | System font stack, no files shipped | n/a | 2026-09-27 |

One third-party asset: the Jersey 10 font above, unmodified, with its license file beside it. Any asset added later needs a row here before it lands.
