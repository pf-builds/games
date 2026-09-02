// Peasant Swarm — procedural pixel sprites. All original, owned by Click it! Studios.
// Everything is drawn onto tiny offscreen canvases with pixel helpers and drawn
// scaled up chunky at render time (imageSmoothing off).
window.PS = window.PS || {};

PS.buildSprites = function (cfg) {
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
  PS.shade = shade;

  // ---------- peasant (10x12, faces RIGHT) ----------
  // frames: 0 walkA, 1 walkB, 2 lunge (pitchfork thrust), 3 idle
  const SKIN = "#F1C27D", SKIN_D = "#C99A5B", HAT = "#7A4E2A", HAT_D = "#5A3719",
    LEG = "#4A3728", BOOT = "#2B1D12", SHAFT = "#9C7A46", TINE = "#D8D8D8", EYE = "#1A1210";
  function outline(c) {
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
  function peasant(tunic, frame) {
    const T = tunic, TD = shade(tunic, 0.72), TL = shade(tunic, 1.18);
    return outline(make(12, 14, (p0) => {
      // draw with a 1px margin so the outline has room
      const p = { px: (x, y, c) => p0.px(x + 1, y + 1, c), rect: (x, y, w, h, c) => p0.rect(x + 1, y + 1, w, h, c) };
      // pitchfork (vertical at rest, thrust forward on lunge)
      if (frame === 2) {
        p.rect(4, 6, 5, 1, SHAFT);
        p.px(9, 5, TINE); p.px(9, 6, TINE); p.px(9, 7, TINE); p.px(8, 5, TINE); p.px(8, 7, TINE);
      } else {
        p.rect(8, 2, 1, 8, SHAFT);
        p.px(7, 0, TINE); p.px(8, 0, TINE); p.px(9, 0, TINE); p.px(7, 1, TINE); p.px(9, 1, TINE); p.px(8, 1, TINE);
      }
      // hat
      p.rect(2, 0, 4, 1, HAT); p.rect(1, 1, 6, 1, HAT); p.px(1, 1, HAT_D); p.px(6, 1, HAT_D);
      // face
      p.rect(2, 2, 4, 2, SKIN); p.px(5, 2, EYE); p.px(2, 3, SKIN_D);
      // tunic + arms
      p.rect(1, 4, 6, 4, T); p.rect(1, 4, 1, 4, TD); p.px(3, 4, TL); p.px(4, 5, TL);
      p.rect(1, 8, 6, 1, TD); // belt
      if (frame === 2) { p.rect(6, 5, 2, 1, SKIN); p.px(0, 6, SKIN); }
      else { p.px(0, 5, SKIN); p.px(0, 6, SKIN); p.px(7, 5, SKIN); p.px(7, 6, SKIN); }
      // legs
      if (frame === 0) {
        p.rect(2, 9, 2, 2, LEG); p.rect(4, 9, 2, 2, LEG); p.rect(1, 11, 2, 1, BOOT); p.rect(5, 11, 2, 1, BOOT);
      } else if (frame === 1) {
        p.rect(2, 9, 2, 3, LEG); p.rect(5, 9, 2, 2, LEG); p.rect(2, 11, 2, 1, BOOT); p.rect(5, 11, 2, 1, BOOT);
      } else if (frame === 2) {
        p.rect(1, 9, 2, 2, LEG); p.rect(5, 9, 2, 2, LEG); p.rect(0, 11, 2, 1, BOOT); p.rect(5, 11, 3, 1, BOOT);
      } else {
        p.rect(2, 9, 2, 2, LEG); p.rect(5, 9, 2, 2, LEG); p.rect(2, 11, 2, 1, BOOT); p.rect(5, 11, 2, 1, BOOT);
      }
    }));
  }
  function silhouette(c) {
    const f = document.createElement("canvas"); f.width = c.width; f.height = c.height;
    const g = f.getContext("2d"); g.drawImage(c, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, f.width, f.height);
    return f;
  }
  function peasantSet(color) {
    const r = [0, 1, 2, 3].map((f) => peasant(color, f)), l = r.map(flip);
    return { R: r, L: l, RW: r.map(silhouette), LW: l.map(silhouette), w: 12, h: 14 };
  }

  // ---------- shadow ----------
  const shadow = make(12, 5, (p) => p.ell(6, 2.5, 5.5, 2.2, "rgba(0,0,0,.28)"));

  // ---------- grass tiles (3 variants) ----------
  const G1 = "#5B8E45", G2 = "#5A8C44", G3 = "#679B4F", G4 = "#4F7F3B", FLOWER = ["#F4E285", "#F2A2C0", "#FFFFFF", "#F7B267"];
  const tile = cfg.world.tile;
  const tiles = [0, 1, 2].map((v) =>
    make(tile, tile, (p) => {
      p.rect(0, 0, tile, tile, v === 1 ? G2 : G1);
      for (let i = 0; i < 60; i++) p.px(rnd() * tile, rnd() * tile, rnd() < 0.5 ? G3 : G4);
      for (let i = 0; i < 6; i++) { const x = rnd() * tile, y = rnd() * tile; p.px(x, y, G4); p.px(x, y - 1, G3); }
      if (v === 2) for (let i = 0; i < 4; i++) { const x = (rnd() * (tile - 2)) | 0, y = (rnd() * (tile - 2)) | 0, c = FLOWER[(rnd() * 4) | 0]; p.rect(x, y, 2, 2, c); p.px(x + 1, y + 2, G4); }
    })
  );

  // ---------- camp dirt patch ----------
  const dirt = make(64, 40, (p) => {
    p.ell(32, 20, 30, 17, "#7D6A44");
    p.ell(32, 20, 26, 14, "#8C7750");
    for (let i = 0; i < 26; i++) p.px(8 + rnd() * 48, 8 + rnd() * 24, rnd() < 0.5 ? "#7D6A44" : "#A08A5C");
    // campfire ring
    p.ell(32, 23, 6, 3, "#4A3A22"); p.rect(29, 21, 2, 1, "#3A2A16"); p.rect(34, 21, 2, 1, "#3A2A16");
    p.rect(30, 19, 5, 2, "#E5601F"); p.rect(31, 17, 3, 2, "#F2A23A"); p.rect(32, 15, 1, 2, "#FFD36B"); p.px(30, 18, "#F2A23A"); p.px(34, 18, "#F2A23A");
  });

  // ---------- trees ----------
  function tree(big) {
    const w = big ? 40 : 30, h = big ? 48 : 36, r = big ? 18 : 13;
    return make(w, h, (p) => {
      p.rect(w / 2 - 2, h - 12, 4, 12, "#5A3B1E"); p.rect(w / 2 - 1, h - 12, 1, 12, "#7A5430");
      p.ell(w / 2, r + 4, r, r * 0.9, "#2F6B2A");
      p.ell(w / 2 - 2, r + 1, r * 0.8, r * 0.7, "#3E8636");
      p.ell(w / 2 - 5, r - 3, r * 0.45, r * 0.4, "#56A44A");
      for (let i = 0; i < (big ? 14 : 8); i++) p.px(w / 2 - r + rnd() * r * 2, 4 + rnd() * r * 1.6, rnd() < 0.5 ? "#2A5E25" : "#6BB55C");
    });
  }
  const trees = [tree(false), tree(true)];

  // ---------- rocks ----------
  const rock = make(28, 20, (p) => {
    p.ell(14, 12, 12, 7, "#6C6F72"); p.ell(12, 10, 9, 5.5, "#8A8E92"); p.ell(9, 8, 4, 2.5, "#A9ADB1");
    p.px(18, 14, "#55585B"); p.px(6, 13, "#55585B"); p.px(15, 6, "#C4C8CC");
  });

  // ---------- ground decals (non-colliding dressing) ----------
  const decals = [
    make(16, 12, (p) => { p.ell(8, 8, 7, 4, "#3E7A34"); p.ell(6, 6, 5, 3.5, "#4E9440"); p.ell(10, 5, 3, 2.5, "#63AE52"); p.px(4, 9, "#2F6B2A"); p.px(11, 9, "#2F6B2A"); }), // bush
    make(12, 10, (p) => { p.ell(6, 7, 5, 2.5, "#4A3320"); p.rect(2, 3, 8, 4, "#6E4E2C"); p.ell(6, 3, 4, 2, "#9C7A46"); p.ell(6, 3, 2.5, 1.2, "#7A5A32"); }), // stump
    make(14, 10, (p) => { for (let i = 0; i < 5; i++) { const x = 1 + i * 3, y = 3 + ((i * 7) % 4); p.rect(x, y + 3, 1, 3, "#3E7A34"); p.rect(x - 1, y, 3, 2, FLOWER[i % 4]); p.px(x, y + 1, "#F7B267"); } }), // flower cluster
    make(10, 9, (p) => { p.rect(2, 5, 2, 4, "#E8D9C0"); p.rect(0, 3, 6, 2, "#C84B3A"); p.px(1, 3, "#F2EAD8"); p.px(4, 3, "#F2EAD8"); p.rect(6, 6, 2, 3, "#E8D9C0"); p.rect(5, 4, 4, 2, "#C84B3A"); p.px(7, 4, "#F2EAD8"); }), // mushrooms
    make(12, 9, (p) => { for (let i = 0; i < 6; i++) { const x = i * 2, h = 4 + ((i * 5) % 4); p.rect(x, 9 - h, 1, h, i % 2 ? "#6BA352" : "#4F8A3C"); } }), // grass tuft
    make(14, 8, (p) => { p.ell(7, 5, 6, 2.5, "#7D6A44"); p.ell(6, 4, 4, 1.5, "#8C7750"); p.px(3, 6, "#6B5A38"); p.px(10, 5, "#6B5A38"); }), // bare dirt spot
    make(16, 10, (p) => { p.rect(1, 2, 2, 8, "#8A6A3A"); p.rect(13, 2, 2, 8, "#8A6A3A"); p.rect(0, 3, 16, 2, "#A98650"); p.rect(0, 7, 16, 2, "#A98650"); p.px(1, 2, "#C9A55E"); p.px(13, 2, "#C9A55E"); }), // fence bit
  ];
  const smoke = make(4, 4, (p) => { p.rect(1, 0, 2, 4, "#C9C4B8"); p.rect(0, 1, 4, 2, "#C9C4B8"); });

  // ---------- power-ups (12x12 icons) ----------
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

  // ---------- flag marker for player target ----------
  const marker = make(10, 12, (p) => {
    p.rect(1, 0, 1, 12, "#F1EEDF"); p.rect(2, 0, 7, 5, "#38C172"); p.rect(2, 4, 7, 1, "#2A9A57");
  });

  return { peasantSet, shadow, tiles, dirt, trees, rock, PU, marker, decals, smoke };
};
