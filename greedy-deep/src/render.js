// Greedy Deep — shaft renderer (M3 art pass). Click it! Studios, 2026.
//
// Everything on the canvas is a pre-rendered sprite from `src/sprites.js` blitted at
// integer coordinates. There are no placeholder rects left: if a band ever fails to
// produce tiles the fallback fill is counted in `stats.placeholderRects`, and
// selfTest fails on a non-zero count.
//
// Coordinates: world space is "bu below the surface", i.e. `depth * buPerMeter`.
// `cam.topBu` is the world y drawn at screen y 0, so screen y = worldY - cam.topBu.
// The camera follows the dig face (and therefore the deepest dwarf) with easing and
// the Deep Lantern's forward bias; drag or wheel looks back up; it snaps back after
// `camera.snapBackMs` of no input.
(function () {
  "use strict";

  var R = (window.GDRender = {});
  var E = window.GDEngine;
  var SP = window.GDSprites;
  var cv = null, ctx = null, cfg = null;
  var scale = 2, dpr = 1;
  var floaters = [];
  var strikeT = 0;
  var pulse = 0;
  var lastPlan = { indices: [], veiledIndices: [], maxIndex: 0, cutoffIndex: 0 };
  var stats = { tileBlits: 0, placeholderRects: 0, seams: 0, veiled: 0, dwarves: 0, maxDrawnIndex: 0, maxVeiledIndex: -1, frames: 0 };

  // ------------------------------------------------------------------ camera
  var cam = { topBu: null, userBu: 0, idleMs: 0, dragging: false, snapped: 0 };
  var deepestDwarfY = 0;

  function camCfg() { return cfg.camera || { ease: 0.12, snapBackMs: 3000, maxUpBu: 480, snapEase: 0.06, snapThresholdBu: 512 }; }

  R.cameraNudge = function (dBu, dragging) {
    var C = camCfg();
    cam.userBu = Math.max(-(C.maxUpBu || 480), Math.min(0, cam.userBu + dBu));
    cam.idleMs = 0;
    cam.dragging = !!dragging;
  };
  R.cameraRelease = function () { cam.dragging = false; cam.idleMs = 0; };
  R.cameraSnap = function () { cam.topBu = null; cam.userBu = 0; cam.idleMs = 0; cam.snapped++; };
  R.cameraState = function () { return { topBu: cam.topBu, userBu: cam.userBu, idleMs: cam.idleMs, focusY: focusY(), deepestDwarfY: deepestDwarfY }; };
  function focusY() { return (cam.topBu === null ? 0 : cam.topBu) + effFaceY(lastPlan.revealBonus || 0); }

  // ------------------------------------------------------------------ colour
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) + amt)));
    var g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) + amt)));
    var b = Math.max(0, Math.min(255, Math.round((n & 255) + amt)));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  R.init = function (canvas, config) {
    cv = canvas; cfg = config; ctx = cv.getContext("2d", { alpha: false });
    SP.build(cfg);
  };
  R.setConfig = function (config) {
    cfg = config;
    veinChunks.clear();
    SP.build(cfg);
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
  R.stats = function () { stats.pulse = pulse; return stats; };

  // --------------------------------------------------------------- geometry
  // Deep Lantern (`reveal_bands`) raises the render cutoff, and each level also buys
  // forward bias (the face rides higher, so more of what lies ahead is on screen),
  // a lighter veil, and one more line in the next-bands readout. All JSON-driven.
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
  var curFaceY = null;
  function faceY() { return curFaceY === null ? cfg.layout.faceYBu : curFaceY; }
  function yOfDepth(depth, current, fy) { return (fy === undefined ? faceY() : fy) + (depth - current) * cfg.layout.buPerMeter; }
  function depthOfY(y, current, fy) { return current + (y - (fy === undefined ? faceY() : fy)) / cfg.layout.buPerMeter; }
  R.effFaceY = effFaceY;
  R.effVeilAlpha = effVeilAlpha;

  // --------------------------------------------------------------- band plan
  // Unchanged M2 contract: which bands this frame may draw, which of them are veiled,
  // the cutoff, the lantern's forward bias and veil alpha, and the next-bands readout.
  // Pure — selfTest calls it directly rather than reading pixels. The camera does not
  // enter here: the plan describes the settled viewport, and the draw loop clips the
  // bands it actually paints to `cutoffIndex` whatever the camera is doing.
  R.bandPlan = function (depth, revealBonus) {
    revealBonus = revealBonus || 0;
    var current = E.bandAt(cfg, depth);
    var cutoff = current.index + 1 + revealBonus;
    var H = cfg.layout.shaftBu;
    var fy = effFaceY(revealBonus);
    var top = depthOfY(0, depth, fy);
    var bottom = depthOfY(H, depth, fy);
    var indices = [], veiled = [], maxIndex = current.index;
    var startIdx = Math.max(0, E.bandAt(cfg, Math.max(0, top)).index);
    for (var i = startIdx; i <= cutoff; i++) {
      var b = E.bandByIndex(cfg, i);
      if (!b) break;
      if (b.startDepth > bottom) break;
      var next = E.bandByIndex(cfg, i + 1);
      if (next && next.startDepth < top) continue;
      indices.push(i);
      if (i > current.index) veiled.push(i);
      if (i > maxIndex) maxIndex = i;
    }
    if (indices.indexOf(current.index) === -1) { indices.push(current.index); indices.sort(function (a, b2) { return a - b2; }); }

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

  // --------------------------------------------------------------- veins as data
  // A vein is data, never baked into a tile, so depletion or a palette change is a
  // redraw of one blob. Generated per 64 bu chunk of world depth from a hash, cached,
  // so an endless run never grows an array and a frame allocates nothing.
  var CHUNK = 64;
  var veinChunks = new Map();
  function chunkVeins(ci) {
    var a = veinChunks.get(ci);
    if (a) return a;
    a = [];
    var h = SP.hash2(ci, 9173);
    var n = h % 3;
    for (var i = 0; i < n; i++) {
      var h2 = SP.hash2(ci * 7 + i, 4421);
      a.push({
        side: h2 & 1,
        x: (h2 >>> 1) % 34,
        y: ci * CHUNK + ((h2 >>> 8) % CHUNK),
        w: 3 + ((h2 >>> 14) % 5),
        h: 2 + ((h2 >>> 18) % 3),
        gx: (h2 >>> 22) % 3,
        gy: (h2 >>> 24) % 2,
        ph: ((h2 >>> 26) % 32) / 32
      });
    }
    if (veinChunks.size > 512) veinChunks.clear();
    veinChunks.set(ci, a);
    return a;
  }

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

  // --------------------------------------------------------------- update
  R.update = function (dt, state, derived) {
    if (!(dt > 0)) dt = 0;          // never run the animation clock backwards
    pulse += dt;
    if (strikeT > 0) strikeT -= dt;
    for (var i = floaters.length - 1; i >= 0; i--) {
      floaters[i].t += dt;
      if (floaters[i].t >= cfg.vein.floaterSeconds) floaters.splice(i, 1);
    }
    if (state) stepCamera(dt, state, derived);
  };

  function stepCamera(dt, state, derived) {
    var C = camCfg();
    var L = cfg.layout;
    var fy = effFaceY((derived && derived.revealBonus) || 0);
    var faceWorld = state.depth * L.buPerMeter;
    var want = faceWorld - fy;

    if (!cam.dragging) {
      cam.idleMs += dt * 1000;
      if (cam.idleMs >= (C.snapBackMs === undefined ? 3000 : C.snapBackMs) && cam.userBu !== 0) {
        var sk = 1 - Math.pow(1 - (C.snapEase || 0.06), Math.min(4, dt * 60));
        cam.userBu += (0 - cam.userBu) * sk;
        if (Math.abs(cam.userBu) < 0.5) cam.userBu = 0;
      }
    }

    var target = want + cam.userBu;
    if (cam.topBu === null || Math.abs(target - cam.topBu) > (C.snapThresholdBu || 512)) {
      cam.topBu = target;                      // first frame, or a debug teleport
      return;
    }
    var k = 1 - Math.pow(1 - (C.ease || 0.12), Math.min(4, dt * 60));
    cam.topBu += (target - cam.topBu) * k;
  }

  // --------------------------------------------------------------- draw
  R.draw = function (state, derived) {
    var L = cfg.layout;
    var W = L.columnBu, H = L.shaftBu, T = L.tileBu;
    var wallW = L.wallTiles * T;                 // 48
    var boreX = wallW, boreW = L.boreTiles * T;  // 48..112
    var rightX = boreX + boreW;                  // 112
    var ribbonX = W - L.ribbonBu;
    var contentW = W - L.ribbonBu;
    var depth = state.depth;
    var owned = state.owned || {};

    var plan = R.bandPlan(depth, derived.revealBonus || 0);
    var cutoff = plan.cutoffIndex;
    var fy = plan.faceYBu;
    curFaceY = fy;

    if (cam.topBu === null) cam.topBu = depth * L.buPerMeter - fy;
    var top = Math.round(cam.topBu);
    var faceWorld = depth * L.buPerMeter;
    var faceScreenY = Math.round(faceWorld - top);

    stats.frames++;
    stats.tileBlits = 0; stats.placeholderRects = 0; stats.seams = 0; stats.veiled = 0;
    stats.dwarves = 0; stats.maxDrawnIndex = 0; stats.maxVeiledIndex = -1;

    ctx.fillStyle = "#0a0810";
    ctx.fillRect(0, 0, W, H);

    // ---------------------------------------------------------- strata tiles
    // Zero allocation below: integer arithmetic and cached canvases only.
    var row0 = Math.floor(top / T);
    var rowN = Math.ceil((top + H) / T);
    var band, tset, y, ty, tx, rowDepth, i, c;
    for (ty = row0; ty <= rowN; ty++) {
      y = ty * T - top;
      rowDepth = (ty * T + (T >> 1)) / L.buPerMeter;
      band = E.bandAt(cfg, rowDepth < 0 ? 0 : rowDepth);
      if (band.index > cutoff) continue;
      if (band.index > stats.maxDrawnIndex) stats.maxDrawnIndex = band.index;
      tset = SP.tilesFor(band);
      if (!tset || !tset.length) {
        ctx.fillStyle = band.wallColor || "#332d3c";
        ctx.fillRect(0, y, contentW, T);
        stats.placeholderRects++;
        continue;
      }
      // left wall (3 tiles), right wall (3 tiles)
      for (tx = 0; tx < L.wallTiles; tx++) {
        ctx.drawImage(tset[SP.hash2(tx, ty) & 3], tx * T, y);
        ctx.drawImage(tset[SP.hash2(tx + 100, ty) & 3], rightX + tx * T, y);
        stats.tileBlits += 2;
      }
      // the bore: solid rock below the dig face, dug-out air above it. The air is not
      // empty — it shows the far wall of the cutaway, the same tiles in shadow.
      if (y + T > faceScreenY) {
        var solidTop = y > faceScreenY ? y : faceScreenY;
        var solidH = y + T - solidTop;
        if (solidH > 0) {
          ctx.save();
          ctx.beginPath(); ctx.rect(boreX, solidTop, boreW, solidH); ctx.clip();
          for (tx = 0; tx < L.boreTiles; tx++) {
            ctx.drawImage(tset[SP.hash2(tx + 200, ty) & 3], boreX + tx * T, y);
            stats.tileBlits++;
          }
          ctx.restore();
        }
      }
      if (y < faceScreenY) {
        var airH = (y + T < faceScreenY ? y + T : faceScreenY) - y;
        if (airH > 0) {
          var backs = SP.backTilesFor(band);
          ctx.save();
          ctx.beginPath(); ctx.rect(boreX, y, boreW, airH); ctx.clip();
          for (tx = 0; tx < L.boreTiles; tx++) {
            ctx.drawImage(backs[SP.hash2(tx + 300, ty) & 3], boreX + tx * T, y);
            stats.tileBlits++;
          }
          ctx.restore();
        }
      }
    }

    // ---------------------------------------------------------- shaft carve
    // 2 bu bevel on each cut face: light on the left face, shadow on the right, so
    // the bore reads as carved rock rather than a hole punched in a texture.
    var curBand = derived.band;
    var bev = SP.paletteFor(curBand);
    var bevLit = SP.shade(bev.base, 1.4), bevDark = SP.shade(bev.base, 0.45);
    var cutBottom = Math.max(0, Math.min(H, faceScreenY));
    for (ty = row0; ty <= rowN; ty++) {
      y = ty * T - top;
      if (y >= cutBottom) break;
      var eh = (y + T > cutBottom ? cutBottom : y + T) - y;
      if (eh <= 0 || y + T < 0) continue;
      var hj = SP.hash2(ty, 7717);
      var jl = hj & 1, jr = (hj >>> 4) & 1;
      ctx.fillStyle = bevLit;
      ctx.fillRect(boreX - 2 - jl, y, 2 + jl, eh);
      ctx.fillStyle = bevDark;
      ctx.fillRect(rightX, y, 2 + jr, eh);
      if ((hj >>> 8) & 1) { ctx.fillStyle = bevDark; ctx.fillRect(boreX - 1, y + (hj % 10), 1, 2); }
    }

    // ladder down the left face + timber braces every `braceEveryRows` rows
    var ladderC = SP.ladder(), braceC = SP.brace();
    var lad4 = T * 4;
    var lTop = Math.floor(top / lad4) * lad4;
    for (var ly = lTop; ly < top + H; ly += lad4) {
      var lsy = ly - top;
      if (lsy > faceScreenY) break;
      ctx.save();
      ctx.beginPath(); ctx.rect(boreX, 0, boreW, Math.max(0, Math.min(H, faceScreenY))); ctx.clip();
      ctx.drawImage(ladderC, boreX + 1, lsy);
      ctx.restore();
    }
    var braceStep = L.braceEveryRows * T;
    var bTop = Math.floor(top / braceStep) * braceStep;
    var bracesOwned = owned.braces || 0;
    for (var by = bTop; by < top + H; by += braceStep) {
      var bsy = by - top;
      if (bsy > faceScreenY - 4) break;
      if (bsy < -T) continue;
      ctx.drawImage(braceC, boreX, bsy);
      if (bracesOwned > 0) {           // purchase visibility: bought braces are doubled up
        ctx.fillStyle = "#9C7A46";
        ctx.fillRect(boreX, bsy + 6, boreW, 1);
        ctx.fillStyle = "#3d2a19";
        ctx.fillRect(boreX, bsy + 7, boreW, 1);
      }
    }

    // ---------------------------------------------------------- veins (data)
    var c0 = Math.floor(top / CHUNK) - 1, c1 = Math.floor((top + H) / CHUNK) + 1;
    var glow = 0.5 + 0.5 * Math.sin((pulse / cfg.vein.glintPeriodSeconds) * Math.PI * 2);
    var ci, vlist, vi, v, vy, vx, vband;
    for (ci = c0; ci <= c1; ci++) {
      vlist = chunkVeins(ci);
      for (vi = 0; vi < vlist.length; vi++) {
        v = vlist[vi];
        vy = v.y - top;
        if (vy < -8 || vy > H) continue;
        vband = E.bandAt(cfg, v.y / L.buPerMeter);
        if (vband.index > cutoff) continue;
        vx = v.side ? rightX + 4 + v.x * 0.3 : 4 + v.x;
        vx = vx | 0;
        if (vx + v.w > contentW) continue;
        ctx.fillStyle = vband.veinColor;
        ctx.fillRect(vx, vy, v.w, v.h);
        ctx.fillRect(vx + 1, vy + v.h, (v.w - 2) > 1 ? v.w - 2 : 1, 1);
        ctx.fillStyle = SP.shade(vband.veinColor, 0.6);
        ctx.fillRect(vx, vy + v.h - 1, v.w, 1);
      }
    }

    // ---------------------------------------------------------- seam dither
    // Two tile rows of 2 px checker in the NEXT band's base, 25% then 50%, at every
    // boundary in view. dinosaur-fight's bgSky seam trick, vertical.
    var sTop = (top - T * 2) / L.buPerMeter, sBot = (top + H) / L.buPerMeter;
    var bIdx = Math.max(0, E.bandAt(cfg, sTop < 0 ? 0 : sTop).index);
    for (i = bIdx; i <= cutoff + 1; i++) {
      var nb = E.bandByIndex(cfg, i + 1);
      if (!nb) break;
      if (nb.startDepth > sBot) break;
      if (i + 1 > cutoff) break;
      var pb = E.bandByIndex(cfg, i);
      var sy = Math.round(nb.startDepth * L.buPerMeter - top);
      if (sy < -T * 2 || sy > H) continue;
      c = SP.seamFor(pb, nb, contentW);
      ctx.drawImage(c, 0, sy - T * 2);
      ctx.fillStyle = "rgba(0,0,0,.42)";
      ctx.fillRect(0, sy, contentW, 1);
      stats.seams++;
    }

    // ---------------------------------------------------------- the veil
    // Revealed-but-unreached rock: a flat wash plus 1-in-N scanlines. Ore glints
    // animate back through it at half amplitude (below).
    var veilTopWorld = Infinity;
    if (plan.veiledIndices.length) {
      var firstVeiled = E.bandByIndex(cfg, plan.veiledIndices[0]);
      veilTopWorld = firstVeiled.startDepth * L.buPerMeter;
      stats.maxVeiledIndex = plan.veiledIndices[plan.veiledIndices.length - 1];
      var vsy = Math.round(veilTopWorld - top);
      if (vsy < H) {
        if (vsy < 0) vsy = 0;
        var vh = H - vsy;
        ctx.fillStyle = "rgba(" + cfg.veil.color + "," + plan.veilAlpha + ")";
        ctx.fillRect(0, vsy, contentW, vh);
        ctx.fillStyle = "rgba(0,0,0," + cfg.veil.scanlineAlpha + ")";
        var stepY = cfg.veil.scanline || 2;
        for (var syy = vsy; syy < vsy + vh; syy += stepY) ctx.fillRect(0, syy, contentW, 1);
        stats.veiled++;
      }
    }

    // ---------------------------------------------------------- glints
    // One pulsing pixel per vein, drawn last so veiled ore still winks through.
    for (ci = c0; ci <= c1; ci++) {
      vlist = chunkVeins(ci);
      for (vi = 0; vi < vlist.length; vi++) {
        v = vlist[vi];
        vy = v.y - top;
        if (vy < -8 || vy > H) continue;
        vband = E.bandAt(cfg, v.y / L.buPerMeter);
        if (vband.index > cutoff) continue;
        vx = (v.side ? rightX + 4 + v.x * 0.3 : 4 + v.x) | 0;
        if (vx + v.w > contentW) continue;
        var amp = v.y >= veilTopWorld ? 0.5 : 1;
        var g2 = 0.5 + 0.5 * Math.sin((pulse / cfg.vein.glintPeriodSeconds + v.ph) * Math.PI * 2);
        ctx.globalAlpha = (0.2 + 0.7 * g2) * amp;
        ctx.fillStyle = vband.glintColor;
        ctx.fillRect(vx + v.gx, vy + v.gy, 1, 1);
        ctx.globalAlpha = 1;
      }
    }

    // ---------------------------------------------------------- lantern light
    var lanternN = owned.lantern || 0;
    var lamp = 0.10 + 0.05 * Math.min(4, lanternN) + (owned.smelter ? 0.05 : 0);
    var grd = ctx.createLinearGradient(boreX, 0, rightX, 0);
    grd.addColorStop(0, "rgba(150,116,64," + lamp.toFixed(3) + ")");
    grd.addColorStop(0.55, "rgba(0,0,0,0)");
    grd.addColorStop(1, "rgba(0,0,0,0.32)");
    ctx.fillStyle = grd;
    ctx.fillRect(boreX, 0, boreW, Math.max(0, Math.min(H, faceScreenY)));
    if (lanternN > 0 && faceScreenY > 40) {
      // a hung lamp on the left face — the Deep Lantern you bought, on screen
      var lampY = faceScreenY - 54;
      if (lampY > 4) {
        ctx.fillStyle = "#3d2a19"; ctx.fillRect(boreX + 4, lampY - 4, 1, 4);
        ctx.fillStyle = "#6b5a33"; ctx.fillRect(boreX + 2, lampY, 5, 7);
        ctx.fillStyle = "#ffd98a"; ctx.fillRect(boreX + 3, lampY + 1, 3, 5);
        ctx.globalAlpha = 0.16 + 0.05 * glow;
        ctx.fillStyle = "#ffcf7a";
        ctx.fillRect(boreX, lampY - 8, 24, 24);
        ctx.globalAlpha = 1;
      }
    }

    // ---------------------------------------------------------- elevator
    // Bought Elevator = a cage on a rope in the bore. The rope is one fillRect column,
    // so the cage can travel any distance for free.
    if (owned.elevator > 0) {
      var headroom = Math.min(faceScreenY, H) - 46;
      if (headroom > 8) {
        var cage = SP.elevator();
        var cy = Math.round(12 + (0.5 - 0.5 * Math.cos(pulse * 0.6)) * Math.min(headroom, 60));
        ctx.fillStyle = SP.ropeColor();
        ctx.fillRect(boreX + 31, 0, 1, cy);
        ctx.drawImage(cage, boreX + 20, cy);
      }
    }

    var sp = cfg.sprites;
    var perRow = sp.dwarvesPerRow || 4;
    var cap = sp.maxDwarves || 32;
    // The lift shares the upper bore with the crew rather than evicting it: the cage is
    // drawn before the dwarves, so it reads as running behind them on the far wall.
    var crewTop = (sp.crewTopBu || 24) + (owned.elevator > 0 ? (sp.elevatorClearBu || 0) : 0);
    var pickTier = Math.min((sp.pickTiers || 4) - 1, Math.floor((owned.pick || 0) / (sp.pickLevelsPerTier || 6)));
    var digFps = sp.digFps || 6, walkFps = sp.walkFps || 8;
    var digSeq = Math.floor(pulse * digFps);
    var walkSeq = Math.floor(pulse * walkFps);

    // The working ledge holds one fewer dwarf than the rows behind it, because the
    // cart parks in the last slot — which is where a cart belongs, next to the face.
    var frontSlots = perRow - 1;
    var crewTotal = Math.min(cap, derived.dwarves);
    var rowsNeeded = 1 + Math.ceil(Math.max(0, crewTotal - frontSlots) / perRow);
    // The crew stack compresses rather than disappearing off the top: buying a Deep
    // Lantern raises the face, and the crew you paid for must stay on screen.
    var rowH = sp.dwarfRowBu || 18;
    if (rowsNeeded > 1) {
      var avail = faceScreenY - 16 - crewTop;
      rowH = Math.max(sp.dwarfRowMinBu || 10, Math.min(rowH, Math.floor(avail / (rowsNeeded - 1))));
    }

    // ---------------------------------------------------------- cart
    var carts = SP.cartsFor(curBand);
    var cartFrame = owned.cart > 0 ? (1 + (Math.floor(pulse / (sp.cartFrameSeconds || 1.6)) % 2)) : (Math.floor(pulse / 2.2) % 2);
    cartFrame = cartFrame < 0 ? 0 : (cartFrame > 2 ? 2 : cartFrame);
    var cartX = Math.min(boreX + 2 + frontSlots * 15, rightX - 21);
    var cartY = faceScreenY - 14;
    if (cartY > -14 && cartY < H) {
      if (owned.rails > 0) {                       // purchase visibility: Cart Rails
        ctx.fillStyle = "#4a4e57";
        ctx.fillRect(cartX - 1, cartY + 13, 22, 1);
        ctx.fillStyle = "#2a2d33";
        for (var rx = cartX; rx < cartX + 20; rx += 4) ctx.fillRect(rx, cartY + 12, 2, 1);
      }
      ctx.drawImage(carts[cartFrame], cartX, cartY);
    }

    // ---------------------------------------------------------- the crew
    // Every hired dwarf stands on a ledge with its JSON cosmetic loadout and works the
    // face. The front ledge digs; the rows behind walk ore back and haul.
    var slot = 0;
    deepestDwarfY = faceWorld;
    for (i = 0; i < cfg.dwarves.length && slot < cap; i++) {
      var dw = cfg.dwarves[i];
      var n = owned[dw.id] || 0;
      if (!n) continue;
      var cos = dw.cosmetic || {};
      for (var k2 = 0; k2 < n && slot < cap; k2++, slot++) {
        var rowi, col;
        if (slot < frontSlots) { rowi = 0; col = slot; }
        else { rowi = 1 + (((slot - frontSlots) / perRow) | 0); col = (slot - frontSlots) % perRow; }
        var dxp = boreX + 2 + col * 15;
        var dyp = faceScreenY - 16 - rowi * rowH;
        if (dyp < crewTop || dyp > H) continue;
        var frame;
        if (rowi === 0) {
          frame = (digSeq + slot) % 4 === 1 ? 4 : 3;      // 3 -> 4 -> 3 dig cycle
        } else if ((slot % 3) === 0) {
          frame = 5;                                      // haul
        } else {
          frame = ((walkSeq + slot) & 1) ? 1 : 2;         // walk
        }
        ctx.drawImage(SP.dwarf(cos.beard || "braided", cos.hat || "cap", pickTier, cos.palette || "rust", frame), dxp, dyp);
        stats.dwarves++;
        if (rowi === 0) {
          var wy = top + dyp + 16;
          if (wy > deepestDwarfY) deepestDwarfY = wy;
        }
      }
    }

    // A deep crew out-grows the ledges that fit on screen. Say so rather than
    // silently swallowing hires: every purchase has to change the screen (PRD 16).
    if (derived.dwarves > stats.dwarves) {
      ctx.textAlign = "center";
      ctx.font = "6px ui-monospace, Menlo, monospace";
      ctx.fillStyle = "rgba(0,0,0,.66)";
      ctx.fillRect(boreX + 4, 13, boreW - 8, 9);
      ctx.fillStyle = "#cbbd97";
      ctx.fillText("+" + (derived.dwarves - stats.dwarves) + " CREW UP TOP", boreX + boreW / 2, 15);
      ctx.textAlign = "left";
    }

    // the working ledge the front row stands on
    ctx.fillStyle = "rgba(255,226,150,.12)";
    if (faceScreenY > -2 && faceScreenY < H) ctx.fillRect(boreX, faceScreenY - 2, boreW, 2);

    // ---------------------------------------------------------- the active vein
    var vr = R.veinRect();
    var band0 = derived.band;
    // pocket shadow, then the ore body, then a lit rim in the band's GLINT colour —
    // coal's vein colour is nearly black, so the highlight has to come from the glint
    // or the richest seam in the game reads as a grey box.
    // a shadowed pocket so the blob has a silhouette, the ore body, a lit top edge in
    // the ore's own colour, and only DOTS in the glint colour — a full-width glint
    // line turns the richest seam in the game into a picture frame.
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.fillRect(vr.x + 1, vr.y + 3, vr.w - 2, vr.h - 5);
    var veinLit = SP.shade(band0.veinColor, 1.5), veinDark = SP.shade(band0.veinColor, 0.6);
    ctx.fillStyle = band0.veinColor;
    ctx.fillRect(vr.x + 3, vr.y + 5, 20, 7);
    ctx.fillRect(vr.x + 6, vr.y + 12, 16, 6);
    ctx.fillRect(vr.x + 2, vr.y + 16, 12, 5);
    ctx.fillStyle = veinLit;
    ctx.fillRect(vr.x + 3, vr.y + 5, 18, 1);
    ctx.fillRect(vr.x + 6, vr.y + 12, 13, 1);
    ctx.fillRect(vr.x + 2, vr.y + 16, 10, 1);
    ctx.fillRect(vr.x + 4, vr.y + 7, 3, 2);
    ctx.fillRect(vr.x + 9, vr.y + 14, 3, 2);
    ctx.fillStyle = veinDark;
    ctx.fillRect(vr.x + 3, vr.y + 11, 20, 1);
    ctx.fillRect(vr.x + 6, vr.y + 17, 16, 1);
    ctx.fillRect(vr.x + 2, vr.y + 20, 12, 1);
    ctx.fillStyle = band0.veinColor;
    ctx.fillRect(vr.x + 21, vr.y + 8, 3, 3);
    ctx.fillRect(vr.x + 4, vr.y + 13, 2, 2);
    ctx.fillRect(vr.x + 14, vr.y + 19, 3, 2);
    ctx.fillStyle = band0.glintColor;
    ctx.globalAlpha = 0.35 + 0.65 * glow;
    ctx.fillRect(vr.x + 9, vr.y + 8, 3, 3);
    ctx.fillRect(vr.x + 16, vr.y + 14, 2, 2);
    ctx.globalAlpha = 1;
    // corner brackets, not a full box: this is a target on the rock, not a UI window
    ctx.fillStyle = "rgba(255,226,150," + (0.25 + 0.35 * glow).toFixed(3) + ")";
    var bl = 5;
    ctx.fillRect(vr.x, vr.y, bl, 1); ctx.fillRect(vr.x, vr.y, 1, bl);
    ctx.fillRect(vr.x + vr.w - bl, vr.y, bl, 1); ctx.fillRect(vr.x + vr.w - 1, vr.y, 1, bl);
    ctx.fillRect(vr.x, vr.y + vr.h - 1, bl, 1); ctx.fillRect(vr.x, vr.y + vr.h - bl, 1, bl);
    ctx.fillRect(vr.x + vr.w - bl, vr.y + vr.h - 1, bl, 1); ctx.fillRect(vr.x + vr.w - 1, vr.y + vr.h - bl, 1, bl);
    if (strikeT > 0) {
      ctx.fillStyle = "rgba(255,240,200," + (strikeT / cfg.vein.strikeFlashSeconds) * 0.8 + ")";
      ctx.fillRect(vr.x, vr.y, vr.w, vr.h);
    }

    // ---------------------------------------------------------- depth readout
    ctx.fillStyle = "rgba(8,6,12,.72)";
    ctx.fillRect(0, 0, contentW, 11);
    ctx.fillStyle = "rgba(233,220,182,.14)";
    ctx.fillRect(0, 11, contentW, 1);
    ctx.font = "6px ui-monospace, Menlo, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#cbbd97";
    ctx.fillText(band0.name.toUpperCase(), 4, 3);
    ctx.textAlign = "right";
    ctx.fillStyle = "#e9dcb6";
    ctx.fillText(depth.toFixed(1) + " m", contentW - 4, 3);
    ctx.textAlign = "center";

    // looking back up: tell the player the camera is off the face
    if (cam.userBu < -8) {
      ctx.fillStyle = "rgba(0,0,0,.6)";
      ctx.fillRect(boreX - 6, H - 16, boreW + 12, 12);
      ctx.font = "6px ui-monospace, Menlo, monospace";
      ctx.fillStyle = "#d8c68f";
      ctx.fillText("▼  RELEASE TO FOLLOW THE CREW", W / 2 - 3, H - 13);
    }

    // ---------------------------------------------------------- floaters
    for (var f = 0; f < floaters.length; f++) {
      var fl = floaters[f];
      var kf = fl.t / cfg.vein.floaterSeconds;
      ctx.globalAlpha = 1 - kf;
      ctx.fillStyle = fl.color;
      ctx.font = "bold 8px ui-monospace, Menlo, monospace";
      ctx.fillText(fl.text, fl.x, fl.y - kf * cfg.vein.floaterRiseBu);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";

    // ---------------------------------------------------------- depth ribbon
    drawRibbon(ribbonX, L, depth, cutoff);
  };

  // Band ticks are clipped to the reveal cutoff — an unrevealed boundary must not
  // leak here either — plus the ending marker and the current-depth caret.
  function drawRibbon(x, L, depth, cutoff) {
    var H = L.shaftBu, w = L.ribbonBu;
    var end = cfg.milestone ? cfg.milestone.depth : 1200;
    ctx.fillStyle = "#120e18";
    ctx.fillRect(x, 0, w, H);
    ctx.fillStyle = "#1c1726";
    ctx.fillRect(x + 1, 0, w - 2, H);
    var frac = Math.min(1, depth / end);
    var fh = Math.round(frac * H);
    ctx.fillStyle = "#8a6a1e";
    ctx.fillRect(x + 1, 0, w - 2, fh);
    ctx.fillStyle = "#f2c14e";
    ctx.fillRect(x + 1, fh - 1 < 0 ? 0 : fh - 1, w - 2, 2);
    // band ticks, revealed only
    ctx.fillStyle = "rgba(233,220,182,.5)";
    for (var oi = 0; oi <= Math.min(cutoff, cfg.ores.length - 1); oi++) {
      var m = Math.round((cfg.ores[oi].startDepth / end) * H);
      if (m >= 0 && m < H) ctx.fillRect(x, m, w, 1);
    }
    // the ending marker
    ctx.fillStyle = "#ffe89a";
    ctx.fillRect(x, H - 3, w, 3);
    ctx.fillStyle = "rgba(255,232,154,.35)";
    ctx.fillRect(x - 1, H - 6, 1, 6);
  }

  // --------------------------------------------------------------- test hooks
  // selfTest drives these instead of reading pixels.
  R.renderProbe = function (state, derived, ticks, dt) {
    ticks = ticks || 1; dt = dt || 1 / 60;
    for (var i = 0; i < ticks; i++) { R.update(dt, state, derived); R.draw(state, derived); }
    return {
      placeholderRects: stats.placeholderRects, tileBlits: stats.tileBlits,
      seams: stats.seams, veiled: stats.veiled, dwarves: stats.dwarves,
      maxDrawnIndex: stats.maxDrawnIndex, maxVeiledIndex: stats.maxVeiledIndex,
      cutoffIndex: lastPlan.cutoffIndex,
      cameraY: focusY(), deepestDwarfY: deepestDwarfY,
      sprites: SP.stats()
    };
  };
  R.focusY = focusY;
  R.deepestDwarfY = function () { return deepestDwarfY; };
})();
