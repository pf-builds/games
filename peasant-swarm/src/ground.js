// Peasant Swarm — ground chunk painter (SPEC-v2 §2, §11). Click it! Studios, 2026.
// Paints one 512 world px chunk at art resolution (1 canvas px = 1 art px = 2 world px) from the map's typed arrays: every pixel is a
// palette index (PS.PAL ramps only) plus a shadow flag, turned into RGBA through one lookup table and written with putImageData into a
// FRESH buffer (the typed arrays are the truth; nothing is ever read back from a cached canvas, studio lesson 27). Then decals, pines on
// the high rim and the stepping stones' neighbours are drawn on top at 1:1. Water chunks get a second frame (foam and sparkles move).
//   ground:   macro colour patches (meadow / rocky olive-grey / highland) from low-frequency value noise, dithered 4x4 Bayer borders, blade
//             speckles; passes, canyons and crossings' landings on the earth ramp with cracks and pebbles; pixel trails between camps.
//   cliffs:   quarter-cell (dual-grid) autotiling from the 32 px grid: convex corners rounded, inner corners square, so the art never leaves
//             the blocked footprint. Two levels (rock at least art.highCells deep is the high plateau). A top (highland or stone), a
//             one-cell south face in 3 strata with a lit lip and a dark base line, darker east / west rims, a drop shadow baked south-east.
//   water:    three tones by shore distance (bilinear SDF), a broken foam line, sparkle dashes; fords as a sand bar with stepping stones;
//             bridges with a plank deck, rails and posts, and a shadow strip on the water below.
// Render-side only: no S.rng, no Math.random. Deterministic from the map (m.used) so the same seed paints the same valley.
(function () {
  const PS = (window.PS = window.PS || {});
  let LB = null, LT = null, PAL = null, LUT = null, SLUT = null, K = null, AP = 0, IA = null, IB = null, SH = null, KB = null, imgA = null, imgB = null, U32A = null, U32B = null;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const hash = (i, j, s) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
  const h01 = (i, j, s) => hash(i, j, s) / 4294967296;
  function vnoise(x, y, p, s) {
    const fx = x / p, fy = y / p, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
    const a = h01(i, j, s), b = h01(i + 1, j, s), c = h01(i, j + 1, s), d = h01(i + 1, j + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  // the index table: each ramp's colours, and for each index the colour a cast shadow turns it into (two steps down its own ramp; the
  // darkest steps get a derived deeper shade). Built once.
  function table() {
    if (LUT) return;
    PAL = PS.PAL; const cols = [], shadowOf = [], K0 = {};
    const add = (name, ramp) => { K0[name] = []; ramp.forEach((c) => { K0[name].push(cols.length); cols.push(c); }); };
    add("grass", PAL.grass); add("rocky", PAL.rocky); add("high", PAL.high); add("plateau", PAL.plateau); add("stone", PAL.stone); add("earth", PAL.earth);
    add("water", PAL.water); add("foam", [PAL.foam]); add("sand", PAL.sand); add("wood", PAL.wood);
    const deep = {}; for (const k in K0) { const r = K0[k]; deep[k] = cols.length; cols.push(PAL.shade(cols[r[0]], 0.7)); }
    for (const k in K0) { const r = K0[k]; r.forEach((idx, s) => { shadowOf[idx] = s >= 2 ? r[s - 2] : deep[k]; }); shadowOf[deep[k]] = deep[k]; }
    shadowOf[K0.foam[0]] = K0.water[1];
    LUT = new Uint32Array(cols.length); SLUT = new Uint32Array(cols.length);
    const pack = (h) => { const [r, g, b] = PAL.rgb(h); return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; }; // little-endian RGBA
    cols.forEach((c, i) => { LUT[i] = pack(c); SLUT[i] = pack(cols[shadowOf[i]]); });
    K = K0; K.cols = cols;
  }
  function buffers(ap) {
    if (AP === ap) return; AP = ap; const n = ap * ap;
    IA = new Uint8Array(n); IB = new Uint8Array(n); SH = new Uint8Array(n); KB = new Uint8Array(n);
    imgA = new ImageData(ap, ap); imgB = new ImageData(ap, ap); U32A = new Uint32Array(imgA.data.buffer); U32B = new Uint32Array(imgB.data.buffer);
  }

  // per-map art data (once): rock level per cell (1 plateau, 2 high: at least art.highCells deep) and, for ford and bridge cells, the
  // crossing they belong to (its position along the river, its half width) for stones, planks and rails
  function mapArt(m, A) {
    if (m.art) return m.art;
    const N = m.N, NN = N * N, cell = m.cell, lvl = new Uint8Array(NN), xs = new Float32Array(NN), xh = new Float32Array(NN), hi = (A.highCells - 0.5) * cell, W2 = m.W / 2;
    for (let c = 0; c < NN; c++) if (m.terr[c] === 1) lvl[c] = -m.sdf[c] >= hi ? 2 : 1;
    const R = m.river;
    if (R) for (let c = 0; c < NN; c++) {
      const t = m.terr[c]; if (t !== 3 && t !== 4) continue;
      const x = ((c % N) + 0.5) * cell - W2, y = (((c / N) | 0) + 0.5) * cell - W2, a = x * R.dx + y * R.dy; let best = 1e9;
      for (const q of R.crossings) { const d = Math.abs(a - q.s); if (d < best) { best = d; xs[c] = q.s; xh[c] = (q.w * cell) / 2; } }
    }
    return (m.art = { lvl, xs, xh, salt: (m.used | 0) ^ 0x5a17 });
  }
  // biome and tone at a world point (render-only): the obstacles pick pines on highland with the same field the ground uses
  function biome(m, x, y, A) { const s = mapArt(m, A).salt; return vnoise(x, y, A.biomePeriod, s); }

  // paint(cvA, cvB, m, ci, o): o = { n: chunks per side, CH: chunk world px, AP: art px, A: cfg.art, trails, decals, spr }
  function paint(cvA, cvB, m, ci, o) {
    table(); buffers(o.AP);
    const A = o.A, ART = mapArt(m, A), N = m.N, cell = m.cell, terr = m.terr, sdf = m.sdf, lvl = ART.lvl, pm = m.passMask, W = m.W, W2 = W / 2, R = m.river;
    const CH = o.CH, n = o.n, wx = (ci % n) * CH, wy = ((ci / n) | 0) * CH, ap = o.AP, salt = ART.salt, water = !!cvB;
    const G = K.grass, RK = K.rocky, HG = K.high, PL = K.plateau, ST = K.stone, E = K.earth, WA = K.water, FOAM = K.foam[0], SA = K.sand, WD = K.wood;
    const LV = (i, j) => (i < 0 || j < 0 || i >= N || j >= N ? 2 : lvl[j * N + i]);
    const TR = (i, j) => (i < 0 || j < 0 || i >= N || j >= N ? 1 : terr[j * N + i]);
    const SD = (i, j) => sdf[(j < 0 ? 0 : j >= N ? N - 1 : j) * N + (i < 0 ? 0 : i >= N ? N - 1 : i)];
    const PM = (i, j) => (i < 0 || j < 0 || i >= N || j >= N ? 0 : pm[j * N + i]);
    const cr = A.cornerR, cr2 = cr * cr, shx = A.shadow[0] * 2, shy = A.shadow[1] * 2, sparkleK = A.sparkle;
    // the level a world point shows (cell level, rounded convex corners): for cast shadows
    const levelAt = (X, Y) => {
      if (X < 0 || Y < 0 || X >= W || Y >= W) return 2;
      const i = (X / cell) | 0, j = (Y / cell) | 0, L = lvl[j * N + i]; if (!L) return 0;
      const lx = ((X - i * cell) / 2) | 0, ly = ((Y - j * cell) / 2) | 0; return inShape(i, j, lx, ly, L) ? L : inShape(i, j, lx, ly, 1) ? 1 : 0;
    };
    // water's own rounded shape: convex corners of the river (ford and bridge cells count as river) are painted as bank, inside the footprint
    const WET = (i, j) => { const t = TR(i, j); return t === 2 || t === 3 || t === 4; };
    function inWater(i, j, lx, ly) {
      const hx = lx >= 8 ? 1 : -1, hy = ly >= 8 ? 1 : -1;
      if (WET(i + hx, j) || WET(i, j + hy)) return true;
      const dx = hx > 0 ? lx + 0.5 - 8 : 8 - lx - 0.5, dy = hy > 0 ? ly + 0.5 - 8 : 8 - ly - 0.5; return dx * dx + dy * dy <= cr2;
    }
    function inShape(i, j, lx, ly, L) {
      const hx = lx >= 8 ? 1 : -1, hy = ly >= 8 ? 1 : -1;
      if (LV(i + hx, j) >= L || LV(i, j + hy) >= L) return true;
      const dx = hx > 0 ? lx + 0.5 - 8 : 8 - lx - 0.5, dy = hy > 0 ? ly + 0.5 - 8 : 8 - ly - 0.5; return dx * dx + dy * dy <= cr2;
    }
    // macro patches: a lattice every 8 art px (bilinear per pixel): b = biome (rocky < lo, highland > hi), v = tone within the ramp
    const LS = 8, LN = ap / LS + 1; if (!LB || LB.length !== LN * LN) { LB = new Float32Array(LN * LN); LT = new Float32Array(LN * LN); }
    for (let j = 0; j < LN; j++) for (let i = 0; i < LN; i++) { const X = wx + i * LS * 2, Y = wy + j * LS * 2; LB[j * LN + i] = vnoise(X, Y, A.biomePeriod, salt); LT[j * LN + i] = 0.65 * vnoise(X, Y, A.tonePeriod, salt + 7) + 0.35 * vnoise(X, Y, A.tonePeriod / 3, salt + 9); }

    const c0 = Math.floor(wx / cell), r0 = Math.floor(wy / cell), per = CH / cell, apc = cell / 2; // cells per chunk side, art px per cell
    for (let cj = 0; cj < per; cj++) for (let cii = 0; cii < per; cii++) {
      const i = c0 + cii, j = r0 + cj, c = j * N + i, t = terr[c], L = lvl[c];
      const lS = LV(i, j + 1), lE = LV(i + 1, j), lW = LV(i - 1, j), lN = LV(i, j - 1); // neighbour levels: a face where the south one is lower, rims where east / west are
      // bilinear corner values (cell centres) for the pass floor and the water depth
      const p00 = PM(i - 1, j - 1), p10 = PM(i, j - 1), p20 = PM(i + 1, j - 1), p01 = PM(i - 1, j), p11 = pm[c], p21 = PM(i + 1, j), p02 = PM(i - 1, j + 1), p12 = PM(i, j + 1), p22 = PM(i + 1, j + 1);
      const anyPass = p00 | p10 | p20 | p01 | p11 | p21 | p02 | p12 | p22;
      const xsC = ART.xs[c], xhC = ART.xh[c];
      for (let ly = 0; ly < apc; ly++) {
        const v = cj * apc + ly, Y = wy + v * 2 + 1, row = v * ap;
        for (let lx = 0; lx < apc; lx++) {
          const u = cii * apc + lx, X = wx + u * 2 + 1, q = row + u;
          let idx = 0, idxB = -1, kind = 0, shade = 0, curL = 0;
          if (L && inShape(i, j, lx, ly, 1)) {
            const Lp = L >= 2 && inShape(i, j, lx, ly, 2) ? 2 : 1; curL = Lp;
            if (lS < Lp) { // south face: lit lip, 3 strata, broken strata lines, cracks, dark base; darker where it turns an open side
              kind = 3; const hc = hash(i * 16 + lx, Lp, salt);
              let s = ly === 0 ? 4 : ly >= 15 ? 0 : ly < 5 ? 3 : ly < 10 ? 2 : 1;
              if ((ly === 5 || ly === 10) && (hash(u, v, salt + 3) & 3) !== 0) s = Math.max(0, s - 1);
              if (ly > 1 && ly < 14 && hc % 7 === 0 && ((hash(u, v >> 2, salt + 5) & 3) !== 0)) s = Math.max(0, s - 1);
              if (ly > 0 && ((lE < Lp && lx >= 14) || (lW < Lp && lx <= 1))) s = Math.max(0, s - 1);
              if (Lp === 2 && ly === 0) s = 4;
              idx = ST[s];
            } else { // top: the plateau (highland) or the high rock (stone), dithered tone, rims
              kind = 2; const Rm = Lp === 2 ? ST : PL, base = 2, hv = hash(u, v, salt + Lp), hb = hash(u >> 2, v >> 2, salt + 71 + Lp);
              let s = base + ((hb & 7) === 0 ? 1 : (hb & 7) === 1 ? -1 : 0); // 4x4 art px flecks of the next tone
              if ((hv & 31) === 0) s = base + 1; else if ((hv & 31) === 1) s = base - 1;
              if (Lp === 1 && (hv >>> 8) % 29 === 0) { idx = G[(hv >>> 16) & 1 ? 2 : 3]; } // grass tufts on the plateau
              if (lN < Lp && ly === 0) s = Lp === 2 ? 1 : 0;
              else if (lN < Lp && ly === 1) s = Lp === 2 ? 4 : 3;
              if ((lE < Lp && lx >= 14) || (lW < Lp && lx <= 1)) s = Math.max(0, s - 1);
              if (!idx) idx = Rm[Math.max(0, Math.min(Rm.length - 1, s))];
              if (Lp === 1 && LV(i, j) === 1) { const sx = X - shx, sy = Y - shy, s2 = levelAt(sx, sy), s3 = levelAt(X - shx / 2, Y - shy / 2); if (s2 > 1 || s3 > 1) shade = 1; }
            }
          } else if (t === 2 && inWater(i, j, lx, ly)) { // deep water
            kind = 4; const fx = X / cell - 0.5, fy = Y / cell - 0.5, i0 = Math.floor(fx), j0 = Math.floor(fy), tx = fx - i0, ty = fy - j0; // bilinear SDF from cell centres
            const a = SD(i0, j0), b = SD(i0 + 1, j0), cc = SD(i0, j0 + 1), dd = SD(i0 + 1, j0 + 1);
            const d = -(a + (b - a) * tx + (cc - a) * ty + (a - b - cc + dd) * tx * ty);
            idx = d < A.shallow ? WA[2] : d < A.deep ? WA[1] : WA[0]; idxB = idx;
            if (d < A.foam) { if ((hash(u >> 1, v >> 1, salt + 11) % 5) !== 0) idx = FOAM; if ((hash((u + 1) >> 1, v >> 1, salt + 13) % 5) !== 0) idxB = FOAM; }
            else if (d >= A.shallow) { // sparkle dashes: one 3-px dash in some 8x4 blocks, a different set on each frame
              const bx = u >> 3, by = v >> 2, ha = hash(bx, by, salt + 17), hb = hash(bx, by, salt + 19), ox = u & 7, oy = v & 3;
              if (ha % sparkleK === 0 && oy === 1 && ox >= (ha >>> 8) % 5 && ox < ((ha >>> 8) % 5) + 3) idx = WA[2];
              if (hb % sparkleK === 0 && oy === 2 && ox >= (hb >>> 8) % 5 && ox < ((hb >>> 8) % 5) + 3) idxB = WA[2];
            }
            if (TR((X / cell) | 0, ((Y - A.bridgeShadow * 2) / cell) | 0) === 4) { shade = 1; } // the bridge's shadow strip
          } else if (t === 3 || t === 4) { // ford (sand bar, stepping stones) or bridge (planks, rails, posts)
            const x = X - W2, y = Y - W2, al = R ? x * R.dx + y * R.dy - xsC : 0, ac = R ? x * -R.dy + y * R.dx : 0, da = al < 0 ? -al : al;
            if (t === 3) {
              kind = 5; const qq = (((ac % A.stoneStep) + A.stoneStep) % A.stoneStep) - A.stoneStep / 2, stone = (q2, a2) => Math.abs(q2) < A.stoneR && Math.abs(a2) < A.stoneR - 1;
              if (stone(qq, al)) idx = !stone(qq - 2 * R.dx, al - 2 * R.dy) ? ST[4] : !stone(qq + 2 * R.dx, al + 2 * R.dy) ? ST[1] : ST[3]; // screen rows above / below: highlight, underside
              else if (da > xhC - A.fordEdge) { idx = WA[2]; idxB = idx; if ((hash(u, v, salt + 23) & 7) === 0) idx = FOAM; if ((hash(u, v, salt + 29) & 7) === 0) idxB = FOAM; }
              else idx = (hash(u, v, salt + 31) & 7) === 0 ? SA[0] : SA[1];
              if (idxB < 0) idxB = idx;
            } else {
              kind = 6; const qm = ((ac % 8) + 8) % 8, plank = Math.floor(ac / 8);
              if (da > xhC - 2) idx = WD[0]; // the deck's outer edge, then the rail (light) with dark posts, then planks across the way you walk
              else if (da > xhC - 6) idx = (((ac % 16) + 16) % 16) < 3 ? WD[0] : WD[3];
              else idx = qm < 2 ? WD[0] : (hash(plank, 0, salt + 37) % 3) ? WD[2] : WD[1];
            }
          } else { // walkable ground (or a rock cell's rounded-off corner): pass floor or grass
            const fx = (lx + 0.5) / apc, fy = (ly + 0.5) / apc;
            let pv = 0;
            if (anyPass) { // bilinear over the 3x3 neighbourhood, from cell centres
              const qx = fx < 0.5 ? fx + 0.5 : fx - 0.5, qy = fy < 0.5 ? fy + 0.5 : fy - 0.5;
              const a = fx < 0.5 ? (fy < 0.5 ? p00 : p01) : (fy < 0.5 ? p10 : p11), b = fx < 0.5 ? (fy < 0.5 ? p10 : p11) : (fy < 0.5 ? p20 : p21);
              const cc = fx < 0.5 ? (fy < 0.5 ? p01 : p02) : (fy < 0.5 ? p11 : p12), dd = fx < 0.5 ? (fy < 0.5 ? p11 : p12) : (fy < 0.5 ? p21 : p22);
              pv = a + (b - a) * qx + (cc - a) * qy + (a - b - cc + dd) * qx * qy;
            }
            const bay = BAYER[(v & 3) * 4 + (u & 3)];
            if (pv > 0.42 + 0.16 * bay) { // pass / canyon floor: earth, with cracks and pebbles
              kind = 1; const hv = hash(u, v, salt + 41);
              idx = E[(hv & 15) === 0 ? 1 : (hv & 15) === 1 ? 3 : 2];
              if (hash(u >> 2, v, salt + 43) % 23 === 0 && (u & 3) !== 3) idx = E[0];
              if ((hv >>> 8) % 61 === 0) idx = ST[3];
            } else { // grass: biome by the lattice, tone dithered across the ramp, blade speckles
              const gx = u / LS, gy = v / LS, gi = gx | 0, gj = gy | 0, tx = gx - gi, ty = gy - gj, k0 = gj * LN + gi;
              const bl = LB[k0] + (LB[k0 + 1] - LB[k0]) * tx + (LB[k0 + LN] - LB[k0]) * ty + (LB[k0] - LB[k0 + 1] - LB[k0 + LN] + LB[k0 + LN + 1]) * tx * ty;
              const tn = LT[k0] + (LT[k0 + 1] - LT[k0]) * tx + (LT[k0 + LN] - LT[k0]) * ty + (LT[k0] - LT[k0 + 1] - LT[k0 + LN] + LT[k0 + LN + 1]) * tx * ty;
              const Rm = bl < A.rockyBelow - 0.04 + 0.08 * bay ? RK : bl > A.highAbove + 0.04 - 0.08 * bay ? HG : G;
              const top = Rm === G ? 3 : Rm.length - 1, st = 0.6 + tn * (top + 0.2), s0 = Math.floor(st), s = s0 + (st - s0 > 0.5 + (bay - 0.5) * A.ditherBand ? 1 : 0);
              let si = Math.max(1, Math.min(top, s)); const hv = hash(u, v, salt + 47);
              if ((hv & 63) < 3) si = Math.max(0, si - 1); else if ((hv & 63) === 3 && hash(u, v - 1, salt + 47) % 3) si = Math.min(Rm.length - 1, si + 1);
              if ((hv & 63) === 5 && hash(u, v + 1, salt + 47) % 2) si = Math.max(0, si - 1);
              idx = Rm[si];
            }
            const s2 = levelAt(X - shx, Y - shy), s3 = levelAt(X - shx / 2, Y - shy / 2); if (s2 > 0 || s3 > 0) shade = 1;
          }
          IA[q] = idx; IB[q] = idxB < 0 ? idx : idxB; SH[q] = shade; KB[q] = kind;
        }
      }
    }
    // pixel trails between camps: an earth brush along each quadratic curve, on grass only (under the cast shadows)
    for (const tr of o.trails) {
      if (tr.maxX < wx - 8 || tr.minX > wx + CH + 8 || tr.maxY < wy - 8 || tr.minY > wy + CH + 8) continue;
      const len = Math.hypot(tr.cx - tr.x0, tr.cy - tr.y0) + Math.hypot(tr.x1 - tr.cx, tr.y1 - tr.cy), steps = Math.min(1200, Math.ceil(len / 2));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, w = 1 - t, X = w * w * tr.x0 + 2 * w * t * tr.cx + t * t * tr.x1, Y = w * w * tr.y0 + 2 * w * t * tr.cy + t * t * tr.y1;
        const cu = ((X - wx) / 2) | 0, cv = ((Y - wy) / 2) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const uu = cu + dx, vv = cv + dy; if (uu < 0 || vv < 0 || uu >= ap || vv >= ap) continue; const q = vv * ap + uu; if (KB[q] !== 0) continue;
          const edge = dx !== 0 && dy !== 0; if (edge && (hash(uu, vv, salt + 53) & 1)) continue;
          IA[q] = IB[q] = E[edge ? 1 : (hash(uu, vv, salt + 59) & 3) === 0 ? 3 : 2];
        }
      }
    }
    for (let q = 0, nq = ap * ap; q < nq; q++) { const s = SH[q]; U32A[q] = s ? SLUT[IA[q]] : LUT[IA[q]]; if (water) U32B[q] = s ? SLUT[IB[q]] : LUT[IB[q]]; }
    const gA = cvA.getContext("2d"); gA.setTransform(1, 0, 0, 1, 0, 0); gA.globalAlpha = 1; gA.globalCompositeOperation = "source-over"; gA.putImageData(imgA, 0, 0);
    let gB = null; if (water) { gB = cvB.getContext("2d"); gB.setTransform(1, 0, 0, 1, 0, 0); gB.globalAlpha = 1; gB.globalCompositeOperation = "source-over"; gB.putImageData(imgB, 0, 0); }
    // dressing at 1:1 art px: decal clusters on grass (from the placed decal seeds; offsets from a render hash), pines on the high rim
    const spr = o.spr, dk = spr.decals, both = (im, ax, ay) => { gA.drawImage(im, ax, ay); if (gB) gB.drawImage(im, ax, ay); };
    const grassAt = (X, Y) => { if (X < 0 || Y < 0 || X >= W || Y >= W) return false; const c = ((Y / cell) | 0) * N + ((X / cell) | 0); return terr[c] === 0 && !pm[c]; };
    for (const d of o.decals) {
      if (d.x < wx - 40 || d.x > wx + CH + 40 || d.y < wy - 40 || d.y > wy + CH + 40) continue;
      const hd = hash(d.x | 0, d.y | 0, salt + 61), nC = 1 + (hd % A.decalCluster);
      for (let k = 0; k < nC; k++) {
        const hk = hash(d.x | 0, k, hd), X = d.x + (k ? ((hk & 63) - 32) * A.decalSpread / 32 : 0), Y = d.y + (k ? (((hk >>> 6) & 63) - 32) * A.decalSpread / 48 : 0);
        if (!grassAt(X, Y)) continue; const im = dk[k === 0 ? d.k % dk.length : (d.k + ((hk >>> 12) % 3)) % dk.length];
        both(im, Math.round(X / 2 - im.width / 2) - wx / 2, Math.round(Y / 2 - im.height / 2) - wy / 2);
      }
    }
    const pine = spr.trees[2];
    for (let j = r0 - 1; j <= r0 + per; j++) for (let i = c0 - 1; i <= c0 + per; i++) {
      if (LV(i, j) < 2 || LV(i, j + 1) < 2 || LV(i - 1, j) < 2 || LV(i + 1, j) < 2 || LV(i, j - 1) < 2) continue;
      const hp = hash(i, j, salt + 67); if (hp % 100 >= A.pineShare) continue;
      const px = i * apc + 4 + ((hp >>> 8) % 9) - wx / 2, py = j * apc + 6 + ((hp >>> 12) % 8) - wy / 2;
      both(pine.cv, px - pine.ax, py - pine.ay);
    }
  }
  PS.ground = { paint, biome, mapArt, table: () => { table(); return K; } };
})();
