// Critic v5 diff (from v4.3): rules from the v5 R1 entry (rules.mjs); the tag formula is the v5 R2 entry's realm schedule
// (bake-config tags.realms; the Gallery keeps v4.3's; v5 R4: realms 6-8 with their own cycles and end tags, tags.cycles);
// every lock on a Hard or Extreme level from 50; no level uses a feature before (v5 R4: mystery blocks too)
// its milestone (config v5.density.unlock). Debug levels are not in the v5 campaign's checks (they play Normal).
// Critic v4.3 diff (from v4.1): every level on its own tag only (SPEC-v4 v4.3), tag formula and cross-buried pairs checked
// against the level files, a refused tap in a stored order is a mismatch, maxWait includes the winning tap to everyone home.
// Critic v4.1 diff (from v4-2): strict same-instant event order (SPEC-v4 Critics 2 fix S1), picture-format check of every
// level (SPEC-v4 v4.1), the dealer's park limits along stored orders (informational), plus everything v4-2 did.
// Critic v4-2 diff: the critic's rules (rules.mjs, from the SPEC text) against the game's engine as a black box (exports only).
// Every level: 100 siege + 4 debug + 60 Gallery, on Easy, Normal and Hard. Stored orders (win + grade), random patient and
// rushed legal games, and power-up games (patient and rushed, refused power-ups included), compared event by event
// (EAT cell, FREE space, REVEAL card, POWER k a, UNLOCK, KILL with times), plus status, reason, jamWhy, hidden() per card,
// and for every refused power-up: the engine's save buffer, hash and use counts byte-identical.
// Usage: node tools/critic-v4-2/diff.mjs [--patient 4] [--rushed 3] [--power 6] [--only id,id] [--set siege|gallery|debug] [--show 10]
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { compile, picProblems, Game, PLAYING, WON, FAILED, REFUSED, NOPLAY } from './rules.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), require = createRequire(import.meta.url);
const E = require(path.join(root, 'src/engine.js')), cfg = require(path.join(root, 'config.json'));
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const NP = +arg('patient', 4), NR = +arg('rushed', 3), NW = +arg('power', 6), only = arg('only', ''), set = arg('set', '');
const tagged = (f, s) => require(path.join(root, f)).levels.map((l) => Object.assign({ set: s }, l));
const levels = [...tagged('levels/levels.json', 'siege'), ...tagged('levels/debug-v4.json', 'debug'), ...tagged('levels/gallery.json', 'gallery')].filter((l) => (!only || only.split(',').includes(l.id)) && (!set || l.set === set));
const DIFFS = ['easy', 'normal', 'hard'], NAME = {}; for (const k in E.EV) NAME[E.EV[k]] = k;
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const KEEP = new Set(['EAT', 'FREE', 'REVEAL', 'POWER', 'UNLOCK', 'KILL', 'GATE', 'TOWER', 'CLEAR', 'SHOW']); // v5 R4 fix: the Volley's CLEARs and mystery blocks' SHOWs
function engine(L, d) {
  const C = E.compile(L), S = E.sim(C, E.rulesOf(cfg.v3, d, cfg.meta)); S.logOn = true; const evs = [];
  const drain = () => { if (S.evLost) evs.push([S.now, 'LOST']); for (let i = 0; i + 2 < S.evLen; i += 3) { const n = NAME[S.ev[i]]; if (KEEP.has(n)) evs.push(norm(S.now, n, S.ev[i + 1], S.ev[i + 2])); } S.clearLog(); };
  drain(); const st = () => (S.status === E.WON ? WON : S.status === E.FAILED ? FAILED : PLAYING);
  return { S, C, evs, get status() { return st(); }, get reason() { return S.reason || ''; }, get now() { return S.now; }, get busy() { return S.busy; }, get peak() { return S.peak; }, get plays() { return S.plays; }, get jamWhy() { return S.jamWhy; },
    play(col, t) { if (t !== undefined) this.advanceTo(t); const r = S.play(col, S.now); drain(); return r === E.REFUSED ? REFUSED : r === E.NOPLAY ? NOPLAY : 0; },
    power(k, a, t) { if (t !== undefined) this.advanceTo(t); const c = S.canPower(k, a); const b0 = Array.from(S.save()).join(','), h0 = S.hash(), u0 = [0, 1, 2, 3, 4].map((x) => S.used(x)).join(); const r = S.power(k, a, S.now); drain();
      const rr = r === E.REFUSED ? REFUSED : r === E.NOPLAY ? NOPLAY : 0; const cc = c === true ? 0 : rr === 0 ? 'false' : rr;
      let same = null; if (rr !== 0) same = Array.from(S.save()).join(',') === b0 && S.hash() === h0 && [0, 1, 2, 3, 4].map((x) => S.used(x)).join() === u0; return { r: rr, can: cc, same }; },
    hidden: (i) => !!S.hidden(i),
    advanceTo(t) { let g = 0; while (S.busy && S.status === E.PLAYING && S.nextAt <= t && g++ < 1e6) { S.advanceTo(S.nextAt); drain(); } if (S.status === E.PLAYING) { S.advanceTo(t); drain(); } },
    quiet() { let g = 0; while (S.busy && S.status === E.PLAYING && g++ < 1e6) { S.advanceTo(S.nextAt); drain(); } } };
}
function norm(t, n, a, b) { return n === 'EAT' || n === 'CLEAR' || n === 'SHOW' ? [t, n, a] : n === 'FREE' ? [t, n, a] : n === 'REVEAL' ? [t, n, a] : n === 'POWER' ? [t, n, a, b] : [t, n]; }
function mine(L, d) { const C = compile(L), r = cfg.v3.rules, G = new Game(C, { hold: r.hold, archersKill: false, lockSpaces: cfg.v3.twists.lockSpaces, powers: cfg.meta.powers.map((p) => p.perLevel), pullDepth: cfg.meta.pullDepth }, cfg.v3.time);
  const evs = () => G.log.filter((e) => KEEP.has(e.e)).map((e) => (e.e === 'EAT' || e.e === 'CLEAR' || e.e === 'SHOW' ? [e.t, e.e, e.c] : e.e === 'FREE' ? [e.t, 'FREE', e.sp] : e.e === 'REVEAL' ? [e.t, 'REVEAL', e.id] : e.e === 'POWER' ? [e.t, 'POWER', e.k, e.a] : [e.t, e.e]));
  return { G, C, get evs() { return evs(); }, get status() { return G.status; }, get reason() { return G.reason; }, get now() { return G.now; }, get busy() { return G.busy; }, get peak() { return G.peak; }, get plays() { return G.plays; }, get jamWhy() { return G.jamWhy; },
    play: (c, t) => G.play(c, t), power: (k, a, t) => { const r = G.power(k, a, t); if (r === REFUSED) { cov.why[k + ':' + G.why] = (cov.why[k + ':' + G.why] || 0) + 1; } return { r }; }, hidden: (i) => G.hidden(i), advanceTo: (t) => G.advanceTo(t), quiet: () => G.quiet() }; }
const key = (e) => JSON.stringify(e);
function firstDiff(a, b) { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if (!a[i] || !b[i] || key(a[i]) !== key(b[i])) return { i, mine: a[i] || null, game: b[i] || null, ctxG: b.slice(Math.max(0, i - 4), i + 2), ctxM: a.slice(Math.max(0, i - 4), i + 2) }; return null; }
const cov = { why: {}, endNoplay: 0, endNoplayBad: 0, games: 0, byKind: {}, ops: { taken: [0, 0, 0, 0, 0], refused: [0, 0, 0, 0, 0], noplay: [0, 0, 0, 0, 0] }, shows: 0, clears: 0, refusedChecked: 0, refusedChanged: 0, canPowerDisagree: 0, hiddenChecks: 0, outcomes: {}, jamWhy: {}, killGames: 0, unlockGames: 0 };
const mism = [], gradeBad = [], fmt = [], park = []; const t0 = Date.now();
for (const L of levels) { const pr = picProblems(L); if (pr.length) fmt.push({ id: L.id, pr: pr.slice(0, 4) }); }
const TS = require(path.join(root, 'tools/bake-config.json')).tags, TG = require(path.join(root, 'tools/gallery-config.json')).bake.tags;
const tagOf = (n, T, teaching) => { const R = T.realms && T.realms.find((r) => n >= r[0] && n <= r[1]); // v5 R2: per realm (opener Easy lesson, end Hard, cycle restarts after the opener; realm 1 from T.from)
  if (R) { if (teaching) return n < T.from ? T.first : n === R[0] ? T.afterEnd : T.teach; const Y = T.cycles && T.cycles[R[0]]; if (Y) return n === R[1] ? Y.end : Y.cycle[(n - Y.start) % Y.cycle.length]; /* v5 R4: a realm's own cycle and end tag */ if (n === R[1]) return 'hard'; if (n < T.from) return T.first; return T.cycle[(n - Math.max(T.from, R[0] + 1)) % T.cycle.length]; }
  if (T.ends.includes(n)) return 'hard'; if (teaching) return n < T.from ? T.first : T.ends.includes(n - 1) ? T.afterEnd : T.teach; if (T.ends.includes(n - 1)) return T.afterEnd; if (n < T.from) return T.first; return T.cycle[(n - T.from) % T.cycle.length]; };
// Lands foundation: a land's level wears its land's profile tag (tools/land-plan.js landTags on its land.json), a
// Wandering Gallery side quest its turn of land-config bake.sideCycle.
const LP = require(path.join(root, 'tools/land-plan.js')), LCF = require(path.join(root, 'tools/land-config.json')), landTags = {};
const landTag = (L) => { const d = ((cfg.lands || {}).list || []).find((x) => x.k === L.land); if (!d) return 'no land ' + L.land; if (L.wander) return LCF.bake.sideCycle[(L.n - 1) % LCF.bake.sideCycle.length];
  if (!landTags[d.k]) { const lj = JSON.parse(fs.readFileSync(path.join(root, 'tools/lands', d.slug, 'land.json'), 'utf8')); landTags[d.k] = LP.landTags(d.to - d.from + 1, LP.profileOf(lj, LCF).tags, cfg.lands.perLand); } return landTags[d.k][L.n - d.from]; };
const tagBad = [], tagCount = {}, crossBuried = [];
for (const L of levels) { if (L.set === 'debug') { if (L.tag !== 'normal') tagBad.push(`${L.id} ${L.tag} (debug levels are normal)`); continue; }
  const want = L.land ? landTag(L) : L.set === 'gallery' ? tagOf(L.n, TG, false) : tagOf(L.n, TS, L.source === 'teaching'); tagCount[L.set + ':' + L.tag] = (tagCount[L.set + ':' + L.tag] || 0) + 1; if (want !== L.tag) tagBad.push(`${L.id} n${L.n} tag ${L.tag}, formula ${want}`);
  if (!L.win || Object.keys(L.win).join() !== L.tag || !L.grade || !L.grade[L.tag]) tagBad.push(`${L.id}: win/grade keys ${L.win && Object.keys(L.win)} / ${L.grade && Object.keys(L.grade).filter((k) => ['easy', 'normal', 'hard', 'extreme'].includes(k))}`); }
const UN = cfg.v5.density.unlock, early = []; // v5 R2: no feature before its milestone; locks only on Hard from 50
for (const L of levels) { if (L.set !== 'siege') continue; const f = []; if (L.grid.some((r) => r.includes('~'))) f.push('moat'); if ((L.gates || []).length) f.push('gate'); if ((L.links || []).length) f.push('linked'); if (L.cols.some((c) => c.some((cd) => cd[2]))) f.push('mystery'); if ((L.towers || []).length) f.push('tower'); if ((L.hidden || []).some((r) => r.includes('?'))) f.push('hidden'); // v5 R4
  for (const k of f) if (L.n < UN[k]) early.push(`${L.id} ${k} before ${UN[k]}`); if ((L.lock || L.locks) && !((L.tag === 'hard' || L.tag === 'extreme') && L.n >= cfg.v5.locks.from)) early.push(`${L.id} lock on ${L.tag} at ${L.n}`); }
for (const L of levels) { const ln = L.links || []; for (let i = 0; i < ln.length; i++) for (let j = i + 1; j < ln.length; j++) { const A = ln[i], B = ln[j];
  // cross-buried: in one column a card of A is ahead of a card of B, and in another column a card of B is ahead of a card of A
  const ahead = (X, Y) => X.some(([c1, i1]) => Y.some(([c2, i2]) => c1 === c2 && i1 < i2)); if (ahead(A, B) && ahead(B, A)) crossBuried.push(`${L.id} pairs ${JSON.stringify(A)} ${JSON.stringify(B)}`); } }
function parkCheck(L, d, M) { const G = M.G; let worst = 0, n2 = 0; for (const s of G.squads) if (!s.done && !s.recalled && s.waiting > 0) { worst = Math.max(worst, s.waiting); n2++; } return { worst, n: n2, tower: G.towerLeft.some((v) => v > 0) }; }
function hiddenCheck(M, G, where, issues) { for (let i = 0; i < M.C.cards.length; i++) { cov.hiddenChecks++; if (M.hidden(i) !== G.hidden(i)) { issues.push(`${where}: hidden(${i}) mine ${M.hidden(i)} game ${G.hidden(i)}`); return; } } }
function finish(kind, L, d, M, G, ops, issues) { cov.games++; for (const e of G.evs) { if (e[1] === 'SHOW') cov.shows++; if (e[1] === 'CLEAR') cov.clears++; }
  if (L.hidden) for (let c = 0; c < M.C.n; c++) if (!!M.G.hiddenCell(c) !== !!G.S.hiddenCell(c)) { issues.push(`hiddenCell(${c}) mine ${!!M.G.hiddenCell(c)} game ${!!G.S.hiddenCell(c)}`); break; } // v5 R4 fix
  if (kind.includes('power') && G.status !== PLAYING) for (let k = 0; k < 5; k++) { const rg = G.power(k, 0), rm = M.power(k, 0); cov.endNoplay++; if (rg.r !== NOPLAY || rm.r !== NOPLAY || rg.same !== true) { cov.endNoplayBad++; issues.push(`power ${k} after the end: game ${rg.r} (unchanged ${rg.same}) mine ${rm.r}`); } } cov.byKind[kind] = (cov.byKind[kind] || 0) + 1;
  const o = `${G.status}/${G.reason}`; cov.outcomes[o] = (cov.outcomes[o] || 0) + 1; if (G.reason === 'jam') cov.jamWhy[G.jamWhy] = (cov.jamWhy[G.jamWhy] || 0) + 1;
  if (M.G.kills) cov.killGames++; if (M.G.log.some((e) => e.e === 'UNLOCK')) cov.unlockGames++;
  if (M.status !== G.status || M.reason !== G.reason) issues.push(`status mine ${M.status}/${M.reason} game ${G.status}/${G.reason}`);
  if (G.reason === 'jam' && M.jamWhy !== G.jamWhy) issues.push(`jamWhy mine ${M.jamWhy} game ${G.jamWhy}`);
  const canon = (l) => l.map((e, i) => [e, i]).sort((x, y) => x[0][0] - y[0][0] || (key(x[0]) < key(y[0]) ? -1 : key(x[0]) > key(y[0]) ? 1 : 0)).map((x) => x[0]);
  // v5 R4 fix: the SPEC fixes SHOW's place only after the pop, clear or gate that exposed it (not against FREE, nor several
  // SHOWs at one instant): each instant's SHOWs are compared as a set, at the end of that instant (the functional critic's m1).
  const shows = (l) => { const out = []; for (let i = 0; i < l.length;) { let j = i; while (j < l.length && l[j][0] === l[i][0]) j++; const g = l.slice(i, j); out.push(...g.filter((e) => e[1] !== 'SHOW'), ...g.filter((e) => e[1] === 'SHOW').sort((x, y) => x[2] - y[2])); i = j; } return out; };
  const strict = firstDiff(shows(M.evs), shows(G.evs)), fd = firstDiff(canon(shows(M.evs)), canon(shows(G.evs))); if (strict && !fd) { cov.orderOnly = (cov.orderOnly || 0) + 1; const k = strict.game && strict.mine ? strict.game[1] + '/' + strict.mine[1] : '?'; cov.orderOnlyKinds = cov.orderOnlyKinds || {}; if (!cov.orderOnlyKinds[k]) cov.orderOnlyKinds[k] = `${L.id} ${d} ${kind} ops[${ops.join(' ').slice(0, 120)}] game ${key(strict.ctxG)} mine ${key(strict.ctxM)}`; }
  if (strict) issues.push(`${fd ? '' : 'ORDER ONLY '}event #${strict.i}: mine ${key(strict.mine)} game ${key(strict.game)} | game ctx ${key(strict.ctxG)} | mine ctx ${key(strict.ctxM)}`); if (false) issues.push(`event #${fd.i}: mine ${key(fd.mine)} game ${key(fd.game)} | game ctx ${key(fd.ctxG)} | mine ctx ${key(fd.ctxM)}`);
  if (issues.length) mism.push({ kind, id: L.id, d, ops: ops.join(' '), issues }); }
function powerOp(M, G, R, t, ops, issues) { const k = Math.floor(R() * 5); let a = 0; // v5 R4 fix: the Volley (k 4) on a colour, now and then one that can't be taken
  if (k === 1) { const col = M.G.cols[Math.floor(R() * 5)]; const p = Math.floor(R() * 4); a = col[p] ?? Math.floor(R() * M.C.cards.length); }
  if (k === 3) a = Math.floor(R() * (M.G.spaces.length + 1));
  if (k === 4) { const live = []; for (let m = 1; m <= 14; m++) if (m !== 10 && M.G.standing[m] > 0) live.push(m); a = R() < 0.8 && live.length ? live[Math.floor(R() * live.length)] : Math.floor(R() * 16); }
  const rm = M.power(k, a, t), rg = G.power(k, a, t); const tag = rg.r === 0 ? '' : rg.r === REFUSED ? 'R' : 'N'; ops.push(`P${k}:${a}${t !== undefined ? '@' + t : ''}${tag}`);
  (rg.r === 0 ? cov.ops.taken : rg.r === REFUSED ? cov.ops.refused : cov.ops.noplay)[k] = ((rg.r === 0 ? cov.ops.taken : rg.r === REFUSED ? cov.ops.refused : cov.ops.noplay)[k] || 0) + 1;
  if (rg.can !== rg.r) { cov.canPowerDisagree++; issues.push(`canPower(${k},${a}) = ${rg.can} but power() = ${rg.r}`); }
  if (rg.same !== null) { cov.refusedChecked++; if (!rg.same) { cov.refusedChanged++; issues.push(`refused power ${k}:${a} changed the engine state/hash/uses`); } }
  if (rm.r !== rg.r) { issues.push(`power ${k}:${a}: mine ${rm.r} game ${rg.r}`); return false; } return true; }
function patient(L, d, seed, kind, stored, withPowers) { const M = mine(L, d), G = engine(L, d), R = rng(seed), ops = [], issues = []; let guard = 0;
  while (M.status === PLAYING && G.status === PLAYING && guard++ < 220) {
    if (withPowers) { let k = 0; while (R() < 0.45 && k++ < 3) { if (!powerOp(M, G, R, undefined, ops, issues)) break; hiddenCheck(M, G, 'after ' + ops[ops.length - 1], issues); } if (issues.length) break; M.quiet(); G.quiet(); if (M.status !== PLAYING || G.status !== PLAYING) break; } // v5: a Quartermaster places a squad (it can fill the line), so patient play waits for rest after the powers too
    if (kind === 'stored') { const pk = parkCheck(L, d, M); if (pk.worst > (+arg('parkMax', 6)) || pk.n > 2 || (pk.n && pk.tower)) park.push(`${L.id} ${d} before tap ${ops.length + 1}: ${pk.n} squads waiting, biggest ${pk.worst}${pk.tower ? ', a tower stands' : ''}`); }
    const legal = [0, 1, 2, 3, 4].filter((c) => M.G.legal(c)); if (!legal.length) { issues.push('mine: no legal tap at rest while playing'); break; }
    const col = stored ? (ops.filter((o) => !o.startsWith('P')).length < stored.length ? stored[ops.filter((o) => !o.startsWith('P')).length] : -1) : legal[Math.floor(R() * legal.length)]; if (col < 0) break;
    const tTap = M.now; const rm = M.play(col), rg = G.play(col); ops.push(String(col)); if ((rm === REFUSED) !== (rg === REFUSED)) { issues.push(`tap ${col}: mine ${rm} game ${rg}`); break; } if (kind === 'stored' && rg === REFUSED) { issues.push(`stored tap ${ops.length} (col ${col}) is REFUSED on both sides`); break; }
    M.lastTap = tTap; M.quiet(); G.quiet(); if (kind === 'stored') M.longest = Math.max(M.longest || 0, M.now - tTap); hiddenCheck(M, G, 'after tap ' + ops.length, issues); if (issues.length) break; }
  finish(kind, L, d, M, G, ops, issues); return { M, G, ops }; }
function rushed(L, d, seed, kind, withPowers) { const R = rng(seed), M = mine(L, d), G = engine(L, d), ops = [], issues = []; let t = 0, guard = 0;
  while (M.status === PLAYING && G.status === PLAYING && guard++ < 320) { t += Math.floor(R() * 1500); M.advanceTo(t); G.advanceTo(t); if (M.status !== PLAYING || G.status !== PLAYING) break;
    if (withPowers && R() < 0.3) { if (!powerOp(M, G, R, t, ops, issues)) break; hiddenCheck(M, G, 'after ' + ops[ops.length - 1], issues); if (issues.length) break; continue; }
    const cols = [0, 1, 2, 3, 4].filter((c) => M.G.front(c) >= 0); if (!cols.length) break; const col = cols[Math.floor(R() * cols.length)];
    const rm = M.play(col, t), rg = G.play(col, t); ops.push(`${col}@${t}${rg === REFUSED ? 'R' : ''}`); if ((rm === REFUSED) !== (rg === REFUSED)) { issues.push(`tap ${col}@${t}: mine ${rm} game ${rg}`); break; } }
  if (!issues.length) { M.quiet(); G.quiet(); } finish(kind, L, d, M, G, ops, issues); }
for (const L of levels) for (const d of [L.tag || 'normal']) { const sd = L.w * 97 + L.h * 13 + d.length;
  if (L.win && L.win[d]) { const seq = L.win[d].split('').map(Number); const r = patient(L, d, 1, 'stored', seq, false);
    if (r.G.status !== WON) mism.push({ kind: 'stored', id: L.id, d, ops: L.win[d], issues: ['stored order does not win in the game: ' + r.G.status + '/' + r.G.reason] });
    const g = L.grade && L.grade[d]; if (g) { const bad = []; const end = r.M.G.settle(); if (r.M.status === WON) r.M.longest = Math.max(r.M.longest || 0, end - r.M.lastTap); if (g.len !== undefined && (g.len !== seq.length || g.len !== r.G.plays)) bad.push(`len ${g.len} vs taps ${seq.length} / plays ${r.G.plays}`); if (g.peak !== undefined && g.peak !== r.M.peak) bad.push(`peak ${g.peak} vs ${r.M.peak}`); if (g.ms !== undefined && g.ms !== end) bad.push(`ms ${g.ms} vs ${end}`); if (g.maxWait !== undefined) { cov.maxWait = cov.maxWait || { n: 0, diff: [] }; cov.maxWait.n++; if (g.maxWait !== r.M.longest) cov.maxWait.diff.push(`${L.id} ${d} ${g.maxWait}/${r.M.longest}`); } if (bad.length) gradeBad.push({ id: L.id, d, bad }); cov.gradeChecks = (cov.gradeChecks || 0) + 1; } }
  for (let k = 0; k < NP; k++) patient(L, d, sd + 1000 * k, 'patient', null, false);
  for (let k = 0; k < NR; k++) rushed(L, d, sd + 7 + 131 * k, 'rushed', false);
  for (let k = 0; k < NW; k++) (k % 2 ? rushed(L, d, sd + 31 + 977 * k, 'rushed+power', true) : patient(L, d, sd + 51 + 733 * k, 'patient+power', null, true));
}
const out = arg('out', path.join(here, 'diff-result.json')); fs.writeFileSync(out, JSON.stringify({ ms: Date.now() - t0, levels: levels.length, cov, gradeBad, fmt, park, tagBad, crossBuried, early, mism }, null, 1));
console.log('v5 R2 feature ladder (no feature before its milestone, locks on Hard from ' + cfg.v5.locks.from + '):', early.length, 'problems', JSON.stringify(early.slice(0, 6)));
console.log(`levels ${levels.length} (siege ${levels.filter((l) => l.set === 'siege').length}, debug ${levels.filter((l) => l.set === 'debug').length}, gallery ${levels.filter((l) => l.set === 'gallery').length}) x 3: games ${cov.games} ${JSON.stringify(cov.byKind)}; grade checks ${cov.gradeChecks || 0}, grade mismatches ${gradeBad.length}; MISMATCHING GAMES ${mism.length}; ${Date.now() - t0} ms`);
console.log('v5 R4 fix: mystery blocks and the Volley modelled: SHOW events', cov.shows, 'CLEAR events', cov.clears, '(compared event by event; each instant\'s SHOWs as a set)');
console.log('power ops (game side): taken', JSON.stringify(cov.ops.taken), 'refused', JSON.stringify(cov.ops.refused), 'noplay', JSON.stringify(cov.ops.noplay), '| refused checked byte-identical', cov.refusedChecked, 'changed', cov.refusedChanged, '| canPower!=power', cov.canPowerDisagree);
console.log('grade.maxWait vs my longest patient tap (tap to rest) on the stored line:', cov.maxWait ? `${cov.maxWait.n} checked, ${cov.maxWait.diff.length} differ ${JSON.stringify(cov.maxWait.diff.slice(0, 6))}` : 'none');
console.log('tags (formula from SPEC v4.3 + configs):', JSON.stringify(tagCount), 'problems', tagBad.length, JSON.stringify(tagBad.slice(0, 6)), '| cross-buried pairs at deal:', crossBuried.length, JSON.stringify(crossBuried.slice(0, 4)));
console.log('picture-format problems (levels):', fmt.length, JSON.stringify(fmt.slice(0, 5)));
console.log('park limits along stored orders (at rest: <= 2 squads waiting, none over parkMax 6, none while a tower stands):', park.length, 'rest states over;', JSON.stringify(park.slice(0, 8)));
console.log('my refusal reasons:', JSON.stringify(cov.why), '| power after the end: NOPLAY checks', cov.endNoplay, 'bad', cov.endNoplayBad);
console.log('outcomes', JSON.stringify(cov.outcomes), 'jamWhy', JSON.stringify(cov.jamWhy), 'killGames', cov.killGames, 'unlockGames', cov.unlockGames, 'hidden checks', cov.hiddenChecks);
for (const g of gradeBad.slice(0, 6)) console.log('GRADE', g.id, g.d, g.bad.join('; '));
const byKind = {}; for (const m of mism) byKind[m.kind] = (byKind[m.kind] || 0) + 1; console.log('mismatches by kind', JSON.stringify(byKind));
for (const m of mism.slice(0, +arg('show', 8))) console.log(`MISMATCH ${m.kind} ${m.id} ${m.d} ops[${m.ops.slice(0, 300)}]\n   ${m.issues.slice(0, 3).join('\n   ').slice(0, 900)}`);
