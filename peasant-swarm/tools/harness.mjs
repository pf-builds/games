#!/usr/bin/env node
// Peasant Swarm verification harness. Headless Chromium via Playwright: PS.selfTest(), a PS.fight matrix, N scripted-player
// matches advanced with PS.step, sim cost per chunk, live rAF render timing, screenshots, and (--mobile) a real CDP touch drag.
//
//   node tools/harness.mjs --url http://127.0.0.1:8471/peasant-swarm/ --out <dir> [--mobile] [--sim 240] [--seeds 3]
//                          [--difficulty normal] [--viewport 1280x720] [--fights 30x20,40x20,20x20,25x20] [--fight-runs 5] [--render-secs 3]
//
// Exit 0: every assertion passed. Exit 1: a console error, a page error, a selfTest failure or an assertion failure. Exit 2: the harness crashed.
// Writes <out>/report.json (every number) and <out>/report.md (the short read), plus PNG screenshots.
//
// Studio lessons it keeps: (14) PS.step is the sim clock; (20) every page.evaluate stays under ~15 s wall and carries its own wall guard,
// every PS.step call is at most 30 sim-seconds; (34) the PLAY button is checked with elementFromPoint, and pressed with a real mouse or touch.
// "--seeds N" means N independent matches: v1 picks its world seed from the clock and Math.random is unseeded, so runs are not replayable;
// each run records the seed the game chose (PSS.seed).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const A = parseArgs(process.argv.slice(2));
const CHUNK_SIM = 30;        // max sim-seconds per page.evaluate
const POLICY_TICK = 0.5;     // sim-seconds between scripted-player decisions
const EVAL_WALL_MS = 12000;  // in-page wall guard for one chunk (lesson 20)
const LOG_EVERY = 30;        // sim-seconds between timeline rows / render samples
const POLICY = { sight: 400, hunt: 0.7, flee: 1.4, fleeDist: 300 };
const FONT_HOST = /fonts\.(googleapis|gstatic)\.com/;

function parseArgs(argv) {
  const o = { url: "http://127.0.0.1:8471/peasant-swarm/", out: "harness-out", mobile: false, sim: 240, seeds: 3, difficulty: "normal",
    viewport: "1280x720", fights: "30x20,40x20,20x20,25x20", fightRuns: 5, fightMax: 40, renderSecs: 3 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--mobile") { o.mobile = true; continue; }
    const key = { "--url": "url", "--out": "out", "--sim": "sim", "--seeds": "seeds", "--difficulty": "difficulty", "--viewport": "viewport",
      "--fights": "fights", "--fight-runs": "fightRuns", "--fight-max": "fightMax", "--render-secs": "renderSecs" }[k];
    if (!key) { console.error("unknown arg " + k); process.exit(2); }
    o[key] = typeof o[key] === "number" ? +v : v; i++;
  }
  return o;
}
async function loadPlaywright() {
  for (const m of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"].filter(Boolean)) {
    try { return await import(m); } catch (e) { /* try the next location */ }
  }
  throw new Error("playwright not found: set PLAYWRIGHT_MODULE to its index.mjs");
}
const r2 = (v) => Math.round(v * 100) / 100;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };

// ---------------------------------------------------------------- in-page helpers (harness-owned global, installed before the game boots)
function installHelpers() {
  window.__psh = {
    // scripted player: flee a rival > flee x our size within sight, else hunt a rival < hunt x our size within sight, else the nearest camp
    policy(o) {
      const S = window.PSS, p = S && S.teams[1]; if (!p || p.count === 0) return "idle";
      const W = S.cfg.world.w, H = S.cfg.world.h, cl = (v, a, b) => (v < a ? a : v > b ? b : v);
      let fl = null, fd = Infinity, hu = null, hd = Infinity;
      for (let i = 2; i < S.teams.length; i++) {
        const r = S.teams[i]; if (!r.alive || r.count === 0) continue;
        const d = Math.hypot(r.cx - p.cx, r.cy - p.cy); if (d > o.sight) continue;
        if (r.count > o.flee * p.count) { if (d < fd) { fl = r; fd = d; } } else if (r.count < o.hunt * p.count && d < hd) { hu = r; hd = d; }
      }
      if (fl) { const dx = p.cx - fl.cx, dy = p.cy - fl.cy, d = Math.hypot(dx, dy) || 1; p.tx = cl(p.cx + (dx / d) * o.fleeDist, 40, W - 40); p.ty = cl(p.cy + (dy / d) * o.fleeDist, 40, H - 40); return "flee"; }
      if (hu) { p.tx = hu.cx; p.ty = hu.cy; return "hunt"; }
      let best = null, bd = Infinity;
      for (const c of S.camps) { if (!c.n) continue; const d = Math.hypot(c.x - p.cx, c.y - p.cy); if (d < bd) { bd = d; best = c; } }
      if (best) { p.tx = best.x; p.ty = best.y; return "camp"; }
      p.tx = W / 2; p.ty = H / 2; return "idle";
    },
    snapshot() {
      const S = window.PSS, z = S.cam.zoom, hw = S.vw / 2 / z, hh = S.vh / 2 / z;
      let neutrals = 0, onScreen = 0;
      for (const a of S.agents) { if (a.team === 0) neutrals++; if (Math.abs(a.x - S.cam.x) < hw && Math.abs(a.y - S.cam.y) < hh) onScreen++; }
      const counts = {}; for (const t of S.teams.slice(1)) counts[t.name] = t.count;
      return { t: Math.round(S.t * 100) / 100, mode: S.mode, result: S.result, counts, alive: S.teams.slice(1).map((t) => t.alive), neutrals, total: S.agents.length, onScreen };
    },
  };
}

// one chunk: policy every POLICY_TICK, PS.step between decisions, stop at `until`, at maxSim sim-seconds, or at the wall guard
function runChunk(o) {
  const S = window.PSS, w0 = performance.now(), t0 = S.t, acts = { camp: 0, hunt: 0, flee: 0, idle: 0 };
  let stepMs = 0, steps = 0, peak = S.agents.length;
  while (S.mode === "play" && S.t < o.until - 1e-6 && S.t - t0 < o.maxSim - 1e-6 && performance.now() - w0 < o.wallMs) {
    acts[window.__psh.policy(o.policy)]++;
    const sec = Math.max(1 / 60, Math.min(o.tick, o.until - S.t, o.maxSim - (S.t - t0)));
    const a = performance.now(); window.PS.step(sec); stepMs += performance.now() - a; steps++;
    if (S.agents.length > peak) peak = S.agents.length;
  }
  return { t: S.t, simSec: S.t - t0, stepMs, steps, peak, acts, mode: S.mode, wallMs: performance.now() - w0 };
}

// live rAF timing for `ms` of wall time; the scripted player keeps steering every ~0.5 s so the swarm isn't parked
function renderWindow(o) {
  return new Promise((res) => {
    const S = window.PSS, t0 = performance.now(), st0 = S.t, gaps = [], acts = { camp: 0, hunt: 0, flee: 0, idle: 0 };
    let last = 0, n = 0, nextPolicy = 0;
    const f = (ts) => {
      if (last) gaps.push(ts - last); last = ts; n++;
      const now = performance.now();
      if (S.mode === "play" && now >= nextPolicy) { acts[window.__psh.policy(o.policy)]++; nextPolicy = now + 500; }
      if (now - t0 < o.ms) { requestAnimationFrame(f); return; }
      gaps.sort((a, b) => a - b);
      const avg = gaps.reduce((s, g) => s + g, 0) / Math.max(1, gaps.length);
      res({ frames: n, wallMs: now - t0, avgMs: avg, fps: 1000 / avg, p95Ms: gaps[Math.floor(gaps.length * 0.95)] || 0, maxMs: gaps[gaps.length - 1] || 0,
        gameFps: S.fps, simAdvance: S.t - st0, visibility: document.visibilityState, acts });
    };
    requestAnimationFrame(f);
  });
}

async function cdpMetrics(cdp) { const m = await cdp.send("Performance.getMetrics"); return Object.fromEntries(m.metrics.map((x) => [x.name, x.value])); }

async function main() {
  const t0 = Date.now(), out = path.resolve(A.out);
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = await loadPlaywright();
  const [vw, vh] = A.viewport.split("x").map(Number);
  const tag = A.mobile ? "mobile" : "desktop";
  const ctxOpts = A.mobile
    ? { viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true }
    : { viewport: { width: vw, height: vh }, deviceScaleFactor: 1, ignoreHTTPSErrors: true };
  // --ignore-certificate-errors lets the real Google Fonts load through the container's TLS proxy; font-host errors are filtered either way
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  const url = new URL(A.url); url.searchParams.set("debug", "1");
  const report = {
    meta: { url: url.href, mode: tag, viewport: ctxOpts.viewport, deviceScaleFactor: ctxOpts.deviceScaleFactor, sim: A.sim, seeds: A.seeds, difficulty: A.difficulty,
      chromium: browser.version(), node: process.version, startedAt: new Date().toISOString(), policy: POLICY, chunkSim: CHUNK_SIM, policyTick: POLICY_TICK,
      cpus: os.cpus().length, loadAvgStart: os.loadavg().map(r2) }, // timings are only comparable at similar load: other sessions may share this machine
    errors: { console: [], page: [], filteredFontErrors: 0, warnings: [] },
    selfTest: null, fights: [], title: null, touch: null, huddle: null, runs: [], asserts: {}, notes: [], pass: false,
  };
  const warnSeen = new Set();
  const shot = async (page, name) => { const f = path.join(out, `${tag}-${name}.png`); await page.screenshot({ path: f }); return path.basename(f); };

  for (let ri = 0; ri < A.seeds; ri++) {
    const ctx = await browser.newContext(ctxOpts);
    await ctx.addInitScript(installHelpers);
    const page = await ctx.newPage();
    page.on("console", (m) => {
      const where = (m.location() && m.location().url) || "";
      if (m.type() === "error") { if (FONT_HOST.test(where) || FONT_HOST.test(m.text())) report.errors.filteredFontErrors++; else report.errors.console.push({ run: ri + 1, text: m.text(), where }); }
      else if (m.type() === "warning" && !warnSeen.has(m.text())) { warnSeen.add(m.text()); report.errors.warnings.push(m.text().slice(0, 300)); }
      else if (m.type() === "log" && m.text().startsWith("[PS.selfTest]")) report.notes.push("run " + (ri + 1) + " console: " + m.text());
    });
    page.on("pageerror", (e) => report.errors.page.push({ run: ri + 1, text: String(e.message || e) }));
    const bootReady = () => !!(window.PS && window.PS.selfTest && window.PS.step && window.PSS && window.PSS.teams && window.PSS.teams.length > 1);
    const run = { index: ri + 1, timeline: [], chunks: [], render: [], screenshots: {}, policy: { camp: 0, hunt: 0, flee: 0, idle: 0 } };
    report.runs.push(run);

    let b0 = Date.now();
    await page.goto(url.href);
    await page.waitForFunction(bootReady, null, { timeout: 15000 });
    run.bootMs = Date.now() - b0;

    if (ri === 0) {
      // selfTest on the title screen before any match, then the fight matrix (each call is its own evaluate, well under 15 s)
      const s0 = Date.now();
      report.selfTest = await page.evaluate(() => window.PS.selfTest());
      report.selfTest.wallMs = Date.now() - s0;
      for (const pair of A.fights === "none" ? [] : A.fights.split(",")) {
        const [n, m] = pair.split("x").map(Number);
        const f = await page.evaluate(([n, m, mx, runs]) => window.PS.fight(n, m, mx, runs), [n, m, A.fightMax, A.fightRuns]);
        report.fights.push(f);
      }
    }

    // difficulty: set the stored choice, reload, confirm the game picked it up
    await page.evaluate((d) => localStorage.setItem("ps.difficulty", d), A.difficulty);
    b0 = Date.now();
    await page.reload();
    await page.waitForFunction(bootReady, null, { timeout: 15000 });
    run.bootMs = Date.now() - b0;
    await page.evaluate(() => Promise.race([document.fonts.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]));
    run.fontsLoaded = await page.evaluate(() => document.fonts.check("800 20px 'Baloo 2'") && document.fonts.check("800 12px 'Nunito'"));
    run.difficulty = await page.evaluate(() => window.PSS.difficulty);
    await page.waitForTimeout(600); // let the attract match draw a few frames behind the title

    // lesson 34: the PLAY button must be what a real pointer hits at its centre
    const title = await page.evaluate(() => {
      const b = document.getElementById("btn-play"), r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const e = document.elementFromPoint(x, y);
      return { x, y, w: r.width, h: r.height, inViewport: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight, hit: !!e && (e === b || b.contains(e)),
        element: e ? e.tagName + (e.id ? "#" + e.id : "") : null, bodyTouch: document.body.classList.contains("touch") };
    });
    if (ri === 0) { report.title = title; run.screenshots.title = await shot(page, "title"); }
    run.titleHit = title.hit;

    // start the match with real input: a mouse click on desktop, a touch tap on mobile
    if (A.mobile) await page.touchscreen.tap(title.x, title.y); else await page.mouse.click(title.x, title.y);
    await page.waitForFunction(() => window.PSS.mode === "play", null, { timeout: 5000 }).catch(() => {});
    run.started = await page.evaluate(() => window.PSS.mode === "play");
    run.seed = await page.evaluate(() => window.PSS.seed);
    run.mouseFollowActive = await page.evaluate(() => window.PSS.input.active); // must stay false or the game overrides the scripted tx/ty
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Performance.enable");

    if (A.mobile && ri === 0 && run.started) {
      // real touch drag on the canvas: start (187,600), 6 moves up to (187,450), hold 1 s live, lift
      const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
      const under = await page.evaluate(() => { const e = document.elementFromPoint(187, 600); return e ? e.tagName + (e.id ? "#" + e.id : "") : null; });
      const before = await page.evaluate(() => ({ ty: window.PSS.teams[1].ty, cy: window.PSS.teams[1].cy }));
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(187, 600) });
      for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(187, 600 - 25 * i) });
      const hold = [];
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(200);
        hold.push(await page.evaluate(() => { const j = window.PSS.input.joy; return { active: j.active, mag: r(j.mag), dy: r(j.dy), ty: r(window.PSS.teams[1].ty), cy: r(window.PSS.teams[1].cy) }; function r(v) { return Math.round(v * 100) / 100; } }));
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(100);
      const after = await page.evaluate(() => ({ active: window.PSS.input.joy.active, touch: window.PSS.input.touch }));
      report.touch = { target: under, before: { ty: r2(before.ty), cy: r2(before.cy) }, hold, after,
        joyActive: hold.every((h) => h.active), movedUp: Math.min(...hold.map((h) => h.ty)) < before.ty - 50, released: !after.active,
        swarmMovedUp: hold[hold.length - 1].cy < before.cy };
    }
    if (A.mobile && ri === 0 && run.started) {
      report.huddle = await page.evaluate(() => {
        const b = document.getElementById("t-huddle"), r = b.getBoundingClientRect(), cs = getComputedStyle(b);
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { bodyTouch: document.body.classList.contains("touch"), display: cs.display, rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
          visible: cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
          reachable: !!e && (e === b || b.contains(e)) };
      });
    }

    // ------------------------------------------------ the match
    const stops = new Set(); for (let t = LOG_EVERY; t < A.sim; t += LOG_EVERY) stops.add(t); stops.add(45); stops.add(A.sim);
    const plan = [...stops].filter((t) => t <= A.sim).sort((a, b) => a - b);
    run.timeline.push(await page.evaluate(() => window.__psh.snapshot()));
    let maxAgents = run.timeline[0].total, busiest = null;
    for (const stop of plan) {
      let guard = 0;
      while (guard++ < 20) {
        const now = await page.evaluate(() => ({ t: window.PSS.t, mode: window.PSS.mode }));
        if (now.mode !== "play" || now.t >= stop - 1e-6) break;
        const c = await page.evaluate(runChunk, { until: stop, maxSim: CHUNK_SIM, tick: POLICY_TICK, wallMs: EVAL_WALL_MS, policy: POLICY });
        if (c.simSec > 0) run.chunks.push({ t0: r2(c.t - c.simSec), t1: r2(c.t), simSec: r2(c.simSec), stepMs: Math.round(c.stepMs), msPerSimSec: r2(c.stepMs / c.simSec), peakAgents: c.peak, wallMs: Math.round(c.wallMs) });
        for (const k in c.acts) run.policy[k] += c.acts[k];
        if (c.peak > maxAgents) maxAgents = c.peak;
      }
      const snap = await page.evaluate(() => window.__psh.snapshot());
      if (snap.mode !== "play") break;
      if (stop === 45) run.screenshots.t45 = await shot(page, `run${ri + 1}-t45`);
      if (stop % LOG_EVERY === 0 || stop === A.sim) {
        run.timeline.push(snap);
        if (!busiest || snap.total > busiest.total) { busiest = snap; run.screenshots.busiest = await shot(page, `run${ri + 1}-busiest`); }
        const m0 = await cdpMetrics(cdp);
        const rw = await page.evaluate(renderWindow, { ms: A.renderSecs * 1000, policy: POLICY });
        const m1 = await cdpMetrics(cdp);
        for (const k in rw.acts) run.policy[k] += rw.acts[k];
        const busyMs = ((m1.TaskDuration - m0.TaskDuration) * 1000) / Math.max(1, rw.frames), scriptMs = ((m1.ScriptDuration - m0.ScriptDuration) * 1000) / Math.max(1, rw.frames);
        run.render.push({ t: snap.t, total: snap.total, onScreen: snap.onScreen, fps: r2(rw.fps), avgMs: r2(rw.avgMs), p95Ms: r2(rw.p95Ms), maxMs: r2(rw.maxMs),
          mainThreadMsPerFrame: r2(busyMs), scriptMsPerFrame: r2(scriptMs), gameFps: rw.gameFps, simAdvance: r2(rw.simAdvance), wallMs: Math.round(rw.wallMs), visibility: rw.visibility });
      }
    }
    // ------------------------------------------------ the end screen: finish naturally, or ring the bell early when --sim is shorter than the match
    let st = await page.evaluate(() => ({ mode: window.PSS.mode, t: window.PSS.t, timeLeft: window.PSS.timeLeft, result: window.PSS.result }));
    run.endForced = false;
    if (st.mode === "play" && !st.result && st.timeLeft > 0.5) { run.endForced = true; await page.evaluate(() => { window.PSS.timeLeft = Math.min(window.PSS.timeLeft, 0.05); }); }
    for (let i = 0; i < 20 && st.mode === "play"; i++) { st = await page.evaluate(() => { window.PS.step(0.5); return { mode: window.PSS.mode, t: window.PSS.t }; }); }
    await page.waitForFunction(() => document.querySelector("#ov-win.active, #ov-lose.active"), null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    run.end = await page.evaluate(() => {
      const S = window.PSS, ov = document.querySelector("#ov-win.active, #ov-lose.active");
      const counts = {}; for (const t of S.teams.slice(1)) counts[t.name] = t.count;
      return { mode: S.mode, result: S.result, t: Math.round(S.t * 100) / 100, overlay: ov ? ov.id : null, reason: ov ? ov.querySelector("p").textContent : null, counts, stats: { ...S.stats } };
    });
    run.screenshots.end = await shot(page, `run${ri + 1}-end`);
    run.maxAgents = maxAgents;
    run.agentCap = await page.evaluate(() => window.PSS.cfg.spawn.agentCap);
    const costly = run.chunks.reduce((b, c) => (!b || c.peakAgents > b.peakAgents ? c : b), null);
    run.simCost = costly ? { atPeakAgents: costly.peakAgents, window: [costly.t0, costly.t1], msPerSimSec: costly.msPerSimSec,
      avgMsPerSimSec: r2(run.chunks.reduce((s, c) => s + c.stepMs, 0) / Math.max(1e-9, run.chunks.reduce((s, c) => s + c.simSec, 0))) } : null;
    const top = run.render.reduce((b, x) => (!b || x.total > b.total ? x : b), null);
    run.renderAtBusiest = top; run.worstRender = run.render.reduce((b, x) => (!b || x.fps < b.fps ? x : b), null);
    await ctx.close();
  }
  await browser.close();

  // ---------------------------------------------------------------- verdict
  const as = report.asserts, W = report.notes;
  as.noConsoleErrors = report.errors.console.length === 0;
  as.noPageErrors = report.errors.page.length === 0;
  as.selfTestPass = !!(report.selfTest && report.selfTest.pass);
  as.btnPlayHit = report.runs.every((r) => r.titleHit);
  as.difficultyApplied = report.runs.every((r) => r.difficulty === A.difficulty);
  as.matchStarted = report.runs.every((r) => r.started);
  as.scriptedPlayerInControl = report.runs.every((r) => !r.mouseFollowActive);
  as.endScreenReached = report.runs.every((r) => !!(r.end && r.end.overlay));
  as.agentCapRespected = report.runs.every((r) => r.maxAgents <= r.agentCap);
  if (A.mobile) {
    const t = report.touch || {}, h = report.huddle || {};
    as.touchLandsOnCanvas = t.target === "CANVAS#game";
    as.joyActive = !!t.joyActive; as.joyTargetMovedUp = !!t.movedUp; as.joyReleased = !!t.released;
    as.huddleVisible = !!(h.bodyTouch && h.visible); as.huddleReachable = !!h.reachable;
  }
  report.pass = Object.values(as).every(Boolean);
  for (const r of report.runs) {
    if (r.renderAtBusiest && r.renderAtBusiest.fps < 50) W.push(`run ${r.index}: ${r.renderAtBusiest.fps} fps at the busiest sample (${r.renderAtBusiest.total} agents, ${r.renderAtBusiest.onScreen} on screen)`);
    for (const x of r.render) if (x.simAdvance < 0.8 * (x.wallMs / 1000) && x.fps < 30) W.push(`run ${r.index} t=${x.t}: rAF looks starved (sim advanced ${x.simAdvance}s in ${x.wallMs} ms)`);
    if (!r.fontsLoaded) W.push(`run ${r.index}: web fonts did not load, screenshots use fallback fonts`);
  }
  if (report.selfTest && report.selfTest.wallMs > 12000) W.push(`selfTest took ${report.selfTest.wallMs} ms`);
  const smd = report.selfTest && report.selfTest.results.simMatch_no_exceptions && report.selfTest.results.simMatch_no_exceptions.detail;
  if (smd && smd.truncated) W.push(`selfTest simMatch hit its 10 s wall guard at ${smd.seconds} sim-s: the agent-cap check covered only that span`);
  report.meta.durationMs = Date.now() - t0; report.meta.loadAvgEnd = os.loadavg().map(r2);
  if (report.meta.loadAvgStart[0] > report.meta.cpus * 0.75) W.push(`machine was busy at start (load ${report.meta.loadAvgStart[0]} on ${report.meta.cpus} CPUs): sim-cost and selfTest timings are inflated`);
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(out, "report.md"), markdown(report));
  console.log(`[harness] ${tag} ${report.pass ? "PASS" : "FAIL"} in ${Math.round(report.meta.durationMs / 1000)} s -> ${path.join(out, "report.md")}`);
  if (!report.pass) console.log("[harness] failed: " + Object.keys(as).filter((k) => !as[k]).join(", "));
  process.exitCode = report.pass ? 0 : 1;
}

function markdown(R) {
  const L = [], m = R.meta, st = R.selfTest;
  L.push(`# Peasant Swarm harness: ${m.mode} ${R.pass ? "PASS" : "FAIL"}`, "");
  L.push(`${m.url} · ${m.viewport.width}x${m.viewport.height} @${m.deviceScaleFactor}x · Chromium ${m.chromium} · ${m.seeds} run(s) × ${m.sim} s · ${m.difficulty} · ${Math.round(m.durationMs / 1000)} s wall · load ${m.loadAvgStart[0]}→${m.loadAvgEnd[0]} on ${m.cpus} CPUs`, "");
  L.push("## Assertions", "", "| check | result |", "|---|---|");
  for (const [k, v] of Object.entries(R.asserts)) L.push(`| ${k} | ${v ? "pass" : "**FAIL**"} |`);
  L.push("", `Console errors: ${R.errors.console.length} · page errors: ${R.errors.page.length} · filtered font-host errors: ${R.errors.filteredFontErrors}`);
  for (const e of [...R.errors.console, ...R.errors.page].slice(0, 10)) L.push(`- run ${e.run}: ${e.text.slice(0, 200)}`);
  if (st) {
    L.push("", `## selfTest: ${st.pass ? "PASS" : "FAIL"} (${st.wallMs} ms)`, "");
    for (const [k, v] of Object.entries(st.results)) L.push(`- ${k}: ${v.pass ? "pass" : "FAIL"}`);
    const sm = st.results.simMatch_no_exceptions && st.results.simMatch_no_exceptions.detail;
    if (sm && sm.timeline) L.push(`- simMatch (all four swarms AI): ${sm.seconds} s, ended by ${sm.truncated ? "the 10 s wall guard (truncated)" : sm.end}, winner ${sm.winner ? sm.winner.name + " " + sm.winner.count : "none"}, peak agents ${sm.maxTotal} / cap ${sm.agentCap}. Counts ${sm.names.join("/")}: ${sm.timeline.map((x) => x.t + "s " + x.counts.join("/")).join(" · ")}`);
    const cfg = st.results.config_keys && st.results.config_keys.detail;
    if (cfg && cfg.unused && cfg.unused.length) L.push(`- config keys no code reads: ${cfg.unused.join(", ")}`);
  }
  if (R.fights.length) {
    L.push("", "## Fights (PS.fight, median of runs; survivors counted before the rout flips the losers)", "", "| n v m | winner | player wins | median s | player left | rival left | player after |", "|---|---|---|---|---|---|---|");
    for (const f of R.fights) L.push(`| ${f.n}v${f.m} | ${f.winner} | ${f.playerWins}/${f.runs.length} | ${f.seconds} | ${f.playerLeft} | ${f.rivalLeft} | ${f.playerAfter} |`);
  }
  if (R.touch) L.push("", "## Touch", "", `Drag on ${R.touch.target}: joy active ${R.touch.joyActive}, target ty ${R.touch.before.ty} → ${Math.min(...R.touch.hold.map((h) => h.ty))}, released ${R.touch.released}. HUDDLE visible ${R.huddle && R.huddle.visible}, reachable ${R.huddle && R.huddle.reachable}.`);
  for (const r of R.runs) {
    const names = Object.keys(r.timeline[0].counts);
    L.push("", `## Run ${r.index} (seed ${r.seed}): ${r.end.result || "?"}${r.endForced ? " (bell rung early at the --sim cap)" : ""} at ${r.end.t} s`, "", `> ${r.end.reason || ""}`, "");
    L.push(`| t | ${names.join(" | ")} | neutrals | total | on screen |`, `|${"---|".repeat(names.length + 4)}`);
    for (const s of r.timeline) L.push(`| ${Math.round(s.t)} | ${names.map((n) => s.counts[n]).join(" | ")} | ${s.neutrals} | ${s.total} | ${s.onScreen} |`);
    if (r.simCost) L.push("", `Sim cost: ${r.simCost.msPerSimSec} ms per sim-second at the busiest chunk (${r.simCost.atPeakAgents} agents, t ${r.simCost.window[0]}–${r.simCost.window[1]}); match average ${r.simCost.avgMsPerSimSec}.`);
    if (r.renderAtBusiest) L.push(`Render at busiest (t ${r.renderAtBusiest.t}, ${r.renderAtBusiest.total} agents, ${r.renderAtBusiest.onScreen} on screen): ${r.renderAtBusiest.fps} fps, ${r.renderAtBusiest.avgMs} ms/frame avg, p95 ${r.renderAtBusiest.p95Ms} ms, main thread ${r.renderAtBusiest.mainThreadMsPerFrame} ms/frame. Worst sample ${r.worstRender.fps} fps at t ${r.worstRender.t}.`);
    L.push(`Peak agents ${r.maxAgents} / cap ${r.agentCap}. Player stats: ${JSON.stringify(r.end.stats)}. Policy ticks: ${JSON.stringify(r.policy)}.`);
    L.push(`Screenshots: ${Object.values(r.screenshots).join(", ")}`);
  }
  if (R.notes.length) { L.push("", "## Notes"); for (const n of R.notes) L.push(`- ${n}`); }
  if (R.errors.warnings.length) { L.push("", "## Console warnings (not failures)"); for (const w of R.errors.warnings.slice(0, 8)) L.push(`- ${w}`); }
  return L.join("\n") + "\n";
}

main().catch((e) => {
  console.error("[harness] crashed: " + (e && e.stack || e));
  try { fs.mkdirSync(path.resolve(A.out), { recursive: true }); fs.writeFileSync(path.join(path.resolve(A.out), "crash.txt"), String(e && e.stack || e)); } catch (x) { /* nothing left to do */ }
  process.exit(2);
});
