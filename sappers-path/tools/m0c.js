// Sapper's Path M0c depth-and-density report: tools/bake-config.json → tools/m0c-report.md (Rule A, no stacks).
//   node tools/m0c.js --snapshot   measure the generator as it stands and write tools/m0c-before.json (the "before")
//   node tools/m0c.js              measure again (the "after"), then write tools/m0c-report.md: before/after per world,
//                                  the bands, the per-level table of levels/levels.json, one W3 and one W4 example
// Every number is measured on raw boards BEFORE the accept filter (C.m0c.perWorld per world, seeded chunks), except the
// "accepted" row, which scores the same boards under the world band. The narrative lives in tools/m0c-reading.md.
"use strict";
const fs = require("fs");
const path = require("path");
const Par = require("./par.js");
const Gen = require("./gen.js");
const E = require("../src/engine.js");

const q = (a, p) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const pct = (k, n) => (n ? Math.round((100 * k) / n) : 0) + "%";
const f2 = (v) => (v == null ? "n/a" : (+v).toFixed(2));
const f1 = (v) => (v == null ? "n/a" : (+v).toFixed(1));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
function hist(a) { const h = {}; for (const v of a) h[v] = (h[v] || 0) + 1; return Object.keys(h).sort((x, y) => x - y).map((k) => k + ":" + h[k]).join(" ") || "n/a"; }
// Share of the board that is crew wall (S T H I), and all wall (plus iron).
function coverage(L) { let crew = 0, all = 0; for (const row of L.grid) for (const ch of row) { if ("STHI".includes(ch)) { crew++; all++; } else if (ch === "F") all++; } return { crew: crew / (L.w * L.h), all: all / (L.w * L.h) }; }

// Crew sections of one block (stray tiles), and of two (a bridge over a 1-wide moat).
function smallSecs(L, under) { const B = E.parse(L); let k = 0; for (let s = 0; s < B.nsec; s++) if (B.secMat[s] < E.IRON && B.secStart[s + 1] - B.secStart[s] < under) k++; return k; }

// Per-world summary of measured Rule A boards.
function summarize(recs, band) {
  const M = recs.map((r) => Object.assign({ cov: coverage(r.v.A.level), single: smallSecs(r.v.A.level, 2), small: smallSecs(r.v.A.level, 3) }, r.v.A.m)).filter((m) => m.win);
  const acc = recs.filter((r) => !Gen.accept(r.v.A.m, band)).length;
  return {
    n: recs.length, wins: M.length,
    min: [q(M.map((m) => m.min), 0.1), q(M.map((m) => m.min), 0.5), q(M.map((m) => m.min), 0.9)], minHist: hist(M.map((m) => m.min)),
    decShare: M.filter((m) => m.decisions > 0).length / (M.length || 1), decMed: q(M.map((m) => m.decisions), 0.5), decMean: mean(M.map((m) => m.decisions)),
    trap: q(M.map((m) => m.trapRate), 0.5), trapMean: mean(M.map((m) => m.trapRate)), rand: q(M.map((m) => m.randWin), 0.5),
    cov: q(M.map((m) => m.cov.crew), 0.5), covAll: q(M.map((m) => m.cov.all), 0.5), covP10: q(M.map((m) => m.cov.crew), 0.1),
    sections: [q(M.map((m) => m.sections), 0.1), q(M.map((m) => m.sections), 0.5), q(M.map((m) => m.sections), 0.9)], walls90: q(M.map((m) => m.walls), 0.9),
    blocks: q(M.map((m) => m.blocks), 0.5), single: M.filter((m) => m.single > 0).length / (M.length || 1), small: M.filter((m) => m.small > 0).length / (M.length || 1),
    tieAny: M.filter((m) => m.tieAny).length / (M.length || 1), tieMove: M.filter((m) => m.tieMove).length / (M.length || 1),
    surprise: M.filter((m) => m.reshapes > 0).length / (M.length || 1),
    ms95: q(M.map((m) => m.ms), 0.95), msMax: M.reduce((a, m) => Math.max(a, m.ms), 0), states95: q(M.map((m) => m.states), 0.95),
    fMs95: q(recs.map((r) => r.v.A.info.fMs || 0), 0.95), capped: recs.filter((r) => r.v.A.m.capped).length,
    accepted: acc, towersRead: (() => { let t = 0, r = 0; for (const x of recs) { t += x.info.towers; r += x.info.towersRead || 0; } return t ? r / t : null; })(),
  };
}

// ASCII board with the optimal line numbered (1-9 then a-z) on the tiles each call breaks.
function ascii(L) {
  const B = E.parse(L), mark = new Map(); let s = E.start(B);
  L.line.forEach((a, i) => { const n = E.call(B, s, a); for (const sec of n.breaks[i]) mark.set(sec, i < 9 ? String(i + 1) : String.fromCharCode(88 + i)); s = n; });
  return L.grid.map((row, y) => row + "    " + [...row].map((ch, x) => { const sc = B.sec[y * B.w + x]; return sc >= 0 && mark.has(sc) ? mark.get(sc) : ch; }).join("")).join("\n");
}

(async () => {
  const t0 = Date.now(), C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8"));
  const snap = process.argv.includes("--snapshot"), per = (C.m0c && C.m0c.perWorld) || 300;
  const tasks = [];
  for (const wk of Object.keys(C.worlds)) for (let i = 0; i * C.chunk < per; i++) tasks.push({ wk, seed: C.seed + 9000000 + (+wk) * 100000 + i, n: C.chunk, variants: ["A"] });
  const res = await Par.run(C, tasks);
  const by = {}, fails = {};
  tasks.forEach((t, i) => {
    (by[t.wk] = by[t.wk] || []).push(...res[i].recs.filter((r) => r.v.A && r.v.A.m));
    for (const [r, v] of Object.entries(res[i].fails)) { fails[t.wk] = fails[t.wk] || {}; fails[t.wk][r] = (fails[t.wk][r] || 0) + v; }
  });
  const now = {};
  for (const wk of Object.keys(C.worlds)) now[wk] = Object.assign(summarize(by[wk] || [], C.bands[wk]), { fails: fails[wk] || {}, band: C.bands[wk], size: C.worlds[wk].sizes.map((s) => s.join("×")).join(", ") });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  for (const [wk, s] of Object.entries(now)) console.log("  W" + wk + " n " + s.n + " min " + s.min.join("/") + " dec " + pct(s.decShare * s.wins, s.wins) + " trap " + f2(s.trap) + " rand " + f2(s.rand) + " cov " + pct(s.cov * 100, 100) + " sec " + s.sections.join("/") + " blk " + f1(s.blocks) + " tie " + pct(s.tieMove * 100, 100) + " ms95 " + s.ms95 + " f95 " + s.fMs95 + " cap " + s.capped + " acc " + s.accepted + " fails " + JSON.stringify(s.fails));
  if (snap) {
    fs.writeFileSync(path.join(__dirname, "m0c-before.json"), JSON.stringify({ note: "M0 v2 generator as committed (ab0b68d), measured by tools/m0c.js --snapshot, " + per + " boards per world, Rule A.", secs, worlds: now }, null, 1) + "\n");
    console.log("m0c: snapshot → tools/m0c-before.json (" + secs + " s)");
    return;
  }
  let before = null;
  try { before = JSON.parse(fs.readFileSync(path.join(__dirname, "m0c-before.json"), "utf8")).worlds; } catch (e) { console.log("m0c: no before snapshot (" + e.message + ")"); }
  let LV = null;
  try { LV = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "levels", "levels.json"), "utf8")); } catch (e) { console.log("m0c: no levels.json (" + e.message + ")"); }

  const out = [];
  out.push("# Sapper's Path: M0c depth and density report", "");
  out.push("Generated by `tools/m0c.js` from `tools/bake-config.json` (seed " + C.seed + "), Rule A, no stacks. " + per + " raw castle pictures per world, each with its own scarce muster (`gen.musterize`), measured **before** any accept filter; " + secs + " s wall clock. *Before* is the M0 v2 generator as committed (`tools/m0c-before.json`, the same tool and seeds on the old code). Metric definitions are the M0 v2 report's. *Coverage* = crew-wall blocks (S T H I) over all board cells; *all walls* adds iron.", "");
  out.push("{{READING}}", "");
  out.push("## Before and after, per world", "", "Medians unless noted. Min calls p10 / p50 / p90.", "");
  const rows = [
    ["size", (s) => s.size],
    ["min calls (p10 / p50 / p90)", (s) => s.min.join(" / ")],
    ["min calls histogram", (s) => s.minHist],
    ["boards with ≥1 decision point", (s) => pct(s.decShare * 100, 100)],
    ["decision points (median / mean)", (s) => s.decMed + " / " + f1(s.decMean)],
    ["trap rate (median / mean)", (s) => f2(s.trap) + " / " + f2(s.trapMean)],
    ["random win", (s) => f2(s.rand)],
    ["crew-wall coverage (p10 / median)", (s) => pct((s.covP10 || 0) * 100, 100) + " / " + pct(s.cov * 100, 100)],
    ["all-wall coverage", (s) => pct(s.covAll * 100, 100)],
    ["crew sections (p10 / p50 / p90)", (s) => s.sections.join(" / ")],
    ["wall sections incl. iron (p90)", (s) => String(s.walls90)],
    ["blocks per section", (s) => f1(s.blocks)],
    ["boards with a 1-block crew section / a 2-block one", (s) => (s.small == null ? "n/a" : pct(s.single * 100, 100) + " / " + pct((s.small - s.single) * 100, 100))],
    ["towers in their own material (read as towers)", (s) => (s.towersRead == null ? "n/a (not tracked)" : pct(s.towersRead * 100, 100))],
    ["tie rate (any target / on a move)", (s) => pct(s.tieAny * 100, 100) + " / " + pct(s.tieMove * 100, 100)],
    ["surprise rate", (s) => pct(s.surprise * 100, 100)],
    ["solve ms p95 (max)", (s) => s.ms95 + " (" + s.msMax + ")"],
    ["solver states p95", (s) => String(s.states95)],
    ["frontier ms p95 (generation only)", (s) => String(s.fMs95)],
    ["capped solves", (s) => String(s.capped)],
    ["accepted under its own band", (s) => s.accepted + " / " + s.n + " (" + pct(s.accepted, s.n) + ")"],
  ];
  for (const wk of Object.keys(C.worlds)) {
    out.push("### World " + wk + ": " + C.worlds[wk].name, "", "| metric | before | after |", "|---|---|---|");
    for (const [name, fn] of rows) out.push("| " + name + " | " + (before && before[wk] ? fn(before[wk]) : "n/a") + " | " + fn(now[wk]) + " |");
    out.push("", "Castle rejects (after): " + JSON.stringify(now[wk].fails) + ".", "");
  }
  out.push("## Bands", "", "Every band also needs a win, no tie on a solution call, and the wall-section cap.", "", "| world | min calls | max wall sections | decision points | greedy rule | random win | trap rate | chest | levers |", "|---|---|---|---|---|---|---|---|---|");
  for (const wk of Object.keys(C.bands)) { const b = C.bands[wk]; out.push("| " + wk + " | " + b.min.join("-") + " | " + b.maxSections + " | ≥" + b.decisions + " | " + (b.greedy ? "fails or +" + b.greedy : "off") + " | " + b.randWin.join("-") + " | " + b.trap.join("-") + " | " + (b.chest ? "required or detour" : "none") + " | " + (b.levers ? "must matter" : "n/a") + " |"); }
  out.push("");
  if (LV) {
    out.push("## The bake (`levels/levels.json`)", "", "Teaching boards first in each world, then easiest first. Coverage = crew-wall blocks over the board. Chest: r required, d detour.", "",
      "| id | name | size | min | decisions | trap | random win | greedy | coverage | sections | blocks/sec | chest | levers matter | solve ms |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const w of LV.worlds) for (const L of w.levels) {
      const m = L.metrics, c = coverage(L), t1 = Date.now(); require("../src/solver.js").solve(E.parse(L), { cap: C.cap }); const ms = Date.now() - t1;
      out.push("| " + L.id + " | " + L.name + " | " + L.w + "×" + L.h + " | " + L.min + " | " + m.decisions + " | " + f2(m.trapRate) + " | " + f2(m.randWin) + " | " + (m.greedyWin ? "+" + (m.greedyUsed - L.min) : "stuck") + " | " + pct(c.crew * 100, 100) + " | " + m.sections + " | " + f1(m.blocks) + " | " + (m.chestKind ? m.chestKind[0] : "-") + " | " + (m.leversMatter == null ? "-" : m.leversMatter ? "yes" : "NO") + " | " + ms + " |");
    }
    out.push("");
    for (const wk of [3, 4]) {
      const w = LV.worlds.find((x) => x.world === wk); if (!w) continue;
      const baked = w.levels.filter((l) => l.source !== "teaching"), L = baked[Math.floor(baked.length / 2)]; if (!L) continue;
      out.push("## Example, World " + wk + ": " + L.id + " " + L.name, "", L.w + "×" + L.h + ", muster " + JSON.stringify(L.muster) + (L.chests.length ? ", chest " + JSON.stringify(L.chests[0]) + " (" + L.metrics.chestKind + ")" : "") + ". Min " + L.min + ", " + L.metrics.decisions + " decision points, trap rate " + f2(L.metrics.trapRate) + ", random win " + f2(L.metrics.randWin) + ", " + L.metrics.reshapes + " reshapes, " + L.metrics.sections + " crew sections, coverage " + pct(coverage(L).crew * 100, 100) + ". Left: the board. Right: the optimal line, numbered in call order.", "");
      out.push("```", ascii(L), "```", "Line: " + L.line.map((a, i) => (i + 1) + ". " + a).join(", ") + ".", "");
    }
  }
  let text = out.join("\n");
  const rp = path.join(__dirname, "m0c-reading.md");
  text = text.replace("{{READING}}", fs.existsSync(rp) ? fs.readFileSync(rp, "utf8").trim() : "_(reading not written yet)_");
  const outPath = path.join(__dirname, "m0c-report.md"), prev = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : "";
  const bake = prev.match(/<!-- bake:start -->[\s\S]*<!-- bake:end -->/);   // keep the last bake log
  fs.writeFileSync(outPath, text + (bake ? "\n" + bake[0] + "\n" : "\n"));
  console.log("m0c: report → tools/m0c-report.md (" + secs + " s)");
})().catch((e) => { console.log("m0c failed: " + (e && e.stack || e)); });
