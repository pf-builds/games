// Into the Fold canvas renderer (SPEC §6). Everything is drawn in code: a cached static layer (field, grass, flowers,
// outer fence, rocks, mud, pond, pen doorsteps, floors and fences) plus, per frame, the pens' gates and ghost sheep, splash
// ripples, the sheep and a small particle pool. Sheep are cached sprites per colour (standing + two trot frames) with
// a separate ground shadow, so a hop lifts the sheep and leaves the shadow on the grass. Per-frame work allocates
// nothing. check() samples the caches after the page comes back (a backgrounded tab can lose canvas memory) and
// rebuilds them once if they read blank.
(function () {
  "use strict";
  const NS = (window.IntoTheFold = window.IntoTheFold || {});
  const R = NS.rules, Game = NS.game;
  const PAL = {
    field: "#79b35e", grassA: "#a9d985", grassB: "#a0d27d", tuft: "#88c268", tuftHi: "#bfe39c",
    petal: "#fffaf0", petalPink: "#f7d6e0", eye: "#f2c94c",
    rail: "#9a6538", railHi: "#c9925e", post: "#6d4526",
    rock: "#a3a198", rockHi: "#cfcdc3", rockLo: "#74726b", moss: "#8fb86a",
    mud: "#8f6c46", mudDamp: "rgba(96,110,52,0.45)", mudWet: "#5c432b", mudLo: "#6a4d30", mudSheen: "rgba(220,240,250,0.55)",
    pond: "#62ade0", pondLo: "#3f88bb", pondHi: "#c2e8f9", ripple: "rgba(255,255,255,0.9)", pad: "#6fae57", padLo: "#4f8f3d",
    floor: { w: "#f3e2ab", b: "#8a7c97" }, floorLo: { w: "#dcc68a", b: "#6d6079" }, straw: "#e6c874",
    mat: { w: "#efdc9e", b: "#b4aac3" }, matLo: { w: "#cdb574", b: "#81759a" },
    wool: { w: "#fdfbf4", b: "#46424e" }, woolHi: { w: "#ffffff", b: "#6a6474" }, woolLine: { w: "#d6cebc", b: "#f4efe4" },
    face: { w: "#3d332c", b: "#1d1a21" }, ear: { w: "#51443a", b: "#28242d" }, blush: "rgba(240,140,150,0.45)",
    leg: "#3a302a", hoof: "#1f1a17", shadow: "rgba(25,45,15,0.24)",
    drop: "#d9f1fc", dropLo: "#7cc3ea", spark: "#fff4c2", dust: "#8fae62",
  };
  // Pen edge corners (cell units) per open side, hinge first: N top edge, E right, S bottom, W left.
  const EDGE = [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0]];
  const PK = { splash: 1, pen: 2, win: 3, stop: 4 }, PK_NAME = ["", "splash", "pen", "win", "stop"];

  function create(canvas, cfg) {
    const cap = cfg.particles.cap;
    return { canvas, ctx: canvas.getContext("2d"), cfg, css: 0, dpr: 1, px: 0, B: null, layer: null, sprite: null, shadow: null, cell: 0, ox: 0, oy: 0,
      filled: null, P: { x: 0, y: 0, sq: 0, axis: 0, dunk: 0, ripple: -1, hop: 0, trot: 0 },
      pt: { kind: new Uint8Array(cap), x: new Float32Array(cap), y: new Float32Array(cap), vx: new Float32Array(cap), vy: new Float32Array(cap),
        t0: new Float64Array(cap), life: new Float32Array(cap), size: new Float32Array(cap), next: 0, until: 0 }, rng: 12345 };
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
    V.sprite = { w: [buildSheep("w", s, 0), buildSheep("w", s, 1), buildSheep("w", s, 2)], b: [buildSheep("b", s, 0), buildSheep("b", s, 1), buildSheep("b", s, 2)], size: s };
    V.shadow = buildShadow(s);
    V.B = B;
  }

  // Blank caches (a backgrounded tab can drop canvas memory) read as transparent: sample one pixel of the field
  // layer and of a sheep sprite; if either is blank, drop the caches so the next draw rebuilds them. Returns true
  // if it did. Called on pageshow / visibilitychange only, never per frame.
  function check(V) {
    if (!V.B || !V.layer) return false;
    try { if (alphaAt(V, V.layer) && alphaAt(V, V.sprite.w[0])) return false; } catch (e) { /* unreadable: rebuild to be safe */ }
    V.B = null;
    return true;
  }

  // Alpha of a cache canvas's centre pixel, read through a 1x1 probe (only the probe is ever read back, so the
  // caches stay GPU-friendly).
  function alphaAt(V, src) {
    if (!V.probe) { const c = document.createElement("canvas"); c.width = c.height = 1; V.probe = c.getContext("2d", { willReadFrequently: true }); }
    V.probe.clearRect(0, 0, 1, 1);
    V.probe.drawImage(src, src.width >> 1, src.height >> 1, 1, 1, 0, 0, 1, 1);
    return V.probe.getImageData(0, 0, 1, 1).data[3];
  }

  // Debug only (ITF.dropCaches): simulate a lost backing store.
  function dropCaches(V) {
    if (!V.layer) return;
    V.layer.getContext("2d").clearRect(0, 0, V.layer.width, V.layer.height);
    for (const k of ["w", "b"]) for (const c of V.sprite[k]) c.getContext("2d").clearRect(0, 0, c.width, c.height);
  }

  // Deterministic per-cell noise for texture (no Math.random in art, so a redraw never shimmers).
  function hash(x, y, k) { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  function buildLayer(V, B) {
    const c = offscreen(V.px), x = c.getContext("2d"), s = V.cell, ox = V.ox, oy = V.oy;
    x.fillStyle = PAL.field; x.fillRect(0, 0, V.px, V.px);
    for (let cy = 0; cy < B.h; cy++) for (let cx = 0; cx < B.w; cx++) {
      const px = ox + cx * s, py = oy + cy * s;
      x.fillStyle = (cx + cy) & 1 ? PAL.grassA : PAL.grassB;
      x.fillRect(px, py, s + 0.5, s + 0.5);
      x.lineWidth = Math.max(1, s * 0.025); x.lineCap = "round";
      for (let k = 0; k < 3; k++) {
        const tx = px + (0.15 + 0.7 * hash(cx, cy, k)) * s, ty = py + (0.2 + 0.65 * hash(cy, cx, k + 7)) * s;
        x.strokeStyle = k ? PAL.tuft : PAL.tuftHi;
        x.beginPath(); x.moveTo(tx - s * 0.04, ty); x.lineTo(tx - s * 0.02, ty - s * 0.07); x.moveTo(tx + s * 0.02, ty); x.lineTo(tx + s * 0.04, ty - s * 0.06); x.stroke();
      }
      if (B.type[cy * B.w + cx] === R.GRASS && hash(cx, cy, 11) < 0.22) flower(x, px + (0.2 + 0.6 * hash(cx, cy, 12)) * s, py + (0.2 + 0.6 * hash(cy, cx, 13)) * s, s * 0.045, hash(cx, cy, 14) < 0.35);
    }
    for (const p of B.pens) drawDoorstep(x, ox + p.x * s, oy + p.y * s, s, R.DIRS.indexOf(p.open), p.c);
    for (let cy = 0; cy < B.h; cy++) for (let cx = 0; cx < B.w; cx++) {
      const t = B.type[cy * B.w + cx], px = ox + cx * s, py = oy + cy * s;
      if (t === R.ROCK) drawRock(x, px, py, s, cx, cy);
      else if (t === R.MUD) drawMud(x, px, py, s, cx, cy);
      else if (t === R.POND) drawPond(x, px, py, s, cx, cy);
    }
    for (const p of B.pens) drawPen(x, ox + p.x * s, oy + p.y * s, s, R.DIRS.indexOf(p.open), p.c, p.x, p.y);
    // Outer fence: two rails and posts round the pasture.
    const w = B.w * s, h = B.h * s, m = s * 0.12;
    for (let r = 0; r < 2; r++) {
      const e = m + r * s * 0.12;
      x.strokeStyle = PAL.rail; x.lineWidth = s * 0.07; x.strokeRect(ox - e, oy - e, w + 2 * e, h + 2 * e);
      x.strokeStyle = PAL.railHi; x.lineWidth = s * 0.02; x.strokeRect(ox - e, oy - e - s * 0.015, w + 2 * e, h + 2 * e);
    }
    x.fillStyle = PAL.post;
    const pr = s * 0.075, pe = m + s * 0.06;
    for (let k = 0; k <= B.w; k++) { post(x, ox + k * s, oy - pe, pr); post(x, ox + k * s, oy + h + pe, pr); }
    for (let k = 1; k < B.h; k++) { post(x, ox - pe, oy + k * s, pr); post(x, ox + w + pe, oy + k * s, pr); }
    return c;
  }

  function post(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); }

  function blob(x, cx, cy, rx, ry) { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); }

  function flower(x, cx, cy, r, pink) {
    x.fillStyle = pink ? PAL.petalPink : PAL.petal;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; blob(x, cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.75, r * 0.75); }
    x.fillStyle = PAL.eye; blob(x, cx, cy, r * 0.6, r * 0.6);
  }

  function drawRock(x, px, py, s, cx, cy) {
    const j = hash(cx, cy, 3) * 0.08;
    x.fillStyle = PAL.shadow; blob(x, px + s * 0.52, py + s * 0.74, s * 0.4, s * 0.13);
    x.fillStyle = PAL.rockLo; blob(x, px + s * 0.5, py + s * 0.56, s * (0.4 + j), s * 0.34);
    x.fillStyle = PAL.rock; blob(x, px + s * 0.48, py + s * 0.5, s * (0.37 + j), s * 0.31);
    x.fillStyle = PAL.rockHi; blob(x, px + s * 0.37, py + s * 0.37, s * 0.14, s * 0.075);
    if (hash(cx, cy, 5) < 0.5) { x.fillStyle = PAL.moss; blob(x, px + s * 0.62, py + s * 0.3, s * 0.1, s * 0.05); }
  }

  // Mud: a flat, wet patch flush with the ground (no raised rim, highlight or cast shadow, so it never reads as a rock):
  // a damp halo into the grass, a wide low spread of brown, one long puddle with a sky sheen, and a trail of hoof prints.
  function drawMud(x, px, py, s, cx, cy) {
    const u = hash(cx, cy, 21) - 0.5, v = hash(cx, cy, 22) - 0.5;
    for (let pass = 0; pass < 2; pass++) {
      x.fillStyle = pass ? PAL.mud : PAL.mudDamp;
      const g = pass ? 0 : s * 0.035;
      blob(x, px + s * 0.5, py + s * 0.54, s * 0.4 + g, s * 0.25 + g);
      blob(x, px + s * (0.3 + 0.06 * u), py + s * (0.42 + 0.05 * v), s * 0.19 + g, s * 0.13 + g);
      blob(x, px + s * (0.68 - 0.05 * v), py + s * (0.62 + 0.05 * u), s * 0.21 + g, s * 0.14 + g);
    }
    x.fillStyle = PAL.mudWet; blob(x, px + s * (0.54 + 0.08 * u), py + s * 0.6, s * 0.2, s * 0.07);
    x.strokeStyle = PAL.mudSheen; x.lineWidth = Math.max(1, s * 0.022); x.lineCap = "round";
    x.beginPath(); x.moveTo(px + s * (0.43 + 0.08 * u), py + s * 0.58); x.lineTo(px + s * (0.56 + 0.08 * u), py + s * 0.565); x.stroke();
    x.fillStyle = PAL.mudLo;
    for (let k = 0; k < 4; k++) {
      const hx = px + s * (0.22 + 0.13 * k), hy = py + s * (0.45 - 0.035 * k + (k & 1 ? 0.035 : 0));
      blob(x, hx - s * 0.013, hy, s * 0.011, s * 0.02); blob(x, hx + s * 0.013, hy, s * 0.011, s * 0.02);
    }
  }

  function drawPond(x, px, py, s, cx, cy) {
    x.fillStyle = PAL.pondLo; blob(x, px + s * 0.5, py + s * 0.53, s * 0.47, s * 0.43);
    x.fillStyle = PAL.pond; blob(x, px + s * 0.5, py + s * 0.5, s * 0.45, s * 0.41);
    x.strokeStyle = PAL.pondHi; x.lineWidth = s * 0.035; x.lineCap = "round";
    x.beginPath(); x.arc(px + s * 0.42, py + s * 0.44, s * 0.2, Math.PI * 1.1, Math.PI * 1.55); x.stroke();
    x.beginPath(); x.arc(px + s * 0.6, py + s * 0.62, s * 0.12, Math.PI * 0.1, Math.PI * 0.5); x.stroke();
    // A lily pad with its notch.
    const lx = px + s * (0.64 + 0.08 * hash(cx, cy, 9)), ly = py + s * 0.36, lr = s * 0.09;
    x.fillStyle = PAL.padLo; blob(x, lx, ly + lr * 0.25, lr, lr * 0.7);
    x.fillStyle = PAL.pad; x.beginPath(); x.moveTo(lx, ly); x.ellipse(lx, ly, lr, lr * 0.68, 0, 0.35, Math.PI * 2 - 0.1); x.closePath(); x.fill();
  }

  // The doorstep (px, py = the pen's cell): a flat mat on the ground in front of the open side (straw for white, pale
  // slate for black) with a chevron pointing in, so the doorway reads as a way in. Drawn under the terrain.
  function drawDoorstep(x, px, py, s, open, c) {
    const dx = R.DX[open], dy = R.DY[open], d = s * 0.26, w = s * 0.7, r = s * 0.08;
    const ex = px + s / 2 + (dx * s) / 2, ey = py + s / 2 + (dy * s) / 2; // the open edge's midpoint
    const rx = dx ? (dx > 0 ? ex - r : ex - d) : ex - w / 2, ry = dy ? (dy > 0 ? ey - r : ey - d) : ey - w / 2;
    const rw = dx ? d + r : w, rh = dy ? d + r : w; // tucked r under the pen's floor so only the outer corners round
    x.fillStyle = PAL.matLo[c]; x.beginPath(); x.roundRect ? x.roundRect(rx, ry + s * 0.02, rw, rh, r) : x.rect(rx, ry + s * 0.02, rw, rh); x.fill();
    x.fillStyle = PAL.mat[c]; x.beginPath(); x.roundRect ? x.roundRect(rx, ry, rw, rh, r) : x.rect(rx, ry, rw, rh); x.fill();
    // Chevron: its point toward the pen, centred on the mat's outer part.
    const cx = ex + dx * d * 0.5, cy = ey + dy * d * 0.5, k = s * 0.09, ux = -dy, uy = dx; // ux,uy runs along the doorway
    x.strokeStyle = PAL.matLo[c]; x.lineWidth = Math.max(1, s * 0.035); x.lineCap = "round"; x.lineJoin = "round";
    x.beginPath(); x.moveTo(cx + dx * k * 0.5 + ux * k, cy + dy * k * 0.5 + uy * k); x.lineTo(cx - dx * k * 0.5, cy - dy * k * 0.5); x.lineTo(cx + dx * k * 0.5 - ux * k, cy + dy * k * 0.5 - uy * k); x.stroke();
  }

  // Pen floor in its colour (straw for white, slate flagstones for black), fenced on the three closed sides. The open
  // side has no rail: the floor runs out to the cell edge between two gate posts (the gate itself is per frame).
  function drawPen(x, px, py, s, open, c, cx, cy) {
    const i = s * 0.07, j = i * 1.6;
    const l = open === 3 ? 0 : 1, t = open === 0 ? 0 : 1, r = open === 1 ? 0 : 1, b = open === 2 ? 0 : 1; // 0 on the open side
    x.fillStyle = PAL.floorLo[c]; x.fillRect(px + l * i, py + t * i, s - (l + r) * i, s - (t + b) * i);
    x.fillStyle = PAL.floor[c]; x.fillRect(px + l * j, py + t * j, s - (l + r) * j, s - (t + b) * j);
    x.lineCap = "round";
    if (c === "w") {
      x.strokeStyle = PAL.straw; x.lineWidth = Math.max(1, s * 0.02);
      for (let k = 0; k < 7; k++) {
        const sx = px + s * (0.2 + 0.6 * hash(cx, cy, k + 20)), sy = py + s * (0.2 + 0.6 * hash(cy, cx, k + 30)), a = hash(cx, cy, k + 40) * Math.PI;
        x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * s * 0.1, sy + Math.sin(a) * s * 0.1); x.stroke();
      }
    } else {
      // Flagstone joints: one course line, offset joints above and below it.
      x.strokeStyle = PAL.floorLo.b; x.lineWidth = Math.max(1, s * 0.025);
      const q = hash(cx, cy, 50) * 0.14;
      x.beginPath();
      x.moveTo(px + j, py + s * 0.5); x.lineTo(px + s - j, py + s * 0.5);
      x.moveTo(px + s * (0.36 + q), py + j); x.lineTo(px + s * (0.36 + q), py + s * 0.5);
      x.moveTo(px + s * (0.58 + q), py + s * 0.5); x.lineTo(px + s * (0.58 + q), py + s - j);
      x.stroke();
    }
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

  function buildShadow(s) { const cv = offscreen(s), x = cv.getContext("2d"), m = cv.width / 2; x.fillStyle = PAL.shadow; blob(x, m, m, s * 0.34, s * 0.1); return cv; }

  // A round wool puff with little legs, facing the viewer. frame 0 stands; 1 and 2 are the trot (legs paired and
  // offset), used while the sheep runs. No shadow here: the renderer puts that on the ground.
  function buildSheep(c, s, frame) {
    const cv = offscreen(s), x = cv.getContext("2d"), m = cv.width / 2;
    const legs = [-0.21, -0.08, 0.06, 0.19];
    for (let k = 0; k < 4; k++) {
      const up = frame && (k & 1) === frame - 1 ? s * 0.05 : 0, lx = m + legs[k] * s;
      x.fillStyle = PAL.leg; x.beginPath(); x.roundRect ? x.roundRect(lx, m + s * 0.12 - up, s * 0.075, s * 0.2, s * 0.03) : x.rect(lx, m + s * 0.12 - up, s * 0.075, s * 0.2); x.fill();
      x.fillStyle = PAL.hoof; x.fillRect(lx, m + s * 0.28 - up, s * 0.075, s * 0.04);
    }
    const puffs = [[-0.2, 0.02, 0.17], [0.2, 0.02, 0.17], [-0.1, -0.13, 0.17], [0.1, -0.13, 0.17], [-0.1, 0.12, 0.16], [0.1, 0.12, 0.16], [0, -0.01, 0.22]];
    x.fillStyle = PAL.woolLine[c];
    const rim = s * (c === "b" ? 0.045 : 0.025); // the black sheep's rim is light, so it reads on slate, mud and shadow
    for (const p of puffs) blob(x, m + p[0] * s, m + p[1] * s, p[2] * s + rim, p[2] * s + rim);
    x.fillStyle = PAL.wool[c];
    for (const p of puffs) blob(x, m + p[0] * s, m + p[1] * s, p[2] * s, p[2] * s);
    x.fillStyle = PAL.woolHi[c];
    for (const p of puffs) if (p[1] < 0.05) blob(x, m + (p[0] - 0.04) * s, m + (p[1] - 0.06) * s, p[2] * s * 0.45, p[2] * s * 0.3);
    x.fillStyle = PAL.ear[c];
    x.beginPath(); x.ellipse(m - s * 0.15, m + s * 0.03, s * 0.08, s * 0.04, -0.5, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(m + s * 0.15, m + s * 0.03, s * 0.08, s * 0.04, 0.5, 0, Math.PI * 2); x.fill();
    x.fillStyle = PAL.face[c]; blob(x, m, m + s * 0.08, s * 0.11, s * 0.14);
    x.fillStyle = PAL.wool[c]; blob(x, m, m - s * 0.05, s * 0.1, s * 0.055);
    x.fillStyle = PAL.blush; blob(x, m - s * 0.075, m + s * 0.13, s * 0.03, s * 0.02); blob(x, m + s * 0.075, m + s * 0.13, s * 0.03, s * 0.02);
    x.fillStyle = "#ffffff"; blob(x, m - s * 0.045, m + s * 0.06, s * 0.03, s * 0.03); blob(x, m + s * 0.045, m + s * 0.06, s * 0.03, s * 0.03);
    x.fillStyle = "#111111"; blob(x, m - s * 0.045, m + s * 0.065, s * 0.016, s * 0.016); blob(x, m + s * 0.045, m + s * 0.065, s * 0.016, s * 0.016);
    return cv;
  }

  function drawSprite(ctx, img, cx, cy, sx, sy, alpha) {
    ctx.globalAlpha = alpha;
    ctx.setTransform(sx, 0, 0, sy, cx, cy);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // ---- particles: a fixed pool, positions computed from spawn time (no per-frame state) ----------------------------
  function rnd(V) { V.rng = (V.rng * 1103515245 + 12345) & 0x7fffffff; return V.rng / 0x7fffffff; }

  // Spawn a burst of `kind` at cell (cx, cy) (cell units, float). Spawn points are clamped inside the grid.
  function spawn(V, kind, cx, cy, now) {
    const C = V.cfg.particles[kind], pt = V.pt, cap = pt.kind.length, B = V.B;
    if (!C || !B) return;
    const x0 = Math.min(B.w - 0.1, Math.max(0.1, cx + 0.5)), y0 = Math.min(B.h - 0.1, Math.max(0.1, cy + 0.5));
    for (let k = 0; k < C.n; k++) {
      const j = pt.next; pt.next = (j + 1) % cap;
      const a = rnd(V) * Math.PI * 2, sp = C.speed * (0.5 + 0.5 * rnd(V));
      pt.kind[j] = PK[kind]; pt.x[j] = x0 + (rnd(V) - 0.5) * 0.3; pt.y[j] = y0 + (rnd(V) - 0.5) * 0.2;
      pt.vx[j] = Math.cos(a) * sp; pt.vy[j] = Math.sin(a) * sp * 0.5 - C.lift;
      pt.t0[j] = now; pt.life[j] = C.lifeMs * (0.7 + 0.3 * rnd(V)); pt.size[j] = C.size * (0.7 + 0.6 * rnd(V));
      if (now + pt.life[j] > pt.until) pt.until = now + pt.life[j];
    }
  }

  function busy(V, now) { return now < V.pt.until; }

  // Empty the particle pool (selfTest's live-path check spawns on a virtual clock).
  function clearFx(V) { V.pt.kind.fill(0); V.pt.until = 0; }

  function drawParticles(V, ctx, now, bx, by) {
    const pt = V.pt, s = V.cell, cap = pt.kind.length;
    if (now >= pt.until) return;
    for (let j = 0; j < cap; j++) {
      const k = pt.kind[j];
      if (!k) continue;
      const t = now - pt.t0[j];
      if (t < 0 || t >= pt.life[j]) continue;
      const u = t / pt.life[j], ts = t / 1000, g = V.cfg.particles[PK_NAME[k]].g;
      const x = V.ox + (pt.x[j] + pt.vx[j] * ts) * s + bx, y = V.oy + (pt.y[j] + pt.vy[j] * ts + 0.5 * g * ts * ts) * s + by, r = pt.size[j] * s;
      ctx.globalAlpha = 1 - u * u;
      if (k === PK.splash) { ctx.fillStyle = PAL.dropLo; blob(ctx, x, y + r * 0.3, r, r); ctx.fillStyle = PAL.drop; blob(ctx, x, y, r * 0.8, r * 0.8); }
      else if (k === PK.pen) { ctx.fillStyle = j & 1 ? PAL.spark : PAL.straw; ctx.fillRect(x - r, y - r * 0.25, 2 * r, r * 0.5); ctx.fillRect(x - r * 0.25, y - r, r * 0.5, 2 * r); }
      else if (k === PK.win) { ctx.fillStyle = PAL.woolLine.w; blob(ctx, x, y + r * 0.15, r, r); ctx.fillStyle = PAL.wool.w; blob(ctx, x, y, r * 0.9, r * 0.9); }
      else { ctx.fillStyle = PAL.dust; blob(ctx, x, y, r, r * 0.7); }
    }
    ctx.globalAlpha = 1;
  }

  // Draw one frame of game g.
  function draw(V, g) {
    const B = g.B, cfg = g.cfg, ctx = V.ctx, now = g.now;
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
    const openRad = (cfg.board.gateOpenDeg * Math.PI) / 180;
    for (let k = 0; k < B.pens.length; k++) {
      const p = B.pens[k], cell = p.y * B.w + p.x, px = V.ox + p.x * s + bx, py = V.oy + p.y * s + by;
      const who = filled[cell], shut = who ? Game.gateShut(g, who - 1) : 0;
      if (!who) drawSprite(ctx, V.sprite[p.c][0], px + s / 2, py + s / 2, 0.72, 0.72, cfg.board.ghostAlpha);
      drawGate(ctx, px, py, s, R.DIRS.indexOf(p.open), shut, openRad);
    }
    const shadow = V.shadow;
    for (let i = 0; i < sheep.length; i++) {
      Game.pose(g, i, P);
      const cx = V.ox + (P.x + 0.5) * s + bx, cy = V.oy + (P.y + 0.5) * s + by;
      if (P.ripple >= 0) drawRipple(ctx, cx, cy, s, P.ripple);
      // A penned sheep settles to pennedScale as its gate shuts.
      let k = sheep[i].penned ? 1 - (1 - cfg.board.pennedScale) * Game.gateShut(g, i) : 1, sx = k, sy = k;
      if (P.sq) { if (P.axis === 0) { sx = k * (1 - P.sq); sy = k * (1 + P.sq * 0.6); } else { sy = k * (1 - P.sq); sx = k * (1 + P.sq * 0.6); } }
      const lift = P.hop * s, sh = 1 - Math.min(0.5, P.hop * 1.2);
      if (P.dunk < 0.5) drawSprite(ctx, shadow, cx, cy + V.sprite.size * 0.33 * k, k * sh, k * sh, 1 - P.dunk);
      const bob = P.trot ? (P.trot === 1 ? -0.025 : 0.01) * s : 0;
      drawSprite(ctx, V.sprite[sheep[i].c][P.trot], cx, cy - lift + bob + P.dunk * s * 0.12, sx, sy * (1 - P.dunk * 0.35), 1 - P.dunk * 0.45);
    }
    drawParticles(V, ctx, now, bx, by);
  }

  // The pen's double gate, hinged on the two doorway posts. Open (shut 0) both leaves stand swung INTO the pen by
  // `openRad`, so nothing lies on the ground outside; they swing shut to meet across the doorway (shut 1).
  function drawGate(ctx, px, py, s, open, shut, openRad) {
    const e = EDGE[open], i = s * 0.07, half = (s - 2 * i) / 2, a = (1 - shut) * openRad, ca = Math.cos(a), sa = Math.sin(a);
    const ux = e[2] - e[0], uy = e[3] - e[1], vx = -R.DX[open], vy = -R.DY[open]; // along the doorway; into the pen
    const h0x = px + e[0] * s + inset(e[0], i), h0y = py + e[1] * s + inset(e[1], i);
    const h1x = px + e[2] * s + inset(e[2], i), h1y = py + e[3] * s + inset(e[3], i);
    leaf(ctx, h0x, h0y, h0x + half * (ca * ux + sa * vx), h0y + half * (ca * uy + sa * vy), s);
    leaf(ctx, h1x, h1y, h1x + half * (sa * vx - ca * ux), h1y + half * (sa * vy - ca * uy), s);
    ctx.fillStyle = PAL.post; post(ctx, h0x, h0y, s * 0.085); post(ctx, h1x, h1y, s * 0.085);
  }

  function leaf(ctx, x0, y0, x1, y1, s) {
    ctx.lineCap = "round";
    ctx.strokeStyle = PAL.post; ctx.lineWidth = s * 0.085;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = PAL.railHi; ctx.lineWidth = s * 0.03;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }

  function drawRipple(ctx, cx, cy, s, u) {
    ctx.strokeStyle = PAL.ripple; ctx.globalAlpha = 1 - u;
    ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.12, s * (0.2 + 0.35 * u), s * (0.1 + 0.16 * u), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.12, s * (0.1 + 0.2 * u), s * (0.05 + 0.09 * u), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  NS.render = { create, resize, draw, spawn, busy, clearFx, check, dropCaches };
})();
