// Greedy Deep — procedural pixel sprite factory (M3). Click it! Studios, 2026.
//
// Everything here is drawn once onto small offscreen canvases and blitted with
// imageSmoothing off. Nothing in this file allocates during a frame: `build()` runs
// at boot (and again on a config swap), the lookups below are pure cache reads.
//
// Contents: strata tiles (4 variants per band, picked by hash(tx,ty)&3), the band
// seam dither strip, the timber brace, the ladder, dwarf composites (body/beard/
// hat/pick, 6 frames, cached by loadout string), the cart and the elevator cage.
(function () {
  "use strict";

  var S = (window.GDSprites = {});

  // ------------------------------------------------------------------ helpers
  // COPIED VERBATIM from peasant-swarm/src/sprites.js — the LCG seed/rnd pair at the
  // top of PS.buildSprites plus make(w,h,draw) with its px/rect/ell helpers, flip(c),
  // shade(hex,k), outline(c) and silhouette(c). R4 asks for a copy, not a re-derivation,
  // and for the source named at the copy site. outlineVerbatim() is that copy; the
  // outline() the factory actually calls is a composite-based equivalent (see below).
  let seed = 20260901;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

  function make(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const p = {
      px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, 1, 1); },
      rect(x, y, ww, hh, col) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, ww | 0, hh | 0); },
      ell(cx, cy, rx, ry, col) {
        ctx.fillStyle = col;
        for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
          const t = (y - cy) / ry;
          const half = rx * Math.sqrt(Math.max(0, 1 - t * t));
          ctx.fillRect(Math.round(cx - half), y, Math.max(1, Math.round(half * 2)), 1);
        }
      },
      ctx,
    };
    draw(p);
    return c;
  }
  function flip(c) {
    const f = document.createElement("canvas");
    f.width = c.width; f.height = c.height;
    const g = f.getContext("2d");
    g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
    return f;
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * k)) | 0;
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) * k)) | 0;
    const b = Math.max(0, Math.min(255, (n & 255) * k)) | 0;
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  function outlineVerbatim(c) {
    const g = c.getContext("2d"), w = c.width, h = c.height;
    const img = g.getImageData(0, 0, w, h), d = img.data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
    const out = g.createImageData(w, h), o = out.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > 0) { o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; o[i + 3] = d[i + 3]; continue; }
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) { o[i] = 26; o[i + 1] = 18; o[i + 2] = 16; o[i + 3] = 175; }
    }
    g.putImageData(out, 0, 0);
    return c;
  }
  // The copied outline() reads the canvas back with getImageData and writes the result
  // straight over the original with putImageData. Two problems, both real:
  //
  //   1. If the read-back comes back empty — which is exactly what a 2D backing store
  //      the browser has hibernated or lost returns — the putImageData WIPES a sprite
  //      that drew correctly, and the cache serves that blank canvas forever. This is
  //      the mechanism behind BLOCKER 1 for every sprite that goes through outline.
  //   2. Chrome logs a Canvas2D readback warning per context. 108 outlined sprites,
  //      rebuilt by selfTest's two config swaps, buried the console in 500 of them.
  //
  // This version composites the same result and never reads a pixel back: dilate the
  // silhouette by drawing the sprite at four 1 px offsets, tint the dilation with the
  // rim colour via source-in, then draw the original on top. The rim survives only
  // where the dilation is not covered by the original — identical to the copied
  // algorithm's 4-neighbour test. selfTest asserts the two agree pixel for pixel.
  const RIM = "rgba(26,18,16,0.686)";   // the copied code's 26,18,16 at alpha 175/255
  function outline(c) {
    const w = c.width, h = c.height;
    const t = document.createElement("canvas");
    t.width = w; t.height = h;
    const g = t.getContext("2d");
    g.drawImage(c, -1, 0); g.drawImage(c, 1, 0);
    g.drawImage(c, 0, -1); g.drawImage(c, 0, 1);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = RIM;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "source-over";
    g.drawImage(c, 0, 0);
    const cg = c.getContext("2d");
    cg.clearRect(0, 0, w, h);
    cg.drawImage(t, 0, 0);
    return c;
  }
  S.outlineVerbatim = outlineVerbatim;
  S.outlineComposite = outline;

  // How many pixels in this canvas are not fully transparent. The one primitive the
  // whole blank-cache guard is built on.
  //
  // Every readback goes through ONE scratch context created with willReadFrequently,
  // never the sprite's own context. Reading a sprite canvas twice makes Chrome log
  // "Canvas2D: Multiple readback operations using getImageData are faster with the
  // willReadFrequently attribute set to true" once per context, and verifying a
  // 146-entry cache more than once buried the console in them.
  var scratch = null, scratchCtx = null;
  function opaqueCount(c) {
    if (!c || !c.width || !c.height) return 0;
    if (!scratch) {
      scratch = document.createElement("canvas");
      scratchCtx = scratch.getContext("2d", { willReadFrequently: true });
    }
    let d;
    try {
      if (scratch.width < c.width) scratch.width = c.width;
      if (scratch.height < c.height) scratch.height = c.height;
      scratchCtx.clearRect(0, 0, c.width, c.height);
      scratchCtx.drawImage(c, 0, 0);
      d = scratchCtx.getImageData(0, 0, c.width, c.height).data;
    } catch (e) { return -1; }          // read blocked: treat as unknown, not as blank
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  }
  S.opaqueCount = opaqueCount;

  function silhouette(c) {
    const f = document.createElement("canvas"); f.width = c.width; f.height = c.height;
    const g = f.getContext("2d"); g.drawImage(c, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, f.width, f.height);
    return f;
  }
  // ------------------------------------------------------- end of copied block

  S.shade = shade;
  S.flip = flip;
  S.silhouette = silhouette;

  // Deterministic tile-variant hash — same role as peasant-swarm's grass variant pick.
  S.hash2 = function (x, y) {
    var h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >> 13)) | 0;
    h = Math.imul(h, 1274126177) | 0;
    return (h ^ (h >> 16)) >>> 0;
  };
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  S.hashStr = hashStr;

  // ------------------------------------------------------------------ state
  var cfg = null;
  var tiles = {};        // paletteKey -> [4 canvases]
  var backTiles = {};    // paletteKey -> [4 canvases], the same tiles pushed into shadow
  var seams = {};        // "from>to"  -> canvas (2 tile rows of checker dither)
  var carts = {};        // bandKey    -> [3 canvases]
  var dwarves = new Map();
  var loadouts = new Set();
  var brace = null, ladder = null, elevator = null, ropeColor = "#5a4630";
  var stats = { tileBuilds: 0, dwarfBuilds: 0, seamBuilds: 0, outlineFailures: 0, rebuilds: 0, blankKeys: [], opaque: 0, total: 0 };

  S.stats = function () {
    return {
      tilePalettes: Object.keys(tiles).length,
      tileBuilds: stats.tileBuilds,
      seamStrips: Object.keys(seams).length,
      dwarfCache: dwarves.size,
      dwarfLoadouts: loadouts.size,
      dwarfBuilds: stats.dwarfBuilds,
      outlineFailures: stats.outlineFailures,
      rebuilds: stats.rebuilds,
      opaque: stats.opaque,
      total: stats.total,
      blank: stats.blankKeys.slice(0, 8),
      ready: !!brace
    };
  };

  // ------------------------------------------------------------------ palettes
  // A band's palette lives in JSON at ores[].palette. Endless repeat bands carry
  // `baseId`, so they inherit the palette of the ore they repeat. If a band somehow
  // has neither, derive one from its wallColor rather than drawing a flat rect —
  // a missing palette must never put a placeholder on screen.
  function paletteFor(band) {
    if (band.palette) return band.palette;
    var base = band.baseId;
    if (base && cfg) {
      for (var i = 0; i < cfg.ores.length; i++) if (cfg.ores[i].id === base && cfg.ores[i].palette) return cfg.ores[i].palette;
    }
    var w = band.wallColor || "#332d3c";
    return { base: w, light: shade(w, 1.28), dark: shade(w, 0.68), speck: band.color || shade(w, 1.5) };
  }
  S.paletteFor = paletteFor;
  function paletteKey(band) { return band.baseId || band.id; }
  S.paletteKey = paletteKey;

  // ------------------------------------------------------------------ strata tiles
  // 16 bu, four cached variants per band chosen by hash(tx,ty) & 3. Variant 3 carries
  // a crack motif so a wall of tiles does not read as undifferentiated noise (R4 2).
  function buildTiles(band) {
    var key = paletteKey(band);
    if (tiles[key]) return tiles[key];
    var T = cfg.layout.tileBu;
    var pal = paletteFor(band);
    var sp = cfg.sprites || {};
    var nSpeck = sp.tileSpecks === undefined ? 40 : sp.tileSpecks;
    var nClump = sp.tileClusters === undefined ? 6 : sp.tileClusters;
    seed = hashStr(key) || 1;
    var out = [], backs = [];
    for (let v = 0; v < 4; v++) {
      var c = make(T, T, function (p) {
        p.rect(0, 0, T, T, pal.base);
        // Organic blotches first. Loose specks alone read as TV static; full-width
        // bedding lines on every tile read as brickwork. Short, offset streaks that
        // do NOT touch both edges give layered rock without exposing the 16 bu grid.
        var streaks = 3 + ((rnd() * 3) | 0);
        for (let sI = 0; sI < streaks; sI++) {
          var sw = 4 + ((rnd() * 8) | 0);
          var sx = (rnd() * (T - sw)) | 0;
          var sy = 1 + ((rnd() * (T - 3)) | 0);
          var sh = 1 + ((rnd() * 2) | 0);
          p.rect(sx, sy, sw, sh, rnd() < 0.55 ? pal.dark : pal.light);
          if (rnd() < 0.5) p.rect(sx + 1, sy + sh, sw - 2, 1, pal.dark);
        }
        for (let i = 0; i < nSpeck; i++) p.px(rnd() * T, rnd() * T, rnd() < 0.5 ? pal.light : pal.dark);
        // ore flecks: the only high-contrast thing in the tile, so they read as mineral
        for (let i = 0; i < nClump; i++) {
          var x = (rnd() * (T - 3)) | 0, y = (rnd() * (T - 3)) | 0;
          p.rect(x, y, 2, 2, pal.speck);
          p.px(x + 2, y + 1, pal.dark);
        }
        // a partial bedding plane, offset per variant so stacked tiles never line up
        var bw = 6 + ((rnd() * 7) | 0), bx = (rnd() * (T - bw)) | 0;
        p.rect(bx, T - 1, bw, 1, pal.dark);
        p.rect(T - bx - bw, 0, bw, 1, pal.light);
        if (v === 3) {
          // crack: a jagged dark seam with a lit lip on its left
          var cx = 4 + ((rnd() * 6) | 0);
          for (let y2 = 1; y2 < T - 1; y2++) {
            p.px(cx, y2, shade(pal.dark, 0.55));
            p.px(cx - 1, y2, shade(pal.base, 1.22));
            if (y2 % 3 === 0) cx += rnd() < 0.5 ? -1 : 1;
            if (cx < 2) cx = 2; if (cx > T - 3) cx = T - 3;
          }
          p.rect(cx - 1, (T >> 1), 3, 2, shade(pal.dark, 0.55));
        }
      });
      out.push(c);
      // The far wall of the cutaway: the same tile, pushed back into shadow. Blitting
      // this behind the bore is what makes the shaft read as a carved space instead of
      // a hole punched in a texture.
      backs.push(make(T, T, function (p) {
        p.ctx.drawImage(c, 0, 0);
        p.rect(0, 0, T, T, "rgba(8,6,12,.58)");
      }));
      stats.tileBuilds++;
    }
    tiles[key] = out;
    backTiles[key] = backs;
    return out;
  }
  S.tilesFor = function (band) { return tiles[paletteKey(band)] || buildTiles(band); };
  S.backTilesFor = function (band) {
    var k = paletteKey(band);
    if (!backTiles[k]) buildTiles(band);
    return backTiles[k];
  };

  // ------------------------------------------------------------------ seam dither
  // The last two tile rows of band N are overdrawn with a 2 px checker of band N+1's
  // base: 25% density on row -2, 50% on row -1. Straight out of dinosaur-fight's
  // bgSky seam dither (src/game.js ~line 1063), which steps a 2 px checker over the
  // band boundary instead of a gradient.
  function buildSeam(fromBand, toBand, width) {
    var key = paletteKey(fromBand) + ">" + paletteKey(toBand) + "@" + width;
    if (seams[key]) return seams[key];
    var T = cfg.layout.tileBu;
    var next = paletteFor(toBand);
    var c = make(width, T * 2, function (p) {
      for (let row = 0; row < 2; row++) {
        var y0 = row * T;
        for (let y = 0; y < T; y += 2) {
          for (let x = 0; x < width; x += 2) {
            var cx = x >> 1, cy = (y0 + y) >> 1;
            var on = row === 0
              ? (((cx + cy) & 1) === 0 && (cx & 1) === 0)   // 25%
              : (((cx + cy) & 1) === 0);                    // 50%
            if (on) p.rect(x, y0 + y, 2, 2, next.base);
          }
        }
      }
    });
    stats.seamBuilds++;
    seams[key] = c;
    return c;
  }
  S.seamFor = buildSeam;

  // ------------------------------------------------------------------ shaft parts
  function buildShaftParts() {
    var L = cfg.layout;
    var T = L.tileBu, boreW = L.boreTiles * T;
    var W = (cfg.sprites && cfg.sprites.timber) || { post: "#6E4E2C", lit: "#9C7A46", dark: "#3d2a19" };

    // timber brace: two posts + a lintel across the bore (R4 2)
    brace = make(boreW, T, function (p) {
      p.rect(0, 1, boreW, 3, W.post);
      p.rect(0, 1, boreW, 1, W.lit);
      p.rect(0, 4, boreW, 1, W.dark);
      p.rect(2, 0, 2, T, W.post); p.rect(2, 0, 1, T, W.lit);
      p.rect(boreW - 4, 0, 2, T, W.post); p.rect(boreW - 4, 0, 1, T, W.dark);
      p.rect(1, T - 3, 4, 2, W.dark); p.rect(boreW - 5, T - 3, 4, 2, W.dark);
    });

    // ladder on the left face of the bore: 2 bu rails, a rung every 4 bu (one 16x64 tile)
    ladder = make(6, T * 4, function (p) {
      for (let y = 0; y < T * 4; y++) {
        p.rect(0, y, 2, 1, y % 8 < 4 ? W.post : shade(W.post, 0.86));
        p.rect(4, y, 2, 1, W.dark);
      }
      for (let y = 1; y < T * 4; y += 4) { p.rect(0, y, 6, 1, W.lit); p.rect(0, y + 1, 6, 1, W.dark); }
    });

    // elevator cage 24x28. The rope is NOT a sprite: one 1 bu fillRect column redrawn
    // each frame, so the cage can travel any distance for free (R4 2).
    var M = (cfg.sprites && cfg.sprites.metal) || { body: "#6b6f78", lit: "#9aa3ad", dark: "#3a3d45" };
    var EW = (cfg.sprites && cfg.sprites.elevatorWBu) || 24;
    var EH = (cfg.sprites && cfg.sprites.elevatorHBu) || 28;
    elevator = make(EW, EH, function (p) {
      p.rect(2, 3, 20, 3, M.body); p.rect(2, 3, 20, 1, M.lit);
      p.rect(10, 0, 4, 3, M.dark);
      p.rect(2, 6, 2, 19, M.body); p.rect(20, 6, 2, 19, M.body);
      p.rect(2, 6, 1, 19, M.lit); p.rect(21, 6, 1, 19, M.dark);
      for (let x = 6; x < 20; x += 4) p.rect(x, 7, 1, 17, M.dark);
      p.rect(2, 24, 20, 3, M.body); p.rect(2, 26, 20, 1, M.dark);
      p.rect(4, 8, 16, 14, "rgba(10,8,14,.45)");
    });
    ropeColor = M.dark;
  }
  S.brace = function () { return brace; };
  S.ladder = function () { return ladder; };
  S.elevator = function () { return elevator; };
  S.ropeColor = function () { return ropeColor; };

  // ------------------------------------------------------------------ cart
  // 20x14 with three ore-fill frames: empty / half / heaped. Cached per band so the
  // load is the colour of the rock the crew is actually in.
  function buildCarts(band) {
    var key = paletteKey(band);
    if (carts[key]) return carts[key];
    var M = (cfg.sprites && cfg.sprites.metal) || { body: "#6b6f78", lit: "#9aa3ad", dark: "#3a3d45" };
    var CW = (cfg.sprites && cfg.sprites.cartWBu) || 20;
    var CH = (cfg.sprites && cfg.sprites.cartHBu) || 14;
    var ore = band.veinColor || "#c9a227";
    var oreL = shade(ore, 1.35), oreD = shade(ore, 0.7);
    var out = [];
    for (let f = 0; f < 3; f++) {
      out.push(outline(make(CW, CH, function (p) {
        p.rect(1, 3, 18, 7, M.body);
        p.rect(1, 3, 18, 1, M.lit);
        p.rect(1, 9, 18, 1, M.dark);
        p.rect(1, 3, 1, 7, M.lit); p.rect(18, 3, 1, 7, M.dark);
        if (f > 0) {
          var h = f === 1 ? 3 : 5;
          p.rect(3, 8 - h, 14, h, ore);
          p.rect(3, 8 - h, 14, 1, oreL);
          p.rect(3, 7, 14, 1, oreD);
          if (f === 2) { p.rect(5, 2, 4, 2, ore); p.rect(11, 1, 5, 3, ore); p.px(12, 1, oreL); p.px(6, 2, oreL); }
        }
        p.rect(3, 10, 4, 4, M.dark); p.rect(4, 11, 2, 2, M.lit);
        p.rect(13, 10, 4, 4, M.dark); p.rect(14, 11, 2, 2, M.lit);
        p.rect(0, 12, 20, 1, M.dark);
      })));
    }
    carts[key] = out;
    return out;
  }
  S.cartsFor = function (band) { return carts[paletteKey(band)] || buildCarts(band); };

  // ------------------------------------------------------------------ dwarves
  // 14x16 (12x14 of body plus a 1 bu margin so outline() has room), faces RIGHT.
  // Frames: 0 idle, 1 walkA, 2 walkB, 3 digWindup, 4 digImpact, 5 haul.
  // Four layers composited AT CACHE TIME (body, beard, hat, pick), keyed by
  // `${beard}|${hat}|${pick}|${tunic}|${frame}` into a Map. Ten dwarves across four
  // loadouts is ~24 canvases, not 240 (R4 2). The beard is the joke: it survives
  // every cut in PRD 16.
  var DEFAULT_PALETTES = {
    rust: { tunic: "#8a4b2a", beard: "#c98a4a", hat: "#6d4a2a", skin: "#e3ab7c" },
    iron: { tunic: "#48505e", beard: "#b9bfc8", hat: "#7c848f", skin: "#dba982" },
    green: { tunic: "#3f6b46", beard: "#8f7a4a", hat: "#2f4f36", skin: "#e0a878" },
    ash: { tunic: "#5a5350", beard: "#d8d2c6", hat: "#3c3733", skin: "#d9a67e" }
  };
  var PICK_TIERS = [
    { shaft: "#8a6438", head: "#8d949c", big: 0 },
    { shaft: "#9c7a46", head: "#b9c0c8", big: 0 },
    { shaft: "#a98a52", head: "#d8dde3", big: 1 },
    { shaft: "#c2a05f", head: "#f2e6b4", big: 1 }
  ];

  function palOf(id) {
    var fromCfg = cfg && cfg.sprites && cfg.sprites.palettes && cfg.sprites.palettes[id];
    return fromCfg || DEFAULT_PALETTES[id] || DEFAULT_PALETTES.rust;
  }

  function drawBeard(p, id, B, BD, BL, bob) {
    var y = 5 + bob;
    p.rect(3, y, 6, 2, B);
    p.rect(3, y, 6, 1, BL);
    p.px(8, y + 1, BD);
    if (id === "short") { p.rect(4, y + 2, 4, 1, B); p.px(4, y + 2, BD); }
    else if (id === "long") { p.rect(3, y + 2, 6, 2, B); p.rect(4, y + 4, 4, 1, B); p.px(5, y + 5, BD); p.px(3, y + 2, BD); }
    else if (id === "forked") { p.rect(3, y + 2, 2, 3, B); p.rect(7, y + 2, 2, 3, B); p.px(3, y + 4, BD); p.px(8, y + 4, BD); }
    else { // braided — the default, and the one that reads best at 12 px
      p.rect(3, y + 2, 6, 1, B);
      p.rect(4, y + 3, 2, 3, B); p.px(4, y + 4, BD); p.px(5, y + 3, BL);
      p.rect(6, y + 3, 2, 2, B); p.px(7, y + 4, BD);
      p.px(5, y + 6, "#c9a227");   // the bead
    }
  }

  function drawHat(p, id, HAT, HATD, bob) {
    if (id === "none") { p.rect(3, 1 + bob, 6, 1, HATD); p.px(2, 2 + bob, HATD); return; }
    if (id === "hood") {
      p.rect(2, 0 + bob, 7, 2, HAT); p.rect(2, 0 + bob, 7, 1, shade(HAT, 1.2));
      p.px(2, 2 + bob, HAT); p.px(2, 3 + bob, HATD); p.px(1, 3 + bob, HATD);
      return;
    }
    if (id === "helm") {
      p.rect(3, 0 + bob, 5, 1, HAT); p.rect(2, 1 + bob, 7, 1, HAT);
      p.rect(5, 0 + bob, 1, 1, shade(HAT, 1.45));
      p.px(2, 2 + bob, HATD); p.px(8, 2 + bob, HATD);
      p.px(2, 1 + bob, HATD); p.px(8, 1 + bob, HATD);
      return;
    }
    // cap
    p.rect(3, 0 + bob, 5, 1, HAT); p.rect(2, 1 + bob, 7, 1, HAT);
    p.px(2, 1 + bob, HATD); p.px(8, 1 + bob, HATD);
    p.rect(8, 1 + bob, 2, 1, shade(HAT, 1.25));
  }

  function drawPick(p, tier, frame, bob) {
    var K = PICK_TIERS[tier] || PICK_TIERS[0];
    if (frame === 5) {   // haul: both hands on an ore chunk, pick stowed on the back
      p.rect(1, 6 + bob, 1, 4, K.shaft);
      return;
    }
    if (frame === 3) {   // windup: hauled back and up over the shoulder
      p.rect(6, 1 + bob, 1, 1, K.shaft); p.rect(7, 2 + bob, 1, 1, K.shaft);
      p.rect(8, 3 + bob, 1, 1, K.shaft); p.rect(9, 4 + bob, 1, 2, K.shaft);
      p.rect(4, 0 + bob, 3, 1, K.head); p.px(3, 1 + bob, K.head);
      if (K.big) { p.px(6, 1 + bob, K.head); p.px(3, 0 + bob, K.head); }
      return;
    }
    if (frame === 4) {   // impact: driven forward and down into the face
      p.rect(10, 6 + bob, 1, 1, K.shaft); p.rect(11, 7 + bob, 1, 1, K.shaft);
      p.rect(12, 8 + bob, 1, 1, K.shaft);
      p.rect(11, 9 + bob, 2, 1, K.head); p.px(12, 10 + bob, K.head);
      if (K.big) { p.px(13, 9 + bob, K.head); p.px(11, 10 + bob, K.head); }
      return;
    }
    // carried upright
    p.rect(10, 3 + bob, 1, 7, K.shaft);
    p.rect(9, 2 + bob, 3, 1, K.head);
    p.px(12, 3 + bob, K.head);
    if (K.big) { p.px(8, 2 + bob, K.head); p.px(12, 2 + bob, K.head); }
  }

  function buildDwarf(beardId, hatId, pickTier, palId, frame) {
    var DW = (cfg.sprites && cfg.sprites.dwarfWBu) || 14;
    var DH = (cfg.sprites && cfg.sprites.dwarfHBu) || 16;
    var P = palOf(palId);
    var T = P.tunic, TD = shade(T, 0.72), TL = shade(T, 1.18);
    var SKIN = P.skin || "#e0a878", SKIND = shade(SKIN, 0.78);
    var B = P.beard, BD = shade(B, 0.74), BL = shade(B, 1.2);
    var HAT = P.hat || "#6d4a2a", HATD = shade(HAT, 0.68);
    var LEG = "#3d2c1c", BOOT = "#241810", EYE = "#140f12";
    var bob = (frame === 2 || frame === 5) ? 1 : 0;

    return outline(make(DW, DH, function (p0) {
      // 1 bu margin all round so outline() has somewhere to put the dark rim
      var p = {
        px: function (x, y, c) { p0.px(x + 1, y + 1, c); },
        rect: function (x, y, w, h, c) { p0.rect(x + 1, y + 1, w, h, c); }
      };

      // --- layer 1: body (head, torso, arms, legs)
      p.rect(3, 2 + bob, 6, 3, SKIN);
      p.px(3, 4 + bob, SKIND); p.px(8, 4 + bob, SKIND);
      p.px(7, 3 + bob, EYE);
      p.rect(2, 6 + bob, 8, 5, T);
      p.rect(2, 6 + bob, 1, 5, TD);
      p.px(4, 6 + bob, TL); p.px(5, 7 + bob, TL);
      p.rect(2, 10 + bob, 8, 1, TD);
      p.rect(4, 10 + bob, 3, 1, "#c9a227");
      if (frame === 3) { p.rect(9, 5 + bob, 2, 3, T); p.px(10, 5 + bob, SKIN); p.rect(1, 8 + bob, 1, 2, TD); }
      else if (frame === 4) { p.rect(9, 7 + bob, 2, 2, T); p.px(10, 8 + bob, SKIN); p.rect(1, 7 + bob, 1, 2, TD); }
      else if (frame === 5) { p.rect(9, 7 + bob, 1, 2, T); p.rect(1, 7 + bob, 1, 2, TD); p.rect(9, 9 + bob, 3, 3, "#c9a227"); p.px(10, 9 + bob, "#f2e2a0"); }
      else { p.rect(10, 7 + bob, 1, 3, T); p.px(10, 10 + bob, SKIN); p.rect(1, 7 + bob, 1, 3, TD); p.px(1, 10 + bob, SKIN); }

      // legs sit on the ground line whatever the torso is doing
      if (frame === 1) { p.rect(3, 11, 2, 2, LEG); p.rect(6, 11, 2, 2, LEG); p.rect(2, 13, 3, 1, BOOT); p.rect(6, 13, 3, 1, BOOT); }
      else if (frame === 2) { p.rect(4, 11, 2, 2, LEG); p.rect(5, 11, 2, 2, LEG); p.rect(3, 13, 3, 1, BOOT); p.rect(6, 13, 2, 1, BOOT); }
      else if (frame === 3 || frame === 4) { p.rect(2, 11, 2, 2, LEG); p.rect(7, 11, 2, 2, LEG); p.rect(1, 13, 3, 1, BOOT); p.rect(7, 13, 3, 1, BOOT); }
      else { p.rect(3, 11, 2, 2, LEG); p.rect(6, 11, 2, 2, LEG); p.rect(3, 13, 2, 1, BOOT); p.rect(6, 13, 2, 1, BOOT); }

      // --- layer 2: beard   --- layer 3: hat   --- layer 4: pick
      drawBeard(p, beardId, B, BD, BL, bob);
      drawHat(p, hatId, HAT, HATD, bob);
      drawPick(p, pickTier, frame, bob);
    }));
  }

  // The cache key IS the loadout string the PRD names. A frame is never rebuilt.
  S.dwarf = function (beardId, hatId, pickTier, palId, frame) {
    var lo = beardId + "|" + hatId + "|" + pickTier + "|" + palId;
    var key = lo + "|" + frame;
    var c = dwarves.get(key);
    if (c) return c;
    loadouts.add(lo);
    c = buildDwarf(beardId, hatId, pickTier, palId, frame);
    stats.dwarfBuilds++;
    dwarves.set(key, c);
    return c;
  };
  S.dwarfFlash = function (beardId, hatId, pickTier, palId, frame) {
    var key = beardId + "|" + hatId + "|" + pickTier + "|" + palId + "|" + frame + "|w";
    var c = dwarves.get(key);
    if (c) return c;
    c = silhouette(S.dwarf(beardId, hatId, pickTier, palId, frame));
    dwarves.set(key, c);
    return c;
  };
  S.dwarfCacheSize = function () { return dwarves.size; };
  S.dwarfLoadoutCount = function () { return loadouts.size; };

  // ------------------------------------------------------------------ logo
  // "GREEDY DEEP" drawn as pixels, so the splash never scales a font against the
  // painted card. 4x6 glyphs on a 1 bu grid, blocky enough to read at scale 2.
  var FONT = {
    A: ["0110", "1001", "1001", "1111", "1001", "1001"],
    B: ["1110", "1001", "1110", "1001", "1001", "1110"],
    C: ["0111", "1000", "1000", "1000", "1000", "0111"],
    D: ["1110", "1001", "1001", "1001", "1001", "1110"],
    E: ["1111", "1000", "1110", "1000", "1000", "1111"],
    G: ["0111", "1000", "1011", "1001", "1001", "0111"],
    P: ["1110", "1001", "1110", "1000", "1000", "1000"],
    R: ["1110", "1001", "1110", "1010", "1001", "1001"],
    Y: ["1001", "1001", "0110", "0010", "0010", "0010"],
    " ": ["0000", "0000", "0000", "0000", "0000", "0000"]
  };
  S.logo = function (text, colTop, colBot, colShadow) {
    var chars = text.split("");
    var w = chars.length * 5 - 1, h = 6;
    return make(w + 2, h + 3, function (p) {
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < chars.length; i++) {
          var g = FONT[chars[i]] || FONT[" "];
          for (let y = 0; y < 6; y++) for (let x = 0; x < 4; x++) {
            if (g[y][x] !== "1") continue;
            if (pass === 0) p.rect(i * 5 + x, y + 2, 2, 2, colShadow);
            else p.rect(i * 5 + x, y, 2, 2, y < 3 ? colTop : colBot);
          }
        }
      }
    });
  };

  // ------------------------------------------------------------------ blank-cache guard
  // BLOCKER 1 (M3 visual critic): the whole sprite cache was observed fully transparent
  // on a page that loaded while its tab was hidden — every tile, dwarf frame, cart frame,
  // brace, ladder and cage at 0 of N opaque pixels — while a freshly-keyed rebuild drew
  // correctly. Nothing in the draw code can produce that; a 2D backing store the browser
  // hibernated or lost can, and once it happens the cache serves blanks forever because
  // nothing ever re-checks it. Two defences: outline() can no longer wipe a sprite
  // (above), and the cache is verified after every build and again whenever the page
  // becomes visible, rebuilding itself if any entry has gone blank.
  function eachEntry(fn) {
    var k, i;
    for (k in tiles) for (i = 0; i < tiles[k].length; i++) fn("tile:" + k + ":" + i, tiles[k][i]);
    for (k in backTiles) for (i = 0; i < backTiles[k].length; i++) fn("back:" + k + ":" + i, backTiles[k][i]);
    for (k in seams) fn("seam:" + k, seams[k]);
    for (k in carts) for (i = 0; i < carts[k].length; i++) fn("cart:" + k + ":" + i, carts[k][i]);
    dwarves.forEach(function (c, key) { fn("dwarf:" + key, c); });
    fn("brace", brace); fn("ladder", ladder); fn("elevator", elevator);
  }

  // {total, opaque, blank:[keys]}. A canvas that cannot be read back (-1) counts as
  // unknown, not as blank, so a tainted-canvas edge case never triggers a rebuild loop.
  S.verify = function () {
    var total = 0, opaque = 0, blank = [];
    eachEntry(function (key, c) {
      if (!c) { blank.push(key); total++; return; }
      total++;
      var n = opaqueCount(c);
      if (n > 0 || n === -1) opaque++;
      else blank.push(key);
    });
    stats.total = total; stats.opaque = opaque; stats.blankKeys = blank;
    return { total: total, opaque: opaque, blank: blank };
  };

  // Verify, and rebuild once if anything came back blank. Returns the final report.
  // `strict` (debug builds) throws if a full rebuild still cannot produce pixels, which
  // is a genuinely unrecoverable state and should fail loud rather than ship blank art.
  S.ensure = function (strict) {
    var v = S.verify();
    if (v.blank.length === 0) return v;
    stats.rebuilds++;
    S.build(cfg, true);
    v = S.verify();
    if (v.blank.length && strict) {
      throw new Error("[GDSprites] " + v.blank.length + " of " + v.total +
        " cached sprites are blank after a rebuild: " + v.blank.slice(0, 5).join(", "));
    }
    return v;
  };

  // The page coming back into view is exactly when a hibernated backing store shows up
  // as blank, so that is when the cache is re-checked.
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && cfg) S.ensure(false);
    });
    window.addEventListener("pageshow", function () { if (cfg) S.ensure(false); });
  }

  // ------------------------------------------------------------------ build
  S.build = function (config, rebuilding) {
    cfg = config;
    tiles = {}; backTiles = {}; seams = {}; carts = {};
    dwarves = new Map(); loadouts = new Set();
    // Reset the per-build counters only. rebuilds / outlineFailures are incident history
    // and must survive a rebuild, or the guard loses the evidence it exists to collect.
    stats.tileBuilds = 0; stats.dwarfBuilds = 0; stats.seamBuilds = 0;
    stats.blankKeys = []; stats.opaque = 0; stats.total = 0;
    buildShaftParts();
    // Pre-build every band's tiles and cart up front so the first frame in a new band
    // is not the frame that pays for them.
    for (var i = 0; i < cfg.ores.length; i++) {
      var b = cfg.ores[i];
      if (b.index === undefined) b.index = i;
      buildTiles(b); buildCarts(b);
      if (i > 0) buildSeam(cfg.ores[i - 1], b, cfg.layout.columnBu);
    }
    // Every dwarf's declared loadout, all six frames, all four pick tiers.
    var tierMax = (cfg.sprites && cfg.sprites.pickTiers ? cfg.sprites.pickTiers : 4) - 1;
    var frames = (cfg.sprites && cfg.sprites.dwarfFrames) || 6;
    for (var d = 0; d < cfg.dwarves.length; d++) {
      var cos = cfg.dwarves[d].cosmetic || {};
      for (var t = 0; t <= tierMax; t++) {
        for (var f = 0; f < frames; f++) S.dwarf(cos.beard || "braided", cos.hat || "cap", t, cos.palette || "rust", f);
      }
    }
    // The build is synchronous, runs the moment the config is in hand, and never waits
    // on rAF, a layout measurement or a paint — so it is identical in a hidden tab.
    if (!rebuilding) S.verify();
    return S.stats();
  };
})();
