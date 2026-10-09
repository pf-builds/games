// Sapper's Path v7 lane T (tools/space-v7-notes.md): write the shipped level files from their source. The source of
// truth is tools/build-data/levels/{levels,gallery,zen}.json (plain JSON: every bake tool reads and writes it); the page
// reads only the packed files this writes into levels/ (src/pack.js), byte for byte the same on every run.
//   ~/.local/opt/node/bin/node tools/pack.js           write levels/*.pk.json (levels, gallery, the Zen index zen.pk.json, a
//                                                      zen-<k>.pk.json per world)
//   ~/.local/opt/node/bin/node tools/pack.js --check   write nothing; exit 1 if a shipped file differs from what it would write
// Run it after anything writes a source file (land.js install / zen / reinstall, zen-world.js install, quest-bake.js
// install, gallery-bake.js, bake.js, campaign-v6.js install); tools/test.js fails while the shipped files are stale.
"use strict";
const fs = require("fs"), path = require("path"), P = require("../src/pack.js");
const ROOT = path.join(__dirname, ".."), SRC = path.join(__dirname, "build-data/levels");
const readJ = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const source = () => ({ levels: readJ(path.join(SRC, "levels.json")), gallery: readJ(path.join(SRC, "gallery.json")), zen: readJ(path.join(SRC, "zen.json")) });
// A plain file's records packed; the bake's own notes and settings (bake, note) stay in the source.
const file = (J, extra) => Object.assign({ pack: P.FORMAT, version: J.version }, extra || {}, { levels: J.levels.map(P.pack) });
// Stage 3 (Zen on demand): each Zen world's records go in levels/zen-<k>.pk.json, loaded when the world is played; the
// index levels/zen.pk.json holds the worlds as the source has them plus each one's recs (src/pack.js recsOf: ids,
// numbers, tags and the rest of what the home, map and saves read before the file loads). A land world's records
// (levels.json, land k) leave levels.pk.json for its world file; its side quests stay in gallery.pk.json (the map draws
// a won one). The page builds the same level list it did from the plain files: the Campaign's records, then each land
// world's in world order (checked here), then the worlds' own.
const worldFile = (k) => "zen-" + k + ".pk.json";
function worldsOf(S) {
  const W = S.zen.worlds || [], lands = new Set(W.filter((w) => w.land).map((w) => w.land)), lv = S.levels.levels, bad = [];
  const first = lv.findIndex((L) => lands.has(L.land)), tail = first < 0 ? [] : lv.slice(first);
  if (tail.some((L) => !lands.has(L.land))) bad.push("levels.json: a land world's records must come after every other record");
  if (tail.map((L) => L.land).join() !== W.filter((w) => w.land).flatMap((w) => tail.filter((L) => L.land === w.land).map((L) => L.land)).join()) bad.push("levels.json: land worlds' records out of world order");
  const out = W.map((w) => { if ("recs" in w) bad.push("zen.json world " + w.k + ": `recs` is the index's own key"); const list = w.land ? lv.filter((L) => L.land === w.land) : S.zen.levels.filter((L) => L.world === w.k);
    if (!list.length) bad.push("zen.json world " + w.k + ": no records"); if (list.some((L) => "stub" in L)) bad.push("world " + w.k + ": a record has a `stub` key"); return { w, list }; });
  const placed = new Set(out.flatMap((o) => o.list.map((L) => L.id))), orphans = S.zen.levels.filter((L) => !placed.has(L.id)).map((L) => L.id);
  if (orphans.length) bad.push("zen.json: records in no world: " + orphans.slice(0, 5).join(", ") + (orphans.length > 5 ? " ..." : ""));
  if (bad.length) throw new Error("pack: " + bad.join("; "));
  return { out, lands };
}
// {name in levels/: its text} for the source S (default: the files on disk).
function build(S) {
  S = S || source(); const out = {}, put = (f, o) => { out[f] = JSON.stringify(o) + "\n"; }, Z = worldsOf(S);
  put("levels.pk.json", file(Object.assign({}, S.levels, { levels: S.levels.levels.filter((L) => !Z.lands.has(L.land)) })));
  put("gallery.pk.json", file(S.gallery));
  put("zen.pk.json", { pack: P.FORMAT, version: S.zen.version, worlds: Z.out.map(({ w, list }) => Object.assign({}, P.packWorld(w), { recs: P.recsOf(worldFile(w.k), list) })) });
  for (const { w, list } of Z.out) put(worldFile(w.k), { pack: P.FORMAT, world: w.k, levels: list.map(P.pack) });
  return out;
}
// The page's own data: every record in the shipped files (levels/*.pk.json) unpacked, by id; and the Zen index.
function shipped(root) {
  const L = path.join(root || ROOT, "levels"), rd = (f) => readJ(path.join(L, f)), byId = new Map(), files = ["levels.pk.json", "gallery.pk.json"], index = rd("zen.pk.json");
  for (const w of index.worlds || []) files.push(w.recs.file);
  for (const f of files) for (const R of P.unpackFile(rd(f)).levels) byId.set(R.id, R);
  return { byId, index, files: files.concat("zen.pk.json") };
}
module.exports = { build, source, shipped, worldFile, SRC };

if (require.main === module) {
  const B = build(), check = process.argv.includes("--check"), bad = []; let wrote = 0;
  const stray = fs.readdirSync(path.join(ROOT, "levels")).filter((f) => /^zen-\d+\.pk\.json$/.test(f) && !B[f]); // a world file the index no longer names
  for (const f of stray) { if (check) bad.push(f + " (stray)"); else { fs.unlinkSync(path.join(ROOT, "levels", f)); console.log("pack: removed levels/" + f); wrote++; } }
  for (const [f, t] of Object.entries(B)) { const p = path.join(ROOT, "levels", f), was = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
    if (was === t) continue; if (check) { bad.push(f); continue; } fs.writeFileSync(p + ".tmp", t); fs.renameSync(p + ".tmp", p); wrote++; console.log("pack: wrote levels/" + f + " (" + Buffer.byteLength(t).toLocaleString("en-US") + " B)"); }
  if (check) { console.log(bad.length ? "pack: stale (run tools/pack.js): " + bad.join(", ") : "pack: shipped files match the source"); process.exitCode = bad.length ? 1 : 0; }
  else if (!wrote) console.log("pack: " + Object.keys(B).length + " files up to date");
}
