// Sapper's Path rules engine v3 (SPEC-v3 §2-4; decisions in SPEC-v3 §9). PURE: no DOM, no clock, no randomness, so it
// ports to Godot as-is. UMD: require('./engine.js') in Node, window.SappersPath.engine in the page.
//
// Level JSON: {w, h, grid:[h strings of w chars], gates?:[{at:[x,y], key:[x,y]}], towers?:[{at:[x,y], r}],
//              cols:[5 x [[mat, count], ...]] (each column front card first), safeArchers?: true}
// safeArchers (the archer teaching level, 51): its archers never kill, on any difficulty; a hit goes to the line.
// Grid legend:  .  grass   ,  dirt   ~  water   #  camp   a..n  material 1..14 (MATS order in config.json)
// x grows east, y grows south; a cell index is y * w + x. Material 10 (j, Iron) exists only as locked gate pixels and
// material 14 (n, Gilt) holds the keys. A gate is the 4-connected iron group holding `at`; a tower is the 4-connected
// group of `at`'s material, its range a disc of radius r around the group's centroid.
//
// Rules (SPEC-v3 §2-4 plus the §9 M0 decisions):
//   Walkable = grass, dirt, camp. Connected ground = walkable cells 4-joined to the camp. A pixel is reachable when it
//   touches connected ground; its distance is the smallest camp-BFS distance of a connected neighbour. Ties go to the
//   smaller |y - campRow| (campRow = the camp's top row), then the lower x, then the lower y.
//   A squad {m, n} eats n pixels one at a time, each the nearest reachable pixel of m. An eaten pixel turns to dirt.
//   Archers: while a tower stands, a target inside its range (and not itself a tower pixel) is covered. A card squad whose
//   next target is covered is hit: every remaining sapper of that squad (the target never moves). Easy/Normal send them
//   to the holding line; Hard kills them. Holding-line sappers are wary: an entry resumes only when its next target is
//   uncovered, and stops (keeping its place) before walking into range. That is the re-hit rule; it also bounds the
//   cascade, since every resume eats at least one pixel.
//   Leftovers join the holding line: merge into the entry of their material, else a new space; past capacity = fail.
//   After the play, the first entry (in line order) that can resume does, and the scan restarts until nothing moves.
//   Win: no pixels left. Fail: overflow; short (Hard: a kill leaves a material with fewer sappers than pixels); stuck
//   (tray empty, line settled, pixels left); no move (every front card would overflow or be killed on play).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).engine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const GRASS = 0, WATER = -1, DIRT = -2, CAMP = -3;
  const NCOL = 5, NMAT = 15, IRON = 10, GILT = 14, MAXCELLS = 4096, MAXTOWERS = 8, MAXLINE = 8;
  const PLAYING = 0, WON = 1, FAILED = -1;
  const OVERFLOW = 1, SHORT = 2, STUCK = 3, NOMOVE = 4;
  const REASONS = ["", "overflow", "short", "stuck", "nomove"];
  // Event log (optional, S.logOn): [type, a, b] triples. EAT cell mat, JOIN mat count, HIT mat count, KILL mat count,
  // RESUME mat count, GATE gate 0, TOWER tower 0, AIM cell mat (the covered pixel a squad was hit going for; logged
  // just before its HIT or KILL, for the page's arrow show only).
  const EV = { EAT: 1, JOIN: 2, HIT: 3, KILL: 4, RESUME: 5, GATE: 6, TOWER: 7, AIM: 8 };
  const CODE = { ".": GRASS, ",": DIRT, "~": WATER, "#": CAMP };
  const matOf = (ch) => { const k = ch.charCodeAt(0) - 96; return k >= 1 && k <= 14 ? k : 0; };
  const chOf = (v) => (v > 0 ? String.fromCharCode(96 + v) : v === GRASS ? "." : v === DIRT ? "," : v === WATER ? "~" : "#");
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];

  // 4-connected group of cells matching pred, from c0.
  function group(w, h, c0, pred) {
    const out = [c0], seen = new Uint8Array(w * h); seen[c0] = 1;
    for (let i = 0; i < out.length; i++) {
      const c = out[i], x = c % w, y = (c / w) | 0;
      for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d], e = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[e] && pred(e)) { seen[e] = 1; out.push(e); } }
    }
    return out;
  }

  // Compile a level once (static board data). Throws on malformed data; everything after compile never throws.
  function compile(L) {
    const w = L.w | 0, h = L.h | 0, n = w * h, grid = L.grid;
    if (!(w > 1 && h > 1) || n > MAXCELLS || !Array.isArray(grid) || grid.length !== h) throw new Error("level: bad size or grid");
    const a0 = new Int8Array(n);
    let campRow = h;
    for (let y = 0; y < h; y++) {
      if (typeof grid[y] !== "string" || grid[y].length !== w) throw new Error("level: row " + y + " is not " + w + " wide");
      for (let x = 0; x < w; x++) {
        const ch = grid[y][x], c = y * w + x, m = matOf(ch);
        if (m) a0[c] = m; else if (ch in CODE) a0[c] = CODE[ch]; else throw new Error("level: bad cell '" + ch + "' at " + x + "," + y);
        if (a0[c] === CAMP && y < campRow) campRow = y;
      }
    }
    if (campRow === h) throw new Error("level: no camp");
    const nb = new Int32Array(n * 4);
    for (let c = 0; c < n; c++) { const x = c % w, y = (c / w) | 0; for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; nb[c * 4 + d] = nx < 0 || ny < 0 || nx >= w || ny >= h ? -1 : ny * w + nx; } }
    // Tie-break rank: |y - campRow|, then x, then y. Unique per cell, so heap keys never tie.
    const order = Array.from({ length: n }, (_, c) => c).sort((p, q) => {
      const px = p % w, py = (p / w) | 0, qx = q % w, qy = (q / w) | 0;
      return Math.abs(py - campRow) - Math.abs(qy - campRow) || px - qx || py - qy;
    });
    const rank = new Int32Array(n); order.forEach((c, i) => { rank[c] = i; });
    const cellAt = (p, what) => { const x = p && p[0] | 0, y = p && p[1] | 0; if (!Array.isArray(p) || x < 0 || y < 0 || x >= w || y >= h) throw new Error("level: bad " + what + " cell"); return y * w + x; };

    // Gates and keys.
    const gateOf = new Int8Array(n).fill(-1), keyOf = new Int8Array(n).fill(-1), gateCells = [];
    (L.gates || []).forEach((G, g) => {
      const at = cellAt(G.at, "gate"), k = cellAt(G.key, "key");
      if (a0[at] !== IRON || gateOf[at] >= 0) throw new Error("level: gate " + g + " is not an unclaimed iron cell");
      if (a0[k] !== GILT || keyOf[k] >= 0) throw new Error("level: key " + g + " is not an unclaimed gilt cell");
      const cells = group(w, h, at, (e) => a0[e] === IRON);
      for (const c of cells) gateOf[c] = g;
      keyOf[k] = g; gateCells.push(Int32Array.from(cells));
    });
    for (let c = 0; c < n; c++) if (a0[c] === IRON && gateOf[c] < 0) throw new Error("level: iron outside a gate at " + (c % w) + "," + ((c / w) | 0));
    if (gateCells.length > 32) throw new Error("level: too many gates");

    // Archer towers: the group of `at`'s material, range around its centroid.
    const towerOf = new Int8Array(n).fill(-1), cover = new Uint8Array(n), towers = [];
    (L.towers || []).forEach((T, t) => {
      if (t >= MAXTOWERS) throw new Error("level: too many towers");
      const at = cellAt(T.at, "tower"), m = a0[at], r = +T.r;
      if (!(m > 0) || m === IRON || towerOf[at] >= 0 || !(r > 0)) throw new Error("level: tower " + t + " is bad");
      const cells = group(w, h, at, (e) => a0[e] === m && towerOf[e] < 0);
      let sx = 0, sy = 0; for (const c of cells) { towerOf[c] = t; sx += c % w; sy += (c / w) | 0; }
      const cx = sx / cells.length, cy = sy / cells.length;
      for (let c = 0; c < n; c++) { const dx = (c % w) - cx, dy = ((c / w) | 0) - cy; if (dx * dx + dy * dy <= r * r) cover[c] |= 1 << t; }
      towers.push({ m, r, cx, cy, size: cells.length });
    });

    // Deck: five columns, front card first.
    const cols = L.cols || [[], [], [], [], []];
    if (!Array.isArray(cols) || cols.length !== NCOL) throw new Error("level: cols must be 5 columns");
    const cardM = [], cardN = [], colStart = new Int32Array(NCOL), colLen = new Int32Array(NCOL), sapTotal = new Int32Array(NMAT);
    cols.forEach((col, j) => {
      colStart[j] = cardM.length; colLen[j] = col.length;
      for (const cd of col) { const m = cd[0] | 0, k = cd[1] | 0; if (!(m >= 1 && m < NMAT) || m === IRON || !(k >= 1 && k <= 999)) throw new Error("level: bad card"); cardM.push(m); cardN.push(k); sapTotal[m] += k; }
    });
    const pix = new Int32Array(NMAT); for (let c = 0; c < n; c++) if (a0[c] > 0) pix[a0[c]]++;
    const hoff = new Int32Array(NMAT + 1); for (let m = 0; m < NMAT; m++) hoff[m + 1] = hoff[m] + (m === IRON ? 0 : pix[m]);
    // Zobrist keys for eaten cells (fixed-seed, so hashes are stable across runs).
    const Z1 = new Int32Array(n), Z2 = new Int32Array(n); let s = 0x5A17 ^ n;
    const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return t ^ (t >>> 14); };
    for (let c = 0; c < n; c++) { Z1[c] = rnd(); Z2[c] = rnd(); }
    let pixTotal = 0; for (let m = 1; m < NMAT; m++) pixTotal += pix[m];
    return { w, h, n, a0, nb, rank, campRow, gateOf, keyOf, gateCells, towerOf, cover, towers, cardM: Int32Array.from(cardM), cardN: Int32Array.from(cardN),
      colStart, colLen, sapTotal, pix, hoff, Z1, Z2, pixTotal, ncards: cardM.length, safeArchers: L.safeArchers === true };
  }

  // A mutable game on a compiled board. rules = {hold, archersKill}. opts.deal: dealing mode (no tray; play squads with
  // playSquad; no short/stuck/no-move checks). The whole state lives in one Int32Array, so save/load are one copy.
  function sim(B, rules, opts) {
    const n = B.n, nb = B.nb, rank = B.rank, cover = B.cover, towerOf = B.towerOf, keyOf = B.keyOf, gateOf = B.gateOf, hoff = B.hoff;
    const cap = Math.max(1, Math.min(MAXLINE, rules.hold | 0)), lethal = !!rules.archersKill && !B.safeArchers, deal = !!(opts && opts.deal), nt = B.towers.length;
    // Layout of the state buffer.
    let o = 0; const at = (k) => { const r = o; o += k; return r; };
    const oA = at(n), oD = at(n), oK = at(n), oP = at(n), oH = at(B.hoff[NMAT]), oHL = at(NMAT), oLeft = at(NMAT), oSap = at(NMAT), oT = at(MAXTOWERS),
      oHead = at(NCOL), oLM = at(MAXLINE), oLN = at(MAXLINE), oS = at(16);
    const M = new Int32Array(o), init = new Int32Array(o);
    const a = M.subarray(oA, oA + n), d = M.subarray(oD, oD + n), hk = M.subarray(oK, oK + n), hpos = M.subarray(oP, oP + n), heap = M.subarray(oH, oH + B.hoff[NMAT]);
    const hlen = M.subarray(oHL, oHL + NMAT), left = M.subarray(oLeft, oLeft + NMAT), sap = M.subarray(oSap, oSap + NMAT), tleft = M.subarray(oT, oT + MAXTOWERS);
    const heads = M.subarray(oHead, oHead + NCOL), lineM = M.subarray(oLM, oLM + MAXLINE), lineN = M.subarray(oLN, oLN + MAXLINE);
    // Scalars in M[oS + k].
    const S_LEN = oS, S_PIX = oS + 1, S_STAND = oS + 2, S_STATUS = oS + 3, S_REASON = oS + 4, S_HITS = oS + 5, S_KILLS = oS + 6, S_Z1 = oS + 7, S_Z2 = oS + 8, S_PEAK = oS + 9, S_PLAYS = oS + 10, S_FAILM = oS + 11;
    const q = new Int32Array(n);
    const ev = new Int32Array(3 * (4 * n + 64)); let evLen = 0;
    let logOn = false;
    const log = (t, p, r) => { if (logOn && evLen + 3 <= ev.length) { ev[evLen++] = t; ev[evLen++] = p; ev[evLen++] = r; } };

    // Indexed min-heap per material over reachable pixels, keyed hk = distance * n + rank.
    function up(m, i) {
      const base = hoff[m], c = heap[base + i], k = hk[c];
      while (i > 0) { const p = (i - 1) >> 1, pc = heap[base + p]; if (hk[pc] <= k) break; heap[base + i] = pc; hpos[pc] = i; i = p; }
      heap[base + i] = c; hpos[c] = i;
    }
    function down(m, i) {
      const base = hoff[m], len = hlen[m], c = heap[base + i], k = hk[c];
      for (;;) {
        let l = 2 * i + 1; if (l >= len) break;
        const r = l + 1; if (r < len && hk[heap[base + r]] < hk[heap[base + l]]) l = r;
        const lc = heap[base + l]; if (hk[lc] >= k) break;
        heap[base + i] = lc; hpos[lc] = i; i = l;
      }
      heap[base + i] = c; hpos[c] = i;
    }
    function touch(p, dist) {
      const m = a[p]; if (m <= 0 || gateOf[p] >= 0) return;
      const key = dist * n + rank[p];
      if (hk[p] < 0) { hk[p] = key; const i = hlen[m]++; heap[hoff[m] + i] = p; up(m, i); } else if (key < hk[p]) { hk[p] = key; up(m, hpos[p]); }
    }
    function popTop(m) {
      const base = hoff[m], c = heap[base], len = --hlen[m];
      if (len > 0) { heap[base] = heap[base + len]; hpos[heap[base]] = 0; down(m, 0); }
      hk[c] = -1; hpos[c] = -1; return c;
    }
    // Incremental BFS: c just became walkable. Distances only ever shrink (ground only grows), so one FIFO pass from c
    // repairs every label it improves and re-keys the pixels those labels touch.
    function relax(c) {
      let best = -1;
      for (let k = 0; k < 4; k++) { const e = nb[c * 4 + k]; if (e >= 0 && a[e] <= 0 && a[e] !== WATER && d[e] >= 0 && (best < 0 || d[e] < best)) best = d[e]; }
      if (best < 0 || (d[c] >= 0 && d[c] <= best + 1)) return;
      d[c] = best + 1; let qh = 0, qt = 0; q[qt++] = c;
      while (qh < qt) {
        const u = q[qh++], du = d[u];
        for (let k = 0; k < 4; k++) {
          const v = nb[u * 4 + k]; if (v < 0) continue; const av = a[v];
          if (av > 0) { touch(v, du); continue; }
          if (av === WATER) continue;
          if (d[v] < 0 || d[v] > du + 1) { d[v] = du + 1; if (qt < n) q[qt++] = v; }
        }
      }
    }
    const covered = (c) => (cover[c] & M[S_STAND]) !== 0 && towerOf[c] < 0;
    const target = (m) => (m > 0 && m < NMAT && hlen[m] > 0 ? heap[hoff[m]] : -1);

    function eatCell(c) {
      const m = a[c]; popTop(m);
      a[c] = DIRT; left[m]--; M[S_PIX]--; M[S_Z1] ^= B.Z1[c]; M[S_Z2] ^= B.Z2[c]; log(EV.EAT, c, m);
      const t = towerOf[c]; if (t >= 0 && --tleft[t] === 0) { M[S_STAND] &= ~(1 << t); log(EV.TOWER, t, 0); }
      const g = keyOf[c];
      if (g >= 0) {
        const cells = B.gateCells[g];
        for (let i = 0; i < cells.length; i++) { a[cells[i]] = DIRT; left[IRON]--; M[S_PIX]--; }
        log(EV.GATE, g, 0);
        for (let i = 0; i < cells.length; i++) relax(cells[i]);
      }
      relax(c);
    }
    // Up to cnt sappers of m eat one pixel each. Returns how many ate; stop = 0 nothing reachable, 1 covered, 2 done.
    let stop = 2;
    function march(m, cnt) {
      let k = 0; stop = 2;
      while (k < cnt) {
        if (hlen[m] === 0) { stop = 0; break; }
        const c = heap[hoff[m]];
        if (covered(c)) { stop = 1; break; }
        eatCell(c); k++;
        if (M[S_PIX] === 0) break;
      }
      return k;
    }
    function lineFind(m) { const len = M[S_LEN]; for (let i = 0; i < len; i++) if (lineM[i] === m) return i; return -1; }
    function fail(r, m) { M[S_STATUS] = FAILED; M[S_REASON] = r; M[S_FAILM] = m; }
    function join(m, cnt) {
      const i = lineFind(m);
      if (i >= 0) { lineN[i] += cnt; log(EV.JOIN, m, cnt); return; }
      const len = M[S_LEN];
      if (len >= cap) { fail(OVERFLOW, m); log(EV.JOIN, m, cnt); return; }
      lineM[len] = m; lineN[len] = cnt; M[S_LEN] = len + 1; if (len + 1 > M[S_PEAK]) M[S_PEAK] = len + 1; log(EV.JOIN, m, cnt);
    }
    function removeEntry(i) { const len = M[S_LEN]; for (let k = i; k < len - 1; k++) { lineM[k] = lineM[k + 1]; lineN[k] = lineN[k + 1]; } lineM[len - 1] = 0; lineN[len - 1] = 0; M[S_LEN] = len - 1; }
    // Resume cascade: the first entry in line order that has an uncovered target marches; repeat until nothing moves.
    // Each round eats at least one pixel, so pixTotal + 1 rounds bound it.
    function cascade() {
      for (let guard = 0; guard <= B.pixTotal + 1 && M[S_PIX] > 0; guard++) {
        const len = M[S_LEN]; let i = 0;
        for (; i < len; i++) { const t = target(lineM[i]); if (t >= 0 && !covered(t)) break; }
        if (i === len) return;
        const m = lineM[i]; log(EV.RESUME, m, lineN[i]);
        const k = march(m, lineN[i]); sap[m] -= k; lineN[i] -= k;
        if (lineN[i] <= 0) removeEntry(i);
      }
    }
    // Would playing this front card end the assault? (the no-move rule)
    function cardFails(m, cnt) {
      const t = target(m);
      if (t >= 0 && !covered(t)) return false;
      if (t >= 0 && lethal) return sap[m] - cnt < left[m];
      return lineFind(m) < 0 && M[S_LEN] >= cap;
    }
    function settle() {
      if (M[S_STATUS] !== PLAYING) return;
      if (M[S_PIX] === 0) { M[S_STATUS] = WON; return; }
      if (deal) return;
      let any = false, safe = false;
      for (let j = 0; j < NCOL; j++) {
        if (heads[j] >= B.colLen[j]) continue; any = true;
        const ci = B.colStart[j] + heads[j];
        if (!cardFails(B.cardM[ci], B.cardN[ci])) { safe = true; break; }
      }
      if (!any) fail(STUCK, M[S_LEN] > 0 ? lineM[0] : 0);
      else if (!safe) fail(NOMOVE, 0);
    }
    // Send a squad (the tap, after the card leaves its column).
    function playSquad(m, cnt) {
      if (M[S_STATUS] !== PLAYING) return M[S_STATUS];
      M[S_PLAYS]++;
      const k = march(m, cnt); sap[m] -= k;
      const rest = cnt - k;
      if (rest > 0 && M[S_PIX] > 0) {
        if (stop === 1) {
          log(EV.AIM, target(m), m);
          M[S_HITS] += rest;
          if (lethal) { M[S_KILLS] += rest; sap[m] -= rest; log(EV.KILL, m, rest); if (deal || sap[m] < left[m]) fail(SHORT, m); }
          else { log(EV.HIT, m, rest); join(m, rest); }
        } else join(m, rest);
      }
      if (M[S_STATUS] === PLAYING) cascade();
      settle();
      return M[S_STATUS];
    }
    function play(col) {
      if (M[S_STATUS] !== PLAYING || col < 0 || col >= NCOL || heads[col] >= B.colLen[col]) return -2;
      const ci = B.colStart[col] + heads[col]++;
      return playSquad(B.cardM[ci], B.cardN[ci]);
    }

    // Initial state.
    a.set(B.a0); d.fill(-1); hk.fill(-1); hpos.fill(-1);
    for (let m = 0; m < NMAT; m++) left[m] = B.pix[m];
    for (let m = 0; m < NMAT; m++) sap[m] = deal ? 1 << 24 : B.sapTotal[m];
    for (let t = 0; t < nt; t++) { tleft[t] = B.towers[t].size; M[S_STAND] |= 1 << t; }
    M[S_PIX] = B.pixTotal;
    { let qh = 0, qt = 0; for (let c = 0; c < n; c++) if (a[c] === CAMP) { d[c] = 0; q[qt++] = c; }
      while (qh < qt) { const u = q[qh++]; for (let k = 0; k < 4; k++) { const v = nb[u * 4 + k]; if (v < 0) continue; const av = a[v]; if (av > 0) { touch(v, d[u]); continue; } if (av !== WATER && d[v] < 0) { d[v] = d[u] + 1; q[qt++] = v; } } } }
    init.set(M);
    settle();
    init.set(M);

    const hash = () => {
      let h1 = M[S_Z1] ^ 0x1234567, h2 = M[S_Z2] ^ 0x7654321;
      for (let j = 0; j < NCOL; j++) { h1 = Math.imul(h1 ^ heads[j], 0x9E3779B1); h2 = Math.imul(h2 ^ (heads[j] + 17), 0x85EBCA77); }
      const len = M[S_LEN];
      for (let i = 0; i < len; i++) { h1 = Math.imul(h1 ^ (lineM[i] * 1024 + lineN[i]), 0xC2B2AE3D); h2 = Math.imul(h2 ^ (lineN[i] * 64 + lineM[i]), 0x27D4EB2F); }
      h1 ^= h1 >>> 15; h2 ^= h2 >>> 13;
      return (h1 >>> 0) * 2097152 + (h2 >>> 11);
    };
    return {
      B, M, a, d, heads, lineM, lineN, left, cap, lethal, ev, play, playSquad, target, covered, hash,
      get logOn() { return logOn; }, set logOn(v) { logOn = !!v; },
      reset() { M.set(init); evLen = 0; },
      save(buf) { (buf || (buf = new Int32Array(M.length))).set(M); return buf; },
      load(buf) { M.set(buf); },
      clearLog() { evLen = 0; },
      get evLen() { return evLen; },
      get status() { return M[S_STATUS]; }, get reason() { return REASONS[M[S_REASON]]; }, get failMat() { return M[S_FAILM]; },
      get lineLen() { return M[S_LEN]; }, get pixLeft() { return M[S_PIX]; }, get standing() { return M[S_STAND]; },
      get hits() { return M[S_HITS]; }, get kills() { return M[S_KILLS]; }, get peak() { return M[S_PEAK]; }, get plays() { return M[S_PLAYS]; },
      sappers: (m) => sap[m],
      front(j) { return heads[j] < B.colLen[j] ? B.colStart[j] + heads[j] : -1; },
      // Reachable pixel count of m right now (tools and UI; not on the hot path).
      reachable(m) { return m > 0 && m < NMAT ? hlen[m] : 0; },
    };
  }

  // Replay a column order ("0123..."). Returns the sim (status tells the result).
  function replay(B, rules, order) {
    const S = sim(B, rules);
    for (let i = 0; i < order.length && S.status === PLAYING; i++) if (S.play(order.charCodeAt(i) - 48) === -2) break;
    return S;
  }
  const gridOf = (w, h, a) => { const g = []; for (let y = 0; y < h; y++) { let s = ""; for (let x = 0; x < w; x++) s += chOf(a[y * w + x]); g.push(s); } return g; };

  return { compile, sim, replay, gridOf, chOf, matOf, GRASS, WATER, DIRT, CAMP, NCOL, NMAT, IRON, GILT, PLAYING, WON, FAILED, EV, REASONS };
});
