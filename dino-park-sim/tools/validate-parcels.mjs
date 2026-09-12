// Parcel map validator (M2.6). Run: node tools/validate-parcels.mjs
//
// Asserts, for data/parcels.json:
//   1. every parcel's tiles are 4-connected (a real polyomino)
//   2. no two parcels overlap, and no parcel sits on a walkway / plaza / facility tile
//   3. EVERY interior tile that is not walkway, plaza or facility belongs to exactly one parcel (zero blank land)
//   4. every parcel has at least one outline edge facing a walkway or plaza tile
//   5. at least 5 parcels are non-rectangular
//   6. no parcel carries a `biome` (M4: the land type is chosen at purchase, so there is no biome-mix rule)
// The rules themselves live in src/tiles.js validateParcels(), which the game also runs at load, so the
// browser and this tool can never disagree. Report formatting is shared with tools/validate.html.
//
// Exit code 0 = pass, 1 = fail. (No node on the current Mac: tools/validate.html runs the identical check
// in the browser and prints the same report.)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildReport } from './parcel-report.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = JSON.parse(readFileSync(join(ROOT, 'data/parcels.json'), 'utf8'));
const { lines, problems } = buildReport(D);
console.log(lines.join('\n'));
process.exit(problems.length ? 1 : 0);
