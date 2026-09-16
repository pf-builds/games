# Greedy Deep — LATER

Everything not in M1. Nothing here goes into the build without the PRD milestone it belongs to.
Source: `game-research/greedy-deep-PRD.md` sections 2, 14, 16, 17.

## M2 — engine and content (phase 4)
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

## M3 — art (phase 5)
- SpriteFactory: strata tiles with 4 cached variants per band via `hash(tx,ty) & 3`, seam dither,
  vein blobs, the next-band veil, shaft carve, braces, ladder.
- Dwarf composites: 14x16, 6 frames, four layers (body, beard, hat, pick) cached by loadout string.
  The beard is the joke; it survives every cut.
- Cart and elevator sprites.
- Scrolling camera following the deepest dwarf, eased, drag/wheel to look up, 3 s snap-back.
  M1 ships a static viewport with scrolling rock as the placeholder.
- SDXL-base title card, 416x608 WebP, 120 KB cap, splash only.

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
