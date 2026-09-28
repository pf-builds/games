// Sapper's Path rules engine v2 (SPEC-v2 §2; SPEC.md §1 wherever v2 is silent). PURE: no DOM, no clock, no randomness.
// UMD, so the Node tools and the browser load this exact file: require('./engine.js') in Node, window.SappersPath.engine
// in the page.
//
// Level JSON: {id?, name?, w, h, grid:[h strings of w chars], muster:{stone, timber, hedge, ice}, chests:[{x, y, crew}],
//              rule?: "A" | "B", stacks?: [[crew, ...], ...] (each column front token first)}
// Grid legend:  .  ground   P  camp (a block of ground joined to the board edge; crews start here)   ~  moat   K  keep (one block)
//               S stone   T timber   H hedge   I ice   F iron door   L lever   C chest (ground holding a chest)
// x grows east, y grows south; a cell index is y * w + x. Crew/material index: 0 stone, 1 timber, 2 hedge, 3 ice, 4 iron.
//
// A move is a CALL. Name a material (stacks mode: a column, whose front token names it) and one crew walks from the camp
// over connected ground to that material's target and breaks it. Rule A ("closest", the default): the one reachable
// section with the smallest walk; ties go to the section nearer the keep (Chebyshev), then the lowest first tile.
// Rule B ("all reachable"): every reachable section of that material at once. Either way the call costs one crew.
//
// The whole game state is (broken sections, spent), spent = calls per material [0..3] then each column's head (stacks).
// Open ground, connected ground, walk distances, targets, claimed chests, thrown levers, open doors and remaining crews
// all derive from it (derive), so undo is "drop the last call and replay".
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).engine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const OPEN = 0, MOAT = 1, KEEP = 2, WALL = 3, LEVER = 4, CHEST = 5, CAMP = 6;
  const CREWS = ["stone", "timber", "hedge", "ice"];
  const MAT_CODES = "STHIF", IRON = 4, FAR = 32767;
  const CREW_OF = { stone: 0, timber: 1, hedge: 2, ice: 3 };
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

  // Compile a level once. opts.noLevers: levers throw nothing (report metric "do levers matter"). opts.rule and
  // opts.stacks override the level's own (opts.stacks null = no stacks). Throws on malformed data (the baker and the
  // page catch); everything after parse never throws.
  function parse(L, opts) {
    opts = opts || {};
    const w = L.w | 0, h = L.h | 0, n = w * h, grid = L.grid;
    if (!(w > 0 && h > 0) || n > 16000 || !Array.isArray(grid) || grid.length !== h) throw new Error("level: bad size or grid");
    const kind = new Uint8Array(n), mat = new Int8Array(n).fill(-1), nb = new Int16Array(n * 4), base = new Uint8Array(n);
    const camp = [], campEdge = [], keepCells = [];
    for (let y = 0; y < h; y++) {
      if (typeof grid[y] !== "string" || grid[y].length !== w) throw new Error("level: row " + y + " is not " + w + " wide");
      for (let x = 0; x < w; x++) {
        const c = y * w + x, ch = grid[y][x], m = MAT_CODES.indexOf(ch), edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        if (m >= 0) { kind[c] = WALL; mat[c] = m; }
        else if (ch === ".") { kind[c] = OPEN; base[c] = 1; }
        else if (ch === "P") { kind[c] = CAMP; base[c] = 1; camp.push(c); if (edge) campEdge.push(c); }
        else if (ch === "~") kind[c] = MOAT;
        else if (ch === "L") kind[c] = LEVER;
        else if (ch === "C") { kind[c] = CHEST; base[c] = 1; }
        else if (ch === "K") { kind[c] = KEEP; keepCells.push(c); }
        else throw new Error("level: bad cell '" + ch + "' at " + x + "," + y);
        for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; nb[c * 4 + d] = nx < 0 || ny < 0 || nx >= w || ny >= h ? -1 : ny * w + nx; }
      }
    }
    if (!camp.length) throw new Error("level: no camp");
    // The camp may be deeper than one row (a 2-deep patch), but every camp cell joins a camp cell on the board edge.
    const cseen = new Uint8Array(n), cq = campEdge.slice(); for (const c of cq) cseen[c] = 1;
    for (let i = 0; i < cq.length; i++) for (let d = 0; d < 4; d++) { const e = nb[cq[i] * 4 + d]; if (e >= 0 && kind[e] === CAMP && !cseen[e]) { cseen[e] = 1; cq.push(e); } }
    for (const c of camp) if (!cseen[c]) throw new Error("level: camp at " + (c % w) + "," + ((c / w) | 0) + " is not joined to the edge");
    if (!keepCells.length) throw new Error("level: no keep");
    // The keep is one block: every K cell 4-connected to the first.
    const kseen = new Uint8Array(n), kq = [keepCells[0]]; kseen[keepCells[0]] = 1;
    for (let i = 0; i < kq.length; i++) for (let d = 0; d < 4; d++) { const e = nb[kq[i] * 4 + d]; if (e >= 0 && kind[e] === KEEP && !kseen[e]) { kseen[e] = 1; kq.push(e); } }
    if (kq.length !== keepCells.length) throw new Error("level: the keep is not one block");

    // Sections: maximal 4-connected same-material wall groups, fixed for the level. A section's id order is its first
    // tile's scan order, so "lowest (y, x) of its first tile" is "lowest id".
    const sec = new Int16Array(n).fill(-1), secMat = [], secStart = [0], cells = [];
    for (let c0 = 0; c0 < n; c0++) {
      if (kind[c0] !== WALL || sec[c0] >= 0) continue;
      const id = secMat.length; secMat.push(mat[c0]); sec[c0] = id; cells.push(c0);
      for (let i = secStart[id]; i < cells.length; i++) {
        const c = cells[i];
        for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && kind[e] === WALL && mat[e] === mat[c0] && sec[e] < 0) { sec[e] = id; cells.push(e); } }
      }
      secStart.push(cells.length);
    }
    const nsec = secMat.length, secKeep = new Int16Array(nsec).fill(FAR), secFirst = new Int16Array(nsec);
    for (let s = 0; s < nsec; s++) {
      secFirst[s] = cells[secStart[s]];
      for (let i = secStart[s]; i < secStart[s + 1]; i++) for (const k of keepCells) {
        const c = cells[i], d = Math.max(Math.abs(c % w - k % w), Math.abs(((c / w) | 0) - ((k / w) | 0)));
        if (d < secKeep[s]) secKeep[s] = d;
      }
    }

    // Levers and the iron sections they open.
    const levers = [], leverDoorStart = [0], leverDoors = [];
    for (let c = 0; c < n; c++) {
      if (kind[c] !== LEVER) continue;
      levers.push(c);
      if (!opts.noLevers) for (let d = 0; d < 4; d++) {
        const e = nb[c * 4 + d];
        if (e >= 0 && kind[e] === WALL && mat[e] === IRON && leverDoors.indexOf(sec[e], leverDoorStart[leverDoorStart.length - 1]) < 0) leverDoors.push(sec[e]);
      }
      leverDoorStart.push(leverDoors.length);
    }

    // Chests: every C cell needs one chests[] entry naming its crew.
    const chestCell = [], chestCrew = [], list = Array.isArray(L.chests) ? L.chests : [];
    for (let c = 0; c < n; c++) {
      if (kind[c] !== CHEST) continue;
      const e = list.find((q) => q && q.x === c % w && q.y === ((c / w) | 0));
      if (!e || !(e.crew in CREW_OF)) throw new Error("level: chest at " + (c % w) + "," + ((c / w) | 0) + " has no crew");
      chestCell.push(c); chestCrew.push(CREW_OF[e.crew]);
    }
    const rule = opts.rule || L.rule || "A";
    if (rule !== "A" && rule !== "B") throw new Error("level: rule must be A or B");
    // Stacks: K columns of crew tokens, front first. The muster is then the columns' contents; each claimed chest adds a
    // one-token column of its own (column K + chest index).
    const st = opts.stacks !== undefined ? opts.stacks : L.stacks, muster = new Int16Array(4);
    let cols = null;
    if (Array.isArray(st) && st.length) {
      cols = st.map((col) => Int8Array.from((Array.isArray(col) ? col : []).map((k) => { if (!(k in CREW_OF)) throw new Error("level: bad stack token " + k); return CREW_OF[k]; })));
      for (const col of cols) for (const m of col) muster[m]++;
    } else { const M = L.muster || {}; for (let i = 0; i < 4; i++) muster[i] = Math.max(0, Math.min(99, M[CREWS[i]] | 0)); }
    const ncol = cols ? cols.length + chestCell.length : 0;
    let calls = chestCell.length; for (let i = 0; i < 4; i++) calls += muster[i];

    return {
      id: L.id, name: L.name, w, h, n, kind, mat, nb, base, keep: keepCells[0], keepCells: Int16Array.from(keepCells), camp: Int16Array.from(camp),
      sec, nsec, secMat: Int8Array.from(secMat), secStart: Int32Array.from(secStart), secCells: Int16Array.from(cells), secKeep, secFirst,
      levers: Int16Array.from(levers), leverDoorStart: Int32Array.from(leverDoorStart), leverDoors: Int16Array.from(leverDoors),
      chestCell: Int16Array.from(chestCell), chestCrew: Int8Array.from(chestCrew), muster, rule, cols, ncol,
      spentLen: 4 + ncol, maxCalls: Math.min(calls, 250), moves: cols ? ncol : 4,
    };
  }

  // Scratch for derive. The solver keeps one per search depth, so its hot path allocates nothing.
  function scratch(B) {
    return {
      open: new Uint8Array(B.n), conn: new Uint8Array(B.n), dist: new Int16Array(B.n), queue: new Int16Array(B.n),
      reach: new Uint8Array(B.nsec), sdist: new Int16Array(B.nsec), contact: new Int16Array(B.nsec), ground: new Int16Array(B.nsec),
      doorOpen: new Uint8Array(B.nsec), thrown: new Uint8Array(B.levers.length), claimed: new Uint8Array(B.chestCell.length),
      remaining: new Int16Array(4), target: new Int16Array(4), tie: new Uint8Array(4), front: new Int8Array(Math.max(1, B.ncol)),
      used: 0, calls: 0, legal: 0, legalMask: 0, won: false, stuck: false, cascade: 0,
    };
  }

  function touches(B, conn, c) { const nb = B.nb; for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && conn[e]) return true; } return false; }
  function front(B, spent, D, j) {
    const K = B.cols.length;
    if (j < K) { const col = B.cols[j], k = spent[4 + j]; return k < col.length ? col[k] : -1; }
    return D.claimed[j - K] && !spent[4 + j] ? B.chestCrew[j - K] : -1;
  }

  // SPEC-v2 §2 derived state for (broken, spent), written into D. Order-independent: every step only ever opens more
  // ground, so the fixed point is unique. The lever cascade is capped at W×H rounds.
  function derive(B, broken, spent, D) {
    const n = B.n, nb = B.nb, open = D.open, conn = D.conn, dist = D.dist, q = D.queue, cells = B.secCells;
    open.set(B.base); conn.fill(0);
    D.doorOpen.fill(0); D.thrown.fill(0); D.claimed.fill(0);
    let used = 0;
    for (let s = 0; s < B.nsec; s++) {
      if (!broken[s]) continue;
      used++;
      for (let i = B.secStart[s]; i < B.secStart[s + 1]; i++) open[cells[i]] = 1;
    }
    // 1. Connected ground: a flood from the camp (edges are not outside). 4. Exposed levers open their doors; repeat.
    let head = 0, tail = 0, rounds = 0;
    for (let i = 0; i < B.camp.length; i++) { const c = B.camp[i]; conn[c] = 1; dist[c] = 0; q[tail++] = c; }
    for (; rounds < n; rounds++) {
      while (head < tail) {
        const c = q[head++];
        for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && open[e] && !conn[e]) { conn[e] = 1; dist[e] = dist[c] + 1; q[tail++] = e; } }
      }
      let opened = false;
      for (let i = 0; i < B.levers.length; i++) {
        if (D.thrown[i] || !touches(B, conn, B.levers[i])) continue;
        D.thrown[i] = 1;
        for (let j = B.leverDoorStart[i]; j < B.leverDoorStart[i + 1]; j++) {
          const s = B.leverDoors[j];
          if (D.doorOpen[s]) continue;
          D.doorOpen[s] = 1; opened = true;
          for (let k = B.secStart[s]; k < B.secStart[s + 1]; k++) {
            const c = cells[k]; open[c] = 1;
            if (!conn[c] && touches(B, conn, c)) { conn[c] = 1; q[tail++] = c; }
          }
        }
      }
      if (!opened) break;
    }
    D.cascade = rounds;
    // A door opened mid-flood: walking distances again by a clean BFS over the final connected ground.
    if (rounds > 0) {
      for (let c = 0; c < n; c++) dist[c] = -1;
      head = 0; tail = 0;
      for (let i = 0; i < B.camp.length; i++) { const c = B.camp[i]; dist[c] = 0; q[tail++] = c; }
      while (head < tail) {
        const c = q[head++];
        for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && conn[e] && dist[e] < 0) { dist[e] = dist[c] + 1; q[tail++] = e; } }
      }
    }
    // 3. Chests on connected ground. 5. Win: a keep cell 4-adjacent to connected ground.
    for (let i = 0; i < B.chestCell.length; i++) if (conn[B.chestCell[i]]) D.claimed[i] = 1;
    let won = false;
    for (let i = 0; i < B.keepCells.length && !won; i++) if (touches(B, conn, B.keepCells[i])) won = true;
    D.won = won;
    const rem = D.remaining;
    let calls = 0; for (let m = 0; m < 4; m++) calls += spent[m];
    if (B.cols) {
      rem.fill(0);
      for (let j = 0; j < B.cols.length; j++) for (let k = spent[4 + j]; k < B.cols[j].length; k++) rem[B.cols[j][k]]++;
      for (let i = 0; i < B.chestCell.length; i++) if (D.claimed[i] && !spent[4 + B.cols.length + i]) rem[B.chestCrew[i]]++;
    } else {
      for (let m = 0; m < 4; m++) rem[m] = B.muster[m] - spent[m];
      for (let i = 0; i < B.chestCell.length; i++) if (D.claimed[i]) rem[B.chestCrew[i]]++;
    }
    // 2. Reachable sections and their walk: the nearest connected ground cell beside a tile (ties: lowest ground cell).
    const T = D.target, tie = D.tie;
    T.fill(-1); tie.fill(0);
    for (let s = 0; s < B.nsec; s++) {
      D.reach[s] = 0; D.sdist[s] = FAR; D.contact[s] = -1; D.ground[s] = -1;
      if (broken[s] || B.secMat[s] >= IRON || won) continue;
      let best = FAR, bg = -1, bt = -1;
      for (let i = B.secStart[s]; i < B.secStart[s + 1]; i++) {
        const t = cells[i];
        for (let d = 0; d < 4; d++) { const g = nb[t * 4 + d]; if (g >= 0 && conn[g] && (dist[g] < best || (dist[g] === best && g < bg))) { best = dist[g]; bg = g; bt = t; } }
      }
      if (bg < 0) continue;
      D.reach[s] = 1; D.sdist[s] = best; D.contact[s] = bt; D.ground[s] = bg;
      // Rule A target: smallest walk, then nearer the keep, then lowest first tile (= lowest id, and ids ascend here).
      const m = B.secMat[s], t = T[m];
      if (t < 0 || best < D.sdist[t]) { T[m] = s; tie[m] = 0; }
      else if (best === D.sdist[t]) {
        if (B.secKeep[s] < B.secKeep[t]) { T[m] = s; tie[m] = 1; }
        else if (B.secKeep[s] > B.secKeep[t]) { if (tie[m] < 1) tie[m] = 1; }
        else tie[m] = 2;
      }
    }
    // Legal calls: a material with a crew left and a target (stacks: a column whose front token has a target).
    let legal = 0, mask = 0;
    if (B.cols) {
      for (let j = 0; j < B.ncol; j++) {
        const f = front(B, spent, D, j); D.front[j] = f;
        if (!won && f >= 0 && T[f] >= 0) { legal++; mask |= 1 << j; }
      }
    } else for (let m = 0; m < 4; m++) if (!won && rem[m] > 0 && T[m] >= 0) { legal++; mask |= 1 << m; }
    D.used = used; D.calls = calls; D.legal = legal; D.legalMask = mask; D.stuck = !won && legal === 0;
    return D;
  }

  // Low-level move for the solver (allocation-free): D is derive()d for (broken, spent); writes the child into (nbr, nsp).
  // Returns the called material, or -1 if move a is not legal.
  function stepInto(B, broken, spent, D, a, nbr, nsp) {
    if (a < 0 || a >= B.moves || !((D.legalMask >> a) & 1)) return -1;
    const m = B.cols ? D.front[a] : a;
    nbr.set(broken); nsp.set(spent);
    if (B.rule === "B") { for (let s = 0; s < B.nsec; s++) if (D.reach[s] && B.secMat[s] === m) nbr[s] = 1; }
    else nbr[D.target[m]] = 1;
    nsp[m]++;
    if (B.cols) nsp[4 + a]++;
    return m;
  }

  // ---- Game-facing state: {moves, breaks, broken, spent, ...derived}. Treat as immutable; call/undo return new objects.
  // moves: the calls (material index, or column index in stacks mode). breaks[i]: the section ids call i broke.
  function fromMoves(B, moves) {
    let br = new Uint8Array(B.nsec), sp = new Int16Array(B.spentLen);
    const D = scratch(B), done = [], breaks = [];
    for (let i = 0; i < moves.length && i < B.maxCalls; i++) {
      derive(B, br, sp, D);
      const nbr = new Uint8Array(B.nsec), nsp = new Int16Array(B.spentLen);
      if (stepInto(B, br, sp, D, moves[i], nbr, nsp) < 0) break;
      const got = []; for (let s = 0; s < B.nsec; s++) if (nbr[s] && !br[s]) got.push(s);
      done.push(moves[i]); breaks.push(got); br = nbr; sp = nsp;
    }
    const st = derive(B, br, sp, D);
    delete st.queue;
    st.moves = done; st.breaks = breaks; st.broken = br; st.spent = sp;
    return st;
  }
  function start(B) { return fromMoves(B, []); }
  function restart(B) { return start(B); }
  // A call names a crew ("stone" or 0-3); in stacks mode it names a column (0..ncol-1). Returns the new state, or null.
  function moveOf(B, what) { return typeof what === "string" ? (B.cols ? -1 : what in CREW_OF ? CREW_OF[what] : -1) : what | 0; }
  function canCall(B, st, what) { const a = moveOf(B, what); return a >= 0 && a < B.moves && ((st.legalMask >> a) & 1) === 1; }
  function call(B, st, what) { return canCall(B, st, what) ? fromMoves(B, st.moves.concat([moveOf(B, what)])) : null; }
  // Undo replays the call list minus the last call, so it is exact by construction (crew, chests, levers, stacks).
  function undo(B, st) { return st.moves.length ? fromMoves(B, st.moves.slice(0, -1)) : st; }
  function legalMoves(B, st) { const out = []; for (let a = 0; a < B.moves; a++) if ((st.legalMask >> a) & 1) out.push(a); return out; }
  const xy = (B, c) => (c < 0 ? null : [c % B.w, (c / B.w) | 0]);
  // The target flags: one entry per legal call. section is Rule A's closest (the flag); all is what the call breaks.
  function targets(B, st) {
    return legalMoves(B, st).map((a) => {
      const m = B.cols ? st.front[a] : a, s = st.target[m], all = [];
      if (B.rule === "B") { for (let q = 0; q < B.nsec; q++) if (st.reach[q] && B.secMat[q] === m) all.push(q); } else all.push(s);
      return { move: a, crew: CREWS[m], mat: m, section: s, all, contact: xy(B, st.contact[s]), ground: xy(B, st.ground[s]), dist: st.sdist[s], tie: st.tie[m] };
    });
  }
  // The walk to a connected ground cell: camp first, by strictly falling distance (lowest cell on ties). [] if unreachable.
  function pathTo(B, st, x, y) {
    let c = x < 0 || y < 0 || x >= B.w || y >= B.h ? -1 : y * B.w + x;
    if (c < 0 || !st.conn[c]) return [];
    const out = [c];
    for (let k = 0; k < B.n && st.dist[c] > 0; k++) {
      let nx = -1;
      for (let d = 0; d < 4; d++) { const e = B.nb[c * 4 + d]; if (e >= 0 && st.conn[e] && st.dist[e] === st.dist[c] - 1 && (nx < 0 || e < nx)) nx = e; }
      if (nx < 0) break;
      c = nx; out.push(c);
    }
    return out.reverse().map((q) => xy(B, q));
  }
  function sectionAt(B, x, y) { return x < 0 || y < 0 || x >= B.w || y >= B.h ? -1 : B.sec[y * B.w + x]; }
  function sectionCells(B, s) { return Array.from(B.secCells.subarray(B.secStart[s], B.secStart[s + 1])); }
  function crewOf(B, s) { return B.secMat[s] < IRON ? CREWS[B.secMat[s]] : null; }
  function isCrewSection(B, s) { return s >= 0 && s < B.nsec && B.secMat[s] < IRON; }
  // Stable text form of every derived field, for undo-parity tests and the page's renderSignature.
  function serialize(st) {
    return [st.moves.join(","), st.breaks.map((b) => b.join("+")).join(","), st.broken.join(""), st.spent.join(","), st.open.join(""), st.conn.join(""),
      st.dist.join(","), st.reach.join(""), st.target.join(","), st.tie.join(""), st.doorOpen.join(""), st.thrown.join(""), st.claimed.join(""),
      st.remaining.join(","), st.front.join(","), st.used, st.calls, st.legal, st.legalMask, st.won, st.stuck].join("|");
  }
  // Crew totals the muster object form uses; handy for tools.
  function musterObj(arr) { const o = {}; for (let i = 0; i < 4; i++) o[CREWS[i]] = arr[i] | 0; return o; }

  return {
    OPEN, MOAT, KEEP, WALL, LEVER, CHEST, CAMP, IRON, FAR, CREWS, CREW_OF, MAT_CODES,
    parse, scratch, derive, stepInto, start, restart, call, canCall, undo, legalMoves, fromMoves, targets, pathTo,
    sectionAt, sectionCells, crewOf, isCrewSection, serialize, musterObj, touches,
  };
});
