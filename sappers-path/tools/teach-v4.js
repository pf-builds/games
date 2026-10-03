// Sapper's Path teaching levels (SPEC-v4 §9: the M3 entry, re-authored in v4.1). Writes levels/teaching.json: all nine
// teaching levels are castle pictures (tools/castle.js) at a small size, entered from the bottom, dealt gently, each
// with its lesson placed where the coach can point at it from the first tap:
//   1 Open Gate (the tray), 2 The Waiting Line (a squad whose colour is walled in waits on the holding line), 3 Woodpile
//   (a squad bigger than what is in reach), 26 The Locked Bridge (gate and key: the moat's drawbridge and the gold key in
//   the lodge), 35 Hidden Colours (mystery cards), 51 The Corner Tower (archers; no moat, one tower, archers never kill),
//   62 Linked Squads, 76 The Locked Space (Era 4's opener), 77 All at Once (everything mixed).
// Each level must win on Easy, Normal and Hard (solved and replayed patiently here; the bake stores the orders), stay
// inside the dead-time cap, pass E.check, have a gentle Normal random-tap rate, and be won on Normal by the coach
// follower: a player who taps the coached card first (when the coach points at a card) and then always the first column
// it may (selfTest's coach check does the same). Seeds are searched in a fixed order until a level passes, so the output
// is deterministic. The coach's card for each level (a material id: picture ids go by population) is printed; config.json
// teach holds it.
//   ~/.local/opt/node/bin/node tools/teach-v4.js [--check] [--out DIR]   (--check: rebuild in memory and diff against the
//   file; --out: write DIR/teaching.json instead, for a trial bake's --teach)
"use strict";
const fs = require("fs"), path = require("path");
const E = require("../src/engine.js"), G = require("./gen.js"), R = require("./grade.js");
const C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8")), CFG = require("../config.json");
const FILE = path.join(__dirname, "../levels/teaching.json");
const OUTI = process.argv.indexOf("--out"), DEST = OUTI > 0 ? path.resolve(process.argv[OUTI + 1], "teaching.json") : FILE;
const DIFFS = ["easy", "normal", "hard"], rules = {}; for (const d of DIFFS) rules[d] = E.rulesOf(CFG.v3, d);
const GAP = CFG.v3.twists.linkRowGap;

// The coach's card for a lesson, read from the dealt level at load (Normal): the material id the coach points at, or 0
// when the level doesn't teach it (the seed is skipped). S: a fresh sim; B: compiled; L: the level (pal names roles).
const front = (S) => { const out = []; for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); if (f >= 0) out.push([j, S.B.cardM[f], S.count(f)]); } return out; };
const roleId = (L, name) => { for (const k of Object.keys(L.pal || {})) if (L.pal[k].n === name) return +k; return 0; };
const LESSON = {
  tray: (S) => { const f = front(S).find(([, m]) => S.reachable(m) > 0); return f ? f[1] : 0; },
  holding: (S, B, L) => { const f = front(S)[0]; return f && f[0] === 0 && S.reachable(f[1]) === 0 && f[1] !== E.GILT ? f[1] : 0; },
  overshoot: (S) => { const f = front(S).find(([, m, n]) => S.reachable(m) > 0 && n > S.reachable(m)); if (!f) return 0;
    S.play(f[0]); S.quiet(); for (let q = 0; q < S.cap; q++) if (S.spQ[q] && S.spW[q] > S.reachable(S.spM[q])) return f[1]; return 0; }, // its rest waits once the rest is eaten
  gate: (S, B, L) => { const w = roleId(L, C.picture.roles.wood.name); return w && front(S).some(([, m]) => m === w) && S.reachable(w) > 0 && B.sapTotal[E.GILT] > 0 ? w : 0; },
  archers: (S, B) => { const t = B.towers.length === 1 ? B.towers[0].m : 0; return t && front(S).some(([, m]) => m === t) && S.reachable(t) > 0 ? t : 0; },
  mystery: () => -1, linked: () => -1, lock: () => -1, mixed: () => -1,
};

// gen: the era's generator params with these overrides; colours; deal: dealer overrides; lock; pairs: [[play index, ...]]
// consecutive plays joined (index of the first); flags: [[column, row]] mystery cards; minRate: the gentlest Normal
// random-tap rate accepted; maxMs: the longest patient Normal play-through accepted.
// v4.2: the teaching levels from 26 are full-screen castles a little smaller than the rest (TEACH42: 38 x 37 boards, the
// feature scale 1.8, so a coached level keeps its coach band on a 375x812 phone), dealt with the big squads (DEAL42); their
// patient times are long, so maxMs is a loose bound (the bake reports their real pace). 1-3 are as v4.1 built them.
// beta: the deck's column fill (gen.assign; 77's column by column, so the coach's follower, who taps the leftmost card it
// may, meets the dealt order on a board this size).
const TEACH42 = { w: [36, 36], h: [35, 35], k: 1.8 }, DEAL42 = { size: [40, 99], maxCard: 99, maxTaps: 40, shrink: 0.85, shrinks: 16, tries: 20 };
const SPECS = [
  { n: 1, era: 1, name: "Open Gate", teaches: "tray", hint: "Tap a squad. Its sappers come out at the bottom and each eats the nearest block of their colour.",
    gen: { w: [15, 15], h: [16, 16], watch: [1, 1], fg: [3, 3] }, colours: 4, deal: { size: [30, 60], maxCard: 60 }, minRate: 0.99, maxMs: 90000 },
  { n: 2, era: 1, name: "The Waiting Line", teaches: "holding", hint: "Sappers who can't reach their colour wait on the holding line, and march on their own once it opens up.",
    gen: { w: [16, 16], h: [17, 17], watch: [1, 1], fg: [3, 3] }, colours: 5, deal: { size: [24, 50], maxCard: 50, deep: 1, park: 1 }, minRate: 0.95, maxMs: 90000 },
  { n: 3, era: 1, name: "Woodpile", teaches: "overshoot", hint: "A squad bigger than what's open eats what it can reach. The rest wait, then finish the job.",
    gen: { w: [16, 16], h: [17, 17], watch: [1, 2], fg: [3, 3], first: ["tree", "thatch"] }, colours: 6, deal: { size: [24, 50], maxCard: 50 }, minRate: 0.95, maxMs: 90000 },
  { n: 26, era: 2, name: "The Locked Bridge", teaches: "gate", hint: "The drawbridge is locked: dig out its gold key in the lodge, then send the Looters.",
    gen: Object.assign({}, TEACH42, { twoGates: 0 }), colours: 7, deal: DEAL42, minRate: 0.6, maxMs: 600000 },
  { n: 35, era: 2, name: "Hidden Colours", teaches: "mystery", hint: "A ? squad hides its colour until it reaches the front. Its count always shows.",
    gen: Object.assign({}, TEACH42, { twoGates: 0 }), colours: 7, deal: DEAL42, flags: [[0, 1], [2, 1], [4, 1]], minRate: 0.6, maxMs: 600000 },
  { n: 51, era: 3, name: "The Corner Tower", teaches: "archers", hint: "Archers shoot anyone in their red ring. Take the tower first: here the archers only drive sappers back.", safeArchers: true,
    gen: Object.assign({}, TEACH42, { moat: false, towers: [1, 1], keepH: [8, 11] }), colours: 7, deal: DEAL42, minRate: 0.6, maxMs: 600000 },
  { n: 62, era: 3, name: "Linked Squads", teaches: "linked", hint: "Linked squads go out together and need 2 free spaces; both stay taken until both squads are home.",
    gen: Object.assign({}, TEACH42, { towers: [2, 2] }), colours: 9, deal: DEAL42, pairs: [1], minRate: 0.5, maxMs: 600000 },
  { n: 76, era: 4, name: "The Locked Space", teaches: "lock", hint: "One space starts locked. Its key is a gold block on the board: dig it out and send the Looters.",
    gen: Object.assign({}, TEACH42, { towersOut: [2, 2], towersIn: [0, 0] }), colours: 9, deal: DEAL42, lock: true, minRate: 0.5, maxMs: 600000 },
  { n: 77, era: 4, name: "All at Once", teaches: "mixed", hint: "Gates, archers, ? squads, linked squads and a locked space, all in one castle.",
    gen: Object.assign({}, TEACH42, { w: [32, 32], h: [31, 31], k: 1.6, towersOut: [2, 2], towersIn: [2, 2] }), colours: 10, deal: Object.assign({}, DEAL42, { size: [70, 99], maxTaps: 30 }), beta: 1, lock: true, pairs: [1], flags: [[2, 1], [4, 1]], minRate: 0.15, maxMs: 600000 },
];
const DEAL = { hold: 4, size: [14, 36], deep: 0, finish: 0.4, maxCard: 60, maxCards: 120, tries: 14, maxTaps: 26, maxWaitMs: C.maxWaitMs, shrink: 0.5, shrinks: 5, park: 1, parkMax: C.deal.parkMax, noParkUnderArchers: true };

// The coach scripts (config.json teach), with "@" for the coach's card: the material id the lesson points at, which on a
// picture depends on the level (ids go by population). The bake's teaching levels print theirs; config.json carries them.
const COACH = {
  1: [{ say: "Tap a squad. Its sappers run for their colour.", card: "@", until: "play" }, { say: "The faded squads move up next. Raze it all!", next: true, until: "play" }],
  2: [{ say: "{crew} is walled in. Send it anyway!", card: "@", until: ["wait", "reach:@"] }, { say: "Nothing in reach: they wait in a space.", line: true, if: "wait", until: "play" },
    { say: "If every space is stuck waiting, you lose.", line: true, until: "play" }],
  3: [{ say: "{n} {crew}, {reach} in reach: {go} go.", card: "@", if: "short:@", until: "used:@" }, { say: "The rest wait their turn. Break the wall!", line: true, if: "wait", until: "lineEmpty" }],
  26: [{ say: "A locked gate! Dig out its gold key first.", card: "@", ring: "key", until: ["reach:14", "gate"] }, { say: "Send the Looters: the key opens the gate.", card: 14, ring: "key", if: "front:14", until: "gate" },
    { say: "The gate is open. Raze the castle!", until: "play" }],
  51: [{ say: "Archers shoot the red ring. Tower first!", card: "@", ring: "tower", until: "tower" }, { say: "Tower down: the ring is safe now.", until: "play" }],
};
const coachOf = (n, m) => (COACH[n] ? JSON.parse(JSON.stringify(COACH[n]).replace(/"@"/g, String(m)).replace(/:@/g, ":" + m)) : (CFG.teach || {})[idOf(n)] || null);
const idOf = (n) => "e" + (n <= 25 ? 1 : n <= 50 ? 2 : n <= 75 ? 3 : 4) + "-" + String(n).padStart(2, "0");
// The coach follower on Normal, with the page's coach machine (main.js cond/skipDead/coachStep, read at rest after each
// patient tap): it taps the arrowed card (a card pointer, or a linked front card) when its tap is legal, else the first
// legal column. Returns {won, saw (steps shown), steps}.
function follower(B, steps) {
  const S = E.sim(B, rules.normal); S.logOn = true; let used = 0, reveals = 0, pairs = 0, i = 0, at = 0; const saw = new Set(); steps = steps || [];
  const frontOf = (m) => { for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); if (f >= 0 && B.cardM[f] === m) return j; } return -1; };
  const cond = (k) => { const [w, a] = String(k).split(":"), m = a | 0;
    switch (w) {
      case "play": return S.plays > at; case "line": return S.lineLen > 0; case "lineEmpty": return S.lineLen === 0;
      case "wait": { for (let q = 0; q < S.cap; q++) if (S.spQ[q] && S.spW[q] > S.reachable(S.spM[q])) return true; return false; }
      case "gate": return B.gateCells.every((gc) => S.a[gc[0]] <= 0); case "tower": return S.standing === 0; case "reach": return S.reachable(m) > 0;
      case "used": return !!(used & (1 << m)); case "hit": return S.hits > 0; case "front": return frontOf(m) >= 0;
      case "short": { const j = frontOf(m); return j >= 0 && S.count(S.front(j)) > S.reachable(m); }
      case "reveal": return reveals > 0; case "pair": return pairs > 0; case "unlock": return B.lockKey >= 0 && S.locked === 0; case "locked": return S.locked > 0;
      case "hidden": { for (let j = 0; j < E.NCOL; j++) for (let d = 1; d < 3; d++) { const ci = S.card(j, d); if (ci >= 0 && S.hidden(ci)) return true; } return false; }
      case "linkedFront": { for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); if (f >= 0 && S.partner(f) >= 0) return true; } return false; }
    } return false; };
  const skipDead = () => { while (i < steps.length && steps[i].if && !cond(steps[i].if)) i++; at = S.plays; };
  const advance = () => { for (let g = 0; g <= steps.length && i < steps.length && [].concat(steps[i].until || "play").some(cond); g++) { i++; skipDead(); } };
  skipDead();
  for (let g = 0; g <= B.ncards && S.status === E.PLAYING; g++) {
    if (i < steps.length) saw.add(i);
    const st = steps[i]; let j = -1;
    if (st && st.card) { const k = frontOf(st.card); if (k >= 0 && R.legal(S, k)) j = k; }
    if (j < 0 && st && st.linked) for (let k = 0; k < E.NCOL && j < 0; k++) { const f = S.front(k); if (f >= 0 && S.partner(f) >= 0 && R.legal(S, k)) j = k; }
    if (j < 0) { j = 0; while (j < E.NCOL && !R.legal(S, j)) j++; if (j >= E.NCOL) break; }
    used |= 1 << B.cardM[S.front(j)]; S.clearLog(); S.play(j); S.quiet();
    for (let e = 0; e < S.evLen; e += 3) { if (S.ev[e] === E.EV.REVEAL) reveals++; else if (S.ev[e] === E.EV.LINK) pairs++; }
    advance();
  }
  return { won: S.status === E.WON, saw: saw.size, steps: steps.length };
}
function verify(L, coach, hint) {
  const B = E.compile(L), w = E.check(L, { linkRowGap: GAP }); if (w.length) return { bad: w.join("; ") };
  for (let m = 1; m < E.NMAT; m++) if (m !== E.IRON && B.sapTotal[m] !== B.pix[m]) return { bad: "colour " + m + ": " + B.sapTotal[m] + " sappers for " + B.pix[m] + " pixels" };
  const out = { orders: {} };
  for (const d of DIFFS) {
    const o = R.solve(B, rules[d], 400000, out.orders.easy || hint || null), ln = o && R.line(B, rules[d], o);
    if (!ln || !ln.won) return { bad: d + ": no winning order" };
    out.orders[d] = o; if (d === "normal") { out.ms = ln.ms; out.maxWait = ln.maxWait; }
  }
  out.rate = R.rate(B, rules.normal, 400, 7);
  const f = follower(B, coachOf(L.n, coach)); out.first = f.won && f.saw === f.steps; out.coach = coachOf(L.n, coach);
  return out;
}
function build(spec) {
  const D = Object.assign({}, DEAL, spec.deal || {}, { time: rules.hard.time, lockSpaces: rules.hard.lockSpaces });
  const why = {};
  for (let s = 1; s <= 600; s++) {
    const seed = (C.seed ^ Math.imul(spec.n + 1, 0x9E3779B1) ^ Math.imul(s, 0x85EBCA77)) | 0;
    const L = G.fort(spec.era, seed, Object.assign({}, C.eras[spec.era].gen, { scene: "day" }, spec.gen, { colours: spec.colours }), C.picture); // v4.1 fix: lessons by day if (!L) continue;
    delete L.roles;
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
    // The overshoot lesson: a squad of a colour with a few blocks in reach and the rest walled in goes first (its rest waits).
    if (spec.teaches === "overshoot") { const B0 = E.compile(Object.assign({ cols: [[], [], [], [], []] }, L)), S0 = E.sim(B0, rules.normal); let got = false;
      for (let i = 1; i < play.length && !got; i++) { const [m, n] = play[i]; if (play[i].length > 2 || !(S0.reachable(m) > 0 && n > S0.reachable(m))) continue;
        const next = [play[i]].concat(play.slice(0, i), play.slice(i + 1)), ln = G.dealLine(L, next, D); if (ln.won && ln.maxWait <= D.maxWaitMs) { play = next; got = true; } }
      if (!got && !(play[0] && S0.reachable(play[0][0]) > 0 && play[0][1] > S0.reachable(play[0][0]))) continue; }
    const co = G.assign(play, spec.beta || 0, seed), dk = G.deck(play, co); if (dk.bad) continue;
    if (spec.pairs && dk.links.some(([a, b]) => Math.min(a[1], b[1]) !== 0 || Math.abs(a[1] - b[1]) !== 1)) continue; // the rod shows from the first tap
    const lv = Object.assign({ n: spec.n, era: spec.era, name: spec.name, teaches: spec.teaches, hint: spec.hint }, L, { cols: dk.cols }, dk.links.length ? { links: dk.links } : {}, spec.safeArchers ? { safeArchers: true } : {});
    let flagsOk = true;
    for (const [j, i] of spec.flags || []) { const cd = lv.cols[j][i]; if (!cd || dk.links.some((P) => P.some((q) => q[0] === j && q[1] === i))) { flagsOk = false; break; } cd[2] = E.MYSTERY; }
    if (!flagsOk) continue;
    let coach; try { const B = E.compile(lv); coach = LESSON[spec.teaches](E.sim(B, rules.normal), B, lv); } catch (e) { continue; }
    if (!coach) { why.lesson = (why.lesson || 0) + 1; continue; }
    const v = verify(lv, coach, G.orderOf(co)); if (v.bad) { why.verify = (why.verify || 0) + 1; continue; }
    const miss = v.rate < spec.minRate ? "rate" : v.ms > spec.maxMs ? "time" : v.maxWait > C.maxWaitMs ? "wait" : !v.first ? "coach" : null;
    if (miss) { why[miss] = (why[miss] || 0) + 1; continue; }
    lv.win = v.orders; // the verified orders (inside the dead-time cap): the bake grades the level on them
    return { lv, v, s, coach };
  }
  throw new Error("level " + spec.n + ": no seed in 600 passes " + JSON.stringify(why));
}

const levels = SPECS.map(build).sort((a, b) => a.lv.n - b.lv.n);
const text = JSON.stringify({ version: 5, note: "Teaching levels (SPEC-v3 §5, SPEC-v4 §9 M3 and v4.1): castle pictures entered from the bottom, each with its lesson where the coach can point at it from the first tap. 1-3 the tray, the holding line, a squad bigger than its reach; 26 gate and key; 35 mystery cards; 51 archers; 62 linked squads; 76 the locked space; 77 everything at once. Built by tools/teach-v4.js. Legend in src/engine.js. The bake grades each on Easy, Normal and Hard and stores a winning order for each.", levels: levels.map((x) => x.lv) }, null, 1)
  .replace(/\[\n\s+(\[[\d, ]+\]|[\d.]+|"[^"\n]*")(,\n\s+(\[[\d, ]+\]|[\d.]+|"[^"\n]*"))*\n\s+\]/g, (m) => "[" + m.slice(1, -1).trim().split(/,\n\s+/).join(", ") + "]") + "\n";
if (process.argv.includes("--check")) { const same = fs.readFileSync(FILE, "utf8") === text; console.log(same ? "teaching.json matches a fresh build" : "teaching.json differs from a fresh build"); process.exitCode = same ? 0 : 1; }
else { fs.writeFileSync(DEST, text); console.log("wrote " + DEST); }
{ const bad = levels.filter((x) => COACH[x.lv.n] && JSON.stringify((CFG.teach || {})[idOf(x.lv.n)]) !== JSON.stringify(x.v.coach)).map((x) => idOf(x.lv.n)); console.log(bad.length ? "config.json teach differs for " + bad.join(", ") + ": paste the lines below" : "config.json teach matches this build's coach cards"); }
console.log("config.json teach (the coach's cards for this build):\n" + levels.filter((x) => COACH[x.lv.n]).map((x) => '    "' + idOf(x.lv.n) + '": ' + JSON.stringify(x.v.coach)).join(",\n"));
for (const { lv, v, s, coach } of levels) console.log(String(lv.n).padStart(3) + " " + lv.name.padEnd(18) + lv.w + "x" + lv.h + " seed pass " + s + ", cards " + lv.cols.flat().length + ", taps E/N/H " + DIFFS.map((d) => v.orders[d].length).join("/") + ", Normal random " + (100 * v.rate).toFixed(1) + "%, " + Math.round(v.ms / 1000) + " s, longest tap " + (v.maxWait / 1000).toFixed(1) + " s, coach card " + (coach > 0 ? coach + " (" + (lv.pal[coach] ? lv.pal[coach].n : coach === E.GILT ? "gilt" : "?") + ")" : "-") + (lv.links ? ", links " + JSON.stringify(lv.links) : "") + (lv.lock ? ", lock " + JSON.stringify(lv.lock.key) : ""));
