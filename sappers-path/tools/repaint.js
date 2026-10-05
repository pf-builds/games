// Sapper's Path v5 R4 fix (the visual critic's S6): repaint baked castle levels from their scenes. Each level from --from to
// --to whose scene is in tools/bake-config.json picture.scenes takes the scene's colour for every palette entry whose
// role the scene colours (the archer towers' slate and the roles moved round it), and its palette record (minDE, minFade:
// tools/castle.js) is measured again. The board, the cards and every stored order are untouched (colours are not rules).
//   ~/.local/opt/node/bin/node tools/repaint.js --from 125 --to 174 [--levels FILE]   (writes FILE, default levels/levels.json)
"use strict";
const fs = require("fs"), path = require("path"), PIC = require("./pic.js"), E = require("../src/engine.js");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const file = path.resolve(arg("levels", path.join(__dirname, "../levels/levels.json"))), lo = +arg("from"), hi = +arg("to");
const Q = require("./bake-config.json").picture, gilt = require("../config.json").v3.mats[E.GILT].c, D = JSON.parse(fs.readFileSync(file, "utf8"));
let n = 0, moved = 0;
for (const L of D.levels) {
  if (L.n < lo || L.n > hi || !L.pal || !L.scene || !Q.scenes[L.scene]) continue;
  const SC = Q.scenes[L.scene].c || {}, hx = [];
  for (const m of Object.keys(L.pal)) { const p = L.pal[m]; if (p.r && SC[p.r] && p.c !== SC[p.r]) { p.c = SC[p.r]; moved++; } if (+m !== E.IRON) hx.push(p.c); }
  if (L.grid.some((row) => row.indexOf(E.chOf(E.GILT)) >= 0)) hx.push(gilt);
  let md = 100, mf = 100; for (let a = 0; a < hx.length; a++) for (let b = a + 1; b < hx.length; b++) { md = Math.min(md, PIC.de(hx[a], hx[b])); mf = Math.min(mf, PIC.fadeGap(hx[a], hx[b])); }
  L.palette = { minDE: +md.toFixed(1), minFade: +mf.toFixed(1) }; n++;
}
fs.writeFileSync(file, JSON.stringify(D)); console.log("repainted " + n + " levels (" + moved + " colours moved) in " + file);
