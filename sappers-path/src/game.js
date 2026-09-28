// Sapper's Path game controller (SPEC §1 "A move"). Wraps an engine state with the player's pick and the feedback
// effects. Pure: no DOM, no timers. Every effect is stamped with the sim clock `now` (ms) the page passes in, so
// animation is presentation only, never gates input, and a hidden tab can be driven with SP.tick. UMD like engine.js.
//
// Tap results (strings, so selfTest and the harness can assert them):
//   pick      a crew is now picked (its reachable sections light)      unpick   the picked crew was tapped again
//   blocked   the tapped section is out of reach: it shakes, the walls in the way flash (see blockers())
//   empty     that crew has none left: its card flashes at 0          break    a section was broken (a move)
//   iron      an iron door: only levers open it (it shakes)           clear    ground, moat, keep or rubble: pick cleared
//   over      the level is already won                                  scenery  a section nothing can ever reach (see scenery())
//   chest     an unclaimed chest: pick cleared, g.fx.chestI names it (the page says which crew it holds)
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
      L, B, cfg, st: E.start(B), pick: -1, ver: 0, endT: -1, present, events: [], scenery: scenery(B),
      fx: { pulseS: -1, pulseT: NEVER, shakeS: -1, shakeT: NEVER, flash: new Int16Array(B.nsec), flashN: 0, flashT: NEVER,
        cardM: -1, cardT: NEVER, crumbleS: -1, crumbleT: NEVER, chestI: -1 },
      // blockers() scratch: allocated once per level, so a tap allocates nothing but its event.
      bfs: { dist: new Int16Array(n), par: new Int32Array(n), a: new Int32Array(n * 4), b: new Int32Array(n * 4), seen: new Uint8Array(B.nsec) },
    };
  }

  // SPEC §7 (M2) scenery rule: a section is scenery if no tile of it can ever be exposed, even with unlimited crews and
  // every lever thrown. Flood from the board edge through every cell that can ever be open (ground, chests and every
  // wall, iron included); moat, levers and the keep block. A section with no flooded tile is scenery: drawn muted, no
  // badge, and a tap on it only clears the pick. Computed once per level. Returns a Uint8Array over sections.
  function scenery(B) {
    const n = B.n, seen = new Uint8Array(n), q = new Int32Array(n), out = new Uint8Array(B.nsec);
    const ever = (c) => { const k = B.kind[c]; return k === E.OPEN || k === E.CHEST || k === E.WALL; };
    let h = 0, t = 0;
    for (let c = 0; c < n; c++) if (B.edge[c] && ever(c)) { seen[c] = 1; q[t++] = c; }
    while (h < t) { const c = q[h++]; for (let d = 0; d < 4; d++) { const e = B.nb[c * 4 + d]; if (e >= 0 && !seen[e] && ever(e)) { seen[e] = 1; q[t++] = e; } } }
    for (let s = 0; s < B.nsec; s++) { let live = 0; for (let i = B.secStart[s]; i < B.secStart[s + 1] && !live; i++) live = seen[B.secCells[i]]; out[s] = live ? 0 : 1; }
    return out;
  }

  // SPEC §1 stars from crews used (= sections broken) against the solver's minimum; offsets from config.stars.
  function stars(cfg, min, used) {
    const S = cfg.stars;
    return used <= min + S.threeAtMinPlus ? 3 : used <= min + S.twoAtMinPlus ? 2 : 1;
  }

  function tapCell(g, x, y, now) {
    const B = g.B, st = g.st, s = E.sectionAt(B, x, y);
    if (st.won) return "over";
    if (s < 0 && x >= 0 && y >= 0 && x < B.w && y < B.h) {
      const c = y * B.w + x;
      for (let i = 0; i < B.chestCell.length; i++) if (B.chestCell[i] === c && !st.claimed[i]) { g.pick = -1; g.fx.chestI = i; return "chest"; }
    }
    if (s < 0 || st.broken[s] || st.doorOpen[s]) { g.pick = -1; return "clear"; }
    if (g.scenery[s]) { g.pick = -1; return "scenery"; }
    if (!E.isCrewSection(B, s)) { shake(g, s, now); g.fx.flashN = 0; return "iron"; }
    const m = B.secMat[s];
    if (st.remaining[m] <= 0) { g.fx.cardM = m; g.fx.cardT = now; if (g.pick === m) g.pick = -1; return "empty"; }
    if (!g.cfg.input.twoTap || g.pick === m) {
      if (st.reach[s] !== 1) { g.pick = m; blocked(g, s, now); return "blocked"; }
      return commit(g, s, now) ? "break" : "over";
    }
    g.pick = m;
    if (st.reach[s] !== 1) { blocked(g, s, now); return "blocked"; }
    g.fx.pulseS = s; g.fx.pulseT = now;
    return "pick";
  }

  function tapCrew(g, m, now) {
    if (g.st.won || !(m >= 0 && m < 4)) return "over";
    if (g.st.remaining[m] <= 0) { g.fx.cardM = m; g.fx.cardT = now; if (g.pick === m) g.pick = -1; return "empty"; }
    if (g.pick === m) { g.pick = -1; return "unpick"; }
    g.pick = m;
    return "pick";
  }

  function commit(g, s, now) {
    const next = E.apply(g.B, g.st, s);
    if (!next) return false;
    const m = g.B.secMat[s];
    g.st = next; g.ver++;
    g.fx.crumbleS = s; g.fx.crumbleT = now; g.fx.pulseT = NEVER; g.fx.shakeT = NEVER; g.fx.flashT = NEVER;
    if (!g.cfg.input.keepPick || next.remaining[m] <= 0) g.pick = -1;
    g.events.push({ t: "break", s });
    if (next.won || next.stuck) { g.endT = now; g.events.push({ t: next.won ? "win" : "stuck" }); }
    return true;
  }

  function reset(g, st) {
    g.st = st; g.ver++; g.pick = -1; g.endT = -1;
    const f = g.fx; f.pulseT = f.shakeT = f.flashT = f.cardT = f.crumbleT = NEVER;
  }
  // Unlimited undo: one move back, exactly (the engine re-derives from the move list, so the crew comes back).
  function undo(g) { if (!g.st.moves.length) return false; reset(g, E.undo(g.B, g.st)); g.events.push({ t: "undo" }); return true; }
  function restart(g) { const had = g.st.moves.length > 0; reset(g, E.restart(g.B)); g.events.push({ t: "restart" }); return had; }

  function shake(g, s, now) { g.fx.shakeS = s; g.fx.shakeT = now; }
  function blocked(g, s, now) { shake(g, s, now); g.fx.flashN = blockers(g, s); g.fx.flashT = now; }

  // SPEC §7 (M1) blocking-wall rule: the walls "in the way" of an unreachable section s are the fewest unbroken wall
  // sections (iron included) whose breaking would expose s: a 0-1 BFS from connected ground and the board edge, where
  // stepping into a new unbroken section costs 1 and moving inside one costs 0; moat, levers, the keep and s itself
  // block. The first cheapest route found wins ties. Writes the section ids into g.fx.flash; returns how many.
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
    for (let c = 0; c < n; c++) {
      if (st.conn[c]) { dist[c] = 0; cur[cn++] = c; continue; }
      if (!B.edge[c]) continue;
      const k = cost(-1, c);
      if (k === 0) { dist[c] = 0; cur[cn++] = c; } else if (k === 1 && nn < cap) { dist[c] = 1; nxt[nn++] = c; }
    }
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

  // Fewest further breaks from the current position (BFS over broken sets on copies; the game is untouched).
  // Returns {win, more, line: [[x, y] of each section's first tile], states, capped}.
  function solveFrom(g, cap) {
    const B = g.B, out = { win: false, more: null, line: [], states: 0, capped: false };
    const key = (br) => br.join("");
    const start = g.st.broken.slice(), seen = new Map([[key(start), null]]), queue = [start], D = E.scratch(B);
    for (let qi = 0; qi < queue.length; qi++) {
      const br = queue[qi];
      E.derive(B, br, D); out.states++;
      if (D.won) {
        const moves = [];
        for (let k = key(br), guard = 0; seen.get(k) && guard <= B.nsec; guard++) { const p = seen.get(k); moves.unshift(p.s); k = p.from; }
        out.win = true; out.more = moves.length;
        out.line = moves.map((s) => { const c = B.secCells[B.secStart[s]]; return [c % B.w, (c / B.w) | 0]; });
        return out;
      }
      for (let s = 0; s < B.nsec; s++) {
        if (br[s] || !D.reach[s] || B.secMat[s] >= E.IRON || D.remaining[B.secMat[s]] <= 0) continue;
        const nx = br.slice(); nx[s] = 1;
        const k = key(nx);
        if (seen.has(k)) continue;
        if (seen.size >= cap) { out.capped = true; return out; }
        seen.set(k, { s, from: key(br) }); queue.push(nx);
      }
    }
    return out;
  }

  // First tile of section s as [x, y] (what the baked `line` uses).
  function firstTile(B, s) { const c = B.secCells[B.secStart[s]]; return [c % B.w, (c / B.w) | 0]; }

  return { create, scenery, stars, tapCell, tapCrew, undo, restart, blockers, solveFrom, firstTile, NEVER };
});
