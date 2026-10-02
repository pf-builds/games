// Sapper's Path v4.1 castle pictures (SPEC-v4 §9, the v4.1 entry): each Siege level is a full-board picture in the
// Gallery's style, a castle seen from the front. Every cell of the picture is a block (sky, clouds, grass, trees, tents,
// the castle) except the moats (water: never eaten, never walked) and the bank path above each moat (open ground); the
// castle and everything standing in front of the sky wear a bold black outline (one ring, 8-adjacent); the picture sits
// in a 1-cell frame of open ground whose entry square is the middle of its bottom row (tools/pic.js frame), so sappers
// come out at the bottom and walk round the picture. Every number comes from tools/bake-config.json (eras[e].gen,
// picture).
//   castle(era, seed, P, Q)   -> {w, h, grid, pic, gates, towers, pal, roles} or null (the caller tries the next seed)
//                                P: the era's generator params with the level's colour count (P.colours); Q: bake-config
//                                picture (roles and their candidate colours, the frame)
// The eras keep their identity:
//   1 palisade: a log stockade with pointed stakes on an earth bank on a green hill, its gateway, a watchtower, thatched
//     huts peeking over the stakes; no gates.
//   2 motte and bailey: the moat in front (a drawbridge, the first gate: its key in a lodge by the camp), the bailey's
//     stockade with huts and a hall, and behind it the motte: an earth mound with a timber tower on top; with P.twoGates
//     the motte's own ditch, a second moat whose drawbridge's key is in the bailey.
//   3 stone keep: the moat and drawbridge, a stone curtain with battlements and a gatehouse, slate archer towers at its
//     ends (standing on the bank path and against the frame, so they can always be reached), the great keep behind.
//   4 concentric castle: the outer moat and drawbridge, the low outer curtain with its towers, then (P.innerMoat) the
//     inner moat with the second drawbridge, else the second gate is a portcullis in the inner gatehouse; the high inner
//     curtain with its towers and the keep on top. The boss (level 100) is the biggest: both moats, more towers.
// How the siege rules read a picture: water cuts the board (a moat runs off both sides, so the frame is water there too),
// so everything beyond a moat is reached only over its drawbridge, an iron gate that opens when its gilt key is eaten
// (SPEC-v3 §4). The bank path above a moat joins the frame on both sides, so once the bridge is down the whole far side is
// open. Archer towers are slate (their own colour), each a separate 4-connected group touching the bank path or the frame.
// Colours: each role (sky, grass, stone...) has candidate colours; tools/pic.js choose picks the set whose smallest pair
// (CIEDE2000, plain and faded to a queue row; gilt keys included) is biggest. Material ids go by population (1-9, 11-13;
// 10 stays iron gates and 14 gilt keys), like the Gallery's. The level's colour count is P.colours: the era's must roles
// plus optional features in a seeded order until it is reached.
"use strict";
const E = require("../src/engine.js");
const PIC = require("./pic.js");
const { rng } = require("./grade.js");

const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13];
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const BG = { sky: 1, cloud: 1, sun: 1, grass: 1 }; // background roles: the outline may take them

// ---- a role canvas ------------------------------------------------------------------------------------------------------
// Each cell holds a role name ("sky", "stone", ...), "~" water, "," open ground, "iron" (a gate), "gilt" (a key) or "ink";
// subj marks the cells of things that stand in front of the background (they get the outline).
function canvas(pw, ph) {
  const role = new Array(pw * ph).fill("sky"), subj = new Uint8Array(pw * ph);
  const C = { pw, ph, role, subj,
    in: (x, y) => x >= 0 && y >= 0 && x < pw && y < ph,
    get: (x, y) => (C.in(x, y) ? role[y * pw + x] : null),
    set: (x, y, r, s) => { if (C.in(x, y)) { role[y * pw + x] = r; subj[y * pw + x] = s ? 1 : 0; } },
    rect: (x0, y0, x1, y1, r, s) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) C.set(x, y, r, s); },
    // An ellipse centred (cx, cy) with radii (rx, ry), filled where the test passes (only onto cells `onto` allows).
    blob: (cx, cy, rx, ry, r, s, onto) => { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1 && (!onto || onto(C.get(x, y)))) C.set(x, y, r, s); } },
  };
  return C;
}
const isSky = (v) => v === "sky" || v === "cloud" || v === "sun";

// ---- parts --------------------------------------------------------------------------------------------------------------
// Battlements on a wall top: merlons on alternate cells of the row above y0 (from x0 to x1), the wall's own role.
function merlons(C, x0, x1, y0, r) { for (let x = x0; x <= x1; x++) if (((x - x0) & 1) === 0) C.set(x, y0 - 1, r, 1); }
// A curtain wall: a solid rectangle with battlements on top and a row of windows (ink) every `gap` cells.
function curtain(C, x0, x1, yTop, yBase, r, gap, skip) {
  C.rect(x0, yTop, x1, yBase, r, 1); merlons(C, x0, x1, yTop, r);
  if (gap && yBase - yTop >= 3) for (let x = x0 + 2; x < x1 - 1; x += gap) if (!skip || !skip(x)) C.set(x, yTop + 1, "ink", 1);
}
// A tower x0..x0+w-1 from yTop to yBase: battlements, or a pointed roof (a triangle one wider each side) when o.roof is
// given; arrow slits (ink) every third row from the top when o.slits; a pennant on top when o.flag.
function tower(C, x0, w, yTop, yBase, r, o) {
  o = o || {};
  C.rect(x0, yTop, x0 + w - 1, yBase, r, 1);
  if (o.slits) for (let y = yTop + 1; y < yBase - 1; y += 3) C.set(x0 + ((w - 1) >> 1), y, "ink", 1);
  if (o.roof) { const rh = Math.ceil((w + 2) / 2); for (let k = 0; k < rh; k++) C.rect(x0 - 1 + k, yTop - 1 - k, x0 + w - k, yTop - 1 - k, o.roof, 1); if (o.flag) flagOn(C, x0 + ((w - 1) >> 1), yTop - 1 - rh, o.flag); }
  else { merlons(C, x0, x0 + w - 1, yTop, r); if (o.flag) flagOn(C, x0 + ((w - 1) >> 1), yTop - 2, o.flag); }
}
// Is the box x0..x1, y0..y1 (one cell round it included) clear of slate? Archer towers must never touch (each is its own
// 4-connected group).
function clearOf(C, x0, x1, y0, y1, r) { for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (C.get(x, y) === r) return false; return x0 >= 0 && x1 < C.pw; }
// A pennant: a pole cell under a 2x1 flag pointing right (the pole takes the flag's role too, so a flag is one colour).
function flagOn(C, x, yTop, r) { if (!C.in(x, yTop - 1)) return; C.set(x, yTop, r, 1); C.set(x, yTop - 1, r, 1); C.set(x + 1, yTop - 1, r, 1); }
// The keep: a tall block with battlements and two rows of windows; corner turrets with pointed roofs when roof is given,
// a pennant on top when flag is.
function keep(C, kx, kw, kTop, kBase, r, roof, flag) {
  C.rect(kx, kTop, kx + kw - 1, kBase, r, 1); merlons(C, kx, kx + kw - 1, kTop, r);
  for (let y = kTop + 2; y < kBase - 1; y += 3) for (let x = kx + 1 + ((kw + 1) & 1); x < kx + kw - 1; x += 2) C.set(x, y, "ink", 1);
  if (roof) { for (const tx of [kx - 1, kx + kw - 2]) tower(C, tx, 2, kTop - 1, kTop + 1, r, { roof }); if (flag) flagOn(C, kx + ((kw - 1) >> 1), kTop - 2, flag); }
  else if (flag) flagOn(C, kx + ((kw - 1) >> 1), kTop - 2, flag);
}
// Pointed stakes x0..x1 standing on row base: every other stake one row shorter, so the top is a row of points.
function stakes(C, x0, x1, top, base, r) { for (let x = x0; x <= x1; x++) C.rect(x, top + ((x - x0) & 1), x, base, r, 1); }
// A tree standing on row yBase at column cx: a round canopy over a one-cell trunk (when trunk is given).
function tree(C, cx, yBase, h, canopy, trunk) {
  const th = trunk ? 1 : 0, ry = Math.max(1, (h - th) / 2), rx = Math.max(1.4, ry * 1.1);
  if (trunk) C.set(Math.floor(cx), yBase, trunk, 1);
  C.blob(cx, yBase - th - ry + 0.5, rx, ry, canopy, 1);
}
// A tent: a triangle with its base on row yBase, w wide (odd), a door of ink at the middle of its base.
function tent(C, cx, yBase, w, r) { const hh = (w + 1) >> 1; for (let k = 0; k < hh; k++) C.rect(cx - (hh - 1 - k), yBase - k, cx + (hh - 1 - k), yBase - k, r, 1); C.set(cx, yBase, "ink", 1); }
// Clouds and the sun in the sky rows y0..y1 (only onto sky): a round sun in a top corner, puffy clouds.
function sky(C, r, y0, y1, cloud, sun, sunSide) {
  const onto = (v) => v === "sky";
  if (sun) { const right = sunSide ? sunSide > 0 : r() < 0.5, cx = right ? C.pw - 3 : 3, cy = y0 + 3; C.blob(cx, cy, C.pw >= 22 ? 2.3 : 1.7, C.pw >= 22 ? 2.3 : 1.7, sun, 0, onto); }
  if (cloud) { const n = Math.max(1, Math.round(C.pw / 12)); for (let k = 0; k < n; k++) { const cx = ((k + 0.5) * C.pw) / n + ri(r, -2, 2), cy = y0 + 2 + r() * Math.max(0.5, (y1 - y0) * 0.45);
    C.blob(cx, cy, 2.8, 1.15, cloud, 0, onto); C.blob(cx + ri(r, -1, 1), cy - 1, 1.6, 1.05, cloud, 0, onto); } }
}
// A lodge (a gate's key): a small hut on row yBase, w x hh walls with the gilt key in the middle of its wall and a pitched
// roof (roof role, else the wall's). Returns the key's cell.
function lodge(C, x0, yBase, w, hh, walls, roof) {
  C.rect(x0, yBase - hh + 1, x0 + w - 1, yBase, walls, 1);
  const rr = roof || walls; for (let k = 0; k < (w + 1) >> 1; k++) C.rect(x0 - 1 + k, yBase - hh - k, x0 + w - k, yBase - hh - k, rr, 1);
  const kx = x0 + ((w - 1) >> 1), ky = yBase - ((hh - 1) >> 1); C.set(kx, ky, "gilt", 1);
  return [kx, ky];
}
// A moat: rows y0..y1 of water across the whole picture with a drawbridge (iron) bw wide centred on bx, and the bank path
// (open ground) on the row above it. Returns the gate {at}.
function moat(C, y0, y1, bx, bw) {
  C.rect(0, y0, C.pw - 1, y1, "~", 0); C.rect(0, y0 - 1, C.pw - 1, y0 - 1, ",", 0);
  const x0 = Math.round(bx - bw / 2); C.rect(x0, y0, x0 + bw - 1, y1, "iron", 1);
  return { at: [x0, y0] };
}
// The foreground (rows y0..y1, grass): the lodge with a gate's key on one side of the camp, tents by the camp, trees at
// the sides. Returns the key (or null).
function foreground(C, r, y0, y1, F) {
  C.rect(0, y0, C.pw - 1, y1, "grass", 0);
  const mid = (C.pw - 1) / 2, base = y1 - 1; let key = null, side = 0;
  if (F.lodge) { side = r() < 0.5 ? -1 : 1; const w = 4, x0 = side < 0 ? Math.round(mid) - 3 - w - ri(r, 0, 1) : Math.round(mid) + 4 + ri(r, 0, 1); key = lodge(C, x0, base, w, 2, F.lodge, F.lodgeRoof); }
  if (F.tent) for (const s of [-1, 1]) { if (s === side) continue; tent(C, Math.round(mid + s * (3 + ri(r, 1, 2))), base, 3, F.tent); }
  if (F.tree) for (const s of [-1, 1]) tree(C, s < 0 ? 1.5 + r() * 0.6 : C.pw - 2.5 - r() * 0.6, base, 5, F.tree, F.trunk);
  return key;
}

// ---- the eras -----------------------------------------------------------------------------------------------------------
// Each painter gets P (the era's generator params: the picture's [min, max] columns P.w and rows P.h, without the frame)
// and has(role), and returns {C, gates, towers} in picture coordinates, or null.
// Era 1: a log stockade with pointed stakes on an earth bank, on a green hill; a gateway; a watchtower; thatched huts.
// Rows from the bottom: the foreground, the hill's crown, the bank, the stakes, the watchtower above them (its roof and
// pennant), and at least P.skyMin rows of sky over it all; on a short picture the pennant, the tower's rise, the stakes
// and the hill give way in that order.
function era1(r, P, has) {
  const pw = ri(r, P.w[0], P.w[1]), ph = ri(r, P.h[0], P.h[1]), C = canvas(pw, ph), mid = (pw - 1) / 2;
  const fgH = ri(r, P.fg[0], P.fg[1]), yFg = ph - fgH, bankT = has("earth") ? 1 : 0, roofH = has("thatch") ? 3 : 1;
  let hill = ri(r, P.hill[0], P.hill[1]), palH = ri(r, P.palH[0], P.palH[1]), up = ri(r, 2, 3), flagH = has("banner") ? 2 : 0;
  for (let g = 0; g < 12 && fgH + hill + bankT + palH + up + roofH + flagH + P.skyMin > ph; g++) { if (flagH) flagH = 0; else if (up > 1) up--; else if (palH > 3) palH--; else if (hill > 1) hill--; else break; }
  const nW = ri(r, P.watch[0], P.watch[1]), tw = 3, side = r() < 0.5;
  sky(C, r, 0, Math.floor(ph * 0.35), has("cloud") && "cloud", nW < 2 && has("thatch") && "thatch", side ? 1 : -1); // the sun away from the watchtower
  // The hill, then the stockade on its crown (narrower than the hill, so its slopes show).
  const base = yFg - hill, half = Math.max(4, Math.round(pw * (P.span[0] + r() * (P.span[1] - P.span[0])) / 2));
  C.blob(mid + 0.5, ph + 1.5, half + 3.5, ph + 1.5 - base, "grass", 0); C.rect(0, yFg, pw - 1, ph - 1, "grass", 0);
  const x0 = Math.round(mid - half + 1), x1 = Math.round(mid + half - 1), top = base - bankT - palH + 1;
  if (has("thatch")) { const n = Math.max(1, Math.round((x1 - x0) / 7)); for (let k = 0; k < n; k++) { const cx = Math.round(x0 + ((k + 0.5) * (x1 - x0)) / n) + ri(r, -1, 1), hw = 2; for (let j = 0; j < hw; j++) C.rect(cx - (hw - 1 - j), top - j, cx + (hw - 1 - j), top - j, "thatch", 1); } }
  stakes(C, x0, x1, top, base - bankT, "wood");
  if (bankT) C.rect(x0 - 1, base, x1 + 1, base, "earth", 1);
  const gw = pw % 2 ? 3 : 2, gx = Math.round(mid - (gw - 1) / 2), gh = Math.min(palH - 1, 3);
  C.rect(gx, base - bankT - gh + 1, gx + gw - 1, base - bankT, "ink", 1);
  for (let t = 0; t < nW; t++) { const left = nW === 2 ? t === 0 : side, tx = left ? x0 : x1 - tw + 1, th = palH + up;
    tower(C, tx, tw, base - bankT - th + 1, base - bankT, "wood", { roof: has("thatch") && "thatch", flag: flagH && has("banner") && "banner", slits: true }); }
  foreground(C, r, yFg, ph - 1, { tent: has("roof") && "roof", tree: has("tree") && "tree", trunk: "wood" });
  return { C, gates: [], towers: [] };
}

// Era 2: the moat and drawbridge in front, the bailey's stockade with its buildings, the motte behind it (an earth mound
// whose foot hides behind the stakes) with a timber tower on its crown. With room (ph >= P.twoMinH) and P.twoGates, the
// motte's own ditch: a second moat between the bailey and the mound, its key set in the bailey's stockade.
function era2(r, P, has) {
  const pw = ri(r, P.w[0], P.w[1]), ph = ri(r, P.h[0], P.h[1]), C = canvas(pw, ph), mid = (pw - 1) / 2;
  const fgH = ri(r, P.fg[0], P.fg[1]), yFg = ph - fgH, yM = yFg - P.moatH, gates = [], bw = pw % 2 ? 3 : 2;
  sky(C, r, 0, Math.floor(ph * 0.3), has("cloud") && "cloud", has("thatch") && "thatch");
  const k1 = foreground(C, r, yFg, ph - 1, { lodge: "wood", lodgeRoof: has("thatch") ? "thatch" : has("roof") ? "roof" : null, tent: has("roof") && "roof", tree: has("tree") && "tree", trunk: "wood" });
  const g1 = moat(C, yM, yFg - 1, mid + 0.5, bw); g1.key = k1; gates.push(g1);
  const bank = yM - 1, palH = ri(r, P.palH[0], P.palH[1]), bTop = bank - palH, m = ri(r, 0, 1), two = ph >= P.twoMinH && r() < P.twoGates;
  // The motte (drawn first: the bailey stands in front of its foot), or beyond its ditch.
  let foot = bTop + 1;
  if (two) { const y1 = bTop - 2, y0 = y1 - 1; C.rect(0, y1 + 1, pw - 1, bTop + 1, "grass", 0); const g2 = moat(C, y0, y1, mid + 0.5, bw); const kx = r() < 0.5 ? m + 2 : pw - 3 - m, ky = bank - 2; g2.key = [kx, ky]; gates.push(g2); foot = y0 - 2; }
  const room = foot - 4, mh = Math.max(3, Math.min(ri(r, P.motteH[0], P.motteH[1]), room - 4)), mw = Math.min(pw - 2, ri(r, P.motteW[0], P.motteW[1])), mx = mid + ri(r, -1, 1) * 0.5;
  C.blob(mx + 0.5, foot + 0.5, mw / 2, mh, "earth", 1, (v) => v === "sky" || v === "cloud");
  const crown = foot - mh + 1, tw = 3 + ((pw + 1) & 1), th = Math.max(3, Math.min(ri(r, P.towerH[0], P.towerH[1]), crown - 3)), tx = Math.round(mx - (tw - 1) / 2);
  tower(C, tx, tw, crown - th + 1, crown, "wood", { roof: has("thatch") && r() < 0.5 && "thatch", flag: has("banner") && "banner", slits: true });
  // The bailey: its hall and huts peeking over the stakes, then the stakes and the gateway.
  const hx = r() < 0.5 ? Math.round(pw * 0.25) : Math.round(pw * 0.75);
  if (has("roof")) for (let j = 0; j < 3; j++) C.rect(hx - 2 + (j >> 1), bTop - j, hx + 2 - (j >> 1), bTop - j, "roof", 1);
  if (has("thatch")) for (const cx of [hx < mid ? pw - 3 : 2, Math.round(mid) + (hx < mid ? 3 : -3)]) for (let j = 0; j < 2; j++) C.rect(cx - (1 - j), bTop - j, cx + (1 - j), bTop - j, "thatch", 1);
  stakes(C, m, pw - 1 - m, bTop, bank - 1, "wood");
  C.rect(Math.round(mid - (bw - 1) / 2), bank - 2, Math.round(mid - (bw - 1) / 2) + bw - 1, bank - 1, "ink", 1);
  if (two) C.set(gates[1].key[0], gates[1].key[1], "gilt", 1);
  return { C, gates, towers: [] };
}

// Era 3: moat and drawbridge, a stone curtain with a gatehouse and slate archer towers at its ends (against the frame;
// P.towers > 2 adds one either side of the gatehouse, standing on the bank path), the great keep behind.
function era3(r, P, has) {
  const pw = ri(r, P.w[0], P.w[1]), ph = ri(r, P.h[0], P.h[1]), C = canvas(pw, ph), mid = (pw - 1) / 2;
  const fgH = ri(r, P.fg[0], P.fg[1]), yFg = ph - fgH, yM = yFg - P.moatH, gates = [], towers = [], bw = pw % 2 ? 3 : 2;
  sky(C, r, 0, Math.floor(ph * 0.3), has("cloud") && "cloud", null);
  // P.moat false (a teaching level about archers alone): no moat and no gate; the bank path still runs under the curtain.
  const wet = P.moat !== false, k1 = foreground(C, r, wet ? yFg : yM, ph - 1, { lodge: wet && (has("wood") ? "wood" : "stone"), lodgeRoof: has("roof") ? "roof" : null, tent: has("roof") && "roof", tree: has("tree") && "tree", trunk: has("wood") && "wood" });
  if (wet) { const g1 = moat(C, yM, yFg - 1, mid + 0.5, bw); g1.key = k1; gates.push(g1); } else C.rect(0, yM - 1, pw - 1, yM - 1, ",", 0);
  const bank = yM - 1, cH = ri(r, P.curtainH[0], P.curtainH[1]), cTop = bank - cH, gw = pw % 2 ? 5 : 4, gx = Math.round(mid - (gw - 1) / 2);
  // The keep behind the curtain (ashlar when the level has it), then the curtain and its gatehouse in front.
  const kwr = ri(r, P.keepW[0], P.keepW[1]), kw = kwr - ((kwr + pw) & 1), kh = Math.max(4, Math.min(ri(r, P.keepH[0], P.keepH[1]), cTop - 3 - P.skyMin)), kx = Math.round(mid - (kw - 1) / 2), kTop = cTop - kh;
  keep(C, kx, kw, kTop, cTop, has("ashlar") ? "ashlar" : "stone", has("roof") && "roof", has("banner") && "banner");
  curtain(C, 0, pw - 1, cTop, bank - 1, "stone", 4, (x) => Math.abs(x - mid) <= gw / 2 + 1);
  C.rect(gx, cTop - 1, gx + gw - 1, bank - 1, "stone", 1); merlons(C, gx, gx + gw - 1, cTop - 1, "stone"); C.rect(gx + 1, bank - 2, gx + gw - 2, bank - 1, "ink", 1);
  // Archer towers, slate: at both ends of the curtain, and (P.towers > 2) beside the gatehouse.
  const tw = 3, th = cH + ri(r, P.towerUp[0], P.towerUp[1]), nT = ri(r, P.towers[0], P.towers[1]), spots = [0, pw - tw, gx - tw - 1, gx + gw + 1];
  for (let i = 0; i < Math.max(1, Math.min(4, nT)); i++) { const tx = spots[i], inner = i >= 2, h2 = inner ? cH + 1 : th;
    if (!clearOf(C, tx, tx + tw - 1, bank - h2, bank - 1, "slate")) continue;
    tower(C, tx, tw, bank - h2, bank - 1, "slate", { roof: has("roof") && !inner && "roof", slits: true });
    towers.push({ at: [tx + 1, bank - 2], r: +(P.range[0] + r() * (P.range[1] - P.range[0])).toFixed(1) }); }
  return { C, gates, towers };
}

// Era 4: outer moat and drawbridge, the low outer curtain with its towers and gatehouse (the second gate's key in it), the
// outer ward (grass); then, with room (P.innerMoat and the rows for it), the inner moat with the second drawbridge, else
// the second gate is a portcullis in the inner gatehouse; the inner curtain, narrower and higher, on its bank path with
// towers at its ends; the keep on top with sky above it. The boss (P.innerMoat 1) always has both moats.
function era4(r, P, has) {
  const pw = ri(r, P.w[0], P.w[1]), ph = ri(r, P.h[0], P.h[1]), C = canvas(pw, ph), mid = (pw - 1) / 2;
  const fgH = ri(r, P.fg[0], P.fg[1]), yFg = ph - fgH, yM = yFg - P.moatH, gates = [], towers = [], bw = pw % 2 ? 3 : 2, tw = 3;
  const rg = (a) => +(a[0] + r() * (a[1] - a[0])).toFixed(1);
  sky(C, r, 0, Math.floor(ph * 0.2), has("cloud") && "cloud", null);
  const k1 = foreground(C, r, yFg, ph - 1, { lodge: has("wood") ? "wood" : "stone", lodgeRoof: has("roof") ? "roof" : null, tent: has("roof") && "roof", tree: has("tree") && "tree", trunk: has("wood") && "wood" });
  const g1 = moat(C, yM, yFg - 1, mid + 0.5, bw); g1.key = k1; gates.push(g1);
  // Rows from the outer bank up: outer curtain oH (+ merlons), ward, [inner moat + bank], inner curtain iH (+ merlons),
  // keep kh (+ merlons, turret roofs 2), sky over it at least P.skyMin.
  const bank1 = yM - 1, oH = ri(r, P.outerH[0], P.outerH[1]), ward = ri(r, P.ward[0], P.ward[1]), iH0 = ri(r, P.innerH[0], P.innerH[1]), kh0 = ri(r, P.keepH[0], P.keepH[1]);
  const free = bank1 - (oH + 1 + ward + 1 + iH0 + 1 + 3 + 2 + P.skyMin), inner = r() < P.innerMoat && free >= P.moatH + 1;
  const left = free - (inner ? P.moatH + 1 : 0), kh = Math.max(3, Math.min(kh0, 3 + left)), iH = Math.max(3, Math.min(iH0, iH0 + left - (kh - 3)));
  const oTop = bank1 - oH, gw = pw % 2 ? 5 : 4, gx = Math.round(mid - (gw - 1) / 2), wardTop = oTop - 1 - ward;
  C.rect(0, wardTop, pw - 1, oTop - 1, "grass", 0);
  curtain(C, 0, pw - 1, oTop, bank1 - 1, "stone", 4, (x) => Math.abs(x - mid) <= gw / 2 + 1);
  C.rect(gx, oTop - 1, gx + gw - 1, bank1 - 1, "stone", 1); merlons(C, gx, gx + gw - 1, oTop - 1, "stone"); C.rect(gx + 1, bank1 - 2, gx + gw - 2, bank1 - 1, "ink", 1);
  const k2 = [gx + ((gw - 1) >> 1), oTop]; C.set(k2[0], k2[1], "gilt", 1);
  const nO = ri(r, P.towersOut[0], P.towersOut[1]), oSpots = [0, pw - tw, gx - tw - 1, gx + gw + 1];
  for (let i = 0; i < nO; i++) { const tx = oSpots[i], h2 = oH + (i < 2 ? 2 : 1); if (!clearOf(C, tx, tx + tw - 1, bank1 - h2, bank1 - 1, "slate")) continue; tower(C, tx, tw, bank1 - h2, bank1 - 1, "slate", { slits: true }); towers.push({ at: [tx + 1, bank1 - 2], r: rg(P.rangeOut) }); }
  let bank2 = wardTop - 1;
  if (inner) { const y1 = wardTop - 1, y0 = y1 - P.moatH + 1, g2 = moat(C, y0, y1, mid + 0.5, bw); g2.key = k2; gates.push(g2); bank2 = y0 - 1; }
  else C.rect(0, bank2, pw - 1, bank2, ",", 0);
  const inset = ri(r, P.inset[0], P.inset[1]), ix0 = inset, ix1 = pw - 1 - inset, iTop = bank2 - iH;
  curtain(C, ix0, ix1, iTop, bank2 - 1, "stone", 3, (x) => Math.abs(x - mid) <= gw / 2);
  const ig = Math.round(mid - (bw - 1) / 2);
  if (inner) C.rect(ig, bank2 - 2, ig + bw - 1, bank2 - 1, "ink", 1);
  else { C.rect(ig, bank2 - 2, ig + bw - 1, bank2 - 1, "iron", 1); gates.push({ at: [ig, bank2 - 2], key: k2 }); }
  const nI = ri(r, P.towersIn[0], P.towersIn[1]), iSpots = [ix0, ix1 - tw + 1, ig - tw - 1, ig + bw + 1];
  for (let i = 0; i < nI; i++) { const tx = iSpots[i], h2 = iH + (i < 2 ? 2 : 1); if (!clearOf(C, tx, tx + tw - 1, bank2 - h2, bank2 - 1, "slate")) continue; tower(C, tx, tw, bank2 - h2, bank2 - 1, "slate", { roof: has("roof") && i < 2 && "roof", slits: true }); towers.push({ at: [tx + 1, bank2 - 2], r: rg(P.rangeIn) }); }
  const kwr = ri(r, P.keepW[0], P.keepW[1]), kw = kwr - ((kwr + pw) & 1), kx = Math.round(mid - (kw - 1) / 2), kTop = iTop - kh;
  keep(C, kx, kw, kTop, iTop - 1, has("ashlar") ? "ashlar" : "stone", null, has("banner") && "banner");
  return { C, gates, towers };
}
const ERAS = { 1: era1, 2: era2, 3: era3, 4: era4 };

// ---- roles, colours, the board --------------------------------------------------------------------------------------------
// Roles per era: `must` always; `opt` added in a seeded order until the level's colour count (P.colours) is reached. Gilt
// counts as a colour (its keys have cards); iron and water never do.
function rolesFor(era, P, Q, r) {
  const E2 = Q.eras[era], want = E2.must.slice(), opt = E2.opt.slice();
  for (let i = opt.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opt[i], opt[j]] = [opt[j], opt[i]]; }
  const first = (P.first || E2.first || []).filter((k) => opt.indexOf(k) >= 0); for (const k of first.reverse()) { opt.splice(opt.indexOf(k), 1); opt.unshift(k); }
  for (const k of opt) { if (want.length >= P.colours) break; want.push(k); }
  return want;
}
function castle(era, seed, P, Q) {
  const r = rng(seed);
  let want; try { want = rolesFor(era, P, Q, r); } catch (e) { return null; }
  const has = (k) => want.indexOf(k) >= 0;
  let res; try { res = ERAS[era](r, P, has); } catch (e) { return null; }
  if (!res) return null;
  const { C, gates, towers } = res;
  PIC.outline(C.role, C.subj, C.pw, C.ph, (v) => !!BG[v], "ink");
  // Roles actually on the board (a feature may have been crowded out), their ids by population, the palette.
  const cnt = {}; for (const v of C.role) cnt[v] = (cnt[v] || 0) + 1;
  const used = Object.keys(cnt).filter((v) => v !== "~" && v !== "," && v !== "iron" && v !== "gilt").sort((a, b) => cnt[b] - cnt[a] || (a < b ? -1 : 1));
  if (used.length > IDS.length) return null;
  const id = {}; used.forEach((v, k) => { id[v] = IDS[k]; }); id.iron = E.IRON; id.gilt = E.GILT;
  const fixed = {}; if (cnt.gilt) fixed.gilt = require("../config.json").v3.mats[E.GILT].c;
  const ch = choose(used.filter((v) => v !== "ink"), fixed, Q, seed, cnt);
  const pal = {}; for (const v of used) pal[id[v]] = { c: v === "ink" ? Q.ink : ch.c[v], n: Q.roles[v] ? Q.roles[v].name : v };
  if (cnt.iron) pal[E.IRON] = { c: Q.iron, n: "drawbridge" };
  const L = PIC.frame((x, y) => { const v = C.role[y * C.pw + x]; return v === "~" ? "~" : v === "," ? "," : E.chOf(id[v]); }, C.pw, C.ph, Q);
  const mv = (p) => [p[0] + 1, p[1] + 1];
  L.gates = gates.filter((g) => g.key).map((g) => ({ at: mv(g.at), key: mv(g.key) }));
  L.towers = towers.map((t) => ({ at: mv(t.at), r: t.r }));
  L.pal = pal; L.roles = used.concat(cnt.gilt ? ["gilt"] : []); L.palette = { minDE: +ch.minDE.toFixed(1), minFade: +ch.minFade.toFixed(1), worst: ch.worst };
  try { E.compile(Object.assign({ cols: [[], [], [], [], []] }, L)); } catch (e) { return null; }
  return L;
}
// The palette with the ink pinned: tools/pic.js choose over the other roles, the ink and the fixed colours standing with them.
function choose(roles, fixed, Q, seed) { return PIC.choose(roles, Object.assign({ ink: Q.ink }, fixed), Q, seed); }

module.exports = { castle, canvas, ERAS };

// ~/.local/opt/node/bin/node tools/castle.js --sheet OUT.png [--era E] [--n N] [--px 6] [--colours K]   a contact sheet
//   of freshly generated castles; --levels FILE [--cols 10] draws that file's boards instead (levels.json, teaching.json).
if (require.main === module) {
  const fs = require("fs"), path = require("path"), CV = require("./convert.js"), C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8"));
  const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
  const eras = arg("era") ? [+arg("era")] : [1, 2, 3, 4], n = +arg("n", 6), px = +arg("px", 6), out = arg("sheet", "castles.png"), boards = [];
  if (arg("levels")) boards.push(...JSON.parse(fs.readFileSync(path.resolve(arg("levels")), "utf8")).levels);
  else for (const e of eras) for (let k = 0; k < n; k++) {
    const P = Object.assign({}, C.eras[e].gen, { colours: +arg("colours", C.picture.eras[e].sample || 8) });
    let L = null; for (let t = 0; t < 40 && !L; t++) L = castle(e, 1000 * e + 37 * k + t, P, C.picture);
    if (!L) { console.log("era " + e + " #" + k + ": none"); continue; }
    boards.push(L); console.log("era " + e + " #" + k + ": " + L.w + "x" + L.h + " colours " + L.roles.length + " minDE " + L.palette.minDE + " faded " + L.palette.minFade + " (" + L.palette.worst + ") gates " + L.gates.length + " towers " + L.towers.length + " roles " + L.roles.join(","));
  }
  const cols = +arg("cols", Math.min(n, 6)), cw = Math.max(...boards.map((L) => L.w)) * px + 8, chh = Math.max(...boards.map((L) => L.h)) * px + 8, rows = Math.ceil(boards.length / cols);
  const W = cols * cw, H = rows * chh, rgb = new Uint8Array(W * H * 3).fill(30);
  boards.forEach((L, k) => { const R = PIC.render(L, px, C.picture.show), x0 = (k % cols) * cw + 4, y0 = ((k / cols) | 0) * chh + 4; for (let y = 0; y < R.h; y++) rgb.set(R.rgb.subarray(y * R.w * 3, (y + 1) * R.w * 3), ((y0 + y) * W + x0) * 3); });
  fs.writeFileSync(out, CV.encode(W, H, rgb)); console.log("wrote " + out);
}
