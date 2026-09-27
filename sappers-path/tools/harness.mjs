#!/usr/bin/env node
// Sapper's Path M2 harness. Headless Chromium via Playwright, real pointer input only for play (mouse at 1280×720,
// touch at 375×812):
//   SP.selfTest(); the payload of a cold load; title → map → level 1 in two taps; a locked node stays locked; the
//   teaching hint card dismisses; mute survives a reload; a win and a stuck on one board per world (tapping cell centres
//   and the real buttons; the panel's Undo and the rail's Restart); skip (a tap during the show fast-forwards it) and 2×
//   (the toggle halves the show); elementFromPoint on every primary button of every screen visited; thumb targets in
//   the bottom third (portrait); draw cost during a show; a hidden-tab load (document.hidden faked, rAF held until
//   shown, driven by SP.tick) plus a sprite-cache drop and recovery; 390×844 and 768×1024 layout checks; zero console
//   errors AND warnings. Screenshots (tools/shots/m2/, not committed): title, map, mid-play per world (375×812),
//   mid-play and win (1280×720), a mid-crumble frame, stuck, and a grayscale World 4 board.
//
//   export PATH="$HOME/.local/opt/node/bin:$PATH"
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/harness.mjs [--url http://127.0.0.1:8491/sappers-path/] [--out tools/shots/m2]
//
// Exit 0: every assertion passed. Exit 1: an assertion or console message. Exit 2: the harness crashed or ran out of
// time. Every page.evaluate is a short call; every wait has its own timeout; the whole run has a wall budget.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/");
const OUT = resolve(arg("out", resolve(here, "shots/m2")));
const WALL_MS = 280000;
mkdirSync(OUT, { recursive: true });
const wall = setTimeout(() => { console.error("harness: wall budget exceeded"); process.exit(2); }, WALL_MS);

async function loadPlaywright() {
  for (const m of [process.env.PLAYWRIGHT_MODULE, "playwright"].filter(Boolean)) { try { return await import(m); } catch (e) { /* next */ } }
  throw new Error("playwright not found: set PLAYWRIGHT_MODULE to its index.mjs");
}

const report = { url: URL_, runs: {}, hidden: null, extra: {}, payload: null, fails: [] };
const fail = (m) => { report.fails.push(m); console.log("FAIL " + m); };
const ok = (c, m) => { if (!c) fail(m); return !!c; };

function watch(page, sink) {
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") sink.push(m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => sink.push("pageerror: " + e.message));
}

// elementFromPoint at the centre of every primary button SP reports for the current screen.
async function hits(page, where) {
  const r = await page.evaluate(() => SP.buttons().map((b) => { const el = document.elementFromPoint(b.x, b.y), btn = el && el.closest("button"); return { id: b.id, w: b.w, h: b.h, y: b.y, hit: !!btn && (btn.id || btn.getAttribute("aria-label") || btn.textContent) === b.id }; }));
  ok(r.length > 0 && r.every((b) => b.hit && b.w >= 44 && b.h >= 44), `${where}: buttons missed or small ${JSON.stringify(r.filter((b) => !b.hit || b.w < 44 || b.h < 44))}`);
  return r;
}

async function run(browser, name, vp, touch) {
  const R = { viewport: vp, input: touch ? "touch" : "mouse", console: [], wins: [], stucks: [], screens: {} };
  report.runs[name] = R;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: touch ? 3 : 1, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  watch(page, R.console);
  const bytes = [], origin = new URL(URL_).origin; page.on("response", async (res) => { try { const b = await res.body(); bytes.push({ url: res.url().replace(URL_, ""), local: res.url().startsWith(origin), n: b.length }); } catch (e) { /* redirects */ } });
  const tapXY = (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const tapBtn = (sel) => (touch ? page.locator(sel).first().tap({ timeout: 3000 }) : page.locator(sel).first().click({ timeout: 3000 }));
  const S = () => page.evaluate(() => SP.state());
  const tapCell = async (x, y) => { const c = await page.evaluate(([a, b]) => SP.cellCenter(a, b), [x, y]); await tapXY(c.x, c.y); };
  const openLevel = async (lv) => { // the debug select (every level open), reached from the map with real taps
    const s0 = await S();
    if (s0.screen === "play") await tapBtn("#btn-menu");
    if ((await S()).screen === "title") await tapBtn("#btn-play");
    await tapBtn("#btn-debug");
    await tapBtn(`#worlds button[aria-label="Level ${lv.world}-${lv.n}"]`);
    const s = await S();
    return ok(s.screen === "play" && s.id === lv.id && s.moves === 0, `${name}: select → level ${lv.id} opened ${s.id}`);
  };
  const dismissHint = async () => { if ((await S()).hint) await tapBtn("#btn-hint"); };

  await page.goto(URL_ + "?debug=1");
  await page.waitForFunction(() => window.SP, null, { timeout: 8000 });
  await page.waitForTimeout(300);
  if (!report.payload) {
    const total = bytes.reduce((a, b) => a + b.n, 0), ext = bytes.filter((b) => !b.local);
    report.payload = { files: bytes.length, bytes: total, kb: +(total / 1024).toFixed(1), external: ext.length, list: bytes.slice().sort((a, b) => b.n - a.n) };
    ok(ext.length === 0 && total < 20 * 1024 * 1024, "payload: external requests or over 20 MB");
  }

  // selfTest (one evaluate, well under 20 s)
  const st = await page.evaluate(() => SP.selfTest());
  R.selfTest = { ok: st.ok, levels: st.levels, solved: st.solved, stuck: st.stuck, buttons: st.buttons, ms: st.ms, show: st.show, chest: st.chest, scenerySections: st.scenerySections, cues: st.cues, fails: st.fails };
  ok(st.ok && st.solved === st.levels && st.levels >= 36, `${name}: selfTest ok=${st.ok} solved=${st.solved}/${st.levels} ${st.fails.join(" | ")}`);

  // Fresh save, reload: title → map → level 1 is two taps; a locked node stays locked.
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForFunction(() => window.SP, null, { timeout: 8000 });
  const levels = await page.evaluate(() => SP.levels());
  R.screens.title = (await hits(page, `${name} title`)).length;
  if (touch) await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-title.png` });
  await tapBtn("#btn-play");
  let s = await S();
  ok(s.screen === "map", `${name}: Play did not open the map`);
  R.screens.map = (await hits(page, `${name} map`)).length;
  if (touch) await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-map.png` });
  await tapBtn(`.node[aria-label="Level 1-2"]`);
  s = await S();
  ok(s.screen === "map" && s.cue === "lock", `${name}: locked node 1-2 opened (${s.screen}) or no lock cue (${s.cue})`);
  await tapBtn(`.node[aria-label="Level 1-1"]`);
  s = await S();
  R.tapsToLevel1 = 2;
  ok(s.screen === "play" && s.id === levels[0].id, `${name}: map node 1 did not open level 1 (${s.id})`);

  // The teaching hint card is up on level 1; its button is hittable; it dismisses.
  ok(s.hint, `${name}: no hint card on ${s.id}`);
  R.screens.playHint = (await hits(page, `${name} play+hint`)).length;
  await tapBtn("#btn-hint");
  ok(!(await S()).hint, `${name}: hint did not dismiss`);

  // Thumb targets: every play button but the top bar and toggles is >= 44 px and (portrait) in the bottom third.
  const btns = await hits(page, `${name} play`);
  R.screens.play = btns.length; R.playButtons = btns;
  if (touch) for (const b of btns) if (!/menu|Mute|Unmute|Double/.test(b.id)) ok(b.y >= (vp.height * 2) / 3, `${name}: ${b.id} centre y ${Math.round(b.y)} is above the bottom third`);

  // Mute: a real tap, then a reload keeps it; unmute again.
  await tapBtn("#banner .tog-mute");
  ok((await S()).muted === true, `${name}: mute tap did not mute`);
  await page.reload(); await page.waitForFunction(() => window.SP, null, { timeout: 8000 });
  const mu = await page.evaluate(() => ({ s: SP.state().muted, pressed: document.querySelector("#banner .tog-mute").getAttribute("aria-pressed") }));
  R.mutePersist = mu;
  ok(mu.s === true && mu.pressed === "true", `${name}: mute did not survive the reload ${JSON.stringify(mu)}`);
  await tapBtn("#btn-play"); await tapBtn("#map .tog-mute");
  ok((await S()).muted === false, `${name}: map mute tap did not unmute`);

  const worlds = [...new Set(levels.map((l) => l.world))];
  for (const w of worlds) {
    // A win: the middle board of the world, along its baked line, two real taps per break (tap 1 skips the last show).
    const inW = levels.filter((l) => l.world === w), lv = inW[Math.floor(inW.length / 2)];
    if (!(await openLevel(lv))) continue;
    await dismissHint();
    for (let k = 0; k < lv.line.length; k++) {
      const [x, y] = lv.line[k], before = (await S()).moves;
      await tapCell(x, y);
      const mid = await S();
      ok(mid.moves === before && mid.pick, `${name} ${lv.id} step ${k}: tap 1 did not just pick`);
      await tapCell(x, y);
      const aft = await S();
      ok(aft.moves === before + 1 && aft.show.active, `${name} ${lv.id} step ${k}: tap 2 did not break or no show`);
      if (k === 0 && touch) { await page.waitForTimeout(650); await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-midplay-w${w}.png` }); }
      if (k === 1 && !touch && w === 3) { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-midplay.png` }); }
    }
    await page.waitForFunction(() => SP.state().panel === "win" && SP.state().starsShown === SP.state().stars, null, { timeout: 9000 }).catch(() => {});
    s = await S();
    const winOk = ok(s.won && s.panel === "win" && s.stars === 3 && s.saved === 3 && s.starsShown === 3, `${name} ${lv.id}: win ${s.won} panel ${s.panel} stars ${s.stars} saved ${s.saved} shown ${s.starsShown}`);
    await hits(page, `${name} ${lv.id} win`);
    if (w === worlds[worlds.length - 1]) { await page.waitForTimeout(450); await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-win.png` }); }
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
    await dismissHint();
    for (const [x, y] of sl.taps) { await tapCell(x, y); await tapCell(x, y); }
    await page.waitForFunction(() => SP.state().panel === "stuck", null, { timeout: 8000 }).catch(() => {});
    s = await S();
    const stuckOk = ok(s.stuck && s.panel === "stuck" && s.moves === sl.taps.length, `${name} ${sl.id}: stuck ${s.stuck} panel ${s.panel} moves ${s.moves}/${sl.taps.length}`);
    await hits(page, `${name} ${sl.id} stuck`);
    if (w === worlds[worlds.length - 1]) await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-stuck.png` });
    await tapBtn("#p-primary"); // Undo
    const u = await S();
    ok(!u.stuck && u.panel === null && u.moves === sl.taps.length - 1, `${name} ${sl.id}: panel Undo gave moves ${u.moves} stuck ${u.stuck}`);
    await tapBtn("#btn-restart");
    const r = await S();
    ok(r.moves === 0 && !r.stuck, `${name} ${sl.id}: rail Restart gave moves ${r.moves}`);
    R.stucks.push({ id: sl.id, breaks: sl.taps.length, ok: stuckOk });
  }

  // Skip and 2×, with real taps: a card tap during the show fast-forwards it; the 2× toggle halves the next one.
  const sk = levels.find((l) => l.world === 4 && l.line.length >= 3);
  await openLevel(sk); await dismissHint();
  const [ax, ay] = sk.line[0];
  await tapCell(ax, ay); await tapCell(ax, ay);
  const s1 = await S();
  const card = await page.evaluate(([x, y]) => { const t = SP.firstTile(x, y); return t; }, sk.line[1]);
  await tapCell(sk.line[1][0], sk.line[1][1]); // tap 1 of the next step, mid-show
  const s2 = await S();
  R.skip = { activeBefore: s1.show.active, activeAfter: s2.show.active, pick: s2.pick, dur1x: Math.round(s1.show.dur) };
  ok(s1.show.active && !s2.show.active && s2.pick && card, `${name}: skip ${JSON.stringify(R.skip)}`);
  await tapBtn("#banner .tog-fast");
  ok((await S()).fast === true, `${name}: 2x toggle did not turn on`);
  await tapBtn("#btn-undo"); await page.keyboard.press("Escape");
  await tapCell(ax, ay); await tapCell(ax, ay);
  const s3 = await S();
  R.speed = { dur1x: Math.round(s1.show.dur), dur2x: Math.round(s3.show.dur), ratio: +(s3.show.dur / s1.show.dur).toFixed(3) };
  ok(Math.abs(R.speed.ratio - 0.5) < 0.01, `${name}: 2x ratio ${R.speed.ratio}`);
  // rAF frames while the show plays (crew sprite, crumble overlays, dust live)
  R.frames = await page.evaluate(() => new Promise((res) => {
    const d = []; let last = 0; const t0 = performance.now();
    const f = (t) => { if (last) d.push(t - last); last = t; if (d.length < 60 && performance.now() - t0 < 4000) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res({ n: d.length, meanMs: d.reduce((a, b) => a + b, 0) / d.length, p95Ms: d[Math.floor(d.length * 0.95)] }); } };
    requestAnimationFrame(f);
  }));
  await tapBtn("#banner .tog-fast");
  ok((await S()).fast === false, `${name}: 2x toggle did not turn off`);

  // A mid-crumble frame: hold the clock, break, tick to the middle of the crumble, draw, shoot.
  if (touch) {
    const big = levels.find((l) => l.id === "w4-t1") || sk;
    await openLevel(big); await dismissHint();
    await page.evaluate(() => SP.hold(true));
    const [bx, by] = big.line[0]; await tapCell(bx, by); await tapCell(bx, by);
    const cr = await page.evaluate(() => { const s = SP.state(); SP.tick(Math.max(0, (s.show.popT0 + s.show.crumbleEnd) / 2 - s.clock)); SP.draw(); return SP.state().show; });
    R.crumbleShot = { popT0: Math.round(cr.popT0), crumbleEnd: Math.round(cr.crumbleEnd) };
    await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-crumble.png` });
    await page.evaluate(() => SP.hold(false));
  }
  // Grayscale World 4 board (readability without hue).
  if (touch) {
    const g4 = levels.find((l) => l.id === "w4-05") || sk;
    await openLevel(g4); await dismissHint();
    await page.evaluate(() => { document.documentElement.style.filter = "grayscale(1)"; SP.draw(); });
    await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-gray-w4.png` });
    await page.evaluate(() => { document.documentElement.style.filter = ""; });
  }

  // Draw cost: the biggest board with a crew picked (dim + glow layers live).
  const big = levels.reduce((a, b) => (b.world >= a.world ? b : a));
  await openLevel(big); await dismissHint();
  await tapCell(big.line[0][0], big.line[0][1]);
  R.bench = await page.evaluate(() => SP.bench(300));
  R.signature = await page.evaluate(() => SP.renderSignature().split("|").slice(-2).join("|"));
  if (!touch) { // keyboard: Escape clears the pick, 1 picks the first card shown, u undoes a break
    await page.keyboard.press("Escape"); const k0 = (await S()).pick;
    await page.keyboard.press("1"); const k1 = (await S()).pick, first = Object.keys((await S()).remaining)[0];
    await page.keyboard.press("Escape"); await tapCell(big.line[0][0], big.line[0][1]); await tapCell(big.line[0][0], big.line[0][1]);
    const m1 = (await S()).moves; await page.keyboard.press("u"); const m0 = (await S()).moves;
    R.keys = { escape: k0, one: k1, first, undo: [m1, m0] };
    ok(k0 === null && k1 === first && m1 === 1 && m0 === 0, `${name}: keyboard ${JSON.stringify(R.keys)}`);
  }
  R.layout = await page.evaluate(() => { const b = document.getElementById("board").getBoundingClientRect(), n = document.getElementById("banner").getBoundingClientRect(), r = document.getElementById("rail").getBoundingClientRect(); return { board: [Math.round(b.width), Math.round(b.height), Math.round(b.top)], banner: Math.round(n.height), railTop: Math.round(r.top) }; });

  ok(R.console.length === 0, `${name}: console messages ${JSON.stringify(R.console)}`);
  await ctx.close();
}

// Other portrait sizes: the biggest board, every play button hittable, thumb targets low, a screenshot.
async function extra(browser, vp, touch) {
  const E = { console: [] }, key = vp.width + "x" + vp.height; report.extra[key] = E;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: touch ? 3 : 2, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  watch(page, E.console);
  await page.goto(URL_ + "?debug=1");
  await page.waitForFunction(() => window.SP, null, { timeout: 8000 });
  await hits(page, key + " title");
  await page.evaluate(() => { SP.load(SP.levels().filter((l) => l.world === 4).pop().id); });
  await page.waitForTimeout(200);
  const b = await hits(page, key + " play");
  for (const x of b) if (!/menu|Mute|Unmute|Double/.test(x.id)) ok(x.y >= (vp.height * 2) / 3, `${key}: ${x.id} centre y ${Math.round(x.y)} is above the bottom third`);
  E.layout = await page.evaluate(() => { const r = document.getElementById("board").getBoundingClientRect(), n = document.getElementById("banner").getBoundingClientRect(); return { board: [Math.round(r.width), Math.round(r.height), Math.round(r.top)], banner: Math.round(n.height), wide: document.body.classList.contains("wide") }; });
  await page.screenshot({ path: `${OUT}/${key}-play.png` });
  await page.evaluate(() => { SP.load("w1-t1"); });
  await page.waitForTimeout(100);
  await hits(page, key + " hint");
  await page.screenshot({ path: `${OUT}/${key}-hint.png` });
  ok(E.console.length === 0, `${key}: console messages ${JSON.stringify(E.console)}`);
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
  // Play a level entirely on the manual clock while hidden: the show and the panel only move when ticked.
  const res = await page.evaluate(() => {
    const lv = SP.levels().find((l) => l.world === 2) || SP.levels()[0];
    SP.load(lv.id);
    for (const [x, y] of lv.line) { SP.tapCell(x, y); SP.tapCell(x, y); }
    const before = SP.state();
    SP.tick(10000);
    return { id: lv.id, panelBeforeTick: before.panel, showBefore: before.show.active, after: SP.state() };
  });
  H.play = { id: res.id, panelBeforeTick: res.panelBeforeTick, showBeforeTick: res.showBefore, panel: res.after.panel, won: res.after.won, showAfter: res.after.show.active };
  ok(res.after.won && res.panelBeforeTick === null && res.showBefore && !res.after.show.active && res.after.panel === "win", "hidden: manual-clock win " + JSON.stringify(H.play));
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
  ok(H.console.length === 0, "hidden: console messages " + JSON.stringify(H.console));
  await ctx.close();
}

try {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  await run(browser, "desktop", { width: 1280, height: 720 }, false);
  await run(browser, "phone", { width: 375, height: 812 }, true);
  await extra(browser, { width: 390, height: 844 }, true);
  await extra(browser, { width: 768, height: 1024 }, true);
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
for (const [k, R] of Object.entries(report.runs)) brief[k] = { selfTest: `${R.selfTest.ok} solved ${R.selfTest.solved}/${R.selfTest.levels} in ${R.selfTest.ms} ms, show ${JSON.stringify(R.selfTest.show)}, chest ${R.selfTest.chest}`,
  wins: R.wins.map((w) => w.id + (w.ok ? "" : "!")).join(","), stucks: R.stucks.map((w) => w.id + (w.ok ? "" : "!")).join(","), screens: R.screens, skip: R.skip, speed: R.speed, mute: R.mutePersist,
  bench: R.bench && `${R.bench.msPerDraw.toFixed(3)} ms/draw @ ${R.bench.canvas}`, frames: R.frames && `mean ${R.frames.meanMs.toFixed(1)} p95 ${R.frames.p95Ms.toFixed(1)} ms`, layout: R.layout, console: R.console.length };
console.log(JSON.stringify({ ok: report.ok, payload: { files: report.payload.files, kb: report.payload.kb, external: report.payload.external }, runs: brief, extra: Object.fromEntries(Object.entries(report.extra).map(([k, v]) => [k, v.layout])),
  hidden: report.hidden && { selfTest: report.hidden.selfTest.ok, play: report.hidden.play, afterShow: report.hidden.afterShow, cacheDrop: report.hidden.cacheDrop, console: report.hidden.console.length }, fails: report.fails }, null, 1));
process.exit(report.ok ? 0 : 1);
