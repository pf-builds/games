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
  // The node the map centres on: the next level not cleared, or (every level cleared) the long tail's node, "tail".
  const focus = (data, order) => { const n = order.find((id, i) => !data.done[id] && Save.isOpen(data, order, id)); return n || (order.length ? "tail" : null); };

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
  // "n" above) whose box covers the fewest other things (pts: [x, y, r]) and stays on the sheet (W wide).
  function side(p, pts, w, h, gap, W, sides) {
    let best = sides[0], bs = Infinity;
    for (const s of sides) {
      const x0 = s === "e" ? p[0] + gap : s === "w" ? p[0] - gap - w : p[0] - w / 2, y0 = s === "n" ? p[1] - gap - h : p[1] - h / 2; let sc = x0 < 0 || x0 + w > W ? 4 : 0;
      for (const q of pts) if (!(q[0] === p[0] && q[1] === p[1]) && q[0] > x0 - q[2] && q[0] < x0 + w + q[2] && q[1] > y0 - q[2] && q[1] < y0 + h + q[2]) sc++;
      if (sc < bs) { bs = sc; best = s; }
    }
    return best;
  }

  // ---- easter eggs --------------------------------------------------------------------------------------------------------
  const eggId = (sheet, i) => "s" + sheet + "-" + i;
  // The coins egg i of a sheet pays (config map.eggCoins; 0 when missing).
  function eggCoins(M, sheet, i) { const row = (M && M.eggCoins && M.eggCoins[sheet - 1]) || [], v = row[i]; return Number.isFinite(v) ? Math.max(0, Math.min(999, Math.round(v))) : 0; }

  // ---- sprites (SVG markup; sheet px) -----------------------------------------------------------------------------------
  // A plank bridge centred on (x, y), its length along the heading ang (degrees), w wide across the road.
  function bridge(x, y, ang, len, w) {
    const h = len / 2, v = w / 2; let s = '<g class="br" transform="translate(' + r1(x) + " " + r1(y) + ") rotate(" + r1(ang) + ')">';
    s += '<rect x="' + r1(-h) + '" y="' + r1(-v + 3) + '" width="' + r1(len) + '" height="' + r1(w) + '" fill="rgba(0,0,0,.28)"/>';
    s += '<rect x="' + r1(-h) + '" y="' + r1(-v) + '" width="' + r1(len) + '" height="' + r1(w) + '" fill="#a87a46" stroke="' + INK + '" stroke-width="3"/>';
    let p = ""; for (let t = -h + 9; t < h - 4; t += 10) p += "M" + r1(t) + " " + r1(-v) + "v" + r1(w);
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
  const egg = (kind, found) => (EGGS[kind] || EGGS.grass)[found ? 1 : 0];
  const EGG_KINDS = Object.keys(EGGS);

  // The Goblin King (about 80 x 100 sheet px, his feet at 0 0) and his banner (a pole 90 tall).
  const king = () => '<g transform="scale(2.1) translate(-19 -46)"><g fill="#1e1620" stroke="#1e1620" stroke-linejoin="round"><path d="M10 14c0-7 4-10 9-10s9 3 9 10v4c5 2 9 6 10 14l-6-2 2 12-6-3-2 7h-14l-2-7-6 3 2-12-6 2c1-8 5-12 10-14z"/><path d="M3 6l-6 2 6 3zM35 6l6 2-6 3z"/></g>' +
    '<path d="M12 4l2-6 3 4 2-6 2 6 3-4 2 6z" fill="#f2c230" stroke="#221a26" stroke-width="1.2"/><circle cx="15.5" cy="12" r="1.6" fill="#ff4a3a"/><circle cx="22.5" cy="12" r="1.6" fill="#ff4a3a"/></g>';
  const flag = () => '<g transform="scale(2)"><path d="M0 0v46" stroke="#1e1620" stroke-width="2.4"/><path d="M1 2h22l-5 7 5 7-4 1 3 6H1z" fill="#8a1f19" stroke="#1e1620" stroke-width="1.6"/><circle cx="11" cy="11" r="3.4" fill="#f3ead8" stroke="#1e1620" stroke-width="1.2"/><circle cx="11" cy="11" r="1.2" fill="#1e1620"/></g>';

  return { nodeState, questState, tail, focus, nearest, pathD, split, heading, side, eggId, eggCoins, bridge, detour, stone, egg, EGG_KINDS, king, flag };
});
