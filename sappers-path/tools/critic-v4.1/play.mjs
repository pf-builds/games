// Critic v4.1 browser pass: 375x812 (touch) and the 400x600 iframe. Per viewport, on a moat level, a towered Siege castle
// and a Gallery picture: win (real taps), loss (a jam order from the critic's rules), refused tap, power-ups via the badges,
// runners entering through the entry square, zero console errors; selfTest once. node tools/critic-v4.1/play.mjs (server :8492)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { compile, Game } from './rules.mjs';
const PW = await import(process.env.PLAYWRIGHT_MODULE); const { chromium } = PW.default || PW;
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), SHOTS = path.join(root, 'tools/shots-v4.1-critic/functional'), BASE = 'http://127.0.0.1:8492/sappers-path/';
const LV = JSON.parse(fs.readFileSync(path.join(root, 'levels/levels.json'))).levels, GAL = JSON.parse(fs.readFileSync(path.join(root, 'levels/gallery.json'))).levels, cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json')));
const moat = LV.find((l) => l.era === 2 && (l.gates || []).length && l.grid.some((r) => r.startsWith('~'))), castle = LV.find((l) => l.n >= 52 && (l.towers || []).length >= 2 && (l.gates || []).length), pic = GAL[0];
const lossOf = (L) => { for (let seed = 1; seed < 500; seed++) { let s = seed; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); const r = cfg.v3.rules.normal, G = new Game(compile(L), { hold: r.hold, archersKill: r.archersKill, lockSpaces: 1 }, cfg.v3.time), o = [];
  while (G.status === 0 && o.length < 90) { const lg = [0, 1, 2, 3, 4].filter((c) => G.legal(c)); const c = lg[Math.floor(rnd() * lg.length)]; o.push(c); G.play(c); G.quiet(); } if (G.status === -1) return o; } return null; };
const R = {}, errs = []; const ok = (k, pass, info) => { R[k] = { pass: !!pass, info }; console.log((pass ? 'PASS ' : 'FAIL ') + k + ' :: ' + JSON.stringify(info).slice(0, 900)); };
const b = await chromium.launch(); const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(label, opts, url, frameSel) { const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${label}] ${m.type()}: ${m.text()}`); }); p.on('pageerror', (e) => errs.push(`[${label}] PAGEERROR ${e.message}`));
  await p.goto(url); let F = p.mainFrame(); const frame = async () => { if (frameSel) { await p.waitForSelector(frameSel); F = await (await p.$(frameSel)).contentFrame(); } await F.waitForFunction(() => window.SP && SP.state().screen === 'title'); };
  await frame(); await F.evaluate(() => localStorage.clear()); await p.reload(); await frame(); await F.evaluate(() => SP.unlockTo(30));
  const tap = (sel) => (opts.hasTouch ? F.tap(sel, { timeout: 3000 }) : F.click(sel, { timeout: 3000 })); const st = () => F.evaluate(() => SP.state());
  for (const L of [moat, castle, pic]) { const tag = `${label} ${L.id}`; const out = {};
    // win with real taps
    await F.evaluate((id) => SP.load(id, 'normal'), L.id); await wait(250); const ent = await F.evaluate(() => ({ cs: +(SP.state().cs / devicePixelRatio).toFixed(1) }));
    let sawRunner = null; for (const [i, c] of [...L.win.normal].entries()) { const s = await st(); if (s.status !== 'playing') break; await tap(`#tray button.tile.card[data-col="${c}"]`); if (i === 1) { await wait(700); sawRunner = await F.evaluate(() => { try { return { runners: SP.state().runners, sides: SP.sides ? SP.sides() : null }; } catch (e) { return e.message; } }); } await F.evaluate(() => SP.settle()); }
    await F.waitForFunction(() => SP.state().panel, null, { timeout: 15000 }).catch(() => {}); await wait(500); let s = await st(); out.win = `${s.status} | ${await F.evaluate(() => document.querySelector('#p-title').textContent)}`; out.runner = sawRunner; out.cs = ent.cs;
    if (L === moat) await p.screenshot({ path: path.join(SHOTS, `${label}-${L.id}-won.png`) });
    // loss
    const lo = lossOf(L); await F.evaluate((id) => SP.load(id, 'normal'), L.id); await wait(150); for (const c of lo || []) { const s2 = await st(); if (s2.status !== 'playing') break; await tap(`#tray button.tile.card[data-col="${c}"]`); await F.evaluate(() => SP.settle()); }
    await F.waitForFunction(() => SP.state().panel, null, { timeout: 10000 }).catch(() => {}); await wait(400); s = await st(); out.loss = `${s.status}/${s.reason} | ${await F.evaluate(() => (document.querySelector('#p-line').getAttribute('aria-label') || document.querySelector('#p-line').textContent).slice(0, 90))}`;
    // refused tap
    await F.evaluate((id) => SP.load(id, 'normal'), L.id); await wait(150); const f = await F.evaluate(() => SP.fill()); const b4 = await st(); const fc = b4.fronts.findIndex((x) => x); let refusedOK = 'no full line';
    if (b4.li.free === 0 && fc >= 0) { await tap(`#tray button.tile.card[data-col="${fc}"]`); await wait(120); const af = await st(); refusedOK = `${af.refused - b4.refused} refused, plays ${b4.plays}->${af.plays}, toast "${await F.evaluate(() => document.querySelector('#toast').hidden ? '' : document.querySelector('#toast').textContent)}"`; }
    out.refused = refusedOK;
    // power-ups via badges: Ladder, then Quartermaster on a row-2 tile
    await F.evaluate((id) => { SP.setMeta({ inv: { ladder: 1, quartermaster: 1, scout: 1, recall: 1 } }); SP.load(id, 'normal'); }, L.id); await wait(200); const p0 = await st();
    await tap('#powers .pw[data-k="0"]'); await wait(150); const p1 = await st(); const cols0 = await F.evaluate(() => [...document.querySelectorAll('#tray .col')].map((c) => c.innerText.replace(/\s+/g, ' ')));
    const j = cols0.findIndex((c) => c.split(' ').length >= 2); await tap('#powers .pw[data-k="1"]'); await wait(100); await tap(`#tray .col:nth-child(${j + 1}) > .tile:nth-child(2)`); await wait(250);
    const cols1 = await F.evaluate(() => [...document.querySelectorAll('#tray .col')].map((c) => c.innerText.replace(/\s+/g, ' '))); const m = await F.evaluate(() => SP.meta());
    out.power = `Ladder open ${p0.open}->${p1.open}; QM col ${j}: "${cols0[j]}" -> "${cols1[j]}"; inv ${JSON.stringify(m.inv)} used ${JSON.stringify(m.used)}`;
    const pass = /^won/.test(out.win) && /^failed/.test(out.loss) && /^1 refused, plays (\d+)->\1/.test(out.refused) && p1.open === p0.open + 1 && cols1[j] !== cols0[j] && m.inv.ladder === 0 && m.inv.quartermaster === 0 && out.cs >= 8;
    ok(tag + ` (${L === moat ? 'moat' : L === castle ? 'towered castle' : 'Gallery'})`, pass, out); }
  if (label === '375x812') { const t = Date.now(); const r = await F.evaluate(() => SP.selfTest()); ok('SP.selfTest()', !r.fail.length, `pass ${r.pass} fail ${JSON.stringify(r.fail).slice(0, 400)} in ${Date.now() - t} ms`); }
  await ctx.close(); }
await run('375x812', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, BASE + '?debug=1');
await run('iframe400x600', { viewport: { width: 800, height: 700 } }, BASE + 'tools/iframe-host.html', '#game');
ok('zero console errors/warnings', errs.length === 0, errs.slice(0, 10)); console.log('levels used:', moat.id, castle.id, pic.id);
fs.writeFileSync(path.join(here, 'play-result.json'), JSON.stringify(R, null, 1)); await b.close();
