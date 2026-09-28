// Sapper's Path v2 board generator + per-board metrics (SPEC-v2 §4-5). Node only; every number comes from bake-config.json.
// castle():    a castle-plan PICTURE (no muster yet). The castle rectangle sits in a field with the siege camp on the
//              board edge (usually the bottom). Outer curtain several blocks thick, cut by angle into a few big arcs;
//              corner towers (round or square) bulge out of it; a gatehouse faces the camp; the courtyard may hold a
//              cross wall (divider) and buildings (the "closest" decoys); the keep block sits at the back inside its
//              own ring (World 4: an iron ring, opened by a lever inside a small lever house). World 3+ adds a curving
//              moat around the whole footprint with breakable bridges. Materials are a colouring where pieces of
//              different groups (outer / yard / inner / bridges) never share a material, so no section spans two layers.
// musterize(): depth through scarcity for ONE rule. The solver's Pareto frontier lists every crew mix whose every win
//              spends exactly that mix; pick a length k in W.depth (random k that has hits), then among up to
//              C.musterEval mixes of that k the one with the most decision points (then reshapes, then trap rate).
//              Then the chest (required or detour, as v1) and the spare (W.spare crews that keep the min).
// deal():      Rule A + stacks: the A level's crews dealt into C.stacks.k columns, the winnable deal with the most
//              decision points among C.stacks.eval tries.
// measure():   solve (+ traps, ties, reshapes) + greedy + seeded random playouts + board shape for one level.
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
const OUTER = 1, YARD = 2, INNER = 3, BRIDGE = 4, FIELD = 5;

// One castle picture. Returns {level, info} or {fail: reason}.
function castle(W, C, rng) {
  const [w, h] = pick(rng, W.sizes), n = w * h;
  const X = (c) => c % w, Y = (c) => (c / w) | 0, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x);
  const nb4 = (c) => [X(c) > 0 ? c - 1 : -1, X(c) < w - 1 ? c + 1 : -1, c >= w ? c - w : -1, c < n - w ? c + w : -1];
  const M = W.margin, x0 = randInt(rng, M.side), x1 = w - 1 - randInt(rng, M.side), y0 = randInt(rng, M.top), y1 = h - 1 - randInt(rng, M.front);
  const T = randInt(rng, W.curtain.thick), ccx = (x0 + x1) / 2, ccy = (y0 + y1) / 2;
  const g = new Array(n).fill("."), piece = new Int16Array(n).fill(-1), P = [];
  const add = (group, kind) => { P.push({ group, kind, cells: [], mat: null }); return P.length - 1; };
  const own = (c, i) => { if (piece[c] >= 0) P[piece[c]].cells = P[piece[c]].cells.filter((q) => q !== c); piece[c] = i; P[i].cells.push(c); };
  // role: 0 field, 1 curtain, 2 courtyard.
  const role = new Uint8Array(n);
  for (let c = 0; c < n; c++) { const x = X(c), y = Y(c); if (x >= x0 && x <= x1 && y >= y0 && y <= y1) role[c] = Math.min(x - x0, x1 - x, y - y0, y1 - y) < T ? 1 : 2; }
  const info = { w, h, T, towers: 0, gate: null, divider: 0, buildings: 0, moat: false, bridges: 0, palisade: 0, keep: 0, lever: false, camp: "bottom" };

  // Towers bulge out of the four corners (never into the courtyard).
  const TW = W.towers, off = (T - 1) / 2;
  for (const [cx, cy] of [[x0 + off, y0 + off], [x1 - off, y0 + off], [x0 + off, y1 - off], [x1 - off, y1 - off]]) {
    if (rng() >= TW.p) continue;
    const r = randInt(rng, TW.r), round = rng() < TW.round, i = add(OUTER, "tower");
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const c = at(x, y), dx = x - cx, dy = y - cy;
      if (c < 0 || role[c] === 2) continue;
      if (round ? dx * dx + dy * dy <= r * r + 0.3 : Math.abs(dx) <= r - 0.5 && Math.abs(dy) <= r - 0.5) own(c, i);
    }
    info.towers++;
  }
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

  // Curtain arcs: what the towers and gate left, cut by angle around the castle centre with jittered cuts.
  const CU = W.curtain, k = randInt(rng, CU.arcs), o0 = rng(), cuts = [];
  for (let i = 0; i < k; i++) cuts.push((o0 + (i + (rng() - 0.5) * CU.cutJitter) / k + 1) % 1);
  cuts.sort((a, b) => a - b);
  const arcPiece = cuts.map(() => -1);
  for (let c = 0; c < n; c++) {
    if (role[c] !== 1 || piece[c] >= 0) continue;
    const t = (Math.atan2(Y(c) - ccy, X(c) - ccx) / TAU + 1) % 1;
    let s = cuts.length - 1; for (let i = 0; i < cuts.length; i++) if (t >= cuts[i]) s = i;
    if (arcPiece[s] < 0) arcPiece[s] = add(OUTER, "arc");
    own(c, arcPiece[s]);
  }

  // Keep block at the back of the courtyard inside its own ring (rounded corners when 2 thick).
  const KP = W.keep, ks = randInt(rng, KP.size), Ti = randInt(rng, KP.ring), yd = KP.yard;
  const cxL = x0 + T, cxR = x1 - T, cyT = y0 + T, cyB = y1 - T;
  const kxMin = cxL + yd + Ti, kxMax = cxR - yd - Ti - ks + 1, kyMin = cyT + yd + Ti, kyMax = cyB - yd - Ti - ks + 1 - KP.front;
  if (kxMin > kxMax || kyMin > kyMax) return { fail: "room" };
  const kx0 = clamp(Math.round((cxL + cxR + 1 - ks) / 2) + randInt(rng, [-1, 1]), kxMin, kxMax), ky0 = clamp(kyMin + randInt(rng, KP.up), kyMin, kyMax);
  const kcx = kx0 + (ks - 1) / 2, kcy = ky0 + (ks - 1) / 2, ringCells = [];
  for (let y = ky0 - Ti; y < ky0 + ks + Ti; y++) for (let x = kx0 - Ti; x < kx0 + ks + Ti; x++) {
    const c = at(x, y), dx = x < kx0 ? kx0 - x : x >= kx0 + ks ? x - kx0 - ks + 1 : 0, dy = y < ky0 ? ky0 - y : y >= ky0 + ks ? y - ky0 - ks + 1 : 0;
    if (!dx && !dy) { g[c] = "K"; continue; }
    if (Ti >= 2 && dx === Ti && dy === Ti) continue;
    ringCells.push(c);
  }
  info.keep = ks;
  if (KP.iron) { const i = add(INNER, "iron"); P[i].mat = "F"; for (const c of ringCells) own(c, i); }
  else {
    const ka = randInt(rng, KP.arcs), q0 = rng(), kc = [];
    for (let i = 0; i < ka; i++) kc.push((q0 + (i + (rng() - 0.5) * CU.cutJitter) / ka + 1) % 1);
    kc.sort((a, b) => a - b);
    const kp = kc.map(() => -1);
    for (const c of ringCells) {
      const t = (Math.atan2(Y(c) - kcy, X(c) - kcx) / TAU + 1) % 1;
      let s = kc.length - 1; for (let i = 0; i < kc.length; i++) if (t >= kc[i]) s = i;
      if (kp[s] < 0) kp[s] = add(INNER, "ring");
      own(c, kp[s]);
    }
  }
  const wardBottom = ky0 + ks + Ti - 1;
  const free = (c) => c >= 0 && role[c] === 2 && piece[c] < 0 && g[c] === ".";

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
      const i = add(YARD, "house"); for (const c of house) own(c, i);
      placed = true; info.lever = side;
    }
    if (!placed) return { fail: "lever" };
  }
  // A cross wall splits the courtyard into a front and a back bailey, cut into a few segments.
  const DV = W.divider;
  if (DV && rng() < DV.p) {
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
  // Buildings: free-standing blocks in the courtyard with a clear ring around them (the decoys).
  const BU = W.buildings, nbld = randInt(rng, BU.n);
  for (let b = 0, t = 0; b < nbld && t < 60; t++) {
    const bw = randInt(rng, BU.w), bh = randInt(rng, BU.h), bx = randInt(rng, [cxL, cxR - bw + 1]), by = randInt(rng, [cyT, cyB - bh + 1]);
    let ok = true;
    for (let y = by - 1; y <= by + bh && ok; y++) for (let x = bx - 1; x <= bx + bw && ok; x++) { const c = at(x, y); if (c < 0 || (role[c] === 2 && !free(c))) ok = false; }
    for (let y = by; y < by + bh && ok; y++) for (let x = bx; x < bx + bw && ok; x++) if (!free(at(x, y))) ok = false;
    if (!ok) continue;
    const i = add(YARD, "building");
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) own(at(x, y), i);
    b++; info.buildings++;
  }

  // Moat: a band around the whole footprint (curtain, towers, gate), wobbled by angle so it curves; bridges cross it.
  const MO = W.moat;
  if (MO && rng() < MO.p) {
    const foot = new Uint8Array(n); for (let c = 0; c < n; c++) if (role[c] === 1 || (piece[c] >= 0 && P[piece[c]].group === OUTER)) foot[c] = 1;
    const edge = []; for (let c = 0; c < n; c++) if (foot[c] && nb4(c).some((e) => e >= 0 && !foot[e])) edge.push(c);
    const gap = randInt(rng, MO.gap), th = randInt(rng, MO.thick), amp = MO.wobble, fq = randInt(rng, MO.freq), ph = rng() * TAU;
    for (let c = 0; c < n; c++) {
      if (foot[c] || role[c] === 2) continue;
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

  // Palisade: a fence across the whole front field between the castle (and its moat) and the camp, cut into segments.
  const PA = W.palisade;
  if (PA && rng() < PA.p) {
    let low = y1 + gout + 2;
    for (let c = 0; c < n; c++) if (g[c] === "~" && Y(c) + 2 > low) low = Y(c) + 2;
    const hi = h - 1 - PA.clear;
    if (low <= hi) {
      const yp = randInt(rng, [low, hi]), segs = randInt(rng, PA.segs), cutsX = [];
      for (let i = 1; i < segs; i++) cutsX.push(Math.round((w * i) / segs) + randInt(rng, [-2, 2]));
      let seg = -1, si = 0;
      for (let x = 0; x < w; x++) {
        if (seg < 0 || (si < cutsX.length && x >= cutsX[si])) { if (seg >= 0) si++; seg = add(FIELD, "palisade"); }
        const c = at(x, yp); if (g[c] === "." && piece[c] < 0) own(c, seg);
      }
      info.palisade = segs;
    }
  }

  // Fold stray fragments (and pieces under minPiece) into the neighbouring piece of the same group with most contact.
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

  // Colour: outer first, then bridges, yard, inner ring. Hard: a touching piece of another group never shares a material.
  // Soft: avoid touching pieces of the same group (towers merge into an arc with 1 - towers.contrast).
  const adj = (i) => { const o = new Set(); for (const c of P[i].cells) for (const e of nb4(c)) if (e >= 0 && piece[e] >= 0 && piece[e] !== i) o.add(piece[e]); return o; };
  const order = P.map((_, i) => i).filter((i) => P[i].cells.length && !P[i].mat).sort((a, b) => [0, 1, 4, 5, 2, 3][P[a].group] - [0, 1, 4, 5, 2, 3][P[b].group] || (P[a].kind === "gate" ? -1 : 0) - (P[b].kind === "gate" ? -1 : 0) || a - b);
  for (const i of order) {
    const hard = new Set(), soft = new Set();
    for (const o of adj(i)) if (P[o].mat) (P[o].group !== P[i].group ? hard : soft).add(P[o].mat);
    const opts = W.mats.filter((q) => !hard.has(q));
    if (!opts.length) return { fail: "colour" };
    let pref = opts.filter((q) => !soft.has(q));
    if (P[i].kind === "tower" && rng() >= TW.contrast) pref = opts;
    const want = P[i].kind === "gate" ? GT.mats : P[i].kind === "bridge" && MO ? MO.mats : null;
    const wp = want ? pref.filter((q) => want.includes(q)) : [];
    P[i].mat = pick(rng, wp.length ? wp : pref.length ? pref : opts);
  }
  for (let i = 0; i < P.length; i++) for (const c of P[i].cells) g[c] = P[i].mat;

  // The siege camp: on the front edge near the gate, or low on a side edge.
  const CA = W.camp, cw = randInt(rng, CA.w), side = rng() < CA.side ? pick(rng, ["left", "right"]) : "bottom", camp = [];
  if (side === "bottom") { const cx = clamp(Math.round(gcx - cw / 2 + 0.5) + randInt(rng, CA.shift), 0, w - cw); for (let k = 0; k < cw; k++) camp.push(at(cx + k, h - 1)); }
  else for (let k = 0; k < cw && g[at(side === "left" ? 0 : w - 1, h - 1 - k)] === "."; k++) camp.push(at(side === "left" ? 0 : w - 1, h - 1 - k));
  if (camp.length < 2 || camp.some((c) => c < 0 || g[c] !== ".")) return { fail: "camp" };
  for (const c of camp) g[c] = "P";
  info.camp = side;

  const level = { w, h, grid: Array.from({ length: h }, (_, y) => g.slice(y * w, y * w + w).join("")), muster: {}, chests: [] };
  let B; try { B = E.parse(level); } catch (e) { return { fail: "parse" }; }
  const s0 = E.start(B);
  if (s0.won) return { fail: "trivial" };
  // A moat must close: at the start no curtain, tower or gate tile touches the camp's ground (bridges and the
  // palisade are the way in). Any section the camp can never reach, even with every wall broken, is scenery: reject.
  if (info.moat) for (let c = 0; c < n; c++) if (piece[c] >= 0 && P[piece[c]].group === OUTER && E.touches(B, s0.conn, c)) return { fail: "moat-leak" };
  const all = new Uint8Array(B.nsec).fill(1), sp = new Int16Array(B.spentLen), Dall = E.derive(B, all, sp, E.scratch(B));
  for (let s = 0; s < B.nsec; s++) { let ok = false; for (const c of E.sectionCells(B, s)) if (Dall.conn[c]) ok = true; if (!ok) return { fail: "scenery" }; }
  return { level, info };
}

// Depth through scarcity for one rule, then the chest and the spare. Returns {level, info} or {fail}.
function musterize(L0, W, C, rng, rule) {
  const L = { w: L0.w, h: L0.h, grid: L0.grid.slice(), muster: {}, chests: [], rule };
  const B = E.parse(L), F = S.frontier(B, { maxLen: W.depth[1], cap: C.frontierCap });
  if (F.capped) return { fail: "frontier-capped" };
  if (!F.vecs.length) return { fail: "no-win" };
  // Every mix u over the board's materials: min(u) = the shortest frontier vector that fits in u. Candidates have
  // min in W.depth and |u| - min in W.slack. Pick a random min that has candidates, then the best of a few by solve.
  const present = [0, 1, 2, 3].filter((m) => L.grid.some((row) => row.includes("STHI"[m])));
  const minOf = (u) => { let b = 99; for (const v of F.vecs) if (v.len < b && v.comp[0] <= u[0] && v.comp[1] <= u[1] && v.comp[2] <= u[2] && v.comp[3] <= u[3]) b = v.len; return b; };
  const byK = {}, u = [0, 0, 0, 0], top = W.depth[1] + W.slack[1];
  const walk = (i, left) => {
    if (i === present.length) {
      const tot = u[0] + u[1] + u[2] + u[3], mn = minOf(u);
      if (mn >= W.depth[0] && mn <= W.depth[1] && tot - mn >= W.slack[0] && tot - mn <= W.slack[1]) (byK[mn] = byK[mn] || []).push(u.slice());
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
  if (!cand.length) cand.push(F.vecs[F.vecs.length - 1].comp);
  let best = null;
  for (const v of cand) {
    L.muster = E.musterObj(v);
    const r = S.solve(E.parse(L), { cap: C.cap });
    if (!r.win || r.capped) continue;
    const score = r.decisions * 4 + (r.reshapes > 0 ? 2 : 0) + r.trapRate + 0.25 * r.min - (r.tieMove ? 8 : 0);
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
  const r1 = S.solve(E.parse(L), { cap: C.cap, traps: false });
  if (!r1.win || r1.capped) return { fail: "no-win" };
  // Spare crews that keep the min (first material in random order that does; logged when none does).
  for (let sp = 0; sp < (W.spare | 0); sp++) {
    let done = false;
    for (const m of shuffle(rng, present.slice())) {
      const L2 = Object.assign({}, L, { muster: Object.assign({}, L.muster, { [E.CREWS[m]]: (L.muster[E.CREWS[m]] | 0) + 1 }) });
      const r2 = S.solve(E.parse(L2), { cap: C.cap, traps: false });
      if (r2.win && !r2.capped && r2.min === r1.min) { L.muster = L2.muster; info.spare = E.CREWS[m]; done = true; break; }
    }
    if (!done) info.spareLowersMin = true;
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
  let crewSecs = 0, iron = 0, singles = 0, blocks = 0;
  for (let s = 0; s < B.nsec; s++) {
    const sz = B.secStart[s + 1] - B.secStart[s];
    if (B.secMat[s] < E.IRON) { crewSecs++; blocks += sz; } else iron++;
    if (sz === 1) singles++;
  }
  const m = {
    sections: crewSecs, iron, walls: crewSecs + iron, blocks: crewSecs ? blocks / crewSecs : 0, singles, cells: B.n,
    win: r.win, min: r.min, capped: r.capped, states: r.states, dead: r.dead, lost: r.lost, ms: r.ms,
    deadRatio: r.states ? r.dead / r.states : 0, lostRatio: r.states ? r.lost / r.states : 0,
    randWin: p.winRate, greedyWin: gr.win, greedyUsed: gr.used, greedyExcess: gr.win && r.win ? gr.used - r.min : null,
    trapRate: r.trapRate, decisions: r.decisions, choices: r.choices, lineTrap: r.lineTrap, tieAny: r.tieAny, tieMove: r.tieMove, reshapes: r.reshapes,
    line: r.line, lineSecs: r.lineSecs, chests: B.chestCell.length, chestRequired: r.chestRequired, minChest: r.minChest, minNoChest: r.minNoChest,
    chestKind: null, levers: B.levers.length, leversMatter: null, minB: null,
  };
  if (B.chestCell.length && r.win) m.chestKind = r.chestRequired ? "required" : r.minChest != null && r.minChest <= r.min + 1 ? "detour" : "idle";
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
      const a = musterize(pic.level, W, C, rng, "A");
      if (a.fail) { fail("A-" + a.fail); continue; }
      rec.v.A = { level: a.level, info: a.info, m: measure(a.level, C, { ab: true }) };
      if (vs.includes("AS")) {
        const d = deal(a.level, C, rng);
        rec.v.AS = d.fail ? { fail: d.fail, info: d.info } : { level: d.level, info: d.info, m: measure(d.level, C) };
      }
    }
    if (vs.includes("B")) {
      const b = musterize(pic.level, W, C, rng, "B");
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
  if (m.min < band.min[0] || m.min > band.min[1]) return "min-band";
  if (m.tieMove) return "tie-decides";
  if (band.greedy && m.greedyWin && m.greedyUsed - m.min < band.greedy) return "greedy-solves";
  if (m.decisions < (band.decisions || 0)) return "few-decisions";
  if (band.reshapes && m.reshapes < band.reshapes) return "no-reshape";
  if (band.randWin && (m.randWin < band.randWin[0] || m.randWin > band.randWin[1])) return "random-win-band";
  if (band.trap && (m.trapRate < band.trap[0] || m.trapRate > band.trap[1])) return "trap-band";
  if (band.chest && m.chestKind !== "required" && m.chestKind !== "detour") return "chest-idle";
  if (band.levers && !m.leversMatter) return "levers-idle";
  return null;
}

module.exports = { castle, musterize, deal, measure, batch, accept, hashStr, shuffle };
