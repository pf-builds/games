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

---

# v6 addendum — "The Long Keep" (approved 2026-09-01)

Turns the 20-wave run into a run-based progression game. Nothing from v5 is removed.

## Shards and The Forge (meta progression)
- Every run pays **Shards**: 2 per wave cleared, 10 per boss, 0.05 per kill, +60 for clearing wave 40, +25 per 10 endless waves. Multiplied by Deep Mining (Forge) and Shard Hunger (perk). Paid once per run for progress not yet paid (win at 40, then an endless death pays only the endless part).
- Persisted under `vectorkeep.meta.v1` (`{v, shards, forge:{nodeId:rank}, runs, best, earned}`). Unknown/corrupt data falls back to empty. v5 keys untouched.
- **The Forge** (title and over screens): 16 permanent nodes in 4 lanes, 2–4 ranks each, defined in `forge.json`. Offense (damage, fire rate, crit, boss damage), Defense (hull, plating, repair discount, regen per wave), Economy (start gold, interest, bounty, wave bonus), Keep (starting cannon tier, perk rerolls, loadout draft, shard multiplier). Full tree ≈ 2,900 shards.

## Perk draft
- After waves 5, 10, 15, … (and every 5 in endless while perks remain): pick 1 of 3 from `perks.json` (21 perks, common/rare/epic weighted 6/3/1, no repeats). Loadout node adds a draft before wave 1. Rerolls come from the Forge.
- Perks last the run. Shown as chips under the HUD; tap for the description.

## Content to 40
- Waves 21–40 authored in `waves.json`; endless synthesis from 41 includes all nine types, bosses cycle 4–7.
- New enemies: **SHIELD** (barrier soaks cannon fire, nova/bomb shatter it), **MENDER** (heals allies in a radius), **BOMBER** (explodes on death; inside 20% of the arena the keep takes 12), **PHASER** (blinks forward every 1.6 s, ignores stasis).
- New bosses: THE MENDER QUEEN (spawns menders), VOIDWALKER (phases), TRIAGON REBORN (phases), OMEGA VERTEX Ω (spawns menders). Scaling array extended.
- Upgrade tiers past the v5 count unlock after wave 20 (`lockAfter` in `upgrades.json`). Cannon/nova to 8, others to 7.
- Milestone banners at waves 50, 75, 100, 150, 200.

## Damage pipeline (new, `applyDamage`)
boss multiplier → first strike → stasis weaken → crit (cannon only, ×2) → armor (unless Armor Breaker) → shield soak/shatter → hp → kill (→ chain arc, bomber blast, splitter split unless Clean Kill).

## Debug (`?debug=1`)
`window.VKS` = state, `VK.step(sec)` synchronous sim, `VK.dbg.{setShards, maxForge, resetMeta, stat, givePerk, pick, openDraft, startWave, buy}`. `?debug=reset` wipes meta.


---

## v6.1 "Last Stand" (2026-09-04)

Tester finding (Sonya, many runs): wave 55 was impossible with max tiers, perks and Forge.
Cause: v6 endless multiplied the 19× wave-40 HP base by 1.25 per wave (wave 55 = 540× base,
wave 60 = 1,650×) while player damage is bounded (tier caps, 3× gold cap, interest cap), and
enemy damage grew 12%/wave uncapped. The bot benchmark at ship already showed the tell: empty
Forge fell at 51, full Forge at 54.

Changes:
- Endless mode renamed **Last Stand** everywhere (button, HUD, over screen, arcade card). The
  promise is now honest: the keep will fall, the score is how far you hold. Over screen says
  "Held to wave N · Last Stand" with best.
- Curve: `endless.hpGrowth` 1.25 → 1.06, plus a linear `endless.hpPerWave` 0.6 past wave 40.
  Wave 55 ≈ 66× base instead of 540×; wave 80 ≈ 440×.
- `late.dmgCap` 4.0: enemy damage stops growing at ~wave 45 so deep deaths come from being
  overrun, not one-shot.
- Counts unchanged (volume is what eventually wins).
- Measured (bot harness, spread buyer, pick-first drafts, 1280×900): empty Forge falls at 70,
  half Forge 78, full Forge 80. At 1.05/0.45 it was 79 / — / 91 (too kind). The Forge is worth
  ~10 waves, up from 3 at v6. Why not the 20–30 the contract asked for: with a monotone curve the
  Forge's wave value is ln(forge power ratio ≈ 2) / ln(per-wave growth); a 30-wave swing needs
  ~2.4%/wave growth, which pushes an empty-Forge fall past wave 140. A wider swing needs the
  Forge itself to matter more in the Last Stand (e.g. Forge nodes count 2× past wave 40), noted
  in LATER.md rather than slipped in here.
