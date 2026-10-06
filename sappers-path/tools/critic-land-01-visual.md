# Sapper's Path Land 1 "Kitten Forest" (201-250): visual critic

Branch `sappers-path`, head `3f4a675`, served on 8493. Read-only on game code. Shots in `tools/critic-land-01-visual/` (raw frames in `raw/`).
Date 2026-10-06.

## Result in one line

**NOT good enough to bank yet: 2 blocking, 5 should-fix, 6 nits.** A portal wouldn't reject the game on sight because of this land.
But 7 of the 15 mystery-block levels draw their hidden blocks in nearly the same colour as a real squad, and the finale stretch
has a near-repeat ginger kitten pair.

## selfTest (run first, trusted for what it covers)

`tools/selftest-lands.mjs --url http://127.0.0.1:8493/sappers-path/`:
- 375x812@3: 893 passed, 0 failed
- 1280x720: 895 passed, 0 failed
- 360x640@3 (`--small`): 893 passed, 0 failed

Play gear 42 px (36 px at 360x640). 0 console messages. My own Playwright runs logged 0 console messages too.

## Would a portal reject this on sight?

No. Land 1 starts at level 201, so a reviewer's first minutes never reach it. When they do, the boards are crisp bevelled studs in
the castle's frame, the pictures read as cute kittens, the map art matches the castle's ink-and-wash style, and there's no fake
lettering or IP. Things a reviewer *would* notice once there:
1. The Hard and Extreme levels open with dark slate blobs over a quarter of the picture. On navy or black pictures, those blobs
   can't be told apart from the picture's own dark squad (blocker 1). The finale, 250, opens as a muddy navy field.
2. Seven of the last nine levels are orange or ginger cats, and two of them are the same ginger-tabby portrait (blocker 2).
3. The long Wandering Gallery titles shrink to about 8 px and get cut off mid-word in the play bar.
4. The same toadstool with the same sleeping-kitten egg shows up four times as you scroll the map.

## Shots

| File | What |
|---|---|
| `contact-201-225.png`, `contact-226-250.png` | All 50 land boards at game render, start state (hidden blocks in place), 375x812@3, labelled with level, title and tag |
| `montage-play-1.png` | 201 start; 206 at 0, 10 and 26 taps (hidden blocks, then some revealed; links, colour lock); 210, 229, 239 and 247 mid-play |
| `montage-play-2-250-quests.png` | 220, 225 and 249 mid-play; 250 at 0, 12 and 30 taps; side quests 61 Poppy, 62 Suido, 64 Hakone and 67 Asakusa mid-play |
| `closeups-shading-mystery.png` | 3x pixels magnified x2: shading at 245, 230, 249, 216, 233 and 201; hidden blocks at 206 and 250, start and later |
| `play-*.png`, `quest-*-start/mid.png` | The single full-screen frames behind the montages |
| `map-201.png`, `map-225.png`, `map-250.png`, `map-join-200-201.png`, `montage-maps.png` | The map at 201, 225 and 250, and the 200 to 201 join (375x812@3) |
| `desk-map-201.png`, `desk-play-206-t10.png`, `desk-play-250-t12.png` | Desktop 1280x720 |
| `map-strip-25-32.png` (+ `raw/strip-full.png`, 1125x15672) | Sheets 25-32 scroll-stitched, with magenta ticks at each sheet top |
| `seams-all.png` | Every new seam: 25/26, 26/27, 27/28, 28/29, 29/30, 30/31, 31/32 |
| `eggs-before-after.png` | All 13 visible land eggs (sheets 26-32), before and after the tap |
| `sheet25-retouch-compare.png` | Sheet 25 rows 0-460, original (git `35dcf90~1`) next to the retouch, plus land A's bottom rows |
| `gear-360x640-*.png`, `gear-375x667-*.png`, `gear-320x568-*.png`, `gear-1280x720-*.png`, `montage-gear.png` | The gear in the play bar, and the tight chrome on small phones (levels 210 and 250) |
| `near-dup-candidates.png` | Clean flat renders of the closest-looking pictures (from the land's `renders/`) |

The map-201 frame shows 203 ticked. That's my test, not the game: an earlier run fast-forwarded wins in the same in-memory save.
My win-panel "reveal" capture didn't fire, so there's no finished-picture sheet. The start state is what the brief asked for.

## BLOCKING

### B1. Hidden (mystery) blocks match the picture's navy and black squads on 7 of 15 hidden levels, including the finale

The mystery fill is `#2b3566` (config `mystery.c`), with a cream "?" about 3-4 CSS px tall at 8 px cells. I measured ΔE00 from
that fill to the nearest squad colour or shade on every level with hidden blocks:

| Level | Picture | Nearest colour | ΔE00 |
|---|---|---|---|
| 209 | Glowing flower | navy `#293d63` | **4.1** |
| 250 | Xylophone (finale) | navy `#13315f` | **4.3** |
| 248 | Blueberry bucket | navy `#0d2f60` | **4.7** |
| 206 | Cucumber fright | navy `#12304b` | **8.2** |
| 229 | Red guitar | black `#252d42` | **8.7** |
| 220 | Firefly | navy `#00223c` | **10.5** |
| 240 | Conductor | black `#2a2f3b` | **12.6** |
| (castle 101-200, every hidden level) | | closest is night sky `#2a0e95` | 13.9 |

The game's own floor between two squads is 20 ΔE00. Nothing in the castle comes under 13.9. On these 7 levels you can tell a hidden
block from a navy or black cell only by the tiny "?" glyph.
- **Evidence:** `closeups-shading-mystery.png`, panels "206 hidden blocks start" and "250 hidden start": slate "?" cells sit
  directly against the navy kitten and the navy ground. `montage-play-1.png` 206 start: the kitten's body and the blobs merge into
  one dark mass. The navy squad tiles in the tray (28, 22, 29) are nearly the same tone as the board's blobs.
  `montage-play-2-250-quests.png` 250 start: the finale's navy ground and its hidden blobs are one field, and the xylophone
  doesn't read.
- **Repro:** `?debug=1`, `SP.unlockTo(200); SP.load(206)` (or 209, 248, 250) at 375x812, then look at the board.
- **Why it blocks:** the player can't see which cells are unknown and which belong to the navy squad, and the brief's test
  ("could be mistaken for another squad") fails. The builder flagged this risk in notes §9.9. Measured, it's worse than flagged.
- **Fix:** a bake gate of mystery fill to every squad and shade on a hidden level ≥ 20 ΔE00 (or at least the castle's 14). Then
  either move `hidden` off these 7 pictures (give it to lighter Hard and Extreme pictures), or give hidden blocks a second tint
  (for example a stone grey with an ink "?") on pictures that hold navy or black.

### B2. Near-duplicate under Peter's variety rule: 244 Big blue bow and 249 Green-eyed face

Both are a ginger-tabby kitten looking straight out, with big eyes, a white muzzle and a pink nose, centred on a flat bright
ground, five levels apart in the finale. 244 adds a body and a blue bow; 249 is the face close up. 236 Leaf on face is a third
ginger-tabby front-facing face (with a red leaf).
- **Evidence:** `near-dup-candidates.png` (244 next to 249) and `contact-226-250.png` (236, 244, 249).
- **Why it blocks:** the land-factory rule says "no repeated images or near-repeats", and the visual critic fails the land
  if near-duplicates exist. The README's variety check compared prompt ideas, not coat and pose, so it didn't catch this.
- **Fix (cheap):** swap 249 (or 244) for a non-ginger spare with enough colours for a late slot, then re-bake that one level.
  - kf82 Watermelon: 9 colours, tabby; the closest stand-in for 249's 10 colours.
  - kf13 Daisy crown: 7 colours, cream kitten on dark green.
  - kf77 Robin friend: 7 colours, grey kitten and a red robin.

## SHOULD-FIX

### S1. The climax stretch is samey: 7 of 9 levels in 241-249 are orange or ginger cats

The run goes 241 Soccer kick (ginger), 242 Ocelot (yellow-orange), 243 Rainbow slide (ginger), 244 Big blue bow (ginger), 245 Lynx
(orange face), 246 Fish dream (grey), 247 Serval (yellow-orange face), 248 Blueberry bucket (grey), 249 Green-eyed face (ginger).
Inside that run:
- Three spotted or tufted wild-cat portraits come in six levels (242, 245, 247).
- 241 and 243 are both a ginger kitten mid-leap on a pale sky, two levels apart.
- 245 Lynx and 249 are both a full-board orange cat face.

Across the land, about 19 of 50 boards have an orange or ginger subject. The rule is "colour themes vary throughout".
- **Evidence:** `contact-226-250.png` (bottom two rows) and `near-dup-candidates.png`.
- **Fix:** move 2-3 grey, white or black pictures into 241-249 (for example 233 Skateboard or 228 Strawberry hug, which trade
  places on the picture side), or use spares kf43 Goalie, kf19 Tiny box or kf69 Snail ride. Re-bake the moved slots.

### S2. Two boards don't read as their kitten at phone size at the start

- **227 Stuck up a tree:** the tuxedo kitten is about 4 cells wide on a brown trunk, and hidden blobs cover half of it. At the
  start it reads as a tree and an orange sky. Seen in `contact-226-250.png`.
- **237 Leaf surfing:** the kitten is a few cells at the top of a big blue crescent wave. The wave reads, the kitten barely does.

**Fix:** swap 227 for a spare (it's a Hard level with hidden blocks, so it's the worst place for a tiny subject), or at least take
`hidden` off it. 237 can stay if 227 goes.

### S3. On the light pictures, hidden blobs cover the subject's face or eyes, so the joke or the subject is lost at the start

- 217 Paper bag: the face is under blobs.
- 230 Bread face: the bread is lost.
- 247 Serval: the face is covered.
- 249 Green-eyed face: the green eyes, which are the point of the picture, are covered.
- 210 Violin: the cream kitten reads as a dalmatian.

Evidence: `contact-201-225.png` and `contact-226-250.png`, plus `montage-play-1.png` 247 at 14 taps. The castle's hidden blocks sat
on stone and walls, where they looked like masonry. On cute faces they look like spots.

**Fix:** keep `hidePic` blobs off the subject's top features (eyes and face; the subject crop already finds the subject), or cap
the share on face close-ups at about 15%.

### S4. Eggs repeat identically on every repeat of a sheet

The same eggs come back in the same spots:
- Sleeping kitten on the toadstool: sheets 26, 28, 30 and 32 (4 times).
- Yarn: 26, 28 and 30.
- Fish: 27, 29 and 31.
- Butterfly: 27, 29 and 31.

After the first find, the "secret" is a repeat 2 sheets later. Evidence: `eggs-before-after.png` and `map-strip-25-32.png`.

**Fix:** rotate the kinds per repeat (for example A: kitten and yarn, A': yarn and butterfly), or show only one egg per kind per
land.

### S5. Long Wandering Gallery titles shrink to about 8 px and get cut off mid-word in the play bar at 375

Examples: "Suido Bridge and Surugadai (th" and "Asakusa Ricefields and Torinom". Also at risk: "Little Girl in a Blue Armchair",
"Two Sisters (On the Terrace)" and "Carp Swimming by Water Weeds". Evidence: `montage-play-2-250-quests.png`, panels Q62 and Q67.

**Fix:** a short play-bar title per quest (for example "Suido Bridge" or "The Cat at Asakusa"). Keep the full title on the
picture card and in the credits.

## NITS

- **N1. Sheet 25 retouch:** the new road is a smooth, soft-edged cream band, without the dark ink edge and uneven width of the
  painted road below it. The old mist band is now blotchy, airbrushed haze. At phone size, under the "Land 1 Kitten Forest" banner,
  it passes. On a desktop crop it looks retouched. Evidence: `sheet25-retouch-compare.png`, `map-join-200-201.png`.
- **N2. Map repetition shows:**
  - Sheets 26 and 30 are identical, and so are 28 and 32 (both mirrored).
  - The B sheet (27, 29 mirrored, 31) puts the same river, plank bridge and cottage cluster every other sheet.
  - This is by design (2 sheets per land), and the mirroring breaks it up. Still, in `map-strip-25-32.png` the river and bridge at
    212, 228 and 244 are plainly the same picture.
- **N3. Egg drawings:**
  - The "butterfly at rest" (folded wings on a flower) reads as a yellow leaf or a flame; open, it reads fine.
  - "Yarn unrolled" reads as a pink worm.
  - The kitten and fish eggs are good. Evidence: `eggs-before-after.png`.
- **N4. Weak reads (still kittens):**
  - 212 Upside down: a thin grey hanging shape.
  - 226 Tiger cub: the stripes broke into spots, so it reads as a fox or leopard cub.
  - 246 Fish dream: the sleeping kitten is a grey lump.
  - 223 Scruff carry: the carried kitten is a white blob.
  - 224 Signpost nap: the kitten is small over a big arrow.
- **N5. 320x568:** every board draws at 6.5-7 CSS px a cell (all 50 land boards, all 12 quests, and the castle too). This was
  already true before Land 1 and is outside the 360x640+ gate. Noted only.
- **N6. Doubled tray colours:** 249's tray holds two near-identical dark-green squads (37 and 38) next to the bright-green eye
  shade. They're one colour with two squads, which is legal, but with the green shading the eye region carries three greens.
  It's readable, so this is a nit.

## Checked and passing

- **Seams (7):** 25/26 through 31/32 are clean. The road is continuous at the centre on every join, the 80 px crossfade hides the
  sheet edges, and the mirrored sheets (28, 29, 32) join without a left/right mismatch. Evidence: `seams-all.png`,
  `map-strip-25-32.png`.
- **The 200 to 201 join:** the banner sits on the seam, the route climbs from 200 through the retouched haze into the forest, and
  there's no red dash over the fortress. Evidence: `map-join-200-201.png`.
- **Nodes and labels:**
  - 81 markers (levels, quests and eggs, with their tag chips and prize cards) on sheets 25-32 at 375x812: 0 overlapping pairs
    (bounding-box test).
  - Every level node sits on the road, and the quests sit on painted clearings with dotted branches.
  - The "Level 250 EXTREME" pill and "The road goes on" in the fog are clear.
- **Fake lettering:** none on the two land sheets (no signs, banners or text-like marks).
- **Shading:** it reads as soft volume, not noise:
  - 201's ginger body, 239's blanket folds, 249's eye highlights, 245's muzzle.
  - On boards without hidden blocks, no shade looks like a separate squad at phone size. The only confusion is B1's
    mystery-versus-navy clash.
- **Linked squads and locks:** the rope link between tiles and the striped lock space read the same as in the castle (206, 210,
  229, 247).
- **Gear:**
  - It sits in the play bar's top-right after retry and speed: 36x36 at 360x640 (y 1), 42x42 at 1280x720.
  - It uses the same round stone style as the map, retry and speed buttons, a crisp dark cog, and nothing crowds it.
  - The title column holds "Violin" plus the EXTREME chip at 320, 360 and 375. Evidence: `montage-gear.png`.
- **Tight chrome:**
  - 375x667: 33 of 50 land boards take `body.tight`, and every land board and quest is ≥ 8 CSS px a cell.
  - 360x640: every board is ≥ 8 px, and nothing scrolls the page.
  - 375x812: smallest is 8.0 (204). Evidence: `gear-375x667-*.png`.
- **The Wandering Gallery** boards (Poppy Field, Suido Bridge, Hakone, Asakusa) read as their paintings at phone size, and the
  Hiroshige cat sits well in a kitten land.
- **Trade dress:**
  - Nothing reads as famous IP.
  - Checked: the white kitten with a heart balloon, 207 (no bow, so not Hello Kitty).
  - Checked: the grey kitten in a black top hat, 202 (no striped hat, so not the Cat in the Hat).
  - Checked: the tuxedo kittens at 227, 239 and 250 (no Sylvester face or red nose).
  - Checked: the running lion cub, 231 (sky ground, no rock or sunset).
  - Checked: the ginger yawn, 215 (white chest, slim, so not Garfield).
- **Map eggs:** drawn in the map's ink style in the same 48 px box, with good before/after states (bar N3).

## Near-duplicate pairs

- **Blocking:** 244 Big blue bow / 249 Green-eyed face.
- **Watch list, near-repeats that make the climax samey (S1):**
  - 236 Leaf on face / 244 / 249: three ginger-tabby faces.
  - 242 Ocelot / 247 Serval: spotted wild kittens.
  - 245 Lynx / 249: orange full-board faces.
  - 241 Soccer kick / 243 Rainbow slide: a ginger kitten mid-leap on a pale ground.
- **Not near-duplicates (checked):**
  - 201 teacup / 217 paper bag / 248 bucket: different containers, colours and poses.
  - 213 mirror lion / 231 lion cub: a joke versus a species.
  - 221 bath time / 238 heart curl: two different mother-and-kitten poses.

## Method notes

- Shots came from a Playwright run at 375x812@3 (touch), 360x640@3, 375x667@2, 320x568@2 and 1280x720. Script and composites are
  in the session scratchpad. Not committed.
- Mid-play frames are n taps of the stored winning order with 2.6 s of play after each (the builder's shots helper).
- The ΔE00 table uses each level's `pal` base colours plus shades from `levels/levels.json`.
- Cell sizes come from `SP.state().cs / devicePixelRatio` (the harness's measure).
- The overlap test uses bounding boxes of every `.mn`, `.qn` and `.egg` and their descendants on sheets ≥ 25, at 375x812.
- The server on 8493 was killed after the run.
