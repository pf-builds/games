// Critic v5 (v5 R1 rules: 5 spaces, no kills; from critic v4.3). Critic v4.3: real pace from the SPEC text (v4.2 entry + the v4.2 fix pass's exact wording) on each level's own tag, with the
// critic's v4.3 rules: the stored order replayed, each next card tapped the moment its tap is legal; raw = engine time when the
// replay is quiet after its last tap (every sapper home); ms = round(raw x 1.77). Also grade[tag].thinks, read as: after each
// tap, the next one waits at least 1, 2 or 4 s, then goes the moment it is legal (1 won, 0 lost).
// Usage: node tools/critic-v4.3/pace.mjs [--ids id,id]
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { compile, Game } from './rules.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), J = (f) => JSON.parse(fs.readFileSync(path.join(root, f)));
const cfg = J('config.json'), factor = J('tools/bake-config.json').duration.pace.factor, args = process.argv.slice(2);
let all = [...J('tools/build-data/levels/levels.json').levels, ...J('tools/build-data/levels/gallery.json').levels].filter((l) => l.tag && l.grade[l.tag] && l.grade[l.tag].pace);
if (args.includes('--ids')) all = all.filter((l) => args[args.indexOf('--ids') + 1].split(',').includes(l.id));
function replay(L, think) { const r = cfg.v3.rules, G = new Game(compile(L), { hold: r.hold, archersKill: false, lockSpaces: cfg.v3.twists.lockSpaces }, cfg.v3.time);
  const order = L.win[L.tag].split('').map(Number); let i = 0, guard = 0, next = 0;
  while (G.status === 0 && guard++ < 1e7) { while (i < order.length && G.status === 0 && G.now >= next && G.legal(order[i])) { G.play(order[i++]); next = G.now + think; }
    if (G.status !== 0) break; const tq = G.busy ? G.q.peek().t : Infinity; if (i < order.length && G.now < next && next <= tq) { G.advanceTo(next); continue; } if (!G.busy) break; G.advanceTo(tq); }
  const won = G.status === 1; return { won, raw: won ? G.settle() : null, taps: i, n: order.length, reason: G.reason }; }
let same = 0, thinkSame = 0, thinkN = 0; const bad = [];
for (const L of all) { const g = L.grade[L.tag], a = replay(L, 0), raw = a.won ? a.raw : g.ms, ms = Math.round(raw * factor); if (g.pace.raw === raw && g.pace.ms === ms) same++; else bad.push(`${L.id} [${L.tag}] stored ${g.pace.raw}/${g.pace.ms} mine ${a.won ? 'won' : 'LOST ' + a.reason} ${raw}/${ms}`);
  if (g.thinks) { thinkN++; const th = [1000, 2000, 4000].map((t) => (replay(L, t).won ? 1 : 0)); if (JSON.stringify(th) === JSON.stringify(g.thinks)) thinkSame++; else bad.push(`${L.id} [${L.tag}] thinks stored ${JSON.stringify(g.thinks)} mine ${JSON.stringify(th)}`); } }
console.log(`real pace: ${same}/${all.length} identical (raw and ms, factor ${factor}); thinks: ${thinkSame}/${thinkN} identical`); for (const x of bad.slice(0, 12)) console.log('  DIFF', x);
