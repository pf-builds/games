# Sapper's Path v3 fix pass notes

The single fix pass after the M2 critics (`tools/critic-v3-visual.md`: 6 majors, 12 minors; `tools/critic-v3-functional.md`: PASS, 4 minors). Every major is fixed, the cheap minors are fixed, and the rest are in LATER.md. Page: http://localhost:8491/sappers-path/ (`?debug=1` for `SP`). Build `?v=9`.

## Result

| Check | Result |
|---|---|
| `node tools/test.js` | 129 / 129 |
| `SP.selfTest()` | 530 pass, 0 fail (was 526; adds level 51 on Hard and the full-line verdicts) |
| `tools/harness.mjs` | all passed at 375×812, 812×375, 1280×720 and the 400×600 iframe; zero console errors or warnings; live frame p95 16.7-16.8 ms |
| Critic engine diff (`/private/tmp/claude-501/sp-critic/diff.mjs`) | 225/225 winning orders won by both; 400 fuzz sequences; 2 divergences, both level 51 on Hard (see below) |
| Critic engine diff, with its rules taught the level 51 flag (a one-line copy, `kill && L.safeArchers !== true`) | 0 divergences |
| Critic page diff (`pw.mjs diff`, served on :8492) | 13,662 steps, 225/225 won, 240 fuzz sequences, 0 divergences; 0 console, 0 external |
| Critic random-tap rates (`rate.mjs`, 300 playouts, seed 777) | every generated level within 3 points of its band; L58 7.0% (was 10.3%); late hard and hardest max 7.3% |

**Level 51 and the critic's rules.** The brief asked for level 51's archers to be non-lethal on every difficulty. The critic's `rules.mjs` hard-codes lethal archers on Hard, so any fuzz sequence that taps into level 51's ring on Hard diverges by design. After the final bake its fuzz stream happened to hit that twice (`fuzz121` and `fuzz362`, both `L51/hard order=3`: game puts 13 Masons on the line, the critic's rules fail short). A targeted run over level 51 (900 random sequences, 3 difficulties) shows 240 divergences with the rules as written and 0 with the one-line flag-aware copy in my scratchpad. I didn't touch the critic's files; its `pw.mjs` rewrote its own `pw-out.json` when I ran it.

## M3: boards as pictures (about 90 min)

**Generators (`tools/gen.js`, bake config v6).**
- Tight framing: each fort is built nearly full width, then `crop` trims grass-only columns and top rows to one cell and squeezes the grass between the fort and the camp to 2 rows. Gate, key and tower cells move with the crop.
- Key lodges sit beside the camp instead of above it (4 rows saved); a lodge that would land on the moat rejects the seed, so the moat stays whole.
- Denser courtyards: random placement first, then a reading-order sweep that drops the biggest building that fits, wall to wall with a building of another colour (never the same colour, so buildings stay distinct). New roles `stable` and `tower`; Era 3 adds `hall` and `tower` to its pool.
- More wall bands: Era 1 gets an optional timber wall-walk inside the palisade from 5 colours up; Era 2's bailey bank is 1-2 thick.
- Squad sizes grew to keep the 55-tap cap: mid [6, 16], late [8, 20]. saw0 gets 8 candidates (a trial bake left level 22 at the band's 80% edge, and the critic's estimate put it at 86%).

| Era (generated levels) | Blocks share of the board, before → after | Grass | Avg pixels | Largest board (cap) |
|---|---|---|---|---|
| 1 | 42% → 54% | 33% → 31% | 352 → 398 | 26×34 (28×36) |
| 2 | 33% → 44% | 35% → 35% | 360 → 432 | 30×40 (32×40) |
| 3 | 32% → 58% | 43% → 29% | 474 → 612 | 31×43 (36×48) |

**Rebake (v6).** Every Normal band in range with zero fallbacks (early 12/12, saw0 10/10, saw1 9/9, saw2 10/10, hard 17/17, hardest 6/6, relief 6/6; teaching levels exempt). 75/75 winnable on Easy, Normal and Hard. Lookahead player on Normal: hard median 11% (max 23%), hardest median 7% (max 22%), zero lookahead fallbacks. Max taps 55; late median 47. Bake 112 s on 16 threads. Full table in `tools/v3-m0-report.md`.

**Renderer (`src/board.js`).**
- Tones: every block has four tones of its colour (base, lit, shade, a faint running-bond alt), picked once per level from the fort's shape: a region's top or left edge is lit, its bottom or right edge shaded. Lit scales the colour up rather than mixing in white, so a lit red palisade stays red instead of turning Timber pink (it did in the first try). The per-material glyph is unchanged; the grayscale shot still separates every material.
- Scenery on the leftover ground, flat and muted and never bevelled: a trodden path from the camp to the fort (to the moat gate when there is one), canvas tents beside the camp, round trees and striped fields away from the fort's edge, tufts, flowers, stones, ripples on water. Decided once per level in `V.deco`, painted with the ground; no rule reads it.
- Archer rings tint the ground only (critic minor 9). The dashed ring stays; the tint is repainted away when the tower falls.

Tuning lives in `config.json` `board.tones` and `board.deco`.

## The other majors

- **M1, level title.** The name sits over a small difficulty tag beside the number, and `fitText` steps its size down until it fits (no ellipsis). Every level's name fits at all four viewports (17-26 px); at 812×375 it shows in the side panel.
- **M2, crew names.** Card labels fit the same way (floor `layout.labMinPx` 10), cached per crew until a resize. The landscape panel widened from 280 to 348 px. Checked on all 75 levels: every name and crew label fits at 375×812, 812×375, 400×600 and 1280×720. The longest, "Torchbearers", sits at 11.7 px at 375, 10.2 px at 812×375, 12.7 px in the iframe and 16.9 px at 1280. The name is re-fitted on every load (the room beside the number changes with its digits); crew sizes are cached per crew until a resize.
- **M4, full line.** At 5 of 5: the line gets a red rim that pulses, its head reads "Line full: only matching colours are safe", and each front card wears a green check (safe) or a red cross with a red outline (fatal). Fatal is exact: a one-tap look-ahead on a scratch copy of the game, run on a play or load, never per frame. It covers the cases the brief's simple rule misses (a card with 3 pixels in reach and 20 sappers still overflows). The head now sits above the slots with an `n/5` count, so it's never two lines and the coach arrow no longer lands on it.
- **M5, haul bins.** Each bin is a box in its own colour with a dark inside, its block (glyph included) as the label, and the haul piled in mini blocks that grow. Past 7 colours the bins go on two rows (`yardRows2` 4). They read as bins at rest in every era.
- **M6, desktop.** Wide screens use a grid: the board takes the full height on the left, and one side panel on the right holds the controls, the name, the holding line and the tray (cards 92 px tall, 54 px counts). The stage is shrunk to the board so the pair sits centred. The win/fail sheet covers the whole panel. Smallest Era 3 cell: 1280×720 12 → 14 px, 375×812 9.5 → 11, 812×375 9.33 → 8.67 (turned; `rotateBelowCss` 10; the wider panel costs a little board), 400×600 iframe 8.0 → 8.5.

## Minors

| Minor | Done |
|---|---|
| Functional 1: L58 at 10.3% | Fixed by the rebake: 4.3% baked, 7.0% in the critic's estimate |
| Functional 2: L51 kills on Hard | Fixed: `safeArchers` on level 51 (engine, reference rules, teaching data); selfTest checks a Hard hit goes to the line |
| Visual 1: tents like cones, stacked idlers | Canvas tents with a pennant beside the camp; idle sappers spread along the camp row |
| Visual 2: iframe third card row | Hidden in short portrait |
| Visual 6: coach arrow on the label | Fixed by the line head moving above the slots |
| Visual 7: slot counts on the men | Count right-aligned with an outline; 2 men on the left |
| Visual 8: crew-name contrast | Text is white or ink, whichever contrasts more (Hexbreakers, Looters, Sawyers, Goats now ink) |
| Visual 9: range tint recolours stones | Ground-only tint |
| Visual 11: runner smear | Lateral jitter 0.3 → 0.42 cell |
| Functional 3, 4; visual 3, 4, 5, 10, 12 | LATER.md |

## Screenshots (`tools/shots-v3-fix/`)

`375-rest-e1.png`, `375-rest-e2.png`, `375-rest-e3.png`, `375-rest-e3-gray.png`, `375-mid-show.png`, `375-line-full.png`, `375-bins-hauling.png`, `812-rest-e3.png`, `1280-rest-e3.png`, `1280-mid-show.png`, `1280-fail.png`, `side-by-side-e3-375-vs-foodhunt.png`.
