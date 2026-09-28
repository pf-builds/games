// Sapper's Path v3 slow reference rules (SPEC-v3 §2-4 + §9), written independently of src/engine.js for differential
// tests: a full camp BFS before every pixel, a scan of every pixel for the nearest, plain arrays everywhere. Same level
// JSON and the same rules; nothing shared with the engine but the file format.
"use strict";
const MATCH = { ".": 0, ",": -2, "~": -1, "#": -3 };
const IRON = 10;

function load(L) {
  const w = L.w, h = L.h, g = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = L.grid[y][x]; g.push(ch in MATCH ? MATCH[ch] : ch.charCodeAt(0) - 96); }
  let campRow = h; g.forEach((v, i) => { if (v === -3) campRow = Math.min(campRow, Math.floor(i / w)); });
  const idx = (p) => p[1] * w + p[0];
  const flood = (c0, ok) => { const out = [c0], seen = new Set([c0]); for (let k = 0; k < out.length; k++) { const c = out[k], x = c % w, y = Math.floor(c / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, e = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < h && !seen.has(e) && ok(e)) { seen.add(e); out.push(e); } } } return out; };
  const gates = (L.gates || []).map((G) => ({ cells: flood(idx(G.at), (e) => g[e] === IRON), key: idx(G.key) }));
  const towers = (L.towers || []).map((T) => { const m = g[idx(T.at)], cells = flood(idx(T.at), (e) => g[e] === m);
    const cx = cells.reduce((s, c) => s + (c % w), 0) / cells.length, cy = cells.reduce((s, c) => s + Math.floor(c / w), 0) / cells.length; return { cells, cx, cy, r: T.r }; });
  const cols = L.cols.map((c) => c.map((cd) => ({ m: cd[0], n: cd[1] })));
  return { w, h, g, campRow, gates, towers, cols };
}

function game(L, rules) {
  const R = load(L), w = R.w, h = R.h, g = R.g.slice(), cols = R.cols, heads = [0, 0, 0, 0, 0], line = [];
  const sap = {}; cols.forEach((c) => c.forEach((cd) => { sap[cd.m] = (sap[cd.m] || 0) + cd.n; }));
  let status = "playing", reason = "", peak = 0; const eaten = [];
  const walk = (v) => v === 0 || v === -2 || v === -3;
  function dist() {
    const d = new Array(w * h).fill(-1), q = []; g.forEach((v, i) => { if (v === -3) { d[i] = 0; q.push(i); } });
    for (let k = 0; k < q.length; k++) { const c = q[k], x = c % w, y = Math.floor(c / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const e = ny * w + nx; if (d[e] < 0 && walk(g[e])) { d[e] = d[c] + 1; q.push(e); } } }
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
  function nearest(m) {
    const d = dist(); let best = -1, bk = null;
    for (let c = 0; c < w * h; c++) {
      if (g[c] !== m || isGate(c)) continue;
      const x = c % w, y = Math.floor(c / w); let t = Infinity;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const e = ny * w + nx; if (d[e] >= 0) t = Math.min(t, d[e]); }
      if (t === Infinity) continue;
      const k = [t, Math.abs(y - R.campRow), x, y];
      if (!bk || better(k, bk)) { best = c; bk = k; }
    }
    return best;
  }
  const left = () => g.filter((v) => v > 0).length;
  function eat(c) {
    eaten.push(c); g[c] = -2;
    for (const G of R.gates) if (G.key === c) for (const gc of G.cells) g[gc] = -2;
  }
  // Returns [eaten, stop] with stop "none" | "covered" | "done".
  function march(m, n) {
    let k = 0;
    while (k < n) { const c = nearest(m); if (c < 0) return [k, "none"]; if (covered(c)) return [k, "covered"]; eat(c); k++; if (!left()) break; }
    return [k, "done"];
  }
  function join(m, n) {
    const e = line.find((s) => s.m === m); if (e) { e.n += n; return; }
    if (line.length >= rules.hold) { status = "failed"; reason = "overflow"; return; }
    line.push({ m, n }); peak = Math.max(peak, line.length);
  }
  function cascade() {
    for (let guard = 0; guard < 100000; guard++) {
      if (!left()) return;
      const i = line.findIndex((s) => { const t = nearest(s.m); return t >= 0 && !covered(t); });
      if (i < 0) return;
      const [k] = march(line[i].m, line[i].n); sap[line[i].m] -= k; line[i].n -= k; if (line[i].n <= 0) line.splice(i, 1);
    }
    throw new Error("ref: cascade did not settle");
  }
  function cardFails(m, n) {
    const t = nearest(m);
    if (t >= 0 && !covered(t)) return false;
    if (t >= 0 && rules.archersKill) return sap[m] - n < g.filter((v) => v === m).length;
    return !line.some((s) => s.m === m) && line.length >= rules.hold;
  }
  function play(j) {
    if (status !== "playing" || heads[j] >= cols[j].length) return;
    const { m, n } = cols[j][heads[j]++];
    const [k, stop] = march(m, n); sap[m] -= k; const rest = n - k;
    if (rest > 0 && left()) {
      if (stop === "covered" && rules.archersKill) { sap[m] -= rest; if (sap[m] < g.filter((v) => v === m).length) { status = "failed"; reason = "short"; } }
      else join(m, rest);
    }
    if (status === "playing") cascade();
    if (status !== "playing") return;
    if (!left()) { status = "won"; return; }
    const fronts = cols.map((c, i) => c[heads[i]]).filter(Boolean);
    if (!fronts.length) { status = "failed"; reason = "stuck"; return; }
    if (fronts.every((cd) => cardFails(cd.m, cd.n))) { status = "failed"; reason = "nomove"; }
  }
  return { play, get status() { return status; }, get reason() { return reason; }, get peak() { return peak; }, line, g, eaten, heads };
}

module.exports = { game };
