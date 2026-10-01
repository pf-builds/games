// Critic v4-2 Part 2: browser checklist for M4 (Gallery) + M5 (meta) at 375x812 touch. node tools/critic-v4-2/play.mjs (server :8492)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const PW = await import(process.env.PLAYWRIGHT_MODULE); const { chromium } = PW.default || PW;
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), SHOTS = path.join(root, 'tools/shots-v4-critic2/functional'), BASE = 'http://127.0.0.1:8492/sappers-path/';
const LV = JSON.parse(fs.readFileSync(path.join(root, 'levels/levels.json'))).levels, GAL = JSON.parse(fs.readFileSync(path.join(root, 'levels/gallery.json'))).levels, cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json')));
const R = {}, errs = []; const ok = (k, pass, info) => { R[k] = { pass: !!pass, info }; console.log((pass ? 'PASS ' : 'FAIL ') + k + ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 1100)); };
const b = await chromium.launch(); const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${m.type()}: ${m.text()}`); }); p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
const st = () => p.evaluate(() => SP.state()), meta = () => p.evaluate(() => SP.meta()), txt = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);
const toast = () => p.evaluate(() => { const t = document.querySelector('#toast'); return t.hidden ? '' : t.textContent; });
const tapCard = (c) => p.tap(`#tray button.tile.card[data-col="${c}"]`, { timeout: 3000 });
const waitRest = async (ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await st(); if (!s.busy || s.status !== 'playing') return s; await wait(60); } return st(); };
const waitPanel = async (ms = 20000) => { await p.waitForFunction(() => SP.state().panel, null, { timeout: ms }); await wait(400); return p.evaluate(() => document.querySelector('#panel').innerText.replace(/\n+/g, ' | ')); };
const sect = async (name, fn) => { try { await fn(); } catch (e) { ok(name, false, 'threw: ' + e.message.split('\n')[0]); } };
// ---------- fresh load: home ----------
const t0 = Date.now(); await p.goto(BASE + '?debug=1'); await p.waitForFunction(() => window.SP && SP.state().screen === 'title'); await p.evaluate(() => localStorage.clear()); await p.reload();
const tl = Date.now(); await p.waitForFunction(() => window.SP && SP.state().screen === 'title'); const tHome = Date.now() - tl;
const perf = await p.evaluate(() => { const r = performance.getEntriesByType('resource'), n = performance.getEntriesByType('navigation')[0]; const files = r.map((x) => [x.name.replace(/^.*sappers-path\//, ''), x.encodedBodySize]); return { files: files.length + 1, bytes: files.reduce((s, x) => s + x[1], 0) + n.encodedBodySize, dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), big: files.sort((a, c) => c[1] - a[1]).slice(0, 6).map((x) => x.join(':')).join(' ') }; });
await sect('home screen (fresh save)', async () => { const h = await p.evaluate(() => ({ prog: document.querySelector('#home-prog').textContent, coins: document.querySelector('#home-coins').textContent, livesHidden: document.querySelector('#home-lives').hidden, hearts: [...document.querySelectorAll('.ico-heart')].filter((e) => e.offsetParent).length, play: document.querySelector('#btn-play').textContent.trim(), galAria: document.querySelector('#btn-gallery').getAttribute('aria-label'), galHidden: document.querySelector('#btn-gallery').hidden }));
  await p.screenshot({ path: path.join(SHOTS, 'phone-home.png') });
  await p.tap('#btn-gallery').catch(() => {}); await wait(250); const s = await st(); const tst = await toast();
  ok('home screen (fresh save), lives off, Gallery locked', /0\/100/.test(h.prog) && /400/.test(h.coins) && h.livesHidden && h.hearts === 0 && /Level 1/.test(h.play) && s.screen === 'title' && /25/.test(h.galAria), { ...h, afterGalleryTap: s.screen, toast: tst, homeReadyMs: tHome, perf }); });
// ---------- 1 tap to gameplay; level 1 real taps at 3x, patient; the report ----------
let rep1 = null;
await sect('level 1 win report (real play, 3x)', async () => { const tp = Date.now(); await p.tap('#btn-play'); await p.waitForFunction(() => SP.state().screen === 'play'); const toPlay = Date.now() - tp;
  while ((await st()).speed !== 3) { await p.tap('#top .tog-speed'); await wait(50); }
  await p.evaluate(() => SP.retry()); const start = Date.now(); let decided = 0;
  for (const c of LV[0].win.normal) { await tapCard(+c); await wait(80); const s = await waitRest(); if (s.status !== 'playing') { decided = Date.now(); break; } }
  if (!decided) { await p.waitForFunction(() => SP.state().status !== 'playing'); decided = Date.now(); }
  const panel = await waitPanel(); await wait(1800); const m = await meta(); const s = await st(); rep1 = { panel: await p.evaluate(() => document.querySelector('#panel').innerText.replace(/\n+/g, ' | ')), report: m.report, coins: m.coins, wallMs: decided - start, engineNow: s.now };
  await p.screenshot({ path: path.join(SHOTS, 'phone-l1-report.png') });
  const timeTxt = await txt('#p-time'), tapsTxt = await txt('#p-taps'), coinsTxt = await txt('#p-coins');
  ok('1 tap from home to gameplay', true, `${toPlay} ms`);
  ok('level 1 win report: time, taps, coins, first win, medal', m.coins === 430 && m.report && m.report.taps === 6 && m.report.coins === 30 && Math.abs(m.report.ms - (decided - start)) < 1500 && /6/.test(tapsTxt) && /\+?30/.test(coinsTxt), { timeTxt, tapsTxt, coinsTxt, report: m.report, wallMsToDecision: decided - start, engineMs: s.now, coins: m.coins, panel: rep1.panel }); });
await sect('Next level without reload', async () => { await p.evaluate(() => (window.__nr = 1)); await p.tap('#p-primary'); await wait(400); const s = await st(); ok('win -> Next level without reload', s.id === 'e1-02' && (await p.evaluate(() => window.__nr === 1)), s.id); });
await sect('second win: best + no first-win bonus', async () => { await p.evaluate(() => SP.load(1, 'normal')); await wait(150); for (const c of LV[0].win.normal) { await tapCard(+c); await wait(60); const s = await waitRest(); if (s.status !== 'playing') break; }
  await waitPanel(); await wait(1800); const m = await meta(); const pnl = await p.evaluate(() => document.querySelector('#panel').innerText.replace(/\n+/g, ' | '));
  ok('second win: coins +10 only, best shown', m.coins === 440 && m.report.coins === 10 && /Best|New best/.test(pnl), { coins: m.coins, report: m.report, panel: pnl }); });
// ---------- siege loss ----------
await sect('siege loss', async () => { await p.evaluate(() => SP.load('e2-46', 'normal')); await wait(150); const c0 = (await meta()).coins; for (const c of '0043222123104') { const s = await st(); if (s.status !== 'playing') break; await tapCard(+c); await p.evaluate(() => SP.settle()); }
  const pnl = await waitPanel(); const m = await meta(); await p.screenshot({ path: path.join(SHOTS, 'phone-siege-jam.png') });
  ok('siege loss: jam sheet, no coins, no life', /jam/i.test(pnl) && m.coins === c0 && m.lives.n === 5, { panel: pnl, coins: [c0, m.coins], lives: m.lives });
  await p.tap('#p-primary'); await wait(300); const s = await st(); ok('Retry after loss', s.status === 'playing' && s.plays === 0, s.id + ' plays ' + s.plays); });
// ---------- power-ups via the real buttons ----------
const badge = (k) => `#powers .pw[data-k="${k}"]`; const bstate = (k) => p.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.className + ' | ' + e.getAttribute('aria-label') + ' | ' + e.innerText.replace(/\s+/g, ' ') : null; }, badge(k));
await sect('power-ups', async () => {
  await p.evaluate(() => SP.setMeta({ coins: 400, inv: { ladder: 0, quartermaster: 0, scout: 0, recall: 0 } })); await p.evaluate(() => SP.load(4, 'normal')); await wait(200);
  // short of coins
  await p.evaluate(() => SP.setMeta({ coins: 50 })); await wait(50); await p.tap(badge(0)); await wait(120); let t = await toast(); let m = await meta();
  ok('buy refused when short of coins (nothing spent)', m.coins === 50 && m.inv.ladder === 0 && /120/.test(t) && /50/.test(t), { toast: t, coins: m.coins, inv: m.inv });
  await p.evaluate(() => SP.setMeta({ coins: 400 })); await wait(50);
  // Ladder: buy, use, used-up
  const s0 = await st(); await p.tap(badge(0)); await wait(120); t = await toast(); m = await meta(); const afterBuy = { coins: m.coins, inv: m.inv.ladder, toast: t, badge: await bstate(0) };
  await p.tap(badge(0)); await wait(150); const s1 = await st(); m = await meta(); const afterUse = { cap: [s0.cap, s1.cap], open: [s0.open, s1.open], inv: m.inv.ladder, used: m.used, slots: await p.evaluate(() => document.querySelectorAll('#line .slot:not([hidden])').length), badge: await bstate(0) };
  await p.evaluate(() => SP.setMeta({ inv: Object.assign(SP.meta().inv, { ladder: 1 }) })); await p.tap(badge(0)); await wait(150); t = await toast(); m = await meta(); const s2 = await st();
  ok('Ladder: buy 120, use (+1 space), second use refused and not spent', afterBuy.coins === 280 && afterBuy.inv === 1 && s1.open === s0.open + 1 && afterUse.inv === 0 && s2.open === s1.open && m.inv.ladder === 1, { afterBuy, afterUse, secondUse: { toast: t, inv: m.inv.ladder, open: s2.open } });
  // Quartermaster: buy, pick a row-2 tile, cancel path, refusal (front tile)
  await p.evaluate(() => SP.load(4, 'normal')); await wait(150); const q0 = await st(); const colsBefore = await p.evaluate(() => [...document.querySelectorAll('#tray .col')].map((c) => c.innerText.replace(/\s+/g, ' ')));
  await p.tap(badge(1)); await wait(100); m = await meta(); const qBuy = { coins: m.coins, inv: m.inv.quartermaster };
  await p.tap(badge(1)); await wait(100); const pick1 = (await meta()).pick; await p.tap(badge(1)); await wait(100); const pickCancel = (await meta()).pick; m = await meta(); const invAfterCancel = m.inv.quartermaster;
  await p.tap(badge(1)); await wait(100); const j = colsBefore.findIndex((c) => c.split(' ').length >= 2);
  await p.tap(`#tray .col:nth-child(${j + 1}) > .tile:nth-child(2)`); await wait(250); const q1 = await st(); m = await meta(); const colsAfter = await p.evaluate(() => [...document.querySelectorAll('#tray .col')].map((c) => c.innerText.replace(/\s+/g, ' ')));
  ok('Quartermaster: buy 80, pick mode, cancel costs nothing, pull a row-2 card to the front', qBuy.inv === 1 && pick1 === 1 && pickCancel === -1 && invAfterCancel === 1 && m.inv.quartermaster === 0 && JSON.stringify(q1.fronts[j]) !== JSON.stringify(q0.fronts[j]) && q1.plays === q0.plays, { qBuy, pick1, pickCancel, invAfterCancel, col: j, colsBefore, colsAfter, invAfter: m.inv.quartermaster, used: m.used });
  // Scout: refused on a level with no hidden cards (not spent), used on v4-mystery
  await p.evaluate(() => SP.setMeta({ inv: Object.assign(SP.meta().inv, { scout: 1 }) })); await p.tap(badge(2)); await wait(150); t = await toast(); m = await meta(); const scoutNo = { toast: t, inv: m.inv.scout };
  await p.evaluate(() => SP.load('v4-mystery', 'normal')); await wait(200); const h0 = (await st()).hidden; await p.tap(badge(2)); await wait(400); const h1 = (await st()).hidden; m = await meta();
  const leak = await p.evaluate(() => document.querySelectorAll('#tray .mys').length);
  ok('Scout: refused with nothing hidden (not spent); reveals every ? card', scoutNo.inv === 1 && /hidden|\?|no/i.test(scoutNo.toast) && h0 > 0 && h1 === 0 && m.inv.scout === 0 && leak === 0, { scoutNo, hidden: [h0, h1], inv: m.inv.scout, mysTilesLeft: leak });
  // Recall: stage one stuck squad, refuse an empty space, recall the stuck one
  await p.evaluate(() => SP.setMeta({ inv: Object.assign(SP.meta().inv, { recall: 1 }) })); const sg = await p.evaluate(() => SP.stage(4, 1, 0)); await wait(200); const r0 = await st();
  const stuckIdx = await p.evaluate(() => [...document.querySelectorAll('#line .slot')].findIndex((s) => /stuck/.test(s.className)));
  await p.tap(badge(3)); await wait(100); const pickR = (await meta()).pick; const freeIdx = await p.evaluate(() => [...document.querySelectorAll('#line .slot')].findIndex((s) => !/stuck|work|busy|locked|full/.test(s.className) && !s.hidden));
  await p.tap(`#line .slot:nth-child(${freeIdx + 1})`); await wait(150); t = await toast(); m = await meta(); const recNo = { toast: t, inv: m.inv.recall, pick: m.pick };
  if (m.pick !== 3) { await p.tap(badge(3)); await wait(100); } await p.tap(`#line .slot:nth-child(${stuckIdx + 1})`); await wait(250); const r1 = await st(); m = await meta();
  ok('Recall: empty space refused (not spent); stuck squad goes back to its column front', pickR === 3 && recNo.inv === 1 && r1.line.length === r0.line.length - 1 && m.inv.recall === 0 && r1.plays === r0.plays, { staged: sg && sg.id, stuckIdx, freeIdx, recNo, line: [r0.line, r1.line], fronts: [r0.fronts.map((f) => f && f.n), r1.fronts.map((f) => f && f.n)], inv: m.inv.recall });
  await p.screenshot({ path: path.join(SHOTS, 'phone-powers.png') });
});
// ---------- settings + pause ----------
await sect('settings', async () => { await p.evaluate(() => SP.screen('title')); await wait(200); await p.tap('#btn-settings'); await wait(200); const vis = await p.evaluate(() => !document.querySelector('#settings').hidden);
  const before = await st(); await p.tap('#settings .tog-mute'); await p.tap('#settings .tog-speed'); await p.tap('#settings .tog-cb'); await wait(100); const after = await st(); const rows = await p.evaluate(() => [...document.querySelectorAll('#settings .set-row')].map((r) => r.innerText.replace(/\s+/g, ' ')));
  await p.tap('#set-close'); await wait(150); const saved = JSON.parse(await p.evaluate(() => localStorage.getItem('sappers-path.v3'))).settings; const closed = await p.evaluate(() => document.querySelector('#settings').hidden);
  ok('settings sheet: sound, speed, colour-blind; saved', vis && closed && after.cb !== before.cb && after.speed !== before.speed && saved.muted === true && saved.cb === after.cb && saved.speed === after.speed, { rows, before: [before.speed, before.cb], after: [after.speed, after.cb], saved });
  await p.tap('#btn-settings'); await p.tap('#settings .tog-mute'); await p.tap('#settings .tog-cb'); while ((await st()).speed !== 1) await p.tap('#settings .tog-speed'); await p.tap('#set-close'); });
await sect('pause', async () => { await p.evaluate(() => SP.load(4, 'normal')); await wait(150); await tapCard((await st()).fronts.findIndex((x) => x)); await wait(150);
  await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await wait(60); const a = await st(); await wait(500); const b2 = await st(); const sheet = await p.evaluate(() => ({ vis: !document.querySelector('#pause').hidden, html: document.querySelector('#pause').innerText.replace(/\s+/g, ' '), toggles: [...document.querySelectorAll('#pause button, #pause [role=button]')].map((x) => x.getAttribute('aria-label') || x.className) }));
  await p.tap('#pause .pz-t, #pause').catch(() => {}); await wait(120); const c = await st();
  ok('pause on blur (clock frozen, sheet with cb + sound, resume tap plays nothing)', a.now === b2.now && sheet.vis && c.plays === a.plays, { now: [a.now, b2.now], sheet, plays: [a.plays, c.plays], pausedAfter: await p.evaluate(() => SP.paused()) }); });
// ---------- save / reload ----------
await sect('save reload', async () => { const m0 = await meta(); const s0 = JSON.parse(await p.evaluate(() => localStorage.getItem('sappers-path.v3'))); await p.reload(); await p.waitForFunction(() => window.SP && SP.state().screen === 'title'); const m1 = await meta(); const s1 = JSON.parse(await p.evaluate(() => localStorage.getItem('sappers-path.v3')));
  ok('save survives reload: coins, inventory, bests, progress', m1.coins === m0.coins && JSON.stringify(m1.inv) === JSON.stringify(m0.inv) && JSON.stringify(s1.best) === JSON.stringify(s0.best) && JSON.stringify(s1.done) === JSON.stringify(s0.done), { coins: [m0.coins, m1.coins], inv: m1.inv, best: s1.best, done: s1.done, home: await txt('#home-prog') }); });
// ---------- old saves ----------
await sect('old saves', async () => { const pre = { v: 1, done: Object.fromEntries(LV.filter((l) => l.n <= 30).map((l) => [l.id, 2])), settings: { muted: false, speed: 2, cb: true, diff: 'normal' }, last: 'e2-30' };
  await p.evaluate((o) => localStorage.setItem('sappers-path.v3', JSON.stringify(o)), pre); await p.reload(); await p.waitForFunction(() => window.SP && SP.state().screen === 'title'); const m = await meta(); const h = { prog: await txt('#home-prog'), coins: await txt('#home-coins'), play: await txt('#btn-play'), galLocked: await p.evaluate(() => /locked/.test(document.querySelector('#btn-gallery').className)) };
  const junk = Object.assign({}, pre, { coins: 'lots', inv: { ladder: 500, scout: -3, recall: 'x' }, best: { 'e1-01': [1e9, 5000, 0, 9999, 3, 0, 50], bogus: [1, 2, 3, 4, 5, 6, 7] }, gal: { 'g-tw-1f355': 9, nope: 1 } });
  await p.evaluate((o) => localStorage.setItem('sappers-path.v3', JSON.stringify(o)), junk); await p.reload(); await p.waitForFunction(() => window.SP && SP.state().screen === 'title'); const mj = await meta(); const sj = JSON.parse(await p.evaluate(() => localStorage.getItem('sappers-path.v3')) || '{}');
  ok('pre-M5 save loads sanely (coins 400, empty inventory, wins kept, Gallery open after 25)', m.coins === 400 && Object.values(m.inv).every((v) => v === 0) && /30\/100/.test(h.prog) && /Level 31/.test(h.play) && !h.galLocked, { meta: { coins: m.coins, inv: m.inv }, home: h });
  ok('junk M5 fields sanitized (coins 0, inv clamped 0-99, bad best/gal dropped)', mj.coins === 0 && mj.inv.ladder === 99 && mj.inv.scout === 0 && mj.inv.recall === 0, { coins: mj.coins, inv: mj.inv, savedAfterWrite: sj.best ? { best: sj.best, gal: sj.gal } : 'save not rewritten yet' }); });
// ---------- lives: off on the shipped build, forced on ----------
await sect('lives', async () => { await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.SP && SP.state().screen === 'title');
  const off = await p.evaluate(() => ({ pill: !document.querySelector('#home-lives').hidden, hearts: [...document.querySelectorAll('.ico-heart')].filter((e) => e.offsetParent).length, meta: SP.meta().lives }));
  const on1 = await p.evaluate(() => SP.forceLives(true, 1, 0)); await wait(100); const pill1 = await p.evaluate(() => ({ vis: !document.querySelector('#home-lives').hidden, txt: document.querySelector('#home-lives').textContent }));
  await p.evaluate(() => SP.unlockTo(45)); await p.evaluate(() => SP.load('e2-46', 'normal')); await wait(100); for (const c of '0043222123104') { const s = await st(); if (s.status !== 'playing') break; await p.evaluate((c) => SP.play(+c), c); await p.evaluate(() => SP.settle()); }
  const pnl = await waitPanel(); const l0 = (await meta()).lives; await p.tap('#p-primary'); await wait(300); const afterRetry = (await st()).screen;
  await p.evaluate(() => SP.screen('title')); await wait(150); const playTxt = await txt('#btn-play'); await p.tap('#btn-play'); await wait(200); const t = await toast(); const scr = (await st()).screen;
  const refill = await p.evaluate(() => SP.forceLives(true, 4, 20 * 60000 + 500)); const back = await p.evaluate(() => SP.forceLives(false));
  ok('lives OFF on the shipped build (no heart UI)', !off.pill && off.hearts === 0 && off.meta.on === false, off);
  ok('lives forced on: a fail costs one, 0 blocks play with a countdown, Retry goes home, refill', pill1.vis && l0.n === 0 && /life/i.test(pnl) && afterRetry === 'title' && /Next life/i.test(playTxt) && scr === 'title' && refill.n === 5, { pill1, panel: pnl, lives: l0, afterRetry, playTxt, toast: t, screenAfterPlayTap: scr, refill, off: back }); });
// ---------- Gallery ----------
await sect('gallery', async () => { await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.SP && SP.state().screen === 'title');
  await p.evaluate(() => SP.unlockTo(24)); await p.reload(); await p.waitForFunction(() => window.SP && SP.state().screen === 'title'); await p.tap('#btn-gallery').catch(() => {}); await wait(200); const lockedAt24 = (await st()).screen !== 'gallery';
  await p.evaluate(() => SP.unlockTo(25)); await p.reload(); await p.waitForFunction(() => window.SP && SP.state().screen === 'title'); await p.tap('#btn-gallery'); await wait(300); const g0 = await p.evaluate(() => ({ screen: SP.state().screen, count: document.querySelector('#gal-count').textContent, cells: document.querySelectorAll('#gal-grid > *').length, credits: document.querySelector('#gal-credits').textContent.slice(0, 80), links: document.querySelectorAll('#gallery a[href]').length }));
  const first = GAL[0]; await p.tap('#gal-grid > *:first-child'); await p.waitForFunction(() => SP.state().screen === 'play'); const gid = (await st()).id; const coins0 = (await meta()).coins;
  for (const c of first.win.normal) { const s = await st(); if (s.status !== 'playing') break; await tapCard(+c); await p.evaluate(() => SP.settle()); }
  const pnl = await waitPanel(); await wait(1500); const m = await meta(); await p.screenshot({ path: path.join(SHOTS, 'phone-gallery-win.png') }); const prim = await txt('#p-primary');
  await p.tap('#btn-map'); await wait(300); const back = await st();
  const g1 = await p.evaluate((id) => { const cells = [...document.querySelectorAll('#gal-grid > *')]; const c = cells[0]; const cv = c.querySelector('canvas'); let sat = null; if (cv) { const x = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let s = 0, n = 0; for (let i = 0; i < x.length; i += 4) { const mx = Math.max(x[i], x[i + 1], x[i + 2]), mn = Math.min(x[i], x[i + 1], x[i + 2]); s += mx - mn; n++; } sat = Math.round(s / n); }
    const c2 = cells[1].querySelector('canvas'); let sat2 = null; if (c2) { const x = c2.getContext('2d').getImageData(0, 0, c2.width, c2.height).data; let s = 0, n = 0; for (let i = 0; i < x.length; i += 4) { const mx = Math.max(x[i], x[i + 1], x[i + 2]), mn = Math.min(x[i], x[i + 1], x[i + 2]); s += mx - mn; n++; } sat2 = Math.round(s / n); }
    return { screen: SP.state().screen, count: document.querySelector('#gal-count').textContent, cls: c.className, txt: c.innerText.replace(/\s+/g, ' ').slice(0, 80), sat, sat2, cls2: cells[1].className }; }, gid);
  await p.screenshot({ path: path.join(SHOTS, 'phone-gallery-grid.png') });
  ok('Gallery locked before siege 25, open after', lockedAt24 && g0.screen === 'gallery' && g0.cells === 60 && g0.links === 0, { lockedAt24, g0 });
  ok('Gallery full win: report, coins, next picture, cleared picture in colour', /won|Picture|razed|cleared/i.test(pnl) && m.coins === coins0 + 30 && back.screen === 'gallery' && g1.sat > g1.sat2 + 10, { id: gid, panel: pnl, coins: [coins0, m.coins], primary: prim, backTo: back.screen, grid: g1 });
  // Gallery loss: rushed taps until a jam
  await p.tap('#gal-grid > *:nth-child(5)'); await p.waitForFunction(() => SP.state().screen === 'play'); let k = 0; while ((await st()).status === 'playing' && k++ < 80) { const s = await st(); const c = [0, 1, 2, 3, 4].filter((i) => s.fronts[i]); if (!c.length) break; await p.evaluate((c) => SP.play(c), c[k % c.length]); if (k % 5 === 0) await p.evaluate(() => SP.settle()); }
  await p.evaluate(() => SP.settle()); const lp = await waitPanel().catch(() => 'no panel'); ok('Gallery loss sheet', /fail|jam|short|stuck/i.test(lp) || (await st()).status === 'won', { panel: lp, status: (await st()).status }); });
// ---------- busiest moment: largest Gallery board, 4x throttle ----------
await sect('busiest gallery', async () => { const big = GAL.reduce((m, l) => (l.w * l.h > m.w * m.h ? l : m)); const cdp = await ctx.newCDPSession(p); await p.evaluate((id) => SP.load(id, 'easy'), big.id); await wait(400); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.evaluate(() => { window.__dt = []; window.__lt = []; let last = performance.now(); const f = (t) => { window.__dt.push(t - last); last = t; if (window.__dt.length < 500) requestAnimationFrame(f); }; requestAnimationFrame(f); try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask' }); } catch (e) {} });
  let peak = 0, drawMax = 0; for (let r = 0; r < 3; r++) { for (let c = 0; c < 5; c++) { await tapCard(c).catch(() => {}); await wait(60); } for (let k = 0; k < 8; k++) { const s = await st(); peak = Math.max(peak, s.runners); if (r === 1 && k === 3) await p.screenshot({ path: path.join(SHOTS, 'phone-gallery-busiest.png') }); await wait(200); } }
  const pf = await p.evaluate(() => SP.perf(30)); const res = await p.evaluate(() => ({ dt: window.__dt.slice(3), lt: window.__lt })); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const dt = res.dt.sort((a, c) => a - c), q = (x) => dt[Math.floor(x * (dt.length - 1))];
  ok('busiest moment on the largest Gallery board (4x CPU throttle)', q(0.95) < 34 && dt.filter((x) => x > 50).length <= 3, { level: big.id + ' ' + big.w + 'x' + big.h, frames: dt.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +dt[dt.length - 1].toFixed(1), over33: dt.filter((x) => x > 33.4).length, longtasks: res.lt, peakRunners: peak, drawCost4x: pf }); });
await sect('selfTest', async () => { const t1 = Date.now(); const r = await p.evaluate(() => SP.selfTest()); ok('SP.selfTest()', r.pass > 0 && !r.fail.length, `pass ${r.pass} fail ${JSON.stringify(r.fail).slice(0, 500)} in ${Date.now() - t1} ms`); });
ok('zero console errors/warnings (phone run)', errs.length === 0, errs.slice(0, 20));
fs.writeFileSync(path.join(here, 'play-result.json'), JSON.stringify(R, null, 1)); await b.close();
