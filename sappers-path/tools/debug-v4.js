// Sapper's Path v4 M2 debug levels: one level per twist (mystery cards, linked squads, a locked space) plus one with all
// three, built from copies of baked levels, each solved patiently on Easy, Normal and Hard and verified. Writes
// levels/debug-v4.json (only this file; levels.json and teaching.json are never touched). The page loads it under
// ?debug=1 only (the map's "v4 twists" row, SP.load(id)); it never enters the save's progress.
//   ~/.local/opt/node/bin/node tools/debug-v4.js [--check]   (--check: rebuild in memory and diff against the file)
// Deterministic: the same seeds give the same file. Each level must win on all three difficulties within the 55-tap
// cap (bake-config maxTaps), its stored orders must hold no refused tap, and E.check must find nothing to warn about.
"use strict";
const fs = require("fs"), path = require("path");
const E = require("../src/engine.js"), R = require("./grade.js"), C = require("./bake-config.json");
const V3 = require("../config.json").v3, LV = require("../levels/levels.json").levels;
const OUT = path.resolve(__dirname, "../levels/debug-v4.json"), DIFFS = ["easy", "normal", "hard"], NODES = 400000, GAP = V3.twists.linkRowGap, ROWS = require("../config.json").layout.queueRows;
const rules = { easy: E.rulesOf(V3, "easy"), normal: E.rulesOf(V3, "normal"), hard: E.rulesOf(V3, "hard") };
const copy = (o) => JSON.parse(JSON.stringify(o));
const byN = (n) => LV.find((l) => l.n === n);

// Mystery: every card behind a column's front.
function mystery(L) { L.cols.forEach((col) => col.forEach((cd, i) => { if (i > 0) cd[2] = E.MYSTERY; })); return L; }
// k links, picked one at a time: every pair of unlinked cards in neighbouring columns, rows at most v3.twists.linkRowGap
// (2) apart (E.check's rule), with at least one of the two behind its column's front (so the pull shows), tried on Normal; keep the pair
// the one-move-lookahead player wins most with (a debug level should teach the twist, not wall the player), ties to
// the first in column order. Only pairs that still win on all three difficulties count. stub: the first pair starts
// with its partner below the page's visible rows (layout.queueRows) and its other card in view, so the rod stub shows.
function links(L, k, stub) {
  for (let t = 0; t < k; t++) {
    const used = new Set(); for (const P of L.links || []) for (const q of P) used.add(q.join(","));
    let best = null, bg = -1;
    for (let j = 0; j < 4; j++) for (let i = 0; i < L.cols[j].length; i++) for (let r = Math.max(0, i - GAP); r <= i + GAP && r < L.cols[j + 1].length; r++) {
      if ((i === 0 && r === 0) || used.has(j + "," + i) || used.has(j + 1 + "," + r)) continue;
      if (stub && t === 0 && !(Math.max(i, r) >= ROWS && Math.min(i, r) >= 1 && Math.min(i, r) < ROWS)) continue;
      const T = Object.assign(copy(L), { links: (L.links || []).concat([[[j, i], [j + 1, r]]]) }), B = E.compile(T);
      if (!DIFFS.every((d) => R.solve(B, rules[d], 20000))) continue;
      const g = R.greedy(B, rules.normal, 60, 11);
      if (g > bg) { bg = g; best = T.links; }
    }
    if (!best) throw new Error("links: no pair keeps the level winnable");
    L.links = best;
  }
  return L;
}
// The locked space: turn one fort pixel into a gilt key (a pixel one layer in from the fort's reachable edge, never a
// gate, tower or key), take one sapper off a card of its old colour, and deal a Looters card of 1 at the end of the
// shortest column. pick: which of the candidate cells (sorted by camp distance, nearest first).
function lock(L, pick) {
  const B = E.compile(L), S = E.sim(B, rules.normal), w = B.w, cand = [];
  for (let c = 0; c < B.n; c++) {
    const m = B.a0[c]; if (!(m > 0) || m === E.IRON || m === E.GILT || B.towerOf[c] >= 0 || B.keyOf[c] >= 0 || S.target(m) === c) continue;
    let reach = false, next = false;
    for (let k = 0; k < 4; k++) { const e = B.nb[c * 4 + k]; if (e < 0) continue; if (S.d[e] >= 0) reach = true; if (B.a0[e] > 0 && B.a0[e] !== E.IRON) for (let q = 0; q < 4; q++) { const f = B.nb[e * 4 + q]; if (f >= 0 && S.d[f] >= 0) next = true; } }
    if (!reach && next) cand.push(c);
  }
  cand.sort((p, q) => Math.abs(((p / w) | 0) - B.campRow) - Math.abs(((q / w) | 0) - B.campRow) || p - q);
  const c = cand[Math.min(pick, cand.length - 1)], x = c % w, y = (c / w) | 0, m = B.a0[c];
  L.grid[y] = L.grid[y].slice(0, x) + "n" + L.grid[y].slice(x + 1);
  let fixed = false;
  for (let j = 4; j >= 0 && !fixed; j--) for (let i = L.cols[j].length - 1; i >= 0 && !fixed; i--) if (L.cols[j][i][0] === m && L.cols[j][i][1] > 1) { L.cols[j][i][1]--; fixed = true; }
  if (!fixed) throw new Error("lock: no card of colour " + m + " to take a sapper from");
  let s = 0; for (let j = 1; j < 5; j++) if (L.cols[j].length < L.cols[s].length) s = j;
  L.cols[s].push([E.GILT, 1]); L.lock = { key: [x, y] };
  return L;
}

// Build, solve on all three difficulties, verify. from: the baked level copied; make(L): the twists.
function build(id, name, hint, from, make) {
  const src = byN(from), L = make(Object.assign(copy({ w: src.w, h: src.h, grid: src.grid, gates: src.gates, towers: src.towers, cols: src.cols }), { id, name, hint, from: src.id }));
  const B = E.compile(L), warn = E.check(L, { linkRowGap: GAP });
  if (warn.length) throw new Error(id + ": " + warn.join("; "));
  let sum = 0; for (let m = 1; m < E.NMAT; m++) sum += B.sapTotal[m];
  if (sum !== B.pixTotal - B.pix[E.IRON]) throw new Error(id + ": sappers don't sum to the fort's eatable pixels");
  L.win = {};
  for (const d of DIFFS) {
    const o = R.solve(B, rules[d], NODES, d === "easy" ? null : L.win.easy);
    if (!o) throw new Error(id + " " + d + ": no winning order found (" + o + ")");
    // Verify: patient replay wins, never meets a refused tap, and keeps to the tap cap.
    const S = E.sim(B, rules[d]); let refused = 0;
    for (const ch of o) { if (S.play(+ch) === E.REFUSED) refused++; S.quiet(); }
    if (S.status !== E.WON || refused || o.length > C.maxTaps) throw new Error(id + " " + d + ": the stored order doesn't verify (" + S.reason + ", refused " + refused + ", " + o.length + " taps)");
    L.win[d] = o;
  }
  return L;
}

function all() {
  return [
    build("v4-mystery", "Mystery squads", "? squads hide their colour until they reach the front.", 40, (L) => mystery(L)),
    build("v4-linked", "Linked squads", "Linked squads go out together: they need 2 free spaces.", 20, (L) => links(L, 3, true)),
    build("v4-locked", "The locked space", "The last space is locked: pop its key (white corners).", 29, (L) => lock(L, 2)),
    build("v4-all", "All three twists", "Mystery, linked squads and a locked space, all at once.", 38, (L) => links(lock(mystery(L), 3), 2)),
  ];
}

const levels = all(), text = JSON.stringify({ version: 1, note: "Sapper's Path v4 M2 debug levels (tools/debug-v4.js): one per twist and one with all three, copied from baked levels. Loaded only under ?debug=1; never in the save's progress.", levels }, null, 0).replace(/\{"id"/g, "\n{\"id\"") + "\n";
if (process.argv.includes("--check")) {
  const same = fs.existsSync(OUT) && fs.readFileSync(OUT, "utf8") === text;
  console.log(same ? "debug-v4.json matches a fresh build" : "debug-v4.json differs from a fresh build"); process.exitCode = same ? 0 : 1;
} else { fs.writeFileSync(OUT, text); console.log("wrote " + path.relative(process.cwd(), OUT)); }
for (const L of levels) console.log(L.id.padEnd(11) + " from " + L.from + ", " + L.cols.reduce((a, c) => a + c.length, 0) + " cards, links " + (L.links || []).length + (L.lock ? ", lock key " + JSON.stringify(L.lock.key) : "") + "; taps E/N/H " + DIFFS.map((d) => L.win[d].length).join("/"));
