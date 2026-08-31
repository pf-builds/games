// Dinosaur Fight! — procedural pixel sprites. All original, owned.
// Every sprite is drawn onto a tiny offscreen canvas with pixel helpers,
// then scaled up chunky at draw time (imageSmoothing off).
window.DF = window.DF || {};

DF.buildSprites = function () {
  // deterministic rng for tile texture speckles
  let seed = 20260831;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

  function make(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const p = {
      px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, 1, 1); },
      rect(x, y, ww, hh, col) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, ww | 0, hh | 0); },
      // pixelated filled ellipse via scanlines
      ell(cx, cy, rx, ry, col) {
        ctx.fillStyle = col;
        for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
          const t = (y - cy) / ry;
          const half = rx * Math.sqrt(Math.max(0, 1 - t * t));
          ctx.fillRect(Math.round(cx - half), y, Math.max(1, Math.round(half * 2)), 1);
        }
      },
      // thick pixel line
      line(x0, y0, x1, y1, thick, col) {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1;
        for (let i = 0; i <= steps; i++) {
          const x = x0 + (x1 - x0) * (i / steps), y = y0 + (y1 - y0) * (i / steps);
          ctx.fillStyle = col;
          ctx.fillRect(Math.round(x - thick / 2), Math.round(y - thick / 2), thick, thick);
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
    const ctx = f.getContext("2d");
    ctx.translate(c.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(c, 0, 0);
    return f;
  }

  // ---------- Compy (18x18, faces RIGHT) ----------
  const C = { dk: "#1E6E2F", md: "#3AA84C", lt: "#6FD473", belly: "#EFE9B4", eye: "#101418", glint: "#FFFFFF", tongue: "#E06A6A" };
  function compyBase(p, legs, headDy = 0, lean = 0) {
    // tail (left, held up) — one connected 2px stroke into the body
    p.line(1, 7, 6, 11, 2, C.md);
    p.px(0, 6, C.md);
    // body
    p.ell(8 + lean, 12, 4.6, 3.4, C.md);
    p.ell(8 + lean, 13.2, 2.8, 1.6, C.belly);
    // back stripes
    p.px(6 + lean, 9, C.dk); p.px(8 + lean, 9, C.dk); p.px(10 + lean, 9, C.dk);
    // neck
    p.line(10 + lean, 10, 13 + lean, 5 + headDy, 2, C.md);
    // head
    p.ell(14 + lean, 3.5 + headDy, 3, 2.4, C.md);
    p.rect(15 + lean, 3 + headDy, 3, 2, C.md);         // snout
    p.px(17 + lean, 4 + headDy, C.dk);                 // nostril
    p.rect(14 + lean, 5 + headDy, 3, 1, C.dk);         // mouth line
    p.px(14 + lean, 2 + headDy, C.glint);
    p.px(15 + lean, 2 + headDy, C.eye);
    // tiny arm
    p.line(11 + lean, 12, 13 + lean, 13, 1, C.dk);
    // legs: 2px thick, 2px feet — solid silhouette
    const bx = 6 + lean, fx = 10 + lean;
    if (legs === "idle") {
      p.rect(bx, 14, 2, 3, C.dk); p.rect(fx, 14, 2, 3, C.dk);
      p.rect(bx, 16, 3, 2, C.dk); p.rect(fx, 16, 3, 2, C.dk);
    } else if (legs === "run1") {
      p.line(bx, 14, bx - 2, 16, 2, C.dk); p.rect(bx - 3, 16, 3, 2, C.dk);
      p.line(fx, 14, fx + 3, 15, 2, C.dk); p.rect(fx + 3, 15, 3, 2, C.dk);
    } else if (legs === "run2") {
      p.line(bx, 14, bx + 2, 16, 2, C.dk); p.rect(bx + 2, 16, 3, 2, C.dk);
      p.line(fx, 14, fx - 1, 16, 2, C.dk); p.rect(fx - 2, 16, 3, 2, C.dk);
    } else if (legs === "tuck") {
      p.rect(bx, 14, 2, 2, C.dk); p.rect(fx, 14, 2, 2, C.dk);
    }
  }
  const compy = {
    idle: make(18, 18, p => compyBase(p, "idle")),
    run1: make(18, 18, p => compyBase(p, "run1")),
    run2: make(18, 18, p => compyBase(p, "run2")),
    jump: make(18, 18, p => compyBase(p, "tuck", -1)),
    fall: make(18, 18, p => compyBase(p, "tuck", 1)),
    pounce: make(18, 18, p => {
      compyBase(p, "tuck", 1, 0);
      p.line(14, 6, 17, 6, 1, C.tongue);  // open-mouth lunge hint
    }),
  };

  // ---------- Baddies (12x18, face LEFT — player approaches from the left) ----------
  function baddie(p, outfit, capCol, legs, opts = {}) {
    const skin = "#E8B482", dk = "#2A2A33";
    // cap
    p.rect(3, 0, 6, 2, capCol); p.rect(2, 2, 7, 1, capCol); p.px(1, 2, capCol); // brim left
    // face
    p.rect(3, 3, 6, 3, skin);
    p.px(4, 4, dk);                                    // eye (facing left)
    // body
    p.rect(2, 6, 8, 6, outfit);
    p.rect(2, 9, 8, 1, dk);                            // belt
    p.rect(4, 6, 1, 3, shade(outfit));                 // shading
    // arms
    if (opts.rifle) {
      p.rect(0, 7, 6, 2, dk);                          // rifle barrel out left
      p.rect(1, 9, 2, 1, "#6B4A2A");                   // stock
      p.rect(5, 8, 2, 2, skin);                        // hand
    } else if (opts.net) {
      p.line(7, 8, 10, 3, 2, "#6B4A2A");               // pole up-right (over shoulder)
      p.ctx.strokeStyle = "#C8DCE8"; p.ctx.lineWidth = 1;
      p.ctx.strokeRect(8.5, 0.5, 4, 3);                // visible hoop
      p.px(10, 1, "#8FB2C8"); p.px(9, 2, "#8FB2C8"); p.px(11, 2, "#8FB2C8");
    } else {
      p.rect(2, 7, 1, 4, shade(outfit)); p.rect(9, 7, 1, 4, shade(outfit));
    }
    // legs
    if (legs === 1) { p.rect(3, 12, 2, 5, dk); p.rect(7, 12, 2, 5, dk); }
    else { p.line(4, 12, 2, 16, 2, dk); p.line(8, 12, 9, 16, 2, dk); }
    // boots
    p.rect(2, 16, 3, 1, "#4A3320"); p.rect(7, 16, 3, 1, "#4A3320");
  }
  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = c => Math.max(0, ((n >> c) & 255) - 40);
    return `rgb(${f(16)},${f(8)},${f(0)})`;
  }
  const walkerCol = "#7A8F4A", shooterCol = "#4A6E9C", netterCol = "#C77A38";
  const baddies = {
    walker1: make(12, 18, p => baddie(p, walkerCol, "#5A6B36", 1)),
    walker2: make(12, 18, p => baddie(p, walkerCol, "#5A6B36", 2)),
    shooter1: make(12, 18, p => baddie(p, shooterCol, "#35516F", 1, { rifle: true })),
    shooter2: make(12, 18, p => baddie(p, shooterCol, "#35516F", 2, { rifle: true })),
    netter1: make(12, 18, p => baddie(p, netterCol, "#8F5626", 1, { net: true })),
    netter2: make(12, 18, p => baddie(p, netterCol, "#8F5626", 2, { net: true })),
  };

  // ---------- Boss (40x54, faces LEFT) — 3x walker height, horned helmet ----------
  function boss(p, pose) {
    const uni = "#B0402F", uniDk = "#7E2C20", metal = "#6A6E78", metalDk = "#4A4E58",
          skin = "#E8B482", dk = "#22222B";
    const lean = pose === "charge" ? -3 : 0;
    // horned helmet
    p.rect(12 + lean, 0, 16, 4, metal);
    p.rect(10 + lean, 4, 20, 4, metal);
    p.rect(10 + lean, 7, 20, 1, metalDk);
    p.line(10 + lean, 4, 4 + lean, 0, 2, "#D8D2C0");   // left horn
    p.line(29 + lean, 4, 35 + lean, 0, 2, "#D8D2C0");  // right horn
    p.px(4 + lean, 0, "#F2EFE2"); p.px(35 + lean, 0, "#F2EFE2");
    // face
    p.rect(12 + lean, 8, 16, 11, skin);
    p.rect(12 + lean, 8, 2, 11, "#C89A6A");            // shade
    if (pose === "dizzy") {                             // big clean X eyes
      p.line(14, 11, 18, 15, 1, dk); p.line(18, 11, 14, 15, 1, dk);
      p.line(22, 11, 26, 15, 1, dk); p.line(26, 11, 22, 15, 1, dk);
      p.rect(16, 17, 8, 2, dk);                         // wobbly open mouth
    } else {
      p.rect(13 + lean, 10, 5, 2, dk); p.px(17 + lean, 12, dk);  // angry brows (angled in)
      p.rect(22 + lean, 10, 5, 2, dk); p.px(22 + lean, 12, dk);
      p.rect(14 + lean, 13, 3, 2, dk); p.rect(23 + lean, 13, 3, 2, dk); // eyes
      p.rect(15 + lean, 17, 10, 2, uniDk);              // frown
    }
    // body
    p.rect(6 + lean, 19, 28, 21, uni);
    p.rect(6 + lean, 19, 3, 21, uniDk);                 // shade side
    p.rect(11 + lean, 21, 18, 8, uniDk);                // chest plate
    p.rect(12 + lean, 22, 16, 2, uni);
    p.rect(6 + lean, 34, 28, 3, dk);                    // belt
    p.rect(18 + lean, 34, 4, 3, "#FFD75A");             // buckle
    // arms (big fists)
    if (pose === "charge") {
      p.rect(0, 17, 6, 12, uni); p.rect(0, 29, 6, 5, skin);
      p.rect(34, 17, 6, 12, uni); p.rect(34, 29, 6, 5, skin);
    } else {
      p.rect(1 + lean, 21, 5, 14, uni); p.rect(1 + lean, 35, 5, 5, skin);
      p.rect(34 + lean, 21, 5, 14, uni); p.rect(34 + lean, 35, 5, 5, skin);
    }
    // legs
    if (pose === "walk2") { p.rect(8, 40, 9, 11, dk); p.rect(24, 40, 9, 11, dk); }
    else { p.rect(10, 40, 9, 11, dk); p.rect(22, 40, 9, 11, dk); }
    p.rect(7, 51, 12, 3, "#4A3320"); p.rect(22, 51, 12, 3, "#4A3320");
  }
  const bossSprites = {
    boss1: make(40, 54, p => boss(p, "walk1")),
    boss2: make(40, 54, p => boss(p, "walk2")),
    bossCharge: make(40, 54, p => boss(p, "charge")),
    bossDizzy: make(40, 54, p => boss(p, "dizzy")),
  };

  // ---------- Projectiles / items ----------
  const misc = {
    bullet: make(5, 3, p => { p.rect(0, 1, 5, 1, "#FFD75A"); p.rect(3, 0, 2, 3, "#FFF2B8"); }),
    net: make(9, 9, p => {
      p.ell(4.5, 4.5, 4, 4, "rgba(207,227,240,.25)");
      for (let i = 1; i < 9; i += 2) { p.line(i, 0, i, 8, 1, "#9FB9CC"); p.line(0, i, 8, i, 1, "#9FB9CC"); }
    }),
    egg: make(9, 11, p => {
      p.ell(4.5, 6, 4, 4.6, "#8A8264");               // outline ring
      p.ell(4.5, 6, 3.2, 3.8, "#F2EFE2");
      p.ell(3.8, 4.6, 1.4, 1.6, "#FFFFFF");
      p.px(5, 7, "#7AA868"); p.px(3, 8, "#7AA868"); p.px(6, 4, "#7AA868");
    }),
    heart: make(9, 8, p => {
      p.ell(2.7, 2.5, 2.2, 2.2, "#E8484F"); p.ell(6.3, 2.5, 2.2, 2.2, "#E8484F");
      p.rect(1, 3, 7, 2, "#E8484F");
      p.line(1.5, 5, 4.5, 7.5, 2, "#E8484F"); p.line(7.5, 5, 4.5, 7.5, 2, "#E8484F");
      p.px(2, 2, "#FF9AA0");
    }),
  };

  // ---------- Tiles (16x16) ----------
  function speckle(p, base, spots, n, w = 16, h = 16) {
    p.rect(0, 0, w, h, base);
    for (let i = 0; i < n; i++) p.px(rnd() * w, rnd() * h, spots[(rnd() * spots.length) | 0]);
  }
  const tiles = {
    grass: make(16, 16, p => {
      speckle(p, "#4A2E1A", ["#3E2614", "#563620"], 14);
      p.rect(0, 0, 16, 5, "#2C6E34");
      p.rect(0, 0, 16, 2, "#3E9247");
      for (let x = 0; x < 16; x += 3) p.px(x + ((rnd() * 2) | 0), 5, "#2C6E34"); // ragged edge
      p.px(3, 1, "#57BE59"); p.px(11, 0, "#57BE59");
    }),
    dirt: make(16, 16, p => speckle(p, "#4A2E1A", ["#3E2614", "#563620", "#33200F"], 16)),
    platform: make(16, 16, p => {
      speckle(p, "#563620", ["#4A2E1A", "#644028"], 8, 16, 8);
      p.rect(0, 0, 16, 2, "#3E9247");
      p.ctx.clearRect(0, 8, 16, 8);
      p.rect(0, 6, 16, 2, "#33200F");
    }),
    tuft1: make(16, 7, p => {
      p.line(3, 6, 1, 1, 1, "#1E5228"); p.line(3, 6, 4, 0, 1, "#2C6E34"); p.line(3, 6, 6, 2, 1, "#1E5228");
      p.line(12, 6, 10, 2, 1, "#2C6E34"); p.line(12, 6, 14, 1, 1, "#1E5228");
    }),
    tuft2: make(16, 7, p => {
      p.line(8, 6, 5, 1, 1, "#1E5228"); p.line(8, 6, 8, 0, 1, "#2C6E34");
      p.line(8, 6, 11, 1, 1, "#1E5228"); p.px(3, 4, "#2C6E34"); p.px(13, 3, "#2C6E34");
    }),
    crate: make(16, 16, p => {
      p.rect(0, 0, 16, 16, "#B98A4A");
      p.rect(0, 0, 16, 1, "#D8A860"); p.rect(0, 0, 1, 16, "#D8A860");
      p.rect(0, 15, 16, 1, "#7E5A2C"); p.rect(15, 0, 1, 16, "#7E5A2C");
      p.line(2, 2, 13, 13, 1, "#8A6432"); p.line(13, 2, 2, 13, 1, "#8A6432");
      p.rect(2, 2, 2, 2, "#7E5A2C"); p.rect(12, 12, 2, 2, "#7E5A2C");
      p.rect(12, 2, 2, 2, "#7E5A2C"); p.rect(2, 12, 2, 2, "#7E5A2C");
    }),
    stone: make(16, 16, p => {
      speckle(p, "#565A58", ["#4A4E4C", "#636762"], 10);
      p.rect(0, 0, 16, 1, "#6A6E6A"); p.rect(0, 15, 16, 1, "#3A3E3C");
      p.rect(0, 7, 16, 1, "#3A3E3C"); p.rect(7, 0, 1, 8, "#3A3E3C"); p.rect(11, 8, 1, 8, "#3A3E3C");
      p.px(3, 3, "#6A6E6A"); p.px(13, 11, "#6A6E6A");
    }),
    water1: make(16, 16, p => {
      p.rect(0, 0, 16, 16, "#1C4A78");
      p.rect(0, 0, 16, 2, "#3E7EB0");
      p.px(3, 5, "#3E7EB0"); p.px(10, 8, "#2A5E90"); p.px(6, 12, "#2A5E90");
    }),
    water2: make(16, 16, p => {
      p.rect(0, 0, 16, 16, "#1C4A78");
      p.rect(0, 1, 16, 2, "#3E7EB0");
      p.px(7, 5, "#3E7EB0"); p.px(13, 9, "#2A5E90"); p.px(3, 11, "#2A5E90");
    }),
  };

  // ---------- Flag / checkpoint / decor ----------
  const structures = {
    flagClosed: make(14, 30, p => {
      p.rect(2, 0, 2, 30, "#8A8F99");
      p.rect(4, 1, 9, 7, "#5C616B");
      p.px(6, 4, "#3A3E46"); p.px(8, 4, "#3A3E46"); p.px(10, 4, "#3A3E46"); // lock dots
    }),
    flagOpen: make(14, 30, p => {
      p.rect(2, 0, 2, 30, "#C8CCD4");
      p.rect(4, 1, 9, 7, "#3E9A47");
      p.rect(4, 1, 9, 1, "#57BE59");
      p.px(7, 4, "#EFE9B4"); p.px(8, 4, "#EFE9B4");
    }),
    checkOff: make(12, 24, p => {
      p.rect(2, 0, 2, 24, "#6B4A2A");
      p.line(4, 1, 10, 3, 1, "#5C616B"); p.line(4, 6, 10, 4, 1, "#5C616B");
      p.rect(4, 2, 5, 3, "#5C616B");                   // grey pennant
    }),
    checkOn: make(12, 24, p => {
      p.rect(2, 0, 2, 24, "#6B4A2A");
      p.line(4, 1, 10, 3, 1, "#57BE59"); p.line(4, 6, 10, 4, 1, "#57BE59");
      p.rect(4, 2, 5, 3, "#57BE59");                   // green pennant
      p.px(4, 2, "#BFF0B8"); p.px(2, 0, "#BFF0B8");
    }),
    // towering jungle tree: trunk runs most of the screen height
    tree: make(44, 170, p => {
      p.rect(17, 14, 10, 156, "#3A2414");            // trunk
      p.rect(17, 14, 3, 156, "#241608");             // shade side
      p.rect(25, 14, 2, 156, "#4E301C");             // lit edge
      p.line(14, 168, 18, 150, 3, "#3A2414");        // root flare
      p.line(30, 168, 26, 150, 3, "#3A2414");
      p.line(19, 120, 8, 96, 2, "#241608");          // vine
      p.line(25, 70, 36, 44, 2, "#241608");          // branch
      p.ell(36, 40, 8, 5, "#173A20");                // leaf clusters
      p.ell(8, 92, 7, 4, "#173A20");
      p.ell(22, 12, 20, 10, "#122E1A");              // canopy mass
      p.ell(10, 8, 10, 6, "#173A20");
      p.ell(34, 9, 10, 6, "#173A20");
      p.ell(22, 4, 12, 5, "#1E4A28");
    }),
    fern: make(18, 12, p => {
      p.line(9, 11, 2, 4, 1, "#1E5228"); p.line(9, 11, 16, 4, 1, "#1E5228");
      p.line(9, 11, 9, 1, 1, "#2C6E34"); p.line(9, 11, 5, 6, 1, "#2C6E34"); p.line(9, 11, 13, 6, 1, "#2C6E34");
      p.line(9, 11, 3, 8, 1, "#173A20"); p.line(9, 11, 15, 8, 1, "#173A20");
    }),
    rock: make(12, 8, p => {
      p.ell(6, 6, 5.5, 3.5, "#5C616B");
      p.ell(4.5, 5, 3, 2, "#6E737E");
      p.px(9, 6, "#464A54");
    }),
  };

  const S = { ...misc, ...tiles, ...structures };
  // facing variants: entities store .R (right-facing) and .L
  for (const [k, v] of Object.entries(compy)) S["compy_" + k] = { R: v, L: flip(v) };
  for (const [k, v] of Object.entries(baddies)) S[k] = { L: v, R: flip(v) };   // drawn facing left
  for (const [k, v] of Object.entries(bossSprites)) S[k] = { L: v, R: flip(v) };
  return S;
};
