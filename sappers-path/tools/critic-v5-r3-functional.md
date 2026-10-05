# Sapper's Path v5 R3 (journey map): functional critic

Head `565bb48` (branch `sappers-path`), served on 127.0.0.1:8492. Driven with Playwright (Chromium headless): phone 375x812
(touch, isMobile), touch landscape 812x375, non-touch 812x375, desktop 1280x720. Real taps/clicks on every node, egg,
quest and button tested. Scripts: scratchpad `crit.mjs`, `probe.mjs`, `st.mjs` (not in the repo).

## Re-runs (item 9)

| Check | Result |
|---|---|
| `node tools/test.js` | 455 passed, 0 failed |
| `node tools/freeze.js --require` | PASS, levels 555 checks / gallery 360 checks, 0 differences |
| `SP.selfTest()` ?debug=1 | 375x812: 519 pass, 0 fail (4.4 s); 1280x720: 521 pass, 0 fail (4.1 s); 0 console messages |
| `./tools/critic-v5/run.sh` | 5,412 games, MISMATCHING GAMES 0, grade mismatches 0, known-answer boards wrong 0, real pace 160/160 identical |

Console: 0 errors, 0 warnings, 0 page errors across every run below.

## Findings

### BLOCKER 1. Long-tail thumbnails are 30x30 px targets (brief: all targets >= 40 px on phone)
- Repro: `?debug=1`, 375x812 touch. `SP.unlockTo(100); SP.clearPictures(27); SP.screen("map")`; scroll to the top.
- Evidence: both `.th` buttons measure 30x30 CSS px (also 30x30 at 1280x720 and 812x375). With `SP.clearPictures(60)`
  all 35 are 30x30, in 7 rows of 5 spanning x 47-209, y 130-358 (phone, scrollTop 0). Every other map target
  (156-160 per state) measured >= 40 px. All 35 thumbnails are hittable at their centres (no occlusion), so this is size only.
- Note: going to >= 40 px in rows of 5 makes the block ~7 x 46 = 320 px tall, which runs into the faded road and
  "The road goes on" (label starts at x 213, 4 px right of the current block). Needs a layout call (fewer per row, a
  scrolling strip, or only the last N shown) rather than a straight resize. Screen: scratchpad `tail-all-phone.png`.

### MAJOR 1. v4.3 saves lose levels 25, 50, 75 and 100 (R2 renumbering; surfaced by item 6)
- Repro: load `tools/saves/v4.2.json` (the v4.3 ids are the same: `e1-25`, `e2-50`, `e3-75`, `e4-100`) into
  `localStorage["sappers-path.v3"]` before boot, open the map.
- Evidence: v5 ids are `e2-25`, `e3-50`, `e4-75`, `e5-100`; the four old ids are dropped as unknown. A v4.3 player who
  cleared all 100 sees level 25 current ("Play level 25", focus `e2-25`), 50/75/100 open but uncleared, and so picture
  25 and the long tail go back to locked (they need level 100). No errors; gal entries load fine (12 won quests shown).
- Origin is v5 R2's re-lay, not R3's code. If Peter's "old saves" call (commit 596d5ac) already accepted this, downgrade
  to a note; if not, a 4-entry id map in `save.js sanitize` fixes it. The orchestrator should confirm which.
- The R2-shaped save I built (40 levels done, 6 real `gal` wins, a bogus `gal` id, a long-tail id won early, no `eggs`)
  loads clean: level 41 current, 6 quests won, 59 locked, eggs 0, no console output.

### MINOR 1. Everything cleared: map Play reads "Play level 100"
- Repro: `SP.unlockTo(100); SP.clearPictures(60); SP.screen("map")`.
- Evidence: map foot/desktop Play reads "Play level 100" (replays 100) while the next-up card says "Every level
  cleared"; home Play reads "Level 100"; the fog node is hidden (correct). Inconsistent end state; the bar could read
  the card's text or offer a replay.

### MINOR 2. Desktop next-up card at realm 3 names "Side quest 4" (the SUSPECT): correct per rule, odd in place
- Repro: 1280x720, `SP.unlockTo(55); SP.clearPictures(3); SP.screen("map")`.
- Evidence: card reads "Level 56" and "Side quest 4: An optional picture. Prize: Ladder +1"; clicking it starts
  `g-tw-1f98a` = picture 4 (after level 16, prize Ladder). 13 quests are open (1-13); pictures 1-3 won, so picture 4 is
  the first open, unwon one, which is the R2 `nextPicture()` rule. Number and target agree; nothing is mis-numbered.
- The issue is placement: the realm-3 card points 40 levels back to sheet 2 while picture 13 (after level 52, prize
  Ladder) sits open on the current realm's sheet. Suggest preferring the open quest nearest the current node (or in the
  current realm), falling back to the first open one. Peter's call.

### MINOR 3. Landscape
- Touch 812x375 shows the existing "Turn your phone upright" gate over the map (pre-R3 v4 behaviour, by design); every
  map target is behind it, so the map is not usable in phone landscape, same as the rest of the game.
- Non-touch 812x375: all 156-159 targets hittable at their centres, Play bar 796x48, no horizontal scroll; the scroll view
  is about 190 px tall with the debug row (about 245 px without). Usable but cramped.

## Pass/fail by item

1. **Fresh save flow: PASS.** Map opens at the bottom (level 1 current, Play "Play level 1", 4 of 13 sheets loaded).
   Level 1 sits 0.833 down the view and, after the win, level 2 sits 0.728 down: the clamp that keeps story/credits
   below the fold, not a miss (mid-campaign level 56 measured 0.600). Map Play starts level 1; won through real card
   taps; top-bar Map lands on the map with level 2 current, label "Level 2 Easy", Play "Play level 2". Loss (level 8,
   jam): fail sheet Retry/Map; Retry restarts (playing, panel null); a second jam then Map lands on the map, level 2
   still current.
2. **Nodes: PASS.** 100 `.mn` buttons; each DOM centre within 6 sheet px of its `layout.json` spot (0 off). Locked
   level 20 tap: stays on the map, a shake animation runs, nothing starts. Cleared level 5 tap: plays level 5.
   (Road placement and order are covered by the layout tests in test.js; I checked DOM vs layout only.)
3. **Side quests: PASS** (spot-checked 1, 4, 13, 17, 21, 25 across realms 1-5). Each is `locked` with the main level
   one short (tap stays on the map) and `open` once its `after` level is cleared, with the campaign current node moving
   on (never blocked). Labels carry the right prize (Ladder, Ladder, Ladder, Quartermaster, Recall, Ladder). First clear:
   toast "Side quest prize: +1 <name>", inventory +1 (start-of-level unlock gift accounted for: 1 -> 2). Replay: plays
   again, inventory unchanged, no toast. Won node shows the finished picture canvas (34x39 etc.). Suspect: see MINOR 2.
4. **Easter eggs: PASS.** 26 eggs, all 44x44 px. Each pays exactly its `map.eggCoins` value (10-15), total 331;
   second taps paid 0 across all 26. Map coins and home coins both 731 (400 + 331). After reload and opening the map,
   26 found (classes and "Found: ..." labels). Two touch taps plus a mouse double-click on a fresh egg paid 10 once.
5. **Long tail: PASS except BLOCKER 1.** All 1-100 + pictures 1-25 cleared: one fog node (`g-met-436528`, picture 26,
   gold ring), Play "Play picture 26" and the node both start it; clear -> toast "+1 Quartermaster", Play "Play picture
   27", 1 thumbnail, which replays picture 26. All 35 cleared: fog node hidden, 35 thumbnails, all hittable, but 30 px.
6. **Old saves: FAIL on v4.3 ids (MAJOR 1, R2 origin)**; R2-shaped save PASS; no errors either way.
7. **Layout: FAIL on thumbnail size (BLOCKER 1).** Phone/desktop at 0, 55 and 100 cleared: every visible map button's
   centre hits itself (0 hidden of 156-160); all >= 40 px except the long-tail thumbnails; no horizontal scroll; desktop
   gets the cards layout. No Gallery button anywhere (0 matches for "gallery" in button text, label or id). Debug row:
   shown with `?debug=1`, hidden (and `window.SP` undefined) without it at all three viewports.
8. **Lazy loading: PASS.** Home -> level 1 requests 0 sheet images. Map open requests 4 of 13; jumping straight to the top,
   every visible sheet was decoded within 52 ms (first poll). 8 of 13 requested after that pass.
9. **Re-runs: PASS** (table above).
10. **Payload: PASS.** Load to level-1 gameplay: 15 requests, 1,228,771 bytes (1.17 MiB, body + headers; main.js 271 KB,
   levels.json 293 KB, gallery.json 168 KB, layout.json 30 KB, no map art). Game folder excluding `tools/`:
   8,475,975 bytes (8.1 MiB), under the 20 MB cap (`tools/` itself is about 554 MiB and must stay out of any portal zip).

## Counts

BLOCKER 1, MAJOR 1 (R2 origin, may already be an accepted call), MINOR 3.
