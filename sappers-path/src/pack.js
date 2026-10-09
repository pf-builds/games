// Sapper's Path v7 lane T (tools/space-v7-notes.md): the shipped level files, packed. The source of truth is the plain
// JSON under tools/build-data/levels/ (levels.json, gallery.json, zen.json: what the bake tools read and write);
// `node tools/pack.js` writes the shipped files in levels/ from it, and the page unpacks each record to exactly the
// object the source holds, less the bake-only fields in DROP (the page never reads them: the notes list the evidence).
// A packed record keeps its keys in order; five fields are stored as strings (an array or object in the source means
// "not packed", so a packed record and a plain one both unpack):
//   grid    run-length over the cells in reading order, a cell equal to the one above written "^" (most of a picture
//           is): each run is its character, then its length when over 1 ("a12^40,"). Needs the record's w and h.
//   shade   its digits as letters (0 -> A, 1 -> B, ...), then run-length, no "^" (shade rows are mostly 0)
//   hidden  run-length ("." and "?")
//   cols    the columns joined by ",", each card its colour as a letter (A + colour), its count, then any more numbers
//           as ".n" ("F26E21B30.1,D33")
//   pal     the colours joined by ";", each "key:rrggbb:name", then ":r:role" or ":s:" and its four shades ("/", empty
//           for none, no "#")
// pack() checks every field it packs by unpacking it again and keeps the plain value when they differ, so an odd record
// still ships (larger), never wrong. UMD like engine.js: the page reads SappersPath.pack, the tools require() it.
// Stage 3 (per-world Zen): stub(recs, i) rebuilds a Zen level's stand-in from the index (levels/zen.pk.json), the
// fields the home, the map and the saves read before its world's file has loaded (see STUB); packWorld/unpackWorld
// shorten a world's own map roads in the index.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).pack = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const FORMAT = 1;
  // Bake-only fields, never shipped (no src/ file or index.html reads them; tools/space-v7-notes.md §3).
  const DROP = ["grade", "convert", "inBand", "edits", "credit", "cant", "exempt", "teaches", "feats", "palette", "deck", "scene", "breach", "wander", "seed", "target", "v6", "mystery"];
  const DROPS = new Set(DROP), same = (a, b) => JSON.stringify(a) === JSON.stringify(b), isNum = (c) => c >= 48 && c <= 57;

  // Run-length over a string with no digits in it (a run: its character, then its length when over 1).
  function rle(s) { let o = ""; for (let i = 0; i < s.length;) { let j = i + 1; while (j < s.length && s[j] === s[i]) j++; o += s[i] + (j - i > 1 ? j - i : ""); i = j; } return o; }
  function unrle(s, max) {
    const out = []; let i = 0;
    while (i < s.length && out.length <= max) { const ch = s[i++]; let k = 0; while (i < s.length && isNum(s.charCodeAt(i))) k = k * 10 + s.charCodeAt(i++) - 48; for (let r = Math.min(k || 1, max + 1 - out.length); r > 0; r--) out.push(ch); }
    return out;
  }
  const rows = (cells, w, h) => { const o = []; for (let y = 0; y < h; y++) o.push(cells.slice(y * w, y * w + w).join("")); return o; };
  // grid: "^" = the cell above.
  function gridPack(g, w) { let s = ""; for (let y = 0; y < g.length; y++) for (let x = 0; x < w; x++) s += y > 0 && g[y][x] === g[y - 1][x] ? "^" : g[y][x]; return rle(s); }
  function gridUnpack(s, w, h) { const c = unrle(s, w * h); for (let i = 0; i < c.length; i++) if (c[i] === "^") c[i] = c[i - w]; return rows(c, w, h); }
  const SH = "ABCDEFGHIJ";
  const shadePack = (r) => rle(r.join("").replace(/[0-9]/g, (d) => SH[d]));
  function shadeUnpack(s, w, h) { const c = unrle(s, w * h); for (let i = 0; i < c.length; i++) { const k = SH.indexOf(c[i]); if (k >= 0) c[i] = String(k); } return rows(c, w, h); }
  const hidPack = (r) => rle(r.join("")), hidUnpack = (s, w, h) => rows(unrle(s, w * h), w, h);
  const colsPack = (C) => C.map((col) => col.map((t) => String.fromCharCode(65 + t[0]) + t[1] + t.slice(2).map((x) => "." + x).join("")).join("")).join(",");
  function colsUnpack(s) {
    return s.split(",").map((col) => { const out = []; let i = 0, cur = null;
      while (i < col.length) { const c = col.charCodeAt(i);
        if (c >= 65 && c <= 90) { cur = [c - 65]; out.push(cur); i++; }
        else if (c === 46) i++; // "." starts a further number
        let k = 0, d = 0; while (i < col.length && isNum(col.charCodeAt(i))) { k = k * 10 + col.charCodeAt(i++) - 48; d++; }
        if (d && cur) cur.push(k); }
      return out; });
  }
  const hex = (c) => (c ? c.slice(1) : "");
  const palPack = (P) => Object.keys(P).map((k) => { const e = P[k]; return k + ":" + hex(e.c) + ":" + e.n + (e.r != null ? ":r:" + e.r : "") + (e.sh ? ":s:" + e.sh.map(hex).join("/") : ""); }).join(";");
  function palUnpack(s) {
    const P = {};
    for (const part of s.split(";")) { const f = part.split(":"), e = { c: "#" + f[1], n: f[2] };
      if (f[3] === "r") e.r = f[4]; else if (f[3] === "s") e.sh = f[4].split("/").map((x) => (x ? "#" + x : null));
      P[f[0]] = e; }
    return P;
  }
  // Each packed field: [pack(value, record), unpack(string, record)], applied only when the source holds that type.
  const CODECS = {
    grid: [(v, L) => gridPack(v, L.w), (s, L) => gridUnpack(s, L.w | 0, L.h | 0), Array.isArray],
    shade: [(v) => shadePack(v), (s, L) => shadeUnpack(s, L.w | 0, L.h | 0), Array.isArray],
    hidden: [(v) => hidPack(v), (s, L) => hidUnpack(s, L.w | 0, L.h | 0), Array.isArray],
    cols: [(v) => colsPack(v), (s) => colsUnpack(s), Array.isArray],
    pal: [(v) => palPack(v), (s) => palUnpack(s), (v) => !!v && typeof v === "object" && !Array.isArray(v)],
  };
  // One record: its keys in order, DROP left out, each codec's field packed when it unpacks to the same value.
  function pack(L) {
    const o = {};
    for (const k of Object.keys(L)) { if (DROPS.has(k)) continue; const v = L[k], C = CODECS[k];
      if (C && C[2](v)) { let p = null; try { p = C[0](v, L); if (!same(C[1](p, L), v)) p = null; } catch (e) { p = null; } o[k] = p == null ? v : p; }
      else o[k] = v; }
    return o;
  }
  // The record as the source holds it, less DROP (a plain record comes back as it is, less DROP).
  function unpack(P) {
    const o = {};
    for (const k of Object.keys(P)) { const v = P[k], C = CODECS[k]; o[k] = C && typeof v === "string" ? C[1](v, P) : v; }
    return o;
  }
  // The source record as the page should see it: DROP left out (the reference unpack(pack(L)) must equal).
  function strip(L) { const o = {}; for (const k of Object.keys(L)) if (!DROPS.has(k)) o[k] = L[k]; return o; }
  // A file {levels: [...]}: every record unpacked (other keys kept).
  const unpackFile = (J) => Object.assign({}, J, { levels: (J && Array.isArray(J.levels) ? J.levels : []).map(unpack) });

  // Stage 3, Zen on demand: a world's records ship in their own file (levels/zen-<k>.pk.json); the index (zen.pk.json)
  // keeps each world's entry as the source has it plus `recs`, what the page reads off a level before its world loads:
  // {file, ids, n, tags (a letter a level, TAGC), era/world/land (one value, or one a level), from (World 1's Gallery
  // ids, when any), shade ("1" for a level with shade rows, when any)}. STUB: the fields a stand-in carries.
  const STUB = ["id", "n", "era", "world", "land", "tag", "from", "shade"], TAGC = { easy: "e", normal: "n", hard: "h", extreme: "x" }, TAGS = { e: "easy", n: "normal", h: "hard", x: "extreme" };
  function recsOf(file, list) {
    const R = { file, ids: list.map((L) => L.id), n: list.map((L) => L.n) }, one = (k) => { const v = list.map((L) => L[k]); return v.every((x) => x === v[0]) ? v[0] : v; };
    for (const k of ["era", "world", "land"]) { const v = one(k); if (v !== undefined) R[k] = v; }
    R.tags = list.every((L) => L.tag === undefined || TAGC[L.tag]) ? list.map((L) => TAGC[L.tag] || "-").join("") : list.map((L) => (L.tag === undefined ? null : L.tag));
    if (list.some((L) => L.from !== undefined)) R.from = list.map((L) => (L.from === undefined ? null : L.from));
    if (list.some((L) => L.shade)) R.shade = list.map((L) => (L.shade ? "1" : "0")).join("");
    return R;
  }
  // The i-th level's stand-in from a world's recs: {id, n, era, world | land, tag, from, shade: true}, stub: true.
  function stub(R, i) {
    const at = (v) => (Array.isArray(v) ? v[i] : v), o = { id: R.ids[i], n: R.n[i], stub: true };
    for (const k of ["era", "world", "land"]) { const v = at(R[k]); if (v !== undefined && v !== null) o[k] = v; }
    const t = typeof R.tags === "string" ? TAGS[R.tags[i]] : R.tags[i]; if (t) o.tag = t;
    if (R.from && R.from[i] != null) o.from = R.from[i];
    if (R.shade && R.shade[i] === "1") o.shade = true;
    return o;
  }
  // A world's own sheets (map.layout, a land installed as a Zen world) in the index: each road, a list of [x, y] pixel
  // points about 12 px apart, as "x,y:" and then each step's dx and dy as one character each (B64, -32..31). A road that
  // doesn't round-trip stays a list.
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function roadPack(R) {
    let o = R[0][0] + "," + R[0][1] + ":";
    for (let i = 1; i < R.length; i++) for (const d of [R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]]) { if (!(d >= -32 && d <= 31) || d !== Math.round(d)) return null; o += B64[d + 32]; }
    return o;
  }
  function roadUnpack(s) {
    const c = s.indexOf(":"), p = s.slice(0, c).split(",").map(Number), out = [[p[0], p[1]]];
    for (let i = c + 1; i + 1 < s.length; i += 2) { const q = out[out.length - 1]; out.push([q[0] + B64.indexOf(s[i]) - 32, q[1] + B64.indexOf(s[i + 1]) - 32]); }
    return out;
  }
  const mapRoads = (w, f) => (w && w.map && Array.isArray(w.map.layout) ? Object.assign({}, w, { map: Object.assign({}, w.map, { layout: w.map.layout.map((S) => (S && S.road ? Object.assign({}, S, { road: f(S.road) }) : S)) }) }) : w);
  const packWorld = (w) => mapRoads(w, (R) => { if (!Array.isArray(R) || !R.length) return R; const s = roadPack(R); return s && same(roadUnpack(s), R) ? s : R; });
  const unpackWorld = (w) => mapRoads(w, (R) => (typeof R === "string" ? roadUnpack(R) : R));
  return { FORMAT, DROP, STUB, pack, unpack, strip, unpackFile, same, recsOf, stub, packWorld, unpackWorld };
});
