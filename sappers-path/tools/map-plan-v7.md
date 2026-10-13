# Sapper's Path v7: map plan for the next eight Zen worlds (lane D prep, 2026-10-13)

Planned ahead so each install's map step is a paste when lane C hands a world off. Lever 1 throughout (tools/land-runbook.md
§7): no new image bytes, two castle sheets per world through `map.fromLayout`, laid A, B, A', B', A, B, ... (land.js `map`:
entry e uses template e % 2, mirrored when floor(e / 2) is odd), one `map.tint` on every entry. Nothing in the game, the land
data or zen.json changed; this file and the previews are the whole output.

Previews: `tools/map-plan-v7/<n>-<world>.jpg` (each sheet at 384 x 672, half size, A left and B right, the tint applied as a
CSS `filter` on the `<img>` exactly as main.js does, rendered in headless Chromium through Playwright). `all.jpg` is the 4 x 2
contact image of all eight (committed). The per-world previews are untracked.

## Sheets in use before this plan

| Zen world | Sheets | Tint |
|---|---|---|
| 1 Picture Garden | land-01 a/b (Kitten Forest's, layout 26/27) | warm sepia |
| 2 Kitten Forest, 3 Snack Galaxy, 4 Dino Valley | their own land sheets (land-01, land-02, land-05) | none |
| 5 Masterpiece Gallery | castle 2, 5 | `sepia(.35) saturate(1.3) hue-rotate(-14deg) brightness(1.06) contrast(1.04)` |
| 6 The Floating World | castle 7, 1 | `hue-rotate(30deg) saturate(.75) sepia(.18) brightness(1.08) contrast(1.1)` |
| 7 Under the Sea | castle 14, 15 | `sepia(.2) hue-rotate(150deg) saturate(1.5) brightness(.9) contrast(1.1)` |
| (earmarked) Monet / Water Lily | castle 4, 6 | leave alone |

Castle sheets free: 3, 8, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 21, 22, 23, 24 (25 is the Goblin King's fortress summit,
not usable). That is 16 sheets for 16 slots, but one of the three lava sheets (16-18) suits nothing but Clockwork, so the plan
reuses exactly one sheet: **13** (the Mistmoor pools) in Cloud Kingdom and again in Safari, five worlds apart and under
opposite tints (pale sky blue vs savanna gold), so it never reads as the same place. Sheet 16 is left spare.

## The plan

| # | World | Sheets (A, B) | Tint (`map.tint`) | Preview |
|---|---|---|---|---|
| 1 | Puppy Park | **3, 11** | `sepia(.15) saturate(1.7) hue-rotate(15deg) brightness(1.14) contrast(1.02)` | `1-puppy-park.jpg` |
| 2 | Harvest Festival | **12, 21** | `sepia(.95) saturate(2.8) hue-rotate(-22deg) brightness(1.1) contrast(1.08)` | `2-harvest-festival.jpg` |
| 3 | Cloud Kingdom | **13, 10** | `grayscale(.8) brightness(1.4) contrast(.8) sepia(.3) hue-rotate(160deg) saturate(2.4)` | `3-cloud-kingdom.jpg` |
| 4 | Clockwork Town | **17, 18** | `sepia(.85) saturate(1.3) hue-rotate(5deg) brightness(1.1) contrast(1.25)` | `4-clockwork-town.jpg` |
| 5 | National Park Posters | **9, 8** | `sepia(.55) saturate(2.1) hue-rotate(-16deg) contrast(1.35) brightness(1.02)` | `5-national-park-posters.jpg` |
| 6 | Holiday Lights | **19, 20** | `grayscale(1) brightness(1.75) contrast(1.05) sepia(.3) hue-rotate(165deg) saturate(2)` | `6-holiday-lights.jpg` |
| 7 | Farm Friends | **22, 24** | `sepia(.3) hue-rotate(48deg) saturate(1.7) brightness(1.15) contrast(1.04)` | `7-farm-friends.jpg` |
| 8 | Safari | **23, 13** | `sepia(.6) saturate(1.9) hue-rotate(2deg) brightness(1.15) contrast(1.05)` | `8-safari.jpg` |

land.json map block, e.g. Puppy Park (same shape as tools/lands/08-under-the-sea):

```json
"map": {"fromLayout": [3, 11], "files": ["sheet-03.webp", "sheet-11.webp"], "reuse": true,
        "tint": "sepia(.15) saturate(1.7) hue-rotate(15deg) brightness(1.14) contrast(1.02)", "note": "..."}
```

### 1. Puppy Park: 3, 11

- Why: the two most park-like sheets left. 3 is a meadow with big trees, a river and cottages; 11 is round shade trees and a
  river. The tint is a sunny spring lift (yellow-green, brighter), clearly apart from the Campaign's muted olive and every
  Zen world so far. Sheet 11's little castle mid-sheet reads as a park folly.
- Water: rivers stay blue-teal. Road stays beige. Bridges: config already has 3 and 11 (one each), both over painted water.
- 50 levels: 7 sheets, 8+8+8+8+8+8+2 (A x4, B x3). 40: 5 sheets. 30: 4 sheets.
- eggTurns (quest-spur tips; 3 at (550,605) (385,306), 11 at (119,799) (225,575)):
  `[[[["butterfly",550,605],["grass",385,306]],[["fish",550,605],["reeds",385,306]],[["butterfly",550,605],["grass",385,306]],[["fish",550,605],["reeds",385,306]]],[[["grass",119,799],["mushrooms",225,575]],[["butterfly",119,799],["owl",225,575]],[["grass",119,799],["mushrooms",225,575]]]]`

### 2. Harvest Festival: 12, 21

- Why: 12 has castle towers among trees (the spooky manor for the Halloween half) and fields; 21 is a dense forest whose
  glowing spots turn into warm lantern lights under a heavy sepia. One pumpkin-orange tint carries both, warmer and redder than
  World 5's varnish. The heavy sepia (.95) is needed: at .45 sheet 21 stays green (tried).
- Water: sheet 12's river turns a dark amber-brown band (a muddy autumn stream, not an odd colour). Its plank bridge (config
  `[12, 119]`) still sits over it.
- 50 levels: 6 sheets, 9+9+9+9+9+5 (A x3, B x3). 40: 5. 30: 4.
- eggTurns (12 at (668,930) (488,384); 21 at (456,725) (430,610)):
  `[[[["mushrooms",668,930],["woodpile",488,384]],[["raven",668,930],["mushrooms",488,384]],[["woodpile",668,930],["raven",488,384]]],[[["owl",456,725],["wisp",430,610]],[["glowcap",456,725],["raven",430,610]],[["owl",456,725],["wisp",430,610]]]]`
  (woodpile = a bonfire, wisp = a ghost light).

### 3. Cloud Kingdom: 13, 10

- Why: under a pale sky tint the Mistmoor's land turns to cloud and its pools to sky gaps (13), and Twinspire's castle (10)
  becomes the castle in the clouds. A rises through cloud, B reaches the castle. hue-rotate 160 reads sky blue; 170 leaned
  lavender (too near World 7's violet), so 160.
- Water: 10's river and 13's pools go pale periwinkle-blue, which reads as more sky. 10's plank bridge (config `[10, 42]`)
  crosses that pale stream; fine as a sky bridge.
- 50 levels: 7 sheets, 8x6 + 2 (A x4, B x3).
- eggTurns (13 has three spurs: use (637,1101) and (352,293), the far-apart pair; 10 at (659,1112) (583,567)):
  `[[[["bubble",637,1101],["wisp",352,293]],[["glint",637,1101],["bubble",352,293]],[["wisp",637,1101],["glint",352,293]],[["bubble",637,1101],["wisp",352,293]]],[[["raven",659,1112],["butterfly",583,567]],[["glint",659,1112],["raven",583,567]],[["butterfly",659,1112],["glint",583,567]]]]`

### 4. Clockwork Town: 17, 18

- Why: the Emberwatch lava sheets under brass: the black crags go to dark iron, the lava channels to molten brass, the cracked
  ground to bronze plate. Reads as a foundry quarter. Kept darker and less saturated than Harvest's orange. 16/18 or 16/17
  work the same; 17/18 because both already carry config stone bridges (`[17, 46/97, "stone"]`, `[18, 59, "stone"]`), which
  read as iron bridges over the brass.
- Water: none. Lava channels go pale gold, not orange.
- 50 levels: 6 sheets, 8+9+8+9+8+8 (A x3, B x3).
- eggTurns (17 at (510,520) (473,338); 18 at (636,633) (500,320)):
  `[[[["glint",510,520],["ember",473,338]],[["bubble",510,520],["glint",473,338]],[["ember",510,520],["bubble",473,338]]],[[["ember",636,633],["bubble",500,320]],[["glint",636,633],["raven",500,320]],[["ember",636,633],["bubble",500,320]]]]`
  (glint = a cog-gem, bubble = steam, ember = a furnace spark).

### 5. National Park Posters: 9, 8

- Why: the Ironhollows' cliffs, pines and peaks are the most "national park" terrain left. A high-contrast warm ochre with
  the pines kept dark gives the flat, sunlit look of a 1930s WPA poster. A = 9 (cliffs and a meadow), B = 8 (the peaks), so
  the road climbs. Tried 8/16 (a volcano park): it read fine alone but too close to Clockwork's lava sheets one world earlier.
- Water: 8's waterfall down the right edge goes pale cream (no blue left), not an odd hue.
- 50 levels: 7 sheets, 8x6 + 2 (A x4, B x3).
- eggTurns (9 at (286,790) (496,552); 8 at (385,1020) (386,337)):
  `[[[["woodpile",286,790],["raven",496,552]],[["grass",286,790],["woodpile",496,552]],[["raven",286,790],["grass",496,552]],[["woodpile",286,790],["raven",496,552]]],[[["owl",385,1020],["mushrooms",386,337]],[["raven",385,1020],["woodpile",386,337]],[["owl",385,1020],["mushrooms",386,337]]]]`
  (woodpile = a campfire).

### 6. Holiday Lights: 19, 20

- Why: the Shrouded Weald's forest under full grayscale, lifted and cooled, becomes a snowy wood with blue-grey shadows; its
  glowing spots become bright snowdrifts and lamp glows. White with cool shadows, clearly apart from Cloud Kingdom's sky blue.
  brightness 1.75 / contrast 1.05: at 1.85 the painted road clipped to flat white and lost its edge.
- Water: none (19's pale streams read as snow).
- Limit: one filter can't add warm coloured lights (red and green on white). If Peter wants those, it's an overlay or new art,
  not a tint.
- 50 levels: 7 sheets, 8x6 + 2 (A x4, B x3).
- eggTurns (19 at (328,694) (98,536); 20 at (541,949) (639,455)):
  `[[[["owl",328,694],["glint",98,536]],[["wisp",328,694],["owl",98,536]],[["glint",328,694],["wisp",98,536]],[["owl",328,694],["glint",98,536]]],[[["woodpile",541,949],["ember",639,455]],[["glint",541,949],["owl",639,455]],[["woodpile",541,949],["ember",639,455]]]]`
  (glint = an ornament, wisp = a light, woodpile = a yule fire).

### 7. Farm Friends: 22, 24

- Why: the Goblin King's Throne sheets have thatched huts, sheds and fenced yards on bare ground; a grass-green tint turns the
  ground to pasture and the huts to farmsteads. Darker grass green than Puppy Park's yellow spring (and six worlds apart).
- Water: a blue-green strip at 22's bottom edge, fine.
- Odd: the road and the ground share a hue on these sheets, so the green shift also turns the painted road pale mint. A lower
  hue-rotate (30-38) keeps a cream road but the whole sheet goes sickly yellow-olive (tried), so 48 it is. The route overlay
  draws over it anyway. Check it at 375 px on install.
- 50 levels: 7 sheets, 8+7+8+7+8+7+5 (24 holds 7 spots) (A x4, B x3). 40: 6 sheets. 30: 4.
- eggTurns (22 at (561,791) (623,533); 24 at (380,1070) (150,485)):
  `[[[["kitten",561,791],["grass",623,533]],[["butterfly",561,791],["kitten",623,533]],[["grass",561,791],["butterfly",623,533]],[["kitten",561,791],["grass",623,533]]],[[["woodpile",380,1070],["mushrooms",150,485]],[["raven",380,1070],["kitten",150,485]],[["woodpile",380,1070],["mushrooms",150,485]]]]`
  (kitten = the barn cat).

### 8. Safari: 23, 13

- Why: 23 is dry open ground with scrub, rocks and a hut cluster, the savanna; 13 (reused from Cloud Kingdom) brings the
  watering holes. Golden tan, yellower than Harvest and lighter than National Park.
- Water: 13's pools go olive-khaki (muddy dry-season waterholes), not blue. Not an odd colour, but not clear water either.
- 50 levels: 7 sheets, 8x6 + 2 (A x4, B x3).
- eggTurns (23 at (587,808) (300,430); 13 at (637,1101) (352,293)):
  `[[[["grass",587,808],["raven",300,430]],[["glint",587,808],["grass",300,430]],[["raven",587,808],["glint",300,430]],[["grass",587,808],["raven",300,430]]],[[["reeds",637,1101],["fish",352,293]],[["bubble",637,1101],["reeds",352,293]],[["fish",637,1101],["bubble",352,293]]]]`

## eggTurns notes

- Shape as Worlds 6 and 7: `eggTurns[template][repeat]` = that repeat's two eggs `[kind, x, y]` at the template's two
  quest-spur tips (the Campaign's own side-quest nodes on those sheets, from `map/layout.json`). The repeat counts above are
  for 50 levels. Trim each list to the repeats a shorter world actually lays (A gets ceil(sheets / 2), B floor).
- Every kind used is one journey.js draws (woodpile, grass, fish, reeds, mushrooms, raven, glint, wisp, bubble, ember,
  glowcap, owl, kitten, butterfly). No new egg art (no bone, pumpkin, gear, snowflake, lion: those would be LATER items).
- A world's top sheet holds 2 levels in most of these; its eggs sit in the fog, as in World 5. The selfTest allows that.

## Closest pairs (checked side by side with Worlds 1, 5, 6, 7 in one contact image)

- National Park (ochre) vs Safari (gold): the nearest pair in hue. Kept apart by contrast and dark pines in National Park, and
  by sheet content. They are three worlds apart in arrival order.
- Puppy Park vs Farm Friends: both green, yellow-spring vs deeper grass, six worlds apart.
- Cloud Kingdom vs World 7 Under the Sea: pale sky blue vs saturated blue-violet. Not close. Cloud vs Holiday: blue vs white.
- Harvest vs Clockwork: saturated pumpkin vs dark bronze, adjacent only via Cloud Kingdom between them.
- None of the eight turns water pink or violet. The water reads, sheet by sheet: blue (Puppy), amber (Harvest), pale sky
  (Cloud), none (Clockwork, Holiday), cream waterfall (National Park), blue-green (Farm), khaki (Safari).

## If the arrival order changes

The pairs are independent: each world's sheets and tint stand alone, except that 13 is shared by Cloud Kingdom and Safari.
If those two ever land next to each other, give Safari 22/23 instead (`sepia(.6) saturate(1.8) hue-rotate(8deg)
brightness(1.15) contrast(1.05)` read well in trials) and Farm Friends 24 plus sheet 3 (reused from Puppy Park, under
Farm's own tint). Sheet 16 remains the spare.
