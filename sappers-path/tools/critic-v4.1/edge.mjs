// Critic v4-2 edge cases on hand-made boards, both sides: the Quartermaster's at-rest jam test (refused) against the same
// pull mid-show (taken), Recall of a wary squad then its re-tap, Ladder with the lock shut, Scout after a Quartermaster.
import { createRequire } from 'module'; import path from 'path'; import { fileURLToPath } from 'url'; import { compile, Game } from './rules.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), require = createRequire(import.meta.url);
const E = require(path.join(root, 'src/engine.js')), cfg = require(path.join(root, 'config.json')); const NAME = {}; for (const k in E.EV) NAME[E.EV[k]] = k;
const mk = (grid, cols, extra = {}) => Object.assign({ w: grid[0].length, h: grid.length, grid, gates: [], towers: [], cols }, extra);
function run(L, d, ops) { const C = E.compile(L), S = E.sim(C, E.rulesOf(cfg.v3, d, cfg.meta)); S.logOn = true; const r = cfg.v3.rules[d];
  const G = new Game(compile(L), { hold: r.hold, archersKill: r.archersKill, lockSpaces: 1, powers: cfg.meta.powers.map((p) => p.perLevel), pullDepth: cfg.meta.pullDepth }, cfg.v3.time);
  const out = []; const ge = []; const drain = () => { for (let i = 0; i + 2 < S.evLen; i += 3) if (['EAT', 'FREE', 'REVEAL', 'POWER', 'UNLOCK', 'KILL', 'HIT'].includes(NAME[S.ev[i]])) ge.push(`${S.now}:${NAME[S.ev[i]]}:${['HIT', 'KILL'].includes(NAME[S.ev[i]]) ? '' : S.ev[i + 1]}`); S.clearLog(); };
  for (const op of ops) { let a, b;
    if (op[0] === 'tap') { a = S.play(op[1], S.now); b = G.play(op[1]); }
    if (op[0] === 'pow') { a = S.power(op[1], op[2], S.now); b = G.power(op[1], op[2]); }
    if (op[0] === 'rest') { while (S.busy && S.status === 0) { S.advanceTo(S.nextAt); drain(); } G.quiet(); a = b = ''; }
    if (op[0] === 'adv') { while (S.busy && S.nextAt <= op[1] && S.status === 0) { S.advanceTo(S.nextAt); drain(); } if (S.status === 0) S.advanceTo(op[1]); G.advanceTo(op[1]); a = b = ''; }
    drain(); out.push(`${op.join(':')}=g${a}/m${b}${op[0] === 'pow' && b ? '(' + G.why + ')' : ''}`); }
  const me = G.log.filter((e) => ['EAT', 'FREE', 'REVEAL', 'POWER', 'UNLOCK', 'KILL', 'HIT'].includes(e.e)).map((e) => `${e.t}:${e.e}:${['HIT', 'KILL'].includes(e.e) ? '' : e.c ?? e.sp ?? e.id ?? e.k ?? e.m ?? ''}`);
  const same = JSON.stringify([...ge].sort()) === JSON.stringify([...me].sort()) && S.status === G.status && (S.reason || '') === G.reason;
  return { same, ops: out.join(' '), game: `${S.status}/${S.reason} open ${S.open} cap ${S.cap}`, mine: `${G.status}/${G.reason} open ${G.open()} hold ${G.hold}`, ge: ge.join(' ').slice(0, 300), me: me.join(' ').slice(0, 300) }; }
const qmGrid = ['~~~~~~~~~', '~bcde~aaa', '~~~~~~...', '.........', '...###...'];
const qmCols = [[[2, 1], [1, 1]], [[3, 1]], [[4, 1]], [[5, 1]], [[1, 1], [1, 1]]], links = [[[0, 1], [4, 1]]];
const far = ['~~~~~~~~~~~~~', '~bcd~aaa....e', '~~~~~.........', '.............', '.....###.....'].map((r) => r.padEnd(13, '.').slice(0, 13));
const cases = {
  'QM jam test at rest (refused)': [mk(qmGrid, qmCols, { links }), 'normal', [['tap', 0], ['tap', 1], ['tap', 2], ['tap', 3], ['rest'], ['pow', 1, 6], ['tap', 4], ['rest']]],
  'QM same pull mid-show (taken)': [mk(far, [[[2, 1], [1, 1]], [[3, 1]], [[4, 1]], [[5, 1]], [[1, 1], [1, 1]]], { links }), 'normal', [['tap', 0], ['tap', 1], ['tap', 2], ['tap', 3], ['pow', 1, 6], ['rest'], ['tap', 0], ['rest']]],
  'Recall a wary squad, re-tap': [mk(['.......', '.aaaaa.', '.aaaaa.', '.......', '..###..'], [[[1, 10]], [], [], [], []], { towers: [] }), 'normal', [['tap', 0], ['adv', 400], ['pow', 3, 0], ['rest'], ['pow', 3, 0], ['tap', 0], ['rest']]],
  'Ladder with the lock shut': [mk(['~~~~~~~', '~bcn~a.', '~~~~~..', '.......', '..###..'], [[[2, 1]], [[3, 1]], [[1, 1]], [[14, 1]], []], { lock: { key: [3, 1] } }), 'hard', [['tap', 0], ['tap', 1], ['pow', 0, 0], ['tap', 2], ['rest'], ['pow', 0, 0]]],
  'Scout after QM reveal': [mk(['.......', '.aabbc.', '.......', '..###..'], [[[1, 1], [2, 1, 1], [3, 1, 1]], [[1, 1]], [[2, 1]], [], []]), 'normal', [['pow', 1, 2], ['pow', 2, 0], ['pow', 1, 1], ['pow', 2, 0], ['tap', 0], ['rest']]],
};
// a tower so the Recall case has a wary squad: put one covered pixel
cases['Recall a wary squad, re-tap'] = [mk(['.......', '.aaaaf.', '.aaaaa.', '.......', '..###..'], [[[1, 9]], [[6, 1]], [], [], []], { towers: [{ at: [5, 1], r: 1.5 }] }), 'normal', [['tap', 0], ['rest'], ['pow', 3, 0], ['tap', 1], ['rest'], ['tap', 0], ['rest']]];
// ---- v4.1 bottom-entry boards with known answers (expected pops worked out by hand in the comments) ----
// K1, SPEC-v4 v4.1's own example: 7 x 5, picture aaaaa/abbba/aaaaa, entry x 2..4 on row 4. All 12 claims happen before the
//   first pop (dispatch every 30 ms, first pop at 0+200+80+100 = 380), so pops follow claim order.
// K2, ties: 6 x 5 (even width: entry x 2,3), picture aaaa/aaaa/a..a (grass at (2,3),(3,3) joined to the camp, distance 1).
//   d1: (1,3),(4,3) [|y-4| = 1] before (2,2),(3,2) [|y-4| = 2] although (2,2) has the lower x; then d4 (1,2),(4,2); d5
//   (1,1),(4,1); d8 (2,1),(3,1). Pop times: disp i*30 + 200 + tiles*80 + 100.
// K3, moat and drawbridge: 7 x 7, b's on the far side of a water band (row 3, frame columns too), iron bridge at (3,3), its
//   gilt key at (5,4) on the near side (distance 4 round the frame). Tap b (waits: nothing reachable), tap the key's Looters:
//   key pops at 0+200+5*80+100 = 700, the bridge opens, b goes at once: (3,1) d4 at 700 -> 1400, (2,1) d5 at 730 -> 1510,
//   (4,1) at 760 -> 1540, (1,1) d6 at 790 -> 1650, (5,1) at 820 -> 1680.
const P = (grid, cols, extra = {}) => Object.assign({ pic: true }, mk(grid, cols, extra));
const known = {
  'K1 SPEC example (7x5)': [P([',,,,,,,', ',aaaaa,', ',abbba,', ',aaaaa,', ',,###,,'], [[[1, 12]], [[2, 3]], [], [], []]), [0], [[380, 3, 2], [410, 3, 3], [440, 3, 4], [550, 3, 1], [580, 3, 5], [850, 2, 1], [880, 2, 5], [990, 1, 1], [1020, 1, 5], [1290, 1, 2], [1320, 1, 4], [1430, 1, 3]]],
  'K2 ties (6x5, even entry)': [P([',,,,,,', ',aaaa,', ',aaaa,', ',a..a,', ',,##,,'], [[[1, 10]], [], [], [], []]), [0], [[460, 3, 1], [490, 3, 4], [520, 2, 2], [550, 2, 3], [820, 2, 1], [850, 2, 4], [960, 1, 1], [990, 1, 4], [1260, 1, 2], [1290, 1, 3]]],
  'K3 moat + drawbridge (7x7)': [P([',,,,,,,', ',bbbbb,', ',,,,,,,', '~~~j~~~', ',aa.an,', ',aa.aa,', ',,###,,'], [[[2, 5]], [[1, 7]], [[14, 1]], [], []], { gates: [{ at: [3, 3], key: [5, 4] }] }), [0, 2], [[700, 4, 5], [1400, 1, 3], [1510, 1, 2], [1540, 1, 4], [1650, 1, 1], [1680, 1, 5]]],
};
let bad = 0; for (const [name, [L, taps, expect]] of Object.entries(known)) { const C = E.compile(L), S = E.sim(C, E.rulesOf(cfg.v3, 'normal', cfg.meta)); S.logOn = true; const r = cfg.v3.rules.normal;
  const G = new Game(compile(L), { hold: r.hold, archersKill: r.archersKill, lockSpaces: 1 }, cfg.v3.time); const gp = [];
  for (const c of taps) { S.play(c, S.now); G.play(c); while (S.busy && S.status === 0) { S.advanceTo(S.nextAt); for (let i = 0; i + 2 < S.evLen; i += 3) if (NAME[S.ev[i]] === 'EAT') gp.push([S.now, S.ev[i + 1]]); S.clearLog(); } G.quiet(); }
  const exp = expect.map(([t, y, x]) => [t, y * L.w + x]), mp = G.log.filter((e) => e.e === 'EAT').map((e) => [e.t, e.c]);
  const okG = JSON.stringify(gp) === JSON.stringify(exp), okM = JSON.stringify(mp) === JSON.stringify(exp); if (!okG || !okM) bad++;
  const gateNote = name.startsWith('K3') ? ` | before the key: game pops ${gp.filter((p) => p[0] < 700).length}, b at rest waiting in the line` : '';
  console.log(`${okG && okM ? 'KNOWN' : 'WRONG'} ${name}: game ${okG ? 'matches' : 'differs ' + JSON.stringify(gp)} | mine ${okM ? 'matches' : 'differs ' + JSON.stringify(mp)} | expected ${JSON.stringify(exp)}${gateNote}`); }
for (const [name, [L, d, ops]] of Object.entries(cases)) { let r; try { r = run(L, d, ops); } catch (e) { console.log(name, 'ERROR', e.message); bad++; continue; } if (!r.same) bad++; console.log(`${r.same ? 'SAME' : 'DIFF'} ${name} [${d}] ${r.ops}\n     game ${r.game} | mine ${r.mine}${r.same ? '' : '\n     g ' + r.ge + '\n     m ' + r.me}`); }
console.log('edge cases differing or wrong:', bad);
