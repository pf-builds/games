// Reports view and the automatic Quarterly Report modal.
import { DATA, state, quarterLabel, fmt$, allDinos, speciesOwned, enclosures, parcelList, facilityDefs, facilityTier } from '../state.js';
import { sum, netWorth, debtCap } from '../economy.js';
import { parkRating, capacity, capacityParts, satisfaction, appealBonus } from '../attendance.js';
import { chart } from '../render/charts.js';
import { h, clear, term, button, starsEl } from './dom.js';
import { openModal } from './modals.js';
import { countUp } from './effects.js';
import { goalsBody, reportCardPanel } from './goals.js';

const REV = { tickets: 'Ticket sales', concessions: 'Concessions', memberships: 'Memberships', donations: 'Donations & grants', sales: 'Dinosaur sales' };
const EXP = { salaries: 'Salaries', food: 'Food', upkeep: 'Upkeep', interest: 'Interest', loan_payment: 'Loan payment', tax: 'Tax' };
const CAP = { land: 'Land', fences: 'Fences', dinosaurs: 'Dinosaurs', facilities: 'Facility upgrades', advertising: 'Marketing spend', repairs: 'Repairs', debt_repaid: 'Extra loan repayment' };
const TIP = { interest: 'interest', loan_payment: 'loan', tax: 'tax', upkeep: 'upkeep', salaries: 'salary', concessions: 'concessions', advertising: 'campaign', memberships: 'membership' };

// animate: money cells carry data-count so the Quarterly Report can count them up (ui/effects.js countUp).
export function ledgerTable(L, { animate = false } = {}) {
  const line = (k, label, v, cls = '') => h('tr', { class: cls }, h('td', {}, TIP[k] ? term(TIP[k], label) : label), h('td', { class: 'num', 'data-count': animate ? String(Math.round(v)) : null }, fmt$(v)));
  const rev = sum(L.revenue), exp = sum(L.expenses), cap = sum(L.capital);
  return h('table', { class: 'table ledger' },
    h('tr', { class: 'section' }, h('td', {}, term('revenue', 'Revenue')), h('td', {})),
    Object.entries(REV).map(([k, l]) => line(k, l, L.revenue[k] || 0)),
    line('rev', 'Total revenue', rev, 'total'),
    h('tr', { class: 'section' }, h('td', {}, term('expenses', 'Operating expenses')), h('td', {})),
    Object.entries(EXP).map(([k, l]) => line(k, l, L.expenses[k])),
    line('exp', 'Total expenses', exp, 'total'),
    line('profit', term('profit', 'Profit'), rev - exp, rev - exp >= 0 ? 'total good' : 'total bad'),
    h('tr', { class: 'section' }, h('td', {}, 'Investments (not counted in profit)'), h('td', {})),
    Object.entries(CAP).map(([k, l]) => line(k, l, L.capital[k])),
    line('cap', 'Total invested', cap, 'total'),
    h('tr', { class: 'section' }, h('td', {}, 'Summary'), h('td', {})),
    h('tr', {}, h('td', {}, term('attendance', 'Visitors')), h('td', { class: 'num' }, `${L.attendance.toLocaleString('en-US')} over ${L.days} days`)),
    line('cash', 'Cash change', rev - exp - cap),
    L.cash_end != null ? line('cash_end', 'Cash at quarter end', L.cash_end) : null,
    L.debt_end != null ? line('debt_end', term('debt', 'Debt at quarter end'), L.debt_end) : null);
}

export function charts() {
  const hist = state.history;
  if (!hist.length) return h('p', { class: 'muted' }, 'Charts appear after your first quarter.');
  const labels = hist.map(q => { const [s, y] = quarterLabel(q.quarter - 1).split(' '); return `${s.slice(0, 2)} ${y}`; });
  const mk = (title, series, money = true) => chart({ title, labels, series, money });
  return h('div', { class: 'charts' },
    mk('Revenue', [{ label: 'tickets', color: '#6fcf6a', values: hist.map(q => q.revenue.tickets) }, { label: 'concessions', color: '#f2c94c', values: hist.map(q => q.revenue.concessions) }, { label: 'memberships', color: '#e08fd0', values: hist.map(q => q.revenue.memberships || 0) }]),
    mk('Visitors', [{ label: 'visitors', color: '#5aa0b5', values: hist.map(q => q.attendance) }], false),
    mk('Expenses', [{ label: 'salaries', color: '#e05c5c', values: hist.map(q => q.expenses.salaries) }, { label: 'food', color: '#c8a24a', values: hist.map(q => q.expenses.food) }, { label: 'interest+loan', color: '#a7acbd', values: hist.map(q => q.expenses.interest + q.expenses.loan_payment) }]));
}

// Park stats as a tile grid (fills the width instead of a narrow two-column list).
export function parkStats() {
  const tile = (label, value, tip) => h('div', { class: 'tile' }, h('div', { class: 'tile-label' }, tip ? term(tip, label) : label), h('div', { class: 'tile-value' }, value));
  return h('div', { class: 'tiles' },
    tile('Park rating', h('span', {}, starsEl(parkRating(), DATA.balance.rating.max, 'stars stars-inline'), ` ${parkRating().toFixed(1)}`), 'park_rating'),
    tile('Cleanliness', `${Math.round(state.cleanliness)}%`, 'cleanliness'),
    tile('Reputation', `${Math.round(state.reputation)}`, 'reputation'),
    tile('Satisfaction bonus', `+${Math.round(satisfaction() * 100)}%`),
    tile('Daily capacity', h('span', {}, `${capacity()} `, h('span', { class: 'muted small' }, `(gate ${capacityParts().gate} + parking ${capacityParts().parking} + tram ${capacityParts().tram})`)), 'capacity'),
    tile('Appeal bonus', `+${Math.round(appealBonus() * 100)}%`, 'appeal'),
    tile('Dinosaurs / species', `${allDinos().length} / ${speciesOwned().size}`),
    tile('Parcels / enclosures', `${parcelList().filter(p => p.owned).length} / ${enclosures().length}`),
    tile('Facility tiers', facilityDefs().map(f => `${f.short || f.name[0]}${facilityTier(f.id)}`).join(' ')),
    tile('Park prizes', `${(state.prizes || []).length} / ${DATA.prizes.prizes.length}`, 'prize'),
    tile('Staff', `${state.staff.length}`),
    tile('Members', `${state.members?.active ? state.members.count : 'not launched'}`, 'membership'),
    tile('Net worth', fmt$(netWorth()), 'net_worth'),
    tile('Debt cap', fmt$(debtCap()), 'debt_cap'));
}

export function renderReports(root) {
  const last = state.history[state.history.length - 1];
  clear(root).append(h('div', { class: 'page' },
    h('h2', {}, 'Reports'),
    h('div', { class: 'panel' }, h('h3', {}, 'Park stats'), parkStats()),
    h('div', { class: 'panel' }, h('h3', {}, term('goal', 'Goals')), goalsBody({ compact: true })),
    h('div', { class: 'panel' }, h('h3', {}, term('report_card', 'Year-5 Report Card')), reportCardPanel()),
    h('div', { class: 'panel' }, h('h3', {}, 'Last 8 quarters'), charts()),
    h('div', { class: 'cols' },
      h('div', { class: 'panel' }, h('h3', {}, `This quarter so far (${quarterLabel(state.ledger.quarter - 1)})`), ledgerTable(state.ledger)),
      last ? h('div', { class: 'panel' }, h('h3', {}, `Last quarter (${quarterLabel(last.quarter - 1)})`), ledgerTable(last))
        : h('div', { class: 'panel' }, h('h3', {}, 'Last quarter'), h('p', { class: 'muted' }, 'No completed quarter yet. The first report opens automatically on day 90.')))));
}

export function openQuarterlyReport(L) {
  const profit = sum(L.revenue) - sum(L.expenses);
  // Ledger first (it answers "why"), charts after; the Continue button sits in a pinned footer with a scroll cue.
  // M5 juice: the modal slides in and the headline + ledger numbers count up (instant under Reduce motion).
  const body = h('div', {},
    h('p', { class: `${profit >= 0 ? 'good' : 'bad'} lead` }, profit >= 0 ? 'Profit of ' : 'Loss of ', h('span', { 'data-count': String(Math.round(Math.abs(profit))) }, fmt$(Math.abs(profit))), profit >= 0 ? ' this quarter.' : ' this quarter. Check which expense is biggest below.'),
    h('div', { class: 'cols report-cols' }, ledgerTable(L, { animate: true }), h('div', {}, h('h3', {}, 'Park stats'), parkStats())),
    h('h3', {}, 'Last 8 quarters'),
    charts());
  const m = openModal({ title: `Quarterly Report: ${quarterLabel(L.quarter - 1)}`, className: 'wide slide-in', body,
    foot: h('div', { class: 'row foot-row' }, h('span', { class: 'muted small' }, 'Scroll for the full ledger, park stats, and charts.'), button('Continue', () => m.close(), { class: 'btn primary' })) });
  countUp(body);
  return m;
}
