// Critic v4-1 diff: the critic's rules (rules.mjs) against the game's engine as a black box (src/engine.js exports only).
// Usage: node tools/critic-v4-1/diff.mjs [--patient 4] [--rushed 3] [--only e3-62,...] [--waryAt hit|disp] [--backWalk yardTile|yardCarry|tile|carry] [--discLT] [--out file.json]
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { compile, Game, PLAYING, WON, FAILED, REFUSED } from './rules.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), require = createRequire(import.meta.url);
const E = require(path.join(root, 'src/engine.js')), cfg = require(path.join(root, 'config.json'));
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const NP = +arg('patient', 4), NR = +arg('rushed', 3), only = arg('only', ''), opt = { waryAt: arg('waryAt', 'disp'), backWalk: arg('backWalk', 'yardTile'), discLE: !args.includes('--discLT') };
const levels = [...require(path.join(root, 'tools/build-data/levels/levels.json')).levels, ...require(path.join(root, 'levels/debug-v4.json')).levels].filter((l) => !only || only.split(',').includes(l.id));
const DIFFS = ['easy', 'normal', 'hard'], NAME = {}; for (const k in E.EV) NAME[E.EV[k]] = k;
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// ---- the game's engine, stepped event time by event time (nextAt) so every event gets its time ----
function engine(L, d) {
  const C = E.compile(L), S = E.sim(C, E.rulesOf(cfg.v3, d)); S.logOn = true; const pops = [], evs = [];
  const drain = () => { for (let i = 0; i + 2 < S.evLen; i += 3) { const ty = S.ev[i], a = S.ev[i + 1], b = S.ev[i + 2]; evs.push([S.now, NAME[ty], a, b]); if (ty === E.EV.EAT) pops.push([S.now, a]); } S.clearLog(); };
  drain();
  return { S, pops, evs, get status() { return S.status === E.WON ? WON : S.status === E.FAILED ? FAILED : PLAYING; }, get reason() { return S.reason || ''; },
    get now() { return S.now; }, get busy() { return S.busy; }, get peak() { return S.peak; }, get plays() { return S.plays; }, get jamWhy() { return S.jamWhy; },
    play(col, t) { const r = S.play(col, t === undefined ? S.now : t); drain(); return r === E.REFUSED ? REFUSED : r; },
    advanceTo(t) { let g = 0; while (S.busy && S.nextAt <= t && g++ < 1e6) { const nt = S.nextAt; S.advanceTo(nt); drain(); if (S.status !== E.PLAYING) break; } if (S.status === E.PLAYING) { S.advanceTo(t); drain(); } },
    quiet() { let g = 0; while (S.busy && S.status === E.PLAYING && g++ < 1e6) { S.advanceTo(S.nextAt); drain(); if (S.status !== E.PLAYING) break; } } };
}
// ---- mine ----
function mine(L, d) { const C = compile(L), r = cfg.v3.rules[d], G = new Game(C, { hold: r.hold, archersKill: r.archersKill, lockSpaces: cfg.v3.twists.lockSpaces }, cfg.v3.time, opt);
  return { G, get pops() { return G.log.filter((e) => e.e === 'EAT').map((e) => [e.t, e.c]); }, get status() { return G.status; }, get reason() { return G.reason; }, get now() { return G.now; },
    get busy() { return G.busy; }, get peak() { return G.peak; }, get plays() { return G.plays; }, get jamWhy() { return G.jamWhy; }, play: (c, t) => G.play(c, t), advanceTo: (t) => G.advanceTo(t), quiet: () => G.quiet() }; }

function firstDiff(a, b) { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) { const x = a[i], y = b[i]; if (!x || !y || x[0] !== y[0] || x[1] !== y[1]) return { i, mine: x || null, game: y || null }; } return null; }
function compare(tag, L, d, M, G, taps) {
  const out = []; const fd = firstDiff(M.pops, G.pops);
  if (M.status !== G.status || M.reason !== G.reason) out.push(`status mine ${M.status}/${M.reason} game ${G.status}/${G.reason}`);
  if (fd) { const ctx = (G.evs || []).filter((e) => fd.game ? e[0] <= fd.game[0] + 1 && e[0] >= fd.game[0] - 400 : true).slice(-12).map((e) => e.join(':')).join(' ');
    out.push(`pop #${fd.i}: mine ${JSON.stringify(fd.mine)} game ${JSON.stringify(fd.game)} (cell = y*w+x, w=${L.w}); game events near: ${ctx}`); }
  if (M.status === FAILED && M.reason === 'jam' && G.reason === 'jam' && M.jamWhy !== G.jamWhy) out.push(`jamWhy mine ${M.jamWhy} game ${G.jamWhy}`);
  return out.length ? { tag, id: L.id, d, taps, issues: out } : null;
}
function patient(L, d, pick, mode) { // pick(M, legalCols) -> col; returns taps
  const M = mine(L, d), G = engine(L, d), taps = [], issues = []; let guard = 0;
  while (M.status === PLAYING && G.status === PLAYING && guard++ < 200) {
    const legal = [0, 1, 2, 3, 4].filter((c) => M.G.legal(c)); if (!legal.length) { issues.push('no legal tap at rest while PLAYING (mine)'); break; }
    const col = pick(M, legal, taps.length); if (col < 0) break; taps.push(col);
    const rm = M.play(col), rg = G.play(col); if ((rm === REFUSED) !== (rg === REFUSED)) { issues.push(`tap ${taps.length} col ${col}: mine returned ${rm}, game ${rg}`); break; }
    if (M.G.C.cards[M.G.squads[M.G.squads.length - 1].card].partner >= 0) cov.linkTaps++; M.quiet(); G.quiet(); hiddenCheck(M, G, L, mode + ' after tap ' + taps.length);
  }
  tally(M, mode);
  const c = compare(mode, L, d, M, G, taps.join('')); if (issues.length) return { tag: mode, id: L.id, d, taps: taps.join(''), issues: [...issues, ...(c ? c.issues : [])] };
  return { res: c, M, G, taps };
}
function rushed(L, d, seed) { const R = rng(seed), M = mine(L, d), G = engine(L, d), taps = []; let t = 0, guard = 0; const issues = [];
  while (M.status === PLAYING && G.status === PLAYING && guard++ < 300) {
    t += Math.floor(R() * 1500); M.advanceTo(t); G.advanceTo(t); if (M.status !== PLAYING || G.status !== PLAYING) break;
    const cols = [0, 1, 2, 3, 4].filter((c) => M.G.front(c) >= 0); if (!cols.length) { M.quiet(); G.quiet(); break; }
    const col = cols[Math.floor(R() * cols.length)]; const rm = M.play(col, t), rg = G.play(col, t); taps.push(`${col}@${t}${rm === REFUSED ? 'R' : ''}`); if (rm === REFUSED) { cov.refused++; if (M.G.need(col) === 2) cov.refusedLinked++; }
    if ((rm === REFUSED) !== (rg === REFUSED)) { issues.push(`tap ${taps.length} col ${col} at ${t}: mine returned ${rm}, game ${rg}`); break; }
    if (M.G.busy === false && G.busy === false && M.status === PLAYING && [0, 1, 2, 3, 4].every((c) => M.G.front(c) < 0)) break;
  }
  if (!issues.length) { M.quiet(); G.quiet(); } tally(M, 'rushed');
  const c = compare('rushed', L, d, M, G, taps.join(' ')); if (issues.length) return { tag: 'rushed', id: L.id, d, taps: taps.join(' '), issues: [...issues, ...(c ? c.issues : [])] }; return c;
}
const cov = { hitGames: 0, killGames: 0, unlockGames: 0, linkTaps: 0, refused: 0, refusedLinked: 0, revealChecks: 0, revealMismatch: 0, jamWhy: {}, rushedEnd: {} };
function tally(M, tag) { const lg = M.G.log; if (lg.some((e) => e.e === 'HIT')) cov.hitGames++; if (lg.some((e) => e.e === 'KILL')) cov.killGames++; if (lg.some((e) => e.e === 'UNLOCK')) cov.unlockGames++;
  if (M.status === FAILED && M.reason === 'jam') cov.jamWhy[M.jamWhy] = (cov.jamWhy[M.jamWhy] || 0) + 1; if (tag === 'rushed') { const k = M.status + '/' + M.reason; cov.rushedEnd[k] = (cov.rushedEnd[k] || 0) + 1; } }
function hiddenCheck(M, G, L, where) { const n = M.G.C.cards.length; for (let id = 0; id < n; id++) { cov.revealChecks++; const a = M.G.hidden(id), b = !!G.S.hidden(id); if (a !== b) { cov.revealMismatch++; if (cov.revealMismatch < 6) console.log('HIDDEN mismatch', L.id, where, 'card', id, 'mine', a, 'game', b); } } }
const mism = [], stats = { games: 0, replays: 0, replayWins: 0, gradeChecks: 0, gradeMismatch: [], statusCounts: {} }; const t0 = Date.now();
for (const L of levels) for (const d of DIFFS) {
  // 1. stored winning order, patient
  if (L.win && L.win[d]) { const seq = L.win[d].split('').map(Number); const r = patient(L, d, (M, legal, i) => (i < seq.length ? seq[i] : -1), 'stored'); stats.games++; stats.replays++;
    if (r.issues) mism.push(r); else { if (r.res) mism.push(r.res);
      if (r.G.status === WON) stats.replayWins++; else mism.push({ tag: 'stored', id: L.id, d, taps: L.win[d], issues: [`stored order does not win in the GAME: ${r.G.status}/${r.G.reason}`] });
      if (r.M.status !== WON) mism.push({ tag: 'stored', id: L.id, d, taps: L.win[d], issues: [`stored order does not win in MY rules: ${r.M.status}/${r.M.reason}`] });
      const g = L.grade && L.grade[d]; if (g) { stats.gradeChecks++; const endPop = r.M.G.winAt, endM = r.M.G.settle();
        const bad = []; if (g.len !== undefined && g.len !== seq.length) bad.push(`len ${g.len} vs taps ${seq.length}`); if (g.len !== undefined && g.len !== r.M.plays) bad.push(`len ${g.len} vs my plays ${r.M.plays}`);
        if (g.peak !== undefined && g.peak !== r.M.peak) bad.push(`peak ${g.peak} vs mine ${r.M.peak}`); if (g.ms !== undefined && g.ms !== endM) bad.push(`ms ${g.ms} vs my all-home ${endM} (last pop ${endPop})`);
        if (bad.length) stats.gradeMismatch.push({ id: L.id, d, bad }); } } }
  // 2. random legal patient
  for (let k = 0; k < NP; k++) { const R = rng(1000 * k + L.w * 7 + d.length); const r = patient(L, d, (M, legal) => legal[Math.floor(R() * legal.length)], 'patient#' + k); stats.games++;
    if (r.issues) mism.push(r); else { if (r.res) mism.push(r.res); const key = `${r.G.status}/${r.G.reason}`; stats.statusCounts[key] = (stats.statusCounts[key] || 0) + 1; } }
  // 3. rushed
  for (let k = 0; k < NR; k++) { const r = rushed(L, d, 77 + 131 * k + L.h); stats.games++; if (r) mism.push(r); }
}
stats.ms = Date.now() - t0; stats.cov = cov; stats.opt = opt; stats.levels = levels.length;
const out = arg('out', path.join(here, 'diff-result.json')); fs.writeFileSync(out, JSON.stringify({ stats, mism }, null, 1));
console.log(`levels ${levels.length} x 3 diffs, games ${stats.games}, stored replays ${stats.replays} (game wins ${stats.replayWins}), grade checks ${stats.gradeChecks}, grade mismatches ${stats.gradeMismatch.length}, mismatching games ${mism.length}, ${stats.ms} ms`);
console.log('patient outcomes (game):', JSON.stringify(stats.statusCounts)); console.log('coverage:', JSON.stringify(cov));
for (const g of stats.gradeMismatch.slice(0, 8)) console.log('GRADE', g.id, g.d, g.bad.join('; '));
const byTag = {}; for (const m of mism) byTag[m.tag.replace(/#\d+/, '')] = (byTag[m.tag.replace(/#\d+/, '')] || 0) + 1; console.log('mismatch by kind', JSON.stringify(byTag));
for (const m of mism.slice(0, +arg('show', 10))) console.log(`MISMATCH ${m.tag} ${m.id} ${m.d} taps[${m.taps}]\n   ${m.issues.join('\n   ')}`);
