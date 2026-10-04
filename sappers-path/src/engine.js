// Sapper's Path rules engine v3 (SPEC-v3 §2-4; decisions in SPEC-v3 §9). PURE: no DOM, no clock, no randomness, so it
// ports to Godot as-is. UMD: require('./engine.js') in Node, window.SappersPath.engine in the page.
//
// Level JSON: {w, h, grid:[h strings of w chars], gates?:[{at:[x,y], key:[x,y]}], towers?:[{at:[x,y], r}],
//              cols:[5 x [card, ...]] (each column front card first), safeArchers?: true,
//              links?:[[[col, i], [col, i]], ...], lock?:{key:[x,y]}, pic?: true (v4.1)}
// safeArchers (the archer teaching level, 51): its archers never kill, on any difficulty; a hit goes to the line.
// v4 M2 (backward compatible: a file without the new fields parses and plays exactly as before). A card is [mat, count]
// or [mat, count, flags]; flags is 0 or 1 (1 = mystery). links pairs two cards by [column, index in that column] (index
// 0 = the column's first card); the two must be in different columns, and a card is in at most one pair. lock gives the
// key of the locked space: a gilt cell that is not a gate's key. E.check(L) lists warnings (a mystery flag on a first
// card, partners more than 2 rows apart or not in neighbouring columns); compile throws on errors.
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
//   sapper of its squad has been sent and is home. (v4.3: when its last block is picked up; see the v4.3 note below.)
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
// v4 M2, the twists (SPEC-v4 §9). A level that uses none of them plays exactly as above.
//   Mystery: a mystery card is hidden (the page shows "?" and its count) while it is behind the front of its column. The
//   front card is never hidden (so a flag on a column's first card means nothing), a card that reaches the front is
//   revealed for good, and a linked partner pulled out while hidden is revealed as it leaves. Information only: no rule
//   reads it.
//   Linked squads: a tap on a linked card (it must be the front of its column) needs 2 free spaces, else it is refused
//   like v3.1's (REFUSED, nothing changes). It takes both at the same moment: the tapped card's squad the lowest free
//   space, then its partner's the next lowest, the partner pulled out of its column wherever it sits (the cards behind it
//   close up). One play. Each squad dispatches on its own for its own colour, but neither space frees until both squads
//   are finished (every sapper sent and home; a Hard kill counts as finished); then both free at that moment, the
//   earlier-placed space first. A linked squad never merges (mergeLeftovers).
//   Locked space: a level with a lock starts with rules.lockSpaces (1, never all) of its difficulty's spaces locked,
//   always the last ones; a squad only takes an open space. The lock opens the moment its key pixel pops.
//   Jam, generalized: at rest (nothing moving), with cards left, if every front card's tap would be refused (no free
//   space, or a linked card with fewer than 2), the level fails jam. jamWhy: bit 1 a space was free (so a linked card
//   needed 2), bit 2 a space was still locked. With it, every rest state has a legal tap, a win, or a fail.
//   Patient play still never meets a refused tap on a level without links; with links a patient player picks only
//   among taps that are not refused (the grader does).
// v4.1, picture boards (SPEC-v4 §9, the v4.1 entry; v4 M4's ring levels are retired: a level with ring: true throws).
//   pic: true marks a board drawn as a picture inside a 1-cell frame of open ground: every border cell (x = 0, y = 0,
//   x = w-1 or y = h-1) is dirt, camp or (on the left and right borders only, where a moat runs off the board) water, and
//   the camp is one run of cells in the bottom border row and nowhere else (the entry square: sappers come out of it).
//   compile throws otherwise. No rule changes: the entry is the camp, so connected ground, distance (BFS from the camp)
//   and the tie-break (nearest the camp row, then the lower x, then the lower y) are SPEC-v3's, on every level.
// v4 M5, power-ups (SPEC-v4 §9). Four engine operations at the clock, like a tap: power(k, a, t) runs the clock to t,
//   then applies power k or refuses it (REFUSED: nothing in the state changes, nothing is counted). They take no time and
//   are logged as POWER k a. Each level allows rules.powers[k] uses of each (none when rules.powers is absent, so the
//   grader, the dealer and every stored order never meet one). Columns become a per-column order of their cards (seq),
//   counts are per card in the state (cn), and a card once seen face up stays revealed (shown); with no power used the
//   game plays exactly as before.
//   Ladder (k 0): one more open space for this level (the line's maximum is MAXLINE, 8). Locked spaces stay the last ones.
//   Quartermaster (k 1, a = a card): v5 R1, see the v5 R1 note (it sends the card straight out).
//   Scout (k 2): every hidden card is revealed. Refused when none is hidden.
//   Recall (k 3, a = a space): a squad with sappers waiting, none out and no partner goes back to the front of the
//     column it was tapped from as a card of the sappers still waiting; its space frees at once.
// v4.3 (SPEC-v4 §9, the v4.3 entry; every level rebaked). Two rule changes, nothing else:
//   A space frees when its squad's last block is picked up. A squad holds its space while any of its sappers is waiting
//   at it, walking out to a pixel, or (Easy, Normal) hit by an arrow and walking back to wait; a Hard kill is done. The
//   moment the last of them pops its pixel, the space frees (a linked pair: when both squads are there, both free, the
//   earlier-placed first), while those sappers still carry their blocks home. A freed space takes the next squad at once;
//   the sappers walking home belong to no space. The level is won when the last pixel pops and is over when nothing moves
//   (every sapper home): rest, the jam and stuck checks and the patient player's next tap all wait for that, as before.
//   "None out" (Recall, a stuck squad, a finished linked squad) means none walking out or back.
//   A linked card can be tapped only when its partner is the front card of its column too (and 2 open spaces are free);
//   the one tap then sends both squads, as before. A linked front card whose partner is buried is refused. The jam check
//   counts it as refused, and jamWhy bit 4 says a linked card's partner was buried.
// v5 R1 (SPEC-v4 §9, the v5 R1 entry; levels re-laid in R2). rules.hold spaces on every level (5; the tag sets nothing).
//   Archers never kill: a hit sapper always walks back to its space and waits (the short fail, rules.archersKill and
//   safeArchers are gone; a level's safeArchers is accepted and ignored). Dealing mode still fails a deal at any hit
//   (reason "hit"), so the dealer deals hit-free.
//   Locks (Hard levels from level 50, data-driven: the level file says which): lock: {key: [x, y]} is v4 M2's key lock
//   (the locked space opens when its gilt key pops); lock: {colour: m} is a colour lock, which opens the moment a squad of
//   colour m takes a space (a tap, either squad of a pair, a Quartermaster), logged UNLOCK -1 m after the TAP (a pair:
//   after LINK). Either way rules.lockSpaces (1) of the 5 spaces start locked, always the last.
//   Continue (revive(), rules.continues per attempt; the page charges coins): see revive().
//   Quartermaster (power 1, a = a card): a card in view (still in its column, at most rules.pullDepth (2) cards behind
//   the front; the front itself counts) goes straight out: it leaves its column (the cards behind close up; hidden: it is
//   revealed) and its squad takes the lowest free open space, as a tap's would. A linked card goes with its partner, which
//   must be in view in its own column too; the two need 2 free open spaces, take the two lowest (the pulled card first)
//   and are paired. Refused (nothing changes) when the spaces aren't free. Not a play. Log: REVEAL for each hidden card
//   that leaves and each hidden new front, POWER 1 a, TAP (TAP, LINK), UNLOCK (a colour lock), then the dispatch at that
//   instant and the end checks. No jam test: like a tap, it may fill the line with a squad that can't reach.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).engine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const GRASS = 0, WATER = -1, DIRT = -2, CAMP = -3;
  const NCOL = 5, NMAT = 15, IRON = 10, GILT = 14, MAXCELLS = 4096, MAXTOWERS = 8, MAXLINE = 8, MYSTERY = 1;
  const PLAYING = 0, WON = 1, FAILED = -1, NOPLAY = -2, REFUSED = -3;
  const OVERFLOW = 1, HIT = 2, STUCK = 3, JAM = 4; // OVERFLOW and HIT: dealing mode only (v3.1; v5 R1 the short fail is gone)
  const REASONS = ["", "overflow", "hit", "stuck", "jam"];
  // Event log (optional, S.logOn; the page's show reads it): [type, a, b] triples. TAP space mat (space -1: dealing overflow),
  // DISP sapper space, EAT cell sapper (the pixel pops), GATE gate 0, TOWER tower 0, HIT sapper mat (sent back), KILL
  // sapper mat, HOME sapper space, FREE space mat. v4 M2: REVEAL card column (a mystery card is revealed: it reached the
  // front, or it left hidden as a partner), LINK space space (a linked pair took these two spaces; after both TAPs),
  // UNLOCK cell 0 (the locked space opened: its key popped). v4 M5: POWER k a (power-up k used: Ladder a = the new open
  // space, Quartermaster a = the card pulled, Scout a = how many cards it revealed, Recall a = the space it freed).
  // v5 R1: CLEAR cell m (a block removed by a continue or a Volley, nobody's pop), CONT n 0 (a continue: n squads
  // finished on the spot), SHOW cell m (a mystery block exposed: its colour shows for good).
  const EV = { TAP: 1, DISP: 2, EAT: 3, GATE: 4, TOWER: 5, HIT: 6, KILL: 7, HOME: 8, FREE: 9, REVEAL: 10, LINK: 11, UNLOCK: 12, POWER: 13, CLEAR: 14, CONT: 15, SHOW: 16 };
  // v4 M5: the power-ups, by k.
  const PW = { LADDER: 0, PULL: 1, SCOUT: 2, RECALL: 3 }, NPW = 4, POWERS = ["ladder", "quartermaster", "scout", "recall"];
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
    // v4.1, a picture board: the border is open ground (dirt), water on the side borders only, and the camp: one run
    // of cells in the bottom border row (the entry square), no camp anywhere else. v4 M4's ring levels are retired.
    if (L.ring) throw new Error("level: ring levels were retired in v4.1 (bottom entry)");
    const pic = L.pic === true;
    if (pic) {
      let x0 = -1, x1 = -1;
      for (let c = 0; c < n; c++) {
        const x = c % w, y = (c / w) | 0, v = a0[c], edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        if (v === CAMP) { if (y !== h - 1 || (x1 >= 0 && x !== x1 + 1)) throw new Error("level: a picture's camp must be one run in its bottom border row"); if (x0 < 0) x0 = x; x1 = x; }
        else if (edge && !(v === DIRT || (v === WATER && (x === 0 || x === w - 1) && y > 0 && y < h - 1))) throw new Error("level: a picture's border must be open ground (water only on the side borders) at " + x + "," + y);
      }
    }
    const nb = new Int32Array(n * 4);
    for (let c = 0; c < n; c++) { const x = c % w, y = (c / w) | 0; for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; nb[c * 4 + d] = nx < 0 || ny < 0 || nx >= w || ny >= h ? -1 : ny * w + nx; } }
    // Tie-break rank: |y - campRow|, then x, then y. Unique per cell, so heap keys never tie.
    const order = Array.from({ length: n }, (_, c) => c).sort((p, q) => {
      const px = p % w, py = (p / w) | 0, qx = q % w, qy = (q / w) | 0;
      return Math.abs(py - campRow) - Math.abs(qy - campRow) || px - qx || py - qy;
    });
    const rank = new Int32Array(n); order.forEach((c, i) => { rank[c] = i; });
    // v5 R1, the clear order (a continue's pick): nearest the entry first, by the squared straight-line distance from the
    // camp run's middle on the camp row, (2x - (x0 + x1))^2 + (2(y - campRow))^2, then the tie-break rank.
    let cx0 = -1, cx1 = -1; for (let x = 0; x < w; x++) if (a0[campRow * w + x] === CAMP) { if (cx0 < 0) cx0 = x; cx1 = x; }
    const d2 = (c) => { const dx = 2 * (c % w) - cx0 - cx1, dy = 2 * (((c / w) | 0) - campRow); return dx * dx + dy * dy; };
    const near = Int32Array.from(Array.from({ length: n }, (_, c) => c).sort((p, q) => d2(p) - d2(q) || rank[p] - rank[q]));
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

    // Deck: five columns, front card first. A card is [mat, count] or [mat, count, flags] (v4 M2: flags 1 = mystery).
    const cols = L.cols || [[], [], [], [], []];
    if (!Array.isArray(cols) || cols.length !== NCOL) throw new Error("level: cols must be 5 columns");
    const cardM = [], cardN = [], cardF = [], cardCol = [], colStart = new Int32Array(NCOL), colLen = new Int32Array(NCOL), sapTotal = new Int32Array(NMAT);
    cols.forEach((col, j) => {
      colStart[j] = cardM.length; colLen[j] = col.length;
      for (const cd of col) {
        const m = cd[0] | 0, k = cd[1] | 0, f = cd.length > 2 ? cd[2] : 0;
        if (!(m >= 1 && m < NMAT) || m === IRON || !(k >= 1 && k <= 999) || !(f === 0 || f === MYSTERY)) throw new Error("level: bad card");
        cardM.push(m); cardN.push(k); cardF.push(f); cardCol.push(j); sapTotal[m] += k;
      }
    });
    // Linked squads (v4 M2): pairs of cards [column, index], in different columns, each card in at most one pair.
    if (L.links != null && !Array.isArray(L.links)) throw new Error("level: links must be a list");
    const linkOf = new Int32Array(cardM.length).fill(-1), links = [];
    const cardAt = (p) => { const j = Array.isArray(p) ? p[0] : -1, i = Array.isArray(p) ? p[1] : -1; if (!(j >= 0 && j < NCOL && i >= 0 && i < colLen[j]) || (j | 0) !== j || (i | 0) !== i) throw new Error("level: bad link card"); return colStart[j] + i; };
    (L.links || []).forEach((P, k) => {
      if (!Array.isArray(P) || P.length !== 2) throw new Error("level: link " + k + " is not a pair");
      const a = cardAt(P[0]), b = cardAt(P[1]);
      if (cardCol[a] === cardCol[b]) throw new Error("level: link " + k + " joins two cards of one column");
      if (linkOf[a] >= 0 || linkOf[b] >= 0) throw new Error("level: link " + k + " reuses a linked card");
      linkOf[a] = b; linkOf[b] = a; links.push(a, b);
    });
    // Locked space (v4 M2): its key is a gilt cell that is not a gate's key. v5 R1: or a colour lock, {colour: m}, a card
    // colour of this deck (never iron); exactly one of key and colour.
    let lockKey = -1, lockMat = 0;
    if (L.lock != null) {
      if ((L.lock.key != null) === (L.lock.colour != null)) throw new Error("level: a lock has a key or a colour, not both or neither");
      if (L.lock.key != null) { const k = cellAt(L.lock.key, "lock key"); if (a0[k] !== GILT || keyOf[k] >= 0) throw new Error("level: the lock's key is not a free gilt cell"); lockKey = k; }
      else { const m = L.lock.colour; if (!(Number.isInteger(m) && m >= 1 && m < NMAT && m !== IRON && cardM.indexOf(m) >= 0)) throw new Error("level: a colour lock's colour has no card"); lockMat = m; }
    }
    const pix = new Int32Array(NMAT); for (let c = 0; c < n; c++) if (a0[c] > 0) pix[a0[c]]++;
    const hoff = new Int32Array(NMAT + 1); for (let m = 0; m < NMAT; m++) hoff[m + 1] = hoff[m] + (m === IRON ? 0 : pix[m]);
    // Zobrist keys for eaten cells (fixed-seed, so hashes are stable across runs).
    const Z1 = new Int32Array(n), Z2 = new Int32Array(n); let s = 0x5A17 ^ n;
    const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return t ^ (t >>> 14); };
    for (let c = 0; c < n; c++) { Z1[c] = rnd(); Z2[c] = rnd(); }
    let pixTotal = 0; for (let m = 1; m < NMAT; m++) pixTotal += pix[m];
    return { w, h, n, a0, nb, rank, near, campRow, gateOf, keyOf, gateCells, towerOf, cover, towers, cardM: Int32Array.from(cardM), cardN: Int32Array.from(cardN),
      colStart, colLen, sapTotal, pix, hoff, Z1, Z2, pixTotal, ncards: cardM.length, safeArchers: L.safeArchers === true,
      cardF: Int32Array.from(cardF), cardCol: Int32Array.from(cardCol), linkOf, links: Int32Array.from(links), nlinks: links.length >> 1, lockKey, lockMat, pic };
  }

  // Timing (config v3.time, whole ms of engine time; the page plays engine time at show.pace x real time). Every value
  // is clamped to a sane integer so a bad config can't stall or reorder the simulation.
  function timeOf(T) {
    const g = (k, d, lo) => { const v = T && Number.isFinite(+T[k]) ? Math.round(+T[k]) : d; return Math.max(lo, Math.min(60000, v)); };
    return { tileMs: g("tileMs", 80, 1), carryMs: g("carryMs", 90, 1), yardMs: g("yardMs", 250, 0), biteMs: g("biteMs", 180, 0), staggerMs: g("staggerMs", 120, 0), knockMs: g("knockMs", 300, 0) };
  }

  // A mutable game on a compiled board: a deterministic, event-driven time simulation (SPEC-v3 §3, the dispatch model).
  // rules = {hold, archersKill, time, mergeLeftovers?, lockSpaces?}. opts.deal: dealing mode (no tray: squads come from
  // playSquad and playPair; no refusal, no stuck or jam checks: a squad with no open space fails overflow; any archer kill
  // fails). The whole state (grid, reachability heaps, spaces, sappers in flight, the event queue, the clock, and v4 M2's
  // pulled cards, space pairs and lock) lives in one Int32Array, so save/load are one copy and a replay is exact.
  function sim(B, rules, opts) {
    const n = B.n, nb = B.nb, rank = B.rank, cover = B.cover, towerOf = B.towerOf, keyOf = B.keyOf, gateOf = B.gateOf, hoff = B.hoff, linkOf = B.linkOf;
    const cap = Math.max(1, Math.min(MAXLINE, rules.hold | 0)), deal = !!(opts && opts.deal), nt = B.towers.length; // v5 R1: archers never kill
    const merge = rules.mergeLeftovers === true, T = timeOf(rules.time);
    // Locked spaces (v4 M2): rules.lockSpaces (default 1) of the line's last spaces, never all of them.
    const lockN = B.lockKey >= 0 || B.lockMat > 0 ? Math.max(0, Math.min(cap - 1, rules.lockSpaces == null ? 1 : rules.lockSpaces | 0)) : 0;
    // v4 M5: uses of each power-up a level allows (rules.powers[k], 0-99; none without it), and how far back the
    // Quartermaster reaches (rules.pullDepth, cards behind the front, default 2).
    const pwLim = new Int32Array(NPW); for (let k = 0; k < NPW; k++) pwLim[k] = rules.powers ? Math.max(0, Math.min(99, rules.powers[k] | 0)) : 0;
    const pullDepth = Math.max(1, Math.min(64, rules.pullDepth == null ? 2 : rules.pullDepth | 0));
    const contLim = Math.max(0, Math.min(9, rules.continues | 0)); // v5 R1: continues allowed per attempt (none without it)
    // Sappers are numbered per game: every dispatch is one pixel popped or one archer hit (at most one per squad, then
    // it is wary), so pixels + squads bounds them. Pending events: one per sapper in flight, plus a wake per space.
    const SQ = deal ? 4096 : B.ncards + 8, SMAX = B.pixTotal + SQ + 8, EMAX = SMAX + 4 * MAXLINE + 8;
    // Layout of the state buffer.
    let o = 0; const at = (k) => { const r = o; o += k; return r; };
    const oA = at(n), oD = at(n), oK = at(n), oP = at(n), oH = at(B.hoff[NMAT]), oHL = at(NMAT), oLeft = at(NMAT), oSap = at(NMAT), oT = at(MAXTOWERS),
      oHead = at(NCOL), oSM = at(MAXLINE), oSW = at(MAXLINE), oSO = at(MAXLINE), oSF = at(MAXLINE), oSN = at(MAXLINE), oSQ = at(MAXLINE), oOrd = at(MAXLINE),
      oS = at(32), oQS = at(SMAX), oQC = at(SMAX), oQK = at(SMAX), oQ0 = at(SMAX), oQ1 = at(SMAX), oQ2 = at(SMAX), oET = at(EMAX), oEQ = at(EMAX), oEX = at(EMAX),
      oGone = at(B.ncards + 1), oSL = at(MAXLINE), oSeq = at(B.ncards + 1), oPos = at(B.ncards + 1), oShown = at(B.ncards + 1), oCn = at(B.ncards + 1), oSC = at(MAXLINE);
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
    // v4 M2: gone (a linked partner pulled out of its column: 1), and each space's partner space + 1 (0 = not linked).
    const gone = sub(oGone, B.ncards), spL = sub(oSL, MAXLINE);
    // v4 M5: seq (column j's cards in order, front first from slot colStart[j] + heads[j]: slots before the head hold its
    // played and pulled cards), pos (a card's slot in its column), shown (a card seen face up: it stays revealed), cn (a
    // card's count: a Recall rewrites it) and each space's card + 1 (0: none, e.g. dealing).
    const seq = sub(oSeq, B.ncards), pos = sub(oPos, B.ncards), shown = sub(oShown, B.ncards), cn = sub(oCn, B.ncards), spC = sub(oSC, MAXLINE);
    // Scalars in M[oS + k]. LOCK: spaces still locked (v4 M2); JAMK: why a jam happened (bits, see settle); v4 M5: XCAP
    // spaces added by Ladders, PWANY 1 once any power-up was used, USE..USE+3 the uses of each.
    const S_LEN = oS, S_PIX = oS + 1, S_STAND = oS + 2, S_STATUS = oS + 3, S_REASON = oS + 4, S_HITS = oS + 5, S_KILLS = oS + 6, S_Z1 = oS + 7, S_Z2 = oS + 8,
      S_PEAK = oS + 9, S_PLAYS = oS + 10, S_FAILM = oS + 11, S_NOW = oS + 12, S_SN = oS + 13, S_EL = oS + 14, S_ESEQ = oS + 15, S_ORD = oS + 16, S_TAPS = oS + 17, S_OUT = oS + 18, S_DISP = oS + 19,
      S_LOCK = oS + 20, S_JAMK = oS + 21, S_XCAP = oS + 22, S_PWANY = oS + 23, S_USE = oS + 24, S_CONT = oS + 30;
    const CLAIMED = -2;
    const capNow = () => cap + M[S_XCAP]; // the line's spaces (Ladders included; locked ones too)
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
    // A pixel goes (popped by sapper id, or v5 R1 cleared: how = EV.CLEAR, id = its colour); keys, towers and the lock as one.
    function eatCell(c, id, how) {
      const m = a[c];
      a[c] = DIRT; hk[c] = -1; left[m]--; M[S_PIX]--; M[S_Z1] ^= B.Z1[c]; M[S_Z2] ^= B.Z2[c]; log(how || EV.EAT, c, id);
      const t = towerOf[c]; if (t >= 0 && --tleft[t] === 0) { M[S_STAND] &= ~(1 << t); log(EV.TOWER, t, 0); }
      if (c === B.lockKey && M[S_LOCK] > 0) { M[S_LOCK] = 0; log(EV.UNLOCK, c, 0); } // v4 M2: the locked space opens
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
        qK[id] = deal ? 3 : 2; q1[id] = t + T.yardMs + half * T.tileMs; q2[id] = q1[id] + T.knockMs + T.yardMs + half * T.tileMs;
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
    // A space frees when its squad is finished: all sent and every block picked up (v4.3; spO counts the sappers walking
    // out, or hit and walking back). v4 M2: a linked squad's space holds until its partner is finished too; then both
    // free, the earlier-placed one first.
    function freeIf(s) {
      if (spQ[s] === 0 || spW[s] > 0 || spO[s] > 0) return;
      const p = spL[s] - 1;
      if (p < 0) { release(s); return; }
      if (spW[p] > 0 || spO[p] > 0) return;
      if (spQ[p] < spQ[s]) { release(p); release(s); } else { release(s); release(p); }
    }
    function release(s) {
      spQ[s] = 0; spL[s] = 0; spC[s] = 0; M[S_LEN]--; log(EV.FREE, s, spM[s]);
      const len = M[S_ORD]; let j = 0; for (let k = 0; k < len; k++) if (ord[k] !== s) ord[j++] = ord[k]; M[S_ORD] = j;
    }
    function handle(x, t) {
      const type = x & 3, id = x >> 2;
      if (type === 0) { // the sapper reaches its pixel: it pops (its block picked up), then the sapper carries it home
        const c = qC[id], m = a[c], s = qS[id];
        if (m > 0) { eatCell(c, id); sap[m]--; }
        push(q2[id], id * 4 + 2);
        if (M[S_PIX] === 0 && M[S_STATUS] === PLAYING) M[S_STATUS] = WON;
        spO[s]--; freeIf(s); // v4.3: the squad's space frees once its last block is picked up
      } else if (type === 1) { // an arrow: the sapper is knocked back to its space (v5 R1: on every level, never killed)
        const s = qS[id], m = spM[s]; M[S_HITS]++;
        if (qK[id] === 3) { // dealing mode only: any hit fails the deal (the dealer deals hit-free)
          M[S_KILLS]++; sap[m]--; spO[s]--; M[S_OUT]--; log(EV.KILL, id, m);
          if (M[S_STATUS] === PLAYING) fail(HIT, m);
          freeIf(s);
        } else { log(EV.HIT, id, m); push(q2[id], id * 4 + 2); }
      } else if (type === 2) { // home: a hit sapper rejoins its squad (Easy, Normal); a carrier is just home (v4.3: its
        // space freed at its pop and may hold another squad by now, so it is not touched)
        const s = qS[id]; M[S_OUT]--;
        if (qK[id] === 2) { spO[s]--; spW[s]++; freeIf(s); }
        log(EV.HOME, id, s);
      }
      // type 3: a space's stagger is up; dispatch runs after every batch of events
    }
    // Would a tap on a card of m be refused? Only when there is no open free space (and it can't merge). Open = the
    // line's spaces less the locked ones (v4 M2).
    function blocked(m) {
      if (M[S_LEN] < capNow() - M[S_LOCK]) return false;
      if (merge) for (let k = 0; k < M[S_ORD]; k++) if (spM[ord[k]] === m && !spL[ord[k]]) return false;
      return true;
    }
    // Would a tap on card ci (a front card) be refused, and why: 0 no; 1 no open free space; 2 a linked card with fewer
    // than 2 (v4 M2); 3 a linked card whose partner is not the front of its column (v4.3).
    const whyAt = (ci) => { const p = linkOf[ci]; if (p < 0) return blocked(B.cardM[ci]) ? 1 : 0; if (frontAt(B.cardCol[p]) !== p) return 3; return M[S_LEN] + 2 > capNow() - M[S_LOCK] ? 2 : 0; };
    const refusedAt = (ci) => whyAt(ci) !== 0;
    // A mystery card is hidden while it is still in its column behind the front (v4 M2) and has never been seen face up
    // (v4 M5: a card pushed back by a Quartermaster, or put back by a Recall, stays revealed).
    const hiddenAt = (ci) => (B.cardF[ci] & MYSTERY) !== 0 && !shown[ci] && !gone[ci] && pos[ci] > heads[B.cardCol[ci]];
    // Column j's front card (v4 M5: through seq), or -1.
    const frontAt = (j) => (heads[j] < B.colLen[j] ? seq[B.colStart[j] + heads[j]] : -1);
    // After every batch: the win, and once nothing is moving (no event pending), stuck and jam. At rest no squad can
    // send anyone (it would have), so a full line at rest is a line of squads that can't reach a pixel. v4 M2: jam is
    // every front card refused (no free space, or a linked card with fewer than 2); JAMK bit 1 a space was free, bit 2
    // a space was still locked; v4.3 bit 4 a linked front card's partner was buried.
    function settle() {
      if (M[S_STATUS] !== PLAYING) return;
      if (M[S_PIX] === 0) { M[S_STATUS] = WON; return; }
      if (deal || M[S_EL] > 0) return;
      let any = false, safe = false, buried = 0;
      for (let j = 0; j < NCOL; j++) { if (heads[j] >= B.colLen[j]) continue; any = true; const w = whyAt(frontAt(j)); if (!w) { safe = true; break; } if (w === 3) buried = 4; }
      if (!any) fail(STUCK, M[S_ORD] > 0 ? spM[ord[0]] : 0);
      else if (!safe) { fail(JAM, M[S_ORD] > 0 ? spM[ord[0]] : 0); M[S_JAMK] = (M[S_LEN] < capNow() - M[S_LOCK] ? 1 : 0) | (M[S_LOCK] > 0 ? 2 : 0) | buried; }
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
    // A squad takes the lowest free space (while the lock holds, the free spaces are all below the locked ones).
    function place(m, cnt, ci) {
      let s = 0; while (s < capNow() && spQ[s] !== 0) s++;
      spM[s] = m; spW[s] = cnt; spO[s] = 0; spF[s] = 0; spN[s] = M[S_NOW]; spQ[s] = ++M[S_TAPS]; spL[s] = 0; spC[s] = ci + 1; ord[M[S_ORD]++] = s;
      M[S_LEN]++; if (M[S_LEN] > M[S_PEAK]) M[S_PEAK] = M[S_LEN];
      return s;
    }
    // A squad takes a space at time t (the clock first runs to t). No open free space (and no merge): overflow, which
    // only dealing mode reaches (play() refuses first).
    function tap(m, cnt, t, ci) {
      if (t != null) advanceTo(t);
      if (M[S_STATUS] !== PLAYING) return M[S_STATUS];
      M[S_PLAYS]++;
      let s = -1;
      if (merge) for (let k = 0; k < M[S_ORD]; k++) if (spM[ord[k]] === m && !spL[ord[k]]) { s = ord[k]; spW[s] += cnt; break; }
      if (s < 0) {
        if (M[S_LEN] >= capNow() - M[S_LOCK]) { fail(OVERFLOW, m); log(EV.TAP, -1, m); return M[S_STATUS]; }
        s = place(m, cnt, ci == null ? -1 : ci);
      }
      log(EV.TAP, s, m); opened(m);
      dispatch(M[S_NOW]); settle();
      return M[S_STATUS];
    }
    // v5 R1: a colour lock opens the moment a squad of its colour is sent out (takes a space). Event UNLOCK -1 m.
    function opened(m) { if (m === B.lockMat && M[S_LOCK] > 0) { M[S_LOCK] = 0; log(EV.UNLOCK, -1, m); } }
    // A linked pair (v4 M2) takes two spaces at the same moment: m1's squad first, then m2's. One play. Fewer than 2 open
    // free spaces: overflow (dealing mode only; play() refuses first).
    function pair(m1, n1, m2, n2, t, c1, c2) {
      if (t != null) advanceTo(t);
      if (M[S_STATUS] !== PLAYING) return M[S_STATUS];
      M[S_PLAYS]++;
      if (M[S_LEN] + 2 > capNow() - M[S_LOCK]) { fail(OVERFLOW, m1); log(EV.TAP, -1, m1); return M[S_STATUS]; }
      const s1 = place(m1, n1, c1 == null ? -1 : c1); log(EV.TAP, s1, m1);
      const s2 = place(m2, n2, c2 == null ? -1 : c2); log(EV.TAP, s2, m2);
      spL[s1] = s2 + 1; spL[s2] = s1 + 1; log(EV.LINK, s1, s2); opened(m1); opened(m2);
      dispatch(M[S_NOW]); settle();
      return M[S_STATUS];
    }
    // Column j's head moves on past pulled partners; a mystery card that becomes the front is revealed for good.
    function advanceHead(j) {
      const s0 = B.colStart[j], len = B.colLen[j];
      let h = heads[j] + 1; while (h < len && gone[seq[s0 + h]]) h++;
      heads[j] = h;
      if (h < len) { const c = seq[s0 + h]; if ((B.cardF[c] & MYSTERY) && !shown[c]) log(EV.REVEAL, c, j); shown[c] = 1; }
    }
    // Tap column col at time t (the clock first runs to t). Returns the status, NOPLAY (not playable) or REFUSED (no
    // free space, fewer than 2 for a linked card, or v4.3 a linked card whose partner is not its column's front: a no-op,
    // the card stays at the front and nothing in the state changes). A linked card sends its partner too (v4.3: the
    // partner is always a front card, so it leaves the front of its column).
    function play(col, t) {
      if (M[S_STATUS] !== PLAYING || col < 0 || col >= NCOL || heads[col] >= B.colLen[col]) return NOPLAY;
      if (t != null) { advanceTo(t); if (M[S_STATUS] !== PLAYING) return NOPLAY; }
      const ci = frontAt(col), p = linkOf[ci];
      if (!deal && refusedAt(ci)) return REFUSED;
      advanceHead(col);
      if (p < 0) return tap(B.cardM[ci], cn[ci], null, ci);
      const pj = B.cardCol[p];
      if (hiddenAt(p)) log(EV.REVEAL, p, pj);
      shown[p] = 1; gone[p] = 1; if (frontAt(pj) === p) advanceHead(pj);
      return pair(B.cardM[ci], cn[ci], B.cardM[p], cn[p], null, ci, p);
    }
    // A squad at space s that can't send anyone now: none of its sappers out (v4.3: walking out or back) and its colour
    // has no pixel it may go for (a wary squad: none outside the rings). The page marks it stuck; a line of them is a jam.
    function stuckAt(s) {
      if (s < 0 || s >= capNow() || !spQ[s] || spO[s] > 0 || spW[s] <= 0) return false;
      return (spF[s] & 1 ? wareTarget(spM[s]) : target(spM[s])) < 0;
    }
    // A linked squad that is finished but holds its space for its partner (v4 M2).
    const heldAt = (s) => s >= 0 && s < capNow() && spQ[s] !== 0 && spL[s] !== 0 && spW[s] === 0 && spO[s] === 0;

    // ---- v4 M5, power-ups ------------------------------------------------------------------------------------------
    // Cards still in column j ahead of card ci (ci in the column, behind the front): its depth (0 = the front).
    function depthOf(ci) { const j = B.cardCol[ci], s0 = B.colStart[j]; let k = 0; for (let h = heads[j]; h < pos[ci]; h++) if (!gone[seq[s0 + h]]) k++; return k; }
    // v5 R1: card ci is still in its column at most pullDepth cards behind the front (the front is depth 0).
    const inView = (ci) => !gone[ci] && pos[ci] >= heads[B.cardCol[ci]] && depthOf(ci) <= pullDepth;
    // Card ci leaves its column now (v5 R1 Quartermaster): revealed if hidden, the cards behind close up (the front: the
    // column's head moves on, and a hidden new front turns over).
    function leave(ci) { const j = B.cardCol[ci]; if (hiddenAt(ci)) log(EV.REVEAL, ci, j); shown[ci] = 1; if (frontAt(j) === ci) advanceHead(j); else gone[ci] = 1; }
    // Would power k with argument a be taken now (uses left aside)? Ladder: the line is under MAXLINE. Quartermaster: a is
    // a card still in its column, 1..pullDepth behind the front; at rest, some front card (with a in front) can be
    // tapped. Scout: a card is hidden. Recall: space a holds an unlinked squad (from a card) with sappers waiting and
    // none out.
    function powerOK(k, a) {
      if (k === PW.LADDER) return capNow() < MAXLINE;
      if (k === PW.SCOUT) { for (let ci = 0; ci < B.ncards; ci++) if (hiddenAt(ci)) return true; return false; }
      if (k === PW.PULL) { // v5 R1: a card in view goes straight out; it needs a free open space (a linked one: 2, partner in view)
        if (!(a >= 0 && a < B.ncards) || !inView(a)) return false;
        const p = linkOf[a]; if (p >= 0 && !inView(p)) return false;
        return M[S_LEN] + (p >= 0 ? 2 : 1) <= capNow() - M[S_LOCK];
      }
      if (k === PW.RECALL) return a >= 0 && a < capNow() && spQ[a] !== 0 && spL[a] === 0 && spO[a] === 0 && spW[a] > 0 && spC[a] > 0;
      return false;
    }
    // Apply power k (argument a) at time t (the clock first runs to t). Returns the status (PLAYING), NOPLAY (the game is
    // over, or dealing) or REFUSED (no uses left this level, or powerOK fails: nothing changes, nothing is counted).
    function power(k, a, t) {
      if (M[S_STATUS] !== PLAYING || deal || !(k >= 0 && k < NPW)) return NOPLAY;
      if (t != null) { advanceTo(t); if (M[S_STATUS] !== PLAYING) return NOPLAY; }
      if (M[S_USE + k] >= pwLim[k] || !powerOK(k, a)) return REFUSED;
      M[S_USE + k]++; M[S_PWANY] = 1;
      if (k === PW.LADDER) { M[S_XCAP]++; log(EV.POWER, k, capNow() - M[S_LOCK] - 1); }
      else if (k === PW.PULL) { // v5 R1: a (and its partner) leave their columns and take the lowest free spaces, as a tap would
        const p = linkOf[a]; leave(a); if (p >= 0) leave(p);
        log(EV.POWER, k, a);
        const s1 = place(B.cardM[a], cn[a], a); log(EV.TAP, s1, B.cardM[a]);
        if (p >= 0) { const s2 = place(B.cardM[p], cn[p], p); log(EV.TAP, s2, B.cardM[p]); spL[s1] = s2 + 1; spL[s2] = s1 + 1; log(EV.LINK, s1, s2); opened(B.cardM[p]); }
        opened(B.cardM[a]); dispatch(M[S_NOW]);
      } else if (k === PW.SCOUT) {
        let n = 0; for (let ci = 0; ci < B.ncards; ci++) if (hiddenAt(ci)) { shown[ci] = 1; n++; log(EV.REVEAL, ci, B.cardCol[ci]); }
        log(EV.POWER, k, n);
      } else { // Recall: the card goes back to its column's front with the sappers waiting (a played card: swapped into the
        // slot before the head; v5 R1, a card a Quartermaster took from behind the front: moved up to the head, back in line)
        const ci = spC[a] - 1, j = B.cardCol[ci], s0 = B.colStart[j];
        if (pos[ci] < heads[j]) { const h = heads[j] - 1, q = seq[s0 + h]; seq[s0 + pos[ci]] = q; pos[q] = pos[ci]; seq[s0 + h] = ci; pos[ci] = h; heads[j] = h; }
        else { const h = heads[j]; for (let i = pos[ci]; i > h; i--) { const c = seq[s0 + i - 1]; seq[s0 + i] = c; pos[c] = i; } seq[s0 + h] = ci; pos[ci] = h; }
        gone[ci] = 0; // back in its column (a card taken from behind the front was marked gone)
        cn[ci] = spW[a]; shown[ci] = 1; spW[a] = 0;
        log(EV.POWER, k, a); release(a);
      }
      settle();
      return M[S_STATUS];
    }

    // ---- v5 R1, the continue -----------------------------------------------------------------------------------------
    // Remove a standing pixel at once (a continue or a Volley): out of its heap if it is in reach, then gone like a pop.
    function clearCell(c) { const m = a[c]; if (hk[c] >= 0) removeAt(m, hpos[c]); eatCell(c, m, EV.CLEAR); sap[m]--; }
    // Would a continue be taken now: the level failed jammed, a continue is left this attempt, and on the empty line it
    // leaves some front card's tap would be taken (unlinked: an open space; linked: its partner a front and 2 open).
    function reviveOK() {
      if (M[S_STATUS] !== FAILED || M[S_REASON] !== JAM || deal || M[S_CONT] >= contLim) return false;
      const open = capNow() - M[S_LOCK];
      for (let j = 0; j < NCOL; j++) { const ci = frontAt(j); if (ci < 0) continue; const p = linkOf[ci]; if (p < 0 ? open >= 1 : frontAt(B.cardCol[p]) === p && open >= 2) return true; }
      return false;
    }
    // The continue (at the jam's instant; it takes no time): play resumes, and every squad in the line finishes on the
    // spot, in tap order: its waiting sappers' worth of its colour's standing pixels are removed (CLEAR), reachable or
    // not, nearest the entry first (B.near), then its space frees (a linked pair: when both are done). CONT n 0 first.
    function revive() {
      if (!reviveOK()) return M[S_STATUS] === FAILED ? REFUSED : NOPLAY;
      M[S_STATUS] = PLAYING; M[S_REASON] = 0; M[S_FAILM] = 0; M[S_JAMK] = 0; M[S_CONT]++;
      const len = M[S_ORD], sq = []; for (let k = 0; k < len; k++) sq.push(ord[k]);
      log(EV.CONT, len, 0);
      for (const s of sq) {
        const m = spM[s]; let k = spW[s]; spW[s] = 0;
        for (let i = 0; i < n && k > 0; i++) { const c = B.near[i]; if (a[c] === m && gateOf[c] < 0) { clearCell(c); k--; } }
        freeIf(s);
      }
      if (M[S_PIX] === 0) M[S_STATUS] = WON;
      dispatch(M[S_NOW]); settle();
      return M[S_STATUS];
    }

    // Initial state.
    a.set(B.a0); d.fill(-1); hk.fill(-1); hpos.fill(-1);
    for (let m = 0; m < NMAT; m++) left[m] = B.pix[m];
    for (let m = 0; m < NMAT; m++) sap[m] = deal ? 1 << 24 : B.sapTotal[m];
    for (let t = 0; t < nt; t++) { tleft[t] = B.towers[t].size; M[S_STAND] |= 1 << t; }
    M[S_PIX] = B.pixTotal; M[S_LOCK] = lockN;
    for (let ci = 0; ci < B.ncards; ci++) { seq[ci] = ci; pos[ci] = ci - B.colStart[B.cardCol[ci]]; cn[ci] = B.cardN[ci]; }
    for (let j = 0; j < NCOL; j++) if (B.colLen[j]) shown[B.colStart[j]] = 1; // the fronts are face up from the start
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
      if (B.nlinks) { // v4 M2: which partners were pulled, and which spaces are paired (by line position)
        for (let i = 0; i < B.links.length; i++) h1 = Math.imul(h1 ^ (gone[B.links[i]] * 4099 + i), 0x2C1B3C6D);
        for (let k = 0; k < M[S_ORD]; k++) { const p = spL[ord[k]] - 1; if (p < 0) continue; let pk = 0; while (pk < M[S_ORD] && ord[pk] !== p) pk++; h2 = Math.imul(h2 ^ (k * 64 + pk + 1), 0x297A2D39); }
      }
      if (M[S_PWANY]) { // v4 M5: once a power-up was used, the extra spaces and every column's cards, counts and reveals
        h1 = Math.imul(h1 ^ (M[S_XCAP] + 0x5A5), 0x3C6EF372);
        for (let j = 0; j < NCOL; j++) for (let hh = heads[j]; hh < B.colLen[j]; hh++) { const c = seq[B.colStart[j] + hh]; h2 = Math.imul(h2 ^ (c * 1024 + cn[c] * 2 + shown[c]), 0x6A09E667); }
      }
      h1 ^= M[S_STATUS] * 0x51ED27; h1 ^= h1 >>> 15; h2 ^= h2 >>> 13;
      return (h1 >>> 0) * 2097152 + (h2 >>> 11);
    };
    return {
      B, M, a, d, heads, left, ev, T, SMAX, target, covered, wareTarget, hash, play, advanceTo, quiet,
      spM, spW, spO, spF, spQ, spL, gone, qS, qC, qK, q0, q1, q2,
      get cap() { return capNow(); }, // the line's spaces (v4 M5: Ladders included)
      // Dealing: a squad of m and n at the clock (or at t); v4 M2 a linked pair (m1's squad, then m2's). The patient
      // caller then runs quiet().
      playSquad: (m, cnt, t) => tap(m, cnt, t == null ? M[S_NOW] : t),
      playPair: (m1, n1, m2, n2, t) => pair(m1, n1, m2, n2, t == null ? M[S_NOW] : t),
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
      front: (j) => frontAt(j),
      blocked: (m) => blocked(m), stuck: (s) => stuckAt(s),
      // v4 M2. open: spaces a squad may take now (the line's less the locked ones); locked: spaces still locked; jamWhy
      // (see settle). card(j, d): the d-th card still in column j (0 = the front), past pulled partners, or -1.
      // refused(j): would a tap on column j's front card be refused now. hidden(ci): is card ci a mystery the player
      // can't see yet. partner(ci): its linked card or -1. held(s): a finished linked squad holding its space.
      get open() { return capNow() - M[S_LOCK]; }, get locked() { return M[S_LOCK]; }, get jamWhy() { return M[S_JAMK]; }, get lockMat() { return B.lockMat; },
      card(j, d) { const s0 = B.colStart[j], len = B.colLen[j]; for (let h = heads[j], k = 0; h < len; h++) { const c = seq[s0 + h]; if (gone[c]) continue; if (k++ === d) return c; } return -1; },
      refused(j) { return heads[j] < B.colLen[j] && refusedAt(frontAt(j)); },
      // v4.3: why a tap on column j's front would be refused (0 not refused or no card, 1 no free space, 2 a linked card
      // with fewer than 2, 3 a linked card whose partner is not a front card). holding(s): sappers of space s walking out
      // or back (the space holds while any are, or any wait).
      why(j) { return heads[j] < B.colLen[j] ? whyAt(frontAt(j)) : 0; },
      hidden: (ci) => ci >= 0 && ci < B.ncards && hiddenAt(ci), partner: (ci) => (ci >= 0 && ci < B.ncards ? linkOf[ci] : -1), held: (s) => heldAt(s),
      // Reachable, unclaimed pixels of m right now (tools and UI; not on the hot path).
      reachable(m) { return m > 0 && m < NMAT ? hlen[m] : 0; },
      // v4 M5. power(k, a, t): use power-up k (PW) on a (a card for the Quartermaster, a space for Recall). canPower(k, a):
      // would it be taken now (uses left included). used(k): uses this level; limit(k): rules.powers[k]. count(ci): card ci's
      // squad size now (a Recall rewrites it). extra: spaces added by Ladders.
      power: (k, a, t) => power(k, a, t), canPower: (k, a) => M[S_STATUS] === PLAYING && !deal && k >= 0 && k < NPW && M[S_USE + k] < pwLim[k] && powerOK(k, a),
      used: (k) => (k >= 0 && k < NPW ? M[S_USE + k] : 0), limit: (k) => (k >= 0 && k < NPW ? pwLim[k] : 0), count: (ci) => (ci >= 0 && ci < B.ncards ? cn[ci] : 0),
      get extra() { return M[S_XCAP]; }, get pullDepth() { return pullDepth; },
      // v5 R1. revive(): the continue on a jam (REFUSED when not offered: nothing changes); canRevive(): would it be taken;
      // revived: continues used this attempt.
      revive: () => revive(), canRevive: () => reviveOK(), get revived() { return M[S_CONT]; },
    };
  }

  // Replay a column order patiently ("0123..."): tap, run until nothing moves, tap again. Returns the sim.
  function replay(B, rules, order) {
    const S = sim(B, rules);
    for (let i = 0; i < order.length && S.status === PLAYING; i++) { if (S.play(order.charCodeAt(i) - 48) < -1) break; S.quiet(); }
    S.quiet();
    return S;
  }
  // The engine rules for one difficulty: config v3.rules[d] with v3.time (and the comparison flags) attached; v4 M2 the
  // locked spaces per lock (v3.twists.lockSpaces). v4 M5: with meta (config.meta, the page only), the power-ups' uses per
  // level (meta.powers[k].perLevel, in PW order) and the Quartermaster's reach (meta.pullDepth).
  // v5 R1: v3.rules.hold spaces on every level, whatever the tag d (an older config's per-tag rules still read).
  const rulesOf = (v3, d, meta) => Object.assign({}, v3.rules.hold != null ? { hold: v3.rules.hold } : v3.rules[d] || v3.rules.normal, { time: v3.time }, v3.flags || {}, v3.twists ? { lockSpaces: v3.twists.lockSpaces } : {},
    meta && Array.isArray(meta.powers) ? { powers: POWERS.map((id) => { const p = meta.powers.find((q) => q && q.id === id); return p ? p.perLevel | 0 : 0; }), pullDepth: meta.pullDepth } : {},
    meta && meta.cont ? { continues: meta.cont.perLevel | 0 } : {}); // v5 R1: continues per attempt (the page only)
  const gridOf = (w, h, a) => { const g = []; for (let y = 0; y < h; y++) { let s = ""; for (let x = 0; x < w; x++) s += chOf(a[y * w + x]); g.push(s); } return g; };
  // Level warnings (v4 M2): things compile accepts but a player would find hard to read. opts.linkRowGap (default 2):
  // linked partners dealt more than this many rows apart; partners not in neighbouring columns (the rod would cross a
  // column); a mystery flag on a column's first card (it means nothing). Returns a list of strings (empty: clean).
  function check(L, opts) {
    const B = compile(L), out = [], gap = opts && opts.linkRowGap != null ? opts.linkRowGap : 2;
    for (let j = 0; j < NCOL; j++) if (B.colLen[j] && B.cardF[B.colStart[j]] & MYSTERY) out.push("column " + j + ": a mystery flag on the first card means nothing");
    for (let i = 0; i < B.links.length; i += 2) {
      const a = B.links[i], b = B.links[i + 1], ja = B.cardCol[a], jb = B.cardCol[b], ra = a - B.colStart[ja], rb = b - B.colStart[jb];
      if (Math.abs(ra - rb) > gap) out.push("link " + (i >> 1) + ": partners are " + Math.abs(ra - rb) + " rows apart (more than " + gap + ")");
      if (Math.abs(ja - jb) > 1) out.push("link " + (i >> 1) + ": partners are not in neighbouring columns");
    }
    return out;
  }

  return { compile, sim, replay, rulesOf, timeOf, gridOf, chOf, matOf, check, GRASS, WATER, DIRT, CAMP, NCOL, NMAT, IRON, GILT, MYSTERY, PLAYING, WON, FAILED, NOPLAY, REFUSED, EV, REASONS, PW, POWERS, MAXLINE };
});
