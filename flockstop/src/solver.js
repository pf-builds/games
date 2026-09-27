// Flockstop BFS solver. PURE, UMD like rules.js; uses rules.resolve so the solver and the game can never disagree.
// State = every sheep's cell, sorted within each colour (same-colour sheep are interchangeable). A penned sheep
// sits on its pen, so the filled-pen set is part of the positions. Splash and no-op swipes are pruned: a splash
// leaves the board as it was and costs a swipe, so it is never on a shortest path.
// solve() explores the WHOLE reachable graph (not just to the first win) so it can also count dead ends,
// then walks distances back from the one win state.
(function (root, factory) {
  const R = typeof module === "object" && module.exports ? require("./rules.js") : root.Flockstop.rules;
  const api = factory(R);
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.Flockstop = root.Flockstop || {}).solver = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (R) {
  "use strict";
  const DEFAULT_CAP = 250000;

  function keyOf(pos) { let s = ""; for (let i = 0; i < pos.length; i++) s += String.fromCharCode(pos[i]); return s; }

  // Sort positions inside each colour group (groups are fixed slot ranges, see makeGroups). Insertion sort: m ≤ ~12.
  function canon(pos, groups) {
    for (let g = 0; g < groups.length; g += 2) {
      const a = groups[g], b = groups[g + 1];
      for (let i = a + 1; i < b; i++) { const v = pos[i]; let j = i - 1; while (j >= a && pos[j] > v) { pos[j + 1] = pos[j]; j--; } pos[j + 1] = v; }
    }
  }

  // Reorder the board's sheep so each colour occupies one contiguous slot range; returns [start,end,...].
  function makeGroups(B) {
    const idx = Array.from(B.col.keys()).sort((a, b) => B.col[a] - B.col[b] || a - b);
    const S = Object.assign({}, B, { col: Int8Array.from(idx, (i) => B.col[i]), sheep0: idx.map((i) => B.sheep0[i]), occ: new Int16Array(B.n).fill(-1) });
    const groups = [];
    for (let i = 0; i < idx.length; i++) if (i === 0 || S.col[i] !== S.col[i - 1]) groups.push(i, i + 1); else groups[groups.length - 1] = i + 1;
    return { S, groups };
  }

  function grow(a, size) { const b = new a.constructor(size); b.set(a); return b; }

  // Returns {solved, capped, par, solution:"NESW..", states, dead, deadEdges, startTraps, trapsOnPath,
  //          penOnFirst, needsStopper, stopperMoves, forcedSteps, optChoices, ms}.
  // opts.cap: state limit (default 250k). A capped or unsolvable board returns solved:false and no par.
  function solve(board, opts) {
    const t0 = Date.now(), cap = (opts && opts.cap) || DEFAULT_CAP;
    const B0 = board.type ? board : R.parseBoard(board);
    const { S, groups } = makeGroups(B0), m = S.col.length, type = S.type;
    const pos = new Int16Array(m), cur = new Int16Array(m);
    for (let i = 0; i < m; i++) pos[i] = S.sheep0[i].y * S.w + S.sheep0[i].x;
    canon(pos, groups);
    const keys = [keyOf(pos)], index = new Map([[keys[0], 0]]);
    let edges = new Int32Array(4096 * 4).fill(-1), ebits = new Uint8Array(4096 * 4);
    let win = -1, capped = false;
    for (let head = 0; head < keys.length; head++) {
      if (keys.length >= cap) { capped = true; break; }
      if (head * 4 + 4 > edges.length) { const n = edges.length * 2; edges = grow(edges, n); edges.fill(-1, n / 2); ebits = grow(ebits, n); }
      const k = keys[head];
      for (let i = 0; i < m; i++) cur[i] = k.charCodeAt(i);
      for (let d = 0; d < 4; d++) {
        pos.set(cur);
        const bits = R.resolve(S, pos, d);
        if (!(bits & R.MOVED) || (bits & R.SPLASH)) continue;
        canon(pos, groups);
        const nk = keyOf(pos);
        let j = index.get(nk);
        if (j === undefined) {
          j = keys.length; keys.push(nk); index.set(nk, j);
          if (win < 0 && (bits & R.PENNED)) { let all = true; for (let i = 0; i < m; i++) if (type[pos[i]] !== R.PEN) { all = false; break; } if (all) win = j; }
        }
        edges[head * 4 + d] = j; ebits[head * 4 + d] = bits;
      }
    }
    const V = keys.length;
    const base = { states: V, capped, ms: 0 };
    if (capped || win < 0) { base.solved = false; base.ms = Date.now() - t0; return base; }

    // Reverse BFS from the win: dist[v] = swipes still needed, -1 = dead end (the win is unreachable from v).
    const indeg = new Int32Array(V + 1);
    for (let e = 0; e < V * 4; e++) if (edges[e] >= 0) indeg[edges[e] + 1]++;
    for (let v = 0; v < V; v++) indeg[v + 1] += indeg[v];
    const fill = indeg.slice(0, V), radj = new Int32Array(indeg[V]);
    for (let e = 0; e < V * 4; e++) if (edges[e] >= 0) radj[fill[edges[e]]++] = (e / 4) | 0;
    const dist = new Int32Array(V).fill(-1), queue = new Int32Array(V);
    let qh = 0, qt = 0;
    dist[win] = 0; queue[qt++] = win;
    while (qh < qt) { const v = queue[qh++]; for (let r = indeg[v]; r < indeg[v + 1]; r++) { const u = radj[r]; if (dist[u] < 0) { dist[u] = dist[v] + 1; queue[qt++] = u; } } }

    let dead = 0, deadEdges = 0;
    for (let v = 0; v < V; v++) {
      if (dist[v] < 0) { dead++; continue; }
      for (let d = 0; d < 4; d++) { const j = edges[v * 4 + d]; if (j >= 0 && dist[j] < 0) deadEdges++; }
    }
    const par = dist[0];
    // One optimal line (first optimal direction in N,E,S,W order), plus how forcing and how trappy it is.
    let v = 0, sol = "", trapsOnPath = 0, forcedSteps = 0, optSum = 0, stopperMoves = 0, penOnFirst = false, startTraps = 0;
    for (let d = 0; d < 4; d++) { const j = edges[d]; if (j >= 0 && (ebits[d] & R.PENNED)) penOnFirst = true; if (j >= 0 && dist[j] < 0) startTraps++; }
    for (let step = 0; step < par; step++) {
      let pick = -1, opt = 0;
      for (let d = 0; d < 4; d++) {
        const j = edges[v * 4 + d];
        if (j < 0) continue;
        if (dist[j] < 0) trapsOnPath++;
        else if (dist[j] === dist[v] - 1) { opt++; if (pick < 0) pick = d; }
      }
      optSum += opt; if (opt === 1) forcedSteps++;
      if (ebits[v * 4 + pick] & R.STOPPER) stopperMoves++;
      sol += R.DIRS[pick]; v = edges[v * 4 + pick];
    }
    // Needs a stopper: no shortest line avoids a swipe where a sliding sheep is stopped by another loose sheep.
    const seen = new Uint8Array(V);
    let reach = false; qh = 0; qt = 0; queue[qt++] = 0; seen[0] = 1;
    while (qh < qt && !reach) {
      const u = queue[qh++];
      for (let d = 0; d < 4; d++) {
        const j = edges[u * 4 + d];
        if (j < 0 || seen[j] || dist[j] !== dist[u] - 1 || (ebits[u * 4 + d] & R.STOPPER)) continue;
        if (j === win) { reach = true; break; }
        seen[j] = 1; queue[qt++] = j;
      }
    }
    return Object.assign(base, { solved: true, par, solution: sol, dead, deadEdges, startTraps, trapsOnPath,
      penOnFirst, needsStopper: par > 0 && !reach, stopperMoves, forcedSteps, optChoices: par ? optSum / par : 0, ms: Date.now() - t0 });
  }

  return { solve, DEFAULT_CAP };
});
