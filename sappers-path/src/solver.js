// Sapper's Path solver v2 + naive-player metrics (SPEC-v2 §2, §5). PURE, UMD like engine.js; every derived fact comes
// from engine.derive, so the solver and the game can never disagree.
//
// solve():     memoised DFS over (broken set, spent) under the level's rule, muster and stacks. Branching is the legal
//              calls (at most 4, or K + chests in stacks mode). Explores the WHOLE reachable graph so it can count dead
//              ends and traps; each state stores three distances-to-win (any win, a win that claimed a chest, a win that
//              claimed none). Returns min calls, one optimal line, counts, trap rate, decision points, and the v2 proxies:
//              ties on the line, and "reshapes" (a wall the line needs later was reachable but not its crew's target).
//              Also the longest win (maxWin; slowWin = a win in more than min calls exists, so 2 stars are reachable) and
//              the closest margin (margin: along the line, the smallest gap in walk between a called crew's target and
//              the next-nearest reachable wall of the same material; null when no call had a runner-up).
//              Hard state cap from opts.cap; at the cap it says capped, never throws.
// frontier():  with unlimited crews, the Pareto-minimal crew mixes that win (vectors of calls per material, length at
//              most opts.maxLen). Every frontier vector v is a muster whose every win spends exactly v (the generator's
//              scarce muster). Rule A prunes with a lower bound (walls still to cross); Rule B floods and has no prune.
// greedy():    a naive player: call the material whose target is nearest the keep (ties: shorter walk, lower move).
// playouts():  seeded uniform-random legal calls until win or stuck; returns the win rate.
(function (root, factory) {
  const E = typeof module === "object" && module.exports ? require("./engine.js") : root.SappersPath.engine;
  const api = factory(E);
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).solver = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (E) {
  "use strict";
  const DEFAULT_CAP = 200000, INF = 255;

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // State → Map key: 16 section flags per char, then the spent counters when they are not implied by the broken set
  // (Rule A without stacks: spent[m] = broken sections of m).
  const spentInKey = (B) => B.rule === "B" || !!B.cols;
  function keyOf(B, br, sp) {
    let s = "";
    for (let i = 0; i < br.length; i += 16) { let v = 0; const e = Math.min(16, br.length - i); for (let j = 0; j < e; j++) if (br[i + j]) v |= 1 << j; s += String.fromCharCode(v); }
    if (spentInKey(B)) for (let i = 0; i < sp.length; i++) s += String.fromCharCode(sp[i] + 1);
    return s;
  }
  function unkey(B, k, br, sp) {
    const nc = (br.length + 15) >> 4;
    for (let i = 0; i < br.length; i++) br[i] = (k.charCodeAt(i >> 4) >> (i & 15)) & 1;
    if (spentInKey(B)) for (let i = 0; i < sp.length; i++) sp[i] = k.charCodeAt(nc + i) - 1;
    else { sp.fill(0); for (let s = 0; s < br.length; s++) if (br[s]) sp[B.secMat[s]]++; }
  }
  const pack = (v, c, z) => v | (c << 8) | (z << 16);

  // Returns {win, min, line:[moves], lineSecs:[[sections]], states, dead, lost, wins, capped, ms, minChest, minNoChest,
  //   chestOnOptimal, chestRequired, trapRate, traps, moves, winnable, decisions, choices, lineTrap, tieAny, tieMove, reshapes,
//   maxWin, slowWin, margin}. A state's depth is its call count (each state's key fixes it), so maxWin is exact.
  // min/minChest/minNoChest are null when no such win exists. opts.traps === false skips the trap/line proxies.
  function solve(B, opts) {
    const t0 = Date.now(), cap = (opts && opts.cap) || DEFAULT_CAP, depth = B.maxCalls + 2;
    const out = { win: false, min: null, line: [], lineSecs: [], states: 0, dead: 0, lost: 0, wins: 0, capped: false, ms: 0, minChest: null, minNoChest: null,
      chestOnOptimal: false, chestRequired: false, trapRate: 0, traps: 0, moves: 0, winnable: 0, decisions: 0, choices: 0, lineTrap: 0, tieAny: false, tieMove: false, reshapes: 0,
      maxWin: null, slowWin: false, margin: null };
    try {
      const br = [], sp = [], Ds = [];
      for (let d = 0; d < depth; d++) { br.push(new Uint8Array(B.nsec)); sp.push(new Int16Array(B.spentLen)); Ds.push(E.scratch(B)); }
      const memo = new Map();
      const visit = (d, key) => {
        const D = E.derive(B, br[d], sp[d], Ds[d]);
        out.states++;
        let v = INF, vc = INF, vz = INF;
        if (D.won) {
          let any = 0; for (let i = 0; i < D.claimed.length; i++) any |= D.claimed[i];
          out.wins++; v = 0; if (any) vc = 0; else vz = 0;
          if (out.maxWin === null || d > out.maxWin) out.maxWin = d;
        } else if (d + 1 < depth) {
          if (D.legal === 0) out.dead++;
          for (let a = 0; a < B.moves; a++) {
            if (E.stepInto(B, br[d], sp[d], D, a, br[d + 1], sp[d + 1]) < 0) continue;
            const k = keyOf(B, br[d + 1], sp[d + 1]);
            let p = memo.get(k);
            if (p === undefined) { if (memo.size >= cap) { out.capped = true; continue; } p = visit(d + 1, k); }
            const a0 = p & 255, b0 = (p >> 8) & 255, c0 = (p >> 16) & 255;
            if (a0 < INF && a0 + 1 < v) v = a0 + 1;
            if (b0 < INF && b0 + 1 < vc) vc = b0 + 1;
            if (c0 < INF && c0 + 1 < vz) vz = c0 + 1;
          }
          if (v === INF) out.lost++;
        }
        const p = pack(v, vc, vz); memo.set(key, p); return p;
      };
      const k0 = keyOf(B, br[0], sp[0]); memo.set(k0, pack(INF, INF, INF));
      const p0 = visit(0, k0);
      const v0 = p0 & 255, c0 = (p0 >> 8) & 255, z0 = (p0 >> 16) & 255;
      const valOf = (b, s, shift) => { const p = memo.get(keyOf(B, b, s)); return p === undefined ? -1 : (p >> shift) & 255; };
      if (v0 < INF) {
        out.win = true; out.min = v0;
        out.minChest = c0 < INF ? c0 : null; out.minNoChest = z0 < INF ? z0 : null; out.slowWin = out.maxWin > v0;
        out.chestOnOptimal = B.chestCell.length > 0 && c0 === v0;
        out.chestRequired = B.chestCell.length > 0 && c0 === v0 && (z0 === INF || z0 > v0);
        // Optimal line; prefers a chest-claiming line when one is optimal (it shows what the chest is for).
        const shift = out.chestOnOptimal ? 8 : 0, cb = new Uint8Array(B.nsec), cs = new Int16Array(B.spentLen), nb = new Uint8Array(B.nsec), ns = new Int16Array(B.spentLen), D = E.scratch(B);
        for (let step = 0, want = out.chestOnOptimal ? c0 : v0; want > 0 && step < depth; step++) {
          E.derive(B, cb, cs, D);
          let pick = -1;
          for (let a = 0; a < B.moves && pick < 0; a++) if (E.stepInto(B, cb, cs, D, a, nb, ns) >= 0 && valOf(nb, ns, shift) === want - 1) pick = a;
          if (pick < 0) break;
          E.stepInto(B, cb, cs, D, pick, nb, ns);
          const got = []; for (let s = 0; s < B.nsec; s++) if (nb[s] && !cb[s]) got.push(s);
          out.line.push(pick); out.lineSecs.push(got); cb.set(nb); cs.set(ns); want--;
        }
      }
      if (!(opts && opts.traps === false)) proxies(B, memo, out, valOf);
    } catch (e) { out.error = String(e && e.message || e); }
    out.ms = Date.now() - t0;
    return out;
  }

  // Trap rate over every winnable state; decision points, choices, ties and reshapes along the found line.
  function proxies(B, memo, out, valOf) {
    const cb = new Uint8Array(B.nsec), cs = new Int16Array(B.spentLen), nb = new Uint8Array(B.nsec), ns = new Int16Array(B.spentLen), D = E.scratch(B);
    const tally = () => {   // D derive()d for (cb, cs): [legal, losing]
      let m = 0, lose = 0;
      for (let a = 0; a < B.moves; a++) { if (E.stepInto(B, cb, cs, D, a, nb, ns) < 0) continue; m++; if (valOf(nb, ns, 0) === INF) lose++; }
      return [m, lose];
    };
    for (const [k, p] of memo) {
      const v = p & 255;
      if (v === 0 || v >= INF) continue;
      unkey(B, k, cb, cs); E.derive(B, cb, cs, D);
      const [m, lose] = tally();
      out.winnable++; out.moves += m; out.traps += lose;
    }
    out.trapRate = out.moves ? out.traps / out.moves : 0;
    if (!out.win) return;
    // Walk the line. A reshape: a section the line breaks later is reachable now, but its crew's target is another wall.
    const later = new Int16Array(B.nsec).fill(-1);
    out.lineSecs.forEach((ss, i) => { for (const s of ss) later[s] = i; });
    const reshaped = new Uint8Array(B.nsec);
    cb.fill(0); cs.fill(0);
    let shareSum = 0, steps = 0;
    for (let i = 0; i < out.line.length; i++, steps++) {
      E.derive(B, cb, cs, D);
      if (D.won) break;
      const [m, lose] = tally();
      if (lose > 0) out.decisions++;
      if (m > 1) out.choices++;
      shareSum += m ? lose / m : 0;
      for (let a = 0; a < B.moves; a++) {
        if (!((D.legalMask >> a) & 1)) continue;
        const mt = B.cols ? D.front[a] : a;
        if (D.tie[mt]) { out.tieAny = true; if (a === out.line[i]) out.tieMove = true; }
      }
      if (B.rule === "A") for (let s = 0; s < B.nsec; s++) if (later[s] > i && D.reach[s] && D.target[B.secMat[s]] !== s && !reshaped[s]) { reshaped[s] = 1; out.reshapes++; }
      // Closest margin: the called crew's target against the next-nearest reachable wall of its material.
      const mc = B.cols ? D.front[out.line[i]] : out.line[i], t = mc >= 0 ? D.target[mc] : -1;
      if (B.rule === "A" && t >= 0) {
        let r = 32767; for (let s = 0; s < B.nsec; s++) if (s !== t && D.reach[s] && !cb[s] && B.secMat[s] === mc && D.sdist[s] < r) r = D.sdist[s];
        if (r < 32767 && (out.margin === null || r - D.sdist[t] < out.margin)) out.margin = r - D.sdist[t];
      }
      E.stepInto(B, cb, cs, D, out.line[i], nb, ns); cb.set(nb); cs.set(ns);
    }
    out.lineTrap = steps ? shareSum / steps : 0;
  }

  // Lower bound on sections still to break (Rule A: one per call): 0-1 BFS from connected ground to a keep neighbour.
  // Entering an unbroken crew wall costs 1 unless you are already inside that section; iron is free; moat, levers block.
  function bound(B, D, S) {
    const n = B.n, nb = B.nb, dist = S.dist, kind = B.kind, open = D.open;
    let cur = S.a, nxt = S.b, cn = 0, nn = 0;
    const cost = (c, e) => {
      const k = kind[e];
      if (k === E.OPEN || k === E.CHEST || k === E.CAMP) return 0;
      if (k !== E.WALL) return -1;
      if (open[e] || B.mat[e] === E.IRON) return 0;
      return kind[c] === E.WALL && !open[c] && B.sec[c] === B.sec[e] ? 0 : 1;
    };
    dist.fill(32767);
    for (let c = 0; c < n; c++) if (D.conn[c]) { dist[c] = 0; cur[cn++] = c; }
    for (let d = 0; d <= B.nsec + 1; d++) {
      for (let i = 0; i < cn; i++) {
        const c = cur[i];
        if (dist[c] !== d) continue;
        if (E.touches(B, S.keepMark, c)) return d;
        for (let j = 0; j < 4; j++) {
          const e = nb[c * 4 + j]; if (e < 0) continue;
          const k = cost(c, e); if (k < 0 || d + k >= dist[e]) continue;
          dist[e] = d + k;
          if (k === 0) cur[cn++] = e; else nxt[nn++] = e;
        }
      }
      const t = cur; cur = nxt; nxt = t; cn = nn; nn = 0;
      if (!cn) break;
    }
    return INF;
  }

  // Pareto frontier of winning crew mixes with unlimited crews (the level's muster, chests and stacks are ignored:
  // chest cells count as plain ground). A vector packs calls per material, 4 bits each.
  // Returns {vecs:[{v, len, comp:[4]}], min, states, capped, ms}.
  const vlen = (v) => (v & 15) + ((v >> 4) & 15) + ((v >> 8) & 15) + ((v >> 12) & 15);
  const vle = (a, b) => (a & 15) <= (b & 15) && ((a >> 4) & 15) <= ((b >> 4) & 15) && ((a >> 8) & 15) <= ((b >> 8) & 15) && ((a >> 12) & 15) <= ((b >> 12) & 15);
  function pareto(list) {
    list.sort((a, b) => vlen(a) - vlen(b) || a - b);
    const out = [];
    for (const v of list) { let dom = false; for (const u of out) if (vle(u, v)) { dom = true; break; } if (!dom) out.push(v); }
    return out;
  }
  function frontier(B0, opts) {
    const B = Object.assign({}, B0, { muster: Int16Array.from([99, 99, 99, 99]), cols: null, ncol: 0, spentLen: 4, moves: 4, chestCell: new Int16Array(0), chestCrew: new Int8Array(0) });
    const t0 = Date.now(), cap = (opts && opts.cap) || DEFAULT_CAP, maxLen = Math.min(15, (opts && opts.maxLen) || 12), ruleA = B.rule === "A";
    const out = { vecs: [], min: null, states: 0, capped: false, ms: 0 };
    try {
      const depth = ruleA ? maxLen + 2 : B.nsec + 2, br = [], sp = [], Ds = [];
      for (let d = 0; d < depth; d++) { br.push(new Uint8Array(B.nsec)); sp.push(new Int16Array(B.spentLen)); Ds.push(E.scratch(B)); }
      const keepMark = new Uint8Array(B.n); for (const k of B.keepCells) keepMark[k] = 1;
      const S = { dist: new Int16Array(B.n), a: new Int32Array(B.n * 2), b: new Int32Array(B.n * 2), keepMark };
      const memo = new Map(), EMPTY = [], unit = [1, 16, 256, 4096];
      // Frontier keys ignore spent: with unlimited crews the future depends only on the broken set.
      const key = (b) => { let s = ""; for (let i = 0; i < b.length; i += 16) { let v = 0; const e = Math.min(16, b.length - i); for (let j = 0; j < e; j++) if (b[i + j]) v |= 1 << j; s += String.fromCharCode(v); } return s; };
      const visit = (d) => {
        const D = E.derive(B, br[d], sp[d], Ds[d]);
        out.states++;
        if (D.won) return [0];
        if (d + 1 >= depth) return EMPTY;
        if (ruleA && d + bound(B, D, S) > maxLen) return EMPTY;
        const acc = [], lim = ruleA ? maxLen - d : maxLen;
        for (let m = 0; m < 4; m++) {
          if (E.stepInto(B, br[d], sp[d], D, m, br[d + 1], sp[d + 1]) < 0) continue;
          const k = key(br[d + 1]);
          let f = memo.get(k);
          if (f === undefined) { if (memo.size >= cap) { out.capped = true; continue; } f = visit(d + 1); memo.set(k, f); }
          for (const v of f) { const u = v + unit[m]; if (vlen(u) <= lim && ((v >> (4 * m)) & 15) < 15) acc.push(u); }
        }
        return acc.length ? pareto(acc) : EMPTY;
      };
      const root = visit(0);
      out.vecs = root.map((v) => ({ v, len: vlen(v), comp: [v & 15, (v >> 4) & 15, (v >> 8) & 15, (v >> 12) & 15] }));
      out.min = out.vecs.length ? out.vecs[0].len : null;
      out.states = memo.size + 1;
    } catch (e) { out.error = String(e && e.message || e); }
    out.ms = Date.now() - t0;
    return out;
  }

  // Greedy naive player. Returns {win, used, line}.
  function greedy(B) {
    let br = new Uint8Array(B.nsec), sp = new Int16Array(B.spentLen), nb = new Uint8Array(B.nsec), ns = new Int16Array(B.spentLen);
    const D = E.scratch(B), line = [];
    for (let step = 0; step <= B.maxCalls; step++) {
      E.derive(B, br, sp, D);
      if (D.won) return { win: true, used: line.length, line };
      let pick = -1, pk = 0, pd = 0;
      for (let a = 0; a < B.moves; a++) {
        if (!((D.legalMask >> a) & 1)) continue;
        const s = D.target[B.cols ? D.front[a] : a], k = B.secKeep[s], d = D.sdist[s];
        if (pick < 0 || k < pk || (k === pk && d < pd)) { pick = a; pk = k; pd = d; }
      }
      if (pick < 0) break;
      E.stepInto(B, br, sp, D, pick, nb, ns);
      const t = br; br = nb; nb = t; const u = sp; sp = ns; ns = u;
      line.push(pick);
    }
    return { win: false, used: line.length, line };
  }

  // n seeded random playouts (uniform over legal calls). Returns {winRate, wins, n}.
  function playouts(B, n, seed) {
    const rng = mulberry32(seed | 0), D = E.scratch(B), legal = new Int8Array(32);
    let br = new Uint8Array(B.nsec), sp = new Int16Array(B.spentLen), nb = new Uint8Array(B.nsec), ns = new Int16Array(B.spentLen), wins = 0;
    for (let i = 0; i < n; i++) {
      br.fill(0); sp.fill(0);
      for (let step = 0; step <= B.maxCalls; step++) {
        E.derive(B, br, sp, D);
        if (D.won) { wins++; break; }
        let m = 0;
        for (let a = 0; a < B.moves; a++) if ((D.legalMask >> a) & 1) legal[m++] = a;
        if (!m) break;
        E.stepInto(B, br, sp, D, legal[Math.floor(rng() * m)], nb, ns);
        const t = br; br = nb; nb = t; const u = sp; sp = ns; ns = u;
      }
    }
    return { winRate: n ? wins / n : 0, wins, n };
  }

  return { solve, frontier, greedy, playouts, bound, pareto, mulberry32, keyOf, INF };
});
