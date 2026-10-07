// Critic v5 (from critic-v4.3; written from SPEC-v4 §9's v5 R1 entry, with the v5 R2 entry's data rules in diff.mjs): 5
// spaces on every tag (rules.hold); archers never kill (a hit always knocks back; no short); a lock is a key lock or a colour
// lock (opens the moment a squad of its colour takes a space, UNLOCK logged after that tap's TAP events); the Quartermaster
// sends any card in view (the front plus pullDepth behind) straight out into the lowest free open space, a linked card
// with its partner in view and 2 free spaces, no jam test, not a play. Not modelled here (tools/ref.js and tools/test.js
// cover it): the continue.
// v5 R4 fix (the functional critic's m2), written from SPEC-v4 §9's v5 R1 entry: mystery blocks (a "?" off the picture's
// outer two rings shows "?" until it is 4-adjacent to connected ground, checked at load (no log) and whenever ground grows,
// SHOW cell m; never in reach) and the Volley (power 4, a = a colour m: taken when m is 1-14, not 10, with a pixel standing
// or a sapper in play; every standing pixel of m cleared in the clear order (CLEAR, then TOWER, UNLOCK, GATE as a pop), its
// cards leave their columns in file order and are cut (a partner plays alone), its squads leave the line (waiting sappers
// gone, walkers cut loose: they arrive at nothing), each space freed at once, a colour lock of m opens).
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
// Campaign v6 stage 1 (written from SPEC-v4 §9's "Campaign v6 stage 1" entry): a level's kill: true makes an arrow kill
// (KILL; the dead sapper is finished; its colour with fewer sappers than standing blocks fails "short"); locks: [one or
// two] (lock: one), each shutting its own space of the line's last ones (lock 0 the left), opening on its own key or
// colour; a squad takes the lowest space neither held nor shut; a Ladder's space goes in before the shut run at the end.
// Stage 1b (the same entry, amended): archers: "kill" (as above) | "pin": the shooter is the lowest-numbered standing tower
// whose ring holds the target at the send; at the hit (PIN) the sapper lies pinned, still out for its squad, no event;
// when its shooter's last block goes (after TOWER) the ones it pinned are released in send order (REL) and walk back
// (yard + ceil(tiles/2) x tile), then wait again; a Volley of its squad's colour cuts a pinned one loose (REL) before the
// spaces free. jamWhy bit 8 while anyone is pinned.
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
  const hid = new Uint8Array(n); if (L.hidden) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const edge = L.pic ? x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2 : x === 0 || y === 0 || x === w - 1 || y === h - 1; if (L.hidden[y][x] === '?' && !edge && a0[y * w + x] > 0) hid[y * w + x] = 1; } // v5 R4 fix: mystery blocks
  let cx0 = w, cx1 = -1; for (let x = 0; x < w; x++) if (a0[campRow * w + x] === CAMP) { cx0 = Math.min(cx0, x); cx1 = Math.max(cx1, x); }
  const clearRank = Array.from({ length: n }, (_, c) => c).sort((p, q) => { const d2 = (c) => (2 * (c % w) - (cx0 + cx1)) ** 2 + (2 * (((c / w) | 0) - campRow)) ** 2; return d2(p) - d2(q) || cmp(tie2(p), tie2(q)); }); // the clear order
  function tie2(c) { return [Math.abs(((c / w) | 0) - campRow), c % w, (c / w) | 0]; }
  const locks = (L.locks || (L.lock ? [L.lock] : [])).map((lk) => ({ key: lk.key ? lk.key[1] * w + lk.key[0] : -1, mat: lk.colour != null ? lk.colour : 0 })); // v5: key or colour; v6: one or two
  // tie-break key per cell: siege [|y - campRow|, x, y]; ring levels (SPEC-v4 M4) [layer, pos, side]
  const tie = new Array(n);
  for (let c = 0; c < n; c++) { const x = c % w, y = (c / w) | 0;
    if (!L.ring) { tie[c] = [Math.abs(y - campRow), x, y]; continue; }
    const a = Math.min(x, y, w - 1 - x, h - 1 - y), x1 = w - 1 - a, y1 = h - 1 - a; let side, pos;
    if (y === a && x < x1) { side = 0; pos = x - a; } else if (x === x1 && y < y1) { side = 1; pos = y - a; } else if (y === y1 && x > a) { side = 2; pos = x1 - x; } else if (x === a && y > a) { side = 3; pos = y1 - y; } else { side = 0; pos = 0; }
    tie[c] = [a, pos, side]; }
  return { w, h, n, a0, campRow, gates, towers, isTower, cards, cols, locks, kill: L.archers === 'kill', pin: L.archers === 'pin', safe: !!L.safeArchers, ring: !!L.ring, tie, hid, clearRank };
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
    this.C = C; this.T = time; this.hold = rules.hold; this.lethal = C.kill; this.powers = rules.powers || [0, 0, 0, 0, 0]; this.pullDepth = rules.pullDepth ?? 2; // v5: archers never kill
    const n = C.n; this.a = Int16Array.from(C.a0); this.used = [0, 0, 0, 0, 0, 0];
    this.cols = C.cols.map((c) => c.slice()); this.revealed = new Uint8Array(C.cards.length); this.cn = C.cards.map((c) => c.n);
    const per = rules.lockSpaces ?? 1, nShut = C.locks.length ? Math.min(per * C.locks.length, this.hold - 1) : 0; // v6: shut[i] = the lock keeping space i shut (-1 none)
    this.shut = new Array(this.hold).fill(-1); for (let i = 0; i < nShut; i++) this.shut[this.hold - nShut + i] = Math.min(C.locks.length - 1, Math.floor(i / Math.max(1, per)));
    this.spaces = new Array(this.hold).fill(-1); this.squads = []; this.claimed = new Uint8Array(n);
    this.towerLeft = C.towers.map((t) => t.cells.length);
    this.gateOfKey = new Map(C.gates.map((g, i) => [g.key, i])); this.gateCell = new Uint8Array(n); C.gates.forEach((g) => g.cells.forEach((c) => (this.gateCell[c] = 1)));
    this.standing = new Int32Array(16); this.pix = []; for (let m = 0; m < 16; m++) this.pix.push([]);
    for (let i = 0; i < n; i++) if (this.a[i] > 0) { this.standing[this.a[i]]++; this.pix[this.a[i]].push(i); }
    this.pixLeft = this.standing.reduce((s, v) => s + v, 0);
    this.q = new Heap(); this.seq = 0; this.now = 0; this.status = PLAYING; this.reason = ''; this.plays = 0; this.peak = 0; this.placeSeq = 0;
    this.log = []; this.dirty = true; this.dist = new Int32Array(n); this.jamWhy = 0; this.winAt = -1; this.hits = 0; this.kills = 0; this.pins = []; this.sent = 0;
    this.shown = new Uint8Array(n); this.unseen = []; for (let c = 0; c < n; c++) if (C.hid[c]) this.unseen.push(c); this.expose(false); // at load: nothing logged
    this.revealFronts(); this.checkRest();
  }
  // Mystery blocks: a still-hidden standing block 4-adjacent to connected ground (dist >= 0) shows for good (SHOW cell m).
  expose(log) { if (!this.unseen.length) return; if (this.dirty) this.bfs(); const { w, h } = this.C, keep = [];
    for (const c of this.unseen) { if (this.a[c] <= 0) continue; const x = c % w, y = (c / w) | 0; let on = false;
      for (const k of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1]) if (k >= 0 && this.dist[k] >= 0) on = true;
      if (on) { this.shown[c] = 1; if (log) this.ev('SHOW', { c, m: this.a[c] }); } else keep.push(c); }
    this.unseen = keep; }
  hiddenCell(c) { return this.C.hid[c] && !this.shown[c] && this.a[c] > 0; }
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
    for (const c of this.pix[m]) { if (this.a[c] !== m || this.claimed[c] || this.gateCell[c] || this.hiddenCell(c)) continue; const d = this.pdist(c); if (d < 0) continue; if (wary && this.covered(c)) continue;
      if (best < 0 || d < bd || (d === bd && cmp(tie[c], tie[best]) < 0)) { best = c; bd = d; } }
    return best < 0 ? null : { c: best, d: bd }; }
  // -- tray --
  front(col) { const c = this.cols[col]; return c.length ? c[0] : -1; }
  seen(id) { if (this.revealed[id]) return; this.revealed[id] = 1; const cd = this.C.cards[id]; if (cd.f) this.ev('REVEAL', { id, col: cd.col }); }
  revealFronts() { for (let col = 0; col < 5; col++) { const id = this.front(col); if (id >= 0) this.seen(id); } }
  hidden(id) { const cd = this.C.cards[id]; return !!cd.f && !this.revealed[id] && this.cols[cd.col].includes(id) && this.front(cd.col) !== id; }
  get locked() { return this.shut.filter((k) => k >= 0).length; }
  unlock(k, x) { if (!this.shut.includes(k)) return; this.shut = this.shut.map((v) => (v === k ? -1 : v)); this.ev('UNLOCK', x); }
  keyGone(c) { this.C.locks.forEach((lk, k) => { if (lk.key === c) this.unlock(k, {}); }); }
  firstFree() { for (let i = 0; i < this.spaces.length; i++) if (this.spaces[i] < 0 && this.shut[i] < 0) return i; return -1; }
  open() { return this.hold - this.locked; }
  free() { let f = 0; for (let i = 0; i < this.spaces.length; i++) if (this.spaces[i] < 0 && this.shut[i] < 0) f++; return f; }
  needOf(id) { return id < 0 ? 99 : this.C.cards[id].partner >= 0 ? 2 : 1; }
  need(col) { return this.needOf(this.front(col)); }
  // why a front card's tap is refused, judged on given fronts (fr[col] = card or -1): 0 legal/no card, 1 no free space, 2 linked with < 2, 3 partner not a front
  whyOf(id, fr) { if (id < 0) return 0; const cd = this.C.cards[id], f = this.free();
    if (cd.partner >= 0) { const pc = this.C.cards[cd.partner].col; if (fr[pc] !== cd.partner) return 3; return f >= 2 ? 0 : 2; } return f >= 1 ? 0 : 1; }
  fronts() { return [0, 1, 2, 3, 4].map((c) => this.front(c)); }
  whyCol(col) { return this.whyOf(this.front(col), this.fronts()); }
  legal(col) { return this.front(col) >= 0 && this.whyCol(col) === 0; }
  place(id) { const sp = this.firstFree();
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
  colourOpen(s) { this.C.locks.forEach((lk, k) => { if (lk.mat > 0 && lk.mat === s.m) this.unlock(k, { m: s.m }); }); } // v5: a colour lock (v6: its own)
  inView(id) { const cd = this.C.cards[id]; if (!cd) return false; const p = this.cols[cd.col].indexOf(id); return p >= 0 && p <= this.pullDepth; }
  // -- power-ups (SPEC-v4 §9 M5; v5 R1's Quartermaster) --
  canPower(k, a) { const no = (w) => { this.why = w; return REFUSED; }; this.why = ''; if (this.status !== PLAYING) { this.why = 'noplay'; return NOPLAY; } if (this.used[k] >= (this.powers[k] || 0)) return no('perLevel');
    if (k === 0) return this.hold < MAXLINE ? 0 : no('maxline');
    if (k === 1) { const id = a, cd = this.C.cards[id]; if (!cd) return no('badCard'); const col = this.cols[cd.col], p = col.indexOf(id); if (p < 0) return no('notInColumn'); if (p > this.pullDepth) return no('tooDeep');
      if (cd.partner >= 0) { if (!this.inView(cd.partner)) return no('partnerOutOfView'); return this.free() >= 2 ? 0 : no('noTwoSpaces'); }
      return this.free() >= 1 ? 0 : no('noSpace'); }
    if (k === 2) { for (let id = 0; id < this.C.cards.length; id++) if (this.hidden(id)) return 0; return no('noneHidden'); }
    if (k === 4) { const m = a; if (!(Number.isInteger(m) && m >= 1 && m <= 14 && m !== IRON)) return no('badColour'); return this.standing[m] > 0 || this.sappersOf(m) > 0 ? 0 : no('noneLeft'); } // v5 R4 fix: the Volley
    if (k === 3) { if (!(a >= 0 && a < this.spaces.length)) return no('badSpace'); const si = this.spaces[a]; if (si < 0) return no('emptySpace'); const s = this.squads[si];
      if (s.partner >= 0) return no('linked'); if (s.out > 0) return no('sappersOut'); if (s.waiting <= 0 || s.done) return no('noneWaiting'); return 0; }
    return no('badK'); }
  power(k, a, t) { if (t !== undefined) this.advanceTo(t); const r = this.canPower(k, a); if (r !== 0) return r; this.used[k]++;
    if (k === 0) { let s = this.spaces.length; while (s > 0 && this.shut[s - 1] >= 0) s--; this.spaces.splice(s, 0, -1); this.shut.splice(s, 0, -1); this.hold++; this.ev('POWER', { k, a: s }); }
    else if (k === 1) { const cd = this.C.cards[a], pid = cd.partner; // v5: the card leaves its column (revealed as it goes), then its partner; POWER; then they take spaces like a tap
      const leave = (id) => { const c = this.C.cards[id], wasFront = this.front(c.col) === id; this.seen(id); const col = this.cols[c.col]; col.splice(col.indexOf(id), 1); if (wasFront) { const f = this.front(c.col); if (f >= 0) this.seen(f); } };
      leave(a); if (pid >= 0) leave(pid); this.ev('POWER', { k, a });
      const put = (id) => { const sp = this.firstFree(); const c = this.C.cards[id], n = this.cn[id];
        const s = { id: this.squads.length, card: id, m: c.m, n, waiting: n, out: 0, wary: false, last: -1e9, ord: this.placeSeq++, space: sp, partner: -1, done: false, enRoute: 0, col: c.col };
        this.squads.push(s); this.spaces[sp] = s.id; this.ev('TAP', { m: s.m, n: s.n, sp }); return s; };
      const s1 = put(a), s2 = pid >= 0 ? put(pid) : null; if (s2) { s1.partner = s2.id; s2.partner = s1.id; } this.colourOpen(s1); if (s2) this.colourOpen(s2); this.peak = Math.max(this.peak, this.spaces.filter((v) => v >= 0).length);
      this.dispatch(); }
    else if (k === 2) { const hid = []; for (let id = 0; id < this.C.cards.length; id++) if (this.hidden(id)) hid.push(id); for (const id of hid) this.seen(id); this.ev('POWER', { k, a: hid.length }); }
    else if (k === 4) this.volley(a);
    else if (k === 3) { const s = this.squads[this.spaces[a]]; this.cn[s.card] = s.waiting; s.waiting = 0; s.done = true; s.recalled = true; this.cols[s.col].unshift(s.card); this.spaces[a] = -1;
      this.ev('POWER', { k, a }); this.ev('FREE', { sp: a, m: s.m }); }
    this.checkRest(); return 0; }
  // The Volley on colour m (SPEC-v4 §9 v5 R1): POWER 4 m, its pixels cleared in the clear order, its cards out of the
  // columns (cut), its squads out of the line, its sappers 0, a colour lock of m open; then the dispatch (in power()).
  removeCell(c, how) { const m = this.a[c]; this.a[c] = DIRT; this.claimed[c] = 0; this.standing[m]--; this.pixLeft--; this.dirty = true; this.ev(how, { c, m });
    if (this.C.isTower[c]) this.C.towers.forEach((tw, k) => { if (tw.cells.includes(c)) { this.towerLeft[k]--; if (!this.towerLeft[k]) { this.ev('TOWER', { k }); this.unpinTower(k); } } });
    this.keyGone(c);
    if (this.gateOfKey.has(c)) { for (const g of this.C.gates[this.gateOfKey.get(c)].cells) if (this.a[g] > 0) { this.standing[this.a[g]]--; this.a[g] = DIRT; this.pixLeft--; } this.ev('GATE', {}); }
    this.expose(true); }
  volley(m) { this.ev('POWER', { k: 4, a: m });
    for (const c of this.C.clearRank) if (this.a[c] === m && !this.gateCell[c]) this.removeCell(c, 'CLEAR');
    for (let col = 0; col < 5; col++) for (const id of this.cols[col].slice()) { const cd = this.C.cards[id]; if (cd.m !== m) continue; const list = this.cols[col], wasFront = list[0] === id; this.seen(id); list.splice(list.indexOf(id), 1);
      if (wasFront) { const f = this.front(col); if (f >= 0) this.seen(f); } if (cd.partner >= 0) { this.C.cards[cd.partner].partner = -1; cd.partner = -1; } this.cn[id] = 0; }
    for (const p of this.pins.slice().sort((a, b) => a.sid - b.sid)) { const q = this.squads[p.s]; if (q.m !== m || q.space < 0 || this.spaces[q.space] !== q.id) continue; this.pins.splice(this.pins.indexOf(p), 1); q.pinned--; this.ev('REL', {}); } // 1b: cut loose
    for (const s of this.squads.slice().sort((x, y) => x.ord - y.ord)) { if (s.m !== m || s.space < 0 || this.spaces[s.space] !== s.id) continue; s.waiting = 0; s.cut = true; s.done = true; s.enRoute = 0; s.out = 0;
      const p = s.partner >= 0 ? this.squads[s.partner] : null; if (p) { p.partner = -1; s.partner = -1; } this.spaces[s.space] = -1; this.ev('FREE', { sp: s.space, m }); s.space = -1;
      if (p && p.done && p.space >= 0 && this.spaces[p.space] === p.id) { this.spaces[p.space] = -1; this.ev('FREE', { sp: p.space, m: p.m }); } } // its partner, done and held only by the link, frees with it
    for (const s of this.squads) if (s.partner >= 0 && this.squads[s.partner].cut) s.partner = -1;
    this.C.locks.forEach((lk, k) => { if (lk.mat === m) this.unlock(k, { m }); });
    if (this.pixLeft === 0 && this.status === PLAYING) { this.status = WON; this.winAt = this.now; }
    if (this.status === PLAYING) this.dispatch(); }
  // -- time --
  sched(t, type, data) { this.q.push({ t, seq: this.seq++, type, ...data }); }
  dispatch() { const T = this.T, t = this.now;
    const live = this.squads.filter((s) => s.space >= 0 && !s.done).sort((x, y) => x.ord - y.ord);
    for (const s of live) { if (s.waiting <= 0 || t < s.last + T.staggerMs) continue; const tg = this.target(s.m, s.wary); if (!tg) continue;
      s.waiting--; s.out++; s.last = t; const tiles = tg.d + 1;
      const sid = this.sent++;
      if (this.covered(tg.c)) { s.wary = true; const tw = this.C.pin ? this.shooter(tg.c) : -1; this.sched(t + T.yardMs + Math.ceil(tiles / 2) * T.tileMs, 'HIT', { s: s.id, tiles, c: tg.c, tw, sid }); }
      else { this.claimed[tg.c] = 1; s.enRoute++; this.sched(t + T.yardMs + tiles * T.tileMs + T.biteMs, 'POP', { s: s.id, c: tg.c, tiles }); }
      if (s.waiting > 0) this.sched(t + T.staggerMs, 'WAKE', {}); } }
  shooter(c) { const { w } = this.C; return this.C.towers.findIndex((t, k) => this.towerLeft[k] && ((c % w) - t.cx) ** 2 + (((c / w) | 0) - t.cy) ** 2 <= t.r * t.r); }
  // 1b: tower k fell: the sappers it pinned walk back, in send order.
  unpinTower(k) { const T = this.T; for (const p of this.pins.filter((q) => q.tw === k).sort((a, b) => a.sid - b.sid)) { this.pins.splice(this.pins.indexOf(p), 1); const s = this.squads[p.s]; s.pinned--; this.ev('REL', {});
      s.enRoute++; this.sched(this.now + T.yardMs + Math.ceil(p.tiles / 2) * T.tileMs, 'BACK', { s: s.id }); } }
  finish(s) { if (s.done || s.waiting > 0 || s.out > 0) return; s.done = true;
    const p = s.partner >= 0 ? this.squads[s.partner] : null; if (p && !p.done) return;
    const list = p ? [s, p].sort((x, y) => x.ord - y.ord) : [s];
    for (const q of list) { this.spaces[q.space] = -1; this.ev('FREE', { sp: q.space, m: q.m }); } }
  sappersOf(m) { let k = 0; for (let col = 0; col < 5; col++) for (const id of this.cols[col]) if (this.C.cards[id].m === m) k += this.cn[id];
    for (const s of this.squads) if (s.m === m && !s.recalled) k += s.waiting + s.enRoute + (s.pinned || 0); return k; }
  handle(ev) { const T = this.T, s = ev.s !== undefined ? this.squads[ev.s] : null; // HOME of a carrier has no squad
    if (ev.type === 'WAKE') return;
    if (ev.type === 'POP' && s.cut) { this.sched(this.now + T.yardMs + ev.tiles * T.carryMs, 'HOME', { carrier: 1 }); return; } // v5 R4 fix: a walker the Volley cut loose arrives at nothing and walks home
    if ((ev.type === 'HIT' || ev.type === 'BACK') && s.cut) return;
    if (ev.type === 'POP') { const c = ev.c, m = this.a[c]; this.a[c] = DIRT; this.claimed[c] = 0; this.standing[m]--; this.pixLeft--; this.dirty = true; s.enRoute--;
      this.ev('EAT', { c, m });
      if (this.C.isTower[c]) this.C.towers.forEach((tw, k) => { if (tw.cells.includes(c)) { this.towerLeft[k]--; if (!this.towerLeft[k]) { this.ev('TOWER', { k }); this.unpinTower(k); } } });
      this.keyGone(c);
      if (this.gateOfKey.has(c)) { for (const g of this.C.gates[this.gateOfKey.get(c)].cells) if (this.a[g] > 0) { this.standing[this.a[g]]--; this.a[g] = DIRT; this.pixLeft--; } this.ev('GATE', {}); }
      this.expose(true);
      this.sched(this.now + T.yardMs + ev.tiles * T.carryMs, 'HOME', { carrier: 1 });
      s.out--; this.finish(s);
      if (this.pixLeft === 0 && this.status === PLAYING) { this.status = WON; this.winAt = this.now; }
      return; }
    if (ev.type === 'HOME') return;
    if (ev.type === 'HIT') { this.hits++;
      if (this.lethal) { s.out--; this.kills++; this.ev('KILL', { m: s.m });
        if (this.status === PLAYING && this.sappersOf(s.m) < this.standing[s.m]) { this.status = FAILED; this.reason = 'short'; }
        this.finish(s); }
      else if (this.C.pin && ev.tw >= 0 && this.towerLeft[ev.tw]) { this.ev('PIN', { m: s.m }); s.pinned = (s.pinned || 0) + 1; this.pins.push({ s: s.id, tiles: ev.tiles, tw: ev.tw, sid: ev.sid }); }
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
    if (!any) { this.status = FAILED; this.reason = 'jam'; this.jamWhy = (this.free() > 0 ? 1 : 0) | (this.locked > 0 ? 2 : 0) | ([0, 1, 2, 3, 4].some((c) => this.whyCol(c) === 3) ? 4 : 0) | (this.pins.length ? 8 : 0); } }
}
const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
