# Sapper's Path v3 M2 notes (finish)

M2 turns the M1 page into a finished, portal-ready web build: teaching coach, gate/key and archer art, the archer hit show, juice and sound, portal shape, and the landscape layout. No new mechanic, no rebake. Page: http://localhost:8491/sappers-path/ (`?debug=1` for `SP`). Portal-style host: http://localhost:8491/sappers-path/tools/iframe-host.html (`?w=&h=` sizes the frame).

## Files

| File | What changed |
|---|---|
| `src/engine.js` | One log line: `EV.AIM` (the covered pixel a squad was going for) just before HIT/KILL. Presentation only; rules untouched. Node test added. |
| `src/board.js` | Gate padlocks and key rings, tower rims and archers, the hit show (arrows, knock-back, falls), crumbs and dust, shakes, falling pops, the keep coming down, the quarter turn. |
| `src/main.js` | The coach, the cue set, pause and resume, the win medals, the panel tap guard, short-landscape layout, selfTest additions, facade additions. |
| `src/audio.js` | Per-cue throttle (`audio.gaps`) and `suspend()`. |
| `index.html`, `style.css` | `#coach`, `#hand`, `#pause`, `#p-medals`; short-screen rules. Everything at `?v=8`. |
| `config.json` | `teach` (the scripts), `fx`, new `show`, `board`, `layout` and `audio` keys. Every number is there. |
| `tools/harness.mjs` | Rewritten for four viewports, the iframe host, pause, network and payload. |
| `tools/iframe-host.html` | New: a portal stand-in with a 400×600 iframe and a host button that takes focus. |

## 1. Teaching coach

`config.teach[levelId]` is a list of steps. Each step has one line of text (`say`, with `{n} {crew} {reach}` filled from the pointed card) and a pointer:
- `card`: the leftmost front card of that colour
- `next`: a faded card behind a front one
- `line`: the holding line
- `ring`: a key, gate or tower on the board

A step ends when any of its `until` conditions holds: play, line, lineEmpty, gate, tower, reach:m, used:m or hit. A step whose `if` fails when it comes up is skipped. Conditions read the rules state, so any tap order works and nothing blocks play. The text sits in one line at the top of the stage, and the font steps down from 21 to 15 px until it fits. A gold arrow bobs above the target, and the target glows. The arrow has `pointer-events: none`, and selfTest checks it never covers its target. DOM work happens on a play or a resize, never per frame.

| Level | Steps |
|---|---|
| 1 (tray) | Tap a squad (arrow on Diggers). Then: the faded squads move up next (arrow on a faded card). |
| 2 (holding line) | Thatch is walled in, send the Torchbearers (arrow on them). They wait on the line (arrow on the line). A full line fails the assault. |
| 3 (squads bigger than what's open) | "10 Sawyers, 4 timber in reach. Go!" (live numbers). Then: the rest wait, break the wall to free them (arrow on Diggers, the line glows). |
| 26 (gate and key) | Dig out the gold key (arrow on Sawyers, ring on the key). Send the Looters (arrow on Looters). The gate is open. |
| 51 (archers) | Archers shoot the red ring, tower first (arrow on Quarrymen, ring on the tower). Tower down. |

The teaching levels are unchanged, so the bake is unchanged. Levels 1-3 and 26 win from every tap order on every difficulty; level 51 wins on Easy and Normal from any order.

## 2. Gates, keys and archers

**Gates and keys.**
- Each gate wears a padlock in its tint (`board.gateTints`: gold, then cyan for a second gate), and its key wears a pulsing ring of the same tint.
- When the key is eaten:
  - the lock drops and spins away
  - the iron bars fall one by one (`fx.gateStaggerMs`), each with crumbs
  - the board shakes (`fx.gateShake`)
  - the `gate` cue plays (clank and creak)

**Towers and archers.**
- Tower blocks get a dark wall line and two pale merlons on the tower's outer edges, so a tower reads as a crenellated round tower.
- A hooded goblin archer (8×8 figure, `board.archer`) stands on top while any of it stands. He draws his bow while an arrow is out.
- When the tower falls, the archer tumbles off, the red ring fades (`fx.towerFallMs`), and the `tower` cue plays.

**The archer hit show.** The engine logs AIM, the covered pixel. The show adds up to `show.hitMax` (3) hit runners, which leave after the squad's own eaters.
- Each hit runner walks toward the pixel and stops where its route first enters a standing ring.
- An arrow flies on a shallow arc from the archer (`show.arrowMs`, `arrowArc`) and strikes it.
- On Easy and Normal the sapper is knocked back (flipped, a hop, `knockCells`) and runs to the camp.
- On Hard it falls over and fades (`hitFallMs`).
- A label rises from the hit: "13 driven back to the line!" or "13 cut down by arrows!" (`show.hitText` and `killText`).
- Cues: `arrow` on release, then `thud` (knocked back) or `fall`.
- The logic is still instant at the tap. The holding line shows the hit sappers at once, a Hard kill ends the level short at once, and any tap lands the show.

## 3. Juice and sound

**Sound** (all WebAudio recipes in `audio.cues`):

| Cue | When |
|---|---|
| `tap` | a card tap |
| `pop` | each eaten pixel; rising pitch, throttled to one per 38 ms of sim time (`audio.gaps.pop`) |
| `haul` | a runner's blocks land in a crate (70 ms gap) |
| `fill` | a new holding-line entry |
| `warn` | the line reaches one free space |
| `overflow` | the tap that overflows |
| `gate`, `arrow`, `thud`, `fall`, `tower`, `collapse` | as above |
| `fanfare` | the win (reused) |
| `chime` and `bad` | the panels (reused) |
| `star` | a new medal |

Mute persists in the save (the harness reloads and checks it).

**Visuals:**
- Crumbs of the block's colour and a dust puff on every pop (`fx`), spawned inside the popped cell. They live in a 768-slot ring of typed arrays.
- Board shakes on gate open, a tower falling, the fail landing, and the keep. They are off under `prefers-reduced-motion`.
- The last free holding space pulses red.
- The win sequence:
  - the winning play's last 14 pixels fall and tumble instead of popping, with dust
  - the goblins' keep (a pixel tower with its green flag) stands where the last pixel went, shakes, and sinks into the ground with the `collapse` cue
  - the crowned goblin scrambles out of the rubble, taunts, and flees off the top (`show.keepFrac`, `keepHold`, `keepGoblinAt`)
- **Score beat:** the win panel shows the level's E/N/H difficulty medals, and the one just earned stamps in with the `star` cue. These are the existing win bits; there is no new meta system. v2's crew stars have no v3 equivalent, so I didn't bring them back.

## 4. Portal shape (measured by the harness)

| Check | Result |
|---|---|
| Clicks to gameplay | 1 (the title's Play) on all four viewports |
| Load to title ready | 36-51 ms |
| Load to gameplay, including the tap | 83-195 ms (limit 20 s) |
| Requests | 11 (12 in the iframe host), all same-origin; no external requests |
| Payload loaded | 465,866 bytes (0.47 MB) |
| Shipped runtime files | 0.47 MB; 1.7 MB with the unused bake pools |
| Tracked game folder | 2.3 MB |
| Fonts | Jersey 10, self-hosted |
| Outbound links | none |
| Scrollbars | none on the title, the map, level 1 or an Era 3 level, at all four viewports including the 400×600 iframe. The map scrolls internally with its scrollbar hidden. |

**Pause.** Window blur or a hidden tab stops the sim clock and suspends the audio context.
- In a level, a Paused sheet covers the game and takes the tap that resumes, so the tap that brings a player back can never play a card. Space and Enter also resume.
- On the title and the map, the game resumes when focus comes back.
- The first frame after a resume is 16 ms (no jump). There are no timers.
- Harness: the clock is frozen across 450 ms after blur. One tap resumes, and 300 ms later the clock has moved 300 ms with no card played.
- The iframe run uses a real focus change: a click on the host page's button blurs the game's window.

**Panel guard.** Win and fail panel buttons ignore taps for 350 ms of sim time after they appear (`show.panelGuardMs`).

## 5. Layout: landscape phones and small frames

- **Short and wide (height ≤ 480):** the top bar moves over the rail, and the rail narrows to 280 px, so the board gets the full height.
- **Quarter turn:** when a board would be under 8.5 CSS px a cell (`layout.rotateBelowCss`) and turning it makes it bigger, the canvas is drawn turned. The camp and yard face right, next to the tray. Only positions turn (`MX/MY` in `board.js`). Sprites, crates, the keep and labels stay upright. Rules and tie-breaks are untouched; this is display only.
- **Short portrait** (≤ 640 × 700, the 400×600 iframe): every chrome row gives a few px.

Smallest Era 3 cell in CSS px (levels 51-75):

| Viewport | px per cell |
|---|---|
| 375×812 | 9.5 |
| 812×375 | 9.33, turned (was about 5.5 in M1) |
| 1280×720 | 12 |
| 400×600 iframe | 8.0 (level 64, 30×48, the tallest board) |

## 6. selfTest and harness

**selfTest:** 526 checks, about 0.9 s, zero failures on every viewport and in the hidden tab. New since M1:
- the coach, on every script:
  - its one line and arrow at load, with the target hittable
  - it only moves forward on the stored order and is gone at the win
  - a player who taps what the arrow points at sees every step and wins
  - level 2's line step, and level 51's tower ring
- the gate show, ticked: the lock drops, the bars fall, the board shakes, one gate cue, then open ground
- archers on each difficulty:
  - the hit or kill is recorded at once
  - hit runners of the right kind (knock-back or fall)
  - an arrow flies and strikes, and the label rises
  - Easy and Normal: a card tap mid-animation plays
  - Hard: the kill ends the level short at once, and Retry mid-animation restarts
- the overflow cue once; the last-space warning and pulse; the fail shake
- the win: falling blocks, the keep's shake and collapse, the fanfare, the new Normal medal stamped
- pause: the clock stops, the sheet covers the cards, one tap resumes with at most 32 ms of movement and no card played

**Harness** (`tools/harness.mjs`): all passed. It runs 375×812 (touch), 812×375 (touch, dpr 3), 1280×720 (mouse) and a 400×600 iframe in the host page (mouse). Each viewport runs everything in the header comment, then a hidden-tab load. Zero console errors or warnings.
- Live frame p95 on the busiest play is 16.7-16.8 ms.
- Draw cost is about 0.07 ms mean and 0.5-0.7 ms max.

Screenshots are in `tools/shots-v3-m2/` (untracked, like M1's):
- `375-teach-l1`, `375-teach-l26-gate`, `375-gate-opening`, `375-archer-hit`, `375-win-collapse`, `375-win-goblin`, `375-fail`
- `812-era3`, `1280-mid-show`, `iframe-mid-show`

## Decisions (also in SPEC-v3 §9)

- A Hard archer kill always fails the level short: deals carry no spare sappers. So the Hard hit show plays out under the fail, and "input isn't blocked" on Hard means Retry and skip work mid-show.
- The coach replaces the M1 hint panel. A level with a `hint` but no script shows the hint as a one-step coach.
- The pause sheet takes the resuming tap, rather than auto-resuming on focus, so a returning tap can't play a card.
- The v2 crew-star score is not brought back. The beat is the existing E/N/H difficulty medals.

## Waived or left for later (LATER.md)

- The label and coach use the pixel font's canvas face. If Jersey 10 hasn't loaded when the first label draws, one frame falls back to the system font.
- On the short landscape layout the level name is hidden; the number stays.
- The coach bubble sits over the board's top row. The teaching boards have grass there.
