// Sapper's Path v3 rushing check (playtest 1): on a spread of baked levels, random tap orders played patiently (tap,
// wait until nothing moves) against the same kind of random orders played rushed (a random wait between taps). Rushing
// should never be much easier than patience; a level where it is gets flagged. v3.1: a tap with no free space is refused
// (a no-op), so the rushing player just taps again after its next wait; the refused taps are counted.
// v4 M2: plus the fast tapper (grade.fast: taps a legal card the moment one exists, never waits for rest), at no gap and
// at a thumb's 300 ms; it is the limit of rushing, and the plan's difficulty check for late levels.
//   ~/.local/opt/node/bin/node tools/rush.js [games per level, default 300] [--all: every level] [--late: levels 46-75]
"use strict";
const E = require("../src/engine.js");
const { rng, fast } = require("./grade.js");
const V3 = require("../config.json").v3, LV = require("../levels/levels.json").levels;
const N = +process.argv[2] || 300, ALL = process.argv.includes("--all"), LATE = process.argv.includes("--late"), rules = E.rulesOf(V3, "normal");
const WAITS = { patient: null, "rush 0-3 s": 3000, "rush 0-1 s": 1000 }, FAST = { "fast": 0, "fast 0.3 s": 300 };
const pick = ALL ? LV : LATE ? LV.filter((l) => l.n >= 46) : [5, 12, 18, 24, 33, 40, 47, 58, 66, 74].map((n) => LV.find((l) => l.n === n)).filter(Boolean);
console.log("level band        " + Object.keys(WAITS).concat(Object.keys(FAST)).map((k) => k.padStart(12)).join("") + "   refused taps per rushed game");
let flagged = 0, maxGap = -1, maxAt = 0;
const sum = {}; for (const k of Object.keys(WAITS).concat(Object.keys(FAST))) sum[k] = 0;
for (const L of pick) {
  const B = E.compile(L), S = E.sim(B, rules), row = [], refused = [];
  for (const [k, w] of Object.entries(WAITS)) {
    let wins = 0, ref = 0;
    for (let g = 0; g < N; g++) {
      S.reset(); const r = rng(L.n * 7919 + g), open = [];
      for (let guard = 0; guard <= 20 * B.ncards + 100 && S.status === E.PLAYING; guard++) {
        open.length = 0; for (let j = 0; j < 5; j++) if (S.heads[j] < B.colLen[j]) open.push(j);
        if (!open.length) break;
        const j = open[Math.floor(r() * open.length)];
        if (w == null) { S.play(j); S.quiet(); } else if (S.play(j, S.now + Math.floor(r() * w)) === E.REFUSED) ref++;
      }
      S.quiet(); if (S.status === E.WON) wins++;
    }
    row.push(wins / N); sum[k] += wins / N; if (w != null) refused.push((ref / N).toFixed(1));
  }
  for (const [k, gap] of Object.entries(FAST)) { const x = fast(B, rules, N, L.n * 7919, gap); row.push(x); sum[k] += x; }
  const gap = Math.max(...row.slice(1)) - row[0], bad = gap > 0.1;
  if (bad) flagged++;
  if (gap > maxGap) { maxGap = gap; maxAt = L.n; }
  console.log(String(L.n).padStart(5) + " " + L.band.padEnd(11) + row.map((x) => ((100 * x).toFixed(1) + "%").padStart(12)).join("") + "   " + refused.join(" / ") + (bad ? "   FLAG: rushing easier" : ""));
}
console.log("mean              " + Object.keys(sum).map((k) => ((100 * sum[k] / pick.length).toFixed(1) + "%").padStart(12)).join(""));
console.log("largest rushed-minus-patient gap: " + (100 * maxGap).toFixed(1) + " points (level " + maxAt + ")");
console.log(flagged ? flagged + " level(s) flagged" : "no level where rushing is more than 10 points easier than patience");
