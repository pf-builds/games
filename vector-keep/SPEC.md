# Vector Keep — Build Spec (v1, approved 2026-08-31)

Single-tower defense, geometric neon-vector style. Second PF Games cabinet. Priority-1 slot ("first tuned game").

## Mechanic
- One upgradeable tower at arena center. Tower HP = lives.
- Enemies spawn at edge gates and converge on the tower; contact deals damage and destroys the enemy.
- Tower auto-fires at the nearest enemy inside its range ring. Projectiles travel with trails.
- Every kill pays gold (+floating text). Wave clear pays a bonus.
- Between waves the shop is open; Start Wave begins the next assault. 20 waves; boss every 5th; wave 20 boss = final.

## Upgrades (3 branches × 4 tiers + repair, prices/values in upgrades.json)
- **Cannon** — damage and fire rate.
- **Nova** — periodic radial pulse: AoE damage + knockback (tier 1 unlocks it).
- **Stasis** — aura that slows enemies inside its ring (tier 1 unlocks it).
- **Repair** — buy hull HP, price scales.

## Enemies (stats in waves.json `types`)
dart (fast, weak, small triangle) · brute (slow, tanky, heavy square) · splitter (pentagon; cracks into 2 darts on death) · boss (large rotating polygon, HP bar, named banner).

## Win/Lose
Win: clear wave 20 → victory screen with stats (kills, gold, time). Lose: HP 0 → tower detonation → defeat screen with wave reached. Both restart without reload.

## Juice contract (every item ships — this is the point of the build)
Muzzle flash · shot sound with pitch variance · glowing projectile trails · kill pop (particle burst in enemy color + pop sound + floating gold) · splitter crack effect · nova ring visual + whoomp · boss horn + name banner · boss death = explosion chain + screen shake + 400ms slow-mo beat · tower hit flash + thud + small shake · low-HP red vignette pulse + alarm · upgrade chime + tower glow flash · wave-clear sting + bonus tally · title screen runs a live attract-mode simulation as its background.

## Art
Geometric neon on dark navy. Glow via pre-rendered radial-gradient sprites drawn with additive blending (never shadowBlur — too slow). Faint arena grid, range ring, edge gate notches. All drawn in code; zero asset downloads.

## Sound
All WebAudio-synthesized, owned. SFX list above. Optional minimal pulse-loop music during waves, off with the single sound toggle.

## Controls
Mouse + touch, tap-only (buy buttons, start wave). All targets ≥44px. Portrait: arena on top, shop below. Desktop 16:9: arena center, shop as bottom panel.

## Performance bar
Steady frame rate with 30+ enemies and 200+ live particles. Pools for enemies/projectiles/particles (cap 400 particles). No per-frame allocations in hot paths.

## Tuning
waves.json (spawn schedule, enemy stats, bounties, boss scaling) and upgrades.json (prices, per-tier values) — retunable without code changes.
