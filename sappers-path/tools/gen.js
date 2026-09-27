// Sapper's Path board generator + per-board metrics (SPEC §3). Node only; every number comes from bake-config.json.
// generate(): Voronoi blobs cut into pieces by layer (ring around a centred keep, with wobble) → each piece is wall,
//   courtyard or moat by W.bands, with divider/gap noise → walls take materials that never merge across layers
//   → world elements by rule (iron doors + levers, then one chest).
//   The muster is the unlimited-crew optimal line's crew mix, so min crews is known before the real solve.
// measure(): real solve + greedy + seeded random playouts for one muster.
// batch(): n boards from one seed, each measured with spare 0 and spare +1. Used by report.js and bake.js.
// M0b (tools/m0-decision.md): castle() is the castle-plan generator the bake now uses; generate() stays as the M0
//   generator so the report can measure before and after with the same metrics.
"use strict";
const E = require("../src/engine.js");
const S = require("../src/solver.js");

const pick = (rng, a) => a[Math.floor(rng() * a.length)];
const cheb = (x, y, kx, ky) => Math.max(Math.abs(x - kx), Math.abs(y - ky));
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// M0 generator (kept for the before/after report). One board. Returns {level, info} or {fail: reason}.
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

// ---- M0b castle generator (tools/m0-decision.md items 1, 2, 4, 5) ------------------------------------------------
// A board is a castle plan read from the keep outward. W.plans[size] is one role per Chebyshev ring from the keep:
// K keep, W curtain wall, F iron keep ring (door 1), O courtyard, M moat band; the edge always takes the last role.
// Consecutive W rings form one curtain (1-2 thick), cut by angle into a few long arcs (W.segs: keep, mid, outer
// curtain); a 2-thick arc may be layered into two materials (W.layered). Courtyards get radial dividers and moat bands
// get radial bridges ("gates": never a single tile). Materials are a colouring where pieces of different runs never
// share a material, so no section ever spans two rings. World 4 seals lever 1 for the iron keep ring in a courtyard
// divider (the lever flanked by one-tile seal walls). Depth comes from the muster (musterFor), not from more rings.
const TAU = Math.PI * 2;
const randInt = (rng, a) => a[0] + Math.floor(rng() * (a[1] - a[0] + 1));
function shuffle(rng, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

function castle(W, C, rng) {
  const w = pick(rng, W.sizes), h = w, n = w * h;
  const kx = ((w - 1) >> 1) + (w % 2 === 0 && rng() < 0.5 ? 1 : 0), ky = ((h - 1) >> 1) + (h % 2 === 0 && rng() < 0.5 ? 1 : 0);
  const keep = ky * w + kx, plan = pick(rng, W.plans[w]), last = plan.length - 1;
  const X = (c) => c % w, Y = (c) => (c / w) | 0;
  const nb4 = (c) => [X(c) > 0 ? c - 1 : -1, X(c) < w - 1 ? c + 1 : -1, c >= w ? c - w : -1, c < n - w ? c + w : -1];
  // Runs: consecutive rings with one role. A cell's ring is its Chebyshev distance, or the last ring on the edge.
  const runOf = new Int8Array(plan.length).fill(-1), runs = [];
  for (let d = 1; d <= last; d++) {
    if (d > 1 && plan[d] === plan[d - 1]) { runOf[d] = runOf[d - 1]; runs[runOf[d]].b = d; }
    else { runOf[d] = runs.length; runs.push({ role: plan[d], a: d, b: d }); }
  }
  const ring = new Int8Array(n), run = new Int8Array(n).fill(-1), g = new Array(n).fill(".");
  for (let c = 0; c < n; c++) {
    if (c === keep) { g[c] = "K"; continue; }
    const onEdge = X(c) === 0 || X(c) === w - 1 || Y(c) === 0 || Y(c) === h - 1, d = onEdge ? last : Math.min(last, cheb(X(c), Y(c), kx, ky));
    ring[c] = d; run[c] = runOf[d];
    g[c] = plan[d] === "O" ? "." : plan[d] === "M" ? "~" : plan[d] === "F" ? "F" : "W";
  }

  // Curtain arcs. P[i] = {run, cells, gate}; piece[c] = its piece.
  const piece = new Int16Array(n).fill(-1), P = [], mat = [], keyMap = new Map();
  const cutAt = runs.map((R) => {
    if (R.role !== "W") return null;
    const k = randInt(rng, W.segs[R.b === last ? "outer" : R.a === 1 ? "keep" : "mid"]), off = rng(), cuts = [];
    for (let i = 0; i < k; i++) cuts.push((off + (i + (rng() - 0.5) * W.cutJitter) / k + 1) % 1);
    return { cuts: cuts.sort((a, b) => a - b), layered: cuts.map(() => R.b > R.a && rng() < W.layered) };
  });
  for (let c = 0; c < n; c++) {
    if (g[c] !== "W") continue;
    const r = run[c], cu = cutAt[r], t = (Math.atan2(Y(c) - ky, X(c) - kx) / TAU + 1) % 1;
    let s = cu.cuts.length - 1; for (let i = 0; i < cu.cuts.length; i++) if (t >= cu.cuts[i]) s = i;
    const key = r * 256 + s * 4 + (cu.layered[s] ? 1 + ring[c] - runs[r].a : 0);
    if (!keyMap.has(key)) { keyMap.set(key, P.length); P.push({ run: r, cells: [], gate: null }); }
    piece[c] = keyMap.get(key); P[piece[c]].cells.push(c);
  }
  // A square ring cut by angle can leave stray fragments or tiny arcs: fold them into the best same-run neighbour.
  for (let i = 0; i < P.length; i++) {
    const comps = [], seen = new Set();
    for (const c0 of P[i].cells) {
      if (seen.has(c0)) continue;
      const comp = [c0]; seen.add(c0);
      for (let j = 0; j < comp.length; j++) for (const e of nb4(comp[j])) if (e >= 0 && piece[e] === i && !seen.has(e)) { seen.add(e); comp.push(e); }
      comps.push(comp);
    }
    comps.sort((a, b) => b.length - a.length);
    for (let ci = 0; ci < comps.length; ci++) {
      if (ci === 0 && comps[0].length >= W.minPiece) continue;
      const votes = new Map();
      for (const c of comps[ci]) for (const e of nb4(c)) if (e >= 0 && piece[e] >= 0 && piece[e] !== i && P[piece[e]].run === P[i].run) votes.set(piece[e], (votes.get(piece[e]) || 0) + 1);
      let best = -1, bv = 0; for (const [q, v] of votes) if (v > bv) { best = q; bv = v; }
      if (best < 0) continue;
      for (const c of comps[ci]) { piece[c] = best; P[best].cells.push(c); }
    }
    P[i].cells = P[i].cells.filter((c) => piece[c] === i);
  }
  // Colour the curtains outside in: never a material a piece of another run already touches (hard), and avoid the
  // neighbouring arcs of the same curtain (soft; a forced repeat just makes one longer arc).
  const adj = (i) => { const o = new Set(); for (const c of P[i].cells) for (const e of nb4(c)) if (e >= 0 && piece[e] >= 0 && piece[e] !== i) o.add(piece[e]); return o; };
  const colour = (i) => {
    const hard = new Set(), soft = new Set();
    for (const o of adj(i)) if (mat[o]) (P[o].run !== P[i].run ? hard : soft).add(mat[o]);
    const opts = W.mats.filter((q) => !hard.has(q)), pref = opts.filter((q) => !soft.has(q));
    if (!opts.length) return false;
    mat[i] = pick(rng, pref.length ? pref : opts); return true;
  };
  const order = P.map((_, i) => i).filter((i) => P[i].cells.length).sort((a, b) => P[b].run - P[a].run || a - b);
  for (const i of order) if (!colour(i)) return { fail: "colour" };

  // Gates: radial lines across a courtyard (dividers), a moat band (bridges) or beside lever 1 (seals). side 0-3 is
  // N/E/S/W, o the offset along that side (never a corner), d the ring. Gates never touch another gate or a lever.
  const onSide = (side, o, d) => {
    const x = side === 0 ? kx + o : side === 1 ? kx + d : side === 2 ? kx - o : kx - d, y = side === 0 ? ky - d : side === 1 ? ky + o : side === 2 ? ky + d : ky - o;
    return x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x;
  };
  const gateCells = (r, side, o, width, seal) => {   // seal: the cells may touch the lever they seal
    const R = runs[r], out = [];
    for (let k = 0; k < width; k++) for (let d = R.a; d <= R.b; d++) { const c = onSide(side, o + k, d); if (c < 0 || run[c] !== r || ring[c] !== d || piece[c] >= 0 || g[c] === "L") return null; out.push(c); }
    for (const c of out) for (const e of nb4(c)) if (e >= 0 && !out.includes(e) && ((g[e] === "L" && e !== seal) || (piece[e] >= 0 && P[piece[e]].gate))) return null;
    return out;
  };
  const addGate = (cells, kind) => {
    const i = P.length; P.push({ run: run[cells[0]], cells, gate: kind });
    for (const c of cells) piece[c] = i;
    if (colour(i)) return true;
    for (const c of cells) piece[c] = -1; P.pop(); return false;
  };
  let seals = 0, levers = 0;
  for (let r = 0; W.lever && r < runs.length; r++) {
    const R = runs[r];
    if (R.role !== "O" || plan[R.a - 1] !== "F") continue;
    for (let t = 0, want = rng() < W.lever.second ? 2 : 1; levers < want && t < 40; t++) {
      const side = Math.floor(rng() * 4), both = levers === 0 && rng() < W.lever.sealBoth, o = both ? 0 : pick(rng, [-1, 0, 1]);
      const Lc = onSide(side, o, R.a);
      if (Lc < 0 || run[Lc] !== r || piece[Lc] >= 0 || g[Lc] !== "." || nb4(Lc).some((e) => e >= 0 && (g[e] === "L" || (piece[e] >= 0 && P[piece[e]].gate)))) continue;
      const fl = levers > 0 ? [] : both ? [o - 1, o + 1] : [o + (rng() < 0.5 ? -1 : 1)];
      if (fl.some((f) => Math.abs(f) > R.a - 1)) continue;
      g[Lc] = "L";
      const made = [];
      for (const f of fl) { const cells = gateCells(r, side, f, 1, Lc); if (cells && addGate(cells, "seal")) made.push(P.length - 1); }
      if (made.length < fl.length) { g[Lc] = "."; for (const i of made) { for (const c of P[i].cells) piece[c] = -1; P[i].cells = []; } continue; }
      levers++; seals += made.length;
    }
    if (!levers) return { fail: "lever" };
  }
  for (let r = 0; r < runs.length; r++) {
    const R = runs[r];
    if (R.role !== "O" && R.role !== "M") continue;
    const want = randInt(rng, R.role === "O" ? W.dividers : W.bridges), width = R.b > R.a ? 1 : 2;
    for (let t = 0, made = 0; made < want && t < 60; t++) {
      const side = Math.floor(rng() * 4), o = -(R.a - 1) + Math.floor(rng() * (2 * R.a - width));
      const cells = gateCells(r, side, o, width);
      if (cells && addGate(cells, R.role === "O" ? "divider" : "bridge")) made++;
    }
  }
  for (let c = 0; c < n; c++) if (piece[c] >= 0) g[c] = mat[piece[c]];
  if (g.includes("W")) return { fail: "colour" };
  const rows = () => Array.from({ length: h }, (_, y) => g.slice(y * w, y * w + w).join(""));

  // Depth through scarcity: the muster, then the chest, then a spare that keeps the min.
  const level = { w, h, grid: rows(), muster: {}, chests: [] };
  let B; try { B = E.parse(level); } catch (e) { return { fail: "parse" }; }
  if (E.start(B).won) return { fail: "trivial" };
  const q = S.quickest(B, { cap: C.quickCap });
  if (q.capped) return { fail: "quick-capped" };
  if (!q.win) return { fail: "no-win" };
  const present = []; for (let s = 0; s < B.nsec; s++) if (B.secMat[s] < E.IRON && !present.includes(B.secMat[s])) present.push(B.secMat[s]);
  const c0 = [0, 0, 0, 0]; for (const s of q.line) c0[B.secMat[s]]++;
  const found = musterFor(level, W, C, rng, present, q.min);
  const comp = found ? found.comp : c0;
  level.muster = E.musterObj(comp);
  const r0 = found ? found.r : S.solve(E.parse(level), { cap: C.cap });
  if (!r0.win || r0.capped) return { fail: "no-win" };
  const info = { plan, straight: q.min, depth: found ? "scarce" : "straight", hits: found ? found.hits : null, seals, levers, chestMode: null, spareCrew: null };

  // World 2+: one chest. "required": in a pocket the optimal line opens at step j, holding a crew a later step needs
  // (the muster drops that crew, so every 3-star line claims it). "detour" (W.detour of boards): in a pocket off the
  // line, so reaching it costs a break and returns a crew of another kind.
  if (W.chests) {
    const D = E.scratch(B), br = new Uint8Array(B.nsec), seen = E.derive(B, br, E.scratch(B)).conn.slice(), steps = [];
    for (let j = 0; j < r0.line.length; j++) {
      br[r0.line[j]] = 1; E.derive(B, br, D);
      for (let c = 0; c < n; c++) if (g[c] === "." && D.conn[c] && !seen[c]) { steps.push({ c, j }); seen[c] = 1; }
    }
    const off = []; for (let c = 0; c < n; c++) if (g[c] === "." && !seen[c]) off.push(c);
    const onLine = steps.filter((o) => o.j < r0.line.length - 1);
    let mode = rng() < W.detour ? "detour" : "required";
    if (mode === "detour" && !off.length) mode = "required";
    if (mode === "required" && !onLine.length) mode = off.length ? "detour" : null;
    if (mode === "required") {
      const o = pick(rng, onLine), t = B.secMat[r0.line[o.j + 1 + Math.floor(rng() * (r0.line.length - o.j - 1))]];
      g[o.c] = "C"; level.chests = [{ x: X(o.c), y: Y(o.c), crew: E.CREWS[t] }]; comp[t]--;
    } else if (mode === "detour") {
      const c = pick(rng, off), lack = present.filter((m) => !comp[m]), t = pick(rng, lack.length ? lack : present);
      g[c] = "C"; level.chests = [{ x: X(c), y: Y(c), crew: E.CREWS[t] }];
    }
    level.grid = rows(); level.muster = E.musterObj(comp); info.chestMode = mode;
  }
  const r1 = S.solve(E.parse(level), { cap: C.cap });
  if (!r1.win || r1.capped) return { fail: "no-win" };
  for (const m of shuffle(rng, present.slice())) {
    const r2 = S.solve(E.parse(withSpare(level, E.CREWS[m], 1)), { cap: C.cap });
    if (r2.win && !r2.capped && r2.min === r1.min) { info.spareCrew = E.CREWS[m]; break; }
  }
  if (!info.spareCrew) { info.spareCrew = E.CREWS[pick(rng, present)]; info.spareLowersMin = true; }
  info.k = r1.min;
  return { level, info };
}

// Depth through scarcity: a crew mix of k (k in W.depth, never below the straight route) whose best line uses every
// crew, so no shorter route is affordable and the player has to choose which walls to spend on. Exhaustive over the
// mixes of the board's materials (at most 84 at k 6 with four materials; a tight-muster solve is well under 1 ms).
// Picks a random k that has hits, then a random hit. Returns {comp, k, r, hits:{k: count}} or null.
function musterFor(level, W, C, rng, present, m0) {
  const hits = {}, found = {};
  const mixes = (k, i, comp, out) => { if (i === present.length - 1) { comp[present[i]] = k; out.push(comp.slice()); comp[present[i]] = 0; return; } for (let v = k; v >= 0; v--) { comp[present[i]] = v; mixes(k - v, i + 1, comp, out); } comp[present[i]] = 0; };
  for (let k = Math.max(m0, W.depth[0]); k <= W.depth[1]; k++) {
    const all = []; mixes(k, 0, [0, 0, 0, 0], all);
    for (const comp of all.slice(0, C.musterTries)) {
      level.muster = E.musterObj(comp);
      const r = S.solve(E.parse(level), { cap: C.cap });
      if (r.win && !r.capped && r.min === k) (found[k] = found[k] || []).push({ comp, k, r });
    }
    hits[k] = found[k] ? found[k].length : 0;
  }
  const ks = Object.keys(found);
  if (!ks.length) return null;
  const f = pick(rng, found[pick(rng, ks)]);
  return Object.assign({ hits }, f);
}

function withSpare(level, crew, k) { const L = JSON.parse(JSON.stringify(level)); if (k) L.muster[crew] = (L.muster[crew] | 0) + k; return L; }

// Metrics for one level as given (its muster included). M0b adds the trap proxy, decision points, board shape
// (all wall sections incl. iron, stray single tiles, deliberate lever seals) and the chest kind.
function measure(L, C) {
  const B = E.parse(L), r = S.solve(B, { cap: C.cap }), gr = S.greedy(B), p = S.playouts(B, C.playouts, hashStr(L.grid.join("") + JSON.stringify(L.muster)));
  let crewSecs = 0, iron = 0, singles = 0, seals = 0;
  for (let s = 0; s < B.nsec; s++) {
    if (B.secMat[s] < E.IRON) crewSecs++; else iron++;
    if (B.secStart[s + 1] - B.secStart[s] !== 1) continue;
    const c = B.secCells[B.secStart[s]];
    let lever = false; for (let d = 0; d < 4; d++) { const e = B.nb[c * 4 + d]; if (e >= 0 && B.kind[e] === E.LEVER) lever = true; }
    if (lever) seals++; else singles++;
  }
  const m = {
    sections: crewSecs, iron, walls: crewSecs + iron, singles, seals, cells: B.n, win: r.win, min: r.min, capped: r.capped, states: r.states, dead: r.dead, lost: r.lost, wins: r.wins,
    deadRatio: r.states ? r.dead / r.states : 0, lostRatio: r.states ? r.lost / r.states : 0, ms: r.ms,
    randWin: p.winRate, greedyWin: gr.win, greedyUsed: gr.used, greedyExcess: gr.win && r.win ? gr.used - r.min : null,
    orderMatters: r.win && (!gr.win || gr.used - r.min >= 2), line: r.line,
    chests: B.chestCell.length, chestOnOptimal: r.chestOnOptimal, chestRequired: r.chestRequired, minChest: r.minChest, minNoChest: r.minNoChest,
    chestKind: null, levers: B.levers.length, leversMatter: null, trapRate: 0, decisions: 0, choices: 0, lineTrap: 0,
  };
  // Chest kind: required (every 3-star line claims it), detour (claimable for at most one extra break, not required), idle.
  if (B.chestCell.length && r.win) m.chestKind = r.chestRequired ? "required" : r.minChest != null && r.minChest <= r.min + 1 ? "detour" : "idle";
  if (B.levers.length && r.win) { const r2 = S.solve(E.parse(L, { noLevers: true }), { cap: C.cap }); m.leversMatter = r2.capped ? null : (!r2.win || r2.min > r.min); }
  if (r.win) { const t = S.traps(B, { cap: C.cap, line: r.line }); m.trapRate = t.trapRate; m.decisions = t.decisions; m.choices = t.choices; m.lineTrap = t.lineTrap; }
  if (r.error) m.error = r.error;
  return m;
}

// n boards for world wk from one seed. mode "m0" runs the M0 generator on C.m0.worlds (the before column);
// otherwise castle() on C.worlds. Returns {recs:[{seed, idx, level, info, s0, s1}], fails:{reason: count}}.
function batch(C, wk, seed, n, mode) {
  const m0 = mode === "m0", W = m0 ? C.m0.worlds[wk] : C.worlds[wk], gen = m0 ? generate : castle, rng = S.mulberry32(seed), recs = [], fails = {};
  for (let made = 0, tries = 0; made < n && tries < n * C.triesPerBoard; tries++) {
    const r = gen(W, C, rng);
    if (r.fail) { fails[r.fail] = (fails[r.fail] || 0) + 1; continue; }
    made++;
    const s0 = measure(r.level, C), s1 = measure(withSpare(r.level, r.info.spareCrew, 1), C);
    recs.push({ world: +wk, seed, idx: made - 1, level: r.level, info: r.info, s0, s1 });
  }
  return { recs, fails };
}

// M0 accept filter (kept for the before column). Returns null (accept) or the first failing reason.
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

// M0b accept filter (SPEC §3 + tools/m0-decision.md). Returns null (accept) or the first failing reason.
function acceptB(rec, band) {
  const m = band.spare ? rec.s1 : rec.s0;
  if (!m.win || m.capped) return m.capped ? "capped" : "no-win";
  if (m.walls > band.maxSections) return "section-cap";
  if (m.singles > band.maxSingles) return "singletons";
  if (m.min < band.min[0] || m.min > band.min[1]) return "min-band";
  if (band.greedy !== false && !m.orderMatters) return "greedy-solves";
  if (m.decisions < (band.decisions || 0)) return "few-decisions";
  if (band.randWin && (m.randWin < band.randWin[0] || m.randWin > band.randWin[1])) return "random-win-band";
  if (band.trap && (m.trapRate < band.trap[0] || m.trapRate > band.trap[1])) return "trap-band";
  if (band.chest && m.chestKind !== "required" && m.chestKind !== "detour") return "chest-idle";
  if (band.levers && !m.leversMatter) return "levers-idle";
  return null;
}

module.exports = { generate, castle, musterFor, measure, batch, accept, acceptB, withSpare, hashStr };
