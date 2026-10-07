// Sapper's Path campaign v6 (lane A): the on-theme side quests (game-research/sappers-path-v4/v6-plan.md Step 0; SPEC-v4 §9
// "Campaign v6: the on-theme side quests"; notes tools/campaign-v6-notes.md §4). The campaign's 50 side quests become the 24
// kept castle pictures (their stored levels kept) and 26 new outlined pictures (lane C, game-research/sappers-path-v4/lands/
// campaign-quests), laid out by tools/campaign-quests/quests.json. The 36 that leave (Zen World 1) and the Wandering
// Gallery's 12 (Kitten Forest's side quests) are not baked here: the 36 leave levels/gallery.json, the 12 keep their records
// (n 61-72 too) in places 51-62 behind the 50, and their map spots' q follow the places.
//   ~/.local/opt/node/bin/node tools/quest-bake.js [STEP ...] [--only cq01,cq02] [--extra K] [--threads N] [--force]
// Steps (default prep convert bake check; install is never part of the default run):
//   prep     the 160 px sources (tools/land-src.py, kind outlined) from quests.json raw -> tools/campaign-quests/src/
//   convert  each new picture through tools/land.js boardOf (the max phone box, gallery-config convert.kinds.outlined,
//            shaded) -> scratch/boards.json, and whether it can carry an organic moat (tools/moat.js, the gentlest set)
//   bake     each new quest's plan (planOf: its tag and the features its slot allows) and its level (tools/land-bake.js
//            bakeOne, side quest counts: gallery-config bake's grader, so tools/regrade.js --gallery re-grades it) ->
//            scratch/bake/<pic>.json
//   install  writes the 50 into the game: levels/gallery.json (the 50, then the Wandering Gallery renumbered), the map's
//            quest ids (map/layout.json, quests 1-50; the Wandering Gallery's q renumbered with their pictures), the
//            manifest (levels/gallery-manifest.json order and the 26 lines) and the LICENSES.md section
//   check    every gate on the game's files (also run by tools/test.js): below
// The gates: 50 castle quests, the 24 kept and their stored levels byte for byte (but n and quest), 26 new ids never used
// before; no two neighbours share a theme group, kept and new interleaved, the Goblin King's Hoard last; quest {after, prize}
// as tools/quests.js deals them and the map's spots agree; every level compiles clean, wins on its tag with its stored
// order and no power-up, at most 5 spaces, longest tap and taps under the caps, real pace in range, no fallback, no towers;
// a new quest's features within its slot's ladder and its tag's density and as planned; shading on its floors; organic
// moats off the subject with every block reachable; the regrade 0 differences; a manifest and LICENSES.md line each.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const E = require("../src/engine.js");
const R = require("./grade.js");
const SH = require("./shade.js");
const MO = require("./moat.js");
const TG = require("./tags.js");
const Q = require("./quests.js");
const LB = require("./land-bake.js");
const LND = require("./land.js");
const { regrade } = require("./regrade.js");

const ROOT = path.join(__dirname, ".."), DIR = path.join(__dirname, "campaign-quests"), S = path.join(DIR, "scratch");
const argv = process.argv.slice(2), flag = (k) => argv.indexOf("--" + k) >= 0, opt = (k) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : null; };
const readJ = (f) => JSON.parse(fs.readFileSync(f, "utf8")), writeJ = (f, o, pretty) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify(o, null, pretty ? 1 : 0) + (pretty ? "\n" : "")); fs.renameSync(t, f); };
const med = (a) => { const q = a.slice().sort((x, y) => x - y); return q.length ? q[(q.length - 1) >> 1] : null; };
const RANK = { easy: 0, normal: 1, hard: 2 };

// The context: quests.json, the new pictures, the game's config and the land factory's config.
function context() {
  const QJ = readJ(path.join(DIR, "quests.json")), man = readJ(path.join(DIR, "pictures/manifest.json")), CFG = readJ(path.join(ROOT, "config.json")), LC = require("./land-config.json");
  const slots = Q.questsOf(QJ.order.length, CFG.gallery.quests, CFG.meta.powers), pics = QJ.order.map((o, i) => Object.assign({ pos: i + 1 }, o, slots[i])).filter((o) => o.pic);
  pics.forEach((p, k) => { p.k = k; }); for (const p of pics) { p.m = man.find((m) => m.id === p.pic); if (!p.m) throw new Error("picture " + p.pic + " is not in pictures/manifest.json"); p.num = QJ.seedBase + +p.pic.replace(/\D/g, ""); }
  return { QJ, man, CFG, LC, slots, pics };
}
// A quest's band: the last of quests.json bands[tag] whose from is at or under its main level.
const bandOf = (QJ, tag, after) => (QJ.bands[tag] || []).filter((b) => after >= b[0]).slice(-1)[0][1];
// A new quest's plan (land-bake's shape: {feats, mystery, links, hidden, lock, moat, tag}): the features its slot's ladder
// allows (after >= ladder[f]) from its tag's deck, up to its tag's density; the moat first when the picture can carry it; a Normal quest then the
// unlocked deck features in turn by its count among the new quests (k), a Hard one the newest first; the lock (colour) on a Hard quest from ladder.lock.
function planOf(QJ, p, canMoat) {
  const L = QJ.ladder, D = QJ.density[p.tag], A = QJ.amounts, P = { feats: [], mystery: 0, links: 0, hidden: 0, lock: false, tag: p.tag };
  if (canMoat && p.after >= L.moat && P.feats.length < D.max) { P.feats.push("moat"); P.moat = A.moat[p.tag]; }
  const deck = (QJ.deck[p.tag] || []).filter((f) => p.after >= L[f]), turn = p.tag === "hard" ? deck.slice().reverse() : deck.map((f, i) => deck[(i + p.k) % deck.length]);
  for (const f of turn) { if (P.feats.length >= D.max) break; P.feats.push(f); if (f === "linked") P.links = A.linked[p.tag]; if (f === "mystery") P.mystery = A.mystery[p.tag]; if (f === "hidden") P.hidden = A.hidden[p.tag]; }
  if (D.lock && p.after >= L.lock) P.lock = "colour";
  return P;
}

// ---- prep, convert -----------------------------------------------------------------------------------------------------------
function prep(X) {
  const tmp = path.join(S, "tmp-manifest.json"), py = process.env.LAND_PYTHON || "python3"; writeJ(tmp, X.man);
  console.log(execFileSync(py, [path.join(__dirname, "land-src.py"), X.QJ.raw, tmp, path.join(DIR, "src")].concat(X.pics.map((p) => p.pic)), { encoding: "utf8" }).trim());
}
function convert(X) {
  const f = path.join(S, "boards.json"); if (fs.existsSync(f) && !flag("force")) { console.log("convert: kept scratch/boards.json"); return; }
  const MC = X.LC.plan.moat, LQ = X.LC.profile.features.moat.liquids, out = {}, t0 = Date.now();
  for (const p of X.pics) { const b = LND.boardOf({ LC: X.LC }, p.m, path.join(DIR, "src"), true), Rg = MO.ringOf(b, MC, MC.ways[0], 0, null, LQ); out[p.pic] = { board: b, moat: { can: !!Rg.cells, why: Rg.cells ? null : Rg.why, water: Rg.cells ? Rg.cells.length : 0, liquid: Rg.liquid || null } }; }
  writeJ(f, out); console.log("convert: " + X.pics.length + " pictures in " + ((Date.now() - t0) / 1000).toFixed(1) + " s; " + X.pics.filter((p) => out[p.pic].moat.can).length + " can carry a moat");
}

// ---- bake --------------------------------------------------------------------------------------------------------------------
async function bake(X) {
  const BD = readJ(path.join(S, "boards.json")), only = opt("only") ? opt("only").split(",") : null, jobs = [], LQ = X.LC.profile.features.moat.liquids;
  for (const p of X.pics) { const f = path.join(S, "bake", p.pic + ".json"); if (only ? only.indexOf(p.pic) < 0 : fs.existsSync(f) && !flag("force")) continue;
    const plan = planOf(X.QJ, p, BD[p.pic].moat.can);
    jobs.push({ file: f, p, job: { n: p.num, side: true, tag: p.tag, plan, band: bandOf(X.QJ, p.tag, p.after), look: null, pace: X.QJ.pace, board: BD[p.pic].board, extra: +opt("extra") || 0, liquids: LQ, moatLo: 0 } }); }
  if (!jobs.length) { console.log("bake: every quest kept (scratch/bake)"); return; }
  const LCF = path.join(S, "land-config.json"); writeJ(LCF, require("./land-plan.js").merge(X.LC, X.QJ.landConfig || {}), true); process.env.LAND_CONFIG = LCF; // quests.json landConfig over land-config.json, in every worker
  const threads = +opt("threads") || X.QJ.threads || LB.threadsOf(X.LC.bake), t0 = Date.now(); console.log("bake: " + jobs.length + " quests on " + threads + " threads");
  const res = await LB.runPool(jobs.map((j) => j.job), threads, Date.now() + X.LC.bake.budget.wallSec * 1000, (d, t) => console.log("  " + d + "/" + t + "  " + ((Date.now() - t0) / 1000).toFixed(0) + " s"));
  res.forEach((r, i) => { const j = jobs[i]; writeJ(j.file, Object.assign({ pic: j.p.pic, pos: j.p.pos, after: j.p.after }, r)); const g = r.level && r.level.grade[r.tag];
    console.log("  " + j.p.pos + " " + j.p.pic + " " + j.job.tag + " [" + j.job.plan.feats.join(",") + (j.job.plan.lock ? ",lock" : "") + "]: " + (r.fail ? "FAIL " + r.fail : (r.fallback ? "fallback (" + r.fallback + ")" : "ok") + ", rate " + g.rate + " in " + j.job.band.join("-") + ", " + Math.round(g.pace.ms / 1000) + " s, " + r.level.win[r.tag].length + " taps")); });
  console.log("bake: " + ((Date.now() - t0) / 1000).toFixed(0) + " s");
}

// ---- install -----------------------------------------------------------------------------------------------------------------
// A new quest's record (land.js assemble's side-quest record with the main levels' feature fields).
function recordOf(X, p, B, r) {
  const L = r.level, m = p.m, dry = (shade) => shade.map((row, y) => row.split("").map((d, x) => (L.grid[y][x] !== B.grid[y][x] ? "0" : d)).join(""));
  return Object.assign({ id: "g-ours-" + p.pic, n: p.pos, gallery: true, title: m.title }, m.short ? { short: m.short } : {}, { kind: "outlined", src: "ours-" + p.pic, credit: m.artist, tag: r.tag, band: r.tag, target: bandOf(X.QJ, r.tag, p.after), seed: r.seed,
    w: L.w, h: L.h, grid: L.grid, pic: true, pal: B.pal }, L.liquid ? { liquid: L.liquid } : {}, B.shade ? { shade: dry(B.shade) } : {}, L.hidden ? { hidden: L.hidden } : {}, L.hidden ? (({ c, q }) => ({ hideC: c, hideQ: q }))(LND.fillOf(B.pal, X.LC.plan.hidden)) : {},
    L.lock ? { lock: L.lock } : {}, { cols: L.cols }, L.links ? { links: L.links } : {}, { win: L.win, grade: L.grade, inBand: r.inBand, convert: B.stats, feats: r.plan.feats.concat(r.plan.lock ? ["lock"] : []), group: p.group, quest: { after: p.after, prize: p.prize } },
    r.mystery ? { mystery: r.mystery } : {}, r.moat ? { moat: r.moat } : {}, r.fallback ? { fallback: r.fallback } : {});
}
function install(X) {
  const BD = readJ(path.join(S, "boards.json")), GF = readJ(path.join(ROOT, "levels/gallery.json")), was = new Map(GF.levels.map((l) => [l.id, l])), bad = [];
  const castle = X.QJ.order.map((o, i) => { const s = X.slots[i];
    if (o.id) { const l = was.get(o.id); if (!l) { bad.push(o.id + " is not in levels/gallery.json"); return null; } return Object.assign({}, l, { n: i + 1, quest: { after: s.after, prize: s.prize } }); }
    const p = X.pics.find((q) => q.pos === i + 1), f = path.join(S, "bake", p.pic + ".json"), r = fs.existsSync(f) ? readJ(f) : null;
    if (!r || r.fail) { bad.push(p.pic + ": " + (r ? r.fail : "not baked")); return null; } return recordOf(X, p, BD[p.pic].board, r); });
  if (bad.length) { console.log("install: refused: " + bad.join("; ")); return false; }
  const wander = GF.levels.filter((l) => l.wander), levels = castle.concat(wander), renum = new Map(wander.map((l, k) => [GF.levels.indexOf(l) + 1, castle.length + k + 1])); // the Wandering Gallery's records untouched (their n too: land-config sideCycle and the critic read it); only their place in the file moves
  // The map: quests 1-50 keep their spots and slots (the same after and prize), now holding these pictures; the Wandering
  // Gallery's spots follow their pictures' new places in the file (the page finds a quest's picture by place, app.gal[q - 1]).
  const LAY = readJ(path.join(ROOT, "map/layout.json")); let qi = 0;
  for (const sh of LAY.sheets) for (const q of sh.quests || []) { if (sh.land) { q.q = renum.get(q.q) || q.q; continue; } const l = levels[q.q - 1]; if (!l || l.wander || q.after !== l.quest.after || q.prize !== l.quest.prize) { bad.push("map quest " + q.q); continue; } q.id = l.id; qi++; }
  if (bad.length || qi !== castle.length) { console.log("install: refused: the map's quests " + qi + " of " + castle.length + (bad.length ? "; " + bad.join("; ") : "")); return false; }
  // The manifest: the order is the 50; the new pictures' lines (kind outlined, the bake's source).
  const MAN = readJ(path.join(ROOT, "levels/gallery-manifest.json")), have = new Set(MAN.pictures.map((p) => p.id));
  for (const p of X.pics) if (!have.has("ours-" + p.pic)) MAN.pictures.push({ id: "ours-" + p.pic, title: p.m.title, kind: "outlined", set: "Click it! Studios (generated locally)", author: p.m.artist, license: p.m.licence, model: p.m.model, prompt: p.m.prompt, seed: p.m.seed, size: p.m.size, steps: 4, guidance: 0, generated: p.m.date, raw: p.m.file, file: "tools/campaign-quests/src/" + p.pic + ".png", bake: "tools/quest-bake.js", group: p.group });
  MAN.order = castle.map((l) => l.src);
  // LICENSES.md: one section for the new pictures (replaced whole on a re-install).
  const LF = path.join(ROOT, "LICENSES.md"), A = "<!-- campaign-quests:start -->", Z = "<!-- campaign-quests:end -->"; let lic = fs.readFileSync(LF, "utf8");
  const sec = [A, "### Campaign v6 side quests: 26 new pictures (2026-10-06)", "", "The campaign's side quests from v6 (`levels/gallery.json` pictures 1-50; the numbers in the Gallery table above are the v5 places). 24 of the pictures above stay; these 26 are new. Generated on the studio's own Mac with FLUX.1 [schnell] by Black Forest Labs (Apache 2.0; city96's 4-bit GGUF), cleaned of the model's line art and converted with one solid ink outline. Original work, Click it! Studios. Every prompt and seed is in `tools/campaign-quests/pictures/manifest.json` and `levels/gallery-manifest.json`.", "",
    "| # | Picture | Source | Author | License | Date |", "|---|---|---|---|---|---|"].concat(X.pics.map((p) => "| " + p.pos + " | `ours-" + p.pic + "` " + p.m.title + " | Generated locally with FLUX.1 [schnell] (4-bit GGUF), seed " + p.m.seed + "; prompt in tools/campaign-quests/pictures/manifest.json | " + p.m.artist + " | " + p.m.licence + " | generated " + p.m.date + " |"), [Z]).join("\n");
  lic = lic.indexOf(A) >= 0 ? lic.slice(0, lic.indexOf(A)) + sec + lic.slice(lic.indexOf(Z) + Z.length) : lic.replace(/\n### Land 1:/, "\n" + sec + "\n\n### Land 1:");
  writeJ(path.join(ROOT, "levels/gallery.json"), Object.assign({}, GF, { levels }));
  fs.writeFileSync(path.join(ROOT, "map/layout.json"), JSON.stringify(LAY)); writeJ(path.join(ROOT, "levels/gallery-manifest.json"), MAN, true); fs.writeFileSync(LF, lic);
  console.log("install: " + castle.length + " campaign quests (" + X.pics.length + " new) and " + wander.length + " Wandering Gallery pictures (now in places " + (castle.length + 1) + "-" + levels.length + ", records unchanged) written");
  return true;
}

// ---- check (the game's files) ------------------------------------------------------------------------------------------------
// gates(X?) -> [{name, ok, bad, info}]; tools/test.js runs it too.
function gates(X0) {
  const X = X0 || context(), GL = readJ(path.join(ROOT, "levels/gallery.json")).levels, C = GL.filter((l) => !l.land), out = [], gate = (name, bad, info) => out.push({ name, ok: !bad.length, bad, info: info || "" });
  const V3 = X.CFG.v3, rules = (t) => E.rulesOf(V3, t), GC = require("./gallery-config.json"), GB = GC.bake, each = (ls, f) => ls.map((L) => { try { const w = f(L); return w ? L.id + ": " + w : null; } catch (e) { return L.id + ": " + e.message; } }).filter(Boolean);
  const FZ = path.join(ROOT, X.CFG.v5.freeze.dir, "gallery.json"), old = fs.existsSync(FZ) ? new Map(readJ(FZ).levels.map((l) => [l.id, l])) : new Map(), strip = (l) => JSON.stringify(Object.assign({}, l, { n: 0, quest: 0 }));
  const kept = X.QJ.order.filter((o) => o.id).map((o) => o.id), fresh = C.filter((l) => kept.indexOf(l.id) < 0);
  gate("50 campaign quests in quests.json's order: the 24 kept with their stored levels (all but n and quest), 26 new ids never used before", (C.length === X.QJ.order.length ? [] : ["count " + C.length]).concat(C.map((l, i) => { const o = X.QJ.order[i]; return !o ? "extra " + l.id : l.n !== i + 1 ? l.id + " is n " + l.n : o.id ? (l.id !== o.id ? "place " + (i + 1) + " is " + l.id : old.has(l.id) && strip(old.get(l.id)) !== strip(l) ? l.id + " level changed" : null) : l.id !== "g-ours-" + o.pic || old.has(l.id) || l.src !== "ours-" + o.pic ? "place " + (i + 1) + " is " + l.id : null; }).filter(Boolean)), kept.length + " kept, " + fresh.length + " new");
  const grp = X.QJ.order.map((o) => o.group), nb = grp.map((g, i) => (i && g === grp[i - 1] ? i + "-" + (i + 1) + " " + g : null)).filter(Boolean), runs = []; let run = 0; X.QJ.order.forEach((o) => { run = o.id ? 0 : run + 1; runs.push(run); });
  gate("variety: no two neighbours of one theme group, kept and new interleaved (never 4 new in a row), the Goblin King's Hoard last", nb.concat(Math.max(...runs) > 3 ? ["a run of " + Math.max(...runs) + " new"] : [], C.length && C[C.length - 1].id !== "g-ours-g24" ? ["last is " + C[C.length - 1].id] : []), Object.entries(grp.reduce((a, g) => ((a[g] = (a[g] | 0) + 1), a), {})).map(([g, k]) => g + " " + k).join(", "));
  const QS = Q.questsOf(C.length, X.CFG.gallery.quests, X.CFG.meta.powers), LAY = readJ(path.join(ROOT, "map/layout.json")), qv = LAY.sheets.filter((s) => !s.land).flatMap((s) => s.quests);
  gate("quests: {after, prize} as tools/quests.js deals them (4-200, every 3-5 levels; prizes by unlock), the map's spots 1-" + C.length + " agree, the Wandering Gallery's spots follow their pictures", C.map((l, i) => (JSON.stringify(l.quest) !== JSON.stringify(QS[i]) ? l.id + " quest " + JSON.stringify(l.quest) : null)).filter(Boolean).concat(JSON.stringify(qv.map((q) => [q.q, q.id, q.after, q.prize])) !== JSON.stringify(C.map((l, i) => [i + 1, l.id, l.quest.after, l.quest.prize])) ? ["map quests"] : [], LAY.sheets.filter((s) => s.land).flatMap((s) => s.quests).filter((q) => !GL[q.q - 1] || GL[q.q - 1].id !== q.id).map((q) => "wander spot " + q.q)),
    "after " + C[0].quest.after + "-" + C[C.length - 1].quest.after + "; prizes " + ["ladder", "quartermaster", "recall", "scout", "volley"].map((k) => k + " " + C.filter((l) => l.quest.prize === k).length).join(", "));
  gate("every quest compiles clean and wins on its tag with its stored order, no power-up, at most 5 spaces", each(C, (L) => { const B = E.compile(L), w = E.check(L); if (w.length) return w.join(", "); if (E.replay(B, rules(L.tag), L.win[L.tag] || "").status !== E.WON || rules(L.tag).powers) return "does not win"; const ln = R.line(B, rules(L.tag), L.win[L.tag]); return V3.rules.hold === 5 && ln.peak <= 5 ? null : "peak " + ln.peak; }));
  const paces = C.map((L) => (L.grade[L.tag].pace || {}).ms), pr = X.QJ.pace.range;
  gate("longest tap <= " + GB.maxWaitMs / 1000 + " s, <= " + GB.maxTaps + " taps, real pace " + pr.map((v) => v / 1000).join("-") + " s, no fallback, no towers", each(C, (L) => { const g = L.grade[L.tag], p = g.pace; return g.maxWait > GB.maxWaitMs ? "wait " + g.maxWait : L.win[L.tag].length > GB.maxTaps ? "taps " + L.win[L.tag].length : !p || p.fell || p.ms < pr[0] || p.ms > pr[1] ? "pace " + (p ? p.ms : "-") : L.fallback ? L.fallback : (L.towers && L.towers.length) || L.archers ? "towers" : null; }),
    "median " + Math.round(med(paces) / 1000) + " s (" + Math.round(Math.min(...paces) / 1000) + "-" + Math.round(Math.max(...paces) / 1000) + " s), taps " + Math.min(...C.map((L) => L.win[L.tag].length)) + "-" + Math.max(...C.map((L) => L.win[L.tag].length)));
  // A new quest: its tag as planned, in its band, and features only from its slot's ladder, within its tag's density, as its plan says.
  const L5 = X.QJ.ladder, rank = (L) => RANK[L.tag];
  gate("new quests: tags as planned, in band, features only from the ladder at their slot (moat " + L5.moat + ", lock " + L5.lock + ", linked " + L5.linked + ", ? cards " + L5.mystery + ", mystery blocks " + L5.hidden + ") and within their tag's density", each(fresh, (L) => { const o = X.QJ.order[L.n - 1], f = TG.featuresOf(L), D = X.QJ.density[L.tag], lock = !!L.lock;
    if (L.tag !== o.tag) return "tag " + L.tag; const g = L.grade[L.tag].rate; if (g < L.target[0] || g > L.target[1]) return "rate " + g + " out of " + L.target; if (f.some((k) => L.quest.after < L5[k])) return "feature before its ladder [" + f + "]"; if (lock && (!D.lock || L.quest.after < L5.lock)) return "lock";
    if (f.length > D.max) return "density [" + f + "]"; if (f.slice().sort().join() !== L.feats.filter((k) => k !== "lock").sort().join() || lock !== L.feats.indexOf("lock") >= 0) return "features [" + f + "] vs planned [" + L.feats + "]"; return null; }),
    ["easy", "normal", "hard"].map((t) => t + " " + C.filter((l) => l.tag === t).length).join(", ") + " of 50; new: " + ["moat", "linked", "mystery", "hidden", "lock"].map((k) => k + " " + fresh.filter((l) => (l.feats || []).indexOf(k) >= 0).length).join(", "));
  // The boards as converted from the stored sources (tools/land.js boardOf, kind outlined): the shipped grid is that board
  // but for the moat's water and path, which stand only off its subject (tools/moat.js subjectOf), leaving every block
  // reachable once dug, with the 1 or 2 ways in the bake reports.
  const CC = GC.convert, MC = X.LC.plan.moat, man = new Map(X.man.map((m) => [m.id, m]));
  gate("boards as converted from the stored sources; shading on its floors; mystery fills apart from the picture; organic moats only off the subject, every block reachable", each(fresh, (L) => { const m = man.get(L.src.replace(/^ours-/, "")), B = LND.boardOf({ LC: X.LC }, m, path.join(DIR, "src"), true), wet = [];
    if (B.w !== L.w || B.h !== L.h || JSON.stringify(B.pal) !== JSON.stringify(L.pal)) return "board or palette differs from its source's";
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (L.grid[y][x] !== B.grid[y][x]) { if (L.grid[y][x] !== "~" && L.grid[y][x] !== ",") return "cell " + x + "," + y + " differs from its source's board"; wet.push(y * L.w + x); }
    if (L.shade) { const r = SH.checkLevel(L, CC); if (!r.ok) return r.bad.join("; "); }
    if (L.hidden && LND.fillGap(L.hideC, L.pal) < X.LC.plan.hidden.fillDE[1]) return "fill " + L.hideC;
    if (wet.length) { const sub = MO.subjectOf(B, MC).sub; if (!sub || wet.some((c) => sub[c])) return "water or path on the subject"; if (!MO.reach(L)) return "a block shut in by water"; if (!L.moat || L.moat.ways < 1 || L.moat.ways > 2) return "openings " + (L.moat ? L.moat.ways : "-"); }
    return null; }), fresh.filter((L) => L.moat).length + " of " + fresh.length + " ringed (" + fresh.filter((L) => L.liquid === "mire").length + " mire), " + fresh.filter((L) => L.shade).length + " shaded");
  const rg = regrade(C, GB, V3, false); gate("re-grade with the Gallery bake's own counts: 0 differences", rg.lines, rg.checks + " checks");
  const MAN = readJ(path.join(ROOT, "levels/gallery-manifest.json")), LIC = fs.readFileSync(path.join(ROOT, "LICENSES.md"), "utf8");
  gate("a manifest line, a LICENSES.md line and a stored source for every new picture", fresh.map((L) => { const m = MAN.pictures.find((p) => p.id === L.src); return !m || !m.license || !m.prompt || m.seed == null || LIC.indexOf("`" + L.src + "`") < 0 || !fs.existsSync(path.join(ROOT, m.file)) ? L.id : null; }).filter(Boolean));
  return out;
}
function check(X) { const G = gates(X); for (const g of G) console.log((g.ok ? "  pass  " : "  FAIL  ") + g.name + (g.ok ? (g.info ? " (" + g.info + ")" : "") : ": " + g.bad.slice(0, 4).join("; "))); const ok = G.every((g) => g.ok); console.log("check: " + (ok ? "PASS" : "FAIL")); return ok; }

module.exports = { context, planOf, bandOf, gates };
if (require.main === module) {
  (async () => {
    const asked = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["only", "extra", "threads"].indexOf(argv[i - 1].slice(2)) >= 0)), steps = asked.length ? asked : ["prep", "convert", "bake", "check"];
    try { fs.mkdirSync(S, { recursive: true }); for (const s of steps) { console.log("== " + s); const X = context();
        if (s === "prep") prep(X); else if (s === "convert") convert(X); else if (s === "bake") await bake(X); else if (s === "install") { if (!install(X)) { process.exitCode = 1; break; } } else if (s === "check") { if (!check(X)) process.exitCode = 1; } else throw new Error("no step " + s); } }
    catch (e) { console.log("quest-bake: " + e.message); process.exitCode = 1; }
  })();
}
