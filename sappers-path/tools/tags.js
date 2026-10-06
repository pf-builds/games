// Sapper's Path v4.3 level tags (SPEC-v4 §9, the v4.3 entry). There is no difficulty picker: every level plays on one
// fixed tag, Easy (6 holding spaces), Normal (5) or Hard (4, archers lethal; level 51 keeps safeArchers), from its place
// in the campaign. T (bake config `tags`, Gallery config `bake.tags`):
//   ends: the era ends (Hard: every era ends on a Hard boss); the level after one is Easy (a breather);
//   teaching levels: `first` before `from`, `afterEnd` right after an era end, else `teach` (Easy or Normal, never Hard);
//   other levels before `from`: `first`; from `from` on, `cycle` repeating (a Hard every 4-5 levels, an Easy after the
//   second Hard of each round).
//   tagOf(n, T, teaching) -> "easy" | "normal" | "hard"
// The bands follow the tag (bake config curve.byTag): a Hard level takes its section's hardest band, an Easy one the
// gentlest, so the tag a player reads is the difficulty the grader measured (on the tag's own rules).
// v5 R1: the tag sets no engine rule (5 spaces everywhere, archers never kill); it says how many features a level uses.
// Locks live on Hard levels only, from a set level: lockOK(n, tag, L, K) with K = config.json v5.locks {from, tags}: a
// level with a lock (key or colour) must be number from or later and carry one of K.tags; a level without one is fine.
// v5 R2 (the rules review's feature ladder): with T.realms ([[from, to], ...], the made-up realms) the schedule runs per
// realm: every realm ends on a Hard level; its first level teaches the realm's new feature (a teaching level, `afterEnd`:
// Easy); the cycle restarts after the opener (realm 1 keeps `from`, so levels 1-24 carry v4.3's tags). Without realms
// (the Gallery) the v4.3 schedule stands.
// v5 R2, tags by feature density (config.json v5.density; the rules review: "Easy uses few or none of them, Normal uses
// more, Hard uses a lot"): featuresOf(L) lists the features a level uses (moat: water on the board; gate: a closed gate;
// linked: a linked pair; mystery: a ? card; hidden: a mystery block; tower: an archer tower; lock: a locked space);
// unlockedAt(n, D) the ladder's features open by level n; densityOK(n, tag, L, D, teaching) the rule: no feature before
// its milestone; Easy at most D.easyMax of them and no lock; Normal at least min(D.normalMin, unlocked) and no lock; Hard
// every unlocked feature, plus the lock from D.lockFrom; Extreme (from 125) as Hard. A teaching level (a realm's opener,
// Easy) uses the newest feature it teaches, may keep older ones, and has no lock.
// v5 R4: from D.extremeFrom (125, where Extreme appears) Hard uses all but at most D.hardSlack (1) of the unlocked features
// and the lock; Extreme uses every one and the lock. T.cycles (keyed by a realm's first level): that realm's own cycle from
// its start, and its end tag (realms 6-8 end Extreme).
"use strict";
const TAGS = ["easy", "normal", "hard", "extreme"]; // v5 R1: extreme (most or all of the unlocked features; R2 sets which levels)
function tagOf(n, T, teaching) {
  const R = T.realms && T.realms.find((r) => n >= r[0] && n <= r[1]); // v5 R2: the realm's own schedule
  if (R) {
    if (teaching) return n < T.from ? T.first : n === R[0] ? T.afterEnd : T.teach;
    const Y = T.cycles && T.cycles[R[0]]; // v5 R4: the realm's own cycle and end tag
    if (Y) return n === R[1] ? Y.end : Y.cycle[(n - Y.start) % Y.cycle.length];
    if (n === R[1]) return "hard";
    if (n < T.from) return T.first;
    return T.cycle[(n - Math.max(T.from, R[0] + 1)) % T.cycle.length];
  }
  const ends = T.ends || [];
  if (ends.indexOf(n) >= 0) return "hard";
  if (teaching) return n < T.from ? T.first : ends.indexOf(n - 1) >= 0 ? T.afterEnd : T.teach;
  if (ends.indexOf(n - 1) >= 0) return T.afterEnd;
  if (n < T.from) return T.first;
  return T.cycle[(n - T.from) % T.cycle.length];
}
const hasLock = (L) => !!(L && (L.lock || L.locks)); // v6: lock (one) or locks (one or two)
const lockOK = (n, tag, L, K) => !hasLock(L) || (n >= K.from && K.tags.indexOf(tag) >= 0);
const FEATS = ["moat", "gate", "linked", "mystery", "tower", "hidden"];
function featuresOf(L) {
  const f = [];
  if (L.grid.some((r) => r.indexOf("~") >= 0)) f.push("moat");
  if (L.gates && L.gates.length) f.push("gate");
  if (L.links && L.links.length) f.push("linked");
  if (L.cols.some((c) => c.some((cd) => cd[2]))) f.push("mystery");
  if (L.towers && L.towers.length) f.push("tower");
  if (L.hidden && L.hidden.some((r) => r.indexOf("?") >= 0)) f.push("hidden");
  return f;
}
const unlockedAt = (n, D) => FEATS.filter((k) => D.unlock[k] != null && n >= D.unlock[k]);
function densityOK(n, tag, L, D, teaching) {
  const u = unlockedAt(n, D), f = featuresOf(L), lock = hasLock(L);
  if (f.some((k) => u.indexOf(k) < 0)) return false; // never a feature before its milestone
  if (teaching) { const nu = u.filter((k) => D.unlock[k] === Math.max(...u.map((q) => D.unlock[q]))); return !lock && nu.every((k) => f.indexOf(k) >= 0); }
  if (tag === "easy") return f.length <= D.easyMax && !lock;
  if (tag === "normal") return f.length >= Math.min(D.normalMin, u.length) && !lock;
  if (tag === "hard" && D.extremeFrom != null && n >= D.extremeFrom) return f.length >= u.length - D.hardSlack && lock; // v5 R4: Hard uses all but hardSlack
  return f.length === u.length && lock === (n >= D.lockFrom); // hard (before extremeFrom), extreme
}
// Lands foundation: past 200 a land's levels are pictures and use only the deck features (linked, mystery, hidden; the
// lock on Hard and Extreme) the land lists in features; how often each comes is the land's profile (tools/land-plan.js,
// data per land). landDensityOK(tag, L, feats, D) is the per-level floor of the density rule (D: config.json
// v5.density): nothing outside feats and nothing a picture can't carry (moat, gate, tower); Easy at most easyMax
// features and no lock; Normal no lock; Extreme every feature (and the lock where feats has it); Hard anything between.
// land-plan.js planCheck adds the land-level part: features per level never fall as the tag rises.
// Organic moats (tools/moat.js; SPEC-v4 §9, the organic moats entry): BOARD, the board features a land may list (moat: a
// ring of water round the picture's subject, counted by featuresOf as any water). A level whose picture can't carry one
// says so in L.cant (["moat"]): for it the land's features are read without it, so its Extreme uses every one it can.
const DECK = ["linked", "mystery", "hidden"], BOARD = ["moat"];
function landDensityOK(tag, L, feats, D) {
  feats = (feats || []).filter((k) => (L.cant || []).indexOf(k) < 0);
  const u = DECK.concat(BOARD).filter((k) => feats.indexOf(k) >= 0), f = featuresOf(L), lock = hasLock(L), canLock = feats.indexOf("lock") >= 0;
  if (f.some((k) => u.indexOf(k) < 0) || (lock && !canLock)) return false;
  if (tag === "easy") return f.length <= D.easyMax && !lock;
  if (tag === "normal") return !lock;
  if (tag === "extreme") return f.length === u.length && lock === canLock;
  return tag === "hard";
}
module.exports = { TAGS, tagOf, hasLock, lockOK, FEATS, featuresOf, unlockedAt, densityOK, DECK, BOARD, landDensityOK };
