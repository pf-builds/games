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
// Rules (SPEC-v3 §2-4 and §9; the dispatch model from playtest 1): a deterministic, event-driven time simulation.
//   Walkable = grass, dirt, camp. Connected ground = walkable cells 4-joined to the camp. A pixel is reachable when it
//   touches connected ground; its distance is the smallest camp-BFS distance of a connected neighbour. Ties go to the
//   smaller |y - campRow| (campRow = the camp's top row), then the lower x, then the lower y.
//   Tap: the squad {m, n} takes a free holding space at once (no merging: two squads of a colour take two spaces). Its
//   sappers wait at the space. No free space: the tap is refused (v3.1): play() returns REFUSED and nothing changes (the
//   card stays at the front of its column). Dealing mode keeps the old overflow fail, which the dealer reads.
//   Dispatch: whenever a space has sappers waiting and its colour has an unclaimed reachable pixel, one sapper goes to
//   the nearest one and claims it (so no pixel is targeted twice); at most one per space every time.staggerMs. Spaces
//   dispatch in tap order. So with 2 pixels open, a squad of 14 sends 2, and the next round goes as those pop.
//   Walk, pop, carry: tiles = the pixel's distance + 1. It pops (turns to dirt, reachability updates) at dispatch +
//   yardMs + tiles * tileMs + biteMs, and the sapper is home at pop + yardMs + tiles * carryMs. A space frees when every
//   sapper of its squad has been sent and is home.
//   Archers: while a tower stands, a pixel inside its range (and not itself a tower pixel) is covered. A sapper sent at
//   a covered pixel is hit on the way (at dispatch + yardMs + ceil(tiles / 2) * tileMs; the pixel is never claimed) and
//   its squad turns wary: from then on it only goes for uncovered pixels. Easy and Normal: the hit sapper walks back to
//   its space (home after knockMs and the walk) and waits again. Hard: it dies, and a colour left with fewer sappers
//   than pixels fails the level short (level 51, safeArchers, never kills).
//   Events at the same time run in the order they were scheduled; then dispatch; then the checks. Win: the last pixel
//   pops. Once nothing is moving: stuck (tray empty, pixels left) or jam (v3.1: every space is held by a squad that can't
//   reach a pixel, and so every front card is refused). Short at a Hard kill.
//   Patient play = tap, run until nothing moves, tap again (replay, the grader, the baker). A patient tap never meets a
//   full line (a full line at rest is already a jam), so v3.1's refusal only ever touches rushed taps.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).engine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const GRASS = 0, WATER = -1, DIRT = -2, CAMP = -3;
  const NCOL = 5, NMAT = 15, IRON = 10, GILT = 14, MAXCELLS = 4096, MAXTOWERS = 8, MAXLINE = 8;
  const PLAYING = 0, WON = 1, FAILED = -1, NOPLAY = -2, REFUSED = -3;
  const OVERFLOW = 1, SHORT = 2, STUCK = 3, JAM = 4; // OVERFLOW: dealing mode only (v3.1)
  const REASONS = ["", "overflow", "short", "stuck", "jam"];
  // Event log (optional, S.logOn; the page's show reads it): [type, a, b] triples. TAP space mat (space -1: dealing overflow),
  // DISP sapper space, EAT cell sapper (the pixel pops), GATE gate 0, TOWER tower 0, HIT sapper mat (sent back), KILL
  // sapper mat, HOME sapper space, FREE space mat.
  const EV = { TAP: 1, DISP: 2, EAT: 3, GATE: 4, TOWER: 5, HIT: 6, KILL: 7, HOME: 8, FREE: 9 };
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

  // Timing (config v3.time, whole ms of engine time; the page plays engine time at show.pace x real time). Every value
  // is clamped to a sane integer so a bad config can't stall or reorder the simulation.
  function timeOf(T) {
    const g = (k, d, lo) => { const v = T && Number.isFinite(+T[k]) ? Math.round(+T[k]) : d; return Math.max(lo, Math.min(60000, v)); };
    return { tileMs: g("tileMs", 80, 1), carryMs: g("carryMs", 90, 1), yardMs: g("yardMs", 250, 0), biteMs: g("biteMs", 180, 0), staggerMs: g("staggerMs", 120, 0), knockMs: g("knockMs", 300, 0) };
  }

  // A mutable game on a compiled board: a deterministic, event-driven time simulation (SPEC-v3 §3, the dispatch model).
  // rules = {hold, archersKill, time, mergeLeftovers?}. opts.deal: dealing mode (no tray: squads come from playSquad;
  // no stuck or no-move checks; any archer kill fails). The whole state (grid, reachability heaps, spaces, sappers in
  // flight, the event queue, the clock) lives in one Int32Array, so save/load are one copy and a replay is exact.
  function sim(B, rules, opts) {
    const n = B.n, nb = B.nb, rank = B.rank, cover = B.cover, towerOf = B.towerOf, keyOf = B.keyOf, gateOf = B.gateOf, hoff = B.hoff;
    const cap = Math.max(1, Math.min(MAXLINE, rules.hold | 0)), lethal = !!rules.archersKill && !B.safeArchers, deal = !!(opts && opts.deal), nt = B.towers.length;
    const merge = rules.mergeLeftovers === true, T = timeOf(rules.time);
    // Sappers are numbered per game: every dispatch is one pixel popped or one archer hit (at most one per squad, then
    // it is wary), so pixels + squads bounds them. Pending events: one per sapper in flight, plus a wake per space.
    const SQ = deal ? 4096 : B.ncards + 8, SMAX = B.pixTotal + SQ + 8, EMAX = SMAX + 4 * MAXLINE + 8;
    // Layout of the state buffer.
    let o = 0; const at = (k) => { const r = o; o += k; return r; };
    const oA = at(n), oD = at(n), oK = at(n), oP = at(n), oH = at(B.hoff[NMAT]), oHL = at(NMAT), oLeft = at(NMAT), oSap = at(NMAT), oT = at(MAXTOWERS),
      oHead = at(NCOL), oSM = at(MAXLINE), oSW = at(MAXLINE), oSO = at(MAXLINE), oSF = at(MAXLINE), oSN = at(MAXLINE), oSQ = at(MAXLINE), oOrd = at(MAXLINE),
      oS = at(24), oQS = at(SMAX), oQC = at(SMAX), oQK = at(SMAX), oQ0 = at(SMAX), oQ1 = at(SMAX), oQ2 = at(SMAX), oET = at(EMAX), oEQ = at(EMAX), oEX = at(EMAX);
    const M = new Int32Array(o), init = new Int32Array(o);
    const sub = (k, len) => M.subarray(k, k + len);
    const a = sub(oA, n), d = sub(oD, n), hk = sub(oK, n), hpos = sub(oP, n), heap = sub(oH, B.hoff[NMAT]);
    const hlen = sub(oHL, NMAT), left = sub(oLeft, NMAT), sap = sub(oSap, NMAT), tleft = sub(oT, MAXTOWERS), heads = sub(oHead, NCOL);
    // Spaces (the holding line): material, sappers waiting at the space, sappers out, flags (1 wary), next dispatch
    // time, tap number (0 = free). ord: occupied spaces in tap order (dispatch priority).
    const spM = sub(oSM, MAXLINE), spW = sub(oSW, MAXLINE), spO = sub(oSO, MAXLINE), spF = sub(oSF, MAXLINE), spN = sub(oSN, MAXLINE), spQ = sub(oSQ, MAXLINE), ord = sub(oOrd, MAXLINE);
    // Sappers: space, target cell, kind (1 eat, 2 hit and sent back, 3 killed), dispatch time, pop or hit time, home time.
    const qS = sub(oQS, SMAX), qC = sub(oQC, SMAX), qK = sub(oQK, SMAX), q0 = sub(oQ0, SMAX), q1 = sub(oQ1, SMAX), q2 = sub(oQ2, SMAX);
    // Event queue: a binary heap on (time, sequence); payload x = id * 4 + type (0 pop, 1 hit, 2 home, 3 wake a space).
    const eT = sub(oET, EMAX), eQ = sub(oEQ, EMAX), eX = sub(oEX, EMAX);
    // Scalars in M[oS + k].
    const S_LEN = oS, S_PIX = oS + 1, S_STAND = oS + 2, S_STATUS = oS + 3, S_REASON = oS + 4, S_HITS = oS + 5, S_KILLS = oS + 6, S_Z1 = oS + 7, S_Z2 = oS + 8,
      S_PEAK = oS + 9, S_PLAYS = oS + 10, S_FAILM = oS + 11, S_NOW = oS + 12, S_SN = oS + 13, S_EL = oS + 14, S_ESEQ = oS + 15, S_ORD = oS + 16, S_TAPS = oS + 17, S_OUT = oS + 18, S_DISP = oS + 19;
    const CLAIMED = -2;
    const q = new Int32Array(n);
    const ev = new Int32Array(3 * (4 * SMAX + 64)); let evLen = 0, evLost = false;
    let logOn = false;
    const log = (t, p, r) => { if (!logOn) return; if (evLen + 3 <= ev.length) { ev[evLen++] = t; ev[evLen++] = p; ev[evLen++] = r; } else evLost = true; };

    // Indexed min-heap per material over reachable, unclaimed pixels, keyed hk = distance * n + rank.
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
    // A claimed pixel (a sapper is on its way) is out of the heap and stays out: touch leaves it alone.
    function touch(p, dist) {
      const m = a[p]; if (m <= 0 || gateOf[p] >= 0 || hk[p] === CLAIMED) return;
      const key = dist * n + rank[p];
      if (hk[p] < 0) { hk[p] = key; const i = hlen[m]++; heap[hoff[m] + i] = p; up(m, i); } else if (key < hk[p]) { hk[p] = key; up(m, hpos[p]); }
    }
    function removeAt(m, i) {
      const base = hoff[m], c = heap[base + i], len = --hlen[m];
      if (i < len) { const mv = heap[base + len]; heap[base + i] = mv; hpos[mv] = i; down(m, i); up(m, hpos[mv]); }
      hpos[c] = -1; return c;
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
    // A wary squad's target: the nearest unclaimed reachable pixel outside every standing ring (a scan of its heap).
    function wareTarget(m) {
      if (!(m > 0 && m < NMAT) || !hlen[m]) return -1;
      if (!M[S_STAND]) return heap[hoff[m]];
      let best = -1, bk = 0; const base = hoff[m], len = hlen[m];
      for (let i = 0; i < len; i++) { const c = heap[base + i]; if (!covered(c) && (best < 0 || hk[c] < bk)) { best = c; bk = hk[c]; } }
      return best;
    }

    // ---- event queue -----------------------------------------------------------------------------------------------
    function push(t, x) {
      let i = M[S_EL]; if (i >= EMAX) return; M[S_EL] = i + 1; const s = M[S_ESEQ]++;
      while (i > 0) { const p = (i - 1) >> 1; if (eT[p] < t || (eT[p] === t && eQ[p] < s)) break; eT[i] = eT[p]; eQ[i] = eQ[p]; eX[i] = eX[p]; i = p; }
      eT[i] = t; eQ[i] = s; eX[i] = x;
    }
    function pop() {
      const x = eX[0], len = --M[S_EL];
      if (len > 0) {
        const t = eT[len], s = eQ[len], y = eX[len]; let i = 0;
        for (;;) {
          let l = 2 * i + 1; if (l >= len) break;
          const r = l + 1; if (r < len && (eT[r] < eT[l] || (eT[r] === eT[l] && eQ[r] < eQ[l]))) l = r;
          if (eT[l] > t || (eT[l] === t && eQ[l] > s)) break;
          eT[i] = eT[l]; eQ[i] = eQ[l]; eX[i] = eX[l]; i = l;
        }
        eT[i] = t; eQ[i] = s; eX[i] = y;
      }
      return x;
    }

    // ---- the rules -------------------------------------------------------------------------------------------------
    function eatCell(c, id) {
      const m = a[c];
      a[c] = DIRT; hk[c] = -1; left[m]--; M[S_PIX]--; M[S_Z1] ^= B.Z1[c]; M[S_Z2] ^= B.Z2[c]; log(EV.EAT, c, id);
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
    function fail(r, m) { M[S_STATUS] = FAILED; M[S_REASON] = r; M[S_FAILM] = m; }
    // Send one sapper of space s at pixel c at time t. Covered (and the squad not yet wary): an archer hit, the pixel
    // is not claimed, and the squad turns wary. Otherwise the pixel is claimed and pops when the sapper gets there.
    // Walk tiles = the pixel's distance key + 1 (the step to its face).
    function send(s, c, t) {
      const id = M[S_SN]; if (id >= SMAX) return false;
      M[S_SN] = id + 1; M[S_DISP]++;
      const m = spM[s], tiles = ((hk[c] / n) | 0) + 1, hit = (spF[s] & 1) === 0 && covered(c);
      qS[id] = s; qC[id] = c; q0[id] = t; spW[s]--; spO[s]++; M[S_OUT]++;
      if (hit) {
        const half = (tiles + 1) >> 1; spF[s] |= 1;
        qK[id] = lethal || deal ? 3 : 2; q1[id] = t + T.yardMs + half * T.tileMs; q2[id] = q1[id] + T.knockMs + T.yardMs + half * T.tileMs;
        push(q1[id], id * 4 + 1);
      } else {
        removeAt(m, hpos[c]); hk[c] = CLAIMED;
        qK[id] = 1; q1[id] = t + T.yardMs + tiles * T.tileMs + T.biteMs; q2[id] = q1[id] + T.yardMs + tiles * T.carryMs;
        push(q1[id], id * 4);
      }
      log(EV.DISP, id, s);
      return true;
    }
    // Every space with sappers waiting, in tap order, sends what it can: one sapper per staggerMs (all at once at 0),
    // each to the nearest unclaimed reachable pixel of its colour (a wary squad: the nearest outside the rings).
    function dispatch(t) {
      if (M[S_STATUS] !== PLAYING) return;
      const len = M[S_ORD];
      for (let k = 0; k < len; k++) {
        const s = ord[k];
        for (let g = spW[s]; g > 0 && spN[s] <= t; g--) {
          const c = spF[s] & 1 ? wareTarget(spM[s]) : target(spM[s]);
          if (c < 0 || !send(s, c, t)) break;
          if (T.staggerMs > 0) { spN[s] = t + T.staggerMs; if (spW[s] > 0) push(spN[s], s * 4 + 3); break; }
        }
      }
    }
    function freeIf(s) {
      if (spQ[s] === 0 || spW[s] > 0 || spO[s] > 0) return;
      spQ[s] = 0; M[S_LEN]--; log(EV.FREE, s, spM[s]);
      const len = M[S_ORD]; let j = 0; for (let k = 0; k < len; k++) if (ord[k] !== s) ord[j++] = ord[k]; M[S_ORD] = j;
    }
    function handle(x, t) {
      const type = x & 3, id = x >> 2;
      if (type === 0) { // the sapper reaches its pixel: it pops, then the sapper carries it home
        const c = qC[id], m = a[c];
        if (m > 0) { eatCell(c, id); sap[m]--; }
        push(q2[id], id * 4 + 2);
        if (M[S_PIX] === 0 && M[S_STATUS] === PLAYING) M[S_STATUS] = WON;
      } else if (type === 1) { // an arrow: sent back to its space (Easy, Normal) or killed (Hard)
        const s = qS[id], m = spM[s]; M[S_HITS]++;
        if (qK[id] === 3) {
          M[S_KILLS]++; sap[m]--; spO[s]--; M[S_OUT]--; log(EV.KILL, id, m);
          if (M[S_STATUS] === PLAYING && (deal || sap[m] < left[m])) fail(SHORT, m);
          freeIf(s);
        } else { log(EV.HIT, id, m); push(q2[id], id * 4 + 2); }
      } else if (type === 2) { // home: a hit sapper rejoins its squad; the space frees when its squad is all home
        const s = qS[id]; spO[s]--; M[S_OUT]--; if (qK[id] === 2) spW[s]++;
        log(EV.HOME, id, s); freeIf(s);
      }
      // type 3: a space's stagger is up; dispatch runs after every batch of events
    }
    // Would a tap on a card of m be refused? Only when there is no free space (and it can't merge).
    function blocked(m) {
      if (M[S_LEN] < cap) return false;
      if (merge) for (let k = 0; k < M[S_ORD]; k++) if (spM[ord[k]] === m) return false;
      return true;
    }
    // After every batch: the win, and once nothing is moving (no event pending), stuck and jam. At rest no squad can
    // send anyone (it would have), so a full line at rest is a line of squads that can't reach a pixel.
    function settle() {
      if (M[S_STATUS] !== PLAYING) return;
      if (M[S_PIX] === 0) { M[S_STATUS] = WON; return; }
      if (deal || M[S_EL] > 0) return;
      let any = false, safe = false;
      for (let j = 0; j < NCOL; j++) { if (heads[j] >= B.colLen[j]) continue; any = true; if (!blocked(B.cardM[B.colStart[j] + heads[j]])) { safe = true; break; } }
      if (!any) fail(STUCK, M[S_ORD] > 0 ? spM[ord[0]] : 0);
      else if (!safe) fail(JAM, M[S_ORD] > 0 ? spM[ord[0]] : 0);
    }
    // Run every event up to time t (each batch of equal-time events, then dispatch, then settle), and set the clock to t.
    function advanceTo(t) {
      t = Math.max(M[S_NOW], Math.min(2e9, Math.floor(t)));
      for (let guard = 0; guard < 4 * EMAX + 4 * SMAX && M[S_EL] > 0 && eT[0] <= t; guard++) {
        const te = eT[0]; M[S_NOW] = te;
        for (let g = 0; g < EMAX && M[S_EL] > 0 && eT[0] === te; g++) handle(pop(), te);
        dispatch(te); settle();
      }
      M[S_NOW] = t;
      return M[S_STATUS];
    }
    // Run until nothing is moving (the patient player's wait). Returns the clock.
    function quiet() {
      for (let guard = 0; guard < 4 * EMAX + 4 * SMAX && M[S_EL] > 0; guard++) { const te = eT[0]; M[S_NOW] = te; advanceTo(te); }
      return M[S_NOW];
    }
    // A squad takes a space at time t (the clock first runs to t). No free space (and no merge): overflow, which only
    // dealing mode reaches (play() refuses first).
    function tap(m, cnt, t) {
      if (t != null) advanceTo(t);
      if (M[S_STATUS] !== PLAYING) return M[S_STATUS];
      M[S_PLAYS]++;
      let s = -1;
      if (merge) for (let k = 0; k < M[S_ORD]; k++) if (spM[ord[k]] === m) { s = ord[k]; spW[s] += cnt; break; }
      if (s < 0) {
        if (M[S_LEN] >= cap) { fail(OVERFLOW, m); log(EV.TAP, -1, m); return M[S_STATUS]; }
        for (s = 0; s < cap && spQ[s] !== 0; s++);
        spM[s] = m; spW[s] = cnt; spO[s] = 0; spF[s] = 0; spN[s] = M[S_NOW]; spQ[s] = ++M[S_TAPS]; ord[M[S_ORD]++] = s;
        M[S_LEN]++; if (M[S_LEN] > M[S_PEAK]) M[S_PEAK] = M[S_LEN];
      }
      log(EV.TAP, s, m);
      dispatch(M[S_NOW]); settle();
      return M[S_STATUS];
    }
    // Tap column col at time t (the clock first runs to t). Returns the status, NOPLAY (not playable) or REFUSED (no
    // free space: a no-op, the card stays at the front and nothing in the state changes).
    function play(col, t) {
      if (M[S_STATUS] !== PLAYING || col < 0 || col >= NCOL || heads[col] >= B.colLen[col]) return NOPLAY;
      if (t != null) { advanceTo(t); if (M[S_STATUS] !== PLAYING) return NOPLAY; }
      const ci = B.colStart[col] + heads[col];
      if (!deal && blocked(B.cardM[ci])) return REFUSED;
      heads[col]++;
      return tap(B.cardM[ci], B.cardN[ci], null);
    }
    // A squad at space s that can't send anyone now: all its sappers are home and its colour has no pixel it may go
    // for (a wary squad: none outside the rings). The page marks it stuck; a line of them is a jam.
    function stuckAt(s) {
      if (s < 0 || s >= cap || !spQ[s] || spO[s] > 0 || spW[s] <= 0) return false;
      return (spF[s] & 1 ? wareTarget(spM[s]) : target(spM[s])) < 0;
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

    // Position hash (the patient solver's memo): eaten cells, heads, spaces in tap order, status. Meant for quiet states.
    const hash = () => {
      let h1 = M[S_Z1] ^ 0x1234567, h2 = M[S_Z2] ^ 0x7654321;
      for (let j = 0; j < NCOL; j++) { h1 = Math.imul(h1 ^ heads[j], 0x9E3779B1); h2 = Math.imul(h2 ^ (heads[j] + 17), 0x85EBCA77); }
      for (let k = 0; k < M[S_ORD]; k++) { const s = ord[k], v = spM[s] * 65536 + (spW[s] + spO[s]) * 4 + (spF[s] & 1) * 2; h1 = Math.imul(h1 ^ v, 0xC2B2AE3D); h2 = Math.imul(h2 ^ (v + 0x3141), 0x27D4EB2F); }
      h1 ^= M[S_STATUS] * 0x51ED27; h1 ^= h1 >>> 15; h2 ^= h2 >>> 13;
      return (h1 >>> 0) * 2097152 + (h2 >>> 11);
    };
    return {
      B, M, a, d, heads, left, cap, lethal, ev, T, SMAX, target, covered, wareTarget, hash, play, advanceTo, quiet,
      spM, spW, spO, spF, spQ, qS, qC, qK, q0, q1, q2,
      // Dealing: a squad of m and n at the clock (or at t). The patient caller then runs quiet().
      playSquad: (m, cnt, t) => tap(m, cnt, t == null ? M[S_NOW] : t),
      get logOn() { return logOn; }, set logOn(v) { logOn = !!v; },
      reset() { M.set(init); evLen = 0; evLost = false; },
      save(buf) { (buf || (buf = new Int32Array(M.length))).set(M); return buf; },
      load(buf) { M.set(buf); },
      clearLog() { evLen = 0; evLost = false; },
      get evLen() { return evLen; }, get evLost() { return evLost; },
      get status() { return M[S_STATUS]; }, get reason() { return REASONS[M[S_REASON]]; }, get failMat() { return M[S_FAILM]; },
      get lineLen() { return M[S_LEN]; }, get pixLeft() { return M[S_PIX]; }, get standing() { return M[S_STAND]; },
      get hits() { return M[S_HITS]; }, get kills() { return M[S_KILLS]; }, get peak() { return M[S_PEAK]; }, get plays() { return M[S_PLAYS]; },
      get now() { return M[S_NOW]; }, get busy() { return M[S_EL] > 0; }, get out() { return M[S_OUT]; }, get sent() { return M[S_SN]; },
      get nextAt() { return M[S_EL] > 0 ? eT[0] : -1; },
      // Spaces in tap order (the holding line as the player reads it).
      order: (out) => { out = out || []; out.length = 0; for (let k = 0; k < M[S_ORD]; k++) out.push(ord[k]); return out; },
      sappers: (m) => sap[m],
      front(j) { return heads[j] < B.colLen[j] ? B.colStart[j] + heads[j] : -1; },
      blocked: (m) => blocked(m), stuck: (s) => stuckAt(s),
      // Reachable, unclaimed pixels of m right now (tools and UI; not on the hot path).
      reachable(m) { return m > 0 && m < NMAT ? hlen[m] : 0; },
    };
  }

  // Replay a column order patiently ("0123..."): tap, run until nothing moves, tap again. Returns the sim.
  function replay(B, rules, order) {
    const S = sim(B, rules);
    for (let i = 0; i < order.length && S.status === PLAYING; i++) { if (S.play(order.charCodeAt(i) - 48) < -1) break; S.quiet(); }
    S.quiet();
    return S;
  }
  // The engine rules for one difficulty: config v3.rules[d] with v3.time (and the comparison flags) attached.
  const rulesOf = (v3, d) => Object.assign({}, v3.rules[d] || v3.rules.normal, { time: v3.time }, v3.flags || {});
  const gridOf = (w, h, a) => { const g = []; for (let y = 0; y < h; y++) { let s = ""; for (let x = 0; x < w; x++) s += chOf(a[y * w + x]); g.push(s); } return g; };

  return { compile, sim, replay, rulesOf, timeOf, gridOf, chOf, matOf, GRASS, WATER, DIRT, CAMP, NCOL, NMAT, IRON, GILT, PLAYING, WON, FAILED, NOPLAY, REFUSED, EV, REASONS };
});
