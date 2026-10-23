// Sapper's Path: Partial's Pixels, the third play mode (runbook tools/partials-pixels-notes.md; numbers tools/pixels-config.json).
// Every level is one of PartialVoid's original pixel pictures, exactly as drawn: one art pixel is one board cell, her exact
// hex colours are the level's palette, nothing is resampled, cropped, quantized, recoloured, outlined or shaded unless the
// picture's manifest line says so in writing (merge, crop: Peter's approval of a suggestion, recorded in the manifest).
//   ~/.local/opt/node/bin/node tools/partials-pixels.js            check every manifest line, bake the new ones, install, pack
//   ~/.local/opt/node/bin/node tools/partials-pixels.js check      convert and check only (suggestions written; nothing installed)
//   options: --threads N, --extra K (more bake candidates), --rebake ID (deal an installed picture again), --game DIR (another
//   game copy: tests), --config FILE (a config over tools/pixels-config.json: tests)
// Per manifest line ({id, title, file?, tag?, merge?: {"#from": "#to"}, crop?: [x, y, w, h] in cells}), in manifest order
// (picture n = the line's place; lines are only ever appended):
//   read      the PNG (8-bit grey, RGB, palette or with alpha; not interlaced, not 16-bit); every pixel fully opaque
//   grid      the cell size: the gcd of every run of equal pixels along every row and column, so each cell is one flat
//             colour by construction; a picture with no clean grid (a smoothed or resized export) is refused, saying why
//   fit       the manifest's crop and merge applied (positions never move; a colour not named in merge stays exact), then
//             the engine's fit: at most limits.maxColours colours, at most land-config box cells. A picture that doesn't
//             fit is not installed: suggest/<id>.md says what would make it fit (the closest colours to combine by
//             CIEDE2000, the fewest cells first, never a merge that would erase a drawn shape when another will do; or a
//             crop window) with the cells each change touches, and suggest/<id>.png shows the original beside the
//             suggestion. It installs once Peter writes the change into its manifest line.
//   board     the picture inside the game's 1-cell frame (open ground, the entry gate in the bottom row: outside the art),
//             one palette key per colour (by cell count), her hex as its colour, no shade rows
//   bake      tools/land-bake.js bakeOne on that board (deck only: ? cards and linked pairs never change the picture; no
//             mystery blocks, moats, gates, towers or locks), the tag from the config's turn or the line
//   check     the Zen gates (compiles and E.check clean, the stored order wins with no power-up, 5 spaces, the longest tap
//             and the taps under the caps, the steady replay, real pace in range, the careful floor, no fallback, the
//             density rule, a re-grade at 0 differences) and THE ART GATE: every picture cell of the record, read
//             through its palette, is the source PNG's cell colour (after the manifest's merge), cell for cell
//   install   the records and the mode's one world (its map sheets worked out from the count) into the source
//             tools/build-data/levels/pixels.json, its LICENSES.md section rewritten, then the shipped
//             levels/pixels.pk.json and levels/pixels-<k>.pk.json (tools/pack.js pixelsFiles)
// An installed picture whose art, merge, crop or tag hasn't changed keeps its record byte for byte.
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const E = require("../src/engine.js");
const R = require("./grade.js");
const PIC = require("./pic.js");
const V = require("./convert.js");
const PAL = require("./palette.js");
const LP = require("./land-plan.js");
const LB = require("./land-bake.js");
const TG = require("./tags.js");
const { regrade } = require("./regrade.js");

const ROOT = path.join(__dirname, "..");
const argv = process.argv.slice(2), flag = (k) => argv.indexOf("--" + k) >= 0, opt = (k) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : null; };
const readJ = (f) => JSON.parse(fs.readFileSync(f, "utf8")), writeJ = (f, o, pretty) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify(o, null, pretty ? 1 : 0) + "\n"); fs.renameSync(t, f); };
const hex2 = (v) => (v < 16 ? "0" : "") + v.toString(16), hexOf = (r, g, b) => "#" + hex2(r) + hex2(g) + hex2(b), gcd = (a, b) => { while (b) { const t = a % b; a = b; b = t; } return a; };
const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13]; // the palette keys a picture may use (tools/convert.js IDS: never iron 10 or gilt 14)
const de = (a, b) => PAL.de00(PAL.lab(a), PAL.lab(b));

// ---- the context ---------------------------------------------------------------------------------------------------------
// game: the game folder (default this one); cfg: tools/pixels-config.json with --config's file merged over it.
function context(o) {
  o = o || {}; const GAME = path.resolve(o.game || opt("game") || ROOT), over = o.config || (opt("config") ? readJ(path.resolve(opt("config"))) : null);
  const C = LP.merge(readJ(path.join(__dirname, "pixels-config.json")), over || {}), LC = require("./land-config.json"), at = (p) => path.resolve(GAME, p);
  return { GAME, C, LC, CV: V.config().convert, P: LP.merge(LC.profile, C.profile), art: at(C.paths.art), man: at(C.paths.manifest), sug: at(C.paths.suggest), scr: at(C.paths.scratch), src: at(C.paths.source), CFG: readJ(path.join(GAME, "config.json")) };
}

// ---- the PNG ----------------------------------------------------------------------------------------------------------
// Any 8-bit PNG (grey, grey + alpha, RGB, RGBA) or a palette PNG of 1, 2, 4 or 8 bits (with tRNS), not interlaced -> {w, h,
// rgba}. Throws a plain sentence when it can't read one.
function readPNG(buf, maxPx) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) throw new Error("not a PNG file");
  let o = 8, w = 0, h = 0, bd = 0, ct = -1, il = 0, plte = null, trns = null; const idat = [];
  for (let g = 0; o + 8 <= buf.length && g < 1000000; g++) {
    const len = buf.readUInt32BE(o), type = buf.toString("ascii", o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; il = d[12]; } else if (type === "PLTE") plte = d; else if (type === "tRNS") trns = d; else if (type === "IDAT") idat.push(d); else if (type === "IEND") break;
    o += 12 + len;
  }
  const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  if (!CH) throw new Error("a PNG colour type this tool doesn't read (" + ct + ")");
  if (il) throw new Error("an interlaced PNG: save it again without interlacing");
  if (ct === 3 ? [1, 2, 4, 8].indexOf(bd) < 0 : bd !== 8) throw new Error("a " + bd + "-bit PNG: save it as 8-bit");
  if (ct === 3 && !plte) throw new Error("a palette PNG with no palette");
  if (!w || !h || w > maxPx || h > maxPx) throw new Error("a " + w + "x" + h + " px picture (this tool reads up to " + maxPx + " px a side)");
  const bits = CH * bd, bpp = Math.max(1, bits >> 3), stride = Math.ceil((w * bits) / 8), raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length < h * (stride + 1)) throw new Error("a PNG cut short");
  const out = new Uint8Array(w * h * 4), prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) { const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      cur[i] = (row[i] + (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
    for (let x = 0; x < w; x++) {
      const q = (y * w + x) * 4; let r, g, b, al = 255;
      if (ct === 3) { const k = (cur[(x * bd) >> 3] >> (8 - bd - ((x * bd) & 7))) & ((1 << bd) - 1); if (k * 3 + 2 >= plte.length) throw new Error("a palette index past the palette"); r = plte[k * 3]; g = plte[k * 3 + 1]; b = plte[k * 3 + 2]; if (trns && k < trns.length) al = trns[k]; }
      else if (ct === 0 || ct === 4) { r = g = b = cur[x * CH]; if (ct === 4) al = cur[x * CH + 1]; else if (trns && trns.length >= 2 && r === trns.readUInt16BE(0)) al = 0; }
      else { r = cur[x * CH]; g = cur[x * CH + 1]; b = cur[x * CH + 2]; if (ct === 6) al = cur[x * CH + 3]; else if (trns && trns.length >= 6 && r === trns.readUInt16BE(0) && g === trns.readUInt16BE(2) && b === trns.readUInt16BE(4)) al = 0; }
      out[q] = r; out[q + 1] = g; out[q + 2] = b; out[q + 3] = al;
    }
    prev.set(cur);
  }
  return { w, h, rgba: out };
}

// The cell grid: the gcd of every run of equal pixels along every row and every column (so every s x s cell is one flat
// colour), and each cell's hex. -> {s, pw, ph, cells: [hex, row by row]}. Throws on any see-through pixel.
function gridOf(img) {
  const { w, h, rgba } = img; let see = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) see++;
  if (see) throw new Error(see + " see-through pixel" + (see === 1 ? "" : "s") + ": every pixel must be solid (fill the background with a colour)");
  const same = (p, q) => rgba[p] === rgba[q] && rgba[p + 1] === rgba[q + 1] && rgba[p + 2] === rgba[q + 2];
  let s = gcd(w, h);
  for (let y = 0; y < h && s > 1; y++) { let run = 1; for (let x = 1; x < w; x++) { if (same((y * w + x) * 4, (y * w + x - 1) * 4)) run++; else { s = gcd(s, run); run = 1; } } s = gcd(s, run); }
  for (let x = 0; x < w && s > 1; x++) { let run = 1; for (let y = 1; y < h; y++) { if (same((y * w + x) * 4, ((y - 1) * w + x) * 4)) run++; else { s = gcd(s, run); run = 1; } } s = gcd(s, run); }
  const pw = w / s, ph = h / s, cells = new Array(pw * ph);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const q = (y * s * w + x * s) * 4; cells[y * pw + x] = hexOf(rgba[q], rgba[q + 1], rgba[q + 2]); }
  return { s, pw, ph, cells };
}
const countsOf = (cells) => { const m = new Map(); for (const c of cells) m.set(c, (m.get(c) || 0) + 1); return m; };
const boxOf = (X, n) => (n >= X.LC.box.manyAt ? X.LC.box.many : X.LC.box.box); // the largest picture inside the frame (land-config box)

// ---- convert: one manifest line to a picture, or a fit problem with its suggestion ------------------------------------
// -> {line, n, file, s, pw, ph, cells (after crop and merge), colours: [[hex, cells]] (most first), hash, problems: [],
// suggest: {kind, ...} | null, grid: the PNG's own grid}. A problem with no suggestion (a broken file, no clean grid, a bad
// merge or crop) refuses the picture outright.
function convert(X, line, n) {
  const out = { line, n, problems: [], suggest: null };
  const file = line.file || (fs.existsSync(X.art) ? fs.readdirSync(X.art).filter((f) => /\.png$/i.test(f) && (f === line.id + ".png" || f.indexOf(line.id + "-") === 0)) : [])[0];
  if (!line.id || !/^[a-z0-9-]{1,40}$/.test(line.id)) { out.problems.push("the manifest line needs an id of lowercase letters, digits and dashes"); return out; }
  if (!line.title) out.problems.push("the manifest line needs a title");
  if (!file || !fs.existsSync(path.join(X.art, file))) { out.problems.push("no PNG for " + line.id + " in " + path.relative(X.GAME, X.art) + " (name it " + line.id + "-<words>.png, or give the line a file)"); return out; }
  out.file = file; let img, G;
  try { img = readPNG(fs.readFileSync(path.join(X.art, file)), X.C.limits.maxPx); G = gridOf(img); } catch (e) { out.problems.push(file + ": " + e.message); return out; }
  out.px = [img.w, img.h]; out.s = G.s; out.grid = G;
  const raw = countsOf(G.cells), box = boxOf(X, Math.min(raw.size, X.C.limits.maxColours));
  if (G.s === 1 && (G.pw > box[0] || G.ph > box[1])) { out.problems.push(file + ": no clean pixel grid (" + img.w + "x" + img.h + " px, " + raw.size + " colours; its cells come out 1 px, too many for the board). A pixel picture exported with smoothing or resized to a size that isn't a whole multiple blends its edges: export it at a whole-number scale with no smoothing."); return out; }
  // The manifest's crop (in cells; positions inside it never move), then its merge.
  let pw = G.pw, ph = G.ph, cells = G.cells;
  if (line.crop) { const [x0, y0, cw, ch] = line.crop; if (![x0, y0, cw, ch].every((v) => Number.isInteger(v) && v >= 0) || !cw || !ch || x0 + cw > pw || y0 + ch > ph) { out.problems.push("crop " + JSON.stringify(line.crop) + " is not a window inside the " + pw + "x" + ph + " grid"); return out; }
    const c2 = []; for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) c2.push(cells[(y0 + y) * pw + x0 + x]); cells = c2; pw = cw; ph = ch; }
  const have = countsOf(cells), M = {};
  for (const [a, b] of Object.entries(line.merge || {})) { const f = String(a).toLowerCase(), t = String(b).toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(f) || !/^#[0-9a-f]{6}$/.test(t)) { out.problems.push("merge " + a + " -> " + b + ": colours are written #rrggbb"); continue; }
    if (!have.has(f)) out.problems.push("merge " + f + " -> " + t + ": " + f + " is not in the picture"); else if (!have.has(t)) out.problems.push("merge " + f + " -> " + t + ": " + t + " is not in the picture (merge into one of its own colours)"); else M[f] = t; }
  for (const t of Object.values(M)) if (M[t]) out.problems.push("merge: " + t + " is merged into and merged away; merge each colour straight into the one it becomes");
  if (out.problems.length) return out;
  cells = cells.map((c) => M[c] || c);
  const cnt = countsOf(cells), colours = [...cnt.entries()].sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1));
  Object.assign(out, { pw, ph, cells, colours, merge: Object.keys(M).length ? M : null, crop: line.crop || null });
  out.hash = crypto.createHash("sha1").update(JSON.stringify([pw, ph, cells, line.tag || null, line.title])).digest("hex").slice(0, 16);
  const B = boxOf(X, colours.length);
  if (colours.length > X.C.limits.maxColours) out.suggest = suggestColours(X, out);
  else if (pw > B[0] || ph > B[1]) out.suggest = suggestCrop(X, out, B);
  return out;
}
// The share of colour a's edge (4-neighbour sides from an a cell to another colour inside the picture) that touches b.
function edgeShare(cells, pw, ph, a, b) {
  let all = 0, hit = 0;
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { if (cells[y * pw + x] !== a) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= pw || Y >= ph) continue; const c = cells[Y * pw + X]; if (c === a) continue; all++; if (c === b) hit++; } }
  return all ? hit / all : 0;
}
// Too many colours: merge a pair at a time until it fits, each time the closest pair (CIEDE2000, a tenth apart counts the
// same), the colour with fewer cells into the other, a pair that would erase a drawn shape (either colour's edgeShare with
// the other at or over suggest.edgeShare: one sits inside the other, like an eye in a face) only when nothing else is left.
function suggestColours(X, cv) {
  let cells = cv.cells.slice(); const steps = [], cap = X.C.limits.maxColours, ES = X.C.suggest.edgeShare;
  for (let guard = 0; guard < 64; guard++) {
    const cnt = countsOf(cells); if (cnt.size <= cap) break;
    const cs = [...cnt.keys()], cand = [];
    for (const a of cs) for (const b of cs) { if (a === b) continue; const e = Math.max(edgeShare(cells, cv.pw, cv.ph, a, b), edgeShare(cells, cv.pw, cv.ph, b, a)); cand.push({ from: a, to: b, cells: cnt.get(a), dE: +de(a, b).toFixed(1), edge: +e.toFixed(2), erase: e >= ES && de(a, b) >= X.C.suggest.shapeDE }); } // either way round (twins nearer than shapeDE are never a drawn shape): an eye merged into its face or the face into its eye, the eye is gone
    cand.sort((p, q) => p.erase - q.erase || p.dE - q.dE || p.cells - q.cells || (p.from < q.from ? -1 : 1));
    const pk = cand[0]; steps.push(pk); cells = cells.map((c) => (c === pk.from ? pk.to : c));
    for (const st of steps) if (st.to === pk.from) st.to = pk.to; // an earlier merge into the colour just merged away goes straight to the new one
  }
  const merge = {}; for (const st of steps) merge[st.from] = st.to;
  return { kind: "colours", steps, merge, after: cells, have: cv.colours.length, cap };
}
// Too big: the window of the largest board size that keeps the most cells unlike the picture's commonest edge colour (its
// background, as far as a tool can tell), first in reading order among equals. A summed-area table, so any size is quick.
function suggestCrop(X, cv, B) {
  const { pw, ph, cells } = cv, edge = countsOf(cells.filter((c, i) => { const x = i % pw, y = (i / pw) | 0; return x === 0 || y === 0 || x === pw - 1 || y === ph - 1; })), bg = [...edge.entries()].sort((p, q) => q[1] - p[1])[0][0];
  const cw = Math.min(pw, B[0]), ch = Math.min(ph, B[1]), S = new Int32Array((pw + 1) * (ph + 1));
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) S[(y + 1) * (pw + 1) + x + 1] = (cells[y * pw + x] !== bg ? 1 : 0) + S[y * (pw + 1) + x + 1] + S[(y + 1) * (pw + 1) + x] - S[y * (pw + 1) + x];
  let best = null;
  for (let y = 0; y + ch <= ph; y++) for (let x = 0; x + cw <= pw; x++) { const k = S[(y + ch) * (pw + 1) + x + cw] - S[y * (pw + 1) + x + cw] - S[(y + ch) * (pw + 1) + x] + S[y * (pw + 1) + x]; if (!best || k > best.k) best = { k, x, y }; }
  const total = cells.filter((c) => c !== bg).length;
  return { kind: "crop", crop: [best.x, best.y, cw, ch], keeps: best.k, total, bg, box: B, size: [pw, ph] };
}
// The suggestion's two files: suggest/<id>.md (what and why, the exact manifest change) and suggest/<id>.png (the original
// beside the suggestion, previewPx px a cell, a 2-cell gap; a crop's window outlined).
function writeSuggest(X, cv) {
  const S = cv.suggest, k = X.C.suggest.previewPx, id = cv.line.id, gap = 2 * k, rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const W = cv.pw * k * 2 + gap, H = cv.ph * k, px = new Uint8Array(W * H * 3).fill(255), put = (x, y, h) => { const c = rgb(h), q = (y * W + x) * 3; px[q] = c[0]; px[q + 1] = c[1]; px[q + 2] = c[2]; };
  const paint = (cells, ox) => { for (let y = 0; y < cv.ph; y++) for (let x = 0; x < cv.pw; x++) for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) put(ox + x * k + i, y * k + j, cells[y * cv.pw + x]); };
  paint(cv.cells, 0);
  if (S.kind === "colours") { paint(S.after, cv.pw * k + gap); // each changed cell outlined, so the merge shows (critic m5)
    for (let y = 0; y < cv.ph; y++) for (let x = 0; x < cv.pw; x++) { if (S.after[y * cv.pw + x] === cv.cells[y * cv.pw + x]) continue; const ox = cv.pw * k + gap + x * k, oy = y * k; for (let i = 0; i < k; i++) { put(ox + i, oy, "#ff00ff"); put(ox + i, oy + k - 1, "#ff00ff"); put(ox, oy + i, "#ff00ff"); put(ox + k - 1, oy + i, "#ff00ff"); } } }
  else { paint(cv.cells.map((c, i) => { const x = i % cv.pw, y = (i / cv.pw) | 0, [x0, y0, w, h] = S.crop; return x >= x0 && y >= y0 && x < x0 + w && y < y0 + h ? c : "#ffffff"; }), cv.pw * k + gap);
    const [x0, y0, w, h] = S.crop, ox = cv.pw * k + gap; for (let i = 0; i < w * k; i++) for (const y of [y0 * k, (y0 + h) * k - 1]) put(ox + x0 * k + i, y, "#ff00ff"); for (let j = 0; j < h * k; j++) for (const x of [x0 * k, (x0 + w) * k - 1]) put(ox + x, y0 * k + j, "#ff00ff"); }
  fs.mkdirSync(X.sug, { recursive: true }); fs.writeFileSync(path.join(X.sug, id + ".png"), V.encode(W, H, px));
  const md = ["# " + cv.line.title + " (" + id + "): it doesn't fit as drawn", "", "Not installed. Made by `tools/partials-pixels.js` on " + new Date().toISOString().slice(0, 10) + " from `" + cv.file + "` (" + cv.px.join("x") + " px, " + cv.s + " px a cell, " + cv.pw + "x" + cv.ph + " cells).", ""];
  if (S.kind === "colours") {
    md.push("It has " + S.have + " colours; the game takes " + S.cap + ". Combining these makes it fit (closest colours first by CIEDE2000, the colour with fewer cells into the other; a merge marked *erases a shape* paints over something drawn inside the colour it becomes, so it is used only when nothing else is left). Every other colour stays exactly as drawn and no pixel moves.", "",
      "| Merge | Into | Cells changed | ΔE00 | Edge shared by the pair (the larger share) |", "|---|---|---|---|---|");
    for (const st of S.steps) md.push("| " + st.from + " | " + st.to + " | " + st.cells + " | " + st.dE + " | " + Math.round(100 * st.edge) + "%" + (st.erase ? " (erases a shape)" : "") + " |");
    md.push("", "Preview: `" + id + ".png` (left as drawn, right with the merges, each changed cell outlined in magenta). To approve it, add this to the picture's line in the manifest, then run the tool again:", "", "```json", '"merge": ' + JSON.stringify(S.merge), "```");
  } else {
    md.push("It is " + S.size.join("x") + " cells; the board takes at most " + S.box.join("x") + " (wide x tall). The window below keeps " + S.keeps + " of its " + S.total + " cells that aren't its background colour " + S.bg + "; nothing is resized or recoloured.", "",
      "Preview: `" + id + ".png` (left as drawn, right the window, outlined). To approve it, add this to the picture's line in the manifest (x, y, width, height in cells), then run the tool again:", "", "```json", '"crop": ' + JSON.stringify(S.crop), "```");
  }
  fs.writeFileSync(path.join(X.sug, id + ".md"), md.join("\n") + "\n");
}

// ---- board, plan, bake --------------------------------------------------------------------------------------------------
// The picture in the game's frame: one key per colour (most cells first), her hex as its colour, a plain name for the
// screen reader (tools/convert.js nameAll; names only, never a colour).
function boardOf(X, cv) {
  const hexes = cv.colours.map((c) => c[0]), names = V.nameAll(hexes, X.CV), pal = {}, keyOf = new Map();
  hexes.forEach((h, i) => { pal[IDS[i]] = { c: h, n: names[i] }; keyOf.set(h, IDS[i]); });
  const F = PIC.frame((x, y) => E.chOf(keyOf.get(cv.cells[y * cv.pw + x])), cv.pw, cv.ph, X.CV);
  return { w: F.w, h: F.h, grid: F.grid, pal, ink: 0, bg: 0 };
}
// A picture's real-pace range and aim (config paceByCells): the profile's, its floor and aim scaled by the picture's cells
// against ref, never under floor of them; the upper bound stays.
const paceOf = (X, cells) => { const P = X.P.pace, B = X.C.paceByCells, k = B ? Math.max(B.floor, Math.min(1, cells / B.ref)) : 1; return { range: [Math.round(P.range[0] * k), P.range[1]], aim: Math.round(P.aim * k) }; };
const tagOf = (X, cv) => cv.line.tag || X.C.tags[(cv.n - 1) % X.C.tags.length];
// The deck plan for a tag (config plan): ? cards and linked pairs only.
function planOf(X, tag) { const q = X.C.plan[tag] || { mystery: 0, links: 0 }, feats = []; if (q.mystery) feats.push("mystery"); if (q.links) feats.push("linked"); return { feats, mystery: q.mystery | 0, links: q.links | 0, hidden: 0, lock: false, tag }; }
const of = (o, t) => (o && o[t] != null ? o[t] : null);
function jobOf(X, cv, board) {
  const t = tagOf(X, cv), P = X.P;
  return { n: X.C.seed + cv.n, tag: t, plan: planOf(X, t), band: P.bands[t], look: of(P.lookahead, t), care: of(P.careful, t), careTune: of(P.carefulTune || P.careful, t), mysRows: (P.features.mystery || {}).rows || null, over: P.bake || null, obv: of(P.obvious, t), careLo: of(P.carefulFloor, t), pace: paceOf(X, cv.pw * cv.ph), board, extra: +opt("extra") || 0, noHidden: true };
}

// ---- the record and its checks -------------------------------------------------------------------------------------------
function recordOf(X, cv, board, r) {
  const W = X.C.world, L = r.level;
  return Object.assign({ id: W.prefix + W.k + "-" + cv.n, n: cv.n, era: W.era, world: W.k, source: "pixels", title: cv.line.title, kind: "pixel", src: cv.line.id, credit: W.by, by: W.by, tag: r.tag, band: r.tag, target: X.P.bands[r.tag], seed: r.seed,
    w: L.w, h: L.h, grid: L.grid, pic: true, pal: board.pal, cols: L.cols }, L.links ? { links: L.links } : {},
    { win: L.win, grade: L.grade, inBand: r.inBand, convert: Object.assign({ file: cv.file, cellPx: cv.s, cells: cv.pw + "x" + cv.ph, colours: cv.colours.length, minDE: minDE(cv), hash: cv.hash }, cv.merge ? { merge: cv.merge } : {}, cv.crop ? { crop: cv.crop } : {}), feats: r.plan.feats },
    r.mystery ? { mystery: r.mystery } : {}, r.fallback ? { fallback: r.fallback } : {});
}
const minDE = (cv) => { let m = Infinity; const h = cv.colours.map((c) => c[0]); for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) m = Math.min(m, de(h[i], h[j])); return h.length > 1 ? +m.toFixed(1) : null; };
// THE ART GATE: the record's picture (inside its 1-cell frame) read through its palette, cell for cell, against the
// source's cells (after the manifest's merge and crop) -> {match, total, bad: [first few], ok}. Also: the palette is exactly
// the picture's colours, no shade rows, no mystery blocks, no water, gates, towers, keys or lock, nothing else in the frame
// but open ground and the entry gate.
function artCheck(L, cv) {
  const bad = [], pw = L.w - 2, ph = L.h - 2; let match = 0;
  if (pw !== cv.pw || ph !== cv.ph) return { match: 0, total: cv.pw * cv.ph, ok: false, bad: ["board " + pw + "x" + ph + " for a " + cv.pw + "x" + cv.ph + " picture"] };
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const m = E.matOf(L.grid[y + 1][x + 1]), c = m && L.pal[m] ? L.pal[m].c : null; if (c === cv.cells[y * pw + x]) match++; else if (bad.length < 5) bad.push(x + "," + y + ": " + c + " for " + cv.cells[y * pw + x]); }
  const pal = Object.values(L.pal).map((e) => e.c).sort().join(), want = cv.colours.map((c) => c[0]).sort().join();
  if (pal !== want) bad.push("palette " + pal + " for the picture's " + want);
  if (Object.values(L.pal).some((e) => e.sh || e.r != null)) bad.push("palette shades or roles");
  for (const k of ["shade", "hidden", "hideC", "liquid", "gates", "towers", "lock", "locks", "archers"]) if (L[k] != null) bad.push("has " + k);
  L.grid.forEach((row, y) => { for (let x = 0; x < L.w; x++) { const edge = x === 0 || y === 0 || x === L.w - 1 || y === L.h - 1, ch = row[x]; if (edge && ch !== "," && ch !== "#") bad.push("frame " + x + "," + y + " is " + ch); } });
  return { match, total: pw * ph, ok: match === pw * ph && bad.length === 0, bad };
}
function check(X, LV, CVs) {
  const V3 = X.CFG.v3, BC = require("./bake-config.json"), BK = X.LC.bake, rules = (t) => E.rulesOf(V3, t), gates = [], gate = (name, bad, info) => gates.push({ name, ok: !bad.length, bad, info: info || "" });
  const each = (f) => LV.map((L) => { try { const w = f(L); return w ? L.id + ": " + w : null; } catch (e) { return L.id + ": " + e.message; } }).filter(Boolean), W = X.C.world;
  gate("ids " + W.prefix + W.k + "-<n>, numbered in manifest order", LV.every((L, i) => L.id === W.prefix + W.k + "-" + (i + 1) && L.n === i + 1 && L.world === W.k && L.era === W.era && L.by === W.by) ? [] : ["numbering"]);
  const art = LV.map((L, i) => artCheck(L, CVs[i])), cells = art.reduce((a, r) => a + r.total, 0), hits = art.reduce((a, r) => a + r.match, 0);
  gate("THE ART: every picture cell is the source PNG's cell colour, exactly (" + hits + " / " + cells + " cells)", art.flatMap((r, i) => (r.ok ? [] : [LV[i].id + ": " + r.match + "/" + r.total + " " + r.bad.slice(0, 3).join("; ")])), hits + " / " + cells);
  gate("compiles, E.check clean", each((L) => { E.compile(L); const w = E.check(L); return w.length ? w.join(", ") : null; }));
  gate("the stored order wins on its tag, no power-up", each((L) => (E.replay(E.compile(L), rules(L.tag), L.win[L.tag] || "").status === E.WON && !rules(L.tag).powers ? null : "does not win")));
  gate("5 spaces, at most that many in use", each((L) => { const ln = R.line(E.compile(L), rules(L.tag), L.win[L.tag]); return V3.rules.hold === 5 && ln.peak <= 5 ? null : "peak " + ln.peak; }));
  gate("longest tap <= " + BK.maxWaitMs / 1000 + " s, <= " + BK.maxTaps + " taps", each((L) => { const g = L.grade[L.tag]; return g.maxWait <= BK.maxWaitMs && L.win[L.tag].length <= BK.maxTaps ? null : "wait " + g.maxWait + ", taps " + L.win[L.tag].length; }));
  gate("the steady 1 s replay: every thinking replay wins, no wait between taps over " + BK.maxWaitMs / 1000 + " s", each((L) => { const g = L.grade[L.tag]; return g.steady && !g.steady.lost && g.steady.gap <= BK.maxWaitMs && (g.thinks || []).every((v) => v) ? null : "steady " + JSON.stringify([g.thinks, g.steady]); }));
  gate("real pace in the picture's range (the profile's " + X.P.pace.range.map((v) => v / 1000).join("-") + " s, its floor scaled by the cells: paceByCells)", each((L) => { const p = L.grade[L.tag].pace, pr = paceOf(X, (L.w - 2) * (L.h - 2)).range; return p && !p.fell && p.ms >= pr[0] && p.ms <= pr[1] ? null : "pace " + (p ? Math.round(p.ms / 1000) + " s" : "-") + " outside " + pr.map((v) => Math.round(v / 1000)).join("-") + " s"; }));
  const CF = X.P.carefulFloor || {}; gate("the careful player at or over the floor per tag", each((L) => (CF[L.tag] == null || L.grade[L.tag].careful >= CF[L.tag] ? null : "careful " + L.grade[L.tag].careful)));
  gate("no fallback picks", LV.filter((L) => L.fallback).map((L) => L.id + ": " + L.fallback));
  gate("the density rule (deck features only: ? cards, linked pairs)", each((L) => (TG.landDensityOK(L.tag, L, ["mystery", "linked"], X.CFG.v5.density) ? null : L.tag + " [" + TG.featuresOf(L).join(",") + "]")));
  gate("Zen rules: no mystery blocks, moats, locks or Extreme", LV.filter((L) => L.hidden || L.hideC || L.lock || L.tag === "extreme" || L.grid.some((r) => /[~]/.test(r))).map((L) => L.id));
  const rg = regrade(LV, BC, V3, false); gate("re-grade with the grader's own counts: 0 differences (" + rg.checks + " checks)", rg.lines);
  return { ok: gates.every((g) => g.ok), gates, hits, cells };
}

// ---- the world, the source file, the licence rows ------------------------------------------------------------------------
// The mode's map: the config's sheets in turn (A, B, A', B', ...), perSheet levels each on their first spots, every sheet
// but the first crossfaded, eggs at the painted spurs' tips, all under the tint; the last sheet, when not full, says tail (the
// page puts the frontier's fog at its next spot, so no long empty road shows past the last picture). Worked out again from
// the count on install.
function sheetsOf(X, count) {
  const M = X.C.map, out = []; let n = 1, kinds = 0;
  for (let e = 0; n <= count && e < 64; e++) { const from = M.sheets[e % M.sheets.length], k = Math.min(M.perSheet, count - n + 1), eg = M.eggKinds;
    out.push(Object.assign({ from }, Math.floor(e / M.sheets.length) % 2 === 1 ? { mirror: true } : {}, e ? { fade: true } : {}, { levels: [n, n + k - 1], spots: Array.from({ length: k }, (_, i) => i), eggsAt: "quests", eggKinds: [eg[kinds % eg.length], eg[(kinds + 1) % eg.length]], tint: M.tint }, n + k - 1 === count && k < M.perSheet ? { tail: true } : {}));
    kinds += 2; n += k; }
  return out;
}
function worldOf(X, count) { const W = X.C.world; return { k: W.k, name: W.name, lore: W.lore, era: W.era, credit: W.credit, map: { note: "tools/partials-pixels.js: castle sheets " + X.C.map.sheets.join(" and ") + " reused in turn (no new image bytes) under the mode's own tint, " + X.C.map.perSheet + " pictures a sheet, eggs at the painted spurs' tips; worked out from the count on every install.", sheets: sheetsOf(X, count) } }; }
// Every level spot and egg on the mode's sheets 48 CSS px apart at a 375 px phone, and a spot for every picture.
function sheetsCheck(X, count) {
  const LAY = readJ(path.join(X.GAME, "map/layout.json")), k375 = 375 / LAY.w, bad = [];
  for (const m of sheetsOf(X, count)) { const S = LAY.sheets[m.from - 1]; if (!S) { bad.push("no layout sheet " + m.from); continue; } const sp = m.spots.map((i) => S.levels[i]);
    if (sp.some((p) => !p)) bad.push("sheet " + m.from + ": " + m.spots.length + " spots for " + S.levels.length);
    const pts = sp.filter(Boolean).map((p, i) => [p.x, p.y, "picture " + (m.levels[0] + i)]).concat(S.quests.map((q) => [q.x, q.y, "egg"]));
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) * k375; if (d < 48) bad.push("sheet " + m.from + ": " + pts[i][2] + " and " + pts[j][2] + " " + d.toFixed(0) + " px"); } }
  return bad;
}
// LICENSES.md: the mode's section between its two markers, rewritten from the records (appended at the end the first time).
const MK = ["<!-- partials-pixels:start (tools/partials-pixels.js writes this section) -->", "<!-- partials-pixels:end -->"];
function licences(X, LV) {
  const f = path.join(X.GAME, "LICENSES.md"); if (!fs.existsSync(f)) return; const W = X.C.world, t = fs.readFileSync(f, "utf8");
  const block = [MK[0], "", "### " + W.name + ": original pixel art by " + W.by, "", "Every picture in this mode is original pixel art by " + W.by + ", used in the game with the artist's permission. All rights reserved by the artist: these pictures are not CC0 and not open licensed, and may not be reused outside the game without the artist's permission. Each is shown exactly as drawn, one pixel to one block, in its own colours (the merge or crop column says where Peter approved a change to fit the board).", "",
    "| Picture | Title | File | Cells | Colours | Merge or crop |", "|---|---|---|---|---|---|"]
    .concat(LV.map((L) => "| " + L.n + " | " + L.title + " (" + L.src + ") | " + L.convert.file + " | " + L.convert.cells + " | " + L.convert.colours + " | " + (L.convert.merge ? "merge " + Object.entries(L.convert.merge).map(([a, b]) => a + " to " + b).join(", ") : "") + (L.convert.crop ? (L.convert.merge ? "; " : "") + "crop " + L.convert.crop.join(", ") : "") + (L.convert.merge || L.convert.crop ? "" : "none: as drawn") + " |"), ["", MK[1]]).join("\n");
  const a = t.indexOf(MK[0]), b = t.indexOf(MK[1]), next = a >= 0 && b > a ? t.slice(0, a) + block + t.slice(b + MK[1].length) : t.replace(/\s*$/, "\n\n") + block + "\n";
  if (next !== t) fs.writeFileSync(f, next);
}
// The source file (tools/build-data/levels/pixels.json) and the shipped files (tools/pack.js pixelsFiles).
function install(X, LV) {
  const J = { version: 1, note: "Partial's Pixels (tools/partials-pixels.js; tools/partials-pixels-notes.md): the mode's one world and its records, PartialVoid's pictures exactly as drawn. Written by the tool on every install; tools/pack.js packs it into levels/pixels.pk.json (the index) and levels/pixels-<k>.pk.json.", worlds: [worldOf(X, LV.length)], levels: LV };
  const changed = [], put = (p, t, name) => { if (fs.existsSync(p) && fs.readFileSync(p, "utf8") === t) return; fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p + ".tmp", t); fs.renameSync(p + ".tmp", p); changed.push(name); }; // critic m6: only what changed is reported
  put(X.src, JSON.stringify(J) + "\n", path.relative(X.GAME, X.src));
  const lf = path.join(X.GAME, "LICENSES.md"), l0 = fs.existsSync(lf) ? fs.readFileSync(lf, "utf8") : null; licences(X, LV); if (l0 !== null && fs.readFileSync(lf, "utf8") !== l0) changed.push("LICENSES.md");
  const PK = require("./pack.js"), files = PK.pixelsFiles(J);
  for (const [f, t] of Object.entries(files)) put(path.join(X.GAME, "levels", f), t, "levels/" + f);
  for (const f of fs.readdirSync(path.join(X.GAME, "levels"))) if (/^pixels-\d+\.pk\.json$/.test(f) && !files[f]) { fs.unlinkSync(path.join(X.GAME, "levels", f)); changed.push("levels/" + f + " (removed)"); }
  // critic m4: a suggestion that has now been approved (its change is in the manifest) says so at its top.
  for (const L of LV) { const f = path.join(X.sug, L.src + ".md"); if (!fs.existsSync(f) || !(L.convert.merge || L.convert.crop)) continue; const t = fs.readFileSync(f, "utf8"); if (!/^Approved/.test(t)) fs.writeFileSync(f, "Approved: the change below is in the manifest and the picture is installed as picture " + L.n + " (" + new Date().toISOString().slice(0, 10) + ").\n\n" + t); }
  return changed;
}

// When a gate still fails after the retries: what to do next, by gate (runbook step 5).
function nextSteps(X, C, LV) {
  const bad = C.gates.filter((g) => !g.ok), out = [], ids = (g) => [...new Set(g.bad.map((b) => b.split(":")[0]))].map((id) => (LV.find((L) => L.id === id) || {}).src || id);
  for (const g of bad) {
    if (/real pace|fallback|careful|steady|longest tap/.test(g.name)) out.push("bake " + ids(g).join(", ") + " again with more candidates: node tools/partials-pixels.js --rebake " + ids(g).join(",") + " --extra 12; if it still misses, give its manifest line a tag (\"tag\": \"easy\" or \"normal\"); a picture under about 30 x 30 cells plays short whatever the deal: ask Peter whether to lower paceByCells.floor in tools/pixels-config.json for small pictures");
    else if (/THE ART/.test(g.name)) out.push("the record does not match the PNG: this is a tool bug, not the picture's; do not install, report it");
    else if (/map/.test(g.name)) out.push("the map spots: tools/pixels-config.json map (sheets, perSheet)");
    else out.push(g.name + ": " + g.bad.slice(0, 2).join("; "));
  }
  return [...new Set(out)];
}

// ---- the run -------------------------------------------------------------------------------------------------------------
// -> {ok, installed: [ids], suggested: [ids], refused: [{id, problems}], gates, report}. o: {game, config, check (no bake or
// install), threads, rebake: [ids], log}.
async function run(o) {
  o = o || {}; const X = context(o), log = o.log || console.log, man = fs.existsSync(X.man) ? readJ(X.man) : { pictures: [] }, lines = man.pictures || [];
  const old = fs.existsSync(X.src) ? readJ(X.src).levels : [], res = { ok: true, installed: [], suggested: [], refused: [], kept: [], baked: [] };
  const seen = new Set(); for (const l of lines) { if (seen.has(l.id)) { log("partials-pixels: id " + l.id + " is in the manifest twice"); res.ok = false; return res; } seen.add(l.id); }
  old.forEach((L, i) => { if (!lines[i] || lines[i].id !== L.src) { res.ok = false; res.order = "the manifest's line " + (i + 1) + " is " + (lines[i] ? lines[i].id : "missing") + ", installed picture " + L.n + " is " + L.src + ": lines are only ever appended (ids, saves and numbers keep each picture's place)"; } });
  if (res.order) { log("partials-pixels: " + res.order); return res; }
  const CVs = []; let stop = false;
  lines.forEach((line, i) => { if (stop) return; const cv = convert(X, line, i + 1);
    if (cv.problems.length) { res.refused.push({ id: line.id, problems: cv.problems }); log("  " + line.id + ": REFUSED " + cv.problems.join("; ")); stop = true; return; }
    if (cv.suggest) { writeSuggest(X, cv); res.suggested.push(line.id); log("  " + line.id + ": doesn't fit as drawn (" + (cv.suggest.kind === "colours" ? cv.colours.length + " colours, cap " + X.C.limits.maxColours : cv.pw + "x" + cv.ph + " cells, board " + cv.suggest.box.join("x")) + "): suggestion in " + path.relative(X.GAME, path.join(X.sug, line.id + ".md")) + "; not installed"); stop = true; return; } // a later picture waits too (numbers run in manifest order)
    log("  " + line.id + ": " + cv.file + ", " + cv.px.join("x") + " px, " + cv.s + " px a cell, " + cv.pw + "x" + cv.ph + " cells, " + cv.colours.length + " colours" + (cv.merge ? " (merge " + JSON.stringify(cv.merge) + ")" : "") + (cv.crop ? " (crop " + cv.crop.join(",") + ")" : "") + ", closest pair " + minDE(cv) + " ΔE00" + (minDE(cv) != null && minDE(cv) < X.C.suggest.warnDE ? " (WARNING: under " + X.C.suggest.warnDE + ", a player may not tell those two apart; check with Peter before it ships)" : ""));
    CVs.push(cv); });
  res.ok = res.ok && !res.refused.length && !res.suggested.length;
  // Kept: an installed record whose picture (cells, title, tag) is unchanged. The rest are baked.
  const rebake = new Set(o.rebake || (opt("rebake") ? opt("rebake").split(",") : [])), keep = CVs.map((cv, i) => (old[i] && old[i].convert && old[i].convert.hash === cv.hash && !rebake.has(cv.line.id) ? old[i] : null));
  if (o.check) { const LV = keep.filter(Boolean), C = check(X, LV, CVs.slice(0, LV.length)); for (const g of C.gates) log((g.ok ? "  pass  " : "  FAIL  ") + g.name + (g.ok ? "" : ": " + g.bad.slice(0, 3).join("; "))); res.gates = C.gates; res.ok = res.ok && C.ok; return res; }
  const todo = CVs.map((cv, i) => (keep[i] ? null : { cv, board: boardOf(X, cv), i })).filter(Boolean);
  if (todo.length) {
    const threads = +(o.threads || opt("threads")) || LB.threadsOf(X.LC.bake), t0 = Date.now(); log("bake: " + todo.length + " picture" + (todo.length === 1 ? "" : "s") + " on " + threads + " threads");
    const out = await LB.runPool(todo.map((t) => jobOf(X, t.cv, t.board)), threads, t0 + X.LC.bake.budget.wallSec * 1000, null);
    // Fix pass (critic S2): a pick that missed a target (a fallback) is baked again with more candidates, retry.extra in turn.
    for (const ex of (X.C.retry && X.C.retry.extra) || []) { const again = out.map((r, j) => (r.fallback || r.fail ? j : -1)).filter((j) => j >= 0); if (!again.length) break;
      log("  retry: " + again.map((j) => todo[j].cv.line.id + " (" + (out[j].fallback || out[j].fail) + ")").join("; ") + " with " + ex + " more candidates");
      const re = await LB.runPool(again.map((j) => Object.assign(jobOf(X, todo[j].cv, todo[j].board), { extra: Math.max(ex, +opt("extra") || 0) })), threads, Infinity, null); again.forEach((j, q) => { if (!re[q].fail && (!re[q].fallback || out[j].fail)) out[j] = re[q]; }); }
    out.forEach((r, j) => { const t = todo[j]; if (r.fail) { log("  " + t.cv.line.id + ": bake FAIL " + r.fail); res.ok = false; return; } fs.mkdirSync(X.scr, { recursive: true }); writeJ(path.join(X.scr, t.cv.line.id + ".json"), r);
      keep[t.i] = recordOf(X, t.cv, t.board, r); res.baked.push({ id: t.cv.line.id, tag: r.tag, s: +((Date.now() - t0) / 1000).toFixed(1), pace: Math.round(r.level.grade[r.tag].pace.ms / 1000), taps: r.level.win[r.tag].length, rate: r.level.grade[r.tag].rate });
      log("  " + t.cv.line.id + " " + r.tag + ": " + (r.fallback ? "fallback (" + r.fallback + ")" : "ok") + ", real pace " + Math.round(r.level.grade[r.tag].pace.ms / 1000) + " s, " + r.level.win[r.tag].length + " taps, rate " + r.level.grade[r.tag].rate + " (" + ((Date.now() - t0) / 1000).toFixed(0) + " s)"); });
  }
  const n = keep.findIndex((L) => !L), LV = (n < 0 ? keep : keep.slice(0, n));
  if (!LV.length) { log("partials-pixels: nothing to install"); return res; }
  const C = check(X, LV, CVs.slice(0, LV.length)), sb = sheetsCheck(X, LV.length);
  C.gates.push({ name: "the map: a spot for every picture, 48 CSS px between points at 375 px", ok: !sb.length, bad: sb, info: "" }); C.ok = C.ok && !sb.length;
  for (const g of C.gates) log((g.ok ? "  pass  " : "  FAIL  ") + g.name + (g.ok ? (g.info ? " (" + g.info + ")" : "") : ": " + g.bad.slice(0, 3).join("; ")));
  res.gates = C.gates; res.records = LV;
  if (!C.ok) { res.ok = false; log("partials-pixels: a gate failed; nothing installed. Next steps:"); for (const s2 of nextSteps(X, C, LV)) log("  - " + s2); return res; }
  const files = install(X, LV); res.installed = LV.map((L) => L.src); res.kept = LV.filter((L, i) => old[i] === L).map((L) => L.src);
  log("install: " + LV.length + " picture" + (LV.length === 1 ? "" : "s") + " (" + res.kept.length + " kept byte for byte); " + (files.length ? "wrote " + files.join(", ") : "every file unchanged"));
  return res;
}

module.exports = { readPNG, gridOf, convert, suggestColours, suggestCrop, edgeShare, boardOf, artCheck, sheetsOf, worldOf, context, run, paceOf, nextSteps };

if (require.main === module) {
  run({ check: argv[0] === "check" }).then((r) => { console.log("partials-pixels: " + (r.ok ? "OK" : "NOT OK") + (r.installed.length ? "; installed " + r.installed.join(", ") : "") + (r.suggested.length ? "; suggestion for " + r.suggested.join(", ") : "") + (r.refused.length ? "; refused " + r.refused.map((x) => x.id).join(", ") : "")); process.exitCode = r.ok ? 0 : 1; })
    .catch((e) => { console.log("partials-pixels: " + (e && e.stack || e)); process.exitCode = 1; });
}
