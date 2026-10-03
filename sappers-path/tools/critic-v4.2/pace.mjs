// Critic v4.2: the real-pace measure recomputed from the SPEC-v4 v4.2 text with the critic's own rules (tools/critic-v4.1/rules.mjs):
// "the stored Normal winning order is replayed, each next card tapped the moment its tap is legal (a free space, the tap not
// refused). The result is that engine time x duration.pace.factor (1.77)." Two readings of "engine time" are computed: the
// winning pop, and every squad home after it (grade.ms's convention). Compared with grade.normal.pace {raw, ms}.
// Usage: node tools/critic-v4.2/pace.mjs [--all] [--ids id,id]
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { compile, Game } from '../critic-v4.1/rules.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), J = (f) => JSON.parse(fs.readFileSync(path.join(root, f)));
const cfg = J('config.json'), bake = J('tools/bake-config.json'), factor = bake.duration.pace.factor, args = process.argv.slice(2);
const all = [...J('levels/levels.json').levels, ...J('levels/gallery.json').levels].filter((l) => l.grade && l.grade.normal && l.grade.normal.pace);
const pick = args.includes('--all') ? all : args.includes('--ids') ? all.filter((l) => args[args.indexOf('--ids') + 1].split(',').includes(l.id)) : ['e2-26', 'e2-31', 'e2-40', 'e3-51', 'e3-62', 'e4-76', 'e4-77', 'e4-88', 'e4-100', 'g-tw-1f355'].map((id) => all.find((l) => l.id === id)).filter(Boolean);
let same = 0, rows = [];
for (const L of pick) { const r = cfg.v3.rules.normal, G = new Game(compile(L), { hold: r.hold, archersKill: r.archersKill, lockSpaces: cfg.v3.twists.lockSpaces }, cfg.v3.time);
  const order = L.win.normal.split('').map(Number); let i = 0, guard = 0;
  while (G.status === 0 && guard++ < 1e7) { while (i < order.length && G.status === 0 && G.legal(order[i])) G.play(order[i++]); if (G.status !== 0 || !G.busy) break; G.advanceTo(G.q.peek().t); }
  const won = G.status === 1, winPop = G.winAt, home = G.settle(), st = L.grade.normal.pace;
  const raw = won ? home : L.grade.normal.ms; const ms = Math.round(raw * factor); const ok = st.raw === raw && st.ms === ms; if (ok) same++;
  rows.push(`${ok ? 'SAME' : 'DIFF'} ${L.id.padEnd(14)} stored raw ${st.raw} ms ${st.ms} | mine: ${won ? 'won' : 'LOST ' + G.reason} taps ${i}/${order.length}, winning pop ${winPop}, all home ${home} -> raw ${raw} x ${factor} = ${ms}`); }
console.log(rows.join('\n')); console.log(`real pace: ${same}/${pick.length} identical to grade.normal.pace (raw and ms); factor ${factor}`);
