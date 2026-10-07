// Sapper's Path campaign v6 stage 2, the re-deal of levels 1-200 on the approved curve (tools/campaign-v6-curve.md; SPEC-v4 §9,
// "Campaign v6 stage 2: the re-deal"; notes tools/campaign-v6-notes.md §3). Every number is in tools/bake-config.json (tags.v6,
// v6) and config.json v5.density; the bake itself is tools/campaign-v6-bake.js.
//   ~/.local/opt/node/bin/node tools/campaign-v6.js plan                 the plan, level by level, and its checks
//   ~/.local/opt/node/bin/node tools/campaign-v6.js bake [--list N,N | --only A-B] [--extra K] [--threads N] [--reuse]
//        every planned level's candidates, shared out one per thread (scratch/cands/n-<n>.json keeps them; --reuse takes
//        them back for the same board and plan, so more candidates or a moved gate re-pick without re-making the old),
//        picked, written to scratch/picks/n-<n>.json
//   ~/.local/opt/node/bin/node tools/campaign-v6.js install              levels 1-200 of levels/levels.json from the picks
//        (201 on untouched, byte for byte), the coach cards that name a lock or tower colour (config.json teach)
//   ~/.local/opt/node/bin/node tools/campaign-v6.js measure [--before FILE] [--out FILE]   the after table (careful,
//        obvious, random tap, pace, taps by realm and tag) next to the before baseline, and the coins of a first clear
// Fix pass (2026-10-07, the functional critic's B1/S1/S3; SPEC-v4 §9 "Campaign v6 fix pass (difficulty)"; notes §5):
//   ~/.local/opt/node/bin/node tools/campaign-v6.js deep [--levels FILE] [--out FILE]   the best-of gate (the careful
//        player 1, 2 and 3 taps deep, 32 games, on two seeds) on every level 1-200 of a levels file, each level against
//        its ceiling and floor, and the realm table (campaign-v6-fix-before.jsonl is the pass's before); --salt K runs
//        it on fresh seeds (each level's seed xor K)
//   ~/.local/opt/node/bin/node tools/campaign-v6.js regate [--list N,N] [--cands DIR,DIR] [--repick]   every dealt level's
//        pick on the gate: kept with its two runs stored when it passes, else picked again from its cached candidates
//        (--cands: those scratch folders' candidates together; --repick: pick again even when it passes); the levels
//        none passes are listed for a bake (bake --list ... --from K: new candidates from K, so fresh seeds)
// The plan, per level (planOf):
//   tag: bake-config tags.v6 (one letter a level: E, N, H, X); teaching levels (1-3 and each realm's opener) and the
//     tutorial (v6.tutorial, 4-8) keep their boards and decks and are only graded again (careful, obvious, steady added).
//   towers: v6.towers.restore (realms 3-4: the v4.3 board's towers, from git relay.src), add (a slate tower painted at
//     the frame on the bank path, paintTower), drop (the tower turns plain, as v5 R2 did); from 125 a Normal or Easy level
//     drops its towers unless v6.towers.keep lists it; keepOnly (by index) where a killing level's full set of towers
//     leaves no deal whose order survives real pace (the others turn plain). archers: Hard "pin", Extreme "kill", where towers stand.
//   locks: from v5.locks.from (50) every Hard and Extreme: the board's key lock if it has one, else a colour lock;
//     Extreme from v6.twoLocksFrom (150) a second (colour) lock.
//   deck features (config.json v5.density, v6 rule): Easy none; Normal up to 2 features in all (at least 1 once one is
//     unlocked), Hard up to 3 (at least 2), Extreme every unlocked one (towers optional before v5.density.towerFull);
//     the board's moat, gate and towers count first, the deck's linked pairs, ? cards and mystery blocks fill the rest in a
//     seeded order; amounts from v6.amounts by tag.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto"), { execSync } = require("child_process");
const E = require("../src/engine.js"), G = require("./gen.js"), PIC = require("./pic.js"), PAL = require("./palette.js"), TG = require("./tags.js"), CB = require("./campaign-v6-bake.js");
const ROOT = path.join(__dirname, ".."), SCR = path.join(__dirname, "campaign-v6-scratch");
const argv = process.argv.slice(2), flag = (k) => argv.indexOf("--" + k) >= 0, opt = (k) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : null; };
const readJ = (f) => JSON.parse(fs.readFileSync(f, "utf8")), writeJ = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + ".tmp", JSON.stringify(o)); fs.renameSync(f + ".tmp", f); };
const C = require("./bake-config.json"), V = C.v6, CFG = require("../config.json"), DN = CFG.v5.density;
const TAG = { E: "easy", N: "normal", H: "hard", X: "extreme" };
const hash01 = (n, k) => { let t = Math.imul(n + 0x3c6e, 0x9E3779B1) ^ Math.imul(k + 11, 0x85EBCA77); t ^= t >>> 15; t = Math.imul(t, 0x2c1b3c6d); t ^= t >>> 12; return (t >>> 0) / 4294967296; };
const pickIn = (n, k, [a, b]) => a + Math.floor(hash01(n, k) * (b - a + 1));
const BOARD = ["w", "h", "grid", "pic", "gates", "towers", "pal", "scene", "style", "palette", "liquid"];

// ---- the boards --------------------------------------------------------------------------------------------------------
let SRC43 = null; // the v4.3 levels (git relay.src), for the towers the re-lay turned plain
const src43 = () => SRC43 || (SRC43 = new Map(JSON.parse(execSync("git show " + C.relay.src + ":sappers-path/levels/levels.json", { cwd: ROOT, maxBuffer: 1 << 28 }).toString()).levels.map((l) => [l.id, l])));
// A slate archer tower painted on a castle board (castle.js's tower: the picture's frame column or the far one, on the
// bank path): A = {side: "left" | "right", rows: height, r: range}. 5 cells wide, battlements (2 x 2 merlons), an arrow
// slit every 6 rows, one solid ink outline round it where it meets the picture (never on open ground, water or the frame).
// Its colour: the nearest (CIEDE2000) to the board's scene's slate that clears every colour on the board by picture.minDE
// and fadeDE (the scene's own slate rarely does on a full board); its crew name the scene's slate name. Fix pass (the visual
// critic's SHOULD-FIX 1: 104 magenta, 117 lilac, 198 pink read as candy pillars): only a stone colour, v6.towers.stone
// (OKLCH chroma at most grey at any hue but pink, else at most chroma, or A.chroma, with its hue inside hues: grey-browns to
// blue-greys, never pink or violet).
function paintTower(L, A) {
  const w = L.w, h = L.h, rows = L.grid.map((r) => r.split("")), ink = +Object.keys(L.pal).find((k) => L.pal[k].r === "ink");
  let yb = -1; for (let y = h - 2; y >= 1 && yb < 0; y--) if (rows[y].slice(1, w - 1).every((ch) => ch === ",")) { let above = false; for (let x = 1; x < w - 1; x++) if (E.matOf(rows[y - 1][x]) > 0) above = true; if (above && y < h - 6) yb = y; }
  if (yb < 0) throw new Error("paintTower: no bank path");
  const tw = 5, x0 = A.side === "left" ? 1 : w - 1 - tw, yTop = yb - A.rows, Q = C.picture, SC = Q.scenes[L.scene] || {};
  const used = new Set(Object.keys(L.pal).map(Number)), id = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 15].find((m) => !used.has(m));
  const others = Object.values(L.pal).map((p) => p.c).concat(L.grid.some((r) => r.indexOf(E.chOf(E.GILT)) >= 0) ? [CFG.v3.mats[E.GILT].c] : [], [Q.show.water, Q.show.lava, Q.show.hidden], L.liquid && Q.show[L.liquid] ? [Q.show[L.liquid]] : []); // and the moat's water, lava or mire and the mystery block's slate (test.js: towers 25+ from water and lava)
  const clears = (c) => others.every((o) => PIC.de(c, o) >= Q.minDE && PIC.fadeGap(c, o) >= Q.fadeDE);
  const want = (SC.c && SC.c.slate) || Q.roles.slate.c[0], ST = V.towers.stone; let got = null; // the colour nearest the scene's slate that clears every colour on the board (an OKLCH grid inside sRGB)
  const cmax = A.chroma != null ? A.chroma : ST.chroma, stone = (c, hd) => (c <= ST.grey + 1e-9 && !(hd >= ST.pink[0] || hd < ST.pink[1])) || (c <= cmax + 1e-9 && hd >= ST.hues[0] && hd < ST.hues[1]);
  for (let l = 0.3; l <= 0.85; l += 0.0125) for (let c = 0; c <= 0.22; c += 0.01) for (let hd = 0; hd < 360; hd += 5) { if (!stone(c, hd)) continue; const x = PAL.okHex(l, c, hd); if (!x || !clears(x)) continue; const d = PIC.de(x, want); if (!got || d < got[2]) got = [x, (SC.n && SC.n.slate) || Q.roles.slate.name, d]; }
  if (!got) throw new Error("paintTower: no colour clears the board's colours");
  const ch = E.chOf(id), T = new Uint8Array(w * h), set = (x, y) => { if (x >= 1 && x < w - 1 && y >= 1 && y < h - 1) { rows[y][x] = ch; T[y * w + x] = 1; } };
  for (let y = yTop; y < yb; y++) for (let x = x0; x < x0 + tw; x++) set(x, y);
  for (let x = x0; x < x0 + tw; x++) if ((x - x0) % 4 < 2) for (let j = 1; j <= 2; j++) set(x, yTop - j);
  for (let y = yTop + 2; y < yb - 2; y += 6) for (let j = 0; j < 2; j++) { rows[y + j][x0 + 2] = E.chOf(ink); T[(y + j) * w + x0 + 2] = 0; }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { if (T[y * w + x] || !(E.matOf(rows[y][x]) > 0)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => T[(y + dy) * w + x + dx])) rows[y][x] = E.chOf(ink); }
  L.grid = rows.map((r) => r.join("")); L.pal = Object.assign({}, L.pal, { [id]: { c: got[0], n: got[1] || Q.roles.slate.name, r: "slate" } });
  L.towers = (L.towers || []).concat([{ at: [x0 + 1, yb - 2], r: A.r }]);
  L.palette = paletteOf(L);
  E.compile(Object.assign({ cols: [[], [], [], [], []] }, L)); // throws if the tower isn't one group of its own colour
  return L;
}

// A board's palette distances (the closest two of its colours, and the gilt where it has one; never the iron): {minDE, minFade}.
function paletteOf(L) {
  const hx = Object.keys(L.pal).filter((k) => +k !== E.IRON).map((k) => L.pal[k].c).concat(L.grid.some((r) => r.indexOf(E.chOf(E.GILT)) >= 0) ? [CFG.v3.mats[E.GILT].c] : []); let md = 100, mf = 100;
  for (let a = 0; a < hx.length; a++) for (let b = a + 1; b < hx.length; b++) { md = Math.min(md, PIC.de(hx[a], hx[b])); mf = Math.min(mf, PIC.fadeGap(hx[a], hx[b])); }
  return { minDE: +md.toFixed(1), minFade: +mf.toFixed(1) };
}

// ---- the plan ------------------------------------------------------------------------------------------------------------
const tagsOf = () => C.tags.v6.split("").map((c) => TAG[c]);
const careOf = (n, tag) => { if (n === 200) return V.care.boss; const i = V.care.ranges.findIndex(([a, b]) => n >= a && n <= b); return i >= 0 ? V.care[tag][i] : null; };
function planOf(L, tags) {
  const n = L.n, tag = tags[n - 1], teach = L.source === "teaching", tut = n >= V.tutorial[0] && n <= V.tutorial[1], T = V.towers;
  const p = { n, tag, era: L.era, keep: teach || tut ? (teach ? "teaching" : "tutorial") : null, edits: [] };
  if (p.keep) return p;
  const b = {}; for (const k of BOARD) if (L[k] !== undefined) b[k] = JSON.parse(JSON.stringify(L[k]));
  if (T.restore.indexOf(n) >= 0) { const s = src43().get(L.from); if (!s || !s.towers || !s.towers.length) throw new Error("plan: " + n + " has no v4.3 towers to restore (" + L.from + ")"); b.towers = s.towers; p.edits.push("restoreTowers"); }
  if (T.add[n]) { paintTower(b, T.add[n]); p.edits.push("addTower"); }
  const drop = T.drop.indexOf(n) >= 0 || (n >= T.dropFrom && (tag === "easy" || tag === "normal") && T.keep.indexOf(n) < 0);
  if (drop && b.towers && b.towers.length) { delete b.towers; p.edits.push("dropTowers"); }
  if (T.keepOnly && T.keepOnly[n] && b.towers) { b.towers = b.towers.filter((t, i) => T.keepOnly[n].indexOf(i) >= 0); p.edits.push("dropSomeTowers"); } // a killing level whose every tower can't hold a deal at real pace keeps the ones that can
  if (b.towers && b.towers.length && (tag === "hard" || tag === "extreme")) b.archers = tag === "hard" ? "pin" : "kill";
  const canHide = () => [1, 2, 3].some((sd) => G.hide(JSON.parse(JSON.stringify(b)), sd, Object.assign({}, C.plan.hidden, V.hidden, { share: V.amounts.hidden.hard }))); // a board with no bank path above its fort can't carry mystery blocks (gen.js hide)
  const u = TG.unlockedAt(n, DN), board = TG.featuresOf(Object.assign({ cols: [[]] }, b)), deck = u.filter((k) => TG.DECK.indexOf(k) >= 0 && (tag !== "normal" || k !== "hidden") && (k !== "hidden" || canHide()));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(hash01(n, 40 + i) * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const use = tag === "easy" ? [] : deck.slice(0, Math.max(0, tag === "extreme" ? deck.length : Math.min(deck.length, DN.v6[tag][1] - board.length))); // as many as the tag's top allows
  const A = V.amounts, has = (k) => use.indexOf(k) >= 0;
  const locks = n >= CFG.v5.locks.from && (tag === "hard" || tag === "extreme") ? (L.lock && L.lock.key ? ["key"] : ["colour"]).concat(tag === "extreme" && n >= V.twoLocksFrom ? ["colour"] : []) : [];
  Object.assign(p, { board: b, feats: board.concat(use), plan: { links: has("linked") ? pickIn(n, 51, A.links[tag]) : 0, mystery: has("mystery") ? pickIn(n, 52, A.mystery[tag]) : 0, hidden: has("hidden") ? A.hidden[tag] : 0, locks, keyLock: L.lock && L.lock.key ? L.lock : null, archers: b.archers || null },
    band: V.bands[tag], care: careOf(n, tag), pace: L.era === 1 ? { range: V.pace.realm1, aim: null } : n === 200 ? { range: V.pace.boss, aim: V.pace.aim } : { range: V.pace.range, aim: V.pace.aim }, deal: (V.dealByLevel || {})[n] || null });
  // The kept deck is candidate -1 when nothing it was dealt for changed (board, locks, archers, features).
  const same = JSON.stringify(b) === JSON.stringify(Object.fromEntries(BOARD.filter((k) => L[k] !== undefined).map((k) => [k, L[k]]))) && !locks.length && !E.locksOf(L).length && !L.hidden && !L.archers && (L.links || []).length === p.plan.links;
  p.kept = same ? { cols: L.cols.map((c) => c.map((cd) => cd.slice(0, 2))), links: L.links || [], hint: L.win[L.tag], seed: L.seed } : null;
  return p;
}
// The plan reads the levels as they were before the re-deal (git v6.baseCommit), so it is the same after install.
let BASE = null; const baseLevels = () => BASE || (BASE = JSON.parse(execSync("git show " + V.baseCommit + ":sappers-path/levels/levels.json", { cwd: ROOT, maxBuffer: 1 << 28 }).toString()).levels);
function plans() { const LV = baseLevels().filter((l) => l.n <= 200 && !l.land), tags = tagsOf(); return LV.map((L) => planOf(L, tags)); }

// The plan's checks: the curve's counts per realm, 191-199 and 200, the density rule on every planned level, locks only on
// Hard and Extreme from 50, every key board Hard or Extreme.
function checkPlan(P) {
  const bad = [], tags = tagsOf(), realms = C.tags.realms;
  if (tags.length !== 200) bad.push("tags.v6 has " + tags.length + " letters");
  for (const [k, [a, b]] of Object.entries(V.counts)) { const c = ["easy", "normal", "hard", "extreme"].map((t) => tags.slice(a - 1, b).filter((x) => x === t).length).join("/"); if (c !== V.counts[k][2]) bad.push("counts " + k + ": " + c + " vs " + V.counts[k][2]); }
  for (const p of P) { if (p.keep) { if (p.keep === "teaching" && p.tag !== "easy") bad.push(p.n + ": a teaching level must stay Easy"); continue; }
    const lv = Object.assign({ cols: [[]] }, p.board, p.plan.links ? { links: [[[0, 0], [1, 0]]] } : {}, p.plan.mystery ? { cols: [[[1, 1, 1]]] } : {}, p.plan.hidden ? { hidden: ["?"] } : {}, p.plan.locks.length ? { lock: { colour: 1 } } : {});
    if (!TG.densityV6(p.n, p.tag, lv, DN)) bad.push(p.n + " " + p.tag + ": density [" + p.feats.join(",") + (p.plan.locks.length ? ",lock" : "") + "]");
    if (p.plan.keyLock && !p.plan.locks.length) bad.push(p.n + ": a key board on " + p.tag); }
  for (const [a, b] of realms) if (tags[b - 1] !== "extreme") bad.push("realm " + a + "-" + b + " ends on " + tags[b - 1]);
  return bad;
}

// ---- the bake ------------------------------------------------------------------------------------------------------------
const floorOf = (n) => (V.floor && V.floor[n] != null ? V.floor[n] : null); // fix pass: a level's lowest best-of (11)
const jobOf = (p) => ({ n: p.n, tag: p.tag, era: p.era, board: p.board, plan: p.plan, band: p.band, care: p.care, floor: floorOf(p.n), k0: +opt("from") || 0, careTune: V.careTune && V.careTune[p.tag] != null && p.care != null ? Math.min(p.care, V.careTune[p.tag]) : null, pace: p.pace, deal: p.deal, kept: p.kept, extra: +opt("extra") || 0 });
const keyOf = (j) => { const arch = !!(j.board.archers && j.board.towers && j.board.towers.length), D = Object.assign({}, V.deal), T = Object.assign({}, V.tune, { careful: Object.assign({}, V.tune.careful) }); delete D.extraDeep; delete T.careful.extraSteps; // extraDeep, extraSteps: only candidates past the tag's count
  if (!arch) { delete D.rush; delete D.rushOpen; delete T.rushed; } // the rush settings only reach a level with pinning or killing archers
  return crypto.createHash("sha1").update(JSON.stringify([j.board, j.plan, j.band, j.care, j.careTune, j.deal, j.kept && j.kept.seed, require("./campaign-v6-bake.js").VERSION, D, T, V.hidden, V.lockAt].concat(j.floor != null || j.k0 ? [j.floor, j.k0] : []))).digest("hex"); };
async function bake(P) {
  const list = opt("list") ? opt("list").split(",").map(Number) : null, only = opt("only") ? opt("only").split("-").map(Number) : null, inRun = (n) => (list ? list.indexOf(n) >= 0 : !only || (n >= only[0] && n <= (only[1] || only[0])));
  const todo = P.filter((p) => !p.keep && inRun(p.n)), threads = +opt("threads") || Math.max(2, require("os").cpus().length - 1), CD = path.join(SCR, "cands"), PK = path.join(SCR, "picks"), t0 = Date.now();
  const shards = [], cache = new Map();
  for (const p of todo) { const j = jobOf(p), key = keyOf(j), f = path.join(CD, "n-" + p.n + ".json"), c = flag("reuse") && fs.existsSync(f) ? readJ(f) : null, have = c && c.key === key ? c.outs : [];
    cache.set(p.n, { job: j, key, outs: have.slice() }); const per = ((V.candidates.byTag || {})[p.tag] || V.candidates.perLevel) + j.extra, done = new Set(have.map((o) => o.k));
    for (let k = j.k0 ? j.k0 : -1; k < j.k0 + per; k++) if (!done.has(k) && (k >= 0 || j.kept)) shards.push(Object.assign({}, j, { ks: [k, k + 1] })); }
  console.log("bake: " + todo.length + " levels, " + shards.length + " candidates on " + threads + " threads" + (flag("reuse") ? " (" + [...cache.values()].reduce((a, c) => a + c.outs.length, 0) + " reused)" : ""));
  const left = new Map(); for (const sh of shards) left.set(sh.n, (left.get(sh.n) || 0) + 1);
  await CB.runPool(shards, threads, Date.now() + V.wallSec * 1000, (d, t, r, i) => { const c = cache.get(shards[i].n); if (r && r.out) c.outs.push(...r.out); else c.outs.push({ k: shards[i].ks[0], fail: (r && r.fail) || "lost" });
    left.set(shards[i].n, left.get(shards[i].n) - 1); if (!left.get(shards[i].n)) writeJ(path.join(CD, "n-" + shards[i].n + ".json"), { key: c.key, outs: c.outs.slice().sort((a, b) => a.k - b.k) }); // each level's candidates kept as soon as they are all in
    if (d % 50 === 0 || d === t) console.log("  " + d + "/" + t + " candidates  " + ((Date.now() - t0) / 1000).toFixed(0) + " s"); });
  const res = [];
  for (const p of todo) { const c = cache.get(p.n); c.outs.sort((a, b) => a.k - b.k); writeJ(path.join(CD, "n-" + p.n + ".json"), { key: c.key, outs: c.outs }); }
  const picks = await CB.runPool(todo.map((p) => Object.assign({}, cache.get(p.n).job, { outs: cache.get(p.n).outs })), threads, Date.now() + V.wallSec * 1000); // the picks (and their ? cards) in the workers too
  for (const [i, p] of todo.entries()) { const r = picks[i]; r.planned = { feats: p.feats, plan: p.plan, edits: p.edits, care: p.care, band: p.band }; writeJ(path.join(PK, "n-" + p.n + ".json"), r); res.push(r);
    const g = r.level && r.level.grade[p.tag]; console.log("level " + p.n + " " + p.tag + ": " + (r.fail ? "FAIL " + r.fail : "rate " + g.rate + " careful " + g.careful + (p.care != null ? "/" + p.care : "") + " obvious " + g.obvious + " pace " + (g.pace ? Math.round(g.pace.ms / 1000) : "-") + " s taps " + r.level.win[p.tag].length + " (" + r.cands.good + "/" + r.cands.winnable + " good)" + (r.fallback ? "  FALLBACK " + r.fallback : ""))); }
  const fb = res.filter((r) => r.fail || r.fallback); console.log("bake: " + res.length + " levels in " + ((Date.now() - t0) / 1000).toFixed(0) + " s; " + fb.length + " fallbacks" + (fb.length ? ": " + fb.map((r) => r.n).join(", ") : ""));
}

// ---- install -------------------------------------------------------------------------------------------------------------
const ORDER = ["id", "n", "era", "source", "name", "teaches", "hint", "seed", "tag", "band", "target", "v6", "from", "edits", "deck", "w", "h", "grid", "pic", "gates", "towers", "pal", "scene", "style", "palette", "liquid", "lock", "locks", "archers", "hidden", "cols", "links", "win", "grade", "exempt", "inBand", "fallback"];
const ordered = (o) => { const r = {}; for (const k of ORDER) if (o[k] !== undefined) r[k] = o[k]; for (const k of Object.keys(o)) if (r[k] === undefined && o[k] !== undefined) throw new Error("install: unknown field " + k); return r; };
function install(P) {
  const file = path.join(ROOT, "levels/levels.json"), J = readJ(file), rules = CB.rulesV6(CFG), out = [], miss = [];
  for (let L of J.levels) {
    if (L.n > 200 || L.land) { out.push(L); continue; }
    const p = P.find((q) => q.n === L.n);
    if (p.keep) { // teaching and tutorial: the board and deck as they were, graded on the new tag
      L = baseLevels().find((x) => x.n === p.n); const seed = L.source === "teaching" ? CB.seedOf(C, L.n, 0) : L.seed, lv = Object.assign({}, L); for (const k of ["win", "grade", "tag", "band", "target", "inBand", "fallback", "twists", "exempt"]) delete lv[k];
      const g = CB.gradeV6(lv, rules, C, L.win[L.tag], seed, L.n, p.tag); if (!g.win[p.tag]) miss.push(L.n + ": no winning order on " + p.tag);
      out.push(ordered(Object.assign({}, lv, { tag: p.tag, band: p.tag, target: V.bands[p.tag], v6: { keep: p.keep }, win: g.win, grade: g.grade, exempt: p.keep === "teaching" ? "teaching" : "tutorial" }))); continue; }
    L = baseLevels().find((x) => x.n === p.n); // provenance (from, edits) as before the re-deal
    const f = path.join(SCR, "picks", "n-" + L.n + ".json"); if (!fs.existsSync(f)) { miss.push(L.n + ": no pick"); out.push(L); continue; }
    const r = readJ(f); if (r.fail || r.tag !== p.tag) { miss.push(L.n + ": " + (r.fail || "its pick is " + r.tag + ", the plan " + p.tag)); out.push(L); continue; }
    const lv = r.level, rec = { id: L.id, n: L.n, era: L.era, source: "gen", seed: r.seed, tag: p.tag, band: p.tag, target: p.band, v6: { feats: p.feats, links: p.plan.links, mystery: p.plan.mystery, hidden: p.plan.hidden, locks: p.plan.locks, care: p.care, cards: r.mystery ? r.mystery.cards : 0 },
      from: L.from, edits: (L.edits || []).concat(p.edits).length ? (L.edits || []).concat(p.edits) : undefined, deck: r.deck };
    for (const k of BOARD.concat(["lock", "locks", "archers", "hidden", "cols", "links", "win", "grade"])) if (lv[k] !== undefined) rec[k] = lv[k];
    rec.inBand = r.inBand; if (r.fallback) rec.fallback = r.fallback;
    out.push(ordered(rec));
  }
  if (miss.length) { console.log("install: refused, " + miss.join("; ")); process.exitCode = 1; return; }
  J.levels = out; J.bake = Object.assign({}, J.bake, { v6: { date: new Date().toISOString().slice(0, 10), levels: 200, fallbacks: out.filter((l) => l.n <= 200 && l.fallback).map((l) => l.n) } });
  const text = JSON.stringify(J); fs.writeFileSync(file + ".tmp", text); fs.renameSync(file + ".tmp", file);
  // Coach cards that point at a level's lock or tower colour follow the new deal (config.json teach, text-exact edit).
  const cf = path.join(ROOT, "config.json"); let ct = fs.readFileSync(cf, "utf8");
  for (const [id, fn] of Object.entries(V.coach || {})) { const L = out.find((l) => l.id === id); if (!L) continue; const B = E.compile(L), want = fn === "lock" ? B.lockMat : fn === "tower" ? B.towers[0].m : null; if (!want) continue;
    const i = ct.indexOf("\"" + id + "\": ["), e = ct.indexOf("\n", i), j = ct.indexOf("\"card\": ", i), k = ct.indexOf(",", j); if (i < 0 || j < 0 || j > e) continue; ct = ct.slice(0, j) + "\"card\": " + want + ct.slice(k); }
  fs.writeFileSync(cf, ct);
  console.log("install: levels 1-200 written (" + out.filter((l) => l.n <= 200 && l.fallback).length + " fallbacks); " + (out.length - 200) + " later levels kept");
}

// ---- the fix pass: the best-of gate --------------------------------------------------------------------------------------
// A level's gate: its ceiling (careOf: none on Easy or 1-8), its floor, and whether both runs' best sit inside them.
const seedFor = (L) => (L.source === "teaching" ? CB.seedOf(C, L.n, 0) : L.seed);
function gateOf(n, tag, best) { const care = careOf(n, tag), floor = floorOf(n), hi = Math.max(best[0], best[1]), lo = Math.min(best[0], best[1]);
  return { care, floor, over: (care != null && hi > care) || (floor != null && lo < floor) }; }
// The realm table of gate rows {n, era, tag, best [a, b], over}: per realm and tag, the mean best-of (the two runs' mean) and
// how many sit outside their ceiling or floor. was: the before rows (the same shape) for a before / after table.
function gateTable(rows, was) {
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null), f2 = (x) => (x == null ? "-" : x.toFixed(2)), bm = (r) => (r.best[0] + r.best[1]) / 2;
  const lines = ["| Realm | Tag | n | Best-of mean " + (was ? "before / after" : "") + " | Outside the gate " + (was ? "before / after" : "") + " | Ceiling |", "|---|---|---|---|---|---|"];
  for (let e = 1; e <= 8; e++) for (const t of ["all", "easy", "normal", "hard", "extreme"]) {
    const sel = (rs) => rs.filter((r) => r.era === e && (t === "all" || r.tag === t)), A = sel(rows), B = was ? sel(was) : null; if (!A.length) continue;
    const cs = [...new Set(A.map((r) => careOf(r.n, r.tag)).filter((x) => x != null))].join("/");
    lines.push(`| ${e} | ${t} | ${A.length} | ${B ? f2(mean(B.map(bm))) + " / " : ""}${f2(mean(A.map(bm)))} | ${B ? B.filter((r) => r.over).length + " / " : ""}${A.filter((r) => r.over).length} | ${t === "all" ? "" : cs || "none"} |`); }
  const outN = (rs) => rs.filter((r) => r.over).map((r) => r.n + r.tag[0]);
  lines.push("", "Outside the gate" + (was ? " before (" + outN(was).length + "): " + outN(was).join(" ") + "; after" : "") + " (" + outN(rows).length + "): " + (outN(rows).join(" ") || "none") + ".");
  return lines.join("\n");
}
async function deepStep() {
  const LV = readJ(opt("levels") || path.join(ROOT, "levels/levels.json")).levels.filter((l) => l.n <= 200 && !l.land), t0 = Date.now(), threads = +opt("threads") || Math.max(2, require("os").cpus().length - 1);
  const salt = +opt("salt") || 0; // --salt K: the runs on fresh seeds (the level's seed xor K), a check that a pick did not ride its seeds
  const res = await CB.runPool(LV.map((L) => ({ op: "deep", n: L.n, tag: L.tag, level: L, seed: seedFor(L) ^ salt })), threads, Infinity);
  const rows = LV.map((L, i) => { const d = res[i].deep; if (!d) throw new Error("deep: level " + L.n + " " + res[i].fail); const best = [Math.max(...d.a), Math.max(...d.b)];
    return Object.assign({ n: L.n, era: L.era, tag: L.tag, a: d.a, b: d.b, best }, gateOf(L.n, L.tag, best)); });
  if (opt("out")) fs.writeFileSync(opt("out"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(gateTable(rows)); console.log("deep: " + rows.length + " levels in " + ((Date.now() - t0) / 1000).toFixed(0) + " s");
}
// The towers' stone (paintTower) and any palette change since a pick was dealt: a level's colours are the plan board's
// (colours never change play), its palette distances measured again. Returns the level (changed in place) or throws.
function repal(L, board) {
  if (!board || !board.pal) return L; let ch = false;
  for (const k of Object.keys(board.pal)) { if (!L.pal[k] || L.pal[k].r !== board.pal[k].r) throw new Error("repal: level " + L.n + " colour " + k + " is not the plan's"); if (L.pal[k].c !== board.pal[k].c) { L.pal[k] = Object.assign({}, board.pal[k]); ch = true; } }
  if (ch && L.palette) L.palette = paletteOf(L);
  return L;
}
async function regateStep(P) {
  const list = opt("list") ? opt("list").split(",").map(Number) : null, todo = P.filter((p) => !p.keep && (!list || list.indexOf(p.n) >= 0)), threads = +opt("threads") || Math.max(2, require("os").cpus().length - 1), t0 = Date.now();
  const CDs = opt("cands") ? opt("cands").split(",").map((d) => path.resolve(SCR, d)) : [fs.existsSync(path.join(SCR, "cands-s2")) ? path.join(SCR, "cands-s2") : path.join(SCR, "cands")], PK = path.join(SCR, "picks");
  const again = [], moved = []; // moved: a level whose board changed since its pick (a tower moved): a bake, not a re-pick
  const jobs = todo.map((p) => { const pick = readJ(path.join(PK, "n-" + p.n + ".json")), cands = [].concat(...CDs.map((d) => path.join(d, "n-" + p.n + ".json")).filter((f) => fs.existsSync(f)).map((f) => readJ(f).outs.filter((c) => c.level && JSON.stringify(c.level.towers || null) === JSON.stringify(p.board.towers || null)).map((c) => Object.assign(c, { k: c.k + "@" + path.basename(path.dirname(f)) })))); // --cands a,b: every set's graded candidates
    if (JSON.stringify(pick.level.towers || null) !== JSON.stringify(p.board.towers || null) || (pick.level.archers || null) !== (p.plan.archers || null)) { moved.push(p.n); return null; }
    repal(pick.level, p.board); for (const c of cands) if (c.level) repal(c.level, p.board);
    return Object.assign(jobOf(p), { op: "regate", pick, cands, repick: flag("repick") }); });
  const live = jobs.filter(Boolean), res0 = await CB.runPool(live, threads, Infinity, (d, t) => { if (d % 20 === 0 || d === t) console.log("  " + d + "/" + t + " levels  " + ((Date.now() - t0) / 1000).toFixed(0) + " s"); }), res = jobs.map((j) => (j ? res0[live.indexOf(j)] : null));
  for (const n of moved) { console.log("level " + n + ": its board changed (towers), for a bake"); again.push(n); }
  for (const [i, p] of todo.entries()) { const r = res[i]; if (!r) continue;
    if (r.fail) { console.log("level " + p.n + ": FAIL " + r.fail); again.push(p.n); continue; }
    if (r.again) { console.log("level " + p.n + " " + p.tag + ": none of " + r.tried + " passes (was " + r.was.join("/") + ", best " + r.best.map((b) => b.k + ":" + b.best.join("/")).join(" ") + ")"); again.push(p.n); continue; }
    const { was, tried } = r, pk = r.keep ? r.pick : Object.assign(r, { planned: jobs[i].pick.planned, regated: { from: jobs[i].pick.seed, was } }); delete pk.keep; delete pk.was; delete pk.tried;
    writeJ(path.join(PK, "n-" + p.n + ".json"), pk);
    if (!r.keep) console.log("level " + p.n + " " + p.tag + ": re-picked (seed " + pk.seed + ", " + was.join("/") + " -> " + bestOf(pk.level.grade[p.tag]).join("/") + ", " + pk.cands.good + " of " + tried + " pass)" + (pk.fallback ? " FALLBACK " + pk.fallback : "")); }
  console.log("regate: " + todo.length + " levels in " + ((Date.now() - t0) / 1000).toFixed(0) + " s; " + again.length + " for a bake: " + again.join(","));
}
const bestOf = (g) => CB.bestOf(g);

// ---- measure -------------------------------------------------------------------------------------------------------------
function measure() {
  const now = readJ(path.join(ROOT, "levels/levels.json")).levels.filter((l) => l.n <= 200), was = JSON.parse(execSync("git show " + (opt("base") || V.baseCommit) + ":sappers-path/levels/levels.json", { cwd: ROOT, maxBuffer: 1 << 28 }).toString()).levels.filter((l) => l.n <= 200);
  const before = fs.readFileSync(path.join(__dirname, "campaign-v6-baseline-before.jsonl"), "utf8").trim().split("\n").map((s) => JSON.parse(s)), bBy = new Map(before.map((b) => [b.n, b]));
  const rows = now.map((L) => { const g = L.grade[L.tag]; return { n: L.n, era: L.era, tag: L.tag, careful: g.careful, obvious: g.obvious, best: bestOf(g), rate: g.rate, pace: g.pace ? g.pace.ms : g.ms, taps: L.win[L.tag].length, archers: L.archers || null, locks: E.locksOf(L).length, towers: (L.towers || []).length }; });
  const outF = opt("out") || path.join(__dirname, "campaign-v6-baseline-after.jsonl"); fs.writeFileSync(outF, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null), med = (a) => { const q = a.slice().sort((x, y) => x - y); return q.length ? q[(q.length - 1) >> 1] : null; }, f2 = (x) => (x == null ? "-" : x.toFixed(2));
  const lines = ["| Realm | Tag | n before / after | Careful before / after | Obvious before / after | Random tap median before / after | Pace median s before / after | Taps median before / after |", "|---|---|---|---|---|---|---|---|"];
  for (let e = 1; e <= 8; e++) for (const t of ["all", "easy", "normal", "hard", "extreme"]) {
    const A = rows.filter((r) => r.era === e && (t === "all" || r.tag === t)), Bw = was.filter((l) => l.era === e && (t === "all" || l.tag === t)), Bb = before.filter((b) => b.era === e && (t === "all" || b.tag === t));
    if (!A.length && !Bw.length) continue;
    const bp = Bw.map((l) => { const g = l.grade[l.tag]; return g.pace ? g.pace.ms : g.ms; });
    lines.push(`| ${e} | ${t} | ${Bw.length} / ${A.length} | ${f2(mean(Bb.map((b) => b.careful)))} / ${f2(mean(A.map((r) => r.careful)))} | ${f2(mean(Bb.map((b) => b.obvious)))} / ${f2(mean(A.map((r) => r.obvious)))} | ${f2(med(Bw.map((l) => 100 * l.grade[l.tag].rate)))}% / ${f2(med(A.map((r) => 100 * r.rate)))}% | ${Math.round(med(bp) / 1000)} / ${Math.round(med(A.map((r) => r.pace)) / 1000)} | ${med(Bw.map((l) => l.win[l.tag].length))} / ${med(A.map((r) => r.taps))} |`); }
  const MC = CFG.meta.coins, coins = (ls) => ls.reduce((a, l) => a + (MC.win[l.tag] | 0) + (MC.first[l.tag] | 0), 0);
  lines.push("", "Coins a full first clear of 1-200 earns (meta.coins win + first, by tag): before " + coins(was) + ", after " + coins(now) + ".");
  // Fix pass: the best-of gate, before (campaign-v6-fix-before.jsonl, the levels at a4c2fbe) and after (the stored runs).
  const fb = path.join(__dirname, "campaign-v6-fix-before.jsonl");
  if (fs.existsSync(fb) && rows.every((r) => r.best)) lines.push("", "The best-of gate (the careful player 1, 2 and 3 taps deep, 32 games, two seeds; mean of the two runs' best):", "", gateTable(rows.map((r) => Object.assign({}, r, gateOf(r.n, r.tag, r.best))), fs.readFileSync(fb, "utf8").trim().split("\n").map((x) => JSON.parse(x))));
  console.log(lines.join("\n")); void bBy;
  return lines.join("\n");
}

if (require.main === module) {
  const step = argv[0];
  if (step === "plan") { const P = plans(), bad = checkPlan(P); for (const p of P) console.log(p.n + " " + p.tag + (p.keep ? " (" + p.keep + ")" : " [" + p.feats.join(",") + "] links " + p.plan.links + " ? " + p.plan.mystery + " hidden " + JSON.stringify(p.plan.hidden) + " locks " + p.plan.locks.join("+") + " archers " + (p.plan.archers || "-") + " care " + p.care + (p.edits.length ? " " + p.edits.join(",") : "") + (p.kept ? " kept" : ""))); console.log(bad.length ? "PLAN CHECK: " + bad.length + " problems\n  " + bad.join("\n  ") : "plan check: ok"); process.exitCode = bad.length ? 1 : 0; }
  else if (step === "bake") { const P = plans(), bad = checkPlan(P); if (bad.length && !flag("force")) { console.log("plan check failed: " + bad.join("; ")); process.exitCode = 1; } else bake(P); }
  else if (step === "install") install(plans());
  else if (step === "measure") measure();
  else if (step === "deep") deepStep();
  else if (step === "regate") regateStep(plans());
  else console.log("campaign-v6: plan | bake | install | measure | deep | regate");
}
module.exports = { paintTower, paletteOf, planOf, plans, checkPlan, careOf, floorOf, gateOf, gateTable, keyOf, jobOf };
