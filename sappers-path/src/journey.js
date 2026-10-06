// Sapper's Path journey map (v5 R3; SPEC-v4 §9, the v5 R3 entry): the pure parts of the map screen, as functions of the
// save's data, map/layout.json (the painted sheets' coordinates, in sheet pixels) and config.json map. No DOM and no clock;
// UMD like engine.js, so Node can check it (tools/test.js). main.js builds the screen from these.
//   States: a level is "done" (cleared), "cur" (the next level: the first open one not cleared; the last level when all
//   are), "open" (open, not next) or "locked"; a side quest is "won", "open" or "locked" (save.js questOpen: it opens once
//   its main level is cleared and never blocks). The long tail: the pictures whose quest sits past the last built level
//   (26-60 until R4) show as one "next picture" node in the fog over level 100, the first open one not won (one at a time,
//   questOpen's rule); the won ones are kept for replay beside it.
//   The route: each sheet's painted road centreline, split at the current node (walked: red dashes; ahead: faint ink).
//   Easter eggs: two per sheet (layout.json), id "s<sheet>-<i>", each paying config map.eggCoins[sheet - 1][i] coins once
//   (meta.js egg).
//   Sprites: SVG markup in sheet pixels for the plank bridges, the stepping-stone detours, the eggs (a look before and
//   after each kind's tap) and the Goblin King with his banner.
// v5 R4c: the map holds sheets for levels 1-200 (realms 1-8) before those levels exist. frontier() finds where the built
//   campaign stops: the spot of the first missing level (or, with every spot's level built, the top sheet's long-tail
//   spot); the map builds sheets up to it, nodes only for levels that exist, and its fog sits there. Five new egg kinds
//   (a lava bubble, an ember sprite, a glowcap, an owl, a goblin lookout), stone bridges over lava, a fuller Goblin King.
// Lands foundation (SPEC-v4 §9, the lands foundation entry): past level 200 the map grows a land of 50 levels at a time,
//   from 2 painted sheets per land used over and over. A layout entry may name the same `file` as another with
//   `mirror: true`: layoutOf() mirrors everything on it about the sheet's middle (x -> w - x: levels, quests and their
//   branch, road, eggs, entry, exit, the long-tail spot, the king and the fortress), so the page only flips the image;
//   bridges sit on road samples, so they follow the mirrored road. landOf(): the built land holding a level. The long
//   tail (the castle Gallery's pictures 51-60, quests past level 200) stays past the last built level: tailAfter() moves
//   such a quest's level on by however far the lands reach past castleEnd (a land's own side quests never move).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./save.js"));
  else (root.SappersPath = root.SappersPath || {}).journey = factory(root.SappersPath.save);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Save) {
  "use strict";
  const INK = "#2a1c12";
  const r1 = (v) => Math.round(v * 10) / 10;

  // ---- states ------------------------------------------------------------------------------------------------------
  // A level's state (next: Save.next's id, passed in so a render works it out once).
  function nodeState(data, order, id, next) {
    if (data.done[id]) return "done";
    if (!Save.isOpen(data, order, id)) return "locked";
    return id === next ? "cur" : "open";
  }
  // A side quest's state (gal: the pictures' ids in order; after: each one's main level number).
  function questState(data, order, gal, after, id) { return (data.gal || {})[id] ? "won" : Save.questOpen(data, order, gal, after, id) ? "open" : "locked"; }
  // The long tail: {ids (quests past the last level, in order), next (the first open one not won, or null), won (ids)}.
  // Nothing is open until every level is cleared.
  function tail(data, order, gal, after) {
    const ids = gal.filter((id, i) => (after[i] | 0) > order.length), won = ids.filter((id) => (data.gal || {})[id]);
    const next = ids.find((id) => !(data.gal || {})[id] && Save.questOpen(data, order, gal, after, id)) || null;
    return { ids, next, won };
  }
  // v5 R3 fix: the open side quest not won whose main level is nearest level number `at` (ties: the lower picture), or null.
  // Only the campaign's quests (the long tail has its own node); skip: an id to leave out.
  function nearQuest(data, order, gal, after, at, skip) {
    let best = null, bd = Infinity;
    for (let i = 0; i < gal.length; i++) { const a = after[i] | 0, id = gal[i]; if (a < 1 || a > order.length || id === skip || (data.gal || {})[id] || !Save.questOpen(data, order, gal, after, id)) continue; const d = Math.abs(at - a); if (d < bd) { bd = d; best = id; } }
    return best;
  }
  // The node the map centres on: the next level not cleared, or (every level cleared) the long tail's node, "tail".
  const focus = (data, order) => { const n = order.find((id, i) => !data.done[id] && Save.isOpen(data, order, id)); return n || (order.length ? "tail" : null); };

  // v5 R4c: where the built campaign stops (n: the last level built, 1..n contiguous): {si: its sheet (0-based), x, y,
  // fog: the row the fog is full at (0: work it out), tail: true at the top sheet's own long-tail spot, top: the topmost
  // sheet to build (one past si when the spot sits within `room` sheet px of its sheet's top), n: sheets to build}.
  function frontier(lay, n, room) {
    const S = (lay && lay.sheets) || []; let f = null;
    for (let i = 0; i < S.length && !f; i++) { const p = (S[i].levels || []).find((v) => v.n === n + 1); if (p) f = { si: i, x: p.x, y: p.y, fog: 0, tail: false }; }
    if (!f && S.length) { const i = S.length - 1, t = S[i].tail, r = S[i].road || [[lay.w / 2, 0]], q = r[Math.max(0, r.length - 12)]; f = t ? { si: i, x: t.x, y: t.y, fog: t.fog | 0, tail: true } : { si: i, x: q[0], y: q[1], fog: 0, tail: true }; }
    if (!f) return null;
    f.top = f.y < room && f.si < S.length - 1 ? f.si + 1 : f.si; f.n = f.top + 1; return f;
  }

  // ---- lands (the lands foundation) ------------------------------------------------------------------------------------
  // A point [x, y, ...] or {x, y, ...} mirrored about the middle of a sheet W wide (a fresh copy; branch too).
  const mx = (W, p) => (Array.isArray(p) ? [W - p[0]].concat(p.slice(1)) : Object.assign({}, p, { x: W - p.x }, Array.isArray(p.branch) ? { branch: mx(W, p.branch) } : {}));
  // A layout entry as drawn: its own coordinates, or (mirror: true) every one of them mirrored. Never changes S.
  function mirrorSheet(S, W) {
    if (!S || !S.mirror) return S; const o = Object.assign({}, S), map = (k, f) => { if (Array.isArray(S[k])) o[k] = S[k].map(f); };
    map("levels", (p) => mx(W, p)); map("quests", (p) => mx(W, p)); map("eggs", (p) => mx(W, p)); map("road", (p) => mx(W, p));
    for (const k of ["entry", "exit"]) if (Array.isArray(S[k])) o[k] = mx(W, S[k]);
    for (const k of ["tail", "goblinKing", "fortress"]) if (S[k]) o[k] = mx(W, S[k]);
    return o;
  }
  // The layout with its mirrored entries resolved (the same object when none is mirrored).
  function layoutOf(lay) { if (!lay || !Array.isArray(lay.sheets) || !lay.sheets.some((S) => S && S.mirror)) return lay; return Object.assign({}, lay, { sheets: lay.sheets.map((S) => mirrorSheet(S, lay.w)) }); }
  // The built land holding level n (L: config lands), or null.
  const landOf = (L, n) => ((L && L.list) || []).find((d) => n >= d.from && n <= d.to) || null;
  // A long-tail quest's main level as the map reads it: past `end` (castleEnd) it moves on by how far the levels reach
  // past end (last: the last level built), so it stays past the last built land. A quest at or before end never moves.
  const tailAfter = (after, end, last) => (after > end && last > end ? after + (last - end) : after);

  // ---- the route ------------------------------------------------------------------------------------------------------
  // The road sample nearest (x, y) (bounded by the road's length).
  function nearest(road, x, y) { let b = 0, bd = Infinity; for (let i = 0; i < road.length; i++) { const d = (road[i][0] - x) ** 2 + (road[i][1] - y) ** 2; if (d < bd) { bd = d; b = i; } } return b; }
  // An SVG path through the points (sheet px, one decimal).
  const pathD = (pts) => (pts.length ? "M" + pts.map((p) => r1(p[0]) + " " + r1(p[1])).join("L") : "");
  // The road walked and the road ahead on one sheet, cut at sample i (i < 0: all ahead; i >= length - 1: all walked).
  function split(road, i) { if (i < 0) return ["", pathD(road)]; if (i >= road.length - 1) return [pathD(road), ""]; return [pathD(road.slice(0, i + 1)), pathD(road.slice(i))]; }
  // The road's heading at sample i, in degrees (from the samples k either side).
  function heading(road, i, k) { const a = road[Math.max(0, i - k)], b = road[Math.min(road.length - 1, i + k)]; return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI; }

  // Which side of point p a box w x h (sheet px) set gap px off it should go: the first of `sides` ("e" right, "w" left,
  // "n" above, "s" below) whose box covers least (v5 R3 fix: by how deep things reach into it, so a bare graze loses to a
  // covered node). pts: [x, y, r], other nodes and eggs; road: the sheet's road samples (the route, rw px either side of
  // its centreline; it counts as one thing, at half a node's weight); boxes: [x0, y0, x1, y1], banners. Off the sheet (W
  // wide) costs more than anything.
  const sdBox = (x, y, x0, y0, x1, y1) => { const dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1); return dx || dy ? Math.hypot(dx, dy) : -Math.min(x - x0, x1 - x, y - y0, y1 - y); };
  // v5 R4c: the box [x0, y0, x1, y1] a w x h thing set gap px off p on side s takes (so a bubble's box can steer a label).
  function sideBox(p, s, w, h, gap) { const x0 = s === "e" ? p[0] + gap : s === "w" ? p[0] - gap - w : p[0] - w / 2, y0 = s === "n" ? p[1] - gap - h : s === "s" ? p[1] + gap : p[1] - h / 2; return [x0, y0, x0 + w, y0 + h]; }
  function side(p, pts, w, h, gap, W, sides, road, rw, boxes) {
    let best = sides[0], bs = Infinity;
    for (const s of sides) {
      const [x0, y0, x1, y1] = sideBox(p, s, w, h, gap);
      let sc = x0 < 0 || x1 > W ? 1e4 : 0, rd = 0;
      for (const q of pts) if (!(q[0] === p[0] && q[1] === p[1])) sc += Math.max(0, q[2] - sdBox(q[0], q[1], x0, y0, x1, y1));
      for (const q of road || []) rd = Math.max(rd, rw - sdBox(q[0], q[1], x0, y0, x1, y1));
      for (const b of boxes || []) { const ox = Math.min(x1, b[2]) - Math.max(x0, b[0]), oy = Math.min(y1, b[3]) - Math.max(y0, b[1]); if (ox > 0 && oy > 0) sc += Math.min(ox, oy); }
      sc += rd / 2;
      if (sc < bs) { bs = sc; best = s; }
    }
    return best;
  }

  // ---- easter eggs --------------------------------------------------------------------------------------------------------
  const eggId = (sheet, i) => "s" + sheet + "-" + i;
  // The coins egg i of a sheet pays (config map.eggCoins; 0 when missing).
  function eggCoins(M, sheet, i) { const row = (M && M.eggCoins && M.eggCoins[sheet - 1]) || [], v = row[i]; return Number.isFinite(v) ? Math.max(0, Math.min(999, Math.round(v))) : 0; }

  // ---- sprites (SVG markup; sheet px) -----------------------------------------------------------------------------------
  // A plank bridge centred on (x, y), its length along the heading ang (degrees), w wide across the road. v5 R4c: kind
  // "stone" is a grey stone arch (over lava): blocks instead of planks.
  function bridge(x, y, ang, len, w, kind) {
    const h = len / 2, v = w / 2, stn = kind === "stone"; let s = '<g class="br' + (stn ? " stone" : "") + '" transform="translate(' + r1(x) + " " + r1(y) + ") rotate(" + r1(ang) + ')">';
    s += '<rect x="' + r1(-h) + '" y="' + r1(-v + 3) + '" width="' + r1(len) + '" height="' + r1(w) + '" fill="rgba(0,0,0,.28)"/>';
    s += '<rect x="' + r1(-h) + '" y="' + r1(-v) + '" width="' + r1(len) + '" height="' + r1(w) + '" fill="' + (stn ? "#9a948a" : "#a87a46") + '" stroke="' + INK + '" stroke-width="3"/>';
    let p = ""; if (stn) for (let t = -h + 13, k = 0; t < h - 4; t += 13, k++) p += "M" + r1(t) + " " + r1(-v) + "v" + r1(v) + "M" + r1(t - 6.5) + " 0v" + r1(v) + "M" + r1(-h) + " 0h" + r1(len);
    else for (let t = -h + 9; t < h - 4; t += 10) p += "M" + r1(t) + " " + r1(-v) + "v" + r1(w);
    s += '<path d="' + p + '" stroke="' + INK + '" stroke-width="2.4" fill="none"/>';
    s += '<path d="M' + r1(-h - 5) + " " + r1(-v - 3) + "h" + r1(len + 10) + "M" + r1(-h - 5) + " " + r1(v + 3) + "h" + r1(len + 10) + '" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>';
    return s + "</g>";
  }
  // The detour from the road (b, the branch) to a side quest's node (q): a gentle curve, and stones every gap px along it,
  // leaving `skipA` px at the road end and `skipB` at the node.
  function detour(b, q, gap, skipA, skipB) {
    const dx = q[0] - b[0], dy = q[1] - b[1], L = Math.hypot(dx, dy) || 1, c = [b[0] + dx / 2 - (dy / L) * L * 0.18, b[1] + dy / 2 + (dx / L) * L * 0.18];
    const at = (t) => [(1 - t) * (1 - t) * b[0] + 2 * (1 - t) * t * c[0] + t * t * q[0], (1 - t) * (1 - t) * b[1] + 2 * (1 - t) * t * c[1] + t * t * q[1]];
    const d = "M" + r1(b[0]) + " " + r1(b[1]) + "Q" + r1(c[0]) + " " + r1(c[1]) + " " + r1(q[0]) + " " + r1(q[1]);
    const stones = [], N = Math.max(8, Math.min(200, Math.ceil(L / 2))); let run = 0, prev = b, next = skipA;
    for (let k = 1; k <= N; k++) { const p = at(k / N); run += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; if (run >= next && run <= L * 1.1 - skipB) { stones.push([p[0], p[1], heading([at((k - 1) / N), p], 1, 1)]); next += gap; } }
    return { d, stones };
  }
  const stone = (p) => '<ellipse cx="' + r1(p[0]) + '" cy="' + r1(p[1]) + '" rx="9.5" ry="6.5" transform="rotate(' + r1(p[2]) + " " + r1(p[0]) + " " + r1(p[1]) + ')" fill="#cdc3aa" stroke="' + INK + '" stroke-width="2.6"/>';

  // An egg's look, in a 48 x 48 box centred on 0 0: kind before its tap, or found after it. Animated parts carry a class
  // (style.css runs them; reduced motion stops them).
  const st = 'stroke="' + INK + '" stroke-linejoin="round"';
  const EGGS = {
    woodpile: [
      '<g ' + st + ' stroke-width="1.8"><rect x="-17" y="2" width="34" height="9" rx="4.5" fill="#9a6a3a"/><rect x="-13" y="-6" width="27" height="9" rx="4.5" fill="#a87a46"/><circle cx="-13" cy="6.5" r="3.6" fill="#e8cf9e"/><circle cx="-9.5" cy="-1.5" r="3.6" fill="#e8cf9e"/><circle cx="13" cy="6.5" r="3.6" fill="#e8cf9e"/></g>',
      '<g ' + st + ' stroke-width="1.8"><rect x="-16" y="7" width="32" height="7" rx="3.5" fill="#9a6a3a" transform="rotate(-12 0 10)"/><rect x="-16" y="7" width="32" height="7" rx="3.5" fill="#a87a46" transform="rotate(12 0 10)"/>' +
        '<g class="flk"><path d="M0 -20c7 9 11 14 8 23-2 5-14 5-16 0-3-8 2-10 3-16 2 3 3 6 5 7z" fill="#f08a24"/><path d="M0 -8c3 4 6 8 3 12-1 2-6 2-7 0-1-4 2-6 4-12z" fill="#ffe27a" stroke="none"/></g></g>'],
    grass: [
      '<g fill="#5c8a2e" ' + st + ' stroke-width="1.5"><path class="sway" d="M-14 12l3-16 4 16zM-6 12l4-21 4 21zM3 12l3-15 4 15zM11 12l3-17 3 17z"/></g><path d="M-22 -2h5M-24 5h6M18 -4h5M19 4h6" stroke="' + INK + '" stroke-width="1.6"/>',
      '<g ' + st + ' stroke-width="1.6"><path d="M-6 -2c-2-10-1-18 2-19 3 0 3 9 1 19zM2 -2c1-10 4-17 7-17 2 1 0 10-4 18z" fill="#b39a7a"/><ellipse cx="-1" cy="2" rx="9" ry="7" fill="#c2a986"/><circle cx="-4" cy="1" r="1.4" fill="' + INK + '" stroke="none"/><circle cx="3" cy="1" r="1.4" fill="' + INK + '" stroke="none"/></g>' +
        '<g fill="#5c8a2e" ' + st + ' stroke-width="1.5"><path d="M-16 13l3-12 4 12zM-8 13l4-9 4 9zM3 13l4-10 3 10zM11 13l3-13 3 13z"/></g>'],
    fish: [
      '<g fill="none" stroke="#e8f4ef" stroke-width="2.2" opacity=".85"><ellipse class="rip" cx="0" cy="4" rx="16" ry="5"/><ellipse cx="0" cy="4" rx="8" ry="2.5"/></g><path d="M-6 0q6-5 12 0" fill="none" stroke="' + INK + '" stroke-width="1.6"/>',
      '<g fill="none" stroke="#e8f4ef" stroke-width="2.2" opacity=".85"><ellipse cx="0" cy="13" rx="16" ry="4.5"/></g><path d="M-13 12l-3-6M13 12l4-6M-2 11l-1-6" stroke="#e8f4ef" stroke-width="2" stroke-linecap="round"/>' +
        '<g class="leap"><g transform="rotate(-28)" ' + st + ' stroke-width="1.8"><path d="M-9 -2l-9-7v14z" fill="#d9783c"/><ellipse cx="2" cy="-2" rx="12" ry="6.5" fill="#e8964f"/><path d="M-1 -8q4 3 0 12" fill="none" stroke-width="1.4"/><circle cx="8" cy="-4" r="1.5" fill="' + INK + '" stroke="none"/></g></g>'],
    reeds: [
      '<g ' + st + ' stroke-width="1.6"><path class="sway" d="M-8 14v-22M0 14v-28M8 14v-20" stroke="#4d6b2a" stroke-width="3"/><rect x="-10.5" y="-14" width="5" height="10" rx="2.5" fill="#7a4a24"/><rect x="-2.5" y="-22" width="5" height="11" rx="2.5" fill="#7a4a24"/><rect x="5.5" y="-12" width="5" height="9" rx="2.5" fill="#7a4a24"/></g>',
      '<g ' + st + ' stroke-width="1.6"><path d="M-12 14v-22M12 14v-20" stroke="#4d6b2a" stroke-width="3"/><rect x="-14.5" y="-14" width="5" height="10" rx="2.5" fill="#7a4a24"/><rect x="9.5" y="-12" width="5" height="9" rx="2.5" fill="#7a4a24"/>' +
        '<ellipse cx="0" cy="11" rx="12" ry="4" fill="#5c8a2e"/><path d="M-7 8c0-9 14-9 14 0z" fill="#79b04a"/><circle cx="-4" cy="-1" r="3" fill="#79b04a"/><circle cx="4" cy="-1" r="3" fill="#79b04a"/><circle cx="-4" cy="-1.5" r="1.1" fill="' + INK + '" stroke="none"/><circle cx="4" cy="-1.5" r="1.1" fill="' + INK + '" stroke="none"/></g>'],
    mushrooms: [
      '<g ' + st + ' stroke-width="1.6"><path d="M-9 12v-8h5v8z" fill="#efe2c6"/><path d="M-15 4c0-8 16-8 16 0z" fill="#c8402c"/><path d="M5 12v-6h4v6z" fill="#efe2c6"/><path d="M1 6c0-6 12-6 12 0z" fill="#c8402c"/><circle cx="-8" cy="-1" r="1.4" fill="#fff" stroke="none"/><circle cx="7" cy="2.5" r="1.2" fill="#fff" stroke="none"/></g>',
      '<g class="glow"><ellipse cx="0" cy="6" rx="22" ry="11" fill="#fff3a8" opacity=".35"/></g><g ' + st + ' stroke-width="1.5">' + [[-16, 8], [-6, 13], [6, 13], [16, 8], [-10, 0], [10, 0]].map((p) => '<path d="M' + (p[0] - 2) + " " + (p[1] + 4) + "v-5h4v5z" + '" fill="#efe2c6"/><path d="M' + (p[0] - 5) + " " + (p[1] - 1) + "c0-6 10-6 10 0z" + '" fill="#e05a9a"/>').join("") + '</g><path class="spk" d="M0 -18v6M-3 -15h6M-18 -10v4M-20 -8h4M18 -12v4M16 -10h4" stroke="#fff3a8" stroke-width="2"/>'],
    raven: [
      '<path d="M-14 14c2-8 26-8 28 0z" fill="#8f8a84" stroke="' + INK + '" stroke-width="1.6"/><g fill="#1e1620" ' + st + ' stroke-width="1"><path d="M-6 8c0-10 4-15 10-15 4 0 6 3 6 6l5 2-5 2c0 4-4 7-9 7l-3 6h-3z"/></g><circle cx="7" cy="-3" r="1.3" fill="#f2c230"/>',
      '<path d="M-14 16c2-8 26-8 28 0z" fill="#8f8a84" stroke="' + INK + '" stroke-width="1.6"/><g class="flap" fill="#1e1620" ' + st + ' stroke-width="1"><path d="M-2 -2c-6-10-16-12-20-8 6 0 10 6 12 10-6 0-9 3-10 6 5-3 12-3 18-2 6-1 13-1 18 2-1-3-4-6-10-6 2-4 6-10 12-10-4-4-14-2-20 8z"/><path d="M-3 -4c0-4 6-4 6 0l4 2-4 1c0 2-2 3-3 3z"/></g><circle cx="5" cy="-14" r="3.6" fill="#f2c230" stroke="' + INK + '" stroke-width="1.4"/>'],
    glint: [
      '<path d="M-15 12l4-14 10-6 12 4 4 16z" fill="#8f8a84" stroke="' + INK + '" stroke-width="1.8" stroke-linejoin="round"/><path d="M-4 -2l-3 6M6 0l2 7" stroke="#5d5852" stroke-width="1.4"/><path class="tw" d="M5 -12v10M0 -7h10" stroke="#fff6c8" stroke-width="2.2" stroke-linecap="round"/>',
      '<path d="M-16 12l3-10 8-3-2 13zM5 12l1-14 9 4 4 10z" fill="#8f8a84" stroke="' + INK + '" stroke-width="1.8" stroke-linejoin="round"/><g ' + st + ' stroke-width="1.6"><path d="M-6 12l2-9 7-1 3 10z" fill="#f2c230"/><path d="M-3 -6l4-6 4 6-4 5z" fill="#4fc3e8"/></g><path class="tw" d="M-12 -12v6M-15 -9h6M14 -14v6M11 -11h6" stroke="#fff6c8" stroke-width="2" stroke-linecap="round"/>'],
    wisp: [
      '<g opacity=".55"><path d="M0 -14c6 6 9 11 6 17-2 4-10 4-12 0-3-6 2-9 6-17z" fill="#cfe9dc" stroke="' + INK + '" stroke-width="1.4"/></g>',
      '<g class="bob"><ellipse cx="0" cy="2" rx="16" ry="16" fill="#9ff0d0" opacity=".3"/><path d="M0 -18c8 8 12 14 8 22-3 5-13 5-16 0-4-8 2-12 8-22z" fill="#7fe8c4" stroke="' + INK + '" stroke-width="1.6"/><path d="M0 -6c3 4 5 7 3 10-1 2-5 2-6 0-1-3 1-5 3-10z" fill="#e8fff6"/><circle cx="-3" cy="2" r="1.4" fill="' + INK + '"/><circle cx="3" cy="2" r="1.4" fill="' + INK + '"/></g>'] };
  // v5 R4c, the new realms' eggs: a crust bubble on lava that pops into a lava salamander; a dim spark that becomes an
  // ember sprite; a closed blue cap that opens into a glowing glowcap cluster; two eyes in a hollow that become an owl; a
  // rickety lookout post whose goblin pops up waving.
  Object.assign(EGGS, {
    bubble: [
      '<g ' + st + ' stroke-width="1.6"><ellipse cx="0" cy="8" rx="18" ry="7" fill="#d9562a"/><path class="glow" d="M-12 8q12-4 24 0" stroke="#ffd27a" stroke-width="2.4" fill="none"/><circle cx="-2" cy="2" r="8" fill="#5a3a2e"/><path d="M-6 -1l3 3 3-4" stroke="#f08a24" stroke-width="1.6" fill="none"/></g>',
      '<g ' + st + ' stroke-width="1.6"><ellipse cx="0" cy="10" rx="18" ry="6" fill="#d9562a"/><path d="M-12 10q12-4 24 0" stroke="#ffd27a" stroke-width="2.4" fill="none"/>' +
        '<g class="bob"><path d="M-16 2c4-6 10-6 14-3 4-4 12-4 16 1-3 4-8 6-14 5-6 2-12 1-16-3z" fill="#f08a24"/><path d="M14 0l7-4M-16 2l-6 3" stroke-width="2.4"/><circle cx="9" cy="-2" r="1.5" fill="' + INK + '" stroke="none"/><path d="M-4 -2l2-4 2 4M2 -3l2-4 2 4" fill="#ffd27a" stroke-width="1.2"/></g>' +
        '<path class="spk" d="M-14 -12v5M-16.5 -9.5h5M15 -14v5M12.5 -11.5h5" stroke="#ffd27a" stroke-width="2"/></g>'],
    ember: [
      '<g class="tw"><circle cx="0" cy="2" r="9" fill="#f08a24" opacity=".35"/><circle cx="0" cy="2" r="4" fill="#ffd27a" stroke="' + INK + '" stroke-width="1.4"/></g><path d="M-14 14c4-3 24-3 28 0" stroke="' + INK + '" stroke-width="1.6" fill="#5d5852"/>',
      '<path d="M-14 16c4-3 24-3 28 0" stroke="' + INK + '" stroke-width="1.6" fill="#5d5852"/><g class="bob"><ellipse cx="0" cy="0" rx="17" ry="17" fill="#f08a24" opacity=".28"/>' +
        '<path d="M0 -19c7 7 11 13 8 20-2 5-14 5-16 0-3-7 1-11 4-16 1 3 2 5 4 6z" fill="#f08a24" stroke="' + INK + '" stroke-width="1.6"/><path d="M0 -6c3 4 5 7 3 10-1 2-5 2-6 0-1-3 1-5 3-10z" fill="#ffe27a"/>' +
        '<circle cx="-3" cy="1" r="1.4" fill="' + INK + '"/><circle cx="3" cy="1" r="1.4" fill="' + INK + '"/><path d="M-9 4l-6-4M9 4l6-4" stroke="' + INK + '" stroke-width="1.6"/></g>'],
    glowcap: [
      '<g ' + st + ' stroke-width="1.6"><path d="M-3 13v-9h6v9z" fill="#dfe8e6"/><path d="M-9 5c0-10 18-10 18 0z" fill="#4a6f8a"/><path d="M9 13v-5h4v5z" fill="#dfe8e6"/><path d="M6 8c0-6 10-6 10 0z" fill="#4a6f8a"/></g>',
      '<g class="glow"><ellipse cx="0" cy="4" rx="22" ry="14" fill="#9ff0ff" opacity=".35"/></g><g ' + st + ' stroke-width="1.5">' + [[-12, 10, 7], [0, 6, 10], [12, 10, 7], [-6, 14, 5], [7, 15, 5]].map((p) => '<path d="M' + (p[0] - 2) + " " + (p[1] + 4) + "v-" + (p[2] * 0.7) + "h4v" + (p[2] * 0.7) + 'z" fill="#e8fbff"/><path d="M' + (p[0] - p[2]) + " " + (p[1] - p[2] * 0.6) + "c0-" + p[2] + " " + 2 * p[2] + "-" + p[2] + " " + 2 * p[2] + ' 0z" fill="#6fe0ff"/>').join("") + '</g><path class="spk" d="M-16 -12v5M-18.5 -9.5h5M16 -16v5M13.5 -13.5h5M2 -20v4M0 -18h4" stroke="#e8fbff" stroke-width="2"/>'],
    owl: [
      '<g ' + st + ' stroke-width="1.8"><ellipse cx="0" cy="2" rx="16" ry="14" fill="#3c5a44"/><ellipse cx="0" cy="3" rx="8" ry="9" fill="#1e1620"/></g><g class="tw"><circle cx="-3" cy="1" r="1.8" fill="#f2c230"/><circle cx="3" cy="1" r="1.8" fill="#f2c230"/></g>',
      '<g ' + st + ' stroke-width="1.8"><path d="M-18 14h36" stroke="#5a3f2a" stroke-width="5" stroke-linecap="round"/><g class="flap"><path d="M-11 12c-4-8-3-20 0-24l4 4h14l4-4c3 4 4 16 0 24z" fill="#8a6a48"/>' +
        '<circle cx="-5" cy="-2" r="5" fill="#f3ead8"/><circle cx="5" cy="-2" r="5" fill="#f3ead8"/><circle cx="-5" cy="-2" r="2.2" fill="#f2c230" stroke-width="1"/><circle cx="5" cy="-2" r="2.2" fill="#f2c230" stroke-width="1"/><path d="M-2 3l2 3 2-3z" fill="#f2c230" stroke-width="1"/><path d="M-6 8q6 3 12 0" fill="none" stroke-width="1.2"/></g></g>'],
    lookout: [
      '<g ' + st + ' stroke-width="1.8"><path d="M-10 16l3-22M10 16l-3-22M-9 6h18M-8 -2l16 8" stroke="#6b4a2a" stroke-width="3"/><path d="M-12 -6h24l-3-6h-18z" fill="#8a6a48"/></g><path d="M-3 -9h6" stroke="#79b04a" stroke-width="3"/>',
      '<g ' + st + ' stroke-width="1.8"><path d="M-10 16l3-22M10 16l-3-22M-9 6h18M-8 -2l16 8" stroke="#6b4a2a" stroke-width="3"/><path d="M-12 -6h24l-3-6h-18z" fill="#8a6a48"/>' +
        '<g class="bob"><path d="M-14 -22l6 4M14 -22l-6 4" stroke="#5c8a2e" stroke-width="3.6" stroke-linecap="round"/><ellipse cx="0" cy="-18" rx="8" ry="7" fill="#79b04a"/><circle cx="-3" cy="-19" r="1.5" fill="' + INK + '" stroke="none"/><circle cx="3" cy="-19" r="1.5" fill="' + INK + '" stroke="none"/><path d="M-3 -14q3 2 6 0" fill="none" stroke-width="1.3"/>' +
        '<path d="M8 -14l9-12" stroke="#5c8a2e" stroke-width="3" stroke-linecap="round"/><path d="M15 -27l7 3-3 3z" fill="#8a1f19" stroke-width="1.2"/></g></g>'] });
  // Land 1, Kitten Forest (tools/land-01-notes.md): a ginger kitten asleep in a curl that wakes, sits up and waves; a ball
  // of yarn that unrolls across the glade; a butterfly resting on a flower that opens its wings and flies up.
  const GN = "#e8964f", fur = (d) => '<path d="' + d + '" fill="none" stroke-width="5.2" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="' + GN + '" stroke-width="2.6" stroke-linecap="round"/>';
  const bloom = (x, y, k) => '<g ' + st + ' stroke-width="1.4"><path d="M' + x + " " + (y + 15 * k) + "v-" + 13 * k + '" stroke="#4d6b2a" stroke-width="2.4"/><path d="M' + x + " " + (y + 10 * k) + "c-" + 6 * k + "-1-" + 8 * k + "-5-" + 8 * k + "-7 " + 4 * k + " 0 " + 7 * k + " 2 " + 8 * k + ' 7z" fill="#79b04a"/>' +
    [0, 72, 144, 216, 288].map((a) => '<circle cx="' + r1(x + Math.cos((a - 90) * Math.PI / 180) * 4.4 * k) + '" cy="' + r1(y + Math.sin((a - 90) * Math.PI / 180) * 4.4 * k) + '" r="' + r1(3.4 * k) + '" fill="#f2c230"/>').join("") + '<circle cx="' + x + '" cy="' + y + '" r="' + r1(2.6 * k) + '" fill="#c8402c"/></g>';
  Object.assign(EGGS, {
    kitten: [
      '<g ' + st + ' stroke-width="1.6">' + fur("M15 6c5 6-2 12-12 10") + '<ellipse cx="2" cy="7" rx="14" ry="8" fill="' + GN + '"/><path d="M3 0v5M8 0v6M13 2v4" stroke-width="1.4"/><path d="M-15 -1l-1-8 6 4zM-8 -4l2-7 4 6z" fill="' + GN + '"/><circle cx="-9" cy="3" r="7.5" fill="' + GN + '"/>' +
        '<path d="M-13 3q1.5 1.6 3 0M-8 3q1.5 1.6 3 0" fill="none" stroke-width="1.3"/><circle cx="-9.5" cy="6.4" r="1.1" fill="#d9567a" stroke="none"/><path class="tw" d="M3 -12h5l-5 5h5M10 -19h4l-4 4h4" fill="none" stroke-width="1.6"/></g>',
      '<g ' + st + ' stroke-width="1.6">' + fur("M8 13c10 0 12-10 6-14") + '<path d="M-9 15c-2-10 2-17 9-17s11 7 9 17z" fill="' + GN + '"/><path d="M-4 15c-1-6 1-9 4-9s5 3 4 9z" fill="#f6dcb8" stroke="none"/><path d="M-9 -9l-1-10 7 5zM9 -9l1-10-7 5z" fill="' + GN + '"/><ellipse cx="0" cy="-8" rx="9.5" ry="8" fill="' + GN + '"/>' +
        '<path d="M-2 -15v3M2 -15v3" stroke-width="1.3"/><circle cx="-3.5" cy="-9" r="1.6" fill="' + INK + '" stroke="none"/><circle cx="3.5" cy="-9" r="1.6" fill="' + INK + '" stroke="none"/><path d="M-1 -5.6h2l-1 1.3z" fill="#d9567a" stroke-width=".8"/><path d="M-2.5 -3.4q1.2 1 2.5 0q1.3 1 2.5 0M-6 -5h-6M-6 -3.5l-5 2M6 -5h6M6 -3.5l5 2" fill="none" stroke-width="1"/>' +
        '<g class="bob">' + fur("M-8 3c-6-2-8-8-7-12") + '<circle cx="-15" cy="-11" r="3.2" fill="' + GN + '"/></g><path class="tw" d="M13 -17c0-3 4-3 4 0 0-3 4-3 4 0 0 3-4 5-4 6 0-1-4-3-4-6z" fill="#e05a9a" stroke-width="1.2"/></g>'],
    yarn: [
      '<g ' + st + ' stroke-width="1.6"><path d="M9 12c6 3 10 1 13-3" fill="none" stroke="#e05a5a" stroke-width="2.2" stroke-linecap="round"/><circle cx="0" cy="4" r="11" fill="#e05a5a"/>' +
        '<path d="M-9 -1c6 2 12 8 14 14M-5 -5.5c7 2 12 8 14 13M-10.5 6c5 0 9 4 11 8.5M-1 -7c5 4 9 9 10 15" fill="none" stroke="#9a2a36" stroke-width="1.4"/><path d="M-7 10c3-8 9-12 16-12" fill="none" stroke="#f6b0a8" stroke-width="1.4"/></g>',
      '<path d="M-21 12c4-7 8 2 12-3s6-9 10-3 4 7 9 3" fill="none" stroke="' + INK + '" stroke-width="4.4" stroke-linecap="round"/><path d="M-21 12c4-7 8 2 12-3s6-9 10-3 4 7 9 3" fill="none" stroke="#e05a5a" stroke-width="2.2" stroke-linecap="round"/>' +
        '<g class="bob" ' + st + ' stroke-width="1.6"><circle cx="15" cy="7" r="7" fill="#e05a5a"/><path d="M10 4c4 1 7 5 8 9M12 1c4 2 7 5 8 9" fill="none" stroke="#9a2a36" stroke-width="1.3"/></g><path class="spk" d="M-8 -6l3 3M-2 -10v4M5 -8l-2 3" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>'],
    butterfly: [
      bloom(0, 4, 1) + '<g ' + st + ' stroke-width="1.4"><path d="M0 -1c-1-9 3-17 11-19 1 7-3 15-11 19z" fill="#f08a24"/><path d="M0 -1c2-5 6-7 10-6-1 4-5 6-10 6z" fill="#f2c230"/><circle cx="6" cy="-12" r="1.5" fill="#fff3a8" stroke="none"/><path d="M-1 0l-3-8" stroke-width="2.2"/><path d="M-4 -8l-4-5M-4 -8l0-6" fill="none" stroke-width="1.1"/></g>',
      bloom(0, 8, 0.8) + '<g class="flap" ' + st + ' stroke-width="1.4"><path d="M0 -14c-4-8-14-10-15-4-1 5 6 8 15 4zM0 -14c4-8 14-10 15-4 1 5-6 8-15 4z" fill="#f08a24"/><path d="M0 -13c-3 4-10 7-9 10 2 2 7-2 9-8zM0 -13c3 4 10 7 9 10-2 2-7-2-9-8z" fill="#f2c230"/>' +
        '<circle cx="-9" cy="-16" r="1.6" fill="#fff3a8" stroke="none"/><circle cx="9" cy="-16" r="1.6" fill="#fff3a8" stroke="none"/><path d="M0 -20v12" stroke-width="2.4"/><path d="M0 -20l-3-5M0 -20l3-5" fill="none" stroke-width="1.2"/></g><path class="spk" d="M-17 -2v4M-19 0h4M17 -4v4M15 -2h4" stroke="#fff3a8" stroke-width="2"/>'] });
  const egg = (kind, found) => (EGGS[kind] || EGGS.grass)[found ? 1 : 0];
  const EGG_KINDS = Object.keys(EGGS);

  // The Goblin King (about 90 x 110 sheet px, his feet at 0 0) and his banner (a pole 90 tall). v5 R4c: drawn in the
  // map's ink and wash (green skin, long ears, a gold crown, a red cloak with a ragged hem, a crooked sceptre) instead of
  // the flat silhouette.
  const king = (k) => '<g transform="scale(' + (k || 2.1) + ') translate(-21 -50)" stroke="' + INK + '" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="21" cy="49" rx="17" ry="3.5" fill="rgba(0,0,0,.3)" stroke="none"/>' +
    '<path d="M7 47l2-16c1-7 5-11 12-11s11 4 12 11l2 16-4-3-3 4-3-4-4 4-4-4-3 4-3-4z" fill="#8a1f19" stroke-width="1.6"/><path d="M14 22c2 6 12 6 14 0" fill="none" stroke="#f2c230" stroke-width="2"/>' +
    '<path d="M17 30h8v10h-8z" fill="#4f6b2c" stroke-width="1.2"/><path d="M17 47v-5M25 47v-5" stroke-width="3" stroke="#4f6b2c"/><path d="M14 48h5M23 48h5" stroke-width="2.4"/>' +
    '<path d="M36 46l-2-26" stroke="#6b4a2a" stroke-width="2.4"/><path d="M34 20l-3-4 3-3 3 3z" fill="#4fc3e8" stroke-width="1.2"/><path d="M34 32c-3-2-5 0-7 1" fill="none" stroke="#79b04a" stroke-width="3"/>' +
    '<path d="M4 6l9 5-1 4zM38 6l-9 5 1 4z" fill="#79b04a" stroke-width="1.4"/><ellipse cx="21" cy="13" rx="9" ry="8.5" fill="#79b04a" stroke-width="1.6"/><path d="M17 17q4 3 8 0" fill="none" stroke-width="1.3"/><path d="M18 18l1 2 1-2M22 18l1 2 1-2" fill="#f3ead8" stroke-width=".8"/>' +
    '<circle cx="17.5" cy="12" r="1.9" fill="#ffd27a" stroke-width="1"/><circle cx="24.5" cy="12" r="1.9" fill="#ffd27a" stroke-width="1"/><circle cx="17.5" cy="12" r=".8" fill="' + INK + '" stroke="none"/><circle cx="24.5" cy="12" r=".8" fill="' + INK + '" stroke="none"/>' +
    '<path d="M13 7l1-8 3 4 2-6 2 6 2-6 2 6 3-4 1 8z" fill="#f2c230" stroke-width="1.3"/><circle cx="21" cy="3" r="1.3" fill="#c8402c" stroke-width=".8"/></g>';
  const flag = () => '<g transform="scale(2)"><path d="M0 0v46" stroke="#1e1620" stroke-width="2.4"/><path d="M1 2h22l-5 7 5 7-4 1 3 6H1z" fill="#8a1f19" stroke="#1e1620" stroke-width="1.6"/><circle cx="11" cy="11" r="3.4" fill="#f3ead8" stroke="#1e1620" stroke-width="1.2"/><circle cx="11" cy="11" r="1.2" fill="#1e1620"/></g>';

  return { nodeState, questState, tail, nearQuest, focus, frontier, mirrorSheet, layoutOf, landOf, tailAfter, nearest, pathD, split, heading, side, sideBox, eggId, eggCoins, bridge, detour, stone, egg, EGG_KINDS, king, flag };
});
