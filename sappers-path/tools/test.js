// Sapper's Path v2 node checks: engine rules (SPEC-v2 §2) and the solver on hand-made boards with known answers.
// Run: ~/.local/opt/node/bin/node tools/test.js   (exit code 1 on any failure)
"use strict";
const E = require("../src/engine.js");
const S = require("../src/solver.js");
const TEACH = require("../levels/teaching.json").levels;
const LEVELS = require("../levels/levels.json");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log("FAIL  " + name); } }
function eq(a, b, name) { const A = JSON.stringify(a), B = JSON.stringify(b); ok(A === B, name + (A === B ? "" : "\n      got " + A + "\n     want " + B)); }
function throws(fn, name) { let t = false; try { fn(); } catch (e) { t = true; } ok(t, name); }
const lv = (grid, muster, chests, extra) => Object.assign({ w: grid[0].length, h: grid.length, grid, muster: muster || {}, chests: chests || [] }, extra || {});
const at = (B, x, y) => E.sectionAt(B, x, y);
function play(B, calls) { let s = E.start(B); for (const a of calls) { const n = E.call(B, s, a); if (!n) return null; s = n; } return s; }

// ---- parse --------------------------------------------------------------------------------------------------
{
  const B = E.parse(lv(["...P...", "TTTTTTT", "T.SSS.T", "T.SKS.T", "T.SSS.T", "TTTTTTT"], { stone: 1, timber: 1 }));
  eq([B.nsec, B.secMat[at(B, 0, 1)], B.secMat[at(B, 2, 2)], B.camp.length, B.keepCells.length, B.rule], [2, 1, 0, 1, 1, "A"], "parse: two rings, one camp cell, one keep cell, rule A by default");
  throws(() => E.parse(lv(["...", ".K.", "..."])), "parse: no camp throws");
  throws(() => E.parse(lv(["...", ".P.", "K.."])), "parse: a camp cell off the edge throws");
  throws(() => E.parse(lv(["P..", "...", "..."])), "parse: no keep throws");
  throws(() => E.parse(lv(["P..", "K.K", "..."])), "parse: a keep in two pieces throws");
  throws(() => E.parse(lv(["P.C", ".K.", "..."])), "parse: a chest without a chests[] entry throws");
  throws(() => E.parse(lv(["P.X", ".K.", "..."])), "parse: an unknown cell code throws");
  throws(() => E.parse(lv(["P..", ".K.", "..."], {}, [], { rule: "C" })), "parse: rule must be A or B");
  const K = E.parse(lv(["P.....", ".SSSS.", ".SKKS.", ".SKKS.", ".SSSS."]));
  eq([K.keepCells.length, K.nsec], [4, 1], "parse: a 2×2 keep is one keep");
}

// ---- camp connectivity: edges are not outside ------------------------------------------------------------------
{
  const L = lv(["S~.....", "~~.TTT.", "...TKT.", "...TTT.", "P......"], { stone: 1, timber: 1 }), B = E.parse(L), s0 = E.start(B);
  eq([s0.reach[at(B, 0, 0)], s0.reach[at(B, 3, 1)], s0.conn[0], s0.conn[2]], [0, 1, 0, 1], "camp: a stone on the board edge behind moat is not reachable; the ground by the camp is connected");
  eq([E.call(B, s0, "stone"), E.canCall(B, s0, "timber")], [null, true], "camp: a crew with no reachable wall cannot be called");
  const P = E.parse(lv(["......", ".TTTT.", ".T..T.", ".TTTT.", ".SKS..", "P....."], { timber: 1 }));
  const p0 = E.start(P);
  eq([p0.conn[2 * 6 + 2], p0.conn[0], p0.dist[0], p0.dist[5 * 6 + 5]], [0, 1, 5, 5], "camp: an enclosed pocket is not connected; walking distance is a BFS from the camp");
}

// ---- Rule A: the closest pick and each tie-break step ----------------------------------------------------------
{
  const B = E.parse(lv([".........", ".TTT.....", ".TKT....S", ".TTT.....", ".........", "S........", "....P...."], { stone: 1, timber: 1 }));
  const s = E.start(B), t = E.targets(B, s).find((q) => q.crew === "stone");
  eq([t.section, t.dist, t.tie, t.contact, t.ground], [at(B, 0, 5), 4, 0, [0, 5], [1, 5]], "closest: the stone 4 steps from the camp beats the one 7 steps away (contact ground: lowest cell of the tied ones)");
  const after = E.call(B, s, "stone");
  eq([after.broken[at(B, 0, 5)], after.broken[at(B, 8, 2)], after.calls, after.remaining[0]], [1, 0, 1, 0], "closest: calling stone breaks exactly the closest stone section");
  eq(E.pathTo(B, s, 1, 5), [[4, 6], [4, 5], [3, 5], [2, 5], [1, 5]], "closest: the walk runs from the camp along falling distance");
  const T1 = E.parse(lv([".........", "....TTT..", "....TKT..", "....TTT..", ".........", ".S.....S.", "....P...."], { stone: 1 }));
  const a1 = E.targets(T1, E.start(T1))[0];
  eq([a1.section, a1.dist, a1.tie], [at(T1, 7, 5), 3, 1], "tie step 1: equal walk, the stone nearer the keep (Chebyshev 3 vs 4) wins");
  const T2 = E.parse(lv([".........", "...TTT...", "...TKT...", "...TTT...", ".........", ".S.....S.", "....P...."], { stone: 1 }));
  const a2 = E.targets(T2, E.start(T2))[0];
  eq([a2.section, a2.dist, a2.tie], [at(T2, 1, 5), 3, 2], "tie step 2: equal walk and keep distance, the lowest (y, x) first tile wins");
  const r2 = S.solve(E.parse(lv([".........", "...TTT...", "...TKT...", "...TTT...", ".........", ".S.....S.", "....P...."], { stone: 1, timber: 1 })));
  eq([r2.min, r2.tieAny, r2.tieMove], [1, true, false], "tie proxy: a tie on a callable crew is seen, and it did not decide the optimal call");
}

// ---- Rule B: every reachable section of the material at once, one crew -----------------------------------------
{
  const grid = [".........", ".TTT.....", ".TKT....S", ".TTT.....", ".........", "S........", "....P...."];
  const B = E.parse(lv(grid, { stone: 1, timber: 1 }, [], { rule: "B" }));
  const s = E.call(B, E.start(B), "stone");
  eq([s.breaks[0].length, s.broken[at(B, 0, 5)], s.broken[at(B, 8, 2)], s.calls, s.remaining[0]], [2, 1, 1, 1, 0], "rule B: one stone call breaks both reachable stone sections for one crew");
  eq(E.targets(B, E.start(B)).find((q) => q.crew === "stone").all.length, 2, "rule B: the stone flag lists every section the call breaks");
  const A = E.parse(lv(grid, { stone: 1, timber: 1 }), { rule: "B" });
  eq(A.rule, "B", "rule B: parse option overrides the level's rule");
}

// ---- stacks: a move is a column pick; only front tokens are callable ------------------------------------------
{
  const grid = ["...P...", "TTTTTTT", "T.....T", "T.SSS.T", "T.SKS.T", "T.SSS.T", "TTTTTTT"];
  const B = E.parse(lv(grid, {}, [], { stacks: [["stone", "timber"], ["timber"]] }));
  const s0 = E.start(B);
  eq([B.ncol, Array.from(s0.front), s0.legalMask, Array.from(s0.remaining)], [2, [0, 1], 2, [1, 2, 0, 0]], "stacks: fronts stone | timber; the stone front has no target yet, so only column 2 is legal");
  eq([E.call(B, s0, 0), E.call(B, s0, "timber")], [null, null], "stacks: a blocked column and a crew name are not moves");
  const s1 = E.call(B, s0, 1), s2 = E.call(B, s1, 0);
  eq([s1.calls, Array.from(s1.front), s2.won, s2.calls, Array.from(s2.spent)], [1, [0, -1], true, 2, [1, 1, 0, 0, 1, 1]], "stacks: column 2's timber opens the ring, then column 1's stone reaches the keep");
  const r = S.solve(B);
  eq([r.win, r.min, r.line], [true, 2, [1, 0]], "stacks: the solver's line is column picks");
  const C = E.parse(lv(["...P...", "TTTTTTT", "TC....T", "T.SSS.T", "T.SKS.T", "T.SSS.T", "TTTTTTT"], {}, [{ x: 1, y: 2, crew: "stone" }], { stacks: [["timber"]] }));
  const c1 = E.call(C, E.start(C), 0);
  eq([C.ncol, Array.from(c1.front), c1.legalMask], [2, [-1, 0], 2], "stacks: a claimed chest's crew is a column of its own");
  eq(E.call(C, c1, 1).won, true, "stacks: the chest column wins it");
}

// ---- multi-cell keep, win ---------------------------------------------------------------------------------------
{
  const B = E.parse(lv(["P.......", ".TTTTTT.", ".TSSSST.", ".TSKKST.", ".TSKKST.", ".TSSSST.", ".TTTTTT."], { stone: 1, timber: 1 }));
  eq(E.start(B).won, false, "keep: a walled 2×2 keep is not won at start");
  const s = play(B, ["timber", "stone"]);
  eq([s.won, s.calls, s.legal, s.stuck], [true, 2, 0, false], "keep: open ground beside any keep cell wins");
  eq(E.call(B, s, "stone"), null, "keep: no calls after the win");
  const D = E.parse(lv(["P.....", ".TTTT.", ".TKKT.", ".TTTT.", "......"], { timber: 1 }));
  eq(play(D, ["timber"]).won, true, "keep: one break beside a 2-cell keep wins");
}

// ---- chests -----------------------------------------------------------------------------------------------------
{
  const L = lv(["...P...", "TTTTTTT", "TC....T", "T.SSS.T", "T.SKS.T", "T.SSS.T", "TTTTTTT"], { timber: 1 }, [{ x: 1, y: 2, crew: "stone" }]);
  const B = E.parse(L), r = S.solve(B);
  eq([r.win, r.min, r.chestOnOptimal, r.chestRequired, r.minNoChest], [true, 2, true, true, null], "chest: the mason in the chest is required");
  const s = play(B, ["timber"]);
  eq([s.claimed[0], s.remaining[0], s.remaining[1]], [1, 1, 0], "chest: claimed once on connected ground, +1 mason");
  eq(S.solve(E.parse(lv(L.grid.map((row) => row.replace("C", ".")), { timber: 1 }))).win, false, "chest: the same board without the chest has no win");
  eq(E.start(B).claimed[0], 0, "chest: a sealed chest is not claimed at start");
}

// ---- levers: the cascade ----------------------------------------------------------------------------------------
{
  const grid = ["....P....", "TTTTTTTTT", "T..L....T", "T~~FF~~~T", "T~.....~T", "T~~.L~~~T", "T~~FF~~~T", "T~~~K~~~T", "~~~~~~~~~"];
  const B = E.parse(lv(grid, { timber: 1 }));
  const s0 = E.start(B);
  eq([s0.thrown.join(""), s0.doorOpen[at(B, 4, 3)], s0.won], ["00", 0, false], "lever: sealed levers are not thrown at start");
  const s1 = play(B, ["timber"]);
  eq([s1.thrown.join(""), s1.doorOpen[at(B, 4, 3)], s1.doorOpen[at(B, 4, 6)], s1.won], ["11", 1, 1, true], "lever cascade: lever 1 → door 1 → lever 2 → door 2 → keep reached");
  ok(s1.cascade >= 2, "lever cascade: took at least two rounds (" + s1.cascade + ")");
  eq(S.solve(B).min, 1, "lever: the solver sees the cascade, min 1");
  eq(S.solve(E.parse(lv(grid, { timber: 1 }), { noLevers: true })).win, false, "lever: with levers disabled there is no win");
  const s2 = E.fromMoves(B, [1]);
  ok(s2.dist[4 * 9 + 4] > 0 && s2.dist[4 * 9 + 4] < 32767, "lever: walking distances are rebuilt after a door opens (" + s2.dist[4 * 9 + 4] + ")");
}

// ---- stuck, undo parity, immutability -----------------------------------------------------------------------------
{
  const B = E.parse(TEACH.find((t) => t.id === "w1-t3"));
  const s1 = play(B, ["stone"]);
  eq([s1.stuck, s1.legal, s1.remaining[0], s1.breaks[0].length], [false, 1, 0, 1], "stuck: stone first spends the mason on the back wall; the axemen can still move");
  const s2 = play(B, ["stone", "timber"]);
  eq([s2.stuck, s2.won, s2.reach[at(B, 6, 8)], s2.remaining[0]], [true, false, 1, 0], "stuck: the keep's wall is reachable but no mason is left");
  eq(play(B, ["timber", "stone"]).won, true, "closest first: axemen first makes the keep's wall the nearest stone");
  const boards = [
    lv(["...P...", "TTTTTTT", "TC....T", "T.SSS.T", "T.SKS.T", "T.SSS.T", "TTTTTTT"], { timber: 1, stone: 1 }, [{ x: 1, y: 2, crew: "stone" }]),
    lv(["....P....", "TTTTTTTTT", "T..L....T", "T~~FF~~~T", "T~.....~T", "T~~.L~~~T", "T~~FF~~~T", "T~~~K~~~T", "~~~~~~~~~"], { timber: 1 }),
    lv([".........", ".TTT.....", ".TKT....S", ".TTT.....", ".........", "S........", "....P...."], { stone: 2, timber: 1 }, [], { rule: "B" }),
    lv(["...P...", "TTTTTTT", "T.....T", "T.SSS.T", "T.SKS.T", "T.SSS.T", "TTTTTTT"], {}, [], { stacks: [["stone", "timber"], ["timber"]] }),
    TEACH.find((t) => t.id === "w1-t3"), TEACH.find((t) => t.id === "w4-t1"),
  ];
  for (const L of boards) {
    const B2 = E.parse(L);
    let s = E.start(B2);
    for (let step = 0; step < 8 && !s.won && !s.stuck; step++) {
      const before = E.serialize(s), mv = E.legalMoves(B2, s)[0], next = E.call(B2, s, mv);
      eq(E.serialize(s), before, "undo: call leaves the old state untouched");
      eq(E.serialize(E.undo(B2, next)), before, "undo parity: call then undo is identical (" + L.grid[1] + " step " + step + ")");
      s = next;
    }
    eq(E.serialize(E.restart(B2)), E.serialize(E.start(B2)), "restart equals start");
  }
}

// ---- solver, frontier, naive players --------------------------------------------------------------------------------
{
  const mins = TEACH.map((t) => S.solve(E.parse(t)).min);
  eq(mins, [1, 2, 2, 2, 3, 2], "teaching: One Wall 1, Outside In 2, Closest First 2, Goats 2, Moat 3, Lever 2");
  const B = E.parse(TEACH.find((t) => t.id === "w1-t3")), r = S.solve(B);
  eq([r.states, r.wins, r.dead, r.lost, r.decisions, r.line], [5, 1, 1, 2, 1, [1, 0]], "solve counts on Closest First: 5 states, 1 win, 1 dead end, 2 lost, 1 decision point");
  eq(S.frontier(B, { maxLen: 6 }).vecs.map((v) => v.comp), [[2, 0, 0, 0], [1, 1, 0, 0]], "frontier: Closest First wins with a mason and axemen, or two masons (the back wall first)");
  eq(S.solve(E.parse(Object.assign({}, TEACH.find((t) => t.id === "w1-t3"), { muster: { stone: 2 } }))).min, 2, "frontier: two masons really do win");
  const g = S.greedy(B);
  eq([g.win, g.used], [true, 2], "greedy: calls the crew whose target is nearest the keep (the axemen' gate) and wins");
  eq(S.playouts(B, 60, 3), S.playouts(B, 60, 3), "playouts: same seed, same result");
  const p = S.playouts(B, 4000, 7);
  ok(Math.abs(p.winRate - 0.5) < 0.04, "playouts: Closest First random win ~50% (got " + p.winRate + ")");
  const c = S.solve(E.parse(TEACH[2]), { cap: 2 });
  eq([c.capped, typeof c.ms], [true, "number"], "solve: hitting the cap reports capped and does not throw");
  const bad = S.solve({ nsec: 0 });
  ok(typeof bad.error === "string", "solve: a broken board returns an error field, never throws");
}

// ---- the draft bake: every level replays to a win in min calls ------------------------------------------------------
{
  let n = 0, good = 0;
  for (const w of LEVELS.worlds) for (const L of w.levels) {
    n++;
    const B = E.parse(L); let s = E.start(B);
    for (const a of L.line) { const nx = E.call(B, s, a); if (nx) s = nx; }
    if (s.won && s.calls === L.min && S.solve(B).min === L.min) good++; else console.log("      level " + L.id + " won " + s.won + " calls " + s.calls + " min " + L.min);
  }
  eq([good, n >= 36], [n, true], "bake: all " + n + " levels replay their line to a win in exactly min calls");
}

console.log(pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
