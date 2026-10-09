// Sapper's Path v7 lane T (tools/space-v7-notes.md §7): the shipped folder by part (the game minus tools/ and dot files,
// as tools/test.js counts it), and what one more Zen world costs with reused map sheets (lever 1), before and after.
//   ~/.local/opt/node/bin/node tools/space-v7/budget.js OLD_GAME_DIR [NEW_GAME_DIR]   (OLD: a11e9bf's sappers-path/, e.g. from git archive)
"use strict";
const fs = require("fs"), path = require("path");
const [OLD, NEW = path.join(__dirname, "..", "..")] = process.argv.slice(2);
const PARTS = [["map: castle sheets (25)", /^map\/sheet-/], ["map: land sheets (6)", /^map\/land-/], ["map: layout.json", /^map\/layout\.json$/], ["audio", /^audio\//],
  ["levels: Campaign (levels.json)", /^levels\/levels(\.pk)?\.json$/], ["levels: Zen index (zen.json / zen.pk.json)", /^levels\/zen(\.pk)?\.json$/], ["levels: Zen world files", /^levels\/zen-\d+\.pk\.json$/],
  ["levels: Gallery (gallery.json)", /^levels\/gallery(\.pk)?\.json$/], ["levels: places, tutorial, debug row, Gallery manifest", /^levels\//], ["art", /^art\//], ["code (src/)", /^src\//], ["fonts", /^fonts\//],
  ["docs (LICENSES, SPEC, LATER)", /\.md$/], ["page (index.html, css, config.json, thumb)", /./]];
function parts(dir) {
  const by = Object.fromEntries(PARTS.map(([k]) => [k, 0])), walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name[0] === "." || (d === dir && e.name === "tools")) continue;
    const p = path.join(d, e.name); if (e.isDirectory()) { walk(p); continue; } const rel = path.relative(dir, p), k = PARTS.find(([, re]) => re.test(rel))[0]; by[k] += fs.statSync(p).size; } };
  walk(dir); by.total = Object.values(by).reduce((a, b) => a + b, 0); return by;
}
// One more Zen world of 50 levels on reused sheets, measured on Dino Valley (World 4): its records, its world entry with
// World 1's kind of map (map.sheets: reused sheets; 7 of them), its LICENSES.md section.
function worldCost(dir, after) {
  const lic = fs.readFileSync(path.join(dir, "LICENSES.md"), "utf8"), a = lic.indexOf("### Zen World 4: Dino Valley"), b = lic.indexOf("\n### ", a + 5), licB = Buffer.byteLength(lic.slice(a, b < 0 ? lic.length : b));
  if (!after) { const Z = JSON.parse(fs.readFileSync(path.join(dir, "levels/zen.json"), "utf8")), recs = Z.levels.filter((L) => L.world === 4), w1 = Z.worlds.find((w) => w.k === 1);
    const data = recs.reduce((s, L) => s + Buffer.byteLength(JSON.stringify(L)) + 1, 0), entry = Buffer.byteLength(JSON.stringify(Object.assign({}, Z.worlds.find((w) => w.k === 4), { map: w1.map })));
    return { data, entry, licences: licB, total: data + entry + licB, perLevel: Math.round(data / recs.length) }; }
  const I = JSON.parse(fs.readFileSync(path.join(dir, "levels/zen.pk.json"), "utf8")), w4 = I.worlds.find((w) => w.k === 4), w1 = I.worlds.find((w) => w.k === 1), file = fs.statSync(path.join(dir, "levels", w4.recs.file)).size;
  const entry = Buffer.byteLength(JSON.stringify(Object.assign({}, w4, { map: w1.map }))) + 1;
  return { data: file, entry, licences: licB, total: file + entry + licB, perLevel: Math.round(file / w4.recs.ids.length) };
}
const before = parts(OLD), after = parts(NEW), cb = worldCost(OLD, false), ca = worldCost(NEW, true), MB = (n) => (n / 1e6).toFixed(2), KB = (n) => (n / 1024).toFixed(1);
console.log("| Part | a11e9bf (v6.3) | v7 lane T | Change |\n|---|---:|---:|---:|");
for (const [k] of PARTS.concat([["total"]])) if (before[k] || after[k]) console.log("| " + (k === "total" ? "**Total (minus tools/)**" : k) + " | " + MB(before[k]) + " MB | " + MB(after[k]) + " MB | " + (after[k] - before[k] > 0 ? "+" : "") + MB(after[k] - before[k]) + " MB |");
console.log("\n| One more Zen world (50 levels, reused sheets) | a11e9bf | v7 lane T |\n|---|---:|---:|");
for (const k of ["data", "entry", "licences", "total"]) console.log("| " + { data: "level data", entry: "its zen.json world entry (7 reused sheets)", licences: "its LICENSES.md section", total: "**total**" }[k] + " | " + KB(cb[k]) + " KB | " + KB(ca[k]) + " KB |");
console.log("| per level | " + cb.perLevel + " B | " + ca.perLevel + " B |");
const fit = (cap, total, c) => Math.floor((cap - total) / c);
console.log("\nWorlds that still fit: 19 MB gate " + fit(19e6, before.total, cb.total) + " before, " + fit(19e6, after.total, ca.total) + " after; 20 MB " + fit(20e6, before.total, cb.total) + " before, " + fit(20e6, after.total, ca.total) + " after");
fs.writeFileSync(path.join(__dirname, "budget.json"), JSON.stringify({ before, after, worldBefore: cb, worldAfter: ca }, null, 1) + "\n");
