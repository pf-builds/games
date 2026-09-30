// Sapper's Path v4 Critics 1 fix: how far a faded queue tile stays from the other colours it shows with. The rows behind
// the front mix layout.fade.t[d] of the tray colour (layout.fade.tray) into their material's colour in sRGB, exactly as
// main.js does (fades()). For every level (levels.json and the debug levels), every pair of different materials dealt
// in its queue: CIEDE2000 between material A faded to row d (1, 2) and material B at the front, both ways. Reports the
// critic's three pairs (M2: Ashlar vs Rubble stone, Thatch vs Gilt, Brick vs Hedge, each way), the smallest pair over
// all, the faded tiles against the tray, and the mystery card's back against every material. Nothing is written.
//   ~/.local/opt/node/bin/node tools/fade.js [--t 0,0.1,0.2] [--tray #ddd3c0]   (a candidate instead of config.json)
"use strict";
const { lab, de00 } = require("./palette.js");
const C = require("../config.json"), V3 = C.v3, F = C.layout.fade;
const arg = (k) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : null; };
const T = arg("t") ? arg("t").split(",").map(Number) : F.t, TRAY = arg("tray") || F.tray;
const LV = require("../levels/levels.json").levels.concat(require("../levels/debug-v4.json").levels);
const P = V3.mats.map((m) => (m ? m.c : null)), NAME = (m) => V3.mats[m].n;
// The page's mix (main.js mixHex): per channel, rounded.
const mix = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), ch = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t); return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1); };
const faded = (m, d) => mix(P[m], TRAY, T[d]);

const pairs = new Map(); // "a-b" (a faded, b front) -> levels
for (const L of LV) { const s = new Set(); for (const c of L.cols) for (const k of c) s.add(k[0]); for (const a of s) for (const b of s) if (a !== b) pairs.set(a + "-" + b, (pairs.get(a + "-" + b) || 0) + 1); }
let min = { e: 1e9 }; const all = [];
for (const [k, n] of pairs) { const [a, b] = k.split("-").map(Number); for (let d = 1; d < T.length; d++) { const e = de00(lab(faded(a, d)), lab(P[b])); all.push({ a, b, d, e, n }); if (e < min.e) min = { a, b, d, e, n }; } }
const f1 = (x) => x.toFixed(1);
console.log("fade t = [" + T.join(", ") + "] toward " + TRAY + "; " + pairs.size + " ordered pairs of queue materials over " + LV.length + " levels");
console.log("\nThe critic's pairs (faded tile -> front tile of the other colour), ΔE00 at row 1 / row 2 (critic's before, opacity over the wall):");
const named = [[6, 5, "8.9 (.38) / 10.3 (.66)"], [3, 14, "10.5 (.66)"], [9, 11, "10.2 (.66)"]];
for (const [a, b, before] of named) for (const [x, y] of [[a, b], [b, a]]) {
  const e1 = de00(lab(faded(x, 1)), lab(P[y])), e2 = de00(lab(faded(x, 2)), lab(P[y]));
  console.log("  " + NAME(x) + " faded vs " + NAME(y) + ": " + f1(e1) + " / " + f1(e2) + (x === a ? "   (before " + before + ")" : "") + "   levels " + (pairs.get(x + "-" + y) || 0));
}
console.log("\nSmallest over every pair: " + NAME(min.a) + " at row " + min.d + " vs " + NAME(min.b) + " " + f1(min.e) + " (" + min.n + " levels)");
console.log("Pairs under 20: " + all.filter((x) => x.e < 20).length + " of " + all.length);
const lows = all.slice().sort((p, q) => p.e - q.e).slice(0, 6).map((x) => NAME(x.a) + "@" + x.d + " vs " + NAME(x.b) + " " + f1(x.e));
console.log("  lowest: " + lows.join("; "));
const tray = lab(TRAY); let vis = { e: 1e9 };
for (let m = 1; m < P.length; m++) { if (m === 10) continue; const e = de00(lab(faded(m, T.length - 1)), tray); if (e < vis.e) vis = { m, e }; }
console.log("\nFaded tile (row " + (T.length - 1) + ") against the tray: smallest " + NAME(vis.m) + " " + f1(vis.e) + " (every tile keeps a rim of its own colour toward ink)");
const Y = C.layout.mystery.c; let my = { e: 1e9 };
for (let m = 1; m < P.length; m++) { if (m === 10) continue; for (let d = 1; d < T.length; d++) { const e = de00(lab(mix(Y, TRAY, T[d])), lab(P[m])); if (e < my.e) my = { m, d, e }; } }
console.log("Mystery back (" + Y + ", faded) against every material: smallest " + NAME(my.m) + " " + f1(my.e) + " (plus its gold lattice, rim and '?')");
