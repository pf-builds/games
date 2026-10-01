// Critic v4-2 edge cases on hand-made boards, both sides: the Quartermaster's at-rest jam test (refused) against the same
// pull mid-show (taken), Recall of a wary squad then its re-tap, Ladder with the lock shut, Scout after a Quartermaster.
import { createRequire } from 'module'; import path from 'path'; import { fileURLToPath } from 'url'; import { compile, Game } from './rules.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), require = createRequire(import.meta.url);
const E = require(path.join(root, 'src/engine.js')), cfg = require(path.join(root, 'config.json')); const NAME = {}; for (const k in E.EV) NAME[E.EV[k]] = k;
const mk = (grid, cols, extra = {}) => Object.assign({ w: grid[0].length, h: grid.length, grid, gates: [], towers: [], cols }, extra);
function run(L, d, ops) { const C = E.compile(L), S = E.sim(C, E.rulesOf(cfg.v3, d, cfg.meta)); S.logOn = true; const r = cfg.v3.rules[d];
  const G = new Game(compile(L), { hold: r.hold, archersKill: r.archersKill, lockSpaces: 1, powers: cfg.meta.powers.map((p) => p.perLevel), pullDepth: cfg.meta.pullDepth }, cfg.v3.time);
  const out = []; const ge = []; const drain = () => { for (let i = 0; i + 2 < S.evLen; i += 3) if (['EAT', 'FREE', 'REVEAL', 'POWER', 'UNLOCK', 'KILL', 'HIT'].includes(NAME[S.ev[i]])) ge.push(`${S.now}:${NAME[S.ev[i]]}:${S.ev[i + 1]}`); S.clearLog(); };
  for (const op of ops) { let a, b;
    if (op[0] === 'tap') { a = S.play(op[1], S.now); b = G.play(op[1]); }
    if (op[0] === 'pow') { a = S.power(op[1], op[2], S.now); b = G.power(op[1], op[2]); }
    if (op[0] === 'rest') { while (S.busy && S.status === 0) { S.advanceTo(S.nextAt); drain(); } G.quiet(); a = b = ''; }
    if (op[0] === 'adv') { while (S.busy && S.nextAt <= op[1] && S.status === 0) { S.advanceTo(S.nextAt); drain(); } if (S.status === 0) S.advanceTo(op[1]); G.advanceTo(op[1]); a = b = ''; }
    drain(); out.push(`${op.join(':')}=g${a}/m${b}${op[0] === 'pow' && b ? '(' + G.why + ')' : ''}`); }
  const me = G.log.filter((e) => ['EAT', 'FREE', 'REVEAL', 'POWER', 'UNLOCK', 'KILL', 'HIT'].includes(e.e)).map((e) => `${e.t}:${e.e}:${e.c ?? e.sp ?? e.id ?? e.k ?? e.m ?? ''}`);
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
let bad = 0; for (const [name, [L, d, ops]] of Object.entries(cases)) { let r; try { r = run(L, d, ops); } catch (e) { console.log(name, 'ERROR', e.message); bad++; continue; } if (!r.same) bad++; console.log(`${r.same ? 'SAME' : 'DIFF'} ${name} [${d}] ${r.ops}\n     game ${r.game} | mine ${r.mine}${r.same ? '' : '\n     g ' + r.ge + '\n     m ' + r.me}`); }
console.log('edge cases differing:', bad);
