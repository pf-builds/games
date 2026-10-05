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
//   ~/.local/opt/node/bin/node tools/teach-v4.js [--check] [--out DIR] [--boards FILE]   (--check: rebuild in memory and
//   diff against the file; --out: write DIR/teaching.json instead, for a trial bake's --teach)
// v4.3: each teaching level plays on its fixed tag (tools/tags.js, bake-config tags with teaching on: Easy or Normal,
// never Hard) and is solved, rated (minRate) and coach-followed on that tag only; the file stores its tag and one order
// (win[tag]). `--boards FILE` keeps each level's board (grid, palette, gates, towers, lock) from FILE (the shipped
// teaching.json): first the level as it ships (its deck too, seed pass 0) if it still passes every check under the v4.3
// rules on its tag, else new deals on the kept board (KEEPTRIES seeds), else new forts (and says so).
// v5 R2 (the re-lay): seven teaching levels, 1-3 as before and one milestone lesson opening each realm: 25 moats (The
// Open Bridge: v4.3's Locked Bridge with its drawbridge opened), 50 gates and keys (The Locked Gate: v4.3's linked lesson
// board, towers plain and links dropped), 75 linked squads (Linked Squads: All at Once with towers plain and the flags
// and lock dropped), 100 mystery cards (Hidden Colours, as it was). `--boards FILE` takes tools/relay.js --teach-out's
// file (each level keyed by its new slot, its order on its new tag); new forts take the realm's edits (relay.js
// freshEdits). The new lessons' coach lines are written by hand in config.json teach (LESSON -1: no coach card).
"use strict";
const fs = require("fs"), path = require("path");
const E = require("../src/engine.js"), G = require("./gen.js"), R = require("./grade.js"), TG = require("./tags.js");
const C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8")), CFG = require("../config.json");
const FILE = path.join(__dirname, "../levels/teaching.json");
const OUTI = process.argv.indexOf("--out"), DEST = OUTI > 0 ? path.resolve(process.argv[OUTI + 1], "teaching.json") : FILE;
const rules = {}; for (const d of TG.TAGS) rules[d] = E.rulesOf(CFG.v3, d);
const tagOf = (n) => TG.tagOf(n, C.tags, true); // v4.3: the teaching level's fixed tag
const BI = process.argv.indexOf("--boards"), BOARD = ["w", "h", "grid", "pic", "gates", "towers", "pal", "scene", "style", "palette", "lock"];
const KEEPL = BI > 0 ? new Map(JSON.parse(fs.readFileSync(path.resolve(process.argv[BI + 1]), "utf8")).levels.map((l) => [l.n, l])) : null;
const KEEP = KEEPL ? new Map([...KEEPL].map(([n, l]) => { const b = {}; for (const k of Object.keys(l)) if (BOARD.indexOf(k) >= 0) b[k] = l[k]; return [n, b]; })) : null;
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
  gate: (S, B) => (B.gateCells.length && B.sapTotal[E.GILT] > 0 ? -1 : 0), moat: (S, B) => (B.a0.indexOf(E.WATER) >= 0 ? -1 : 0), // v5 R2: hand-written coach lines
  mystery: () => -1, linked: () => -1,
  // v5 R4: the tower lesson points at the tower's colour (it must be a front card from the first tap); mystery blocks are
  // hand-written lines (no card).
  tower: (S, B) => { const m = B.towers.length ? B.towers[0].m : 0; return m && front(S).some(([, mm]) => mm === m) ? m : 0; }, hidden: (S, B) => (B.nhid ? -1 : 0),
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
const REALM = (n) => C.tags.realms.findIndex((r) => n >= r[0] && n <= r[1]) + 1; // v5 R2: the level's realm
const SPECS = [
  { n: 1, era: 1, name: "Open Gate", teaches: "tray", hint: "Tap a squad. Its sappers come out at the bottom and each eats the nearest block of their colour.",
    gen: { w: [15, 15], h: [16, 16], watch: [1, 1], fg: [3, 3] }, colours: 4, deal: { size: [30, 60], maxCard: 60 }, minRate: 0.99, maxMs: 90000 },
  { n: 2, era: 1, name: "The Waiting Line", teaches: "holding", hint: "Sappers who can't reach their colour wait on the holding line, and march on their own once it opens up.",
    gen: { w: [16, 16], h: [17, 17], watch: [1, 1], fg: [3, 3] }, colours: 5, deal: { size: [24, 50], maxCard: 50, deep: 1, park: 1 }, minRate: 0.95, maxMs: 90000 },
  { n: 3, era: 1, name: "Woodpile", teaches: "overshoot", hint: "A squad bigger than what's open eats what it can reach. The rest wait, then finish the job.",
    gen: { w: [16, 16], h: [17, 17], watch: [1, 2], fg: [3, 3], first: ["tree", "thatch"] }, colours: 6, deal: { size: [24, 50], maxCard: 50 }, minRate: 0.95, maxMs: 90000 },
  { n: 25, era: 2, name: "The Open Bridge", teaches: "moat", hint: "Sappers can't cross water. The drawbridge is down: everything over the moat is reached across the bridge.",
    gen: Object.assign({}, TEACH42, { twoGates: 0 }), colours: 7, deal: DEAL42, minRate: 0.6, maxMs: 600000 },
  { n: 50, era: 3, name: "The Locked Gate", teaches: "gate", hint: "A locked gate bars the way in. Dig out its gold key and send the Looters: the key opens the gate.",
    gen: Object.assign({}, TEACH42, { towers: [2, 2] }), colours: 9, deal: DEAL42, minRate: 0.5, maxMs: 600000 },
  { n: 75, era: 4, name: "Linked Squads", teaches: "linked", hint: "Linked squads go out together: both must be at the front, with 2 free spaces. Both spaces free once both squads have picked up their last blocks.",
    gen: Object.assign({}, TEACH42, { w: [32, 32], h: [31, 31], k: 1.6, towersOut: [2, 2], towersIn: [2, 2] }), colours: 10, deal: Object.assign({}, DEAL42, { size: [70, 99], maxTaps: 30 }), beta: 1, pairs: [1], minRate: 0.15, maxMs: 600000 },
  { n: 100, era: 2, name: "Hidden Colours", teaches: "mystery", hint: "A ? squad hides its colour until it reaches the front. Its count always shows.",
    gen: Object.assign({}, TEACH42, { twoGates: 0 }), colours: 7, deal: DEAL42, flags: [[0, 1], [2, 1], [4, 1]], minRate: 0.6, maxMs: 600000 },
  // v5 R4: the lessons opening Emberwatch Crags (archer towers; archers only knock sappers back) and The Shrouded Weald
  // (mystery blocks), on their realms' boards with the plan's features set by hand: a lava moat with an open causeway and
  // one tower; a forest stream with an open bridge and a share of the castle hidden.
  { n: 125, era: 6, name: "The Archer Tower", teaches: "tower", hint: "Archers shoot every sapper sent into their ring. A hit sapper is knocked back and waits. Knock the tower down and the ring is safe.",
    gen: Object.assign({}, TEACH42, { scene: "ember", moat: true, gates: 0, towers: [1, 1] }), colours: 8, deal: DEAL42, minRate: 0.5, maxMs: 600000 },
  { n: 150, era: 7, name: "Hidden Blocks", teaches: "hidden", hint: "A ? block hides its colour until a block beside it is dug out. Then it shows for good.",
    gen: Object.assign({}, TEACH42, { scene: "moonlit", moat: true, gates: 0, towers: 0 }), colours: 9, deal: DEAL42, hidden: true, minRate: 0.5, maxMs: 600000 },
];
const DEAL = { hold: 5, size: [14, 36], deep: 0, finish: 0.4, maxCard: 60, maxCards: 120, tries: 14, maxTaps: 26, maxWaitMs: C.maxWaitMs, shrink: 0.5, shrinks: 5, park: 1, parkMax: C.deal.parkMax, noParkUnderArchers: true };

// The coach scripts (config.json teach), with "@" for the coach's card: the material id the lesson points at, which on a
// picture depends on the level (ids go by population). The bake's teaching levels print theirs; config.json carries them.
const COACH = {
  1: [{ say: "Tap a squad. Its sappers run for their colour.", card: "@", until: "play" }, { say: "The faded squads move up next. Raze it all!", next: true, until: "play" }],
  2: [{ say: "{crew} is walled in. Send it anyway!", card: "@", until: ["wait", "reach:@"] }, { say: "Nothing in reach: they wait in a space.", line: true, if: "wait", until: "play" },
    { say: "If every space is stuck waiting, you lose.", line: true, until: "play" }],
  3: [{ say: "{n} {crew}, {reach} in reach: {go} go.", card: "@", if: "short:@", until: "used:@" }, { say: "The rest wait their turn. Break the wall!", line: true, if: "wait", until: "lineEmpty" }],
  125: [{ say: "Archers shoot inside the red ring. Tower first!", short: "Tower first!", card: "@", ring: "tower", until: "tower" }, { say: "Tower down: the ring is safe now.", short: "The ring is safe now.", until: "play" },
    { say: "New power-up! The Volley clears one colour.", short: "New: the Volley!", power: "volley", until: "play" }], // v5 R4
};
const coachOf = (n, m) => (COACH[n] ? JSON.parse(JSON.stringify(COACH[n]).replace(/"@"/g, String(m)).replace(/:@/g, ":" + m)) : (CFG.teach || {})[idOf(n)] || null);
const idOf = (n) => "e" + REALM(n) + "-" + String(n).padStart(2, "0"); // v5 R2: the realm
// The coach follower on the level's tag (v4.3; Normal before), with the page's coach machine (main.js cond/skipDead/coachStep, read at rest after each
// patient tap): it taps the arrowed card (a card pointer, or a linked front card) when its tap is legal, else the first
// legal column. Returns {won, saw (steps shown), steps}.
function follower(B, steps, rt) {
  const S = E.sim(B, rt); S.logOn = true; let used = 0, reveals = 0, pairs = 0, i = 0, at = 0; const saw = new Set(); steps = steps || [];
  const frontOf = (m) => { for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); if (f >= 0 && B.cardM[f] === m) return j; } return -1; };
  const cond = (k) => { const [w, a] = String(k).split(":"), m = a | 0;
    switch (w) {
      case "play": return S.plays > at; case "line": return S.lineLen > 0; case "lineEmpty": return S.lineLen === 0;
      case "wait": { for (let q = 0; q < S.cap; q++) if (S.spQ[q] && S.spW[q] > S.reachable(S.spM[q])) return true; return false; }
      case "gate": return B.gateCells.every((gc) => S.a[gc[0]] <= 0); case "tower": return S.standing === 0; case "reach": return S.reachable(m) > 0;
      case "used": return !!(used & (1 << m)); case "hit": return S.hits > 0; case "front": return frontOf(m) >= 0;
      case "short": { const j = frontOf(m); return j >= 0 && S.count(S.front(j)) > S.reachable(m); }
      case "reveal": return reveals > 0; case "pair": return pairs > 0; case "unlock": return (B.lockKey >= 0 || B.lockMat > 0) && S.locked === 0; case "locked": return S.locked > 0;
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
  const out = { orders: {} }, d = tagOf(L.n), rt = rules[d];
  const o = R.solve(B, rt, 400000, hint || null), ln = o && R.line(B, rt, o);
  if (!ln || !ln.won) return { bad: d + ": no winning order" };
  out.orders[d] = o; out.ms = ln.ms; out.maxWait = ln.maxWait;
  out.rate = R.rate(B, rt, 400, 7);
  const f = follower(B, coachOf(L.n, coach), rt); out.first = f.won && f.saw === f.steps; out.coach = coachOf(L.n, coach);
  return out;
}
// The checks every built teaching level passes (null) or the first it misses.
const missOf = (spec, v) => (v.rate < spec.minRate ? "rate" : v.ms > spec.maxMs ? "time" : v.maxWait > C.maxWaitMs ? "wait" : !v.first ? "coach" : null);
function build(spec) {
  const D = Object.assign({}, DEAL, spec.deal || {}, { time: rules.hard.time, lockSpaces: rules.hard.lockSpaces });
  const why = {};
  if (KEEPL && KEEPL.get(spec.n)) { // v4.3 --boards: the shipped level as it is (board and deck), re-verified on its tag
    const K = KEEPL.get(spec.n), lv = Object.assign({ n: spec.n, era: REALM(spec.n), name: spec.name, teaches: spec.teaches, tag: tagOf(spec.n), hint: spec.hint }, KEEP.get(spec.n), { cols: JSON.parse(JSON.stringify(K.cols)) }, K.links ? { links: K.links } : {}, spec.safeArchers ? { safeArchers: true } : {});
    let coach = 0; try { const B = E.compile(lv); coach = LESSON[spec.teaches](E.sim(B, rules[tagOf(spec.n)]), B, lv); } catch (e) { coach = 0; }
    const v = coach ? verify(lv, coach, K.win && K.win[tagOf(spec.n)]) : { bad: "lesson" };
    if (!v.bad && !missOf(spec, v)) { lv.win = v.orders; return { lv, v, s: 0, coach, kept: true }; }
    console.log("level " + spec.n + ": the shipped deck no longer passes (" + (v.bad || missOf(spec, v)) + "); new deals on its board");
  }
  for (let s = 1; s <= 600; s++) {
    const seed = (C.seed ^ Math.imul(spec.n + 1, 0x9E3779B1) ^ Math.imul(s, 0x85EBCA77)) | 0;
    const kept = KEEP && KEEP.get(spec.n) && s <= KEEPTRIES; // v4.3 --boards: the shipped board first, new forts after KEEPTRIES seeds
    const L = kept ? JSON.parse(JSON.stringify(KEEP.get(spec.n))) : G.fort(spec.era, seed, Object.assign({}, C.eras[spec.era].gen, { scene: "day" }, spec.gen, { colours: spec.colours }), C.picture); // v4.1 fix: lessons by day if (!L) continue;
    if (!L) continue;
    delete L.roles;
    if (!kept && (spec.era === 2 || spec.era === 4) && !(L.gates && L.gates.length)) continue; // (v5 R2: a kept board may have opened its gates)
    if (!kept && spec.era <= 4) { const RL = require("./relay.js"), r = REALM(spec.n); if (r >= 3) RL.ED.dropTowers(L); if (r === 2) RL.ED.openGates(L, []); RL.prune(L, CFG.v3); } // v5 R2: the realm's edits on a new fort (a lesson keeps its gates from 50)
    if (!kept && spec.teaches === "tower" && !(L.towers && L.towers.length)) continue; // v5 R4
    if (!kept && spec.hidden && !G.hide(L, seed, C.plan.hidden)) continue;
    if (spec.lock && !kept && !G.lockKey(L, seed)) continue;
    if (spec.teaches === "gate" && !(L.gates && L.gates.length)) continue;
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
    if (spec.teaches === "overshoot") { const B0 = E.compile(Object.assign({ cols: [[], [], [], [], []] }, L)), S0 = E.sim(B0, rules[tagOf(spec.n)]); let got = false;
      for (let i = 1; i < play.length && !got; i++) { const [m, n] = play[i]; if (play[i].length > 2 || !(S0.reachable(m) > 0 && n > S0.reachable(m))) continue;
        const next = [play[i]].concat(play.slice(0, i), play.slice(i + 1)), ln = G.dealLine(L, next, D); if (ln.won && ln.maxWait <= D.maxWaitMs) { play = next; got = true; } }
      if (!got && !(play[0] && S0.reachable(play[0][0]) > 0 && play[0][1] > S0.reachable(play[0][0]))) continue; }
    const co = G.assign(play, spec.beta || 0, seed), dk = G.deck(play, co); if (dk.bad) continue;
    if (spec.pairs && dk.links.some(([a, b]) => Math.min(a[1], b[1]) !== 0 || Math.abs(a[1] - b[1]) !== 1)) continue; // the rod shows from the first tap
    const lv = Object.assign({ n: spec.n, era: REALM(spec.n), name: spec.name, teaches: spec.teaches, tag: tagOf(spec.n), hint: spec.hint }, L, { cols: dk.cols }, dk.links.length ? { links: dk.links } : {}, spec.safeArchers ? { safeArchers: true } : {});
    let flagsOk = true;
    for (const [j, i] of spec.flags || []) { const cd = lv.cols[j][i]; if (!cd || dk.links.some((P) => P.some((q) => q[0] === j && q[1] === i))) { flagsOk = false; break; } cd[2] = E.MYSTERY; }
    if (!flagsOk) continue;
    let coach; try { const B = E.compile(lv); coach = LESSON[spec.teaches](E.sim(B, rules[tagOf(spec.n)]), B, lv); } catch (e) { continue; }
    if (!coach) { why.lesson = (why.lesson || 0) + 1; continue; }
    const v = verify(lv, coach, G.orderOf(co)); if (v.bad) { why.verify = (why.verify || 0) + 1; continue; }
    const miss = missOf(spec, v);
    if (miss) { why[miss] = (why[miss] || 0) + 1; continue; }
    lv.win = v.orders; // the verified order on the tag (inside the dead-time cap): the bake grades the level on it
    if (KEEP && KEEP.get(spec.n) && !kept) console.log("level " + spec.n + ": its kept board found no passing deal in " + KEEPTRIES + " seeds; a new board");
    return { lv, v, s, coach, kept };
  }
  throw new Error("level " + spec.n + ": no seed in 600 passes " + JSON.stringify(why));
}

const KEEPTRIES = 300; // v4.3 --boards: deal seeds tried on a kept board before new forts are drawn
// v5 R4 --add N,N: build only those lessons; every other level is kept from levels/teaching.json exactly as it is.
const ADDI = process.argv.indexOf("--add"), ADD = ADDI > 0 ? process.argv[ADDI + 1].split(",").map(Number) : null;
const OLD = ADD ? JSON.parse(fs.readFileSync(FILE, "utf8")).levels.filter((l) => ADD.indexOf(l.n) < 0) : [];
const levels = OLD.map((lv) => ({ lv, v: { orders: lv.win, rate: 0, ms: 0, maxWait: 0 }, s: -1, coach: 0, kept: true, old: true })).concat(SPECS.filter((s) => !ADD || ADD.indexOf(s.n) >= 0).map(build)).sort((a, b) => a.lv.n - b.lv.n);
const text = JSON.stringify({ version: 6, note: "Teaching levels (SPEC-v3 §5, SPEC-v4 §9 M3 and v4.1): castle pictures entered from the bottom, each with its lesson where the coach can point at it from the first tap. 1-3 the tray, the holding line, a squad bigger than its reach; v5 R2, one lesson opening each realm: 25 moats, 50 gates and keys, 75 linked squads, 100 mystery cards. Built by tools/teach-v4.js. Legend in src/engine.js. v4.3: each plays on its fixed tag (tag; Easy or Normal) and stores one winning order on it (win[tag]). v5 R2: the boards and decks are v4.3's teaching levels re-laid by tools/relay.js (teach-v4.js --boards on its --teach-out file).", levels: levels.map((x) => x.lv) }, null, 1)
  .replace(/\[\n\s+(\[[\d, ]+\]|[\d.]+|"[^"\n]*")(,\n\s+(\[[\d, ]+\]|[\d.]+|"[^"\n]*"))*\n\s+\]/g, (m) => "[" + m.slice(1, -1).trim().split(/,\n\s+/).join(", ") + "]") + "\n";
if (process.argv.includes("--check")) { const same = fs.readFileSync(FILE, "utf8") === text; console.log(same ? "teaching.json matches a fresh build" : "teaching.json differs from a fresh build"); process.exitCode = same ? 0 : 1; }
else { fs.writeFileSync(DEST, text); console.log("wrote " + DEST); }
{ const bad = levels.filter((x) => !x.old && COACH[x.lv.n] && JSON.stringify((CFG.teach || {})[idOf(x.lv.n)]) !== JSON.stringify(x.v.coach)).map((x) => idOf(x.lv.n)); console.log(bad.length ? "config.json teach differs for " + bad.join(", ") + ": paste the lines below" : "config.json teach matches this build's coach cards"); }
console.log("config.json teach (the coach's cards for this build):\n" + levels.filter((x) => !x.old && COACH[x.lv.n]).map((x) => '    "' + idOf(x.lv.n) + '": ' + JSON.stringify(x.v.coach)).join(",\n"));
const x0 = (n) => levels.find((x) => x.lv.n === n).kept;
for (const { lv, v, s, coach } of levels.filter((x) => !x.old)) console.log(String(lv.n).padStart(3) + " " + lv.name.padEnd(18) + lv.w + "x" + lv.h + " seed pass " + s + (KEEP ? (s === 0 ? " (shipped deck)" : x0(lv.n) ? " (kept board)" : " (NEW board)") : "") + ", cards " + lv.cols.flat().length + ", tag " + lv.tag + ", taps " + v.orders[lv.tag].length + ", random " + (100 * v.rate).toFixed(1) + "%, " + Math.round(v.ms / 1000) + " s, longest tap " + (v.maxWait / 1000).toFixed(1) + " s, coach card " + (coach > 0 ? coach + " (" + (lv.pal[coach] ? lv.pal[coach].n : coach === E.GILT ? "gilt" : "?") + ")" : "-") + (lv.links ? ", links " + JSON.stringify(lv.links) : "") + (lv.lock ? ", lock " + JSON.stringify(lv.lock.key) : ""));
