# Critic: Kitten Forest on outlined boards (v6 lane D, commit 75fef32, branch sappers-path), 2026-10-07

One round, functional and visual. I didn't touch any code or data. The game was served at http://127.0.0.1:8471/sappers-path/ (serve.py, worktree root) and the server is now stopped. Screenshots are in `tools/critic-land-01-ink/`. My scripts are in the session scratchpad (play.mjs, sim.mjs, win215.mjs, map375.mjs, check.js).

## Verdict

**PASS, with should-fix items. 0 blockers.** Everything functional works. The outlines are solid. No mystery block sits on a ground or ink cell. There are four visual and design problems worth fixing before this ships to a portal, listed under should-fix.

## Gates

- `SP.selfTest()` (tools/selftest-lands.mjs): 375x812@3 gave **868 passed, 0 failed**. 1280x720 gave **870 passed, 0 failed**. 0 console messages.
- `tools/harness.mjs --url http://127.0.0.1:8471/sappers-path/`: **HARNESS: all passed**, exit 0, console []. This covers the v6.0 save.

## Checklist

| # | Check | Result |
|---|---|---|
| 1 | Wins in Zen World 2 | PASS. Every level below was won through real taps on `.card[data-col]` at 375 touch. Each win sheet said "Picture done" and "{title}, all dug out.", and its button said "Back to map". 250 Xylophone (Hard) won in 53 taps. 212 Skateboard (Hard, mystery blocks) won in 55. 215 Apple weights won in 52. 227 Glowing flower (Easy) won in 42. 244 Slam dunk (Easy) won in 53. 222 Rainbow slide (Hard) won in 52. At 1280 I also won 229 Calico stretch in 51. |
| 1 | Forced fail | PASS. On 215 I played `SP.lossPlan()`'s 19-tap prefix through the cards. The game reported status failed, reason jam. The sheet read "A little stuck" / "Line jammed: [5 chips] can't reach a block. Have another look." (aria: "Grey, Red, Brown and 1 more can't reach a block…"). It offered Continue for 250 coins with "Every stuck squad finishes on the spot", plus Retry and Back to map. Tapping Continue took coins from 1225 to 975 and put the level back to playing, with 0 stuck and 5 free. Shot: `375-fail-215.png`. |
| 1 | Console | PASS. 0 messages in every run: play, sim, map and harness. |
| 2 | Mystery-block placement | PASS. My own check (not the builder's tool) read each board's ground from the cells on the frame and the ink as the darkest colour. Mystery blocks on ground: 0 on every level. On ink: 0 on every level. Counts: 207 64, 212 20, 215 30, 217 49, 222 29, 229 21, 231 68, 247 43. Each block carries a "?" glyph (close-up `375-zoom-mystery-217-229.png`). How well they read is in should-fix 3. |
| 3 | 375x812 touch, reloaded | PASS. Zen map, World 2 banner and nodes render (`375-map-start-fail-win.png`). Nodes are 44x44, with no sideways scroll. Tapping the current node ("Picture 4, play this one next") started e9-204. |
| 3 | 1280x720 | PASS. The map renders in cards layout, nodes are 44x44, no sideways scroll. Tapping the node started e9-201. 229 played to a win. Shot: `1280-map.png`. |
| 4 | v6.0 save | PASS. The harness passed, and selfTest had 0 failures at both sizes. |
| 5 | Outline is one solid black line | PASS on the data for all 35 outlined boards: the ink has no `sh` and there are 0 shade digits on ink cells. Small ink pieces of 3 cells or fewer: none floats on the ground. They are eyes, noses and ocelot spots, except a few listed under minor. |
| 5 | Subject reads at phone size | PASS on 32 of 35 (`375-in-level-35.png`). 207, 236 and 250 read worse than their old paintings (should-fix 4). |
| 6 | Mixed look | FAIL as one consistent land (should-fix 2). |
| 7 | Would a portal reject this on sight? | No. Reasons a reviewer might still mark it down are below. |

## Blockers

None.

## Should-fix

1. **215 kf45 Apple weights (Normal; linked pair plus mystery blocks) punishes careful play.** The builder's careful player (3 taps ahead) wins 6.3%. My sim plays only cards that can reach a block, picked at random, with real randomness, 24 runs per level. On 215 it won **1 of 24**, jamming between tap 19 and tap 36. Controls: 224 won 21/24, 227 won 24/24. The greedy player (always the card with the most reachable blocks) stalls at tap 28 with 2 stuck squads.
   - Caveat: 245 (also linked) went 0/24 and 220 went 12/24 in my sim, so my sim may play linked pairs badly. Treat the absolute numbers as rough.
   - The builder's own grader agrees on the direction, though: on 215 thinking ahead does much worse than tapping at random (6% against 37%).
   - For a casual Zen Normal level that feels unfair. A player who thinks before tapping keeps landing on "A little stuck".
   - Fix: re-deal 215 with a candidate whose careful rate is at least 0.5. While at it, look at 245 (careful 0.375).
   - Repro: `?debug=1`, `SP.zenTo(2,0)`, `SP.load("e9-215")`, then tap any card that can reach a block, at random.
2. **World 2 doesn't read as one land.** See `tools/land-01-ink/contact.png` and `375-in-level-35.png`.
   - The 15 kept boards are full-bleed paintings: a forest scene behind 205, a night sky behind 206, scenery with no outline.
   - The 35 outlined boards are flat stickers with a black line on a flat ground.
   - The opening is the worst stretch: of levels 203-210, 6 of 8 are paintings, so the land starts in one style and then switches.
   - Mystery blocks also look like two different mechanics. On kept 208, 210 and 228 (232-322 blocks) they cover the whole ground like confetti. On the outlined boards they're 2-3 small patches on the subject.
   - Keeping 15 boards was Peter's call, so this is for him to decide. Converting the 15 kept pictures to outlined would make the land consistent.
3. **Mystery blocks are too light on 212 (20) and 229 (21), and read as stains at phone size on 207, 217 and 231.**
   - On 212 the 20 blocks are two dark green clumps on the red deck (4.4% of the subject). They look like a decal, not a feature (`375-map-start-fail-win.png`, panel 2).
   - On 217 the plum patches on the strawberry look like rot. On 231 the plum blobs on the red blanket look like stains.
   - Up close, the "?" glyph makes them read as a feature. At about 8 CSS px a cell they don't.
   - The builder already flagged 212 and 229 as sitting at or near the floor (under the 24+ line). I'd raise those two, or take the feature off and give the Hard slot a different twist.
4. **Three boards read worse than their old paintings** (`old-vs-new-1.png`, `old-vs-new-2.png`; old records from `git show 1ff4ac4:sappers-path/levels/levels.json`):
   - **250 Xylophone**, the world's final level: the xylophone named in the title shrank from a large bright rainbow to a small, muted wedge. Now the cat is the subject and the xylophone is a detail.
   - **236 Blueberry bucket**: the blueberries, clear in the old version, are mostly gone. It now reads as a kitten in a bucket.
   - **207 Scruff carry**: the kitten being carried by the scruff no longer reads. Now it's one grey cat with purple mystery stains.

## Minor

- **211 Mushroom house**: the board is narrower (30x45) and muddier than the painting, but it still reads.
- **244 Slam dunk**: the hoop and net are a white blob, as murky as the old version.
- **213 (42x29) and 227 (42x31)**: these short boards leave a large empty band above the cards at 375.
- **Ink specks that aren't eyes**: 201 Teacup has a 3-cell piece at (8,30) and a 1-cell piece at (26,30) on the cup, not the face. 250 has a single black cell at (20,27) among the xylophone colours. 240 has one at (31,33). A strict reading of "never broken black bits" catches these. Everything else small is an eye, a nose or a spot.
- **217**: dark-brown cells hug the left side of the line and make it look doubled (close-up).
- **Win sheet**: the Coins tile shows a coin picture with no number (`375-map-start-fail-win.png`, panel 4). This comes from Zen's win sheet and was probably there before this change.

## Would a portal reject this world on sight?

No. The boards are clean and cute, and the subject reads on most of them. The UI words are calm and consistent, and there are no errors or layout breaks at 375 or 1280.

What a reviewer would still notice:
- the two art styles side by side (should-fix 2)
- the very busy mystery-block covering on kept 208, 210 and 228
- the stain-like mystery patches on 207, 217 and 231
- the painting boards look AI-generated
- the finale, 250, is visibly weaker than the version before it
