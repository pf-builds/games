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
// ---- v5 R4: the realms 5-8 (levels 100-200) -------------------------------------------------------------------------------
// Same picture style (full board, bold outline, 1-cell frame, entry at the bottom) with each realm's own look. Their props
// are small pixel drawings (ART: rows of role letters at one unit a letter, drawn sz(1) cells a letter), so nothing the
// eras 1-4 draw (PROPS, foreground) changes. Every new painter takes the features the level's plan asks for:
//   P.moat (false: no water; the bank path still runs under the fort), P.gates (0: the bridge over the moat is open ground,
//   a causeway; 1: a drawbridge, its key in a lodge in front; 2: and a portcullis in the fort's door, its key in a wall),
//   P.towers ([a, b] archer towers, or 0: none; slate, each its own 4-connected group standing on the bank path),
//   P.range (their reach), P.liquid ("lava": the moat is drawn as lava; tools/castle.js only records it on the level).
// The picture's roles keep their keys (sky, cloud, grass, ...); the realm's scenes rename and recolour them (picture.scenes:
// fog and mist, ash and embers, moss and glowcaps, gold and scrap), so the colour gate and palette check work unchanged.
const ART = {
  reeds: { rows: ["w.w", "t.t", "ttt"], need: ["tree", "wood"] },
  rush: { rows: ["t.w.", "t.t.", "tttt"], need: ["tree", "wood"] },
  willow: { rows: [".tt.", "tttt", "t.tt"], need: ["tree"] },
  rocks: { rows: [".s.", "sss"], need: ["stone"] },
  pole: { rows: ["wb", "wb", "w."], need: ["wood", "banner"] },
  stack: { rows: [".h.", "hhh", "hhh"], need: ["thatch"] },
  boat: { rows: ["w...", "wwww"], need: ["wood"] },
  lavarock: { rows: [".r.", "srs"], need: ["stone", "roof"] },
  vent: { rows: [".h.", ".g.", "ggg"], need: ["thatch", "grass"] },
  spire: { rows: [".s.", ".s.", "sss"], need: ["stone"] },
  brazier: { rows: ["hrh", ".s.", "sss"], need: ["thatch", "roof", "stone"] },
  shroom: { rows: ["bbb", ".s.", ".s."], need: ["banner", "stone"] },
  shrooms: { rows: ["bb.b", "s..s", "s.ss"], need: ["banner", "stone"] },
  fern: { rows: ["g.g", ".gg", "ggg"], need: ["grass"] },
  stump: { rows: [".t.", "www"], need: ["wood", "tree"] },
  lantern: { rows: [".h", "wh", "w."], need: ["wood", "thatch"] },
  spikes: { rows: ["w.w", "w.w", "www"], need: ["wood"] },
  scrap: { rows: [".a..", "swaw"], need: ["stone", "wood", "ashlar"] },
  hoard: { rows: [".h.", "hhh"], need: ["thatch"] },
  gtent: { rows: [".r.", "rrr", "rkr"], need: ["roof"] },
};
const ARTKEY = { w: "wood", t: "tree", s: "stone", b: "banner", h: "thatch", r: "roof", e: "earth", g: "grass", a: "ashlar", k: "ink", c: "cloud" };
// Draw an ART drawing with its bottom row on yBase and its left column x0, each letter u x u cells (subjects).
function art(C, kind, x0, yBase, u) {
  const rows = ART[kind].rows, h = rows.length;
  for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) { const ch = rows[y][x]; if (ch !== ".") C.rect(x0 + x * u, yBase - (h - 1 - y) * u - u + 1, x0 + x * u + u - 1, yBase - (h - 1 - y) * u, ARTKEY[ch], 1); }
}
// Pools of water in the foreground (rows y0..y1, never within 2 cells of the sides or of the entry's middle columns, so the
// frame's walk round the picture and the entry stay open): n flat ellipses.
function pools(C, r, y0, y1, n) {
  const mid = (C.pw - 1) / 2;
  for (let k = 0; k < n; k++) { const rx = ri(r, sz(1.5), sz(3)), cx = ri(r, rx + 2, C.pw - 3 - rx), cy = ri(r, y0 + 1, Math.max(y0 + 1, y1 - 1)); if (Math.abs(cx - mid) < rx + sz(2)) continue;
    C.blob(cx + 0.5, cy + 0.5, rx, Math.max(1, sz(0.6)), "~", 0, (v, x, y) => v === "grass" && x > 1 && x < C.pw - 2 && y >= y0 && y <= y1 && !C.sub(x, y)); }
}
// The realm's foreground and moat (shared by eras 5-8): the foreground (grass with the realm's props, F.kinds, and with a
// gate the lodge holding its key), the moat with its bridge (a drawbridge when P.gates, else open ground: a causeway) and
// the bank path, or with P.moat false the bank path alone. Returns {bank (the bank path's row), gates, key (the lodge's key
// when it has no drawbridge to open), bx (the bridge's middle)}.
function front(C, r, P, has, S, F) {
  const mid = (C.pw - 1) / 2, fgH = ri(r, P.fg[0], P.fg[1]), yFg = C.ph - fgH, wet = P.moat !== false, yM = wet ? yFg - P.moatH : yFg, bw = par(sz(2.5), C.pw), u = sz(1), gates = [];
  C.rect(0, yFg, C.pw - 1, C.ph - 1, "grass", 0);
  const taken = [], free = (x0, x1) => x0 >= 0 && x1 < C.pw && !taken.some(([a, b]) => x1 >= a - 1 && x0 <= b + 1) && !(x1 >= mid - 1.5 && x0 <= mid + 1.5);
  let key = null;
  if (P.gates > 0) { const w = sz(4), lh = sz(2); for (let t = 0; t < 8 && !key; t++) { const side = r() < 0.5 ? -1 : 1, x0 = side < 0 ? Math.round(mid) - sz(3) - w - ri(r, 0, sz(3)) : Math.round(mid) + sz(3) + ri(r, 0, sz(3)); if (free(x0 - 1, x0 + w)) { key = lodge(C, x0, C.ph - 1, w, lh, F.lodge, F.lodgeRoof, fgH - lh); taken.push([x0 - 1, x0 + w]); } } }
  const kinds = F.kinds.filter((k) => ART[k].need.every(has) && ART[k].rows.length * u <= fgH);
  const n = kinds.length ? ri(r, P.props[0], P.props[1]) : 0;
  for (let k = 0, placed = 0; k < 6 * n && placed < n; k++) { const kind = kinds[ri(r, 0, kinds.length - 1)], w = ART[kind].rows[0].length * u, x0 = ri(r, 0, C.pw - w); if (!free(x0, x0 + w - 1)) continue; art(C, kind, x0, C.ph - 1, u); taken.push([x0, x0 + w - 1]); placed++; }
  if (F.pools) pools(C, r, yFg, C.ph - 2, ri(r, F.pools[0], F.pools[1]));
  const bx = mid + 0.5 + ri(r, -sz(2), sz(2));
  if (wet) { const g = moat(C, yM, yFg - 1, bx, bw); if (P.gates > 0 && key) { g.key = key; gates.push(g); key = null; } else for (let y = yM; y < yFg; y++) for (let x = 0; x < C.pw; x++) if (C.get(x, y) === "iron") C.set(x, y, ",", 0); }
  else C.rect(0, yM - 1, C.pw - 1, yM - 1, ",", 0);
  return { bank: yM - 1, gates, key, bx };
}
// Archer towers (slate) standing on the bank path: at each spot in turn (left columns), h tall, until n are up; each one is
// kept clear of the others (its own 4-connected group). roof: a cone (a role) or null; lean: the crooked shift a row
// (era 8). Returns the towers ({at, r}).
function archers(C, r, spots, n, tw, hOf, bank, P, roof, lean) {
  const out = [];
  for (let i = 0; i < spots.length && out.length < n; i++) { const tx = spots[i], h2 = hOf(i); const ms = lean ? lean * Math.floor((h2 - 1) / sz(3)) : 0, xa = tx + Math.min(0, ms), xb = tx + tw - 1 + Math.max(0, ms);
    if (xa < 0 || xb >= C.pw || !clearOf(C, xa, xb, bank - h2, bank - 1, "slate")) continue;
    if (lean) { for (let y = bank - 1, k = 0; y >= bank - h2; y--, k++) { const dx = lean * Math.floor(k / sz(3)); C.rect(tx + dx, y, tx + dx + tw - 1, y, "slate", 1); if (k % sz(3) === sz(1.5) && k < h2 - sz(1)) C.set(tx + dx + ((tw - 1) >> 1), y, "ink", 1); }
      const dx = lean * Math.floor((h2 - 1) / sz(3)); merlons(C, tx + dx, tx + dx + tw - 1, bank - h2, "slate"); }
    else tower(C, tx, tw, bank - h2, bank - 1, "slate", { roof, slits: true });
    out.push({ at: [tx + 1, bank - 2], r: +(P.range[0] + r() * (P.range[1] - P.range[0])).toFixed(1) }); }
  return out;
}
// Mist banks: n long flat ellipses of `role` (mist, ash, ...) across the background between rows y0 and y1 (onto sky,
// distant hills and trees: background only).
function banks(C, r, n, y0, y1, role) { for (let k = 0; k < n; k++) C.blob(ri(r, 0, C.pw - 1) + 0.5, ri(r, y0, Math.max(y0, y1)) + 0.5, ri(r, sz(4), sz(9)), Math.max(1, sz(0.7)), role, 0, (v, x, y) => !C.sub(x, y) && (v === "sky" || v === "tree" || v === "grass" || v === "stone" || v === "earth")); }
// A thatched hut on row yBase: walls (w x hh, `walls`), a door (ink) and a pitched roof of `roof` overhanging a cell each
// side; style "cone" draws a pointed roof, "low" a flat-topped one.
function hut(C, x0, w, yBase, hh, walls, roof, style) {
  C.rect(x0, yBase - hh + 1, x0 + w - 1, yBase, walls, 1);
  const rh = style === "low" ? sz(1.5) : Math.ceil((w + 2) / 2), o = 1;
  for (let k = 0; k < rh; k++) { const a = x0 - o + (style === "low" ? (k >> 1) : k), b = x0 + w - 1 + o - (style === "low" ? (k >> 1) : k); if (a > b) break; C.rect(a, yBase - hh - k, b, yBase - hh - k, roof, 1); }
  const dw = Math.max(1, sz(1)), dx = x0 + ((w - dw) >> 1); C.rect(dx, yBase - Math.min(hh - 1, sz(1.5)) + 1, dx + dw - 1, yBase, "ink", 1);
  return yBase - hh - rh + 1; // its top row
}

// v5 R4 fix (the visual critic's S1): the Mistmoor's fog. A willow: a crown (w wide, its rows a third of h) with fronds
// hanging from it nearly to its feet on row yBase, every other column (s: a subject, else background).
function willow(C, r, cx, yBase, w, h, role, s) {
  const ry = Math.max(1, h * 0.35), cy = yBase - h + ry;
  C.blob(cx + 0.5, cy, w / 2, ry, role, s);
  for (let x = Math.round(cx - w / 2) + 1; x <= Math.round(cx + w / 2) - 1; x += 2) C.rect(x, Math.round(cy), x, yBase - ri(r, 0, Math.max(0, Math.round(h * 0.3))), role, s);
}
// The fog fen behind every Mistmoor fort: no sun (at night a hazy moon), the fen (grass) from the willow line wY down to the
// bank path, far willows along that line, then banks of mist (cloud) across the willows and low over the fen. All of it is
// background, drawn before the fort, so the fog is the picture's backdrop and never lies over a block of the fort.
function fogFen(C, r, P, has, S, wY, bank) {
  C.rect(0, wY, C.pw - 1, bank - 1, "grass", 0);
  if (has("tree")) for (let x = ri(r, -sz(2), sz(2)); x < C.pw + sz(2); x += ri(r, sz(4), sz(7))) willow(C, r, x, wY + ri(r, 0, sz(1)), ri(r, sz(3), sz(5)), ri(r, sz(3), sz(5.5)), "tree", 0);
  if (!has("cloud")) return;
  if (S.moon) C.blob((r() < 0.5 ? sz(4) : C.pw - sz(4)) + 0.5, sz(3.5), sz(1.7), sz(1.7), "cloud", 0, (v) => v === "sky");
  const bg = (v, x, y) => !C.sub(x, y) && (v === "sky" || v === "tree" || v === "grass");
  for (let k = 0, n = ri(r, P.mist[0], P.mist[1]); k < n; k++) { const cx = ri(r, 0, C.pw - 1) + 0.5, cy = wY - ri(r, -sz(0.5), sz(2)) + 0.5, rx = ri(r, sz(7), sz(13)); // a bank of mist: a long low drift, a smaller one on its back
    C.blob(cx, cy, rx, sz(0.9), "cloud", 0, bg); C.blob(cx + ri(r, -sz(2), sz(2)), cy - sz(0.9), rx * 0.55, sz(0.6), "cloud", 0, bg); }
  C.blob(ri(r, 0, C.pw - 1) + 0.5, bank - sz(0.75) + 0.5, ri(r, sz(10), sz(16)), sz(0.75), "cloud", 0, bg); // low over the fen at the fort's feet
}
// A second gate in a fort's door (P.gates > 1 behind a drawbridge): an iron door x0..x0+w-1 standing on row yb, its key a
// gilt cell of `body` (all four sides `body`) found from a seeded spot in the box bx0..bx1, by0..by1; with no such cell the
// door stays an open doorway (ink).
function door2(C, r, P, gates, x0, w, yb, h, body, bx0, bx1, by0, by1) {
  if (!(P.gates > 1 && gates.length)) return;
  const y0 = yb - h + 1, same = (x, y) => C.get(x, y) === body && C.sub(x, y); let key = null;
  for (let t = 0; t < 60 && !key; t++) { const x = ri(r, Math.max(1, bx0), Math.min(C.pw - 2, bx1)), y = ri(r, Math.max(1, by0), Math.max(by0, by1)); if ((x < x0 - 1 || x > x0 + w) && same(x, y) && same(x - 1, y) && same(x + 1, y) && same(x, y - 1) && same(x, y + 1)) key = [x, y]; }
  if (!key) return C.rect(x0, y0, x0 + w - 1, yb, "ink", 1);
  C.rect(x0, y0, x0 + w - 1, yb, "iron", 1); C.set(key[0], key[1], "gilt", 1); gates.push({ at: [x0, y0], key });
}

// Era 5, The Mistmoor: forts of the fog fens. Behind every one the fog fen (fogFen: no sun, far willows, mist banks); in
// front the fen (reeds, still pools of mire, a lodge), the moat (a mire: P.liquid) and its causeway or drawbridge, the bank
// path. Five fort families (P.families, the visual critic's S2): a stilt hall (a timber platform on stilts, the long hall
// and huts under reed thatch, a watchtower), a causeway fort (a stone footing and a stake wall, a thatched gate tower, round
// huts peeking over), a reed palisade (a tall fence of bundled reeds bound with timber, a longhouse roof and a watch
// platform behind), a sunken tower (a leaning stone tower going down into the mist, a timber hoarding, a hut on legs by a
// plank walk) and an island hold (an earth mound out of the fen, a hall in a ring of stakes on top, willows each side).
// Archer towers are watch huts on tall legs (none in 101-124: towers come at 125). A second gate is the main door.
function era5(r, P, has, S) {
  const pw = ri(r, P.w[0], P.w[1]), ph = ri(r, P.h[0], P.h[1]), C = canvas(pw, ph), u = sz(1), mid = (pw - 1) / 2;
  const F = front(C, r, P, has, S, { lodge: has("earth") ? "earth" : "wood", lodgeRoof: has("thatch") ? "thatch" : null, kinds: ["reeds", "rush", "reeds", "rocks", "pole", "stack", "boat"], pools: P.pools });
  const bank = F.bank, gates = F.gates, fam = pick(r, P.families), walls = has("earth") ? "earth" : "wood", thatch = has("thatch") ? "thatch" : walls, top = P.skyMin + sz(1);
  const wY = ri(r, Math.round(ph * P.willowY[0]), Math.round(ph * P.willowY[1]));
  fogFen(C, r, P, has, S, wY, bank);
  let style = fam, spots = [0, pw - (2 * sz(1.5) - 1)];
  if (fam === "stilt") {
    const stH = ri(r, P.stiltH[0], P.stiltH[1]), plB = bank - stH, plTop = plB - u + 1, base = plTop - 1;
    const span = pick(r, P.spans), cw = span >= 1 ? pw : Math.max(sz(14), Math.round(pw * span)), cx0 = span >= 1 ? 0 : ri(r, 1, pw - 1 - cw), cx1 = cx0 + cw - 1, ccx = (cx0 + cx1) / 2;
    const gap = ri(r, sz(3), sz(4)), st0 = cx0 + (span >= 1 ? sz(1) : 0), legs = [];
    for (let x = st0; x <= cx1 - u + 1; x += gap) { C.rect(x, plB + 1, x + u - 1, bank - 1, "wood", 1); legs.push(x); }
    if (legs.length > 2) { const y = plB + 1 + ri(r, sz(1), stH - sz(3)); C.rect(legs[0], y, legs[legs.length - 1] + u - 1, y, "wood", 1); } // a cross beam
    if (has("tree")) for (const x of legs) for (const dx of [-1, u]) if (r() < 0.6) C.rect(x + dx, bank - ri(r, 1, sz(1)), x + dx, bank - 1, "tree", 1); // reeds at the legs' feet
    C.rect(cx0, plTop, cx1, plB, "wood", 1);
    const used = [], fits = (a, b) => a >= cx0 + sz(3) && b <= cx1 - sz(3) && !used.some(([p, q]) => b >= p - 1 && a <= q + 1);
    const hw = Math.min(cw - sz(8), ri(r, P.hallW[0], P.hallW[1])) | 1, hx = Math.round(Math.max(cx0 + sz(3), Math.min(cx1 - sz(3) - hw + 1, ccx - hw / 2 + pick(r, [-1, 0, 1]) * Math.round(cw * 0.12))));
    const cone = Math.ceil((hw + 2) / 2), hh = Math.max(sz(1.5), Math.min(ri(r, sz(2.5), sz(3.5)), base - top - cone));
    hut(C, hx, hw, base, hh, walls, thatch, "cone"); used.push([hx - 1, hx + hw]);
    if (hh >= sz(2.5)) slits(C, hx + 1, hx + hw - 2, base - hh + sz(1), false);
    const doorX = hx + ((hw - u) >> 1), left = hx - cx0 > cx1 - (hx + hw), wtw = sz(2);
    for (let t = 0; t < 6; t++) { const wx = left ? ri(r, cx0 + sz(3), hx - wtw - sz(1)) : ri(r, hx + hw + sz(1), cx1 - sz(3) - wtw); if (!fits(wx - 1, wx + wtw)) continue;
      tower(C, wx, wtw, Math.max(top + sz(2), base - ri(r, P.watchH[0], P.watchH[1])), base, "wood", { roof: thatch, flag: has("banner") && "banner", slits: true }); used.push([wx - 1, wx + wtw]); break; }
    for (let k = 0, n = ri(r, 1, 3), t = 0; k < n && t < 12; t++) { const w = (ri(r, sz(3), sz(4)) | 1), x0 = ri(r, cx0 + sz(3), cx1 - sz(3) - w); if (!fits(x0 - 1, x0 + w)) continue; hut(C, x0, w, base, ri(r, sz(1.5), sz(2)), walls, thatch, "cone"); used.push([x0 - 1, x0 + w]); k++; }
    const sh = sz(1.5); for (let x = cx0; x <= cx1; x++) if (x < doorX - 1 || x > doorX + u) { const v = C.get(x, base); if (!C.sub(x, base) || v === "ink") C.rect(x, base - sh + 1 + ((((x - cx0) / u) | 0) & 1) * u, x, base, "wood", 1); }
    door2(C, r, P, gates, doorX, u, base, sz(1.5), "wood", cx0 + sz(1), cx1 - sz(1), plTop, plB);
    spots = (span >= 1 ? [0, pw - (2 * sz(1.5) - 1)] : [cx0 - 2 * sz(1.5), cx1 + 2]);
    style = (span < 1 ? "narrow-" : "") + "stilt" + used.length;
  } else if (fam === "causeway") {
    // A stone footing and a stake wall across the fort's span, a thatched gate tower over the bridge, round huts behind.
    const span = pick(r, P.spans), cw = span >= 1 ? pw : Math.max(sz(16), Math.round(pw * span)), cx0 = span >= 1 ? 0 : ri(r, 1, pw - 1 - cw), cx1 = cx0 + cw - 1;
    const wH = ri(r, P.palH[0], P.palH[1]), wTop = bank - wH, foot = has("stone") ? "stone" : walls, fH = sz(2);
    for (let k = 0, n = ri(r, 2, 4), t = 0; k < n && t < 20; t++) { const w = (ri(r, sz(4), sz(6)) | 1), x0 = ri(r, cx0 + sz(1), cx1 - sz(1) - w); if (x0 < cx0) continue; const yb = wTop + sz(1), hh = ri(r, sz(1.5), sz(3));
      if (C.sub(x0, yb) || C.sub(x0 + w - 1, yb)) continue; hut(C, x0, w, yb, hh, walls, thatch, "cone"); k++; }
    stakes(C, cx0, cx1, wTop, bank - fH - 1, "wood"); C.rect(cx0, bank - fH, cx1, bank - 1, foot, 1);
    for (let x = cx0 + sz(1); x < cx1; x += sz(3)) C.set(x, bank - fH + ((x / sz(3)) & 1), "ink", 1); // the footing's joints
    const gw = par(sz(5), pw), gx = Math.max(cx0 + sz(2), Math.min(cx1 - sz(2) - gw + 1, Math.round(F.bx - gw / 2))), gTop = Math.max(top + sz(3), wTop - ri(r, sz(3), sz(5)));
    tower(C, gx, gw, gTop, bank - 1, "wood", { roof: thatch, flag: has("banner") && "banner", slits: true });
    const dw = sz(2), dx = gx + ((gw - dw) >> 1); arch(C, dx + (dw - 1) / 2, dw, bank - 1, sz(2.5));
    door2(C, r, P, gates, dx, dw, bank - 1, sz(2.5), foot, cx0 + sz(1), cx1 - sz(1), bank - fH + 1, bank - 2);
    spots = [cx0, cx1 - (2 * sz(1.5) - 1) + 1];
    style = (span < 1 ? "narrow-" : "") + "causeway";
  } else if (fam === "palisade") {
    // A tall fence of bundled reeds (the reeds' colour, bound with timber), a longhouse's roof and a watch platform behind.
    const pH = ri(r, P.palH[0], P.palH[1]) + sz(1), pTop = bank - pH, reed = has("tree") ? "tree" : "wood", band = reed === "wood" ? walls : "wood";
    const lw = ri(r, sz(10), sz(14)), lx = Math.round(mid - lw / 2) + pick(r, [-1, 1]) * ri(r, 0, sz(4)), lTop = pTop - ri(r, sz(2), sz(4));
    for (let k = 0, rh = sz(4); k < rh; k++) C.rect(lx + rh - 1 - k, lTop + k - sz(1), lx + lw - rh + k, lTop + k - sz(1), thatch, 1); // the longhouse's roof over the fence
    const wx = lx + lw + sz(2) < pw - sz(4) ? lx + lw + sz(2) : lx - sz(6), wTop = Math.max(top + sz(2), pTop - ri(r, sz(5), sz(8)));
    if (wx > sz(1)) { C.rect(wx, wTop + sz(2), wx + u - 1, pTop, "wood", 1); C.rect(wx + sz(3), wTop + sz(2), wx + sz(3) + u - 1, pTop, "wood", 1); C.rect(wx - u, wTop + sz(1), wx + sz(4) + u - 1, wTop + sz(2) - 1, "wood", 1); hut(C, wx, sz(4), wTop, sz(1), walls, thatch, "low"); }
    for (let x = 0; x < pw; x++) { const tip = (((x / u) | 0) % 3 === 1) ? 0 : u; C.rect(x, pTop + tip, x, bank - 1, reed, 1); }
    for (const y of [pTop + sz(2), bank - sz(2)]) for (let x = 0; x < pw; x++) if (((x / u) | 0) % 4 !== 3) C.set(x, y, band, 1); // the bindings
    const gw = par(sz(4), pw), gx = Math.max(sz(2), Math.min(pw - sz(2) - gw, Math.round(F.bx - gw / 2)));
    C.rect(gx - u, pTop - sz(1), gx + gw + u - 1, pTop, "wood", 1); C.rect(gx - u, pTop, gx - 1, bank - 1, "wood", 1); C.rect(gx + gw, pTop, gx + gw + u - 1, bank - 1, "wood", 1); arch(C, gx + (gw - 1) / 2, gw, bank - 1, pH - sz(2));
    door2(C, r, P, gates, gx, gw, bank - 1, sz(2.5), reed, 1, pw - 2, pTop + sz(3), bank - sz(3));
    style = "palisade";
  } else if (fam === "sunken") {
    // A leaning stone tower sinking into the fen: a ruined crown, a timber hoarding, slits.
    const body = has("stone") ? "stone" : walls, tw = ri(r, sz(7), sz(10)), side = pick(r, [-1, 1]), tx = Math.round(mid - tw / 2) + side * ri(r, sz(2), sz(6)), tTop = ri(r, top + sz(1), top + sz(4)), lean = pick(r, [-1, 1]);
    const sh = (y) => lean * Math.floor((bank - 1 - y) / sz(3));
    for (let y = tTop; y < bank; y++) C.rect(tx + sh(y), y, tx + sh(y) + tw - 1, y, body, 1);
    for (let x = 0; x < tw; x += u) { const t = ri(r, 0, 2) * u; if (t) C.rect(tx + sh(tTop) + x, tTop - t, tx + sh(tTop) + x + u - 1, tTop - 1, body, 1); } // the ruined crown
    const hy = tTop + sz(2); C.rect(tx + sh(hy) - u, hy, tx + sh(hy) + tw + u - 1, hy + sz(1.5) - 1, "wood", 1); // the hoarding
    for (let y = hy + sz(3); y < bank - sz(4); y += sz(3.5)) { const x = tx + sh(y) + ((tw - u) >> 1); C.rect(x, y, x + u - 1, y + sz(1.5) - 1, "ink", 1); }
    const dw = sz(2), dx = tx + sh(bank - 1) + ((tw - dw) >> 1); arch(C, dx + (dw - 1) / 2, dw, bank - 1, sz(3));
    door2(C, r, P, gates, dx, dw, bank - 1, sz(3), body, tx + sh(bank - 1), tx + sh(bank - 1) + tw - 1, bank - sz(8), bank - sz(4));
    // A hut on legs on the other side, a plank walk to the tower.
    const hw = (ri(r, sz(4), sz(5)) | 1), hx = side > 0 ? ri(r, sz(2), Math.max(sz(2), tx - hw - sz(4))) : ri(r, Math.min(pw - sz(2) - hw, tx + tw + sz(4)), pw - sz(2) - hw), hy0 = bank - ri(r, sz(4), sz(6));
    if (hx > 0 && hx + hw < pw) { C.rect(hx + u, hy0 + 1, hx + sz(2) - 1, bank - 1, "wood", 1); C.rect(hx + hw - sz(2), hy0 + 1, hx + hw - u - 1, bank - 1, "wood", 1); hut(C, hx, hw, hy0, sz(2), walls, thatch, "cone");
      const a = side > 0 ? hx + hw : tx + sh(hy0) + tw, b = side > 0 ? tx + sh(hy0) - 1 : hx - 1; if (b > a) C.rect(a, hy0, b, hy0, "wood", 1); }
    style = "sunken";
  } else {
    // An island hold: an earth mound out of the fen, a hall in a ring of stakes on top, willows each side.
    const mw = ri(r, sz(9), sz(12)), mh = ri(r, sz(5), sz(7)), mx = mid + pick(r, [-1, 0, 1]) * ri(r, 0, sz(4)), mound = "grass";
    C.blob(mx + 0.5, bank, mw, mh, mound, 1, (v, x, y) => y < bank);
    const mTop = bank - mh, hw = (ri(r, sz(5), sz(6)) | 1), hx = Math.round(mx - hw / 2), base = mTop + sz(1);
    stakes(C, Math.round(mx - mw * 0.55), Math.round(mx + mw * 0.55), mTop - sz(1), mTop + sz(1), "wood");
    hut(C, hx, hw, base - sz(1), ri(r, sz(2), sz(3)), walls === "earth" ? "wood" : walls, thatch, "cone");
    for (const s of [-1, 1]) { const x = Math.round(mx + s * (mw + ri(r, sz(2), sz(4)))); if (x > sz(2) && x < pw - sz(2) && has("tree")) willow(C, r, x, bank - 1, ri(r, sz(4), sz(6)), ri(r, sz(7), sz(9)), "tree", 1); }
    const dw = sz(2), dx = Math.round(mx - dw / 2); arch(C, dx + (dw - 1) / 2, dw, bank - 1, sz(2.5));
    door2(C, r, P, gates, dx, dw, bank - 1, sz(2.5), mound, Math.round(mx - mw * 0.6), Math.round(mx + mw * 0.6), bank - mh + sz(2), bank - sz(2));
    style = "island";
  }
  const tw = 2 * sz(1.5) - 1, nT = P.towers ? ri(r, P.towers[0], P.towers[1]) : 0;
  const towers = archers(C, r, spots, nT, tw, () => ri(r, sz(6), sz(9)), bank, P, thatch, 0);
  return { C, gates, towers, style: style + "-" + towers.length + "t" };
}

// Era 6, Emberwatch Crags: a basalt fort on volcanic heights. The moat is a lava channel (P.liquid "lava") with a basalt
// causeway or an iron drawbridge; above the bank path a rock plinth (scoria), the basalt curtain with ember-lit windows and
// a gatehouse, the keep (square, tall or twin) with sharp battlements; behind it jagged crags and a volcano with a glowing
// crater and a lava flow, under an ember sky with ash clouds. Archer towers stand at the curtain's ends and by the gate.
function era6(r, P, has, S) {
  const pw = ri(r, P.w[0], P.w[1]), ph = ri(r, P.h[0], P.h[1]), C = canvas(pw, ph), mid = (pw - 1) / 2, u = sz(1);
  const F = front(C, r, P, has, S, { lodge: "stone", lodgeRoof: has("roof") ? "roof" : null, kinds: ["lavarock", "vent", "spire", "rocks", "brazier"], pools: null });
  const bank = F.bank, gates = F.gates, plH = ri(r, P.plinth[0], P.plinth[1]), cH = ri(r, P.curtainH[0], P.curtainH[1]), cBase = bank - plH, cTop = cBase - cH + 1;
  const body = has("stone") ? "stone" : "earth", glow = has("thatch") ? "thatch" : "ink";
  // The volcano (left or right, behind), crags along the horizon, ash clouds.
  const vSide = pick(r, [-1, 1]), vx = vSide < 0 ? ri(r, sz(3), Math.round(pw * 0.25)) : ri(r, Math.round(pw * 0.75), pw - 1 - sz(3)), vTop = ri(r, P.skyMin + sz(1), Math.round(ph * 0.2));
  const rock = "grass"; // the ash and rock of the heights
  for (let y = vTop; y < cTop; y++) { const hw = Math.round(sz(1.5) + (y - vTop) * 0.9); C.rect(vx - hw, y, vx + hw, y, rock, 1); } // the volcano (a subject: outlined against the sky)
  if (has("thatch")) C.rect(vx - sz(1), vTop, vx + sz(1), vTop + 1, "thatch", 1);
  if (has("roof")) { let x = vx; for (let y = vTop + 2; y < cTop; y++) { x += (r() < 0.5 ? 0 : vSide < 0 ? 1 : -1); C.rect(x, y, x + u - 1, y, "roof", 1); } }
  for (let k = 0, n = ri(r, 2, 4); k < n; k++) { const px = ri(r, 0, pw - 1), h = ri(r, sz(2), sz(5)); for (let j = 0; j <= h; j++) for (let x = px - Math.round((h - j) * 0.7); x <= px + Math.round((h - j) * 0.7); x++) if (skyish(C.get(x, cTop - j))) C.set(x, cTop - j, rock, 0); } // crags
  C.rect(0, cTop, pw - 1, bank - 1, rock, 0);
  if (has("cloud")) { banks(C, r, ri(r, 1, 3), sz(1), vTop + sz(2), "cloud"); C.blob(vx + 0.5, vTop - sz(1.5), sz(2.5), sz(1.2), "cloud", 0, skyish); }
  // The plinth of rock the fort stands on (the bank path's row stays open in front).
  const span = pick(r, P.spans), cw = span >= 1 ? pw : Math.max(sz(15), Math.round(pw * span)), cx0 = span >= 1 ? 0 : ri(r, 1, pw - 1 - cw), cx1 = cx0 + cw - 1, ccx = (cx0 + cx1) / 2;
  C.rect(cx0, cBase + 1, cx1, bank - 1, rock, 1);
  for (let x = cx0; x <= cx1; x += ri(r, sz(2), sz(4))) C.set(x, cBase + 1 + ri(r, 0, Math.max(0, plH - 2)), "ink", 1);
  // The keep behind the curtain, then the curtain, its ember windows and the gatehouse.
  const ks = pick(r, ["square", "tall", "twin"]), gw = par(sz(4.5), pw), gx = Math.max(cx0 + sz(3), Math.min(cx1 - sz(3) - gw, Math.round(ccx - (gw - 1) / 2) + pick(r, [-1, 0, 1]) * Math.round(cw * 0.15))), gcx = gx + (gw - 1) / 2;
  const kwr = ri(r, P.keepW[0], P.keepW[1]) - (ks === "tall" ? sz(2) : 0), kw = Math.min(cw - sz(4), kwr - ((kwr + pw) & 1)), up = ks === "tall" ? sz(2) : 0;
  const kh = Math.max(sz(4), Math.min(ri(r, P.keepH[0], P.keepH[1]) + up, cTop - sz(2) - P.skyMin - up)), kTop = cTop - kh;
  const kcx = Math.max(cx0 + kw / 2 + 1, Math.min(cx1 - kw / 2 - 1, ccx - vSide * ri(r, Math.round(cw * 0.1), Math.round(cw * 0.22)))); // away from the volcano
  keep(C, ks, kcx, ks === "twin" ? Math.min(cw - sz(4), kw + sz(3)) : kw, kTop, cTop, body, null, has("banner") && "banner");
  for (let y = kTop + sz(2); y < cTop - u; y += sz(3)) for (let x = Math.round(kcx - kw / 2) + sz(1); x < Math.round(kcx + kw / 2) - u; x += sz(2.5)) if (C.get(x, y) === body) C.rect(x, y, x + u - 1, y + u - 1, glow, 1);
  curtain(C, cx0, cx1, cTop, cBase, body, 0);
  for (let x = cx0 + sz(2); x < cx1 - u; x += ri(r, sz(3), sz(4))) if (Math.abs(x - gcx) > gw / 2 + u) C.rect(x, cTop + u, x + u - 1, cTop + u + sz(1.5) - 1, glow, 1);
  C.rect(gx, cTop - u, gx + gw - 1, cBase, body, 1); merlons(C, gx, gx + gw - 1, cTop - u, body); arch(C, gcx, gw - 2 * u, cBase, sz(2.5));
  if (P.gates > 1 && gates.length) { const ay = cBase - sz(2.5) + 1; C.rect(Math.round(gcx - (gw - 2 * u - 1) / 2), ay, Math.round(gcx - (gw - 2 * u - 1) / 2) + gw - 2 * u - 1, cBase, "iron", 1); const kx = gx + (r() < 0.5 ? -sz(3) : gw + sz(2)), ky = cTop + sz(3);
    if (kx > cx0 && kx < cx1 && C.get(kx, ky) === body) { C.set(kx, ky, "gilt", 1); gates.push({ at: [Math.round(gcx - (gw - 2 * u - 1) / 2), ay], key: [kx, ky] }); } else C.rect(Math.round(gcx - (gw - 2 * u - 1) / 2), ay, Math.round(gcx - (gw - 2 * u - 1) / 2) + gw - 2 * u - 1, cBase, "ink", 1); }
  const tw = 2 * sz(1.5) - 1, nT = P.towers ? ri(r, P.towers[0], P.towers[1]) : 0, spots = (span >= 1 ? [0, pw - tw] : [cx0, cx1 - tw + 1]).concat([gx - tw - 1, gx + gw + 1]);
  const towers = archers(C, r, spots, nT, tw, (i) => plH + cH + (i < 2 ? ri(r, sz(2), sz(4)) : sz(1)), bank, P, null, 0);
  sky(C, r, S, Math.floor(ph * 0.2), has, -vSide);
  return { C, gates, towers, style: ks + (span < 1 ? "-narrow" : "") + (vSide < 0 ? "-vl" : "-vr") + "-" + towers.length + "t" };
}

// Era 7, The Shrouded Weald: a stronghold of living wood in an enchanted forest by moonlight. Behind: great trees (trunks
// and canopies) under a night sky with the moon and stars; in the middle a vast hollow tree grown into a keep (flared
// roots, glowing windows, leaf-roofed turrets on its branches) inside a palisade of living stakes wrapped in vines; glowing
// mushrooms in front and on the walls. The moat is a forest stream. Archer towers are barkwood towers with leafy cones.
function era7(r, P, has, S) {
  const pw = ri(r, P.w[0], P.w[1]), ph = ri(r, P.h[0], P.h[1]), C = canvas(pw, ph), mid = (pw - 1) / 2, u = sz(1);
  const F = front(C, r, P, has, S, { lodge: has("wood") ? "wood" : "stone", lodgeRoof: has("roof") ? "roof" : null, kinds: ["shroom", "shrooms", "fern", "stump", "lantern", "rocks"], pools: P.pools });
  const bank = F.bank, gates = F.gates, wood = has("wood") ? "wood" : "stone", leaf = has("tree") ? "tree" : "grass", glow = has("thatch") ? "thatch" : "ink", roofR = has("roof") ? "roof" : leaf;
  // The forest behind: rounded canopies on the horizon, a few dark trunks under them.
  const fy = ri(r, Math.round(ph * 0.35), Math.round(ph * 0.5)); horizon(C, r, fy, leaf, false);
  for (let k = 0, n = ri(r, 2, 4); k < n; k++) { const x = ri(r, 1, pw - 1 - u); C.rect(x, fy + ri(r, 0, sz(2)), x + u - 1, bank - 1, wood, 0); }
  // The great tree: a trunk kw wide from the bank path up, flared roots, a crown of overlapping canopies, vines, glowing
  // windows and a door between two lanterns, glowcaps at its roots.
  const kw0 = ri(r, P.keepW[0], P.keepW[1]), kw = kw0 - ((kw0 + pw) & 1), kcx = mid + pick(r, [-1, 0, 1]) * Math.round(pw * 0.16), kx0 = Math.round(kcx - (kw - 1) / 2), kx1 = kx0 + kw - 1;
  const kTop = ri(r, P.skyMin + sz(3), Math.round(ph * 0.28));
  for (let k = 0, n = ri(r, 3, 4); k < n; k++) C.blob(kcx + (k - (n - 1) / 2) * sz(3.2) + ri(r, -1, 1) + 0.5, kTop - ri(r, 0, sz(1.5)) + 0.5, ri(r, sz(3), sz(4.5)), ri(r, sz(2), sz(2.8)), leaf, 1);
  C.rect(kx0, kTop, kx1, bank - 1, wood, 1);
  for (let k = 1; k <= sz(2); k++) { C.rect(kx0 - k, bank - 1 - sz(2) + k, kx0 - 1, bank - 1, wood, 1); C.rect(kx1 + 1, bank - 1 - sz(2) + k, kx1 + k, bank - 1, wood, 1); }
  // Branches each side with a pod house on the end (a leaf roof, a glowing window).
  const pods = [];
  for (const side of [-1, 1]) for (let lv = 0; lv < ri(r, 1, 2); lv++) { const by = kTop + sz(2.5) + lv * sz(3.5) + ri(r, 0, sz(0.5)), len = ri(r, sz(4), sz(6)), bx0 = side < 0 ? Math.max(sz(1), kx0 - len) : kx1 + 1, bx1 = side < 0 ? kx0 - 1 : Math.min(pw - 1 - sz(1), kx1 + len);
    if (bx1 - bx0 < sz(3) || by > bank - sz(4)) continue;
    C.rect(bx0, by, bx1, by + u - 1, wood, 1); const hw = sz(2.5) | 1, hx = side < 0 ? bx0 : bx1 - hw + 1; C.rect(hx, by - sz(2), hx + hw - 1, by - 1, wood, 1);
    for (let k = 0; k < Math.ceil((hw + 2) / 2); k++) C.rect(hx - 1 + k, by - sz(2) - 1 - k, hx + hw - k, by - sz(2) - 1 - k, roofR, 1);
    C.rect(hx + (hw >> 1), by - sz(1.5), hx + (hw >> 1), by - sz(1.5) + u - 1, glow, 1); pods.push(hx); }
  for (let y = kTop + sz(2); y < bank - sz(5); y += sz(3)) { const x = ri(r, kx0 + sz(1), kx1 - sz(2)); C.rect(x, y, x + u - 1, y + u - 1, glow, 1); }
  if (has("grass")) for (let k = 0, n = ri(r, 2, 4); k < n; k++) { const x = ri(r, kx0, kx1), y0 = kTop - ri(r, 0, sz(1)), y1 = y0 + ri(r, sz(3), sz(7)); C.rect(x, y0, x, y1, "grass", 1); }
  const dw = sz(2), dx0 = Math.round(kcx - dw / 2); arch(C, dx0 + (dw - 1) / 2, dw, bank - 1, sz(3));
  if (has("thatch")) for (const x of [dx0 - sz(1), dx0 + dw]) C.set(x, bank - sz(2.5), "thatch", 1);
  if (has("banner") && has("stone")) for (const x of [kx0 - sz(2) - 1, kx1 + 2]) if (x > 0 && x + 3 < pw) art(C, "shroom", x, bank - 1, 1);
  // The palisade of living stakes left and right of the tree, vines on it, glowcaps on its top.
  const pH = ri(r, P.palH[0], P.palH[1]), pTop = bank - pH;
  for (const [a, b] of [[0, kx0 - sz(3) - 1], [kx1 + sz(3) + 1, pw - 1]]) if (b - a >= sz(2)) { stakes(C, a, b, pTop, bank - 1, wood);
    if (has("grass")) for (let x = a; x <= b; x++) if (r() < 0.3) { const y0 = pTop + ri(r, u, pH - u); C.rect(x, y0, x, Math.min(bank - 1, y0 + u), "grass", 1); }
    if (has("banner") && has("stone") && b - a > sz(4)) art(C, "shroom", ri(r, a, b - 3), pTop - 1, 1); }
  if (P.gates > 1 && gates.length) { const ay = bank - sz(3); C.rect(dx0, ay, dx0 + dw - 1, bank - 1, "iron", 1); const kx = Math.round(kcx) + (r() < 0.5 ? -1 : 1) * ri(r, sz(1), Math.max(sz(1), (kw >> 1) - sz(1))), ky = kTop + sz(1);
    if (C.get(kx, ky) === wood) { C.set(kx, ky, "gilt", 1); gates.push({ at: [dx0, ay], key: [kx, ky] }); } else C.rect(dx0, ay, dx0 + dw - 1, bank - 1, "ink", 1); }
  const tw = 2 * sz(1.5) - 1, nT = P.towers ? ri(r, P.towers[0], P.towers[1]) : 0, spots = [0, pw - tw, kx0 - sz(3) - tw - 1, kx1 + sz(3) + 2];
  const towers = archers(C, r, spots, nT, tw, (i) => pH + (i < 2 ? ri(r, sz(3), sz(5)) : sz(2)), bank, P, leaf, 0);
  sky(C, r, S, Math.floor(ph * 0.25), has, kcx < mid ? 1 : -1);
  return { C, gates, towers, style: (kcx < mid - 1 ? "left" : kcx > mid + 1 ? "right" : "mid") + "-tree" + pods.length + "-" + towers.length + "t" };
}

// v5 R4 fix (the visual critic's S3, S4): the Goblin King on his throne, one cell a letter (h gold, b goblin green, k ink,
// r goblin red): his crown, his face (eyes and grin), his red cloak with a gold clasp and green hands, the gold throne round
// him. 11 x 9 cells. Drawn by the boss (P.king) in the throne keep's hall.
const KING = ["...h.h.h...", "...hhhhh...", "hh.bbbbb.hh", "hh.bkbkb.hh", "hh.bkkkb.hh", "hhrrrbrrrhh", "hrrbrhrbrrh", "hrrrrrrrrrh", "hhhhhhhhhhh"];
// A leaning block x0..x0+w-1 from yTop down to yBase, shifted `lean` a column every sz(3) rows going up (crooked towers).
function leanRect(C, x0, w, yTop, yBase, lean, role) { for (let y = yBase, k = 0; y >= yTop; y--, k++) C.rect(x0 + lean * Math.floor(k / sz(3)), y, x0 + lean * Math.floor(k / sz(3)) + w - 1, y, role, 1); return lean * Math.floor((yBase - yTop) / sz(3)); }
// A spiked red roof (or with no roof role, ragged battlements) on a block x0..x0+w-1 whose top row is yTop, a goblin banner
// on its point.
function spikeRoof(C, r, has, x0, w, yTop, side2) {
  if (has("roof")) { const rh = Math.ceil((w + 2) / 2); for (let k = 0; k < rh; k++) C.rect(x0 - 1 + k, yTop - 1 - k, x0 + w - k, yTop - 1 - k, "roof", 1); if (has("banner")) flagOn(C, x0 + (w >> 1), yTop - 1 - rh, "banner"); return rh; }
  for (let x = x0; x < x0 + w; x += sz(1) * 2) C.rect(x, yTop - ri(r, 1, sz(1)), x + sz(1) - 1, yTop - 1, side2, 1); return sz(1);
}
// The four other fortress families of The Goblin King's Throne (era8 draws the throne hall, and the boss): crooked keeps
// (two or three leaning keeps of odd heights joined by sagging plank bridges over a low wall), a scrap-wall camp (a low
// wall of planks and patches under spikes, goblin tents, a bonfire and a lookout behind), a cliff citadel (a crag of muck
// on one side with a citadel on its top and a plank stair up its face, the wall on the other side) and the gate approach
// (one huge gatehouse between two drum towers, banners down its face, the throne keep's crown peeking over it). Each puts
// its door over the bridge; a second gate is an iron door there, its key in the wall.
function era8b(fam, r, P, has, S, C, F, body, patch, plank) {
  const pw = C.pw, ph = C.ph, mid = (pw - 1) / 2, u = sz(1), bank = F.bank, gates = F.gates, top = P.skyMin + sz(1), side2 = has("ashlar") ? "ashlar" : body;
  const gw = par(sz(4.5), pw), gx = Math.max(sz(3), Math.min(pw - sz(3) - gw, Math.round(F.bx - (gw - 1) / 2))), gcx = gx + (gw - 1) / 2;
  let wTop = bank - ri(r, P.curtainH[0], P.curtainH[1]), doorH = sz(2.5), spots = [0, pw - (2 * sz(1.5) - 1) - 1, sz(8), pw - sz(8) - (2 * sz(1.5) - 1)];
  const patches = (x0, x1, y0, y1, n) => { for (let k = 0; k < n; k++) { const w = ri(r, sz(1.5), sz(3)), x = ri(r, x0, Math.max(x0, x1 - w)), y = ri(r, y0, Math.max(y0, y1 - w)); if (Math.abs(x + w / 2 - gcx) < gw) continue; C.rect(x, y, x + w - 1, y + Math.min(w, sz(1.5)) - 1, r() < 0.5 ? patch : plank, 1); } };
  const wall = (x0, x1) => { C.rect(x0, wTop, x1, bank - 1, body, 1); for (let x = x0; x <= x1; x += u) { const t = ri(r, 0, 2); if (t) C.rect(x, wTop - t, Math.min(x1, x + u - 1), wTop - 1, body, 1); } patches(x0, x1, wTop + u, bank - 1, ri(r, 2, 4)); };
  if (fam === "crooked") {
    wTop = bank - ri(r, sz(2.5), sz(3.5));
    const n = ri(r, 2, 3), slot = pw / n, keeps = [];
    for (let i = 0; i < n; i++) { const w = ri(r, sz(5), sz(7)), x0 = Math.round(slot * i + (slot - w) / 2) + ri(r, -sz(1), sz(1)), kTop = ri(r, top + sz(2), wTop - sz(8)), lean = pick(r, [-1, 1, 0]);
      const dx = leanRect(C, x0, w, kTop, wTop - 1, lean, i === 1 ? body : side2); slits(C, x0 + dx, x0 + dx + w - 1, kTop + sz(2), true); if (wTop - kTop > sz(10)) slits(C, x0 + dx, x0 + dx + w - 1, kTop + sz(6), false);
      spikeRoof(C, r, has, x0 + dx, w, kTop, side2); patches(x0, x0 + w, kTop + sz(3), wTop - sz(2), 1); keeps.push([x0, w, kTop, dx]); }
    for (let i = 0; i + 1 < keeps.length; i++) { const [a, aw] = keeps[i], [b] = keeps[i + 1], y = Math.max(keeps[i][2], keeps[i + 1][2]) + sz(4); for (let x = a + aw; x < b; x++) { const sag = Math.round(Math.sin(((x - a - aw) / Math.max(1, b - a - aw)) * Math.PI) * 1.5); if (!C.sub(x, y + sag)) C.rect(x, y + sag, x, y + sag + u - 1, plank, 1); } }
    wall(0, pw - 1);
  } else if (fam === "camp") {
    wTop = bank - sz(2.5);
    const tr = has("roof") ? "roof" : side2;
    for (let k = 0, n = ri(r, 2, 3), t = 0; k < n && t < 30; t++) { const w = (ri(r, sz(6), sz(8)) | 1), x = ri(r, 0, pw - w); if (C.sub(x, wTop - 1) || C.sub(x + w - 1, wTop - 1) || C.sub(x + (w >> 1), wTop - 1) || C.sub(x + (w >> 1), wTop - (w >> 1))) continue;
      tent(C, x + (w >> 1), wTop - 1, w, tr); C.rect(x + (w >> 1) - (u >> 1), wTop - sz(2), x + (w >> 1) - (u >> 1) + u - 1, wTop - 1, "ink", 1); k++; } // big goblin tents, their doors open
    const lx = r() < 0.5 ? ri(r, sz(1), sz(4)) : ri(r, pw - sz(7), pw - sz(5)), lTop = ri(r, top + sz(2), top + sz(5)); // the lookout on stilts
    if (!C.sub(lx, lTop + sz(3)) && !C.sub(lx + sz(4), lTop + sz(3))) { C.rect(lx, lTop + sz(3), lx + u - 1, wTop - 1, plank, 1); C.rect(lx + sz(4), lTop + sz(3), lx + sz(4) + u - 1, wTop - 1, plank, 1); C.rect(lx - u, lTop + sz(2), lx + sz(5) - 1, lTop + sz(3) - 1, plank, 1); hut(C, lx, sz(5), lTop + sz(2) - 1, sz(1.5), side2, has("roof") ? "roof" : plank, "low"); }
    if (has("thatch")) { const fx = Math.round(mid + pick(r, [-1, 1]) * ri(r, sz(4), sz(7))), fw = sz(3) | 1; C.rect(fx - sz(2), wTop - u, fx + sz(2), wTop - 1, plank, 1); tent(C, fx, wTop - u - 1, fw + 2, "thatch"); if (has("roof")) tent(C, fx, wTop - u - 1, fw - 2, "roof"); } // the bonfire: gold flames round a red heart
    if (has("banner")) for (let k = 0, n = ri(r, 2, 3); k < n; k++) { const x = ri(r, sz(2), pw - sz(4)); if (!C.sub(x, wTop - sz(5)) && !C.sub(x + sz(2), wTop - sz(5))) { C.rect(x, wTop - sz(5), x, wTop - 1, plank, 1); C.rect(x + 1, wTop - sz(5), x + sz(2), wTop - sz(3.5), "banner", 1); } }
    C.rect(0, wTop, pw - 1, bank - 1, plank, 1); patches(0, pw - 1, wTop + u, bank - 1, ri(r, 3, 5));
    for (let x = 0; x < pw; x += sz(2)) C.rect(x, wTop - sz(1), x, wTop - 1, "ink", 1); // the spikes on its top
  } else if (fam === "cliff") {
    const side = pick(r, [-1, 1]), cw = ri(r, Math.round(pw * 0.45), Math.round(pw * 0.55)), crag = has("grass") ? "grass" : side2, cTop = ri(r, top + sz(5), top + sz(7)), keepR = has("ashlar") ? "ashlar" : body;
    // The crag: a jagged slope widening down to the bank path.
    for (let y = cTop, jag = 0; y < bank; y++) { if (((y - cTop) % sz(1.5)) === 0) jag = ri(r, -sz(1), sz(1)); const w = Math.min(pw - sz(8), Math.round(cw * 0.5 + (y - cTop) * 0.55) + jag); if (side < 0) C.rect(0, y, w - 1, y, crag, 1); else C.rect(pw - w, y, pw - 1, y, crag, 1); }
    const kw = ri(r, sz(5), sz(6)), kx = side < 0 ? ri(r, sz(2), Math.max(sz(2), Math.round(cw * 0.5) - kw - sz(2))) : pw - ri(r, sz(2), Math.max(sz(2), Math.round(cw * 0.5) - kw - sz(2))) - kw, kTop = Math.max(top + sz(1), cTop - ri(r, sz(4), sz(6)));
    C.rect(kx, kTop, kx + kw - 1, cTop - 1, keepR, 1); merlons(C, kx, kx + kw - 1, kTop, keepR); slits(C, kx, kx + kw - 1, kTop + sz(1.5), true);
    for (const tx of [kx - sz(1), kx + kw - sz(2) + sz(1)]) { const t2 = sz(2); C.rect(tx, kTop - sz(2), tx + t2 - 1, cTop - 1, keepR, 1); spikeRoof(C, r, has, tx, t2, kTop - sz(2), side2); }
    for (let y = cTop + sz(1), k = 0; y < bank - sz(2); y += sz(2), k++) { const x = side < 0 ? sz(2) + (k % 2) * sz(4) : pw - sz(2) - sz(4) - (k % 2) * sz(4); C.rect(x, y, x + sz(4) - 1, y, plank, 1); } // the plank stair up its face
    const x0 = side < 0 ? cw - sz(2) : 0, x1 = side < 0 ? pw - 1 : pw - cw + sz(2) - 1; wall(x0, x1);
    spots = side < 0 ? [pw - (2 * sz(1.5) - 1) - 1, Math.round(cw * 0.3), pw - sz(8) - (2 * sz(1.5) - 1)] : [0, pw - Math.round(cw * 0.3) - (2 * sz(1.5) - 1), sz(8)];
  } else { // the gate approach
    const kw = ri(r, sz(5), sz(7)), kTop = ri(r, top + sz(1), top + sz(3)), crownH = has("thatch") ? sz(2) : 0;
    C.rect(Math.round(mid - kw / 2), kTop + crownH + sz(1), Math.round(mid + kw / 2), bank - sz(6), body, 1); // the throne keep behind
    if (crownH) { const c0 = Math.round(mid - sz(2.5)), c1 = Math.round(mid + sz(2.5)); C.rect(c0, kTop + crownH, c1, kTop + crownH + u - 1, "thatch", 1); for (let x = c0; x <= c1; x += sz(1.25)) C.rect(x, kTop, x, kTop + crownH, "thatch", 1); }
    const bw = ri(r, sz(10), sz(12)), bx0 = Math.round(gcx - bw / 2), gTop = ri(r, top + sz(6), top + sz(8)), dt = sz(4);
    wall(0, pw - 1);
    C.rect(bx0, gTop, bx0 + bw - 1, bank - 1, side2, 1); merlons(C, bx0, bx0 + bw - 1, gTop, side2);
    for (const tx of [bx0 - dt, bx0 + bw]) { C.rect(tx, gTop - sz(2), tx + dt - 1, bank - 1, body, 1); slits(C, tx, tx + dt - 1, gTop, true); spikeRoof(C, r, has, tx, dt, gTop - sz(2), side2); }
    if (has("banner")) for (const x of [bx0 + sz(1), bx0 + bw - sz(2)]) C.rect(x, gTop + sz(1), x + u - 1, gTop + sz(5), "banner", 1);
    C.rect(bx0 + sz(3), gTop + sz(1), bx0 + bw - sz(3) - 1, gTop + sz(1.5), "ink", 1);
    doorH = sz(4); arch(C, gcx, gw, bank - 1, doorH);
    spots = [0, pw - (2 * sz(1.5) - 1) - 1, bx0 - dt - (2 * sz(1.5) - 1) - 2, bx0 + bw + dt + 2];
  }
  if (fam !== "gate") { C.rect(gx, wTop - sz(1.5), gx + gw - 1, bank - 1, body, 1); merlons(C, gx, gx + gw - 1, wTop - sz(1.5), body); arch(C, gcx, gw - 2 * u, bank - 1, doorH); }
  const dw = fam === "gate" ? gw : gw - 2 * u, dx = Math.round(gcx - (dw - 1) / 2);
  door2(C, r, P, gates, dx, dw, bank - 1, doorH, fam === "camp" ? plank : body, sz(1), pw - sz(2), wTop + u, bank - 2);
  const tw = 2 * sz(1.5) - 1, nT = P.towers ? ri(r, P.towers[0], P.towers[1]) : 0;
  const towers = archers(C, r, spots, nT, tw, (i) => bank - wTop + (i < 2 ? ri(r, sz(3), sz(5)) : sz(2)), bank, P, null, pick(r, [1, -1]));
  sky(C, r, S, Math.floor(ph * 0.2), has, pick(r, [-1, 1]));
  return { C, gates, towers, style: fam + "-" + towers.length + "t" };
}

// Era 8, The Goblin King's Throne: the goblin capital, a crooked fortress of mismatched stone and scrap. A muck moat, a
// curtain whose battlements go up and down, patched with odd stone (ashlar) and scrap plates (planks), crooked towers that
// lean, spikes and goblin banners; the throne keep in the middle, tallest, with the gold crown on top; a storm sky. The boss
// (P.inner): a second, inner moat with its own drawbridge in front of the throne keep.
function era8(r, P, has, S) {
  const pw = ri(r, P.w[0], P.w[1]), ph = ri(r, P.h[0], P.h[1]), C = canvas(pw, ph), mid = (pw - 1) / 2, u = sz(1);
  const F = front(C, r, P, has, S, { lodge: has("wood") ? "wood" : "stone", lodgeRoof: has("roof") ? "roof" : null, kinds: ["spikes", "scrap", "hoard", "gtent", "pole", "rocks"], pools: null });
  const bank = F.bank, gates = F.gates, body = has("stone") ? "stone" : "ashlar", patch = has("ashlar") ? "ashlar" : body, plank = has("wood") ? "wood" : body;
  const cH = ri(r, P.curtainH[0], P.curtainH[1]), cTop = bank - cH;
  if (r() < P.horizon) horizon(C, r, cTop - ri(r, sz(1), sz(3)), has("grass") ? "grass" : body, true);
  const fam = P.inner ? "throne" : P.family || pick(r, P.families || ["throne"]); // v5 R4 fix (S3): five fortress families
  if (fam !== "throne") return era8b(fam, r, P, has, S, C, F, body, patch, plank);
  // The throne keep (tall, the crown on top) and two crooked side keeps, drawn first (the curtain stands in front). The
  // boss's inner moat runs over the curtain's battlements and the gatehouse's.
  let bank2 = cTop - 1;
  const ig = P.innerGap != null ? P.innerGap : sz(3), inner = P.inner && cTop - ig - 1 - P.moatH - sz(4) >= P.skyMin + (has("thatch") ? sz(2) : 0) + sz(1);
  if (inner) { const y1 = cTop - ig - 1, y0 = y1 - P.moatH + 1; const g2 = moat(C, y0, y1, mid + 0.5, par(sz(2.5), pw)); bank2 = y0 - 1; g2.key = null; gates.push(g2); }
  const kw0 = ri(r, P.keepW[0], P.keepW[1]), kw = kw0 - ((kw0 + pw) & 1), kcx = mid + (inner ? 0 : pick(r, [-1, 0, 1]) * sz(2)), crownH = has("thatch") ? sz(2) : 0;
  const kTop = Math.max(P.skyMin + crownH + sz(1), (inner ? bank2 : cTop) - ri(r, P.keepH[0], P.keepH[1]));
  keep(C, "square", kcx, kw, kTop, (inner ? bank2 - 1 : cTop), body, null, null);
  if (crownH) { const cx0 = Math.round(kcx - sz(2.5)), cx1 = Math.round(kcx + sz(2.5)); C.rect(cx0, kTop - sz(1) - u, cx1, kTop - sz(1) - 1 + u - u, "thatch", 1); for (let x = cx0; x <= cx1; x += sz(1.25)) C.rect(x, kTop - sz(1) - crownH, x, kTop - sz(1) - u, "thatch", 1); }
  for (let k = 0, n = ri(r, 2, 4); k < n; k++) { const pwid = ri(r, sz(1.5), sz(3)), px = ri(r, Math.round(kcx - kw / 2) + 1, Math.round(kcx + kw / 2) - pwid - 1), py = ri(r, kTop + sz(2), (inner ? bank2 : cTop) - sz(2)); C.rect(px, py, px + pwid - 1, py + pwid - 1, patch, 1); }
  const kdw = sz(2), kdx = Math.round(kcx - kdw / 2); arch(C, kdx + (kdw - 1) / 2, kdw, (inner ? bank2 - 1 : cTop - 1), sz(2));
  // The throne room's window: a tall arch in the keep's face with the gold throne inside it.
  const kgH = KING.length + 1, kgW = KING[0].length + 2, kgB = (inner ? bank2 : cTop) - 1, kgx = Math.round(kcx - (kgW - 1) / 2);
  if (P.king && has("thatch") && has("banner") && has("roof") && kgB - kgH + 1 >= kTop + 1) { // v5 R4 fix (S4): the boss's hall (its door), the Goblin King on his throne in it
    C.rect(kgx, kgB - kgH + 1, kgx + kgW - 1, kgB, "ink", 1); const KK = { h: "thatch", b: "banner", k: "ink", r: "roof" };
    KING.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== ".") C.set(kgx + 1 + x, kgB - KING.length + 1 + y, KK[row[x]], 1); });
  } else if (has("thatch")) { const ww = sz(3) + 1, wx = Math.round(kcx - (ww - 1) / 2), wy1 = Math.min(kTop + sz(6), (inner ? bank2 : cTop) - sz(1)), wy0 = kTop + sz(2); if (wy1 - wy0 >= sz(2.5)) { C.rect(wx, wy0, wx + ww - 1, wy1, "ink", 1); C.rect(wx + 1, wy0 + 1, wx + ww - 2, wy1, "thatch", 1); C.rect(wx + 2, wy0 + 3, wx + ww - 3, wy1 - 1, "ink", 1); } }
  // Two crooked side towers (odd stone when the level has it) leaning out, red spiked roofs, goblin banners.
  const side2 = has("ashlar") ? "ashlar" : body;
  for (const side of [-1, 1]) { const sw = ri(r, sz(3), sz(4.5)), sx = side < 0 ? Math.round(kcx - kw / 2) - sw - ri(r, sz(1), sz(2)) : Math.round(kcx + kw / 2) + ri(r, sz(1), sz(2)), st = ri(r, kTop + sz(1), kTop + sz(5)), lean = side * pick(r, [1, 1, 0]);
    if (sx < 1 || sx + sw > pw - 2) continue; const yb = inner ? bank2 - 1 : cTop - 1, shift = (k) => lean * Math.floor(k / sz(3));
    for (let y = yb, k = 0; y >= st; y--, k++) C.rect(sx + shift(k), y, sx + shift(k) + sw - 1, y, side2, 1);
    const dx = shift(yb - st); slits(C, sx + dx, sx + dx + sw - 1, st + sz(1.5), true);
    if (has("roof")) { const rh = Math.ceil((sw + 2) / 2); for (let k = 0; k < rh; k++) C.rect(sx + dx - 1 + k + (k > rh / 2 ? lean : 0), st - 1 - k, sx + dx + sw - k + (k > rh / 2 ? lean : 0), st - 1 - k, "roof", 1); if (has("banner")) flagOn(C, sx + dx + (sw >> 1) + lean, st - 1 - rh, "banner"); }
    else for (let x = sx + dx; x < sx + dx + sw; x += u * 2) C.rect(x, st - ri(r, 1, sz(1)), x + u - 1, st - 1, side2, 1); }
  // The curtain: uneven battlements, patches, plank plates and spikes; the gatehouse in the middle.
  const gw = par(sz(4.5), pw), gx = Math.round(mid - (gw - 1) / 2) + (inner ? 0 : pick(r, [-1, 0, 1]) * sz(2)), gcx = gx + (gw - 1) / 2;
  C.rect(0, cTop, pw - 1, bank - 1, body, 1);
  for (let x = 0; x < pw; x += u) { const t = ri(r, 0, 2); if (t) C.rect(x, cTop - t, x + u - 1, cTop - 1, body, 1); }
  for (let k = 0, n = ri(r, 3, 6); k < n; k++) { const pw2 = ri(r, sz(1.5), sz(3)), px = ri(r, 0, pw - pw2), py = ri(r, cTop + u, bank - 1 - pw2); if (Math.abs(px + pw2 / 2 - gcx) < gw) continue; C.rect(px, py, px + pw2 - 1, py + Math.min(pw2, sz(1.5)) - 1, r() < 0.5 ? patch : plank, 1); }
  for (let x = sz(2); x < pw - u; x += ri(r, sz(3), sz(5))) if (Math.abs(x - gcx) > gw / 2 + u) C.rect(x, cTop + sz(1.5), x + u - 1, cTop + sz(2.5) - 1, "ink", 1);
  C.rect(gx, cTop - sz(1.5), gx + gw - 1, bank - 1, body, 1); merlons(C, gx, gx + gw - 1, cTop - sz(1.5), body); arch(C, gcx, gw - 2 * u, bank - 1, sz(2.5));
  const tw = 2 * sz(1.5) - 1, nT = P.towers ? ri(r, P.towers[0], P.towers[1]) : 0, spots = [0, pw - tw - 1, gx - tw - 2, gx + gw + 2, sz(8), pw - sz(8) - tw];
  const towers = archers(C, r, spots, nT, tw, (i) => cH + (inner ? sz(1) : i < 2 ? ri(r, sz(3), sz(5)) : sz(2)), bank, P, null, pick(r, [1, -1]));
  // The second gate: the inner moat's drawbridge (its key in the curtain), else a portcullis in the throne keep's door;
  // the key goes in the curtain's face (after the towers, which may stand there), the first plain wall cell from a seeded
  // side of the gatehouse.
  const ky = cTop + Math.min(sz(3), cH >> 1), dir = r() < 0.5 ? -1 : 1; let kx = -1;
  for (let k = sz(2); k < pw && kx < 0; k++) for (const x of [Math.round(gcx) + dir * k, Math.round(gcx) - dir * k]) if (kx < 0 && x > 0 && x < pw - 1 && C.get(x, ky) === body && C.get(x, ky - 1) === body && C.get(x, ky + 1) === body) kx = x;
  if (kx >= 0 && inner && gates.length && !gates[gates.length - 1].key) { C.set(kx, ky, "gilt", 1); gates[gates.length - 1].key = [kx, ky]; }
  else if (kx >= 0 && !inner && P.gates > 1 && gates.length) { const yb = cTop - 1, ay = yb - sz(2) + 1; C.rect(kdx, ay, kdx + kdw - 1, yb, "iron", 1); C.set(kx, ky, "gilt", 1); gates.push({ at: [kdx, ay], key: [kx, ky] }); }
  sky(C, r, S, Math.floor(ph * 0.2), has, pick(r, [-1, 1]));
  return { C, gates: gates.filter((g) => g.key), towers, style: (inner ? "throne-moat" : "throne") + (P.king ? "-king" : "") + "-" + towers.length + "t" };
}
const ERAS = { 1: era1, 2: era2, 3: era3, 4: era4, 5: era5, 6: era6, 7: era7, 8: era8 }; // v5 R4: 5-8

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
  const E2 = Q.eras[era], want = E2.must.concat(P.must || []).filter((k, i, a) => drop.indexOf(k) < 0 && a.indexOf(k) === i), opt = E2.opt.filter((k) => drop.indexOf(k) < 0 && want.indexOf(k) < 0); // v5 R4: P.must
  for (let i = opt.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opt[i], opt[j]] = [opt[j], opt[i]]; }
  const first = (P.first || E2.first || []).filter((k) => opt.indexOf(k) >= 0); for (const k of first.reverse()) { opt.splice(opt.indexOf(k), 1); opt.unshift(k); }
  for (const k of opt) { if (want.length >= P.colours) break; want.push(k); }
  return want;
}
function castle(era, seed, P, Q) {
  if (era >= 5) P = Object.assign({}, P, { must: (P.towers ? ["slate"] : []).concat(P.gates || P.inner ? ["gilt"] : []) }); // v5 R4: the plan's roles
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
  if (P.liquid && cnt["~"]) L.liquid = P.liquid; // v5 R4: the moat is lava (the page draws it so)
  try { E.compile(Object.assign({ cols: [[], [], [], [], []] }, L)); } catch (e) { if (process.env.CASTLE_DEBUG) console.log("castle: " + e.message); return null; }
  return L;
}

module.exports = { castle, canvas, ERAS };

// ~/.local/opt/node/bin/node tools/castle.js --sheet OUT.png [--era E] [--n N] [--px 6] [--colours K] [--scene S]   a
//   contact sheet of freshly generated castles; --levels FILE [--cols 10] draws that file's boards instead. v5 R4, eras 5-8:
//   --moat 0, --gates N (default 1), --towers A-B (default 2-3; 0 none), --inner (the boss's inner moat) set the plan.
if (require.main === module) {
  const fs = require("fs"), path = require("path"), CV = require("./convert.js"), C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8"));
  const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
  const eras = arg("era") ? [+arg("era")] : [1, 2, 3, 4], n = +arg("n", 6), px = +arg("px", 6), out = arg("sheet", "castles.png"), boards = [];
  if (arg("levels")) boards.push(...JSON.parse(fs.readFileSync(path.resolve(arg("levels")), "utf8")).levels);
  else for (const e of eras) for (let k = 0; k < n; k++) {
    const P = Object.assign({}, C.eras[e].gen, { colours: +arg("colours", C.picture.eras[e].sample || 8) }, arg("scene") ? { scene: arg("scene") } : {});
    if (arg("family")) P.family = arg("family"); // v5 R4 fix: one family only; --boss N: that boss's own picture (bake-config bosses)
    if (arg("boss")) Object.assign(P, C.bosses[arg("boss")].gen);
    if (e >= 5) Object.assign(P, { moat: arg("moat") !== "0", gates: +arg("gates", 1), towers: arg("towers") === "0" ? 0 : (arg("towers") || "2-3").split("-").map(Number) }, arg("inner") ? { inner: true } : {}); // v5 R4: the plan's features
    let L = null; for (let t = 0; t < 40 && !L; t++) L = castle(e, 1000 * e + 37 * k + t, P, C.picture);
    if (!L) { console.log("era " + e + " #" + k + ": none"); continue; }
    boards.push(L); console.log("era " + e + " #" + k + ": " + L.w + "x" + L.h + " " + L.scene + " " + L.style + " colours " + L.roles.length + " minDE " + L.palette.minDE + " faded " + L.palette.minFade + " gates " + L.gates.length + " towers " + L.towers.length);
  }
  const cols = +arg("cols", Math.min(n, 6)), cw = Math.max(...boards.map((L) => L.w)) * px + 8, chh = Math.max(...boards.map((L) => L.h)) * px + 8, rows = Math.ceil(boards.length / cols);
  const W = cols * cw, H = rows * chh, rgb = new Uint8Array(W * H * 3).fill(30);
  boards.forEach((L, k) => { const R = PIC.render(L, px, C.picture.show), x0 = (k % cols) * cw + 4, y0 = ((k / cols) | 0) * chh + 4; for (let y = 0; y < R.h; y++) rgb.set(R.rgb.subarray(y * R.w * 3, (y + 1) * R.w * 3), ((y0 + y) * W + x0) * 3); });
  fs.writeFileSync(out, CV.encode(W, H, rgb)); console.log("wrote " + out);
}
