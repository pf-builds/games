// Sapper's Path board renderer (SPEC §4 look). Canvas 2D. The art itself lives in art.js (16×16 logical sprites); this
// file scales it to the cell size and draws the board:
//   sprite caches  every tile, the five crew/goblin sheets and the badges at the current cell size (built on fit,
//                  checked for opaque pixels on wake, lessons 27-28)
//   board layer    grass margin, every tile (broken walls as rubble), shadow on cut-off ground, section outlines, one
//                  crew badge per section; scenery sections (SPEC §7) muted, no badge. Re-baked on game.ver or cell change.
//   pick layers    the dim veil and the glow outline for the picked crew; re-baked when ver or pick changes
//   per frame      the layer, moat wave frame, the show (show.js: crews walking in, the crumble wave, lever, doors,
//                  chests, the keep and the marching goblin), shake, pick, flash, pulse, dust. The frame path
//                  allocates nothing: it walks typed arrays, the show's cell lists and a preallocated dust pool.
(function (root, factory) {
  (root.SappersPath = root.SappersPath || {}).render = factory(root.SappersPath.engine, root.SappersPath.art, root.SappersPath.show);
})(window, function (E, Art, Show) {
  "use strict";
  const MATS = Art.MATS, TAU = Math.PI * 2, INF = Show.INF;

  function mk(w, h) { return Art.mk(w, h); }

  function create(canvas, cfg) {
    const N = cfg.fx.dustPool;
    return {
      canvas, g: canvas.getContext("2d"), cfg, art: cfg.art, fx: cfg.fx, sh: cfg.show, src: Art.sources(cfg.art),
      dpr: 1, cell: 0, ox: 0, oy: 0, B: null, dustUntil: -1e12, anchor: null, chestAt: null, leverAt: null, moat: null, moatN: 0, moatDrawn: 0,
      tiles: {}, frameW: 0, tileCell: 0, layer: mk(1, 1), dim: mk(1, 1), glow: mk(1, 1),
      layerVer: -1, layerCell: 0, pickVer: -1, pickM: -1, pickCell: 0, rebuilds: 0,
      dust: { x: new Float32Array(N), y: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N), t0: new Float64Array(N).fill(-1e12),
        mat: new Uint8Array(N), size: new Float32Array(N), head: 0, seed: 1 },
      hit: { x: 0, y: 0 }, center: { x: 0, y: 0 },
    };
  }

  // Force both layers to re-bake on the next frame.
  function stale(V) { V.layerVer = V.pickVer = -1; }

  // Per-level lookups: the badge anchor (the tile nearest each section's centroid), chest and lever indices by cell,
  // and the moat cells (redrawn per wave frame).
  function setLevel(V, B) {
    V.B = B; stale(V);
    V.anchor = new Int16Array(B.nsec);
    for (let s = 0; s < B.nsec; s++) {
      let sx = 0, sy = 0; const a = B.secStart[s], b = B.secStart[s + 1];
      for (let i = a; i < b; i++) { sx += B.secCells[i] % B.w; sy += (B.secCells[i] / B.w) | 0; }
      sx /= b - a; sy /= b - a;
      let best = B.secCells[a], bd = 1e9;
      for (let i = a; i < b; i++) { const c = B.secCells[i], d = (c % B.w - sx) ** 2 + (((c / B.w) | 0) - sy) ** 2; if (d < bd - 1e-9) { bd = d; best = c; } }
      V.anchor[s] = best;
    }
    V.chestAt = new Int16Array(B.n).fill(-1); V.leverAt = new Int16Array(B.n).fill(-1);
    for (let i = 0; i < B.chestCell.length; i++) V.chestAt[B.chestCell[i]] = i;
    for (let i = 0; i < B.levers.length; i++) V.leverAt[B.levers[i]] = i;
    V.moat = new Int16Array(B.n); V.moatN = 0;
    for (let c = 0; c < B.n; c++) if (B.kind[c] === E.MOAT) V.moat[V.moatN++] = c;
    V.dust.t0.fill(-1e12); V.dustUntil = -1e12;
  }

  // Fit the board (grid plus an outside margin) into availW × availH CSS px at dpr. The cell snaps to whole device
  // pixels. Returns the canvas CSS size.
  function fit(V, availW, availH, dpr) {
    const B = V.B, L = V.cfg.layout, m = L.marginCells;
    const byW = (availW * dpr) / (B.w + 2 * m), byH = (availH * dpr) / (B.h + 2 * m);
    const cell = Math.max(Math.round(L.minCellPx * dpr), Math.min(Math.round(L.maxCellPx * dpr), Math.floor(Math.min(byW, byH))));
    const ox = Math.round(cell * m), W = cell * B.w + 2 * ox, H = cell * B.h + 2 * ox;
    V.dpr = dpr; V.ox = V.oy = ox;
    if (V.canvas.width !== W || V.canvas.height !== H) { V.canvas.width = W; V.canvas.height = H; }
    if (cell !== V.cell) { V.cell = cell; buildTiles(V); }
    for (const c of [V.layer, V.dim, V.glow]) if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    stale(V);
    const cssW = W / dpr, cssH = H / dpr;
    V.canvas.style.width = cssW + "px"; V.canvas.style.height = cssH + "px";
    return { cssW, cssH, cell: cell / dpr };
  }

  // Client coordinates → board cell ({x, y}, reused) or null.
  function cellAt(V, clientX, clientY) {
    if (!V.B || !V.cell) return null;
    const r = V.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const px = ((clientX - r.left) * V.canvas.width) / r.width - V.ox, py = ((clientY - r.top) * V.canvas.height) / r.height - V.oy;
    const x = Math.floor(px / V.cell), y = Math.floor(py / V.cell);
    if (x < 0 || y < 0 || x >= V.B.w || y >= V.B.h) return null;
    V.hit.x = x; V.hit.y = y; return V.hit;
  }
  // Cell centre in client coordinates (the harness taps here; the chest fly starts here).
  function cellCenter(V, x, y) {
    const r = V.canvas.getBoundingClientRect(), k = r.width / V.canvas.width;
    return { x: r.left + (V.ox + (x + 0.5) * V.cell) * k, y: r.top + (V.oy + (y + 0.5) * V.cell) * k };
  }

  // Draw crew icon m (0-3; 4 = iron) centred at (cx, cy) in a (2r)² box, into any 2D context (the crew cards too).
  function icon(g, m, cx, cy, r, ink) { Art.icon(g, m, cx, cy, r, ink); }

  // Scale every logical source to the cell size: tiles at s × s, sheets at frameW per frame, badges.
  function buildTiles(V) {
    const s = V.cell, A = V.art, T = {}, F = Math.round(s * V.sh.crewScale);
    for (const k in V.src) T[k] = k[0] === "s" ? Art.up(V.src[k], F * Art.FRAMES, F) : Art.up(V.src[k], s, s);
    const br = Math.max(4, Math.round(s * 0.34));
    for (let m = 0; m < 5; m++) {
      const c = mk(br * 2, br * 2), g = c.getContext("2d");
      g.fillStyle = A.badge[1]; g.beginPath(); g.arc(br, br, br, 0, TAU); g.fill();
      g.fillStyle = A.badge[0]; g.beginPath(); g.arc(br, br, br * 0.84, 0, TAU); g.fill();
      icon(g, m, br, br, br * 0.6, A.badge[1]);
      T["b" + m] = c;
    }
    // index tables so the frame path never builds a key string
    V.matT = []; V.moatT = []; V.sheetT = [];
    for (let m = 0; m < 5; m++) for (let v = 0; v < 2; v++) V.matT[m * 2 + v] = T["m" + m + v];
    for (let f = 0; f < 4; f++) for (let v = 0; v < 2; v++) V.moatT[f * 2 + v] = T["~" + f + v];
    for (let w = 0; w < 5; w++) V.sheetT[w] = T["s" + w];
    V.tiles = T; V.frameW = F; V.tileCell = s; stale(V); V.rebuilds++;
  }

  // ---- board layer ---------------------------------------------------------------------------------------------------
  // One outline edge of a cell (d: 0 up, 1 right, 2 down, 3 left).
  function edgeRect(g, d, px, py, s, lw) {
    if (d === 0) g.fillRect(px, py, s, lw); else if (d === 1) g.fillRect(px + s - lw, py, lw, s);
    else if (d === 2) g.fillRect(px, py + s - lw, s, lw); else g.fillRect(px, py, lw, s);
  }
  // Outline cell c wherever its neighbour is not "the same" (bake paths only; the frame path inlines its own test).
  function edges(g, B, c, px, py, s, lw, same) { for (let d = 0; d < 4; d++) if (!same(B.nb[c * 4 + d])) edgeRect(g, d, px, py, s, lw); }
  function bakeLayer(V, game) {
    const B = V.B, st = game.st, s = V.cell, T = V.tiles, A = V.art, g = V.layer.getContext("2d"), ox = V.ox, oy = V.oy, sc = game.scenery;
    const W = V.layer.width, H = V.layer.height;
    for (let y = oy - s * Math.ceil(oy / s), j = 0; y < H; y += s, j++) for (let x = ox - s * Math.ceil(ox / s), i = 0; x < W; x += s, i++) g.drawImage(T["q" + ((i + j) & 1)], x, y);
    for (let c = 0; c < B.n; c++) {
      const x = c % B.w, y = (c / B.w) | 0, px = ox + x * s, py = oy + y * s, v = (x * 3 + y * 5) & 1, k = B.kind[c];
      if (k === E.WALL) g.drawImage(T[(st.open[c] ? "r" : "m") + B.mat[c] + v], px, py);
      else if (k === E.MOAT) g.drawImage(T["~0" + v], px, py);
      else if (k === E.LEVER) g.drawImage(T[st.thrown[V.leverAt[c]] ? "L2" : "L0"], px, py);
      else if (k === E.KEEP) g.drawImage(T[st.won ? "Ko" : "K"], px, py);
      else if (k === E.CHEST) g.drawImage(T[st.claimed[V.chestAt[c]] ? "Co" : "C"], px, py);
      else g.drawImage(T["g" + v], px, py);
      // Ground cut off from the outside sits in shadow: the lit ground is where crews can walk.
      if ((k === E.OPEN || k === E.CHEST || (k === E.WALL && st.open[c])) && !st.conn[c]) { g.globalAlpha = 0.42; g.fillStyle = "#000"; g.fillRect(px, py, s, s); g.globalAlpha = 1; }
      // Scenery (a section nothing can ever reach): muted toward the ground colour.
      if (k === E.WALL && !st.open[c] && sc[B.sec[c]]) { g.globalAlpha = V.fx.sceneryAlpha; g.fillStyle = A.groundShade; g.fillRect(px, py, s, s); g.globalAlpha = 1; }
    }
    const lw = Math.max(1, Math.round(s * 0.07));
    g.fillStyle = A.outline;
    for (let c = 0; c < B.n; c++) {
      if (B.kind[c] !== E.WALL || st.open[c]) continue;
      const q = B.sec[c];
      edges(g, B, c, ox + (c % B.w) * s, oy + ((c / B.w) | 0) * s, s, lw, (e) => e >= 0 && B.kind[e] === E.WALL && !st.open[e] && B.sec[e] === q);
    }
    for (let q = 0; q < B.nsec; q++) {
      if (st.broken[q] || st.doorOpen[q] || sc[q]) continue;
      drawBadge(V, g, q);
    }
    V.layerVer = game.ver; V.layerCell = s;
  }
  function drawBadge(V, g, q) {
    const B = V.B, s = V.cell, c = V.anchor[q], b = V.tiles["b" + B.secMat[q]];
    g.drawImage(b, Math.round(V.ox + ((c % B.w) + 0.5) * s - b.width / 2), Math.round(V.oy + (((c / B.w) | 0) + 0.5) * s - b.height / 2));
  }

  // Dim veil over everything except the reachable standing sections of the picked crew; glow outline around those.
  function bakePick(V, game) {
    const B = V.B, st = game.st, s = V.cell, m = game.pick, ox = V.ox, oy = V.oy, A = V.art;
    const d = V.dim.getContext("2d"), w = V.glow.getContext("2d"), W = V.dim.width, H = V.dim.height;
    d.clearRect(0, 0, W, H); w.clearRect(0, 0, W, H);
    d.fillStyle = "rgba(10,8,16," + V.fx.dimAlpha + ")"; d.fillRect(0, 0, W, H);
    const lw = Math.max(2, Math.round(s * 0.12));
    w.fillStyle = A.glow;
    for (let q = 0; q < B.nsec; q++) {
      if (B.secMat[q] !== m || st.broken[q] || !st.reach[q]) continue;
      for (let i = B.secStart[q]; i < B.secStart[q + 1]; i++) {
        const c = B.secCells[i], px = ox + (c % B.w) * s, py = oy + ((c / B.w) | 0) * s;
        d.clearRect(px, py, s, s);
        edges(w, B, c, px, py, s, lw, (e) => e >= 0 && B.sec[e] === q);
      }
    }
    V.pickVer = game.ver; V.pickM = m; V.pickCell = s;
  }

  // ---- effects -------------------------------------------------------------------------------------------------------
  // Dust for the cells [from, to) of a list, stamped with time t (the event's own time on the sim clock).
  function spawnDust(V, list, from, to, mat, t) {
    const B = V.B, D = V.dust, N = D.x.length, per = V.fx.dustPerTile, cell = V.cell, sp = (V.fx.dustSpeed * cell) / 1000;
    for (let i = from; i < to; i++) {
      const c = list[i];
      for (let k = 0; k < per; k++) {
        const j = D.head; D.head = (D.head + 1) % N;
        const r1 = Art.noise(D.seed++), r2 = Art.noise(D.seed++), r3 = Art.noise(D.seed++);
        D.x[j] = V.ox + ((c % B.w) + r1) * cell; D.y[j] = V.oy + (((c / B.w) | 0) + r2) * cell;
        D.vx[j] = (r1 - 0.5) * 2 * sp; D.vy[j] = -(0.4 + r3) * sp; D.mat[j] = mat; D.size[j] = Math.max(1, Math.round(cell * (0.06 + 0.07 * r3))); D.t0[j] = t;
      }
    }
    V.dustUntil = Math.max(V.dustUntil, t + V.fx.dustMs);
  }
  // Dust for the show's crumble ring r (the cells whose pop time equals ring r's).
  function dustRing(V, S, r, t) {
    const T = V.sh, at = S.popT0 + r * T.ringMs * S.k;
    for (let i = 0; i < S.cellsN; i++) { const c = S.cells[i]; if (!S.isDoor[c] && Math.abs(S.popAt[c] - at) < 0.5) spawnDust(V, S.cells, i, i + 1, S.m, t); }
  }

  function fillSection(V, g, q) {
    const B = V.B, s = V.cell;
    for (let i = B.secStart[q]; i < B.secStart[q + 1]; i++) { const c = B.secCells[i]; g.fillRect(V.ox + (c % B.w) * s, V.oy + ((c / B.w) | 0) * s, s, s); }
  }

  // True while anything on the board is moving (the page keeps drawing frames until it settles).
  function busy(V, game, now, S) {
    const f = game.fx, F = V.fx;
    if ((S && (S.active || (S.won && !S.skipped))) || now < V.dustUntil) return true;
    if (V.moatN && Math.floor(now / F.moatFrameMs) % 4 !== V.moatDrawn) return true;
    if (game.pick >= 0 && !game.st.won) return true;
    if (now - f.pulseT < F.pulseMs || now - f.shakeT < F.shakeMs || now - f.flashT < F.flashMs) return true;
    return false;
  }

  // A sheet frame at (x, y) in cell units, feet on the cell's lower edge, optionally mirrored.
  function drawSprite(V, g, who, frame, x, y, flip, alpha) {
    const F = V.frameW, s = V.cell, sheet = V.sheetT[who];
    const dx = Math.round(V.ox + (x + 0.5) * s - F / 2), dy = Math.round(V.oy + (y + 1) * s - F * 0.98);
    g.globalAlpha = alpha;
    if (flip) { g.setTransform(-1, 0, 0, 1, dx + F, dy); g.drawImage(sheet, frame * F, 0, F, F, 0, 0, F, F); g.setTransform(1, 0, 0, 1, 0, 0); }
    else g.drawImage(sheet, frame * F, 0, F, F, dx, dy, F, F);
    g.globalAlpha = 1;
  }

  // The show's overlays on top of the (already final) layer.
  function drawShow(V, g, S, now) {
    const B = V.B, s = V.cell, T = V.tiles, sh = V.sh, k = S.k, popMs = sh.popMs * k, doorMs = sh.doorMs * k, ox = V.ox, oy = V.oy;
    // newly connected ground comes out of shadow
    const la = 0.42 * Math.max(0, Math.min(1, 1 - (now - S.lightAt) / S.lightMs));
    if (la > 0) { g.globalAlpha = la; g.fillStyle = "#000"; for (let i = 0; i < S.litN; i++) { const c = S.lit[i]; g.fillRect(ox + (c % B.w) * s, oy + ((c / B.w) | 0) * s, s, s); } g.globalAlpha = 1; }
    // standing tiles not yet popped; popping tiles hop, shrink and fade; doors swing shut-to-open on their left hinge
    const lw = Math.max(1, Math.round(s * 0.07));
    for (let i = 0; i < S.cellsN; i++) {
      const c = S.cells[i], at = S.popAt[c], px = ox + (c % B.w) * s, py = oy + ((c / B.w) | 0) * s, v = ((c % B.w) * 3 + ((c / B.w) | 0) * 5) & 1;
      const tile = V.matT[B.mat[c] * 2 + v];
      if (now < at) {
        g.drawImage(tile, px, py);
        g.fillStyle = V.art.outline; const q = B.sec[c];
        for (let d = 0; d < 4; d++) { const e = B.nb[c * 4 + d]; if (!(e >= 0 && B.sec[e] === q && S.popAt[e] > now)) edgeRect(g, d, px, py, s, lw); }
      } else if (S.isDoor[c] ? now < at + doorMs : now < at + popMs) {
        if (S.isDoor[c]) { const p = (now - at) / doorMs, w = Math.max(1, Math.round(s * (1 - p))); g.globalAlpha = 1 - p * 0.5; g.drawImage(tile, px, py, w, s); g.globalAlpha = 1; }
        else { const p = (now - at) / popMs, z = s * (p < 0.3 ? 1 + p * 0.5 : 1.15 * (1 - (p - 0.3) / 0.7)), hop = s * 0.25 * Math.sin(Math.min(1, p / 0.6) * Math.PI); g.globalAlpha = Math.min(1, 1.4 - p); g.drawImage(tile, px + (s - z) / 2, py + (s - z) / 2 - hop, z, z); g.globalAlpha = 1; }
      }
    }
    if (now < S.popT0) drawBadge(V, g, S.s);
    // levers: up until their clank, a mid frame while they swing
    for (let i = 0; i < B.levers.length; i++) {
      const at = S.leverAt[i]; if (at >= INF || now >= at + sh.leverMs * k) continue;
      const c = B.levers[i]; g.drawImage(T[now < at ? "L0" : now < at + (sh.leverMs * k) / 2 ? "L1" : "L2"], ox + (c % B.w) * s, oy + ((c / B.w) | 0) * s);
    }
    // chests: shut until the light reaches them, then the lid pops with a hop
    for (let i = 0; i < B.chestCell.length; i++) {
      const at = S.chestAt[i]; if (at >= INF || now >= at + sh.chestPopMs * k) continue;
      const c = B.chestCell[i], px = ox + (c % B.w) * s, py = oy + ((c / B.w) | 0) * s;
      g.drawImage(T.g0, px, py);
      if (now < at) g.drawImage(T.C, px, py);
      else { const p = (now - at) / (sh.chestPopMs * k); g.drawImage(T.Co, px, py - Math.round(s * 0.22 * Math.sin(p * Math.PI)), s, s); }
    }
    // the keep stays shut until its moment
    if (S.won && now < S.keepAt) g.drawImage(T.K, ox + (B.keep % B.w) * s, oy + ((B.keep / B.w) | 0) * s);
    // the crew
    const P = S.pos;
    Show.crewAt(S, now, P); if (P.on) drawSprite(V, g, S.m, P.frame, P.x, P.y, P.flip, P.alpha);
  }

  function draw(V, game, now, S) {
    if (!V.B || !V.cell) return;
    const g = V.g, B = V.B, s = V.cell, F = V.fx, f = game.fx, A = V.art, st = game.st, T = V.tiles;
    if (V.layerVer !== game.ver || V.layerCell !== s) bakeLayer(V, game);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    g.drawImage(V.layer, 0, 0);
    // moat: the current wave frame (frame 0 is baked in the layer)
    const mf = Math.floor(now / F.moatFrameMs) % 4; V.moatDrawn = mf;
    if (mf) for (let i = 0; i < V.moatN; i++) { const c = V.moat[i], x = c % B.w, y = (c / B.w) | 0; g.drawImage(V.moatT[mf * 2 + ((x * 3 + y * 5) & 1)], V.ox + x * s, V.oy + y * s); }
    if (S && S.active) drawShow(V, g, S, now);
    if (S && S.won) { const P = Show.goblinAt(S, now, S.pos); if (P.on) drawSprite(V, g, 4, P.frame, P.x, P.y, P.flip, 1); }
    // shake: redraw the section's tiles from the layer, shifted
    let t = now - f.shakeT;
    if (f.shakeS >= 0 && t >= 0 && t < F.shakeMs) {
      const p = t / F.shakeMs, dx = Math.round(Math.sin((t / 1000) * F.shakeHz * TAU) * F.shakeCells * s * (1 - p)), q = f.shakeS;
      g.fillStyle = A.outline; fillSection(V, g, q);
      for (let i = B.secStart[q]; i < B.secStart[q + 1]; i++) { const c = B.secCells[i], px = V.ox + (c % B.w) * s, py = V.oy + ((c / B.w) | 0) * s; g.drawImage(V.layer, px, py, s, s, px + dx, py, s, s); }
    }
    // picked crew: dim everything else, glow the reachable sections
    if (game.pick >= 0 && !st.won) {
      if (V.pickVer !== game.ver || V.pickM !== game.pick || V.pickCell !== s) bakePick(V, game);
      g.drawImage(V.dim, 0, 0);
      g.globalAlpha = 0.55 + 0.45 * Math.sin((now / 1000) * F.glowHz * TAU); g.drawImage(V.glow, 0, 0); g.globalAlpha = 1;
    }
    // flash: the walls in the way blink
    t = now - f.flashT;
    if (f.flashN > 0 && t >= 0 && t < F.flashMs && Math.floor((t / F.flashMs) * F.flashBlinks * 2) % 2 === 0) {
      g.globalAlpha = 0.55; g.fillStyle = A.flash;
      for (let i = 0; i < f.flashN; i++) fillSection(V, g, f.flash[i]);
      g.globalAlpha = 1;
    }
    // pulse: the section a tap just picked
    t = now - f.pulseT;
    if (f.pulseS >= 0 && t >= 0 && t < F.pulseMs) { g.globalAlpha = 0.6 * (1 - t / F.pulseMs); g.fillStyle = A.pulse; fillSection(V, g, f.pulseS); g.globalAlpha = 1; }
    // keep burst when the keep opens
    t = S ? now - S.keepAt : -1;
    if (S && S.won && !S.skipped && t >= 0 && t < F.keepBurstMs) {
      const p = t / F.keepBurstMs, cx = V.ox + ((B.keep % B.w) + 0.5) * s, cy = V.oy + (((B.keep / B.w) | 0) + 0.5) * s, R = s * (0.8 + 2.2 * p);
      g.globalAlpha = 1 - p; g.strokeStyle = A.burst; g.lineWidth = Math.max(2, s * 0.12); g.lineCap = "round"; g.beginPath();
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU + p; g.moveTo(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
      g.stroke(); g.globalAlpha = 1;
    }
    // dust: square pixel motes in the material's colours
    const D = V.dust, life = F.dustMs, grav = (F.dustGravity * s) / 1e6;
    for (let j = 0; j < D.x.length; j++) {
      const a = now - D.t0[j];
      if (a < 0 || a >= life) continue;
      g.globalAlpha = 1 - a / life; g.fillStyle = A[MATS[D.mat[j]]][(j & 1) * 2];
      g.fillRect(Math.round(D.x[j] + D.vx[j] * a), Math.round(D.y[j] + D.vy[j] * a + grav * a * a), D.size[j], D.size[j]);
    }
    g.globalAlpha = 1;
  }

  // ---- cache health (SPEC §5; lessons 27-28) ---------------------------------------------------------------------------
  const OPAQUE_KEYS = ["g0", "g1", "q0", "~00", "~01", "m00", "m10", "m20", "m30", "m40", "m01", "m11", "m21", "m31", "m41", "r00", "r41", "K", "Ko", "C", "Co", "L0", "L2", "b0", "b1", "b2", "b3", "b4"];
  // Readbacks go through one small probe canvas (willReadFrequently), never the sprite canvases themselves.
  let probe = null;
  function probeCtx(w, h) {
    if (!probe) probe = mk(w, h).getContext("2d", { willReadFrequently: true });
    if (probe.canvas.width !== w || probe.canvas.height !== h) { probe.canvas.width = w; probe.canvas.height = h; }
    probe.clearRect(0, 0, w, h); return probe;
  }
  function alphaAt(c, x, y) { try { const p = probeCtx(1, 1); p.drawImage(c, -(x | 0), -(y | 0)); return p.getImageData(0, 0, 1, 1).data[3]; } catch (e) { return 0; } }
  // A coarse hash of what the board canvas shows (the canvas scaled into a 48 × 48 probe).
  function pixelHash(V) {
    try {
      const p = probeCtx(48, 48); p.drawImage(V.canvas, 0, 0, 48, 48);
      const d = p.getImageData(0, 0, 48, 48).data; let h = 0, lit = 0;
      for (let i = 0; i < d.length; i += 4) { h = (Math.imul(h, 31) + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11) | 0; if (d[i + 3] > 0) lit++; }
      return { hash: (h >>> 0).toString(16), opaque: lit / (48 * 48) };
    } catch (e) { return { hash: "x", opaque: 0 }; }
  }
  // Which sprite caches read blank (an evicted backing store reads all zero): tiles at their centre, each character
  // sheet at a torso pixel of frame 0.
  function blankTiles(V) {
    const out = [], F = V.frameW;
    for (const k of OPAQUE_KEYS) { const c = V.tiles[k]; if (!c || alphaAt(c, c.width / 2, c.height / 2) < 255) out.push(k); }
    for (let w = 0; w < 5; w++) { const c = V.tiles["s" + w], p = Art.SHEET_PROBE[w]; if (!c || alphaAt(c, ((p[0] + 0.5) * F) / 16, ((p[1] + 0.5) * F) / 16) < 255) out.push("s" + w); }
    return out;
  }
  // After the tab comes back: rebuild the sprites if any read blank, and always re-bake the layers. Returns true on a rebuild.
  function check(V) { stale(V); if (!V.cell || !blankTiles(V).length) return false; buildTiles(V); return true; }
  // Test hook: blank every cache the way a discarded backing store would.
  function dropCaches(V) { let n = 0; for (const k in V.tiles) { const c = V.tiles[k]; c.width = c.width; n++; } V.layer.width = V.layer.width; return n; }

  return { create, setLevel, fit, cellAt, cellCenter, icon, draw, busy, spawnDust, dustRing, blankTiles, check, dropCaches, pixelHash, MATS };
});
