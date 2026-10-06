// Sapper's Path lands foundation: a land's difficulty, all from data (Peter, 2026-10-06: difficulty keeps climbing past
// 200, so every land carries its own profile and later lands are tuned without code). A profile is tools/land-config.json
// `profile` with the land's land.json `profile` merged over it (profileOf), and holds:
//   tags: the tag mix. shares (Easy, Normal, Hard, Extreme of the land's levels), breathers (the fewest Easy levels per
//     perLand levels, scaled to the land's size, at least 1), run ([shortest, longest] run of Hard and Extreme levels),
//     end (the land's last level: hard or extreme).
//   features: per deck feature, share (of the land's levels that use it) and its amount: mystery cards [lo, hi] "?"
//     cards; hidden of [lo, hi], the share of the picture's eligible blocks hidden; linked pairs [lo, hi]; lock share
//     (levels with a locked space, Extreme first, then Hard; never Easy or Normal) and key (the share of those that are
//     key locks; the rest colour locks).
//   bands: the grader's Normal random-tap win-rate band per tag; lookahead: the one-move-lookahead player's ceiling per
//     tag (none: no ceiling); pace: the real pace's range and aim (ms).
// landTags(N, T): the land's tags in order, a sawtooth: segments of Normal levels, a run of Hard then Extreme (the peak)
//   and an Easy breather, as many segments as breathers plus a last one that ends on T.end; later runs get the
//   Extremes first, so the land climbs. Deterministic.
// landPlan(tags, land, P, seed): each level's plan {feats, mystery (cards), links (pairs), hidden (share or 0), lock
//   (false, "key", "colour")}. Each feature goes to round(share x N) levels: every Extreme level first (Extreme uses
//   every feature and the lock), then Hard, Normal and Easy in a seeded order (an Easy level takes at most
//   v5.density.easyMax). Amounts rise with the tag (an Extreme level takes the top of each range).
// planCheck(levels, land, P, D): the land against its profile and the density rule (tools/tags.js landDensityOK):
//   [problems]. Extension point: a feature outside DECK and BOARD (a later board feature such as the Extreme hazard)
//   needs a builder in tools/land-bake.js FEATURES before a land may list it; landPlan and planCheck refuse it until then.
// Organic moats (SPEC-v4 §9, the organic moats entry; tools/moat.js): moat is a BOARD feature. Its amount is ways, an
//   index into land-config plan.moat.ways (the openings, gentlest first: front and far, left and right, front, far), so
//   Easy gets the gentlest and Extreme the hardest. can (optional, landPlan's last argument): {moat: [bool per level]},
//   whether each level's picture can carry a ring (tools/land.js bake works it out); a level that can't is skipped for
//   that feature, Extreme too (its plan says cant: ["moat"], and the density rule reads the land without it there).
"use strict";
const TG = require("./tags.js");
const RANK = { easy: 0, normal: 1, hard: 2, extreme: 3 };
const hash01 = (n, k) => { let t = Math.imul(n + 0x3c6e, 0x9E3779B1) ^ Math.imul(k + 11, 0x85EBCA77); t ^= t >>> 15; t = Math.imul(t, 0x2c1b3c6d); t ^= t >>> 12; return (t >>> 0) / 4294967296; };
const isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);
function merge(a, b) { if (!isObj(a) || !isObj(b)) return b === undefined ? a : b; const o = Object.assign({}, a); for (const k of Object.keys(b)) o[k] = merge(a[k], b[k]); return o; }
const profileOf = (land, LC) => merge(LC.profile, (land && land.profile) || {});

function landTags(N, T, perLand) {
  const sh = T.shares, R = (k) => Math.round(sh[k] * N);
  let e = Math.max(R("easy"), Math.max(1, Math.round((T.breathers * N) / (perLand || 50)))), x = R("extreme"), h = R("hard");
  if (T.end === "extreme" && x < 1) { x = 1; if (h > 0) h--; } if (T.end === "hard" && h < 1) h = 1;
  let n = N - e - x - h; while (n < 0 && h > (T.end === "hard" ? 1 : 0)) { h--; n++; } while (n < 0 && x > (T.end === "extreme" ? 1 : 0)) { x--; n++; } while (n < 0 && e > 1) { e--; n++; }
  const S = e + 1, runs = Array.from({ length: S }, () => ({ h: 0, x: 0 })), lead = new Array(S).fill(0);
  for (let i = 0; i < x; i++) runs[S - 1 - (i % S)].x++; // the Extremes from the last run back: later peaks are higher
  for (let i = 0; i < h; i++) { let b = 0; for (let k = 1; k < S; k++) if (runs[k].h + runs[k].x < runs[b].h + runs[b].x) b = k; runs[b].h++; } // the Hards evening the runs out
  for (let i = 0; i < n; i++) lead[i % S]++;
  const out = []; for (let s = 0; s < S; s++) { for (let i = 0; i < lead[s]; i++) out.push("normal"); for (let i = 0; i < runs[s].h; i++) out.push("hard"); for (let i = 0; i < runs[s].x; i++) out.push("extreme"); if (s < S - 1) out.push("easy"); }
  if (out[out.length - 1] !== T.end) { const j = out.lastIndexOf(T.end); if (j >= 0) { out.splice(j, 1); out.push(T.end); } else out[out.length - 1] = T.end; }
  return out;
}

function landPlan(tags, land, P, seed, D, can) {
  const N = tags.length, feats = land.features || [], deck = feats.filter((f) => f !== "lock"), plan = tags.map((t) => ({ feats: [], mystery: 0, links: 0, hidden: 0, lock: false, tag: t }));
  for (const f of deck) if (TG.DECK.indexOf(f) < 0 && TG.BOARD.indexOf(f) < 0) throw new Error("land feature " + f + " has no builder yet (tools/land-bake.js FEATURES)");
  if (can) for (const f of Object.keys(can)) if (feats.indexOf(f) >= 0) plan.forEach((p, i) => { if (!can[f][i]) p.cant = (p.cant || []).concat(f); });
  const order = (k) => tags.map((t, i) => i).sort((a, b) => RANK[tags[b]] - RANK[tags[a]] || hash01(seed + a, k) - hash01(seed + b, k));
  deck.forEach((f, fi) => { const F = P.features[f] || { share: 0 }, want = Math.round(F.share * N); let got = 0;
    for (const i of order(fi + 1)) { const t = tags[i]; if ((plan[i].cant || []).indexOf(f) >= 0) continue; if (t !== "extreme" && got >= want) continue; if (t === "easy" && plan[i].feats.length >= D.easyMax) continue; plan[i].feats.push(f); got++; } });
  if (feats.indexOf("lock") >= 0) { const L = P.features.lock || { share: 0, key: 0 }, want = Math.round(L.share * N); let got = 0;
    for (const i of order(99)) { const t = tags[i]; if (t !== "extreme" && (got >= want || t !== "hard")) continue; plan[i].lock = hash01(seed + i, 98) < L.key ? "key" : "colour"; got++; } }
  plan.forEach((p, i) => { const tt = (RANK[p.tag] + hash01(seed + i, 50)) / 4, amt = (r) => r[0] + Math.min(r[1] - r[0], Math.floor(tt * (r[1] - r[0] + 1)));
    if (p.feats.indexOf("mystery") >= 0) p.mystery = amt(P.features.mystery.cards);
    if (p.feats.indexOf("linked") >= 0) p.links = amt(P.features.linked.pairs);
    if (p.feats.indexOf("hidden") >= 0) { const r = P.features.hidden.of; p.hidden = +(r[0] + tt * (r[1] - r[0])).toFixed(3); }
    if (p.feats.indexOf("moat") >= 0) p.moat = amt(P.features.moat.ways); });
  return plan;
}

// The finished land (levels: its main levels in order, each with tag, plan feats, lock) against its profile.
function planCheck(levels, land, P, D, perLand) {
  const bad = [], N = levels.length, tags = landTags(N, P.tags, perLand), feats = land.features || [];
  levels.forEach((L, i) => { if (L.tag !== tags[i]) bad.push(L.n + ": tag " + L.tag + ", the profile says " + tags[i]);
    if (!TG.landDensityOK(L.tag, L, feats, D)) bad.push(L.n + " " + L.tag + ": density rule [" + TG.featuresOf(L).join(",") + (L.lock ? ",lock" : "") + "]"); });
  const mean = (t) => { const ls = levels.filter((l) => l.tag === t); return ls.length ? ls.reduce((a, l) => a + TG.featuresOf(l).length + (l.lock ? 1 : 0), 0) / ls.length : null; };
  const ms = ["easy", "normal", "hard", "extreme"].map(mean).filter((v) => v != null); for (let i = 1; i < ms.length; i++) if (ms[i] < ms[i - 1] - 1e-9) bad.push("features per level fall with the tag (" + ms.map((v) => v.toFixed(2)).join(" / ") + ")");
  const runs = []; let run = 0; for (const L of levels) { if (L.tag === "hard" || L.tag === "extreme") run++; else { if (run) runs.push(run); run = 0; } } if (run) runs.push(run);
  if (runs.some((r) => r > P.tags.run[1])) bad.push("a Hard/Extreme run of " + Math.max(...runs) + " (the profile's longest is " + P.tags.run[1] + ")");
  const last = levels[N - 1]; if (last && last.tag !== "hard" && last.tag !== "extreme") bad.push("the land ends " + last.tag);
  return bad;
}
// The shares a finished land reached, per feature and tag (for the report).
function sharesOf(levels) {
  const N = levels.length || 1, c = (f) => +(levels.filter(f).length / N).toFixed(2), u = (k) => (l) => TG.featuresOf(l).indexOf(k) >= 0;
  return { easy: c((l) => l.tag === "easy"), normal: c((l) => l.tag === "normal"), hard: c((l) => l.tag === "hard"), extreme: c((l) => l.tag === "extreme"), mystery: c(u("mystery")), hidden: c(u("hidden")), linked: c(u("linked")), lock: c((l) => !!l.lock), moat: c(u("moat")) };
}
module.exports = { RANK, merge, profileOf, landTags, landPlan, planCheck, sharesOf };
