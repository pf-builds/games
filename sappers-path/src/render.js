// Sapper's Path renderer (SPEC §4 look). Canvas 2D, placeholder pixel art drawn in code; M2 swaps the art by replacing
// the tile painters (PAINT) and icon painters (ICON) below, nothing else. Structure:
//   tile sprites   one canvas per tile key at the current cell size (built on fit, checked for opaque pixels on wake)
//   board layer    every tile, section outlines and one crew badge per section; re-baked only when the game's ver or
//                  the cell size changes
//   pick layers    the dim veil and the glow outline for the picked crew; re-baked when ver or pick changes
//   per frame      blit the layers, then the short effects (pulse, shake, flash, crumble, dust, keep burst). The frame
//                  path allocates nothing: effects walk the engine's typed arrays and a preallocated dust pool.
// Every texture reads in grayscale: brick courses (stone), plank grain (timber), leaf clusters (hedge), cracked facets
// (ice), rivets (iron), and each section's badge carries its crew's icon.
(function (root, factory) {
  (root.SappersPath = root.SappersPath || {}).render = factory(root.SappersPath.engine);
})(window, function (E) {
  "use strict";
  const MATS = ["stone", "timber", "hedge", "ice", "iron"];
  const TAU = Math.PI * 2;

  // Deterministic 0..1 noise so every rebuild paints the same textures.
  function noise(k) { let t = (k | 0) * 0x9e3779b1; t ^= t >>> 15; t = Math.imul(t, 0x85ebca6b); t ^= t >>> 13; t = Math.imul(t, 0xc2b2ae35); t ^= t >>> 16; return (t >>> 0) / 4294967296; }
  function mk(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }

  function create(canvas, cfg) {
    const N = cfg.fx.dustPool;
    return {
      canvas, g: canvas.getContext("2d"), cfg, art: cfg.art, fx: cfg.fx,
      dpr: 1, cell: 0, ox: 0, oy: 0, B: null, anchor: null, chestAt: null, leverAt: null,
      tiles: {}, tileCell: 0, layer: mk(1, 1), dim: mk(1, 1), glow: mk(1, 1),
      layerVer: -1, layerCell: 0, pickVer: -1, pickM: -1, pickCell: 0, rebuilds: 0,
      dust: { x: new Float32Array(N), y: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N), t0: new Float64Array(N).fill(-1e12),
        mat: new Uint8Array(N), size: new Float32Array(N), head: 0, seed: 1 },
      hit: { x: 0, y: 0 },
    };
  }

  // Force both layers to re-bake on the next frame.
  function stale(V) { V.layerVer = V.pickVer = -1; }

  // Per-level lookups: the badge anchor (the tile nearest each section's centroid), chest and lever indices by cell.
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
    V.dust.t0.fill(-1e12);
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
  // Cell centre in client coordinates (the harness taps here).
  function cellCenter(V, x, y) {
    const r = V.canvas.getBoundingClientRect(), k = r.width / V.canvas.width;
    return { x: r.left + (V.ox + (x + 0.5) * V.cell) * k, y: r.top + (V.oy + (y + 0.5) * V.cell) * k };
  }

  // ---- art: tile painters (M2 replaces these) ------------------------------------------------------------------------
  function lineW(s, f) { return Math.max(1, Math.round(s * f)); }
  const PAINT = {
    ground(g, s, A, v) {
      g.fillStyle = A.ground; g.fillRect(0, 0, s, s);
      g.fillStyle = A.speck; const d = lineW(s, 0.06);
      for (let i = 0; i < 6; i++) g.fillRect(Math.floor(noise(v * 97 + i) * (s - d)), Math.floor(noise(v * 131 + i + 50) * (s - d)), d, d);
    },
    stone(g, s, A, v) {
      const [base, dark, lite] = A.stone, rows = 3, rh = s / rows, lw = lineW(s, 0.06);
      g.fillStyle = base; g.fillRect(0, 0, s, s);
      for (let r = 0; r < rows; r++) {
        const y = Math.round(r * rh), joints = (r + v) % 2 ? [0.5] : [0.2, 0.8];
        g.fillStyle = lite; g.fillRect(0, y + lw, s, lw);
        g.fillStyle = dark; g.fillRect(0, y, s, lw);
        for (const j of joints) g.fillRect(Math.round(j * s) - (lw >> 1), y, lw, Math.ceil(rh));
      }
    },
    timber(g, s, A, v) {
      const [base, dark, lite] = A.timber, lw = lineW(s, 0.05);
      g.fillStyle = base; g.fillRect(0, 0, s, s);
      g.lineWidth = lw;
      for (let p = 0; p < 3; p++) {
        const x0 = Math.round((p * s) / 3);
        g.fillStyle = dark; g.fillRect(x0, 0, lw, s);
        for (let k = 0; k < 2; k++) {
          const gx = x0 + s * (0.1 + 0.14 * k + 0.05 * noise(v * 7 + p * 3 + k));
          g.strokeStyle = k ? lite : dark; g.beginPath(); g.moveTo(gx, 0);
          g.bezierCurveTo(gx + s * 0.05, s * 0.35, gx - s * 0.05, s * 0.65, gx, s); g.stroke();
        }
      }
      g.fillStyle = dark; g.beginPath(); g.ellipse(s * (0.3 + 0.4 * noise(v + 11)), s * (0.3 + 0.4 * noise(v + 12)), s * 0.07, s * 0.045, 0, 0, TAU); g.fill();
    },
    hedge(g, s, A, v) {
      const [base, dark, lite] = A.hedge;
      g.fillStyle = dark; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 14; i++) {
        const x = noise(v * 53 + i) * s, y = noise(v * 71 + i + 30) * s, r = s * (0.12 + 0.06 * noise(v * 13 + i));
        g.fillStyle = i % 3 === 0 ? lite : base; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
    },
    ice(g, s, A, v) {
      const [base, mid, white] = A.ice, lw = lineW(s, 0.045);
      g.fillStyle = base; g.fillRect(0, 0, s, s);
      g.fillStyle = white; g.beginPath(); g.moveTo(s * 0.08, s * 0.1); g.lineTo(s * 0.45, s * 0.08); g.lineTo(s * 0.12, s * 0.45); g.closePath(); g.fill();
      g.strokeStyle = mid; g.lineWidth = lw; g.beginPath();
      const cx = s * (0.45 + 0.15 * noise(v + 3)), cy = s * (0.5 + 0.15 * noise(v + 4));
      g.moveTo(0, s * 0.7); g.lineTo(cx, cy); g.lineTo(s, s * 0.35); g.moveTo(cx, cy); g.lineTo(s * 0.62, s); g.moveTo(cx, cy); g.lineTo(s * 0.4, 0);
      g.stroke();
    },
    iron(g, s, A) {
      const [base, dark, lite] = A.iron, lw = lineW(s, 0.07);
      g.fillStyle = base; g.fillRect(0, 0, s, s);
      g.strokeStyle = dark; g.lineWidth = lw; g.strokeRect(lw * 1.5, lw * 1.5, s - lw * 3, s - lw * 3);
      const r = Math.max(1, s * 0.07);
      for (const [x, y] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
        g.fillStyle = dark; g.beginPath(); g.arc(x * s + r * 0.4, y * s + r * 0.4, r, 0, TAU); g.fill();
        g.fillStyle = lite; g.beginPath(); g.arc(x * s, y * s, r, 0, TAU); g.fill();
      }
    },
    moat(g, s, A, v) {
      const [base, lite] = A.moat;
      g.fillStyle = base; g.fillRect(0, 0, s, s);
      g.strokeStyle = lite; g.lineWidth = lineW(s, 0.06);
      for (let k = 0; k < 2; k++) {
        const y = s * (0.3 + 0.4 * k) + s * 0.05 * (v % 2);
        g.beginPath(); g.moveTo(s * 0.12, y); g.quadraticCurveTo(s * 0.3, y - s * 0.12, s * 0.5, y); g.quadraticCurveTo(s * 0.7, y + s * 0.12, s * 0.88, y); g.stroke();
      }
    },
    keep(g, s, A, open) {
      const [wall, dark, flag, gold] = A.keep, u = s / 10;
      PAINT.ground(g, s, A, 3);
      g.fillStyle = wall; g.fillRect(u * 1.5, u * 3, u * 7, u * 6.5);
      for (let i = 0; i < 4; i++) g.fillRect(u * (1.5 + i * 2), u * 1.8, u, u * 1.4);
      g.fillStyle = open ? "#15101a" : dark; g.beginPath(); g.moveTo(u * 3.6, u * 9.5); g.lineTo(u * 3.6, u * 6.6); g.arc(u * 5, u * 6.6, u * 1.4, Math.PI, 0); g.lineTo(u * 6.4, u * 9.5); g.fill();
      g.fillStyle = flag; g.fillRect(u * 4.6, u * 0.3, u * 0.5, u * 2); g.beginPath(); g.moveTo(u * 5.1, u * 0.3); g.lineTo(u * 7, u * 0.9); g.lineTo(u * 5.1, u * 1.5); g.fill();
      if (open) { g.fillStyle = gold; g.beginPath(); g.moveTo(u * 3.8, u * 5.2); g.lineTo(u * 4.3, u * 4); g.lineTo(u * 5, u * 4.8); g.lineTo(u * 5.7, u * 4); g.lineTo(u * 6.2, u * 5.2); g.closePath(); g.fill(); }
    },
    chest(g, s, A, open) {
      const [wood, gold, dark] = A.chest, u = s / 10;
      PAINT.ground(g, s, A, 5);
      g.fillStyle = dark; g.fillRect(u * 2, u * 4, u * 6, u * 4.5);
      g.fillStyle = wood; g.fillRect(u * 2.4, u * 4.4, u * 5.2, u * 3.8);
      if (open) { g.fillStyle = dark; g.fillRect(u * 2, u * 1.6, u * 6, u * 2); g.fillStyle = gold; g.fillRect(u * 2.6, u * 3.8, u * 4.8, u * 0.8); }
      else { g.fillStyle = gold; g.fillRect(u * 2.4, u * 5.6, u * 5.2, u * 0.8); g.fillRect(u * 4.5, u * 5.2, u, u * 1.6); }
    },
    lever(g, s, A, thrown) {
      const [plate, knob, slot] = A.lever, u = s / 10;
      g.fillStyle = plate; g.fillRect(0, 0, s, s);
      g.fillStyle = slot; g.fillRect(u * 3, u * 6.5, u * 4, u * 1.4);
      g.strokeStyle = slot; g.lineWidth = Math.max(1, u * 1.1); g.beginPath();
      const tx = thrown ? u * 7.6 : u * 2.4; g.moveTo(u * 5, u * 7.2); g.lineTo(tx, u * 2.6); g.stroke();
      g.fillStyle = thrown ? knob : "#c0392b"; g.beginPath(); g.arc(tx, u * 2.6, u * 1.3, 0, TAU); g.fill();
    },
  };

  // ---- art: crew icons (badges and the crew cards share these) --------------------------------------------------------
  const ICON = [
    function pick(g, r, ink) { // mason: a pickaxe, tilted like the axe
      g.rotate(-0.55); g.strokeStyle = ink; g.lineCap = "round"; g.lineWidth = r * 0.24;
      g.beginPath(); g.arc(0, r * 0.55, r * 1.05, Math.PI * 1.22, Math.PI * 1.78); g.stroke();
      g.lineWidth = r * 0.2; g.beginPath(); g.moveTo(0, -r * 0.5); g.lineTo(0, r * 0.9); g.stroke();
    },
    function axe(g, r, ink) { // axeman
      g.strokeStyle = ink; g.fillStyle = ink; g.lineCap = "round"; g.lineWidth = r * 0.2;
      g.beginPath(); g.moveTo(-r * 0.45, r * 0.8); g.lineTo(r * 0.3, -r * 0.7); g.stroke();
      g.beginPath(); g.moveTo(r * 0.05, -r * 0.55); g.quadraticCurveTo(r * 0.95, -r * 0.75, r * 0.75, r * 0.15); g.lineTo(r * 0.3, -r * 0.1); g.closePath(); g.fill();
    },
    function goat(g, r, ink) { // goat: long face, swept-back horns, drooping ears, beard
      g.fillStyle = ink; g.strokeStyle = ink; g.lineCap = "round"; g.lineWidth = r * 0.2;
      g.beginPath(); g.moveTo(-r * 0.32, -r * 0.35); g.lineTo(r * 0.32, -r * 0.35); g.lineTo(r * 0.2, r * 0.55); g.quadraticCurveTo(0, r * 0.72, -r * 0.2, r * 0.55); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-r * 0.18, -r * 0.35); g.quadraticCurveTo(-r * 0.35, -r * 0.95, -r * 0.8, -r * 0.8); g.stroke();
      g.beginPath(); g.moveTo(r * 0.18, -r * 0.35); g.quadraticCurveTo(r * 0.35, -r * 0.95, r * 0.8, -r * 0.8); g.stroke();
      g.beginPath(); g.ellipse(-r * 0.58, -r * 0.12, r * 0.3, r * 0.13, 0.5, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(r * 0.58, -r * 0.12, r * 0.3, r * 0.13, -0.5, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-r * 0.1, r * 0.6); g.lineTo(0, r * 0.98); g.lineTo(r * 0.1, r * 0.6); g.fill();
    },
    function torch(g, r, ink) { // torchbearer
      g.fillStyle = ink;
      g.fillRect(-r * 0.12, -r * 0.05, r * 0.24, r * 0.9);
      g.beginPath(); g.moveTo(0, -r * 0.9); g.bezierCurveTo(r * 0.55, -r * 0.4, r * 0.4, 0, 0, -r * 0.05); g.bezierCurveTo(-r * 0.4, 0, -r * 0.55, -r * 0.4, 0, -r * 0.9); g.fill();
    },
    function lever(g, r, ink) { // iron: find the lever
      g.strokeStyle = ink; g.fillStyle = ink; g.lineCap = "round"; g.lineWidth = r * 0.2;
      g.beginPath(); g.moveTo(-r * 0.6, r * 0.6); g.lineTo(r * 0.6, r * 0.6); g.stroke();
      g.beginPath(); g.moveTo(0, r * 0.6); g.lineTo(-r * 0.4, -r * 0.4); g.stroke();
      g.beginPath(); g.arc(-r * 0.45, -r * 0.5, r * 0.25, 0, TAU); g.fill();
    },
  ];
  // Draw crew icon m (0-3; 4 = iron) centred at (cx, cy), radius r, into any 2D context (the page's crew cards too).
  function icon(g, m, cx, cy, r, ink) { g.save(); g.translate(cx, cy); ICON[m](g, r, ink); g.restore(); }

  function buildTiles(V) {
    const s = V.cell, A = V.art, T = {};
    const tile = (key, fn) => { const c = mk(s, s); fn(c.getContext("2d")); T[key] = c; };
    for (let v = 0; v < 2; v++) {
      tile("g" + v, (g) => PAINT.ground(g, s, A, v));
      tile("~" + v, (g) => PAINT.moat(g, s, A, v));
      for (let m = 0; m < 5; m++) tile("m" + m + v, (g) => PAINT[MATS[m]](g, s, A, v));
    }
    tile("K", (g) => PAINT.keep(g, s, A, false)); tile("Ko", (g) => PAINT.keep(g, s, A, true));
    tile("C", (g) => PAINT.chest(g, s, A, false)); tile("Co", (g) => PAINT.chest(g, s, A, true));
    tile("L", (g) => PAINT.lever(g, s, A, false)); tile("Lt", (g) => PAINT.lever(g, s, A, true));
    const br = Math.max(4, Math.round(s * 0.34));
    for (let m = 0; m < 5; m++) {
      const c = mk(br * 2, br * 2), g = c.getContext("2d");
      g.fillStyle = A.badge[1]; g.beginPath(); g.arc(br, br, br, 0, TAU); g.fill();
      g.fillStyle = A.badge[0]; g.beginPath(); g.arc(br, br, br * 0.84, 0, TAU); g.fill();
      icon(g, m, br, br, br * 0.62, A.badge[1]);
      T["b" + m] = c;
    }
    V.tiles = T; V.tileCell = s; stale(V); V.rebuilds++;
  }

  // ---- board layer ---------------------------------------------------------------------------------------------------
  function bakeLayer(V, game) {
    const B = V.B, st = game.st, s = V.cell, T = V.tiles, A = V.art, g = V.layer.getContext("2d"), ox = V.ox, oy = V.oy;
    g.fillStyle = A.outside; g.fillRect(0, 0, V.layer.width, V.layer.height);
    g.fillStyle = A.groundShade;
    for (let i = 0; i < 40; i++) g.fillRect(Math.floor(noise(i + 900) * V.layer.width), Math.floor(noise(i + 950) * V.layer.height), Math.max(1, s >> 4), Math.max(2, s >> 3));
    for (let c = 0; c < B.n; c++) {
      const x = c % B.w, y = (c / B.w) | 0, px = ox + x * s, py = oy + y * s, v = (x * 3 + y * 5) & 1, k = B.kind[c];
      if (k === E.WALL && !st.open[c]) g.drawImage(T["m" + B.mat[c] + v], px, py);
      else if (k === E.MOAT) g.drawImage(T["~" + v], px, py);
      else if (k === E.LEVER) g.drawImage(T[st.thrown[V.leverAt[c]] ? "Lt" : "L"], px, py);
      else if (k === E.KEEP) g.drawImage(T[st.won ? "Ko" : "K"], px, py);
      else if (k === E.CHEST) g.drawImage(T[st.claimed[V.chestAt[c]] ? "Co" : "C"], px, py);
      else g.drawImage(T["g" + v], px, py);
      // Ground cut off from the outside sits in shadow: the lit ground is where crews can walk.
      if ((k === E.OPEN || k === E.CHEST || (k === E.WALL && st.open[c])) && !st.conn[c]) { g.globalAlpha = 0.42; g.fillStyle = "#000"; g.fillRect(px, py, s, s); g.globalAlpha = 1; }
    }
    // Section outlines: a dark edge wherever a standing wall tile meets anything that is not its own section.
    const lw = Math.max(1, Math.round(s * 0.07));
    g.fillStyle = A.outline;
    for (let c = 0; c < B.n; c++) {
      if (B.kind[c] !== E.WALL || st.open[c]) continue;
      const px = ox + (c % B.w) * s, py = oy + ((c / B.w) | 0) * s;
      for (let d = 0; d < 4; d++) {
        const e = B.nb[c * 4 + d];
        if (e >= 0 && B.kind[e] === E.WALL && !st.open[e] && B.sec[e] === B.sec[c]) continue;
        if (d === 0) g.fillRect(px, py, s, lw); else if (d === 1) g.fillRect(px + s - lw, py, lw, s);
        else if (d === 2) g.fillRect(px, py + s - lw, s, lw); else g.fillRect(px, py, lw, s);
      }
    }
    for (let q = 0; q < B.nsec; q++) {
      if (st.broken[q] || st.doorOpen[q]) continue;
      const c = V.anchor[q], b = T["b" + B.secMat[q]];
      g.drawImage(b, Math.round(ox + ((c % B.w) + 0.5) * s - b.width / 2), Math.round(oy + (((c / B.w) | 0) + 0.5) * s - b.height / 2));
    }
    V.layerVer = game.ver; V.layerCell = s;
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
        for (let k = 0; k < 4; k++) {
          const e = B.nb[c * 4 + k];
          if (e >= 0 && B.sec[e] === q) continue;
          if (k === 0) w.fillRect(px, py, s, lw); else if (k === 1) w.fillRect(px + s - lw, py, lw, s);
          else if (k === 2) w.fillRect(px, py + s - lw, s, lw); else w.fillRect(px, py, lw, s);
        }
      }
    }
    V.pickVer = game.ver; V.pickM = m; V.pickCell = s;
  }

  // ---- effects -------------------------------------------------------------------------------------------------------
  function spawnDust(V, s) {
    const B = V.B, D = V.dust, N = D.x.length, per = V.fx.dustPerTile, cell = V.cell, sp = V.fx.dustSpeed * cell / 1000;
    for (let i = B.secStart[s]; i < B.secStart[s + 1]; i++) {
      const c = B.secCells[i];
      for (let k = 0; k < per; k++) {
        const j = D.head; D.head = (D.head + 1) % N;
        const r1 = noise(D.seed++), r2 = noise(D.seed++), r3 = noise(D.seed++);
        D.x[j] = V.ox + ((c % B.w) + r1) * cell; D.y[j] = V.oy + (((c / B.w) | 0) + r2) * cell;
        D.vx[j] = (r1 - 0.5) * 2 * sp; D.vy[j] = -(0.4 + r3) * sp; D.mat[j] = B.secMat[s]; D.size[j] = Math.max(1, cell * (0.06 + 0.07 * r3)); D.t0[j] = -1;
      }
    }
  }
  // Stamp freshly spawned dust (t0 = -1) with the current clock (spawn happens on a tap, before the frame knows now).
  function stampDust(V, now) { const D = V.dust; for (let j = 0; j < D.t0.length; j++) if (D.t0[j] === -1) D.t0[j] = now; }

  function fillSection(V, g, q) {
    const B = V.B, s = V.cell;
    for (let i = B.secStart[q]; i < B.secStart[q + 1]; i++) { const c = B.secCells[i]; g.fillRect(V.ox + (c % B.w) * s, V.oy + ((c / B.w) | 0) * s, s, s); }
  }

  // True while any effect is still moving (the page keeps drawing frames until it settles).
  function busy(V, game, now) {
    const f = game.fx, F = V.fx;
    if (game.pick >= 0 && !game.st.won) return true;
    if (now - f.pulseT < F.pulseMs || now - f.shakeT < F.shakeMs || now - f.flashT < F.flashMs || now - f.crumbleT < Math.max(F.crumbleMs, F.dustMs)) return true;
    return game.st.won && game.endT >= 0 && now - game.endT < F.keepBurstMs;
  }

  function draw(V, game, now) {
    if (!V.B || !V.cell) return;
    const g = V.g, B = V.B, s = V.cell, F = V.fx, f = game.fx, A = V.art, st = game.st;
    if (V.layerVer !== game.ver || V.layerCell !== s) bakeLayer(V, game);
    stampDust(V, now);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    g.drawImage(V.layer, 0, 0);
    // crumble: the broken section's old tiles shrink and fade over the new ground
    let t = now - f.crumbleT;
    if (f.crumbleS >= 0 && t >= 0 && t < F.crumbleMs) {
      const p = t / F.crumbleMs, q = f.crumbleS, tile = V.tiles["m" + B.secMat[q] + "0"], inset = (s * p) / 2;
      g.globalAlpha = 1 - p;
      for (let i = B.secStart[q]; i < B.secStart[q + 1]; i++) { const c = B.secCells[i]; g.drawImage(tile, V.ox + (c % B.w) * s + inset, V.oy + ((c / B.w) | 0) * s + inset * 1.6, s - 2 * inset, s - 2 * inset); }
      g.globalAlpha = 1;
    }
    // shake: redraw the section's tiles from the layer, shifted
    t = now - f.shakeT;
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
    // keep burst
    t = now - game.endT;
    if (st.won && game.endT >= 0 && t >= 0 && t < F.keepBurstMs) {
      const p = t / F.keepBurstMs, cx = V.ox + ((B.keep % B.w) + 0.5) * s, cy = V.oy + (((B.keep / B.w) | 0) + 0.5) * s, R = s * (0.8 + 2.2 * p);
      g.globalAlpha = 1 - p; g.strokeStyle = A.burst; g.lineWidth = Math.max(2, s * 0.12); g.lineCap = "round"; g.beginPath();
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU + p; g.moveTo(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
      g.stroke(); g.globalAlpha = 1;
    }
    // dust
    const D = V.dust, life = F.dustMs, grav = (F.dustGravity * s) / 1e6;
    for (let j = 0; j < D.x.length; j++) {
      const a = now - D.t0[j];
      if (a < 0 || a >= life) continue;
      g.globalAlpha = 1 - a / life; g.fillStyle = A[MATS[D.mat[j]]][(j & 1) * 2];
      g.fillRect(D.x[j] + D.vx[j] * a, D.y[j] + D.vy[j] * a + grav * a * a, D.size[j], D.size[j]);
    }
    g.globalAlpha = 1;
  }

  // ---- cache health (SPEC §5; lessons 27-28) ---------------------------------------------------------------------------
  const OPAQUE_KEYS = ["g0", "g1", "~0", "~1", "m00", "m10", "m20", "m30", "m40", "m01", "m11", "m21", "m31", "m41", "K", "C", "L", "b0", "b1", "b2", "b3", "b4"];
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
  // Which sprite caches read blank at their centre (an evicted backing store reads all zero).
  function blankTiles(V) { const out = []; for (const k of OPAQUE_KEYS) { const c = V.tiles[k]; if (!c || alphaAt(c, c.width / 2, c.height / 2) < 255) out.push(k); } return out; }
  // After the tab comes back: rebuild the sprites if any read blank, and always re-bake the layers. Returns true on a rebuild.
  function check(V) { stale(V); if (!V.cell || !blankTiles(V).length) return false; buildTiles(V); return true; }
  // Test hook: blank every cache the way a discarded backing store would.
  function dropCaches(V) { let n = 0; for (const k in V.tiles) { const c = V.tiles[k]; c.width = c.width; n++; } V.layer.width = V.layer.width; return n; }

  return { create, setLevel, fit, cellAt, cellCenter, icon, draw, busy, spawnDust, blankTiles, check, dropCaches, pixelHash, MATS };
});
