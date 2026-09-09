// Store modals: Real Estate, Dino Market (buy + auction), General Store, Employment Office, Bank.
import { DATA, state, mode, fenceByTier, foodByDiet, staffCount, enclosures, parcelList, parcelDef, parcelBiome, parcelSizeLabel, facilityDefs, fmt$, pct, emitChange, onChange, rnd, rndInt } from '../state.js';
import * as eco from '../economy.js';
import { projectDay } from '../attendance.js';
import { h, button, tabs, term, clear, append } from './dom.js';
import { openModal, alertModal } from './modals.js';
import { factCard } from './factbook.js';
import { fail, facilityCard } from './enclosure.js';
import { openBuyLand } from './shell.js';
import { shortShape } from '../render/park.js';
import { checkMilestones } from '../time.js';

const refresh = () => emitChange();

// ---------------- Real Estate ----------------
// Land is bought on the park map (Park → Buy Land). This office is the legend: what each biome costs and how parcel size changes the price.
export function openRealEstate() {
  const m = openModal({ title: 'Real Estate Office', className: 'wide' });
  const P = DATA.balance.parcel;
  const all = parcelList();
  const forSale = all.filter(p => !p.owned);
  const byBiome = id => all.filter(p => parcelDef(p.id).biome === id);
  m.setBody(h('div', {},
    h('p', {}, 'Land is bought on the park map: open ', h('b', {}, 'Park → Buy Land'), ' and click a FOR SALE parcel. Parcels are fixed shapes of different sizes; each carries its own biome. Purchased land is for dinosaur enclosures only. Parking, restrooms, the food stand, gift shop and office are fixed buildings you upgrade in the General Store.'),
    h('div', { class: 'cards' }, DATA.biomes.biomes.map(b => {
      const mine = byBiome(b.id);
      return h('div', { class: 'card' },
        h('div', { class: 'card-title' }, h('span', { class: 'swatch', style: `background:${b.color}` }), b.name),
        h('div', { class: 'big' }, `${fmt$(b.plot_cost)} per tile`),
        h('p', { class: 'muted' }, b.blurb),
        h('div', { class: 'muted small' }, `${mine.length} parcel${mine.length === 1 ? '' : 's'} on the map · ${mine.filter(p => p.owned).length} owned · shapes ${[...new Set(mine.map(p => shortShape(p.id)))].join(', ')}`));
    })),
    h('h3', {}, 'Every parcel on the survey map'),
    h('table', { class: 'table' },
      h('tr', {}, h('th', {}, 'Parcel'), h('th', {}, 'Shape'), h('th', {}, 'Tiles'), h('th', {}, 'Price factor'), h('th', {}, term('capacity', 'Capacity')), h('th', {}, 'Fence segments'), h('th', {}, 'Price'), h('th', {}, '')),
      all.map(p => h('tr', {},
        h('td', {}, p.id),
        h('td', {}, parcelSizeLabel(p.id)),
        h('td', {}, `${parcelDef(p.id).tiles.length}`),
        h('td', {}, `×${eco.areaFactor(parcelDef(p.id).tiles.length).toFixed(2)}`),
        h('td', {}, `${eco.parcelCapacity(p.id)} space`),
        h('td', {}, `${eco.perimeterSegments(p.id)}`),
        h('td', {}, fmt$(eco.parcelPrice(p.id))),
        h('td', { class: 'muted' }, p.owned ? (p.enclosure ? 'fenced' : 'owned') : 'for sale')))),
    h('p', { class: 'muted' }, `Parcels are irregular shapes, so the fence follows the outline: an L of 4 tiles needs 10 segments where a 2×2 needs 8. Bigger parcels are a modest discount per tile and hold more dinosaurs (${P.space_per_tile} space units per tile), but the fence around them costs more. ${forSale.length} of ${all.length} parcels are still for sale. Land holds its value in your `, term('net_worth', 'net worth'), '.'),
    h('div', { class: 'row end' }, button('Open the park map', () => { m.close(); openBuyLand(); }, { class: 'btn primary' }))));
}

// ---------------- Dino Market ----------------
export function openDinoMarket() {
  const m = openModal({ title: 'Dino Market', className: 'wide' });
  m.setBody(tabs([
    { label: 'Buy', render: () => speciesGrid(sp => buyFlow(sp, m)) },
    { label: term('auction', 'Auction'), render: () => speciesGrid(sp => auctionFlow(sp, m), 'Open bid') }
  ]));
}

// Species list: price-sorted and grouped by tier (data "tier" field when present, price bands otherwise)
// so a 20-30 species roster stays readable; filter chips narrow it down. The modal body scrolls.
const TIER_ORDER = ['starter', 'budget', 'mid', 'marquee'];
const TIER_LABEL = { starter: 'Starter', budget: 'Budget', mid: 'Mid-range', marquee: 'Marquee' };
export function speciesTier(sp) {
  if (sp.tier) return String(sp.tier).toLowerCase();
  const prices = DATA.dinosaurs.species.map(s => s.shop_price).sort((a, b) => a - b);
  const q = k => prices[Math.min(prices.length - 1, Math.floor(prices.length * k))];
  return sp.shop_price <= q(0.25) ? 'starter' : sp.shop_price <= q(0.5) ? 'budget' : sp.shop_price <= q(0.8) ? 'mid' : 'marquee';
}
export function speciesByTier(list = DATA.dinosaurs.species) {
  const groups = new Map();
  for (const sp of [...list].sort((a, b) => a.shop_price - b.shop_price)) {
    const t = speciesTier(sp);
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(sp);
  }
  return [...groups.entries()].sort((a, b) => TIER_ORDER.indexOf(a[0]) - TIER_ORDER.indexOf(b[0]));
}
let marketFilter = 'all';
// Diet icon and food name come from the food item that matches the diet (meat / plants / fish / seeds).
export const DIET_ICON = { carnivore: '🥩', herbivore: '🌿', piscivore: '🐟', seed_eater: '🌰' };
export const dietFoodName = diet => (foodByDiet(diet)?.name || 'food').toLowerCase().replace(/([^s])s$/, '$1'); // 'plants' -> 'plant unit', 'fish' stays
function speciesGrid(onPick, verb = 'Buy') {
  const wrap = h('div', {});
  const all = DATA.dinosaurs.species;
  const filters = [['all', `All (${all.length})`], ...speciesByTier().map(([t, list]) => [t, `${TIER_LABEL[t] || t} (${list.length})`]), ['carnivore', 'Carnivores'], ['herbivore', 'Herbivores'], ['fits', 'Fits my pens']];
  const pass = sp => marketFilter === 'all' || marketFilter === speciesTier(sp) || marketFilter === sp.diet || (marketFilter === 'fits' && eco.validEnclosuresFor(sp).length);
  const render = () => append(clear(wrap), [
    h('div', { class: 'row wrap chips' }, filters.map(([id, label]) => button(label, () => { marketFilter = id; render(); }, { class: `btn chip ${marketFilter === id ? 'active' : ''}` }))),
    speciesByTier(all.filter(pass)).map(([t, list]) => h('div', { class: 'tier-group' },
      h('h3', {}, `${TIER_LABEL[t] || t} · ${fmt$(list[0].shop_price)} to ${fmt$(list[list.length - 1].shop_price)}`),
      h('div', { class: 'cards grid-5' }, list.map(sp => speciesCard(sp, onPick, verb))))),
    all.filter(pass).length ? null : h('p', { class: 'muted' }, 'Nothing matches that filter.')]);
  render();
  return wrap;
}

function speciesCard(sp, onPick, verb) {
  const valid = eco.validEnclosuresFor(sp).length;
  return h('div', { class: 'card' },
    h('div', { class: 'card-title' }, h('span', { class: 'dino-icon', style: `background:${sp.color}` }), sp.name),
    h('div', { class: 'big' }, fmt$(sp.shop_price)),
    h('div', { class: 'muted nowrap' }, `${DIET_ICON[sp.diet] || '🍽'} ${sp.diet.replace('_', ' ')} · ${sp.size}`),
    h('div', { class: 'muted nowrap' }, 'Min ', term('fence_tier', 'fence'), `: ${fenceByTier(sp.min_fence_tier).name}`),
    h('div', { class: 'muted nowrap' }, `Popularity ${sp.popularity} · Space ${sp.space_required} unit${sp.space_required > 1 ? 's' : ''}`),
    h('div', { class: 'muted nowrap' }, `Eats ${sp.food_per_day} ${dietFoodName(sp.diet)} unit${sp.food_per_day > 1 ? 's' : ''}/day`),
    h('div', { class: 'muted small' }, valid ? `${valid} enclosure${valid > 1 ? 's' : ''} fit` : 'No enclosure fits'),
    button(verb, () => onPick(sp), { class: 'btn primary', disabled: !valid }));
}

function whatIf(sp) {
  const before = projectDay(state.ticket_price);
  const plot = eco.validEnclosuresFor(sp)[0];
  const temp = eco.addDino(plot.id, sp.id);
  const after = projectDay(state.ticket_price);
  plot.enclosure.dinos.pop();
  void temp;
  const foodCost = sp.food_per_day * (foodByDiet(sp.diet)?.unit_cost || 0);
  return h('p', { class: 'muted' }, term('what_if', 'What-if'), `: visitors/day ${before.attendance} → ${after.attendance}, revenue/day ${fmt$(before.total)} → ${fmt$(after.total)}. Food about ${fmt$(foodCost)}/day.`);
}

function choosePlot(sp, onChoose) {
  const list = eco.validEnclosuresFor(sp);
  const m = openModal({ title: `Which enclosure for the ${sp.name}?`, body: h('div', {},
    whatIf(sp),
    h('div', { class: 'cards' }, list.map(p => h('div', { class: 'card' },
      h('div', { class: 'card-title' }, `Parcel ${p.id} · ${parcelSizeLabel(p.id)} ${parcelBiome(p.id).name}`),
      h('div', { class: 'muted' }, `${fenceByTier(p.enclosure.fence_tier).name} fence · ${eco.spaceCapacity(p.id) - eco.spaceUsed(p.enclosure)} of ${eco.spaceCapacity(p.id)} space free`),
      h('div', { class: 'muted' }, `${p.enclosure.dinos.length} dinosaur${p.enclosure.dinos.length === 1 ? '' : 's'} inside`),
      button('Choose', () => { m.close(); onChoose(p.id); }, { class: 'btn primary' })))))
  });
}

function buyFlow(sp, market) {
  choosePlot(sp, plotIndex => {
    if (fail(eco.buyDino(sp.id, plotIndex))) return;
    refresh();
    afterPurchase(sp, market, `Bought for ${fmt$(sp.shop_price)}.`);
  });
}

function afterPurchase(sp, market, note) {
  const m = openModal({ title: 'New arrival!', body: h('div', {}, h('p', {}, note), factCard(sp),
    h('div', { class: 'row end' }, button('Back to market', () => { m.close(); }, { class: 'btn primary' }))) });
  market.setBody(tabs([
    { label: 'Buy', render: () => speciesGrid(s => buyFlow(s, market)) },
    { label: term('auction', 'Auction'), render: () => speciesGrid(s => auctionFlow(s, market), 'Open bid') }
  ]));
}

// Auction: player vs AI bidders over 3-5 rounds.
function auctionFlow(sp, market) {
  choosePlot(sp, plotIndex => runAuction(sp, plotIndex, market));
}

function runAuction(sp, plotIndex, market) {
  const AU = DATA.balance.auction;
  const a = { bid: Math.round(sp.shop_price * AU.opening_bid_ratio), leader: null, round: 1, maxRounds: rndInt(AU.rounds_min, AU.rounds_max), log: [], done: false };
  const m = openModal({ title: `Auction: ${sp.name}`, closable: false });
  const inc = () => Math.max(1, Math.round(sp.shop_price * AU.ai_raise_min_ratio));

  function playerBid() {
    const amount = a.leader === null ? a.bid : a.bid + inc();
    if (!eco.canAfford(amount)) { a.log.push(`You cannot afford ${fmt$(amount)}.`); return render(); }
    a.bid = amount; a.leader = 'player';
    a.log.push(`Round ${a.round}: you bid ${fmt$(amount)}.`);
    aiRespond();
  }
  function aiRespond() {
    let raised = null;
    for (let i = 0; i < AU.ai_bidders; i++) {
      const next = Math.round(a.bid * (1 + rnd(AU.ai_raise_min_ratio, AU.ai_raise_max_ratio)));
      if (next <= sp.shop_price * AU.ai_walkaway_ratio && Math.random() < AU.ai_raise_chance) raised = Math.max(raised || 0, next);
    }
    if (raised && a.round < a.maxRounds) { a.bid = raised; a.leader = 'ai'; a.round += 1; a.log.push(`Another bidder raises to ${fmt$(raised)}.`); }
    else finish(true);
    render();
  }
  function pass() {
    a.log.push(a.leader === 'player' ? 'You stop bidding.' : 'You pass. The lot goes to another buyer.');
    finish(a.leader === 'player');
    render();
  }
  function finish(playerWins) {
    a.done = true;
    m.closable = true; // bidding is over: Esc / backdrop may close it now
    m.onClose = () => { if (a.won && !a.shown) { a.shown = true; afterPurchase(sp, market, a.result); } };
    if (!playerWins) { a.result = 'Sold to another bidder.'; return; }
    const poor = Math.random() < AU.poor_specimen_chance;
    const err = eco.buyDino(sp.id, plotIndex, a.bid, poor ? AU.poor_specimen_health : undefined);
    a.result = err ? `Deal fell through: ${err}` : `You won at ${fmt$(a.bid)} (${fmt$(sp.shop_price - a.bid)} under shop price).${poor ? ' The specimen arrived in poor health; a vet would help.' : ''}`;
    a.won = !err;
    refresh();
  }
  function render() {
    m.setBody(h('div', {},
      h('p', {}, `Shop price ${fmt$(sp.shop_price)}. Opening bid ${fmt$(Math.round(sp.shop_price * AU.opening_bid_ratio))}. Up to ${a.maxRounds} rounds. ${Math.round(AU.poor_specimen_chance * 100)}% chance of a weak specimen.`),
      h('div', { class: 'auction-bid' }, `Current bid: ${fmt$(a.bid)} `, h('span', { class: 'muted' }, a.leader === 'player' ? '(you lead)' : a.leader === 'ai' ? '(rival leads)' : '(nobody yet)')),
      h('div', { class: 'auction-log' }, a.log.map(l => h('div', {}, l))),
      a.done ? h('div', {}, h('p', { class: a.won ? 'good' : 'bad' }, a.result), h('div', { class: 'row end' }, button('Close', () => m.close(), { class: 'btn primary' })))
        : h('div', { class: 'row end' }, button('Pass', pass), button(a.leader === null ? `Bid ${fmt$(a.bid)}` : `Bid ${fmt$(a.bid + inc())}`, playerBid, { class: 'btn primary' }))));
  }
  render();
}

// ---------------- General Store ----------------
export function openGeneralStore() {
  const m = openModal({ title: 'General Store', className: 'wide' });
  m.setBody(tabs([
    { label: 'Fences', render: fencesTab },
    { label: 'Upgrades', render: () => liveTab(upgradesTab) },
    { label: term('advertising', 'Advertising'), render: () => liveTab(adsTab) },
    { label: 'Food', render: foodTab }
  ]));
}

function fencesTab() {
  return h('div', {},
    h('p', { class: 'muted' }, 'Fences are built from the Park view: click an owned empty parcel. Cost is per segment times the parcel outline — the tile edges that face out, since two tiles of the same parcel never need a fence between them: a 1×1 needs 4 segments, a 2×2 needs 8, an L of 4 tiles needs 10.'),
    h('table', { class: 'table' },
      h('tr', {}, h('th', {}, term('fence_tier', 'Tier')), h('th', {}, 'Per segment'), h('th', {}, '1×1 (4 seg)'), h('th', {}, '2×2 (8 seg)'), h('th', {}, term('upkeep', 'Upkeep'), ' per 4 seg'), h('th', {}, 'Strength')),
      DATA.fences.tiers.map(f => h('tr', {}, h('td', { style: `color:${f.color}` }, `${f.tier} ${f.name}`), h('td', {}, fmt$(f.cost_per_segment)), h('td', {}, fmt$(f.cost_per_segment * 4)), h('td', {}, fmt$(f.cost_per_segment * 8)), h('td', {}, `${fmt$(f.upkeep_per_quarter)}/qtr`), h('td', {}, `${f.strength}`)))),
    h('p', { class: 'muted' }, 'A dinosaur in a fence below its minimum tier has a daily breakout chance that grows with each tier short. Security staff halve it.'));
}

// A tab whose buttons depend on cash (Upgrades, Advertising) re-renders on every state change while it is on
// screen, so an affordability flip made elsewhere (another store, debug) is reflected without reopening the store.
function liveTab(renderTab) {
  const wrap = h('div', {});
  const render = () => append(clear(wrap), [renderTab()]);
  render();
  const off = onChange(() => { if (!wrap.isConnected) return off(); render(); });
  return wrap;
}

// Fixed facilities upgrade in order (tier 1, then 2, then 3). One card per facility; the card re-renders after a purchase.
function upgradesTab() {
  const wrap = h('div', {});
  const render = () => append(clear(wrap), [
    h('p', { class: 'muted' }, 'Parking, restrooms, the food stand, gift shop and office are fixed buildings at set spots in the park. Buy the next tier to make each one bigger and better. Parking raises the daily visitor ', term('capacity', 'cap'), '; the food stand and gift shop raise ', term('concessions', 'concession'), ' spend (they need concessions staff, one per store); restrooms raise satisfaction.'),
    h('div', { class: 'cards grid-3' }, facilityDefs().map(f => facilityCard(f.id, render)))]);
  render();
  return wrap;
}

function adsTab() {
  const active = state.ad && state.ad.days_left > 0 ? state.ad : null;
  return h('div', {},
    h('p', { class: 'muted' }, 'Campaigns boost visitors for a while, then wear off. Only the strongest active campaign counts.'),
    active ? h('p', {}, `Active: ${DATA.balance.advertising.campaigns.find(c => c.id === active.id)?.name} +${pct(active.boost)} for ${active.days_left} more days.`) : h('p', { class: 'muted' }, 'No active campaign.'),
    h('div', { class: 'cards' }, DATA.balance.advertising.campaigns.map(c => h('div', { class: 'card' },
      h('div', { class: 'card-title' }, c.name),
      h('div', { class: 'big' }, fmt$(c.cost)),
      h('div', { class: 'muted' }, `+${pct(c.boost)} visitors for ${c.days} days`),
      campaignWhatIf(c),
      button('Buy', () => { if (!fail(eco.buyCampaign(c.id))) refresh(); }, { class: 'btn primary', disabled: !eco.canAfford(c.cost) })))));
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

function foodTab() {
  const bundle = DATA.food.purchase_bundle_units;
  const wrap = h('div', {});
  const render = () => clear(wrap).append(
    h('p', { class: 'muted' }, 'Bulk food goes into park stock and is moved into enclosures automatically every day. You can also feed a single enclosure from the Park view.'),
    h('table', { class: 'table' },
      h('tr', {}, h('th', {}, 'Food'), h('th', {}, 'Unit cost'), h('th', {}, 'Park stock'), h('th', {}, 'Daily need'), h('th', {}, '')),
      DATA.food.items.map(f => {
        const need = enclosures().reduce((s, p) => s + (eco.dailyNeed(p.enclosure)[f.id] || 0), 0);
        const buy = n => () => { if (!fail(eco.buyParkFood(f.id, n))) { refresh(); render(); } };
        return h('tr', {},
          h('td', {}, h('span', { class: 'swatch', style: `background:${f.color}` }), f.name),
          h('td', {}, fmt$(f.unit_cost)),
          h('td', {}, `${state.park_food[f.id]}`),
          h('td', {}, `${need}/day`),
          h('td', {}, button(`${bundle} for ${fmt$(bundle * f.unit_cost)}`, buy(bundle)), ' ', button(`${bundle * 5} for ${fmt$(bundle * 5 * f.unit_cost)}`, buy(bundle * 5))));
      })));
  render();
  return wrap;
}

// ---------------- Employment Office ----------------
export function openEmployment() {
  const m = openModal({ title: 'Employment Office', className: 'wide' });
  const render = () => {
    const payroll = eco.monthlyPayroll();
    const avg = state.staff.length ? Math.round(state.staff.reduce((s, w) => s + w.morale, 0) / state.staff.length) : null;
    m.setBody(h('div', {},
      h('div', { class: 'row wrap' },
        h('span', {}, `Staff: ${state.staff.length}`),
        h('span', {}, 'Monthly ', term('salary', 'payroll'), `: ${fmt$(payroll)}`),
        h('span', {}, term('morale', 'Morale'), `: ${avg == null ? 'n/a' : avg}`),
        eco.needsManager() ? h('span', { class: 'bad' }, 'No manager with more than 5 staff: morale drops monthly.') : null),
      h('p', { class: 'muted' }, 'Salaries are paid every 30 days, even if that puts you in ', term('overdraft', 'overdraft'), '. Overdrawn cash costs extra interest, staff paid late lose morale, and if your debt less your cash stays above the ', term('debt_cap', 'debt cap'), ' for three quarters the bank forecloses.'),
      h('div', { class: 'cards grid-3' }, DATA.staff.roles.map(r => roleCard(r, () => { refresh(); render(); })))));
  };
  render();
}

function roleCard(r, rerender) {
  const n = staffCount(r.id);
  return h('div', { class: 'card' },
    h('div', { class: 'card-title' }, r.name),
    h('div', { class: 'big' }, `${fmt$(r.salary_per_month)}/mo`),
    h('div', {}, `Employed: ${n}`),
    h('p', { class: 'muted' }, r.blurb),
    h('div', { class: 'row' },
      button('Hire', () => { if (!fail(eco.hire(r.id))) rerender(); }, { class: 'btn primary' }),
      button('Fire', () => { if (!fail(eco.fire(r.id))) rerender(); }, { disabled: n === 0 })));
}

// ---------------- Bank ----------------
export function openBank() {
  const m = openModal({ title: 'Bank', className: 'wide' });
  const L = DATA.balance.loan;
  const render = () => {
    const cap = eco.debtCap();
    const room = Math.max(0, Math.floor((cap - state.debt) / L.borrow_increment) * L.borrow_increment);
    m.setBody(h('div', {},
      h('table', { class: 'table kv' },
        row('Balance', fmt$(state.cash)),
        row(term('debt', 'Debt'), fmt$(state.debt)),
        row(term('apr', 'APR'), pct(mode().apr)),
        row(term('interest', 'Next interest'), `${fmt$(eco.quarterlyInterest())} (end of quarter)`),
        state.cash < 0 ? row(term('overdraft', 'Overdraft interest'), `${fmt$(eco.overdraftInterest())} at ${pct(L.overdraft_apr)} APR (end of quarter)`) : null,
        row(term('loan', 'Next loan payment'), `${fmt$(eco.quarterlyPrincipal())} principal`),
        row(term('debt_cap', 'Debt cap'), fmt$(cap)),
        row(term('net_worth', 'Net worth'), fmt$(eco.netWorth()))),
      h('h3', {}, 'Borrow more'),
      h('div', { class: 'row wrap' }, [L.borrow_increment, L.borrow_increment * 5, room].filter((v, i, arr) => v > 0 && v <= room && arr.indexOf(v) === i).map(n => button(`Borrow ${fmt$(n)}`, () => { if (!fail(eco.borrow(n))) { refresh(); render(); } })),
        room <= 0 ? h('span', { class: 'muted' }, 'You are at your debt cap. Grow the park to raise it.') : null),
      h('h3', {}, 'Repay early'),
      h('div', { class: 'row wrap' }, repayOptions().map(([label, n]) => button(label, () => { if (!fail(eco.repay(n))) { refresh(); render(); checkMilestones(); } }, { disabled: n <= 0 || !eco.canAfford(n) })),
        state.debt <= 0 ? h('span', { class: 'good' }, 'Debt free!') : null),
      h('p', { class: 'muted' }, 'Every dollar of debt costs interest each quarter. Repaying early saves money over time, but keep enough cash for payroll.')));
  };
  render();
}

function repayOptions() {
  const L = DATA.balance.loan;
  const max = Math.min(state.debt, Math.max(0, state.cash));
  return [[`Repay ${fmt$(L.borrow_increment)}`, L.borrow_increment], [`Repay ${fmt$(L.borrow_increment * 5)}`, L.borrow_increment * 5], [`Repay max (${fmt$(max)})`, max]];
}

const row = (k, v) => h('tr', {}, h('td', {}, k), h('td', {}, v));
