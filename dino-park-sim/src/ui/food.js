// Food without round trips (M4): days-of-food chips for the park bar, the auto-restock rule editor shared by the
// General Store Food tab and Settings, and the Food tab's quantity box pre-fill. Numbers come from balance.food.
import { DATA, state, fmt$, emitChange } from '../state.js';
import { foodDays, setAutoRestock } from '../economy.js';
import { h, button, term } from './dom.js';
import { DIET_ICON } from './stores.js';

const warnDays = () => DATA.balance.food?.warn_days ?? 5;

// "🌿 12d · 🥩 3d" chips: one per food something in the park eats, red below warn_days, with a tooltip on hover.
export function foodDayChips() {
  const rows = foodDays().filter(r => r.need > 0);
  if (!rows.length) return h('span', { class: 'muted small' }, 'No animals to feed yet');
  return h('span', { class: 'food-chips' }, rows.map(r => {
    const days = Math.floor(r.days);
    const cls = r.stock <= 0 ? 'chip-food out' : days < warnDays() ? 'chip-food low' : 'chip-food';
    const rule = state.auto_restock[r.food.id];
    return h('span', { class: cls, 'data-tip-text': `${r.food.name}: ${r.stock} units in stock, ${r.need} eaten a day = ${days} day${days === 1 ? '' : 's'} left.${rule && rule.on ? ` Auto-restock is on (below ${rule.threshold_days} days: buy ${rule.amount}).` : ' Auto-restock is off.'}` },
      `${DIET_ICON[r.food.diet] || ''} ${days}d${rule && rule.on ? ' ⟳' : ''}`);
  }));
}

// Suggested units to buy for one food: enough for balance.food.restock_fill_days of today's need (at least one bundle).
export function suggestedUnits(foodId) {
  const row = foodDays().find(r => r.food.id === foodId);
  const bundle = DATA.food.purchase_bundle_units;
  if (!row || row.need <= 0) return bundle;
  const fill = DATA.balance.food?.restock_fill_days ?? 30;
  return Math.max(bundle, Math.ceil(row.need * fill - row.stock));
}

// Rule editor: one row per eaten food with an on/off box, threshold (days) and amount (units). Applies live.
export function autoRestockPanel({ compact = false } = {}) {
  const wrap = h('div', { class: 'auto-restock' });
  const rows = foodDays();
  wrap.append(
    compact ? null : h('p', { class: 'muted' }, term('auto_restock', 'Auto-restock'), ': when a food drops below the threshold, the General Store buys the amount for you and charges it. A ticker line and a digest entry say what was bought. Off by default.'),
    h('table', { class: 'table restock-table' },
      h('tr', {}, h('th', {}, 'Food'), h('th', {}, 'On'), h('th', {}, 'Buy when below'), h('th', {}, 'Buy this many'), h('th', {}, 'Cost per buy'), h('th', {}, term('days_of_food', 'Now'))),
      rows.map(r => {
        const rule = state.auto_restock[r.food.id];
        if (!rule) return null;
        const cost = h('td', { class: 'num' }, fmt$(rule.amount * r.food.unit_cost));
        const on = h('input', { type: 'checkbox', checked: rule.on, on: { change: e => { setAutoRestock(r.food.id, { on: e.target.checked }); emitChange(); } } });
        const th = h('input', { type: 'number', min: 1, max: 60, step: 1, value: rule.threshold_days, class: 'qty', on: { change: e => { setAutoRestock(r.food.id, { threshold_days: e.target.value }); e.target.value = rule.threshold_days; emitChange(); } } });
        const am = h('input', { type: 'number', min: 1, max: 1000, step: 1, value: rule.amount, class: 'qty', on: { change: e => { setAutoRestock(r.food.id, { amount: e.target.value }); e.target.value = rule.amount; cost.textContent = fmt$(rule.amount * r.food.unit_cost); emitChange(); } } });
        const days = r.need > 0 ? `${Math.floor(r.days)} day${Math.floor(r.days) === 1 ? '' : 's'} (${r.stock} units, ${r.need}/day)` : `${r.stock} units, nothing eats it`;
        return h('tr', {},
          h('td', {}, h('span', { class: 'swatch', style: `background:${r.food.color}` }), r.food.name),
          h('td', {}, on),
          h('td', {}, th, ' days of stock'),
          h('td', {}, am, ' units'),
          cost,
          h('td', { class: r.need > 0 && r.days < warnDays() ? 'bad' : 'muted' }, days));
      })));
  return wrap;
}

// A one-click "turn every rule on with sensible amounts" helper (Settings).
export function autoRestockAllButton() {
  return button('Turn on for every food', () => {
    for (const r of foodDays()) setAutoRestock(r.food.id, { on: true, amount: Math.max(state.auto_restock[r.food.id].amount, Math.ceil(Math.max(1, r.need) * (DATA.balance.food?.restock_fill_days ?? 30) / 2)) });
    emitChange();
  });
}
