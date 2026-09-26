# Peasant Swarm — Asset ledger

| Asset | Source | License | Date |
|---|---|---|---|
| All pixel sprites (peasants, tiles, trees, rocks, power-ups, HUD) | Original, code-defined pixel maps in `src/sprites.js` | Owned — Click it! Studios | 2026-09-01 |
| All sound effects + ambient | Original WebAudio synthesis in `src/audio.js` | Owned — Click it! Studios | 2026-09-01 |
| UI fonts "Baloo 2" / "Nunito" (menus, HUD, canvas labels) | Google Fonts latin variable woff2 files, self-hosted in `fonts/` and, since v3 M2b, subset to the characters the game draws with `tools/font-subset.py` (fontTools; the wght axis, layout features, names and metrics kept): `baloo2-latin.woff2` 33,056 -> 22,696 B, Baloo 2 Project Authors / EkType; `nunito-latin.woff2` 39,152 -> 24,188 B, Nunito Project Authors. A subset is a Modified Version under OFL 1.1; neither font has a Reserved Font Name, so the family names stay. License texts shipped beside them: `fonts/OFL-Baloo2.txt`, `fonts/OFL-Nunito.txt`. No Reserved Font Name in either | SIL OFL 1.1 | 2026-09-25 (self-hosted in v3 M1, subset in M2b; CDN since 2026-09-01) |
| Game concept | Peter Frutchey (original, reconstructed from memory of an unfound WC3 custom map; no names, assets, or trade dress reused) | Owned | 2026-09-01 |
| Valley art (palette ramps, ground chunks, cliffs, water, fords, bridges, banners, props) | Original, procedural code in `src/palette.js`, `src/ground.js`, `src/sprites.js`, `src/spoils.js` (M5-M6) | Owned — Click it! Studios | 2026-09-24 |
| Painted valley title, win and lose staging, confetti (M7) | Original, procedural code in `src/title.js` | Owned — Click it! Studios | 2026-09-24 |
| Pixel HUD icons (pause, sound, muted), onboarding finger and cursor, hit sparks, contact dust, rout wave (M7) | Original, code-defined pixel maps in `style.css` (inline SVG data URIs), `src/game.js`, `src/particles.js` | Owned — Click it! Studios | 2026-09-24 |
| M7 sounds: crowd murmur, remnant scatter, crown pulse, dawn chime, bandit growl | Original WebAudio synthesis in `src/audio.js` | Owned — Click it! Studios | 2026-09-24 |
| Portal adapter (`src/portal.js`) and portal build (`tools/portal-build.mjs`) | Original code. The portal builds add the portal's own SDK `<script>` (CrazyGames HTML5 SDK v3 or PokiSDK v2, loaded from the portal's CDN, never bundled); `?portal=` loads the same script for local QA only. The GitHub Pages build loads no SDK | Owned — Click it! Studios | 2026-09-25 |
| Arcade card thumbnail `thumb.jpg` (M7) | Captured from the game's own `?poster=1` scene (seed 1000's first ford) by `tools/harness.mjs --poster` | Owned — Click it! Studios | 2026-09-24 |
| QA harness `tools/harness.mjs`, `PS.selfTest`, `PS.cfgOverride` and the other `PS.*` QA hooks (M1-M8) | Original code. The harness runs under Node with Playwright (Apache-2.0) and headless Chromium at development time only; neither is bundled or loaded by the game | Owned — Click it! Studios | 2026-09-24 |
| Tuning numbers in `config.json` (M8 retune) | Measured with the harness and seeded sweeps (M8 build notes); no third-party data | Owned — Click it! Studios | 2026-09-24 |

Nothing in the GitHub Pages build is fetched from another origin at run time: the two fonts above ship in `fonts/` (since v3 M1). A portal build also loads that portal's SDK script from the portal. The only third-party files bundled are the two OFL fonts; no third-party code, images or sounds.
