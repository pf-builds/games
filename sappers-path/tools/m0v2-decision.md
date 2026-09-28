# M0 v2 gate decision (Peter approved, 2026-09-27)

Peter's words: "go, keep going until it's playable".

1. **Rule A ("closest wall"), no stacks.** Rule B is shallow: a random tapper wins the median board in every world. Stacks stay a one-command rebake (`node tools/bake.js --stacks`) if the playtest says the levels are too easy.
2. **The M0c generator pass runs in parallel with M1.**
   - Concentric castles in Worlds 3–4 (an outer and an inner curtain), aiming at 7–12 calls.
   - Denser pictures. v2 M0 walls cover about a quarter of the board; add courtyard buildings, gardens and cross walls, so there's less empty ground and there are more decoys.
   - Towers in their own material.
   - Peter sees the new depth numbers before the M2 finish pass.
3. **M1 v2 UI:**
   - a finer block-art board with textures that span each region
   - one-tap crew cards with target flags
   - camp-to-wall walks
   - block-by-block eating
