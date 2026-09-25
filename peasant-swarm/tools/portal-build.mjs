#!/usr/bin/env node
// Peasant Swarm portal build (SPEC-v3 §5.4, R4 §2). node tools/portal-build.mjs crazygames|poki [--sdk-data]
// Copies the runtime files (index.html, style.css, config.json, src/*.js, fonts/*.woff2 and their OFL texts) to dist/<portal>/ (the JS
// with its comments and indentation stripped, config.json without whitespace: the size gate, below; the Pages copy keeps both), writes
// <meta name="ps-portal" content="<portal>"> and the portal's SDK <script> into that copy's index.html (src/portal.js reads the meta
// first), and zips it to dist/peasant-swarm-<portal>.zip with index.html at the root. Never copied: tools/, *.md, thumb.jpg, dist/ itself.
// --sdk-data also writes <meta name="ps-portal-data" content="sdk"> (CrazyGames Full Launch: PS.portal.store moves to SDK.data).
// The source folder (the GitHub Pages copy) is only read, never written: the build prints a hash of every source file before and after
// and fails if any changed. Checks: every path in index.html and style.css is relative and exists in the copy, the zip is under 250 KB and
// 30 files. Uses the system zip (macOS and Linux ship it). Exit 0 on success, 1 on a failed check.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORTALS = {
  crazygames: '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>',
  poki: '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>',
};
const MAX_BYTES = 250 * 1024, MAX_FILES = 30;
const portal = process.argv[2], sdkData = process.argv.includes("--sdk-data");
if (!PORTALS[portal]) { console.error("usage: node tools/portal-build.mjs crazygames|poki [--sdk-data]"); process.exit(1); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), distRoot = path.join(root, "dist"), out = path.join(distRoot, portal);
const zipPath = path.join(distRoot, `peasant-swarm-${portal}.zip`);
// the runtime file list (every other file in the game folder stays out of the zip)
function runtimeFiles() {
  const list = ["index.html", "style.css", "config.json"];
  for (const f of fs.readdirSync(path.join(root, "src")).sort()) if (f.endsWith(".js")) list.push("src/" + f);
  for (const f of fs.readdirSync(path.join(root, "fonts")).sort()) if (f.endsWith(".woff2") || /^OFL.*\.txt$/.test(f)) list.push("fonts/" + f);
  return list;
}
// strip(js): drops // and /* */ comments, leading indentation and blank lines. A small scanner that knows strings ('" and multi-line `),
// regex literals (a / where an operand cannot end: after ( , = : [ ! & | ? { } ; + - * % < > ~ ^ or return/typeof, at line start) with
// their escapes and [classes], so a // inside a string or a regex survives. Every stripped file is checked with node --check; the zip's
// real acceptance is PS.selfTest on the unzipped copy.
function strip(src) {
  let out = "", i = 0, q = "", lineStart = true, last = "";
  const n = src.length, regexOk = () => last === "" || "(,=:[!&|?{};+-*%<>~^".includes(last) || /(?:^|[^\w$.])(?:return|typeof|case|in|of|void)$/.test(out.trimEnd());
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (q) { out += c; if (c === "\\") { out += d; i += 2; continue; } if (c === q) q = ""; i++; if (c !== " " && c !== "\n") last = c; continue; }
    if (lineStart && (c === " " || c === "\t")) { i++; continue; }
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { i = src.indexOf("*/", i + 2); i = i < 0 ? n : i + 2; continue; }
    if (c === "\n") { out = out.replace(/[ \t]+$/, ""); if (!out.endsWith("\n") && out.length) out += "\n"; lineStart = true; i++; continue; }
    lineStart = false;
    if (c === "'" || c === '"' || c === "`") { q = c; out += c; i++; last = c; continue; }
    if (c === "/" && regexOk()) { let j = i + 1, cls = false; while (j < n && src[j] !== "\n") { const e = src[j]; if (e === "\\") { j += 2; continue; } if (e === "[") cls = true; else if (e === "]") cls = false; else if (e === "/" && !cls) break; j++; } j++; while (j < n && /[a-z]/i.test(src[j])) j++; out += src.slice(i, j); i = j; last = "/"; continue; }
    out += c; if (c !== " " && c !== "\t") last = c; i++;
  }
  return out;
}
// a hash of every source file in the game folder outside dist/ (the Pages copy must not change)
function sourceHash() {
  const h = crypto.createHash("sha256"), walk = (d) => { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (p === distRoot) continue; const st = fs.statSync(p); if (st.isDirectory()) walk(p); else { h.update(path.relative(root, p)); h.update(fs.readFileSync(p)); } } };
  walk(root); return h.digest("hex");
}

const before = sourceHash(), fails = [];
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true }); fs.rmSync(zipPath, { force: true });
const files = runtimeFiles();
for (const f of files) {
  const dst = path.join(out, f); fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (f.endsWith(".js")) { fs.writeFileSync(dst, strip(fs.readFileSync(path.join(root, f), "utf8"))); try { execFileSync(process.execPath, ["--check", dst], { stdio: "pipe" }); } catch (e) { fails.push("strip broke " + f + ": " + String(e.stderr || e).slice(0, 300)); } }
  else if (f === "config.json") fs.writeFileSync(dst, JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, f), "utf8"))));
  else fs.copyFileSync(path.join(root, f), dst);
}
// inject the portal meta and SDK tag right after <meta charset>, ahead of every game script (the SDK global exists when portal.js runs)
const idxPath = path.join(out, "index.html"); let html = fs.readFileSync(idxPath, "utf8");
const inject = `<meta name="ps-portal" content="${portal}">\n` + (sdkData ? '<meta name="ps-portal-data" content="sdk">\n' : "") + PORTALS[portal] + "\n";
if (!/<meta charset="utf-8">\n/.test(html)) fails.push("index.html has no <meta charset> line to inject after");
html = html.replace(/<meta charset="utf-8">\n/, (m) => m + inject); fs.writeFileSync(idxPath, html);

// relative paths only, and every one of them present in the copy (the SDK tag is the one absolute URL, by design)
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).concat([...fs.readFileSync(path.join(out, "style.css"), "utf8").matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/^["']|["']$/g, "")));
for (const r of refs) {
  if (r.startsWith("data:")) continue;
  if (r === PORTALS[portal].match(/src="([^"]+)"/)[1]) continue;
  if (/^[a-z]+:|^\/\//i.test(r) || r.startsWith("/")) { fails.push("absolute path: " + r); continue; }
  const p = r.split("?")[0]; if (!fs.existsSync(path.join(out, p))) fails.push("missing in the copy: " + r);
}
// config.json is fetched by game.js at a relative path (check it resolves in the copy too)
if (!/fetch\("config\.json/.test(fs.readFileSync(path.join(out, "src/game.js"), "utf8"))) fails.push("game.js no longer fetches config.json relatively");

execFileSync("zip", ["-q", "-r", "-X", "-9", zipPath, "."], { cwd: out });
const zipBytes = fs.statSync(zipPath).size, listing = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" }).trim().split("\n").filter((l) => !l.endsWith("/"));
if (zipBytes >= MAX_BYTES) fails.push(`zip ${zipBytes} B >= ${MAX_BYTES}`);
if (listing.length >= MAX_FILES) fails.push(`zip holds ${listing.length} files >= ${MAX_FILES}`);
if (!listing.includes("index.html")) fails.push("index.html is not at the zip root");
if (listing.some((l) => l.startsWith("tools/") || l.endsWith(".md") || l === "thumb.jpg")) fails.push("an excluded file is in the zip");
const after = sourceHash(); if (after !== before) fails.push("the source folder changed during the build");

const report = { portal, sdkData, out: path.relative(root, out), zip: path.relative(root, zipPath), zipBytes, zipKB: +(zipBytes / 1024).toFixed(1), files: listing.length, list: listing, sourceHash: before, sourceUnchanged: after === before, fails };
console.log(JSON.stringify(report, null, 1));
process.exit(fails.length ? 1 : 0);
