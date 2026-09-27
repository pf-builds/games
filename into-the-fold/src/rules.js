// Into the Fold rules engine (SPEC §1). PURE: no DOM, no clock, no randomness. UMD, so the Node tools and the
// browser load this exact file: require('./rules.js') in Node, window.IntoTheFold.rules in the page.
//
// Board JSON: {w, h, rows:[h strings of w chars], pens:[{x, y, open:"N"|"E"|"S"|"W", c:"w"|"b"}], par?, id?}
// Row legend:
//   .  grass                 R  rock (a wall)
//   M  mud                   ~  pond
//   P  pen (its open side and colour come from pens[], matched on x,y)
//   w  white sheep on grass   W  white sheep on mud
//   b  black sheep on grass   B  black sheep on mud
// x grows east, y grows south; a cell index is y * w + x. Directions are "N","E","S","W" (or "up","right","down","left").
// A penned sheep sits on its pen cell for good, so sheep positions alone are the whole board state.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.IntoTheFold = root.IntoTheFold || {}).rules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const GRASS = 0, ROCK = 1, MUD = 2, POND = 3, PEN = 4;
  const DIRS = ["N", "E", "S", "W"];
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const DIR_OF = { N: 0, E: 1, S: 2, W: 3, up: 0, right: 1, down: 2, left: 3 };
  const COLOURS = ["w", "b"];
  // resolve() result bits
  const MOVED = 1, SPLASH = 2, PENNED = 4, STOPPER = 8;
  // Why a sheep stopped (per-sheep, for the renderer's squash / gate / splash choice)
  const STOPS = ["wall", "sheep", "mud", "pen", "pond"];
  const STOP_WALL = 0, STOP_SHEEP = 1, STOP_MUD = 2, STOP_PEN = 3, STOP_POND = 4;

  function dirIndex(d) {
    const i = typeof d === "number" ? d : DIR_OF[d];
    if (!(i >= 0 && i < 4)) throw new Error("bad direction: " + d);
    return i;
  }

  // Parse + validate board JSON into the engine's flat form. Throws on anything malformed.
  function parseBoard(json) {
    const b = typeof json === "string" ? JSON.parse(json) : json;
    const w = b.w | 0, h = b.h | 0, n = w * h;
    if (w < 2 || h < 2 || w > 16 || h > 16) throw new Error("board size out of range: " + w + "x" + h);
    if (!Array.isArray(b.rows) || b.rows.length !== h) throw new Error("rows must hold " + h + " strings");
    const type = new Uint8Array(n), penOpen = new Int8Array(n).fill(-1), penCol = new Int8Array(n).fill(-1);
    const sheep = [];
    for (let y = 0; y < h; y++) {
      const row = b.rows[y];
      if (typeof row !== "string" || row.length !== w) throw new Error("row " + y + " must be " + w + " chars");
      for (let x = 0; x < w; x++) {
        const ch = row[x], c = y * w + x;
        if (ch === ".") type[c] = GRASS;
        else if (ch === "R") type[c] = ROCK;
        else if (ch === "M") type[c] = MUD;
        else if (ch === "~") type[c] = POND;
        else if (ch === "P") type[c] = PEN;
        else if (ch === "w" || ch === "b") { type[c] = GRASS; sheep.push({ x, y, c: ch }); }
        else if (ch === "W" || ch === "B") { type[c] = MUD; sheep.push({ x, y, c: ch.toLowerCase() }); }
        else throw new Error("unknown cell '" + ch + "' at " + x + "," + y);
      }
    }
    const pens = [];
    for (const p of b.pens || []) {
      const x = p.x | 0, y = p.y | 0, c = y * w + x, o = DIRS.indexOf(p.open), k = COLOURS.indexOf(p.c);
      if (x < 0 || y < 0 || x >= w || y >= h || type[c] !== PEN) throw new Error("pen at " + x + "," + y + " is not on a P cell");
      if (o < 0 || k < 0) throw new Error("pen at " + x + "," + y + " needs open N/E/S/W and c w/b");
      if (penOpen[c] >= 0) throw new Error("two pens at " + x + "," + y);
      penOpen[c] = o; penCol[c] = k;
      pens.push({ x, y, open: DIRS[o], c: COLOURS[k] });
    }
    for (let c = 0; c < n; c++) if (type[c] === PEN && penOpen[c] < 0) throw new Error("P cell " + (c % w) + "," + ((c / w) | 0) + " has no pens[] entry");
    for (const k of COLOURS) {
      const s = sheep.filter((q) => q.c === k).length, p = pens.filter((q) => q.c === k).length;
      if (s !== p) throw new Error(k + " sheep (" + s + ") must equal " + k + " pens (" + p + ")");
    }
    if (!sheep.length) throw new Error("board has no sheep");
    const col = Int8Array.from(sheep, (q) => COLOURS.indexOf(q.c));
    return { w, h, n, type, penOpen, penCol, pens, sheep0: sheep, col, scan: scanOrders(w, h), occ: new Int16Array(n).fill(-1), id: b.id || null, par: b.par == null ? null : b.par | 0 };
  }

  // Per direction, every cell ordered furthest-along-d first (the 2048 order, SPEC §1 step 1).
  function scanOrders(w, h) {
    const out = [];
    for (let d = 0; d < 4; d++) {
      const a = new Int16Array(w * h);
      let k = 0;
      if (d === 0 || d === 2) for (let i = 0; i < h; i++) { const y = d === 0 ? i : h - 1 - i; for (let x = 0; x < w; x++) a[k++] = y * w + x; }
      else for (let i = 0; i < w; i++) { const x = d === 3 ? i : w - 1 - i; for (let y = 0; y < h; y++) a[k++] = y * w + x; }
      out.push(a);
    }
    return out;
  }

  // Resolve one swipe in place. pos holds each sheep's cell index and is rewritten with where it ends
  // (a sheep that would splash ends on the pond cell; on SPLASH the caller discards pos, SPEC §1 step 5).
  // stops (optional) receives each sheep's STOP_* code. Allocation-free: the solver calls this millions of times.
  // Returns MOVED | SPLASH | PENNED | STOPPER bits (STOPPER = some sheep slid and was stopped by another loose sheep).
  function resolve(B, pos, d, stops) {
    const occ = B.occ, type = B.type, col = B.col, w = B.w, h = B.h, dx = DX[d], dy = DY[d], opp = (d + 2) & 3, scan = B.scan[d];
    for (let i = 0; i < pos.length; i++) occ[pos[i]] = i;
    let bits = 0;
    for (let k = 0; k < scan.length; k++) {
      const c0 = scan[k], i = occ[c0];
      // Penned sheep never move. A sheep that already slid this swipe went further along d, into cells already scanned.
      if (i < 0 || type[c0] === PEN) continue;
      let x = c0 % w, y = (c0 / w) | 0, c = c0, stop = STOP_WALL;
      for (let step = w + h; step > 0; step--) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) break; // outer fence
        const nc = ny * w + nx, t = type[nc];
        if (t === ROCK) break;
        if (t === PEN) { // empty, matching colour, entered through the open side; anything else is a fence
          if (occ[nc] < 0 && B.penOpen[nc] === opp && B.penCol[nc] === col[i]) { c = nc; stop = STOP_PEN; }
          break;
        }
        if (occ[nc] >= 0) { stop = STOP_SHEEP; break; } // a sheep ahead has already stopped this swipe
        c = nc; x = nx; y = ny;
        if (t === POND) { stop = STOP_POND; break; }
        if (t === MUD) { stop = STOP_MUD; break; } // moving onto mud stops you; starting on mud doesn't
      }
      if (stops) stops[i] = stop;
      if (c === c0) continue;
      occ[c0] = -1; occ[c] = i; pos[i] = c;
      bits |= MOVED;
      if (stop === STOP_PEN) bits |= PENNED;
      else if (stop === STOP_POND) bits |= SPLASH;
      else if (stop === STOP_SHEEP) bits |= STOPPER;
    }
    for (let i = 0; i < pos.length; i++) occ[pos[i]] = -1;
    return bits;
  }

  function initialState(B) { return { sheep: B.sheep0.map((s) => ({ x: s.x, y: s.y, c: s.c, penned: false })) }; }

  function cloneState(s) { return { sheep: s.sheep.map((q) => ({ x: q.x, y: q.y, c: q.c, penned: q.penned })) }; }

  // One player swipe. Pure: returns a new state and never touches the one passed in.
  //   moved   the board changed (false on a splash or a no-op)
  //   counts  the swipe costs a move (moved or splashed; a no-op is free, SPEC §1 step 6)
  //   penned  sheep indices penned this swipe
  //   paths   per sliding sheep {i, from:{x,y}, to:{x,y}, cells, stop}; on a splash these are the would-be slides,
  //           the splashing sheep ending on its pond cell, for the animation only
  function swipe(B, state, dir) {
    const d = dirIndex(dir), m = state.sheep.length, w = B.w;
    const pos = new Int16Array(m), stops = new Int8Array(m);
    for (let i = 0; i < m; i++) pos[i] = state.sheep[i].y * w + state.sheep[i].x;
    const from = Int16Array.from(pos);
    const bits = resolve(B, pos, d, stops);
    const splash = !!(bits & SPLASH), moved = !!(bits & MOVED) && !splash;
    const paths = [], penned = [];
    for (let i = 0; i < m; i++) {
      if (pos[i] === from[i]) continue;
      const fx = from[i] % w, fy = (from[i] / w) | 0, tx = pos[i] % w, ty = (pos[i] / w) | 0;
      paths.push({ i, from: { x: fx, y: fy }, to: { x: tx, y: ty }, cells: Math.abs(tx - fx) + Math.abs(ty - fy), stop: STOPS[stops[i]] });
      if (!splash && stops[i] === STOP_PEN) penned.push(i);
    }
    const next = cloneState(state);
    if (moved) for (let i = 0; i < m; i++) { const q = next.sheep[i]; q.x = pos[i] % w; q.y = (pos[i] / w) | 0; q.penned = B.type[pos[i]] === PEN; }
    return { state: next, moved, counts: moved || splash, penned, splash, noop: !moved && !splash, paths };
  }

  function isWin(B, state) { for (const q of state.sheep) if (!q.penned) return false; return true; }

  // Plays a direction list from the start; returns {state, swipes, win} (swipes counts splashes, skips no-ops).
  function play(B, dirs) {
    let s = initialState(B), swipes = 0;
    for (const d of dirs) { const r = swipe(B, s, d); if (r.counts) swipes++; s = r.state; }
    return { state: s, swipes, win: isWin(B, s) };
  }

  return { GRASS, ROCK, MUD, POND, PEN, DIRS, DX, DY, COLOURS, MOVED, SPLASH, PENNED, STOPPER, STOPS,
    dirIndex, parseBoard, resolve, initialState, cloneState, swipe, isWin, play };
});
