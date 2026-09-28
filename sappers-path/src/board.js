// Sapper's Path v3 board (SPEC-v3 §6): the fort as Food Hunt blocks, the siege yard with a haul crate per colour, and the
// run-and-carry show. Presentation only: the engine has already resolved the tap; the show replays its event log.
//
// Look. Every material pixel is a rounded, bevelled block with a stud glint and a per-material mark (bar, posts, hatch,
// dots, cross, chevron, diamond...), so the fort still reads in grayscale; iron gates are barred, Gilt keys carry a key
// glyph. Ground and water are dark and muted. Below the grid is the yard: one crate per colour that fills with the haul.
// Sprite caches (blocks, ground, mini blocks) are opaque by construction (a grout or ground fill under everything);
// sappers and the goblin are the only transparent sprites.
//
// Show. startShow(S) reads the log of the tap just played: EAT cells in resolution order, split into segments (the squad,
// then each holding-line resume). The eats are dealt to at most show.maxRunners runners (a runner takes a batch of
// consecutive eats of one segment), staggered so they leave the yard in lines. A runner's route is found when it
// launches: a BFS from the camp over the ground as it will be once every earlier runner's eats are gone, so it walks
// round walls, never through them. It walks crate -> camp -> route -> the pixel, bites its batch (each pixel pops off
// the board), and carries the blocks back to its colour's crate. Every runner is sped up just enough to finish inside
// show.capMs, so a play never runs longer than that at 1x. fastForward() lands every remaining pop and haul at once (a
// new tap, a board tap, or selfTest), with no BFS. Time is the page's sim clock passed to update(); nothing here reads
// a real clock. Per-frame work allocates nothing: runners, routes and pops live in typed arrays sized once.
(function (root, factory) {
  (root.SappersPath = root.SappersPath || {}).board = factory(root.SappersPath.engine);
})(window, function (E) {
  "use strict";
  const { GRASS, WATER, DIRT, CAMP, IRON, GILT, EV } = E;
  const POPS = 512;

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

  function create(canvas, cfg, sheets) {
    const C = cfg.v3, K = cfg.board, SH = cfg.show, g = canvas.getContext("2d", { alpha: false });
    const V = {
      canvas, g, cfg, B: null, S: null, w: 0, h: 0, n: 0, cs: 0, dpr: 1, Y: K.yardRows | 0,
      disp: null, wg: null, dist: null, q: null, layer: null, lg: null, sprites: null, piles: [], pileOf: new Int16Array(E.NMAT).fill(-1),
      haul: new Int32Array(E.NMAT), total: new Int32Array(E.NMAT), towerLeft: new Int32Array(8), towerOfCell: null,
      clock: 0, speed: 1, rebuilds: 0, lastPop: -1, pileDirty: true,
      // show
      showOn: false, showT: 0, eN: 0, eCell: null, eMat: null, eSeg: null, eGate: null,
      rN: 0, rLaunched: 0, rDone: 0, rM: null, rE0: null, rEn: null, rT0: null, rArr: null, rBite: null, rEnd: null, rPop: null,
      rSt: null, rPts: [], rCum: [], rNp: null, rSeg: null, rJx: null, rJy: null, maxPts: 0, stats: { hits: 0, kills: 0, eats: 0, runners: 0 },
      popC: new Int32Array(POPS), popM: new Int8Array(POPS), popT: new Float64Array(POPS), popHead: 0,
      gob: { on: false, t0: 0, x: 0, y: 0, done: false },
      hooks: { pop: null, deposit: null },
    };
    const RMAX = Math.max(1, SH.maxRunners | 0) * 2;
    V.rM = new Int8Array(RMAX); V.rE0 = new Int32Array(RMAX); V.rEn = new Int32Array(RMAX); V.rT0 = new Float64Array(RMAX);
    V.rArr = new Float64Array(RMAX); V.rBite = new Float64Array(RMAX); V.rEnd = new Float64Array(RMAX); V.rPop = new Int32Array(RMAX);
    V.rSt = new Int8Array(RMAX); V.rNp = new Int32Array(RMAX); V.rSeg = new Int32Array(RMAX); V.rJx = new Float32Array(RMAX); V.rJy = new Float32Array(RMAX);
    for (let i = 0; i < RMAX; i++) { const u = hash(i, 91) / 4294967296, v = hash(i, 37) / 4294967296; V.rJx[i] = (u - 0.5) * 2 * SH.jitter; V.rJy[i] = (v - 0.5) * 2 * SH.jitter; }
    const TYPE = (v) => (v === GRASS ? 0 : v === DIRT ? 1 : v === CAMP ? 2 : 3);

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
    // Sapper: an 8x8 figure (helmet in the crew's colour, goblin-green face, dark tunic), two walk frames, scaled up
    // crisp. Transparent around the figure.
    const SAP = [["..hhhh..", ".hhhhhh.", ".sesses.", "..ssss..", ".bbbbbb.", "b.bbbb.b", "..b..b..", "..b..b.."],
                 ["..hhhh..", ".hhhhhh.", ".sesses.", "..ssss..", ".bbbbbb.", "b.bbbb.b", ".b....b.", "b......b"]];
    function sapper(m, ss) {
      const lo = mk(16, 8), x = lo.getContext("2d"), P = { h: C.mats[m].c, s: K.sapper.skin, e: K.sapper.eye, b: K.sapper.body };
      for (let f = 0; f < 2; f++) for (let y = 0; y < 8; y++) for (let k = 0; k < 8; k++) { const ch = SAP[f][y][k]; if (ch === ".") continue; x.fillStyle = P[ch]; x.fillRect(f * 8 + k, y, 1, 1); }
      const c = mk(ss * 2, ss), cx = c.getContext("2d"); cx.imageSmoothingEnabled = false; cx.drawImage(lo, 0, 0, 16, 8, 0, 0, ss * 2, ss); return c;
    }
    function buildSprites() {
      const s = V.cs, ss = Math.max(6, Math.round(s * K.sapper.scale)), mb = Math.max(3, Math.round(s * K.sapper.carry));
      const S = { blk: [], mini: [], sap: [], gnd: [], ss, mb };
      for (let m = 1; m < E.NMAT; m++) { S.blk[m] = block(m, s); S.mini[m] = block(m, mb); S.sap[m] = sapper(m, ss); }
      for (let t = 0; t < 4; t++) for (let v = 0; v < 2; v++) S.gnd[t * 2 + v] = ground(t, v, s);
      V.sprites = S; V.rebuilds++;
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
      const np = V.piles.length; V.piles.forEach((p, k) => { p.x = ((k + 0.5) * B.w) / np; p.y = B.h + V.Y - K.crateH * 0.5 - 0.2; });
      // Camp cells for idle sappers and the tents.
      V.camp = []; for (let c = 0; c < B.n; c++) if (B.a0[c] === CAMP) V.camp.push(c);
      V.towerOfCell.fill(-1);
      reset();
    }
    function reset() {
      const B = V.B; if (!B) return;
      V.disp.set(V.S.a.subarray(0, B.n)); V.haul.fill(0); V.lastPop = -1;
      V.towerLeft.fill(0); for (let c = 0; c < B.n; c++) { const t = B.towerOf[c]; V.towerOfCell[c] = t; if (t >= 0 && V.disp[c] > 0) V.towerLeft[t]++; }
      V.showOn = false; V.rN = 0; V.rLaunched = 0; V.rDone = 0; V.eN = 0; V.gob.on = false; V.gob.done = false;
      V.popT.fill(-1e12);
      paintLayer();
    }
    // Fit the canvas into (cssW, cssH): whole device pixels per cell.
    function layout(cssW, cssH, dpr) {
      if (!V.B) return;
      V.dpr = Math.max(1, Math.min(K.maxDpr, dpr || 1));
      const rows = V.h + V.Y, cssCell = Math.min(K.maxCellCss, cssW / V.w, cssH / rows), cs = Math.max(2, Math.floor(cssCell * V.dpr));
      const fresh = cs !== V.cs || !V.sprites;
      if (fresh) { V.cs = cs; buildSprites(); }
      if (fresh || canvas.width !== V.w * cs || canvas.height !== rows * cs) {
        canvas.width = V.w * cs; canvas.height = rows * cs;
        canvas.style.width = (V.w * cs) / V.dpr + "px"; canvas.style.height = (rows * cs) / V.dpr + "px";
        paintLayer();
      }
    }
    function paintCell(c) {
      const S = V.sprites, cs = V.cs, x = (c % V.w) * cs, y = ((c / V.w) | 0) * cs, v = V.disp[c];
      V.lg.drawImage(v > 0 ? S.blk[v] : S.gnd[TYPE(v) * 2 + (hash(c % V.w, (c / V.w) | 0) & 1)], x, y);
    }
    function paintLayer() {
      if (!V.B || !V.sprites) return;
      const cs = V.cs, W = V.w * cs, H = (V.h + V.Y) * cs;
      if (!V.layer) { V.layer = mk(W, H); V.lg = V.layer.getContext("2d", { alpha: false }); }
      if (V.layer.width !== W || V.layer.height !== H) { V.layer.width = W; V.layer.height = H; }
      const g2 = V.lg; g2.imageSmoothingEnabled = false;
      for (let c = 0; c < V.n; c++) paintCell(c);
      paintYard(); paintTents(); V.pileDirty = false;
    }
    function paintYard() {
      const cs = V.cs, g2 = V.lg, y0 = V.h * cs, W = V.w * cs;
      g2.fillStyle = K.yard; g2.fillRect(0, y0, W, V.Y * cs);
      g2.fillStyle = K.yardEdge; g2.fillRect(0, y0, W, Math.max(1, Math.round(cs * 0.12)));
      for (let k = 0; k < V.piles.length; k++) paintPile(k);
    }
    // A crate: wooden frame, filled bottom-up with mini blocks in proportion to the haul; a chip of its colour on the lip.
    function paintPile(k) {
      const p = V.piles[k], cs = V.cs, g2 = V.lg, S = V.sprites, mb = S.mb, slot = V.w / V.piles.length;
      const cw = Math.max(mb * 2 + 4, Math.round(Math.min(slot * K.crateW, 3) * cs)), ch = Math.round(K.crateH * cs), x = Math.round(p.x * cs - cw / 2), y = Math.round(p.y * cs - ch / 2);
      const bw = Math.max(1, Math.round(cs * 0.14));
      g2.fillStyle = K.yard; g2.fillRect(x - bw, y - bw - mb, cw + 2 * bw, ch + 2 * bw + mb);
      g2.fillStyle = K.crateWood[1]; g2.fillRect(x, y, cw, ch);
      const cols = Math.max(1, Math.floor((cw - 2 * bw) / mb)), rows = Math.max(1, Math.floor((ch - bw) / mb)), cap = cols * rows;
      // One mini block per hauled pixel while the colour fits the crate; scaled to the crate when it doesn't.
      const tot = V.total[p.m], fill = !tot ? 0 : tot <= cap ? Math.min(cap, V.haul[p.m]) : Math.min(cap, Math.round((cap * V.haul[p.m]) / tot)), ox = x + Math.round((cw - cols * mb) / 2);
      for (let i = 0; i < fill; i++) g2.drawImage(S.mini[p.m], ox + (i % cols) * mb, y + ch - bw - (1 + ((i / cols) | 0)) * mb);
      g2.fillStyle = K.crateWood[0]; g2.fillRect(x, y + ch - bw, cw, bw); g2.fillRect(x, y, bw, ch); g2.fillRect(x + cw - bw, y, bw, ch);
      g2.fillStyle = K.crateWood[2]; g2.fillRect(x, y + ch - bw, cw, Math.max(1, bw >> 1));
      g2.drawImage(S.mini[p.m], Math.round(p.x * cs - mb / 2), y - mb);
    }
    function paintTents() {
      if (!V.camp.length) return;
      const cs = V.cs, g2 = V.lg, T = K.tents; let x0 = 1e9, x1 = -1, y0 = 1e9;
      for (const c of V.camp) { const x = c % V.w, y = (c / V.w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; }
      // Two small tents on the camp's outer corners (decor only; sappers walk over them).
      for (const tx of [x0, x1]) { const px = tx * cs, py = (V.h - 1) * cs, s = cs;
        g2.fillStyle = T[2]; g2.beginPath(); g2.moveTo(px + s * 0.5, py + s * 0.05); g2.lineTo(px + s * 0.98, py + s * 0.95); g2.lineTo(px + s * 0.02, py + s * 0.95); g2.closePath(); g2.fill();
        g2.fillStyle = T[0]; g2.beginPath(); g2.moveTo(px + s * 0.5, py + s * 0.15); g2.lineTo(px + s * 0.88, py + s * 0.9); g2.lineTo(px + s * 0.12, py + s * 0.9); g2.closePath(); g2.fill();
        g2.fillStyle = T[1]; g2.fillRect(Math.round(px + s * 0.44), Math.round(py + s * 0.5), Math.max(1, Math.round(s * 0.12)), Math.round(s * 0.4)); }
    }

    // ---- the show -----------------------------------------------------------------------------------------------------
    // Read the tap's event log (S.logOn must have been set before the play). Returns {eats, hits, kills, runners}.
    function startShow(S) {
      fastForward();
      const ev = S.ev, len = S.evLen; let seg = 0, eN = 0, hits = 0, kills = 0;
      for (let i = 0; i + 2 < len; i += 3) {
        const t = ev[i], a = ev[i + 1], b = ev[i + 2];
        if (t === EV.EAT) { V.eCell[eN] = a; V.eMat[eN] = b; V.eSeg[eN] = seg; V.eGate[eN] = -1; eN++; }
        else if (t === EV.RESUME) seg++;
        else if (t === EV.GATE && eN > 0) V.eGate[eN - 1] = a;
        else if (t === EV.HIT) hits += b;
        else if (t === EV.KILL) kills += b;
      }
      V.eN = eN; V.rN = 0; V.rLaunched = 0; V.rDone = 0; V.showT = 0;
      V.stats.hits = hits; V.stats.kills = kills; V.stats.eats = eN;
      if (!eN) { V.showOn = false; V.stats.runners = 0; return V.stats; }
      // Deal eats to runners: a batch of `per` consecutive eats of one segment (one colour) each.
      const per = Math.max(1, Math.ceil(eN / Math.max(1, SH.maxRunners)));
      for (let e = 0; e < eN;) {
        let k = 1; while (k < per && e + k < eN && V.eSeg[e + k] === V.eSeg[e]) k++;
        if (V.rN < RMAX) { V.rM[V.rN] = V.eMat[e]; V.rE0[V.rN] = e; V.rEn[V.rN] = k; V.rSeg[V.rN] = V.eSeg[e]; V.rSt[V.rN] = 0; V.rPop[V.rN] = 0; V.rN++; }
        else V.rEn[V.rN - 1] += k; // pool full (never at the configured sizes): the last runner takes the rest
        e += k;
      }
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
    // Launch runner i: route crate -> camp -> ground -> the face of its first pixel; timings squeezed into capMs.
    function launch(i) {
      bfs();
      const tgt = V.eCell[V.rE0[i]], w = V.w, pts = V.rPts[i], cum = V.rCum[i], p = V.piles[Math.max(0, V.pileOf[V.rM[i]])];
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
      // Apply this runner's eats to the working grid, so the next route sees them gone.
      for (let e = V.rE0[i], z = e + V.rEn[i]; e < z; e++) { V.wg[V.eCell[e]] = DIRT; const gt = V.eGate[e]; if (gt >= 0) { const gc = V.B.gateCells[gt]; for (let j = 0; j < gc.length; j++) V.wg[gc[j]] = DIRT; } }
      const walk = cum[np - 1] * SH.walkCellMs, bite = SH.biteMs * Math.min(3, V.rEn[i]), natural = 2 * walk + bite;
      const avail = Math.max(1, SH.capMs - V.rT0[i]), f = natural > avail ? avail / natural : 1;
      V.rArr[i] = V.rT0[i] + walk * f; V.rBite[i] = bite * f; V.rEnd[i] = V.rArr[i] + V.rBite[i] + walk * f; V.rSt[i] = 1;
    }
    function popCell(c, m, anim) {
      if (V.disp[c] <= 0) return;
      V.disp[c] = DIRT; paintCell(c); V.lastPop = c;
      const t = V.towerOfCell[c]; if (t >= 0 && V.towerLeft[t] > 0) V.towerLeft[t]--;
      if (anim) { const k = V.popHead; V.popHead = (k + 1) % POPS; V.popC[k] = c; V.popM[k] = m; V.popT[k] = V.showT; }
    }
    function popEat(e, anim) {
      popCell(V.eCell[e], V.eMat[e], anim);
      const gt = V.eGate[e];
      if (gt >= 0) { const gc = V.B.gateCells[gt]; for (let j = 0; j < gc.length; j++) popCell(gc[j], IRON, anim); }
      if (anim && V.hooks.pop) V.hooks.pop(e, V.eMat[e]);
    }
    function deposit(i) { const m = V.rM[i]; V.haul[m] += V.rEn[i]; V.pileDirty = true; if (V.hooks.deposit) V.hooks.deposit(m); }
    function update(dt, speed) {
      if (V.gob.on && !V.gob.done && V.clock - V.gob.t0 >= SH.goblinMs) V.gob.done = true;
      if (!V.showOn) return;
      V.showT += dt * (speed || 1);
      const t = V.showT;
      while (V.rLaunched < V.rN && V.rT0[V.rLaunched] <= t) launch(V.rLaunched++);
      for (let i = 0; i < V.rLaunched; i++) {
        const st = V.rSt[i]; if (st === 3) continue;
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
        V.rPop[i] = V.rEn[i]; V.rSt[i] = 3; deposit(i);
      }
      V.rLaunched = V.rN; V.rDone = V.rN; V.showOn = false; V.popT.fill(-1e12);
      return true;
    }
    // The crowned goblin flees from the last pixel off the top of the board.
    function goblin(on) { V.gob.on = !!on; V.gob.done = false; V.gob.t0 = V.clock; const c = V.lastPop >= 0 ? V.lastPop : (V.n >> 1); V.gob.x = (c % V.w) + 0.5; V.gob.y = ((c / V.w) | 0) + 0.5; }

    // ---- drawing ----------------------------------------------------------------------------------------------------
    const dash = [0, 0];
    function position(i, t, out) {
      const pts = V.rPts[i], cum = V.rCum[i], np = V.rNp[i], L = cum[np - 1];
      let d;
      if (t < V.rArr[i]) d = ((t - V.rT0[i]) / Math.max(1, V.rArr[i] - V.rT0[i])) * L;
      else if (t < V.rArr[i] + V.rBite[i]) d = L;
      else d = (1 - (t - V.rArr[i] - V.rBite[i]) / Math.max(1, V.rEnd[i] - V.rArr[i] - V.rBite[i])) * L;
      d = Math.max(0, Math.min(L, d));
      let k = 1; while (k < np - 1 && cum[k] < d) k++;
      const a = cum[k - 1], b = cum[k], f = b > a ? (d - a) / (b - a) : 0;
      out[0] = pts[k * 2 - 2] + (pts[k * 2] - pts[k * 2 - 2]) * f; out[1] = pts[k * 2 - 1] + (pts[k * 2 + 1] - pts[k * 2 - 1]) * f;
      // Jitter fades in off the crate and out at the pixel, so each runner reaches its face.
      const edge = Math.min(1, d / 1.5, (L - d) / 1.2);
      out[0] += V.rJx[i] * edge; out[1] += V.rJy[i] * edge;
    }
    const pos = new Float32Array(2);
    function draw() {
      if (!V.B || !V.sprites) return;
      const cs = V.cs, S = V.sprites, gx = V.g, t = V.showT, ss = S.ss, mb = S.mb;
      if (V.pileDirty) { for (let k = 0; k < V.piles.length; k++) paintPile(k); V.pileDirty = false; }
      gx.imageSmoothingEnabled = false;
      gx.drawImage(V.layer, 0, 0);
      // Archer ranges while any pixel of their tower stands on the board.
      const T = V.B.towers;
      if (T.length) {
        gx.save(); gx.lineWidth = Math.max(1, cs * K.rangeW); dash[0] = cs * K.rangeDash[0]; dash[1] = cs * K.rangeDash[1]; gx.setLineDash(dash);
        gx.fillStyle = K.rangeFill; gx.strokeStyle = K.rangeStroke;
        for (let k = 0; k < T.length; k++) { if (V.towerLeft[k] <= 0) continue; gx.beginPath(); gx.arc((T[k].cx + 0.5) * cs, (T[k].cy + 0.5) * cs, T[k].r * cs, 0, Math.PI * 2); gx.fill(); gx.stroke(); }
        gx.restore();
      }
      // Pops: the block swells and fades off the board.
      for (let k = 0; k < POPS; k++) {
        const a = (t - V.popT[k]) / SH.popMs; if (a < 0 || a >= 1) continue;
        const c = V.popC[k], sc = 1 + SH.popSwell * a, sz = cs * sc, x = (c % V.w) * cs + cs / 2, y = ((c / V.w) | 0) * cs + cs / 2 - a * cs * 0.6;
        gx.globalAlpha = 1 - a; gx.drawImage(S.blk[V.popM[k]], x - sz / 2, y - sz / 2, sz, sz);
      }
      gx.globalAlpha = 1;
      // Idle sappers at the camp.
      const idle = Math.min(K.idle | 0, V.camp.length);
      for (let k = 0; k < idle; k++) {
        const c = V.camp[Math.floor(((k + 0.5) * V.camp.length) / idle)], f = ((V.clock / (SH.stepMs * 3) + k) | 0) & 1;
        gx.drawImage(S.sap[V.piles.length ? V.piles[k % V.piles.length].m : 1], f * ss, 0, ss, ss, (c % V.w + 0.5) * cs - ss / 2, (((c / V.w) | 0) + 0.5) * cs - ss / 2, ss, ss);
      }
      // Runners: out empty-handed, back with their batch on their heads.
      if (V.showOn) for (let i = 0; i < V.rLaunched; i++) {
        if (V.rSt[i] === 3) continue;
        position(i, t, pos);
        const back = t >= V.rArr[i] + V.rBite[i], biting = !back && t >= V.rArr[i], f = biting ? 0 : ((t / SH.stepMs + i) | 0) & 1;
        const bob = biting ? Math.abs(Math.sin(t / 60)) * cs * SH.bob * 2 : f * cs * SH.bob;
        const x = pos[0] * cs - ss / 2, y = pos[1] * cs - ss / 2 - bob;
        gx.drawImage(S.sap[V.rM[i]], f * ss, 0, ss, ss, x, y, ss, ss);
        if (back) { const n = Math.min(3, V.rEn[i]); for (let j = 0; j < n; j++) gx.drawImage(S.mini[V.rM[i]], x + (ss - mb) / 2, y - mb * (j + 0.6)); }
      }
      // The goblin king: a startled hop on the spot where the last pixel went (taunt frames), then he runs off the top.
      if (V.gob.on && sheets) {
        const a = (V.clock - V.gob.t0) / SH.goblinMs, G = 16, sz = Math.round(cs * SH.goblinScale), stand = SH.goblinStand;
        if (a < 1) {
          const run = Math.max(0, (a - stand) / (1 - stand)), y0 = Math.max(V.gob.y, (SH.goblinScale * 0.5)), hop = run > 0 ? 0 : Math.abs(Math.sin(V.clock / 80)) * 0.35;
          const y = (y0 - hop - (run * (1 - stand) * SH.goblinMs * SH.goblinSpeedCells) / 1000) * cs, fr = run > 0 ? ((V.clock / 90) | 0) & 3 : 4 + (((V.clock / 150) | 0) & 1);
          gx.drawImage(sheets.s4, fr * G, 0, G, G, Math.round(V.gob.x * cs - sz / 2), Math.round(y - sz / 2), sz, sz);
        }
      }
    }

    Object.assign(V, { setLevel, reset, layout, startShow, update, fastForward, goblin, draw, checkSprites, buildSprites, paintLayer,
      idle: () => !V.showOn, chip: (m, px) => block(m, px), man: (m, px) => sapper(m, px) });
    return V;
  }

  return { create, shade, lum, mark };
});
