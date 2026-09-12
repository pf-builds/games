// Town Street: five clickable storefronts that open store modals, under a sky with a park notice board.
import { DATA, state, T, fmt$, allDinos, dayOfQuarter, season, year, enclosures, parcelList, facilityDefs, facilityTier, facilityNextTier } from '../state.js';
import { monthlyPayroll, debtCap, validEnclosuresFor, parcelPriceFrom, activeCampaigns } from '../economy.js';
import { h, clear, append } from './dom.js';
import { openRealEstate, openDinoMarket, openGeneralStore, openEmployment, openBank } from './stores.js';

// info: a live one-line "window display" so the lower half of each storefront says something useful.
const STORES = [
  { id: 'realestate', name: 'Real Estate', icon: '🏡', blurb: 'Biome guide and the parcel map.', open: openRealEstate, color: '#8fbf5a',
    info: () => { const all = parcelList(); const sale = all.filter(p => !p.owned); return [`${all.filter(p => p.owned).length}/${all.length} parcels owned`, sale.length ? `Cheapest for sale from ${fmt$(Math.min(...sale.map(p => parcelPriceFrom(p.id))))}` : 'All land sold', 'Pick the land type when you buy']; } },
  { id: 'dino', name: 'Dino Market', icon: '🦖', blurb: 'Buy dinosaurs, or bid at auction.', open: openDinoMarket, color: '#b5462e',
    info: () => { const sp = DATA.dinosaurs.species; const fit = sp.filter(s => validEnclosuresFor(s).length).length; return [`${sp.length} species on sale`, `from ${fmt$(Math.min(...sp.map(s => s.shop_price)))}`, fit ? `${fit} fit your enclosures` : enclosures().length ? 'No enclosure fits yet' : 'Build an enclosure first']; } },
  { id: 'general', name: 'General Store', icon: '🏪', blurb: 'Fences, upgrades, ads, food.', open: openGeneralStore, color: '#5aa0b5',
    info: () => { const up = facilityDefs().filter(f => facilityNextTier(f.id)); const ac = activeCampaigns(); return [`Park stock: ${Object.values(state.park_food).reduce((a, b) => a + b, 0)} food units`, up.length ? `${up.length} facility upgrade${up.length > 1 ? 's' : ''} available` : 'All facilities at top tier', ac.length ? `${ac.length} campaign${ac.length > 1 ? 's' : ''} running` : 'No campaign running']; } },
  { id: 'jobs', name: 'Employment Office', icon: '👷', blurb: 'Hire and manage staff.', open: openEmployment, color: '#f2c94c',
    info: () => [`${state.staff.length} on staff`, `${fmt$(monthlyPayroll())}/month payroll`, `${DATA.staff.roles.length} roles hiring`] },
  { id: 'bank', name: 'Bank', icon: '🏦', blurb: 'Loans, payments, and your balance.', open: openBank, color: '#c9c4b8',
    info: () => [`Balance ${fmt$(state.cash)}`, `Debt ${fmt$(state.debt)}`, `Debt cap ${fmt$(debtCap())}`] }
];

let board = null;
const infoEls = {};

export function renderTown(root) {
  board = h('div', { class: 'notice' });
  refreshTown();
  clear(root).append(h('div', { class: 'town' },
    h('div', { class: 'town-sky' },
      h('div', { class: 'sun' }),
      h('div', { class: 'cloud c1' }), h('div', { class: 'cloud c2' }), h('div', { class: 'cloud c3' }),
      h('div', { class: 'town-sign' }, h('h2', {}, 'Town Street'), h('p', { class: 'muted' }, 'Click a storefront to go inside. The clock pauses while you shop.')),
      board),
    h('div', { class: 'hills' }),
    h('div', { class: 'street' }, STORES.map(s => h('button', { class: 'storefront', style: `--store:${s.color}`, 'aria-label': `${s.name}: ${s.blurb}`, on: { click: () => s.open() } },
      h('div', { class: 'awning' }),
      h('div', { class: 'store-window' }, h('div', { class: 'store-icon' }, s.icon)),
      h('div', { class: 'store-name' }, s.name),
      h('div', { class: 'store-blurb' }, s.blurb),
      infoEls[s.id] = h('div', { class: 'store-info' }),
      h('div', { class: 'door' })))),
    h('div', { class: 'road' })));
  refreshTown();
}

// Only the notice board and the storefront info lines change with the clock; the storefront elements
// themselves are left alone so hover states survive.
export function refreshTown() {
  if (!board || !state) return;
  for (const s of STORES) if (infoEls[s.id]) append(clear(infoEls[s.id]), s.info().map(t => h('div', {}, t)));
  const dm = T().days_per_month, dq = T().days_per_quarter;
  const toPayday = dm - ((state.day - 1) % dm), toReport = dq - ((state.day - 1) % dq);
  const line = (k, v) => h('div', { class: 'notice-line' }, h('span', {}, k), h('span', {}, v));
  clear(board).append(
    h('div', { class: 'notice-title' }, 'Park notice board'),
    line('Today', `${season()} day ${dayOfQuarter()}, year ${year()}`),
    line('Visitors today', `${state.today.attendance}`),
    line('Dinosaurs', `${allDinos().length}`),
    line('Staff', `${state.staff.length} (${fmt$(monthlyPayroll())}/mo)`),
    line('Next payday', `${toPayday} day${toPayday === 1 ? '' : 's'}`),
    line('Next report', `${toReport} day${toReport === 1 ? '' : 's'}`));
}
