// Sapper's Path v2 board generator + per-board metrics (SPEC-v2 §4-5). Node only; every number comes from bake-config.json.
// castle():    a castle-plan PICTURE (no muster yet). The castle rectangle sits in a field with the siege camp on the
//              board edge (usually the bottom). Outer curtain several blocks thick, cut by angle into a few big arcs;
//              corner towers (round or square) bulge out of it; a gatehouse faces the camp, optionally behind a barbican
//              (a walled gate passage). Single-ring castles (Worlds 1-2): the courtyard may hold a cross wall (divider)
//              and buildings (the "closest" decoys). Concentric castles (W.inner, Worlds 3-4, M0c): an inner curtain with
//              its own towers and gatehouse on any side, a bailey between the curtains cut by cross walls (W.radial) and
//              holding buildings and hedge gardens, more buildings in the inner ward. The keep block sits inside its own
//              ring (World 4: an iron ring, opened by a lever inside a small lever house). World 3+ adds a curving moat
//              around the whole footprint with breakable bridges; outworks and a palisade fill the front field.
//              Materials are a colouring where pieces of different groups (outer / bridges / barbican / field / bailey /
//              inner curtain / ward / keep ring) never share a material, so no section spans two layers.
//              fix-v2: towers flank the gate (a gatehouse), the camp is a patch W.camp.w wide and W.camp.depth deep centred
//              on the bottom edge, and info.art carries the tower and gate rects and the keep for levels' `art` field.
// musterize(): depth through scarcity for ONE rule. The solver's Pareto frontier lists every crew mix whose every win
//              spends exactly that mix; pick a length k in W.depth (random k that has hits), then among up to
//              C.musterEval mixes of that k the one with the most decision points (then reshapes, then trap rate).
//              Then the chest (required or detour, as v1) and the spare (W.spare crews that keep the min, keep a required
//              chest required, and keep band.decisions; the one leaving a slower win and the most decision points).
// deal():      Rule A + stacks: the A level's crews dealt into C.stacks.k columns, the winnable deal with the most
//              decision points among C.stacks.eval tries.
// measure():   solve (+ traps, ties, reshapes, slow win, closest margin) + greedy + seeded random playouts + one-card
//              spam + board shape for one level.
// batch():     n boards for one world from one seed, measured under the requested variants (A, B, AS).
"use strict";
const E = require("../src/engine.js");
const S = require("../src/solver.js");

const pick = (rng, a) => a[Math.floor(rng() * a.length)];
const randInt = (rng, a) => a[0] + Math.floor(rng() * (a[1] - a[0] + 1));
function shuffle(rng, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const OUTER = 1, YARD = 2, INNER = 3, BRIDGE = 4, FIELD = 5, MID = 6, WARD = 7, BARB = 8;
// Colouring order by group, outside in: outer curtain, bridges, barbican, field, bailey, inner curtain, ward, keep ring.
const RANK = [0, 1, 5, 8, 2, 4, 6, 7, 3];

// One-card spam: the crew (name) that wins by calling only its own card again and again, else null (non-stacks only).
function spamOf(B) {
  for (let k = 0; k < 4 && !B.cols; k++) {
    if (!B.muster[k]) continue;
    let s = E.start(B);
    for (let t = 0; t < B.maxCalls && !s.won; t++) { const nx = E.call(B, s, k); if (!nx) break; s = nx; }
    if (s.won) return E.CREWS[k];
  }
  return null;
}
// A required chest really is required: with the chest taken off the board there is no win, or only a longer one.
function chestNeeded(L, min, C) {
  const L2 = Object.assign({}, L, { grid: L.grid.map((row) => row.replace("C", ".")), chests: [] }), r = S.solve(E.parse(L2), { cap: C.cap, traps: false });
  return !r.capped && (!r.win || r.min > min);
}
// Muster score (musterize, the spare): decision points first, a reshape, traps, depth; ties, one-card spam and a closest
// margin under band.margin cost it.
const mscore = (r, spam, band) => r.decisions * 4 + (r.reshapes > 0 ? 2 : 0) + r.trapRate + 0.25 * r.min - (r.tieMove ? 8 : 0) - (spam ? 12 : 0) - (band && band.margin && r.margin !== null && r.margin < band.margin ? 6 : 0);

// One castle picture. Returns {level, info} or {fail: reason}.
function castle(W, C, rng) {
  const [w, h] = pick(rng, W.sizes), n = w * h;
  const X = (c) => c % w, Y = (c) => (c / w) | 0, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x);
  const nb4 = (c) => [X(c) > 0 ? c - 1 : -1, X(c) < w - 1 ? c + 1 : -1, c >= w ? c - w : -1, c < n - w ? c + w : -1];
  const M = W.margin, x0 = randInt(rng, M.side), x1 = w - 1 - randInt(rng, M.side), y0 = randInt(rng, M.top), y1 = h - 1 - randInt(rng, M.front);
  const T = randInt(rng, W.curtain.thick), ccx = (x0 + x1) / 2, ccy = (y0 + y1) / 2;
  const cxL = x0 + T, cxR = x1 - T, cyT = y0 + T, cyB = y1 - T;
  const g = new Array(n).fill("."), piece = new Int16Array(n).fill(-1), P = [];
  const add = (group, kind) => { P.push({ group, kind, cells: [], mat: null }); return P.length - 1; };
  const own = (c, i) => { if (piece[c] >= 0) P[piece[c]].cells = P[piece[c]].cells.filter((q) => q !== c); piece[c] = i; P[i].cells.push(c); };
  const freeIn = (c, r) => c >= 0 && role[c] === r && piece[c] < 0 && g[c] === ".";
  // role: 0 field, 1 outer curtain, 2 courtyard (the outer bailey when there is an inner ring), 3 inner curtain, 4 inner ward.
  const role = new Uint8Array(n);
  for (let c = 0; c < n; c++) { const x = X(c), y = Y(c); if (x >= x0 && x <= x1 && y >= y0 && y <= y1) role[c] = Math.min(x - x0, x1 - x, y - y0, y1 - y) < T ? 1 : 2; }
  const info = { w, h, T, towers: 0, towersRead: 0, gate: null, divider: 0, buildings: 0, gardens: 0, wardBuildings: 0, radial: 0, barbican: false, outworks: 0, inner: false, innerGate: null, moat: false, bridges: 0, palisade: 0, keep: 0, lever: false, camp: "bottom" };

  // Corner towers of one ring: round or square, radius TW.r, never entering the ring's inside (inside(c)) or another group.
  const towers = (TW, ax, ay, bx, by, t, inside, group) => {
    const off = (t - 1) / 2;
    for (const [cx, cy] of [[ax + off, ay + off], [bx - off, ay + off], [ax + off, by - off], [bx - off, by - off]]) {
      if (rng() >= TW.p) continue;
      const r = randInt(rng, TW.r), round = rng() < TW.round, i = add(group, "tower");
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const c = at(x, y), dx = x - cx, dy = y - cy;
        if (c < 0 || inside(c) || (piece[c] >= 0 && P[piece[c]].group !== group)) continue;
        if (round ? dx * dx + dy * dy <= r * r + 0.3 : Math.abs(dx) <= r - 0.5 && Math.abs(dy) <= r - 0.5) own(c, i);
      }
      if (P[i].cells.length) info.towers++;
    }
  };
  // Cut a ring's leftover cells into k arcs by angle around (cx, cy), with jittered cuts.
  const arcs = (cells, group, kind, k, cx, cy) => {
    const o0 = rng(), cuts = [];
    for (let i = 0; i < k; i++) cuts.push((o0 + (i + (rng() - 0.5) * W.curtain.cutJitter) / k + 1) % 1);
    cuts.sort((a, b) => a - b);
    const ap = cuts.map(() => -1);
    for (const c of cells) {
      const t = (Math.atan2(Y(c) - cy, X(c) - cx) / TAU + 1) % 1;
      let s = cuts.length - 1; for (let i = 0; i < cuts.length; i++) if (t >= cuts[i]) s = i;
      if (ap[s] < 0) ap[s] = add(group, kind);
      own(c, ap[s]);
    }
  };
  // Free-standing blocks in one region of role r with a clear ring (the "closest" decoys): buildings, gardens, outworks.
  const blocks = (spec, r, group, kind, rx0, ry0, rx1, ry1, edgeOk) => {
    if (!spec) return 0;
    let made = 0;
    const want = randInt(rng, spec.n);
    for (let t = 0; made < want && t < 60; t++) {
      const bw = randInt(rng, spec.w), bh = randInt(rng, spec.h);
      if (rx1 - bw + 1 < rx0 || ry1 - bh + 1 < ry0) break;
      const bx = randInt(rng, [rx0, rx1 - bw + 1]), by = randInt(rng, [ry0, ry1 - bh + 1]);
      let ok = true;
      for (let y = by - 1; y <= by + bh && ok; y++) for (let x = bx - 1; x <= bx + bw && ok; x++) { const c = at(x, y); if (c < 0 ? !edgeOk : role[c] === r && !freeIn(c, r)) ok = false; }
      for (let y = by; y < by + bh && ok; y++) for (let x = bx; x < bx + bw && ok; x++) if (!freeIn(at(x, y), r)) ok = false;
      if (!ok) continue;
      const i = add(group, kind);
      for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) own(at(x, y), i);
      made++;
    }
    return made;
  };

  // Outer towers bulge out of the four corners (never into the courtyard).
  const TW = W.towers;
  towers(TW, x0, y0, x1, y1, T, (c) => role[c] >= 2, OUTER);
  // Gatehouse on the front (camp) side, between the towers, through the curtain and out one row.
  const GT = W.gate, gw = randInt(rng, GT.w), gin = randInt(rng, GT.in), gout = randInt(rng, GT.out);
  let gx0 = -1;
  for (let t = 0; t < 20 && gx0 < 0; t++) {
    const x = Math.round(ccx - gw / 2 + 0.5) + randInt(rng, GT.shift);
    let ok = x > x0 + T && x + gw - 1 < x1 - T;
    for (let y = y1 - T + 1 - gin; ok && y <= y1 + gout; y++) for (let k = 0; k < gw && ok; k++) { const c = at(x + k, y); if (c < 0 || piece[c] >= 0) ok = false; }
    if (ok) gx0 = x;
  }
  if (gx0 < 0) return { fail: "gate" };
  const gi = add(OUTER, "gate");
  for (let y = y1 - T + 1 - gin; y <= y1 + gout; y++) for (let k = 0; k < gw; k++) own(at(gx0 + k, y), gi);
  info.gate = { x: gx0, w: gw };
  const gcx = gx0 + (gw - 1) / 2;
  // Barbican: a walled gate passage (a U against the curtain) in front of the gatehouse. A decoy and a picture piece.
  const BA = W.barbican;
  let front = y1 + gout;
  const passage = [];   // the barbican passage counts as footprint, so the moat wraps outside it
  if (BA && rng() < BA.p) {
    const pad = randInt(rng, BA.pad), dep = randInt(rng, BA.depth), th = randInt(rng, BA.thick);
    const lx = gx0 - pad - th, rx = gx0 + gw - 1 + pad + th, by = y1 + gout + dep + th, cells = [];
    let ok = lx >= 0 && rx < w && by <= h - 1 - BA.clear;
    for (let y = y1 + 1; ok && y <= by; y++) for (let x = lx; x <= rx && ok; x++) {
      const c = at(x, y);
      if (x < lx + th || x > rx - th || y > by - th) { if (!freeIn(c, 0)) ok = false; else cells.push(c); }
      else if (c < 0 || role[c] !== 0 || (piece[c] >= 0 && piece[c] !== gi)) ok = false;
      else if (y > y1 + gout || piece[c] < 0) passage.push(c);
    }
    if (!ok) passage.length = 0;
    else { const i = add(BARB, "barbican"); for (const c of cells) own(c, i); front = by; info.barbican = true; }
  }
  // Gatehouse towers: one either side of the gate, from the curtain's second row out GT.flank.out rows past the gate
  // (the curtain's inner row stays behind them, so a tower is never a breach). They take only unowned cells outside the
  // courtyard and off the barbican passage, so a barbican's U stays whole.
  const FL = GT.flank;
  if (FL) {
    const fw = randInt(rng, FL.w), yb = y1 + gout + randInt(rng, FL.out), pas = new Set(passage);
    for (const sx of [gx0 - fw, gx0 + gw]) {
      const i = add(OUTER, "tower");
      for (let y = y1 - T + 2; y <= yb; y++) for (let x = sx; x < sx + fw; x++) { const c = at(x, y); if (c >= 0 && role[c] < 2 && piece[c] < 0 && g[c] === "." && !pas.has(c)) own(c, i); }
      if (P[i].cells.length) info.towers++;
    }
  }
  // Outer curtain arcs: what the towers and gate left.
  const rest = []; for (let c = 0; c < n; c++) if (role[c] === 1 && piece[c] < 0) rest.push(c);
  arcs(rest, OUTER, "arc", randInt(rng, W.curtain.arcs), ccx, ccy);

  // Inner curtain (concentric castles): a second ring inside the courtyard, with a bailey between the two, its own
  // corner towers and gatehouse (on any side, so the bailey is a walk), cut into arcs. The keep sits in its ward.
  const IN = W.inner;
  let wL = cxL, wR = cxR, wT = cyT, wB = cyB, inRole = 2, ix0 = 0, ix1 = 0, iy0 = 0, iy1 = 0;
  if (IN) {
    const bs = randInt(rng, IN.side), bb = randInt(rng, IN.back), bf = randInt(rng, IN.front), Tm = randInt(rng, IN.thick);
    ix0 = cxL + bs; ix1 = cxR - bs; iy0 = cyT + bb; iy1 = cyB - bf;
    if (ix1 - ix0 + 1 - 2 * Tm < IN.ward[0] || iy1 - iy0 + 1 - 2 * Tm < IN.ward[1]) return { fail: "inner-room" };
    for (let c = 0; c < n; c++) { if (role[c] !== 2) continue; const x = X(c), y = Y(c); if (x >= ix0 && x <= ix1 && y >= iy0 && y <= iy1) role[c] = Math.min(x - ix0, ix1 - x, y - iy0, iy1 - y) < Tm ? 3 : 4; }
    wL = ix0 + Tm; wR = ix1 - Tm; wT = iy0 + Tm; wB = iy1 - Tm; inRole = 4;
    towers(IN.towers, ix0, iy0, ix1, iy1, Tm, (c) => role[c] === 4 || role[c] === 1, MID);
    const side = pick(rng, IN.gate.sides), gw2 = randInt(rng, IN.gate.w);
    for (let t = 0; t < 20 && !info.innerGate; t++) {
      const cells = [], horiz = side === "bottom" || side === "top";
      const lo = (horiz ? ix0 : iy0) + Tm, hi = (horiz ? ix1 : iy1) - Tm - gw2 + 1;
      if (hi < lo) break;
      const a = randInt(rng, [lo, hi]), s0 = side === "bottom" ? iy1 - Tm + 1 : side === "top" ? iy0 : side === "right" ? ix1 - Tm + 1 : ix0;
      for (let d = s0; d < s0 + Tm; d++) for (let k = 0; k < gw2; k++) cells.push(horiz ? at(a + k, d) : at(d, a + k));
      if (cells.some((c) => c < 0 || role[c] !== 3 || piece[c] >= 0)) continue;
      const i = add(MID, "gate"); for (const c of cells) own(c, i);
      info.innerGate = side;
    }
    const irest = []; for (let c = 0; c < n; c++) if (role[c] === 3 && piece[c] < 0) irest.push(c);
    arcs(irest, MID, "arc", randInt(rng, IN.arcs), (ix0 + ix1) / 2, (iy0 + iy1) / 2);
    info.inner = true;
  }

  // Keep block at the back of its ward inside its own ring (rounded corners when 2 thick).
  const KP = W.keep, ks = randInt(rng, KP.size), Ti = randInt(rng, KP.ring), yd = KP.yard;
  const kxMin = wL + yd + Ti, kxMax = wR - yd - Ti - ks + 1, kyMin = wT + yd + Ti, kyMax = wB - yd - Ti - ks + 1 - KP.front;
  if (kxMin > kxMax || kyMin > kyMax) return { fail: "room" };
  const kx0 = clamp(Math.round((wL + wR + 1 - ks) / 2) + randInt(rng, [-1, 1]), kxMin, kxMax), ky0 = clamp(kyMin + randInt(rng, KP.up), kyMin, kyMax);
  const kcx = kx0 + (ks - 1) / 2, kcy = ky0 + (ks - 1) / 2, ringCells = [];
  for (let y = ky0 - Ti; y < ky0 + ks + Ti; y++) for (let x = kx0 - Ti; x < kx0 + ks + Ti; x++) {
    const c = at(x, y), dx = x < kx0 ? kx0 - x : x >= kx0 + ks ? x - kx0 - ks + 1 : 0, dy = y < ky0 ? ky0 - y : y >= ky0 + ks ? y - ky0 - ks + 1 : 0;
    if (!dx && !dy) { g[c] = "K"; continue; }
    if (Ti >= 2 && dx === Ti && dy === Ti) continue;
    ringCells.push(c);
  }
  info.keep = ks;
  if (KP.iron) { const i = add(INNER, "iron"); P[i].mat = "F"; for (const c of ringCells) own(c, i); }
  else arcs(ringCells, INNER, "ring", randInt(rng, KP.arcs), kcx, kcy);
  const wardBottom = ky0 + ks + Ti - 1;
  const free = (c) => freeIn(c, inRole);

  // World 4: the lever sits against the iron ring's outer face, closed in by a small lever house (3×2 less the lever).
  if (W.lever) {
    let placed = false;
    for (let t = 0; t < 30 && !placed; t++) {
      const side = pick(rng, W.lever.sides), along = randInt(rng, [0, ks - 1]);
      const L = side === "top" ? [kx0 + along, ky0 - Ti - 1] : side === "left" ? [kx0 - Ti - 1, ky0 + along] : side === "right" ? [kx0 + ks + Ti, ky0 + along] : [kx0 + along, ky0 + ks + Ti];
      const dir = side === "top" ? [0, -1] : side === "left" ? [-1, 0] : side === "right" ? [1, 0] : [0, 1], perp = [dir[1], dir[0]];
      const house = [];
      for (let a = -1; a <= 1; a++) for (let b = 0; b <= 1; b++) if (a || b) house.push(at(L[0] + perp[0] * a + dir[0] * b, L[1] + perp[1] * a + dir[1] * b));
      const Lc = at(L[0], L[1]);
      if (!free(Lc) || house.some((c) => !free(c))) continue;
      g[Lc] = "L";
      const i = add(IN ? WARD : YARD, "house"); for (const c of house) own(c, i);
      placed = true; info.lever = side;
    }
    if (!placed) return { fail: "lever" };
  }
  // Single-ring castles: a cross wall splits the courtyard into a front and a back bailey, cut into a few segments.
  const DV = W.divider;
  if (!IN && DV && rng() < DV.p) {
    const th = randInt(rng, DV.thick), top = wardBottom + 2, bot = cyB - 2 - th + 1;
    if (top <= bot) {
      const yv = randInt(rng, [top, bot]), segs = randInt(rng, DV.segs), cutsX = [];
      for (let i = 1; i < segs; i++) cutsX.push(cxL + Math.round(((cxR - cxL + 1) * i) / segs) + randInt(rng, [-1, 1]));
      let seg = -1, si = 0;
      for (let x = cxL; x <= cxR; x++) {
        if (seg < 0 || (si < cutsX.length && x >= cutsX[si])) { if (seg >= 0) si++; seg = add(YARD, "divider"); }
        for (let y = yv; y < yv + th; y++) { const c = at(x, y); if (free(c)) own(c, seg); }
      }
      info.divider = segs;
    }
  }
  // Concentric castles: cross walls span the bailey from curtain to curtain, cutting it into sectors (never side by side).
  const RA = W.radial;
  if (IN && RA) {
    const want = randInt(rng, RA.n);
    for (let b = 0, t = 0; b < want && t < 40; t++) {
      const th = randInt(rng, RA.thick), side = pick(rng, RA.sides), cells = [];
      if (side === "left" || side === "right") {
        if (iy1 - th < iy0 + 1) continue;
        const y = randInt(rng, [iy0 + 1, iy1 - th]), xa = side === "left" ? cxL : ix1 + 1, xb = side === "left" ? ix0 - 1 : cxR;
        for (let yy = y; yy < y + th; yy++) for (let x = xa; x <= xb; x++) cells.push(at(x, yy));
      } else {
        if (ix1 - th < ix0 + 1) continue;
        const x = randInt(rng, [ix0 + 1, ix1 - th]), ya = side === "top" ? cyT : iy1 + 1, yb = side === "top" ? iy0 - 1 : cyB;
        for (let y = ya; y <= yb; y++) for (let xx = x; xx < x + th; xx++) cells.push(at(xx, y));
      }
      if (!cells.length || cells.some((c) => !freeIn(c, 2) || nb4(c).some((e) => e >= 0 && piece[e] >= 0 && P[piece[e]].group === YARD))) continue;
      const i = add(YARD, "radial"); for (const c of cells) own(c, i);
      b++; info.radial++;
    }
  }
  // Buildings and gardens (hedge) in the courtyard or bailey; more buildings in the inner ward.
  info.buildings = blocks(W.buildings, 2, YARD, "building", cxL, cyT, cxR, cyB, false);
  info.gardens = blocks(W.gardens, 2, YARD, "garden", cxL, cyT, cxR, cyB, false);
  if (IN) info.wardBuildings = blocks(W.wardBuildings, 4, WARD, "building", wL, wT, wR, wB, false);

  // Moat: a band around the whole footprint (curtain, towers, gate, barbican), wobbled by angle; bridges cross it.
  const MO = W.moat;
  if (MO && rng() < MO.p) {
    const foot = new Uint8Array(n); for (let c = 0; c < n; c++) if (role[c] === 1 || (piece[c] >= 0 && (P[piece[c]].group === OUTER || P[piece[c]].group === BARB))) foot[c] = 1;
    for (const c of passage) foot[c] = 1;
    const edge = []; for (let c = 0; c < n; c++) if (foot[c] && nb4(c).some((e) => e >= 0 && !foot[e])) edge.push(c);
    const gap = randInt(rng, MO.gap), th = randInt(rng, MO.thick), amp = MO.wobble, fq = randInt(rng, MO.freq), ph = rng() * TAU;
    for (let c = 0; c < n; c++) {
      if (foot[c] || role[c] >= 2) continue;
      let d2 = 1e9; for (const e of edge) { const dx = X(c) - X(e), dy = Y(c) - Y(e), q = dx * dx + dy * dy; if (q < d2) d2 = q; }
      // Inner edge fixed, outer edge bulges by up to W.moat.wobble: the band curves but never thins below th.
      const d = Math.sqrt(d2), bulge = amp * (0.5 + 0.5 * Math.sin(fq * Math.atan2(Y(c) - ccy, X(c) - ccx) + ph));
      if (d > gap + 0.5 && d <= gap + th + 0.5 + bulge) g[c] = "~";
    }
    info.moat = true;
    // Bridges: straight 2-wide runs of moat cells heading out from the footprint; the first faces the gate.
    const nbr = randInt(rng, MO.bridges);
    const run = (x, y, dx, dy) => {   // from a footprint cell outward: the first unbroken run of moat cells
      const out = [];
      for (let s = 1; s < 12; s++) { const c = at(x + dx * s, y + dy * s); if (c < 0) return null; if (g[c] === "~") out.push(c); else if (out.length) break; else if (g[c] !== ".") return null; }
      return out.length ? out : null;
    };
    for (let b = 0, t = 0; b < nbr && t < 40; t++) {
      let cells = null;
      if (b === 0) { const bx = Math.round(gcx - 0.5), A = run(bx, y1 + gout, 0, 1), Bb = run(bx + 1, y1 + gout, 0, 1); if (A && Bb) cells = A.concat(Bb); }
      else {
        const side = pick(rng, ["left", "right", "top"]);
        if (side === "top") { const bx = randInt(rng, [x0 + T + 1, x1 - T - 2]), A = run(bx, y0, 0, -1), Bb = run(bx + 1, y0, 0, -1); if (A && Bb) cells = A.concat(Bb); }
        else { const by = randInt(rng, [y0 + T + 1, y1 - T - 2]), xx = side === "left" ? x0 : x1, dx = side === "left" ? -1 : 1, A = run(xx, by, dx, 0), Bb = run(xx, by + 1, dx, 0); if (A && Bb) cells = A.concat(Bb); }
      }
      if (!cells || cells.some((c) => piece[c] >= 0 || nb4(c).some((e) => e >= 0 && piece[e] >= 0 && P[piece[e]].kind === "bridge"))) continue;
      const i = add(BRIDGE, "bridge"); for (const c of cells) { g[c] = "."; own(c, i); }
      b++; info.bridges++;
    }
    if (!info.bridges) return { fail: "bridge" };
  }

  let low = front + 2;
  for (let c = 0; c < n; c++) if (g[c] === "~" && Y(c) + 2 > low) low = Y(c) + 2;
  // Outworks: a few earthwork blocks in the front field (clear of the moat and the camp rows; the fence then avoids them).
  if (W.outworks) info.outworks = blocks(W.outworks, 0, FIELD, "outwork", 0, low - 1, w - 1, h - 1 - W.outworks.clear, true);
  // Palisade: a fence across the whole front field between the castle (and its moat) and the camp, cut into segments.
  const PA = W.palisade;
  if (PA && rng() < PA.p) {
    const hi = h - 1 - PA.clear;
    if (low <= hi) {
      let yp = -1;
      for (let t = 0; t < 12 && yp < 0; t++) { const y = randInt(rng, [low, hi]); let ok = true; for (let x = 0; x < w && ok; x++) for (let d = -1; d <= 1; d++) { const c = at(x, y + d); if (c >= 0 && piece[c] >= 0 && P[piece[c]].kind === "outwork") ok = false; } if (ok) yp = y; }
      const segs = randInt(rng, PA.segs), cutsX = [];
      for (let i = 1; i < segs; i++) cutsX.push(Math.round((w * i) / segs) + randInt(rng, [-2, 2]));
      let seg = -1, si = 0;
      for (let x = 0; x < w && yp >= 0; x++) {
        if (seg < 0 || (si < cutsX.length && x >= cutsX[si])) { if (seg >= 0) si++; seg = add(FIELD, "palisade"); }
        const c = at(x, yp); if (g[c] === "." && piece[c] < 0) own(c, seg);
      }
      if (yp >= 0) info.palisade = segs;
    }
  }

  // Fold stray fragments (and pieces under minPiece) into the neighbouring piece of the same group with most contact.
  const CU = W.curtain;
  for (let i = 0; i < P.length; i++) {
    if (P[i].kind === "iron" || P[i].kind === "house") continue;
    const comps = [], seen = new Set();
    for (const c0 of P[i].cells) {
      if (seen.has(c0)) continue;
      const comp = [c0]; seen.add(c0);
      for (let j = 0; j < comp.length; j++) for (const e of nb4(comp[j])) if (e >= 0 && piece[e] === i && !seen.has(e)) { seen.add(e); comp.push(e); }
      comps.push(comp);
    }
    comps.sort((a, b) => b.length - a.length);
    for (let ci = 0; ci < comps.length; ci++) {
      if (ci === 0 && comps[0].length >= CU.minPiece) continue;
      const votes = new Map();
      for (const c of comps[ci]) for (const e of nb4(c)) if (e >= 0 && piece[e] >= 0 && piece[e] !== i && P[piece[e]].group === P[i].group && P[piece[e]].kind !== "iron") votes.set(piece[e], (votes.get(piece[e]) || 0) + 1);
      let best = -1, bv = 0; for (const [q, v] of votes) if (v > bv) { best = q; bv = v; }
      if (best < 0) continue;
      for (const c of comps[ci]) own(c, best);
    }
  }

  // Colour, outside in (RANK), and within a group the gate first and the towers last. Hard: a touching piece of another
  // group never shares a material. Soft: avoid touching pieces of the same group. A tower takes a material none of its
  // ring's neighbours use with probability towers.contrast, the ring's first tower material when it can (towers read).
  const adj = (i) => { const o = new Set(); for (const c of P[i].cells) for (const e of nb4(c)) if (e >= 0 && piece[e] >= 0 && piece[e] !== i) o.add(piece[e]); return o; };
  const twOf = (p) => (p.group === MID ? IN.towers : TW), kr = (p) => (p.kind === "gate" ? 0 : p.kind === "tower" && twOf(p).own ? 2 : 1), towerMat = {};
  let gateMat = null;
  const order = P.map((_, i) => i).filter((i) => P[i].cells.length && !P[i].mat).sort((a, b) => RANK[P[a].group] - RANK[P[b].group] || kr(P[a]) - kr(P[b]) || a - b);
  for (const i of order) {
    const hard = new Set(), soft = new Set(), p = P[i];
    for (const o of adj(i)) if (P[o].mat) (P[o].group !== p.group ? hard : soft).add(P[o].mat);
    const opts = W.mats.filter((q) => !hard.has(q));
    if (!opts.length) return { fail: "colour" };
    let pref = opts.filter((q) => !soft.has(q));
    if (p.kind === "tower") {
      const tm = towerMat[p.group];
      if (rng() >= twOf(p).contrast) pref = opts;
      else if (twOf(p).own && tm && pref.includes(tm)) pref = [tm];
    }
    // KP.avoidGate: the keep ring avoids the outer gate's material (the way in takes two kinds of crew).
    if (KP.avoidGate && p.group === INNER && gateMat) pref = pref.filter((q) => q !== gateMat).length ? pref.filter((q) => q !== gateMat) : pref;
    const want = p.kind === "gate" ? (p.group === MID ? IN.gate.mats : GT.mats) : p.kind === "bridge" && MO ? MO.mats : p.kind === "garden" ? ["H"] : null;
    const wp = want ? pref.filter((q) => want.includes(q)) : [];
    p.mat = pick(rng, wp.length ? wp : pref.length ? pref : opts);
    if (p.kind === "tower" && !towerMat[p.group]) towerMat[p.group] = p.mat;
    if (p.kind === "gate" && p.group === OUTER) gateMat = p.mat;
  }
  for (let i = 0; i < P.length; i++) for (const c of P[i].cells) g[c] = P[i].mat;
  // A tower reads when no touching wall shares its material (it is its own section, so its silhouette shows).
  info.towersRead = 0; for (let i = 0; i < P.length; i++) if (P[i].kind === "tower" && P[i].cells.length && ![...adj(i)].some((o) => P[o].mat === P[i].mat)) info.towersRead++;

  // The siege camp: a patch CA.w wide and CA.depth deep, centred on the bottom edge (CA.shift), facing the gatehouse.
  const CA = W.camp, cw = randInt(rng, CA.w), cd = CA.depth, camp = [], cx = clamp(Math.round((w - cw) / 2) + randInt(rng, CA.shift), 0, w - cw);
  for (let y = h - cd; y < h; y++) for (let k = 0; k < cw; k++) camp.push(at(cx + k, y));
  if (camp.some((c) => c < 0 || g[c] !== ".")) return { fail: "camp" };
  for (const c of camp) g[c] = "P";
  info.camp = "bottom";

  // Art hints for the renderer (levels' `art` field; decor is added at bake): tower and gate rects, the keep.
  const rect = (cells) => { let a = w, b = h, e = -1, f = -1; for (const c of cells) { a = Math.min(a, X(c)); b = Math.min(b, Y(c)); e = Math.max(e, X(c)); f = Math.max(f, Y(c)); } return [a, b, e - a + 1, f - b + 1]; };
  const SIDE = { bottom: "s", top: "n", left: "w", right: "e" };
  info.art = { towers: [], gates: [], keep: [kx0, ky0, ks, ks] };
  for (const p of P) if (p.cells.length && p.kind === "tower") info.art.towers.push(rect(p.cells));
  for (const p of P) if (p.cells.length && p.kind === "gate") info.art.gates.push(rect(p.cells).concat(p.group === MID ? SIDE[info.innerGate] : "s"));

  const level = { w, h, grid: Array.from({ length: h }, (_, y) => g.slice(y * w, y * w + w).join("")), muster: {}, chests: [] };
  let B; try { B = E.parse(level); } catch (e) { return { fail: "parse" }; }
  const s0 = E.start(B);
  if (s0.won) return { fail: "trivial" };
  // A moat must close: at the start no curtain, tower, gate or barbican tile touches the camp's ground (bridges, the
  // palisade and outworks are the way in). Any section the camp can never reach, even with every wall broken, is scenery.
  if (info.moat) for (let c = 0; c < n; c++) if (piece[c] >= 0 && (P[piece[c]].group === OUTER || P[piece[c]].group === BARB) && E.touches(B, s0.conn, c)) return { fail: "moat-leak" };
  const all = new Uint8Array(B.nsec).fill(1), sp = new Int16Array(B.spentLen), Dall = E.derive(B, all, sp, E.scratch(B));
  for (let s = 0; s < B.nsec; s++) { let ok = false; for (const c of E.sectionCells(B, s)) if (Dall.conn[c]) ok = true; if (!ok) return { fail: "scenery" }; }
  return { level, info };
}

// Depth through scarcity for one rule, then the chest and the spare. Returns {level, info} or {fail}.
function musterize(L0, W, C, rng, rule, band) {
  const L = { w: L0.w, h: L0.h, grid: L0.grid.slice(), muster: {}, chests: [], rule };
  const B = E.parse(L), F = S.frontier(B, { maxLen: W.depth[1], cap: C.frontierCap });
  if (F.capped) return { fail: "frontier-capped" };
  if (!F.vecs.length) return { fail: "no-win" };
  // Every mix u over the board's materials: min(u) = the shortest frontier vector that fits in u. Candidates have
  // min in W.depth and |u| - min in W.slack. Pick a random min that has candidates, then the best of a few by solve.
  const present = [0, 1, 2, 3].filter((m) => L.grid.some((row) => row.includes("STHI"[m])));
  const minOf = (u) => { let b = 99; for (const v of F.vecs) if (v.len < b && v.comp[0] <= u[0] && v.comp[1] <= u[1] && v.comp[2] <= u[2] && v.comp[3] <= u[3]) b = v.len; return b; };
  // band.noSpam: no candidate may cover a one-material winning mix (one card alone could win), the structural half
  // of the spam rule (measure() still plays the spam out).
  const mono = band && band.noSpam ? F.vecs.filter((v) => v.comp.filter((q) => q > 0).length === 1) : [];
  const covers = (u) => mono.some((v) => v.comp.every((q, i) => q <= u[i]));
  const byK = {}, u = [0, 0, 0, 0], top = W.depth[1] + W.slack[1];
  const walk = (i, left) => {
    if (i === present.length) {
      const tot = u[0] + u[1] + u[2] + u[3], mn = minOf(u);
      if (mn >= W.depth[0] && mn <= W.depth[1] && tot - mn >= W.slack[0] && tot - mn <= W.slack[1] && !covers(u)) (byK[mn] = byK[mn] || []).push(u.slice());
      return;
    }
    for (let v = 0; v <= left; v++) { u[present[i]] = v; walk(i + 1, left - v); }
    u[present[i]] = 0;
  };
  walk(0, top);
  const ks = Object.keys(byK), info = { rule, straight: F.min, frontier: F.vecs.length, fStates: F.states, fMs: F.ms, depth: ks.length ? "scarce" : "short", chestMode: null, spare: null };
  // Up to C.musterEval candidates, dealt round-robin across the mins that have any (so every depth gets a look).
  const pools = ks.map((k) => shuffle(rng, byK[k])), cand = [];
  for (let r = 0; cand.length < C.musterEval && pools.some((p) => r < p.length); r++) for (const p of pools) if (r < p.length && cand.length < C.musterEval) cand.push(p[r]);
  if (!cand.length && !mono.length) cand.push(F.vecs[F.vecs.length - 1].comp);
  if (!cand.length) return { fail: "mono" };
  let best = null;
  for (const v of cand) {
    L.muster = E.musterObj(v);
    const Bv = E.parse(L), r = S.solve(Bv, { cap: C.cap });
    if (!r.win || r.capped) continue;
    const score = mscore(r, spamOf(Bv), band);
    if (!best || score > best.score) best = { comp: v.slice(), r, score };
  }
  if (!best) return { fail: "no-win" };
  const comp = best.comp, r0 = best.r;
  info.k = r0.min;
  // World 2+: one chest. "required": in a pocket the optimal line opens at step j, holding a crew a later call needs
  // (the muster drops it). "detour" (W.detour of boards): in a pocket the line never opens.
  if (W.chests) {
    const n = L.w * L.h, g = L.grid.join("").split(""), Bq = E.parse(L), D = E.scratch(Bq), br = new Uint8Array(Bq.nsec), sp = new Int16Array(Bq.spentLen);
    const seen = E.derive(Bq, br, sp, E.scratch(Bq)).conn.slice(), steps = [];
    for (let j = 0; j < r0.lineSecs.length; j++) {
      for (const s of r0.lineSecs[j]) br[s] = 1;
      E.derive(Bq, br, sp, D);
      for (let c = 0; c < n; c++) if (g[c] === "." && D.conn[c] && !seen[c]) { steps.push({ c, j }); seen[c] = 1; }
    }
    const offLine = []; for (let c = 0; c < n; c++) if (g[c] === "." && !seen[c]) offLine.push(c);
    const onLine = steps.filter((o) => o.j < r0.line.length - 1);
    let mode = rng() < W.detour ? "detour" : "required";
    if (mode === "detour" && !offLine.length) mode = "required";
    if (mode === "required" && !onLine.length) mode = offLine.length ? "detour" : null;
    const mats = (j0) => { const out = []; for (let j = j0; j < r0.line.length; j++) out.push(Bq.secMat[r0.lineSecs[j][0]]); return out; };
    if (mode === "required") {
      const o = pick(rng, onLine), t = pick(rng, mats(o.j + 1));
      g[o.c] = "C"; L.chests = [{ x: o.c % L.w, y: (o.c / L.w) | 0, crew: E.CREWS[t] }]; comp[t]--;
    } else if (mode === "detour") {
      const c = pick(rng, offLine), lack = present.filter((m) => !comp[m]), t = pick(rng, lack.length ? lack : present);
      g[c] = "C"; L.chests = [{ x: c % L.w, y: (c / L.w) | 0, crew: E.CREWS[t] }];
    }
    L.grid = Array.from({ length: L.h }, (_, y) => g.slice(y * L.w, y * L.w + L.w).join(""));
    info.chestMode = mode;
  }
  L.muster = E.musterObj(comp);
  const r1 = S.solve(E.parse(L), { cap: C.cap });
  if (!r1.win || r1.capped) return { fail: "no-win" };
  // Spare crews (W.spare): a crew that keeps the min, keeps a required chest required and keeps band.decisions; of
  // those, the one that leaves a slower win (2 stars reachable), then the most decision points. Logged when none does.
  for (let sp = 0; sp < (W.spare | 0); sp++) {
    let best = null;
    for (const m of shuffle(rng, present.slice())) {
      const L2 = Object.assign({}, L, { muster: Object.assign({}, L.muster, { [E.CREWS[m]]: (L.muster[E.CREWS[m]] | 0) + 1 }) });
      const B2 = E.parse(L2), r2 = S.solve(B2, { cap: C.cap });
      if (!r2.win || r2.capped || r2.min !== r1.min || r2.decisions < ((band && band.decisions) || 0) || r2.tieMove) continue;
      if (info.chestMode === "required" && (!r2.chestRequired || !chestNeeded(L2, r2.min, C))) continue;
      if (band && band.noSpam && (spamOf(B2) || covers([0, 1, 2, 3].map((q) => B2.muster[q])))) continue;
      if (band && band.margin && r2.margin !== null && r2.margin < band.margin && (r1.margin === null || r1.margin >= band.margin)) continue;
      const sc = (r2.slowWin ? 100 : 0) + mscore(r2, false, band);
      if (!best || sc > best.sc) best = { L2, sc, m };
    }
    if (best) { L.muster = best.L2.muster; info.spare = E.CREWS[best.m]; } else info.spareLowersMin = true;
  }
  return { level: L, info };
}

// Rule A + stacks: deal the level's crews into C.stacks.k columns (front first). Returns {level, info} or {fail}.
function deal(L0, C, rng) {
  const tokens = []; for (const k of E.CREWS) for (let i = 0; i < (L0.muster[k] | 0); i++) tokens.push(k);
  const K = Math.min(C.stacks.k, tokens.length);
  let best = null, tried = 0, winnable = 0;
  for (let t = 0; t < C.stacks.tries && tried < C.stacks.eval; t++) {
    shuffle(rng, tokens);
    const cols = Array.from({ length: K }, () => []);
    tokens.forEach((q, i) => cols[i % K].push(q));
    const L = Object.assign({}, L0, { stacks: cols, rule: "A" }), r = S.solve(E.parse(L), { cap: C.cap });
    tried++;
    if (!r.win || r.capped) continue;
    winnable++;
    const score = r.decisions * 4 + (r.reshapes > 0 ? 2 : 0) + r.trapRate - (r.tieMove ? 8 : 0);
    if (!best || score > best.score) best = { L, score };
  }
  return best ? { level: best.L, info: { tried, winnable } } : { fail: "stacks-no-win", info: { tried, winnable } };
}

// Metrics for one level as given. opts.ab: also solve it under Rule B (the A≠B share).
function measure(L, C, opts) {
  const B = E.parse(L), r = S.solve(B, { cap: C.cap }), gr = S.greedy(B), p = S.playouts(B, C.playouts, hashStr(L.grid.join("") + JSON.stringify(L.muster) + JSON.stringify(L.stacks || "")));
  let crewSecs = 0, iron = 0, singles = 0, crewSingles = 0, blocks = 0;
  for (let s = 0; s < B.nsec; s++) {
    const sz = B.secStart[s + 1] - B.secStart[s];
    if (B.secMat[s] < E.IRON) { crewSecs++; blocks += sz; if (sz === 1) crewSingles++; } else iron++;
    if (sz === 1) singles++;
  }
  const m = {
    sections: crewSecs, iron, walls: crewSecs + iron, blocks: crewSecs ? blocks / crewSecs : 0, singles, crewSingles, cells: B.n,
    win: r.win, min: r.min, capped: r.capped, states: r.states, dead: r.dead, lost: r.lost, ms: r.ms,
    deadRatio: r.states ? r.dead / r.states : 0, lostRatio: r.states ? r.lost / r.states : 0,
    randWin: p.winRate, greedyWin: gr.win, greedyUsed: gr.used, greedyExcess: gr.win && r.win ? gr.used - r.min : null,
    trapRate: r.trapRate, decisions: r.decisions, choices: r.choices, lineTrap: r.lineTrap, tieAny: r.tieAny, tieMove: r.tieMove, reshapes: r.reshapes,
    line: r.line, lineSecs: r.lineSecs, chests: B.chestCell.length, chestRequired: r.chestRequired, minChest: r.minChest, minNoChest: r.minNoChest,
    chestKind: null, levers: B.levers.length, leversMatter: null, minB: null,
  };
  // One-card spam: calling a single material again and again wins, so "closest" makes every choice (non-stacks).
  m.spam = spamOf(B); m.lineMats = B.cols ? null : new Set(r.line).size; m.margin = r.margin; m.slowWin = r.slowWin; m.maxWin = r.maxWin;
  if (B.chestCell.length && r.win) m.chestKind = r.chestRequired && chestNeeded(L, r.min, C) ? "required" : r.minChest != null && r.minChest <= r.min + 1 ? "detour" : "idle";
  if (B.levers.length && r.win) { const r2 = S.solve(E.parse(L, { noLevers: true }), { cap: C.cap, traps: false }); m.leversMatter = r2.capped ? null : !r2.win || r2.min > r.min; }
  if (opts && opts.ab && r.win) { const rb = S.solve(E.parse(L, { rule: "B" }), { cap: C.cap, traps: false }); m.minB = rb.win ? rb.min : null; }
  if (r.error) m.error = r.error;
  return m;
}

// n boards for world wk from one seed, each measured under the variants asked for ("A", "B", "AS" = A + stacks).
// Returns {recs:[{world, seed, idx, level, info, v:{A:{level, info, m}, ...}}], fails:{reason: count}}.
function batch(C, wk, seed, n, variants) {
  const W = C.worlds[wk], rng = S.mulberry32(seed), recs = [], fails = {}, vs = variants || ["A", "B", "AS"];
  const fail = (k) => { fails[k] = (fails[k] || 0) + 1; };
  for (let made = 0, tries = 0; made < n && tries < n * C.triesPerBoard; tries++) {
    const t0 = Date.now(), pic = castle(W, C, rng);
    if (pic.fail) { fail("castle-" + pic.fail); continue; }
    const rec = { world: +wk, seed, idx: made, level: pic.level, info: pic.info, v: {} };
    if (vs.includes("A") || vs.includes("AS")) {
      const a = musterize(pic.level, W, C, rng, "A", C.bands[wk]);
      if (a.fail) { fail("A-" + a.fail); continue; }
      rec.v.A = { level: a.level, info: a.info, m: measure(a.level, C, { ab: true }) };
      if (vs.includes("AS")) {
        const d = deal(a.level, C, rng);
        rec.v.AS = d.fail ? { fail: d.fail, info: d.info } : { level: d.level, info: d.info, m: measure(d.level, C) };
      }
    }
    if (vs.includes("B")) {
      const b = musterize(pic.level, W, C, rng, "B", C.bands[wk]);
      rec.v.B = b.fail ? { fail: b.fail } : { level: b.level, info: b.info, m: measure(b.level, C) };
    }
    rec.ms = Date.now() - t0;
    recs.push(rec); made++;
  }
  return { recs, fails };
}

// Accept filter for one variant's measured level under a world band. Returns null (accept) or the first failing reason.
function accept(m, band) {
  if (!m || !m.win || m.capped) return !m ? "no-level" : m.capped ? "capped" : "no-win";
  if (m.walls > band.maxSections) return "section-cap";
  if (m.crewSingles) return "single-block";
  if (m.min < band.min[0] || m.min > band.min[1]) return "min-band";
  if (m.tieMove) return "tie-decides";
  if (band.noSpam && m.spam) return "spam";
  if (band.lineMats && m.lineMats !== null && m.lineMats < band.lineMats) return "one-material";
  if (band.margin && m.margin !== null && m.margin < band.margin) return "margin";
  if (band.greedy && m.greedyWin && m.greedyUsed - m.min < band.greedy) return "greedy-solves";
  if (m.decisions < (band.decisions || 0)) return "few-decisions";
  if (band.reshapes && m.reshapes < band.reshapes) return "no-reshape";
  if (band.randWin && (m.randWin < band.randWin[0] || m.randWin > band.randWin[1])) return "random-win-band";
  if (band.trap && (m.trapRate < band.trap[0] || m.trapRate > band.trap[1])) return "trap-band";
  if (band.chest && m.chestKind !== "required" && m.chestKind !== "detour") return "chest-idle";
  if (band.levers && !m.leversMatter) return "levers-idle";
  if (band.slow && !m.slowWin) return "no-slow-win";
  return null;
}

module.exports = { castle, musterize, deal, measure, batch, accept, hashStr, shuffle, spamOf };
