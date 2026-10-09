// Sapper's Path freeze test (v5 R1; the rules review's freeze rule: once a level ships it never changes, so after any
// engine change a re-grade of every shipped level must show 0 differences, or the change doesn't ship). A frozen
// snapshot is a folder holding frozen.json ({files: [{file, kind: "siege" | "gallery"}]}) and copies of the shipped
// level files, grades and stored orders included. Every level of every file is graded again with the current engine
// and the bake's own seeds and counts (tools/regrade.js regrade(): rate, the stored winning line, lookahead, real pace,
// thinking replays, fast tapper, whichever the file stores) and compared field for field. Exit 1 on any difference.
//   ~/.local/opt/node/bin/node tools/freeze.js                 the snapshot named by config.json v5.freeze.dir
//   ~/.local/opt/node/bin/node tools/freeze.js --dir DIR        another snapshot (the test runs tools/freeze-fixture)
//   ~/.local/opt/node/bin/node tools/freeze.js --require        a missing snapshot is a failure (from R2 on)
//   ~/.local/opt/node/bin/node tools/freeze.js --snapshot       copy tools/build-data/levels/levels.json, tools/build-data/levels/gallery.json (v6: and tools/build-data/levels/zen.json) into the
//                                                               configured folder (R2 baselines with this, once)
//   ~/.local/opt/node/bin/node tools/freeze.js --make-fixture   rebuild tools/freeze-fixture from its source.json (three
//                                                               small hand boards graded with this engine)
// R1 has no baseline yet: the shipped levels were dealt under v4.3's rules and are re-laid in R2, which snapshots them.
// v5 R4, the castle freeze: new realms extend tools/castle.js, and eras 1-4 must paint exactly what they painted before
// (a rebake or a new candidate of an old realm would otherwise drift). castles.json in the snapshot folder holds a SHA-1
// per case (CASES: every era 1-4 generator at its sample colours over 40 seeds, fewer colours, each scene forced, the boss
// and the teaching sizes) of castle()'s whole output; the default run checks it too.
//   ~/.local/opt/node/bin/node tools/freeze.js --castles-snapshot   write castles.json (once, before castle.js changes)
"use strict";
const fs = require("fs"), path = require("path");
const E = require("../src/engine.js"), R = require("./grade.js"), { regrade } = require("./regrade.js");
const CFG = require("../config.json"), BC = require("./bake-config.json"), GC = require("./gallery-config.json").bake;
const ROOT = path.join(__dirname, "..");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

// Re-grade every file of the snapshot in dir. Returns {ok, missing, files: [{file, levels, checks, diffs, lines}]}.
// v3 (optional): the engine rules to grade with (default config.json's; the test passes a changed one).
function check(dir, v3) {
  const man = path.join(dir, "frozen.json");
  if (!fs.existsSync(man)) return { ok: false, missing: true, files: [] };
  const M = JSON.parse(fs.readFileSync(man, "utf8")), files = [];
  for (const f of M.files || []) {
    const LV = JSON.parse(fs.readFileSync(path.join(dir, f.file), "utf8")).levels, r = regrade(LV, f.kind === "gallery" ? GC : BC, v3 || CFG.v3, false);
    files.push({ file: f.file, levels: LV.length, checks: r.checks, diffs: r.diffs, lines: r.lines });
  }
  return { ok: files.every((f) => !f.diffs) && files.length > 0, missing: false, files };
}
// v5 R4: the castle cases (era, seed, P) and their hashes; checkCastles(dir) -> {ok, missing, cases, diffs, lines}.
function castleCases() {
  const out = [], P0 = (e, o) => Object.assign({}, BC.eras[e].gen, { colours: BC.picture.eras[e].sample || 8 }, o || {});
  const T42 = { w: [36, 36], h: [35, 35], k: 1.8 };
  for (let e = 1; e <= 4; e++) {
    for (let k = 0; k < 40; k++) out.push([e, 1000 * e + k, P0(e)]);
    for (let k = 0; k < 10; k++) out.push([e, 1000 * e + 50 + k, P0(e, { colours: (BC.picture.eras[e].sample || 8) - 2 })]);
    for (const sc of Object.keys(BC.picture.eras[e].scenes || {})) for (let k = 0; k < 3; k++) out.push([e, 1000 * e + 70 + k, P0(e, { scene: sc })]);
    if (e >= 2) for (let k = 0; k < 4; k++) out.push([e, 1000 * e + 80 + k, P0(e, Object.assign({}, T42, { scene: "day", colours: 8 }))]);
  }
  for (let k = 0; k < 10; k++) out.push([4, 4090 + k, P0(4, Object.assign({}, BC.boss.gen, { colours: 12 }))]);
  for (let k = 0; k < 4; k++) out.push([3, 3095 + k, P0(3, { moat: false, towers: [1, 1] })]);
  for (let k = 0; k < 6; k++) out.push([1, 1095 + k, P0(1, { w: [15, 16], h: [16, 17], watch: [1, 2], fg: [3, 3] })]);
  return out;
}
function castleHashes() {
  const K = require("./castle.js"), crypto = require("crypto");
  return castleCases().map(([e, seed, P]) => { let L = null; try { L = K.castle(e, seed, P, BC.picture); } catch (err) { L = { error: err.message }; } return crypto.createHash("sha1").update(JSON.stringify(L)).digest("hex").slice(0, 16); });
}
function checkCastles(dir) {
  const f = path.join(dir, "castles.json"); if (!fs.existsSync(f)) return { ok: false, missing: true, cases: 0, diffs: 0, lines: [] };
  const want = JSON.parse(fs.readFileSync(f, "utf8")).hashes, now = castleHashes(), cs = castleCases(), lines = [];
  for (let i = 0; i < Math.max(want.length, now.length); i++) if (want[i] !== now[i]) lines.push("DIFF castle case " + i + " (era " + (cs[i] || [])[0] + ", seed " + (cs[i] || [])[1] + "): stored " + want[i] + ", now " + now[i]);
  return { ok: !lines.length, missing: false, cases: now.length, diffs: lines.length, lines };
}
// v7 lane T: the page's own data against the snapshot. Every frozen record must come out of the shipped packed file
// (levels/*.pk.json, src/pack.js unpack) byte for byte as the snapshot holds it, less the bake-only fields (pack DROP):
// the same grid, palette, deck, stored order and the rest. Returns {ok, levels, diffs, lines}.
function checkShipped(dir) {
  const P = require("../src/pack.js"), man = path.join(dir, "frozen.json"), lines = []; let levels = 0;
  if (!fs.existsSync(man)) return { ok: false, levels, diffs: 0, lines: ["no snapshot"] };
  for (const f of JSON.parse(fs.readFileSync(man, "utf8")).files || []) {
    const pf = path.join(ROOT, "levels", f.file.replace(/\.json$/, ".pk.json")); if (!fs.existsSync(pf)) { lines.push("DIFF " + f.file + ": no shipped levels/" + path.basename(pf)); continue; }
    const by = new Map(P.unpackFile(JSON.parse(fs.readFileSync(pf, "utf8"))).levels.map((L) => [L.id, L]));
    for (const L of JSON.parse(fs.readFileSync(path.join(dir, f.file), "utf8")).levels) { levels++; if (!P.same(by.get(L.id), P.strip(L))) lines.push("DIFF " + f.file + " " + L.id + ": the shipped record unpacks differently"); }
  }
  return { ok: !lines.length, levels, diffs: lines.length, lines };
}
module.exports = { check, checkCastles, castleHashes, checkShipped };

// The fixture: grade each hand board of source.json as the bake stores grades (on its tag; seed from the file).
function makeFixture(dir) {
  const src = JSON.parse(fs.readFileSync(path.join(dir, "source.json"), "utf8")), out = [];
  for (const L of src.levels) {
    const B = E.compile(L), rt = E.rulesOf(CFG.v3, L.tag), d = L.tag, order = R.solve(B, rt, 200000);
    if (!order) throw new Error("fixture " + L.id + ": no winning order");
    const ln = R.line(B, rt, order), pc = R.pace(B, rt, order, 0);
    const g = { rate: +R.rate(B, rt, BC.grade.playouts, L.seed).toFixed(4), peak: ln.peak, len: ln.len, ms: ln.ms, maxWait: ln.maxWait, greedy: +R.greedy(B, rt, BC.grade.greedyPlayouts, L.seed ^ 0x2545f491).toFixed(3),
      pace: pc.won ? { raw: pc.ms, ms: Math.round(pc.ms * BC.duration.pace.factor) } : { raw: null, ms: ln.ms, fell: true } };
    out.push(Object.assign({}, L, { win: { [d]: order }, grade: { [d]: g } }));
  }
  fs.writeFileSync(path.join(dir, "levels.json"), JSON.stringify({ note: "Built by tools/freeze.js --make-fixture from source.json; graded with the v5 R1 engine.", levels: out }, null, 1) + "\n");
  fs.writeFileSync(path.join(dir, "frozen.json"), JSON.stringify({ note: "The freeze test's fixture snapshot (tools/freeze.js).", files: [{ file: "levels.json", kind: "siege" }] }, null, 1) + "\n");
  return out.length;
}

if (require.main === module) {
  const V5 = CFG.v5.freeze, dir = path.resolve(ROOT, arg("--dir") || V5.dir);
  if (process.argv.includes("--make-fixture")) { const fx = path.join(__dirname, "freeze-fixture"); console.log("fixture: " + makeFixture(fx) + " levels graded into " + path.relative(ROOT, fx)); process.exit(0); }
  if (process.argv.includes("--castles-snapshot")) { const h = castleHashes(); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "castles.json"), JSON.stringify({ note: "v5 R4: castle() hashes for eras 1-4 (tools/freeze.js castleCases); never edit by hand.", made: new Date().toISOString().slice(0, 10), hashes: h }, null, 0) + "\n"); console.log("castles: " + h.length + " case hashes written to " + path.relative(ROOT, dir)); process.exit(0); }
  if (process.argv.includes("--snapshot")) {
    fs.mkdirSync(dir, { recursive: true });
    // v6 (the merge): Zen World 1's own records (tools/build-data/levels/zen.json, graded with the main levels' counts) are frozen too.
    const zen = fs.existsSync(path.join(ROOT, "tools/build-data/levels/zen.json")), list = ["levels.json", "gallery.json"].concat(zen ? ["zen.json"] : []);
    for (const f of list) fs.copyFileSync(path.join(ROOT, "tools/build-data/levels", f), path.join(dir, f)); // v7 lane T: the source (grades and all); the page's packed files are checked against it below
    fs.writeFileSync(path.join(dir, "frozen.json"), JSON.stringify({ note: "Shipped levels frozen by tools/freeze.js --snapshot; never edit by hand.", made: new Date().toISOString().slice(0, 10), files: [{ file: "levels.json", kind: "siege" }, { file: "gallery.json", kind: "gallery" }].concat(zen ? [{ file: "zen.json", kind: "siege" }] : []) }, null, 1) + "\n");
    console.log("snapshot written to " + path.relative(ROOT, dir)); process.exit(0);
  }
  const t0 = Date.now(), r = check(dir);
  if (r.missing) { console.log("freeze: no snapshot at " + path.relative(ROOT, dir) + " (not baselined yet: R2 runs --snapshot once it ships the re-laid levels)"); process.exitCode = process.argv.includes("--require") ? 1 : 0; }
  else {
    for (const f of r.files) { for (const l of f.lines) console.log(f.file + ": " + l); console.log("freeze: " + f.file + " " + f.levels + " levels, " + f.checks + " checks, " + f.diffs + " differences"); }
    const pk = checkShipped(dir); for (const l of pk.lines) console.log(l); console.log("freeze: shipped (unpacked) " + pk.levels + " frozen records, " + pk.diffs + " differences"); // v7 lane T
    const kc = checkCastles(dir); for (const l of kc.lines) console.log(l); // v5 R4: the castle freeze
    console.log(kc.missing ? "freeze: no castle hashes (castles.json) in the snapshot" : "freeze: castles (eras 1-4) " + kc.cases + " cases, " + kc.diffs + " differences");
    const ok = r.ok && pk.ok && (kc.ok || (kc.missing && !process.argv.includes("--require")));
    console.log("freeze: " + (ok ? "PASS" : "FAIL") + " (" + ((Date.now() - t0) / 1000).toFixed(1) + " s)"); process.exitCode = ok ? 0 : 1;
  }
}
