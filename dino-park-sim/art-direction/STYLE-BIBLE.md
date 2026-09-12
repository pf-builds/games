# Dino Park Sim — art style bible (v2, VGA pixel) — 2026-09-11

**Direction:** early-1990s DOS VGA tycoon look. Chunky pixels, ~32-colour dithered palette, vibrant saturated colour, 3/4 oblique sprites on a plain ground. Matches the *era and style* of the classic this game is inspired by — never its actual sprites.

**Pipeline (validated 2026-09-10/11, local, free):** SDXL base 1.0 (OpenRAIL-M, commercial OK) + `nerijs/pixel-art-xl` LoRA → saturation ×1.35 → LANCZOS downscale (96 px sprites / 192–256 px scenes) → adaptive 32–48-colour palette with Floyd-Steinberg dithering (this is what gives the VGA feel) → NEAREST upscale for viewing. Script: `/Users/peter/local-ai/dinopark_vga_batch.py`. Outputs: `art-direction/vga/` (sprites + 5× previews + montage + `_provenance.json`); 1024-px raws stay outside the repo.

**Colour rule:** every species gets a directed, distinct colour (the model defaults to samey orange/green). The 24 assignments live in the batch script and `_provenance.json`.

**Chunkiness knob:** 96 px / 32 colours reads SNES-to-VGA. Blockier = smaller px, fewer colours.

**These are base sprites, not finals.** Plan a light Aseprite cleanup per species (signature features, consistent angle/scale, fit to the game's size tiers and the oblique projection). ControlNet is available if uniform angle/scale across the sheet is needed.

**Provenance / legal:** no original-game screenshots are used as input anywhere (no img2img, no ControlNet reference). AI-assisted with our direction and editing; authored pixel art is ours. Keep this note current.

**Superseded:** the glossy/modern concept set (`_superseded-glossy/`, 2026-09-10) was the wrong direction; kept for the record only.
