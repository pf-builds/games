// Critic v4-2 Part 2b: Gallery loss (a jam order found by the critic's rules), junk-save rewrite, Recall/QM refusals via the
// real buttons, jam sheet label, and the five viewports (all 164 boards: rows and CSS px a cell; home -> Play; power bar hit tests).
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { compile, Game } from './rules.mjs';
const PW = await import(process.env.PLAYWRIGHT_MODULE); const { chromium } = PW.default || PW;
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), SHOTS = path.join(root, 'tools/shots-v4-critic2/functional'), BASE = 'http://127.0.0.1:8492/sappers-path/';
const GAL = JSON.parse(fs.readFileSync(path.join(root, 'levels/gallery.json'))).levels, cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json')));
const R = {}, errs = []; const ok = (k, pass, info) => { R[k] = { pass: !!pass, info }; console.log((pass ? 'PASS ' : 'FAIL ') + k + ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 1400)); };
const b = await chromium.launch(); const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function newPage(opts, label) { const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${label}] ${m.type()}: ${m.text()}`); }); p.on('pageerror', (e) => errs.push(`[${label}] PAGEERROR ${e.message}`)); return { ctx, p }; }
const sect = async (name, fn) => { try { await fn(); } catch (e) { ok(name, false, 'threw: ' + e.message.split('\n')[0]); } };
// a patient jam order on Gallery picture #5 (Normal), from the critic's rules
const GL = GAL[4]; let jamOrder = null; for (let seed = 1; seed < 400 && !jamOrder; seed++) { let s = seed; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const r = cfg.v3.rules.normal, G = new Game(compile(GL), { hold: r.hold, archersKill: r.archersKill, lockSpaces: 1 }, cfg.v3.time); const ord = [];
  while (G.status === 0 && ord.length < 80) { const legal = [0, 1, 2, 3, 4].filter((c) => G.legal(c)); const c = legal[Math.floor(rnd() * legal.length)]; ord.push(c); G.play(c); G.quiet(); } if (G.reason === 'jam') jamOrder = ord; }
const phone = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
{ const { p } = await newPage(phone, 'phone'); const st = () => p.evaluate(() => SP.state()), meta = () => p.evaluate(() => SP.meta()); const toast = () => p.evaluate(() => { const t = document.querySelector('#toast'); return t.hidden ? '' : t.textContent; });
  await p.goto(BASE + '?debug=1'); await p.waitForFunction(() => window.SP && SP.state().screen === 'title'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.SP && SP.state().screen === 'title');
  await sect('gallery loss', async () => { await p.evaluate(() => SP.unlockTo(25)); await p.evaluate((id) => SP.load(id, 'normal'), GL.id); await wait(200); const c0 = (await meta()).coins;
    for (const c of jamOrder) { const s = await st(); if (s.status !== 'playing') break; await p.tap(`#tray button.tile.card[data-col="${c}"]`); await p.evaluate(() => SP.settle()); }
    await p.waitForFunction(() => SP.state().panel, null, { timeout: 10000 }); await wait(500); const pn = await p.evaluate(() => ({ txt: document.querySelector('#panel').innerText.replace(/\n+/g, ' | '), aria: document.querySelector('#p-line').getAttribute('aria-label') || [...document.querySelectorAll('#panel [aria-label]')].map((e) => e.getAttribute('aria-label')).join(' / '), chips: document.querySelectorAll('#panel .chip, #p-line i, #p-line span').length }));
    await p.screenshot({ path: path.join(SHOTS, 'phone-gallery-jam.png') }); const s = await st(); const m = await meta();
    ok('Gallery loss: jam sheet with picture palette names in its label, no coins', s.reason === 'jam' && m.coins === c0, { id: GL.id, order: jamOrder.join(''), status: s.status + '/' + s.reason, panel: pn, coins: [c0, m.coins] }); });
  await sect('recall refused on a working squad', async () => { await p.evaluate(() => SP.setMeta({ inv: { ladder: 0, quartermaster: 1, scout: 0, recall: 1 } })); await p.evaluate(() => SP.load(4, 'normal')); await wait(150);
    await p.tap('#tray button.tile.card[data-col="0"]'); await wait(50); await p.tap('#powers .pw[data-k="3"]'); await wait(60); await p.tap('#line .slot:nth-child(1)'); await wait(100); const t = await toast(); const m = await meta(); const s = await st();
    ok('Recall on a working squad is refused with a reason, not spent', m.inv.recall === 1 && s.line.length === 1, { toast: t, inv: m.inv, line: s.line, pick: m.pick }); });
  await sect('junk save rewritten sanitized', async () => { const junk = { v: 1, done: { 'e1-01': 2 }, settings: {}, coins: 1e12, inv: { ladder: 3 }, best: { 'e1-01': [1e9, 5000, 0, 9999, 3, 0, 50], bogus: [1, 2, 3, 4, 5, 6, 7] }, gal: { [GAL[0].id]: 9, nope: 1, [GAL[1].id]: 'x' } };
    await p.evaluate((o) => localStorage.setItem('sappers-path.v3', JSON.stringify(o)), junk); await p.reload(); await p.waitForFunction(() => window.SP && SP.state().screen === 'title'); const m = await meta();
    await p.tap('#btn-settings'); await p.tap('#settings .tog-mute'); await p.tap('#settings .tog-mute'); await p.tap('#set-close'); await wait(100); const s = JSON.parse(await p.evaluate(() => localStorage.getItem('sappers-path.v3')));
    ok('junk save: coins clamped, best/gal sanitized on write', m.coins === 9999999 && !s.best.bogus && s.best['e1-01'] && s.best['e1-01'][0] === 0 && s.best['e1-01'][3] === 0 && !('nope' in s.gal) && (s.gal[GAL[0].id] | 0) <= 7 && !(GAL[1].id in s.gal), { coins: m.coins, best: s.best, gal: s.gal }); });
}
// ---------- viewports ----------
async function vp(label, opts, url, frameSel) { const { p } = await newPage(opts, label); await p.goto(url); let F = p.mainFrame(); if (frameSel) { await p.waitForSelector(frameSel); F = await (await p.$(frameSel)).contentFrame(); }
  const tap = (sel) => (opts.hasTouch ? F.tap(sel) : F.click(sel)); await F.waitForFunction(() => window.SP && SP.state().screen === 'title'); await F.evaluate(() => localStorage.clear()); await p.reload(); if (frameSel) { await p.waitForSelector(frameSel); F = await (await p.$(frameSel)).contentFrame(); } await F.waitForFunction(() => window.SP && SP.state().screen === 'title');
  const hitAll = () => F.evaluate(() => { const hit = (el) => { const r = el.getBoundingClientRect(); if (!(r.width > 0)) return 'hidden'; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t === el || el.contains(t) ? 'ok' : 'X:' + (t && (t.id || t.className)); };
    const out = {}; for (const sel of ['#btn-play', '#btn-settings', '#btn-tomap', '#btn-gallery']) { const e = document.querySelector(sel); out[sel] = e ? hit(e) : 'missing'; } return out; });
  const home = await hitAll(); const t0 = Date.now(); await tap('#btn-play'); await F.waitForFunction(() => SP.state().screen === 'play'); const toPlay = Date.now() - t0; await wait(300);
  const inLevel = await F.evaluate(() => { const hit = (el) => { const r = el.getBoundingClientRect(); if (!(r.width > 0)) return 'hidden'; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t === el || el.contains(t) ? 'ok' : 'X:' + (t && (t.id || t.className)); };
    return { badges: [...document.querySelectorAll('#powers .pw')].map(hit).join(' '), tiles: [...document.querySelectorAll('#tray button.tile.card')].map(hit).join(' '), top: ['#btn-map', '#btn-retry', '#top .tog-speed'].map((s) => hit(document.querySelector(s))).join(' '), overflow: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight], rows: SP.meta().rows }; });
  await F.evaluate(() => { for (const c of SP.winOrder('normal')) { SP.play(+c); SP.settle(); } }); await F.waitForFunction(() => SP.state().panel, null, { timeout: 15000 }); await wait(2600);
  const sheet = await F.evaluate(() => { const r = (id) => { const el = document.querySelector('#' + id); const b = el.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return el.textContent.trim() + ':' + (t === el || el.contains(t) ? 'ok' : 'X'); }; return { prim: r('p-primary'), sec: r('p-secondary'), time: document.querySelector('#p-time').textContent, taps: document.querySelector('#p-taps').textContent, coins: document.querySelector('#p-coins').textContent, fits: document.querySelector('#panel .sheetcard').getBoundingClientRect().bottom <= innerHeight + 1 }; });
  await p.screenshot({ path: path.join(SHOTS, `${label}-report.png`) });
  // every board: rows and CSS px a cell
  const ids = await F.evaluate(() => [...SP.gallery(), ...Array.from({ length: 100 }, (_, i) => i + 1)]); const boards = [];
  for (let i = 0; i < ids.length; i += 20) boards.push(...(await F.evaluate((chunk) => chunk.map((id) => { SP.load(id, 'normal'); const s = SP.state(); return [s.id, SP.meta().rows, +(s.cs / devicePixelRatio).toFixed(2)]; }), ids.slice(i, i + 20))));
  const two = boards.filter((x) => x[1] === 2).length, minCs = boards.reduce((m, x) => (x[2] < m[2] ? x : m)); const under8 = boards.filter((x) => x[2] < 8);
  await F.evaluate((id) => SP.load(id, 'normal'), GAL.reduce((m, l) => (l.w * l.h > m.w * m.h ? l : m)).id); await wait(300); await p.screenshot({ path: path.join(SHOTS, `${label}-gallery-big.png`) });
  const gp = await F.evaluate(() => { const hit = (el) => { const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t === el || el.contains(t) ? 'ok' : 'X'; }; return { badges: [...document.querySelectorAll('#powers .pw')].map(hit).join(''), tiles: [...document.querySelectorAll('#tray button.tile.card')].map(hit).join(''), overflow: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight] }; });
  const bad = /X|missing/.test(JSON.stringify([home, inLevel.badges, inLevel.tiles, inLevel.top, gp])) || under8.length || inLevel.overflow.some((v) => v > 0) || gp.overflow.some((v) => v > 0) || !/ok/.test(sheet.prim) || !sheet.fits;
  ok('viewport ' + label, !bad, { home, toPlay, inLevel, sheet, boards: boards.length, twoRowBoards: two, minCss: minCs, under8: under8.slice(0, 5), galleryBig: gp }); }
await vp('375x812', phone, BASE + '?debug=1');
await vp('375x667', { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, BASE + '?debug=1');
await vp('1280x720', { viewport: { width: 1280, height: 720 } }, BASE + '?debug=1');
await vp('812x375', { viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, BASE + '?debug=1');
await vp('iframe400x600', { viewport: { width: 800, height: 700 } }, BASE + 'tools/iframe-host.html', '#game');
ok('zero console errors/warnings (part 2b)', errs.length === 0, errs.slice(0, 20));
fs.writeFileSync(path.join(here, 'play2-result.json'), JSON.stringify(R, null, 1)); await b.close();
