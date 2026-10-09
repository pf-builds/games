// Sapper's Path v7 lane T (tools/space-v7-notes.md): write the shipped level files from their source. The source of
// truth is tools/build-data/levels/{levels,gallery,zen}.json (plain JSON: every bake tool reads and writes it); the page
// reads only the packed files this writes into levels/ (src/pack.js), byte for byte the same on every run.
//   ~/.local/opt/node/bin/node tools/pack.js           write levels/*.pk.json
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
// {name in levels/: its text} for the source S (default: the files on disk).
function build(S) {
  S = S || source(); const out = {}, put = (f, o) => { out[f] = JSON.stringify(o) + "\n"; };
  put("levels.pk.json", file(S.levels));
  put("gallery.pk.json", file(S.gallery));
  put("zen.pk.json", file(S.zen, { worlds: S.zen.worlds }));
  return out;
}
module.exports = { build, source, SRC };

if (require.main === module) {
  const B = build(), check = process.argv.includes("--check"), bad = []; let wrote = 0;
  for (const [f, t] of Object.entries(B)) { const p = path.join(ROOT, "levels", f), was = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
    if (was === t) continue; if (check) { bad.push(f); continue; } fs.writeFileSync(p + ".tmp", t); fs.renameSync(p + ".tmp", p); wrote++; console.log("pack: wrote levels/" + f + " (" + Buffer.byteLength(t).toLocaleString("en-US") + " B)"); }
  if (check) { console.log(bad.length ? "pack: stale (run tools/pack.js): " + bad.join(", ") : "pack: shipped files match the source"); process.exitCode = bad.length ? 1 : 0; }
  else if (!wrote) console.log("pack: " + Object.keys(B).length + " files up to date");
}
