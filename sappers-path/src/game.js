// Sapper's Path game controller v2 (SPEC-v2 §3 "Input and feedback"). Wraps an engine state with the confirm-mode aim
// and the feedback effects. Pure: no DOM, no timers. Every effect is stamped with the sim clock `now` (ms) the page
// passes in, so animation is presentation only, never gates input, and a hidden tab can be driven with SP.tick.
// UMD like engine.js.
//
// A move is ONE tap on a crew card: callCrew() sends that crew to its target (the engine's Rule A pick). Results:
//   call     a crew was sent (a move)                    aim    confirm mode only: the first tap showed the target
//   empty    that crew has none left (its card flashes)  none   that crew has no wall it can reach (its card flashes)
//   over     the level is already won
// The board is info only (tapCell never moves anything). Results:
//   next     a wall the named crew breaks on its next call (it pulses)
//   closer   reachable, but its crew goes for a closer wall first (the real target pulses)
//   far      out of reach: it shakes, the walls in the way flash (blockers())
//   empty    its crew has none left (the card flashes)    iron    an iron door: only levers open it (it shakes)
//   chest    an unclaimed chest (g.fx.chestI names it)     keep    the keep itself
//   scenery  a section nothing can ever reach (scenery()) clear   ground, moat, rubble
//   over     the level is already won
(function (root, factory) {
  const E = typeof module === "object" && module.exports ? require("./engine.js") : root.SappersPath.engine;
  const api = factory(E);
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).game = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (E) {
  "use strict";
  const NEVER = -1e12;

  // L: a level from levels.json. cfg: config.json. Throws only if the level itself is malformed (the page catches).
  function create(L, cfg) {
    const B = E.parse(L), n = B.n;
    const present = [0, 0, 0, 0];
    for (let s = 0; s < B.nsec; s++) if (B.secMat[s] < E.IRON) present[B.secMat[s]] = 1;
    for (let i = 0; i < 4; i++) if (B.muster[i] > 0) present[i] = 1;
    for (let i = 0; i < B.chestCrew.length; i++) present[B.chestCrew[i]] = 1;
    return {
      L, B, cfg, st: E.start(B), aim: -1, ver: 0, endT: -1, present, events: [], scenery: scenery(B),
      fx: { pulseS: -1, pulseT: NEVER, shakeS: -1, shakeT: NEVER, flash: new Int16Array(B.nsec), flashN: 0, flashT: NEVER,
        cardM: -1, cardT: NEVER, chestI: -1, infoM: -1 },
      // blockers() scratch: allocated once per level, so a tap allocates nothing but its event.
      bfs: { dist: new Int16Array(n), par: new Int32Array(n), a: new Int32Array(n * 4), b: new Int32Array(n * 4), seen: new Uint8Array(B.nsec) },
    };
  }

  // SPEC §7 (M2) scenery rule, v2 form: a section is scenery if no tile of it can ever be reached from the camp, even with
  // unlimited crews and every lever thrown. Flood from the camp through every cell that can ever be open (ground, camp,
  // chests and every wall, iron included); moat, levers and the keep block. Computed once per level.
  function scenery(B) {
    const n = B.n, seen = new Uint8Array(n), q = new Int32Array(n), out = new Uint8Array(B.nsec);
    const ever = (c) => { const k = B.kind[c]; return k === E.OPEN || k === E.CHEST || k === E.CAMP || k === E.WALL; };
    let h = 0, t = 0;
    for (let i = 0; i < B.camp.length; i++) { seen[B.camp[i]] = 1; q[t++] = B.camp[i]; }
    while (h < t) { const c = q[h++]; for (let d = 0; d < 4; d++) { const e = B.nb[c * 4 + d]; if (e >= 0 && !seen[e] && ever(e)) { seen[e] = 1; q[t++] = e; } } }
    for (let s = 0; s < B.nsec; s++) { let live = 0; for (let i = B.secStart[s]; i < B.secStart[s + 1] && !live; i++) live = seen[B.secCells[i]]; out[s] = live ? 0 : 1; }
    return out;
  }

  // SPEC §1 stars from calls against the solver's minimum; offsets from config.stars.
  function stars(cfg, min, calls) {
    const S = cfg.stars;
    return calls <= min + S.threeAtMinPlus ? 3 : calls <= min + S.twoAtMinPlus ? 2 : 1;
  }

  // The engine move for crew m: the material itself, or (stacks mode) the first legal column whose front token is m.
  function moveFor(g, m) {
    const B = g.B, st = g.st;
    if (!B.cols) return m;
    for (let j = 0; j < B.ncol; j++) if (st.front[j] === m && ((st.legalMask >> j) & 1)) return j;
    return -1;
  }
  // Why crew m can't be called right now ("empty", "none"), or null if it can.
  function blockedWhy(g, m) {
    const st = g.st;
    if (st.remaining[m] <= 0) return "empty";
    if (st.target[m] < 0 || moveFor(g, m) < 0) return "none";
    return null;
  }

  // One tap on a crew card (SPEC-v2 §3). config.input.confirm: the first tap only aims (target and path light up).
  function callCrew(g, m, now) {
    const st = g.st, f = g.fx;
    if (st.won || !(m >= 0 && m < 4)) return "over";
    const why = blockedWhy(g, m);
    if (why) { f.cardM = m; f.cardT = now; g.aim = -1; return why; }
    if (g.cfg.input.confirm && g.aim !== m) { g.aim = m; f.pulseS = st.target[m]; f.pulseT = now; return "aim"; }
    const s = st.target[m], next = E.call(g.B, st, moveFor(g, m));
    if (!next) return "over";
    g.st = next; g.ver++; g.aim = -1;
    f.pulseT = f.shakeT = f.flashT = NEVER;
    g.events.push({ t: "call", m, s });
    if (next.won || next.stuck) { g.endT = now; g.events.push({ t: next.won ? "win" : "stuck" }); }
    return "call";
  }

  // Board tap: info only (SPEC-v2 §3). Never moves anything; clears a confirm-mode aim.
  function tapCell(g, x, y, now) {
    const B = g.B, st = g.st, f = g.fx, s = E.sectionAt(B, x, y), inside = x >= 0 && y >= 0 && x < B.w && y < B.h;
    f.infoM = -1; g.aim = -1;
    if (st.won) return "over";
    if (s < 0 && inside) {
      const c = y * B.w + x;
      for (let i = 0; i < B.chestCell.length; i++) if (B.chestCell[i] === c && !st.claimed[i]) { f.chestI = i; return "chest"; }
      if (B.kind[c] === E.KEEP) return "keep";
    }
    if (s < 0 || st.broken[s] || st.doorOpen[s]) return "clear";
    if (g.scenery[s]) return "scenery";
    if (!E.isCrewSection(B, s)) { shake(g, s, now); f.flashN = 0; return "iron"; }
    const m = B.secMat[s]; f.infoM = m;
    if (st.remaining[m] <= 0) { f.cardM = m; f.cardT = now; return "empty"; }
    if (st.reach[s] !== 1) { blocked(g, s, now); return "far"; }
    const t = B.rule === "B" ? s : st.target[m];
    f.pulseS = t; f.pulseT = now;
    return t === s ? "next" : "closer";
  }

  function reset(g, st) {
    g.st = st; g.ver++; g.aim = -1; g.endT = -1;
    const f = g.fx; f.pulseT = f.shakeT = f.flashT = f.cardT = NEVER;
  }
  // Unlimited undo: one call back, exactly (the engine replays the call list, so the crew comes back).
  function undo(g) { if (!g.st.moves.length) return false; reset(g, E.undo(g.B, g.st)); g.events.push({ t: "undo" }); return true; }
  function restart(g) { const had = g.st.moves.length > 0; reset(g, E.restart(g.B)); g.events.push({ t: "restart" }); return had; }

  function shake(g, s, now) { g.fx.shakeS = s; g.fx.shakeT = now; }
  function blocked(g, s, now) { shake(g, s, now); g.fx.flashN = blockers(g, s); g.fx.flashT = now; }

  // SPEC §7 (M1) blocking-wall rule, v2 form: the walls "in the way" of an unreachable section s are the fewest unbroken
  // wall sections (iron included) whose breaking would expose s: a 0-1 BFS from the camp's connected ground (board edges
  // are not outside in v2), where stepping into a new unbroken section costs 1 and moving inside one costs 0; moat,
  // levers, the keep and s itself block. The first cheapest route found wins ties. Writes the ids into g.fx.flash.
  function blockers(g, s) {
    const B = g.B, st = g.st, n = B.n, nb = B.nb, kind = B.kind, sec = B.sec, open = st.open, X = g.bfs, dist = X.dist, par = X.par;
    const cap = n * 4, INF = 32767;
    const cost = (c, e) => {
      if (sec[e] === s && !open[e]) return -1;
      if (open[e]) return 0;
      if (kind[e] !== E.WALL) return -1;
      return c >= 0 && !open[c] && kind[c] === E.WALL && sec[c] === sec[e] ? 0 : 1;
    };
    const hits = (c) => { for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && sec[e] === s) return true; } return false; };
    dist.fill(INF); par.fill(-1);
    let cur = X.a, nxt = X.b, cn = 0, nn = 0, goal = -1;
    for (let c = 0; c < n; c++) if (st.conn[c]) { dist[c] = 0; cur[cn++] = c; }
    for (let d = 0; d <= B.nsec + 1 && goal < 0; d++) {
      for (let i = 0; i < cn && goal < 0; i++) {
        const c = cur[i];
        if (dist[c] !== d) continue;
        if (hits(c)) { goal = c; break; }
        for (let j = 0; j < 4; j++) {
          const e = nb[c * 4 + j]; if (e < 0) continue;
          const k = cost(c, e); if (k < 0 || d + k >= dist[e]) continue;
          if (k === 0 ? cn >= cap : nn >= cap) continue;
          dist[e] = d + k; par[e] = c;
          if (k === 0) cur[cn++] = e; else nxt[nn++] = e;
        }
      }
      const t = cur; cur = nxt; nxt = t; cn = nn; nn = 0;
      if (!cn) break;
    }
    if (goal < 0) return 0;
    X.seen.fill(0);
    let count = 0;
    for (let c = goal, guard = 0; c >= 0 && guard < n; c = par[c], guard++) {
      const q = sec[c];
      if (q >= 0 && !open[c] && !X.seen[q]) { X.seen[q] = 1; g.fx.flash[count++] = q; }
    }
    return count;
  }

  // Fewest further calls from the current position (BFS over (broken, spent) on copies; the game is untouched).
  // Returns {win, more, line: [crew names], states, capped}.
  function solveFrom(g, cap) {
    const B = g.B, out = { win: false, more: null, line: [], states: 0, capped: false };
    const key = (br, sp) => br.join("") + "|" + sp.join(",");
    const D = E.scratch(B), q = [{ br: g.st.broken.slice(), sp: g.st.spent.slice(), a: -1, from: null }], seen = new Set([key(q[0].br, q[0].sp)]);
    for (let qi = 0; qi < q.length; qi++) {
      const N = q[qi];
      E.derive(B, N.br, N.sp, D); out.states++;
      if (D.won) {
        for (let p = N; p && p.a >= 0; p = p.from) out.line.unshift(B.cols ? p.a : E.CREWS[p.a]);
        out.win = true; out.more = out.line.length; return out;
      }
      for (let a = 0; a < B.moves; a++) {
        const nbr = new Uint8Array(B.nsec), nsp = new Int16Array(B.spentLen);
        if (E.stepInto(B, N.br, N.sp, D, a, nbr, nsp) < 0) continue;
        const k = key(nbr, nsp);
        if (seen.has(k)) continue;
        if (seen.size >= cap) { out.capped = true; return out; }
        seen.add(k); q.push({ br: nbr, sp: nsp, a, from: N });
      }
    }
    return out;
  }

  // First tile of section s as [x, y] (what the baked `lineCells` uses).
  function firstTile(B, s) { const c = B.secCells[B.secStart[s]]; return [c % B.w, (c / B.w) | 0]; }

  return { create, scenery, stars, callCrew, blockedWhy, tapCell, undo, restart, blockers, solveFrom, firstTile, NEVER };
});
