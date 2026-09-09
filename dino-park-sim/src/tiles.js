// Tile-set geometry for polyomino parcels (M2.6). Pure functions over data/parcels.json shapes: no game state,
// no DOM, so the same code runs in the browser (state.js, renderers, agents) and under node (tools/*.mjs).
// A parcel is { id, biome, tiles: [[x,y],...] } in whole tiles. Everything that used to be derived from a w x h
// rectangle now comes from here:
// area = tiles.length, fence segments = outline edge count, label position = centroid tile, wander bounds = per tile.

export const tileKey = (x, y) => `${x},${y}`;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export function tileSet(tiles) { return new Set(tiles.map(([x, y]) => tileKey(x, y))); }

export function bbox(tiles) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of tiles) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x + 1 > x1) x1 = x + 1; if (y + 1 > y1) y1 = y + 1; }
  return { x0, y0, x1, y1 };
}

export function isConnected(tiles) {
  if (!tiles.length) return false;
  const set = tileSet(tiles);
  const seen = new Set([tileKey(tiles[0][0], tiles[0][1])]);
  const stack = [tiles[0]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of DIRS) {
      const k = tileKey(x + dx, y + dy);
      if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy]); }
    }
  }
  return seen.size === set.size;
}

// Outline edges: unit tile edges not shared with another tile of the same set. Each carries the tile inside
// (tx,ty), the tile beyond (nx,ny), and its endpoints in world units. Order: per tile, north, east, south, west.
export function outlineEdges(tiles) {
  const set = tileSet(tiles);
  const out = [];
  for (const [x, y] of tiles) {
    if (!set.has(tileKey(x, y - 1))) out.push({ x0: x, y0: y, x1: x + 1, y1: y, tx: x, ty: y, nx: x, ny: y - 1, side: 'n' });
    if (!set.has(tileKey(x + 1, y))) out.push({ x0: x + 1, y0: y, x1: x + 1, y1: y + 1, tx: x, ty: y, nx: x + 1, ny: y, side: 'e' });
    if (!set.has(tileKey(x, y + 1))) out.push({ x0: x, y0: y + 1, x1: x + 1, y1: y + 1, tx: x, ty: y, nx: x, ny: y + 1, side: 's' });
    if (!set.has(tileKey(x - 1, y))) out.push({ x0: x, y0: y, x1: x, y1: y + 1, tx: x, ty: y, nx: x - 1, ny: y, side: 'w' });
  }
  return out;
}
export const outlineCount = tiles => outlineEdges(tiles).length;

// Closed outline loops (arrays of [x,y] corners, clockwise in screen space: +x east, +y south) so a whole
// polyomino can be filled or stroked as one path with no seams between its tiles.
export function outlineLoops(tiles) {
  const set = tileSet(tiles);
  // directed edges with the parcel on the right-hand side (clockwise around each tile)
  const byStart = new Map();
  const add = (ax, ay, bx, by) => { const k = tileKey(ax, ay); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push([bx, by]); };
  for (const [x, y] of tiles) {
    if (!set.has(tileKey(x, y - 1))) add(x, y, x + 1, y);
    if (!set.has(tileKey(x + 1, y))) add(x + 1, y, x + 1, y + 1);
    if (!set.has(tileKey(x, y + 1))) add(x + 1, y + 1, x, y + 1);
    if (!set.has(tileKey(x - 1, y))) add(x, y + 1, x, y);
  }
  const loops = [];
  while (byStart.size) {
    const [startKey, outs] = byStart.entries().next().value;
    const [sx, sy] = startKey.split(',').map(Number);
    const loop = [[sx, sy]];
    let cx = sx, cy = sy;
    for (;;) {
      const list = byStart.get(tileKey(cx, cy));
      if (!list || !list.length) break;
      const [nx, ny] = list.shift();
      if (!list.length) byStart.delete(tileKey(cx, cy));
      if (nx === sx && ny === sy) break;
      loop.push([nx, ny]);
      cx = nx; cy = ny;
    }
    // drop collinear midpoints so the path is just the corners
    const simp = [];
    for (let i = 0; i < loop.length; i++) {
      const a = loop[(i + loop.length - 1) % loop.length], b = loop[i], c = loop[(i + 1) % loop.length];
      if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) simp.push(b);
    }
    loops.push(simp.length >= 3 ? simp : loop);
  }
  return loops;
}

// Centre of the tile centres. labelTile is the tile that contains the centroid, or the nearest tile when the
// centroid falls in a notch (concave shapes), so labels and signs always sit on the parcel itself.
export function centroid(tiles) {
  let x = 0, y = 0;
  for (const t of tiles) { x += t[0] + 0.5; y += t[1] + 0.5; }
  return { x: x / tiles.length, y: y / tiles.length };
}
export function labelTile(tiles) {
  const c = centroid(tiles);
  const set = tileSet(tiles);
  const fx = Math.floor(c.x), fy = Math.floor(c.y);
  if (set.has(tileKey(fx, fy))) return [fx, fy];
  let best = tiles[0], bd = Infinity;
  for (const t of tiles) { const d = (t[0] + 0.5 - c.x) ** 2 + (t[1] + 0.5 - c.y) ** 2; if (d < bd) { bd = d; best = t; } }
  return best;
}

// The tile a pen's sign/label hangs on: the front-most row (largest y), middle of that row. Always on the shape,
// and always the row closest to the viewer, so a label never floats over a notch in an L or a plus.
export function frontTile(tiles) {
  let maxY = -Infinity;
  for (const [, y] of tiles) if (y > maxY) maxY = y;
  const row = tiles.filter(t => t[1] === maxY).sort((a, b) => a[0] - b[0]);
  return row[Math.floor((row.length - 1) / 2)];
}

// Where a parcel's sign and name chip belong: on the PATH beside it, never on top of it. Picks the outline edge
// whose neighbour is a walkway or plaza tile - south first (nearest the viewer in the oblique view), then east,
// west, north - and returns the centre of that neighbouring walkway tile plus the direction back to the parcel.
// Boards drawn here hang over paving, so a sign can no longer be lifted onto a pen and cover a dinosaur.
const SIDE_RANK = { s: 0, e: 1, w: 2, n: 3 };
export function signAnchor(tiles, walkable) {
  let best = null;
  const c = centroid(tiles);
  for (const e of outlineEdges(tiles)) {
    if (walkable && !walkable.has(tileKey(e.nx, e.ny))) continue;
    const d = Math.abs(e.nx + 0.5 - c.x) + Math.abs(e.ny + 0.5 - c.y);
    const score = SIDE_RANK[e.side] * 100 + d;
    if (!best || score < best.score) best = { score, x: e.nx + 0.5, y: e.ny + 0.5, side: e.side };
  }
  if (best) return { x: best.x, y: best.y, side: best.side };
  const f = frontTile(tiles);
  return { x: f[0] + 0.5, y: f[1] + 1.0, side: 's' };
}

// One shape line for every parcel, rectangle or polyomino: "2x2 - 4 tiles", "L-shape - 4 tiles". The tile count is
// always part of the label, so no caller has to append it (and none can append it twice).
export function shapeLabel(def) {
  const tiles = def.tiles;
  const b = bbox(tiles);
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  const n = tiles.length;
  const head = w * h === n ? `${w}×${h}` : `${def.shape && def.shape !== 'rect' ? def.shape.toUpperCase() : 'IRREGULAR'}-shape`;
  return `${head} \u00b7 ${n} tile${n > 1 ? 's' : ''}`;
}

// 4-neighbours of a tile that are inside the set (for wander targets: a straight line between a point in a
// tile and a point in a 4-adjacent tile stays inside the union of the two).
export function neighboursIn(tiles, x, y) {
  const set = tileSet(tiles);
  const out = [];
  for (const [dx, dy] of DIRS) if (set.has(tileKey(x + dx, y + dy))) out.push([x + dx, y + dy]);
  return out;
}

// ---- park-wide tile classification (walkways, plaza, facilities, parcels) ----
// Walkway tiles: every tile whose centre lies on a centre-line segment (segments run through tile centres).
export function walkwayTiles(D) {
  const set = new Set();
  const W = D.park.w, H = D.park.h;
  for (const s of D.walkways) {
    const [xa, ya] = s.from, [xb, yb] = s.to;
    const vertical = Math.abs(xa - xb) < 1e-6;
    if (vertical) {
      const x = Math.floor(xa);
      for (let y = Math.floor(Math.min(ya, yb)); y <= Math.floor(Math.max(ya, yb) - 1e-6); y++) if (x >= 0 && x < W && y >= 0 && y < H && onSeg(x + 0.5, y + 0.5, s)) set.add(tileKey(x, y));
    } else {
      const y = Math.floor(ya);
      for (let x = Math.floor(Math.min(xa, xb)); x <= Math.floor(Math.max(xa, xb) - 1e-6); x++) if (x >= 0 && x < W && y >= 0 && y < H && onSeg(x + 0.5, y + 0.5, s)) set.add(tileKey(x, y));
    }
  }
  return set;
}
function onSeg(px, py, s) {
  const [xa, ya] = s.from, [xb, yb] = s.to, e = 1e-6;
  return px >= Math.min(xa, xb) - e && px <= Math.max(xa, xb) + e && py >= Math.min(ya, yb) - e && py <= Math.max(ya, yb) + e
    && (Math.abs(xa - xb) < e ? Math.abs(px - xa) < e : Math.abs(py - ya) < e);
}
export function plazaTiles(D) {
  const set = new Set();
  const p = D.plaza;
  for (let x = p.x0; x < p.x1; x++) for (let y = p.y0; y < p.y1; y++) set.add(tileKey(x, y));
  return set;
}
export function facilityTiles(D) {
  const map = new Map();
  for (const id in D.facilities) { const f = D.facilities[id]; if (f.tiles) for (const [x, y] of f.tiles) map.set(tileKey(x, y), id); }
  return map;
}
// Full classification: { W, H, owner: Map tileKey -> parcel id, walk: Set, plaza: Set, facility: Map, walkable: Set (walk + plaza) }.
export function buildTileIndex(D) {
  const owner = new Map();
  for (const p of D.parcels) for (const [x, y] of p.tiles) owner.set(tileKey(x, y), p.id);
  const walk = walkwayTiles(D), plaza = plazaTiles(D);
  const walkable = new Set([...walk, ...plaza]);
  return { W: D.park.w, H: D.park.h, owner, walk, plaza, facility: facilityTiles(D), walkable };
}

// Validator. Returns a list of human-readable problems (empty = valid).
export function validateParcels(D) {
  const problems = [];
  const idx = buildTileIndex(D);
  const seen = new Map();
  for (const p of D.parcels) {
    if (!Array.isArray(p.tiles) || !p.tiles.length) { problems.push(`${p.id}: no tiles`); continue; }
    if (p.w != null || p.h != null || p.x != null || p.y != null) problems.push(`${p.id}: w/h/x/y are not part of the schema any more`);
    if (!isConnected(p.tiles)) problems.push(`${p.id}: tiles are not 4-connected`);
    for (const [x, y] of p.tiles) {
      const k = tileKey(x, y);
      if (!Number.isInteger(x) || !Number.isInteger(y)) problems.push(`${p.id}: tile ${k} is not whole-number`);
      if (x < 0 || y < 0 || x >= idx.W || y >= idx.H) problems.push(`${p.id}: tile ${k} is outside the park`);
      if (seen.has(k)) problems.push(`${p.id}: tile ${k} overlaps ${seen.get(k)}`); else seen.set(k, p.id);
      if (idx.walk.has(k)) problems.push(`${p.id}: tile ${k} is a walkway tile`);
      if (idx.plaza.has(k)) problems.push(`${p.id}: tile ${k} is a plaza tile`);
      if (idx.facility.has(k)) problems.push(`${p.id}: tile ${k} is the ${idx.facility.get(k)} footprint`);
    }
    const touches = outlineEdges(p.tiles).some(e => idx.walkable.has(tileKey(e.nx, e.ny)));
    if (!touches) problems.push(`${p.id}: no outline edge faces a walkway or plaza tile`);
  }
  for (const [k, id] of idx.facility) if (idx.walk.has(k) || idx.plaza.has(k)) problems.push(`facility ${id}: tile ${k} is also a walkway/plaza tile`);
  const blanks = [];
  for (let x = 0; x < idx.W; x++) for (let y = 0; y < idx.H; y++) {
    const k = tileKey(x, y);
    if (!idx.owner.has(k) && !idx.walk.has(k) && !idx.plaza.has(k) && !idx.facility.has(k)) blanks.push(k);
  }
  if (blanks.length) problems.push(`${blanks.length} blank interior tile(s): ${blanks.join(' ')}`);
  const irregular = D.parcels.filter(p => { const b = bbox(p.tiles); return (b.x1 - b.x0) * (b.y1 - b.y0) !== p.tiles.length; }).length;
  if (irregular < 5) problems.push(`only ${irregular} non-rectangular parcels (need at least 5)`);
  if (D.parcels.length < 14 || D.parcels.length > 18) problems.push(`${D.parcels.length} parcels (spec asks for 14-18)`);
  return problems;
}

export function summarize(D) {
  const idx = buildTileIndex(D);
  const rows = D.parcels.map(p => ({ id: p.id, biome: p.biome, tiles: p.tiles.length, edges: outlineCount(p.tiles), shape: shapeLabel(p), label: labelTile(p.tiles).join(',') }));
  return { park: `${idx.W}x${idx.H}`, walkway_tiles: idx.walk.size, plaza_tiles: idx.plaza.size, facility_tiles: idx.facility.size, parcel_tiles: idx.owner.size, parcels: rows };
}
