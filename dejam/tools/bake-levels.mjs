// Bake the shipped level set to levels.json. Deterministic: same seed + params = same levels.
// Run from the dejam directory:  node tools/bake-levels.mjs
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis; // the src files attach to window.DeJam

for (const f of ["src/rng.js", "src/generator.js"]) {
  // eslint-disable-next-line no-eval
  (0, eval)(readFileSync(join(root, f), "utf8"));
}

const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
// Must match the parameters of the approved bake exactly, or the set changes.
cfg.generator.hardenIters = 160;
cfg.generator.attemptsPerLevel = 300;

const t0 = Date.now();
const levels = await globalThis.DeJam.gen.prebake(cfg, (n, total, tier, par) => {
  process.stdout.write(`\r${n}/${total}  ${tier} par ${par}   `);
});
console.log(`\nBaked ${levels.length} levels in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const pars = { easy: [], medium: [], hard: [] };
levels.forEach((l) => pars[l.tier].push(l.par));
for (const t of Object.keys(pars)) console.log(t, pars[t].join(" "));

const out = { version: "2-" + cfg.generator.seed + "-60", seed: cfg.generator.seed, levels };
writeFileSync(join(root, "levels.json"), JSON.stringify(out));
console.log("Wrote levels.json (" + JSON.stringify(out).length + " bytes)");
