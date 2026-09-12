// node runner for the baker. Body lives in bake-src.js. Run from the dejam dir: node tools/bake-levels.mjs
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
globalThis.ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
globalThis.readText = (p) => readFileSync(p, "utf8");
globalThis.writeText = (p, t) => writeFileSync(p, t);
globalThis.out = (s) => console.log(s);
(0, eval)(readFileSync(join(globalThis.ROOT, "tools", "bake-src.js"), "utf8"));
