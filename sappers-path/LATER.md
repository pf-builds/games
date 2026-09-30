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
