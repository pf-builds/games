// Sapper's Path v3 node checks: the rules engine (SPEC-v3 §2-4, §9) on hand-made boards with known answers, then a
// differential run of the engine against the slow reference (tools/ref.js) on every baked level, and the stored winning
// orders on every difficulty.
// Run: ~/.local/opt/node/bin/node tools/test.js   (exit code 1 on any failure)
"use strict";
const E = require("../src/engine.js");
const Ref = require("./ref.js");
const Gr = require("./grade.js");
const RULES = require("../config.json").v3.rules;
const LEVELS = require("../levels/levels.json");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log("FAIL  " + name); } }
function eq(a, b, name) { const A = JSON.stringify(a), B = JSON.stringify(b); ok(A === B, name + (A === B ? "" : "\n      got " + A + "\n     want " + B)); }
function throws(fn, name) { let t = false; try { fn(); } catch (e) { t = true; } ok(t, name); }
const N = RULES.normal, EZ = RULES.easy, H = RULES.hard;
const lv = (grid, cols, extra) => Object.assign({ w: grid[0].length, h: grid.length, grid, cols: cols || [[], [], [], [], []] }, extra || {});
const xy = (B, c) => [c % B.w, (c / B.w) | 0];
// Play and return the cells eaten (in order) by that play.
function eats(S, col) { S.logOn = true; S.clearLog(); S.play(col); const out = []; for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === E.EV.EAT) out.push(xy(S.B, S.ev[i + 1])); return out; }
const line = (S) => { const o = []; for (let i = 0; i < S.lineLen; i++) o.push([S.lineM[i], S.lineN[i]]); return o; };

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
  // a: touches grass. b: behind water. c: inside a closed ring of d (its yard is not connected).
  const L = lv(["~~~~~~~", "~b~ddd.", "~~~dcd.", "a..ddd.", "...##.."]);
  const S = E.sim(E.compile(L), N);
  eq([S.reachable(1), S.reachable(2), S.reachable(3), S.reachable(4)], [1, 0, 0, 5], "reach: grass-side pixels reach (5 of 8 d); behind water and inside a ring do not");
  eq(S.d[4 * 7 + 3], 0, "reach: camp cells are distance 0");
  eq(S.d[1 * 7 + 6], 5, "reach: walk distance over grass (camp -> right edge -> up)");
  eq(S.d[1 * 7 + 1] < 0, true, "reach: pixel cells have no walk distance");
}
{
  // Eating the ring opens the yard; the inner pixel becomes reachable with a distance through the gap.
  const L = lv([".....", ".aaa.", ".aba.", ".aaa.", "..#.."], [[[1, 1]], [], [], [], []]);
  const S = E.sim(E.compile(L), N);
  eq(S.reachable(2), 0, "reach: an enclosed pixel is unreachable");
  const e = eats(S, 0);
  eq([e, S.reachable(2)], [[[2, 3]], 1], "reach: eating the nearest ring pixel (bottom middle) makes the inside reachable");
}

// ---- nearest pixel and the tie-break ---------------------------------------------------------------------------------
{
  // Four a pixels at walk distance 1 from the camp row. Ties: smaller |y - campRow|, then lower x.
  //   row 2 is the camp's top row; (1,2) and (4,2) sit on it beside the camp, (2,1) and (3,1) above it.
  const L = lv(["......", "..aa..", ".a##a.", "..##.."], [[[1, 4]], [], [], [], []]);
  const S = E.sim(E.compile(L), N);
  eq(eats(S, 0), [[1, 2], [4, 2], [2, 1], [3, 1]], "tie-break: same distance -> the camp row first, then lower x");
}
{
  // Distance beats the tie-break: a far pixel on the camp row loses to a near one above it.
  const L = lv(["...a......", "..........", "........a.", "..........", "...##....."], [[[1, 2]], [], [], [], []]);
  const S = E.sim(E.compile(L), N);
  eq(eats(S, 0), [[3, 0], [8, 2]], "nearest: the smallest walk distance wins before the tie-break");
}
{
  // A pixel's distance is its nearest connected walkable neighbour's, and eating opens shortcuts.
  const L = lv(["bbbbb", "b...b", "baaab", ".....", "..#.."], [[[1, 3]], [[2, 2]], [], [], []]);
  const S = E.sim(E.compile(L), N);
  eq(eats(S, 0), [[2, 2], [1, 2], [3, 2]], "nearest: a row eaten from the camp outward, lower x first on ties");
  eq(eats(S, 1), [[0, 2], [4, 2]], "nearest: three b pixels tie at walk 3; the two on row 2 (nearer the camp row) beat the top middle, lower x first");
}

// ---- holding line: merge, cascade, overflow -------------------------------------------------------------------------
// RING: b, b and c inside a ring of 12 a pixels.
const RING = [".......", ".aaaaa.", ".abbca.", ".aaaaa.", "...#..."];
{
  const S = E.sim(E.compile(lv(RING, [[[2, 1]], [[2, 1]], [[3, 1]], [[1, 12]], []])), N);
  S.play(0); eq(line(S), [[2, 1]], "holding: an unreachable squad waits");
  S.play(1); eq(line(S), [[2, 2]], "holding: the same colour merges into its entry");
  S.play(2); eq(line(S), [[2, 2], [3, 1]], "holding: a new colour takes the next space");
  S.logOn = true; S.clearLog(); S.play(3);
  const order = []; for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === E.EV.RESUME) order.push(S.ev[i + 1]);
  eq([S.status, S.lineLen, order], [E.WON, 0, [2, 3]], "cascade: after the ring falls both entries resume, in line order, and win");
}
{
  // Cascade chain: c waits inside a ring of b, b inside a ring of a. After a falls, b resumes, which opens c.
  const L = lv([".......", ".aaaaa.", ".abbba.", ".abcba.", ".abbba.", ".aaaaa.", "...#..."], [[[3, 1]], [[2, 8]], [[1, 16]], [], []]);
  const S = E.sim(E.compile(L), N);
  S.play(0); S.play(1); eq(line(S), [[3, 1], [2, 8]], "cascade: two entries wait");
  S.logOn = true; S.clearLog(); S.play(2);
  const order = []; for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === E.EV.RESUME) order.push(S.ev[i + 1]);
  eq([S.status, S.lineLen, order], [E.WON, 0, [2, 3]], "cascade: c (first in line) cannot move, b resumes, then the scan restarts and c resumes");
}
{
  // Overflow: two spaces, three different unreachable colours.
  const G3 = [".......", ".aaaaa.", ".abcda.", ".aaaaa.", "...#..."], cols = [[[2, 1]], [[3, 1]], [[4, 1]], [[1, 12]], []];
  const S = E.sim(E.compile(lv(G3, cols)), { hold: 2, archersKill: false });
  S.play(0); S.play(1); eq(S.status, E.PLAYING, "overflow: two entries fit in two spaces");
  S.play(2); eq([S.status, S.reason], [E.FAILED, "overflow"], "overflow: a third entry fails the assault");
  const S5 = E.sim(E.compile(lv(G3, cols)), N); S5.play(0); S5.play(1); S5.play(2); S5.play(3);
  eq(S5.status, E.WON, "overflow: the same taps win with five spaces");
}
{
  // Leftovers: a squad bigger than what's open eats what it can reach and the rest wait, then finish.
  const L = lv(["......", ".aaaa.", ".abba.", ".aaaa.", "bb....", "..##.."], [[[2, 4]], [[1, 10]], [], [], []]);
  const S = E.sim(E.compile(L), N);
  S.play(0); eq([line(S), S.pixLeft], [[[2, 2]], 12], "leftovers: 2 of 4 eat the outside pixels, 2 wait");
  S.play(1); eq(S.status, E.WON, "leftovers: they resume once the ring opens");
}
{
  // Stuck: the tray runs out with pixels left (a short hand-made deck).
  const S = E.sim(E.compile(lv(["....", ".aa.", "..#."], [[[1, 1]], [], [], [], []])), N); S.play(0);
  eq([S.status, S.reason], [E.FAILED, "stuck"], "stuck: tray empty and nothing left to resume");
}
{
  // No move: one space, filled by b; every front card is another unreachable colour (the card behind is ignored).
  const S = E.sim(E.compile(lv([".......", ".aaaaa.", ".abcda.", ".aaaaa.", "...#..."], [[[2, 1]], [[3, 1], [1, 12]], [[4, 1]], [], []])), { hold: 1, archersKill: false });
  S.play(0); eq([S.status, S.reason], [E.FAILED, "nomove"], "no move: line full and every front card would overflow");
  const S2 = E.sim(E.compile(lv(RING, [[[2, 1]], [[3, 1], [1, 12]], [[2, 1]], [], []])), { hold: 1, archersKill: false });
  S2.play(0); eq(S2.status, E.PLAYING, "no move: a front card that can merge into the line is a legal move");
}

// ---- gates and keys --------------------------------------------------------------------------------------------------
{
  // The keep (c inside water) opens only through the gate j; the key n sits outside.
  const L = lv(["~~~~~", "~ccc~", "~~j~~", ".....", "n.#.."], [[[3, 3]], [[14, 1]], [], [], []], { gates: [{ at: [2, 2], key: [0, 4] }] });
  const B = E.compile(L), S = E.sim(B, N);
  eq([S.reachable(3), S.pixLeft], [0, 5], "gate: iron blocks the way; the gate's pixels count toward the fort");
  S.play(0); eq(line(S), [[3, 3]], "gate: the crew for the keep waits behind the locked gate");
  S.logOn = true; S.clearLog(); S.play(1);
  let gateEv = false; for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === E.EV.GATE) gateEv = true;
  eq([gateEv, S.a[2 * 5 + 2], S.status], [true, E.DIRT, E.WON], "gate: eating the key opens the gate (its pixels turn to dirt) and the waiting crew finishes");
  eq(E.sim(B, N).target(10), -1, "gate: iron is never a target");
}

// ---- archers ---------------------------------------------------------------------------------------------------------
// Tower g (3 pixels, top right, centroid (7,0)) with range 3. a pixels: (4,2) walk 1, (3,2) and (6,2) walk 2 (tie ->
// lower x), then the far ones. (6,2) and (7,2) are covered; (3,2), (4,2) are not.
const ARCH = (cols) => lv(["......ggg", ".........", "aa.aa.aa.", ".........", "....##..."], cols, { towers: [{ at: [7, 0], r: 3 }] });
{
  const S = E.sim(E.compile(ARCH([[[1, 6]], [[7, 3]], [], [], []])), N);
  eq([S.covered(2 * 9 + 7), S.covered(2 * 9 + 6), S.covered(2 * 9 + 3), S.covered(7)], [true, true, false, false], "archers: range covers nearby pixels; tower pixels are never covered");
  S.logOn = true; S.clearLog(); const e = eats(S, 0);
  eq([e, line(S), S.hits, S.pixLeft], [[[4, 2], [3, 2]], [[1, 4]], 4, 7], "archers (Normal): the squad eats until its nearest target is covered; the other 4 are hit and wait");
  S.play(1);
  eq([S.status, S.hits, S.lineLen], [E.WON, 4, 0], "archers: once the tower falls the parked entry resumes and wins");
}
{
  const S = E.sim(E.compile(ARCH([[[1, 6]], [[7, 1], [7, 2]], [], [], []])), N);
  S.play(0); S.play(1);
  eq([S.hits, line(S), S.status], [4, [[1, 4]], E.PLAYING], "re-hit: while any tower pixel stands the hit entry stays parked (wary): no second hit, no loop");
  S.play(1); eq([S.status, S.hits], [E.WON, 4], "re-hit: the tower's last pixel lets it resume");
}
{
  const S = E.sim(E.compile(ARCH([[[1, 6]], [[7, 3]], [], [], []])), EZ);
  S.play(0); eq([S.hits, S.kills, line(S)], [4, 0, [[1, 4]]], "archers (Easy): hit sappers go to the holding line");
}
{
  const S = E.sim(E.compile(ARCH([[[1, 6]], [[7, 3]], [], [], []])), H);
  S.play(0); eq([S.kills, S.lineLen, S.status, S.reason], [4, 0, E.FAILED, "short"], "archers (Hard): hit sappers die, and the level fails short of sappers");
  const S2 = E.sim(E.compile(ARCH([[[1, 6]], [[7, 3]], [], [], []])), H);
  S2.play(1); S2.play(0); eq([S2.kills, S2.status], [0, E.WON], "archers (Hard): the tower first wins");
}
{
  // One covered a pixel; the only front card is its crew, the tower crew behind it.
  const L = lv(["......ggg", ".......a.", ".........", "....##..."], [[[1, 1], [7, 3]], [], [], [], []], { towers: [{ at: [7, 0], r: 3 }] });
  const SH = E.sim(E.compile(L), H); eq([SH.status, SH.reason], [E.FAILED, "nomove"], "archers (Hard): the only front card would be killed, so no move");
  const SN = E.sim(E.compile(L), N); SN.play(0); eq([SN.status, line(SN)], [E.PLAYING, [[1, 1]]], "archers (Normal): the same card is hit and waits");
  SN.play(0); eq(SN.status, E.WON, "archers (Normal): the tower behind it frees the waiting sapper");
}

// ---- save / load, bounded ---------------------------------------------------------------------------------------------
{
  const B = E.compile(ARCH([[[1, 6]], [[7, 3]], [], [], []])), S = E.sim(B, N), buf = S.save();
  S.play(0); const h1 = S.hash(); S.load(buf); eq([S.lineLen, S.pixLeft, S.heads[0]], [0, 9, 0], "save/load: load restores the whole state");
  S.play(0); eq(S.hash(), h1, "save/load: replaying gives the same state hash");
  eq(S.play(0), -2, "play: an empty column is refused");
}

// ---- differential: engine vs the slow reference on every baked level --------------------------------------------------
{
  let games = 0, taps = 0, diffs = 0;
  const t0 = Date.now();
  for (const L of LEVELS.levels) {
    const B = E.compile(L);
    for (const [dn, rules] of Object.entries(RULES)) {
      for (let k = 0; k < 3; k++) {
        const S = E.sim(B, rules), R = Ref.game(L, rules), r = Gr.rng(L.n * 1009 + k * 17 + dn.length);
        S.logOn = true;
        for (let g = 0; g <= B.ncards && S.status === E.PLAYING; g++) {
          const open = []; for (let j = 0; j < 5; j++) if (S.heads[j] < B.colLen[j]) open.push(j);
          const j = open[Math.floor(r() * open.length)];
          S.clearLog(); const before = R.eaten.length; S.play(j); R.play(j); taps++;
          const mine = []; for (let i = 0; i < S.evLen; i += 3) if (S.ev[i] === E.EV.EAT) mine.push(S.ev[i + 1]);
          const st = S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing";
          const same = JSON.stringify(mine) === JSON.stringify(R.eaten.slice(before)) && st === R.status && (st !== "failed" || S.reason === R.reason) && JSON.stringify(line(S)) === JSON.stringify(R.line.map((e) => [e.m, e.n]));
          if (!same) { diffs++; if (diffs <= 3) console.log("  diff: level " + L.n + " " + dn + " game " + k + " tap " + g + " (" + st + "/" + R.status + ")"); break; }
        }
        games++;
      }
    }
  }
  eq(diffs, 0, "differential: engine == reference on " + games + " random games (" + taps + " taps) over every baked level and difficulty");
  console.log("  differential: " + games + " games, " + taps + " taps in " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
}

// ---- baked levels: stored winning orders, sums, bands ------------------------------------------------------------------
{
  let wins = 0, total = 0;
  for (const L of LEVELS.levels) {
    const B = E.compile(L);
    let sum = 0; for (let m = 0; m < E.NMAT; m++) sum += B.sapTotal[m];
    ok(sum === B.pixTotal - (B.pix[E.IRON] || 0), "level " + L.n + ": sappers sum to the fort's eatable pixels");
    for (const d of ["easy", "normal", "hard"]) {
      total++; const S = E.replay(B, RULES[d], L.win[d] || "");
      if (S.status === E.WON) wins++; else console.log("FAIL  level " + L.n + " " + d + ": stored order does not win (" + S.reason + ")");
    }
  }
  eq(wins, total, "levels: every stored winning order wins on its difficulty (" + total + " replays)");
  eq(LEVELS.levels.length, 75, "levels: 75 levels baked");
}

console.log(pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
