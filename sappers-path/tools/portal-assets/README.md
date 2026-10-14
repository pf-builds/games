# Portal assets (lane P Stage 5): CrazyGames covers and preview videos

Scripts only; the media they make stays out of the repo (it lived in the session scratchpad, `stage5/covers/` and `stage5/video/`).
Run from this folder with a local server on the game (`serve.py <port> <sappers-path dir>`; capture.mjs defaults to `http://127.0.0.1:8517/`)
and `PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs`.

1. `python3 prep-art.py <art dir>`: the home painting cut to each cover size from the original 1344x768 render (prints each scale).
2. `node capture.mjs --plan board.json --orient land --out <dir> --board`: the Goblin King's board mid-dig at 3x (cover C's card; crop it to `<art dir>/board.png`).
3. `node compose.mjs --game .. --art <art dir> --out <covers dir>`: covers A, B, C in 1920x1080, 800x1200, 800x800 (title in the game's Jersey 10, only text on them); `--opts A --sizes port --scale 1.35` makes the portrait video's 1080x1620 first frame.
4. `python3 sheet-covers.py <covers dir>`: 200x112 previews and the contact sheet, with a size check.
5. `node capture.mjs --plan shots.json --orient land|port --out <frames dir>`: real gameplay frames on sim time (the rAF loop held, SP.tick per frame, CSS animations stepped with it; taps refusal-free; no cursor, no debug row). `--preview` samples every 6th frame at 1x for picking segments.
6. `python3 assemble.py <cover.png> <frames dir> <out.mp4>`: cover held 1 s, 0.4 s crossfade, hard cuts; H.264 High yuv420p 30 fps, no audio; prints the stream facts, blackdetect, frame 0 vs cover PSNR, stills at 0/5/10/15 s. `sheet.py` tiles any frame folder.
