# Critic: Zen World 8 National Park Posters (v7 lane D), 2026-10-13

Build: the snapshot of commit bfec7a7 (git archive, `scratchpad/w8-critic/sappers-path/`), served on 127.0.0.1:8539 (`python3 -m http.server`, killed after). The live worktree was not served. Playwright, chromium. Shots and data in `tools/critic-land-09/` (untracked):
- `boards/bNN.png` (each board in play at 375x812, 1x, CSS size), `boards.json`
- `blind-1..3.png` (Zen numbers only), `pairs-1..2.png` (LoC poster with the crop window in red, beside the board), `edges.png` (2x lower halves of the boards I judged clean)
- `comp-phone.png` (join, top and fog, win, loss at 375), `comp-tint.png` (Worlds 5, 6, 7, 8 at 375), `map-1280.png`, `notes.txt`

Setup used `?debug=1` (SP.zenTo, SP.load, SP.winOrder, SP.lossPlan). The map, the join and the map's Play were judged on the plain URL. Card taps in play were real touchscreen taps on `#tray button.card[data-col]`, with SP.settle between taps.

## selfTest
`tools/selftest-lands.mjs --url http://127.0.0.1:8539/`: **375x812@3 892 passed / 0 failed; 1280x720 894 / 0; 0 console messages.** I trusted it for records, numbering, caps, shades, moats, tint presence, the win-line wiring and the credits order.
My own runs (21 boards, the phone flow, loss/retry/map, 1280): **0 console messages, 0 page errors.**

## Counts
BLOCKER 1 · MAJOR 1 · MINOR 6

## How the boards were judged
I loaded every board (`SP.load("z8-N")`) at 375x812 and captured `#board` at its CSS size: 304x392 for the 38x46 boards, down to 336x248 for the landscape ones. I judged them blind from sheets showing only the Zen number, then checked each doubtful board against the LoC poster with lane C's crop window drawn on it (`pairs-*.png`) to give the reason.

**Result: 10 read, 11 weak, 0 mud.** About half the world needs its title. That's well below World 7's shipped 39/11/0 of 50 and World 6's 21% weak. Two causes repeat. The posters are flat, dark-ground designs whose heroes are thin (a white hiker on cream, a fountain jet, lilac spikes). And the crop windows keep the poster's own lettering (next section).

| Zen | Level | Id | Title | Tag | Rating | Reason |
|---|---|---|---|---|---|---|
| 330 | 480 | np001 | Old Faithful | N | reads | A tall cream plume against blue sky. A good opener, apart from the text band at its foot |
| 331 | 481 | np026 | Hereford Cow | N | reads | A white-faced cow's head with red ears on a yellow arc. Clean |
| 332 | 482 | np007 | Bighorn Ram | E | **weak** | The two rams merge into one grey mass on a grey rock. The horns are faint: "a grey animal on a rock" |
| 333 | 483 | np016 | Spare Our Trees | N | **weak** | A navy-and-blue leaf fan reads as a pinwheel or a star. The seed pod is a blue ball |
| 334 | 484 | np050 | Zoo Panda | E | reads | A panda with green bamboo on pink |
| 335 | 485 | np013 | See America: Peaks | N | **weak** | Mostly near-black, with white peak triangles in the top third: "mountains at night" at best |
| 336 | 486 | np030 | Leaping Deer | H | reads (borderline) | A dark leaping deer on blue. The mire ring traces it. Clean |
| 337 | 487 | np042 | Skiing in the East | E | reads | A blue skier on a snowy slope |
| 338 | 488 | np015 | Protect Your Parks | N | reads | Tree trunks in a green forest under a yellow arch. Clean |
| 339 | 489 | np040 | Fire Wrecks a Forest | E | reads (borderline) | Orange fire and grey smoke over a black hill |
| 340 | 490 | np067 | Zoo Monkey | N | reads | A brown monkey hanging by one arm (the letters around it hurt) |
| 341 | 491 | np014 | See America: Caverns | E | **weak** | A blue waterfall or icicle mass on black. It reads as a waterfall, not a cave. Stray light blocks down the left edge |
| 342 | 492 | np043 | They Like Winter | N | reads (borderline) | Two blue-clad figures in red caps on snow. Clean |
| 343 | 493 | np046 | Hiking | H | **weak** | A big green tree on cream. The hiker (white on cream) is gone apart from grey specks. A Hard whose subject doesn't show |
| 344 | 494 | np073 | Alaska | E | **weak** | Blue mountains and sea. The boat is a small tan smudge. The scan's cream margin and black edge run down both sides as a frame |
| 345 | 495 | np038 | Keep the Park Clean | N | **weak** | Blind, I read a duck: the boy in green overalls with an orange face, inside the water ring, looks like a mallard |
| 346 | 496 | np018 | Let Them Grow | E | **weak** | Two cream lobes over olive leaves on purple. The lilac spikes read as hands or ears |
| 347 | 497 | np051 | Brookside Panther | N | **weak** | A black cat shape on pink, but the red letters take about 30% of the board, so it reads as a sign |
| 348 | 498 | np063 | Buckingham Fountain | E | **weak** | A lit boat or saucer by a night skyline. The fountain jet is one yellow speck |
| 349 | 499 | np003 | Zion | N | reads (borderline) | A tall tan cliff over a green valley. Clean at play size (`edges.png`) |
| 350 | 500 | np035 | Rainier | H | **weak** | A busy mottled patchwork. The snowy peak is a faint pink-cream shape in the top third. The world's closer |

## BLOCKER

**B1. Poster lettering, or scan calibration strips, on 13 of 21 boards.** Repro: `?debug=1`, `SP.load("z8-N")` at 375x812, or look at `boards/bNN.png` and `pairs-1.png` / `pairs-2.png`. On a board, lettering reads as broken blocks. The win card's picture shows it too (the Old Faithful thumbnail in `comp-phone.png`).

Root cause (lane C's `srcCrop` in `picks-full.json`): 9 boards use variant `b`, whose window runs to y = 1.0 and so keeps the poster's foot text. The `x1` window (0.13-0.78) still takes in text on np016, np040, np050 and np051. np063 has no crop at all (window 0,0,1,1), and three trims keep the LoC colour or grey calibration target down the side.

| Zen | Level | Id | What shows | Re-crop fixes? |
|---|---|---|---|---|
| 330 | 480 | np001 | "YELLOWSTONE NATIONAL PARK" as green and cream dashes in a navy band, about the bottom 7 rows | **Yes.** Window bottom 1.0 to about 0.80 |
| 332 | 482 | np007 | "THE NATIONAL PARKS PRESERVE WILD LIFE" as grey and black dashes over the rock's foot | **Yes.** Bottom to about 0.82. Tightening x onto the rams also helps the weak read |
| 333 | 483 | np016 | "SPARE" in navy letters. This is the most legible text in the world | **Yes.** Bottom just above SPARE (about 0.66 of the trimmed poster) |
| 334 | 484 | np050 | LoC colour target down the left edge (red, yellow, navy), red "BROOKFIELD" bits at the bottom right, a grey column at the right | **Yes.** x from about 0.10, bottom up about 0.10 |
| 335 | 485 | np013 | "SEE AMERICA / WELCOME TO MONTANA" fragments in the bottom rows, plus the grey/white calibration strip down the left | **Yes.** x in about 0.08, bottom to about 0.85 |
| 337 | 487 | np042 | Lavender and pink dashes from the guide's small print along the bottom | **Mostly.** Bottom to about 0.75. Recheck for specks from the small print left of the skier |
| 339 | 489 | np040 | A red strip from "FIRE" across the bottom 4 rows | **Yes.** Bottom to about 0.70. The board gets shorter, and it's already on the too-easy watch, so re-bake |
| 340 | 490 | np067 | Blue "ZOO" shapes along the top, and a blue text block at the bottom right | **Partly.** A crop fixes the bottom, but "ZOO" sits beside the raised arm, so cropping it cuts the hand. Paint the letters out to the pale ground |
| 345 | 495 | np038 | Yellow specks in the bottom brown rows from "Keep The Park Clean" | **Yes.** Bottom to about 0.85 |
| 346 | 496 | np018 | Big cream "LET THEM GROW" fragments across the bottom 6 rows | **Yes.** Bottom to about 0.83 |
| 347 | 497 | np051 | Red "BROOKSIDE" across the top and red "ZOO" at the bottom right, about 30% of the board | **No.** BROOKSIDE sits right on the panther's back and ZOO in its band. Paint out, or drop the board |
| 348 | 498 | np063 | White/blue letter blocks along the top row ("BUCKINGHAM FOUNTAIN"), the grey-scale target down the left (3 columns), a colour strip down the right | **Yes, for the edges.** Inset x about 0.06 and y 0.06-0.85. The jet won't come back |
| 350 | 500 | np035 | Teal "RAINIER NATIONAL PARK" fragments in a cream band at the foot, plus the logo corners | **Yes.** Bottom to about 0.85. A tighter crop also makes the peak bigger |

Not lettering, but the same scan-edge fault (fold these into B1's re-crop):
- **341 np014:** light blocks down the left edge.
- **344 np073:** a cream margin plus a black edge, 2 columns each side. Inset x.

Checked clean (`edges.png`): 331, 336, 338, 342, 343, 349.

This is a blocker because the brief names lettering as reading broken, and 13 boards (62%) carry it. Eleven are fixed by a crop and two (340, 347) need a paint-out. Re-crops change board sizes, so every touched slot needs a re-bake.

## MAJOR

**M1. 11 weak boards** (the readability bar): 332 np007, 333 np016, 335 np013, 341 np014, 343 np046, 344 np073, 345 np038, 346 np018, 347 np051, 348 np063, 350 np035. Two of the three Hards are weak (343 Hiking, 350 Rainier, the closer). Several get better from B1's crop if it's tightened onto the hero, not just trimmed above the text: 332 (onto the rams), 335 (onto the peaks), 350 (onto the peak), 344 (onto the boat). The rest are design limits: 343 (white hiker on cream), 348 (thin jet), 346 (lilac spikes) and 345 (boy reads as duck). Those want swapping or a lane C edit. The world has no spares (np019 and np020 were dropped as too easy), so swaps mean going back to the 70-odd LoC downloads. Priority: 350 (the closer), then 343, then 347.

## MINORS

- **m1. Theme fit.** The title promises parks, but 4 boards are city zoos (334 panda, 340 monkey, 347 panther; np019 and np020 are already out), 331 is a cattle feeders' Hereford, and 348 is a Chicago fountain. The lore covers "zoo animals", but a player reading "National Park Posters" over a cow and a fountain will notice. A rename is the cheap fix. **Suggest "Poster Parade"**: it covers zoos, cattle and fountains, still fits the lore's "old 1930s park and travel posters", and is a word-check-safe two-word name. "Old America Posters" is the alternative, but it's clunkier. The other route is to keep the name and swap out 331, 348 and the zoo boards, but that costs boards the world doesn't have. Peter's call.
- **m2. "1930s" in the credit line and lore** isn't quite right. 344 Alaska (np073) is "192-?", 350 Rainier (np035) is "192-" (both Northern Pacific railway posters), and 331 is 1940. Suggest "1920s-40s" or "vintage", or leave it.
- **m3. Map tint.** Sheets 9/8/9 carry `sepia(.55) saturate(2.1) hue-rotate(-16deg) contrast(1.35) brightness(1.02)` (all three images). It's clearly distinct from Worlds 5-7 (`comp-tint.png`): World 5 is a pale olive sepia, World 6 a soft green, World 7 blue-violet, and World 8 a hot amber-ochre canyon with dark pines. It reads as a desert park, which fits. The contrast is high, so the pines go near-black and the map looks a little burnt next to its neighbours. The nodes and road stay legible. Acceptable.
- **m4. Node fit:** all 21 numbers fit their discs at 375. The tightest have 1.0 px spare (332, 333, 336, 338, 339), the same margin as Worlds 5-7.
- **m5. Carried over at 1280:** Next up shows "Side quest 12 ... Prize: Quartermaster +1", with an empty "Secrets found" and 0 coins on the realm card (known, LATER.md).
- **m6. The loss line's colour chips** are plain digits in `textContent` ("Line jammed: 35840535 ..."). They render as chips on screen, as on World 7, so it's no issue for players. Noted only.

## Checks that passed

- **Join at 375 (plain URL):** 328 and 329 are done (green ticks) on World 7's blue sheet. Then comes the banner "WORLD 8 · National Park Posters" (`#jr .bn`, with the lore), then **330 current** ("Picture 330", "Play picture 330"), with 331-350 locked. No horizontal overflow (0 px). `map-join-375.png`.
- **Top and fog:** 345-350 sit on the ochre sheet under "More worlds on the way". 350 Zen nodes in all. `map-top-375.png`.
- **Win (opener):** the map's Play opened "330 Old Faithful". 51 real taps on the winOrder gave "Picture done" and the plain Zen line "**Old Faithful, all dug out.**", with First clear +20, Back to map and Retry. `win-375.png`.
- **Loss:** 350 Rainier (Hard): 9 taps (the lossPlan prefix) gave "A little stuck", the Hard chip, "Line jammed: [5 chips] can't reach a block. Have another look.", Continue 250, then Retry / Back to map. Retry restarted z8-21 (play, 5 cards), and the map button returned to the map. `fail-375.png`.
- **Desktop 1280:** the realm card reads "WORLD 8 OF 8 · National Park Posters" with the lore and "5/21 cleared". Next up is "World 8 · Picture 335". The map is centred, with 0 px overflow. `map-1280.png`.
- **Titles at 375:** none of the 21 overflows. The smallest auto-fit is 15.6 px (341 See America: Caverns).
- **Credits:** the Zen map foot ends "... Under the Sea: ... by Click it! Studios. **National Park Posters: 1930s WPA and travel posters from the Library of Congress (no known restrictions on publication).**" It's after World 7's and matches the brief's line.
- **LICENSES.md World 8:** the heading "Zen World 8: National Park Posters (Land 7, levels 480-500 ...)", then the credit line, then **21 rows** "| 330 | 480 | Old Faithful: ... (np001) |" .. "| 350 | 500 | Rainier: ... (np035) |". All 21 carry an `https://www.loc.gov/item/...` URL and the LoC licence text. The artists appear in the LoC's own form, as the notes say.
- **Content safety:** nothing at play size would bounce a kid or a portal reviewer. 339 Fire is orange flames on a hill, not a burning animal.

## Ship verdict
**Ship after fixes.**

Blocking:
- **B1:** re-crop np001, np007, np016, np050, np013, np042, np040, np038, np018, np063, np035 clear of lettering and calibration strips (and inset np014 and np073's edges). Paint out the letters on np067 (top "ZOO") and np051 (BROOKSIDE / ZOO), or drop np051. Re-bake every touched slot and show Peter a play-size contact sheet.

Non-blocking:
- **M1:** for the art lane, while re-cropping, tighten onto the hero for np035 (the closer), np007, np013 and np073. Swap or edit np046 (Hiking, a Hard), np063, np018 and np038 when there's time.
- **m1:** rename the world, suggested "Poster Parade" (Peter's call).
- **m2:** "1930s" vs the two 1920s Northern Pacific posters and the 1940 Hereford.
- **m3-m6:** acceptable, known, or noted.

---

# Round 2 re-check (fix pass), 2026-10-13

Build: the snapshot of ac69b56 (git archive at `scratchpad/w8r2-critic/`, cache tag `?v=77`), served on 127.0.0.1:8541 and killed after. The busy worktree was not served. Shots in `tools/critic-land-09/r2/` (untracked):
- `boards/z8-NN.png` and `boards/z9-NN.png`: every World 8 and World 9 board at 375x812, 1x, CSS size
- `blind-w8.png`, `blind-w9-swaps.png`, `w9-all-small.png`: Zen numbers only
- `zoom-letters.png`: 2x of the three spots I doubted
- `comp-r2.png`: the 7->8 join, the 8->9 join and the win
- `notes.txt`

## selfTest
375x812@3 **896 / 0**; 1280x720 **898 / 0**; 0 console messages. My runs (63 boards, joins, map Play, a real-tap win): **0 console messages, 0 page errors.**

## Counts
BLOCKER 0 · MAJOR 0 · MINOR 3

## 1. World 8 "Poster Parade", 13 boards, blind at 375

| Zen | Level | Id | Title | Tag | Rating | Lettering / strips |
|---|---|---|---|---|---|---|
| 330 | 480 | np001 | Old Faithful (29x46) | N | reads | None. The foot is a 2-row navy band with no letter shapes. The win card's picture is clean too |
| 331 | 481 | np026 | Hereford Cow | E | reads | None |
| 332 | 482 | np007 | Bighorn Ram | N | reads (borderline) | None. Better than round 1: red-brown rams on a grey rock against an orange sunset, and the ring traces them. The heads touch the top edge |
| 333 | 483 | np016 | Spare Our Trees | E | **weak** | None ("SPARE" gone). It still reads as a pinwheel or star. A subject limit, not a crop fault |
| 334 | 484 | np050 | Zoo Panda | N | reads | Letters gone. A few pale single cells in the top-left green, and a 1-column pale strip on the right edge (top ~12 rows). Neither reads as letters (m1) |
| 335 | 485 | np030 | Leaping Deer | H | reads (borderline) | None |
| 336 | 486 | np042 | Skiing in the East (32x46) | E | reads | Print gone. A handful of white, blue and lavender cells at the lower left read as snow, not text (m1) |
| 337 | 487 | np040 | Fire Wrecks a Forest | N | reads (borderline) | None. The red "FIRE" strip is gone: orange fire under grey smoke on a black hill |
| 338 | 488 | np015 | Protect Your Parks | E | reads | None |
| 339 | 489 | np043 | They Like Winter | N | reads (borderline) | None |
| 340 | 490 | np038 | Keep the Park Clean | E | **weak** | None (the text specks are gone). The boy still reads as a duck inside the water ring |
| 341 | 491 | np018 | Let Them Grow | N | **weak** | None ("LET THEM GROW" gone). Three cream lobes on purple; the lilac doesn't read |
| 342 | 492 | np003 | Zion | H | reads (borderline) | None. A 1-column tan margin runs down the right edge (m1) |

**10 read, 3 weak, 0 mud. Lettering: none left on any board. Scan strips: only the 1-column edge slivers on 334 and 342.** B1 is closed. M1 drops from 11 weak to 3 (23%, near World 6's shipped 21%). Both Hards (335, 342) read. Titles: 0 overflow, smallest 16.3 px.

## 2. Banner, lore and credit
- **Banner:** "WORLD 8 · Poster Parade", with the new lore ("... from the 1920s-40s: geysers, peaks and forests, wild animals and zoo animals, ski trails and snowy days ...").
- **Credit on the Zen map foot:** "... Under the Sea: ... **Poster Parade: 1920s-40s WPA and travel posters from the Library of Congress (no known restrictions on publication).** Puppy Park: ..." It's in order, and round 1's m2 (the "1930s" date) is fixed.
- **LICENSES.md:** the heading reads "Zen World 8: Poster Parade (Land 7, levels 480-492 ...)", followed by the credit line and **13 rows** keyed 330-342, each with its loc.gov item URL. "National Park Posters" appears 0 times in LICENSES.md.

## 3. Joins (375, plain URL)
- **7->8:** 328 and 329 are done on World 7's blue sheet. Then comes the banner "WORLD 8 Poster Parade", then **330 current** ("Picture 330", "Play picture 330") on the ochre cliffs. 0 px overflow.
- **8->9:** 338-342 sit on World 8's ochre sheet. Then comes the banner "WORLD 9 Puppy Park", then **343 open** (white disc: every world's first picture is open) on the green meadow. The tints are sheets 9/8 in ochre, then sheet-03 under World 9's own filter.
- **Map size:** 392 nodes in all. Every number from 330 to 392 fits its disc (tightest 1.0 px at 332).

## 4. Win
The map's Play opened "330 Old Faithful". 37 real taps on the winOrder gave "Picture done", "**Old Faithful, all dug out.**" and First clear +20 (`comp-r2.png`). 0 console messages.

## MINORS
- **m1. Edge slivers.** 342 np003 has a 1-column tan poster margin down the right edge. 334 np050 has a pale strip at the right edge, top ~12 rows, and pale specks in the top-left green. 336 np042 has a few stray cells at the lower left. None reads as lettering at play size. A 1-column inset on np003 and np050 would clean them up if lane C re-crops anyway. Not worth a re-bake alone.
- **m2. Stale `realmName` in the packed map data.** zen.pk.json's World 8 layout sheets still say "National Park Posters". main.js:288 overrides it at runtime with the world's name, so no player sees it (the banner and realm card say Poster Parade). Tidy at the next rebuild.
- **m3. The 3 remaining weak boards** (np016, np038, np018): subject limits. Swap them for the art lane if spares turn up.

## Verdict, World 8
**Ship.** No lettering is left on any board, the rename and credits are right, both joins are clean and the opener wins. The minors don't block.
