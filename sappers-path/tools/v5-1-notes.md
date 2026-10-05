# Sapper's Path v5.1: a win goes back to the map

2026-10-06. Peter's playtesters found that a win went straight into the next level, so players missed the side quests and easter eggs on the journey map. This changes the post-level flow only. There is no rule, level or engine change. SPEC-v4 §9 has the decision entry.

## The flow as built
- **Win sheet** (a level, a side quest, the boss's "Crown taken!", a debug level): the main button is **Back to map** (`layout.toMap`) and the second is Retry. Coins, the first-clear ribbon, quest prize toasts and the report rows are all unchanged.
- **Fail sheet**: Retry stays the main button. The second already went to the map and labelled itself "Map". It now reads **Back to map**, the same as the win's.
- **The map after a win** (`main.js` `toMap`): `showScreen("map")` scrolls the current node `map.curAt` down the view, as before. That node is the newly opened next level, or the long tail's node once every level is cleared. Then `freshPulse` scales the node's badge, and any side quest the win opened, `map.fresh.pulses` times. It uses the Web Animations API on `.bd`/`.qf`, which carry no transform of their own. Under reduced motion (`app.V.calm`) nothing pulses. The quests a win opened are computed once in `ended()`: open quests before `Save.record` against after (`openQs`), stored in `app.fresh`. A fail sets it to null.
- `nextPicture`/`galNext` went with "Next picture" (no other caller). `gallery.nextBtn` is removed. `playNext` stays, for Home's and the map's Play.
- Fixed in passing: the old line that set the primary button's tag had its `playTag(pp, nextE)` inside a `//` comment, so the call never ran. The button now calls `playTag(pp, null)`, because a map button has no level tag.

## AD HOOK: the x2 reward
- Config: **`meta.double`** `{ on: false, btn: "x2 coins", ad: "Watch an ad", toast: "+{n} coins: reward doubled" }`. **The switch is `meta.double.on`**, and it is off.
- Markup: `#p-x2` (`.x2-ad`, the continue's green style), hidden. `x2Offer(e)` shows it only when `on === true`, the sheet is a win, and the report paid coins that have not been doubled yet.
- Tap: `onDouble` → `adReward(x2Run)`. `adReward(grant)` is the stub: with no SDK it grants at once. An SDK would show its ad there and call `grant()` from its reward callback. `x2Run` → `Meta.double(save, report)` pays `report.coins` once more, marks `report.dbl`, saves, hides the button and toasts. `countCoins` counts to `coins + dbl`. Retry's next win gets a fresh report, so the offer comes back.
- The continue's own hook (`#p-cont-ad`, v5 R1) is untouched. LATER notes pointing both at `adReward` once an SDK exists.

## Tests
- `tools/test.js` (+3 checks): `Meta.double` pays once per win, pays nothing with nothing to double, and keeps the balance capped. Config has the switch off, `toMap` set and `nextBtn` gone. Source check: the panel buttons route win → map / retry and fail → retry / map, never into a level, and the x2 offer and tap both need `on`.
- `SP.selfTest()` (+5 checks):
  - Section 11: off means not rendered. "Back to map" opens the map with the next node in view (current, pulsing) and map Play hittable.
  - Jam: the fail sheet's second reads "Back to map" and goes there.
  - Boss: "Crown taken!" goes back to the map.
  - Map quests: level 4 (side quest 1's main level) is won through play, and the map shows picture 1 just opened, with its node and prize bubble in view, pulsing. Picture 1's win then goes back to the map, not on to picture 2.
  - Report: the x2 hook switched on in a copy of meta. It shows and is hittable, a tap pays +coins once, a second tap or call pays nothing, the count reaches 2x, and Retry's win offers it again.
- `tools/harness.mjs`: level 1's real-tap win → "Back to map" → map with level 2 current and in view, no x2 button → the map's Play loads level 2 (was: Next loads level 2).

## Results (2026-10-06)
- `node tools/test.js`: 569 passed, 0 failed.
- `node tools/freeze.js --require`: PASS (castles 283 cases, 0 differences).
- `node tools/regrade.js`: 200 levels, 1155 checks, 0 differences. `--gallery`: 60 levels, 360 checks, 0 differences.
- `SP.selfTest()` under `?debug=1`: 375x812 at 3x, 770 passed, 0 failed. 1280x720, 772 passed, 0 failed. 0 console messages.
- Under reduced motion, selfTest fails the same 3 older shake checks as HEAD does (HEAD 762/3, now 767/3). The new v5.1 checks pass there with no pulse. This is parked in LATER.
- `node tools/harness.mjs`: all passed on all 7 viewports (selfTest 770 or 772 with 0 failures in each), 0 console messages, run last.

## Shots
`tools/shots-v5-1.mjs` writes to `tools/shots-v5-1/` (gitignored), phone 375x812 at 3x and desktop 1280x720, on a fresh save with real taps on the sheet buttons:
- `*-q1-win-4`: the win sheet.
- `*-q1-map-after-win-4(-pulse)`: level 5 current, picture 1 just opened with its Ladder prize, eggs in reach.
- `*-mid-win-40` / `*-mid-map-after-win-40(-pulse)`: level 41 current and picture 10 just opened. On desktop it sits near the column's foot, still in view.
- `*-lose-46`: Retry is the main button and Back to map the second.
- `*-boss-win` / `*-boss-map`: "Crown taken!", then the map at the long tail.
- The script clears the power-up unlock tips a fresh save queues before it takes the sheets.
