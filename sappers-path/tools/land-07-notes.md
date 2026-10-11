# Zen World 6 The Floating World: v7 lane D trial bake (2026-10-10/11)

Brief: the orchestrator's lane D brief (trial bake only of 3 boards from lane C's Floating World pilot; no install, no zen.json,
levels or pack output touched, no freeze, never pushed, no image model). Inputs (lane C's, read only):
`game-research/sappers-path-v4/lands/07-floating-world/` (README, `picks-full.json`: landMain 50, pilot 12, trial 3, spares 12,
landManifest 62 lines; `boards-full/`; `scripts/handoff-full.js`), sources `/Users/peter/local-ai/outputs/lands/07-floating-world/fullsrc/`.
Base: `sappers-path` 10d77f4 (live). Method: World 5's (`tools/land-06-notes.md` §2-3, `tools/land-runbook.md` §6-7).

## 1. Land folder (scaffold, not installed)

`tools/lands/07-floating-world/`: land.json, `pictures/manifest.json`, `src/` (50 sources from `prep`, in git as World 5's).

- **land.json:** k 5 (Land 5 in the factory's numbering, era 13 = castleRealms 8 + 5), `zen.k` 6, ids will be `z6-1..z6-50`,
  `main` = lane C's landMain as delivered (fw001 first, fw002 last). Profile: **World 5's shipped profile copied whole**
  (E18/N26/H6/X0 ending on a Hard, ? cards, linked squads, gentle moats, no locks, no archers, no Extreme, hidden share 0 at every
  tag, careful floor 0.5, `profile.bake.deal {size: [32, 80], attempts: 400}`). Features linked, mystery, moat; no `hidden`
  (land.js's Zen guard passes). `byArtist`, `credit`, `worldCredit` (AIC only), `moatSkip {}` (no probe yet).
- **Draft only, set at install:** `lore`, `eggs`, and `map` (a note: lever 1, two reused sheets under a tint, lane D's call;
  the map step refuses until it is set).
- **Numbering:** `scratch/state.json` (gitignored) seeded `{from: 401, sheet0: 54, gal0: 62}` before the first run, as World 4
  and 5 were (land.js would otherwise take levels.json's last, 250). Worlds 1-5 hold 1-50, 201-250, 251-300, 301-350, 351-400;
  World 5's sheets end at 53. Neither sheet0 nor gal0 reaches zen.json.
- **Manifest:** the 62 landManifest lines copied whole (chroma, srcCrop, museum, date kept; never reduced to {id, kind}).

## 2. Hand-off and boards

- Lane C's `scripts/handoff-full.js` on this worktree's land.js (`GAME=.../sappers-path`, LA_DIR
  `/Users/peter/local-ai/outputs/lands/07-floating-world`): **62 of 62 identical**.
- `prep` (LAND_PYTHON = local-ai venv Pillow) then `convert`: **50 of 50 identical to boards-full** (grid, pal, shade); the
  trial three: fw001 42x42 chroma 2.4, fw101 42x45 chroma 1.4, fw006 38x46 chroma 2.4 (manifest).

## 3. Trial bake (fw001, fw101, fw006)

In their own slots of lane C's order on the land's fresh plan (`bake --list 401,403,408 --shard 1`): 401 Normal with a linked
pair, 403 Easy plain, 408 Normal with 2 ? cards. The plan put no Hard on any of the three, so fw006 was also baked in the Hard
slot 412 (linked + ? cards, 3 cards, 2 pairs) from a scratch copy of the land with fw006 and fw052 swapped (`--keep-plan`,
same tags and features; both pictures ringless).

| Level | Print | Board | Tag, features | Rate (band) | Pace | Taps | Longest tap | Careful | Fallback | Deal attempts |
|---|---|---|---|---|---|---|---|---|---|---|
| 401 | fw001 The Cooper's Barrel | 42x42, 5 colours | Normal, 1 linked pair | 40.75% (20-50) | 224 s | 50 | 15.00 s | 0.875 | no | 16 for 8 candidates, 0 no-deal |
| 403 | fw101 Bonito | 42x45, 5 colours | Easy, plain | 68.50% (45-80) | 234 s | 51 | 14.98 s | 1.0 | no | 8 for 8, 0 no-deal |
| 408 | fw006 The Boatman at Haneda | 38x46, 7 colours | Normal, 2 ? cards | 39.00% (20-50) | 254 s | 55 | 14.94 s | 1.0 | no | 14 for 8, 0 no-deal |
| 412 (extra) | fw006 The Boatman at Haneda | 38x46 | Hard, 2 linked pairs + 3 ? cards | 14.00% (6-20) | 232 s | 49 | 14.96 s | 1.0 | no | 14 for 10, 0 no-deal |

- **All ok first time on the shipped profile**, no fallback, no extra candidates. Each stored order replays to a win with no
  power-up and `E.check` is clean (engine replay on the bake records; the land's full check needs all 50 and the map).
- **Rings:** none of the three can carry one (land.js `moatCan`, matching lane C's picks): fw001 "the ring shuts in 100 cells
  of the subject", fw101 and fw006 "a picture colour (or shade) within 20/14 of every water colour". So no ringed run; their
  slots were planned ringless. 19 of the 50 can carry a ring; whether they deal with one is for the full bake (World 5 needed
  moatSkip for 8 of 19).
- **Edge of the caps:** 408 sits on the 55-tap cap and at 254 s; 401 at the 15.00 s tap cap. Legal, and World 5's 351 was the same.
- **Time:** 66 s wall for the three (24 candidate shards, 16 threads); 70 s for the Hard extra.

**Was World 5's deal setting needed? Yes.** The same three on the land-config default deal (squads 20-50 at sizeRef 1400,
32 attempts; a scratch copy without `profile.bake.deal`) also passed (401 Normal 38.25%, 196 s, 55 taps; 403 Easy 73.0%, 226 s,
55 taps; 408 Normal 44.25%, 223 s, 52 taps; careful 1.0), but deals came hard: 401 7 of 8 candidates dealt, about 8% of attempts
(122 attempts, one "no deal in 32"), 408 6 of 8, about 7% (151 attempts, two no-deals), and two levels sat on the 55-tap cap.
The 1.6x squads dealt 50-100% of attempts. Woodblock prints are max-box boards like World 5's paintings; keep the profile.

Also from the first, mis-swapped Hard copy: fw052 Cherry over the River at 412 Hard, 16.5%, 239 s, 46 taps, 14.99 s, careful
1.0, ok (40 deal attempts for 10 candidates).

## 4. Not done (the brief's limits)

No install, no zen.json, levels, LICENSES.md or pack output, no freeze, no map, no check step (it needs all 50). Bake outputs
stay in the gitignored `scratch/`. Next: Peter's pilot call, lane C's final 50, then the full bake (fresh plan, a moat probe
for the 19 ring-capable prints first) and the install as World 5's.
