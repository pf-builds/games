// Critic v5 (v5 R1 rules: 5 spaces, no kills; from critic v4.3). Critic v4.3 known-answer boards: expected events worked out by hand from the SPEC text (reasoning beside each board), checked
// against BOTH the game's engine (black box) and the critic's rules. Timing: pop = dispatch + 200 + tiles*80 + 100; carrier home
// = pop + 200 + tiles*90; hit = dispatch + 200 + ceil(tiles/2)*80; hit sapper back = hit + 300 + 200 + ceil(tiles/2)*80.
import { createRequire } from 'module'; import path from 'path'; import { fileURLToPath } from 'url'; import { compile, Game } from './rules.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), require = createRequire(import.meta.url);
const E = require(path.join(root, 'src/engine.js')), cfg = require(path.join(root, 'config.json')); const NAME = {}; for (const k in E.EV) NAME[E.EV[k]] = k;
const P = (grid, cols, extra = {}) => Object.assign({ pic: true, w: grid[0].length, h: grid.length, grid, gates: [], towers: [], cols }, extra);
const KEEP = ['EAT', 'FREE', 'KILL', 'TOWER', 'GATE', 'UNLOCK'];
function run(L, tag, ops) { const C = E.compile(L), S = E.sim(C, E.rulesOf(cfg.v3, tag, cfg.meta)); S.logOn = true; const r = cfg.v3.rules;
  const G = new Game(compile(L), { hold: r.hold, archersKill: false, lockSpaces: 1, powers: cfg.meta.powers.map((p) => p.perLevel), pullDepth: cfg.meta.pullDepth }, cfg.v3.time);
  const ge = [], ret = []; const drain = () => { for (let i = 0; i + 2 < S.evLen; i += 3) { const n = NAME[S.ev[i]]; if (KEEP.includes(n)) ge.push(`${S.now}:${n}${n === 'EAT' || n === 'FREE' ? ':' + S.ev[i + 1] : ''}`); } S.clearLog(); };
  const step = (t) => { while (S.busy && S.status === 0 && S.nextAt <= t) { S.advanceTo(S.nextAt); drain(); } if (S.status === 0) { S.advanceTo(t); drain(); } G.advanceTo(t); };
  for (const op of ops) { if (op[0] === 'at') { step(op[1]); continue; } if (op[0] === 'rest') { while (S.busy && S.status === 0) { S.advanceTo(S.nextAt); drain(); } G.quiet(); continue; }
    let a, b; if (op[0] === 'tap') { a = S.play(op[1], S.now); b = G.play(op[1]); } else { a = S.power(op[1], op[2], S.now); b = G.power(op[1], op[2]); } drain();
    ret.push(`${op.join('')}:${a === E.REFUSED ? 'R' : a}/${b === -3 ? 'R' : b}`); }
  const me = G.log.filter((e) => KEEP.includes(e.e)).map((e) => `${e.t}:${e.e}${e.e === 'EAT' ? ':' + e.c : e.e === 'FREE' ? ':' + e.sp : ''}`);
  return { ge, me, ret, game: { status: S.status, reason: S.reason || '', jamWhy: S.jamWhy, now: S.now, why: [0, 1, 2, 3, 4].map((j) => S.why(j)) }, mine: { status: G.status, reason: G.reason, jamWhy: G.jamWhy, now: G.now, why: [0, 1, 2, 3, 4].map((j) => G.whyCol(j)) } }; }
const cell = (w, x, y) => y * w + x;
const boards = [
  // K4: 7x4, a at (2,2),(3,2),(4,2), each beside the entry (d0, tiles 1); a b block walled off so the level goes on. Squad of 3 at
  // 0, 30, 60 -> pops 380, 410, 440; carriers home 670, 700, 730. v4.3: the space frees at the LAST POP, 440 (v4.2: at 730).
  { name: 'K4 frees at its last pop', tag: 'normal', L: P([',,,,,,,', ',b~....,'.slice(0, 7), ',.aaa.,', ',,###,,'].map((r, i) => (i === 1 ? ',b~...,' : r)), [[[1, 3]], [[2, 1]], [], [], []]),
    ops: [['tap', 0], ['rest']], expect: { ev: ['380:EAT:16', '410:EAT:17', '440:EAT:18', '440:FREE:0'], status: 0, now: 730 } },
  // K4b (v5: 5 spaces on every tag): b, c, d, e sit beyond a moat with no bridge (they wait for ever), the a squad of 3 pops at
  // 380, 410, 440. With the line full (5 squads), a tap at 439 is refused; at 440 (the last pop frees space 4) it is taken.
  { name: 'K4b the freed space takes the next tap at once (5 spaces, Hard)', tag: 'hard', L: P([',,,,,,,', ',bcdef,', '~~~~~~~', ',eaaa.,'.replace('e', 'g'), ',,###,,'], [[[2, 1], [7, 1]], [[3, 1]], [[4, 1]], [[5, 1]], [[1, 3], [6, 1]]]),
    ops: [['tap', 0], ['tap', 1], ['tap', 2], ['tap', 3], ['tap', 4], ['at', 439], ['tap', 0], ['at', 440], ['tap', 0]], expect: { ret: ['tap0:0/0', 'tap1:0/0', 'tap2:0/0', 'tap3:0/0', 'tap4:0/0', 'tap0:R/R', 'tap0:0/0'] } },
  // K1-K3 (v4.1's bottom-entry answers) with v4.3's FREE: a squad's space frees at its last pop.
  { name: 'K1 SPEC example 7x5 (v4.1), frees at the last pop', tag: 'normal', L: P([',,,,,,,', ',aaaaa,', ',abbba,', ',aaaaa,', ',,###,,'], [[[1, 12]], [[2, 3]], [], [], []]),
    ops: [['tap', 0], ['rest']], expect: { ev: ['380:EAT:23', '410:EAT:24', '440:EAT:25', '550:EAT:22', '580:EAT:26', '850:EAT:15', '880:EAT:19', '990:EAT:8', '1020:EAT:12', '1290:EAT:9', '1320:EAT:11', '1430:EAT:10', '1430:FREE:0'] } },
  { name: 'K2 ties 6x5 even entry (v4.1)', tag: 'normal', L: P([',,,,,,', ',aaaa,', ',aaaa,', ',a..a,', ',,##,,'], [[[1, 10]], [], [], [], []]),
    ops: [['tap', 0], ['rest']], expect: { ev: ['460:EAT:19', '490:EAT:22', '520:EAT:14', '550:EAT:15', '820:EAT:13', '850:EAT:16', '960:EAT:7', '990:EAT:10', '1260:EAT:8', '1290:EAT:9', '1290:FREE:0'] } },
  { name: 'K3 moat + drawbridge 7x7 (v4.1): the key squad frees at the key pop', tag: 'normal', L: P([',,,,,,,', ',bbbbb,', ',,,,,,,', '~~~j~~~', ',aa.an,', ',aa.aa,', ',,###,,'], [[[2, 5]], [[1, 7]], [[14, 1]], [], []], { gates: [{ at: [3, 3], key: [5, 4] }] }),
    ops: [['tap', 0], ['tap', 2], ['rest']], expect: { ev: ['700:EAT:33', '700:GATE', '700:FREE:1', '1400:EAT:10', '1510:EAT:9', '1540:EAT:11', '1650:EAT:8', '1680:EAT:12', '1680:FREE:0'] } },
  // K5 (Normal): tower f at (5,1), r 1 covers a's (4,1). a squad of 3: (2,2) d1 at 0 -> pop 460; (3,2) d1 at 30 -> 490; (4,1) d2 at 60
  // is covered: hit at 60+200+160 = 420, back at 420+300+200+160 = 1080 (waits: the squad is wary, (4,1) covered) -> no FREE.
  // Tap f (1) at rest 1080: (5,1) d3 tiles 4 -> pop 1700, the tower falls, f's space 1 frees at 1700; a's waiting sapper goes at
  // 1700 -> (4,1) d2 tiles 3 -> pop 2240, space 0 frees at 2240 (and the level is won).
  { name: 'K5 archer hit: the hit sapper holds the space until its block pops', tag: 'normal', L: P([',,,,,,,', ',...af,', ',.aa..,', ',.....,', ',,###,,'], [[[1, 3]], [[6, 1]], [], [], []], { towers: [{ at: [5, 1], r: 1 }] }),
    ops: [['tap', 0], ['rest'], ['tap', 1], ['rest']], expect: { ev: ['460:EAT:16', '490:EAT:17', '1700:EAT:12', '1700:TOWER', '1700:FREE:1', '2240:EAT:11', '2240:FREE:0'], status: 1 } },
  // K6 (v5, Hard): the same tower; a squad of 1 whose only block (4,1) is covered: sent at 0, hit at 360 and knocked back (no
  // kill on any tag), back at 360 + 300 + 200 + 160 = 1020, then it waits (wary, its block covered): no KILL, no FREE, still playing
  // (the f card is legal).
  { name: 'K6 v5 Hard: an arrow knocks back, never kills', tag: 'hard', L: P([',,,,,,,', ',...af,', ',.....,', ',.....,', ',,###,,'], [[[1, 1]], [[6, 1]], [], [], []], { towers: [{ at: [5, 1], r: 1 }] }),
    ops: [['tap', 0], ['rest']], expect: { ev: [], status: 0, now: 1020 } },
  // K7: A (a1, col 0) linked to P (a1, col 1 behind B b1). Tap col 0 -> refused (why 3), nothing changes; tap col 1 takes B;
  // then P is col 1's front and the pair goes on a tap of col 0. Pops: a at (2,2) d0 and (3,2) d0; b at (4,2) d0.
  { name: 'K7 buried partner refused, then the pair goes', tag: 'normal', L: P([',,,,,,,', ',.....,', ',.aab.,', ',,###,,'], [[[1, 1]], [[2, 1], [1, 1]], [], [], []], { links: [[[0, 0], [1, 1]]] }),
    ops: [['tap', 0], ['tap', 1], ['tap', 0], ['rest']], expect: { ret: ['tap0:R/R', 'tap1:0/0', 'tap0:0/0'], status: 1 } },
  // K8: cross-buried pairs: F0 (col 0 front) linked to G1 (col 1, behind F1); F1 linked to G0 (col 0, behind F0). After the
  // unlinked e card in col 2 is spent, every front waits for a buried partner: jam, jamWhy 1 (free spaces) | 4 = 5.
  { name: 'K8 cross-buried linked deadlock -> jam 5', tag: 'normal', L: P([',,,,,,,', ',.....,', ',abcde,', ',,###,,'], [[[1, 1], [4, 1]], [[3, 1], [2, 1]], [[5, 1]], [], []], { links: [[[0, 0], [1, 1]], [[1, 0], [0, 1]]] }),
    ops: [['tap', 0], ['tap', 1], ['tap', 2], ['rest']], expect: { ret: ['tap0:R/R', 'tap1:R/R', 'tap2:0/0'], status: -1, reason: 'jam', jamWhy: 5 } },
  // K9 (v5): F0 (col 0) linked to F1 (col 1 front); Z (col 1, behind F1) linked to W (col 0, behind F0). The Quartermaster
  // on Z: Z and its partner W are both in view (depth 1) and 5 spaces are free, so both go straight out (no jam test any more);
  // then F0 and F1 are fronts and the pair goes on a tap of col 0; a second pull of Z is refused (Z is no longer in a column).
  { name: 'K9 v5 Quartermaster pulls a linked card with its partner in view', tag: 'normal', L: P([',,,,,,,', ',.....,', ',abcd.,', ',,###,,'], [[[1, 1], [3, 1]], [[2, 1], [4, 1]], [], [], []], { links: [[[0, 0], [1, 0]], [[1, 1], [0, 1]]] }),
    ops: [['pow', 1, 3], ['tap', 0], ['pow', 1, 3], ['rest']], expect: { ret: ['pow13:0/0', 'tap0:0/0', 'pow13:R/R'], status: 1 } },
  // K10 (v5 colour lock, a = 1): b-f wait beyond a moat for ever; four taps fill the 4 open spaces, the 5th is shut until a
  // squad of a goes out, and a's card can't go (no open free space): every front refused at rest -> jam, jamWhy 2 (locked).
  { name: 'K10 colour lock stays shut without its colour: jam 2', tag: 'hard', L: P([',,,,,,,', ',bcdef,', '~~~~~~~', ',..a..,', ',,###,,'], [[[2, 1]], [[3, 1]], [[4, 1]], [[5, 1]], [[1, 1], [6, 1]]], { lock: { colour: 1 } }),
    ops: [['tap', 0], ['tap', 1], ['tap', 2], ['tap', 3], ['rest']], expect: { status: -1, reason: 'jam', jamWhy: 2 } },
  // K11: the same board, a tapped first: its squad takes space 0 and the lock opens at 0 (UNLOCK, after the tap); a at (3,3) is
  // beside the entry (d0, tiles 1): pop 380, space 0 frees at 380.
  { name: 'K11 colour lock opens on its colour\'s tap', tag: 'hard', L: P([',,,,,,,', ',bcdef,', '~~~~~~~', ',..a..,', ',,###,,'], [[[2, 1]], [[3, 1]], [[4, 1]], [[5, 1]], [[1, 1], [6, 1]]], { lock: { colour: 1 } }),
    ops: [['tap', 4], ['rest']], expect: { ev: ['0:UNLOCK', '380:EAT:24', '380:FREE:0'], status: 0 } },
  // K12 (v5 Quartermaster): b, behind a in column 0, goes straight out into space 0 at time 0 (not a play); b at (3,2) d0: pop
  // 380, space 0 frees at 380; a stays its column's front.
  { name: 'K12 Quartermaster sends a card in view straight out', tag: 'normal', L: P([',,,,,,,', ',.....,', ',.ab..,', ',,###,,'], [[[1, 1], [2, 1]], [], [], [], []]),
    ops: [['pow', 1, 1], ['rest']], expect: { ret: ['pow11:0/0'], ev: ['380:EAT:17', '380:FREE:0'], status: 0 } },
];
let bad = 0;
for (const B of boards) { let r; try { r = run(B.L, B.tag, B.ops); } catch (e) { bad++; console.log('ERROR', B.name, e.message); continue; } const x = B.expect, fails = [];
  for (const [side, ev, st] of [['game', r.ge, r.game], ['mine', r.me, r.mine]]) {
    if (x.ev && JSON.stringify(ev) !== JSON.stringify(x.ev)) fails.push(`${side} events ${JSON.stringify(ev)}`);
    if (x.status !== undefined && st.status !== x.status) fails.push(`${side} status ${st.status}`); if (x.reason !== undefined && st.reason !== x.reason) fails.push(`${side} reason ${st.reason}`);
    if (x.jamWhy !== undefined && st.jamWhy !== x.jamWhy) fails.push(`${side} jamWhy ${st.jamWhy}`); if (x.now !== undefined && st.now !== x.now) fails.push(`${side} rest at ${st.now}`); }
  if (x.ret && JSON.stringify(r.ret.slice(0, x.ret.length)) !== JSON.stringify(x.ret)) fails.push(`returns ${JSON.stringify(r.ret)}`);
  if (fails.length) bad++; console.log(`${fails.length ? 'WRONG' : 'KNOWN'} ${B.name} [${B.tag}]${fails.length ? '\n   ' + fails.join('\n   ') : ''} | ops ${r.ret.join(' ')} | why game ${r.game.why} mine ${r.mine.why}`); }
console.log('known-answer boards wrong:', bad);
