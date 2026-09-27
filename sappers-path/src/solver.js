// Sapper's Path solver + naive-player metrics (SPEC §3). PURE, UMD like engine.js; every derived fact comes from
// engine.derive, so the solver and the game can never disagree.
//
// solve():     memoised DFS over the broken-section set (the whole state), bounded by the muster. Explores the WHOLE
//              reachable graph so it can count dead ends; each state stores three distances-to-win: any win, a win that
//              claimed a chest, a win that claimed none. Hard state cap from opts.cap; at the cap it says capped, never throws.
// quickest():  fewest sections to the keep with UNLIMITED crews (the generator sets the muster from its line). A* with
//              a 0-1 BFS bound that treats iron as free, so it is exact on boards without levers.
// greedy():    a naive player: break the reachable section nearest the keep that still has a crew (ties: lowest id).
// playouts():  seeded uniform-random legal breaks until win or stuck; returns the win rate.
(function (root, factory) {
  const E = typeof module === "object" && module.exports ? require("./engine.js") : root.SappersPath.engine;
  const api = factory(E);
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).solver = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (E) {
  "use strict";
  const DEFAULT_CAP = 200000, INF = 255;

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // Broken set → Map key: 16 section flags per char.
  function keyOf(br) {
    let s = "";
    for (let i = 0; i < br.length; i += 16) { let v = 0; const e = Math.min(16, br.length - i); for (let j = 0; j < e; j++) if (br[i + j]) v |= 1 << j; s += String.fromCharCode(v); }
    return s;
  }
  function unkey(k, br) { for (let i = 0; i < br.length; i++) br[i] = (k.charCodeAt(i >> 4) >> (i & 15)) & 1; return br; }
  const pack = (v, c, z) => v | (c << 8) | (z << 16);

  // Returns {win, min, line:[section ids], states, dead, lost, wins, capped, ms, minChest, minNoChest, chestOnOptimal, chestRequired}.
  // min/minChest/minNoChest are null when no such win exists. A capped search reports what it found and capped:true.
  function solve(B, opts) {
    const t0 = Date.now(), cap = (opts && opts.cap) || DEFAULT_CAP, depth = B.nsec + 2;
    const out = { win: false, min: null, line: [], states: 0, dead: 0, lost: 0, wins: 0, capped: false, ms: 0, minChest: null, minNoChest: null, chestOnOptimal: false, chestRequired: false };
    try {
      const br = [], Ds = [];
      for (let d = 0; d < depth; d++) { br.push(new Uint8Array(B.nsec)); Ds.push(E.scratch(B)); }
      const memo = new Map();
      const visit = (d, key) => {
        const D = E.derive(B, br[d], Ds[d]);
        out.states++;
        let v = INF, vc = INF, vz = INF;
        if (D.won) {
          let any = 0; for (let i = 0; i < D.claimed.length; i++) any |= D.claimed[i];
          out.wins++; v = 0; if (any) vc = 0; else vz = 0;
        } else {
          if (D.legal === 0) out.dead++;
          const nx = br[d + 1];
          for (let s = 0; s < B.nsec; s++) {
            if (br[d][s] || !D.reach[s] || B.secMat[s] >= E.IRON || D.remaining[B.secMat[s]] <= 0) continue;
            nx.set(br[d]); nx[s] = 1;
            const k = keyOf(nx);
            let p = memo.get(k);
            if (p === undefined) { if (memo.size >= cap) { out.capped = true; continue; } p = visit(d + 1, k); }
            const a = p & 255, b = (p >> 8) & 255, c = (p >> 16) & 255;
            if (a < INF && a + 1 < v) v = a + 1;
            if (b < INF && b + 1 < vc) vc = b + 1;
            if (c < INF && c + 1 < vz) vz = c + 1;
          }
          if (v === INF) out.lost++;
        }
        const p = pack(v, vc, vz); memo.set(key, p); return p;
      };
      const k0 = keyOf(br[0]); memo.set(k0, 0);
      const p0 = visit(0, k0);
      const v0 = p0 & 255, c0 = (p0 >> 8) & 255, z0 = (p0 >> 16) & 255;
      if (v0 < INF) {
        out.win = true; out.min = v0;
        out.minChest = c0 < INF ? c0 : null; out.minNoChest = z0 < INF ? z0 : null;
        out.chestOnOptimal = B.chestCell.length > 0 && c0 === v0;
        out.chestRequired = B.chestCell.length > 0 && c0 === v0 && (z0 === INF || z0 > v0);
        // Optimal line; prefers a chest-claiming line when one is optimal (it shows what the chest is for).
        const useC = out.chestOnOptimal, cur = new Uint8Array(B.nsec), D = E.scratch(B);
        for (let step = 0, want = useC ? c0 : v0; want > 0 && step < depth; step++) {
          E.derive(B, cur, D);
          let pick = -1;
          for (let s = 0; s < B.nsec && pick < 0; s++) {
            if (cur[s] || !D.reach[s] || B.secMat[s] >= E.IRON || D.remaining[B.secMat[s]] <= 0) continue;
            cur[s] = 1; const p = memo.get(keyOf(cur)); cur[s] = 0;
            if (p !== undefined && ((useC ? (p >> 8) : p) & 255) === want - 1) pick = s;
          }
          if (pick < 0) break;
          cur[pick] = 1; out.line.push(pick); want--;
        }
      }
    } catch (e) { out.error = String(e && e.message || e); }
    out.ms = Date.now() - t0;
    return out;
  }

  // Lower bound on sections still to break: 0-1 BFS from connected ground (and the outside) to a keep neighbour.
  // Entering an unbroken crew wall costs 1 unless you are already inside that section; iron is free; moat, levers block.
  function bound(B, D, S) {
    const n = B.n, nb = B.nb, dist = S.dist, kind = B.kind, open = D.open;
    let cur = S.a, nxt = S.b, cn = 0, nn = 0;
    const cost = (c, e) => {
      const k = kind[e];
      if (k === E.OPEN || k === E.CHEST) return 0;
      if (k !== E.WALL) return -1;
      if (open[e] || B.mat[e] === E.IRON) return 0;
      return c >= 0 && kind[c] === E.WALL && !open[c] && B.sec[c] === B.sec[e] ? 0 : 1;
    };
    dist.fill(32767);
    for (let c = 0; c < n; c++) {
      if (D.conn[c]) { dist[c] = 0; cur[cn++] = c; continue; }
      if (!B.edge[c]) continue;
      const k = cost(-1, c);
      if (k === 0) { dist[c] = 0; cur[cn++] = c; } else if (k === 1) { dist[c] = 1; nxt[nn++] = c; }
    }
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

  // Unlimited-crew shortest line. Returns {win, min, line, states, capped}.
  function quickest(B, opts) {
    const cap = (opts && opts.cap) || DEFAULT_CAP, out = { win: false, min: null, line: [], states: 0, capped: false };
    try {
      const keepMark = new Uint8Array(B.n); keepMark[B.keep] = 1;
      const S = { dist: new Int16Array(B.n), a: new Int32Array(B.n), b: new Int32Array(B.n), keepMark };
      const D = E.scratch(B), br = new Uint8Array(B.nsec);
      const keys = [], parent = [], move = [], g = [], seen = new Map(), buckets = [];
      const add = (k, par, mv, gg, f) => { const id = keys.length; keys.push(k); parent.push(par); move.push(mv); g.push(gg); seen.set(k, id); (buckets[f] = buckets[f] || []).push(id); };
      E.derive(B, br, D);
      const h0 = bound(B, D, S);
      if (h0 >= INF) return out;
      add(keyOf(br), -1, -1, 0, h0);
      for (let f = h0; f < buckets.length; f++) {
        const bk = buckets[f];
        while (bk && bk.length) {
          const id = bk.pop();
          unkey(keys[id], br); E.derive(B, br, D);
          out.states++;
          if (D.won) {
            for (let x = id; parent[x] >= 0; x = parent[x]) out.line.unshift(move[x]);
            out.win = true; out.min = g[id]; return out;
          }
          const reach = D.reach.slice();
          for (let s = 0; s < B.nsec; s++) {
            if (!reach[s]) continue;
            br[s] = 1; const k = keyOf(br);
            if (!seen.has(k)) {
              if (seen.size >= cap) { out.capped = true; return out; }
              E.derive(B, br, D);
              const h = bound(B, D, S);
              if (h < INF) add(k, id, s, g[id] + 1, g[id] + 1 + h);
            }
            br[s] = 0;
          }
        }
      }
    } catch (e) { out.error = String(e && e.message || e); }
    return out;
  }

  // Greedy naive player. Returns {win, used, line}.
  function greedy(B) {
    const br = new Uint8Array(B.nsec), D = E.scratch(B), line = [];
    for (let step = 0; step <= B.nsec; step++) {
      E.derive(B, br, D);
      if (D.won) return { win: true, used: line.length, line };
      let pick = -1;
      for (let s = 0; s < B.nsec; s++) {
        if (br[s] || !D.reach[s] || B.secMat[s] >= E.IRON || D.remaining[B.secMat[s]] <= 0) continue;
        if (pick < 0 || B.secDist[s] < B.secDist[pick]) pick = s;
      }
      if (pick < 0) break;
      br[pick] = 1; line.push(pick);
    }
    return { win: false, used: line.length, line };
  }

  // n seeded random playouts (uniform over legal breaks). Returns {winRate, wins, n}.
  function playouts(B, n, seed) {
    const rng = mulberry32(seed | 0), br = new Uint8Array(B.nsec), D = E.scratch(B), legal = new Int16Array(B.nsec);
    let wins = 0;
    for (let i = 0; i < n; i++) {
      br.fill(0);
      for (let step = 0; step <= B.nsec; step++) {
        E.derive(B, br, D);
        if (D.won) { wins++; break; }
        let m = 0;
        for (let s = 0; s < B.nsec; s++) if (!br[s] && D.reach[s] && B.secMat[s] < E.IRON && D.remaining[B.secMat[s]] > 0) legal[m++] = s;
        if (!m) break;
        br[legal[Math.floor(rng() * m)]] = 1;
      }
    }
    return { winRate: n ? wins / n : 0, wins, n };
  }

  // Trap-rate proxy (M0b, additive: solve() is untouched). Explores the same state graph as solve() under the muster.
  // A winnable state = reachable from the start, not won, a win still reachable. trapRate = over every winnable state,
  // the share of legal breaks that lose (lead to a state with no win). decisions = steps on an optimal line where at
  // least one legal break loses; choices = steps on it with two or more legal breaks. opts.line (section ids) walks
  // that line instead of the first optimal one. Never throws; at the cap it reports capped with what it has.
  // Returns {trapRate, traps, moves, winnable, decisions, choices, lineTrap, states, capped}.
  function traps(B, opts) {
    const cap = (opts && opts.cap) || DEFAULT_CAP, depth = B.nsec + 2;
    const out = { trapRate: 0, traps: 0, moves: 0, winnable: 0, decisions: 0, choices: 0, lineTrap: 0, states: 0, capped: false };
    try {
      const br = [], Ds = [], memo = new Map();
      for (let d = 0; d < depth; d++) { br.push(new Uint8Array(B.nsec)); Ds.push(E.scratch(B)); }
      const legalOk = (D, b, s) => !b[s] && D.reach[s] && B.secMat[s] < E.IRON && D.remaining[B.secMat[s]] > 0;
      const visit = (d, key) => {
        const D = E.derive(B, br[d], Ds[d]);
        let v = INF;
        if (D.won) v = 0;
        else {
          const nx = br[d + 1];
          for (let s = 0; s < B.nsec; s++) {
            if (!legalOk(D, br[d], s)) continue;
            nx.set(br[d]); nx[s] = 1;
            const k = keyOf(nx);
            let p = memo.get(k);
            if (p === undefined) { if (memo.size >= cap) { out.capped = true; continue; } p = visit(d + 1, k); }
            if (p < INF && p + 1 < v) v = p + 1;
          }
        }
        memo.set(key, v); return v;
      };
      const k0 = keyOf(br[0]); memo.set(k0, INF);
      const v0 = visit(0, k0);
      out.states = memo.size;
      // Every winnable state: count its legal breaks and the ones that lose.
      const cur = new Uint8Array(B.nsec), D = E.scratch(B);
      const tally = (b) => {   // derive b into D first; returns [legal, losing]
        let m = 0, lose = 0;
        for (let s = 0; s < B.nsec; s++) {
          if (!legalOk(D, b, s)) continue;
          b[s] = 1; const p = memo.get(keyOf(b)); b[s] = 0;
          m++; if (p === INF) lose++;
        }
        return [m, lose];
      };
      for (const [k, v] of memo) {
        if (v === 0 || v >= INF) continue;
        unkey(k, cur); E.derive(B, cur, D);
        const [m, lose] = tally(cur);
        out.winnable++; out.moves += m; out.traps += lose;
      }
      out.trapRate = out.moves ? out.traps / out.moves : 0;
      // Walk the line (given, or the first optimal one) and count the steps where a wrong break loses.
      if (v0 < INF) {
        cur.fill(0);
        const given = opts && Array.isArray(opts.line) ? opts.line : null;
        let shareSum = 0, steps = 0;
        for (let want = v0; want > 0 && steps < depth; steps++, want--) {
          E.derive(B, cur, D);
          if (D.won) break;
          const [m, lose] = tally(cur);
          if (lose > 0) out.decisions++;
          if (m > 1) out.choices++;
          shareSum += m ? lose / m : 0;
          let pick = given ? (steps < given.length ? given[steps] : -1) : -1;
          for (let s = 0; s < B.nsec && pick < 0; s++) {
            if (!legalOk(D, cur, s)) continue;
            cur[s] = 1; const p = memo.get(keyOf(cur)); cur[s] = 0;
            if (p === want - 1) pick = s;
          }
          if (pick < 0) break;
          cur[pick] = 1;
        }
        out.lineTrap = steps ? shareSum / steps : 0;
      }
    } catch (e) { out.error = String(e && e.message || e); }
    return out;
  }

  return { solve, quickest, greedy, playouts, bound, traps, mulberry32, keyOf, INF };
});
