# Sapper's Path: LATER

Ideas and parked items. Nothing here is in v1.

- More levels: bake-and-pick from the kept pools (`levels/pool-w*.json`), toward Food Hunt's 200+.
- A daily puzzle mode (Into the Fold covers dailies for now).
- Endless generated levels.
- Goblin repairers that rebuild a tile each turn.
- A level editor.
- Hints, including a "no way through from here" notice when the solver says the position is lost. (M1: `Game.solveFrom` already answers it in well under a millisecond on these boards.)
- CrazyGames SDK (reuse Peasant Swarm's portal kit once it's on GitHub).
- More materials.
- (M0) A second difficulty proxy for Worlds 3–4, where random win sits on the floor: the share of first moves that keep a win alive, or the lost-state ratio along the optimal line.
- (M0) Detour chests: about 25% of chests placed off the optimal line, so "detour or straight in" is a real choice.
- (M0) World 4 generator polish: door 1 on the keep ring, lever 1 in a courtyard divider, the cascade built on purpose (lever 2 as a tile of door 1).
- (M0) Deeper boards: thicker wall bands in Worlds 3–4 with a bigger blobSize (min 4–6 with fewer sections).
- (M0b) Deliberate lever cascades in World 4 (cut from M0b): make the middle-curtain arc behind lever 1 an iron gate (door 2), with lever 2 a courtyard tile touching door 2 in another yard. Reaching that yard throws lever 2 → door 2 → lever 1 → door 1 in one derive.
- (M0b) Deeper World 1 within stone and timber: min 3 needs a structure that makes two-material scarcity bite (0-4% of castle boards today). One idea is a 2-thick outer curtain with one material per layer on 8×8 only. Another is a later World 1 level that deliberately teaches a single-crew muster ("three masons, find the stone route").
- (M0b) A stronger World 2 pool: 36 accepted from 1,600 boards. Try the 2-wide courtyard plan more often, or relax the greedy rule for its first two baked levels.
- (M1) A generator rule against permanently unreachable decoys (a section sealed by moat, seen on the old bake's w3-07). M2 renders such sections as scenery (SPEC §7); the final bake has none, but the generator should never make one.
- (M2) A richer goblin march: crews cheer at the keep, the goblin drops the crown, a short chase to the edge.
- (M2) Lever cascades animated in derive order (today every lever a break exposes clanks together, then every door it opens).
- (M2) Per-world banner scenery (hedge rows in World 2, ice floes in World 3) and an ambient music loop.

## From the M2 critics (parked by the M2 fix pass, 2026-09-27)

Every MAJOR from both reports, plus functional minors 2 (win wait) and 4 (landscape rail), was fixed in the fix pass (`tools/fix-notes.md`). The rest is parked here.

### Visual critic (`tools/critic-visual-m2.md`)
- MINOR-1: map level stars (`#c98d10` on `#ffe9a8`, 2.39:1) fail WCAG AA. Darker ink (`#7a4e00`, about 5:1) at 13 px, or a dark pill under the node.
- MINOR-2: moat and ground are 2 L* apart in grayscale. Darken the moat base to about Y 0.10 and brighten the wave crests.
- MINOR-3: the lever is easy to miss. Bigger lever with a red knob and a dark socket plate; the iron-door badge on it, or a chain line to its door.
- MINOR-4: a claimed chest still looks shut at a glance (it now loses its crew badge, which helps). Open lid with an empty interior, or fade it and add a check mark.
- MINOR-5: ground and rubble stamp the same pattern on every cell. 3-4 variants per type by a hash of (x, y), plus flips.
- MINOR-6: the banner is identical in Worlds 1-3. Per-world palette and prop (hedges in W2, snow and ice floes in W3), and shade the distant tower like the title castle.
- MINOR-7: mixed, non-integer pixel scale (board 1.9 CSS px per art px on 11×11 at 375, banner 3). Snap the cell to multiples of 16 device px where the fit allows; match the banner's artPx to the board.
- MINOR-8: the desktop side column is cramped and mostly empty sky, and the top bar spans 1280 px detached from the board group. Constrain the top bar to the group, widen the side column, or move the world tag and hint above the board.
- MINOR-9: the phone win/stuck sheet covers the board's bottom 36 px (one row at 375). Dock it below the board edge, or shrink the board a cell while a panel is up.
- MINOR-10: the HUD "3 / 5★" scans as "3 of 5 crews left". Try "Used 3 · ★★★ at 5", or a crew icon before the count.
- MINOR-11: a fresh map is 35 identical lock circles. Collapse locked worlds to one banner row and reveal nodes on unlock.
- MINOR-12: the chest's +1 fly shows the crew badge but no "+1". Draw "+1" in outlined type beside it.
- MINOR-13: teaching hints don't point at anything. A bouncing hand or arrow over the card, then the wall, on W1 level 1.
- MINOR-14: on a lever break the courtyard stays in shadow while the lever throws. Light the newly connected ground before the lever event.
- MAJOR-7 extras not taken: a true 2-frame hit-stop (the fix pass added a small board thump on the last pop instead), and a stone-only crack on the swing frames (every material now cracks just before its pop).
- MAJOR-8 extra not taken: the goblin or a crown icon on the win panel.
- Note: under `SP.hold(true)`, one `SP.tick(6000)` reveals at most one star (the reveal steps once per `step`). Only frozen-clock captures see it; tick in small steps.

### Functional critic (`tools/critic-functional-m2.md`)
- MINOR-1: a double-tap or thumb bounce commits a break (Undo refunds it). Ignore a commit on the same section within about 150-200 ms of its pick.
- MINOR-3: the 2× and mute toggles (y 84), the hint's Got it (y 144) and the map button (y 28) sit far from a one-handed thumb at 375×812. Move the toggles to the rail row or the panel.
- MINOR-5: pickaxe read as "T". Addressed by the fix pass redraw; re-check on Peter's phone.
- MINOR-6: play-screen buttons stay focusable and visible to assistive tech under the title and map overlays. Mark `#play` inert (or hidden) while another screen is up.
- MINOR-7: the save sanitizer drops some values instead of clamping (`stars: 1e999` dropped, not clamped to 3; a `best` below the level's min is kept). Nothing visible breaks.
- Feel: every break is two board taps (Food Hunt is one). The `twoTap` dial exists; Peter's phone playtest decides.
- Feel: w2-08 is confusing to read (the top inner timber against two hedges). Candidate for a pool swap if the playtest agrees.

### Found during the fix pass
- The board layer is baked in the committed state, so sections a break makes reachable get their bright outline and full badge as the show starts, a moment before the wall in front of them has crumbled. Holding the old reach set until the crumble ends would need a second layer.
- At 360 px wide two top-bar names were shortened to fit ("Goats & a Chest", "Throne Room"); a longer name added later will ellipsize there.
- Jersey 10 has no ★ glyph; stars in pixel-font text fall back to the system font. Fine today; a pixel star icon would match better.

## From the loop-2 re-check critic (2026-09-27)
- The pixel font draws 0 and O the same. No in-game text mixes them today; check before adding any.
- Chest badges are never dimmed, so an unreachable chest looks as live as a breakable wall. Dim them like wall badges.
- Phone landscape: the win panel covers 22–25 px of the board's right edge.
- The chest hint toast sits over the board's top row for 1.8 s. Move it off the board or shorten it.

## From M0 v2 (2026-09-27)
- Deeper boards (the 8-12 call end of SPEC-v2's 4-12 target): a concentric castle (two full curtains with a berm), a second cross wall, or taller boards. Scarcity alone tops out around 7-8 calls on these pictures.
- Detour chests under Rule A: place the chest in a pocket exactly one wall off the optimal line, checked by the solver (today 0-3% of chests classify as a detour).
- World 4 lever polish: a gate portcullis in iron with its lever in a guardhouse outside the curtain, and deliberate cascades (lever house → door → lever → keep ring).
- Stacks as an optional hard mode or a late-world twist (`node tools/bake.js --stacks`), if the playtest says Rule A levels are too easy. It raised decision-point boards from 41% to 63% in World 3.
- Towers that always contrast with their arc (`towers.contrast` 1.0) if the art can't make a merged tower read as a tower; costs some colour failures in World 1's two materials.
- A curved palisade (it's a straight fence today and reads as siege lines).

## From the v2 UI fix pass (2026-09-27)
- Landscape W4 is 11 px a cell (32 rows in 375 px). 12 px or more needs the W4 boards rotated in landscape, and that needs Rule A's tie-break order proven rotation-safe first.
- `blockPx` 6 on World 4, so the board's texture reads as chunkier pixels next to the UI (the textures are designed on 8 px blocks today).
- A small count chip on each idle crew at the camp.
- The victory lap: every remaining wall crumbles in a fast wave after the keep opens.
- The browser's first AudioContext is a ~100 ms long task on the page's first gesture (the title's Play). If it ever shows, give Play its pressed state before starting the audio.

## From v3 M0 (2026-09-28)

- A narrowness-driven tuner for the app's hardest levels: maximise forced turns (exactly one safe tap) along the winning line instead of only lowering random-tap and lookahead rates. `grade.narrow` exists; it costs about 20-40 ms per level.
- A hint power-up from `grade.solve(B, rules, nodes, null, state)`, which already solves from any mid-game state.
- An undo power-up. `sim.save()`/`load()` is one typed-array copy, so undo is a stack of snapshots.
- A per-era squad-size curve, so later levels stay long enough to be hard but not 80 taps.
- Richer fort plans: shaped buildings, gatehouses, Era 1 corner towers without archers, and no gaps in ditch corners.
- A distinct key colour or icon (Gilt reads close to Timber at 10 px).
- Delete the v2 page files (`src/main.js`, `game.js`, `solver.js`, v2 `harness.mjs`, `artmeta.js`, `artview.js`) once M1's page replaces them.

## From v3 M1 (2026-09-28)

- Landscape phones get the wide layout, and a 36×48 Era 3 board drops to about 5.5 px a cell there. Either rotate the board in landscape (the tie-break order would need checking) or ask for portrait on phones.
- Archer hits have no show yet: a toast says how many were driven back or cut down. Runners that walk to the range edge and fall back would read better (M2 juice).
- The haul crates scale down when a colour has more pixels than a crate holds; a count label per crate would make the haul exact.
- Sapper helmets and carried blocks of the same colour blend (white on Ashlar crews). An outline on the carried block would fix it.
- Idle sappers at the camp all stand still facing the same way; a few could wander.
- Delete `SPEC-v2.md`-era tool notes (`tools/m0*.md`, `m1-notes.md`, `m2-notes.md`, critic files) or move them under `tools/v2/`, now that the v2 page is gone (git keeps tag `sappers-path-v2-fixed`).

## From v3 M2 (2026-09-28)

- The canvas label (archer hits) uses Jersey 10. If the font hasn't loaded by the first hit, that label draws in the system font. Preload it into the canvas at boot (`document.fonts.load`) if it ever shows.
- ~~Short landscape hides the level name.~~ Done in the v3 fix pass (name in the side panel).
- The coach bubble covers the board's top row on the teaching levels (grass there today). If a teaching board ever puts blocks in row 0, dock the bubble above the frame instead.
- ~~The coach arrow sits on the "Holding line" label.~~ Done in the v3 fix pass (the label moved above the slots).
- ~~Narrow crates on the turned board.~~ Replaced by per-colour bins in the v3 fix pass.
- A "keep" material in the generator: the win's keep is drawn at the last pixel eaten, not at a real keep on the board.

## From the v3 fix pass (2026-09-28)

- Functional minor 3: doomed positions play on until you tap. With the line full the fatal marks now show every card red, but the game doesn't end. Widening no-move to "every front card fails on a scratch copy" would end it one tap sooner (the look-ahead code exists in `judge()`).
- Functional minor 4: Easy's sixth space collapses the late band (L64 84%, L69 98% random-tap on Easy). Grade or tune Easy separately if Peter wants Easy to bite.
- Visual minor 3: the 812×375 map loses the era titles and the difficulty switch, and Play covers rows at rest.
- Visual minor 4: the map has no progression art (locked tiles look alike, no path, no era band).
- Visual minor 5: in portrait the fail sheet covers the holding line that overflowed. Anchor the sheet over the board or keep the line above it.
- Visual minor 10: eaten lodges and buildings leave bare dirt rectangles; a trodden-rubble texture on eaten dirt would read as siege work.
- Visual minor 12: the 812 title's goblin and flag cover the logotype.
- Era 2 forts still show a third of the board as grass beside the round motte. A wider motte or outworks (a barbican, a second bailey) would fill it.
- Early 3-colour forts have a single building colour, so the sweep can't pack them wall to wall (same colour never touches). Their courtyards stay open.
- The lookahead floor (`tune.narrow.stopAt` 8%) now leaves the hardest slots at a 7% median; raise it a little if Peter's playtest finds them walls.
- Bins show one or two rows of mini blocks at 375; a count on the bin would make the haul exact.
- The critic's independent rules (`/private/tmp/claude-501/sp-critic/rules.mjs`) don't know `safeArchers`; give the next critic the one-line change so level 51 on Hard diffs clean.
- v3.1: level 27 (saw2) is the one level where the random rushing player beats patient play by more than 10 points (59% against 44% at 2,000 games). If playtests show rushing it is the easy way through, retune that slot's deal.
- v3.1: in the near-jam state, a front card whose tap would jam the line at once (all other squads stuck, its colour out of reach) could wear a red mark. Left out on purpose: it hands the player the lookahead and makes the puzzle easier than the grade assumes.
- v3.1: the rushed random player now wins about as often as the patient one, so the bands could be graded with a mixed player. Only worth doing if playtests show players mostly rush.
- v4 M1: the holding line's head is nearly full at 375 wide when the line is full ("Line full: wait for a squad to come home" beside "3 stuck · 2 working"); on a 360 px phone it would crowd. A shorter full text or a second line.
- v4 M1: `tools/palette.js` could also score the palette under simulated deuteranopia and protanopia (colour-blind mode's marks cover it today, but a palette that holds up without them is better).
- v4 M1: tower blocks' crenellated rims (dark edge, pale merlons) are now the busiest thing on a flat board. A simpler tower marker (a darker rim only) is worth a look with the visual critic.
- v4 M1: in the small iframe (36 px spaces) a working space's "out" marker touches its stepping figures. (Done in the Critics 1 fix: a space is a grid, the marker and the figures in separate rows.)

## From v4 M2 (the twists, 2026-09-30)

- The plan's other lock: "unlock after N blocks cleared" (a counter on the padlock instead of a key block). Not built; the engine's lock opens only on its key's pop today (`src/engine.js` eatCell), so it would be a second lock kind in the level format.
- Food Hunt's "?" pixels on the board (reference shot 7): board blocks whose colour is hidden until they are exposed. Cards first, per the plan.
- Food Hunt's dark "4" tile with a lid (shot 7): meaning unconfirmed. Could be a sealed card that opens after N taps.
- Grading mystery levels: the one-move lookahead can't feel a "?" (it only reads front cards), and the sampling planner prototype (`tools/m2-measure.js --pimc`) collapses to the random floor when every card behind the fronts is hidden. M3 decides the metric (proposal in `tools/v4-m2-notes.md`). A cheaper sampler (rollouts by the one-move player instead of the solver) is the likely route for a full bake.
- A near-jam hint for linked cards: with one space free the linked front cards wear the lock, but the head only warns "One space left" when the other squads are stuck. A line such as "Linked squads need 2: one space left" would teach it sooner.
- Rods between partners two rows apart and a column over cross the corner of a tile in between. Fine in the debug levels; M3's dealer could prefer partners at most one row apart (Food Hunt's pairs are one row apart). (Done in the Critics 1 fix without touching the dealer: those rods run down the column gutter.)
- A skip lands an unlock silently (no cue, no padlock pop), the same as a gate opened by a skip.
- The fast tapper wins level 61 about twice as often as patient play (11.2% against 5.9% at 2,000 games, Normal). Information for M3's rebake; nothing changed.

## From v4 M3 (the Siege to 100, 2026-09-30)

- Board size against the time targets. Patient time is set by walking (tileMs 80 and carryMs 90 are Peter's; bite, yard and stagger only trim a few per cent), about 0.25 s a block on Era 1's open stockades and 0.45-0.55 s on moated, archer-covered Era 3-4 castles. So the 4-minute max caps Era 3 at about 1.2× its v3 block count and Era 4 at about 380 blocks. Bigger Era 3-4 boards need either a longer max (about 5-6 minutes) or a faster walk; Peter's call.
- Hidden linked partners. M3 never puts a "?" on a linked card, so the one-move lookahead's grade never depends on a hidden colour and the mystery flags can go on after the pick. The "tap a pair whose partner is a ?" interaction (M2 measured it costs the lookahead player about 5 points) is left for a later mixed level or the Gallery.
- A counting player for the mystery grade: the sampling planner draws hidden colours card by card from the unseen counts (a player who reads the tray but doesn't count every block). A planner that only samples colourings consistent with the exact per-colour totals would be the strict upper bound; with 2-4 "?" cards the colours are often deducible that way.
- Level 76's coach arrow on the padlocked space covers the line head's "free" count at 375 wide. Point the arrow from the side, or drop the count while the arrow is there. (Done in the Critics 1 fix: the count steps aside.)
- An arrow on a "?" tile in the second row sits on the front card above it (level 35), as the level 1 arrow on a faded squad always has. A side arrow for rows behind the front would read better. (Done in the Critics 1 fix: every queue tile gets a side arrow.)
- Teaching levels 1-3 run 22-27 s patient, under the 60-90 s window for levels 1-15 (they are exempt, as tutorials). If Peter wants them in the window, grow their squads and forts again.
- The map's Era 4 history note wraps to four lines in the wide layout, one more than the others; a shorter note would square the row.
- The dealer's "no parking under archers" rule keeps every stored Hard line free of arrows, but it also keeps Era 3-4 squads small while towers stand (average 10-16 a card), which is where most of the late taps come from. A dealer that parks a squad only when none of its colour's blocks are covered would allow bigger squads.
- Era 4 forts under about 30 columns often fail (the inner ring gets too thin), which is why Era 4 reliefs are only scaled to 0.95.
- Era 3 castles now always have their moat (the bake asks every fort from Era 2 on for a gate; v3 moated half of them). Moatless keeps were quicker per block (about 0.44 s against 0.56 s patient); letting half of Era 3 go without would shorten the era or allow bigger keeps.

## From v4 Critics 1 (the fix pass, 2026-09-30; references are to `tools/critic-v4-1-visual.md`)

- m5, the win's payoff: plant a banner in the razed ground and burst each full bin; send the whole camp out in one column for the victory march. Juice for M5 (the meta milestone), not a fix.
- m8, colour-blind access: the toggle is on the title and the map only. M5's settings sheet and a pause menu should carry it, and it could be offered once after a jam where two stuck squads were a low-ΔE pair (Palisade/Hedge 1.3 under deuteranopia).
- M6, the critic's other ring options: long-press or hover a tower to show its ring loud; or draw only the ring the next front card's path enters. The fix makes a ring loud only while a colour the player can send has a block in reach inside it.
- M7, the critic's other bin options: one thin progress strip per colour along the yard edge, which could also free two or three board rows (bigger cells); or the bins out of the frame at 60%. The fix shows a bin only once its colour has hauled a block.
- M1/M2, a Food Hunt-strength fade: the rows behind fade only 10% and 20% toward the tray, because every faded tile has to stay ΔE00 20 or more from every front colour it is dealt with (`tools/fade.js`). A pastel fade like Food Hunt's (30% and 55%) would read deeper but puts 12 pairs under 20, the worst about 13 (Roof tile faded against Timber; `node tools/fade.js --t 0,0.3,0.55`). Depth now comes from the size step, the flat face and the softer rim.
- A texture on the stone tray (faint ashlar courses) if the flat tray reads too plain next to the board.
- Desktop: the side column has empty tray below the queue until M5's power-up bar (the reserved 84 px spot) and the level report arrive; taller queue tiles on desktop would use more of it.
- The coach in the top bar (only the 400×600 iframe's level 77, where a band above the board would take its board under 8 px a cell) covers the level's number and name while it shows.
- Easy on a phone (six spaces) uses the tight space layout (the count at 78%, the badges above it). If the counts feel small there, the line could drop to two rows of three.
- The critic's section 3 (what M5's home screen and power-up bar must match: a full-width bar of four round badges with "+" states, the space budget at 375×812 and in the 400×600 iframe, one dominant Play button on the title scene) is M5's brief.
- (Critics 1 re-check) Scale the desktop queue tiles up to use the side column (at 1280 the column is 520 px wide, so about 110 px tiles would fit); the fix 2 tray ends at the queue with brick below instead.
- (Critics 1 re-check) M5's power-up bar: at 1280 four ~96 px badges need `--pw-h` about 110 px (or a 2×2 layout); in the 400×600 iframe the queue ends at y 586 of 600, so the bar still has no room there and needs an explicit decision.
- (Critics 1 re-check) The landscape title's logo still grazes the keep's flag at 812×375 (cosmetic).
- (Critics 1 fix 2) On a coached linked card the side arrow and the rod's top rivet share the column gap for as long as the coach shows (level 62's first step).
- (Critics 1 re-check 2, N6, minor) Two links can share one column gutter and read as a single line touching three tiles (level 78, 17 of 543 queue states along its stored order; debug v4-linked at rest). Fix: a second lane 4 px over, or tint each pair differently. Shots in tools/shots-v4-critic1/recheck2/. (Done in the Critics 2 fix, m9: a lane each, the second rod in steel.)

## From v4 M4 (the Gallery, 2026-09-30)

- Peter's veto at the playtest: 28 spares are in `levels/gallery-manifest.json` (keep false, with why), their sources stored; a swap is a manifest edit and a 10-minute `node tools/gallery-bake.js`.
- More paintings: 8 of 18 Met works read at 40 cells. Flat-colour prints and posters with big shapes read best (the Great Wave, Red Fuji); dark or busy oils don't. NGA's open data needs its image table (tens of MB) to find IIIF ids, so it was skipped for the download budget.
- Paintings' faded queue tiles: 42 pairs under the siege's ΔE00 20 (smallest 12.0). The converter's faded rule exempts paintings to keep their tones; if the critic finds the queue muddy there, either apply it (some paintings lose a tone) or fade the rows less on Gallery levels. (Critics 2 fix: the converter lifts paintings' display lightness to a floor of 16, palette only; 27 pairs under 20 remain, smallest 16.0. Teapot and Fruit was replaced by Trophy.)
- The Gallery has none of the siege's twists. "?" cards, linked pairs or the lock on picture levels (the lock needs a gilt key, id 14, which a picture never uses: a key would be one more colour).
- Food Hunt's "?" pixels on the board (plan feature 1) would suit pictures: a patch hidden until exposed.
- A Gallery level report or stars per picture (M5's level report could cover the Gallery too). (Done: M5's report covers pictures, and the Critics 2 fix shows the finished picture on it.)
- The dimmed thumbnails show every picture's shape before it is won; a true silhouette (one dark tone for the subject, the background lighter) would keep more mystery for emoji and ours.
- Converter: more colour names (36 now) if aria-labels ever repeat a vague name; a per-picture `bg` or `crop` override already exists in the manifest for hand fixes.
- The Gallery's hard slots: the lookahead player still wins Plumed Helm (51) every time; more candidates or a smaller narrowing floor would bring it down.
- The Apache 2.0 text: LICENSES.md names the license with its URL; ship the full text beside it if a portal asks.

## From v4 M5 (the meta layer, 2026-09-30)

- A "continue" offer at a jam (Food Hunt's "out of space"): a jam is final today, so a Ladder or Recall only helps before the line comes to rest. Letting the jam sheet offer one would need the engine to undo the fail at that instant (a rule change, logged and tested like the rest).
- Lives (off on the web): only a fail costs a life, so quitting a level that looks lost costs nothing. If lives go on for the app, decide whether leaving a started level costs one (Food Hunt's way, with a confirm).
- The rest of m5's payoff: a banner planted in the razed ground, the bins bursting, the whole camp marching out in one column. The report (coins counting up, best results, the medal stamp) is the payoff M5 built.
- m8's other half: offering colour-blind marks once after a jam where two stuck squads were a low-ΔE pair.
- A first-use hint for the power-up bar (a coach line the first time a badge can help, e.g. "One space left: a Ladder adds one"). The badges explain themselves by toast today.
- Undo and hint power-ups (v3 M0's notes: `sim.save()`/`load()` and `grade.solve` from any state make both cheap).
- The Quartermaster reaches 2 cards back in the engine; in the two-row frames the page offers only the visible row behind the front.
- 360-wide phones: the widest painting (g-met-57007, 42 columns) is width-limited to 7.5-7.67 CSS px a cell at 360×640 and 360×740, as it was in M4 (the bar costs nothing there). A narrower crop or a turned board for that picture.
- 375×667 (iPhone SE): 57 of 160 boards drop to two queue rows to keep 8 px a cell (per level, at fit time), so the queue's depth changes between levels on that phone. If that reads badly, use two rows on every level below about 760 px tall.
- The win sheet on desktop covers the whole side column with the report near its middle; a shorter sheet anchored to the rail would leave the power-up bar in view. (Done in the Critics 2 fix, m8: the sheet is the rail's height, or its content's.)
- The economy's numbers (start 400; wins 5/10/20 plus first-clear 10/20/40; prices 120/80/60/100; uses per level 1/3/1/2) are a first proposal. Peter's playtest decides.
- Recall is refused on linked squads (simplest exact rule). Recalling a pair together (both cards back) would be the generous version.

## From v4 Critics 2 (the fix pass, 2026-09-30; references are to `tools/critic-v4-2-visual.md`)

- m10, wide paintings on portrait phones: Red Fuji (42×29) gets 8.0 px cells at 375×812 with dark brick above and below. The converter could prefer portrait crops (34 columns or fewer) for paintings, which would also help 360-wide phones (M5's open item). Needs a rebake of those pictures.
- m8, the rest of the siege win's moment: a banner planted in the razed ground and the bins bursting (LATER m5 above). The wide sheet is sized to the rail now.
- V2, the critic's option: a 1 s rebuild on a Gallery win (blocks fly back from the bins into the picture before the sheet slides up). The report shows the finished picture instead; on short landscape screens it hangs over the razed board. Showing it over the board on every screen would be a bigger payoff than the report's 4 px-a-cell copy.
- V2, the critic's other option: a lighter panel behind the Gallery's grid (like the stone tray), so the dim thumbnails sit on light instead of brick.
- On desktop a Gallery win's sheet (with its picture) is taller than the rail and covers the top of the power-up panel (its coin pill).
- At 375 wide an era report card's coin total wraps to a second line under the medals.
- Gallery paintings still have 27 faded pairs between 16 and 20 (Irises, Roses, Apples and Primroses, Wheat Field, Oleanders, Red Fuji); the floor is 16 to keep the paintings' tones. A floor of 20 would move more colours further.
- Teapot and Fruit (`met-437999`) is a spare now (muddy at 42 cells); with Trophy in its slot the Gallery has 7 paintings.
- The functional critic's edge case "Recall a wary squad, re-tap" numbers one archer-hit sapper differently from the game (a log label only; SPEC-v4 §9's Critics 2 entry says ids are labels). Their script could compare events without the sapper id.
- (Critics 2 re-check, n1, minor) Level 77's top-bar coach line at 375×667 wraps as "Linked squads: 2 / spaces." Readable; fix with balanced wrapping or a shorter small-screen line. Shots in tools/shots-v4-critic2/recheck/.
- (Critics 2 re-check) The debug level v4-linked still shows two brass rods in one gutter (campaign level 78 is fixed with brass and steel lanes).

## From v4.1 (castle pictures, bottom entry, 2026-10-01)

- Peter's call, the entry's width. The entry square is 3 cells (2 on an even width) in the middle of the frame's bottom row, as Peter described ("the square at the bottom"). Measured on Gallery boards, a whole-bottom-row entry walks about 20% less, which would buy back some board size within the same time targets.
- Board size against the time targets (as in M3): with bottom entry every block costs a longer walk, so the boards are smaller than v4's in cells (the block counts are about the same: v4's forts stood in grass). Bigger boards need a longer max (4 minutes) or a faster walk.
- Variety (done in the v4.1 fix pass, below): scenes, layouts, props, Era 4 families and the bake's variety gate.
- Era 4's inner moat fits only on the boss at these sizes; other concentric castles take a portcullis in the inner gatehouse as their second gate. A taller Era 4 (or a longer max) would bring the inner moat back.
- Era 2's second moat (round the motte) needs 24 picture rows; at the time-limited sizes no Era 2 level has it.
- The drawbridge is drawn in `picture.iron` (steel) with the gate's bars; a wooden drawbridge with iron bands would read better as a bridge.
- Archer towers stand against the frame or on a bank path so a hit-free deal exists on Hard; towers inside a wall (reached only through covered blocks) would need a dealer that allows one hit on Easy and Normal only.
- `tools/shots-v4-m4.mjs` and older shots scripts call `SP.sides()`, retired with the ring entry (`SP.entry()` replaces it); rerunning them needs that one change.
- Peter's old v3/v4 saves keep their wins by level id; the levels behind those ids are new pictures.

## From the v4.1 fix pass (2026-10-02; the critics' reports `tools/critic-v4.1-visual.md` and `-functional.md`)

- Autumn scene: searched and dropped. No olive-orange hill keeps ΔE00 25 (faded 20) against roof, thatch, earth and gilt at once; it would need roles dropped (no thatch or earth in autumn) or a recoloured roof.
- Levers not used: banner hues per level (the critic's 5) and weather overlays (6). Banners are one magenta; three or four pre-checked banner hues would add a little at low risk.
- Overcast (a grey sky, the critic's other scene) was not searched: grey against stone is the likely clash.
- The variety measure is by colour (a dawn sky is not a day sky). By role alone (the layout without its scene) the era medians are higher (see `tools/v4.1-notes.md` §12); more silhouettes (a cliff-top fortress, a river bend, a ruined wall) would bring those down too.
- Era 4's lake family is the rarest pick: its castles reach the late levels' 11-12 colours less often and its walks run longer (the castle stands higher). A shallower lake or a wider shore would even it out.
- Era 2 reads alike at a glance more than the others (the salmon motte and the red hall are its identity); a second motte colour (a grassy motte) would need a palette check against grass.
- The entry gate's path in the yard is a short stub under the gate; a path that winds between the crates would read better but crosses the crates' slots.
- (v4.1 critic re-check, V1 residual, minor) Era 2 is still one motte template moved and recoloured, and the cream-keep-between-blue-towers family dominates Eras 3-4. Next: a second Era 2 silhouette family and a silhouette-match median of 0.65 or less per era (now 0.64-0.74). See tools/critic-v4.1-visual.md re-check.

## From v4.2 (full-screen boards, longer levels, 2026-10-02)

- Speed: 2× and 3× go behind a rewarded ad or a paid unlock in the monetization pass (Peter, 10/2). Levels are designed around 1× (the real-pace targets are at 1×); at 3× Peter finishes a v4.1 level in 20-30 s.
- Squad sizes: cards run up to 99, but the 15 s dead-time cap keeps squads that must walk to the top of a full-screen board small, so the median card is about 20 (see `tools/v4.2-notes.md`). A wider entry or a cap that scales with the board would let them grow.
- Real-pace calibration rests on one report (Peter's 1-1.5 min at 1×, 20-30 s at 3× on v4.1). Two models fit it: a factor of 1.77 on the replay (used: v4.2 levels 26+ median 231 s) and a wait of about 2.9 s of game time per tap (median 157 s on the same levels). Timing a few of his v4.2 playthroughs would settle which, and so whether levels need more taps.
- 375×667 decides the board height: a board sized to fill 375×812 at exactly 8 px would draw 7 px there. If the older small phones matter less than filling the 812 screen, the boards can grow about 10% taller.
- From the v4.2 critics (2026-10-03):
  - Era 4's silhouette median is 0.76 on the critic's measure: towers flanking a cream keep dominate at thumbnail size. A second Era 4 silhouette family (a cliff-top fortress, a water castle seen from the shore) would break it.
  - Phones play upright only. A real landscape phone layout (board left, rail right, for any `w > h && h < 480`) is the alternative, if a portal wants landscape.
  - A 360-wide phone (common Android) draws the 42-column boards at 7.67 px. Critic fix idea (v4.2 re-check n1): trim the side gutter to 4 px below 380 px wide, which gives 8 px.

## From v4.3 (fixed tags, the space freeing at pickup, linked squads at the front, the Gallery in order, 2026-10-03)

- **Extreme** (Peter, 10/3): a fourth tag past Hard, for later. Not built: the tags are Easy, Normal and Hard.
- **Hard levels with archers are all or nothing.** Every colour is dealt exactly as many sappers as it has blocks, so on Hard (archers kill) a single kill leaves the colour short and fails the level. v4.3 deals those levels rushed: the stored order wins tapped the moment a space frees and also patiently. At rhythms in between (the stored order replayed with 1, 2 or 4 s of thinking after each tap) it can still lose: 10 of the 12 win all three, 82 loses at 2 s and the boss (100) at 1 and 2 s (`tools/v4.3-rebake.md`, the Thinking column). Ideas, Peter's call: one spare sapper per colour an archer covers on Hard; the first hit of a Hard level knocks back instead of killing; a coach line on the first Hard archer level ("wait for the squads before you send more"). The v4.1 note above (towers against the frame) is the board-side version of the same problem.
- **The time target and the new rule.** A space that frees at the pickup makes the same deal about a quarter quicker (v4.2's Siege levels 26+: 226 s to 171 s of real pace; the Gallery 197 s to 169 s). The dealer won most of it back (`tools/v4.3-notes.md` §4). Bigger boards or a slower walk are the other levers; neither was used (boards keep v4.2's sizes, the walk is Peter's).
- **Silhouettes of paintings.** A locked picture's silhouette is its cells against the colour its four corners share. Emoji and our pictures have a flat background, so the shape reads; a painting has none, so its silhouette is a dark rectangle under the padlock. A mask per painting (or a blurred, darkened thumbnail) would read better.
- **Tags from a cycle.** The tags follow a fixed cycle from level 4 (a Hard every 4-5 levels, an Easy after the second Hard of each round) with the era ends Hard and the levels after them Easy. A hand-placed list per pack (P2's packs) could match the tag to each picture.
- **Saves by id, holes allowed.** Format 2 keeps a cleared level wherever it sits, so a save can have holes (a level cleared with the one before it not). Shipped Siege saves have none (format 1 dropped wins after a gap), but a v4.2 player who won Gallery pictures out of order keeps them all: each cleared picture is open and opens the next, and the gold frame goes to the earliest open picture not cleared. Nothing forces the holes closed; packs that append at the end never make new ones.
- **Level 83 runs short.** An Easy breather (6 spaces) on an Era 4 board: real pace 168 s against the 180 s floor, the one reported fallback of the v4.3 rebake. No deal of its board reaches 180 s on Easy. Options: accept it, tag it Normal (the cycle's choice), or a new board.

## From v5 R1 (the rules engine batch, 2026-10-03)
- The continue's rewarded-ad button (`#p-cont-ad`, main.js AD HOOK: its reward calls `contRun()`), once an ad SDK is chosen.
- The Volley picks a colour by a queue tile or a space; picking it by tapping a block on the board would be more direct (board taps skip the show today).
- The 2× speed sheet doesn't pause the game while it is open; a pause behind it (like the Paused sheet) may feel better.
- A one-time "how mystery blocks work" coach line on the first level that has them (from 150).
- Unlock intro tips can sit over the queue on small screens (level 1's coach is still readable); a placement that avoids the coach's target.
- Five power-up badges on a phone under 375 px wide (360x640, 360x740) are 49 px, a little under the 52 px queue tile (still over the 44 px tap size); the selfTest's "bigger than a tile" check is waived there. A tighter coins pill would win the few px back.

## From v5 R2 (the re-lay, 2026-10-04)
- Side-quest density: at one picture every 3-5 levels only 25 of the 60 pictures fall inside levels 1-100; the other 35 wait for R4's levels (until then they open one at a time once the campaign is cleared). Two quests per node, or a denser rhythm in the early realms, would put more pictures in front of players now.
- The two 38x37 teaching boards that lost their lessons (v4.3's e3-51 and e4-76) were replaced by new boards because they top out near 2:30 of model time; they could come back as short breather levels if Peter wants a few quick levels.
- Level 100 (The Mistmoor's opener) reuses the Era 2 mystery lesson's moated motte; R4's fog-fen art should give it a Mistmoor look.
- The archer-hit harness screen is skipped while no level has towers (they return at 125).
- Old saves keep cleared ids by slot, so a v4.3 player's progress now points at the re-laid levels in those slots; a save note or a one-time "the campaign was rebuilt" toast could explain it.
- The interim Gallery screen: R3's journey map replaces it with side-quest nodes (prize on the node); the prize toast and grant move with it.

## From v5 R3 (the journey map, 2026-10-04)
- Easter eggs pay 331 coins in all and are tappable from the first visit (a player can scroll up and collect them on day one); a gate (only eggs in realms reached) is a one-line change if the economy wants it.
- The desktop realm card follows the current node's realm; it could follow the realm under the view while scrolling (a cheap rAF-throttled scroll read).
- The home's Play still reads the next level when every level is cleared; it could offer the fog's next picture as the map's Play does.
- (Done in the R3 fix pass: the latest three in one row and a chip opening a sheet of all of them.)
- A small tag mark on locked nodes (Hard ahead) if playtests ask for it; R3 shows tags on cleared and open nodes only.
- R4's realms: the Mistmoor's fog sheet becomes a middle sheet, so the wash, the fog band and the Goblin King move to the new top (`map.tail`).
- Lore beyond one line per realm: a small scroll per sheet (the mockup's "secrets" could carry a line each).

## From the v5 R3 fix pass (2026-10-04; skipped visual nits)
- The Goblin King is a flat glyph at the top of a painted map; a painted or pixel-art king (and his flag clear of the column edge) would make the climax land.
- Every open side quest shows a PRIZE bubble (up to 18 at once when a player skips quests); showing it only on the gold-ringed one, or shrinking the others, would cut the clutter.
- Desktop cards are top-aligned with empty brick under them on a 720 screen; centring them, or a third card, would balance it.
- Faint crossfade ghosting at the Ironhollows seams 8/9 and 9/10 (art; a re-assemble with a narrower blend there).
- Three bridges within about 300 CSS px around levels 41-45 on sheets 5-6; one could go.
- Realm 5 is one level until R4 ("1/1 cleared").
- The quests 14 and 19 bubbles still touch the road at a corner on a 360-wide column; a smaller bubble (icon only) would clear it.

## From v5 R4 (levels 101-200, 2026-10-05)
- Level 100 still wears v4.3's moated motte (frozen); the Mistmoor's stilt forts start at 101. A Mistmoor look for 100 would need Peter's OK to break the freeze for one level.
- The goblin capital (realm 8) reads as one grey mass at a glance; more contrast inside the fortress (darker courses, a scrap-iron gate, more banners) would help.
- Realm 5's fen forts all centre their hall; a two-level platform or a hall at one end would vary them more.
- Lava moats draw in the board only; the map thumbnails, the report picture and the share card still draw water blue (they never show a Siege moat today).
- Mystery blocks are dark "?" studs: a coach ring on the first one in lesson 150 (a ring kind for hidden blocks) would point at them.
- The boss (200) gets the realm's normal scenes; a fixed night scene with the crown lit would mark it.
- Contact sheets of the four realms' generator samples and of the baked 101-200 boards live in tools/shots-v5-r4/boards/ (gitignored like every shots folder).
