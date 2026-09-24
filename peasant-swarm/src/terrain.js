// Peasant Swarm — seeded terrain (SPEC-v2 §2). Click it! Studios, 2026.
// Six-fold valley template + 3-octave value noise with ridged spines, quantile threshold, cellular automata, thin-wall clear,
// a river with bridges and fords, template passes and canyons, connectivity carve, chamfer SDF, cost, snap, spawn distances, fairness.
// Pure data, no DOM: flat typed arrays indexed c = y*N + x. Engine-safe for replays: integer hashes, Fisher-Yates, and no
// Math.sin/cos/pow anywhere (directions come from a literal 15-degree table). Every loop is bounded by the grid size or a counter.
(function () {
  const G = typeof window !== "undefined" ? window : globalThis;
  const PS = (G.PS = G.PS || {});
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  // cos(k * 15deg), k = 0..6, as literals; DIR[k] = [cos, sin] of k * 15deg built by quarter turns (pure arithmetic)
  const C15 = [1, 0.9659258262890683, 0.8660254037844386, 0.7071067811865476, 0.5, 0.25881904510252074, 0];
  const DIR = []; for (let k = 0; k < 24; k++) { const r = k % 6; let c = C15[r], s = C15[6 - r]; for (let q = 0; q < ((k / 6) | 0); q++) { const t = c; c = -s; s = t; } DIR.push([c, s]); }

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(ix, iy, salt) { let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(salt, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function vnoise(x, y, p, salt) {
    const fx = x / p, fy = y / p, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = hash(ix, iy, salt), b = hash(ix + 1, iy, salt), c = hash(ix, iy + 1, salt), d = hash(ix + 1, iy + 1, salt);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  function vnoise1(s, p, salt) { const f = s / p, i = Math.floor(f), t = f - i, u = t * t * (3 - 2 * t), a = hash(i, 7, salt), b = hash(i + 1, 7, salt); return a + (b - a) * u; }
  const noise3 = (x, y, P, salt) => (vnoise(x, y, P.noisePeriod, salt) + 0.5 * vnoise(x, y, P.noisePeriod / 2, salt + 1) + 0.25 * vnoise(x, y, P.noisePeriod / 4, salt + 2)) / 1.75;

  // ---------------------------------------------------------------- params + scratch (allocated once per grid size)
  let P = null, N = 0, NN = 0;
  let E, F, PROT, PASS, T2, LAB, Q, D1, D2, BH, BN, BC;
  const F_FREE = 0, F_ROCK = 1, F_CLEAR = 2, F_WATER = 3, F_FORD = 4, F_BRIDGE = 5;
  function init(cfg) {
    const t = cfg.terrain;
    P = Object.assign({}, t, { W: cfg.world.w, N: Math.round(cfg.world.w / t.cell) });
    if (P.N !== N) {
      N = P.N; NN = N * N;
      E = new Float32Array(NN); F = new Uint8Array(NN); PROT = new Uint8Array(NN); PASS = new Uint8Array(NN); T2 = new Uint8Array(NN);
      LAB = new Int32Array(NN); Q = new Int32Array(NN * 2); D1 = new Int32Array(NN); D2 = new Int32Array(NN);
      BH = new Int32Array(5); BN = new Int32Array(NN * 9); BC = new Int32Array(NN * 9); // Dial bucket queue pool: <= 8 relaxations per cell + seeds
    }
    T.N = N; T.cell = t.cell; T.W = P.W;
    return T;
  }

  const walkT = (v) => v === 0 || v === 3 || v === 4; // grass, ford, bridge

  // ---------------------------------------------------------------- one generation attempt
  function attempt(seed, forceFail) {
    const C = N / 2, rng = mulberry32(seed), cell = P.cell;
    const rot = (rng() * 24) | 0, rv = (rng() * 3) | 0, salt = (rng() * 1e9) | 0;
    const pick = (r) => r[0] + ((rng() * (r[1] - r[0] + 1)) | 0);
    const Rd = P.disc * N, Rr = P.spawnRing * N, Rc = P.centerRadius * N, Rh = P.homeRadius, Rw = Rh + P.homeWall, Hub = Rc + P.hubWall;
    const sp = [], sep = [];
    for (let i = 0; i < 6; i++) { const d = DIR[(rot + 4 * i) % 24]; sp.push({ x: C + Rr * d[0], y: C + Rr * d[1], exits: [] }); }
    // the river runs rim to rim along separators rv and rv+3 (a diameter between two neighbour pairs); the other four are ridges
    const rd = DIR[(rot + 4 * rv + 2) % 24], R = { dx: rd[0], dy: rd[1], nx: -rd[1], ny: rd[0], hw: (P.riverWidth[0] + rng() * (P.riverWidth[1] - P.riverWidth[0])) / 2 + 0.25, salt: salt + 91 };
    const wob = (s) => P.riverWobble * (2 * vnoise1(s, P.riverPeriod, R.salt) - 1);
    const nX = pick(P.crossings), xs = [];
    const mkX = (s, ford) => ({ s, ford, w: ford ? pick(P.fordWidth) : P.bridgeWidth });
    // two junction crossings where the river meets the inner band, the rest inside the central meadow (all gaps well under maxGap)
    const inner = nX - 2 >= 3 ? [0, -0.6 * Rc, 0.6 * Rc] : [-0.5 * Rc, 0.5 * Rc];
    for (const s of inner) xs.push(mkX(s, rng() < 0.5));
    const jA = mkX(0, rng() < 0.5), jB = mkX(0, rng() < 0.5);
    jA.s = Hub + 1 + jA.w / 2; jB.s = -(Hub + 1 + jB.w / 2); xs.push(jA, jB);
    let fords = 0; for (const x of xs) fords += x.ford ? 1 : 0;
    if (fords === 0 || fords === xs.length) { xs[0].ford = !xs[0].ford; xs[0].w = xs[0].ford ? pick(P.fordWidth) : P.bridgeWidth; }
    for (let k = 0; k < 6; k++) {
      const d = DIR[(rot + 4 * k + 2) % 24], river = k === rv || k === rv + 3;
      const s = { dx: d[0], dy: d[1], nx: -d[1], ny: d[0], river, pw: pick(P.passWidth), cw: pick(P.passWidth), salt: salt + 17 * (k + 1), rJ: 0 };
      s.rJ = river ? (k === rv ? jA.s : -jB.s) : Hub + s.pw / 2;
      s.jx = C + s.rJ * s.dx; s.jy = C + s.rJ * s.dy; sep.push(s);
    }
    // two exits per home, each facing the junction of one bounding separator; a clear corridor runs from the exit mouth to it
    const segs = [];
    for (let i = 0; i < 6; i++) {
      const h = sp[i];
      for (const k of [(i + 5) % 6, i]) {
        const s = sep[k]; let ex = s.jx - h.x, ey = s.jy - h.y; const l = Math.sqrt(ex * ex + ey * ey); ex /= l; ey /= l;
        h.exits.push({ x: ex, y: ey });
        segs.push({ ax: h.x + ex * (Rw + 0.5), ay: h.y + ey * (Rw + 0.5), bx: s.jx, by: s.jy });
      }
    }
    for (const g of segs) { g.vx = g.bx - g.ax; g.vy = g.by - g.ay; g.ll = g.vx * g.vx + g.vy * g.vy; }

    // ---- elevation + forced template
    const rd2 = Rd * Rd, rc2 = Rc * Rc, hub2 = Hub * Hub, rw2 = Rw * Rw, rh2 = Rh * Rh, exH = P.exitWidth / 2, rH = P.ridgeWidth / 2, cor2 = P.corridorHalf * P.corridorHalf;
    let nDisc = 0, nForcedBlocked = 0, nFree = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = j * N + i, u = i + 0.5, v = j + 0.5, dx = u - C, dy = v - C, d2 = dx * dx + dy * dy;
      PROT[c] = 0; PASS[c] = 0; E[c] = 0;
      if (d2 >= rd2) { F[c] = F_ROCK; continue; }
      nDisc++;
      // river band first: it cuts the hub wall and the central meadow; crossings and their landings are protected
      const rs = dx * R.dx + dy * R.dy, rq = dx * R.nx + dy * R.ny - wob(rs), arq = rq < 0 ? -rq : rq;
      if (arq < R.hw + 3) {
        let x = null; for (const xx of xs) { const ds = rs - xx.s; if (ds < xx.w / 2 + (arq < R.hw ? 0 : 1) && ds > -(xx.w / 2 + (arq < R.hw ? 0 : 1))) { x = xx; break; } }
        if (arq < R.hw) { if (x) { F[c] = x.ford ? F_FORD : F_BRIDGE; PROT[c] = 1; PASS[c] = 1; } else { F[c] = F_WATER; nForcedBlocked++; } continue; }
        if (x && d2 >= hub2) { F[c] = F_CLEAR; PROT[c] = 1; PASS[c] = 1; continue; }
      }
      if (d2 < rc2) { F[c] = F_CLEAR; PROT[c] = 1; continue; }
      if (d2 < hub2) {
        let cut = false; for (const s of sep) if (!s.river) { const p = dx * s.dx + dy * s.dy, q = dx * s.nx + dy * s.ny; if (p > 0 && q < s.cw / 2 && q > -s.cw / 2) { cut = true; break; } }
        if (cut) { F[c] = F_CLEAR; PROT[c] = 1; PASS[c] = 1; } else { F[c] = F_ROCK; PROT[c] = 2; nForcedBlocked++; }
        continue;
      }
      let home = -1, hx = 0, hy = 0, q2 = 0;
      for (let h = 0; h < 6; h++) { hx = u - sp[h].x; hy = v - sp[h].y; q2 = hx * hx + hy * hy; if (q2 < rw2) { home = h; break; } }
      if (home >= 0) {
        if (q2 < rh2) { F[c] = F_CLEAR; PROT[c] = 1; continue; }
        let gap = false; for (const e of sp[home].exits) { const p = hx * e.x + hy * e.y, q = hx * e.y - hy * e.x; if (p > 0 && q < exH && q > -exH) { gap = true; break; } }
        if (gap) { F[c] = F_CLEAR; PROT[c] = 1; PASS[c] = 1; } else { F[c] = F_ROCK; PROT[c] = 2; nForcedBlocked++; }
        continue;
      }
      let bias = 0, ridge = false, pass = false;
      for (const s of sep) {
        if (s.river) continue;
        const p = dx * s.dx + dy * s.dy; if (p < Hub - 0.5) continue;
        const q = dx * s.nx + dy * s.ny - (p > Hub + s.pw + 2 ? P.ridgeWobble * (2 * vnoise1(p, 10, s.salt) - 1) : 0), aq = q < 0 ? -q : q;
        if (p < Hub + s.pw) { if (aq < rH + 2.5) { pass = true; break; } continue; } // the pass: a clear gap between the hub wall and the ridge tip
        if (aq < rH) { ridge = true; break; }
        if (aq < rH + 2) { const n = vnoise(u, v, 6, s.salt); bias += P.ridgeSpine * (1 - Math.abs(2 * n - 1)) * (1 - (aq - rH) / 2); }
      }
      if (pass) { F[c] = F_CLEAR; PROT[c] = 1; PASS[c] = 1; continue; }
      if (ridge) { F[c] = F_ROCK; PROT[c] = 2; nForcedBlocked++; continue; }
      if (arq < R.hw + 3) bias -= 1.5; // river banks stay clear of noise rock
      for (let g = 0; g < segs.length; g++) {
        const s = segs[g]; let t = ((u - s.ax) * s.vx + (v - s.ay) * s.vy) / s.ll; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ox = s.ax + s.vx * t - u, oy = s.ay + s.vy * t - v; if (ox * ox + oy * oy < cor2) { bias -= 1.5; break; }
      }
      const d = Math.sqrt(d2); if (d > Rd - 3) bias += ((d - (Rd - 3)) / 3) * P.rimRamp;
      F[c] = F_FREE; E[c] = noise3(u, v, P, salt) + bias; nFree++;
    }
    // ---- quantile threshold: free cells supply whatever the template leaves of blockedFraction
    const target = Math.round(P.blockedFraction * nDisc) - nForcedBlocked;
    let thr = Infinity;
    if (target > 0 && nFree > 0) {
      const qv = new Float32Array(nFree); let k = 0; for (let c = 0; c < NN; c++) if (F[c] === F_FREE && k < nFree) qv[k++] = E[c];
      qv.sort(); thr = qv[Math.max(0, nFree - Math.min(target, nFree))];
    }
    const terr = new Uint8Array(NN);
    for (let c = 0; c < NN; c++) { const f = F[c]; terr[c] = f === F_FREE ? (E[c] >= thr ? 1 : 0) : f === F_ROCK ? 1 : f === F_WATER ? 2 : f === F_FORD ? 3 : f === F_BRIDGE ? 4 : 0; }
    // ---- cellular automata on free cells only (template walls, meadows and water keep their shape): rock iff >= 5 of the 3x3 are rock
    for (let pass = 0; pass < P.caPasses; pass++) {
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const c = j * N + i; if (F[c] !== F_FREE) { T2[c] = terr[c]; continue; }
        let n = 0; for (let y = j - 1; y <= j + 1; y++) for (let x = i - 1; x <= i + 1; x++) n += x < 0 || y < 0 || x >= N || y >= N || terr[y * N + x] === 1 ? 1 : 0;
        T2[c] = n >= 5 ? 1 : 0;
      }
      terr.set(T2);
    }
    cleanWalls(terr);
    // ---- connectivity: fill small pockets, carve a 2-cell corridor from bigger strays to the main region
    const spc = sp.map((h) => ((h.y | 0) * N + (h.x | 0)));
    let ok = true;
    for (let round = 0; round < 3; round++) {
      const nReg = label4(terr), main = LAB[spc[0]];
      if (main < 0) { ok = false; break; }
      const size = new Int32Array(nReg), prot = new Uint8Array(nReg);
      for (let c = 0; c < NN; c++) { const l = LAB[c]; if (l >= 0) { size[l]++; if (PROT[c]) prot[l] = 1; } }
      let strays = 0;
      for (let l = 0; l < nReg && l < 256; l++) {
        if (l === main) continue;
        if (size[l] < P.pocketFill && !prot[l]) { for (let c = 0; c < NN; c++) if (LAB[c] === l) terr[c] = 1; continue; }
        strays++; if (!carve(terr, l, main)) { if (!prot[l]) { for (let c = 0; c < NN; c++) if (LAB[c] === l) terr[c] = 1; } else ok = false; }
      }
      if (!strays) break;
      cleanWalls(terr);
    }
    const nReg = label4(terr), main = LAB[spc[0]];
    const region = new Int16Array(NN); let nWalk = 0, nBlockedDisc = 0;
    for (let c = 0; c < NN; c++) { if (LAB[c] === main && main >= 0) { region[c] = 1; nWalk++; } else if (walkT(terr[c])) { terr[c] = 1; } } // any leftover stray becomes rock
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const dx = i + 0.5 - C, dy = j + 0.5 - C; if (dx * dx + dy * dy < rd2 && !walkT(terr[j * N + i])) nBlockedDisc++; }
    // ---- chamfer 3-4 SDF (px, cell centres, minus half a cell), cost, snap
    const sdf = new Float32Array(NN), cost = new Uint8Array(NN), snap = new Int32Array(NN);
    chamfer(terr, true, D1); chamfer(terr, false, D2);
    const K = P.costs;
    for (let c = 0; c < NN; c++) {
      if (walkT(terr[c])) { sdf[c] = (D1[c] / 3) * cell - cell / 2; const d = D1[c]; cost[c] = K.base + (d <= 4 ? K.wall1 : d <= 8 ? K.wall2 : 0) + (terr[c] === 3 ? K.ford : 0); }
      else { sdf[c] = -((D2[c] / 3) * cell - cell / 2); cost[c] = 255; }
    }
    snapTable(terr, snap);
    // ---- path distances from every spawn (Dial, 8-neighbour, weights 3/4, no corner cutting), path-Voronoi owner
    const dist = []; for (let i = 0; i < 6; i++) dist.push(dial(terr, spc[i]));
    const owner = new Uint8Array(NN).fill(255);
    for (let c = 0; c < NN; c++) { let b = 65535, o = 255; for (let i = 0; i < 6; i++) { const d = dist[i][c]; if (d < b) { b = d; o = i; } } owner[c] = o; }
    // ---- fairness
    const U = cell / 3, fair = { oneRegion: true, rival: 0, centre: 0, detour: 0, exits: [], pass: false, why: [] };
    const nearest = [], toC = [], det = [];
    for (let i = 0; i < 6; i++) {
      if (region[spc[i]] !== 1) fair.oneRegion = false;
      let m = 65535; for (let j = 0; j < 6; j++) if (j !== i && dist[i][spc[j]] < m) m = dist[i][spc[j]]; nearest.push(m * U);
      let mc = 65535; const cr2 = 0.25 * Rc * Rc;
      for (let j = 0; j < N; j++) for (let x = 0; x < N; x++) { const dx = x + 0.5 - C, dy = j + 0.5 - C; if (dx * dx + dy * dy < cr2) { const d = dist[i][j * N + x]; if (d < mc) mc = d; } }
      toC.push(mc * U); det.push((dist[i][spc[(i + 1) % 6]] / 3) / Rr);
      fair.exits.push(countExits(terr, sp[i], Rh, Rw));
    }
    const ratio = (a) => { let lo = Infinity, hi = 0; for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; } return lo > 0 && lo < 65535 * U ? hi / lo : Infinity; };
    fair.rival = ratio(nearest); fair.centre = ratio(toC); fair.detour = det.reduce((s, v) => s + v, 0) / 6;
    const Fr = P.fairness;
    if (!ok) fair.why.push("carve");
    if (!fair.oneRegion) fair.why.push("region");
    if (!(fair.rival <= Fr.rivalRatio)) fair.why.push("rival " + fair.rival.toFixed(3));
    if (!(fair.centre <= Fr.centreRatio)) fair.why.push("centre " + fair.centre.toFixed(3));
    if (!(fair.detour >= Fr.detour[0] && fair.detour <= Fr.detour[1])) fair.why.push("detour " + fair.detour.toFixed(3));
    if (fair.exits.some((e) => e < Fr.minExits)) fair.why.push("exits " + fair.exits.join(","));
    if (forceFail) fair.why.push("forced");
    fair.pass = fair.why.length === 0;
    // pass mask, dilated one cell: nothing is placed in a pass, canyon, exit or crossing
    const passMask = new Uint8Array(NN);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (PASS[j * N + i]) for (let y = Math.max(0, j - 1); y <= Math.min(N - 1, j + 1); y++) for (let x = Math.max(0, i - 1); x <= Math.min(N - 1, i + 1); x++) passMask[y * N + x] = 1;
    return { id: ++mapId, N, cell, W: P.W, seed, used: seed, rerolls: 0, fallback: false, attempts: 1, terr, cost, sdf, region, snap, owner, dist, passMask,
      spawns: sp.map((h, i) => ({ x: (h.x) * cell, y: (h.y) * cell, c: spc[i] })), river: { dx: R.dx, dy: R.dy, crossings: xs.map((x) => ({ s: x.s * cell, w: x.w, ford: x.ford })) },
      fair: Object.assign(fair, { nearest: nearest.map(Math.round), toCentre: toC.map(Math.round), detours: det.map((v) => +v.toFixed(3)) }),
      blocked: +(nBlockedDisc / nDisc).toFixed(4), walkCells: nWalk, regions: nReg, rot, riverSep: rv, chunks: null };
  }
  let mapId = 0;

  // clear rock thinner than 2 cells (a rock cell open on both sides along an axis; template walls, PROT 2, are built >= 2 thick), then close diagonal-only contacts between
  // blocked cells so 4-connected regions match what an agent can squeeze through. Water is never cleared. Bounded rounds.
  function cleanWalls(terr) {
    for (let round = 0; round < 4; round++) {
      let changed = 0;
      for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
        const c = j * N + i; if (terr[c] !== 1 || PROT[c] === 2) continue;
        const l = walkT(terr[c - 1]), r = walkT(terr[c + 1]), u = walkT(terr[c - N]), d = walkT(terr[c + N]);
        if ((l && r) || (u && d)) { terr[c] = 0; changed++; }
      }
      for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
        const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
        const A = walkT(terr[a]), B = walkT(terr[b]), Cc = walkT(terr[c]), D = walkT(terr[d]);
        if (!A && !D && B && Cc) { if (!PROT[b]) { terr[b] = 1; changed++; } else if (!PROT[c]) { terr[c] = 1; changed++; } }
        else if (A && D && !B && !Cc) { if (!PROT[a]) { terr[a] = 1; changed++; } else if (!PROT[d]) { terr[d] = 1; changed++; } }
      }
      if (!changed) break;
    }
  }
  // 4-connected labels of walkable cells into LAB (-1 blocked); returns the region count
  function label4(terr) {
    LAB.fill(-1); let n = 0;
    for (let s = 0; s < NN; s++) {
      if (LAB[s] >= 0 || !walkT(terr[s])) continue;
      let h = 0, t = 0; Q[t++] = s; LAB[s] = n;
      while (h < t) {
        const c = Q[h++], x = c % N, y = (c / N) | 0;
        if (x > 0 && LAB[c - 1] < 0 && walkT(terr[c - 1])) { LAB[c - 1] = n; Q[t++] = c - 1; }
        if (x < N - 1 && LAB[c + 1] < 0 && walkT(terr[c + 1])) { LAB[c + 1] = n; Q[t++] = c + 1; }
        if (y > 0 && LAB[c - N] < 0 && walkT(terr[c - N])) { LAB[c - N] = n; Q[t++] = c - N; }
        if (y < N - 1 && LAB[c + N] < 0 && walkT(terr[c + N])) { LAB[c + N] = n; Q[t++] = c + N; }
      }
      n++;
    }
    return n;
  }
  // BFS from region l through rock (never water) to the main region; carve the path two cells wide. D2 holds parents here.
  function carve(terr, l, main) {
    D2.fill(-2); let h = 0, t = 0;
    for (let c = 0; c < NN; c++) if (LAB[c] === l) { D2[c] = -1; Q[t++] = c; }
    let hit = -1;
    while (h < t && hit < 0) {
      const c = Q[h++], x = c % N, y = (c / N) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + (k === 0 ? -1 : k === 1 ? 1 : 0), ny = y + (k === 2 ? -1 : k === 3 ? 1 : 0); if (nx < 1 || ny < 1 || nx >= N - 1 || ny >= N - 1) continue;
        const n = ny * N + nx; if (D2[n] !== -2) continue;
        if (LAB[n] === main) { D2[n] = c; hit = n; break; }
        if (terr[n] !== 1 || PROT[n] === 2) continue; // noise rock only: never the river, a home ring, the hub wall or a ridge
        D2[n] = c; Q[t++] = n;
      }
    }
    if (hit < 0) return false;
    for (let c = D2[hit], guard = 0; c >= 0 && guard < NN; c = D2[c], guard++) {
      if (terr[c] === 1) terr[c] = 0; PROT[c] = 1;
      const x = c % N; const side = x + 1 < N - 1 ? c + 1 : c - 1; if (terr[side] === 1 && PROT[side] !== 2) { terr[side] = 0; PROT[side] = 1; }
    }
    return true;
  }
  // two-pass chamfer (3 orthogonal, 4 diagonal) into out: toBlocked = distance from walkable cells to the nearest blocked cell
  // (outside the grid counts as blocked), else from blocked cells to the nearest walkable one
  function chamfer(terr, toBlocked, out) {
    const BIG = 1 << 28;
    for (let c = 0; c < NN; c++) out[c] = walkT(terr[c]) === toBlocked ? BIG : 0;
    const edge = toBlocked ? 0 : BIG;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = j * N + i; let v = out[c]; if (!v) continue;
      const l = i > 0 ? out[c - 1] : edge, u = j > 0 ? out[c - N] : edge, ul = i > 0 && j > 0 ? out[c - N - 1] : edge, ur = i < N - 1 && j > 0 ? out[c - N + 1] : edge;
      if (l + 3 < v) v = l + 3; if (u + 3 < v) v = u + 3; if (ul + 4 < v) v = ul + 4; if (ur + 4 < v) v = ur + 4; out[c] = v;
    }
    for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) {
      const c = j * N + i; let v = out[c]; if (!v) continue;
      const r = i < N - 1 ? out[c + 1] : edge, d = j < N - 1 ? out[c + N] : edge, dr = i < N - 1 && j < N - 1 ? out[c + N + 1] : edge, dl = i > 0 && j < N - 1 ? out[c + N - 1] : edge;
      if (r + 3 < v) v = r + 3; if (d + 3 < v) v = d + 3; if (dr + 4 < v) v = dr + 4; if (dl + 4 < v) v = dl + 4; out[c] = v;
    }
  }
  // nearest walkable cell for every cell (multi-source 8-neighbour BFS from all walkable cells)
  function snapTable(terr, snap) {
    let h = 0, t = 0; snap.fill(-1);
    for (let c = 0; c < NN; c++) if (walkT(terr[c])) { snap[c] = c; Q[t++] = c; }
    while (h < t) {
      const c = Q[h++], x = c % N, y = (c / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const n = ny * N + nx; if (snap[n] >= 0) continue; snap[n] = snap[c]; Q[t++] = n;
      }
    }
  }
  // Dial's bucket queue: path distance in chamfer units (3 per cell, 4 per diagonal) from cell s over walkable cells
  function dial(terr, s) {
    const out = new Uint16Array(NN).fill(65535); BH.fill(-1); let pool = 0, left = 0;
    const push = (c, d) => { if (pool >= BN.length) return; const b = d % 5; BC[pool] = c; BN[pool] = BH[b]; BH[b] = pool++; left++; };
    out[s] = 0; push(s, 0);
    for (let d = 0; left > 0 && d < 65535; d++) {
      const b = d % 5; let k = BH[b]; BH[b] = -1;
      while (k >= 0) {
        const c = BC[k]; k = BN[k]; left--;
        if (out[c] !== d) continue;
        const x = c % N, y = (c / N) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          const n = ny * N + nx; if (!walkT(terr[n])) continue;
          if (dx && dy && (!walkT(terr[y * N + nx]) || !walkT(terr[ny * N + x]))) continue; // no corner cutting
          const nd = d + (dx && dy ? 4 : 3); if (nd < out[n]) { out[n] = nd; push(n, nd); }
        }
      }
    }
    return out;
  }
  // exits = 4-connected walkable components inside a home's wall annulus
  function countExits(terr, h, Rh, Rw) {
    const x0 = Math.max(0, Math.floor(h.x - Rw - 1)), x1 = Math.min(N - 1, Math.ceil(h.x + Rw + 1)), y0 = Math.max(0, Math.floor(h.y - Rw - 1)), y1 = Math.min(N - 1, Math.ceil(h.y + Rw + 1));
    const inRing = (x, y) => { const dx = x + 0.5 - h.x, dy = y + 0.5 - h.y, q = dx * dx + dy * dy; return q >= Rh * Rh && q < Rw * Rw; };
    let n = 0; const seen = new Set();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const c = y * N + x; if (seen.has(c) || !inRing(x, y) || !walkT(terr[c])) continue;
      n++; const st = [c]; seen.add(c);
      for (let g = 0; st.length && g < NN; g++) {
        const k = st.pop(), kx = k % N, ky = (k / N) | 0;
        for (const [ax, ay] of [[kx - 1, ky], [kx + 1, ky], [kx, ky - 1], [kx, ky + 1]]) { if (ax < 0 || ay < 0 || ax >= N || ay >= N) continue; const a = ay * N + ax; if (!seen.has(a) && inRing(ax, ay) && walkT(terr[a])) { seen.add(a); st.push(a); } }
      }
    }
    return n;
  }

  // ---------------------------------------------------------------- public: gen (never installs), use (installs), queries
  // gen(seed, { forceFail }): attempt the seed, then up to maxRerolls derived seeds, then the baked fallback list. Returns a map.
  function gen(seed, opts) {
    const t0 = now(); seed = seed >>> 0; let m = null, tries = 0;
    for (let r = 0; r <= P.maxRerolls; r++) {
      const s = r === 0 ? seed : (seed + Math.imul(r, 0x9E3779B1)) >>> 0;
      m = attempt(s, !!(opts && opts.forceFail)); tries++; m.rerolls = r;
      if (m.fair.pass) break;
    }
    if (!m.fair.pass) {
      const list = P.fallbackSeeds, why = m.fair.why.join("; ");
      for (let k = 0; k < list.length; k++) { m = attempt(list[(seed + k) % list.length] >>> 0, false); tries++; if (m.fair.pass) break; }
      m.fallback = true; m.rerolls = P.maxRerolls; m.failedWhy = why;
      if (typeof console !== "undefined") console.log("[PS.terrain] seed " + seed + " failed " + (P.maxRerolls + 1) + " attempts (" + why + "), fallback seed " + m.used);
    }
    m.seed = seed; m.attempts = tries; m.genMs = +(now() - t0).toFixed(2);
    return m;
  }
  // a flat fixture (grass inside a 2-cell rock border) for PS.fight: combat numbers stay comparable with v1's empty field
  function flat() {
    const terr = new Uint8Array(NN); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (i < 2 || j < 2 || i >= N - 2 || j >= N - 2) terr[j * N + i] = 1;
    PROT.fill(0); const sdf = new Float32Array(NN), cost = new Uint8Array(NN), snap = new Int32Array(NN), region = new Int16Array(NN);
    chamfer(terr, true, D1); chamfer(terr, false, D2);
    for (let c = 0; c < NN; c++) { if (!terr[c]) { sdf[c] = (D1[c] / 3) * P.cell - P.cell / 2; cost[c] = P.costs.base; region[c] = 1; } else { sdf[c] = -((D2[c] / 3) * P.cell - P.cell / 2); cost[c] = 255; } }
    snapTable(terr, snap);
    return { id: ++mapId, N, cell: P.cell, W: P.W, seed: 0, used: 0, rerolls: 0, fallback: false, attempts: 0, terr, cost, sdf, region, snap, owner: new Uint8Array(NN), dist: [],
      passMask: new Uint8Array(NN), spawns: [], river: null, fair: { pass: true, why: [] }, blocked: 0, walkCells: 0, regions: 1, chunks: null, flat: true, genMs: 0 };
  }
  function use(m) { T.map = m; T.terr = m.terr; T.cost = m.cost; T.sdf = m.sdf; T.region = m.region; T.snap = m.snap; T.seed = m.seed; T.rerolls = m.rerolls; return m; }

  // world-space queries on the installed map (cell centres; outside the world counts as rock)
  const cellOf = (x, y) => { if (!(x >= 0 && y >= 0 && x < P.W && y < P.W)) return -1; return ((y / P.cell) | 0) * N + ((x / P.cell) | 0); };
  function walkable(x, y) { const c = cellOf(x, y); return c >= 0 && walkT(T.terr[c]); }
  function sdfAt(x, y) {
    const cell = P.cell, s = T.sdf; let fx = x / cell - 0.5, fy = y / cell - 0.5;
    if (!(fx >= 0)) fx = 0; else if (fx > N - 1.001) fx = N - 1.001; if (!(fy >= 0)) fy = 0; else if (fy > N - 1.001) fy = N - 1.001;
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, c = j * N + i;
    const a = s[c], b = s[c + 1], d = s[c + N], e = s[c + N + 1];
    return a + (b - a) * tx + (d - a) * ty + (a - b - d + e) * tx * ty;
  }
  function placementOk(x, y, minSdfCells) {
    const c = cellOf(x, y); const m = T.map;
    return c >= 0 && walkT(m.terr[c]) && m.region[c] === 1 && !m.passMask[c] && m.sdf[c] >= (minSdfCells == null ? 2 : minSdfCells) * P.cell;
  }
  const SNAP = { x: 0, y: 0 };
  // nearest walkable point: unchanged if walkable, else the centre of the nearest walkable cell (writes and returns one shared object)
  function snapXY(x, y) {
    const W = P.W; x = x < 1 ? 1 : x > W - 1 ? W - 1 : x; y = y < 1 ? 1 : y > W - 1 ? W - 1 : y;
    const c = cellOf(x, y), m = T.map;
    if (c >= 0 && walkT(m.terr[c])) { SNAP.x = x; SNAP.y = y; return SNAP; }
    const s = c >= 0 ? m.snap[c] : -1; if (s < 0) { SNAP.x = x; SNAP.y = y; return SNAP; }
    SNAP.x = ((s % N) + 0.5) * P.cell; SNAP.y = (((s / N) | 0) + 0.5) * P.cell; return SNAP;
  }
  function report(m) {
    m = m || T.map; if (!m) return null;
    return { seed: m.seed, used: m.used, rerolls: m.rerolls, fallback: m.fallback, attempts: m.attempts, genMs: m.genMs, blocked: m.blocked, walkCells: m.walkCells,
      fair: { pass: m.fair.pass, why: m.fair.why, rival: +(+m.fair.rival).toFixed(3), centre: +(+m.fair.centre).toFixed(3), detour: +(+m.fair.detour).toFixed(3), exits: m.fair.exits },
      crossings: m.river ? m.river.crossings.map((x) => (x.ford ? "ford" : "bridge") + x.w) : [] };
  }

  const T = (PS.terrain = { N: 0, cell: 0, W: 0, map: null, terr: null, cost: null, sdf: null, region: null, snap: null, seed: 0, rerolls: 0,
    init, gen, use, flat, walkable, sdfAt, placementOk, snapXY, cellOf, report, walkT, mulberry32, hash, DIR });
})();
