// Park click handling: buy parcel (choose the land type), enclosure setup, enclosure management, facility panel.
import { DATA, state, parcelBiome, parcelSizeLabel, parcelArea, AWord, fenceByTier, speciesById, biomeById, biomeDefs, facilityById, facilityTier, facilityTierDef, facilityNextTier, staffCount, fmt$, pct, emitChange, biomeFit, speciesBiomes, speciesRequiresPreferred, FIT_MARK } from '../state.js';
import { effectText, effectDelta, effectList } from './effects.js';
import * as eco from '../economy.js';
import { projectDay, concessionStores, satisfaction } from '../attendance.js';
import { h, button, term } from './dom.js';
import { openModal, alertModal } from './modals.js';
import { showFact } from './factbook.js';

export function onParcelClick(id) {
  const p = state.parcels[id];
  if (!p.owned) return buyParcelFlow(id);
  if (!p.enclosure) return setupPanel(id);
  return enclosurePanel(id);
}

export const parcelTitle = id => `Parcel ${id} · ${parcelSizeLabel(id)} ${parcelBiome(id)?.name || 'scrub'}`;

// Species that call a biome home (preferred), for the buy dialog and the biome guide.
export function speciesPreferring(biomeId) { return DATA.dinosaurs.species.filter(sp => (speciesBiomes(sp).preferred || []).includes(biomeId)); }
export function speciesTolerating(biomeId) { return DATA.dinosaurs.species.filter(sp => (speciesBiomes(sp).tolerated || []).includes(biomeId)); }
export function growthLine(biomeId, tiles = 4) {
  const V = DATA.balance.vegetation || {};
  const rate = (V.growth_per_day || {})[biomeId] || 0;
  return `${rate.toFixed(2)} plant units/day per planted tile (${(rate * tiles).toFixed(2)}/day for ${tiles} tiles)`;
}
const namesShort = (list, n = 5) => list.length ? list.slice(0, n).map(s => s.name).join(', ') + (list.length > n ? ` +${list.length - n} more` : '') : 'none';

// M4: the buyer chooses Desert / Plains / Marsh here; the parcel itself is neutral scrub until then.
export function buyParcelFlow(id) {
  const tiles = parcelArea(id);
  const m = openModal({ title: `Buy Land · Parcel ${id} · ${parcelSizeLabel(id)}`, className: 'wide' });
  m.setBody(h('div', {},
    h('p', {}, 'Choose the land type. It sets the price, what grows for grazing, and which dinosaurs feel at home (the ', term('biome', 'biome'), ' matters: a species in the wrong one is unhappy). You can ', term('relandscape', 're-landscape'), ' later for half the land price.'),
    h('p', { class: 'muted' }, `Holds ${eco.parcelCapacity(id)} space units. ${AWord(fenceByTier(1).name)} fence around it costs ${fmt$(eco.fenceCost(1, id))} (${eco.perimeterSegments(id)} segments). Land counts toward your `, term('net_worth', 'net worth'), '.'),
    h('div', { class: 'cards grid-3 biome-cards' }, biomeDefs().map(b => {
      const price = eco.parcelPrice(id, b.id);
      const pref = speciesPreferring(b.id);
      return h('div', { class: 'card', style: `--biome:${b.color}` },
        h('div', { class: 'card-title' }, h('span', { class: 'swatch', style: `background:${b.color}` }), b.name),
        h('div', { class: 'big' }, fmt$(price)),
        h('div', { class: 'muted small' }, `${fmt$(b.plot_cost)}/tile × ${tiles} tiles (×${eco.areaFactor(tiles).toFixed(2)})`),
        h('p', { class: 'muted' }, b.blurb),
        h('div', { class: 'small' }, h('b', {}, 'Grows: '), b.grows || '', ' ', h('span', { class: 'muted' }, `(${growthLine(b.id, tiles)})`)),
        h('div', { class: 'small' }, h('b', {}, `Home for ${pref.length}: `), namesShort(pref)),
        h('div', { class: 'muted small' }, `Cash after: ${fmt$(state.cash - price)}`),
        button(`Buy as ${b.name}`, () => { if (fail(eco.buyParcel(id, b.id))) return; m.close(); emitChange(); }, { class: 'btn primary', disabled: !eco.canAfford(price) }));
    })),
    h('div', { class: 'row end' }, button('Cancel', () => m.close()))));
}

export function setupPanel(id) {
  const m = openModal({ title: `Build an Enclosure · ${parcelTitle(id)}`, body: h('div', {}, fenceChoices(id, tier => {
    if (fail(eco.buildFence(id, tier))) return;
    m.close();
    emitChange();
  }), h('div', { class: 'row end' }, relandscapeButton(id, () => { m.close(); setupPanel(id); }))) });
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
  const render = () => { m.box.querySelector('.modal-head h2').textContent = parcelTitle(id); m.setBody(enclosureBody(p, id, render, m)); };
  render();
}

// Re-landscape: pick one of the other biomes at balance.biome.relandscape_ratio x its land price. Blocked while a
// required-biome species inside would end up outside its preferred land.
function relandscapeButton(id, after) {
  return button('Re-landscape', () => relandscapePanel(id, after), { title: 'Change the land type (biome) of this parcel' });
}
function relandscapePanel(id, after) {
  const p = state.parcels[id];
  const cur = biomeById(p.biome);
  const m = openModal({ title: `Re-landscape · Parcel ${id} (now ${cur?.name || 'scrub'})`, className: 'wide' });
  const dinos = p.enclosure ? p.enclosure.dinos : [];
  m.setBody(h('div', {},
    h('p', {}, term('relandscape', 'Re-landscaping'), ` costs ${pct(DATA.balance.biome.relandscape_ratio)} of the new land price and clears any vegetation in the pen. Dinosaurs stay put; check their fit below before you dig.`),
    h('div', { class: 'cards grid-3 biome-cards' }, biomeDefs().filter(b => b.id !== p.biome).map(b => {
      const cost = eco.relandscapeCost(id, b.id);
      const blockers = [...new Set(eco.relandscapeBlockers(id, b.id))];
      const fits = dinos.map(d => ({ sp: speciesById(d.species), fit: biomeFit(speciesById(d.species), b.id) }));
      return h('div', { class: 'card', style: `--biome:${b.color}` },
        h('div', { class: 'card-title' }, h('span', { class: 'swatch', style: `background:${b.color}` }), b.name),
        h('div', { class: 'big' }, fmt$(cost)),
        h('p', { class: 'muted' }, b.blurb),
        h('div', { class: 'small' }, h('b', {}, 'Grows: '), growthLine(b.id, parcelArea(id))),
        fits.length ? h('div', { class: 'small' }, 'Your animals here: ', fits.map((f, i) => h('span', { class: `fit fit-${f.fit}` }, `${i ? ' · ' : ''}${FIT_MARK[f.fit]} ${f.sp.name}`))) : null,
        blockers.length ? h('div', { class: 'bad small' }, `Blocked: ${blockers.join(', ')} must stay in a preferred biome.`) : null,
        button(`Re-landscape as ${b.name}`, () => { if (fail(eco.relandscape(id, b.id))) return; m.close(); emitChange(); after?.(); }, { class: 'btn primary', disabled: !!blockers.length || !eco.canAfford(cost) }));
    })),
    h('div', { class: 'row end' }, button('Cancel', () => m.close()))));
}

function enclosureBody(p, id, rerender, modal) {
  const enc = p.enclosure;
  const fence = fenceByTier(enc.fence_tier);
  const biome = biomeById(p.biome);
  const act = fn => { if (!fail(fn())) { emitChange(); rerender(); } };
  return h('div', {},
    h('div', { class: 'row wrap' },
      h('span', {}, term('fence_tier', 'Fence'), `: ${fence.name} (tier ${fence.tier}) · condition ${Math.round(enc.condition)}%`),
      h('span', {}, `Space ${eco.spaceUsed(enc)}/${eco.spaceCapacity(id)}`),
      penFoodChips(p),
      h('span', {}, term('biome', 'Biome'), ': ', h('span', { class: 'swatch', style: `background:${biome?.color || '#888'}` }), biome?.name || 'scrub'),
      enc.condition < 100 ? button(`Repair ${fmt$(eco.repairCost(enc))}`, () => act(() => eco.repairFence(id))) : null,
      enc.fence_tier < DATA.fences.tiers.length ? button('Upgrade fence', () => {
        const u = openModal({ title: 'Upgrade Fence', body: fenceChoices(id, tier => { if (!fail(eco.upgradeFence(id, tier))) { u.close(); emitChange(); rerender(); } }, enc.fence_tier) });
      }) : null,
      relandscapeButton(id, rerender)),
    h('h3', {}, 'Dinosaurs'),
    enc.dinos.length ? h('table', { class: 'table' },
      h('tr', {}, h('th', {}, 'Species'), h('th', {}, 'Health'), h('th', {}, 'Hunger'), h('th', {}, 'Age'), h('th', {}, 'Fence ok?'), h('th', {}, term('biome', 'Biome fit')), h('th', {}, '')),
      enc.dinos.map(d => dinoRow(d, enc, id, p, act))) : h('p', { class: 'muted' }, 'Empty. Buy dinosaurs at the Dino Market in town.'),
    enc.dinos.length ? h('p', { class: 'muted small' }, `Health: a fed, healthy dinosaur regains ${DATA.balance.dinosaur.health_regen_per_day}/day on its own, ${DATA.staff.roles.find(r => r.id === 'veterinary').heal_per_day}/day with a vet on staff, +${DATA.balance.biome.preferred_regen}/day in its preferred biome. Starving loses ${DATA.balance.dinosaur.starve_health_loss_per_day}/day; the wrong biome drifts it down ${DATA.balance.biome.wrong_health_drift}/day to a floor of ${DATA.balance.biome.wrong_health_floor} and cuts its popularity to ${pct(DATA.balance.biome.wrong_popularity)}.`) : null,
    h('h3', {}, 'Food'),
    foodSection(enc, id, act),
    h('h3', {}, term('vegetation', 'Vegetation')),
    vegetationSection(p, enc, id, act),
    h('div', { class: 'row end' }, button('Close', () => modal.close())));
}

function dinoRow(d, enc, id, p, act) {
  const sp = speciesById(d.species);
  const okFence = sp.min_fence_tier <= enc.fence_tier;
  const fit = biomeFit(sp, p.biome);
  const pref = (speciesBiomes(sp).preferred || []).map(b => biomeById(b)?.name || b).join('/');
  const fitText = fit === 'preferred' ? `${FIT_MARK.preferred} at home` : fit === 'tolerated' ? `${FIT_MARK.tolerated} tolerates (prefers ${pref})` : `${FIT_MARK.wrong} unhappy (prefers ${pref})`;
  return h('tr', {},
    h('td', {}, h('span', { class: 'swatch', style: `background:${sp.color}` }), sp.name, d.sick_days > 0 ? ' (sick)' : '', speciesRequiresPreferred(sp) ? h('span', { class: 'muted small' }, ' · needs preferred land') : null),
    h('td', { style: d.health < 50 ? 'color:var(--danger)' : '' }, `${Math.round(d.health)}`),
    h('td', {}, d.hunger >= DATA.balance.dinosaur.hunger_max ? 'STARVING' : `${d.hunger}%`),
    h('td', {}, `${(d.age_days / DATA.balance.dinosaur.days_per_year).toFixed(1)}y`),
    h('td', { style: okFence ? '' : 'color:var(--danger)' }, okFence ? 'yes' : `needs tier ${sp.min_fence_tier}`),
    h('td', { class: `fit fit-${fit}` }, fitText),
    h('td', {}, button(`Sell ${fmt$(eco.sellPrice(d))}`, () => act(() => eco.sellDino(id, d.uid))), ' ', button('Fact', () => showFact(sp))));
}

// M5 (M4 minor b): days of food in THIS pen's trough per food it needs, red below balance.food.warn_days.
function penFoodChips(p) {
  const rows = eco.penFoodDays(p);
  if (!rows.length) return null;
  const warn = DATA.balance.food?.warn_days ?? 5;
  return h('span', { class: 'food-chips' }, rows.map(r => {
    const d = Math.floor(r.days), pd = r.park_days === Infinity ? null : Math.floor(r.park_days);
    return h('span', { class: `chip-food ${r.stock <= 0 ? 'out' : d < warn ? 'low' : ''}`, 'data-tip-text': `${r.food.name} in this pen: ${r.stock} units, eats ${r.need}/day = ${d} day${d === 1 ? '' : 's'} in the trough. Park stock tops it up daily; the whole park has ${pd == null ? 'plenty' : `${pd} day${pd === 1 ? '' : 's'}`}.` }, `${r.food.name} ${d}d in pen${pd != null ? ` · ${pd}d park` : ''}`);
  }));
}

function foodSection(enc, id, act) {
  const need = eco.dailyNeed(enc);
  const items = DATA.food.items.filter(f => f.diet && (need[f.id] || enc.food[f.id] > 0));
  if (!items.length) return h('p', { class: 'muted' }, 'No dinosaurs to feed yet.');
  const bundle = DATA.food.purchase_bundle_units;
  const warn = DATA.balance.food?.warn_days ?? 5;
  return h('div', {}, items.map(f => { const perDay = need[f.id] || 0, days = perDay > 0 ? Math.floor(enc.food[f.id] / perDay) : null; return h('div', { class: 'row' },
    h('span', { class: 'swatch', style: `background:${f.color}` }),
    h('span', { style: 'min-width:220px' }, `${f.name}: ${enc.food[f.id]} units (eats ${perDay}/day`, days != null ? h('span', { class: days < warn ? 'bad' : 'good' }, ` = ${days} day${days === 1 ? '' : 's'} in this pen`) : null, `, park stock ${state.park_food[f.id]})`),
    button(`Buy ${bundle} for ${fmt$(bundle * eco.foodUnitCost(f))}`, () => act(() => eco.buyEnclosureFood(id, f.id, bundle))),
    button(`Buy ${bundle * 3} for ${fmt$(bundle * 3 * eco.foodUnitCost(f))}`, () => act(() => eco.buyEnclosureFood(id, f.id, bundle * 3)))); }),
    h('p', { class: 'muted' }, `Max ${DATA.food.max_stock_per_enclosure} units per food per enclosure. Park stock from the General Store tops up enclosures every day; set an auto-restock rule there so it never runs dry.`));
}

// Seeds -> vegetation (balance.vegetation): plant, watch it grow, herbivores graze it before the stock.
function vegetationSection(p, enc, id, act) {
  const seed = eco.seedFood();
  if (!seed) return h('p', { class: 'muted' }, 'No seeds for sale.');
  const cap = eco.vegetationCap(id), toPlant = eco.seedsToPlant(id), planted = enc.seeded || 0, left = toPlant - planted;
  const growth = eco.vegetationGrowth(p);
  const veg = enc.vegetation || 0;
  const herb = enc.dinos.filter(d => speciesById(d.species).diet === 'herbivore');
  const plantNeed = herb.reduce((s, d) => s + speciesById(d.species).food_per_day, 0);
  const biome = biomeById(p.biome);
  const V = DATA.balance.vegetation;
  const bundle = DATA.food.purchase_bundle_units;
  const perTile = (V.growth_per_day || {})[p.biome] || 0;
  const bar = h('div', { class: 'bar veg-bar' }, h('div', { class: 'bar-fill veg', style: `width:${Math.round(100 * Math.min(1, veg / cap))}%` }));
  return h('div', {},
    h('div', { class: 'row wrap' },
      h('span', {}, `Greenery ${Math.round(veg)}/${cap} (${pct(Math.min(1, veg / cap))})`),
      h('span', { class: 'muted' }, `· planted ${planted}/${toPlant} seed units (${pct(planted / toPlant)})`),
      h('span', { class: growth > 0 ? 'good' : 'muted' }, `· grows +${growth.toFixed(2)}/day`),
      h('span', { class: 'muted' }, `(${biome?.name || 'scrub'}: ${perTile.toFixed(2)}/tile/day × ${parcelArea(id)} tiles × planted share)`)),
    bar,
    // M5 (M4 minor a): what the pen did today, so a grazed pen reads as regrowing rather than broken.
    planted > 0 ? h('div', { class: 'row wrap small veg-today' },
      h('span', { class: (enc.grazed_today || 0) > 0 ? 'good' : 'muted' }, `Today: ${(enc.grazed_today || 0) > 0 ? `${enc.grazed_today} unit${enc.grazed_today === 1 ? '' : 's'} grazed` : 'nothing grazed'}, ${(enc.regrow_today ?? growth).toFixed(2)} regrown`),
      h('span', { class: 'muted' }, veg >= cap - 1e-9 ? '· the pen is fully grown' : (enc.grazed_today || 0) > 0 ? '· the roots are growing back' : '· still filling in')) : null,
    h('div', { class: 'row wrap' },
      button(`Plant ${Math.min(bundle, left)} seeds for ${fmt$(Math.min(bundle, left) * eco.foodUnitCost(seed))}`, () => act(() => eco.plantSeeds(id, bundle)), { disabled: left <= 0 || !eco.canAfford(Math.min(bundle, left) * eco.foodUnitCost(seed)) }),
      left > bundle ? button(`Plant the rest (${left}) for ${fmt$(left * eco.foodUnitCost(seed))}`, () => act(() => eco.plantSeeds(id, left)), { class: 'btn primary', disabled: !eco.canAfford(left * eco.foodUnitCost(seed)) }) : null,
      left <= 0 ? h('span', { class: 'good' }, 'Fully planted.') : null),
    h('p', { class: 'muted small', 'data-tip-text': DATA.tooltips.terms.vegetation },
      herb.length ? `${herb.length} herbivore${herb.length > 1 ? 's' : ''} here eat ${plantNeed} plant unit${plantNeed > 1 ? 's' : ''}/day and graze the greenery first (1 unit = 1 plant unit, ${fmt$(eco.foodUnitCost(DATA.food.items.find(f => f.diet === 'herbivore')))} saved each). Fully planted, this pen grows about ${(perTile * parcelArea(id)).toFixed(2)}/day: ${pct(Math.min(1, plantNeed ? perTile * parcelArea(id) / plantNeed : 0))} of their food for free. Grazed so far: ${enc.grazed || 0} units.` : 'No herbivores here yet: greenery still adds a little appeal, and it is ready to graze when one arrives.',
      ` Seeds are an investment (paid once, at ${fmt$(eco.foodUnitCost(seed))}/unit); plants are a recurring cost. Re-landscaping clears it.`));
}

// ---- fixed facilities ----
export { effectText };

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
  if (f.effect_key === 'management_capacity') return `office runs ${effectList(id, next)[0].replace('runs ', '')} before morale slips (now ${state.staff.length} on staff); ${effectList(id, next)[1] || ''}`.replace(/; $/, '.');
  if (f.effect_key === 'illness_reduction') return `${effectList(id, next).join(', ')} for every animal, on top of any vet on staff.`;
  if (Math.round(after.total) === Math.round(before.total)) return `${effectList(id, next).join(', ')}. No change to today's projection at the current cap and price.`;
  return `visitors/day ${before.attendance} → ${after.attendance}, revenue/day ${fmt$(before.total)} → ${fmt$(after.total)} (about ${perQ}/quarter).${note}`;
}

// One card per facility: the whole ladder (every tier with cost and effect), the current tier marked, the next tier
// with its effect deltas, the what-if line, and the upgrade button.
export function facilityCard(id, rerender) {
  const f = facilityById(id);
  const tier = facilityTier(id), cur = facilityTierDef(id), next = facilityNextTier(id);
  const top = f.tiers[f.tiers.length - 1].tier;
  const what = upgradeWhatIf(id);
  return h('div', { class: `card facility-card ${next ? '' : 'owned'}` },
    h('div', { class: 'card-title' }, f.name, h('span', { class: 'muted small' }, ` tier ${tier}/${top}`)),
    h('div', {}, `Now: ${cur.label} · ${effectText(f, cur)}`),
    h('ol', { class: 'ladder' }, f.tiers.map(t => h('li', { class: `rung ${t.tier === tier ? 'current' : t.tier < tier ? 'done' : t.tier === tier + 1 ? 'next' : 'locked'}` },
      h('span', { class: 'rung-mark' }, t.tier < tier ? '✓' : t.tier === tier ? '●' : t.tier === tier + 1 ? '→' : '○'),
      h('span', { class: 'rung-label' }, `${t.tier} ${t.label}`),
      h('span', { class: 'rung-cost' }, t.tier === 0 ? 'base' : fmt$(t.cost)),
      h('span', { class: 'rung-effect muted small' }, effectText(f, t))))),
    next ? h('div', { class: 'big' }, fmt$(next.cost)) : h('div', { class: 'big' }, 'Top tier'),
    next ? h('div', { class: 'muted' }, `Next: ${next.label} · ${effectDelta(id, tier, next.tier).join(' · ')} · `, term('upkeep', 'upkeep'), ` ${fmt$(next.upkeep_per_quarter)}/qtr`) : null,
    h('p', { class: 'muted small' }, f.blurb),
    what ? h('div', { class: 'muted small' }, term('what_if', 'What-if'), `: ${what}`) : null,
    next ? button(`Upgrade to ${next.label}`, () => { if (fail(eco.upgradeFacility(id))) return; emitChange(); rerender?.(); }, { class: 'btn primary', disabled: !eco.canAfford(next.cost) }) : null);
}

export function facilityPanel(id) {
  const m = openModal({ title: facilityById(id).name });
  const render = () => m.setBody(h('div', {}, facilityCard(id, render), h('p', { class: 'muted small' }, 'Fixed facility: it stays here and grows with each tier. All upgrades are also in the General Store → Upgrades, and every dollar spent there counts toward Park Prizes.'), h('div', { class: 'row end' }, button('Close', () => m.close()))));
  render();
}

export function fail(err) {
  if (!err) return false;
  alertModal('Not possible', err);
  return true;
}
