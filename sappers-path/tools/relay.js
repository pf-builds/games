// Sapper's Path v5 R2, the re-lay (the rules review's "Reuse map" and feature ladder; bake-config relay). Every board of
// the shipped v4.3 Siege (git relay.src, or --src FILE) gets a slot in the new campaign and is edited to its realm's
// features and its slot's tag (config.json v5.density), its deck edited the same way so the stored order still means
// what it did:
//   realm 1, The Greenmarch (1-24): Era 1's boards as they are; the spare (relay.drop) is dropped (its 20 x 22 board
//     can't reach the 3-minute target that holds from level 26);
//   realm 2, Fenwater Vale (25-49): Era 2's boards with every drawbridge opened (the iron becomes ground, each gold key a
//     plain block of the wall around it) and the mystery flags dropped; one slot short (Era 2 gives 25 openers and the
//     old mystery lesson goes to 100), so one new Era 2 board;
//   realm 3, The Ironhollows (50-74): Era 3's boards with the towers turned into plain blocks (the tower's own colour
//     stays) and mystery flags and links dropped; gates and keys stay; Easy levels open their gate (one feature at
//     most); Hard levels get a colour lock (the colour whose first squad comes nearest relay.lockAt of the order);
//   realm 4, Twinspire Reach (75-99): Era 4's boards with towers plain and mystery dropped; linked squads and gates stay;
//     Easy opens its gates and drops links and lock; Normal drops a lock; Hard keeps a key lock (or gets a colour lock)
//     and needs links (a board without them is dealt again with pairs);
//   level 100, The Mistmoor's opener: the old mystery-card lesson (relay.teach).
// Teaching levels (relay.teach: new slot <- old level) move with their boards; 1-3 stay. Within a realm the boards are
// matched to its regular slots by the least total cost (relay.cost: a tag that differs from the board's v4.3 tag, a
// small teaching board off an Easy slot, each edit, a Hard Twinspire slot without links, and a little for moving),
// solved exactly by the Hungarian method, so the same input always gives the same map.
// Deck edits run on the stored order turned into its plays: a linked pair splits into two taps (the partner tapped
// right after); a dropped key's sapper leaves the last gilt squad (a squad of 1 goes, with its tap) and joins the last
// squad of the block's new colour; flags go. The columns are rebuilt from the plays, so each stays a subsequence of the
// order and the order (the hint) still taps every card.
//   relay(SRC, TEACH, C, CFG) -> {slots: [{n, realm, tag, teaching, from, edits, level, hint, twists, deal}], dropped}
//   ~/.local/opt/node/bin/node tools/relay.js [--src FILE] [--teach FILE] [--json]   prints the map
"use strict";
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const E = require("../src/engine.js"), TG = require("./tags.js"), PIC = require("./pic.js");
const ROOT = path.join(__dirname, "..");

const clone = (o) => JSON.parse(JSON.stringify(o));
const realmOf = (n, C) => C.tags.realms.findIndex((r) => n >= r[0] && n <= r[1]) + 1;
const small = (L, C) => L.source === "teaching"; // a reused teaching board (38 x 37) is smaller than the full-screen 42 x 41

// ---- the stored order as plays, and back ------------------------------------------------------------------------------
// taps: [{col, card: [m, k, f?], part: {col, card} | null}] in tap order (a pair: its tapped card and its partner).
function toTaps(L, order) {
  const ptr = [0, 0, 0, 0, 0], link = new Map(), taps = [];
  for (const [a, b] of L.links || []) { link.set(a.join(), b); link.set(b.join(), a); }
  for (const ch of order) {
    const j = +ch, i = ptr[j]++, card = L.cols[j][i], p = link.get(j + "," + i);
    if (!card) throw new Error("relay: the order runs past column " + j);
    let part = null; if (p) { if (ptr[p[0]] !== p[1]) throw new Error("relay: a partner is not at its front"); ptr[p[0]]++; part = { col: p[0], card: L.cols[p[0]][p[1]] }; }
    taps.push({ col: j, card: card.slice(), part: part && { col: part.col, card: part.card.slice() } });
  }
  if (ptr.some((x, j) => x !== L.cols[j].length)) throw new Error("relay: the order leaves cards");
  return taps;
}
function fromTaps(taps) {
  const cols = [[], [], [], [], []], links = []; let order = "";
  for (const t of taps) { const a = [t.col, cols[t.col].length]; cols[t.col].push(t.card); order += t.col;
    if (t.part) { links.push([a, [t.part.col, cols[t.part.col].length]]); cols[t.part.col].push(t.part.card); } }
  return { cols, links, order };
}

// ---- board edits --------------------------------------------------------------------------------------------------------
const cellOf = (L, x, y) => L.grid[y][x], setCell = (L, x, y, ch) => { L.grid[y] = L.grid[y].slice(0, x) + ch + L.grid[y].slice(x + 1); };
// The plain colour a dropped key becomes: the material most of its 4 neighbours are (then 8; ties: more pixels on the
// board, then the lower id), never iron or gilt.
function plainOf(L, x, y) {
  const cnt = new Map(); for (const row of L.grid) for (const ch of row) { const m = E.matOf(ch); if (m) cnt.set(m, (cnt.get(m) || 0) + 1); }
  for (const ring of [[[1, 0], [-1, 0], [0, 1], [0, -1]], [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]]) {
    const v = new Map();
    for (const [dx, dy] of ring) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue; const m = E.matOf(cellOf(L, nx, ny)); if (m && m !== E.IRON && m !== E.GILT) v.set(m, (v.get(m) || 0) + 1); }
    const best = [...v].sort((p, q) => q[1] - p[1] || cnt.get(q[0]) - cnt.get(p[0]) || p[0] - q[0])[0]; if (best) return best[0];
  }
  return [...cnt].filter(([m]) => m !== E.IRON && m !== E.GILT).sort((p, q) => q[1] - p[1] || p[0] - q[0])[0][0];
}
// Turn key cells into plain blocks: the board (each its plainOf colour) and the taps (one gilt sapper fewer from the last
// gilt squad per key, one more for the last squad of the new colour).
function plainKeys(L, taps, cells) {
  const all = []; for (const t of taps) { all.push(t.card); if (t.part) all.push(t.part.card); }
  for (const [x, y] of cells) {
    const m = plainOf(L, x, y); setCell(L, x, y, E.chOf(m));
    for (let i = taps.length - 1; i >= 0; i--) { // the last gilt card loses a sapper (a card of 1 goes)
      const t = taps[i], side = t.part && t.part.card[0] === E.GILT ? "part" : t.card[0] === E.GILT ? "card" : null; if (!side) continue;
      const cd = side === "part" ? t.part.card : t.card;
      if (cd[1] > 1) cd[1]--; else if (side === "part") t.part = null; else if (t.part) { t.col = t.part.col; t.card = t.part.card; t.part = null; } else taps.splice(i, 1);
      break;
    }
    let got = false; // the last card of the new colour takes the sapper (under the 99 cap), else a new squad of 1 at the end
    for (let i = taps.length - 1; i >= 0 && !got; i--) for (const cd of [taps[i].part && taps[i].part.card, taps[i].card]) if (!got && cd && cd[0] === m && cd[1] < 99) { cd[1]++; got = true; }
    if (!got) taps.push({ col: taps.length ? taps[taps.length - 1].col : 0, card: [m, 1], part: null });
  }
}
const ED = {
  openGates(L, taps) { if (!(L.gates && L.gates.length)) return false; const keys = L.gates.map((g) => g.key);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (E.matOf(cellOf(L, x, y)) === E.IRON) setCell(L, x, y, ",");
    delete L.gates; plainKeys(L, taps, keys); return true; },
  dropTowers(L) { const had = !!(L.towers && L.towers.length) || !!L.safeArchers; delete L.towers; delete L.safeArchers; return had; },
  dropMystery(L, taps) { let had = false; for (const t of taps) for (const cd of [t.card, t.part && t.part.card]) if (cd && cd.length > 2) { cd.length = 2; had = true; } return had; },
  dropLinks(L, taps) { let had = false; for (let i = 0; i < taps.length; i++) if (taps[i].part) { const p = taps[i].part; taps[i].part = null; taps.splice(i + 1, 0, { col: p.col, card: p.card, part: null }); had = true; } return had; },
  dropLock(L, taps) { if (!L.lock) return false; if (L.lock.key) plainKeys(L, taps, [L.lock.key]); delete L.lock; return true; },
  colourLock(L, taps, C) { // the colour whose first squad comes nearest relay.lockAt of the way through the order
    const first = new Map(); taps.forEach((t, i) => { for (const cd of [t.card, t.part && t.part.card]) if (cd && !first.has(cd[0])) first.set(cd[0], i); });
    const want = C.relay.lockAt * taps.length, m = [...first].sort((p, q) => Math.abs(p[1] - want) - Math.abs(q[1] - want) || p[1] - q[1])[0][0];
    L.lock = { colour: m }; return true; },
};
// The edits a board takes for a slot (realm, tag, teaching): a list of ED names, in order.
function editsFor(L, realm, tag, teaching) {
  const e = [], has = (k) => !!(L[k] && L[k].length);
  const flags = L.cols.some((c) => c.some((cd) => cd[2]));
  if (realm === 2) { if (has("gates")) e.push("openGates"); if (flags) e.push("dropMystery"); }
  if (realm === 3) { if (has("towers") || L.safeArchers) e.push("dropTowers"); if (flags) e.push("dropMystery"); if (has("links")) e.push("dropLinks"); if (L.lock) e.push("dropLock");
    if (tag === "easy" && !teaching && has("gates")) e.push("openGates"); if (tag === "hard") e.push("colourLock"); }
  if (realm === 4) { if (has("towers") || L.safeArchers) e.push("dropTowers"); if (flags) e.push("dropMystery");
    if (tag === "easy" && !teaching) { if (has("links")) e.push("dropLinks"); if (has("gates")) e.push("openGates"); }
    if (tag !== "hard" && L.lock) e.push("dropLock"); if (tag === "hard" && !L.lock) e.push("colourLock"); }
  return e;
}
// Apply the edits to a v4.3 level (board, deck and its stored order on its old tag). Returns {level, hint, edits}.
function apply(L0, edits, C, V3) {
  const L = clone(L0), taps = toTaps(L, L.win[L.tag]);
  const done = edits.filter((k) => ED[k](L, taps, C));
  const d = fromTaps(taps); L.cols = d.cols; if (d.links.length) L.links = d.links; else delete L.links;
  prune(L, V3);
  return { level: L, hint: d.order, edits: done };
}
// The palette: only the colours still on the board, its smallest distances recomputed (the drawbridge's iron goes).
function prune(L, V3) {
  const used = new Set(); for (const row of L.grid) for (const ch of row) { const m = E.matOf(ch); if (m) used.add(m); }
  if (!L.pal) return L;
  for (const k of Object.keys(L.pal)) if (!used.has(+k)) delete L.pal[k];
  const hx = [...used].filter((m) => m !== E.IRON).map((m) => (m === E.GILT ? V3.mats[m].c : L.pal[m] && L.pal[m].c)).filter(Boolean); let de = 99, fd = 99;
  for (let a = 0; a < hx.length; a++) for (let b = a + 1; b < hx.length; b++) { de = Math.min(de, PIC.de(hx[a], hx[b])); fd = Math.min(fd, PIC.fadeGap(hx[a], hx[b])); }
  if (L.palette) L.palette = { minDE: +de.toFixed(1), minFade: +fd.toFixed(1) };
  return L;
}
// A new fort for a slot (bake.js --relay draws one only where no kept board fits): its realm's board edits, before any
// deal (realm 2 and Easy levels from 3 open their gates; from realm 3 the towers are plain blocks).
function freshEdits(L, realm, tag) {
  if (realm >= 3) ED.dropTowers(L);
  if (realm === 2 || (realm >= 3 && tag === "easy")) ED.openGates(L, []);
  return prune(L, require("../config.json").v3);
}

// ---- the slot map ------------------------------------------------------------------------------------------------------
// The Hungarian method on a square cost matrix (rows: boards, columns: slots). Returns col[row].
function hungarian(a) {
  const n = a.length, INF = 1e18, u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0), p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0; const minv = new Array(n + 1).fill(INF), used = new Array(n + 1).fill(false);
    for (let g = 0; g <= n + 1; g++) {
      used[j0] = true; const i0 = p[j0]; let d = INF, j1 = 0;
      for (let j = 1; j <= n; j++) if (!used[j]) { const cur = a[i0 - 1][j - 1] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0; } if (minv[j] < d) { d = minv[j]; j1 = j; } }
      for (let j = 0; j <= n; j++) if (used[j]) { u[p[j]] += d; v[j] -= d; } else minv[j] -= d;
      j0 = j1; if (p[j0] === 0) break;
    }
    for (let g = 0; g <= n && j0; g++) { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; }
  }
  const col = new Array(n); for (let j = 1; j <= n; j++) if (p[j]) col[p[j] - 1] = j - 1; return col;
}
function relay(SRC, TEACH, C, CFG) {
  const V3 = CFG.v3, RC = C.relay, T = C.tags, tagN = (n, t) => TG.tagOf(n, T, t), byN = new Map(SRC.map((l) => [l.n, l])), tch = new Map(TEACH.map((l) => [l.n, l]));
  const teachSlots = new Map(Object.entries(RC.teach).map(([s, o]) => [+s, +o])); // new slot <- old level
  for (const l of TEACH) if (l.n < T.from) teachSlots.set(l.n, l.n);
  const usedOld = new Set([...teachSlots.values()].concat(RC.drop)), slots = [], W = RC.cost;
  for (const [s, o] of [...teachSlots].sort((p, q) => p[0] - q[0])) { // teaching levels: the old teaching level's board and deck
    const L0 = Object.assign({}, tch.get(o), byN.get(o) ? { win: byN.get(o).win, tag: byN.get(o).tag } : {}), realm = realmOf(s, C), tag = tagN(s, true);
    const ed = (RC.teachEdits[s] || []).slice(), a = apply(Object.assign({ source: "teaching" }, L0), ed, C, V3);
    slots.push({ n: s, realm, tag, teaching: true, from: byN.get(o) ? byN.get(o).id : "teach-" + o, edits: a.edits, level: a.level, hint: a.hint });
  }
  for (let r = 1; r <= C.tags.realms.length; r++) {
    const [a, z] = C.tags.realms[r - 1], free = []; for (let n = a; n <= Math.min(z, C.levels); n++) if (!teachSlots.has(n)) free.push(n);
    if (!free.length) continue;
    const boards = SRC.filter((l) => l.era === r && !usedOld.has(l.n)), want = free.length;
    const rows = boards.map((l) => ({ l })); while (rows.length < want) rows.push({ l: null }); // a new board where the realm runs short
    if (rows.length > want) throw new Error("relay: realm " + r + " has " + rows.length + " boards for " + want + " slots");
    const cost = rows.map(({ l }) => free.map((n) => {
      if (!l) return W.newBoard;
      const tag = tagN(n, false), ed = editsFor(l, r, tag, false); let c = ed.length * W.edit + W.move * Math.abs(l.n - n);
      if (tag !== l.tag) c += W.tag;
      if (small(l, C) && tag !== "easy") c += W.small;
      if (r === 3 && tag !== "easy" && !(l.gates && l.gates.length)) c += W.infeasible; // a Normal or Hard Ironhollows level needs its gate
      if (r === 4 && tag === "hard" && !(l.links && l.links.length)) c += W.links; // Hard Twinspire levels use every feature: links
      if (r === 4 && tag === "hard" && l.lock && l.lock.key) c -= W.keyLock; // a key lock already on the board stays
      return c; }));
    const col = hungarian(cost);
    rows.forEach(({ l }, i) => {
      const n = free[col[i]], tag = tagN(n, false);
      if (!l) { slots.push({ n, realm: r, tag, teaching: false, from: null, edits: ["newBoard"], level: null, hint: null }); return; }
      const ed = editsFor(l, r, tag, false), x = apply(l, ed, C, V3);
      if (r === 4 && tag === "hard" && !(x.level.links && x.level.links.length)) x.edits.push("needLinks");
      slots.push({ n, realm: r, tag, teaching: false, from: l.id, edits: x.edits, level: x.level, hint: x.hint });
    });
  }
  slots.sort((p, q) => p.n - q.n);
  for (const s of slots) { // the twists each slot carries (for the bake's picker and a re-deal: pairs to join, the lock)
    const L = s.level, pairs = L && L.links ? L.links.length : 0;
    s.twists = { mystery: 0, links: s.realm === 4 && s.tag === "hard" ? Math.max(1, pairs) : s.realm >= 4 && s.tag !== "easy" ? pairs : 0, lock: s.tag === "hard" && s.n >= CFG.v5.locks.from };
    if (s.teaching && L) s.twists = { mystery: L.cols.flat().filter((cd) => cd[2]).length, links: pairs, lock: !!L.lock };
  }
  return { slots, dropped: RC.drop.map((n) => byN.get(n).id) };
}
// The v4.3 source: relay.src's committed level files (git), or --src FILE / --teach FILE.
function source(C, srcFile, teachFile) {
  const git = (f) => JSON.parse(execSync("git show " + C.relay.src + ":sappers-path/levels/" + f, { cwd: ROOT, maxBuffer: 64 << 20 }).toString());
  return { SRC: (srcFile ? JSON.parse(fs.readFileSync(srcFile, "utf8")) : git("levels.json")).levels, TEACH: (teachFile ? JSON.parse(fs.readFileSync(teachFile, "utf8")) : git("teaching.json")).levels };
}
module.exports = { relay, source, apply, editsFor, freshEdits, prune, toTaps, fromTaps, ED, realmOf, hungarian };

if (require.main === module) {
  const arg = (k) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : null; };
  const C = require("./bake-config.json"), CFG = require("../config.json"), { SRC, TEACH } = source(C, arg("src"), arg("teach"));
  const R = relay(SRC, TEACH, C, CFG);
  if (arg("teach-out")) { // the re-laid teaching levels, keyed by their new slots, for teach-v4.js --boards
    const lv = R.slots.filter((x) => x.teaching).map((x) => Object.assign({}, x.level, { n: x.n, era: x.realm, tag: x.tag, win: { [x.tag]: x.hint }, from: x.from, edits: x.edits }));
    fs.writeFileSync(path.resolve(arg("teach-out")), JSON.stringify({ note: "Re-laid teaching levels (tools/relay.js --teach-out), the input of tools/teach-v4.js --boards.", levels: lv })); console.log("wrote " + lv.length + " teaching levels to " + arg("teach-out")); process.exit(0); }
  if (process.argv.includes("--json")) { console.log(JSON.stringify(R.slots.map((s) => ({ n: s.n, tag: s.tag, from: s.from, edits: s.edits })))); process.exit(0); }
  for (const s of R.slots) { const L = s.level, f = L ? TG.featuresOf(L).concat(L.lock ? ["lock" + (L.lock.key ? ":key" : ":colour " + L.lock.colour)] : []) : [];
    console.log(String(s.n).padStart(3) + " " + s.tag.padEnd(6) + (s.teaching ? " T " : "   ") + String(s.from || "(new)").padEnd(7) + " " + (s.edits.join(",") || "-").padEnd(46) + " [" + f.join(",") + "]" + (L && !TG.densityOK(s.n, s.tag, L, CFG.v5.density, s.teaching) ? "  DENSITY!" : "")); }
  console.log("dropped: " + R.dropped.join(", "));
}
