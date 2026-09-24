// Peasant Swarm — fog of war (SPEC-v2 §5). Click it! Studios, 2026.
// Data (the truth): per team a Uint16 `vis` grid stamped with that team's stamp version (a cell is visible when vis[c] === ver[team], so it
// never needs clearing) and a Uint8 `explored` grid, both on the 32 px terrain cells. Sources: the team centroid (radius fog.sight0 +
// fog.sightK sqrt(n)) plus every occupied 64 px bucket (fog.bucketSight) that is not already inside the centroid disc; discs are cached
// row spans per radius. The player's stamps also mark a 16 px display grid (fog.displayPad cells of padding that are never marked, so
// the world edge stays dark) at radius + fog.exploreMargin and grow a dirty rect. The game calls stamp() from update() (player every
// fog.playerStampTicks ticks, AI teams one per tick), so PS.step and replays cover it.
// Render (caches): one mask canvas (one texel per display cell) re-put only for the dirty rect at most fog.maskHz, through one reused
// ImageData with a 3x3 tent blur; one quarter-CSS fog canvas recomposed every frame (mask subrect for the view, cloud drift, holes punched
// with destination-out from the player's stamp sources through one cached unit-space radial gradient, vignette, losing-clash glow) and
// blitted once, full screen, with smoothing on. Canvases are caches: recover() re-puts them from the typed arrays. No Math.random here.
(function () {
  const PS = (window.PS = window.PS || {});
  const now = () => performance.now();
  let CFG = null, N = 0, NN = 0, CELL = 32, DC = 16, DP = 8, DN = 0, DNN = 0, DW = 0, BK = 64, BN = 0, worldId = 0;
  let W = null; // the installed fog world (one per sim world: live, sandbox)
  const MAXSRC = 4100;
  const sp32 = new Map(), sp16 = new Map();
  // row spans of a disc of radius r px on cells of `cell` px (source at a cell centre): spans[dy + h] = half-width in cells. Cached per 4 px.
  function spans(cache, cell, r) {
    const k = Math.max(1, Math.round(r / 4)); let s = cache.get(k); if (s) return s;
    const rc = (k * 4) / cell, h = Math.floor(rc); s = new Int16Array(2 * h + 1);
    for (let dy = -h; dy <= h; dy++) s[dy + h] = Math.floor(Math.sqrt(Math.max(0, rc * rc - dy * dy)));
    cache.set(k, s); return s;
  }
  const hexRGB = (h) => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  function init(cfg) {
    CFG = cfg.fog; CELL = cfg.terrain.cell; N = Math.round(cfg.world.w / CELL); NN = N * N; DC = CFG.displayCell; DP = CFG.displayPad; DW = Math.round(cfg.world.w / DC);
    DN = DW + 2 * DP; DNN = DN * DN; BK = CFG.bucket; BN = Math.ceil(cfg.world.w / BK);
    const u = hexRGB(CFG.unexploredColor), e = hexRGB(CFG.exploredColor), aU = CFG.unexploredAlpha * 255, aE = CFG.exploredAlpha * 255;
    for (let s = 0; s <= 16; s++) { const k = s / 16; LA[s] = Math.round(aU + (aE - aU) * k); LR[s] = Math.round(u[0] + (e[0] - u[0]) * k); LG[s] = Math.round(u[1] + (e[1] - u[1]) * k); LB[s] = Math.round(u[2] + (e[2] - u[2]) * k); }
    UNEX = "rgba(" + u[0] + "," + u[1] + "," + u[2] + "," + CFG.unexploredAlpha + ")";
    return F;
  }

  // ---------------------------------------------------------------- world state (one per sim world; the game swaps it with S)
  // vis/explored per team slot (9, SPEC-v2 §6), disp: the player's display grid, dirty rects (display cells; mini: 32 px cells for the
  // minimap), src: the player's last stamp sources (x, y, r) with the centroid it was taken at, so the render can follow the swarm smoothly
  function world() {
    const w = { id: ++worldId, gen: 0, map: null, learn: false, vis: [], ver: new Int32Array(9), explored: [], nExp: new Int32Array(9), stamps: new Int32Array(9),
      disp: new Uint8Array(DNN), dx0: 0, dy0: 0, dx1: -1, dy1: -1, mx0: 0, my0: 0, mx1: -1, my1: -1,
      src: new Float32Array(3 * MAXSRC), srcN: 0, srcCx: 0, srcCy: 0, costMs: 0, lastCostMs: 0, maxCostMs: 0, stampN: 0 };
    for (let i = 0; i < 9; i++) { w.vis.push(new Uint16Array(NN)); w.explored.push(new Uint8Array(NN)); }
    return w;
  }
  // opts.learn: the player's newly explored cells feed PS.flow.learn (real matches); fixtures and benches keep their fixed knowledge
  function reset(w, map, opts) {
    w.map = map; w.learn = !!(opts && opts.learn); w.gen++; w.ver.fill(0); w.nExp.fill(0); w.stamps.fill(0); w.srcN = 0;
    for (let i = 0; i < 9; i++) { w.vis[i].fill(0); w.explored[i].fill(0); }
    w.disp.fill(0); w.dx0 = 0; w.dy0 = 0; w.dx1 = DN - 1; w.dy1 = DN - 1; w.mx0 = 0; w.my0 = 0; w.mx1 = N - 1; w.my1 = N - 1;
    w.costMs = 0; w.lastCostMs = 0; w.maxCostMs = 0; w.stampN = 0;
    return w;
  }
  function use(w) { W = w; return w; }

  // ---------------------------------------------------------------- stamping
  // one disc of radius r at (x, y) into team's vis (version v) and explored; the player also marks the display grid at radius rd and
  // (w.learn) tells the flow field about every newly explored cell it did not know
  function disc(w, team, v, x, y, r, rd, kn) {
    const vis = w.vis[team], ex = w.explored[team], isP = team === 1, sp = spans(sp32, CELL, r), h = (sp.length - 1) >> 1;
    let ci = (x / CELL) | 0, cj = (y / CELL) | 0; if (ci < 0) ci = 0; else if (ci >= N) ci = N - 1; if (cj < 0) cj = 0; else if (cj >= N) cj = N - 1;
    for (let dy = -h; dy <= h; dy++) {
      const j = cj + dy; if (j < 0 || j >= N) continue;
      const hx = sp[dy + h], i0 = ci - hx < 0 ? 0 : ci - hx, i1 = ci + hx >= N ? N - 1 : ci + hx, row = j * N;
      for (let i = i0; i <= i1; i++) {
        const c = row + i; vis[c] = v; if (ex[c]) continue;
        ex[c] = 1; w.nExp[team]++;
        if (isP) { if (kn && kn[c] === 0) PS.flow.learn(c); if (i < w.mx0) w.mx0 = i; if (i > w.mx1) w.mx1 = i; if (j < w.my0) w.my0 = j; if (j > w.my1) w.my1 = j; }
      }
    }
    if (!(rd > 0)) return;
    const s2 = spans(sp16, DC, rd), h2 = (s2.length - 1) >> 1, D = w.disp, ci2 = ((x / DC) | 0) + DP, cj2 = ((y / DC) | 0) + DP, lo = DP, hi = DP + DW - 1;
    for (let dy = -h2; dy <= h2; dy++) {
      const j = cj2 + dy; if (j < lo || j > hi) continue;
      const hx = s2[dy + h2], i0 = ci2 - hx < lo ? lo : ci2 - hx, i1 = ci2 + hx > hi ? hi : ci2 + hx, row = j * DN;
      for (let i = i0; i <= i1; i++) { if (D[row + i]) continue; D[row + i] = 1; if (i < w.dx0) w.dx0 = i; if (i > w.dx1) w.dx1 = i; if (j < w.dy0) w.dy0 = j; if (j > w.dy1) w.dy1 = j; }
    }
  }
  // stamp(team, cx, cy, R, list, off, nb, br, kn): the centroid disc plus each occupied bucket (list[off..off+nb), bucket index by * BN + bx)
  // whose disc is not inside the centroid disc. kn: the player's knowledge grid (PS.knowledge) when this world learns, else null.
  function stamp(team, cx, cy, R, list, off, nb, br, kn) {
    const w = W, t0 = now(), isP = team === 1, em = CFG.exploreMargin;
    let v = w.ver[team] + 1; if (v > 65535) { w.vis[team].fill(0); v = 1; } w.ver[team] = v;
    if (w.dx1 < 0) { w.dx0 = DN; w.dy0 = DN; } if (w.mx1 < 0) { w.mx0 = N; w.my0 = N; } // empty dirty rects start inverted
    if (isP) { w.srcN = 0; w.srcCx = cx; w.srcCy = cy; }
    disc(w, team, v, cx, cy, R, isP ? R + em : 0, isP && w.learn ? kn : null);
    const in2 = R - br;
    for (let k = 0; k < nb; k++) {
      const b = list[off + k], bx = ((b % BN) + 0.5) * BK, by = (((b / BN) | 0) + 0.5) * BK, dx = bx - cx, dy = by - cy;
      if (in2 >= 0 && dx * dx + dy * dy <= in2 * in2) continue; // inside the centroid disc: adds nothing to sight
      disc(w, team, v, bx, by, br, isP ? br + em : 0, isP && w.learn ? kn : null);
      if (isP && w.srcN < MAXSRC) { const q = 3 * w.srcN++; w.src[q] = bx; w.src[q + 1] = by; w.src[q + 2] = br; }
    }
    if (w.dx0 > w.dx1) { w.dx0 = 0; w.dy0 = 0; w.dx1 = -1; w.dy1 = -1; } if (w.mx0 > w.mx1) { w.mx0 = 0; w.my0 = 0; w.mx1 = -1; w.my1 = -1; }
    w.stamps[team]++; w.stampN++; const ms = now() - t0; w.lastCostMs = ms; w.costMs += ms; if (ms > w.maxCostMs) w.maxCostMs = ms;
  }
  const cellOf = (x, y) => (x >= 0 && y >= 0 && x < N * CELL && y < N * CELL ? ((y / CELL) | 0) * N + ((x / CELL) | 0) : -1);
  function sees(team, x, y) { const w = W; if (!w || !w.ver[team]) return false; const c = cellOf(x, y); return c >= 0 && w.vis[team][c] === w.ver[team]; }
  function seesCell(team, c) { const w = W; return !!w && w.ver[team] !== 0 && c >= 0 && w.vis[team][c] === w.ver[team]; }
  function explored(team, x, y) { const w = W; if (!w) return false; const c = cellOf(x, y); return c >= 0 && w.explored[team][c] === 1; }

  // ---------------------------------------------------------------- render caches: the display mask and the cloud texture
  const LA = new Uint8Array(17), LR = new Uint8Array(17), LG = new Uint8Array(17), LB = new Uint8Array(17); // tent sum (0..16 explored weight) -> RGBA
  let UNEX = "rgba(0,0,0,.92)", maskCv = null, maskCtx = null, maskImg = null, maskKey = "", lastUp = -1e9;
  const ST = { uploads: 0, forced: 0, upMs: 0, lastUpMs: 0, cells: 0 };
  function maskInit() {
    if (maskCv) return;
    maskCv = document.createElement("canvas"); maskCv.width = DN; maskCv.height = DN;
    maskCtx = maskCv.getContext("2d", { willReadFrequently: true }); maskImg = maskCtx.createImageData(DN, DN); // CPU-backed: drawn into the fog canvas every frame
  }
  // blur the display grid over [x0..x1] x [y0..y1] (3x3 tent, cells past the grid read unexplored) into the ImageData
  function blurRect(D, x0, y0, x1, y1) {
    const d = maskImg.data;
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      let s = 0;
      for (let v = -1; v <= 1; v++) { const jj = j + v; if (jj < 0 || jj >= DN) continue; const r = jj * DN, wv = v ? 1 : 2;
        if (i > 0 && D[r + i - 1]) s += wv; if (D[r + i]) s += 2 * wv; if (i < DN - 1 && D[r + i + 1]) s += wv; }
      const q = (j * DN + i) * 4; d[q] = LR[s]; d[q + 1] = LG[s]; d[q + 2] = LB[s]; d[q + 3] = LA[s];
    }
  }
  // flushMask(force): re-put the dirty rect (+1 for the blur) at most fog.maskHz; a new world or map (or force) re-puts all of it
  function flushMask(force) {
    const w = W; if (!w) return false; maskInit();
    const key = w.id + ":" + w.gen, full = force || key !== maskKey, t = now();
    if (!full && (w.dx1 < 0 || t - lastUp < 1000 / CFG.maskHz)) return false;
    let x0 = 0, y0 = 0, x1 = DN - 1, y1 = DN - 1;
    if (!full) { x0 = Math.max(0, w.dx0 - 1); y0 = Math.max(0, w.dy0 - 1); x1 = Math.min(DN - 1, w.dx1 + 1); y1 = Math.min(DN - 1, w.dy1 + 1); }
    blurRect(w.disp, x0, y0, x1, y1);
    maskCtx.putImageData(maskImg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    w.dx0 = 0; w.dy0 = 0; w.dx1 = -1; w.dy1 = -1; maskKey = key; lastUp = t;
    if (full) ST.forced++; else ST.uploads++; const ms = now() - t; ST.upMs += ms; ST.lastUpMs = ms; ST.cells += (x1 - x0 + 1) * (y1 - y0 + 1);
    return true;
  }
  // cloud texture: a tileable value-noise canvas (fog.cloudTexel world px per texel), kept as a typed array and re-put on recovery
  const CT = 32; let cloudCv = null, cloudImg = null, cloudPat = null;
  function cloudInit() {
    if (!cloudCv) { cloudCv = document.createElement("canvas"); cloudCv.width = CT; cloudCv.height = CT; }
    const g = cloudCv.getContext("2d");
    if (!cloudImg) {
      cloudImg = g.createImageData(CT, CT); const d = cloudImg.data, hs = (i, j, s) => { let h = (Math.imul(i & (s - 1), 374761393) + Math.imul(j & (s - 1), 668265263) + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
      const noise = (x, y, s) => { const fx = x * s / CT, fy = y * s / CT, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
        return (hs(i, j, s) * (1 - u) + hs(i + 1, j, s) * u) * (1 - v) + (hs(i, j + 1, s) * (1 - u) + hs(i + 1, j + 1, s) * u) * v; };
      for (let y = 0; y < CT; y++) for (let x = 0; x < CT; x++) { const n = 0.55 * noise(x, y, 4) + 0.3 * noise(x, y, 8) + 0.15 * noise(x, y, 16), a = Math.max(0, Math.min(1, (n - 0.42) * 2.6)), q = (y * CT + x) * 4;
        d[q] = 92; d[q + 1] = 106; d[q + 2] = 132; d[q + 3] = Math.round(255 * a * CFG.cloudAlpha); }
    }
    g.putImageData(cloudImg, 0, 0);
  }

  // ---------------------------------------------------------------- the fog canvas: composed every frame, one full-screen blit
  let fogCv = null, fc = null, fw = 0, fh = 0, cssW = 0, cssH = 0, vgGrad = null, glowGrad = null; const holeGrads = new Map();
  function resize(vw, vh) {
    maskInit(); cloudInit();
    if (!fogCv) { fogCv = document.createElement("canvas"); fc = fogCv.getContext("2d"); cloudPat = fc.createPattern(cloudCv, "repeat"); }
    const w = Math.max(1, Math.ceil(vw * CFG.canvasScale)), h = Math.max(1, Math.ceil(vh * CFG.canvasScale)); cssW = vw; cssH = vh;
    if (fogCv.width !== w || fogCv.height !== h) { fogCv.width = w; fogCv.height = h; } fw = w; fh = h; // the same canvas, reused (SPEC-v2 §10 iOS rule)
    const cx = fw / 2, cy = fh / 2;
    vgGrad = fc.createRadialGradient(cx, cy, Math.min(fw, fh) * CFG.vignetteInner, cx, cy, Math.max(fw, fh) * CFG.vignetteOuter);
    vgGrad.addColorStop(0, "rgba(10,20,8,0)"); vgGrad.addColorStop(1, "rgba(10,20,8," + CFG.vignetteAlpha + ")");
    glowGrad = fc.createRadialGradient(cx, cy, fh * CFG.glowInner, cx, cy, fh * CFG.glowOuter); glowGrad.addColorStop(0, "rgba(200,30,30,0)"); glowGrad.addColorStop(1, "rgba(200,30,30,1)");
  }
  // one unit-space radial gradient per soft-band fraction (quantised to 0.02): clear inside 1 - band, smoothstep out to the rim
  function holeGrad(band) {
    const q = Math.round(Math.min(0.9, Math.max(0.02, band)) * 50) / 50; let g = holeGrads.get(q); if (g) return g;
    g = fc.createRadialGradient(0, 0, 0, 0, 0, 1); const a = 1 - q; g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(a, "rgba(0,0,0,1)");
    for (let k = 1; k < 5; k++) { const t = k / 5; g.addColorStop(a + q * t, "rgba(0,0,0," + (1 - t * t * (3 - 2 * t)).toFixed(3) + ")"); }
    g.addColorStop(1, "rgba(0,0,0,0)"); holeGrads.set(q, g); return g;
  }
  // render(ctx, o): o = { vw, vh, dpr, camX, camY, zoom, t, fog, px, py, R, band, dawn, glow }. With o.fog false only the vignette and glow
  // are composed (title, fixtures, ?nofog=1). Holes: the centroid disc at the swarm's current centroid (px, py, R) and the stamp's bucket
  // sources moved by the same offset since the stamp, so the lit circle follows the swarm every frame between 20 Hz stamps.
  const RS = { holes: 0, maskDrawn: 0, margins: 0 };
  function render(ctx, o) {
    if (!fogCv || cssW !== o.vw || cssH !== o.vh) resize(o.vw, o.vh);
    const s = fw / o.vw, FS = o.zoom * s, FX0 = fw / 2 - o.camX * FS, FY0 = fh / 2 - o.camY * FS;
    fc.setTransform(1, 0, 0, 1, 0, 0); fc.globalAlpha = 1; fc.globalCompositeOperation = "source-over"; fc.imageSmoothingEnabled = true; fc.clearRect(0, 0, fw, fh);
    RS.holes = 0; RS.maskDrawn = 0; RS.margins = 0;
    if (o.fog && W) {
      flushMask(false);
      const fa = 1 - o.dawn, k = FS * DC, u0 = FX0 - DP * k, v0 = FY0 - DP * k;
      const ix0 = Math.max(0, Math.ceil(u0)), iy0 = Math.max(0, Math.ceil(v0)), ix1 = Math.min(fw, Math.floor(u0 + DN * k)), iy1 = Math.min(fh, Math.floor(v0 + DN * k));
      fc.globalAlpha = fa;
      if (ix1 > ix0 && iy1 > iy0) { fc.drawImage(maskCv, (ix0 - u0) / k, (iy0 - v0) / k, (ix1 - ix0) / k, (iy1 - iy0) / k, ix0, iy0, ix1 - ix0, iy1 - iy0); RS.maskDrawn = 1; }
      // past the padded mask (far outside the world): unexplored
      fc.fillStyle = UNEX;
      if (iy0 > 0) { fc.fillRect(0, 0, fw, iy0); RS.margins++; } if (iy1 < fh) { fc.fillRect(0, iy1, fw, fh - iy1); RS.margins++; }
      if (ix0 > 0 && iy1 > iy0) { fc.fillRect(0, iy0, ix0, iy1 - iy0); RS.margins++; } if (ix1 < fw && iy1 > iy0) { fc.fillRect(ix1, iy0, fw - ix1, iy1 - iy0); RS.margins++; }
      // slow cloud drift, world-anchored, only where the fog already is (source-atop keeps the fog's alpha)
      const ts = CFG.cloudTexel, tile = CT * ts, dx = (o.t * CFG.cloudSpeed) % tile, dy = (o.t * CFG.cloudSpeed * 0.37) % tile, ck = ts * FS, ox = FX0 + dx * FS, oy = FY0 + dy * FS;
      fc.globalCompositeOperation = "source-atop"; fc.globalAlpha = fa; fc.setTransform(ck, 0, 0, ck, ox, oy); fc.fillStyle = cloudPat; fc.fillRect(-ox / ck, -oy / ck, fw / ck, fh / ck);
      // holes
      if (o.R > 0) {
        fc.globalCompositeOperation = "destination-out"; fc.globalAlpha = 1; fc.fillStyle = holeGrad(o.band);
        const ddx = o.px - W.srcCx, ddy = o.py - W.srcCy;
        for (let q = -1; q < W.srcN; q++) {
          const x = q < 0 ? o.px : W.src[3 * q] + ddx, y = q < 0 ? o.py : W.src[3 * q + 1] + ddy, r = (q < 0 ? o.R : W.src[3 * q + 2]) * FS, hx = x * FS + FX0, hy = y * FS + FY0;
          if (hx + r < 0 || hy + r < 0 || hx - r > fw || hy - r > fh) continue;
          fc.setTransform(r, 0, 0, r, hx, hy); fc.fillRect(-1, -1, 2, 2); RS.holes++;
        }
      }
      fc.setTransform(1, 0, 0, 1, 0, 0);
    }
    fc.globalCompositeOperation = "source-over"; fc.globalAlpha = 1; fc.fillStyle = vgGrad; fc.fillRect(0, 0, fw, fh);
    if (o.glow > 0) { fc.globalAlpha = Math.min(1, o.glow); fc.fillStyle = glowGrad; fc.fillRect(0, 0, fw, fh); fc.globalAlpha = 1; }
    // the one full-screen alpha draw of the frame
    ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(fogCv, 0, 0, fw, fh, 0, 0, o.vw, o.vh); ctx.imageSmoothingEnabled = false;
  }

  // ---------------------------------------------------------------- cache recovery (studio lessons 27-29)
  function recover() { maskInit(); cloudInit(); if (W) flushMask(true); }
  function drop() { for (const c of [maskCv, cloudCv]) if (c) { const g = c.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); } return (maskCv ? 1 : 0) + (cloudCv ? 1 : 0); }
  // a 4x4 downscale through one scratch canvas (never read the cache itself): min alpha and summed alpha over the 16 samples
  let sc4 = null, sc4c = null;
  function read4(c) {
    if (!sc4) { sc4 = document.createElement("canvas"); sc4.width = 4; sc4.height = 4; sc4c = sc4.getContext("2d", { willReadFrequently: true }); }
    sc4c.imageSmoothingEnabled = true; sc4c.clearRect(0, 0, 4, 4); if (c) sc4c.drawImage(c, 0, 0, 4, 4); return sc4c.getImageData(0, 0, 4, 4).data;
  }
  function minAlpha4(c) { if (!c) return 0; const d = read4(c); let m = 255; for (let i = 3; i < 64; i += 4) if (d[i] < m) m = d[i]; return m; }
  function sumAlpha4(c) { if (!c) return 0; const d = read4(c); let s = 0; for (let i = 3; i < 64; i += 4) s += d[i]; return s; }
  // the mask re-read at 1:1 through a scratch copy: the alpha of display cell (i, j) in world cells (QA only)
  let scM = null, scMc = null;
  function maskAlphaAt(list) {
    if (!maskCv) return []; if (!scM) { scM = document.createElement("canvas"); scM.width = DN; scM.height = DN; scMc = scM.getContext("2d", { willReadFrequently: true }); }
    scMc.clearRect(0, 0, DN, DN); scMc.drawImage(maskCv, 0, 0); const d = scMc.getImageData(0, 0, DN, DN).data;
    return list.map(([x, y]) => { const i = ((x / DC) | 0) + DP, j = ((y / DC) | 0) + DP; return i >= 0 && j >= 0 && i < DN && j < DN ? d[(j * DN + i) * 4 + 3] : -1; });
  }
  function report() { return { mask: minAlpha4(maskCv), cloud: sumAlpha4(cloudCv) > 0, maskKey, fogW: fw, fogH: fh, cssW, cssH }; }
  // the expected mask alpha of a display cell from the typed arrays (QA): unexplored / explored after the blur
  function dispAt(x, y) { const w = W, i = ((x / DC) | 0) + DP, j = ((y / DC) | 0) + DP; if (!w || i < 1 || j < 1 || i >= DN - 1 || j >= DN - 1) return -1; let s = 0; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (w.disp[(j + v) * DN + i + u]) s += (v ? 1 : 2) * (u ? 1 : 2); return LA[s]; }

  function sig() { const w = W; if (!w) return null; return [Array.from(w.nExp), Array.from(w.stamps), Array.from(w.ver)].join("|"); }
  const F = (PS.fog = { init, world, reset, use, stamp, sees, seesCell, explored, cellOf, resize, render, flushMask, recover, drop, report, maskAlphaAt, dispAt, minAlpha4, sumAlpha4, sig, holeGrad,
    vis: (team) => (W ? W.vis[team] : null), verOf: (team) => (W ? W.ver[team] : 0), exploredArr: (team) => (W ? W.explored[team] : null), world0: () => W, RS, ST,
    get N() { return N; }, get BN() { return BN; }, get BK() { return BK; }, get fogSize() { return [fw, fh, cssW, cssH]; }, get maskCanvas() { return maskCv; }, get cloudCanvas() { return cloudCv; } });
})();
