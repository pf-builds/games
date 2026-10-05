# Sapper's Path v5.2: music

2026-10-06. Peter picked the tracks and approved the downloads. One soundtrack by one composer (Juhani Junkala, CC0), a Kenney win jingle (CC0), and separate on/off for music and sound effects. No rule, level or engine change. SPEC-v4 §9 has the decision entry; LICENSES.md has a row per file.

## Track per screen

| Screen | Track | File | Source |
|---|---|---|---|
| Home, map | theme | `audio/theme.m4a` | "JRPG Theme [Loop Ready]" (opengameart.org/content/jrpg-trailer-theme) |
| A level 1-174, any side quest, debug levels | play | `audio/play.m4a` | "Calm2 - Childhood Friends", JRPG Pack 4 Calm |
| Levels 175-200 (realm 8, the Goblin King's Throne, incl. 200) | boss | `audio/boss.m4a` | "Evil4 - Witch's Lair", JRPG Pack 3 Evil |
| A win's sheet | jingle over the ducked loop | `audio/jingle-pizzi10.m4a` | Kenney Music Jingles, `jingles_PIZZI10.ogg` |

Routing is `audio.js` `pick(music, screen, entry)`: `music.screens` per screen, then a main-campaign level whose era is in `music.bossRealms` ([8]) takes `music.bossTrack`. `main.js` `music()` asks for it on every `showScreen` (the same track carries on; a change crossfades over `fadeMs` 800). After a win, "Back to map" brings the theme back. Retry keeps the loop going.

## Loop points (seconds of the encoded file)

Each loop is its whole source file. The two packs' files are exact whole bars (Calm2: 4,536,000 samples = 24 bars at 56 bpm; Evil4: 3,528,000 = 40 bars at 120 bpm; tempo measured by onset autocorrelation and repeated sections). The theme's page says it loops seamlessly; its repeats measure 82 bpm and the file is 135.96 beats (26 ms short of 136), so the file's own seam is used as its author made it.

| Track | loopStart | loopEnd | Loop | Seam step (source) | Fix | gain |
|---|---|---|---|---|---|---|
| theme | 0.25 | 99.735692 | 4,387,319 samples | 0.014 vs 0.15 around | none | 0.47 |
| play | 0.25 | 103.107143 | 4,536,000 | 0.049 vs 0.014 around (a click) | 256-sample raised-cosine DC ramp on the loop's end | 1.2 |
| boss | 0.25 | 80.25 | 3,528,000 | 0.44 vs 0.63 around (inside a drum hit at the downbeat) | none | 0.5 |

How the seam stays exact: `tools/music-encode.py` writes each file periodic around the loop: the loop's last 0.25 s, the loop, its first 0.5 s. AAC adds 2112 samples of priming; Chrome and Safari may or may not trim it. With the audio on both sides of each loop point being the same music, a constant offset up to 0.25 s still loops exactly the right length. (Measured: ffmpeg trims the priming; headless Chromium decodes 960 fewer padding samples; both loop the same.)

Seam verification on decoded buffers, not by ear (the loop against itself one period on, dB of the difference under the signal; then the same 37 samples off, to show the check can tell; then the sample step across loopEnd -> loopStart against the biggest step in the 10 ms around it):

| Track | ffmpeg decode | Chromium 44.1 kHz | Chromium 48 kHz (page's live buffer) | 37 samples off | step / around |
|---|---|---|---|---|---|
| theme | -15.8 dB | -16.2 dB | -16.2 dB | +0.2 / -0.5 dB | 0.024 / 0.18 |
| play | -23.3 dB | -22.1 dB | -22.1 dB | +0.4 / -0.2 dB | 0.0075 / 0.013 |
| boss | -17.1 dB | -15.4 dB | -15.4 dB | -1.4 / -1.2 dB | 0.28 / 0.53 |

The in-period error equals the AAC codec's own waveform error at 96 kbps (decoded against the source: theme -17.9, play -23.1, boss -18.9 dB), so the two copies differ by codec noise only. `SP.musicCheck()` repeats this in the browser; the harness asserts it.

## Jingle

Kenney's pack has no jingle in the brief's 2-5 s range: every one runs 0.4-1.6 s. Chosen by analysis (length, key fit to major/minor profiles, pitch contour, spectral brightness), Pizzicato or Steel only:
- **Picked: `jingles_PIZZI10`** (0.83 s): a rising D-E-F#-G run, major (key fit 0.61), bright pizzicato strings that sit with the orchestral JRPG loops.
- Spare 1: `jingles_PIZZI15` (0.83 s): major (0.73), rising a fourth overall.
- Spare 2: `jingles_STEEL10` (0.95 s): the same melody as the pick on steel drums, a little longer ring.

All three are shipped (11-13 KB each). Only the one config names is fetched. **To swap:** set `audio.music.tracks.win.file` to `audio/jingle-pizzi15.m4a` or `audio/jingle-steel10.m4a`. The win ducks the loop to `duck.gain` (0.25) of its level over `inMs` (120 ms), plays the jingle at `tracks.win.gain` (0.8), holds `holdMs` (250 ms) after it ends, then brings the loop back over `outMs` (1.5 s). All on the AudioParam timeline, no timers.

## Volumes

- Effects bus: `audio.volume` 0.5 (unchanged). Music bus: `audio.music.volume` **0.4**.
- Per-loop `gain` evens the three loops to about RMS 0.12 (source RMS theme 0.257, play 0.100, boss 0.241). Music off/on fades over `toggleMs` 150 ms.

## Playback and loading

- `audio.js` gains a music bus, `want`/`pick`/`kick`/`jingle`, `setSfx`/`setMusic`/`quick`/`state`, `hushed` (selfTest runs with the music bus silent), `info` and `seam`. It is UMD now (like `save.js`) so Node tests `pick` and the switches.
- The AudioContext is still created only inside a gesture (`pointerdown`/`keydown`, plus a `click` capture, since Chrome counts a touch's activation on its click). Nothing is fetched before that. Then the wanted track is fetched at once; the rest (`music.order`: theme, play, win, boss) one at a time while nothing else is in flight. With Music off nothing is fetched.
- Blur, a hidden tab or the upright card suspend the whole context, as before; resume brings music back with the game.
- Any failure (no Web Audio, fetch or decode refused) marks that track failed and plays nothing; no console output.
- Payload (local server, headless Chromium): bytes before the first tap 1,738,349 (v5.1) -> 1,760,494 (v5.2): +22 KB of code and config, 0 audio requests. After the tap, 3.48 MB of music arrives in the background (the alternates never load).

## Settings

- Settings sheet: the old Sound row is replaced by **Music** and **Sound effects** rows (`.tog-music`, `.tog-sfx`; pressed = on; read On/Off; a slash or cross when off).
- Saved as `settings.music` and `settings.sfx` (strict booleans, on by default). An older save has neither: both load as the opposite of its `muted`. `muted` is still written, as both off.
- Quick mute buttons (top bar, Paused sheet): with anything on, a tap turns both off; with both off, both on. They read `aria-pressed="true"` (both off), `"mixed"` (one off: only the inner wave shows) or `"false"`.

## How to swap a track

1. Put the new source in `/Users/peter/local-ai/outputs/sapper-music/` (or pass `--src`) and point its entry in `TRACKS` in `tools/music-encode.py` at it.
2. `/Users/peter/local-ai/.venv/bin/python tools/music-encode.py` (re-encodes everything; prints loopStart, loopEnd, gain and the seam numbers).
3. Copy loopEnd and gain into `config.json` `audio.music.tracks.<name>`; run `--check`; bump the cache tag.
A loop source must loop as a whole file. One with an intro needs a start offset added to the script.

## Files

`audio/*.m4a` (AAC-LC, 96 kbps, 44.1 kHz stereo, 3,505,381 bytes for all six), `tools/music-encode.py`, `src/audio.js`, `src/main.js`, `src/save.js`, `config.json` (`audio.music`), `index.html`, `style.css`, `tools/test.js`, `tools/harness.mjs`, `tools/playtest-bundle.py` (carries `audio/`), `LICENSES.md`, `LATER.md`, `SPEC-v4.md`.

## Results
Code commit `270d678`.
- `node tools/test.js`: 581 passed, 0 failed (+12 checks: track per screen and realm, exactly 175-200 on the boss loop, the switches independent, quick mute both off then both on, no fetch without a gesture, effects off makes no sound, the save's music/sfx and old-save migration, config and files, the volume order, no timers in audio.js, one cache tag, the settings rows).
- `node tools/freeze.js --require`: PASS. `node tools/regrade.js`: 200 levels, 1155 checks, 0 differences. `--gallery`: 60 levels, 360 checks, 0 differences.
- `SP.selfTest()` under `?debug=1`: 774 pass / 0 fail at 375x812 (DPR 3), 776 / 0 at 1280x720 (+5 checks: no context or fetch before a gesture and the first fetch after it; the track per screen, level 1/174/175/200, a side quest and back to the map; crossfade, loop points, jingle duck, music and effects switches on an OfflineAudioContext; the settings rows and both quick mute buttons; the jingle once per win). selfTest runs with the music bus hushed.
- `node tools/harness.mjs`: all passed, 0 console messages, every viewport and the hidden-tab run (selfTest 774-776 pass, 0 fail). New: 0 audio requests and no context before the first tap; the play loop after it; the seams in Chromium's decoder; music/effects persistence and the mixed quick mute across reloads.
- `tools/music-encode.py --check`: all three loops pass.
- Payload: before the first tap 1,760,494 B (v5.1: 1,738,349; +22 KB code and config, 0 audio). The game folder without tools/: 25,155,264 B in git (v5.1: 21,604,770; +3.55 MB, the six audio files and code).
- Playtest bundle: `python3 tools/playtest-bundle.py 270d678 <scratch>/bundle-v52 --jump 4,101,175,200` carries `audio/` (no `?v=` left anywhere); `tools/playtest-smoke.mjs` on its `wrap.html`: OK at 375x812 and 1280x720, and the bundle loads all four music files and plays the play loop on level 1.
