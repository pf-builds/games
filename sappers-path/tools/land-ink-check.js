// Sapper's Path v6 lane D4: the ink-outline rule (Peter, 2026-10-06: one solid black line round the whole shape, or none;
// never broken bits of black) on a land's outlined level records, as they ship. For every record of kind "outlined" in
// levels/levels.json (or --file, e.g. a land's scratch/out/levels.json), with the ink and ground ids its converted board
// carries (scratch/boards.json, land.js boardOf, by id since D3):
//   ids       the record's palette holds the board's ink and ground at the same ids and colours
//   solid     the ink has no shades (no pal sh, a 0 shade digit on every ink cell)
//   one black no other colour or shade sits within inkDE (CIEDE2000) of the ink (no second black)
//   closed    no subject cell (not ink, ground or open) touches the ground or the open frame side-on: the line shuts it in
//   hidden    no mystery block on an ink or ground cell
// and reports, as lane C's run-ink.js counts it, the ink in the line (8-connected to the ink touching the ground) and the
// other ink (the solid dark areas and eyes kept on purpose).
//   ~/.local/opt/node/bin/node tools/land-ink-check.js LAND_DIR [--file LEVELS.json] [--inkDE 10]
"use strict";
const fs = require("fs");
const path = require("path");
const E = require("../src/engine.js");
const PAL = require("./palette.js");

const argv = process.argv.slice(2), opt = (k) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : null; };
const readJ = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

function inkCheck(L, B, inkDE) {
  const w = L.w, h = L.h, ink = B.ink, bg = B.bg, mat = (x, y) => E.matOf(L.grid[y][x]), bad = [];
  if (!ink || !bg) return { bad: ["no ink or ground id on the board"] };
  if (!L.pal[ink] || L.pal[ink].c !== B.pal[ink].c || !L.pal[bg] || L.pal[bg].c !== B.pal[bg].c) bad.push("ids: ink " + ink + " / ground " + bg + " not the board's");
  if ((L.pal[ink].sh || []).some(Boolean)) bad.push("solid: the ink has shades " + JSON.stringify(L.pal[ink].sh));
  let inkN = 0, shaded = 0, open = 0, hid = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const m = mat(x, y);
    if (m === ink) { inkN++; if (L.shade && L.shade[y][x] !== "0") shaded++; }
    if (L.hidden && L.hidden[y][x] === "?" && (m === ink || m === bg)) hid++;
    if (m && m !== ink && m !== bg) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const v = mat(X, Y); if (v === bg || v === 0) { open++; break; } } }
  if (shaded) bad.push("solid: " + shaded + " ink cells shaded");
  if (hid) bad.push("hidden: " + hid + " mystery blocks on ink or ground");
  if (open) bad.push("closed: " + open + " subject cells touch the ground or the frame");
  const a = PAL.lab(L.pal[ink].c); let near = Infinity;
  for (const k of Object.keys(L.pal)) for (const c of (+k === ink ? [] : [L.pal[k].c]).concat(L.pal[k].sh || [])) if (c) near = Math.min(near, PAL.de00(a, PAL.lab(c)));
  if (near < inkDE) bad.push("one black: a colour " + near.toFixed(1) + " from the ink");
  // lane C's count: the line (ink touching the ground, and the ink 8-connected to it) and the other ink
  const seen = new Uint8Array(w * h), q = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mat(x, y) === ink && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < w && Y < h && mat(X, Y) === bg; })) { seen[y * w + x] = 1; q.push(y * w + x); }
  for (let k = 0; k < q.length && k < w * h; k++) { const i = q[k], x = i % w, y = (i / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy, j = Y * w + X; if (X >= 0 && Y >= 0 && X < w && Y < h && !seen[j] && mat(X, Y) === ink) { seen[j] = 1; q.push(j); } } }
  return { bad, ink: inkN, line: q.length, other: inkN - q.length, near: +near.toFixed(1), inkC: L.pal[ink].c, bgC: L.pal[bg].c };
}

if (require.main === module) {
  const LAND = path.resolve(argv[0] || ""), land = readJ(path.join(LAND, "land.json")), BD = readJ(path.join(LAND, "scratch/boards.json")), inkDE = +(opt("inkDE") || 10);
  const file = opt("file") ? path.resolve(opt("file")) : path.join(__dirname, "../levels/levels.json"), raw = readJ(file), LV = (Array.isArray(raw) ? raw : raw.levels).filter((L) => L.land === land.k);
  const rows = [], fails = [];
  for (const L of LV) { if (L.kind !== "outlined") continue; const e = BD.main.find((m) => m.n === L.n && m.id === L.src); if (!e) { fails.push(L.id + ": no board"); continue; }
    const r = inkCheck(L, e.board, inkDE); rows.push([L.n, L.src, r]); if (r.bad.length) fails.push(L.id + ": " + r.bad.join("; ")); }
  for (const [n, id, r] of rows) console.log(String(n).padEnd(4), id.padEnd(6), (r.bad.length ? "FAIL " + r.bad.join("; ") : "ok") + "  ink " + r.ink + " (line " + r.line + ", other " + r.other + "), nearest colour " + r.near + ", ink " + r.inkC + ", ground " + r.bgC);
  console.log("ink-outline rule: " + (rows.length - fails.length) + " of " + rows.length + " outlined records pass" + (fails.length ? "; FAIL " + fails.join(" | ") : ""));
  process.exitCode = fails.length ? 1 : 0;
}
module.exports = { inkCheck };
