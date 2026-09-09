// Fact Book view and the fact card shown after a purchase.
import { DATA, fenceByTier, speciesOwned, fmt$ } from '../state.js';
import { speciesByTier, DIET_ICON } from './stores.js';
import { h, clear } from './dom.js';
import { openModal } from './modals.js';

export function factCard(sp) {
  return h('div', { class: 'fact-card' },
    h('div', { class: 'fact-head' }, h('span', { class: 'dino-icon', style: `background:${sp.color}` }), h('b', {}, sp.name)),
    h('div', { class: 'muted' }, `${sp.era} · ${DIET_ICON[sp.diet] || ''} ${sp.diet.replace('_', ' ')} · ${sp.weight_lb.toLocaleString('en-US')} lb · needs ${fenceByTier(sp.min_fence_tier).name} fence or better`),
    h('p', {}, sp.fact));
}

export function showFact(sp) {
  const m = openModal({ title: `Fact: ${sp.name}`, body: h('div', {}, factCard(sp), h('div', { class: 'row end' }, h('button', { class: 'btn primary', on: { click: () => m.close() } }, 'Nice!'))) });
}

export function renderFactbook(root) {
  const owned = speciesOwned();
  clear(root).append(h('div', { class: 'page' },
    h('h2', {}, 'Fact Book'),
    h('p', { class: 'muted' }, `Real paleontology for all ${DATA.dinosaurs.species.length} species in the market, grouped by price tier. Species you own are marked.`),
    speciesByTier().map(([tier, list]) => h('div', { class: 'tier-group' },
      h('h3', {}, `${tier[0].toUpperCase()}${tier.slice(1)} · ${fmt$(list[0].shop_price)} to ${fmt$(list[list.length - 1].shop_price)}`),
      h('div', { class: 'cards grid-5 facts' }, list.map(sp => h('div', { class: `card ${owned.has(sp.id) ? 'owned' : ''}` }, factCard(sp), owned.has(sp.id) ? h('div', { class: 'tag' }, 'In your park') : null)))))));
}
