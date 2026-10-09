// Critic v4-1 edge cases: hand-made boards run through both sides (stuck, jamWhy 3, linked reveal on pull, after-fail status),
// plus: engine quiet() vs event-stepped advanceTo give the same final state on every stored order.
import { createRequire } from 'module'; import path from 'path'; import { fileURLToPath } from 'url'; import { compile, Game } from './rules.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), require = createRequire(import.meta.url);
const E = require(path.join(root, 'src/engine.js')), cfg = require(path.join(root, 'config.json'));
const all = [...require(path.join(root, 'tools/build-data/levels/levels.json')).levels, ...require(path.join(root, 'levels/debug-v4.json')).levels];
let bad = 0, hiddenTrue = 0;
for (const L of all) for (const d of ['easy', 'normal', 'hard']) { const C = E.compile(L), A = E.sim(C, E.rulesOf(cfg.v3, d)), B = E.sim(C, E.rulesOf(cfg.v3, d));
  for (const ch of L.win[d]) { A.play(+ch, A.now); A.quiet(); B.play(+ch, B.now); let g = 0; while (B.busy && g++ < 1e6) B.advanceTo(B.nextAt); for (let i = 0; i < C.ncards; i++) if (A.hidden(i)) hiddenTrue++; }
  if (A.hash() !== B.hash() || A.status !== B.status || A.now !== B.now) { bad++; console.log('quiet vs stepped differ', L.id, d); } }
console.log('quiet vs stepped: differing', bad, '| hidden()=true observations on stored lines', hiddenTrue);
const mk = (grid, cols, extra = {}) => Object.assign({ w: grid[0].length, h: grid.length, grid, gates: [], towers: [], cols }, extra);
const cases = {
  // b pixels walled off by water: tapping b waits forever; tray then empty -> stuck
  stuck: [mk(['~~~~~~', '~bb~a.', '~~~~a.', '......', '..##..'], [[[1, 2]], [[2, 2]], [], [], []]), [0, 1]],
  // lock + a linked pair left, 1 space free after 2 walled squads on Hard (4 = 3 open + 1 locked): jamWhy 3
  jam3: [mk(['~~~~~~~', '~bbc~a.', '~~~~~a.', '.......', '..###..'], [[[2, 1], [1, 1]], [[3, 1]], [[1, 1]], [[14, 0]], []], { links: [[[1, 0], [2, 0]]], lock: { key: [0, 0] } }), [0, 0]],
  // partner hidden behind the front of its column is revealed as it leaves
  pull: [mk(['......', '.aabb.', '......', '..##..'], [[[1, 1]], [[2, 1], [2, 1, 1]], [[1, 1]], [], []], { links: [[[0, 0], [1, 1]]] }), [0, 1, 2]],
};
// fix jam3 grid: key must be gilt n; put it walled off too
cases.jam3[0] = mk(['~~~~~~~~', '~bbcn~aa', '~~~~~~..', '........', '..###...'], [[[2, 2]], [[3, 1]], [[1, 1]], [[1, 1]], []], { links: [[[2, 0], [3, 0]]], lock: { key: [4, 1] } });
cases.jam3[1] = [0, 1];
for (const [name, [L, taps]] of Object.entries(cases)) for (const d of ['normal', 'hard']) {
  let C; try { C = E.compile(L); } catch (e) { console.log(name, 'engine compile error', e.message); continue; }
  const S = E.sim(C, E.rulesOf(cfg.v3, d)), r = cfg.v3.rules[d], G = new Game(compile(L), { hold: r.hold, archersKill: r.archersKill, lockSpaces: 1 }, cfg.v3.time);
  const trace = []; for (const c of taps) { if (S.status !== 0 || G.status !== 0) break; const a = S.play(c, S.now), b = G.play(c); S.quiet(); G.quiet(); trace.push(`tap${c}:game ${a}/mine ${b}`); }
  const hid = []; for (let i = 0; i < C.ncards; i++) hid.push(+!!S.hidden(i) + '' + +G.hidden(i));
  console.log(name, d, trace.join(' '), '| game', S.status, S.reason, 'jamWhy', S.jamWhy, 'open', S.open, 'locked', S.locked, '| mine', G.status, G.reason, 'jamWhy', G.jamWhy, '| hidden g/m', hid.join(' '));
}
// after a short fail: does the engine keep popping, and can the status change after the deciding moment?
{ const L = all.find((l) => l.id === 'e3-62'); const C = E.compile(L), S = E.sim(C, E.rulesOf(cfg.v3, 'hard')); S.logOn = false;
  for (const [c, t] of [[4, 415], [2, 1485], [0, 2029], [4, 2932], [2, 4316], [2, 4972], [3, 5248], [1, 6719], [3, 7902], [3, 9005], [2, 9138], [3, 10300], [2, 10808]]) { if (S.status) break; S.advanceTo(t); S.play(c, t); }
  S.advanceTo(10240); const p0 = S.pixLeft, st0 = S.status, r0 = S.reason; S.quiet(); console.log('after short at', S.now, ': status', st0, r0, 'pixLeft', p0, '-> after quiet() status', S.status, S.reason, 'pixLeft', S.pixLeft, 'busy', S.busy); }
