# Greedy Deep — Build Spec (M2: engine and content)

Cabinet #7. Incremental mining game, side-view cutaway of one vertical shaft. Full contract:
`business/D-click-it-studios/game-research/greedy-deep-PRD.md`. This file covers M1 (core loop)
and M2 (engine + content). M3 (art) and M4 (juice/mobile/save/ending) are listed in `LATER.md`.

## Mechanic
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

## Entities
M1: Game (fixed-dt accumulator) - Shaft - Vein - Wallet - UpgradeTrack x2 - Dwarf x1 - Save v1 - `window.GD`.

M2 adds: Ore/Band table (4 bands + endless repeats) - EffectRegistry (all 12 verbs) - 8 upgrade tracks -
4 dwarves on the same hire engine - EventScheduler - OfflineResolver - Milestone/ending - FlavorTable -
`simulate` / `validateConfig` / `selfTest`.

## Verb vocabulary (the full v1 registry, `src/engine.js`)
Every handler is pure and folds one effect into an accumulator. A JSON row that names a verb not on this
list fails `GD.validateConfig()` loud.

| verb | folds into | used by |
|---|---|---|
| `add_click` | clickPower | Sharper Pick, Hald |
| `add_rate` | digRate (additive m/s) | Dorrik, Nix |
| `mul_rate` | digRate (multiplier) | Drill Bit |
| `mul_gold` | gold multiplier | Bigger Cart, Smelter, Vessa |
| `add_rate_per_dwarf` | digRate, times the crew headcount | Cart Rails |
| `reveal_bands` | how many bands render below the seam | Deep Lantern |
| `mul_hazard_resist` | hazard event weights | Shaft Braces |
| `add_offline_hours` | offline cap hours | Elevator |
| `mul_offline_rate` | offline pay rate | Elevator |
| `mul_rate_temp` | digRate, for `seconds` | gas pocket |
| `mul_gold_temp` | gold multiplier, for `seconds` | rich seam |
| `add_depth` | depth, once, at the moment it fires | cave-in |

`mul_*_temp` effects live in `state.timed` as `{verb, value, until}` and expire on **sim time**, not
wall-clock, so a paused or fast-forwarded game behaves the same. `add_depth` is instantaneous: it is
applied through the registry once and never enters a derived stat block.

## Bands and endless
`ores[]` is the band table; `startDepth` of the next entry ends this one. Past the deepest ore,
`endless {bandLengthM, multiplierPerBand}` repeats that band forever with `goldPerMeter` multiplied per
repeat. Repeat bands are synthesized and cached, so `bandAt()` allocates nothing in the tick path.
Adding a fifth ore pushes the endless start deeper automatically — no JS change.

## Offline (PRD 9)
`GD.offlinePreview(elapsedMs, state?)` is pure and returns `{seconds, cappedSeconds, gold, depth, reason}`.
Cap is `capHours + add_offline_hours` levels; pay rate is `ratePercent x mul_offline_rate`; below
`minSeconds` pays nothing; negative or beyond `maxClockSkewHours` clamps to zero with `reason: "skew"`.
Depth advances at the **entry band's** rate with no mid-offline band change. Events never fire offline.
`GD.applyOffline(ms)` mutates by exactly what the preview said.

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

`src/render.js` also exposes `bandPlan(depth, revealBonus)` — a pure function returning the band
indices this frame may draw, which of them are veiled, and the cutoff. `selfTest` asserts the reveal
rule against it rather than reading pixels.

## `window.GD`
Always present. `step(seconds)`, `tap`, `buy`, `reset`, `getState/setState`, `setConfig`, `costOf`,
`etaFor`, `derive`, `snapshot`, `bandAt`, `format`, `validateConfig`, `selfTest`, `save`, `config`,
`state`, `version`, `hooks`, `dbg`.

M2 adds the headless harness and the mutators the PRD §13 names:
- `GD.simulate({maxSeconds, dt, policy, untilDepth, seed, clicksPerSecond, sampleSeconds})` ->
  `{reached, reachedAtSeconds, finalDepth, finalGold, purchases[], purchasesFirst600, bandLog[],
  maxGapSeconds, samples[], owned}`. Policies `cheapest-affordable | none | ratio`.
- `GD.offlinePreview(ms, state?)` (pure) and `GD.applyOffline(ms)` (mutating).
- `GD.fire(eventId)`, `GD.jumpTo(depth)`, `GD.seed(n)`.
- `GD.hooks = {onEvent, onBand, onEnding}` — how the UI hears about events, band entry and the ending
  without the engine importing any DOM. `selfTest` mutes them for its run so a test never leaves a
  panel or a log line behind.

`?debug=1` adds the overlay plus `setGold`, `setDepth`, `grant`, `pause`, `resume`, `timeScale`,
`clearSave`, and a guarded fallback interval clock so hidden tabs keep simulating.

## Acceptance — all run by `GD.selfTest()` (100 assertions, zero failures)
**M1 block:** reset/step(0) zeroes - 10 taps pay exactly `10 x goldPerTap` and never dig - `step(600)`
with no crew changes nothing - second purchase costs `base x ratio` - insufficient gold refused -
a hired dwarf digs at its `add_rate` - save shape and restore - `step(3600)` under 500 ms -
`step(3600)` equals 3600 x `step(1)` (same rng seed, since events now roll) - clearSave cannot be
resurrected by autosave - snapshot shape - config validates - console clean.

**M2 block:** all 12 verbs registered - 4/8/4/3 content counts - `simulate` reaches 1,200 m with
`reachedAtSeconds` in 5,400-10,800 and the call under 20 s - `maxGapSeconds < 300` - >=10 purchases in
the first 600 s - `bandLog` boundaries land on the JSON `startDepth` values - every band income step is
within 10% of the `goldPerMeter` ratio - `policy: none` never digs, `policy: ratio` buys, an unknown
policy errors - `simulate` is deterministic for a seed - `offlinePreview(8h) === offlinePreview(24h) ===
goldRate x capSeconds x 0.5` - `offlinePreview(30s) === 0` - negative and absurd deltas clamp -
Elevator extends the cap and lifts the rate - `applyOffline` matches its preview - `fire('cave_in')`
moves depth exactly -5 m and logs its line - gas pocket halves the rate and expires - rich seam triples
gold - `minDepth` gates the shallow pool - Shaft Braces scale hazard weights by `0.9^n` and leave
non-hazards alone - offline fires no events - the milestone sets `endingSeen`, records
`goldEarnedTotal + depth x 100`, fires once, and the game continues - endless bands start after the last
ore and compound the multiplier - the renderer never draws past band `d + 1 + revealBonus` and does draw
the next band above a seam, veiled - ETA is `(cost - gold) / goldRate`, Infinity (rendered as an em dash)
while the rate is 0, zero when affordable - every shop row carries a price and, when locked, an ETA -
no Tolkien Appendix A name anywhere in the shipped content - **a fifth ore and a fifth dwarf injected as
JSON with no JS edit produce a new band, a new hireable row in the shop, and a correct render plan** -
`validateConfig` rejects an unknown verb, an unknown pattern, a duplicate id and a non-monotonic
`startDepth`, and accepts the shipped file - console clean.

## Tuning log (M2)
The PRD's §8 starting values reached 1,200 m in **249 s** against a 5,400-10,800 s window: 20-40x too
fast. Diagnosis, in order:

1. **Gold multiplier elasticity above 1.** For a multiplicative track with gain `v` and cost ratio `q`,
   the elasticity is `ln(v)/ln(q)`: how much income you buy per gold spent. Bigger Cart (1.12/1.18),
   Smelter (1.15/1.16) and Vessa (1.04/1.17) summed to **2.56**, so income scaled as roughly
   `spend^2.56` and `goldMul` reached 4x10^6 in a single run. Anything above 1 is runaway by
   construction; the whole economy has to sit below it.
2. **Tap income scales with the band.** `goldPerTap = clickPower x goldPerMeter x clickYield`, and the
   sim policy taps at 2/s for four hours. With `goldPerMeter` rising 300x and Sharper Pick at ratio 1.15,
   clickPower hit 125 and tapping alone paid ~37,000 g/s in the deepest band.
3. **`add_rate_per_dwarf` is quadratic.** Cart Rails multiplied by the crew headcount, and Hald and
   Vessa count as crew while being cheap, so 151 dwarves x 8 rail levels produced 17 m/s from one track.

The fix was not one number. A 1,200 m game whose income grows six orders of magnitude needs dig rate to
grow only ~10x, so rate has to be expensive and gold multipliers have to decelerate. Final values came
out of a randomised search over 7,200 configurations scored against all four §8 targets plus
time-to-first-purchase and time-to-first-hire, then rounded to designer-friendly numbers and re-verified.

| knob | PRD start | shipped | why |
|---|---|---|---|
| `start.clickYield` | 0.5 | **0.12** | tap income is multiplied by the band, so it had to come down or tapping funds the whole game |
| `pick` base / ratio | 10 / 1.15 | **3 / 1.22** | cheaper first purchase (12 s, was 71 s at the lower yield), steeper stack so clickPower settles near 55 rather than 125 |
| `bit` base / ratio | 120 / 1.15 | **150 / 2.1** | `mul_rate` elasticity 0.095/0.742 = **0.13**; was 0.68 |
| `cart` base / ratio | 400 / 1.18 | **500 / 2.2** | gold elasticity 0.14; was 0.68 |
| `smelter` base / ratio | 25,000 / 1.16 | **40,000 / 2.6** | gold elasticity 0.15; was 0.94, effectively free money |
| `vessa` base / ratio | 900 / 1.17 | **700 / 2.2** | gold elasticity 0.05; total gold elasticity now **0.34** |
| `lantern` ratio | 1.20 | **1.8** | at 1.20 the reveal bonus stacked to 16 bands; now it settles at 8 |
| `rails` base / ratio / value | 6,000 / 1.15 / 0.02 | **20,000 / 2.8 / 0.0005** | kills the quadratic; still the late-game crew payoff |
| `braces`, `elevator` ratio | 1.16 / 1.15 | **1.35 / 1.35** | they buy no income, so a flat ratio keeps them from stacking pointlessly |
| `dorrik` ratio / value | 1.15 / 0.05 | **2.8 / 0.012** | the first hire still starts depth in ~90 s, but the track stops at 9 levels instead of 62 |
| `hald` base / ratio | 150 / 1.15 | **400 / 2.2** | clickPower is a multiplier on band income; it cannot stack freely |
| `nix` base / ratio / value | 4,000 / 1.16 / 0.4 | **150,000 / 2.6 / 0.6** | Nix is the endgame unlock, bought once near 1,200 m, not before starmetal |
| `goldPerMeter` | 1 / 6 / 40 / 300 | **1 / 5 / 15 / 75** | 300x of exogenous income growth over a 1,200 m run overwhelms any cost curve; 75x keeps the band steps feeling big (x5, x3, x5) without handing out 13 free levels on every track at once |

Not touched: band `startDepth` (40 / 180 / 600), `milestone.depth` 1200, `sim` block, `offline` block,
`endless`, all event numbers, and every effect verb. `pick.base` and the `goldPerMeter` column are the
only PRD table values changed for reasons other than curve shape.

**Result (`GD.simulate()`, shipped config):**

| policy | reaches 1,200 m | maxGap | purchases | in first 600 s | band steps |
|---|---|---|---|---|---|
| `cheapest-affordable` (default) | **6,740 s** (112 min) | **175 s** | 115 | **30** | x5.00, x3.00, x5.00, x1.50 endless |
| `none` | never (digRate stays 0) | — | 0 | 0 | — |
| `ratio` | 12,394 s | 817 s | 40 | 2 | x5.00, x3.00, x5.00, x1.50 endless |

`none` proves depth comes only from hires. `ratio` is a diagnostic: it buys by marginal score per gold,
skips Sharper Pick entirely, and lands outside the window with long gaps — which is the expected shape
for a policy that ignores cadence. The acceptance window is measured against `cheapest-affordable`, per
PRD §8. The 14,400 game-second call runs in **7-17 ms**, far inside the 20 s bar.

Band times: coal 0-40 m in 1,112 s, copper 40-180 m in 1,494 s, silver 180-600 m in 2,396 s,
starmetal 600-1,200 m in 1,738 s. All twelve purchasables get bought at least once.

## Flavor
`config/greedy-deep.json` carries a `flavor` block: band intros, dwarf lines, event texts, the ending
copy and welcome-back lines. Anything Peter's jokes page still owes carries the literal prefix
`FLAVOR-TODO:` and `GD.dbg.flavorTodoCount` reports the remaining count (**13** as shipped). Hald and
Nix ship with their PRD first names and a `nameNote` marker for the surname rather than a
`FLAVOR-TODO:` name, so the shop stays readable during playtesting; both markers are counted.

**Name clearance (manual pass, M2):** Dorrik, Hald, Vessa, Nix, Blackrock Coal, Green Copper,
Moonsilver, Starmetal, Sharper Pick, Drill Bit, Bigger Cart, Deep Lantern, Cart Rails, Smelter,
Shaft Braces, Elevator — checked by hand against the PRD §3 Tolkien Appendix A list and against
Warcraft and Deep Rock Galactic dwarf names. No hits. `selfTest` re-runs the Appendix A check on every
run so a future JSON edit cannot reintroduce one. Note for Peter: "Moonsilver" is also a generic D&D
material term (not a protected mark, and not Tolkien's "mithril"), flagged only so the USPTO pass
covers it.

## Asset manifest
Everything drawn in code. No downloaded art, no audio, no fonts fetched over the network (the shell
uses the system monospace stack). See `LICENSES.md`.

## Content-as-data rule
Adding an ore, dwarf, or upgrade that reuses an existing effect verb and pattern id is a JSON entry
with zero JS edits. Unknown verb, unknown pattern, duplicate id, or non-monotonic `startDepth` fails
`GD.validateConfig()` loud. No gameplay number lives in JS.
