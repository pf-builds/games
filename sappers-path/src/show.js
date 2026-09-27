// Sapper's Path presentation timeline (SPEC §4 "Crews" and "Breaking"). Pure: no DOM, no audio, no clock of its own.
// A break commits in the engine at once; build() lays out what the player SEES afterwards, on the page's sim clock:
//   walk     the crew enters from the board edge along the ground that was connected BEFORE the break
//   work     swings at the contact tile (a WORK event on each strike)
//   crumble  the section's tiles pop in a wave from the contact tile (BFS rings inside the section; a TICK per ring)
//   cascade  levers the break exposed clank (CLANK), their iron doors swing open tile by tile (DOOR)
//   light    ground the break connected comes out of shadow; chests it claimed pop (CHEST) and fly +1 to the card (ARRIVE)
//   keep     on a win the keep opens (KEEP, the fanfare) and the crowned goblin marches out along connected ground
// advance() hands every due event to a callback exactly once, in time order. finish() jumps to the end and drops the
// rest (the next tap fast-forwards). Durations are multiplied by k (1, or 1 / config.show.speedFast at 2×) at build.
// Per frame the renderer only reads the typed arrays and crewAt()/goblinAt(), which write into a reused object.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).show = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const INF = 1e15, EV = { WORK: 0, TICK: 1, CLANK: 2, DOOR: 3, CHEST: 4, ARRIVE: 5, KEEP: 6 };
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

  // One per level (sized to the board); build() reuses it for every break.
  function create(B) {
    const n = B.n;
    return {
      B, active: false, skipped: false, won: false, t0: 0, end: 0, k: 1, s: -1, m: -1,
      px: new Float32Array(n + 2), py: new Float32Array(n + 2), pathN: 0, walkFrom: 0, walkT0: 0, walkT1: 0, stepMs: 1, fade: false, fadeMs: 1,
      face: 1, swingMs: 1, workT1: 0, crewOut: 0,
      cells: new Int16Array(n), cellsN: 0, popAt: new Float64Array(n).fill(INF), isDoor: new Uint8Array(n), popT0: INF, crumbleEnd: 0, rings: 0,
      leverAt: new Float64Array(B.levers.length).fill(INF), chestAt: new Float64Array(B.chestCell.length).fill(INF),
      lit: new Int16Array(n), litN: 0, lightAt: INF, lightMs: 1,
      keepAt: INF, mx: new Float32Array(n + 2), my: new Float32Array(n + 2), marchN: 0, marchT0: INF, marchT1: INF, marchStep: 1,
      ev: [], evi: 0,
      dist: new Int16Array(n), queue: new Int16Array(n), ring: new Int16Array(n),
      pos: { on: false, x: 0, y: 0, frame: 0, flip: false, alpha: 1 },
    };
  }

  function clear(S) {
    for (let i = 0; i < S.cellsN; i++) { S.popAt[S.cells[i]] = INF; S.isDoor[S.cells[i]] = 0; }
    S.cellsN = 0; S.litN = 0; S.pathN = 0; S.marchN = 0; S.ev.length = 0; S.evi = 0;
    S.leverAt.fill(INF); S.chestAt.fill(INF); S.popT0 = S.lightAt = S.keepAt = S.marchT0 = S.marchT1 = INF;
    S.active = false; S.skipped = false; S.won = false;
  }
  function push(S, t, kind, arg) { S.ev.push({ t, kind, arg }); }

  // Distance (in steps) from the board edge over the cells conn marks, into S.dist (-1 = not connected).
  function edgeDist(S, conn) {
    const B = S.B, dist = S.dist, q = S.queue, nb = B.nb;
    dist.fill(-1); let h = 0, t = 0;
    for (let c = 0; c < B.n; c++) if (conn[c] && B.edge[c]) { dist[c] = 0; q[t++] = c; }
    while (h < t) { const c = q[h++]; for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && conn[e] && dist[e] < 0) { dist[e] = dist[c] + 1; q[t++] = e; } } }
  }
  // Walk down S.dist from cell c to the edge, writing cells into out (from c); returns the count.
  function descend(S, conn, c, out, cap) {
    const nb = S.B.nb, dist = S.dist; let m = 0;
    for (let guard = 0; c >= 0 && guard < S.B.n && m < cap; guard++) {
      out[m++] = c; if (dist[c] === 0) break;
      let nx = -1; for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && conn[e] && dist[e] === dist[c] - 1) { nx = e; break; } }
      c = nx;
    }
    return m;
  }
  // The off-board point just beyond edge cell c, in cell units, into (S.px|S.mx)[i].
  function beyond(B, c, X, Y, i, far) {
    const x = c % B.w, y = (c / B.w) | 0;
    let ox = 0, oy = 0; if (x === 0) ox = -1; else if (x === B.w - 1) ox = 1; else if (y === 0) oy = -1; else oy = 1;
    X[i] = x + ox * far; Y[i] = y + oy * far;
  }

  // Lay out the show for breaking section s: prev/next are the engine states either side of the commit.
  function build(S, prev, next, s, now, T, k) {
    const B = S.B, w = B.w, nb = B.nb;
    clear(S);
    S.active = true; S.t0 = now; S.k = k; S.s = s; S.m = B.secMat[s]; S.won = !!next.won;
    S.stepMs = T.walkTileMs * k; S.swingMs = T.swingMs * k; S.fadeMs = T.fadeInMs * k; S.lightMs = T.lightMs * k; S.marchStep = T.marchTileMs * k;

    // Walk: the contact tile is the section tile with the shortest walk in (an edge tile costs 0).
    edgeDist(S, prev.conn);
    let best = 1e9, contact = B.secCells[B.secStart[s]], stand = -1, dir = 0;
    for (let i = B.secStart[s]; i < B.secStart[s + 1]; i++) {
      const c = B.secCells[i];
      for (let d = 0; d < 4; d++) {
        const e = nb[c * 4 + d], cost = e < 0 ? 0 : prev.conn[e] && S.dist[e] >= 0 ? S.dist[e] + 1 : -1;
        if (cost >= 0 && cost < best) { best = cost; contact = c; stand = e; dir = d; }
      }
    }
    const cx = contact % w, cy = (contact / w) | 0;
    let N = 0;
    if (stand < 0) { // straight in from outside to the edge tile
      S.px[N] = cx + DX[dir] * 1.6; S.py[N++] = cy + DY[dir] * 1.6;
      S.px[N] = cx + DX[dir] * T.edgeStand; S.py[N++] = cy + DY[dir] * T.edgeStand;
    } else {
      const m = descend(S, prev.conn, stand, S.ring, B.n);
      beyond(B, S.ring[m - 1], S.px, S.py, N++, 1.2);
      for (let i = m - 1; i >= 0; i--) { S.px[N] = S.ring[i] % w; S.py[N++] = (S.ring[i] / w) | 0; }
      S.px[N - 1] += (cx - S.px[N - 1]) * T.wallStand; S.py[N - 1] += (cy - S.py[N - 1]) * T.wallStand;
    }
    S.pathN = N; S.walkFrom = Math.max(0, N - 1 - T.walkMaxTiles); S.fade = S.walkFrom > 0;
    S.walkT0 = now; S.walkT1 = now + (N - 1 - S.walkFrom) * S.stepMs;
    const lx = S.px[N - 1], ldx = S.px[N - 1] - S.px[N - 2];
    S.face = cx > lx + 0.01 ? 1 : cx < lx - 0.01 ? -1 : ldx < 0 ? -1 : 1;

    // Work: swings at the wall, a strike halfway through each.
    S.workT1 = S.walkT1 + T.swings * S.swingMs;
    for (let i = 0; i < T.swings; i++) push(S, S.walkT1 + (i + 0.5) * S.swingMs, EV.WORK, i);

    // Crumble: rings of the section by BFS distance from the contact tile.
    const R = S.ring, sec = B.sec; let h = 0, t = 0, rings = 0;
    R[t++] = contact; S.popAt[contact] = 0;
    const ringOf = S.dist; ringOf[contact] = 0; // S.dist is free again (the walk is laid out)
    while (h < t) {
      const c = R[h++];
      for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && sec[e] === s && S.popAt[e] === INF) { S.popAt[e] = 0; ringOf[e] = ringOf[c] + 1; R[t++] = e; } }
    }
    S.popT0 = S.workT1;
    for (let i = 0; i < t; i++) { const c = R[i]; S.popAt[c] = S.popT0 + ringOf[c] * T.ringMs * k; S.cells[S.cellsN++] = c; rings = Math.max(rings, ringOf[c] + 1); }
    S.rings = rings;
    for (let r = 0; r < rings; r++) push(S, S.popT0 + r * T.ringMs * k, EV.TICK, r);
    S.crumbleEnd = S.popT0 + (rings - 1) * T.ringMs * k + T.popMs * k;
    S.crewOut = S.crumbleEnd + T.crewOutMs * k;

    // Cascade: levers this break exposed, then the iron doors they open (tiles staggered by distance from a lever).
    const tl = S.crumbleEnd + T.leverDelayMs * k; let anyLever = false, doorEnd = 0;
    for (let i = 0; i < B.levers.length; i++) if (next.thrown[i] && !prev.thrown[i]) { S.leverAt[i] = tl; anyLever = true; }
    if (anyLever) {
      push(S, tl, EV.CLANK, 0);
      const td = tl + T.leverMs * k; let anyDoor = false;
      for (let q = 0; q < B.nsec; q++) {
        if (!next.doorOpen[q] || prev.doorOpen[q]) continue;
        anyDoor = true;
        for (let i = B.secStart[q]; i < B.secStart[q + 1]; i++) {
          const c = B.secCells[i]; let dm = 99;
          for (let j = 0; j < B.levers.length; j++) if (S.leverAt[j] < INF) { const L = B.levers[j]; dm = Math.min(dm, Math.abs((L % w) - (c % w)) + Math.abs(((L / w) | 0) - ((c / w) | 0))); }
          const tc = td + Math.max(0, dm - 1) * T.doorTileMs * k;
          S.popAt[c] = tc; S.isDoor[c] = 1; S.cells[S.cellsN++] = c; doorEnd = Math.max(doorEnd, tc + T.doorMs * k);
        }
      }
      if (anyDoor) push(S, td, EV.DOOR, 0);
    }
    S.lightAt = doorEnd > 0 ? doorEnd : S.crumbleEnd - T.popMs * k;

    // Light: ground this break connected (not the section's own tiles, not the doors).
    for (let c = 0; c < B.n; c++) if (next.conn[c] && !prev.conn[c] && sec[c] !== s && !S.isDoor[c]) S.lit[S.litN++] = c;
    let end = Math.max(S.crewOut, S.lightAt + S.lightMs, doorEnd);
    for (let i = 0; i < B.chestCell.length; i++) {
      if (!next.claimed[i] || prev.claimed[i]) continue;
      S.chestAt[i] = S.lightAt; push(S, S.lightAt, EV.CHEST, i); push(S, S.lightAt + T.flyMs * k, EV.ARRIVE, i);
      end = Math.max(end, S.lightAt + Math.max(T.flyMs, T.chestPopMs) * k);
    }

    // Win: the keep opens, then the crowned goblin marches out toward the nearest edge along connected ground.
    if (next.won) {
      S.keepAt = S.lightAt + T.keepDelayMs * k; push(S, S.keepAt, EV.KEEP, 0);
      edgeDist(S, next.conn);
      let first = -1, fd = 1e9;
      for (let d = 0; d < 4; d++) { const e = nb[B.keep * 4 + d]; if (e >= 0 && next.conn[e] && S.dist[e] >= 0 && S.dist[e] < fd) { fd = S.dist[e]; first = e; } }
      let M = 0; S.mx[M] = B.keep % w; S.my[M++] = (B.keep / w) | 0;
      if (first >= 0) {
        const m = descend(S, next.conn, first, S.ring, T.marchMaxTiles);
        for (let i = 0; i < m; i++) { S.mx[M] = S.ring[i] % w; S.my[M++] = (S.ring[i] / w) | 0; }
        if (m < T.marchMaxTiles && S.dist[S.ring[m - 1]] === 0) beyond(B, S.ring[m - 1], S.mx, S.my, M++, 1.4);
      }
      S.marchN = M; S.marchT0 = S.keepAt + T.marchDelayMs * k; S.marchT1 = S.marchT0 + (M - 1) * S.marchStep;
      end = Math.max(end, S.marchT1);
    }
    S.end = end;
    S.ev.sort((a, b) => a.t - b.t);
    return S;
  }

  // Hand every event due by now to fn(kind, arg, time), once each; the show ends when now passes its end.
  function advance(S, now, fn) {
    const ev = S.ev;
    while (S.evi < ev.length && ev[S.evi].t <= now) { const e = ev[S.evi++]; fn(e.kind, e.arg, e.t); }
    if (S.active && now >= S.end) S.active = false;
  }
  // Skip to the end (the next tap fast-forwards). Returns true if anything was still playing.
  function finish(S) { const was = S.active; S.evi = S.ev.length; S.active = false; S.skipped = true; return was; }

  // Where the crew is at time now (cell units), which frame (0-3 walk, 4 raised, 5 struck), facing and alpha.
  function crewAt(S, now, P) {
    P.on = S.active && S.pathN > 1 && now < S.crewOut;
    if (!P.on) return P;
    P.alpha = 1;
    if (now < S.walkT1) {
      const segs = S.pathN - 1 - S.walkFrom, u = Math.max(0, (now - S.walkT0) / S.stepMs), i = Math.min(segs - 1, Math.floor(u)), f = Math.min(1, u - i);
      const a = S.walkFrom + i, b = a + 1, dx = S.px[b] - S.px[a];
      P.x = S.px[a] + dx * f; P.y = S.py[a] + (S.py[b] - S.py[a]) * f;
      if (dx) P.flip = dx < 0;
      P.frame = Math.floor((now - S.walkT0) / (S.stepMs / 2)) % 4;
      if (S.fade) P.alpha = Math.min(1, (now - S.walkT0) / S.fadeMs);
    } else {
      P.x = S.px[S.pathN - 1]; P.y = S.py[S.pathN - 1]; P.flip = S.face < 0;
      P.frame = 4 + (Math.floor((now - S.walkT1) / (S.swingMs / 2)) % 2);
      if (now > S.crumbleEnd) P.alpha = Math.max(0, 1 - (now - S.crumbleEnd) / Math.max(1, S.crewOut - S.crumbleEnd));
    }
    return P;
  }
  // The crowned goblin: taunting on the keep after it opens, then marching out; it waits at the end of its march (until
  // the level changes, or a tap skips the show).
  function goblinAt(S, now, P) {
    P.on = S.won && !S.skipped && S.marchN > 0 && now >= S.keepAt;
    if (!P.on) return P;
    P.alpha = 1;
    if (now < S.marchT0 || S.marchN < 2) { P.x = S.mx[0]; P.y = S.my[0] - 0.25; P.frame = 4 + (Math.floor((now - S.keepAt) / 120) % 2); P.flip = false; return P; }
    const segs = S.marchN - 1, u = Math.min(segs, (now - S.marchT0) / S.marchStep), i = Math.min(segs - 1, Math.floor(u)), f = u - i, dx = S.mx[i + 1] - S.mx[i];
    P.x = S.mx[i] + dx * f; P.y = S.my[i] + (S.my[i + 1] - S.my[i]) * f;
    if (dx) P.flip = dx < 0;
    P.frame = u >= segs ? 4 + (Math.floor(now / 160) % 2) : Math.floor((now - S.marchT0) / (S.marchStep / 2)) % 4;
    return P;
  }

  return { EV, INF, create, build, advance, finish, crewAt, goblinAt };
});
