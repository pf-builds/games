// dbg: print both sides' events for one rushed game. node dbg.mjs <id> <diff> "<col@t ...>"
import { createRequire } from 'module'; import path from 'path'; import { fileURLToPath } from 'url'; import { compile, Game } from './rules.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), require = createRequire(import.meta.url);
const E = require(path.join(root, 'src/engine.js')), cfg = require(path.join(root, 'config.json'));
const [id, d, seq, lo, hi] = process.argv.slice(2); const L = [...require(path.join(root, 'tools/build-data/levels/levels.json')).levels, ...require(path.join(root, 'levels/debug-v4.json')).levels].find((l) => l.id === id);
const NAME = {}; for (const k in E.EV) NAME[E.EV[k]] = k; const S = E.sim(E.compile(L), E.rulesOf(cfg.v3, d)); S.logOn = true; const ge = [];
const r = cfg.v3.rules[d], G = new Game(compile(L), { hold: r.hold, archersKill: r.archersKill, lockSpaces: 1 }, cfg.v3.time);
const drain = () => { for (let i = 0; i + 2 < S.evLen; i += 3) ge.push(`${S.now} ${NAME[S.ev[i]]} ${S.ev[i + 1]} ${S.ev[i + 2]}`); S.clearLog(); };
for (const tok of seq.split(' ')) { const [c, t] = tok.replace('R', '').split('@').map(Number); while (S.busy && S.nextAt <= t && S.status === 0) { S.advanceTo(S.nextAt); drain(); } if (S.status === 0) S.advanceTo(t); S.play(c, t); drain(); G.advanceTo(t); G.play(c, t); }
while (S.busy && S.status === 0) { S.advanceTo(S.nextAt); drain(); } G.quiet();
const inR = (t) => t >= +lo && t <= +hi; console.log('GAME status', S.status, S.reason, 'kills', S.kills); ge.filter((l) => inR(+l.split(' ')[0]) && !/ DISP | HOME /.test(l)).forEach((l) => console.log('  g', l));
console.log('MINE status', G.status, G.reason, 'kills', G.kills); G.log.filter((e) => inR(e.t) && e.e !== 'FREE').forEach((e) => console.log('  m', e.t, e.e, e.c ?? e.m ?? '', e.sp ?? ''));
