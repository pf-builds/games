// ASCII view of one level with its `art` overlay: grid on the left; on the right the same grid with tower rects as #,
// gate rects as the side letter (n e s w), the keep as K, and decor as b(ush) w(ell) c(art) f(lowers) r (barrel) p(ath).
// Run: node tools/artview.js w2-05 [levels/levels.json]
"use strict";
const fs = require("fs"), path = require("path");
const DECO = { bush: "b", well: "w", cart: "c", flowers: "f", barrel: "r", path: "p" };
function view(L) {
  const g = L.grid.map((r) => r.split("")), a = L.art || { towers: [], gates: [], decor: [] };
  for (const [x, y, w, h] of a.towers) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) g[yy][xx] = "#";
  for (const [x, y, w, h, s] of a.gates) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) g[yy][xx] = s;
  for (const [x, y, k] of a.decor) g[y][x] = DECO[k] || "?";
  return L.grid.map((row, y) => row + "    " + g[y].join("")).join("\n");
}
if (require.main === module) {
  const id = process.argv[2], file = process.argv[3] || path.join(__dirname, "..", "levels", "levels.json");
  const D = JSON.parse(fs.readFileSync(file, "utf8")), L = (D.worlds ? D.worlds.flatMap((w) => w.levels) : D.levels).find((l) => l.id === id);
  console.log(L ? L.id + " " + L.name + "\n" + view(L) : "no level " + id);
}
module.exports = { view };
