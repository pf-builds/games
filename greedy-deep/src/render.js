// Greedy Deep — shaft renderer (M1 placeholder art). Click it! Studios, 2026.
// Banded rects, one active vein hotspot, a depth readout, dwarf blips on the ledges.
// Real strata tiles, dither seams, veil and sprites land in M3.
(function () {
  "use strict";

  var R = (window.GDRender = {});
  var cv = null, ctx = null, cfg = null;
  var scale = 2, dpr = 1;
  var floaters = [];
  var strikeT = 0;
  var pulse = 0;

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

  // vein hotspot in bu
  R.veinRect = function () {
    var v = cfg.vein;
    return { x: v.xBu, y: v.yBu, w: v.wBu, h: v.hBu };
  };

  R.hitVein = function (cssX, cssY) {
    var r = R.veinRect();
    var x = cssX / scale, y = cssY / scale;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  };

  R.strike = function () { strikeT = cfg.vein.strikeFlashSeconds; };

  R.addFloater = function (text) {
    var v = cfg.vein;
    if (floaters.length >= v.maxFloaters) floaters.shift();
    floaters.push({ text: text, t: 0, x: v.xBu + v.wBu * 0.5 + (Math.random() * 8 - 4), y: v.yBu });
  };

  R.update = function (dt) {
    pulse += dt;
    if (strikeT > 0) strikeT -= dt;
    for (var i = floaters.length - 1; i >= 0; i--) {
      floaters[i].t += dt;
      if (floaters[i].t >= cfg.vein.floaterSeconds) floaters.splice(i, 1);
    }
  };

  R.draw = function (state, derived) {
    var L = cfg.layout, band = derived.band;
    var W = L.columnBu, H = L.shaftBu, T = L.tileBu;
    var wallW = L.wallTiles * T;              // 48
    var boreX = wallW, boreW = L.boreTiles * T; // 48..112
    var rightX = boreX + boreW;                // 112
    var ribbonX = W - L.ribbonBu;

    // ---- bore (the dug-out void)
    ctx.fillStyle = "#0a0810";
    ctx.fillRect(0, 0, W, H);

    // ---- scrolling rock walls
    var off = (state.depth * L.buPerMeter) % T;
    var rowTop = Math.floor((state.depth * L.buPerMeter) / T);
    var rows = Math.ceil(H / T) + 1;
    for (var r = 0; r < rows; r++) {
      var y = Math.round(r * T - off);
      var ty = rowTop + r;
      for (var side = 0; side < 2; side++) {
        var x0 = side === 0 ? 0 : rightX;
        for (var c = 0; c < L.wallTiles; c++) {
          var tx = side === 0 ? c : c + 10;
          var v = hash2(tx, ty) & 3;
          var x = x0 + c * T;
          ctx.fillStyle = shade(band.wallColor, v * 6 - 9);
          ctx.fillRect(x, y, T, T);
          // speckle motif
          var h = hash2(tx + 31, ty + 7);
          ctx.fillStyle = shade(band.color, 10);
          ctx.fillRect(x + (h % 11) + 2, y + ((h >> 4) % 11) + 2, 2, 2);
          ctx.fillRect(x + ((h >> 8) % 12) + 1, y + ((h >> 12) % 12) + 1, 1, 1);
          if (v === 3) { // crack motif
            ctx.fillStyle = shade(band.wallColor, -22);
            ctx.fillRect(x + 4, y + 3, 1, 9);
            ctx.fillRect(x + 5, y + 8, 1, 5);
          }
        }
        // cut face bevel toward the bore
        ctx.fillStyle = shade(band.wallColor, -30);
        ctx.fillRect(side === 0 ? wallW - 2 : rightX, y, 2, T);
        ctx.fillStyle = shade(band.wallColor, 16);
        ctx.fillRect(side === 0 ? wallW - 3 : rightX + 2, y, 1, T);
      }

      // timber brace across the bore every N rows
      if (ty % L.braceEveryRows === 0) {
        ctx.fillStyle = "#5a3f26";
        ctx.fillRect(boreX, y + 2, boreW, 3);
        ctx.fillStyle = "#3d2a19";
        ctx.fillRect(boreX, y + 5, boreW, 1);
      }

      // ladder on the left face of the bore
      ctx.fillStyle = "#6b4c2c";
      ctx.fillRect(boreX + 3, y, 2, T);
      ctx.fillRect(boreX + 9, y, 2, T);
      ctx.fillStyle = "#8a6438";
      ctx.fillRect(boreX + 3, y + 6, 8, 2);
    }

    // ---- bore lighting: lit near the ladder, swallowed toward the bottom
    var grd = ctx.createLinearGradient(boreX, 0, boreX + boreW, 0);
    grd.addColorStop(0, "rgba(120,96,60,0.10)");
    grd.addColorStop(0.55, "rgba(0,0,0,0)");
    grd.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = grd;
    ctx.fillRect(boreX, 0, boreW, H);
    var vgd = ctx.createLinearGradient(0, H * 0.45, 0, H);
    vgd.addColorStop(0, "rgba(4,3,7,0)");
    vgd.addColorStop(1, "rgba(4,3,7,0.85)");
    ctx.fillStyle = vgd;
    ctx.fillRect(boreX, 0, boreW, H);

    // ---- working ledge + dwarves (one blip per hire, capped by the space we have)
    var n = Math.min(derived.dwarves, 8);
    if (n > 0) {
      ctx.fillStyle = shade(band.wallColor, -26);
      ctx.fillRect(boreX + 12, 186, boreW - 16, 3);
      ctx.fillStyle = shade(band.wallColor, 4);
      ctx.fillRect(boreX + 12, 186, boreW - 16, 1);
      if (n > 3) {
        ctx.fillStyle = shade(band.wallColor, -26);
        ctx.fillRect(boreX + 12, 208, boreW - 16, 3);
        ctx.fillStyle = shade(band.wallColor, 4);
        ctx.fillRect(boreX + 12, 208, boreW - 16, 1);
      }
    }
    for (var i = 0; i < n; i++) {
      var dx = boreX + 16 + (i % 3) * 14;
      var dy = 172 + Math.floor(i / 3) * 22 + Math.round(Math.sin(pulse * 3 + i) * 1.5);
      ctx.fillStyle = "#c9a227";
      ctx.fillRect(dx, dy + 8, 10, 6);          // tunic
      ctx.fillStyle = "#e8cfa0";
      ctx.fillRect(dx + 2, dy + 3, 6, 5);       // face
      ctx.fillStyle = "#b9b2a6";
      ctx.fillRect(dx + 1, dy + 7, 8, 3);       // beard
      ctx.fillStyle = "#7a4a22";
      ctx.fillRect(dx + 1, dy, 8, 3);           // cap
      ctx.fillStyle = "#9aa3ad";
      ctx.fillRect(dx + 10, dy + 2 + (Math.sin(pulse * 6 + i) > 0 ? 0 : 3), 5, 2); // pick
    }

    // ---- the active vein
    var vr = R.veinRect();
    var glow = 0.5 + 0.5 * Math.sin((pulse / cfg.vein.glintPeriodSeconds) * Math.PI * 2);
    ctx.fillStyle = shade(band.wallColor, -18);
    ctx.fillRect(vr.x - 1, vr.y - 1, vr.w + 2, vr.h + 2);
    ctx.fillStyle = band.veinColor;
    ctx.fillRect(vr.x + 3, vr.y + 5, 20, 7);
    ctx.fillRect(vr.x + 6, vr.y + 12, 16, 6);
    ctx.fillRect(vr.x + 2, vr.y + 16, 12, 5);
    // facets, so the ore reads as chunks and not as a hole in the wall
    ctx.fillStyle = shade(band.veinColor, 46);
    ctx.fillRect(vr.x + 3, vr.y + 5, 20, 1);
    ctx.fillRect(vr.x + 6, vr.y + 12, 16, 1);
    ctx.fillRect(vr.x + 2, vr.y + 16, 12, 1);
    ctx.fillStyle = shade(band.veinColor, 24);
    ctx.fillRect(vr.x + 13, vr.y + 6, 3, 6);
    ctx.fillRect(vr.x + 8, vr.y + 17, 2, 4);
    ctx.fillStyle = band.glintColor;
    ctx.globalAlpha = 0.35 + 0.65 * glow;
    ctx.fillRect(vr.x + 9, vr.y + 8, 3, 3);
    ctx.fillRect(vr.x + 16, vr.y + 14, 2, 2);
    ctx.globalAlpha = 1;
    // clickable ring
    ctx.strokeStyle = "rgba(255,226,150," + (0.25 + 0.35 * glow) + ")";
    ctx.lineWidth = 1;
    ctx.strokeRect(vr.x + 0.5, vr.y + 0.5, vr.w - 1, vr.h - 1);
    if (strikeT > 0) {
      ctx.fillStyle = "rgba(255,240,200," + (strikeT / cfg.vein.strikeFlashSeconds) * 0.8 + ")";
      ctx.fillRect(vr.x, vr.y, vr.w, vr.h);
    }

    // ---- depth readout in the bore
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,.62)";
    ctx.fillRect(boreX + 2, 6, boreW - 4, 22);
    ctx.font = "bold 9px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "#e9dcb6";
    ctx.fillText(state.depth.toFixed(1) + " m", boreX + boreW / 2, 8);
    ctx.font = "6px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "#8d857a";
    ctx.fillText(band.name.toUpperCase(), boreX + boreW / 2, 19);

    // ---- floaters
    for (var f = 0; f < floaters.length; f++) {
      var fl = floaters[f];
      var k = fl.t / cfg.vein.floaterSeconds;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = "#ffe89a";
      ctx.font = "bold 8px ui-monospace, Menlo, monospace";
      ctx.fillText(fl.text, fl.x, fl.y - k * cfg.vein.floaterRiseBu);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";

    // ---- depth ribbon
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(ribbonX, 0, L.ribbonBu, H);
    var mark = (state.depth * L.buPerMeter) % H;
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(ribbonX + 1, H - mark - 2, L.ribbonBu - 2, 2);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    for (var m = 0; m < H; m += 32) ctx.fillRect(ribbonX + 1, m, L.ribbonBu - 2, 1);
  };
})();
