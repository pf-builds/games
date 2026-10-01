// Critic v4-2 Part 2c: report time excludes pauses, coins per difficulty (first win and repeat), medals lit, map era cards.
const PW = await import(process.env.PLAYWRIGHT_MODULE); const { chromium } = PW.default || PW; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage(); const errs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
const ok = (k, pass, info) => console.log((pass ? 'PASS ' : 'FAIL ') + k + ' :: ' + JSON.stringify(info).slice(0, 1200));
await p.goto('http://127.0.0.1:8492/sappers-path/?debug=1'); await p.waitForFunction(() => window.SP && SP.state().screen === 'title'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.SP && SP.state().screen === 'title');
// report time with a 3 s pause in the middle (3x speed, real taps, patient)
await p.evaluate(() => { SP.speed(3); SP.load(1, 'normal'); }); await wait(100); const order = await p.evaluate(() => SP.winOrder('normal')); const t0 = Date.now(); let paused = 0, dec = 0;
for (const [i, c] of [...order].entries()) { await p.tap(`#tray button.tile.card[data-col="${c}"]`); await wait(60); if (i === 2) { await wait(300); await p.evaluate(() => window.dispatchEvent(new Event('blur'))); const a = Date.now(); await wait(3000); await p.tap('#pause'); paused = Date.now() - a; }
  for (let g = 0; g < 600; g++) { const s = await p.evaluate(() => SP.state()); if (!s.busy || s.status !== 'playing') break; await wait(50); } if ((await p.evaluate(() => SP.state().status)) !== 'playing') { dec = Date.now(); break; } }
if (!dec) { await p.waitForFunction(() => SP.state().status !== 'playing'); dec = Date.now(); } await p.waitForFunction(() => SP.state().panel); await wait(2500); const m = await p.evaluate(() => SP.meta());
ok('report time excludes a pause', Math.abs(m.report.ms - (dec - t0 - paused)) < 1500, { reportMs: m.report.ms, wall: dec - t0, paused, wallMinusPause: dec - t0 - paused, shown: await p.evaluate(() => document.querySelector('#p-time').textContent) });
const medals = await p.evaluate(() => [...document.querySelectorAll('#p-medals .medal')].map((e) => e.textContent + ':' + e.className));
// coins: Hard first (+60), Easy first (+15), Hard repeat (+20)
const coins = []; for (const d of ['hard', 'easy', 'hard']) { const c0 = (await p.evaluate(() => SP.meta())).coins; await p.evaluate((d) => { SP.load(1, d); for (const c of SP.winOrder(d)) { SP.play(+c); SP.settle(); } }, d); await p.waitForFunction(() => SP.state().panel); await wait(2600); const m2 = await p.evaluate(() => SP.meta()); coins.push([d, m2.coins - c0, m2.report.coins, await p.evaluate(() => document.querySelector('#p-coins').textContent)]); }
const medals2 = await p.evaluate(() => [...document.querySelectorAll('#p-medals .medal')].map((e) => e.textContent + ':' + e.className));
ok('coins per difficulty: Hard first +60, Easy first +15, Hard repeat +20', coins[0][1] === 60 && coins[1][1] === 15 && coins[2][1] === 20, { coins, medalsAfterNormal: medals, medalsAfterAll: medals2 });
// debug level earns nothing
{ const c0 = (await p.evaluate(() => SP.meta())).coins; await p.evaluate(() => { SP.load('v4-linked', 'normal'); for (const c of SP.winOrder('normal')) { SP.play(+c); SP.settle(); } }); await p.waitForFunction(() => SP.state().panel); await wait(2000); ok('debug level earns no coins', (await p.evaluate(() => SP.meta())).coins === c0, { c0, after: (await p.evaluate(() => SP.meta())).coins, status: (await p.evaluate(() => SP.state())).status }); }
// map era cards
await p.evaluate(() => SP.screen('map')); await wait(300); const cards = await p.evaluate(() => [...document.querySelectorAll('#eras .era-card, #eras [class*=card]')].slice(0, 5).map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 120)));
ok('map era report card (Era 1: cleared, medals, coins)', cards.length > 0 && /1/.test(cards[0] || ''), { cards, story: await p.evaluate(() => (document.querySelector('#map-story') || {}).textContent?.slice(0, 80)) });
ok('zero console errors/warnings (part 2c)', errs.length === 0, errs); await b.close();
