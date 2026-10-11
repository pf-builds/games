# Zen World 7 Under the Sea: v7 lane D trial bake (2026-10-11)

Brief: the orchestrator's lane D brief (trial bake only of 3 boards from lane C's Under the Sea pilot; World 6's work untouched;
never pushed; no image model). Inputs (lane C's, read only): workspace 6edd7ab,
`game-research/sappers-path-v4/lands/08-under-the-sea/` (README, `trial.json`: 3 whole landManifest lines), sources
`/Users/peter/local-ai/outputs/lands/08-under-the-sea/fullsrc/`, lane C's boards in `.../boards/`. Method: the Floating World
trial's (`tools/land-07-notes.md`, its first section).

## 1. Scaffold (not installed)

`tools/lands/08-under-the-sea/`: land.json, `pictures/manifest.json` (the 3 trial lines whole), `src/` (3 sources from `prep`).

- k 6 (Land 6, era 14 = 8 + 6), `zen.k` 7, ids will be `z7-1..z7-50`; `scratch/state.json` seeded `{from: 451, sheet0: 60,
  gal0: 62}` (World 6 holds 401-450 on sheets 54-59).
- Profile: **Dino Valley's shipped profile copied whole** (AI full story scenes: E18/N26/H6/X0 ending on a Hard, ? cards,
  linked squads, gentle moats, no locks, archers, Extreme or mystery blocks, careful floor 0.5, deal attempts 96 at the
  land-config squads [20, 50]).
- `main` is a trial placeholder: the 3 scenes repeated in turn (us201, us203, us206) so the plan has 50 slots; lore, eggs and
  map are drafts. Lane C's 50 replace all of it.
- test.js's Zen-profile list gains `08-under-the-sea` (a Zen land with hidden off); 714/0.

## 2. Boards

No hand-off script in lane C's folder (only mgconvert.js, which writes their boards), so: `prep` + `convert` here, compared with
lane C's `boards/<id>.json` (grid, pal, shade): **3 of 3 identical**. us201 Octopus drummer 42x42, 7 colours; us203 Hot spring
spa 42x42, 6; us206 Night voyage 42x42, 4 (dark navy). Chroma 1.4 (boardOf's own) on all three.

## 3. Trial bake (Dino Valley's profile, it passed; World 5's 1.6x/400 not needed)

Each board in an Easy, a Normal and a Hard slot of the draft plan (`bake --keep-plan --list 451,484,472,473,461,479,453,465,462
--shard 1`): **9 of 9 ok first time, no fallback, no extra candidates, 112 s wall** on 16 threads.

| Level | Scene | Tag, features | Rate (band) | Pace | Taps | Longest tap | Careful | Fallback | Deal attempts |
|---|---|---|---|---|---|---|---|---|---|
| 484 | us201 Octopus drummer | Easy, plain | 60.75% (45-80) | 240 s | 55 | 14.96 s | 1.0 | no | 11 for 8 |
| 451 | us201 | Normal, 2 ? cards, **ring** (2 ways, 93 water) | 40.0% (20-50) | 265 s | 55 | 14.99 s | 1.0 | no | 23 for 8 |
| 472 | us201 | Hard, 2 linked pairs, 3 ? cards, **ring** (2 ways) | 11.0% (6-20) | 284 s | 52 | 14.96 s | 1.0 | no | 36 for 10 (1 bad link) |
| 473 | us203 Hot spring spa | Easy, plain | 69.75% (45-80) | 220 s | 50 | 14.85 s | 1.0 | no | 8 for 8 |
| 461 | us203 | Normal, plain | 32.5% (20-50) | 211 s | 47 | 14.69 s | 1.0 | no | 9 for 8 |
| 479 | us203 | Hard, 3 ? cards | 13.5% (6-20) | 220 s | 48 | 14.96 s | 1.0 | no | 15 for 10 |
| 453 | us206 Night voyage | Easy, 2 ? cards | 71.0% (45-80) | 222 s | 44 | 14.27 s | 1.0 | no | 8 for 8 |
| 465 | us206 | Normal, 2 ? cards | 46.0% (20-50) | 208 s | 50 | 14.95 s | 1.0 | no | 9 for 8 |
| 462 | us206 | Hard, 2 linked pairs, 3 ? cards | 11.5% (6-20) | 183 s | 41 | 14.99 s | 1.0 | no | 15 for 10 |

- **Rings:** us201 carries one (ringed at Normal and Hard, both ok); us203 and us206 can't ("a picture colour (or shade)
  within 20/14 of every water colour"). No moat probe needed for a trial of one ring board; the full set gets one.
- **us206 Night voyage (dark, 4 colours): not too easy.** Unlike World 6's 405/449 (100% on every candidate at every squad
  size), it tunes into every band: Easy candidates 65-82%, Normal 38-49%, Hard 6-21%. It sits high in the Normal band (picked
  46%; all 8 candidates 38-49%), so on Normal slots it will read easy-ish but legal; it takes Hard comfortably. Dark boards look
  fine to bake; 4 colours is the floor, so watch for 4-colour scenes with big flat areas (the 405/449 failure).
- Edges: 451 and 484 at 55 taps (the cap); 472 at 284 s (the range is 150-300 s).
- Deals came easily on Dino Valley's squads (8-36 attempts a level), so the max-box painting setting isn't needed for these
  AI scenes.

## 4. Not done

No install, no zen.json, levels, LICENSES.md or pack output, no freeze, no map, no check step. Bake outputs stay in the
gitignored `scratch/`.
