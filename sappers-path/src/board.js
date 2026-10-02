// Sapper's Path v3 board (SPEC-v3 §6): the fort as Food Hunt blocks, the siege yard with a haul crate per colour, and the
// run-and-carry show. Presentation only: the engine has already resolved the tap; the show replays its event log.
//
// Look (v4 M1, the look pass). Every material pixel is a flat stud: a solid face on a 1 CSS px seam of its own colour
// darkened, with a soft highlight, and nothing inside, so the fort reads as a clean picture at 8 CSS px a cell (Food
// Hunt's level 1492). The per-material marks (bar, posts, hatch, dots, cross, chevron, diamond...) come back in
// colour-blind mode (V.cb, setCb); iron gates keep their bars and Gilt keys their key glyph in both modes. Ground and
// water are dark and muted. Below the grid is the yard: one crate per colour that fills with the haul.
// Sprite caches (blocks, ground, mini blocks) are opaque by construction (a grout or ground fill under everything);
// sappers, the archer, the padlocks and the goblin are the only transparent sprites.
// Gates and keys (M2): each gate wears a padlock in its tint (board.gateTints) and its key a ring of the same tint, so a
// key reads as that gate's. When the key goes, the lock drops and the gate's bars crumble one by one with a shake.
// Towers (M2): tower blocks carry a crenellated rim on the tower's outer edge and a hooded goblin archer stands on top
// while any of it stands; the range disc fades and the archer tumbles when it falls.
// The locked space's key (v4 M2): the gilt block that opens the holding line's locked space wears a pulsing dashed square
// in the socket colour (board.lockKey), so it reads as a space key, not a gate key (a full ring in the gate's tint).
// The page plays the padlock and the cue; sync() passes REVEAL, LINK and UNLOCK to the page's hooks (v4 M5: and POWER).
//
// Surface and scenery (v3 fix pass). Each block can take one of four tones of its colour (base, lit, shade, alt), picked
// once per level from the fort's shape (a region's top or left edge lit, its bottom or right edge shaded, a running bond
// inside a big mass); v4 M1 sets them all to 0 (board.tones) so every block of a colour is the same flat stud.
// The leftover ground carries muted, flat scenery (never bevelled, so it never reads as a block): a trodden path from the
// camp to the fort, tents beside the camp, trees, fields, tufts and flowers on grass, ripples on water. It is decided
// once per level (V.deco) and painted with the ground; it changes no rule. Archer rings tint the ground only.
// Haul bins (fix pass): one bin per colour in its own colour, with its block (glyph and all) as a label and a pile that
// grows with the haul; more than board.binsRow colours go on two rows (board.yardRows2). v4 Critics 1 fix: a bin shows
// only once its colour has hauled a block (it grows in over board.binGrowMs), so the yard is not a colour legend. Fix 2:
// the yard at rest holds empty wooden crates (board.crate, no colour), and a colour takes the next crate from the left
// the first time it sends a sapper, so the bins fill left to right in the order they are first used.
// Archer rings (v4 Critics 1 fix): a ring is loud (board.rangeStroke, dashed) only while it matters: a colour the player
// can send now (V.hot, the page's mask of front cards and squads in the line) has a block in reach inside it, its archer
// is shooting or just hit someone, or the coach points at a tower (V.ringsLoud). Otherwise it is a faint thin dash
// (board.ring). Each ring eases between the two (board.ring.fadeMs).
// The locked space's key (Critics 1 fix): a dashed square in the socket's cream (board.lockKey.dash), the same dash the
// locked space wears in the holding line; gate tints (board.gateTints) keep clear of cream and yellow.
//
// Rotation (M2, landscape phones). When the board would be small (under layout.rotateBelowCss CSS px a cell) and a
// quarter turn makes it bigger, the canvas is drawn turned: the fort's south (camp and yard) faces right, next to the
// tray. Only positions turn (MX/MY and the cell helpers); sprites, crates and text stay upright.
//
// Show (playtest 1: the dispatch model). The engine runs the siege in time and the board draws its state: sync(S) reads
// the engine's log after every advance. A dispatch gets a runner (pooled, show.maxRunners) whose route leaves its
// space's point on the canvas edge (setSlots), crosses the camp and walks the ground as it stands to the face of its
// pixel; the pixel pops when the engine says it does, with crumbs and dust, and the runner carries the block back to its
// colour's bin, where it lands on the engine's home time. An archer hit is a runner that stops where its route first
// enters a standing ring: an arrow meets it there and it is knocked back to its space (Easy, Normal) or falls (Hard).
// Squads overlap freely; a skip runs the engine to quiet and lands everything with no animation. On the fort's last
// fx.winFallN pixels the blocks fall instead of popping (the keep coming down), with a shake and a dust burst.
// Time: V.t is the page's engine time (runners), fxT the effects clock (pops, crumbs, shakes, the lock, labels); nothing
// here reads a real clock. Per-frame work allocates nothing: runners, routes, pops and particles live in typed arrays.
// v4 M4, the Gallery. A level may bring its own palette (setLevel's pal: material id -> {c}); every stud, sapper helmet,
// crumb and bin takes V.pal, and the sprite caches are rebuilt when the palette changes (ids keep their colour-blind
// marks).
// v4.1, picture boards (B.pic: every Siege level and Gallery picture). The board is the picture: no scenery (no path,
// tents, trees, fields or tufts), no idle sappers, no crenellated rim on tower blocks (the towers are drawn in the
// picture; the archer stands on the tower's top row). Water is part of the picture: flat water studs with a wave
// (board.pic.water), never a block. The camp is the entry square, a dark gateway in the frame's bottom row
// (board.pic.entry). A runner leaves its colour's crate in the yard, walks up to the entry square, then the ground as it
// stands to the face of its pixel, and carries its block back the same way into that crate. (v4 M4's ring entry is
// retired.)
(function (root, factory) {
  (root.SappersPath = root.SappersPath || {}).board = factory(root.SappersPath.engine);
})(window, function (E) {
  "use strict";
  const { GRASS, WATER, DIRT, CAMP, IRON, GILT, EV } = E;
  const POPS = 512, PARTS = 768, MAXG = 32, MAXT = 8, MAXS = 8;

  function mk(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
  // A hex colour mixed toward white (k > 0) or black (k < 0), as a CSS colour.
  function shade(hex, k) { const v = parseInt(hex.slice(1), 16), t = k > 0 ? 255 : 0, a = Math.abs(k), ch = (s) => Math.round(((v >> s) & 255) * (1 - a) + t * a); return "rgb(" + ch(16) + "," + ch(8) + "," + ch(0) + ")"; }
  // The same mix as a hex colour (block tones are built from it).
  function mixHex(hex, k) { const v = parseInt(hex.slice(1), 16), t = k > 0 ? 255 : 0, a = Math.abs(k), ch = (s) => Math.round(((v >> s) & 255) * (1 - a) + t * a); return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1); }
  // A block tone: k > 0 brightens by scaling (the hue holds: a lit red stays red, never pink), k < 0 darkens toward black.
  function toneHex(hex, k) { if (k < 0) return mixHex(hex, k); const v = parseInt(hex.slice(1), 16), ch = (s) => Math.min(255, Math.round(((v >> s) & 255) * (1 + k))); return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1); }
  function lum(hex) { const v = parseInt(hex.slice(1), 16); return (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255; }
  function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const hash = (x, y) => { let t = Math.imul(x + 17, 73856093) ^ Math.imul(y + 5, 19349663); t ^= t >>> 13; t = Math.imul(t, 0x5bd1e995); return (t ^ (t >>> 15)) >>> 0; };

  // The per-material mark on a block face (grayscale reading). s: block size in device px.
  function mark(g, m, s, col, K) {
    const t = Math.max(1, Math.round(s * K.markW)), c = s / 2, q = s * 0.26;
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = t; g.lineCap = "round"; g.lineJoin = "round";
    const R = (x, y, w, h) => g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    const L = (pts, close) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); if (close) g.closePath(); g.stroke(); };
    const D = (x, y, r) => { g.beginPath(); g.arc(x, y, Math.max(0.8, r), 0, Math.PI * 2); g.fill(); };
    switch (m) {
      case 1: R(c - q, c - t / 2, 2 * q, t); break;                                              // earth bank: a bar
      case 2: R(c - q * 0.6 - t / 2, c - q, t, 2 * q); R(c + q * 0.6 - t / 2, c - q, t, 2 * q); break; // palisade: posts
      case 3: L([c - q, c + q, c + q, c - q]); L([c - q, c + q * 0.1, c - q * 0.1, c - q]); break; // thatch: hatch
      case 4: R(c - q, c - q * 0.55 - t / 2, 2 * q, t); R(c - q, c + q * 0.55 - t / 2, 2 * q, t); break; // timber: planks
      case 5: D(c - q * 0.6, c + q * 0.45, t * 0.9); D(c + q * 0.6, c + q * 0.45, t * 0.9); D(c, c - q * 0.55, t * 0.9); break; // rubble: stones
      case 6: g.strokeRect(Math.round(c - q * 0.7), Math.round(c - q * 0.7), Math.round(q * 1.4), Math.round(q * 1.4)); break; // ashlar: dressed face
      case 7: R(c - q, c - t / 2, 2 * q, t); R(c - t / 2, c - q, t, 2 * q); break;              // slate (towers): arrow loop
      case 8: L([c - q, c + q * 0.45, c, c - q * 0.5, c + q, c + q * 0.45]); break;            // roof tile: chevron
      case 9: R(c - q, c - q * 0.7, 2 * q, t); R(c - t / 2, c - q * 0.7, t, q * 1.7); break;   // brick: bond
      case 10: for (let k = -1; k <= 1; k++) R(c + k * q * 0.75 - t / 2, c - q * 1.15, t, q * 2.3); R(c - q * 1.1, c - t / 2, q * 2.2, t); break; // iron gate: bars
      case 11: D(c - q * 0.55, c - q * 0.55, t); D(c + q * 0.55, c - q * 0.55, t); D(c - q * 0.55, c + q * 0.55, t); D(c + q * 0.55, c + q * 0.55, t); break; // hedge: leaves
      case 12: L([c, c - q, c + q, c, c, c + q, c - q, c], true); break;                         // warded: diamond rune
      case 13: L([c - q, c - q, c + q, c + q]); L([c + q, c - q, c - q, c + q]); break;          // crystal: facets
      case 14: {                                                                                 // gilt: the key
        const kt = Math.max(1, Math.round(s * 0.12)); g.lineWidth = kt;
        g.beginPath(); g.arc(c - q * 0.55, c, q * 0.5, 0, Math.PI * 2); g.stroke();
        R(c - q * 0.05, c - kt / 2, q * 1.15, kt); R(c + q * 0.6, c, kt, q * 0.55); R(c + q * 1.05 - kt, c, kt, q * 0.75);
        break;
      }
    }
  }

  // Sapper: an 8x8 figure (helmet in the crew's colour, goblin-green face, dark tunic), two walk frames. Archer: a hooded
  // goblin with a bow (frame 0 at rest, frame 1 drawn with an arrow on the string).
  const SAP = [["..hhhh..", ".hhhhhh.", ".sesses.", "..ssss..", ".bbbbbb.", "b.bbbb.b", "..b..b..", "..b..b.."],
               ["..hhhh..", ".hhhhhh.", ".sesses.", "..ssss..", ".bbbbbb.", "b.bbbb.b", ".b....b.", "b......b"]];
  const ARCH = [["..hhh.w.", ".hhhhh.w", ".hseshqw", "..sss.qw", ".bbbbbqw", "b.bbb.qw", "..b.b.w.", ".bb.bb..."],
                ["..hhh..w", ".hhhhh.w", ".hseshqw", "..sssaaa", ".bbbbbqw", "b.bbb.qw", "..b.b..w", ".bb.bb..."]];
  function figure(rows, pal, ss) {
    const lo = mk(16, 8), x = lo.getContext("2d");
    for (let f = 0; f < 2; f++) for (let y = 0; y < 8; y++) for (let k = 0; k < 8; k++) { const ch = rows[f][y][k]; if (!ch || ch === ".") continue; x.fillStyle = pal[ch]; x.fillRect(f * 8 + k, y, 1, 1); }
    const c = mk(ss * 2, ss), cx = c.getContext("2d"); cx.imageSmoothingEnabled = false; cx.drawImage(lo, 0, 0, 16, 8, 0, 0, ss * 2, ss); return c;
  }

  // The goblins' keep for the win (12x14 logical px, ink outline, transparent around it): crenellated tower, portcullis,
  // green goblin flag. Colours from config.art (keep, flag, ink).
  function keepArt(A, s) {
    const lo = mk(12, 14), x = lo.getContext("2d"), [b, d, l, deep] = A.keep, [fg, fd] = A.flag, R = (a, c, w, h, col) => { x.fillStyle = col; x.fillRect(a, c, w, h); };
    const body = [[1, 6, 10, 8], [1, 4, 2, 2], [5, 4, 2, 2], [9, 4, 2, 2]];
    for (const q of body) R(q[0] - 1, q[1] - 1, q[2] + 2, q[3] + 2, A.ink);
    for (const q of body) R(q[0], q[1], q[2], q[3], b);
    R(1, 6, 1, 8, l); R(2, 9, 9, 1, d); R(6, 6, 1, 3, d); R(3, 11, 1, 3, d); R(8, 11, 1, 3, d); R(3, 7, 1, 1, A.ink); R(8, 7, 1, 1, A.ink);
    R(4, 10, 4, 4, deep); R(5, 10, 1, 4, d); R(7, 10, 1, 4, d); R(4, 12, 4, 1, d);
    R(6, 0, 1, 4, A.ink); R(7, 0, 4, 3, fg); R(7, 2, 4, 1, fd);
    const c = mk(Math.round(s * 12 / 14), s), cx = c.getContext("2d"); cx.imageSmoothingEnabled = false; cx.drawImage(lo, 0, 0, 12, 14, 0, 0, c.width, c.height); return c;
  }

  function create(canvas, cfg, sheets) {
    const C = cfg.v3, K = cfg.board, SH = cfg.show, FX = cfg.fx, g = canvas.getContext("2d", { alpha: false });
    const V = {
      canvas, g, cfg, B: null, S: null, w: 0, h: 0, n: 0, cs: 0, dpr: 1, Y: K.yardRows | 0, rot: false, calm: false, cb: false, mats: [], nextPile: 0,
      disp: null, dist: null, q: null, tone: null, deco: null, idleC: [], layer: null, lg: null, sprites: null, piles: [], pileOf: new Int16Array(E.NMAT).fill(-1),
      haul: new Int32Array(E.NMAT), total: new Int32Array(E.NMAT), towerLeft: new Int32Array(MAXT), towerOfCell: null,
      clock: 0, speed: 1, fxT: 0, rebuilds: 0, lastPop: -1, pileDirty: true, font: "", seed: 12345,
      // show: runners (a pool of show.maxRunners) keyed by the engine's sapper ids
      t: 0, biteMs: 0, knockMs: 0, left: 0, live: 0, dispVer: 0, bfsVer: -1, idR: new Int32Array(1), slotPt: new Float32Array(MAXS * 2), rFreeN: 0,
      rPts: [], rCum: [], maxPts: 0, stats: { hits: 0, dropped: 0 },
      popC: new Int32Array(POPS), popM: new Int8Array(POPS), popT: new Float64Array(POPS), popK: new Int8Array(POPS), popHead: 0,
      pX: new Float32Array(PARTS), pY: new Float32Array(PARTS), pVX: new Float32Array(PARTS), pVY: new Float32Array(PARTS), pT: new Float64Array(PARTS).fill(-1e12),
      pL: new Float32Array(PARTS), pS: new Float32Array(PARTS), pC: new Int8Array(PARTS), pHead: 0,
      gSt: new Int8Array(MAXG), gT: new Float64Array(MAXG), gX: new Float32Array(MAXG), gY: new Float32Array(MAXG), keyC: new Int32Array(MAXG).fill(-1),
      tFallT: new Float64Array(MAXT).fill(-1e12), shT: -1e12, shMs: 1, shAmp: 0,
      label: { t: -1e12, x: 0, y: 0, kill: false, text: "", w: 0 },
      focus: { on: false, x: 0, y: 0, r: 1 },
      gob: { on: false, t0: 0, x: 0, y: 0, done: false },
      hooks: { pop: null, deposit: null, gate: null, tower: null, shot: null, hit: null, collapse: null, tap: null, free: null, move: null, reveal: null, link: null, unlock: null, power: null },
      lockKey: -1, lockOpen: true, pal: null, palKey: "", pic: false, towerTop: new Float32Array(MAXT),
      // Critics 1 fix: rings (V.hot from the page, the loud mask worked out per board change, each ring's ease) and bins.
      hot: 0, ringsLoud: false, hotVer: -1, hotFor: -1, hotMask: 0, shootM: 0, ringA: new Float32Array(MAXT), ringHitT: new Float64Array(MAXT).fill(-1e12), binT: new Float64Array(E.NMAT).fill(-1e12),
    };
    const RMAX = Math.max(8, Math.min(1024, SH.maxRunners | 0));
    V.rOn = new Int8Array(RMAX); V.rId = new Int32Array(RMAX); V.rK = new Int8Array(RMAX); V.rS = new Int8Array(RMAX); V.rM = new Int8Array(RMAX); V.rC = new Int32Array(RMAX);
    V.rT0 = new Float64Array(RMAX); V.rT1 = new Float64Array(RMAX); V.rT2 = new Float64Array(RMAX); V.rNp = new Int32Array(RMAX); V.rL = new Float32Array(RMAX);
    V.rShot = new Int8Array(RMAX); V.rDie = new Float64Array(RMAX); V.rBx = new Float32Array(RMAX); V.rBy = new Float32Array(RMAX); V.rFree = new Int32Array(RMAX);
    V.rJx = new Float32Array(RMAX); V.rJy = new Float32Array(RMAX); V.rHitD = new Float32Array(RMAX); V.rTw = new Int8Array(RMAX); V.rHx = new Float32Array(RMAX); V.rHy = new Float32Array(RMAX); V.rAim = new Float32Array(RMAX);
    for (let i = 0; i < RMAX; i++) { const u = hash(i, 91) / 4294967296, v = hash(i, 37) / 4294967296; V.rJx[i] = (u - 0.5) * 2 * SH.jitter; V.rJy[i] = (v - 0.5) * 2 * SH.jitter; }
    const TYPE = (v) => (v === GRASS ? 0 : v === DIRT ? 1 : v === CAMP ? 2 : 3);
    const COL = C.mats.map((m) => (m ? m.c : FX.dustColor)); COL[0] = FX.dustColor; COL[IRON] = K.gateBar;
    V.pal = C.mats.map((m) => (m ? m.c : FX.dustColor)); V.palKey = V.pal.join();
    const rnd = () => { V.seed = (Math.imul(V.seed, 1664525) + 1013904223) | 0; return (V.seed >>> 0) / 4294967296; };

    // ---- board -> screen (cells) ---------------------------------------------------------------------------------------
    // A point (bx, by) in board cells lands at (MX, MY) screen cells; cell c's top-left at (CX, CY). Turned: (by, w - bx).
    const MX = (bx, by) => (V.rot ? by : bx), MY = (bx, by) => (V.rot ? V.w - bx : by);
    const CX = (x, y) => (V.rot ? y : x), CY = (x, y) => (V.rot ? V.w - 1 - x : y);
    // Board direction (engine nb order: E, W, S, N) -> screen side (0 right, 1 left, 2 bottom, 3 top).
    const SIDE = [[0, 1, 2, 3], [3, 2, 0, 1]];

    // ---- sprite caches ----------------------------------------------------------------------------------------------
    // v4 M1: a flat stud. A solid face with rounded corners on a seam of its own colour darkened (K.stud.seam), the seam
    // K.stud.seamCss CSS px wide between neighbours (half from each block), a soft highlight along the face's top and a
    // faint foot. No mark inside, except in colour-blind mode (V.cb), and always on the iron gate (bars) and gilt keys.
    // seamPx: the seam in device px (mini blocks pass 1).
    function block(m, s, k, seamPx) {
      const c = mk(s, s), x = c.getContext("2d"), base = k ? toneHex(V.pal[m], k) : V.pal[m], dark = lum(V.pal[m]) < 0.3, T = K.stud;
      const sw = Math.min(s >> 2, seamPx || Math.max(1, Math.round(V.dpr * T.seamCss))), a = sw >> 1, f = s - sw, r = Math.max(0.5, f * T.radius);
      x.fillStyle = toneHex(base, T.seam); x.fillRect(0, 0, s, s);
      rr(x, a, a, f, f, r); x.fillStyle = base; x.fill();
      x.save(); rr(x, a, a, f, f, r); x.clip();
      const hh = Math.max(1, Math.round(f * T.hiH)), lh = Math.max(1, Math.round(f * T.loH));
      x.fillStyle = mixHex(base, T.hi); x.fillRect(a, a, f, hh);
      x.fillStyle = mixHex(base, T.lo); x.fillRect(a, a + f - lh, f, lh);
      if (f >= 7) { x.globalAlpha = T.glintAlpha; x.fillStyle = "#ffffff"; rr(x, a + f * T.glint[0], a + f * T.glint[1], Math.max(1, f * T.glint[2]), Math.max(1, f * T.glint[3]), f * T.glint[3] / 2); x.fill(); x.globalAlpha = 1; }
      x.restore();
      if (s >= 5 && (V.cb || m === IRON || m === GILT)) mark(x, m, s, m === IRON ? K.gateBar : m === GILT ? K.keyInk : dark ? shade(base, K.markLight) : shade(base, K.mark), K);
      return c;
    }
    function ground(type, v, s) {
      const c = mk(s, s), x = c.getContext("2d"), base = [C.ground.grass, C.ground.dirt, C.ground.camp, C.ground.water][type];
      x.fillStyle = base; x.fillRect(0, 0, s, s);
      const k = Math.max(1, Math.round(s / 8));
      for (let j = 0; j < 4; j++) { const hx = hash(j * 7 + v * 31, type * 13 + 3), px = (hx % 1000) / 1000, py = ((hx >>> 10) % 1000) / 1000;
        x.fillStyle = shade(base, (j & 1 ? 1 : -1) * K.groundSpeck * (type === 3 ? 2.2 : 1)); x.fillRect(Math.round(px * (s - k)), Math.round(py * (s - k)), type === 3 ? k * 3 : k, k); }
      return c;
    }
    // v4.1: a water stud (the picture's moat): the flat stud in board.pic.water with a light wave across it; never a block.
    function waterStud(s) {
      const c = mk(s, s), x = c.getContext("2d"), P = K.pic, T = K.stud, sw = Math.min(s >> 2, Math.max(1, Math.round(V.dpr * T.seamCss))), a = sw >> 1, f = s - sw;
      x.fillStyle = toneHex(P.water, T.seam); x.fillRect(0, 0, s, s); rr(x, a, a, f, f, Math.max(0.5, f * T.radius)); x.fillStyle = P.water; x.fill();
      if (s >= 5) { x.strokeStyle = P.wave; x.lineWidth = Math.max(1, Math.round(s * 0.09)); x.beginPath(); x.moveTo(a + f * 0.18, a + f * 0.58); x.quadraticCurveTo(a + f * 0.34, a + f * 0.38, a + f * 0.5, a + f * 0.56); x.quadraticCurveTo(a + f * 0.66, a + f * 0.74, a + f * 0.82, a + f * 0.52); x.stroke(); }
      return c;
    }
    // v4.1: the entry square (a camp cell of a picture): the frame's ground with a dark gateway in it, a lit rim round it.
    function entry(s) {
      const c = mk(s, s), x = c.getContext("2d"), P = K.pic.entry, o = Math.max(1, Math.round(s * 0.12));
      x.fillStyle = C.ground.dirt; x.fillRect(0, 0, s, s); x.fillStyle = P.rim; x.fillRect(0, 0, s, s); x.fillStyle = P.face; x.fillRect(o, o, s - 2 * o, s - o);
      return c;
    }
    const sapper = (m, ss) => figure(SAP, { h: V.pal[m], s: K.sapper.skin, e: K.sapper.eye, b: K.sapper.body }, ss);
    // A padlock in a gate's tint: shackle, body, keyhole, ink outline. Transparent around it.
    function padlock(tint, s) {
      const c = mk(s, s), x = c.getContext("2d"), o = Math.max(1, Math.round(s * 0.09)), bw = s * 0.7, bh = s * 0.46, bx = (s - bw) / 2, by = s * 0.46;
      x.lineCap = "butt"; x.strokeStyle = K.lockInk; x.lineWidth = s * 0.2; x.beginPath(); x.arc(s / 2, by, s * 0.22, Math.PI, 0); x.stroke();
      x.strokeStyle = K.lockShackle; x.lineWidth = s * 0.1; x.beginPath(); x.arc(s / 2, by, s * 0.22, Math.PI, 0); x.stroke();
      x.fillStyle = K.lockInk; rr(x, bx - o, by - o, bw + 2 * o, bh + 2 * o, s * 0.1); x.fill();
      x.fillStyle = tint; rr(x, bx, by, bw, bh, s * 0.07); x.fill();
      x.fillStyle = shade(tint, 0.45); x.fillRect(Math.round(bx + o), Math.round(by + o * 0.6), Math.max(1, Math.round(bw - 2 * o)), Math.max(1, o));
      x.fillStyle = K.lockInk; x.beginPath(); x.arc(s / 2, by + bh * 0.42, Math.max(1, s * 0.07), 0, Math.PI * 2); x.fill(); x.fillRect(Math.round(s / 2 - o / 2), Math.round(by + bh * 0.42), Math.max(1, o), Math.round(bh * 0.36));
      return c;
    }
    function buildSprites() {
      const s = V.cs, ss = Math.max(6, Math.round(s * K.sapper.scale)), mb = Math.max(3, Math.round(s * K.sapper.carry)), as = Math.max(8, Math.round(s * K.archer.scale)), ls = Math.max(8, Math.round(s * K.lockScale));
      const S = { blk: [], tb: [], mini: [], sap: [], gnd: [], lock: [], ss, mb, as, ls, arch: null };
      for (let m = 1; m < E.NMAT; m++) { S.blk[m] = block(m, s); S.tb[m] = K.tones.map((k) => (k ? block(m, s, k) : S.blk[m])); S.mini[m] = block(m, mb, 0, 1); S.sap[m] = sapper(m, ss); }
      for (let t = 0; t < 4; t++) for (let v = 0; v < 2; v++) S.gnd[t * 2 + v] = ground(t, v, s);
      S.water = waterStud(s); S.entry = entry(s);
      const A = K.archer; S.arch = figure(ARCH, { h: A.hood, s: A.skin, e: A.eye, b: A.body, w: A.bow, q: A.string, a: A.arrow }, as);
      K.gateTints.forEach((tint, k) => { S.lock[k] = padlock(tint, ls); });
      S.keep = keepArt(cfg.art, Math.max(14, Math.round(s * SH.keepScale)));
      V.sprites = S; V.rebuilds++;
      V.font = Math.round(Math.max(13 * V.dpr, s * 1.35)) + "px 'Jersey 10', system-ui, sans-serif";
    }
    // Opaque-pixel check over every opaque cache (selfTest and the visibility re-check). Returns the bad cache names.
    function checkSprites() {
      const bad = [], S = V.sprites; if (!S) return ["none"];
      // Copy each cache onto one scratch canvas and read that (never read back from a cache itself: studio lesson 27).
      const pc = mk(1, 1), px = pc.getContext("2d", { willReadFrequently: true });
      const probe = (c, name) => { try { if (pc.width !== c.width || pc.height !== c.height) { pc.width = c.width; pc.height = c.height; } px.clearRect(0, 0, pc.width, pc.height); px.drawImage(c, 0, 0);
        const d = px.getImageData(0, 0, pc.width, pc.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) { bad.push(name); return; } } catch (e) { bad.push(name); } };
      for (let m = 1; m < E.NMAT; m++) { S.tb[m].forEach((c, v) => probe(c, "blk" + m + "." + v)); probe(S.mini[m], "mini" + m); }
      S.gnd.forEach((c, k) => probe(c, "gnd" + k));
      if (V.layer) probe(V.layer, "layer");
      return bad;
    }

    // ---- level and layout -------------------------------------------------------------------------------------------
    // pal (v4 M4, optional): the level's own colours, {id: {c}}; other ids keep config's. A new palette drops the sprite
    // caches (the page's layout() rebuilds them before the next draw).
    function setLevel(B, S, pal) {
      V.B = B; V.S = S; V.w = B.w; V.h = B.h; V.n = B.n; V.pic = !!B.pic;
      const P = C.mats.map((m, k) => (pal && pal[k] ? pal[k].c : m ? m.c : FX.dustColor)), key = P.join();
      if (key !== V.palKey) { V.pal = P; V.palKey = key; for (let m = 1; m < E.NMAT; m++) if (m !== IRON) COL[m] = P[m]; V.sprites = null; }
      if (!V.disp || V.disp.length < B.n) { V.disp = new Int8Array(B.n); V.dist = new Int16Array(B.n); V.q = new Int32Array(B.n); V.towerOfCell = new Int8Array(B.n); }
      if (V.idR.length < S.SMAX) V.idR = new Int32Array(S.SMAX);
      V.biteMs = S.T.biteMs; V.knockMs = S.T.knockMs;
      const pts = B.n + 4;
      if (V.maxPts < pts) { V.maxPts = pts; V.rPts = []; V.rCum = []; for (let i = 0; i < RMAX; i++) { V.rPts.push(new Float32Array(pts * 2)); V.rCum.push(new Float32Array(pts)); } }
      // Crates: one per colour on the board (iron is gates, never hauled), in material order across the yard.
      // (fix 2: a crate per colour, each taken by a colour on its first sapper out, left to right; claim()).
      V.piles = []; V.pileOf.fill(-1); V.total.fill(0); V.mats = [];
      for (let m = 1; m < E.NMAT; m++) if (m !== IRON && B.pix[m] > 0) { V.mats.push(m); V.piles.push({ m: 0, x: 0, y: 0 }); V.total[m] = B.pix[m]; }
      V.Y = V.piles.length > K.binsRow ? K.yardRows2 : K.yardRows;
      placePiles();
      // Camp cells, and the idle sappers' spots: spread along the camp's middle row.
      V.camp = []; for (let c = 0; c < B.n; c++) if (B.a0[c] === CAMP) V.camp.push(c);
      let cx0 = 1e9, cx1 = -1; for (const c of V.camp) { const x = c % B.w; if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; }
      const idle = V.pic ? 0 : Math.min(K.idle | 0, V.camp.length), iy = Math.min(B.h - 1, B.campRow + 1); V.idleC = [];
      for (let k = 0; k < idle; k++) V.idleC.push(iy * B.w + Math.round(cx0 + ((k + 0.5) * (cx1 - cx0 + 1)) / idle - 0.5));
      if (!V.tone || V.tone.length < B.n) { V.tone = new Int8Array(B.n); V.deco = new Int8Array(B.n); }
      tones(B); scenery(B);
      // Gate centres (for the padlock) and their keys.
      V.keyC.fill(-1);
      B.gateCells.forEach((gc, k) => { if (k >= MAXG) return; let sx = 0, sy = 0; for (let j = 0; j < gc.length; j++) { sx += gc[j] % B.w; sy += (gc[j] / B.w) | 0; } V.gX[k] = sx / gc.length + 0.5; V.gY[k] = sy / gc.length + 0.5; });
      for (let c = 0; c < B.n; c++) { const k = B.keyOf[c]; if (k >= 0 && k < MAXG) V.keyC[k] = c; }
      V.lockKey = B.lockKey;
      V.towerOfCell.fill(-1);
      V.towerTop.fill(0); for (let k = 0; k < B.towers.length && k < MAXT; k++) { let top = B.h; for (let c = 0; c < B.n; c++) if (B.towerOf[c] === k && ((c / B.w) | 0) < top) top = (c / B.w) | 0; V.towerTop[k] = top; }
      reset();
    }
    // Block tones from the fort's shape (engine nb order E, W, S, N): 1 lit (a top or left edge), 2 shade (a bottom or
    // right edge), 3 alt (the running bond inside a mass), 0 base.
    function tones(B) {
      const a = B.a0, nb = B.nb, w = B.w;
      for (let c = 0; c < B.n; c++) {
        const v = a[c]; if (v <= 0) { V.tone[c] = 0; continue; }
        const same = (k) => { const e = nb[c * 4 + k]; return e >= 0 && a[e] === v; }, x = c % w, y = (c / w) | 0;
        const lit = !same(3) || !same(1), dk = !same(2) || !same(0);
        V.tone[c] = lit && !dk ? 1 : dk && !lit ? 2 : !lit && !dk && (((x + ((y & 1) << 1)) >> 1) & 1) ? 3 : 0;
      }
    }
    // Scenery codes on grass (and water): 1 tuft, 2 flowers, 3 tree, 4 field, 5 path, 6 tent, 7 stone, 8 ripple. A path
    // runs from the camp to the fort (its gate when locked); tents stand beside the camp; trees and fields keep off the
    // fort's edge (K.deco.clear cells). Deterministic from the board.
    function scenery(B) {
      const a = B.a0, w = B.w, h = B.h, n = B.n, D = K.deco, deco = V.deco, dist = V.dist, q = V.q;
      deco.fill(0, 0, n);
      if (V.pic) return; // v4.1: the picture is the whole board
      // Distance (8-way, cells) from anything that isn't grass or camp: the fort, water, dirt.
      dist.fill(-1, 0, n); let qh = 0, qt = 0;
      for (let c = 0; c < n; c++) if (a[c] !== GRASS && a[c] !== CAMP) { dist[c] = 0; q[qt++] = c; }
      while (qh < qt) { const u = q[qh++], x = u % w, y = (u / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const v = Y * w + X; if (dist[v] < 0) { dist[v] = dist[u] + 1; q[qt++] = v; } } }
      for (let c = 0; c < n; c++) {
        const v = a[c], x = c % w, y = (c / w) | 0, r = hash(x * 3 + 1, y * 7 + 2) % 100;
        if (v === WATER) { if (r < D.ripplePct) deco[c] = 8; continue; }
        if (v !== GRASS) continue;
        const far = dist[c] < 0 || dist[c] > D.clear;
        if (far && hash(x >> 1, (y >> 1) + 41) % 100 < D.treePct && r < 70) deco[c] = 3;
        else if (far && hash((x / 3) | 0, ((y / 3) | 0) + 97) % 100 < D.fieldPct) deco[c] = 4;
        else deco[c] = r < D.tuftPct ? 1 : r < D.tuftPct + D.flowerPct ? 2 : r < D.tuftPct + D.flowerPct + D.stonePct ? 7 : 0;
      }
      // The path: BFS over the starting ground from the camp to the nearest fort block (the first gate when there is one).
      let end = -1;
      for (let pass = B.gateCells.length ? 0 : 1; pass < 2 && end < 0; pass++) {
        const tgt = pass ? -1 : B.gateCells[0][0];
        dist.fill(-1, 0, n); qh = 0; qt = 0;
        for (let c = 0; c < n; c++) if (a[c] === CAMP) { dist[c] = 0; q[qt++] = c; }
        while (qh < qt && end < 0) {
        const u = q[qh++];
        for (let k = 0; k < 4 && end < 0; k++) { const e = B.nb[u * 4 + k]; if (e < 0) continue;
          if (a[e] > 0 && (tgt < 0 || e === tgt)) { end = u; break; }
          if (dist[e] < 0 && (a[e] === GRASS || a[e] === DIRT || a[e] === CAMP)) { dist[e] = dist[u] + 1; q[qt++] = e; } }
        }
      }
      for (let c = end, g = n; c >= 0 && dist[c] > 0 && g-- > 0;) {
        if (a[c] === GRASS) deco[c] = 5;
        let nx = -1; for (let k = 0; k < 4; k++) { const e = B.nb[c * 4 + k]; if (e >= 0 && dist[e] === dist[c] - 1) { nx = e; break; } }
        c = nx;
      }
      // Tents on the grass beside the camp, every other cell out from its sides.
      for (const c of V.camp) {
        const x = c % w; for (const s of [-1, 1]) for (let j = 1; j <= D.tents; j++) { const X = x + s * (2 * j - 1); if (X < 0 || X >= w) continue; const e = c - x + X; if (a[e] === GRASS && ((c / w) | 0) === B.h - 1) deco[e] = 6; }
      }
    }
    // Bins: one per colour, on one row (or two past K.binsRow), placed in board cells below the grid.
    function placePiles() {
      const np = V.piles.length, two = np > K.binsRow, per = two ? Math.ceil(np / 2) : np;
      V.piles.forEach((p, k) => { const row = two && k >= per ? 1 : 0, j = row ? k - per : k, inRow = row ? np - per : per;
        p.x = ((j + 0.5 + (per - inRow) / 2) * V.w) / per; p.y = V.h + ((row + 0.5) * V.Y) / (two ? 2 : 1); p.row = row; });
    }
    function reset() {
      const B = V.B; if (!B) return;
      V.disp.set(V.S.a.subarray(0, B.n)); V.dispVer++; V.haul.fill(0); V.lastPop = -1; V.left = V.S.pixLeft; V.t = V.S.now;
      V.rOn.fill(0); V.live = 0; V.rFreeN = 0; for (let i = RMAX - 1; i >= 0; i--) V.rFree[V.rFreeN++] = i; V.idR.fill(-1); V.stats.hits = 0; V.stats.dropped = 0;
      V.towerLeft.fill(0); for (let c = 0; c < B.n; c++) { const t = B.towerOf[c]; V.towerOfCell[c] = t; if (t >= 0 && t < MAXT && V.disp[c] > 0) V.towerLeft[t]++; }
      for (let k = 0; k < MAXG; k++) { const gc = B.gateCells[k]; V.gSt[k] = gc && gc.length && V.disp[gc[0]] > 0 ? 0 : 1; V.gT[k] = -1e12; }
      V.tFallT.fill(-1e12); V.shT = -1e12; V.label.t = -1e12; V.gob.on = false; V.gob.done = false; V.lockOpen = !V.S.locked;
      V.pileOf.fill(-1); V.nextPile = 0; for (const p of V.piles) p.m = 0;
      V.popT.fill(-1e12); V.pT.fill(-1e12); V.binT.fill(-1e12); V.ringHitT.fill(-1e12); V.shootM = 0; V.hotVer = -1;
      for (let k = 0; k < MAXT; k++) V.ringA[k] = k < B.towers.length && hotNow(k) ? 1 : 0;
      paintLayer();
    }
    // Fit the canvas into (cssW, cssH): whole device pixels per cell, turned a quarter when that is bigger and allowed.
    // fit() only works it out (the page asks it before it reserves room for the coach); fitCs is its CSS px per cell.
    const fitOut = { cs: 0, rot: false };
    function fit(cssW, cssH, dpr, allowRot) {
      const rows = V.h + V.Y, cu = Math.min(K.maxCellCss, cssW / V.w, cssH / rows), cr = Math.min(K.maxCellCss, cssW / rows, cssH / V.w);
      fitOut.rot = !!allowRot && cu < cfg.layout.rotateBelowCss && cr > cu * 1.04;
      fitOut.cs = Math.max(2, Math.floor((fitOut.rot ? cr : cu) * dpr)); return fitOut;
    }
    function fitCs(cssW, cssH, dpr, allowRot) { if (!V.B) return 0; const d = Math.max(1, Math.min(K.maxDpr, dpr || 1)); return fit(cssW, cssH, d, allowRot).cs / d; }
    function layout(cssW, cssH, dpr, allowRot) {
      if (!V.B) return;
      V.dpr = Math.max(1, Math.min(K.maxDpr, dpr || 1));
      const rows = V.h + V.Y, f = fit(cssW, cssH, V.dpr, allowRot), rot = f.rot;
      const cs = f.cs, turned = rot !== V.rot;
      const fresh = cs !== V.cs || !V.sprites;
      V.rot = rot; if (turned) { placePiles(); V.pT.fill(-1e12); }
      if (fresh) { V.cs = cs; buildSprites(); }
      const W = (rot ? rows : V.w) * cs, H = (rot ? V.w : rows) * cs;
      if (fresh || turned || canvas.width !== W || canvas.height !== H) {
        canvas.width = W; canvas.height = H;
        canvas.style.width = W / V.dpr + "px"; canvas.style.height = H / V.dpr + "px";
        paintLayer();
      }
    }
    function paintCell(c) {
      if (!V.lg) return; // no layer until the first layout (a 0x0 frame); paintLayer redraws everything once it exists
      const S = V.sprites, cs = V.cs, bx = c % V.w, by = (c / V.w) | 0, x = CX(bx, by) * cs, y = CY(bx, by) * cs, v = V.disp[c];
      if (v > 0) { V.lg.drawImage(S.tb[v][V.tone[c]], x, y); const t = V.B.towerOf[c]; if (t >= 0 && !V.pic) rim(c, t, x, y); return; }
      if (V.pic && v === WATER) { V.lg.drawImage(S.water, x, y); return; } // v4.1: the moat is part of the picture
      V.lg.drawImage(V.pic && v === CAMP ? S.entry : S.gnd[TYPE(v) * 2 + (hash(bx, by) & 1)], x, y);
      if (V.deco[c] && (v === GRASS || v === WATER)) decor(V.deco[c], x, y, bx, by);
      if (coverNow(c)) { V.lg.fillStyle = K.rangeFill; V.lg.fillRect(x, y, cs, cs); }
    }
    // One cell of scenery, flat and muted (K.deco colours). Upright when turned.
    function decor(d, x, y, bx, by) {
      const g2 = V.lg, cs = V.cs, D = K.deco, u = Math.max(1, Math.round(cs / 10)), hv = hash(bx + 7, by + 3), P = (fx, fy, w, h, col) => { g2.fillStyle = col; g2.fillRect(Math.round(x + fx * cs), Math.round(y + fy * cs), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
      if (d === 1) { for (let j = 0; j < 3; j++) P(0.25 + j * 0.2 + ((hv >> j) & 1) * 0.05, 0.45 + ((hv >> (j + 3)) & 1) * 0.1, u, cs * 0.28, D.tuft); }
      else if (d === 2) { P(0.3, 0.35, u * 1.5, u * 1.5, D.flowers[hv % D.flowers.length]); P(0.62, 0.6, u * 1.5, u * 1.5, D.flowers[(hv >> 4) % D.flowers.length]); }
      else if (d === 3) { g2.fillStyle = D.trunk; g2.beginPath(); g2.ellipse(x + cs * 0.5, y + cs * 0.82, cs * 0.34, cs * 0.12, 0, 0, Math.PI * 2); g2.fill();
        g2.fillStyle = D.tree[0]; g2.beginPath(); g2.arc(x + cs * 0.5, y + cs * 0.47, cs * 0.4, 0, Math.PI * 2); g2.fill();
        g2.fillStyle = D.tree[1]; g2.beginPath(); g2.arc(x + cs * 0.42, y + cs * 0.38, cs * 0.2, 0, Math.PI * 2); g2.fill(); }
      else if (d === 4) { P(0, 0, cs, cs, D.field[0]); for (let j = 0; j < 3; j++) P(0, (j + 0.55) / 3, cs, Math.max(1, cs * 0.12), D.field[1]); }
      else if (d === 5) { P(0, 0, cs, cs, D.path[0]); P(0.2 + (hv & 3) * 0.12, 0.3 + ((hv >> 2) & 3) * 0.12, u, u, D.path[1]); }
      else if (d === 6) { const T = K.tents;
        g2.fillStyle = T[2]; g2.beginPath(); g2.moveTo(x + cs * 0.5, y + cs * 0.12); g2.lineTo(x + cs * 1.02, y + cs * 0.96); g2.lineTo(x - cs * 0.02, y + cs * 0.96); g2.closePath(); g2.fill();
        g2.fillStyle = T[0]; g2.beginPath(); g2.moveTo(x + cs * 0.5, y + cs * 0.2); g2.lineTo(x + cs * 0.92, y + cs * 0.92); g2.lineTo(x + cs * 0.08, y + cs * 0.92); g2.closePath(); g2.fill();
        P(0.45, 0.55, cs * 0.1, cs * 0.37, T[2]); P(0.49, -0.05, Math.max(1, cs * 0.06), cs * 0.25, T[2]); P(0.54, -0.05, cs * 0.24, cs * 0.14, T[1]); }
      else if (d === 7) { g2.fillStyle = D.stone; g2.beginPath(); g2.ellipse(x + cs * 0.5, y + cs * 0.6, cs * 0.22, cs * 0.15, 0, 0, Math.PI * 2); g2.fill(); }
      else if (d === 8) { g2.strokeStyle = D.ripple; g2.lineWidth = u; g2.beginPath(); g2.arc(x + cs * (0.35 + (hv & 3) * 0.1), y + cs * 0.7, cs * 0.22, Math.PI * 1.15, Math.PI * 1.85); g2.stroke(); }
    }
    // A tower block's crenellated rim on the tower's outer edges: a dark wall line and two pale merlons per edge.
    function rim(c, t, x, y) {
      const cs = V.cs, g2 = V.lg, tt = Math.max(1, Math.round(cs * K.towerRim)), mw = Math.max(1, Math.round(cs * 0.26)), mh = Math.max(1, Math.round(cs * 0.2)), sd = SIDE[V.rot ? 1 : 0];
      for (let k = 0; k < 4; k++) {
        const e = V.B.nb[c * 4 + k]; if (e >= 0 && V.B.towerOf[e] === t) continue;
        const s = sd[k]; g2.fillStyle = K.towerWall;
        if (s === 0) g2.fillRect(x + cs - tt, y, tt, cs); else if (s === 1) g2.fillRect(x, y, tt, cs); else if (s === 2) g2.fillRect(x, y + cs - tt, cs, tt); else g2.fillRect(x, y, cs, tt);
        g2.fillStyle = K.merlon;
        for (let j = 0; j < 2; j++) { const o = Math.round(cs * (0.16 + j * 0.44));
          if (s === 0) g2.fillRect(x + cs - tt - mh, y + o, mh, mw); else if (s === 1) g2.fillRect(x + tt, y + o, mh, mw); else if (s === 2) g2.fillRect(x + o, y + cs - tt - mh, mw, mh); else g2.fillRect(x + o, y + tt, mw, mh); }
      }
    }
    function paintLayer() {
      if (!V.B || !V.sprites) return;
      const cs = V.cs, rows = V.h + V.Y, W = (V.rot ? rows : V.w) * cs, H = (V.rot ? V.w : rows) * cs;
      if (!V.layer) { V.layer = mk(W, H); V.lg = V.layer.getContext("2d", { alpha: false }); }
      if (V.layer.width !== W || V.layer.height !== H) { V.layer.width = W; V.layer.height = H; }
      const g2 = V.lg; g2.imageSmoothingEnabled = false;
      for (let c = 0; c < V.n; c++) paintCell(c);
      paintYard(); V.pileDirty = false;
    }
    function paintYard() {
      const cs = V.cs, g2 = V.lg, e = Math.max(1, Math.round(cs * 0.12));
      g2.fillStyle = K.yard;
      if (V.rot) { g2.fillRect(V.h * cs, 0, V.Y * cs, V.w * cs); g2.fillStyle = K.yardEdge; g2.fillRect(V.h * cs, 0, e, V.w * cs); }
      else { g2.fillRect(0, V.h * cs, V.w * cs, V.Y * cs); g2.fillStyle = K.yardEdge; g2.fillRect(0, V.h * cs, V.w * cs, e); }
      for (let k = 0; k < V.piles.length; k++) paintPile(k);
    }
    // A bin in its colour: a bevelled box, a darker inside, its block (with the glyph) as a label on the short side, and
    // the haul piled up inside in mini blocks (one per pixel while the colour fits, else to scale). Upright either way.
    // Critics 1 fix: nothing but the yard until the colour's first block lands; then it grows in (binGrow, 0..1).
    const binGrow = (k) => { const m = V.piles[k].m; if (!m || V.haul[m] <= 0) return 0; const a = (V.fxT - V.binT[m]) / Math.max(1, K.binGrowMs); return a >= 1 || V.calm ? 1 : a <= 0 ? 0 : 1 - (1 - a) * (1 - a) * (1 - 2.2 * a); };
    function paintPile(k) {
      const p = V.piles[k], cs = V.cs, g2 = V.lg, S = V.sprites, mb = S.mb, np = V.piles.length, two = np > K.binsRow, per = two ? Math.ceil(np / 2) : np;
      const sw = V.rot ? V.Y / (two ? 2 : 1) : V.w / per, sh = V.rot ? V.w / per : V.Y / (two ? 2 : 1), u = binGrow(k);
      const cx = MX(p.x, p.y) * cs, cy = MY(p.x, p.y) * cs;
      g2.fillStyle = K.yard; g2.fillRect(Math.round(cx - (sw * cs) / 2), Math.round(cy - (sh * cs) / 2), Math.round(sw * cs), Math.round(sh * cs));
      if (u < 1) { // the empty crate (fix 2): muted wood, no colour; the bin grows in over it
        const CR = K.crate, cw = Math.round(Math.min(sw * K.binFill, K.binMax) * cs * CR.scale), ch = Math.round(Math.min(sh * K.binFill, K.binMax) * cs * CR.scale), e = Math.max(1, Math.round(cs * 0.12)), x0 = Math.round(cx - cw / 2), y0 = Math.round(cy - ch / 2);
        g2.fillStyle = CR.edge; g2.fillRect(x0 - e, y0 - e, cw + 2 * e, ch + 2 * e); g2.fillStyle = CR.face; g2.fillRect(x0, y0, cw, ch); g2.fillStyle = CR.inside; g2.fillRect(x0 + e, y0 + e, cw - 2 * e, ch - 2 * e);
        g2.fillStyle = CR.plank; for (let q = 1; q < CR.planks; q++) g2.fillRect(x0 + e, Math.round(y0 + e + ((ch - 2 * e) * q) / CR.planks), cw - 2 * e, Math.max(1, e >> 1));
      }
      if (u <= 0) return;
      const bw = Math.max(2, Math.round(Math.min(sw * K.binFill, K.binMax) * cs * u)), bh = Math.max(2, Math.round(Math.min(sh * K.binFill, K.binMax) * cs * u));
      const x = Math.round(cx - bw / 2), y = Math.round(cy - bh / 2), col = V.pal[p.m];
      const o = Math.max(1, Math.round(cs * 0.12)), lab = Math.max(1, Math.round(Math.max(K.binChipPx * V.dpr, Math.round(cs * 0.95)) * u)), wide = bw >= bh;
      g2.fillStyle = K.binInk; g2.fillRect(x - o, y - o, bw + 2 * o, bh + 2 * o);
      g2.fillStyle = col; g2.fillRect(x, y, bw, bh);
      g2.fillStyle = mixHex(col, K.hi); g2.fillRect(x, y, bw, o); g2.fillStyle = mixHex(col, K.lo); g2.fillRect(x, y + bh - o, bw, o);
      // The label (the block itself) on the short side; the inside takes the rest.
      const lx = wide ? x + o : Math.round(cx - lab / 2), ly = wide ? Math.round(cy - lab / 2) : y + o;
      const ix = wide ? lx + lab + o : x + o, iy = wide ? y + o : ly + lab + o, iw = wide ? x + bw - o - ix : bw - 2 * o, ih = wide ? bh - 2 * o : y + bh - o - iy;
      g2.fillStyle = mixHex(col, K.binInside); g2.fillRect(ix, iy, Math.max(1, iw), Math.max(1, ih));
      g2.drawImage(S.tb[p.m][0], lx, ly, lab, lab);
      if (u < 1) return;
      const cols = Math.max(1, Math.floor(iw / mb)), rows = Math.max(1, Math.floor(ih / mb)), cap = cols * rows;
      const tot = V.total[p.m], fill = !tot ? 0 : tot <= cap ? Math.min(cap, V.haul[p.m]) : Math.min(cap, Math.round((cap * V.haul[p.m]) / tot)), ox = ix + Math.round((iw - cols * mb) / 2);
      for (let i = 0; i < fill; i++) g2.drawImage(S.mini[p.m], ox + (i % cols) * mb, iy + ih - (1 + ((i / cols) | 0)) * mb);
    }

    // ---- the show -----------------------------------------------------------------------------------------------------
    // The engine is the truth: every sapper out is a record in it (space, target, dispatch, pop or hit, home times).
    // sync(S) reads the engine's log after each advance: a dispatch gets a runner (a pooled slot with a route over the
    // ground as it stands), a pop takes the block off the board, a home drops the block in its bin. Runners are drawn
    // at the page's engine time (V.t), so what the player sees is exactly when the rules act.
    // BFS from the camp over the displayed ground (cached until the next pop).
    function bfs() {
      if (V.bfsVer === V.dispVer) return;
      V.bfsVer = V.dispVer;
      const n = V.n, w = V.w, h = V.h, wg = V.disp, dist = V.dist, q = V.q; let qh = 0, qt = 0;
      dist.fill(-1, 0, n);
      for (let c = 0; c < n; c++) if (wg[c] === CAMP) { dist[c] = 0; q[qt++] = c; }
      while (qh < qt) {
        const u = q[qh++], x = u % w, y = (u / w) | 0, du = dist[u] + 1;
        if (x > 0) { const v = u - 1; if (dist[v] < 0 && wg[v] <= 0 && wg[v] !== WATER) { dist[v] = du; q[qt++] = v; } }
        if (x < w - 1) { const v = u + 1; if (dist[v] < 0 && wg[v] <= 0 && wg[v] !== WATER) { dist[v] = du; q[qt++] = v; } }
        if (y > 0) { const v = u - w; if (dist[v] < 0 && wg[v] <= 0 && wg[v] !== WATER) { dist[v] = du; q[qt++] = v; } }
        if (y < h - 1) { const v = u + w; if (dist[v] < 0 && wg[v] <= 0 && wg[v] !== WATER) { dist[v] = du; q[qt++] = v; } }
      }
    }
    const nbOf = (c, k) => { const w = V.w, x = c % w, y = (c / w) | 0; return k === 0 ? (x < w - 1 ? c + 1 : -1) : k === 1 ? (x > 0 ? c - 1 : -1) : k === 2 ? (y < V.h - 1 ? c + w : -1) : y > 0 ? c - w : -1; };
    // Standing towers whose ring covers cell c, as a bit mask (display state).
    const coverNow = (c) => { if (c < 0 || c >= V.n) return 0; let m = V.B.cover[c]; for (let t = 0; t < V.B.towers.length && t < MAXT; t++) if (V.towerLeft[t] <= 0) m &= ~(1 << t); return m; };
    const lowBit = (m) => { for (let t = 0; t < MAXT; t++) if (m & (1 << t)) return t; return -1; };
    // Where space s's sappers come onto the board (the point on the canvas nearest its slot in the holding line).
    const slotX = (s) => V.slotPt[(s % MAXS) * 2], slotY = (s) => V.slotPt[(s % MAXS) * 2 + 1];
    // Runner i's route: its space's point (v4.1, a picture: its colour's crate in the yard, p) -> the camp -> the ground ->
    // half into the face of its pixel c.
    function route(i, s, c, p) {
      bfs();
      const w = V.w, pts = V.rPts[i], cum = V.rCum[i];
      let u = -1, best = 1e9;
      for (let k = 0; k < 4; k++) { const v = nbOf(c, k); if (v >= 0 && V.dist[v] >= 0 && V.dist[v] < best) { best = V.dist[v]; u = v; } }
      let np = 0;
      const put = (x, y) => { pts[np * 2] = x; pts[np * 2 + 1] = y; np++; };
      if (p) put(p.x, p.y); else put(slotX(s), slotY(s));
      if (u >= 0) {
        const base = np; let e = u, guard = V.dist[u];
        put(e % w + 0.5, ((e / w) | 0) + 0.5);
        while (V.dist[e] > 0 && guard-- >= 0) { let nx = -1; for (let k = 0; k < 4; k++) { const v = nbOf(e, k); if (v >= 0 && V.dist[v] === V.dist[e] - 1) { nx = v; break; } } if (nx < 0) break; e = nx; put(e % w + 0.5, ((e / w) | 0) + 0.5); }
        for (let a = base, b = np - 1; a < b; a++, b--) { const ax = pts[a * 2], ay = pts[a * 2 + 1]; pts[a * 2] = pts[b * 2]; pts[a * 2 + 1] = pts[b * 2 + 1]; pts[b * 2] = ax; pts[b * 2 + 1] = ay; }
        put((u % w + 0.5 + (c % w) + 0.5) / 2, (((u / w) | 0) + 0.5 + ((c / w) | 0) + 0.5) / 2);
      } else put(c % w + 0.5, ((c / w) | 0) + 1.2); // no ground route (a resync mid-flight): straight up to it
      cum[0] = 0; for (let k = 1; k < np; k++) cum[k] = cum[k - 1] + Math.hypot(pts[k * 2] - pts[k * 2 - 2], pts[k * 2 + 1] - pts[k * 2 - 1]);
      V.rNp[i] = np; V.rL[i] = cum[np - 1];
    }
    // A runner for sapper id (engine records), or none when the pool is full (the rules don't care; it isn't drawn).
    function runner(S, id) {
      V.idR[id] = -1;
      if (V.rFreeN <= 0) { V.stats.dropped++; return -1; }
      const i = V.rFree[--V.rFreeN], s = S.qS[id], c = S.qC[id], k = S.qK[id];
      V.rOn[i] = 1; V.rId[i] = id; V.idR[id] = i; V.rK[i] = k; V.rS[i] = s; V.rM[i] = S.spM[s]; V.rC[i] = c;
      V.rT0[i] = S.q0[id]; V.rT1[i] = S.q1[id]; V.rT2[i] = S.q2[id]; V.rShot[i] = 0; V.rDie[i] = -1; V.live++;
      const p = k === 1 || V.pic ? V.piles[claim(V.rM[i])] : null; // v4.1: a picture's runner leaves its colour's crate
      route(i, s, c, V.pic ? p : null);
      if (k === 1) { V.rBx[i] = p ? p.x : V.w / 2; V.rBy[i] = p ? p.y : V.h + V.Y / 2; return i; }
      // A hit: it stops where its route first enters a standing ring (or at the pixel's face); the arrow meets it there.
      const pts = V.rPts[i], cum = V.rCum[i], np = V.rNp[i], w = V.w; let dH = cum[np - 1], tw = lowBit(coverNow(c));
      for (let q = 1; q < np; q++) { const px = Math.floor(pts[q * 2]), py = Math.floor(pts[q * 2 + 1]); if (px < 0 || py < 0 || px >= w || py >= V.h) continue; const m = coverNow(py * w + px); if (m) { dH = Math.max(0, cum[q] - 0.45); tw = lowBit(m); break; } }
      V.rHitD[i] = dH; V.rTw[i] = Math.max(0, tw); V.rBx[i] = pts[0]; V.rBy[i] = pts[1];
      V.rAim[i] = Math.max(1, Math.min(SH.arrowMs, V.rT1[i] - V.rT0[i]));
      along(i, dH, pos); V.rHx[i] = pos[0]; V.rHy[i] = pos[1];
      return i;
    }
    function drop(i) { if (!V.rOn[i]) return; V.rOn[i] = 0; if (V.idR[V.rId[i]] === i) V.idR[V.rId[i]] = -1; V.rFree[V.rFreeN++] = i; V.live--; }
    // Board point at distance d along runner i's route (point 0 is its space's point).
    function along(i, d, out) {
      const pts = V.rPts[i], cum = V.rCum[i], np = V.rNp[i];
      let k = 1; while (k < np - 1 && cum[k] < d) k++;
      const a = cum[k - 1], b = cum[k], f = b > a ? Math.max(0, Math.min(1, (d - a) / (b - a))) : 0;
      out[0] = pts[k * 2 - 2] + (pts[k * 2] - pts[k * 2 - 2]) * f; out[1] = pts[k * 2 - 1] + (pts[k * 2 + 1] - pts[k * 2 - 1]) * f;
    }
    // Particles live in screen cells. Crumbs of the block's colour and a puff of dust, spawned inside the cell.
    function spawn(sx, sy, col, n, size, up, spread, delay) {
      for (let j = 0; j < n; j++) {
        const k = V.pHead; V.pHead = (k + 1) % PARTS;
        V.pX[k] = sx + (rnd() - 0.5) * 0.7; V.pY[k] = sy + (rnd() - 0.5) * 0.7; V.pVX[k] = (rnd() - 0.5) * spread; V.pVY[k] = -rnd() * up;
        V.pT[k] = V.fxT + (delay || 0); V.pL[k] = FX.lifeMs * (0.7 + rnd() * 0.6); V.pS[k] = size * (0.7 + rnd() * 0.6); V.pC[k] = col;
      }
    }
    function popCell(c, m, anim, kind, delay) {
      if (V.disp[c] <= 0) return;
      V.disp[c] = DIRT; V.dispVer++; paintCell(c); V.lastPop = c;
      const t = V.towerOfCell[c];
      if (t >= 0 && t < MAXT && V.towerLeft[t] > 0 && --V.towerLeft[t] === 0) {
        V.tFallT[t] = anim ? V.fxT : -1e12;
        for (let e = 0; e < V.n; e++) if (V.B.cover[e] & (1 << t) && V.disp[e] <= 0) paintCell(e); // the ring's tint goes
        if (anim) { shake(FX.towerShake[0], FX.towerShake[1]); if (V.hooks.tower) V.hooks.tower(t); }
      }
      if (anim) {
        const k = V.popHead; V.popHead = (k + 1) % POPS; V.popC[k] = c; V.popM[k] = m; V.popT[k] = V.fxT + (delay || 0); V.popK[k] = kind || 0;
        const bx = c % V.w + 0.5, by = ((c / V.w) | 0) + 0.5, d = delay || 0;
        spawn(MX(bx, by), MY(bx, by), m, FX.crumbs, FX.crumbSize, FX.lift, FX.spread, d); spawn(MX(bx, by), MY(bx, by), 0, FX.dust, FX.dustSize, FX.lift * 0.4, FX.spread * 0.5, d);
      }
    }
    // The fort's last fx.winFallN pixels fall and tumble instead of popping (the keep coming down).
    function eat(c, anim) {
      const m = V.B.a0[c], fall = V.left <= FX.winFallN;
      V.left--; popCell(c, m, anim, fall ? 1 : 0, 0);
      if (anim && V.hooks.pop) V.hooks.pop(c, m);
      if (anim && V.left <= 0) { const bx = c % V.w + 0.5, by = ((c / V.w) | 0) + 0.5; spawn(MX(bx, by), MY(bx, by), 0, FX.winDust >> 1, FX.dustSize * 1.4, FX.lift, FX.spread * 1.3); }
    }
    function gate(g, anim) {
      const gc = V.B.gateCells[g]; V.left -= gc.length;
      for (let j = 0; j < gc.length; j++) popCell(gc[j], IRON, anim, 1, anim ? (j + 1) * FX.gateStaggerMs : 0);
      if (g < MAXG) { V.gSt[g] = 1; V.gT[g] = anim ? V.fxT : -1e12; }
      if (anim) { shake(FX.gateShake[0], FX.gateShake[1]); if (V.hooks.gate) V.hooks.gate(g); }
    }
    function deposit(m) { claim(m); if (V.haul[m]++ === 0) V.binT[m] = V.fxT; V.pileDirty = true; if (V.hooks.deposit) V.hooks.deposit(m); }
    // Colour m's crate: the next one from the left, the first time it is needed (-1 past the last, never at these sizes).
    function claim(m) { if (V.pileOf[m] < 0 && V.nextPile < V.piles.length) { V.pileOf[m] = V.nextPile; V.piles[V.nextPile++].m = m; V.pileDirty = true; } return V.pileOf[m]; }
    function shake(amp, ms) { if (V.calm) return; V.shT = V.fxT; V.shMs = Math.max(1, ms); V.shAmp = amp; }
    // Read the engine's log since the last sync (then clear it). anim false: land everything quietly (a skip).
    function sync(S, anim) {
      if (S.evLost) { resync(S); S.clearLog(); return; }
      const ev = S.ev, len = S.evLen;
      for (let j = 0; j + 2 < len; j += 3) {
        const t = ev[j], a = ev[j + 1], b = ev[j + 2];
        if (t === EV.DISP) { runner(S, a); if (V.hooks.move) V.hooks.move(); }
        else if (t === EV.EAT) eat(a, anim);
        else if (t === EV.GATE) gate(a, anim);
        else if (t === EV.HIT || t === EV.KILL) {
          const i = V.idR[a], kill = t === EV.KILL; V.stats.hits++; if (i >= 0 && V.rTw[i] < MAXT) V.ringHitT[V.rTw[i]] = V.fxT;
          if (anim && V.hooks.hit) V.hooks.hit(kill ? 2 : 1);
          const hx = i >= 0 ? V.rHx[i] : (S.qC[a] % V.w) + 0.5, hy = i >= 0 ? V.rHy[i] : ((S.qC[a] / V.w) | 0) + 0.5;
          if (anim) { V.label.t = V.fxT; V.label.x = hx; V.label.y = hy; V.label.kill = kill; V.label.text = (kill ? SH.killText : SH.hitText).replace("{n}", 1); V.label.w = 0; spawn(MX(hx, hy), MY(hx, hy), 0, FX.dust + 2, FX.dustSize, FX.lift * 0.5, FX.spread * 0.6); }
          if (kill && i >= 0) { if (anim) V.rDie[i] = V.fxT; else drop(i); }
        } else if (t === EV.HOME) { if (S.qK[a] === 1) deposit(S.spM[S.qS[a]]); const i = V.idR[a]; if (i >= 0) drop(i); if (V.hooks.move) V.hooks.move(); }
        else if (t === EV.TAP) { if (V.hooks.tap) V.hooks.tap(a, b); }
        else if (t === EV.FREE) { if (V.hooks.free) V.hooks.free(a, b); }
        else if (t === EV.REVEAL) { if (V.hooks.reveal) V.hooks.reveal(a, b); }
        else if (t === EV.LINK) { if (V.hooks.link) V.hooks.link(a, b); }
        else if (t === EV.UNLOCK) { V.lockOpen = true; if (anim && V.hooks.unlock) V.hooks.unlock(a); }
        else if (t === EV.POWER) { if (V.hooks.power) V.hooks.power(a, b); }
      }
      S.clearLog();
    }
    // The log overflowed (never at the configured sizes): rebuild the picture from the engine's state.
    function resync(S) {
      for (let i = 0; i < RMAX; i++) drop(i);
      V.disp.set(S.a.subarray(0, V.n)); V.dispVer++; V.left = S.pixLeft;
      V.towerLeft.fill(0); for (let c = 0; c < V.n; c++) { const t = V.B.towerOf[c]; if (t >= 0 && t < MAXT && V.disp[c] > 0) V.towerLeft[t]++; }
      for (let k = 0; k < MAXG; k++) { const gc = V.B.gateCells[k]; V.gSt[k] = gc && gc.length && V.disp[gc[0]] > 0 ? 0 : 1; }
      V.lockOpen = !S.locked;
      for (let m = 1; m < E.NMAT; m++) { V.haul[m] = Math.max(0, V.total[m] - S.left[m]); if (V.haul[m] > 0) claim(m); }
      for (let id = 0; id < S.sent; id++) { if (S.q2[id] <= S.now || (S.qK[id] === 3 && S.q1[id] <= S.now)) continue; if (S.qK[id] === 1 && S.q1[id] <= S.now) V.haul[S.spM[S.qS[id]]]--; runner(S, id); }
      paintLayer();
    }
    function update(dt, speed) {
      V.fxT += dt * (speed || 1);
      if (V.B) { const T = V.B.towers.length, st = dt / Math.max(1, K.ring.fadeMs); for (let k = 0; k < T && k < MAXT; k++) { const h = hotNow(k) ? 1 : 0, a = V.ringA[k]; V.ringA[k] = h > a ? Math.min(1, a + st) : Math.max(0, a - st); } }
      if (V.gob.on && !V.gob.done && V.clock - V.gob.t0 >= SH.goblinMs) V.gob.done = true;
      for (let i = 0; i < RMAX; i++) {
        if (!V.rOn[i] || !V.rK[i] || V.rK[i] === 1) continue;
        if (!V.rShot[i] && V.t >= V.rT1[i] - V.rAim[i]) { V.rShot[i] = 1; if (V.hooks.shot) V.hooks.shot(); }
        if (V.rDie[i] >= 0 && V.fxT - V.rDie[i] >= SH.hitFallMs) drop(i);
      }
    }
    // The win: the goblins' keep stands where the last pixel went and comes down (it sinks into its own dust with a shake
    // and the collapse), the crowned goblin scrambles out of the rubble and flees off the top of the board.
    function goblin(on) {
      V.gob.on = !!on; V.gob.done = false; V.gob.t0 = V.clock; const c = V.lastPop >= 0 ? V.lastPop : (V.n >> 1); V.gob.x = (c % V.w) + 0.5; V.gob.y = Math.max(((c / V.w) | 0) + 0.5, SH.keepScale * 0.62);
      if (!on) return;
      shake(FX.winShake[0], FX.winShake[1]); spawn(MX(V.gob.x, V.gob.y + SH.keepScale * 0.35), MY(V.gob.x, V.gob.y + SH.keepScale * 0.35), 0, FX.winDust, FX.dustSize * 1.7, FX.lift, FX.spread * 1.8);
      if (V.hooks.collapse) V.hooks.collapse();
    }
    // Where each space's sappers enter: css points relative to the canvas's top-left, clamped to the canvas edge.
    function setSlots(list) {
      const cols = V.rot ? V.h + V.Y : V.w, rows = V.rot ? V.w : V.h + V.Y;
      for (let s = 0; s < MAXS; s++) {
        const p = list && list[s]; let sx = p ? (p.x * V.dpr) / V.cs : cols / 2, sy = p ? (p.y * V.dpr) / V.cs : rows - 0.3;
        sx = Math.max(0.3, Math.min(cols - 0.3, sx)); sy = Math.max(0.3, Math.min(rows - 0.3, sy));
        V.slotPt[s * 2] = V.rot ? V.w - sy : sx; V.slotPt[s * 2 + 1] = V.rot ? sx : sy;
      }
    }

    // ---- drawing ----------------------------------------------------------------------------------------------------
    const dash = [0, 0], NODASH = [];
    // Critics 1 fix: does tower k's ring matter now? Its archer is shooting or just hit someone, the coach points at a
    // tower, or a colour the player can send now (V.hot) has a block in reach inside the ring (worked out once per board
    // change or page mask, into V.hotMask; allocation-free).
    function hotNow(k) {
      if (V.ringsLoud || (V.shootM & (1 << k)) || V.fxT - V.ringHitT[k] < SH.labelMs) return true;
      if (V.hotVer !== V.dispVer || V.hotFor !== V.hot) {
        V.hotVer = V.dispVer; V.hotFor = V.hot; V.hotMask = 0; bfs();
        const n = V.n, d = V.dist, tw = V.B.towerOf;
        for (let c = 0; c < n; c++) {
          const v = V.disp[c]; if (v <= 0 || !(V.hot & (1 << v)) || tw[c] >= 0) continue;
          const cov = coverNow(c); if (!cov || (V.hotMask & cov) === cov) continue;
          for (let j = 0; j < 4; j++) { const e = nbOf(c, j); if (e >= 0 && d[e] >= 0) { V.hotMask |= cov; break; } }
        }
      }
      return (V.hotMask & (1 << k)) !== 0;
    }
    // Runner i's board position at engine time t. Eaters: out along the route by the bite, at the face while biting,
    // then back with the block to their colour's bin. Hit runners: out to the ring's edge by the hit, then knocked back
    // and walking home to their space (Easy, Normal), or down where they stood (Hard).
    function position(i, t, out) {
      const L = V.rL[i], t0 = V.rT0[i], t1 = V.rT1[i], t2 = V.rT2[i], pts = V.rPts[i];
      let d = 0;
      if (V.rK[i] === 1) {
        const tb = t1 - V.biteMs;
        if (t < t1) d = t < tb ? ((t - t0) / Math.max(1, tb - t0)) * L : L;
        else {
          // Home: the route back to the camp, then across the yard to the bin (instead of the space's point).
          const seg0 = V.rCum[i][1] || 0, far = L - seg0, bx = V.rBx[i], by = V.rBy[i], x1 = pts[2], y1 = pts[3], yard = Math.hypot(bx - x1, by - y1);
          const db = Math.max(0, Math.min(1, (t - t1) / Math.max(1, t2 - t1))) * (far + yard);
          if (db <= far) along(i, L - db, out); else { const f = yard > 0 ? (db - far) / yard : 1; out[0] = x1 + (bx - x1) * f; out[1] = y1 + (by - y1) * f; }
          d = L - db;
          const edge = Math.max(0, Math.min(1, d / 1.5, (L - d) / 1.2)); out[0] += V.rJx[i] * edge; out[1] += V.rJy[i] * edge;
          return;
        }
      } else {
        const dH = V.rHitD[i], back = Math.max(0, dH - SH.knockCells), tk = t1 + V.knockMs;
        if (t < t1) d = ((t - t0) / Math.max(1, t1 - t0)) * dH;
        else if (V.rK[i] === 3) d = dH;
        else if (t < tk) { const u = (t - t1) / Math.max(1, V.knockMs); d = dH - SH.knockCells * (1 - (1 - u) * (1 - u)); }
        else d = back * (1 - Math.min(1, (t - tk) / Math.max(1, t2 - tk)));
      }
      d = Math.max(0, Math.min(L, d));
      along(i, d, out);
      // Jitter fades in off the space's point and out at the pixel, so each runner reaches its face.
      const edge = Math.max(0, Math.min(1, d / 1.5, (L - d) / 1.2));
      out[0] += V.rJx[i] * edge; out[1] += V.rJy[i] * edge;
    }
    const pos = new Float32Array(2);
    // Archer k's board spot: on top of its tower, a little north of the centre.
    // v4.1: on a picture the archer stands on the tower's top row (board.archer.picLift above its middle).
    const archX = (k) => V.B.towers[k].cx + 0.5, archY = (k) => (V.pic ? V.towerTop[k] + 0.5 - K.archer.picLift : V.B.towers[k].cy + 0.5 - K.archer.lift);
    function draw() {
      if (!V.B || !V.sprites) return;
      const cs = V.cs, S = V.sprites, gx = V.g, t = V.t, ft = V.fxT, ss = S.ss, mb = S.mb, CW = canvas.width, CH = canvas.height;
      if (V.pileDirty) { for (let k = 0; k < V.piles.length; k++) paintPile(k); V.pileDirty = false; }
      else for (let k = 0; k < V.piles.length; k++) { const m = V.piles[k].m; if (m && V.haul[m] > 0 && ft - V.binT[m] < K.binGrowMs + 34) paintPile(k); } // a bin growing in
      gx.imageSmoothingEnabled = false;
      // A shake moves everything; the frame's wood shows at the edge it uncovers.
      let dx = 0, dy = 0; const sa = (ft - V.shT) / V.shMs;
      if (sa >= 0 && sa < 1) { const k = V.shAmp * cs * (1 - sa); dx = Math.round(Math.sin(ft * 0.09) * k); dy = Math.round(Math.cos(ft * 0.071) * k * 0.6); gx.fillStyle = K.frame[0]; gx.fillRect(0, 0, CW, CH); }
      gx.setTransform(1, 0, 0, 1, dx, dy);
      gx.drawImage(V.layer, 0, 0);
      // Gates: a padlock in the gate's tint (it drops when the key goes); the key wears a ring of the same tint.
      const G = V.B.gateCells.length;
      for (let k = 0; k < G && k < MAXG; k++) {
        const tint = K.gateTints[k % K.gateTints.length], lk = S.lock[k % S.lock.length], ls = S.ls, lx = MX(V.gX[k], V.gY[k]) * cs - ls / 2, ly = MY(V.gX[k], V.gY[k]) * cs - ls / 2;
        if (V.gSt[k] === 0) {
          gx.drawImage(lk, Math.round(lx), Math.round(ly));
          const kc = V.keyC[k];
          if (kc >= 0 && V.disp[kc] > 0) { const x = CX(kc % V.w, (kc / V.w) | 0) * cs, y = CY(kc % V.w, (kc / V.w) | 0) * cs, lw = Math.max(1.5, cs * 0.16), pu = 0.55 + 0.45 * Math.sin(ft / 170);
            gx.globalAlpha = pu; gx.lineWidth = lw; gx.strokeStyle = tint; gx.strokeRect(x - lw / 2, y - lw / 2, cs + lw, cs + lw); gx.globalAlpha = 1; }
        } else {
          const a = (ft - V.gT[k]) / FX.lockFallMs;
          if (a >= 0 && a < 1) { gx.save(); gx.globalAlpha = 1 - a * a; gx.translate(lx + ls / 2, ly + ls / 2 + a * a * cs * 2.2); gx.rotate(a * 1.4); gx.drawImage(lk, -ls / 2, -ls / 2); gx.restore(); }
        }
      }
      // The locked space's key: a dashed square in the socket colour (the locked space's own dash), pulsing while the
      // space is locked.
      if (V.lockKey >= 0 && !V.lockOpen && V.disp[V.lockKey] > 0) {
        const LK = K.lockKey, kc = V.lockKey, x = CX(kc % V.w, (kc / V.w) | 0) * cs, y = CY(kc % V.w, (kc / V.w) | 0) * cs, lw = Math.max(1.5, cs * LK.w), o = lw / 2 + cs * LK.out;
        dash[0] = Math.max(1.5, cs * LK.dash[0]); dash[1] = Math.max(1, cs * LK.dash[1]);
        gx.globalAlpha = 0.6 + 0.4 * Math.sin(ft / 170); gx.lineWidth = lw; gx.strokeStyle = LK.tint; gx.lineCap = "butt"; gx.setLineDash(dash); gx.lineDashOffset = 0;
        gx.strokeRect(x - o, y - o, cs + 2 * o, cs + 2 * o); gx.setLineDash(NODASH); gx.globalAlpha = 1;
      }
      // Archer ranges while any pixel of their tower stands on the board; they fade as the tower falls. Critics 1 fix: a
      // faint thin dash, loud only while the ring matters (hotNow), easing between the two (V.ringA).
      const T = V.B.towers, RG = K.ring;
      if (T.length) {
        gx.save(); gx.strokeStyle = K.rangeStroke; // (the ring's tint is on the ground, painted with the layer)
        for (let k = 0; k < T.length && k < MAXT; k++) {
          let al = 1; if (V.towerLeft[k] <= 0) { al = 1 - (ft - V.tFallT[k]) / FX.towerFallMs; if (!(al > 0)) continue; }
          const a = V.ringA[k], rx = MX(T[k].cx + 0.5, T[k].cy + 0.5) * cs, ry = MY(T[k].cx + 0.5, T[k].cy + 0.5) * cs, rr = T[k].r * cs;
          if (a < 1) { gx.globalAlpha = al * (1 - a) * RG.quietA; gx.lineWidth = Math.max(1, V.dpr * RG.quietW); dash[0] = V.dpr * RG.quietDash[0]; dash[1] = V.dpr * RG.quietDash[1]; gx.setLineDash(dash); gx.beginPath(); gx.arc(rx, ry, rr, 0, Math.PI * 2); gx.stroke(); }
          if (a > 0) { gx.globalAlpha = al * a; gx.lineWidth = Math.max(1, cs * K.rangeW); dash[0] = cs * K.rangeDash[0]; dash[1] = cs * K.rangeDash[1]; gx.setLineDash(dash); gx.beginPath(); gx.arc(rx, ry, rr, 0, Math.PI * 2); gx.stroke(); }
        }
        gx.restore();
      }
      // Pops: the block swells and fades off the board (kind 0), or falls and tumbles (kind 1: gate bars, the keep).
      // A delayed pop (the gate's bars crumbling in turn) holds the block in place until its turn.
      for (let k = 0; k < POPS; k++) {
        const kind = V.popK[k], dur = kind ? FX.fallMs : SH.popMs, a = (ft - V.popT[k]) / dur; if (a >= 1 || a < -20) continue;
        const c = V.popC[k], bx = c % V.w, by = (c / V.w) | 0, x = (CX(bx, by) + 0.5) * cs, y = (CY(bx, by) + 0.5) * cs, img = S.blk[V.popM[k]];
        if (a < 0) { gx.drawImage(img, x - cs / 2, y - cs / 2); continue; }
        if (!kind) { const sc = 1 + SH.popSwell * a, sz = cs * sc; gx.globalAlpha = 1 - a; gx.drawImage(img, x - sz / 2, y - sz / 2 - a * cs * 0.6, sz, sz); continue; }
        gx.save(); gx.globalAlpha = 1 - a * a; gx.translate(x, y + a * a * cs * FX.fallCells); gx.rotate(((c & 1) ? 1 : -1) * a * FX.fallTurn); const sz = cs * (1 - 0.25 * a); gx.drawImage(img, -sz / 2, -sz / 2, sz, sz); gx.restore();
      }
      gx.globalAlpha = 1;
      // Crumbs and dust.
      for (let k = 0; k < PARTS; k++) {
        const age = ft - V.pT[k], a = age / V.pL[k]; if (a >= 1 || a < 0) continue;
        const s = age / 1000, px = (V.pX[k] + V.pVX[k] * s) * cs, py = (V.pY[k] + V.pVY[k] * s + 0.5 * FX.gravity * s * s) * cs, sz = Math.max(1, V.pS[k] * cs * (1 - 0.4 * a));
        if (px < 0 || py < 0 || px > CW || py > CH) continue;
        gx.globalAlpha = V.pC[k] ? 1 - a * a : 0.7 * (1 - a); gx.fillStyle = COL[V.pC[k]]; gx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
      gx.globalAlpha = 1;
      // Idle sappers at the camp.
      for (let k = 0; k < V.idleC.length; k++) {
        const c = V.idleC[k], f = ((V.clock / (SH.stepMs * 3) + k) | 0) & 1, bx = c % V.w + 0.5, by = ((c / V.w) | 0) + 0.5;
        gx.drawImage(S.sap[V.mats.length ? V.mats[k % V.mats.length] : 1], f * ss, 0, ss, ss, MX(bx, by) * cs - ss / 2, MY(bx, by) * cs - ss / 2, ss, ss);
      }
      // Runners: out empty-handed, back with their block on their heads. Hit runners: an arrow meets them at the ring.
      let shooting = 0;
      for (let i = 0; i < RMAX; i++) {
        if (!V.rOn[i]) continue;
        const k = V.rK[i], t1 = V.rT1[i];
        position(i, t, pos);
        const x = MX(pos[0], pos[1]) * cs - ss / 2;
        if (k !== 1) {
          const hit = t >= t1, f = ((t / SH.stepMs + i) | 0) & 1;
          let y = MY(pos[0], pos[1]) * cs - ss / 2 - (hit ? 0 : f * cs * SH.bob);
          if (!hit && t >= t1 - V.rAim[i]) { shooting |= 1 << V.rTw[i]; arrow(i, (t - (t1 - V.rAim[i])) / V.rAim[i]); }
          if (k === 3 && hit) { // falls over and fades
            const u = V.rDie[i] >= 0 ? (ft - V.rDie[i]) / SH.hitFallMs : 0;
            gx.save(); gx.globalAlpha = Math.max(0, Math.min(1, (1 - u) * 2.5)); gx.translate(x + ss / 2, y + ss * 0.9); gx.rotate(Math.min(1, u * 3) * Math.PI / 2); gx.drawImage(S.sap[V.rM[i]], 0, 0, ss, ss, -ss / 2, -ss * 0.9, ss, ss); gx.restore(); continue;
          }
          const u = hit ? (t - t1) / Math.max(1, V.knockMs) : 0;
          if (hit && u < 1) { y -= Math.sin(u * Math.PI) * cs * 0.5; gx.save(); gx.translate(x + ss / 2, y); gx.scale(-1, 1); gx.drawImage(S.sap[V.rM[i]], f * ss, 0, ss, ss, -ss / 2, 0, ss, ss); gx.restore(); continue; }
          gx.drawImage(S.sap[V.rM[i]], f * ss, 0, ss, ss, x, y, ss, ss);
          continue;
        }
        const back = t >= t1, biting = !back && t >= t1 - V.biteMs, f = biting ? 0 : ((t / SH.stepMs + i) | 0) & 1;
        const bob = biting ? Math.abs(Math.sin(t / 60)) * cs * SH.bob * 2 : f * cs * SH.bob;
        const y = MY(pos[0], pos[1]) * cs - ss / 2 - bob;
        gx.drawImage(S.sap[V.rM[i]], f * ss, 0, ss, ss, x, y, ss, ss);
        if (back) gx.drawImage(S.mini[V.rM[i]], x + (ss - mb) / 2, y - mb * 0.6);
      }
      V.shootM = shooting;
      // Archers on their towers (bow drawn while an arrow is out); a falling tower throws its archer.
      const as = S.as;
      for (let k = 0; k < T.length && k < MAXT; k++) {
        const x = MX(archX(k), archY(k)) * cs - as / 2, y = MY(archX(k), archY(k)) * cs - as / 2;
        if (V.towerLeft[k] > 0) { const fr = shooting & (1 << k) ? 1 : 0; gx.drawImage(S.arch, fr * as, 0, as, as, Math.round(x), Math.round(y - (fr ? 0 : Math.abs(Math.sin(V.clock / 400 + k)) * cs * 0.08)), as, as); continue; }
        const a = (ft - V.tFallT[k]) / FX.towerFallMs; if (!(a >= 0 && a < 1)) continue;
        gx.save(); gx.globalAlpha = 1 - a; gx.translate(x + as / 2, y + as / 2 - Math.sin(a * Math.PI) * cs * 0.8 + a * cs * 1.5); gx.rotate(a * 2.6); gx.drawImage(S.arch, 0, 0, as, as, -as / 2, -as / 2, as, as); gx.restore();
      }
      // The coach's ring on a spot of the board (a key, a gate, a tower).
      if (V.focus.on) { const r = V.focus.r * cs * (1 + 0.1 * Math.sin(V.clock / 160)); gx.lineWidth = Math.max(2, cs * 0.22); gx.strokeStyle = FX.focus; gx.beginPath(); gx.arc(MX(V.focus.x, V.focus.y) * cs, MY(V.focus.x, V.focus.y) * cs, r, 0, Math.PI * 2); gx.stroke(); }
      // The hit label rises from where the first arrow struck.
      const la = (ft - V.label.t) / SH.labelMs;
      if (la >= 0 && la < 1) {
        gx.font = V.font; gx.textAlign = "left"; gx.textBaseline = "middle"; if (!V.label.w) V.label.w = gx.measureText(V.label.text).width;
        const lw = V.label.w, x = Math.max(4, Math.min(CW - lw - 4, MX(V.label.x, V.label.y) * cs - lw / 2)), y = Math.max(cs, MY(V.label.x, V.label.y) * cs - cs * (1.2 + la * 1.2));
        gx.globalAlpha = la < 0.75 ? 1 : (1 - la) * 4; gx.lineWidth = Math.max(3, cs * 0.35); gx.strokeStyle = K.labelInk; gx.strokeText(V.label.text, x, y);
        gx.fillStyle = V.label.kill ? K.labelKill : K.labelHit; gx.fillText(V.label.text, x, y); gx.globalAlpha = 1;
      }
      // The goblin king: a startled hop on the spot where the last pixel went (taunt frames), then he runs off the top.
      if (V.gob.on && sheets) {
        const a = (V.clock - V.gob.t0) / SH.goblinMs, GS = 16, sz = Math.round(cs * SH.goblinScale), stand = SH.goblinStand, ka = a / SH.keepFrac;
        if (ka < 1) { // the keep sinks into the ground (clipped at its foot), wobbling
          const kp = S.keep, kw = kp.width, kh = kp.height, cx = MX(V.gob.x, V.gob.y) * cs, foot = MY(V.gob.x, V.gob.y) * cs + kh * 0.45;
          gx.save(); gx.beginPath(); gx.rect(cx - kw, foot - kh * 1.5, kw * 2, kh * 1.5); gx.clip();
          const sk = Math.max(0, (ka - SH.keepHold) / (1 - SH.keepHold));
          gx.translate(cx, foot + sk * sk * kh); gx.rotate(Math.sin(V.clock / 45) * 0.07 * Math.min(1, ka * 3)); gx.drawImage(kp, -kw / 2, -kh, kw, kh); gx.restore();
        }
        if (a < 1 && ka >= SH.keepGoblinAt) {
          const run = Math.max(0, (a - stand) / (1 - stand)), y0 = Math.max(V.gob.y, (SH.goblinScale * 0.5)), hop = run > 0 ? 0 : Math.abs(Math.sin(V.clock / 80)) * 0.35;
          const by = y0 - hop - (run * (1 - stand) * SH.goblinMs * SH.goblinSpeedCells) / 1000, fr = run > 0 ? ((V.clock / 90) | 0) & 3 : 4 + (((V.clock / 150) | 0) & 1);
          gx.drawImage(sheets.s4, fr * GS, 0, GS, GS, Math.round(MX(V.gob.x, by) * cs - sz / 2), Math.round(MY(V.gob.x, by) * cs - sz / 2), sz, sz);
        }
      }
      gx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // An arrow from runner i's archer to its hit point, u (0..1) of the way, on a shallow arc.
    function arrow(i, u) {
      const gx = V.g, cs = V.cs, k = V.rTw[i], ax = archX(k), ay = archY(k) - 0.2, hx = V.rHx[i], hy = V.rHy[i], u0 = u - 0.05;
      const bx = ax + (hx - ax) * u, by = ay + (hy - ay) * u - Math.sin(u * Math.PI) * SH.arrowArc, px = ax + (hx - ax) * u0, py = ay + (hy - ay) * u0 - Math.sin(u0 * Math.PI) * SH.arrowArc;
      const x = MX(bx, by) * cs, y = MY(bx, by) * cs, vx = x - MX(px, py) * cs, vy = y - MY(px, py) * cs, l = Math.hypot(vx, vy) || 1, ux = vx / l, uy = vy / l, len = cs * 0.95;
      gx.lineCap = "round"; gx.strokeStyle = K.arrow[1]; gx.lineWidth = Math.max(2, cs * 0.2); gx.beginPath(); gx.moveTo(x - ux * len, y - uy * len); gx.lineTo(x, y); gx.stroke();
      gx.strokeStyle = K.arrow[0]; gx.lineWidth = Math.max(1, cs * 0.09); gx.beginPath(); gx.moveTo(x - ux * len, y - uy * len); gx.lineTo(x, y); gx.stroke();
      gx.fillStyle = K.arrow[0]; gx.beginPath(); gx.moveTo(x + ux * cs * 0.3, y + uy * cs * 0.3); gx.lineTo(x - uy * cs * 0.16, y + ux * cs * 0.16); gx.lineTo(x + uy * cs * 0.16, y - ux * cs * 0.16); gx.closePath(); gx.fill();
    }
    // Board point (bx, by) in CSS px from the canvas's top-left corner (the coach's arrow uses it).
    function cssAt(bx, by, out) { out.x = (MX(bx, by) * V.cs) / V.dpr; out.y = (MY(bx, by) * V.cs) / V.dpr; return out; }
    // Show introspection for selfTest: live hit runners, arrows in flight, struck ones; gate and particle state.
    function hitInfo() {
      let live = 0, arrows = 0, struck = 0, kind = 0; const t = V.t;
      for (let i = 0; i < RMAX; i++) { if (!V.rOn[i] || V.rK[i] === 1) continue; live++; kind = V.rK[i]; if (t >= V.rT1[i]) struck++; else if (t >= V.rT1[i] - V.rAim[i]) arrows++; }
      return { live, arrows, struck, kind: kind === 3 ? 2 : kind === 2 ? 1 : 0, label: V.fxT - V.label.t < SH.labelMs };
    }
    // v4.1: where live runners came from (selfTest and the harness): {live, yard (the route starts in the yard below the
    // board), crate (it starts on its colour's crate), entry (its first board cell is an entry square, the camp)}.
    function entryInfo() {
      const o = { live: 0, yard: 0, crate: 0, entry: 0 };
      for (let i = 0; i < RMAX; i++) { if (!V.rOn[i]) continue; o.live++; const P = V.rPts[i], x = P[0], y = P[1], p = V.piles[V.pileOf[V.rM[i]]];
        if (y >= V.h) o.yard++; if (p && Math.abs(p.x - x) < 0.01 && Math.abs(p.y - y) < 0.01) o.crate++;
        const cx = Math.floor(P[2]), cy = Math.floor(P[3]); if (V.rNp[i] > 2 && cx >= 0 && cy >= 0 && cx < V.w && cy < V.h && V.B.a0[cy * V.w + cx] === CAMP) o.entry++; }
      return o;
    }
    // Live runners by space and kind (selfTest and the harness).
    function runners() {
      const bySpace = [0, 0, 0, 0, 0, 0, 0, 0]; let eat = 0, carrying = 0, hit = 0;
      for (let i = 0; i < RMAX; i++) { if (!V.rOn[i]) continue; bySpace[V.rS[i] & 7]++; if (V.rK[i] === 1) { eat++; if (V.t >= V.rT1[i]) carrying++; } else hit++; }
      return { live: V.live, eat, carrying, hit, bySpace, dropped: V.stats.dropped, cap: RMAX };
    }
    // Block caches for selfTest (v4 M1): per material, a checksum of its stud and how many of its pixels are exactly its
    // mark's ink (the gate's bars, the key's glyph, or the colour-blind mark). Read through one scratch canvas.
    function studInfo() {
      const S = V.sprites, pc = mk(1, 1), px = pc.getContext("2d", { willReadFrequently: true }), sum = [0], ink = [0];
      for (let m = 1; m < E.NMAT; m++) {
        const c = S.blk[m], base = V.pal[m], mc = m === IRON ? K.gateBar : m === GILT ? K.keyInk : lum(base) < 0.3 ? shade(base, K.markLight) : shade(base, K.mark);
        const rgb = mc[0] === "#" ? [parseInt(mc.slice(1, 3), 16), parseInt(mc.slice(3, 5), 16), parseInt(mc.slice(5, 7), 16)] : mc.slice(4, -1).split(",").map(Number);
        pc.width = c.width; pc.height = c.height; px.drawImage(c, 0, 0);
        const d = px.getImageData(0, 0, pc.width, pc.height).data; let h = 0, k = 0;
        for (let i = 0; i < d.length; i += 4) { h = (Math.imul(h, 31) + d[i] * 65536 + d[i + 1] * 256 + d[i + 2]) | 0; if (d[i] === rgb[0] && d[i + 1] === rgb[1] && d[i + 2] === rgb[2]) k++; }
        sum.push(h); ink.push(k);
      }
      return { sum, ink, cb: V.cb };
    }
    function fxInfo() {
      let pops = 0, falls = 0, parts = 0; const ft = V.fxT;
      for (let k = 0; k < POPS; k++) { const a = (ft - V.popT[k]) / (V.popK[k] ? FX.fallMs : SH.popMs); if (a < 1 && a > -20) { pops++; if (V.popK[k]) falls++; } }
      for (let k = 0; k < PARTS; k++) { const a = (ft - V.pT[k]) / V.pL[k]; if (a >= 0 && a < 1) parts++; }
      return { pops, falls, parts, shaking: (ft - V.shT) / V.shMs < 1, keep: V.gob.on && (V.clock - V.gob.t0) / (SH.goblinMs * SH.keepFrac) < 1, gates: Array.from(V.gSt.subarray(0, V.B ? V.B.gateCells.length : 0)), lockKey: V.lockKey >= 0 && !V.lockOpen && V.disp[V.lockKey] > 0, lockFalling: V.B ? V.B.gateCells.some((_, k) => V.gSt[k] === 1 && ft - V.gT[k] < FX.lockFallMs) : false };
    }

    // Colour-blind mode (v4 M1): every block wears its material's mark. Rebuilds the caches and repaints (a settings tap).
    function setCb(on) { on = !!on; if (on === V.cb) return; V.cb = on; if (V.sprites) { buildSprites(); paintLayer(); } }
    // A material's mark alone (transparent around it, drawn in ink): the queue tiles' glyph in colour-blind mode.
    function glyph(m, px, ink) { const c = mk(px, px); mark(c.getContext("2d"), m, px, ink, K); return c; }

    Object.assign(V, { setLevel, reset, layout, fitCs, hotNow, sync, setSlots, update, goblin, draw, checkSprites, buildSprites, paintLayer, shake, cssAt, hitInfo, fxInfo, runners, entryInfo, setCb, glyph, studInfo,
      man: (m, px) => sapper(m, px) });
    return V;
  }

  return { create, shade, lum, mark };
});
