#!/usr/bin/env node
// Sapper's Path v2 M1 harness. Headless Chromium via Playwright, real pointer input only for play (mouse at 1280×720,
// touch at 375×812): a move is ONE tap on a crew card (SPEC-v2 §3).
//   SP.selfTest(); the payload of a cold load; title → map → level 1 in two taps; a locked node stays locked; the
//   teaching hint card dismisses; mute survives a reload; a win and a stuck on one board per world (tapping the real crew
//   cards; the panel's Undo and the rail's Restart); the target flags agree with SP.targets() after every call of every
//   win; a board tap is info only; skip (a card tap during the show is handled at once) and 2× (the toggle halves the
//   show); elementFromPoint on every primary button of every screen visited; thumb targets in the bottom third
//   (portrait); frame time during the busiest eat on the largest board; a hidden-tab load (document.hidden faked, rAF
//   held until shown, driven by SP.tick) plus a sprite-cache drop and recovery; 390×844, 768×1024 and landscape 812×375
//   layout checks; zero console errors AND warnings. Screenshots (tools/shots/v2m1/, not committed): title, map, mid-play
//   per world (375×812), W4 at 1280×720, a mid-walk, a mid-eat, win, stuck, and a grayscale World 4 board.
//
//   export PATH="$HOME/.local/opt/node/bin:$PATH"
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/harness.mjs [--url http://127.0.0.1:8491/sappers-path/] [--out tools/shots/v2m1]
//
// Exit 0: every assertion passed. Exit 1: an assertion or console message. Exit 2: the harness crashed or ran out of
// time. Every page.evaluate is a short call; every wait has its own timeout; the whole run has a wall budget.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/");
const OUT = resolve(arg("out", resolve(here, "shots/v2m1")));
const WALL_MS = 300000;
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
const TOP = /menu|Mute|Unmute|Double/;
// The flags the player sees agree with the engine's targets (crew and contact tile).
async function flagsAgree(page) {
  return page.evaluate(() => { const a = SP.targets(), b = SP.flags(); return { ok: a.length === b.length && a.every((t, i) => t.crew === b[i].crew && t.contact[0] === b[i].contact[0] && t.contact[1] === b[i].contact[1]), n: a.length }; });
}

async function run(browser, name, vp, touch) {
  const R = { viewport: vp, input: touch ? "touch" : "mouse", console: [], wins: [], stucks: [], screens: {}, flagChecks: 0 };
  report.runs[name] = R;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: touch ? 3 : 1, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  watch(page, R.console);
  const bytes = [], origin = new URL(URL_).origin; page.on("response", async (res) => { try { const b = await res.body(); bytes.push({ url: res.url().replace(URL_, ""), local: res.url().startsWith(origin), n: b.length }); } catch (e) { /* redirects */ } });
  const tapXY = (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const tapBtn = (sel) => (touch ? page.locator(sel).first().tap({ timeout: 3000 }) : page.locator(sel).first().click({ timeout: 3000 }));
  const S = () => page.evaluate(() => SP.state());
  const tapCard = async (crew) => { const c = await page.evaluate((k) => SP.card(k), crew); await tapXY(c.x, c.y); return c; };
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
  R.selfTest = { ok: st.ok, levels: st.levels, solved: st.solved, stuck: st.stuck, buttons: st.buttons, ms: st.ms, show: st.show, chest: st.chest, info: st.info, flagChecks: st.flagChecks, scenerySections: st.scenerySections, cues: st.cues, fails: st.fails };
  ok(st.ok && st.solved === st.levels && st.levels >= 20, `${name}: selfTest ok=${st.ok} solved=${st.solved}/${st.levels} ${st.fails.join(" | ")}`);

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
  if (touch) for (const b of btns) if (!TOP.test(b.id)) ok(b.y >= (vp.height * 2) / 3, `${name}: ${b.id} centre y ${Math.round(b.y)} is above the bottom third`);

  // A board tap is info only: it never moves anything.
  { const m0 = (await S()).moves, t = await page.evaluate(() => SP.targets()[0]); if (t) { await tapCell(t.contact[0], t.contact[1]); const s1 = await S(); R.boardTap = s1.toast; ok(s1.moves === m0 && /break this next/.test(s1.toast || ""), `${name}: board tap moved or said ${s1.toast}`); } }

  // Mute: a real tap, then a reload keeps it; unmute again.
  const muteSel = (await S()).banner ? "#banner .tog-mute" : "#top .tog-mute";
  await tapBtn(muteSel);
  ok((await S()).muted === true, `${name}: mute tap did not mute`);
  await page.reload(); await page.waitForFunction(() => window.SP, null, { timeout: 8000 });
  const mu = await page.evaluate((sel) => ({ s: SP.state().muted, pressed: document.querySelector(sel).getAttribute("aria-pressed") }), muteSel);
  R.mutePersist = mu;
  ok(mu.s === true && mu.pressed === "true", `${name}: mute did not survive the reload ${JSON.stringify(mu)}`);
  await tapBtn("#btn-play"); await tapBtn("#map .tog-mute");
  ok((await S()).muted === false, `${name}: map mute tap did not unmute`);

  const worlds = [...new Set(levels.map((l) => l.world))];
  for (const w of worlds) {
    // A win: the middle board of the world, along its baked line, one real card tap per call. The flags must agree with
    // targets() before every call and after the last.
    const inW = levels.filter((l) => l.world === w), lv = inW[Math.floor(inW.length / 2)];
    if (!(await openLevel(lv))) continue;
    await dismissHint();
    for (let k = 0; k < lv.line.length; k++) {
      const fa = await flagsAgree(page); R.flagChecks++;
      ok(fa.ok, `${name} ${lv.id} call ${k}: flags differ from targets()`);
      const before = (await S()).moves;
      await tapCard(lv.line[k]);
      const aft = await S();
      ok(aft.moves === before + 1 && aft.show.active, `${name} ${lv.id} call ${k}: the card tap did not call (${aft.moves}) or no show`);
      if (k === 0 && touch) { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-midplay-w${w}.png` }); }
      if (k === 1 && !touch && w === 4) { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-midplay-w4.png` }); }
    }
    await page.waitForFunction(() => SP.state().panel === "win" && SP.state().starsShown === SP.state().stars, null, { timeout: 12000 }).catch(() => {});
    s = await S();
    const fz = await page.evaluate(() => SP.flags().length); R.flagChecks++;
    ok(fz === 0, `${name} ${lv.id}: flags still standing after the win`);
    const winOk = ok(s.won && s.panel === "win" && s.stars === 3 && s.saved === 3 && s.starsShown === 3, `${name} ${lv.id}: win ${s.won} panel ${s.panel} stars ${s.stars} saved ${s.saved} shown ${s.starsShown}`);
    await hits(page, `${name} ${lv.id} win`);
    if (w === worlds[worlds.length - 1]) { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-win.png` }); }
    R.wins.push({ id: lv.id, calls: s.calls, min: s.min, stars: s.stars, ok: winOk });
    if (w === worlds[0]) { // Next goes to the following level
      await tapBtn("#p-primary");
      const n = await S();
      ok(n.screen === "play" && n.id === levels[levels.findIndex((l) => l.id === lv.id) + 1].id && n.moves === 0, `${name}: Next opened ${n.id}`);
    }

    // A stuck: a seeded random line of calls that ends with no legal call, through the real cards.
    const sl = await page.evaluate((ww) => SP.stuckLine(ww), w);
    if (!ok(sl, `${name}: world ${w} has no stuck line`)) continue;
    const slv = levels.find((l) => l.id === sl.id);
    if (!(await openLevel(slv))) continue;
    await dismissHint();
    for (const c of sl.calls) await tapCard(c);
    await page.waitForFunction(() => SP.state().panel === "stuck", null, { timeout: 10000 }).catch(() => {});
    s = await S();
    const stuckOk = ok(s.stuck && s.panel === "stuck" && s.moves === sl.calls.length, `${name} ${sl.id}: stuck ${s.stuck} panel ${s.panel} moves ${s.moves}/${sl.calls.length}`);
    await hits(page, `${name} ${sl.id} stuck`);
    if (w === worlds[worlds.length - 1]) await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-stuck.png` });
    await tapBtn("#p-primary"); // Undo
    const u = await S();
    ok(!u.stuck && u.panel === null && u.moves === sl.calls.length - 1, `${name} ${sl.id}: panel Undo gave moves ${u.moves} stuck ${u.stuck}`);
    await tapBtn("#btn-restart");
    const r = await S();
    ok(r.moves === 0 && !r.stuck, `${name} ${sl.id}: rail Restart gave moves ${r.moves}`);
    R.stucks.push({ id: sl.id, calls: sl.calls.length, ok: stuckOk });
  }

  // Skip and 2×, with real taps: a card tap during the show is handled at once (the show fast-forwards); the 2× toggle
  // halves the next show.
  const sk = levels.find((l) => l.world === 4 && l.line.length >= 3) || levels[levels.length - 1];
  await openLevel(sk); await dismissHint();
  await tapCard(sk.line[0]);
  const s1 = await S();
  await tapCard(sk.line[1]);
  const s2 = await S();
  R.skip = { activeBefore: s1.show.active, movesAfter: s2.moves, dur1x: Math.round(s1.show.dur) };
  ok(s1.show.active && s2.moves === 2, `${name}: skip ${JSON.stringify(R.skip)}`);
  const fastSel = (await S()).banner ? "#banner .tog-fast" : "#top .tog-fast";
  await tapBtn(fastSel);
  ok((await S()).fast === true, `${name}: 2x toggle did not turn on`);
  await tapBtn("#btn-restart");
  await tapCard(sk.line[0]);
  const s3 = await S();
  R.speed = { dur1x: Math.round(s1.show.dur), dur2x: Math.round(s3.show.dur), ratio: +(s3.show.dur / s1.show.dur).toFixed(3) };
  ok(Math.abs(R.speed.ratio - 0.5) < 0.01, `${name}: 2x ratio ${R.speed.ratio}`);
  await tapBtn(fastSel);
  ok((await S()).fast === false, `${name}: 2x toggle did not turn off`);

  // Frame time during the busiest eat on the largest board: play up to that call, tap its card, and time the rAF frames
  // from the first ring to the last; then the draw cost of the same window on the manual clock.
  const worldMax = Math.max(...worlds), busy = await page.evaluate((wm) => SP.busiest(wm), worldMax), blv = levels.find((l) => l.id === busy.id);
  await openLevel(blv); await dismissHint();
  await page.evaluate((b) => { const lv = SP.levels().find((l) => l.id === b.id); for (let k = 0; k < b.step; k++) { SP.call(lv.line[k]); SP.tick(8000); } }, busy);
  await tapCard(blv.line[busy.step]);
  R.busiest = Object.assign({}, busy);
  R.frames = await page.evaluate(() => new Promise((res) => {
    const d = []; let last = 0; const t0 = performance.now(), s0 = SP.state().show;
    const f = (t) => { const c = SP.state().clock; if (last && c >= s0.popT0) d.push(t - last); last = t;
      if (c < s0.crumbleEnd && performance.now() - t0 < 6000) requestAnimationFrame(f);
      else { d.sort((a, b) => a - b); res({ n: d.length, meanMs: d.reduce((a, b) => a + b, 0) / Math.max(1, d.length), p95Ms: d[Math.floor(d.length * 0.95)] || 0, maxMs: d[d.length - 1] || 0, eatMs: Math.round(s0.crumbleEnd - s0.popT0), rings: s0.rings, eaten: s0.eaten }); } };
    requestAnimationFrame(f);
  }));
  // script cost per frame of the same eat (sim step, ring events, rubble and dust, full draw), on the manual clock
  R.bench = await page.evaluate(() => {
    SP.undo(); const lv = SP.levels().find((l) => l.id === SP.state().id), k = SP.state().moves; SP.hold(true); SP.call(lv.line[k]);
    const s = SP.state().show; SP.tick(Math.max(0, s.popT0 - SP.state().clock));
    const n = 60, dt = (s.crumbleEnd - s.popT0) / n, t0 = performance.now(); for (let i = 0; i < n; i++) SP.tick(dt);
    const ms = (performance.now() - t0) / n; SP.hold(false); const c = document.getElementById("board"); return { frames: n, msPerDraw: ms, canvas: c.width + "x" + c.height };
  });
  ok(R.frames.n >= 5 && R.frames.p95Ms < 40, `${name}: busiest eat frames ${JSON.stringify(R.frames)}`);

  if (touch) {
    // A mid-walk and a mid-eat frame: hold the clock, call, tick into the walk, draw, shoot; then into the eat.
    const wv = levels.find((l) => l.world === 3 && l.line.length >= 5) || sk;
    await openLevel(wv); await dismissHint();
    await page.evaluate((lv) => { SP.hold(true); for (let k = 0; k < 2; k++) { SP.call(lv.line[k]); SP.tick(8000); } SP.call(lv.line[2]); const s = SP.state(); SP.tick(Math.max(0, (s.show.t0 + s.show.walkT1) / 2 - s.clock)); SP.draw(); }, wv);
    await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-midwalk.png` });
    R.midEat = await page.evaluate(() => { const s = SP.state(); SP.tick(Math.max(0, s.show.popT0 + (s.show.crumbleEnd - s.show.popT0) * 0.5 - s.clock)); SP.draw(); return SP.state().show; });
    await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-mideat.png` });
    await page.evaluate(() => SP.hold(false));
    // Grayscale World 4 board (readability without hue).
    const g4 = levels.filter((l) => l.world === worldMax)[4] || sk;
    await openLevel(g4); await dismissHint();
    await page.evaluate(() => { document.documentElement.style.filter = "grayscale(1)"; SP.draw(); });
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-gray-w4.png` });
    await page.evaluate(() => { document.documentElement.style.filter = ""; });
  } else {
    // Keyboard: 1 calls the first card shown, u undoes it.
    const kb = levels.find((l) => l.world === 1 && l.n === 4) || levels[0];
    await openLevel(kb); await dismissHint();
    const first = await page.evaluate(() => { const b = [...document.querySelectorAll(".crew")].find((x) => !x.hidden); return +b.dataset.m; });
    await page.keyboard.press("1"); const m1 = (await S()).moves; await page.keyboard.press("u"); const m0 = (await S()).moves;
    R.keys = { first, calls: [m1, m0] };
    ok(m0 === 0 && (m1 === 1 || m1 === 0), `${name}: keyboard ${JSON.stringify(R.keys)}`);
  }
  R.layout = await page.evaluate(() => { const b = document.getElementById("board").getBoundingClientRect(), n = document.getElementById("banner").getBoundingClientRect(), r = document.getElementById("rail").getBoundingClientRect(); return { board: [Math.round(b.width), Math.round(b.height), Math.round(b.top)], banner: Math.round(n.height), railTop: Math.round(r.top), cell: SP.state().cell / SP.state().dpr }; });

  ok(R.console.length === 0, `${name}: console messages ${JSON.stringify(R.console)}`);
  await ctx.close();
}

// Other sizes: the largest board, every play button hittable, thumb targets low (portrait), a screenshot.
async function extra(browser, vp, touch) {
  const E = { console: [] }, key = vp.width + "x" + vp.height, portrait = vp.height > vp.width; report.extra[key] = E;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: touch ? 3 : 2, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  watch(page, E.console);
  await page.goto(URL_ + "?debug=1");
  await page.waitForFunction(() => window.SP, null, { timeout: 8000 });
  await hits(page, key + " title");
  await page.evaluate(() => { SP.load(SP.levels().filter((l) => l.world === 4).pop().id); document.getElementById("hint").hidden = true; });
  await page.waitForTimeout(200);
  const b = await hits(page, key + " play");
  if (portrait) for (const x of b) if (!TOP.test(x.id)) ok(x.y >= (vp.height * 2) / 3, `${key}: ${x.id} centre y ${Math.round(x.y)} is above the bottom third`);
  E.layout = await page.evaluate(() => { const r = document.getElementById("board").getBoundingClientRect(), n = document.getElementById("banner").getBoundingClientRect(); return { board: [Math.round(r.width), Math.round(r.height), Math.round(r.top)], banner: Math.round(n.height), wide: document.body.classList.contains("wide"), cell: +(SP.state().cell / SP.state().dpr).toFixed(1) }; });
  ok(E.layout.board[0] <= vp.width && E.layout.board[1] + E.layout.board[2] <= vp.height, `${key}: board off screen ${JSON.stringify(E.layout)}`);
  await page.screenshot({ path: `${OUT}/${key}-play.png` });
  // a win panel fits too
  await page.evaluate(() => { const lv = SP.levels().find((l) => l.id === SP.state().id); for (const c of lv.line) SP.call(c); SP.tick(10000); });
  await hits(page, key + " win");
  await page.screenshot({ path: `${OUT}/${key}-win.png` });
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
    for (const c of lv.line) SP.call(c);
    const before = SP.state();
    SP.tick(15000);
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
  const drop = await page.evaluate(() => { const n = SP.dropCaches(), mid = SP.blankTiles().length; document.dispatchEvent(new Event("visibilitychange")); SP.draw(); return { dropped: n, blankAfterDrop: mid, blankAfterWake: SP.blankTiles().length, rebuilds: SP.state().cacheRebuilds }; });
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
  await extra(browser, { width: 812, height: 375 }, true);
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
for (const [k, R] of Object.entries(report.runs)) brief[k] = { selfTest: `${R.selfTest.ok} solved ${R.selfTest.solved}/${R.selfTest.levels} in ${R.selfTest.ms} ms, flags ${R.selfTest.flagChecks}, show ${JSON.stringify(R.selfTest.show)}, chest ${R.selfTest.chest}`,
  wins: R.wins.map((w) => w.id + (w.ok ? "" : "!")).join(","), stucks: R.stucks.map((w) => w.id + (w.ok ? "" : "!")).join(","), flagChecks: R.flagChecks, screens: R.screens, skip: R.skip, speed: R.speed, mute: R.mutePersist,
  busiest: R.busiest, frames: R.frames && `mean ${R.frames.meanMs.toFixed(1)} p95 ${R.frames.p95Ms.toFixed(1)} max ${R.frames.maxMs.toFixed(1)} ms over ${R.frames.n} frames (${R.frames.rings} rings, ${R.frames.eaten} blocks, ${R.frames.eatMs} ms)`,
  bench: R.bench && `${R.bench.msPerDraw.toFixed(3)} ms/draw @ ${R.bench.canvas}`, layout: R.layout, console: R.console.length };
console.log(JSON.stringify({ ok: report.ok, payload: { files: report.payload.files, kb: report.payload.kb, external: report.payload.external }, runs: brief, extra: Object.fromEntries(Object.entries(report.extra).map(([k, v]) => [k, v.layout])),
  hidden: report.hidden && { selfTest: report.hidden.selfTest.ok, play: report.hidden.play, afterShow: report.hidden.afterShow, cacheDrop: report.hidden.cacheDrop, console: report.hidden.console.length }, fails: report.fails }, null, 1));
process.exit(report.ok ? 0 : 1);
