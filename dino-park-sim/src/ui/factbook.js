// Fact Book view and the fact card shown after a purchase.
import { DATA, state, fenceByTier, speciesOwned, allDinos, facilityTier, facilityEffect, facilityTierDef, biomeById, fmt$, speciesBiomes, speciesRequiresPreferred } from '../state.js';

// M5: Fact Book views (a fact card opened, or the Fact Book view shown) feed the report card's education grade.
function countView() { if (state && state.stats) state.stats.fact_views = (state.stats.fact_views || 0) + 1; }
import { speciesByTier, DIET_ICON } from './stores.js';
import { h, clear } from './dom.js';
import { openModal } from './modals.js';

// Visitor Center `education` level (facilities.json) unlocks the extras: 1 = field notes, 2 = your own specimens.
export const educationLevel = () => facilityEffect('visitor_center', facilityTier('visitor_center'), 'education') || 0;
function fieldNotes(sp) {
  const lvl = educationLevel();
  if (lvl < 1) return null;
  const lines = [h('div', { class: 'muted small notes' }, `Field notes: danger ${sp.danger_level}/10 · lifespan about ${sp.lifespan_years} years · ${sp.space_required} space unit${sp.space_required > 1 ? 's' : ''} · eats ${sp.food_per_day}/day`)];
  if (lvl >= 2) {
    const mine = allDinos().filter(x => x.dino.species === sp.id);
    if (mine.length) lines.push(h('div', { class: 'muted small notes' }, `Your specimens: ${mine.map(x => `parcel ${x.parcel.id}, ${(x.dino.age_days / DATA.balance.dinosaur.days_per_year).toFixed(1)} y, hp ${Math.round(x.dino.health)}`).join('; ')}`));
  }
  return lines;
}
// "Prefers Marsh · tolerates Plains" (+ "must have it" for required species). Shown on every fact card and in the pen picker.
export function biomeLine(sp) {
  const b = speciesBiomes(sp);
  const names = ids => (ids || []).map(id => biomeById(id)?.name || id).join(' or ');
  return `Prefers ${names(b.preferred) || 'any land'}${(b.tolerated || []).length ? ` · tolerates ${names(b.tolerated)}` : ''}${speciesRequiresPreferred(sp) ? ' · must have its preferred land' : ''}`;
}
export function factCard(sp) {
  return h('div', { class: 'fact-card' },
    h('div', { class: 'fact-head' }, h('span', { class: 'dino-icon', style: `background:${sp.color}` }), h('b', {}, sp.name)),
    h('div', { class: 'muted' }, `${sp.era} · ${DIET_ICON[sp.diet] || ''} ${sp.diet.replace('_', ' ')} · ${sp.weight_lb.toLocaleString('en-US')} lb · needs ${fenceByTier(sp.min_fence_tier).name} fence or better`),
    h('div', { class: 'muted small biome-line', 'data-tip': 'biome' }, biomeLine(sp)),
    h('p', {}, sp.fact),
    fieldNotes(sp));
}

export function showFact(sp) {
  countView();
  const m = openModal({ title: `Fact: ${sp.name}`, body: h('div', {}, factCard(sp), h('div', { class: 'row end' }, h('button', { class: 'btn primary', on: { click: () => m.close() } }, 'Nice!'))) });
}

export function renderFactbook(root) {
  countView();
  const owned = speciesOwned();
  clear(root).append(h('div', { class: 'page' },
    h('h2', {}, 'Fact Book'),
    h('p', { class: 'muted' }, `Real paleontology for all ${DATA.dinosaurs.species.length} species in the market, grouped by price tier. Species you own are marked.`),
    h('p', { class: 'muted small' }, educationLevel() >= 2 ? `Visitor Center (${facilityTierDef('visitor_center').label}): field notes and your own specimens are shown on every card.` : educationLevel() >= 1 ? `Visitor Center (${facilityTierDef('visitor_center').label}): field notes unlocked. Upgrade it again to track your own specimens here.` : 'Build a Visitor Center (General Store → Upgrades) to unlock field notes and specimen records on these cards.'),
    speciesByTier().map(([tier, list]) => h('div', { class: 'tier-group' },
      h('h3', {}, `${tier[0].toUpperCase()}${tier.slice(1)} · ${fmt$(list[0].shop_price)} to ${fmt$(list[list.length - 1].shop_price)}`),
      h('div', { class: 'cards grid-5 facts' }, list.map(sp => h('div', { class: `card ${owned.has(sp.id) ? 'owned' : ''}` }, factCard(sp), owned.has(sp.id) ? h('div', { class: 'tag' }, 'In your park') : null)))))));
}
