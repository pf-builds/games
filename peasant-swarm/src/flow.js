// Peasant Swarm — flow fields (SPEC-v2 §3). Click it! Studios, 2026.
// One integration field per team by fast marching (4-neighbour eikonal stencil, binary heap on typed arrays) over the terrain cost grid,
// with an early stop once every cell the team occupies is settled plus a margin. Directions are computed lazily per cell (version stamps)
// with a wall bias, and agents take a bilinear blend of the 4 surrounding vectors. Scheduling counts ticks: at most one team rebuild per
// tick, player first and capped at flow.playerHz; route hysteresis keeps the player's old field unless the new route is flow.hysteresis
// shorter at the anchor. The player's field runs on PS.knowledge (unknown cells cost as grass; M3 drives it from fog); AI fields use true
// terrain. AI "from me" fields (capped) and threat fields give aiThink path distances (Brogue's Dijkstra-map flee); escape fields route a
// routed swarm's remnant to its flee target (M3, M2 critic MAJOR-2).
// Deterministic: no Math.random, and the wall clock only feeds the cost counters, never a decision. Every loop is bounded.
(function () {
  const G = typeof window !== "undefined" ? window : globalThis;
  const PS = (G.PS = G.PS || {});
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const INF = 1e30;
  let N = 0, NN = 0, CELL = 32, BASE = 10, WALL1 = 6, PX = 3.2, K = null; // PX: world px per cost unit on open ground
  let HK = null, HV = null, hn = 0, hcap = 0;   // binary heap with lazy deletion: keys, cells
  let NEED = null, needV = 0, needN = 0;        // early-stop set: cells stamped needV
  let MARK = null, markV = 0;                   // dilated route marks for the same-way test, exact marks for the re-plan test
  let TR = null, TR2 = null;                    // route trace buffers
  let CC = null;                                // corridor cost view (the second march of a team field)
  let W = null;                                 // the installed flow world (one per sim world: live, sandbox)
  const walkT = (v) => v === 0 || v === 3 || v === 4;

  function init(cfg) {
    K = cfg.flow; CELL = cfg.terrain.cell; BASE = cfg.terrain.costs.base; WALL1 = cfg.terrain.costs.wall1; PX = CELL / BASE;
    const n = Math.round(cfg.world.w / CELL);
    if (n !== N) {
      N = n; NN = N * N; hcap = NN * 4 + 64;
      HK = new Float64Array(hcap); HV = new Int32Array(hcap); NEED = new Uint32Array(NN); MARK = new Uint32Array(NN); TR = new Int32Array(NN); TR2 = new Int32Array(NN); CC = new Float32Array(NN);
    }
    return F;
  }

  // ---------------------------------------------------------------- heap
  function hpush(k, v) { if (hn >= hcap) return; let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (HK[p] <= k) break; HK[i] = HK[p]; HV[i] = HV[p]; i = p; } HK[i] = k; HV[i] = v; }
  function hpop() {
    const r = HV[0], k = HK[--hn], v = HV[hn]; let i = 0;
    for (;;) { let l = 2 * i + 1; if (l >= hn) break; const q = l + 1; if (q < hn && HK[q] < HK[l]) l = q; if (HK[l] >= k) break; HK[i] = HK[l]; HV[i] = HV[l]; i = l; }
    HK[i] = k; HV[i] = v; return r;
  }

  // ---------------------------------------------------------------- fields
  // T: integration value (cost units); ts: T valid this version (tentative or final); fin: settled; dx/dy + ds: lazy unit directions
  function mkField(team, know) {
    return { team, know, T: new Float32Array(NN), ts: new Uint32Array(NN), fin: new Uint32Array(NN), dx: new Float32Array(NN), dy: new Float32Array(NN), ds: new Uint32Array(NN),
      ver: 0, ok: false, src: -1, cost: null, kn: null, baseCost: null, baseKn: null, corridor: 0, settled: 0, frontT: 0, tick: -1e9, miss: 0, builds: 0, tx: 0, ty: 0 };
  }
  const getField = (list, id, know) => list[id] || (list[id] = mkField(id, know));
  function needBegin() { needV++; needN = 0; }
  function needAdd(c) { if (NEED[c] !== needV) { NEED[c] = needV; needN++; } }
  const passView = (c, cost, kn) => (kn && !kn[c]) || cost[c] < 255; // the player's view: unknown cells are open ground

  // fast marching from src over the field's cost view (kn: knowledge mask, unknown costs as base, or blocks when shut). Stops past capT, or
  // once every needed cell is settled plus marginT (useNeed). Classic FMM: the update reads settled neighbours only.
  function march(f, src, cost, kn, capT, useNeed, marginT, shut) {
    const UNK = shut ? 255 : BASE;
    const t0 = now(), v = ++f.ver, T = f.T, ts = f.ts, fin = f.fin, N1 = N - 1, NL = NN - N;
    f.cost = cost; f.kn = kn; f.src = src; hn = 0; T[src] = 0; ts[src] = v; hpush(0, src);
    let left = useNeed ? needN : 0, stop = capT, settled = 0, lastK = 0;
    while (hn > 0) {
      const k = HK[0], c = hpop();
      if (fin[c] === v) continue;
      if (k > stop) break;
      fin[c] = v; settled++; lastK = k;
      if (left > 0 && NEED[c] === needV && --left === 0 && k + marginT < stop) stop = k + marginT;
      const x = c % N;
      for (let q = 0; q < 4; q++) {
        const n = q === 0 ? (x > 0 ? c - 1 : -1) : q === 1 ? (x < N1 ? c + 1 : -1) : q === 2 ? (c >= N ? c - N : -1) : (c < NL ? c + N : -1);
        if (n < 0 || fin[n] === v) continue;
        const cn = kn && !kn[n] ? UNK : cost[n]; if (cn >= 255) continue;
        const nx = n % N;
        const a0 = nx > 0 && fin[n - 1] === v ? T[n - 1] : INF, a1 = nx < N1 && fin[n + 1] === v ? T[n + 1] : INF, a = a0 < a1 ? a0 : a1;
        const b0 = n >= N && fin[n - N] === v ? T[n - N] : INF, b1 = n < NL && fin[n + N] === v ? T[n + N] : INF, b = b0 < b1 ? b0 : b1, d = a - b;
        const t = d >= cn || d <= -cn ? (a < b ? a : b) + cn : (a + b + Math.sqrt(2 * cn * cn - d * d)) * 0.5;
        if (ts[n] !== v || t < T[n]) { T[n] = t; ts[n] = v; hpush(t, n); }
      }
    }
    f.settled = settled; f.frontT = lastK; f.ok = true; f.builds++;
    if (W) { const ms = now() - t0; W.rebuilds++; W.lastCostMs = ms; W.costMs += ms; if (ms > W.maxCostMs) W.maxCostMs = ms; }
    return f;
  }
  // unit descent direction at a cell from its 4 neighbours; a blocked or unreached neighbour reads as T + wallBias so vectors lean off walls
  function dirAt(f, c) {
    const v = f.ver; f.ds[c] = v;
    if (f.ts[c] !== v) { f.dx[c] = 0; f.dy[c] = 0; return; }
    const T = f.T, ts = f.ts, t = T[c], B = t + K.wallBias, x = c % N;
    const l = x > 0 && ts[c - 1] === v ? T[c - 1] : B, r = x < N - 1 && ts[c + 1] === v ? T[c + 1] : B;
    const u = c >= N && ts[c - N] === v ? T[c - N] : B, d = c < NN - N && ts[c + N] === v ? T[c + N] : B;
    const gx = l - r, gy = u - d, L = Math.sqrt(gx * gx + gy * gy);
    if (L > 1e-9) { f.dx[c] = gx / L; f.dy[c] = gy / L; } else { f.dx[c] = 0; f.dy[c] = 0; }
  }
  // bilinear blend of the 4 surrounding cells' vectors (cells without a value drop out and the weights renormalise).
  // out: { x, y } unit direction (0,0 at the source), t path distance in px, ok. A miss (no value near) counts on the field.
  function sampleField(f, x, y, out) {
    out.ok = false; if (!f || !f.ok) return false;
    let fx = x / CELL - 0.5, fy = y / CELL - 0.5;
    if (!(fx >= 0)) fx = 0; else if (fx > N - 1.001) fx = N - 1.001; if (!(fy >= 0)) fy = 0; else if (fy > N - 1.001) fy = N - 1.001;
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, c = j * N + i, v = f.ver, ts = f.ts, ds = f.ds, DX = f.dx, DY = f.dy, T = f.T;
    let sx = 0, sy = 0, st = 0, sw = 0;
    for (let q = 0; q < 4; q++) {
      const cc = c + (q & 1) + (q & 2 ? N : 0), w = (q & 1 ? tx : 1 - tx) * (q & 2 ? ty : 1 - ty);
      if (w <= 0 || ts[cc] !== v) continue; if (ds[cc] !== v) dirAt(f, cc);
      sx += w * DX[cc]; sy += w * DY[cc]; st += w * T[cc]; sw += w;
    }
    if (sw < 1e-6) { f.miss++; return false; }
    const l = Math.sqrt(sx * sx + sy * sy); out.x = l > 1e-9 ? sx / l : 0; out.y = l > 1e-9 ? sy / l : 0; out.t = (st / sw) * PX; out.ok = true;
    return true;
  }
  const sample = (team, x, y, out) => sampleField(W && W.fields[team], x, y, out);
  // path distance in px from a field's source to (x, y) at cell level, -1 when the cell was never reached
  function pathPx(f, x, y) { const c = cellFor(x, y); return f && f.ok && c >= 0 && f.ts[c] === f.ver ? f.T[c] * PX : -1; }
  const pathCell = (f, c) => (f && f.ok && f.ts[c] === f.ver ? f.T[c] * PX : -1);

  // discrete route: steepest descent over 8 neighbours (no corner cutting) from c to the source; returns the cell count written to out
  function down(f, c) {
    const T = f.T, ts = f.ts, v = f.ver, x = c % N, y = (c / N) | 0; let best = -1, bt = T[c];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
      const q = Y * N + X; if (ts[q] !== v) continue;
      if (dx && dy && (ts[y * N + X] !== v || ts[Y * N + x] !== v)) continue;
      if (T[q] < bt) { bt = T[q]; best = q; }
    }
    return best;
  }
  function trace(f, c, out, max) {
    if (!f || !f.ok || c < 0 || f.ts[c] !== f.ver) return 0;
    let n = 0; out[n++] = c; max = Math.min(max || NN, out.length);
    for (let k = 0; k < NN && n < max && c !== f.src; k++) { const b = down(f, c); if (b < 0) break; c = b; out[n++] = c; }
    return n;
  }

  // ---------------------------------------------------------------- world state (one per sim world; the game swaps it with S)
  function world() {
    return { fields: [], fromMe: [], escape: [], spare: null, threat: null, rejoin: null, know: new Uint8Array(NN), map: null, rebuilds: 0, costMs: 0, lastCostMs: 0, maxCostMs: 0,
      rr: 0, playerTick: -1e9, replan: false, pend: new Int32Array(256), pendN: 0, decisions: { kept: 0, switched: 0, same: 0, fresh: 0 }, perTeam: new Int32Array(9) };
  }
  function reset(w, map) {
    w.map = map; w.know.fill(1); w.rebuilds = 0; w.costMs = 0; w.lastCostMs = 0; w.maxCostMs = 0; w.rr = 0; w.playerTick = -1e9; w.replan = false; w.pendN = 0;
    w.decisions.kept = w.decisions.switched = w.decisions.same = w.decisions.fresh = 0; w.perTeam.fill(0);
    for (const f of w.fields.concat(w.fromMe, w.escape, [w.spare, w.threat, w.rejoin])) if (f) { f.ok = false; f.src = -1; f.miss = 0; f.tick = -1e9; f.builds = 0; }
    return w;
  }
  function use(w) { W = w; return w; }
  function cellFor(x, y) {
    const m = W.map; let i = (x / CELL) | 0, j = (y / CELL) | 0; if (!(i >= 0)) i = 0; else if (i > N - 1) i = N - 1; if (!(j >= 0)) j = 0; else if (j > N - 1) j = N - 1;
    const c = j * N + i; return m.cost[c] < 255 ? c : m.snap[c];
  }
  const teamField = (id) => getField(W.fields, id, id === 1);

  // ---------------------------------------------------------------- scheduling: at most one team rebuild per tick, player first
  // teams[i]: { id, alive, route (wants a field), tx, ty (target), ax, ay (anchor), hyst (route hysteresis applies to this target) }
  function tick(teams, agents, simTick) {
    const w = W; if (!w || !w.map) return 0;
    if (w.pendN) checkReplan(teams[1], agents);
    const minP = Math.max(1, Math.round(60 / K.playerHz)), p = teams[1];
    if (p && p.alive && (p.route || p.wantField)) { // drag, keys and hold too while it has stragglers or pushes into rock (P1)
      const f = teamField(1), goal = cellFor(p.tx, p.ty), moved = !f.ok || goal !== f.src;
      const due = moved || w.replan || (f.miss > 0 && simTick - f.tick >= K.missTicks);
      if (due && simTick - w.playerTick >= minP) { buildTeam(p, agents, goal, simTick, moved && f.ok && p.hyst && !w.replan); w.playerTick = simTick; w.replan = false; return 1; }
    }
    if (p && p.alive && p.stragN > 0) { // the rejoin field (P1): its stragglers' way back to the group over known ground only
      const f = w.rejoin, goal = cellFor(p.ax, p.ay), age = f && f.ok ? simTick - f.tick : 1e9;
      if (age >= K.rejoinTicks && (!f || !f.ok || goal !== f.src || age >= 4 * K.rejoinTicks)) { if (buildRejoin(p, agents, goal, simTick)) return 1; }
    }
    const n = teams.length;
    for (let k = 0; k < n; k++) {
      const i = 2 + ((w.rr + k) % Math.max(1, n - 2)); const t = teams[i]; if (!t || !t.alive || !t.route) continue;
      const f = teamField(i), goal = cellFor(t.tx, t.ty);
      if (f.ok && goal === f.src && !(f.miss > 0 && simTick - f.tick >= K.missTicks)) continue;
      buildTeam(t, agents, goal, simTick, false); w.rr = (i - 2 + 1) % Math.max(1, n - 2); return 1;
    }
    return 0;
  }
  function buildTeam(t, agents, goal, simTick, hyst) {
    const w = W, kn = t.id === 1 ? w.know : null, cost = w.map.cost, margin = K.earlyStopCells * (BASE + WALL1), a = cellFor(t.ax, t.ay);
    needBegin();
    for (let i = 0; i < agents.length; i++) { const q = agents[i]; if (q.team !== t.id || q.dead) continue; const c = cellFor(q.x, q.y); if (passView(c, cost, kn)) needAdd(c); }
    const f = teamField(t.id); w.perTeam[t.id]++;
    if (!hyst) { teamMarch(f, goal, cost, kn, margin, a, t.count); f.tick = simTick; f.miss = 0; f.tx = t.tx; f.ty = t.ty; w.decisions.fresh++; return f; }
    const nf = w.spare || (w.spare = mkField(t.id, true));
    teamMarch(nf, goal, cost, kn, margin, a, t.count);
    const keep = keepOld(f, nf, a);
    if (keep) { f.tick = simTick; w.decisions.kept++; return f; }
    w.fields[t.id] = nf; w.spare = f; nf.tick = simTick; nf.miss = 0; nf.tx = t.tx; nf.ty = t.ty; return nf;
  }
  // a team field in two marches: the plain one, then (flow.corridorDiscount > 0) one where every cell within a blob radius of the route
  // traced from the team's anchor costs corridorDiscount less, so a swarm straddling an equal-cost watershed (a ridge dead ahead, two home
  // exits) takes its anchor's route as one body instead of splitting round both sides. Inside the corridor the gradient is unchanged.
  function teamMarch(f, goal, cost, kn, margin, a, count) {
    march(f, goal, cost, kn, INF, true, margin); f.baseCost = cost; f.baseKn = kn; f.corridor = 0;
    const disc = K.corridorDiscount; if (!(disc > 0) || a < 0) return f;
    const len = trace(f, a, TR, NN); if (len < K.corridorMinCells) return f;
    const D = Math.max(K.corridorCells, Math.ceil((K.corridorBlobK * 7 * Math.sqrt(Math.max(1, count))) / CELL)), k = 1 - disc;
    for (let c = 0; c < NN; c++) CC[c] = kn && !kn[c] ? BASE : cost[c];
    markV++; let n = 0;
    for (let q = 0; q < len; q++) {
      const c = TR[q], x = c % N, y = (c / N) | 0;
      for (let j = Math.max(0, y - D); j <= Math.min(N - 1, y + D); j++) for (let i = Math.max(0, x - D); i <= Math.min(N - 1, x + D); i++) { const m = j * N + i; if (MARK[m] !== markV) { MARK[m] = markV; if (CC[m] < 255) { CC[m] *= k; n++; } } }
    }
    march(f, goal, CC, null, INF, true, margin); f.baseCost = cost; f.baseKn = kn; f.corridor = n;
    return f;
  }
  // route hysteresis: the new field wins when its route runs the same way as the old one (its first flow.sameShare stays within
  // flow.sameCells of the old route), or when it is flow.hysteresis shorter than following the old route and walking on from its goal
  function keepOld(old, nw, a) {
    const w = W;
    if (!old.ok || a < 0 || old.ts[a] !== old.ver || nw.ts[a] !== nw.ver) { w.decisions.switched++; return false; }
    const la = trace(old, a, TR, NN), lb = trace(nw, a, TR2, NN), L = Math.floor(Math.min(la, lb) * K.sameShare), D = K.sameCells;
    if (L > D) {
      markV++;
      for (let k = 0; k < la; k++) { const c = TR[k], x = c % N, y = (c / N) | 0; for (let j = Math.max(0, y - D); j <= Math.min(N - 1, y + D); j++) for (let i = Math.max(0, x - D); i <= Math.min(N - 1, x + D); i++) MARK[j * N + i] = markV; }
      let same = true; for (let k = 0; k < L; k++) if (MARK[TR2[k]] !== markV) { same = false; break; }
      if (!same) {
        const via = nw.ts[old.src] === nw.ver ? old.T[a] + nw.T[old.src] : INF;
        if (!(nw.T[a] <= (1 - K.hysteresis) * via)) return true;
        w.decisions.switched++; return false;
      }
    }
    w.decisions.same++; return false;
  }

  // the rejoin field (P1): from the player's anchor over KNOWN ground only (unexplored cells block), early-stopped once every straggler's cell
  // is settled. The team field is optimistic about the dark (unknown costs as grass, so a tap can route through it); a straggler following it
  // walked along a ridge toward unexplored rock and back. Straggling agents steer by this one when it reaches them, else by the team field.
  function buildRejoin(t, agents, goal, simTick) {
    const w = W, kn = w.know, cost = w.map.cost; needBegin();
    for (let i = 0; i < agents.length; i++) { const q = agents[i]; if (q.team !== t.id || q.dead || !q.strag) continue; const c = cellFor(q.x, q.y); if (kn[c] && cost[c] < 255) needAdd(c); }
    const f = w.rejoin || (w.rejoin = mkField(t.id, true)); f.tick = simTick; if (!needN) return null; // no straggler stands on known ground: nothing to march for
    march(f, goal, cost, kn, INF, true, K.earlyStopCells * (BASE + WALL1), true); f.miss = 0; w.perTeam[t.id]++; return f;
  }
  const sampleRejoin = (x, y, out) => sampleField(W && W.rejoin, x, y, out);

  // ---------------------------------------------------------------- knowledge (M3 drives it from fog; in M2 every cell is known)
  // learn(c): the player now knows cell c; a known-blocked cell on the route of the player's anchor or of any of its agents triggers a re-plan
  // on the next tick (P1: a straggler left beyond a ridge was routed through unexplored rock; revealing it re-planned only when it lay on
  // the anchor's route, so the straggler leaned on the rock for good)
  function learn(c) { const w = W; if (!w || c < 0 || c >= NN) return; w.know[c] = 1; if (walkT(w.map.terr[c])) return; if (w.pendN < w.pend.length) w.pend[w.pendN++] = c; else w.replan = true; } // too many at once: re-plan
  function checkReplan(p, agents) {
    const w = W, f = w.fields[1]; const n0 = w.pendN; w.pendN = 0; if (!p || !f || !f.ok) return;
    // the union of every route: the anchor's, then each agent's descent until it joins a cell already marked (each cell is walked once)
    markV++; const v = f.ver, n = agents ? agents.length : 0;
    for (let i = -1; i < n; i++) {
      let c; if (i < 0) c = cellFor(p.ax, p.ay); else { const q = agents[i]; if (q.team !== 1 || q.dead) continue; c = cellFor(q.x, q.y); }
      for (let k = 0; k < NN && c >= 0 && MARK[c] !== markV && f.ts[c] === v; k++) { MARK[c] = markV; if (c === f.src) break; c = down(f, c); }
    }
    for (let k = 0; k < n0; k++) if (MARK[w.pend[k]] === markV) { w.replan = true; break; }
  }

  // ---------------------------------------------------------------- AI distance fields
  // "from me": fast marching from a team's anchor out to capPx (path px); aiThink reads every distance from it
  function buildFromMe(id, x, y, capPx) { return march(getField(W.fromMe, id, false), cellFor(x, y), W.map.cost, null, capPx / PX, false, 0); }
  // threat field for the flee pick: from the threat's anchor, early stop once every needed candidate (needBegin/needAdd first) is settled
  function buildThreat(x, y, capPx) { const f = W.threat || (W.threat = mkField(0, false)); return march(f, cellFor(x, y), W.map.cost, null, capPx / PX, needN > 0, 0); }

  // escape field for a remnant (M2 critic MAJOR-2): marches from its flee target until every cell a remnant agent stands on (escapeT > 0) is
  // settled plus the early-stop margin; the player's remnant reads its knowledge grid (kn), AI remnants true terrain
  function buildEscape(id, goal, kn, agents) {
    const w = W; needBegin();
    for (let i = 0; i < agents.length; i++) { const q = agents[i]; if (q.team !== id || q.dead || !(q.escapeT > 0)) continue; const c = cellFor(q.x, q.y); if (passView(c, w.map.cost, kn)) needAdd(c); }
    const f = getField(w.escape, id, !!kn); march(f, goal, w.map.cost, kn, INF, needN > 0, K.earlyStopCells * (BASE + WALL1)); f.miss = 0; return f;
  }
  const sampleEscape = (team, x, y, out) => sampleField(W && W.escape[team], x, y, out);

  // ---------------------------------------------------------------- target snapping (ray casts on the field's view of the land)
  const passXY = (x, y, kn) => { if (!(x >= 0 && y >= 0 && x < N * CELL && y < N * CELL)) return false; const c = ((y / CELL) | 0) * N + ((x / CELL) | 0), m = W.map; return (kn && !kn[c]) || (walkT(m.terr[c]) && m.region[c] === 1); };
  const RP = { x: 0, y: 0 };
  // cursor over rock: from the far end back toward (x0, y0), the first open point (the edge of that rock facing the swarm)
  function rayBack(x0, y0, x1, y1, kn) {
    if (passXY(x1, y1, kn)) { RP.x = x1; RP.y = y1; return RP; }
    const dx = x0 - x1, dy = y0 - y1, l = Math.sqrt(dx * dx + dy * dy), n = Math.ceil(l / (CELL / 2));
    for (let i = 1; i <= n; i++) { const t = i / n, x = x1 + dx * t, y = y1 + dy * t; if (passXY(x, y, kn)) { RP.x = x; RP.y = y; return RP; } }
    const s = PS.terrain.snapXY(x1, y1); RP.x = s.x; RP.y = s.y; return RP;
  }
  // joystick and keys: out from (x0, y0) along a unit direction up to len px, the last open point before the first blocked cell
  function rayOut(x0, y0, ux, uy, len, kn) {
    RP.x = x0; RP.y = y0; if (!passXY(x0, y0, kn)) { const s = PS.terrain.snapXY(x0, y0); RP.x = s.x; RP.y = s.y; return RP; }
    const n = Math.ceil(len / (CELL / 2));
    for (let i = 1; i <= n; i++) { const d = Math.min(len, (i * CELL) / 2), x = x0 + ux * d, y = y0 + uy * d; if (!passXY(x, y, kn)) break; RP.x = x; RP.y = y; }
    return RP;
  }

  // ---------------------------------------------------------------- QA: walk the direction field from every walkable cell
  // Rebuilds the team's field in full (no early stop) to its current source, then walks a point from every walkable main-region cell
  // centre along the bilinear sample in flow.walkStep px steps with SDF push-out and an axis slide. A walk fails on a miss, a zero
  // vector away from the source, no progress for 60 steps, or a step budget of 2x the path. Catches zero-gradient cells.
  let GX = 0, GY = 0;
  function sdfGrad(x, y) {
    const s = W.map.sdf; let fx = x / CELL - 0.5, fy = y / CELL - 0.5;
    if (!(fx >= 0)) fx = 0; else if (fx > N - 1.001) fx = N - 1.001; if (!(fy >= 0)) fy = 0; else if (fy > N - 1.001) fy = N - 1.001;
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, c = j * N + i, a = s[c], b = s[c + 1], d = s[c + N], e = s[c + N + 1];
    const gx = (1 - ty) * (b - a) + ty * (e - d), gy = (1 - tx) * (d - a) + tx * (e - b), gl = Math.sqrt(gx * gx + gy * gy);
    if (gl > 1e-6) { GX = gx / gl; GY = gy / gl; } else { GX = 0; GY = 0; }
    return a + (b - a) * tx + (d - a) * ty + (a - b - d + e) * tx * ty;
  }
  const WS = { x: 0, y: 0, t: 0, ok: false };
  function walkFromEveryCell(team, opts) {
    opts = opts || {}; const t0 = now(), f = W && W.fields[team];
    if (!f || !f.ok) return { error: "team " + team + " has no field" };
    march(f, f.src, f.baseCost || W.map.cost, f.baseKn, INF, false, 0); // the plain field in full: every walkable cell must reach the source
    const m = W.map, terr = m.terr, r = opts.radius || 6, step = K.walkStep, goalPx = K.walkGoalPx, wallMs = opts.wallMs || 8000;
    const cellOf = (x, y) => ((y / CELL) | 0) * N + ((x / CELL) | 0);
    let cells = 0, ok = 0, steps = 0, maxSteps = 0, truncated = false; const why = { miss: 0, zero: 0, stuck: 0, blocked: 0, budget: 0 }, bad = [];
    for (let c = 0; c < NN; c++) {
      if (!walkT(terr[c]) || m.region[c] !== 1) continue;
      if ((cells & 255) === 255 && now() - t0 > wallMs) { truncated = true; break; }
      cells++;
      let x = ((c % N) + 0.5) * CELL, y = (((c / N) | 0) + 0.5) * CELL, fail = "budget", best = INF, since = 0, k = 0;
      const lim = Math.ceil((f.ts[c] === f.ver ? f.T[c] * PX : 4 * N * CELL) * 2 / step) + 80;
      for (; k < lim; k++) {
        if (!sampleField(f, x, y, WS)) { fail = "miss"; break; }
        if (WS.t <= goalPx) { fail = ""; break; }
        if (WS.x === 0 && WS.y === 0) { fail = "zero"; break; }
        if (WS.t < best - 0.5) { best = WS.t; since = 0; } else if (++since > 60) { fail = "stuck"; break; }
        let nx = x + WS.x * step, ny = y + WS.y * step;
        const s = sdfGrad(nx, ny); if (s < r && (GX || GY)) { nx += GX * (r - s); ny += GY * (r - s); }
        if (!walkT(terr[cellOf(nx, ny)])) { if (walkT(terr[cellOf(nx, y)])) ny = y; else if (walkT(terr[cellOf(x, ny)])) nx = x; else { fail = "blocked"; break; } }
        x = nx; y = ny;
      }
      steps += k; if (k > maxSteps) maxSteps = k;
      if (!fail) ok++; else { why[fail]++; if (bad.length < 8) bad.push({ c, x: c % N, y: (c / N) | 0, why: fail, at: [Math.round(x), Math.round(y)] }); }
    }
    return { team, src: f.src, cells, ok, fails: cells - ok, why, bad, meanSteps: +(steps / Math.max(1, cells)).toFixed(1), maxSteps, truncated, ms: Math.round(now() - t0) };
  }

  const F = (PS.flow = { init, world, reset, use, sample, sampleField, sampleRejoin, pathPx, pathCell, trace, tick, buildFromMe, buildThreat, buildEscape, sampleEscape, needBegin, needAdd, learn, rayBack, rayOut,
    cellFor, walkFromEveryCell, fieldFor: (team) => (W ? W.fields[team] || null : null), fromMeFor: (team) => (W ? W.fromMe[team] || null : null), INF });
  Object.defineProperty(F, "rebuilds", { get: () => (W ? W.rebuilds : 0) });
  Object.defineProperty(F, "lastCostMs", { get: () => (W ? W.lastCostMs : 0) });
  Object.defineProperty(F, "stats", { get: () => (W ? { rebuilds: W.rebuilds, costMs: +W.costMs.toFixed(2), maxCostMs: +W.maxCostMs.toFixed(3), lastCostMs: +W.lastCostMs.toFixed(3), decisions: { ...W.decisions }, perTeam: Array.from(W.perTeam) } : null) });
  Object.defineProperty(PS, "knowledge", { get: () => (W ? W.know : null), configurable: true });
})();
