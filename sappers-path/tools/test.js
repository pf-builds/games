// Sapper's Path v3 node checks: the rules engine (SPEC-v3 §2-4, §9; the dispatch model from playtest 1) on hand-made
// boards with known answers, then a differential run of the engine against the slow reference (tools/ref.js) on every
// baked level, patient and rushed, and the stored winning orders on every difficulty, played patiently.
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

// ---- spaces: no merging, a space per tap, overflow at the tap ---------------------------------------------------------
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
  // Spam: three rapid taps with two spaces overflow while the first squads are still out; the same taps, patient, win.
  const L = lv(["abc....", ".......", "...##.."], [[[1, 1]], [[2, 1]], [[3, 1]], [], []]);
  const S = E.sim(E.compile(L), hold(2));
  S.play(0, 0); S.play(1, 10); eq(S.status, E.PLAYING, "spam: two squads out fill both spaces"); S.play(2, 20);
  eq([S.status, S.reason], [E.FAILED, "overflow"], "spam: a third rapid tap has no space: overflow, at the tap");
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
  S.play(0); eq([S.status, S.reason], [E.FAILED, "nomove"], "no move: the one space holds a squad that can't move, and every tap would overflow");
  const M1 = E.sim(E.compile(lv(RING, [[[2, 1]], [[3, 1], [1, 12]], [[2, 1]], [], []])), Object.assign({}, hold(1), { mergeLeftovers: true }));
  M1.play(0); eq(M1.status, E.PLAYING, "no move (flag mergeLeftovers): a front card that can merge is a legal move");
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
  const run = () => { const S = E.sim(B, N), r = Gr.rng(99); let t = 0; for (let g = 0; g < 30 && S.status === E.PLAYING; g++) { const o = []; for (let j = 0; j < 5; j++) if (S.heads[j] < B.colLen[j]) o.push(j); if (!o.length) break; t += Math.floor(r() * 2500); S.play(o[Math.floor(r() * o.length)], t); } S.advanceTo(t + 4000); return S.save(); };
  const A = run(), Bm = run();
  ok(A.length === Bm.length && A.every((v, i) => v === Bm[i]), "determinism: the same taps at the same times give an identical state (level " + L.n + ")");
}
{
  const B = E.compile(ARCH([[[1, 6]], [[7, 3]], [], [], []])), S = E.sim(B, N), buf = S.save();
  pat(S, 0); const h1 = S.hash(); S.load(buf); eq([S.lineLen, S.pixLeft, S.heads[0], S.now], [0, 9, 0, 0], "save/load: load restores the whole state, clock included");
  pat(S, 0); eq(S.hash(), h1, "save/load: replaying gives the same state hash");
  eq(S.play(0), -2, "play: an empty column is refused");
}

// ---- differential: engine vs the slow reference on every baked level, patient and rushed --------------------------------
{
  let games = 0, taps = 0, pops = 0, diffs = 0;
  const t0 = Date.now();
  for (const L of LEVELS.levels) {
    const B = E.compile(L);
    for (const [dn, rules] of Object.entries(RULES)) {
      for (const rushed of [false, true]) {
        const S = E.sim(B, rules), R = Ref.game(L, rules), r = Gr.rng(L.n * 1009 + (rushed ? 17 : 3) + dn.length);
        S.logOn = true; let t = 0, bad = null;
        const mine = [];
        for (let g = 0; g <= B.ncards && S.status === E.PLAYING && !bad; g++) {
          const open = []; for (let j = 0; j < 5; j++) if (S.heads[j] < B.colLen[j]) open.push(j);
          if (!open.length) break;
          const j = open[Math.floor(r() * open.length)];
          S.clearLog();
          if (rushed) { t += Math.floor(r() * 1800); S.play(j, t); R.play(j, t); } else { S.play(j); S.quiet(); R.play(j); R.quiet(); }
          taps++;
          for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === E.EV.EAT) mine.push([S.ev[i + 1], S.q1[S.ev[i + 2]]]);
          const st = S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing";
          const lineR = R.spaces.map((s, k) => [k, s]).filter(([, s]) => s).sort((p, q) => p[1].seq - q[1].seq).map(([, s]) => [s.m, s.wait + s.out]);
          if (JSON.stringify(mine) !== JSON.stringify(R.pops)) bad = "pops";
          else if (st !== R.status || (st === "failed" && S.reason !== R.reason)) bad = "status " + st + "/" + R.status + " " + S.reason + "/" + R.reason;
          else if (JSON.stringify(line(S)) !== JSON.stringify(lineR)) bad = "spaces";
          else if (S.now !== R.now) bad = "clock";
        }
        pops += mine.length;
        if (bad) { diffs++; if (diffs <= 4) console.log("  diff: level " + L.n + " " + dn + (rushed ? " rushed" : " patient") + ": " + bad); }
        games++;
      }
    }
  }
  eq(diffs, 0, "differential: engine == reference on " + games + " random games (" + taps + " taps, " + pops + " pops), patient and rushed, every baked level and difficulty");
  console.log("  differential: " + games + " games, " + taps + " taps in " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
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
  eq(LEVELS.levels.length, 75, "levels: 75 levels baked");
}

console.log(pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
