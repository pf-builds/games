// Sapper's Path v3 slow reference rules (SPEC-v3 §2-4 + §9, the dispatch model from playtest 1), written independently
// of src/engine.js for differential tests: plain objects and arrays, a full camp BFS before every target pick, a scan of
// every pixel for the nearest, and the event list scanned for its earliest entry every step. Same level JSON, the same
// rules and the same config timing; nothing shared with the engine but the file format.
//   game(L, rules) -> {play(col, t?), advanceTo(t), quiet(), status, reason, now, spaces, pops, ...}
// pops: every popped pixel as [cell, time], in the order they popped.
"use strict";
const MATCH = { ".": 0, ",": -2, "~": -1, "#": -3 };
const IRON = 10;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function load(L) {
  const w = L.w, h = L.h, g = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = L.grid[y][x]; g.push(ch in MATCH ? MATCH[ch] : ch.charCodeAt(0) - 96); }
  let campRow = h; g.forEach((v, i) => { if (v === -3) campRow = Math.min(campRow, Math.floor(i / w)); });
  const idx = (p) => p[1] * w + p[0];
  const flood = (c0, ok) => { const out = [c0], seen = new Set([c0]); for (let k = 0; k < out.length; k++) { const c = out[k], x = c % w, y = Math.floor(c / w);
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, e = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < h && !seen.has(e) && ok(e)) { seen.add(e); out.push(e); } } } return out; };
  const gates = (L.gates || []).map((G) => ({ cells: flood(idx(G.at), (e) => g[e] === IRON), key: idx(G.key) }));
  const towers = (L.towers || []).map((T) => { const m = g[idx(T.at)], cells = flood(idx(T.at), (e) => g[e] === m);
    const cx = cells.reduce((s, c) => s + (c % w), 0) / cells.length, cy = cells.reduce((s, c) => s + Math.floor(c / w), 0) / cells.length; return { cells, cx, cy, r: T.r }; });
  const cols = L.cols.map((c) => c.map((cd) => ({ m: cd[0], n: cd[1] })));
  return { w, h, g, campRow, gates, towers, cols };
}

function game(L, rules) {
  const kills = rules.archersKill && L.safeArchers !== true;
  const Tm = rules.time, R = load(L), w = R.w, h = R.h, g = R.g.slice(), cols = R.cols, heads = [0, 0, 0, 0, 0];
  const sap = {}; cols.forEach((c) => c.forEach((cd) => { sap[cd.m] = (sap[cd.m] || 0) + cd.n; }));
  const spaces = [];           // {m, wait, out, wary, next, seq}; index = space number, null = free
  const events = [];           // {t, seq, kind: "pop" | "hit" | "home" | "wake", sapper?, space?}
  const claimed = new Set(), pops = [];
  let status = "playing", reason = "", now = 0, seq = 0, taps = 0, peak = 0, hitsN = 0, killsN = 0;
  const walk = (v) => v === 0 || v === -2 || v === -3;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : y * w + x);
  function dist() {
    const d = new Array(w * h).fill(-1), q = []; g.forEach((v, i) => { if (v === -3) { d[i] = 0; q.push(i); } });
    for (let k = 0; k < q.length; k++) { const c = q[k]; for (const [dx, dy] of DIRS) { const e = at(c % w + dx, Math.floor(c / w) + dy); if (e !== null && d[e] < 0 && walk(g[e])) { d[e] = d[c] + 1; q.push(e); } } }
    return d;
  }
  const isGate = (c) => R.gates.some((G) => G.cells.includes(c) && g[c] === IRON);
  const towerPix = (c) => R.towers.some((T) => T.cells.includes(c));
  function covered(c) {
    if (towerPix(c)) return false;
    const x = c % w, y = Math.floor(c / w);
    return R.towers.some((T) => T.cells.some((tc) => g[tc] > 0) && (x - T.cx) ** 2 + (y - T.cy) ** 2 <= T.r * T.r);
  }
  const better = (k, b) => { for (let i = 0; i < 4; i++) if (k[i] !== b[i]) return k[i] < b[i]; return false; };
  // Nearest unclaimed reachable pixel of m (wary: outside every standing ring): [cell, walk distance] or null.
  function nearest(m, wary) {
    const d = dist(); let best = null, bk = null;
    for (let c = 0; c < w * h; c++) {
      if (g[c] !== m || isGate(c) || claimed.has(c) || (wary && covered(c))) continue;
      const x = c % w, y = Math.floor(c / w); let t = Infinity;
      for (const [dx, dy] of DIRS) { const e = at(x + dx, y + dy); if (e !== null && d[e] >= 0) t = Math.min(t, d[e]); }
      if (t === Infinity) continue;
      const k = [t, Math.abs(y - R.campRow), x, y];
      if (!bk || better(k, bk)) { best = [c, t]; bk = k; }
    }
    return best;
  }
  const left = (m) => g.filter((v) => (m == null ? v > 0 : v === m)).length;
  const schedule = (t, kind, extra) => events.push(Object.assign({ t, seq: seq++, kind }, extra));
  const fail = (r) => { status = "failed"; reason = r; };
  function freeIf(i) { const s = spaces[i]; if (s && s.wait === 0 && s.out === 0) spaces[i] = null; }
  function send(i, c, tiles, t) {
    const s = spaces[i]; s.wait--; s.out++;
    if (!s.wary && covered(c)) {
      s.wary = true; const half = Math.ceil(tiles / 2), hitT = t + Tm.yardMs + half * Tm.tileMs;
      schedule(hitT, "hit", { sapper: { space: i, m: s.m, back: hitT + Tm.knockMs + Tm.yardMs + half * Tm.tileMs } });
    } else {
      claimed.add(c); const popT = t + Tm.yardMs + tiles * Tm.tileMs + Tm.biteMs;
      schedule(popT, "pop", { sapper: { space: i, m: s.m, cell: c, back: popT + Tm.yardMs + tiles * Tm.carryMs } });
    }
  }
  function dispatch(t) {
    if (status !== "playing") return;
    const order = spaces.map((s, i) => [s, i]).filter(([s]) => s).sort((p, q) => p[0].seq - q[0].seq);
    for (const [s, i] of order) {
      while (s.wait > 0 && s.next <= t) {
        const got = nearest(s.m, s.wary); if (!got) break;
        send(i, got[0], got[1] + 1, t);
        if (Tm.staggerMs > 0) { s.next = t + Tm.staggerMs; if (s.wait > 0) schedule(s.next, "wake", { space: i }); break; }
      }
    }
  }
  function handle(e) {
    const q = e.sapper;
    if (e.kind === "pop") {
      if (g[q.cell] > 0) { const m = g[q.cell]; g[q.cell] = -2; claimed.delete(q.cell); pops.push([q.cell, e.t]); sap[m]--;
        for (const G of R.gates) if (G.key === q.cell) for (const gc of G.cells) g[gc] = -2; }
      schedule(q.back, "home", { sapper: Object.assign({}, q, { hit: false }) });
      if (!left() && status === "playing") status = "won";
    } else if (e.kind === "hit") {
      hitsN++;
      if (kills) { killsN++; sap[q.m]--; spaces[q.space].out--; if (status === "playing" && sap[q.m] < left(q.m)) fail("short"); freeIf(q.space); }
      else schedule(q.back, "home", { sapper: Object.assign({}, q, { hit: true }) });
    } else if (e.kind === "home") {
      const s = spaces[q.space]; s.out--; if (q.hit) s.wait++; freeIf(q.space);
    }
  }
  function settle() {
    if (status !== "playing") return;
    if (!left()) { status = "won"; return; }
    if (events.length) return;
    const fronts = cols.map((c, i) => c[heads[i]]).filter(Boolean);
    if (!fronts.length) fail("stuck");
    else if (spaces.filter(Boolean).length >= rules.hold) fail("nomove");
  }
  function advanceTo(t) {
    for (let guard = 0; guard < 1e6; guard++) {
      if (!events.length) break;
      const te = Math.min(...events.map((e) => e.t)); if (te > t) break;
      now = te;
      for (;;) { const due = events.filter((e) => e.t === te); if (!due.length) break; const e = due.reduce((p, q) => (q.seq < p.seq ? q : p)); events.splice(events.indexOf(e), 1); handle(e); }
      dispatch(te); settle();
    }
    now = Math.max(now, t);
  }
  function quiet() { for (let guard = 0; guard < 1e6 && events.length; guard++) advanceTo(Math.min(...events.map((e) => e.t))); }
  function play(j, t) {
    if (status !== "playing" || heads[j] >= cols[j].length) return;
    if (t != null) { advanceTo(t); if (status !== "playing") return; }
    const { m, n } = cols[j][heads[j]++]; taps++;
    let i = -1;
    for (let k = 0; k < rules.hold; k++) if (!spaces[k]) { i = k; break; }
    if (i < 0) { fail("overflow"); return; }
    spaces[i] = { m, wait: n, out: 0, wary: false, next: now, seq: taps };
    peak = Math.max(peak, spaces.filter(Boolean).length);
    dispatch(now); settle();
  }
  return { play, advanceTo, quiet, get status() { return status; }, get reason() { return reason; }, get now() { return now; }, get peak() { return peak; },
    get hits() { return hitsN; }, get kills() { return killsN; }, spaces, pops, g, heads };
}

module.exports = { game };
