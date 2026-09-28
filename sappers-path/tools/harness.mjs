#!/usr/bin/env node
// Sapper's Path v3 M1 harness. Headless Chromium via Playwright, real input for every play: touch taps at 375×812,
// mouse clicks at 1280×720 (a move is ONE tap on a front card, SPEC-v3 §3).
//   Per viewport, on a fresh profile: SP.selfTest(); the title's Play reaches gameplay in one tap; a win on level 1
//   through the card buttons (the stored order), the win panel after the goblin, Next reaches level 2; a loss (an
//   overflow found by SP.lossOrder on a late level) through the card buttons, the fail panel names the reason, one tap on
//   Retry restarts; the map through its button; a mid-show frame on a busy play (draw cost of the busiest frame); a
//   sanitize check (a garbage save loads clean). Then a hidden-tab load (document.hidden faked, rAF held, driven by
//   SP.tick) that runs selfTest and a won level while hidden. Zero console errors AND warnings anywhere.
//   Screenshots: 375×812 map, mid-show, win and fail; 1280×720 mid-show (tools/shots-v3-m1/).
//
//   export PATH="$HOME/.local/opt/node/bin:$PATH"
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/harness.mjs [--url http://127.0.0.1:8491/sappers-path/] [--out tools/shots-v3-m1]
//
// Exit 0: every assertion passed. Exit 1: an assertion or console message. Exit 2: the harness crashed or ran out of
// time. Every page.evaluate is a short call; every wait has its own timeout; the whole run has a wall budget.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/");
const OUT = resolve(arg("out", resolve(here, "shots-v3-m1")));
const WALL_MS = 240000;
mkdirSync(OUT, { recursive: true });
const wall = setTimeout(() => { console.error("harness: wall budget exceeded"); process.exit(2); }, WALL_MS);

async function loadPlaywright() {
  for (const m of [process.env.PLAYWRIGHT_MODULE, "playwright"].filter(Boolean)) { try { return await import(m); } catch (e) { /* next */ } }
  throw new Error("playwright not found: set PLAYWRIGHT_MODULE to its index.mjs");
}
const report = { url: URL_, runs: {}, hidden: null, fails: [], console: [] };
const fail = (m) => { report.fails.push(m); console.log("FAIL " + m); };
const ok = (c, m) => { if (!c) fail(m); return !!c; };
const settle = (p) => p.waitForTimeout(320); // CSS sheet animation (0.22 s) before a screenshot

async function run() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    for (const vp of [{ name: "375x812", width: 375, height: 812, touch: true, dpr: 2 }, { name: "1280x720", width: 1280, height: 720, touch: false, dpr: 1 }]) {
      const R = (report.runs[vp.name] = {});
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: vp.touch, isMobile: vp.touch });
      const page = await ctx.newPage();
      page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") report.console.push(vp.name + " " + m.type() + ": " + m.text()); });
      page.on("pageerror", (e) => report.console.push(vp.name + " pageerror: " + e.message));
      const tap = async (sel) => { const l = page.locator(sel).first(); if (vp.touch) await l.tap({ timeout: 5000 }); else await l.click({ timeout: 5000 }); };
      const S = () => page.evaluate(() => SP.state());
      await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
      await page.waitForFunction(() => window.SP && document.querySelector("#title:not([hidden])"), null, { timeout: 15000 });

      // selfTest
      const st = await page.evaluate(() => SP.selfTest());
      R.selfTest = { pass: st.pass, fail: st.fail, ms: st.ms, notes: st.notes };
      ok(st.fail.length === 0, vp.name + " selfTest: " + st.fail.join("; "));
      await page.evaluate(() => SP.screen("title"));

      // One tap from the title to gameplay; a win through the cards.
      await tap("#btn-play");
      let s = await S();
      ok(s.screen === "play" && s.n === 1 && s.status === "playing", vp.name + " title Play reaches level 1 in one tap (" + s.screen + " " + s.n + ")");
      const win = await page.evaluate(() => SP.winOrder());
      for (const c of win) await tap(`.card[data-col="${c}"]`);
      s = await S();
      ok(s.status === "won" && s.plays === win.length, vp.name + " level 1 won through the cards (" + s.status + ", " + s.plays + " plays)");
      s = await page.evaluate(() => SP.tick(3200));
      ok(s.goblin || s.panel === "win", vp.name + " the goblin flees after the last pixel");
      s = await page.evaluate(() => SP.tick(3000));
      ok(s.panel === "win" && (await page.textContent("#p-title")) === "Fort razed!", vp.name + " win panel");
      if (vp.touch) { await settle(page); await page.screenshot({ path: resolve(OUT, "375-win.png") }); }
      await tap("#p-primary");
      s = await S();
      ok(s.n === 2 && s.status === "playing" && s.panel === null, vp.name + " Next level loads level 2");

      // A loss through the cards: an overflow on a late level.
      await page.evaluate(() => SP.load(46, "normal"));
      const loss = await page.evaluate(() => SP.lossOrder());
      if (ok(!!loss, vp.name + " found an overflow order on level 46")) {
        for (const c of loss) await tap(`.card[data-col="${c}"]`);
        s = await page.evaluate(() => SP.tick(4000));
        ok(s.status === "failed" && s.reason === "overflow" && s.panel === "fail", vp.name + " overflow fail through the cards (" + s.status + " " + s.reason + ")");
        ok(/overflow/.test(await page.textContent("#p-line")), vp.name + " the fail panel names the reason");
        if (vp.touch) { await settle(page); await page.screenshot({ path: resolve(OUT, "375-fail.png") }); }
        await tap("#p-primary");
        s = await S();
        ok(s.status === "playing" && s.plays === 0 && s.panel === null, vp.name + " one tap on Retry restarts");
        R.loss = loss;
      }

      // Mid-show: sappers running up and carrying blocks back, on the busiest play of any level (SP.busiest); real frame
      // times while it runs live, then the JS cost of one draw at that moment.
      const bz = await page.evaluate(() => SP.busiest());
      await page.evaluate((n) => SP.load(n, "normal"), bz.n);
      const ord = await page.evaluate(() => SP.winOrder());
      for (let i = 0; i < bz.i; i++) { await tap(`.card[data-col="${ord[i]}"]`); await page.evaluate(() => SP.tick(3500)); }
      await tap(`.card[data-col="${ord[bz.i]}"]`);
      R.frames = await page.evaluate(() => new Promise((res) => { const d = []; let last = performance.now(); const f = (t) => { d.push(t - last); last = t; if (d.length < 60) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res({ n: d.length, p50: +d[30].toFixed(1), p95: +d[57].toFixed(1), max: +d[59].toFixed(1) }); } }; requestAnimationFrame(f); }));
      ok(R.frames.p95 < 25, vp.name + " frame time during the busiest live show (p95 " + R.frames.p95 + " ms)");
      await page.evaluate((n) => SP.load(n, "normal"), bz.n);
      for (let i = 0; i < bz.i; i++) { await tap(`.card[data-col="${ord[i]}"]`); await page.evaluate(() => SP.tick(3500)); }
      await tap(`.card[data-col="${ord[bz.i]}"]`);
      await page.evaluate(() => SP.tick(1250));
      const perf = await page.evaluate(() => SP.perf(120));
      R.midShow = { level: bz.n, play: bz.i, eats: bz.eats, perf };
      ok(perf.launched >= 20, vp.name + " the busiest play has its runners out (" + JSON.stringify(perf) + ")");
      ok(perf.mean < 4 && perf.max < 12, vp.name + " draw cost mid-show (mean " + perf.mean + " ms, max " + perf.max + " ms)");
      await page.screenshot({ path: resolve(OUT, (vp.touch ? "375" : "1280") + "-mid-show.png") });

      // Map through its button.
      await page.evaluate(() => SP.tick(4000));
      await tap("#btn-map");
      s = await S();
      ok(s.screen === "map", vp.name + " map button");
      if (vp.touch) await page.screenshot({ path: resolve(OUT, "375-map.png") });

      // A garbage save loads clean.
      await page.evaluate(() => localStorage.setItem("sappers-path.v3", '{"v":1,"done":{"e1-01":7,"e3-75":7,"x":9},"settings":{"diff":"nightmare","muted":"yes"},"last":"e3-75"}'));
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(() => window.SP, null, { timeout: 15000 });
      const sv = await page.evaluate(() => JSON.parse(localStorage.getItem("sappers-path.v3") || "{}"));
      s = await S();
      ok(s.done === 1 && s.diff === "normal", vp.name + " sanitize: only reachable wins survive, bad difficulty clamps (" + s.done + " " + s.diff + ")");
      R.sanitized = sv;
      await ctx.close();
    }

    // Hidden-tab load: rAF never fires, document.hidden is true; everything must still run on SP.tick.
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => {
      Object.defineProperty(document, "hidden", { get: () => true, configurable: true });
      Object.defineProperty(document, "visibilityState", { get: () => "hidden", configurable: true });
      window.requestAnimationFrame = () => 0;
    });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") report.console.push("hidden " + m.type() + ": " + m.text()); });
    page.on("pageerror", (e) => report.console.push("hidden pageerror: " + e.message));
    await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
    await page.waitForFunction(() => window.SP, null, { timeout: 15000 });
    const st = await page.evaluate(() => SP.selfTest());
    const won = await page.evaluate(() => { SP.load(10, "hard"); for (const c of SP.winOrder()) SP.play(+c); return SP.tick(9000); });
    const spr = await page.evaluate(() => SP.sprites());
    report.hidden = { selfTest: { pass: st.pass, fail: st.fail, ms: st.ms }, panel: won.panel, sprites: spr };
    ok(st.fail.length === 0, "hidden selfTest: " + st.fail.join("; "));
    ok(won.status === "won" && won.panel === "win", "hidden: level 10 on Hard won and its panel shown on SP.tick alone");
    ok(spr.length === 0, "hidden: sprite caches opaque (" + spr.join(",") + ")");
    await ctx.close();
  } finally { await browser.close(); }
  ok(report.console.length === 0, "console errors/warnings: " + report.console.length);
}

run().then(() => {
  writeFileSync(resolve(OUT, "harness-report.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ runs: report.runs, hidden: report.hidden, console: report.console }, null, 1));
  console.log(report.fails.length ? "HARNESS: " + report.fails.length + " failure(s)" : "HARNESS: all passed");
  clearTimeout(wall); process.exit(report.fails.length ? 1 : 0);
}).catch((e) => { console.error("harness crashed: " + (e && e.stack || e)); clearTimeout(wall); process.exit(2); });
