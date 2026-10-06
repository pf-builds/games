# Sapper's Path Land 1 Kitten Forest: functional critic (2026-10-06)

Branch `sappers-path`, head `3f4a675`, served on 8492. Read-only on game code; this file is the only write
(`tools/critic-v5/diff-result.json` was restored with `git checkout` after `run.sh`: only its `ms` changed).
Scripts used (session scratchpad, not committed): `check.mjs` (rules and data from the critic-v5 rules model),
`players.mjs` / `deep.mjs` (difficulty players), `func.mjs`, `vis.mjs`, `hand.mjs`, `cards.mjs`, `bytes.mjs` (Playwright).

**Counts: 0 BLOCKER, 2 MAJOR, 7 MINOR.**

## Results by checklist item

| # | Item | Result |
|---|---|---|
| 1 | Rules from the SPEC alone | PASS (details below) |
| 2 | Difficulty | **MAJOR M1** (harder only on the grader's own measures), MINOR m1, m2, m3 |
| 3 | Freeze and old saves | PASS |
| 4 | Map past 200 | PASS; MAJOR M2 (win copy), MINOR m5 (long tail) |
| 5 | The play-screen gear | PASS; MINOR m4 (tap box at 360x640) |
| 6 | Re-runs | PASS |
| 7 | Payload | PASS (17.30 MB without tools/, cap 20 MB); MINOR m6 |

### 1. Rules from the SPEC text (critic-v5 `rules.mjs` model, extended in `check.mjs`)

On all 62 new boards (levels 201-250, pictures 61-72):
- Every stored order is taps only (no power-up), is never refused and wins on its tag in the critic's model, tapped at
  rest: 62/62. Longest wait (tap to everyone home, the final settle included) 14,130-15,000 ms (max exactly 15,000),
  taps 42-55, peak spaces at most 4 of 5. Stored `grade.maxWait` and `grade.peak` equal mine on all 62.
- `critic-v5/run.sh`: 0 mismatching games of 10,758 (326 levels: 2,608 each of patient, rushed, patient+power,
  rushed+power, plus 326 stored), 0 grade mismatches, tags 0 problems (Land 1 tags from its profile, side quests from
  `sideCycle`), 0 picture-format problems, 0 cross-buried pairs, known answers 0 wrong, real pace 322/322 and thinks
  322/322 identical. Its event diff covers UNLOCK (colour and key locks), REVEAL (? cards), SHOW (mystery blocks) and
  the linked-pair FREEs, so locks, links, mystery cards and mystery blocks behave per SPEC on every land board.
- Shading: on all 62 (every new board is shaded) the engine plays the stored order to the same state hash after every
  tap with and without the `shade` rows; blocks of each colour equal the sappers of that colour in its cards (a shaded
  block belongs to its colour's squads); shade digits sit only on picture blocks and every digit has its `pal[m].sh`
  colour. In the page, all 250 front cards of the 50 levels draw their colour's base (`--mc` = `pal[m].c`, 0 shades).
- Data: locks only on Hard/Extreme and on all 25 of them (21 colour, 4 key on a gilt cell, no key under a "?"); no
  linked pair inside one column; "?" blocks only on blocks, none on the outer two rings, 23-30% of the picture; no
  water anywhere (moats off for Land 1); the 12 side quests carry no lock, link, ? card, mystery block or water.

### 2. Difficulty

Independent measures, 101-250 and pictures 61-72: (a) a random patient tapper on the critic's rules model, 400 games
a level; (b) a careful player on the engine (save/load search at rest: try every legal tap, play on D taps, avoid any
line that jams, leaf = fewest blocks left, ties random), 6 seeds a level at depths 1, 2 and 3.

| Range | Tags E/N/H/X | Features a level (N / H / X) | Random-tap win, mean / median | Careful player wins, depth 1 / 2 / 3 |
|---|---|---|---|---|
| 101-150 | 6/21/19/4 | (castle) | 9.35% / 2.75% | 0.35 / 0.52 / 0.69 |
| 151-200 | 5/11/19/15 | 2.45 / 6.42 / 7.00 | 6.88% / 1.50% | 0.39 / 0.56 / 0.61 |
| 201-250 | 4/21/17/8 | **0.00 / 2.71 / 4.00** | 4.19% / 1.25% | 0.25 / 0.57 / **0.79** |

By tag at depth 3: Normal 0.88 (151-200: 0.71), Hard 0.67 (0.46), Extreme 0.69 (0.58).

**M1 (MAJOR): Land 1 is harder only for a random or one-step player; for a player who thinks two or three taps ahead
it is no harder than 151-200, and at three taps easier, with a softer tag mix and fewer features.**
Peter's call (`land-factory.md`) is that difficulty keeps climbing past 200 because playtesters find levels easy; a
playtester is a planner, not a random tapper. The bake was tuned against exactly the random-tap rate and the one-move
lookahead, so it met those (random 4.19% against 6.88%; Hard and Extreme medians 0.25%), but:
- Tag mix: 21 Normal and 8 Extreme against 151-200's 11 and 15; fewer Hard (17 against 19).
- Features: all 21 Normal levels (and the 4 breathers) are plain pictures, 0 features, where 151-200's Normals average
  2.45 and none is plain; Hard averages 2.71 features against 6.42, Extreme 4.00 against 7.00. Right after the
  castle's every-feature finale (196-200: H X E H X), 201-205 are five plain Normals.
- The careful player at depth 3 wins 0.79 of Land 1 against 0.61 of 151-200 and 0.69 of 101-150; at depth 2 it is a
  tie (0.57 / 0.56). The builder's own table already shows the Normal lookahead weak spot (0.18 against 0.12).
Repro: `node players.mjs <game> out.json 400 3 6 101` (algorithm above) or simply compare `levels.json` tags and
features for n 151-200 against 201-250. Fix direction: features on Normal levels (the castle's Normals carry them),
more Extreme in the mix, and a grader gate that includes a 2-3 tap lookahead, not only the 1-move one.

Sawtooth: `NNNNN HHHH X E NNNN HHHH X E NNNN HHH XX E NNNN HHH XX E NNNN HHH XX`; a breather after each of the first
four runs, the land ends on Extreme at 250, later peaks are double. Sensible as a shape (but see M1 for the drop at 201).

Unwinnable? None. 207, 236 and 246 (Hard) beat the depth-3 player 0/6, but a depth-5 search wins them 1/4, 4/4, 2/4,
the same as castle Hard levels 156 and 175 (1/4 each); the stored orders win through real taps (below).

**m1 (MINOR): 226 Tiger cub (Hard) is trivially easy for the obvious strategy.** A one-move greedy (send the squad that
leaves the fewest blocks once at rest, skip a tap that jams) wins it 30/30 (seeds 7..906), as do depths 2 and 3, while
the grade says lookahead 0 and random 0.75%. Repro: `deep.mjs <game> 1 30 226`. (235 Normal: 28/30 at depth 1.)

**m2 (MINOR): two levels lose to a steady 1 s rhythm on their own winning order.** `grade.thinks` is `[0,1,1]` on 232
and 247: the stored order with a 1 s pause after each tap loses, 2 s and 4 s win (castle 176 has `[1,0,1]`). A player
who has found the right line can still lose it by tapping at a natural pace.

**Hand play** (Playwright, real taps on the tray's cards from the map node like a player; 0.9 s think after each tap,
stored order): 201, 214 (Normal), 207, 226 (Hard), 250 (Extreme) at 375x812 touch @3x; 202, 210, 250 at 1280x720 mouse.
All 8 won ("Back to map" sheet), 0 console messages. Each took 114-163 s of play, median gap 1.5 s between taps.
Mid-play 250 on the phone reads fine (mystery blocks, ? card, link badges, the locked space, "Line full · 1 stuck ·
3 working").

**m3 (MINOR): long idle waits in real-tap play.** Per level 5-10 gaps over 5 s and 1-3 over 8 s with the next right
tap not yet legal; the longest 21.3 s on 214 (tapping as soon as legal piles up working squads, so the 15 s cap, which
is measured tapping at rest, does not bound a quick player's wait). Every Hard/Extreme level then ends with a 14-19 s
wait from the last tap to the win sheet. Every board presses the 15 s cap (min longest wait 14.1 s), as the foundation
notes warned.

### 3. Freeze and old saves (PASS)

- `levels/levels.json` and `levels/gallery.json` against live `030994c`: levels 1-200 and pictures 1-60 are
  JSON-identical, and the raw text is byte-identical up to the old closing `]}` (723,032 and 167,751 bytes in common).
- `freeze.js --require`: PASS (283 castle cases, 0 differences, 77.5 s). 201-250 are not snapshotted yet (by design).
- `src/save.js` is unchanged since live. tools/saves v3, v4, v4.1 and v4.2 load (home 30/250 Level 31, 40/250 Level 41,
  61/250 Level 62, 100/250 Level 101, 0 errors). A save at 200 (1-200 and pictures 1-50 cleared) opens on
  "Land 1 · Kitten Forest", Play reads Level 201 and opens "201 Teacup kitten".

### 4. Map past 200 (PASS)

- The 200 -> 201 join (shot `map-join.png`): sheet 25's retouched top carries one painted road up into the forest, the
  "LAND 1 Kitten Forest" banner sits on the seam, 201-204 sit on the painted road.
- Mirroring: sheets 28, 29 and 32 are mirrored (A, B, A', B', A, B, A' as planned). Every level node, quest node and egg
  on a mirrored sheet maps (un-mirrored) to the same source point of its WebP as on the unmirrored copy (e.g. 201 on 26
  and 217 on 28 both at 0.418, 0.842; quests 61 and 65 at 0.846, 0.596). Shot `map-sheet28.png`: 217-224, two quest
  clearings and the kitten and yarn eggs all sit on the painted road and clearings of the flipped sheet.
- Side quests: picture 61 closed at 203, open at 204; 72 closed at 204, open at 248. Quest 61 won twice: its Volley
  paid once (the second win changed nothing).
- New eggs: with 199 cleared the 4 kittens, 3 yarns and 3 butterflies (and Land 1's 3 fish) are hidden; with 200
  cleared all show. A kitten paid 14 coins once (second tap 0), a butterfly 12 once.
- Frontier (shot `map-frontier.png`): fog above 250 with "The road goes on" and the long tail's picture 51 in it.
- The boss's first win (199 cleared, 200 played): "Crown taken!" / "... The castle road ends here. Past the throne it
  runs on into Kitten Forest.", then Back to map focuses 201.

**M2 (MAJOR): every Kitten Forest level wins and fails with the castle's words.** Win any level 201-250: the sheet
reads "Fort razed!" / "The goblin king flees. Level 226 cleared." (fail: "Assault failed"), right after the boss
epilogue told the player the King is beaten and the castle is behind them; there is no fort on a kitten picture.
`src/main.js:1107-1109` hardcodes the castle lines for any non-Gallery, non-boss level; `lands.text` has no win/fail
words. Repro: `?debug=1`, `SP.unlockTo(225)`, play 226 to the end. (The map's story line also still reads "Goblins
stole the crown ..." in Land 1.) Land levels are pictures; the Gallery's picture-complete sheet is the natural model.

**m5 (MINOR): a live end-game player loses an open long-tail picture.** Live, a player with 1-200 and pictures 1-51
cleared has picture 52 open; on the branch it moves to after 258 and is closed until 250 is cleared (`SP.unlockTo(200);
SP.clearPictures(51); SP.quest(<52's id>).open` -> false; with 250 cleared, true). As designed in the foundation, but
existing players will see a picture they could play vanish into the fog; consider keeping a tail picture open once it
has opened.

### 5. The play-screen gear (PASS)

At 360x640 and 375x812 (touch, @3x), level 206 mid-play: a tap on the gear opens Settings, `SP.held()` true and the
engine clock stands still (1,166 ms over 1.5 s); Music, Sound effects and Colour-blind marks each toggle and save;
Done closes it, the level plays on (1,466 -> 2,666 ms). The Paused sheet's quick mute turns music and effects off and
back on (`settings.music/sfx` true,true -> false,false -> true,true). `body.tight`: every land board and side quest
(and 200) draws at 8 CSS px a cell or more at 375x667 (39 boards take the compact chrome), 360x640 and 375x812.
selfTest at 360x640@3x 893/0 with the 36 px gear.

**m4 (MINOR): the play bar's tap boxes at 360x640 are 44x41 (map, gear) and 42x41 (retry), not 44x44.** Measured by
`elementFromPoint` walking out from each button's centre: the bar's buttons sit 1 px from the screen's top, so the 4 px
extension has nowhere to go above (41 tall), and retry shares its right edge with the gear's extension (42 wide).
The top edge makes the height forgiving on a real phone; the 42 px retry is the real shortfall.

### 6. Re-runs (PASS)

`tools/test.js` 616 passed, 0 failed; `freeze.js --require` PASS; `regrade.js` 0 differences of 1,455 (250 levels),
`--gallery` 0 of 432 (72 pictures); `critic-v5/run.sh` as in §1 (diff-result.json restored); `SP.selfTest()` 893/0 at
375x812@3x, 895/0 at 1280x720, 893/0 at 360x640@3x, 0 console messages.

### 7. Payload (PASS)

- Game files without `tools/` (git-tracked): 17.30 MB (live 16.06 MB), under the 20 MB cap; 13.71 MB without
  `levels/pool-*`, `levels/frozen/` and the .md files. Land 1 adds 1.24 MB (2 WebP sheets 0.46 MB, levels and pictures).
- Bytes to play, fresh phone (375x812@3x, uncached): 2.45 MB to the home, 5.77 MB once level 1 runs (the three music
  loops, 3.3 MB, start after the first tap); a save at 200 to 201 the same; the map adds about 1.1-1.3 MB.

**m6 (MINOR): `levels/levels.json` sits on the path to the home and grows 262 KB a land.** 723 KB live -> 985 KB with
Land 1 (+36%), fetched before the home shows. At 16 lands that is about 5 MB before a first-time player sees Play.
Worth splitting per land (load a land's levels when it is reached) before Land 3 or 4.

### Other

**m7 (MINOR): SPEC-v4 §9 has no Land 1 entry.** Every earlier shipped change has one; Land 1 changed page behaviour
(`body.tight` compact chrome at 375x667), shipped the sheet-25 retouch and the cache tag `?v=44`, none recorded in §9.

Not findings: `body.tight` stays on `<body>` after leaving a level for the map (its rules only touch play elements;
fitBoard clears it on the next level); `SP.unlockTo` does not grant the per-level power-up gifts, so inventories in
debug saves differ from real play.

## Screens (session scratchpad `crit/shots/`)

`map-join.png`, `map-sheet28.png`, `map-frontier.png`, `250@375-tap25.png` (375x812@2-3), `boss-after-map.png`,
`pause-360.png`, `207@375-tap22.png`, `210@1280-tap20.png`, `250@375-end.png`.
