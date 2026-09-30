// Sapper's Path v3 rushing check (playtest 1): on a spread of baked levels, random tap orders played patiently (tap,
// wait until nothing moves) against the same kind of random orders played rushed (a random wait between taps). Rushing
// should never be much easier than patience; a level where it is gets flagged. v3.1: a tap with no free space is refused
// (a no-op), so the rushing player just taps again after its next wait; the refused taps are counted.
//   ~/.local/opt/node/bin/node tools/rush.js [games per level, default 300] [--all: every level, not the 10-level sample]
"use strict";
const E = require("../src/engine.js");
const { rng } = require("./grade.js");
const V3 = require("../config.json").v3, LV = require("../levels/levels.json").levels;
const N = +process.argv[2] || 300, ALL = process.argv.includes("--all"), rules = E.rulesOf(V3, "normal");
const WAITS = { patient: null, "rush 0-3 s": 3000, "rush 0-1 s": 1000 };
const pick = ALL ? LV : [5, 12, 18, 24, 33, 40, 47, 58, 66, 74].map((n) => LV.find((l) => l.n === n)).filter(Boolean);
console.log("level band        " + Object.keys(WAITS).map((k) => k.padStart(12)).join("") + "   refused taps per rushed game");
let flagged = 0, maxGap = -1, maxAt = 0;
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
    row.push(wins / N); if (w != null) refused.push((ref / N).toFixed(1));
  }
  const gap = Math.max(...row.slice(1)) - row[0], bad = gap > 0.1;
  if (bad) flagged++;
  if (gap > maxGap) { maxGap = gap; maxAt = L.n; }
  console.log(String(L.n).padStart(5) + " " + L.band.padEnd(11) + row.map((x) => ((100 * x).toFixed(1) + "%").padStart(12)).join("") + "   " + refused.join(" / ") + (bad ? "   FLAG: rushing easier" : ""));
}
console.log("largest rushed-minus-patient gap: " + (100 * maxGap).toFixed(1) + " points (level " + maxAt + ")");
console.log(flagged ? flagged + " level(s) flagged" : "no level where rushing is more than 10 points easier than patience");
