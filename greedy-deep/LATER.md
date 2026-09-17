# Greedy Deep — LATER

Everything not in M1. Nothing here goes into the build without the PRD milestone it belongs to.
Source: `game-research/greedy-deep-PRD.md` sections 2, 14, 16, 17.

## M2 — engine and content (phase 4) — DONE 2026-09-16
- Full ore/band table: copper 40 m, silver 180 m, starmetal 600 m (JSON rows already shaped for it).
- Remaining 6 upgrade tracks: Bigger Cart, Deep Lantern, Cart Rails, Smelter, Shaft Braces, Elevator.
- Remaining 3 dwarves: Hald, Vessa Ledgerhand, Nix.
- Effect verbs still unimplemented: `add_rate_per_dwarf`, `reveal_bands`, `mul_hazard_resist`,
  `add_offline_hours`, `mul_offline_rate`, `mul_rate_temp`, `mul_gold_temp`, `add_depth`.
  (`validateConfig` already rejects them as reserved, so a JSON row cannot silently no-op.)
- EventScheduler: gas pocket, cave-in, rich seam. One roll every 90 s at 0.35, `minDepth` gated, never offline.
- OfflineResolver + welcome-back panel: 50% rate, 8 h cap, 60 s floor, 48 h skew clamp, entry-band rate.
- Milestone/ending logic at 1,200 m, `endlessAfter`, score `goldEarnedTotal + depth x 100`.
- `GD.simulate({maxSeconds, dt, policy, untilDepth, seed})` with the `cheapest-affordable` policy,
  plus `bandLog`, `purchases`, `maxGapSeconds`, `samples`.
- `GD.offlinePreview` / `GD.applyOffline`.
- ETA per locked row: `(cost - gold) / goldRate`, "—" while goldRate is 0.
- FlavorTable and the FLAVOR-TODO replace pass (Peter's jokes page).
- Name clearance pass: final dwarf/ore/upgrade names against the Tolkien Appendix A list and Warcraft.

## M3 — art (phase 5) — DONE 2026-09-16
- SpriteFactory (`src/sprites.js`): strata tiles with 4 cached variants per band via
  `hash(tx,ty) & 3` (variant 3 carries the crack), a shadowed back-wall set for the bore, seam
  dither strips, vein blobs as chunked data, the next-band veil, shaft carve with jittered bevels,
  braces, ladder.
- Dwarf composites: 14x16, 6 frames, four layers (body, beard, hat, pick) cached by loadout string.
  The beard survived, as promised.
- Cart (3 fill frames) and elevator cage (fillRect rope) sprites.
- Scrolling camera following the dig face / deepest dwarf, eased, drag or wheel to look up,
  snap-back after `camera.snapBackMs`. `GD.dbg.cameraY` exposed.
- SDXL-base title card, 416x608 WebP, 62.6 KB of a 120 KB cap, splash only.

## M4 — juice, mobile, save, ending (phase 6)
- AudioBus, 13-cue table, depth-reactive ambient drone, mute persisted in `prefs`.
- ParticleSystem, Floaters (M1 has a minimal floater for tap feedback only), screen feedback.
- Desktop rails: 240 px roster left, 300 px upgrade panel right, tab bar dropped.
- Roster strip and DIG/CREW/GEAR/LOG tabs in portrait.
- Ending scene: last tile shatters, camera pull-back, crew files in, score, KEEP DIGGING.
- SettingsPanel; save export/import as base64 + checksum, fail-safe on truncated or version-bumped input.

## v1.1 (JSON plus small engine)
Prestige ("Seal the shaft, keep the runes"), suffixes past T, extra ores/dwarves/tracks/flavor packs,
achievements page, multi-vein choice, the cart-eater event, cosmetic slots if they get cut from v1.

## v2 (new modules)
Monsters and gear at depth, multiple shafts, smelting chains, dwarf leveling.

## Explicitly out of v1 (PRD 2)
Steerable dwarf, destructible tile grid, pathfinding, prestige, combat, multiple shafts, crafting,
quests, backend, accounts, cloud save, leaderboards, ads, IAP, timers, real procedural strata,
"pick which vein next".

## Found during M1, parked
- The placeholder dwarf blips are drawn at fixed ledge slots and cap at 8. M3's camera and sprite
  work replaces that layout wholesale, so no point tuning it now.
- `format()` rounds to 3 significant figures with K and M live; B and T are coded but dormant.
  Worth re-checking against real late-game numbers once M2's curve exists.
- Autosave writes on every purchase as well as on the 5 s timer. If M2's event system adds more
  write points, move to a dirty flag.
- **fps readout owed a real-device check (M1 critic, MINOR).** After a cold `?debug=1` load in the
  Browser pane, `GD.dbg.fps` read 0 for a long stretch while `t` and `depth` advanced correctly;
  it read a steady 60 from the first interaction onward. fps is only computed inside `frame()`,
  never in the hidden-tab `simOnly()` path, so this looks like the pane not pumping rAF until the
  tab is painted. Spot-check on a real phone and a real desktop tab before M3/M4 lean on the
  readout for the 50 fps quality bar.

## Found during M2, parked
- **Portrait column is taller than the viewport.** At 375x812 the column measures ~1,350 px because all
  twelve shop rows plus the log are stacked. No horizontal scroll and every tap target is 44 px, but the
  page scrolls vertically. The PRD §5 portrait layout (roster strip + DIG/CREW/GEAR/LOG tab bar that
  collapses the shop to one tab) is M4 work and fixes this by construction. Do not band-aid it earlier.
- **Ending is a DOM panel, not the scene.** M2 ships title/body/score/KEEP DIGGING in a plain overlay.
  The ~10 s procedural scene (last tile shatters, camera pull-back, crew files in, fanfare) is M4.
- **`ratio` policy is a diagnostic only.** It scores marginal `digRate x 1000 + goldRate` per gold, which
  makes it skip Sharper Pick entirely and run with 800 s gaps. It exists to prove the economy is not
  only tuned for one buying order. Do not tune against it.
- **Offline crosses band boundaries in depth but not in income.** PRD §9 says income uses the entry
  band's rate with no mid-offline band change; depth still advances past a boundary, so a long absence
  can land the player two bands deeper than the gold they were paid implies. Deliberate, and cheap to
  revisit if it reads badly in playtest.
- **Veiled rock reads lighter than the band above it** when the next band's `wallColor` is brighter than
  the current one (coal -> copper). The veil is doing its job; the placeholder palette is the problem.
  M3 owns it.
- **`hald` and `nix` ship with a `nameNote` marker rather than a `FLAVOR-TODO:` name** so the shop stays
  readable. The markers are counted by `GD.dbg.flavorTodoCount` either way. Phase 7's replace pass has
  to look at `nameNote` as well as `flavor`.
- **Seam dither density is approximated.** `drawSeam` steps a 2 px checker over two rows rather than the
  PRD's exact 25% / 50% density pair. Real dither lands with the strata tiles in M3.
- **M2 critic fixes applied 2026-09-16** (`greedy-deep-critic-m2.md`): Deep Lantern made observable
  (forward bias + veil lift + next-bands readout, all JSON), `bandLog` crossings interpolated to the
  exact `startDepth`, `GD.reset()` reseeds from `sim.seed`, `ratio` policy weight moved to
  `sim.ratioDepthWeight`. The critic's M5 note stands for future critics: DOM reads must sync to two
  `requestAnimationFrame` ticks, not `setTimeout`, because `refresh()` runs off the game's own rAF loop.
- **Forward bias caps at two Lantern levels** (`minFaceYBu` 88). Past that the veil lift and the readout
  carry the reveal on their own. If M3's scrolling camera makes a taller look-ahead cheap, revisit the
  floor rather than adding a fourth mechanism.

## Found during M3, parked
- **Negative first frame dt (fixed, worth remembering).** The first `requestAnimationFrame`
  callback carries the timestamp of the frame that was already in flight when `boot()` ran, which
  can predate the `performance.now()` boot recorded. The unclamped `dt` went negative, ran the
  animation clock backwards, and indexed a cart frame at -1, which threw inside `draw()` and
  silently killed the rAF loop (the fallback clock kept the sim running, so the numbers looked
  fine while the canvas was frozen). `frame()` and `simOnly()` now clamp `dt` to >= 0 and
  `R.update` refuses a non-positive dt. **Add this to the studio's reusable lessons.**
- **The crew stack compresses instead of fitting.** Past ~20 hires the row pitch drops to
  `sprites.dwarfRowMinBu` (9 bu) and the dwarves overlap heavily; past that the overflow is
  reported as "+N CREW UP TOP". Two Deep Lanterns raise the dig face to its floor (88 bu), which
  costs about a third of the visible crew. It is labelled and deliberate, but M4's roster strip is
  the real answer — the roster should show the full crew, and then the shaft can stop apologising.
- **`src/particles.js` is staged, not wired.** The pooled `Particles`/`Floaters` are copied
  verbatim from peasant-swarm and loaded, but nothing spawns from them until the M4 juice pass.
  The M3 strike feedback is still the flat flash from M2.
- **The floaters in `render.js` are still the M1 minimal implementation**, not `GDParticles.Floaters`.
  M4 should delete the local one and use the pooled version.
- **Veiled rock reading lighter than the band above it is resolved.** The M2 note is closed: the
  JSON `ores[].palette` values are tuned together, the veil dropped to 0.50 with a 0.24 scanline,
  and `lantern.veilAlphaPerLevel` is 0.10 with a 0.22 floor.
- **Seam dither density is now exact.** The M2 approximation note is closed: the strip is
  pre-rendered as a 2 px checker at 25% on the upper tile row and 50% on the lower.
- **Unmined rock below the face is a large uniform field**, especially with a lantern's forward
  bias. The chunked veins break it up a little. If playtest calls it dull, the cheapest fix is more
  vein density per chunk in JSON, not more art.
- **The in-canvas depth readout became a thin band strip at the top** of the shaft, because the old
  centred panel sat in the middle of the bore and ate the crew's and the lift's headroom. Depth is
  also in the DOM top bar, so nothing was lost.
- **Real-phone touch check still owed** (carried from M1). The pointer handler now does double duty
  — a move over 6 CSS px is a camera drag, a still release is a strike — and that split has only
  been tested with a mouse and with the Browser pane's emulation.
- **fps readout check from M1 is closed on desktop.** A 62 s run at 1280x900 with 32 crew hired
  produced 1,921 frames, median 60 fps, 5th percentile 57, minimum 55, and **zero** samples under
  50. The cold-load `GD.dbg.fps` 0 reading still wants a real-device look.
