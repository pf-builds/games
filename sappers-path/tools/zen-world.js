// Sapper's Path v6 lane B, Zen mode: a Zen world made from pictures the game already has (World 1, The Gallery: the 36
// castle Gallery pictures Peter moved out of the campaign on 2026-10-06; game-research/sappers-path-v4/v6-plan.md, Step 0).
// Notes: tools/zen-mode-notes.md. A world built from new pictures is a land (tools/land.js, tools/land-runbook.md) and joins
// Zen through tools/build-data/levels/zen.json worlds; this tool is for a world whose boards already exist.
//   ~/.local/opt/node/bin/node tools/zen-world.js WORLD_DIR [plan|bake|assemble|check|install ...] [--threads N] [--list N,N] [--extra K] [--force]
// WORLD_DIR/world.json: {k, slug, name, lore, era, features, profile (land-plan profile, merged over land-config's like a
// land's), from: {file: "tools/build-data/levels/gallery.json", ids: [...]} (the source records, never edited), pace (optional, the level
// pace range over the profile's), main (filled by plan: the source ids in level order)}. Scratch in WORLD_DIR/scratch/
// (gitignored).
// Steps:
//   plan      the tags (land-plan landTags) and the picture order: the busiest boards (colours, then cells) on the Hard
//             slots, the fewest colours on the Easy ones, each tag's slots filled in the source's own order (so the
//             source's mix of kinds stays spread) -> world.json main, scratch/state.json {tags, plan}
//   bake      every level (tools/land-bake.js bakeOne in worker threads, seeds from 1000 x k + i so no castle level's
//             seed repeats) on the source record's board (its grid and palette; the deck is dealt again)
//   assemble  the Zen records (ids z<k>-<i>, n i, era world.era, world k; title, kind, src, credit from the source) ->
//             scratch/out/levels.json
//   check     the land gates that apply to a world of main levels: count and ids, compiles and E.check clean, the stored
//             order wins on its tag with no power-up, 5 spaces, longest tap and taps under the caps, the steady replay
//             (every thinking replay wins, no wait between taps over the cap), real pace in range and the median, no
//             fallback picks, the profile (land-plan planCheck), no lock anywhere, the mystery fill, a re-grade with 0
//             differences -> scratch/report.md
//   install   (after a passing check) writes the world's levels into tools/build-data/levels/zen.json (its other worlds' records kept)
// v6 lane D8 (Peter, 2026-10-08: no mystery blocks in Zen, ever): a world whose features list hidden or whose profile gives
// hidden a share is refused; check fails a level with mystery blocks. A source picture no longer in from.file (World 1's 36
// left gallery.json at the v6 merge) is read from this world's own zen.json record (from: its id; the same board).
// v6 lane D15 (Peter, 2026-10-08: Picture Garden up to 50 with new garden scenes): --add, pictures appended to an installed
// world (world.json add: {first, raw, pictures (a land-style manifest), shade, profile (merged over the world's), tags (the
// added levels' tags, given), main (their picture ids in level order), sheets (map.sheets entries for them)}), scratch in
// scratch/add/. The world's installed records stay byte for byte; nothing else of it is re-dealt.
//   prep      --add: the sources (tools/land-src.py, A.raw -> WORLD_DIR/src/)
//   convert   --add: each board by tools/land.js boardOf (kind from the manifest, shaded when A.shade) -> scratch/add/boards.json;
//             --against DIR compares grid, palette and shade with DIR/<id>.json (lane C's hand-off)
//   plan, bake, assemble, check  --add: as below on the added levels (numbers A.first on, seeds 1000 x k + n); check adds the
//             careful floor, the shade floors, the whole world's profile (the installed tags then A.tags) and the new sheets'
//             48 px spacing at 375 px
//   install   --add: the records appended to the world's (any at A.first or past replaced), the sheets to its map.sheets
"use strict";
const fs = require("fs");
const path = require("path");
const E = require("../src/engine.js");
const R = require("./grade.js");
const LP = require("./land-plan.js");
const LB = require("./land-bake.js");
const { regrade } = require("./regrade.js");
const LJ = require("./land.js"), { fillGap, fillOf } = LJ;
const TG = require("./tags.js");
const JN = require("../src/journey.js");
const SH = require("./shade.js");

const ROOT = path.join(__dirname, "..");
const argv = process.argv.slice(2), flag = (k) => argv.indexOf("--" + k) >= 0, opt = (k) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : null; };
const readJ = (f) => JSON.parse(fs.readFileSync(f, "utf8")), writeJ = (f, o, pretty) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify(o, null, pretty ? 1 : 0) + "\n"); fs.renameSync(t, f); };
const med = (a) => { const q = a.slice().sort((x, y) => x - y); return q.length ? q[(q.length - 1) >> 1] : null; };
const INK = require("./convert.js").config().convert.ink;

function context(dir) {
  const W = path.resolve(dir), world = readJ(path.join(W, "world.json")), A = flag("add") ? world.add : null, S = path.join(W, "scratch", A ? "add" : ""), LC = require("./land-config.json"), CFG = readJ(path.join(ROOT, "config.json"));
  if (flag("add") && !A) throw new Error("--add: world.json has no add");
  const src = readJ(path.join(ROOT, world.from.file)).levels, byId = new Map(src.map((L) => [L.id, L])), P = LP.merge(LP.profileOf(world, LC), (A && A.profile) || {});
  for (const L of readJ(path.join(ROOT, "tools/build-data/levels/zen.json")).levels) if (L.world === world.k && L.from && !byId.has(L.from)) byId.set(L.from, Object.assign({}, L, { id: L.from })); // v6 lane D8
  const H = P.features.hidden || {}; if ((world.features || []).indexOf("hidden") >= 0 || H.share || Object.values(H.by || {}).some((v) => v)) throw new Error("Zen world " + world.k + ": no mystery blocks (feature hidden off, its profile share 0; Peter 2026-10-08)");
  if (world.pace) P.pace = Object.assign({}, P.pace, world.pace);
  for (const id of world.from.ids) if (!byId.has(id)) throw new Error("source picture " + id + " is not in " + world.from.file);
  const state = fs.existsSync(path.join(S, "state.json")) ? readJ(path.join(S, "state.json")) : {};
  const man = A ? readJ(path.join(W, A.pictures)) : null; if (A) for (const id of A.main) if (!man.some((p) => p.id === id)) throw new Error("--add: picture " + id + " is not in " + A.pictures);
  return { W, S, world, LC, CFG, P, byId, A, man, first: A ? A.first : 1, count: A ? A.main.length : world.from.ids.length, state };
}
// The source record's board as the land bake takes it: the grid and palette (frame included), the ink and a masked
// picture's background by their colours.
function boardOf(L) {
  const key = (c) => +(Object.keys(L.pal).find((k) => L.pal[k].c === c) || 0);
  return { w: L.w, h: L.h, grid: L.grid, pal: L.pal, ink: key(INK), bg: L.convert && L.convert.bg ? key(L.convert.bg) : 0 };
}

// --add: the sources and the boards (as tools/land.js prep and convert make a land's).
function prep(X) {
  const py = process.env.LAND_PYTHON || "python3", tmp = path.join(X.S, "tmp-manifest.json"); writeJ(tmp, X.man);
  console.log(require("child_process").execFileSync(py, [path.join(__dirname, "land-src.py"), X.A.raw, tmp, path.join(X.W, "src")].concat(X.A.main), { encoding: "utf8" }).trim());
}
function convert(X) {
  const t0 = Date.now(), out = {}, dir = opt("against"), diff = []; let same = 0;
  for (const id of X.A.main) { const p = X.man.find((q) => q.id === id), b = LJ.boardOf({ LC: X.LC }, p, path.join(X.W, "src"), !!X.A.shade); out[id] = b;
    if (dir) { const B = readJ(path.join(dir, id + ".json")); if (JSON.stringify(b.grid) === JSON.stringify(B.grid) && JSON.stringify(b.pal) === JSON.stringify(B.pal) && JSON.stringify(b.shade || null) === JSON.stringify(B.shade || null)) same++; else diff.push(id); } }
  writeJ(path.join(X.S, "boards.json"), out);
  console.log("convert: " + X.A.main.length + " boards in " + ((Date.now() - t0) / 1000).toFixed(1) + " s (" + Object.values(out).filter((b) => b.shade).length + " shaded)" + (dir ? "; " + same + " of " + X.A.main.length + " identical to " + dir + (diff.length ? ", differ: " + diff.join(", ") : "") : ""));
  if (diff.length) process.exitCode = 1;
}
const addBoards = (X) => readJ(path.join(X.S, "boards.json"));
const bandOf = (X, n, t) => (X.A && X.A.bands && X.A.bands[n]) || X.P.bands[t]; // --add: a level's own band (the finale's gentle Hard: the top of the Hard band)

function plan(X) {
  if (X.A) { const tags = X.A.tags; if (tags.length !== X.count) throw new Error("plan --add: " + tags.length + " tags for " + X.count + " pictures");
    const pl = LP.landPlan(tags, X.world, X.P, 1000 * X.world.k + X.first - 1, X.CFG.v5.density); writeJ(path.join(X.S, "state.json"), { tags, plan: pl }, true); X.state = { tags, plan: pl };
    console.log("plan --add: " + X.count + " levels from " + X.first + ", tags " + tags.map((t) => t[0]).join("") + "; features " + pl.map((p) => p.feats.length).join("")); return; }
  const tags = LP.landTags(X.count, X.P.tags, X.CFG.lands.perLand), ids = X.world.from.ids.slice(), L = (id) => X.byId.get(id);
  const busy = (id) => L(id).convert.colours * 1e4 + L(id).convert.cells, slots = (t) => tags.map((x, i) => (x === t ? i : -1)).filter((i) => i >= 0);
  const hard = slots("hard"), easy = slots("easy"), main = new Array(X.count);
  const H = ids.slice().sort((a, b) => busy(b) - busy(a) || ids.indexOf(a) - ids.indexOf(b)).slice(0, hard.length);
  let rest = ids.filter((id) => H.indexOf(id) < 0); const Es = rest.slice().sort((a, b) => L(a).convert.colours - L(b).convert.colours || ids.indexOf(a) - ids.indexOf(b)).slice(0, easy.length);
  rest = rest.filter((id) => Es.indexOf(id) < 0);
  const inOrder = (list) => list.slice().sort((a, b) => ids.indexOf(a) - ids.indexOf(b));
  inOrder(H).forEach((id, i) => { main[hard[i]] = id; }); inOrder(Es).forEach((id, i) => { main[easy[i]] = id; }); slots("normal").forEach((s, i) => { main[s] = rest[i]; });
  const pl = LP.landPlan(tags, X.world, X.P, 1000 * X.world.k, X.CFG.v5.density);
  X.world.main = main; writeJ(path.join(X.W, "world.json"), X.world, true);
  writeJ(path.join(X.S, "state.json"), { tags, plan: pl }, true); X.state = { tags, plan: pl };
  console.log("plan: " + X.count + " levels, tags " + tags.map((t) => t[0]).join("") + "; features " + pl.map((p) => p.feats.length).join(""));
}

async function bake(X) {
  const { tags, plan: pl } = X.state, main = X.A ? X.A.main : X.world.main, BD = X.A ? addBoards(X) : null, of = (o, t) => (o && o[t] != null ? o[t] : null); if (!tags || !main) throw new Error("bake: run plan first");
  const list = opt("list") ? opt("list").split(",").map(Number) : null, dir = path.join(X.S, "bake"), jobs = [];
  main.forEach((id, i) => { const n = X.first + i, f = path.join(dir, "m-" + n + ".json"); if (list ? list.indexOf(n) < 0 : !flag("force") && fs.existsSync(f)) return;
    const t = tags[i], B = BD && BD[id]; jobs.push({ file: f, n, job: { n: 1000 * X.world.k + n, tag: t, plan: pl[i], band: bandOf(X, n, t), look: of(X.P.lookahead, t), care: of(X.P.careful, t), careTune: of(X.P.carefulTune || X.P.careful, t), // D15: the profile's careful ceiling and floor (none on World 1's 36)
      mysRows: (X.P.features.mystery || {}).rows || null, over: X.P.bake || null, obv: of(X.P.obvious, t), careLo: of(X.P.carefulFloor, t), pace: X.P.pace, board: B ? { w: B.w, h: B.h, grid: B.grid, pal: B.pal, ink: B.ink || 0, bg: B.bg || 0 } : boardOf(X.byId.get(id)), extra: +opt("extra") || 0, noHidden: true } }); });
  if (!jobs.length) { console.log("bake: every level kept"); return; }
  const threads = +opt("threads") || LB.threadsOf(X.LC.bake), t0 = Date.now(); console.log("bake: " + jobs.length + " levels on " + threads + " threads");
  const res = await LB.runPool(jobs.map((j) => j.job), threads, t0 + X.LC.bake.budget.wallSec * 1000, (d, t) => { if (d % 4 === 0 || d === t) console.log("  " + d + "/" + t + "  " + ((Date.now() - t0) / 1000).toFixed(0) + " s"); });
  res.forEach((r, i) => { writeJ(jobs[i].file, r); console.log("  " + jobs[i].n + " " + jobs[i].job.tag + ": " + (r.fail ? "FAIL " + r.fail : (r.fallback ? "fallback (" + r.fallback + ")" : "ok") + ", " + Math.round(r.level.grade[r.tag].pace.ms / 1000) + " s, " + r.level.win[r.tag].length + " taps")); });
}

// --add: a record from a converted board (as tools/land.js assemble makes a land's, with Zen's id, numbering and source).
const creditOf = (p) => (p.artist ? p.artist + (p.date ? ", " + p.date : "") : p.credit || "Click it! Studios");
const dry = (shade, grid, base) => shade.map((r, y) => r.split("").map((d, x) => (grid[y][x] !== base[y][x] ? "0" : d)).join("")); // a shade is 0 where the bake changed the board (none without moats or keys)
function addRec(X, p, B, r, n) {
  const L = r.level, k = X.world.k;
  return Object.assign({ id: "z" + k + "-" + n, n, era: X.world.era, world: k, source: "zen", title: p.title, kind: p.kind || "painting", src: p.id, credit: creditOf(p), tag: r.tag, band: r.tag, target: bandOf(X, n, r.tag), seed: r.seed,
    w: L.w, h: L.h, grid: L.grid, pic: true, pal: B.pal }, B.shade ? { shade: dry(B.shade, L.grid, B.grid) } : {}, { cols: L.cols }, L.links ? { links: L.links } : {},
    { win: L.win, grade: L.grade, inBand: r.inBand, convert: B.stats, feats: r.plan.feats }, r.mystery ? { mystery: r.mystery } : {}, r.fallback ? { fallback: r.fallback } : {});
}
function assemble(X) {
  const main = X.A ? X.A.main : X.world.main, k = X.world.k, H = X.LC.plan.hidden, bad = [], BD = X.A ? addBoards(X) : null;
  const out = main.map((id, i) => { const n = X.first + i, f = path.join(X.S, "bake", "m-" + n + ".json"), r = fs.existsSync(f) ? readJ(f) : null; if (!r || r.fail) { bad.push(n + ": " + (r ? r.fail : "missing")); return null; }
    if (BD) return addRec(X, X.man.find((p) => p.id === id), BD[id], r, n);
    const S = X.byId.get(id), L = r.level;
    return Object.assign({ id: "z" + k + "-" + n, n, era: X.world.era, world: k, source: "zen", title: S.title }, S.short ? { short: S.short } : {}, { kind: S.kind, src: S.src, credit: S.credit, from: S.id, tag: r.tag, band: r.tag, target: X.P.bands[r.tag], seed: r.seed,
      w: L.w, h: L.h, grid: L.grid, pic: true, pal: S.pal }, S.shade ? { shade: S.shade } : {}, L.hidden ? { hidden: L.hidden } : {}, L.hidden && H.fills ? (({ c, q }) => ({ hideC: c, hideQ: q }))(fillOf(S.pal, H)) : {}, { cols: L.cols }, L.links ? { links: L.links } : {},
      { win: L.win, grade: L.grade, inBand: r.inBand, convert: S.convert, feats: r.plan.feats }, r.mystery ? { mystery: r.mystery } : {}, r.fallback ? { fallback: r.fallback } : {}); });
  writeJ(path.join(X.S, "out", "levels.json"), out.filter(Boolean));
  if (X.A) fs.writeFileSync(path.join(X.S, "out", "licences.md"), ["", "### Zen World " + k + ": " + X.world.name + ", pictures " + X.first + "-" + (X.first + X.count - 1) + " (v6 lane D15, " + X.count + " garden scenes)", "", "| Level | Picture | Artist | Licence | Source |", "|---|---|---|---|---|"]
    .concat(main.map((id, i) => { const p = X.man.find((q) => q.id === id); return "| z" + k + "-" + (X.first + i) + " | " + p.title + " (" + p.id + ") | " + p.artist + " | " + p.licence + " | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed " + p.seed + "; prompt in tools/lands/" + X.world.slug + "/pictures/manifest.json |"; })).join("\n") + "\n");
  console.log("assemble: " + out.filter(Boolean).length + " levels" + (bad.length ? "; MISSING " + bad.join("; ") : "")); return bad;
}

// --add: the world's installed records before A.first (zen.json), and the whole world against its profile: tags (the
// installed ones then A.tags), the density rule, features per level never falling with the tag, the longest Hard run,
// the end on a Hard.
const installedOf = (X) => readJ(path.join(ROOT, "tools/build-data/levels/zen.json")).levels.filter((L) => L.world === X.world.k && L.n < X.first);
function growCheck(X, IN, LV) {
  const bad = [], all = IN.concat(LV), D = X.CFG.v5.density, feats = X.world.features || [];
  if (IN.length !== X.first - 1 || IN.some((L, i) => L.n !== i + 1)) bad.push("installed records 1-" + (X.first - 1) + " not whole");
  LV.forEach((L, i) => { if (L.tag !== X.A.tags[i]) bad.push(L.n + ": tag " + L.tag + ", A.tags says " + X.A.tags[i]); });
  all.forEach((L) => { if (!TG.landDensityOK(L.tag, L, feats, D)) bad.push(L.n + " " + L.tag + ": density rule [" + TG.featuresOf(L).join(",") + "]"); });
  const mean = (t) => { const ls = all.filter((l) => l.tag === t); return ls.length ? ls.reduce((a, l) => a + TG.featuresOf(l).length, 0) / ls.length : null; }, ms = ["easy", "normal", "hard"].map(mean).filter((v) => v != null);
  for (let i = 1; i < ms.length; i++) if (ms[i] < ms[i - 1] - 1e-9) bad.push("features per level fall with the tag (" + ms.map((v) => v.toFixed(2)).join(" / ") + ")");
  let run = 0, top = 0; for (const L of all) { run = L.tag === "hard" || L.tag === "extreme" ? run + 1 : 0; top = Math.max(top, run); } if (top > X.P.tags.run[1]) bad.push("a Hard run of " + top);
  if (all[all.length - 1].tag !== "hard") bad.push("the world ends " + all[all.length - 1].tag);
  const c = (t) => all.filter((L) => L.tag === t).length; return { bad, info: "E" + c("easy") + " N" + c("normal") + " H" + c("hard") + " X" + c("extreme") + ", features " + ms.map((v) => v.toFixed(2)).join(" / ") + ", longest Hard run " + top };
}
// --add: the new sheets after the installed ones in turn (never the same file and mirror twice running, World 2's first
// after them), their spots the levels in order, and every level spot and egg 48 CSS px apart at 375 px.
function sheetsCheck(X, LV) {
  const LAY = readJ(path.join(ROOT, "map/layout.json")), old = readJ(path.join(ROOT, "tools/build-data/levels/zen.json")).worlds.find((w) => w.k === X.world.k).map.sheets.filter((m) => m.levels[1] < X.first), ms = old.concat(X.A.sheets), bad = [], k375 = 375 / LAY.w;
  const key = (m) => LAY.sheets[m.from - 1].file + (m.mirror ? "'" : ""), w2 = LAY.sheets.find((x) => x.land === 1), seq = ms.map(key).concat(w2 ? [w2.file + (w2.mirror ? "'" : "")] : []);
  seq.forEach((q, i) => { if (i && q === seq[i - 1]) bad.push("sheet " + (i + 1) + " repeats " + q); });
  let n = X.first; for (const m of X.A.sheets) { const S = LAY.sheets[m.from - 1], sp = m.spots ? m.spots.map((i) => S.levels[i]) : S.levels.slice(0, m.levels[1] - m.levels[0] + 1);
    if (m.levels[0] !== n || sp.length !== m.levels[1] - m.levels[0] + 1 || sp.some((p) => !p)) bad.push("sheet from " + m.from + ": levels " + m.levels.join("-") + " for " + sp.length + " spots"); n = m.levels[1] + 1;
    if (m.eggsAt !== "quests" || S.quests.length !== (m.eggKinds || []).length || (m.eggKinds || []).some((g) => JN.EGG_KINDS.indexOf(g) < 0)) bad.push("sheet from " + m.from + ": eggs");
    const pts = sp.map((p, i) => [p.x, p.y, "level " + (m.levels[0] + i)]).concat(S.quests.map((q) => [q.x, q.y, "egg"]));
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) * k375; if (d < 48) bad.push("sheet from " + m.from + ": " + pts[i][2] + " and " + pts[j][2] + " " + d.toFixed(0) + " px"); } }
  if (n !== X.first + LV.length) bad.push("the sheets end at " + (n - 1));
  return bad;
}
function check(X) {
  const LV = readJ(path.join(X.S, "out", "levels.json")), V3 = X.CFG.v3, BC = require("./bake-config.json"), BK = X.LC.bake, rules = (t) => E.rulesOf(V3, t), gates = [], gate = (name, bad, info) => gates.push({ name, ok: !bad.length, bad, info: info || "" });
  const each = (f) => LV.map((L) => { try { const w = f(L); return w ? L.id + ": " + w : null; } catch (e) { return L.id + ": " + e.message; } }).filter(Boolean), k = X.world.k;
  const f0 = X.first, f1 = X.first + X.count - 1;
  gate(X.count + " levels, ids z" + k + "-" + f0 + "..z" + k + "-" + f1 + ", world " + k, LV.length === X.count && LV.every((L, i) => L.id === "z" + k + "-" + (f0 + i) && L.n === f0 + i && L.world === k && L.era === X.world.era) ? [] : ["count or numbering"]);
  gate("compiles, E.check clean", each((L) => { E.compile(L); const w = E.check(L); return w.length ? w.join(", ") : null; }));
  gate("the stored order wins on its tag, no power-up", each((L) => (E.replay(E.compile(L), rules(L.tag), L.win[L.tag] || "").status === E.WON && !rules(L.tag).powers ? null : "does not win")));
  gate("5 spaces, at most that many in use", each((L) => { const ln = R.line(E.compile(L), rules(L.tag), L.win[L.tag]); return V3.rules.hold === 5 && ln.peak <= 5 ? null : "peak " + ln.peak; }));
  gate("longest tap <= " + BK.maxWaitMs / 1000 + " s, <= " + BK.maxTaps + " taps", each((L) => { const g = L.grade[L.tag]; return g.maxWait <= BK.maxWaitMs && L.win[L.tag].length <= BK.maxTaps ? null : "wait " + g.maxWait + ", taps " + L.win[L.tag].length; }));
  gate("the steady 1 s replay: every thinking replay wins, no wait between taps over " + BK.maxWaitMs / 1000 + " s", each((L) => { const g = L.grade[L.tag]; return g.steady && !g.steady.lost && g.steady.gap <= BK.maxWaitMs && (g.thinks || []).every((v) => v) ? null : "steady " + JSON.stringify([g.thinks, g.steady]); }));
  const pr = X.P.pace.range, pm = med(LV.map((L) => L.grade[L.tag].pace.ms)), PM = X.world.paceMedian || X.LC.checks.paceMedian;
  gate("real pace " + pr.map((v) => v / 1000).join("-") + " s", each((L) => { const p = L.grade[L.tag].pace; return p && !p.fell && p.ms >= pr[0] && p.ms <= pr[1] ? null : "pace " + (p ? Math.round(p.ms / 1000) + " s" : "-"); }));
  gate("the median real pace in " + PM.map((v) => v / 1000).join("-") + " s", pm >= PM[0] && pm <= PM[1] ? [] : ["median " + Math.round(pm / 1000) + " s"], "median " + Math.round(pm / 1000) + " s");
  gate("no fallback picks", LV.filter((L) => L.fallback).map((L) => L.id + ": " + L.fallback));
  if (!X.A) gate("the profile: tags, density, runs, the end (land-plan planCheck)", LP.planCheck(LV, X.world, X.P, X.CFG.v5.density, X.CFG.lands.perLand));
  else { const IN = installedOf(X), all = IN.concat(LV), pa = med(all.map((L) => L.grade[L.tag].pace.ms)), CF = X.P.carefulFloor || {}, C = require("./convert.js").config().convert;
    gate("the whole world (" + all.length + " levels): the installed " + IN.length + " (1-" + IN.length + "), then these (" + growCheck(X, IN, LV).info + ")", growCheck(X, IN, LV).bad, "median real pace of all " + Math.round(pa / 1000) + " s");
    gate("the careful player at or over the floor per tag (" + Object.keys(CF).map((t) => t + " " + CF[t]).join(", ") + ")", each((L) => (CF[L.tag] == null || L.grade[L.tag].careful >= CF[L.tag] ? null : "careful " + L.grade[L.tag].careful)), "min " + Math.min(...LV.map((L) => L.grade[L.tag].careful)));
    gate("shading: every shade colour on its floors (" + C.shade.floor + " from other squads, " + C.shade.fadedFloor + " from faded cards)", each((L) => { if (!L.shade) return X.A.shade ? "no shade" : null; const r = SH.checkLevel(L, C); return r.ok ? null : r.bad.join("; "); }));
    gate("no moat water or path (World 1 has none)", LV.filter((L) => L.grid.some((r) => /[~]/.test(r)) || L.liquid).map((L) => L.id));
    gate("the new sheets: " + X.A.sheets.length + " in the world's turn, a spot a level, 48 CSS px between points at 375 px", sheetsCheck(X, LV)); }
  gate("casual: no lock, no Extreme", LV.filter((L) => L.lock || L.tag === "extreme").map((L) => L.id));
  gate("Zen: no mystery blocks (Peter, 2026-10-08)", LV.filter((L) => L.hidden || L.hideC || L.feats.indexOf("hidden") >= 0).map((L) => L.id)); // v6 lane D8
  const HF = X.LC.plan.hidden; gate("mystery blocks: each level's fill " + HF.fillDE[1] + "+ from its picture", each((L) => (!L.hidden ? null : !L.hideC ? "no fill" : fillGap(L.hideC, L.pal) >= HF.fillDE[1] ? null : "fill " + L.hideC)));
  const rg = regrade(LV, BC, V3, false); gate("re-grade with the grader's own counts: 0 differences (" + rg.checks + " checks)", rg.lines);
  const ok = gates.every((g) => g.ok), sh = LP.sharesOf(LV);
  const rows = ["# Zen world " + k + ": " + X.world.name, "", "Made by `tools/zen-world.js` on " + new Date().toISOString().slice(0, 10) + ". " + (ok ? "**Every gate passes.**" : "**Gates failing: " + gates.filter((g) => !g.ok).length + ".**"), "", "| Gate | | Detail |", "|---|---|---|"]
    .concat(gates.map((g) => "| " + g.name + " | " + (g.ok ? "pass" : "FAIL") + " | " + (g.ok ? g.info : g.bad.slice(0, 6).join("; ")) + " |"), ["", "Shares: " + Object.entries(sh).map(([a, b]) => a + " " + b).join(", "), "",
      "| Level | Picture | Board | Tag | Features | Rate (band) | Real pace | Longest tap | Steady gap / end | Taps |", "|---|---|---|---|---|---|---|---|---|---|"],
    LV.map((L) => { const g = L.grade[L.tag]; return "| " + L.n + " | " + L.title + " (" + (L.from || L.src) + ") | " + L.w + "x" + L.h + " | " + L.tag + " | " + (L.feats.join(", ") || "-") + (L.cols.flat().filter((c) => c[2]).length ? " (" + L.cols.flat().filter((c) => c[2]).length + " ?)" : "") + " | " + (100 * g.rate).toFixed(1) + "% (" + L.target.map((v) => 100 * v).join("-") + ") | " + Math.round(g.pace.ms / 1000) + " s | " + (g.maxWait / 1000).toFixed(1) + " s | " + (g.steady.gap / 1000).toFixed(1) + " / " + (g.steady.end / 1000).toFixed(1) + " s | " + L.win[L.tag].length + " |"; }));
  fs.writeFileSync(path.join(X.S, "report.md"), rows.join("\n") + "\n"); writeJ(path.join(X.S, "state.json"), Object.assign({}, X.state, { ok, checked: new Date().toISOString() }), true);
  for (const g of gates) console.log((g.ok ? "  pass  " : "  FAIL  ") + g.name + (g.ok ? (g.info ? " (" + g.info + ")" : "") : ": " + g.bad.slice(0, 3).join("; ")));
  console.log("check: " + (ok ? "PASS" : "FAIL") + " (scratch/report.md)"); return ok;
}

// The world's records into tools/build-data/levels/zen.json (one line, like levels.json), replacing any of this world's; the file's other
// fields (worlds, the note) are kept.
function install(X) {
  const st = readJ(path.join(X.S, "state.json")); if (!st.ok) throw new Error("install: no passing check");
  const f = path.join(ROOT, "tools/build-data/levels/zen.json"), Z = readJ(f), LV = readJ(path.join(X.S, "out", "levels.json"));
  if (X.A) { const k = X.world.k, w = Z.worlds.find((v) => v.k === k); // D15: appended, the installed records and sheets before A.first kept
    Z.levels = Z.levels.filter((L) => L.world !== k || L.n < X.first).concat(LV).sort((a, b) => a.world - b.world || a.n - b.n);
    w.map.sheets = w.map.sheets.filter((m) => m.levels[1] < X.first).concat(X.A.sheets); if (X.A.mapNote) w.map.note = X.A.mapNote;
    fs.writeFileSync(f + ".tmp", JSON.stringify(Z) + "\n"); fs.renameSync(f + ".tmp", f); console.log("install --add: world " + k + " pictures " + X.first + "-" + (X.first + LV.length - 1) + " and " + X.A.sheets.length + " sheets written into tools/build-data/levels/zen.json"); return; }
  Z.levels = (Z.levels || []).filter((L) => L.world !== X.world.k).concat(LV).sort((a, b) => a.world - b.world || a.n - b.n);
  fs.writeFileSync(f + ".tmp", JSON.stringify(Z) + "\n"); fs.renameSync(f + ".tmp", f);
  console.log("install: world " + X.world.k + " (" + LV.length + " levels) written into tools/build-data/levels/zen.json");
}

if (require.main === module) {
  (async () => {
    const dir = argv[0]; if (!dir || dir.startsWith("--")) { console.log("usage: node tools/zen-world.js WORLD_DIR [plan|bake|assemble|check|install ...]"); process.exitCode = 2; return; }
    const asked = argv.slice(1).filter((a, i, A) => !a.startsWith("--") && !(i > 0 && A[i - 1].startsWith("--") && ["threads", "list", "extra", "against"].indexOf(A[i - 1].slice(2)) >= 0));
    const steps = asked.length ? asked : ["plan", "bake", "assemble", "check"];
    try { for (const s of steps) { console.log("== " + s); const X = context(dir); fs.mkdirSync(X.S, { recursive: true });
      if (s === "prep") prep(X); else if (s === "convert") convert(X); else if (s === "plan") plan(X); else if (s === "bake") await bake(X); else if (s === "assemble") { if (assemble(X).length) { process.exitCode = 1; break; } } else if (s === "check") { if (!check(X)) process.exitCode = 1; } else if (s === "install") install(X); else throw new Error("no step " + s); } }
    catch (e) { console.log("zen-world: " + e.message); process.exitCode = 1; }
  })();
}
module.exports = { boardOf };
