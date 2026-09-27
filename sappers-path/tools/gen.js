// Sapper's Path board generator + per-board metrics (SPEC §3). Node only; every number comes from bake-config.json.
// generate(): Voronoi blobs cut into pieces by layer (ring around a centred keep, with wobble) → each piece is wall,
//   courtyard or moat by W.bands, with divider/gap noise → walls take materials that never merge across layers
//   → world elements by rule (iron doors + levers, then one chest).
//   The muster is the unlimited-crew optimal line's crew mix, so min crews is known before the real solve.
// measure(): real solve + greedy + seeded random playouts for one muster.
// batch(): n boards from one seed, each measured with spare 0 and spare +1. Used by report.js and bake.js.
"use strict";
const E = require("../src/engine.js");
const S = require("../src/solver.js");

const pick = (rng, a) => a[Math.floor(rng() * a.length)];
const cheb = (x, y, kx, ky) => Math.max(Math.abs(x - kx), Math.abs(y - ky));
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// One board. Returns {level, info} or {fail: reason}.
function generate(W, C, rng) {
  const w = pick(rng, W.sizes), h = w, n = w * h;
  const kx = ((w - 1) >> 1) + (w % 2 === 0 && rng() < 0.5 ? 1 : 0), ky = ((h - 1) >> 1) + (h % 2 === 0 && rng() < 0.5 ? 1 : 0);
  const keep = ky * w + kx, maxR = Math.max(kx, w - 1 - kx, ky, h - 1 - ky);

  // Voronoi blobs with per-seed weights (jitter makes some blobs fat, some thin).
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  const ns = Math.max(4, Math.round(n / W.blobSize)), seeds = order.slice(0, ns), wt = seeds.map(() => 1 + (rng() * 2 - 1) * W.blobJitter);
  const owner = new Int16Array(n);
  for (let c = 0; c < n; c++) {
    let best = 1e9, bi = 0;
    for (let b = 0; b < ns; b++) { const dx = c % w - seeds[b] % w, dy = ((c / w) | 0) - ((seeds[b] / w) | 0), d = (dx * dx + dy * dy) / (wt[b] * wt[b]); if (d < best) { best = d; bi = b; } }
    owner[c] = bi;
  }
  // Layers: a cell's ring (Chebyshev distance from the keep) plus its blob's wobble (-1/0/+1). A piece is one blob's
  // cells on one layer. Role by layer from W.bands (W wall, O courtyard, M moat band: moat or a breakable bridge).
  // Noise: a courtyard piece becomes a divider wall, an outer wall piece becomes a gap.
  const band = (d) => (d >= maxR ? W.bands[W.bands.length - 1] : W.bands[Math.min(W.bands.length - 1, d)]);   // the edge takes the outer band
  const wob = seeds.map(() => { const r = rng(); return r < W.wobble / 2 ? -1 : r < W.wobble ? 1 : 0; });
  const layer = new Int16Array(n), pieceOf = new Int16Array(n), pmap = new Map(), pLayer = [];
  for (let c = 0; c < n; c++) {
    const d = cheb(c % w, (c / w) | 0, kx, ky);
    const onEdge = c % w === 0 || c % w === w - 1 || c < w || c >= n - w;   // the edge is always the outer layer
    let L = c === keep ? 0 : d <= 1 ? 1 : onEdge ? maxR : Math.max(2, Math.min(maxR - 1, d + wob[owner[c]]));
    if (band(L) === "O" && band(d) !== "O") L = d;                          // wobble thickens walls, never erases a band
    layer[c] = L;
    const k = owner[c] * 64 + layer[c];
    if (!pmap.has(k)) { pmap.set(k, pLayer.length); pLayer.push(layer[c]); }
    pieceOf[c] = pmap.get(k);
  }
  const np = pLayer.length, adj = Array.from({ length: np }, () => new Set());
  for (let c = 0; c < n; c++) for (const e of [c % w < w - 1 ? c + 1 : -1, c + w < n ? c + w : -1]) if (e >= 0 && pieceOf[e] !== pieceOf[c]) { adj[pieceOf[c]].add(pieceOf[e]); adj[pieceOf[e]].add(pieceOf[c]); }
  const type = new Array(np).fill(null), keepPiece = pieceOf[keep];
  const pieces = Array.from({ length: np }, (_, i) => i).sort((a, b) => pLayer[b] - pLayer[a]);
  for (const b of pieces) {
    if (b === keepPiece) continue;
    let role = band(pLayer[b]);
    if (role === "O" && rng() < W.divider) role = "W";
    else if (role === "W" && pLayer[b] > 1 && pLayer[b] < maxR && rng() < W.gap) role = "O";
    else if (role === "M") role = rng() < W.moat.p ? "~" : "W";
    if (role === "O") { type[b] = "."; continue; }
    if (role === "~") { type[b] = "~"; continue; }
    // A wall never shares a material with an adjacent wall piece on another layer (that would merge layers into one
    // section and short-cut the keep); if every material is taken it becomes an open pocket. Same-layer merges are
    // only discouraged (W.avoidMerge).
    const cross = new Set(), same = new Set();
    for (const o of adj[b]) if (type[o] && "STHI".includes(type[o])) (pLayer[o] !== pLayer[b] ? cross : same).add(type[o]);
    const opts = W.mats.filter((q) => !cross.has(q)), pref = opts.filter((q) => !same.has(q));
    if (!opts.length) { type[b] = pLayer[b] <= 1 ? pick(rng, W.mats) : "."; continue; }
    type[b] = pick(rng, pref.length && rng() < W.avoidMerge ? pref : opts);
  }
  const g = new Array(n);
  for (let c = 0; c < n; c++) g[c] = c === keep ? "K" : type[pieceOf[c]];
  g[keep] = "K";
  const rows = () => Array.from({ length: h }, (_, y) => g.slice(y * w, y * w + w).join(""));

  // World 4: iron doors on inner pieces, each with a lever sealed in an adjacent wall; a cascade puts lever k beside door k-1.
  const info = { chest: false, doors: 0, levers: 0, cascade: false };
  if (W.doors) {
    const want = W.doors[0] + Math.floor(rng() * (W.doors[1] - W.doors[0] + 1));
    const cand = pieces.filter((b) => b !== keepPiece && "STHI".includes(type[b]) && pLayer[b] <= W.doorLayer);
    for (let k = 0; k < want && cand.length; k++) { const b = cand.splice(Math.floor(rng() * cand.length), 1)[0]; for (let c = 0; c < n; c++) if (pieceOf[c] === b) g[c] = "F"; }
    let B0; try { B0 = E.parse({ w, h, grid: rows(), muster: {}, chests: [] }); } catch (e) { return { fail: "parse" }; }
    const D0 = E.derive(B0, new Uint8Array(B0.nsec), E.scratch(B0));
    const doors = []; for (let s = 0; s < B0.nsec; s++) if (B0.secMat[s] === E.IRON) doors.push(s);
    for (let k = 0; k < doors.length; k++) {
      const touchesSec = (c, s) => { for (let d = 0; d < 4; d++) { const e = B0.nb[c * 4 + d]; if (e >= 0 && B0.sec[e] === s) return true; } return false; };
      const ok = (c) => g[c] !== "L" && !B0.edge[c] && !E.touches(B0, D0.conn, c) && c !== keep && Math.abs((c % w) - kx) + Math.abs(((c / w) | 0) - ky) > 1;
      let pool = [];
      if (k > 0 && rng() < W.cascade) for (let c = 0; c < n; c++) if (ok(c) && B0.kind[c] === E.WALL && touchesSec(c, doors[k]) && touchesSec(c, doors[k - 1])) pool.push(c);
      if (pool.length) info.cascade = true;
      else for (let c = 0; c < n; c++) if (ok(c) && B0.kind[c] === E.WALL && B0.mat[c] < E.IRON && touchesSec(c, doors[k])) pool.push(c);
      if (!pool.length) continue;
      g[pick(rng, pool)] = "L"; info.levers++;
    }
    info.doors = doors.length;
  }

  // The unlimited-crew optimal line sets the muster.
  const level = { w, h, grid: rows(), muster: {}, chests: [] };
  let B; try { B = E.parse(level); } catch (e) { return { fail: "parse" }; }
  if (E.start(B).won) return { fail: "trivial" };
  const q = S.quickest(B, { cap: C.quickCap });
  if (q.capped) return { fail: "quick-capped" };
  if (!q.win) return { fail: "no-win" };
  const comp = [0, 0, 0, 0]; for (const s of q.line) comp[B.secMat[s]]++;

  // World 2+: one chest in a pocket the optimal line opens at step j, holding a crew that a later step on that line uses.
  if (W.chests) {
    const D = E.scratch(B), br = new Uint8Array(B.nsec), prev = E.derive(B, br, E.scratch(B)).conn.slice(), opts = [];
    for (let j = 0; j < q.line.length - 1; j++) {
      br[q.line[j]] = 1; E.derive(B, br, D);
      for (let c = 0; c < n; c++) if (g[c] === "." && D.conn[c] && !prev[c]) opts.push({ c, j });
      prev.set(D.conn);
    }
    if (opts.length) {
      const o = pick(rng, opts), later = q.line.slice(o.j + 1), t = B.secMat[pick(rng, later)];
      g[o.c] = "C"; level.grid = rows(); level.chests = [{ x: o.c % w, y: (o.c / w) | 0, crew: E.CREWS[t] }];
      comp[t]--; info.chest = true; info.chestStep = o.j;
    }
  }
  level.muster = E.musterObj(comp);
  const present = []; for (let s = 0; s < B.nsec; s++) if (B.secMat[s] < E.IRON && !present.includes(B.secMat[s])) present.push(B.secMat[s]);
  info.spareCrew = E.CREWS[pick(rng, present)];
  info.quickMin = q.min;
  return { level, info };
}

function withSpare(level, crew, k) { const L = JSON.parse(JSON.stringify(level)); if (k) L.muster[crew] = (L.muster[crew] | 0) + k; return L; }

// Metrics for one level as given (its muster included).
function measure(L, C) {
  const B = E.parse(L), r = S.solve(B, { cap: C.cap }), gr = S.greedy(B), p = S.playouts(B, C.playouts, hashStr(L.grid.join("") + JSON.stringify(L.muster)));
  let crewSecs = 0, iron = 0; for (let s = 0; s < B.nsec; s++) if (B.secMat[s] < E.IRON) crewSecs++; else iron++;
  const m = {
    sections: crewSecs, iron, cells: B.n, win: r.win, min: r.min, capped: r.capped, states: r.states, dead: r.dead, lost: r.lost, wins: r.wins,
    deadRatio: r.states ? r.dead / r.states : 0, lostRatio: r.states ? r.lost / r.states : 0, ms: r.ms,
    randWin: p.winRate, greedyWin: gr.win, greedyUsed: gr.used, greedyExcess: gr.win && r.win ? gr.used - r.min : null,
    orderMatters: r.win && (!gr.win || gr.used - r.min >= 2), line: r.line,
    chests: B.chestCell.length, chestOnOptimal: r.chestOnOptimal, chestRequired: r.chestRequired, levers: B.levers.length, leversMatter: null,
  };
  if (B.levers.length && r.win) { const r2 = S.solve(E.parse(L, { noLevers: true }), { cap: C.cap }); m.leversMatter = r2.capped ? null : (!r2.win || r2.min > r.min); }
  if (r.error) m.error = r.error;
  return m;
}

// n boards for world wk from one seed. Returns {recs:[{seed, idx, level, info, s0, s1}], fails:{reason: count}}.
function batch(C, wk, seed, n) {
  const W = C.worlds[wk], rng = S.mulberry32(seed), recs = [], fails = {};
  for (let made = 0, tries = 0; made < n && tries < n * C.triesPerBoard; tries++) {
    const r = generate(W, C, rng);
    if (r.fail) { fails[r.fail] = (fails[r.fail] || 0) + 1; continue; }
    made++;
    const s0 = measure(r.level, C), s1 = measure(withSpare(r.level, r.info.spareCrew, 1), C);
    recs.push({ world: +wk, seed, idx: made - 1, level: r.level, info: r.info, s0, s1 });
  }
  return { recs, fails };
}

// SPEC §3 accept filter under one world's band. Returns null (accept) or the first failing reason.
function accept(rec, band) {
  const m = band.spare ? rec.s1 : rec.s0;
  if (!m.win || m.capped) return m.capped ? "capped" : "no-win";
  if (!m.orderMatters) return "greedy-solves";
  if (m.min < band.min[0] || m.min > band.min[1]) return "min-band";
  if (m.randWin < band.randWin[0] || m.randWin > band.randWin[1]) return "random-win-band";
  if (m.sections > band.maxSections) return "too-many-sections";
  if (band.chest && !m.chests) return "no-chest";
  if (band.chest === "optimal" && !m.chestOnOptimal) return "chest-off-line";
  if (band.chest === "required" && !m.chestRequired) return "chest-not-required";
  if (band.levers && !m.leversMatter) return "levers-idle";
  return null;
}

module.exports = { generate, measure, batch, accept, withSpare, hashStr };
