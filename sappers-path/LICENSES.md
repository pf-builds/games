# Sapper's Path: asset licenses and credits

**Concept:** Peter Frutchey's outside-in routing idea (Demo Bench, 2026-08-31), rethemed as a castle siege on 2026-09-27.

| Asset | Source | License | Date |
|---|---|---|---|
| All art (materials, crews, goblin, keep, title, banner and map scenes, icons, UI) | Procedural pixel art drawn in code (`src/art.js`, `src/board.js`) | Original work, Peter Frutchey | 2026-09-27 |
| All sound (clinks, thunks, bleat, sizzle, rubble ticks, lever, chest, fanfare, UI) | Synthesized at runtime via WebAudio from recipes in `config.json` (`src/audio.js`) | Original work, Peter Frutchey | 2026-09-27 |
| Music, map and home loop (`audio/theme.m4a`): "JRPG Theme [Loop Ready]" by Juhani Junkala | https://opengameart.org/content/jrpg-trailer-theme (re-encoded to AAC, padded for gapless looping by `tools/music-encode.py`) | CC0 1.0 (public domain) | 2026-10-06 |
| Music, level and side quest loop (`audio/play.m4a`): "Calm2 - Childhood Friends" (JRPG Pack 4 Calm) by Juhani Junkala | https://opengameart.org/content/jrpg-pack-4-calm (re-encoded to AAC, padded for gapless looping, a 6 ms ramp smooths the loop seam) | CC0 1.0 (public domain) | 2026-10-06 |
| Music, Goblin King's Throne loop, levels 175-200 (`audio/boss.m4a`): "Evil4 - Witch's Lair" (JRPG Pack 3 Evil) by Juhani Junkala | https://opengameart.org/content/jrpg-pack-3-evil (re-encoded to AAC, padded for gapless looping) | CC0 1.0 (public domain) | 2026-10-06 |
| Win jingle (`audio/jingle-pizzi10.m4a`, plays; spares `audio/jingle-pizzi15.m4a`, `audio/jingle-steel10.m4a`): Music Jingles by Kenney (kenney.nl), `jingles_PIZZI10.ogg`, `jingles_PIZZI15.ogg`, `jingles_STEEL10.ogg` | https://kenney.nl/assets/music-jingles (License.txt in the pack; re-encoded to AAC) | CC0 1.0 (public domain) | 2026-10-06 |
| Arcade thumbnail (`thumb.jpg`) | Painted card art generated locally on the studio Mac with Stable Diffusion XL base 1.0, text-to-image (`/Users/peter/local-ai/sapper_card.py`, variant a, seed 23, 1152x640, cut to 800x450) | CreativeML OpenRAIL++-M (model); outputs may be used commercially. AI-generated images may not be copyrightable | generated 2026-10-06 |
| Levels | Generated and solver-verified by `tools/`, hand-ordered | Original work, Peter Frutchey | 2026-09-27 |
| Journey map art (`map/sheet-01.jpg` to `sheet-25.jpg`) | Generated locally on the studio Mac with Stable Diffusion XL base 1.0 (stabilityai/stable-diffusion-xl-base-1.0), img2img over layout guides drawn in code (`tools/map-gen/`; prompts, seeds and strengths in its README) | CreativeML OpenRAIL++-M (model); outputs may be used commercially. AI-generated images may not be copyrightable | generated 2026-10-04 |
| Display font: Jersey 10 (`fonts/Jersey10-Regular.ttf`, headings, buttons and numbers). Copyright 2023 The Soft Type Project Authors, designer Sarah Cadigan-Fried | https://raw.githubusercontent.com/google/fonts/main/ofl/jersey10/Jersey10-Regular.ttf (license: https://raw.githubusercontent.com/google/fonts/main/ofl/jersey10/OFL.txt, shipped as `fonts/OFL.txt`) | SIL Open Font License 1.1 | 2026-09-27 |
| Body font | System font stack, no files shipped | n/a | 2026-09-27 |

Third-party assets: the Jersey 10 font above, unmodified, with its license file beside it, (v4 M4) the Gallery's pictures below, and (v5.2) the music and jingle above, all CC0 (credit given anyway). Any asset added later needs a row here before it lands.

## The Gallery's pictures (v4 M4)

Sixty pictures, one per Gallery level (`levels/gallery.json`), converted to boards by `tools/convert.js`. Every line of `levels/gallery-manifest.json` holds the full record (source URL, author, license, date, and for ours the model, prompt and seed); the manifest also lists the 28 candidates that were not kept, with the reason. Critics 2 fix (2026-09-30): Trophy (`noto-1f3c6`, a stored spare) replaced Teapot and Fruit (`met-437999`) at 33; Teapot and Fruit is now a spare. `tools/gallery-src/` holds small downscaled copies of all 88 candidates (the converter's input; the game never fetches them), under the same licenses as below.

- **Twemoji** by Twitter, Inc and other contributors, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Source: https://github.com/jdecked/twemoji. The images are converted to pixel boards (resized, reduced to a few colours, outlined): changes made.
- **Noto Emoji** by Google, image resources licensed under the Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0). Source: https://github.com/googlefonts/noto-emoji (PNGs under `2D/png/128/`). Converted to pixel boards: changes made.
- **Paintings and prints**: The Metropolitan Museum of Art Open Access, public domain works released under CC0 (https://www.metmuseum.org/about-the-met/policies-and-documents/open-access).
- **Ours**: generated on the studio's own Mac with FLUX.1 [schnell] by Black Forest Labs (Apache 2.0; transformer loaded as city96's 4-bit GGUF quantization of the same weights). Original work, Click it! Studios. No real people, no trademarked characters.
- The Gallery screen credits these in plain text (`config.json` `gallery.credits`; no links, per portal rules).

| # | Picture | Source | Author | License | Date |
|---|---|---|---|---|---|
| 1 | `tw-1f355` Pizza Slice | Twemoji, emoji U+1F355 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f355.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 2 | `ours-g01` Goblin's Lunch | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 101; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 3 | `noto-1f431` Cat | Noto Emoji, emoji U+1F431 (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f431.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 4 | `tw-1f98a` Fox | Twemoji, emoji U+1F98A (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f98a.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 5 | `met-57007` Red Fuji | The Metropolitan Museum of Art Open Access, object 57007 (https://images.metmuseum.org/CRDImages/as/web-large/DP140971.jpg) | Katsushika Hokusai, ca. 1830–32 ("South Wind, Clear Sky (Gaifū kaisei), also known as Red Fuji, from the series Thirty-six Views of Mount Fuji (Fugaku sanjūrokkei)") | Public domain (CC0) | fetched 2026-09-30 |
| 6 | `ours-g02` Sir Whiskers | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 102; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 7 | `noto-1f352` Cherries | Noto Emoji, emoji U+1F352 (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f352.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 8 | `tw-1f43c` Panda | Twemoji, emoji U+1F43C (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f43c.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 9 | `ours-g09` Night Watch | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 109; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 10 | `noto-1f344` Mushroom | Noto Emoji, emoji U+1F344 (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f344.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 11 | `tw-1f349` Watermelon | Twemoji, emoji U+1F349 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f349.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 12 | `met-45434` The Great Wave | The Metropolitan Museum of Art Open Access, object 45434 (https://images.metmuseum.org/CRDImages/as/web-large/DP130155.jpg) | Katsushika Hokusai, ca. 1830–32 ("Under the Wave off Kanagawa (Kanagawa oki nami ura), also known as The Great Wave, from the series Thirty-six Views of Mount Fuji (Fugaku sanjūrokkei)") | Public domain (CC0) | fetched 2026-09-30 |
| 13 | `ours-g04` Frog Prince | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 104; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 14 | `noto-1f354` Burger | Noto Emoji, emoji U+1F354 (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f354.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 15 | `tw-1f427` Penguin | Twemoji, emoji U+1F427 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f427.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 16 | `ours-g12` Duck Knight | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 112; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 17 | `noto-1f436` Dog | Noto Emoji, emoji U+1F436 (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f436.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 18 | `tw-1f353` Strawberry | Twemoji, emoji U+1F353 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f353.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 19 | `met-436535` Wheat Field with Cypresses | The Metropolitan Museum of Art Open Access, object 436535 (https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg) | Vincent van Gogh, 1889 ("Wheat Field with Cypresses") | Public domain (CC0) | fetched 2026-09-30 |
| 20 | `ours-g10` Crown Too Big | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 110; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 21 | `noto-1f32e` Taco | Noto Emoji, emoji U+1F32E (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f32e.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 22 | `tw-1f419` Octopus | Twemoji, emoji U+1F419 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f419.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 23 | `ours-g07` Cake Castle | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 107; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 24 | `noto-1f981` Lion | Noto Emoji, emoji U+1F981 (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f981.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 25 | `tw-1f369` Doughnut | Twemoji, emoji U+1F369 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f369.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 26 | `met-436528` Irises | The Metropolitan Museum of Art Open Access, object 436528 (https://images.metmuseum.org/CRDImages/ep/web-large/DP346474.jpg) | Vincent van Gogh, 1890 ("Irises") | Public domain (CC0) | fetched 2026-09-30 |
| 27 | `ours-g13` Mimic | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 113; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 28 | `noto-1f41d` Honeybee | Noto Emoji, emoji U+1F41D (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f41d.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 29 | `tw-1f980` Crab | Twemoji, emoji U+1F980 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f980.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 30 | `ours-g11` Melon Catapult | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 111; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 31 | `noto-1f9c1` Cupcake | Noto Emoji, emoji U+1F9C1 (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f9c1.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 32 | `tw-1f984` Unicorn | Twemoji, emoji U+1F984 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f984.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 33 | `noto-1f3c6` Trophy | Noto Emoji, emoji U+1F3C6 (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f3c6.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 34 | `ours-g15` Happy Potion | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 115; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 35 | `noto-1f989` Owl | Noto Emoji, emoji U+1F989 (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f989.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 36 | `tw-1f951` Avocado | Twemoji, emoji U+1F951 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f951.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 37 | `ours-g08` Iron Pig | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 108; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 38 | `noto-1f437` Pig | Noto Emoji, emoji U+1F437 (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f437.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 39 | `tw-1f3f0` Castle | Twemoji, emoji U+1F3F0 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f3f0.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 40 | `met-436534` Roses | The Metropolitan Museum of Art Open Access, object 436534 (https://images.metmuseum.org/CRDImages/ep/web-large/DP346475.jpg) | Vincent van Gogh, 1890 ("Roses") | Public domain (CC0) | fetched 2026-09-30 |
| 41 | `ours-g16` Mushroom House | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 116; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 42 | `noto-1f432` Dragon | Noto Emoji, emoji U+1F432 (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f432.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 43 | `tw-1f438` Frog | Twemoji, emoji U+1F438 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f438.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 44 | `ours-g18` The Sapper | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 118; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 45 | `noto-1f36d` Lollipop | Noto Emoji, emoji U+1F36D (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f36d.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 46 | `tw-1f451` Crown | Twemoji, emoji U+1F451 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f451.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 47 | `met-436530` Oleanders | The Metropolitan Museum of Art Open Access, object 436530 (https://images.metmuseum.org/CRDImages/ep/web-large/DT1494.jpg) | Vincent van Gogh, 1888 ("Oleanders") | Public domain (CC0) | fetched 2026-09-30 |
| 48 | `ours-g19` Hatchling | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 119; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 49 | `noto-1f47d` Alien | Noto Emoji, emoji U+1F47D (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f47d.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 50 | `tw-1f680` Rocket | Twemoji, emoji U+1F680 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f680.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 51 | `ours-g22` Plumed Helm | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 122; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 52 | `noto-1f308` Rainbow | Noto Emoji, emoji U+1F308 (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f308.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 53 | `tw-1f383` Jack-o'-Lantern | Twemoji, emoji U+1F383 (https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f383.png) | Twitter, Inc and other contributors | CC BY 4.0 | fetched 2026-09-30 |
| 54 | `met-435882` Apples and Primroses | The Metropolitan Museum of Art Open Access, object 435882 (https://images.metmuseum.org/CRDImages/ep/web-large/DT47.jpg) | Paul Cézanne, ca. 1890 ("Still Life with Apples and a Pot of Primroses") | Public domain (CC0) | fetched 2026-09-30 |
| 55 | `ours-g23` Sheep Knight | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 123; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 56 | `noto-1f33b` Sunflower | Noto Emoji, emoji U+1F33B (https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128/emoji_u1f33b.png) | Google (Noto Emoji) | Apache 2.0 | fetched 2026-09-30 |
| 57 | `ours-g20` Sword in the Stone | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 120; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 58 | `ours-g21` Party Slime | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 121; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 59 | `ours-g06` Wise Old Owl | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 106; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
| 60 | `ours-g24` Goblin King's Hoard | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed 124; prompt in levels/gallery-manifest.json | Click it! Studios | Original work (model: Apache 2.0) | generated 2026-09-30 |
