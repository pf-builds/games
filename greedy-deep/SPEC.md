# Greedy Deep — Build Spec (M3: art pass)

Cabinet #7. Incremental mining game, side-view cutaway of one vertical shaft. Full contract:
`business/D-click-it-studios/game-research/greedy-deep-PRD.md`, with the sprite and audio
recipes in `greedy-deep-research-art.md` (R4). This file covers M1 (core loop), M2 (engine +
content) and M3 (art). M4 (audio, juice, portrait/desktop rails, ending scene, settings,
save export) is listed in `LATER.md`.

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

M3 adds: SpriteFactory (`src/sprites.js`) - Camera - TitleCard/splash. Every placeholder rect is gone.

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

## Deep Lantern and the reveal rule
`reveal_bands` raises the render cutoff to `d + 1 + revealBonus`, exactly as PRD §14 says. On its own
that was invisible: the viewport only looks ~26 m ahead and every band gap past the first is wider
(copper→silver 140 m, silver→starmetal 420 m), so the extra revealed band could never enter frame at
any depth. Each Lantern level now buys three things, all driven by the JSON `lantern` block, all
visible the moment it is bought:

| knob | effect | shipped |
|---|---|---|
| `forwardTilesPerLevel` | the dig face rides higher, so more of what lies ahead is on screen | 3 tiles (26 m → 38 m → 42 m of look-ahead) |
| `minFaceYBu` | floor on that bias, so the face never climbs into the depth readout | 88 bu |
| `veilAlphaPerLevel` | the next-band veil lifts, so revealed ore glints brighter through it | 0.12 (0.62 → 0.50 → 0.38) |
| `veilAlphaFloor` | floor on the veil, so unreached rock is never fully lit | 0.25 |

Plus a **next-bands readout** under the shaft: one line per band through `d + 1 + revealBonus`
("NEXT Green Copper 40 m", then "THEN Moonsilver 180 m" with one Lantern). It is built from the plan's
`nextBands`, not from the viewport, so a second level always adds a second line no matter how far the
boundary is. The depth ribbon's boundary ticks are clipped to the same cutoff, so an unrevealed
boundary is not leaked there either.

`bandPlan(depth, revealBonus)` therefore returns the render parameters as well as the band list:
`{indices, veiledIndices, maxIndex, cutoffIndex, currentIndex, revealBonus, faceYBu, forwardBiasBu,
forwardMeters, veilAlpha, nextBands[]}`. `selfTest` probes ten depths and requires the plan to differ
between revealBonus 0, 1 and 2 on at least one of band count, veil alpha, forward bias or readout
length — a list length the viewport cannot show is not enough.

The vein hotspot rides `vein.aboveFaceBu` above the face rather than at a fixed y, so it stays on open
wall as the face lifts; hit-testing, floaters and the tap hint all read the same rect.

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
| `src/sprites.js` | procedural sprite factory: strata tiles, seam dither, shaft parts, dwarf composites, cart, elevator, pixel logo. Builds once at boot |
| `src/particles.js` | pooled particles + floaters, copied verbatim from peasant-swarm. Staged for M4 |
| `src/render.js` | shaft canvas, camera, depth ribbon |
| `assets/title.webp` | the one generated asset: SDXL-base splash card, 416x608, 62.6 KB |
| `src/ui.js` | DOM, input, clocks, autosave |
| `src/save.js` | versioned localStorage save, migration walker |

`src/audio.js` is M4 and deliberately absent. `src/particles.js` ships now — the pooled
`Particles`/`Floaters` copied verbatim from peasant-swarm — but nothing spawns from it until the
M4 juice pass; it is staged, not wired.

`src/render.js` also exposes `bandPlan(depth, revealBonus)` — a pure function returning the band
indices this frame may draw, which of them are veiled, and the cutoff. `selfTest` asserts the reveal
rule against it rather than reading pixels.


## M3 — the art pass

### Sprite factory (`src/sprites.js`)
Everything is pre-rendered to offscreen canvases in `GDSprites.build(cfg)` at boot (and again on
a config swap) and blitted with `imageSmoothingEnabled = false`. **No frame allocates anything in
the tile blit path** — it is integer arithmetic and cached canvases only.

Copied verbatim from `peasant-swarm/src/sprites.js`, with the source named at the copy site:
the LCG `seed`/`rnd` pair, `make(w,h,draw)` with its `px`/`rect`/`ell` helpers, `flip(c)`,
`shade(hex,k)`, `outline(c)` and `silhouette(c)`. From `peasant-swarm/src/particles.js`: `Pool`,
`Particles` (burst/smoke/ring/update/draw) and `Floaters`, into `src/particles.js`.

| Sprite | Size (bu) | Frames / variants | Cache key |
|---|---|---|---|
| Strata tile | 16x16 | 4 per band, picked by `hash(tx,ty) & 3`; variant 3 carries the crack motif | `ores[].id` (endless bands reuse `baseId`) |
| Back-wall tile | 16x16 | the same 4, pushed into shadow — the far wall of the cutaway, so the bore is a carved space rather than a black hole | same |
| Seam dither strip | 154x32 | one per band pair: 2 px checker of the NEXT band's `palette.base`, 25% density on the upper tile row, 50% on the lower | `from>to@width` |
| Timber brace | 64x16 | 1, drawn every `layout.braceEveryRows` rows | — |
| Ladder | 6x64 | 1, tiled down the left face of the bore | — |
| Dwarf | 14x16 (12x14 of body + 1 bu outline margin) | **6**: 0 idle, 1 walkA, 2 walkB, 3 digWindup, 4 digImpact, 5 haul. Four layers composited at cache time: body, **beard**, hat, pick | `` `${beard}\|${hat}\|${pick}\|${tunic}\|${frame}` `` in a `Map` |
| Cart | 20x14 | 3 fill frames: empty / half / heaped, in the band's ore colour | band palette key |
| Elevator cage | 24x28 | 1. The rope is **not** a sprite: one 1 bu `fillRect` column redrawn each frame, so the cage travels any distance for free | — |
| "GREEDY DEEP" logo | 4x6 glyphs | 1, splash only | — |

Frame rates, layout spacing, cosmetic palettes, timber and metal colours all live in JSON under
`sprites`. Four dwarf loadouts x four pick tiers x six frames = **96 cached canvases**, built once;
`selfTest` asserts `dwarfCache <= loadouts x frames` and that the count does not move across 120
rendered frames.

**Purchase visibility (PRD 16, never cut).** Every track changes the shaft:

| Bought | What appears |
|---|---|
| Sharper Pick | the pick layer swaps tier every `sprites.pickLevelsPerTier` levels, on every dwarf |
| Drill Bit / dwarves | another dwarf on a ledge, in its own JSON `cosmetic` loadout |
| Bigger Cart | the cart runs half/heaped instead of empty/half |
| Deep Lantern | a hung lamp on the left face, a warmer bore, more forward view, a lighter veil, another readout line |
| Cart Rails | rail ties appear under the cart |
| Smelter | the bore light warms further |
| Shaft Braces | every timber brace doubles up |
| Elevator | a cage on a rope starts working the upper bore |

### Strata, veins, seams, veil
- Band palettes are JSON: `ores[].palette = {base, light, dark, speck}`. `validateConfig` rejects a
  band without one, so a missing palette fails loud instead of drawing a flat rect.
- **Veins are data, never baked into a tile.** They are generated per 64 bu chunk of world depth
  from a hash and cached in a `Map`, so an endless run never grows an array. Each is a 3-7 px blob
  of the band's `veinColor` plus one glint pixel pulsing on its own phase.
- **Seam dither** is drawn at every band boundary in view, clipped to the reveal cutoff — including
  the synthesized endless boundaries.
- **The veil** covers everything from the first revealed-but-unreached band down: a flat wash at
  `veil.alpha` (lifted per Deep Lantern level, floored at `lantern.veilAlphaFloor`) plus a
  1-in-`veil.scanline` scanline. Vein glints are re-drawn **after** the veil at half amplitude, so
  the next band's ore still winks through the dark.
- **Shaft carve:** a 2 bu bevel on each cut face, lit on the left and shadowed on the right, with a
  per-tile-row jitter from `hash(ty)` so the bore reads as hewn rather than cut by a laser.


### The blank sprite cache, and why nothing reads a canvas back any more

The M3 visual critic loaded the game in a tab that was hidden for its whole life and
measured **every** cached canvas at 0 opaque pixels — all four strata variants per band,
all six dwarf frames for every loadout, all three cart frames, the brace, the ladder and
the cage — while a freshly-keyed rebuild drew correctly. The shaft rendered as a flat
black rectangle at every depth and `stats.placeholderRects` stayed at 0 the whole time,
because the renderer *was* blitting; it was blitting empty canvases.

**Root cause.** The copied `outline()` from peasant-swarm reads each sprite back with
`getImageData` and writes the result straight over the original with `putImageData`. If
the read-back returns empty — which is what a 2D backing store the browser has hibernated
or lost returns — that write **wipes a sprite that had drawn correctly**, and nothing ever
re-checks the cache, so the blank is served for the life of the page. That accounts for
every sprite that goes through `outline` (dwarves and carts). For the tiles, brace, ladder
and cage, which never call `outline`, the blanking has to come from the backing store
itself or from a script-version mismatch — and there was a real one available: the `?v=`
query on every script lives *inside* `index.html`, which was itself served with no
cache directive, so a browser could pin an old document and keep loading old script
versions indefinitely while `config/greedy-deep.json` (fetched `cache: "no-cache"`) stayed
fresh. That mismatch was reproduced during the fix pass: a tab kept running
`sprites.js?v=6` for three version bumps.

**Fixes, all at the source:**
1. `outline()` no longer reads a pixel back. It composites the same 1 px rim by drawing
   the sprite at four offsets, tinting the dilation with `source-in`, and drawing the
   original on top. `outlineVerbatim()` — the copied algorithm — stays in the file, and
   `selfTest` asserts the two produce identical output pixel for pixel.
2. `GDSprites.verify()` walks every cache entry and counts opaque pixels;
   `GDSprites.ensure(strict)` rebuilds once if anything is blank, and throws in `?debug=1`
   if a rebuild still cannot produce pixels. `ensure()` runs after the build, on
   `visibilitychange` into view, and on `pageshow` — the moments a hibernated backing
   store surfaces as blank.
3. `selfTest` asserts every cache entry is opaque, that the count is what `GD.dbg` reports,
   and that `ensure()` is a no-op on a healthy cache. `GD.dbg.spriteCacheOpaque`,
   `spriteCacheTotal`, `spriteCacheRebuilds` and `spriteCacheBlank` are on the debug overlay.
4. The splash logo canvas gets the same guard, and is now DPR-scaled like the shaft canvas.
5. `index.html` carries `Cache-Control: no-cache, must-revalidate`, so the document that
   carries every `?v=` always revalidates.
6. Sprite canvas sizes come from JSON (`sprites.dwarfWBu/dwarfHBu/cartWBu/cartHBu/
   elevatorWBu/elevatorHBu`), never from a layout measurement, which reads 0 while hidden.
   `validateConfig` rejects a size the hand-placed pixel art was not drawn for.

The build itself was already correct on this point and stays that way: it is synchronous,
runs the moment the config fetch resolves, and never waits on rAF, a paint or a layout
measurement — so it behaves identically in a hidden tab. Verified by loading in a
background tab and measuring before fronting: 146 of 146 entries opaque, console clean.
The guard was then exercised by wiping ten backing stores by hand — detected, one rebuild,
back to 146 of 146.

### Camera (PRD 5, a v1 must)
World space is bu below the surface: `worldY = depth * layout.buPerMeter`. `cam.topBu` is the world
y drawn at screen y 0, so `screenY = worldY - cam.topBu`.

- The camera follows the **dig face**, which is where the deepest dwarf stands, and lands it at
  `effFaceY(revealBonus)` — the Deep Lantern's forward bias raises that line, so a lantern buys
  look-ahead without a second camera mode.
- Easing is `1 - (1 - camera.ease)^(dt*60)`, frame-rate independent and clamped so a long stall
  cannot overshoot.
- **Drag or wheel** scrolls back up the shaft, clamped to `camera.maxUpBu`. A pointer that moves more
  than 6 CSS px is a drag; a pointer that does not move is a strike on the vein, so one finger does
  both jobs. A banner says the camera is off the face.
- After `camera.snapBackMs` of no input the offset decays back to zero at `camera.snapEase`.
- A jump larger than `camera.snapThresholdBu` (a debug `jumpTo`, or a band-skip) snaps rather than
  scrolling for a minute.
- `GD.dbg.cameraY` is the world bu of the camera's focus line; `GD.dbg.deepestDwarfY` is the deepest
  dwarf's feet. `selfTest` steps the sim across a band break and requires them within **16 bu** after
  one second of render ticks.

### Crew layout
The working ledge holds `dwarvesPerRow - 1` dwarves and the cart parks in the last slot. Rows behind
hold a full `dwarvesPerRow`. When the crew outgrows the bore the **row pitch compresses** from
`sprites.dwarfRowBu` down to `sprites.dwarfRowMinBu` rather than dropping hires off the top; anything
that still does not fit is reported on screen as "+N CREW UP TOP", because a purchase that changes
nothing visible is a bug. `sprites.crewTopBu` keeps the stack clear of the band strip, plus
`sprites.elevatorClearBu` once a lift is working the upper bore.

### Depth ribbon
A 6 bu canvas overlay on the right edge: progress to the ending as a gold fill, a band tick per
revealed boundary (clipped to `d + 1 + revealBonus`, so an unrevealed boundary is not leaked here
either), and the ending marker at `milestone.depth`.

### Splash
The card is a portrait poster, so it sits inside a centred frame at its own scale with a
blurred, darkened copy of itself filling the rest of the viewport. At 1280x900 a bare
centred card left ~90% of the screen as empty void, which reads as an unstyled page rather
than a title screen (M3 critic). The logo is procedural pixels drawn at integer scale x DPR
with smoothing off, and the tagline sits in the same monospace register as the rest of the
chrome rather than adding a third typeface.

### Title card
One SDXL-base image, the only generated asset in the game. Portrait 832x1216 -> 416x608 WebP,
**62.6 KB** against a 120 KB cap, at `assets/title.webp`. It is the background of the splash only,
under a procedurally-drawn pixel logo and a DESCEND button, so the painted style and the pixel style
never meet at the same scale. It fades out on DESCEND and is never shown in play. The card is sized
to the same 160 bu column the game uses — covering the whole viewport crops a portrait poster to a
detail. Model, licence, prompt, seed and date are in `LICENSES.md`.

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
  without the engine importing any DOM. `onBand` also receives `{prevDepth, dt}` so a caller can
  interpolate the crossing back to the exact boundary. `selfTest` mutes the hooks for its run so a
  test never leaves a panel or a log line behind.
- `GD.reset()` reseeds the shared event rng to `sim.seed` (JSON, default 1), so
  `reset(); step(3600)` equals `reset(); 3600 x step(1)` with no extra ceremony. `GD.seed(n)`
  overrides it until the next reset.
- `simulate().bandLog` records each crossing at the **exact** JSON `startDepth` with the interpolated
  tick time; the tick's own overshoot is kept alongside as `tickDepth`.

`?debug=1` adds the overlay plus `setGold`, `setDepth`, `grant`, `pause`, `resume`, `timeScale`,
`clearSave`, and a guarded fallback interval clock so hidden tabs keep simulating.

## Acceptance — all run by `GD.selfTest()` (146 assertions, zero failures)
**M1 block:** reset/step(0) zeroes - 10 taps pay exactly `10 x goldPerTap` and never dig - `step(600)`
with no crew changes nothing - second purchase costs `base x ratio` - insufficient gold refused -
a hired dwarf digs at its `add_rate` - save shape and restore - `step(3600)` under 500 ms -
`step(3600)` equals 3600 x `step(1)` (same rng seed, since events now roll) - clearSave cannot be
resurrected by autosave - snapshot shape - config validates - console clean.

**M2 block:** all 12 verbs registered - 4/8/4/3 content counts - `simulate` reaches 1,200 m with
`reachedAtSeconds` in 5,400-10,800 and the call under 20 s - `maxGapSeconds < 300` - >=10 purchases in
the first 600 s - `bandLog` boundaries equal the JSON `startDepth` values exactly - every band income step is
within 10% of the `goldPerMeter` ratio - `policy: none` never digs, `policy: ratio` buys, an unknown
policy errors - `simulate` is deterministic for a seed - `reset()` reseeds so additivity holds without an explicit `seed()` - `offlinePreview(8h) === offlinePreview(24h) ===
goldRate x capSeconds x 0.5` - `offlinePreview(30s) === 0` - negative and absurd deltas clamp -
Elevator extends the cap and lifts the rate - `applyOffline` matches its preview - `fire('cave_in')`
moves depth exactly -5 m and logs its line - gas pocket halves the rate and expires - rich seam triples
gold - `minDepth` gates the shallow pool - Shaft Braces scale hazard weights by `0.9^n` and leave
non-hazards alone - offline fires no events - the milestone sets `endingSeen`, records
`goldEarnedTotal + depth x 100`, fires once, and the game continues - endless bands start after the last
ore and compound the multiplier - the renderer never draws past band `d + 1 + revealBonus`, does draw
the next band above a seam veiled, and **changes observably at ten probe depths for every extra reveal
level** (forward view, veil alpha, readout lines), with both floors respected - ETA is `(cost - gold) / goldRate`, Infinity (rendered as an em dash)
while the rate is 0, zero when affordable - every shop row carries a price and, when locked, an ETA -
no Tolkien Appendix A name anywhere in the shipped content - **a fifth ore and a fifth dwarf injected as
JSON with no JS edit produce a new band, a new hireable row in the shop, and a correct render plan** -
`validateConfig` rejects an unknown verb, an unknown pattern, a duplicate id and a non-monotonic
`startDepth`, and accepts the shipped file - console clean.

**M3 block:** the sprite factory is ready and every band has four tile variants - **no placeholder
rects at fourteen probe depths** (0 m through the endless bands), and the walls are blitted tiles at
every one of them - seam dither present at every authored boundary **and** at the first synthesized
endless boundary - the veil is painted above the seam and never past `d + 1 + revealBonus`, at
reveal levels 0, 1 and 2 - every hired dwarf is drawn - the dwarf cache stays within
`loadouts x frames` and does not grow across 120 frames - the camera crosses a real band break and
lands within 16 bu of the deepest dwarf inside one second of render ticks - a drag scrolls more than
100 bu off the face and the camera snaps back inside the snap-back window - `GD.dbg.cameraY` is a
number - the title card is between 1 byte and 120 KB and lives on the splash - `bands[].palette`,
`camera`, `veil.scanline` and `sprites` are all present in JSON - `validateConfig` rejects a missing
band palette, a zero `camera.ease`, an unknown cosmetic palette and a sprite canvas size
the art was not drawn for - **every one of the 146 cached canvases has opaque pixels**,
`GD.dbg.spriteCacheOpaque` agrees with the verified count, and `ensure()` is a no-op on a
healthy cache - the composite `outline()` matches the copied peasant-swarm algorithm pixel
for pixel - the splash logo has pixels and is DPR-scaled - `formatEta` never prints "60s",
"60m" or "24h" across 400 probes, and 2279.6 s formats as "38m 0s".

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

Not touched: band `startDepth` (40 / 180 / 600), `milestone.depth` 1200, the tunable `sim` values, `offline` block,
`endless`, all event numbers, and every effect verb. `pick.base` and the `goldPerMeter` column are the
only PRD table values changed for reasons other than curve shape.

**Result (`GD.simulate()`, shipped config):**

| policy | reaches 1,200 m | maxGap | purchases | in first 600 s | band steps |
|---|---|---|---|---|---|
| `cheapest-affordable` (default) | **6,702 s** (112 min) | **174 s** | 115 | **30** | x5.00, x3.00, x5.00, x1.50 endless |
| `none` | never (digRate stays 0) | — | 0 | 0 | — |
| `ratio` | 12,518 s | 823 s | 40 | 2 | x5.00, x3.00, x5.00, x1.50 endless |

(The default seed moved from a literal 1337 to `sim.seed` = 1, which shifts the event rolls and so the
timings by well under 1%. The Lantern changes are render-only and move no economy number.)

`none` proves depth comes only from hires. `ratio` is a diagnostic: it buys by marginal score per gold,
skips Sharper Pick entirely, and lands outside the window with long gaps — which is the expected shape
for a policy that ignores cadence. The acceptance window is measured against `cheapest-affordable`, per
PRD §8. The 14,400 game-second call runs in **7-17 ms**, far inside the 20 s bar.

Band times: coal 0-40 m in 1,112 s, copper 40-180 m in 1,494 s, silver 180-600 m in 2,354 s,
starmetal 600-1,200 m in 1,742 s. All twelve purchasables get bought at least once.

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
