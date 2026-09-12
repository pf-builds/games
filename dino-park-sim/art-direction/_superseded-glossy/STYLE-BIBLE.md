# Dino Park — Art Direction / Style Bible (Phase 3 reference)

*Generated 2026-09-10 with the local image stack (SDXL base 1.0, OpenRAIL-M, commercial-OK), run on Peter's Mac. These are DIRECTION and REFERENCE for the Phase 3 pixel-art pass, not shippable assets. For another Claude Code (build) instance to use in its design window.*

## The one rule that governs everything

**These are reference, not drop-in sprites.** This game renders at 640×360, `image-rendering: pixelated`, in a 2.5D oblique projection with in-code art. The images here are high-resolution illustration. Do **not** paste them into the game. Use them to set the look, then author the actual pixel sprites (in-code or hand) at the game's real scale, palette, and projection. Pointing an image model at "a Triceratops sprite" gives a lovely illustration that will not sit on the tile grid — the pixel craft still has to happen. AI sets the target; it does not produce the final asset.

## Target look (pin this)

Cozy retro tycoon. Bright, clean, readable, warm daylight, family-friendly — the DinoPark Tycoon / RollerCoaster Tycoon / Two Point lineage, fitting the edutainment positioning. **Not** gritty, dark, or photoreal. Soft cel shading, vibrant but grounded palette. The four scene pieces below nail this tone; treat them as the mood anchor.

## Files

Scenes (mood + composition + palette targets):
- `park-hero.png` — overall park read: oblique bird's-eye, enclosures, paths, tiny visitors, parking, food/gift buildings.
- `biome-desert.png` — desert enclosure: sandy dunes, red rock, ochre/tan palette.
- `biome-swamp.png` — swamp enclosure: murky green water, reeds, wooden structures.
- `biome-plains.png` — plains enclosure: green fields, sauropods, a facility building.

Dinosaur references (form + proportion + palette, 4 of the ~24 species):
- `dino-triceratops.png`, `dino-tyrannosaurus.png`, `dino-stegosaurus.png`, `dino-brachiosaurus.png`

Montage: `_style-bible-montage.png` (all eight at a glance).

## Known caveats (be honest with these)

- **`dino-tyrannosaurus.png` has a garbled fake title/logo floating above it** — an AI text artifact. Ignore it; it is not part of the reference.
- **The four dinosaurs are NOT a consistent model sheet.** They vary in scale, angle, and background because they were generated without pose control. Treat them as form/proportion/palette mood, not a precise turnaround. Scale them to the game's own size tiers per `data/dinosaurs.json`.
- Species facts and accuracy stay authored (Claude/you), not model-invented.

## Next capability to unlock this properly: ControlNet

To get a **true consistent reference sheet for all ~24 species** (one locked oblique pose and scale, plain background, so they read as one roster), the local stack needs **ControlNet + inpainting** added (SDXL ControlNet, ~5–10GB, runs fine on the 48GB Mac). Feed every species through one fixed oblique-pose template and they come back aligned. Recommend installing that before the full 24-species reference pass. These four are a style test, not the final sheet. Ask Peter to have the image-stack session add ControlNet when ready.

## Palette guidance

Pull per-biome base colors from these references and reconcile with the biome colors already in `data/parcels.json`. Keep a limited palette per biome (the pixel pass will palette-limit anyway): desert = ochre/tan/red-rock; swamp = murky green/brown; plains = fresh green.

## Audio plan (the same visuals-phase upgrade, for sound)

- **Add background music — highest impact-per-effort feel upgrade, and the game currently has none.** A calm, loopable park-ambience bed transforms how a management sim feels (the RollerCoaster Tycoon effect). **Try a CC0 / royalty-free track first** (e.g. incompetech / Kevin MacLeod, FMA) for guaranteed loopability and a clean license; optionally experiment with the local **Stable Audio Open** model for a bespoke bed (verify its license before shipping). Wire it to the existing sound toggle in Settings.
- **Keep jsfxr for SFX** (click, buy, cash, alert, fanfare) — it fits the retro pixel aesthetic and is already the plan. **Exception: the ROAR.** A synth roar sounds like a laser; use a real CC0 dinosaur/animal roar sample instead.
- **Optional: narration.** If leaning into the education/classroom angle, a calm narrator (local **Kokoro TTS**, Apache, commercial-OK) reading the tutorial/tooltips adds polish. Optional, on-theme.

## Regenerating / extending

Local stack lives at `/Users/peter/local-ai/` (outside any repo). The generator for this set is `local-ai/dinopark_bible.py` — edit the prompt lists and rerun to add scenes/species. Full capability map: Peter's memory note `local-ai-image-stack.md`. Model used here: SDXL base 1.0 (commercial-safe). For the gritty-vs-cozy lesson: style is mostly the model + prompt tone; this cozy look came from "cozy isometric tycoon … family friendly" with a negative prompt pushing away gritty/dark/photoreal.

## Deploy hygiene

`art-direction/` is design reference, **not shipped game assets**. Exclude it from the served build / add to `.gitignore` so ~15MB of concept PNGs don't deploy to GitHub Pages. (Left for the build instance to handle per this repo's deploy rules.)

## Provenance / licensing

Generated locally with SDXL base 1.0 (CreativeML OpenRAIL-M, commercial use permitted with standard use-based restrictions, no royalty). Safe as reference and to inform owned pixel art. Log provenance per the studio's copyright-registration practice (`studio-division.md`): AI-assisted with human direction and editing → the authored pixel art is owned.
