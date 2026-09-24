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
  var oreArcs = [];
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

  R.resize = function (s, shaftBuOverride) {
    scale = s;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    var L = cfg.layout;
    var shaftBu = shaftBuOverride || L.shaftBu;
    cv.style.width = (L.columnBu * s) + "px";
    cv.style.height = (shaftBu * s) + "px";
    cv.width = Math.round(L.columnBu * s * dpr);
    cv.height = Math.round(shaftBu * s * dpr);
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = "top";
  };

  R.scale = function () { return scale; };
  R.stats = function () { stats.pulse = pulse; return stats; };
  R.ctx = function () { return ctx; };

  // Crit shake: applied as a canvas translate, decays over time
  var shakeT = 0, shakeAmt = 0;
  R.shake = function (amount, dur) { shakeAmt = amount || 3; shakeT = dur || 0.18; };

  // --------------------------------------------------------------- ending scene state
  var endScene = { active: false, t: 0, cavern: null, totalT: 10 };

  R.startEnding = function (state, derived) {
    endScene.active = true;
    endScene.t = 0;
    endScene.totalT = (cfg.ending && cfg.ending.totalDurationS) || 10;
    endScene.cavern = buildCavern();
  };

  R.endingActive = function () { return endScene.active; };

  function buildCavern() {
    // Draw the cavern once to an offscreen canvas: vaulted ceiling, gold pile, columns
    var w = 160, h = (cfg.ending && cfg.ending.cavernHeightBu) || 200;
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var g = c.getContext("2d");
    // Dark cavern background
    g.fillStyle = "#0d0a14";
    g.fillRect(0, 0, w, h);
    // Vaulted ceiling arc
    g.fillStyle = "#1a1528";
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, 40);
    g.quadraticCurveTo(w / 2, 80, 0, 40);
    g.fill();
    // Ceiling detail
    g.fillStyle = "#251f35";
    for (var ci = 0; ci < 30; ci++) {
      var cx = (SP.hash2(ci, 8822) % w);
      var cy = (SP.hash2(ci, 3311) % 50);
      g.fillRect(cx, cy, 2 + (ci % 3), 1 + (ci % 2));
    }
    // Three columns
    var cols = (cfg.ending && cfg.ending.columns) || 3;
    var colSpacing = w / (cols + 1);
    g.fillStyle = "#2a2240";
    for (var co = 0; co < cols; co++) {
      var cx2 = Math.round(colSpacing * (co + 1));
      g.fillRect(cx2 - 3, 30, 6, h - 50);
      // Column base
      g.fillStyle = "#352a4a";
      g.fillRect(cx2 - 5, h - 22, 10, 4);
      g.fillStyle = "#2a2240";
      // Column capital
      g.fillRect(cx2 - 4, 28, 8, 4);
    }
    // Gold pile: ~200 seeded px calls
    var pileN = (cfg.ending && cfg.ending.goldPilePixels) || 200;
    var goldColors = ["#f2c14e", "#d8a52f", "#ffe89a", "#c4922a", "#aa7a1e"];
    for (var pi = 0; pi < pileN; pi++) {
      var px2 = 20 + (SP.hash2(pi, 5599) % (w - 40));
      var pyMax = h - 8;
      var pyMin = h - 14 - Math.round(20 * Math.pow(1 - Math.abs(px2 - w / 2) / (w / 2), 1.5));
      var py2 = pyMin + (SP.hash2(pi, 7733) % Math.max(1, pyMax - pyMin));
      g.fillStyle = goldColors[pi % goldColors.length];
      g.fillRect(px2, py2, 1 + (pi % 2), 1);
    }
    return c;
  }

  function drawEndingOverlay(ctx2, W, H, depth, derived) {
    var e = cfg.ending;
    var t = endScene.t;
    // Phase 1: shatter + cavern reveal (0 to pullBackDuration)
    var pullEnd = (e.pullBackDurationS || 2);
    var crewStart = pullEnd;
    var crewEnd = crewStart + derived.dwarves * (e.crewFileInDelayS || 0.2);
    var titleStart = crewEnd + 0.5;

    // Draw the cavern below the face
    if (endScene.cavern) {
      var cy = Math.min(H, Math.round((depth * cfg.layout.buPerMeter - (cam.topBu || 0)) + 4));
      // Scale tween: pull back from 1.0 to pullBackScale over pullBackDuration
      if (t < pullEnd) {
        var f2 = Math.min(1, t / pullEnd);
        var sc = 1 - (1 - (e.pullBackScale || 0.55)) * f2;
        ctx2.save();
        ctx2.translate(W / 2, H / 2);
        ctx2.scale(sc, sc);
        ctx2.translate(-W / 2, -H / 2);
        ctx2.drawImage(endScene.cavern, 0, cy);
        ctx2.restore();
      } else {
        ctx2.save();
        ctx2.translate(W / 2, H / 2);
        ctx2.scale(e.pullBackScale || 0.55, e.pullBackScale || 0.55);
        ctx2.translate(-W / 2, -H / 2);
        ctx2.drawImage(endScene.cavern, 0, cy);
        ctx2.restore();
      }
    }

    // Phase 2: crew files in
    if (t > crewStart) {
      var crewDone = Math.min(derived.dwarves, Math.floor((t - crewStart) / (e.crewFileInDelayS || 0.2)));
      for (var di = 0; di < crewDone && di < 12; di++) {
        var dx = 20 + di * 12;
        var dy = H - 30;
        ctx2.fillStyle = "#c98a4a";
        ctx2.fillRect(dx, dy, 4, 8);
        ctx2.fillStyle = "#8a4b2a";
        ctx2.fillRect(dx, dy + 8, 4, 6);
      }
    }

    // Phase 3: title text
    if (t > titleStart) {
      var alpha = Math.min(1, (t - titleStart) / 0.5);
      ctx2.globalAlpha = alpha;
      // Scrim
      ctx2.fillStyle = "rgba(6,4,10,.7)";
      ctx2.fillRect(0, 0, W, H);
      // Title
      ctx2.textAlign = "center";
      ctx2.font = "bold 12px ui-monospace, Menlo, monospace";
      ctx2.fillStyle = "#f2c14e";
      var state2 = window.GD ? window.GD.state : {};
      var endTitle = "THE GREEDY DEEP";
      if (cfg.flavor && cfg.flavor.fallbacks && cfg.flavor.fallbacks.endingTitle) {
        endTitle = cfg.flavor.fallbacks.endingTitle;
      }
      ctx2.fillText(endTitle, W / 2, H / 2 - 30);
      ctx2.font = "8px ui-monospace, Menlo, monospace";
      ctx2.fillStyle = "#c3b9d4";
      ctx2.fillText(Math.floor(state2.depth || 0) + " m deep", W / 2, H / 2 - 12);
      if (window.GD) {
        ctx2.fillText(window.GD.format(state2.goldEarnedTotal || 0) + " gold earned", W / 2, H / 2 + 2);
        ctx2.fillText(window.GDEngine.formatEta(state2.endingAtSeconds || 0) + " run time", W / 2, H / 2 + 16);
        ctx2.font = "bold 10px ui-monospace, Menlo, monospace";
        ctx2.fillStyle = "#f2c14e";
        ctx2.fillText("SCORE " + window.GD.format(state2.endingScore || 0), W / 2, H / 2 + 36);
      }
      ctx2.textAlign = "left";
      ctx2.globalAlpha = 1;
    }
  }

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
    var H = cfg.layout._liveShaftBu || cfg.layout.shaftBu;
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
  R.addOreArc = function (color) {
    var v = R.veinRect();
    var dur = (cfg.particles && cfg.particles.oreArcDurationS) || 0.4;
    // Arc from vein center to cart position
    var L = cfg.layout;
    var boreX2 = L.wallTiles * L.tileBu;
    var boreW2 = L.boreTiles * L.tileBu;
    oreArcs.push({
      x0: v.x + v.w / 2, y0: v.y + v.h / 2,
      x1: boreX2 + boreW2 - 10, y1: faceY() - 8,
      t: 0, life: dur, color: color || "#f2c14e"
    });
  };

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
    if (shakeT > 0) shakeT -= dt;
    // Ore arc tweens
    for (var ai = oreArcs.length - 1; ai >= 0; ai--) {
      oreArcs[ai].t += dt;
      if (oreArcs[ai].t >= oreArcs[ai].life) oreArcs.splice(ai, 1);
    }
    var pf = field();
    if (pf && pf.live) {
      for (var pi = 0; pi < pf.slots.length; pi++) if (pf.slots[pi].flash > 0) pf.slots[pi].flash -= dt;
    }
    if (endScene.active) {
      endScene.t += dt;
      if (endScene.t > endScene.totalT + 2) endScene.active = false;
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

  // --------------------------------------------------------------- crew positions (M4 item 8)
  function computeCrewPositions(cfg2, derived, faceScreenY, boreX, boreW, rightX, top) {
    var sp2 = cfg2.sprites;
    var cr = cfg2.crew || { faceSlots: 3, pocketSpacingBu: 28, pocketOffsetBu: 24, transitSlots: 2 };
    var cap2 = sp2.maxDwarves || 32;
    var crewTotal = Math.min(cap2, derived.dwarves);
    var positions = [];
    var slot2 = 0;
    var bitBoost2 = Math.min(4, (window.GD && window.GD.state ? window.GD.state.owned.bit : 0) || 0);
    var digSeq2 = Math.floor(pulse * ((sp2.digFps || 6) + bitBoost2));
    var walkSeq2 = Math.floor(pulse * (sp2.walkFps || 8));

    for (var di = 0; di < cfg2.dwarves.length && slot2 < crewTotal; di++) {
      var dw2 = cfg2.dwarves[di];
      var n2 = (window.GD && window.GD.state ? window.GD.state.owned[dw2.id] : 0) || 0;
      if (!n2) continue;
      var cos2 = dw2.cosmetic || {};
      for (var k3 = 0; k3 < n2 && slot2 < crewTotal; k3++, slot2++) {
        var px, py, frame2, kind, side2;
        if (slot2 < cr.faceSlots) {
          // Face slots: dig at the bottom of the bore
          kind = "face";
          side2 = -1;
          px = boreX + 6 + slot2 * 20;
          py = faceScreenY - 16;
          frame2 = (digSeq2 + slot2) % 4 === 1 ? 4 : 3;
        } else if (slot2 < crewTotal - (cr.transitSlots || 0)) {
          // Wall pockets: alternating left/right at staggered heights
          kind = "pocket";
          var pIdx = slot2 - cr.faceSlots;
          side2 = pIdx % 2; // 0=left, 1=right
          var row2 = Math.floor(pIdx / 2);
          px = side2 === 0 ? (boreX - 10) : (rightX + 2);
          py = faceScreenY - (cr.pocketOffsetBu || 24) - row2 * (cr.pocketSpacingBu || 28);
          frame2 = (digSeq2 + slot2) % 4 === 1 ? 4 : 3;
        } else {
          // Transit: climbing the ladder
          kind = "transit";
          side2 = -1;
          var tIdx = slot2 - (crewTotal - (cr.transitSlots || 0));
          px = boreX + 3;
          py = faceScreenY - (cr.pocketOffsetBu || 42) - 
               Math.ceil((crewTotal - cr.faceSlots - (cr.transitSlots || 0)) / 2) * (cr.pocketSpacingBu || 32) - 
               20 - tIdx * (cr.transitSpacingBu || 48);
          frame2 = ((walkSeq2 + slot2) & 1) ? 1 : 2;
        }
        positions.push({
          x: px, y: py, frame: frame2, kind: kind, side: side2,
          beard: cos2.beard || "braided", hat: cos2.hat || "cap",
          palette: cos2.palette || "rust"
        });
      }
    }
    return positions;
  }

  R.crewPositions = function (state, derived) {
    var L = cfg.layout;
    var boreX2 = L.wallTiles * L.tileBu;
    var boreW2 = L.boreTiles * L.tileBu;
    var rightX2 = boreX2 + boreW2;
    var faceScreenY2 = Math.round(state.depth * L.buPerMeter - (cam.topBu || 0));
    return computeCrewPositions(cfg, derived, faceScreenY2, boreX2, boreW2, rightX2, cam.topBu || 0);
  };

  // --------------------------------------------------------------- draw
  R.draw = function (state, derived) {
    var L = cfg.layout;
    var W = L.columnBu, H = L._liveShaftBu || L.shaftBu, T = L.tileBu;
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

    // Crit shake: offset the entire scene
    if (shakeT > 0) {
      var sf = shakeT / (cfg.particles ? cfg.particles.shakeDurationS : 0.18);
      var sx = (Math.random() - 0.5) * 2 * shakeAmt * sf;
      var sy = (Math.random() - 0.5) * 2 * shakeAmt * sf;
      ctx.save();
      ctx.translate(sx, sy);
    }

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
    // With purchased braces, draw extra crossbeams between the base braces.
    // Each brace level adds one intermediate crossbeam (up to 4 visible sub-braces).
    var subBraces = Math.min(4, bracesOwned);
    var subStep = subBraces > 0 ? braceStep / (subBraces + 1) : 0;
    for (var by = bTop; by < top + H; by += braceStep) {
      var bsy = by - top;
      if (bsy > faceScreenY - 4) break;
      if (bsy < -T) continue;
      ctx.drawImage(braceC, boreX, bsy);
      if (bracesOwned > 0) {
        // Reinforcement stripe on the base brace
        var tmb = cfg.sprites.timber;
        ctx.fillStyle = tmb.lit;
        ctx.fillRect(boreX, bsy + 6, boreW, 1);
        ctx.fillStyle = tmb.dark;
        ctx.fillRect(boreX, bsy + 7, boreW, 1);
      }
      // Sub-braces: smaller timber crossbeams between main braces
      for (var si = 1; si <= subBraces; si++) {
        var sby = bsy + si * subStep;
        if (sby > faceScreenY - 4 || sby < -T) continue;
        var tmb2 = cfg.sprites.timber;
        ctx.fillStyle = tmb2.post;
        ctx.fillRect(boreX + 1, sby, boreW - 2, 2);
        ctx.fillStyle = tmb2.lit;
        ctx.fillRect(boreX + 1, sby, boreW - 2, 1);
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
      // R4: the last two tile rows of band N, 2 px checker of band N+1's base, 25% then
      // 50%. Nothing else — the hard boundary rule that used to sit under it read as a
      // drawn line rather than geology (M3 critic).
      c = SP.seamFor(pb, nb, contentW);
      ctx.drawImage(c, 0, sy - T * 2);
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
    var cap = sp.maxDwarves || 32;
    var pickTier = Math.min((sp.pickTiers || 4) - 1, Math.floor((owned.pick || 0) / (sp.pickLevelsPerTier || 6)));
    var bitBoost = Math.min(4, owned.bit || 0);
    var digFps = (sp.digFps || 6) + bitBoost, walkFps = sp.walkFps || 8;
    var digSeq = Math.floor(pulse * digFps);
    var walkSeq = Math.floor(pulse * walkFps);

    // ---------------------------------------------------------- cart
    var carts = SP.cartsFor(curBand);
    var cartFrame = owned.cart > 0 ? (1 + (Math.floor(pulse / (sp.cartFrameSeconds || 1.6)) % 2)) : (Math.floor(pulse / 2.2) % 2);
    cartFrame = cartFrame < 0 ? 0 : (cartFrame > 2 ? 2 : cartFrame);
    var cartX = boreX + boreW - 22;
    var cartY = faceScreenY - 14;
    if (cartY > -14 && cartY < H) {
      if (owned.rails > 0) {
        ctx.fillStyle = "#4a4e57";
        ctx.fillRect(cartX - 1, cartY + 13, 22, 1);
        ctx.fillStyle = "#2a2d33";
        for (var rx = cartX; rx < cartX + 20; rx += 4) ctx.fillRect(rx, cartY + 12, 2, 1);
      }
      ctx.drawImage(carts[cartFrame], cartX, cartY);
    }

    // ---------------------------------------------------------- crew slot system (M4 item 8)
    // Face slots dig at the bottom; the rest sit in wall pockets at staggered heights,
    // alternating left/right. Transit dwarves climb the ladder. No two overlap.
    var crewCfg = cfg.crew || { faceSlots: 3, pocketSpacingBu: 28, pocketOffsetBu: 24, transitSlots: 2 };
    var positions = computeCrewPositions(cfg, derived, faceScreenY, boreX, boreW, rightX, top);
    deepestDwarfY = faceWorld;

    // Draw wall pocket recesses before dwarves
    for (i = 0; i < positions.length; i++) {
      var pos = positions[i];
      if (pos.kind === "pocket" && pos.y > 0 && pos.y < H) {
        // Small alcove in the wall
        ctx.fillStyle = "rgba(0,0,0,.3)";
        if (pos.side === 0) ctx.fillRect(boreX - 4, pos.y - 2, 8, 18);
        else ctx.fillRect(rightX - 4, pos.y - 2, 8, 18);
      }
    }

    var slot = 0;
    for (i = 0; i < positions.length && slot < cap; i++, slot++) {
      var pos2 = positions[i];
      stats.dwarves++;
      if (pos2.kind === "face") {
        var wy = top + pos2.y + 16;
        if (wy > deepestDwarfY) deepestDwarfY = wy;
      }
      if (pos2.y < -16 || pos2.y > H) continue; // skip draw but still count
      ctx.drawImage(SP.dwarf(pos2.beard, pos2.hat, pickTier, pos2.palette, pos2.frame), pos2.x, pos2.y);
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

    // ---------------------------------------------------------- ore arcs
    for (var oai = 0; oai < oreArcs.length; oai++) {
      var oa = oreArcs[oai];
      var oaF = oa.t / oa.life;
      var oaX = oa.x0 + (oa.x1 - oa.x0) * oaF;
      var oaY = oa.y0 + (oa.y1 - oa.y0) * oaF - 30 * Math.sin(oaF * Math.PI);
      ctx.fillStyle = oa.color;
      ctx.fillRect(oaX - 2, oaY - 2, 4, 4);
      ctx.fillStyle = SP.shade(oa.color, 1.4);
      ctx.fillRect(oaX - 1, oaY - 1, 2, 2);
    }

    // ---------------------------------------------------------- pickups (M5)
    drawPickups(H, glow);

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

    // ---------------------------------------------------------- ending scene (M4 item 4)
    if (endScene.active && endScene.t > 0) {
      drawEndingOverlay(ctx, W, H, depth, derived);
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

    // Restore shake transform before ribbon (ribbon is fixed overlay)
    if (shakeT > 0) ctx.restore();

    // ---------------------------------------------------------- depth ribbon
    drawRibbon(ribbonX, L, depth, cutoff);
  };

  // --------------------------------------------------------------- pickups (M5)
  // World-anchored in a side wall: a pulsing plus-shaped halo in the pickup's colour so
  // it reads against any band, the cached sprite popping in over its first 0.2 s, a
  // four-point sparkle that sweeps round, a jolt on each geode crack, and a blink over
  // the last `expireBlinkS`. Integer blits and fillRects only: nothing allocates here.
  function field() { return window.GD ? window.GD.pickups : null; }
  function camTop() {
    if (cam.topBu !== null) return cam.topBu;
    var st = window.GD && window.GD.state;
    return st ? st.depth * cfg.layout.buPerMeter - faceY() : 0;
  }
  function drawPickups(H, glow) {
    var f = field();
    if (!f || !f.live) return;
    var pk = cfg.pickups, P = pk.palette, top = camTop();
    for (var i = 0; i < f.slots.length; i++) {
      var s = f.slots[i];
      if (!s.active) continue;
      var sy = s.yBu - top;
      if (sy < -s.sizeBu || sy > H + s.sizeBu) continue;
      if (s.ttl < pk.expireBlinkS && (Math.floor(s.ttl * 8) & 1)) continue;
      var stage = s.kind === "geode" ? Math.ceil((SP.GEODE_STAGES - 1) * (s.clicksMax - s.clicks) / s.clicksMax) : 0;
      var c = SP.pickupSprite(s.kind, stage);
      if (!c) continue;
      var cx = s.xBu, cy = sy;
      if (s.flash > 0) { cx += (Math.floor(s.flash * 60) & 1) ? 1 : -1; }
      var ph = 0.5 + 0.5 * Math.sin(pulse * 4 + s.id);
      var halo = (P[s.kind] && P[s.kind].halo) || "#ffffff";
      var hr = (s.sizeBu >> 1) + 3;
      ctx.fillStyle = halo;
      ctx.globalAlpha = 0.16 + 0.18 * ph;
      ctx.fillRect((cx - hr) | 0, (cy - 3) | 0, hr * 2, 6);
      ctx.fillRect((cx - 3) | 0, (cy - hr) | 0, 6, hr * 2);
      ctx.globalAlpha = 0.10 + 0.10 * ph;
      ctx.fillRect((cx - hr + 2) | 0, (cy - hr + 2) | 0, (hr - 2) * 2, (hr - 2) * 2);
      ctx.globalAlpha = 1;
      var k = s.age < 0.2 ? 0.4 + 3 * s.age : 1;
      var w = Math.round(c.width * k), h = Math.round(c.height * k);
      ctx.drawImage(c, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
      // sparkle: a 4-point star that travels round the top edge
      var sp = (pulse * 1.3 + s.id * 0.37) % 1;
      if (sp < 0.45) {
        var gx = Math.round(cx - w / 2 + sp / 0.45 * w), gy = Math.round(cy - h / 2 + 1);
        var a = Math.sin(sp / 0.45 * Math.PI);
        ctx.globalAlpha = a;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(gx, gy - 2, 1, 5); ctx.fillRect(gx - 2, gy, 5, 1);
        ctx.globalAlpha = 1;
      }
      if (s.flash > 0) {
        ctx.globalAlpha = Math.min(0.7, s.flash * 3);
        ctx.fillStyle = "#fff4d0";
        ctx.fillRect(Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
        ctx.globalAlpha = 1;
      }
    }
  }

  function hitRadiusPx(s) {
    var pk = cfg.pickups;
    return Math.max(pk.hitMinCssPx / 2, (s.sizeBu / 2 + pk.hitPadBu) * scale);
  }
  // Canvas-local CSS px centre and hit radius for one live pickup (debug + tests).
  R.pickupCss = function (s) {
    var top = camTop();
    return { x: s.xBu * scale, y: (s.yBu - top) * scale, r: hitRadiusPx(s) };
  };
  // The pickup under a canvas-local CSS point, or 0. A square hit box at least
  // hitMinCssPx across, padded hitPadBu past the sprite; the nearest wins on overlap.
  R.pickupAt = function (cssX, cssY) {
    var f = field();
    if (!f || !f.live || !cfg.pickups) return 0;
    var top = camTop(), best = 0, bestD = Infinity;
    for (var i = 0; i < f.slots.length; i++) {
      var s = f.slots[i];
      if (!s.active) continue;
      var dx = Math.abs(cssX - s.xBu * scale), dy = Math.abs(cssY - (s.yBu - top) * scale);
      var r = hitRadiusPx(s);
      if (dx > r || dy > r) continue;
      var dd = dx > dy ? dx : dy;
      if (dd < bestD) { bestD = dd; best = s.id; }
    }
    return best;
  };
  R.screenYBu = function (worldYBu) { return worldYBu - camTop(); };
  R.flashPickup = function (id) {
    var f = field();
    if (!f) return;
    for (var i = 0; i < f.slots.length; i++) if (f.slots[i].active && f.slots[i].id === id) f.slots[i].flash = 0.2;
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

  // --------------------------------------------------------------- render signature
  // Returns render-visible state for selfTest item 6 (purchase visibility)
  R.renderSignature = function (state, derived) {
    var owned = state.owned || {};
    var sp = cfg.sprites;
    return {
      pickLevel: owned.pick || 0,
      pickTier: Math.min((sp.pickTiers || 4) - 1, Math.floor((owned.pick || 0) / (sp.pickLevelsPerTier || 6))),
      bitLevel: owned.bit || 0,
      digFpsBoost: Math.min(4, owned.bit || 0),
      cartTier: owned.cart > 0 ? 1 : 0,
      lanternLevel: owned.lantern || 0,
      railsPresent: (owned.rails || 0) > 0 ? 1 : 0,
      smelterGlow: (owned.smelter || 0) > 0 ? 1 : 0,
      bracesCount: owned.braces || 0,
      elevatorPresent: (owned.elevator || 0) > 0 ? 1 : 0,
      dwarves: derived.dwarves,
      lampGlow: 0.10 + 0.05 * Math.min(4, owned.lantern || 0) + ((owned.smelter || 0) > 0 ? 0.05 : 0),
      veilAlpha: effVeilAlpha(derived.revealBonus || 0),
      faceYBu: effFaceY(derived.revealBonus || 0)
    };
  };

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
