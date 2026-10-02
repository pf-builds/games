// Sapper's Path v4.1 fix: how alike two castle pictures are (the visual critic's V1 measure, made exact). A picture (the
// frame left out) is sampled at a cols x rows grid of cell centres; each sample is the cell's role as the player sees
// it: its palette name (a role and its scene, e.g. "sky" or "night sky"), "water", "ground", "gilt" or "iron". The match
// of two pictures is the share of samples whose roles are equal. Within an era the bake keeps the median match of every
// pair at bake-config variety.maxMedian or under, and prefers each level's candidate least like the era's earlier picks.
//   mapOf(L, V)        -> the sampled roles (an array of cols * rows strings)
//   match(a, b)        -> the share of equal samples (two maps)
//   eraReport(levels, V) -> per era {n, median, p10, worst: {a, b, m}} over its generated levels (teaching left out)
//   ~/.local/opt/node/bin/node tools/variety.js [--levels FILE] [--layout]   a report (--layout: roles without their scene,
//   the layout alone)
"use strict";
const E = require("../src/engine.js");

function mapOf(L, V, layoutOnly) {
  const cols = V.cols, rows = V.rows, pw = L.w - 2, ph = L.h - 2, out = new Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = 1 + Math.floor(((i + 0.5) * pw) / cols), y = 1 + Math.floor(((j + 0.5) * ph) / rows), ch = L.grid[y][x], m = E.matOf(ch);
    let r = ch === "~" ? "water" : ch === "," || ch === "#" ? "ground" : m === E.GILT ? "gilt" : m === E.IRON ? "iron" : L.pal && L.pal[m] ? L.pal[m].n : "m" + m;
    if (layoutOnly && L.pal && L.pal[m] && L.pal[m].r) r = L.pal[m].r; // the role without its scene
    out[j * cols + i] = r;
  }
  return out;
}
function match(a, b) { let k = 0; for (let i = 0; i < a.length; i++) if (a[i] === b[i]) k++; return k / a.length; }
const med = (a) => { const q = a.slice().sort((x, y) => x - y); return q.length ? q[(q.length - 1) >> 1] : null; };
function eraReport(levels, V, layoutOnly) {
  const out = {};
  for (const e of [1, 2, 3, 4]) {
    const ls = levels.filter((l) => l.era === e && !l.exempt && l.source !== "teaching"), maps = ls.map((l) => mapOf(l, V, layoutOnly)), ms = []; let worst = null;
    for (let a = 0; a < ls.length; a++) for (let b = a + 1; b < ls.length; b++) { const m = match(maps[a], maps[b]); ms.push(m); if (!worst || m > worst.m) worst = { a: ls[a].n, b: ls[b].n, m: +m.toFixed(3) }; }
    if (!ms.length) continue;
    ms.sort((x, y) => x - y);
    out[e] = { n: ls.length, median: +med(ms).toFixed(3), p10: +(ms[Math.floor(ms.length * 0.1)] || 0).toFixed(3), worst };
  }
  return out;
}
module.exports = { mapOf, match, eraReport };

if (require.main === module) {
  const fs = require("fs"), path = require("path"), i = process.argv.indexOf("--levels");
  const L = JSON.parse(fs.readFileSync(i > 0 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, "../levels/levels.json"), "utf8")).levels;
  const V = (require("./bake-config.json").variety) || { cols: 10, rows: 14 };
  const R = eraReport(L, V, process.argv.includes("--layout"));
  for (const e of Object.keys(R)) console.log("era " + e + ": " + R[e].n + " levels, median match " + R[e].median + ", 10th percentile " + R[e].p10 + ", most alike " + R[e].worst.a + " and " + R[e].worst.b + " " + R[e].worst.m);
}
