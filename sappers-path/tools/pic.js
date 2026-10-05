// Sapper's Path v4.1 picture boards (SPEC-v4 §9, the v4.1 entry): the parts the Siege's castle pictures (tools/castle.js)
// and the Gallery's converter (tools/convert.js) share. Every number comes from the caller's config (bake-config
// `picture`, gallery-config `convert`).
//   frame(cell, pw, ph, P)      the picture (pw x ph cells, each a grid letter) inside its frame: a 1-cell ring of open
//                               ground (dirt), water where the picture's own edge column is water (a moat running off the
//                               board), and the entry square: the camp, P.entryHalf either side of the bottom ring row's
//                               middle (one run of cells; 3 on an odd width, 2 on an even one at 1). -> {w, h, grid, pic}
//   outline(role, subj, pw, ph, isBg, ink)  every background cell 8-adjacent to a subject cell turns `ink` (one ring), in
//                               place; returns how many turned
//   choose(want, fixed, P, seed) a colour for each role from its candidates (P.roles[role].c), so that the smallest pair over
//                               the picture's colours (the fixed ones, e.g. gilt keys, included) is as big as it can be:
//                               CIEDE2000 against P.minDE and, with one of the two faded to a queue row behind the front
//                               (config layout.fade), against P.fadeDE (the worse of the two shortfalls decides). Seeded
//                               coordinate descent from several starts; deterministic. -> {c: {role: hex}, minDE, minFade}
//   fadeGap(a, b)               that faded measure for two colours (the least over the queue's rows behind the front)
//   render(L, px, P)            a level (grid + pal) drawn as studs at px pixels a cell (RGB; tools/castle.js --sheet)
// No randomness but the seeds passed in; never throws on a well-formed call.
"use strict";
const E = require("../src/engine.js");
const PAL = require("./palette.js");
const FADE = require("../config.json").layout.fade;
const { rng } = require("./grade.js");

const lab = (() => { const memo = new Map(); return (h) => { let v = memo.get(h); if (!v) { v = PAL.lab(h); memo.set(h, v); } return v; }; })();
const de = (a, b) => PAL.de00(lab(a), lab(b));
const mixHex = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), ch = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t); return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1); };
function fadeGap(a, b) { let m = Infinity; for (let d = 1; d < FADE.t.length; d++) m = Math.min(m, de(mixHex(a, FADE.tray, FADE.t[d]), b), de(mixHex(b, FADE.tray, FADE.t[d]), a)); return m; }

// The frame. cell(x, y) -> a grid letter for picture cell (x, y): a material letter, "," open ground or "~" water.
function frame(cell, pw, ph, P) {
  const w = pw + 2, h = ph + 2, mid = (w - 1) / 2, half = P.entryHalf == null ? 1 : P.entryHalf, grid = [];
  for (let y = 0; y < h; y++) {
    let s = "";
    for (let x = 0; x < w; x++) {
      if (y === h - 1) s += Math.abs(x - mid) <= half ? "#" : ",";
      else if (y === 0) s += ",";
      else if (x === 0 || x === w - 1) s += cell(x === 0 ? 0 : pw - 1, y - 1) === "~" ? "~" : ",";
      else s += cell(x - 1, y - 1);
    }
    grid.push(s);
  }
  return { w, h, grid, pic: true };
}

// One ring of outline: role[] and subj[] are pw*ph arrays (subj 1 = a subject cell); isBg(role) says which roles the
// outline may take. 8-adjacency, so no 4-connected path crosses it.
function outline(role, subj, pw, ph, isBg, ink) {
  const add = [];
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const i = y * pw + x; if (subj[i] || !isBg(role[i])) continue;
    let touch = false;
    for (let dy = -1; dy <= 1 && !touch; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < pw && Y < ph && subj[Y * pw + X]) { touch = true; break; } }
    if (touch) add.push(i);
  }
  for (const i of add) { role[i] = ink; subj[i] = 2; }
  return add.length;
}

// The palette: want = the roles in the picture, fixed = {name: hex} colours that stand with them (gilt keys). A pair's
// score is the smaller of (ΔE00 - minDE) and (faded - fadeDE); the palette's score is its worst pair. Coordinate descent:
// for the worst pair, each of its two roles tries every candidate; the best move is taken while it improves.
function choose(want, fixed, P, seed) {
  const R = P.roles, roles = want.filter((k) => R[k] && R[k].c && R[k].c.length), fx = Object.values(fixed || {});
  const score = (pal) => { let worst = Infinity, pair = null, md = Infinity, mf = Infinity; const all = roles.map((k) => pal[k]).concat(fx);
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) { const d = de(all[a], all[b]), f = fadeGap(all[a], all[b]), s = Math.min(d - P.minDE, f - P.fadeDE);
      if (d < md) md = d; if (f < mf) mf = f; if (s < worst) { worst = s; pair = [a, b]; } }
    return { worst, pair, md, mf }; };
  const r = rng(seed ^ 0x51ab3d), starts = Math.max(1, P.starts || 4);
  let best = null;
  for (let st = 0; st < starts; st++) {
    const pal = {}; for (const k of roles) pal[k] = st === 0 ? R[k].c[0] : R[k].c[Math.floor(r() * R[k].c.length)];
    let cur = score(pal);
    for (let guard = 0; guard < 200 && cur.pair && cur.worst < 0; guard++) {
      let mv = null;
      for (const ix of cur.pair) { if (ix >= roles.length) continue; const k = roles[ix];
        for (const c of R[k].c) { if (c === pal[k]) continue; const o = pal[k]; pal[k] = c; const s = score(pal); pal[k] = o; if (s.worst > cur.worst + 1e-9 && (!mv || s.worst > mv.s.worst)) mv = { k, c, s }; } }
      if (!mv) break;
      pal[mv.k] = mv.c; cur = mv.s;
    }
    if (!best || cur.worst > best.cur.worst) best = { pal: Object.assign({}, pal), cur };
  }
  const names = roles.concat(Object.keys(fixed || {})), wp = best && best.cur.pair ? best.cur.pair.map((i) => names[i]) : null;
  return { c: best ? best.pal : {}, minDE: best && isFinite(best.cur.md) ? best.cur.md : 100, minFade: best && isFinite(best.cur.mf) ? best.cur.mf : 100, worst: wp };
}

// A level drawn as flat studs (a face and a darker seam) at px pixels a cell, RGB; open ground, the entry and water in
// the frame colours (P.show: {ground, camp, water, iron}). v5 R4: a mystery block in P.show.hidden, a lava moat in P.show.lava.
function render(L, px, P) {
  const S = P || {}, rgbOf = (hx) => { const v = parseInt(hx.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const W = L.w * px, H = L.h * px, rgb = new Uint8Array(W * H * 3), mats = require("../config.json").v3.mats;
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const ch = L.grid[y][x], m = E.matOf(ch), stud = m > 0 || ch === "~";
    const hx = m && L.hidden && L.hidden[y][x] === "?" && S.hidden ? S.hidden : m ? (L.pal && L.pal[m] ? L.pal[m].c : m === E.IRON ? S.iron || mats[m].c : mats[m].c) : ch === "~" ? (L.liquid && S[L.liquid]) || S.water || "#3f7fcf" : ch === "#" ? S.camp || "#7d6c55" : S.ground || "#5e5448";
    const c = rgbOf(hx), s = c.map((v) => v * 0.68);
    for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) { const edge = stud && px >= 4 && (i === 0 || j === 0), o = ((y * px + j) * W + x * px + i) * 3, v = edge ? s : c; rgb[o] = v[0]; rgb[o + 1] = v[1]; rgb[o + 2] = v[2]; }
    if (m === E.GILT && px >= 6) { const o = ((y * px + (px >> 1)) * W + x * px + (px >> 1)) * 3; rgb[o] = 40; rgb[o + 1] = 26; rgb[o + 2] = 8; }
  }
  return { w: W, h: H, rgb };
}

module.exports = { frame, outline, choose, fadeGap, de, lab, mixHex, render };
