// Flockstop board symmetries (SPEC §2 "past the bake horizon"). PURE, UMD like rules.js.
// k = 0..7: 0 identity, 1 rot90 cw, 2 rot180, 3 rot270 cw, 4 mirror left-right, 5 mirror top-bottom,
// 6 transpose, 7 anti-transpose. Odd rotations and 6/7 swap w and h. Pen open sides and swipe
// directions rotate with the board, so par (and the solution, via mapDirs) carries over unchanged.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.Flockstop = root.Flockstop || {}).sym = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const DIRS = ["N", "E", "S", "W"];
  const VEC = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const SWAPS = [false, true, false, true, false, false, true, true];

  // Where cell (x,y) of a w×h board lands under symmetry k.
  function mapXY(k, x, y, w, h) {
    switch (k) {
      case 0: return [x, y];
      case 1: return [h - 1 - y, x];
      case 2: return [w - 1 - x, h - 1 - y];
      case 3: return [y, w - 1 - x];
      case 4: return [w - 1 - x, y];
      case 5: return [x, h - 1 - y];
      case 6: return [y, x];
      default: return [h - 1 - y, w - 1 - x];
    }
  }

  // A direction is a vector: map it with the linear part of the same transform.
  function mapDir(k, d) {
    const i = typeof d === "number" ? d : DIRS.indexOf(d);
    const a = mapXY(k, 0, 0, 2, 2), b = mapXY(k, VEC[i][0], VEC[i][1], 2, 2);
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const j = VEC.findIndex((v) => v[0] === vx && v[1] === vy);
    return typeof d === "number" ? j : DIRS[j];
  }

  function mapDirs(k, dirs) { return Array.from(dirs, (d) => mapDir(k, d)).join(""); }

  function keepsDims(k, w, h) { return w === h || !SWAPS[k]; }

  // Board JSON → board JSON under symmetry k. A baked solution (sol) is rotated with it; par, id and the rest carry over.
  function apply(k, b) {
    const w = b.w, h = b.h, nw = SWAPS[k] ? h : w, nh = SWAPS[k] ? w : h;
    const grid = [];
    for (let y = 0; y < nh; y++) grid.push(new Array(nw));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = mapXY(k, x, y, w, h); grid[p[1]][p[0]] = b.rows[y][x]; }
    const pens = b.pens.map((p) => { const q = mapXY(k, p.x, p.y, w, h); return { x: q[0], y: q[1], open: mapDir(k, p.open), c: p.c }; });
    pens.sort((a, c) => a.y - c.y || a.x - c.x);
    const out = Object.assign({}, b, { w: nw, h: nh, rows: grid.map((r) => r.join("")), pens });
    if (typeof b.sol === "string") out.sol = mapDirs(k, b.sol);
    return out;
  }

  // Layout string (no par/id) used for identity checks.
  function layoutKey(b) { return b.w + "x" + b.h + "|" + b.rows.join("/") + "|" + b.pens.map((p) => p.x + "," + p.y + p.open + p.c).join(";"); }

  // The same key for all 8 symmetric copies: dedup "identical up to symmetry" (SPEC §3).
  function canonicalKey(b) {
    let best = null;
    for (let k = 0; k < 8; k++) { const s = layoutKey(apply(k, b)); if (best === null || s < best) best = s; }
    return best;
  }

  return { DIRS, mapXY, mapDir, mapDirs, keepsDims, apply, layoutKey, canonicalKey };
});
