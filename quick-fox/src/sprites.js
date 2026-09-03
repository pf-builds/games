// Quick Fox — in-code pixel art: the fox mascot (5 distinct poses), hands, tower, heart, star. Owned.
(function () {
  const QF = (window.QF = window.QF || {});
  function make(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d");
    const p = { px: (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, 1, 1); }, rect: (x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, ww | 0, hh | 0); } };
    draw(p); return c;
  }
  const O = "#F28C28", OD = "#C96A12", W = "#FFF6E8", K = "#1E1410", E = "#FFFFFF", N = "#2B1B14", P = "#FFB6C1", Y = "#FFD75A";
  // 30x26 fox facing right. Poses: 0 idle, 1 idle bob (tail + ears up), 2 cheer (arms up, big smile), 3 sad (ears down, tail down, flat eyes), 4 zap (crouch, arm out, spark)
  function fox(pose) {
    return make(30, 26, (p) => {
      const cheer = pose === 2, sad = pose === 3, zap = pose === 4, bob = pose === 1;
      const by = zap ? 3 : 0; // crouch
      // tail
      if (sad) { p.rect(1, 19, 3, 3, W); p.rect(2, 15, 4, 5, O); p.rect(5, 14, 3, 4, O); p.rect(1, 20, 2, 2, W); }
      else { const tu = bob || cheer ? -3 : 0; p.rect(0, 12 + tu, 3, 3, W); p.rect(2, 10 + tu, 4, 5, O); p.rect(5, 12 + tu, 3, 4, O); p.rect(1, 13 + tu, 2, 2, W); }
      // body
      p.rect(7, 13 + by, 12, 8 - by, O); p.rect(9, 16 + by, 8, 5 - by, W);
      // legs
      p.rect(8, 21, 3, 3, OD); p.rect(15, 21, 3, 3, OD); p.rect(8, 24, 3, 1, K); p.rect(15, 24, 3, 1, K);
      // head
      const hy = 5 + by + (sad ? 1 : 0);
      p.rect(13, hy, 13, 10, O); p.rect(18, hy + 5, 8, 5, W);
      // ears
      if (sad) { p.rect(12, hy + 3, 3, 3, O); p.rect(24, hy + 3, 3, 3, O); p.px(13, hy + 4, P); p.px(25, hy + 4, P); }
      else { const eu = bob || cheer ? -1 : 0; p.rect(14, hy - 4 + eu, 3, 5, O); p.rect(23, hy - 4 + eu, 3, 5, O); p.px(15, hy - 4 + eu, K); p.px(24, hy - 4 + eu, K); p.px(15, hy - 2 + eu, P); p.px(24, hy - 2 + eu, P); }
      // eyes
      if (sad) { p.rect(16, hy + 3, 3, 1, K); p.rect(22, hy + 3, 3, 1, K); p.px(17, hy + 4, K); p.px(22, hy + 4, K); }
      else if (zap) { p.rect(16, hy + 3, 3, 1, K); p.rect(22, hy + 3, 3, 1, K); }
      else if (cheer) { p.px(16, hy + 3, K); p.px(18, hy + 3, K); p.px(17, hy + 2, K); p.px(22, hy + 3, K); p.px(24, hy + 3, K); p.px(23, hy + 2, K); }
      else { p.rect(16, hy + 2, 2, 2, K); p.rect(22, hy + 2, 2, 2, K); p.px(16, hy + 2, E); p.px(22, hy + 2, E); }
      // nose + mouth
      p.rect(25, hy + 5, 2, 2, N);
      if (cheer) { p.rect(20, hy + 8, 5, 2, N); p.rect(21, hy + 9, 3, 1, "#FF7A9C"); }
      if (sad) p.rect(21, hy + 8, 3, 1, N);
      // arms
      if (cheer) { p.rect(6, 5, 2, 8, O); p.rect(4, 3, 3, 3, O); p.rect(19, 4, 2, 9, O); p.rect(19, 2, 3, 3, O); }
      else if (zap) { p.rect(19, 15, 9, 2, O); p.rect(27, 14, 2, 4, O); p.px(29, 15, Y); p.px(29, 13, Y); p.px(29, 17, Y); }
      else { p.rect(11, 15 + by, 2, 4, OD); p.rect(17, 15 + by, 2, 4, OD); }
      // blush
      p.px(15, hy + 6, P); p.px(25, hy + 3, P);
      // tears
      if (sad) { p.px(18, hy + 5, "#5CD6FF"); p.px(18, hy + 6, "#5CD6FF"); }
    });
  }
  const foxes = [0, 1, 2, 3, 4].map(fox);
  const heart = make(9, 8, (p) => { const R = "#FF5C7A", D = "#B8253F"; p.rect(1, 0, 3, 1, R); p.rect(5, 0, 3, 1, R); p.rect(0, 1, 9, 3, R); p.rect(1, 4, 7, 1, R); p.rect(2, 5, 5, 1, R); p.rect(3, 6, 3, 1, R); p.px(4, 7, R); p.px(1, 1, "#FFB3C0"); p.rect(0, 3, 9, 1, D); });
  const tower = make(20, 40, (p) => { const S1 = "#6C6F72", S2 = "#8A8E92", S3 = "#4F5255"; p.rect(2, 8, 16, 32, S1); for (let y = 10; y < 40; y += 4) for (let x = 2; x < 18; x += 4) p.rect(x + ((y / 4) % 2 ? 2 : 0), y, 2, 1, S2); p.rect(0, 4, 4, 5, S1); p.rect(8, 4, 4, 5, S1); p.rect(16, 4, 4, 5, S1); p.rect(0, 8, 20, 2, S3); p.rect(8, 28, 4, 6, "#2B1B14"); p.rect(9, 30, 1, 1, Y); });
  const star = make(9, 9, (p) => { const D = "#D9A21B"; p.px(4, 0, Y); p.rect(3, 1, 3, 1, Y); p.rect(3, 2, 3, 1, Y); p.rect(0, 3, 9, 1, Y); p.rect(1, 4, 7, 1, Y); p.rect(2, 5, 5, 1, Y); p.rect(2, 6, 5, 1, Y); p.rect(1, 7, 3, 1, Y); p.rect(5, 7, 3, 1, Y); p.px(0, 8, Y); p.px(8, 8, Y); p.rect(3, 5, 3, 1, D); });
  QF.spr = { foxes, heart, tower, star };
  QF.paintFox = function (canvas, pose, scale) {
    const img = foxes[pose || 0]; const s = scale || 4;
    canvas.width = img.width * s; canvas.height = img.height * s;
    const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  QF.paintStar = function (canvas, scale, on) { const s = scale || 5; canvas.width = 9 * s; canvas.height = 9 * s; const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false; ctx.drawImage(star, 0, 0, canvas.width, canvas.height); };

  // Two pixel hands, palms toward the viewer, fingers colored by the finger map. active = finger code to light (e.g. "Li") or null.
  QF.paintHands = function (canvas, colors, active, scale) {
    const s = scale || 3, w = 64, h = 30;
    canvas.width = w * s; canvas.height = h * s;
    const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvas.width, canvas.height);
    const R = (x, y, ww, hh, col, a) => { ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = col; ctx.fillRect(x * s, y * s, ww * s, hh * s); ctx.globalAlpha = 1; };
    const skin = "#2E3548", edge = "#3A4358";
    // left hand: fingers from left = pinky, ring, middle, index; thumb at right
    const hand = (x0, mirror) => {
      const order = mirror ? ["Rp", "Rr", "Rm", "Ri"] : ["Lp", "Lr", "Lm", "Li"];
      const heights = [8, 11, 12, 10];
      R(x0 + 2, 16, 20, 13, skin); R(x0 + 2, 16, 20, 1, edge);
      for (let i = 0; i < 4; i++) {
        const fi = mirror ? 3 - i : i; const code = order[fi]; const fh = heights[fi];
        const fx = x0 + 3 + i * 5; const on = active === code; const col = colors[code] || "#888";
        R(fx, 17 - fh, 4, fh + 1, col, on ? 1 : 0.35);
        if (on) { R(fx - 1, 16 - fh, 6, 1, "#FFFFFF"); R(fx - 1, 16 - fh, 1, fh + 2, "#FFFFFF"); R(fx + 4, 16 - fh, 1, fh + 2, "#FFFFFF"); }
      }
      // thumb
      const tcode = "T"; const tx = mirror ? x0 - 3 : x0 + 23; const on = active === tcode;
      R(tx, 19, 5, 4, colors[tcode] || "#C9C4B8", on ? 1 : 0.35); R(tx + (mirror ? 2 : -1), 22, 4, 4, colors[tcode] || "#C9C4B8", on ? 1 : 0.35);
    };
    hand(4, false); hand(38, true);
  };
})();
