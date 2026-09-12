// Shared parcel-map report. Pure: takes the parsed data/parcels.json, returns text lines + the problem list.
// Used by tools/validate-parcels.mjs (node) and tools/validate.html (browser) so both can never disagree.
import { validateParcels, summarize, buildTileIndex, tileKey } from '../src/tiles.js';

export function buildReport(D) {
  const problems = validateParcels(D);
  const s = summarize(D);
  const idx = buildTileIndex(D);
  const lines = [];

  const glyphs = new Map();
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('').forEach((g, i) => { if (D.parcels[i]) glyphs.set(D.parcels[i].id, g); });

  lines.push(`park ${s.park}  parcels ${D.parcels.length}  parcel tiles ${s.parcel_tiles}  walkway ${s.walkway_tiles}  plaza ${s.plaza_tiles}  facility ${s.facility_tiles}`);
  lines.push(`     ${[...Array(idx.W).keys()].map(i => i % 10).join('')}`);
  for (let y = 0; y < idx.H; y++) {
    let line = '';
    for (let x = 0; x < idx.W; x++) {
      const k = tileKey(x, y);
      line += idx.owner.has(k) ? glyphs.get(idx.owner.get(k)) : idx.facility.has(k) ? '#' : idx.plaza.has(k) ? '=' : idx.walk.has(k) ? '.' : '?';
    }
    lines.push(`  ${String(y).padStart(2)} ${line}`);
  }
  lines.push('  legend: letter = parcel (A..), . walkway, = plaza, # facility, ? BLANK');
  lines.push('');

  // Same rule as validateParcels(): a parcel is rectangular when its bounding box is exactly its tile count.
  const irregular = s.parcels.filter(r => !/^\d+×\d+\b/.test(r.shape));
  for (const r of s.parcels) lines.push(`  ${r.id.padEnd(3)} ${String(r.tiles).padStart(2)} tiles  ${String(r.edges).padStart(2)} outline edges  ${r.shape}`);
  lines.push('');
  lines.push(`  non-rectangular parcels: ${irregular.length} (${irregular.map(r => r.id).join(', ')})`);
  lines.push('');
  if (problems.length) {
    lines.push(`FAIL: ${problems.length} problem(s)`);
    for (const p of problems) lines.push(`  - ${p}`);
  } else {
    lines.push('PASS: every parcel connected, no overlaps, zero blank interior tiles, every parcel touches a walkway, >=5 non-rectangular, no authored biome (M4: buyer picks it).');
  }
  return { lines, problems, summary: s };
}
