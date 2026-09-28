// Sapper's Path art metadata (fix-v2 gen): the additive `art` field every level carries for the renderer's picture.
//   art = { towers: [[x, y, w, h], ...], gates: [[x, y, w, h, side], ...], keep: [x, y, w, h], decor: [[x, y, kind], ...] }
//   side: "n" | "e" | "s" | "w", the face the gate opens toward. kind: bush | well | cart | flowers | barrel | path.
// towers and gates come from the generator's pieces (castle() info.art) or teaching.json's hand-authored `art`; keep is
// the K block's bounding rect. decor is placed here from the grid alone, purely cosmetic: on plain ground ('.') only,
// never on a cell that any crew walk (or aim line, or the win march) crosses in ANY reachable state. walkMarks()
// enumerates every state from the start; past C.decor.stateCap it gives up and the level gets no decor (logged).
// Every number is in bake-config.json → decor. Deterministic: the rng is seeded from the grid.
"use strict";
const E = require("../src/engine.js");
const S = require("../src/solver.js");

const KINDS = ["bush", "well", "cart", "flowers", "barrel", "path"], SIDES = ["n", "e", "s", "w"];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// Walk down the camp distance from c (strictly falling, lowest cell on ties: engine.pathTo, show.js, the aim line).
function descend(B, st, c, mark) {
  for (let g = 0; c >= 0 && g < B.n; g++) {
    mark[c] = 1;
    if (st.dist[c] <= 0) break;
    let nx = -1; for (let d = 0; d < 4; d++) { const e = B.nb[c * 4 + d]; if (e >= 0 && st.conn[e] && st.dist[e] === st.dist[c] - 1 && (nx < 0 || e < nx)) nx = e; }
    c = nx;
  }
}
// Every cell a crew walks in any reachable state: the walk to each legal call's target (Rule B: every section the
// call breaks), and on a won state the goblin's march (show.js: from the keep's nearest connected neighbour).
function walkMarks(B, cap) {
  const mark = new Uint8Array(B.n), s0 = E.start(B), key = (st) => st.moves.slice().sort((a, b) => a - b).join(",") + "|" + st.broken.join("");
  const seen = new Set([key(s0)]), q = [s0];
  let capped = false;
  for (let i = 0; i < q.length; i++) {
    const st = q[i];
    if (st.won) {
      let first = -1, fd = 1e9;
      for (const k of B.keepCells) for (let d = 0; d < 4; d++) { const e = B.nb[k * 4 + d]; if (e >= 0 && st.conn[e] && st.dist[e] >= 0 && st.dist[e] < fd) { fd = st.dist[e]; first = e; } }
      if (first >= 0) descend(B, st, first, mark);
      continue;
    }
    for (const a of E.legalMoves(B, st)) {
      const mt = B.cols ? st.front[a] : a;
      if (B.rule === "B") { for (let s = 0; s < B.nsec; s++) if (st.reach[s] && B.secMat[s] === mt && st.ground[s] >= 0) descend(B, st, st.ground[s], mark); }
      else if (st.target[mt] >= 0 && st.ground[st.target[mt]] >= 0) descend(B, st, st.ground[st.target[mt]], mark);
      const n = E.call(B, st, a), k = key(n);
      if (seen.has(k)) continue;
      if (seen.size >= cap) { capped = true; continue; }
      seen.add(k); q.push(n);
    }
  }
  return { mark, states: seen.size, capped };
}

// Decor for one level: [[x, y, kind], ...]. The field is open ground joined to the board edge at the start (the grass);
// every other open cell is courtyard. Singles first (a cart and barrels beside the camp, a well per courtyard), then a
// clustered noise field lays bushes along edges and walls, flower patches in the field, flower beds against courtyard
// walls, flagstone paths in courtyards, and the odd barrel against a wall.
function decorate(L, B, mark, DC) {
  const w = B.w, h = B.h, n = B.n, g = L.grid.join(""), rng = S.mulberry32(hash(g)), out = [], used = new Uint8Array(n);
  const openAt = (c) => c >= 0 && (g[c] === "." || g[c] === "P" || g[c] === "C");
  const isWall = (c) => c >= 0 && "STHIFKL~".includes(g[c]);
  const free = (c) => c >= 0 && g[c] === "." && !mark[c] && !used[c] && !B.nb.subarray(c * 4, c * 4 + 4).some((e) => e >= 0 && g[e] === "P");
  const put = (c, kind) => { used[c] = 1; out.push([c % w, (c / w) | 0, kind]); };
  const field = new Uint8Array(n), q = [];
  for (let c = 0; c < n; c++) { const x = c % w, y = (c / w) | 0; if ((x === 0 || y === 0 || x === w - 1 || y === h - 1) && openAt(c)) { field[c] = 1; q.push(c); } }
  for (let i = 0; i < q.length; i++) for (let d = 0; d < 4; d++) { const e = B.nb[q[i] * 4 + d]; if (e >= 0 && !field[e] && openAt(e)) { field[e] = 1; q.push(e); } }
  const byWall = (c) => { for (let d = 0; d < 4; d++) if (isWall(B.nb[c * 4 + d])) return true; return false; };
  const edge = (c) => { const x = c % w, y = (c / w) | 0; return x === 0 || y === 0 || x === w - 1 || y === h - 1; };

  // A cart and barrels at the end of the camp: the free field cells nearest the camp's outer corners.
  if (DC.cart && B.camp.length) {
    let lo = w, hi = -1, top = h; for (const c of B.camp) { lo = Math.min(lo, c % w); hi = Math.max(hi, c % w); top = Math.min(top, (c / w) | 0); }
    const near = [];
    for (let c = 0; c < n; c++) if (field[c] && free(c) && ((c / w) | 0) >= top - 1) near.push([Math.min(Math.abs(c % w - lo), Math.abs(c % w - hi)) + Math.abs(((c / w) | 0) - (h - 1)) * 0.5, c]);
    near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (near.length) { put(near[0][1], "cart"); let b = 0; for (const [, c] of near.slice(1)) if (b < 2 && free(c) && Math.abs(c % w - near[0][1] % w) <= 2) { put(c, "barrel"); b++; } }
  }
  // A well in each courtyard big enough: the free cell with all eight neighbours open, nearest the courtyard's middle.
  const yard = new Int16Array(n).fill(-1);
  for (let c0 = 0, id = 0; c0 < n; c0++) {
    if (field[c0] || !openAt(c0) || yard[c0] >= 0) continue;
    const comp = [c0]; yard[c0] = id;
    for (let i = 0; i < comp.length; i++) for (let d = 0; d < 4; d++) { const e = B.nb[comp[i] * 4 + d]; if (e >= 0 && !field[e] && openAt(e) && yard[e] < 0) { yard[e] = id; comp.push(e); } }
    id++;
    if (comp.length < DC.wellMin) continue;
    let mx = 0, my = 0; for (const c of comp) { mx += c % w; my += (c / w) | 0; } mx /= comp.length; my /= comp.length;
    let best = -1, bd = 1e9;
    for (const c of comp) {
      if (!free(c)) continue;
      let ok = true; for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) { const x = c % w + dx, y = ((c / w) | 0) + dy; if (x < 0 || y < 0 || x >= w || y >= h || !openAt(y * w + x)) ok = false; }
      const d = (c % w - mx) ** 2 + (((c / w) | 0) - my) ** 2;
      if (ok && d < bd) { bd = d; best = c; }
    }
    if (best >= 0) put(best, "well");
  }
  // Clustered noise (a coarse lattice, bilinear) so decor comes in patches, not salt and pepper.
  const k = DC.noise, lw = Math.ceil(w / k) + 2, lat = new Float32Array(lw * (Math.ceil(h / k) + 2));
  for (let i = 0; i < lat.length; i++) lat[i] = rng();
  const noise = (x, y) => { const fx = x / k, fy = y / k, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, a = lat[iy * lw + ix], b = lat[iy * lw + ix + 1], c = lat[(iy + 1) * lw + ix], d = lat[(iy + 1) * lw + ix + 1]; return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty; };
  for (let c = 0; c < n; c++) {
    if (!free(c)) continue;
    const v = noise(c % w, (c / w) | 0), r = rng();
    if (field[c]) {
      if ((edge(c) || byWall(c)) && v > DC.edgeBush[0] && r < DC.edgeBush[1]) put(c, "bush");
      else if (v > DC.fieldFlowers) put(c, r < 0.3 ? "bush" : "flowers");
    } else {
      if (byWall(c) && v > DC.bedFlowers) put(c, r < DC.barrel ? "barrel" : r < 0.35 ? "bush" : "flowers");
      else if (v > DC.yardPath) put(c, "path");
    }
  }
  out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return out;
}

// The whole art object for a level. hints: {towers, gates} (generator info.art or teaching.json art), may be null.
// Returns {art, states, capped}.
function artFor(L, hints, C) {
  const B = E.parse(L), DC = C.decor;
  let x0 = B.w, y0 = B.h, x1 = -1, y1 = -1;
  for (const c of B.keepCells) { x0 = Math.min(x0, c % B.w); y0 = Math.min(y0, (c / B.w) | 0); x1 = Math.max(x1, c % B.w); y1 = Math.max(y1, (c / B.w) | 0); }
  const wm = walkMarks(B, DC.stateCap);
  const art = {
    towers: ((hints && hints.towers) || []).map((r) => r.slice(0, 4)),
    gates: ((hints && hints.gates) || []).map((r) => r.slice(0, 5)),
    keep: [x0, y0, x1 - x0 + 1, y1 - y0 + 1],
    decor: wm.capped ? [] : decorate(L, B, wm.mark, DC),
  };
  return { art, states: wm.states, capped: wm.capped };
}

// Open-ground numbers for the report: crew-wall coverage, plain ground with no decor (empty), and the largest blank
// square (plain ground, no decor, any walk cell counts as blank).
function ground(L) {
  const w = L.w, h = L.h, g = L.grid.join(""), deco = new Uint8Array(w * h);
  for (const [x, y] of (L.art && L.art.decor) || []) deco[y * w + x] = 1;
  let crew = 0, empty = 0, open = 0;
  const blank = new Int16Array(w * h);
  let big = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = y * w + x, ch = g[c];
    if ("STHI".includes(ch)) crew++;
    if (ch === ".") { open++; if (!deco[c]) empty++; }
    if (ch === "." && !deco[c]) { blank[c] = x && y ? 1 + Math.min(blank[c - 1], blank[c - w], blank[c - w - 1]) : 1; if (blank[c] > big) big = blank[c]; }
  }
  return { crew: crew / (w * h), empty: empty / (w * h), open: open / (w * h), decor: ((L.art && L.art.decor) || []).length, bigBlank: big };
}

module.exports = { artFor, walkMarks, decorate, ground, KINDS, SIDES };
