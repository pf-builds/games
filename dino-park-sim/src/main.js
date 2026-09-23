// Entry point: load data, boot the shell, expose the debug API.
import { loadData, newGame, state, emitChange, log, parcelList, parcelDef, parcelGeometry, parcelSizeLabel, facilityTier, facilityById, updateSettings, speciesById, biomeFit, speciesBiomes, biomeById, modeId, modeIds, DATA, bus, replaceState, dataFiles, parcelDefs, campaignById, enclosures } from './state.js';
import { prizeSummary, addStoreSpend } from './prizes.js';
import { effectText } from './ui/effects.js';
import { advanceDays, setSpeed, bankState } from './time.js';
import { save, load, hasSave, discardStaleSave, STALE_MESSAGE, SAVE_KEY } from './save.js';
import { initTooltips } from './ui/tooltips.js';
import { initShell, refresh, tutorialHint, showView } from './ui/shell.js';
import { closeAll, alertModal, modalDepth, closeAbove } from './ui/modals.js';
import { agentCounts, spawnVisitors, forceEscape, arrivalStats, crowdStats, tick as agentTick, visitors, cars, dinos, staff, litter, slots } from './sim/agents.js';
import { livingStats, livingActive, plaqueVisible, labelRects, penLabelBoxes, penLabelStacks, spriteStatus } from './render/living.js';
import { campaignLadder, renderMarketingMenu } from './ui/marketing.js';
import { initAudio, play as playSfx, audioState, sfxIds } from './audio.js';
import { goalsList, buildReportCard, forceGoal, goalDone } from './goals.js';
import { juiceStats, reduceMotion, clearToasts, toastCount, shake } from './ui/effects.js';
import { openReportCard, openGoals } from './ui/goals.js';
import { openNewGame, modeSummary } from './ui/newgame.js';
import { buildDemoPark, showTitle, hideTitle } from './ui/title.js';
import { initProjection } from './render/projection.js';
import { buyParcel, upgradeFacility, parcelPrice, parcelPrices, parcelCapacity, perimeterSegments, spaceUsed, plantSeeds, vegetationCap, vegetationGrowth, seedsToPlant, setAutoRestock, foodDays, buyCampaign, marketingLadder, memberChurnRate, membershipConversion, relandscape, relandscapeCost, setPassPrice, buildFence, buyDino, fenceCost, toggleAutoRenew } from './economy.js';
import { breakoutChance } from './events.js';

function guardMinSize() {
  const app = document.getElementById('app');
  const s = Math.min(1, window.innerWidth / 1024, window.innerHeight / 640);
  if (s < 1) { app.style.transform = `scale(${s})`; app.style.width = `${100 / s}vw`; app.style.height = `${100 / s}vh`; }
  else { app.style.transform = ''; app.style.width = ''; app.style.height = ''; }
}

// "First launch" lives outside game state so a reload, New Game, or Restart does not bring the tutorial back.
const TUTORIAL_KEY = 'fossil-fortune.tutorial_seen';
function tutorialSeen() { try { return localStorage.getItem(TUTORIAL_KEY) === '1'; } catch { return false; } }
function markTutorialSeen() { try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* storage blocked: show it again next time */ } }

// Phase 2: the difficulty mode is picked in the New Game dialog (Settings, or the foreclosure screen) and is fixed
// for the run; a plain restart keeps the current park's mode.
function startNewGame(modeSel = modeId()) {
  closeAll();
  clearToasts();
  setSpeed(0);
  newGame(modeSel);
  if (hasSave()) log('A saved game exists. Load it from Settings.');
  showView('town');
  refresh();
  if (!tutorialSeen()) { markTutorialSeen(); tutorialHint(); }
}

// ---- DPS.selfTest() (phase 4 B1): a fast regression pass a critic or the player can run from the console ----
// Every test runs on a THROWAWAY park (quiet: no sound, no motion, no autosave) and the player's game is put back
// exactly: the live state object, clock speed, save slot, and any modals/toasts the tests opened. The last check
// compares the state JSON before and after. The Living Park crowd is rebuilt from state afterwards (agents are visual
// only, so it refills in a few seconds). Returns { pass, fail, ms, results: [{ name, ok, detail }] }.
const QUIET = { sfx: false, ambient: false, reduce_motion: true, autosave_days: 1e9 };
const finite = (...xs) => xs.every(Number.isFinite);
function selfTest() {
  const t0 = performance.now(), results = [];
  const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail: String(detail) }); return !!ok; };
  const run = (name, fn) => { try { fn(); } catch (e) { check(name, false, `threw: ${e.message}`); } };
  const quietGame = () => { newGame('standard'); Object.assign(state.settings, QUIET); };
  const live = state, liveJson = JSON.stringify(live), liveSpeed = live.speed, depth0 = modalDepth(), hadToasts = toastCount() > 0;
  let slot = null; try { slot = localStorage.getItem(SAVE_KEY); } catch { /* storage blocked */ }
  const Lv = DATA.balance.living, ST = Lv.selftest;
  setSpeed(0);
  try {
    run('boot', () => {
      const missing = dataFiles().filter(f => !DATA[f] || typeof DATA[f] !== 'object');
      check('boot: data files loaded', !missing.length, missing.length ? `missing ${missing.join(', ')}` : `${dataFiles().length} files`);
      const sp = spriteStatus(), ids = Object.keys(sp), by = k => ids.filter(id => sp[id] === k);
      check('boot: every species has a sprite or a flagged fallback', !by('loading').length, `${by('loaded').length}/${ids.length} loaded, fallback: ${by('fallback').join(', ') || 'none'}${by('loading').length ? `, still loading: ${by('loading').join(', ')}` : ''}`);
      check('boot: cash and debt are numbers', finite(live.cash, live.debt), `cash ${live.cash}, debt ${live.debt}`);
    });
    run('economy', () => {
      quietGame();
      const pd = [...parcelDefs()].sort((a, b) => a.tiles.length - b.tiles.length)[0];
      const cap = parcelCapacity(pd.id);
      const sp = [...DATA.dinosaurs.species].filter(s => s.space_required <= cap).sort((a, b) => a.shop_price - b.shop_price)[0];
      const biome = (speciesBiomes(sp).preferred || [])[0], tier = Math.max(1, sp.min_fence_tier || 0);
      const buy = (label, price, fn) => { const c0 = state.cash, err = fn(); check(`economy: ${label} costs its listed price`, !err && Math.abs(c0 - state.cash - price) < 1e-6, err || `${label} ${price}, cash moved ${c0 - state.cash}`); };
      buy(`parcel ${pd.id} (${biome})`, parcelPrice(pd.id, biome), () => buyParcel(pd.id, biome));
      buy(`fence tier ${tier}`, fenceCost(tier, pd.id), () => buildFence(pd.id, tier));
      buy(sp.name, sp.shop_price, () => buyDino(sp.id, pd.id));
      let report = null; const onQ = e => { report = e.detail; };
      bus.addEventListener('quarter', onQ);
      try { advanceDays(DATA.balance.time.days_per_quarter); } finally { bus.removeEventListener('quarter', onQ); }
      check('economy: advanceDays(90) closes a quarter report', !!report, report ? `day ${state.day}, ${state.history.length} quarter(s) in history` : 'no quarter event');
      check('economy: cash and debt stay numbers after a quarter', finite(state.cash, state.debt), `cash ${Math.round(state.cash)}, debt ${Math.round(state.debt)}`);
    });
    closeAbove(depth0);
    run('marketing', () => {
      // Regression for the 2026-09-21 bug: a running campaign hid its auto-renew toggle, so it could never be switched off.
      quietGame();
      const c = DATA.campaigns.campaigns.find(k => k.kind === 'boost' && !Object.keys(k.unlock || {}).length), id = c.id;
      const err = buyCampaign(id);
      check(`marketing: ${c.name} starts`, !err, err || `${c.days} days`);
      const card = [...campaignLadder().querySelectorAll('.card')].find(el => el.querySelector('.card-title')?.textContent.includes(c.name));
      const cardBtn = card && [...card.querySelectorAll('button')].find(b => b.textContent.startsWith('🔄'));
      if (check('marketing: running campaign shows its auto-renew toggle (Full Marketing)', cardBtn)) cardBtn.click();
      check('marketing: toggle turns auto-renew on', state.auto_renew[id] === true, `auto_renew.${id} = ${state.auto_renew[id]}`);
      const menuBtn = () => { const m = document.createElement('div'); renderMarketingMenu(m); return [...m.querySelectorAll('.mkt-row')].find(r => r.querySelector('.mkt-name')?.textContent === c.name)?.querySelector('button.mkt-auto'); };
      const off = menuBtn();
      if (check('marketing: running campaign shows its auto-renew toggle (dropdown)', off)) off.click();
      check('marketing: toggle turns auto-renew off', state.auto_renew[id] === false, `auto_renew.${id} = ${state.auto_renew[id]}`);
      advanceDays(c.days + 1);
      check('marketing: campaign does not renew once switched off', !state.campaigns.some(k => k.id === id), `${state.campaigns.filter(k => k.id === id).length} running`);
      buyCampaign(id); toggleAutoRenew(id); advanceDays(c.days + 1); // control: left on, it does renew
      check('marketing: control run with auto-renew on does renew', state.campaigns.some(k => k.id === id), `${state.campaigns.filter(k => k.id === id).length} running`);
    });
    closeAbove(depth0);
    run('living', () => {
      buildDemoPark({ settings: QUIET });
      state.today.attendance = Math.ceil(ST.crowd_visitors / Lv.sprites_per_visitor); state.speed = 1;
      spawnVisitors(ST.crowd_visitors - agentCounts().visitors);
      for (let i = 0; i < ST.living_ticks; i++) agentTick(true);
      const n = agentCounts(), penDinos = enclosures().reduce((k, p) => k + p.enclosure.dinos.length, 0);
      check('living: agent counts within balance.living caps', n.visitors <= Lv.max_sprites && n.litter <= Lv.litter_max && n.cars <= slots.length && n.staff === state.staff.length && n.dinos === penDinos,
        `visitors ${n.visitors}/${Lv.max_sprites}, cars ${n.cars}/${slots.length} slots, litter ${n.litter}/${Lv.litter_max}, staff ${n.staff}, dinos ${n.dinos}/${penDinos}`);
      let bad = 0;
      for (const list of [visitors, cars, dinos, staff]) for (const a of list) if ((a.active ?? true) && !finite(a.x, a.y, a.px, a.py)) bad++;
      check(`living: no NaN agent position after ${ST.living_ticks} ticks`, !bad, `${bad} bad of ${n.visitors + n.cars + n.dinos + n.staff}`);
    });
    run('crowd', () => {
      // Continues on the busy park above: warm up, then average the crowd metric over many frames.
      for (let i = 0; i < ST.crowd_warm_ticks; i++) agentTick(true);
      let cs = 0, sp = 0, off = 0, vis = 0, offAt = null;
      for (let f = 0; f < ST.crowd_frames; f++) {
        for (let i = 0; i < ST.crowd_every_ticks; i++) agentTick(true);
        const m = crowdStats(); cs += m.centre_share; sp += m.spine_centre_share; off += m.off_path; vis += m.visitors; if (m.off_path && !offAt) offAt = m.off_at;
      }
      cs /= ST.crowd_frames; sp /= ST.crowd_frames; vis /= ST.crowd_frames;
      check(`crowd: centre-line share <= ${Lv.crowd_centre_share_max}`, cs <= Lv.crowd_centre_share_max, `centre_share ${cs.toFixed(3)} (spine ${sp.toFixed(3)}), ~${Math.round(vis)} visitors, ${ST.crowd_frames} frames (pre-fix baseline ~0.49)`);
      check('crowd: nobody off the paving', off === 0, `${off} off-path samples${offAt ? `, e.g. ${JSON.stringify(offAt)} (state ids: agents.js V_*)` : ''}`);
    });
  } finally {
    closeAbove(depth0);
    if (!hadToasts) clearToasts();
    replaceState(live);
    try { if (slot == null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, slot); } catch { /* storage blocked */ }
    setSpeed(liveSpeed);
    refresh();
  }
  check('restore: live game unchanged', state === live && JSON.stringify(state) === liveJson, state === live ? 'same state, identical JSON' : 'state object replaced');
  const fail = results.filter(r => !r.ok).length;
  return { pass: results.length - fail, fail, ms: Math.round(performance.now() - t0), results };
}

async function boot() {
  window.addEventListener('resize', guardMinSize);
  guardMinSize();
  await loadData();
  initProjection();
  initTooltips();
  newGame();
  initAudio({ livingActive });
  initShell({ onNewGame: startNewGame });
  const stale = discardStaleSave();
  // Landing title: an animated, fully built demo park runs as the hero backdrop while the player
  // picks a difficulty (or continues a saved park). Selecting one founds the real game.
  const finishStale = () => { if (stale) { log('The park was re-surveyed: starting a new park (old save discarded).'); refresh(); alertModal('New park layout', STALE_MESSAGE); } };
  buildDemoPark();
  showView('park');
  setSpeed(0);
  showTitle({
    hasSave: hasSave(),
    onStart: modeSel => { hideTitle(); startNewGame(modeSel); finishStale(); },
    onContinue: () => { hideTitle(); const err = load(); if (err) { startNewGame(); log(err); finishStale(); } else { setSpeed(0); showView('town'); refresh(); } }
  });

  window.DPS = {
    get state() { return state; },
    advanceDays(n = 1) { advanceDays(n); return state.day; },
    addCash(n) { state.cash += n; emitChange(); return state.cash; },
    // Phase 2: DPS.newGame('classic') founds a park on that mode; no argument keeps the current mode. DPS.difficulty()
    // reports the run's mode with every parameter; DPS.openNewGame() opens the dialog; DPS.bank() the bank standing.
    newGame(modeSel) { startNewGame(modeSel); return state; },
    difficulty() { return modeSummary(modeId()); },
    difficulties() { return modeIds().map(modeSummary); },
    openNewGame() { return openNewGame({ onStart: startNewGame, cancelable: true }); },
    bank: bankState,
    save,
    load() { const err = load(); if (err) return err; setSpeed(0); refresh(); return true; },
    setSpeed,
    // M2.6 tile-set parcels + facilities
    parcels() {
      return parcelList().map(p => {
        const d = parcelDef(p.id), g = parcelGeometry(p.id);
        return {
          id: p.id, owned: p.owned, shape: parcelSizeLabel(p.id), tiles: d.tiles.length, outline_edges: perimeterSegments(p.id),
          biome: p.biome, price: parcelPrice(p.id), prices: parcelPrices(p.id), capacity: parcelCapacity(p.id),
          used: p.enclosure ? spaceUsed(p.enclosure) : 0, fence_tier: p.enclosure?.fence_tier ?? 0,
          condition: p.enclosure?.condition ?? null, dinos: p.enclosure?.dinos.length ?? 0,
          vegetation: p.enclosure ? Math.round((p.enclosure.vegetation || 0) * 10) / 10 : 0, vegetation_cap: vegetationCap(p.id), seeded: p.enclosure?.seeded ?? 0, seeds_to_plant: seedsToPlant(p.id), growth_per_day: p.enclosure ? Math.round(vegetationGrowth(p) * 100) / 100 : 0,
          breakout_per_day: p.enclosure ? breakoutChance(p.id) : 0, label_tile: g.label, front_tile: g.front
        };
      });
    },
    // Current per-day breakout chance for one enclosure (data/fences.json breakout rules).
    breakoutChance(parcelId) { return breakoutChance(parcelId); },
    // M4: land type is chosen at purchase (desert | plains | marsh); relandscape changes it later.
    buyParcel(id, biome) { const err = buyParcel(id, biome); emitChange(); return err || true; },
    relandscape(id, biome) { const err = relandscape(id, biome); emitChange(); return err || { parcel: id, biome: state.parcels[id].biome }; },
    relandscapeCost,
    // M4: species <-> pen biome fit: { fit: preferred|tolerated|wrong|none, required, preferred, tolerated, pen_biome }
    biomeFit(speciesId, parcelId) {
      const sp = speciesById(speciesId);
      if (!sp) return `No such species: ${speciesId}`;
      const p = state.parcels[parcelId];
      if (!p) return `No such parcel: ${parcelId}`;
      const b = speciesBiomes(sp);
      return { fit: biomeFit(sp, p.biome), required: !!b.requires_preferred, preferred: [...(b.preferred || [])], tolerated: [...(b.tolerated || [])], pen_biome: p.biome, pen_biome_name: biomeById(p.biome)?.name || null };
    },
    // M4: seeds -> vegetation
    plantSeeds(parcelId, n) { const err = plantSeeds(parcelId, n); emitChange(); const e = state.parcels[parcelId]?.enclosure; return err || { parcel: parcelId, seeded: e.seeded, seeds_to_plant: seedsToPlant(parcelId), vegetation: e.vegetation, cap: vegetationCap(parcelId), growth_per_day: vegetationGrowth(state.parcels[parcelId]) }; },
    // M4: auto-restock rule per food: DPS.autoRestock({ food: 'plants', on: true, threshold_days: 5, amount: 50 }); no arg = current rules + days left
    autoRestock(rule) {
      if (rule) { const err = setAutoRestock(rule.food, rule); emitChange(); if (err) return err; }
      return { rules: JSON.parse(JSON.stringify(state.auto_restock)), days: foodDays().map(r => ({ food: r.food.id, need: r.need, stock: r.stock, days: r.days === Infinity ? null : Math.round(r.days * 10) / 10 })) };
    },
    // M4: marketing ladder. DPS.campaign() lists it with lock reasons; DPS.campaign(id) buys one.
    campaign(id) {
      if (!id) return marketingLadder().map(r => ({ id: r.def.id, name: r.def.name, kind: r.def.kind, cost: r.def.cost, days: r.def.days, boost: r.def.boost ?? null, floor: r.def.floor ?? null, lock: r.lock, owned: r.owned, active: r.active.map(a => ({ days_left: a.days_left })) }));
      const err = buyCampaign(id); emitChange();
      return err || { id, active: state.campaigns.filter(c => c.id === id).map(c => ({ days_left: c.days_left })), perks: { ...state.perks }, members_active: state.members.active };
    },
    members(passPrice) { if (passPrice != null) { setPassPrice(passPrice); emitChange(); } const m = state.members; return { ...m, churn_rate_now: memberChurnRate(), conversion: membershipConversion() }; },
    upgrade(facilityId) { const err = upgradeFacility(facilityId); emitChange(); return err || { facility: facilityId, tier: facilityTier(facilityId), label: facilityById(facilityId).tiers[facilityTier(facilityId)].label }; },
    facilities() { return { ...state.facilities }; },
    // M3: facility ladder (every tier with cost, upkeep, effects, render), current + next
    facilityLadder(id) {
      const f = facilityById(id);
      if (!f) return `No such facility: ${id}`;
      const tier = facilityTier(id);
      return { id, name: f.name, effect_key: f.effect_key, current: tier, next: f.tiers.find(t => t.tier === tier + 1)?.tier ?? null, tiers: f.tiers.map(t => ({ tier: t.tier, label: t.label, cost: t.cost, upkeep: t.upkeep_per_quarter, effects: { ...t.effects }, effect_text: effectText(f, t), render: { ...t.render }, current: t.tier === tier })) };
    },
    // M3: park prizes (earned + next threshold) and a test hook that adds General Store spend without buying anything
    prizes() { return prizeSummary(); },
    spend(n) { const won = addStoreSpend(Number(n) || 0); emitChange(); return { store_spend: state.store_spend, awarded: won.map(p => p.id) }; },
    // M3: settings (day length, autosave cadence, sound). Call with a patch to change them live: DPS.settings({ day_seconds: 2 })
    settings(patch) { if (patch) return updateSettings(patch); return { ...state.settings }; },
    digest() { return state.digest.slice(); },
    // Living Park hooks so critics can drive the scene (visual only, economy untouched).
    // M5 minor (Phase 2): forceEscape also sounds the siren and shakes the screen, exactly like a real breakout.
    living: { agents: agentCounts, spawnVisitors, forceEscape(parcelId, uid) { const ok = forceEscape(parcelId, uid); if (ok) { playSfx('escape_siren'); shake(); } return ok; }, stats: livingStats, active: livingActive, plaque: plaqueVisible, labels: labelRects, penLabelBoxes, penLabelStacks, arrivals: arrivalStats, crowd: crowdStats },
    // M5 sound: DPS.sfx(id) plays one effect (ignores the per-id throttle, obeys the SFX toggle, master volume and
    // the first-gesture lock); DPS.sfx() lists the ids. DPS.audioState() reports locked/unlocked + settings + recent plays.
    sfx(id) { if (!id) return sfxIds(); return playSfx(id, { force: true }); },
    audioState,
    // M5 juice counters (floaters, shakes, pulses, toasts, presses) and the effective reduce-motion flag.
    juice() { return { ...juiceStats(), toasts_visible: toastCount() }; },
    reduceMotion,
    // M5 end-game: the ladder with live progress, the stored Year-5 Report Card (or a live preview), a test hook that
    // drives a goal's conditions, and openers for the two modals.
    goals() { return goalsList(); },
    reportCard() { return state.report_card ? { ...state.report_card, preview: false } : { ...buildReportCard(), preview: true }; },
    forceGoal(id) { const r = forceGoal(id); emitChange(); return r; },
    goalDone,
    openGoals, openReportCard: () => openReportCard(),
    // Phase 4 B1: regression pass on throwaway parks; the player's game is restored afterwards.
    selfTest
  };
  console.log('Fossil Fortune loaded');
}

boot().catch(err => {
  console.error(err);
  document.getElementById('ticker-text').textContent = `Failed to start: ${err.message}`;
});
