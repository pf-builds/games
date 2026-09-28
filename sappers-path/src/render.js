// Sapper's Path board renderer v2 (SPEC-v2 §3-§4). Canvas 2D. The castle is ONE pixel picture (art.js compose():
// world-aligned material textures, region outlines and bevels, wall shadows, the multi-cell keep, levers, chests and the
// siege camp's tents) at config.art.blockPx logical px per block, scaled to the cell size with smoothing off:
//   layer        the picture of the current state, plus each unclaimed chest's crew badge. Re-baked on game.ver or cell.
//   prev layer   the picture of the state before the last call, baked lazily when a show starts. The show draws the
//                blocks not yet eaten, the levers and doors before their moment, the shut keep, and the ground still in
//                shade straight from it, so every overlay matches the picture pixel for pixel.
//   per frame    the layer, the moat's wave frame, the show (a faint trail behind the crew from the camp, blocks cracking
//                and popping ring by ring, rubble and dust, levers, doors, chests, the keep punch, rays, confetti and the
//                big crowned goblin), the target flags (one per callable crew, planted at the contact tile of the wall it
//                would break now), shake, the confirm-mode aim, flash and pulse. The frame path allocates nothing: it
//                walks typed arrays, the show's cell lists and preallocated particle pools.
(function (root, factory) {
  (root.SappersPath = root.SappersPath || {}).render = factory(root.SappersPath.engine, root.SappersPath.art, root.SappersPath.show);
})(window, function (E, Art, Show) {
  "use strict";
  const MATS = Art.MATS, TAU = Math.PI * 2, INF = Show.INF;

  function mk(w, h) { return Art.mk(w, h); }

  function create(canvas, cfg) {
    const N = cfg.fx.dustPool, K = cfg.fx.confettiN;
    return {
      canvas, g: canvas.getContext("2d"), cfg, art: cfg.art, fx: cfg.fx, sh: cfg.show, src: Art.sources(cfg.art), bp: cfg.art.blockPx,
      dpr: 1, cell: 0, ox: 0, oy: 0, B: null, T: null, I: null, pic: null, img: null, buf: null, moatOv: [], dustUntil: -1e12,
      tiles: {}, layer: mk(1, 1), prev: mk(1, 1), dim: mk(1, 1), glow: mk(1, 1),
      layerVer: -1, layerCell: 0, prevId: -1, prevCell: 0, aimVer: -1, aimM: -1, aimCell: 0, rebuilds: 0,
      flagVer: -1, flagN: 0, flagM: new Int8Array(4), flagX: new Int16Array(4), flagY: new Int16Array(4), flagT0: -1e12,
      // dust (kind 0) drifts and fades; rubble chunks (kind 1) hop, land on floor at tLand, sit, then fade
      dust: { x: new Float32Array(N), y: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N), t0: new Float64Array(N).fill(-1e12),
        mat: new Uint8Array(N), size: new Float32Array(N), kind: new Uint8Array(N), floor: new Float32Array(N), tLand: new Float32Array(N), life: new Float32Array(N), head: 0, seed: 1 },
      conf: { x: new Float32Array(K), y: new Float32Array(K), vx: new Float32Array(K), vy: new Float32Array(K), spin: new Float32Array(K), col: new Uint8Array(K), t0: -1e12 },
      frameT: [1, 1, 1, 1, 1], hit: { x: 0, y: 0 },
    };
  }

  // Force every layer to re-bake on the next frame.
  function stale(V) { V.layerVer = -1; V.prevId = -1; V.aimVer = -1; }

  // Per level: the textures, the picture canvas and its pixel buffer, the moat's wave-frame overlays.
  function setLevel(V, B) {
    V.B = B; stale(V); V.flagVer = -1; V.flagDrawnVer = -1; V.flagT0 = -1e12;
    V.T = Art.textures(V.art, B, V.bp); V.I = Art.levelInfo(B);
    V.pic = mk(V.T.PW, V.T.PH); const pg = V.pic.getContext("2d");
    V.img = pg.createImageData(V.T.PW, V.T.PH); V.buf = new Uint32Array(V.img.data.buffer);
    buildMoat(V);
    V.kcx = (V.I.kx0 + V.I.kx1 + 1) / 2; V.kcy = (V.I.ky0 + V.I.ky1 + 1) / 2;
    V.dust.t0.fill(-1e12); V.conf.t0 = -1e12; V.dustUntil = -1e12;
  }
  function buildMoat(V) {
    V.moatOv = [];
    if (!V.T.moat) return;
    for (let f = 1; f < 4; f++) {
      const c = V.moatOv[f] || mk(V.T.PW, V.T.PH), g = c.getContext("2d");
      Art.moatFrame(V.buf, V.T, V.B, f); g.putImageData(V.img, 0, 0); V.moatOv[f] = c;
    }
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
    if (cell !== V.cell || dpr !== V.tileDpr) { V.cell = cell; buildTiles(V); }
    for (const c of [V.layer, V.prev, V.dim, V.glow]) if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
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

  // A crew badge of radius r (device px) at (cx, cy) in g: ink rim, the material's colour ring (as on the crew cards), a
  // cream disc and the icon, scaled by a whole number of device px per art pixel when it can be.
  function disc(V, g, m, cx, cy, r) {
    const A = V.art;
    g.fillStyle = A.badge[1]; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.fillStyle = A[MATS[m]][0]; g.beginPath(); g.arc(cx, cy, r * 0.86, 0, TAU); g.fill();
    g.fillStyle = A.badge[0]; g.beginPath(); g.arc(cx, cy, r * 0.68, 0, TAU); g.fill();
    const raw = r * 1.25, box = raw >= 24 ? Math.min(Math.round(raw / 12) * 12, Math.floor(r * 1.36)) : Math.round(raw);
    icon(g, m, cx, cy, box / 2, A.badge[1]);
  }
  // The chest badge: the crew it holds, with a small gold "+" at the top left.
  function chestBadge(V, m, r) {
    const A = V.art, pad = Math.round(r * 0.3), c = mk(2 * r + pad, 2 * r + pad), g = c.getContext("2d");
    disc(V, g, m, r + pad, r + pad, r);
    const u = Math.max(2, Math.round(r * 0.17)), px = pad + Math.round(r * 0.18), py = pad + Math.round(r * 0.18);
    g.fillStyle = A.ink; g.fillRect(px - u * 1.5 - 1, py - u / 2 - 1, u * 3 + 2, u + 2); g.fillRect(px - u / 2 - 1, py - u * 1.5 - 1, u + 2, u * 3 + 2);
    g.fillStyle = A.chest[2]; g.fillRect(px - u * 1.5, py - u / 2, u * 3, u); g.fillRect(px - u / 2, py - u * 1.5, u, u * 3);
    return c;
  }
  // A target flag: an ink pole, a pennant tail in the material's colour, and the crew's badge at the top. The pole's foot
  // is the sprite's bottom-left + (r, H).
  function flagSprite(V, m, r, pole) {
    const A = V.art, tail = Math.round(r * 0.95), W = 2 * r + tail + 2, H = 2 * r + pole, c = mk(W, H), g = c.getContext("2d"), pw = Math.max(2, Math.round(r * 0.2));
    g.fillStyle = A.badge[1]; g.fillRect(r - pw / 2 - 1, r, pw + 2, H - r);
    g.fillStyle = A.flagPole; g.fillRect(r - pw / 2, r, pw, H - r - 1);
    g.beginPath(); g.moveTo(r * 1.5, r * 0.28); g.lineTo(2 * r + tail, r * 0.62); g.lineTo(r * 1.5, r * 1.12); g.closePath();
    g.fillStyle = A.badge[1]; g.fill(); g.lineWidth = Math.max(2, r * 0.14); g.strokeStyle = A.badge[1]; g.stroke();
    g.beginPath(); g.moveTo(r * 1.5, r * 0.42); g.lineTo(2 * r + tail - r * 0.3, r * 0.62); g.lineTo(r * 1.5, r * 0.98); g.closePath();
    g.fillStyle = A[MATS[m]][2 === m ? 2 : 0]; g.fill();
    disc(V, g, m, r, r, r);
    return c;
  }
  // Scale the sprite sheets and the crack overlay to the cell size; build the chest badges and the flags.
  function buildTiles(V) {
    const s = V.cell, F = V.fx, T = {}, fc = Math.round(s * V.sh.crewScale), fg = Math.round(s * V.sh.goblinScale), d = V.dpr;
    for (let w = 0; w < 5; w++) T["s" + w] = Art.up(V.src["s" + w], (w === 4 ? fg : fc) * Art.FRAMES, w === 4 ? fg : fc);
    T.X = Art.up(V.src.X, s, s);
    const rC = Math.max(Math.round(F.chestBadgeMinCss * d), Math.round(s * F.chestBadgeR)), rF = Math.max(Math.round(F.flagMinCss * d), Math.round(s * F.flagR)), pole = Math.round(Math.max(rF * 1.1, s * F.flagPole));
    V.chestT = []; V.flagT = []; V.sheetT = [];
    for (let m = 0; m < 4; m++) { V.chestT[m] = T["c" + m] = chestBadge(V, m, rC); V.flagT[m] = T["f" + m] = flagSprite(V, m, rF, pole); }
    for (let w = 0; w < 5; w++) V.sheetT[w] = T["s" + w];
    V.frameT = [fc, fc, fc, fc, fg]; V.chestR = rC; V.flagR = rF; V.flagH = 2 * rF + pole;
    V.tiles = T; V.tileDpr = V.dpr; stale(V); V.rebuilds++;
  }

  // ---- layers --------------------------------------------------------------------------------------------------------
  // Paint the picture of state st into canvas c (device px): compose at logical size, put, scale up with smoothing off;
  // then each unclaimed chest's crew badge at device resolution.
  function bakeInto(V, c, st) {
    const B = V.B, s = V.cell, g = c.getContext("2d"), bp = V.bp;
    Art.compose(V.buf, V.T, B, st, V.I, 0);
    V.pic.getContext("2d").putImageData(V.img, 0, 0);
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height);
    g.drawImage(V.pic, V.ox - s, V.oy - s, (V.T.PW / bp) * s, (V.T.PH / bp) * s);
    for (let i = 0; i < B.chestCell.length; i++) if (!st.claimed[i]) drawChestBadge(V, g, i);
  }
  // An unclaimed chest wears its crew's badge (with the gold "+") over its lid.
  function drawChestBadge(V, g, i) {
    const B = V.B, s = V.cell, c = B.chestCell[i], b = V.chestT[B.chestCrew[i]], r = V.chestR, pad = b.width - 2 * r;
    g.drawImage(b, Math.round(V.ox + ((c % B.w) + 0.5) * s - r - pad), Math.round(V.oy + (((c / B.w) | 0) + V.fx.chestBadgeY) * s - r - pad));
  }
  function bakeLayer(V, game) { bakeInto(V, V.layer, game.st); V.layerVer = game.ver; V.layerCell = V.cell; }
  function bakePrev(V, S) { bakeInto(V, V.prev, S.prev); V.prevId = S.id; V.prevCell = V.cell; }

  // The target flags (SPEC-v2 §3): one per crew that can be called now, at the contact tile of the wall it would break.
  function flags(V, game) {
    if (V.flagVer === game.ver) return V;
    const st = game.st; let n = 0;
    if (!st.won) for (let m = 0; m < 4; m++) {
      const t = st.target[m];
      if (st.remaining[m] <= 0 || t < 0 || !((st.legalMask >> m) & 1) && !V.B.cols) continue;
      const c = st.contact[t]; V.flagM[n] = m; V.flagX[n] = c % V.B.w; V.flagY[n] = (c / V.B.w) | 0; n++;
    }
    V.flagN = n; V.flagVer = game.ver;
    return V;
  }

  // Confirm mode (config.input.confirm): a veil over everything but the aimed crew's target, a glow round it, and its
  // walk from the camp lit.
  function bakeAim(V, game) {
    const B = V.B, st = game.st, s = V.cell, m = game.aim, ox = V.ox, oy = V.oy, A = V.art, t = st.target[m];
    const d = V.dim.getContext("2d"), w = V.glow.getContext("2d"), W = V.dim.width, H = V.dim.height;
    d.clearRect(0, 0, W, H); w.clearRect(0, 0, W, H);
    d.fillStyle = "rgba(10,8,16," + V.fx.dimAlpha + ")"; d.fillRect(0, 0, W, H);
    const lw = Math.max(2, Math.round(s * 0.14));
    w.fillStyle = A.glow;
    if (t >= 0) {
      for (let i = B.secStart[t]; i < B.secStart[t + 1]; i++) {
        const c = B.secCells[i], px = ox + (c % B.w) * s, py = oy + ((c / B.w) | 0) * s;
        d.clearRect(px, py, s, s);
        for (let k = 0; k < 4; k++) { const e = B.nb[c * 4 + k]; if (!(e >= 0 && B.sec[e] === t)) edgeRect(w, k, px, py, s, lw); }
      }
      // the walk: from the ground beside the contact tile down the camp distance
      for (let c = st.ground[t], guard = 0; c >= 0 && guard < B.n; guard++) {
        const px = ox + (c % B.w) * s, py = oy + ((c / B.w) | 0) * s, z = Math.max(2, Math.round(s * 0.3));
        d.clearRect(px, py, s, s); w.fillRect(px + ((s - z) >> 1), py + ((s - z) >> 1), z, z);
        if (st.dist[c] <= 0) break;
        let nx = -1; for (let k = 0; k < 4; k++) { const e = B.nb[c * 4 + k]; if (e >= 0 && st.conn[e] && st.dist[e] === st.dist[c] - 1 && (nx < 0 || e < nx)) nx = e; }
        c = nx;
      }
    }
    V.aimVer = game.ver; V.aimM = m; V.aimCell = s;
  }
  function edgeRect(g, d, px, py, s, lw) {
    if (d === 0) g.fillRect(px, py, s, lw); else if (d === 1) g.fillRect(px + s - lw, py, lw, s);
    else if (d === 2) g.fillRect(px, py + s - lw, s, lw); else g.fillRect(px, py, lw, s);
  }

  // ---- effects -------------------------------------------------------------------------------------------------------
  function rnd(D) { return Art.noise(D.seed++); }
  // Cell c pops at time t (its own time on the sim clock): chunky rubble of material m that hops, lands inside the cell
  // and settles, plus a puff of dust.
  function popCell(V, c, m, t) {
    const B = V.B, D = V.dust, N = D.x.length, F = V.fx, cell = V.cell, ap = cell / V.bp, x0 = V.ox + (c % B.w) * cell, y0 = V.oy + ((c / B.w) | 0) * cell;
    const sp = (F.chunkSpeed * cell) / 1000, up = (F.chunkUp * cell) / 1000, gr = (F.chunkGravity * cell) / 1e6;
    for (let k = 0; k < F.chunkPerTile; k++) {
      const j = D.head; D.head = (D.head + 1) % N;
      const r1 = rnd(D), r2 = rnd(D), r3 = rnd(D), size = Math.max(2, Math.round(ap * (1 + r3)));
      D.kind[j] = 1; D.mat[j] = m; D.size[j] = size; D.t0[j] = t; D.life[j] = F.chunkMs;
      D.x[j] = x0 + r1 * (cell - size); D.y[j] = y0 + r2 * cell * 0.5;
      D.vx[j] = (r1 - 0.5) * 2 * sp; D.vy[j] = -(0.5 + r3) * up;
      const fl = y0 + cell - size - r2 * cell * 0.35, dy = fl - D.y[j], vy = D.vy[j];
      D.floor[j] = fl; D.tLand[j] = (-vy + Math.sqrt(Math.max(0, vy * vy + 4 * gr * dy))) / (2 * gr);
    }
    const dsp = (F.dustSpeed * cell) / 1000;
    for (let k = 0; k < F.dustPerTile; k++) {
      const j = D.head; D.head = (D.head + 1) % N;
      const r1 = rnd(D), r2 = rnd(D), r3 = rnd(D);
      D.kind[j] = 0; D.mat[j] = m; D.t0[j] = t; D.life[j] = F.dustMs * (0.7 + 0.3 * r3);
      D.x[j] = x0 + r1 * cell; D.y[j] = y0 + (0.3 + 0.6 * r2) * cell; D.vx[j] = (r1 - 0.5) * 2 * dsp; D.vy[j] = -(0.3 + r3) * dsp;
      D.size[j] = Math.max(2, Math.round(ap * (F.dustArt + r3)));
    }
    V.dustUntil = Math.max(V.dustUntil, t + Math.max(F.chunkMs, F.dustMs));
  }
  // Ring r of the show's eat pops at t: every cell in it.
  function popRing(V, S, r, t) { for (let i = S.ringStart[r]; i < S.ringStart[r + 1]; i++) { const c = S.cells[i]; popCell(V, c, V.B.mat[c], t); } }
  // The keep opens: confetti in the materials' and the flag's colours bursts up from it.
  function confetti(V, S, t) {
    const C = V.conf, F = V.fx, cell = V.cell, n = C.x.length, D = V.dust, sp = (F.confettiSpeed * cell) / 1000;
    const cx = V.ox + V.kcx * cell, cy = V.oy + (V.kcy - 0.3) * cell;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (rnd(D) - 0.5) * F.confettiSpread, v = sp * (0.45 + 0.75 * rnd(D));
      C.x[k] = cx; C.y[k] = cy; C.vx[k] = Math.cos(a) * v; C.vy[k] = Math.sin(a) * v; C.spin[k] = 0.006 + 0.02 * rnd(D); C.col[k] = (rnd(D) * V.art.confetti.length) | 0;
    }
    C.t0 = t; V.dustUntil = Math.max(V.dustUntil, t + F.confettiMs);
  }

  function fillSection(V, g, q) {
    const B = V.B, s = V.cell;
    for (let i = B.secStart[q]; i < B.secStart[q + 1]; i++) { const c = B.secCells[i]; g.fillRect(V.ox + (c % B.w) * s, V.oy + ((c / B.w) | 0) * s, s, s); }
  }

  // True while anything on the board is moving (the page keeps drawing frames until it settles).
  function busy(V, game, now, S) {
    const f = game.fx, F = V.fx;
    if ((S && (S.active || (S.won && !S.skipped))) || now < V.dustUntil) return true;
    if (V.moatOv.length && Math.floor(now / F.moatFrameMs) % 4 !== V.moatDrawn) return true;
    if (game.aim >= 0 && !game.st.won) return true;
    if (now < V.flagT0 + F.flagPopMs) return true;
    if (now - f.pulseT < F.pulseMs || now - f.shakeT < F.shakeMs || now - f.flashT < F.flashMs) return true;
    return false;
  }

  // A sheet frame at (x, y) in cell units, feet on the cell's lower edge, optionally mirrored.
  function drawSprite(V, g, who, frame, x, y, flip, alpha) {
    const F = V.frameT[who], s = V.cell, sheet = V.sheetT[who];
    const dx = Math.round(V.ox + (x + 0.5) * s - F / 2), dy = Math.round(V.oy + (y + 1) * s - F * 0.98);
    g.globalAlpha = alpha;
    if (flip) { g.setTransform(-1, 0, 0, 1, dx + F, dy); g.drawImage(sheet, frame * F, 0, F, F, 0, 0, F, F); g.setTransform(1, 0, 0, 1, 0, 0); }
    else g.drawImage(sheet, frame * F, 0, F, F, dx, dy, F, F);
    g.globalAlpha = 1;
  }

  // The show's overlays on top of the (already final) layer, drawn from the prev layer where the picture hasn't changed
  // yet for the player.
  function drawShow(V, g, S, now) {
    const B = V.B, s = V.cell, T = V.tiles, sh = V.sh, k = S.k, popMs = sh.popMs * k, doorMs = sh.doorMs * k, ox = V.ox, oy = V.oy, P0 = V.prev, w = B.w;
    if (V.prevId !== S.id || V.prevCell !== s) bakePrev(V, S);
    // ground this call connected comes out of shade (a crossfade from the prev picture)
    const la = Math.max(0, Math.min(1, 1 - (now - S.lightAt) / S.lightMs));
    if (la > 0) { g.globalAlpha = la; for (let i = 0; i < S.litN; i++) { const c = S.lit[i], px = ox + (c % w) * s, py = oy + ((c / w) | 0) * s; g.drawImage(P0, px, py, s, s, px, py, s, s); } g.globalAlpha = 1; }
    // the trail: faint footprints on the path the crew has walked, fading once the wall is down
    const P = S.pos; Show.crewAt(S, now, P);
    const ap = Math.max(1, Math.round(s / V.bp)), crack = S.crackMs;
    const ta = now < S.crumbleEnd ? 1 : Math.max(0, 1 - (now - S.crumbleEnd) / Math.max(1, S.trailEnd - S.crumbleEnd));
    if (ta > 0 && S.pathN > 1) {
      const z = Math.max(2, Math.round(s * V.fx.trailDot)), upto = now < S.walkT1 ? P.i + 1 : S.pathN;
      g.globalAlpha = V.fx.trailAlpha * ta;
      for (let k = 0; k < 2; k++) { // an ink shadow, then the pale print on top, so prints never read as rubble
        const d = k ? 0 : ap; g.fillStyle = k ? V.art.footprint : V.art.ink;
        for (let i = 0; i < upto && i < S.pathN - 1; i++) { const x = Math.round(ox + (S.px[i] + 0.5) * s) + d, y = Math.round(oy + (S.py[i] + 0.5) * s) + d; g.fillRect(x - z - 1, y - (z >> 1), z, z); g.fillRect(x + 1, y + (z >> 1) - 1, z, z); }
      }
      g.globalAlpha = 1;
    }
    // blocks not yet eaten (the last crackMs before its pop a block shudders and cracks); a popping block swells,
    // flashes and shrinks away while its rubble flies; doors swing open on their left hinge
    for (let i = 0; i < S.cellsN; i++) {
      const c = S.cells[i], at = S.popAt[c], px = ox + (c % w) * s, py = oy + ((c / w) | 0) * s;
      if (now < at) {
        const ck = !S.isDoor[c] && now >= S.popT0 && now >= at - crack, jx = ck ? ((((now / 45) | 0) + c) & 1 ? ap : -ap) : 0;
        g.drawImage(P0, px, py, s, s, px + jx, py, s, s);
        if (ck) { g.globalAlpha = Math.min(1, 0.35 + (now - (at - crack)) / crack); g.drawImage(T.X, px + jx, py); g.globalAlpha = 1; }
      } else if (S.isDoor[c] ? now < at + doorMs : now < at + popMs) {
        if (S.isDoor[c]) { const p = (now - at) / doorMs, ww = Math.max(1, Math.round(s * (1 - p))); g.globalAlpha = 1 - p * 0.5; g.drawImage(P0, px, py, s, s, px, py, ww, s); g.globalAlpha = 1; }
        else {
          const p = (now - at) / popMs, z = Math.round(s * (p < 0.2 ? 1 + p * 0.6 : 1.12 * (1 - (p - 0.2) / 0.8))), zx = px + ((s - z) >> 1), zy = py + ((s - z) >> 1);
          g.drawImage(P0, px, py, s, s, zx, zy, z, z);
          g.globalAlpha = 0.6 * (1 - p) * (1 - p); g.fillStyle = V.art.cloud; g.fillRect(zx, zy, z, z); g.globalAlpha = 1;
        }
      }
    }
    // levers: as they were until halfway through their swing
    for (let i = 0; i < B.levers.length; i++) {
      const at = S.leverAt[i]; if (at >= INF || now >= at + (sh.leverMs * k) / 2) continue;
      const c = B.levers[i], px = ox + (c % w) * s, py = oy + ((c / w) | 0) * s, jy = now >= at ? -Math.max(1, ap) : 0;
      g.drawImage(P0, px, py, s, s, px, py + jy, s, s);
    }
    // chests: shut until the light reaches them, then the lid pops with a hop
    for (let i = 0; i < B.chestCell.length; i++) {
      const at = S.chestAt[i]; if (at >= INF || now >= at + sh.chestPopMs * k) continue;
      const c = B.chestCell[i], px = ox + (c % w) * s, py = oy + ((c / w) | 0) * s, r = V.chestR * 1.4;
      if (now < at) { const x0 = Math.max(0, Math.round(px - r)), y0 = Math.max(0, Math.round(py - r)), ww = Math.min(P0.width - x0, Math.round(s + 2 * r)), hh = Math.min(P0.height - y0, Math.round(s + r + py - y0 - r)); g.drawImage(P0, x0, y0, ww, hh, x0, y0, ww, hh); }
      else { const p = (now - at) / (sh.chestPopMs * k); g.drawImage(V.layer, px, py, s, s, px, py - Math.round(s * 0.3 * Math.sin(p * Math.PI)), s, s); }
    }
    // the keep stays shut until its moment
    if (S.won && now < S.keepAt) { const kx = ox + V.I.kx0 * s, ky = oy + V.I.ky0 * s, kw = (V.I.kx1 - V.I.kx0 + 1) * s, kh = (V.I.ky1 - V.I.ky0 + 1) * s; g.drawImage(P0, kx, ky, kw, kh, kx, ky, kw, kh); }
    // the crew
    if (P.on) drawSprite(V, g, S.m, P.frame, P.x, P.y, P.flip, P.alpha);
  }

  // The flags, popping in (a small overshoot) once the light of the last call is out.
  function drawFlags(V, g, game, now, S) {
    flags(V, game);
    if (game.st.won || !V.flagN) return;
    const F = V.fx, s = V.cell, H = V.flagH, r = V.flagR;
    let t0 = V.flagT0;
    if (V.flagDrawnVer !== game.ver) { V.flagDrawnVer = game.ver; V.flagT0 = t0 = S && S.active ? S.lightAt : now - F.flagPopMs; }
    if (now < t0) return;
    const p = Math.min(1, (now - t0) / F.flagPopMs), z = p < 1 ? Math.min(1.15, 0.4 + 1.1 * p) - Math.max(0, p - 0.6) * 0.375 : 1;
    for (let i = 0; i < V.flagN; i++) {
      const m = V.flagM[i], spr = V.flagT[m], fx = Math.round(V.ox + (V.flagX[i] + 0.5) * s), fy = Math.min(V.canvas.height, Math.max(Math.round(H * z), Math.round(V.oy + (V.flagY[i] + 0.8) * s)));
      if (z === 1) g.drawImage(spr, fx - r, fy - H);
      else { const ww = Math.round(spr.width * z), hh = Math.round(spr.height * z); g.drawImage(spr, fx - Math.round(r * z), fy - hh, ww, hh); }
    }
  }

  function draw(V, game, now, S) {
    if (!V.B || !V.cell) return;
    const g = V.g, B = V.B, s = V.cell, F = V.fx, f = game.fx, A = V.art, st = game.st, T = V.tiles;
    if (V.layerVer !== game.ver || V.layerCell !== s) bakeLayer(V, game);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.imageSmoothingEnabled = false;
    g.drawImage(V.layer, 0, 0);
    // moat: the current wave frame (frame 0 is baked in the layer)
    const mf = Math.floor(now / F.moatFrameMs) % 4; V.moatDrawn = mf;
    if (mf && V.moatOv.length) g.drawImage(V.moatOv[mf], V.ox - s, V.oy - s, (V.T.PW / V.bp) * s, (V.T.PH / V.bp) * s);
    if (S && S.active) drawShow(V, g, S, now);
    drawFlags(V, g, game, now, S);
    // the keep opens with a punch (it swells and settles), then the big crowned goblin taunts (bouncing, the crown
    // glinting) and is marched out toward the camp
    const kx = V.ox + V.I.kx0 * s, ky = V.oy + V.I.ky0 * s, kw = (V.I.kx1 - V.I.kx0 + 1) * s, kh = (V.I.ky1 - V.I.ky0 + 1) * s;
    let t = S ? now - S.keepAt : -1;
    if (S && S.won && !S.skipped && t >= 0 && t < F.keepPunchMs) {
      const z = 1 + F.keepPunch * Math.sin((t / F.keepPunchMs) * Math.PI), zw = Math.round(kw * z), zh = Math.round(kh * z);
      g.drawImage(V.layer, kx, ky, kw, kh, kx + ((kw - zw) >> 1), ky + ((kh - zh) >> 1), zw, zh);
    }
    if (S && S.won) {
      const P = Show.goblinAt(S, now, S.pos);
      if (P.on) {
        const lift = P.frame >= 4 ? F.goblinBounce * Math.abs(Math.sin((now / F.goblinBounceMs) * Math.PI)) : 0;
        drawSprite(V, g, 4, P.frame, P.x, P.y - lift, P.flip, 1);
        const gp = now % F.glintMs;
        if (gp < F.glintOnMs) { // a four-point glint on the crown
          const fg = V.frameT[4], u = Math.max(1, Math.round(fg / 16)), gx = Math.round(V.ox + (P.x + 0.5) * s - fg / 2 + fg * (P.flip ? 7 : 8) / 16), gy = Math.round(V.oy + (P.y - lift + 1) * s - fg * 0.98 + fg * 1.5 / 16), k = gp < F.glintOnMs / 2 ? 2 : 1;
          g.fillStyle = V.art.cloud; g.fillRect(gx - u * k, gy, u * (2 * k + 1), u); g.fillRect(gx, gy - u * k, u, u * (2 * k + 1));
        }
      }
    }
    // shake: redraw the section's blocks from the layer, shifted
    t = now - f.shakeT;
    if (f.shakeS >= 0 && t >= 0 && t < F.shakeMs) {
      const p = t / F.shakeMs, dx = Math.round(Math.sin((t / 1000) * F.shakeHz * TAU) * F.shakeCells * s * (1 - p)), q = f.shakeS;
      g.fillStyle = A.outline; fillSection(V, g, q);
      for (let i = B.secStart[q]; i < B.secStart[q + 1]; i++) { const c = B.secCells[i], px = V.ox + (c % B.w) * s, py = V.oy + ((c / B.w) | 0) * s; g.drawImage(V.layer, px, py, s, s, px + dx, py, s, s); }
    }
    // confirm mode: dim everything but the aimed target and its walk
    if (game.aim >= 0 && !st.won) {
      if (V.aimVer !== game.ver || V.aimM !== game.aim || V.aimCell !== s) bakeAim(V, game);
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
    // pulse: the wall a board tap asked about (or its crew's real target)
    t = now - f.pulseT;
    if (f.pulseS >= 0 && t >= 0 && t < F.pulseMs) { g.globalAlpha = 0.6 * (1 - t / F.pulseMs); g.fillStyle = A.pulse; fillSection(V, g, f.pulseS); g.globalAlpha = 1; }
    // keep burst when the keep opens: a flash, then two rings of thick rays turning outward
    t = S ? now - S.keepAt : -1;
    if (S && S.won && !S.skipped && t >= 0 && t < F.keepBurstMs) {
      const p = t / F.keepBurstMs, cx = V.ox + V.kcx * s, cy = V.oy + V.kcy * s, kr = Math.max(kw, kh) / 2, R = kr + s * F.raysR * Math.sqrt(p), n = F.raysN;
      if (p < 0.18) { g.globalAlpha = 0.7 * (1 - p / 0.18); g.fillStyle = A.cloud; g.beginPath(); g.arc(cx, cy, kr * (1 + 2 * p), 0, TAU); g.fill(); }
      g.lineCap = "butt";
      for (let ring = 0; ring < 2; ring++) {
        g.globalAlpha = (1 - p) * (ring ? 0.8 : 1); g.strokeStyle = ring ? A.cloud : A.burst; g.lineWidth = Math.max(3, s * (ring ? 0.14 : 0.3)); g.beginPath();
        for (let k = 0; k < n; k++) { const a = ((k + ring * 0.5) / n) * TAU + p * 0.8, r0 = R * (ring ? 0.55 : 0.4), r1 = R * (ring ? 0.85 : 1); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); }
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    // confetti: flipping pixel flakes that burst from the keep and fall
    const C = V.conf, ca = now - C.t0;
    if (ca >= 0 && ca < F.confettiMs) {
      const cg = (F.confettiGravity * s) / 1e6, cz = Math.max(2, Math.round(s * 0.2)), pal = A.confetti;
      g.globalAlpha = Math.min(1, 3 * (1 - ca / F.confettiMs));
      for (let k = 0; k < C.x.length; k++) {
        const w = Math.max(1, Math.round(cz * Math.abs(Math.cos(C.spin[k] * ca)))), drag = 1 - Math.min(0.5, ca / 4000);
        g.fillStyle = pal[C.col[k]]; g.fillRect(Math.round(C.x[k] + C.vx[k] * ca * drag - w / 2), Math.round(C.y[k] + C.vy[k] * ca * drag + cg * ca * ca), w, cz);
      }
      g.globalAlpha = 1;
    }
    // dust puffs drift and fade; rubble chunks (material face, dark underside) hop, land, sit, then fade
    const D = V.dust, dg = (F.dustGravity * s) / 1e6, kg = (F.chunkGravity * s) / 1e6;
    for (let j = 0; j < D.x.length; j++) {
      const a = now - D.t0[j], life = D.life[j];
      if (a < 0 || a >= life) continue;
      const M = A[MATS[D.mat[j]]], z = D.size[j];
      if (D.kind[j]) {
        const tl = D.tLand[j], ta = a < tl ? a : tl, x = Math.round(D.x[j] + D.vx[j] * ta), y = Math.round(a < tl ? D.y[j] + D.vy[j] * a + kg * a * a : D.floor[j]);
        g.globalAlpha = Math.min(1, 3.2 * (1 - a / life));
        g.fillStyle = M[3]; g.fillRect(x, y, z, z); g.fillStyle = (j & 1) ? M[2] : M[0]; g.fillRect(x, y, z, z - Math.max(1, (z / 3) | 0));
      } else {
        g.globalAlpha = 0.85 * (1 - a / life); g.fillStyle = (j & 1) ? M[2] : A.ground[2];
        g.fillRect(Math.round(D.x[j] + D.vx[j] * a), Math.round(D.y[j] + D.vy[j] * a + dg * a * a), z, z);
      }
    }
    g.globalAlpha = 1;
  }

  // ---- cache health (SPEC §5; lessons 27-28) ---------------------------------------------------------------------------
  // Readbacks go through one small probe canvas (willReadFrequently), never the sprite canvases themselves.
  let probe = null;
  function probeCtx(w, h) {
    if (!probe) probe = mk(w, h).getContext("2d", { willReadFrequently: true });
    if (probe.canvas.width !== w || probe.canvas.height !== h) { probe.canvas.width = w; probe.canvas.height = h; }
    probe.clearRect(0, 0, w, h); return probe;
  }
  function alphaAt(c, x, y) { try { const p = probeCtx(1, 1); p.drawImage(c, -(x | 0), -(y | 0)); return p.getImageData(0, 0, 1, 1).data[3]; } catch (e) { return 0; } }
  function rgbAt(c, x, y) { try { const p = probeCtx(1, 1); p.drawImage(c, -(x | 0), -(y | 0)); return Array.from(p.getImageData(0, 0, 1, 1).data); } catch (e) { return [0, 0, 0, 0]; } }
  // A coarse hash of what the board canvas shows (the canvas scaled into a 48 × 48 probe).
  function pixelHash(V) {
    try {
      const p = probeCtx(48, 48); p.drawImage(V.canvas, 0, 0, 48, 48);
      const d = p.getImageData(0, 0, 48, 48).data; let h = 0, lit = 0;
      for (let i = 0; i < d.length; i += 4) { h = (Math.imul(h, 31) + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11) | 0; if (d[i + 3] > 0) lit++; }
      return { hash: (h >>> 0).toString(16), opaque: lit / (48 * 48) };
    } catch (e) { return { hash: "x", opaque: 0 }; }
  }
  // Which sprite caches read blank (an evicted backing store reads all zero): each chest badge and flag at its disc
  // centre, each character sheet at a torso pixel of frame 0, the picture layer at its centre.
  function blankTiles(V) {
    const out = [];
    for (let m = 0; m < 4; m++) {
      const c = V.tiles["c" + m], f = V.tiles["f" + m];
      if (!c || alphaAt(c, c.width - V.chestR, c.height - V.chestR) < 255) out.push("c" + m);
      if (!f || alphaAt(f, V.flagR, V.flagR) < 255) out.push("f" + m);
    }
    for (let w = 0; w < 5; w++) { const c = V.tiles["s" + w], p = Art.SHEET_PROBE[w], F = V.frameT[w]; if (!c || alphaAt(c, ((p[0] + 0.5) * F) / 16, ((p[1] + 0.5) * F) / 16) < 255) out.push("s" + w); }
    if (V.layerVer >= 0 && alphaAt(V.layer, V.layer.width / 2, V.layer.height / 2) < 255) out.push("layer");
    return out;
  }
  // After the tab comes back: rebuild the sprites if any read blank, and always re-bake the layers. Returns true on a rebuild.
  function check(V) {
    const blank = V.cell ? blankTiles(V) : [];
    stale(V); if (V.B) buildMoat(V);
    if (!V.cell || !blank.length) return false;
    buildTiles(V); return true;
  }
  // Test hook: blank every cache the way a discarded backing store would.
  function dropCaches(V) {
    let n = 0;
    for (const k in V.tiles) { const c = V.tiles[k]; c.width = c.width; n++; }
    for (const c of [V.layer, V.prev].concat(V.moatOv.filter(Boolean))) { c.width = c.width; n++; }
    return n;
  }

  return { create, setLevel, fit, cellAt, cellCenter, icon, draw, busy, popRing, popCell, confetti, flags, blankTiles, check, dropCaches, pixelHash, rgbAt, MATS };
});
