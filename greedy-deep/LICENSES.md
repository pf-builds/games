# Greedy Deep — Asset ledger

Everything in the build is either drawn in code or generated locally. Nothing is
downloaded from a third party at runtime, and no webfont, sample pack, or stock art
is bundled.

| Asset | Source | License | Date |
|---|---|---|---|
| All in-game art — strata tiles, seam dither, ore veins, the veil, shaft carve, timber braces, ladder, dwarf composites, cart, elevator cage, depth ribbon, the "GREEDY DEEP" pixel logo | Original, code-defined drawing in `src/sprites.js` and `src/render.js`. Pixel helpers (`make`/`flip`/`shade`/`outline`/`silhouette`, `Pool`/`Particles`/`Floaters`) copied from Click it! Studios' own `peasant-swarm`; the band-seam dither technique from Click it! Studios' own `dinosaur-fight` | Owned — Click it! Studios | 2026-09-16 |
| `assets/title.webp` — splash background (416x608 WebP, 62.6 KB) | Generated locally with **Stable Diffusion XL base 1.0** (`stabilityai/stable-diffusion-xl-base-1.0`), CreativeML Open RAIL++-M, commercial use permitted. Deliberately **not** SDXL Turbo, whose licence is non-commercial. Run offline on Peter's Mac via `/Users/peter/local-ai/greedy_deep_card.py`, 832x1216, 30 steps, guidance 7.0, **seed 5**, downscaled to 416x608 WebP q86. Prompt: "stout bearded miner swinging a pickaxe on a timber ledge inside a deep vertical mine shaft, glowing lantern, glinting ore in layered rock strata, warm amber light against cold blue-black stone, heavy chiaroscuro, ladders descending into darkness, painted fantasy game poster art, dark empty shadow across the bottom". Negative: "text, letters, words, typography, logo, title, watermark, signature, caption, modern equipment, machinery, hard hat, headlamp, photorealism, photograph, 3d render, cgi, blurry, low quality, ui, hud". No franchise name appears anywhere in the prompt (PRD 3, decision 10). | Model output, commercial use permitted under CreativeML Open RAIL++-M | 2026-09-16 |
| UI shell and type | System font stack (`ui-monospace`, Menlo, Consolas); no webfont fetched | n/a — no asset shipped | 2026-09-16 |
| Favicon | Inline SVG data URI with a system emoji glyph | n/a — no asset shipped | 2026-09-16 |
| Game concept, names, and flavor text | Peter Frutchey (original). No Tolkien proper nouns or Appendix A dwarf names, no Warcraft or Deep Rock Galactic names, sprites, or trade dress. `GD.selfTest()` re-runs the Appendix A check on every run | Owned | 2026-09-16 |

**Audio:** none yet. M4 adds WebAudio synthesis written in code — no sample packs, no files.

Line count at v1: this table plus the synth-audio row that M4 adds. As predicted in the PRD,
the generated-asset count for the whole game is **one image**.
