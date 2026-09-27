// Into the Fold node unit checks: rules (every SPEC §1 rule + edge cases), symmetry, solver.
// Run: ~/.local/opt/node/bin/node tools/test.js   (exit code 1 on any failure)
"use strict";
const R = require("../src/rules.js");
const Sym = require("../src/sym.js");
const Solver = require("../src/solver.js");
const Gen = require("./gen.js");
const Daily = require("../src/daily.js");
const Save = require("../src/save.js");
const Game = require("../src/game.js");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log("FAIL  " + name); } }
function eq(a, b, name) { const A = JSON.stringify(a), B = JSON.stringify(b); ok(A === B, name + (A === B ? "" : "\n      got " + A + "\n     want " + B)); }
function throws(fn, name) { let t = false; try { fn(); } catch (e) { t = true; } ok(t, name); }

// Tiny board helper: rows + pens given as "x,y,open,colour" strings.
function board(rows, pens) { return { w: rows[0].length, h: rows.length, rows, pens: (pens || []).map((p) => { const [x, y, open, c] = p.split(","); return { x: +x, y: +y, open, c }; }) }; }
const at = (s) => s.sheep.map((q) => q.x + "," + q.y + (q.penned ? "P" : ""));
function run(b, dirs) { const B = R.parseBoard(b); let s = R.initialState(B), last = null; for (const d of dirs) { last = R.swipe(B, s, d); s = last.state; } return { B, s, last }; }

// ---- parse + legend -------------------------------------------------------
{
  const B = R.parseBoard(board(["wR.", "M~P", "b.P"], ["2,1,N,w", "2,2,W,b"]));
  eq([B.type[1], B.type[3], B.type[4], B.type[5]], [R.ROCK, R.MUD, R.POND, R.PEN], "legend: R rock, M mud, ~ pond, P pen");
  eq(B.sheep0, [{ x: 0, y: 0, c: "w" }, { x: 0, y: 2, c: "b" }], "legend: w/b sheep read in row order");
  const B2 = R.parseBoard(board(["W.P", "..."], ["2,0,W,w"]));
  eq([B2.type[0], B2.sheep0[0].c], [R.MUD, "w"], "legend: W = white sheep standing on mud");
  throws(() => R.parseBoard(board(["w..", "..."], [])), "parse: sheep without a pen throws");
  throws(() => R.parseBoard(board(["w.P", "..."], [])), "parse: P cell without pens[] entry throws");
  throws(() => R.parseBoard(board(["w.P", "..."], ["2,0,W,b"])), "parse: colour counts must match");
  throws(() => R.parseBoard(board(["w.X", "..."], ["2,0,W,w"])), "parse: unknown cell throws");
  throws(() => R.parseBoard(board(["w.P", "..."], ["1,0,W,w"])), "parse: pen not on a P cell throws");
}

// ---- basic slide, pen entry, win -------------------------------------------
{
  const b = board(["w....", ".....", "....P"], ["4,2,N,w"]);
  let r = run(b, ["E"]);
  eq(at(r.s), ["4,0"], "slide: runs to the fence");
  ok(r.last.moved && r.last.counts && !r.last.noop && !r.last.splash, "slide: moved + counts");
  eq(r.last.paths, [{ i: 0, from: { x: 0, y: 0 }, to: { x: 4, y: 0 }, cells: 4, stop: "wall" }], "slide: path from/to/stop");
  r = run(b, ["E", "S"]);
  eq(at(r.s), ["4,2P"], "pen: entered moving S through an N opening");
  eq(r.last.penned, [0], "pen: penned list");
  ok(R.isWin(r.B, r.s), "win: every sheep penned");
  ok(!R.isWin(r.B, R.initialState(r.B)), "win: not at start");
  const p = R.play(R.parseBoard(b), "ES");
  ok(p.win && p.swipes === 2, "play: ES wins in 2");
  eq(at(run(b, ["down"]).s), ["0,2"], "direction aliases: down = S");
}

// ---- 2048 order: two / three sheep in a line --------------------------------
{
  const b = board(["ww...", ".....", "PP..."], ["0,2,N,w", "1,2,N,w"]);
  const r = run(b, ["E"]);
  eq(at(r.s), ["3,0", "4,0"], "line: furthest moves first, the other stops on it");
  eq(r.last.paths.map((q) => q.stop), ["sheep", "wall"], "line: stop reasons sheep + wall");
  const B = R.parseBoard(b), pos = Int16Array.from([0, 1]);
  ok(R.resolve(B, pos, 1) & R.STOPPER, "line: STOPPER bit when a sliding sheep stops on another");
  eq(at(run(board([".w.w.", ".....", "PP..."], ["0,2,N,w", "1,2,N,w"]), ["W"]).s), ["0,0", "1,0"], "line: westward packs to the west fence");
  eq(at(run(board(["www..", "P....", "PP..."], ["0,1,N,w", "0,2,E,w", "1,2,N,w"]), ["E"]).s), ["2,0", "3,0", "4,0"], "line: three in a row pack");
  const moved = run(board(["w....", "w....", "PP..."], ["0,2,N,w", "1,2,N,w"]), ["E"]);
  eq(at(moved.s), ["4,0", "4,1"], "line: sheep in different rows ignore each other");
  ok(!(R.resolve(R.parseBoard(board(["w....", "w....", "PP..."], ["0,2,N,w", "1,2,N,w"])), Int16Array.from([0, 5]), 1) & R.STOPPER), "line: no STOPPER across rows");
}

// ---- pens: fenced side, wrong colour, filled pen, penned mid-swipe ----------
{
  const fenced = board(["w...P", "....."], ["4,0,N,w"]);
  let r = run(fenced, ["E"]);
  eq(at(r.s), ["3,0"], "pen: entered from a fenced side is a wall");
  eq(r.last.penned, [], "pen: fenced side pens nothing");
  const wrong = board(["b..P.", "w..P."], ["3,0,W,w", "3,1,W,b"]);
  r = run(wrong, ["E"]);
  eq(at(r.s), ["2,0", "2,1"], "pen: wrong colour is a wall (both rows)");
  const right = board(["b..P.", "w..P."], ["3,0,W,b", "3,1,W,w"]);
  eq(at(run(right, ["E"]).s), ["3,0P", "3,1P"], "pen: matching colour enters through the open side");
  // Penned mid-swipe becomes a wall for a later sheep in the same swipe.
  const mid = board(["ww.P.", "P...."], ["3,0,W,w", "0,1,N,w"]);
  r = run(mid, ["E"]);
  eq(at(r.s), ["2,0", "3,0P"], "pen mid-swipe: first sheep pens, the second stops against the filled pen");
  eq(r.last.paths.map((q) => q.stop), ["wall", "pen"], "pen mid-swipe: stop reasons");
  eq(r.last.penned, [1], "pen mid-swipe: only the lead sheep penned");
  // Filled pen stays a wall on later swipes.
  const later = board(["w..P", ".w..", "P..."], ["3,0,W,w", "0,2,N,w"]);
  r = run(later, ["E", "W", "N", "E"]);
  eq(at(r.s), ["3,0P", "2,0"], "filled pen: a wall on a later swipe");
}

// ---- mud ------------------------------------------------------------------
{
  const b = board(["w.M..", "P...."], ["0,1,N,w"]);
  let r = run(b, ["E"]);
  eq(at(r.s), ["2,0"], "mud: moving onto mud stops there");
  eq(r.last.paths[0].stop, "mud", "mud: stop reason");
  r = run(b, ["E", "E"]);
  eq(at(r.s), ["4,0"], "mud: starting on mud moves normally");
  eq(at(run(board(["W....", "P...."], ["0,1,N,w"]), ["E"]).s), ["4,0"], "mud: a sheep that starts the level on mud slides off");
  eq(at(run(board(["wM.M.", "P...."], ["0,1,N,w"]), ["E", "E", "E"]).s), ["4,0"], "mud: hop mud to mud to fence in three swipes");
  eq(at(run(board(["wM.M.", "P...."], ["0,1,N,w"]), ["E", "E"]).s), ["3,0"], "mud: second swipe stops on the next mud");
  eq(at(run(board(["wwM..", "PP..."], ["0,1,N,w", "1,1,N,w"]), ["E"]).s), ["1,0", "2,0"], "mud: lead stops on mud, follower stops on the lead");
}

// ---- pond -------------------------------------------------------------------
{
  const b = board(["w..~.", "w....", "PP..."], ["0,2,N,w", "1,2,N,w"]);
  const B = R.parseBoard(b), s0 = R.initialState(B);
  const r = R.swipe(B, s0, "E");
  ok(r.splash && r.counts && !r.moved && !r.noop, "pond: splash counts, board unchanged");
  eq(r.state, s0, "pond: whole board reverts, including the sheep in the other row");
  eq(r.penned, [], "pond: nothing penned on a splash");
  eq(r.paths.map((q) => [q.to.x, q.to.y, q.stop]), [[3, 0, "pond"], [4, 1, "wall"]], "pond: would-be paths for the animation");
  ok(r.state !== s0 && r.state.sheep[0] !== s0.sheep[0], "pond: returned state is a fresh copy");
  eq(R.play(B, "E").swipes, 1, "pond: play() counts the splash swipe");
  // A sheep stopped short of the pond (by a rock) does not splash.
  const safe = R.swipe(R.parseBoard(board(["w.R~.", "P...."], ["0,1,N,w"])), R.initialState(R.parseBoard(board(["w.R~.", "P...."], ["0,1,N,w"]))), "E");
  ok(safe.moved && !safe.splash, "pond: blocked before the pond, no splash");
  // Pen before the pond: penned mid-swipe, but a later sheep splashes, so the pen is undone too.
  const mix = R.parseBoard(board(["w..P.", "w.~..", "P...."], ["3,0,W,w", "0,2,N,w"]));
  const m = R.swipe(mix, R.initialState(mix), "E");
  ok(m.splash && m.penned.length === 0 && R.initialState(mix).sheep.every((q, i) => q.x === m.state.sheep[i].x && !m.state.sheep[i].penned), "pond: splash also undoes a pen made in the same swipe");
}

// ---- no-op ------------------------------------------------------------------
{
  const b = board(["....w", "P...."], ["0,1,N,w"]);
  const B = R.parseBoard(b), s0 = R.initialState(B);
  const r = R.swipe(B, s0, "E");
  ok(r.noop && !r.counts && !r.moved && !r.splash && r.paths.length === 0, "no-op: nothing moved, doesn't count");
  eq(r.state, s0, "no-op: state unchanged");
  eq(R.play(B, "EEE").swipes, 0, "no-op: play() never counts them");
  const penned = R.parseBoard(board(["w..P", "...."], ["3,0,W,w"]));
  const s1 = R.swipe(penned, R.initialState(penned), "E").state;
  ok(R.swipe(penned, s1, "N").noop, "no-op: penned sheep never move");
}

// ---- symmetry ---------------------------------------------------------------
{
  const b = board(["w.R..", "..M..", "b...P", "~...P"], ["4,2,W,w", "4,3,N,b"]);
  eq(Sym.layoutKey(Sym.apply(1, Sym.apply(1, Sym.apply(1, Sym.apply(1, b))))), Sym.layoutKey(b), "sym: four quarter turns = identity");
  eq(Sym.layoutKey(Sym.apply(4, Sym.apply(4, b))), Sym.layoutKey(b), "sym: mirror twice = identity");
  eq([Sym.mapDir(1, "N"), Sym.mapDir(1, "E"), Sym.mapDir(4, "E"), Sym.mapDir(6, "N")], ["E", "S", "W", "W"], "sym: direction mapping");
  const t = Sym.apply(1, b);
  eq([t.w, t.h], [4, 5], "sym: rot90 swaps w and h");
  ok(Sym.keepsDims(1, 6, 6) && !Sym.keepsDims(1, 5, 4) && Sym.keepsDims(2, 5, 4), "sym: keepsDims");
  const keys = new Set(); for (let k = 0; k < 8; k++) keys.add(Sym.canonicalKey(Sym.apply(k, b)));
  ok(keys.size === 1, "sym: canonicalKey equal across all 8 copies");
  for (let k = 0; k < 8; k++) R.parseBoard(Sym.apply(k, b)); // every copy still parses (pens on P cells, counts)
  ok(true, "sym: all 8 copies parse");
}

// ---- solver -----------------------------------------------------------------
{
  const s = Solver.solve(board(["w....", ".....", "....P"], ["4,2,N,w"]));
  ok(s.solved && s.par === 2 && s.solution === "ES", "solver: trivial board par 2 via ES (got " + s.par + " " + s.solution + ")");
  const u = Solver.solve(board(["w...P", "....."], ["4,0,N,w"]));
  ok(!u.solved && !u.capped, "solver: pen opening onto the fence is unsolvable");
  const c = Solver.solve(board(["w.R..", ".....", "...wP", "P...."], ["4,2,W,w", "0,3,N,w"]), { cap: 2 });
  ok(!c.solved && c.capped, "solver: state cap gives a clean capped result");
  // A splash direction never appears in a solution.
  const pond = Solver.solve(board(["w.~..", ".....", "....P"], ["4,2,N,w"]));
  ok(pond.solved && pond.solution.indexOf("E") !== 0, "solver: never opens with the splash swipe");
}

// Independent reference: breadth-first over the PUBLIC swipe() API with no canonicalization.
function refPar(b, limit) {
  const B = R.parseBoard(b), key = (s) => s.sheep.map((q) => q.x + "," + q.y).join(" ");
  let frontier = [R.initialState(B)]; const seen = new Set([key(frontier[0])]);
  for (let depth = 1; depth <= limit; depth++) {
    const next = [];
    for (const s of frontier) for (const d of R.DIRS) {
      const r = R.swipe(B, s, d);
      if (!r.moved) continue;
      if (R.isWin(B, r.state)) return depth;
      const k = key(r.state); if (!seen.has(k)) { seen.add(k); next.push(r.state); }
    }
    frontier = next;
    if (!next.length) return -1;
  }
  return -2;
}

{
  const rng = Gen.mulberry32(12345);
  const cfgs = [
    { size: 5, white: [2, 3], rocks: [2, 5], cap: 50000 },
    { size: 6, white: 3, black: 1, rocks: [3, 6], mud: [1, 3], pond: 1, cap: 50000 },
    { size: 6, white: [3, 4], rocks: [2, 6], mud: 2, cap: 50000 },
  ];
  let checked = 0, agree = 0, symOk = 0, symChecked = 0, replay = 0, replayOk = 0;
  for (const cfg of cfgs) {
    for (let n = 0; n < 40; n++) {
      const b = Gen.generate(cfg, rng); if (!b) continue;
      const s = Solver.solve(b, { cap: 50000 });
      if (s.capped) continue;
      const ref = refPar(b, 400);
      checked++; if ((s.solved ? s.par : -1) === ref) agree++; else console.log("      mismatch", JSON.stringify(b), s.par, ref);
      if (!s.solved) continue;
      replay++; const p = R.play(R.parseBoard(b), s.solution); if (p.win && p.swipes === s.par) replayOk++;
      symChecked++; let all = true;
      for (let k = 1; k < 8; k++) { const t = Sym.apply(k, b), st = Solver.solve(t); if (!st.solved || st.par !== s.par || st.dead !== s.dead) all = false; const pt = R.play(R.parseBoard(t), Sym.mapDirs(k, s.solution)); if (!pt.win || pt.swipes !== s.par) all = false; }
      if (all) symOk++;
    }
  }
  ok(checked >= 60 && agree === checked, "solver: par matches the reference search on " + agree + "/" + checked + " random boards");
  ok(replay > 20 && replayOk === replay, "solver: solution replays to a win at exactly par (" + replayOk + "/" + replay + ")");
  ok(symChecked > 20 && symOk === symChecked, "sym: par, dead ends and mapped solution invariant under all 8 symmetries (" + symOk + "/" + symChecked + ")");
}

// ---- daily picker (M1) ---------------------------------------------------------
{
  const pools = {}; for (const d of Daily.DAYS) pools[d] = [0, 1, 2].map((i) => board(["w.P", "..."], ["2,0,W,w"])).map((b, i) => Object.assign(b, { id: d + "-" + i, par: 1, sol: "E" }));
  ok(Daily.dayNumber("1970-01-02") === 1 && Daily.dayNumber("2026-02-30") === null && Daily.dayNumber("26-9-1") === null, "daily: dayNumber parses and rejects");
  ok(Daily.weekday(Daily.dayNumber("2026-09-28")) === 0 && Daily.weekday(Daily.dayNumber("2026-10-04")) === 6, "daily: 2026-09-28 is a Monday, 2026-10-04 a Sunday");
  ok(Daily.localDate(new Date(2026, 2, 8, 23, 59)) === "2026-03-08", "daily: localDate uses local calendar fields");
  const L = "2026-09-28", p = (d) => Daily.puzzleFor(d, L, pools);
  eq([p(L).n, p(L).day, p(L).board.id, p(L).sym], [1, "mon", "mon-0", 0], "daily: launch day is #1 Monday pool[0]");
  eq([p("2026-09-20").n, p("2026-09-20").board.id], [1, "mon-0"], "daily: a date before launch plays #1");
  eq([p("2026-10-04").n, p("2026-10-04").day, p("2026-10-04").board.id], [7, "sun", "sun-0"], "daily: first Sunday is #7, sun pool[0]");
  eq([p("2026-10-05").board.id, p("2026-10-19").board.id], ["mon-1", "mon-0~s2"], "daily: k counts that weekday; past the horizon, pool[k mod len] under the first dims-keeping symmetry (3x2 test pool: s2)");
  eq([1, 7, 8, 14].map((c) => Daily.symFor(c, 6, 6)), [1, 7, 1, 7], "daily: symmetry cycles 1..7, never identity again");
  eq([Daily.symFor(1, 5, 4), Daily.symFor(2, 5, 4), Daily.symFor(3, 5, 4)], [2, 4, 5], "daily: non-square boards only use dims-keeping symmetries");
  ok(p("2026-10-01").date === "2026-10-01" && Daily.dateString(Daily.dayNumber("2027-01-01")) === "2027-01-01", "daily: dateString round-trips");
}

// ---- save (M1) --------------------------------------------------------------------
{
  eq([Save.sanitize(null), Save.sanitize({ tutorialSeen: "yes", junk: 1 }), Save.sanitize({ tutorialSeen: true })], [{ v: 1, tutorialSeen: false }, { v: 1, tutorialSeen: false }, { v: 1, tutorialSeen: true }], "save: sanitize clamps every field");
  const m = Save.memoryStore(); m.setItem("k", "{not json"); ok(Save.open(m, "k").data.tutorialSeen === false, "save: a corrupt save loads fresh");
  const sv = Save.open(m, "k"); sv.data.tutorialSeen = true; sv.write(); ok(Save.open(m, "k").data.tutorialSeen === true, "save: write + reopen round-trips");
}

// ---- game state machine (M1): facade, queue, undo/restart never refund ------------------
{
  const cfg = { anim: { cellMs: 48, slideMaxMs: 270, stopMs: 110, squash: 0.26, splashSlideMaxMs: 170, splashHoldMs: 110, splashRewindMs: 120, bumpMs: 160, bumpPx: 7, resultDelayMs: 380 },
    medals: [{ id: "gold", maxOverPar: 0 }, { id: "silver", maxOverPar: 3 }, { id: "bronze", maxOverPar: null }] };
  const b = Object.assign(board(["w....", "..~..", "....P"], ["4,2,N,w"]), { par: 2 });
  let g = Game.create(cfg, b), t = 0;
  const tick = () => { t += 1000; Game.frame(g, t); };
  Game.input(g, "E"); ok(Game.busy(g) && g.swipes === 1, "game: a swipe commits at once and animates");
  ok(g.anim.total <= 400, "game: a full swipe resolves in <= 400 ms (" + g.anim.total + ")");
  ok(Game.input(g, "W").queued && g.swipes === 1, "game: input during a slide is queued");
  Game.input(g, "E"); ok(g.swipes === 2 && g.queue === "E", "game: a third input fast-forwards the queue, none dropped");
  tick(); ok(!Game.busy(g) && g.queue === null && g.swipes === 3, "game: frame drains the queue on frame time");
  const d = g.history.length; Game.input(g, "E"); tick(); ok(g.swipes === 3 && g.history.length === d && g.bump.t0 < 0, "game: a no-op is free (and the bump ends)");
  Game.input(g, "undo"); tick(); Game.input(g, "restart"); tick(); ok(g.swipes === 3 && g.history.length === 1, "game: undo + restart never refund");
  g = Game.create(cfg, Object.assign(board(["w.~..", ".....", "....P"], ["4,2,N,w"]), { par: 2 }));
  Game.input(g, "E"); ok(g.swipes === 1 && g.squares === "s" && g.state.sheep[0].x === 0 && g.anim.total <= 400, "game: a splash counts, logs s, keeps the board, fits 400 ms");
  for (const dir of "SENES") { tick(); Game.input(g, dir); }
  tick();
  ok(g.won && g.squares === "swwwwg" && Game.input(g, "W").ignored, "game: win, squares log, input ignored after the win");
  ok(Game.resultDue(g) && Game.medal(cfg, 4, 2).id === "silver" && Game.medal(cfg, 2, 2).id === "gold" && Game.medal(cfg, 6, 2).id === "bronze", "game: result due, medal thresholds from config");
  const g2 = Game.create(cfg, board(["w..w.", ".....", "P...P"], ["0,2,N,w", "4,2,N,w"]));
  Game.input(g2, "E"); Game.frame(g2, 5000); // one sheep to the east fence; solve from there, not from the start
  const before = JSON.stringify(g2.state); const sv = Game.solveFrom(g2, Solver);
  let s2 = g2.state; for (const dir of sv.solution || "") s2 = R.swipe(g2.B, s2, dir).state;
  ok(sv.solved && sv.par === sv.solution.length && R.isWin(g2.B, s2) && JSON.stringify(g2.state) === before, "game: solveFrom solves the CURRENT state on a clone (par " + sv.par + ")");
}

// ---- UMD: the same files load as browser globals (no module/require), in page script order ----
{
  const vm = require("vm"), fs = require("fs"), path = require("path"), ctx = vm.createContext({});
  for (const f of ["rules.js", "sym.js", "solver.js", "daily.js", "save.js", "game.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "../src", f), "utf8"), ctx, { filename: f });
  const F = ctx.IntoTheFold, s = F && F.solver.solve({ w: 5, h: 3, rows: ["w....", ".....", "....P"], pens: [{ x: 4, y: 2, open: "N", c: "w" }] });
  ok(F && F.rules && F.sym && s && s.par === 2 && F.sym.mapDir(1, "N") === "E", "UMD: window.IntoTheFold.rules/sym/solver work without require");
  ok(F.daily && F.save && F.game && typeof F.game.input === "function", "UMD: daily/save/game load as browser globals too");
}

// ---- baked levels (skipped until tools/bake.js has run) ------------------------
{
  const fs = require("fs"), path = require("path"), L = (f) => path.join(__dirname, "../levels", f);
  const tut = JSON.parse(fs.readFileSync(L("tutorial.json"), "utf8")).boards;
  ok(tut.length === 3, "tutorial: three boards");
  for (const b of tut) {
    const s = Solver.solve(b), p = R.play(R.parseBoard(b), b.sol);
    ok(s.solved && s.par === b.par && p.win && p.swipes === b.par && s.dead === 0, "tutorial " + b.id + ": par " + b.par + " is the solver's, replays, no dead ends");
    ok(typeof b.hint === "string" && b.hint.length > 0 && b.hint.length <= 60, "tutorial " + b.id + ": one-line hint");
  }
  ok(Solver.solve(tut[1]).needsStopper, "tutorial 2 needs a stopper");
  ok(!fs.existsSync(L("daily.json")) || (() => {
    const C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8"));
    const daily = JSON.parse(fs.readFileSync(L("daily.json"), "utf8")), practice = JSON.parse(fs.readFileSync(L("practice.json"), "utf8"));
    const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], keys = new Set(), ids = new Set();
    let n = 0, replayOk = 0, inBand = 0, sampled = 0, sampleOk = 0;
    const check = (b, cfg, sample) => {
      n++; ids.add(b.id); keys.add(Sym.canonicalKey(b));
      const p = R.play(R.parseBoard(b), b.sol); if (p.win && p.swipes === b.par) replayOk++;
      if (!cfg || (b.par >= cfg.par[0] && b.par <= cfg.par[1])) inBand++;
      if (sample) { sampled++; const s = Solver.solve(b, { cap: C.cap }); if (s.solved && s.par === b.par && (!cfg || !Gen.rejectReason(s, cfg))) sampleOk++; }
    };
    for (const d of days) { ok(daily.pools[d].length === C.perDay, "daily: " + d + " pool holds " + C.perDay); daily.pools[d].forEach((b, i) => check(b, C.days[d], i % 15 === 0)); }
    ok(practice.boards.length === C.practiceCount, "practice: " + C.practiceCount + " boards");
    practice.boards.forEach((b, i) => check(b, null, i % 25 === 0));
    ok(replayOk === n, "levels: every baked solution replays to a win at par (" + replayOk + "/" + n + ")");
    ok(inBand === n, "levels: every daily par inside its weekday band (" + inBand + "/" + n + ")");
    ok(keys.size === n && ids.size === n, "levels: no two boards identical up to symmetry, ids unique (" + keys.size + "/" + n + ")");
    let symOk = 0; for (let k = 0; k < 8; k++) { const b = Sym.apply(k, daily.pools.sun[k]), p = R.play(R.parseBoard(b), b.sol); if (p.win && p.swipes === b.par) symOk++; }
    ok(symOk === 8, "levels: sym.apply rotates a baked sol with the board, still a win at par (" + symOk + "/8)");
    ok(sampleOk === sampled, "levels: re-solved sample matches par and passes its day's accept rules (" + sampleOk + "/" + sampled + ")");
    return true;
  })(), "levels: checks ran");
}

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
