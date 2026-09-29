// Sapper's Path v3 generators (SPEC-v3 §5): seeded top-down fort plans per era, the deal by simulating a winning play
// order, and the column assignment that sets difficulty. Every number comes from tools/bake-config.json.
//
//   fort(era, seed, P)        -> {w, h, grid, gates, towers} or null (P: the level's generator params, config eras[e])
//   deal(B, seed, D)          -> {play:[[m,n],...]} a winning play order simulated under dealing rules (D.hold spaces,
//                                archers lethal, so the order wins on Easy, Normal and Hard), or null
//   assign(play, beta, seed)  -> colOf[] per card: round-robin mixed with contiguous chunks (beta 0 = pure round-robin,
//                                the easiest deal; 1 = five chunks of the order, the deepest)
//   colsOf(play, colOf)       -> the five tray columns;  orderOf(colOf) -> the tap order that replays `play`
// Any assignment keeps `play` a winning order: each column is a subsequence of it, so its next card is always in front.
"use strict";
const E = require("../src/engine.js");
const { rng } = require("./grade.js");

const { GRASS, WATER, DIRT, CAMP, IRON, GILT } = E;
// Materials by role (MATS order in config.json): 1 earth bank, 2 palisade, 3 thatch, 4 timber, 5 rubble, 6 ashlar,
// 7 slate (Era 3 archer towers only), 8 roof tile, 9 brick, 10 iron (gates only), 11 hedge, 12 warded, 13 crystal, 14 gilt (keys only).
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function shuffle(r, arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

function board(w, h) {
  const a = new Int8Array(w * h);
  const B = { w, h, a,
    get: (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? a[y * w + x] : WATER),
    put: (x, y, v) => { if (x >= 0 && y >= 0 && x < w && y < h) a[y * w + x] = v; },
    rect: (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) B.put(x, y, v); },
    each: (f) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) f(x, y); },
  };
  return B;
}
// Signed distance (cells, negative inside) to a shape: ellipse, rounded rectangle or octagon around (cx, cy).
function shape(kind, cx, cy, rx, ry) {
  if (kind === "ellipse") return (x, y) => (Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) - 1) * Math.min(rx, ry);
  if (kind === "octagon") return (x, y) => { const dx = Math.abs(x + 0.5 - cx), dy = Math.abs(y + 0.5 - cy); return Math.max(dx - rx, dy - ry, (dx + dy - (rx + ry) * 0.72) * 0.7071); };
  const cr = Math.min(rx, ry) * 0.35;
  return (x, y) => { const qx = Math.abs(x + 0.5 - cx) - (rx - cr), qy = Math.abs(y + 0.5 - cy) - (ry - cr); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - cr; };
}
const band = (G, sdf, k0, k1, v) => G.each((x, y) => { const s = sdf(x, y); if (s <= -k0 && s > -k1) G.put(x, y, v); });
const fill = (G, sdf, k0, v) => G.each((x, y) => { if (sdf(x, y) <= -k0) G.put(x, y, v); });
const disc = (G, cx, cy, r, v) => G.each((x, y) => { if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) G.put(x, y, v); });

// Buildings in a yard (denser since the v3 fix pass): a building is a rectangle of yard dirt whose ring touches no other
// building, so buildings keep one-cell lanes between them but may lean on a wall. A role paints a ring of its first colour
// and (3x3 and bigger) a roof of its second. P.sizes sets the big and mid building sides; P.fill the built share of the yard.
const ROLE_MATS = { hut: [4, 3], hedge: [11], well: [5], longhouse: [4, 8], oven: [9], chapel: [6, 12], hall: [6, 8], barracks: [9, 3], garden: [11, 13], store: [2, 1], shrine: [12], fountain: [13, 5], stable: [4, 3], tower: [5, 8] };
const BIG = { longhouse: 1, hall: 1, barracks: 1, stable: 1 }, SMALL = { well: 1, oven: 1, shrine: 1, fountain: 1 };
// `m` set: the ring may touch a building of another colour (the sweep packs buildings wall to wall, never same to same).
function freeRect(G, bld, x0, y0, x1, y1, m) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (G.get(x, y) !== DIRT) return false;
  for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (x >= 0 && y >= 0 && x < G.w && y < G.h && bld[y * G.w + x] && (!m || G.get(x, y) === m)) return false;
  return true;
}
function paint(G, bld, role, x0, y0, bw, bh) {
  const [m1, m2] = ROLE_MATS[role], x1 = x0 + bw - 1, y1 = y0 + bh - 1;
  if (m2 && bw >= 3 && bh >= 3) { G.rect(x0, y0, x1, y1, m1); G.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, m2); }
  else if (role === "hedge" || role === "garden") { G.rect(x0, y0, x1, y1, m1); if (m2) G.put(x0 + (bw >> 1), y0 + (bh >> 1), m2); }
  else G.rect(x0, y0, x1, y1, m2 && (bw + bh) % 2 ? m2 : m1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) bld[y * G.w + x] = 1;
  return bw * bh;
}
function placeRole(G, bld, r, role, tries, S) {
  for (let t = 0; t < tries; t++) {
    const bw = BIG[role] ? ri(r, S.big[0], S.big[1]) : SMALL[role] ? ri(r, 2, 3) : ri(r, S.mid[0], S.mid[1]);
    const bh = BIG[role] ? ri(r, 3, 5) : SMALL[role] ? ri(r, 2, 3) : ri(r, S.mid[0], S.mid[1]);
    const x0 = ri(r, 1, G.w - bw - 1), y0 = ri(r, 1, G.h - bh - 1);
    if (freeRect(G, bld, x0, y0, x0 + bw - 1, y0 + bh - 1)) return paint(G, bld, role, x0, y0, bw, bh);
  }
  return 0;
}
// Place the colour roles, then keep adding buildings whose colours the fort already has until P.fill of the yard is
// built (bounded attempts).
function furnish(G, r, roles, P) {
  const bld = new Uint8Array(G.w * G.h), S = P.sizes || { big: [5, 8], mid: [3, 5] };
  let yard = 0, built = 0; G.each((x, y) => { if (G.get(x, y) === DIRT) yard++; });
  for (const role of roles) built += placeRole(G, bld, r, role, 120, S);
  const pool = roles.length ? roles : ["hut"];
  for (let t = 0; t < 300 && built < P.fill * yard; t++) built += placeRole(G, bld, r, pick(r, pool), 8, S);
  // Then sweep the yard in reading order and drop the biggest building that fits at each spot, wall to wall with a
  // neighbour of another colour, so the gaps fill up to P.pack of the yard.
  for (let y = 1; y < G.h - 1 && built < P.pack * yard; y++) for (let x = 1; x < G.w - 1 && built < P.pack * yard; x++) {
    if (G.get(x, y) !== DIRT) continue;
    const role = pick(r, pool), wMax = BIG[role] ? S.big[1] : SMALL[role] ? 3 : S.mid[1], hMax = BIG[role] ? 5 : SMALL[role] ? 3 : S.mid[1];
    let done = false;
    for (let bw = wMax; bw >= 2 && !done; bw--) for (let bh = Math.min(hMax, bw + 1); bh >= 2 && !done; bh--) if (freeRect(G, bld, x, y, x + bw - 1, y + bh - 1, ROLE_MATS[role][0])) { built += paint(G, bld, role, x, y, bw, bh); done = true; }
  }
}
// Pick roles until the fort holds `k` colours (base colours already in `have`).
function rolesFor(r, have, k, pool) {
  const out = [], got = new Set(have), order = shuffle(r, pool.slice());
  for (let pass = 0; pass < 3 && got.size < k; pass++) for (const role of order) {
    if (got.size >= k) break;
    const add = ROLE_MATS[role].filter((m) => !got.has(m));
    if (!add.length && pass === 0) continue;
    if (got.size + add.length > k && pass < 2) continue;
    out.push(role); add.forEach((m) => got.add(m));
  }
  return out;
}
function camp(G, r, P) {
  const depth = ri(r, P.campDepth[0], P.campDepth[1]), cw = ri(r, P.campW[0], P.campW[1]), x0 = Math.max(1, Math.min(G.w - cw - 1, ((G.w - cw) >> 1) + ri(r, -2, 2)));
  G.rect(x0, G.h - depth, x0 + cw - 1, G.h - 1, CAMP);
  return { x0, x1: x0 + cw - 1, y0: G.h - depth };
}
// The key lodge (4x3 timber round a gilt key) beside the camp on its roomier side, one grass column away. Null when it
// would land on water (the moat must stay whole, or the gate could be walked round).
function lodge(G, r, cp) {
  const lw = 4, lh = 3, left = cp.x0 - 1 >= G.w - 2 - cp.x1, x0 = left ? cp.x0 - lw - 1 : cp.x1 + 2, y0 = G.h - lh;
  if (x0 < 0 || x0 + lw > G.w) return null;
  for (let y = y0 - 1; y < G.h; y++) for (let x = x0 - 1; x <= x0 + lw; x++) if (G.get(x, y) === WATER && y >= 0 && x >= 0 && x < G.w) return null;
  G.rect(x0, y0, x0 + lw - 1, G.h - 1, 4); const k = [x0 + 1 + ri(r, 0, 1), y0 + 1]; G.put(k[0], k[1], GILT);
  return k;
}
// Tight framing (v3 fix pass): trim grass-only columns and top rows to P.margin cells, and squeeze each later run of
// grass-only rows (the camp approach) to P.gap rows. Gate, key and tower cells move with the crop.
function crop(G, gates, towers, P) {
  const W = G.w, H = G.h, grassCol = (x) => { for (let y = 0; y < H; y++) if (G.get(x, y) !== GRASS) return false; return true; };
  let x0 = 0; while (x0 < W - 1 && grassCol(x0)) x0++;
  let x1 = W - 1; while (x1 > x0 && grassCol(x1)) x1--;
  x0 = Math.max(0, x0 - P.margin); x1 = Math.min(W - 1, x1 + P.margin);
  const grassRow = (y) => { for (let x = x0; x <= x1; x++) if (G.get(x, y) !== GRASS) return false; return true; };
  const ys = [], ny = new Int32Array(H).fill(-1); let run = 0, seen = false;
  for (let y = 0; y < H; y++) { if (grassRow(y)) { if (++run > (seen ? P.gap : P.margin)) continue; } else { run = 0; seen = true; } ny[y] = ys.length; ys.push(y); }
  const C = board(x1 - x0 + 1, ys.length);
  ys.forEach((y, j) => { for (let x = x0; x <= x1; x++) C.put(x - x0, j, G.get(x, y)); });
  const mv = (p) => [p[0] - x0, ny[p[1]]];
  return out(C, gates.map((g) => ({ at: mv(g.at), key: mv(g.key) })), towers.map((t) => ({ at: mv(t.at), r: t.r })));
}
const out = (G, gates, towers) => ({ w: G.w, h: G.h, grid: E.gridOf(G.w, G.h, G.a), gates, towers });

// Era 1: palisade stockade. Earth bank and palisade rings (an optional ditch with a causeway, an optional open gateway,
// and from P.walkFrom colours an optional timber wall-walk inside), huts and yards packed inside.
function era1(r, P) {
  const w = ri(r, P.w[0], P.w[1]), h = ri(r, P.h[0], P.h[1]), G = board(w, h);
  const cp = camp(G, r, P), top = 1, bottom = cp.y0 - ri(r, 2, 3);
  const cx = w / 2 + ri(r, -1, 1) * 0.5, cy = (top + bottom + 1) / 2, rx = w / 2 - 1, ry = (bottom - top + 1) / 2;
  const sdf = shape(pick(r, ["ellipse", "rrect", "octagon"]), cx, cy, rx, ry);
  const ditch = r() < P.ditch, bankT = ri(r, P.bankT[0], P.bankT[1]), palT = ri(r, P.palT[0], P.palT[1]), off = ditch ? 1 : 0;
  const walk = P.colours >= P.walkFrom && r() < P.walk ? 1 : 0, base = walk ? [1, 2, 4] : [1, 2];
  if (ditch) band(G, sdf, 0, 1, WATER);
  band(G, sdf, off, off + bankT, 1); band(G, sdf, off + bankT, off + bankT + palT, 2);
  if (walk) band(G, sdf, off + bankT + palT, off + bankT + palT + 1, 4);
  fill(G, sdf, off + bankT + palT + walk, DIRT);
  const gx = Math.floor(cx);
  if (ditch) for (let y = 0; y < h; y++) for (let x = gx - 1; x <= gx + 1; x++) if (G.get(x, y) === WATER && y > cy) G.put(x, y, GRASS);
  if (r() < P.gateway) for (let y = Math.floor(cy); y < h; y++) for (let x = gx - 1; x <= gx; x++) { const v = G.get(x, y); if (v === 1 || v === 2 || v === 4) G.put(x, y, DIRT); }
  furnish(G, r, rolesFor(r, base, P.colours, ["hut", "hedge", "well", "longhouse", "oven", "chapel", "store", "stable"]), P);
  return crop(G, [], [], P);
}

// Era 2: motte and bailey. A moated mound (the motte) whose only way in is an iron gate on the bridge, its key a gilt
// pixel inside the bailey. gates 2: the whole fort sits inside a moat too, its gate at the bottom and its key in a lodge
// beside the camp.
function era2(r, P) {
  const w = ri(r, P.w[0], P.w[1]), h = ri(r, P.h[0], P.h[1]), G = board(w, h);
  const cp = camp(G, r, P), twoGates = r() < P.twoGates;
  const top = 1, bottom = cp.y0 - ri(r, 2, 3) - (twoGates ? 2 : 0), bankT = ri(r, P.bankT[0], P.bankT[1]);
  const rm = ri(r, P.motteR[0], P.motteR[1]), mx = w / 2 + ri(r, -2, 2), my = top + rm + (twoGates ? 1.5 : 0);
  const bTop = my + rm * 0.35, bcx = w / 2 + ri(r, -1, 1) * 0.5, bcy = (bTop + bottom + 1) / 2, brx = w / 2 - (twoGates ? 2 : 1), bry = (bottom - bTop + 1) / 2;
  const bs = shape(pick(r, ["ellipse", "rrect"]), bcx, bcy, brx, bry), ms = shape("ellipse", mx, my, rm, rm);
  if (twoGates) { const us = (x, y) => Math.min(bs(x, y), ms(x, y)); band(G, (x, y) => us(x, y) - 1.2, 0, 1.2, WATER); }
  band(G, bs, 0, bankT, 1); band(G, bs, bankT, bankT + 1, 2); fill(G, bs, bankT + 1, DIRT);
  const roles = rolesFor(r, [1, 2, 4], P.colours - 1, ["hut", "hedge", "well", "longhouse", "oven", "chapel", "barracks", "store", "stable"]);
  // Motte on top of the bailey's upper edge: water ring, then bank, palisade, yard and a timber tower.
  band(G, ms, -1.5, 0, WATER); band(G, ms, 0, 2, 1); band(G, ms, 2, 3, 2); fill(G, ms, 3, DIRT);
  const tw = Math.max(2, Math.floor(rm * 0.55)), tx0 = Math.round(mx - tw / 2), ty0 = Math.round(my - tw / 2);
  G.rect(tx0, ty0, tx0 + tw, ty0 + tw, 4); if (tw >= 3) G.rect(tx0 + 1, ty0 + 1, tx0 + tw - 1, ty0 + tw - 1, pick(r, [3, 8]));
  // Gate 1: iron across the motte's water ring below its centre.
  const gx = Math.floor(mx), gates = [];
  let gcell = null;
  for (let y = Math.floor(my); y < h; y++) for (let x = gx - 1; x <= gx; x++) if (G.get(x, y) === WATER && ms(x, y) > -0.5) { G.put(x, y, IRON); gcell = gcell || [x, y]; }
  // Make sure the bridge reaches the bailey yard: dirt below the gate until the yard.
  if (gcell) for (let y = gcell[1] + 1; y < h; y++) { let hit = false; for (let x = gx - 1; x <= gx; x++) { const v = G.get(x, y); if (v === IRON || v === WATER) continue; if (v === DIRT) hit = true; else G.put(x, y, DIRT); } if (hit || ms(gx, y) > 2) break; }
  furnish(G, r, roles, P);
  // Key 1 inside the bailey: on a building if there is one, else in the yard.
  const k1 = keySpot(G, r, (x, y) => bs(x, y) < -2 && ms(x, y) > 1);
  if (!gcell || !k1) return null;
  G.put(k1[0], k1[1], GILT); gates.push({ at: gcell, key: k1 });
  if (twoGates) {
    let g2 = null; const bx = Math.floor(bcx);
    for (let y = h - 1; y > bcy; y--) for (let x = bx - 1; x <= bx; x++) if (G.get(x, y) === WATER) { G.put(x, y, IRON); g2 = g2 || [x, y]; }
    const k2 = lodge(G, r, cp);
    if (!g2 || !k2) return null;
    gates.push({ at: g2, key: k2 });
  }
  return crop(G, gates, [], P);
}
function keySpot(G, r, ok) {
  const cand = []; G.each((x, y) => { const v = G.get(x, y); if (v > 0 && v !== IRON && v !== GILT && v !== 1 && v !== 2 && ok(x, y)) cand.push([x, y]); });
  if (!cand.length) G.each((x, y) => { if (G.get(x, y) === DIRT && ok(x, y)) cand.push([x, y]); });
  return cand.length ? pick(r, cand) : null;
}

// Era 3: stone keep. A two-thick rubble curtain with an ashlar wall-walk, slate archer towers on its corners, a keep in
// the middle, buildings packed into the ward, and (gates > 0) a moat whose gatehouse bridge is locked, its key in a lodge
// beside the camp.
function era3(r, P) {
  const w = ri(r, P.w[0], P.w[1]), h = ri(r, P.h[0], P.h[1]), G = board(w, h);
  const cp = camp(G, r, P), moat = r() < P.moat, tR = P.towerR[0] + r() * (P.towerR[1] - P.towerR[0]);
  const pad = Math.ceil(tR) + (moat ? 2 : 0), top = pad, bottom = cp.y0 - 2 - (moat ? 2 : 0) - pad + 1;
  const cx = w / 2, cy = (top + bottom + 1) / 2, rx = w / 2 - pad, ry = (bottom - top + 1) / 2;
  const kind = pick(r, ["rrect", "octagon"]), sdf = shape(kind, cx, cy, rx, ry);
  if (moat) band(G, (x, y) => sdf(x, y) - tR + 0.5, 0, 1.5, WATER);
  band(G, sdf, 0, P.wallT, 5); if (P.innerWall) band(G, sdf, P.wallT, P.wallT + 1, 6); fill(G, sdf, P.wallT + (P.innerWall ? 1 : 0), DIRT);
  // Keep: ashlar walls around a roof-tile roof.
  const kw = ri(r, P.keep[0], P.keep[1]), kh = ri(r, P.keep[0], P.keep[1]), kx = Math.round(cx - kw / 2), ky = Math.round(cy - kh / 2) - ri(r, 0, 2);
  G.rect(kx - 1, ky - 1, kx + kw, ky + kh, DIRT); G.rect(kx, ky, kx + kw - 1, ky + kh - 1, 6); G.rect(kx + 1, ky + 1, kx + kw - 2, ky + kh - 2, 8);
  if (kw >= 6 && kh >= 6) G.rect(kx + 2, ky + 2, kx + kw - 3, ky + kh - 3, pick(r, [12, 13]));
  const have = new Set([5, 6, 8, 7]); G.each((x, y) => { const v = G.get(x, y); if (v > 0) have.add(v); });
  const roles = rolesFor(r, [...have], P.colours, ["hut", "hedge", "well", "oven", "chapel", "barracks", "garden", "store", "shrine", "fountain", "tower", "hall"]);
  furnish(G, r, roles, P);
  // Archer towers on chosen corners (the corners nearest the camp first when few), each a slate disc.
  // Tower centres sit on the curtain: walk each bounding-box corner in along its diagonal to the wall's middle.
  const corners = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => {
    for (let t = 0; t <= 1; t += 0.02) { const x = cx + sx * (rx - 0.5) * (1 - t), y = cy + sy * (ry - 0.5) * (1 - t); if (sdf(Math.floor(x), Math.floor(y)) <= -1) return [x, y]; }
    return [cx, cy];
  });
  const nt = ri(r, P.towers[0], P.towers[1]), use = shuffle(r, corners.slice()).slice(0, nt), towers = [];
  for (const [x, y] of use) {
    disc(G, x, y, tR, 7);
    towers.push({ at: [Math.floor(x), Math.floor(y)], r: +(P.range[0] + r() * (P.range[1] - P.range[0])).toFixed(1) });
  }
  const gates = [];
  if (moat) {
    let g = null; const bx = Math.floor(cx);
    for (let y = h - 1; y > cy; y--) for (let x = bx - 1; x <= bx; x++) if (G.get(x, y) === WATER) { G.put(x, y, IRON); g = g || [x, y]; }
    const k = lodge(G, r, cp);
    if (!g || !k) return null;
    gates.push({ at: g, key: k });
  }
  for (const t of towers) if (G.get(t.at[0], t.at[1]) !== 7) return null;
  return crop(G, gates, towers, P);
}

const ERAS = { 1: era1, 2: era2, 3: era3 };
// Build a fort; null when the plan is malformed (the caller moves on to the next seed).
function fort(era, seed, P) {
  const r = rng(seed);
  let L; try { L = ERAS[era](r, P); } catch (e) { return null; }
  if (!L) return null;
  try { E.compile(Object.assign({ cols: [[], [], [], [], []] }, L)); } catch (e) { return null; }
  return L;
}
const coloursOf = (L) => { const s = new Set(); for (const row of L.grid) for (const ch of row) { const m = E.matOf(ch); if (m && m !== IRON) s.add(m); } return s; };

// Deal by simulation: pick a colour and a squad size, play it patiently under dealing rules (D.hold spaces, archers
// lethal, D.time the engine timing), keep it if nothing fails. D: {hold, size:[lo,hi], deep, finish, maxCard, maxCards, tries, maxTaps (optional: a deal with more
// cards than this is dropped, so a level never asks for more taps)}.
function deal(L, seed, D) {
  const B = E.compile(Object.assign({ cols: [[], [], [], [], []] }, L)), r = rng(seed);
  const S = E.sim(B, { hold: D.hold, archersKill: true, time: D.time }, { deal: true }), buf = new Int32Array(S.M.length);
  const un = new Int32Array(E.NMAT); for (let m = 1; m < E.NMAT; m++) if (m !== IRON) un[m] = B.pix[m];
  const play = [];
  for (let guard = 0; guard < D.maxCards && S.pixLeft > 0; guard++) {
    const reach = [], deep = [];
    for (let m = 1; m < E.NMAT; m++) { if (!un[m]) continue; const t = S.target(m); if (t >= 0 && !S.covered(t)) reach.push(m); else deep.push(m); }
    const opts = [];
    if (deep.length && r() < D.deep) opts.push(...shuffle(r, deep));
    opts.push(...shuffle(r, reach), ...shuffle(r, deep));
    let done = false;
    for (let t = 0; t < Math.min(D.tries, opts.length) && !done; t++) {
      const m = opts[t];
      let n = Math.min(un[m], ri(r, D.size[0], D.size[1]), D.maxCard);
      if (un[m] <= D.maxCard && r() < D.finish) n = un[m];
      S.save(buf);
      S.playSquad(m, n); S.quiet();
      if (S.status === E.FAILED) { S.load(buf); continue; }
      un[m] -= n; play.push([m, n]); done = true;
    }
    if (!done || (D.maxTaps && play.length > D.maxTaps)) return null;
  }
  return S.pixLeft === 0 ? { play, peak: S.peak } : null;
}

// Column per card: round-robin, or with probability beta the card's chunk of the order (five contiguous chunks).
function assign(play, beta, seed) {
  const r = rng(seed), K = play.length, colOf = new Array(K);
  for (let i = 0; i < K; i++) colOf[i] = r() < beta ? Math.min(4, Math.floor((i * 5) / K)) : i % 5;
  return colOf;
}
// Tighten: hill-climb the deal into the band [lo, hi] of Normal random-tap win rate, in stages (T.stages: {playouts,
// steps}), each on its own common seeds; a later stage with more playouts confirms the screening stage and keeps
// climbing if the estimate moved out. Moves: move one card to another column (keeps `play` winning), split a card in
// two, or merge two same-colour cards adjacent in `play` (resizing; kept only if `play` still wins under the dealing
// rules). T: {stages, seed, margin, colMin, colMax, resize, split, minCard, maxCard, maxTaps}; rules: {normal, deal}.
// Returns {play, colOf, rate, steps, evals}.
function tune(L, play, colOf, lo, hi, T, rules) {
  let res = { play, colOf, rate: 0, steps: 0, evals: 0 };
  T.stages.forEach((st, k) => {
    const r = stage(L, res.play, res.colOf, lo, hi, Object.assign({}, T, st, { seed: (T.seed + k * 104729) | 0 }), rules);
    res = { play: r.play, colOf: r.colOf, rate: r.rate, steps: res.steps + r.steps, evals: res.evals + r.evals };
  });
  if (T.narrow) { const r = narrowStage(L, res.play, res.colOf, lo, hi, Object.assign({}, T, T.narrow, { seed: (T.seed + 7919) | 0 }), rules); res = Object.assign(r, { steps: res.steps + r.steps, evals: res.evals + r.evals }); }
  return res;
}
// Late hard slots: keep the Normal random-tap rate in band and hill-climb the one-move-lookahead player's win rate down
// (card moves only, so the dealt order stays a winner) until it reaches T.stopAt (a floor, so the late band stays hard
// without turning into a wall). T: {playouts, greedyPlayouts, steps, stopAt}.
function narrowStage(L, play, colOf, lo, hi, T, rules) {
  const R = require("./grade.js"), r = rng(T.seed ^ 0x68e31da4);
  let evals = 0;
  const lo2 = lo > 0 ? lo + T.margin : 0, hi2 = hi < 1 ? hi - T.margin : 1;
  const score = (co) => { evals++; const B = E.compile(Object.assign({}, L, { cols: colsOf(play, co) })), x = R.rate(B, rules.normal, T.playouts, T.seed);
    return x < lo2 || x > hi2 ? null : { rate: x, g: R.greedy(B, rules.normal, T.greedyPlayouts, T.seed) }; };
  let cur = score(colOf), step = 0;
  if (!cur) return { play, colOf, rate: R.rate(E.compile(Object.assign({}, L, { cols: colsOf(play, colOf) })), rules.normal, T.playouts, T.seed), steps: 0, evals };
  for (; step < T.steps && cur.g > (T.stopAt || 0); step++) {
    const i = Math.floor(r() * play.length), j = Math.floor(r() * 5); if (j === colOf[i]) continue;
    const co = colOf.slice(); co[i] = j;
    const c = [0, 0, 0, 0, 0]; for (const x of co) c[x]++; if (Math.min(...c) < T.colMin || Math.max(...c) > T.colMax) continue;
    const s = score(co); if (!s) continue;
    if (s.g < cur.g || (s.g === cur.g && r() < 0.3)) { colOf = co; cur = s; }
  }
  return { play, colOf, rate: cur.rate, greedy: cur.g, steps: step, evals };
}
function stage(L, play, colOf, lo, hi, T, rules) {
  const R = require("./grade.js");
  play = play.map((c) => c.slice()); colOf = colOf.slice();
  const r = rng(T.seed ^ 0x5bd1e995);
  let evals = 0;
  const build = (pl, co) => E.compile(Object.assign({}, L, { cols: colsOf(pl, co) }));
  const rateOf = (pl, co) => { evals++; return R.rate(build(pl, co), rules.normal, T.playouts, T.seed); };
  // The margin keeps estimates off a band edge, except the 0% and 100% edges no estimate can cross.
  const lo2 = lo > 0 ? lo + T.margin : 0, hi2 = hi < 1 ? hi - T.margin : 1, miss = (x) => Math.max(0, lo2 - x, x - hi2);
  const lens = (co) => { const c = [0, 0, 0, 0, 0]; for (const j of co) c[j]++; return c; };
  const dealWins = (pl, co) => { const B = build(pl, co), S = E.replay(B, rules.deal, orderOf(co)); return S.status === E.WON; };
  let cur = rateOf(play, colOf), step = 0;
  for (; step < T.steps && miss(cur) > 0; step++) {
    let pl = play, co = colOf;
    const kind = r();
    if (kind < T.resize && play.length > 5) {
      if (r() < T.split) {
        const i = Math.floor(r() * play.length), [m, n] = play[i]; if (n < 2 * T.minCard || (T.maxTaps && play.length >= T.maxTaps)) continue;
        const a = T.minCard + Math.floor(r() * (n - 2 * T.minCard + 1));
        pl = play.slice(0, i).concat([[m, a], [m, n - a]], play.slice(i + 1)); co = colOf.slice(0, i + 1).concat([Math.floor(r() * 5)], colOf.slice(i + 1));
      } else {
        const i = Math.floor(r() * (play.length - 1)); if (play[i][0] !== play[i + 1][0] || play[i][1] + play[i + 1][1] > T.maxCard) continue;
        pl = play.slice(0, i).concat([[play[i][0], play[i][1] + play[i + 1][1]]], play.slice(i + 2)); co = colOf.slice(0, i + 1).concat(colOf.slice(i + 2));
      }
      if (!dealWins(pl, co)) continue;
    } else {
      const i = Math.floor(r() * play.length), j = Math.floor(r() * 5); if (j === colOf[i]) continue;
      co = colOf.slice(); co[i] = j;
    }
    const L2 = lens(co); if (Math.min(...L2) < T.colMin || Math.max(...L2) > T.colMax) continue;
    const x = rateOf(pl, co);
    if (miss(x) < miss(cur) || (miss(x) === miss(cur) && r() < 0.3)) { play = pl; colOf = co; cur = x; }
  }
  return { play, colOf, rate: cur, steps: step, evals };
}
const colsOf = (play, colOf) => { const cols = [[], [], [], [], []]; play.forEach((cd, i) => cols[colOf[i]].push(cd.slice())); return cols; };
const orderOf = (colOf) => colOf.join("");

module.exports = { fort, deal, assign, tune, colsOf, orderOf, coloursOf, ERAS };
