// Sapper's Path v3 board (SPEC-v3 §6): the fort as Food Hunt blocks, the siege yard with a haul crate per colour, and the
// run-and-carry show. Presentation only: the engine has already resolved the tap; the show replays its event log.
//
// Look. Every material pixel is a rounded, bevelled block with a stud glint and a per-material mark (bar, posts, hatch,
// dots, cross, chevron, diamond...), so the fort still reads in grayscale; iron gates are barred, Gilt keys carry a key
// glyph. Ground and water are dark and muted. Below the grid is the yard: one crate per colour that fills with the haul.
// Sprite caches (blocks, ground, mini blocks) are opaque by construction (a grout or ground fill under everything);
// sappers, the archer, the padlocks and the goblin are the only transparent sprites.
// Gates and keys (M2): each gate wears a padlock in its tint (board.gateTints) and its key a ring of the same tint, so a
// key reads as that gate's. When the key goes, the lock drops and the gate's bars crumble one by one with a shake.
// Towers (M2): tower blocks carry a crenellated rim on the tower's outer edge and a hooded goblin archer stands on top
// while any of it stands; the range disc fades and the archer tumbles when it falls.
//
// Rotation (M2, landscape phones). When the board would be small (under layout.rotateBelowCss CSS px a cell) and a
// quarter turn makes it bigger, the canvas is drawn turned: the fort's south (camp and yard) faces right, next to the
// tray. Only positions turn (MX/MY and the cell helpers); sprites, crates and text stay upright.
//
// Show. startShow(S) reads the log of the tap just played: EAT cells in resolution order, split into segments (the squad,
// then each holding-line resume). The eats are dealt to at most show.maxRunners runners (a runner takes a batch of
// consecutive eats of one segment), staggered so they leave the yard in lines. A runner's route is found when it
// launches: a BFS from the camp over the ground as it will be once every earlier runner's eats are gone, so it walks
// round walls, never through them. It walks crate -> camp -> route -> the pixel, bites its batch (each pixel pops off
// the board with crumbs and dust), and carries the blocks back to its colour's crate. An archer hit (AIM + HIT/KILL in
// the log) adds up to show.hitMax hit runners: they walk toward the covered pixel, an arrow meets them at the ring's
// edge, and they are knocked back to the camp (Easy/Normal) or fall (Hard). Every runner is sped up just enough to
// finish inside show.capMs, so a play never runs longer than that at 1x. fastForward() lands every remaining pop and
// haul at once (a new tap, a board tap, or selfTest), with no BFS. On the winning play the last fx.winFallN pixels fall
// instead of popping (the keep coming down), with a shake and a dust burst on the last one.
// Time is the page's sim clock passed to update(); nothing here reads a real clock. showT runs the runners; fxT (always
// running, 2x included) runs pops, crumbs, shakes, the lock, the archer's fall and labels. Per-frame work allocates
// nothing: runners, routes, pops and particles live in typed arrays sized once.
(function (root, factory) {
  (root.SappersPath = root.SappersPath || {}).board = factory(root.SappersPath.engine);
})(window, function (E) {
  "use strict";
  const { GRASS, WATER, DIRT, CAMP, IRON, GILT, EV } = E;
  const POPS = 512, PARTS = 768, MAXG = 32, MAXT = 8;

  function mk(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
  // A hex colour mixed toward white (k > 0) or black (k < 0), as a CSS colour.
  function shade(hex, k) { const v = parseInt(hex.slice(1), 16), t = k > 0 ? 255 : 0, a = Math.abs(k), ch = (s) => Math.round(((v >> s) & 255) * (1 - a) + t * a); return "rgb(" + ch(16) + "," + ch(8) + "," + ch(0) + ")"; }
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
      canvas, g, cfg, B: null, S: null, w: 0, h: 0, n: 0, cs: 0, dpr: 1, Y: K.yardRows | 0, rot: false, calm: false,
      disp: null, wg: null, dist: null, q: null, layer: null, lg: null, sprites: null, piles: [], pileOf: new Int16Array(E.NMAT).fill(-1),
      haul: new Int32Array(E.NMAT), total: new Int32Array(E.NMAT), towerLeft: new Int32Array(MAXT), towerOfCell: null,
      clock: 0, speed: 1, fxT: 0, rebuilds: 0, lastPop: -1, pileDirty: true, font: "", seed: 12345,
      // show
      showOn: false, showT: 0, eN: 0, eCell: null, eMat: null, eSeg: null, eGate: null,
      rN: 0, rLaunched: 0, rDone: 0, rM: null, rE0: null, rEn: null, rT0: null, rArr: null, rBite: null, rEnd: null, rPop: null,
      rSt: null, rPts: [], rCum: [], rNp: null, rSeg: null, rJx: null, rJy: null, maxPts: 0, stats: { hits: 0, kills: 0, eats: 0, runners: 0, hitRunners: 0 },
      rK: null, rTgt: null, rHitD: null, rTw: null, rHx: null, rHy: null, rAim: null,
      popC: new Int32Array(POPS), popM: new Int8Array(POPS), popT: new Float64Array(POPS), popK: new Int8Array(POPS), popHead: 0,
      pX: new Float32Array(PARTS), pY: new Float32Array(PARTS), pVX: new Float32Array(PARTS), pVY: new Float32Array(PARTS), pT: new Float64Array(PARTS).fill(-1e12),
      pL: new Float32Array(PARTS), pS: new Float32Array(PARTS), pC: new Int8Array(PARTS), pHead: 0,
      gSt: new Int8Array(MAXG), gT: new Float64Array(MAXG), gX: new Float32Array(MAXG), gY: new Float32Array(MAXG), keyC: new Int32Array(MAXG).fill(-1),
      tFallT: new Float64Array(MAXT).fill(-1e12), shT: -1e12, shMs: 1, shAmp: 0,
      win: false, winFrom: 1e9, label: { t: -1e12, x: 0, y: 0, kill: false, text: "", w: 0 },
      focus: { on: false, x: 0, y: 0, r: 1 },
      gob: { on: false, t0: 0, x: 0, y: 0, done: false },
      hooks: { pop: null, deposit: null, gate: null, tower: null, shot: null, hit: null, collapse: null },
    };
    const RMAX = Math.max(1, SH.maxRunners | 0) * 2 + Math.max(0, SH.hitMax | 0);
    V.rM = new Int8Array(RMAX); V.rE0 = new Int32Array(RMAX); V.rEn = new Int32Array(RMAX); V.rT0 = new Float64Array(RMAX);
    V.rArr = new Float64Array(RMAX); V.rBite = new Float64Array(RMAX); V.rEnd = new Float64Array(RMAX); V.rPop = new Int32Array(RMAX);
    V.rSt = new Int8Array(RMAX); V.rNp = new Int32Array(RMAX); V.rSeg = new Int32Array(RMAX); V.rJx = new Float32Array(RMAX); V.rJy = new Float32Array(RMAX);
    V.rK = new Int8Array(RMAX); V.rTgt = new Int32Array(RMAX); V.rHitD = new Float32Array(RMAX); V.rTw = new Int8Array(RMAX); V.rHx = new Float32Array(RMAX); V.rHy = new Float32Array(RMAX); V.rAim = new Float32Array(RMAX);
    for (let i = 0; i < RMAX; i++) { const u = hash(i, 91) / 4294967296, v = hash(i, 37) / 4294967296; V.rJx[i] = (u - 0.5) * 2 * SH.jitter; V.rJy[i] = (v - 0.5) * 2 * SH.jitter; }
    const TYPE = (v) => (v === GRASS ? 0 : v === DIRT ? 1 : v === CAMP ? 2 : 3);
    const COL = C.mats.map((m) => (m ? m.c : FX.dustColor)); COL[0] = FX.dustColor; COL[IRON] = K.gateBar;
    const rnd = () => { V.seed = (Math.imul(V.seed, 1664525) + 1013904223) | 0; return (V.seed >>> 0) / 4294967296; };

    // ---- board -> screen (cells) ---------------------------------------------------------------------------------------
    // A point (bx, by) in board cells lands at (MX, MY) screen cells; cell c's top-left at (CX, CY). Turned: (by, w - bx).
    const MX = (bx, by) => (V.rot ? by : bx), MY = (bx, by) => (V.rot ? V.w - bx : by);
    const CX = (x, y) => (V.rot ? y : x), CY = (x, y) => (V.rot ? V.w - 1 - x : y);
    // Board direction (engine nb order: E, W, S, N) -> screen side (0 right, 1 left, 2 bottom, 3 top).
    const SIDE = [[0, 1, 2, 3], [3, 2, 0, 1]];

    // ---- sprite caches ----------------------------------------------------------------------------------------------
    function block(m, s) {
      const c = mk(s, s), x = c.getContext("2d"), base = C.mats[m].c, dark = lum(base) < 0.3;
      x.fillStyle = shade(base, K.grout); x.fillRect(0, 0, s, s);
      const i = Math.max(1, Math.round(s * K.inset)), a = s - 2 * i, b = Math.max(1, Math.round(s * K.bevel));
      rr(x, i, i, a, a, s * K.radius); x.fillStyle = base; x.fill();
      x.save(); rr(x, i, i, a, a, s * K.radius); x.clip();
      x.fillStyle = shade(base, K.hi); x.fillRect(i, i, a, b); x.fillRect(i, i, b, a);
      x.fillStyle = shade(base, K.lo); x.fillRect(i, s - i - b, a, b); x.fillRect(s - i - b, i, b, a);
      x.restore();
      if (s >= 6) { x.globalAlpha = K.studAlpha; x.fillStyle = "#ffffff"; x.beginPath(); x.arc(i + b + s * K.stud, i + b + s * K.stud, Math.max(0.7, s * K.stud * 0.75), 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; }
      if (s >= 5) mark(x, m, s, m === IRON ? K.gateBar : m === GILT ? K.keyInk : dark ? shade(base, K.markLight) : shade(base, K.mark), K);
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
    const sapper = (m, ss) => figure(SAP, { h: C.mats[m].c, s: K.sapper.skin, e: K.sapper.eye, b: K.sapper.body }, ss);
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
      const S = { blk: [], mini: [], sap: [], gnd: [], lock: [], ss, mb, as, ls, arch: null };
      for (let m = 1; m < E.NMAT; m++) { S.blk[m] = block(m, s); S.mini[m] = block(m, mb); S.sap[m] = sapper(m, ss); }
      for (let t = 0; t < 4; t++) for (let v = 0; v < 2; v++) S.gnd[t * 2 + v] = ground(t, v, s);
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
      for (let m = 1; m < E.NMAT; m++) { probe(S.blk[m], "blk" + m); probe(S.mini[m], "mini" + m); }
      S.gnd.forEach((c, k) => probe(c, "gnd" + k));
      if (V.layer) probe(V.layer, "layer");
      return bad;
    }

    // ---- level and layout -------------------------------------------------------------------------------------------
    function setLevel(B, S) {
      V.B = B; V.S = S; V.w = B.w; V.h = B.h; V.n = B.n;
      if (!V.disp || V.disp.length < B.n) { V.disp = new Int8Array(B.n); V.wg = new Int8Array(B.n); V.dist = new Int16Array(B.n); V.q = new Int32Array(B.n); V.eCell = new Int32Array(B.n); V.eMat = new Int8Array(B.n); V.eSeg = new Int32Array(B.n); V.eGate = new Int8Array(B.n); V.towerOfCell = new Int8Array(B.n); }
      const pts = B.n + 4;
      if (V.maxPts < pts) { V.maxPts = pts; V.rPts = []; V.rCum = []; for (let i = 0; i < RMAX; i++) { V.rPts.push(new Float32Array(pts * 2)); V.rCum.push(new Float32Array(pts)); } }
      // Crates: one per colour on the board (iron is gates, never hauled), in material order across the yard.
      V.piles = []; V.pileOf.fill(-1); V.total.fill(0);
      for (let m = 1; m < E.NMAT; m++) if (m !== IRON && B.pix[m] > 0) { V.pileOf[m] = V.piles.length; V.piles.push({ m, x: 0, y: 0 }); V.total[m] = B.pix[m]; }
      placePiles();
      // Camp cells for idle sappers and the tents.
      V.camp = []; for (let c = 0; c < B.n; c++) if (B.a0[c] === CAMP) V.camp.push(c);
      // Gate centres (for the padlock) and their keys.
      V.keyC.fill(-1);
      B.gateCells.forEach((gc, k) => { if (k >= MAXG) return; let sx = 0, sy = 0; for (let j = 0; j < gc.length; j++) { sx += gc[j] % B.w; sy += (gc[j] / B.w) | 0; } V.gX[k] = sx / gc.length + 0.5; V.gY[k] = sy / gc.length + 0.5; });
      for (let c = 0; c < B.n; c++) { const k = B.keyOf[c]; if (k >= 0 && k < MAXG) V.keyC[k] = c; }
      V.towerOfCell.fill(-1);
      reset();
    }
    function placePiles() {
      const np = V.piles.length;
      V.piles.forEach((p, k) => { p.x = ((k + 0.5) * V.w) / np; p.y = V.rot ? V.h + V.Y * 0.5 : V.h + V.Y - K.crateH * 0.5 - 0.2; });
    }
    function reset() {
      const B = V.B; if (!B) return;
      V.disp.set(V.S.a.subarray(0, B.n)); V.haul.fill(0); V.lastPop = -1;
      V.towerLeft.fill(0); for (let c = 0; c < B.n; c++) { const t = B.towerOf[c]; V.towerOfCell[c] = t; if (t >= 0 && t < MAXT && V.disp[c] > 0) V.towerLeft[t]++; }
      for (let k = 0; k < MAXG; k++) { const gc = B.gateCells[k]; V.gSt[k] = gc && gc.length && V.disp[gc[0]] > 0 ? 0 : 1; V.gT[k] = -1e12; }
      V.tFallT.fill(-1e12); V.shT = -1e12; V.label.t = -1e12; V.win = false; V.winFrom = 1e9;
      V.showOn = false; V.rN = 0; V.rLaunched = 0; V.rDone = 0; V.eN = 0; V.gob.on = false; V.gob.done = false;
      V.popT.fill(-1e12); V.pT.fill(-1e12);
      paintLayer();
    }
    // Fit the canvas into (cssW, cssH): whole device pixels per cell, turned a quarter when that is bigger and allowed.
    function layout(cssW, cssH, dpr, allowRot) {
      if (!V.B) return;
      V.dpr = Math.max(1, Math.min(K.maxDpr, dpr || 1));
      const rows = V.h + V.Y, cu = Math.min(K.maxCellCss, cssW / V.w, cssH / rows), cr = Math.min(K.maxCellCss, cssW / rows, cssH / V.w);
      const rot = !!allowRot && cu < cfg.layout.rotateBelowCss && cr > cu * 1.04;
      const cs = Math.max(2, Math.floor((rot ? cr : cu) * V.dpr)), turned = rot !== V.rot;
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
      const S = V.sprites, cs = V.cs, bx = c % V.w, by = (c / V.w) | 0, x = CX(bx, by) * cs, y = CY(bx, by) * cs, v = V.disp[c];
      V.lg.drawImage(v > 0 ? S.blk[v] : S.gnd[TYPE(v) * 2 + (hash(bx, by) & 1)], x, y);
      const t = V.B.towerOf[c]; if (t >= 0 && v > 0) rim(c, t, x, y);
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
      paintYard(); paintTents(); V.pileDirty = false;
    }
    function paintYard() {
      const cs = V.cs, g2 = V.lg, e = Math.max(1, Math.round(cs * 0.12));
      g2.fillStyle = K.yard; g2.fillStyle = K.yard;
      if (V.rot) { g2.fillRect(V.h * cs, 0, V.Y * cs, V.w * cs); g2.fillStyle = K.yardEdge; g2.fillRect(V.h * cs, 0, e, V.w * cs); }
      else { g2.fillRect(0, V.h * cs, V.w * cs, V.Y * cs); g2.fillStyle = K.yardEdge; g2.fillRect(0, V.h * cs, V.w * cs, e); }
      for (let k = 0; k < V.piles.length; k++) paintPile(k);
    }
    // A crate: wooden frame, filled bottom-up with mini blocks in proportion to the haul; a chip of its colour on the lip
    // (beside it when turned). Upright either way.
    function paintPile(k) {
      const p = V.piles[k], cs = V.cs, g2 = V.lg, S = V.sprites, mb = S.mb, slot = V.w / V.piles.length, bw = Math.max(1, Math.round(cs * 0.14));
      const cw = V.rot ? Math.max(mb * 2 + 4, Math.round(Math.min(V.Y - 0.9, 2.4) * cs)) : Math.max(mb * 2 + 4, Math.round(Math.min(slot * K.crateW, 3) * cs));
      const ch = V.rot ? Math.max(mb * 2 + 4, Math.round(Math.min(slot * K.crateW, K.crateH) * cs)) : Math.round(K.crateH * cs);
      const cx = MX(p.x, p.y) * cs, cy = MY(p.x, p.y) * cs, x = Math.round(cx - cw / 2 + (V.rot ? mb * 0.5 : 0)), y = Math.round(cy - ch / 2);
      g2.fillStyle = K.yard;
      if (V.rot) g2.fillRect(x - bw - mb - 1, y - bw, cw + 2 * bw + mb + 1, ch + 2 * bw); else g2.fillRect(x - bw, y - bw - mb, cw + 2 * bw, ch + 2 * bw + mb);
      g2.fillStyle = K.crateWood[1]; g2.fillRect(x, y, cw, ch);
      const cols = Math.max(1, Math.floor((cw - 2 * bw) / mb)), rows = Math.max(1, Math.floor((ch - bw) / mb)), cap = cols * rows;
      // One mini block per hauled pixel while the colour fits the crate; scaled to the crate when it doesn't.
      const tot = V.total[p.m], fill = !tot ? 0 : tot <= cap ? Math.min(cap, V.haul[p.m]) : Math.min(cap, Math.round((cap * V.haul[p.m]) / tot)), ox = x + Math.round((cw - cols * mb) / 2);
      for (let i = 0; i < fill; i++) g2.drawImage(S.mini[p.m], ox + (i % cols) * mb, y + ch - bw - (1 + ((i / cols) | 0)) * mb);
      g2.fillStyle = K.crateWood[0]; g2.fillRect(x, y + ch - bw, cw, bw); g2.fillRect(x, y, bw, ch); g2.fillRect(x + cw - bw, y, bw, ch);
      g2.fillStyle = K.crateWood[2]; g2.fillRect(x, y + ch - bw, cw, Math.max(1, bw >> 1));
      if (V.rot) g2.drawImage(S.mini[p.m], x - mb - 1, Math.round(cy - mb / 2)); else g2.drawImage(S.mini[p.m], Math.round(cx - mb / 2), y - mb);
    }
    function paintTents() {
      if (!V.camp.length) return;
      const cs = V.cs, g2 = V.lg, T = K.tents; let x0 = 1e9, x1 = -1;
      for (const c of V.camp) { const x = c % V.w; if (x < x0) x0 = x; if (x > x1) x1 = x; }
      // Two small tents on the camp's outer corners (decor only; sappers walk over them).
      for (const tx of [x0, x1]) { const px = CX(tx, V.h - 1) * cs, py = CY(tx, V.h - 1) * cs, s = cs;
        g2.fillStyle = T[2]; g2.beginPath(); g2.moveTo(px + s * 0.5, py + s * 0.05); g2.lineTo(px + s * 0.98, py + s * 0.95); g2.lineTo(px + s * 0.02, py + s * 0.95); g2.closePath(); g2.fill();
        g2.fillStyle = T[0]; g2.beginPath(); g2.moveTo(px + s * 0.5, py + s * 0.15); g2.lineTo(px + s * 0.88, py + s * 0.9); g2.lineTo(px + s * 0.12, py + s * 0.9); g2.closePath(); g2.fill();
        g2.fillStyle = T[1]; g2.fillRect(Math.round(px + s * 0.44), Math.round(py + s * 0.5), Math.max(1, Math.round(s * 0.12)), Math.round(s * 0.4)); }
    }

    // ---- the show -----------------------------------------------------------------------------------------------------
    // Read the tap's event log (S.logOn must have been set before the play). Returns {eats, hits, kills, runners, hitRunners}.
    function startShow(S) {
      fastForward();
      const ev = S.ev, len = S.evLen; let seg = 0, eN = 0, hits = 0, kills = 0, aimAt = -1, aimCell = -1, aimM = 0, aimN = 0, kill = false;
      for (let i = 0; i + 2 < len; i += 3) {
        const t = ev[i], a = ev[i + 1], b = ev[i + 2];
        if (t === EV.EAT) { V.eCell[eN] = a; V.eMat[eN] = b; V.eSeg[eN] = seg; V.eGate[eN] = -1; eN++; }
        else if (t === EV.RESUME) seg++;
        else if (t === EV.GATE && eN > 0) V.eGate[eN - 1] = a;
        else if (t === EV.AIM) { aimAt = eN; aimCell = a; aimM = b; }
        else if (t === EV.HIT) { hits += b; aimN = b; }
        else if (t === EV.KILL) { kills += b; aimN = b; kill = true; }
      }
      V.eN = eN; V.rN = 0; V.rLaunched = 0; V.rDone = 0; V.showT = 0;
      V.stats.hits = hits; V.stats.kills = kills; V.stats.eats = eN;
      V.win = S.status === E.WON; V.winFrom = V.win ? Math.max(0, eN - FX.winFallN) : 1e9;
      const hitK = aimCell >= 0 && aimN > 0 ? Math.min(aimN, SH.hitMax | 0) : 0;
      V.stats.hitRunners = hitK;
      if (!eN && !hitK) { V.showOn = false; V.stats.runners = 0; return V.stats; }
      if (hitK) { V.label.t = -1e12; V.label.text = (kill ? SH.killText : SH.hitText).replace("{n}", aimN); V.label.kill = kill; V.label.w = 0; }
      // Hit runners go out right after the squad's own eats (before any holding-line resume).
      const addHits = () => { for (let h = 0; h < hitK && V.rN < RMAX; h++) { const i = V.rN++; V.rK[i] = kill ? 2 : 1; V.rTgt[i] = aimCell; V.rM[i] = aimM; V.rE0[i] = 0; V.rEn[i] = 0; V.rSeg[i] = 0; V.rSt[i] = 0; V.rPop[i] = 0; } };
      // Deal eats to runners: a batch of `per` consecutive eats of one segment (one colour) each.
      const per = Math.max(1, Math.ceil(eN / Math.max(1, SH.maxRunners)));
      let added = !hitK;
      for (let e = 0; e < eN;) {
        if (!added && e >= aimAt) { addHits(); added = true; }
        let k = 1; while (k < per && e + k < eN && V.eSeg[e + k] === V.eSeg[e]) k++;
        if (V.rN < RMAX) { const i = V.rN++; V.rK[i] = 0; V.rM[i] = V.eMat[e]; V.rE0[i] = e; V.rEn[i] = k; V.rSeg[i] = V.eSeg[e]; V.rSt[i] = 0; V.rPop[i] = 0; }
        else V.rEn[V.rN - 1] += k; // pool full (never at the configured sizes): the last runner takes the rest
        e += k;
      }
      if (!added) addHits();
      const stag = Math.min(SH.staggerMs, (0.45 * SH.capMs) / V.rN);
      for (let i = 0; i < V.rN; i++) V.rT0[i] = i * stag;
      V.wg.set(V.disp.subarray(0, V.n));
      V.showOn = true; V.stats.runners = V.rN;
      return V.stats;
    }
    // BFS from the camp over the working grid's walkable cells.
    function bfs() {
      const n = V.n, w = V.w, h = V.h, wg = V.wg, dist = V.dist, q = V.q; let qh = 0, qt = 0;
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
    // Launch runner i: route crate -> camp -> ground -> the face of its first pixel; timings squeezed into capMs.
    function launch(i) {
      bfs();
      const tgt = V.rK[i] ? V.rTgt[i] : V.eCell[V.rE0[i]], w = V.w, pts = V.rPts[i], cum = V.rCum[i], p = V.piles[Math.max(0, V.pileOf[V.rM[i]])];
      let u = -1, best = 1e9;
      for (let k = 0; k < 4; k++) { const v = nbOf(tgt, k); if (v >= 0 && V.dist[v] >= 0 && V.dist[v] < best) { best = V.dist[v]; u = v; } }
      // Walk the distance field down to the camp, collecting cells target-side first (bounded by the distance).
      let np = 0;
      const put = (x, y) => { pts[np * 2] = x; pts[np * 2 + 1] = y; np++; };
      put(p ? p.x : w / 2, p ? p.y : V.h + V.Y / 2);
      if (u >= 0) {
        const base = np; let c = u, guard = V.dist[u];
        put(c % w + 0.5, ((c / w) | 0) + 0.5);
        while (V.dist[c] > 0 && guard-- >= 0) { let nx = -1; for (let k = 0; k < 4; k++) { const v = nbOf(c, k); if (v >= 0 && V.dist[v] === V.dist[c] - 1) { nx = v; break; } } if (nx < 0) break; c = nx; put(c % w + 0.5, ((c / w) | 0) + 0.5); }
        for (let a = base, b = np - 1; a < b; a++, b--) { const ax = pts[a * 2], ay = pts[a * 2 + 1]; pts[a * 2] = pts[b * 2]; pts[a * 2 + 1] = pts[b * 2 + 1]; pts[b * 2] = ax; pts[b * 2 + 1] = ay; }
        put((u % w + 0.5 + (tgt % w) + 0.5) / 2, (((u / w) | 0) + 0.5 + ((tgt / w) | 0) + 0.5) / 2);
      } else put(tgt % w + 0.5, ((tgt / w) | 0) + 1.2); // no route (can't happen in resolution order): walk straight up to it
      cum[0] = 0; for (let k = 1; k < np; k++) cum[k] = cum[k - 1] + Math.hypot(pts[k * 2] - pts[k * 2 - 2], pts[k * 2 + 1] - pts[k * 2 - 1]);
      V.rNp[i] = np;
      if (V.rK[i]) { launchHit(i, tgt, np); return; }
      // Apply this runner's eats to the working grid, so the next route sees them gone.
      for (let e = V.rE0[i], z = e + V.rEn[i]; e < z; e++) { V.wg[V.eCell[e]] = DIRT; const gt = V.eGate[e]; if (gt >= 0) { const gc = V.B.gateCells[gt]; for (let j = 0; j < gc.length; j++) V.wg[gc[j]] = DIRT; } }
      const walk = cum[np - 1] * SH.walkCellMs, bite = SH.biteMs * Math.min(3, V.rEn[i]), natural = 2 * walk + bite;
      const avail = Math.max(1, SH.capMs - V.rT0[i]), f = natural > avail ? avail / natural : 1;
      V.rArr[i] = V.rT0[i] + walk * f; V.rBite[i] = bite * f; V.rEnd[i] = V.rArr[i] + V.rBite[i] + walk * f; V.rSt[i] = 1;
    }
    // A hit runner stops where its route first enters a standing ring (or at the pixel's face); the arrow meets it there.
    function launchHit(i, tgt, np) {
      const pts = V.rPts[i], cum = V.rCum[i], w = V.w; let dH = cum[np - 1], tw = lowBit(coverNow(tgt));
      for (let k = 1; k < np; k++) { const px = Math.floor(pts[k * 2]), py = Math.floor(pts[k * 2 + 1]); if (px < 0 || py < 0 || px >= w || py >= V.h) continue; const m = coverNow(py * w + px); if (m) { dH = Math.max(0, cum[k] - 0.45); tw = lowBit(m); break; } }
      V.rHitD[i] = dH; V.rTw[i] = Math.max(0, tw);
      const walk = dH * SH.walkCellMs, back = V.rK[i] === 1 ? SH.knockMs + dH * SH.walkCellMs * SH.retreat : SH.hitFallMs, natural = walk + back;
      const avail = Math.max(1, SH.capMs - V.rT0[i]), f = natural > avail ? avail / natural : 1;
      V.rArr[i] = V.rT0[i] + walk * f; V.rBite[i] = (V.rK[i] === 1 ? SH.knockMs : SH.hitFallMs) * f; V.rEnd[i] = V.rT0[i] + natural * f; V.rSt[i] = 1;
      V.rAim[i] = Math.max(1, Math.min(SH.arrowMs, V.rArr[i] - V.rT0[i]));
      along(i, dH, pos); V.rHx[i] = pos[0]; V.rHy[i] = pos[1];
    }
    // Board point at distance d along runner i's route.
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
      V.disp[c] = DIRT; paintCell(c); V.lastPop = c;
      const t = V.towerOfCell[c];
      if (t >= 0 && t < MAXT && V.towerLeft[t] > 0 && --V.towerLeft[t] === 0) {
        V.tFallT[t] = anim ? V.fxT : -1e12;
        if (anim) { shake(FX.towerShake[0], FX.towerShake[1]); if (V.hooks.tower) V.hooks.tower(t); }
      }
      if (anim) {
        const k = V.popHead; V.popHead = (k + 1) % POPS; V.popC[k] = c; V.popM[k] = m; V.popT[k] = V.fxT + (delay || 0); V.popK[k] = kind || 0;
        const bx = c % V.w + 0.5, by = ((c / V.w) | 0) + 0.5, d = delay || 0;
        spawn(MX(bx, by), MY(bx, by), m, FX.crumbs, FX.crumbSize, FX.lift, FX.spread, d); spawn(MX(bx, by), MY(bx, by), 0, FX.dust, FX.dustSize, FX.lift * 0.4, FX.spread * 0.5, d);
      }
    }
    function popEat(e, anim) {
      const fall = e >= V.winFrom;
      popCell(V.eCell[e], V.eMat[e], anim, fall ? 1 : 0, 0);
      const gt = V.eGate[e];
      if (gt >= 0) {
        const gc = V.B.gateCells[gt];
        for (let j = 0; j < gc.length; j++) popCell(gc[j], IRON, anim, 1, anim ? (j + 1) * FX.gateStaggerMs : 0);
        if (gt < MAXG) { V.gSt[gt] = 1; V.gT[gt] = anim ? V.fxT : -1e12; }
        if (anim) { shake(FX.gateShake[0], FX.gateShake[1]); if (V.hooks.gate) V.hooks.gate(gt); }
      }
      if (anim && V.hooks.pop) V.hooks.pop(e, V.eMat[e]);
      // The winning play's last pixel throws a cloud of dust.
      if (anim && V.win && e === V.eN - 1) { const c = V.eCell[e], bx = c % V.w + 0.5, by = ((c / V.w) | 0) + 0.5; spawn(MX(bx, by), MY(bx, by), 0, FX.winDust >> 1, FX.dustSize * 1.4, FX.lift, FX.spread * 1.3); }
    }
    function deposit(i) { const m = V.rM[i]; V.haul[m] += V.rEn[i]; V.pileDirty = true; if (V.hooks.deposit) V.hooks.deposit(m); }
    function shake(amp, ms) { if (V.calm) return; V.shT = V.fxT; V.shMs = Math.max(1, ms); V.shAmp = amp; }
    function update(dt, speed) {
      V.fxT += dt * (speed || 1);
      if (V.gob.on && !V.gob.done && V.clock - V.gob.t0 >= SH.goblinMs) V.gob.done = true;
      if (!V.showOn) return;
      V.showT += dt * (speed || 1);
      const t = V.showT;
      while (V.rLaunched < V.rN && V.rT0[V.rLaunched] <= t) launch(V.rLaunched++);
      for (let i = 0; i < V.rLaunched; i++) {
        const st = V.rSt[i]; if (st === 3) continue;
        if (V.rK[i]) {
          if (V.rPop[i] === 0 && t >= V.rArr[i] - V.rAim[i]) { V.rPop[i] = 1; if (V.hooks.shot) V.hooks.shot(); }
          if (st === 1 && t >= V.rArr[i]) {
            V.rSt[i] = 2; if (V.hooks.hit) V.hooks.hit(V.rK[i]);
            if (V.label.t < V.fxT - SH.labelMs) { V.label.t = V.fxT; V.label.x = V.rHx[i]; V.label.y = V.rHy[i]; V.label.w = 0; }
            const sx = MX(V.rHx[i], V.rHy[i]), sy = MY(V.rHx[i], V.rHy[i]); spawn(sx, sy, 0, FX.dust + 2, FX.dustSize, FX.lift * 0.5, FX.spread * 0.6);
          }
          if (V.rSt[i] === 2 && t >= V.rEnd[i]) { V.rSt[i] = 3; V.rDone++; }
          continue;
        }
        if (t >= V.rArr[i]) {
          const n = V.rEn[i], step = V.rBite[i] / n;
          while (V.rPop[i] < n && t >= V.rArr[i] + step * (V.rPop[i] + 1)) popEat(V.rE0[i] + V.rPop[i]++, true);
          if (V.rPop[i] >= n) V.rSt[i] = 2;
        }
        if (V.rSt[i] === 2 && t >= V.rEnd[i]) { V.rSt[i] = 3; V.rDone++; deposit(i); }
      }
      if (V.rDone >= V.rN) V.showOn = false;
    }
    // Land every remaining pop and haul now (no routes, no animation).
    function fastForward() {
      if (!V.showOn) return false;
      for (let i = 0; i < V.rN; i++) {
        if (V.rSt[i] === 3) continue;
        for (let e = V.rE0[i] + V.rPop[i], z = V.rE0[i] + V.rEn[i]; e < z; e++) popEat(e, false);
        V.rPop[i] = V.rEn[i]; V.rSt[i] = 3; if (!V.rK[i]) deposit(i);
      }
      V.rLaunched = V.rN; V.rDone = V.rN; V.showOn = false; V.popT.fill(-1e12); V.pT.fill(-1e12); V.label.t = -1e12;
      return true;
    }
    // The win: the goblins' keep stands where the last pixel went and comes down (it sinks into its own dust with a shake
    // and the collapse), the crowned goblin scrambles out of the rubble and flees off the top of the board.
    function goblin(on) {
      V.gob.on = !!on; V.gob.done = false; V.gob.t0 = V.clock; const c = V.lastPop >= 0 ? V.lastPop : (V.n >> 1); V.gob.x = (c % V.w) + 0.5; V.gob.y = Math.max(((c / V.w) | 0) + 0.5, SH.keepScale * 0.62);
      if (!on) return;
      shake(FX.winShake[0], FX.winShake[1]); spawn(MX(V.gob.x, V.gob.y + SH.keepScale * 0.35), MY(V.gob.x, V.gob.y + SH.keepScale * 0.35), 0, FX.winDust, FX.dustSize * 1.7, FX.lift, FX.spread * 1.8);
      if (V.hooks.collapse) V.hooks.collapse();
    }

    // ---- drawing ----------------------------------------------------------------------------------------------------
    const dash = [0, 0];
    // Runner i's board position at show time t (hit runners stop at the ring, then are knocked back or fall).
    function position(i, t, out) {
      const L = V.rCum[i][V.rNp[i] - 1];
      let d;
      if (V.rK[i]) {
        const dH = V.rHitD[i];
        if (t < V.rArr[i]) d = ((t - V.rT0[i]) / Math.max(1, V.rArr[i] - V.rT0[i])) * dH;
        else if (V.rK[i] === 2) d = dH;
        else if (t < V.rArr[i] + V.rBite[i]) { const u = (t - V.rArr[i]) / Math.max(1, V.rBite[i]); d = dH - SH.knockCells * (1 - (1 - u) * (1 - u)); }
        else d = Math.max(0, dH - SH.knockCells) * (1 - (t - V.rArr[i] - V.rBite[i]) / Math.max(1, V.rEnd[i] - V.rArr[i] - V.rBite[i]));
      } else if (t < V.rArr[i]) d = ((t - V.rT0[i]) / Math.max(1, V.rArr[i] - V.rT0[i])) * L;
      else if (t < V.rArr[i] + V.rBite[i]) d = L;
      else d = (1 - (t - V.rArr[i] - V.rBite[i]) / Math.max(1, V.rEnd[i] - V.rArr[i] - V.rBite[i])) * L;
      d = Math.max(0, Math.min(L, d));
      along(i, d, out);
      // Jitter fades in off the crate and out at the pixel, so each runner reaches its face.
      const edge = Math.max(0, Math.min(1, d / 1.5, (L - d) / 1.2));
      out[0] += V.rJx[i] * edge; out[1] += V.rJy[i] * edge;
    }
    const pos = new Float32Array(2);
    // Archer k's board spot: on top of its tower, a little north of the centre.
    const archX = (k) => V.B.towers[k].cx + 0.5, archY = (k) => V.B.towers[k].cy + 0.5 - K.archer.lift;
    function draw() {
      if (!V.B || !V.sprites) return;
      const cs = V.cs, S = V.sprites, gx = V.g, t = V.showT, ft = V.fxT, ss = S.ss, mb = S.mb, CW = canvas.width, CH = canvas.height;
      if (V.pileDirty) { for (let k = 0; k < V.piles.length; k++) paintPile(k); V.pileDirty = false; }
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
      // Archer ranges while any pixel of their tower stands on the board; they fade as the tower falls.
      const T = V.B.towers;
      if (T.length) {
        gx.save(); gx.lineWidth = Math.max(1, cs * K.rangeW); dash[0] = cs * K.rangeDash[0]; dash[1] = cs * K.rangeDash[1]; gx.setLineDash(dash);
        gx.fillStyle = K.rangeFill; gx.strokeStyle = K.rangeStroke;
        for (let k = 0; k < T.length && k < MAXT; k++) {
          let al = 1; if (V.towerLeft[k] <= 0) { al = 1 - (ft - V.tFallT[k]) / FX.towerFallMs; if (!(al > 0)) continue; }
          gx.globalAlpha = al; gx.beginPath(); gx.arc(MX(T[k].cx + 0.5, T[k].cy + 0.5) * cs, MY(T[k].cx + 0.5, T[k].cy + 0.5) * cs, T[k].r * cs, 0, Math.PI * 2); gx.fill(); gx.stroke();
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
      const idle = Math.min(K.idle | 0, V.camp.length);
      for (let k = 0; k < idle; k++) {
        const c = V.camp[Math.floor(((k + 0.5) * V.camp.length) / idle)], f = ((V.clock / (SH.stepMs * 3) + k) | 0) & 1, bx = c % V.w + 0.5, by = ((c / V.w) | 0) + 0.5;
        gx.drawImage(S.sap[V.piles.length ? V.piles[k % V.piles.length].m : 1], f * ss, 0, ss, ss, MX(bx, by) * cs - ss / 2, MY(bx, by) * cs - ss / 2, ss, ss);
      }
      // Runners: out empty-handed, back with their batch on their heads. Hit runners: an arrow meets them at the ring.
      let shooting = 0;
      if (V.showOn) for (let i = 0; i < V.rLaunched; i++) {
        if (V.rSt[i] === 3) continue;
        position(i, t, pos);
        const x = MX(pos[0], pos[1]) * cs - ss / 2;
        if (V.rK[i]) {
          const hit = t >= V.rArr[i], u = hit ? (t - V.rArr[i]) / Math.max(1, V.rBite[i]) : 0, f = ((t / SH.stepMs + i) | 0) & 1;
          let y = MY(pos[0], pos[1]) * cs - ss / 2 - (hit ? 0 : f * cs * SH.bob);
          if (!hit && t >= V.rArr[i] - V.rAim[i]) { shooting |= 1 << V.rTw[i]; arrow(i, (t - (V.rArr[i] - V.rAim[i])) / V.rAim[i]); }
          if (V.rK[i] === 2 && hit) { // falls over and fades
            gx.save(); gx.globalAlpha = Math.max(0, Math.min(1, (1 - u) * 2.5)); gx.translate(x + ss / 2, y + ss * 0.9); gx.rotate(Math.min(1, u * 3) * Math.PI / 2); gx.drawImage(S.sap[V.rM[i]], 0, 0, ss, ss, -ss / 2, -ss * 0.9, ss, ss); gx.restore(); continue;
          }
          if (hit && u < 1) { y -= Math.sin(Math.min(1, u) * Math.PI) * cs * 0.5; gx.save(); gx.translate(x + ss / 2, y); gx.scale(-1, 1); gx.drawImage(S.sap[V.rM[i]], f * ss, 0, ss, ss, -ss / 2, 0, ss, ss); gx.restore(); continue; }
          gx.drawImage(S.sap[V.rM[i]], f * ss, 0, ss, ss, x, y, ss, ss);
          continue;
        }
        const back = t >= V.rArr[i] + V.rBite[i], biting = !back && t >= V.rArr[i], f = biting ? 0 : ((t / SH.stepMs + i) | 0) & 1;
        const bob = biting ? Math.abs(Math.sin(t / 60)) * cs * SH.bob * 2 : f * cs * SH.bob;
        const y = MY(pos[0], pos[1]) * cs - ss / 2 - bob;
        gx.drawImage(S.sap[V.rM[i]], f * ss, 0, ss, ss, x, y, ss, ss);
        if (back) { const n = Math.min(3, V.rEn[i]); for (let j = 0; j < n; j++) gx.drawImage(S.mini[V.rM[i]], x + (ss - mb) / 2, y - mb * (j + 0.6)); }
      }
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
      let live = 0, arrows = 0, struck = 0, kind = 0; const t = V.showT;
      for (let i = 0; i < V.rN; i++) { if (!V.rK[i] || V.rSt[i] === 3) continue; live++; kind = V.rK[i]; if (V.rSt[i] === 2) struck++; else if (i < V.rLaunched && t >= V.rArr[i] - V.rAim[i]) arrows++; }
      return { live, arrows, struck, kind, label: V.fxT - V.label.t < SH.labelMs };
    }
    function fxInfo() {
      let pops = 0, falls = 0, parts = 0; const ft = V.fxT;
      for (let k = 0; k < POPS; k++) { const a = (ft - V.popT[k]) / (V.popK[k] ? FX.fallMs : SH.popMs); if (a < 1 && a > -20) { pops++; if (V.popK[k]) falls++; } }
      for (let k = 0; k < PARTS; k++) { const a = (ft - V.pT[k]) / V.pL[k]; if (a >= 0 && a < 1) parts++; }
      return { pops, falls, parts, shaking: (ft - V.shT) / V.shMs < 1, keep: V.gob.on && (V.clock - V.gob.t0) / (SH.goblinMs * SH.keepFrac) < 1, gates: Array.from(V.gSt.subarray(0, V.B ? V.B.gateCells.length : 0)), lockFalling: V.B ? V.B.gateCells.some((_, k) => V.gSt[k] === 1 && ft - V.gT[k] < FX.lockFallMs) : false };
    }

    Object.assign(V, { setLevel, reset, layout, startShow, update, fastForward, goblin, draw, checkSprites, buildSprites, paintLayer, shake, cssAt, hitInfo, fxInfo,
      idle: () => !V.showOn, chip: (m, px) => block(m, px), man: (m, px) => sapper(m, px) });
    return V;
  }

  return { create, shade, lum, mark };
});
