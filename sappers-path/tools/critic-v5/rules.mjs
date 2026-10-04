// Critic v5 (from critic-v4.3; written from SPEC-v4 §9's v5 R1 entry, with the v5 R2 entry's data rules in diff.mjs): 5
// spaces on every tag (rules.hold); archers never kill (a hit always knocks back; no short); a lock is a key lock or a colour
// lock (opens the moment a squad of its colour takes a space, UNLOCK logged after that tap's TAP events); the Quartermaster
// sends any card in view (the front plus pullDepth behind) straight out into the lowest free open space, a linked card
// with its partner in view and 2 free spaces, no jam test, not a play. Not modelled here (no generator reaches them in the
// shipped levels, and tools/ref.js and tools/test.js cover them): the Volley, the continue, mystery blocks.
// Critic v4.3 (from critic-v4.1): SPEC-v4 §9 v4.3. A space frees when its squad has no sapper waiting, walking out or walking
// back (a carrier leaves its squad at its pop; a Hard kill leaves at once); linked pairs hold until both are done. A linked tap
// is legal only when its partner is its own column's front (why 3, checked before why 2); jamWhy bit 4. Quartermaster's jam
// test on the columns after the pull. Rest still waits for every sapper home.
// Critic v4.1 (from critic-v4-2): picture boards with bottom entry (SPEC-v4 §9 v4.1: ring levels retired, the entry square is
// the camp, no new rule) and the same-instant event order the Critics 2 fix pass wrote down (SPEC-v4 §9, Critics 2 fix, S1).
// Critic v4-2: an independent implementation of Sapper's Path rules, written ONLY from the SPEC text: SPEC-v3 §1-§9,
// SPEC-v4 §9 (M1-M5 incl. the Critics 1 fix-pass rules text, M4 ring levels and M5 power-ups), config.json numbers and the
// level-format comment at the top of src/engine.js. Extends tools/critic-v4-1/rules.mjs (whose open readings are now fixed
// by SPEC-v4's Critics 1 entry: wary at the send, walk back yard + half x tileMs, disc inclusive).
export const GRASS = -1, DIRT = -2, CAMP = -3, WATER = -4, IRON = 10, GILT = 14, MAXLINE = 8;
const WALK = (v) => v === GRASS || v === DIRT || v === CAMP;
export const PLAYING = 0, WON = 1, FAILED = -1, NOPLAY = -2, REFUSED = -3;

export function picProblems(L) { const out = [], w = L.w, h = L.h; if (L.ring) out.push('ring: true (retired)'); if (!L.pic) out.push('pic missing'); const at = (x, y) => L.grid[y][x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const fr = x === 0 || y === 0 || x === w - 1 || y === h - 1, c = at(x, y);
    if (!fr) { if (c === '#') out.push(`camp inside the picture at ${x},${y}`); continue; }
    const entry = y === h - 1 && Math.abs(x - (w - 1) / 2) <= 1, side = (x === 0 || x === w - 1) && y > 0 && y < h - 1;
    if (entry) { if (c !== '#') out.push(`entry cell ${x},${y} is '${c}'`); } else if (c === ',') continue; else if (side && c === '~') continue; else out.push(`frame cell ${x},${y} is '${c}'`); }
  return out; }
export function compile(L) { if (L.ring) throw new Error('ring levels are retired (v4.1)');
  const w = L.w, h = L.h, n = w * h, a0 = new Int16Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = L.grid[y][x];
    a0[y * w + x] = ch === '.' ? GRASS : ch === ',' ? DIRT : ch === '~' ? WATER : ch === '#' ? CAMP : ch.charCodeAt(0) - 96; }
  let campRow = h; for (let i = 0; i < n; i++) if (a0[i] === CAMP) campRow = Math.min(campRow, (i / w) | 0);
  const group = (start, skip) => { const m = a0[start], seen = new Set([start]), st = [start];
    while (st.length) { const c = st.pop(), x = c % w, y = (c / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const k = Y * w + X; if (!seen.has(k) && a0[k] === m && !(skip && skip[k])) { seen.add(k); st.push(k); } } }
    return [...seen]; };
  const gates = (L.gates || []).map((g) => ({ cells: group(g.at[1] * w + g.at[0]), key: g.key[1] * w + g.key[0] }));
  const isTower = new Uint8Array(n);
  const towers = (L.towers || []).map((t) => { const cells = group(t.at[1] * w + t.at[0], isTower); cells.forEach((c) => (isTower[c] = 1));
    let sx = 0, sy = 0; for (const c of cells) { sx += c % w; sy += (c / w) | 0; } return { cells, cx: sx / cells.length, cy: sy / cells.length, r: t.r }; });
  const cards = [], cols = [];
  L.cols.forEach((col, ci) => { cols.push(col.map((cd, i) => { const id = cards.length; cards.push({ id, m: cd[0], n: cd[1], f: cd[2] || 0, col: ci, idx: i, partner: -1 }); return id; })); });
  for (const [[c1, i1], [c2, i2]] of (L.links || [])) { const A = cols[c1][i1], B = cols[c2][i2]; cards[A].partner = B; cards[B].partner = A; }
  const lockKey = L.lock && L.lock.key ? L.lock.key[1] * w + L.lock.key[0] : -1, lockMat = L.lock && L.lock.colour != null ? L.lock.colour : 0; // v5: key or colour
  // tie-break key per cell: siege [|y - campRow|, x, y]; ring levels (SPEC-v4 M4) [layer, pos, side]
  const tie = new Array(n);
  for (let c = 0; c < n; c++) { const x = c % w, y = (c / w) | 0;
    if (!L.ring) { tie[c] = [Math.abs(y - campRow), x, y]; continue; }
    const a = Math.min(x, y, w - 1 - x, h - 1 - y), x1 = w - 1 - a, y1 = h - 1 - a; let side, pos;
    if (y === a && x < x1) { side = 0; pos = x - a; } else if (x === x1 && y < y1) { side = 1; pos = y - a; } else if (y === y1 && x > a) { side = 2; pos = x1 - x; } else if (x === a && y > a) { side = 3; pos = y1 - y; } else { side = 0; pos = 0; }
    tie[c] = [a, pos, side]; }
  return { w, h, n, a0, campRow, gates, towers, isTower, cards, cols, lockKey, lockMat, safe: !!L.safeArchers, ring: !!L.ring, tie };
}

class Heap { constructor() { this.a = []; }
  push(e) { const a = this.a; a.push(e); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (lt(a[i], a[p])) { [a[i], a[p]] = [a[p], a[i]]; i = p; } else break; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
    if (l < a.length && lt(a[l], a[m])) m = l; if (r < a.length && lt(a[r], a[m])) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; }
  get size() { return this.a.length; } peek() { return this.a[0]; } }
const lt = (x, y) => x.t < y.t || (x.t === y.t && x.seq < y.seq);

export class Game {
  // rules: {hold, archersKill, lockSpaces, powers?: [4], pullDepth?}
  constructor(C, rules, time) {
    this.C = C; this.T = time; this.hold = rules.hold; this.lethal = false; this.powers = rules.powers || [0, 0, 0, 0]; this.pullDepth = rules.pullDepth ?? 2; // v5: archers never kill
    const n = C.n; this.a = Int16Array.from(C.a0); this.used = [0, 0, 0, 0, 0];
    this.cols = C.cols.map((c) => c.slice()); this.revealed = new Uint8Array(C.cards.length); this.cn = C.cards.map((c) => c.n);
    this.locked = C.lockKey >= 0 || C.lockMat > 0 ? Math.min(rules.lockSpaces ?? 1, this.hold - 1) : 0;
    this.spaces = new Array(this.hold).fill(-1); this.squads = []; this.claimed = new Uint8Array(n);
    this.towerLeft = C.towers.map((t) => t.cells.length);
    this.gateOfKey = new Map(C.gates.map((g, i) => [g.key, i])); this.gateCell = new Uint8Array(n); C.gates.forEach((g) => g.cells.forEach((c) => (this.gateCell[c] = 1)));
    this.standing = new Int32Array(16); this.pix = []; for (let m = 0; m < 16; m++) this.pix.push([]);
    for (let i = 0; i < n; i++) if (this.a[i] > 0) { this.standing[this.a[i]]++; this.pix[this.a[i]].push(i); }
    this.pixLeft = this.standing.reduce((s, v) => s + v, 0);
    this.q = new Heap(); this.seq = 0; this.now = 0; this.status = PLAYING; this.reason = ''; this.plays = 0; this.peak = 0; this.placeSeq = 0;
    this.log = []; this.dirty = true; this.dist = new Int32Array(n); this.jamWhy = 0; this.winAt = -1; this.hits = 0; this.kills = 0;
    this.revealFronts(); this.checkRest();
  }
  ev(e, x) { this.log.push(Object.assign({ t: this.now, e }, x)); }
  // -- board --
  covered(c) { if (this.C.isTower[c]) return false; const { w } = this.C; for (let k = 0; k < this.C.towers.length; k++) { const t = this.C.towers[k]; if (!this.towerLeft[k]) continue;
    const dx = (c % w) - t.cx, dy = ((c / w) | 0) - t.cy; if (dx * dx + dy * dy <= t.r * t.r) return true; } return false; }
  bfs() { const { w, h, n } = this.C, a = this.a, d = this.dist; d.fill(-1); const q = new Int32Array(n); let qh = 0, qt = 0;
    for (let i = 0; i < n; i++) if (a[i] === CAMP) { d[i] = 0; q[qt++] = i; }
    while (qh < qt) { const c = q[qh++], x = c % w, y = (c / w) | 0;
      for (const k of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1]) if (k >= 0 && d[k] < 0 && WALK(a[k])) { d[k] = d[c] + 1; q[qt++] = k; } }
    this.dirty = false; }
  pdist(c) { const { w, h } = this.C, x = c % w, y = (c / w) | 0; let best = -1;
    for (const k of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1]) if (k >= 0 && this.dist[k] >= 0 && (best < 0 || this.dist[k] < best)) best = this.dist[k];
    return best; }
  target(m, wary) { if (this.dirty) this.bfs(); const tie = this.C.tie; let best = -1, bd = 0;
    for (const c of this.pix[m]) { if (this.a[c] !== m || this.claimed[c] || this.gateCell[c]) continue; const d = this.pdist(c); if (d < 0) continue; if (wary && this.covered(c)) continue;
      if (best < 0 || d < bd || (d === bd && cmp(tie[c], tie[best]) < 0)) { best = c; bd = d; } }
    return best < 0 ? null : { c: best, d: bd }; }
  // -- tray --
  front(col) { const c = this.cols[col]; return c.length ? c[0] : -1; }
  seen(id) { if (this.revealed[id]) return; this.revealed[id] = 1; const cd = this.C.cards[id]; if (cd.f) this.ev('REVEAL', { id, col: cd.col }); }
  revealFronts() { for (let col = 0; col < 5; col++) { const id = this.front(col); if (id >= 0) this.seen(id); } }
  hidden(id) { const cd = this.C.cards[id]; return !!cd.f && !this.revealed[id] && this.cols[cd.col].includes(id) && this.front(cd.col) !== id; }
  open() { return this.hold - this.locked; }
  free() { let f = 0; for (let i = 0; i < this.open(); i++) if (this.spaces[i] < 0) f++; return f; }
  needOf(id) { return id < 0 ? 99 : this.C.cards[id].partner >= 0 ? 2 : 1; }
  need(col) { return this.needOf(this.front(col)); }
  // why a front card's tap is refused, judged on given fronts (fr[col] = card or -1): 0 legal/no card, 1 no free space, 2 linked with < 2, 3 partner not a front
  whyOf(id, fr) { if (id < 0) return 0; const cd = this.C.cards[id], f = this.free();
    if (cd.partner >= 0) { const pc = this.C.cards[cd.partner].col; if (fr[pc] !== cd.partner) return 3; return f >= 2 ? 0 : 2; } return f >= 1 ? 0 : 1; }
  fronts() { return [0, 1, 2, 3, 4].map((c) => this.front(c)); }
  whyCol(col) { return this.whyOf(this.front(col), this.fronts()); }
  legal(col) { return this.front(col) >= 0 && this.whyCol(col) === 0; }
  place(id) { let sp = -1; for (let i = 0; i < this.open(); i++) if (this.spaces[i] < 0) { sp = i; break; }
    const cd = this.C.cards[id], n = this.cn[id], s = { id: this.squads.length, card: id, m: cd.m, n, waiting: n, out: 0, wary: false, last: -1e9, ord: this.placeSeq++, space: sp, partner: -1, done: false, enRoute: 0, col: cd.col };
    this.squads.push(s); this.spaces[sp] = s.id; const col = this.cols[cd.col]; col.splice(col.indexOf(id), 1); return s; }
  play(col, t) {
    if (t !== undefined) this.advanceTo(t); if (this.status !== PLAYING) return NOPLAY;
    const id = this.front(col); if (id < 0) return NOPLAY;
    if (this.whyCol(col) !== 0) return REFUSED; const cd = this.C.cards[id]; const s1 = this.place(id); const f1 = this.front(col); if (f1 >= 0) this.seen(f1);
    let s2 = null; if (cd.partner >= 0) { const pid = cd.partner, pc = this.C.cards[pid].col, wasFront = this.front(pc) === pid; this.seen(pid); s2 = this.place(pid); s1.partner = s2.id; s2.partner = s1.id; if (wasFront) { const f2 = this.front(pc); if (f2 >= 0) this.seen(f2); } }
    this.ev('TAP', { m: s1.m, n: s1.n, sp: s1.space }); if (s2) this.ev('TAP', { m: s2.m, n: s2.n, sp: s2.space });
    this.colourOpen(s1); if (s2) this.colourOpen(s2);
    this.plays++; this.peak = Math.max(this.peak, this.spaces.filter((v) => v >= 0).length);
    this.dispatch(); this.checkRest(); return 0; }
  colourOpen(s) { if (this.locked && this.C.lockMat > 0 && s.m === this.C.lockMat) { this.locked = 0; this.ev('UNLOCK', { m: s.m }); } } // v5: a colour lock
  inView(id) { const cd = this.C.cards[id]; if (!cd) return false; const p = this.cols[cd.col].indexOf(id); return p >= 0 && p <= this.pullDepth; }
  // -- power-ups (SPEC-v4 §9 M5; v5 R1's Quartermaster) --
  canPower(k, a) { const no = (w) => { this.why = w; return REFUSED; }; this.why = ''; if (this.status !== PLAYING) { this.why = 'noplay'; return NOPLAY; } if (this.used[k] >= (this.powers[k] || 0)) return no('perLevel');
    if (k === 0) return this.hold < MAXLINE ? 0 : no('maxline');
    if (k === 1) { const id = a, cd = this.C.cards[id]; if (!cd) return no('badCard'); const col = this.cols[cd.col], p = col.indexOf(id); if (p < 0) return no('notInColumn'); if (p > this.pullDepth) return no('tooDeep');
      if (cd.partner >= 0) { if (!this.inView(cd.partner)) return no('partnerOutOfView'); return this.free() >= 2 ? 0 : no('noTwoSpaces'); }
      return this.free() >= 1 ? 0 : no('noSpace'); }
    if (k === 2) { for (let id = 0; id < this.C.cards.length; id++) if (this.hidden(id)) return 0; return no('noneHidden'); }
    if (k === 3) { if (!(a >= 0 && a < this.spaces.length)) return no('badSpace'); const si = this.spaces[a]; if (si < 0) return no('emptySpace'); const s = this.squads[si];
      if (s.partner >= 0) return no('linked'); if (s.out > 0) return no('sappersOut'); if (s.waiting <= 0 || s.done) return no('noneWaiting'); return 0; }
    return no('badK'); }
  power(k, a, t) { if (t !== undefined) this.advanceTo(t); const r = this.canPower(k, a); if (r !== 0) return r; this.used[k]++;
    if (k === 0) { const s = this.open(); this.spaces.splice(s, 0, -1); this.hold++; this.ev('POWER', { k, a: s }); }
    else if (k === 1) { const cd = this.C.cards[a], pid = cd.partner; // v5: the card leaves its column (revealed as it goes), then its partner; POWER; then they take spaces like a tap
      const leave = (id) => { const c = this.C.cards[id], wasFront = this.front(c.col) === id; this.seen(id); const col = this.cols[c.col]; col.splice(col.indexOf(id), 1); if (wasFront) { const f = this.front(c.col); if (f >= 0) this.seen(f); } };
      leave(a); if (pid >= 0) leave(pid); this.ev('POWER', { k, a });
      const put = (id) => { let sp = -1; for (let i = 0; i < this.open(); i++) if (this.spaces[i] < 0) { sp = i; break; } const c = this.C.cards[id], n = this.cn[id];
        const s = { id: this.squads.length, card: id, m: c.m, n, waiting: n, out: 0, wary: false, last: -1e9, ord: this.placeSeq++, space: sp, partner: -1, done: false, enRoute: 0, col: c.col };
        this.squads.push(s); this.spaces[sp] = s.id; this.ev('TAP', { m: s.m, n: s.n, sp }); return s; };
      const s1 = put(a), s2 = pid >= 0 ? put(pid) : null; if (s2) { s1.partner = s2.id; s2.partner = s1.id; } this.colourOpen(s1); if (s2) this.colourOpen(s2); this.peak = Math.max(this.peak, this.spaces.filter((v) => v >= 0).length);
      this.dispatch(); }
    else if (k === 2) { const hid = []; for (let id = 0; id < this.C.cards.length; id++) if (this.hidden(id)) hid.push(id); for (const id of hid) this.seen(id); this.ev('POWER', { k, a: hid.length }); }
    else if (k === 3) { const s = this.squads[this.spaces[a]]; this.cn[s.card] = s.waiting; s.waiting = 0; s.done = true; s.recalled = true; this.cols[s.col].unshift(s.card); this.spaces[a] = -1;
      this.ev('POWER', { k, a }); this.ev('FREE', { sp: a, m: s.m }); }
    this.checkRest(); return 0; }
  // -- time --
  sched(t, type, data) { this.q.push({ t, seq: this.seq++, type, ...data }); }
  dispatch() { const T = this.T, t = this.now;
    const live = this.squads.filter((s) => s.space >= 0 && !s.done).sort((x, y) => x.ord - y.ord);
    for (const s of live) { if (s.waiting <= 0 || t < s.last + T.staggerMs) continue; const tg = this.target(s.m, s.wary); if (!tg) continue;
      s.waiting--; s.out++; s.last = t; const tiles = tg.d + 1;
      if (this.covered(tg.c)) { s.wary = true; this.sched(t + T.yardMs + Math.ceil(tiles / 2) * T.tileMs, 'HIT', { s: s.id, tiles, c: tg.c }); }
      else { this.claimed[tg.c] = 1; s.enRoute++; this.sched(t + T.yardMs + tiles * T.tileMs + T.biteMs, 'POP', { s: s.id, c: tg.c, tiles }); }
      if (s.waiting > 0) this.sched(t + T.staggerMs, 'WAKE', {}); } }
  finish(s) { if (s.done || s.waiting > 0 || s.out > 0) return; s.done = true;
    const p = s.partner >= 0 ? this.squads[s.partner] : null; if (p && !p.done) return;
    const list = p ? [s, p].sort((x, y) => x.ord - y.ord) : [s];
    for (const q of list) { this.spaces[q.space] = -1; this.ev('FREE', { sp: q.space, m: q.m }); } }
  sappersOf(m) { let k = 0; for (let col = 0; col < 5; col++) for (const id of this.cols[col]) if (this.C.cards[id].m === m) k += this.cn[id];
    for (const s of this.squads) if (s.m === m && !s.recalled) k += s.waiting + s.enRoute; return k; }
  handle(ev) { const T = this.T, s = ev.s !== undefined ? this.squads[ev.s] : null; // HOME of a carrier has no squad
    if (ev.type === 'WAKE') return;
    if (ev.type === 'POP') { const c = ev.c, m = this.a[c]; this.a[c] = DIRT; this.claimed[c] = 0; this.standing[m]--; this.pixLeft--; this.dirty = true; s.enRoute--;
      this.ev('EAT', { c, m });
      if (this.C.isTower[c]) this.C.towers.forEach((tw, k) => { if (tw.cells.includes(c)) { this.towerLeft[k]--; if (!this.towerLeft[k]) this.ev('TOWER', { k }); } });
      if (c === this.C.lockKey && this.locked) { this.locked = 0; this.ev('UNLOCK', {}); }
      if (this.gateOfKey.has(c)) { for (const g of this.C.gates[this.gateOfKey.get(c)].cells) if (this.a[g] > 0) { this.standing[this.a[g]]--; this.a[g] = DIRT; this.pixLeft--; } this.ev('GATE', {}); }
      this.sched(this.now + T.yardMs + ev.tiles * T.carryMs, 'HOME', { carrier: 1 });
      s.out--; this.finish(s);
      if (this.pixLeft === 0 && this.status === PLAYING) { this.status = WON; this.winAt = this.now; }
      return; }
    if (ev.type === 'HOME') return;
    if (ev.type === 'HIT') { this.hits++;
      if (this.lethal) { s.out--; this.kills++; this.ev('KILL', { m: s.m });
        if (this.status === PLAYING && this.sappersOf(s.m) < this.standing[s.m]) { this.status = FAILED; this.reason = 'short'; }
        this.finish(s); }
      else { this.ev('HIT', { m: s.m }); const half = Math.ceil(ev.tiles / 2); s.enRoute++; this.sched(this.now + T.knockMs + T.yardMs + half * T.tileMs, 'BACK', { s: s.id }); }
      return; }
    if (ev.type === 'BACK') { s.out--; s.enRoute--; s.waiting++; return; } }
  step() { const t = this.q.peek().t; this.now = t; while (this.q.size && this.q.peek().t === t) this.handle(this.q.pop());
    if (this.status === PLAYING) this.dispatch(); this.checkRest(); }
  advanceTo(t) { while (this.q.size && this.q.peek().t <= t && this.status === PLAYING) this.step(); if (this.status === PLAYING && t > this.now) this.now = t; }
  quiet() { let guard = 0; while (this.q.size && this.status === PLAYING && guard++ < 5e6) this.step(); }
  settle() { let g = 0; while (this.q.size && g++ < 1e6) { const e = this.q.pop(); this.now = e.t; } return this.now; }
  get busy() { return this.q.size > 0; }
  checkRest() { if (this.status !== PLAYING || this.q.size) return;
    if (this.pixLeft === 0) { this.status = WON; return; }
    let cards = 0; for (let col = 0; col < 5; col++) cards += this.cols[col].length;
    if (!cards) { this.status = FAILED; this.reason = 'stuck'; return; }
    let any = false; for (let col = 0; col < 5; col++) if (this.legal(col)) any = true;
    if (!any) { this.status = FAILED; this.reason = 'jam'; this.jamWhy = (this.free() > 0 ? 1 : 0) | (this.locked > 0 ? 2 : 0) | ([0, 1, 2, 3, 4].some((c) => this.whyCol(c) === 3) ? 4 : 0); } }
}
const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
