// Greedy Deep — shaft renderer (M2 placeholder art). Click it! Studios, 2026.
// Band rects coloured from JSON, the active vein on one wall, seam dither at every
// band boundary, and the NEXT band drawn below the seam under a dark veil — through
// band d + 1 + revealBonus and no further (PRD 14, M2).
// Real strata tiles, dwarf composites and the scrolling camera land in M3.
(function () {
  "use strict";

  var R = (window.GDRender = {});
  var E = window.GDEngine;
  var cv = null, ctx = null, cfg = null;
  var scale = 2, dpr = 1;
  var floaters = [];
  var strikeT = 0;
  var pulse = 0;
  var lastPlan = { indices: [], veiledIndices: [], maxIndex: 0, cutoffIndex: 0 };

  // cheap deterministic hash for tile variation
  function hash2(x, y) {
    var h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >> 13)) | 0;
    h = Math.imul(h, 1274126177) | 0;
    return (h ^ (h >> 16)) >>> 0;
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r + amt)));
    g = Math.max(0, Math.min(255, Math.round(g + amt)));
    b = Math.max(0, Math.min(255, Math.round(b + amt)));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  R.init = function (canvas, config) {
    cv = canvas; cfg = config; ctx = cv.getContext("2d");
  };
  R.setConfig = function (config) { cfg = config; };

  R.resize = function (s) {
    scale = s;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    var L = cfg.layout;
    cv.style.width = (L.columnBu * s) + "px";
    cv.style.height = (L.shaftBu * s) + "px";
    cv.width = Math.round(L.columnBu * s * dpr);
    cv.height = Math.round(L.shaftBu * s * dpr);
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = "top";
  };

  R.scale = function () { return scale; };

  // --------------------------------------------------------------- geometry
  // The dig face sits at a fixed y. Everything above it is the dug-out bore,
  // everything below is rock the crew has not reached yet.
  //
  // Deep Lantern (`reveal_bands`) raises the cutoff index, but on its own that was
  // invisible: the viewport only looks ~26 m ahead and every band gap past the first
  // is wider than that, so the extra revealed band could never enter frame (critic M2,
  // MAJOR). Each level now buys three observable things, all JSON-tunable:
  //   1. forward bias — the face rides higher, so more of what lies ahead is on screen
  //   2. veil alpha   — revealed-but-unreached rock is dimmed less per level
  //   3. next-bands   — one readout line per revealed band, independent of the viewport
  function effFaceY(revealBonus) {
    var L = cfg.layout, lan = cfg.lantern || {};
    var bias = (revealBonus || 0) * (lan.forwardTilesPerLevel || 0) * L.tileBu;
    var floorY = lan.minFaceYBu === undefined ? L.faceYBu : lan.minFaceYBu;
    return Math.max(floorY, L.faceYBu - bias);
  }
  function effVeilAlpha(revealBonus) {
    var lan = cfg.lantern || {};
    var a = cfg.veil.alpha - (revealBonus || 0) * (lan.veilAlphaPerLevel || 0);
    return Math.max(lan.veilAlphaFloor === undefined ? 0 : lan.veilAlphaFloor, a);
  }
  var curFaceY = null;   // the face the last draw() actually used, for hit-testing
  function faceY() { return curFaceY === null ? cfg.layout.faceYBu : curFaceY; }
  function yOfDepth(depth, current, fy) { return (fy === undefined ? faceY() : fy) + (depth - current) * cfg.layout.buPerMeter; }
  function depthOfY(y, current, fy) { return current + (y - (fy === undefined ? faceY() : fy)) / cfg.layout.buPerMeter; }
  R.effFaceY = effFaceY;
  R.effVeilAlpha = effVeilAlpha;

  // --------------------------------------------------------------- band plan
  // Which bands this frame is allowed to draw, and which of them are veiled.
  // Pure: selfTest calls it directly rather than reading pixels.
  R.bandPlan = function (depth, revealBonus) {
    revealBonus = revealBonus || 0;
    var current = E.bandAt(cfg, depth);
    var cutoff = current.index + 1 + revealBonus;
    var H = cfg.layout.shaftBu;
    var fy = effFaceY(revealBonus);
    var top = depthOfY(0, depth, fy);
    var bottom = depthOfY(H, depth, fy);
    var indices = [], veiled = [], maxIndex = current.index;
    // Walk outward from the shallowest visible band to the deepest one allowed.
    var startIdx = Math.max(0, E.bandAt(cfg, Math.max(0, top)).index);
    for (var i = startIdx; i <= cutoff; i++) {
      var b = E.bandByIndex(cfg, i);
      if (!b) break;
      if (b.startDepth > bottom) break;      // off the bottom of the viewport
      var next = E.bandByIndex(cfg, i + 1);
      if (next && next.startDepth < top) continue; // entirely above the viewport
      indices.push(i);
      if (i > current.index) veiled.push(i);
      if (i > maxIndex) maxIndex = i;
    }
    if (indices.indexOf(current.index) === -1) { indices.push(current.index); indices.sort(function (a, b2) { return a - b2; }); }

    // Every band the lantern reveals, whether or not it fits in frame. This is what
    // the readout and the ribbon draw from, so a second level always shows a second line.
    var nextBands = [];
    for (var k = current.index + 1; k <= cutoff; k++) {
      var nb = E.bandByIndex(cfg, k);
      if (!nb) break;
      nextBands.push({ index: k, id: nb.id, name: nb.name, startDepth: nb.startDepth });
    }

    lastPlan = {
      indices: indices, veiledIndices: veiled, maxIndex: maxIndex,
      cutoffIndex: cutoff, currentIndex: current.index,
      revealBonus: revealBonus,
      faceYBu: fy,
      forwardBiasBu: cfg.layout.faceYBu - fy,
      forwardMeters: (H - fy) / cfg.layout.buPerMeter,
      veilAlpha: effVeilAlpha(revealBonus),
      nextBands: nextBands
    };
    return lastPlan;
  };
  R.lastPlan = function () { return lastPlan; };

  // --------------------------------------------------------------- vein hotspot
  R.veinRect = function () {
    var v = cfg.vein;
    var y = v.aboveFaceBu === undefined ? v.yBu : (faceY() - v.aboveFaceBu);
    return { x: v.xBu, y: Math.max(cfg.layout.tileBu * 2, y), w: v.wBu, h: v.hBu };
  };

  R.hitVein = function (cssX, cssY) {
    var r = R.veinRect();
    var x = cssX / scale, y = cssY / scale;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  };

  R.strike = function () { strikeT = cfg.vein.strikeFlashSeconds; };

  R.addFloater = function (text, color) {
    var v = cfg.vein, r = R.veinRect();
    if (floaters.length >= v.maxFloaters) floaters.shift();
    floaters.push({ text: text, t: 0, color: color || "#ffe89a", x: r.x + r.w * 0.5 + (Math.random() * 8 - 4), y: r.y });
  };

  R.update = function (dt) {
    pulse += dt;
    if (strikeT > 0) strikeT -= dt;
    for (var i = floaters.length - 1; i >= 0; i--) {
      floaters[i].t += dt;
      if (floaters[i].t >= cfg.vein.floaterSeconds) floaters.splice(i, 1);
    }
  };

  // --------------------------------------------------------------- rock
  function drawRockRow(band, x0, w, y, tyBase, col, h) {
    var T = cfg.layout.tileBu;
    if (h === undefined) h = T;
    if (h <= 0) return;
    var v = hash2(col, tyBase) & 3;
    ctx.fillStyle = shade(band.wallColor, v * 6 - 9);
    ctx.fillRect(x0, y, w, h);
    if (h < 4) return;
    var g = hash2(col + 31, tyBase + 7);
    ctx.fillStyle = shade(band.color, 10);
    ctx.fillRect(x0 + (g % Math.max(1, w - 4)) + 2, y + ((g >> 4) % Math.max(1, h - 4)) + 2, 2, 2);
    ctx.fillRect(x0 + ((g >> 8) % Math.max(1, w - 3)) + 1, y + ((g >> 12) % Math.max(1, h - 2)) + 1, 1, 1);
    if (v === 3) {
      ctx.fillStyle = shade(band.wallColor, -22);
      ctx.fillRect(x0 + 4, y + 3, 1, Math.min(9, h - 3));
      ctx.fillRect(x0 + 5, y + 8, 1, Math.max(0, Math.min(5, h - 8)));
    }
  }

  // 2 px checker dither of the next band's base at 25% then 50% density on the last
  // two rows above the seam (PRD 6).
  function drawSeam(nextBand, y, x0, w) {
    var rows = cfg.veil.seamRows || 2;
    for (var r = 0; r < rows; r++) {
      var density = (r + 1) / (rows + 1) * 2; // 0.66 then 1.33 -> stepped checker
      var yy = y - (rows - r) * 2;
      ctx.fillStyle = nextBand.wallColor;
      for (var x = x0; x < x0 + w; x += 2) {
        if (((x >> 1) + r) % 2 === 0 || density > 1) ctx.fillRect(x, yy, 2, 2);
      }
    }
  }

  function drawVeil(y, h, x0, w, alpha) {
    var v = cfg.veil;
    ctx.fillStyle = "rgba(" + v.color + "," + (alpha === undefined ? v.alpha : alpha) + ")";
    ctx.fillRect(x0, y, w, h);
    ctx.fillStyle = "rgba(" + v.color + "," + v.scanlineAlpha + ")";
    for (var yy = Math.ceil(y); yy < y + h; yy += 2) ctx.fillRect(x0, yy, w, 1);
  }

  // --------------------------------------------------------------- draw
  R.draw = function (state, derived) {
    var L = cfg.layout;
    var W = L.columnBu, H = L.shaftBu, T = L.tileBu;
    var wallW = L.wallTiles * T;                 // 48
    var boreX = wallW, boreW = L.boreTiles * T;  // 48..112
    var rightX = boreX + boreW;                  // 112
    var ribbonX = W - L.ribbonBu;
    var depth = state.depth;

    var plan = R.bandPlan(depth, derived.revealBonus || 0);
    var cutoff = plan.cutoffIndex;
    var currentIndex = derived.band.index;
    var fy = plan.faceYBu;
    curFaceY = fy;   // hit-testing and floaters follow the face the lantern bought

    ctx.fillStyle = "#0a0810";
    ctx.fillRect(0, 0, W, H);

    // ---- rock rows, band-coloured, clipped to the reveal cutoff
    var off = (depth * L.buPerMeter) % T;
    var rowTop = Math.floor((depth * L.buPerMeter) / T);
    var rows = Math.ceil(H / T) + 2;
    for (var r = -1; r < rows; r++) {
      var y = Math.round(fy + r * T - off) - T * Math.ceil(fy / T);
      if (y > H || y + T < 0) continue;
      var ty = rowTop + r - Math.ceil(fy / T);
      var rowDepth = depthOfY(y + T / 2, depth, fy);
      var band = E.bandAt(cfg, Math.max(0, rowDepth));
      if (band.index > cutoff) continue;              // beyond the lantern: undrawn dark

      // walls both sides, always rock
      for (var side = 0; side < 2; side++) {
        var x0 = side === 0 ? 0 : rightX;
        for (var c = 0; c < L.wallTiles; c++) {
          drawRockRow(band, x0 + c * T, T, y, ty, side === 0 ? c : c + 10);
        }
        ctx.fillStyle = shade(band.wallColor, -30);
        ctx.fillRect(side === 0 ? wallW - 2 : rightX, y, 2, T);
        ctx.fillStyle = shade(band.wallColor, 16);
        ctx.fillRect(side === 0 ? wallW - 3 : rightX + 2, y, 1, T);
      }

      // the bore: void above the dig face, unmined rock below it
      if (y + T > fy) {
        var solidTop = Math.max(y, fy);
        var solidH = y + T - solidTop;
        drawRockRow(band, boreX, boreW, solidTop, ty, 5, solidH);
        ctx.fillStyle = "rgba(0,0,0,.25)";
        ctx.fillRect(boreX, solidTop, boreW, Math.min(2, solidH));
      } else {
        if (ty % L.braceEveryRows === 0) {
          ctx.fillStyle = "#5a3f26";
          ctx.fillRect(boreX, y + 2, boreW, 3);
          ctx.fillStyle = "#3d2a19";
          ctx.fillRect(boreX, y + 5, boreW, 1);
        }
        ctx.fillStyle = "#6b4c2c";
        ctx.fillRect(boreX + 3, y, 2, T);
        ctx.fillRect(boreX + 9, y, 2, T);
        ctx.fillStyle = "#8a6438";
        ctx.fillRect(boreX + 3, y + 6, 8, 2);
      }

    }

    // ---- the veil: one overlay from the shallowest revealed-but-unreached band down
    if (plan.veiledIndices.length) {
      var firstVeiled = E.bandByIndex(cfg, plan.veiledIndices[0]);
      var vy = Math.max(0, yOfDepth(firstVeiled.startDepth, depth, fy));
      if (vy < H) drawVeil(vy, H - vy, 0, W - L.ribbonBu, plan.veilAlpha);
    }

    // ---- seams and the next band's tease vein
    for (var pi = 0; pi < plan.indices.length; pi++) {
      var idx = plan.indices[pi];
      if (idx === 0) continue;
      var b = E.bandByIndex(cfg, idx);
      var sy = yOfDepth(b.startDepth, depth, fy);
      if (sy < -8 || sy > H + 8) continue;
      drawSeam(b, sy, 0, W - L.ribbonBu);
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, sy, W - L.ribbonBu, 1);
      if (idx > currentIndex) {
        // the tease: the next band's vein, glinting through the veil at half amplitude
        var ty2 = yOfDepth(b.startDepth + cfg.vein.teaseOffsetM, depth, fy);
        if (ty2 > 0 && ty2 < H - 10) {
          ctx.fillStyle = b.veinColor;
          ctx.globalAlpha = 0.55;
          ctx.fillRect(8, ty2, 18, 6);
          ctx.fillRect(rightX + 6, ty2 + 6, 16, 5);
          ctx.fillStyle = b.glintColor;
          ctx.globalAlpha = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(pulse * 3.2));
          ctx.fillRect(14, ty2 + 2, 2, 2);
          ctx.fillRect(rightX + 12, ty2 + 8, 2, 2);
          ctx.globalAlpha = 1;
        }
      }
    }

    // ---- bore lighting
    var grd = ctx.createLinearGradient(boreX, 0, boreX + boreW, 0);
    grd.addColorStop(0, "rgba(120,96,60,0.10)");
    grd.addColorStop(0.55, "rgba(0,0,0,0)");
    grd.addColorStop(1, "rgba(0,0,0,0.30)");
    ctx.fillStyle = grd;
    ctx.fillRect(boreX, 0, boreW, fy);

    // ---- working ledge + dwarves at the dig face
    var n = Math.min(derived.dwarves, 8);
    for (var i = 0; i < n; i++) {
      var dx = boreX + 6 + (i % 3) * 16;
      var dy = fy - 18 - Math.floor(i / 3) * 20 + Math.round(Math.sin(pulse * 3 + i) * 1.5);
      if (dy < 2) continue;
      ctx.fillStyle = "#c9a227";
      ctx.fillRect(dx, dy + 8, 10, 6);
      ctx.fillStyle = "#e8cfa0";
      ctx.fillRect(dx + 2, dy + 3, 6, 5);
      ctx.fillStyle = "#b9b2a6";
      ctx.fillRect(dx + 1, dy + 7, 8, 3);
      ctx.fillStyle = "#7a4a22";
      ctx.fillRect(dx + 1, dy, 8, 3);
      ctx.fillStyle = "#9aa3ad";
      ctx.fillRect(dx + 10, dy + 2 + (Math.sin(pulse * 6 + i) > 0 ? 0 : 3), 5, 2);
    }
    // the cut face itself
    ctx.fillStyle = "rgba(255,226,150,.10)";
    ctx.fillRect(boreX, fy - 2, boreW, 2);

    // ---- the active vein (current band, right wall)
    var vr = R.veinRect();
    var band0 = derived.band;
    var glow = 0.5 + 0.5 * Math.sin((pulse / cfg.vein.glintPeriodSeconds) * Math.PI * 2);
    ctx.fillStyle = shade(band0.wallColor, -18);
    ctx.fillRect(vr.x - 1, vr.y - 1, vr.w + 2, vr.h + 2);
    ctx.fillStyle = band0.veinColor;
    ctx.fillRect(vr.x + 3, vr.y + 5, 20, 7);
    ctx.fillRect(vr.x + 6, vr.y + 12, 16, 6);
    ctx.fillRect(vr.x + 2, vr.y + 16, 12, 5);
    ctx.fillStyle = shade(band0.veinColor, 46);
    ctx.fillRect(vr.x + 3, vr.y + 5, 20, 1);
    ctx.fillRect(vr.x + 6, vr.y + 12, 16, 1);
    ctx.fillRect(vr.x + 2, vr.y + 16, 12, 1);
    ctx.fillStyle = shade(band0.veinColor, 24);
    ctx.fillRect(vr.x + 13, vr.y + 6, 3, 6);
    ctx.fillRect(vr.x + 8, vr.y + 17, 2, 4);
    ctx.fillStyle = band0.glintColor;
    ctx.globalAlpha = 0.35 + 0.65 * glow;
    ctx.fillRect(vr.x + 9, vr.y + 8, 3, 3);
    ctx.fillRect(vr.x + 16, vr.y + 14, 2, 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,226,150," + (0.25 + 0.35 * glow) + ")";
    ctx.lineWidth = 1;
    ctx.strokeRect(vr.x + 0.5, vr.y + 0.5, vr.w - 1, vr.h - 1);
    if (strikeT > 0) {
      ctx.fillStyle = "rgba(255,240,200," + (strikeT / cfg.vein.strikeFlashSeconds) * 0.8 + ")";
      ctx.fillRect(vr.x, vr.y, vr.w, vr.h);
    }

    // ---- depth readout
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,.62)";
    ctx.fillRect(boreX + 2, 6, boreW - 4, 22);
    ctx.font = "bold 9px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "#e9dcb6";
    ctx.fillText(depth.toFixed(1) + " m", boreX + boreW / 2, 8);
    ctx.font = "6px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "#8d857a";
    ctx.fillText(band0.name.toUpperCase(), boreX + boreW / 2, 19);

    // ---- floaters
    for (var f = 0; f < floaters.length; f++) {
      var fl = floaters[f];
      var k = fl.t / cfg.vein.floaterSeconds;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = fl.color;
      ctx.font = "bold 8px ui-monospace, Menlo, monospace";
      ctx.fillText(fl.text, fl.x, fl.y - k * cfg.vein.floaterRiseBu);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";

    // ---- depth ribbon
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(ribbonX, 0, L.ribbonBu, H);
    var frac = cfg.milestone ? Math.min(1, depth / cfg.milestone.depth) : 0;
    ctx.fillStyle = "#3a2f1a";
    ctx.fillRect(ribbonX + 1, 0, L.ribbonBu - 2, H);
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(ribbonX + 1, 0, L.ribbonBu - 2, Math.round(frac * H));
    // Only bands the lantern has revealed get a tick. A second Deep Lantern level puts a
    // second mark on the ribbon; without one, the deeper boundaries stay secret.
    ctx.fillStyle = "rgba(255,255,255,.14)";
    for (var oi = 0; oi <= Math.min(cutoff, cfg.ores.length - 1); oi++) {
      var m = Math.round((cfg.ores[oi].startDepth / cfg.milestone.depth) * H);
      if (m >= 0 && m < H) ctx.fillRect(ribbonX, m, L.ribbonBu, 1);
    }
  };
})();
