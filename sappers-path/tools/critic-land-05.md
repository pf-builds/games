# Critic: Zen World 4 Dino Valley (levels 301-350, Zen 137-186), commit a3194ad

One round, functional + visual, harsh. Read-only on code and data. Served on 8473 from the game folder (killed after).
Playwright only (no browser-pane tabs). Evidence in `tools/critic-land-05/`:
`results.json` (every functional step, both viewports), `levels-375-a.png` (20 level starts at 375x812@3, the board frame
as the player sees it), `zoom-ink-grid.png` (10 boards drawn from zen.json's grid at 7 px a cell, moat water in magenta),
`sources-suspects.png` (the source paintings behind the suspect boards), `map-seam-375-1280.png` (W3/W4 seam and
137-144 at 375 and 1280), `map-137-fresh-375.png`, `win-350-375.png`, `fail-375.png`, `play-301-full-375.png`.

**Verdict: functional PASS, 0 blockers. Fix first: 5 should-fix (picture choice and rights hygiene, all cheap swaps from
lane C's 36 spares), 7 minor.** Not clean enough to ship without someone looking at the opener and the swaps.

## Automated

- `SP.selfTest()` (`tools/selftest-lands.mjs --url http://127.0.0.1:8473/`): **875 pass / 0 fail** at 375x812@3 (touch),
  **877 / 0** at 1280x720, 0 console messages. Matches the builder.
- `tools/harness.mjs --url http://127.0.0.1:8473/`: **HARNESS: all passed**, 0 console messages.
- Own Playwright runs (real taps/clicks on cards, map nodes, panel buttons): **0 console messages, 0 page errors** across
  all scripts.

## Functional checklist

| # | Check | Result |
|---|---|---|
| 1 | Real-tap wins | PASS. Phone: 301 Hatching day (opener, reached by a real tap on map node 137, 54 taps), 309 Sailboat (Easy + moat, 39), 304 Kitten rider (portrait 32x46 + moat, 43), 303 Gone fishing (Easy, 7 colours, 55), 312 Wizard dino (Hard + moat, 49), 350 Hot-air balloon (finale, Hard + moat, 32x46, 55). Desktop: 301, 336 The Great Wave (Hard, 53), 348 American Gothic (portrait, 55), 350. Every one "Picture done" / "<title>, all dug out.", 0 refused taps, header number = Zen number (145, 140, 139, 148, 186, 172, 184). |
| 1 | Forced fail + paid Continue | PASS. 308 (phone) and 322 (desktop) jammed by real taps on `SP.lossPlan`: "A little stuck", "Line jammed: [chips] can't reach a block. Have another look.", "Continue 250", Retry / Back to map. Tap Continue at 1000 coins: 750 after, panel closes, play resumes, then finished by real taps: "Picture done". |
| 2 | Open from the start, one at a time | PASS. Fresh profile (plain URL): 186 Zen nodes; open = 1, 37, 87, 137 (each world's first); 138-186 `locked`; aria "Picture 137" / "Picture 186, Hard, locked". elementFromPoint at node 137's centre hits the node. Tap 137 starts the level at once (header "137 Hatching day"). After the win: map Play "Play picture 138", `.jr-cur` "Picture 138"; 139 still locked. |
| 2 | Numbers 137-186 | PASS. Map nodes, level header, map Play button and the home Zen card ("Continue Zen World 4 · Dino Valley ... Picture 138") all use Zen numbers. Node 44x44 CSS px, numbers 21 px at both sizes. |
| 2 | Saves | PASS. After the 301 win + reload: localStorage byte-identical; 137 done, 138 cur. Worlds 1-3 node states unchanged (1, 37, 87 open; 136 locked). Campaign `done` unchanged by a Zen win (5 → 5). The campaign save does change `coins` (+30) and `got/inv` (ladder unlocked on the first win): shared wallet and power-up unlock, by design, not progress. |
| 2 | selfTest / harness | 875/0, 877/0, harness all passed (above). |
| 3 | No hidden mystery blocks, every Zen world | PASS. zen.json: 136 records, none has a `hidden` key. levels.json's hidden grids are levels 150-200 only (29 levels), none in Kitten Forest 201-250. The `mystery` feat on 23 World 4 records is the "?" cards (allowed), not blocks. selfTest and land.js check both carry the Zen-hidden-free gate. |
| 3 | Moats | PASS. 18 ringed exactly as planned (304 305 307 309 312 314 315 320 322 325 328 329 330 331 334 335 340 350). In the 375 shots and the grid zoom the water sits on background around the hero (329, 325, 320, 330, 315, 350, 304, 312); no hero cells under water seen. 2 ways in is land.js check's and selfTest's (both pass). |
| 4 | Map at 375 touch and 1280 | PASS. World 4 banner "World 4 · Dino Valley" sits on the space/jungle join, jungle sheets with the volcano, eggs on spur tips, fog + "More worlds on the way" after 186. Node gaps: min 68 / median 88 CSS px at 375, 77 / 101 at 1280. 3-digit numbers legible in the gold and grey discs (map-seam-375-1280.png). |
| 4 | W3 → W4 seam | PASS (minor, below). 136 → 137 is 560 CSS px at 375 (map view 669 px, 0.84 screen), 642 at 1280. The W2/W3 join is 576 / 660, so it matches the established pattern exactly. Reads as travel, not breakage. |

## Should-fix (fix before ship)

1. **301 Hatching day is a weak opener.** Repro: Zen map, tap 137 (or `SP.load("z4-1")`) at 375 (levels-375-a.png first
   tile; play-301-full-375.png). The olive triceratops melts into a darker green blob against the pink sky, the frill is
   gone, and the eggs (the point of the title) are 3-4 tan specks on the sand. The source (sources-suspects.png) is clear;
   the board isn't. The first picture of a world should be its clearest. Pin a bold, 4-5 colour board here (e.g. 309
   Sailboat, 319 Starry Night or 339 Bunny race read at once) and move Hatching day deeper, or pick a spare.
2. **341 Karaoke night is the held-out trade-dress type.** Repro: `SP.load("z4-41")` (levels-375-a.png, row 2 last tile;
   zoom-ink-grid.png last). On the board it is a plain bright-green upright T-rex in profile, mouth open, standing alone (the
   mic and cream belly are lost). Lane C's `picks-full.json` `tradeDress` held out six boards for exactly "a plain green
   upright T-rex (Toy Story's Rex)" (dv210 dv287 dv317 dv301 dv248 dv229); dv220 is the same thing and slipped through.
   Not infringement on its own, but the rule is applied inconsistently. Swap for a spare. (317 Painting a masterpiece also
   has a green upright dino, but at an easel with a second dino and a volcano: not alone, so it passes lane C's own test.)
3. **338 Nailed it and 348 American Gothic don't read at phone size.** Repro: `SP.load("z4-38")`, `SP.load("z4-48")` at
   375 (levels-375-a.png tiles 2 and 3). 338: an orange blob with pink and white noise beside it; the cake and the joke are
   gone (source: a triceratops by a tall cake). 348: two brown upright smears on a cream church; faces, pitchfork and apron
   lost; it reads only if you already know the painting, and as a parody that's the whole point. Both confirm the
   orchestrator's flag. Swap both for spares (or move American Gothic to a 42x42 crop if one exists).
4. **Variety: red/orange T-rex fatigue and a near-duplicate pair.** Contact sheet + levels-375-a.png. 325 Surfing and 336
   The Great Wave are the same picture on the board: a red T-rex riding a blue-and-white curl, 11 levels apart. Red dino
   heroes: 306, 312, 314, 318, 320, 325, 326, 332, 336 (9 of 50); orange heroes on another ~11 (303, 305, 311, 323, 328,
   330, 333, 335, 338, 343, 346). Swap 325 for a non-wave, non-red spare at minimum; ideally one more red T-rex out.
5. **302 The Scream has broken black bits.** Repro: `SP.load("z4-2")` (zoom-ink-grid.png third tile). The darkest colour
   (black) is in 12 separate pieces: the railing streaks plus 1-3 cell flecks in the sky. The ink-outline rule (one solid
   line or none, never broken black bits) applies to every picture board, and this is the second picture of the world.
   Re-convert with black merged into the dark navy/brown, or accept it as the painting's railing and record the exception.

## Minor

6. **The six hero outlines: 4 clean, 2 slightly off.** Dark-cell component scan on zen.json grids: 303 Gone fishing (1
   component), 310 Birthday party (1), 329 Tuba blast (1), 347 Mud bath (1) are one solid line. 324 Kitten nap: the line is
   solid but open along the ground and has 2 stray black flecks (2 cells and 1 cell) off it. 346 Piano rex: 4 pieces (168,
   77, 3, 2): the outline merges into the black piano and 2 small flecks sit apart. Neither is the "broken bits inside"
   failure, but 324's and 346's flecks should go. 349 Deal with it also has 3 flecks beside its (solid) sunglasses.
7. **324 Kitten nap: the kitten is a grey blob** on the stegosaurus at 375; the outline keeps the stego readable, the
   kitten is not. 329 Tuba blast (a Hard): the yellow dino-with-tuba reads as a yellow slug with a horn; the black outline
   plus the blue moat ring right outside it make a double line.
8. **345 Video call** reads as a green blob in front of a dark box; the laptop is clear, the dino isn't.
9. **W3 → W4 seam**: 0.84 of a phone screen of empty space road between 136 and the banner. Same as the W2/W3 join
   (already accepted), so consistent, but two worlds now open with a scroll of nothing.
10. **LICENSES.md**: all 50 World 4 rows present, numbers and dv ids match zen.json exactly. The six parody rows don't say
    which painting they parody or that it is public domain. Add "after <painting>, <artist> <year>, public domain" to 302,
    315, 319, 336, 342, 348 so a portal reviewer sees the basis without asking.
11. **Map side panel (desktop, pre-existing, also in World 3)**: World 4's "Next up" panel offers "Side quest 12 ... Prize:
    Quartermaster +1" (an earlier world's Zen picture) while the same panel says "Side quests 0 / 0" and "Secrets found"
    with an empty value. Repro: 1280x720, `SP.zenTo` worlds 1-3 full + `zenTo(4,3)`, Map, Zen. Confusing, not World 4's
    doing.
12. **Home card "of 198 pictures"** while the map counts to 186 (the 12 Zen side quests are in the total). Pre-existing.

## Rights

| Level | Source painting | Status |
|---|---|---|
| 302 The Scream | Edvard Munch, 1893 (d. 1944) | Public domain (US: pre-1931 publication; EU life+70 expired 2015) |
| 315 Mona Dino | Leonardo, c. 1503-1519 | Public domain |
| 319 Starry Night | Van Gogh, 1889 (d. 1890) | Public domain |
| 336 The Great Wave | Hokusai, c. 1831 | Public domain (the game already ships the Met's CC0 scan as Gallery picture 12) |
| 342 Pearl earring | Vermeer, c. 1665 | Public domain |
| 348 American Gothic | Grant Wood, 1930 (d. 1942) | Public domain in the US since 1 Jan 2026 (1930 publication + 95 years, exhibited and reproduced in 1930); EU life+70 expired 2013 |

All six boards are new generated compositions after the paintings, not copies of a protected photo or reproduction, so no
museum-image claim attaches. **Trade dress**: no Barney-purple upright dino, no red-saddled green dino, no brown baby
long-neck, no text or logos seen in 50 boards. One plain green upright T-rex (341, should-fix 2). 320 Convertible's red
T-rex in a yellow car is generic.

## Blind framing

Would a portal reject this world on sight? **No.** First screens (home card, the jungle map with its volcano and the
World 4 banner, the level frame) are clean and on-brand, numbers legible, no errors. Visible reasons a reviewer might mark
it down: the opener (301) is a muddy board, a few parodies (348) and jokes (338) don't read at phone size, the run of red
and orange T-rexes makes the world feel samey by the middle, and 325/336 look like a repeat.

Clean enough to ship without the owner playtesting? **Functionally yes. Visually not yet.** Do the 5 should-fix swaps
(301 moved, 341, 338, 348, 325 swapped from spares; 302 re-converted or excepted), re-bake those slots, rerun selfTest
and the harness, and have someone eyeball the new contact sheet. That's a short pass.

## Re-check (fcf1a06)

Scope: the 5 should-fix items and anything the 6 swaps cause. Served on 8473, killed after. Evidence:
`tools/critic-land-05/recheck-levels-375.png` (16 level starts at 375x812@3: the 6 new boards plus their neighbours),
`recheck-301-full-375.png`, `recheck-results.json`; the builder's new `tools/land-05/contact.png`.

**Verdict: ship. 0 blockers, 0 should-fix remaining. 3 minor notes.**

- **Automated:** every script/style loads `?v=62`. `SP.selfTest()` **875/0** at 375x812@3, **877/0** at 1280x720,
  0 console messages. Real-tap wins at 375 (touch), 0 refused taps, 0 console: 301 Meteor shower (header 137, 47 taps),
  325 Ballet stegosaurus (161, Easy + moat, 48), 338 Rocket launch (174, 51), each "Picture done / <title>, all dug out."
  zen.json still has no `hidden` key on any of its 136 records.
- **SF1 opener: FIXED.** 301 Meteor shower: a yellow long-neck under a navy night sky looking up at a meteor streak, 4
  colours, one big dark sky, the hero and the streak read at a glance. It works as an opener. (Minor: the hero is thin,
  about 5 cells wide; a few adults may read "meteor + dinosaur" as the extinction joke. Harmless for this audience.)
- **SF2 trade dress: FIXED.** 341 is now Leaf umbrella: a blue dino under a big green leaf in the rain. Reads, no branded
  look. The new 338 Rocket launch has a green T-rex, but it is riding a red rocket in space, not standing alone, so it
  passes lane C's own test.
- **SF3 unreadable: FIXED.** 338 Rocket launch (green dino on a red rocket, navy sky) reads at once. 348 Hamburger friend:
  the burger reads clearly, the blue dino is a little soft against the green wood but reads as a dino. Acceptable.
- **SF4 variety: FIXED (at the minimum asked).** 325 Ballet stegosaurus (pink stego in a white tutu on a curtained stage,
  moat on the blue backdrop, off the hero) replaces the red wave duplicate; nothing else rides a wave. Red heroes now 8
  (306 312 314 318 320 326 332 336), orange about 11. Still the land's main palette, but acceptable for a dinosaur world.
  301/302 both have yellow heroes, but one is a thin long-neck on a navy night sky and the other a chunky dino in a bright
  garden with a pink flower. Different picture, different palette: not a near-duplicate. No other pair within 5 levels
  repeats a composition (348 and 350 both have blue heroes, but a forest burger scene vs a balloon).
- **SF5 The Scream ink: FIXED** by the swap (302 Gardening). Ink scan on the 6 new boards: 302, 325, 341, 348 have no
  dark colour at all; 301's navy is the sky (1 piece); 338's navy is the sky and two ground blocks (575 / 72 / 29 cells),
  solid areas, not line fragments. No outlines, no broken black bits.
- **Licences:** the parody rows now name the painting, artist, year and public domain (checked 315, 319, 336, 342);
  302 and 348 are no longer parodies. 50 rows still match zen.json.

Remaining minor (carry to LATER, don't block): 312 Wizard dino and 314 Log lift are both red T-rexes in a moat 2 levels
apart (pre-existing); 301's thin hero; 348's soft blue dino. Plus the earlier minors 6-12.
