// Into the Fold game state machine (SPEC §1, §4, §6). DOM-free: the page feeds it actions and frame times, render.js
// reads poses from it. UMD like rules.js, so Node checks it too.
// Every action (keys, pointer swipes, window.ITF) goes through input(). A board change commits the moment its
// action is applied; the slide animation only replays it on frame time. An action that arrives while a swipe is
// animating is queued (max 1). If one is already queued, the running animation snaps to its end, the queued action
// applies, and the new one takes the slot, so a fast player never loses a swipe.
(function (root, factory) {
  const R = typeof module === "object" && module.exports ? require("./rules.js") : root.IntoTheFold.rules;
  const api = factory(R);
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.IntoTheFold = root.IntoTheFold || {}).game = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (R) {
  "use strict";
  const ANIM_NONE = 0, ANIM_SLIDE = 1, ANIM_SPLASH = 2, ANIM_UNDO = 3;
  const STOP_CODE = { wall: 0, sheep: 1, mud: 2, pen: 3, pond: 4 };
  const STOP_PEN = 3, STOP_POND = 4;
  const ACTION = { N: "N", E: "E", S: "S", W: "W", up: "N", right: "E", down: "S", left: "W", undo: "undo", restart: "restart" };

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOut = (u) => 1 - (1 - u) * (1 - u);
  const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));

  // json: board JSON (never mutated). meta: page labels, e.g. {mode:"daily"|"tutorial"|"test", n, name, date}.
  function create(cfg, json, meta) {
    const B = R.parseBoard(json), m = B.sheep0.length, s0 = R.initialState(B);
    return {
      cfg, json, B, meta: meta || {}, par: B.par,
      start: s0, state: s0, history: [s0],
      swipes: 0, squares: "", // one char per counted swipe, in play order: g = penned one, w = nothing penned, s = splash (M2 share)
      won: false, wonAt: 0, now: 0, queue: null, last: null,
      anim: { kind: ANIM_NONE, t0: 0, slideMs: 0, total: 0, dir: 0,
        fx: new Float32Array(m), fy: new Float32Array(m), tx: new Float32Array(m), ty: new Float32Array(m),
        dur: new Float32Array(m), stop: new Int8Array(m), moving: new Uint8Array(m) },
      bump: { t0: -1, dir: 0 },
    };
  }

  function busy(g) { return g.anim.kind !== ANIM_NONE && g.now < g.anim.t0 + g.anim.total; }

  // Load the per-sheep slide table. Speed is constant within a swipe (ease-out per sheep), so sheep in one line
  // never overlap on screen; the longest slide is capped so the whole swipe resolves inside the config budget.
  function startAnim(g, paths, kind, t0, dir) {
    const A = g.anim, C = g.cfg.anim;
    A.moving.fill(0);
    let maxCells = 0;
    for (let k = 0; k < paths.length; k++) if (paths[k].cells > maxCells) maxCells = paths[k].cells;
    if (!maxCells) { A.kind = ANIM_NONE; return; }
    const perCell = Math.min(C.cellMs, (kind === ANIM_SPLASH ? C.splashSlideMaxMs : C.slideMaxMs) / maxCells);
    for (let k = 0; k < paths.length; k++) {
      const p = paths[k], i = p.i;
      A.moving[i] = 1; A.fx[i] = p.from.x; A.fy[i] = p.from.y; A.tx[i] = p.to.x; A.ty[i] = p.to.y;
      A.dur[i] = p.cells * perCell; A.stop[i] = STOP_CODE[p.stop] || 0;
    }
    A.kind = kind; A.t0 = t0; A.dir = dir; A.slideMs = maxCells * perCell;
    A.total = A.slideMs + (kind === ANIM_SPLASH ? C.splashHoldMs + C.splashRewindMs : kind === ANIM_UNDO ? 0 : C.stopMs);
  }

  // Straight-line paths between two states (undo reverses one swipe, so every sheep that moved went straight).
  function diffPaths(a, b) {
    const out = [];
    for (let i = 0; i < a.sheep.length; i++) {
      const p = a.sheep[i], q = b.sheep[i];
      if (p.x !== q.x || p.y !== q.y) out.push({ i, from: { x: p.x, y: p.y }, to: { x: q.x, y: q.y }, cells: Math.abs(q.x - p.x) + Math.abs(q.y - p.y), stop: "wall" });
    }
    return out;
  }

  // Apply one action now (t0 = when its animation starts). Returns a summary; never refunds a swipe.
  function apply(g, a, t0) {
    let res;
    if (a === "undo") {
      if (g.history.length <= 1) res = { action: a, noop: true };
      else {
        const from = g.state;
        g.history.pop(); g.state = g.history[g.history.length - 1];
        startAnim(g, diffPaths(from, g.state), ANIM_UNDO, t0, 0);
        res = { action: a, noop: false };
      }
    } else if (a === "restart") {
      const changed = g.history.length > 1;
      g.history = [g.start]; g.state = g.start; g.anim.kind = ANIM_NONE;
      res = { action: a, noop: !changed };
    } else {
      const r = R.swipe(g.B, g.state, a), d = R.dirIndex(a);
      if (r.noop) { g.bump.t0 = t0; g.bump.dir = d; }
      else {
        g.swipes++;
        g.squares += r.splash ? "s" : r.penned.length ? "g" : "w";
        if (r.moved) { g.state = r.state; g.history.push(r.state); }
        startAnim(g, r.paths, r.splash ? ANIM_SPLASH : ANIM_SLIDE, t0, d);
        if (r.moved && R.isWin(g.B, g.state)) { g.won = true; g.queue = null; g.wonAt = t0 + (g.anim.kind === ANIM_NONE ? 0 : g.anim.total); }
      }
      res = { action: a, noop: r.noop, counts: r.counts, splash: r.splash, penned: r.penned.length };
    }
    res.swipes = g.swipes; res.won = g.won;
    g.last = res;
    return res;
  }

  // THE input facade. a: "N"/"E"/"S"/"W" (or up/right/down/left), "undo", "restart". Restart's "are you sure" lives
  // in the page (a quick tap must never restart a daily); this is what its Yes button calls.
  function input(g, action) {
    const a = ACTION[action];
    if (!a) return { ignored: true, reason: "unknown action" };
    if (g.won) return { ignored: true, reason: "won" };
    if (busy(g)) {
      if (g.queue === null) { g.queue = a; return { queued: true, swipes: g.swipes }; }
      const q = g.queue;
      g.queue = a;
      g.anim.kind = ANIM_NONE; // snap the running animation to its end
      const r = apply(g, q, g.now);
      if (g.won) g.queue = null;
      return Object.assign(r, { queued: !g.won });
    }
    return apply(g, a, g.now);
  }

  // Advance the clock (time only moves forward). Finishes animations and drains the queue on frame time. Bounded:
  // the queue holds one action, so two passes always suffice; four guards against a zero-length animation loop.
  function frame(g, now) {
    if (now > g.now) g.now = now;
    for (let guard = 0; guard < 4 && g.anim.kind !== ANIM_NONE; guard++) {
      const end = g.anim.t0 + g.anim.total;
      if (g.now < end) break;
      g.anim.kind = ANIM_NONE;
      if (g.queue !== null) { const q = g.queue; g.queue = null; if (!g.won) apply(g, q, end); }
    }
    if (g.bump.t0 >= 0 && g.now >= g.bump.t0 + g.cfg.anim.bumpMs) g.bump.t0 = -1;
  }

  function animating(g) { return busy(g) || g.bump.t0 >= 0 || g.queue !== null; }

  function resultDue(g) { return g.won && !busy(g) && g.now >= g.wonAt + g.cfg.anim.resultDelayMs; }

  // Where sheep i is drawn right now, written into `out` (allocation-free): x, y in cells (float); sq = squash
  // amount along axis (0 = the E-W axis, 1 = N-S); dunk 0..1 while a splashing sheep sits in the pond; ripple
  // 0..1 through the splash hold (-1 otherwise).
  function pose(g, i, out) {
    const q = g.state.sheep[i], A = g.anim;
    out.x = q.x; out.y = q.y; out.sq = 0; out.axis = 0; out.dunk = 0; out.ripple = -1;
    if (A.kind === ANIM_NONE || !A.moving[i] || !busy(g)) return out;
    const C = g.cfg.anim, t = g.now - A.t0, di = A.dur[i];
    let p;
    if (A.kind === ANIM_SPLASH) {
      if (t < A.slideMs) p = di > 0 ? easeOut(clamp01(t / di)) : 1;
      else if (t < A.slideMs + C.splashHoldMs) {
        p = 1;
        if (A.stop[i] === STOP_POND) { const u = (t - A.slideMs) / C.splashHoldMs; out.ripple = u; out.dunk = Math.sin(Math.PI * u); }
      } else p = 1 - easeInOut(clamp01((t - A.slideMs - C.splashHoldMs) / C.splashRewindMs));
    } else {
      const u = di > 0 ? clamp01(t / di) : 1;
      p = A.kind === ANIM_UNDO ? u : easeOut(u);
      if (A.kind === ANIM_SLIDE && u >= 1) {
        const v = (t - di) / C.stopMs;
        if (v < 1) { out.sq = Math.sin(Math.PI * v) * C.squash; out.axis = A.dir & 1 ? 0 : 1; }
      }
    }
    out.x = A.fx[i] + (A.tx[i] - A.fx[i]) * p;
    out.y = A.fy[i] + (A.ty[i] - A.fy[i]) * p;
    return out;
  }

  // How shut the gate of penned sheep i's pen is: 0 open → 1 shut; it swings shut after the sheep arrives.
  function gateShut(g, i) {
    const A = g.anim;
    if (A.kind !== ANIM_SLIDE || !A.moving[i] || A.stop[i] !== STOP_PEN || !busy(g)) return 1;
    return easeOut(clamp01((g.now - A.t0 - A.dur[i]) / g.cfg.anim.stopMs));
  }

  // Bump offset (css px along bump.dir) for a no-op swipe: a small nudge out and back.
  function bumpPx(g) {
    if (g.bump.t0 < 0) return 0;
    const u = clamp01((g.now - g.bump.t0) / g.cfg.anim.bumpMs);
    return Math.sin(Math.PI * u) * (1 - u) * g.cfg.anim.bumpPx;
  }

  // Best medal the player can still reach at this swipe count, or the medal earned on a win.
  function medal(cfg, swipes, par) {
    const list = cfg.medals;
    for (let k = 0; k < list.length; k++) if (list[k].maxOverPar === null || swipes - par <= list[k].maxOverPar) return list[k];
    return list[list.length - 1];
  }

  // Solve from the CURRENT state on a cloned board (SPEC §8): filled pens become rocks, penned sheep drop out.
  // Nothing on g changes, so the stored save can't either.
  function solveFrom(g, Solver, opts) {
    const B = g.B, type = B.type.slice(), sheep0 = [], col = [];
    for (const q of g.state.sheep) {
      if (q.penned) type[q.y * B.w + q.x] = R.ROCK;
      else { sheep0.push({ x: q.x, y: q.y, c: q.c }); col.push(R.COLOURS.indexOf(q.c)); }
    }
    if (!sheep0.length) return { solved: true, par: 0, solution: "", states: 1, ms: 0 };
    const S = Object.assign({}, B, { type, sheep0, col: Int8Array.from(col), occ: new Int16Array(B.n).fill(-1) });
    return Solver.solve(S, opts);
  }

  return { ANIM_NONE, ANIM_SLIDE, ANIM_SPLASH, ANIM_UNDO, create, input, frame, busy, animating, resultDue, pose, gateShut, bumpPx, medal, solveFrom };
});
