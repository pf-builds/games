# Critic: Zen World 3 Snack Galaxy (levels 251-300), commit fdd0aea

One round, functional + visual. Read-only on code and data. Served on 8472 from the game folder (killed after).
Evidence in `tools/critic-land-02/`: `results.json` (every functional step, both viewports), `map-notes.json` (node
positions at 375, spacing, eggs, banners), `functional-375.png`, `levels-375-a.png`, `levels-375-b.png` (19 level starts
at 375), `map-strip-375.png` (World 2 top to World 3 fog, right to left = bottom to top), `zoom-egg-chocolate.png`,
`zoom-ink-desktop.png`.

**Verdict: functional PASS. 0 blockers. 4 should-fix (all picture or theme quality), 7 minor.**

## Automated

- `SP.selfTest()` (own run): **871 pass / 0 fail** at 375x812@3 (touch), **873 / 0** at 1280x720.
- `tools/harness.mjs` (PLAYWRIGHT_MODULE set, `--url http://127.0.0.1:8472/`): **HARNESS: all passed**, selfTest
  871/0 on the five phone-shaped viewports, 873/0 on the two desktop-shaped ones, 0 console messages.
- Own Playwright run (real taps / clicks on cards, map nodes, panel buttons): **0 console messages, 0 page errors**.

## Functional checklist

| # | Check | Result |
|---|---|---|
| 1 | Wins by real taps on the stored order | PASS. Phone: 251 (normal, mystery), 256 Easy, 255 moat, 254 mystery on navy, 278 mystery on plum (chocolate), 272 Hard (moat + chocolate), 286 Hard (mire moat), 300 finale (31x45, 8 colours, 2 links, 3 ? cards). Desktop: 280 Easy moat, 254, 300. All "Picture done", "<title>, all dug out.", 49-55 taps. |
| 1 | Forced fail + paid Continue | PASS. 258 (z3-8) jammed through real taps: title "A little stuck", line "Line jammed: [chips] can't reach a block. Have another look.", Continue 250 shown, Retry / Back to map. Tap Continue at 1000 coins: 750 after, play resumes, then the level finishes won. Both viewports. |
| 2 | World 3 open from start, one by one | PASS. Fresh profile: node 251 `mn open` ("Picture 1"), 252 `locked`, 300 `locked` (aria "Picture 50, Hard, locked"); World 1's 1 and World 2's 201 also open. Tapping node 251 then Play reaches z3-1. Win → "Back to map" → 252 `cur`, in view, Play reads "Play picture 2" → z3-2. |
| 2 | Home card + chip | PASS. Fresh: "World 1 · Picture Garden, 0 of 148 pictures". After the 251 win + reload: "World 3 · Snack Galaxy, 1 of 148, Picture 2". |
| 2 | Saves | PASS. Reload keeps `z3-1` done (localStorage byte-identical before/after reload). World 1 and 2 nodes unchanged after the W3 win. After `zenTo(1,5)` + `zenTo(2,3)` + reload: done = z3-1 + z1-1..5 + e9-201..203; Campaign `done` unchanged. |
| 3 | 375x812 touch and 1280x720 | PASS. Map renders (19 sheets, lazy), W3 banner present in DOM and on screen, nodes 44x44 CSS px and tappable, levels play to a win at both. Board cells 25 device px (8.3 CSS) at 375@3, 15 / 14 CSS at 1280. |
| 4 | Moats | PASS. 18 ringed (255 257 261 262 265 270 272 274 276 279 280 282 283 284 286 287 290 299), 270 + 286 mire. Water on the pre-moat board: 0% off the sky on 262 265 276 286 287; the rest sit on secondary sky/ground bands (280's ring runs through its striped sky, 274's bottom arc through soil and leaves, not the dome). Reach + 2 ways are land.js check's and selfTest's (both pass). |
| 4 | Mystery blocks | PASS. 11 levels (251 252 254 260 264 268 272 278 286 297 300). Painting kind has no ink (convert.outline 0 on all 50), so "none on ink" holds; the dark cells they sit on are skies. Chocolate `#342410` with the cream ? on 272's plum `#380a50` reads apart at zoom and as dark blotches at phone scale (zoom-egg-chocolate.png); on 300's red it is very clear. |

## Should-fix

1. **300 Broccoli mech (finale) does not read.** Repro: `SP.load("z3-50")` at 375 or 1280 (levels-375-b.png last tile,
   zoom-ink-desktop.png right). A green broccoli blob and a yellow dome on a red field; no mech, no figure. The 3
   chocolate mystery patches add more dark noise. The world's last picture should be its clearest. Swap in a spare that
   reads (or re-pin a stronger Hard at 300).
2. **296 Kitten and the laser: subject lost.** Repro: `SP.load("z3-46")` at 375 (levels-375-b.png). The kitten is a
   ~6x5-cell white smudge on a lilac planet; no laser visible; the big dark-sky + purple planet is what you see.
3. **262 Lemonade waterfall (a Hard) reads as abstract shapes.** Repro: `SP.load("z3-12")` (levels-375-a.png). Yellow
   wedge, white arc, black sky; the moat line wanders across the black. Nothing says lemonade or waterfall at phone size.
4. **Moon fatigue / near-duplicates (variety rule).** Contact sheet: 264 Moon picnic, 281 Moon drum and 298 Gravity spill
   share one composition (big cream crescent down the left, navy sky, small object centre); 282 Boba moon and 287 Crater
   golf are both a full-frame grey moon disc, five levels apart. Eight titles carry "moon". Swap at least 298 and one of
   282 / 287 for spares.

## Minor

5. **Forest egg kinds on space sheets.** Eggs cycle glowcap, wisp, glint, ember, bubble. The glowcap is a blue mushroom
   pair on a space spur (zoom-egg-chocolate.png left; sheet 1 right of node 4; sheet 4 left of node 24). Off-theme.
   Space kinds (the README's donut, alien, star, comet) when drawn.
6. **World 2 → World 3 seam.** 250 → 251 is 562 CSS px of road at 375 (node gaps elsewhere 57-72 px, sheet hops ~220-240),
   0.92 of the 610 px map view: one full screen of empty forest road with mushrooms before the banner (map-strip-375.png,
   2nd from right). Reads as travel, not breakage. The banner sits right on the forest/space join and hides it well.
7. **253 Chili launch, 273 Pineapple station, 294 First footprint: small but readable.** Sky share 73% / 74% / ~70%.
   253 is a thin red rocket on a hill (reads); 273's pineapple reads but the purple blob above it is unidentifiable; 294's
   astronaut is ~6x9 cells and reads. 269 Stegosaurus moon is fine (big silhouette). 271 Juice box shuttle is weak: an
   orange box shape, reads as "something orange".
8. **283 Rocket out of gas looks like a burger** (bun, lettuce, patty). Title and picture disagree.
9. **Moat rings at phone scale look like a broken blue outline** hugging the subject (257, 262, 274, 276): a 1-cell water
   line with 2 gaps. It is the moat mechanic, not ink, but on outline-free paintings it is the only "line" on the board.
10. **Pink ring + star decorations on the space sheets** (sheet 1 at right of node 3; sheets 4, 6, top) look like tappable
   markers but do nothing. Painted detail; fine if intended.
11. **Desktop home panel** on a fresh profile shows "World 1 of 3 · Picture Garden / Next up Picture 1" while the map is
   scrolled to World 3's start; "Picture 1" alone is ambiguous with three worlds that each have a picture 1. Cosmetic.

## Visual checklist

- **Ink-outline rule:** PASS. No broken black line inside any picture. Thin dark-cell scan flagged only 286, 290, 279, 299;
  magnified (zoom-ink-desktop.png) they are solid shapes (eyes, sunglasses, cake), not line fragments.
- **Trade dress / real characters:** none seen. 261's green dino astronaut is generic.
- **Map:** space sheets alternate and mirror cleanly, the road joins at every sheet edge, node spacing 67-72 px minimum at
  375 (no overlaps), tag chips legible, fog and "More worlds on the way" after picture 50.
- **One land / step up / portal test:** it reads as one land: navy-purple skies, snack planets, the teal nebula sheets
  with donut and cookie planets. Most of the 50 are bright, full-frame scenes that read at phone size, and the map is the
  best-looking stretch of road in the game. I did not shoot Kitten Forest side by side this round, so "step up" is judged
  from World 3 alone. A portal reviewer would not reject this on sight. Their first screens (home, map, 251 Kitten flag)
  are clean. The risk is the finale and two or three muddy boards (300, 262, 296) if a reviewer plays deep.
