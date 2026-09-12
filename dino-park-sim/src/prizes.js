// Park Prizes (M3): decorative rewards for cumulative General Store spend (state.store_spend) and two park
// milestones. Definitions and thresholds live in data/prizes.json; this module only decides when one is earned and
// announces it (ticker line, digest entry, 'prize' bus event for the fanfare toast). Rendering is in render/living.js.
import { DATA, state, bus, prizeDefs, prizeEarned, earnedPrizes, speciesOwned, log, digestAdd, fmt$ } from './state.js';

// Cumulative General Store spend (every tab: fences, upgrades, advertising, food). Called by the economy after each
// such purchase; returns any prizes earned by it.
export function addStoreSpend(n) {
  state.store_spend = (state.store_spend || 0) + n;
  return checkPrizes();
}

function milestoneMet(m, ctx) {
  if (!m) return false;
  if (m.type === 'species') return speciesOwned().size >= m.count;
  if (m.type === 'rating_quarter') return !!ctx.quarterClosed && ctx.rating >= m.stars;
  return false;
}

// Awards every unearned prize whose condition now holds, in data order. ctx.quarterClosed / ctx.rating are passed by
// the quarter close so the "first five-star quarter" prize is judged on a closed quarter, not a lucky afternoon.
export function checkPrizes(ctx = {}) {
  const won = [];
  for (const p of prizeDefs()) {
    if (prizeEarned(p.id)) continue;
    const ok = p.threshold != null ? (state.store_spend || 0) >= p.threshold : milestoneMet(p.milestone, ctx);
    if (!ok) continue;
    state.prizes.push({ id: p.id, day: state.day });
    const why = p.threshold != null ? `${fmt$(p.threshold)} spent at the General Store` : p.milestone.type === 'species' ? `${p.milestone.count} species in the park` : `a ${p.milestone.stars}-star quarter`;
    log(`Park Prize: ${p.name} (${why}).`);
    digestAdd({ title: `Park Prize: ${p.name}`, type: 'prize', summary: why, tooltip: p.blurb });
    won.push(p);
    bus.dispatchEvent(new CustomEvent('prize', { detail: { prize: p, why } }));
  }
  return won;
}

// Next spend-threshold prize and progress toward it (null when every spend prize is earned).
export function nextPrize() {
  const spend = state.store_spend || 0;
  const next = prizeDefs().find(p => p.threshold != null && !prizeEarned(p.id));
  if (!next) return null;
  const prev = prizeDefs().filter(p => p.threshold != null && p.threshold < next.threshold).reduce((m, p) => Math.max(m, p.threshold), 0);
  return { prize: next, spend, threshold: next.threshold, remaining: Math.max(0, next.threshold - spend), progress: Math.max(0, Math.min(1, (spend - prev) / (next.threshold - prev))) };
}

// Highest fountain look earned (0 = base fountain), for the renderer.
export function fountainLevel() {
  let lvl = 0;
  for (const p of earnedPrizes()) if (p.render === 'fountain' && (p.level || 0) > lvl) lvl = p.level;
  return lvl;
}

export function prizeSummary() {
  return { earned: earnedPrizes().map(p => ({ id: p.id, name: p.name, day: p.day, appeal_bonus: p.appeal_bonus })), next: nextPrize(), store_spend: state.store_spend || 0, total: DATA.prizes.prizes.length };
}
