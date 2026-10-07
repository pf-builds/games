# Campaign Challenge Mode (v6 lane A): the difficulty curve for levels 1-200

Status: APPROVED by Peter 2026-10-06 (with the archer gradient). Re-deal starts after the pin rule lands.

## Why (playtesters, via Peter, 2026-10-06)
- Removing the killing archer towers removed the only real challenge; 1-200 now feel very easy.
- Bring Hard and Extreme earlier so players get a taste and get stuck for a while.
- Towers back around 60, sparingly (about one in ten), more often from 125.
- Lean into "only 1 or 2 paths through the colours, and sometimes you fail": more unknown pixels, more squads, more linked groups, fewer spaces.
- 150+ extremely challenging, the last few almost requiring gold; 200 is the end game. Easier play is the Zen path.

## Baseline (before): `tools/campaign-v6-baseline-before.jsonl`
Careful player (3 taps ahead, all-seeing, 16 games) mean win rate by realm: 1.00, 0.99, 0.87, 0.84, 0.76, 0.60, 0.75, 0.54.
124 of 200 levels at 0.9 or more. Tags didn't track it (realm 7 Extreme 0.85 > its Normal 0.68).

## Peter's calls (2026-10-06)
1. Archer gradient (revised later on 10/6): Normal knocks back, Hard PINS (the hit sapper is out of play until its tower falls, then rejoins; still winnable), Extreme KILLS (the short fail). Replaces the earlier "kill on H/X, all kill from 150".
2. Tower boards: restore the v4.3 towers on chosen levels in realms 3-4, add new tower pixels in realm 5. Ids stay.
3. Spaces: Extreme levels from 150 carry 2 locks (start with 3 of 5 open).

## Tag mix (E / N / H / X)
| Realm | Levels | Today | Proposed | Tower levels |
|---|---|---|---|---|
| 1 Greenmarch | 1-24 | 5/14/5/0 | 6/14/3/1 | 0 |
| 2 Fenwater | 25-49 | 3/16/6/0 | 4/12/6/3 | 0 |
| 3 Ironhollows | 50-74 | 3/16/6/0 | 3/11/8/3 | 3 (about 60, 67, 74) |
| 4 Twinspire | 75-99 | 3/16/6/0 | 3/10/8/4 | 3 |
| 5 Mistmoor | 100-124 | 3/13/9/0 | 3/9/9/4 | 3 |
| 6 Emberwatch | 125-149 | 3/8/10/4 | 3/8/9/5 | about 12 |
| 7 Shrouded Weald | 150-174 | 3/6/10/6 | 2/5/10/8 | about 14 |
| 8 Throne | 175-190 | | 1/3/6/6 | most |
| Final stretch | 191-199 | | 0/0/2/7 | all |
| Boss | 200 | | X | yes |
Totals 25/72/61/42 (corrected 10/7: the rows were approved as written; the totals first quoted, 26/73/61/40, were an addition error). Levels 1-8 stay a gentle tutorial. Sawtooth per realm: Normal lead, a Hard run to an Extreme peak, an Easy breather right after the peak; each realm ends on its hardest level.

## Features per level
- Easy: at most 1 feature, no lock, no tower hazard beyond knock back. Normal: 1-2, no lock, towers knock back. Hard: 2-3 + lock, towers pin. Extreme: everything unlocked + lock (2 locks from 150), towers kill.
- Amounts: linked pairs (from 75) N 1-2, H 2-3, X 3-4; ? cards (from 100) N 3-4, H 4-6, X 6-8; mystery blocks (from 150) H 15-25%, X 25-35% of the buried picture; more, smaller squads where the 55-tap cap allows (mostly realms 1-2).
- Feature ladder otherwise unchanged: moats 25, gates and locks 50, linked 75, ? cards 100, mystery blocks 150; towers now from about 60.

## Bands (careful player ceilings; random-tap bands)
| Tag | Realms 1-2 | 3-5 | 6 | 7 (150-174) | 8 (175-190) | 191-199 | Random tap |
|---|---|---|---|---|---|---|---|
| Easy | none | none | none | none | none | | 20-60% |
| Normal | 0.75 | 0.60 | 0.50 | 0.40 | 0.35 | | 2-15% |
| Hard | 0.50 | 0.40 | 0.30 | 0.20 | 0.15 | 0.06 | 0-3% |
| Extreme | 0.35 | 0.25 | 0.20 | 0.10 | 0.08 | 0.06 | 0-1% |
Boss 200: as low as the bake reaches, aim 0 of 32. From 150 the careful player gets 32 games a level. Realm 1 ceilings are aims (small boards); report what's reached.

## Invariants (every level)
Stored winning order on its tag, 5 spaces, no wait over 15 s, 55 taps or fewer, power-ups never needed, pace: realm median 200-250 s from realm 2 (realm 1 keeps short boards, under about 2 min a level). Level ids stay (saves keep progress).
