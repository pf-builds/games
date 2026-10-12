# Critic: Zen World 7 Under the Sea (v7 lane D), 2026-10-12

Build: branch sappers-path, head d25c48b (not pushed; live is c4ddc88), served on 127.0.0.1:8527 (Playwright, chromium). Shots and data in `tools/critic-land-08/` (untracked, not committed).
Setup under `?debug=1` (SP.zenTo, SP.load, SP.winOrder, SP.lossPlan); the map, the join and the map's Play were judged on the plain URL. Card taps in play were real touchscreen taps on the visible cards (`#tray button.card[data-col]`), with SP.settle between taps.

## selfTest
`tools/selftest-lands.mjs --url http://127.0.0.1:8527/`: **375x812@3 888 passed / 0 failed; 1280x720 890 / 0; 0 console messages.** Trusted for records, numbering, caps, shades, moats, tint presence, win line wiring and credits order.
My own runs (50 boards at 1x, 12 ringed boards at 3x, play, win, loss, map at 375 and 1280): **0 console messages, 0 page errors.**

## Counts
BLOCKER 1 · MAJOR 2 · MINOR 7

## How the boards were judged
I loaded every board in play (`SP.load("z7-N")`) at 375x812 and captured the `#board` canvas at its CSS size: 336x360 px, or 256x392 for the six 32x46 boards. That's 8 px a cell, which is what a phone shows (a 3x phone is sharper, but the cell count is the same). I judged them blind first, from sheets showing only the Zen number (`blind-1.png` .. `blind-5.png`). Then I checked the doubtful 16 against lane C's sources (`pairs.png`) to give the reason. The question each time: could a player name the scene without the title bar? Zen hides nothing, so the starting board is the whole picture.

**Result: 38 read, 9 weak, 3 mud.** That's far better than World 6's first round (7 / 21 / 22) and close to its round 2 (23 / 6 / 0 of 29). The AI story scenes do what the woodblock prints couldn't: one big cartoon hero on a flat ground survives 42 columns.

| Zen | Level | Id | Title | Tag | Rating | Reason |
|---|---|---|---|---|---|---|
| 280 | 430 | us201 | Octopus drummer | N | reads | A big orange octopus over a red drum. A good opener |
| 281 | 431 | us257 | Sandcastle | N | reads | A red crab, a yellow castle and palms on a beach |
| 282 | 432 | us265 | Anglerfish lantern | E | reads | A purple fish with a yellow lamp on a stalk, on black |
| 283 | 433 | us221 | Swordfish fencing | N | reads (borderline) | Two fish face to face over sand. The bills are faint, so "fencing" needs the title |
| 284 | 434 | us203 | Hot spring spa | N | reads | A red crab in a pool under a smoking volcano |
| 285 | 435 | us208 | Shark dentist | E | **weak** | The shark's head breaks into grey and white blocks, and the chair and tools are lost. "A shark?" at best |
| 286 | 436 | us205 | Alien sub | N | **weak** | The pink UFO reads as a pink island on the horizon. The fish read; the alien doesn't |
| 287 | 437 | us288 | Night voyage | N | reads | A sailing ship at night |
| 288 | 438 | us236 | Pufferfish reader | E | **mud** | A red-and-yellow blob in columns of orange and purple coral. No fish shape and no book. Edited, and still mud |
| 289 | 439 | us210 | The Great Wave | N | reads | The wave. It's the clearest board in the world |
| 290 | 440 | us244 | Turtle submarine | N | reads | A yellow submarine (no turtle). The mire ring outlines it well |
| 291 | 441 | us212 | Treasure guard | H | reads | A big orange octopus. There's no treasure, but the hero reads |
| 292 | 442 | us305 | Kitten diving bell | E | reads (borderline) | A brass porthole reads strongly. The kitten is a small orange shape and reads as a seahorse |
| 293 | 443 | us213 | Whale opera | N | **weak** | The pink rock dominates, and the blue whale merges into the blue sea. Orange and pink stripes |
| 294 | 444 | us260 | Coconut island | N | reads | A palm island |
| 295 | 445 | us267 | Giant squid | E | reads | A red squid on navy. The mire ring outlines it |
| 296 | 446 | us222 | Crab ping-pong | N | reads | Two crabs at a green table. The ring is stray (see M2) |
| 297 | 447 | us274 | Lava tube | N | reads (borderline) | A yellow sub in a dark cave. The lava is an orange blob, and it's the second of three yellow subs |
| 298 | 448 | us229 | Octopus barista | E | reads | A pink octopus at a yellow counter (the barista part needs the title) |
| 299 | 449 | us282 | Alien abduction | N | **weak** | The green saucer merges with its beam into a green lamp or lighthouse shape. The octopus reads. Edited |
| 300 | 450 | us289 | Pirate parrot | N | reads | A red parrot on a ship's rail under the moon |
| 301 | 451 | us302 | Birthday whale | H | reads | A blue whale in a pink party hat |
| 302 | 452 | us252 | The Great Wave 2 | E | reads | The wave with an orange octopus riding it |
| 303 | 453 | us245 | Crab train | N | reads | A red crab with its claws up (no train). The ring hugs it |
| 304 | 454 | us296 | Reef family | E | **weak** | Dark green turtle shapes are lost in salmon coral. Reads as "coral" |
| 305 | 455 | us307 | Pirate captain | N | reads | A pirate in a boat, with a hat |
| 306 | 456 | us217 | Walrus band | E | reads | A brown walrus on an ice floe (no band) |
| 307 | 457 | us262 | Surfing crab | N | reads (borderline) | A big wave with a small red crab on a yellow board. The crab is thin |
| 308 | 458 | us270 | Vampire squid | H | reads | A red squid with a dark cape. Not scary at this size |
| 309 | 459 | us225 | Octopus juggler | E | reads | An orange octopus with balls in the air |
| 310 | 460 | us275 | Black smoker | N | **weak** | A dark chimney with white puffs and a yellow sub. A kid sees "a smoking tree"; the title's word is obscure anyway |
| 311 | 461 | us233 | Turtle teacher | E | reads | A green turtle at a blackboard |
| 312 | 462 | us283 | Alien tourist | N | reads | A green alien with a pink outline. Edited |
| 313 | 463 | us290 | Ghost ship | E | reads | A glowing green ship under a yellow moon. Not scary |
| 314 | 464 | us224 | Turtle race | N | reads | A sea turtle on a beach by a red flag |
| 315 | 465 | us256 | Mona Lisa fish | H | **weak** | An orange fish in a landscape. The Mona Lisa pose and the hands don't read, and the ring cuts across the hills (M2) |
| 316 | 466 | us250 | Penguin canoe | E | reads | A penguin with a red canoe |
| 317 | 467 | us299 | Pufferfish surprise | N | reads | A round yellow puffer. The ring hugs it with a small loop |
| 318 | 468 | us308 | Snorkel puppy | E | **mud** | A red cap over an orange mass in coral. No puppy, no goggles and no turtle |
| 319 | 469 | us309 | Mermaid band | N | **mud** | A pink frame and cream blocks. The mermaid and the octopus are teal and orange specks |
| 320 | 470 | us264 | Lighthouse | E | reads | A red-and-white lighthouse. The ring is stray (M2) |
| 321 | 471 | us315 | Jellyfish lamps | N | reads | A yellow jellyfish on black. Edited |
| 322 | 472 | us312 | Squid basketball | H | reads | A purple squid with an orange ball |
| 323 | 473 | us276 | Lava cooking | E | **weak** | A red crab in a grey cave hole. The fire and the cooking are specks |
| 324 | 474 | us235 | Pufferfish doctor | N | **weak** | A yellow fish face in busy yellow-orange shapes. The turtle and stethoscope are lost |
| 325 | 475 | us285 | Alien fishbowl | E | reads | A big-eyed alien face |
| 326 | 476 | us293 | Storm ship | N | reads | A ship under a curling wave at night, with lightning |
| 327 | 477 | us269 | Lantern fish parade | E | reads | Bright fish on black |
| 328 | 478 | us277 | Volcano island | N | reads | A volcano with a smoke plume on a pink sky |
| 329 | 479 | us254 | Starry Sea | H | reads | Starry Night swirls and the cypress. A strong closer |

## BLOCKER

**B1. 3 mud boards** (the readability bar). Repro: `?debug=1`, `SP.load("z7-N")` at 375x812, or look at `boards/b09.png`, `b39.png`, `b40.png` and `blind-1.png` / `blind-4.png`.
- 288 / 438 **us236** Pufferfish reader (Easy, edited)
- 318 / 468 **us308** Snorkel puppy (Easy)
- 319 / 469 **us309** Mermaid band (Normal)

All three are busy scenes with small heroes: a fish holding a book in coral, a puppy riding a turtle, a mermaid and an octopus on a stage. The cheapest fix is to swap them for 3 of the 12 spares that pass at play size (one hero, a flat ground) and re-bake those 3 slots. This blocks because it's the brief's main question and World 6 shipped at 0 mud. It's a small fix.

## MAJORS

**M1. 9 weak boards** that need the title: 285 us208, 286 us205, 293 us213, 299 us282, 304 us296, 310 us275, 315 us256, 323 us276, 324 us235 (reasons above). That's 18% of the world, against World 6's shipped 21%. Only one is a Hard (315, Mona Lisa fish). The art lane can simplify or swap these when there's time. Prioritise 315 (a Hard and a parody whose joke doesn't land at this size), then 299 and 286.

**M2. 3 rings read as stray lines.** Repro: `SP.load("z7-41")`, `z7-17` and `z7-36` at 375 (`zoom-rings.png`).
- **320 us264 Lighthouse (mire):** a dark zig-zag across the sky and down the right side. It's the strongest line on the board and has nothing to do with the lighthouse.
- **296 us222 Crab ping-pong (water):** a blue loop around the crabs that trails across the sand to the bottom-left corner.
- **315 us256 Mona Lisa fish (water):** a blue line across the hills and under the fish, on a board that's already weak.

**Drop these to moatSkip:** us264, us222, us256 (re-bake 470, 446, 465). Rings drop from 12 to 9.

Borderline: **280 us201** (the opener's ring wanders right into the coral) and **317 us299** (it hugs the puffer, then loops right). Keep them unless those levels are re-baked anyway.

These are fine, because the ring outlines the hero: 290, 295, 299, 303, 308, 321, 322.

## MINORS

- **m1. The edit notes say "lane C" in public LICENSES.md** (8 rows: us265 us205 us236 us267 us282 us270 us283 us315). The wording is internal and reads clumsily: "Painted for readability by lane C: the deep black ocean covered over 75% of the board: a coloured sea floor painted along the bottom" and "...by lane C: 8-10 colours: reduced to 6 colours with bold flat shapes". Fix: use World 6's form, "Adapted for the board by Click it! Studios: a coloured sea floor added along the bottom" / "...: simplified to fewer, bolder colours".
- **m2. The Great Wave titles.** "The Great Wave 2" (302 us252) is a placeholder-style title, and a player sees it right after "The Great Wave". 289 us210 carries the real print's exact name, though it's an AI parody, and World 6 just showed real Hokusai prints. It's not a swap of a real painting (the famous-paintings rule), but a player could take it for Hokusai's. Suggest "Big Wave" and "Octopus on the Wave" (Peter's call). The licence rows name the originals correctly: The Great Wave off Kanagawa (Hokusai, c. 1831) twice, the Mona Lisa (Leonardo, c. 1503-1519) and The Starry Night (van Gogh, 1889), each "a new composition, not a copy". Those are sensible.
- **m3. Repetition.** The world has 5 octopus heroes (280, 291, 298, 299, 309), plus 3 squids (295, 308, 322) and an octopus in 302. It has 6 crabs (281, 284, 296, 303, 307, 323), 3 yellow submarines (290, 297, 310), 3 pufferfish (288, 317, 324) and 3 turtles (304, 311, 314). Waves: 289 and 302 are both Great Wave layouts, and 326 Storm ship is a third curling wave, with 287 a second ship at night. Nothing is back to back except 309/310, but a player will feel "another crab". If the art lane swaps boards (B1, M1), take the spares from under-used subjects.
- **m4. Map tint.** World 7's sheets 14/15 carry `sepia(0.2) hue-rotate(150deg) saturate(1.5) brightness(0.9) contrast(1.1)` (checked on every World 7 image). It's clearly distinct from World 5's warm sepia and World 6's pale green (`comp-desk.jpg`). The read is a blue-violet moonlit marsh: lavender-mauve pools, dark land trees and a pale aqua road. It's watery and cool, but not "under the sea" (no reef, no bubbles beyond the eggs). It's the same zero-byte compromise as Worlds 5 and 6, so it's Peter's call.
- **m5. Carried over at 1280:** Next up still shows "Side quest 12 ... Prize: Quartermaster +1" (a World 1 quest), with an empty "Secrets found" and 0 coins on the realm card (known, LATER.md).
- **m6. Node fit:** all 50 World 7 numbers fit their discs at 375. The tightest has 1.0 px spare (World 7's minimum, and 222's overall), the same margin as Worlds 5 and 6.
- **m7. The two borderline rings** (280, 317) in M2.

## Checks that passed

- **Join at 375 (plain URL):** 277, 278 and 279 are done on World 6's green sheet, then the banner "WORLD 7 Under the Sea", then 280 current ("Picture 280", "Play picture 280"). No horizontal overflow (`map-join-375.png`).
- **Top and fog:** the top of the world shows 323-329 on the blue sheet, then "More worlds on the way" under the fog. An egg (a red saucer) sits just below the fog, as the notes say (`map-top-375.png`). The map holds 329 nodes and the last is 329.
- **Win (opener):** the map's Play opened "280 Octopus drummer". 51 real taps on the winOrder gave "Picture done" and the plain Zen line "**Octopus drummer, all dug out.**", with First clear +20 and Back to map / Retry (`win-375.png`).
- **Loss:** 329 Starry Sea (Hard) took 15 lossPlan taps and gave "A little stuck" with the Hard chip and "Line jammed: [5 colour chips] can't reach a block. Have another look." Continue (250) was offered, plus Retry / Back to map (`fail-375.png`). Retry restarted 329 (playing, 5 cards). The map button returned to the map (screen "map").
- **Desktop 1280:** the realm card reads "WORLD 7 OF 7 · Under the Sea" with the lore and "9/50 cleared". Next up is Picture 289. The map is centred with no overflow (`map-1280.png`).
- **Titles at 375:** none of the 50 overflows. The smallest auto-fit is 17.1 px (327 Lantern fish parade).
- **Credits:** the Zen map foot ends "... The Floating World: ...; most adapted for the game by Click it! Studios. **Under the Sea: original pictures generated with FLUX.1 [schnell] (Apache 2.0) by Click it! Studios.**" That matches the brief's line, and it's labelled and separate.
- **LICENSES.md World 7:** the heading reads "Zen World 7: Under the Sea (Land 6, levels 430-479 ...)", followed by the credit line and **50 rows**, "| 280 | 430 | Octopus drummer (us201) |" .. "| 329 | 479 | Starry Sea (us254) |". Each is an original FLUX.1 work with its seed. The edit note is on exactly 8 rows, and the 4 parody rows name their originals (m2).
- **Content safety:** at play size nothing would bounce a kid or a portal reviewer. 308 Vampire squid is a red cartoon squid with a cape, 310 Black smoker is a chimney with a yellow sub, and 313 Ghost ship is a green ship under a moon. None is dark, gory or ghostly in a scary way.
- **Difficulty spread:** E18 / N26 / H6, ending on a Hard (329 Starry Sea, which reads). Rates and pace are trusted from land.js check. Of the 6 Hards, 5 read (291, 301, 308, 322, 329) and 1 is weak (315). 289 The Great Wave is visually the simplest board, which matches the builder's too-easy watch. It's in band, so I don't flag it.

## Ship verdict
**Ship after fixes.**

Blocking:
- B1: swap or repaint the 3 mud boards (us236 at 288/438, us308 at 318/468, us309 at 319/469), re-bake those slots, and show Peter a play-size contact sheet.

Non-blocking:
- M2: moatSkip us264, us222 and us256, then re-bake 470, 446 and 465 (do it alongside B1's re-bake).
- M1: the weak boards for the art lane, starting with us256 (Hard), us282 and us205; then us208, us213, us296, us275, us276 and us235.
- m1: rewrite the 8 "Painted for readability by lane C" notes in Click it! Studios' voice (a manifest edit plus `land.js zen`).
- m2: retitle "The Great Wave 2" (and consider 289's title).
- m3: when swapping, prefer subjects that aren't octopus, crab, yellow sub or wave.
- m4 and m5: Peter's call, or known.

---

# Round 2 re-check (fix pass), 2026-10-12

Build: head b45b9a1 (not pushed), served on 127.0.0.1:8527 (Playwright, chromium). Shots in `tools/critic-land-08/r2/` (untracked):
- `boards/bNN.png`: each board in play at 375x812, at CSS size
- `sheet-r2.png`: the 3 new boards, the 3 de-ringed boards and the 9 ringed boards, with Zen numbers only
- `pairs-r2.png`: the new boards next to their sources
- `win-288-375.png`
- `notes.txt`

## selfTest
375x812@3 **888 / 0**; 1280x720 **890 / 0**; 0 console messages. My run (17 boards, the win on 288): **0 console messages, 0 page errors.**

## Counts
BLOCKER 0 · MAJOR 0 · MINOR 3

## 1. The 3 swaps (judged blind at CSS size, then against the source)

| Zen | Level | Id | Title | Tag | Rating | Reason |
|---|---|---|---|---|---|---|
| 288 | 438 | us266 | Glowing jellyfish | E | **reads** | A big pink jellyfish with trailing tentacles on black, with a small blue fish. One of the clearest boards in the world |
| 318 | 468 | us255 | The Thinker | E | **weak** (not mud) | A green hunched figure on a grey rock on sand. The shell merges into the body, so it reads as "a green thing sitting on a rock". The turtle and the Thinker pose need the title, and the source's crab is gone |
| 319 | 469 | us246 | Seahorse carriage | N | **reads** (borderline) | A tall orange seahorse with its snout reads. The carriage beside it is a mustard and pink blob |

B1 is closed: there are 0 mud boards. The world now stands at **39 read, 11 weak, 0 mud**. The 9 kept weak boards weren't re-judged, as briefed.

## 2. Rings (9 remain: 280 290 295 299 303 308 317 321 322)

None reads as a stray line across the picture. 290, 295, 299, 303, 308, 321 and 322 trace the hero's outline.
- **280 (the opener):** the blue line still loops past the octopus into the coral on the right. It reads as a wavy outline round the drum-kit area, not a line through the sky. Acceptable.
- **317:** it hugs the puffer, with a small loop into the coral at the right. Acceptable.

296, 315 and 320 now carry no ring and are clean. 320 Lighthouse reads much better without the zig-zag.

## 3. Titles in play (375)
- 289 shows "**Surf's Up**" and 302 shows "**Wave Rider**", both at 20 px with no overflow.
- The new titles fit: Glowing jellyfish 20 px, The Thinker 20 px, Seahorse carriage 18 px.

## 4. LICENSES.md
- **"lane C" appears 0 times** in the file.
- The World 7 section has 50 rows.
- 318's row reads "The Thinker (us255) ... a parody after The Thinker, Auguste Rodin's sculpture, 1880-1904, public domain (a new composition, not a copy of any reproduction)". Rodin is named.
- 289 and 302 carry the new titles, and both still credit The Great Wave off Kanagawa (Hokusai, c. 1831) as the parody source. That's fine.

## 5. Win
288 Glowing jellyfish took 50 real taps on its winOrder and gave "Picture done" and "**Glowing jellyfish, all dug out.**" (`win-288-375.png`). 0 console messages.

## MINORS
- **R2-m1.** 318 The Thinker is weak: a green blob on a rock. It's a new weak board, but it's an Easy and not mud, so it doesn't block. The art lane could brighten the shell (a darker green dome with a lighter body) if it ever revisits.
- **R2-m2.** The edit notes no longer say "lane C", but the wording is still process-speak with a double colon, e.g. "Adapted for the board by Click it! Studios: the deep black ocean covered over 75% of the board: a coloured sea floor painted along the bottom" (5 rows) and "...: 8-10 colours: flattened into fewer, bolder shapes" (3 rows). Polish suggestions: "a coloured sea floor added along the bottom" and "simplified to fewer, bolder colours".
- **R2-m3. Carried over:** the 9 weak boards (lane C is keeping them), the repeated subjects (round 1 m3), the map tint (Peter's call), and the Side quest 12 card at 1280.

## Ship verdict (round 2)
**Ship.** Nothing blocks. B1 (mud) and M2 (stray rings) are fixed, and the titles and licence rows are right. R2-m2 is an optional text polish before the push.
