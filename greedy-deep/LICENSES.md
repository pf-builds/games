# Greedy Deep — Asset ledger

Everything in the build is either drawn in code or generated locally. Nothing is
downloaded from a third party at runtime, and no webfont, sample pack, or stock art
is bundled.

| Asset | Source | License | Date |
|---|---|---|---|
| All in-game art — strata tiles, seam dither, ore veins, the veil, shaft carve, timber braces, ladder, dwarf composites, cart, elevator cage, depth ribbon, the "GREEDY DEEP" pixel logo | Original, code-defined drawing in `src/sprites.js` and `src/render.js`. Pixel helpers (`make`/`flip`/`shade`/`outline`/`silhouette`, `Pool`/`Particles`/`Floaters`) copied from Click it! Studios' own `peasant-swarm`; the band-seam dither technique from Click it! Studios' own `dinosaur-fight` | Owned — Click it! Studios | 2026-09-16 |
| `assets/title.webp` — splash background (416x608 WebP, 62.6 KB) | Generated locally with **Stable Diffusion XL base 1.0** (`stabilityai/stable-diffusion-xl-base-1.0`), CreativeML Open RAIL++-M, commercial use permitted. Run offline on Peter's Mac via `/Users/peter/local-ai/greedy_deep_card.py`, 832x1216, 30 steps, guidance 7.0, **seed 5**, downscaled to 416x608 WebP q86. | Model output, commercial use permitted under CreativeML Open RAIL++-M | 2026-09-16 |
| All audio — 13 SFX cues + depth-reactive ambient drone | Original, WebAudio synthesis in `src/audio.js`. Core functions (`ac`/`tone`/`getNoise`/`noise`/`gate` and the `startDrum()` interval shape) copied from Click it! Studios' own `peasant-swarm/src/audio.js`. No sample files, no downloaded audio. | Owned — Click it! Studios | 2026-09-20 |
| UI shell and type | System font stack (`ui-monospace`, Menlo, Consolas); no webfont fetched | n/a — no asset shipped | 2026-09-16 |
| Favicon | Inline SVG data URI with a system emoji glyph | n/a — no asset shipped | 2026-09-16 |
| Game concept, names, and flavor text | Peter Frutchey (original). No Tolkien proper nouns or Appendix A dwarf names, no Warcraft or Deep Rock Galactic names, sprites, or trade dress. `GD.selfTest()` re-runs the Appendix A check on every run | Owned | 2026-09-16 |

**Audio detail:** all 13 cues are synthesized through `tone()` (oscillator envelope) and `noise()`
(filtered noise burst), both implemented in WebAudio. The ambient drone uses two beating
oscillators at ~55 Hz with a lowpass filter. No audio files are loaded or bundled.

Line count at v1: this table. The generated-asset count for the whole game is **one image**.
