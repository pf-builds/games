// Into the Fold game state machine (SPEC §1, §4, §6). DOM-free: the page feeds it actions and frame times, render.js
// reads poses from it. UMD like rules.js, so Node checks it too.
// Every action (keys, pointer swipes, window.ITF) goes through input(). A board change commits the moment its
// action is applied; the slide animation only replays it on frame time. An action that arrives while a swipe is
// animating is queued (max 1). If one is already queued, the running animation snaps to its end, the queued action
// applies, and the new one takes the slot, so a fast player never loses a swipe.
// M2: every effective action is appended to g.log (a resume replays it), and timed events (swipe, stop, pen, splash,
// win) go into a small preallocated ring that the page drains on frame time for sound and particles.
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
  const LOG_OF = { N: "N", E: "E", S: "S", W: "W", undo: "u", restart: "r" }, ACTION_OF = { N: "N", E: "E", S: "S", W: "W", u: "undo", r: "restart" };
  // Timed events for sound and particles. The ring holds EV_CAP; the oldest drops if the page falls behind.
  const EV_SWIPE = 1, EV_STOP = 2, EV_PEN = 3, EV_SPLASH = 4, EV_WIN = 5, EV_BUMP = 6, EV_CAP = 32;

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOut = (u) => 1 - (1 - u) * (1 - u);
  const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));

  // json: board JSON (never mutated). meta: page labels, e.g. {mode:"daily"|"tutorial"|"test", n, name, date}.
  function create(cfg, json, meta) {
    const B = R.parseBoard(json), m = B.sheep0.length, s0 = R.initialState(B);
    return {
      cfg, json, B, meta: meta || {}, par: B.par,
      start: s0, state: s0, history: [s0],
      swipes: 0, squares: "", // one char per counted swipe, in play order: g = penned one, w = nothing penned, s = splash (share)
      log: "", rev: 0, quiet: false, // log: every effective action (N/E/S/W, u = undo, r = restart); rev bumps with it
      won: false, wonAt: 0, now: 0, queue: null, last: null,
      anim: { kind: ANIM_NONE, t0: 0, slideMs: 0, total: 0, dir: 0,
        fx: new Float32Array(m), fy: new Float32Array(m), tx: new Float32Array(m), ty: new Float32Array(m),
        dur: new Float32Array(m), stop: new Int8Array(m), moving: new Uint8Array(m) },
      bump: { t0: -1, dir: 0 },
      pennedAt: new Float64Array(m).fill(-1e9), hopUntil: 0, // when each sheep reached its pen (drives its one hop)
      ev: { type: new Uint8Array(EV_CAP), i: new Int8Array(EV_CAP), x: new Float32Array(EV_CAP), y: new Float32Array(EV_CAP), t: new Float64Array(EV_CAP), w: 0, r: 0 },
    };
  }

  function emit(g, type, i, x, y, t) {
    if (g.quiet) return;
    const E = g.ev, k = E.w % EV_CAP;
    E.type[k] = type; E.i[k] = i; E.x[k] = x; E.y[k] = y; E.t[k] = t; E.w++;
    if (E.w - E.r > EV_CAP) E.r = E.w - EV_CAP;
  }

  // Hand every event due by `now` to fn(type, sheepIndex, x, y) in time order. Allocation-free.
  function drain(g, now, fn) {
    const E = g.ev;
    for (let guard = 0; guard < EV_CAP && E.r < E.w; guard++) {
      const k = E.r % EV_CAP;
      if (E.t[k] > now) break;
      E.r++;
      fn(E.type[k], E.i[k], E.x[k], E.y[k]);
    }
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
        for (let i = 0; i < g.state.sheep.length; i++) if (!g.state.sheep[i].penned) g.pennedAt[i] = -1e9;
        res = { action: a, noop: false };
      }
    } else if (a === "restart") {
      const changed = g.history.length > 1;
      g.history = [g.start]; g.state = g.start; g.anim.kind = ANIM_NONE; g.pennedAt.fill(-1e9);
      res = { action: a, noop: !changed };
    } else {
      const r = R.swipe(g.B, g.state, a), d = R.dirIndex(a);
      if (r.noop) { g.bump.t0 = t0; g.bump.dir = d; emit(g, EV_BUMP, -1, 0, 0, t0); }
      else {
        g.swipes++;
        g.squares += r.splash ? "s" : r.penned.length ? "g" : "w";
        if (r.moved) { g.state = r.state; g.history.push(r.state); }
        startAnim(g, r.paths, r.splash ? ANIM_SPLASH : ANIM_SLIDE, t0, d);
        swipeEvents(g, r, t0);
        if (r.moved && R.isWin(g.B, g.state)) {
          g.won = true; g.queue = null; g.wonAt = t0 + (g.anim.kind === ANIM_NONE ? 0 : g.anim.total);
          emit(g, EV_WIN, -1, 0, 0, g.wonAt);
        }
      }
      res = { action: a, noop: r.noop, counts: r.counts, splash: r.splash, penned: r.penned.length };
    }
    if (!res.noop) { g.log += LOG_OF[a]; g.rev++; }
    res.swipes = g.swipes; res.won = g.won;
    g.last = res;
    return res;
  }

  // Events for one counted swipe, in time order: the whistle now, then each sheep's stop / pen / splash as it lands.
  function swipeEvents(g, r, t0) {
    const A = g.anim, C = g.cfg.anim;
    emit(g, EV_SWIPE, -1, 0, 0, t0);
    const land = r.paths.map((p) => ({ p, t: t0 + A.dur[p.i] })).sort((a, b) => a.t - b.t);
    for (const e of land) {
      const p = e.p;
      if (r.splash) { if (p.stop === "pond") emit(g, EV_SPLASH, p.i, p.to.x, p.to.y, e.t); }
      else if (p.stop === "pen") { emit(g, EV_PEN, p.i, p.to.x, p.to.y, e.t); g.pennedAt[p.i] = e.t; g.hopUntil = Math.max(g.hopUntil, e.t + C.stopMs + C.hopMs); }
      else emit(g, EV_STOP, p.i, p.to.x, p.to.y, e.t);
    }
  }

  // Rebuild a game from its action log (a resume) with no animation, events or hops. Returns false on a bad char.
  function replay(g, log) {
    g.quiet = true;
    let ok = true;
    for (let k = 0; k < log.length && !g.won; k++) {
      const a = ACTION_OF[log[k]];
      if (!a) { ok = false; break; }
      apply(g, a, g.now);
      g.anim.kind = ANIM_NONE; g.bump.t0 = -1;
    }
    g.quiet = false; g.queue = null;
    g.pennedAt.fill(-1e9); g.hopUntil = 0;
    if (g.won) g.wonAt = -1e9; // a restored win shows its result at once, without the flock jump
    return ok;
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
      g.ev.r = g.ev.w; // and drop its not-yet-heard events (no burst of stale bleats)
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

  // Win celebration length: every sheep hops winJumps times, each starting winStaggerMs after the one before.
  function winMs(g) { const C = g.cfg.anim; return (g.state.sheep.length - 1) * C.winStaggerMs + C.winJumps * C.winJumpMs; }

  function animating(g) { return busy(g) || g.bump.t0 >= 0 || g.queue !== null || g.now < g.hopUntil || (g.won && g.now < g.wonAt + winMs(g)); }

  function resultDue(g) { return g.won && !busy(g) && g.now >= g.wonAt + g.cfg.anim.resultDelayMs; }

  // Where sheep i is drawn right now, written into `out` (allocation-free): x, y in cells (float); sq = squash
  // amount along axis (0 = the E-W axis, 1 = N-S); dunk 0..1 while a splashing sheep sits in the pond; ripple
  // 0..1 through the splash hold (-1 otherwise); hop = lift in cells (the pen hop, the win jump); trot = 0 standing,
  // 1 or 2 = the leg frame while running.
  function pose(g, i, out) {
    const q = g.state.sheep[i], A = g.anim, C = g.cfg.anim;
    out.x = q.x; out.y = q.y; out.sq = 0; out.axis = 0; out.dunk = 0; out.ripple = -1; out.hop = 0; out.trot = 0;
    const th = g.now - g.pennedAt[i] - C.stopMs;
    if (th >= 0 && th < C.hopMs) out.hop = Math.sin((Math.PI * th) / C.hopMs) * C.hopCells;
    if (g.won) {
      const tw = g.now - g.wonAt - i * C.winStaggerMs;
      if (tw >= 0 && tw < C.winJumps * C.winJumpMs) out.hop = Math.max(out.hop, Math.abs(Math.sin((Math.PI * tw) / C.winJumpMs)) * C.winJumpCells);
    }
    if (A.kind === ANIM_NONE || !A.moving[i] || !busy(g)) return out;
    const t = g.now - A.t0, di = A.dur[i];
    if (t < di && A.kind !== ANIM_UNDO) out.trot = 1 + (Math.floor(t / C.trotMs) & 1);
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

  // The share text (SPEC §2): header, then one square per counted swipe (<= perRow a row), then the URL. It is built
  // from the square log alone, so it can never carry a direction.
  function shareText(cfg, n, swipes, par, squares) {
    const S = cfg.share, md = medal(cfg, swipes, par), lines = [S.title + " #" + n + " " + S.mark + " " + swipes + "/" + par + " " + md.emoji];
    let row = "", k = 0;
    for (let j = 0; j < squares.length; j++) {
      const e = S.squares[squares[j]];
      if (!e) continue;
      row += e;
      if (++k === S.perRow) { lines.push(row); row = ""; k = 0; }
    }
    if (row) lines.push(row);
    lines.push(S.url);
    return lines.join("\n");
  }

  return { ANIM_NONE, ANIM_SLIDE, ANIM_SPLASH, ANIM_UNDO, EV_SWIPE, EV_STOP, EV_PEN, EV_SPLASH, EV_WIN, EV_BUMP,
    create, input, frame, busy, animating, resultDue, pose, gateShut, bumpPx, medal, solveFrom, drain, replay, winMs, shareText };
});
