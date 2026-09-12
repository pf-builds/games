// Store modals: Real Estate, Dino Market (buy + auction), General Store, Employment Office, Bank.
import { DATA, state, mode, fenceByTier, foodByDiet, staffCount, enclosures, parcelList, parcelDef, parcelBiome, parcelSizeLabel, biomeDefs, biomeById, facilityDefs, fmt$, pct, emitChange, onChange, rnd, rndInt, biomeFit, speciesBiomes, speciesRequiresPreferred, FIT_MARK } from '../state.js';
import * as eco from '../economy.js';
import { projectDay } from '../attendance.js';
import { h, button, tabs, term, clear, append } from './dom.js';
import { openModal, alertModal } from './modals.js';
import { factCard, biomeLine } from './factbook.js';
import { fail, facilityCard, speciesPreferring, speciesTolerating, growthLine } from './enclosure.js';
import { openBuyLand } from './shell.js';
import { shortShape } from '../render/park.js';
import { checkMilestones } from '../time.js';
import { prizesBody } from './prizes.js';
import { nextPrize } from '../prizes.js';
import { autoRestockPanel, suggestedUnits } from './food.js';
import { campaignLadder } from './marketing.js';

const refresh = () => emitChange();

// ---------------- Real Estate ----------------
// Land is bought on the park map (Park → Buy Land); the buyer picks the land type there. This office is the biome
// guide: what each biome costs, what grows on it, which species call it home, and every parcel's price per biome.
export function openRealEstate() {
  const m = openModal({ title: 'Real Estate Office · Biome Guide', className: 'wide' });
  const P = DATA.balance.parcel;
  const all = parcelList();
  const forSale = all.filter(p => !p.owned);
  const byBiome = id => all.filter(p => p.owned && p.biome === id);
  m.setBody(h('div', {},
    h('p', {}, 'Land is bought on the park map: open ', h('b', {}, 'Park → Buy Land'), ' and click a FOR SALE parcel. Unsold land is neutral scrub; when you buy, you choose the ', term('biome', 'biome'), ' (Desert, Plains or Marsh) and that sets the price, what grows, and which dinosaurs feel at home. Purchased land is for dinosaur enclosures only; parking, restrooms, shops and the office are fixed buildings you upgrade in the General Store.'),
    h('div', { class: 'cards grid-3 biome-cards' }, biomeDefs().map(b => {
      const mine = byBiome(b.id);
      const pref = speciesPreferring(b.id), tol = speciesTolerating(b.id);
      return h('div', { class: 'card', style: `--biome:${b.color}` },
        h('div', { class: 'card-title' }, h('span', { class: 'swatch', style: `background:${b.color}` }), b.name),
        h('div', { class: 'big' }, `${fmt$(b.plot_cost)} per tile`),
        h('p', { class: 'muted' }, b.blurb),
        h('div', { class: 'small' }, h('b', {}, 'Grows: '), b.grows || '', ' ', h('span', { class: 'muted' }, `(${growthLine(b.id)}; seeds ${fmt$(eco.seedFood()?.unit_cost || 0)}/unit)`)),
        h('div', { class: 'small' }, h('b', {}, `Home for ${pref.length}: `), pref.map(sp => sp.name + (speciesRequiresPreferred(sp) ? '*' : '')).join(', ') || 'none'),
        h('div', { class: 'muted small' }, `Tolerated by ${tol.length}: ${tol.map(sp => sp.name).join(', ') || 'none'}`),
        h('div', { class: 'muted small' }, `Your pens: ${mine.length}${mine.length ? ` (${mine.map(p => p.id).join(', ')})` : ''}`));
    })),
    h('p', { class: 'muted small' }, `* must live in a preferred biome (the Dino Market refuses any other pen). A species in a tolerated biome is fine; in the wrong one its popularity drops to ${pct(DATA.balance.biome.wrong_popularity)} and its health slips. Preferred: popularity ×${DATA.balance.biome.preferred_popularity}. Re-landscaping a pen later costs ${pct(DATA.balance.biome.relandscape_ratio)} of the new land price.`),
    h('h3', {}, 'Every parcel on the survey map'),
    h('table', { class: 'table' },
      h('tr', {}, h('th', {}, 'Parcel'), h('th', {}, 'Shape'), h('th', {}, 'Tiles'), h('th', {}, term('capacity', 'Capacity')), h('th', {}, 'Fence segments'), biomeDefs().map(b => h('th', {}, `${b.name} price`)), h('th', {}, 'Status')),
      all.map(p => h('tr', {},
        h('td', {}, p.id),
        h('td', {}, parcelSizeLabel(p.id)),
        h('td', {}, `${parcelDef(p.id).tiles.length}`),
        h('td', {}, `${eco.parcelCapacity(p.id)} space`),
        h('td', {}, `${eco.perimeterSegments(p.id)}`),
        biomeDefs().map(b => h('td', { class: p.owned && p.biome === b.id ? 'good' : '' }, fmt$(eco.parcelPrice(p.id, b.id)))),
        h('td', { class: 'muted' }, p.owned ? `${biomeById(p.biome)?.name || 'owned'}${p.enclosure ? ', fenced' : ''}` : 'for sale')))),
    h('p', { class: 'muted' }, `Parcels are irregular shapes, so the fence follows the outline: an L of 4 tiles needs 10 segments where a 2×2 needs 8. Bigger parcels are a modest discount per tile and hold more dinosaurs (${P.space_per_tile} space units per tile), but the fence around them costs more. ${forSale.length} of ${all.length} parcels are still for sale. Land holds its value in your `, term('net_worth', 'net worth'), '.'),
    h('div', { class: 'row end' }, button('Open the park map', () => { m.close(); openBuyLand(); }, { class: 'btn primary' }))));
  void shortShape;
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

// Biome fit against the player's pens: ✓ a preferred pen exists, ~ only tolerated, ✗ only wrong-biome pens (or none).
export function fitBadge(sp) {
  const best = eco.bestFitFor(sp);
  const b = speciesBiomes(sp);
  const pref = (b.preferred || []).map(id => biomeById(id)?.name || id).join('/');
  const req = speciesRequiresPreferred(sp);
  const text = best === 'preferred' ? `${FIT_MARK.preferred} a ${pref} pen fits` : best === 'tolerated' ? `${FIT_MARK.tolerated} tolerated pen only (prefers ${pref})` : best === 'wrong' ? `${FIT_MARK.wrong} wrong biome only (prefers ${pref})` : `${req ? FIT_MARK.wrong : FIT_MARK.none} no ${req ? pref : ''} pen yet (prefers ${pref})`;
  return h('div', { class: `small fit fit-${best === 'none' ? (req ? 'wrong' : 'none') : best}`, 'data-tip-text': `${DATA.tooltips.terms.biome}${req ? ` ${sp.name} MUST live in ${pref}.` : ''}` }, text, req ? ' · required' : '');
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
    fitBadge(sp),
    h('div', { class: 'muted small' }, valid ? `${valid} enclosure${valid > 1 ? 's' : ''} fit` : (speciesRequiresPreferred(sp) && enclosures().length ? 'No pen in its preferred biome' : 'No enclosure fits')),
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

// Pen picker: every pen that fits, best biome fit first, each with its ✓ / ~ / ✗ mark. A required-biome species only
// ever sees preferred pens here (economy.enclosureFits refuses the rest); the refused pens are listed underneath.
function choosePlot(sp, onChoose) {
  const rank = { preferred: 0, tolerated: 1, wrong: 2, none: 3 };
  const list = eco.validEnclosuresFor(sp).slice().sort((a, b) => rank[biomeFit(sp, a.biome)] - rank[biomeFit(sp, b.biome)]);
  const refused = enclosures().filter(p => !eco.biomeAllows(p, sp));
  const BM = DATA.balance.biome;
  const fitText = f => f === 'preferred' ? `${FIT_MARK.preferred} preferred: popularity ×${BM.preferred_popularity}, +${BM.preferred_regen} health/day` : f === 'tolerated' ? `${FIT_MARK.tolerated} tolerated: no bonus, no penalty` : `${FIT_MARK.wrong} wrong biome: popularity ×${BM.wrong_popularity}, health slips, unhappy`;
  const m = openModal({ title: `Which enclosure for the ${sp.name}?`, body: h('div', {},
    whatIf(sp),
    h('p', { class: 'muted small' }, biomeLine(sp)),
    h('div', { class: 'cards' }, list.map(p => { const f = biomeFit(sp, p.biome); return h('div', { class: `card fit-card-${f}` },
      h('div', { class: 'card-title' }, h('span', { class: 'swatch', style: `background:${parcelBiome(p.id)?.color || '#888'}` }), `Parcel ${p.id} · ${parcelSizeLabel(p.id)} ${parcelBiome(p.id)?.name || ''}`),
      h('div', { class: `fit fit-${f}` }, fitText(f)),
      h('div', { class: 'muted' }, `${fenceByTier(p.enclosure.fence_tier).name} fence · ${eco.spaceCapacity(p.id) - eco.spaceUsed(p.enclosure)} of ${eco.spaceCapacity(p.id)} space free`),
      h('div', { class: 'muted' }, `${p.enclosure.dinos.length} dinosaur${p.enclosure.dinos.length === 1 ? '' : 's'} inside`),
      button('Choose', () => { m.close(); onChoose(p.id); }, { class: 'btn primary' })); })),
    refused.length ? h('p', { class: 'bad small' }, `${FIT_MARK.wrong} Refused (wrong biome for a species that needs its preferred land): ${refused.map(p => `${p.id} (${parcelBiome(p.id)?.name})`).join(', ')}. Re-landscape one from its enclosure panel.`) : null)
  });
}

function buyFlow(sp, market) {
  choosePlot(sp, plotIndex => {
    if (fail(eco.buyDino(sp.id, plotIndex))) return;
    refresh();
    checkMilestones(); // species-count milestone (and prize) fire at purchase time
    const f = biomeFit(sp, state.parcels[plotIndex].biome);
    afterPurchase(sp, market, `Bought for ${fmt$(sp.shop_price)}.${f === 'wrong' ? ` It is unhappy in ${parcelBiome(plotIndex)?.name}: re-landscape the pen or expect ×${DATA.balance.biome.wrong_popularity} popularity.` : f === 'preferred' ? ' Right at home in its preferred biome.' : ''} A delivery truck brings it to the park gate: open the Park to watch it arrive in ${plotIndex}.`);
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
const STORE_TABS = ['fences', 'upgrades', 'advertising', 'food', 'prizes'];
export function openGeneralStore({ tab = 'fences' } = {}) {
  const m = openModal({ title: 'General Store', className: 'wide' });
  m.setBody(tabs([
    { label: 'Fences', render: fencesTab },
    { label: 'Upgrades', render: () => liveTab(upgradesTab) },
    { label: term('advertising', 'Advertising'), render: () => liveTab(adsTab) },
    { label: 'Food', render: () => liveTab(foodTab) },
    { label: 'Park Prizes', render: prizesBody }
  ], Math.max(0, STORE_TABS.indexOf(tab))));
  return m;
}
// One-line prize progress shown at the top of every store tab.
function prizeLine() {
  const n = nextPrize();
  return h('p', { class: 'muted small prize-line' }, '🏆 ', term('prize', 'Park Prizes'), `: ${fmt$(state.store_spend || 0)} spent here so far`, n ? ` · next prize (${n.prize.name}) at ${fmt$(n.threshold)}` : ' · every spend prize earned', '.');
}

function fencesTab() {
  return h('div', {},
    prizeLine(),
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
    h('p', { class: 'muted' }, 'Eight fixed facilities at set spots in the park, each with a ladder of tiers bought in order. Every tier changes the building on the park view. Parking and the tram raise the daily visitor ', term('capacity', 'cap'), '; the food stand and gift shop raise ', term('concessions', 'concession'), ' spend (they need concessions staff, one per store); restrooms and the tram raise satisfaction; the visitor center raises ', term('appeal', 'appeal'), '; the vet clinic fights illness; the office sets your ', term('management_capacity', 'staff capacity'), '.'),
    prizeLine(),
    h('div', { class: 'cards grid-3 facility-cards' }, facilityDefs().map(f => facilityCard(f.id, render)))]);
  render();
  return wrap;
}

// The same ladder as the Marketing view (ui/marketing.js), so the store and the view can never disagree.
function adsTab() {
  return h('div', {},
    prizeLine(),
    h('p', { class: 'muted' }, 'The marketing ladder: each rung unlocks as the park grows. Boosts wear off; the strongest non-stackable one counts, social pushes stack. The Marketing view has the same ladder plus the Members panel.'),
    campaignLadder());
}

// Food tab: stock, need and days left per food, a quantity box pre-filled with balance.food.restock_fill_days of need,
// quick bundles, then the auto-restock rules. Seeds are planted from a pen, not stocked.
function foodTab() {
  const bundle = DATA.food.purchase_bundle_units;
  const rows = eco.foodDays();
  const warn = DATA.balance.food?.warn_days ?? 5;
  return h('div', {},
    prizeLine(),
    h('p', { class: 'muted' }, 'Bulk food goes into park stock and is moved into enclosures automatically every day. The quantity box is pre-filled with about ', `${DATA.balance.food?.restock_fill_days ?? 30}`, ' days of today\'s need; edit it or use a bundle. You can also feed a single enclosure from the Park view.'),
    h('table', { class: 'table food-table' },
      h('tr', {}, h('th', {}, 'Food'), h('th', {}, 'Unit cost'), h('th', {}, 'Park stock'), h('th', {}, 'In pens'), h('th', {}, 'Daily need'), h('th', {}, term('days_of_food', 'Days left')), h('th', {}, 'Buy')),
      DATA.food.items.map(f => {
        if (f.grows) return h('tr', {},
          h('td', {}, h('span', { class: 'swatch', style: `background:${f.color}` }), f.name),
          h('td', {}, fmt$(f.unit_cost)),
          h('td', { class: 'muted', colSpan: 5 }, term('vegetation', 'Grows in a pen'), `: ${f.blurb || 'Plant seeds from an enclosure in the Park view.'}`));
        const r = rows.find(x => x.food.id === f.id);
        const inPens = r.stock - (state.park_food[f.id] || 0);
        const qty = h('input', { type: 'number', min: 1, max: 5000, step: 1, value: suggestedUnits(f.id), class: 'qty wide' });
        const cost = h('span', { class: 'muted small' }, fmt$(suggestedUnits(f.id) * f.unit_cost));
        qty.addEventListener('input', () => { cost.textContent = fmt$((Number(qty.value) || 0) * f.unit_cost); });
        const buy = n => () => { if (!fail(eco.buyParkFood(f.id, n))) refresh(); };
        const days = r.need > 0 ? `${Math.floor(r.days)}` : '—';
        return h('tr', {},
          h('td', {}, h('span', { class: 'swatch', style: `background:${f.color}` }), f.name),
          h('td', {}, fmt$(f.unit_cost)),
          h('td', {}, `${state.park_food[f.id]}`),
          h('td', {}, `${inPens}`),
          h('td', {}, `${r.need}/day`),
          h('td', { class: r.need > 0 && r.days < warn ? 'bad' : '' }, days),
          h('td', {}, h('div', { class: 'row wrap buy-row' }, qty, button('Buy', () => buy(Number(qty.value))(), { class: 'btn primary' }), cost, button(`${bundle}`, buy(bundle), { title: `${bundle} units for ${fmt$(bundle * f.unit_cost)}` }), button(`${bundle * 5}`, buy(bundle * 5), { title: `${bundle * 5} units for ${fmt$(bundle * 5 * f.unit_cost)}` }))));
      })),
    h('h3', {}, term('auto_restock', 'Auto-restock')),
    autoRestockPanel());
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
