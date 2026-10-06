// Sapper's Path organic moats (SPEC-v4 §9, the organic moats entry; tools/feature-moats-notes.md): a ring of water round a
// picture's subject with 1 or 2 openings, the land feature from Land 2 (Peter, 2026-10-06: "dynamic moats like earlier
// levels, but instead of a straight line left to right, it could be around an image organically with 1 or 2 openings").
// The water is the engine's own (never eaten, never walked; a picture board already takes it anywhere inside its frame),
// so a moat is board data only. Numbers: tools/land-config.json plan.moat (MC below).
//   subjectOf(B, MC) -> {sub (Uint8Array, 1 on the subject's closed silhouette), share, contact, set} or {why}
//     The picture's background is the border-connected run of its background colours: a masked picture's bg, else a
//     set of the colours on the picture's outer ring (every non-empty set of the top MC.bgTop with MC.bgMin of the ring or
//     more is tried). What's left, its biggest 8-connected part and the parts of at least MC.partOf of it, closed by a
//     disc of MC.close cells (bays and gaps between parts filled) with its holes filled, is the subject. Kept: the set
//     whose subject scores best, share - MC.contactWeight x contact (contact: the share of the picture's outer ring it
//     covers), within MC.subject [lo, hi] of the picture and MC.maxContact.
//   ringOf(B, MC, ways, seed, S?, liquids?) -> {cells (water, cell indices), ground (the path: open ground), edge
//     (openings where the subject meets the picture's edge), cuts ([cell] where the ring was opened), ways (edge +
//     cuts), liquid (null: plain water), subject, contact, set} or {why}
//     The bank: the subject grown by a disc of MC.gap cells, smoothed once by majority (never thinner than one cell
//     round the subject). The ring: the cells outside the bank touching it 8-way, a channel one stud wide whose steps
//     share an edge, so it follows the outline as a curve (MC.width 2: a second row outside it). Where the bank runs
//     into the picture's edge the ring squeezes through on the bank's own edge cells; it stops only where the subject
//     itself meets the edge, and the subject is dug from the frame there: each such stretch is a way in (two with
//     MC.merge or fewer edge cells between are one: the notch between stays picture and its short arc goes dry; at most
//     MC.maxEdge). ways (the plan's faces: front, the ring nearest the entry; far, farthest from it; left; right) opens
//     the ring for each face no way in serves yet (one within MC.serve of the face's best cell; the edge stretches
//     count), MC.maxWays in all: a gap of open ground through it within MC.open of one of the MC.pick best crossing
//     cells for the face (seeded), MC.apart cells from every other way in and clear of the picture's edge. The path:
//     when the ring has a cut, the bank is open ground, as a castle's bank path (tools/castle.js), so once a cut is dug
//     through the subject's whole outline opens (with the bank left as picture the inside opened a cell at a time
//     through the gap and no deal fitted the 15 s and 55-tap caps on most boards, measured); bank cells within
//     MC.edgeKeep of an edge way in stay picture (else digging one edge block opened the whole outline and the level
//     played far too easy, measured), and with no cut the whole bank does. The path never joins the frame before
//     anything is dug. Water and path only ever replace cells outside the subject. Every cell left must be reachable
//     4-way from the frame once dug (a pocket of MC.pond cells or fewer outside the subject becomes water; a bigger
//     one, or any of the subject, fails) and there must be MC.minRing cells of water at least. Its colour: the first of
//     liquids (default [null]; null is plain water, else a config board.pic.liquids name) that stands MC.waterDE [base,
//     shade] from every picture colour and shade, else it fails.
//   apply(L, R) -> L with the ring's cells turned to water ("~"), its path to open ground (",") and R.liquid set.
//   reach(L) -> true when every non-water cell of a picture board is reachable 4-way from its frame through non-water.
// Deterministic (the seed only picks among a face's best cells); bounded loops; never throws on a well-formed board.
"use strict";
const E = require("../src/engine.js");
const PAL = require("./palette.js");

const hash01 = (n, k) => { let t = Math.imul(n + 0x3c6e, 0x9E3779B1) ^ Math.imul(k + 11, 0x85EBCA77); t ^= t >>> 15; t = Math.imul(t, 0x2c1b3c6d); t ^= t >>> 12; return (t >>> 0) / 4294967296; };
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], D8 = D4.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
// The picture inside its 1-cell frame: inP(x, y), and its outer ring as a cycle (clockwise from the top left).
function frameOf(w, h) {
  const inP = (x, y) => x >= 1 && y >= 1 && x <= w - 2 && y <= h - 2, per = [];
  for (let x = 1; x <= w - 2; x++) per.push(w + x); for (let y = 2; y <= h - 2; y++) per.push(y * w + w - 2);
  for (let x = w - 3; x >= 1; x--) per.push((h - 2) * w + x); for (let y = h - 3; y >= 2; y--) per.push(y * w + 1);
  return { inP, per };
}
// Flood (4-way) from seeds through cells where pass(c); returns the reached mask.
function flood(w, h, seeds, pass) {
  const got = new Uint8Array(w * h), q = new Int32Array(w * h); let qh = 0, qt = 0;
  for (const c of seeds) if (!got[c] && pass(c)) { got[c] = 1; q[qt++] = c; }
  while (qh < qt) { const c = q[qh++], x = c % w, y = (c / w) | 0; for (const [dx, dy] of D4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const e = Y * w + X; if (!got[e] && pass(e)) { got[e] = 1; q[qt++] = e; } } }
  return got;
}
// Disc offsets of radius r (cells with dx^2 + dy^2 <= r^2).
const disc = (r) => { const o = [], k = Math.ceil(r); for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) if (dx * dx + dy * dy <= r * r + 1e-9) o.push([dx, dy]); return o; };
// Dilate (any disc cell set) or erode (every disc cell set; outside the picture counts as set) a picture mask.
function morph(w, h, inP, m, r, grow) {
  const out = new Uint8Array(w * h), D = disc(r);
  for (let y = 1; y <= h - 2; y++) for (let x = 1; x <= w - 2; x++) { let v = grow ? 0 : 1;
    for (const [dx, dy] of D) { const X = x + dx, Y = y + dy, s = inP(X, Y) ? m[Y * w + X] : grow ? 0 : 1; if (grow ? s : !s) { v = grow ? 1 : 0; break; } }
    out[y * w + x] = v; }
  return out;
}

function subjectOf(B, MC) {
  const w = B.w, h = B.h, n = w * h, { inP, per } = frameOf(w, h), col = new Int8Array(n), area = (w - 2) * (h - 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) col[y * w + x] = E.matOf(B.grid[y][x]);
  let sets;
  if (B.bg) sets = [[B.bg]];
  else { const cnt = new Map(); for (const c of per) if (col[c] > 0) cnt.set(col[c], (cnt.get(col[c]) || 0) + 1);
    const top = [...cnt].filter((e) => e[1] >= MC.bgMin * per.length).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, MC.bgTop).map((e) => e[0]);
    sets = []; for (let b = 1; b < 1 << top.length; b++) sets.push(top.filter((_, i) => (b >> i) & 1)); }
  let best = null, why = "no background colour on the picture's edge";
  for (const S of sets) {
    const isBg = (c) => S.indexOf(col[c]) >= 0, bg = flood(w, h, per, (c) => inP(c % w, (c / w) | 0) && isBg(c));
    // The rest, in 8-connected parts: the biggest and those at least partOf of it.
    const part = new Int32Array(n).fill(-1), sizes = [];
    for (let c0 = 0; c0 < n; c0++) { if (part[c0] >= 0 || bg[c0] || !inP(c0 % w, (c0 / w) | 0)) continue; const id = sizes.length, st = [c0]; part[c0] = id; let k = 0;
      while (st.length) { const c = st.pop(), x = c % w, y = (c / w) | 0; k++; for (const [dx, dy] of D8) { const X = x + dx, Y = y + dy; if (!inP(X, Y)) continue; const e = Y * w + X; if (part[e] < 0 && !bg[e]) { part[e] = id; st.push(e); } } }
      sizes.push(k); }
    if (!sizes.length) { why = "no subject left once the background is taken"; continue; }
    const big = Math.max(...sizes), keep = sizes.map((s) => s >= MC.partOf * big), m = new Uint8Array(n);
    for (let c = 0; c < n; c++) if (part[c] >= 0 && keep[part[c]]) m[c] = 1;
    const closed = morph(w, h, inP, morph(w, h, inP, m, MC.close, true), MC.close, false); for (let c = 0; c < n; c++) if (m[c]) closed[c] = 1;
    const out = flood(w, h, per, (c) => inP(c % w, (c / w) | 0) && !closed[c]), sub = new Uint8Array(n); let k = 0;
    for (let c = 0; c < n; c++) if (inP(c % w, (c / w) | 0) && !out[c]) { sub[c] = 1; k++; }
    const share = k / area, contact = per.filter((c) => sub[c]).length / per.length;
    if (share < MC.subject[0] || share > MC.subject[1]) { why = "subject " + (100 * share).toFixed(0) + "% of the picture (" + MC.subject.map((v) => 100 * v).join("-") + "%)"; continue; }
    if (contact > MC.maxContact) { why = "subject covers " + (100 * contact).toFixed(0) + "% of the picture's edge"; continue; }
    const score = share - MC.contactWeight * contact;
    if (!best || score > best.score + 1e-9) best = { sub, share: +share.toFixed(3), contact: +contact.toFixed(3), set: S, score };
  }
  return best || { why };
}

// The camp's middle (the entry), for the faces.
function campOf(B) { let x0 = -1, x1 = -1; const y = B.h - 1; for (let x = 0; x < B.w; x++) if (B.grid[y][x] === "#") { if (x0 < 0) x0 = x; x1 = x; } return [(x0 + x1) / 2, y]; }

function ringOf(B, MC, ways, seed, S0, liquids) {
  const w = B.w, h = B.h, n = w * h, { inP, per } = frameOf(w, h), S = S0 || subjectOf(B, MC);
  if (!S.sub) return { why: S.why };
  const sub = S.sub, xy = (c) => [c % w, (c / w) | 0], at = (c) => inP(c % w, (c / w) | 0);
  // The bank: the subject grown by MC.gap, smoothed by majority, never under one cell (8-way) round the subject.
  const grown = morph(w, h, inP, sub, MC.gap, true), bank = new Uint8Array(n);
  for (let y = 1; y <= h - 2; y++) for (let x = 1; x <= w - 2; x++) { let k = 0, t = 0; for (const [dx, dy] of D8.concat([[0, 0]])) { if (!inP(x + dx, y + dy)) continue; t++; k += grown[(y + dy) * w + x + dx]; } bank[y * w + x] = 2 * k > t ? 1 : 0; }
  for (let c = 0; c < n; c++) if (sub[c]) { bank[c] = 1; const [x, y] = xy(c); for (const [dx, dy] of D8) if (inP(x + dx, y + dy)) bank[(y + dy) * w + x + dx] = 1; }
  // The ring: outside the bank, touching it 8-way (MC.width rows). Where the bank runs into the picture's edge the ring
  // squeezes through on the bank's own edge cells (never the subject's), so it only stops where the subject meets the edge.
  // keep: cells inside the ring that stay as the picture drew them (a merged notch, below); the rest of the bank is path.
  const water = new Uint8Array(n), keep = new Uint8Array(n), cutC = new Uint8Array(n); let edge0 = bank;
  for (let r = 0; r < MC.width; r++) { const next = new Uint8Array(n);
    for (let c = 0; c < n; c++) { if (!at(c) || bank[c] || water[c]) continue; const [x, y] = xy(c); for (const [dx, dy] of D8) { const X = x + dx, Y = y + dy; if (inP(X, Y) && edge0[Y * w + X]) { next[c] = 1; break; } } }
    for (let c = 0; c < n; c++) if (next[c]) water[c] = 1; edge0 = next; }
  for (const c of per) if (bank[c] && !sub[c]) { bank[c] = 0; water[c] = 1; }
  // Openings at the edge: stretches of the picture's outer ring where the subject meets it (as a cycle). Two of them
  // with MC.merge or fewer edge cells between are one: the background between (a notch shut in by a short arc of water)
  // joins the bank and its arc goes dry.
  const runsOf = () => { const L = per.length, on = per.map((c) => !!bank[c]), rs = []; if (on.every(Boolean)) return null;
    const s0 = on.indexOf(false); let cur = null; for (let i = 1; i <= L; i++) { const j = (s0 + i) % L; if (on[j]) { if (!cur) { cur = { cells: [], at: i }; rs.push(cur); } cur.cells.push(per[j]); cur.end = i; } else cur = null; }
    rs.forEach((r, k) => { const nx = rs[(k + 1) % rs.length]; r.gap = rs.length < 2 ? L : ((nx.at - r.end - 1) % L + L) % L; r.from = r.end; }); return { rs, s0, L }; };
  let RS = runsOf(); if (!RS) return { why: "the bank covers the picture's whole edge" };
  for (let g = 0; g < 8 && RS.rs.length > 1 && RS.rs.some((r) => r.gap <= MC.merge); g++) {
    const seeds = []; for (const r of RS.rs) if (r.gap <= MC.merge) for (let i = 1; i <= r.gap; i++) seeds.push(per[(RS.s0 + r.from + i) % RS.L]);
    const gapC = new Set(seeds), piece = flood(w, h, seeds, (c) => gapC.has(c) || (at(c) && !bank[c] && !water[c])); for (let c = 0; c < n; c++) if (piece[c]) { bank[c] = 1; keep[c] = 1; water[c] = 0; }
    for (let c = 0; c < n; c++) { if (!water[c]) continue; const [x, y] = xy(c); let o = false; for (const [dx, dy] of D8) { const X = x + dx, Y = y + dy; if (inP(X, Y) && !bank[Y * w + X] && !water[Y * w + X]) { o = true; break; } } if (!o) { water[c] = 0; bank[c] = 1; keep[c] = 1; } }
    RS = runsOf(); if (!RS) return { why: "the bank covers the picture's whole edge" }; }
  const runs = RS.rs.map((r) => r.cells);
  if (runs.length > MC.maxEdge) return { why: runs.length + " openings where the subject meets the picture's edge (" + MC.maxEdge + " at most)" };
  // Cut the ring for the planned faces past those at the edge, each at one of its MC.pick best crossing cells (never so
  // near the picture's edge that the cut's path would join the frame).
  const outside = (c) => at(c) && !bank[c] && !water[c], [cx, cy] = campOf(B), opens = runs.map((r) => r[r.length >> 1]), cuts = [];
  const edgeD = (c) => { const [x, y] = xy(c); return Math.min(x - 1, y - 1, w - 2 - x, h - 2 - y); };
  const far = (c) => opens.every((o) => { const [a, b] = xy(c), [p, q] = xy(o); return Math.hypot(a - p, b - q) >= MC.apart; });
  const cross = (c) => { const [x, y] = xy(c); let i = false, o = false; for (const [dx, dy] of D4) { const X = x + dx, Y = y + dy; if (!inP(X, Y)) continue; const e = Y * w + X; if (bank[e]) i = true; else if (outside(e)) o = true; } return i && o; };
  const ys = []; for (let c = 0; c < n; c++) if (water[c]) ys.push((c / w) | 0); const ymid = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : h / 2;
  const FACE = { front: (x, y) => Math.hypot(x - cx, y - cy), far: (x, y) => -Math.hypot(x - cx, y - cy), left: (x, y) => x + 0.25 * Math.abs(y - ymid), right: (x, y) => -x + 0.25 * Math.abs(y - ymid) };
  function pickOf(f, k, all) { const sc = FACE[f]; if (!sc) return -1; const cand = []; for (let c = 0; c < n; c++) if (water[c] && cross(c) && (all || (far(c) && edgeD(c) > MC.open))) cand.push(c);
    cand.sort((p, q) => sc(...xy(p)) - sc(...xy(q)) || p - q); if (!cand.length) return -1; return all ? cand[0] : cand[Math.min(cand.length - 1, Math.floor(hash01(seed + k, 31) * Math.min(MC.pick, cand.length)))]; }
  // A face is served when an opening (an edge stretch or an earlier cut) lies within MC.serve of its best cell; else the
  // ring is cut there, up to MC.maxWays openings in all.
  const served = (c) => runs.some((r) => r.some((o) => Math.hypot(xy(c)[0] - xy(o)[0], xy(c)[1] - xy(o)[1]) <= MC.serve)) || cuts.some((o) => Math.hypot(xy(c)[0] - xy(o)[0], xy(c)[1] - xy(o)[1]) <= MC.serve);
  for (let i = 0; i < ways.length; i++) { const b0 = pickOf(ways[i], 0, true); if (b0 < 0) return { why: "no ring cell for its " + ways[i] }; if (served(b0)) continue;
    if (runs.length + cuts.length >= MC.maxWays) break; const c = pickOf(ways[i], i + 1); if (c < 0) return { why: "no room to open the ring at its " + ways[i] };
    const [x, y] = xy(c); for (const [dx, dy] of disc(MC.open)) { const X = x + dx, Y = y + dy, e = Y * w + X; if (inP(X, Y) && water[e]) { water[e] = 0; cutC[e] = 1; } } cuts.push(c); opens.push(c); }
  // Every cell left reachable from the frame (4-way, once dug); small pockets outside the subject become water.
  const ok = flood(w, h, per, (c) => at(c) && !water[c]), pocket = []; let bad = false;
  for (let c = 0; c < n; c++) if (at(c) && !water[c] && !ok[c]) { pocket.push(c); if (sub[c]) bad = true; }
  if (bad || pocket.length > MC.pond) return { why: "the ring shuts in " + pocket.length + " cells" + (bad ? " of the subject" : "") };
  for (const c of pocket) water[c] = 1;
  // The path: the bank, when the ring has a cut (a gap through water then opens the subject's whole outline); bank cells
  // within MC.edgeKeep of an edge way in stay picture, and with no cut the whole bank does (the subject is dug from its
  // edge, as any picture is).
  const isBank = (c) => bank[c] && !sub[c] && !keep[c] && !water[c], land = new Uint8Array(n);
  const nearEdgeWay = (c) => runs.some((r) => r.some((o) => Math.max(Math.abs(xy(c)[0] - xy(o)[0]), Math.abs(xy(c)[1] - xy(o)[1])) <= MC.edgeKeep));
  if (cuts.length) for (let c = 0; c < n; c++) if (isBank(c) && !nearEdgeWay(c)) land[c] = 1;
  const cells = [], ground = []; for (let c = 0; c < n; c++) { if (water[c]) cells.push(c); else if (cutC[c] || land[c]) ground.push(c); }
  if (cells.length < MC.minRing) return { why: "a ring of " + cells.length + " cells (" + MC.minRing + " at least)" };
  // The path (the bank and the cuts: open ground, as a castle's bank path) must not join the frame before anything is dug.
  const path = new Uint8Array(n); for (const c of ground) path[c] = 1;
  const open0 = flood(w, h, per, (c) => !!path[c]); if (ground.some((c) => open0[c])) return { why: "the path round the subject joins the frame before anything is dug" };
  // The water's colour against the picture's colours and shades.
  const CFG = require("../config.json").board.pic, cols = []; for (const k of Object.keys(B.pal || {})) { cols.push([B.pal[k].c, MC.waterDE[0]]); for (const s of B.pal[k].sh || []) if (s) cols.push([s, MC.waterDE[1]]); }
  const clear = (k) => { const hx = k ? CFG.liquids[k] && CFG.liquids[k].water : CFG.water; return !!hx && cols.every(([c, f]) => PAL.de00(PAL.lab(c), PAL.lab(hx)) >= f); };
  const liquid = (liquids || [null]).find(clear); if (liquid === undefined) return { why: "a picture colour (or shade) within " + MC.waterDE.join("/") + " of every water colour (" + (liquids || [null]).map((k) => k || "water").join(", ") + ")" };
  return { cells, ground, edge: runs.length, cuts, ways: runs.length + cuts.length, liquid, subject: S.share, contact: S.contact, set: S.set };
}

function apply(L, R) {
  const g = L.grid.map((r) => r.split(""));
  for (const c of R.cells) g[(c / L.w) | 0][c % L.w] = "~"; for (const c of R.ground || []) g[(c / L.w) | 0][c % L.w] = ",";
  L.grid = g.map((r) => r.join("")); if (R.liquid) L.liquid = R.liquid;
  return L;
}
function reach(L) {
  const w = L.w, h = L.h, { inP, per } = frameOf(w, h), wet = (c) => L.grid[(c / w) | 0][c % w] === "~";
  const ok = flood(w, h, per, (c) => inP(c % w, (c / w) | 0) && !wet(c));
  for (let c = 0; c < w * h; c++) if (inP(c % w, (c / w) | 0) && !wet(c) && !ok[c]) return false;
  return true;
}
module.exports = { subjectOf, ringOf, apply, reach, frameOf };
