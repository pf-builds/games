// Park canvas sizing, shared by the Living Park and the Buy Land grid (both draw on #park).
//
// Approach: the scene is authored at a logical 960x540 (living view) / 640x360 (grid view, same
// 16:9, drawn through a transform). The CSS box is scaled to fit the main area and the backing
// store is CSS box x devicePixelRatio, so every shape and glyph is rasterised at device resolution
// (crisp on retina, nothing is bitmap-upscaled). Scale snaps to 0.5 steps (1, 1.5, 2 ...) when the
// snapped canvas still covers >= balance.living.fill_min_fraction of the main area; when snapping
// would leave a large empty frame (e.g. 1920x1080 lands between 1.5 and 2) the exact fit is used
// instead so the park always fills the browser. Vector placeholder art is crisp at any scale; the
// only cost of a non-half step is the 8px pixel font softening slightly, which the fill wins over.

import { DATA } from '../state.js';
import { BASE_W, BASE_H } from './projection.js';

let canvas = null;
let scale = 1;
const listeners = [];

export function initViewport(el) {
  canvas = el;
  window.addEventListener('resize', fitCanvas);
  fitCanvas();
}

export function onFit(fn) { listeners.push(fn); }
export const getScale = () => scale;

export function fitCanvas() {
  if (!canvas) return;
  const main = document.getElementById('main');
  const bar = document.getElementById('park-bar');
  const pad = Math.ceil(2 * parseFloat(getComputedStyle(main.querySelector('.park-view')).paddingTop) || 8);
  const gap = Math.ceil(parseFloat(getComputedStyle(main.querySelector('.park-view')).rowGap) || 4);
  if (bar) bar.style.width = ''; // measure the bar at full width so a previous (narrower) fit cannot wrap it taller
  const availW = Math.max(1, main.clientWidth - pad);
  const availH = Math.max(1, main.clientHeight - (bar ? bar.offsetHeight : 0) - pad - gap);
  const exact = Math.min(availW / BASE_W, availH / BASE_H);
  const snapped = Math.max(0.5, Math.floor(exact * 2) / 2);
  const minFill = DATA.balance.living?.fill_min_fraction ?? 0.8;
  // Fill is judged against the whole main area (bar and padding included) so the snap never leaves a frame.
  const fill = (snapped * BASE_W * snapped * BASE_H) / (main.clientWidth * main.clientHeight);
  scale = fill >= minFill ? snapped : exact;
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.floor(BASE_W * scale), cssH = Math.floor(BASE_H * scale);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  if (bar) bar.style.width = canvas.style.width; // toolbar strip lines up with the canvas
  for (const fn of listeners) fn();
}
