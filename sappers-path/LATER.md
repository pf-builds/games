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
