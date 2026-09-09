// Marketing view: ticket price slider with live what-if projection, plus advertising campaigns.
import { DATA, state, fmt$, pct, emitChange, season, seasonIndex } from '../state.js';
import { projectDay, computeAttendance } from '../attendance.js';
import * as eco from '../economy.js';
import { h, clear, term, button } from './dom.js';
import { fail } from './enclosure.js';

let live = null;
export function refreshMarketing() { live?.(); }

export function renderMarketing(root) {
  const A = DATA.balance.attendance;
  const proj = h('div', { class: 'projection' });
  const slider = h('input', { type: 'range', min: A.min_ticket, max: A.max_ticket, step: 1, value: state.ticket_price, class: 'slider' });
  const priceLabel = h('span', { class: 'price-readout' }, fmt$(state.ticket_price));
  const update = () => {
    const price = Number(slider.value);
    priceLabel.textContent = fmt$(price);
    clear(proj).append(projection(price));
  };
  slider.addEventListener('input', () => { state.ticket_price = Number(slider.value); update(); emitChange(); });
  const ads = h('div', {});
  live = () => { update(); clear(ads).append(campaigns()); };
  live();
  clear(root).append(h('div', { class: 'page' },
    h('h2', {}, 'Marketing'),
    h('div', { class: 'panel' },
      h('h3', {}, 'Ticket price'),
      h('div', { class: 'cols' },
        h('div', {},
          h('div', { class: 'price-row' }, h('span', { class: 'muted' }, 'Ticket price'), priceLabel),
          h('div', { class: 'row slider-row' }, h('span', { class: 'muted' }, fmt$(A.min_ticket)), slider, h('span', { class: 'muted' }, fmt$(A.max_ticket))),
          h('p', { class: 'muted' }, term('elasticity', 'Elasticity'), ': raise the price and fewer people come. ', term('seasonality', 'Seasons'), ' change demand too. Tour guides and restrooms make visitors accept higher prices.'),
          seasonTable()),
        proj)),
    h('div', { class: 'panel' },
      h('h3', {}, term('advertising', 'Advertising')),
      ads)));
}

function seasonTable() {
  const T = DATA.balance.time;
  const cur = seasonIndex();
  return h('table', { class: 'table seasons' },
    h('tr', {}, T.seasons.map((s, i) => h('th', { class: i === cur ? 'now' : '' }, s))),
    h('tr', {}, T.season_factor.map((f, i) => h('td', { class: i === cur ? 'now' : '' }, `${Math.round(f * 100)}% demand`))));
}

function projection(price) {
  const p = projectDay(price);
  const cur = computeAttendance(price);
  const f = cur.factors;
  const capped = cur.demand > cur.cap;
  return h('div', {},
    h('h3', { class: 'first' }, term('what_if', 'What-if'), ' at this price'),
    h('table', { class: 'table kv' },
      row('Projected visitors/day', `${p.attendance}${capped ? ` (demand ${p.demand}, capped at ${p.cap})` : ''}`),
      row('Ticket revenue/day', fmt$(p.tickets)),
      row(term('concessions', 'Concession revenue/day'), fmt$(p.concessions)),
      row('Total revenue/day', fmt$(p.total)),
      row('Over a 90-day quarter', fmt$(p.total * DATA.balance.time.days_per_quarter))),
    h('p', { class: 'muted small' }, `Factors: base ${Math.round(f.base)} × appeal ${f.appeal.toFixed(2)} × price ${f.price.toFixed(2)} × ${season()} ${f.season} × ads ${f.ad.toFixed(2)} × reputation ${f.reputation.toFixed(2)}${f.events !== 1 ? ` × events ${f.events.toFixed(2)}` : ''}${state.closed_days ? ' · park closed today' : ''}`),
    capped ? h('p', { class: 'muted small' }, 'Demand is above capacity. Upgrade the Parking Lot (General Store → Upgrades) to raise the daily limit.') : null);
}

function campaigns() {
  const active = state.ad && state.ad.days_left > 0 ? state.ad : null;
  return h('div', {},
    active ? h('p', {}, `Active: +${pct(active.boost)} for ${active.days_left} more days.`) : h('p', { class: 'muted' }, 'No active campaign. Only the strongest active campaign counts, so buy a bigger one to replace a smaller one.'),
    h('div', { class: 'cards grid-3' }, DATA.balance.advertising.campaigns.map(c => h('div', { class: 'card' },
      h('div', { class: 'card-title' }, c.name),
      h('div', { class: 'big' }, fmt$(c.cost)),
      h('div', { class: 'muted' }, `+${pct(c.boost)} visitors for ${c.days} days`),
      campaignWhatIf(c),
      button('Buy', () => { if (!fail(eco.buyCampaign(c.id))) emitChange(); }, { class: 'btn primary', disabled: !eco.canAfford(c.cost) })))));
}

function campaignWhatIf(c) {
  const before = projectDay(state.ticket_price);
  const saved = state.ad;
  state.ad = { id: c.id, boost: Math.max(c.boost, saved && saved.days_left > 0 ? saved.boost : 0), days_left: c.days };
  const after = projectDay(state.ticket_price);
  state.ad = saved;
  const gain = (after.total - before.total) * c.days;
  return h('div', { class: 'muted small' }, term('what_if', 'What-if'), `: about ${fmt$(gain)} extra over ${c.days} days vs ${fmt$(c.cost)} cost.`);
}

const row = (k, v) => h('tr', {}, h('td', {}, k), h('td', { class: 'num' }, v));
