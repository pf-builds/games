// Sapper's Path rules engine (SPEC §1). PURE: no DOM, no clock, no randomness. UMD, so the Node tools and the
// browser load this exact file: require('./engine.js') in Node, window.SappersPath.engine in the page.
//
// Level JSON: {id?, name?, w, h, grid:[h strings of w chars], muster:{stone, timber, hedge, ice}, chests:[{x, y, crew}]}
// Grid legend:  .  open ground   ~  moat   K  keep   S stone   T timber   H hedge   I ice   F iron door   L lever   C chest
// x grows east, y grows south; a cell index is y * w + x. Crew/material index: 0 stone, 1 timber, 2 hedge, 3 ice, 4 iron.
//
// The whole game state is the SET of broken sections. Open ground, connected ground, claimed chests, thrown levers,
// open doors and remaining crews all derive from that set (derive), so undo is "drop the last move and re-derive".
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).engine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const OPEN = 0, MOAT = 1, KEEP = 2, WALL = 3, LEVER = 4, CHEST = 5;
  const CREWS = ["stone", "timber", "hedge", "ice"];
  const MAT_CODES = "STHIF", IRON = 4;
  const CREW_OF = { stone: 0, timber: 1, hedge: 2, ice: 3 };
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

  // Compile a level once. opts.noLevers: levers throw nothing (report metric "do levers matter").
  // Throws on malformed data (the baker and the page catch); everything after parse never throws.
  function parse(L, opts) {
    const w = L.w | 0, h = L.h | 0, n = w * h, grid = L.grid;
    if (!(w > 0 && h > 0) || !Array.isArray(grid) || grid.length !== h) throw new Error("level: bad size or grid");
    const kind = new Uint8Array(n), mat = new Int8Array(n).fill(-1), nb = new Int16Array(n * 4), edge = new Uint8Array(n);
    let keep = -1;
    for (let y = 0; y < h; y++) {
      if (typeof grid[y] !== "string" || grid[y].length !== w) throw new Error("level: row " + y + " is not " + w + " wide");
      for (let x = 0; x < w; x++) {
        const c = y * w + x, ch = grid[y][x], m = MAT_CODES.indexOf(ch);
        if (m >= 0) { kind[c] = WALL; mat[c] = m; }
        else if (ch === ".") kind[c] = OPEN;
        else if (ch === "~") kind[c] = MOAT;
        else if (ch === "L") kind[c] = LEVER;
        else if (ch === "C") kind[c] = CHEST;
        else if (ch === "K") { if (keep >= 0) throw new Error("level: two keeps"); kind[c] = KEEP; keep = c; }
        else throw new Error("level: bad cell '" + ch + "' at " + x + "," + y);
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          nb[c * 4 + d] = nx < 0 || ny < 0 || nx >= w || ny >= h ? -1 : ny * w + nx;
          if (nb[c * 4 + d] < 0) edge[c] = 1;
        }
      }
    }
    if (keep < 0) throw new Error("level: no keep");

    // Sections: maximal 4-connected same-material wall groups, fixed for the level.
    const sec = new Int16Array(n).fill(-1), secMat = [], secStart = [0], cells = [];
    for (let c0 = 0; c0 < n; c0++) {
      if (kind[c0] !== WALL || sec[c0] >= 0) continue;
      const id = secMat.length; secMat.push(mat[c0]); sec[c0] = id; cells.push(c0);
      for (let i = secStart[id]; i < cells.length; i++) {
        const c = cells[i];
        for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && kind[e] === WALL && mat[e] === mat[c0] && sec[e] < 0) { sec[e] = id; cells.push(e); } }
      }
      secStart.push(cells.length);
    }
    const nsec = secMat.length, secEdge = new Uint8Array(nsec), secDist = new Int16Array(nsec).fill(32767);
    const kx = keep % w, ky = (keep / w) | 0;
    for (let s = 0; s < nsec; s++) for (let i = secStart[s]; i < secStart[s + 1]; i++) {
      const c = cells[i]; if (edge[c]) secEdge[s] = 1;
      secDist[s] = Math.min(secDist[s], Math.abs(c % w - kx) + Math.abs(((c / w) | 0) - ky));
    }

    // Levers and the iron sections they open.
    const levers = [], leverDoorStart = [0], leverDoors = [];
    for (let c = 0; c < n; c++) {
      if (kind[c] !== LEVER) continue;
      levers.push(c);
      if (!(opts && opts.noLevers)) for (let d = 0; d < 4; d++) {
        const e = nb[c * 4 + d];
        if (e >= 0 && kind[e] === WALL && mat[e] === IRON && leverDoors.indexOf(sec[e], leverDoorStart[leverDoorStart.length - 1]) < 0) leverDoors.push(sec[e]);
      }
      leverDoorStart.push(leverDoors.length);
    }

    // Chests: every C cell needs one chests[] entry naming its crew.
    const chestCell = [], chestCrew = [], list = Array.isArray(L.chests) ? L.chests : [];
    for (let c = 0; c < n; c++) {
      if (kind[c] !== CHEST) continue;
      const e = list.find((q) => q && q.x === c % w && q.y === ((c / w) | 0));
      if (!e || !(e.crew in CREW_OF)) throw new Error("level: chest at " + (c % w) + "," + ((c / w) | 0) + " has no crew");
      chestCell.push(c); chestCrew.push(CREW_OF[e.crew]);
    }
    const muster = new Int16Array(4), M = L.muster || {};
    for (let i = 0; i < 4; i++) muster[i] = Math.max(0, Math.min(99, M[CREWS[i]] | 0));

    return {
      id: L.id, name: L.name, w, h, n, kind, mat, nb, edge, keep, sec, nsec,
      secMat: Int8Array.from(secMat), secStart: Int32Array.from(secStart), secCells: Int16Array.from(cells), secEdge, secDist,
      levers: Int16Array.from(levers), leverDoorStart: Int32Array.from(leverDoorStart), leverDoors: Int16Array.from(leverDoors),
      chestCell: Int16Array.from(chestCell), chestCrew: Int8Array.from(chestCrew), muster,
    };
  }

  // Scratch for derive. The solver keeps one per search depth, so its hot path allocates nothing.
  function scratch(B) {
    return {
      open: new Uint8Array(B.n), conn: new Uint8Array(B.n), queue: new Int16Array(B.n),
      reach: new Uint8Array(B.nsec), doorOpen: new Uint8Array(B.nsec), thrown: new Uint8Array(B.levers.length),
      claimed: new Uint8Array(B.chestCell.length), remaining: new Int16Array(4), used: 0, legal: 0, won: false, stuck: false, cascade: 0,
    };
  }

  function touches(B, conn, c) { const nb = B.nb; for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && conn[e]) return true; } return false; }
  function exposed(B, conn, c) { return B.edge[c] === 1 || touches(B, conn, c); }

  // SPEC §1 derived state for a broken-section set, written into D. Order-independent: every step only ever opens
  // more ground, so the fixed point is unique. The lever cascade is capped at W×H rounds.
  function derive(B, broken, D) {
    const n = B.n, kind = B.kind, nb = B.nb, open = D.open, conn = D.conn, q = D.queue, cells = B.secCells;
    for (let c = 0; c < n; c++) { const k = kind[c]; open[c] = k === OPEN || k === CHEST ? 1 : 0; conn[c] = 0; }
    D.doorOpen.fill(0); D.thrown.fill(0); D.claimed.fill(0); D.remaining.set(B.muster);
    let used = 0;
    for (let s = 0; s < B.nsec; s++) {
      if (!broken[s]) continue;
      used++; if (B.secMat[s] < IRON) D.remaining[B.secMat[s]]--;
      for (let i = B.secStart[s]; i < B.secStart[s + 1]; i++) open[cells[i]] = 1;
    }
    let head = 0, tail = 0, rounds = 0;
    for (let c = 0; c < n; c++) if (open[c] && B.edge[c]) { conn[c] = 1; q[tail++] = c; }
    for (; rounds < n; rounds++) {
      while (head < tail) {
        const c = q[head++];
        for (let d = 0; d < 4; d++) { const e = nb[c * 4 + d]; if (e >= 0 && open[e] && !conn[e]) { conn[e] = 1; q[tail++] = e; } }
      }
      let opened = false;
      for (let i = 0; i < B.levers.length; i++) {
        if (D.thrown[i] || !exposed(B, conn, B.levers[i])) continue;
        D.thrown[i] = 1;
        for (let j = B.leverDoorStart[i]; j < B.leverDoorStart[i + 1]; j++) {
          const s = B.leverDoors[j];
          if (D.doorOpen[s]) continue;
          D.doorOpen[s] = 1; opened = true;
          for (let k = B.secStart[s]; k < B.secStart[s + 1]; k++) {
            const c = cells[k]; open[c] = 1;
            if (!conn[c] && exposed(B, conn, c)) { conn[c] = 1; q[tail++] = c; }
          }
        }
      }
      if (!opened) break;
    }
    D.cascade = rounds;
    for (let i = 0; i < B.chestCell.length; i++) if (conn[B.chestCell[i]]) { D.claimed[i] = 1; D.remaining[B.chestCrew[i]]++; }
    D.won = touches(B, conn, B.keep);
    let legal = 0;
    for (let s = 0; s < B.nsec; s++) {
      let r = 0;
      if (!broken[s] && B.secMat[s] < IRON) {
        if (B.secEdge[s]) r = 1;
        else for (let i = B.secStart[s]; i < B.secStart[s + 1]; i++) if (touches(B, conn, cells[i])) { r = 1; break; }
      }
      D.reach[s] = r;
      if (r && !D.won && D.remaining[B.secMat[s]] > 0) legal++;
    }
    D.used = used; D.legal = legal; D.stuck = !D.won && legal === 0;
    return D;
  }

  // ---- Game-facing state: {moves, broken, ...derived}. Treat as immutable; apply/undo return new objects. ----
  function fromMoves(B, moves) {
    const broken = new Uint8Array(B.nsec);
    for (let i = 0; i < moves.length; i++) broken[moves[i]] = 1;
    const st = derive(B, broken, scratch(B));
    delete st.queue;
    st.moves = moves.slice(); st.broken = broken;
    return st;
  }
  function start(B) { return fromMoves(B, []); }
  function isCrewSection(B, s) { return s >= 0 && s < B.nsec && B.secMat[s] < IRON; }
  function canBreak(B, st, s) { return isCrewSection(B, s) && !st.won && !st.broken[s] && st.reach[s] === 1 && st.remaining[B.secMat[s]] > 0; }
  // A move: break section s with one crew of its material. Returns the new state, or null if the move is illegal.
  function apply(B, st, s) { return canBreak(B, st, s) ? fromMoves(B, st.moves.concat([s])) : null; }
  // Undo re-derives from the move list minus the last move, so it is exact by construction (crew, chests, levers).
  function undo(B, st) { return st.moves.length ? fromMoves(B, st.moves.slice(0, -1)) : st; }
  function restart(B) { return start(B); }
  function legalMoves(B, st) { const out = []; for (let s = 0; s < B.nsec; s++) if (canBreak(B, st, s)) out.push(s); return out; }
  function sectionAt(B, x, y) { return x < 0 || y < 0 || x >= B.w || y >= B.h ? -1 : B.sec[y * B.w + x]; }
  function sectionCells(B, s) { return Array.from(B.secCells.subarray(B.secStart[s], B.secStart[s + 1])); }
  function crewOf(B, s) { return B.secMat[s] < IRON ? CREWS[B.secMat[s]] : null; }
  // Stable text form of every derived field, for undo-parity tests and the page's renderSignature.
  function serialize(st) {
    return [st.moves.join(","), st.broken.join(""), st.open.join(""), st.conn.join(""), st.reach.join(""), st.doorOpen.join(""),
      st.thrown.join(""), st.claimed.join(""), st.remaining.join(","), st.used, st.legal, st.won, st.stuck].join("|");
  }
  // Crew totals the muster object form uses; handy for tools.
  function musterObj(arr) { const o = {}; for (let i = 0; i < 4; i++) o[CREWS[i]] = arr[i] | 0; return o; }

  return {
    OPEN, MOAT, KEEP, WALL, LEVER, CHEST, IRON, CREWS, CREW_OF, MAT_CODES,
    parse, scratch, derive, start, restart, apply, undo, canBreak, legalMoves, fromMoves,
    sectionAt, sectionCells, crewOf, isCrewSection, serialize, musterObj, touches,
  };
});
