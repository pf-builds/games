// Sapper's Path node checks: engine rules (SPEC §1) and the solver on hand-made boards with known answers.
// Run: ~/.local/opt/node/bin/node tools/test.js   (exit code 1 on any failure)
"use strict";
const E = require("../src/engine.js");
const S = require("../src/solver.js");
const TEACH = require("../levels/teaching.json").levels;

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log("FAIL  " + name); } }
function eq(a, b, name) { const A = JSON.stringify(a), B = JSON.stringify(b); ok(A === B, name + (A === B ? "" : "\n      got " + A + "\n     want " + B)); }
function throws(fn, name) { let t = false; try { fn(); } catch (e) { t = true; } ok(t, name); }
const lv = (grid, muster, chests) => ({ w: grid[0].length, h: grid.length, grid, muster: muster || {}, chests: chests || [] });
const at = (B, x, y) => E.sectionAt(B, x, y);
function play(B, cells) { let s = E.start(B); for (const [x, y] of cells) { const n = E.apply(B, s, at(B, x, y)); if (!n) return null; s = n; } return s; }

// ---- parse --------------------------------------------------------------------------------------------------
{
  const B = E.parse(lv(["TTTTT", "TSSST", "TSKST", "TSSST", "TTTTT"], { stone: 1, timber: 1 }));
  eq([B.nsec, B.secMat[at(B, 0, 0)], B.secMat[at(B, 1, 1)]], [2, 1, 0], "parse: two rings = two sections (timber, stone)");
  eq([B.secEdge[at(B, 0, 0)], B.secEdge[at(B, 1, 1)]], [1, 0], "parse: outer ring touches the edge, inner does not");
  throws(() => E.parse(lv(["..", ".."])), "parse: no keep throws");
  throws(() => E.parse(lv(["K.", ".C"])), "parse: chest without chests[] entry throws");
  throws(() => E.parse(lv(["KX", ".."])), "parse: unknown cell code throws");
  const D = E.parse(lv([".T.", "TKT", ".S."]));
  eq(D.nsec, 4, "parse: diagonal same-material tiles are separate sections (4-adjacency)");
}

// ---- min crews, reachability, no-win ----------------------------------------------------------------------------
{
  const L = lv(["TTTTT", "TSSST", "TSKST", "TSSST", "TTTTT"], { stone: 1, timber: 1 }), B = E.parse(L);
  const r = S.solve(B);
  eq([r.win, r.min, r.line.map((s) => B.secMat[s])], [true, 2, [1, 0]], "solve: rings need timber then stone, min 2");
  eq(S.quickest(B).min, 2, "quickest: unlimited-crew min agrees");
  const s0 = E.start(B);
  eq(E.apply(B, s0, at(B, 1, 1)), null, "rule: the inner (unreachable) section cannot be broken first");
  eq(S.solve(E.parse(lv(L.grid, { stone: 0, timber: 1 }))).win, false, "solve: no mason for the inner ring = no win");
  eq(S.solve(E.parse(lv(L.grid, { stone: 5, timber: 5 }))).min, 2, "solve: spare crews do not lower the min");
  const moat = E.parse(lv([".....", ".~~~.", ".~K~.", ".~~~.", "....."], { stone: 3 }));
  const m = S.solve(moat);
  eq([m.win, m.min, S.quickest(moat).win], [false, null, false], "solve: keep ringed by moat has no win");
  const two = E.parse(lv(["..T..", ".SSS.", ".SKS.", ".SSS.", "....."], { stone: 1, timber: 1 }));
  eq([S.solve(two).min, S.greedy(two).win, S.greedy(two).used], [1, true, 1], "solve+greedy: open side, one break");
  // A gate in the outer stone: the stone is never needed, only the timber ring.
  const route = E.parse(lv(["SSSSSSS", "S.....S", "S.TTT.S", "S.TKT.S", "S.TTT.S", "S.....S", "SS.SSSS"], { stone: 1, timber: 1 }));
  const rr = S.solve(route);
  eq([rr.min, rr.line.map((s) => B.secMat[s] === undefined ? -1 : route.secMat[s])], [1, [1]], "solve: a gate makes the outer stone free, min 1 (timber)");
}

// ---- teaching boards ------------------------------------------------------------------------------------------
{
  const mins = TEACH.map((t) => S.solve(E.parse(t)).min);
  eq(mins, [1, 2, 2], "teaching: One Wall 1, Outside In 2, The Wrong Wall 2");
  const B = E.parse(TEACH[2]), r = S.solve(B);
  eq([r.states, r.wins, r.dead, r.lost], [5, 1, 1, 2], "solve counts on The Wrong Wall: 5 states, 1 win, 1 dead end, 2 lost");
  const p = S.playouts(B, 4000, 7);
  ok(Math.abs(p.winRate - 0.25) < 0.03, "playouts: The Wrong Wall random win rate ~25% (got " + p.winRate + ")");
  eq(S.playouts(B, 50, 3), S.playouts(B, 50, 3), "playouts: same seed, same result");
  // Stuck: waste the only mason on the outer stone, then spend the axemen.
  const s1 = play(B, [[6, 0]]);
  eq([s1.stuck, s1.legal, s1.remaining[0]], [false, 1, 0], "stuck: after the wrong wall the axemen can still move");
  const s2 = play(B, [[6, 0], [0, 0]]);
  eq([s2.stuck, s2.won, s2.reach[at(B, 2, 2)], s2.remaining[0]], [true, false, 1, 0], "stuck: inner stone reachable, no mason, no win");
  const good = play(B, [[0, 0], [2, 2]]);
  eq([good.won, good.stuck, good.used], [true, false, 2], "win: axemen then mason");
  eq(E.apply(B, good, at(B, 6, 0)), null, "rule: no moves after the win");
}

// ---- win adjacency: 4-neighbour only --------------------------------------------------------------------------
{
  const B = E.parse(lv([".....", ".TST.", ".SKS.", ".TST.", "....."], { stone: 1, timber: 1 }));
  const s = play(B, [[1, 1]]);
  eq([s.won, s.conn[1 * 5 + 1]], [false, 1], "win: a broken diagonal corner does not reach the keep");
  eq(play(B, [[2, 1]]).won, true, "win: an orthogonal neighbour does");
  const edgeKeep = E.parse(lv(["SK.", "SSS", "..."], {}));
  eq(E.start(edgeKeep).won, true, "win: keep beside open edge ground is already won (generator rejects min 0)");
}

// ---- chests ---------------------------------------------------------------------------------------------------
{
  const L = lv(["TTTTTTT", "TC....T", "T.SSS.T", "T.SKS.T", "T.SSS.T", "T.....T", "TTTTTTT"], { timber: 1 }, [{ x: 1, y: 1, crew: "stone" }]);
  const B = E.parse(L), r = S.solve(B);
  eq([r.win, r.min, r.chestOnOptimal, r.chestRequired, r.minNoChest], [true, 2, true, true, null], "chest: the mason in the chest is required");
  const s = play(B, [[0, 0]]);
  eq([s.claimed[0], s.remaining[0], s.remaining[1]], [1, 1, 0], "chest: claimed once on connected ground, +1 mason");
  eq(S.solve(E.parse(lv(L.grid.map((row) => row.replace("C", ".")), { timber: 1 }))).win, false, "chest: same board without the chest has no win");
  const opt = E.parse(lv([".........", ".SSS.HHH.", ".SKS.HCH.", ".SSS.HHH.", "........."], { stone: 1, hedge: 1 }, [{ x: 6, y: 2, crew: "stone" }]));
  const o = S.solve(opt);
  eq([o.min, o.minChest, o.minNoChest, o.chestOnOptimal, o.chestRequired], [1, 2, 1, false, false], "chest: a detour chest is off the optimal line");
  eq(E.start(opt).claimed[0], 0, "chest: a sealed chest is not claimed at start");
}

// ---- levers: the cascade ----------------------------------------------------------------------------------------
{
  const grid = ["TTTTTTTTT", "T..L....T", "T~~FF~~~T", "T~.....~T", "T~~.L~~~T", "T~~FF~~~T", "T~~~K~~~T", "~~~~~~~~~"];
  const B = E.parse(lv(grid, { timber: 1 }));
  const s0 = E.start(B);
  eq([s0.thrown.join(""), s0.doorOpen[at(B, 4, 2)], s0.won], ["00", 0, false], "lever: sealed levers are not thrown at start");
  const s1 = play(B, [[0, 0]]);
  eq([s1.thrown.join(""), s1.doorOpen[at(B, 4, 2)], s1.doorOpen[at(B, 4, 5)], s1.won], ["11", 1, 1, true],
    "lever cascade: lever 1 exposed -> door 1 opens -> lever 2 exposed -> door 2 opens -> keep reached");
  ok(s1.cascade >= 2, "lever cascade: took at least two rounds (" + s1.cascade + ")");
  eq(S.solve(B).min, 1, "lever: solver sees the cascade, min 1");
  eq(S.quickest(B).min, 1, "lever: quickest sees the cascade, min 1");
  eq(S.solve(E.parse(lv(grid, { timber: 1 }), { noLevers: true })).win, false, "lever: with levers disabled there is no win");
  eq(E.apply(B, s0, at(B, 4, 2)), null, "lever: iron is never broken by a crew");
}

// ---- undo parity, immutability --------------------------------------------------------------------------------
{
  const boards = [
    lv(["TTTTTTT", "TC....T", "T.SSS.T", "T.SKS.T", "T.SSS.T", "T.....T", "TTTTTTT"], { timber: 1, stone: 1 }, [{ x: 1, y: 1, crew: "stone" }]),
    lv(["TTTTTTTTT", "T..L....T", "T~~FF~~~T", "T~.....~T", "T~~.L~~~T", "T~~FF~~~T", "T~~~K~~~T", "~~~~~~~~~"], { timber: 1 }),
    TEACH[2],
  ];
  for (const L of boards) {
    const B = E.parse(L);
    let s = E.start(B);
    for (let step = 0; step < 8 && !s.won && !s.stuck; step++) {
      const before = E.serialize(s), mv = E.legalMoves(B, s)[0], next = E.apply(B, s, mv);
      eq(E.serialize(s), before, "undo: apply leaves the old state untouched");
      eq(E.serialize(E.undo(B, next)), before, "undo parity: apply then undo is identical (" + L.grid[0] + " step " + step + ")");
      s = next;
    }
    eq(E.serialize(E.restart(B)), E.serialize(E.start(B)), "restart equals start");
  }
}

// ---- solver robustness ---------------------------------------------------------------------------------------
{
  const B = E.parse(TEACH[1]);
  const c = S.solve(E.parse(TEACH[2]), { cap: 2 });
  eq([c.capped, typeof c.ms], [true, "number"], "solve: hitting the cap reports capped and does not throw");
  const r = S.solve(B);
  let s = E.start(B); for (const mv of r.line) s = E.apply(B, s, mv);
  eq([s.won, s.used], [true, r.min], "solve: the optimal line replays to a win in min crews");
}

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
