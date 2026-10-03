// Sapper's Path v4.1 castle pictures (SPEC-v4 §9, the v4.1 entry and its fix): each Siege level is a full-board picture
// in the Gallery's style, a castle seen from the front. Every cell of the picture is a block (sky, clouds, grass, hills,
// trees, tents, props, the castle) except the moats (water: never eaten, never walked) and the bank path above each moat
// (open ground); the castle and everything standing in front of the background wear a bold black outline (one ring,
// 8-adjacent); the picture sits in a 1-cell frame of open ground whose entry square is the middle of its bottom row
// (tools/pic.js frame), so sappers come out at the bottom and walk round the picture. Every number comes from
// tools/bake-config.json (eras[e].gen, picture).
//   castle(era, seed, P, Q)   -> {w, h, grid, pic, gates, towers, pal, roles, scene, style, palette} or null (the caller
//                                tries the next seed). P: the era's generator params with the level's colour count
//                                (P.colours; P.scene may force a scene); Q: bake-config picture (roles, scenes, the frame)
// Variety (the v4.1 fix, the visual critic's V1): every picture draws a scene (day, dawn, dusk, night, winter: pre-checked
// palettes, picture.scenes, weighted per era) and a seeded layout: where the castle stands (left, middle or right), its
// shape (per era below), the ground (one hill, a plateau, two hills, flat; distant hills or mountains behind) and the
// foreground props (tents, haystacks, a catapult, a cart, rocks, banners on poles, trees round or pine).
// The eras keep their identity:
//   1 palisade: a log stockade with pointed stakes (on an earth bank), its gateway, watchtowers, thatched huts peeking over.
//     No gates.
//   2 motte and bailey: the moat in front (a drawbridge, the first gate: its key in a lodge by the entry), the bailey's
//     stockade with its hall and huts, the motte (an earth mound with a timber tower) to one side or the middle.
//   3 stone keep: the moat and drawbridge, a stone curtain with battlements and a gatehouse, slate archer towers (against
//     the frame and beside the gatehouse, on the bank path, so they can always be reached), the keep behind: square,
//     tall with a spire, round with a cone, or twin keeps.
//   4 concentric castle, three families: concentric (the low outer curtain, the high inner curtain inset on its own bank
//     path, the keep on top), lake (a wide lake for its outer moat and a small shore), twin keeps (two keeps on the inner
//     curtain). The second gate is a portcullis in the inner gatehouse, or (the boss, room permitting) the inner moat with
//     its own drawbridge. The boss (level 100) is the biggest.
// How the siege rules read a picture: water cuts the board (a moat runs off both sides, so the frame is water there too),
// so everything beyond a moat is reached only over its drawbridge, an iron gate that opens when its gilt key is eaten
// (SPEC-v3 §4). The bank path above a moat joins the frame on both sides, so once the bridge is down the whole far side is
// open. Archer towers are slate (their own colour), each a separate 4-connected group touching the bank path or the frame.
// Colours: one colour per role per scene (pre-checked: every pair of roles that can stand together is CIEDE2000 25 or more,
// and 20 or more with one faded to a queue row; tools/palette.js --scenes); material ids go by population (1-9, 11-13; 10
// stays iron gates and 14 gilt keys). The level's colour count is P.colours: the era's must roles plus optional features
// in a seeded order until it is reached.
"use strict";
const E = require("../src/engine.js");
const PIC = require("./pic.js");
const { rng } = require("./grade.js");

const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13];
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const SOLID = { "~": 1, ",": 1, iron: 1, gilt: 1, ink: 1 }; // cells the outline never takes
// v4.2: the feature scale of the picture being painted (P.k: 1 for v4.1's pictures, 2 for v4.2's full-screen ones). Every
// part below sizes itself by it, and at 1 draws exactly what v4.1 drew (Era 1, levels 1-25, is never repainted at 2).
let SK = 1;
const sz = (n) => Math.max(1, Math.round(n * SK)); // a size of n cells at this scale
const par = (n, pw) => (((n - pw) % 2) === 0 ? n : n - 1); // n, or one less, to match the picture's width parity (centred)

// ---- a role canvas ------------------------------------------------------------------------------------------------------
// Each cell holds a role name ("sky", "stone", ...), "~" water, "," open ground, "iron" (a gate), "gilt" (a key) or "ink";
// subj marks the cells of things that stand in front of the background (they get the outline); background cells (sky,
// clouds, grass, distant hills) may take the outline.
function canvas(pw, ph) {
  const role = new Array(pw * ph).fill("sky"), subj = new Uint8Array(pw * ph);
  const C = { pw, ph, role, subj,
    in: (x, y) => x >= 0 && y >= 0 && x < pw && y < ph,
    get: (x, y) => (C.in(x, y) ? role[y * pw + x] : null),
    sub: (x, y) => (C.in(x, y) ? subj[y * pw + x] : 0),
    set: (x, y, r, s) => { if (C.in(x, y)) { role[y * pw + x] = r; subj[y * pw + x] = s ? 1 : 0; } },
    rect: (x0, y0, x1, y1, r, s) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) C.set(x, y, r, s); },
    // An ellipse centred (cx, cy) with radii (rx, ry), filled where the test passes (only onto cells `onto` allows).
    blob: (cx, cy, rx, ry, r, s, onto) => { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1 && (!onto || onto(C.get(x, y), x, y))) C.set(x, y, r, s); } },
  };
  return C;
}
const skyish = (v) => v === "sky" || v === "cloud";

// ---- parts --------------------------------------------------------------------------------------------------------------
// Battlements on a wall top: merlons on alternate cells of the row above y0 (from x0 to x1), the wall's own role (v4.2:
// sz(1) wide and sz(0.75) tall, sz(1) apart).
function merlons(C, x0, x1, y0, r) { const mw = sz(1), mh = sz(0.75); for (let x = x0; x <= x1; x++) if (((x - x0) % (2 * mw)) < mw) for (let j = 1; j <= mh; j++) C.set(x, y0 - j, r, 1); }
// A curtain wall: a solid rectangle with battlements on top and a row of windows (ink) every `gap` cells.
function curtain(C, x0, x1, yTop, yBase, r, gap, skip) {
  C.rect(x0, yTop, x1, yBase, r, 1); merlons(C, x0, x1, yTop, r);
  if (gap && yBase - yTop >= 3 * SK) for (let x = x0 + sz(2); x < x1 - sz(1); x += gap) if (!skip || !skip(x)) for (let j = 0; j < sz(1); j++) C.set(x, yTop + sz(1) + j, "ink", 1);
}
// A tower x0..x0+w-1 from yTop to yBase: battlements, or a pointed roof (a triangle one wider each side) when o.roof is
// given; arrow slits (ink) every third row from the top when o.slits; a pennant on top when o.flag.
function tower(C, x0, w, yTop, yBase, r, o) {
  o = o || {};
  C.rect(x0, yTop, x0 + w - 1, yBase, r, 1);
  if (o.slits) for (let y = yTop + sz(1); y < yBase - sz(1); y += sz(3)) for (let j = 0; j < sz(1); j++) C.set(x0 + ((w - 1) >> 1), y + j, "ink", 1);
  if (o.roof) { const rh = Math.ceil((w + 2) / 2); for (let k = 0; k < rh; k++) C.rect(x0 - 1 + k, yTop - 1 - k, x0 + w - k, yTop - 1 - k, o.roof, 1); if (o.flag) flagOn(C, x0 + ((w - 1) >> 1), yTop - 1 - rh, o.flag); }
  else { merlons(C, x0, x0 + w - 1, yTop, r); if (o.flag) flagOn(C, x0 + ((w - 1) >> 1), yTop - 1 - sz(0.75), o.flag); }
}
// Is the box x0..x1, y0..y1 (one cell round it included) clear of slate, and on the canvas? Archer towers must never
// touch (each is its own 4-connected group).
function clearOf(C, x0, x1, y0, y1, r) { for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (C.get(x, y) === r) return false; return x0 >= 0 && x1 < C.pw; }
// A pennant: a pole cell under a 2x1 flag pointing right (the pole takes the flag's role too, so a flag is one colour; v4.2:
// each part sz(1) cells).
function flagOn(C, x, yTop, r) { const u = sz(1), f = yTop - u; if (!C.in(x, f - u + 1)) return; C.rect(x, yTop, x, f + 1, r, 1); C.rect(x, f, x + 2 * u - 1, f - u + 1, r, 1); }
// A row of arrow slits (ink, 1x2 when tall) across a block, a cell apart: one in the middle of a narrow block (6 wide or
// less), else three or more, never a pair (two windows over a door read as a face: the visual critic's m2).
function slits(C, x0, x1, y, tall) { const n = x1 - x0 + 1, g = sz(2), k = n <= 6 * SK ? 1 : Math.floor((n - 1) / g), hh = (tall ? 2 : 1) * sz(1);
  for (let i = 0; i < k; i++) { const x = k === 1 ? x0 + ((n - 1) >> 1) : x0 + sz(1) + i * g; if (x > x1 - (k === 1 ? 0 : sz(1) - 1)) break; for (let j = 0; j < hh; j++) C.set(x, y + j, "ink", 1); } }
// An arched door (ink): w wide, h tall, its top corners left in the wall.
function arch(C, cx, w, yBase, h) { const x0 = Math.round(cx - (w - 1) / 2); C.rect(x0, yBase - h + 1, x0 + w - 1, yBase, "ink", 1); if (w >= 3 && h >= 2) { C.set(x0, yBase - h + 1, C.get(x0 - 1, yBase - h + 1) || "stone", 1); C.set(x0 + w - 1, yBase - h + 1, C.get(x0 + w, yBase - h + 1) || "stone", 1); } }
// The keep, in one of four styles. body: its role; roof and flag when the level has them.
//   square: battlements, a row of slits; corner turrets with pointed roofs (with roof).
//   tall: narrow and high with a spire (roof) or battlements.
//   round: chamfered corners and a wide cone (roof) or battlements.
//   twin: two narrow keeps with a low hall between.
function keep(C, style, cx, kw, kTop, kBase, body, roof, flag) {
  const kx = Math.round(cx - (kw - 1) / 2), s2 = sz(2);
  if (style === "twin") {
    const tw = Math.max(sz(3), Math.floor((kw - 1) / 2)), lx = kx, rx = kx + kw - tw;
    C.rect(lx + tw, kTop + s2, rx - 1, kBase, body, 1); merlons(C, lx + tw, rx - 1, kTop + s2, body);
    for (const x of [lx, rx]) { C.rect(x, kTop, x + tw - 1, kBase, body, 1); if (roof) tower(C, x, tw, kTop, kBase, body, { roof }); else merlons(C, x, x + tw - 1, kTop, body); slits(C, x, x + tw - 1, kTop + s2, true); }
    if (flag) flagOn(C, lx + (tw >> 1), kTop - (roof ? Math.ceil((tw + 2) / 2) + 1 : 1 + sz(0.75)), flag);
    return;
  }
  const cut = style === "round" ? sz(1) : 0; // a round keep's chamfered corners
  C.rect(kx, kTop + cut, kx + kw - 1, kBase, body, 1); C.rect(kx + cut, kTop, kx + kw - 1 - cut, kTop + cut, body, 1);
  if (style !== "round") C.rect(kx + 1, kTop, kx + kw - 2, kTop, body, 1);
  slits(C, kx, kx + kw - 1, kTop + s2, kBase - kTop >= 5 * SK);
  if (kBase - kTop >= 7 * SK) slits(C, kx, kx + kw - 1, kTop + sz(5), false);
  if (style === "tall" || style === "round") {
    if (roof) { const rw = style === "round" ? kw + 2 : kw, rh = Math.ceil(rw / 2); for (let k = 0; k < rh; k++) C.rect(kx - (rw - kw) / 2 + k, kTop - 1 - k, kx + kw - 1 + (rw - kw) / 2 - k, kTop - 1 - k, roof, 1); if (flag) flagOn(C, kx + ((kw - 1) >> 1), kTop - 1 - rh, flag); }
    else { merlons(C, kx, kx + kw - 1, kTop, body); if (flag) flagOn(C, kx + ((kw - 1) >> 1), kTop - 1 - sz(0.75), flag); }
    return;
  }
  merlons(C, kx, kx + kw - 1, kTop, body);
  if (roof) { const t2 = sz(2); for (const tx of [kx - sz(1), kx + kw - t2 + sz(1) - 1]) tower(C, tx, t2, kTop - sz(1), kTop + sz(1), body, { roof }); }
  if (flag) flagOn(C, kx + ((kw - 1) >> 1), kTop - 1 - sz(0.75), flag);
}
// Pointed stakes x0..x1 standing on row base: every other stake one row shorter, so the top is a row of points.
function stakes(C, x0, x1, top, base, r) { const u = sz(1); for (let x = x0; x <= x1; x++) C.rect(x, top + ((((x - x0) / u) | 0) & 1) * u, x, base, r, 1); }
// A tree standing on row yBase at column cx: a round canopy over a one-cell trunk, or (pine) a narrow triangle.
function tree(C, cx, yBase, h, canopy, trunk, pine) {
  const th = trunk ? sz(1) : 0, x = Math.floor(cx);
  if (trunk) C.rect(x - (sz(1) >> 1), yBase, x + sz(1) - 1 - (sz(1) >> 1), yBase - th + 1, trunk, 1);
  if (pine) { const n = Math.max(2, h - th); for (let k = 0; k < n; k++) { const hw = Math.floor(((n - 1 - k) * 2) / 3 + 0.5); C.rect(x - hw, yBase - th - k, x + hw, yBase - th - k, canopy, 1); } return; }
  const ry = Math.max(1, (h - th) / 2), rx = Math.max(1.4, ry * 1.1);
  C.blob(cx, yBase - th - ry + 0.5, rx, ry, canopy, 1);
}
// A tent: a triangle with its base on row yBase, w wide (odd), a door of ink at the middle of its base.
function tent(C, cx, yBase, w, r) { const hh = (w + 1) >> 1; for (let k = 0; k < hh; k++) C.rect(cx - (hh - 1 - k), yBase - k, cx + (hh - 1 - k), yBase - k, r, 1); C.set(cx, yBase, "ink", 1); }
// Foreground props, each standing on row yBase with its left column x0 (PROPS: width, least height and the roles it needs): a
// tent (roof), a tree (forest, a timber trunk unless pines), a haystack (thatch), a catapult and a cart (timber), rocks
// (stone), a banner on a pole (timber, banner).
const PROPS = { tent: [3, 2, ["roof"]], tree: [3, 2, ["tree"]], hay: [3, 3, ["thatch"]], catapult: [5, 3, ["wood"]], cart: [4, 2, ["wood"]], rocks: [3, 2, ["stone"]], pole: [2, 3, ["wood", "banner"]] };
function prop(C, kind, x0, yBase, h, has, S) {
  if (SK !== 1 && kind !== "tree" && kind !== "tent") return stamp(C, kind, x0, yBase, sz(1));
  if (kind === "tent" && SK !== 1) { const w = PROPS.tent[0] * sz(1), tw = w % 2 ? w : w - 1; return tent(C, x0 + (tw >> 1), yBase, tw, "roof"); }
  if (kind === "tree" && SK !== 1) return tree(C, x0 + (PROPS.tree[0] * sz(1)) / 2, yBase, h, "tree", has("wood") && !S.pine && "wood", S.pine);
  const cx = x0 + 1;
  if (kind === "tent") tent(C, cx, yBase, 3, "roof");
  else if (kind === "tree") tree(C, cx + 0.5, yBase, h, "tree", has("wood") && !S.pine && "wood", S.pine);
  else if (kind === "hay") { C.rect(x0, yBase - 1, x0 + 2, yBase, "thatch", 1); C.set(cx, yBase - 2, "thatch", 1); }
  else if (kind === "catapult") { C.rect(x0, yBase, x0 + 4, yBase, "wood", 1); C.set(x0 + 1, yBase - 1, "wood", 1); C.set(x0 + 2, yBase - 1, "wood", 1); C.set(x0 + 3, yBase - 2, "wood", 1); C.set(x0 + 4, yBase - 2, "wood", 1); }
  else if (kind === "cart") { C.rect(x0, yBase - 1, x0 + 3, yBase - 1, "wood", 1); C.set(x0, yBase, "ink", 1); C.set(x0 + 3, yBase, "ink", 1); }
  else if (kind === "rocks") { C.rect(x0, yBase, x0 + 2, yBase, "stone", 1); C.set(cx, yBase - 1, "stone", 1); }
  else if (kind === "pole") { C.rect(x0, yBase - 2, x0, yBase, "wood", 1); C.set(x0 + 1, yBase - 2, "banner", 1); C.set(x0 + 1, yBase - 1, "banner", 1); }
}
// v4.2: a prop at u times its v4.1 size: v4.1's drawing on a scratch canvas, each cell then u x u.
function stamp(C, kind, x0, yBase, u) {
  const w = PROPS[kind][0], h = 5, T = canvas(w, h); T.role.fill(""); const sk = SK; SK = 1; prop(T, kind, 0, h - 1, h, () => true, {}); SK = sk;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = T.role[y * w + x]; if (v) C.rect(x0 + x * u, yBase - (h - 1 - y) * u - u + 1, x0 + x * u + u - 1, yBase - (h - 1 - y) * u, v, 1); }
}
// The sky: the sun (or at night the moon, in the stars' colour) in a top corner, puffy clouds (or stars) when the level
// has clouds. Only onto sky.
function sky(C, r, S, y1, has, sunSide) {
  const onto = (v) => v === "sky", right = sunSide ? sunSide > 0 : r() < 0.5, cx = right ? C.pw - sz(3) : sz(3), cy = sz(3), rad = SK !== 1 ? 1.9 * SK : C.pw >= 22 ? 2.3 : 1.7;
  if (S.moon && has("cloud")) C.blob(cx, cy, rad, rad, "cloud", 0, onto);
  else if (!S.moon && has("thatch")) C.blob(cx, cy, rad, rad, "thatch", 0, onto);
  if (!has("cloud")) return;
  if (S.moon) { for (let k = 0, n = Math.round(C.pw * 0.6); k < n; k++) { const x = ri(r, 0, C.pw - 1), y = ri(r, 0, Math.max(1, y1)); if (onto(C.get(x, y)) && onto(C.get(x + 1, y)) && onto(C.get(x - 1, y))) C.set(x, y, "cloud", 0); } return; }
  const n = Math.max(1, Math.round(C.pw / ri(r, 9, 14))); for (let k = 0; k < n; k++) { const cx2 = ((k + 0.3 + r() * 0.4) * C.pw) / n, cy2 = 1.5 * SK + r() * Math.max(0.5, y1 * 0.5);
    C.blob(cx2, cy2, (2.2 + r() * 1.2) * SK, 1.1 * SK, "cloud", 0, onto); C.blob(cx2 + ri(r, -1, 1) * SK, cy2 - 0.9 * SK, 1.5 * SK, 1.0 * SK, "cloud", 0, onto); }
}
// Distant hills on the horizon behind row yBase (background, drawn before the castle): rounded bumps, or with peaks
// pointed ones, and everything still sky below the line takes the role too.
function horizon(C, r, yBase, role, peaks) {
  const n = ri(r, 2, 4);
  for (let k = 0; k < n; k++) { const cx = ((k + 0.2 + r() * 0.6) * C.pw) / n, h = Math.round(ri(r, 2, 4) * SK);
    if (peaks) { for (let j = 0; j <= h; j++) for (let x = Math.round(cx - (h - j)); x <= Math.round(cx + (h - j)); x++) if (skyish(C.get(x, yBase - j))) C.set(x, yBase - j, role, 0); }
    else C.blob(cx, yBase + 0.5, (2.2 + r() * 2) * SK, h, role, 0, skyish); }
  for (let y = yBase; y < C.ph; y++) for (let x = 0; x < C.pw; x++) if (skyish(C.get(x, y))) C.set(x, y, role, 0);
}
// The ground's shape under row yBase: one hill round cx, a wide plateau, two hills, or flat.
function ground(C, r, kind, cx, yBase, half, role) {
  if (kind === "flat") return C.rect(0, yBase + 1, C.pw - 1, C.ph - 1, role, 0);
  if (kind === "wide") { C.rect(Math.round(cx - half - 1), yBase + 1, Math.round(cx + half + 1), C.ph - 1, role, 0); C.blob(cx + 0.5, C.ph + 1, half + 4, C.ph + 1 - yBase - 1, role, 0); return; }
  C.blob(cx + 0.5, C.ph + 1.5, half + 3.5, C.ph + 1.5 - yBase, role, 0);
  if (kind === "twin") { const ox = cx < C.pw / 2 ? C.pw - 3 : 3; C.blob(ox, C.ph + 1, 4 + r() * 2, C.ph + 1 - yBase - ri(r, 0, 2), role, 0); }
}
// A lodge (a gate's key): a small hut on row yBase, w x hh walls with the gilt key in the middle of its wall and a pitched
// roof (roof role, else the wall's). Returns the key's cell.
function lodge(C, x0, yBase, w, hh, walls, roof, rh) {
  C.rect(x0, yBase - hh + 1, x0 + w - 1, yBase, walls, 1);
  const rr = roof || walls; for (let k = 0; k < Math.min(rh, (w + 1) >> 1); k++) C.rect(x0 - 1 + k, yBase - hh - k, x0 + w - k, yBase - hh - k, rr, 1);
  const kx = x0 + ((w - 1) >> 1), ky = yBase - ((hh - 1) >> 1); C.set(kx, ky, "gilt", 1);
  return [kx, ky];
}
// A moat: rows y0..y1 of water across the whole picture with a drawbridge (iron) bw wide centred on bx, and the bank path
// (open ground) on the row above it. Returns the gate {at}.
function moat(C, y0, y1, bx, bw) {
  C.rect(0, y0, C.pw - 1, y1, "~", 0); C.rect(0, y0 - 1, C.pw - 1, y0 - 1, ",", 0);
  const x0 = Math.max(1, Math.min(C.pw - 1 - bw, Math.round(bx - bw / 2))); C.rect(x0, y0, x0 + bw - 1, y1, "iron", 1);
  return { at: [x0, y0] };
}
// The foreground (rows y0..y1, grass): the lodge with a gate's key on one side of the entry, then F.props props (tents,
// trees, haystacks, a catapult, a cart, rocks, a banner) spread over the rest in a seeded order, each one cell clear of
// the next and of the entry's three middle columns, none taller than the foreground. Returns the key (or null).
function foreground(C, r, y0, y1, F, has, S) {
  C.rect(0, y0, C.pw - 1, y1, "grass", 0);
  const mid = (C.pw - 1) / 2, base = y1, hmax = y1 - y0 + 1, taken = [], u = sz(1); let key = null;
  const free = (x0, x1) => x0 >= 0 && x1 < C.pw && !taken.some(([a, b]) => x1 >= a - 1 && x0 <= b + 1) && !(x1 >= mid - 1.5 && x0 <= mid + 1.5);
  if (F.lodge) { const w = sz(4), lh = sz(2); for (let t = 0; t < 6 && !key; t++) { const side = r() < 0.5 ? -1 : 1, x0 = side < 0 ? Math.round(mid) - sz(3) - w - ri(r, 0, sz(3)) : Math.round(mid) + sz(3) + ri(r, 0, sz(3)); if (free(x0 - 1, x0 + w)) { key = lodge(C, x0, base, w, lh, F.lodge, F.lodgeRoof, hmax - lh); taken.push([x0 - 1, x0 + w]); } } }
  const kinds = Object.keys(PROPS).concat(["tree", "tent"]).filter((k) => PROPS[k][1] * u <= hmax && PROPS[k][2].every(has));
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const n = ri(r, F.props[0], F.props[1]);
  for (let k = 0, placed = 0; k < kinds.length * 4 && placed < n && kinds.length; k++) {
    const kind = kinds[k % kinds.length], w = PROPS[kind][0] * u, x0 = ri(r, 0, C.pw - w), x1 = x0 + w - 1;
    if (!free(x0, x1)) continue;
    prop(C, kind, x0, base, Math.min(sz(4), hmax), has, S); taken.push([x0, x1]); placed++;
  }
  return key;
}

// ---- the eras -----------------------------------------------------------------------------------------------------------
// Each painter gets P (the era's generator params: the picture's [min, max] columns P.w and rows P.h, without the frame),
// has(role) and the scene S, and returns {C, gates, towers, style} in picture coordinates, or null.
const sideOf = (r, pw, k) => pick(r, [-1, 0, 1]) * Math.round(pw * k);

// Era 1: a log stockade with pointed stakes (on an earth bank), on a hill or flat ground; a gateway; watchtowers; huts.
// Rows from the bottom: the foreground, the hill's crown, the bank, the stakes, the watchtower above them (its roof and
// pennant), and at least P.skyMin rows of sky over it all; on a short picture the pennant, the tower's rise, the stakes
// and the hill give way in that order.
function era1(r, P, has, S) {
  const pw = ri(r, P.w[0], P.w[1]), ph = ri(r, P.h[0], P.h[1]), C = canvas(pw, ph), mid = (pw - 1) / 2;
  const fgH = ri(r, P.fg[0], P.fg[1]), yFg = ph - fgH, bankT = has("earth") && r() < 0.75 ? 1 : 0, roofH = has("thatch") ? 3 : 1, gk = pick(r, ["round", "wide", "twin", "flat"]);
  let hill = gk === "flat" ? 1 : ri(r, P.hill[0], P.hill[1]), palH = ri(r, P.palH[0], P.palH[1]), up = ri(r, 2, 3), flagH = has("banner") ? 2 : 0;
  for (let g = 0; g < 12 && fgH + hill + bankT + palH + up + roofH + flagH + P.skyMin > ph; g++) { if (flagH) flagH = 0; else if (up > 1) up--; else if (palH > 3) palH--; else if (hill > 1) hill--; else break; }
  const nW = ri(r, P.watch[0], P.watch[1]), tw = 3, half = Math.max(4, Math.round(pw * (P.span[0] + r() * (P.span[1] - P.span[0])) / 2));
  const cx = Math.max(half, Math.min(pw - 1 - half, mid + sideOf(r, pw, 0.18))), base = yFg - hill, x0 = Math.round(cx - half + 1), x1 = Math.round(cx + half - 1), top = base - bankT - palH + 1;
  const towerAt = []; const spots = [x0, x1 - tw + 1, Math.round(cx - 1 - (r() < 0.5 ? half / 2 : -half / 2))];
  for (let t = 0; t < nW; t++) towerAt.push(spots.splice(nW === 1 ? ri(r, 0, 2) : 0, 1)[0]);
  if (has("tree") && r() < 0.55) horizon(C, r, base - 1, "tree", false);
  ground(C, r, gk, cx, base, half, "grass"); C.rect(0, yFg, pw - 1, ph - 1, "grass", 0);
  if (has("thatch")) { const n = ri(r, 0, Math.max(1, Math.round((x1 - x0) / 6))); for (let k = 0; k < n; k++) { const hx = ri(r, x0 + 1, x1 - 1), hw = ri(r, 2, 3); for (let j = 0; j < hw; j++) C.rect(hx - (hw - 1 - j), top - j, hx + (hw - 1 - j), top - j, "thatch", 1); } }
  stakes(C, x0, x1, top, base - bankT, "wood");
  if (bankT) C.rect(x0 - 1, base, x1 + 1, base, "earth", 1);
  const gw = pw % 2 ? 3 : 2, gx = Math.max(x0 + 1, Math.min(x1 - gw, Math.round(cx - (gw - 1) / 2) + ri(r, -2, 2))), gh = Math.min(palH - 1, 3);
  C.rect(gx, base - bankT - gh + 1, gx + gw - 1, base - bankT, "ink", 1);
  for (const tx of towerAt) { const th = palH + up; tower(C, tx, tw, base - bankT - th + 1, base - bankT, "wood", { roof: has("thatch") && r() < 0.7 && "thatch", flag: flagH && has("banner") && "banner", slits: true }); }
  foreground(C, r, yFg, ph - 1, { props: P.props }, has, S);
  sky(C, r, S, Math.floor(ph * 0.35), has, towerAt.length && towerAt[0] < mid ? 1 : -1);
  return { C, gates: [], towers: [], style: gk + (bankT ? "-bank" : "") + "-" + towerAt.length + "w" };
}

// Era 2: the moat and drawbridge in front, the bailey's stockade with its hall and huts, the motte to one side or the
// middle (an earth mound whose foot hides behind the stakes) with a timber tower on its crown. With room (ph >= P.twoMinH)
// and P.twoGates, the motte's own ditch: a second moat between the bailey and the mound, its key in the bailey's stockade.
function era2(r, P, has, S) {
  const pw = ri(r, P.w[0], P.w[1]), ph = ri(r, P.h[0], P.h[1]), C = canvas(pw, ph), mid = (pw - 1) / 2;
  const fgH = ri(r, P.fg[0], P.fg[1]), yFg = ph - fgH, yM = yFg - P.moatH, gates = [], bw = par(sz(2.5), pw), mside = pick(r, [-1, 0, 1]);
  const bank = yM - 1, palH = ri(r, P.palH[0], P.palH[1]), bTop = bank - palH, two = ph >= P.twoMinH && r() < P.twoGates;
  if (has("tree") && r() < 0.5) horizon(C, r, bTop - 1, "tree", false);
  const k1 = foreground(C, r, yFg, ph - 1, { lodge: "wood", lodgeRoof: has("thatch") ? "thatch" : has("roof") ? "roof" : null, props: P.props }, has, S);
  const bx = mid + 0.5 + ri(r, -sz(2), sz(2)), g1 = moat(C, yM, yFg - 1, bx, bw); g1.key = k1; gates.push(g1);
  // The motte (drawn first: the bailey stands in front of its foot), or beyond its ditch.
  let foot = bTop + 1;
  if (two) { const y1 = bTop - sz(2), y0 = y1 - sz(2) + 1; C.rect(0, y1 + 1, pw - 1, bTop + 1, "grass", 0); const g2 = moat(C, y0, y1, mid + 0.5, bw); const kx = r() < 0.5 ? sz(2) : pw - 1 - sz(2), ky = bank - sz(2); g2.key = [kx, ky]; gates.push(g2); foot = y0 - sz(2); }
  const room = foot - sz(4), mh = Math.max(sz(3), Math.min(ri(r, P.motteH[0], P.motteH[1]), room - sz(4))), mw = Math.min(pw - 2, ri(r, P.motteW[0], P.motteW[1])), mx = Math.max(mw / 2, Math.min(pw - mw / 2, mid + mside * Math.round(pw * 0.24)));
  C.blob(mx + 0.5, foot + 0.5, mw / 2, mh, "earth", 1, (v, x, y) => !C.sub(x, y) && v !== "~" && v !== ",");
  const crown = foot - mh + 1, tws = pick(r, ["square", "cone", "tall"]), tw = sz(3 + ((pw + 1) & 1) + (tws === "tall" ? -1 : r() < 0.5 ? 1 : 0)), th = Math.max(sz(3), Math.min(ri(r, P.towerH[0], P.towerH[1]) + (tws === "tall" ? sz(1) : 0), crown - sz(3))), tx = Math.round(mx - (tw - 1) / 2);
  tower(C, tx, Math.max(2, tw), crown - th + 1, crown, "wood", { roof: tws !== "square" && has("thatch") && "thatch", flag: has("banner") && "banner", slits: true });
  // The bailey: its stockade (the whole width, or the side away from the motte), its hall and huts peeking over.
  const partial = mside !== 0 && r() < 0.5, sx0 = partial && mside < 0 ? Math.round(pw * 0.3) : ri(r, 0, 1), sx1 = partial && mside > 0 ? Math.round(pw * 0.7) : pw - 1 - ri(r, 0, 1);
  const hx = ri(r, sx0 + sz(3), sx1 - sz(3)), hr = sz(3), hw = sz(2), uh = sz(2);
  if (has("roof")) for (let j = 0; j < hr; j++) C.rect(hx - hw + (j >> 1), bTop - j, hx + hw - (j >> 1), bTop - j, "roof", 1);
  if (has("thatch")) for (let k = 0, n = ri(r, 1, 3); k < n; k++) { const cx = ri(r, sx0 + 1, sx1 - 1); if (Math.abs(cx - hx) < sz(4)) continue; for (let j = 0; j < uh; j++) C.rect(cx - (uh - 1 - j), bTop - j, cx + (uh - 1 - j), bTop - j, "thatch", 1); }
  stakes(C, sx0, sx1, bTop, bank - 1, "wood");
  const gx = Math.max(sx0 + 1, Math.min(sx1 - bw, Math.round(bx - bw / 2))); C.rect(gx, bank - sz(2), gx + bw - 1, bank - 1, "ink", 1);
  if (two) C.set(gates[1].key[0], gates[1].key[1], "gilt", 1);
  sky(C, r, S, Math.floor(ph * 0.3), has, -mside || 1);
  return { C, gates, towers: [], style: (mside < 0 ? "left" : mside > 0 ? "right" : "mid") + "-" + tws + (partial ? "-half" : "") };
}

// Era 3: moat and drawbridge, a stone curtain with its gatehouse (the bridge in front of it) and slate archer towers at
// its ends and beside the gatehouse, the keep behind it in one of four styles. The curtain spans the picture (its end
// towers against the frame) or, narrower (P.spans), stands on the bank path with open country either side; distant hills
// (P.horizon) on some pictures.
function era3(r, P, has, S) {
  const pw = ri(r, P.w[0], P.w[1]), ph = ri(r, P.h[0], P.h[1]), C = canvas(pw, ph), mid = (pw - 1) / 2;
  const fgH = ri(r, P.fg[0], P.fg[1]), yFg = ph - fgH, yM = yFg - P.moatH, gates = [], towers = [], bw = par(sz(2.5), pw), tw = 2 * sz(1.5) - 1, gw = par(sz(4.5), pw);
  const ks = pick(r, ["square", "tall", "round", "twin"]), span = pick(r, P.spans || [1]), cw = span >= 1 ? pw : Math.min(pw - 2, Math.max(2 * tw + gw + sz(6), Math.round(pw * span)));
  const cx0 = span >= 1 ? 0 : ri(r, 1, pw - 1 - cw), cx1 = cx0 + cw - 1, ccx = (cx0 + cx1) / 2;
  const gx = Math.max(cx0 + tw + 1, Math.min(cx1 - tw - gw, Math.round(ccx - (gw - 1) / 2) + pick(r, [-1, 0, 1]) * Math.round(cw * 0.18))), gcx = gx + (gw - 1) / 2;
  const bank = yM - 1, cH = ri(r, P.curtainH[0], P.curtainH[1]), cTop = bank - cH;
  if (r() < P.horizon) horizon(C, r, cTop - ri(r, 0, sz(2)), has("tree") && r() < 0.6 ? "tree" : "grass", r() < 0.5);
  // P.moat false (a teaching level about archers alone): no moat and no gate; the bank path still runs under the curtain.
  const wet = P.moat !== false, k1 = foreground(C, r, wet ? yFg : yM, ph - 1, { lodge: wet && (has("wood") ? "wood" : "stone"), lodgeRoof: has("roof") ? "roof" : null, props: P.props }, has, S);
  if (wet) { const g1 = moat(C, yM, yFg - 1, gcx + 0.5, bw); g1.key = k1; gates.push(g1); } else C.rect(0, yM - 1, pw - 1, yM - 1, ",", 0);
  // The keep behind the curtain (ashlar when the level has it), away from the gatehouse; then the curtain and gatehouse.
  const kwr = ri(r, P.keepW[0], P.keepW[1]) - (ks === "tall" ? sz(2) : 0), kw = Math.min(cw - sz(4), kwr - ((kwr + pw) & 1)), up = ks === "tall" || ks === "round" ? sz(2) : 0;
  const kh = Math.max(sz(4), Math.min(ri(r, P.keepH[0], P.keepH[1]) + (ks === "tall" ? sz(2) : 0), cTop - sz(3) - P.skyMin - up)), kTop = cTop - kh;
  const kcx = Math.max(cx0 + kw / 2 + 1, Math.min(cx1 - kw / 2 - 1, ccx + (gcx < ccx ? 1 : gcx > ccx ? -1 : pick(r, [-1, 1])) * ri(r, 0, Math.round(cw * 0.15))));
  keep(C, ks, kcx, ks === "twin" ? Math.min(cw - sz(4), kw + sz(3)) : kw, kTop, cTop, has("ashlar") ? "ashlar" : "stone", has("roof") && "roof", has("banner") && "banner");
  curtain(C, cx0, cx1, cTop, bank - 1, "stone", ri(r, sz(3), sz(5)), (x) => Math.abs(x - gcx) <= gw / 2 + 1);
  C.rect(gx, cTop - sz(1), gx + gw - 1, bank - 1, "stone", 1); merlons(C, gx, gx + gw - 1, cTop - sz(1), "stone"); arch(C, gcx, gw - 2 * sz(1), bank - 1, sz(2));
  // Archer towers, slate: the curtain's ends (both, or one), then beside the gatehouse (P.towers > 2).
  const nT = ri(r, P.towers[0], P.towers[1]), ends = r() < 0.75 || nT > 2 ? [cx0, cx1 - tw + 1] : [pick(r, [cx0, cx1 - tw + 1])], spots = ends.concat([gx - tw - 1, gx + gw + 1]);
  for (let i = 0; i < Math.max(1, Math.min(spots.length, nT)); i++) { const tx = spots[i], end = i < ends.length, h2 = end ? cH + ri(r, P.towerUp[0], P.towerUp[1]) : cH + sz(1);
    if (!clearOf(C, tx, tx + tw - 1, bank - h2, bank - 1, "slate")) continue;
    tower(C, tx, tw, bank - h2, bank - 1, "slate", { roof: has("roof") && end && r() < 0.7 && "roof", slits: true });
    towers.push({ at: [tx + 1, bank - 2], r: +(P.range[0] + r() * (P.range[1] - P.range[0])).toFixed(1) }); }
  // Open country beside a narrow curtain: a tree or two standing on the bank path's row above.
  if (span < 1 && has("tree")) for (const [a, b] of [[0, cx0 - 2], [cx1 + 2, pw - 1]]) if (b - a >= 2 && r() < 0.7) tree(C, ri(r, a + 1, b - 1) + 0.5, bank - 1, ri(r, sz(3), sz(5)), "tree", has("wood") && !S.pine && "wood", S.pine);
  sky(C, r, S, Math.floor(ph * 0.3), has, ccx > mid ? -1 : 1);
  return { C, gates, towers, style: ks + (span < 1 ? "-narrow" : "") + "-" + towers.length + "t" };
}

// Era 4, three families (P.family forces one). concentric: the outer moat and drawbridge, the low outer curtain with its
// towers and gatehouse (the second gate's key in its wall), the outer ward, the high inner curtain inset from the frame
// (by different amounts each side) on its own bank path with towers at its ends and the second gate, the keep on top.
// lake: the outer moat is a lake a row deeper than a moat, and the inner curtain rises straight behind
// the outer one with a tall roofed keep. twin: two keeps on the inner curtain with a hall between. The second gate is the
// inner moat's drawbridge when P.innerMoat and the rows allow (the boss), else a portcullis in the inner gatehouse.
function era4(r, P, has, S) {
  const pw = ri(r, P.w[0], P.w[1]), ph = ri(r, P.h[0], P.h[1]), C = canvas(pw, ph), mid = (pw - 1) / 2, fam = P.family || pick(r, ["concentric", "lake", "twin"]);
  const lake = fam === "lake", fgH = lake ? P.fg[1] : ri(r, P.fg[0], P.fg[1]), mH = lake ? P.moatH + sz(1) : P.moatH;
  const yFg = ph - fgH, yM = yFg - mH, gates = [], towers = [], bw = par(sz(2.5), pw), tw = 2 * sz(1.5) - 1, gw = par(sz(4.5), pw), rg = (a) => +(a[0] + r() * (a[1] - a[0])).toFixed(1), mh = sz(0.75);
  const k1 = foreground(C, r, yFg, ph - 1, { lodge: has("wood") ? "wood" : "stone", lodgeRoof: has("roof") ? "roof" : null, props: P.props }, has, S);
  const gx = Math.max(tw + 1, Math.min(pw - 1 - tw - gw, Math.round(mid - (gw - 1) / 2) + (fam === "concentric" ? pick(r, [-1, 0, 1]) * Math.round(pw * 0.15) : 0))), gcx = gx + (gw - 1) / 2;
  const g1 = moat(C, yM, yFg - 1, gcx + 0.5, bw); g1.key = k1; gates.push(g1);
  // Rows from the outer bank up: outer curtain oH (+ merlons), ward, [inner moat + bank], inner curtain iH (+ merlons),
  // keep kh (+ merlons, roofs 2), sky over it at least P.skyMin.
  const bank1 = yM - 1, oH = ri(r, P.outerH[0], P.outerH[1]), ward = lake ? 0 : ri(r, P.ward[0], P.ward[1]), iH0 = ri(r, P.innerH[0], P.innerH[1]), kh0 = ri(r, P.keepH[0], P.keepH[1]);
  const free = bank1 - (oH + mh + ward + 1 + iH0 + mh + sz(3) + sz(2) + P.skyMin), inner = r() < P.innerMoat && free >= P.moatH + 1;
  const left = free - (inner ? P.moatH + 1 : 0), kh = Math.max(sz(3), Math.min(kh0, sz(3) + left)), iH = Math.max(sz(3), Math.min(iH0, iH0 + left - (kh - sz(3))));
  const oTop = bank1 - oH, wardTop = oTop - mh - ward;
  if (r() < P.horizon) horizon(C, r, wardTop - iH - ri(r, 1, 3), has("tree") && r() < 0.5 ? "tree" : "grass", r() < 0.5);
  if (ward) C.rect(0, wardTop, pw - 1, oTop - 1, "grass", 0);
  curtain(C, 0, pw - 1, oTop, bank1 - 1, "stone", sz(4), (x) => Math.abs(x - gcx) <= gw / 2 + 1);
  C.rect(gx, oTop - sz(1), gx + gw - 1, bank1 - 1, "stone", 1); merlons(C, gx, gx + gw - 1, oTop - sz(1), "stone"); arch(C, gcx, gw - 2 * sz(1), bank1 - 1, sz(2));
  const k2 = [gx + ((gw - 1) >> 1), oTop]; C.set(k2[0], k2[1], "gilt", 1);
  const nO = ri(r, P.towersOut[0], P.towersOut[1]), oSpots = [0, pw - tw, gx - tw - 1, gx + gw + 1];
  for (let i = 0; i < nO; i++) { const tx = oSpots[i], h2 = oH + (i < 2 ? sz(2) : sz(1)); if (!clearOf(C, tx, tx + tw - 1, bank1 - h2, bank1 - 1, "slate")) continue; tower(C, tx, tw, bank1 - h2, bank1 - 1, "slate", { slits: true }); towers.push({ at: [tx + 1, bank1 - 2], r: rg(P.rangeOut) }); }
  let bank2 = wardTop - 1;
  if (inner) { const y1 = wardTop - 1, y0 = y1 - P.moatH + 1, g2 = moat(C, y0, y1, mid + 0.5, bw); g2.key = k2; gates.push(g2); bank2 = y0 - 1; }
  else C.rect(0, bank2, pw - 1, bank2, ",", 0);
  // The inner curtain, inset (each side its own amount), its gate in the middle; the keep(s) on top.
  const iA = ri(r, P.inset[0], P.inset[1]), iB = ri(r, P.inset[0], P.inset[1]), ix0 = iA, ix1 = pw - 1 - iB, iTop = bank2 - iH, icx = (ix0 + ix1) / 2, ig = Math.round(icx - (bw - 1) / 2);
  const body = has("ashlar") ? "ashlar" : "stone";
  if (fam !== "twin") { const kwr = ri(r, P.keepW[0], P.keepW[1]), kw = Math.min(ix1 - ix0 - sz(3), kwr - ((kwr + pw) & 1));
    keep(C, lake ? pick(r, ["tall", "round"]) : pick(r, ["square", "square", "round"]), icx + (lake ? 0 : ri(r, -sz(2), sz(2))), kw, iTop - kh, iTop - 1, body, lake && has("roof") && "roof", has("banner") && "banner"); }
  curtain(C, ix0, ix1, iTop, bank2 - 1, "stone", sz(3), (x) => Math.abs(x - icx) <= gw / 2);
  if (fam === "twin") { const kw = Math.max(sz(4), Math.round((ix1 - ix0 + 1) * 0.28)), kw2 = kw - ((kw + pw) & 1), st = pick(r, ["tall", "square", "round"]); // two great towers standing on the bank path
    for (const cx of [ix0 + (kw2 - 1) / 2, ix1 - (kw2 - 1) / 2]) keep(C, st, cx, kw2, iTop - Math.max(sz(3), kh) - sz(1), bank2 - 1, body, has("roof") && "roof", has("banner") && cx < icx && "banner"); }
  if (inner) arch(C, ig + (bw - 1) / 2, bw, bank2 - 1, sz(2));
  else { C.rect(ig, bank2 - sz(2), ig + bw - 1, bank2 - 1, "iron", 1); gates.push({ at: [ig, bank2 - sz(2)], key: k2 }); }
  const nI = ri(r, P.towersIn[0], P.towersIn[1]), iSpots = fam === "twin" ? [ig - tw - 1, ig + bw + 1] : [ix0, ix1 - tw + 1, ig - tw - 1, ig + bw + 1]; // twin: the keeps stand at the ends
  for (let i = 0; i < Math.min(nI, iSpots.length); i++) { const tx = iSpots[i], h2 = iH + (i < 2 && fam !== "twin" ? sz(2) : sz(1)); if (!clearOf(C, tx, tx + tw - 1, bank2 - h2, bank2 - 1, "slate")) continue; tower(C, tx, tw, bank2 - h2, bank2 - 1, "slate", { roof: has("roof") && i < 2 && !lake && "roof", flag: has("banner") && i === 0 && "banner", slits: true }); towers.push({ at: [tx + 1, bank2 - 2], r: rg(P.rangeIn) }); }
  sky(C, r, S, Math.floor(ph * 0.2), has, pick(r, [-1, 1]));
  return { C, gates, towers, style: fam + (inner ? "-moat" : "") + "-" + towers.length + "t" };
}
const ERAS = { 1: era1, 2: era2, 3: era3, 4: era4 };

// ---- scenes, roles, colours, the board --------------------------------------------------------------------------------
// The scene: P.scene if given, else a weighted pick among the era's scenes (picture.eras[e].scenes).
function sceneOf(era, P, Q, r) {
  if (P.scene && Q.scenes[P.scene]) return P.scene;
  const W = Q.eras[era].scenes || { day: 1 }, keys = Object.keys(W).filter((k) => Q.scenes[k]); let tot = 0; for (const k of keys) tot += W[k];
  let x = r() * tot; for (const k of keys) { x -= W[k]; if (x < 0) return k; } return keys[0] || "day";
}
// Roles per era: `must` always; `opt` added in a seeded order until the level's colour count (P.colours) is reached; a
// scene may drop roles (no clouds at dawn on stone castles, in winter). Gilt counts as a colour (its keys have cards); iron
// and water never do.
function rolesFor(era, P, Q, r, drop) {
  const E2 = Q.eras[era], want = E2.must.filter((k) => drop.indexOf(k) < 0), opt = E2.opt.filter((k) => drop.indexOf(k) < 0);
  for (let i = opt.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opt[i], opt[j]] = [opt[j], opt[i]]; }
  const first = (P.first || E2.first || []).filter((k) => opt.indexOf(k) >= 0); for (const k of first.reverse()) { opt.splice(opt.indexOf(k), 1); opt.unshift(k); }
  for (const k of opt) { if (want.length >= P.colours) break; want.push(k); }
  return want;
}
function castle(era, seed, P, Q) {
  const r = rng(seed), scene = sceneOf(era, P, Q, r), SC = Q.scenes[scene] || {}, S = { moon: !!SC.moon, pine: !!SC.pine || r() < (P.pine || 0) };
  let want; try { want = rolesFor(era, P, Q, r, SC.drop || []); } catch (e) { return null; }
  const has = (k) => want.indexOf(k) >= 0;
  let res; SK = P.k || 1; try { res = ERAS[era](r, P, has, S); } catch (e) { res = null; } SK = 1;
  if (!res) return null;
  const { C, gates, towers } = res;
  PIC.outline(C.role, C.subj, C.pw, C.ph, (v) => !SOLID[v], "ink");
  // Roles actually on the board (a feature may have been crowded out), their ids by population, the palette (the scene's
  // colour and name for a role it changes, else the role's).
  const cnt = {}; for (const v of C.role) cnt[v] = (cnt[v] || 0) + 1;
  const used = Object.keys(cnt).filter((v) => v !== "~" && v !== "," && v !== "iron" && v !== "gilt").sort((a, b) => cnt[b] - cnt[a] || (a < b ? -1 : 1));
  if (used.length > IDS.length) return null;
  const id = {}; used.forEach((v, k) => { id[v] = IDS[k]; }); id.iron = E.IRON; id.gilt = E.GILT;
  const colour = (v) => (v === "ink" ? Q.ink : (SC.c && SC.c[v]) || Q.roles[v].c[0]), name = (v) => (SC.n && SC.n[v]) || (Q.roles[v] ? Q.roles[v].name : v);
  const pal = {}; for (const v of used) pal[id[v]] = { c: colour(v), n: name(v), r: v };
  if (cnt.iron) pal[E.IRON] = { c: Q.iron, n: "drawbridge", r: "iron" };
  const hx = used.map(colour).concat(cnt.gilt ? [require("../config.json").v3.mats[E.GILT].c] : []); let md = 100, mf = 100;
  for (let a = 0; a < hx.length; a++) for (let b = a + 1; b < hx.length; b++) { md = Math.min(md, PIC.de(hx[a], hx[b])); mf = Math.min(mf, PIC.fadeGap(hx[a], hx[b])); }
  if (md < Q.minDE || mf < Q.fadeDE) return null; // never, with the scenes as checked (tools/palette.js --scenes)
  const L = PIC.frame((x, y) => { const v = C.role[y * C.pw + x]; return v === "~" ? "~" : v === "," ? "," : E.chOf(id[v]); }, C.pw, C.ph, Q);
  const mv = (p) => [p[0] + 1, p[1] + 1];
  L.gates = gates.filter((g) => g.key).map((g) => ({ at: mv(g.at), key: mv(g.key) }));
  L.towers = towers.map((t) => ({ at: mv(t.at), r: t.r }));
  L.pal = pal; L.roles = used.concat(cnt.gilt ? ["gilt"] : []); L.scene = scene; L.style = res.style; L.palette = { minDE: +md.toFixed(1), minFade: +mf.toFixed(1) };
  try { E.compile(Object.assign({ cols: [[], [], [], [], []] }, L)); } catch (e) { return null; }
  return L;
}

module.exports = { castle, canvas, ERAS };

// ~/.local/opt/node/bin/node tools/castle.js --sheet OUT.png [--era E] [--n N] [--px 6] [--colours K] [--scene S]   a
//   contact sheet of freshly generated castles; --levels FILE [--cols 10] draws that file's boards instead.
if (require.main === module) {
  const fs = require("fs"), path = require("path"), CV = require("./convert.js"), C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8"));
  const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
  const eras = arg("era") ? [+arg("era")] : [1, 2, 3, 4], n = +arg("n", 6), px = +arg("px", 6), out = arg("sheet", "castles.png"), boards = [];
  if (arg("levels")) boards.push(...JSON.parse(fs.readFileSync(path.resolve(arg("levels")), "utf8")).levels);
  else for (const e of eras) for (let k = 0; k < n; k++) {
    const P = Object.assign({}, C.eras[e].gen, { colours: +arg("colours", C.picture.eras[e].sample || 8) }, arg("scene") ? { scene: arg("scene") } : {});
    let L = null; for (let t = 0; t < 40 && !L; t++) L = castle(e, 1000 * e + 37 * k + t, P, C.picture);
    if (!L) { console.log("era " + e + " #" + k + ": none"); continue; }
    boards.push(L); console.log("era " + e + " #" + k + ": " + L.w + "x" + L.h + " " + L.scene + " " + L.style + " colours " + L.roles.length + " minDE " + L.palette.minDE + " faded " + L.palette.minFade + " gates " + L.gates.length + " towers " + L.towers.length);
  }
  const cols = +arg("cols", Math.min(n, 6)), cw = Math.max(...boards.map((L) => L.w)) * px + 8, chh = Math.max(...boards.map((L) => L.h)) * px + 8, rows = Math.ceil(boards.length / cols);
  const W = cols * cw, H = rows * chh, rgb = new Uint8Array(W * H * 3).fill(30);
  boards.forEach((L, k) => { const R = PIC.render(L, px, C.picture.show), x0 = (k % cols) * cw + 4, y0 = ((k / cols) | 0) * chh + 4; for (let y = 0; y < R.h; y++) rgb.set(R.rgb.subarray(y * R.w * 3, (y + 1) * R.w * 3), ((y0 + y) * W + x0) * 3); });
  fs.writeFileSync(out, CV.encode(W, H, rgb)); console.log("wrote " + out);
}
