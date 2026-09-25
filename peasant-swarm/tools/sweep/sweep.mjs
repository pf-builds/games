// M8 sweep runner (copied into peasant-swarm/tools/sweep at v3 M2a; the v3 sweep runner from now on): seeded all-AI and fog-honest bot matches under a PS.cfgOverride patch, P pages in parallel, deterministic
// (the page's rAF loop is stopped after boot, so only PS.step advances the sim). Writes every match record + a summary.
//   node sweep.mjs --url http://127.0.0.1:8483/peasant-swarm/?debug=1 --tag base --patch '{}' --ai 20 --bot normal:20,easy:10,hard:10 --seed 7000 --par 4 --out res/base.json
// v3 (M2a): the Playwright module path comes from PLAYWRIGHT_MODULE (Mac: $(npm root -g)/playwright/index.mjs), else the v2 container path
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
import fs from 'node:fs';
import path from 'node:path';
import { installHelpers, runChunk } from './botlib.mjs';

const A = { url: 'http://127.0.0.1:8483/peasant-swarm/?debug=1', tag: 'run', patch: '{}', ai: 0, bot: '', seed: 7000, par: 4, out: null, secs: 300, cap: null };
for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
A.ai = +A.ai; A.par = +A.par; A.seed = +A.seed; A.secs = +A.secs;
const patch = JSON.parse(A.patch);
const POLICY = { sight: 400, hunt: 0.7, flee: 1.4, fleeDist: 300 }; // harness.mjs POLICY
const jobs = [];
for (let k = 0; k < A.ai; k++) jobs.push({ kind: 'ai', difficulty: 'normal', seed: A.seed + k });
for (const part of A.bot ? A.bot.split(',') : []) { const [d, n] = part.split(':'); for (let k = 0; k < +n; k++) jobs.push({ kind: 'bot', difficulty: d, seed: A.seed + 1000 + k }); }

async function match(page, job) {
  const w0 = Date.now();
  await page.evaluate((o) => window.PS.debugStart(o), { seed: job.seed, difficulty: job.difficulty, aiPlayer: job.kind === 'ai' });
  for (let g = 0; g < Math.ceil(A.secs / 30) + 10; g++) {
    const c = job.kind === 'ai'
      ? await page.evaluate(() => { const S = window.PSS, w0 = performance.now(); let n = 0; while (S.mode === 'play' && n < 30 && performance.now() - w0 < 12000) { window.PS.step(1); n++; } return { mode: S.mode }; })
      : await page.evaluate(runChunk, { until: 1e9, maxSim: 30, tick: 0.5, wallMs: 12000, policy: POLICY, leak: false });
    if (c.mode !== 'play') break;
  }
  const p = await page.evaluate(() => { const S = window.PSS, P = window.PS.pacing(); return { ...P, gains: undefined, g1: P.gains.filter((g) => g[1] === 1).map((g) => [Math.round(g[0]), g[2], g[4]]), gsrc: P.gains.map((g) => g[4]).join(','), taken: P.taken.filter((x) => x[1] === 1).length, won: S.result === 'win', bell: S.timeLeft <= 0.001, alive: S.teams.slice(1).map((t) => t.alive), viol: S.fogS.ai.violations, capOver: S.dbg.capOver, fv: (() => { let b = null; for (let r = 2; r < 7; r++) { const v = S.fogS.verdict[r], ob = S.fogS.obs[1][r]; if (ob && ob.ever && v && (!b || v.t0 < b.t0)) b = { t0: +v.t0.toFixed(1), kind: v.kind, r }; } return b; })() }; });
  return { ...job, ...p, wallMs: Date.now() - w0 };
}

async function worker(browser, q, out, errs) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e.message || e)));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/fonts\.g|ERR_CERT|net::/.test(m.text())) errs.push(m.text()); });
  await page.goto(A.url + (A.cap ? '&cap=' + A.cap : ''));
  await page.waitForFunction(() => window.PS && window.PS.debugStart && window.PS.cfgOverride && window.PSS && window.PSS.teams.length > 1, null, { timeout: 30000 });
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; }); // stop the frame loop: PS.step alone advances the sim
  await page.evaluate(installHelpers);
  await page.evaluate((p) => { window.PS.cfgOverride(p); if (p.terrain) window.PS.terrain.init(window.PSS.cfg); }, patch);
  while (q.length) { const job = q.shift(); try { out.push(await match(page, job)); } catch (e) { errs.push('job ' + JSON.stringify(job) + ': ' + e.message); } }
  await ctx.close();
}

const t0 = Date.now();
const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const q = jobs.slice(), out = [], errs = [];
await Promise.all(Array.from({ length: Math.min(A.par, jobs.length) }, () => worker(browser, q, out, errs)));
await browser.close();
out.sort((a, b) => (a.kind + a.difficulty + a.seed).localeCompare(b.kind + b.difficulty + b.seed));
const res = { tag: A.tag, patch, seed: A.seed, wallS: Math.round((Date.now() - t0) / 1000), errors: errs, matches: out };
if (A.out) { fs.mkdirSync(path.dirname(A.out), { recursive: true }); fs.writeFileSync(A.out, JSON.stringify(res)); }
const { summarize, fmt } = await import('./summ.mjs');
console.log(fmt(A.tag, summarize(out)), '\nwall', res.wallS, 's; errors', errs.length ? errs.slice(0, 5) : 0);
