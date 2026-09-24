// Peasant Swarm — procedural pixel sprites (SPEC-v2 §11). All original, owned by Click it! Studios.
// One art pixel = 2 world px for everything: every canvas here is drawn at art resolution and scaled 2x at render time (imageSmoothing
// off). Colours come from PS.PAL (src/palette.js). Outlines are composited (a dark silhouette at the 4 orthogonal offsets under the
// sprite): nothing here reads a canvas back (studio lesson 27). Peasants: one atlas canvas per team and hat style (4 poses x 2 facings x
// plain / hit-flash, shadow baked in), so an agent is ONE drawImage. Arms relic overlays (hat band, crest, tines) are part of the atlas key (M6).
window.PS = window.PS || {};

PS.buildSprites = function (cfg) {
  const PAL = PS.PAL, A = cfg.art, BART = A.bannerPole.map((pole, k) => [pole, A.bannerFlagW[k], A.bannerFlagH[k], A.bannerEmblem[k]]); // per tier: pole, flag w, flag h, emblem
  let seed = 20260901;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

  function make(w, h, draw) {
    const c = mk(w, h), ctx = c.getContext("2d");
    const p = {
      px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, 1, 1); },
      rect(x, y, ww, hh, col) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, ww | 0, hh | 0); },
      ell(cx, cy, rx, ry, col) {
        ctx.fillStyle = col;
        for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
          const t = (y - cy) / ry, half = rx * Math.sqrt(Math.max(0, 1 - t * t));
          ctx.fillRect(Math.round(cx - half), y, Math.max(1, Math.round(half * 2)), 1);
        }
      },
      bits(x, y, rows, col) { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === "X") p.px(x + i, y + j, col); },
      ctx,
    };
    draw(p);
    return c;
  }
  // `src` in one colour (source-in), then that silhouette at the 4 orthogonal offsets under `src`: the outline, by compositing only
  function tint(src, col) { const c = mk(src.width, src.height), g = c.getContext("2d"); g.drawImage(src, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return c; }
  function outlined(src, col) {
    const sil = tint(src, col || PAL.ink), c = mk(src.width, src.height), g = c.getContext("2d");
    g.drawImage(sil, 1, 0); g.drawImage(sil, -1, 0); g.drawImage(sil, 0, 1); g.drawImage(sil, 0, -1); g.drawImage(src, 0, 0);
    return c;
  }
  // a shadow ellipse, then the outlined art on top (one canvas: the shadow is part of the sprite, one draw per thing)
  function withShadow(src, cx, cy, rx, ry) { return make(src.width, src.height, (p) => { p.ell(cx, cy, rx, ry, PAL.shadow); p.ctx.drawImage(src, 0, 0); }); }
  const shade = PAL.shade;

  // ---------- peasants: one atlas per (colour, hat style, relics) ----------
  // Frame cell FW x FH art px; the body's local origin sits at (OX, OY) so hats reach 4 rows up and a brim or tines 2-3 columns out.
  // Frames: poses 0 walkA, 1 walkB (body a pixel up), 2 lunge (pitchfork thrust), 3 idle; + 4 facing left (mirrored); + 8 hit flash.
  const FW = 16, FH = 20, OX = 3, OY = 5, AXR = 7, AY = 17; // anchor: the feet centre (facing right; left mirrors to FW - AXR)
  const STYLES = ["hood", "flatcap", "brim", "feather", "headband", "pointed", "straw", "kerchief"];
  // hats, local coords (the face is rows 2-3, x 2..5). H base, D shade, L light, F the feather. Pixels in the team ramp count as hat.
  function hat(p, style, C) {
    const H = C.hat, D = C.hatD, L = C.hatL;
    if (style === "hood") { p.rect(2, -1, 4, 1, H); p.px(3, -1, L); p.rect(1, 0, 6, 2, H); p.rect(1, 0, 1, 2, D); p.px(0, 1, D); p.px(0, 2, D); p.rect(1, 2, 1, 2, D); p.rect(6, 2, 1, 2, H); p.rect(1, 4, 6, 1, D); p.rect(2, 4, 4, 1, H); }
    else if (style === "flatcap") { p.rect(1, -1, 6, 1, H); p.px(2, -1, L); p.px(3, -1, L); p.rect(0, 0, 8, 1, H); p.px(0, 0, D); p.rect(1, 1, 5, 1, D); p.rect(6, 1, 3, 1, H); p.px(8, 1, D); }
    else if (style === "brim") { p.rect(2, -2, 4, 2, H); p.px(3, -2, L); p.px(2, -1, D); p.rect(1, 0, 6, 1, D); p.rect(-1, 1, 10, 1, H); p.px(-1, 1, D); p.px(8, 1, D); p.px(4, 1, L); }
    else if (style === "feather") { p.rect(2, -2, 4, 1, H); p.rect(1, -1, 6, 2, H); p.px(2, -1, L); p.px(3, -2, L); p.rect(0, 1, 8, 1, D); p.px(1, -4, PAL.cream); p.px(0, -3, PAL.cream); p.px(1, -3, PAL.cream); p.px(1, -2, PAL.foam); }
    else if (style === "headband") { p.px(2, -2, PAL.hair); p.px(4, -2, PAL.hair); p.rect(2, -1, 4, 1, H); p.rect(1, 0, 6, 1, H); p.rect(1, 1, 6, 1, D); p.px(4, 0, L); p.px(3, -1, L); p.px(0, 0, H); p.px(-1, 0, H); p.px(-1, 1, D); p.px(-2, 1, D); p.px(-2, 2, D); }
    else if (style === "pointed") { p.px(2, -4, H); p.rect(2, -3, 2, 1, H); p.rect(2, -2, 3, 1, H); p.rect(1, -1, 5, 1, H); p.rect(1, 0, 6, 2, H); p.px(3, -2, L); p.px(4, -1, L); p.rect(1, -1, 1, 3, D); p.rect(1, 2, 1, 2, D); p.rect(6, 2, 1, 2, H); }
    else if (style === "straw") { p.rect(2, -1, 4, 1, H); p.px(3, -1, L); p.rect(2, 0, 4, 1, D); p.rect(-1, 1, 10, 1, H); p.px(1, 1, L); p.px(6, 1, L); p.px(-1, 1, D); p.px(8, 1, D); }
    else if (style === "kerchief") { p.rect(1, -1, 6, 3, H); p.rect(1, 1, 6, 1, D); p.px(0, 1, D); p.px(-1, 2, D); p.rect(2, 3, 4, 1, D); }
  }
  // relic overlays (SPEC-v2 §8, §11, M6): each gets the art painter, the pose and the tier, and draws over the finished body. Arms I-III: the hat
  // band leather -> iron -> iron with a crest, the tines iron -> steel -> gold. Boots and Horn read elsewhere (dust puffs, the banner horn).
  const BAND = [null, "#8A5A34", "#9AA4B0", "#9AA4B0"], TINE = [null, ["#6E7480", "#A8B0BC"], ["#B8CCE0", "#EEF6FF"], ["#C8962C", "#F6D56A"]];
  const RELIC = {
    helmet: (p, pose, tier) => { const t = Math.min(3, tier); p.rect(2, 1, 4, 1, BAND[t]); if (t >= 3) { p.px(3, -3, "#D8403A"); p.px(4, -3, "#D8403A"); p.px(4, -4, "#F6CF6A"); p.px(3, -2, "#A8302C"); } },
    tines: (p, pose, tier) => { const c = TINE[Math.min(3, tier)]; if (pose === 2) { p.rect(10, 5, 1, 3, c[0]); p.px(11, 5, c[1]); p.px(11, 7, c[1]); p.px(10, 6, c[1]); } else { p.rect(7, 0, 3, 1, c[0]); p.px(7, -1, c[1]); p.px(9, -1, c[1]); p.px(8, 0, c[1]); } },
    shield: (p, pose, tier) => {},
  };
  function body(style, C, pose, relics) {
    const src = mk(FW, FH), g = src.getContext("2d");
    const P0 = { px: (x, y, c) => { g.fillStyle = c; g.fillRect(x + OX, y + OY, 1, 1); }, rect: (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x + OX, y + OY, w, h); } };
    const up = pose === 1 ? -1 : 0; // walkB carries the upper body one art pixel higher (the bob, baked: sprites never move off the art grid)
    const p = { px: (x, y, c) => P0.px(x, y + up, c), rect: (x, y, w, h, c) => P0.rect(x, y + up, w, h, c) };
    const SH = PAL.shaft, T0 = PAL.tine[1], T1 = PAL.tine[0], SK = PAL.skin[1], SKD = PAL.skin[0];
    // pitchfork: upright at rest, thrust forward on the lunge
    if (pose === 2) { p.rect(4, 6, 6, 1, SH); p.rect(10, 5, 1, 3, T0); p.px(11, 5, T0); p.px(11, 7, T0); p.px(10, 6, T1); }
    else { p.rect(8, 1, 1, 10, SH); p.rect(7, 0, 3, 1, T0); p.px(7, -1, T0); p.px(9, -1, T0); p.px(8, 0, T1); }
    // face and hair (hats cover the top), tunic in the muted team shade, arms, belt
    p.rect(2, 1, 4, 1, PAL.hair); p.rect(2, 2, 4, 2, SK); p.px(5, 2, PAL.ink); p.px(2, 3, SKD);
    p.rect(1, 4, 6, 4, C.tun); p.rect(1, 4, 1, 4, C.tunD); p.px(4, 5, shade(C.tun, -0.6));
    p.rect(1, 8, 6, 1, C.tunD);
    if (pose === 2) { p.rect(6, 5, 2, 1, SK); p.px(0, 6, SK); } else { p.rect(0, 5, 1, 2, SK); p.rect(7, 5, 1, 2, SK); }
    hat(p, style, C);
    // legs (rows 9-10) and boots (row 11); walkB fills the gap the raised body leaves
    const L = PAL.leg, B = PAL.boot;
    if (pose === 0) { P0.rect(2, 9, 2, 2, L); P0.rect(4, 9, 2, 2, L); P0.rect(1, 11, 2, 1, B); P0.rect(5, 11, 2, 1, B); }
    else if (pose === 1) { P0.rect(2, 8, 2, 3, L); P0.rect(5, 8, 2, 3, L); P0.rect(2, 11, 2, 1, B); P0.rect(5, 11, 2, 1, B); }
    else if (pose === 2) { P0.rect(1, 9, 2, 2, L); P0.rect(5, 9, 2, 2, L); P0.rect(0, 11, 2, 1, B); P0.rect(5, 11, 3, 1, B); }
    else { P0.rect(2, 9, 2, 2, L); P0.rect(4, 9, 2, 2, L); P0.rect(2, 11, 2, 1, B); P0.rect(4, 11, 2, 1, B); }
    if (relics) for (const k in RELIC) if (relics[k] > 0) RELIC[k](p, pose, relics[k]);
    return src;
  }
  // the atlas: 4 columns (poses) x 4 rows (right, left, right flash, left flash)
  function paintAtlas(atlas, color, style, relics) {
    const C = style === "straw" ? { hat: PAL.straw[1], hatD: PAL.straw[0], hatL: PAL.straw[2], tun: PAL.neutral[2], tunD: PAL.neutral[1] }
      : style === "kerchief" ? { hat: PAL.bandit[2], hatD: PAL.bandit[1], hatL: PAL.cream, tun: PAL.bandit[1], tunD: PAL.bandit[0] } : PAL.ramp(color);
    const g = atlas.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.clearRect(0, 0, atlas.width, atlas.height);
    for (let pose = 0; pose < 4; pose++) {
      const o = outlined(body(style, C, pose, relics));
      const fl = make(FW, FH, (p) => { p.ctx.drawImage(o, 0, 0); p.ctx.globalCompositeOperation = "source-atop"; p.ctx.globalAlpha = A.flashWhite; p.rect(0, 0, FW, FH, PAL.cream); });
      for (let row = 0; row < 4; row++) {
        const x = pose * FW, y = row * FH, left = row & 1, im = row >= 2 ? fl : o;
        g.save(); if (left) { g.translate(x + FW, y); g.scale(-1, 1); } else g.translate(x, y);
        g.fillStyle = PAL.shadow; for (let yy = 16; yy <= 18; yy++) { const hw = yy === 17 ? 5 : 3; g.fillRect(AXR - hw, yy, hw * 2, 1); } // the baked shadow under the feet
        g.drawImage(im, 0, 0); g.restore();
      }
    }
    return C;
  }
  const SETS = new Map();
  // peasantSet(color, style, relics): style is a STYLES name or a team id (1 player hood .. 6 pointed hood); cached per key, ever
  function peasantSet(color, style, relics) {
    const st = typeof style === "string" ? style : STYLES[((style || 1) - 1) % 6] || "hood", key = color + "|" + st + "|" + (relics ? JSON.stringify(relics) : "");
    let s = SETS.get(key); if (s) return s;
    const atlas = mk(FW * 4, FH * 4), C = paintAtlas(atlas, color, st, relics), sx = new Int16Array(16), sy = new Int16Array(16);
    for (let f = 0; f < 16; f++) { sx[f] = (f & 3) * FW; sy[f] = (f >> 2) * FH; }
    s = { atlas, key, color, style: st, relics: relics || null, sx, sy, fw: FW, fh: FH, axR: AXR, axL: FW - AXR, ay: AY, hat: [C.hatD, C.hat, C.hatL] };
    SETS.set(key, s); return s;
  }

  // ---------- banner bearer: one atlas per team, 4 size tiers (rows) x 3 pennant frames (columns) ----------
  const BW = 28, BH = 44, BPX = 4, BPY = 42; // cell, pole base anchor
  const EMB = [["X.X.X", "X.X.X", "XXXXX", "..X..", "..X.."], ["X.X.X", ".XXX.", "XXXXX", ".XXX.", "X.X.X"], ["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."],
    ["..X..", "XXXXX", ".XXX.", ".X.X.", "X...X"], [".XXX.", "..X..", "XXXXX", "..X..", "..X.."], [".XXX.", "XX...", "X....", "XX...", ".XXX."]];
  function paintBanner(cv, color, style) {
    const C = PAL.ramp(color), T = BART, g = cv.getContext("2d"), si = Math.max(0, STYLES.indexOf(style)) % 6;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    for (let tier = 0; tier < 4; tier++) for (let fr = 0; fr < 3; fr++) {
      const t = T[tier], pole = t[0], fw = t[1], fh = t[2];
      const src = make(BW, BH, (p) => {
        const top = BPY - pole;
        p.rect(BPX, top, tier === 3 ? 2 : 1, pole, PAL.wood[1]); p.px(BPX, top + 2, PAL.wood[3]); p.rect(BPX - 1, top - 1, 3, 1, tier >= 2 ? PAL.fire[2] : PAL.cream);
        for (let i = 0; i < fw; i++) {
          const wave = i < 2 ? 0 : Math.round(Math.sin(i * 0.55 - fr * 2.094) * (tier >= 2 ? 1.2 : 0.8)), notch = i >= fw - 3 ? Math.max(0, i - (fw - 3) + 1) : 0;
          for (let j = 0; j < fh; j++) {
            if (notch && j >= ((fh - notch) >> 1) && j < ((fh + notch) >> 1)) continue; // swallow tail
            p.px(BPX + 1 + i, top + 1 + j + wave, j === 0 ? C.hatL : j === fh - 1 ? C.hatD : C.hat);
          }
        }
        const em = EMB[si], es = t[3], ex = BPX + 1 + ((fw - es) >> 1) - 1, ey = top + 1 + ((fh - es) >> 1);
        if (es === 5) for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) { if (em[j][i] !== "X") continue; const w = Math.round(Math.sin((ex + i - BPX - 1) * 0.55 - fr * 2.094) * (tier >= 2 ? 1.2 : 0.8)); p.px(ex + i, ey + j + (ex + i - BPX - 1 < 2 ? 0 : w), PAL.cream); }
        else if (es === 3) { const w = Math.round(Math.sin((ex + 1 - BPX - 1) * 0.55 - fr * 2.094) * 0.8); p.px(ex + 1, ey + w, PAL.cream); p.rect(ex, ey + 1 + w, 3, 1, PAL.cream); p.px(ex + 1, ey + 2 + w, PAL.cream); }
      });
      g.drawImage(outlined(src), fr * BW, tier * BH);
    }
  }
  const BANNERS = new Map();
  function banner(color, style) {
    const st = typeof style === "string" ? style : STYLES[((style || 1) - 1) % 6] || "hood", key = color + "|" + st;
    let b = BANNERS.get(key); if (b) return b;
    const cv = mk(BW * 3, BH * 4); paintBanner(cv, color, st);
    b = { cv, key, color, style: st, bw: BW, bh: BH, px: BPX, py: BPY, top: BART.map((t) => BPY - t[0] - 2) }; BANNERS.set(key, b); return b;
  }

  // ---------- trees (small, big, highland pine) and rocks (2), shadows baked; drawn at 2x with the trunk base at the collider ----------
  function tree(big) {
    const w = big ? 20 : 16, h = big ? 26 : 21, r = big ? 8 : 6, cx = w / 2, LF = PAL.leaf;
    const art = make(w, h, (p) => {
      p.rect(cx - 1, h - 8, 2, 7, PAL.wood[1]); p.px(cx - 1, h - 8, PAL.wood[2]);
      p.ell(cx, r + 2, r, r * 0.92, LF[1]); p.ell(cx - 1, r + 1, r * 0.8, r * 0.7, LF[2]); p.ell(cx - 2, r - 1, r * 0.45, r * 0.4, LF[3]);
      p.rect(cx - r + 1, r * 2 + 1, r * 2 - 2, 1, LF[0]);
      for (let i = 0; i < (big ? 10 : 6); i++) p.px(cx - r + 1 + rnd() * (r * 2 - 2), 2 + rnd() * r * 1.5, rnd() < 0.5 ? LF[1] : LF[3]);
    });
    return { cv: withShadow(outlined(art), cx, h - 2, r * 0.8, 1.6), ax: cx, ay: h - 2 };
  }
  function pine() {
    const w = 14, h = 24, cx = 7, P = PAL.pine;
    const art = make(w, h, (p) => {
      p.rect(cx - 1, h - 6, 2, 5, PAL.wood[0]);
      for (let k = 0; k < 4; k++) { const y0 = 2 + k * 4, hw = 2 + k * 1.3; for (let j = 0; j < 6; j++) { const half = Math.round((j / 5) * hw) + 1; p.rect(cx - half, y0 + j, half * 2, 1, j === 5 ? P[0] : P[1]); p.px(cx - half, y0 + j, P[2]); } }
      p.px(cx, 1, P[2]);
    });
    return { cv: withShadow(outlined(art), cx, h - 2, 4, 1.4), ax: cx, ay: h - 2 };
  }
  function rockArt(v) {
    const S = PAL.stone, w = v ? 12 : 14, h = v ? 9 : 10;
    const art = make(w, h, (p) => {
      if (v) { p.ell(6, 5, 5, 3.4, S[2]); p.ell(5, 4, 3.6, 2.4, S[3]); p.px(4, 3, S[4]); p.px(8, 6, S[1]); }
      else { p.ell(7, 6, 6, 3.6, S[2]); p.ell(6, 5, 4.5, 2.6, S[3]); p.ell(4, 4, 2, 1.2, S[4]); p.px(10, 7, S[1]); p.px(3, 7, S[1]); }
    });
    return { cv: withShadow(outlined(art, PAL.inkSoft), w / 2, h - 1.5, w * 0.42, 1.4), ax: w / 2, ay: h - 2 };
  }
  const trees = [tree(false), tree(true), pine()], rocks = [rockArt(0), rockArt(1)];

  // ---------- camp dirt: four variants (sprites, never baked: camps come and go) ----------
  function campArt(v) {
    const E = PAL.earth, w = 32, h = 20;
    return make(w, h, (p) => {
      const rx = [15, 14, 13, 15][v], ry = [8, 7, 8, 7][v];
      p.ell(16, 11, rx, ry, E[2]); p.ell(16, 11, rx - 2, ry - 2, E[3]);
      for (let i = 0; i < 14; i++) p.px(4 + rnd() * 24, 5 + rnd() * 12, rnd() < 0.5 ? E[1] : E[2]);
      // fire ring, logs, and a per-variant detail (log bench, pot, bedroll, woodpile)
      p.ell(16, 12, 3, 1.6, PAL.stone[2]); p.rect(14, 11, 4, 1, PAL.stone[1]);
      p.rect(15, 10, 3, 2, PAL.fire[0]); p.rect(15, 9, 2, 1, PAL.fire[1]); p.px(16, 8, PAL.fire[2]);
      if (v === 0) { p.rect(6, 14, 7, 2, PAL.wood[2]); p.rect(6, 15, 7, 1, PAL.wood[1]); }
      else if (v === 1) { p.rect(22, 10, 3, 3, PAL.stone[1]); p.rect(22, 10, 3, 1, PAL.stone[3]); }
      else if (v === 2) { p.rect(5, 8, 6, 3, PAL.neutral[1]); p.rect(5, 8, 6, 1, PAL.neutral[2]); }
      else { for (let k = 0; k < 3; k++) p.rect(21, 13 + k, 6 - k, 1, k & 1 ? PAL.wood[1] : PAL.wood[2]); }
    });
  }
  const camps = [0, 1, 2, 3].map(campArt);

  // ---------- ground decals (non-colliding dressing, baked into the chunks at art resolution, in clusters) ----------
  const LF = PAL.leaf, FL = PAL.flower;
  const decals = [
    make(8, 6, (p) => { p.ell(4, 3.5, 3.6, 2.4, LF[1]); p.ell(3.5, 2.8, 2.4, 1.6, LF[2]); p.px(2, 2, LF[3]); p.rect(1, 5, 6, 1, LF[0]); }), // bush
    make(6, 5, (p) => { p.rect(1, 1, 4, 3, PAL.wood[1]); p.rect(1, 1, 4, 1, PAL.wood[3]); p.px(2, 1, PAL.wood[2]); p.rect(1, 4, 4, 1, PAL.wood[0]); }), // stump
    make(7, 5, (p) => { for (let i = 0; i < 3; i++) { const x = 1 + i * 2, y = 1 + (i & 1); p.px(x, y + 2, LF[2]); p.px(x, y, FL[i % 3]); } }), // flowers
    make(5, 5, (p) => { p.rect(1, 2, 3, 1, PAL.fire[0]); p.px(2, 1, PAL.fire[0]); p.px(1, 2, PAL.cream); p.rect(2, 3, 1, 2, PAL.cream); }), // mushroom
    make(6, 4, (p) => { for (let i = 0; i < 3; i++) p.rect(1 + i * 2, 1 + (i & 1), 1, 3 - (i & 1), i & 1 ? PAL.grass[4] : PAL.grass[1]); }), // tuft
    make(7, 3, (p) => { p.rect(1, 0, 5, 3, PAL.earth[2]); p.rect(0, 1, 7, 1, PAL.earth[2]); p.px(2, 1, PAL.earth[1]); p.px(5, 1, PAL.earth[3]); }), // bare dirt spot
    make(8, 5, (p) => { p.rect(1, 0, 1, 5, PAL.wood[1]); p.rect(6, 0, 1, 5, PAL.wood[1]); p.rect(0, 1, 8, 1, PAL.wood[3]); p.rect(0, 3, 8, 1, PAL.wood[2]); }), // fence bit
    make(5, 3, (p) => { p.rect(0, 1, 2, 2, PAL.stone[2]); p.px(0, 1, PAL.stone[3]); p.rect(3, 0, 2, 2, PAL.stone[3]); p.px(4, 1, PAL.stone[1]); }), // pebbles
  ];

  // ---------- power-ups (12x12 art icons, drawn at 24) ----------
  const PU = {
    speed: { color: "#FFD23F", icon: make(12, 12, (p) => { // winged boot
      p.rect(3, 3, 3, 6, "#8A4B1E"); p.rect(3, 8, 6, 2, "#8A4B1E"); p.rect(4, 4, 1, 4, "#B36A32");
      p.rect(7, 2, 3, 1, "#FFFFFF"); p.rect(8, 3, 3, 1, "#FFFFFF"); p.rect(9, 4, 2, 1, "#FFFFFF");
    }) },
    armor: { color: "#5CB8FF", icon: make(12, 12, (p) => { // shield
      p.rect(3, 1, 6, 6, "#C9D6E2"); p.rect(2, 2, 8, 5, "#C9D6E2"); p.rect(3, 7, 6, 2, "#C9D6E2"); p.rect(4, 9, 4, 1, "#C9D6E2"); p.rect(5, 10, 2, 1, "#C9D6E2");
      p.rect(5, 2, 2, 7, "#3B78C2"); p.rect(3, 4, 6, 2, "#3B78C2");
    }) },
    frenzy: { color: "#FF5C5C", icon: make(12, 12, (p) => { // fist
      p.rect(3, 4, 6, 6, "#F1C27D"); p.rect(2, 5, 8, 4, "#F1C27D"); p.rect(3, 4, 6, 1, "#C99A5B");
      p.rect(4, 6, 1, 1, "#C99A5B"); p.rect(6, 6, 1, 1, "#C99A5B"); p.rect(8, 6, 1, 1, "#C99A5B");
      p.px(1, 3, "#FF5C5C"); p.px(10, 3, "#FF5C5C"); p.px(5, 1, "#FF5C5C"); p.px(0, 7, "#FF5C5C"); p.px(11, 7, "#FF5C5C");
    }) },
    rally: { color: "#C58CFF", icon: make(12, 12, (p) => { // horn
      p.rect(1, 6, 3, 3, "#E8D9A0"); p.rect(4, 5, 3, 5, "#D9C27A"); p.rect(7, 3, 3, 8, "#C9A857"); p.rect(10, 2, 1, 10, "#B8963E");
      p.px(2, 7, "#B8963E");
    }) },
  };

  // ---------- M6 spoils (SPEC-v2 §8, §11): relic icons per axis on a parchment tag (arms helmet, boots, horn), the ground relic scroll, chest
  // and heavy chest (closed, open), the village (48 x 40: palisade, gate, two huts; closed and joined), the bandit tent, the banner's horn.
  // Numbers (garrison, weight, have/need) and team / kind colours are drawn at runtime over these. Every one is drawn at 2x.
  const INK = PAL.ink, W8 = PAL.wood, ST = PAL.stone, PARCH = ["#B89A62", "#E6D3A0", "#F4E6BC"];
  const tag = (p) => { p.rect(1, 1, 10, 10, PARCH[1]); p.rect(1, 1, 10, 1, PARCH[2]); p.rect(1, 10, 10, 1, PARCH[0]); p.rect(10, 1, 1, 10, PARCH[0]); };
  const RELICS = {
    arms: { color: "#C9D6E2", icon: outlined(make(12, 12, (p) => { tag(p); p.rect(3, 4, 6, 4, "#8C98A6"); p.rect(4, 3, 4, 1, "#8C98A6"); p.rect(4, 4, 3, 1, "#DCE6F0"); p.rect(3, 7, 6, 1, "#5E6874"); p.px(5, 6, INK); p.px(6, 6, INK); p.rect(5, 1, 2, 2, "#D8403A"); p.px(5, 2, "#A8302C"); p.rect(3, 8, 1, 2, "#5E6874"); p.rect(8, 8, 1, 2, "#5E6874"); })) },
    boots: { color: "#E0A870", icon: outlined(make(12, 12, (p) => { tag(p); p.rect(2, 3, 3, 5, "#7A4A26"); p.rect(2, 7, 4, 2, "#7A4A26"); p.px(3, 4, "#A86A3A"); p.rect(6, 3, 3, 5, "#6A3E20"); p.rect(6, 7, 4, 2, "#6A3E20"); p.px(7, 4, "#A86A3A"); p.rect(2, 9, 4, 1, INK); p.rect(6, 9, 4, 1, INK); p.px(3, 5, "#F4E6BC"); p.px(7, 5, "#F4E6BC"); })) },
    horn: { color: "#F0D890", icon: outlined(make(12, 12, (p) => { tag(p); p.rect(2, 7, 2, 2, "#E8DCC0"); p.rect(3, 6, 2, 2, "#E8DCC0"); p.rect(4, 5, 2, 2, "#D8C8A0"); p.rect(6, 4, 2, 3, "#C8B488"); p.rect(8, 2, 2, 5, "#B89A62"); p.rect(8, 2, 2, 1, "#F6CF6A"); p.px(2, 8, "#8A6A3A"); p.rect(4, 8, 4, 1, "#7A4A26"); })) },
  };
  const scroll = outlined(make(10, 8, (p) => { p.rect(1, 2, 8, 4, PARCH[1]); p.rect(1, 2, 8, 1, PARCH[2]); p.rect(0, 1, 2, 6, PARCH[0]); p.rect(8, 1, 2, 6, PARCH[0]); p.px(0, 1, PARCH[2]); p.px(8, 1, PARCH[2]); p.rect(4, 6, 2, 1, "#A8302C"); }));
  const chestArt = (open) => outlined(make(12, 10, (p) => {
    if (open) { p.rect(1, 0, 10, 3, W8[1]); p.rect(1, 0, 10, 1, W8[2]); p.rect(1, 4, 10, 5, W8[2]); p.rect(2, 4, 8, 2, "#2A1C10"); p.px(4, 4, "#F6CF6A"); p.px(7, 5, "#F6CF6A"); p.rect(1, 8, 10, 1, W8[1]); p.rect(3, 4, 1, 5, ST[1]); p.rect(8, 4, 1, 5, ST[1]); }
    else { p.rect(1, 2, 10, 7, W8[2]); p.rect(1, 2, 10, 2, W8[3]); p.rect(1, 8, 10, 1, W8[1]); p.rect(3, 2, 1, 7, ST[1]); p.rect(8, 2, 1, 7, ST[1]); p.rect(1, 4, 10, 1, W8[1]); p.rect(5, 4, 2, 2, "#F6CF6A"); p.px(5, 5, "#C8962C"); }
  }));
  const heavyArt = (open) => outlined(make(18, 14, (p) => {
    if (open) { p.rect(1, 0, 16, 4, ST[2]); p.rect(1, 0, 16, 1, ST[3]); p.rect(1, 6, 16, 7, ST[2]); p.rect(2, 6, 14, 3, "#1E1A22"); p.px(6, 6, "#F6CF6A"); p.px(11, 7, "#F6CF6A"); p.rect(1, 12, 16, 1, ST[1]); }
    else { p.rect(1, 3, 16, 10, ST[2]); p.rect(1, 3, 16, 2, ST[3]); p.rect(1, 12, 16, 1, ST[1]); for (let x = 3; x < 16; x += 5) p.rect(x, 3, 2, 10, ST[1]); p.rect(1, 7, 16, 1, ST[1]); p.rect(7, 6, 4, 3, "#C8962C"); p.rect(8, 7, 2, 1, INK); p.rect(2, 1, 3, 2, ST[1]); p.rect(13, 1, 3, 2, ST[1]); }
  }));
  // the village: palisade stakes round the back and sides, two thatched huts, the gate front and centre (shut, or open once it joins)
  const villageArt = (joined) => withShadow(outlined(make(48, 40, (p) => {
    const TH = ["#8A6A34", "#B08A48", "#CFAE66"], WL = ["#8E7456", "#B09874"];
    for (let x = 2; x < 46; x += 3) { const h = 9 + ((x * 7) % 3); p.rect(x, 8 - h + 9, 2, h, W8[2]); p.px(x, 8 - h + 9, W8[3]); }
    for (let y = 9; y < 34; y += 3) { p.rect(1, y, 2, 3, W8[1]); p.rect(45, y, 2, 3, W8[1]); }
    p.rect(3, 11, 42, 22, PAL.earth[2]); for (let i = 0; i < 18; i++) p.px(5 + ((i * 13) % 38), 13 + ((i * 7) % 18), PAL.earth[1]);
    for (const [hx, hy] of [[7, 14], [26, 12]]) { p.rect(hx, hy + 6, 14, 8, WL[1]); p.rect(hx, hy + 13, 14, 1, WL[0]); p.rect(hx + 5, hy + 9, 3, 5, "#3A2A1C"); p.px(hx + 11, hy + 9, "#F6CF6A");
      for (let r = 0; r < 7; r++) { const w = 4 + r * 2; p.rect(hx + 7 - w / 2, hy + r, w, 1, r < 2 ? TH[2] : r < 5 ? TH[1] : TH[0]); } }
    for (let x = 2; x < 46; x += 3) if (x < 18 || x > 28) { p.rect(x, 31, 2, 7, W8[2]); p.px(x, 31, W8[3]); }
    if (joined) { p.rect(18, 36, 12, 2, PAL.earth[1]); p.rect(17, 29, 2, 9, W8[1]); p.rect(29, 29, 2, 9, W8[1]); p.rect(19, 31, 2, 6, W8[2]); p.rect(27, 31, 2, 6, W8[2]); }
    else { p.rect(18, 30, 12, 8, W8[1]); for (let x = 18; x < 30; x += 2) p.rect(x, 30, 1, 8, W8[2]); p.rect(18, 33, 12, 1, W8[0]); p.rect(17, 28, 2, 10, W8[0]); p.rect(29, 28, 2, 10, W8[0]); }
  })), 24, 38, 22, 2.4);
  const tent = withShadow(outlined(make(20, 16, (p) => {
    const C = PAL.bandit; for (let r = 0; r < 10; r++) { const w = 2 + r * 2; p.rect(10 - w / 2, 3 + r, w, 1, r < 3 ? C[2] : C[1]); } p.rect(9, 7, 2, 6, "#1E1A22"); p.rect(0, 13, 20, 1, C[0]);
    p.rect(9, 0, 1, 4, W8[1]); p.rect(15, 11, 4, 3, W8[2]); p.rect(15, 11, 4, 1, W8[3]);
  })), 10, 14, 9, 1.6);
  const bannerHorn = outlined(make(7, 5, (p) => { p.rect(0, 2, 2, 2, "#E8DCC0"); p.rect(2, 1, 2, 3, "#D8C8A0"); p.rect(4, 0, 2, 4, "#C8B488"); p.rect(4, 0, 2, 1, "#F6CF6A"); p.px(6, 1, "#B89A62"); }));
  const spoils = { relics: RELICS, scroll, chest: [chestArt(false), chestArt(true)], heavy: [heavyArt(false), heavyArt(true)], village: [villageArt(false), villageArt(true)], tent, bannerHorn };

  // ---------- the player's target flag and a loose shadow (power-ups), both 2x ----------
  const marker = outlined(make(8, 10, (p) => { const T = PAL.ramp(PAL.teams[0]); p.rect(1, 1, 1, 9, PAL.cream); p.rect(2, 1, 5, 3, T.hat); p.rect(2, 3, 5, 1, T.hatD); p.px(3, 1, T.hatL); }));
  const shadow = make(8, 3, (p) => p.ell(4, 1.5, 3.6, 1.2, PAL.shadow));

  // dropSet(set): zero a relic atlas no team uses any more and forget it (SPEC-v2 §8: the atlas rebuilds on gain, old canvases zeroed)
  function dropSet(s) { if (!s || !s.relics || SETS.get(s.key) !== s) return false; SETS.delete(s.key); s.atlas.width = 0; s.atlas.height = 0; return true; }
  return { peasantSet, dropSet, banner, sets: SETS, banners: BANNERS, paintAtlas, paintBanner, STYLES, shadow, camps, trees, rocks, PU, marker, decals, spoils, FW, FH };
};
