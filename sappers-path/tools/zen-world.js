// Sapper's Path v6 lane B, Zen mode: a Zen world made from pictures the game already has (World 1, The Gallery: the 36
// castle Gallery pictures Peter moved out of the campaign on 2026-10-06; game-research/sappers-path-v4/v6-plan.md, Step 0).
// Notes: tools/zen-mode-notes.md. A world built from new pictures is a land (tools/land.js, tools/land-runbook.md) and joins
// Zen through levels/zen.json worlds; this tool is for a world whose boards already exist.
//   ~/.local/opt/node/bin/node tools/zen-world.js WORLD_DIR [plan|bake|assemble|check|install ...] [--threads N] [--list N,N] [--extra K] [--force]
// WORLD_DIR/world.json: {k, slug, name, lore, era, features, profile (land-plan profile, merged over land-config's like a
// land's), from: {file: "levels/gallery.json", ids: [...]} (the source records, never edited), pace (optional, the level
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
//   install   (after a passing check) writes the world's levels into levels/zen.json (its other worlds' records kept)
"use strict";
const fs = require("fs");
const path = require("path");
const E = require("../src/engine.js");
const R = require("./grade.js");
const LP = require("./land-plan.js");
const LB = require("./land-bake.js");
const { regrade } = require("./regrade.js");
const { fillGap, fillOf } = require("./land.js");

const ROOT = path.join(__dirname, "..");
const argv = process.argv.slice(2), flag = (k) => argv.indexOf("--" + k) >= 0, opt = (k) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : null; };
const readJ = (f) => JSON.parse(fs.readFileSync(f, "utf8")), writeJ = (f, o, pretty) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify(o, null, pretty ? 1 : 0) + "\n"); fs.renameSync(t, f); };
const med = (a) => { const q = a.slice().sort((x, y) => x - y); return q.length ? q[(q.length - 1) >> 1] : null; };
const INK = require("./convert.js").config().convert.ink;

function context(dir) {
  const W = path.resolve(dir), S = path.join(W, "scratch"), world = readJ(path.join(W, "world.json")), LC = require("./land-config.json"), CFG = readJ(path.join(ROOT, "config.json"));
  const src = readJ(path.join(ROOT, world.from.file)).levels, byId = new Map(src.map((L) => [L.id, L])), P = LP.profileOf(world, LC);
  if (world.pace) P.pace = Object.assign({}, P.pace, world.pace);
  for (const id of world.from.ids) if (!byId.has(id)) throw new Error("source picture " + id + " is not in " + world.from.file);
  const state = fs.existsSync(path.join(S, "state.json")) ? readJ(path.join(S, "state.json")) : {};
  return { W, S, world, LC, CFG, P, byId, count: world.from.ids.length, state };
}
// The source record's board as the land bake takes it: the grid and palette (frame included), the ink and a masked
// picture's background by their colours.
function boardOf(L) {
  const key = (c) => +(Object.keys(L.pal).find((k) => L.pal[k].c === c) || 0);
  return { w: L.w, h: L.h, grid: L.grid, pal: L.pal, ink: key(INK), bg: L.convert && L.convert.bg ? key(L.convert.bg) : 0 };
}

function plan(X) {
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
  const { tags, plan: pl } = X.state, main = X.world.main; if (!tags || !main) throw new Error("bake: run plan first");
  const list = opt("list") ? opt("list").split(",").map(Number) : null, dir = path.join(X.S, "bake"), jobs = [];
  main.forEach((id, i) => { const n = i + 1, f = path.join(dir, "m-" + n + ".json"); if (list ? list.indexOf(n) < 0 : !flag("force") && fs.existsSync(f)) return;
    const t = tags[i]; jobs.push({ file: f, n, job: { n: 1000 * X.world.k + n, tag: t, plan: pl[i], band: X.P.bands[t], look: X.P.lookahead[t] != null ? X.P.lookahead[t] : null, care: null, careTune: null,
      mysRows: (X.P.features.mystery || {}).rows || null, over: X.P.bake || null, obv: null, pace: X.P.pace, board: boardOf(X.byId.get(id)), extra: +opt("extra") || 0 } }); });
  if (!jobs.length) { console.log("bake: every level kept"); return; }
  const threads = +opt("threads") || LB.threadsOf(X.LC.bake), t0 = Date.now(); console.log("bake: " + jobs.length + " levels on " + threads + " threads");
  const res = await LB.runPool(jobs.map((j) => j.job), threads, t0 + X.LC.bake.budget.wallSec * 1000, (d, t) => { if (d % 4 === 0 || d === t) console.log("  " + d + "/" + t + "  " + ((Date.now() - t0) / 1000).toFixed(0) + " s"); });
  res.forEach((r, i) => { writeJ(jobs[i].file, r); console.log("  " + jobs[i].n + " " + jobs[i].job.tag + ": " + (r.fail ? "FAIL " + r.fail : (r.fallback ? "fallback (" + r.fallback + ")" : "ok") + ", " + Math.round(r.level.grade[r.tag].pace.ms / 1000) + " s, " + r.level.win[r.tag].length + " taps")); });
}

function assemble(X) {
  const main = X.world.main, k = X.world.k, H = X.LC.plan.hidden, bad = [];
  const out = main.map((id, i) => { const n = i + 1, f = path.join(X.S, "bake", "m-" + n + ".json"), r = fs.existsSync(f) ? readJ(f) : null; if (!r || r.fail) { bad.push(n + ": " + (r ? r.fail : "missing")); return null; }
    const S = X.byId.get(id), L = r.level;
    return Object.assign({ id: "z" + k + "-" + n, n, era: X.world.era, world: k, source: "zen", title: S.title }, S.short ? { short: S.short } : {}, { kind: S.kind, src: S.src, credit: S.credit, from: S.id, tag: r.tag, band: r.tag, target: X.P.bands[r.tag], seed: r.seed,
      w: L.w, h: L.h, grid: L.grid, pic: true, pal: S.pal }, S.shade ? { shade: S.shade } : {}, L.hidden ? { hidden: L.hidden } : {}, L.hidden && H.fills ? (({ c, q }) => ({ hideC: c, hideQ: q }))(fillOf(S.pal, H)) : {}, { cols: L.cols }, L.links ? { links: L.links } : {},
      { win: L.win, grade: L.grade, inBand: r.inBand, convert: S.convert, feats: r.plan.feats }, r.mystery ? { mystery: r.mystery } : {}, r.fallback ? { fallback: r.fallback } : {}); });
  writeJ(path.join(X.S, "out", "levels.json"), out.filter(Boolean));
  console.log("assemble: " + out.filter(Boolean).length + " levels" + (bad.length ? "; MISSING " + bad.join("; ") : "")); return bad;
}

function check(X) {
  const LV = readJ(path.join(X.S, "out", "levels.json")), V3 = X.CFG.v3, BC = require("./bake-config.json"), BK = X.LC.bake, rules = (t) => E.rulesOf(V3, t), gates = [], gate = (name, bad, info) => gates.push({ name, ok: !bad.length, bad, info: info || "" });
  const each = (f) => LV.map((L) => { try { const w = f(L); return w ? L.id + ": " + w : null; } catch (e) { return L.id + ": " + e.message; } }).filter(Boolean), k = X.world.k;
  gate(X.count + " levels, ids z" + k + "-1..z" + k + "-" + X.count + ", world " + k, LV.length === X.count && LV.every((L, i) => L.id === "z" + k + "-" + (i + 1) && L.n === i + 1 && L.world === k && L.era === X.world.era) ? [] : ["count or numbering"]);
  gate("compiles, E.check clean", each((L) => { E.compile(L); const w = E.check(L); return w.length ? w.join(", ") : null; }));
  gate("the stored order wins on its tag, no power-up", each((L) => (E.replay(E.compile(L), rules(L.tag), L.win[L.tag] || "").status === E.WON && !rules(L.tag).powers ? null : "does not win")));
  gate("5 spaces, at most that many in use", each((L) => { const ln = R.line(E.compile(L), rules(L.tag), L.win[L.tag]); return V3.rules.hold === 5 && ln.peak <= 5 ? null : "peak " + ln.peak; }));
  gate("longest tap <= " + BK.maxWaitMs / 1000 + " s, <= " + BK.maxTaps + " taps", each((L) => { const g = L.grade[L.tag]; return g.maxWait <= BK.maxWaitMs && L.win[L.tag].length <= BK.maxTaps ? null : "wait " + g.maxWait + ", taps " + L.win[L.tag].length; }));
  gate("the steady 1 s replay: every thinking replay wins, no wait between taps over " + BK.maxWaitMs / 1000 + " s", each((L) => { const g = L.grade[L.tag]; return g.steady && !g.steady.lost && g.steady.gap <= BK.maxWaitMs && (g.thinks || []).every((v) => v) ? null : "steady " + JSON.stringify([g.thinks, g.steady]); }));
  const pr = X.P.pace.range, pm = med(LV.map((L) => L.grade[L.tag].pace.ms)), PM = X.world.paceMedian || X.LC.checks.paceMedian;
  gate("real pace " + pr.map((v) => v / 1000).join("-") + " s", each((L) => { const p = L.grade[L.tag].pace; return p && !p.fell && p.ms >= pr[0] && p.ms <= pr[1] ? null : "pace " + (p ? Math.round(p.ms / 1000) + " s" : "-"); }));
  gate("the median real pace in " + PM.map((v) => v / 1000).join("-") + " s", pm >= PM[0] && pm <= PM[1] ? [] : ["median " + Math.round(pm / 1000) + " s"], "median " + Math.round(pm / 1000) + " s");
  gate("no fallback picks", LV.filter((L) => L.fallback).map((L) => L.id + ": " + L.fallback));
  gate("the profile: tags, density, runs, the end (land-plan planCheck)", LP.planCheck(LV, X.world, X.P, X.CFG.v5.density, X.CFG.lands.perLand));
  gate("casual: no lock, no Extreme", LV.filter((L) => L.lock || L.tag === "extreme").map((L) => L.id));
  const HF = X.LC.plan.hidden; gate("mystery blocks: each level's fill " + HF.fillDE[1] + "+ from its picture", each((L) => (!L.hidden ? null : !L.hideC ? "no fill" : fillGap(L.hideC, L.pal) >= HF.fillDE[1] ? null : "fill " + L.hideC)));
  const rg = regrade(LV, BC, V3, false); gate("re-grade with the grader's own counts: 0 differences (" + rg.checks + " checks)", rg.lines);
  const ok = gates.every((g) => g.ok), sh = LP.sharesOf(LV);
  const rows = ["# Zen world " + k + ": " + X.world.name, "", "Made by `tools/zen-world.js` on " + new Date().toISOString().slice(0, 10) + ". " + (ok ? "**Every gate passes.**" : "**Gates failing: " + gates.filter((g) => !g.ok).length + ".**"), "", "| Gate | | Detail |", "|---|---|---|"]
    .concat(gates.map((g) => "| " + g.name + " | " + (g.ok ? "pass" : "FAIL") + " | " + (g.ok ? g.info : g.bad.slice(0, 6).join("; ")) + " |"), ["", "Shares: " + Object.entries(sh).map(([a, b]) => a + " " + b).join(", "), "",
      "| Level | Picture | Board | Tag | Features | Rate (band) | Real pace | Longest tap | Steady gap / end | Taps |", "|---|---|---|---|---|---|---|---|---|---|"],
    LV.map((L) => { const g = L.grade[L.tag]; return "| " + L.n + " | " + L.title + " (" + L.from + ") | " + L.w + "x" + L.h + " | " + L.tag + " | " + (L.feats.join(", ") || "-") + (L.cols.flat().filter((c) => c[2]).length ? " (" + L.cols.flat().filter((c) => c[2]).length + " ?)" : "") + " | " + (100 * g.rate).toFixed(1) + "% (" + L.target.map((v) => 100 * v).join("-") + ") | " + Math.round(g.pace.ms / 1000) + " s | " + (g.maxWait / 1000).toFixed(1) + " s | " + (g.steady.gap / 1000).toFixed(1) + " / " + (g.steady.end / 1000).toFixed(1) + " s | " + L.win[L.tag].length + " |"; }));
  fs.writeFileSync(path.join(X.S, "report.md"), rows.join("\n") + "\n"); writeJ(path.join(X.S, "state.json"), Object.assign({}, X.state, { ok, checked: new Date().toISOString() }), true);
  for (const g of gates) console.log((g.ok ? "  pass  " : "  FAIL  ") + g.name + (g.ok ? (g.info ? " (" + g.info + ")" : "") : ": " + g.bad.slice(0, 3).join("; ")));
  console.log("check: " + (ok ? "PASS" : "FAIL") + " (scratch/report.md)"); return ok;
}

// The world's records into levels/zen.json (one line, like levels.json), replacing any of this world's; the file's other
// fields (worlds, the note) are kept.
function install(X) {
  const st = readJ(path.join(X.S, "state.json")); if (!st.ok) throw new Error("install: no passing check");
  const f = path.join(ROOT, "levels/zen.json"), Z = readJ(f), LV = readJ(path.join(X.S, "out", "levels.json"));
  Z.levels = (Z.levels || []).filter((L) => L.world !== X.world.k).concat(LV).sort((a, b) => a.world - b.world || a.n - b.n);
  fs.writeFileSync(f + ".tmp", JSON.stringify(Z) + "\n"); fs.renameSync(f + ".tmp", f);
  console.log("install: world " + X.world.k + " (" + LV.length + " levels) written into levels/zen.json");
}

if (require.main === module) {
  (async () => {
    const dir = argv[0]; if (!dir || dir.startsWith("--")) { console.log("usage: node tools/zen-world.js WORLD_DIR [plan|bake|assemble|check|install ...]"); process.exitCode = 2; return; }
    const asked = argv.slice(1).filter((a, i, A) => !a.startsWith("--") && !(i > 0 && A[i - 1].startsWith("--") && ["threads", "list", "extra"].indexOf(A[i - 1].slice(2)) >= 0));
    const steps = asked.length ? asked : ["plan", "bake", "assemble", "check"];
    try { for (const s of steps) { console.log("== " + s); const X = context(dir); fs.mkdirSync(X.S, { recursive: true });
      if (s === "plan") plan(X); else if (s === "bake") await bake(X); else if (s === "assemble") { if (assemble(X).length) { process.exitCode = 1; break; } } else if (s === "check") { if (!check(X)) process.exitCode = 1; } else if (s === "install") install(X); else throw new Error("no step " + s); } }
    catch (e) { console.log("zen-world: " + e.message); process.exitCode = 1; }
  })();
}
module.exports = { boardOf };
