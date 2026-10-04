// Sapper's Path v3 slow reference rules (SPEC-v3 §2-4 + §9, the dispatch model from playtest 1), written independently
// of src/engine.js for differential tests: plain objects and arrays, a full camp BFS before every target pick, a scan of
// every pixel for the nearest, and the event list scanned for its earliest entry every step. Same level JSON, the same
// rules and the same config timing; nothing shared with the engine but the file format.
//   game(L, rules) -> {play(col, t?), advanceTo(t), quiet(), status, reason, now, spaces, pops, ...}
// v3.1: a tap with no free space is refused (play returns "refused", the card stays, nothing changes); the overflow fail
// is gone, and a full line at rest is a jam (every space held by a squad that can't reach a pixel).
// v4 M2 (SPEC-v4 §9), from the rules text: each column is a list of the cards still in it, front first. A mystery card
// is hidden while it sits behind the front of its list. A linked front card needs 2 free open spaces; it and its partner
// leave their lists (the partner from wherever it is) and take the two lowest free spaces, tapped card first; the two
// spaces free together once both squads are done. A lock keeps the last lockSpaces (1) spaces shut until its key pixel
// pops. At rest with cards left, if no front card's tap would be taken, the level jams (jamWhy: 1 a space was free,
// 2 a space was still locked).
// v4.1 (SPEC-v4 §9, from the rules text): v4 M4's ring levels are retired (no level carries ring: true). A picture board
// (pic: true) is entered from its camp, the entry square in the bottom border row, so every level uses the camp rules
// above: walks from the camp, ties to the row nearest the camp row, then the lower x, then the lower y.
// v4 M5 (SPEC-v4 §9, the power-ups, from the rules text): power(k, a, t) -> undefined (taken), "refused" or nothing (the
// game is over). Each level allows rules.powers[k] uses. A card seen at the front of its list stays face up. Ladder (0):
// one more space, at most 8 in the line. Quartermaster (1, a = a card's file index): a card 1..rules.pullDepth (2) places
// behind the front of its list moves to the front; at rest, refused if every front card would then be refused. Scout
// (2): every hidden card turns face up; refused if none is hidden. Recall (3, a = a space): an unlinked squad with
// sappers waiting and none out goes back to the front of the list it was tapped from, as a card of the sappers waiting,
// and its space is free.
// v4.3 (SPEC-v4 §9, the v4.3 entry, from the rules text): a squad holds its space while any of its sappers waits at it,
// walks out to a pixel, or (no kills) walks back after an arrow; the moment none does (its last block picked up, the
// pixel popped), the space is free, though its carriers are still walking home (a pair: once both squads are there).
// A linked card can be tapped only while its partner is the front of the partner's list too; then both go as before.
// A linked front whose partner is buried counts as refused at rest, and the jam's jamWhy adds 4.
// v5 R1 (SPEC-v4 §9, the v5 R1 entry, from the rules text): rules.hold spaces on every level. Archers never kill: an
// arrow always sends its sapper back to its space to wait, on every level (no short fail).
// A colour lock (lock: {colour: m}) keeps its spaces shut until a squad of colour m takes a space (a tap or a pair).
// The continue (revive(), rules.continues per attempt): offered only when the game failed jammed and, with the line
// emptied, some front card could be tapped (unlinked: a space open; linked: its partner at a front and 2 spaces open).
// Then play goes on: for each squad in the line, in the order they were tapped, as many of its colour's standing pixels
// as it has sappers waiting are removed, nearest the entry square first (the squared distance from the middle of the
// camp's run, measured in half cells, then the usual tie-break), and its space empties (a pair once both are done).
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
  // Cards carry their place in the file (ci: the running index over the columns, front first) so tests can name them.
  let ci = 0;
  const cols = L.cols.map((c, j) => c.map((cd) => ({ m: cd[0], n: cd[1], mystery: cd[2] === 1, ci: ci++, partner: null, col: j, seen: false })));
  for (const P of L.links || []) { const a = cols[P[0][0]][P[0][1]], b = cols[P[1][0]][P[1][1]]; a.partner = b; b.partner = a; }
  const lockKey = L.lock && L.lock.key ? idx(L.lock.key) : -1, lockColour = L.lock && L.lock.colour ? L.lock.colour : 0;
  return { w, h, g, campRow, gates, towers, cols, lockKey, lockColour };
}

function game(L, rules) {
  const Tm = rules.time, R = load(L), w = R.w, h = R.h, g = R.g.slice(), cols = R.cols.map((c) => c.slice());
  const sap = {}; cols.forEach((c) => c.forEach((cd) => { sap[cd.m] = (sap[cd.m] || 0) + cd.n; }));
  const spaces = [];           // {m, wait, out, wary, next, seq, pair}; index = space number, null = free; pair: the partner's space;
                               // out (v4.3): sappers walking out to a pixel or back after an arrow (carriers don't count)
  const events = [];           // {t, seq, kind: "pop" | "hit" | "home" | "wake", sapper?, space?}
  const claimed = new Set(), pops = [];
  let status = "playing", reason = "", jamWhy = 0, now = 0, seq = 0, taps = 0, peak = 0, hitsN = 0, killsN = 0;
  let locked = R.lockKey >= 0 || R.lockColour ? Math.max(0, Math.min(rules.hold - 1, rules.lockSpaces == null ? 1 : rules.lockSpaces)) : 0;
  let extra = 0, revived = 0; const uses = [0, 0, 0, 0], limits = rules.powers || [0, 0, 0, 0], reach = rules.pullDepth == null ? 2 : rules.pullDepth;
  const seeFronts = () => { for (const c of cols) if (c.length) c[0].seen = true; };
  seeFronts();
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
  // Spaces a squad may take: the line's, less the locked ones. Free: open spaces nobody holds.
  const openN = () => rules.hold + extra - locked, used = () => spaces.filter(Boolean).length, free = () => openN() - used();
  const done = (s) => s.wait === 0 && s.out === 0;
  function freeIf(i) {
    const s = spaces[i]; if (!s || !done(s)) return;
    if (s.pair == null) { spaces[i] = null; return; }
    const o = spaces[s.pair]; if (o && !done(o)) return;
    spaces[s.pair] = null; spaces[i] = null;
  }
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
        for (const G of R.gates) if (G.key === q.cell) for (const gc of G.cells) g[gc] = -2;
        if (q.cell === R.lockKey) locked = 0; }
      schedule(q.back, "home", { sapper: Object.assign({}, q, { hit: false }) });
      if (!left() && status === "playing") status = "won";
      spaces[q.space].out--; freeIf(q.space); // the block is picked up: the carrier no longer holds the space
    } else if (e.kind === "hit") {
      hitsN++; schedule(q.back, "home", { sapper: Object.assign({}, q, { hit: true }) });
    } else if (e.kind === "home") { // only a sapper sent back by an arrow rejoins its squad; a carrier is just home
      if (q.hit) { const s = spaces[q.space]; s.out--; s.wait++; freeIf(q.space); }
    }
  }
  const need = (cd) => (cd.partner ? 2 : 1);
  // A linked card's partner must be the front of the list it is in (v4.3).
  const buried = (cd) => !!cd.partner && !cols.some((c) => c[0] === cd.partner);
  const refusedCard = (cd) => buried(cd) || need(cd) > free();
  function settle() {
    if (status !== "playing") return;
    if (!left()) { status = "won"; return; }
    if (events.length) return;
    const fronts = cols.map((c) => c[0]).filter(Boolean);
    if (!fronts.length) fail("stuck");
    else if (fronts.every(refusedCard)) { fail("jam"); jamWhy = (free() > 0 ? 1 : 0) | (locked > 0 ? 2 : 0) | (fronts.some(buried) ? 4 : 0); }
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
  function take(cd) {
    let i = 0; while (spaces[i]) i++;
    taps++; spaces[i] = { m: cd.m, wait: cd.n, out: 0, wary: false, next: now, seq: taps, pair: null, card: cd };
    return i;
  }
  function play(j, t) {
    if (status !== "playing" || !cols[j].length) return;
    if (t != null) { advanceTo(t); if (status !== "playing") return; }
    const cd = cols[j][0];
    if (refusedCard(cd)) return "refused";
    cols[j].shift();
    const i = take(cd);
    if (cd.partner) { const pc = cols.find((c) => c.includes(cd.partner)); pc.splice(pc.indexOf(cd.partner), 1); cd.partner.seen = true; const k = take(cd.partner); spaces[i].pair = k; spaces[k].pair = i; }
    if (R.lockColour && (cd.m === R.lockColour || (cd.partner && cd.partner.m === R.lockColour))) locked = 0;
    peak = Math.max(peak, used());
    seeFronts(); dispatch(now); settle();
  }
  // Is the card with file index ci hidden: a mystery card still in its column, behind the front, never seen face up.
  const hidden = (ci) => cols.some((c) => c.some((cd, k) => k > 0 && cd.ci === ci && cd.mystery && !cd.seen));
  function power(k, a, t) {
    if (status !== "playing") return;
    if (t != null) { advanceTo(t); if (status !== "playing") return; }
    if (!(uses[k] < limits[k])) return "refused";
    if (k === 0) { if (rules.hold + extra >= 8) return "refused"; extra++; }
    else if (k === 1) {
      const c = cols.find((q) => q.some((cd) => cd.ci === a)), i = c ? c.findIndex((cd) => cd.ci === a) : -1;
      if (i < 1 || i > reach) return "refused";
      if (!events.length) { // at rest: refused if every front would then be refused
        const trial = cols.map((q) => (q === c ? [c[i]].concat(c.filter((x, k) => k !== i)) : q)), fr = trial.map((q) => q[0]).filter(Boolean);
        const bur = (cd) => !!cd.partner && !trial.some((q) => q[0] === cd.partner);
        if (fr.every((cd) => bur(cd) || need(cd) > free())) return "refused"; }
      const [cd] = c.splice(i, 1); c.unshift(cd);
    } else if (k === 2) {
      const hid = []; for (const c of cols) c.forEach((cd, i) => { if (i > 0 && cd.mystery && !cd.seen) hid.push(cd); });
      if (!hid.length) return "refused";
      for (const cd of hid) cd.seen = true;
    } else if (k === 3) {
      const s = spaces[a]; if (!s || s.pair != null || s.out > 0 || s.wait === 0 || !s.card) return "refused";
      s.card.n = s.wait; cols[s.card.col].unshift(s.card); spaces[a] = null;
    } else return "refused";
    uses[k]++; seeFronts(); settle();
  }
  // A pixel goes without a sapper (the continue): as a pop would, its gate or lock opens; nobody carries it.
  let clearedN = 0;
  function remove(c) { const m = g[c]; g[c] = -2; sap[m]--; clearedN++; for (const G of R.gates) if (G.key === c) for (const gc of G.cells) g[gc] = -2; if (c === R.lockKey) locked = 0; }
  function nearOrder() {
    const camp = []; g.forEach((v, i) => { if (v === -3 && Math.floor(i / w) === R.campRow) camp.push(i % w); });
    const mid2 = Math.min(...camp) + Math.max(...camp), key = (c) => { const x = c % w, y = Math.floor(c / w); return [(2 * x - mid2) ** 2 + (2 * (y - R.campRow)) ** 2, Math.abs(y - R.campRow), x, y]; };
    return g.map((_, c) => c).sort((p, q) => { const a = key(p), b = key(q); for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; });
  }
  function revive() {
    if (status !== "failed" || reason !== "jam" || revived >= (rules.continues || 0)) return "refused";
    const open = openN(), ok = cols.some((c) => c.length && (c[0].partner ? !buried(c[0]) && open >= 2 : open >= 1));
    if (!ok) return "refused";
    status = "playing"; reason = ""; jamWhy = 0; revived++;
    const near = nearOrder(), order = spaces.map((s, i) => [s, i]).filter(([s]) => s).sort((p, q) => p[0].seq - q[0].seq);
    for (const [s, i] of order) { let k = s.wait; s.wait = 0; for (const c of near) { if (k <= 0) break; if (g[c] === s.m && !isGate(c)) { remove(c); k--; } } freeIf(i); }
    if (!left()) status = "won";
    dispatch(now); settle();
  }
  return { play, power, revive, advanceTo, quiet, hidden, get revived() { return revived; }, get cleared() { return clearedN; }, get status() { return status; }, get reason() { return reason; }, get now() { return now; }, get peak() { return peak; }, get extra() { return extra; },
    get hits() { return hitsN; }, get kills() { return killsN; }, get open() { return openN(); }, get locked() { return locked; }, get jamWhy() { return jamWhy; },
    spaces, pops, g, cols };
}

module.exports = { game };
