// localStorage save/load with a version stamp.
import { state, replaceState, SAVE_VERSION, log } from './state.js';

export const SAVE_KEY = 'dino-park-sim.save';

export function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, save_version: SAVE_VERSION, speed: 0 }));
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

export function autosave() {
  if (save()) log('Autosaved.');
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { return 'Storage is not available in this browser.'; }
  if (!raw) return 'No saved game found.';
  let data;
  try { data = JSON.parse(raw); } catch { return 'Saved game is corrupted.'; }
  if (data.save_version !== SAVE_VERSION) { discard(); return STALE_MESSAGE; }
  replaceState(data);
  return null;
}

export const STALE_MESSAGE = 'The park was re-surveyed: the old saved game used the previous park layout and cannot be loaded. Starting a new park.';

// Boot check: an old-layout save is dropped (with a friendly notice) instead of crashing on load. Returns true if one was discarded.
export function discardStaleSave() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { return false; }
  if (!raw) return false;
  let data = null;
  try { data = JSON.parse(raw); } catch { discard(); return true; }
  if (data && data.save_version === SAVE_VERSION) return false;
  discard();
  return true;
}
function discard() { try { localStorage.removeItem(SAVE_KEY); } catch { /* storage blocked */ } }
