// Entry point: load data, boot the shell, expose the debug API.
import { loadData, newGame, state, emitChange, log, parcelList, parcelDef, parcelGeometry, parcelSizeLabel, facilityTier, facilityById } from './state.js';
import { advanceDays, setSpeed } from './time.js';
import { save, load, hasSave, discardStaleSave, STALE_MESSAGE } from './save.js';
import { initTooltips } from './ui/tooltips.js';
import { initShell, refresh, tutorialHint, showView } from './ui/shell.js';
import { closeAll, alertModal } from './ui/modals.js';
import { agentCounts, spawnVisitors, forceEscape } from './sim/agents.js';
import { livingStats } from './render/living.js';
import { initProjection } from './render/projection.js';
import { buyParcel, upgradeFacility, parcelPrice, parcelCapacity, perimeterSegments, spaceUsed } from './economy.js';
import { breakoutChance } from './events.js';

function guardMinSize() {
  const app = document.getElementById('app');
  const s = Math.min(1, window.innerWidth / 1024, window.innerHeight / 640);
  if (s < 1) { app.style.transform = `scale(${s})`; app.style.width = `${100 / s}vw`; app.style.height = `${100 / s}vh`; }
  else { app.style.transform = ''; app.style.width = ''; app.style.height = ''; }
}

// "First launch" lives outside game state so a reload, New Game, or Restart does not bring the tutorial back.
const TUTORIAL_KEY = 'dino-park-sim.tutorial_seen';
function tutorialSeen() { try { return localStorage.getItem(TUTORIAL_KEY) === '1'; } catch { return false; } }
function markTutorialSeen() { try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* storage blocked: show it again next time */ } }

function startNewGame() {
  closeAll();
  setSpeed(0);
  newGame();
  if (hasSave()) log('A saved game exists. Load it from Settings.');
  showView('town');
  refresh();
  if (!tutorialSeen()) { markTutorialSeen(); tutorialHint(); }
}

async function boot() {
  window.addEventListener('resize', guardMinSize);
  guardMinSize();
  await loadData();
  initProjection();
  initTooltips();
  newGame();
  initShell({ onNewGame: startNewGame });
  const stale = discardStaleSave();
  startNewGame();
  if (stale) { log('The park was re-surveyed: starting a new park (old save discarded).'); refresh(); alertModal('New park layout', STALE_MESSAGE); }

  window.DPS = {
    get state() { return state; },
    advanceDays(n = 1) { advanceDays(n); return state.day; },
    addCash(n) { state.cash += n; emitChange(); return state.cash; },
    newGame() { startNewGame(); return state; },
    save,
    load() { const err = load(); if (err) return err; setSpeed(0); refresh(); return true; },
    setSpeed,
    // M2.6 tile-set parcels + facilities
    parcels() {
      return parcelList().map(p => {
        const d = parcelDef(p.id), g = parcelGeometry(p.id);
        return {
          id: p.id, owned: p.owned, shape: parcelSizeLabel(p.id), tiles: d.tiles.length, outline_edges: perimeterSegments(p.id),
          biome: d.biome, price: parcelPrice(p.id), capacity: parcelCapacity(p.id),
          used: p.enclosure ? spaceUsed(p.enclosure) : 0, fence_tier: p.enclosure?.fence_tier ?? 0,
          condition: p.enclosure?.condition ?? null, dinos: p.enclosure?.dinos.length ?? 0,
          breakout_per_day: p.enclosure ? breakoutChance(p.id) : 0, label_tile: g.label, front_tile: g.front
        };
      });
    },
    // Current per-day breakout chance for one enclosure (data/fences.json breakout rules).
    breakoutChance(parcelId) { return breakoutChance(parcelId); },
    buyParcel(id) { const err = buyParcel(id); emitChange(); return err || true; },
    upgrade(facilityId) { const err = upgradeFacility(facilityId); emitChange(); return err || { facility: facilityId, tier: facilityTier(facilityId), label: facilityById(facilityId).tiers[facilityTier(facilityId)].label }; },
    facilities() { return { ...state.facilities }; },
    digest() { return state.digest.slice(); },
    // Living Park hooks so critics can drive the scene (visual only, economy untouched).
    living: { agents: agentCounts, spawnVisitors, forceEscape, stats: livingStats }
  };
  console.log('Dino Park Sim loaded');
}

boot().catch(err => {
  console.error(err);
  document.getElementById('ticker-text').textContent = `Failed to start: ${err.message}`;
});
