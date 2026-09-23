// Title / landing screen: the Living Park runs full-screen as an animated hero backdrop (a fully
// built demo park), with the game logo and difficulty selection over it. Picking a difficulty (or
// Continue) tears the title down and hands off to the real game.
import { DATA, state, newGame, parcelDefs, speciesById, emitChange, modeIds } from '../state.js';
import { buyParcel, buildFence, buyDino, plantSeeds, seedsToPlant, hire, upgradeFacility, buyCampaign, setPassPrice } from '../economy.js';
import { spawnVisitors } from '../sim/agents.js';
import { setTitleMode } from '../render/living.js';
import { modeSummary } from './newgame.js';
import { h, button } from './dom.js';

// Curated showcase: [species id, its preferred/valid biome], roughly small -> large so the smallest
// parcels get the smallest animals. Every marquee that requires a preferred biome gets it here.
const SHOWCASE = [
  ['lesothosaurus', 'desert'], ['psittacosaurus', 'desert'], ['dryosaurus', 'plains'], ['hypsilophodon', 'plains'],
  ['coelophysis', 'desert'], ['velociraptor', 'desert'], ['protoceratops', 'desert'], ['deinonychus', 'plains'],
  ['dilophosaurus', 'desert'], ['camptosaurus', 'plains'], ['pachycephalosaurus', 'plains'], ['hadrosaurus', 'marsh'],
  ['allosaurus', 'plains'], ['baryonyx', 'marsh'], ['stegosaurus', 'plains'], ['ankylosaurus', 'plains'],
  ['iguanodon', 'marsh'], ['styracosaurus', 'plains'], ['parasaurolophus', 'marsh'], ['triceratops', 'plains'],
  ['spinosaurus', 'marsh'], ['tyrannosaurus', 'plains'], ['brachiosaurus', 'plains'], ['apatosaurus', 'plains']
];

// Build a full, lively demo park into the global state (transient: a real New Game overwrites it).
// No day-ticks are run, so no quarter/event popups fire; the crowd fills from state.today.attendance.
// opts.settings patches the new park's settings before anything is bought (DPS.selfTest: no sound, motion or autosave).
export function buildDemoPark(opts = {}) {
  newGame('standard');
  if (opts.settings) Object.assign(state.settings, opts.settings);
  state.cash = 50000000;
  const spc = DATA.balance.parcel.space_per_tile;
  const defs = [...parcelDefs()].sort((a, b) => a.tiles.length - b.tiles.length);
  let ri = 0;
  for (const pd of defs) {
    const cap = pd.tiles.length * spc;
    let chosen = null;
    for (let t = 0; t < SHOWCASE.length; t++) {
      const [sid, biome] = SHOWCASE[(ri + t) % SHOWCASE.length];
      const sp = speciesById(sid);
      if (sp && sp.space_required <= cap) { chosen = [sid, biome, sp]; ri = (ri + t + 1) % SHOWCASE.length; break; }
    }
    if (!chosen) continue;
    const [sid, biome, sp] = chosen;
    if (buyParcel(pd.id, biome)) continue;
    buildFence(pd.id, Math.max(1, sp.min_fence_tier));
    const want = Math.min(3, Math.max(1, Math.floor(cap / sp.space_required)));
    for (let i = 0; i < want; i++) if (buyDino(sid, pd.id)) break;
    try { plantSeeds(pd.id, seedsToPlant(pd.id)); } catch { /* ignore */ }
  }
  for (const f of ['parking_lot', 'food_stand', 'gift_shop', 'restrooms', 'visitor_center', 'park_tram', 'office', 'vet_clinic'])
    for (let t = 0; t < 3; t++) upgradeFacility(f);
  for (const r of ['tour_guide', 'tour_guide', 'maintenance', 'maintenance', 'veterinary', 'concessions', 'concessions', 'security', 'management']) hire(r);
  state.ticket_price = 6;
  try { setPassPrice(60); buyCampaign('memberships'); buyCampaign('tv_spot'); } catch { /* ignore */ }
  state.today.attendance = 320; // the living render loop keeps a crowd this size
  emitChange();
  spawnVisitors(120);
}

let overlay = null;
export function titleOpen() { return !!overlay; }

export function showTitle({ onStart, onContinue, hasSave }) {
  setTitleMode(true);
  document.getElementById('app').classList.add('title-mode');
  overlay = h('div', { id: 'title-screen' },
    h('div', { class: 'title-vignette' }),
    h('div', { class: 'title-head' },
      h('h1', { class: 'title-logo' }, h('span', { class: 'title-word-1' }, 'FOSSIL'), h('span', { class: 'title-word-2' }, 'FORTUNE')),
      h('p', { class: 'title-tag' }, 'Build a dinosaur park worth a fortune.')),
    h('div', { class: 'title-panel' },
      h('div', { class: 'title-panel-label' }, 'Choose a difficulty to begin'),
      h('div', { class: 'title-modes' }, modeIds().map(id => modeButton(id, onStart))),
      hasSave ? button('Continue saved park', () => onContinue(), { class: 'title-continue' }) : null));
  document.getElementById('app').append(overlay);
  window.dispatchEvent(new Event('resize')); // re-fit the canvas to the now full-bleed main area
}

function modeButton(id, onStart) {
  const s = modeSummary(id);
  return h('button', { class: `title-diff mode-${id}${s.enabled === false ? ' disabled' : ''}`, disabled: s.enabled === false, on: { click: () => onStart(id) } },
    h('span', { class: 'title-diff-name' }, s.name),
    h('span', { class: 'title-diff-feel' }, s.feel || ''),
    h('span', { class: 'title-diff-blurb' }, s.blurb || ''));
}

export function hideTitle() {
  setTitleMode(false);
  document.getElementById('app').classList.remove('title-mode');
  if (overlay) { overlay.remove(); overlay = null; }
  window.dispatchEvent(new Event('resize')); // re-fit the canvas back to the framed park view
}
