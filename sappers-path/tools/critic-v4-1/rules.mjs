// Critic v4-1: an independent implementation of Sapper's Path rules, written ONLY from SPEC-v3 (§1-§9), SPEC-v4 §9,
// config.json v3.{time,rules,twists} and the level-format comment at the top of src/engine.js.
// Options (opt) toggle the points where the SPEC text is ambiguous so the diff can say which reading the game uses:
//   waryAt: 'hit' | 'disp'   when a squad whose sapper is sent at a covered pixel turns wary
//   backWalk: 'yardTile' | 'yardCarry' | 'tile' | 'carry'   "home after knockMs and the walk" on Easy/Normal
//   discLE: true  covered when dx^2+dy^2 <= r^2 (false: <)
export const GRASS = -1, DIRT = -2, CAMP = -3, WATER = -4, IRON = 10, GILT = 14;
const WALK = (v) => v === GRASS || v === DIRT || v === CAMP;

export function compile(L) {
  const w = L.w, h = L.h, n = w * h, a0 = new Int16Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = L.grid[y][x];
    a0[y * w + x] = ch === '.' ? GRASS : ch === ',' ? DIRT : ch === '~' ? WATER : ch === '#' ? CAMP : ch.charCodeAt(0) - 96;
  }
  let campRow = h; for (let i = 0; i < n; i++) if (a0[i] === CAMP) campRow = Math.min(campRow, (i / w) | 0);
  const group = (start) => { const m = a0[start], seen = new Set([start]), st = [start];
    while (st.length) { const c = st.pop(), x = c % w, y = (c / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const k = Y * w + X; if (!seen.has(k) && a0[k] === m) { seen.add(k); st.push(k); } } }
    return [...seen]; };
  const gates = (L.gates || []).map((g) => ({ cells: group(g.at[1] * w + g.at[0]), key: g.key[1] * w + g.key[0] }));
  const isTower = new Uint8Array(n);
  const towers = (L.towers || []).map((t) => { const cells = group(t.at[1] * w + t.at[0]); cells.forEach((c) => (isTower[c] = 1));
    let sx = 0, sy = 0; for (const c of cells) { sx += c % w; sy += (c / w) | 0; } return { cells, cx: sx / cells.length, cy: sy / cells.length, r: t.r }; });
  const cards = [], cols = [];
  L.cols.forEach((col, ci) => { cols.push(col.map((cd, i) => { const id = cards.length; cards.push({ id, m: cd[0], n: cd[1], f: cd[2] || 0, col: ci, idx: i, partner: -1 }); return id; })); });
  for (const [[c1, i1], [c2, i2]] of (L.links || [])) { const A = cols[c1][i1], B = cols[c2][i2]; cards[A].partner = B; cards[B].partner = A; }
  const lockKey = L.lock ? L.lock.key[1] * w + L.lock.key[0] : -1;
  return { w, h, n, a0, campRow, gates, towers, isTower, cards, cols, lockKey, safe: !!L.safeArchers };
}

// Min-heap of events by (t, seq).
class Heap { constructor() { this.a = []; }
  push(e) { const a = this.a; a.push(e); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (lt(a[i], a[p])) { [a[i], a[p]] = [a[p], a[i]]; i = p; } else break; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
    if (l < a.length && lt(a[l], a[m])) m = l; if (r < a.length && lt(a[r], a[m])) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; }
  get size() { return this.a.length; } peek() { return this.a[0]; } }
const lt = (x, y) => x.t < y.t || (x.t === y.t && x.seq < y.seq);

export const PLAYING = 0, WON = 1, FAILED = -1, REFUSED = -3, NOPLAY = -2;

export class Game {
  constructor(C, rules, time, opt = {}) {
    this.C = C; this.T = time; this.hold = rules.hold; this.lethal = rules.archersKill && !C.safe;
    this.opt = Object.assign({ waryAt: 'disp', backWalk: 'yardTile', discLE: true }, opt);
    const n = C.n; this.a = Int16Array.from(C.a0);
    this.cols = C.cols.map((c) => c.slice()); this.revealed = new Uint8Array(C.cards.length);
    this.locked = C.lockKey >= 0 ? Math.min(rules.lockSpaces ?? 1, this.hold - 1) : 0;
    this.spaces = new Array(this.hold).fill(-1); this.squads = []; this.claimed = new Uint8Array(n);
    this.towerLeft = C.towers.map((t) => t.cells.length); this.cover = new Uint8Array(n); this.coverCnt = new Int16Array(n);
    C.towers.forEach((t) => { for (let i = 0; i < n; i++) { if (C.isTower[i]) continue; const dx = (i % C.w) - t.cx, dy = ((i / C.w) | 0) - t.cy, d2 = dx * dx + dy * dy;
      if (this.opt.discLE ? d2 <= t.r * t.r : d2 < t.r * t.r) this.coverCnt[i]++; } });
    this.gateOfKey = new Map(C.gates.map((g, i) => [g.key, i])); this.gateCell = new Uint8Array(n); C.gates.forEach((g) => g.cells.forEach((c) => (this.gateCell[c] = 1)));
    this.standing = new Int32Array(16); this.pix = []; for (let m = 0; m < 16; m++) this.pix.push([]);
    for (let i = 0; i < n; i++) if (this.a[i] > 0) { this.standing[this.a[i]]++; this.pix[this.a[i]].push(i); }
    this.pixLeft = this.standing.reduce((s, v) => s + v, 0);
    this.q = new Heap(); this.seq = 0; this.now = 0; this.status = PLAYING; this.reason = ''; this.plays = 0; this.peak = 0; this.placeSeq = 0;
    this.log = []; this.dirty = true; this.dist = new Int32Array(n); this.jamWhy = 0; this.winAt = -1; this.hits = 0; this.kills = 0;
    this.revealFronts(); this.checkRest();
  }
  // -- board --
  covered(c) { return this.coverCnt[c] > 0 && this.C.towers.some((t, k) => this.towerLeft[k] > 0 && this.inDisc(t, c)); }
  inDisc(t, c) { if (this.C.isTower[c]) return false; const dx = (c % this.C.w) - t.cx, dy = ((c / this.C.w) | 0) - t.cy, d2 = dx * dx + dy * dy; return this.opt.discLE ? d2 <= t.r * t.r : d2 < t.r * t.r; }
  bfs() { const { w, h, n } = this.C, a = this.a, d = this.dist; d.fill(-1); const q = new Int32Array(n); let qh = 0, qt = 0;
    for (let i = 0; i < n; i++) if (a[i] === CAMP) { d[i] = 0; q[qt++] = i; }
    while (qh < qt) { const c = q[qh++], x = c % w, y = (c / w) | 0;
      const nb = [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1];
      for (const k of nb) if (k >= 0 && d[k] < 0 && WALK(a[k])) { d[k] = d[c] + 1; q[qt++] = k; } }
    this.dirty = false; }
  pdist(c) { const { w, h } = this.C, x = c % w, y = (c / w) | 0; let best = -1;
    for (const k of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1]) if (k >= 0 && this.dist[k] >= 0 && (best < 0 || this.dist[k] < best)) best = this.dist[k];
    return best; }
  target(m, wary) { if (this.dirty) this.bfs(); const { w, campRow } = this.C; let best = -1, bk = null;
    for (const c of this.pix[m]) { if (this.a[c] !== m || this.claimed[c] || this.gateCell[c]) continue; const d = this.pdist(c); if (d < 0) continue;
      if (wary && this.covered(c)) continue; const x = c % w, y = (c / w) | 0, k = [d, Math.abs(y - campRow), x, y];
      if (!bk || k[0] < bk[0] || (k[0] === bk[0] && (k[1] < bk[1] || (k[1] === bk[1] && (k[2] < bk[2] || (k[2] === bk[2] && k[3] < bk[3])))))) { bk = k; best = c; } }
    return best < 0 ? null : { c: best, d: bk[0] }; }
  // -- tray --
  front(col) { const c = this.cols[col]; return c.length ? c[0] : -1; }
  revealFronts() { for (let col = 0; col < 5; col++) { const id = this.front(col); if (id >= 0 && !this.revealed[id]) { this.revealed[id] = 1; if (this.C.cards[id].f) this.log.push({ t: this.now, e: 'REVEAL', id }); } } }
  hidden(id) { const cd = this.C.cards[id]; return !!cd.f && !this.revealed[id] && this.cols[cd.col].includes(id) && this.front(cd.col) !== id; }
  open() { return this.hold - this.locked; }
  free() { let f = 0; for (let i = 0; i < this.open(); i++) if (this.spaces[i] < 0) f++; return f; }
  need(col) { const id = this.front(col); return id < 0 ? 99 : this.C.cards[id].partner >= 0 ? 2 : 1; }
  legal(col) { return this.front(col) >= 0 && this.free() >= this.need(col); }
  place(id) { let sp = -1; for (let i = 0; i < this.open(); i++) if (this.spaces[i] < 0) { sp = i; break; }
    const cd = this.C.cards[id], s = { id: this.squads.length, card: id, m: cd.m, n: cd.n, waiting: cd.n, out: 0, alive: cd.n, wary: false, last: -1e9, ord: this.placeSeq++, space: sp, partner: -1, done: false, enRoute: 0 };
    this.squads.push(s); this.spaces[sp] = s.id; const col = this.cols[cd.col]; col.splice(col.indexOf(id), 1); return s; }
  play(col, t) {
    if (this.status !== PLAYING) return NOPLAY; if (t !== undefined) this.advanceTo(t);
    const id = this.front(col); if (id < 0) return NOPLAY; if (this.free() < this.need(col)) return REFUSED;
    const cd = this.C.cards[id]; const s1 = this.place(id); this.log.push({ t: this.now, e: 'TAP', m: s1.m, n: s1.n, sp: s1.space });
    if (cd.partner >= 0) { const s2 = this.place(cd.partner); s1.partner = s2.id; s2.partner = s1.id; this.log.push({ t: this.now, e: 'TAP', m: s2.m, n: s2.n, sp: s2.space }); }
    this.plays++; this.peak = Math.max(this.peak, this.spaces.filter((v) => v >= 0).length); this.revealFronts();
    this.dispatch(); this.checkRest(); return 0; }
  // -- time --
  sched(t, type, data) { this.q.push({ t, seq: this.seq++, type, ...data }); }
  dispatch() { const T = this.T, t = this.now;
    const live = this.squads.filter((s) => s.space >= 0 && !s.done).sort((x, y) => x.ord - y.ord);
    for (const s of live) { if (s.waiting <= 0 || t < s.last + T.staggerMs) continue; const tg = this.target(s.m, s.wary); if (!tg) continue;
      s.waiting--; s.out++; s.last = t; const tiles = tg.d + 1; const cov = this.covered(tg.c);
      if (cov) { if (this.opt.waryAt === 'disp') s.wary = true; this.sched(t + T.yardMs + Math.ceil(tiles / 2) * T.tileMs, 'HIT', { s: s.id, tiles, c: tg.c }); }
      else { this.claimed[tg.c] = 1; s.enRoute++; this.sched(t + T.yardMs + tiles * T.tileMs + T.biteMs, 'POP', { s: s.id, c: tg.c, tiles }); }
      if (s.waiting > 0) this.sched(t + T.staggerMs, 'WAKE', {}); } }
  finish(s) { if (s.done || s.waiting > 0 || s.out > 0) return; s.done = true;
    const p = s.partner >= 0 ? this.squads[s.partner] : null; if (p && !p.done) return;
    const list = p ? [s, p].sort((x, y) => x.ord - y.ord) : [s];
    for (const q of list) { this.spaces[q.space] = -1; this.log.push({ t: this.now, e: 'FREE', sp: q.space }); } }
  sappersOf(m) { let k = 0; for (let col = 0; col < 5; col++) for (const id of this.cols[col]) if (this.C.cards[id].m === m) k += this.C.cards[id].n;
    for (const s of this.squads) if (s.m === m) k += s.waiting + s.enRoute + (this.lethal ? 0 : 0); return k; }
  handle(ev) { const T = this.T, s = ev.s !== undefined ? this.squads[ev.s] : null;
    if (ev.type === 'WAKE') return;
    if (ev.type === 'POP') { const c = ev.c, m = this.a[c]; this.a[c] = DIRT; this.claimed[c] = 0; this.standing[m]--; this.pixLeft--; this.dirty = true; s.enRoute--;
      this.log.push({ t: this.now, e: 'EAT', c, m });
      if (this.C.isTower[c]) this.C.towers.forEach((tw, k) => { if (tw.cells.includes(c)) { this.towerLeft[k]--; if (!this.towerLeft[k]) this.log.push({ t: this.now, e: 'TOWER', k }); } });
      if (this.gateOfKey.has(c)) { for (const g of this.C.gates[this.gateOfKey.get(c)].cells) if (this.a[g] > 0) { this.standing[this.a[g]]--; this.a[g] = DIRT; this.pixLeft--; } this.log.push({ t: this.now, e: 'GATE' }); }
      if (c === this.C.lockKey && this.locked) { this.locked = 0; this.log.push({ t: this.now, e: 'UNLOCK' }); }
      this.sched(this.now + T.yardMs + ev.tiles * T.carryMs, 'HOME', { s: s.id });
      if (this.pixLeft === 0 && this.status === PLAYING) { this.status = WON; this.winAt = this.now; }
      return; }
    if (ev.type === 'HOME') { s.out--; this.finish(s); return; }
    if (ev.type === 'HIT') { if (this.opt.waryAt === 'hit') s.wary = true; this.hits++;
      if (this.lethal) { s.out--; s.alive--; this.kills++; this.log.push({ t: this.now, e: 'KILL', m: s.m });
        if (this.status === PLAYING && this.sappersOf(s.m) < this.standing[s.m]) { this.status = FAILED; this.reason = 'short'; }
        this.finish(s); }
      else { this.log.push({ t: this.now, e: 'HIT', m: s.m }); const half = Math.ceil(ev.tiles / 2), bw = this.opt.backWalk;
        const walk = bw === 'yardTile' ? T.yardMs + half * T.tileMs : bw === 'yardCarry' ? T.yardMs + half * T.carryMs : bw === 'tile' ? half * T.tileMs : half * T.carryMs;
        this.sched(this.now + T.knockMs + walk, 'BACK', { s: s.id }); }
      return; }
    if (ev.type === 'BACK') { s.out--; s.waiting++; return; } }
  step() { const t = this.q.peek().t; this.now = t; while (this.q.size && this.q.peek().t === t) this.handle(this.q.pop());
    if (this.status === PLAYING) this.dispatch(); this.checkRest(); }
  advanceTo(t) { while (this.q.size && this.q.peek().t <= t && this.status === PLAYING) this.step(); if (this.status === PLAYING && t > this.now) this.now = t; }
  quiet() { let guard = 0; while (this.q.size && this.status === PLAYING && guard++ < 5e6) this.step(); }
  settle() { let g = 0; while (this.q.size && g++ < 1e6) { const e = this.q.pop(); this.now = e.t; if (e.type === 'HOME' || e.type === 'BACK') this.squads[e.s].out--; } return this.now; } // after the end: let every squad walk home
  get busy() { return this.q.size > 0; }
  checkRest() { if (this.status !== PLAYING || this.q.size) return;
    if (this.pixLeft === 0) { this.status = WON; return; }
    let cards = 0; for (let col = 0; col < 5; col++) cards += this.cols[col].length;
    if (!cards) { this.status = FAILED; this.reason = 'stuck'; return; }
    let any = false; for (let col = 0; col < 5; col++) if (this.legal(col)) any = true;
    if (!any) { this.status = FAILED; this.reason = 'jam'; this.jamWhy = (this.free() > 0 ? 1 : 0) | (this.locked > 0 ? 2 : 0); } }
}
