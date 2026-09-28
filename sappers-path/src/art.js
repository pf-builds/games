// Sapper's Path pixel art (SPEC §4). Everything is painted in code on small logical grids and scaled up with smoothing
// off, so it reads as chunky pixel art at any size. Colours come from config.art; nothing here is tuned in code.
//   tiles    16×16: courtyard ground, grass, rubble (per material), stone brick courses, timber planks, leafy hedge,
//            cracked ice, riveted iron door, moat (4 wave frames), lever (up / mid / thrown), chest (shut / open),
//            keep with a goblin flag (shut / open)
//   sprites  16×16 frames on one sheet per character: mason, axeman, goat, torchbearer (frames 0-3 walk, 4-5 work:
//            raised, struck) and the crowned goblin (0-3 walk, 4-5 taunt)
//   icons    12×12 badge icons: pickaxe, axe, goat, torch, lever (the board badges and the crew cards share them)
//   chrome   the crack overlay (X) a tile shows before it pops, and the dark brick texture behind the page (wall)
//   scenes   the title castle, the portrait battlements banner and the world-map strips, painted into logical-size
//            canvases the page scales with image-rendering: pixelated
// Every material differs by pattern as well as hue (horizontal courses, vertical planks, leaf clusters, diagonal facets,
// straps and rivets, wave dashes), so the board reads in grayscale.
(function (root, factory) {
  (root.SappersPath = root.SappersPath || {}).art = factory();
})(window, function () {
  "use strict";
  const G = 16, MATS = ["stone", "timber", "hedge", "ice", "iron"];
  const WALK = 0, WORK = 4, FRAMES = 6;

  function noise(k) { let t = (k | 0) * 0x9e3779b1; t ^= t >>> 15; t = Math.imul(t, 0x85ebca6b); t ^= t >>> 13; t = Math.imul(t, 0xc2b2ae35); t ^= t >>> 16; return (t >>> 0) / 4294967296; }
  function mk(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
  // A pixel pen over a logical canvas: r = rect, p = pixel, wr = rect wrapped horizontally (tiles that repeat).
  function pen(c) {
    const g = c.getContext("2d"), P = { c, g, w: c.width, h: c.height };
    P.r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    P.p = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    P.wr = (x, y, w, h, col) => { x = ((x % P.w) + P.w) % P.w; g.fillStyle = col; g.fillRect(x, y, w, h); if (x + w > P.w) g.fillRect(x - P.w, y, w, h); };
    return P;
  }
  // Scale a logical canvas to w × h device pixels, nearest neighbour.
  function up(src, w, h) { const c = mk(w, h), g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, c.width, c.height); return c; }
  // Outlined parts: every rect's ink halo first, then every fill, so touching parts share one outline.
  function parts(P, list, ink) { for (const q of list) P.r(q[0] - 1, q[1] - 1, q[2] + 2, q[3] + 2, ink); for (const q of list) P.r(q[0], q[1], q[2], q[3], q[4]); }
  // A character map (rows of chars keyed into pal; "." is empty), with an ink halo on its empty 4-neighbours.
  function glyph(P, rows, x0, y0, pal, ink) {
    const at = (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== ".";
    if (ink) for (let y = -1; y <= rows.length; y++) for (let x = -1; x <= rows[0].length; x++) if (!at(x, y) && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) P.p(x0 + x, y0 + y, ink);
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (at(x, y)) P.p(x0 + x, y0 + y, pal[rows[y][x]]);
  }
  function line(P, x0, y0, x1, y1, col) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) P.p(Math.round(x0 + ((x1 - x0) * i) / (n || 1)), Math.round(y0 + ((y1 - y0) * i) / (n || 1)), col); }
  function disc(P, cx, cy, r, col) { for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); P.r(cx - w, cy + y, 2 * w + 1, 1, col); } }

  // ---- tiles (16×16) -------------------------------------------------------------------------------------------------
  const TILE = {
    grass(P, A, v) {
      const [b, d, l, deep] = A.grass; P.r(0, 0, G, G, b);
      for (let i = 0; i < 12; i++) { const x = (noise(v * 41 + i) * G) | 0, y = 1 + ((noise(v * 67 + i + 9) * (G - 1)) | 0); if (i % 3 === 0) { P.p(x, y, l); P.p(x, y - 1, l); } else P.p(x, y, i % 3 === 1 ? d : deep); }
    },
    ground(P, A, v) {
      const [b, d, l, deep] = A.ground; P.r(0, 0, G, G, b);
      for (let i = 0; i < 9; i++) { const x = (noise(v * 97 + i) * 15) | 0, y = (noise(v * 131 + i + 50) * 15) | 0; if (i % 3 === 0) { P.r(x, y, 2, 1, l); P.r(x, y + 1, 2, 1, d); } else P.p(x, y, i % 2 ? d : deep); }
    },
    rubble(P, A, v, m) { // courtyard ground littered with chunks of the material that stood here
      TILE.ground(P, A, v + 2); const M = A[MATS[m]];
      for (let i = 0; i < 5; i++) { const x = 1 + ((noise(v * 11 + i + m * 7) * 12) | 0), y = 2 + ((noise(v * 17 + i + m * 5 + 40) * 11) | 0), w = i % 2 ? 2 : 3; P.r(x, y + 1, w, 1, M[3]); P.r(x, y, w, 1, i % 3 ? M[0] : M[2]); }
    },
    stone(P, A, v) { // brick courses: horizontal mortar, staggered joints, lit top edges
      const [b, d, l, deep] = A.stone; P.r(0, 0, G, G, b);
      for (let r = 0; r < 4; r++) {
        const y = r * 4, off = ((r + v) % 2) * 4 + 2; P.r(0, y, G, 1, d);
        for (let k = 0; k < 2; k++) { const x = off + k * 8; P.wr(x, y + 1, 1, 3, d); P.wr(x + 1, y + 1, 4, 1, l); P.wr(x + 4, y + 3, 3, 1, deep); }
        if (noise(v * 17 + r) > 0.55) P.wr((noise(v * 13 + r) * 16) | 0, y + 2, 1, 1, deep);
      }
    },
    timber(P, A, v) { // vertical planks: seam, lit edge, wavy grain, pegs, a knot
      const [b, d, l, deep] = A.timber; P.r(0, 0, G, G, b);
      for (let p = 0; p < 4; p++) {
        const x = p * 4; P.r(x, 0, 1, G, deep); P.r(x + 1, 0, 1, G, l);
        for (let y = 0; y < G; y++) if (noise(v * 29 + p * 16 + y) < 0.5) P.p(x + 2 + ((noise(v * 7 + p * 3 + (y >> 2)) * 2) | 0), y, d);
        P.p(x + 2, 1, deep); P.p(x + 2, 14, deep);
      }
      const kp = (noise(v + 11) * 4) | 0, ky = 4 + ((noise(v + 12) * 7) | 0); P.r(kp * 4 + 1, ky, 3, 3, d); P.p(kp * 4 + 2, ky + 1, deep);
    },
    hedge(P, A, v) { // leaf clusters over a dark base, lit clusters on top, a blossom or two
      const [b, d, l, deep, fl] = A.hedge; P.r(0, 0, G, G, d);
      for (let i = 0; i < 20; i++) {
        const x = (noise(v * 53 + i) * 16) | 0, y = (noise(v * 71 + i + 30) * 16) | 0, top = i >= 13, c = top ? l : b;
        P.wr(x - 1, y, 3, 1, c); P.wr(x, y - 1, 1, 3, c); P.wr(x + 1, y + 1, 1, 1, top ? b : deep);
      }
      for (let i = 0; i <= v; i++) P.p(2 + ((noise(v * 5 + i + 80) * 12) | 0), 2 + ((noise(v * 9 + i + 90) * 12) | 0), fl);
    },
    ice(P, A, v) { // diagonal facet glints, a jagged crack with a branch, a shaded block edge
      const [b, mid, white, deep] = A.ice; P.r(0, 0, G, G, b);
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { const s = (x + y + v * 6) % 16; if (s < 2) P.p(x, y, white); else if (s === 9 && (x + v) % 2) P.p(x, y, mid); }
      let x = 4 + ((noise(v + 3) * 7) | 0);
      for (let y = 0; y < G; y++) {
        P.p(x, y, deep); if (y === 6) for (let k = 1; k < 5; k++) P.p(Math.min(14, x + k), y + k, mid);
        if (noise(v * 19 + y) < 0.35) x = Math.max(1, Math.min(13, x + (noise(v * 23 + y) < 0.5 ? -1 : 1)));
      }
      P.r(0, G - 1, G, 1, mid); P.r(G - 1, 0, 1, G, mid); P.r(2, 2, 2, 1, white); P.p(2, 3, white);
    },
    iron(P, A) { // dark plates, two straps, rivets
      const [b, d, l, deep] = A.iron; P.r(0, 0, G, G, b);
      P.r(0, 0, G, 1, l); P.r(5, 1, 1, G - 1, d); P.r(10, 1, 1, G - 1, d);
      for (const y of [3, 11]) { P.r(0, y, G, 2, deep); for (const x of [2, 7, 12]) { P.p(x, y, l); P.p(x + 1, y, d); P.p(x, y + 1, d); } }
    },
    moat(P, A, v, f) { // water with wave dashes that drift one step per frame
      const [b, d, l, deep] = A.moat; P.r(0, 0, G, G, b);
      for (let i = 0; i < 6; i++) P.wr(((noise(v * 3 + i) * 16) | 0) + f, 1 + ((noise(v * 5 + i + 7) * 14) | 0), 2, 1, d);
      for (const [y, o] of [[2, 0], [7, 6], [12, 11]]) for (let k = 0; k < 2; k++) { const x = o + k * 8 + f * 2 + v * 3; P.wr(x, y, 3, 1, l); P.wr(x + 1, y + 1, 3, 1, deep); }
    },
    lever(P, A, v, f) { // a lever set in a stone plate: 0 up (red knob), 1 mid swing, 2 thrown (gold knob)
      TILE.stone(P, A, 1); const [knob, gold, slot] = A.lever, ink = A.ink;
      P.r(3, 10, 10, 4, ink); P.r(4, 11, 8, 2, slot);
      const tip = [[4, 3], [8, 2], [12, 3]][f];
      line(P, 8, 11, tip[0], tip[1] + 1, ink); line(P, 7, 11, tip[0] - 1, tip[1] + 1, ink);
      P.r(tip[0] - 2, tip[1] - 1, 4, 4, ink); P.r(tip[0] - 1, tip[1], 2, 2, f === 2 ? gold : knob); P.p(tip[0] - 1, tip[1], "#ffffff");
    },
    chest(P, A, v, open) {
      TILE.ground(P, A, 5); const [wood, dark, gold, goldD] = A.chest, ink = A.ink;
      P.r(2, 14, 12, 1, A.ground[3]);
      if (open) { P.r(2, 1, 12, 7, ink); P.r(3, 2, 10, 5, dark); P.r(3, 6, 10, 1, goldD); }
      P.r(2, 7, 12, 7, ink); P.r(3, 8, 10, 5, wood); P.r(3, 12, 10, 1, dark);
      if (open) { P.r(3, 8, 10, 2, gold); P.p(5, 8, "#ffffff"); P.p(10, 9, "#ffffff"); P.r(3, 10, 10, 1, goldD); }
      else { P.r(2, 5, 12, 3, ink); P.r(3, 6, 10, 2, dark); P.r(3, 10, 10, 1, gold); P.r(7, 8, 2, 4, gold); P.p(7, 10, ink); }
    },
    keep(P, A, v, open) { // the goblins' keep: crenellated tower, portcullis, green goblin flag
      TILE.ground(P, A, 3); const [b, d, l, deep] = A.keep, [fg, fd, fe] = A.flag, ink = A.ink;
      parts(P, [[3, 6, 10, 9, b], [3, 4, 2, 2, b], [7, 4, 2, 2, b], [11, 4, 2, 2, b]], ink);
      P.r(3, 6, 1, 9, l); P.r(4, 9, 9, 1, d); P.r(8, 6, 1, 3, d); P.r(5, 12, 1, 3, d); P.r(10, 12, 1, 3, d);
      P.p(5, 7, ink); P.p(11, 7, ink);
      P.r(6, 11, 4, 4, open ? ink : deep); P.r(7, 10, 2, 1, open ? ink : deep);
      if (open) P.r(6, 11, 4, 1, d); else { P.r(7, 11, 1, 4, d); P.r(9, 11, 1, 4, d); P.r(6, 13, 4, 1, d); }
      P.r(8, 0, 1, 4, ink); P.r(9, 0, 4, 3, fg); P.r(9, 2, 4, 1, fd); P.p(10, 1, fe); P.p(12, 1, fe);
    },
  };

  // ---- characters (16×16 frames, facing right) ------------------------------------------------------------------------
  const TOOL = {
    pickUp: ["mmmmm", "m.w.m", "..w..", "..w..", "..w..", "..w.."], // anchor (2, 5) in the hand
    pickDown: ["....m", "....m", "wwwwm", "....m", "....M"],          // anchor (0, 2)
    axeUp: [".mm", "wmm", "wmM", "w..", "w..", "w.."],               // anchor (0, 5)
    axeDown: ["wwwwm", "...mm", "...mM"],                            // anchor (0, 0)
    torchUp: [".y.", "yfy", "fFf", ".F.", ".w.", ".w.", ".w."],      // anchor (1, 6)
    torchFwd: ["....y.", "wwwFfy", "....y."],                        // anchor (0, 1)
  };
  // A crew member or the goblin. who: 0 mason, 1 axeman, 3 torchbearer, 4 goblin. frame: 0-3 walk, 4-5 work (goblin: taunt).
  function person(P, A, who, frame) {
    const gob = who === 4, ink = A.ink, C = gob ? null : A.crew[who], Gb = A.goblin, work = frame >= WORK, f = work ? frame - WORK : frame;
    const bob = !work && f % 2 ? 1 : gob && work && f ? -1 : 0, top = (gob ? 5 : 3) + bob;
    const skin = gob ? Gb[0] : A.skin[0], tunic = gob ? Gb[2] : C[0], tunicD = gob ? Gb[3] : C[1], boot = A.wood[1];
    const legs = work ? [[5, 12], [9, 12]] : f % 2 ? [[6, 12], [8, 12]] : [[5, 12], [9, 12]];
    const list = [[legs[0][0], 12, 2, 3, f === 2 && !work ? tunicD : A.wood[0]], [legs[1][0], 12, 2, 3, A.wood[0]],
      [6, top + 4, 4, 12 - (top + 4), tunic], [6, top, 4, 4, skin]];
    if (gob) list.push([4, top + 1, 2, 1, skin], [10, top + 1, 2, 1, skin], [6, top - 2, 4, 2, Gb[4]]);
    else if (who === 0) list.push([5, top - 1, 6, 2, A.metal[0]]);
    else list.push([6, top - 1, 4, 1, C[1]]);
    // front arm: down (walk), raised (work 0 / taunt 0), forward (work 1), fist high (taunt 1)
    const arm = gob && work ? [10, top - 1 - f, 2, 3] : work && f === 0 ? [9, top + 1, 2, 3] : work ? [10, top + 5, 3, 2] : [9, top + 5, 2, 2];
    list.push([arm[0], arm[1], arm[2], arm[3], skin]);
    parts(P, list, ink);
    P.r(legs[0][0], 14, 2, 1, boot); P.r(legs[1][0], 14, 2, 1, boot);
    P.r(6, 11, 4, 1, tunicD); P.r(6, top + 4, 1, 12 - (top + 4), tunicD);
    if (gob) { P.p(8, top + 1, Gb[5]); P.p(9, top + 1, ink); P.r(7, top + 3, 3, 1, Gb[1]); P.p(6, top - 3, Gb[4]); P.p(8, top - 3, Gb[4]); P.p(9, top - 3, Gb[4]); P.p(7, top - 2, Gb[5]); }
    else {
      P.p(9, top + 1, ink); P.p(8, top + 3, A.skin[1]);
      if (who === 0) P.r(5, top, 6, 1, A.metal[1]);
      if (who === 1) { P.r(7, top + 3, 3, 1, A.wood[0]); P.p(9, top + 2, A.wood[0]); }
    }
    if (gob) return;
    const pal = { w: A.wood[0], m: A.metal[0], M: A.metal[1], f: A.flame[1], F: A.flame[0], y: A.flame[f % 2 ? 2 : 0] };
    const hx = arm[0] + (work && f === 1 ? 2 : 1), hy = work && f === 0 ? top + 1 : top + 6;
    if (who === 0) work && f === 1 ? glyph(P, TOOL.pickDown, hx, hy - 2, pal, ink) : glyph(P, TOOL.pickUp, hx - 2, hy - 5 - (work ? 1 : 0), pal, ink);
    if (who === 1) work && f === 1 ? glyph(P, TOOL.axeDown, hx, hy, pal, ink) : glyph(P, TOOL.axeUp, hx, hy - 5 - (work ? 1 : 0), pal, ink);
    if (who === 3) work && f === 1 ? glyph(P, TOOL.torchFwd, hx, hy - 1, pal, ink) : glyph(P, TOOL.torchUp, hx - 1, hy - 6, pal, ink);
  }
  // The goat: walk cycle, then head down to eat (work 0) and chew (work 1).
  function goat(P, A, frame) {
    const [w, d, h] = A.crew[2], ink = A.ink, work = frame >= WORK, f = work ? frame - WORK : frame, bob = !work && f % 2 ? 1 : 0;
    const lx = work ? [4, 6, 9, 11] : [[3, 6, 9, 11], [4, 5, 10, 11], [4, 7, 8, 12], [4, 5, 10, 11]][f];
    const head = work ? [11, 8 + f, 4, 3] : [11, 4 + bob, 3, 4];
    const list = [[3, 7 + bob, 9, 4, w], [2, 6 + bob, 1, 2, w], [head[0], head[1], head[2], head[3], w]];
    for (const x of lx) list.push([x, 11, 1, 3, d]);
    parts(P, list, ink);
    P.r(3, 10 + bob, 9, 1, d); P.r(4, 7 + bob, 6, 1, "#ffffff");
    for (const x of lx) P.p(x, 13, ink);
    const hx = head[0], hy = head[1];
    P.p(hx - 1, hy + 1, d); P.p(hx + 1, hy + 1, ink);
    P.p(hx, hy - 1, h); P.p(hx - 1, hy - 2, h); P.p(hx - 2, hy - 2, h);
    P.r(hx + 1, hy + head[3], 1, 2, d);
  }
  function sheet(A, who) { const c = mk(G * FRAMES, G), P = pen(c); for (let f = 0; f < FRAMES; f++) { P.g.save(); P.g.translate(f * G, 0); who === 2 ? goat(P, A, f) : person(P, A, who, f); P.g.restore(); } return c; }

  // ---- badge icons (12×12) -------------------------------------------------------------------------------------------
  // Pickaxe (M2 fix): a thick crescent head hugging the top-right corner on a diagonal handle, so it can't read as a
  // "T". Axe: a double-bit axe, two filled wedge blades flaring out from an upright handle.
  const ICONS = [
    ["..###.......", ".#######....", "#########...", "...#######..", "......#####.", "......#####.", ".....##.####", "....##...###", "...##....###", "..##.....###", ".##......###", "##........#."],
    [".....##.....", ".##..##..##.", "####.##.####", "############", "############", "############", "####.##.####", ".##..##..##.", ".....##.....", ".....##.....", ".....##.....", "....####...."],
    ["##........##", ".##......##.", "..##....##..", "...######...", "####.##.####", "...######...", "....####....", "....####....", "....####....", ".....##.....", ".....##.....", "............"],
    ["......#.....", ".....##.....", ".....###....", "....####....", "....#####...", "....#####...", ".....###....", "............", "...######...", "....####....", ".....##.....", ".....##....."],
    ["........###.", "........###.", ".......##...", "......##....", ".....##.....", "....##......", "...##.......", "..####......", ".########...", ".########...", "............", "............"],
  ];
  const iconCache = new Map();
  function iconSrc(m, ink) { const k = m + ink; let c = iconCache.get(k); if (!c) { c = mk(12, 12); glyph(pen(c), ICONS[m], 0, 0, { "#": ink }); iconCache.set(k, c); } return c; }
  // Draw icon m (0-3 crews, 4 iron) centred at (cx, cy) in a (2r)² box, into any 2D context.
  function icon(g, m, cx, cy, r, ink) { const s = iconSrc(m, ink), was = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false; g.drawImage(s, Math.round(cx - r), Math.round(cy - r), Math.round(2 * r), Math.round(2 * r)); g.imageSmoothingEnabled = was; }

  // Every logical source, keyed: g0 g1 ground, q0 q1 grass, r{m}{v} rubble, m{m}{v} materials, ~{f}{v} moat frames,
  // L0-L2 lever frames, C Co chest, K Ko keep, s0-s3 crew sheets, s4 goblin sheet.
  function sources(A) {
    const S = {}, t = (key, fn) => { const c = mk(G, G); fn(pen(c)); S[key] = c; };
    for (let v = 0; v < 2; v++) {
      t("g" + v, (P) => TILE.ground(P, A, v)); t("q" + v, (P) => TILE.grass(P, A, v));
      for (let m = 0; m < 5; m++) { t("m" + m + v, (P) => TILE[MATS[m]](P, A, v)); t("r" + m + v, (P) => TILE.rubble(P, A, v, m)); }
      for (let f = 0; f < 4; f++) t("~" + f + v, (P) => TILE.moat(P, A, v, f));
    }
    for (let f = 0; f < 3; f++) t("L" + f, (P) => TILE.lever(P, A, 0, f));
    t("C", (P) => TILE.chest(P, A, 0, false)); t("Co", (P) => TILE.chest(P, A, 0, true));
    t("K", (P) => TILE.keep(P, A, 0, false)); t("Ko", (P) => TILE.keep(P, A, 0, true));
    t("X", (P) => crack(P, A));
    for (const who of [0, 1, 2, 3, 4]) S["s" + who] = sheet(A, who);
    return S;
  }
  // The crack overlay a tile shows just before it pops (transparent but for the ink cracks and pale chips).
  function crack(P, A) {
    const ink = A.ink;
    line(P, 8, 0, 6, 5, ink); line(P, 6, 5, 9, 9, ink); line(P, 9, 9, 7, 15, ink); line(P, 6, 5, 1, 7, ink); line(P, 9, 9, 15, 11, ink); line(P, 9, 9, 13, 3, ink);
    P.p(7, 4, "#ffffff"); P.p(10, 8, "#ffffff"); P.p(2, 6, "#ffffff"); P.p(12, 4, "#ffffff");
  }
  // The dark castle-wall texture behind the page chrome: two staggered brick courses, 32 × 16 logical, repeating.
  function wall(A) {
    const c = mk(32, 16), P = pen(c), [b, mortar, l, deep] = A.wall; P.r(0, 0, 32, 16, b);
    for (let r = 0; r < 2; r++) {
      const y = r * 8; P.r(0, y, 32, 1, mortar);
      for (let k = 0; k < 2; k++) { const x = (r * 8 + k * 16) % 32; P.wr(x, y + 1, 1, 7, mortar); P.wr(x + 1, y + 1, 6, 1, l); P.wr(x + 9, y + 6, 5, 1, deep); }
      P.p((r * 13 + 5) % 32, y + 4, deep); P.p((r * 7 + 21) % 32, y + 3, l);
    }
    return c;
  }
  // A logical point inside frame 0 of each sheet that is always opaque (the torso), for the cache-health checks.
  const SHEET_PROBE = [[7, 9], [7, 9], [6, 8], [7, 9], [7, 10]];

  // ---- scenes (logical canvases; the page scales them with image-rendering: pixelated) ---------------------------------
  function sky(P, A, hFrac, night) {
    const cols = night ? A.night : A.sky, n = cols.length, bh = Math.max(2, Math.ceil((P.h * hFrac) / n));
    P.r(0, 0, P.w, P.h, cols[n - 1]);
    for (let i = 0; i < n; i++) { P.r(0, i * bh, P.w, bh, cols[i]); if (i) for (let x = i % 2; x < P.w; x += 2) P.p(x, i * bh, cols[i - 1]); }
  }
  function cloud(P, A, x, y) { P.r(x + 3, y, 8, 3, A.cloud); P.r(x, y + 2, 16, 3, A.cloud); P.r(x + 1, y + 5, 13, 1, A.sky[2]); }
  function bricks(P, A, x, y, w, h, pal) {
    const [b, d, l, deep] = pal || A.stone; P.r(x, y, w, h, b);
    for (let r = 0; r * 4 < h; r++) { const yy = y + r * 4; P.r(x, yy, w, 1, d); for (let k = (r % 2) * 4; k < w; k += 8) { P.r(x + k, yy + 1, 1, Math.min(3, y + h - yy - 1), d); P.r(x + k + 1, yy + 1, Math.min(4, w - k - 1), 1, l); if (k + 7 < w) P.r(x + k + 4, yy + 3, 3, 1, deep); } }
  }
  function merlons(P, A, x, y, w, pal) { const [b, d, l] = pal || A.stone; for (let k = 0; k + 4 <= w; k += 7) { P.r(x + k - 1, y - 1, 6, 6, A.ink); P.r(x + k, y, 4, 5, b); P.r(x + k, y, 4, 1, l); P.r(x + k + 3, y + 1, 1, 4, d); } }
  function sprite(P, S, who, frame, x, y, flip) { const g = P.g; g.save(); if (flip) { g.translate(x + G, y); g.scale(-1, 1); g.drawImage(S["s" + who], frame * G, 0, G, G, 0, 0, G, G); } else g.drawImage(S["s" + who], frame * G, 0, G, G, x, y, G, G); g.restore(); }
  function tiles(P, src, x, y, w, h) { for (let yy = y; yy < y + h; yy += G) for (let xx = x; xx < x + w; xx += G) P.g.drawImage(src, xx, yy); }

  // Title: sky, hills, the goblins' castle (stone curtain, towers, a keep with a timber gate and a goblin flag), a hedge,
  // an iced moat, and the four crews on the green in front. f: the taunting goblin's frame (0/1).
  // baseFrac: where the castle's foot sits (a fraction of the height), so a tall full-screen canvas keeps the castle in
  // the middle with sky above for the logo and green below.
  function title(c, A, S, f, baseFrac) {
    const P = pen(c), W = P.w, H = P.h, base = Math.max(96, Math.min(H - 30, Math.round(H * (baseFrac || 1) - (baseFrac ? 0 : 30))));
    P.g.imageSmoothingEnabled = false;
    sky(P, A, Math.min(1, (base - 24) / H), false);
    disc(P, W - 24, 18, 8, A.sun); cloud(P, A, 14, 14); cloud(P, A, W * 0.52, 8);
    for (let x = 0; x < W; x++) { const h1 = base - 30 + Math.round(5 * Math.sin(x / 13) + 3 * Math.sin(x / 5.3)); P.r(x, h1, 1, H - h1, A.hills[1]); const h2 = base - 18 + Math.round(4 * Math.sin(x / 9 + 2)); P.r(x, h2, 1, H - h2, A.hills[0]); }
    const cx = W >> 1;
    bricks(P, A, cx - 58, base - 26, 116, 26); merlons(P, A, cx - 58, base - 31, 116);
    for (const tx of [cx - 70, cx + 50]) { P.r(tx - 1, base - 45, 22, 45, A.ink); bricks(P, A, tx, base - 44, 20, 44); merlons(P, A, tx, base - 49, 20); P.r(tx + 9, base - 34, 2, 6, A.ink); }
    P.r(cx - 19, base - 63, 38, 63, A.ink); bricks(P, A, cx - 18, base - 62, 36, 62, A.keep); merlons(P, A, cx - 18, base - 67, 36, A.keep);
    P.r(cx - 3, base - 50, 2, 7, A.ink); P.r(cx + 3, base - 50, 2, 7, A.ink);
    P.r(cx - 9, base - 22, 18, 22, A.ink); tiles(P, S.m10, cx - 8, base - 21, 16, 21); P.r(cx - 8, base - 21, 16, 1, A.timber[3]);
    P.r(cx + 12, base - 86, 1, 20, A.ink); P.r(cx + 13, base - 86, 11, 7, A.flag[0]); P.r(cx + 13, base - 80, 11, 1, A.flag[1]); P.p(cx + 16, base - 84, A.flag[2]); P.p(cx + 20, base - 84, A.flag[2]);
    sprite(P, S, 4, WORK + (f & 1), cx - 8, base - 82, false);
    for (let x = 0; x < W; x += G) { P.g.drawImage(S.m21, x, base - 10, G, 10); }
    P.r(0, base, W, 9, A.moat[0]); for (let x = (f & 1) * 2; x < W; x += 9) P.r(x, base + 3, 3, 1, A.moat[2]);
    for (let k = 0; k < 3; k++) { const ix = 10 + k * ((W - 30) / 3) + ((noise(k + 5) * 12) | 0); P.r(ix, base + 1, 14, 7, A.ink); P.r(ix + 1, base + 2, 12, 5, A.ice[0]); P.r(ix + 2, base + 2, 5, 1, A.ice[2]); }
    tiles(P, S.q0, 0, base + 9, W, H - base - 9);
    const gap = Math.min(W, 170) / 5, x0 = (W - Math.min(W, 170)) / 2, cy = Math.min(H - 19, base + 13);
    for (let i = 0; i < 4; i++) sprite(P, S, i, i === 1 ? WORK : 0, Math.round(x0 + gap * (i + 1) - 8), cy, i >= 2);
  }

  // Portrait banner above the board: sky (night in World 4), a crenellated wall along the bottom, a torch, and the
  // crowned goblin on the battlements, taunting (f 0/1).
  function banner(c, A, S, world, f) {
    const P = pen(c), W = P.w, H = P.h, night = world >= 4, pal = world === 4 ? A.keep : A.stone;
    P.g.imageSmoothingEnabled = false;
    sky(P, A, 1, night);
    if (night) { disc(P, W - 14, Math.min(26, Math.round(H * 0.4)), 5, A.sun); for (let i = 0; i < 14; i++) P.p((noise(i + 3) * W) | 0, (noise(i + 9) * (H - 16)) | 0, "#ffffff"); }
    else { cloud(P, A, 8, 5); if (W > 90) cloud(P, A, W - 44, 10); }
    if (world === 3) for (let i = 0; i < 20; i++) P.p((noise(i * 7 + f) * W) | 0, (noise(i * 11 + 3) * (H - 14)) | 0, "#ffffff");
    const wallY = H - 10, far = night ? A.night[2] : A.hills[1];
    // a distant goblin tower on the skyline, flag and all
    const fx = Math.round(W * 0.1), fy = wallY - 26; P.r(fx, fy, 12, 26, far); for (let k = 0; k < 3; k++) P.r(fx + k * 5 - 1, fy - 3, 3, 3, far);
    P.r(fx + 5, fy - 11, 1, 8, far); P.r(fx + 6, fy - 11, 5, 3, A.flag[0]);
    for (let x = 0; x < W; x++) { const hh = wallY - 8 + Math.round(3 * Math.sin(x / 7)); P.r(x, hh, 1, H - hh, world === 2 ? A.hedge[1] : A.hills[1]); }
    bricks(P, A, 0, wallY, W, 10, pal); merlons(P, A, 2, wallY - 5, W - 2, pal);
    if (world === 3) for (let k = 2; k + 4 <= W; k += 7) P.r(k, wallY - 5, 4, 1, "#ffffff");
    const tx = Math.round(W * 0.2); P.r(tx, wallY - 9, 1, 5, A.wood[1]); P.r(tx - 1, wallY - 12 + (f & 1), 3, 3, A.flame[1]); P.p(tx, wallY - 12 + (f & 1), A.flame[0]);
    sprite(P, S, 4, WORK + (f & 1), Math.round(W * 0.72) - 8, wallY - 21, true);
  }

  // A world-map strip: the world's ground tiled, a border of its materials, the trail between the level nodes (pts, in
  // logical px), and a grey wash when the world is locked.
  function worldStrip(c, A, S, world, pts, locked) {
    const P = pen(c), W = P.w, H = P.h;
    P.g.imageSmoothingEnabled = false;
    const floor = world === 3 ? S.m31 : world === 4 ? S.g1 : S.q0;
    tiles(P, floor, 0, 0, W, H);
    if (world === 3) { P.g.globalAlpha = 0.55; P.r(0, 0, W, H, "#ffffff"); P.g.globalAlpha = 1; }
    if (world === 4) { P.g.globalAlpha = 0.45; P.r(0, 0, W, H, A.keep[3]); P.g.globalAlpha = 1; }
    const border = [[S.m00, S.m10], [S.m20, S.m21], [S["~00"], S.m30], [S.m40, S.m01]][world - 1];
    for (let x = 0, k = 0; x < W; x += G, k++) { P.g.drawImage(border[k % 2], x, 0); P.g.drawImage(border[(k + 1) % 2], x, H - G); }
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k += 4) { const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n); P.r(x - 1, y, 3, 2, A.ink); P.r(x - 1, y - 1, 2, 2, A.trail); }
    }
    if (locked) { P.g.globalAlpha = 0.55; P.r(0, 0, W, H, A.ink); P.g.globalAlpha = 1; }
  }

  // ---- v2 board picture (SPEC-v2 §4 "The castle is the picture") ------------------------------------------------------
  // The board is painted as ONE pixel picture at bp logical px per block (config.art.blockPx), one block of field all
  // round. Every material is a texture in world coordinates (brick courses, planks, leaves, ice facets, iron plates,
  // water, grass, flagstones), so a region's texture runs unbroken across its blocks; each region gets an ink outline and
  // a bevel (lit top-left, shaded bottom-right), walls cast a short shadow on the ground south and east of them, and
  // ground the camp can't reach yet sits in shade. Painted into a Uint32Array (RGBA bytes, little-endian) and put once;
  // the renderer scales the logical canvas up with smoothing off. textures() once per level, compose() per state.
  function u32(hex) { const v = parseInt(hex.slice(1), 16); return (0xff000000 | ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255)) >>> 0; }
  function mix(c, k, to) { // k 0..1 toward to (0 black, 255 white), on each channel
    const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255, f = 1 - k, t = to * k;
    return (0xff000000 | (((b * f + t) | 0) << 16) | (((g * f + t) | 0) << 8) | ((r * f + t) | 0)) >>> 0;
  }
  function h2(x, y, s) { return noise(Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(s | 0, 83492791)); }
  const TEX = { // world-coordinate texture functions: (X, Y, palette as u32) → u32
    field(X, Y, p) { const n = h2(X, Y, 1); return n < 0.05 ? p[3] : n < 0.15 ? p[1] : n > 0.93 ? p[2] : h2(X >> 2, Y >> 2, 2) < 0.22 && n < 0.4 ? p[1] : p[0]; },
    yard(X, Y, p) { // packed earth: soft patches and pebbles (a lit top, a dark foot), nothing on a grid, so it never reads as a wall
      const n = h2(X, Y, 3), pb = h2(X >> 1, Y >> 1, 14);
      if (pb > 0.965) return (Y & 1) ? p[3] : p[2];
      return n < 0.05 ? p[3] : n < 0.16 || h2(X >> 3, Y >> 2, 15) < 0.18 && n < 0.5 ? p[1] : p[0];
    },
    stone(X, Y, p) { // brick courses 4 px, bricks 8 px, staggered half a brick: mortar, lit top edge, dark foot
      const row = Y >> 2, yy = Y & 3, xx = (X + (row & 1) * 4) & 7;
      if (yy === 0 || xx === 0) return p[1];
      if (yy === 1 && xx <= 5) return p[2];
      if (yy === 3 && xx >= 4) return p[3];
      return h2(X, Y, 4) < 0.06 ? p[1] : p[0];
    },
    timber(X, Y, p) { // upright planks 4 px: seam, lit edge, grain dashes, staggered plank ends with a peg
      const col = X >> 2, xx = X & 3, e = (Y + ((h2(col, 0, 5) * 16) | 0)) % 14;
      if (xx === 0) return p[3];
      if (e === 0) return p[3];
      if (xx === 1) return e === 1 ? p[0] : p[2];
      if (e === 2 && xx === 2) return p[3];
      return h2(X, Y >> 1, 6) < 0.3 ? p[1] : p[0];
    },
    hedge(X, Y, p) { // leaf clumps (2 px mottle), lit tops, a rare blossom
      if (h2(X, Y, 7) > 0.988) return p[4];
      const n = h2((X + (Y >> 1 & 1)) >> 1, Y >> 1, 8);
      return n < 0.2 ? p[3] : n < 0.47 ? p[1] : n < 0.83 ? p[0] : p[2];
    },
    ice(X, Y, p) { // diagonal glints, criss-cross cracks, frost speckle
      const a = (X + Y) % 11, b = (X - Y + 4400) % 17;
      if (a === 0 && h2((X + Y) / 11 | 0, (X - Y) >> 3, 9) < 0.7) return p[2];
      if (b === 0 && h2((X - Y) / 17 | 0, (X + Y) >> 2, 10) < 0.55) return p[3];
      if (a === 1 && h2((X + Y) / 11 | 0, (X - Y) >> 3, 9) < 0.7) return p[1];
      return h2(X, Y, 11) < 0.05 ? p[1] : p[0];
    },
    iron(X, Y, p) { // one plate per block: lit top, dark seams, a strap with rivets
      const xx = X & 7, yy = Y & 7;
      if (xx === 7 || yy === 7) return p[3];
      if (yy === 0) return p[2];
      if (yy === 3 || yy === 4) return (xx === 1 || xx === 5) && yy === 3 ? p[2] : p[1];
      return p[0];
    },
    moat(X, Y, p, f) { // water with drifting wave dashes (f: the wave frame)
      const yy = Y & 3, w = (X + f * 2 + (Y >> 2) * 5 + ((h2(Y >> 2, (X + f * 2) >> 4, 12) * 6) | 0)) % 10;
      if (yy === 1 && w < 3) return p[2];
      if (yy === 2 && w >= 1 && w < 4) return p[3];
      return h2(X, Y, 13) < 0.06 ? p[1] : p[0];
    },
  };
  // Tiny sprites painted on single blocks (8×8 logical): k ink, and palette letters per sprite.
  const SPR = {
    tent: ["...kk...", "..kRCk..", ".kRCCRk.", ".kRCCRk.", "kRCRRCRk", "kRCkkCRk", "kRCkkCRk", "kkkkkkkk"],
    chest: ["........", ".kkkkkk.", ".kddddk.", ".kggggk.", ".kwwgwk.", ".kwwwwk.", ".kkkkkk.", "........"],
    chestO: [".kkkkkk.", ".kddddk.", ".kGGGGk.", ".kgGgGk.", ".kwwwwk.", ".kwwwwk.", ".kkkkkk.", "........"],
    lever: ["......kk", ".....kRk", "....kwk.", "...kwk..", "..kwk...", ".kkkkkk.", ".kSSSSk.", "........"],
    leverT: ["kk......", "kGk.....", ".kwk....", "..kwk...", "...kwk..", ".kkkkkk.", ".kSSSSk.", "........"],
  };
  // Per-level textures: one Uint32Array per kind, the full picture size, world-aligned. Also the moat's wave frames.
  function textures(A, B, bp) {
    const PW = (B.w + 2) * bp, PH = (B.h + 2) * bp, N = PW * PH, P = (k) => A[k].map(u32), T = { bp, PW, PH };
    const one = (fn, pal, f) => { const a = new Uint32Array(N); for (let Y = 0, i = 0; Y < PH; Y++) for (let X = 0; X < PW; X++, i++) a[i] = fn(X, Y, pal, f); return a; };
    T.field = one(TEX.field, P("grass")); T.yard = one(TEX.yard, P("ground"));
    T.mat = [one(TEX.stone, P("stone")), one(TEX.timber, P("timber")), one(TEX.hedge, P("hedge")), one(TEX.ice, P("ice")), one(TEX.iron, P("iron"))];
    T.keepT = one(TEX.stone, P("keep"));
    let moat = false; for (let c = 0; c < B.n && !moat; c++) moat = B.kind[c] === 1;
    T.moat = moat ? [0, 1, 2, 3].map((f) => one(TEX.moat, P("moat"), f)) : null;
    T.pal = { ink: u32(A.ink), mat: MATS.map((m) => A[m].map(u32)), chest: A.chest.map(u32), lever: A.lever.map(u32), wood: A.wood.map(u32),
      stone: A.stone.map(u32), keep: A.keep.map(u32), roof: [A.goblin[2], A.goblin[3], A.goblin[4]].map(u32), flag: A.flag.map(u32), tent: A.tent.map(u32), crew: A.crew.map((c) => u32(c[0])), moat: A.moat.map(u32) };
    return T;
  }
  // Level facts the picture needs (once per level): field (open ground joined to the board edge through open ground:
  // grass; everything else open is courtyard), the keep's bounds.
  function levelInfo(B) {
    const n = B.n, field = new Uint8Array(n), q = new Int32Array(n), openK = (k) => k === 0 || k === 5 || k === 6;
    let h = 0, t = 0;
    for (let c = 0; c < n; c++) { const x = c % B.w, y = (c / B.w) | 0; if ((x === 0 || y === 0 || x === B.w - 1 || y === B.h - 1) && openK(B.kind[c])) { field[c] = 1; q[t++] = c; } }
    while (h < t) { const c = q[h++]; for (let d = 0; d < 4; d++) { const e = B.nb[c * 4 + d]; if (e >= 0 && !field[e] && openK(B.kind[e])) { field[e] = 1; q[t++] = e; } } }
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (const c of B.keepCells) { const x = c % B.w, y = (c / B.w) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { field, kx0: x0, ky0: y0, kx1: x1, ky1: y1 };
  }
  // Paint the picture of state st (any engine state) into buf (PW × PH). Walls are standing unless st.open.
  function compose(buf, T, B, st, I, moatF) {
    const bp = T.bp, PW = T.PW, w = B.w, h = B.h, kind = B.kind, mat = B.mat, sec = B.sec, nb = B.nb, P = T.pal, ink = P.ink;
    const standing = (c) => c >= 0 && (kind[c] === 2 || kind[c] === 4 || (kind[c] === 3 && !st.open[c]));
    const blit = (src, X0, Y0) => { for (let j = 0; j < bp; j++) { const o = (Y0 + j) * PW + X0; for (let i = 0; i < bp; i++) buf[o + i] = src[o + i]; } };
    const row = (X0, Y, n, fn) => { const o = Y * PW + X0; for (let i = 0; i < n; i++) buf[o + i] = fn(buf[o + i]); };
    const col = (X, Y0, n, fn) => { for (let j = 0; j < n; j++) { const o = (Y0 + j) * PW + X; buf[o] = fn(buf[o]); } };
    const sprite = (rows, X0, Y0, pal) => { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch !== ".") buf[(Y0 + j) * PW + X0 + i] = ch === "k" ? ink : pal[ch]; } };
    const dark = (k) => (c) => mix(c, k, 0), lite = (k) => (c) => mix(c, k, 255), toInk = () => ink;
    // the field ring round the board
    buf.set(T.field);
    for (let c = 0; c < B.n; c++) {
      const x = c % w, y = (c / w) | 0, X0 = (x + 1) * bp, Y0 = (y + 1) * bp, k = kind[c];
      if (k === 3 && !st.open[c]) { blit(T.mat[mat[c]], X0, Y0); continue; }
      if (k === 1) { blit(T.moat ? T.moat[moatF | 0] : T.yard, X0, Y0); continue; }
      if (k === 4) { blit(T.mat[0], X0, Y0); continue; }
      if (k === 2) continue; // the keep is painted as one block below
      blit(I.field[c] ? T.field : T.yard, X0, Y0);
      if (k === 3) { // rubble where a wall stood: chunks of its material, dark undersides
        const M = P.mat[mat[c]];
        for (let i = 0; i < 2; i++) { const px = X0 + 1 + ((h2(c, i, 20) * (bp - 3)) | 0), py = Y0 + 1 + ((h2(c, i, 21) * (bp - 3)) | 0), wd = i ? 1 : 2; row(px, py + 1, wd, () => M[3]); row(px, py, wd, () => (i ? M[2] : M[0])); }
      }
    }
    // outlines and bevels: each standing region is a raised slab; ground south / east of a wall gets its shadow
    for (let c = 0; c < B.n; c++) {
      const x = c % w, y = (c / w) | 0, X0 = (x + 1) * bp, Y0 = (y + 1) * bp, k = kind[c];
      if (k === 3 && !st.open[c]) {
        const q = sec[c], same = (e) => e >= 0 && kind[e] === 3 && !st.open[e] && sec[e] === q;
        const u = !same(nb[c * 4]), r = !same(nb[c * 4 + 1]), d = !same(nb[c * 4 + 2]), l = !same(nb[c * 4 + 3]);
        if (u) { row(X0, Y0 + 1, bp, lite(0.3)); row(X0, Y0, bp, toInk); }
        if (l) { col(X0 + 1, Y0, bp, lite(0.18)); col(X0, Y0, bp, toInk); }
        if (d) { row(X0, Y0 + bp - 2, bp, dark(0.28)); row(X0, Y0 + bp - 1, bp, toInk); }
        if (r) { col(X0 + bp - 2, Y0, bp, dark(0.22)); col(X0 + bp - 1, Y0, bp, toInk); }
      } else if (k === 1) {
        const P2 = T.pal.moat[2];
        for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && kind[e] !== 1) { if (d === 0) row(X0, Y0, bp, () => P2); else if (d === 2) row(X0, Y0 + bp - 1, bp, dark(0.3)); else if (d === 3) col(X0, Y0, bp, () => P2); else col(X0 + bp - 1, Y0, bp, dark(0.25)); } }
      } else if (k !== 2 && k !== 4) {
        if (standing(nb[c * 4])) { row(X0, Y0, bp, dark(0.34)); row(X0, Y0 + 1, bp, dark(0.16)); }
        if (standing(nb[c * 4 + 3])) col(X0, Y0, bp, dark(0.22));
      }
    }
    // levers on a stone plate (up, or thrown), chests (shut, or open once claimed), the camp's tents and pennants
    for (let i = 0; i < B.levers.length; i++) { const c = B.levers[i]; sprite(st.thrown[i] ? SPR.leverT : SPR.lever, (c % w + 1) * bp, ((c / w | 0) + 1) * bp, { R: P.lever[0], G: P.lever[1], w: P.wood[0], S: P.lever[2] }); }
    for (let i = 0; i < B.chestCell.length; i++) { const c = B.chestCell[i]; sprite(st.claimed[i] ? SPR.chestO : SPR.chest, (c % w + 1) * bp, ((c / w | 0) + 1) * bp, { d: P.chest[1], g: P.chest[3], G: P.chest[2], w: P.chest[0] }); }
    for (let i = 0; i < B.camp.length; i++) {
      const c = B.camp[i], X0 = (c % w + 1) * bp, Y0 = ((c / w | 0) + 1) * bp;
      sprite(SPR.tent, X0, Y0, { R: P.tent[0], C: P.tent[1] });
      if (i % 2 === 0) { col(X0 + 3, Y0 - 3, 3, toInk); const fc = P.crew[(i >> 1) % 4]; row(X0 + 4, Y0 - 3, 3, () => fc); row(X0 + 4, Y0 - 2, 2, () => fc); }
    }
    // the keep: one block. A goblin-purple shingled roof with gold eaves and the goblin flag at its peak, over brick walls
    // in the keep's own palette and a portcullis (open on a win), so the goal never reads as another wall.
    const kx = (I.kx0 + 1) * bp, ky = (I.ky0 + 1) * bp, KW = (I.kx1 - I.kx0 + 1) * bp, KH = (I.ky1 - I.ky0 + 1) * bp, K = P.keep, R = P.roof;
    const onK = (X, Y) => kind[((Y / bp | 0) - 1) * w + ((X / bp | 0) - 1)] === 2, rh = KH >> 1, mid = (KW - 1) / 2;
    for (let Y = ky; Y < ky + KH; Y++) for (let X = kx; X < kx + KW; X++) {
      if (!onK(X, Y)) continue;
      const i = X - kx, j = Y - ky, o = Y * PW + X;
      let v;
      if (j < rh) { // roof: a triangle from a 2 px peak at row 2 to the full width at the eaves
        const half = 1 + ((j - 2) * (mid + 0.5)) / Math.max(1, rh - 3), dx = Math.abs(i - mid);
        if (j < 2 || dx > half + 0.5) v = j < 2 ? K[3] : K[3];
        else if (dx > half - 0.5 || j === rh - 1) v = j === rh - 1 ? R[2] : ink;
        else v = (i + (j >> 1)) % 3 === 0 ? R[1] : R[0];
      } else v = T.keepT[o];
      if (i === 0 || i === KW - 1 || j === KH - 1 || j === 0) v = ink;
      buf[o] = v;
    }
    const gw = Math.max(4, (KW / 3) & ~1), gh = Math.max(4, Math.round(KH * 0.3)), gx = kx + ((KW - gw) >> 1), gy = ky + KH - 1 - gh;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const edge = i === 0 || i === gw - 1 || j === 0;
      buf[(gy + j) * PW + gx + i] = edge ? ink : st.won ? (j === 1 ? K[1] : ink) : (i % 2 === 1 || j % 3 === 1 ? K[1] : K[3]);
    }
    const fx = kx + (KW >> 1), fy = ky + 1;
    col(fx - 1, fy, 3, toInk);
    row(fx, fy, 3, () => P.flag[0]); row(fx, fy + 1, 2, () => P.flag[1]);
    // ground the camp can't reach yet sits in shade (the lit ground is where crews can walk)
    for (let c = 0; c < B.n; c++) {
      const k = kind[c];
      if (!(k === 0 || k === 5 || (k === 3 && st.open[c])) || st.conn[c]) continue;
      const X0 = (c % w + 1) * bp, Y0 = ((c / w | 0) + 1) * bp;
      for (let j = 0; j < bp; j++) row(X0, Y0 + j, bp, dark(0.42));
    }
  }
  // The moat's wave frame f alone (every other pixel transparent), for the per-frame overlay.
  function moatFrame(buf, T, B, f) {
    const bp = T.bp, PW = T.PW, src = T.moat[f], P2 = T.pal.moat[2];
    buf.fill(0);
    for (let c = 0; c < B.n; c++) {
      if (B.kind[c] !== 1) continue;
      const X0 = (c % B.w + 1) * bp, Y0 = ((c / B.w | 0) + 1) * bp;
      for (let j = 0; j < bp; j++) { const o = (Y0 + j) * PW + X0; for (let i = 0; i < bp; i++) buf[o + i] = src[o + i]; }
      for (let d = 0; d < 4; d++) { const e = B.nb[c * 4 + d]; if (e >= 0 && B.kind[e] !== 1) {
        if (d === 0) for (let i = 0; i < bp; i++) buf[Y0 * PW + X0 + i] = P2; else if (d === 3) for (let j = 0; j < bp; j++) buf[(Y0 + j) * PW + X0] = P2;
        else if (d === 2) for (let i = 0; i < bp; i++) { const o = (Y0 + bp - 1) * PW + X0 + i; buf[o] = mix(buf[o], 0.3, 0); } else for (let j = 0; j < bp; j++) { const o = (Y0 + j) * PW + X0 + bp - 1; buf[o] = mix(buf[o], 0.25, 0); } } }
    }
  }

  return { G, MATS, WALK, WORK, FRAMES, SHEET_PROBE, noise, mk, up, icon, sources, title, banner, worldStrip, wall, u32, textures, levelInfo, compose, moatFrame };
});
