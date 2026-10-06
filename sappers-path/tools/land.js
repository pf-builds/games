// Sapper's Path lands foundation: the land factory (SPEC-v4 §9, the lands foundation entry; how to run it:
// tools/land-runbook.md). One land folder in, one checked land out, ready to copy into the game:
//   ~/.local/opt/node/bin/node tools/land.js LAND_DIR [STEP ...] [--game DIR] [--gallery DIR] [--threads N]
//                                            [--only A-B | --list N,N,...] [--extra K] [--force]
//   ~/.local/opt/node/bin/node tools/land.js LAND_DIR install [--game DIR]
// LAND_DIR: land.json (k, slug, name, lore, count, source, features, eggs, shade, profile, raw, main, map) and
// pictures/manifest.json (id, title, artist, date, kind, licence, url, file, crop?, chroma?). Side quests come from the
// Wandering Gallery (--gallery, default tools/lands/_gallery: gallery.json {raw}, manifest.json), in its order, the
// next pictures no land has used yet. --game: the game the land goes into (default this one; the levels, gallery,
// layout and config it reads and, on install, writes).
// Steps (default: all of them, in order; each keeps what an earlier run made unless --force; --only A-B or --list N,N
// and --extra K re-bake just those main levels, in parallel, with K more candidates each):
//   prep      the stored sources (tools/land-src.py) for the land's pictures and the gallery pictures it will use
//   convert   each picture at the max phone size (tools/land-config.json box), flat and (land.shade) shaded
//             (tools/shade.js) -> scratch/boards.json
//   sheet     the contact sheet (tools/land-sheet.py) -> scratch/contact.png
//   bake      the tags and the plan from the land's profile (tools/land-plan.js), every main level and side quest
//             (tools/land-bake.js, worker threads) -> scratch/bake/*.json. A land listing moat (organic moats,
//             tools/moat.js) first asks each main picture whether it can carry a ring with the gentlest opening set its
//             profile allows (state.json moat: [{n, ok, why}]; every level can step down to it); the plan skips those that
//             can't.
//   map       the layout entries from the land's 2 sheet templates, alternately mirrored -> scratch/map.json
//   assemble  the level records, the side-quest records, the config entry, the egg coins and the licence lines ->
//             scratch/out/
//   check     every gate (below) -> scratch/report.md and scratch/state.json {ok}
//   install   (only after a passing check; never part of the default run) appends the land to the game: levels,
//             gallery, layout, sheets, config (lands.list, map.eggCoins) and LICENSES.md, each file written whole only
//             after every write is ready. A land already in the game's config is refused.
// The gates: the level count and numbering; each level compiles and E.check is clean; the stored order wins on its tag
// with no power-up; at most 5 spaces in use; the longest tap and the taps under the caps; real pace in the profile's
// range and the land's median in checks.paceMedian; no fallback picks; the profile (tags, density, runs, end; land-plan
// planCheck); every shade colour against its floors (shade.js checkLevel); side quests every checks.quests levels, plain
// boards; a re-grade of every record with the grader's own counts (tools/regrade.js) with 0 differences; a spot for every
// level and side quest, sheets alternating file and mirror, 48 CSS px between nodes at a 375 px phone; a licence and
// source for every picture. A land with moats (organic moats): every ring is water only where the picture's subject is
// not, leaves every block reachable from the frame once dug, and has the 1 or 2 openings its bake reports.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const E = require("../src/engine.js");
const R = require("./grade.js");
const V = require("./convert.js");
const SH = require("./shade.js");
const LP = require("./land-plan.js");
const LB = require("./land-bake.js");
const TG = require("./tags.js");
const Q = require("./quests.js");
const JN = require("../src/journey.js");
const { regrade } = require("./regrade.js");
const MO = require("./moat.js");

const ROOT = path.join(__dirname, "..");
const argv = process.argv.slice(2), flag = (k) => argv.indexOf("--" + k) >= 0, opt = (k) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : null; };
const STEPS = ["prep", "convert", "sheet", "bake", "map", "assemble", "check"];
const readJ = (f) => JSON.parse(fs.readFileSync(f, "utf8")), writeJ = (f, o, pretty) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify(o, null, pretty ? 1 : 0) + "\n"); fs.renameSync(t, f); };
const r1 = (v) => Math.round(v * 10) / 10, med = (a) => { const q = a.slice().sort((x, y) => x - y); return q.length ? q[(q.length - 1) >> 1] : null; };

// ---- the context: the land, the game it goes into, the shared gallery ------------------------------------------------------
function context(dir) {
  const LAND = path.resolve(dir), GAME = path.resolve(opt("game") || ROOT), GAL = path.resolve(opt("gallery") || path.join(ROOT, "tools/lands/_gallery")), S = path.join(LAND, "scratch");
  const land = readJ(path.join(LAND, "land.json")), man = readJ(path.join(LAND, "pictures/manifest.json")), CFG = readJ(path.join(GAME, "config.json")), LC = require("./land-config.json");
  const levels = readJ(path.join(GAME, "levels/levels.json")), gallery = readJ(path.join(GAME, "levels/gallery.json")), layout = readJ(path.join(GAME, "map/layout.json"));
  const gman = fs.existsSync(path.join(GAL, "manifest.json")) ? readJ(path.join(GAL, "manifest.json")) : [], gcfg = fs.existsSync(path.join(GAL, "gallery.json")) ? readJ(path.join(GAL, "gallery.json")) : {};
  const LCF = CFG.lands, P = LP.profileOf(land, LC), count = land.count || LCF.perLand;
  // Where it goes: the level after the game's last, the sheet after its last, the picture after its last.
  const state = fs.existsSync(path.join(S, "state.json")) ? readJ(path.join(S, "state.json")) : {};
  const from = state.from || levels.levels[levels.levels.length - 1].n + 1, sheet0 = state.sheet0 || layout.sheets.length + 1, gal0 = state.gal0 != null ? state.gal0 : gallery.levels.length;
  return { LAND, GAME, GAL, S, land, man, CFG, LC, LCF, P, levels, gallery, layout, gman, gcfg, count, from, to: from + count - 1, sheet0, gal0, era: LCF.castleRealms + land.k, state };
}
const saveState = (X, extra) => { X.state = Object.assign({}, X.state, { from: X.from, to: X.to, sheet0: X.sheet0, gal0: X.gal0 }, extra || {}); writeJ(path.join(X.S, "state.json"), X.state, true); };
// The land's main pictures in level order, and its side quests: the next Wandering Gallery pictures no land has used.
function picturesOf(X) {
  const ids = X.land.main || X.man.map((p) => p.id), main = ids.slice(0, X.count).map((id) => { const p = X.man.find((q) => q.id === id); if (!p) throw new Error("picture " + id + " is not in the land's manifest"); return p; });
  if (main.length < X.count) throw new Error("the land has " + main.length + " pictures for " + X.count + " levels");
  const used = new Set(X.gallery.levels.filter((l) => l.wander).map((l) => l.src)), quests = Q.landQuestsOf({ from: X.from, to: X.to }, X.CFG.gallery.quests, X.CFG.meta.powers, X.gal0, 1e9);
  const free = X.gman.filter((p) => !used.has(p.id)), side = free.slice(0, quests.length);
  return { main, side, quests: quests.slice(0, side.length) };
}

// ---- prep, convert, sheet ------------------------------------------------------------------------------------------------
function prep(X) {
  const { main, side } = picturesOf(X), py = process.env.LAND_PYTHON || "python3";
  const run = (raw, man, out, ids) => { if (!ids.length) return; const tmp = path.join(X.S, "tmp-manifest.json"); writeJ(tmp, man); console.log(execFileSync(py, [path.join(__dirname, "land-src.py"), raw, tmp, out].concat(ids), { encoding: "utf8" }).trim()); };
  run(path.resolve(X.LAND, X.land.raw || "pictures"), X.man, path.join(X.LAND, "src"), main.map((p) => p.id));
  run(path.resolve(X.GAL, X.gcfg.raw || "pictures"), X.gman, path.join(X.GAL, "src"), side.map((p) => p.id));
}
// One picture at the max phone size: its box by orientation and colour count, a painting's chroma stepped up until it
// has convert.minColours; then shade.js when the land shades.
function boardOf(X, pic, srcDir, shade) {
  const C = V.config().convert, BX = X.LC.box, CV = X.LC.convert, src = V.load(path.join(srcDir, pic.id + ".png")), base = { kind: pic.kind || "painting", crop: pic.crop || [0.01, 0.01, 0.99, 0.99] };
  const tryOpt = (chroma) => { let o = Object.assign({}, base, { box: BX.box }, chroma ? { chroma } : {}), P = V.plan(src, o, C); if (P.stats.colours >= BX.manyAt) { o = Object.assign({}, o, { box: BX.many }); P = V.plan(src, o, C); } return { o, P }; };
  let best = tryOpt(pic.chroma || null);
  if (!pic.chroma && base.kind === "painting") for (const ch of CV.chromaSteps) { if (best.P.stats.colours >= CV.minColours) break; const t = tryOpt(ch); if (t.P.stats.colours > best.P.stats.colours) best = t; }
  const { o, P } = best, ink = +Object.keys(P.pal).find((k) => P.pal[k].c === C.ink) || 0, bg = P.stats.bg ? +Object.keys(P.pal).find((k) => P.pal[k].c === P.stats.bg) || 0 : 0;
  const b = { w: P.w, h: P.h, grid: P.grid, pal: P.pal, stats: P.stats, ink, bg, opt: { box: o.box, crop: o.crop, chroma: o.chroma || (C.kinds[o.kind] || {}).chroma || null } };
  if (shade) { const s = SH.shadeOf(src, P, o, C); if (s) Object.assign(b, { pal: s.pal, shade: s.shade, shadeStats: s.stats }); }
  return b;
}
function convert(X) {
  const f = path.join(X.S, "boards.json"); if (fs.existsSync(f) && !flag("force")) { console.log("convert: kept scratch/boards.json"); return; }
  const { main, side } = picturesOf(X), t0 = Date.now();
  const out = { main: main.map((p, i) => ({ id: p.id, n: X.from + i, title: p.title, board: boardOf(X, p, path.join(X.LAND, "src"), !!X.land.shade) })), side: side.map((p) => ({ id: p.id, title: p.title, board: boardOf(X, p, path.join(X.GAL, "src"), !!X.land.shade) })) };
  writeJ(f, out); console.log("convert: " + out.main.length + " main and " + out.side.length + " side pictures in " + ((Date.now() - t0) / 1000).toFixed(1) + " s (" + out.main.filter((e) => e.board.shade).length + " shaded)");
}
function sheet(X) {
  const out = path.join(X.S, "contact.png"), py = process.env.LAND_PYTHON || "python3", b = readJ(path.join(X.S, "boards.json")), src = path.join(X.S, "sheet-src");
  fs.mkdirSync(src, { recursive: true }); for (const e of b.main) fs.copyFileSync(path.join(X.LAND, "src", e.id + ".png"), path.join(src, e.id + ".png")); for (const e of b.side) fs.copyFileSync(path.join(X.GAL, "src", e.id + ".png"), path.join(src, e.id + ".png"));
  console.log(execFileSync(py, [path.join(__dirname, "land-sheet.py"), path.join(X.S, "boards.json"), src, out], { encoding: "utf8" }).trim());
}

// ---- bake ------------------------------------------------------------------------------------------------------------------
// Organic moats: can each main picture carry a ring with the gentlest opening set the profile allows (the bake steps
// every level down to it when its planned set won't deal)?
function moatCan(X, b) {
  const MC = X.LC.plan.moat, F = X.P.features.moat || {}, lo = (F.ways || [0])[0];
  return b.main.map((e) => { const R = MO.ringOf(e.board, MC, MC.ways[lo], 0, null, F.liquids); return { n: e.n, ok: !!R.cells, why: R.cells ? null : R.why }; });
}
async function bake(X) {
  const b = readJ(path.join(X.S, "boards.json")), { quests } = picturesOf(X), tags = LP.landTags(X.count, X.P.tags, X.LCF.perLand), D = X.CFG.v5.density, BK = X.LC.bake;
  const moat = (X.land.features || []).indexOf("moat") >= 0 ? moatCan(X, b) : null, plan = LP.landPlan(tags, X.land, X.P, X.from, D, moat ? { moat: moat.map((m) => m.ok) } : null), liquids = moat ? (X.P.features.moat || {}).liquids : undefined, moatLo = moat ? ((X.P.features.moat || {}).ways || [0])[0] : 0;
  saveState(X, moat ? { tags, plan, moat } : { tags, plan }); if (moat) console.log("bake: " + moat.filter((m) => m.ok).length + " of " + moat.length + " pictures can carry a moat" + moat.filter((m) => !m.ok).map((m) => "; " + m.n + " can't: " + m.why).join(""));
  const only = opt("only") ? opt("only").split("-").map(Number) : null, list = opt("list") ? opt("list").split(",").map(Number) : null, dir = path.join(X.S, "bake");
  const inRun = (n) => (list ? list.indexOf(n) >= 0 : !only || (n >= only[0] && n <= (only[1] || only[0]))), want = (f, n) => (flag("force") || only || list ? inRun(n) : !fs.existsSync(f)), jobs = [];
  b.main.forEach((e, i) => { const f = path.join(dir, "m-" + e.n + ".json"); if (want(f, e.n)) jobs.push({ file: f, job: { n: e.n, tag: tags[i], plan: plan[i], band: X.P.bands[tags[i]], look: X.P.lookahead[tags[i]] != null ? X.P.lookahead[tags[i]] : null, pace: X.P.pace, board: e.board, extra: +opt("extra") || 0, liquids, moatLo } }); });
  b.side.forEach((e, i) => { const n = X.gal0 + i + 1, tag = BK.sideCycle[(X.gal0 + i) % BK.sideCycle.length], f = path.join(dir, "s-" + n + ".json"); if (!only && !list && (flag("force") || !fs.existsSync(f))) jobs.push({ file: f, job: { n: 100000 + n, side: true, tag, band: BK.sideBands[tag], look: null, pace: BK.sidePace, board: e.board } }); });
  if (!jobs.length) { console.log("bake: every level kept (scratch/bake)"); return; }
  const threads = +opt("threads") || LB.threadsOf(BK), t0 = Date.now(); console.log("bake: " + jobs.length + " levels on " + threads + " threads (" + quests.length + " side quests in the land)");
  const res = await LB.runPool(jobs.map((j) => j.job), threads, t0 + BK.budget.wallSec * 1000, (d, t) => { if (d % 5 === 0 || d === t) console.log("  " + d + "/" + t + "  " + ((Date.now() - t0) / 1000).toFixed(0) + " s"); });
  res.forEach((r, i) => { writeJ(jobs[i].file, r); const n = jobs[i].job.side ? "side " + (jobs[i].job.n - 100000) : jobs[i].job.n; console.log("  " + n + " " + jobs[i].job.tag + ": " + (r.fail ? "FAIL " + r.fail : (r.fallback ? "fallback (" + r.fallback + ")" : "ok") + ", " + Math.round(r.level.grade[r.tag].pace.ms / 1000) + " s, " + r.level.win[r.tag].length + " taps")); });
}

// ---- map -------------------------------------------------------------------------------------------------------------------
// The 2 templates (layout-shaped entries): from land.json map.templates (a file) or, for a trial, copied from the game's
// own layout sheets (map.fromLayout: sheet numbers; their bridges from config map.bridges).
function templatesOf(X) {
  const M = X.land.map || {}; let T;
  if (M.templates) T = readJ(path.resolve(X.LAND, M.templates));
  else T = (M.fromLayout || []).map((sn) => { const S = X.layout.sheets[sn - 1]; return { from: sn, road: S.road, entry: S.entry, exit: S.exit, levels: S.levels.map((p) => ({ x: p.x, y: p.y })), quests: S.quests.map((q) => ({ x: q.x, y: q.y, branch: q.branch })), eggs: S.eggs.map((g) => ({ kind: g.kind, x: g.x, y: g.y })), bridges: X.CFG.map.bridges.filter((b) => b[0] === sn).map((b) => b.slice(1)) }; });
  if (T.length !== 2 || !Array.isArray(M.files) || M.files.length !== 2) throw new Error("map: a land needs 2 sheet files and 2 templates");
  return T.map((t, i) => Object.assign({}, t, { file: M.files[i] }));
}
function map(X) {
  const T = templatesOf(X), MC = X.LC.map, W = X.layout.w, { side, quests } = picturesOf(X), entries = [], seed = X.from * 7919 + X.land.k;
  const rnd = (k) => { let t = Math.imul(seed + 0x3c6e, 0x9E3779B1) ^ Math.imul(k + 11, 0x85EBCA77); t ^= t >>> 15; t = Math.imul(t, 0x2c1b3c6d); t ^= t >>> 12; return (t >>> 0) / 4294967296; };
  let n = X.from;
  for (let e = 0; n <= X.to && e < MC.maxSheets; e++) {
    const t = T[e % 2], mirror = Math.floor(e / 2) % 2 === 1, spots = t.levels.slice(0, Math.min((X.land.map || {}).perSheet || t.levels.length, X.to - n + 1));
    const S = { sheet: X.sheet0 + e, file: t.file, realm: X.era, realmName: X.land.name, land: X.land.k, levels: spots.map((p) => ({ n: n++, x: p.x, y: p.y })), quests: [], entry: t.entry, exit: t.exit, road: t.road,
      eggs: t.eggs.map((g, i) => ({ kind: X.land.eggs[(2 * e + i) % X.land.eggs.length], x: g.x, y: g.y })), bridges: t.bridges || [] };
    if (mirror) S.mirror = true; if (MC.fade) S.fade = true;
    if (n > X.to && spots.length < t.levels.length) { const p = t.levels[spots.length]; S.tail = { x: p.x, y: p.y, fog: 0 }; } // the land's frontier: the first spot past its last level
    entries.push(S);
  }
  if (n <= X.to) throw new Error("map: " + MC.maxSheets + " sheets hold only " + (n - X.from) + " of " + X.count + " levels");
  // Side quests: a template quest spot on the sheet of its main level (the free one nearest it along the road), else a
  // spot made questOff px off the road beside the level, on the side with more room.
  const usedQ = new Map();
  quests.forEach((q, i) => {
    const si = entries.findIndex((S) => S.levels.some((p) => p.n === q.after)), S = entries[si], t = T[si % 2], lp = S.levels.find((p) => p.n === q.after), li = JN.nearest(S.road, lp.x, lp.y);
    const free = t.quests.filter((s, k) => !(usedQ.get(si) || []).includes(k)).map((s) => ({ s, k: t.quests.indexOf(s), d: Math.abs(JN.nearest(S.road, s.branch[0], s.branch[1]) - li) })).sort((a, b) => a.d - b.d)[0];
    let spot; if (free && free.d <= 40) { spot = { x: free.s.x, y: free.s.y, branch: free.s.branch }; usedQ.set(si, (usedQ.get(si) || []).concat(free.k)); }
    else { const nx = S.levels.find((p) => p.n === q.after + 1), j = nx ? Math.round((li + JN.nearest(S.road, nx.x, nx.y)) / 2) : Math.min(S.road.length - 1, li + 6), b = S.road[j], a = JN.heading(S.road, j, 3) * Math.PI / 180;
      const others = S.levels.map((p) => [p.x, p.y]).concat(S.eggs.map((g) => [g.x, g.y]), S.quests.map((z) => [z.x, z.y]));
      const at = (sg) => [b[0] - Math.sin(a) * MC.questOff * sg, b[1] + Math.cos(a) * MC.questOff * sg], room = (p) => (p[0] < 60 || p[0] > W - 60 || p[1] < 60 || p[1] > X.layout.h - 60 ? -1 : Math.min(...others.map((o) => Math.hypot(o[0] - p[0], o[1] - p[1]))));
      const pa = at(1), pb = at(-1), p = room(pa) >= room(pb) ? pa : pb; spot = { x: Math.round(p[0]), y: Math.round(p[1]), branch: [Math.round(b[0]), Math.round(b[1])], made: true }; }
    S.quests.push(Object.assign({ q: X.gal0 + i + 1, id: "g-w-" + side[i].id, after: q.after, prize: q.prize }, spot));
  });
  const coins = entries.map((S, e) => S.eggs.map((g, i) => MC.eggCoins[0] + Math.floor(rnd(e * 2 + i) * (MC.eggCoins[1] - MC.eggCoins[0] + 1))));
  writeJ(path.join(X.S, "map.json"), { entries, eggCoins: coins }, true);
  console.log("map: " + entries.length + " sheets (" + entries.map((S) => S.file + (S.mirror ? " mirrored" : "")).join(", ") + "), " + entries.reduce((a, S) => a + S.quests.length, 0) + " side quests (" + entries.reduce((a, S) => a + S.quests.filter((z) => z.made).length, 0) + " on made spots)");
}

// ---- assemble ---------------------------------------------------------------------------------------------------------------
// The converted board's shade rows, 0 on every cell the bake changed (organic moats: the ring's water and path; a key
// dug in), since a shade belongs to the colour the picture drew there.
const dry = (shade, grid, base) => shade.map((r, y) => r.split("").map((d, x) => (grid[y][x] !== base[y][x] ? "0" : d)).join(""));
const creditOf = (p) => (p.artist ? p.artist + (p.date ? ", " + p.date : "") : p.credit || "Click it! Studios");
function assemble(X) {
  const b = readJ(path.join(X.S, "boards.json")), mp = readJ(path.join(X.S, "map.json")), { main, side, quests } = picturesOf(X), out = path.join(X.S, "out"), bad = [];
  const rec = (r) => { if (!r || r.fail) bad.push(r ? r.n + ": " + r.fail : "missing"); return r && !r.fail ? r : null; };
  const levels = b.main.map((e, i) => { const r = rec(readJ(path.join(X.S, "bake", "m-" + e.n + ".json"))); if (!r) return null; const p = main[i], B = e.board, L = r.level;
    return Object.assign({ id: "e" + X.era + "-" + e.n, n: e.n, era: X.era, land: X.land.k, source: "land", title: p.title, kind: p.kind || "painting", src: p.id, credit: creditOf(p), tag: r.tag, band: r.tag, target: X.P.bands[r.tag], seed: r.seed,
      w: L.w, h: L.h, grid: L.grid, pic: true, pal: B.pal }, L.liquid ? { liquid: L.liquid } : {}, B.shade ? { shade: dry(B.shade, L.grid, B.grid) } : {}, L.hidden ? { hidden: L.hidden } : {}, L.lock ? { lock: L.lock } : {}, { cols: L.cols }, L.links ? { links: L.links } : {},
      { win: L.win, grade: L.grade, inBand: r.inBand, convert: B.stats, feats: r.plan.feats.concat(r.plan.lock ? ["lock"] : []) }, r.plan.cant ? { cant: r.plan.cant } : {}, r.mystery ? { mystery: r.mystery } : {}, r.fallback ? { fallback: r.fallback } : {}); });
  const pics = b.side.map((e, i) => { const r = rec(readJ(path.join(X.S, "bake", "s-" + (X.gal0 + i + 1) + ".json"))); if (!r) return null; const p = side[i], B = e.board, L = r.level;
    return Object.assign({ id: "g-w-" + p.id, n: X.gal0 + i + 1, gallery: true, wander: true, land: X.land.k, title: p.title, kind: p.kind || "painting", src: p.id, credit: creditOf(p), tag: r.tag, band: r.tag, target: X.LC.bake.sideBands[r.tag], seed: r.seed,
      w: L.w, h: L.h, grid: L.grid, pic: true, cols: L.cols, pal: B.pal }, B.shade ? { shade: B.shade } : {}, { win: L.win, grade: L.grade, inBand: r.inBand, convert: B.stats, quest: quests[i] }, r.fallback ? { fallback: r.fallback } : {}); });
  const S = mp.entries, entry = { k: X.land.k, slug: X.land.slug, name: X.land.name, lore: X.land.lore, from: X.from, to: X.to, source: X.land.source, features: X.land.features, eggs: X.land.eggs, sheets: [S[0].sheet, S[S.length - 1].sheet], files: X.land.map.files };
  const lic = ["", "### Land " + X.land.k + ": " + X.land.name + " (levels " + X.from + "-" + X.to + ")", "", "| Level | Picture | Artist | Licence | Source |", "|---|---|---|---|---|"]
    .concat(main.map((p, i) => "| " + (X.from + i) + " | " + p.title + " (" + p.id + ") | " + (p.artist || "-") + " | " + p.licence + " | " + p.url + " |"),
      side.map((p, i) => "| side quest " + (X.gal0 + i + 1) + " (Wandering Gallery) | " + p.title + " (" + p.id + ") | " + (p.artist || "-") + " | " + p.licence + " | " + p.url + " |"));
  writeJ(path.join(out, "levels.json"), levels.filter(Boolean)); writeJ(path.join(out, "gallery.json"), pics.filter(Boolean)); writeJ(path.join(out, "land.json"), { entry, layout: S, eggCoins: mp.eggCoins }, true);
  fs.writeFileSync(path.join(out, "licences.md"), lic.join("\n") + "\n");
  console.log("assemble: " + levels.filter(Boolean).length + " levels, " + pics.filter(Boolean).length + " side quests" + (bad.length ? "; MISSING " + bad.join("; ") : ""));
  return bad;
}

// ---- check ------------------------------------------------------------------------------------------------------------------
function check(X) {
  const out = path.join(X.S, "out"), LV = readJ(path.join(out, "levels.json")), GV = readJ(path.join(out, "gallery.json")), LJ = readJ(path.join(out, "land.json")), V3 = X.CFG.v3, BC = require("./bake-config.json"), GB = require("./gallery-config.json").bake;
  const rules = (t) => E.rulesOf(V3, t), gates = [], gate = (name, bad, info) => gates.push({ name, ok: !bad.length, bad, info: info || "" }), C = V.config().convert;
  const { main, side } = picturesOf(X);
  gate("levels " + X.from + "-" + X.to + ", in order, ids e" + X.era + "-<n>", LV.length === X.count && LV.every((L, i) => L.n === X.from + i && L.id === "e" + X.era + "-" + L.n && L.era === X.era) ? [] : ["count or numbering"]);
  const each = (ls, f) => ls.map((L) => { try { const w = f(L); return w ? L.id + ": " + w : null; } catch (e) { return L.id + ": " + e.message; } }).filter(Boolean);
  gate("compiles, E.check clean", each(LV.concat(GV), (L) => { E.compile(L); const w = E.check(L); return w.length ? w.join(", ") : null; }));
  gate("the stored order wins on its tag, no power-up", each(LV.concat(GV), (L) => (E.replay(E.compile(L), rules(L.tag), L.win[L.tag] || "").status === E.WON && !rules(L.tag).powers ? null : "does not win")));
  gate("5 spaces (config v3.rules.hold " + V3.rules.hold + "), at most that many in use", each(LV.concat(GV), (L) => { const ln = R.line(E.compile(L), rules(L.tag), L.win[L.tag]); return V3.rules.hold === 5 && ln.peak <= 5 ? null : "peak " + ln.peak; }));
  const BK = X.LC.bake; gate("longest tap <= " + BK.maxWaitMs / 1000 + " s, <= " + BK.maxTaps + " taps", each(LV.concat(GV), (L) => { const g = L.grade[L.tag]; return g.maxWait <= BK.maxWaitMs && L.win[L.tag].length <= BK.maxTaps ? null : "wait " + g.maxWait + ", taps " + L.win[L.tag].length; }));
  const pr = X.P.pace.range, paces = LV.map((L) => (L.grade[L.tag].pace || {}).ms), pm = med(paces);
  gate("real pace " + pr.map((v) => v / 1000).join("-") + " s (side quests " + BK.sidePace.range.map((v) => v / 1000).join("-") + " s)", each(LV, (L) => { const p = L.grade[L.tag].pace; return p && !p.fell && p.ms >= pr[0] && p.ms <= pr[1] ? null : "pace " + (p ? Math.round(p.ms / 1000) + " s" + (p.fell ? " (lost)" : "") : "-"); }).concat(each(GV, (L) => { const p = L.grade[L.tag].pace; return p && !p.fell && p.ms >= BK.sidePace.range[0] && p.ms <= BK.sidePace.range[1] ? null : "pace " + (p ? Math.round(p.ms / 1000) : "-"); })));
  gate("the land's median real pace in " + X.LC.checks.paceMedian.map((v) => v / 1000).join("-") + " s", pm >= X.LC.checks.paceMedian[0] && pm <= X.LC.checks.paceMedian[1] ? [] : ["median " + Math.round(pm / 1000) + " s"], "median " + Math.round(pm / 1000) + " s");
  gate("no fallback picks (band, pace, taps, wait, fast tapper, pairs, lookahead)", LV.concat(GV).filter((L) => L.fallback).map((L) => L.id + ": " + L.fallback));
  gate("the profile: tags, density, runs, the end (land-plan planCheck)", LP.planCheck(LV, X.land, X.P, X.CFG.v5.density, X.LCF.perLand));
  gate("shading: every shade colour on its floors (" + C.shade.floor + " from other squads, " + C.shade.fadedFloor + " from faded cards)", each(LV.concat(GV).filter((L) => L.shade), (L) => { const r = SH.checkLevel(L, C); return r.ok ? null : r.bad.join("; "); }));
  // Organic moats: water and path only off the picture's subject (worked out again from the converted board), every
  // block reachable from the frame once dug, 1 or 2 ways in (the bake's count); none in a land without moats.
  const MC = X.LC.plan.moat, hasMoat = (X.land.features || []).indexOf("moat") >= 0, BD = readJ(path.join(X.S, "boards.json")), ringOf = {}, moatBad = [];
  LV.forEach((L, i) => { const B = BD.main[i].board, wet = [], dug = []; for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) { const v = L.grid[y][x]; if ((v === "~" || v === ",") && B.grid[y][x] !== v) (v === "~" ? wet : dug).push(y * L.w + x); }
    if (!wet.length && !dug.length) return; if (!hasMoat) { moatBad.push(L.id + ": water or path in a land without moats"); return; }
    const S = MO.subjectOf(B, MC), f = path.join(X.S, "bake", "m-" + L.n + ".json"), r = fs.existsSync(f) ? readJ(f).moat : null; ringOf[L.n] = Object.assign({ water: wet.length }, r || {});
    if (!S.sub || wet.concat(dug).some((c) => S.sub[c])) moatBad.push(L.id + ": water or path on the subject"); if (!MO.reach(L)) moatBad.push(L.id + ": a block shut in by water"); if (!r || r.ways < 1 || r.ways > 2) moatBad.push(L.id + ": " + (r ? r.ways : "no") + " openings"); });
  gate("organic moats: water and path only off the subject, every block reachable from the frame once dug, 1 or 2 ways in", moatBad, hasMoat ? Object.keys(ringOf).length + " of " + LV.length + " levels ringed" + (X.state.moat ? ", " + X.state.moat.filter((m) => !m.ok).length + " pictures can't carry one" : "") : "no moats in this land");
  const qa = GV.map((g) => g.quest.after).sort((a, b) => a - b), gaps = qa.slice(1).map((a, i) => a - qa[i]), QC = X.LC.checks.quests;
  const slots = Q.landQuestsOf({ from: X.from, to: X.to }, X.CFG.gallery.quests, X.CFG.meta.powers, X.gal0, 1e9).length;
  gate("side quests every " + QC.join("-") + " levels, inside the land, plain picture boards (" + GV.length + " of " + slots + " slots filled from the Wandering Gallery)", (GV.length < slots ? ["only " + GV.length + " of " + slots + " side quests: the Wandering Gallery is short"] : []).concat(gaps.some((g) => g < QC[0] || g > QC[1]) || qa[0] < X.from || qa[qa.length - 1] > X.to ? ["afters " + qa.join(",")] : []).concat(each(GV, (L) => (L.links || L.lock || L.hidden || L.grid.some((r) => r.indexOf("~") >= 0) || L.cols.some((c) => c.some((cd) => cd[2])) ? "not a plain board" : null))));
  const rg = regrade(LV, BC, V3, false), rs = regrade(GV, GB, V3, false); gate("re-grade with the grader's own counts: 0 differences (" + (rg.checks + rs.checks) + " checks)", rg.lines.concat(rs.lines));
  // The map: a spot each, the sheets alternating file and mirror, 48 CSS px between nodes at 375 px.
  const S = LJ.layout, k375 = 375 / X.layout.w, mapBad = [], ns = S.flatMap((s) => s.levels.map((p) => p.n));
  if (ns.join() !== LV.map((L) => L.n).join()) mapBad.push("level spots " + ns.length + " for " + LV.length + " levels");
  if (S.flatMap((s) => s.quests.map((q) => q.id)).join() !== GV.map((g) => g.id).join()) mapBad.push("side quest spots");
  S.forEach((s, e) => { if (s.file !== X.land.map.files[e % 2] || !!s.mirror !== (Math.floor(e / 2) % 2 === 1)) mapBad.push("sheet " + s.sheet + " out of turn");
    const L2 = JN.mirrorSheet(s, X.layout.w), pts = L2.levels.map((p) => [p.x, p.y, "level " + p.n]).concat(L2.quests.map((q) => [q.x, q.y, "quest " + q.q]), L2.eggs.map((g) => [g.x, g.y, "egg"]));
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) * k375; if (d < 48) mapBad.push("sheet " + s.sheet + ": " + pts[i][2] + " and " + pts[j][2] + " " + d.toFixed(0) + " px apart"); }
    for (const g of s.eggs) if (JN.EGG_KINDS.indexOf(g.kind) < 0) mapBad.push("egg kind " + g.kind); });
  for (const f of X.land.map.files) if (!fs.existsSync(path.join(X.LAND, "map", f))) mapBad.push("sheet file map/" + f + " missing");
  gate("the map: a spot for every level and side quest, sheets alternating file and mirror, nodes 48 CSS px apart at 375 px", mapBad);
  gate("a licence and a source for every picture", main.concat(side).filter((p) => !p.licence || !p.url).map((p) => p.id));
  const ok = gates.every((g) => g.ok), sh = LP.sharesOf(LV);
  const rows = ["# Land " + X.land.k + ": " + X.land.name + " (levels " + X.from + "-" + X.to + ")", "", "Made by `tools/land.js` on " + new Date().toISOString().slice(0, 10) + ". " + (ok ? "**Every gate passes.**" : "**Gates failing: " + gates.filter((g) => !g.ok).length + ".**"), "",
    "## Gates", "", "| Gate | | Detail |", "|---|---|---|"].concat(gates.map((g) => "| " + g.name + " | " + (g.ok ? "pass" : "FAIL") + " | " + (g.ok ? g.info : g.bad.slice(0, 6).join("; ") + (g.bad.length > 6 ? " (+" + (g.bad.length - 6) + ")" : "")) + " |"),
    ["", "## Profile reached", "", "Shares of the land's levels: " + Object.entries(sh).map(([k, v]) => k + " " + v).join(", ") + ". Targets: tags " + JSON.stringify(X.P.tags.shares) + "; features " + Object.entries(X.P.features).map(([k, v]) => k + " " + v.share).join(", ") + ".", "",
      "## Levels", "", "| Level | Picture | Board | Colours | Shades | Tag | Features | Rate (band) | Lookahead | Real pace | Longest tap | Taps | Note |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|"],
    LV.map((L) => { const g = L.grade[L.tag]; return "| " + L.n + " | " + L.title + " | " + L.w + "x" + L.h + " | " + L.convert.colours + " | " + (L.shade ? Object.values(L.pal).reduce((a, p) => a + (p.sh || []).filter(Boolean).length, 0) : "-") + " | " + L.tag + " | " + (L.feats.join(", ") || "-") + (ringOf[L.n] ? " (ring " + ringOf[L.n].water + ", " + ringOf[L.n].ways + " way" + (ringOf[L.n].ways === 1 ? "" : "s") + (ringOf[L.n].liquid ? ", " + ringOf[L.n].liquid : "") + ")" : "") + (L.cant ? " (no moat: can't carry one)" : "") + (L.cols.flat().filter((c) => c[2]).length ? " (" + L.cols.flat().filter((c) => c[2]).length + " ?)" : "") + " | " + (100 * g.rate).toFixed(1) + "% (" + L.target.map((v) => 100 * v).join("-") + ") | " + g.greedy + " | " + Math.round(g.pace.ms / 1000) + " s | " + (g.maxWait / 1000).toFixed(1) + " s | " + L.win[L.tag].length + " | " + (L.fallback || "") + " |"; }),
    ["", "## Side quests (the Wandering Gallery)", "", "| Picture | Title | After level | Prize | Tag | Real pace | Taps |", "|---|---|---|---|---|---|---|"],
    GV.map((L) => "| " + L.n + " | " + L.title + " | " + L.quest.after + " | " + L.quest.prize + " | " + L.tag + " | " + Math.round(L.grade[L.tag].pace.ms / 1000) + " s | " + L.win[L.tag].length + " |"));
  fs.writeFileSync(path.join(X.S, "report.md"), rows.join("\n") + "\n"); saveState(X, { ok, checked: new Date().toISOString() });
  for (const g of gates) console.log((g.ok ? "  pass  " : "  FAIL  ") + g.name + (g.ok ? (g.info ? " (" + g.info + ")" : "") : ": " + g.bad.slice(0, 3).join("; ")));
  console.log("check: " + (ok ? "PASS" : "FAIL") + " (scratch/report.md)"); return ok;
}

// ---- install ----------------------------------------------------------------------------------------------------------------
// Text-insert into config.json so its hand layout stays: the land into lands.list, a row per new sheet into map.eggCoins.
function addToConfig(text, entry, rows) {
  const close = (t, at) => { let d = 0; for (let i = at; i < t.length; i++) { if (t[i] === "[") d++; else if (t[i] === "]" && !--d) return i; } throw new Error("config: unbalanced list"); };
  const li = text.indexOf('"list": [', text.indexOf('"lands": {')); if (li < 0) throw new Error("config: no lands.list");
  const lo = li + '"list": '.length, lc = close(text, lo), empty = !text.slice(lo + 1, lc).trim();
  let t = text.slice(0, lc) + (empty ? "\n      " : ",\n      ") + JSON.stringify(entry) + text.slice(lc);
  const ei = t.indexOf('"eggCoins": ['); if (ei < 0) throw new Error("config: no map.eggCoins"); const ec = close(t, ei + '"eggCoins": '.length);
  t = t.slice(0, ec) + rows.map((r) => ", " + JSON.stringify(r)).join("") + t.slice(ec);
  JSON.parse(t); return t;
}
function install(X) {
  const st = X.state; if (!st.ok) throw new Error("install: the land has no passing check (run the check step)");
  const out = path.join(X.S, "out"), LV = readJ(path.join(out, "levels.json")), GV = readJ(path.join(out, "gallery.json")), LJ = readJ(path.join(out, "land.json")), G = X.GAME;
  if ((X.LCF.list || []).some((d) => d.k === X.land.k)) throw new Error("install: land " + X.land.k + " is already in the game");
  if (X.levels.levels[X.levels.levels.length - 1].n !== X.from - 1 || X.layout.sheets.length !== X.sheet0 - 1 || X.gallery.levels.length !== X.gal0) throw new Error("install: the game moved on since this land was planned (levels, sheets or pictures); plan it again with --force");
  const lv = Object.assign({}, X.levels, { levels: X.levels.levels.concat(LV) }), gl = Object.assign({}, X.gallery, { levels: X.gallery.levels.concat(GV) }), lay = Object.assign({}, X.layout, { sheets: X.layout.sheets.concat(LJ.layout) });
  const cfg = addToConfig(fs.readFileSync(path.join(G, "config.json"), "utf8"), LJ.entry, LJ.eggCoins), lic = fs.readFileSync(path.join(G, "LICENSES.md"), "utf8") + fs.readFileSync(path.join(out, "licences.md"), "utf8");
  const writes = [["levels/levels.json", JSON.stringify(lv)], ["levels/gallery.json", JSON.stringify(gl)], ["map/layout.json", JSON.stringify(lay)], ["config.json", cfg], ["LICENSES.md", lic]];
  for (const [f, t] of writes) fs.writeFileSync(path.join(G, f + ".tmp"), t);
  for (const f of X.land.map.files) fs.copyFileSync(path.join(X.LAND, "map", f), path.join(G, "map", f));
  for (const [f] of writes) fs.renameSync(path.join(G, f + ".tmp"), path.join(G, f));
  console.log("install: land " + X.land.k + " (" + X.land.name + ", levels " + X.from + "-" + X.to + ", " + GV.length + " side quests, sheets " + LJ.entry.sheets.join("-") + ") written into " + G);
}

// ---- main -------------------------------------------------------------------------------------------------------------------
if (require.main === module) {
  (async () => {
    const dir = argv[0]; if (!dir || dir.startsWith("--")) { console.log("usage: node tools/land.js LAND_DIR [prep|convert|sheet|bake|map|assemble|check|install ...] [--game DIR] [--gallery DIR] [--threads N] [--only A-B] [--extra K] [--force]"); process.exitCode = 2; return; }
    const asked = argv.slice(1).filter((a, i, A) => !a.startsWith("--") && !(i > 0 && A[i - 1].startsWith("--") && ["game", "gallery", "threads", "only", "list", "extra"].indexOf(A[i - 1].slice(2)) >= 0));
    const steps = asked.length ? asked : STEPS; let X = context(dir); fs.mkdirSync(X.S, { recursive: true }); saveState(X);
    try {
      for (const s of steps) {
        console.log("== " + s); X = context(dir);
        if (s === "prep") prep(X); else if (s === "convert") convert(X); else if (s === "sheet") sheet(X); else if (s === "bake") await bake(X); else if (s === "map") map(X);
        else if (s === "assemble") { const bad = assemble(X); if (bad.length) { process.exitCode = 1; break; } } else if (s === "check") { if (!check(X)) process.exitCode = 1; } else if (s === "install") install(X);
        else throw new Error("no step " + s);
      }
    } catch (e) { console.log("land: " + e.message); process.exitCode = 1; }
  })();
}
module.exports = { context, picturesOf, boardOf, templatesOf, addToConfig };
