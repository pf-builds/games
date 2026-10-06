// Sapper's Path v3 node checks: the rules engine (SPEC-v3 §2-4, §9; the dispatch model from playtest 1) on hand-made
// boards with known answers, then a differential run of the engine against the slow reference (tools/ref.js) on every
// baked level, patient and rushed, and the stored winning orders on every difficulty, played patiently; v4 M2's twists
// (mystery cards, linked squads, the locked space, the generalized jam, dealing mode) on hand-made boards, a no-hang
// sweep and a second differential on the debug levels and on baked levels with random twists injected, the grader's
// info model and the fast tapper; last, the page save's settings (v4 M1: speed and colour-blind marks) through sanitize.
// v4.1: picture boards entered from the bottom (compile, known answers, a moat, the outline, engine vs reference on random
// picture boards; v4 M4's ring levels are retired), the Gallery converter on a tiny hand image, the Gallery file's invariants and engine vs reference on its boards, the save's Gallery wins.
// v4 M5: the power-ups (Ladder, Quartermaster, Scout, Recall) on hand-made boards with known answers, their refusals and
// limits, colour balance, identical play when none is used, and engine vs reference with random power-ups mixed in.
// Run: ~/.local/opt/node/bin/node tools/test.js   (exit code 1 on any failure)
"use strict";
const E = require("../src/engine.js");
const Ref = require("./ref.js");
const Gr = require("./grade.js");
const V3 = require("../config.json").v3;
// Lands foundation: LEVELS is the castle campaign (1-200: levels without a land); the lands past it are checked in
// their own section at the end, and so are the side quests and map sheets they add.
const LEVELS_ALL = require("../levels/levels.json"), LEVELS = Object.assign({}, LEVELS_ALL, { levels: LEVELS_ALL.levels.filter((l) => !l.land) });
const castleGal = () => require("../levels/gallery.json").levels.filter((l) => !l.land), castleLay = () => { const L = require("../map/layout.json"); return Object.assign({}, L, { sheets: L.sheets.filter((S) => !S.land) }); };

let pass = 0, fail = 0;
// v5 R1: checks that replay the shipped levels' stored orders and grades, or hold them to the v5 placement rules, wait for
// R2's re-lay (config.json v5.relaid). Until then they are listed as DEFERRED, not run.
const V5 = require("../config.json").v5, deferred = [];
const defer = (name, fn) => { if (V5.relaid) fn(); else deferred.push(name); };
function ok(cond, name) { if (cond) pass++; else { fail++; console.log("FAIL  " + name); } }
function eq(a, b, name) { const A = JSON.stringify(a), B = JSON.stringify(b); ok(A === B, name + (A === B ? "" : "\n      got " + A + "\n     want " + B)); }
function throws(fn, name) { let t = false; try { fn(); } catch (e) { t = true; } ok(t, name); }
const RULES = { easy: E.rulesOf(V3, "easy"), normal: E.rulesOf(V3, "normal"), hard: E.rulesOf(V3, "hard"), extreme: E.rulesOf(V3, "extreme") };
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
  // v4.3: a space frees exactly when its squad's last block is picked up (the pop); the carrier walks home after.
  const S = E.sim(E.compile(lv(["..a..", ".....", "..#.."], [[[1, 1]], [], [], [], []])), N);
  S.play(0, 0);
  const tiles = 2, popT = TM.yardMs + tiles * TM.tileMs + TM.biteMs, home = popT + TM.yardMs + tiles * TM.carryMs;
  S.advanceTo(popT - 1); eq([S.lineLen, S.pixLeft, S.status], [1, 1, E.PLAYING], "space: the sapper is still walking out, the space is held");
  S.advanceTo(popT); eq([S.lineLen, S.pixLeft, S.status, S.out, S.busy], [0, 0, E.WON, 1, true], "space (v4.3): the pixel pops at " + popT + " ms and the space frees at once, the carrier still out");
  S.advanceTo(home - 1); eq([S.out, S.busy], [1, true], "space (v4.3): the carrier walks home with its block; the game is not at rest");
  S.advanceTo(home); eq([S.out, S.busy], [0, false], "space (v4.3): home at " + home + " ms: nothing moves");
}
{
  // v4.3: the freed space takes the next squad while the first squad's carriers are still walking home, and their
  // homecoming never touches the new squad.
  const S = E.sim(E.compile(lv(["..a.b..", ".......", "...#..."], [[[1, 1]], [[2, 1]], [], [], []])), Object.assign({}, N, { hold: 1 }));
  S.play(0, 0); const popT = S.q1[0], home = S.q2[0];
  S.advanceTo(popT - 1); const r0 = S.refused(1); S.advanceTo(popT); const r1 = S.refused(1); S.play(1, popT);
  const sp = S.order()[0], before = [S.spW[sp], S.spO[sp]]; S.advanceTo(home); const after = [S.spW[sp], S.spO[sp]];
  eq([r0, r1, S.lineLen, before, after, S.status], [true, false, 1, [0, 1], [0, 1], E.PLAYING], "space (v4.3): with one space, b's tap is refused until a pops, then taken at once; a's carrier comes home without touching b's squad (still walking out)");
}
{
  // v4.3, archers on Easy and Normal: a hit sapper walking back keeps its squad's space held; on Hard a kill is done.
  const TW = [".......", ".b.aaa.", ".......", "...#..."], T0 = lv(TW, [[[1, 3]], [[2, 1]], [], [], []], { towers: [{ at: [1, 1], r: 3 }] });
  const S = E.sim(E.compile(T0), N); S.logOn = true; S.play(0, 0); let hid = -1;
  for (let g = 0; g < 400 && S.busy && hid < 0; g++) { S.advanceTo(S.nextAt); for (let e = 0; e < S.evLen; e += 3) if (S.ev[e] === E.EV.HIT) hid = S.ev[e + 1]; S.clearLog(); }
  const back = hid >= 0 ? S.q2[hid] : 0; S.advanceTo(back - 1); const heldBack = S.lineLen === 1; S.advanceTo(back); const rejoined = S.lineLen === 1 && S.spW[S.order()[0]] + S.spO[S.order()[0]] >= 1;
  ok(hid >= 0 && heldBack && rejoined, "space (v4.3): an arrow-hit sapper walks back and waits again; its squad's space stays held meanwhile (Normal)");
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
  // v5 R1: archers never kill. Every tag's rules (and a stale archersKill flag) knock the hit sapper back to wait.
  for (const [nm, R] of [["Hard", H], ["archersKill: true (ignored)", hold(4, true)]]) {
    const S = E.sim(E.compile(ARCH([[[1, 6]], [[7, 3]], [], [], []])), R);
    pat(S, 0); eq([S.hits, S.kills, S.status, line(S)], [1, 0, E.PLAYING, [[1, 2]]], "archers (v5 R1, " + nm + "): the hit sapper walks back and waits; nobody dies");
    eq(pat(S, 1), E.WON, "archers (v5 R1, " + nm + "): the tower falls and the wary squad finishes");
  }
  eq([H.hold, EZ.hold, N.hold, "archersKill" in H], [5, 5, 5, false], "rules (v5 R1): 5 spaces on every tag; no archersKill");
  const R = Ref.game(ARCH([[[1, 6]], [[7, 3]], [], [], []]), hold(4, true)); R.play(0); R.quiet();
  eq([R.hits, R.kills, R.status], [1, 0, "playing"], "archers (v5 R1, reference): never kill");
  // Dealing mode keeps every deal hit-free: any hit fails it ("hit").
  const D = E.sim(E.compile(ARCH([[], [], [], [], []])), N, { deal: true }); D.playSquad(1, 6); D.quiet();
  eq([D.status, D.reason], [E.FAILED, "hit"], "archers (dealing mode): a hit fails the deal");
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
    const d = L.tag; // v4.3: one fixed tag per level, one stored order on it
    total++; const S = E.replay(B, RULES[d] || RULES.normal, (L.win && L.win[d]) || "");
    if (S.status === E.WON && Object.keys(L.win).join() === d) wins++; else console.log("FAIL  level " + L.n + " " + d + ": stored order does not win patiently (" + S.reason + ")");
  }
  eq(wins, total, "levels: every level's one stored winning order wins patiently on its tag (" + total + " replays)");
  const NL = require("./bake-config.json").levels;
  eq([LEVELS.levels.length, LEVELS.levels.every((L, i) => L.n === i + 1)], [NL, true], "levels: " + NL + " levels baked, in order (v4 M3: the Siege to 100)");
  // v4 M3: every era present, Era 4 from 76; every stored Normal line inside the dead-time cap and the tap cap.
  const eras = [...new Set(LEVELS.levels.map((L) => L.era))], BC = require("./bake-config.json");
  eq(eras.join(","), "1,2,3,4,5,6,7,8", "levels (v5 R4): eight realms, The Mistmoor from 100, Emberwatch Crags 125, The Shrouded Weald 150, The Goblin King's Throne 175-200 (each level's era is its realm: the tags check)");
  let dead = 0, longest = 0; for (const L of LEVELS.levels) { const ln = Gr.line(E.compile(L), RULES[L.tag], L.win[L.tag]); longest = Math.max(longest, ln.maxWait); if (ln.maxWait > BC.maxWaitMs || L.win[L.tag].length > BC.maxTaps) dead++; }
  eq(dead, 0, "levels: every stored line (on its tag) keeps every tap under " + BC.maxWaitMs / 1000 + " s (longest " + (longest / 1000).toFixed(1) + " s) and " + BC.maxTaps + " taps");
}

// ---- v4.1: every Siege level is a castle picture -------------------------------------------------------------------------
// A picture board (pic: the frame open ground, the entry square its bottom row's middle); a palette for every colour it
// shows (the gilt keys keep config's, the drawbridge may take its own); every pair of its card colours (gilt and the black
// outline included) apart by the picture minDE in CIEDE2000, plain and with one faded to a queue row (bake-config picture).
{
  const PAL = require("./palette.js"), PIC = require("./pic.js"), Q = require("./bake-config.json").picture, bad = []; let dmin = 99, fmin = 99, at = "";
  for (const L of LEVELS.levels) {
    const B = E.compile(L), used = new Set(); for (const row of L.grid) for (const ch of row) { const m = E.matOf(ch); if (m) used.add(m); }
    if (!B.pic || !L.pal) { bad.push(L.id + ": not a picture"); continue; }
    const cards = [...used].filter((m) => m !== E.IRON), hx = cards.map((m) => (m === E.GILT ? V3.mats[m].c : L.pal[m] && L.pal[m].c));
    if (hx.some((h) => !h) || Object.keys(L.pal).some((k) => !used.has(+k))) { bad.push(L.id + ": palette ids " + Object.keys(L.pal) + " vs " + [...used]); continue; }
    for (let a = 0; a < hx.length; a++) for (let b = a + 1; b < hx.length; b++) { const d = PIC.de(hx[a], hx[b]), f = PIC.fadeGap(hx[a], hx[b]); if (d < dmin) { dmin = d; at = L.id; } if (f < fmin) fmin = f; }
  }
  eq(bad, [], "pictures: every Siege level is a picture board with a palette for exactly its colours (gilt keys keep config's)");
  ok(dmin >= Q.minDE - 0.05 && fmin >= Q.fadeDE - 0.05, "pictures: every pair of a level's card colours is " + Q.minDE + " apart (smallest " + dmin.toFixed(1) + ", " + at + ") and " + Q.fadeDE + " apart with one faded to a queue row (smallest " + fmin.toFixed(1) + ")");
}

// v4.1 fix: within an era the castle pictures differ (tools/variety.js; bake-config variety): over every pair of an era's
// generated pictures, the median share of sampled picture cells whose colours match is variety.maxMedian or under.
{
  const VAR = require("./variety.js"), VC = require("./bake-config.json").variety, R = VAR.eraReport(LEVELS.levels, VC);
  ok(Object.keys(R).length === 8 && Object.values(R).every((v) => v.median <= VC.maxMedian), "variety: every era's median picture-cell match is " + VC.maxMedian + " or under (" + Object.keys(R).map((e) => "era " + e + " " + R[e].median).join(", ") + ")");
}

// ---- v4.2: full-screen boards from level 26, real pace ------------------------------------------------------------------
// Every generated level from duration.pace.from is its era's full-screen picture (bake-config eras[e].gen w x h, plus the
// frame); the real-pace replay (grade.pace) of a stored winning order wins, is no slower than patient play, and never taps
// sooner than thinkMs after the tap before.
{
  const BC = require("./bake-config.json"), PC = BC.duration.pace, R2 = require("./grade.js"), N2 = E.rulesOf(V3, "normal"), bad = [];
  for (const L of LEVELS.levels) { if (L.n < PC.from || L.source === "teaching") continue; const g = Object.assign({}, BC.eras[L.era].gen, L.n === BC.boss.n ? BC.boss.gen : {}, BC.bosses && BC.bosses[L.n] ? BC.bosses[L.n].gen : {}); if (L.w !== g.w[1] + 2 || L.h !== g.h[1] + 2) bad.push(L.id + " " + L.w + "x" + L.h); }
  eq(bad, [], "v4.2: every generated level from " + PC.from + " is its era's full-screen board (" + (BC.eras[4].gen.w[1] + 2) + "x" + (BC.eras[4].gen.h[1] + 2) + ")");
  const L = LEVELS.levels.find((l) => l.n >= PC.from && l.source !== "teaching" && l.tag === "normal"), B = E.compile(L), o = L.win.normal, p0 = R2.pace(B, N2, o, 0), pl = R2.line(B, N2, o), pt = R2.pace(B, N2, o, 20000);
  ok(p0.won && p0.taps === o.length && p0.ms <= pl.ms, "pace: " + L.id + "'s stored Normal order replayed at real pace wins in " + o.length + " taps, no slower than patient play (" + p0.ms + " <= " + pl.ms + " ms)");
  ok(pt.won && pt.ms >= (o.length - 1) * 20000, "pace: with 20 s to think before each tap the replay takes at least " + (o.length - 1) + " x 20 s (" + pt.ms + " ms)");
  ok(L.grade.normal.pace && L.grade.normal.pace.ms === Math.round(p0.ms * PC.factor), "pace: the stored real pace is the replay times " + PC.factor);
  // v4.3: every level's real pace on its own tag; a Hard level whose archers stand was dealt rushed, so its stored order
  // also wins at real pace (a Hard kill leaves its colour short).
  const lost = LEVELS.levels.filter((l) => l.n >= PC.from && l.grade[l.tag].pace && l.grade[l.tag].pace.fell).map((l) => l.id);
  const rushed = LEVELS.levels.filter((l) => l.rush); // v5 R2: rushHard is off (archers never kill), so no level is dealt rushed now
  eq([lost, rushed.filter((l) => !R2.pace(E.compile(l), RULES[l.tag], l.win[l.tag], 0).won).map((l) => l.id)], [[], []], "v4.3 pace: every level's stored order wins at real pace on its tag (" + rushed.length + " dealt rushed)");
}

// ---- v4.3: one fixed tag per level (tools/tags.js; bake-config tags, gallery-config bake.tags) ------------------------------
// v5 R2: the Siege's schedule runs per realm (bake-config tags.realms): every realm ends on a Hard level and opens with an
// Easy teaching level; tags follow feature density (config.json v5.density, tools/tags.js densityOK). Deferred until the
// re-lay ships (v5.relaid).
{
  const TG = require("./tags.js"), BC = require("./bake-config.json"), GB = require("./gallery-config.json").bake, GL = castleGal(), DN = V5.density;
  const mix = (ls) => TG.TAGS.map((t) => ls.filter((l) => l.tag === t).length);
  defer("tags: the realm schedule, the mix, realm ends and openers, density", () => {
    eq([LEVELS.levels.every((l) => l.tag === TG.tagOf(l.n, BC.tags, l.source === "teaching")), GL.every((l) => l.tag === TG.tagOf(l.n, GB.tags, false))], [true, true], "tags: every level carries its schedule's tag");
    const [e, n, h] = mix(LEVELS.levels.slice(0, 100)), [ge, gn, gh] = mix(GL); // v5 R4: the 1-100 mix as shipped (101-200 below)
    ok(Math.abs(e / 100 - 0.15) <= 0.03 && Math.abs(n / 100 - 0.6) <= 0.03 && Math.abs(h / 100 - 0.25) <= 0.03 && Math.abs(ge / 60 - 0.15) <= 0.05 && Math.abs(gn / 60 - 0.6) <= 0.05 && Math.abs(gh / 60 - 0.25) <= 0.05,
      "tags: the mix is about 15% Easy, 60% Normal, 25% Hard (Siege " + [e, n, h].join("/") + ", Gallery " + [ge, gn, gh].join("/") + ")");
    const R = BC.tags.realms.filter((r) => r[0] <= LEVELS.levels.length), ends = R.filter((r) => r[1] <= LEVELS.levels.length).map((r) => LEVELS.levels[r[1] - 1].tag), opens = R.filter((r) => r[0] > 1 && r[0] <= 150).map((r) => LEVELS.levels[r[0] - 1]); // v5 R4: 175 opens on the cycle (no new feature)
    const hards = LEVELS.levels.filter((l) => l.tag === "hard" || l.tag === "extreme").map((l) => l.n), gaps = hards.slice(1).map((x, i) => x - hards[i]).filter((g) => g > 1);
    eq([ends.every((t) => t === "hard" || t === "extreme"), opens.every((l) => l.tag === "easy" && l.source === "teaching"), LEVELS.levels.filter((l) => l.source === "teaching").every((l) => l.tag !== "hard"), Math.max(...gaps) <= 6, LEVELS.levels.every((l) => l.era === BC.tags.realms.findIndex((r) => l.n >= r[0] && l.n <= r[1]) + 1)],
      [true, true, true, true, true], "tags: every realm ends on a Hard (from 149 Extreme) level and opens with an Easy teaching level (to 150); teaching levels are Easy or Normal; Hard or Extreme comes every 3-6 levels (longest gap " + Math.max(...gaps) + "); each level's era is its realm");
    const bad = LEVELS.levels.filter((l) => !TG.densityOK(l.n, l.tag, l, DN, l.source === "teaching")).map((l) => l.n + " " + l.tag + " [" + TG.featuresOf(l).join(",") + (l.lock ? ",lock" : "") + "]");
    eq(bad, [], "density (v5 R2): no feature before its milestone; Easy uses at most " + DN.easyMax + ", Normal at least " + DN.normalMin + " (once unlocked), Hard every unlocked feature and from " + DN.lockFrom + " the lock (v5 R4: from " + DN.extremeFrom + " all but " + DN.hardSlack + "), Extreme every one and the lock; teaching levels use their lesson");
    // v5 R4: levels 101-200 by realm: the ladder's features arrive at their milestones (towers 125, mystery blocks 150) and
    // every realm uses them; Extreme only from 125; a couple of Easy breathers a realm; 200 is the boss, Extreme.
    const rs = [[101, 124], [125, 149], [150, 174], [175, 200]].map(([a, b]) => LEVELS.levels.filter((l) => l.n >= a && l.n <= b)), cnt = (ls, t) => ls.filter((l) => l.tag === t).length, use = (ls, k) => ls.filter((l) => TG.featuresOf(l).indexOf(k) >= 0).map((l) => l.n);
    eq([use(rs[0], "tower").length, use(rs[0].concat(rs[1]), "hidden").length, cnt(rs[0], "extreme"), rs.map((ls) => cnt(ls, "easy") >= 2), use(rs[1], "tower").length > 12, use(rs[2], "hidden").length > 12, use(rs[3], "hidden").length > 12, use(rs[3], "tower").length > 12, rs.slice(1).map((ls) => cnt(ls, "extreme") >= 3), LEVELS.levels[199].tag],
      [0, 0, 0, [true, true, true, true], true, true, true, true, [true, true, true], "extreme"], "density (v5 R4): no tower before 125, no mystery block before 150, no Extreme before 125; 2+ Easy a realm; towers and mystery blocks used through their realms; 3+ Extreme a realm from 125; 200 Extreme (mixes " + rs.map((ls) => TG.TAGS.map((t) => cnt(ls, t)).join("/")).join(", ") + ")");
    // v5 R4: the two new lessons, Easy, with their coach (config.json teach): 125 towers (the coach card is the tower's
    // colour, then the Volley's badge), 150 mystery blocks.
    const T1 = LEVELS.levels[124], T2 = LEVELS.levels[149], CT = require("../config.json").teach, c1 = CT[T1.id] || [], c2 = CT[T2.id] || [];
    eq([T1.id, T1.source, T1.teaches, T1.tag, c1.length > 1 && c1[0].card === E.compile(T1).towers[0].m && c1[0].ring === "tower", c1.some((s) => s.power === "volley"), T2.id, T2.source, T2.teaches, T2.tag, c2.length > 1, TG.featuresOf(T2).indexOf("hidden") >= 0 && E.compile(T2).nhid > 0],
      ["e6-125", "teaching", "tower", "easy", true, true, "e7-150", "teaching", "hidden", "easy", true, true], "teaching (v5 R4): 125 teaches archer towers (coach card the tower's colour, its ring, then the Volley's badge) and 150 mystery blocks, both Easy");
    // v5 R4 fix (the critics' S1-S6): the Mistmoor's moats are still mire and its scenes have no sun; realm 5 and realm 8
    // boards come from five families each; realm 8's mystery blocks keep off the sky, clouds, outline, gold, banners and
    // red roofs, none in a group over plan.hidden.maxGroup; every archer tower's colour is 25+ CIEDE2000 from the water and
    // the lava; 200 is the boss: its config moment, the king drawn in its hall and its intro ring on his face.
    const PIC2 = require("./pic.js"), Q2 = BC.picture, HB = BC.plan.hidden, fam = (ls) => [...new Set(ls.map((l) => (l.style || "").replace(/^narrow-/, "").replace(/[0-9]*-.*$/, "").replace(/[0-9]+$/, "")))].sort();
    const r5 = rs[0].filter((l) => l.source !== "teaching"), r8 = rs[3], wet5 = r5.filter((l) => l.grid.some((r) => r.indexOf("~") >= 0));
    const hidBad = []; for (const L of r8) if (L.hidden) { const B = E.compile(L), w = B.w, seen = new Uint8Array(B.n);
      for (let c = 0; c < B.n; c++) { if (B.hid0[c] && HB.skip.indexOf(L.pal[B.a0[c]].r) >= 0) hidBad.push(L.n + " role " + L.pal[B.a0[c]].r);
        if (!B.hid0[c] || seen[c]) continue; let k = 0; const st = [c]; seen[c] = 1; while (st.length) { const q = st.pop(); k++; for (const e of [q - 1, q + 1, q - w, q + w]) if (e >= 0 && e < B.n && Math.abs((e % w) - (q % w)) <= 1 && B.hid0[e] && !seen[e]) { seen[e] = 1; st.push(e); } } if (k > HB.maxGroup) hidBad.push(L.n + " group " + k); } }
    let twMin = 99; for (const L of LEVELS.levels) if (L.n >= 125 && L.towers && L.towers.length) for (const k of Object.keys(L.pal)) if (L.pal[k].r === "slate") for (const wc of [Q2.show.water, Q2.show.lava]) twMin = Math.min(twMin, PIC2.de(L.pal[k].c, wc));
    const BL = LEVELS.levels[199], BS = (require("../config.json").boss || {})[BL.id], BT = CT[BL.id] || [], ring = BT[0] && BT[0].ring, rc = Array.isArray(ring) ? E.matOf(BL.grid[ring[1]][ring[0]]) : 0;
    eq([wet5.every((l) => l.liquid === "mire"), ["fen", "fenDusk", "fenNight"].every((k) => !!(Q2.scenes[k] && Q2.scenes[k].n.sky.indexOf("fog") >= 0)), fam(r5).length >= 4, fam(r8).length >= 4, hidBad.slice(0, 4), twMin >= 25,
      !!BS && !!BS.name && !!BS.win, /king/.test(BL.style), Array.isArray(ring) && !!BL.pal[rc] && BL.pal[rc].r === "banner"],
      [true, true, true, true, [], true, true, true, true], "realms (v5 R4 fix): Mistmoor moats are mire under fog skies; realm 5 families " + fam(r5).join("/") + ", realm 8 " + fam(r8).join("/") + "; realm 8 mystery blocks off the sky, outline and colours, groups of " + HB.maxGroup + " at most; towers " + twMin.toFixed(1) + "+ ΔE00 from water and lava; 200 the boss (name, the king in his hall, the intro ring on his face)");
  });
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
  // a (column 0's front) is linked to b, third in column 1 behind c and a hidden d; e sits behind b. v4.3: a linked card
  // goes only when its partner is a front card too.
  const L = lv(ROW6, [[[1, 1]], [[3, 1], [4, 1, 1], [2, 1], [5, 1]], [[6, 1]], [], []], { links: [[[0, 0], [1, 2]]] });
  const S = E.sim(E.compile(L), N); S.logOn = true;
  eq([S.partner(0), S.partner(3), S.card(1, 2), S.refused(0), S.why(0), S.refused(1)], [3, 0, 3, true, 3, false], "link (v4.3): a and b (column 1, third card) are partners; b is buried, so a's tap is refused (why 3), c's is legal");
  const b0 = S.save(); eq([S.play(0), same(b0, S.save())], [E.REFUSED, true], "link (v4.3): play() on a returns REFUSED and changes nothing");
  pat(S, 1); pat(S, 1); eq([S.card(1, 0), S.refused(0), S.why(0)], [3, false, 0], "link (v4.3): c and d played, b is column 1's front: a's tap is legal");
  S.clearLog(); const r = S.play(0);
  eq([r, S.lineLen, S.plays, evs(S, E.EV.TAP), evs(S, E.EV.LINK)], [E.PLAYING, 2, 3, [[0, 1], [1, 2]], [[0, 1]]], "link: one tap takes two spaces at the same moment: the tapped squad first (space 0), then its partner (space 1); one play");
  eq([S.card(1, 0), S.card(1, 1), S.gone[3]], [4, -1, 1], "link: the partner leaves the front of its column, e moves up");
  const disp = evs(S, E.EV.DISP).map(([id]) => [S.qS[id], S.q0[id] - S.now]);
  eq(disp, [[0, 0], [1, 0]], "link: both squads go out together (each dispatches at once for its own colour)");
  S.quiet(); eq([S.status, S.lineLen, S.pixLeft], [E.PLAYING, 0, 2], "link: both pixels pop; both spaces free");
  // A hidden partner: refused while it is behind the front; at the front it is face up, and the pair goes.
  const H2 = E.sim(E.compile(lv(ROW6, [[[1, 1]], [[3, 1], [2, 1, 1], [5, 1]], [[6, 1]], [], []], { links: [[[0, 0], [1, 1]]] })), N); H2.logOn = true;
  eq([H2.hidden(2), H2.why(0)], [true, 3], "link (v4.3): a hidden partner behind the front: the linked tap is refused (why 3)");
  pat(H2, 1); eq([H2.hidden(2), H2.why(0), evs(H2, E.EV.REVEAL)], [false, 0, [[2, 1]]], "link (v4.3): the partner reaches the front, face up (REVEAL), and the linked tap is legal");
  // The partner at the front of its column: that column's head moves on (and reveals a mystery card behind it).
  const F2 = E.sim(E.compile(lv(ROW6, [[[1, 1]], [[2, 1], [3, 1, 1]], [], [], []], { links: [[[0, 0], [1, 0]]] })), N); F2.logOn = true;
  F2.play(0); eq([F2.heads[0], F2.heads[1], F2.card(1, 0), F2.hidden(2), evs(F2, E.EV.REVEAL)], [1, 1, 2, false, [[2, 1]]], "link: a partner at its column's front: both columns move on; the new front is revealed");
  // Tapped from the other side once both are fronts: column 1's front takes column 0's front with it.
  const O2 = E.sim(E.compile(lv(ROW6, [[[1, 1], [2, 1]], [[3, 1]], [], [], []], { links: [[[0, 1], [1, 0]]] })), N);
  const o1 = O2.why(1); pat(O2, 0); O2.play(1); eq([o1, O2.heads[0], O2.card(0, 0), O2.lineLen, O2.order().map((s) => O2.spM[s])], [3, 2, -1, 2, [3, 2]], "link (v4.3): column 1's front waits for its partner (second in column 0) to reach the front; then one tap from either side sends both");
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
  // v4.3, a linked jam: a (column 0's front) is linked to d behind c, and c (column 1's front) to b behind a. Once column
  // 2 is played out, both fronts wait for a buried partner: at rest that is the jam, jamWhy bit 4 (a buried partner; bit
  // 1 too, since spaces are free). No state hangs.
  const X = lv(ROW6, [[[1, 1], [2, 1]], [[3, 1], [4, 1]], [[5, 1], [6, 1]], [], []], { links: [[[0, 0], [1, 1]], [[1, 0], [0, 1]]] });
  const XS = E.sim(E.compile(X), hold(2)); eq([XS.why(0), XS.why(1), XS.refused(2)], [3, 3, false], "jam (v4.3): both linked fronts wait for a buried partner (why 3); column 2 is legal");
  pat(XS, 2); pat(XS, 2); eq([XS.status, XS.reason, XS.jamWhy], [E.FAILED, "jam", 5], "jam (v4.3): column 2 played out, every front waits for a buried partner: jam, jamWhy 5 (4 a buried partner, 1 a space free)");
  const XR = Ref.game(X, hold(2)); XR.play(2); XR.quiet(); XR.play(2); XR.quiet(); eq([XR.status, XR.reason, XR.jamWhy], ["failed", "jam", 5], "jam (v4.3): the reference rules agree");
}
{
  // Coupled freeing (v4.3: at pickup): a's pixel is near the camp, b's far. The pair goes; a's block is picked up first
  // but its space holds (held) until b's is; then both free at that moment, the earlier-placed space first.
  const L = lv(["b.......", "........", "........", ".....a..", "........", "...##..."], [[[1, 1]], [[2, 1]], [], [], []], { links: [[[0, 0], [1, 0]]] });
  const S = E.sim(E.compile(L), N); S.logOn = true; S.play(0, 0);
  const ia = [0, 1].find((id) => S.qS[id] === 0), ib = 1 - ia, ta = S.q1[ia], tb = S.q1[ib];
  ok(ta < tb, "coupled: a's block is picked up before b's (" + ta + " < " + tb + " ms)");
  S.advanceTo(ta); eq([S.lineLen, S.held(0), S.stuck(0), S.held(1)], [2, true, false, false], "coupled: a is finished (its block picked up), but its space holds for its partner (held, not stuck)");
  S.clearLog(); S.advanceTo(tb - 1); eq([S.lineLen, evs(S, E.EV.FREE)], [2, []], "coupled: nothing frees while b is still walking out");
  S.advanceTo(tb); eq([S.lineLen, evs(S, E.EV.FREE), S.busy], [0, [[0, 1], [1, 2]], true], "coupled (v4.3): b's block picked up: both spaces free at that moment, space 0 then space 1, the carriers still walking home");
}
{
  // v5 R1 (was: coupled freeing with a Hard kill). g (tower, 3) is linked to a (1); both a pixels sit in the tower's ring,
  // so a's one sapper is hit on the way and walks back: a is not finished, so neither space frees until the tower is down.
  const L = lv(["......ggg", ".........", "......aa.", ".........", "....##..."], [[[7, 3]], [[1, 1]], [[1, 2]], [], []], { towers: [{ at: [7, 0], r: 3 }], links: [[[0, 0], [1, 0]]] });
  const S = E.sim(E.compile(L), H); S.play(0, 0); S.advanceTo(600);
  eq([S.hits, S.kills, S.status, S.lineLen, S.held(1)], [1, 0, E.PLAYING, 2, false], "coupled (v5 R1): a's sapper is hit, not killed; a still has a sapper, so it holds its space working");
  S.quiet(); eq([S.lineLen, S.standing, S.status], [0, 0, E.PLAYING], "coupled (v5 R1): the tower falls, a finishes: both spaces free");
  eq(pat(S, 2), E.WON, "coupled (v5 R1): the spare a squad finishes");
}

// ---- the locked space ------------------------------------------------------------------------------------------------------
{
  const L = lv(["abn...", "......", "..##.."], [[[1, 1]], [[2, 1]], [[14, 1]], [], []], { lock: { key: [2, 0] } });
  const B = E.compile(L);
  eq(["easy", "normal", "hard"].map((d) => { const S = E.sim(B, RULES[d]); return [S.cap, S.open, S.locked]; }), [[5, 4, 1], [5, 4, 1], [5, 4, 1]], "lock (v5 R1): 4 of 5 spaces open on every tag");
  eq(E.sim(E.compile(lv(L.grid, L.cols)), N).open, 5, "lock: the same board without a lock opens every space");
  const S = E.sim(B, N); S.logOn = true; S.play(2, 0);
  const pop = S.q1[0];
  S.advanceTo(pop - 1); eq([S.open, S.locked], [4, 1], "lock: shut until its key pops");
  S.clearLog(); S.advanceTo(pop); eq([S.open, S.locked, evs(S, E.EV.UNLOCK)], [5, 0, [[2, 0]]], "lock: the key pops and the space opens at that moment (UNLOCK)");
  // Unlocking can let a waiting tap through at once: two spaces, one locked; the Looters out; a tap is refused until
  // the key pops, then taken while the Looters are still carrying it home.
  const U = E.sim(B, hold(2)); U.play(2, 0); U.advanceTo(10);
  eq([U.open, U.play(0)], [1, E.REFUSED], "lock: one open space, taken: a second tap is refused");
  U.advanceTo(pop); eq([U.open, U.play(0), U.lineLen, U.out > 0], [2, E.PLAYING, 1, true], "lock: the key pops: the lock opens and (v4.3) the Looters' space frees at once; the tap is taken before the Looters are home");
  // A squad never takes a locked space; a line full but for the locked space at rest is a jam (jamWhy 2).
  const J = E.sim(E.compile(lv(["abn...", "......", "..##.."], [[[4, 1]], [[5, 1]], [[14, 1]], [], []], { lock: { key: [2, 0] } })), hold(3));
  pat(J, 0); pat(J, 1);
  eq([J.status, J.reason, J.jamWhy, J.spQ[2], J.lineLen, J.open], [E.FAILED, "jam", 2, 0, 2, 2], "lock: two stuck squads fill the two open spaces; the locked one stays empty; jam, jamWhy 2");
}

// ---- v5 R1: the colour lock -----------------------------------------------------------------------------------------------
{
  throws(() => E.compile(lv(["abn...", "......", "..##.."], [[[1, 1]], [[2, 1]], [[14, 1]], [], []], { lock: { key: [2, 0], colour: 1 } })), "colour lock: a key and a colour throws");
  throws(() => E.compile(lv(["abn...", "......", "..##.."], [[[1, 1]], [[2, 1]], [[14, 1]], [], []], { lock: { colour: 3 } })), "colour lock: a colour with no card throws");
  throws(() => E.compile(lv(["abn...", "......", "..##.."], [[[1, 1]], [[2, 1]], [[14, 1]], [], []], { lock: { colour: 10 } })), "colour lock: iron throws");
  throws(() => E.compile(lv(["abn...", "......", "..##.."], [[[1, 1]], [[2, 1]], [[14, 1]], [], []], { lock: {} })), "colour lock: neither key nor colour throws");
  // Three open-ground colours, b locked: 3 spaces, 2 open. a and c take the two; b is refused (no open space). Once a's
  // space frees, b's tap takes a space and the lock opens at that tap (UNLOCK -1 2, after the TAP).
  const L = lv(["abc...", "......", "..##.."], [[[1, 1]], [[2, 1]], [[3, 1]], [], []], { lock: { colour: 2 } }), B = E.compile(L);
  const S = E.sim(B, hold(3)); S.logOn = true;
  eq([S.cap, S.open, S.locked, S.lockMat], [3, 2, 1, 2], "colour lock: 2 of 3 spaces open, locked for colour 2");
  S.play(0, 0); S.play(2, 0); eq([S.play(1, 0), S.locked], [E.REFUSED, 1], "colour lock: no open space: the b tap is refused and the lock holds");
  S.advanceTo(S.q1[0]); S.clearLog(); eq(S.play(1), E.PLAYING, "colour lock: a space frees; the b tap is taken");
  const typ = []; for (let i = 0; i < S.evLen; i += 3) typ.push(S.ev[i]);
  eq([S.open, S.locked, evs(S, E.EV.UNLOCK), typ.indexOf(E.EV.TAP) < typ.indexOf(E.EV.UNLOCK)], [3, 0, [[-1, 2]], true], "colour lock: opens the moment the b squad takes a space (UNLOCK -1 2 after the TAP)");
  eq(pat(S, 0), E.WON, "colour lock: the level plays on and wins");
  // A linked pair whose partner is the lock's colour opens it (after LINK).
  const P = E.sim(E.compile(Object.assign({}, L, { links: [[[0, 0], [1, 0]]] })), hold(3)); P.logOn = true; P.play(0, 0);
  const t2 = []; for (let i = 0; i < P.evLen; i += 3) t2.push(P.ev[i]);
  eq([P.locked, P.open, t2.indexOf(E.EV.LINK) < t2.indexOf(E.EV.UNLOCK)], [0, 3, true], "colour lock: a pair whose partner is colour 2 opens it, after LINK");
  // The reference agrees.
  const R = Ref.game(L, hold(3)); R.play(0, 0); R.play(2, 0); const r1 = R.play(1, 0); R.advanceTo(S.q1[0]); R.play(1);
  eq([r1, R.locked, R.open], ["refused", 0, 3], "colour lock (reference): refused while full, opens on the b squad");
  // A key lock at rest that nothing can open jams with jamWhy 2; so does a colour lock whose colour waits behind.
  const J = E.sim(E.compile(lv(["aab...", "......", "..##.."], [[[4, 1], [2, 1]], [[5, 1]], [[1, 2]], [], []], { lock: { colour: 2 } })), hold(3));
  pat(J, 0); pat(J, 1);
  eq([J.status, J.reason, J.jamWhy & 2], [E.FAILED, "jam", 2], "colour lock: two stuck squads fill the open spaces, b waits behind one: jam, jamWhy 2");
}

// v5 R1: locks only on Hard (and Extreme) levels from level 50 (config v5.locks, tools/tags.js lockOK).
{
  const TG = require("./tags.js"), K = V5.locks, Lk = { lock: { colour: 1 } };
  eq([TG.lockOK(49, "hard", Lk, K), TG.lockOK(50, "hard", Lk, K), TG.lockOK(60, "normal", Lk, K), TG.lockOK(60, "extreme", Lk, K), TG.lockOK(10, "easy", {}, K)], [false, true, false, true, true], "locks (v5 R1): from level 50, on Hard and Extreme only");
  defer("every shipped lock is on a Hard or Extreme level from 50", () => { const bad = LEVELS.levels.filter((l) => !TG.lockOK(l.n, l.tag, l, K)).map((l) => l.n); eq(bad, [], "locks (v5 R1): every shipped lock is on a Hard or Extreme level from 50"); });
  // v5 R2: the realm schedule and the density rule on known cases.
  const T5 = require("./bake-config.json").tags, tg = (n, t) => TG.tagOf(n, T5, !!t), D5 = V5.density;
  eq([tg(1, 1), tg(4), tg(6), tg(11), tg(24), tg(25, 1), tg(26), tg(28), tg(33), tg(49), tg(50, 1), tg(53), tg(99), tg(100, 1)], ["easy", "normal", "hard", "easy", "hard", "easy", "normal", "hard", "easy", "hard", "easy", "hard", "hard", "easy"],
    "tags (v5 R2): realm 1 keeps v4.3's cycle; each realm opens with an Easy lesson, restarts the cycle and ends Hard");
  const bd = (rows, ex) => Object.assign({ grid: rows, cols: [[[1, 1]], [], [], [], []] }, ex || {}), moat = bd(["~~", ",,"]), gate = bd(["~j", ",,"], { gates: [{ at: [1, 0], key: [0, 1] }] });
  eq([TG.featuresOf(bd([",,"])), TG.featuresOf(gate), TG.featuresOf(bd(["~~"], { links: [[[0, 0], [1, 0]]], cols: [[[1, 1, 1]], [], [], [], []] })), TG.unlockedAt(60, D5)], [[], ["moat", "gate"], ["moat", "linked", "mystery"], ["moat", "gate"]], "density (v5 R2): features read from the level; the ladder's features by level");
  eq([TG.densityOK(10, "hard", bd([",,"]), D5), TG.densityOK(20, "easy", moat, D5), TG.densityOK(30, "hard", moat, D5), TG.densityOK(30, "normal", gate, D5), TG.densityOK(60, "easy", moat, D5), TG.densityOK(60, "easy", gate, D5),
    TG.densityOK(60, "normal", gate, D5), TG.densityOK(60, "hard", gate, D5), TG.densityOK(60, "hard", Object.assign({}, gate, { lock: { colour: 1 } }), D5), TG.densityOK(60, "normal", Object.assign({}, gate, { lock: { colour: 1 } }), D5), TG.densityOK(50, "easy", gate, D5, true)],
    [true, false, true, false, true, false, true, false, true, false, true], "density (v5 R2): nothing before its milestone; Easy at most one; Normal two once unlocked; Hard every one and the lock from 50; a lesson may keep older features");
}

// ---- v5 R1: the continue on a jam ----------------------------------------------------------------------------------------
{
  // b (5 pixels in a row at y 2, x 2-6) inside an a ring; the camp at (4,5). One space: the b squad of 2 is stuck, so the
  // line jams. The continue removes its 2 b pixels nearest the entry: (4,2) (d2 36), then (3,2) (d2 40, ties (5,2) and
  // goes first on the lower x), and frees the space. The next b squad (3) jams again; a second continue is refused.
  const G = [".........", ".aaaaaaa.", ".abbbbba.", ".aaaaaaa.", ".........", "....#...."];
  const C1 = Object.assign({}, hold(1), { continues: 1 }), L = lv(G, [[[2, 2], [2, 3], [1, 16]], [], [], [], []]), B = E.compile(L);
  const S = E.sim(B, C1); S.logOn = true;
  eq([S.canRevive(), S.revive()], [false, E.NOPLAY], "continue: nothing to continue while playing");
  pat(S, 0); eq([S.status, S.reason, S.canRevive()], [E.FAILED, "jam", true], "continue: one stuck b squad jams the one space; a continue is offered");
  const buf = S.save(); eq(E.sim(B, hold(1)).canRevive(), false, "continue: rules without continues allow none");
  S.clearLog(); eq(S.revive(), E.PLAYING, "continue: taken; play resumes");
  eq([evs(S, E.EV.CONT), evs(S, E.EV.CLEAR).map(([c, m]) => [xy(B, c), m]), evs(S, E.EV.FREE), S.lineLen, S.pixLeft, S.sappers(2), S.revived], [[[1, 0]], [[[4, 2], 2], [[3, 2], 2]], [[0, 2]], 0, 19, 3, 1], "continue: CONT, the 2 b pixels nearest the entry cleared ((4,2), then (3,2)), the space frees; b keeps 3 sappers for 3 pixels");
  pat(S, 0); eq([S.status, S.reason, S.canRevive(), S.revive()], [E.FAILED, "jam", false, E.REFUSED], "continue: the next jam gets none (one per attempt)");
  const S2 = E.sim(B, C1); pat(S2, 0); const b0 = S2.save(); S2.revive(); S2.load(b0);
  const R = Ref.game(L, C1); R.play(0); R.quiet(); eq([R.revive(), R.status, R.g[2 * 9 + 4], R.g[2 * 9 + 3], R.g[2 * 9 + 5]], [undefined, "playing", -2, -2, 2], "continue (reference): the same two pixels go");
  eq(same(buf, b0), true, "continue: the jam is the same state either way (determinism)");
  // A continue that would leave no front card to tap is refused, nothing changes: one space and the next front a linked
  // card (it needs 2).
  const J = E.sim(E.compile(lv(G, [[[2, 2], [1, 16]], [[1, 3]], [], [], []], { links: [[[0, 1], [1, 0]]] })), C1);
  pat(J, 0); const jb = J.save();
  eq([J.status, J.canRevive(), J.revive(), same(J.save(), jb)], [E.FAILED, false, E.REFUSED, true], "continue: refused when no front card could go afterwards (a linked front needs 2 spaces); nothing changes");
  // A full line of five stuck squads: one continue finishes all five (tap order), and the a ring is then won.
  const F = E.sim(E.compile(lv([".........", ".aaaaaaa.", ".abcdefa.", ".aaaaaaa.", "....#...."], [[[2, 1], [1, 16]], [[3, 1]], [[4, 1]], [[5, 1]], [[6, 1]]])), Object.assign({}, N, { continues: 1 }));
  for (const c of "12340") pat(F, +c); F.logOn = true; F.clearLog();
  eq([F.status, F.reason], [E.FAILED, "jam"], "continue: five stuck squads jam the line");
  F.revive(); eq([evs(F, E.EV.CLEAR).map(([c, m]) => m), F.lineLen, pat(F, 0)], [[3, 4, 5, 6, 2], 0, E.WON], "continue: every squad finishes in tap order (c, d, e, f, b), the line empties, and the level is won after");
}

// ---- v5 R1: mystery blocks (hidden board pixels) ---------------------------------------------------------------------------
{
  const G = [".......", ".aaaaa.", ".abbca.", ".aaaaa.", "...#..."], HID = [".......", ".?.?...", ".?.?...", ".......", "......."];
  throws(() => E.compile(lv(G, null, { hidden: ["?......", ".......", ".......", ".......", "......."] })), "mystery blocks: a ? on open ground throws");
  throws(() => E.compile(lv(G, null, { hidden: [".......", "......", ".......", ".......", "......."] })), "mystery blocks: a short row throws");
  throws(() => E.compile(lv(G, null, { hidden: [".......", ".x.....", ".......", ".......", "......."] })), "mystery blocks: anything but ? and . throws");
  throws(() => E.compile(lv(["......ggg", ".........", "aa.aa.aa.", ".........", "....##..."], null, { towers: [{ at: [7, 0], r: 3 }], hidden: ["......?..", ".........", ".........", ".........", "........."] })), "mystery blocks: a ? on a tower throws");
  // (1,1), (1,2) and (3,1) are ring a's touching the open ground around the ring: exposed from the start. (3,2), a b inside
  // the ring, is hidden. An a squad of 1 eats (3,3), the ring's cell nearest the camp: (3,2) touches the new ground and
  // shows (SHOW, after the EAT).
  const L = lv(G, [[[1, 1], [1, 11]], [[2, 2]], [[3, 1]], [], []], { hidden: HID }), B = E.compile(L), S = E.sim(B, N); S.logOn = true;
  eq([B.nhid, S.hiddenCell(1 * 7 + 1), S.hiddenCell(2 * 7 + 1), S.hiddenCell(1 * 7 + 3), S.hiddenCell(2 * 7 + 3), S.hiddenLeft], [4, false, false, false, true, 1], "mystery blocks: three touch open ground from the start (shown); the b inside is hidden");
  S.clearLog(); pat(S, 0); const typ = []; for (let i = 0; i < S.evLen; i += 3) typ.push(S.ev[i]);
  eq([evs(S, E.EV.EAT).map(([c]) => xy(B, c)), evs(S, E.EV.SHOW), S.hiddenCell(2 * 7 + 3), S.hiddenCell(1 * 7 + 3), typ.indexOf(E.EV.EAT) < typ.indexOf(E.EV.SHOW)], [[[3, 3]], [[17, 2]], false, false, true], "mystery blocks: eating (3,3) exposes the b at (3,2) (SHOW 17 2, after the EAT)");
  const R = Ref.game(L, N); const r0 = [R.hiddenCell(17), R.hiddenCell(10), R.hiddenCell(8)]; R.play(0); R.quiet();
  eq([r0, R.hiddenCell(17), R.hiddenCell(10)], [[true, false, false], false, false], "mystery blocks (reference): the same");
  // The picture's outer edge shows from the start (a pic board: x 1, y 1, x w-2, y h-2).
  const P = E.compile(lv([",,,,,,,", ",aaaaa,", ",abbba,", ",aaaaa,", ",,,#,,,"].map((r, y) => (y === 4 ? ",,###,," : r)), null, { pic: true, hidden: [".......", ".?.?...", "...?...", ".......", "......."] }));
  eq([P.nhid, P.hid0[1 * 7 + 1], P.hid0[2 * 7 + 3]], [1, 0, 1], "mystery blocks: on a picture, flags on the outer edge mean nothing; an inner one hides");
  // A board's play never depends on the flags (information only): the same moves with and without them.
  const A = E.sim(E.compile(lv(G, L.cols)), N), Z = E.sim(B, N); for (const j of [0, 0, 1, 2]) { A.play(j); A.quiet(); Z.play(j); Z.quiet(); }
  eq([A.now, A.pixLeft, A.status], [Z.now, Z.pixLeft, Z.status], "mystery blocks: the flags change no rule");
  // The lookahead player can't see where hidden colours are: two boards that differ only by swapping two hidden blocks'
  // colours score every tap the same.
  const G2 = [".........", ".aaaaaaa.", ".abcbcba.", ".aaaaaaa.", "....#...."], H2 = [".........", ".........", "..?????..", ".........", "........."];
  const sw = G2.slice(); sw[2] = ".acbcbca.";
  const C2 = [[[1, 16]], [[2, 3]], [[3, 2]], [], []], look = (g) => { const Sx = E.sim(E.compile(lv(g, C2, { hidden: H2 })), N), o = new Float64Array(5); Gr.look(Sx, new Int32Array(Sx.M.length), o); return Array.from(o); };
  const l1 = look(G2), l2 = look(sw);
  eq([JSON.stringify(l1) === JSON.stringify(l2), Gr.HIDE_SAMPLES], [true, 4], "mystery blocks: the lookahead's scores are the same whichever way the hidden colours lie (" + JSON.stringify(l1) + ")");
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
    for (let c = 0; c < B.n; c++) { const m = B.a0[c]; if (m > 0 && m !== E.IRON && m !== E.GILT && B.towerOf[c] < 0 && !(B.hid0 && B.hid0[c]) && L.cols.some((col) => col.some((cd) => cd[0] === m && cd[1] > 1))) cells.push(c); }
    if (cells.length) {
      const c = cells[ri(cells.length)], x = c % B.w, y = (c / B.w) | 0, m = B.a0[c];
      L.grid[y] = L.grid[y].slice(0, x) + "n" + L.grid[y].slice(x + 1);
      const col = L.cols.find((cl) => cl.some((cd) => cd[0] === m && cd[1] > 1)); col.find((cd) => cd[0] === m && cd[1] > 1)[1]--;
      L.cols[ri(5)].push([E.GILT, 1]); L.lock = { key: [x, y] };
    }
  } else if (r() < 0.5) { const ms = []; L.cols.forEach((col) => col.forEach((cd) => { if (ms.indexOf(cd[0]) < 0) ms.push(cd[0]); })); if (ms.length) L.lock = { colour: ms[ri(ms.length)] }; } // v5 R1: a colour lock
  if (r() < 0.5) { const B0 = E.compile(L); L.hidden = L.grid.map((row, y) => row.split("").map((ch, x) => { const c = y * L.w + x, m = B0.a0[c]; return m > 0 && m !== E.IRON && B0.keyOf[c] < 0 && c !== B0.lockKey && B0.towerOf[c] < 0 && r() < 0.3 ? "?" : "."; }).join("")); } // v5 R1: mystery blocks
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
  let games = 0, taps = 0, refused = 0, pops = 0, diffs = 0, pairs = 0, unlocks = 0, reveals = 0, hidChk = 0; const t0 = Date.now();
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
        else if (B.nhid) { let hc = 0; for (let c = 0; c < B.n; c++) if (S.hiddenCell(c) !== R.hiddenCell(c)) hc++; if (hc) bad = "hidden blocks (" + hc + ")"; else hidChk++; }
      }
      if (!bad) { S.quiet(); R.quiet(); const st = S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing"; if (st !== R.status || S.reason !== R.reason || S.jamWhy !== R.jamWhy) bad = "final " + st + "/" + R.status; }
      pops += mine.length; games++;
      if (bad) { diffs++; if (diffs <= 4) console.log("  diff: " + (L.id || "injected " + B.n) + " " + dn + (rushed ? " rushed" : " patient") + ": " + bad); }
    }
  }
  eq(diffs, 0, "differential (twists): engine == reference on " + games + " games (" + taps + " taps, " + refused + " refused, " + pops + " pops; " + pairs + " pairs, " + unlocks + " unlocks, " + reveals + " reveals): pops and times, status, reason and jamWhy, spaces and pairs, columns, hidden cards, lock");
  ok(pairs > 0 && unlocks > 0 && reveals > 0 && refused > 0 && hidChk > 0, "differential (twists): the games exercise pairs, unlocks, reveals, refusals and (v5 R1) mystery blocks (" + hidChk + " checks of every hidden block)");
  console.log("  differential (twists): " + games + " games in " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
}

// ---- v4.3: linked pairs in the baked decks -----------------------------------------------------------------------------------
// The stored order taps every pair with both cards at a front (it holds no refused tap), and no two pairs are cross-buried
// (pair P's card ahead of Q's in one column while Q's is ahead of P's in another: neither could ever go).
{
  let pairs = 0, cross = [], refused = [];
  for (const L of LEVELS.levels.concat(DEBUG)) {
    if (!L.links || !L.links.length) continue; pairs += L.links.length;
    for (let a = 0; a < L.links.length; a++) for (let b = a + 1; b < L.links.length; b++) {
      const P = L.links[a], Q = L.links[b], ahead = (x, y) => x[0] === y[0] && x[1] < y[1]; // x ahead of y in one column
      const pq = P.some((x) => Q.some((y) => ahead(x, y))), qp = Q.some((y) => P.some((x) => ahead(y, x)));
      if (pq && qp) cross.push((L.id || L.n) + " pairs " + a + "," + b);
    }
    const S = E.sim(E.compile(L), RULES[L.tag]); for (const ch of L.win[L.tag]) { if (S.play(+ch) === E.REFUSED) { refused.push(L.id); break; } S.quiet(); }
  }
  eq([cross, refused], [[], []], "links (v4.3): " + pairs + " linked pairs in the baked and debug decks: no two cross-buried, and every stored order taps each pair with both cards at a front (no refused tap)");
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
  // Every stored debug order wins patiently on its tag (v4.3: Normal), holds no refused tap and keeps to the tap cap.
  let good = 0;
  for (const D of DEBUG) for (const d of [D.tag]) {
    const T = E.sim(E.compile(D), RULES[d]); let ref = 0; for (const ch of D.win[d]) { if (T.play(+ch) === E.REFUSED) ref++; T.quiet(); }
    if (T.status === E.WON && !ref && D.win[d].length <= 55 && !E.check(D).length) good++; else console.log("FAIL  " + D.id + " " + d);
  }
  eq([good, DEBUG.length >= 4, ["v4-mystery", "v4-linked", "v4-locked", "v4-all"].every((id) => DEBUG.some((D) => D.id === id))], [DEBUG.length, true, true], "debug levels: one per twist and one with all three; every stored order wins on its tag (Normal) with no refused tap and 55 taps or fewer");
  const lk = DEBUG.find((l) => l.id === "v4-linked"), LB = E.compile(lk);
  ok(Gr.solve(LB, N, 50000) && Gr.rate(LB, N, 40, 3) >= 0 && Gr.greedy(LB, N, 20, 3) >= 0, "grader: rate, greedy and solve finish on a linked level (legal taps only)");
  const fr = [Gr.fast(E.compile(LEVELS.levels[60]), N, 30, 9, 0), Gr.fast(LB, N, 30, 9, 250)];
  ok(fr.every((x) => x >= 0 && x <= 1), "grader: the fast tapper finishes on a baked level and a linked one (" + fr.join(", ") + ")");
}

// ==== v4.1: picture boards entered from the bottom (every Siege level and Gallery picture) ======================================
// A picture board: the picture's rows inside a 1-cell frame of open ground, the entry square (camp) centred in the
// bottom row (entryHalf 1: 3 cells on an odd width, 2 on an even one). water: picture rows whose frame cells are water.
const picLv = (rows, cols, extra, wet) => { const w = rows[0].length + 2, mid = (w - 1) / 2, grid = [",".repeat(w)].concat(rows.map((r, y) => ((wet || []).indexOf(y) >= 0 ? "~" + r + "~" : "," + r + ","))), bot = Array.from({ length: w }, (_, x) => (Math.abs(x - mid) <= 1 ? "#" : ",")).join(""); grid.push(bot); return lv(grid, cols, Object.assign({ pic: true }, extra || {})); };
{
  throws(() => E.compile(lv(["#####", "#aaa#", "#aaa#", "#####"], null, { ring: true })), "pic: v4 M4's ring levels are retired (ring: true throws)");
  throws(() => E.compile(lv([".....", ",aaa,", ",,#,,"], null, { pic: true })), "pic: a border cell that is grass throws");
  throws(() => E.compile(lv([",,,,,", ",a#a,", ",,#,,"], null, { pic: true })), "pic: a camp cell inside the picture throws");
  throws(() => E.compile(lv([",,,,,", ",aaa,", "#,,,#"], null, { pic: true })), "pic: an entry that is not one run throws");
  throws(() => E.compile(lv(["~~~~~", ",aaa,", ",,#,,"], null, { pic: true })), "pic: water on the top border throws");
  const B = E.compile(picLv(["aaa", "a~a", "aaa"], [[[1, 8]], [], [], [], []], null, [1]));
  eq([B.pic, B.campRow, B.w, B.h, E.compile(lv(["a~b", "...", ".##"])).pic], [true, 4, 5, 5, false], "pic: compile flags a picture board (water allowed on the side borders); a plain level is not one; the camp row is the bottom row");
}
{
  // Known answer: 12 a's round three b's. Every a touches the frame; all 12 are claimed before the first pop (a squad of
  // 12 leaves within 12 staggers), so the claim order is the pop order: the walk from the entry square first (the bottom
  // row's middle three 0, the ends 1, up the sides 4 and 5, the top row 8 and 9), equal walks to the row nearest the camp
  // row, then the lower x. The b's inside are reached once an a beside them pops.
  const L = picLv(["aaaaa", "abbba", "aaaaa"], [[[1, 12]], [[2, 3]], [], [], []]), S = E.sim(E.compile(L), N);
  eq([S.B.campRow, S.d[4 * 7 + 3], S.d[4 * 7 + 2], S.d[4 * 7 + 4], S.d[4 * 7 + 0], S.d[0 * 7 + 3]], [4, 0, 0, 0, 2, 9], "bottom entry: the entry square is 3 cells (walk 0); the top border's middle is the long walk (2 to the corner, 4 up, 3 along)");
  eq(eats(S, 0), [[2, 3], [3, 3], [4, 3], [1, 3], [5, 3], [1, 2], [5, 2], [1, 1], [5, 1], [2, 1], [4, 1], [3, 1]], "bottom entry: nearest the entry first, the top last; equal walks go to the row nearest the camp row, then the lower x");
  eq([S.reachable(2), pat(S, 1)], [3, E.WON], "bottom entry: the b's are in reach once the a's round them pop; razed");
}
{
  // A moat runs off both sides (water in the frame on its rows): the far side is reached only over the drawbridge, an iron
  // gate whose gilt key is on the near side. The bank path (open ground) above the moat joins the frame on both sides.
  const L = picLv(["aaaaa", ",,,,,", "~~j~~", "bbnbb", "bbbbb"], [[[2, 9]], [[14, 1]], [[1, 5]], [], []], { gates: [{ at: [3, 3], key: [3, 4] }] }, [2]), S = E.sim(E.compile(L), N);
  eq([S.reachable(1), S.reachable(2), S.reachable(14)], [0, 7, 0], "moat: before the key only the near side is in reach (the frame is water where the moat runs off)");
  eq([pat(S, 0), S.reachable(14), S.reachable(1)], [E.PLAYING, 1, 0], "moat: the near side goes; its key is in reach; the far side still is not");
  eq([pat(S, 1), S.reachable(1)], [E.PLAYING, 5], "moat: the key pops, the drawbridge drops, and the bank path joins the frame: every block on the far side is in reach");
  eq(pat(S, 2), E.WON, "moat: the far side goes over the bridge: razed");
}
{
  // An outline needs no rule of its own: a black ring round the picture's inside shuts it off until black is eaten.
  const L = picLv(["aaaaaaa", "akkkkka", "akbbbka", "akbbbka", "akkkkka", "aaaaaaa"], [[[2, 6]], [[11, 14]], [[1, 22]], [], []]), S = E.sim(E.compile(L), N);
  eq([S.reachable(1), S.reachable(11), S.reachable(2)], [22, 0, 0], "outline: at the start only the background touches the frame");
  eq([pat(S, 0), S.lineLen], [E.PLAYING, 1], "outline: a squad of the inside colour waits (nothing in reach)");
  eq([pat(S, 1), S.lineLen, S.reachable(11)], [E.PLAYING, 2, 0], "outline: black waits too while the background stands");
  eq([pat(S, 2), S.status], [E.WON, E.WON], "outline: the background goes, then black breaches the outline, then the inside goes: razed");
}
// Random picture boards (a background, blobs of other colours, an outline round one of them, sometimes a moat band with
// a drawbridge and its key) with random decks, for the differential against the reference.
function picRandom(seed) {
  const r = Gr.rng(seed), ri = (a, b) => a + Math.floor(r() * (b - a + 1)), w = ri(6, 14), h = ri(6, 16), g = [];
  for (let y = 0; y < h; y++) { g.push([]); for (let x = 0; x < w; x++) g[y].push(1); }
  for (let k = 0, nk = ri(2, 5); k < nk; k++) { const cx = ri(1, w - 2), cy = ri(1, h - 2), rr = ri(1, 4), m = ri(2, 6);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= rr * rr) g[y][x] = m;
    if (k === 0) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (g[y][x] === m) continue; const nbm = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] === m && (x - cx) ** 2 + (y - cy) ** 2 <= (rr + 1.5) ** 2); if (nbm) g[y][x] = 11; } }
  let wet = [], gates; const my = h >= 8 && r() < 0.4 ? ri(2, h - 4) : -1;
  if (my >= 0) { const bx = ri(1, w - 2); for (let x = 0; x < w; x++) { g[my][x] = x === bx ? 10 : -1; g[my - 1][x] = -2; } const ky = ri(my + 1, h - 1), kx = ri(0, w - 1); g[ky][kx] = 14; wet = [my]; gates = [{ at: [bx + 1, my + 1], key: [kx + 1, ky + 1] }]; }
  const rows = g.map((row) => row.map((m) => (m === -1 ? "~" : m === -2 ? "," : E.chOf(m))).join("")), cnt = {}; for (const row of g) for (const m of row) if (m > 0 && m !== 10) cnt[m] = (cnt[m] || 0) + 1;
  const cards = []; for (const m of Object.keys(cnt)) { let left = cnt[m]; while (left > 0) { const k = Math.min(left, ri(2, 14)); cards.push([+m, k]); left -= k; } }
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  const cols = [[], [], [], [], []]; cards.forEach((cd, i) => cols[r() < 0.5 ? i % 5 : ri(0, 4)].push(cd));
  return picLv(rows, cols, gates ? { gates } : null, wet);
}
const PICS = []; for (let k = 0; k < 40; k++) { const L = picRandom(9101 + k); PICS.push(k % 4 === 3 ? inject(L, 9301 + k) : L); }
{
  let games = 0, taps = 0, refused = 0, pops = 0, diffs = 0, moats = PICS.filter((L) => L.gates).length; const t0 = Date.now();
  const rline = (R) => R.spaces.map((s, k) => [k, s]).filter(([, s]) => s).sort((p, q) => p[1].seq - q[1].seq).map(([k, s]) => [s.m, s.wait + s.out]);
  for (const L of PICS) {
    const B = E.compile(L);
    for (const [dn, rules] of Object.entries(RULES)) for (const rushed of [false, true]) {
      const S = E.sim(B, rules), R = Ref.game(L, rules), r = Gr.rng(B.n * 17 + (rushed ? 5 : 1) + dn.length); S.logOn = true;
      let t = 0, bad = null; const mine = [];
      for (let g = 0; g <= 6 * B.ncards + 40 && S.status === E.PLAYING && !bad; g++) {
        const open = []; for (let j = 0; j < 5; j++) if (S.front(j) >= 0) open.push(j);
        if (!open.length) break;
        const j = open[Math.floor(r() * open.length)];
        S.clearLog(); let a1, a2;
        if (rushed) { t += Math.floor(r() * 1500); a1 = S.play(j, t); a2 = R.play(j, t); } else { a1 = S.play(j); S.quiet(); a2 = R.play(j); R.quiet(); }
        taps++; if (a1 === E.REFUSED) refused++;
        if ((a1 === E.REFUSED) !== (a2 === "refused")) { bad = "refusal"; break; }
        for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === E.EV.EAT) mine.push([S.ev[i + 1], S.q1[S.ev[i + 2]]]);
        const st = S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing";
        if (JSON.stringify(mine) !== JSON.stringify(R.pops)) bad = "pops";
        else if (st !== R.status || (st === "failed" && S.reason !== R.reason)) bad = "status " + st + "/" + R.status;
        else if (JSON.stringify(S.order().map((s) => [S.spM[s], S.spW[s] + S.spO[s]])) !== JSON.stringify(rline(R))) bad = "spaces";
        else if (S.now !== R.now) bad = "clock";
      }
      if (!bad) { S.quiet(); R.quiet(); const st = S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing"; if (st !== R.status || S.reason !== R.reason) bad = "final"; }
      pops += mine.length; games++;
      if (bad) { diffs++; if (diffs <= 4) console.log("  diff: picture board " + B.w + "x" + B.h + " " + dn + (rushed ? " rushed" : " patient") + ": " + bad); }
    }
  }
  eq(diffs, 0, "differential (picture boards): engine == reference on " + games + " games (" + taps + " taps, " + refused + " refused, " + pops + " pops) on " + PICS.length + " random picture boards (" + moats + " with a moat), patient and rushed");
  console.log("  differential (picture boards): " + games + " games, " + taps + " taps, " + pops + " pops, " + refused + " refused in " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
}

// ---- v4 M4: the converter on a tiny hand image with a known answer; PNG in and out -----------------------------------------
const CV = require("./convert.js"), GCFG = require("./gallery-config.json"), PAL = require("./palette.js");
{
  // 6x6 transparent source with a 2x2 red block in the middle. Box 6x6 with a 2-cell margin: one source pixel a cell,
  // the subject in the middle, one ring of ink round it (8-adjacent), the rest the given background, then the camp ring.
  const w = 6, h = 6, rgba = new Uint8Array(w * h * 4);
  for (let y = 2; y <= 3; y++) for (let x = 2; x <= 3; x++) rgba.set([255, 0, 0, 255], (y * w + x) * 4);
  const P = CV.plan({ w, h, rgba }, { kind: "emoji", box: [6, 6], margin: 2, outline: 1, bg: "#8ecdf2" }, GCFG.convert);
  eq(P.grid, [",,,,,,,,", ",aaaaaa,", ",abbbba,", ",abccba,", ",abccba,", ",abbbba,", ",aaaaaa,", ",,,##,,,"], "convert: a 2x2 red block on transparency becomes the block, an 8-adjacent ink outline, the background, in a frame of open ground with the entry square in its bottom row (v4.1; ids by population)");
  eq([P.pal[1].c, P.pal[1].n, P.pal[2].c, P.pal[2].n, P.pal[3].n, P.stats.colours, P.stats.outline], ["#8ecdf2", "sky", GCFG.convert.ink, "black", "red", 3, 12], "convert: the palette is the background, the ink and the red, each named");
  ok(PAL.de00(PAL.lab(P.pal[3].c), PAL.lab("#ff0000")) < 1, "convert: the red keeps its colour (" + P.pal[3].c + ")");
  const S = E.sim(E.compile(Object.assign({ cols: [[[3, 4]], [[2, 12]], [[1, 20]], [], []] }, P)), N);
  eq([S.B.pic, S.reachable(1), S.reachable(2), S.reachable(3)], [true, 20, 0, 0], "convert: the plan is a picture board; only the background is in reach at the start (the outline shuts the block off)");
  eq([pat(S, 0), pat(S, 1), pat(S, 2), S.status], [E.PLAYING, E.PLAYING, E.WON, E.WON], "convert: red and black wait, the background goes, then black breaches, then red: razed");
  // A colour closer than minDE to a kept one is left out: two reds 5 apart become one.
  const r2 = new Uint8Array(w * h * 4); for (let y = 1; y <= 4; y++) for (let x = 1; x <= 4; x++) r2.set(x < 3 ? [255, 0, 0, 255] : [245, 10, 10, 255], (y * w + x) * 4);
  const P2 = CV.plan({ w, h, rgba: r2 }, { kind: "emoji", box: [8, 8], margin: 2, outline: 1, bg: "#8ecdf2" }, GCFG.convert);
  eq(P2.stats.colours, 3, "convert: two near-identical reds (under minDE) merge into one colour");
  // PNG: an RGB image encoded and decoded comes back pixel for pixel.
  const rgb = new Uint8Array(5 * 3 * 3); for (let i = 0; i < rgb.length; i++) rgb[i] = (i * 37) & 255;
  const D = CV.decode(CV.encode(5, 3, rgb)); let same = D.w === 5 && D.h === 3; for (let i = 0; i < 15 && same; i++) for (let k = 0; k < 3; k++) if (D.rgba[i * 4 + k] !== rgb[i * 3 + k] || D.rgba[i * 4 + 3] !== 255) same = false;
  ok(same, "convert: PNG encode then decode round-trips an RGB image");
}

// ---- v4 M4: the Gallery file's invariants ------------------------------------------------------------------------------
{
  const GF = require("../levels/gallery.json"), GL = castleGal(), MAN = require("../levels/gallery-manifest.json"), GB = GCFG.bake, LIC = require("fs").readFileSync(require("path").join(__dirname, "../LICENSES.md"), "utf8");
  const kept = MAN.order.filter((id) => (MAN.pictures.find((p) => p.id === id) || {}).keep !== false);
  eq([GL.length, GL.map((L) => L.src).join(), GL.every((L, i) => L.n === i + 1 && L.id === "g-" + L.src)], [kept.length, kept.join(), true], "gallery: one level per kept picture, in the manifest's order, ids g-<picture>");
  let bad = [], wins = 0, dead = 0, taps = 0, over = 0, ms = [], dmin = 99, dminFade = 99, band = 0;
  const fadeHex = (a, t) => { const F = require("../config.json").layout.fade, x = parseInt(a.slice(1), 16), y = parseInt(F.tray.slice(1), 16), ch = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t); return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1); };
  const T = require("../config.json").layout.fade.t;
  for (const L of GL) {
    const B = E.compile(L), used = new Set(); for (const row of L.grid) for (const ch of row) { const m = E.matOf(ch); if (m) used.add(m); }
    const ids = Object.keys(L.pal).map(Number).sort((a, b) => a - b), pic = MAN.pictures.find((p) => p.id === L.src);
    if (!B.pic || E.check(L).length || L.links || L.lock || (L.gates && L.gates.length) || (L.towers && L.towers.length) || L.cols.some((c) => c.some((cd) => cd[2]))) bad.push(L.id + ": not a plain picture board");
    if (ids.join() !== [...used].sort((a, b) => a - b).join() || ids.some((m) => m === E.IRON || m === E.GILT)) bad.push(L.id + ": palette ids " + ids + " vs grid " + [...used]);
    for (let m = 1; m < E.NMAT; m++) if (B.sapTotal[m] !== B.pix[m]) bad.push(L.id + ": colour " + m + " has " + B.sapTotal[m] + " sappers for " + B.pix[m] + " pixels");
    const d = L.tag, g = L.grade[d] || {}; // v4.3: one fixed tag, one stored order
    if (RULES[d] && Object.keys(L.win).join() === d && E.replay(B, RULES[d], L.win[d] || "").status === E.WON) wins++; else bad.push(L.id + " " + d + ": stored order does not win");
    const ln = Gr.line(B, RULES[d] || RULES.normal, L.win[d]); ms.push(ln.ms); if (ln.maxWait > GB.maxWaitMs) dead++; if ((L.win[d] || "").length > GB.maxTaps) taps++; if (GB.duration.pace ? !g.pace || g.pace.fell || g.pace.ms > GB.duration.pace.range[1] : ln.ms > GB.duration.maxMs) over++; // v4.2: the real pace
    if (g.rate >= L.target[0] && g.rate <= L.target[1]) band++;
    const hx = ids.map((m) => L.pal[m].c); let lmin = 99, fmin = 99;
    for (let a = 0; a < hx.length; a++) for (let b = a + 1; b < hx.length; b++) { lmin = Math.min(lmin, PAL.de00(PAL.lab(hx[a]), PAL.lab(hx[b]))); for (let d = 1; d < T.length; d++) fmin = Math.min(fmin, PAL.de00(PAL.lab(fadeHex(hx[a], T[d])), PAL.lab(hx[b])), PAL.de00(PAL.lab(fadeHex(hx[b], T[d])), PAL.lab(hx[a]))); }
    const want = pic.kind === "painting" ? GCFG.convert.kinds.painting.minDE : GCFG.convert.minDE; if (lmin < want) bad.push(L.id + ": colours only " + lmin.toFixed(1) + " apart"); dmin = Math.min(dmin, lmin);
    if (pic.kind !== "painting") { dminFade = Math.min(dminFade, fmin); if (fmin < GCFG.convert.fadeDE) bad.push(L.id + ": a faded tile only " + fmin.toFixed(1) + " from a front colour"); }
    if (!pic.license || !(pic.url || (pic.prompt && pic.seed != null && pic.model)) || !(pic.fetched || pic.generated) || LIC.indexOf(pic.id) < 0) bad.push(L.id + ": manifest or LICENSES.md line missing");
  }
  for (let i = 0; i < GL.length; i++) for (let j = i + 1; j < GL.length; j++) { const A = GL[i], Bq = GL[j]; if (A.w !== Bq.w || A.h !== Bq.h) continue; let same = 0; for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) if (A.grid[y][x] === Bq.grid[y][x]) same++; if (same / (A.w * A.h) >= GB.dedupe) bad.push(A.id + " and " + Bq.id + " are near-duplicates"); }
  ms.sort((a, b) => a - b);
  eq(bad, [], "gallery: every level is a plain picture board whose palette is exactly its colours (never 10 or 14), sappers sum to pixels, stored orders win on each picture's tag, colours " + GCFG.convert.minDE + " apart (paintings " + GCFG.convert.kinds.painting.minDE + "; smallest " + dmin.toFixed(1) + "), faded tiles " + GCFG.convert.fadeDE + " apart (not paintings; smallest " + dminFade.toFixed(1) + "), a manifest and LICENSES.md line each, no near-duplicates");
  eq([wins, dead, taps, over, band], [GL.length, 0, 0, 0, GL.length], "gallery: " + wins + " stored orders win; every stored line under " + GB.maxWaitMs / 1000 + " s a tap, " + GB.maxTaps + " taps and " + (GB.duration.pace ? GB.duration.pace.range[1] / 1000 + " s of real pace; patient" : GB.duration.maxMs / 1000 + " s") + " (median " + (ms[(ms.length - 1) >> 1] / 1000).toFixed(0) + " s, max " + (ms[ms.length - 1] / 1000).toFixed(0) + " s); every level in its Normal band");
  // Engine vs the slow reference on the Gallery's picture boards: Normal patient and rushed on every level, Easy and Hard
  // patient on every fourth.
  let games = 0, diffs = 0, pops = 0; const t0 = Date.now();
  for (const [k, L] of GL.entries()) for (const [dn, rules] of Object.entries(RULES)) for (const rushed of [false, true]) {
    if (dn !== "normal" && (rushed || k % 4)) continue;
    const S = E.sim(E.compile(L), rules), R = Ref.game(L, rules), r = Gr.rng(k * 131 + (rushed ? 7 : 3) + dn.length); S.logOn = true; let t = 0, bad2 = null; const mine = [];
    for (let g = 0; g <= 200 && S.status === E.PLAYING && !bad2; g++) {
      const open = []; for (let j = 0; j < 5; j++) if (S.front(j) >= 0) open.push(j); if (!open.length) break;
      const j = open[Math.floor(r() * open.length)]; S.clearLog(); let a1, a2;
      if (rushed) { t += Math.floor(r() * 1500); a1 = S.play(j, t); a2 = R.play(j, t); } else { a1 = S.play(j); S.quiet(); a2 = R.play(j); R.quiet(); }
      if ((a1 === E.REFUSED) !== (a2 === "refused")) bad2 = "refusal";
      for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === E.EV.EAT) mine.push([S.ev[i + 1], S.q1[S.ev[i + 2]]]);
      const st = S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing";
      if (!bad2 && JSON.stringify(mine) !== JSON.stringify(R.pops)) bad2 = "pops"; else if (!bad2 && (st !== R.status || S.now !== R.now)) bad2 = "status or clock";
    }
    pops += mine.length; games++; if (bad2) { diffs++; if (diffs <= 3) console.log("  diff: " + L.id + " " + dn + (rushed ? " rushed" : " patient") + ": " + bad2); }
  }
  eq(diffs, 0, "differential (Gallery): engine == reference on " + games + " games on the Gallery's picture boards (" + pops + " pops)");
  console.log("  differential (Gallery): " + games + " games in " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
}

// ==== v4 M5: power-ups (engine operations at the clock; SPEC-v4 §9) ========================================================
const META = require("../config.json").meta;
const PR = { easy: E.rulesOf(V3, "easy", META), normal: E.rulesOf(V3, "normal", META), hard: E.rulesOf(V3, "hard", META), extreme: E.rulesOf(V3, "extreme", META) }, PN = PR.normal, PW = E.PW;
const phold = (k, powers) => Object.assign({}, PN, { hold: k }, powers ? { powers } : {});
// At rest: every colour's sappers (cards still in a column, by their counts now, plus the sappers waiting in the line)
// equal S.sappers(m), and with no Hard kill they equal its pixels still standing.
function balanced(S) {
  const B = S.B, sum = new Array(E.NMAT).fill(0);
  for (let j = 0; j < 5; j++) for (let d = 0, ci = S.card(j, 0); ci >= 0; ci = S.card(j, ++d)) sum[B.cardM[ci]] += S.count(ci);
  for (const s of S.order()) sum[S.spM[s]] += S.spW[s] + S.spO[s];
  for (let m = 1; m < E.NMAT; m++) { if (m === E.IRON) continue; if (sum[m] !== S.sappers(m)) return "colour " + m + ": " + sum[m] + " in the tray and line, " + S.sappers(m) + " sappers"; if (!S.kills && S.sappers(m) !== S.left[m]) return "colour " + m + ": " + S.sappers(m) + " sappers, " + S.left[m] + " pixels"; }
  return true;
}
const colsOf = (S) => [0, 1, 2, 3, 4].map((j) => { const o = []; for (let d = 0, ci = S.card(j, 0); ci >= 0; ci = S.card(j, ++d)) o.push([ci, S.count(ci)]); return o; });
{
  eq([PN.powers, PN.pullDepth, E.POWERS, N.powers === undefined], [[1, 3, 1, 2, 1], 2, ["ladder", "quartermaster", "scout", "recall", "volley"], true], "powers: config meta gives the uses per level (Ladder 1, Quartermaster 3, Scout 1, Recall 2, Volley 1) and the reach; rules without meta allow none");
  const S0 = E.sim(E.compile(lv(RING, [[[2, 1]], [], [], [], []])), N);
  eq([0, 1, 2, 3].map((k) => [S0.canPower(k, 0), S0.power(k, 0)]), [[false, E.REFUSED], [false, E.REFUSED], [false, E.REFUSED], [false, E.REFUSED]], "powers: with no uses allowed (the grader's rules) every power-up is refused");
}
// ---- Ladder -----------------------------------------------------------------------------------------------------------------
{
  const L = lv(RING, [[[2, 2]], [[1, 12]], [[3, 1]], [], []]);
  const S = E.sim(E.compile(L), phold(2)); S.logOn = true; pat(S, 0);
  eq([S.cap, S.open, S.lineLen, S.stuck(0)], [2, 2, 1, true], "ladder: two spaces, b (walled in) waits stuck in one");
  S.clearLog(); const r = S.power(PW.LADDER);
  eq([r, S.cap, S.open, S.extra, S.used(PW.LADDER), evs(S, E.EV.POWER)], [E.PLAYING, 3, 3, 1, 1, [[0, 2]]], "ladder: one more space for this level (3; POWER 0, the new space 2)");
  const b0 = S.save(); eq([S.canPower(PW.LADDER), S.power(PW.LADDER)], [false, E.REFUSED], "ladder: a second is refused (1 a level)"); ok(same(b0, S.save()), "ladder: the refusal changes nothing");
  pat(S, 2); eq([S.status, S.lineLen], [E.PLAYING, 2], "ladder: c takes a space too (b and c both wait; the third space is free)");
  eq(pat(S, 1), E.WON, "ladder: a razes the ring; b and c go in: won");
  S.reset(); eq([S.cap, S.extra, S.used(PW.LADDER)], [2, 0, 0], "ladder: Retry (reset) takes the extra space and the use back");
  // The line's maximum: 8 spaces.
  const X = E.sim(E.compile(L), phold(6, [5, 0, 0, 0]));
  eq([X.power(PW.LADDER), X.power(PW.LADDER), X.cap, X.canPower(PW.LADDER), X.power(PW.LADDER), X.used(PW.LADDER)], [E.PLAYING, E.PLAYING, 8, false, E.REFUSED, 2], "ladder: never past " + E.MAXLINE + " spaces (Easy's 6 + 2, then refused)");
  // With the lock: the new space opens below the locked one, which stays the last.
  const K = E.sim(E.compile(lv(["abn...", "......", "..##.."], [[[1, 1]], [[2, 1]], [[14, 1]], [[4, 1]], [[5, 1]]], { lock: { key: [2, 0] } })), PN); K.logOn = true;
  K.power(PW.LADDER); eq([K.cap, K.open, K.locked, evs(K, E.EV.POWER)], [6, 5, 1, [[0, 4]]], "ladder with the lock: 6 spaces, 5 open, the locked one still the last (the new open space is 4)");
  for (const j of [3, 4, 0, 1]) K.play(j, 0);
  eq([K.lineLen, K.spQ[5], K.open - K.lineLen, K.play(2, 0), K.spQ[4] > 0, K.spQ[5]], [4, 0, 1, E.PLAYING, true, 0], "ladder with the lock: squads fill spaces 0-4; the locked space 5 stays empty");
}
// ---- Quartermaster (v5 R1: a card in view goes straight out into a free space) ------------------------------------------------
{
  // Column 0: a, b (?), c, d (all one pixel, all in reach). Column 1: e. Column 2: f.
  const L = lv(ROW6, [[[1, 1, 1], [2, 1, 1], [3, 1], [4, 1]], [[5, 1]], [[6, 1]], [], []]);
  const S = E.sim(E.compile(L), PN); S.logOn = true;
  eq([S.hidden(1), S.canPower(PW.PULL, 3), S.canPower(PW.PULL, 2), S.canPower(PW.PULL, 0)], [true, false, true, true], "pull: a card 3 back is out of reach (2); 2 back and the front itself are in view");
  const r = S.power(PW.PULL, 1), typ = []; for (let i = 0; i < S.evLen; i += 3) typ.push(S.ev[i]);
  eq([r, colsOf(S)[0].map((c) => c[0]), S.order().map((q) => [q, S.spM[q]]), evs(S, E.EV.REVEAL), evs(S, E.EV.POWER), evs(S, E.EV.TAP), S.plays, S.used(PW.PULL)],
    [E.PLAYING, [0, 2, 3], [[0, 2]], [[1, 0]], [[1, 1]], [[0, 2]], 0, 1], "pull: the hidden b goes straight out, revealed (REVEAL, POWER 1 b, TAP 0 b); the cards behind it close up; not a play");
  eq([typ.indexOf(E.EV.REVEAL) < typ.indexOf(E.EV.POWER), typ.indexOf(E.EV.POWER) < typ.indexOf(E.EV.TAP), typ.indexOf(E.EV.DISP) > typ.indexOf(E.EV.TAP)], [true, true, true], "pull: log order REVEAL, POWER, TAP, then the dispatch at that instant");
  S.quiet(); eq([S.lineLen, S.left[2]], [0, 0], "pull: its squad dispatches like any (b eaten, the space free)");
  // The front: a pulled front card is sent like a tap (the next card becomes the front).
  eq([S.power(PW.PULL, 0), S.card(0, 0), S.lineLen], [E.PLAYING, 2, 1], "pull: the front card goes out too; c is the front");
  pat(S, 1); eq([S.used(PW.PULL), S.canPower(PW.PULL, 2), S.power(PW.PULL, 2)], [2, true, E.PLAYING], "pull: a third use (3 a level)");
  const b0 = S.save(); eq([S.canPower(PW.PULL, 3), S.power(PW.PULL, 3)], [false, E.REFUSED], "pull: a fourth is refused"); ok(same(b0, S.save()), "pull: the refusal changes nothing");
  // No free open space: refused at no cost.
  const F = E.sim(E.compile(lv(ROW6, [[[1, 1], [2, 1]], [[3, 1]], [[4, 1]], [], []])), phold(2)); F.play(1, 0); F.play(2, 0);
  const fb = F.save(); eq([F.open - F.lineLen, F.canPower(PW.PULL, 1), F.power(PW.PULL, 1), same(fb, F.save()), F.used(PW.PULL)], [0, false, E.REFUSED, true, 0], "pull: no free space: refused, nothing changes, no use spent");
  // A linked card goes with its partner (in view in its own column, front included): 2 spaces, the pulled card first, paired.
  const P = E.sim(E.compile(lv(ROW6, [[[1, 1], [2, 1]], [[3, 1], [4, 1], [5, 1]], [[6, 1]], [], []], { links: [[[0, 1], [1, 1]]] })), PN); P.logOn = true;
  eq([P.why(0), P.canPower(PW.PULL, 1), P.canPower(PW.PULL, 3)], [0, true, true], "pull (linked): b and its partner d are both in view (1 back each)");
  P.power(PW.PULL, 3);
  eq([P.order().map((q) => [q, P.spM[q]]), evs(P, E.EV.LINK), P.spL[0], P.spL[1], colsOf(P).slice(0, 2).map((c) => c.map((x) => x[0]))], [[[0, 4], [1, 2]], [[0, 1]], 2, 1, [[0], [2, 4]]], "pull (linked): d (pulled) takes space 0, its partner b space 1, paired (LINK 0 1); both columns close up");
  const P2 = E.sim(E.compile(lv(ROW6, [[[1, 1], [2, 1]], [[3, 1], [4, 1], [5, 1]], [[6, 1]], [], []], { links: [[[0, 1], [1, 2]]] })), phold(5));
  eq([P2.canPower(PW.PULL, 1), P2.canPower(PW.PULL, 4)], [true, true], "pull (linked): a partner 2 back is in view");
  const P3 = E.sim(E.compile(lv(ROW6, [[[1, 1], [2, 1]], [[3, 1], [4, 1], [5, 1], [6, 1]], [], [], []], { links: [[[0, 1], [1, 3]]] })), PN);
  eq([P3.canPower(PW.PULL, 1), P3.canPower(PW.PULL, 5)], [false, false], "pull (linked): a partner 3 back is out of view: refused either way");
  const P4 = E.sim(E.compile(lv(ROW6, [[[1, 1], [2, 1]], [[3, 1], [4, 1]], [[6, 1]], [[5, 1]], []], { links: [[[0, 1], [1, 1]]] })), phold(3)); P4.play(2, 0); P4.play(3, 0);
  eq([P4.open - P4.lineLen, P4.canPower(PW.PULL, 1)], [1, false], "pull (linked): one free space: refused (a pair needs 2)");
  // A colour lock opens when a pulled card of its colour goes out.
  const CL = E.sim(E.compile(lv(ROW6, [[[1, 1], [2, 1]], [[3, 1]], [], [], []], { lock: { colour: 2 } })), PN); CL.power(PW.PULL, 1);
  eq([CL.locked, CL.open], [0, 5], "pull: a colour lock opens when its colour goes out by a Quartermaster");
  // The reference agrees on the same moves.
  const RF = Ref.game(L, PN); eq([RF.power(PW.PULL, 3), RF.power(PW.PULL, 1), RF.spaces.filter(Boolean).map((q) => q.m), RF.cols[0].map((c) => c.ci)], ["refused", undefined, [2], [0, 2, 3]], "pull (reference): out of reach refused; b goes straight out");
}
// ---- Scout ------------------------------------------------------------------------------------------------------------------
{
  const L = lv(ROW6, [[[1, 1], [2, 1, 1], [3, 1, 1]], [[4, 1], [5, 1, 1]], [[6, 1]], [], []]);
  const S = E.sim(E.compile(L), phold(5, [0, 0, 2, 0])); S.logOn = true;
  eq([1, 2, 4].map((c) => S.hidden(c)), [true, true, true], "scout: three hidden cards");
  eq([S.power(PW.SCOUT), [1, 2, 4].map((c) => S.hidden(c)), evs(S, E.EV.REVEAL), evs(S, E.EV.POWER)], [E.PLAYING, [false, false, false], [[1, 0], [2, 0], [4, 1]], [[2, 3]]], "scout: every hidden card is revealed (a REVEAL each, POWER 2 3)");
  S.clearLog(); pat(S, 0); eq([evs(S, E.EV.REVEAL), S.canPower(PW.SCOUT), S.power(PW.SCOUT)], [[], false, E.REFUSED], "scout: a scouted card reaches the front with no second reveal; with nothing hidden a second Scout is refused");
}
// ---- Recall -----------------------------------------------------------------------------------------------------------------
{
  // b (walled in) is tapped from column 0, which has x behind it; it waits stuck. Recall: b goes back to column 0's front.
  const L = lv(RING, [[[2, 2], [3, 1]], [[1, 12]], [], [], []]);
  const S = E.sim(E.compile(L), PN); S.logOn = true; pat(S, 0);
  eq([S.lineLen, S.stuck(0), S.card(0, 0), S.canPower(PW.RECALL, 0), S.canPower(PW.RECALL, 1)], [1, true, 1, true, false], "recall: b waits stuck in space 0; space 1 is free (nothing to recall)");
  S.clearLog(); const r = S.power(PW.RECALL, 0);
  eq([r, S.lineLen, colsOf(S)[0], S.plays, evs(S, E.EV.POWER), evs(S, E.EV.FREE)], [E.PLAYING, 0, [[0, 2], [1, 1]], 1, [[3, 0]], [[0, 2]]], "recall: b back at column 0's front with its 2 sappers, its space free at once (POWER 3 0, FREE); not a play");
  ok(balanced(S) === true, "recall: every colour's sappers still equal its pixels (" + balanced(S) + ")");
  eq([pat(S, 1), pat(S, 0), pat(S, 0)], [E.PLAYING, E.PLAYING, E.WON], "recall: a razes the ring; b plays again from the front; won");
  // A squad that ate part of its count goes back with the sappers still waiting.
  const P = E.sim(E.compile(lv([".a.~b", "...~~", ".##.."], [[[1, 3]], [[2, 1]], [], [], []])), PN); pat(P, 0);
  eq([P.spW[0], P.stuck(0), P.power(PW.RECALL, 0), P.card(0, 0), P.count(0)], [2, true, E.PLAYING, 0, 2], "recall: a squad of 3 that ate the 1 pixel in reach goes back as a card of 2");
  // Refused: a squad with a sapper out, a linked squad, a free space, past the uses.
  const W = E.sim(E.compile(L), PN); W.play(1, 0);
  eq([W.out > 0, W.canPower(PW.RECALL, 0), W.power(PW.RECALL, 0)], [true, false, E.REFUSED], "recall: a squad with sappers out is refused");
  const K = E.sim(E.compile(lv(RING, [[[2, 2]], [[3, 1]], [[1, 12]], [], []], { links: [[[0, 0], [1, 0]]] })), PN); pat(K, 0);
  eq([K.lineLen, K.stuck(0), K.spL[0] > 0, K.canPower(PW.RECALL, 0), K.canPower(PW.RECALL, 1)], [2, true, true, false, false], "recall: linked squads are refused (either one)");
  const U = E.sim(E.compile(lv(RING, [[[2, 1]], [[2, 1]], [[2, 1]], [[1, 12]], []])), PN); pat(U, 0); pat(U, 1); pat(U, 2);
  eq([U.power(PW.RECALL, 0), U.power(PW.RECALL, 1), U.canPower(PW.RECALL, 2), U.power(PW.RECALL, 2), U.used(PW.RECALL)], [E.PLAYING, E.PLAYING, false, E.REFUSED, 2], "recall: a third is refused (2 a level)");
  // A recalled mystery card is at its column's front, so it is face up; pulled back behind a new front it stays face up.
  // v5 R1: a hidden card a Quartermaster sent out (from behind the front), recalled, goes back to its column's front face up.
  const M2 = E.sim(E.compile(lv(RING, [[[1, 12], [2, 2, 1], [3, 1]], [], [], [], []])), PN); M2.power(PW.PULL, 1); M2.quiet();
  eq([M2.stuck(0), M2.power(PW.RECALL, 0), colsOf(M2)[0].map((c) => c[0]), M2.hidden(1), M2.gone[1]], [true, E.PLAYING, [1, 0, 2], false, 0], "recall (v5 R1): a card the Quartermaster sent out from 1 back goes back to its column's front, face up");
  ok(balanced(M2) === true, "recall (v5 R1): balance holds after pull and recall (" + balanced(M2) + ")");
}
// ---- v5 R1: the Volley (power 4 on a colour) ----------------------------------------------------------------------------------
{
  const VR = phold(5, [0, 0, 0, 0, 1]);
  // b (2 pixels, walled in) waits stuck; the Volley on b clears (3,2) then (2,2) (nearest the entry (3,4) first), frees
  // its space and leaves no b sapper anywhere; a and c then win.
  const L = lv(RING, [[[2, 2]], [[1, 12]], [[3, 1]], [], []]), B = E.compile(L), S = E.sim(B, VR); S.logOn = true; pat(S, 0);
  eq([S.canPower(PW.VOLLEY, 10), S.canPower(PW.VOLLEY, 5), S.canPower(PW.VOLLEY, 2)], [false, false, true], "volley: iron and a colour not in play are refused; b can go");
  S.clearLog(); const r = S.power(PW.VOLLEY, 2);
  eq([r, evs(S, E.EV.POWER), evs(S, E.EV.CLEAR).map(([c, m]) => [xy(B, c), m]), evs(S, E.EV.FREE), S.lineLen, S.left[2], S.sappers(2), S.plays], [E.PLAYING, [[4, 2]], [[[3, 2], 2], [[2, 2], 2]], [[0, 2]], 0, 0, 0, 1], "volley: POWER 4 b, both b pixels cleared nearest the entry first, its space freed at once, no b left; not a play");
  ok(balanced(S) === true, "volley: balance holds (" + balanced(S) + ")");
  eq([pat(S, 1), pat(S, 2), S.canPower(PW.VOLLEY, 1)], [E.PLAYING, E.WON, false], "volley: a and c finish the level");
  const R = Ref.game(L, VR); R.play(0); R.quiet(); eq([R.power(PW.VOLLEY, 5), R.power(PW.VOLLEY, 2), R.g[2 * 7 + 2], R.g[2 * 7 + 3], R.spaces.filter(Boolean).length], ["refused", undefined, -2, -2, 0], "volley (reference): the same");
  // Cards of the colour leave the queue, wherever they are; a hidden one is revealed as it goes; a partner's link is cut.
  const Q = E.sim(E.compile(lv(ROW6, [[[1, 1], [2, 1, 1], [3, 1]], [[4, 1], [2, 0 + 1]], [[5, 1]], [[6, 1]], []], { links: [[[0, 2], [1, 1]]] })), VR); Q.logOn = true;
  // b cards: col 0 #1 (hidden), col 1 #1 (linked to c). Volley b.
  Q.power(PW.VOLLEY, 2);
  eq([colsOf(Q).slice(0, 2).map((c) => c.map((x) => x[0])), evs(Q, E.EV.REVEAL), Q.partner(2), Q.cut[4]], [[[0, 2], [3]], [[1, 0]], -1, 1], "volley: both b cards leave their columns (the hidden one revealed); c's partner was b, so c plays alone");
  pat(Q, 0); eq([Q.why(0), pat(Q, 0), Q.lineLen], [0, E.PLAYING, 0], "volley: c, once linked, is tapped alone");
  // Walkers cut loose: a squad mid-walk loses its claimed block; the walker walks home on its own, holding no space.
  const W = E.sim(E.compile(lv(ROW6, [[[1, 1]], [[2, 1]], [[3, 1]], [[4, 1]], [[5, 1], [6, 1]]])), VR); W.play(0, 0); W.advanceTo(10);
  eq([W.lineLen, W.out, W.qK[0]], [1, 1, 1], "volley: a's sapper is walking out to its block");
  W.power(PW.VOLLEY, 1); eq([W.lineLen, W.out, W.qK[0], W.left[1], W.open - W.lineLen], [0, 1, 4, 0, 5], "volley: a's block is cleared, its space free at once, its walker cut loose (still out)");
  W.play(1); eq([W.spM[0], W.lineLen], [2, 1], "volley: the freed space takes the next squad at once");
  W.quiet(); eq([W.out, W.lineLen, W.left[2]], [0, 0, 0], "volley: the cut-loose walker comes home touching no space; b finishes");
  // A linked pair in the line: the Volley on one colour frees its space; the other plays on unpaired.
  const P = E.sim(E.compile(lv(RING, [[[2, 2]], [[3, 1]], [[1, 12]], [], []], { links: [[[0, 0], [1, 0]]] })), VR); pat(P, 0);
  eq([P.lineLen, P.spL[0] > 0], [2, true], "volley: b and c (linked) wait in the line");
  P.power(PW.VOLLEY, 2); eq([P.lineLen, P.spL[1], P.spM[1], P.stuck(1)], [1, 0, 3, true], "volley: b's space frees; c stays, unpaired");
  eq([pat(P, 2), P.status], [E.WON, E.WON], "volley: a razes the ring and c finishes");
  // A colour lock of the volleyed colour opens.
  const CL = E.sim(E.compile(lv(ROW6, [[[1, 1]], [[2, 1]], [], [], []], { lock: { colour: 2 } })), VR); CL.power(PW.VOLLEY, 2);
  eq([CL.locked, CL.open], [0, 5], "volley: a colour lock of the volleyed colour opens (no squad of it is left to open it)");
  // A gilt Volley removes keys: the gate opens.
  const G = E.sim(E.compile(lv(["ajjjb", "jjjjj", ".....", "n.##."], [[[14, 1]], [[1, 1]], [[2, 1]], [], []], { gates: [{ at: [1, 0], key: [0, 3] }] })), VR);
  G.power(PW.VOLLEY, 14); eq([G.left[10], G.left[14]], [0, 0], "volley: on gilt, the key goes and its gate opens");
}
// ---- every operation: dealing, game over, determinism ------------------------------------------------------------------------
{
  const D = E.sim(E.compile(lv(RING)), PN, { deal: true }); D.playSquad(2, 1);
  eq([0, 1, 2, 3, 4].map((k) => D.power(k, 0)), [E.NOPLAY, E.NOPLAY, E.NOPLAY, E.NOPLAY, E.NOPLAY], "powers: dealing mode never takes one (NOPLAY)");
  const W = E.sim(E.compile(lv(ROW6, [[[1, 1]], [[2, 1]], [[3, 1]], [[4, 1]], [[5, 1], [6, 1]]])), PN); for (const j of [0, 1, 2, 3, 4, 4]) pat(W, j);
  eq([W.status, W.power(PW.LADDER)], [E.WON, E.NOPLAY], "powers: none once the level is over");
  // Without a power used, rules with power-ups allowed play every stored order identically (hash, clock, state) to the
  // grader's rules.
  let same2 = 0, tot = 0;
  for (const L of DEBUG.concat(LEVELS.levels.filter((l, k) => k % 10 === 7))) for (const d of [L.tag]) { // v4.3: each on its tag
    const B = E.compile(L), A = E.sim(B, RULES[d]), Z = E.sim(B, PR[d]); let okk = true;
    for (const ch of L.win[d]) { A.play(+ch); A.quiet(); Z.play(+ch); Z.quiet(); if (A.hash() !== Z.hash() || A.now !== Z.now || !same(A.save(), Z.save())) okk = false; }
    tot++; if (okk && Z.status === E.WON) same2++;
  }
  eq(same2, tot, "powers: with none used, the power rules replay " + tot + " stored orders state for state (hash, clock, buffer) and win");
}
// ---- differential with power-ups: engine vs the reference, random taps and power-ups, patient and rushed ----------------------
{
  let games = 0, ops = 0, taken = [0, 0, 0, 0, 0], refusedP = 0, diffs = 0, rests = 0, hangs = 0, unbal = 0, dry = 0, revs = 0, revNo = 0; const t0 = Date.now();
  const rline = (R) => R.spaces.map((s, k) => [k, s]).filter(([, s]) => s).sort((p, q) => p[1].seq - q[1].seq).map(([k, s]) => [k, s.m, s.wait, s.out, s.pair == null ? -1 : s.pair]);
  const eline = (S) => S.order().map((s) => [s, S.spM[s], S.spW[s], S.spO[s], S.spL[s] - 1]);
  const lim = [2, 4, 2, 3, 2];
  const SET = TWISTED.filter((L, k) => k < 4 || k % 3 === 0);
  for (const L of SET) {
    const B = E.compile(L);
    for (const dn of ["normal", "hard", "easy"]) for (const rushed of [false, true]) {
      const rules = Object.assign({}, PR[dn], { powers: lim, continues: 1 }), S = E.sim(B, rules), R = Ref.game(L, rules), r = Gr.rng(B.n * 17 + (rushed ? 9 : 2) + dn.length);
      let t = 0, bad = null;
      const restCheck = () => { if (S.busy || S.status !== E.PLAYING) return; rests++; let legal = 0; for (let j = 0; j < 5; j++) if (Gr.legal(S, j)) legal++; if (!legal) hangs++; if (!rushed && balanced(S) !== true) unbal++; };
      for (let g = 0; g <= 8 * B.ncards + 60 && S.status === E.PLAYING && !bad; g++) {
        const usePower = r() < 0.3;
        if (rushed) t += Math.floor(r() * 1500);
        let a1, a2, what;
        if (usePower) {
          const k = Math.floor(r() * (r() < 0.25 ? 5 : 4)); let a = 0; // v5 R1: a Volley now and then
          if (k === PW.VOLLEY) { const o = S.order(), f = S.front(Math.floor(r() * 5)); a = r() < 0.5 && o.length ? S.spM[o[Math.floor(r() * o.length)]] : r() < 0.8 && f >= 0 ? B.cardM[f] : 1 + Math.floor(r() * 14); }
          if (k === PW.PULL) { const j = Math.floor(r() * 5), d = Math.floor(r() * 4), c = S.card(j, d); a = c >= 0 ? c : Math.floor(r() * B.ncards); }
          else if (k === PW.RECALL) { const o = S.order(); a = o.length && r() < 0.8 ? o[Math.floor(r() * o.length)] : Math.floor(r() * 8); }
          if (rushed) { S.advanceTo(t); R.advanceTo(t); }
          const can = S.canPower(k, a);
          a1 = S.power(k, a); a2 = R.power(k, a); what = "power " + k + " " + a;
          if (can !== (a1 === E.PLAYING || a1 === E.WON || a1 === E.FAILED)) dry++;
          if (a1 === E.REFUSED) refusedP++; else if (a1 !== E.NOPLAY) taken[k]++;
          if ((a1 === E.REFUSED) !== (a2 === "refused")) { bad = what + ": " + a1 + "/" + a2; break; }
          if (!rushed) { S.quiet(); R.quiet(); }
        } else {
          const open = []; for (let j = 0; j < 5; j++) if (S.front(j) >= 0) open.push(j);
          if (!open.length) break;
          const j = open[Math.floor(r() * open.length)]; what = "tap " + j;
          if (rushed) { a1 = S.play(j, t); a2 = R.play(j, t); } else { a1 = S.play(j); S.quiet(); a2 = R.play(j); R.quiet(); }
          if ((a1 === E.REFUSED) !== (a2 === "refused")) { bad = what + ": refusal " + a1 + "/" + a2; break; }
        }
        ops++; restCheck();
        if (S.status === E.FAILED && S.reason === "jam" && !bad) { // v5 R1: the continue, on both
          const can = S.canRevive(), v1 = S.revive(), v2 = R.revive();
          if (can !== (v1 !== E.REFUSED)) dry++;
          if ((v1 === E.REFUSED) !== (v2 === "refused")) bad = "revive: " + v1 + "/" + v2; else if (v1 === E.REFUSED) revNo++; else revs++;
          if (!rushed) { S.quiet(); R.quiet(); }
        }
        const st = S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing";
        const colsR = R.cols.map((c) => c.map((cd) => [cd.ci, cd.n]));
        const hidE = [], hidR = []; for (let ci = 0; ci < B.ncards; ci++) { if (S.hidden(ci)) hidE.push(ci); if (R.hidden(ci)) hidR.push(ci); }
        if (bad) break;
        if (R.pops.length + R.cleared !== B.pixTotal - S.pixLeft - (B.pix[E.IRON] - S.left[E.IRON])) bad = what + ": pops";
        else if (st !== R.status || (st === "failed" && S.reason !== R.reason)) bad = what + ": status " + st + "/" + R.status + " " + S.reason + "/" + R.reason;
        else if (JSON.stringify(eline(S)) !== JSON.stringify(rline(R))) bad = what + ": spaces " + JSON.stringify(eline(S)) + " / " + JSON.stringify(rline(R));
        else if (S.now !== R.now || S.open !== R.open || S.cap !== rules.hold + R.extra) bad = what + ": clock or spaces";
        else if (JSON.stringify(colsOf(S)) !== JSON.stringify(colsR)) bad = what + ": columns " + JSON.stringify(colsOf(S)) + " / " + JSON.stringify(colsR);
        else if (JSON.stringify(hidE) !== JSON.stringify(hidR)) bad = what + ": hidden cards";
        else if (B.nhid) { let hc = 0; for (let c = 0; c < B.n; c++) if (S.hiddenCell(c) !== R.hiddenCell(c)) hc++; if (hc) bad = what + ": hidden blocks (" + hc + ")"; }
      }
      if (!bad) { S.quiet(); R.quiet(); restCheck(); const st = S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing"; if (st !== R.status || S.reason !== R.reason) bad = "final " + st + "/" + R.status; }
      games++;
      if (bad) { diffs++; if (diffs <= 4) console.log("  diff: " + (L.id || "injected " + B.n) + " " + dn + (rushed ? " rushed" : " patient") + ": " + bad); }
    }
  }
  eq(diffs, 0, "differential (power-ups): engine == reference on " + games + " games, " + ops + " taps and power-ups (taken: Ladder " + taken[0] + ", Quartermaster " + taken[1] + ", Scout " + taken[2] + ", Recall " + taken[3] + ", Volley " + taken[4] + "; " + refusedP + " refused): acceptance, status, spaces, columns and counts, hidden cards, clock");
  ok(taken.every((k) => k > 0) && taken[4] >= 20 && refusedP > 0, "differential (power-ups): every power-up is taken (the Volley " + taken[4] + " times) and refused in the run");
  ok(revs > 0 && revNo > 0, "differential (v5 R1 continue): continues taken (" + revs + ") and refused (" + revNo + ") in the run, engine == reference");
  eq([dry, hangs, unbal], [0, 0, 0], "power-ups: canPower always agrees with power(); " + rests + " rest states all have a legal tap or are over; every patient rest state keeps each colour's sappers equal to its pixels");
  console.log("  differential (power-ups): " + games + " games, " + ops + " operations (taken " + taken.join("/") + ", " + refusedP + " refused) in " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
}

// ---- the page's save (v4 M1 settings: speed replaces the 2x flag, colour-blind marks; v4.3 format 2, progress by id) --------
{
  const Save = require("../src/save.js"), order = LEVELS.levels.map((l) => l.id), set = (raw) => Save.sanitize({ settings: raw }, order).settings;
  eq(Save.fresh().settings, { muted: false, music: true, sfx: true, speed: 1, cb: false }, "save: a fresh save plays at 1x with colour-blind marks off (v4.3: no difficulty setting), music and sound effects on (v5.2)");
  eq([set({ speed: 3, cb: true }).speed, set({ speed: 3, cb: true }).cb], [3, true], "save: speed 3 and colour-blind on load as saved");
  eq([set({ fast: true }).speed, set({ fast: false }).speed, set({ speed: 2.5 }).speed, set({ speed: 9 }).speed, set({ speed: "3" }).speed], [2, 1, 1, 1, 1], "save: the old 2x flag loads as 2; a bad speed loads as 1");
  eq([set({ cb: "yes" }).cb, set({ cb: 1 }).cb, set({}).cb, "diff" in set({ diff: "hard" })], [false, false, false, false], "save: colour-blind is on only for a strict true; the difficulty setting is dropped");
  // v4.3: progress by stable level id. A level opens when it is the first, cleared, or the one before it is cleared; a
  // cleared level is kept wherever it sits (a gap no longer drops the wins after it).
  const gap = { v: 2, done: {} }; for (let i = 0; i < 40; i++) if (i !== 20) gap.done[order[i]] = 1; const sg = Save.sanitize(gap, order);
  eq([Object.keys(sg.done).length, Save.next(sg, order), Save.isOpen(sg, order, order[20]), Save.isOpen(sg, order, order[21]), Save.isOpen(sg, order, order[40]), Save.isOpen(sg, order, order[41])],
    [39, order[20], true, true, true, false], "save v4.3: a gap keeps every cleared level; the gap is next and open, cleared levels stay open, the one after the last clear opens");
  eq([Save.isOpen(Save.fresh(), order, order[0]), Save.isOpen(Save.fresh(), order, order[1]), Save.isOpen(Save.fresh(), order, "nope")], [true, false, false], "save v4.3: a new save opens only the first level; unknown ids are never open");
  // The Gallery opens one picture at a time: the first on the gate (Siege gallery.openAt cleared), each next when the one
  // before it is cleared.
  const gids = require("../levels/gallery.json").levels.map((l) => l.id), g0 = Save.fresh();
  eq([Save.isOpen(g0, gids, gids[0], "gal", false), Save.isOpen(g0, gids, gids[0], "gal", true), Save.isOpen(g0, gids, gids[1], "gal", true), Save.next(g0, gids, "gal", false), Save.next(g0, gids, "gal", true)],
    [false, true, false, null, gids[0]], "save v4.3: the Gallery's first picture opens on the gate, the second only after the first");
  const g1 = Save.sanitize({ v: 2, gal: { [gids[0]]: 1, [gids[5]]: 1 } }, order, gids);
  eq([Save.isOpen(g1, gids, gids[1], "gal", true), Save.isOpen(g1, gids, gids[2], "gal", true), Save.isOpen(g1, gids, gids[5], "gal", true), Save.isOpen(g1, gids, gids[6], "gal", true), Save.next(g1, gids, "gal", true)],
    [true, false, true, true, gids[1]], "save v4.3: a cleared picture stays open (and opens the next); the earliest open uncleared one is next");
  eq(Save.sanitize({ gal: { [gids[0]]: 2, [gids[1]]: 13, nope: 7, [gids[2]]: "4", [gids[3]]: 8 } }, order, gids).gal, { [gids[0]]: 1, [gids[1]]: 1 }, "save: Gallery clears kept per picture; unknown ids, non-numbers and no difficulty bit are dropped");
  // Every shipped save shape (format 1: v3, v4, v4.1, v4.2), as each version's own code wrote it (tools/saves/make.js):
  // a mask with any difficulty bit becomes cleared, a best row keeps the fastest time and the fewest taps over the
  // difficulties won, coins/inventory/lives/settings kept, the difficulty dropped; it reads back unchanged.
  const Meta = require("../src/meta.js"), slotId = (id) => (order.indexOf(id) >= 0 ? id : order.find((x) => /^e\d+-\d+$/.test(id) && +x.split("-")[1] === +id.split("-")[1]) || null);
  for (const ver of ["v3", "v4", "v4.1", "v4.2"]) {
    const raw = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "saves", ver + ".json"), "utf8")), sv = Save.sanitize(JSON.parse(JSON.stringify(raw)), order, gids, META);
    // v5 R2 renamed four slots (e1-25 is e2-25 now); v5 R3 fix: an old id the page no longer has counts as the level in its slot.
    const wonIds = Object.keys(raw.done).filter((id) => raw.done[id] & 7).map(slotId).filter(Boolean), galIds = Object.keys(raw.gal || {}).filter((id) => raw.gal[id] & 7 && gids.indexOf(id) >= 0);
    const bestOk = Object.keys(raw.best || {}).filter((id) => slotId(id) || gids.indexOf(id) >= 0).every((id) => { const r = raw.best[id], m = (raw.done[id] || (raw.gal || {})[id]) | 0, b = sv.best[slotId(id) || id], ms = [0, 1, 2].filter((k) => m & (1 << k) && r[k] > 0).map((k) => r[k]), tp = [0, 1, 2].filter((k) => m & (1 << k) && r[3 + k] > 0).map((k) => r[3 + k]);
      return b && b[0] === Math.min(...ms) && b[1] === Math.min(...tp) && b[2] === r[6]; });
    const keep = raw.coins == null ? META.coins.start : raw.coins;
    eq([sv.v, Object.keys(sv.done).sort(), Object.keys(sv.gal).sort(), Object.values(sv.done).concat(Object.values(sv.gal)).every((x) => x === 1), bestOk, sv.coins, sv.inv, sv.settings, sv.last, Save.next(sv, order)],
      [2, wonIds.sort(), galIds.sort(), true, true, keep, Object.assign({ ladder: 0, quartermaster: 0, scout: 0, recall: 0 }, raw.inv || {}, { volley: 0 }), { muted: raw.settings.muted, music: !raw.settings.muted, sfx: !raw.settings.muted, speed: raw.settings.speed || (raw.settings.fast ? 2 : 1), cb: raw.settings.cb === true }, Save.isOpen(sv, order, slotId(raw.last)) ? slotId(raw.last) : null, order.find((id, i) => !sv.done[id] && (i === 0 || sv.done[order[i - 1]])) || order[order.length - 1]],
      "save v4.3: the " + ver + " save (" + wonIds.length + " levels, " + galIds.length + " pictures) migrates: cleared by id, bests the best, coins and settings kept, difficulty dropped");
    eq(Save.sanitize(JSON.parse(JSON.stringify(sv)), order, gids, META), sv, "save v4.3: the migrated " + ver + " save reads back unchanged (format 2)");
  }
}

// ---- v4 M5, the meta layer (src/meta.js) and its save fields ----------------------------------------------------------------
{
  const Save = require("../src/save.js"), Meta = require("../src/meta.js"), order = LEVELS.levels.map((l) => l.id), gids = require("../levels/gallery.json").levels.map((l) => l.id);
  const prices = META.powers.map((p) => p.price), total = prices.slice(0, 4).reduce((a, b) => a + b, 0); // v5 R1: the Volley (rare, costly) is not one of them
  const f = Save.fresh(META);
  eq([f.coins, f.inv, f.best, f.lives], [META.coins.start, { ladder: 0, quartermaster: 0, scout: 0, recall: 0, volley: 0 }, {}, { n: META.livesMax, at: 0 }], "meta save: a new save starts with " + META.coins.start + " coins, no power-ups, no best results, full lives");
  ok(META.coins.start >= total && META.lives === false, "meta: the starting balance (" + META.coins.start + ") buys each of the four everyday power-ups once (" + total + "; the Volley is " + prices[4] + "); lives are off on the web");
  // Old saves: no coins field -> the starting balance; junk is clamped or dropped.
  const old = Save.sanitize({ done: { [order[0]]: 2 }, settings: { speed: 2 } }, order, gids, META);
  eq([old.coins, old.inv.ladder, old.best, old.lives.n], [META.coins.start, 0, {}, META.livesMax], "meta save: a save from before M5 loads with the starting balance, an empty inventory, no best results and full lives");
  const junk = Save.sanitize({ done: { [order[0]]: 3, [order[1]]: 1 }, gal: { [gids[0]]: 4 }, coins: 2.6e9, inv: { ladder: 3.4, scout: -2, recall: 1e9, quartermaster: "9" },
    best: { [order[0]]: [9000, 12000, 7000, 20, 30, 40, 55], [order[1]]: [1, 2, 3, 4, 5, 6, 7], [gids[0]]: [0, 0, 4e6, 0, 0, 2000, 1], nope: [1, 1, 1, 1, 1, 1, 1], [order[2]]: [5, 5, 5, 5, 5, 5, 5] }, lives: { n: 40, at: -3 } }, order, gids, META);
  eq([junk.coins, junk.inv, junk.best, junk.lives], [Meta.MAXCOINS, { ladder: 3, quartermaster: 0, scout: 0, recall: 99, volley: 0 },
    { [order[0]]: [9000, 20, 55], [order[1]]: [1, 4, 7], [gids[0]]: [Meta.MAXMS, Meta.MAXTAPS, 1] }, { n: META.livesMax, at: 0 }],
    "meta save: coins and inventory clamped; a format-1 best keeps the best over the difficulties won (clamped), unknown or unwon levels dropped; lives clamped");
  const j2 = Save.sanitize({ v: 2, done: { [order[0]]: 1, [order[1]]: 1 }, best: { [order[0]]: [9000, 20, 55, 99], [order[1]]: [-4, 1e9, "x"], [order[3]]: [1, 1, 1] } }, order, gids, META);
  eq(j2.best, { [order[0]]: [9000, 20, 55], [order[1]]: [0, Meta.MAXTAPS, 0] }, "meta save v4.3: a format-2 best row [ms, taps, coins] is clamped; an uncleared level's is dropped");
  eq(Save.sanitize(JSON.parse(JSON.stringify(junk)), order, gids, META), junk, "meta save: a sanitized save reads back unchanged");
  // Coins: per win by the level's tag, more on its first clear (v4.3; a new medal before).
  eq(["easy", "normal", "hard"].map((d) => [Meta.winCoins(META, d, false), Meta.winCoins(META, d, true)]), ["easy", "normal", "hard"].map((d) => [META.coins.win[d], META.coins.win[d] + META.coins.first[d]]), "meta: a win earns its tag's coins, plus its first-clear coins on the first clear");
  eq([META.coins.win.easy, META.coins.win.normal, META.coins.win.hard], [5, 10, 20], "meta v4.3: wins pay 5/10/20 by tag");
  const d = Save.fresh(META), id = order[4];
  const w1 = Meta.recordWin(d, META, id, "normal", 81234, 22, true), w2 = Meta.recordWin(d, META, id, "normal", 90000, 19, false), w3 = Meta.recordWin(d, META, id, "normal", 70000, 30, false);
  eq([w1.coins, w1.newMs, w1.newTaps, w1.best, w2.coins, w2.newMs, w2.newTaps, w2.best, w3.newMs, w3.newTaps, d.best[id], d.coins],
    [30, true, true, [0, 0], 10, false, true, [81234, 22], true, false, [70000, 19, 50], META.coins.start + 50], "meta v4.3: best time and fewest taps kept apart (they can come from different runs), coins earned there summed");
  // Buying: price off the balance, one in the inventory; short coins refused with what's missing.
  const b = Save.fresh(META); b.coins = prices[0] + 5;
  const y1 = Meta.buy(b, META, 0), y2 = Meta.buy(b, META, 0);
  eq([y1.ok, b.inv.ladder, y2.ok, y2.short, b.coins, Meta.take(b, 0), b.inv.ladder, Meta.take(b, 0)], [true, 1, false, prices[0] - 5, 5, true, 0, false], "meta: buy spends the price into the inventory; short coins are refused and say how many are missing; take uses one");
  // Lives (forced on in a copy of the config): a fail costs one, one back per refill period, none: no start.
  const LM = Object.assign({}, META, { lives: true }), per = LM.livesRefillMin * 60000, L = Save.fresh(LM), t0 = 1.7e12;
  eq([Meta.lives(L, META, t0).on, Meta.canStart(L, META, t0)], [false, true], "lives off: no count, a level always starts");
  for (let k = 0; k < LM.livesMax; k++) Meta.loseLife(L, LM, t0 + k * 1000);
  const z = Meta.lives(L, LM, t0 + 5000);
  eq([z.n, Meta.canStart(L, LM, t0 + 5000), z.nextMs], [0, false, per - 5000], "lives on: " + LM.livesMax + " fails empty them; no level starts; the first comes back a refill period after the first fail");
  eq([Meta.lives(L, LM, t0 + per).n, Meta.lives(L, LM, t0 + 3 * per + 10).n, Meta.lives(L, LM, t0 + 99 * per).n, L.lives.at], [1, 3, LM.livesMax, 0], "lives on: one back per period, up to full (then the count stops)");
  const back = Save.fresh(LM); Meta.loseLife(back, LM, t0); eq(Meta.lives(back, LM, t0 - 60000).nextMs, per, "lives on: a clock that went back restarts the count, never runs it negative");
  eq([Meta.clock(81234), Meta.clock(59001, true), Meta.clock(3723000)], ["1:21", "1:00", "1:02:03"], "meta: times read m:ss (h:mm:ss past an hour)");
}

if (deferred.length) console.log("DEFERRED to R2 (config v5.relaid is false): " + deferred.length + " checks: " + deferred.join("; "));
// ---- v5 R1: the freeze test (tools/freeze.js) on its fixture snapshot -----------------------------------------------------
{
  const FZ = require("./freeze.js"), fs = require("fs"), os = require("os"), path = require("path"), fx = path.join(__dirname, "freeze-fixture");
  const r0 = FZ.check(fx); eq([r0.ok, r0.files.map((f) => [f.levels, f.diffs])], [true, [[3, 0]]], "freeze: the fixture snapshot re-grades with 0 differences (" + (r0.files[0] || {}).checks + " checks)");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sp-freeze-")); fs.copyFileSync(path.join(fx, "frozen.json"), path.join(tmp, "frozen.json"));
  const lv = JSON.parse(fs.readFileSync(path.join(fx, "levels.json"), "utf8")); lv.levels[1].grade.hard.ms += 1; fs.writeFileSync(path.join(tmp, "levels.json"), JSON.stringify(lv));
  const r1 = FZ.check(tmp); eq([r1.ok, r1.files[0].diffs, /winning line/.test(r1.files[0].lines[0] || "")], [false, 1, true], "freeze: a stored grade off by 1 ms fails (" + (r1.files[0].lines[0] || "") + ")");
  const v3 = JSON.parse(JSON.stringify(V3)); v3.time.tileMs += 1; const r2 = FZ.check(fx, v3);
  ok(!r2.ok && r2.files[0].diffs >= 3, "freeze: a rule change (tileMs + 1) fails on every fixture level (" + r2.files[0].diffs + " differences)");
  eq([FZ.check(path.join(tmp, "none")).missing], [true], "freeze: no snapshot reads as not baselined");
  fs.rmSync(tmp, { recursive: true, force: true });
}
// ---- v5 R1: the Extreme tag (data and coins; R2 decides which levels wear it) -----------------------------------------------
{
  const Meta = require("../src/meta.js"), TG = require("./tags.js");
  eq([TG.TAGS, Meta.winCoins(META, "extreme", false), Meta.winCoins(META, "extreme", true), RULES.extreme.hold, require("../config.json").layout.tags.extreme], [["easy", "normal", "hard", "extreme"], 30, 90, 5, "Extreme"], "extreme: a fourth tag; a win pays 30 (+60 on the first clear); 5 spaces like every tag; its label");
}
// ---- v5 R1: power-up unlocks (meta.js unlockAt, isOpen, grant; the save's got) ------------------------------------------------
{
  const Save = require("../src/save.js"), Meta = require("../src/meta.js");
  eq([0, 1, 2, 3, 4].map((k) => Meta.unlockAt(META, k)), [1, 25, 100, 50, 125], "unlocks: Ladder 1, Quartermaster 25, Scout 100, Recall 50, Volley 125 (config)");
  const D = Save.fresh(META);
  eq([Meta.grant(D, META, 1), D.inv, D.got], [[0], { ladder: 1, quartermaster: 0, scout: 0, recall: 0, volley: 0 }, { ladder: 1 }], "unlocks: a new player at level 1 gets the Ladder and its free use");
  eq([Meta.grant(D, META, 24), Meta.grant(D, META, 25), Meta.grant(D, META, 25), D.inv.quartermaster], [[], [1], [], 1], "unlocks: the Quartermaster opens at 25, its free use given once");
  eq([Meta.grant(D, META, 200), D.inv], [[2, 3, 4], { ladder: 1, quartermaster: 1, scout: 1, recall: 1, volley: 1 }], "unlocks: past the campaign every one is open (Recall, Scout, Volley given once each)");
  eq([Meta.isOpen(META, 4, 124), Meta.isOpen(META, 4, 125)], [false, true], "unlocks: the Volley is hidden at 124, open at 125");
  const R = Save.sanitize({ v: 2, got: { ladder: 1, scout: true, volley: 2, junk: 1 }, inv: {} }, [], [], META);
  eq(R.got, { ladder: 1 }, "unlocks (save): got keeps only 1s for known power-ups");
}

// ---- v5 R2: side quests (tools/quests.js, save.js questOpen and nextBy, meta.js gift) -------------------------------------------
{
  const Save = require("../src/save.js"), Meta = require("../src/meta.js"), QS = require("./quests.js"), GQ = require("../config.json").gallery.quests, P = META.powers;
  const q = QS.questsOf(60, GQ, P), gaps = q.slice(1).map((x, i) => x.after - q[i].after), un = (id) => P.find((p) => p.id === id).unlockAt;
  ok(q[0].after === GQ.first && gaps.every((g) => g >= 3 && g <= 5) && q.every((x) => un(x.prize) <= x.after + 1), "side quests: picture 1 after level " + GQ.first + ", then one every 3-5 main levels (to " + q[59].after + "); every prize is unlocked by its quest");
  const vol = q.filter((x) => x.prize === GQ.rare), pastV = q.filter((x) => x.after + 1 >= un(GQ.rare));
  ok(vol.every((x) => x.after + 1 >= un(GQ.rare)) && vol.length === Math.floor(pastV.length / GQ.volleyEvery) && q.filter((x) => x.after < 24).every((x) => x.prize === "ladder"), "side quests: the Volley only from " + un(GQ.rare) + " and rare (" + vol.length + " of " + pastV.length + "); before 25 every prize is a Ladder");
  const order = ["a1", "a2", "a3"], gal = ["p1", "p2", "p3", "p4"], after = [1, 3, 5, 6], D = Save.fresh(META), open = () => gal.map((id) => Save.questOpen(D, order, gal, after, id));
  const s0 = open(); D.done.a1 = 1; const s1 = open(); D.done.a3 = 1; const s2 = open(); D.done.a2 = 1; const s3 = open(); D.gal.p3 = 1; const s4 = open();
  eq([s0, s1, s2, s3, s4, Save.nextBy(D, gal, "gal", (id) => Save.questOpen(D, order, gal, after, id))], [[false, false, false, false], [true, false, false, false], [true, true, false, false], [true, true, true, false], [true, true, true, true], "p1"],
    "side quests: a picture opens once its main level is cleared (optional, never blocking); past the last level they open once all are cleared, one at a time; nextBy finds the first open one not cleared");
  const G = Save.fresh(META); G.inv.recall = 98; eq([Meta.gift(G, "scout"), G.inv.scout, Meta.gift(G, "recall"), Meta.gift(G, "recall"), G.inv.recall, Meta.gift(G, "nope")], [true, 1, true, false, 99, false], "side quests: a prize adds one use (capped at 99; unknown ids refused)");
  defer("side quests: every Gallery picture carries its quest", () => { const GL = castleGal(); eq(GL.map((l) => l.quest), q, "side quests: levels/gallery.json carries each picture's quest {after, prize} as tools/quests.js deals them"); });
  // v5 R4: pictures 26-50 sit after levels 104-200, which now exist; they open off them one by one. 51-60 (after 203-240)
  // are the long tail: they wait until all 200 levels are cleared, then open one at a time.
  const GL4 = castleGal(), ord = LEVELS.levels.map((l) => l.id), gid = GL4.map((l) => l.id), aft = GL4.map((l) => l.quest.after), R4 = Save.fresh(META), qo = (i) => Save.questOpen(R4, ord, gid, aft, gid[i]);
  for (let i = 0; i < 100; i++) R4.done[ord[i]] = 1;
  const mid = gid.map((id, i) => i).filter((i) => aft[i] > 100 && aft[i] <= ord.length), tailI = gid.map((id, i) => i).filter((i) => aft[i] > ord.length), r0 = mid.map(qo);
  for (let i = 100; i < 150; i++) R4.done[ord[i]] = 1; const r1 = mid.map(qo), t1 = tailI.map(qo); for (const id of ord) R4.done[id] = 1; const r2 = mid.map(qo), t2 = tailI.map(qo);
  eq([mid.map((i) => i + 1), [aft[mid[0]], aft[mid[mid.length - 1]]], r0.some(Boolean), r1.filter(Boolean).length, mid.filter((i) => aft[i] <= 150).length, t1.some(Boolean), r2.every(Boolean), tailI.map((i) => i + 1), t2],
    [Array.from({ length: 25 }, (_, k) => k + 26), [104, 200], false, mid.filter((i) => aft[i] <= 150).length, mid.filter((i) => aft[i] <= 150).length, false, true, Array.from({ length: 10 }, (_, k) => k + 51), [true].concat(Array(9).fill(false))],
    "side quests (v5 R4): pictures 26-50 open off levels 104-200 as each is cleared (shut with 1-100 cleared, open through 150 with 1-150); 51-60 are the long tail: shut until all 200 are cleared, then one at a time");
}

// ---- v5 R3: the journey map (src/journey.js; meta.js egg; the save's eggs; config map against map/layout.json) -----------------
{
  const Save = require("../src/save.js"), Meta = require("../src/meta.js"), J = require("../src/journey.js"), LAY = castleLay(), MC = require("../config.json").map;
  const GL = castleGal(), order = LEVELS.levels.map((l) => l.id), gids = GL.map((l) => l.id), after = GL.map((l) => (l.quest ? l.quest.after : 0));
  // Eggs pay once: the first tap pays its coins and marks it found; a second pays nothing; the save keeps them.
  const D = Save.fresh(META), c0 = D.coins, p1 = Meta.egg(D, "s1-0", 12), p2 = Meta.egg(D, "s1-0", 12), p3 = Meta.egg(D, "s1-1", 5000);
  eq([p1, p2, p3, D.coins - c0, D.eggs], [12, 0, 999, 12 + 999, { "s1-0": 1, "s1-1": 1 }], "eggs: an egg pays its coins on the first tap only (capped at 999 a tap) and is marked found");
  eq([Save.sanitize({ v: 2, eggs: { "s1-0": 1, "s13-1": 1, "s2-0": 2, "x": 1, "s1-1": true } }, order, gids, META).eggs, Save.sanitize({ v: 2, coins: 50 }, order, gids, META).eggs, Save.fresh(META).eggs],
    [{ "s1-0": 1, "s13-1": 1 }, {}, {}], "eggs (save): found eggs read back; junk ids and values are dropped; an old save (no field) and a new one have none found");
  // Nodes: level 1 is next on a new save; a cleared level is done and the next one current; the rest locked.
  const N = Save.fresh(META), st = () => order.slice(0, 5).map((id) => J.nodeState(N, order, id, Save.next(N, order)));
  const s0 = st(); for (let i = 0; i < 3; i++) N.done[order[i]] = 1; const s1 = st();
  eq([s0, s1, J.focus(N, order)], [["cur", "locked", "locked", "locked", "locked"], ["done", "done", "done", "cur", "locked"], order[3]], "map nodes: a new save's level 1 is current; with 1-3 cleared, 4 is current and 5 locked; the map centres on 4");
  // Quest nodes: a quest is locked until its main level is cleared, then open (never blocking), won once cleared.
  const Q = Save.fresh(META), q0 = gids[0], a0 = after[0], qs = () => J.questState(Q, order, gids, after, q0);
  const k0 = qs(); for (let i = 0; i < a0 - 1; i++) Q.done[order[i]] = 1; const k1 = qs(); Q.done[order[a0 - 1]] = 1; const k2 = qs(), k3 = J.questState(Q, order, gids, after, gids[1]); Q.gal[q0] = 1; const k4 = qs();
  eq([k0, k1, k2, k3, k4, J.nodeState(Q, order, order[a0], Save.next(Q, order))], ["locked", "locked", "open", "locked", "won", "cur"], "map quest nodes: picture 1 opens once level " + a0 + " is cleared (not before), picture 2 stays shut, a win marks it won; the campaign's next level is current either way");
  // The long tail: nothing until all levels are cleared; then one node, the first picture past the last level, then the next.
  const T = Save.fresh(META), t0 = J.tail(T, order, gids, after); for (const id of order) T.done[id] = 1; const t1 = J.tail(T, order, gids, after);
  T.gal[t1.next] = 1; const t2 = J.tail(T, order, gids, after);
  eq([t0.ids.length, t0.next, t1.next, t2.next, t2.won, J.focus(T, order)], [after.filter((a) => a > order.length).length, null, t0.ids[0], t0.ids[1], [t0.ids[0]], "tail"], "map long tail: " + t0.ids.length + " pictures past level " + order.length + "; none open until every level is cleared, then one at a time; the won ones are kept for replay; the map centres on the fog node");
  // The route: walked and ahead share the cut sample.
  const R = [[0, 10], [1, 9], [2, 8], [3, 7]], sp = J.split(R, 2);
  eq([sp, J.split(R, -1)[0], J.split(R, 3)[1], J.nearest(R, 2.2, 7.9)], [["M0 10L1 9L2 8", "M2 8L3 7"], "", "", 2], "map route: the road splits at the current node's sample (walked, ahead); nearest finds the sample");
  // The layout and config agree: every level 1-100 has one spot, in order; quests 1-25 sit after their main levels with
  // their prizes; two eggs a sheet, each a known kind paying 10-15; bridges on real road samples, clear of every node.
  const lv = LAY.sheets.flatMap((s) => s.levels.map((l) => l.n)), qv = LAY.sheets.flatMap((s) => s.quests);
  // v5 R4c: the layout runs ahead of the levels (spots for 1-200 on 25 sheets while levels.json may hold fewer); every
  // built level has its spot.
  eq([lv.length, lv.every((n, i) => n === i + 1), LEVELS.levels.every((l) => lv.indexOf(+l.n) >= 0), LAY.sheets.length, LAY.step, LAY.overlap], [200, true, true, 25, 1264, 80], "map layout: spots for levels 1-200, in order, on 25 sheets 1264 px apart; each of the " + order.length + " built levels has one");
  eq(qv.map((q) => [q.q, q.id, q.after, q.prize]), GL.slice(0, qv.length).map((l, i) => [i + 1, l.id, l.quest.after, l.quest.prize]), "map layout: side quests 1-" + qv.length + " match levels/gallery.json (ids, main levels, prizes)");
  const eggs = LAY.sheets.flatMap((s) => s.eggs.map((e, i) => ({ s: s.sheet, i, kind: e.kind, c: J.eggCoins(MC, s.sheet, i) })));
  ok(LAY.sheets.every((s) => s.eggs.length === 2) && eggs.every((e) => J.EGG_KINDS.indexOf(e.kind) >= 0 && e.c >= 10 && e.c <= 15 && MC.text.eggs[e.kind]), "map eggs: two a sheet (" + eggs.length + "), each a drawn kind with names, paying 10-15 coins (" + eggs.reduce((a, e) => a + e.c, 0) + " in all)");
  const far = MC.bridges.map(([sh, i]) => { const S = LAY.sheets[sh - 1], p = S && S.road[i]; if (!p || i < 2 || i > S.road.length - 3) return -1; return Math.min(...S.levels.concat(S.quests).map((n) => Math.hypot(n.x - p[0], n.y - p[1]))); });
  ok(far.every((d) => d >= 60), "map bridges: " + MC.bridges.length + " on real road samples, each at least 60 sheet px from every node (closest " + Math.round(Math.min(...far)) + ")");
  const top = LAY.sheets[LAY.sheets.length - 1], firsts = LAY.sheets.filter((s, k) => k === 0 || LAY.sheets[k - 1].realm !== s.realm).map((s) => s.sheet), L200 = top.levels[top.levels.length - 1];
  ok(top.tail && top.tail.y < L200.y && top.goblinKing && Math.hypot(top.goblinKing.x - L200.x, top.goblinKing.y - L200.y) < 100 && L200.n === 200 && firsts.length === 8, "map: the top sheet holds level 200 with the Goblin King beside it and the long tail's spot above; one realm banner spot per realm (first sheets " + firsts.join(", ") + ")");
  // v5 R4c, the frontier: with 1-100 built it is level 101's spot (sheet 13); with 107, 108's (sheet 14, its bottom); with
  // all 200, the summit's long-tail spot; with none, level 1's. Sheets past it are not built (n).
  const fr = (n) => { const f = J.frontier(LAY, n, MC.tail.room); return [f.si + 1, f.tail, f.n, f.x, f.y]; }, s101 = LAY.sheets.flatMap((S) => S.levels).find((v) => v.n === 101);
  eq([fr(100), fr(107)[0], fr(200), fr(0)[0], J.frontier({ sheets: [] }, 5, 420)], [[13, false, 13, s101.x, s101.y], 14, [25, true, 25, top.tail.x, top.tail.y], 1, null],
    "map frontier: 1-100 built: level 101's spot on sheet 13 (13 sheets built); 1-107: sheet 14; 1-200: the summit's long-tail spot (25 sheets); none: sheet 1; no layout: none");
  // v5 R3 fix: the next-up quest is the open, unwon one nearest the current level; the side picker keeps a bubble off the
  // route and off a banner, not just off nodes.
  const NQ = Save.fresh(META); for (let i = 0; i < 55; i++) NQ.done[order[i]] = 1; for (let i = 0; i < 3; i++) NQ.gal[gids[i]] = 1;
  const nq = J.nearQuest(NQ, order, gids, after, 56), nqWant = gids.filter((id, i) => after[i] <= 55 && !NQ.gal[id]).pop();
  eq([nq, J.nearQuest(NQ, order, gids, after, 56, nqWant) !== nqWant, J.nearQuest(Save.fresh(META), order, gids, after, 1)], [nqWant, true, null], "map next-up quest: with 1-55 cleared and pictures 1-3 won, the open quest nearest level 56 (picture " + (gids.indexOf(nqWant) + 1) + "), not picture 4; skip leaves it out; none open, none");
  const road = [[100, 0], [100, 50], [100, 100], [100, 150], [100, 200]];
  eq([J.side([60, 100], [], 30, 20, 10, 400, ["e", "w"], road, 8, []), J.side([60, 100], [], 30, 20, 10, 400, ["e", "w"], [], 8, []), J.side([200, 100], [], 30, 20, 10, 400, ["e", "n", "s"], [], 8, [[205, 60, 300, 100]]), J.side([390, 100], [], 30, 20, 10, 400, ["e", "w"], [], 8, [])],
    ["w", "e", "s", "w"], "map side picker: a bubble leaves the side the route runs through, keeps its first side when nothing is in the way, avoids a banner box, never leaves the sheet");
  // v5 R3 fix: every two tap targets (levels, side quests, eggs, the long tail's node), across sheets too, are at least
  // 48 CSS px apart, centre to centre, on a 375-wide phone (their discs are 44).
  const kp = 375 / LAY.w, tg = LAY.sheets.flatMap((S, si) => { const wy = (y) => (LAY.sheets.length - 1 - si) * LAY.step + y, o = S.levels.map((p) => ["level " + p.n, p.x, wy(p.y)]).concat(S.quests.map((q) => ["quest " + q.q, q.x, wy(q.y)]), S.eggs.map((g, i) => ["egg " + J.eggId(S.sheet, i), g.x, wy(g.y)]));
    if (S.tail) o.push(["the long tail", S.tail.x, wy(S.tail.y)]); return o; });
  let close = [Infinity, ""]; for (let i = 0; i < tg.length; i++) for (let j = i + 1; j < tg.length; j++) { const d = Math.hypot(tg[i][1] - tg[j][1], tg[i][2] - tg[j][2]) * kp; if (d < close[0]) close = [d, tg[i][0] + " and " + tg[j][0]]; }
  ok(close[0] >= 48, "map spacing: " + tg.length + " tap targets, every pair at least 48 CSS px apart at 375 wide (closest " + close[0].toFixed(1) + ", " + close[1] + ")");
  // v5 R3 fix, old saves by slot (Peter's call): a v4.3 save (format 2, v4.3's ids: e1-25, e2-50, e3-75, e4-100 sat at
  // the end of their eras) with all 100 cleared and pictures 1-25 won loads with all 100 cleared, picture 25 and the long
  // tail open, its bests and last moved to the renamed ids, and no first clear left to pay on the four renamed levels.
  const v43 = Array.from({ length: 100 }, (_, i) => "e" + Math.ceil((i + 1) / 25) + "-" + String(i + 1).padStart(2, "0")), ren = v43.filter((id) => order.indexOf(id) < 0);
  const raw43 = { v: 2, done: {}, gal: {}, settings: { muted: false, speed: 1, cb: false }, last: "e4-100", coins: 900, inv: {}, best: {}, lives: { n: 5, at: 0 } };
  v43.forEach((id, i) => { raw43.done[id] = 1; raw43.best[id] = [30000 + i, 20 + (i % 9), 45]; }); gids.slice(0, 25).forEach((id) => { raw43.gal[id] = 1; raw43.best[id] = [40000, 30, 60]; });
  const m43 = Save.sanitize(JSON.parse(JSON.stringify(raw43)), order, gids, META), t43 = J.tail(m43, order, gids, after), news = ren.map((id) => order[+id.split("-")[1] - 1]);
  eq([ren, news, Object.keys(m43.done).length, news.map((id) => m43.done[id]), news.map((id) => m43.best[id]), m43.last, Save.next(m43, order), J.focus(m43, order), Save.questOpen(m43, order, gids, after, gids[24]), t43.next, news.map((id) => Save.record(m43, id))],
    [["e1-25", "e2-50", "e3-75", "e4-100"], ["e2-25", "e3-50", "e4-75", "e5-100"], 100, [1, 1, 1, 1], ren.map((id) => raw43.best[id]), "e5-100", order[100], order[100], true, null, [false, false, false, false]],
    "old saves by slot: a v4.3 save's e1-25, e2-50, e3-75, e4-100 load as e2-25, e3-50, e4-75, e5-100 (cleared, bests, last); all 100 cleared, picture 25 open; v5 R4: level 101 is next (the long tail waits for 200); no first clear left to pay");
  const v42 = Save.sanitize(JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "saves", "v4.2.json"), "utf8")), order, gids, META);
  eq([Object.keys(v42.done).length, v42.last, J.focus(v42, order), news.map((id) => Save.record(v42, id))], [100, "e5-100", order[100], [false, false, false, false]], "old saves by slot: the shipped v4.2 save (format 1) keeps all 100 cleared; last moves to e5-100; the map centres on level 101 (v5 R4)");
  const both = Save.sanitize({ v: 2, done: { "e1-25": 1, "e2-25": 1, "e9-999": 1, x: 1 }, best: { "e1-25": [9, 9, 9], "e2-25": [1, 2, 3] } }, order, gids, META);
  eq([Object.keys(both.done).sort(), both.best["e2-25"], Save.sanitize(m43, order, gids, META)], [["e2-25"], [1, 2, 3], m43], "old saves by slot: an id the page has wins over a renamed one; ids with no slot are dropped; a migrated save reads back unchanged");
}

// ---- v5.1: a win goes back to the map; the x2 reward's AD HOOK (meta.js double; config meta.double, off) -------------------
{
  const Meta = require("../src/meta.js"), CFG = require("../config.json"), src = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "main.js"), "utf8");
  const d = { coins: 100 }, r = { coins: 30 }, a = Meta.double(d, r), c1 = d.coins, b = Meta.double(d, r), big = { coins: Meta.MAXCOINS - 10 }, rb = { coins: 30 };
  eq([a, c1, r.dbl, b, d.coins, Meta.double({ coins: 5 }, { coins: 0 }), Meta.double({ coins: 5 }, null), Meta.double(big, rb), big.coins, Meta.double(big, rb)], [30, 130, 30, 0, 130, 0, 0, 10, Meta.MAXCOINS, 0],
    "x2 reward (v5.1): double pays a win's coins once more, once per win (the report remembers it); nothing to double pays nothing; the balance stays capped");
  eq([CFG.meta.double.on, typeof CFG.meta.double.btn, typeof CFG.meta.double.toast, CFG.layout.toMap, CFG.gallery.nextBtn], [false, "string", "string", "Back to map", undefined],
    "x2 reward (v5.1): its switch is off (no ad SDK, nothing shows); the win sheet's way back reads 'Back to map'; the old 'Next picture' label is gone");
  const body = (name) => { const i = src.indexOf("function " + name + "("); return i < 0 ? "" : src.slice(i, src.indexOf("\n", i)); }, pp = body("panelPrimary"), ps = body("panelSecondary");
  ok(/"win"\) toMap\(\); else retry\(\)/.test(pp) && /"win"\) retry\(\); else toMap\(\)/.test(ps) && !/startLevel|playNext/.test(pp + ps) && /D\.on !== true/.test(body("onDouble")) && /D\.on === true/.test(src.slice(src.indexOf("function x2Offer("), src.indexOf("function onDouble("))),
    "win flow (v5.1): the win sheet's main button goes to the map (never into a level), its second retries; a fail's main retries, its second goes to the map; the x2 button and its tap need meta.double.on");
}

// ---- v5.2: music (src/audio.js pick and the switches; config audio.music; the save's music and sfx) --------------------
{
  const Audio = require("../src/audio.js"), Save = require("../src/save.js"), CFG = require("../config.json"), fs = require("fs"), path = require("path");
  const M = CFG.audio.music, order = LEVELS.levels.map((l) => l.id), lvl = (n) => { const L = LEVELS.levels.find((x) => x.n === n); return { era: L.era, n }; };
  // The track per screen and realm.
  eq([Audio.pick(M, "title", null), Audio.pick(M, "map", null), Audio.pick(M, "map", lvl(180)), Audio.pick(M, "play", lvl(1)), Audio.pick(M, "play", lvl(174)), Audio.pick(M, "play", lvl(175)), Audio.pick(M, "play", lvl(200)),
    Audio.pick(M, "play", { era: 0, gallery: true }), Audio.pick(M, "play", { era: 8, gallery: true }), Audio.pick(M, "play", { era: 0, debug: true }), Audio.pick(M, "play", null), Audio.pick(M, "nowhere", null), Audio.pick(null, "play", lvl(1))],
    ["theme", "theme", "theme", "play", "play", "boss", "boss", "play", "play", "play", "play", null, null],
    "music (v5.2): home and map the theme; a level the play loop, realm 8 (175-200, era " + lvl(175).era + ") the boss loop; side quests and debug levels the play loop; no music config, no track");
  ok(LEVELS.levels.filter((L) => Audio.pick(M, "play", { era: L.era }) === "boss").map((L) => L.n).join() === Array.from({ length: 26 }, (_, i) => 175 + i).join(), "music (v5.2): exactly levels 175-200 play the boss loop");
  // The switches, on a page with no context (Node): independent; the quick mute turns both off, or both on when both are off.
  const A = Audio.create(CFG.audio, (f) => f + "?v=1"), st = () => [A.sfx, A.music, A.muted, Audio.state(A)];
  const r0 = st(); Audio.setMusic(A, false); const r1 = st(); Audio.setSfx(A, false); const r2 = st(); Audio.setMusic(A, true); const r3 = st();
  const q1 = Audio.quick(A); Audio.setSfx(A, q1.sfx); Audio.setMusic(A, q1.music); const r4 = st(); const q2 = Audio.quick(A); Audio.setMuted(A, !q2.sfx); const r5 = st();
  eq([r0, r1, r2, r3, q1, r4, q2, r5], [[true, true, false, "on"], [true, false, false, "mixed"], [false, false, true, "off"], [false, true, false, "mixed"], { sfx: false, music: false }, [false, false, true, "off"], { sfx: true, music: true }, [true, true, false, "on"]],
    "music (v5.2): music and effects switch apart (muted only when both are off; state mixed with one off); a quick mute with anything on turns both off, with both off turns both on");
  Audio.want(A, "theme"); Audio.kick(A); Audio.unlock(A);
  eq([A.ctx, A.fetches, A.want, A.url("audio/x.m4a"), Audio.jingle(A)], [null, 0, "theme", "audio/x.m4a?v=1", false], "music (v5.2): with no gesture (no context) a wanted track is only remembered: nothing is fetched, the jingle does nothing; the page's cache tag goes on the file");
  // Effects off: a cue is counted but never reaches the synth (a fake running context records any node made).
  const made = []; const node = () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : (o[k] = typeof k === "string" && /^(connect|start|stop|setValueAtTime|exponentialRampToValueAtTime|linearRampToValueAtTime|cancelScheduledValues)$/.test(k) ? () => node() : node())) });
  const B = Audio.create(CFG.audio); B.ctx = { state: "running", currentTime: 0, sampleRate: 44100, createGain: () => (made.push("g"), node()), createOscillator: () => (made.push("o"), node()), createBufferSource: () => (made.push("b"), node()), createBiquadFilter: () => (made.push("f"), node()) }; B.out = node();
  Audio.setSfx(B, false); const c1 = Audio.cue(B, "ui", 0, 0), n1 = made.length; Audio.setSfx(B, true); const c2 = Audio.cue(B, "ui", 0, 1000);
  eq([c1, n1, B.counts.ui, c2, made.length > 0], [false, 0, 2, true, true], "music (v5.2): with effects off a cue is counted but makes no sound; on, it plays");
  // The save: music and sfx strict booleans; a save from before v5.2 loads both as the opposite of its muted flag.
  const set = (raw) => Save.sanitize({ settings: raw }, order).settings, ms = (o) => [o.music, o.sfx, o.muted];
  eq([ms(set({})), ms(set({ muted: true })), ms(set({ muted: false })), ms(set({ muted: "yes" })), ms(set({ music: false, sfx: true })), ms(set({ music: true, sfx: false, muted: true })), ms(set({ music: false, sfx: false })), ms(set({ music: "no", sfx: 0, muted: true }))],
    [[true, true, false], [false, false, true], [true, true, false], [true, true, false], [false, true, false], [true, false, false], [false, false, true], [false, false, true]],
    "save (v5.2): music and sound effects saved apart (strict booleans); an older save's muted flag sets both; muted is kept as both off");
  const sv = Save.sanitize({ v: 2, settings: { music: false, sfx: true, speed: 1, cb: true } }, order); eq(Save.sanitize(JSON.parse(JSON.stringify(sv)), order).settings, sv.settings, "save (v5.2): the settings read back unchanged");
  // Config and files: the loops' points, the volumes, every file on disk; the jingle and order name tracks.
  const T = M.tracks, loops = ["theme", "play", "boss"], sizes = Object.values(T).map((t) => { try { return fs.statSync(path.join(__dirname, "..", t.file)).size; } catch (e) { return 0; } });
  ok(loops.every((k) => T[k] && T[k].loopStart > 0 && T[k].loopEnd - T[k].loopStart > 30 && T[k].gain > 0 && T[k].gain <= 2) && T[M.jingle] && T[M.jingle].loopEnd == null && M.order.every((k) => T[k]) && Object.values(M.screens).concat(M.bossTrack).every((k) => T[k]) && sizes.every((b) => b > 1000),
    "music (v5.2): config's three loops have loop points and gains, the jingle is a one-shot, every screen, the boss and the fetch order name a track, every file is in audio/ (" + sizes.map((b) => Math.round(b / 1024) + " KB").join(", ") + ")");
  ok(M.volume >= 0.35 && M.volume <= 0.45 && M.volume < CFG.audio.volume && M.fadeMs >= 600 && M.fadeMs <= 1000 && M.duck.gain < 1 && M.bossRealms.join() === "8", "music (v5.2): the music bus (" + M.volume + ") sits under the effects (" + CFG.audio.volume + "); the crossfade is " + M.fadeMs + " ms; the boss realm is 8");
  ok(sizes.reduce((a, b) => a + b, 0) < 4.2e6, "music (v5.2): the audio folder is under ~4 MB (" + (sizes.reduce((a, b) => a + b, 0) / 1e6).toFixed(2) + " MB for the files config names)");
  // Source checks: the music runs on the audio clock (no timers); every ?v= in index.html and the font URL is the same tag.
  const asrc = fs.readFileSync(path.join(__dirname, "..", "src", "audio.js"), "utf8"), html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"), css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
  const tags = (html + css).match(/\?v=\d+/g) || [];
  ok(!/setTimeout|setInterval/.test(asrc) && tags.length >= 10 && tags.every((t) => t === tags[0]) && /fonts\/Jersey10-Regular\.ttf\?v=/.test(css), "music (v5.2): audio.js uses no timers; one cache tag (" + tags[0] + ") across index.html and the font URL (" + tags.length + " uses)");
  ok(/class="set-row tog tog-music"/.test(html) && /class="set-row tog tog-sfx"/.test(html) && !/set-row tog tog-mute/.test(html) && (html.match(/class="round tog tog-mute"/g) || []).length === 1 && /<header id="top">[\s\S]*id="btn-pset"[\s\S]*<\/header>/.test(html) && !/<header id="top">(?:(?!<\/header>)[\s\S])*tog-mute/.test(html),
    "music (v5.2): settings has a Music row and a Sound effects row; the Paused sheet keeps its quick mute button; lands foundation: the top bar has the gear (btn-pset) where its quick mute was");
}

// ---- v5.4: reset and the save code (save.js reset, encode, decode; config reset, saveCode) -------------------------------
{
  const Save = require("../src/save.js"), CFG = require("../config.json"), zlib = require("zlib"), fs = require("fs"), path = require("path");
  const order = LEVELS.levels.map((l) => l.id), gids = require("../levels/gallery.json").levels.map((l) => l.id), J = (o) => JSON.stringify(o);
  // A mid-game save: levels 1-90 cleared with best rows, 12 side quests, eggs, power-ups, last at 90; preferences off/on.
  let r = 12345; const rnd = (k) => { r = (r * 1103515245 + 12345) % 2147483648; return Math.floor((r / 2147483648) * k); };
  const mid = Save.fresh(META); mid.coins = 218; mid.inv = { ladder: 2, quartermaster: 1, scout: 0, recall: 3, volley: 1 }; mid.got = { ladder: 1, quartermaster: 1, scout: 1, recall: 1 };
  for (let i = 0; i < 90; i++) { mid.done[order[i]] = 1; mid.best[order[i]] = [15000 + rnd(90000), 8 + rnd(40), 30 + rnd(200)]; }
  for (let i = 0; i < 12; i++) { mid.gal[gids[i]] = 1; mid.best[gids[i]] = [20000 + rnd(60000), 10 + rnd(30), 40 + rnd(100)]; }
  for (let s = 1; s <= 10; s++) mid.eggs["s" + s + "-" + (s % 2)] = 1; mid.last = order[89]; mid.settings = { muted: false, music: false, sfx: true, speed: 1, cb: true };
  const sv = Save.sanitize(JSON.parse(J(mid)), order, gids, META), code = Save.encode(sv, gids), back = Save.decode(code, order, gids, META, sv.settings);
  ok(J(sv) === J(mid), "save code: the mid-game fixture is a sanitized save");
  eq([code.slice(0, 4), /^SP1\.[A-Za-z0-9_-]+$/.test(code), back.ok, J(back.data) === J(sv), Save.encode(back.data, gids) === code], ["SP1.", true, true, true, true], "save code: a mid-game save (level 91, 90 levels with bests, 12 side quests, 10 eggs, power-ups) round-trips exactly through the code (" + code.length + " characters)");
  ok(code.length <= 1100, "save code: a mid-game code stays short (" + code.length + " characters; limit 1100)");
  const f0 = Save.fresh(META), fc = Save.encode(f0, gids); eq([fc.length <= 40, J(Save.decode(fc, order, gids, META, f0.settings).data) === J(f0)], [true, true], "save code: a new save's code is " + fc.length + " characters and round-trips");
  // Every Gallery picture and every level cleared (the longest code a player can have today).
  const full = Save.fresh(META); for (const id of order) { full.done[id] = 1; full.best[id] = [600000, 120, 999]; } for (const id of gids) { full.gal[id] = 1; full.best[id] = [600000, 120, 999]; }
  const fullC = Save.encode(full, gids); ok(J(Save.decode(fullC, order, gids, META, full.settings).data) === J(full), "save code: every level and picture cleared round-trips (" + fullC.length + " characters)");
  // The body is base64url as Node writes it, with a CRC-32 Node agrees with.
  const raw = Buffer.from(code.slice(4), "base64url"), body = raw.subarray(0, raw.length - 4);
  eq([raw.toString("base64url") === code.slice(4), raw.readUInt32BE(raw.length - 4) === zlib.crc32(body)], [true, true], "save code: canonical base64url; the last 4 bytes are the body's CRC-32 (zlib agrees)");
  // The checksum catches mistakes: every single-character change to the body, a truncation, an extra character.
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"; let caught = 0, tried = 0;
  for (let i = 4; i < code.length; i++) { const c2 = code.slice(0, i) + B64[(B64.indexOf(code[i]) + 1 + rnd(63)) % 64] + code.slice(i + 1); tried++; if (!Save.decode(c2, order, gids, META).ok) caught++; }
  eq([caught, tried], [tried, tried], "save code: every changed character is rejected (" + caught + "/" + tried + ")");
  const cuts = [1, 2, 3, 5, 40, code.length - 10].map((k) => Save.decode(code.slice(0, code.length - k), order, gids, META));
  eq(cuts.map((x) => x.ok + ":" + x.err), cuts.map(() => "false:broken"), "save code: a truncated code (1, 2, 3, 5, 40 characters short; just the start) is rejected as broken");
  eq([Save.decode(code + "A", order, gids, META).ok, Save.decode(code.slice(0, 10) + code.slice(11), order, gids, META).ok, Save.decode(code.replace("SP1.", "SP2."), order, gids, META).err, Save.decode("hello", order, gids, META).err, Save.decode("", order, gids, META).err, Save.decode(null, order, gids, META).err, Save.decode({}, order, gids, META).err],
    [false, false, "newer", "prefix", "empty", "empty", "prefix"], "save code: an extra or a dropped character is rejected; SP2. is a newer code; other text is not a code; empty and junk inputs never throw");
  const wrapped = "  " + code.slice(0, 50) + "\n" + code.slice(50, 300) + " \r\n" + code.slice(300) + "\n"; ok(Save.decode(wrapped, order, gids, META, sv.settings).ok && J(Save.decode(wrapped, order, gids, META, sv.settings).data) === J(sv), "save code: line breaks and spaces (a wrapped paste) are ignored");
  ok(!Save.decode(code, order, gids, META, null, 100).ok, "save code: a paste is read to maxPaste characters at most (a 100-character cap rejects it)");
  // A hostile code, hand-made with a valid checksum: huge numbers, slots and pictures the page doesn't have, junk eggs, a
  // last level that isn't open, unknown power-up slots; and bodies of the wrong shape (an unknown format, a body that ends
  // mid-field, bytes after its end, a varint that never ends). Every value comes out clamped as sanitize allows.
  const vint = (v) => { const o = []; while (v >= 128) { o.push((v % 128) | 128); v = Math.floor(v / 128); } o.push(v); return o; };
  const mk = (vals, extra) => { const b = Buffer.from(vals.flatMap(vint).concat(extra || [])), c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(b)); return "SP1." + Buffer.concat([b, c]).toString("base64url"); };
  const H = [2, 9e15, 7, 500, 1e12, 300, 200, 120, 5, 2 ** 40, 255, // v, coins, 7 inventory counts (two past POWERS), got with stray bits
    3, 1, 9e9, 9e9, 9e9, 9998, 5, 5, 5, 7, 1, 1, 1, // three levels: slot 1 (huge best), slot 9999 (none), slot 10006
    2, 1, 1, 1, 1, 400, 2, 2, 2, // pictures: 1 and 401 (none)
    3, 1, 0, 5000, 1, 1, 777, // eggs: s1-0, s5000-1, s1-777
    150, 77, 8.64e15 + 5]; // last at slot 150 (not open), lives 77, a time past the cap
  const hz = Save.decode(mk(H), order, gids, META, sv.settings), hd = hz.data;
  eq([hz.ok, hd.coins, hd.inv, hd.got, Object.keys(hd.done), hd.best[order[0]], Object.keys(hd.gal), Object.keys(hd.eggs), hd.last, hd.lives.n <= META.livesMax, hd.lives.at, hd.settings, J(Save.sanitize(JSON.parse(J(hd)), order, gids, META)) === J(hd)],
    [true, 9999999, { ladder: 99, quartermaster: 99, scout: 99, recall: 99, volley: 99 }, { ladder: 1, quartermaster: 1, scout: 1, recall: 1, volley: 1 }, [order[0]], [3600000, 999, 9999999], [gids[0]], ["s1-0"], null, true, 8.64e15, sv.settings, true],
    "save code: a hostile code (9e15 coins, inventory 500 and 1e12, unknown slots and pictures, junk eggs, a locked last level) loads clamped: coins and counts at their caps, only ids the page has, last dropped, the device's preferences kept");
  const shapes = [mk([7, 0]), mk(H.slice(0, 20)), mk(H, [0]), mk([2], [255, 255, 255, 255, 255, 255, 255, 255, 255]), mk([2, 5, 0, 0, 0, 1e6])];
  eq(shapes.map((c) => { const x = Save.decode(c, order, gids, META); return x.ok + ":" + x.err; }), ["false:body", "false:body", "false:body", "false:body", "false:body"], "save code: wrong shapes with a good checksum (format 7, a body cut mid-field, a byte past the end, an endless varint, a count past the body) are refused, never thrown");
  // An older page's code: the shipped v4.2 save (format 1: difficulty masks, old ids like e1-25, 7-number best rows), made
  // into a code, loads exactly as that save loads from storage (migrated by id and slot, bests folded).
  for (const ver of ["v3", "v4.2"]) {
    const old = JSON.parse(fs.readFileSync(path.join(__dirname, "saves", ver + ".json"), "utf8")), want = Save.sanitize(JSON.parse(J(old)), order, gids, META), oc = Save.encode(old, gids), got = Save.decode(oc, order, gids, META, want.settings);
    eq([oc.slice(0, 4), got.ok, got.v, J(got.data) === J(want), Object.keys(got.data.done).length], ["SP1.", true, 1, true, Object.keys(want.done).length], "save code: an older page's code (the " + ver + " save, format 1) migrates the way the stored save does (" + Object.keys(want.done).length + " levels, last " + want.last + ")");
  }
  // Reset: progress gone, preferences kept, written once, the cloud hook told.
  const store = Save.memoryStore(), key = CFG.save.key, h = Save.open(store, key, order, gids, META); h.data = JSON.parse(J(sv)); h.write();
  let told = null; Save.cloud.reset = (k) => { told = k; }; const w = Save.reset(h, META); Save.cloud.reset = null;
  const re = Save.open(store, key, order, gids, META).data, fr = Save.fresh(META);
  eq([w, told, re.settings, J(Object.assign({}, re, { settings: null })) === J(Object.assign({}, fr, { settings: null })), Save.next(re, order), re.coins, Object.keys(re.gal).length + Object.keys(re.eggs).length + Object.keys(re.best).length],
    [true, key, sv.settings, true, order[0], META.coins.start, 0], "reset: levels, coins, power-ups, side quests, eggs and bests back to a new save (level 1, " + META.coins.start + " coins); music off, effects on, colour-blind on kept; written; the cloud hook told with the key");
  Save.cloud.reset = () => { throw new Error("cloud down"); }; const h2 = Save.open(Save.memoryStore(), key, order, gids, META); h2.data.coins = 5; const w2 = Save.reset(h2, META); Save.cloud.reset = null;
  eq([w2, h2.data.coins], [true, META.coins.start], "reset: a failing cloud hook never undoes the local reset");
  // Config: the switches and the words the page reads.
  const SC = CFG.saveCode, RS = CFG.reset;
  ok(SC.on === true && SC.portalOn === false && SC.maxPaste >= 4 * fullC.length && RS.holdMs >= 1000 && RS.holdMs <= 2500 && ["empty", "prefix", "newer", "broken", "body"].every((k) => typeof SC.text.err[k] === "string") && /level/i.test(RS.text.lose) && /coins/.test(RS.text.lose) && /power-ups/.test(RS.text.lose) && /side quests/.test(RS.text.lose) && /easter eggs/.test(RS.text.lose) && /Music/.test(RS.text.keep),
    "config (v5.4): saveCode on for the web build (portalOn false for the portal), maxPaste " + SC.maxPaste + " fits 4 full codes; reset holds " + RS.holdMs + " ms and says what goes (levels, coins, power-ups, side quests, eggs) and what stays");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  ok(/id="set-copy"/.test(html) && /id="set-load"/.test(html) && /id="set-reset"/.test(html) && html.indexOf('id="set-close"') < html.indexOf('id="set-reset"') && /<meta property="og:image" content="https:\/\/pf-builds\.github\.io\/games\/sappers-path\/thumb\.jpg">/.test(html) && /<meta name="twitter:card" content="summary_large_image">/.test(html),
    "index (v5.4): Settings has Copy and Load save code and, after Done, Reset progress; the share card points at the arcade's thumb.jpg");
}

// ---- lands foundation (SPEC-v4 §9, the lands foundation entry; tools/lands-foundation-notes.md) ---------------------------
{
  const fs = require("fs"), path = require("path"), os = require("os"), CFG = require("../config.json"), LC = CFG.lands, J = require("../src/journey.js"), TG = require("./tags.js");
  const LP = require("./land-plan.js"), LB = require("./land-bake.js"), SH = require("./shade.js"), QS = require("./quests.js"), LND = require("./land.js"), LCF = require("./land-config.json"), D5 = CFG.v5.density;
  // Config: the lands block, and every built land in it against the levels, the layout and its own land.json.
  ok(LC.castleEnd === 200 && LC.castleRealms === CFG.eras.length && LC.perLand === 50 && ["eye", "of", "home", "bannerAria"].every((k) => /\{k\}/.test(LC.text[k])) && /\{name\}/.test(LC.epilogue.first) && LC.epilogue.none && LC.shadeTip[0].say && LC.shadeTip[0].short && Array.isArray(LC.list),
    "lands (config): the castle story ends at " + LC.castleEnd + " after " + LC.castleRealms + " realms; lands of " + LC.perLand + "; Land words, the epilogue and the shade tip; " + LC.list.length + " built");
  // Mirror math: a mirrored entry has every x at w - x (levels, quests and their branch, eggs, road, entry, exit, tail);
  // twice is the entry itself; an unmirrored entry and a layout with none come back as the same object.
  const S0 = { sheet: 26, file: "a.webp", levels: [{ n: 201, x: 100, y: 900 }], quests: [{ q: 61, x: 600, y: 500, branch: [400, 520] }], eggs: [{ kind: "grass", x: 50, y: 60 }], road: [[384, 1344], [300, 700], [384, 0]], entry: [384, 1344], exit: [384, 0], tail: { x: 200, y: 80, fog: 0 } };
  const M1 = J.mirrorSheet(Object.assign({}, S0, { mirror: true }), 768), M2 = J.mirrorSheet(Object.assign({}, M1, { mirror: true }), 768), Lm = { w: 768, sheets: [S0] };
  eq([M1.levels[0].x, M1.quests[0].x, M1.quests[0].branch, M1.eggs[0].x, M1.road.map((p) => p[0]), M1.entry, M1.exit, M1.tail.x, M1.levels[0].y, JSON.stringify(Object.assign({}, M2, { mirror: undefined })) === JSON.stringify(Object.assign({}, S0, { mirror: undefined })), J.mirrorSheet(S0, 768) === S0, J.layoutOf(Lm) === Lm, J.layoutOf({ w: 768, sheets: [S0, Object.assign({}, S0, { mirror: true })] }).sheets[1].levels[0].x, S0.levels[0].x],
    [668, 168, [368, 520], 718, [384, 468, 384], [384, 1344], [384, 0], 568, 900, true, true, true, 668, 100], "lands (map): a mirrored entry's marks sit at 768 - x (the road still meets x = 384), y unchanged; mirrored twice it is itself; nothing else is touched");
  // The long tail moves past the last land: castle pictures 26-50 keep their levels, 51-60 (past 200) move on by however
  // far the lands reach; a land's own quests never move; with the castle alone nothing changes.
  const GL = castleGal(), aft = GL.map((l) => l.quest.after), sh = (last) => aft.map((a) => J.tailAfter(a, LC.castleEnd, last));
  const order250 = Array.from({ length: 250 }, (_, i) => "x" + i), gid = GL.map((l) => l.id).concat(["w1", "w2"]), af250 = sh(250).concat([204, 208]), T0 = require("../src/save.js").fresh(META);
  for (const id of order250) T0.done[id] = 1; const tl = J.tail(T0, order250, gid, af250);
  eq([sh(200).join() === aft.join(), sh(250).slice(25, 50).join() === aft.slice(25, 50).join(), sh(250).slice(50).map((a, i) => a - aft[50 + i]), tl.ids.length, tl.ids[0] === GL[50].id, J.landOf({ list: [{ k: 1, from: 201, to: 250 }] }, 230).k, J.landOf({ list: [] }, 230)],
    [true, true, Array(10).fill(50), 10, true, 1, null], "lands (long tail): with 200 levels nothing moves; with a land to 250, pictures 26-50 stay, 51-60 move on 50 levels and stay the long tail (the land's own side quests are not in it)");
  // Tags and plan from the default profile (a 50-level land): the shares, the breathers, runs no longer than the
  // profile's, Easy after every run, the end; every level within the density floor; features per level rise with the
  // tag; each feature on its share; a harder profile asks for more.
  const P = LP.profileOf({}, { profile: LCF.profile }), tags = LP.landTags(50, P.tags, 50), cnt = (t) => tags.filter((x) => x === t).length, plan = LP.landPlan(tags, { features: ["linked", "mystery", "hidden", "lock"] }, P, 201, D5);
  const runs = []; let rn = 0; tags.forEach((t, i) => { if (t === "hard" || t === "extreme") rn++; else { if (rn) runs.push(rn); rn = 0; } if (t === "easy" && i && tags[i - 1] !== "hard" && tags[i - 1] !== "extreme") runs.push(-1); });
  const stand = plan.map((p) => ({ grid: ["."], cols: [p.mystery ? [[1, 1, 1]] : [[1, 1]]], links: p.links ? [[[0, 0], [1, 0]]] : null, hidden: p.hidden ? ["?"] : null, lock: p.lock ? { colour: 1 } : null }));
  const feats = (i) => TG.featuresOf(stand[i]).length + (stand[i].lock ? 1 : 0), meanOf = (t) => { const ix = tags.map((x, i) => (x === t ? i : -1)).filter((i) => i >= 0); return ix.reduce((a, i) => a + feats(i), 0) / ix.length; };
  const share = (k) => plan.filter((p) => (k === "lock" ? p.lock : p.feats.indexOf(k) >= 0)).length / 50, hard = LP.profileOf({ profile: { features: { mystery: { share: 0.9 } }, tags: { shares: { easy: 0.1, normal: 0.2, hard: 0.4, extreme: 0.3 } } } }, { profile: LCF.profile });
  const tagsH = LP.landTags(50, hard.tags, 50), planH = LP.landPlan(tagsH, { features: ["linked", "mystery", "hidden", "lock"] }, hard, 201, D5);
  eq([cnt("easy") >= P.tags.breathers, Math.abs(cnt("normal") - 50 * P.tags.shares.normal) <= 1, Math.abs(cnt("hard") - 50 * P.tags.shares.hard) <= 1, Math.abs(cnt("extreme") - 50 * P.tags.shares.extreme) <= 1, Math.max(...runs) <= P.tags.run[1], runs.indexOf(-1) < 0, tags[49], tags[0],
    plan.every((p, i) => TG.landDensityOK(tags[i], stand[i], ["linked", "mystery", "hidden", "lock"], D5)), ["easy", "normal", "hard", "extreme"].map(meanOf).every((v, i, a) => !i || v >= a[i - 1]), ["mystery", "hidden", "linked", "lock"].every((k) => share(k) >= P.features[k].share - 0.011),
    planH.filter((p) => p.feats.indexOf("mystery") >= 0).length > plan.filter((p) => p.feats.indexOf("mystery") >= 0).length, tagsH.filter((t) => t === "hard" || t === "extreme").length > tags.filter((t) => t === "hard" || t === "extreme").length, LP.landTags(10, P.tags, 50).filter((t) => t === "easy").length >= 1],
    [true, true, true, true, true, true, P.tags.end, "normal", true, true, true, true, true, true], "lands (profile): tags " + tags.map((t) => t[0] + (t === "extreme" ? "x" : "")).join("") + " (E" + cnt("easy") + "/N" + cnt("normal") + "/H" + cnt("hard") + "/X" + cnt("extreme") + ", runs " + runs.join(",") + "); every plan within the density floor; features per level rise with the tag (" + ["easy", "normal", "hard", "extreme"].map((t) => meanOf(t).toFixed(1)).join("/") + "); each feature on its share; a harder profile asks for more");
  throws(() => LP.landPlan(tags, { features: ["moatRing"] }, P, 1, D5), "lands (extension point): a feature with no builder yet (a moat ring) is refused by the plan");
  ok(["hidden", "lock", "linked", "mystery"].every((k) => typeof LB.FEATURES[k] === "function"), "lands (extension point): tools/land-bake.js FEATURES builds every deck feature a profile names");
  // A land's side quests (the Wandering Gallery): every 3-5 levels inside the land, prizes on in turn after the castle's 60.
  const lq = QS.landQuestsOf({ from: 201, to: 250 }, CFG.gallery.quests, META.powers, 60, 99), all = QS.questsOf(72, CFG.gallery.quests, META.powers), lg = lq.slice(1).map((q, i) => q.after - lq[i].after);
  eq([lq.length, lq[0].after, lg.every((g) => g >= 3 && g <= 5), lq[lq.length - 1].after <= 250, lq.map((q) => q.prize).join() === all.slice(60).map((q) => q.prize).join()], [12, 204, true, true, true], "lands (side quests): 12 in a 50-level land, from 204, every 3-5 levels, inside it; prizes continue the castle's turn (" + lq.map((q) => q.prize[0]).join("") + ")");
  // Shading on a hand image: a two-colour painting whose halves each run dark to light gets shades on both colours that
  // keep the floors, digits that follow the light, and the same board and grid as the flat plan; a shade set onto
  // another colour fails the check.
  const w = 40, h = 24, rgba = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const b = x % 20, t = b < 7 ? 0.8 : b < 14 ? 0.9 : 1, o = (y * w + x) * 4; if (x < 20) rgba.set([40 * t, 90 * t, 210 * t, 255], o); else rgba.set([235 * t, 190 * t, 50 * t, 255], o); }
  const CC = require("./gallery-config.json").convert, op = { kind: "painting", box: [20, 12] }, PL0 = CV.plan({ w, h, rgba }, op, CC), sd = SH.shadeOf({ w, h, rgba }, PL0, op, CC);
  const chk = sd && SH.checkLevel(Object.assign({ w: PL0.w, h: PL0.h, grid: PL0.grid }, sd), CC), Bf = E.compile(Object.assign({ cols: [[], [], [], [], []] }, PL0)), Bs = E.compile(Object.assign({ cols: [[], [], [], [], []], shade: sd && sd.shade }, PL0, { pal: sd && sd.pal }));
  const bad = sd && JSON.parse(JSON.stringify(sd.pal)), ids = Object.keys(PL0.pal); if (bad) bad[ids[0]].sh = [PL0.pal[ids[1]].c, null, null, null];
  eq([!!sd, sd && sd.stats.shades >= 2, chk && chk.ok, sd && sd.shade.length === PL0.h && sd.shade.every((r) => r.length === PL0.w && r[0] === "0"), Array.from(Bf.a0).join() === Array.from(Bs.a0).join(), sd && sd.shade[3].slice(1, 4) === "222" && sd.shade[3].slice(8, 11) === "111" && sd.stats.shades === 4, bad && SH.checkLevel(Object.assign({ w: PL0.w, h: PL0.h, grid: PL0.grid, pal: bad }), CC).ok],
    [true, true, true, true, true, true, false], "lands (shading): a two-colour hand painting (each colour in three bands of light) gets " + (sd ? sd.stats.shades : 0) + " shades (closest other colour " + (sd ? sd.stats.minOther : "-") + ", faded " + (sd ? sd.stats.minFaded : "-") + "), digits darker then lighter where the light runs, the frame 0, the same board; a shade on another colour fails the floors");
  // The land bake on a fixture: a small picture baked as a Hard level with linked pairs, ? cards, mystery blocks and a
  // colour lock under a quick trial config (2 candidates, no lookahead narrowing). Whatever the targets say, a pick
  // always: wins on its stored order with no power-up, 5 spaces, under the tap and wait caps, carries what its plan
  // asked, and re-grades with 0 differences.
  {
    const pw = 20, ph = 22, img = new Uint8Array(pw * ph * 4), cols5 = [[200, 40, 40], [40, 160, 60], [40, 70, 200], [230, 200, 40], [120, 60, 150]];
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) img.set(cols5[(((x / 4) | 0) + ((y / 6) | 0)) % 5].concat([255]), (y * pw + x) * 4);
    const PB = CV.plan({ w: pw, h: ph, rgba: img }, { kind: "painting", box: [pw, ph], chroma: 1 }, CC), tmp = path.join(os.tmpdir(), "sp-land-config-" + process.pid + ".json");
    const trial = JSON.parse(JSON.stringify(LCF)); trial.bake.candidates = { perLevel: 2, perLevelBy: {} }; trial.bake.narrowFor = []; trial.plan.hidden.min = 4; fs.writeFileSync(tmp, JSON.stringify(trial)); const was = process.env.LAND_CONFIG; process.env.LAND_CONFIG = tmp;
    const pl = { feats: ["linked", "mystery", "hidden"], mystery: 2, links: 1, hidden: 0.1, lock: "colour" }, t0 = Date.now();
    const r = LB.bakeOne({ n: 9001, tag: "hard", plan: pl, band: P.bands.hard, look: null, pace: P.pace, board: { w: PB.w, h: PB.h, grid: PB.grid, pal: PB.pal } });
    if (was === undefined) delete process.env.LAND_CONFIG; else process.env.LAND_CONFIG = was; fs.unlinkSync(tmp);
    const L = r.level, rt = E.rulesOf(V3, "hard"), lnF = L && Gr.line(E.compile(L), rt, L.win.hard), rg = L && require("./regrade.js").regrade([Object.assign({ n: 9001, tag: "hard", seed: r.seed }, L)], LB.configs(false).B, V3, false);
    eq([!r.fail, L && E.replay(E.compile(L), rt, L.win.hard).status === E.WON, !rt.powers, lnF && lnF.peak <= 5, L && L.win.hard.length <= LCF.bake.maxTaps && lnF.maxWait <= LCF.bake.maxWaitMs, L && !!(L.links && L.links.length), L && L.cols.flat().filter((c) => c[2]).length >= 2, L && !!(L.hidden && L.hidden.some((x) => x.indexOf("?") >= 0)), L && !!(L.lock && L.lock.colour), rg && rg.diffs],
      [true, true, true, true, true, true, true, true, true, 0], "lands (bake fixture): a " + PB.w + "x" + PB.h + " Hard picture with linked pairs, ? cards, mystery blocks and a colour lock: wins on its stored order with no power-up, 5 spaces, under the caps, carries its plan, re-grades with 0 differences (" + ((Date.now() - t0) / 1000).toFixed(1) + " s" + (r.fail ? ", " + r.fail : "") + ")");
  }
  // Config insertion keeps the file as it is apart from the land and its egg rows.
  { const t = fs.readFileSync(path.join(__dirname, "../config.json"), "utf8"), a = LND.addToConfig(t, { k: 9, name: "T" }, [[10, 11], [12, 13]]), c = JSON.parse(a);
    eq([c.lands.list.slice(-1)[0].name, c.map.eggCoins.length - CFG.map.eggCoins.length, a.replace(/\n      \{"k":9,"name":"T"\}/, "").replace(", [10,11], [12,13]", "") === t], ["T", 2, true], "lands (install): the land goes into config lands.list and a row per new sheet into map.eggCoins, nothing else changes"); }
  // The freeze: the shipped campaign and pictures are the snapshot's, byte for byte, whatever lands follow them.
  { const dir = path.join(__dirname, "..", CFG.v5.freeze.dir), FL = JSON.parse(fs.readFileSync(path.join(dir, "levels.json"), "utf8")).levels, FG = JSON.parse(fs.readFileSync(path.join(dir, "gallery.json"), "utf8")).levels, G2 = require("../levels/gallery.json").levels;
    eq([FL.length >= 200, FL.every((l, i) => JSON.stringify(l) === JSON.stringify(LEVELS_ALL.levels[i])), FG.length, FG.every((l, i) => JSON.stringify(l) === JSON.stringify(G2[i]))], [true, true, 60, true], "freeze: levels 1-" + FL.length + " and pictures 1-60 in the game are the frozen snapshot's, byte for byte"); }
  // Every built land: its levels, side quests and sheets.
  for (const d of LC.list) {
    const LV = LEVELS_ALL.levels.filter((l) => l.land === d.k), GV = require("../levels/gallery.json").levels.filter((l) => l.land === d.k), lj = JSON.parse(fs.readFileSync(path.join(__dirname, "lands", d.slug, "land.json"), "utf8")), PP = LP.profileOf(lj, LCF), era = LC.castleRealms + d.k;
    const SS = require("../map/layout.json").sheets.filter((S) => S.land === d.k), BC = require("./bake-config.json"), GB = require("./gallery-config.json").bake;
    const bad = LV.filter((L, i) => L.n !== d.from + i || L.era !== era || L.id !== "e" + era + "-" + L.n || E.replay(E.compile(L), E.rulesOf(V3, L.tag), L.win[L.tag]).status !== E.WON || L.win[L.tag].length > LCF.bake.maxTaps || L.grade[L.tag].maxWait > LCF.bake.maxWaitMs || (L.shade && !SH.checkLevel(L, CC).ok)).map((L) => L.id);
    const rg = require("./regrade.js").regrade(LV, BC, V3, true), rs = require("./regrade.js").regrade(GV, GB, V3, true), pc = LP.planCheck(LV, lj, PP, D5, LC.perLand);
    eq([LV.length, d.to - d.from + 1, bad, pc, rg.diffs + rs.diffs, SS.length && SS[0].sheet === d.sheets[0] && SS[SS.length - 1].sheet === d.sheets[1], SS.every((S, e) => S.file === d.files[e % 2] && !!S.mirror === (Math.floor(e / 2) % 2 === 1) && S.realm === era), GV.every((g) => g.wander && g.quest.after >= d.from && g.quest.after <= d.to)],
      [d.to - d.from + 1, LV.length, [], [], 0, true, true, true], "land " + d.k + " (" + d.name + ", " + d.from + "-" + d.to + "): levels in order, each winning on its stored order under the caps, shades on their floors, its profile kept, re-grades 0, sheets " + d.sheets.join("-") + " alternating file and mirror, " + GV.length + " Wandering Gallery side quests inside it");
  }
}

console.log(pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
