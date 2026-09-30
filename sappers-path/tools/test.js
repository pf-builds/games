// Sapper's Path v3 node checks: the rules engine (SPEC-v3 §2-4, §9; the dispatch model from playtest 1) on hand-made
// boards with known answers, then a differential run of the engine against the slow reference (tools/ref.js) on every
// baked level, patient and rushed, and the stored winning orders on every difficulty, played patiently; v4 M2's twists
// (mystery cards, linked squads, the locked space, the generalized jam, dealing mode) on hand-made boards, a no-hang
// sweep and a second differential on the debug levels and on baked levels with random twists injected, the grader's
// info model and the fast tapper; last, the page save's settings (v4 M1: speed and colour-blind marks) through sanitize.
// Run: ~/.local/opt/node/bin/node tools/test.js   (exit code 1 on any failure)
"use strict";
const E = require("../src/engine.js");
const Ref = require("./ref.js");
const Gr = require("./grade.js");
const V3 = require("../config.json").v3;
const LEVELS = require("../levels/levels.json");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log("FAIL  " + name); } }
function eq(a, b, name) { const A = JSON.stringify(a), B = JSON.stringify(b); ok(A === B, name + (A === B ? "" : "\n      got " + A + "\n     want " + B)); }
function throws(fn, name) { let t = false; try { fn(); } catch (e) { t = true; } ok(t, name); }
const RULES = { easy: E.rulesOf(V3, "easy"), normal: E.rulesOf(V3, "normal"), hard: E.rulesOf(V3, "hard") };
const N = RULES.normal, EZ = RULES.easy, H = RULES.hard, TM = E.timeOf(V3.time);
const hold = (k, kill) => Object.assign({}, N, { hold: k, archersKill: !!kill });
const lv = (grid, cols, extra) => Object.assign({ w: grid[0].length, h: grid.length, grid, cols: cols || [[], [], [], [], []] }, extra || {});
const xy = (B, c) => [c % B.w, (c / B.w) | 0];
// Tap patiently (run until nothing moves) and return the cells popped, in the order they popped.
function eats(S, col) { S.logOn = true; S.clearLog(); S.play(col); S.quiet(); const out = []; for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === E.EV.EAT) out.push(xy(S.B, S.ev[i + 1])); return out; }
const pat = (S, col) => { S.play(col); S.quiet(); return S.status; };
// Occupied spaces in tap order: [material, sappers waiting + out].
const line = (S) => S.order().map((s) => [S.spM[s], S.spW[s] + S.spO[s]]);

// ---- compile ----------------------------------------------------------------------------------------------------
{
  throws(() => E.compile(lv(["..a", "..."])), "compile: no camp throws");
  throws(() => E.compile(lv(["..X", ".##"])), "compile: an unknown cell throws");
  throws(() => E.compile(lv(["..j", ".##"])), "compile: iron outside a gate throws");
  throws(() => E.compile(lv([".jn", ".##"], null, { gates: [{ at: [1, 0], key: [0, 0] }] })), "compile: a key that is not gilt throws");
  throws(() => E.compile(lv(["..a", ".##"], [[[10, 1]], [], [], [], []])), "compile: an iron card throws");
  throws(() => E.compile(lv(["..a", ".##"], [[[1, 0]], [], [], [], []])), "compile: a zero card throws");
  throws(() => E.compile(lv(["..a", ".##"], [[], [], [], []])), "compile: four columns throws");
  const B = E.compile(lv(["a~b", "...", ".##"]));
  eq([B.campRow, B.pixTotal, B.pix[1], B.pix[2]], [2, 2, 1, 1], "compile: camp row is the camp's top row; pixels counted per material");
}

// ---- reachability ---------------------------------------------------------------------------------------------------
{
  const L = lv(["~~~~~~~", "~b~ddd.", "~~~dcd.", "a..ddd.", "...##.."]);
  const S = E.sim(E.compile(L), N);
  eq([S.reachable(1), S.reachable(2), S.reachable(3), S.reachable(4)], [1, 0, 0, 5], "reach: grass-side pixels reach (5 of 8 d); behind water and inside a ring do not");
  eq(S.d[4 * 7 + 3], 0, "reach: camp cells are distance 0");
  eq(S.d[1 * 7 + 6], 5, "reach: walk distance over grass (camp -> right edge -> up)");
  eq(S.d[1 * 7 + 1] < 0, true, "reach: pixel cells have no walk distance");
}
{
  const L = lv([".....", ".aaa.", ".aba.", ".aaa.", "..#.."], [[[1, 1]], [], [], [], []]);
  const S = E.sim(E.compile(L), N);
  eq(S.reachable(2), 0, "reach: an enclosed pixel is unreachable");
  const e = eats(S, 0);
  eq([e, S.reachable(2)], [[[2, 3]], 1], "reach: popping the nearest ring pixel (bottom middle) makes the inside reachable");
}

// ---- nearest pixel and the tie-break (claim order = pop order when the walks are equal) -------------------------------
{
  const L = lv(["......", "..aa..", ".a##a.", "..##.."], [[[1, 4]], [], [], [], []]);
  eq(eats(E.sim(E.compile(L), N), 0), [[1, 2], [4, 2], [2, 1], [3, 1]], "tie-break: same distance -> the camp row first, then lower x");
}
{
  const L = lv(["...a......", "..........", "........a.", "..........", "...##....."], [[[1, 2]], [], [], [], []]);
  eq(eats(E.sim(E.compile(L), N), 0), [[3, 0], [8, 2]], "nearest: the smallest walk distance is claimed first");
}
{
  const L = lv(["bbbbb", "b...b", "baaab", ".....", "..#.."], [[[1, 3]], [[2, 2]], [], [], []]);
  const S = E.sim(E.compile(L), N);
  eq(eats(S, 0), [[2, 2], [1, 2], [3, 2]], "nearest: a row claimed from the camp outward, lower x first on ties");
  eq(eats(S, 1), [[0, 2], [4, 2]], "nearest: popping opens shortcuts; the two b on row 2 (nearer the camp row) beat the top middle");
}

// ---- dispatch: only what can be reached goes; the next round goes as pixels pop ------------------------------------------
// COLUMN: 14 a pixels, two wide, in a water channel: only the bottom two touch the ground.
const COLUMN = ["~aa~", "~aa~", "~aa~", "~aa~", "~aa~", "~aa~", "~aa~", "....", ".##."];
{
  const S = E.sim(E.compile(lv(COLUMN, [[[1, 14]], [], [], [], []])), N);
  S.play(0, 0); S.advanceTo(TM.staggerMs * 3);
  eq([S.sent, S.out, S.spW[0]], [2, 2, 12], "dispatch: 2 open, a squad of 14: exactly 2 go, 12 wait at the space");
  const popAt = TM.yardMs + 2 * TM.tileMs + TM.biteMs;
  S.advanceTo(popAt - 1); eq([S.sent, S.pixLeft], [2, 14], "dispatch: nothing more goes before a pixel pops");
  S.advanceTo(popAt); eq([S.pixLeft, S.sent], [13, 3], "dispatch: the first pop exposes the pixel behind it and the next sapper goes at once");
  S.quiet(); eq([S.status, S.lineLen, S.sent], [E.WON, 0, 14], "dispatch: round by round the squad eats the column and wins");
}
{
  // Claims: two squads of a colour tapped together with one pixel open: one sapper goes, never two at the same pixel.
  const S = E.sim(E.compile(lv(["~a~", "...", ".##"], [[[1, 1]], [[1, 1]], [], [], []])), N);
  S.play(0, 0); S.play(1, 0); S.advanceTo(10);
  eq([S.sent, S.lineLen], [1, 2], "claims: one open pixel, two squads: one sapper goes (no double targeting), both hold a space");
  S.quiet(); eq([S.status, S.pixLeft], [E.WON, 0], "claims: the one pixel pops once; the fort is razed");
}
{
  // Every in-flight target is distinct, on a busy real level.
  const L = LEVELS.levels.find((l) => l.n === 60) || LEVELS.levels[LEVELS.levels.length - 1], B = E.compile(L), S = E.sim(B, N);
  let dup = 0; for (let i = 0; i < 5; i++) { S.play(i % 5, S.now + 40); const seen = new Set(); for (let id = 0; id < S.sent; id++) if (S.qK[id] === 1 && S.q1[id] > S.now) { if (seen.has(S.qC[id])) dup++; seen.add(S.qC[id]); } }
  eq(dup, 0, "claims: five rushed taps on level " + L.n + ": no two sappers in flight share a pixel");
}
{
  // A space frees exactly when its last sapper is home.
  const S = E.sim(E.compile(lv(["..a..", ".....", "..#.."], [[[1, 1]], [], [], [], []])), N);
  S.play(0, 0);
  const tiles = 2, home = TM.yardMs + tiles * TM.tileMs + TM.biteMs + TM.yardMs + tiles * TM.carryMs;
  S.advanceTo(home - 1); eq([S.lineLen, S.pixLeft, S.status], [1, 0, E.WON], "space: the pixel popped, the sapper is still carrying it home, the space is held");
  S.advanceTo(home); eq([S.lineLen, S.busy], [0, false], "space: it frees at the computed home time (" + home + " ms)");
}

// ---- spaces: no merging, a space per tap; no free space refuses the tap (v3.1) -----------------------------------------
const RING = [".......", ".aaaaa.", ".abbca.", ".aaaaa.", "...#..."];
{
  const S = E.sim(E.compile(lv(RING, [[[2, 1]], [[2, 1]], [[3, 1]], [[1, 12]], []])), N);
  pat(S, 0); eq(line(S), [[2, 1]], "space: an unreachable squad waits in its space");
  pat(S, 1); eq(line(S), [[2, 1], [2, 1]], "space: a second squad of the same colour takes its own space (no merging)");
  pat(S, 2); eq(line(S), [[2, 1], [2, 1], [3, 1]], "space: a new colour takes the next space");
  S.logOn = true; S.clearLog(); pat(S, 3);
  const firsts = []; for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === E.EV.DISP) { const s = S.qS[S.ev[i + 1]]; if (firsts.indexOf(s) < 0) firsts.push(s); }
  eq([S.status, S.lineLen, firsts], [E.WON, 0, [3, 0, 1, 2]], "resume: the ring falls, the waiting squads go on their own, in tap order, and win");
}
{
  const V = E.sim(E.compile(lv(RING, [[[2, 1]], [[3, 1], [1, 12]], [[2, 1]], [], []])), Object.assign({}, hold(2), { mergeLeftovers: true }));
  pat(V, 0); pat(V, 2); eq(line(V), [[2, 2]], "flag mergeLeftovers: a same-colour squad joins its space (the old rule, off by default)");
}
{
  const L = lv([".......", ".aaaaa.", ".abbba.", ".abcba.", ".abbba.", ".aaaaa.", "...#..."], [[[3, 1]], [[2, 8]], [[1, 16]], [], []]);
  const S = E.sim(E.compile(L), N);
  pat(S, 0); pat(S, 1); eq(line(S), [[3, 1], [2, 8]], "cascade: two squads wait");
  eq(pat(S, 2), E.WON, "cascade: the a ring falls, b goes, which opens c: all without another tap");
}
{
  // v3.1: a third rapid tap with both spaces taken is refused: a no-op (the card stays, the state is byte-identical, the
  // level plays on); once a squad is home the same tap goes through. The same taps, patient, win.
  const L = lv(["abc....", ".......", "...##.."], [[[1, 1]], [[2, 1]], [[3, 1]], [], []]);
  const S = E.sim(E.compile(L), hold(2));
  S.play(0, 0); S.play(1, 10); eq(S.status, E.PLAYING, "spam: two squads out fill both spaces");
  S.advanceTo(20); const before = S.save();
  eq(S.play(2), E.REFUSED, "refused: a third rapid tap has no free space: play() returns REFUSED");
  const after = S.save();
  ok(before.length === after.length && before.every((v, i) => v === after[i]), "refused: the state is byte-identical (tray, line, board, clock)");
  eq([S.status, S.heads[2], S.plays, S.lineLen, S.blocked(3)], [E.PLAYING, 0, 2, 2, true], "refused: no fail, the card stays at the front, no play counted");
  eq(S.play(2, 30), E.REFUSED, "refused: tapping again while both squads are out is refused again");
  let t = 30; for (let g = 0; g < 200 && S.lineLen === 2; g++) { t += 10; S.advanceTo(t); }
  eq([S.lineLen < 2, S.status], [true, E.PLAYING], "refused: a squad comes home and frees its space");
  eq([S.play(2), S.heads[2], S.lineLen], [E.PLAYING, 1, 2], "refused, then accepted: the same tap takes the freed space");
  S.quiet(); eq(S.status, E.WON, "refused, then accepted: the level still wins");
  const P = E.sim(E.compile(L), hold(2)); pat(P, 0); pat(P, 1); pat(P, 2);
  eq(P.status, E.WON, "patience: the same taps, each after the squads are home, win");
  const P2 = E.sim(E.compile(L), hold(2)); P2.play(0, 0); P2.play(1, 10); P2.quiet(); P2.play(2); P2.quiet();
  eq(P2.status, E.WON, "patience: waiting for a space to free is enough");
}
{
  const S = E.sim(E.compile(lv(["....", ".aa.", "..#."], [[[1, 1]], [], [], [], []])), N); pat(S, 0);
  eq([S.status, S.reason], [E.FAILED, "stuck"], "stuck: tray empty, nothing moving, pixels left");
}
{
  const S = E.sim(E.compile(lv([".......", ".aaaaa.", ".abcda.", ".aaaaa.", "...#..."], [[[2, 1]], [[3, 1], [1, 12]], [[4, 1]], [], []])), hold(1));
  S.play(0); eq([S.status, S.reason], [E.FAILED, "jam"], "jam: the one space holds a squad that can't reach a pixel, nothing moves: the line is jammed");
  eq(S.stuck(S.order()[0]), true, "jam: the squad in the space reads stuck");
  const M1 = E.sim(E.compile(lv(RING, [[[2, 1]], [[3, 1], [1, 12]], [[2, 1]], [], []])), Object.assign({}, hold(1), { mergeLeftovers: true }));
  M1.play(0); eq(M1.status, E.PLAYING, "jam (flag mergeLeftovers): a front card that can merge is a legal move, so no jam");
}
{
  // Wrong-colour spam ends in a jam: five inner colours tapped before the ring's crew, rushed, fill every space with
  // squads that can't reach; the ring's crew is refused; the line is jammed as soon as nothing moves.
  const JAMB = [".........", ".aaaaaaa.", ".abcdefa.", ".aaaaaaa.", "....#...."];
  const L = lv(JAMB, [[[2, 1], [1, 16]], [[3, 1]], [[4, 1]], [[5, 1]], [[6, 1]]]);
  const S = E.sim(E.compile(L), N);
  for (const j of [1, 2, 3, 4]) S.play(j, S.now + 30);
  eq([S.status, S.lineLen], [E.PLAYING, 4], "spam: four wrong colours wait in four spaces");
  S.play(0, S.now + 30);
  eq([S.status, S.reason, S.lineLen, S.order().every((s) => S.stuck(s))], [E.FAILED, "jam", 5, true], "spam: the fifth fills the line with stuck squads: jammed at once, at rest");
  const R = E.sim(E.compile(L), N); for (const j of [1, 2, 3, 4]) R.play(j, R.now + 30);
  eq(R.play(0, R.now + 30), E.FAILED, "spam: rushed, the fifth wrong colour's tap is taken (a space was free) and jams");
  const W = E.sim(E.compile(L), N); pat(W, 0); pat(W, 0); for (const j of [1, 2, 3, 4]) pat(W, j);
  eq(W.status, E.WON, "spam: the ring's crew first, then the inner colours, wins");
  const H4 = E.sim(E.compile(L), hold(4)); for (const j of [1, 2, 3, 4]) H4.play(j, H4.now + 30);
  eq([H4.status, H4.reason], [E.FAILED, "jam"], "spam (4 spaces): four stuck squads and a refused front card: jammed");
  // Dealing mode keeps the old overflow (the dealer reads it): a squad with no space fails the deal.
  const D = E.sim(E.compile(lv(JAMB)), hold(2), { deal: true }); D.playSquad(2, 1); D.playSquad(3, 1); D.playSquad(4, 1);
  eq([D.status, D.reason], [E.FAILED, "overflow"], "dealing: a squad with no free space still fails the deal (overflow)");
}

// ---- gates and keys --------------------------------------------------------------------------------------------------
{
  const L = lv(["~~~~~", "~ccc~", "~~j~~", ".....", "n.#.."], [[[3, 3]], [[14, 1]], [], [], []], { gates: [{ at: [2, 2], key: [0, 4] }] });
  const B = E.compile(L), S = E.sim(B, N);
  eq([S.reachable(3), S.pixLeft], [0, 5], "gate: iron blocks the way; the gate's pixels count toward the fort");
  pat(S, 0); eq(line(S), [[3, 3]], "gate: the crew for the keep waits behind the locked gate");
  S.logOn = true; S.clearLog(); pat(S, 1);
  let gateEv = false; for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === E.EV.GATE) gateEv = true;
  eq([gateEv, S.a[2 * 5 + 2], S.status], [true, E.DIRT, E.WON], "gate: popping the key opens the gate (dirt) and the waiting crew finishes");
  eq(E.sim(B, N).target(10), -1, "gate: iron is never a target");
}

// ---- archers ---------------------------------------------------------------------------------------------------------
// Tower g (centroid (7,0), range 3). a pixels by claim order: (4,2) walk 1, (3,2) and (6,2) walk 2 (lower x first),
// (7,2) walk 3, then (1,2), (0,2). (6,2) and (7,2) are covered.
const ARCH = (cols) => lv(["......ggg", ".........", "aa.aa.aa.", ".........", "....##..."], cols, { towers: [{ at: [7, 0], r: 3 }] });
{
  const S = E.sim(E.compile(ARCH([[[1, 6]], [[7, 3]], [], [], []])), N);
  eq([S.covered(2 * 9 + 7), S.covered(2 * 9 + 6), S.covered(2 * 9 + 3), S.covered(7)], [true, true, false, false], "archers: range covers nearby pixels; tower pixels are never covered");
  S.logOn = true; S.clearLog();
  const e = eats(S, 0), hits = []; for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === E.EV.HIT) hits.push(xy(S.B, S.qC[S.ev[i + 1]]));
  eq([e, hits, S.hits, line(S), S.status], [[[4, 2], [3, 2], [1, 2], [0, 2]], [[6, 2]], 1, [[1, 2]], E.PLAYING], "archers (Normal): the one sent at a covered pixel is hit and walks back; the squad turns wary and only takes uncovered pixels; 2 wait");
  eq(pat(S, 1), E.WON, "archers (Normal): once the tower falls the wary squad finishes and wins");
}
{
  const S = E.sim(E.compile(ARCH([[[1, 6]], [[7, 1], [7, 2]], [], [], []])), N);
  pat(S, 0); pat(S, 1);
  eq([S.hits, line(S)], [1, [[1, 2]]], "re-hit: while any tower pixel stands the wary squad never walks into the ring again");
  eq(pat(S, 1), E.WON, "re-hit: the tower's last pixel lets it finish");
}
{
  const S = E.sim(E.compile(ARCH([[[1, 6]], [[7, 3]], [], [], []])), EZ);
  pat(S, 0); eq([S.hits, S.kills, line(S)], [1, 0, [[1, 2]]], "archers (Easy): the hit sapper walks back to its space");
}
{
  const S = E.sim(E.compile(ARCH([[[1, 6]], [[7, 3]], [], [], []])), H);
  pat(S, 0); eq([S.kills, S.status, S.reason], [1, E.FAILED, "short"], "archers (Hard): the hit sapper dies, and the colour is short: fail");
  const S2 = E.sim(E.compile(ARCH([[[1, 6]], [[7, 3]], [], [], []])), H);
  pat(S2, 1); pat(S2, 0); eq([S2.kills, S2.status], [0, E.WON], "archers (Hard): the tower first wins");
  const S3 = E.sim(E.compile(Object.assign(ARCH([[[1, 6]], [[7, 3]], [], [], []]), { safeArchers: true })), H);
  pat(S3, 0); eq([S3.kills, S3.hits, S3.status], [0, 1, E.PLAYING], "archers (safeArchers, level 51): never kill, even on Hard");
}

// ---- determinism, save / load ------------------------------------------------------------------------------------------
{
  const L = LEVELS.levels.find((l) => l.n === 58) || LEVELS.levels[50], B = E.compile(L);
  let refusedN = 0, seed = 99;
  const run = () => { const S = E.sim(B, N), r = Gr.rng(seed); let t = 0; refusedN = 0; for (let g = 0; g < 80 && S.status === E.PLAYING; g++) { const o = []; for (let j = 0; j < 5; j++) if (S.heads[j] < B.colLen[j]) o.push(j); if (!o.length) break; t += Math.floor(r() * 200); if (S.play(o[Math.floor(r() * o.length)], t) === E.REFUSED) refusedN++; } S.advanceTo(t + 4000); return S.save(); };
  for (let k = 0; k < 40; k++) { seed = 99 + k; run(); if (refusedN > 0) break; } // a seed whose rushed taps meet a full line
  const A = run(), Bm = run();
  ok(A.length === Bm.length && A.every((v, i) => v === Bm[i]), "determinism: the same taps at the same times give an identical state (level " + L.n + ", seed " + seed + ")");
  ok(refusedN > 0, "determinism: that run includes refused taps (" + refusedN + ")");
}
{
  const B = E.compile(ARCH([[[1, 6]], [[7, 3]], [], [], []])), S = E.sim(B, N), buf = S.save();
  pat(S, 0); const h1 = S.hash(); S.load(buf); eq([S.lineLen, S.pixLeft, S.heads[0], S.now], [0, 9, 0, 0], "save/load: load restores the whole state, clock included");
  pat(S, 0); eq(S.hash(), h1, "save/load: replaying gives the same state hash");
  eq(S.play(0), -2, "play: an empty column is refused");
}

// ---- differential: engine vs the slow reference on every baked level, patient and rushed --------------------------------
{
  let games = 0, taps = 0, pops = 0, diffs = 0, refused = 0, patientRefused = 0;
  const t0 = Date.now();
  for (const L of LEVELS.levels) {
    const B = E.compile(L);
    for (const [dn, rules] of Object.entries(RULES)) {
      for (const rushed of [false, true]) {
        const S = E.sim(B, rules), R = Ref.game(L, rules), r = Gr.rng(L.n * 1009 + (rushed ? 17 : 3) + dn.length);
        S.logOn = true; let t = 0, bad = null;
        const mine = [];
        for (let g = 0; g <= 6 * B.ncards + 40 && S.status === E.PLAYING && !bad; g++) {
          const open = []; for (let j = 0; j < 5; j++) if (S.heads[j] < B.colLen[j]) open.push(j);
          if (!open.length) break;
          const j = open[Math.floor(r() * open.length)];
          S.clearLog();
          let a1, a2;
          if (rushed) { t += Math.floor(r() * 1800); a1 = S.play(j, t); a2 = R.play(j, t); } else { a1 = S.play(j); S.quiet(); a2 = R.play(j); R.quiet(); }
          taps++;
          if ((a1 === E.REFUSED) !== (a2 === "refused")) bad = "refusal " + a1 + "/" + a2;
          if (a1 === E.REFUSED) { refused++; if (!rushed && !B.nlinks) patientRefused++; }
          for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === E.EV.EAT) mine.push([S.ev[i + 1], S.q1[S.ev[i + 2]]]);
          const st = S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing";
          const lineR = R.spaces.map((s, k) => [k, s]).filter(([, s]) => s).sort((p, q) => p[1].seq - q[1].seq).map(([, s]) => [s.m, s.wait + s.out]);
          if (bad) break;
          if (JSON.stringify(mine) !== JSON.stringify(R.pops)) bad = "pops";
          else if (st !== R.status || (st === "failed" && S.reason !== R.reason)) bad = "status " + st + "/" + R.status + " " + S.reason + "/" + R.reason;
          else if (JSON.stringify(line(S)) !== JSON.stringify(lineR)) bad = "spaces";
          else if (S.now !== R.now) bad = "clock";
        }
        if (!bad) { S.quiet(); R.quiet(); const st = S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing"; if (st !== R.status || S.reason !== R.reason) bad = "final " + st + "/" + R.status + " " + S.reason + "/" + R.reason; }
        pops += mine.length;
        if (bad) { diffs++; if (diffs <= 4) console.log("  diff: level " + L.n + " " + dn + (rushed ? " rushed" : " patient") + ": " + bad); }
        games++;
      }
    }
  }
  eq(diffs, 0, "differential: engine == reference on " + games + " random games (" + taps + " taps, " + refused + " refused, " + pops + " pops), patient and rushed, every baked level and difficulty");
  eq(patientRefused, 0, "differential: a patient tap is never refused on a level without links (a full line at rest is already a jam)");
  ok(refused > 0, "differential: the rushed games include refused taps (" + refused + ")");
  console.log("  differential: " + games + " games, " + taps + " taps (" + refused + " refused) in " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
}

// ---- baked levels: stored winning orders (played patiently), sums ------------------------------------------------------
{
  let wins = 0, total = 0;
  for (const L of LEVELS.levels) {
    const B = E.compile(L);
    let sum = 0; for (let m = 0; m < E.NMAT; m++) sum += B.sapTotal[m];
    ok(sum === B.pixTotal - (B.pix[E.IRON] || 0), "level " + L.n + ": sappers sum to the fort's eatable pixels");
    for (const d of ["easy", "normal", "hard"]) {
      total++; const S = E.replay(B, RULES[d], L.win[d] || "");
      if (S.status === E.WON) wins++; else console.log("FAIL  level " + L.n + " " + d + ": stored order does not win patiently (" + S.reason + ")");
    }
  }
  eq(wins, total, "levels: every stored winning order wins patiently on its difficulty (" + total + " replays)");
  const NL = require("./bake-config.json").levels;
  eq([LEVELS.levels.length, LEVELS.levels.every((L, i) => L.n === i + 1)], [NL, true], "levels: " + NL + " levels baked, in order (v4 M3: the Siege to 100)");
  // v4 M3: every era present, Era 4 from 76; every stored Normal line inside the dead-time cap and the tap cap.
  const eras = [...new Set(LEVELS.levels.map((L) => L.era))], BC = require("./bake-config.json");
  eq([eras.join(","), LEVELS.levels.filter((L) => L.n >= 76).every((L) => L.era === 4)], ["1,2,3,4", true], "levels: four eras, Era 4 from level 76");
  let dead = 0, longest = 0; for (const L of LEVELS.levels) { const ln = Gr.line(E.compile(L), RULES.normal, L.win.normal); longest = Math.max(longest, ln.maxWait); if (ln.maxWait > BC.maxWaitMs || L.win.normal.length > BC.maxTaps) dead++; }
  eq(dead, 0, "levels: every stored Normal line keeps every tap under " + BC.maxWaitMs / 1000 + " s (longest " + (longest / 1000).toFixed(1) + " s) and " + BC.maxTaps + " taps");
}

// ==== v4 M2: the twists (mystery cards, linked squads, the locked space) =================================================
// Events of one type since the log was cleared, as [a, b].
const evs = (S, type) => { const o = []; for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === type) o.push([S.ev[i + 1], S.ev[i + 2]]); return o; };
const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
const ROW6 = ["abcdef", "......", "..##.."]; // six colours, one pixel each, all in reach

// ---- compile: the new fields ---------------------------------------------------------------------------------------------
{
  const C6 = [[[1, 1]], [[2, 1], [3, 1]], [[4, 1]], [], []];
  throws(() => E.compile(lv(ROW6, [[[1, 1], [2, 1]], [], [], [], []], { links: [[[0, 0], [0, 1]]] })), "compile: a link inside one column throws");
  throws(() => E.compile(lv(ROW6, C6, { links: [[[0, 0], [1, 0]], [[1, 0], [2, 0]]] })), "compile: a card in two links throws");
  throws(() => E.compile(lv(ROW6, C6, { links: [[[0, 0], [1, 2]]] })), "compile: a link to a card that isn't there throws");
  throws(() => E.compile(lv(ROW6, [[[1, 1, 2]], [], [], [], []])), "compile: unknown card flags throw");
  throws(() => E.compile(lv(ROW6, C6, { lock: { key: [0, 0] } })), "compile: a lock key that isn't gilt throws");
  throws(() => E.compile(lv([".jn", ".##"], null, { gates: [{ at: [1, 0], key: [2, 0] }], lock: { key: [2, 0] } })), "compile: a gate's key can't also be the lock's key");
  const B = E.compile(lv(ROW6, [[[1, 1]], [[2, 1, 1], [3, 1]], [[4, 1]], [], []], { links: [[[0, 0], [1, 1]]] }));
  eq([Array.from(B.cardF), B.nlinks, B.linkOf[0], B.linkOf[2], B.linkOf[1], B.lockKey], [[0, 1, 0, 0], 1, 2, 0, -1, -1], "compile: flags, links (both ways) and no lock");
  const old = LEVELS.levels.find((L) => !L.links && !L.lock && L.cols.every((c) => c.every((cd) => cd.length === 2))), Bo = E.compile(old); // v4 M3: the first baked level without twists
  eq([Bo.nlinks, Bo.lockKey, Array.from(Bo.cardF).every((f) => f === 0)], [0, -1, true], "compile: a baked level has no twists (old files parse as before)");
}

// ---- mystery cards --------------------------------------------------------------------------------------------------------
{
  const L = lv(ROW6, [[[1, 1], [2, 1, 1]], [[3, 1, 1], [4, 1, 1], [5, 1]], [[6, 1]], [], []]);
  const S = E.sim(E.compile(L), N);
  eq([0, 1, 2, 3, 4, 5].map((c) => S.hidden(c)), [false, true, false, true, false, false], "mystery: a flagged card behind the front is hidden; a flagged front card and an unflagged card are not");
  S.logOn = true; S.clearLog(); S.play(0);
  eq([S.hidden(1), evs(S, E.EV.REVEAL)], [false, [[1, 0]]], "mystery: the card that reaches the front is revealed for good (one REVEAL: card 1, column 0)");
  S.quiet(); S.clearLog(); S.play(0); S.quiet();
  eq([S.hidden(1), evs(S, E.EV.REVEAL)], [false, []], "mystery: played, it stays revealed; no second REVEAL");
  eq(E.check(L), ["column 1: a mystery flag on the first card means nothing"], "check: warns about a mystery flag on a column's first card");
  // Information only: the same level with every flag stripped plays the same order identically.
  const P = E.sim(E.compile(lv(ROW6, L.cols.map((c) => c.map((cd) => cd.slice(0, 2))))), N), Q = E.sim(E.compile(L), N);
  for (const j of [1, 0, 1, 2, 0, 1]) { P.play(j); P.quiet(); Q.play(j); Q.quiet(); }
  eq([Q.status, Q.now, Q.pixLeft, Array.from(Q.a)], [P.status, P.now, P.pixLeft, Array.from(P.a)], "mystery: rules never read it (the same taps with and without flags end identically)");
}

// ---- linked squads ----------------------------------------------------------------------------------------------------------
{
  // a (column 0's front) is linked to b, third in column 1 behind c and a hidden d; e sits behind b.
  const L = lv(ROW6, [[[1, 1]], [[3, 1], [4, 1, 1], [2, 1], [5, 1]], [[6, 1]], [], []], { links: [[[0, 0], [1, 2]]] });
  const S = E.sim(E.compile(L), N); S.logOn = true;
  eq([S.partner(0), S.partner(3), S.card(1, 2), S.refused(0)], [3, 0, 3, false], "link: a and b (column 1, third card) are partners; with the line empty the tap is legal");
  const r = S.play(0);
  eq([r, S.lineLen, S.plays, evs(S, E.EV.TAP), evs(S, E.EV.LINK)], [E.PLAYING, 2, 1, [[0, 1], [1, 2]], [[0, 1]]], "link: one tap takes two spaces at the same moment: the tapped squad first (space 0), then its partner (space 1); one play");
  eq([S.card(1, 0), S.card(1, 1), S.card(1, 2), S.card(1, 3), S.heads[1], S.gone[3]], [1, 2, 4, -1, 0, 1], "link: the buried partner leaves its column and the cards behind it close up (c, d, e)");
  const disp = evs(S, E.EV.DISP).map(([id]) => [S.qS[id], S.q0[id]]);
  eq(disp, [[0, 0], [1, 0]], "link: both squads go out together (each dispatches at once for its own colour)");
  S.quiet(); eq([S.status, S.lineLen, S.pixLeft], [E.PLAYING, 0, 4], "link: both pixels pop; both spaces free");
  // The partner hidden: revealed as it leaves.
  const H2 = E.sim(E.compile(lv(ROW6, [[[1, 1]], [[3, 1], [2, 1, 1], [5, 1]], [[6, 1]], [], []], { links: [[[0, 0], [1, 1]]] })), N); H2.logOn = true;
  eq(H2.hidden(2), true, "link: a hidden partner reads hidden before the tap");
  H2.play(0); eq([H2.hidden(2), evs(H2, E.EV.REVEAL)], [false, [[2, 1]]], "link: a hidden partner is revealed as it leaves (REVEAL card 2, column 1)");
  // The partner at the front of its column: that column's head moves on (and reveals a mystery card behind it).
  const F2 = E.sim(E.compile(lv(ROW6, [[[1, 1]], [[2, 1], [3, 1, 1]], [], [], []], { links: [[[0, 0], [1, 0]]] })), N); F2.logOn = true;
  F2.play(0); eq([F2.heads[0], F2.heads[1], F2.card(1, 0), F2.hidden(2), evs(F2, E.EV.REVEAL)], [1, 1, 2, false, [[2, 1]]], "link: a partner at its column's front: both columns move on; the new front is revealed");
  // Tapped from the other side: column 1's front pulls column 0's second card; column 0's front stays.
  const O2 = E.sim(E.compile(lv(ROW6, [[[1, 1], [2, 1]], [[3, 1]], [], [], []], { links: [[[0, 1], [1, 0]]] })), N);
  O2.play(1); eq([O2.heads[0], O2.card(0, 0), O2.card(0, 1), O2.lineLen, O2.order().map((s) => O2.spM[s])], [0, 0, -1, 2, [3, 2]], "link: tapped from either side; the partner's column keeps its front");
}
{
  // Two free spaces or refused. RING: b and c walled in; a's ring (12) is linked to c. Two spaces: b waits (walled in),
  // one space left, the linked tap is refused (from either side, byte-identical), the unlinked d is still legal.
  const L = lv(RING, [[[2, 1]], [[1, 12]], [[3, 1]], [[4, 1]], []], { links: [[[1, 0], [2, 0]]] });
  const S = E.sim(E.compile(L), hold(2)); pat(S, 0);
  eq([S.status, S.lineLen, S.open, S.refused(1), S.refused(2), S.refused(3)], [E.PLAYING, 1, 2, true, true, false], "link refused: one space free: both linked fronts are refused, the unlinked one is legal");
  const b0 = S.save();
  eq([S.play(1), S.play(2)], [E.REFUSED, E.REFUSED], "link refused: play() returns REFUSED on either linked card");
  ok(same(b0, S.save()), "link refused: the state is byte-identical (tray, line, board, clock)");
  pat(S, 3); eq([S.status, S.reason, S.jamWhy], [E.FAILED, "jam", 0], "link refused: then d fills the line with two stuck squads: a plain jam (no free space)");
  // Generalized jam: one space free but every front card linked.
  const J = lv(RING, [[[2, 2]], [[1, 12]], [[3, 1]], [], []], { links: [[[1, 0], [2, 0]]] });
  const JS = E.sim(E.compile(J), hold(2)); pat(JS, 0);
  eq([JS.status, JS.reason, JS.jamWhy, JS.lineLen], [E.FAILED, "jam", 1, 1], "jam (generalized): at rest, one space free, every front card linked: jam, jamWhy 1 (linked squads need 2)");
  const JR = Ref.game(J, hold(2)); JR.play(0); JR.quiet(); eq([JR.status, JR.reason, JR.jamWhy], ["failed", "jam", 1], "jam (generalized): the reference rules agree");
  const W3 = E.sim(E.compile(J), hold(3)); pat(W3, 0); eq(pat(W3, 1), E.WON, "jam (generalized): with 3 spaces the same taps win (the pair takes the last two)");
}
{
  // Coupled freeing: a's pixel is near the camp, b's far. The pair goes; a is home first but its space holds (held) until
  // b is home; then both free at that moment, the earlier-placed space first.
  const L = lv(["b.......", "........", "........", ".....a..", "........", "...##..."], [[[1, 1]], [[2, 1]], [], [], []], { links: [[[0, 0], [1, 0]]] });
  const S = E.sim(E.compile(L), N); S.logOn = true; S.play(0, 0);
  const ia = [0, 1].find((id) => S.qS[id] === 0), ib = 1 - ia, ta = S.q2[ia], tb = S.q2[ib];
  ok(ta < tb, "coupled: a's sapper is home before b's (" + ta + " < " + tb + " ms)");
  S.advanceTo(ta); eq([S.lineLen, S.held(0), S.stuck(0), S.held(1)], [2, true, false, false], "coupled: a is finished and home, but its space holds for its partner (held, not stuck)");
  S.clearLog(); S.advanceTo(tb - 1); eq([S.lineLen, evs(S, E.EV.FREE)], [2, []], "coupled: nothing frees while b is still out");
  S.advanceTo(tb); eq([S.lineLen, evs(S, E.EV.FREE)], [0, [[0, 1], [1, 2]]], "coupled: b home: both spaces free at that moment, space 0 then space 1");
}
{
  // Coupled freeing with a Hard kill: g (tower, 3) is linked to a (1); both a pixels sit in the tower's ring, so a's one
  // sapper is shot dead on the way. Dead counts as finished: a's space holds for g, and both free once g is home. A spare a
  // sapper in column 2 keeps the colour from going short; it finishes once the tower is down.
  const L = lv(["......ggg", ".........", "......aa.", ".........", "....##..."], [[[7, 3]], [[1, 1]], [[1, 2]], [], []], { towers: [{ at: [7, 0], r: 3 }], links: [[[0, 0], [1, 0]]] });
  const S = E.sim(E.compile(L), H); S.play(0, 0); S.advanceTo(600);
  eq([S.kills, S.status, S.lineLen, S.held(1), S.spO[0] > 0], [1, E.PLAYING, 2, true, true], "coupled (Hard kill): a's sapper is killed; a counts as finished and holds for g, still working");
  S.quiet(); eq([S.lineLen, S.standing, S.status], [0, 0, E.PLAYING], "coupled (Hard kill): the tower falls, g is home: both spaces free");
  eq(pat(S, 2), E.WON, "coupled (Hard kill): the spare a squad finishes");
}

// ---- the locked space ------------------------------------------------------------------------------------------------------
{
  const L = lv(["abn...", "......", "..##.."], [[[1, 1]], [[2, 1]], [[14, 1]], [], []], { lock: { key: [2, 0] } });
  const B = E.compile(L);
  eq(["easy", "normal", "hard"].map((d) => { const S = E.sim(B, RULES[d]); return [S.cap, S.open, S.locked]; }), [[6, 5, 1], [5, 4, 1], [4, 3, 1]], "lock: Easy 5 of 6 spaces open, Normal 4 of 5, Hard 3 of 4");
  eq(E.sim(E.compile(lv(L.grid, L.cols)), N).open, 5, "lock: the same board without a lock opens every space");
  const S = E.sim(B, N); S.logOn = true; S.play(2, 0);
  const pop = S.q1[0];
  S.advanceTo(pop - 1); eq([S.open, S.locked], [4, 1], "lock: shut until its key pops");
  S.clearLog(); S.advanceTo(pop); eq([S.open, S.locked, evs(S, E.EV.UNLOCK)], [5, 0, [[2, 0]]], "lock: the key pops and the space opens at that moment (UNLOCK)");
  // Unlocking can let a waiting tap through at once: two spaces, one locked; the Looters out; a tap is refused until
  // the key pops, then taken while the Looters are still carrying it home.
  const U = E.sim(B, hold(2)); U.play(2, 0); U.advanceTo(10);
  eq([U.open, U.play(0)], [1, E.REFUSED], "lock: one open space, taken: a second tap is refused");
  U.advanceTo(pop); eq([U.open, U.play(0), U.lineLen, U.out > 0], [2, E.PLAYING, 2, true], "lock: the key pops: the same tap is taken at once, before the Looters are home");
  // A squad never takes a locked space; a line full but for the locked space at rest is a jam (jamWhy 2).
  const J = E.sim(E.compile(lv(["abn...", "......", "..##.."], [[[4, 1]], [[5, 1]], [[14, 1]], [], []], { lock: { key: [2, 0] } })), hold(3));
  pat(J, 0); pat(J, 1);
  eq([J.status, J.reason, J.jamWhy, J.spQ[2], J.lineLen, J.open], [E.FAILED, "jam", 2, 0, 2, 2], "lock: two stuck squads fill the two open spaces; the locked one stays empty; jam, jamWhy 2");
}

// ---- dealing mode (the dealer, M3) -------------------------------------------------------------------------------------------
{
  const D = E.sim(E.compile(lv(RING)), hold(2), { deal: true });
  D.playSquad(2, 1); eq(D.playPair(1, 12, 3, 1), E.FAILED, "dealing: a pair with one open space fails the deal");
  eq(D.reason, "overflow", "dealing: the pair's fail is overflow");
  const P = E.sim(E.compile(lv(RING)), hold(3), { deal: true }); P.playSquad(2, 2); P.playPair(1, 12, 3, 1); P.quiet();
  eq([P.status, P.lineLen], [E.WON, 0], "dealing: a pair with two open spaces plays like the tray's pair and wins");
  const K = E.sim(E.compile(lv(["abn...", "......", "..##.."], null, { lock: { key: [2, 0] } })), hold(3), { deal: true });
  K.playSquad(4, 1); K.playSquad(5, 1); eq([K.open, K.playSquad(6, 1), K.reason], [2, E.FAILED, "overflow"], "dealing: the lock counts (two of three spaces open); the third squad overflows");
  const T = E.sim(E.compile(lv(RING, [[[2, 1]], [[1, 12]], [[3, 1]], [], []], { links: [[[1, 0], [2, 0]]] })), hold(2), { deal: true });
  T.play(0); T.quiet(); eq([T.play(1), T.reason], [E.FAILED, "overflow"], "dealing: a linked tray card with one open space overflows (dealing never refuses)");
}

// ---- no state hangs: random play on twisted levels, patient and rushed ----------------------------------------------------
// inject(L, seed): a copy of a baked level with random twists: mystery flags on about 40% of the cards behind the fronts,
// 1-3 links (neighbouring columns, rows at most 2 apart), and (60%) a lock whose key is a fort pixel turned gilt (one
// sapper moved off a card of its colour onto a new Looters card).
function inject(L0, seed) {
  const L = JSON.parse(JSON.stringify(L0)), r = Gr.rng(seed), ri = (k) => Math.floor(r() * k);
  delete L.win; delete L.grade;
  L.cols.forEach((col) => col.forEach((cd, i) => { if (i > 0 && r() < 0.4) cd[2] = E.MYSTERY; }));
  const used = new Set(), links = [];
  for (let t = 0, want = 1 + ri(3); t < 40 && links.length < want; t++) {
    const j = ri(4), k = j + 1, i = ri(L.cols[j].length || 1), q = Math.max(0, Math.min((L.cols[k].length || 1) - 1, i + ri(5) - 2));
    if (!L.cols[j].length || !L.cols[k].length || Math.abs(i - q) > 2 || used.has(j + "," + i) || used.has(k + "," + q)) continue;
    used.add(j + "," + i); used.add(k + "," + q); links.push(r() < 0.5 ? [[j, i], [k, q]] : [[k, q], [j, i]]);
  }
  L.links = links;
  if (r() < 0.6) {
    const B = E.compile(L), cells = [];
    for (let c = 0; c < B.n; c++) { const m = B.a0[c]; if (m > 0 && m !== E.IRON && m !== E.GILT && B.towerOf[c] < 0 && L.cols.some((col) => col.some((cd) => cd[0] === m && cd[1] > 1))) cells.push(c); }
    if (cells.length) {
      const c = cells[ri(cells.length)], x = c % B.w, y = (c / B.w) | 0, m = B.a0[c];
      L.grid[y] = L.grid[y].slice(0, x) + "n" + L.grid[y].slice(x + 1);
      const col = L.cols.find((cl) => cl.some((cd) => cd[0] === m && cd[1] > 1)); col.find((cd) => cd[0] === m && cd[1] > 1)[1]--;
      L.cols[ri(5)].push([E.GILT, 1]); L.lock = { key: [x, y] };
    }
  }
  return L;
}
const DEBUG = require("../levels/debug-v4.json").levels;
const TWISTED = DEBUG.concat(LEVELS.levels.filter((l, k) => k % 2 === 1).map((l, k) => inject(l, 7001 + k)));
{
  let rests = 0, hangs = 0, games = 0, fails = { jam: 0, stuck: 0, short: 0 }, jam1 = 0, jam2 = 0;
  for (const L of TWISTED) {
    const B = E.compile(L);
    for (const [dn, rules] of Object.entries(RULES)) for (let g = 0; g < 6; g++) {
      const S = E.sim(B, rules), r = Gr.rng(L.id ? L.id.length * 131 + g : g * 977 + B.n), rushed = g >= 3; let t = 0; games++;
      const restCheck = () => { if (S.busy) return; rests++; if (S.status !== E.PLAYING) return;
        let legalN = 0, cards = 0; for (let j = 0; j < 5; j++) { if (S.front(j) >= 0) cards++; if (Gr.legal(S, j)) legalN++; }
        if (!legalN) { hangs++; if (hangs <= 3) console.log("  hang: " + (L.id || "injected") + " " + dn + " cards " + cards + " pixels " + S.pixLeft); } };
      restCheck();
      for (let k = 0; k <= 8 * B.ncards + 40 && S.status === E.PLAYING; k++) {
        const open = []; for (let j = 0; j < 5; j++) if (S.front(j) >= 0) open.push(j);
        if (!open.length) break;
        if (rushed) { t += Math.floor(r() * 1500); S.play(open[Math.floor(r() * open.length)], t); } else { S.play(open[Math.floor(r() * open.length)]); S.quiet(); }
        restCheck();
      }
      S.quiet(); restCheck();
      if (S.status === E.FAILED) { fails[S.reason] = (fails[S.reason] || 0) + 1; if (S.reason === "jam") { if (S.jamWhy & 1) jam1++; if (S.jamWhy & 2) jam2++; } }
    }
  }
  eq(hangs, 0, "no hang: " + rests + " rest states in " + games + " random games on " + TWISTED.length + " twisted levels: every one is a win, a fail, or has a legal tap");
  ok(jam1 > 0 && jam2 > 0, "no hang: the games include jams where a linked card needed 2 spaces (" + jam1 + ") and jams with a space still locked (" + jam2 + "); fails " + JSON.stringify(fails));
  eq(TWISTED.slice(DEBUG.length).filter((L) => E.check(L).some((w) => /rows apart/.test(w))).length, 0, "inject: the random links keep to 2 rows apart");
}

// ---- differential on twisted levels: engine vs the reference, patient and rushed ------------------------------------------
{
  let games = 0, taps = 0, refused = 0, pops = 0, diffs = 0, pairs = 0, unlocks = 0, reveals = 0; const t0 = Date.now();
  const rline = (R) => R.spaces.map((s, k) => [k, s]).filter(([, s]) => s).sort((p, q) => p[1].seq - q[1].seq).map(([k, s]) => [s.m, s.wait + s.out, s.pair == null ? -1 : R.spaces[s.pair].seq]);
  const eline = (S) => S.order().map((s) => [S.spM[s], S.spW[s] + S.spO[s], S.spL[s] ? S.spQ[S.spL[s] - 1] : -1]);
  for (const L of TWISTED) {
    const B = E.compile(L);
    for (const [dn, rules] of Object.entries(RULES)) for (const rushed of [false, true]) {
      const S = E.sim(B, rules), R = Ref.game(L, rules), r = Gr.rng(B.n * 31 + (rushed ? 5 : 1) + dn.length); S.logOn = true;
      let t = 0, bad = null; const mine = [];
      for (let g = 0; g <= 6 * B.ncards + 40 && S.status === E.PLAYING && !bad; g++) {
        const open = []; for (let j = 0; j < 5; j++) if (S.front(j) >= 0) open.push(j);
        if (!open.length) break;
        const j = open[Math.floor(r() * open.length)];
        S.clearLog(); let a1, a2;
        if (rushed) { t += Math.floor(r() * 1800); a1 = S.play(j, t); a2 = R.play(j, t); } else { a1 = S.play(j); S.quiet(); a2 = R.play(j); R.quiet(); }
        taps++; if (a1 === E.REFUSED) refused++;
        if ((a1 === E.REFUSED) !== (a2 === "refused")) { bad = "refusal " + a1 + "/" + a2; break; }
        for (let i = 0; i < S.evLen; i += 3) { const ty = S.ev[i]; if (ty === E.EV.EAT) mine.push([S.ev[i + 1], S.q1[S.ev[i + 2]]]); else if (ty === E.EV.LINK) pairs++; else if (ty === E.EV.UNLOCK) unlocks++; else if (ty === E.EV.REVEAL) reveals++; }
        const st = S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing";
        const colsE = [0, 1, 2, 3, 4].map((c) => { const o = []; for (let d = 0, ci = S.card(c, 0); ci >= 0; ci = S.card(c, ++d)) o.push(ci); return o; }), colsR = R.cols.map((c) => c.map((cd) => cd.ci));
        const hidE = [], hidR = []; for (let ci = 0; ci < B.ncards; ci++) { if (S.hidden(ci)) hidE.push(ci); if (R.hidden(ci)) hidR.push(ci); }
        if (JSON.stringify(mine) !== JSON.stringify(R.pops)) bad = "pops";
        else if (st !== R.status || (st === "failed" && (S.reason !== R.reason || (S.reason === "jam" && S.jamWhy !== R.jamWhy)))) bad = "status " + st + "/" + R.status + " " + S.reason + "/" + R.reason + " " + S.jamWhy + "/" + R.jamWhy;
        else if (JSON.stringify(eline(S)) !== JSON.stringify(rline(R))) bad = "spaces " + JSON.stringify(eline(S)) + " / " + JSON.stringify(rline(R));
        else if (S.now !== R.now || S.open !== R.open || S.locked !== R.locked) bad = "clock or lock";
        else if (JSON.stringify(colsE) !== JSON.stringify(colsR)) bad = "columns";
        else if (JSON.stringify(hidE) !== JSON.stringify(hidR)) bad = "hidden cards";
      }
      if (!bad) { S.quiet(); R.quiet(); const st = S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing"; if (st !== R.status || S.reason !== R.reason || S.jamWhy !== R.jamWhy) bad = "final " + st + "/" + R.status; }
      pops += mine.length; games++;
      if (bad) { diffs++; if (diffs <= 4) console.log("  diff: " + (L.id || "injected " + B.n) + " " + dn + (rushed ? " rushed" : " patient") + ": " + bad); }
    }
  }
  eq(diffs, 0, "differential (twists): engine == reference on " + games + " games (" + taps + " taps, " + refused + " refused, " + pops + " pops; " + pairs + " pairs, " + unlocks + " unlocks, " + reveals + " reveals): pops and times, status, reason and jamWhy, spaces and pairs, columns, hidden cards, lock");
  ok(pairs > 0 && unlocks > 0 && reveals > 0 && refused > 0, "differential (twists): the games exercise pairs, unlocks, reveals and refusals");
  console.log("  differential (twists): " + games + " games in " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
}

// ---- the grader's info model, legal taps, the fast tapper -------------------------------------------------------------------
{
  const L = DEBUG.find((l) => l.id === "v4-all"), B = E.compile(L), S = E.sim(B, N), V = Gr.view(S);
  const hid = V.cols.flat().filter((cd) => cd[0] === 0).length, hidE = Array.from({ length: B.ncards }, (_, c) => S.hidden(c)).filter(Boolean).length;
  eq([hid, hid === hidE, V.cols.every((c) => c.every((cd) => cd[1] > 0))], [hidE, true, true], "view: hidden cards show as colour 0 with their count (" + hid + " hidden)");
  let seen = 0; for (let c = 0; c < B.ncards; c++) if (!S.hidden(c)) seen += B.cardN[c];
  eq(V.unseen.reduce((a, b) => a + b, 0), B.pixTotal - B.pix[E.IRON] - seen, "view: unseen = the board's eatable pixels less every card already seen");
  // The lookahead never reads a hidden colour: give every hidden card another colour (counts kept, board unchanged) and
  // its scores for every first move are identical, although a linked front card pulls a hidden partner.
  const f = [0, 1, 2, 3, 4].find((j) => { const ci = S.front(j), p = S.partner(ci); return ci >= 0 && p >= 0 && S.hidden(p); });
  ok(f !== undefined, "lookahead: v4-all opens with a linked front card whose partner is hidden (column " + f + ")");
  const mats = [...new Set(L.cols.flat().map((cd) => cd[0]))], L2 = JSON.parse(JSON.stringify(L)); let k = 0;
  L2.cols.forEach((col, j) => col.forEach((cd, i) => { if (S.hidden(B.colStart[j] + i)) { const alt = mats.filter((m) => m !== cd[0]); cd[0] = alt[k++ % alt.length]; } }));
  const S2 = E.sim(E.compile(L2), N), s1 = Gr.look(S, new Int32Array(S.M.length), new Float64Array(5)), s2 = Gr.look(S2, new Int32Array(S2.M.length), new Float64Array(5));
  eq(Array.from(s2), Array.from(s1), "lookahead: re-colouring every hidden card leaves its scores unchanged (" + Array.from(s1).map((v) => (v === Infinity ? "x" : +v.toFixed(2))).join(" ") + ")");
  // Every stored debug order wins patiently on its difficulty, holds no refused tap and keeps to the tap cap.
  let good = 0;
  for (const D of DEBUG) for (const d of ["easy", "normal", "hard"]) {
    const T = E.sim(E.compile(D), RULES[d]); let ref = 0; for (const ch of D.win[d]) { if (T.play(+ch) === E.REFUSED) ref++; T.quiet(); }
    if (T.status === E.WON && !ref && D.win[d].length <= 55 && !E.check(D).length) good++; else console.log("FAIL  " + D.id + " " + d);
  }
  eq([good, DEBUG.length >= 4, ["v4-mystery", "v4-linked", "v4-locked", "v4-all"].every((id) => DEBUG.some((D) => D.id === id))], [DEBUG.length * 3, true, true], "debug levels: one per twist and one with all three; every stored order wins on its difficulty with no refused tap and 55 taps or fewer");
  const lk = DEBUG.find((l) => l.id === "v4-linked"), LB = E.compile(lk);
  ok(Gr.solve(LB, N, 50000) && Gr.rate(LB, N, 40, 3) >= 0 && Gr.greedy(LB, N, 20, 3) >= 0, "grader: rate, greedy and solve finish on a linked level (legal taps only)");
  const fr = [Gr.fast(E.compile(LEVELS.levels[60]), N, 30, 9, 0), Gr.fast(LB, N, 30, 9, 250)];
  ok(fr.every((x) => x >= 0 && x <= 1), "grader: the fast tapper finishes on a baked level and a linked one (" + fr.join(", ") + ")");
}

// ---- the page's save (v4 M1 settings: speed replaces the 2x flag, colour-blind marks) ----------------------------------
{
  const Save = require("../src/save.js"), order = LEVELS.levels.map((l) => l.id), set = (raw) => Save.sanitize({ settings: raw }, order).settings;
  eq(Save.fresh().settings, { muted: false, speed: 1, cb: false, diff: "normal" }, "save: a fresh save plays at 1x with colour-blind marks off");
  eq([set({ speed: 3, cb: true }).speed, set({ speed: 3, cb: true }).cb], [3, true], "save: speed 3 and colour-blind on load as saved");
  eq([set({ fast: true }).speed, set({ fast: false }).speed, set({ speed: 2.5 }).speed, set({ speed: 9 }).speed, set({ speed: "3" }).speed], [2, 1, 1, 1, 1], "save: the old 2x flag loads as 2; a bad speed loads as 1");
  eq([set({ cb: "yes" }).cb, set({ cb: 1 }).cb, set({}).cb], [false, false, false], "save: colour-blind is on only for a strict true");
  // v4 M3: a v3 save (level ids e1-01 .. e3-75, the ids the rebake keeps: era and number) loads against the 100-level file:
  // every win is kept by id, level 76 (Era 4's opener) opens next, and a win recorded past the first gap is still dropped.
  const old = { v: 1, done: {}, settings: { muted: true, speed: 2, cb: false, diff: "hard" }, last: "e3-75" };
  for (let n = 1; n <= 75; n++) old.done["e" + (n <= 25 ? 1 : n <= 50 ? 2 : 3) + "-" + String(n).padStart(2, "0")] = n % 3 ? 2 : 7;
  const sv = Save.sanitize(JSON.parse(JSON.stringify(old)), order);
  eq([Object.keys(sv.done).length, sv.done["e3-75"], Save.next(sv, order), Save.isOpen(sv, order, "e4-76"), Save.isOpen(sv, order, "e4-77"), sv.last, sv.settings.diff], [75, 7, "e4-76", true, false, "e3-75", "hard"], "save: a v3 save with 75 wins loads against the rebake: 75 kept, level 76 next and open, 77 locked");
  const gap = JSON.parse(JSON.stringify(old)); delete gap.done["e2-40"]; const sg = Save.sanitize(gap, order);
  eq([Object.keys(sg.done).length, Save.next(sg, order)], [39, "e2-40"], "save: a gap in an old save still drops every later win (levels open in order)");
}

console.log(pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
