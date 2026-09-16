// Settings: save / load / new game, difficulty (Phase 2: the New Game dialog picks Relaxed / Standard / Classic), sound.
import { DATA, state, emitChange, updateSettings, modeIds, modeId, modeDef } from '../state.js';
import { openNewGame, modeChip, modeFacts } from './newgame.js';
import { save, load, hasSave } from '../save.js';
import { setSpeed } from '../time.js';
import { h, clear, button, term } from './dom.js';
import { alertModal } from './modals.js';
import { autoRestockPanel, autoRestockAllButton } from './food.js';
import { play as playSfx, audioState } from '../audio.js';
import { reduceMotion } from './effects.js';

export function renderSettings(root, { startNewGame, showTutorial }) {
  const status = h('p', { class: 'muted' }, hasSave() ? 'A saved game exists in this browser.' : 'No saved game yet.');
  clear(root).append(h('div', { class: 'page' },
    h('h2', {}, 'Settings'),
    h('div', { class: 'settings-grid' },
    h('div', { class: 'panel' },
    h('h3', {}, 'Game'),
    h('div', { class: 'row wrap' },
      button('Save', () => { const ok = save(); status.textContent = ok ? 'Saved.' : 'Save failed.'; alertModal('Save', ok ? 'Game saved to this browser.' : 'Save failed. Check that this browser allows local storage.'); }, { class: 'btn primary' }),
      button('Load', () => { const err = load(); if (err) { alertModal('Load', err); status.textContent = hasSave() ? 'A saved game exists in this browser.' : 'No saved game yet.'; } else { setSpeed(0); alertModal('Load', 'Saved game loaded.'); } }),
      button('New Game…', () => openNewGame({ onStart: startNewGame, cancelable: true }), { title: 'Pick a difficulty and start a new park' })),
    status),
    h('div', { class: 'panel span' },
    h('h3', {}, term('difficulty', 'Difficulty'), ' ', modeChip(modeId(), { badge: true })),
    h('p', { class: 'muted small' }, `This park runs on ${modeDef(modeId()).name}. The mode is fixed for the run; New Game… founds a park on another one.`),
    h('div', { class: 'cards grid-3 mode-cards' }, modeIds().map(id => { const m = modeDef(id); return h('div', { class: `card mode-card mode-card-${id} ${m.enabled === false ? 'disabled' : ''} ${modeId() === id ? 'selected' : ''}` },
      h('div', { class: 'card-title' }, modeChip(id, { badge: true }), modeId() === id ? h('span', { class: 'muted small' }, ' (this park)') : null),
      h('div', { class: 'mode-feel' }, m.feel || ''),
      h('p', { class: 'muted small' }, m.blurb),
      h('table', { class: 'table kv mode-facts' }, modeFacts(id).map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v))))); }))),
    h('div', { class: 'panel' },
    h('h3', {}, 'Speed & timing'),
    settingSlider('Day length at normal speed', 'day_seconds', DATA.balance.living.day_seconds_min ?? 2, DATA.balance.living.day_seconds_max ?? 20, 0.5, v => `${v} s per day`, `3× and 10× stay proportional. Default ${DATA.balance.living.day_seconds} s.`),
    settingSlider('Autosave every', 'autosave_days', DATA.balance.save?.autosave_days_min ?? 10, DATA.balance.save?.autosave_days_max ?? 90, 1, v => `${v} days`, `Default ${DATA.balance.save?.autosave_days ?? 90} days (one quarter). Manual Save above works any time.`)),
    h('div', { class: 'panel' },
    h('h3', {}, term('auto_restock', 'Auto-restock')),
    autoRestockPanel(),
    h('div', { class: 'row' }, autoRestockAllButton(), h('span', { class: 'muted small' }, 'Also in the General Store → Food. Charged to the food line; every buy is logged.'))),
    h('div', { class: 'panel' },
    h('h3', {}, 'Sound'),
    settingSlider('Master volume', 'master_volume', 0, 1, 0.05, v => `${Math.round(v * 100)}%`, 'Every sound is synthesized in the game (no audio files). Nothing plays until you have clicked or pressed a key once.'),
    h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: state.settings.sfx, on: { change: e => { updateSettings({ sfx: e.target.checked }); emitChange(); } } }), ' Sound effects (clicks, cash register, roars, alerts, fanfares)'),
    h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: state.settings.ambient, on: { change: e => { updateSettings({ ambient: e.target.checked }); emitChange(); } } }), ' Ambient park sounds (soft pad and birds)'),
    h('div', { class: 'row wrap' }, button('Test: cash register', () => playSfx('buy', { force: true })), button('Test: roar', () => playSfx('roar_large', { force: true })), button('Test: fanfare', () => playSfx('milestone_fanfare', { force: true })), h('span', { class: 'muted small' }, audioState().unlocked ? 'Audio is unlocked.' : 'Audio unlocks on your first click.'))),
    h('div', { class: 'panel' },
    h('h3', {}, 'Motion'),
    h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: state.settings.reduce_motion, on: { change: e => { updateSettings({ reduce_motion: e.target.checked }); emitChange(); } } }), ' ', term('reduce_motion', 'Reduce motion'), ' (no shakes, floating numbers, slides or delivery truck; everything appears in place)'),
    h('p', { class: 'muted small' }, reduceMotion() && !state.settings.reduce_motion ? 'Your system asks for reduced motion, so animations are already off.' : 'Also honours the operating system\'s "reduce motion" preference.')),
    h('div', { class: 'panel' },
    h('h3', {}, 'Keys'),
    h('p', { class: 'muted' }, 'Space pauses and resumes. Esc closes the top window. F toggles fullscreen. Hover any dotted-underlined word for a plain-language explanation.'),
    button('Show the welcome tips again', showTutorial)))));
}

// A labelled range control bound to one settings key; applies live and persists as a preference.
function settingSlider(labelText, key, min, max, step, fmt, note) {
  const readout = h('span', { class: 'price-readout small-readout' }, fmt(state.settings[key]));
  const slider = h('input', { type: 'range', min, max, step, value: state.settings[key], class: 'slider' });
  slider.addEventListener('input', () => { const s = updateSettings({ [key]: Number(slider.value) }); readout.textContent = fmt(s[key]); });
  return h('div', { class: 'setting-row' },
    h('div', { class: 'price-row' }, h('span', {}, labelText), readout),
    h('div', { class: 'row slider-row' }, h('span', { class: 'muted' }, fmt(min)), slider, h('span', { class: 'muted' }, fmt(max))),
    h('p', { class: 'muted small' }, note));
}
