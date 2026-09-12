// Park Prizes panel (modal) and the fanfare toast. Data: data/prizes.json; logic: src/prizes.js.
import { DATA, state, prizeDefs, prizeEarned, earnedPrizes, fmt$, pct, season, year, dayOfQuarter, onChange } from '../state.js';
import { nextPrize } from '../prizes.js';
import { h, button, term, clear, append } from './dom.js';
import { openModal } from './modals.js';
import { toast } from './effects.js';

const whenLabel = day => `Day ${dayOfQuarter(day)} · ${season(day)} · Year ${year(day)}`;
const condition = p => (p.threshold != null ? `${fmt$(p.threshold)} spent at the General Store` : p.milestone.type === 'species' ? `${p.milestone.count} different species in the park` : `a ${p.milestone.stars}-star quarter`);

// The panel body: progress bar to the next spend prize, then every prize in order (earned with its date, or locked).
export function prizesBody() {
  const wrap = h('div', { class: 'prizes' });
  const render = () => {
    const next = nextPrize();
    const earned = earnedPrizes();
    const spend = state.store_spend || 0;
    append(clear(wrap), [
      h('p', { class: 'muted' }, 'Spend at the General Store (fences, upgrades, ads, food, every tab) and the park earns decorations that visitors like. Each ', term('prize', 'prize'), ' adds a little ', term('appeal', 'appeal'), '. Two are earned by milestones instead.'),
      h('div', { class: 'prize-progress' },
        h('div', { class: 'row' }, h('b', {}, `Store spend so far: ${fmt$(spend)}`), h('span', { class: 'muted' }, `· ${earned.length}/${prizeDefs().length} prizes earned`)),
        next ? h('div', {},
          h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: `width:${Math.round(next.progress * 100)}%` })),
          h('div', { class: 'muted small' }, `Next: ${next.prize.name} at ${fmt$(next.threshold)} · ${fmt$(next.remaining)} to go`))
          : h('div', { class: 'good' }, 'Every spend prize is yours. Only the milestone prizes remain.')),
      h('div', { class: 'cards grid-3 prize-cards' }, prizeDefs().map(p => {
        const got = earnedPrizes().find(e => e.id === p.id);
        return h('div', { class: `card ${got ? 'owned' : 'locked'}` },
          h('div', { class: 'card-title' }, got ? '🏆 ' : '🔒 ', p.name),
          h('div', { class: 'muted small' }, condition(p)),
          h('p', { class: 'muted' }, p.blurb),
          h('div', { class: got ? 'good small' : 'muted small' }, got ? `Earned ${whenLabel(got.day)} · appeal +${pct(p.appeal_bonus)}` : `Appeal +${pct(p.appeal_bonus)} when earned`));
      }))]);
  };
  render();
  const off = onChange(() => { if (!wrap.isConnected) return off(); render(); });
  return wrap;
}

export function openPrizes() {
  const m = openModal({ title: 'Park Prizes', className: 'wide', body: h('div', {}, prizesBody(), h('div', { class: 'row end' }, button('Close', () => m.close(), { class: 'btn primary' }))) });
  return m;
}

// Fanfare toast (DOM, non-blocking, does not pause the clock). Stacks when several prizes land at once (M5: the
// shared toast in ui/effects.js slides in, stacks and auto-dismisses; static under Reduce motion).
export function prizeToast({ prize, why }) {
  return toast({ icon: '🏆', title: `Park Prize: ${prize.name}`, text: `${why}. ${prize.blurb}`, cls: 'prize-toast', seconds: DATA.balance.prizes?.toast_seconds ?? 6 });
}
void prizeEarned;
