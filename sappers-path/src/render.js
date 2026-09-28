// Sapper's Path board renderer v2 (SPEC-v2 §3-§4). Canvas 2D. The castle is ONE pixel picture (art.js compose():
// world-aligned material textures, battlements, tower caps and gates, decor, region outlines and bevels, wall shadows, the
// multi-cell keep, big levers and chests, and the siege camp's tents and standard) at config.art.blockPx logical px per
// block, scaled to the cell size with smoothing off:
//   layer        the picture of the current state, plus each unclaimed chest's "+1" chip. Re-baked on game.ver or cell.
//   prev layer   the picture of the state before the last call. At a call the current layer becomes it (adoptPrev), so
//                the tap bakes one picture, not two; the show draws the blocks not yet eaten, the levers and doors before
//                their moment, the shut keep, and the ground still in shade straight from it.
//   per frame    the layer, the moat's wave frame, the target rims and the info-tap walks, the show (a faint trail behind
//                the crew from the camp, blocks cracking, swelling and popping ring by ring, rubble and dust, levers,
//                doors, chests), the idle crews at the camp, the walking crew and its helpers along the wave front, lever
//                glints, the target flags (a pole and a rippling swallowtail per callable crew, planted at the contact tile
//                of the wall it would break now, fanned apart when two are close), then the win (the keep punch, a board
//                flash, rays and confetti sized to the board, the big crowned goblin), shake, the confirm-mode aim, flash,
//                pulse, dust and rubble. The frame path allocates nothing: it walks typed arrays, the show's cell lists
//                and preallocated particle pools.
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
      tiles: {}, layer: mk(1, 1), prev: mk(1, 1), dim: mk(1, 1), glow: mk(1, 1), tgt: mk(1, 1), info: mk(1, 1),
      layerVer: -1, layerCell: 0, prevId: -1, prevCell: 0, aimVer: -1, aimM: -1, aimCell: 0, rebuilds: 0, deferred: false, deferrals: 0,
      flagVer: -1, flagN: 0, flagM: new Int8Array(4), flagX: new Int16Array(4), flagY: new Int16Array(4), flagS: new Int16Array(4),
      flagLean: new Float32Array(4), flagMir: new Uint8Array(4), flagLift: new Uint8Array(4), flagT0: -1e12, tgtVer: -1, tgtCell: 0,
      infoOn: false, infoVer: -1, infoCell: 0, infoM: -1, infoS: -1,
      campN: 0, campM: new Int8Array(4), campX: new Float32Array(4), campY: new Float32Array(4), campFlip: new Uint8Array(4),
      moatDrawn: -1, waveDrawn: -1, glintDrawn: -1, bobDrawn: -1,
      // dust (kind 0) drifts, grows and fades; rubble chunks (kind 1) hop, land on floor at tLand, sit, then fade
      dust: { x: new Float32Array(N), y: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N), t0: new Float64Array(N).fill(-1e12),
        mat: new Uint8Array(N), size: new Float32Array(N), kind: new Uint8Array(N), floor: new Float32Array(N), tLand: new Float32Array(N), life: new Float32Array(N), head: 0, seed: 1 },
      conf: { x: new Float32Array(K), y: new Float32Array(K), vx: new Float32Array(K), vy: new Float32Array(K), gz: new Float32Array(K), spin: new Float32Array(K), col: new Uint8Array(K), t0: -1e12 },
      frameT: [1, 1, 1, 1, 1], hit: { x: 0, y: 0 },
    };
  }

  // Force every layer to re-bake on the next frame.
  function stale(V) { V.layerVer = -1; V.prevId = -1; V.aimVer = -1; V.tgtVer = -1; V.infoCell = 0; }

  // Per level: the textures, the picture canvas and its pixel buffer, the moat's wave-frame overlays, and where the idle
  // crews stand at the camp (one per crew the level uses, in card order, spread along the camp in front of its tents).
  function setLevel(V, B, art, present) {
    V.B = B; stale(V); V.flagVer = -1; V.flagDrawnVer = -1; V.flagT0 = -1e12; V.infoOn = false;
    V.T = Art.textures(V.art, B, V.bp); V.I = Art.levelInfo(B, art, V.art);
    V.pic = mk(V.T.PW, V.T.PH); const pg = V.pic.getContext("2d");
    V.img = pg.createImageData(V.T.PW, V.T.PH); V.buf = new Uint32Array(V.img.data.buffer);
    buildMoat(V);
    V.kcx = (V.I.kx0 + V.I.kx1 + 1) / 2; V.kcy = (V.I.ky0 + V.I.ky1 + 1) / 2;
    V.dust.t0.fill(-1e12); V.conf.t0 = -1e12; V.dustUntil = -1e12;
    const I = V.I, sd = I.side, along = sd === 0 || sd === 2, span = I.u1 - I.u0, deep = I.vIn !== I.vOut, cx = deep ? I.vIn : I.vOut, cy = cx, ins = along ? V.fx.campCrewIn : V.fx.campCrewSide;
    let n = 0; for (let m = 0; m < 4; m++) if (present && present[m]) V.campM[n++] = m;
    V.campN = n;
    for (let i = 0; i < n; i++) {
      const u = I.u0 + (span * (i + 0.5)) / n - 0.5; // cell coordinate along the camp (drawSprite centres on x + 0.5)
      if (along) { V.campX[i] = u; V.campY[i] = sd === 2 ? cy - ins : cy + ins - 0.4; V.campFlip[i] = u + 0.5 > B.w / 2 ? 1 : 0; }
      else { V.campX[i] = sd === 3 ? cx + ins : cx - ins; V.campY[i] = u - 0.15; V.campFlip[i] = sd === 1 ? 1 : 0; }
    }
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
  // pixels and never overflows the box (the board stays on screen at any size). Returns the canvas CSS size.
  function fit(V, availW, availH, dpr) {
    const B = V.B, L = V.cfg.layout, m = L.marginCells;
    const byW = (availW * dpr) / (B.w + 2 * m), byH = (availH * dpr) / (B.h + 2 * m);
    const cell = Math.max(1, Math.min(Math.round(L.maxCellPx * dpr), Math.floor(Math.min(byW, byH))));
    const ox = Math.round(cell * m), W = cell * B.w + 2 * ox, H = cell * B.h + 2 * ox;
    V.dpr = dpr; V.ox = V.oy = ox;
    if (V.canvas.width !== W || V.canvas.height !== H) { V.canvas.width = W; V.canvas.height = H; }
    if (cell !== V.cell || dpr !== V.tileDpr) { V.cell = cell; buildTiles(V); }
    for (const c of [V.layer, V.prev, V.dim, V.glow, V.tgt, V.info]) if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
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

  // Scale the sprite sheets and the crack overlay to the cell size; build the flag banners (3 ripple frames each) and the
  // chest chips on the pixel grid: k whole device px per art pixel, near the board's own art pixel (config.fx.flagArtK)
  // but never so small the icon drops under config.fx.flagIconMinCss.
  function buildTiles(V) {
    const s = V.cell, F = V.fx, T = {}, d = V.dpr, ap = s / V.bp, fc = Math.round(s * V.sh.crewScale), fg = Math.max(Math.round(F.goblinMinCss * d), Math.round(s * V.sh.goblinScale));
    for (let w = 0; w < 5; w++) T["s" + w] = Art.up(V.src["s" + w], (w === 4 ? fg : fc) * Art.FRAMES, w === 4 ? fg : fc);
    T.X = Art.up(V.src.X, s, s);
    const k = Math.max(Math.ceil((F.flagIconMinCss * d) / 12), Math.round(ap * F.flagArtK));
    V.banT = []; V.chipT = []; V.sheetT = [];
    for (let m = 0; m < 4; m++) {
      for (let f = 0; f < 3; f++) V.banT[m * 3 + f] = T["f" + m + (f ? "_" + f : "")] = Art.up(Art.flagArt(V.art, m, f), 26 * k, 18 * k);
      V.chipT[m] = T["c" + m] = Art.up(Art.chipArt(V.art, m), 28 * k, 16 * k);
    }
    for (let w = 0; w < 5; w++) V.sheetT[w] = T["s" + w];
    V.frameT = [fc, fc, fc, fc, fg]; V.flagK = k; V.banW = 26 * k; V.banH = 18 * k;
    V.tiles = T; V.tileDpr = V.dpr; stale(V); V.rebuilds++;
  }

  // ---- layers --------------------------------------------------------------------------------------------------------
  // Paint the picture of state st into canvas c (device px): compose at logical size, put, scale up with smoothing off;
  // then each unclaimed chest's "+1" chip at device resolution.
  function bakeInto(V, c, st) {
    const B = V.B, s = V.cell, g = c.getContext("2d"), bp = V.bp;
    Art.compose(V.buf, V.T, B, st, V.I, 0);
    V.pic.getContext("2d").putImageData(V.img, 0, 0);
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height);
    g.drawImage(V.pic, V.ox - s, V.oy - s, (V.T.PW / bp) * s, (V.T.PH / bp) * s);
    for (let i = 0; i < B.chestCell.length; i++) if (!st.claimed[i]) g.drawImage(V.chipT[B.chestCrew[i]], chipX(V, i), chipY(V, i));
  }
  // An unclaimed chest's chip sits just above its chest (clamped inside the board).
  function chipX(V, i) { const c = V.B.chestCell[i], w = V.chipT[0].width; return Math.max(0, Math.min(V.canvas.width - w, Math.round(V.ox + ((c % V.B.w) + 0.5) * V.cell - w / 2))); }
  function chipY(V, i) { const c = V.B.chestCell[i], ap = V.cell / V.bp; return Math.max(0, Math.round(V.oy + ((c / V.B.w) | 0) * V.cell - ap * 1.5 - V.chipT[0].height)); }
  function bakeLayer(V, game) { bakeInto(V, V.layer, game.st); V.layerVer = game.ver; V.layerCell = V.cell; }
  function bakePrev(V, S) { bakeInto(V, V.prev, S.prev); V.prevId = S.id; V.prevCell = V.cell; }
  // At a call: the layer (still the picture of the state before it) becomes the prev layer, so only the new picture is
  // baked, and that a frame later (draw() shows the prev picture for the first frame of the walk: the same pixels).
  function adoptPrev(V, verBefore, S) {
    if (!V.cell || V.layerVer !== verBefore || V.layerCell !== V.cell) return false;
    const t = V.prev; V.prev = V.layer; V.layer = t; V.prevId = S.id; V.prevCell = V.cell; V.layerVer = -1; V.deferred = false;
    return true;
  }

  // The target flags (SPEC-v2 §3): one per crew that can be called now, at the contact tile of the wall it would break.
  // Flags within config.fx.flagFanCells of each other fan apart: the outer ones lean out on angled poles (the left ones
  // with their banners mirrored), the middle ones stand taller.
  function flags(V, game) {
    if (V.flagVer === game.ver) return V;
    const st = game.st, F = V.fx; let n = 0;
    if (!st.won) for (let m = 0; m < 4; m++) {
      const t = st.target[m];
      if (st.remaining[m] <= 0 || t < 0 || !((st.legalMask >> m) & 1) && !V.B.cols) continue;
      const c = st.contact[t]; V.flagM[n] = m; V.flagS[n] = t; V.flagX[n] = c % V.B.w; V.flagY[n] = (c / V.B.w) | 0; n++;
    }
    V.flagN = n; V.flagVer = game.ver;
    V.flagLean.fill(0); V.flagMir.fill(0); V.flagLift.fill(0);
    // clusters: flags chained within flagFanCells (Chebyshev); each cluster sorted by x, then y
    const grp = [0, 1, 2, 3];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.max(Math.abs(V.flagX[i] - V.flagX[j]), Math.abs(V.flagY[i] - V.flagY[j])) <= F.flagFanCells) { const a = grp[j]; for (let k = 0; k < n; k++) if (grp[k] === a) grp[k] = grp[i]; }
    for (let g0 = 0; g0 < n; g0++) {
      const ids = []; for (let i = 0; i < n; i++) if (grp[i] === g0) ids.push(i);
      if (ids.length < 2) continue;
      ids.sort((a, b) => V.flagX[a] - V.flagX[b] || V.flagY[a] - V.flagY[b]);
      const q = ids.length;
      ids.forEach((i, r) => { V.flagLean[i] = (r - (q - 1) / 2) * F.flagLeanCells; V.flagMir[i] = r < (q - 1) / 2 ? 1 : 0; V.flagLift[i] = q > 2 && r > 0 && r < q - 1 ? 1 : 0; });
    }
    return V;
  }
  // The target rims (bakes on a new flag set): each flagged section's inner rim in the glow colour, so the extent of what a
  // call eats is readable before the tap.
  function bakeTargets(V, game) {
    const B = V.B, s = V.cell, g = V.tgt.getContext("2d"), lw = Math.max(2, Math.round(s * V.fx.targetRim));
    g.clearRect(0, 0, V.tgt.width, V.tgt.height);
    for (let i = 0; i < V.flagN; i++) {
      const t = V.flagS[i];
      g.fillStyle = V.art.ink;
      for (let j = B.secStart[t]; j < B.secStart[t + 1]; j++) { const c = B.secCells[j], px = V.ox + (c % B.w) * s, py = V.oy + ((c / B.w) | 0) * s; for (let k = 0; k < 4; k++) { const e = B.nb[c * 4 + k]; if (!(e >= 0 && B.sec[e] === t)) edgeRect(g, k, px, py, s, lw + 2); } }
      g.fillStyle = V.art.glow;
      for (let j = B.secStart[t]; j < B.secStart[t + 1]; j++) { const c = B.secCells[j], px = V.ox + (c % B.w) * s, py = V.oy + ((c / B.w) | 0) * s; for (let k = 0; k < 4; k++) { const e = B.nb[c * 4 + k]; if (!(e >= 0 && B.sec[e] === t)) edgeRect(g, k, px, py, s, lw); } }
    }
    V.tgtVer = game.ver; V.tgtCell = s;
  }

  // Info tap (main.js): the walks from the camp to crew m's flagged wall (dots in the crew card's colour) and to the tapped
  // section s (cream dots), each ending in a ring on its contact tile. Info only: nothing in the game changes.
  function setInfo(V, game, m, s) { V.infoOn = true; V.infoM = m; V.infoS = s; V.infoVer = game.ver; V.infoCell = 0; }
  function clearInfo(V) { V.infoOn = false; }
  function bakeInfo(V, game) {
    const B = V.B, st = game.st, s = V.cell, g = V.info.getContext("2d"), A = V.art, z = Math.max(Math.round(V.fx.pathDotCss * V.dpr), Math.round(s * V.fx.pathDot));
    g.clearRect(0, 0, V.info.width, V.info.height);
    const t = st.target[V.infoM];
    for (let pass = 0; pass < 2; pass++) {
      const q = pass ? t : V.infoS === t ? -1 : V.infoS; if (q < 0 || !st.reach[q]) continue;
      const col = pass ? A.flagFill[V.infoM] : A.badge[0], off = pass ? -Math.round(z * 0.35) : Math.round(z * 0.35);
      for (let c = st.ground[q], guard = 0; c >= 0 && guard < B.n; guard++) {
        const cx = Math.round(V.ox + ((c % B.w) + 0.5) * s) + off, cy = Math.round(V.oy + (((c / B.w) | 0) + 0.5) * s) + off;
        g.fillStyle = A.ink; g.fillRect(cx - (z >> 1) - 1, cy - (z >> 1) - 1, z + 2, z + 2); g.fillStyle = col; g.fillRect(cx - (z >> 1), cy - (z >> 1), z, z);
        if (st.dist[c] <= 0) break;
        let nx = -1; for (let k = 0; k < 4; k++) { const e = B.nb[c * 4 + k]; if (e >= 0 && st.conn[e] && st.dist[e] === st.dist[c] - 1 && (nx < 0 || e < nx)) nx = e; }
        c = nx;
      }
      const ct = st.contact[q], rx = V.ox + ((ct % B.w) + 0.5) * s, ry = V.oy + (((ct / B.w) | 0) + 0.5) * s;
      g.lineWidth = Math.max(3, z * 0.7); g.strokeStyle = A.ink; g.beginPath(); g.arc(rx, ry, s * 0.42, 0, TAU); g.stroke();
      g.lineWidth = Math.max(2, z * 0.45); g.strokeStyle = col; g.stroke();
    }
    V.infoCell = s;
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
  // Cell c pops at time t (its own time on the sim clock): chunky rubble of material m sprayed away from the contact tile
  // c0 (chunks at least config.fx.chunkMinCss CSS px, so they read on small cells), hopping, landing and settling, plus
  // puffs of dust that swell as they fade.
  function popCell(V, c, m, t, c0) {
    const B = V.B, D = V.dust, N = D.x.length, F = V.fx, cell = V.cell, ap = cell / V.bp, x0 = V.ox + (c % B.w) * cell, y0 = V.oy + ((c / B.w) | 0) * cell;
    const sp = (F.chunkSpeed * cell) / 1000, up = (F.chunkUp * cell) / 1000, gr = (F.chunkGravity * cell) / 1e6, zMin = Math.round(F.chunkMinCss * V.dpr);
    let dx = (c % B.w) - (c0 % B.w), dy = ((c / B.w) | 0) - ((c0 / B.w) | 0);
    const dl = Math.sqrt(dx * dx + dy * dy) || 1; dx /= dl; dy /= dl;
    for (let k = 0; k < F.chunkPerTile; k++) {
      const j = D.head; D.head = (D.head + 1) % N;
      const r1 = rnd(D), r2 = rnd(D), r3 = rnd(D), size = Math.max(zMin, Math.round(ap * F.chunkArt * (1 + 0.6 * r3)));
      D.kind[j] = 1; D.mat[j] = m; D.size[j] = size; D.t0[j] = t; D.life[j] = F.chunkMs;
      D.x[j] = x0 + r1 * (cell - size); D.y[j] = y0 + r2 * cell * 0.5;
      D.vx[j] = (r1 - 0.5) * 2 * sp + dx * sp * F.chunkSpray; D.vy[j] = -(0.5 + r3) * up + dy * sp * F.chunkSpray * 0.4;
      const fl = y0 + cell * (0.55 + 0.45 * r2) - size + dy * cell * 0.3, dz = fl - D.y[j], vy = D.vy[j];
      D.floor[j] = fl; D.tLand[j] = (-vy + Math.sqrt(Math.max(0, vy * vy + 4 * gr * dz))) / (2 * gr);
    }
    const dsp = (F.dustSpeed * cell) / 1000, dMin = Math.round(F.dustMinCss * V.dpr);
    for (let k = 0; k < F.dustPerTile; k++) {
      const j = D.head; D.head = (D.head + 1) % N;
      const r1 = rnd(D), r2 = rnd(D), r3 = rnd(D);
      D.kind[j] = 0; D.mat[j] = m; D.t0[j] = t; D.life[j] = F.dustMs * (0.7 + 0.3 * r3);
      D.x[j] = x0 + r1 * cell; D.y[j] = y0 + (0.3 + 0.6 * r2) * cell; D.vx[j] = (r1 - 0.5) * 2 * dsp + dx * dsp; D.vy[j] = -(0.3 + r3) * dsp;
      D.size[j] = Math.max(dMin, Math.round(ap * (F.dustArt + r3)));
    }
    V.dustUntil = Math.max(V.dustUntil, t + Math.max(F.chunkMs, F.dustMs));
  }
  // Ring r of the show's eat pops at t: every cell in it.
  function popRing(V, S, r, t) { const c0 = S.cells[0]; for (let i = S.ringStart[r]; i < S.ringStart[r + 1]; i++) { const c = S.cells[i]; popCell(V, c, V.B.mat[c], t, c0); } }
  // The keep opens: confetti in the materials' and the flag's colours bursts up from it across the whole board, and more
  // rains down from the top edge; speeds are in board heights, so the payoff is the same size on any board.
  function confetti(V, S, t) {
    const C = V.conf, F = V.fx, cell = V.cell, n = C.x.length, D = V.dust, H = V.canvas.height, W = V.canvas.width, sp = (F.confettiBoard * H) / 1000;
    const cx = V.ox + V.kcx * cell, cy = V.oy + (V.kcy - 0.3) * cell, half = n >> 1;
    for (let k = 0; k < n; k++) {
      if (k < half) {
        const a = -Math.PI / 2 + (rnd(D) - 0.5) * F.confettiSpread, v = sp * (0.45 + 0.75 * rnd(D));
        C.x[k] = cx; C.y[k] = cy; C.vx[k] = Math.cos(a) * v; C.vy[k] = Math.sin(a) * v; C.gz[k] = 1;
      } else { C.x[k] = rnd(D) * W; C.y[k] = -rnd(D) * H * 0.35; C.vx[k] = (rnd(D) - 0.5) * sp * 0.1; C.vy[k] = sp * (0.18 + 0.16 * rnd(D)); C.gz[k] = 0.25; }
      C.spin[k] = 0.006 + 0.02 * rnd(D); C.col[k] = (rnd(D) * V.art.confetti.length) | 0;
    }
    C.t0 = t; V.dustUntil = Math.max(V.dustUntil, t + F.confettiMs);
  }

  function fillSection(V, g, q) {
    const B = V.B, s = V.cell;
    for (let i = B.secStart[q]; i < B.secStart[q + 1]; i++) { const c = B.secCells[i]; g.fillRect(V.ox + (c % B.w) * s, V.oy + ((c / B.w) | 0) * s, s, s); }
  }

  // The stepped idle animations (moat waves, flag ripples, lever glints, the camp's idle bob): the step each is on now.
  function waveStep(V, now) { return Math.floor(now / V.fx.flagWaveMs); }
  function glintStep(V, now) { const F = V.fx, p = now % F.leverGlintMs; return p < F.leverGlintOnMs ? Math.floor(now / F.leverGlintMs) * 4 + 1 + Math.floor((p * 3) / F.leverGlintOnMs) : -1; }
  function bobStep(V, now) { return Math.floor(now / V.fx.campBobMs); }
  // True while anything on the board is moving (the page keeps drawing frames until it settles).
  function busy(V, game, now, S) {
    const f = game.fx, F = V.fx;
    if ((S && (S.active || (S.won && !S.skipped))) || now < V.dustUntil) return true;
    if (V.moatOv.length && Math.floor(now / F.moatFrameMs) % 4 !== V.moatDrawn) return true;
    if (V.flagN && !game.st.won && waveStep(V, now) !== V.waveDrawn) return true;
    if (V.B.levers.length && glintStep(V, now) !== V.glintDrawn) return true;
    if (V.campN && bobStep(V, now) !== V.bobDrawn) return true;
    if (game.aim >= 0 && !game.st.won) return true;
    if (now < V.flagT0 + F.flagPopMs) return true;
    if (now - f.pulseT < F.pulseMs || now - f.shakeT < F.shakeMs || now - f.flashT < F.flashMs) return true;
    return false;
  }

  // A sheet frame at (x, y) in cell units, feet on the cell's lower edge, optionally mirrored and scaled (sc).
  function drawSprite(V, g, who, frame, x, y, flip, alpha, sc) {
    const F = V.frameT[who], s = V.cell, sheet = V.sheetT[who], z = sc ? Math.round(F * sc) : F;
    const dx = Math.round(V.ox + (x + 0.5) * s - z / 2), dy = Math.round(V.oy + (y + 1) * s - z * 0.98);
    g.globalAlpha = alpha;
    if (flip) { g.setTransform(-1, 0, 0, 1, dx + z, dy); g.drawImage(sheet, frame * F, 0, F, F, 0, 0, z, z); g.setTransform(1, 0, 0, 1, 0, 0); }
    else g.drawImage(sheet, frame * F, 0, F, F, dx, dy, z, z);
    g.globalAlpha = 1;
  }

  // The show's picture patches on top of the (already final) layer, drawn from the prev layer where the picture hasn't
  // changed yet for the player: the lit crossfade, the trail, blocks not yet eaten or popping, doors, levers, chests, keep.
  function drawShow(V, g, S, now) {
    const B = V.B, s = V.cell, T = V.tiles, sh = V.sh, F = V.fx, k = S.k, popMs = sh.popMs * k, doorMs = sh.doorMs * k, ox = V.ox, oy = V.oy, P0 = V.prev, w = B.w, ap = s / V.bp;
    if (V.prevId !== S.id || V.prevCell !== s) bakePrev(V, S);
    // ground this call connected comes out of shade (a crossfade from the prev picture)
    const la = Math.max(0, Math.min(1, 1 - (now - S.lightAt) / S.lightMs));
    if (la > 0) { g.globalAlpha = la; for (let i = 0; i < S.litN; i++) { const c = S.lit[i], px = ox + (c % w) * s, py = oy + ((c / w) | 0) * s; g.drawImage(P0, px, py, s, s, px, py, s, s); } g.globalAlpha = 1; }
    // the trail: faint footprints on the path the crew has walked, fading once the wall is down
    const P = S.pos;
    const au = Math.max(1, Math.round(ap)), crack = S.crackMs;
    const ta = now < S.crumbleEnd ? 1 : Math.max(0, 1 - (now - S.crumbleEnd) / Math.max(1, S.trailEnd - S.crumbleEnd));
    if (ta > 0 && S.pathN > 1) {
      const z = Math.max(2, Math.round(s * F.trailDot)), upto = now < S.walkT1 ? P.i + 1 : S.pathN;
      g.globalAlpha = F.trailAlpha * ta;
      for (let k2 = 0; k2 < 2; k2++) { // an ink shadow, then the pale print on top, so prints never read as rubble
        const d = k2 ? 0 : au; g.fillStyle = k2 ? V.art.footprint : V.art.ink;
        for (let i = 0; i < upto && i < S.pathN - 1; i++) { const x = Math.round(ox + (S.px[i] + 0.5) * s) + d, y = Math.round(oy + (S.py[i] + 0.5) * s) + d; g.fillRect(x - z - 1, y - (z >> 1), z, z); g.fillRect(x + 1, y + (z >> 1) - 1, z, z); }
      }
      g.globalAlpha = 1;
    }
    // blocks not yet eaten stand as they were until the wave reaches them (the last crackMs before its pop a block shudders
    // and cracks); a popping block swells to config.fx.popSwell with a white flash, then shrinks away while its rubble
    // flies; doors swing open on their left hinge
    const sw = F.popSwell;
    for (let i = 0; i < S.cellsN; i++) {
      const c = S.cells[i], at = S.popAt[c], px = ox + (c % w) * s, py = oy + ((c / w) | 0) * s;
      if (now < at) {
        const ck = !S.isDoor[c] && now >= S.popT0 && now >= at - crack, jx = ck ? ((((now / 45) | 0) + c) & 1 ? au : -au) : 0;
        g.drawImage(P0, px, py, s, s, px + jx, py, s, s);
        if (ck) { g.globalAlpha = Math.min(1, 0.35 + (now - (at - crack)) / crack); g.drawImage(T.X, px + jx, py); g.globalAlpha = 1; }
      } else if (S.isDoor[c] ? now < at + doorMs : now < at + popMs) {
        if (S.isDoor[c]) { const p = (now - at) / doorMs, ww = Math.max(1, Math.round(s * (1 - p))); g.globalAlpha = 1 - p * 0.5; g.drawImage(P0, px, py, s, s, px, py, ww, s); g.globalAlpha = 1; }
        else {
          const p = (now - at) / popMs, z = Math.max(1, Math.round(s * (p < 0.3 ? 1 + ((sw - 1) * p) / 0.3 : sw * (1 - (p - 0.3) / 0.7)))), zx = px + ((s - z) >> 1), zy = py + ((s - z) >> 1);
          g.drawImage(P0, px, py, s, s, zx, zy, z, z);
          if (p < 0.5) { g.globalAlpha = 0.85 * (1 - p / 0.5); g.fillStyle = V.art.cloud; g.fillRect(zx, zy, z, z); g.globalAlpha = 1; }
        }
      }
    }
    // levers: as they were until halfway through their swing (the big sprite overhangs its block)
    for (let i = 0; i < B.levers.length; i++) {
      const at = S.leverAt[i]; if (at >= INF || now >= at + (sh.leverMs * k) / 2) continue;
      const c = B.levers[i], px = Math.round(ox + (c % w) * s - 3 * ap), py = Math.round(oy + ((c / w) | 0) * s - 4 * ap), z = Math.round(14 * ap), jy = now >= at ? -au : 0;
      g.drawImage(P0, px, py, z, z, px, py + jy, z, z);
    }
    // chests: shut (with their chip) until the light reaches them, then the open chest swells with a hop
    for (let i = 0; i < B.chestCell.length; i++) {
      const at = S.chestAt[i]; if (at >= INF || now >= at + sh.chestPopMs * k) continue;
      const c = B.chestCell[i], px = Math.round(ox + (c % w) * s - 2 * ap), py = Math.round(oy + ((c / w) | 0) * s - ap), cw = Math.round(12 * ap), ch = Math.round(10 * ap);
      if (now < at) {
        const x0 = Math.min(px, chipX(V, i)), y0 = chipY(V, i), x1 = Math.max(px + cw, chipX(V, i) + V.chipT[0].width), y1 = py + ch;
        g.drawImage(P0, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      } else { const p = (now - at) / (sh.chestPopMs * k), z = 1 + 0.3 * Math.sin(p * Math.PI), zw = Math.round(cw * z), zh = Math.round(ch * z); g.drawImage(V.layer, px, py, cw, ch, px + ((cw - zw) >> 1), py + ch - zh - Math.round(s * 0.25 * Math.sin(p * Math.PI)), zw, zh); }
    }
    // the keep stays shut until its moment
    if (S.won && now < S.keepAt) { const kx = ox + V.I.kx0 * s, ky = oy + V.I.ky0 * s, kw = (V.I.kx1 - V.I.kx0 + 1) * s, kh = (V.I.ky1 - V.I.ky0 + 1) * s; g.drawImage(P0, kx, ky, kw, kh, kx, ky, kw, kh); }
  }
  // The show's actors: the crew walking out and working at the wall, and its helpers (show.js) chewing along the wave
  // front, one cell of each ring apiece, then fading as the crew heads home.
  function drawActors(V, g, S, now) {
    const P = S.pos, B = V.B, w = B.w;
    if (P.on) drawSprite(V, g, S.m, P.frame, P.x, P.y, P.flip, P.alpha, 0);
    if (!S.hN || now < S.ringAt[0] || now >= S.crewOut) return;
    let r = 0; while (r + 1 < S.rings && S.ringAt[r + 1] <= now) r++;
    const fr = r + 1 < S.rings ? Math.max(0, Math.min(1, (now - S.ringAt[r]) / Math.max(1, S.ringAt[r + 1] - S.ringAt[r]))) : 0;
    const out = now > S.crumbleEnd ? Math.max(0, 1 - (now - S.crumbleEnd) / Math.max(1, S.crewOut - S.crumbleEnd)) : Math.min(1, (now - S.ringAt[0]) / 80);
    for (let h = 0; h < S.hN; h++) {
      const last = S.hLast[h], ra = Math.min(r, last), rb = Math.min(r + 1, last), ca = S.hc[h * S.hStride + ra], cb = S.hc[h * S.hStride + rb], u = ra === rb ? 0 : fr;
      const ax = ca % w, ay = (ca / w) | 0, bx = cb % w, by = (cb / w) | 0;
      drawSprite(V, g, S.m, 4 + ((Math.floor(now / 90) + h) & 1), ax + (bx - ax) * u, ay + (by - ay) * u - 0.1, bx < ax || (bx === ax && (h & 1) === 1), out, V.fx.helperScale);
    }
  }
  // The idle crews at the camp: one per crew the level uses, dimmed when none are left, away while that crew walks out;
  // each bobs one art pixel on its own beat.
  function drawCamp(V, g, game, now, S) {
    const st = game.st, F = V.fx, bob = bobStep(V, now), lift = 1 / V.bp;
    V.bobDrawn = bob;
    for (let i = 0; i < V.campN; i++) {
      const m = V.campM[i];
      if (S && S.active && S.m === m && now >= S.walkT0 && now < S.crewOut) continue;
      drawSprite(V, g, m, 0, V.campX[i], V.campY[i] - ((bob + i) & 1 ? lift : 0), V.campFlip[i] === 1, st.remaining[m] > 0 ? 1 : F.campDimAlpha, 0);
    }
  }
  // Unthrown levers glint: a four-point sparkle on the knob, a few frames in every leverGlintMs, staggered per lever.
  function drawGlints(V, g, game, now) {
    const B = V.B, s = V.cell, ap = s / V.bp, st = game.st, gs = glintStep(V, now);
    V.glintDrawn = gs;
    if (gs < 0) return;
    const u = Math.max(1, Math.round(ap * 0.7)), k = (gs & 3) === 2 ? 2 : 1;
    g.fillStyle = V.art.cloud;
    for (let i = 0; i < B.levers.length; i++) {
      if (st.thrown[i]) continue;
      const c = B.levers[i], gx = Math.round(V.ox + (c % B.w) * s - 0.3 * ap), gy = Math.round(V.oy + ((c / B.w) | 0) * s - 1.8 * ap);
      g.fillRect(gx - u * k, gy, u * (2 * k + 1), u); g.fillRect(gx, gy - u * k, u, u * (2 * k + 1));
    }
  }

  // The flags, popping in (a small overshoot about the foot) once the light of the last call is out, the banners rippling
  // on config.fx.flagWaveMs; the target rims fade in with them.
  function drawFlags(V, g, game, now, S) {
    flags(V, game);
    V.waveDrawn = waveStep(V, now);
    if (game.st.won || !V.flagN) return;
    const F = V.fx, s = V.cell, k = V.flagK, BW = V.banW, BH = V.banH, A = V.art, pw = 2 * k;
    let t0 = V.flagT0;
    if (V.flagDrawnVer !== game.ver) { V.flagDrawnVer = game.ver; V.flagT0 = t0 = S && S.active ? S.lightAt : now - F.flagPopMs; }
    if (now < t0) return;
    const p = Math.min(1, (now - t0) / F.flagPopMs), z = p < 1 ? Math.min(1.15, 0.4 + 1.1 * p) - Math.max(0, p - 0.6) * 0.375 : 1;
    if (V.tgtVer !== game.ver || V.tgtCell !== s) bakeTargets(V, game);
    g.globalAlpha = F.targetRimAlpha * p * (V.waveDrawn % 3 === 1 ? 1 : 0.8); g.drawImage(V.tgt, 0, 0); g.globalAlpha = 1;
    for (let i = 0; i < V.flagN; i++) {
      const m = V.flagM[i], fx = Math.round(V.ox + (V.flagX[i] + 0.5) * s), fy = Math.round(V.oy + (V.flagY[i] + 0.8) * s);
      const L = Math.max(BH * 0.5, s * F.flagPole) + V.flagLift[i] * (BH + 2 * k);
      const tx = Math.round(fx + V.flagLean[i] * s), ty = Math.max(2 * k, Math.round(fy - L - BH)), mir = V.flagMir[i] === 1;
      g.setTransform(z, 0, 0, z, fx * (1 - z), fy * (1 - z));
      // the pole (ink outline, then wood), upright or leaning, and a gold finial
      if (tx === fx) { g.fillStyle = A.ink; g.fillRect(fx - k - 1, ty - k, pw + 2, fy - ty + k); g.fillStyle = A.flagPole; g.fillRect(fx - k, ty - k + 1, pw, fy - ty + k - 1); }
      else {
        g.lineCap = "butt"; g.beginPath(); g.moveTo(fx, fy); g.lineTo(tx, ty - k);
        g.strokeStyle = A.ink; g.lineWidth = pw + 2; g.stroke(); g.strokeStyle = A.flagPole; g.lineWidth = pw; g.stroke();
      }
      g.fillStyle = A.ink; g.fillRect(tx - k - 1, ty - 3 * k - 1, pw + 2, pw + 2); g.fillStyle = A.chest[2]; g.fillRect(tx - k, ty - 3 * k, pw, pw);
      // the banner, rippling (each flag on its own phase), mirrored for the left of a fanned pair
      const ban = V.banT[m * 3 + ((V.waveDrawn + i) % 3)], bx = mir ? tx - k - BW : tx + k;
      if (mir) { g.setTransform(-z, 0, 0, z, z * (bx + BW - fx) + fx, fy * (1 - z)); g.drawImage(ban, 0, ty); }
      else g.drawImage(ban, bx, ty);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  function draw(V, game, now, S) {
    if (!V.B || !V.cell) return;
    const g = V.g, B = V.B, s = V.cell, F = V.fx, f = game.fx, A = V.art, st = game.st;
    let base = V.layer;
    if (V.layerVer !== game.ver || V.layerCell !== s) {
      // spread a call's work over two frames: while its show is still walking, the first frame shows the prev picture
      // (the same pixels until the first block pops) and the new picture is baked on the next
      if (S && S.active && V.prevId === S.id && V.prevCell === s && !V.deferred && now < S.ringAt[0] - F.maxDtMs) { base = V.prev; V.deferred = true; V.deferrals++; }
      else { bakeLayer(V, game); V.deferred = false; }
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.imageSmoothingEnabled = false;
    g.drawImage(base, 0, 0);
    // moat: the current wave frame (frame 0 is baked in the layer)
    const mf = Math.floor(now / F.moatFrameMs) % 4; V.moatDrawn = mf;
    if (mf && V.moatOv.length) g.drawImage(V.moatOv[mf], V.ox - s, V.oy - s, (V.T.PW / V.bp) * s, (V.T.PH / V.bp) * s);
    // an info tap's walks (until the next tap)
    if (V.infoOn && V.infoVer === game.ver && !st.won) { if (V.infoCell !== s) bakeInfo(V, game); g.drawImage(V.info, 0, 0); }
    if (S && S.active) Show.crewAt(S, now, S.pos);
    if (S && S.active && base === V.layer) drawShow(V, g, S, now);
    drawCamp(V, g, game, now, S);
    if (S && S.active) drawActors(V, g, S, now);
    if (B.levers.length) drawGlints(V, g, game, now); else V.glintDrawn = -1;
    drawFlags(V, g, game, now, S);
    // the keep opens with a punch (it swells and settles), then the big crowned goblin taunts (bouncing, the crown
    // glinting) and is marched out toward the camp
    const kx = V.ox + V.I.kx0 * s, ky = V.oy + V.I.ky0 * s, kw = (V.I.kx1 - V.I.kx0 + 1) * s, kh = (V.I.ky1 - V.I.ky0 + 1) * s;
    let t = S ? now - S.keepAt : -1;
    // a flash of the whole board as the keep opens
    if (S && S.won && !S.skipped && t >= 0 && t < F.boardFlashMs) { g.globalAlpha = F.boardFlashAlpha * (1 - t / F.boardFlashMs); g.fillStyle = A.cloud; g.fillRect(0, 0, V.canvas.width, V.canvas.height); g.globalAlpha = 1; }
    if (S && S.won && !S.skipped && t >= 0 && t < F.keepPunchMs) {
      const z = 1 + F.keepPunch * Math.sin((t / F.keepPunchMs) * Math.PI), zw = Math.round(kw * z), zh = Math.round(kh * z);
      g.drawImage(V.layer, kx, ky, kw, kh, kx + ((kw - zw) >> 1), ky + ((kh - zh) >> 1), zw, zh);
    }
    // keep burst: a flash, then two rings of thick rays turning outward, sized in CSS px (config.fx.raysMinCss) so the
    // payoff is as big on a 14 px cell as on a 30 px one
    t = S ? now - S.keepAt : -1;
    if (S && S.won && !S.skipped && t >= 0 && t < F.keepBurstMs) {
      const p = t / F.keepBurstMs, cx = V.ox + V.kcx * s, cy = V.oy + V.kcy * s, kr = Math.max(kw, kh) / 2, reach = Math.max(F.raysMinCss * V.dpr, s * F.raysR), R = kr + reach * Math.sqrt(p), n = F.raysN;
      const lw = Math.max(F.rayWCss * V.dpr, s * 0.3);
      if (p < 0.2) { g.globalAlpha = 0.75 * (1 - p / 0.2); g.fillStyle = A.cloud; g.beginPath(); g.arc(cx, cy, kr + reach * 0.5 * (0.4 + 3 * p), 0, TAU); g.fill(); }
      g.lineCap = "butt";
      for (let ring = 0; ring < 2; ring++) {
        g.globalAlpha = (1 - p) * (ring ? 0.8 : 1); g.strokeStyle = ring ? A.cloud : A.burst; g.lineWidth = ring ? lw * 0.5 : lw; g.beginPath();
        for (let k = 0; k < n; k++) { const a = ((k + ring * 0.5) / n) * TAU + p * 0.8, r0 = R * (ring ? 0.55 : 0.4), r1 = R * (ring ? 0.85 : 1); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); }
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    if (S && S.won) {
      const P = Show.goblinAt(S, now, S.pos);
      if (P.on) {
        const lift = P.frame >= 4 ? F.goblinBounce * Math.abs(Math.sin((now / F.goblinBounceMs) * Math.PI)) * (V.frameT[4] / s / 3) : 0;
        drawSprite(V, g, 4, P.frame, P.x, P.y - lift, P.flip, 1, 0);
        const gp = now % F.glintMs;
        if (gp < F.glintOnMs) { // a four-point glint on the crown
          const fg = V.frameT[4], u = Math.max(1, Math.round(fg / 16)), gx = Math.round(V.ox + (P.x + 0.5) * s - fg / 2 + fg * (P.flip ? 7 : 8) / 16), gy = Math.round(V.oy + (P.y - lift + 1) * s - fg * 0.98 + fg * 1.5 / 16), k = gp < F.glintOnMs / 2 ? 2 : 1;
          g.fillStyle = A.cloud; g.fillRect(gx - u * k, gy, u * (2 * k + 1), u); g.fillRect(gx, gy - u * k, u, u * (2 * k + 1));
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
    // confetti: flipping pixel flakes that burst from the keep and rain from the top, at least confettiMinCss CSS px
    const C = V.conf, ca = now - C.t0;
    if (ca >= 0 && ca < F.confettiMs) {
      const H = V.canvas.height, cg = (F.confettiGravBoard * H) / 1e6, cz = Math.max(Math.round(F.confettiMinCss * V.dpr), Math.round(s * 0.2)), pal = A.confetti;
      g.globalAlpha = Math.min(1, 3 * (1 - ca / F.confettiMs));
      for (let k = 0; k < C.x.length; k++) {
        const w = Math.max(1, Math.round(cz * Math.abs(Math.cos(C.spin[k] * ca)))), drag = 1 - Math.min(0.5, ca / 4000);
        g.fillStyle = pal[C.col[k]]; g.fillRect(Math.round(C.x[k] + C.vx[k] * ca * drag - w / 2), Math.round(C.y[k] + C.vy[k] * ca * drag + cg * C.gz[k] * ca * ca), w, cz);
      }
      g.globalAlpha = 1;
    }
    // dust puffs drift, swell and fade; rubble chunks (material face, dark underside) hop, land, sit, then fade
    const D = V.dust, dg = (F.dustGravity * s) / 1e6, kg = (F.chunkGravity * s) / 1e6;
    for (let j = 0; j < D.x.length; j++) {
      const a = now - D.t0[j], life = D.life[j];
      if (a < 0 || a >= life) continue;
      const M = A[MATS[D.mat[j]]], z = D.size[j];
      if (D.kind[j]) {
        const tl = D.tLand[j], ta = a < tl ? a : tl, x = Math.round(D.x[j] + D.vx[j] * ta), y = Math.round(a < tl ? D.y[j] + D.vy[j] * a + kg * a * a : D.floor[j]);
        g.globalAlpha = Math.min(1, 3.2 * (1 - a / life));
        g.fillStyle = A.ink; g.fillRect(x - 1, y - 1, z + 2, z + 2);
        g.fillStyle = M[3]; g.fillRect(x, y, z, z); g.fillStyle = (j & 1) ? M[2] : M[0]; g.fillRect(x, y, z, z - Math.max(1, (z / 3) | 0));
      } else {
        const zz = Math.round(z * (1 + (0.6 * a) / life));
        g.globalAlpha = 0.85 * (1 - a / life); g.fillStyle = (j & 1) ? M[2] : A.ground[2];
        g.fillRect(Math.round(D.x[j] + D.vx[j] * a - zz / 2), Math.round(D.y[j] + D.vy[j] * a + dg * a * a - zz / 2), zz, zz);
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
  // Which sprite caches read blank (an evicted backing store reads all zero): each chest chip at its icon plate, each
  // flag banner at its fill, each character sheet at a torso pixel of frame 0, the picture layer at its centre.
  function blankTiles(V) {
    const out = [], k = V.flagK;
    for (let m = 0; m < 4; m++) {
      const c = V.tiles["c" + m], f = V.tiles["f" + m];
      if (!c || alphaAt(c, 8 * k, 8 * k) < 255) out.push("c" + m);
      if (!f || alphaAt(f, 1.5 * k, 1.5 * k) < 255) out.push("f" + m);
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

  return { create, setLevel, fit, cellAt, cellCenter, icon, draw, busy, popRing, popCell, confetti, flags, adoptPrev, setInfo, clearInfo, blankTiles, check, dropCaches, pixelHash, rgbAt, MATS };
});
