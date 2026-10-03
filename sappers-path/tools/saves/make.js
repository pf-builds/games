// Sapper's Path v4.3: example saves from every shipped save shape, written by the shipped code itself (tools/test.js loads
// them to check the format-2 migration in src/save.js). For each shipped version it takes that commit's src/save.js,
// src/meta.js, config.json and level ids from git (git show), plays a scripted player through them (wins on mixed
// difficulties, Gallery pictures out of order, best times, a power-up bought and used, settings changed) and writes the
// JSON the page would have stored under config.save.key to tools/saves/<version>.json. Deterministic; run from anywhere:
//   ~/.local/opt/node/bin/node tools/saves/make.js
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { execFileSync } = require("child_process");
const SHIPPED = [["v3", "fd16323"], ["v4", "9b4fe37"], ["v4.1", "b26e4a4"], ["v4.2", "6e13a1c"]]; // the commits that shipped (games repo)
const show = (c, f) => { try { return execFileSync("git", ["show", c + ":sappers-path/" + f], { cwd: __dirname, maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch (e) { return null; } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sp-saves-"));
const DIFFS = ["easy", "normal", "hard"];
for (const [ver, c] of SHIPPED) {
  const dir = path.join(tmp, ver); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "save.js"), show(c, "src/save.js"));
  const metaSrc = show(c, "src/meta.js"); if (metaSrc) fs.writeFileSync(path.join(dir, "meta.js"), metaSrc);
  const Save = require(path.join(dir, "save.js")), Meta = metaSrc ? require(path.join(dir, "meta.js")) : null, CFG = JSON.parse(show(c, "config.json")), META = CFG.meta;
  const order = JSON.parse(show(c, "levels/levels.json")).levels.map((l) => l.id), galSrc = show(c, "levels/gallery.json"), gal = galSrc ? JSON.parse(galSrc).levels.map((l) => l.id) : [];
  const n = { v3: 30, v4: 40, "v4.1": 61, "v4.2": 100 }[ver], d = Save.fresh(META);
  // The player: level i won on difficulty i % 3 first; every fourth level won again on another difficulty, faster.
  for (let i = 0; i < n; i++) {
    const id = order[i], diff = DIFFS[i % 3], first = Save.record(d, id, diff);
    if (Meta) Meta.recordWin(d, META, id, diff, 60000 + 997 * i, 20 + (i % 17), first);
    if (i % 4 === 0) { const d2 = DIFFS[(i + 1) % 3], was = d.done[id] | 0; Save.record(d, id, d2); if (Meta) Meta.recordWin(d, META, id, d2, 55000 + 991 * i, 25 + (i % 11), !(was & (1 << DIFFS.indexOf(d2)))); }
  }
  // The Gallery (from v4): pictures won out of order (every picture was open once the Gallery was).
  if (Meta && gal.length) for (const k of ver === "v4" ? [0, 3, 7] : ver === "v4.1" ? [0, 1, 2, 5, 9, 10] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 20, 59]) {
    const id = gal[k], diff = DIFFS[(k + 1) % 3], was = d.gal[id] | 0; Save.record(d, id, diff, "gal"); Meta.recordWin(d, META, id, diff, 70000 + 1009 * k, 30 + k, !(was & (1 << DIFFS.indexOf(diff))));
  }
  if (Meta) { Meta.buy(d, META, 0); Meta.buy(d, META, 2); Meta.take(d, 0); }
  d.settings.muted = ver !== "v4.1"; d.settings.diff = { v3: "hard", v4: "easy", "v4.1": "hard", "v4.2": "normal" }[ver];
  if (ver === "v3") d.settings.fast = true; else { d.settings.speed = ver === "v4.2" ? 3 : 2; d.settings.cb = ver === "v4"; }
  d.last = order[Math.min(n, order.length - 1)];
  fs.writeFileSync(path.join(__dirname, ver + ".json"), JSON.stringify(d) + "\n");
  console.log(ver + " (" + c + "): " + Object.keys(d.done).length + " levels won, " + Object.keys(d.gal || {}).length + " pictures, coins " + d.coins + ", " + JSON.stringify(d.settings));
}
fs.rmSync(tmp, { recursive: true, force: true });
