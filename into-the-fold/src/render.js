// Into the Fold canvas renderer (SPEC §6). Placeholder art for M1, drawn in code: a cached static layer (field,
// grass, outer fence, rocks, mud, pond, pen floors and fences) plus, per frame, the pens' gates and ghost sheep,
// splash ripples and the sheep themselves. Sheep are cached sprites per colour. Per-frame work allocates nothing.
(function () {
  "use strict";
  const NS = (window.IntoTheFold = window.IntoTheFold || {});
  const R = NS.rules, Game = NS.game;
  const PAL = {
    field: "#7fb862", grassA: "#a6d882", grassB: "#9dd179", tuft: "#86c066",
    rail: "#9a6538", railHi: "#c48b57", post: "#6d4526",
    rock: "#9d9b92", rockHi: "#c6c4ba", rockLo: "#6e6c66",
    mud: "#8d6b44", mudLo: "#6c4f31", mudHi: "#a3825a",
    pond: "#5aa6d6", pondLo: "#3b83b5", pondHi: "#b4e2f7", ripple: "rgba(255,255,255,0.9)",
    floor: { w: "#f3e2ab", b: "#8a7c97" }, floorLo: { w: "#dcc68a", b: "#6d6079" },
    wool: { w: "#fcfaf2", b: "#3b3842" }, woolLine: { w: "#cfc7b5", b: "#1e1c22" },
    face: { w: "#3d332c", b: "#17151a" }, ear: { w: "#4a3e35", b: "#221f26" }, leg: "#2e2621", shadow: "rgba(25,45,15,0.22)",
  };
  // Pen edge corners (cell units) per open side, hinge first: N top edge, E right, S bottom, W left.
  const EDGE = [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0]];

  function create(canvas) {
    return { canvas, ctx: canvas.getContext("2d"), css: 0, dpr: 1, px: 0, B: null, layer: null, sprite: null, cell: 0, ox: 0, oy: 0,
      filled: null, P: { x: 0, y: 0, sq: 0, axis: 0, dunk: 0, ripple: -1 } };
  }

  // Square canvas of `css` CSS px at device ratio `dpr`. Invalidates the caches.
  function resize(V, css, dpr) {
    if (V.css === css && V.dpr === dpr) return;
    V.css = css; V.dpr = dpr; V.px = Math.max(1, Math.round(css * dpr));
    V.canvas.width = V.canvas.height = V.px;
    V.canvas.style.width = V.canvas.style.height = css + "px";
    V.B = null;
  }

  function offscreen(size) { const c = document.createElement("canvas"); c.width = c.height = Math.max(1, Math.ceil(size)); return c; }

  function geometry(V, B, cfg) {
    const f = cfg.board.fenceCells;
    V.cell = V.px / (Math.max(B.w, B.h) + 2 * f);
    V.ox = (V.px - B.w * V.cell) / 2; V.oy = (V.px - B.h * V.cell) / 2;
    V.filled = new Uint8Array(B.n);
    V.layer = buildLayer(V, B);
    const s = V.cell * cfg.board.sheepScale;
    V.sprite = { w: buildSheep("w", s), b: buildSheep("b", s), size: s };
    V.B = B;
  }

  // Deterministic per-cell noise for texture (no Math.random in art, so a redraw never shimmers).
  function hash(x, y, k) { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  function buildLayer(V, B) {
    const c = offscreen(V.px), x = c.getContext("2d"), s = V.cell, ox = V.ox, oy = V.oy;
    x.fillStyle = PAL.field; x.fillRect(0, 0, V.px, V.px);
    for (let cy = 0; cy < B.h; cy++) for (let cx = 0; cx < B.w; cx++) {
      x.fillStyle = (cx + cy) & 1 ? PAL.grassA : PAL.grassB;
      x.fillRect(ox + cx * s, oy + cy * s, s + 0.5, s + 0.5);
      x.strokeStyle = PAL.tuft; x.lineWidth = Math.max(1, s * 0.025); x.lineCap = "round";
      for (let k = 0; k < 3; k++) {
        const tx = ox + (cx + 0.15 + 0.7 * hash(cx, cy, k)) * s, ty = oy + (cy + 0.2 + 0.65 * hash(cy, cx, k + 7)) * s;
        x.beginPath(); x.moveTo(tx - s * 0.04, ty); x.lineTo(tx - s * 0.02, ty - s * 0.07); x.moveTo(tx + s * 0.02, ty); x.lineTo(tx + s * 0.04, ty - s * 0.06); x.stroke();
      }
    }
    for (let cy = 0; cy < B.h; cy++) for (let cx = 0; cx < B.w; cx++) {
      const t = B.type[cy * B.w + cx], px = ox + cx * s, py = oy + cy * s;
      if (t === R.ROCK) drawRock(x, px, py, s, cx, cy);
      else if (t === R.MUD) drawMud(x, px, py, s, cx, cy);
      else if (t === R.POND) drawPond(x, px, py, s);
    }
    for (const p of B.pens) drawPen(x, ox + p.x * s, oy + p.y * s, s, R.DIRS.indexOf(p.open), p.c);
    // Outer fence: two rails and posts round the pasture.
    const w = B.w * s, h = B.h * s, m = s * 0.12;
    for (let r = 0; r < 2; r++) {
      const e = m + r * s * 0.12;
      x.strokeStyle = PAL.rail; x.lineWidth = s * 0.07; x.strokeRect(ox - e, oy - e, w + 2 * e, h + 2 * e);
    }
    x.fillStyle = PAL.post;
    const pr = s * 0.07, pe = m + s * 0.06;
    for (let k = 0; k <= B.w; k++) { post(x, ox + k * s, oy - pe, pr); post(x, ox + k * s, oy + h + pe, pr); }
    for (let k = 1; k < B.h; k++) { post(x, ox - pe, oy + k * s, pr); post(x, ox + w + pe, oy + k * s, pr); }
    return c;
  }

  function post(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); }

  function blob(x, cx, cy, rx, ry) { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); }

  function drawRock(x, px, py, s, cx, cy) {
    const j = hash(cx, cy, 3) * 0.08;
    x.fillStyle = PAL.shadow; blob(x, px + s * 0.52, py + s * 0.72, s * 0.4, s * 0.14);
    x.fillStyle = PAL.rockLo; blob(x, px + s * 0.5, py + s * 0.56, s * (0.4 + j), s * 0.34);
    x.fillStyle = PAL.rock; blob(x, px + s * 0.48, py + s * 0.5, s * (0.37 + j), s * 0.31);
    x.fillStyle = PAL.rockHi; blob(x, px + s * 0.38, py + s * 0.38, s * 0.14, s * 0.08);
  }

  function drawMud(x, px, py, s, cx, cy) {
    x.fillStyle = PAL.mudLo; blob(x, px + s * 0.5, py + s * 0.53, s * 0.46, s * 0.42);
    x.fillStyle = PAL.mud; blob(x, px + s * 0.5, py + s * 0.5, s * 0.44, s * 0.4);
    x.fillStyle = PAL.mudLo;
    for (let k = 0; k < 4; k++) blob(x, px + s * (0.25 + 0.5 * hash(cx, cy, k)), py + s * (0.28 + 0.45 * hash(cy, cx, k + 3)), s * 0.06, s * 0.035);
    x.fillStyle = PAL.mudHi; blob(x, px + s * 0.36, py + s * 0.34, s * 0.08, s * 0.03);
  }

  function drawPond(x, px, py, s) {
    x.fillStyle = PAL.pondLo; blob(x, px + s * 0.5, py + s * 0.53, s * 0.47, s * 0.43);
    x.fillStyle = PAL.pond; blob(x, px + s * 0.5, py + s * 0.5, s * 0.45, s * 0.41);
    x.strokeStyle = PAL.pondHi; x.lineWidth = s * 0.035; x.lineCap = "round";
    x.beginPath(); x.arc(px + s * 0.42, py + s * 0.44, s * 0.2, Math.PI * 1.1, Math.PI * 1.55); x.stroke();
    x.beginPath(); x.arc(px + s * 0.6, py + s * 0.62, s * 0.12, Math.PI * 0.1, Math.PI * 0.5); x.stroke();
  }

  // Pen floor in its colour, fenced on the three closed sides; gateposts mark the open side.
  function drawPen(x, px, py, s, open, c) {
    const i = s * 0.07;
    x.fillStyle = PAL.floorLo[c]; x.fillRect(px + i, py + i, s - 2 * i, s - 2 * i);
    x.fillStyle = PAL.floor[c]; x.fillRect(px + i * 1.6, py + i * 1.6, s - 3.2 * i, s - 3.2 * i);
    x.lineCap = "round";
    for (let side = 0; side < 4; side++) {
      if (side === open) continue;
      const e = EDGE[side];
      x.strokeStyle = PAL.rail; x.lineWidth = s * 0.1;
      x.beginPath(); x.moveTo(px + e[0] * s + inset(e[0], i), py + e[1] * s + inset(e[1], i)); x.lineTo(px + e[2] * s + inset(e[2], i), py + e[3] * s + inset(e[3], i)); x.stroke();
      x.strokeStyle = PAL.railHi; x.lineWidth = s * 0.03;
      x.beginPath(); x.moveTo(px + e[0] * s + inset(e[0], i), py + e[1] * s + inset(e[1], i)); x.lineTo(px + e[2] * s + inset(e[2], i), py + e[3] * s + inset(e[3], i)); x.stroke();
    }
    x.fillStyle = PAL.post;
    for (let k = 0; k < 4; k++) post(x, px + (k & 1 ? s - i : i), py + (k & 2 ? s - i : i), s * 0.075);
  }

  function inset(v, i) { return v ? -i : i; }

  // A round wool puff with little legs, facing the viewer. Shadow included.
  function buildSheep(c, s) {
    const cv = offscreen(s), x = cv.getContext("2d"), m = cv.width / 2;
    x.fillStyle = PAL.shadow; blob(x, m, m + s * 0.33, s * 0.34, s * 0.1);
    x.fillStyle = PAL.leg;
    for (const lx of [-0.24, -0.1, 0.06, 0.2]) x.fillRect(m + lx * s, m + s * 0.14, s * 0.07, s * 0.2);
    const puffs = [[-0.2, 0.02, 0.17], [0.2, 0.02, 0.17], [-0.1, -0.13, 0.17], [0.1, -0.13, 0.17], [-0.1, 0.12, 0.16], [0.1, 0.12, 0.16], [0, -0.01, 0.22]];
    x.fillStyle = PAL.woolLine[c];
    for (const p of puffs) blob(x, m + p[0] * s, m + p[1] * s, p[2] * s + s * 0.025, p[2] * s + s * 0.025);
    x.fillStyle = PAL.wool[c];
    for (const p of puffs) blob(x, m + p[0] * s, m + p[1] * s, p[2] * s, p[2] * s);
    x.fillStyle = PAL.ear[c];
    x.beginPath(); x.ellipse(m - s * 0.15, m + s * 0.03, s * 0.08, s * 0.04, -0.5, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(m + s * 0.15, m + s * 0.03, s * 0.08, s * 0.04, 0.5, 0, Math.PI * 2); x.fill();
    x.fillStyle = PAL.face[c]; blob(x, m, m + s * 0.08, s * 0.11, s * 0.14);
    x.fillStyle = PAL.wool[c]; blob(x, m, m - s * 0.05, s * 0.09, s * 0.05);
    x.fillStyle = "#ffffff"; blob(x, m - s * 0.045, m + s * 0.06, s * 0.03, s * 0.03); blob(x, m + s * 0.045, m + s * 0.06, s * 0.03, s * 0.03);
    x.fillStyle = "#111111"; blob(x, m - s * 0.045, m + s * 0.065, s * 0.015, s * 0.015); blob(x, m + s * 0.045, m + s * 0.065, s * 0.015, s * 0.015);
    return cv;
  }

  function drawSprite(ctx, img, cx, cy, sx, sy, alpha) {
    ctx.globalAlpha = alpha;
    ctx.setTransform(sx, 0, 0, sy, cx, cy);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // Draw one frame of game g.
  function draw(V, g) {
    const B = g.B, cfg = g.cfg, ctx = V.ctx;
    if (V.B !== B) geometry(V, B, cfg);
    const s = V.cell, P = V.P, bump = Game.bumpPx(g) * V.dpr;
    const bx = bump ? R.DX[g.bump.dir] * bump : 0, by = bump ? R.DY[g.bump.dir] * bump : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAL.field; ctx.fillRect(0, 0, V.px, V.px);
    ctx.drawImage(V.layer, bx, by);
    const sheep = g.state.sheep, filled = V.filled;
    filled.fill(0);
    for (let i = 0; i < sheep.length; i++) if (sheep[i].penned) filled[sheep[i].y * B.w + sheep[i].x] = i + 1;
    // Pens: a ghost sheep in each empty one (its colour says who belongs there), a gate that swings shut on penning.
    for (let k = 0; k < B.pens.length; k++) {
      const p = B.pens[k], cell = p.y * B.w + p.x, px = V.ox + p.x * s + bx, py = V.oy + p.y * s + by;
      const who = filled[cell], shut = who ? Game.gateShut(g, who - 1) : 0;
      if (!who) drawSprite(ctx, V.sprite[p.c], px + s / 2, py + s / 2, 0.72, 0.72, cfg.board.ghostAlpha);
      drawGate(ctx, px, py, s, R.DIRS.indexOf(p.open), shut);
    }
    for (let i = 0; i < sheep.length; i++) {
      Game.pose(g, i, P);
      const cx = V.ox + (P.x + 0.5) * s + bx, cy = V.oy + (P.y + 0.5) * s + by;
      if (P.ripple >= 0) drawRipple(ctx, cx, cy, s, P.ripple);
      let k = sheep[i].penned && !Game.busy(g) ? cfg.board.pennedScale : 1, sx = k, sy = k;
      if (P.sq) { if (P.axis === 0) { sx = k * (1 - P.sq); sy = k * (1 + P.sq * 0.6); } else { sy = k * (1 - P.sq); sx = k * (1 + P.sq * 0.6); } }
      drawSprite(ctx, V.sprite[sheep[i].c], cx, cy + P.dunk * s * 0.12, sx, sy * (1 - P.dunk * 0.35), 1 - P.dunk * 0.45);
    }
  }

  // A gate hinged on the open side's first corner: pointing outward when open (shut 0), across the gap when shut (1).
  function drawGate(ctx, px, py, s, open, shut) {
    const e = EDGE[open], a = (1 - shut) * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
    const i = s * 0.07, len = s - 2 * i;
    const hx = px + e[0] * s + inset(e[0], i), hy = py + e[1] * s + inset(e[1], i), ex = (e[2] - e[0]) * len, ey = (e[3] - e[1]) * len;
    const ox = R.DX[open] * len, oy = R.DY[open] * len;
    const gx = hx + ca * ex + sa * ox, gy = hy + ca * ey + sa * oy;
    ctx.lineCap = "round";
    ctx.strokeStyle = PAL.post; ctx.lineWidth = s * 0.1;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(gx, gy); ctx.stroke();
    ctx.strokeStyle = PAL.railHi; ctx.lineWidth = s * 0.035;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(gx, gy); ctx.stroke();
  }

  function drawRipple(ctx, cx, cy, s, u) {
    ctx.strokeStyle = PAL.ripple; ctx.globalAlpha = 1 - u;
    ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.12, s * (0.2 + 0.35 * u), s * (0.1 + 0.16 * u), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.12, s * (0.1 + 0.2 * u), s * (0.05 + 0.09 * u), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  NS.render = { create, resize, draw };
})();
