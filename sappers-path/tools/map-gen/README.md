# Journey map art (v5 R3, piece 1)

Twenty-five painted parchment sheets (13 in R3, sheet 13 repainted and 14-25 added in v5 R4c), read bottom to top, in the style Peter picked on 2026-10-04 (style B, seed 61:
`game-research/sappers-path-v4/map-mockups/README.md`). The road is placed in code, so every node, quest and egg spot is
known before anything is painted. No text in the art.

Everything tunable is in `plan.json`. The scripts run with `/Users/peter/local-ai/.venv/bin/python`.

| File | What it does |
|---|---|
| `plan.json` | Sheet size, overlap, road shape, realm palettes, features, prompts, strengths, assembly settings |
| `guide.py` | Draws the whole map as one tall 768×16,512 image (13 sheets, 80 px overlaps) and cuts it into sheets: `base-NN.png` (land only), `road-NN.png` (road layer, RGBA), `sheet-NN.png` (both). Writes `guide-layout.json` (nodes, quest spurs, egg hints, road centreline per sheet). Deterministic. |
| `paint.py` | ONE SDXL image per run. `base` mode paints the land guide; `road` mode lays the road layer over a picked land painting and paints that. |
| `run.sh`, `batch.sh` | One run plus a memory check (`memory_pressure`, `vm.swapusage`) into `logs/`; a job list run strictly one at a time. |
| `picks.json` | The land painting and the road painting picked by eye for each sheet. |
| `assemble.py` | Picks → `map/sheet-NN.webp` (JPEG until v6.3; v7 lane T re-encoded them to WebP, the land sheets' rule), `map/layout.json`, `contact.png`, `contact-seams.png`, `fidelity.json`. |

Full-size candidates, composites and guides live in `/Users/peter/local-ai/outputs/sapper-v5-map/` (not in git).

## Why two passes (the tuning on sheet 1)

One-pass img2img on the coded guide, the brief's starting point, kept the road at 0.65-0.78 but the look came out flat and
cartoonish, not seed 61. At 0.86 the look got close but the road broke up. Busier guides (grass tufts, lone trees) made
the road drift even at 0.72-0.76. So each sheet gets two runs, both SDXL base 1.0 img2img with the same weights:

1. **Land pass** (`base`, strength 0.82): the land guide with no road, and the realm prompt without its road phrase. This
   gives the seed-61 ink-and-wash parchment look, loosely following the guide's biome fields, rivers and forests.
2. **Road pass** (`road`, strength 0.52): the coded road layer (ink edges, pale dirt, spurs, clearings) laid on the land
   painting, painted in at low strength so it stays where we put it.

Then `assemble.py` lays the coded road back over the painting in the top and bottom 80 px (fading out by 170 px), so the
road always meets the seam at x = 384, and bakes an 80 px crossfade into each sheet's bottom rows. Draw sheet k+1 over
sheet k, 1,264 px higher; no mask needed. Nodes and the road centreline are then nudged onto the painted road (centroid
of road-coloured pixels within 22 / 16 px); eggs are found by colour and ink density (water for fish, calm ground beside
busy ink for woodpiles and mushrooms, grey rock for ravens and glints, open meadow for grass) and fixed by hand where the
eye check said so (`plan.json` `manual`).

Measured on sheet 1 (guide road vs painted road): one pass 0.65 kept the road; 0.72 and 0.76 drifted; 0.86 lost it. Two
passes with the road pass at 0.50-0.55 kept it; 0.58 drifted about 50 px at both ends. The quest spurs are thin and the
road pass usually paints them over; the quest node coordinates come from the guide (a clearing beside the road), and the
map screen should draw the detour itself (the mockup's stepping stones).

## Prompts and settings

- Model `stabilityai/stable-diffusion-xl-base-1.0`, fp16 on MPS, `StableDiffusionXLImg2ImgPipeline`; 40 steps, guidance 7.0;
  768×1344. Never SDXL-Turbo. About 20 s per image plus 2 s load.
- Prompt = `stylePrefix` + the realm prompt (both in `plan.json`); the land pass drops `roadPhrase`.
- Negative prompt (`neg`): the mockup's heavy text negative plus "calligraphy, stamp". Reject any candidate with fake
  lettering, a signature, a compass rose, a cartouche or a frame.

## The 13 sheets (picked 2026-10-04)

Land seeds 61-66, road seeds 71-72. Road fidelity = share of the coded road's centreline samples (outside the restore bands) where the painted pixel is within 40 RGB of the coded road; the quest spurs and fog pull it down. JPEG quality 94, total 3670 KB.

| Sheet | Realm | Levels | Quests (picture # after level) | Land pick (of N) | Road pick (of 2) | Road fidelity | JPEG | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 The Greenmarch | 1-8 | 1 after 4, 2 after 8 | `base-01-s61-st82.png` (2) | `sheet-01-s72` | 0.927 | 283 KB |  |
| 2 | 1 The Greenmarch | 9-16 | 3 after 11, 4 after 16 | `base-02-s61-st82.png` (2) | `sheet-02-s72` | 0.943 | 265 KB | land s62 rejected: fake text block |
| 3 | 1 The Greenmarch | 17-24 | 5 after 20, 6 after 24 | `base-03-s61-st82.png` (2) | `sheet-03-s72` | 0.789 | 272 KB |  |
| 4 | 2 Fenwater Vale | 25-32 | 7 after 27, 8 after 32 | `base-04-s61-st82.png` (2) | `sheet-04-s72` | 0.875 | 277 KB |  |
| 5 | 2 Fenwater Vale | 33-40 | 9 after 36, 10 after 40 | `base-05-s61-st82.png` (2) | `sheet-05-s72` | 0.881 | 275 KB | land s62 rejected: text box |
| 6 | 2 Fenwater Vale | 41-49 | 11 after 43, 12 after 48 | `base-06-s62-st82.png` (2) | `sheet-06-s72` | 0.901 | 251 KB | edge line mirrored out |
| 7 | 3 The Ironhollows | 50-58 | 13 after 52, 14 after 56 | `base-07-s64-st82.png` (4) | `sheet-07-s71` | 0.953 | 305 KB | first 2 lands too red (old prompt); road s72 rejected: fake text; edge line mirrored out |
| 8 | 3 The Ironhollows | 59-66 | 15 after 59, 16 after 64 | `base-08-s64-st82.png` (4) | `sheet-08-s71` | 0.917 | 312 KB | first 2 lands too red / perspective peaks |
| 9 | 3 The Ironhollows | 67-74 | 17 after 68, 18 after 72 | `base-09-s64-st82.png` (4) | `sheet-09-s71` | 0.89 | 294 KB | first 2 lands too red; s62 had a text cartouche |
| 10 | 4 Twinspire Reach | 75-82 | 19 after 75, 20 after 80 | `base-10-s62-st82.png` (2) | `sheet-10-s71` | 0.956 | 295 KB | painted frame edge mirrored out |
| 11 | 4 Twinspire Reach | 83-90 | 21 after 84, 22 after 88 | `base-11-s61-st82.png` (2) | `sheet-11-s71` | 0.956 | 300 KB |  |
| 12 | 4 Twinspire Reach | 91-99 | 23 after 91, 24 after 96 | `base-12-s61-st82.png` (2) | `sheet-12-s72` | 0.875 | 269 KB | land s62 rejected: text; a lettering-like frieze on a wall blurred (retouch) |
| 13 | 5 The Mistmoor | 100-100 | 25 after 100 | `base-13-s62-st82.png` (6) | `sheet-13-s72` | 0.852 | 272 KB | s61, s63-s66 came out as landscapes with horizons; kept s62 (top-down, fog on top); road ends in the fog off-centre (roadEnd) |

Prompts drifted during the session: sheets 7-9's first lands used a "rusty red veins" prompt (too red, rejected), and sheet 13's kept land (s62) used the earlier Mistmoor prompt with "dead trees" and "thick pale fog" at 0.82; `plan.json` now holds the later prompts. Every run's exact prompt is in its log.

SDXL runs in all: 77 logged in `logs/` (sheet-1 tuning included; 76 images, one run stopped when I caught a wrong default strength), plus one text-to-image test of the land prompt (it painted seed 61's frame, so text-to-image bases were dropped). One image per run; `memory_pressure` stayed 64-85% free and swap at 0 throughout.


## Adding a realm (R4 needs four more)

1. Add the realm to `plan.json` `realms`: name, prompt (made-up places only, no real history), two base colours, features
   (counts of forest, pines, river, marsh, pond, farm, stockade, motte, hills, crag, keep, hold, deadtrees; add a new
   drawer in `guide.py` for a new kind), egg kinds, and its sheets (level ranges, about 8-9 levels and 2 quests each).
   The Mistmoor's `fogFrom`, `stopTop` and `goblinKing` move to whichever sheet becomes the top.
2. `python guide.py`. New sheets go on top; the road's control points for earlier sheets come first in its seeded
   sequence, so earlier road, node and quest positions stay put (diff `guide-layout.json` to confirm). The colour noise
   is sized to the whole tall map, so earlier land guides change slightly; that doesn't matter, they're already painted.
3. For each new sheet: `./run.sh base <n> <seed>` two or three times, pick the land by eye; then
   `./run.sh road <n> <seed> <outputs>/base-NN-sSEED-st82.png` once or twice, pick by eye. Check `memory_pressure` between
   runs (run.sh logs it); never run alongside another session's generation.
4. Add the picks to `picks.json`, run `python assemble.py`, look at the contact sheets (`plan.json` `out.contact`), fix any egg or
   node by hand in `plan.json` `manual`, and re-run.
5. The old top sheet's upper edge (the Mistmoor fog) will need repainting once a realm sits above it.

## v5 R4c: realms 5-8, levels 100-200 (2026-10-05)

Sheet 13 was repainted (no fog: the road now runs on at x = 384) and sheets 14-25 added, same two-pass pipeline, SDXL base
1.0 only, one image a run (69 runs, `logs/`, memory 65-85% free, swap 0 throughout). Candidates and guides:
`/Users/peter/local-ai/outputs/sapper-v5-map-r4/`. Sheets 1-12 keep R3's picks, guides and guide records (`plan.json`
`out.frozen`, `guide-layout-r3.json`), so `assemble.py` writes them byte-identical (md5 checked) and their layout records
unchanged. Contact sheets: `contact-r4.png`, `contact-seams-r4.png` (R3's `contact*.png` removed; they showed 13 sheets).

What changed in the tools: sheet-level keys for the top sheet (`tail`: the long tail's own stop, spaced like a level;
`tailFog`: the row the map screen's fog is full at; `fogFrom`, `stopTop`; `fortress` placed automatically as the biggest
clear disc near level 200; `goblinKing` between level 200 and the fortress gate; a sheet `prompt`); a realm `negExtra`
(added to the negative prompt); new feature drawers (lava, cone, basalt, watch, giant, glade, ring, huts, palisade,
fortress); each river or lava flow's road crossing written as a bridge hint; egg colour hosts for the new kinds (bubble on
lava, ember near lava, glowcap, owl in dense canopy, lookout beside huts).

Prompt lessons: "crags" and "fortress with towers" pull SDXL into perspective peaks and horizons; "seen from directly
above ... plateau of cracked basalt slabs" plus `negExtra` "mountains, peaks, spires, cliffs, side view" fixed the Crags. The
forest needed "canopy of round green treetops ... map of the woods" and "tree trunks, side view" in the negative; the first
two forest lands were side-on scenes. The fen needed "moorland of tussock grass ... many small dark still pools" (the fen
prompt made one big lake). The summit stays a perspective fortress (every seed drew one), like R3's castles on sheet 12; its
horizon sits under the map screen's fog.

| Sheet | Realm | Levels | Quests (picture after level) | Land pick | Road pick | Road fidelity | JPEG | Notes |
|---|---|---|---|---|---|---|---|---|
| 13 | 5 The Mistmoor | 100-107 | 25/100, 26/104, 27/107 | `base-13-s63-st80` (6) | s72 (2) | 0.826 | 277 KB | repainted; fen prompt lands rejected (one lake, text, frame) |
| 14 | 5 | 108-116 | 28/112, 29/116 | `base-14-s65-st80` (2) | s72 | 0.793 | 289 KB | |
| 15 | 5 | 117-124 | 30/120, 31/123 | `base-15-s63-st80` (2) | s72 | 0.826 | 264 KB | s65 had a frame edge |
| 16 | 6 Emberwatch Crags | 125-132 | 32/128, 33/132 | `base-16-s61-st82` (4) | s72 | 0.680 | 256 KB | 3 perspective/frame lands rejected; pale road on dark rock reads low |
| 17 | 6 | 133-140 | 34/136, 35/139 | `base-17-s63-st82` (2) | s72 | 0.863 | 272 KB | |
| 18 | 6 | 141-149 | 36/144, 37/148 | `base-18-s63-st82` (2) | s72 | 0.685 | 259 KB | |
| 19 | 7 The Shrouded Weald | 150-157 | 38/152, 39/155 | `base-19-s63-st82` (4) | s72 (2) | 0.829 | 299 KB | first two side-on forests rejected |
| 20 | 7 | 158-165 | 40/160, 41/164 | `base-20-s63-st82` (2) | s72 | 0.964 | 296 KB | a pale stream near the top reads like a fork |
| 21 | 7 | 166-174 | 42/168, 43/171 | `base-21-s63-st82` (2) | s72 | 0.861 | 300 KB | |
| 22 | 8 The Goblin King's Throne | 175-182 | 44/176, 45/180 | `base-22-s63-st82` (4) | s72 | 0.941 | 286 KB | badlands prompt lands were perspective cliffs |
| 23 | 8 | 183-190 | 46/184, 47/187 | `base-23-s61-st82` (2) | s71 (3) | 0.969 | 291 KB | road s72 broke mid-sheet (levels 185-186 off road) |
| 24 | 8 | 191-197 | 48/192, 49/196 | `base-24-s63-st82` (2) | s72 (2) | 0.797 | 286 KB | |
| 25 | 8 (summit) | 198-200 + the long tail | 50/200 | `base-25-s61-st82` (6) | s72 (4) | 0.695 | 277 KB | fortress left of 200; above the tail the painted road turns right, under the fog |

Map art total 7,057 KB (25 sheets). Bridges by eye on lava (stone): see config `map.bridges`; the Mistmoor's road runs on
causeways and the Weald's streams run beside the road, so neither got bridges.
