// Sapper's Path v4 M2 grader measurements (numbers in tools/v4-m2-notes.md). Nothing is written.
// On a sample of late levels (Normal), four variants of each: plain (baked), mystery (every card behind a front flagged),
// linked (two seeded links between neighbouring columns, rows at most 2 apart, kept only if Normal still solves), and
// linked + mystery. Per variant: the random-tap rate, the one-move lookahead (grade.greedy, which reads the tray only
// through grade.view), and a two-move lookahead prototype (look2 below) played honestly (a card it can't see yet is
// scored as the mean over the colours it could be) and, on the mystery variants, played with the hidden colours
// known (cheat), which shows what the "?" costs a player who looks two moves ahead.
//   ~/.local/opt/node/bin/node tools/m2-measure.js [games, default 200] [look2 games, default 60]
"use strict";
const E = require("../src/engine.js"), R = require("./grade.js"), V3 = require("../config.json").v3, LV = require("../levels/levels.json").levels;
const G = +process.argv[2] || 200, G2 = +process.argv[3] || 60, rules = E.rulesOf(V3, "normal");
const SAMPLE = [46, 48, 49, 52, 54, 57, 61, 64, 69, 73];
const copy = (o) => JSON.parse(JSON.stringify(o));

const mystery = (L) => { L.cols.forEach((c) => c.forEach((cd, i) => { if (i > 0) cd[2] = E.MYSTERY; })); return L; };
function linked(L, seed) {
  const r = R.rng(seed);
  for (let t = 0; t < 200 && (L.links || []).length < 2; t++) {
    const j = Math.floor(r() * 4), i = Math.floor(r() * L.cols[j].length), q = i + Math.floor(r() * 5) - 2;
    if (q < 0 || q >= L.cols[j + 1].length || (i === 0 && q === 0)) continue;
    const used = new Set((L.links || []).flat().map((p) => p.join(",")));
    if (used.has(j + "," + i) || used.has(j + 1 + "," + q)) continue;
    const T = Object.assign(copy(L), { links: (L.links || []).concat([[[j, i], [j + 1, q]]]) });
    if (R.solve(E.compile(T), rules, 30000)) L.links = T.links;
  }
  return L;
}

// Two-move lookahead (prototype for M3): for each legal first tap, the best score of any legal second tap once nothing
// moves (grade.look on the child), -1 for a win at the first tap, 1e6 for a fail; pick the lowest, seeded random ties.
// Honest: when the first tap exposes a card that is hidden now (the next card of that column), the child is scored as
// the mean over that card's possible colours (unseen counts, as grade.look does for a hidden partner). cheat: that card's
// real colour is used.
function look2(B, n, seed, cheat) {
  const S = E.sim(B, rules), buf = new Int32Array(S.M.length), kid = new Int32Array(S.M.length), sc = new Float64Array(5), best = new Int32Array(5);
  let wins = 0;
  const childScore = () => (S.status === E.WON ? -1 : S.status === E.FAILED ? 1e6 : Math.min(...R.look(S, kid, sc)));
  for (let k = 0; k < n; k++) {
    S.reset(); const r = R.rng((seed | 0) + k * 104723);
    for (let guard = 0; guard <= B.ncards && S.status === E.PLAYING; guard++) {
      S.save(buf); const v = [Infinity, Infinity, Infinity, Infinity, Infinity];
      for (let j = 0; j < 5; j++) {
        if (!R.legal(S, j)) continue;
        // The hidden cards this tap would show: its partner, and the next card of each column it opens.
        const f = S.front(j), p = S.partner(f), H = [];
        if (p >= 0 && S.hidden(p)) H.push(p);
        const nx = S.card(j, 1); if (nx >= 0 && nx !== p && S.hidden(nx)) H.push(nx);
        if (p >= 0 && !S.hidden(p) && S.front(S.B.cardCol[p]) === p) { const q = S.card(S.B.cardCol[p], 1); if (q >= 0 && S.hidden(q)) H.push(q); }
        if (!H.length || cheat) { S.play(j); S.quiet(); v[j] = childScore(); S.load(buf); continue; }
        // Mean over every colouring of those cards the unseen counts allow, weighted by the counts.
        const u = R.view(S).unseen, real = H.map((c) => B.cardM[c]); let sum = 0, ws = 0;
        const rec = (i, wt) => {
          if (i === H.length) { S.play(j); S.quiet(); sum += wt * childScore(); ws += wt; S.load(buf); return; }
          const c = H[i], cnt = B.cardN[c];
          for (let m = 1; m < E.NMAT; m++) { if (m === E.IRON || u[m] < cnt) continue; B.cardM[c] = m; u[m] -= cnt; rec(i + 1, wt * (u[m] + cnt)); u[m] += cnt; }
          B.cardM[c] = real[i];
        };
        rec(0, 1); H.forEach((c, i) => { B.cardM[c] = real[i]; });
        if (!ws) { S.play(j); S.quiet(); v[j] = childScore(); S.load(buf); } else v[j] = sum / ws;
      }
      let nb = 0, bl = Infinity; for (let j = 0; j < 5; j++) { if (v[j] === Infinity) continue; if (v[j] < bl) { bl = v[j]; nb = 0; } if (v[j] === bl) best[nb++] = j; }
      if (!nb) break;
      S.play(best[Math.floor(r() * nb)]); S.quiet();
    }
    if (S.status === E.WON) wins++;
  }
  return wins / n;
}

// Sampling planner (the M3 proposal; "perfect-information Monte Carlo"): at each turn, K colourings of the hidden cards
// drawn from what the player can count (each hidden card a colour m with probability by the unseen count of m, among
// colours with enough unseen for its count, drawn without replacement), and for each legal tap, the number of colourings
// in which the patient solver (grade.solve, `nodes`) still wins after it; the most wins is played, seeded random ties.
// cheat: one "colouring", the real one (so the planner sees everything). The gap between the two is what the "?" costs a
// strong player.
function pimc(B, n, seed, K, nodes, cheat) {
  const S = E.sim(B, rules), buf = new Int32Array(S.M.length), kid = new Int32Array(S.M.length), best = new Int32Array(5), real = Int32Array.from(B.cardM);
  let wins = 0;
  for (let g = 0; g < n; g++) {
    S.reset(); const r = R.rng((seed | 0) + g * 7727);
    for (let guard = 0; guard <= B.ncards && S.status === E.PLAYING; guard++) {
      const legalJ = []; for (let j = 0; j < 5; j++) if (R.legal(S, j)) legalJ.push(j);
      if (!legalJ.length) break;
      let pickJ = legalJ[0];
      if (legalJ.length > 1) {
        S.save(buf); const score = [0, 0, 0, 0, 0], H = []; for (let c = 0; c < B.ncards; c++) if (S.hidden(c)) H.push(c);
        for (let k = 0; k < (cheat ? 1 : K); k++) {
          if (!cheat) { const u = R.view(S).unseen; for (const c of H) { let tot = 0; for (let m = 1; m < E.NMAT; m++) if (u[m] >= B.cardN[c]) tot += u[m];
            let x = r() * tot, m = 1; for (; m < E.NMAT; m++) { if (u[m] < B.cardN[c]) continue; x -= u[m]; if (x < 0) break; } if (m >= E.NMAT) m = real[c]; B.cardM[c] = m; u[m] = Math.max(0, u[m] - B.cardN[c]); } }
          for (const j of legalJ) { S.play(j); S.quiet(); if (S.status === E.WON || (S.status === E.PLAYING && R.solve(B, rules, nodes, null, S.save(kid)))) score[j]++; S.load(buf); }
          for (const c of H) B.cardM[c] = real[c];
        }
        let nb = 0, bs = -1; for (const j of legalJ) { if (score[j] > bs) { bs = score[j]; nb = 0; } if (score[j] === bs) best[nb++] = j; }
        pickJ = best[Math.floor(r() * nb)];
      }
      S.play(pickJ); S.quiet();
    }
    if (S.status === E.WON) wins++;
  }
  return wins / n;
}
if (process.argv.includes("--pimc")) {
  const K = 8, NODES = 3000, GP = +process.argv[process.argv.indexOf("--pimc") + 1] || 40, t1 = Date.now(), acc = [0, 0, 0, 0];
  console.log("sampling planner (K " + K + ", solver nodes " + NODES + ", " + GP + " games): mystery variant honest vs all-seeing; linked+mystery honest vs all-seeing");
  for (const n of SAMPLE) {
    const L0 = LV.find((l) => l.n === n), base = { w: L0.w, h: L0.h, grid: L0.grid, gates: L0.gates, towers: L0.towers, cols: L0.cols };
    const Bm = E.compile(mystery(copy(base))), Bl = E.compile(mystery(linked(copy(base), n * 17))), s = L0.seed | 0;
    const x = [pimc(Bm, GP, s, K, NODES, false), pimc(Bm, GP, s, K, NODES, true), pimc(Bl, GP, s, K, NODES, false), pimc(Bl, GP, s, K, NODES, true)];
    x.forEach((y, i) => { acc[i] += y; });
    console.log(String(n).padStart(5) + x.map((y) => ((100 * y).toFixed(1) + "%").padStart(9)).join(""));
  }
  console.log(" mean" + acc.map((y) => ((100 * y / SAMPLE.length).toFixed(1) + "%").padStart(9)).join("") + "   (" + ((Date.now() - t1) / 1000).toFixed(0) + " s)");
  process.exit(0);
}

const pct = (x) => ((100 * x).toFixed(1) + "%").padStart(7);
const cols = ["rand", "look1", "look2", "look2*"], heads = ["plain", "mystery", "linked", "linked+mys"];
console.log("level  " + heads.map((h) => h.padEnd(4 * 7 + 3)).join(" | "));
console.log("       " + heads.map(() => cols.map((c) => c.padStart(7)).join("") + "   ").join(" | "));
const tot = heads.map(() => [0, 0, 0, 0]); const t0 = Date.now();
for (const n of SAMPLE) {
  const L0 = LV.find((l) => l.n === n), base = { w: L0.w, h: L0.h, grid: L0.grid, gates: L0.gates, towers: L0.towers, cols: L0.cols };
  const V = [copy(base), mystery(copy(base)), linked(copy(base), n * 17), null]; V[3] = mystery(copy(V[2]));
  const row = V.map((L, k) => { const B = E.compile(L), s = L0.seed | 0;
    const x = [R.rate(B, rules, G, s), R.greedy(B, rules, G, s ^ 0x2545f491), look2(B, G2, s, false), k % 2 ? look2(B, G2, s, true) : NaN];
    x.forEach((y, i) => { if (!isNaN(y)) tot[k][i] += y; }); return x; });
  console.log(String(n).padStart(5) + "  " + row.map((x) => x.map((y) => (isNaN(y) ? "      -" : pct(y))).join("") + "   ").join(" | ") + "  links " + JSON.stringify(V[2].links || []));
}
console.log("mean   " + tot.map((t, k) => t.map((y, i) => (i === 3 && k % 2 === 0 ? "      -" : pct(y / SAMPLE.length))).join("") + "   ").join(" | "));
console.log("look2* = two-move lookahead that knows the hidden colours (the cost of the ? to that player = look2* - look2). " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
