# Kitten Forest re-installed on outlined boards: v6 lane D, piece D4 (2026-10-07)

Zen World 2 (Land 1, levels 201-250, ids e9-201..e9-250) under Peter's ink-outline rule. Inputs: lane C's hand-off
(`game-research/sappers-path-v4/lands/01-kitten-forest/README.md`, "Under the ink-outline rule"; `picks-ink.json`,
`room-ink.json`, `boards-ink/`; cleaned sources in `/Users/peter/local-ai/outputs/lands/01-kitten-forest/clean/`).
Peter's calls of 2026-10-07 are binding and were followed as written: same 50 pictures, order, ids and slots, no
spares; 15 levels keep their live board and record byte for byte; the other 35 take the outlined board and are re-baked
on the land's casual profile with their slot's tag and features; only land 1's records in levels.json change.

## 0. D5 fix pass (2026-10-07): 18 kept, 215/245 re-dealt, 212/229 mystery raised

Inputs: the ink critic's report (`tools/critic-land-01-ink.md`, PASS with should-fix items, 0 blockers; screenshots in
`tools/critic-land-01-ink/`), Peter's and the orchestrator's calls. Sections 1-9 below are D4's record; where D5 changed
a number, the per-level table carries the new one (marked D5) and this section says why.

- **Three more kept (Peter, 2026-10-07; critic should-fix 4).** 207 kf96 Scruff carry, 236 kf76 Blueberry bucket and 250
  kf34 Xylophone read worse outlined than painted, so they went back to their live boards and records, byte-identical to
  1ff4ac4's. Their manifest lines and `src/` files are 1ff4ac4's again (painting, chroma 2.8 / 1.7 / 1.4), so a full
  `convert --force` reproduces exactly what ships: it changed only those 3 boards, and each matches its record's palette and
  size. Kept is now 18 (203 205 206 207 208 209 210 214 219 225 228 233 234 236 238 243 248 250); 32 outlined.
- **A careful-player floor (critic should-fix 1).** land.json `profile.carefulFloor` {easy 0.5, normal 0.5}: the careful
  player (3 taps ahead, 16 games) under the floor is no pick (`land-bake.js targetsOf` careLo: out of `good`, in the
  fallback penalty at `penalty.careful`, in `why`), and `land.js check` gates it on every Easy and Normal level (kept ones
  too). 215 re-dealt at 1.0 (was 0.063; same tag, linked 1 pair + mystery blocks, 30 blocks as before, fill plum) and 245
  at 0.875 (was 0.375; linked 1 pair). Both picks met every target, no fallback. Test: "lands (careful floor, D5)".
- **Careful rates, every Easy and Normal among the 32:** 201 N 1, 202 N 1, 204 N 1, 211 N 1, 213 E 1, 215 N 1, 216 E 1,
  217 N 1, 218 N 1, 220 N 1, 221 N 1, 223 E 1, 224 N 0.563, 226 N 0.875, 227 E 1, 230 E 1, 231 N 1, 232 E 1, 235 N 1,
  237 E 1, 239 E 1, 240 N 1, 241 E 1, 242 N 1, 244 E 1, 245 N 0.875, 246 E 1, 247 N 1, 249 N 1. None is under 0.35; the
  lowest is 224 at 0.563 (over the floor, left as is). The 3 outlined Hards (no floor): 212 0.625, 222 1, 229 0.938.
- **More mystery blocks on 212 and 229 (critic should-fix 3).** land.json `profile.features.hidden.byLevel` {212: 0.9,
  229: 0.9}, a level's own share of the eligible blocks in place of the planned one (`land.js bake`, applied to the plan
  before the jobs). The room measured first (hidePic over 9 seeds, the outlined boards' eligible blocks: off the ink,
  the ground and the face): 212 kf38 34-47 at 0.8 and over (20 at 0.35), 229 kf95 36-46 at 0.7 and over (23 at 0.35); both
  boards can pass 30. Shipped: **212 37** (was 20), **229 44** (was 21). Same tags and features; 212 re-dealt at 9.3%,
  careful 0.625, 244 s; 229 at 11.5%, careful 0.938, 251 s, 2 pairs. On 229 the blocks sit as one green lattice on the
  white belly (the only eligible stretch); it reads as a feature at 375 (screenshot in this session's scratchpad only).
  207, 217 and 231 keep their look (207 is a painting again).
- **Mixed look (critic should-fix 2): not in scope.** Peter's settled call is to keep the 18 paintings; World 2 shows
  two styles side by side (the opening 203-210 is 7 paintings of 8 now), and mystery blocks look like confetti on the kept
  208, 210, 228 and 207 and like patches on the outlined ones. A known trade-off.
- **Minor items:** none was both cheap and data/tool-only (the ink specks on 201 and 240 need a board change and a
  re-deal; the rest is art, layout or Zen code), so each is a LATER.md line.
- **Bake:** `bake --list 212,215,229,245 --keep <18> --shard 2 --reuse --extra 16`, 42 shards, 3.3 min; then `assemble
  check reinstall --keep <18>`. levels.json vs 75fef32: exactly 207 212 215 229 236 245 250 differ; vs 1ff4ac4: exactly the
  32 outlined records.
- **Checks:** land check PASS every gate (median 235 s; the new careful-floor gate; random-tap Easy 66.8% (18), Normal 36.7%
  (26), Hard 11.8% (6); careful mean 0.969); ink-outline 32/32; test.js 703/0; regrade 0 of 2,405, `--gallery` 0 of 372,
  `--zen` 0 of 324; critic-v5 0 mismatching games of 10,527, 0 grade mismatches, known answers 0 wrong, pace 312/312;
  freeze re-snapshot, diff vs 1ff4ac4's snapshot: levels.json the 32 outlined records only, gallery and castles
  identical, zen.json levels identical and World 1's name and lore ("The Gallery" to "Picture Garden"), frozen.json's
  date; `--require` PASS. Cache `?v=56`. selfTest 868/0 at 375x812@3, 870/0 at 1280x720, harness all passed, 0 console;
  the 7 changed levels load and play at 375 with 0 console.
- **Payload:** tracked files outside tools/ 18,978,627 B (+636 on D4); portal build ≈ 14,614,614 B (14.61 MB).
- **Contact sheet:** `tools/land-01-ink/contact.png` re-made, the 18 kept in amber.

## 1. What changed, per level class

| Class | Levels | What ships |
|---|---|---|
| Kept (15) | 203 kf14, 205 kf87, 206 kf61, 208 kf36, 209 kf54, 210 kf85, 214 kf77, 219 kf47, 225 kf20, 228 kf52, 233 kf16, 234 kf84, 238 kf44, 243 kf73, 248 kf99 | the v6.0 record, byte-identical (painting board, same deal, grade, stored order) |
| Re-dealt (35) | the other 35 | the outlined board (lane C's clean source through the game's own prep, convert with `kinds.outlined`, shade), dealt again with the same tag and the same feature list as the slot had |
| Everything else | levels 1-200, the 12 Wandering Gallery side quests, the 7 map sheets, zen.json, places.json, config.json, LICENSES.md | untouched (git: only levels/levels.json changes among the game's data files) |

Every re-dealt slot kept its tag and its exact feature list (the plan is deterministic from land.json's unchanged
profile, and it equals the v6.0 records' `tag` and `feats` on all 50). The amounts also match slot for slot: ? cards
2/2/3 as before, linked pairs 1-2 as before. The one thing that changed in amount is mystery blocks (§3).

## 2. Boards

- `tools/lands/01-kitten-forest/pictures/manifest.json`: the 35 re-dealt pictures and the 27 spares now carry lane C's
  outlined lines (`kind: "outlined"`, `file: clean/<key>.png`); the 15 kept keep their painting lines, so a full
  `convert` of the land folder reproduces exactly what ships. The 35 sources in `src/` were re-made from the cleaned
  files (prep with the local-ai venv's Pillow, as lane C's hand-off did); the 15 kept sources are unchanged.
- `convert --force`: the 15 kept boards and the 12 side boards came out byte-identical to the v6.0 bake's boards.json.
  Of the 35 outlined boards, 23 are identical to lane C's `boards-ink/` and 12 differ only by the ink's `sh` (and the
  shade digit on ink cells): kf03 kf23 kf28 kf37 kf38 kf45 kf56 kf62 kf74 kf92 kf95 kf100. That is the D3 fix: the
  fade-floor lift moved those inks to #17131c / #110c17, and shadeOf now skips the ink by id, so the outline is one solid
  black instead of three blacks. Grids identical. (The other 5 of D3's 17, kf09 kf16 kf20 kf24 kf54, are kept or spares.)
- 250 kf34 Xylophone: board ground id 1 (#4d597e, the navy lifted to slate; stats.bg #435074), ink id 2. Its slot has
  no mystery blocks (hard: linked 2 pairs + 3 ? cards, as in v6.0); the ink check below reads its ground by id and finds
  every subject cell shut in and 12 ink cells off the line (the eyes and dark keys), 0 on the ground.

## 3. Slot and feature calls (mystery blocks)

The outlined kind pins the ground and the ink, and `hidePic` never hides either (by id since D3), and keeps off the
face. So the room for mystery blocks is much smaller than on the painting boards, where the whole ground was eligible.
Measured on the 8 re-dealt mystery-block slots at each slot's own planned share (0.30-0.35 of the eligible blocks; 9
seeds), every one has room at or over the engine's floor of 20, so **no slot dropped its feature** and none needed a
profile change. What shipped:

| Level | Picture | v6.0 blocks | now | Note |
|---|---|---|---|---|
| 207 | kf96 Scruff carry | 290 | 64 | D5: kept again, its painting and 290 blocks |
| 212 | kf38 Skateboard | 281 | 20 | at the floor (median 20, min 20 over 9 seeds); under lane D's 24+ line. Kept the feature at the profile's share rather than raising it for one slot. D5: raised to 37 (byLevel 0.9; §0) |
| 215 | kf45 Apple weights | 242 | 30 | |
| 217 | kf08 Strawberry hug | 249 | 49 | |
| 222 | kf72 Rainbow slide | 279 | 29 | |
| 229 | kf95 Calico stretch | 295 | 21 | just over the floor; under 24, same call as 212. D5: raised to 44 (byLevel 0.9; §0) |
| 231 | kf06 Blanket bundle | 202 | 68 | |
| 247 | kf74 Leaf umbrella | 237 | 43 | |

The three kept mystery slots (208, 210, 228) keep their live boards and their 322 / 273 / 232 blocks. So mystery blocks
now cover 1-5% of a re-dealt picture where they covered 14-24%: the feature is on every slot it was on, but on the
outlined boards it is light. If Peter wants more there, the lever is the profile's `hidden.of` (it moves every slot's
share) or a per-level share key (new code); neither was done.

- kf56 (213 Staring contest): an Easy slot with ? cards only, no mystery blocks in v6.0 or now, so its low room (19 at
  0.45 after D3) doesn't matter. No other non-mystery slot is affected either.
- Fills: each mystery level's fill is 20+ from its picture (207 26, 212 37, 215 22, 217 26, 222 28, 229 33, 231 23, 247
  24; the kept 208 23, 210 24, 228 28). 212, 222 and 229 now take forest green (v6.0: slate, slate, plum), 231 plum (v6.0 green), the rest
  as in v6.0 (207, 215, 217 plum; 247 raspberry).

## 4. The bake

`land.js bake --list <the 35> --keep <the 15> --shard 2`: 145 candidate shards, about 2.5 minutes on 16 threads; 34 of
35 met every target first time. 232 kf28 Tuba (Easy, 42x45) came out a fallback at 303 s real pace (range 150-300); `bake
--list 232 --shard 2 --reuse --extra 12` picked a 268 s candidate. No fallbacks remain.

The 35 re-dealt, as graded: stored order wins on its tag with no power-up, 5 spaces at most, longest tap 14.2-15.0 s,
42-55 taps, real pace 171-283 s (median 243 s), the steady 1 s replay and every thinking replay win, longest steady gap
13.3 s. The whole land: median real pace 235 s (gate 200-250); random-tap win rate Easy 66.8% (18), Normal 37.0% (26),
Hard 12.6% (6), in the casual bands; careful player mean 0.95 (v6.0 0.97). Low careful-player rates, reported, not gated
(the casual profile has no careful ceiling): 215 0.063, 245 0.375, 224 0.563 (v6.0's own lowest were 212 0 and 250 0.625).

Per-level table (all 50 as installed):

| Level | Picture | Board | Tag | Features | ? cards | Links | Mystery blocks (v6.0 > now) | Rate | Careful | Real pace | Longest tap | Steady gap | Taps | Fill |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 201 | Teacup kitten (kf01) | 41x46 outlined | normal | mystery | 2 | - | - | 34.3% | 1 | 217 s | 14.9 s | 5.6 s | 55 | - |
| 202 | Red guitar (kf30) | 39x45 outlined | normal | mystery | 2 | - | - | 36.3% | 1 | 243 s | 14.9 s | 10.6 s | 54 | - |
| 203 (kept) | Paper bag (kf14) | 40x46 painting | easy | - | - | - | - | 59.8% | 1 | 217 s | 14.9 s | 8.9 s | 52 | - |
| 204 | Heart balloon (kf10) | 35x46 outlined | normal | mystery | 2 | - | - | 33.8% | 1 | 234 s | 14.7 s | 6.3 s | 52 | - |
| 205 (kept) | Lynx kitten (kf87) | 42x42 painting | normal | linked | - | 1 | - | 40.0% | 1 | 222 s | 14.8 s | 10.7 s | 48 | - |
| 206 (kept) | Firefly (kf61) | 40x46 painting | easy | linked | - | 1 | - | 62.3% | 1 | 251 s | 14.5 s | 10.6 s | 49 | - |
| 207 (kept, D5) | Scruff carry (kf96) | 41x46 painting | normal | hidden | - | - | 290 | 38.8% | 1 | 235 s | 14.9 s | 7.6 s | 51 | #6b4c8a |
| 208 (kept) | Soccer kick (kf36) | 42x35 painting | normal | hidden | - | - | 322 | 41.8% | 1 | 249 s | 14.8 s | 13.9 s | 51 | #6b4c8a |
| 209 (kept) | Fish dream (kf54) | 42x45 painting | easy | - | - | - | - | 67.8% | 0.938 | 217 s | 14.8 s | 5.8 s | 54 | - |
| 210 (kept) | Snow leopard cub (kf85) | 42x40 painting | normal | mystery, hidden | 2 | - | 273 | 32.5% | 1 | 203 s | 14.3 s | 8.1 s | 51 | #6b4c8a |
| 211 | Mushroom house (kf60) | 30x45 outlined | normal | mystery | 2 | - | - | 32.0% | 1 | 224 s | 14.5 s | 6.2 s | 50 | - |
| 212 | Skateboard (kf38) | 42x44 outlined | hard | mystery, hidden | 3 | - | 281 > 37 (D5; D4 20) | 9.3% | 0.625 | 244 s | 14.8 s | 9.1 s | 54 | #2e6b2e |
| 213 | Staring contest (kf56) | 42x29 outlined | easy | mystery | 2 | - | - | 71.8% | 1 | 227 s | 14.4 s | 10.4 s | 51 | - |
| 214 (kept) | Robin friend (kf77) | 42x39 painting | normal | mystery | 2 | - | - | 35.3% | 1 | 260 s | 15.0 s | 8.8 s | 53 | - |
| 215 | Apple weights (kf45) | 42x41 outlined | normal | linked, hidden | - | 1 | 242 > 30 | 35.5% | 1 (D5; D4 0.063) | 224 s | 14.9 s | 13.7 s | 51 | #6b4c8a |
| 216 | Too-big hat (kf15) | 36x46 outlined | easy | mystery | 2 | - | - | 74.8% | 1 | 223 s | 14.8 s | 5.9 s | 49 | - |
| 217 | Strawberry hug (kf08) | 42x37 outlined | normal | mystery, hidden | 2 | - | 249 > 49 | 39.8% | 1 | 215 s | 14.2 s | 9.3 s | 54 | #6b4c8a |
| 218 | Mirror lion (kf55) | 42x41 outlined | normal | mystery | 2 | - | - | 32.8% | 1 | 260 s | 14.9 s | 8.4 s | 55 | - |
| 219 (kept) | Kite flying (kf47) | 36x46 painting | easy | linked | - | 1 | - | 78.0% | 1 | 255 s | 15.0 s | 14.3 s | 47 | - |
| 220 | Heart curl (kf100) | 39x46 outlined | normal | linked | - | 1 | - | 36.5% | 1 | 283 s | 15.0 s | 8.4 s | 52 | - |
| 221 | Goalie (kf43) | 42x39 outlined | normal | mystery | 2 | - | - | 35.8% | 1 | 234 s | 14.2 s | 10.1 s | 46 | - |
| 222 | Rainbow slide (kf72) | 42x39 outlined | hard | mystery, hidden | 3 | - | 279 > 29 | 10.3% | 1 | 247 s | 14.9 s | 7.0 s | 52 | #2e6b2e |
| 223 | Maine Coon (kf94) | 35x46 outlined | easy | - | - | - | - | 58.0% | 1 | 225 s | 14.8 s | 7.3 s | 46 | - |
| 224 | Cucumber fright (kf51) | 42x46 outlined | normal | mystery | 2 | - | - | 41.5% | 0.563 | 245 s | 14.8 s | 10.3 s | 48 | - |
| 225 (kept) | Upside down (kf20) | 35x46 painting | easy | mystery | 2 | - | - | 66.8% | 1 | 233 s | 14.7 s | 9.1 s | 52 | - |
| 226 | Big blue bow (kf03) | 39x45 outlined | normal | linked | - | 1 | - | 34.3% | 0.875 | 269 s | 14.8 s | 12.5 s | 53 | - |
| 227 | Glowing flower (kf62) | 42x31 outlined | easy | - | - | - | - | 68.5% | 1 | 171 s | 14.7 s | 7.0 s | 42 | - |
| 228 (kept) | Bread face (kf52) | 42x39 painting | normal | hidden | - | - | 232 | 39.3% | 1 | 219 s | 14.5 s | 8.6 s | 46 | #6b4c8a |
| 229 | Calico stretch (kf95) | 40x46 outlined | hard | linked, mystery, hidden | 3 | 2 | 295 > 44 (D5; D4 21) | 11.5% | 0.938 | 251 s | 14.9 s | 10.4 s | 54 | #2e6b2e |
| 230 | Marching drum (kf27) | 39x46 outlined | easy | mystery | 2 | - | - | 65.5% | 1 | 220 s | 14.8 s | 6.8 s | 54 | - |
| 231 | Blanket bundle (kf06) | 34x46 outlined | normal | linked, hidden | - | 1 | 202 > 68 | 33.0% | 1 | 227 s | 14.9 s | 6.1 s | 49 | #6b4c8a |
| 232 | Tuba (kf28) | 42x45 outlined | easy | linked | - | 1 | - | 71.0% | 1 | 268 s | 15.0 s | 10.0 s | 55 | - |
| 233 (kept) | Dandelion sneeze (kf16) | 39x46 painting | normal | linked | - | 1 | - | 46.5% | 1 | 225 s | 14.8 s | 7.5 s | 55 | - |
| 234 (kept) | Tiger cub (kf84) | 42x42 painting | easy | - | - | - | - | 61.5% | 1 | 235 s | 14.6 s | 10.0 s | 51 | - |
| 235 | Tennis (kf41) | 42x43 outlined | normal | mystery | 2 | - | - | 35.5% | 1 | 259 s | 14.7 s | 13.3 s | 55 | - |
| 236 (kept, D5) | Blueberry bucket (kf76) | 39x45 painting | hard | linked, mystery | 3 | 2 | - | 14.2% | 1 | 238 s | 14.9 s | 8.6 s | 52 | - |
| 237 | Siamese (kf92) | 33x46 outlined | easy | - | - | - | - | 61.5% | 1 | 245 s | 14.8 s | 9.1 s | 54 | - |
| 238 (kept) | Skiing (kf44) | 36x46 painting | normal | mystery | 2 | - | - | 39.3% | 1 | 244 s | 14.8 s | 14.2 s | 52 | - |
| 239 | Violin (kf29) | 40x46 outlined | easy | - | - | - | - | 64.3% | 1 | 277 s | 14.6 s | 11.6 s | 52 | - |
| 240 | Signpost nap (kf50) | 40x46 outlined | normal | linked | - | 1 | - | 34.0% | 1 | 266 s | 14.7 s | 6.9 s | 55 | - |
| 241 | Pumpkin peek (kf80) | 42x42 outlined | easy | linked | - | 1 | - | 69.0% | 1 | 218 s | 14.9 s | 6.1 s | 51 | - |
| 242 | Lion cub (kf83) | 42x39 outlined | normal | linked | - | 1 | - | 41.8% | 1 | 281 s | 15.0 s | 7.8 s | 49 | - |
| 243 (kept) | Dragonfly ride (kf73) | 42x41 painting | hard | linked, mystery | 3 | 2 | - | 16.0% | 1 | 227 s | 15.0 s | 7.1 s | 50 | - |
| 244 | Slam dunk (kf37) | 42x44 outlined | easy | - | - | - | - | 61.3% | 1 | 247 s | 14.9 s | 10.7 s | 53 | - |
| 245 | Daisy crown (kf13) | 41x46 outlined | normal | linked | - | 1 | - | 34.0% | 0.875 (D5; D4 0.375) | 255 s | 14.9 s | 8.0 s | 54 | - |
| 246 | Big yawn (kf23) | 39x45 outlined | easy | - | - | - | - | 71.0% | 1 | 243 s | 15.0 s | 9.8 s | 52 | - |
| 247 | Leaf umbrella (kf74) | 39x46 outlined | normal | linked, hidden | - | 1 | 237 > 43 | 33.8% | 1 | 242 s | 14.9 s | 10.6 s | 47 | #9b2f6b |
| 248 (kept) | Bath time (kf99) | 42x44 painting | easy | - | - | - | - | 69.0% | 1 | 232 s | 14.9 s | 9.2 s | 50 | - |
| 249 | Ocelot kitten (kf89) | 42x46 outlined | normal | mystery | 2 | - | - | 37.3% | 1 | 232 s | 14.7 s | 7.0 s | 50 | - |
| 250 (kept, D5) | Xylophone (kf34) | 42x43 painting | hard | linked, mystery | 3 | 2 | - | 9.8% | 0.625 | 225 s | 14.3 s | 8.6 s | 54 | - |

## 5. Tooling (kept in tools/ for Dino Valley-style reuse)

- `tools/land.js`, a records-only re-install of an installed land:
  - `--keep N,N` (or `none`): assemble takes those levels' records, every side quest and the map from the game as
    installed (so the check gates exactly what will ship); bake never re-bakes a kept level.
  - `reinstall` step: after a passing check, replaces the land's main records in `levels/levels.json` in place (same ids,
    same order) and writes nothing else. It refuses when the ids or order differ, when a kept record differs from the
    installed one, or when out/'s side quests or map aren't the installed ones.
  - The run: `bake --list <re-dealt> --keep <kept> --shard 2`, then `assemble check reinstall --keep <kept>`.
  - `install --replace` stays for a full swap.
- `tools/land-ink-check.js LAND_DIR [--file ...]`: the ink-outline rule on a land's outlined records, with ids from
  scratch/boards.json. Checks: the ink and ground ids match the board; the ink is solid (no `sh`, no shade digits on
  ink); no colour or shade within 10 ΔE00 of the ink; every subject cell shut in (none touches the ground or frame side-on);
  no mystery block on ink or ground. Also lane C's line/other ink count.
- `tools/land-contact.py LEVELS.json K OUT.png --keep N,N`: a contact sheet of a land's boards as they ship.

## 6. Checks

- Land check (`land.js ... check --keep`): PASS on every gate: numbering, compile and E.check, stored order wins with
  no power-up, 5 spaces, longest tap and taps, real pace and the 235 s median, no fallbacks, the profile (planCheck),
  mystery fills, shade floors, no moats, side quests, re-grade 0 of 522, the map, licences.
- Ink-outline rule (`tools/land-ink-check.js`): 35 of 35 outlined records pass. Off-line ink (eyes, dark areas kept on
  purpose, lane C's measure): 0-35 a board; 246 kf23 35 and 231 kf06 33 the most, as in lane C's results.
- levels.json vs v6.0: 215 records byte-identical (1-200 and the 15 kept), 35 changed (the re-dealt), top-level keys and
  version/bake identical. `JSON.stringify(JSON.parse(file)) === file` held, so in-place rewriting keeps every other byte.
- `tools/test.js` 702 passed, 0 failed.
- `tools/regrade.js` 0 differences of 2,405 checks (250 levels); `--gallery` 0 of 372 (62); `--zen` 0 of 324 (36).
- `./tools/critic-v5/run.sh`: 0 mismatching games of 10,527, 0 grade mismatches, tags 0 problems, known answers 0 wrong,
  real pace and thinks 312/312 identical (diff-result.json regenerated and committed: its counts follow the levels).
- Freeze: `freeze.js --snapshot` re-taken. Diff vs the old snapshot: levels.json exactly the 35 re-dealt records (1-200
  and the 15 kept identical); gallery.json and castles.json identical; zen.json's levels identical, its World 1 entry
  differs by the name and lore of ce863e1's ship fix ("The Gallery" to "Picture Garden"), which the old snapshot had
  missed (live zen.json is unchanged by this piece); frozen.json's date. `freeze.js --require` PASS (2,405 / 372 / 324,
  castles 283 cases, 0 differences).
- Cache tag `?v=55` (index.html, style.css). `SP.selfTest()` under `?debug=1` (tools/selftest-lands.mjs): 868/0 at
  375x812@3, 870/0 at 1280x720, 0 console messages. Harness (`tools/harness.mjs`): all passed, 0 console messages.

## 7. Saves

Same ids, so clears survive: a v6.0 player's cleared Kitten Forest levels stay cleared, its eggs and side quests stay.
- **Best rows** (`best[id] = [ms, taps, coins]`, no stars in this game) are kept as they are on every level. On a
  re-dealt level the row was set on the old deal, and a win only replaces each number when it beats it
  (`meta.js`: `ms < was[0]`, `taps < was[1]`). So until the player beats the old time or taps on the new deal, the win
  sheet shows the old deal's best. Nothing breaks; it's a stale number. Coins earned keep adding.
- **A Zen save made on v6.0 mid-level:** the game saves no in-level state (only `last`, an id). Measured in the page
  (Playwright, 375x812 and 1280x720): a v6.0 Zen save with `last: "e9-212"` (a re-dealt level), four clears and best
  rows on a kept and a re-dealt level loads clean with 0 console messages. Clears, best rows and last are unchanged. The
  home offers the world's first open uncleared picture (Picture 4, as v6.0 does). `SP.load("e9-212")` starts the new
  deal (42 wide, playing).

## 8. Payload

Tracked files of the game folder outside tools/: **18,977,991 bytes** (HEAD before this piece 18,980,695; levels.json
is 1,351 bytes smaller). Never loaded by the page: levels/frozen 1,361,953 B, the bake pools and gallery manifest
2,676,982 B, the docs (*.md) 324,760 B. **Portal build ≈ 14,614,296 B (14.61 MB)**, as at v6.0.

## 9. Files

- Game data: `levels/levels.json` (land 1's 35 records), `levels/frozen/*` (re-snapshot), `index.html`, `style.css`
  (?v=55), `tools/critic-v5/diff-result.json`.
- Land folder: `tools/lands/01-kitten-forest/pictures/manifest.json`, `src/` (35 sources). Scratch (gitignored):
  boards.json, bake/, cands/, out/, report.md; the v6.0 scratch is backed up in this session's scratchpad only.
- Tools: `tools/land.js` (--keep, reinstall), `tools/land-ink-check.js`, `tools/land-contact.py`,
  `tools/land-01-ink/contact.png` (all 50 as installed, kept ones in amber).
