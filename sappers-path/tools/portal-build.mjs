#!/usr/bin/env node
// Sapper's Path portal build (lane P, Stage 1: CrazyGames Basic Launch, no SDK; tools/portal-notes.md, config tools/portal-config.json).
//   node tools/portal-build.mjs [--dirty]
// Writes <out>/<name>/ (the staged copy), <out>/<name>.zip (index.html at its root) and <out>/build.json (every file and its bytes),
// all gitignored. The file list is traced from what the page fetches, never hand-kept:
//   index.html: every src, href and srcset (the scripts, the two stylesheets, the font preload, the home's two paintings);
//   *.css: every url() (the font);
//   src/*.js: every quoted literal path to a data or media file (config.json and levels/*.json, the getJSON calls in main.js boot);
//   every JSON the page fetches, walked to a fixpoint: each "file" or "files" value is a file the page loads (config audio tracks,
//   the tutorial's file, map/layout.json's sheets, levels/zen.pk.json's world files and their sheets, config lands' sheets),
//   looked up as written, then under levels/ and map/ (the folders main.js puts in front of them).
// A traced path that is not in the game folder fails the build, unless it is a ?debug=1-only file (config debugOnly: left out on
// purpose). Copies that change on the way: index.html loses its social-card <meta> lines (stripMeta: they carry the pf-builds URL);
// every runtime JSON loses its developer notes ("note", "about" and "*Note" string keys, all but keepNotes, which the page shows) and
// its whitespace (Stage 3: config.json alone in Stage 1). Every other file is copied byte for byte, so the ?v= cache tags and the code
// are the Pages build's own. Added: LICENSES.txt (plain text from LICENSES.md, naming only shipped files) and the companions (the font's
// OFL.txt, the Apache 2.0 text). Stage 3: a file named in a JSON under a key the trace does not follow, or a tracked file of the game
// folder that is neither traced, a companion nor in leftOut (with its reason), fails the build. Checks: the source tree is clean
// against HEAD and every shipped source is tracked (git status misses ignored files; --dirty skips
// it for a trial), every src/href/url() in the copy is relative and present, no runtime file holds a banned word or an absolute URL
// other than allowUrls (the SVG namespace in data: URIs), the licence texts name no dev site or other portal, the unzipped total is
// under both maxBytes readings, the file count under maxFiles, no tools/, *.md, pool, frozen or debug file in the zip, and the source
// folder is unchanged by the build (a hash before and after). Exit 0 on success, 1 on a failed check.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), C = JSON.parse(fs.readFileSync(path.join(root, "tools/portal-config.json"), "utf8"));
const outRoot = path.join(root, C.out), stage = path.join(outRoot, C.name), zipPath = path.join(outRoot, C.name + ".zip"), dirty = process.argv.includes("--dirty");
const fails = [], warns = [], rd = (f) => fs.readFileSync(path.join(root, f), "utf8"), has = (f) => fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile();
const bare = (u) => u.split("#")[0].split("?")[0], norm = (f) => path.posix.normalize(f).replace(/^\.\//, "");
const MEDIA = /^(?:[\w-]+\/)*[\w.-]+\.(?:json|webp|jpe?g|png|gif|svg|m4a|ogg|mp3|wav|ttf|otf|woff2?)$/i;

// ---- the trace ---------------------------------------------------------------------------------------------------------------
const files = new Map(); // path -> why (the first place that named it)
// Partial's Pixels is web only (config webOnly; Peter, 2026-10-22): its files are never traced, its config keys, markup and
// licence rows are dropped from the copy, and a check below fails if any of it is left in the build.
const WO = C.webOnly || null, woFile = (f) => !!WO && new RegExp(WO.files).test(f);
const woConfig = (o) => { if (!WO) return o; for (const k of WO.configKeys) { const ks = k.split("."), last = ks.pop(); let t = o; for (const q of ks) t = t && t[q]; if (t && typeof t === "object") delete t[last]; }
  const drop = (v) => { if (Array.isArray(v)) return v.filter((x) => !WO.arrayValues.includes(x)).map(drop); if (v && typeof v === "object") { for (const q of Object.keys(v)) v[q] = drop(v[q]); } return v; }; return drop(o); };
const woHtml = (t) => (WO ? WO.html.reduce((a, re) => a.replace(new RegExp(re, "g"), ""), t) : t);
const want = (f, why) => { f = norm(f); if (files.has(f) || woFile(f)) return; if (C.debugOnly.includes(f)) { files.set(f, "debug-only: " + why); return; } if (!has(f)) fails.push("traced but missing: " + f + " (" + why + ")"); files.set(f, why); };
const html = rd("index.html");
want("index.html", "the page");
for (const m of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) if (!m[1].startsWith("data:")) want(bare(m[1]), "index.html " + m[0].trim().split("=")[0]);
for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) for (const part of m[1].split(",")) want(bare(part.trim().split(/\s+/)[0]), "index.html srcset");
for (const f of [...files.keys()].filter((f) => f.endsWith(".css"))) for (const m of rd(f).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) if (!m[1].startsWith("data:")) want(path.posix.join(path.posix.dirname(f), bare(m[1])), f + " url()");
for (const f of [...files.keys()].filter((f) => f.endsWith(".js"))) for (const m of rd(f).matchAll(/["'`]([^"'`\s?]+)(?:\?[^"'`]*)?["'`]/g)) if (MEDIA.test(m[1]) && /^(?:config\.json|[a-z]+\/)/.test(m[1])) want(m[1], f + " literal");
// every fetched JSON, walked for "file"/"files" values until no new JSON turns up (bounded: one pass per JSON file in the game)
const walked = new Set(), at = (v) => [v, "levels/" + v, "map/" + v].map(norm).find(has);
const walk = (o, why) => { if (Array.isArray(o)) { for (const v of o) walk(v, why); return; } if (!o || typeof o !== "object") return;
  for (const [k, v] of Object.entries(o)) { const vs = k === "file" || k === "files" ? [].concat(v).filter((s) => typeof s === "string" && MEDIA.test(s)) : null;
    if (vs) for (const s of vs) { const f = at(s); if (f) want(f, why + " ." + k); else fails.push("named but found nowhere: " + s + " (" + why + " ." + k + ")"); }
    else if (typeof v === "string" && MEDIA.test(v) && at(v) && !/^(?:note|about)$|Note$/.test(k)) named.push([v, why + " ." + k]); else walk(v, why); } };
const named = []; // Stage 3: a game file named under a key the trace does not follow (checked once the trace is done)
for (let pass = 0; pass < 200; pass++) { const next = [...files.keys()].filter((f) => f.endsWith(".json") && !walked.has(f) && !C.debugOnly.includes(f) && has(f)); if (!next.length) break;
  for (const f of next) { walked.add(f); try { walk(JSON.parse(rd(f)), f); } catch (e) { fails.push("JSON did not parse: " + f + " " + e.message); } } }

// Stage 3 (the Stage 1 critic's 7a): nothing the page might load slips past the trace. A file named under any other key fails
// unless the trace reached it some other way; every tracked file of the game folder (git ls-files, minus tools/ and *.md) is
// traced, a companion, or in config leftOut with the reason it stays out; anything else fails loudly.
for (const [v, why] of named) { const f = at(v); if (!files.has(f) && !(f in C.leftOut)) fails.push("a game file named where the trace does not look: " + v + " (" + why + ")"); }
let tracked = []; try { tracked = execFileSync("git", ["ls-files", "-z", "--", "."], { cwd: root, encoding: "utf8" }).split("\0").filter((f) => f && !f.startsWith("tools/") && !f.endsWith(".md")); } catch (e) { fails.push("git ls-files failed"); }
for (const f of tracked) if (!files.has(f) && !C.companions.includes(f) && !(f in C.leftOut)) fails.push("tracked but neither traced, a companion nor in leftOut: " + f);
for (const f of Object.keys(C.leftOut)) if (files.has(f) && !C.debugOnly.includes(f)) fails.push("leftOut names a file the page loads: " + f);

// ---- the clean-tree gate and the source hash ---------------------------------------------------------------------------------
let commit = "?"; try { commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch (e) { fails.push("not a git checkout"); }
const shipSrc = [...files.keys()].filter((f) => !C.debugOnly.includes(f)).concat(C.companions, [C.licences.from, "tools/portal-config.json"]);
{ let st = ""; try { st = execFileSync("git", ["status", "--porcelain", "--", ...shipSrc], { cwd: root, encoding: "utf8" }).trim(); } catch (e) { st = "git status failed"; }
  if (st) (dirty ? warns : fails).push("source differs from HEAD " + commit.slice(0, 7) + (dirty ? " (--dirty)" : "") + ": " + st.split("\n").join("; "));
  // Stage 3 (critic 7b): git status never reports an ignored file, so every shipped source must also be tracked at HEAD
  const untracked = shipSrc.filter((f) => { try { execFileSync("git", ["ls-files", "--error-unmatch", "--", f], { cwd: root, stdio: "ignore" }); return false; } catch (e) { return true; } });
  if (untracked.length) (dirty ? warns : fails).push("shipped but not tracked in git (ignored or new): " + untracked.join(", ")); }
const sourceHash = () => { const h = crypto.createHash("sha256"), go = (d) => { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (p === outRoot || f === "node_modules" || f.startsWith(".")) continue; const s = fs.statSync(p); if (s.isDirectory()) go(p); else { h.update(path.relative(root, p)); h.update(fs.readFileSync(p)); } } }; go(root); return h.digest("hex"); };
const before = sourceHash();

// ---- the copy ----------------------------------------------------------------------------------------------------------------
fs.rmSync(stage, { recursive: true, force: true }); fs.rmSync(zipPath, { force: true }); fs.mkdirSync(stage, { recursive: true });
const put = (f, data) => { const d = path.join(stage, f); fs.mkdirSync(path.dirname(d), { recursive: true }); if (data == null) fs.copyFileSync(path.join(root, f), d); else fs.writeFileSync(d, data); };
const notes = []; // the config keys dropped, by path
// Stage 3 (critic M2): every runtime JSON loses its developer notes ("note", "about", "*Note" string keys), all but keepNotes,
// the ones the page shows (the realms' lore, config eras[].note; the tour's jam line, tutorial steps[].jamNote).
const unNote = (o, p, f) => { if (Array.isArray(o)) return o.map((v) => unNote(v, p + "[]", f)); if (!o || typeof o !== "object") return o; const r = {};
  for (const [k, v] of Object.entries(o)) { const q = p + "." + k; if (/^(?:note|about)$|Note$/.test(k) && typeof v === "string" && !C.keepNotes.includes(f + " " + q)) { notes.push(f + " " + q); notesB += Buffer.byteLength(JSON.stringify(v)); continue; } r[k] = unNote(v, q, f); } return r; };
let notesB = 0;
const stripped = [];
for (const f of [...files.keys()].sort()) {
  if (C.debugOnly.includes(f) || !has(f)) continue;
  if (f === "index.html") put(f, woHtml(html).split("\n").filter((l) => { const drop = /^<meta\b/.test(l) && C.stripMeta.some((s) => l.includes(s)); if (drop) stripped.push(l.trim()); return !drop; }).join("\n"));
  else if (f.endsWith(".json")) put(f, JSON.stringify(unNote(f === "config.json" ? woConfig(JSON.parse(rd(f))) : JSON.parse(rd(f)), "", f)));
  else put(f);
}
for (const f of C.companions) { if (has(f)) put(f); else fails.push("companion missing: " + f); }
// LICENSES.txt: LICENSES.md as plain text. Headings become a line and an underline; a table row becomes one line per column
// ("Header: cell"); ** and backticks go. Stage 3 rewrites the credit content itself; this is only the generation step.
function plain(md) {
  const out = [`Sapper's Path: asset licenses and credits (plain text, build ${commit.slice(0, 7)})`, ""], L = md.split("\n"); let head = null;
  const clean = (s) => s.replace(/\*\*/g, "").replace(/`/g, "").trim(), cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map(clean);
  for (let i = 0; i < L.length; i++) { const l = L[i];
    if (/^#{1,6} /.test(l)) { if (i === 0) continue; const t = clean(l.replace(/^#+ /, "")); out.push("", t, (l.startsWith("## ") ? "=" : "-").repeat(Math.min(t.length, 100))); head = null; continue; }
    if (/^\|/.test(l)) { const c = cells(l); if (!head) { head = c; continue; } if (c.every((x) => /^:?-+:?$/.test(x))) continue; c.forEach((x, j) => out.push((j ? "  " : "- ") + (head[j] || "") + ": " + x)); continue; }
    head = null; out.push(clean(l)); }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
// Stage 3: the plain text names only what ships. licences.rewrite ([regex, words] pairs) puts words in place of the studio's
// own records and build scripts; licences.dropRows drops table rows about files the build leaves out (the arcade's thumbnail).
const lic = (md) => { if (WO) { const a = md.indexOf(WO.licenceCut[0]), b = md.indexOf(WO.licenceCut[1]); if (a >= 0 && b > a) md = md.slice(0, a) + md.slice(b + WO.licenceCut[1].length); } // web only: the mode's licence section
  let t = md.split("\n").filter((l) => !(/^\|/.test(l) && C.licences.dropRows.concat(WO ? WO.licenceRows : []).some((r) => l.includes(r)))).join("\n"); for (const [re, to] of C.licences.rewrite) t = t.replace(new RegExp(re, "g"), to); return t; };
put(C.licences.to, plain(lic(rd(C.licences.from))));

// ---- the checks --------------------------------------------------------------------------------------------------------------
const list = []; (function ls(d) { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) ls(p); else list.push(path.relative(stage, p).split(path.sep).join("/")); } })(stage);
const sizes = Object.fromEntries(list.map((f) => [f, fs.statSync(path.join(stage, f)).size])), total = Object.values(sizes).reduce((a, b) => a + b, 0);
const sHtml = fs.readFileSync(path.join(stage, "index.html"), "utf8");
for (const m of sHtml.matchAll(/\s(src|href|srcset)="([^"]+)"/g)) for (const u of (m[1] === "srcset" ? m[2].split(",").map((s) => s.trim().split(/\s+/)[0]) : [m[2]])) { if (u.startsWith("data:")) continue;
  if (/^[a-z][\w+.-]*:|^\/\//i.test(u) || u.startsWith("/")) fails.push("absolute path in index.html: " + u); else if (!list.includes(norm(bare(u)))) fails.push("index.html names a file not in the build: " + u); }
for (const f of list.filter((f) => f.endsWith(".css"))) for (const m of fs.readFileSync(path.join(stage, f), "utf8").matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) { const u = m[1]; if (u.startsWith("data:")) continue;
  if (/^[a-z][\w+.-]*:|^\/\//i.test(u) || u.startsWith("/")) fails.push("absolute url() in " + f + ": " + u); else if (!list.includes(norm(path.posix.join(path.posix.dirname(f), bare(u))))) fails.push(f + " names a file not in the build: " + u); }
// the word scan: runtime text files hold no banned word (absolute URLs only from allowUrls); the licence texts may carry plain-text
// source and licence URIs (CC BY asks for them) but no dev site or other portal. crazygames in a runtime file is only reported:
// it is the host portal, named in a code comment (src/save.js CLOUD HOOK), never a link.
const TEXT = /\.(?:html|css|js|json)$/i, LIC = [C.licences.to, ...C.companions], scan = {};
for (const f of list) { const lic = LIC.includes(f); if (!TEXT.test(f) && !lic) continue; const t = fs.readFileSync(path.join(stage, f), "utf8");
  for (const w of C.banned) { const re = new RegExp(w, "gi"); let n = 0, ok = 0; for (const m of t.matchAll(re)) { if (/^https?:/i.test(m[0]) && (lic || C.allowUrls.some((a) => t.startsWith(a, m.index)))) { ok++; continue; } n++; }
    if (n || ok) (scan[f] = scan[f] || {})[w] = ok ? n + " (+" + ok + " allowed)" : n;
    if (n) (w === "crazygames" ? warns : fails).push(`${f}: ${n} x /${w}/` + (w === "crazygames" ? " (the host portal, in a comment)" : "")); } }
// Web only (config webOnly): nothing in the build names Partial's Pixels, PartialVoid or the mode's level files, and none of its files ships.
if (WO) { for (const f of list) { if (woFile(f)) fails.push("web-only file in the build: " + f); if (!TEXT.test(f) && !LIC.includes(f)) continue; const t = fs.readFileSync(path.join(stage, f), "utf8");
  for (const w of WO.banned) { const n = (t.match(new RegExp(w, "gi")) || []).length; if (n) fails.push(`${f}: ${n} x /${w}/ (Partial's Pixels is web only)`); } } }
// Stage 3 (critic M1): the licence text holds no local path and every file it names is in the build.
{ const t = fs.readFileSync(path.join(stage, C.licences.to), "utf8"), noUrl = t.replace(/https?:\/\/\S+/g, " ");
  if (/\/Users\/|~\/|[A-Z]:\\/.test(t)) fails.push(C.licences.to + " holds a local path");
  const named = [...new Set([...noUrl.matchAll(/(?:[\w.-]+\/)*[\w.-]+\.(?:json|js|mjs|py|sh|jpe?g|png|webp|m4a|ogg|ttf|txt|md|css|html)\b/g)].map((m) => m[0]))];
  const missing = named.filter((n) => !list.includes(n) && !list.some((f) => f.endsWith("/" + n)));
  if (missing.length) fails.push(C.licences.to + " names files the build does not hold: " + missing.join(", ")); }
if (total > Math.min(...C.maxBytes)) fails.push(`unzipped total ${total} B over ${Math.min(...C.maxBytes)}`);
if (list.length > C.maxFiles) fails.push(`${list.length} files over ${C.maxFiles}`);
if (list.some((f) => f.startsWith("tools/") || f.endsWith(".md") || /(^|\/)(pool-[^/]*\.json|frozen\/|debug-v4\.json|gallery-manifest\.json)/.test(f))) fails.push("an excluded file is in the build");
if (!list.includes("index.html")) fails.push("no index.html at the root");
execFileSync("zip", ["-q", "-r", "-X", "-9", zipPath, "."], { cwd: stage });
const zipBytes = fs.statSync(zipPath).size, zlist = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" }).trim().split("\n").filter((l) => !l.endsWith("/"));
if (zlist.length !== list.length || !zlist.includes("index.html")) fails.push("the zip's listing differs from the staged copy");
const after = sourceHash(); if (after !== before) fails.push("the source folder changed during the build");
const unfetched = [...files.keys()].filter((f) => C.debugOnly.includes(f));
const report = { commit, dirty, zip: path.relative(root, zipPath), zipBytes, total, files: list.length, gates: { maxBytes: C.maxBytes.map((b) => ({ limit: b, pass: total <= b, zipPass: zipBytes <= b })), maxFiles: { limit: C.maxFiles, pass: list.length <= C.maxFiles } },
  leftOut: unfetched, metaStripped: stripped, notesDropped: { count: notes.length, bytes: notesB, where: [...new Set(notes.map((n) => n.replace(/\[\]/g, "").split(" ")[0]))] }, scan, warns, fails, sizes };
fs.writeFileSync(path.join(outRoot, "build.json"), JSON.stringify(report, null, 1) + "\n");
const { sizes: _s, ...brief } = report; console.log(JSON.stringify(brief, null, 1));
console.log((fails.length ? "FAIL" : "PASS") + `: ${list.length} files, ${total} B unzipped, ${zipBytes} B zipped -> ${path.relative(root, zipPath)}`);
process.exit(fails.length ? 1 : 0);
