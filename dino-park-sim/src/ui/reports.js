// Reports view and the automatic Quarterly Report modal.
import { DATA, state, quarterLabel, fmt$, allDinos, speciesOwned, enclosures, parcelList, facilityDefs, facilityTier } from '../state.js';
import { sum, netWorth, debtCap } from '../economy.js';
import { parkRating, capacity, satisfaction } from '../attendance.js';
import { chart } from '../render/charts.js';
import { h, clear, term, button, starsEl } from './dom.js';
import { openModal } from './modals.js';

const REV = { tickets: 'Ticket sales', concessions: 'Concessions', donations: 'Donations & grants', sales: 'Dinosaur sales' };
const EXP = { salaries: 'Salaries', food: 'Food', upkeep: 'Upkeep', interest: 'Interest', loan_payment: 'Loan payment', tax: 'Tax' };
const CAP = { land: 'Land', fences: 'Fences', dinosaurs: 'Dinosaurs', facilities: 'Facility upgrades', advertising: 'Advertising', repairs: 'Repairs', debt_repaid: 'Extra loan repayment' };
const TIP = { interest: 'interest', loan_payment: 'loan', tax: 'tax', upkeep: 'upkeep', salaries: 'salary', concessions: 'concessions', advertising: 'advertising' };

export function ledgerTable(L) {
  const line = (k, label, v, cls = '') => h('tr', { class: cls }, h('td', {}, TIP[k] ? term(TIP[k], label) : label), h('td', { class: 'num' }, fmt$(v)));
  const rev = sum(L.revenue), exp = sum(L.expenses), cap = sum(L.capital);
  return h('table', { class: 'table ledger' },
    h('tr', { class: 'section' }, h('td', {}, term('revenue', 'Revenue')), h('td', {})),
    Object.entries(REV).map(([k, l]) => line(k, l, L.revenue[k])),
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
    mk('Revenue', [{ label: 'tickets', color: '#6fcf6a', values: hist.map(q => q.revenue.tickets) }, { label: 'concessions', color: '#f2c94c', values: hist.map(q => q.revenue.concessions) }]),
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
    tile('Daily capacity', `${capacity()}`, 'capacity'),
    tile('Dinosaurs / species', `${allDinos().length} / ${speciesOwned().size}`),
    tile('Parcels / enclosures', `${parcelList().filter(p => p.owned).length} / ${enclosures().length}`),
    tile('Facility tiers', facilityDefs().filter(f => f.tiers.length > 1).map(f => `${f.name.split(' ')[0][0]}${facilityTier(f.id)}`).join(' ')),
    tile('Staff', `${state.staff.length}`),
    tile('Net worth', fmt$(netWorth()), 'net_worth'),
    tile('Debt cap', fmt$(debtCap()), 'debt_cap'));
}

export function renderReports(root) {
  const last = state.history[state.history.length - 1];
  clear(root).append(h('div', { class: 'page' },
    h('h2', {}, 'Reports'),
    h('div', { class: 'panel' }, h('h3', {}, 'Park stats'), parkStats()),
    h('div', { class: 'panel' }, h('h3', {}, 'Last 8 quarters'), charts()),
    h('div', { class: 'cols' },
      h('div', { class: 'panel' }, h('h3', {}, `This quarter so far (${quarterLabel(state.ledger.quarter - 1)})`), ledgerTable(state.ledger)),
      last ? h('div', { class: 'panel' }, h('h3', {}, `Last quarter (${quarterLabel(last.quarter - 1)})`), ledgerTable(last))
        : h('div', { class: 'panel' }, h('h3', {}, 'Last quarter'), h('p', { class: 'muted' }, 'No completed quarter yet. The first report opens automatically on day 90.')))));
}

export function openQuarterlyReport(L) {
  const profit = sum(L.revenue) - sum(L.expenses);
  // Ledger first (it answers "why"), charts after; the Continue button sits in a pinned footer with a scroll cue.
  const m = openModal({ title: `Quarterly Report: ${quarterLabel(L.quarter - 1)}`, className: 'wide', body: h('div', {},
    h('p', { class: `${profit >= 0 ? 'good' : 'bad'} lead` }, profit >= 0 ? `Profit of ${fmt$(profit)} this quarter.` : `Loss of ${fmt$(-profit)} this quarter. Check which expense is biggest below.`),
    h('div', { class: 'cols report-cols' }, ledgerTable(L), h('div', {}, h('h3', {}, 'Park stats'), parkStats())),
    h('h3', {}, 'Last 8 quarters'),
    charts()),
    foot: h('div', { class: 'row foot-row' }, h('span', { class: 'muted small' }, 'Scroll for the full ledger, park stats, and charts.'), button('Continue', () => m.close(), { class: 'btn primary' })) });
}
