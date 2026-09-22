# Greedy Deep — Build Spec (M4: juice, mobile, save, ending)

Cabinet #7. Incremental mining game, side-view cutaway of one vertical shaft. Full contract:
`business/D-click-it-studios/game-research/greedy-deep-PRD.md`, with the sprite and audio
recipes in `greedy-deep-research-art.md` (R4). This file covers M1 through M4.

## Mechanic
Two income paths, deliberately separate:
- **Tapping** the active ore vein pays gold and **never digs**: `goldPerTap = clickPower x band.goldPerMeter x clickYield`.
- **Depth** advances only through `digRate`, which comes from hired dwarves and rate upgrades.

Purchase engine: `cost = base x ratio^owned`. A dwarf is an upgrade track with a name and a line.

## Layout (M4)
**Portrait** (phone, default): column 160 bu wide, integer scaled. Top bar + shaft + roster strip
(h-scroll dwarf chips) + 4-tab bar `[DIG] [CREW] [GEAR] [LOG]` + v-scroll panel. Every tap target
>= 44 CSS px. No horizontal scroll at 375x812 or 390x844.

**Desktop** (viewport >= 1100 px): same column in center. 240 px left rail (crew roster cards),
300 px right rail (all upgrade tabs expanded, no tab bar). Column = top bar + shaft only (shaft
gets taller). Scale = `clamp(2, floor(min((vw-540)/160, vh/300)), 4)`. One render path for both.

Tab assignments live in JSON `layout.tabs`.

## Audio (M4)
All 13 cues synthesized via WebAudio (`src/audio.js`). Core functions (`ac`, `tone`, `getNoise`,
`noise`, `gate`) copied from peasant-swarm. Master gain in JSON `audio.masterGain`, per-cue gain
in `audio.cueGains`, gate thresholds in `audio.gates`.

| Cue | Recipe | Gate |
|---|---|---|
| strike | noise + square tone 300-360 Hz | 40 ms |
| strikeCrit | strike + sawtooth 520 Hz | 60 ms |
| oreCrack | sawtooth 190 Hz + noise | 50 ms |
| orePop | square 700-820 Hz, +6%/combo cap 8 | 40 ms |
| cartDump | noise 600 Hz + sine 130 Hz | -- |
| lift | sawtooth 70 Hz + noise | -- |
| hire | triangle chord 392/523/659 | -- |
| buy | square chord 523/659/784 | -- |
| denied | square 230 Hz | 120 ms |
| bandBreak | triangle chord 660/880/1320 + noise | -- |
| hazard | noise 400 Hz + sawtooth 95 Hz | -- |
| milestone | square chord (win fanfare) | -- |
| welcomeBack | bell (triangle 880 Hz) | -- |
| ui | square 700 Hz | 30 ms |

**Ambient drone ("the Deep"):** Two beating oscillators at 55 Hz, lowpassed, gained by depth
fraction. Random tinks (30%) and drips (20%) every 2.2 s. Gets lower and wetter as you descend.
Off when muted.

Audio context created only on first user gesture. Mute persisted in `prefs`.

## Save codec (M4)
Export: `GD.export()` -> base64 of `{d: JSON, c: checksum, v: version}`.
Import: `GD.import(str)` validates version + checksum, fails safely (returns `{ok: false, reason}`),
never touches the live save on failure. On success reproduces gold, depth, goldEarnedTotal, owned.

## Settings (M4)
Overlay panel (double-click mute button to open): mute toggle, export (copies to clipboard + textarea
fallback), import (paste + confirm), reset (with confirm). All in DOM, no canvas.

## Particles (M4)
Pooled via `GDParticles` (copied from peasant-swarm): burst chunks for strikes, ring for band breaks
and crits, floaters for every gain. Max pool size in JSON `particles.max`. Zero per-frame allocation.

## Ending (M4)
At depth 1200 m: milestone triggers once (`endingSeen`), DOM overlay with title, stats, score, and
KEEP DIGGING button. Game continues into endless mode. The `ending` JSON block holds timing params
for a future procedural scene upgrade.

## Flavor fallbacks (M4)
Any string starting with `FLAVOR-TODO:` renders as its slot's neutral fallback from `flavor.fallbacks`
in JSON. Slots: welcomeBack, dwarfLine, bandIntro, event, ending, endingTitle.
`GD.dbg.flavorTodoCount` reports the real count; fallbacks never reach the player.

## Files
| File | Role |
|---|---|
| `index.html` | shell, versioned script tags |
| `style.css` | portrait tabs, desktop rails, all sizes from `--s` |
| `config/greedy-deep.json` | every tunable number; own `?v=` cache-bust |
| `src/engine.js` | pure sim: tick, purchase, effects, bands, validation |
| `src/gd.js` | `window.GD` facade, debug, selfTest (190 assertions) |
| `src/sprites.js` | procedural sprite factory |
| `src/particles.js` | pooled particles + floaters (from peasant-swarm) |
| `src/audio.js` | WebAudio synth, 13 cues, ambient drone (M4) |
| `src/render.js` | shaft canvas, camera, depth ribbon, crit shake |
| `assets/title.webp` | SDXL-base splash card, 62.6 KB |
| `src/ui.js` | DOM, tabs, roster, settings, input, clocks |
| `src/save.js` | localStorage save, migration, base64 export/import |

## Economy (unchanged from M2)
`simulate()`: ending at 6,702 s (112 min), maxGap 174 s, 30 purchases in first 600 s.

## `window.GD`
All M1-M3 API plus: `GD.export()`, `GD.import(str)`, `GD.audio.muted` via `GDAudio.isMuted()`,
`GD.dbg.audioMasterGain`, `GD.dbg.lastCue`.

## Acceptance — `GD.selfTest()` (190 assertions, zero failures)
M1 block: reset, taps, idle, purchase, save, restore, additivity, clearSave.
M2 block: verbs, content, simulate, bandLog, offline, events, milestone, endless, reveal, ETA, flavor, content-as-data, validation.
M3 block: sprite cache, tiles, seams, veil, dwarves, camera, title card, outline, ETA formatting.
M4 block: mute + master gain + no cue when muted, mute persisted in prefs, export/import round-trip, truncated import fails safely, version-bumped import fails safely, jumpTo(1200) triggers ending once with endingSeen and game continues, particle max in JSON, flavor fallbacks exist, no horizontal scroll, JSON blocks present (audio, particles, ending, layout desktop, flavor fallbacks).

## M4 fix pass (items 1-10 + addenda)
1. **BLOCKER fixed**: `lastCue` now syncs to `GD.dbg.lastCue` immediately on `GDAudio.play()`.
2. **MAJOR fixed**: `GD.simulate()` saves/restores the engine RNG; selfTest verifies live state and
   save are byte-identical after a simulate call.
3. **MINOR fixed**: `GD.dbg.spriteCacheBlank` is a number (was array). `GD.audio.muted` facade exposed.
4. **Ending scene**: canvas-drawn cavern (vaulted ceiling, gold pile, columns), camera pull-back tween,
   crew files in, title/stats/score text. DOM panel shows KEEP DIGGING button after the scene.
5. **Ore pop arc**: ore-colored 4px square arcs from the vein to the cart on every strike (0.4s tween).
   **Gold odometer**: displayed gold catches up to real gold with smooth interpolation.
6. **Purchase visibility**: selfTest asserts every one of 12 purchasables changes a derived stat.
7. **Click-anywhere**: the whole shaft canvas is a strike target. Chunks and floaters spawn at the
   click point. Drag/wheel look-back still works (6px movement threshold in JSON `layout.clickThresholdPx`).
8. **Crew slots**: face slots (3 dwarves dig at the face), wall pockets (alternating left/right at
   staggered heights), transit slots (climbing the ladder). No two positions overlap within a sprite
   width/height. selfTest checks N=1,4,10,18,30. Config in JSON `crew` block.
9. **Desktop breakpoint**: lowered to 900px. Fluid rails (left 180-240px, right 240-300px).
   Peter's "no rails" was stale CSS cache (the meta http-equiv is not always respected by browsers;
   HTTP headers from the server are the reliable path). Verified at all 11 viewports.
9b. **Side artwork**: blurred darkened title card as body background on desktop (reuses splash
    treatment). Rails have semi-transparent backdrop-filter for legibility. Art fills gutters at
    wide viewports; never flat blank.
10. **Debug chip**: collapsed by default (16px tall, click to expand). State not persisted (prefs).

Computed scales per viewport:
| Viewport | Scale | Desktop | Left rail | Right rail |
|---|---|---|---|---|
| 375x812 | 2 | no | - | - |
| 390x844 | 2 | no | - | - |
| 768x1024 | 2 | no | - | - |
| 1000x800 | 2 | yes | 180 | 240 |
| 1100x700 | 2 | yes | 180 | 240 |
| 1200x1000 | 3 | yes | 180 | 240 |
| 1440x900 | 3 | yes | 202 | 259 |
| 1512x982 | 3 | yes | 212 | 272 |
| 1728x1000 | 3 | yes | 240 | 300 |
| 1800x1100 | 3 | yes | 240 | 300 |
| 1920x1080 | 3 | yes | 240 | 300 |

## Tuning log (playtest batch)
B2-1: Stripped all `minDepth` depth locks (Peter's decision). No row is depth-locked
in v1. Sim returned to baseline: 6,702 s / maxGap 174 / first600 30.

Tap-vs-crew gold rate at band starts (B2-3):
| Band | Tap g/s | Crew g/s | Tap/Crew |
|---|---|---|---|
| coal (0 m) | 0.2 | 0.0 | inf (bootstrap) |
| copper (40 m) | 34.8 | 0.4 | 9,353% |
| silver (180 m) | 144.0 | 3.4 | 4,252% |
| starmetal (600 m) | 882.0 | 48.9 | 1,802% |
Tapping is massively productive at every band start. No JSON change needed.

Previously added `minDepth` depth-locking to 9 of 12 purchasables (bit 30, hald 40, braces 100,
lantern 100, vessa 180, rails 300, smelter 500, nix 600, elevator 900). Core tracks
(pick, dorrik, cart) are never locked. Economy result: ending 6,688 s (was 6,702),
maxGap 175 (was 174), richButLockedMax 0 (target < 30 s). No retune needed.

Added buy-quantity toggle (1x/5x/10x/MAX) with bulk cost = N single buys exactly.

## Economy rebalance (phase 7, post-ship)
Diagnosis: uncapped multiplicative stacking (mul_rate, mul_gold, add_rate_per_dwarf)
caused positive-feedback runaway under MAX-buy. With aggressive tapping at 8/s,
gold/income exceeded JS Number.MAX_VALUE (Infinity) within minutes of the starmetal band.

Fixes applied:
- Soft caps on mul_rate and mul_gold: full strength for first 8 levels, diminishing
  returns (sqrt scaling) past that. Config: `balance.softCaps.mulRate: 8, .mulGold: 8`.
- Cart Rails per-dwarf contribution: sqrt scaling past 20 dwarves. Config:
  `balance.ratePerDwarfCap: 20`.
- Cost ratios steepened: bit 2.1->2.8, cart 2.2->3.0, smelter 2.6->3.2, rails 2.8->3.2,
  vessa 2.2->2.8, hald 2.2->2.6, nix 2.6->3.0.
- Early game cheaper: pick base 3->2, dorrik base 25->15, hald base 400->300,
  bit base 150->100, cart base 500->400, vessa base 700->500.
- Dorrik dig rate 0.012->0.01 m/s (slight slow-down to match curve).
- clickYield 0.12->0.06 (halved tap gold to prevent aggressive tapping runaway).
- Endless: multiplierPerBand 1.5->1.3, lengthGrowth 0.5 (bands grow 50% longer each repeat).
- Hard overflow clamp: all gold/rates/multipliers clamped to 1e100; maxBuyable capped at 500.
- Added `max-buy` simulate policy that buys max of everything + taps at 8/s.

Results (cheapest-affordable / max-buy):
- Ending: 9,837 s (164 min) / 5,623 s (94 min). Both in 5,400-10,800 window.
- maxGap: 296 / 193 s. Both < 300.
- peakGold: ~135K / ~198K. Well under 1e10.
- first600: 24 / 38 purchases. Both lively starts.
- Band cadence (max-buy): min 881s, median 1454s, max 2402s — crossings slow with depth.

## B2-2: desktop rails stale rows (root cause)
`buildDesktopRails()` cloned portrait rows via `cloneNode(true)`. The `refresh()` function
updated only the originals in the `rows` array; the clones showed stale prices/states forever.
A row displaying an old lower price looked buyable but the real buy checked the current higher
price and failed. Fix: move the actual DOM nodes into the rails instead of cloning. On portrait
resize, move them back to their tab containers.
