// Peasant Swarm screens (SPEC-v2 §11, R7): the code-painted valley title, the win and lose staging. Click it! Studios, 2026.
// Title: a stepped-sky dawn, four parallax ridges from periodic stepped noise (far layers bluer and lighter), a smoking village on the middle
// ridge, a bannered crowd on the near hill, two drifting fog strips. Every layer is a cached canvas at art resolution (one art pixel = u
// CSS px), painted once per size and on cache recovery, never read back; a frame is a handful of scaled blits. Win: your banner planted on
// a hill, your crowd jumping, confetti in the six team colours. Lose: one cached desaturation pass of the last frame (a "saturation" blend,
// no ctx.filter), your banner falling. All presentation: frame time, Math.random, no game state.
(function () {
  const PS = (window.PS = window.PS || {});
  PS.Screens = function (cfg) {
    const PAL = PS.PAL, L = { w: 0, h: 0, u: 0, sky: null, ridges: [], fog: null, village: null, dirty: true }, TW = 1.5; // ridge tiles are 1.5 screens wide (they wrap)
    const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    const frac = (v) => v - Math.floor(v), hash = (i, s) => frac(Math.sin(i * 127.1 + s * 311.7) * 43758.5453);
    // ridge profile: a few integer-frequency sines (periodic over the tile) stepped to 3 art px and whole pixels
    const SKY = ["#27324A", "#344565", "#4A5E7E", "#6C7C92", "#A3968A", "#D6B48A", "#EFCB8E"];
    const RIDGE = [
      { base: 0.50, amp: 0.10, col: ["#6F7F98", "#7E8DA4"], freq: [2, 3, 5] },
      { base: 0.60, amp: 0.08, col: ["#556E78", "#617C80"], freq: [3, 4, 7] },
      { base: 0.71, amp: 0.06, col: ["#3D5F4A", "#4A6E50"], freq: [2, 5, 6] },
      { base: 0.84, amp: 0.07, col: [PAL.grass[1], PAL.grass[2]], freq: [1, 3, 4] },
    ];
    function paint(w, h) {
      const u = Math.max(2, Math.round(Math.min(w, h) / 220)), aw = Math.ceil(w / u), ah = Math.ceil(h / u), tw = Math.ceil(aw * TW);
      L.w = w; L.h = h; L.u = u; L.aw = aw; L.ah = ah; L.tw = tw;
      if (!L.sky) L.sky = mk(1, 1); L.sky.width = aw; L.sky.height = ah; let g = L.sky.getContext("2d");
      for (let i = 0; i < SKY.length; i++) { g.fillStyle = SKY[i]; const y0 = Math.floor((i / SKY.length) * ah * 0.62), y1 = Math.floor(((i + 1) / SKY.length) * ah * 0.62) + 1; g.fillRect(0, y0, aw, y1 - y0); if (i > 0) for (let x = (i & 1) * 2; x < aw; x += 4) { g.fillStyle = SKY[i - 1]; g.fillRect(x, y0, 2, 1); } } // dithered band edges
      g.fillStyle = SKY[SKY.length - 1]; g.fillRect(0, Math.floor(ah * 0.62), aw, ah);
      g.fillStyle = "#FFF1C0"; g.fillRect(Math.floor(aw * 0.72), Math.floor(ah * 0.38), 7, 7); g.fillStyle = "#FFE08A"; g.fillRect(Math.floor(aw * 0.72) - 1, Math.floor(ah * 0.38) + 1, 9, 5); // the sun, square
      RIDGE.forEach((R, k) => {
        const cv = L.ridges[k] || (L.ridges[k] = mk(1, 1)); cv.width = tw; cv.height = ah; g = cv.getContext("2d"); g.clearRect(0, 0, tw, ah);
        for (let x = 0; x < tw; x += 3) {
          let v = 0; R.freq.forEach((f, i) => { v += Math.sin((2 * Math.PI * f * x) / tw + hash(i, k) * 6.28) / (i + 1); });
          const top = Math.round(ah * R.base - v * ah * R.amp * 0.6);
          g.fillStyle = R.col[0]; g.fillRect(x, top, 3, ah - top); g.fillStyle = R.col[1]; g.fillRect(x, top, 3, 1 + (hash(x, k) * 2 | 0)); // a lit crest
          if (k === 3 && hash(x, 9) < 0.12) { g.fillStyle = PAL.grass[3]; g.fillRect(x, top + 3 + (hash(x, 8) * 6 | 0), 1, 1); }
          if (k >= 1 && k <= 2 && hash(x, k + 20) < 0.22) { g.fillStyle = k === 1 ? "#4A6470" : PAL.pine[1]; g.fillRect(x + 1, top - 3, 1, 3); g.fillRect(x, top - 2, 3, 2); } // pines on the crests
        }
        if (k === 2) { // the village: palisade and three thatched huts on the middle ridge, a quarter of the way along the tile
          const vx = Math.floor(tw * 0.28), vy = Math.round(ah * R.base) - 2;
          g.fillStyle = PAL.wood[1]; for (let x = vx - 10; x < vx + 30; x += 2) g.fillRect(x, vy - 4, 1, 5);
          for (const [dx, hw] of [[0, 8], [10, 10], [22, 7]]) { g.fillStyle = PAL.earth[2]; g.fillRect(vx + dx, vy - 6, hw, 6); g.fillStyle = PAL.straw[1]; for (let r = 0; r < 4; r++) g.fillRect(vx + dx - 1 + r, vy - 7 - r, hw + 2 - 2 * r, 1); g.fillStyle = PAL.wood[0]; g.fillRect(vx + dx + (hw >> 1), vy - 3, 2, 3); }
          L.vx = vx + 12; L.vy = vy - 11; // the chimney smoke rises from here (tile coordinates)
        }
      });
      if (!L.fog) L.fog = mk(1, 1); L.fog.width = tw; L.fog.height = 12; g = L.fog.getContext("2d"); g.clearRect(0, 0, tw, 12);
      for (let x = 0; x < tw; x += 2) { const v = 0.5 + 0.5 * Math.sin((2 * Math.PI * 3 * x) / tw) * Math.sin((2 * Math.PI * 5 * x) / tw + 1); for (let y = 0; y < 12; y++) { const a = v * (1 - Math.abs(y - 6) / 6) * 0.55; if (a > 0.04) { g.fillStyle = "rgba(214,222,232," + a.toFixed(2) + ")"; g.fillRect(x, y, 2, 1); } } }
      L.dirty = false;
    }
    const smoke = []; for (let i = 0; i < 10; i++) smoke.push({ t: i / 10 });
    function title(ctx, vw, vh, dpr, t, spr, team) {
      if (L.dirty || L.w !== vw || L.h !== vh) paint(vw, vh);
      const u = L.u, tw = L.tw; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(L.sky, 0, 0, L.aw * u, L.ah * u);
      const layer = (cv, speed, yOff) => { const off = frac((t * speed) / tw) * tw; for (let k = -1; k <= 1; k++) ctx.drawImage(cv, Math.round((k * tw - off) * u), Math.round(yOff * u), tw * u, cv.height * u); };
      layer(L.ridges[0], 1.5, 0); layer(L.fog, 5, L.ah * 0.53); layer(L.ridges[1], 3, 0);
      layer(L.ridges[2], 5, 0);
      { const off = frac((t * 5) / tw) * tw; for (const s of smoke) { s.t += 0.004; if (s.t > 1) s.t -= 1; for (let k = -1; k <= 1; k++) { const x = (L.vx + k * tw - off + Math.sin(s.t * 6) * 2 + s.t * 5) * u, y = (L.vy - s.t * 18) * u; ctx.globalAlpha = 0.6 * (1 - s.t); ctx.fillStyle = "#D8D2C8"; ctx.fillRect(Math.round(x), Math.round(y), u * 2, u * 2); } } ctx.globalAlpha = 1; }
      layer(L.fog, 9, L.ah * 0.66); layer(L.ridges[3], 8, 0);
      // the bannered crowd on the near hill (the player's own atlas and banner, drawn at the ridge's art scale): standing still, the hill scrolls
      const cx = vw > vh * 1.2 ? vw * 0.18 : vw * 0.5, cy = L.ah * RIDGE[3].base * u, /* beside the menu on a wide screen */ set = team.spr, FW = spr.FW, FH = spr.FH, s = u;
      for (let i = 0; i < 17; i++) { const row = i < 7 ? 0 : i < 13 ? 1 : 2, n = row === 0 ? 7 : row === 1 ? 6 : 4, j = row === 0 ? i : row === 1 ? i - 7 : i - 13, x = cx + (j - (n - 1) / 2) * 7 * s + (row & 1) * 3 * s, y = cy - 6 * s + row * 5 * s - 4 * s, fi = ((t * 4 + i) | 0) % 2 + (i % 3 === 0 ? 4 : 0); ctx.drawImage(set.atlas, set.sx[fi], set.sy[fi], FW, FH, Math.round(x - set.axR * s), Math.round(y - set.ay * s), FW * s, FH * s); }
      const b = team.ban, fr = ((t * 1000) / cfg.art.bannerFrameMs | 0) % 3; ctx.drawImage(b.cv, fr * b.bw, 3 * b.bh, b.bw, b.bh, Math.round(cx - b.px * s), Math.round(cy - 10 * s - b.py * s), b.bw * s, b.bh * s);
    }
    // win: a hill, your banner planted on it, your crowd jumping, confetti in the six team colours (screen space, over the frozen world)
    const conf = []; let confT = 0;
    function win(ctx, vw, vh, dpr, t, dt, spr, team, colors) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
      const s = Math.max(2, Math.round(Math.min(vw, vh) / 190)), hx = vw / 2, hy = vh - Math.min(90, vh * 0.12), hw = Math.min(vw * 0.8, 520);
      ctx.fillStyle = PAL.grass[1]; for (let x = -hw / 2; x < hw / 2; x += s) { const k = 1 - (2 * x / hw) * (2 * x / hw), top = hy - k * 40; ctx.fillRect(Math.round(hx + x), Math.round(top), s, vh - top); }
      ctx.fillStyle = PAL.grass[3]; for (let x = -hw / 2; x < hw / 2; x += s) { const k = 1 - (2 * x / hw) * (2 * x / hw); ctx.fillRect(Math.round(hx + x), Math.round(hy - k * 40), s, s); }
      const set = team.spr, FW = spr.FW, FH = spr.FH, b = team.ban, fr = ((t * 1000) / cfg.art.bannerFrameMs | 0) % 3;
      ctx.drawImage(b.cv, fr * b.bw, 3 * b.bh, b.bw, b.bh, Math.round(hx - b.px * s), Math.round(hy - 40 - b.py * s + 2 * s), b.bw * s, b.bh * s);
      for (let i = 0; i < 12; i++) { const side = i < 6 ? -1 : 1, j = i % 6, x = hx + side * (22 + j * 18) * (s / 2), k = 1 - (2 * (x - hx) / hw) * (2 * (x - hx) / hw), jump = Math.max(0, Math.sin(t * 7 + i * 1.3)) * 10 * (s / 2), fi = (side < 0 ? 0 : 4) + 3;
        ctx.drawImage(set.atlas, set.sx[fi], set.sy[fi], FW, FH, Math.round(x - set.axR * s), Math.round(hy - k * 40 - set.ay * s - jump + 2 * s), FW * s, FH * s); }
      if (!conf.length) for (let i = 0; i < cfg.polish.confetti; i++) conf.push({ x: Math.random() * vw, y: -Math.random() * vh, vy: 40 + Math.random() * 70, ph: Math.random() * 6, c: colors[i % colors.length] });
      for (const p of conf) { p.y += p.vy * dt; p.ph += dt * 6; if (p.y > vh + 8) { p.y = -8; p.x = Math.random() * vw; } ctx.fillStyle = p.c; const w = Math.abs(Math.sin(p.ph)) * 3 + 1; ctx.fillRect(Math.round(p.x + Math.sin(p.ph * 0.7) * 6), Math.round(p.y), Math.round(w * s) || 1, s * 3); }
    }
    // lose: one cached desaturation pass of the frame the match ended on, then your banner falling at the bottom centre
    let grey = null;
    function loseSnap(canvas) {
      if (!grey) grey = mk(1, 1); grey.width = canvas.width; grey.height = canvas.height; const g = grey.getContext("2d");
      g.drawImage(canvas, 0, 0); g.globalCompositeOperation = "saturation"; g.fillStyle = "#808080"; g.fillRect(0, 0, grey.width, grey.height);
      g.globalCompositeOperation = "source-over"; g.fillStyle = "rgba(14,16,22,.38)"; g.fillRect(0, 0, grey.width, grey.height);
    }
    function lose(ctx, vw, vh, dpr, age, spr, team) {
      if (!grey || !grey.width) return false;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(grey, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
      const s = Math.max(2, Math.round(Math.min(vw, vh) / 190)), b = team.ban, x = vw / 2, y = vh - Math.min(70, vh * 0.1), k = Math.min(1, age / cfg.polish.bannerFall), ang = (k * k) * 1.45; // the pole topples over polish.bannerFall s
      ctx.fillStyle = PAL.earth[1]; ctx.fillRect(Math.round(x - 30 * s), Math.round(y), 60 * s, s * 2);
      ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(ang); ctx.drawImage(b.cv, 0, 3 * b.bh, b.bw, b.bh, Math.round(-b.px * s), Math.round(-b.py * s), b.bw * s, b.bh * s); ctx.restore();
      return true;
    }
    function drop() { if (grey) { grey.width = 0; grey.height = 0; } conf.length = 0; } // dropped canvases zeroed (iOS rule)
    return { title, win, lose, loseSnap, drop, dirty() { L.dirty = true; }, sky: () => (L.sky && L.sky.width > 1 ? L.sky : null), canvases() { return [L.sky, L.fog, ...L.ridges, grey].filter(Boolean); } };
  };
})();
