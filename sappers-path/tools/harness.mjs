#!/usr/bin/env node
// Sapper's Path M1 harness. Headless Chromium via Playwright, real pointer input only for play (mouse at 1280×720,
// touch at 375×812): SP.selfTest(); Play → level 1 tap count; a win on one board per world and a stuck on one board
// per world, tapping cell centres on the canvas and the real buttons; the panel's Undo and the rail's Restart; thumb
// targets in the bottom third (portrait); draw cost; a hidden-tab load (document.hidden faked and rAF held until shown,
// driven by SP.tick) plus a sprite-cache drop and recovery; zero console errors. Screenshots of mid-play, win and stuck.
//
//   export PATH="$HOME/.local/opt/node/bin:$PATH"
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/harness.mjs [--url http://127.0.0.1:8491/sappers-path/] [--out tools/shots/m1]
//
// Exit 0: every assertion passed. Exit 1: an assertion or console error. Exit 2: the harness crashed or ran out of time.
// Every page.evaluate is a short call; every wait has its own timeout; the whole run has a wall budget.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/");
const OUT = resolve(arg("out", resolve(here, "shots/m1")));
const WALL_MS = 150000;
mkdirSync(OUT, { recursive: true });
const wall = setTimeout(() => { console.error("harness: wall budget exceeded"); process.exit(2); }, WALL_MS);

async function loadPlaywright() {
  for (const m of [process.env.PLAYWRIGHT_MODULE, "playwright"].filter(Boolean)) { try { return await import(m); } catch (e) { /* next */ } }
  throw new Error("playwright not found: set PLAYWRIGHT_MODULE to its index.mjs");
}

const report = { url: URL_, runs: {}, hidden: null, fails: [] };
const fail = (m) => { report.fails.push(m); console.log("FAIL " + m); };
const ok = (c, m) => { if (!c) fail(m); return !!c; };

function watch(page, sink) {
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") sink.push(m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => sink.push("pageerror: " + e.message));
}

async function run(browser, name, vp, touch) {
  const R = { viewport: vp, input: touch ? "touch" : "mouse", console: [], wins: [], stucks: [] };
  report.runs[name] = R;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: touch ? 3 : 1, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  watch(page, R.console);
  const tapXY = (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const tapBtn = (sel) => (touch ? page.locator(sel).tap({ timeout: 3000 }) : page.locator(sel).click({ timeout: 3000 }));
  const S = () => page.evaluate(() => SP.state());
  const tapCell = async (x, y) => { const c = await page.evaluate(([a, b]) => SP.cellCenter(a, b), [x, y]); await tapXY(c.x, c.y); };
  const openLevel = async (lv) => {
    await tapBtn("#btn-menu");
    await tapBtn(`#worlds button[aria-label="Level ${lv.world}-${lv.n}"]`);
    const s = await S();
    return ok(s.screen === "play" && s.id === lv.id && s.moves === 0, `${name}: menu → level ${lv.id} opened ${s.id}`);
  };

  await page.goto(URL_ + "?debug=1");
  await page.waitForFunction(() => window.SP, null, { timeout: 8000 });

  // selfTest (one evaluate, well under 20 s)
  const st = await page.evaluate(() => SP.selfTest());
  R.selfTest = { ok: st.ok, levels: st.levels, solved: st.solved, stuck: st.stuck, buttons: st.buttons, ms: st.ms, fails: st.fails };
  ok(st.ok && st.solved >= 20, `${name}: selfTest ok=${st.ok} solved=${st.solved} ${st.fails.join(" | ")}`);

  // Fresh save, reload: Play is one tap to level 1.
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForFunction(() => window.SP, null, { timeout: 8000 });
  const levels = await page.evaluate(() => SP.levels());
  const titleBtns = await page.evaluate(() => SP.buttons());
  await tapBtn("#btn-play");
  let s = await S();
  R.tapsToLevel1 = 1;
  ok(s.screen === "play" && s.id === levels[0].id, `${name}: Play did not open level 1 (${s.id})`);
  R.titleButtons = titleBtns.length;

  // Thumb targets: every play button but the menu is >= 44 px and (portrait) sits in the bottom third.
  const btns = await page.evaluate(() => SP.buttons());
  R.playButtons = btns;
  for (const b of btns) {
    ok(b.w >= 44 && b.h >= 44, `${name}: ${b.id} is ${b.w}x${b.h}`);
    if (touch && b.id !== "btn-menu") ok(b.y >= (vp.height * 2) / 3, `${name}: ${b.id} centre y ${Math.round(b.y)} is above the bottom third`);
  }

  const worlds = [...new Set(levels.map((l) => l.world))];
  for (const w of worlds) {
    // A win: the middle board of the world, along its baked line, two real taps per break.
    const inW = levels.filter((l) => l.world === w), lv = inW[Math.floor(inW.length / 2)];
    if (!(await openLevel(lv))) continue;
    for (let k = 0; k < lv.line.length; k++) {
      const [x, y] = lv.line[k], before = (await S()).moves;
      await tapCell(x, y);
      const mid = await S();
      ok(mid.moves === before && mid.pick, `${name} ${lv.id} step ${k}: tap 1 did not just pick`);
      if (w === 3 && k === 1) await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-midplay.png` });
      await tapCell(x, y);
      ok((await S()).moves === before + 1, `${name} ${lv.id} step ${k}: tap 2 did not break`);
    }
    await page.waitForFunction(() => SP.state().panel === "win", null, { timeout: 5000 }).catch(() => {});
    s = await S();
    const winOk = ok(s.won && s.panel === "win" && s.stars === 3 && s.saved === 3, `${name} ${lv.id}: win ${s.won} panel ${s.panel} stars ${s.stars} saved ${s.saved}`);
    const hit = await page.evaluate(() => SP.buttons().map((b) => { const el = document.elementFromPoint(b.x, b.y); return { id: b.id, hit: !!el && (el.id === b.id || (el.closest("button") && (el.closest("button").id || el.closest("button").textContent) === b.id)) }; }));
    ok(hit.every((h) => h.hit), `${name} ${lv.id}: win panel buttons covered ${JSON.stringify(hit.filter((h) => !h.hit))}`);
    if (w === worlds[worlds.length - 1]) await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-win.png` });
    R.wins.push({ id: lv.id, used: s.used, min: s.min, stars: s.stars, ok: winOk });
    if (w === worlds[0]) { // Next goes to the following level
      await tapBtn("#p-primary");
      const n = await S();
      ok(n.screen === "play" && n.id === levels[levels.findIndex((l) => l.id === lv.id) + 1].id && n.moves === 0, `${name}: Next opened ${n.id}`);
    }

    // A stuck: a seeded random line that ends with no legal break.
    const sl = await page.evaluate((ww) => SP.stuckLine(ww), w);
    if (!ok(sl, `${name}: world ${w} has no stuck line`)) continue;
    const slv = levels.find((l) => l.id === sl.id);
    if (!(await openLevel(slv))) continue;
    for (const [x, y] of sl.taps) { await tapCell(x, y); await tapCell(x, y); }
    await page.waitForFunction(() => SP.state().panel === "stuck", null, { timeout: 5000 }).catch(() => {});
    s = await S();
    const stuckOk = ok(s.stuck && s.panel === "stuck" && s.moves === sl.taps.length, `${name} ${sl.id}: stuck ${s.stuck} panel ${s.panel} moves ${s.moves}/${sl.taps.length}`);
    if (w === worlds[worlds.length - 1]) await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-stuck.png` });
    await tapBtn("#p-primary"); // Undo
    const u = await S();
    ok(!u.stuck && u.panel === null && u.moves === sl.taps.length - 1, `${name} ${sl.id}: panel Undo gave moves ${u.moves} stuck ${u.stuck}`);
    await tapBtn("#btn-restart");
    const r = await S();
    ok(r.moves === 0 && !r.stuck, `${name} ${sl.id}: rail Restart gave moves ${r.moves}`);
    R.stucks.push({ id: sl.id, breaks: sl.taps.length, ok: stuckOk });
  }

  // Draw cost on the biggest board with a crew picked (dim + glow layers live).
  const big = levels.reduce((a, b) => (b.world >= a.world ? b : a));
  await openLevel(big);
  await tapCell(big.line[0][0], big.line[0][1]);
  R.bench = await page.evaluate(() => SP.bench(300));
  R.frames = await page.evaluate(() => new Promise((res) => {
    const d = []; let last = 0; const t0 = performance.now();
    const f = (t) => { if (last) d.push(t - last); last = t; if (d.length < 90 && performance.now() - t0 < 4000) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res({ n: d.length, meanMs: d.reduce((a, b) => a + b, 0) / d.length, p95Ms: d[Math.floor(d.length * 0.95)] }); } };
    requestAnimationFrame(f);
  }));
  R.signature = await page.evaluate(() => SP.renderSignature().split("|").slice(-2).join("|"));
  if (!touch) { // keyboard: Escape clears the pick, 1 picks the first card shown, u undoes a break
    await page.keyboard.press("Escape"); const k0 = (await S()).pick;
    await page.keyboard.press("1"); const k1 = (await S()).pick, first = Object.keys((await S()).remaining)[0];
    await page.keyboard.press("Escape"); await tapCell(big.line[0][0], big.line[0][1]); await tapCell(big.line[0][0], big.line[0][1]);
    const m1 = (await S()).moves; await page.keyboard.press("u"); const m0 = (await S()).moves;
    R.keys = { escape: k0, one: k1, first, undo: [m1, m0] };
    ok(k0 === null && k1 === first && m1 === 1 && m0 === 0, `${name}: keyboard ${JSON.stringify(R.keys)}`);
  }

  R.errors = R.console.filter((m) => !m.startsWith("warning"));
  ok(R.errors.length === 0, `${name}: console errors ${JSON.stringify(R.errors)}`);
  await ctx.close();
}

// Hidden-tab load: document.hidden is true and rAF callbacks are held from the first script on, until __show().
async function hiddenRun(browser) {
  const H = { console: [] }; report.hidden = H;
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => {
    window.__hid = true; window.__held = 0; const q = [], raf = window.requestAnimationFrame.bind(window);
    Object.defineProperty(Document.prototype, "hidden", { configurable: true, get: () => window.__hid });
    Object.defineProperty(Document.prototype, "visibilityState", { configurable: true, get: () => (window.__hid ? "hidden" : "visible") });
    window.requestAnimationFrame = (cb) => { if (window.__hid) { q.push(cb); window.__held++; return 0; } return raf(cb); };
    window.__show = () => { window.__hid = false; document.dispatchEvent(new Event("visibilitychange")); q.splice(0).forEach((cb) => raf(cb)); };
  });
  const page = await ctx.newPage();
  watch(page, H.console);
  await page.goto(URL_ + "?debug=1");
  await page.waitForFunction(() => window.SP, null, { timeout: 8000 });
  H.hiddenAtLoad = await page.evaluate(() => document.hidden && window.__held > 0);
  const st = await page.evaluate(() => SP.selfTest());
  H.selfTest = { ok: st.ok, solved: st.solved, ms: st.ms, fails: st.fails };
  ok(st.ok, "hidden: selfTest " + st.fails.join(" | "));
  // Play a level entirely on the manual clock while hidden.
  const res = await page.evaluate(() => {
    const lv = SP.levels().find((l) => l.world === 2) || SP.levels()[0];
    SP.load(lv.id);
    for (const [x, y] of lv.line) { SP.tapCell(x, y); SP.tapCell(x, y); }
    const before = SP.state().panel;
    SP.tick(5000);
    return { id: lv.id, panelBeforeTick: before, after: SP.state() };
  });
  H.play = { id: res.id, panelBeforeTick: res.panelBeforeTick, panel: res.after.panel, won: res.after.won };
  ok(res.after.won && res.panelBeforeTick === null && res.after.panel === "win", "hidden: manual-clock win " + JSON.stringify(H.play));
  const clock0 = await page.evaluate(() => SP.state().clock);
  await page.evaluate(() => window.__show());
  await page.waitForTimeout(400);
  const shown = await page.evaluate(() => ({ sig: SP.renderSignature(), blank: SP.blankTiles(), s: SP.state() }));
  H.afterShow = { opaque: +shown.sig.split("|").pop(), blank: shown.blank, cell: shown.s.cell, loopMs: Math.round(shown.s.clock - clock0) };
  ok(H.afterShow.opaque > 0.95 && !shown.blank.length && H.afterShow.loopMs > 100, "hidden: board not drawn after show " + JSON.stringify(H.afterShow));
  // Backing-store drop proxy: blank every sprite, fire visibilitychange, the page rebuilds.
  const drop = await page.evaluate(() => { const n = SP.dropCaches(), mid = SP.blankTiles().length; document.dispatchEvent(new Event("visibilitychange")); return { dropped: n, blankAfterDrop: mid, blankAfterWake: SP.blankTiles().length, rebuilds: SP.state().cacheRebuilds }; });
  H.cacheDrop = drop;
  ok(drop.blankAfterDrop > 0 && drop.blankAfterWake === 0 && drop.rebuilds >= 1, "hidden: cache drop not recovered " + JSON.stringify(drop));
  await page.screenshot({ path: `${OUT}/hidden-load-after-show.png` });
  H.errors = H.console.filter((m) => !m.startsWith("warning"));
  ok(H.errors.length === 0, "hidden: console errors " + JSON.stringify(H.errors));
  await ctx.close();
}

try {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  await run(browser, "desktop", { width: 1280, height: 720 }, false);
  await run(browser, "phone", { width: 375, height: 812 }, true);
  await hiddenRun(browser);
  await browser.close();
} catch (e) {
  console.error("harness crashed: " + (e && e.stack || e));
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  process.exit(2);
}
clearTimeout(wall);
report.ok = report.fails.length === 0;
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
const brief = {};
for (const [k, R] of Object.entries(report.runs)) brief[k] = { selfTest: `${R.selfTest.ok} solved ${R.selfTest.solved}/${R.selfTest.levels} in ${R.selfTest.ms} ms`, wins: R.wins.map((w) => w.id + (w.ok ? "" : "!")).join(","), stucks: R.stucks.map((w) => w.id + (w.ok ? "" : "!")).join(","),
  bench: R.bench && `${R.bench.msPerDraw.toFixed(3)} ms/draw @ ${R.bench.canvas}`, frames: R.frames && `mean ${R.frames.meanMs.toFixed(1)} p95 ${R.frames.p95Ms.toFixed(1)} ms`, errors: R.errors.length, warnings: R.console.length - R.errors.length };
console.log(JSON.stringify({ ok: report.ok, runs: brief, hidden: report.hidden && { selfTest: report.hidden.selfTest.ok, play: report.hidden.play, afterShow: report.hidden.afterShow, cacheDrop: report.hidden.cacheDrop, errors: report.hidden.errors.length }, fails: report.fails }, null, 1));
process.exit(report.ok ? 0 : 1);
