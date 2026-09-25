// M8: summarise sweep match records against SPEC-v2 §9 / the M8 brief targets
import fs from 'node:fs';
const ok = (v) => v != null && v >= 0;
const med = (a) => { const s = a.filter((v) => v != null).map((v) => (v < 0 ? Infinity : v)).sort((x, y) => x - y); if (!s.length) return null; const m = s[s.length >> 1]; return m === Infinity ? 'never' : Math.round(m * 10) / 10; };
const mean = (a) => { const s = a.filter((v) => v != null); return s.length ? Math.round((s.reduce((x, y) => x + y, 0) / s.length) * 100) / 100 : null; };
const pct = (n, d) => (d ? Math.round((100 * n) / d) : null);
export function summarize(ms) {
  const groups = {};
  for (const m of ms) (groups[m.kind === 'ai' ? 'ai' : 'bot:' + m.difficulty] ||= []).push(m);
  const out = {};
  for (const [g, a] of Object.entries(groups)) {
    const bot = g !== 'ai', horn = a.filter((m) => m.hornLeader), elims = a.flatMap((m) => m.elims);
    const t180 = a.filter((m) => m.tiers180).map((m) => (bot ? [m.tiers180[0]] : m.tiers180.filter((v, i) => m.alive[i] || true))).flat();
    const tEnd = bot ? a.filter((m) => m.alive[0] !== false && m.counts[0] > 0).map((m) => m.tiers[0]) : a.flatMap((m) => m.tiers.filter((v, i) => m.alive[i]));
    const tEndAll = bot ? a.map((m) => m.tiers[0]) : tEnd;
    out[g] = {
      n: a.length,
      bell: pct(a.filter((m) => (bot ? m.bell : m.result === 'bell')).length, a.length),
      horn3: pct(a.filter((m) => m.hornAlive >= 3).length, a.length), hornAlive: mean(horn.map((m) => m.hornAlive)),
      lead: bot ? null : pct(horn.filter((m) => m.hornLeader === m.biggest).length, horn.length),
      win: bot ? pct(a.filter((m) => m.won).length, a.length) : null,
      sight: med(a.map((m) => m.firstSight)), sightAny: med(a.map((m) => m.firstSightAny)),
      fight: med(a.map((m) => m.firstFight)), pfight: med(a.map((m) => m.firstPlayerFight)),
      fights: mean(a.map((m) => m.fights)), pfights: mean(a.map((m) => m.playerFights)),
      a60: mean(a.map((m) => m.alive60)), a180: mean(a.map((m) => m.alive180)),
      e1m: pct(elims.filter((e) => e[0] <= 60).length, elims.length), elims: elims.length,
      t180: med(t180), tEnd: med(tEndAll), tRange: tEndAll.length ? Math.min(...tEndAll) + '-' + Math.max(...tEndAll) : '',
      end: med(a.map((m) => m.t)), viol: a.reduce((s, m) => s + (m.viol || 0), 0), capOver: a.reduce((s, m) => s + (m.capOver || 0), 0),
    };
  }
  return out;
}
const COLS = ['n', 'bell', 'horn3', 'hornAlive', 'lead', 'win', 'sight', 'sightAny', 'fight', 'pfight', 'fights', 'pfights', 'a60', 'a180', 'e1m', 't180', 'tEnd', 'tRange', 'end', 'viol'];
export function fmt(tag, s) {
  const L = [`| ${tag} | ${COLS.join(' | ')} |`];
  for (const g of ['ai', 'bot:easy', 'bot:normal', 'bot:hard']) if (s[g]) L.push(`| ${g} | ${COLS.map((c) => (s[g][c] == null ? '-' : s[g][c])).join(' | ')} |`);
  return L.join('\n');
}
// node summ.mjs res/a.json [res/b.json ...]: one table per file (or merged with --merge)
if (process.argv[1] && process.argv[1].endsWith('summ.mjs')) {
  const files = process.argv.slice(2).filter((f) => !f.startsWith('--')), merge = process.argv.includes('--merge');
  if (merge) { const ms = files.flatMap((f) => JSON.parse(fs.readFileSync(f)).matches); console.log(fmt('merged', summarize(ms))); }
  else for (const f of files) { const r = JSON.parse(fs.readFileSync(f)); console.log(fmt(r.tag, summarize(r.matches))); }
}
