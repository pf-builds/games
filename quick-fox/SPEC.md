# Quick Fox — Build Spec (v1, approved 2026-09-02)

Typing tutor + arcade, desktop only. Fifth Click it! Studios cabinet. Two audiences on one engine: a ten-year-old learning the keyboard (guided lessons, mascot, stars) and an adult brushing up (1-minute tests, WPM trend, weak-key drills).

## Profiles (local only)
- Title → "Who's typing?" picker. Add a player by typing a name (≤ 12 chars). No names ship in the code.
- Stored in `localStorage` under `quickfox.v1` in the browser that created them. Never uploaded. The picker says so.
- Per profile: lessons completed (stars, best accuracy, best WPM), last 10 test results, per-key error map, arcade best, total keystrokes.

## Modes
1. **LEARN** — 24 lessons in order (`lessons.json`): home row (f j, d k, s l, a ;, g h, words), top row (r u, e i, w o, q p, t y, words), bottom row (v m, c , , x ., z /, b n, words), shift + capitals, capital sentences, numbers 1–5, numbers 6–0, punctuation, graduation pangrams. Each lesson: on-screen keyboard with finger-colored zones, the next key lit and the finger named, a drill built only from keys learned so far, a stars result (accuracy first: 3 stars ≥ 97% acc, 2 ≥ 92%, 1 = complete). Wrong key does not advance (kid-safe: no cascading errors); it counts as an error and flashes the right key. Key auto-repeat is ignored everywhere. "Perfect!" needs zero errors; three stars needs ≥ 97%. From lesson 12 the keyboard dims by default with a "show keyboard" toggle ("try it blind").
2. **PLAY** — leveled arcade on canvas, no timer: the round runs until the 3 hearts are gone. Words drift from the right toward the fox's tower; the first typed letter locks the nearest matching word, finishing it zaps it (laser + pop + score float). Every 6 zaps is a level: speed +13%/level, spawns 10% tighter, word length window widens (`lengthByLevel`), the top row joins at level 3, the whole alphabet at 5, capitals at 9, a heart back every 2 levels. Level 1 pool respects the profile's lesson progress. From level 2 every 8th word is gold: zapping it freezes the sky for 2.5 s (first power-up; more in LATER). Best level and best score saved per profile.
3. **TEST** — 60-second test on curated sentences. Standard scoring: typed char advances even if wrong, Backspace corrects. Gross WPM = (cursor position ÷ 5) ÷ minutes (entries that advanced the cursor and were not backspaced; a corrected slip counts once), Net WPM = gross − (uncorrected errors ÷ minutes), accuracy = correct keystrokes ÷ keystrokes (Backspace excluded). Results show error keys on the keyboard and the last-10 trend.

## Coaching (light touch, `coaching.json`)
Posture card before the first lesson (feet flat, wrists floating, sit tall, eyes on the screen). "Home row is home" after lesson 5. Result tips keyed to what happened (accuracy < 90% → slow down; one key ≥ 3 errors → that key's finger reminder; ≥ 97% → push speed). Weak-key drill offered from the error map (TEST results and LEARN hub).

## Keyboard model
US QWERTY, five rows, finger map (left pinky through right pinky, thumbs = space), opposite-hand Shift for capitals. `src/keyboard.js` renders it as DOM keys; the engine highlights next key + shift when needed; error flashes in red; finger legend under the keyboard.

## Desktop gate
Touch-primary or < 800 px wide → "Quick Fox needs a real keyboard" screen with a link to the arcade and an "I have a keyboard" override.

## Art / sound
In-code pixel fox (idle 2 frames, cheer, sad, zap pose), tower, word bubbles. WebAudio: soft key tick, error buzz, zap, star ding, lesson chime, fanfare. UI fonts from Google Fonts.

## Data
`lessons.json`, `words.json` (≈420 kid-safe common words), `sentences.json` (≈50 sentences + pangrams, written for this project), `coaching.json`, `config.json` (timings, arcade speeds, star thresholds).

## Debug (`?debug=1`)
`window.QFS` state; `QF.type(text)` feeds keystrokes through the real handler; `QF.step(sec)` advances the arcade sim; `QF.dbg.{profile, unlockAll, results}`.
