// Sapper's Path lands foundation: shading within a colour, the converter step (SPEC-v4 §9, the lands foundation entry;
// the test that set every number: game-research/sappers-path-v4/pd-art-test/shading/README.md). After the converter has
// picked a picture's squad colours (unchanged: squads and cards stay as tellable as ever), each picture cell gets a shade
// digit from the source's lightness there, and each colour up to two shade colours that stay clear of every other squad.
// A shaded block is still a block of its squad: it clears with it, and cards, the line and the bins keep the base colour.
// Numbers: tools/gallery-config.json convert.shade (SC). Steps:
//   1. Lightness per cell: the area-weighted mean L* (CIELAB) of the cell's source pixels whose nearest palette colour
//      (chroma-boosted as the converter votes) is the cell's own; all its (subject) pixels when none is.
//   2. Shade digit: the residual against the median L* of that colour's cells; >= t lighter (+1), <= -t darker (-1);
//      with levels 2, past t2 a second step (+-2). The ink (outline black) and a masked picture's background are never
//      shaded.
//   3. Smoothing: `median` passes of a 3x3 median over same-colour neighbours (other colours never vote), then every
//      4-connected run of one colour and one shade under minRegion cells goes back to the base.
//   4. Shade colours: the base moved step L* lighter or darker (stepMax; +-2: x step2), chroma x (1 - chroma) lighter and
//      x (1 + chroma) darker. The constraint: each shade stands floor CIEDE2000 or more from every other colour's base
//      and shades, margin more from those than from its own base, fadedFloor from every other colour's card as the
//      queue fades it in the rows behind the front (config layout.fade), and groundFloor from the frame's ground (or no
//      nearer than its own base is). A shade that fails steps in 1 L* at a time to stepMin, then is dropped (its cells
//      draw the base; a dropped +-2 falls back to its +-1 when that stands).
// Output (the level fields): pal[id].sh = [lighter, darker, lighter2, darker2] (hex, null where none; no sh when a colour
// has none) and shade, a row of digits per grid row (0 base, 1 lighter, 2 darker, 3 lighter2, 4 darker2; the frame 0).
//   shadeOf(src0, P, opt, C) -> {pal, shade, stats} | null   (src0: the source image; P: convert.plan(src0, opt, C) of the
//   same picture; C: gallery-config convert; null when C.shade is missing or nothing is shaded)
"use strict";
const V = require("./convert.js"), PAL = require("./palette.js"), E = require("../src/engine.js");
const FADE = require("../config.json").layout.fade;
const de = (p, q) => PAL.de00(p, q), d76 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mixHex = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), ch = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t); return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1); };
const DIG = { 0: 0, 1: 1, "-1": 2, 2: 3, "-2": 4 };

// A shade colour: the base moved st L* (sgn: +-1, +-2) with its chroma scaled.
function shadeHex(base, sgn, st, SC) { const L = PAL.lab(base).slice(), k = sgn > 0 ? 1 - SC.chroma * Math.abs(sgn) : 1 + SC.chroma * Math.abs(sgn); L[0] = Math.max(2, Math.min(98, L[0] + Math.sign(sgn) * st)); L[1] *= k; L[2] *= k; return V.hexOfLab(L); }
// Every distance a shade colour h of colour id must keep (SC floors) against the palette, the other live shades and the
// ground; worst < 0 fails. near: its least distance to another colour's base or shade.
function measure(h, id, P, ids, live, SC, ground) {
  const L = PAL.lab(h), own = de(L, PAL.lab(P.pal[id].c)); let worst = Infinity, near = Infinity, faded = Infinity, gmin = Infinity;
  const other = (q) => { const d = de(L, q); near = Math.min(near, d); worst = Math.min(worst, d - SC.floor, d - own - SC.margin); };
  for (const j of ids) if (j !== id) other(PAL.lab(P.pal[j].c));
  for (const z of live) if (z.id !== id) other(PAL.lab(z.h));
  for (const G of ground) { const dg = de(L, G), db = de(PAL.lab(P.pal[id].c), G); gmin = Math.min(gmin, dg); worst = Math.min(worst, dg - Math.min(SC.groundFloor, db)); }
  for (const j of ids) if (j !== id) for (let k = 1; k < FADE.t.length; k++) { const d = de(L, PAL.lab(mixHex(P.pal[j].c, FADE.tray, FADE.t[k]))); faded = Math.min(faded, d); worst = Math.min(worst, d - SC.fadedFloor); }
  return { worst, near, faded, ground: gmin, own };
}
function shadeOf(src0, P, opt, C) {
  const SC = C.shade; if (!SC) return null;
  const F = V.fit(src0, opt, C), { src, mask, scale, pw, ph, mg, bx0, by0, K } = F, ch = K.chroma || 1;
  if (pw !== P.w - 2 || ph !== P.h - 2) throw new Error("shade: the plan's board is not this picture's fit");
  const ids = Object.keys(P.pal).map(Number), plab = {}; for (const id of ids) plab[id] = PAL.lab(P.pal[id].c);
  const skip = new Set(ids.filter((id) => (P.ids ? id === P.ids.ink || id === P.ids.bg : P.pal[id].c === C.ink || (P.stats && P.stats.bg && P.pal[id].c === P.stats.bg)))); // the ink and the background (v6 lane D3: by the plan's ids, a lifted one too)
  const idAt = (x, y) => E.matOf(P.grid[y + 1][x + 1]), ground = SC.ground.map((g) => PAL.lab(g));
  // 1. Each cell's lightness.
  const ox = bx0 - mg / scale, oy = by0 - mg / scale, Lc = new Float64Array(pw * ph), memo = new Map();
  const px = (X, Y) => { const i = (Y * src.w + X) * 4, k = (src.rgba[i] << 16) | (src.rgba[i + 1] << 8) | src.rgba[i + 2]; let v = memo.get(k);
    if (!v) { const L = PAL.lab(hex(src.rgba[i], src.rgba[i + 1], src.rgba[i + 2])), Lb = [L[0], L[1] * ch, L[2] * ch]; let bi = 0, bd = Infinity; for (const id of ids) { const q = d76(Lb, plab[id]); if (q < bd) { bd = q; bi = id; } } v = [L[0], bi]; memo.set(k, v); } return v; };
  for (let cy = 0; cy < ph; cy++) for (let cx = 0; cx < pw; cx++) {
    const id = idAt(cx, cy), X0 = ox + cx / scale, X1 = ox + (cx + 1) / scale, Y0 = oy + cy / scale, Y1 = oy + (cy + 1) / scale; let s = 0, n = 0, sa = 0, na = 0;
    for (let y = Math.max(0, Math.floor(Y0)); y < Math.min(src.h, Math.ceil(Y1)); y++) for (let x = Math.max(0, Math.floor(X0)); x < Math.min(src.w, Math.ceil(X1)); x++) {
      if (!mask[y * src.w + x]) continue; const f = (Math.min(x + 1, X1) - Math.max(x, X0)) * (Math.min(y + 1, Y1) - Math.max(y, Y0)); if (f <= 0) continue;
      const [L, bi] = px(x, y); sa += L * f; na += f; if (bi === id) { s += L * f; n += f; } }
    Lc[cy * pw + cx] = n > 0 ? s / n : na > 0 ? sa / na : NaN;
  }
  // 2. The residual against the colour's median, as a digit.
  const med = {}; for (const id of ids) { const v = []; for (let i = 0; i < pw * ph; i++) if (idAt(i % pw, (i / pw) | 0) === id && !isNaN(Lc[i])) v.push(Lc[i]); v.sort((p, q) => p - q); med[id] = v.length ? v[v.length >> 1] : 50; }
  let s = new Int8Array(pw * ph);
  for (let i = 0; i < pw * ph; i++) { const id = idAt(i % pw, (i / pw) | 0); if (skip.has(id) || !(id > 0) || isNaN(Lc[i])) continue; const r = Lc[i] - med[id], m = Math.abs(r); s[i] = m < SC.t ? 0 : Math.sign(r) * (SC.levels > 1 && m >= SC.t2 ? 2 : 1); }
  // 3. Smoothing.
  for (let pass = 0; pass < SC.median; pass++) { const n2 = new Int8Array(pw * ph), v = [];
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const id = idAt(x, y); v.length = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < pw && Y < ph && idAt(X, Y) === id) v.push(s[Y * pw + X]); }
      v.sort((p, q) => p - q); n2[y * pw + x] = v[v.length >> 1]; }
    s = n2; }
  { const seen = new Uint8Array(pw * ph), q = new Int32Array(pw * ph);
    for (let i0 = 0; i0 < pw * ph; i0++) { if (seen[i0] || !s[i0]) continue; const id = idAt(i0 % pw, (i0 / pw) | 0), sv = s[i0]; let h = 0, t = 0; q[t++] = i0; seen[i0] = 1;
      while (h < t) { const i = q[h++], x = i % pw, y = (i / pw) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy, j = Y * pw + X; if (X >= 0 && Y >= 0 && X < pw && Y < ph && !seen[j] && s[j] === sv && idAt(X, Y) === id) { seen[j] = 1; q[t++] = j; } } }
      if (t < SC.minRegion) for (let k = 0; k < t; k++) s[q[k]] = 0; } }
  // 4. Shade colours under the constraint (bounded: every shade steps in at most stepMax times).
  const used = new Map(); for (let i = 0; i < pw * ph; i++) if (s[i]) { const k = idAt(i % pw, (i / pw) | 0) + ":" + s[i]; used.set(k, (used.get(k) || 0) + 1); }
  const sh = [...used.keys()].map((k) => { const [id, sg] = k.split(":").map(Number); return { id, sg, st: Math.abs(sg) > 1 ? SC.stepMax * SC.step2 : SC.stepMax, on: true, h: null }; });
  const paint = (z) => { z.h = shadeHex(P.pal[z.id].c, z.sg, z.st, SC); return z; }; sh.forEach(paint);
  const worstOf = (z) => { let w = measure(z.h, z.id, P, ids, sh.filter((q) => q.on), SC, ground).worst; const sib = sh.find((q) => q.on && q.id === z.id && q.sg === Math.sign(z.sg)); if (sib && Math.abs(z.sg) > 1) w = Math.min(w, z.st - sib.st - SC.stepMin); return w; };
  for (let guard = 0, cap = sh.length * (SC.stepMax * (SC.step2 || 1) + 1) + 1; guard < cap; guard++) {
    let bad = null, bw = 0; for (const z of sh) if (z.on) { const w = worstOf(z); if (w < bw) { bw = w; bad = z; } } if (!bad) break;
    bad.st -= 1; if (bad.st < (Math.abs(bad.sg) > 1 ? SC.stepMin * 2 : SC.stepMin)) bad.on = false; else paint(bad);
  }
  for (let i = 0; i < pw * ph; i++) if (s[i]) { const id = idAt(i % pw, (i / pw) | 0), z = sh.find((w) => w.id === id && w.sg === s[i]); if (!z.on) { const z1 = sh.find((w) => w.on && w.id === id && w.sg === Math.sign(s[i])); s[i] = Math.abs(s[i]) > 1 && z1 ? Math.sign(s[i]) : 0; } }
  const live = sh.filter((z) => z.on); if (!live.length) return null;
  const pal = JSON.parse(JSON.stringify(P.pal)); for (const id of ids) { const a4 = [1, -1, 2, -2].map((sg) => { const z = live.find((w) => w.id === id && w.sg === sg); return z ? z.h : null; }); if (a4.some(Boolean)) pal[id].sh = a4; }
  const shade = []; for (let y = 0; y < P.h; y++) { let row = ""; for (let x = 0; x < P.w; x++) row += x === 0 || y === 0 || x === P.w - 1 || y === P.h - 1 ? "0" : DIG[s[(y - 1) * pw + x - 1]]; shade.push(row); }
  let minOther = Infinity, minFaded = Infinity, minGround = Infinity, shaded = 0, ownMin = Infinity, ownMax = 0;
  for (const z of live) { const m = measure(z.h, z.id, P, ids, live, SC, ground); minOther = Math.min(minOther, m.near); minFaded = Math.min(minFaded, m.faded); minGround = Math.min(minGround, m.ground); ownMin = Math.min(ownMin, m.own); ownMax = Math.max(ownMax, m.own); }
  for (let i = 0; i < pw * ph; i++) if (s[i]) shaded++;
  const r1 = (v) => +v.toFixed(1);
  return { pal, shade, stats: { shades: live.length, shadedPct: r1((100 * shaded) / (pw * ph)), minOther: r1(minOther), minFaded: r1(minFaded), minGround: r1(minGround), own: [r1(ownMin), r1(ownMax)], dropped: sh.filter((z) => !z.on).map((z) => P.pal[z.id].n + (z.sg > 0 ? " +" : " -")) } };
}
// The constraint checked again on a finished level (tools/test.js, tools/land.js): every shade colour of L.pal against
// the floors, as {ok, minOther, minFaded, bad: [what failed]}.
function checkLevel(L, C) {
  const SC = C.shade, ids = Object.keys(L.pal).map(Number), live = [], ground = SC.ground.map((g) => PAL.lab(g)), bad = [];
  for (const id of ids) (L.pal[id].sh || []).forEach((h, k) => { if (h) live.push({ id, h, k }); });
  let minOther = Infinity, minFaded = Infinity;
  for (const z of live) { const m = measure(z.h, z.id, L, ids, live, SC, ground); minOther = Math.min(minOther, m.near); minFaded = Math.min(minFaded, m.faded);
    if (m.near < SC.floor - 0.05) bad.push(L.pal[z.id].n + " shade " + z.k + " is " + m.near.toFixed(1) + " from another colour"); if (m.faded < SC.fadedFloor - 0.05) bad.push(L.pal[z.id].n + " shade " + z.k + " is " + m.faded.toFixed(1) + " from a faded card"); }
  if (L.shade) { if (L.shade.length !== L.h || L.shade.some((r) => r.length !== L.w || /[^0-4]/.test(r))) bad.push("shade rows are not h strings of w digits");
    else for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) { const d = +L.shade[y][x]; if (!d) continue; const m = E.matOf(L.grid[y][x]); if (!(m > 0) || !(L.pal[m] && L.pal[m].sh && L.pal[m].sh[d - 1])) { bad.push("cell " + x + "," + y + " has shade " + d + " its colour lacks"); y = L.h; break; } } }
  return { ok: !bad.length, minOther: live.length ? +minOther.toFixed(1) : null, minFaded: live.length ? +minFaded.toFixed(1) : null, shades: live.length, bad };
}
module.exports = { shadeOf, checkLevel, shadeHex };
