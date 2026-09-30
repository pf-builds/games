// Sapper's Path v4 M3 teaching levels (SPEC-v4 §9, the M3 entry). Writes levels/teaching.json:
//   1-3   re-authored at the new board size (drawn below), so the first taps already show a squad pouring out as a swarm
//         and the step to level 4's bigger boards is small; the same lessons (the tray, the holding line, a squad bigger
//         than what is in reach) and the same coach lines;
//   26, 51 kept as they were (gate and key, archers);
//   35    mystery cards, 62 linked squads, 76 the locked space (the Era 4 opener), 77 everything at once: each a seeded
//         generator fort of its era at a small size, dealt gently (big squads, nothing parked), with its twist placed by
//         hand where the coach can point at it from the first tap.
// Each level must win on Easy, Normal and Hard (solved and replayed patiently here; the bake stores the orders), stay
// inside the dead-time cap, pass E.check, and (the built ones) be won on Normal by a player who always taps the first
// column it may (selfTest's coach check follows the arrow, and taps that column whenever the arrow isn't on a card). Seeds are searched in a fixed order until a level passes, so the output is
// deterministic.   ~/.local/opt/node/bin/node tools/teach-v4.js [--check] [--out DIR]   (--check: rebuild in memory and
// diff against the file; --out: write DIR/teaching.json instead, for a trial bake's --teach)
"use strict";
const fs = require("fs"), path = require("path");
const E = require("../src/engine.js"), G = require("./gen.js"), R = require("./grade.js");
const C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8")), CFG = require("../config.json");
const FILE = path.join(__dirname, "../levels/teaching.json"), OLD = JSON.parse(fs.readFileSync(FILE, "utf8")).levels;
const OUTI = process.argv.indexOf("--out"), DEST = OUTI > 0 ? path.resolve(process.argv[OUTI + 1], "teaching.json") : FILE;
const DIFFS = ["easy", "normal", "hard"], rules = {}; for (const d of DIFFS) rules[d] = E.rulesOf(CFG.v3, d);
const GAP = CFG.v3.twists.linkRowGap;

// ---- 1-3, drawn by hand -----------------------------------------------------------------------------------------------
const DRAWN = [
  { n: 1, era: 1, name: "Open Gate", teaches: "tray", hint: "Tap a squad. Its sappers march from the camp and each eats the nearest pixel of their colour.",
    grid: ["....................", "....................", ".....aaaaaaaaaa.....", "....aaaaaaaaaaaa....", "...aa,,,,,,,,,,aa...", "...aa,,kkkkkk,,aa...", "...aa,kkkkkkkk,aa...", "...aa,kkkkkkkk,aa...",
      "...aa,kkkkkkkk,aa...", "...aa,,kkkkkk,,aa...", "...aa,,,,,,,,,,aa...", "....aaaaa,,aaaaa....", ".....aaaa,,aaaa.....", "....................", "....................", "....................", ".......######.......", ".......######......."],
    cols: [[[1, 24]], [[11, 12], [11, 12]], [[1, 22]], [[11, 12]], [[1, 22]]] },
  { n: 2, era: 1, name: "The Waiting Line", teaches: "holding", hint: "Sappers who can't reach their colour wait on the holding line, and march on their own once it opens up.",
    grid: ["....................", "....aaaaaaaaaaaa....", "...aa,,,,,,,,,,aa...", "..aa,,,,,,,,,,,,aa..", "..a,,,dddddddd,,,a..", "..a,,,dddddddd,,,a..", "..a,,,ddccccdd,,,a..", "..a,,,ddccccdd,,,a..",
      "..a,,,ddccccdd,,,a..", "..a,,,dddddddd,,,a..", "..a,,,dddddddd,,,a..", "..aa,,,,,,,,,,,,aa..", "...aa,,,,,,,,,,aa...", "....aaaaaaaaaaaa....", "....................", "....................", ".......######.......", ".......######......."],
    cols: [[[3, 12], [1, 18]], [[1, 18]], [[4, 22]], [[1, 18]], [[4, 22]]] },
  { n: 3, era: 1, name: "Woodpile", teaches: "overshoot", hint: "A squad bigger than what's open eats what it can reach. The rest wait, then finish the job.",
    grid: ["....................", "....aaaaaaaaaaaa....", "...aa,,,,,,,,,,aa...", "..aa,,,,,,,,,,,,aa..", "..a,,,dddddddd,,,a..", "..a,,,dddddddd,,,a..", "..a,,,ddccccdd,,,a..", "..a,,,ddccccdd,,,a..",
      "..a,,,dddddddd,,,a..", "..a,,,dddddddd,,,a..", "..aa,,,,,,,,,,,,aa..", "...aa,,,,,,,,,,aa...", "....aaaaaaaaaaaa....", "....................", "...dd..........dd...", "...dd..........dd...", "....................", ".......######.......", ".......######......."],
    cols: [[[4, 20], [1, 18]], [[1, 17]], [[1, 17], [3, 8]], [[4, 14]], [[4, 14]]] },
];

// ---- 35, 62, 76, 77: generator forts with hand-placed twists ------------------------------------------------------------
// gen: the era's generator params with these overrides; colours; lock; pairs: [[play index, ...]] consecutive plays joined
// (index of the first); flags: [[column, row]] mystery cards; minRate: the gentlest Normal random-tap rate accepted;
// maxMs: the longest patient Normal play-through accepted.
const BUILT = [
  { n: 35, era: 2, name: "Hidden Colours", teaches: "mystery", hint: "A ? squad hides its colour until it reaches the front. Its count always shows.",
    gen: { w: [20, 23], h: [24, 28], twoGates: 0 }, colours: 6, flags: [[0, 1], [2, 1], [4, 1]], minRate: 0.6, maxMs: 110000 },
  { n: 62, era: 3, name: "Linked Squads", teaches: "linked", hint: "Linked squads go out together and need 2 free spaces; both stay taken until both squads are home.",
    gen: { w: [24, 27], h: [30, 34], towers: [1, 2], moat: 0 }, colours: 7, pairs: [1], minRate: 0.5, maxMs: 150000 },
  { n: 76, era: 4, name: "The Locked Space", teaches: "lock", hint: "One space starts locked. Its key is a gold block on the board: dig it out and send the Looters.",
    gen: { w: [30, 33], h: [36, 40], towersOut: [1, 2], towersIn: [0, 0], ward: [3, 4] }, colours: 8, lock: true, minRate: 0.5, maxMs: 170000 },
  { n: 77, era: 4, name: "All at Once", teaches: "mixed", hint: "Gates, archers, ? squads, linked squads and a locked space, all in one castle.",
    gen: { w: [32, 35], h: [38, 42], towersOut: [2, 2], towersIn: [1, 1], ward: [3, 4] }, colours: 9, lock: true, pairs: [2], flags: [[0, 1], [4, 1]], minRate: 0.3, maxMs: 200000 },
];
const DEAL = { hold: 4, size: [14, 36], deep: 0, finish: 0.4, maxCard: 60, maxCards: 120, tries: 14, maxTaps: 26, maxWaitMs: C.maxWaitMs, shrink: 0.5, shrinks: 5, park: 1, noParkUnderArchers: true };

function verify(L) {
  const B = E.compile(L), w = E.check(L, { linkRowGap: GAP }); if (w.length) return { bad: w.join("; ") };
  let sum = 0; for (let m = 1; m < E.NMAT; m++) sum += B.sapTotal[m];
  if (sum !== B.pixTotal - B.pix[E.IRON]) return { bad: "sappers don't sum to the fort's eatable pixels" };
  for (let m = 1; m < E.NMAT; m++) if (m !== E.IRON && B.sapTotal[m] !== B.pix[m]) return { bad: "colour " + m + ": " + B.sapTotal[m] + " sappers for " + B.pix[m] + " pixels" };
  const out = { orders: {} };
  for (const d of DIFFS) {
    const o = R.solve(B, rules[d], 400000, out.orders.easy || null), ln = o && R.line(B, rules[d], o);
    if (!ln || !ln.won) return { bad: d + ": no winning order" };
    out.orders[d] = o; if (d === "normal") { out.ms = ln.ms; out.maxWait = ln.maxWait; }
  }
  out.rate = R.rate(B, rules.normal, 400, 7);
  const S = E.sim(B, rules.normal); for (let g = 0; g <= B.ncards && S.status === E.PLAYING; g++) { let j = 0; while (j < E.NCOL && !R.legal(S, j)) j++; if (j >= E.NCOL) break; S.play(j); S.quiet(); }
  out.first = S.status === E.WON;
  return out;
}
function build(spec) {
  const D = Object.assign({}, DEAL, { time: rules.hard.time, lockSpaces: rules.hard.lockSpaces });
  for (let s = 1; s <= 400; s++) {
    const seed = (C.seed ^ Math.imul(spec.n + 1, 0x9E3779B1) ^ Math.imul(s, 0x85EBCA77)) | 0;
    const L = G.fort(spec.era, seed, Object.assign({}, C.eras[spec.era].gen, spec.gen, { colours: spec.colours })); if (!L) continue;
    if ((spec.era === 2 || spec.era === 4) && !(L.gates && L.gates.length)) continue;
    if (spec.lock && !G.lockKey(L, seed)) continue;
    let dl = null; for (let a = 0; a < 6 && !dl; a++) dl = G.deal(L, seed ^ Math.imul(a + 1, 0x27D4EB2F), D);
    if (!dl) continue;
    let play = dl.play.map((c) => c.slice()), okPairs = true;
    for (const i of spec.pairs || []) {
      if (!play[i + 1] || play[i].length > 2 || play[i + 1].length > 2 || play[i][0] === play[i + 1][0]) { okPairs = false; break; }
      const next = play.slice(0, i).concat([[play[i][0], play[i][1], play[i + 1][0], play[i + 1][1]]], play.slice(i + 2)), ln = G.dealLine(L, next, D);
      if (!ln.won || ln.maxWait > D.maxWaitMs) { okPairs = false; break; }
      play = next;
    }
    if (!okPairs) continue;
    const dk = G.deck(play, G.assign(play, 0, seed)); if (dk.bad) continue;
    if (spec.pairs && dk.links.some(([a, b]) => Math.min(a[1], b[1]) !== 0 || Math.abs(a[1] - b[1]) !== 1)) continue; // the rod shows from the first tap
    const lv = Object.assign({ n: spec.n, era: spec.era, name: spec.name, teaches: spec.teaches, hint: spec.hint }, L, { cols: dk.cols }, dk.links.length ? { links: dk.links } : {});
    let flagsOk = true;
    for (const [j, i] of spec.flags || []) { const cd = lv.cols[j][i]; if (!cd || dk.links.some((P) => P.some((q) => q[0] === j && q[1] === i))) { flagsOk = false; break; } cd[2] = E.MYSTERY; }
    if (!flagsOk) continue;
    const v = verify(lv); if (v.bad) continue;
    if (v.rate < spec.minRate || v.ms > spec.maxMs || v.maxWait > C.maxWaitMs || !v.first) continue;
    return { lv, v, s };
  }
  throw new Error("level " + spec.n + ": no seed in 400 passes");
}

const levels = [];
for (const d of DRAWN) { const lv = Object.assign({ n: d.n, era: d.era, name: d.name, teaches: d.teaches, hint: d.hint, w: d.grid[0].length, h: d.grid.length, grid: d.grid, cols: d.cols }); const v = verify(lv); if (v.bad) throw new Error("level " + d.n + ": " + v.bad); levels.push({ lv, v, s: 0 }); }
for (const n of [26, 51]) { const lv = OLD.find((l) => l.n === n); levels.push({ lv, v: verify(lv), s: 0 }); }
for (const b of BUILT) levels.push(build(b));
levels.sort((a, b) => a.lv.n - b.lv.n);
const text = JSON.stringify({ version: 4, note: "Teaching levels (SPEC-v3 §5, SPEC-v4 §9 M3): levels 1-3 re-authored at the v4 board size, 26 (gate and key) and 51 (archers) from v3, and the v4 twists: 35 mystery cards, 62 linked squads, 76 the locked space, 77 everything at once. Built by tools/teach-v4.js. Legend in src/engine.js. The bake grades each on Easy, Normal and Hard and stores a winning order for each.", levels: levels.map((x) => x.lv) }, null, 1)
  .replace(/\[\n\s+(\[[\d, ]+\]|[\d.]+|"[^"\n]*")(,\n\s+(\[[\d, ]+\]|[\d.]+|"[^"\n]*"))*\n\s+\]/g, (m) => "[" + m.slice(1, -1).trim().split(/,\n\s+/).join(", ") + "]") + "\n";
if (process.argv.includes("--check")) { const same = fs.readFileSync(FILE, "utf8") === text; console.log(same ? "teaching.json matches a fresh build" : "teaching.json differs from a fresh build"); process.exitCode = same ? 0 : 1; }
else { fs.writeFileSync(DEST, text); console.log("wrote " + DEST); }
for (const { lv, v, s } of levels) console.log(String(lv.n).padStart(3) + " " + lv.name.padEnd(18) + lv.w + "x" + lv.h + (s ? " seed pass " + s : "") + ", cards " + lv.cols.flat().length + ", taps E/N/H " + DIFFS.map((d) => v.orders[d].length).join("/") + ", Normal random " + (100 * v.rate).toFixed(1) + "%, " + Math.round(v.ms / 1000) + " s, longest tap " + (v.maxWait / 1000).toFixed(1) + " s" + (lv.links ? ", links " + JSON.stringify(lv.links) : "") + (lv.lock ? ", lock " + JSON.stringify(lv.lock.key) : ""));
