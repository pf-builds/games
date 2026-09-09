// Park click handling: buy parcel, enclosure setup, enclosure management, facility panel.
import { DATA, state, parcelBiome, parcelSizeLabel, AWord, fenceByTier, speciesById, facilityById, facilityTier, facilityTierDef, facilityNextTier, staffCount, fmt$, pct, emitChange } from '../state.js';
import * as eco from '../economy.js';
import { projectDay, concessionStores, satisfaction } from '../attendance.js';
import { h, button, term } from './dom.js';
import { openModal, alertModal, confirmModal } from './modals.js';
import { showFact } from './factbook.js';

export function onParcelClick(id) {
  const p = state.parcels[id];
  if (!p.owned) return buyParcelFlow(id);
  if (!p.enclosure) return setupPanel(id);
  return enclosurePanel(id);
}

export const parcelTitle = id => `Parcel ${id} · ${parcelSizeLabel(id)} ${parcelBiome(id).name}`;

async function buyParcelFlow(id) {
  const biome = parcelBiome(id);
  const price = eco.parcelPrice(id);
  const ok = await confirmModal('Buy Land', h('div', {},
    h('p', {}, `Buy parcel ${id} (${parcelSizeLabel(id)} ${biome.name}) for `, h('b', {}, fmt$(price)), '?'),
    h('p', { class: 'muted' }, biome.blurb),
    h('p', { class: 'muted' }, `Holds ${eco.parcelCapacity(id)} space units. ${AWord(fenceByTier(1).name)} fence around it costs ${fmt$(eco.fenceCost(1, id))} (${eco.perimeterSegments(id)} segments).`),
    h('p', { class: 'muted' }, 'Cash after: ', fmt$(state.cash - price), ' · Land counts toward your ', term('net_worth', 'net worth'), '.')), 'Buy');
  if (!ok) return;
  fail(eco.buyParcel(id)) || emitChange();
}

export function setupPanel(id) {
  const m = openModal({ title: `Build an Enclosure · ${parcelTitle(id)}`, body: fenceChoices(id, tier => {
    if (fail(eco.buildFence(id, tier))) return;
    m.close();
    emitChange();
  }) });
}

function fenceChoices(id, onPick, current = 0) {
  const seg = eco.perimeterSegments(id);
  return h('div', {},
    h('p', { class: 'muted' }, `This ${parcelSizeLabel(id)} parcel needs ${seg} fence segments and holds ${eco.parcelCapacity(id)} space units. `, term('fence_tier', 'Fence tier'), ' must meet every dinosaur\'s minimum.'),
    h('div', { class: 'cards' }, DATA.fences.tiers.filter(f => f.tier > current).map(f => {
      const cost = current ? eco.fenceCost(f.tier, id) - eco.fenceCost(current, id) : eco.fenceCost(f.tier, id);
      return h('div', { class: 'card' },
        h('div', { class: 'card-title', style: `color:${f.color}` }, `${f.name} (tier ${f.tier})`),
        h('div', {}, `${fmt$(f.cost_per_segment)}/segment · ${fmt$(eco.fenceCost(f.tier, id))} total`),
        h('div', { class: 'muted' }, term('upkeep', 'Upkeep'), ` ${fmt$(f.upkeep_per_quarter * seg / DATA.fences.segments_per_enclosure)}/quarter`),
        button(current ? `Upgrade for ${fmt$(cost)}` : 'Build', () => onPick(f.tier), { class: 'btn primary', disabled: !eco.canAfford(cost) }));
    })));
}

export function enclosurePanel(id) {
  const p = state.parcels[id];
  const m = openModal({ title: parcelTitle(id), className: 'wide' });
  const render = () => m.setBody(enclosureBody(p, id, render, m));
  render();
}

function enclosureBody(p, id, rerender, modal) {
  const enc = p.enclosure;
  const fence = fenceByTier(enc.fence_tier);
  const act = fn => { if (!fail(fn())) { emitChange(); rerender(); } };
  return h('div', {},
    h('div', { class: 'row wrap' },
      h('span', {}, term('fence_tier', 'Fence'), `: ${fence.name} (tier ${fence.tier}) · condition ${Math.round(enc.condition)}%`),
      h('span', {}, `Space ${eco.spaceUsed(enc)}/${eco.spaceCapacity(id)}`),
      enc.condition < 100 ? button(`Repair ${fmt$(eco.repairCost(enc))}`, () => act(() => eco.repairFence(id))) : null,
      enc.fence_tier < DATA.fences.tiers.length ? button('Upgrade fence', () => {
        const u = openModal({ title: 'Upgrade Fence', body: fenceChoices(id, tier => { if (!fail(eco.upgradeFence(id, tier))) { u.close(); emitChange(); rerender(); } }, enc.fence_tier) });
      }) : null),
    h('h3', {}, 'Dinosaurs'),
    enc.dinos.length ? h('table', { class: 'table' },
      h('tr', {}, h('th', {}, 'Species'), h('th', {}, 'Health'), h('th', {}, 'Hunger'), h('th', {}, 'Age'), h('th', {}, 'Fence ok?'), h('th', {}, '')),
      enc.dinos.map(d => dinoRow(d, enc, id, act))) : h('p', { class: 'muted' }, 'Empty. Buy dinosaurs at the Dino Market in town.'),
    enc.dinos.length ? h('p', { class: 'muted small' }, `Health: a fed, healthy dinosaur regains ${DATA.balance.dinosaur.health_regen_per_day}/day on its own, ${DATA.staff.roles.find(r => r.id === 'veterinary').heal_per_day}/day with a vet on staff. Starving loses ${DATA.balance.dinosaur.starve_health_loss_per_day}/day.`) : null,
    h('h3', {}, 'Food'),
    foodSection(enc, id, act),
    h('div', { class: 'row end' }, button('Close', () => modal.close())));
}

function dinoRow(d, enc, id, act) {
  const sp = speciesById(d.species);
  const okFence = sp.min_fence_tier <= enc.fence_tier;
  return h('tr', {},
    h('td', {}, h('span', { class: 'swatch', style: `background:${sp.color}` }), sp.name, d.sick_days > 0 ? ' (sick)' : ''),
    h('td', { style: d.health < 50 ? 'color:var(--danger)' : '' }, `${Math.round(d.health)}`),
    h('td', {}, d.hunger >= DATA.balance.dinosaur.hunger_max ? 'STARVING' : `${d.hunger}%`),
    h('td', {}, `${(d.age_days / DATA.balance.dinosaur.days_per_year).toFixed(1)}y`),
    h('td', { style: okFence ? '' : 'color:var(--danger)' }, okFence ? 'yes' : `needs tier ${sp.min_fence_tier}`),
    h('td', {}, button(`Sell ${fmt$(eco.sellPrice(d))}`, () => act(() => eco.sellDino(id, d.uid))), ' ', button('Fact', () => showFact(sp))));
}

function foodSection(enc, id, act) {
  const need = eco.dailyNeed(enc);
  const items = DATA.food.items.filter(f => need[f.id] || enc.food[f.id] > 0);
  if (!items.length) return h('p', { class: 'muted' }, 'No dinosaurs to feed yet.');
  const bundle = DATA.food.purchase_bundle_units;
  return h('div', {}, items.map(f => h('div', { class: 'row' },
    h('span', { class: 'swatch', style: `background:${f.color}` }),
    h('span', { style: 'min-width:220px' }, `${f.name}: ${enc.food[f.id]} units (eats ${need[f.id] || 0}/day, park stock ${state.park_food[f.id]})`),
    button(`Buy ${bundle} for ${fmt$(bundle * f.unit_cost)}`, () => act(() => eco.buyEnclosureFood(id, f.id, bundle))),
    button(`Buy ${bundle * 3} for ${fmt$(bundle * 3 * f.unit_cost)}`, () => act(() => eco.buyEnclosureFood(id, f.id, bundle * 3))))),
    h('p', { class: 'muted' }, `Max ${DATA.food.max_stock_per_enclosure} units per food per enclosure. Park stock from the General Store tops up enclosures every day.`));
}

// ---- fixed facilities ----
export function effectText(f, t) {
  if (f.effect_key === 'parking_capacity') return `+${t.effect_magnitude} visitors/day`;
  if (f.effect_key === 'concession_spend') return `spend ×${t.effect_magnitude} per visitor`;
  if (f.effect_key === 'satisfaction') return `satisfaction +${pct(t.effect_magnitude)}`;
  return 'base facility';
}

// What-if for the next tier: project a day with the tier bumped, economy untouched.
// Concessions: one worker per open store for the full effect, so the note says when a second store needs a second hire.
// Satisfaction only raises price tolerance, which is worth $0 at the reference ticket; when the projection shows no
// change the line probes the data max ticket so the upgrade does not read as worthless.
export function upgradeWhatIf(id) {
  const next = facilityNextTier(id);
  if (!next) return null;
  const tiers = { ...state.facilities, [id]: next.tier };
  const before = projectDay(state.ticket_price);
  const after = projectDay(state.ticket_price, tiers);
  const f = facilityById(id);
  let note = '';
  if (f.effect_key === 'concession_spend') {
    const stores = concessionStores(tiers).length, workers = staffCount('concessions');
    if (workers === 0) note = ' Needs a concessions worker to earn anything.';
    else if (workers < stores) note = ` Stores share ${workers} concessions worker${workers > 1 ? 's' : ''}: hire ${stores - workers} more (one per store) for the full effect.`;
  }
  const perQ = fmt$((after.total - before.total) * DATA.balance.time.days_per_quarter);
  if (f.effect_key === 'satisfaction' && Math.round(after.total) === Math.round(before.total)) {
    const probe = DATA.balance.attendance.max_ticket;
    const b2 = projectDay(probe), a2 = projectDay(probe, tiers);
    return `satisfaction ${pct(satisfaction())} → ${pct(satisfaction(tiers))}: visitors accept a higher ticket price and rate the park higher. No change at today's ${fmt$(state.ticket_price)} ticket; at a ${fmt$(probe)} ticket, visitors/day ${b2.attendance} → ${a2.attendance}, revenue/day ${fmt$(b2.total)} → ${fmt$(a2.total)}.`;
  }
  return `visitors/day ${before.attendance} → ${after.attendance}, revenue/day ${fmt$(before.total)} → ${fmt$(after.total)} (about ${perQ}/quarter).${note}`;
}

export function facilityCard(id, rerender) {
  const f = facilityById(id);
  const tier = facilityTier(id), cur = facilityTierDef(id), next = facilityNextTier(id);
  const what = upgradeWhatIf(id);
  const single = f.tiers.length === 1; // base building only (office): no tier fraction, no "Top tier" badge
  return h('div', { class: `card ${next ? '' : 'owned'}` },
    h('div', { class: 'card-title' }, f.name),
    h('div', {}, `Now: ${cur.label}${single ? '' : ` (tier ${tier}/${f.tiers[f.tiers.length - 1].tier})`} · ${effectText(f, cur)}`),
    next ? h('div', { class: 'big' }, fmt$(next.cost)) : h('div', { class: 'big' }, single ? 'Base building' : 'Top tier'),
    next ? h('div', { class: 'muted' }, `Next: ${next.label} · ${effectText(f, next)} · `, term('upkeep', 'upkeep'), ` ${fmt$(next.upkeep_per_quarter)}/qtr`) : null,
    h('p', { class: 'muted' }, f.blurb),
    what ? h('div', { class: 'muted small' }, term('what_if', 'What-if'), `: ${what}`) : (f.tiers.length === 1 ? h('div', { class: 'muted small' }, 'Upgrades for this building come in a later milestone.') : null),
    next ? button(`Upgrade to ${next.label}`, () => { if (fail(eco.upgradeFacility(id))) return; emitChange(); rerender?.(); }, { class: 'btn primary', disabled: !eco.canAfford(next.cost) }) : null);
}

export function facilityPanel(id) {
  const m = openModal({ title: facilityById(id).name });
  const render = () => m.setBody(h('div', {}, facilityCard(id, render), h('p', { class: 'muted small' }, 'Fixed facility: it stays here and grows with each tier. All upgrades are also in the General Store → Upgrades.'), h('div', { class: 'row end' }, button('Close', () => m.close()))));
  render();
}

export function fail(err) {
  if (!err) return false;
  alertModal('Not possible', err);
  return true;
}
