# Greedy Deep — Build Spec (M1: core loop)

Cabinet #7. Incremental mining game, side-view cutaway of one vertical shaft. Full contract:
`business/D-click-it-studios/game-research/greedy-deep-PRD.md`. This file is the M1 slice of it.
M2 (engine + content), M3 (art), M4 (juice/mobile/save/ending) are listed in `LATER.md`.

## Mechanic (M1)
Two income paths, deliberately separate:
- **Tapping** the active ore vein pays gold and **never digs**: `goldPerTap = clickPower x band.goldPerMeter x clickYield`.
- **Depth** advances only through `digRate`, which comes from hired dwarves and rate upgrades.
  Passive gold is `digRate x band.goldPerMeter x goldMultipliers`.

So tapping is the bootstrap and depth is the binding constraint. Nothing moves until the first dwarf is hired.

Purchase engine, shared by upgrade tracks and dwarves alike: `cost = base x ratio^owned`, `owned` keyed by id.
A dwarf is an upgrade track with a name and a line, nothing more.

## Controls
- **Mouse:** click the glinting vein on the right wall to strike. Click a BUY button to purchase.
- **Touch:** identical. Pointer events, `touch-action: none` on the canvas (no 300 ms delay), every
  tap target at or above 44 CSS px; the vein hotspot is 28 bu, so 56 px at the minimum scale of 2.
- No keyboard binding in M1.

## Flow
Open -> shaft at 0 m, gold 0, one vein in view -> tap to earn -> buy Sharper Pick (10 g) -> hire
Dorrik (25 g), depth starts moving on its own -> alternate tapping and buying -> close the tab, come
back, land where you left off. No win, no lose, no restart: the ending at 1,200 m is M2/M4.

## Entities (M1)
Game (fixed-dt accumulator) · Shaft (banded scrolling rects, timber braces, ladder, depth readout,
depth ribbon) · Vein (one active hotspot) · Wallet (gold, `goldEarnedTotal`) · UpgradeTrack x2
(Sharper Pick `add_click`, Drill Bit `mul_rate`) · Dwarf x1 (Dorrik Quickpick, `add_rate`) ·
Save v1 · `window.GD` facade.

## Layout
Portrait column, 160 bu wide, integer scale `--s = clamp(2, floor(min(vw/160, vh/406)), 4)`:

```
+------------------------------+
| 12,480 g   +42/s      214 m  |  TOP BAR   160x28  DOM
+-----+------------------+---+-+
|#####|                  |###|#|  SHAFT     160x256 canvas
|#####|      [ladder]    |#@#|#|  L wall 3 tiles - bore 4 - R wall 3 (16 bu tiles)
|#####|   d   d   d      |###|#|  @ = the active vein, clickable
+-----+------------------+---+-+  right edge: 6 bu depth ribbon
| THE COMPANY STORE            |  PANEL     DOM rows, >=48 px tall
|  [GEAR] Sharper Pick   10 g  |
|  [CREW] Dorrik Quickpick 25g |
+------------------------------+
```

Desktop (>=1100 px) centres the same column with a drop shadow. Side rails are M4.

## Files
| File | Role |
|---|---|
| `index.html` | shell, versioned script tags |
| `style.css` | column shell, every size derived from `--s` |
| `config/greedy-deep.json` | every tunable number; own `?v=` cache-bust, separate from the script tags |
| `src/engine.js` | pure sim: fixed-dt tick, purchase engine, effects registry, bands, validation, format |
| `src/gd.js` | `window.GD` facade, debug mutators, `selfTest()` |
| `src/render.js` | shaft canvas |
| `src/ui.js` | DOM, input, clocks, autosave |
| `src/save.js` | versioned localStorage save, migration walker |

`src/audio.js`, `src/sprites.js`, `src/particles.js` are M3/M4 and deliberately absent.

## `window.GD`
Always present. `step(seconds)` (fixed sub-steps of `sim.dt`, no DOM or rAF, returns the PRD 13
snapshot), `tap`, `buy`, `reset`, `getState/setState`, `costOf`, `derive`, `snapshot`, `format`,
`validateConfig`, `selfTest`, `save`, `config`, `state`, `version`, `dbg`.
`?debug=1` adds the overlay plus `setGold`, `setDepth`, `grant`, `pause`, `resume`, `timeScale`,
`clearSave`, and a guarded fallback interval clock so hidden tabs keep simulating.

## Acceptance (PRD 14, M1) — all run by `GD.selfTest()`
`reset(); step(0)` -> gold 0, depth 0 · 10 synthetic taps raise gold by exactly `10 x goldPerTap`
and leave depth at 0 · `step(600)` with no purchases leaves gold and depth unchanged · second
purchase costs `base x ratio` within 1e-6 · insufficient gold refused, gold and owned unchanged ·
a hired dwarf digs at its `add_rate` · save present with `version, savedAt, depth, gold,
goldEarnedTotal, owned, prefs` · save/read restores depth within 1 m and gold within 1 g ·
`step(3600)` under 500 ms · `step(3600)` equals 3600 x `step(1)` within 1e-6 · snapshot shape ·
`validateConfig()` ok · zero console errors and warnings.

## Asset manifest
Everything drawn in code. No downloaded art, no audio, no fonts fetched over the network (the shell
uses the system monospace stack). See `LICENSES.md`.

## Content-as-data rule
Adding an ore, dwarf, or upgrade that reuses an existing effect verb and pattern id is a JSON entry
with zero JS edits. Unknown verb, unknown pattern, duplicate id, or non-monotonic `startDepth` fails
`GD.validateConfig()` loud. No gameplay number lives in JS.
