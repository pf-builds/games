# Critic: Zen World 1 Picture Garden grows 36 → 50 (z1-37..z1-50), commit 476d985

One round, functional + visual, harsh. Read-only on code and data. New build served on 8474 from the game folder, the
parent build (5a500b1, `git archive` into the session scratchpad, repo untouched) on 8475 for old SP2 codes; both killed
after. Playwright only (no browser-pane tabs). Evidence in `tools/critic-world-01-50/`:
`results.json` (every functional step), `levels-37-50-375.png` (the 14 level starts at 375x812@3, header + board as the
player sees it), `fit-29-36-vs-new-375.png` (old 29-36 beside 37, 40, 44, 50), `sources-vs-boards.png` (source paintings
beside zen.json's grids for 37, 39, 42, 43, 47, 48), `map-36-37-375.png`, `map-37-50-375.png`, `map-seam-375.png`,
`map-37-50-1280.png`, `map-seam-1280.png`, `play-43-full-375.png`, `win-50-375.png`, `fail-375.png`.

**Verdict: functional PASS, 0 blockers. Fix first: 5 should-fix (all picture-level, all cheap: 2 swaps from lane C's 2
spares, 1 rename, 1 recolour, 1 ink merge or a recorded exception), 8 minor.** Not clean enough to ship without someone
looking at the swaps.

## Automated

- `SP.selfTest()` (`tools/selftest-lands.mjs --url http://127.0.0.1:8474/`): **876 pass / 0 fail** at 375x812@3 (touch),
  **878 / 0** at 1280x720, 0 console messages. Matches the builder.
- `tools/harness.mjs --url http://127.0.0.1:8474/`: **HARNESS: all passed**, 0 FAIL lines, 0 console messages.
- Own Playwright runs (real taps on cards, map node, panel buttons; clicks at 1280): **0 console messages, 0 page errors**.
- Every script/style on `?v=63`. Shipped-file diff vs parent: LATER.md, LICENSES.md, index.html, levels/zen.json,
  src/main.js (selfTest only), style.css. LICENSES has 14 rows z1-37..z1-50 matching zen.json.

## Functional checklist

| # | Check | Result |
|---|---|---|
| 1 | Real-tap wins | PASS. Phone 375 touch: **37** Ant picnic reached by a real tap on map node 37 (elementFromPoint hits the node; header "37 Ant picnic Easy"), 41 taps; **44** Ladybug umbrella (Easy, ? cards) 47; **39** Acorn stash (Normal, ? cards) 54; **43** Hummingbird (Hard, ? cards) 52; **50** Sunflower bees (finale, Hard, linked + ?) 48; **47** Butterfly chase (Easy) 47. Desktop 1280 clicks: **41** Strawberry hedgehog 49. Every one "Picture done" / "<title>, all dug out.", 0 refused taps, header number = Zen number. |
| 1 | Forced fail + paid Continue | PASS. 48 Wheelbarrow nap jammed by real taps on `SP.lossPlan`: "A little stuck", "Line jammed: Orange can't reach a block. Have another look.", "Continue 250", Retry / Back to map. Tap Continue at 1000 coins: 750 after, panel closes, play resumes; finished by real taps on `SP.solve()`'s order: "Picture done" (54 plays). |
| 2 | 37 opens next | PASS. Save with World 1's 36 cleared: home card "World 1 · Picture Garden / Picture 37"; map 36 done, 37 `cur` "play this one next", 38 locked, 50 locked "Hard". After the 37 win: "Back to map" → 38 cur, "Play picture 38". |
| 2 | Reload holds | PASS. localStorage byte-identical across reload; 37 done (37 Zen clears), 38 cur, home card "Picture 38". Worlds 2-4 first nodes (51, 101, 151) still `open`. |
| 2 | Old SP2 codes | PASS. Two codes made on the parent build: (A) Campaign 12 + World 1 36 + World 2 7 + World 4 3 (410 chars); (B) World 1's 36 only. Loaded through Settings → Load on the new build: summaries "Level 13 … Zen: 46 of 212 pictures" / "Level 1 … 36 of 212"; Zen done sets identical to the old build's (46/46, 36/36), Campaign done identical (12/12, 0/0). A: 51 and 57 done, 58 open, 151/153 done, 154 cur (last played), 37 open; B: 37 cur, home card "Picture 37". |
| 2 | Worlds 2-4 and Campaign unaffected | PASS. Code A round-trips every World 2/4 clear unchanged; campaign count unchanged; builder's freeze `--require` covers the data (not re-run). |
| 2 | Zen numbers 1-200 | PASS at 375 and 1280. 200 nodes, DOM order 1..200 with no gaps; the World 2 banner sits between 50 and 51, World 3's between 100 and 101, World 4's between 150 and 151. Node disc 44 CSS px; "200" fits (builder's 24.8 px in 28 px confirmed by the same DOM, not re-measured by eye). |
| 3 | Map: sheets, alternation, tint | PASS. World 1 now 7 sheets: land-01-b mirrored, a mirrored, b, a mirrored, b, **a mirrored, b** (from 26/27 per zen.json), every World 1 image `sepia(.22) hue-rotate(-12deg) saturate(1.08) brightness(1.04)`, World 2's sheets `none`. No file+mirror twice running. |
| 3 | Seam and spacing | PASS. 50 → banner → 51, no empty road, no orphan fork (map-seam-375.png). Sheet joins at 375: 8-9 244, 15-16 231, 22-23 262, 29-30 231, **36-37 262, 43-44 231** CSS px: the new joins repeat the established pattern exactly. Inside sheets 70-172 px (max 41-42, the skipped spot 5; less than any join). 1280: same shape (36-37 301, 43-44 265, 50-51 280). |
| 3 | Eggs on spur tips | PASS. z1-6-0 mushrooms, z1-6-1 grass, z1-7-0 owl, z1-7-1 yarn; 44 px; 74-111 px from the nearest node at 375. Sheet-relative positions identical to the old sheets of the same image and mirror (z1-6-* = z1-2-*/z1-4-*: (0.154,0.596), (0.492,0.225); z1-7-* = z1-3-*/z1-5-*), so the placement is the established one. |

## Should-fix (fix before ship)

1. **39 Acorn stash does not read.** Repro: `SP.load("z1-39")` at 375 (levels-37-50-375.png row 1 tile 3;
   sources-vs-boards.png). The source's orange squirrel on an acorn pile is gone: the squirrel melts into the orange
   leaves, and the acorn pile and the tree trunk are one 373-cell dark-brown mass peppered with orange. What's left is
   autumn confetti with two cyan flecks (the birds). The orchestrator's flag is confirmed. Swap for a spare (lane C's
   spares: pg06 Snail race, pg16 Watering can rain; not inspected here).
2. **43 Hummingbird reads as a red blob.** Repro: `SP.load("z1-43")` at 375 (play-43-full-375.png). The red trumpet flower
   is the biggest shape on the board and becomes a red sock; the bird is a thin green-and-purple sliver on its left edge,
   about 6 cells wide. It's the first Hard of the batch, so the player stares at it longest. Swap for the other spare, or
   re-crop the source tighter on the bird.
3. **47 Butterfly chase: the butterfly became a red "+" on a white field.** Repro: `SP.load("z1-47")`
   (sources-vs-boards.png, lower-left pair). The source's orange butterfly converts to a 5-cell red plus on cream, which is
   the Red Cross emblem shape (a protected emblem that games are routinely asked to remove). Small, but it's exactly what a
   reviewer's eye catches on a near-empty cream board. The cat is a pale grey silhouette on cream: it reads as a cat,
   weakly. Recolour the plus to the source's orange or reshape it, at minimum; better, swap if a spare is left.
4. **37 Ant picnic has no ants.** Repro: `SP.load("z1-37")` (sources-vs-boards.png first pair). The source's three red ants
   on the watermelon are lost in conversion (two stray red specks). The board itself reads at once (a watermelon slice on a
   checked cloth) and is a good first picture for the batch. Rename it ("Watermelon picnic") in zen.json and LICENSES.md.
5. **42 Pumpkin house breaks the ink rule.** Repro: grid scan of zen.json z1-42: the near-black charcoal `#3d323e` sits in
   **29 separate pieces** (45, 39, 19, 15, 12, 7 … cells) across the base and the stem (levels-37-50-375.png row 2 tile 1:
   the dark bush noise under the pumpkin). This is the same class as land-05's 302 The Scream (12 pieces, should-fix
   there). Merge the charcoal into the purple/dark green and re-bake, or record the exception in the notes.

## Minor

6. **48 Wheelbarrow nap** (orchestrator flag): the fox reads as an orange curled animal, the wheelbarrow only as a brown
   shape under it; white/yellow leaf speckle fills the top and bottom thirds. Busy, but the subject is there. Keep.
7. **50 Sunflower bees**: black in 7 bits (15 cells: bee bodies and stripes). They are the bees, and the finale reads at
   once, so it's the right call to keep; record the exception beside 42's ruling so the rule stays consistent.
8. **41 Strawberry hedgehog**: 157 red cells scattered as flecks around the hedgehog (strawberries). The hedgehog reads.
   **44 Ladybug umbrella**: the ladybug is a small red blob under a big leaf; reads as "bug under a leaf". **49 Apple tree
   owl**: the owl is a brown box with ears; readable. 38, 40, 45, 46, 50 read at a glance.
9. **Near-duplicates**: 35 Sunflower and 50 Sunflower bees (15 apart; an outlined emoji vs a scene, different enough);
   33 Jack-o'-Lantern and 42 Pumpkin house (9 apart, both a big orange pumpkin centred on the board); 36 Apples and
   Primroses and 49 Apple tree owl (13 apart, weak). None blocks; 33/42 is the closest pair.
10. **Style jump at 36 → 37** (fit-29-36-vs-new-375.png): 29-35 are flat emoji with one solid black outline, 36 a muddy
    museum still life, 37-50 outline-free painted scenes. It reads as the garden opening into scenes, not as breakage,
    and the outline-or-none rule holds on every new board. The run 35 → 36 → 37 is three looks in a row.
11. **Two yarn eggs on one phone screen at the seam** (map-seam-375.png): z1-7-1 yarn near 50 and World 2's first-sheet yarn
    near 53. The builder fixed a butterfly repeat on the same spur; this one crosses the world line.
12. **Pre-existing**: the load summary/home total says "of 212 pictures" while the map counts to 200 (the 12 side quests);
    the desktop World 1 side panel shows "Secrets found" with no value (map-seam-1280.png). Both carried from land-05
    minors 11-12.
13. Grass egg z1-6-1 sits on the mushroom house with no painted spur leading to it at 375; same spot as z1-2-1 and z1-4-1
    on the same sheet, so established, but it is the least "spur tip" of the eggs.

## Rights / trade dress

All 14 are FLUX.1 [schnell] originals (Apache 2.0), licence rows present. No real characters, logos or text seen. The one
emblem risk is 47's red plus (should-fix 3).

## Blind framing

Would a portal reject this on sight? **No.** Home card, the tinted forest map, the world banner and the level frame are
clean, numbers legible, no errors, and most of the 14 boards (37, 38, 40, 42, 45, 46, 50) are bright and readable at once.
What a reviewer would mark down: 39 is noise, 43 is a red blob, 47 is near-empty with a red cross on it.

Clean enough to ship without the owner playtesting? **Functionally yes. Visually not yet.** Do the 5 should-fix items
(39 and 43 swapped, 47 recoloured, 37 renamed, 42's charcoal merged or excepted), re-bake the touched slots, rerun
selfTest and the harness, and eyeball the new contact sheet. Short pass.

## Re-check (581cee0)

Scope: the 5 should-fix items and anything the swaps cause. Served on 8474 (killed after), every script/style on `?v=64`.
Evidence: `tools/critic-world-01-50/recheck-levels-37-50-375.png` (all 14 level starts at 375x812@3),
`recheck-swaps-375.png` (39, 42, 43, 47 larger), `recheck-results.json`.

**Verdict: ship. 0 blockers, 0 should-fix remaining. 4 minor notes.**

- **Automated:** `SP.selfTest()` **876/0** at 375x812@3, **878/0** at 1280x720, 0 console messages. Real-tap wins at 375
  (touch), 0 refused taps, 0 console: **43 Daisy crown lamb** (Hard, header "43 … Hard", 51 taps), **47 Butterfly chase**
  (Easy, 54 taps), both "Picture done / <title>, all dug out."
- **SF1 39: FIXED.** Mud puddle pig: a pink pig in a brown puddle on light green reads at a glance. (Minor: the white shape
  on the right, about 128 cells, doesn't say what it is; the pig's face is soft.)
- **SF2 43: FIXED.** Daisy crown lamb: a big white lamb on bright green under a pink sky, daisies in the grass. Reads at
  once, the clearest board of the batch after 50. Now 42x42, 5 colours, Hard, won by real taps.
- **SF3 47: FIXED.** A purple butterfly with a dark slate edge and a small second one, the grey cat leaping under them. All
  three subjects read. No red/pink plus anywhere.
- **SF4 37: FIXED.** Header and LICENSES.md say "Watermelon picnic".
- **SF5 42: FIXED.** Re-converted: no near-black colour at all (darkest is dark green `#435341`). The pumpkin and window
  read; the base is still a busy mix of dark green, dark red and purple (minor, no longer an ink issue).
- **Cross shapes:** a plus-shape scan over every colour of all 14 grids (a cell with its 4 neighbours, no diagonals, in a
  component of 21 cells or fewer) finds only two, both on 42 and neither is an emblem: the brown mouse in the yellow window
  (11 cells, brown on yellow) and a dark-red bush at the base. Nothing red or pink on white or cream anywhere.
- **Ink:** near-black (luminance under 0.06) appears only in 46 (dark-brown dirt, 112 cells + 5 small eye/nose flecks),
  49 (trunk + owl features) and 50 (bee stripes, 15 cells), which the orchestrator's ruling covers. 47's edge colour
  `#554677` (slate purple, not black) traces the butterflies' wings in 4 main pieces plus 5 single cells: part of the
  subject, reads as an outline.
- **Variety:** 39 pig and 43 lamb are 4 apart and both farm animals, but nothing alike on the board (pink-on-brown low
  scene vs a big white body on saturated green with a pink sky). Fine. The closer repeat is **32 Pig (emoji) and 39 Mud
  puddle pig, 7 apart**: same animal, different style (a flat outlined face vs a full scene). Minor, keep.
- **Map:** sheet 7 eggs are now owl and **glint**; World 2's first-sheet eggs kitten and yarn, so the two-yarns-on-one-
  screen minor (11) is gone. World 2 banner lore reads "Past the Garden the road runs on…".

Remaining minor (carry to LATER, don't block): 39's unexplained white shape; 42's busy base; 32/39 pig repeat; earlier
minors 6, 8-10, 12-13.
