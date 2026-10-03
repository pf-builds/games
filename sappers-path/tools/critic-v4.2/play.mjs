// Critic v4.2 browser pass: 375x812 (touch) and the 400x600 iframe, on a full-size moat castle, the boss and a Gallery picture:
// win (real taps), a loss (moat level, a jam order from the critic's rules), a refused tap, one power-up (Ladder via its badge),
// the busiest moment (every front rushed; rAF + long tasks; 4x CPU throttle on the phone), zero console errors.
// node tools/critic-v4.2/play.mjs (server :8492)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { compile, Game } from '../critic-v4.1/rules.mjs';
const PW = await import(process.env.PLAYWRIGHT_MODULE); const { chromium } = PW.default || PW;
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), SHOTS = path.join(root, 'tools/shots-v4.2-critic/functional'), BASE = 'http://127.0.0.1:8492/sappers-path/';
fs.mkdirSync(SHOTS, { recursive: true });
const J = (f) => JSON.parse(fs.readFileSync(path.join(root, f))), LV = J('levels/levels.json').levels, GAL = J('levels/gallery.json').levels, cfg = J('config.json');
const moat = LV.find((l) => l.n >= 27 && l.n < 51 && !l.teaches && l.w === 42 && (l.gates || []).length && l.grid.some((r) => r.startsWith('~'))), boss = LV.find((l) => l.n === 100), pic = GAL[3];
const lossOf = (L) => { for (let seed = 1; seed < 200; seed++) { let s = seed; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); const r = cfg.v3.rules.normal, G = new Game(compile(L), { hold: r.hold, archersKill: r.archersKill, lockSpaces: 1 }, cfg.v3.time), o = [];
  while (G.status === 0 && o.length < 120) { const lg = [0, 1, 2, 3, 4].filter((c) => G.legal(c)); const c = lg[Math.floor(rnd() * lg.length)]; o.push(c); G.play(c); G.quiet(); } if (G.status === -1) return o; } return null; };
const R = {}, errs = []; const ok = (k, pass, info) => { R[k] = { pass: !!pass, info }; console.log((pass ? 'PASS ' : 'FAIL ') + k + ' :: ' + JSON.stringify(info).slice(0, 1000)); };
const b = await chromium.launch(); const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(label, opts, url, frameSel, throttle) { const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${label}] ${m.type()}: ${m.text()}`); }); p.on('pageerror', (e) => errs.push(`[${label}] PAGEERROR ${e.message}`));
  await p.goto(url); let F = p.mainFrame(); const frame = async () => { if (frameSel) { await p.waitForSelector(frameSel); F = await (await p.$(frameSel)).contentFrame(); } await F.waitForFunction(() => window.SP && SP.state().screen === 'title'); };
  await frame(); await F.evaluate(() => localStorage.clear()); await p.reload(); await frame(); await F.evaluate(() => SP.unlockTo(99));
  const tap = (sel) => (opts.hasTouch ? F.tap(sel, { timeout: 3000 }) : F.click(sel, { timeout: 3000 })); const st = () => F.evaluate(() => SP.state()); const cdp = await ctx.newCDPSession(p);
  for (const L of [moat, boss, pic]) { const out = {};
    await F.evaluate((id) => SP.load(id, 'normal'), L.id); await wait(300); out.css = +((await st()).cs / (await F.evaluate(() => devicePixelRatio))).toFixed(2);
    for (const c of L.win.normal) { const s = await st(); if (s.status !== 'playing') break; await tap(`#tray button.tile.card[data-col="${c}"]`); await F.evaluate(() => SP.settle()); }
    await F.waitForFunction(() => SP.state().panel, null, { timeout: 15000 }).catch(() => {}); await wait(500); let s = await st(); out.win = `${s.status} | ${await F.evaluate(() => document.querySelector('#p-title').textContent)}`;
    if (L === moat) { const lo = lossOf(L); await F.evaluate((id) => SP.load(id, 'normal'), L.id); await wait(150); for (const c of lo || []) { const s2 = await st(); if (s2.status !== 'playing') break; await tap(`#tray button.tile.card[data-col="${c}"]`); await F.evaluate(() => SP.settle()); }
      await F.waitForFunction(() => SP.state().panel, null, { timeout: 10000 }).catch(() => {}); await wait(400); s = await st(); out.loss = `${s.status}/${s.reason} | ${await F.evaluate(() => (document.querySelector('#p-line').getAttribute('aria-label') || '').slice(0, 80))}`; }
    // refusal
    await F.evaluate((id) => SP.load(id, 'normal'), L.id); await wait(150); await F.evaluate(() => SP.fill()); const b4 = await st(); const fc = b4.fronts.findIndex((x) => x);
    if (b4.li.free === 0 && fc >= 0) { await tap(`#tray button.tile.card[data-col="${fc}"]`); await wait(120); const af = await st(); out.refused = `${af.refused - b4.refused} refused, plays ${b4.plays}->${af.plays}`; } else out.refused = 'line not full';
    // power-up
    await F.evaluate((id) => { SP.setMeta({ inv: { ladder: 1, quartermaster: 0, scout: 0, recall: 0 } }); SP.load(id, 'normal'); }, L.id); await wait(200); const p0 = await st(); await tap('#powers .pw[data-k="0"]'); await wait(150); const p1 = await st(); out.ladder = `open ${p0.open}->${p1.open}, inv ${(await F.evaluate(() => SP.meta())).inv.ladder}`;
    // busiest moment
    await F.evaluate((id) => SP.load(id, 'normal'), L.id); await wait(300); if (throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await F.evaluate(() => { window.__dt = []; window.__lt = []; let last = performance.now(); const f = (t) => { window.__dt.push(t - last); last = t; if (window.__dt.length < 500) requestAnimationFrame(f); }; requestAnimationFrame(f); try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask' }); } catch (e) {} });
    let peak = 0; for (let k = 0; k < 5; k++) { await tap(`#tray button.tile.card[data-col="${k}"]`).catch(() => {}); await wait(70); } for (let k = 0; k < 20; k++) { peak = Math.max(peak, (await st()).runners); if (k === 8 && L === boss) await p.screenshot({ path: path.join(SHOTS, `${label}-boss-busiest.png`) }); await wait(200); }
    const pf = await F.evaluate(() => SP.perf(30)); const res = await F.evaluate(() => ({ dt: window.__dt.slice(3), lt: window.__lt })); if (throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const dt = res.dt.sort((x, y) => x - y), q = (x) => dt[Math.floor(x * (dt.length - 1))]; out.busiest = { cpu: throttle ? throttle + 'x' : '1x', peakRunners: peak, frames: dt.length, p95: +q(0.95).toFixed(1), max: +dt[dt.length - 1].toFixed(1), over33: dt.filter((x) => x > 33.4).length, longtasks: res.lt.length, draw: pf };
    const pass = /^won/.test(out.win) && (L !== moat || /^failed/.test(out.loss)) && /^1 refused, plays (\d+)->\1/.test(out.refused) && p1.open === p0.open + 1 && out.busiest.p95 < 34 && out.busiest.over33 <= 3;
    ok(`${label} ${L.id} (${L === moat ? 'moat castle' : L === boss ? 'boss' : 'Gallery'} ${L.w}x${L.h})`, pass, out); }
  if (label === '375x812') { const t = Date.now(); const r = await F.evaluate(() => SP.selfTest()); ok('SP.selfTest()', !r.fail.length, `pass ${r.pass} fail ${JSON.stringify(r.fail).slice(0, 400)} in ${Date.now() - t} ms`); }
  await ctx.close(); }
await run('375x812', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, BASE + '?debug=1', null, 4);
await run('iframe400x600', { viewport: { width: 800, height: 700 } }, BASE + 'tools/iframe-host.html', '#game', 0);
ok('zero console errors/warnings', errs.length === 0, errs.slice(0, 10)); console.log('levels:', moat.id, boss.id, pic.id);
fs.writeFileSync(path.join(here, 'play-result.json'), JSON.stringify(R, null, 1)); await b.close();
