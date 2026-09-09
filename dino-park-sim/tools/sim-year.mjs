// Economy acceptance runner (M2.6 item 4). Run: node tools/sim-year.mjs
//
// Imports the SHIPPED game modules — src/state.js, src/economy.js, src/time.js — and plays them the way the UI
// does, so the numbers it prints are the numbers the game uses. The two scenarios live in tools/sim-driver.js,
// shared with tools/sim.html (the in-browser runner), so node and the browser can never drift apart.
//
// state.js loads data with fetch() and save.js writes to localStorage; both are shimmed here for node.
// Exit code 0 = both acceptance paths hold, 1 = one of them failed.

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const realFetch = globalThis.fetch;
globalThis.fetch = async url => {
  const s = String(url);
  // state.js resolves its data files against its own module URL, so in node they arrive as file: URLs.
  if (s.startsWith('file:')) return { ok: true, status: 200, json: async () => JSON.parse(readFileSync(fileURLToPath(s), 'utf8')) };
  if (s.startsWith('data/')) return { ok: true, status: 200, json: async () => JSON.parse(readFileSync(join(ROOT, s), 'utf8')) };
  return realFetch(url);
};
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};

const src = p => pathToFileURL(join(ROOT, 'src', p)).href;
const S = await import(src('state.js'));
const E = await import(src('economy.js'));
const T = await import(src('time.js'));
const A = await import(src('attendance.js'));
const V = await import(src('events.js'));
await S.loadData();

const { runAll, formatReport } = await import('./sim-driver.js');
const res = runAll({ S, E, T, A, V });
console.log(formatReport(res));
process.exit(res.pass ? 0 : 1);
