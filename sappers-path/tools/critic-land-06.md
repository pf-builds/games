# Critic: Zen World 5 Masterpiece Gallery (v7 lane C/D), 2026-10-10

Build: branch sappers-path, head 6f246e6, served on 127.0.0.1:8507 (Playwright, chromium). Shots and data in `tools/critic-land-06/`.
Setup under `?debug=1` (SP.zenTo, SP.load, SP.winOrder, SP.lossPlan); map and level open judged on the plain URL.

## selfTest
`tools/selftest-lands.mjs --url http://127.0.0.1:8507/`: **375x812@3 879 passed / 0 failed; 1280x720 881 / 0; 0 console messages.** Trusted for records, numbering, caps, shades, moats, map tint presence, win line wiring.
All my own runs (3 scripts, 375 / 1000 / 1150 / 1280 / 1300 wide): **0 console messages, 0 page errors.**

## Counts
BLOCKER 2 · MAJOR 2 · MINOR 5

## BLOCKERS

**B1. In-game credits don't name the museums or the CC0 line.** Brief item 4.
Repro: plain URL, Map, Zen, scroll to the foot of the map (`#map-credits`) or open the Gallery. Text is `config.gallery.credits` unchanged from v6.4: "...paintings and prints from The Metropolitan Museum of Art Open Access (public domain)...". DOM check on the Zen map: "Art Institute" false, "National Gallery" false, "Cleveland" false. 38 of the 50 paintings (AIC 20, NGA 16, Cleveland 2) are not credited anywhere in the game. LICENSES.md is fine (B-side below). Fix: append lane C's line ("Public domain paintings from the Art Institute of Chicago, National Gallery of Art, The Met and Cleveland Museum of Art open access (CC0)") to `gallery.credits` (or a Zen-map credits line), and add a test.js assert.

**B2. La Grande Jatte (351 / Zen 201, mg003), the world's opener and Sonya's named request, is not recognisable.**
Repro: plain URL, Zen map, Play picture 201 (shot `play-201-plain-375.png`, also `play-201-1280.png`). The board is a sage/lavender/olive field with a pink smudge left of centre, a yellow patch and a grey column on the right. The parasol couple, the monkey, the bustle silhouette, the woman fishing: none of them survives. Cause (from `crops-override.json` x2 = [0.315, 0, 0.92, 1] and `contact-full.jpg` #1): the window is the busy middle of the painting at 42 columns, so each of ~15 figures is 3-5 cells wide and they dissolve into the dot-texture palette; the window ends at 0.92 and cuts the couple's man off, leaving only the woman's dark skirt as an unexplained grey slab on the right edge. At 1280 (board ~300 px) it still reads as mud. Frank verdict: someone who knows the painting would not name it, even with the title in the bar.
Fix: crop to the right-hand couple only, about x 0.58-1.0, y 0.08-1.0 of the painting (aspect ~0.69, the 34x46 box). The couple becomes two big dark profile silhouettes with the parasol arc and the monkey at their feet, which is the image everyone knows. Their dark coat and dress are large solid near-black shapes, which the ink rule allows (it bans broken bits, not one solid mass). Keep chroma near 1.0-1.2 so the lawn reads as one green and the shade band as another. Fallback: the parasol couple plus the seated group in front (x 0.50-1.0) at the 42x45 box. Re-bake 351 afterwards (it currently sits at both caps: 55 taps, 14.9 s longest tap). Either way show Peter and Sonya the new board before shipping.

## MAJORS

**M1. 8 more boards are mud and 1 is a bad crop** (item 1). Judged on `contact-installed.jpg`, the magnified composite `comp-borderline.jpg` and in play at 375 (`comp-boards.jpg`).
- Unreadable:
  - 366 / 216 mg012 The Boating Party (Cassatt): blue and green blocks, no boat, no figures. Crop the mother and child plus the oarsman's back, or swap.
  - 367 / 217 mg060 Hakone (Hiroshige): an abstract band. Low fame anyway, swap.
  - 379 / 229 mg032 The Japanese Footbridge (Monet, Hard): horizontal green streaks with no bridge. The bridge is the painting. Move the window up to the arch.
  - 381 / 231 mg072 Mahana no atua (Gauguin): coloured bands. Swap.
  - 385 / 235 mg058 Allies Day (Hassam): grey-blue noise with red specks at the foot. Crop the top band where the flags hang.
  - 393 / 243 mg057 Study for La Grande Jatte (Hard): green dot-noise. It also repeats the opener's subject. Swap for a spare.
  - 394 / 244 mg031 The Basket of Apples (Cézanne): no basket and no tilted table. Crop the basket and bottle, or swap.
- Bad crop: 380 / 230 mg123 Girl in a Green Blouse (Modigliani). The head is cropped off entirely, leaving a green blouse on orange. Take the top window.
- Weak (only nameable with the title): 351 (see B2), 358 mg001 Woman with a Parasol (white dress lost in the white clouds, only the green parasol survives), 359 mg073, 371 mg008 Water Lilies (admitted), 382 mg056, 388 mg065 La Berceuse (faceless orange oval), 391 mg094 Kintai Bridge (no arches), 392 mg127, 397 mg010 Sudden Shower (admitted; no rain lines).
- Read well: 352, 353, 354, 357, 360, 361, 363, 365, 369, 370, 372, 373, 374, 376, 377, 383, 384, 386, 398, 399, 400. Borderline but acceptable: 355, 356, 362 (top of head cut), 364, 368, 375, 378, 387, 389, 390, 395, 396.

So 17 of 50 are weak or worse, and 9 of them (with 351) are unreadable. For a world whose whole point is "I know that painting", that is too many. Crop rule of thumb from what works: one large subject (a face, a mountain, a bed) filling at least half the box beats a full-scene window every time. 12 spares exist (Breton Girls Dancing, Card Players, etc.).

**M2. The tinted map reads as the Campaign castle map again, aged** (item 3).
Repro: Zen map World 5 (`map-mid-375.png`) beside Campaign levels 9-17 (`map-campaign-375.png`, `comp-map375.jpg`). Same cottages, same plank bridges, same river shapes and trees. The tint only shifts green to ochre, so it looks like an old photocopy of sheet 2, not a gallery or a "sunny riverside". The pattern A, B, A', B', A, B, A' also shows the same cottage cluster 3-4 times while you scroll one world (e.g. the cottage at 216-218 and again at 249-250, `shots-land-06/map-top-375.png`). I know it was the deliberate zero-byte lever. It is still a visible step down from Worlds 1-4, which all have their own sheets. Cheapest fix: a stronger, clearly different grade (warmer, brighter, a cream vignette like a canvas) plus a horizontal mirror on the repeats. Or 2 new land sheets at about 0.5 MB.

## MINORS

- **m1. Long titles clipped in the 375 play bar.** 231 shows "Mahana no atua (Day of the !" and 232 shows "Children Playing on the Beac" (`comp-boards.jpg`). 201, 214 and 243 shrink to about 9 px. Repro: SP.load("z5-31") at 375x812. Shorten the `short` names (e.g. "Mahana no atua", "Children on the Beach").
- **m2. The realm card's Next up** on World 5 (1150/1280/1300) says "Side quest 12 ... Quartermaster +1", which is a World 1 side quest. Known and in LATER.md, pre-existing. It's more confusing here because World 5 has no side quests.
- **m3. Pace and shape.** Squads go up to 99 sappers (top tray counts 99, 98, 98, 98, 97, 97). Two digits fit the chips fine and don't look odd beside the 2-5s. Median real pace 221 s and 39-55 taps are inside the gates. The opener 351 is the worst-dealing board, though: about 1 deal in 200 attempts, 55 taps (the cap) and a 14.9 s longest tap. A first level that runs the longest walks of the world is a poor first impression. Re-crop per B2, or move it to 2-3 and open on Fuji (353) or the straw-hat self-portrait (354).
- **m4. Repeats.** Nine Van Goghs, three of them self-portraits (354, 374, 399), on top of the opener's subject repeated in 393. Lane C's call, but swapping 393 also fixes M1.
- **m5. 362 mg085 (Modigliani)**: the eyes and crown are clipped at the top edge. Shift the window up a few rows.

## Item checks that passed

- **Play** (debug, winOrder taps): Easy 353 Fuji won, 55 taps, "Storm below Mount Fuji by Katsushika Hokusai, all dug out." Hard 400 Bedroom won, 50 taps, "The Bedroom by Vincent van Gogh, all dug out." Moat 361 Two Sisters won, 45 taps, painter named. Fail: 371 Water Lilies through lossPlan (16 taps) gave "A little stuck / Line jammed: [chips] can't reach a block." Continue 250 was offered. Shots: `win-*.png`, `fail-371.png`. Zen words are in place: Picture done, "Have another look", no forts or goblins.
- **No locks** on any of the 50 (state.locked 0). ? cards on 23 levels, links on 18. Mystery blocks and archers are 0 per selfTest and the land gates. No mystery cells were seen in the 50 boards.
- **Map:** the World 4→5 join at 375 shows 199 and 200 done, then the "WORLD 5 Masterpiece Gallery" banner, then 201 current (`shots-land-06/map-join-375.png`, mine `map-join-375.png`). The crossfade is the same seam style as earlier worlds. Lore text reads well. The tint filter is on every World 5 sheet image. Eggs are on the spurs (grass, butterfly, mushrooms seen). The fog says "More worlds on the way". No horizontal overflow at 1000, 1150, 1280 or 1300. 1000 is narrow mode (bottom Play bar); 1150 and up show the realm card ("World 5 of 5, 12/50 cleared") and the Next up card (`comp-wide.jpg`).
- **LICENSES.md:** the World 5 section has the credits line plus a crop sentence, and 50 rows (351-400). Every row has CC0 and a museum URL (artic.edu / nga.gov / metmuseum.org / clevelandart.org): AIC 20, NGA 16, Met 12, Cleveland 2.
- **Regression:** Campaign level 12 won ("The goblin king flees. Level 12 cleared."). Zen World 3 #10 won ("Kitten vs. alien mouse, all dug out."), so non-World-5 win lines are unchanged. How to play launches the tour ("Skip tour / Send a squad", `howto.png`). 0 console messages.

## Ship verdict
**Do not ship as is.** B1 is a one-line config change. B2 plus M1 is a re-crop and re-bake pass on about 10 boards (351, 366, 367, 379, 380, 381, 385, 393, 394, ideally 358), using spares where a crop can't save it. Then show Peter and Sonya a fresh contact sheet with La Grande Jatte's new crop before pushing. M2 can ship as a known compromise if Peter accepts it, but it should be his call.
