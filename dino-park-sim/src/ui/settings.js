// Settings: save / load / new game, difficulty (Standard only), sound toggle.
import { DATA, state, emitChange } from '../state.js';
import { save, load, hasSave } from '../save.js';
import { setSpeed } from '../time.js';
import { h, clear, button } from './dom.js';
import { alertModal, confirmModal } from './modals.js';

export function renderSettings(root, { startNewGame, showTutorial }) {
  const status = h('p', { class: 'muted' }, hasSave() ? 'A saved game exists in this browser.' : 'No saved game yet.');
  clear(root).append(h('div', { class: 'page narrow' },
    h('h2', {}, 'Settings'),
    h('div', { class: 'panel' },
    h('h3', {}, 'Game'),
    h('div', { class: 'row wrap' },
      button('Save', () => { const ok = save(); status.textContent = ok ? 'Saved.' : 'Save failed.'; alertModal('Save', ok ? 'Game saved to this browser.' : 'Save failed. Check that this browser allows local storage.'); }, { class: 'btn primary' }),
      button('Load', () => { const err = load(); if (err) { alertModal('Load', err); status.textContent = hasSave() ? 'A saved game exists in this browser.' : 'No saved game yet.'; } else { setSpeed(0); alertModal('Load', 'Saved game loaded.'); } }),
      button('New Game', async () => { if (await confirmModal('New Game', h('p', {}, 'Start over on Standard? Unsaved progress is lost.'), 'Start over')) startNewGame(); })),
    status),
    h('div', { class: 'panel' },
    h('h3', {}, 'Difficulty'),
    h('div', { class: 'cards grid-3' }, Object.entries(DATA.difficulty.modes).map(([id, m]) => h('div', { class: `card ${m.enabled ? '' : 'disabled'} ${state.mode === id ? 'selected' : ''}` },
      h('div', { class: 'card-title' }, m.name, m.enabled ? '' : ' (soon)'),
      h('p', { class: 'muted' }, m.blurb))))),
    h('div', { class: 'panel' },
    h('h3', {}, 'Sound'),
    h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: state.settings.sound, on: { change: e => { state.settings.sound = e.target.checked; emitChange(); } } }), ' Sound effects (none shipped yet)')),
    h('div', { class: 'panel' },
    h('h3', {}, 'Keys'),
    h('p', { class: 'muted' }, 'Space pauses and resumes. Esc closes the top window. F toggles fullscreen. Hover any dotted-underlined word for a plain-language explanation.'),
    button('Show the welcome tips again', showTutorial))));
}
