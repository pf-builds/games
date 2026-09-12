// Bake the shipped level set to levels.json. Deterministic: same seed + params = same levels.
// Runtime-agnostic body: run via tools/bake-levels.mjs (node) or tools/bake.sh (macOS JavaScriptCore).
// Expects globals: readText(path) -> string, writeText(path, text), out(str), ROOT.
var window = globalThis;
(0, eval)(readText(ROOT + "/src/rng.js"));
(0, eval)(readText(ROOT + "/src/generator.js"));

const cfg = JSON.parse(readText(ROOT + "/config.json"));
// Must match the parameters of the approved bake exactly, or the set changes.
cfg.generator.hardenIters = 100;
cfg.generator.attemptsPerLevel = 300;
cfg.generator.bfsStateCap = 150000;

const t0 = Date.now();
// Endless pool: a dozen extra lots per size, served with random symmetries at runtime.
const POOL_PER_TIER = 12;
const poolCfg = JSON.parse(JSON.stringify(cfg));
poolCfg.generator.seed = cfg.generator.seed + 7;
for (const t of Object.keys(poolCfg.tiers)) poolCfg.tiers[t].count = POOL_PER_TIER;

DeJam.gen.prebake(cfg, (n, total, tier, par) => { out(n + "/" + total + "  " + tier + " par " + par); }).then(async (levels) => {
  out("Baked " + levels.length + " levels in " + ((Date.now() - t0) / 1000).toFixed(1) + "s" + (levels.some((l) => l.belowRange) ? "  (below-range fallbacks: " + levels.filter((l) => l.belowRange).length + ")" : ""));
  const poolList = await DeJam.gen.prebake(poolCfg, (n, total, tier, par) => { out("pool " + n + "/" + total + "  " + tier + " par " + par); });
  const endlessPool = {};
  for (const l of poolList) { (endlessPool[l.tier] = endlessPool[l.tier] || []).push({ board: l.board, exits: l.exits, vehicles: l.vehicles, par: l.par }); }
  out("Pool: " + Object.keys(endlessPool).map((t) => t + " " + endlessPool[t].map((l) => l.par).join("/")).join(" | "));
  const pars = {};
  levels.forEach((l) => { (pars[l.tier] = pars[l.tier] || []).push(l.par); });
  for (const t of Object.keys(pars)) out(t + " " + pars[t].join(" "));
  const exitsPer = levels.map((l) => l.exits.length - 1);
  out("side exits per level: " + exitsPer.join(" "));
  const result = { version: "3-" + cfg.generator.seed + "-" + levels.length + "p" + poolList.length, seed: cfg.generator.seed, levels, endlessPool };
  writeText(ROOT + "/levels.json", JSON.stringify(result));
  out("Wrote levels.json (" + JSON.stringify(result).length + " bytes)");
}).catch((e) => out("BAKE FAILED: " + (e && e.stack || e)));
