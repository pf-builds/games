// Critic v4-1 Part 2b: linked jam sheet, busiest moment (4x CPU throttle), other viewports, console errors.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const PW = await import(process.env.PLAYWRIGHT_MODULE); const { chromium } = PW.default || PW;
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), SHOTS = path.join(root, 'tools/shots-v4-critic1/functional'), BASE = 'http://127.0.0.1:8492/sappers-path/';
const R = {}, errs = []; const ok = (k, pass, info) => { R[k] = { pass: !!pass, info }; console.log((pass ? 'PASS ' : 'FAIL ') + k + ' :: ' + JSON.stringify(info).slice(0, 900)); };
const b = await chromium.launch(); const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function newPage(opts, label) { const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${label}] ${m.type()}: ${m.text()}`); }); p.on('pageerror', (e) => errs.push(`[${label}] PAGEERROR ${e.message}`)); return { ctx, p }; }
const phone = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
{ const { p, ctx } = await newPage(phone, 'phone2'); await p.goto(BASE + '?debug=1'); await p.waitForFunction(() => window.SP && !document.querySelector('#title').hidden); await p.evaluate(() => localStorage.clear());
  // linked jam sheet: fixture, stuck squads first, then only linked fronts are left with 1 free space
  await p.evaluate(() => SP.fixture('linkJamLevel', 'normal')); await wait(200);
  for (const c of [0, 1, 2, 3]) { await p.tap(`#tray button.tile.card[data-col="${c}"]`); await wait(80); await p.evaluate(() => SP.settle()); }
  await p.waitForFunction(() => SP.state().panel, null, { timeout: 8000 }).catch(() => {}); await wait(450);
  const lj = await p.evaluate(() => ({ s: SP.state(), title: document.querySelector('#p-title').textContent, line: document.querySelector('#p-line').textContent }));
  await p.screenshot({ path: path.join(SHOTS, 'phone-linked-jam.png') });
  ok('linked jam sheet text', lj.s.reason === 'jam' && /linked squads need 2 free spaces/i.test(lj.line), { status: lj.s.status, reason: lj.s.reason, title: lj.title, line: lj.line });
  // busiest moment under 4x CPU throttle: e1-11 on Easy, rush every front (the biggest fronts in the file, 210 sappers)
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.evaluate(() => SP.load('e1-11', 'easy')); await wait(400);
  await p.evaluate(() => { window.__dt = []; window.__lt = []; let last = performance.now(); const f = (t) => { window.__dt.push(t - last); last = t; if (window.__dt.length < 600) requestAnimationFrame(f); }; requestAnimationFrame(f);
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: false }); } catch (e) {} });
  for (let k = 0; k < 5; k++) { await p.tap(`#tray button.tile.card[data-col="${k}"]`).catch(() => {}); await wait(90); }
  let peak = 0, peakOut = 0; for (let k = 0; k < 20; k++) { const s = await p.evaluate(() => SP.state()); peak = Math.max(peak, s.runners); peakOut = Math.max(peakOut, s.out); if (k === 6) await p.screenshot({ path: path.join(SHOTS, 'phone-busiest-e1-11.png') }); await wait(200); }
  const res = await p.evaluate(() => ({ dt: window.__dt.slice(3), lt: window.__lt })); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const dt = res.dt.sort((a, c) => a - c), q = (x) => dt[Math.floor(x * (dt.length - 1))];
  ok('busiest moment frame pacing (4x CPU throttle)', q(0.95) < 34 && dt.filter((x) => x > 50).length <= 3, { frames: dt.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: +dt[dt.length - 1].toFixed(1), over33: dt.filter((x) => x > 33.4).length, over50: dt.filter((x) => x > 50).length, longtasks: res.lt.length, longtaskMax: Math.max(0, ...res.lt), peakRunners: peak, peakOut });
  // unthrottled, same moment
  await p.evaluate(() => SP.load('e1-11', 'easy')); await wait(300); await p.evaluate(() => { window.__dt = []; let last = performance.now(); const f = (t) => { window.__dt.push(t - last); last = t; if (window.__dt.length < 300) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  for (let k = 0; k < 5; k++) { await p.tap(`#tray button.tile.card[data-col="${k}"]`).catch(() => {}); await wait(90); } await wait(4000); const d2 = (await p.evaluate(() => window.__dt.slice(3))).sort((a, c) => a - c);
  ok('busiest moment frame pacing (no throttle)', d2[Math.floor(0.95 * (d2.length - 1))] < 20, { frames: d2.length, p95: +d2[Math.floor(0.95 * (d2.length - 1))].toFixed(1), max: +d2[d2.length - 1].toFixed(1), over33: d2.filter((x) => x > 33.4).length });
}
async function vp(label, opts, url, frameSel) { const { p } = await newPage(opts, label); await p.goto(url); let F = p.mainFrame(); if (frameSel) { await p.waitForSelector(frameSel); F = await (await p.$(frameSel)).contentFrame(); }
  const tap = (sel) => (opts.hasTouch ? F.tap(sel) : F.click(sel));
  await F.waitForFunction(() => window.SP && !document.querySelector('#title').hidden); await F.evaluate(() => localStorage.clear()); await tap('#btn-play'); await F.waitForFunction(() => SP.state().screen === 'play'); await wait(400);
  const probe = () => F.evaluate(() => { const hit = (sel) => { const el = document.querySelector(sel); if (!el) return 'missing'; const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t === el || el.contains(t) ? 'ok' : 'covered by ' + (t && (t.id || t.className)); };
    const tiles = [...document.querySelectorAll('#tray button.tile.card')].map((b) => { const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t === b || b.contains(t) ? 'ok' : 'X'; }).join(' ');
    const s = SP.state(); const tr = document.querySelector('#tray').getBoundingClientRect(), bd = document.querySelector('#board').getBoundingClientRect();
    return { id: s.id, cs: s.cs, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, scrollH: document.documentElement.scrollHeight, innerH: innerHeight, map: hit('#btn-map'), retry: hit('#btn-retry'), speed: hit('#top .tog-speed'), mute: hit('#top .tog-mute'), tiles, trayBottom: Math.round(tr.bottom), board: [Math.round(bd.width), Math.round(bd.height)] }; });
  const i1 = await probe();
  // real taps to the win on level 1, then the sheet's primary button
  for (const c of await F.evaluate(() => SP.winOrder('normal'))) { await tap(`#tray button.tile.card[data-col="${c}"]`); await wait(60); await F.evaluate(() => SP.settle()); }
  await F.waitForFunction(() => SP.state().panel, null, { timeout: 12000 }).catch(() => {}); await wait(450);
  const sheet = await F.evaluate(() => { const out = {}; for (const id of ['p-primary', 'p-secondary']) { const el = document.querySelector('#' + id); const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); out[id] = el.textContent + ':' + (t === el || el.contains(t) ? 'ok' : 'X'); } out.panel = SP.state().panel; return out; });
  await tap('#p-primary'); await wait(300); const after = await F.evaluate(() => SP.state().id);
  const cs = {}; for (const n of [62, 77, 100]) { await F.evaluate((n) => SP.load(n, 'normal'), n); await wait(350); cs[n] = await probe(); }
  await p.screenshot({ path: path.join(SHOTS, label + '-l100.png') });
  const bad = [i1, ...Object.values(cs)].filter((x) => x.cs < 8 || x.scrollW > x.innerW || x.scrollH > x.innerH + 1 || x.map !== 'ok' || x.retry !== 'ok' || x.speed !== 'ok' || x.mute !== 'ok' || /X/.test(x.tiles));
  ok('viewport ' + label, !bad.length && /ok/.test(sheet['p-primary']) && after === 'e1-02', { l1: i1, sheet, next: after, l62: cs[62], l77: cs[77], l100: cs[100], bad: bad.map((x) => x.id) }); }
await vp('375x812', phone, BASE + '?debug=1');
await vp('1280x720', { viewport: { width: 1280, height: 720 } }, BASE + '?debug=1');
await vp('812x375', { viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, BASE + '?debug=1');
await vp('iframe400x600', { viewport: { width: 800, height: 700 } }, BASE + 'tools/iframe-host.html', '#game');
ok('zero console errors/warnings (part 2b)', errs.length === 0, errs.slice(0, 20));
fs.writeFileSync(path.join(here, 'play2-result.json'), JSON.stringify(R, null, 1)); await b.close();
