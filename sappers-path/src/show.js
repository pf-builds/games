// Sapper's Path presentation timeline v2 (SPEC-v2 §3 "The walk"). Pure: no DOM, no audio, no clock of its own.
// A call commits in the engine at once; build() lays out what the player SEES afterwards, on the page's sim clock:
//   walk     the crew leaves the siege camp and follows the shortest path over the ground that was connected BEFORE the
//            call (the engine's walk: strictly falling camp distance, lowest cell on ties), leaving a faint trail. The
//            whole walk is capped at walkMaxMs, so a long march never drags
//   work     swings at the contact tile (a WORK event on each strike)
//   eat      the section is eaten block by block in rings spreading out from the contact tile (a TICK per ring, arg =
//            ring index). Rings are ringMs apart, squeezed so the whole eat never exceeds eatMaxMs
//   cascade  levers the call exposed clank (CLANK), their iron doors swing open tile by tile (DOOR)
//   light    ground the call connected comes out of shadow; chests it claimed pop (CHEST) and fly +1 to the card (ARRIVE)
//   keep     on a win the keep opens (KEEP, the fanfare) and the crowned goblin is marched out toward the camp
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

  // One per level (sized to the board); build() reuses it for every call.
  function create(B) {
    const n = B.n; let kx = 0, ky = 0;
    for (let i = 0; i < B.keepCells.length; i++) { kx += B.keepCells[i] % B.w; ky += (B.keepCells[i] / B.w) | 0; }
    return {
      B, keepX: kx / B.keepCells.length, keepY: ky / B.keepCells.length, id: 0, prev: null, active: false, skipped: false, won: false, t0: 0, end: 0, k: 1, s: -1, m: -1,
      px: new Float32Array(n + 2), py: new Float32Array(n + 2), pathN: 0, walkT0: 0, walkT1: 0, stepMs: 1, fadeMs: 1, trailEnd: 0,
      face: 1, swingMs: 1, workT1: 0, crewOut: 0,
      cells: new Int16Array(n), cellsN: 0, secN: 0, popAt: new Float64Array(n).fill(INF), isDoor: new Uint8Array(n), popT0: INF, crumbleEnd: 0, crackMs: 1,
      rings: 0, ringAt: new Float64Array(n + 1), ringStart: new Int32Array(n + 2),
      leverAt: new Float64Array(B.levers.length).fill(INF), chestAt: new Float64Array(B.chestCell.length).fill(INF),
      lit: new Int16Array(n), litN: 0, lightAt: INF, lightMs: 1,
      keepAt: INF, mx: new Float32Array(n + 2), my: new Float32Array(n + 2), marchN: 0, marchT0: INF, marchT1: INF, marchStep: 1,
      ev: [], evi: 0,
      ring: new Int16Array(n), depth: new Int16Array(n),
      pos: { on: false, x: 0, y: 0, frame: 0, flip: false, alpha: 1, i: 0 },
    };
  }

  function clear(S) {
    for (let i = 0; i < S.cellsN; i++) { S.popAt[S.cells[i]] = INF; S.isDoor[S.cells[i]] = 0; }
    S.cellsN = 0; S.secN = 0; S.litN = 0; S.pathN = 0; S.marchN = 0; S.rings = 0; S.ev.length = 0; S.evi = 0;
    S.leverAt.fill(INF); S.chestAt.fill(INF); S.popT0 = S.lightAt = S.keepAt = S.marchT0 = S.marchT1 = INF;
    S.active = false; S.skipped = false; S.won = false;
  }
  function push(S, t, kind, arg) { S.ev.push({ t, kind, arg }); }

  // Walk down the engine's camp distance (st.dist over st.conn) from cell c to the camp, writing cells into out (from c).
  // Strictly falling distance, lowest cell on ties: the same walk as engine.pathTo. Returns the count.
  function descend(B, st, c, out, cap) {
    const nb = B.nb, dist = st.dist, conn = st.conn; let m = 0;
    for (let guard = 0; c >= 0 && guard < B.n && m < cap; guard++) {
      out[m++] = c; if (dist[c] <= 0) break;
      let nx = -1; for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && conn[e] && dist[e] === dist[c] - 1 && (nx < 0 || e < nx)) nx = e; }
      c = nx;
    }
    return m;
  }

  // Lay out the show for a call of crew m at target section s: prev/next are the engine states either side of the commit.
  function build(S, prev, next, m, s, now, T, k) {
    const B = S.B, w = B.w, nb = B.nb;
    clear(S);
    S.id++; S.prev = prev;
    S.active = true; S.t0 = now; S.k = k; S.s = s; S.m = m; S.won = !!next.won;
    S.swingMs = T.swingMs * k; S.fadeMs = T.fadeInMs * k; S.lightMs = T.lightMs * k; S.marchStep = T.marchTileMs * k;

    // Walk: from the camp to the ground cell beside the contact tile, over the ground connected before the call.
    const contact = prev.contact[s] >= 0 ? prev.contact[s] : B.secCells[B.secStart[s]], stand = prev.ground[s];
    const cx = contact % w, cy = (contact / w) | 0;
    let N = 0;
    if (stand >= 0) {
      const R = S.ring, n = descend(B, prev, stand, R, B.n);
      for (let i = n - 1; i >= 0; i--) { S.px[N] = R[i] % w; S.py[N++] = (R[i] / w) | 0; }
    }
    if (N === 0) { S.px[N] = cx; S.py[N++] = cy; }
    if (N === 1) { S.px[N] = S.px[0]; S.py[N++] = S.py[0]; }
    S.px[N - 1] += (cx - S.px[N - 1]) * T.wallStand; S.py[N - 1] += (cy - S.py[N - 1]) * T.wallStand;
    S.pathN = N;
    S.stepMs = Math.min(T.walkTileMs, T.walkMaxMs / Math.max(1, N - 1)) * k;
    S.walkT0 = now; S.walkT1 = now + (N - 1) * S.stepMs;
    const lx = S.px[N - 1], ldx = S.px[N - 1] - S.px[N - 2];
    S.face = cx > lx + 0.01 ? 1 : cx < lx - 0.01 ? -1 : ldx < 0 ? -1 : 1;

    // Work: swings at the wall, a strike halfway through each.
    S.workT1 = S.walkT1 + T.swings * S.swingMs;
    for (let i = 0; i < T.swings; i++) push(S, S.walkT1 + (i + 0.5) * S.swingMs, EV.WORK, i);

    // Eat: every section this call broke (Rule A: one), in rings by BFS distance from each section's contact tile.
    const R = S.ring, dep = S.depth, sec = B.sec; let h = 0, t = 0;
    const brk = next.broken, was = prev.broken;
    for (let q = 0; q < B.nsec; q++) {
      if (!brk[q] || was[q]) continue;
      const c0 = prev.contact[q] >= 0 ? prev.contact[q] : B.secCells[B.secStart[q]];
      R[t++] = c0; S.popAt[c0] = 0; dep[c0] = 0;
    }
    while (h < t) {
      const c = R[h++];
      for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && sec[e] >= 0 && brk[sec[e]] && !was[sec[e]] && S.popAt[e] === INF) { S.popAt[e] = 0; dep[e] = dep[c] + 1; R[t++] = e; } }
    }
    const rings = t ? dep[R[t - 1]] + 1 : 0, pop = T.popMs * k, lead = Math.min(T.crackMs * k, (T.eatMaxMs * k) / 3);
    const gap = rings > 1 ? Math.min(T.ringMs * k, (T.eatMaxMs * k - lead - pop) / (rings - 1)) : 0;
    S.popT0 = S.workT1; S.crackMs = Math.max(1, lead); S.rings = rings;
    for (let r = 0; r < rings; r++) { S.ringAt[r] = S.popT0 + lead + r * gap; push(S, S.ringAt[r], EV.TICK, r); }
    // cells grouped by ring (the BFS already emits them in ring order)
    let r0 = -1;
    for (let i = 0; i < t; i++) { const c = R[i], r = dep[c]; while (r0 < r) S.ringStart[++r0] = i; S.popAt[c] = S.ringAt[r]; S.cells[S.cellsN++] = c; }
    S.ringStart[rings] = t;
    S.secN = t;
    S.crumbleEnd = S.popT0 + lead + Math.max(0, rings - 1) * gap + pop;
    S.crewOut = S.crumbleEnd + T.crewOutMs * k;
    S.trailEnd = S.crumbleEnd + T.trailFadeMs * k;

    // Cascade: levers this call exposed, then the iron doors they open (tiles staggered by distance from a lever).
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
    S.lightAt = doorEnd > 0 ? doorEnd : S.crumbleEnd - pop;

    // Light: ground this call connected (not the eaten tiles, not the doors).
    for (let c = 0; c < B.n; c++) if (next.conn[c] && !prev.conn[c] && S.popAt[c] === INF) S.lit[S.litN++] = c;
    let end = Math.max(S.crewOut, S.lightAt + S.lightMs, doorEnd, S.trailEnd);
    for (let i = 0; i < B.chestCell.length; i++) {
      if (!next.claimed[i] || prev.claimed[i]) continue;
      S.chestAt[i] = S.lightAt; push(S, S.lightAt, EV.CHEST, i); push(S, S.lightAt + T.flyMs * k, EV.ARRIVE, i);
      end = Math.max(end, S.lightAt + Math.max(T.flyMs, T.chestPopMs) * k);
    }

    // Win: the keep opens, then the crowned goblin is marched out toward the camp along connected ground.
    if (next.won) {
      S.keepAt = S.lightAt + T.keepDelayMs * k; push(S, S.keepAt, EV.KEEP, 0);
      let first = -1, fd = 1e9;
      for (let i = 0; i < B.keepCells.length; i++) for (let d = 0; d < 4; d++) { const e = nb[B.keepCells[i] * 4 + d]; if (e >= 0 && next.conn[e] && next.dist[e] >= 0 && next.dist[e] < fd) { fd = next.dist[e]; first = e; } }
      let M = 0; S.mx[M] = S.keepX; S.my[M++] = S.keepY;
      if (first >= 0) {
        const m2 = descend(B, next, first, S.ring, T.marchMaxTiles);
        for (let i = 0; i < m2; i++) { S.mx[M] = S.ring[i] % w; S.my[M++] = (S.ring[i] / w) | 0; }
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

  // Where the crew is at time now (cell units), which frame (0-3 walk, 4 raised, 5 struck), facing, alpha, and how far
  // along the path it is (i: path index, for the trail).
  function crewAt(S, now, P) {
    P.on = S.active && S.pathN > 1 && now < S.crewOut;
    P.i = S.pathN - 1;
    if (!P.on) return P;
    P.alpha = 1;
    if (now < S.walkT1) {
      const segs = S.pathN - 1, u = Math.max(0, (now - S.walkT0) / S.stepMs), i = Math.min(segs - 1, Math.floor(u)), f = Math.min(1, u - i);
      const a = i, b = a + 1, dx = S.px[b] - S.px[a];
      P.x = S.px[a] + dx * f; P.y = S.py[a] + (S.py[b] - S.py[a]) * f; P.i = i;
      if (dx) P.flip = dx < 0;
      P.frame = Math.floor((now - S.walkT0) / Math.max(40, S.stepMs)) % 4;
      P.alpha = Math.min(1, (now - S.walkT0) / S.fadeMs);
    } else {
      P.x = S.px[S.pathN - 1]; P.y = S.py[S.pathN - 1]; P.flip = S.face < 0;
      P.frame = 4 + (Math.floor((now - S.walkT1) / (S.swingMs / 2)) % 2);
      if (now > S.crumbleEnd) P.alpha = Math.max(0, 1 - (now - S.crumbleEnd) / Math.max(1, S.crewOut - S.crumbleEnd));
    }
    return P;
  }
  // The crowned goblin: taunting on the keep after it opens, then marched out; it waits at the end of its march (until
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
