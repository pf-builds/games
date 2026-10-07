# Sapper's Path v6 lane B: functional critic (Campaign / Zen split)

Date 2026-10-06. Worktree `repos/games-sappers-path`, branch `sappers-path` at 7e38fce (lane B f1fc68b..7e38fce on b22e863).
Server: worktree root on 8496, game at `/sappers-path/`. Driven with headless Playwright (1280x720 and 375x812 isMobile,
DPR 2) because the built-in Browser pane was hidden (0x0 viewport; see note N1). Scripts and shots in the session
scratchpad (`c/a.mjs` .. `c/e.mjs`, `home-375x812.png`, `mapzen-375x812.png`, `zenfail-375x812.png`, `reset-375x812.png`).
Nothing in the repo was edited; this file is the only write.

## Scorecard

| # | Check | Result |
|---|---|---|
| 1 | Fresh home, cards, Map tab, chip, two tabs | PASS |
| 2 | Zen structure, openness, win/fail words, Zen word grep | PASS on words shown; MINOR leak in screen-reader text |
| 3 | Campaign ends at 200, no Kitten Forest, words | PASS |
| 4 | Migration, wallet, SP2/SP1, reset per mode | PASS |
| 5 | Power-ups for a Zen-only player | **FAIL: MAJOR (dead end; prizes vanish)** |
| 6 | Music per mode, mute | PASS |
| 7 | "V4 TWISTS" chip row | PASS: debug-only (`?debug=1`), never shown to normal players |
| 8 | Mobile/desktop tap targets, overlap, console | PASS (one pre-existing 42 px gear, minor) |
| 9 | test.js / selfTest numbers | PASS: 629/0; selfTest 772/0 (1280x720), 770/0 (375x812) |

Severity counts: BLOCKER 0, MAJOR 1, MINOR 3.

## Findings

### MAJOR-1: a Zen-only player wins power-ups as Zen side-quest prizes but can never see or use 4 of 5 of them
Power-up badges unlock only by Campaign reach (`pwOpen`; builder call §8.4). Zen side quests still pay power-up prizes into
the shared inventory, so the prizes land in a hidden slot.
Repro (fresh save, `?debug=1`): win all 12 Zen side quests (`SP.zen().filter(i => /^g/.test(i))`, play `SP.winOrder()`), then
`SP.load('z1-2')` and read `.pw` badges.
Evidence: inventory goes `{ladder:0,qm:0,scout:0,recall:0,volley:0}` to `{ladder:4,quartermaster:3,scout:2,recall:2,volley:2}`
(poppy-field gives Volley, watering-can gives Quartermaster, Hakone gives Scout ...), but in a Zen level the badges read
`SHOWN Ladder`, `HID Quartermaster`, `HID Scout`, `HID Recall`, `HID Volley`. Same after `SP.zenTo(1,30)`: only Ladder,
coins pile up with nothing to spend them on except Ladder. The win panel doesn't name the prize either ("Picture done ...
First clear +20 ... Coins +30"), so the player is never told they got something.
Answer to brief item 5: yes, a dead end. A Zen-only player gets the Ladder and nothing else, ever, while being paid
four other power-ups they can't reach. Fix options: unlock a power-up in Zen by Zen reach too (or by owning one), or
show any power-up with inventory > 0. Peter's call on which; the current state can't ship.
Once the player reaches Campaign level ~60 the badges do appear in Zen (`SP.unlockTo(60)` shows Ladder, Quartermaster, Recall).

### MINOR-1: Zen still says "fort" in screen-reader text on every Zen level
The visible text is clean, but two accessible names leak on all 98 Zen levels (198 hits, nothing else):
- `index.html:25` `<canvas id="board" aria-label="The fort">`: static, never changed for Zen.
- The Volley badge's `aria-label` ends with `P.tip`: "A catapult volley clears one colour from the fort, the queue and
  the line." The visible tip box uses `zen.text.powerTips.volley` (`main.js:583`), but `renderPowers()` (`main.js:570`)
  builds the aria-label from `P.tip`, not the Zen override.
Repro: `?debug=1`, `SP.load('z1-1')`, read `#board[aria-label]` and the 5th `.pw` aria-label.
Grep also covered: Zen map (story, fog, banners, Play, node labels), home with Zen lit, reset sheet in Zen, win/fail
sheets, coach tips on 201-250 ("Lighter and darker blocks belong to their colour."). None of them had
goblin/fort/assault/siege/castle/raze/keep/throne.

### MINOR-2: Campaign reset wipes the shared wallet without saying it costs Zen anything
The Campaign reset says it wipes "your coins, power-ups ... Your Zen pictures stay." That's accurate, but the wallet is
shared, so a Zen player who resets the Campaign also loses everything earned in Zen. The Zen reset is careful to keep
the wallet. Suggest one clause ("coins and power-ups are shared with Zen") or keeping the wallet on a Campaign reset.
Repro: Settings > Reset progress > Campaign; read `#rs-lose`.

### MINOR-3 (pre-existing, not lane B): the gear button is 42x42
`#btn-settings` measures 42x42 at both 375x812 and 1280x720 (home). Below 44. Lane B's own targets are all fine.

## Detail by check

**1. Fresh player.** Home cards: "Campaign / Fort 1 of 200 / Level 1 EASY" and "Zen / 0 of 98 pictures / World 1 · 1"
(36 + 50 + 12 = 98). Tabs exactly Map and Home. Zen card: `z1-1`, mode zen. Map tab afterwards opens Zen (title "Zen",
12 sheets). Campaign card: `e1-01`; Map tab then opens "The Journey" (25 sheets). Chip `#map-mode` Campaign | Zen
switches the map both ways (aria-pressed follows). No console errors.

**2. Zen.** `SP.zen()` = 98: 36 `z1-*`, 50 `e9-201..250`, 12 Wandering Gallery quests. Map text: World 1 numbered 1-36,
World 2 numbered 1-50, "More worlds on the way" in the fog. World 2 level 1 open on a fresh save, World 1 level 2 locked
(selfTest also asserts this and one-by-one). Words:
- Win `z1-1`: "Picture done" / "Red Fuji, all dug out."; `e9-201`: "Teacup kitten, all dug out."; quest
  `g-w-poppy-field-giverny`: "Poppy Field (Giverny), all dug out."
- Fail `e9-210`, `z1-30`, a Zen quest: "A little stuck" / "Line jammed: [chips] can't reach a block. Have another look."
  (screenshot `zenfail-375x812.png`; the chips render as squad counts, the layout reads fine).

**3. Campaign.** Map ends "... 198 199 200 The road goes on", 25 sheets, no Kitten Forest sheets. `SP.gallery()` = 24
pictures (Step 0's keepers; no `g-w-*`, none of the 36). Card "Fort n of 200". `e1-01` win "Fort razed!" / "The goblin
king flees. Level 1 cleared."; `e2-30` fail "Assault failed"; campaign quest `g-ours-g01` fail "Assault failed";
`g-ours-g02` win "Picture complete!" / "Sir Whiskers hangs on your map now."

**4. Saves.** Seeded `sappers-path.v3` (v2 format): castle e1-01..e1-20, 5 of the 36 pictures (by their `from` ids) plus
g-ours-g01, e9-201..205 with best rows, 3 Kitten Forest pictures, eggs s1-0, s26-0, s27-1, last e9-205, coins 777,
music off, no Zen key. After reload: Zen `done` z1-1..z1-5 + e9-201..205 (bests kept for 201-205), `gal` the 3 KF
pictures, eggs z2-1-0 and z2-2-1, last e9-205, `moved: 1`. Campaign save byte-identical to the seed (union, nothing
removed); s1-0 stays a castle egg. Second reload: both keys byte-identical (no double move). Cards "Fort 21 of 200" and
"Zen 13 of 98 pictures / World 2 · 6". Music setting stayed off.
Wallet: Zen win 777 to 792 coins, campaign shows 792; a Ladder used in campaign `e1-21` (2 to 1) shows 1 in Zen.
SP2: `SP.code()` = "SP2." 327 chars; cleared storage, Load save code: summary "Level 21, 792 coins, 1 side quest, 3 easter
eggs; Zen: 14 of 98 pictures"; after Apply every campaign field and every Zen field equal (key order only differs).
SP1 (made with `SappersPath.save.encode`: e1-01, e1-02, e9-201, 55 coins): loads as Campaign, the move puts e9-201 in
Zen; cards "Fort 3 of 200", "Zen 1 of 98".
Reset: the sheet opens on the mode in use, with a Campaign | Zen choice and per-mode words. Zen reset (real 3.5 s hold):
Zen save emptied with `moved: 1` kept; campaign save including wallet byte-identical.

**5. Power-ups.** See MAJOR-1.

**6. Music** (`SP.music()`, AudioContext running after a real tap): Campaign map `theme`; Zen chip switches to `play`;
Zen level `play`; back to Campaign map `theme`; Campaign level `theme` (no switch; realm 8 `e8-190` takes `boss`, builder
call §8.3, consistent with the spec's spirit). Music off in Settings: `cur` null in Zen level and Zen map. Same at both
sizes.

**7. Debug row.** `#jr-dbg` is filled only when `DEBUG` (`?debug=1`, `main.js:121,147,732`). Without the flag it stays
`hidden` with 0 children on both maps, at 375 and 1280. `playtest-bundle.py --jump` only exposes `window.SP`; it doesn't
set DEBUG, so Peter's playtest artifact won't show it either. The row Peter saw is from `tools/shots-zen.mjs`, which loads
`?debug=1`. Not a blocker.

**8. Layout** (elementFromPoint at each centre, pairwise overlap):
- 375x812: cards 175x98 each, side by side, no overlap, both hittable; tabs 188x67; chip segments 103x44 and 59x44 (3 px
  shared border, intended); map Play 359x58; reset choice 150x44 x2, Hold 309x54, Cancel 309x48; Zen fail buttons
  164x44 x2.
- 1280x720: cards 225x98; chip 103x44 / 59x44; reset 150x44 x2, Hold 346x54, Cancel 346x48; fail buttons 236x48.
- Console errors and page errors: 0 across every script (selfTest x2, flows, migration, codes, reset, music).

**9. Numbers.** `node tools/test.js`: 629 passed, 0 failed. `SP.selfTest()` headless: 772/0 at 1280x720 (14.3 s),
770/0 at 375x812 (9.0 s).

## Notes (not graded)
- N1: In the hidden Browser pane (innerWidth/innerHeight 0) selfTest reported 514 pass and ~60 fails, then threw in
  `board.js studInfo` (null `.blk`) and left the real saves changed ("the real save is untouched" failed). This is a
  0x0-viewport artifact, not a player path, but a selfTest that can throw midway and leave the live save modified is
  worth a `try/finally` restore at some point.
- N2: The Zen fail sheet offers "Continue (250 coins)". Fine by the words rule; just noting that Zen has a paid
  continue.
- N3: World 1's mirrored castle sheets keep their painted quest spur roads with no node on them
  (`mapzen-375x812.png`, the fork above level 8). Builder call §8.7; visual critic's area.
