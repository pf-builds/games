# Sapper's Path v6 lane B part 2: the intro tour (2026-10-06)

Brief: the orchestrator's lane B part 2 brief of 2026-10-06; spec: `game-research/sappers-path-v4/v6-plan.md`, "Lane B,
part 2: intro tutorial" (Peter approved the step list). Branch `zen-tutorial` (from 7e38fce), to be merged into
`sappers-path` after the fix pass running there. Shots: `tools/shots-tutorial/` (gitignored; `tools/shots-tutorial.mjs`
remakes them, with step timings in its `notes.txt`). Dev server 8498 (worktree root, game at `/sappers-path/`).

## 1. What the player sees

- **First launch:** over the home, "New here?" / "Learn in a couple of minutes on a tiny practice fort. Nothing to lose." with
  Show me and Skip, and a foot line: "It's in Settings > How to play any time." Escape is Skip. Offered once per launch,
  only while the seen flag is unset and the player has cleared nothing in either mode (an updating player with progress
  is not new; `config tutorial.offerIfProgress`). A level started some other way while it shows (automation) hides it,
  unseen.
- **Settings > How to play** (a row above Copy save code, a ? in a ring drawn inline) replays the tour any time.
- **Eight practice forts**, each a 9-wide picture board played on the real engine, board, tray, holding line, coach band
  and bouncing arrow. The top bar shows the step number in the level tile, the step's name, Skip tour where the map
  button sits (the speed button is hidden: it is a coin purchase), Retry and the gear. Each step's coach lines move on
  as the player does the thing; at the step's goal (plus `doneMs` 900 ms of game clock, so the result lands) a done card
  covers the line and tray: "Step k of 9", one or two plain sentences, Next and Skip tour.
  1. Send a squad: tap a squad (arrow on the red card). Done at the tap.
  2. Nearest first: tap blue; the squad of 2 digs the two nearest blue blocks it can reach (the near bottom ones, not
     the far edge ones). Done when that squad has finished.
  3. The holding line: yellow 6 with 2 in reach sends 2, 4 wait in a space; tap red (arrow on red, the line glowing),
     red opens the wall and the waiting sappers go by themselves. Done when both played and the line is empty.
  4. Don't jam (Peter: the player jams it themself): "Tap blue until all 5 spaces are full." The arrow sits on the
     leftmost blue front; following it fills the 5 spaces with blue squads walled in by red, and the game's own fail
     sheet comes up: "Assault failed" / "Line jammed: [5 blue chips] can't reach a block." with one tour line under it
     ("That's a jam. Tap Retry and open the wall first."), Retry and Skip tour (no Map, no paid continue). Retry is the
     game's own: one tap restarts this fort, now with a second script (tap blue to bring red up, tap red, send the rest).
     Done on the win. A player who taps red early simply wins; the done card says the same lesson.
  5. Hidden things: a ? card behind the first red; tapping red turns it over at the front, and the coach (arrow on red)
     says to tap red again. Ten ? blocks inside the fort show their colour as red is dug away; then the ringed line about
     ? blocks, which stays up (dwellMs) before the done card. Done when both have happened.
  6. Shades: one orange fort in light (#ffbc46), mid (#ff9900) and dark (#dc7700): Kitten Forest's own orange and its
     shades, the ones Peter read as brown. One orange card of 31 clears all of it.
  7. Power-ups: yellow is walled in and waits; a practice Recall (arrow on its badge; then the arrow on the waiting
     squad's own space) sends it back to the front; a practice Ladder (arrow on its badge) adds a sixth space. The done
     card adds a line each for Quartermaster, Scout and Volley. Green first (the wall already open): the yellow and Recall
     lines pass by (`skip`: nothing waits) and the Ladder's comes up; done after the Ladder or the win.
  8. Clear the fort: three colours, a wall, no pointer. The game's real win sheet: "Fort razed!", the line "The goblin
     king flees. Practice fort cleared." (the castle's words with "Practice fort" for the level), no coins, report or
     ribbon, Next and Skip tour.
  9. Closing card: "You're ready" / "Pick where to start. You can switch any time on the map." Campaign ("200 forts that
     get hard, with the Goblin King at the top.") or Zen ("Pictures to dig out at your own pace."; hidden when the build
     has no Zen), each opening that mode's map (the map's own mode switch, `switchMode`), and Not now (home).
- **Skip tour** on every step (top bar, done card, the real sheet's second button), no confirm: home at once.
- **Length:** the shots script, tapping as soon as the squads are home, takes 53 s of game clock for the eight forts
  (3.6, 2.3, 4.5, 11.4, 5.1, 3.3, 5.1, 16.8 s). With reading (about 25 coach lines, 7 done cards, about 230 words) and
  a first-timer's pauses, an estimated 2.5 to 3.5 minutes: hence Peter's offer line "a couple of minutes".

## 1b. Fix pass (the critic's report, tools/critic-tutorial.md)

- M1: fort 5's second line instructs ("It turned over. Now tap red again to dig in.", arrow on red) until a ? block
  shows. Every done card now also waits until the coach line showing has been up `dwellMs` (2,500 ms) or the player
  has tapped since, so the ringed ? block line is read.
- M2: a `slot` pointer (main.js renderCoach): the arrow on the space a picked power-up can take, from above.
- m1: a coach line's `skip` (when-words, a leading `!` negates; new word `canRecall`) passes it by when it no longer
  fits; fort 7's yellow and Recall lines skip once green has opened the wall.
- m2: under a done card, Retry (top bar, R) and the card keys do nothing (capture listeners; Retry dimmed).
- m4: the arrow comes down onto a power-up badge during the tour (main.js placeHand, gated on the tour).
- m5: `config tutorial.maxCellCss` (56) replaces board.maxCellCss (22) while the tour runs, restored after: the forts
  fill the board's room (1280x720: 504x560 px, was about 208x230; 375x812: 351x390).
- Peter's copy: the offer reads "Learn in a couple of minutes on a tiny practice fort. Nothing to lose."

## 2. The hidden-block rule as implemented (engine.js, v5 R1)

A flagged block shows "?" until it is exposed, and is exposed for good the moment it touches connected ground: a 4-way
neighbour becomes open ground joined to the camp (after a pop or a gate opening), or it touches connected ground at the
start. A block on the picture's outer ring (x 1 or w-2, y 1 or h-2) shows from the start, so its flag means nothing.
Information only; no rule reads it. The tour's words: "A ? block shows its colour once a dug-out path from the camp
reaches it." test.js checks on fort 5's stored order that every ? block shows before it is dug.

## 3. Data (`levels/tutorial.json`, about 9 KB)

`offer`, `ui`, `close` (every word), `steps[8]`. A step: `id` (`tut-1`..`tut-8`, never a campaign, teaching, Zen or
Gallery id), `name`, `board` (a level record: `pic` board with `pal`, `cols`, `win.normal` the stored order; fort 4
`jam` the player's jamming order; fort 5 `hidden`; fort 6 `shade` rows and the orange's `sh`), `coach` (the coach
band's lines: `say`, `short`, the pointers as config.teach has them, and `go`), `coach2` (fort 4 after a jam), `done`,
`say` (the done card), `more` (fort 7), `jamNote`, `final` (fort 8), `powers` (fort 7: the practice stock). The when
words (`go`, `done`; `|` any, `&` all): play, used:m, wait, lineEmpty, full, reveal, shown, pick:k, power:k, clear:m,
won, jammed, never. Parsed once at load into arrays; read each frame with no allocation.

`config.json` `tutorial` (a new top-level key before `selfTest`): `key` (`sappers-path.tour.v1`), `file`, `doneMs`,
`dwellMs`, `maxCellCss`, `offerIfProgress`. Zero new image bytes (the ? icon is inline SVG).

## 4. How it is isolated (src/tutorial.js)

- **The save:** while the tour runs, `app.save` is a practice save: a JSON copy of the Campaign data (progress, coins and
  lives as they are, so the coins pill reads true), every power-up marked unlocked (no free-use tip) and the inventory
  the step's practice stock (Ladder 1 and Recall 1 on fort 7, nothing elsewhere). Its `settings` object is the real
  one and its `write()` writes nothing unless the settings changed (sound, colour-blind), then writes the real Campaign
  save, so a mute during the tour is kept. Everything the page writes in a practice fort (`last`, a clear, a power-up
  taken) lands in the copy and is dropped. In Zen mode the same (the copy is the Campaign data; nothing calls
  `useMode` during the tour).
- **The meta:** `app.meta` is a copy with lives and the continue off and only the step's practice power-ups open
  (unlockAt 1, one per level), the rest unlockAt 1e9 (hidden). A step with none hides the power-up bar.
- **The one save write:** the seen flag, its own localStorage key (`config tutorial.key`), set when the closing card
  shows (finished), on Skip / Skip tour / Escape / Not now, or when the tour is left some other way. Outside both
  modes' saves, so neither mode's reset clears it; not in the save code (no preference is).
- **Finishing** restores `app.save` and `app.meta`, drops the practice entries from `app.byId`, and clears `app.entry`,
  `app.S` and `app.B` (so nothing later restarts a practice id), then routes home or to a mode's map.
- **Never timers:** the done card waits on `app.clock` (step()); everything else is a click.

## 5. Shared-file hooks (merge notes for the `sappers-path` branch)

Everything else is in new files: `src/tutorial.js`, `tutorial.css`, `levels/tutorial.json`, `tools/shots-tutorial.mjs`,
this file.

- `src/main.js` (7 one-line hunks, no reformatting; 6 and 7 from the fix pass):
  1. boot, after `showScreen("title"); layout();`: `if (NS.tutorial) app.tut = NS.tutorial.init({ app, $, v: V_, getJSON, storage, startLevel, showScreen, retry, switchMode, renderCoach, csave, zsave, zenOn, SP });`
  2. step(), after `V.clock = app.clock;`: `if (app.tut) app.tut.step();`
  3. showPanel(), last line: `if (app.tut) app.tut.panel(e);`
  4. coachSteps: `(app.cfg.teach || {})[e.id] || e.L.coach || (e.L.hint ...` (a practice fort's own script)
  5. selfTest, first line in its `try {`: `if (app.tut) app.tut.selfTest(ok, out);`
  6. renderCoach, after the `st.power` pointer: `if (!el && st.slot) el = app.slots.find((q) => q.classList.contains("pickable")) || null;`
  7. placeHand, a branch before the `#line` one: a `.pw` badge gets the arrow from above while `app.tut.on`.
- `index.html`: `<link rel="stylesheet" href="tutorial.css?v=47">` after style.css's link and
  `<script src="src/tutorial.js?v=47"></script>` before main.js's; the cache tag 46 -> 47 on every `?v=` (a separate
  commit; the fix pass will bump too: take the higher number and bump once more at the merge).
- `style.css`: only the font's `?v=` (the cache tag).
- `config.json`: the new top-level `tutorial` key, inserted before `"selfTest"` (away from meta, reset, zen and layout).
- `tools/test.js`: a tour section appended before the final summary line.
- `tools/harness.mjs`: one line after `chromium.launch()` wrapping `browser.newContext` so every profile pre-seeds the
  seen flag (the harness is never blocked by the offer).
- `tools/playtest-bundle.py`: `levels/tutorial.json` in COPY; `tutorial.css` written beside style.css when index.html
  links it.
- `LATER.md`: a section appended.

If the fix pass renames any of `startLevel`, `retry`, `switchMode`, `renderCoach`, `csave`, `zsave`, `zenOn`, `storage`,
`getJSON` or changes Settings' `#set-copy` row (the How to play row is inserted before it), `#top`/`#lvl`, the panel's
`#p-primary`/`#p-secondary`/`#p-line`/`#p-cont`, `#rail`/`#powers`, `#toast` or `#pwtip`, adjust tutorial.js.

## 6. Checks

- **test.js** tour section (6 checks): 8 forts, own key; each fort a <= 81-cell picture board of its own, cards = blocks
  per colour, its stored order wins patiently, coach pointers and when-words valid, coach lines short; fort 4's jam
  order (every tap on blue) fills 5 of 5 spaces with stuck squads and fails "jam", with a second script; fort 5's ?
  blocks are off the edge and each shows before it is dug, a ? card behind a front; fort 6 has 3 shades of orange
  (base, lighter, darker, each with its colour) and one card for all of it; the practice power-ups are real ones;
  no dash or exclamation mark in the words.
- **SP.selfTest** tour section (runs first, on selfTest's scratch saves and a memory store for the flag): the offer
  shows once over the home with Show me and Skip hittable and 44 px, Skip sets the flag, never again; Show me opens
  fort 1 with Skip tour in the top bar (map hidden), the coach and arrow, on the practice save; every fort ends on its
  done card (Next and Skip hittable, text fits); fort 4 jams on the player's own taps with the real words, Retry and
  Skip tour, one tap retries with the second script; fort 7's practice Recall and Ladder work and only their badges
  show; fort 8's real win sheet has the practice line and Next, no coins; the closing card offers both modes, the
  flag is set and the real save back; the saves are byte-identical before and after (no coins, inventory, best times,
  progress, eggs or last); Campaign opens the Campaign map; Settings > How to play replays from fort 1; Skip tour goes
  home with the saves untouched; the real seen flag untouched by selfTest.
- Numbers of the final run: see the commit message of the notes commit and the orchestrator's report.

## 7. Calls I made

1. The offer goes only to a player with nothing cleared (an updating player isn't "new"), `offerIfProgress` false.
2. The seen flag is its own localStorage key, not a field in `settings`: save.js `sanitize` drops unknown settings
   fields, and editing save.js would collide with the fix pass. It survives every reset.
3. Fort 4's lesson is jam first, then do it right (Retry swaps in the second coach script), rather than a separate
   board; a player who ignores the arrow and wins still completes the step.
4. Practice forts are non-debug entries (so the level tile shows the step number), registered only while the tour runs;
   every write they cause lands in the practice save.
5. The real fail and win sheets are used (the jam's own words and chips, "Fort razed!"); the tour relabels their
   buttons (Skip tour for Map, Next for the win's Map) and hides the paid continue. Wins before fort 8 show the done
   card instead of the sheet.
6. The speed button is hidden during the tour (its 2x is a coin purchase), and so are Copy/Load save code, Reset and
   How to play in Settings (they would act on the practice save).
7. The closing card opens the chosen mode's map (the map shows the next level and its Play) rather than starting a
   level; choosing Zen sets Zen as the mode played last, as the map's own mode switch does.
