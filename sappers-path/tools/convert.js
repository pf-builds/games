// Sapper's Path v4 M4, the Gallery converter: a picture -> a ring level plan (SPEC-v4 §9, M4). Deterministic; every
// number comes from tools/gallery-config.json (convert) or the picture's line in levels/gallery-manifest.json.
//   ~/.local/opt/node/bin/node tools/convert.js ID [--png OUT] [--px 8]   one picture's plan as JSON (and a preview PNG)
//   ~/.local/opt/node/bin/node tools/convert.js --sheet OUT.png [--all]    a contact sheet of every kept picture (--all:
//                                                                          every candidate), with each board's stats
// require()d: {plan(src, opt, C), decode(buf), encode(w, h, rgba), render(plan, px), names, ...}.
//
// Input: a PNG (8-bit RGBA or RGB, not interlaced; tools/gallery-src.py writes the sources so) under tools/gallery-src/.
// Output plan: {w, h, grid (the picture inside a 1-cell ring of camp), ring: true, pal: {id: {c, n}}, subject cells,
// stats: {colours, minDE, cells, outline}}. The page draws pal instead of v3.mats for the level; ids 10 (iron gates) and
// 14 (gilt keys) are never used by a picture, so they keep their meaning.
// Steps:
//   1. Crop (the manifest's crop, fractions of the image) and mask the subject: alpha (emoji: alpha >= alphaMin), flood
//      (our generated pictures: every pixel a flood from the image border reaches over colours within floodDE of the
//      border's median colour is background), none (paintings: everything is subject, no outline).
//   2. Fit: the subject's bounding box plus `margin` cells a side is scaled to fit the picture box (the manifest's box, else
//      convert.box for its kind: columns x rows without the ring), keeping its aspect; the board is cropped to it.
//   3. Palette: k-means in CIELAB over the subject's pixels (a 5-bit-per-channel histogram, seeded k-means++, k0
//      clusters); then the ink (the outline black) and the background (the manifest's, else for an emoji the first of
//      convert.bgs, pale ones first, bgGap past minDE from all its colours, else the farthest, for ours the flood's mean; lightened if it is near the ink), then the
//      clusters, best sqrt(population) x distance first, each kept when it holds minShare of the subject and is minDE
//      (CIEDE2000) from every kept colour, up to maxColours (select). A kind may scale chroma (a*, b*) first (paintings:
//      old varnish reads muddy at 40 cells).
//   4. Cells: each cell is the majority vote of the source pixels it covers (a pixel votes background or its nearest
//      palette colour), so edges stay crisp and no in-between colours appear.
//   5. Outline (masked pictures): every background cell 8-adjacent to the subject turns ink, `outline` times (1: one cell,
//      plus the picture's own dark lines, which merge into ink), so the subject is shut off from the background: nothing
//      inside is in reach until a black squad breaches it (reachability alone; no rule of its own).
//   6. Ids and names: palette colours by population get material ids 1-9, 11-13 (never 10 or 14); each gets a name from
//      convert.names, all different (nameAll: nearest unused, best matches first); then the ring.
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const E = require("../src/engine.js");
const PAL = require("./palette.js");
const { rng } = require("./grade.js");

const ROOT = path.join(__dirname, "..");
const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13];

// ---- PNG in and out (zlib only) ------------------------------------------------------------------------------------
function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("png: not a PNG");
  let o = 8, w = 0, h = 0, ct = 0; const idat = [];
  for (let guard = 0; o < buf.length && guard < 100000; guard++) {
    const len = buf.readUInt32BE(o), type = buf.toString("ascii", o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12] !== 0 || (ct !== 6 && ct !== 2)) throw new Error("png: only 8-bit RGB(A), not interlaced"); }
    else if (type === "IDAT") idat.push(d); else if (type === "IEND") break;
    o += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), out = new Uint8Array(w * h * 4), prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      cur[i] = (row[i] + (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) out[(y * w + x) * 4 + k] = k < bpp ? cur[x * bpp + k] : 255;
    prev.set(cur);
  }
  return { w, h, rgba: out };
}
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function encode(w, h, rgb) { // 8-bit RGB PNG
  const raw = Buffer.alloc(h * (w * 3 + 1)); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const chunk = (type, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(type, 4, "ascii"); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---- colour ----------------------------------------------------------------------------------------------------------
const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const rgbOf = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const labOf = (r, g, b) => PAL.lab(hex(r, g, b));
const d76 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
const de = (p, q) => PAL.de00(p, q);

// The subject mask at source resolution: 1 subject, 0 background.
function maskOf(img, mode, C) {
  const { w, h, rgba } = img, m = new Uint8Array(w * h);
  if (mode === "alpha") { for (let i = 0; i < w * h; i++) m[i] = rgba[i * 4 + 3] >= C.alphaMin ? 1 : 0; return m; }
  m.fill(1); if (mode !== "flood") return m;
  // The border's median colour, then a flood over pixels within floodDE of it (4-connected, from every border pixel).
  const bd = []; for (let x = 0; x < w; x++) bd.push(0 * w + x, (h - 1) * w + x); for (let y = 0; y < h; y++) bd.push(y * w, y * w + w - 1);
  const med = [0, 1, 2].map((k) => { const v = bd.map((i) => rgba[i * 4 + k]).sort((a, b) => a - b); return v[v.length >> 1]; }), L0 = labOf(...med);
  const labs = new Map(), near = (i) => { const k = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2]; let L = labs.get(k); if (!L) { L = labOf(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]); labs.set(k, L); } return de(L, L0) <= C.floodDE; };
  const q = []; for (const i of bd) if (m[i] && near(i)) { m[i] = 0; q.push(i); }
  for (let k = 0; k < q.length; k++) { const i = q[k], x = i % w, y = (i / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy, j = Y * w + X; if (X >= 0 && Y >= 0 && X < w && Y < h && m[j] && near(j)) { m[j] = 0; q.push(j); } } }
  return m;
}

// k-means in Lab over a weighted histogram (5 bits a channel), seeded k-means++; returns [{lab, n}].
function kmeans(img, mask, k0, seed) {
  const { w, h, rgba } = img, bins = new Map();
  for (let i = 0; i < w * h; i++) { if (!mask[i]) continue; const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2], key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3); let e = bins.get(key); if (!e) { e = [0, 0, 0, 0]; bins.set(key, e); } e[0] += r; e[1] += g; e[2] += b; e[3]++; }
  const pts = [...bins.keys()].sort((a, b) => a - b).map((k) => { const e = bins.get(k); return { lab: labOf(e[0] / e[3], e[1] / e[3], e[2] / e[3]), n: e[3] }; });
  if (!pts.length) return [];
  const r = rng(seed), cs = [], k = Math.min(k0, pts.length), tot = pts.reduce((s, p) => s + p.n, 0);
  let x = r() * tot, i0 = 0; for (; i0 < pts.length - 1 && x >= pts[i0].n; i0++) x -= pts[i0].n; cs.push(pts[i0].lab.slice());
  while (cs.length < k) { let s = 0; const dd = pts.map((p) => { const v = Math.min(...cs.map((c) => d76(p.lab, c))) * p.n; s += v; return v; }); if (!s) break; x = r() * s; let j = 0; for (; j < pts.length - 1 && x >= dd[j]; j++) x -= dd[j]; cs.push(pts[j].lab.slice()); }
  let as = new Int32Array(pts.length);
  for (let it = 0; it < 30; it++) {
    let moved = false; pts.forEach((p, i) => { let b = 0, bd = Infinity; cs.forEach((c, j) => { const d = d76(p.lab, c); if (d < bd) { bd = d; b = j; } }); if (as[i] !== b) moved = true; as[i] = b; });
    const acc = cs.map(() => [0, 0, 0, 0]); pts.forEach((p, i) => { const a = acc[as[i]]; a[0] += p.lab[0] * p.n; a[1] += p.lab[1] * p.n; a[2] += p.lab[2] * p.n; a[3] += p.n; });
    acc.forEach((a, j) => { if (a[3]) cs[j] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
    if (!moved && it) break;
  }
  const n = cs.map(() => 0); pts.forEach((p, i) => { n[as[i]] += p.n; });
  return cs.map((lab, j) => ({ lab, n: n[j] })).filter((c) => c.n > 0);
}
// The palette: the pinned colours (ink, the background), then the subject's clusters one at a time, each time the one
// with the best sqrt(population) x distance to the nearest kept colour, kept only when it holds at least minShare of the
// subject and stands minDE or more (CIEDE2000) from every kept colour, up to max. A cluster left out goes to its nearest
// kept colour when the cells are voted, so every pair that stands together in the picture is minDE apart by
// construction, and the kept colours spread over the picture's range instead of piling up on its commonest tones.
function select(pins, cols, minDE, minShare, max) {
  const tot = cols.reduce((s, c) => s + c.n, 0) || 1, out = pins.slice(), left = cols.filter((c) => c.n / tot >= minShare);
  for (let guard = 0; guard < 64 && out.length < max && left.length; guard++) {
    let bi = -1, bs = 0;
    left.forEach((c, i) => { const d = out.length ? Math.min(...out.map((q) => de(q.lab, c.lab))) : 100; if (d >= minDE && Math.sqrt(c.n) * d > bs) { bs = Math.sqrt(c.n) * d; bi = i; } });
    if (bi < 0) break; out.push(left.splice(bi, 1)[0]);
  }
  return out;
}
// Lab -> sRGB hex (D65), clamped.
function hexOfLab(L) {
  const fy = (L[0] + 16) / 116, fx = fy + L[1] / 500, fz = fy - L[2] / 200, inv = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const lin = [3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, -0.969266 * X + 1.8760108 * Y + 0.041556 * Z, 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z];
  return hex(...lin.map((c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055)));
}

// ---- the plan --------------------------------------------------------------------------------------------------------
// src: {rgba, w, h}; opt: the manifest line (mask, crop, box, bg, outline, colours, margin); C: gallery-config convert.
function plan(src0, opt, C) {
  const kind = opt.kind || "emoji", K = Object.assign({}, C.kinds[kind] || {}, opt), mode = K.mask || "alpha";
  // 1. Crop.
  let src = src0;
  if (K.crop) { const [a, b, c, d] = K.crop, x0 = Math.round(a * src0.w), y0 = Math.round(b * src0.h), x1 = Math.round(c * src0.w), y1 = Math.round(d * src0.h), w = x1 - x0, h = y1 - y0, o = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) o.set(src0.rgba.subarray(((y0 + y) * src0.w + x0) * 4, ((y0 + y) * src0.w + x1) * 4), y * w * 4); src = { w, h, rgba: o }; }
  const mask = maskOf(src, mode, C);
  // 2. Fit the subject's box (plus the margin) into the picture box.
  let bx0 = src.w, by0 = src.h, bx1 = -1, by1 = -1;
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (mask[y * src.w + x]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  if (bx1 < 0) throw new Error("convert: empty subject");
  const masked = mode !== "none", mg = masked ? K.margin : 0, [BW, BH] = K.box, sw = bx1 - bx0 + 1, sh = by1 - by0 + 1;
  const scale = Math.min((BW - 2 * mg) / sw, (BH - 2 * mg) / sh), cw = Math.max(1, Math.round(sw * scale)), ch = Math.max(1, Math.round(sh * scale)), pw = cw + 2 * mg, ph = ch + 2 * mg;
  // 3. The palette: the ink and (masked) the background pinned, then the subject's clusters (select).
  const cols = kmeans(src, mask, C.k0, C.seed), max = K.colours || C.maxColours, minDE = K.minDE || C.minDE;
  if (K.chroma) for (const c of cols) { c.lab[1] *= K.chroma; c.lab[2] *= K.chroma; } // a kind's chroma boost (paintings), before the choice
  const ink = { lab: PAL.lab(C.ink), n: 0, pin: true, ink: true }, pins = masked ? [ink] : [];
  let bgHex = K.bg;
  if (masked && !bgHex) {
    if (mode === "flood") { let s = [0, 0, 0], n = 0; for (let i = 0; i < src.w * src.h; i++) if (!mask[i]) { s[0] += src.rgba[i * 4]; s[1] += src.rgba[i * 4 + 1]; s[2] += src.rgba[i * 4 + 2]; n++; } bgHex = n ? hex(s[0] / n, s[1] / n, s[2] / n) : C.bgs[0]; }
    else { // the first of convert.bgs (pale ones first) that stands bgGap past minDE from every subject colour, else the farthest
      const sub = select([ink], cols, minDE, C.minShare, max - 1), dist = (b) => Math.min(...sub.map((c) => de(c.lab, PAL.lab(b))));
      bgHex = C.bgs.find((b) => dist(b) >= minDE + C.bgGap) || C.bgs.slice().sort((a, b) => dist(b) - dist(a))[0]; }
    // A background too near the ink (a dark one) is lightened until the outline stands out from it.
    for (let g = 0; g < 40 && de(PAL.lab(bgHex), ink.lab) < minDE; g++) { const L = PAL.lab(bgHex); L[0] += 3; bgHex = hexOfLab(L); }
  }
  const bg = masked ? { lab: PAL.lab(bgHex), n: 0, pin: true, bg: true } : null; if (bg) pins.push(bg);
  const pal = select(pins, cols, minDE, C.minShare, max);
  // Steps 4-6, again without the rarer colour of the nearest pair while a pair falls under minDE once the colours are
  // clamped into sRGB (a boosted painting colour can move).
  let res = null;
  for (let guard = 0; guard < 12; guard++) {
    res = cellsOf(src, mask, pal, bg, ink, K, C, { masked, pw, ph, mg, scale, bx0, by0, bgHex });
    if (res.minDE >= minDE || res.pair.length < 2) break;
    const drop = res.pair.filter((j) => !pal[j].pin).sort((a, b) => res.pop[a] - res.pop[b])[0]; if (drop == null) break; pal.splice(drop, 1);
  }
  const { W, H, grid, out, used, outlineN } = res;
  return { w: W, h: H, grid, ring: true, pal: out, stats: { colours: used.length, minDE: +res.minDE.toFixed(1), cells: pw * ph, outline: outlineN, bg: masked ? bgHex : null } };
}
// 4. Cells: a majority vote of the source pixels each cell covers (background, or the nearest palette colour). 5. The
// outline: background cells 8-adjacent to the subject turn ink, K.outline rings deep. 6. Ids by population (never 10 or
// 14), names, the ring. Returns the grid, the palette, and the nearest pair of used colours (indices into pal).
function cellsOf(src, mask, pal, bg, ink, K, C, F) {
  const { masked, pw, ph, mg, scale, bx0, by0, bgHex } = F;
  const near = new Map(), pick = (i) => { if (!mask[i]) return -1; const key = (src.rgba[i * 4] << 16) | (src.rgba[i * 4 + 1] << 8) | src.rgba[i * 4 + 2]; let v = near.get(key);
    if (v == null) { const L = labOf(src.rgba[i * 4], src.rgba[i * 4 + 1], src.rgba[i * 4 + 2]); if (K.chroma) { L[1] *= K.chroma; L[2] *= K.chroma; } let bd = Infinity; pal.forEach((c, j) => { if (c.bg) return; const d = d76(L, c.lab); if (d < bd) { bd = d; v = j; } }); near.set(key, v); } return v; };
  const cell = new Int16Array(pw * ph).fill(-1), sub = new Uint8Array(pw * ph), votes = new Float64Array(pal.length + 1);
  const ox = bx0 - mg / scale, oy = by0 - mg / scale;
  for (let cy = 0; cy < ph; cy++) for (let cx = 0; cx < pw; cx++) {
    votes.fill(0); const x0 = ox + cx / scale, x1 = ox + (cx + 1) / scale, y0 = oy + cy / scale, y1 = oy + (cy + 1) / scale;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(src.h, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(src.w, Math.ceil(x1)); x++) {
      const f = (Math.min(x + 1, x1) - Math.max(x, x0)) * (Math.min(y + 1, y1) - Math.max(y, y0)); if (f <= 0) continue; const v = pick(y * src.w + x); votes[v + 1] += f; }
    let b = 0; for (let j = 1; j <= pal.length; j++) if (votes[j] > votes[b]) b = j;
    const i = cy * pw + cx; if (b > 0) { cell[i] = b - 1; sub[i] = 1; } else cell[i] = masked ? pal.indexOf(bg) : -1;
    if (!masked && cell[i] < 0) { cell[i] = 0; sub[i] = 1; }
  }
  let outlineN = 0;
  if (masked) for (let t = 0; t < K.outline; t++) {
    const add = [];
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const i = y * pw + x; if (sub[i]) continue;
      let touch = false; for (let dy = -1; dy <= 1 && !touch; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < pw && Y < ph && sub[Y * pw + X]) { touch = true; break; } }
      if (touch) add.push(i); }
    for (const i of add) { cell[i] = pal.indexOf(ink); sub[i] = 1; outlineN++; }
  }
  const pop = pal.map(() => 0); for (let i = 0; i < pw * ph; i++) pop[cell[i]]++;
  const used = pal.map((c, j) => j).filter((j) => pop[j] > 0).sort((a, b) => pop[b] - pop[a] || a - b).slice(0, IDS.length);
  const idOf = new Int16Array(pal.length).fill(0); used.forEach((j, k) => { idOf[j] = IDS[k]; });
  const out = {}, hexes = used.map((j) => (pal[j].ink ? C.ink : pal[j].bg ? bgHex : hexOfLab(pal[j].lab))), nm = nameAll(hexes, C);
  used.forEach((j, k) => { out[IDS[k]] = { c: hexes[k], n: nm[k] }; });
  const W = pw + 2, H = ph + 2, grid = [];
  for (let y = 0; y < H; y++) { let s = ""; for (let x = 0; x < W; x++) s += x === 0 || y === 0 || x === W - 1 || y === H - 1 ? "#" : E.chOf(idOf[cell[(y - 1) * pw + (x - 1)]] || idOf[used[0]]); grid.push(s); }
  const labs = hexes.map((h) => PAL.lab(h)); let minDE = Infinity, pair = [];
  for (let a = 0; a < labs.length; a++) for (let b = a + 1; b < labs.length; b++) { const d = de(labs[a], labs[b]); if (d < minDE) { minDE = d; pair = [used[a], used[b]]; } }
  return { W, H, grid, out, used, outlineN, pop, minDE: labs.length > 1 ? minDE : 100, pair };
}
// A name per colour, all different: the colours in order of how near their best match is, each taking the nearest
// name in C.names (CIEDE2000) not already taken.
function nameAll(hexes, C) {
  const N = C.names.map(([n, h]) => [n, PAL.lab(h)]), labs = hexes.map((h) => PAL.lab(h)), out = hexes.map(() => ""), taken = new Set();
  const ranked = labs.map((L, k) => ({ k, d: N.map(([n, l]) => [de(L, l), n]).sort((a, b) => a[0] - b[0]) })).sort((a, b) => a.d[0][0] - b.d[0][0] || a.k - b.k);
  for (const r of ranked) { const hit = r.d.find(([, n]) => !taken.has(n)); out[r.k] = hit ? hit[1] : "colour " + (r.k + 1); taken.add(out[r.k]); }
  return out;
}
// A plan drawn at px pixels a cell (studs on seams, the ring as ground), as RGB.
function render(P, px, camp) {
  const W = P.w * px, H = P.h * px, rgb = new Uint8Array(W * H * 3), cg = rgbOf(camp || "#6e6150");
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    const m = E.matOf(P.grid[y][x]), c = m ? rgbOf(P.pal[m].c) : cg, s = m ? c.map((v) => v * 0.66) : c;
    for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) { const edge = m && px >= 4 && (i === 0 || j === 0), o = ((y * px + j) * W + x * px + i) * 3; const v = edge ? s : c; rgb[o] = v[0]; rgb[o + 1] = v[1]; rgb[o + 2] = v[2]; }
  }
  return { w: W, h: H, rgb };
}
const load = (file) => decode(fs.readFileSync(path.isAbsolute(file) ? file : path.join(ROOT, file)));
const config = () => JSON.parse(fs.readFileSync(path.join(__dirname, "gallery-config.json"), "utf8"));
const manifest = () => JSON.parse(fs.readFileSync(path.join(ROOT, "levels/gallery-manifest.json"), "utf8"));
const planOf = (pic, C) => Object.assign(plan(load(pic.file), pic, C.convert), { title: pic.title, src: pic.id, kind: pic.kind });

module.exports = { plan, planOf, decode, encode, render, nameAll, load, config, manifest, hexOfLab };

if (require.main === module) {
  const arg = (k) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : null; };
  const C = config(), M = manifest();
  if (arg("sheet")) {
    const pics = M.pictures.filter((p) => process.argv.includes("--all") || p.keep !== false), px = +(arg("px") || 4), plans = pics.map((p) => { try { return planOf(p, C); } catch (e) { console.log(p.id + ": " + e.message); return null; } });
    const cols = 8, cw = Math.max(...plans.filter(Boolean).map((P) => P.w)) * px + 8, chh = Math.max(...plans.filter(Boolean).map((P) => P.h)) * px + 8, rows = Math.ceil(plans.length / cols);
    const W = cols * cw, H = rows * chh, rgb = new Uint8Array(W * H * 3).fill(40);
    plans.forEach((P, k) => { if (!P) return; const R = render(P, px), x0 = (k % cols) * cw + 4, y0 = ((k / cols) | 0) * chh + 4;
      for (let y = 0; y < R.h; y++) rgb.set(R.rgb.subarray(y * R.w * 3, (y + 1) * R.w * 3), ((y0 + y) * W + x0) * 3);
      console.log(String(k + 1).padStart(2) + " " + pics[k].id.padEnd(22) + " " + (P.w + "x" + P.h).padEnd(6) + " colours " + P.stats.colours + " minDE " + P.stats.minDE + " cells " + P.stats.cells + " outline " + P.stats.outline); });
    fs.writeFileSync(arg("sheet"), encode(W, H, rgb));
  } else {
    const id = process.argv[2], pic = M.pictures.find((p) => p.id === id); if (!pic) { console.log("no picture " + id); process.exitCode = 1; }
    else { const P = planOf(pic, C); console.log(JSON.stringify(P)); if (arg("png")) { const R = render(P, +(arg("px") || 8)); fs.writeFileSync(arg("png"), encode(R.w, R.h, R.rgb)); } }
  }
}
