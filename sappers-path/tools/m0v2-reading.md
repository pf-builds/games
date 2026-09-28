## Reading (builder's summary, written against the numbers below)

**Recommendation: Rule A ("closest"), no stacks.** Bands and a 38-level draft bake (9 / 9 / 10 / 10) are below. This is the gate before M1: nothing in the browser game changes until Peter agrees.

**Rule A against Rule B.** Same castle pictures, each rule given its own scarce muster by the same search, so this is a fair fight.
- Rule B is shallow in every world. It floods: one call clears every reachable wall of that material, so a layer of the castle costs one call whatever its colours are. Median min calls are 3 / 3 / 4 / 3, against Rule A's 4 / 4 / 5 / 5. The median random-playout win is 1.00 in all four worlds, so a random tapper wins. Only 1-3% of Rule B boards pass the same bands Rule A passes at 4-10%. In Worlds 1-2 it almost never has a losing call at all (2% and 26% of boards have a decision point).
- Rule A changes the answer on 83-93% of boards (the A≠B share). In every one of those, Rule B's minimum is lower.
- The "closest" rule is live on 83-89% of Rule A boards (the surprise rate). A wall the solution needs later is already reachable, but its crew would walk somewhere nearer first. That's the Food Hunt feel Peter described.
- The honest catch: most of those reshapes are forced, not chosen. On most raw boards the player has to break a nearer decoy of the same material, and any order still wins. Median trap rate is 0.00 in Worlds 1, 3 and 4 and 0.11 in World 2. Only 27-53% of raw boards have even one decision point.
- So the depth isn't automatic. It lives in a minority of boards, and the generator and bands pick them out. Accepted boards carry 1-6 decision points, and the baked levels mostly sit at 2-6 (the table at the end).

**Stacks.** Rule A + stacks deals the Rule A level's crews into 3 columns, where only the front of each column can be called.
- Min calls don't move (the medians are identical).
- Decision-point boards rise by +0 / +5 / +22 / +8 points by world. Random win drops in Worlds 2-3 (median 0.77 to 0.56, and 1.00 to 0.50). Accepts rise by about a third.
- So stacks add depth, mostly in World 3. But the traps they add are about the queue (the crew you need sits behind one you can't use yet), not about reading the castle.
- They'd also add a second thing to read on every board, which works against "readable at a glance on a phone".
- Recommendation: leave stacks out of M1, and keep them as a one-command rebake (`node tools/bake.js --stacks`) if the playtest says the levels are too easy.

**Ties.** On a 4-connected grid, walking distances tie often. A tie-break decides some crew's target along the optimal line on 15-20% of Rule A boards. On 11-17% it decides the call the solution actually makes.
- The generator scores those musters down, the bands reject them, and no shipped level has a tie on a solution move.
- Ties elsewhere on the board stay. The target flags show where each crew will go, so a tie is never a surprise at play time. It's only harder to plan ahead.

**Where depth actually comes from.**
1. **Layers.** A palisade across the front field, the moat bridge (World 3+), the curtain or gate, the courtyard cross wall, and the keep ring or lever house. The unlimited-crew route under Rule A is 2-6 calls.
2. **The closest rule.** It adds forced decoy breaks, which is why Rule A's minimum sits about one call above Rule B's.
3. **Scarcity.** The muster comes from the solver's Pareto frontier (every crew mix whose every win spends exactly that mix), plus 0-1 slack. That turns some forced breaks into real choices: which material to spend first.
- Decision points come from 3, amplified by 2. The measured depth is **3-8 calls, not 4-12**. Rule A's raw p90 is 5 / 6 / 7 / 7, and 8+ calls shows up on under 5% of World 3-4 boards.
- Reaching 12 needs more layers, not more scarcity. A concentric castle (two full curtains) or a longer board would do it. Parked in LATER.

**Do the boards read as castle pictures?** Mostly yes. Every board has:
- a curtain 2-3 blocks thick in 3-7 big arcs, with corner towers
- a gatehouse facing the camp, a keep block inside its own ring, and 0-3 courtyard buildings
- in World 2+ an optional cross wall
- a palisade across the front field (on about half the boards)
- in World 3+ a moat that curves around the whole footprint with 2-wide bridges

Crew sections: medians 10 / 15 / 16 / 17, averaging 14-15 blocks each. There are no stray single tiles (only World 4's lever cell). Caveats:
- A tower takes its arc's colour about 30% of the time, so it merges into the wall. The corner silhouette then shows only through the art's outline.
- The palisade is a straight fence edge to edge. It reads as siege lines more than castle.
- On some World 3 boards the moat fills the whole side margin, so the castle sits in a lake.
- The picture is the castle shape; the materials are a colouring on top of it, so a board shows "a stone arc and a timber arc", not brick courses along a wall face. The M1 art has to carry that with textures that span each region.

**Chests.** Required chests work: 63-71% of chest boards need the chest for 3 stars. Detour chests mostly don't: 0-3% of chests classify as a detour under Rule A, because the pockets the line never opens usually cost 2+ extra calls. The bake got 1 detour where it wanted about 9. Parked.

**World 4.**
- Levers matter on 100% of boards: the keep ring is iron, and its lever sits against the ring inside a small lever house. The final call is always "open the lever house".
- The old deliberate lever cascades are still cut.

**Bands chosen** (in `bake-config.json` → `bands`; every band also needs a win, no tie on a solution move, and a crew-section cap):

| world | size | min calls | decision points | greedy rule | random win | trap rate | chest | levers | levels (teaching + baked) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 16×20 | 3-5 | ≥1 | off | 0.05-0.9 | 0.02-0.7 | none | n/a | 9 (3 + 6) |
| 2 | 18×24 | 4-6 | ≥1 | fails or +1 | 0.02-0.8 | 0.05-0.7 | required or detour | n/a | 9 (1 + 8) |
| 3 | 20×28 | 5-7 | ≥2 | fails or +1 | 0.005-0.6 | 0.05-0.7 | required or detour | n/a | 10 (1 + 9) |
| 4 | 24×32 | 5-8 | ≥2 | fails or +1 | 0.002-0.5 | 0.05-0.7 | required or detour | must matter | 10 (1 + 9) |

Pools are 47 / 38 / 37 / 35, so each world can take 30+ more levels by bake-and-pick. Rebaking under Rule B is one command (`node tools/bake.js --rule B`). Rule B mostly fails these bands, so that bake fills from logged near misses.
