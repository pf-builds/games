# Sapper's Path v6.0 pre-ship critic (merged build d7ba6e2)

Date 2026-10-07. Served the worktree root on 8503, game at /sappers-path/. Playwright 375x812@3 touch and 1280x720 mouse.
Setup and solutions came from `?debug=1`; the old-player load, both save codes, the tap-target check and the debug-bar check ran on the plain URL.
Shots are in `tools/critic-v6-ship/`. Scripts are in the session scratchpad, not committed.

## selfTest
- 375x812@3 touch: **866 pass / 0 fail**, 0 console messages.
- 1280x720 mouse: **868 pass / 0 fail**, 0 console messages.

## Results by checklist item

| # | Item | Result |
|---|------|--------|
| 1 | Old player (v5.4 save), SP1 v5.4 code, SP2 round trip | PASS |
| 2 | New player: tour offer, full tour, Campaign route, Zen route | PASS |
| 3 | Campaign rules in real play (Hard pin, Extreme kill + 2 locks, 200, quests) | PASS, see m1 |
| 4 | Zen: no archers, locks or Extreme; calm words; music per mode; map at 1000-1300 | PASS, see m2, m3 |
| 5 | Map ends at 200; home cards; resets per mode | PASS, see m4 |
| 6 | Console 0; new UI tap targets at least 44 px at 375 | PASS |
| 7 | Blind CrazyGames verdict | No reason to reject on sight |

### 1. Old player
The v5.4 save was built with the **v5.4 code itself** (`save.js`, `gallery.json` and `levels.json` from 5e00e8e). It has levels 1-120 cleared, Kitten Forest 201-204 cleared, and 21 pictures: 5 of the 24 kept (g01, g02, g04, g09, g12), 13 of the 36 that moved to Zen, and Wandering Gallery 61-63. It also has 4 eggs (2 castle, 2 Kitten Forest), 5230 coins, 5 best rows, `inv {ladder 2, qm 1, scout 3, volley 1}`, `got` x4, 4 lives, and `last` e5-121.
- Seeded into `sappers-path.v3` with the plain URL, then loaded:
  - No tour offer.
  - Home shows "Continue Campaign, Fort 121 of 200, Level 121", 120/200 and 5230 coins.
  - The Zen card reads "World 1, The Gallery, 20 of 98 pictures, Picture 10".
  - The Zen key holds:
    - `done`: the 13 World 1 levels (z1-1 to z1-9, z1-13, z1-16, z1-18, z1-21) and e9-201 to e9-204.
    - `gal`: the 3 Wandering Gallery pictures.
    - `eggs`: z2-1-0 and z2-2-1.
    - Bests carried: e9-201 and poppy.
    - `moved` = 1.
  - The Campaign key keeps 124 clears, the wallet and the 2 castle eggs.
  - The Zen map shows World 1 (36) and World 2 Kitten Forest (50), 86 nodes, 17 marked done. The Campaign map has 200 nodes, 120 done.
- Reload: both keys are byte-identical and the home is identical. Stable.
- SP1 code: 831 characters, made by v5.4's own `encode`. Loaded on a fresh device through Settings > Load. The preview reads "Level 121, 5230 coins, 5 side quests, 4 easter eggs; Zen: 20 of 98 pictures". After Apply, the Campaign is 124 clears plus 8 pictures (5 kept and the 3 Wandering Gallery), wallet exact. Zen matches the localStorage path exactly (17 done, 3 pictures, 2 eggs).
- SP2: exported after the SP1 load (`SP2.`, 910 characters), loaded on a third fresh device. Campaign, wallet, Zen done, Zen pictures and eggs all match.
- Notes, not graded:
  - (a) On the localStorage path the Campaign key still lists the 13 moved ids in `gal` (21 entries) until something rewrites it. Nothing is lost or shown wrong.
  - (b) An SP1 code carries a `[0,0,0]` best row for every clear. Zen keeps 5 empty rows that SP2 then drops. No visible effect.

### 2. New player
- Fresh device: the offer "New here?" shows over the home.
- Ran the full 8-fort tour by real taps:
  - 375 touch, then the Campaign route: map, Campaign pressed, current node 1; that node opens e1-01.
  - 1280 mouse, then the Zen route: map, Zen pressed; that node opens z1-1.
- Tour flag = 1 and no offer after reload, in both runs. Close card shot: `03-tour-close-375.png`; Zen first picture: `04-tour-zen-first-1280.png`.
- One of three runs stalled. A Red card stayed disabled for 30 s right after a step's last tap. It did not happen again in two full reruns. It looks like my driver tapped while the done card was arriving. Not graded.

### 3. Campaign rules in real play (375 touch, each level opened from its map node)
- **Level 106 (Hard, pin):**
  - Start toast: "Archers pin here: a hit sapper waits for its tower to fall", at the board's foot (toast y 384-464, frame 69-454).
  - Hit plan 014 pinned a sapper. The space reads "Daub, 16 waiting, 1 out, 1 pinned", hatched red with the arrow badge "1" (badge 22x14). The head reads "1 pinned · 4 free". Shot: `05-hard106-pinned-375.png`.
  - Retry, then the stored order by real taps: **won**, "Fort razed!", First clear +40.
- **Level 163 (Extreme, kill + 2 locks):**
  - Skull "EXTREME" pill in the play bar, 2 padlocked spaces, start toast "Deadly archers: a sapper they hit is lost".
  - Hit plan then play: **failed, reason short**. The sheet reads "Assault failed / EXTREME / Not enough [green chip] sappers left: archers shot one down." with Retry and Back to map. **No Continue.** Shots: `06-`, `07-`, `15-plain-163-start-375.png`.
- **Level 200 (Goblin King's Hall, Extreme):** stored order by real taps, **won**. "Crown taken! The Goblin King is off his throne..." First clear +60. Shots `08-`, `09-`.
- **Side quests on the map:**
  - Place 4 Giant Drumstick (cq44): "prize: one Ladder".
  - Place 35 Baby Phoenix (cq14): "one Scout".
  - Place 37 Castle Guard (cq27): "one Volley".
  - All three show the PRIZE +1 flag, 44x44 nodes.
- **cq44 won from its map node:**
  - Ladder 1 to 2.
  - A toast "Side quest prize: +1 Ladder" shows on the win, then clears before the sheet appears.
  - The sheet says "Giant Drumstick hangs on your map now." (see m1). Shots `11-`, `16-`.

### 4. Zen
- Data: none of the 86 Zen levels (World 1 plus Kitten Forest) or the 12 Wandering Gallery pictures has `archers`, `lock`/`locks`, towers or an Extreme tag.
- In play, z1-12 has no toast, no locked spaces and no coach.
- Calm words:
  - Fail: "A little stuck ... Have another look."
  - Win: "Picture done, Doughnut, all dug out."
- Music per mode (SP.music, after a gesture):
  - Zen map and Zen play use `play`.
  - Campaign map and Campaign play use `theme`.
  - This matches `config audio.music.modes`.
- The "Deadly archers / Pinning archers / Two locks" labels found under #map are the `?debug=1` twist bar (`#jr-dbg`). On the plain URL it is hidden and `window.SP` is undefined.
- Map at widths 1000, 1050, 1100, 1150, 1200, 1250 and 1300 (height 720), both modes:
  - Below 1100 the realm card hides and next-up becomes a full-width bottom bar (0 to w, y 637-720).
  - From 1100 up both side cards sit inside the viewport (1100: realm 18-308, next 792-1082; 1300: realm 118-408, next 892-1182).
  - No horizontal page scroll, no clipped card. Shot `12-zen-map-1150.png`.

### 5. Map end, home, resets
- **Campaign map after 200:** 200 road nodes and 51 quest nodes, no fog elements, no tail nodes. The top shows 200, the Goblin King and the place-50 quest. The painted road runs on into a white haze at the sheet's top (see m4). Shot `10-map-top-after200-375.png`.
- **Home:** both cards are gold, and the Continue ring is on the mode last played (Campaign after load: `01-`; Zen after Zen play: `13-home-1280.png`).
- **Reset (Settings > Reset progress, Campaign/Zen/Everything radio, press and hold 1.5 s, 1280 mouse):**
  - Campaign: clears 124 levels, 8 pictures and 4 eggs. Coins 5290, inventory, `got` and Zen (18/3/2) are kept. Toast "Campaign reset. Back to level 1."
  - Zen: Zen goes to 0/0/0; Campaign and wallet are kept. Toast "Zen reset. Every world starts again."
  - Everything: coins 400, inventory 0, `got` 0, both modes empty. Toast "Everything reset. A fresh start."

### 6. Console and tap targets
- **Console:** 0 messages (errors, warnings or logs) across every run: selfTest x2, migration x3 contexts, tour x3, campaign play, Zen/widths/resets, and the plain-URL pass.
- **New campaign UI at 375 wide, plain URL:**
  - Pinned space and locked spaces: 66x50 each.
  - Squad cards: 65x52.
  - Map quest nodes: 44x44.
  - The skull "EXTREME" pill is a non-interactive span (71x19), so the 44 px rule does not apply. **Pass.**
- **Older UI below 44 px (before v6, not graded):**
  - Top-bar round buttons: 42x42.
  - Map realm banners: 285x42.

### 7. Blind verdict
Nothing I'd expect a CrazyGames reviewer to reject on sight. The painted home and two gold mode cards read well. Play screens are clean at both sizes, with no debug UI on the plain URL. Fail and win sheets are legible, there are no console errors, and there is no horizontal scroll. The visible nits are m1-m4 below and the 42 px top buttons. None of them would stop a review.

## Findings

**BLOCKER: none. MAJOR: none.**

- **m1 (MINOR) Campaign quest win sheet doesn't name the prize.**
  - Repro: clear 1-16, then tap the place-4 Drumstick node and win it.
  - "Side quest prize: +1 Ladder" shows only as a toast during the collapse and is gone before the sheet slides in. The sheet reads "Giant Drumstick hangs on your map now."
  - Zen's sheet does append the prize (main.js:1277, under `ZW` only). The two modes disagree.
  - Fix: add the same prize suffix to the Campaign `winLine`.
- **m2 (MINOR) Zen still wears "Hard".**
  - 10 Zen levels carry tag hard (e.g. z1-12, z1-20, z1-29, z1-36, e9-212).
  - Where it shows: map pill "Hard", play bar chip HARD, HARD on the win and fail sheets.
  - The Zen fail sheet also offers a paid "Continue 250".
  - Neither is an archer, lock or Extreme, so item 4 passes as written. Both still cut against "calm".
  - Repro: Zen map, picture 12.
- **m3 (MINOR) Zen World 1 realm card reads "Side quests 0 / 0"** at 1100 px and up, because World 1 has none. It looks like a bug. Hide the row when the total is 0.
  - Repro: Zen map at 1150 wide, `12-zen-map-1150.png`.
- **m4 (MINOR) The map past 200 is a painted road fading into white haze.**
  - The 200 win line says "Past the throne it fades into the mist, for now."
  - No fog overlay and no nodes, so it ends cleanly in function. Visually it still teases more road. That is fine if intended; a "more coming" read is the risk.
  - Repro: win 200, map, scroll to top. See the crop of `10-`.

## Verdict
**Ship.** The merge broke nothing I could find:
- Old saves, SP1 v5.4 codes and SP2 round trips all keep every clear, picture, egg and the wallet.
- The new rules play correctly in real taps.
- Zen is free of archers, locks and Extreme.
- Resets behave per mode.
- selfTest 866/868 with 0 failures, console 0.

The four minors are polish for the next pass.
