# Greedy Deep — LATER

Everything shipped through M5. Items below are deferred to playtest/v1.1/v2.

## Playtest
- Real-phone touch check (carried from M1). The pointer handler does triple duty now
  (6 px threshold splits drag from strike, and a hit on a pickup collects instead of
  striking); only tested with mouse, dispatched events and browser-pane emulation.
- Overnight save test before deploy.
- Pickup feel after the economy pass: a gem is ~20 s of real earnings and a chest
  triples all gold for 25 s. Check both read as worth a click, and whether the Nix price
  (now 500K) lands late enough to feel earned rather than walled.

## Found during M5, parked
- No spawn cue or edge indicator: a pickup that spawns while the player watches the shop
  can expire unseen. A soft glint cue on spawn would help active play.
- Deep Lantern reveal glint through the veil (the other half of the M5 depth idea; the
  lifetime bonus shipped instead).
- Free-crits chest buff needs a crit mechanic in the engine first.
- The geode's gem burst pays at once. Spawning real clickable gems around the geode would
  be juicier but needs pool room and placement rules.
- The band-intro card and the buff chip can overlap for a moment on narrow columns.

## Known quirk
- FPS counter reads 0 in the Browser pane until the tab gets a real interaction (known
  from M1). Reads correctly on a real desktop tab.

## v1.1 (JSON plus small engine)
Prestige ("Seal the shaft, keep the runes"), suffixes past T, extra ores/dwarves/tracks/flavor packs,
achievements page, multi-vein choice, the cart-eater event, cosmetic slots if they got cut from v1.

## v2 (new modules)
Monsters and gear at depth, multiple shafts, smelting chains, dwarf leveling.

## Explicitly out of v1 (PRD 2)
Steerable dwarf, destructible tile grid, pathfinding, prestige, combat, multiple shafts, crafting,
quests, backend, accounts, cloud save, leaderboards, ads, IAP, timers, real procedural strata,
"pick which vein next".
