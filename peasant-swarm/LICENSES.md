# Peasant Swarm — Asset ledger

| Asset | Source | License | Date |
|---|---|---|---|
| All pixel sprites (peasants, tiles, trees, rocks, power-ups, HUD) | Original, code-defined pixel maps in `src/sprites.js` | Owned — Click it! Studios | 2026-09-01 |
| All sound effects + ambient | Original WebAudio synthesis in `src/audio.js` | Owned — Click it! Studios | 2026-09-01 |
| UI fonts "Baloo 2" / "Nunito" (menus/HUD only) | Google Fonts CDN | SIL OFL 1.1 | 2026-09-01 |
| Game concept | Peter Frutchey (original, reconstructed from memory of an unfound WC3 custom map; no names, assets, or trade dress reused) | Owned | 2026-09-01 |
| Valley art (palette ramps, ground chunks, cliffs, water, fords, bridges, banners, props) | Original, procedural code in `src/palette.js`, `src/ground.js`, `src/sprites.js`, `src/spoils.js` (M5-M6) | Owned — Click it! Studios | 2026-09-24 |
| Painted valley title, win and lose staging, confetti (M7) | Original, procedural code in `src/title.js` | Owned — Click it! Studios | 2026-09-24 |
| Pixel HUD icons (pause, sound, muted), onboarding finger and cursor, hit sparks, contact dust, rout wave (M7) | Original, code-defined pixel maps in `style.css` (inline SVG data URIs), `src/game.js`, `src/particles.js` | Owned — Click it! Studios | 2026-09-24 |
| M7 sounds: crowd murmur, remnant scatter, crown pulse, dawn chime, bandit growl | Original WebAudio synthesis in `src/audio.js` | Owned — Click it! Studios | 2026-09-24 |
| Portal adapter (`src/portal.js`) | Original code; calls the CrazyGames / Poki SDK globals only when a portal page injects them (no SDK is bundled or fetched) | Owned — Click it! Studios | 2026-09-24 |
| Arcade card thumbnail `thumb.jpg` (M7) | Captured from the game's own `?poster=1` scene (seed 1000's first ford) by `tools/harness.mjs --poster` | Owned — Click it! Studios | 2026-09-24 |
| QA harness `tools/harness.mjs`, `PS.selfTest`, `PS.cfgOverride` and the other `PS.*` QA hooks (M1-M8) | Original code. The harness runs under Node with Playwright (Apache-2.0) and headless Chromium at development time only; neither is bundled or loaded by the game | Owned — Click it! Studios | 2026-09-24 |
| Tuning numbers in `config.json` (M8 retune) | Measured with the harness and seeded sweeps (M8 build notes); no third-party data | Owned — Click it! Studios | 2026-09-24 |

Nothing in the shipped game is fetched at run time except the two Google Fonts above (menus and HUD text; the page falls back to the system sans-serif if they fail). No third-party code, images or sounds are bundled.
