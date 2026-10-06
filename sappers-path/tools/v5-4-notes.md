# Sapper's Path v5.4: Reset progress and the save code

Peter approved both on 2026-10-06. Also in this pass (the orchestrator, same day): share-card tags in `index.html`.
SPEC-v4 §9 has the decision entry. No rule, level or engine change.

## What a player sees

Settings (gear on the home or the map), top to bottom: Music, Sound effects, (Speed, debug only), Colour-blind marks,
**Copy save code**, **Load save code**, Done, then a hairline and **Reset progress** in quiet red text (no button face).
Each of the three opens a sheet in Settings' place; closing it (its button, the backdrop or Escape) goes back to Settings.

- **Reset progress.** The sheet says what goes ("every level won, your coins, power-ups, side quests, easter eggs and
  best times. You start again at level 1"), what stays (Music, Sound effects, Colour-blind marks) and, when the save code
  is on, "Copy your save code first". A red **Hold to reset** button and a gold **Cancel** (focused on open). Press and
  hold for 1.5 s (`reset.holdMs`): a darker fill runs left to right and the label reads "Keep holding..."; letting go,
  sliding off, a blur or Escape before the end empties it and nothing happens. Mouse, touch, and Space or Enter held
  (keyboard) all work. On the end: progress cleared, the home at Level 1, toast "Progress reset. Back to level 1."
- **Copy save code.** The sheet shows the summary ("Level 91, 218 coins, 12 side quests"), the code in a read-only box,
  its length ("575 characters") and the result: "Copied to the clipboard." or, where the Clipboard API is missing or
  refused (iframes, older Safari), `execCommand("copy")` on the selected box, and failing that "Couldn't copy here.
  Select the code and copy it." with the box selected. A **Copy** button tries again.
- **Load save code.** An empty box. Every change is read at once: wrong text says why ("That code has a typo or a missing
  piece. Copy the whole code again.", "That isn't a Sapper's Path save code", "from a newer version"); a good code
  shows what it holds in green and, under it, "Loading replaces the progress on this device (Level 1, 400 coins, 0 side
  quests). Your sound and colour-blind settings stay." Only then is **Replace** enabled. Applying: the home at the
  loaded level, toast "Save code loaded: Level 91, 218 coins, 12 side quests."

## The code (save.js encode, decode)

`SP1.` + base64url (no padding) of a binary body plus its CRC-32 (4 bytes, big-endian). The body is unsigned LEB128
varints: format v; coins; inventory (count, then POWERS order); got (a bit per power-up); cleared levels (count, then
each as a slot-number step from the last, in slot order, with its best row); cleared pictures (the same, by place in the
Gallery's order); eggs (count, then sheet and i); last (slot, 0 none); lives n and at. Format 1 bodies (difficulty masks,
7-number best rows, coins and lives with a presence flag) are written and read too, so an older save inside a code
migrates.

- Why binary and not JSON: the best rows are most of a save. JSON of a mid-game save is about 3 KB (about 4 KB as
  base64); the varint body is about 6 bytes a level. Deflate would only shave the JSON, and CompressionStream is
  async (no sync path for selfTest). No dependency.
- Levels go by slot number, not id, so the v5 R3 rule (a renamed id counts as the level in its slot) holds for codes too,
  and the code is shorter.
- Preferences are not in the code. A load keeps the device's own (`Save.withPrefs`), same as a reset.
- **Lengths:** a new save 31 characters; levels 1-90 won by `SP.unlockTo` (no best times), 12 side quests: 575; a real
  mid-game save with best times on all 90 levels and 12 pictures, 10 eggs: 934 (test limit 1,100); everything cleared
  with bests (200 levels, 60 pictures): 2,459.
- **Validation:** whitespace removed (wrapped pastes work); `SP<n>.` prefix (n > 1: "newer"); strict base64url and the
  text must be the canonical encoding of the bytes it decodes to (so the spare low bits of the last character can't
  change unseen); CRC-32; the body must read to its end exactly, every varint at most 8 bytes, every count bounded by
  the bytes left; then `Save.sanitize` as for any stored save (clamped to the caps, unknown slots and pictures dropped,
  bad eggs dropped, `last` only if open). Paste read to `saveCode.maxPaste` (20,000) characters. decode never throws.
- **The checksum catches mistakes, not cheating.** Anyone can decode a code, change it and recompute the CRC. That is
  fine while coins are free; a hand-edited code can still only hold what sanitize allows (coins at most 9,999,999,
  power-ups 99 each, real level and picture ids). If coins ever cost money, codes need a signature or must go.

## Reset (save.js reset)

`Save.reset(sv, meta)`: `sv.data` becomes a fresh save with the old `settings` (music, sfx, muted, cb, speed), written
at once, then `Save.cloud.reset(key)` if a build set it. **CLOUD HOOK:** `Save.cloud = { reset: null }` on the web; the
CrazyGames build (its own cloud save) sets it so the cloud copy is cleared too. A throwing hook never undoes the local
reset (tested). The page has one path to it, `main.js resetNow`. Fresh means 400 coins and every power-up's free unlock
use again, the same as a new player.

## Per-build switch

`config.json saveCode.on` (true, the pf-builds web build) shows the two code rows; `saveCode.portalOn` (false) is the value
the portal build sets `on` to, since CrazyGames keeps its own cloud save. With it off the rows and the reset sheet's
"copy first" line are hidden and a load can't be applied. Reset is on in every build.

## Timing and loops

The hold runs on `app.clock` (step's `holdStep`, a DOM write per frame only while held), never a timer. Copy's clipboard
promise only writes a status line. Toasts on the home or map now sit over the screens (`#toast.over`, fixed, z 45,
under the logo) and hide on the game clock there too (they never hid off the play screen before; the lives toast had the
same latent bug).

## Layout

- Settings card: 543 px tall with the debug speed row (485 without) at 375x812 and 360x640: fits, no scroll. A
  `.modal .sheetcard` taller than its screen scrolls inside itself. A short wide window (max-height 480, min-width 600:
  the harness's 812x375) lays the rows two to a line (313 px, no scroll); a phone held sideways shows the upright card
  as before.
- Tap targets: rows 50 px (44 in the short layout), Done 48, Reset 44, hold 54.
- Contrast (measured, tools/shots-v5-4.mjs): Reset row 6.74:1, sheet text 7.45:1, hold label 5.84:1 on red and 10.79:1 on
  the fill, error 6.74:1, ok 6.52:1, code box 15.07:1, toast 13.85:1.

## Share card

`og:title`, `og:description` (the meta description), `og:image` + `og:image:width/height` (800x450), `twitter:card`
summary_large_image and `twitter:image`, all pointing at `https://pf-builds.github.io/games/sappers-path/thumb.jpg`
(no cache tag: the absolute URL the orchestrator gave). The playtest bundle drops the head wrapper; the tags then sit in
the body, harmless.

## Checks

- `node tools/test.js`: v5.4 section, 19 checks: round trip of a mid-game save, a new one and a full one (bit-exact, and
  re-encoding gives the same code); Node's base64url and zlib's CRC-32 agree; all 930 single-character changes rejected;
  truncations (1, 2, 3, 5, 40 short, just the start), an extra and a dropped character rejected; SP2. = newer; junk input
  never throws; wrapped pastes; maxPaste; a hostile code with a valid CRC (9e15 coins, inventory 500 and 1e12, unknown
  slots 9999 and 10006, picture 401, eggs s5000-1 and s1-777, a locked last level, lives time past the cap) loads
  clamped; five wrong-shaped bodies with valid CRCs refused (format 7, cut mid-field, a byte past the end, an endless
  varint, a count past the body); the shipped v3 and v4.2 saves (format 1) made into codes load exactly as they load from
  storage; reset keeps prefs, clears the rest, writes, calls the hook; a throwing hook; config and index.
  "Wrong types" can't be written in a binary body; the shape tests are its version of that.
- `SP.selfTest()` section 26: settings rows and fit; reset Cancel, an early let-go at 60%, a full pointer hold and a full
  Space hold (each 1,504 ms of game clock); copy (clipboard faked, then refused: box selected) then reset then load
  (changed, truncated, other text, newer refused; the wrapped code previews and restores the save exactly).
- `tools/shots-v5-4.mjs` (real input, 4 viewports): the real clipboard read back after Copy, a real Cmd+V paste into
  Load, real 0.8 s and 1.75 s mouse holds, the contrast list above. 0 fails, 0 console messages.
- Pre-existing, not from this pass: at 400x600 and 812x375 with deviceScaleFactor 1, selfTest's colour-blind check
  counts 8 and 6 marked materials, not 12 (same on the v5.3 build, 4d549b4). The harness runs 812x375 at 3x, where it
  passes.
