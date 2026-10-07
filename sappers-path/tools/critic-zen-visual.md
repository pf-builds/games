# Critic: Sapper's Path v6 lane B (Campaign / Zen), visual pass

Date 2026-10-06. Build: worktree `games-sappers-path`, branch `sappers-path`, served on 8497, game at `/sappers-path/`.
Method: Playwright at 375x812 (3x, touch), 1280x720 and 320x568. Saves were set via `?debug=1` (`SP.unlockTo(199)`, `SP.zenTo(1,12)`), then reloaded on the plain URL, so map and home shots are what a player sees. Win/fail shots come from `?debug=1`. Screenshots: `tools/critic-zen-visual/`. Raw DOM measurements: `tools/critic-zen-visual/measure.json`. Console: 0 messages, 0 page errors on both viewports.

The builder's own `shots-zen/` were taken with `?debug=1`. I re-took everything without it.

## Counts
BLOCKER 0 · MAJOR 4 · MINOR 8

## Portal framing: would CrazyGames reject on sight?
No. Nothing here is a rejection on sight. There are no errors, no debug chrome on the shipped URL and no broken layout. What a reviewer would notice is roads that go nowhere on the Zen map, a Zen card that looks disabled on first launch, and a campaign map that ends at the Goblin King yet still says "The road goes on". Those make it look unfinished, not broken.

## MAJOR

**M1. On first launch, Zen looks like a disabled button.**
Fresh profile, plain URL, 375x812. The Campaign card is gold (`rgb(242,194,48)`) and carries an EASY tag. The Zen card is flat stone grey (`rgb(162,165,176)`) with no tag, which is the same grey this UI uses for secondary and inactive buttons ("Back to map", "Retry"). The two cards are the same size (175x98 each), but the colour reads "primary vs unavailable". After a Zen level the colours swap (`phone-home-zen-lit.png`), so this is "last played = gold", not "available vs locked". A new player has no way to know that.
Repro: clear site data, load `/sappers-path/`.
Evidence: `phone-home-fresh.png`, `se-home-fresh.png`, `desktop-home-fresh.png`.
Fix direction: give the unlit card its own inviting colour (for example a soft teal or green tied to Zen), not the stone used for secondary actions. Also show Zen's tag (EASY) on first launch too.

**M2. Zen World 1 has dead-end road branches, about 10 of them.**
Castle sheets 1-5 each have two side-quest branch roads (`map/layout.json` sheets 1-5, two `quests[].branch` each). Zen World 1 has no side quests, so these appear as road spurs that end in a loop with nothing on them.
Repro: Zen map, scroll through World 1.
Evidence:
- `phone-zen-map-current.png`: spur to the right between 16 and 17.
- `phone-zen-join-1.png`: spur to the right off the 8-9 stretch.
- `phone-zen-join-4.png`: spur to the right of 32.
- `phone-zen-join-5.png`: a fork after 36, with the left branch dead-ending.

**M3. Empty road between World 1 level 36 and World 2 level 1.**
Sheet 5 has 8 level spots and Zen uses 4 (33-36). Measured at 375 px, about 465 CSS px of road (roughly 70% of a phone screen) runs from node 36 to World 2's node 1 with no node on it, and it includes the M2 fork. It looks like missing levels.
Evidence: `phone-zen-join-4.png` (36 near the top) → `phone-zen-join-5.png` (long empty road up to the Kitten Forest banner).
Fix direction: spread 33-36 over the whole of sheet 5, or put the World 2 banner at the bottom of the empty stretch.

**M4. The Campaign map still teases more road past 200.**
The campaign is meant to end at the Goblin King, and the boss epilogue now says the road ends at the throne. But above 200 the road keeps winding into fog, labelled "The road goes on" (`config.json` line 371, `fog`; `fogAria` says "clear every level to find more pictures"). That copy contradicts the new ending and points players at content that has moved to Zen.
Repro: Campaign map, scroll to the top.
Evidence: `phone-campaign-map-top.png`, `desktop-campaign-map-top.png`.
Fix direction: replace it with an ending line (for example "The road ends here. More pictures in Zen") or end the fog at the throne.

## MINOR

**m1. The realm banner reads as a heading for both cards.**
"Realm 1 · The Greenmarch" (fresh profile) or "World 1 · The Gallery" (Zen played last) is centred above both cards but describes only the lit one. With two modes this is ambiguous.
Evidence: `phone-home-fresh.png`, `phone-home-zen-lit.png`.
Fix direction: anchor the banner over its card, or drop it (the cards already carry progress).

**m2. The difficulty tag sits at the gap between the cards.**
The tag hangs off each card's top-right corner. Campaign's EASY tag (x 144-187) ends 6 px before the Zen card starts (x 193), which puts it between the two cards and under the banner. It belongs to Campaign by a few pixels. With Zen lit, Campaign's EXTREME tag sits in the same spot. A top-left anchor, or a tag inside the card, would be clearer.
Evidence: `phone-home-fresh.png`, `phone-home-zen-lit.png`.

**m3. Zen uses three names for the same thing.**
Home card says "0 of 98 pictures / World 1 · 1". The map callout and Play button say "Level 1" / "Play level 13". The Zen story says "every world's first picture". Pick one word (Zen copy suggests "picture").
Evidence: `phone-zen-map-bottom.png`, `phone-home-zen-lit.png`.

**m4. World 1 is recognisably the campaign start, mirrored.**
The mirrored sheet 1 has the same farmhouse, the same two bridges, the same river bend and the same log egg as Campaign 1-8. Anyone who has played both will see the reuse. Spec accepted this for the 20 MB cap, so it is logged, not escalated.
Evidence: `phone-zen-map-bottom.png` vs `phone-campaign-map-start.png`.

**m5. Calm Zen card on top of a burning siege painting.**
Spec keeps the home art. Still, a "no foes" mode is offered over armies and fire. Note only.
Evidence: `desktop-home-zen-lit.png`.

**m6. Reset sheet spacing.**
The Campaign | Zen segment sits about 8 px above the body copy, which is tight compared with the rest of the sheet. The copy itself is clear and not scary: "Your coins, power-ups and Campaign stay" plus the save-code hint. Hold-to-reset is red and Cancel is gold.
Evidence: `phone-reset-zen.png`.

**m7. Top-bar buttons below 44 px at 320 wide.**
At 320x568, Back (`btn-home`) and Settings (`map-set`) are 36x36, below the 44 px hit target. The mode chip stays 44 tall (Campaign 103x44 and Zen 59x44 at 375; 137 px for the whole chip at 320). At 375 the bar is uncrowded: back, chip, coins and settings with no overlap. This is probably pre-existing.
Evidence: `se-zen-map-fresh.png`, `phone-topbar.png`.

**m8. The power-up unlock tip covers the Zen win picture and buttons.**
"New: Quartermaster / One free use" covers the finished picture on phone. On desktop it covers Time/Taps and "Back to map". It clears after 7 s or on a tap. It happened here because the debug jump unlocked power-ups without showing tips, so it may be an artifact of the jump. Separately, a Zen-only player never unlocks power-ups (`unlockAt` counts campaign levels). That is functional; the functional critic should check it.
Evidence: `phone-zen-win.png`, `desktop-zen-win.png`, `shots-zen/phone-zen-win.png`.

## Checked and fine

- **Twists debug row ("V4 TWISTS mystery/linked/locked/all"):** only with `?debug=1`. On the plain URL, `#jr-dbg` is `hidden` and computes to `display:none` at both sizes (measure.json `plainmap`). Not shippable chrome. The builder's shots show it only because they used `?debug=1`.
- **Road seams:** every castle sheet has entry and exit at x=384 (layout.json), so mirroring keeps them at 384. The joins between sheets 1/2, 2/3, 3/4 and 4/5 and the World 1/World 2 join are continuous (`phone-zen-join-1..6.png`).
- **World banners:** "WORLD 1 The Gallery" sits under World 1's first node at the bottom, and "WORLD 2 Kitten Forest" under World 2's node 1. Same style, readable, 285x42 at 375.
- **Zen win:** "Picture done" / "{title}, all dug out." (replay: "dug out again."), finished picture shown, no keep, no goblin. "Back to map" is primary, as in campaign.
- **Zen fail:** "A little stuck", the jammed squads shown as coloured chips, then "Have another look." Calm, readable. The 250-coin Continue is shared-wallet behaviour.
- **Save code sheet:** "Level 200, 400 coins, 0 side quests; Zen: 12 of 98 pictures", 1183 characters, copy confirmation shown. Clear.
- **Campaign top:** Goblin King at 200, no Kitten Forest sheets, no land nodes, fog clean (apart from M4's copy).
- **Fresh Map tab** opens Campaign; after Zen play the home lights Zen. Matches spec.
