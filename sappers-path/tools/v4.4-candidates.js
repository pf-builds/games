// Sapper's Path v4.4a: the picture candidates for Gallery 61-100, converted at the v4.2 full size with the current converter
// (tools/convert.js, gallery-config convert; no toolbox yet). For every manifest picture marked candidate "v4.4a" (the new
// pictures of our own and the 28 stored M4 spares): its board (tools/shots-v4.4/boards/<id>.png, 6 px a cell, the game's
// stud look) and its read measures, into tools/shots-v4.4/stats.json:
//   board w x h, colours, minDE, subject share (the subject's cells over the picture's), blob (the biggest one-colour
//   region over the subject: a high share reads as one blob), parts (one-colour regions of 6 cells or more inside the
//   subject: the detail that survives), outline cells, and the converter's warnings.
// The readability score and note (tools/shots-v4.4/candidates.json) are a person's judgement on the boards, as M4's were;
// tools/v4.4-sheet.py lays them out.
//   ~/.local/opt/node/bin/node tools/v4.4-candidates.js
"use strict";
const fs = require("fs"), path = require("path");
const V = require("./convert.js"), E = require("../src/engine.js");
const OUT = path.join(__dirname, "shots-v4.4"), BOARDS = path.join(OUT, "boards");
fs.mkdirSync(BOARDS, { recursive: true });
const C = V.config(), M = V.manifest(), out = [];
for (const pic of M.pictures.filter((p) => p.candidate === "v4.4a")) {
  let P; try { P = V.planOf(pic, C); } catch (e) { out.push({ id: pic.id, title: pic.title, kind: pic.kind, error: e.message }); continue; }
  const w = P.w, h = P.h, cell = (x, y) => E.matOf(P.grid[y][x]), ink = +Object.keys(P.pal).find((k) => P.pal[k].c === C.convert.ink) || 0;
  // The subject: every material cell that is not the background colour (the colour of the picture's corners inside the ring).
  const bg = cell(1, 1), subj = (x, y) => { const m = cell(x, y); return m > 0 && m !== bg; };
  let cells = 0, sub = 0; const seen = new Uint8Array(w * h), regions = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { cells++; if (subj(x, y)) sub++; }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (seen[y * w + x] || !subj(x, y)) continue;
    const m = cell(x, y), st = [y * w + x]; seen[y * w + x] = 1; let n = 0;
    for (let g = 0; st.length && g < w * h; g++) { const c = st.pop(), cx = c % w, cy = (c / w) | 0; n++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy, k = ny * w + nx; if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1 || seen[k] || cell(nx, ny) !== m) continue; seen[k] = 1; st.push(k); } }
    regions.push({ m, n });
  }
  const body = regions.filter((r) => r.m !== ink), big = body.reduce((a, r) => Math.max(a, r.n), 0), bodyCells = body.reduce((a, r) => a + r.n, 0);
  const R = V.render(P, 6); fs.writeFileSync(path.join(BOARDS, pic.id + ".png"), V.encode(R.w, R.h, R.rgb));
  out.push({ id: pic.id, title: pic.title, kind: pic.kind, board: w + "x" + h, colours: P.stats.colours, minDE: P.stats.minDE, subject: +(sub / cells).toFixed(2),
    blob: bodyCells ? +(big / bodyCells).toFixed(2) : 1, parts: body.filter((r) => r.n >= 6).length, outline: P.stats.outline || 0, was: pic.why || null });
}
fs.writeFileSync(path.join(OUT, "stats.json"), JSON.stringify(out, null, 1) + "\n");
for (const s of out) console.log([s.id.padEnd(16), (s.title || "").padEnd(26), s.kind.padEnd(8), s.board, "col " + s.colours, "subj " + s.subject, "blob " + s.blob, "parts " + s.parts, s.error || ""].join("  "));
