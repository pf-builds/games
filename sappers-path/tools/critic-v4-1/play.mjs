// Critic v4-1 Part 2: browser checklist (headless Chromium). node tools/critic-v4-1/play.mjs  (server on :8492)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const PW = await import(process.env.PLAYWRIGHT_MODULE); const { chromium } = PW.default || PW;
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), SHOTS = path.join(root, 'tools/shots-v4-critic1/functional');
const BASE = 'http://127.0.0.1:8492/sappers-path/', cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'))), LV = JSON.parse(fs.readFileSync(path.join(root, 'levels/levels.json'))).levels;
const DBG = JSON.parse(fs.readFileSync(path.join(root, 'levels/debug-v4.json'))).levels;
const R = {}, errs = []; const ok = (k, pass, info) => { R[k] = { pass: !!pass, info }; console.log((pass ? 'PASS ' : 'FAIL ') + k + ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 600)); };
const b = await chromium.launch();
async function newPage(opts, label) { const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${label}] ${m.type()}: ${m.text()}`); }); p.on('pageerror', (e) => errs.push(`[${label}] PAGEERROR ${e.message}`)); return { ctx, p }; }
const st = (p) => p.evaluate(() => SP.state()); const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function settle(p) { return p.evaluate(() => SP.settle()); }
async function tapCard(p, col) { await p.tap(`#tray button.tile.card[data-col="${col}"]`, { timeout: 3000 }); }
async function waitPanel(p, ms = 15000) { await p.waitForFunction(() => { const e = document.querySelector('#panel'); return e && !e.hidden && getComputedStyle(e).display !== 'none'; }, null, { timeout: ms }); await wait(420); return p.evaluate(() => ({ title: document.querySelector('#p-title').textContent, line: document.querySelector('#p-line').textContent, primary: document.querySelector('#p-primary').textContent, secondary: document.querySelector('#p-secondary').textContent })); }
// ---------------- phone 375x812 ----------------
const phone = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
{ const { p } = await newPage(phone, 'phone');
  const t0 = Date.now(); await p.goto(BASE + '?debug=1'); await p.waitForFunction(() => window.SP && !document.querySelector('#title').hidden); const tTitle = Date.now() - t0;
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.SP && !document.querySelector('#title').hidden);
  const perf = await p.evaluate(() => { const r = performance.getEntriesByType('resource'), n = performance.getEntriesByType('navigation')[0]; return { files: r.length + 1, bytes: r.reduce((s, x) => s + (x.encodedBodySize || 0), 0) + (n ? n.encodedBodySize : 0), decoded: r.reduce((s, x) => s + (x.decodedBodySize || 0), 0) + (n ? n.decodedBodySize : 0), dcl: n ? Math.round(n.domContentLoadedEventEnd) : null, load: n ? Math.round(n.loadEventEnd) : null, list: r.map((x) => x.name.replace(/^.*sappers-path\//, '') + ':' + x.encodedBodySize).join(' ') }; });
  const tp = Date.now(); await p.tap('#btn-play'); await p.waitForFunction(() => SP.state().screen === 'play'); const s1 = await st(p);
  ok('title->gameplay taps', s1.screen === 'play' && s1.id === 'e1-01', `1 tap (title Play) -> ${s1.id}; ${Date.now() - tp} ms; first load to title ${tTitle} ms; payload ${JSON.stringify(perf).slice(0, 400)}`);
  // level 1 full win with real taps + tap-to-skip on the board
  const order = LV[0].win.normal.split('').map(Number); let skipOK = true, skipInfo = [];
  for (const c of order) { await tapCard(p, c); await wait(250); const a = await st(p); await p.tap('#board'); await wait(30); const z = await st(p); if (a.busy && z.busy) { skipOK = false; skipInfo.push(`busy after skip: now ${z.now}`); } else skipInfo.push(`${a.busy ? 'busy' : 'idle'}->${z.busy ? 'busy' : 'idle'}`); }
  const win1 = await waitPanel(p); const s2 = await st(p); ok('tap-to-skip', skipOK, skipInfo.join(' '));
  ok('level 1 full win (real taps)', s2.status === 'won', win1);
  await p.screenshot({ path: path.join(SHOTS, 'phone-l1-win.png') });
  await p.evaluate(() => (window.__noReload = 1)); await p.tap('#p-primary'); await wait(400); const s3 = await st(p);
  ok('win -> Next without reload', s3.id === 'e1-02' && s3.status === 'playing' && (await p.evaluate(() => window.__noReload === 1)), `after Next: ${s3.id} ${s3.status}`);
  // full loss: jam on e2-46 by the selfTest careless order, real taps
  await p.evaluate(() => SP.load('e2-46', 'normal')); await wait(300); for (const c of '0043222123104'.split('').map(Number)) { const s = await st(p); if (s.status !== 'playing') break; await tapCard(p, c); await settle(p); }
  const lossP = await waitPanel(p); const s4 = await st(p); ok('full loss (jam sheet)', s4.status === 'failed' && s4.reason === 'jam' && /jam/i.test(lossP.title + lossP.line), lossP);
  await p.tap('#p-primary'); await wait(400); const s5 = await st(p); ok('Retry after loss', s5.id === 'e2-46' && s5.status === 'playing' && s5.plays === 0 && s5.panel === null, `${s5.id} ${s5.status} plays ${s5.plays} panel ${s5.panel}`);
  // refused tap (no free space)
  const f = await p.evaluate(() => SP.fill()); const before = await st(p); const tray0 = await p.evaluate(() => document.querySelector('#tray').innerText);
  const fcol = before.fronts.findIndex((x) => x); await tapCard(p, fcol); await wait(120); const after = await st(p); const toast = await p.evaluate(() => { const t = document.querySelector('#toast'); return t.hidden ? '' : t.textContent; });
  ok('refused tap: no free space', after.refused === before.refused + 1 && after.plays === before.plays && JSON.stringify(after.fronts) === JSON.stringify(before.fronts) && /No space/.test(toast), `refused ${before.refused}->${after.refused}, plays ${before.plays}->${after.plays}, toast "${toast}", fill taps ${JSON.stringify(f.taps)}, li ${JSON.stringify(after.li)}, head "${await p.evaluate(() => document.querySelector('#line-lab').textContent)}"`);
  // near-jam warning
  const nj = await p.evaluate(() => SP.stage(4, 3, 1)); const njh = await p.evaluate(() => ({ lab: document.querySelector('#line-lab').textContent, cnt: document.querySelector('#line-cnt').textContent, cls: document.querySelector('#line-wrap').className, last: !!document.querySelector('#line .slot.last') }));
  ok('near-jam warning', nj && nj.li.near && /One space left/.test(njh.lab) && njh.last, { li: nj && nj.li, id: nj && nj.id, ...njh }); await p.screenshot({ path: path.join(SHOTS, 'phone-near-jam.png') });
  // mystery: DOM leak, cb off and on, and reveal at the front
  const MATS = cfg.v3.mats; const needles = []; for (let m = 1; m < MATS.length; m++) needles.push(MATS[m].c.toLowerCase(), MATS[m].crew.toLowerCase(), MATS[m].n.toLowerCase());
  const leakCheck = async (id, cb) => { await p.evaluate(([id]) => SP.load(id, 'normal'), [id]); await wait(250); const cur = (await st(p)).cb; if (cur !== cb) { await p.evaluate(() => SP.load(SP.state().id)); } 
    return p.evaluate((needles) => { const hex = (c) => { const m = c.match(/\d+/g); return m ? '#' + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('') : c; }; const out = []; const mys = [...document.querySelectorAll('#tray .mys')];
      for (const t of mys) { const html = t.outerHTML.toLowerCase(); for (const n of needles) if (html.includes(n)) out.push('outerHTML has ' + n); if (/data:image/.test(html)) out.push('glyph image in hidden tile');
        for (const el of [t, ...t.querySelectorAll('*')]) { const cs = getComputedStyle(el), cs2 = getComputedStyle(el, '::before'), cs3 = getComputedStyle(el, '::after');
          for (const v of [cs.backgroundColor, cs.color, cs.borderColor, cs.boxShadow, cs2.backgroundColor, cs3.backgroundColor, cs.maskImage || cs.webkitMaskImage]) { const h = hex(v || ''); if (needles.includes(h)) out.push('computed colour ' + h + ' on ' + el.className); if (/data:image/.test(v || '')) out.push('mask image on ' + el.className); } } }
      const aria = [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).join('|'); return { hiddenTiles: mys.length, stateHidden: SP.state().hidden, cb: SP.state().cb, leaks: [...new Set(out)], rodSvg: !!document.querySelector('#tray svg'), aria: aria.slice(0, 300) }; }, needles); };
  const lk = []; for (const id of ['v4-mystery', 'e2-35', 'e4-100', 'v4-all']) lk.push({ id, off: await leakCheck(id, false) });
  // colour-blind on (via the map toggle) and check again
  await p.evaluate(() => SP.load('v4-mystery', 'normal')); await p.tap('#btn-map'); await wait(300); await p.tap('#map .tog-cb'); await wait(100); const cbOn = (await st(p)).cb; await p.evaluate(() => SP.load('v4-mystery', 'normal')); await wait(250);
  for (const id of ['v4-mystery', 'e2-35', 'e4-100']) lk.push({ id, on: await leakCheck(id, true) });
  await p.evaluate(() => SP.load('v4-mystery', 'normal')); await wait(300); await p.screenshot({ path: path.join(SHOTS, 'phone-mystery-cb.png') });
  const anyLeak = lk.some((x) => (x.off || x.on).leaks.length); ok('mystery: nothing in the DOM leaks a hidden colour (cb off/on)', !anyLeak && cbOn, lk.map((x) => `${x.id} cb${(x.off || x.on).cb ? 'on' : 'off'} tiles ${(x.off || x.on).hiddenTiles}/${(x.off || x.on).stateHidden} leaks ${JSON.stringify((x.off || x.on).leaks)}`).join('; '));
  // reveal: tap col 0 front on v4-mystery; col 0's d1 is '?'
  await p.evaluate(() => SP.load('v4-mystery', 'normal')); await wait(200); const h0 = (await st(p)).hidden; await tapCard(p, 0); await wait(700); const rv = await p.evaluate(() => { const t = document.querySelector('#tray button.tile.card[data-col="0"]'); return { cls: t.className, aria: t.getAttribute('aria-label'), q: t.querySelector('.q').textContent, mc: t.style.getPropertyValue('--mc') }; }); const h1 = (await st(p)).hidden;
  ok('mystery reveals at the front', h1 === h0 - 1 && rv.q === '' && !/mys/.test(rv.cls) && /sappers/.test(rv.aria), { h0, h1, ...rv });
  await p.evaluate(() => SP.load('v4-mystery', 'normal')); await p.tap('#btn-map'); await wait(300); await p.tap('#map .tog-cb'); await wait(100);
  // linked tap: both out, partner column closes up
  const LK = DBG.find((l) => l.id === 'v4-linked'); await p.evaluate(() => SP.load('v4-linked', 'normal')); await wait(250); const l0 = await st(p);
  const fr = LK.links.find(([a, c]) => a[1] === 0 || c[1] === 0); const [ta, pa] = fr[0][1] === 0 ? fr : [fr[1], fr[0]]; const colsBefore = await p.evaluate(() => [...document.querySelectorAll('#tray .col')].map((c) => c.innerText.replace(/\s+/g, ' ')));
  await tapCard(p, ta[0]); await wait(150); const l1 = await st(p); const colsAfter = await p.evaluate(() => [...document.querySelectorAll('#tray .col')].map((c) => c.innerText.replace(/\s+/g, ' ')));
  const partnerCard = LK.cols[pa[0]][pa[1]], nextInPartner = LK.cols[pa[0]][pa[1] + 1];
  ok('linked tap: both squads out, partner column closes up', l1.plays === 1 && l1.line.length === 2 && l1.line[1][0] === cfg.v3.mats[partnerCard[0]].crew, { link: fr, line: l1.line, colsBefore, colsAfter, partnerCard, nextInPartner });
  // linked refused with 1 free space: fill spaces with rushed unlinked taps until exactly 1 free, then tap a linked front
  await p.evaluate(() => SP.load('v4-linked', 'normal')); await wait(200); let lr = null;
  const linkedFronts = (s) => LK.links.flatMap((x) => x).filter(([c, i]) => s.fronts[c] && LK.cols[c].length - (5) >= -99).map(([c]) => c);
  for (let k = 0; k < 12; k++) { const s = await st(p); if (s.li.free === 1) { lr = s; break; } const cands = [0, 1, 2, 3, 4].filter((c) => s.fronts[c]); let tapped = false;
    for (const c of cands) { const isLinked = await p.evaluate((c) => !!document.querySelector(`#tray .col:nth-child(${c + 1}) .tile.card.linked, #tray button.tile.card[data-col="${c}"][class*=link]`), c); if (!isLinked) { await tapCard(p, c); tapped = true; break; } } if (!tapped) break; await wait(40); }
  const linkCols = await p.evaluate(() => [...document.querySelectorAll('#tray button.tile.card')].filter((b) => /link/.test(b.className)).map((b) => +b.dataset.col));
  if (lr && linkCols.length) { const b4 = await st(p); await tapCard(p, linkCols[0]); await wait(100); const af = await st(p); const t2 = await p.evaluate(() => document.querySelector('#toast').hidden ? '' : document.querySelector('#toast').textContent);
    ok('linked tap with 1 free space is refused, changes nothing', af.plays === b4.plays && af.line.length === b4.line.length && JSON.stringify(af.fronts) === JSON.stringify(b4.fronts) && /Linked squads need 2/.test(t2), { free: b4.li.free, col: linkCols[0], plays: [b4.plays, af.plays], refused: [b4.refused, af.refused], toast: t2 }); }
  else ok('linked tap with 1 free space is refused, changes nothing', false, { note: 'could not stage 1 free space', lr: !!lr, linkCols });
  // linked jam sheet: see play2.mjs
  // locked space opens when its key pops (76), real flow with SP.play + settle
  await p.evaluate(() => SP.load(76, 'normal')); await wait(200); const k0 = await st(p); const lockSlot0 = await p.evaluate(() => [...document.querySelectorAll('#line .slot')].map((s) => s.className).join('|')); let unlockAt = -1;
  for (const [i, c] of [...LV.find((l) => l.n === 76).win.normal].entries()) { await p.evaluate((c) => SP.play(+c), c); await settle(p); const s = await st(p); if (s.locked === 0 && unlockAt < 0) unlockAt = i + 1; if (s.status !== 'playing') break; }
  const k1 = await st(p); const lockSlot1 = await p.evaluate(() => [...document.querySelectorAll('#line .slot')].map((s) => s.className).join('|'));
  ok('locked space opens when its key pops', k0.locked === 1 && k0.open === 4 && unlockAt > 0 && k1.status === 'won', { start: [k0.open, k0.locked], unlockAfterTap: unlockAt, end: k1.status, cues: await p.evaluate(() => SP.cues()), lockSlot0, lockSlot1: lockSlot1.slice(0, 200) });
  // gates and keys + archers per difficulty (real play of the careless order e3-52 '00432')
  const arch = {}; for (const d of ['easy', 'normal', 'hard']) { await p.evaluate((d) => SP.load('e3-52', d), d); await wait(150); for (const c of '00432') { const s = await st(p); if (s.status !== 'playing') break; await tapCard(p, +c); await settle(p); } const s = await st(p); let pn = null; if (s.status === 'failed') pn = await waitPanel(p, 8000); arch[d] = { hits: s.hits, kills: s.kills, status: s.status, reason: s.reason, panel: pn }; }
  ok('archers: hit on Easy/Normal, kill+short on Hard', arch.easy.hits > 0 && arch.easy.kills === 0 && arch.normal.hits > 0 && arch.normal.kills === 0 && arch.hard.kills > 0 && arch.hard.reason === 'short', arch);
  { await p.evaluate(() => SP.load('e2-26', 'normal')); const g = { before: (await st(p)).pixLeft }; for (const c of LV.find((l) => l.n === 26).win.normal) { await p.evaluate((c) => SP.play(+c), c); await settle(p); } g.after = await st(p); ok('gate + key level plays to a win', g.after.status === 'won', { status: g.after.status, cues: await p.evaluate(() => SP.cues()) }); }
  // victory march + speed + labels
  const sp = []; await p.evaluate(() => SP.load(1, 'normal')); await wait(150); for (let k = 0; k < 4; k++) { sp.push([(await st(p)).speed, await p.evaluate(() => document.querySelector('#top .tog-speed').getAttribute('aria-label') + '/' + document.querySelector('#top .tog-speed').textContent)]); await p.tap('#top .tog-speed'); await wait(60); }
  ok('speed toggle cycles 1x/2x/3x', sp.map((x) => x[0]).join('') === '1231', sp);
  const march = {}; for (const spd of [1, 3]) { while ((await st(p)).speed !== spd) { await p.tap('#top .tog-speed'); await wait(40); } await p.evaluate(() => SP.load(1, 'normal')); await wait(100); const o = LV[0].win.normal; for (let i = 0; i < o.length - 1; i++) { await p.evaluate((c) => SP.play(+c), o[i]); await settle(p); }
    await tapCard(p, +o[o.length - 1]); await wait(400); const s = await st(p); march[spd] = { march: s.march, pace: s.pace, lab: await p.evaluate(() => document.querySelector('#line-lab').textContent) }; }
  ok('victory march', march[1].march && march[1].pace === 1.5 && /Victory march/.test(march[1].lab), march);
  if (march[3] && march[3].pace === 3 && /1\.5/.test(march[3].lab)) ok('victory march label at 3x', false, `at 3x the march runs at pace ${march[3].pace} but the head reads "${march[3].lab}"`);
  while ((await st(p)).speed !== 1) { await p.tap('#top .tog-speed'); await wait(40); }
  // pause on blur and hidden tab
  await p.evaluate(() => SP.load(4, 'normal')); await wait(150); await tapCard(p, (await st(p)).fronts.findIndex((x) => x)); await wait(200);
  await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await wait(80); const pz0 = await st(p); await wait(600); const pz1 = await st(p); const pzVis = await p.evaluate(() => !document.querySelector('#pause').hidden);
  await p.tap('#pause'); await wait(100); const pz2 = await st(p);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await wait(80); const hz0 = await st(p); await wait(500); const hz1 = await st(p); const hzP = await p.evaluate(() => SP.paused());
  await p.evaluate(() => { delete document.hidden; delete document.visibilityState; Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  ok('pause on blur / hidden tab', pz0.now === pz1.now && pzVis && pz2.plays === pz0.plays && hz0.now === hz1.now && hzP, { blurNow: [pz0.now, pz1.now], pauseSheet: pzVis, playsAfterResumeTap: [pz0.plays, pz2.plays], hiddenNow: [hz0.now, hz1.now], hiddenPaused: hzP });
  if (await p.evaluate(() => SP.paused())) { await p.tap('#pause').catch(() => {}); }
  // teaching levels: random legal orders, coach index trail
  const teach = {}; for (const n of [1, 2, 3, 26, 35, 51, 62, 76, 77]) { teach[n] = []; for (let k = 0; k < 3; k++) { await p.evaluate((n) => SP.load(n, 'normal'), n); await wait(60); const trail = [(await p.evaluate(() => SP.coach())).i]; let seed = n * 31 + k * 7, guard = 0, badTarget = 0;
      while (guard++ < 60) { const s = await st(p); if (s.status !== 'playing') break; const c = await p.evaluate(() => SP.coach()); if (c.on && c.hand && c.target && !(await p.evaluate(() => { const h = document.querySelector('#hand'); return !!h && !h.hidden; }))) badTarget++;
        const legal = await p.evaluate(() => { const s = SP.state(); return [0, 1, 2, 3, 4].filter((c) => { const b = document.querySelector(`#tray button.tile.card[data-col="${c}"]`); return s.fronts[c] && b && !/blocked|lock/.test(b.className); }); }); if (!legal.length) break;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff; const col = legal[seed % legal.length]; await tapCard(p, col); await wait(30); const ci = (await p.evaluate(() => SP.coach())).i; if (trail[trail.length - 1] !== ci) trail.push(ci); await settle(p); const cj = (await p.evaluate(() => SP.coach())).i; if (trail[trail.length - 1] !== cj) trail.push(cj); }
      const s = await st(p); teach[n].push({ trail: trail.join(','), end: s.status + (s.reason ? '/' + s.reason : ''), plays: s.plays, badTarget }); } }
  ok('teaching levels: coach advances with any order, no dead-end', Object.values(teach).every((a) => a.every((x) => x.end !== 'playing' && x.badTarget === 0)), Object.entries(teach).map(([n, a]) => n + ':' + a.map((x) => x.trail + '>' + x.end).join('/')).join(' '));
  // map: 4 eras / 100 levels, unlock order, save across reload, old v3 save
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.SP); await p.tap('#btn-tomap'); await wait(300);
  const map0 = await p.evaluate(() => { const eras = document.querySelectorAll('#eras > *'); const nodes = [...document.querySelectorAll('#eras button, #eras [data-id]')]; return { eras: eras.length, nodes: nodes.length, open: nodes.filter((n) => !n.disabled && !/lock/.test(n.className)).length, count: document.querySelector('#map-count').textContent, txt: document.querySelector('#eras').innerText.slice(0, 300).replace(/\n/g, ' | ') }; });
  await p.evaluate(() => { SP.load(1, 'normal'); for (const c of SP.winOrder('normal')) { SP.play(+c); SP.settle(); } }); await wait(8000); await p.reload(); await p.waitForFunction(() => window.SP); await p.tap('#btn-tomap'); await wait(300);
  const map1 = await p.evaluate(() => { const nodes = [...document.querySelectorAll('#eras button, #eras [data-id]')]; return { open: nodes.filter((n) => !n.disabled && !/lock/.test(n.className)).length, count: document.querySelector('#map-count').textContent, save: localStorage.getItem('sappers-path.v3') }; });
  await p.tap('#map-play'); await wait(300); const mp = await st(p);
  ok('map: 4 eras / 100 levels, unlock in order, save survives reload, map Play -> next unbeaten', map0.eras >= 4 && map0.nodes >= 100 && map1.open === map0.open + 1 && mp.id === 'e1-02', { map0, map1, mapPlay: mp.id });
  const old = { v: 3, done: Object.fromEntries(LV.filter((l) => l.n <= 75).map((l) => [l.id, 2])), settings: { muted: false, fast: true, diff: 'hard' }, last: 'e3-75' };
  old.done['e4-90'] = 7; old.done['bogus'] = 3;
  await p.evaluate((o) => localStorage.setItem('sappers-path.v3', JSON.stringify(o)), old); await p.reload(); await p.waitForFunction(() => window.SP); await p.tap('#btn-tomap'); await wait(300);
  const map2 = await p.evaluate(() => { const nodes = [...document.querySelectorAll('#eras button, #eras [data-id]')]; return { open: nodes.filter((n) => !n.disabled && !/lock/.test(n.className)).length, count: document.querySelector('#map-count').textContent, s: SP.state() }; });
  await p.tap('#map-play'); await wait(300); const mp2 = await st(p);
  ok('old v3-style save loads sanely', mp2.id === 'e4-76' && map2.s.speed === 2 && map2.s.diff === 'hard', { count: map2.count, open: map2.open, speed: map2.s.speed, diff: map2.s.diff, mapPlay: mp2.id, done: map2.s.done });
  await p.evaluate(() => localStorage.setItem('sappers-path.v3', '{garbage')); await p.reload(); await p.waitForFunction(() => window.SP); ok('garbage save loads', (await st(p)).screen === 'title', 'title shown');
  // level 100 name + busiest moment frame pacing (rush five big squads on the boss)
  await p.evaluate(() => SP.load(100, 'easy')); await wait(300); const name100 = await p.evaluate(() => ({ num: document.querySelector('#lvl-num').textContent, name: document.querySelector('#lvl-name').textContent }));
  ok('level 100 has a name', name100.name && !/undefined/.test(name100.name), name100);
  await p.evaluate(() => { window.__dt = []; let last = performance.now(); const f = (t) => { window.__dt.push(t - last); last = t; if (window.__dt.length < 400) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  for (let k = 0; k < 8; k++) { const s = await st(p); const c = [0, 1, 2, 3, 4].sort((a, b2) => ((s.fronts[b2] || { n: 0 }).n - (s.fronts[a] || { n: 0 }).n)).find((c) => s.fronts[c]); if (s.li.free === 0 || c === undefined) break; await tapCard(p, c); await wait(120); }
  let peakRunners = 0; for (let k = 0; k < 12; k++) { const s = await st(p); peakRunners = Math.max(peakRunners, s.runners); if (k === 5) await p.screenshot({ path: path.join(SHOTS, 'phone-l100-swarm.png') }); await wait(250); }
  const dt = await p.evaluate(() => window.__dt.slice(5)); dt.sort((a, c) => a - c); const q = (x) => dt[Math.floor(x * (dt.length - 1))];
  ok('busiest moment frame pacing', q(0.95) < 25 && dt.filter((x) => x > 50).length <= 2, { frames: dt.length, p50: q(0.5).toFixed(1), p95: q(0.95).toFixed(1), max: dt[dt.length - 1].toFixed(1), over33: dt.filter((x) => x > 33.4).length, over50: dt.filter((x) => x > 50).length, peakRunners, line: (await st(p)).line });
  // selfTest last (after everything)
  const t1 = Date.now(); const stRes = await p.evaluate(() => SP.selfTest()); ok('SP.selfTest()', stRes.pass > 0 && !stRes.fail.length, `pass ${stRes.pass} fail ${JSON.stringify(stRes.fail)} in ${Date.now() - t1} ms`);
}
// other viewports: see play2.mjs
ok('zero console errors/warnings across all runs', errs.length === 0, errs.slice(0, 20));
fs.writeFileSync(path.join(here, 'play-result.json'), JSON.stringify(R, null, 1)); await b.close();
