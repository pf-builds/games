# Greedy Deep — LATER

Everything shipped through M4. Items below are deferred to playtest/v1.1/v2.

## Playtest (phase 7)
- 13 FLAVOR-TODO strings: Peter picks from `greedy-deep-flavor-candidates.md`, one replace pass.
  The flavor fallback system ensures no TODO text reaches a player.
- Real-phone touch check (carried from M1). Pointer handler does double duty
  (6 px threshold splits drag from strike); only tested with mouse and browser-pane emulation.
- Overnight save test before deploy.
- Ending scene upgrade: the M4 ending is a DOM panel with stats. The PRD describes a ~10 s
  procedural canvas scene (last tile shatters, camera pull-back via ctx.scale tween, drawn cavern
  with gold pile and columns, crew files in). The `ending` JSON block has timing params ready.
  If playtest time allows, build the canvas scene; otherwise ship the panel.

## v1.1 (JSON plus small engine)
Prestige ("Seal the shaft, keep the runes"), suffixes past T, extra ores/dwarves/tracks/flavor packs,
achievements page, multi-vein choice, the cart-eater event, cosmetic slots if they got cut from v1.

## v2 (new modules)
Monsters and gear at depth, multiple shafts, smelting chains, dwarf leveling.

## Explicitly out of v1 (PRD 2)
Steerable dwarf, destructible tile grid, pathfinding, prestige, combat, multiple shafts, crafting,
quests, backend, accounts, cloud save, leaderboards, ads, IAP, timers, real procedural strata,
"pick which vein next".

## Found during M4, parked
- The ending scene is a DOM overlay (panel with stats and KEEP DIGGING button), not the full
  procedural canvas scene from R4 §3. The timing params are in the `ending` JSON block for
  a future upgrade. Cut per PRD §16 to fit the 3 hr cap.
- Desktop rail content is rebuilt from cloned shop rows, which means the rail rows are
  copies rather than the same DOM nodes. A buy from the rail fires through the original
  row's handler. This works but is not elegant.
- FPS counter reads 0 in the Browser pane until the tab gets a real interaction (known from M1).
  Reads correctly on a real desktop tab (120 fps measured at 1280x900 with 18 dwarves).
- Ore pop arc (R4 juice: ore icon arcs from the vein to the cart) and cart dump odometer roll
  are deferred to playtest. The particle burst and floaters are in; the tween animations are
  juice polish.
- Per-purchase screen changes from M3 SPEC still apply. The M4 audio cues fire on every
  purchase (hire vs buy sound), and the row flash animation plays.
