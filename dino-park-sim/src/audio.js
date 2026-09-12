// M5 sound. Everything is synthesized in code with Web Audio: no audio files, nothing fetched. Each effect in
// data/sfx.json is a parameter set for the classic sfxr model (wave, envelope, frequency slide, vibrato, arpeggio,
// duty, repeat, phaser, low-pass / high-pass) rendered once into an AudioBuffer and cached; a `sequence` entry is
// several notes laid on one buffer (fanfares, chimes). The optional ambient bed is a soft oscillator pad through a
// low-pass with a slow gain LFO plus sparse synthesized bird chirps.
//
// Nothing plays before the first user gesture: the AudioContext is created inside the first click / keydown, and
// play() refuses until then. Triggers arrive on the state bus ('sfx', 'escape', 'quarter', 'prize', 'goal', 'lose',
// 'report_card') so the economy never imports this module; the purchase roar is timed by sim/agents.js (crate
// reveal); every button click plays ui_click unless the click's own handler already played something. Settings (state.settings): sfx on/off, ambient on/off, master_volume.
import { DATA, state, bus, onChange } from './state.js';

let ctx = null, master = null, sfxGain = null, ambientGain = null;
let unlocked = false;
const buffers = new Map();
const lastPlay = new Map();
const plays = [];
let lastAnyPlay = -Infinity, blocked = 0;
const ambient = { nodes: null, chirpTimer: 0 };

const cfg = () => DATA.sfx || { sfx: {}, sample_rate: 44100, master_gain: 0.9, ambient: null };
const settings = () => (state && state.settings) || {};
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ---- the sfxr parameter model ----
const WAVES = { square: 0, saw: 1, sine: 2, noise: 3, triangle: 4 };
const DEFAULTS = {
  wave: 'square', attack: 0, sustain: 0.3, punch: 0, decay: 0.4,
  freq: 0.3, freq_limit: 0, slide: 0, dslide: 0,
  vib_strength: 0, vib_speed: 0, arp_mod: 0, arp_speed: 0,
  duty: 0, duty_ramp: 0, repeat_speed: 0, pha_offset: 0, pha_ramp: 0,
  lpf_freq: 1, lpf_ramp: 0, lpf_resonance: 0, hpf_freq: 0, hpf_ramp: 0,
  volume: 0.5
};
const MAX_SAMPLES = 44100 * 4;

// Renders one sfxr note to a Float32Array (44.1k-style sample units: envelope lengths are in samples, the
// oscillator is supersampled 8x, filters and phaser run per supersample). Peak-normalized, then scaled by `volume`.
export function synth(params) {
  const P = { ...DEFAULTS, ...params };
  const wave = WAVES[P.wave] ?? 0;
  let fperiod = 0, fmaxperiod = 0, fslide = 0, fdslide = 0, period = 0, squareDuty = 0, squareSlide = 0, arpMod = 0, arpTime = 0, arpLimit = 0;
  const reset = () => {
    fperiod = 100 / (P.freq * P.freq + 0.001);
    period = Math.floor(fperiod);
    fmaxperiod = 100 / (P.freq_limit * P.freq_limit + 0.001);
    fslide = 1 - Math.pow(P.slide, 3) * 0.01;
    fdslide = -Math.pow(P.dslide, 3) * 0.000001;
    squareDuty = 0.5 - P.duty * 0.5;
    squareSlide = -P.duty_ramp * 0.00005;
    arpMod = P.arp_mod >= 0 ? 1 - Math.pow(P.arp_mod, 2) * 0.9 : 1 + Math.pow(P.arp_mod, 2) * 10;
    arpTime = 0;
    arpLimit = P.arp_speed >= 1 ? 0 : Math.floor(Math.pow(1 - P.arp_speed, 2) * 20000 + 32);
  };
  reset();
  let fltp = 0, fltdp = 0, fltw = Math.pow(P.lpf_freq, 3) * 0.1;
  const fltwD = 1 + P.lpf_ramp * 0.0001;
  let fltdmp = 5 / (1 + Math.pow(P.lpf_resonance, 2) * 20) * (0.01 + fltw);
  if (fltdmp > 0.8) fltdmp = 0.8;
  let fltphp = 0, flthp = Math.pow(P.hpf_freq, 2) * 0.1;
  const flthpD = 1 + P.hpf_ramp * 0.0003;
  let vibPhase = 0;
  const vibSpeed = Math.pow(P.vib_speed, 2) * 0.01, vibAmp = P.vib_strength * 0.5;
  let envVol = 0, envStage = 0, envTime = 0;
  const envLen = [Math.floor(P.attack * P.attack * 100000), Math.floor(P.sustain * P.sustain * 100000), Math.floor(P.decay * P.decay * 100000)];
  let fphase = Math.pow(P.pha_offset, 2) * 1020 * (P.pha_offset < 0 ? -1 : 1);
  const fdphase = Math.pow(P.pha_ramp, 2) * (P.pha_ramp < 0 ? -1 : 1);
  let iphase = Math.abs(Math.floor(fphase)), ipp = 0;
  const phaser = new Float32Array(1024);
  const noise = new Float32Array(32);
  for (let i = 0; i < 32; i++) noise[i] = Math.random() * 2 - 1;
  let repTime = 0;
  const repLimit = P.repeat_speed <= 0 ? 0 : Math.floor(Math.pow(1 - P.repeat_speed, 2) * 20000 + 32);
  const total = Math.min(MAX_SAMPLES, envLen[0] + envLen[1] + envLen[2] + 2);
  const buf = new Float32Array(total);
  let n = 0, phase = 0;
  for (; n < total; n++) {
    repTime++;
    if (repLimit !== 0 && repTime >= repLimit) { repTime = 0; reset(); }
    arpTime++;
    if (arpLimit !== 0 && arpTime >= arpLimit) { arpLimit = 0; fperiod *= arpMod; }
    fslide += fdslide;
    fperiod *= fslide;
    if (fperiod > fmaxperiod) { fperiod = fmaxperiod; if (P.freq_limit > 0) break; }
    let rfperiod = fperiod;
    if (vibAmp > 0) { vibPhase += vibSpeed; rfperiod = fperiod * (1 + Math.sin(vibPhase) * vibAmp); }
    period = Math.floor(rfperiod);
    if (period < 8) period = 8;
    squareDuty += squareSlide;
    if (squareDuty < 0) squareDuty = 0; else if (squareDuty > 0.5) squareDuty = 0.5;
    envTime++;
    if (envTime > envLen[envStage]) { envTime = 0; envStage++; if (envStage === 3) break; }
    if (envStage === 0) envVol = envLen[0] ? envTime / envLen[0] : 1;
    else if (envStage === 1) envVol = 1 + (1 - envTime / (envLen[1] || 1)) * 2 * P.punch;
    else envVol = 1 - envTime / (envLen[2] || 1);
    fphase += fdphase;
    iphase = Math.abs(Math.floor(fphase));
    if (iphase > 1023) iphase = 1023;
    if (flthpD !== 0) { flthp *= flthpD; if (flthp < 0.00001) flthp = 0.00001; else if (flthp > 0.1) flthp = 0.1; }
    let ssample = 0;
    for (let si = 0; si < 8; si++) {
      let sample = 0;
      phase++;
      if (phase >= period) { phase %= period; if (wave === 3) for (let i = 0; i < 32; i++) noise[i] = Math.random() * 2 - 1; }
      const fp = phase / period;
      if (wave === 0) sample = fp < squareDuty ? 0.5 : -0.5;
      else if (wave === 1) sample = 1 - fp * 2;
      else if (wave === 2) sample = Math.sin(fp * 6.283185307179586);
      else if (wave === 3) sample = noise[Math.floor(phase * 32 / period)];
      else sample = fp < 0.5 ? -1 + 4 * fp : 3 - 4 * fp;
      const pp = fltp;
      fltw *= fltwD;
      if (fltw < 0) fltw = 0; else if (fltw > 0.1) fltw = 0.1;
      if (P.lpf_freq !== 1) { fltdp += (sample - fltp) * fltw; fltdp -= fltdp * fltdmp; } else { fltp = sample; fltdp = 0; }
      fltp += fltdp;
      fltphp += fltp - pp;
      fltphp -= fltphp * flthp;
      sample = fltphp;
      phaser[ipp & 1023] = sample;
      sample += phaser[(ipp - iphase + 1024) & 1023];
      ipp = (ipp + 1) & 1023;
      ssample += sample * envVol;
    }
    buf[n] = ssample / 8;
  }
  const out = buf.subarray(0, n);
  let peak = 0;
  for (let i = 0; i < n; i++) { const a = Math.abs(out[i]); if (a > peak) peak = a; }
  const g = (peak > 0 ? 1 / peak : 1) * P.volume;
  for (let i = 0; i < n; i++) out[i] *= g;
  return out;
}

// A definition is one parameter set, or { base, sequence: [{ at, ...overrides }] }: notes mixed onto one buffer.
export function render(def) {
  const sr = cfg().sample_rate || 44100;
  if (!def) return new Float32Array(1);
  if (def.sequence) {
    const notes = def.sequence.map(n => ({ at: Math.round((n.at || 0) * sr), pcm: synth({ ...(def.base || {}), ...n }) }));
    const len = Math.min(MAX_SAMPLES, notes.reduce((m, n) => Math.max(m, n.at + n.pcm.length), 1));
    const out = new Float32Array(len);
    for (const n of notes) for (let i = 0; i < n.pcm.length && n.at + i < len; i++) out[n.at + i] += n.pcm[i];
    for (let i = 0; i < len; i++) { if (out[i] > 1) out[i] = 1; else if (out[i] < -1) out[i] = -1; }
    return out;
  }
  return synth(def);
}

function bufferFor(id) {
  let b = buffers.get(id);
  if (b) return b;
  const def = cfg().sfx[id];
  if (!def) return null;
  const pcm = render(def);
  b = ctx.createBuffer(1, pcm.length, cfg().sample_rate || 44100);
  b.getChannelData(0).set(pcm);
  buffers.set(id, b);
  return b;
}
function playBuffer(buffer, dest, gain = 1) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(dest);
  src.start();
  src.onended = () => { try { src.disconnect(); g.disconnect(); } catch { /* already gone */ } };
}

export const sfxIds = () => Object.keys(cfg().sfx || {});

// Play one effect by id. { force } skips the per-id throttle (used by DPS.sfx); { gain } scales this one play.
// Returns { id, played, reason }.
export function play(id, { force = false, gain = 1 } = {}) {
  const def = cfg().sfx[id];
  if (!def) return { id, played: false, reason: 'unknown id' };
  if (!unlocked || !ctx) { blocked++; return { id, played: false, reason: 'locked: no user gesture yet' }; }
  if (!settings().sfx) return { id, played: false, reason: 'sfx off' };
  const t = now();
  const gap = ((cfg().throttle_seconds || {})[id] || 0) * 1000;
  if (!force && gap > 0 && t - (lastPlay.get(id) ?? -Infinity) < gap) return { id, played: false, reason: 'throttled' };
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  playBuffer(bufferFor(id), sfxGain, gain);
  lastPlay.set(id, t); lastAnyPlay = t;
  plays.push({ id, t: Math.round(t), day: state ? state.day : null });
  if (plays.length > 40) plays.shift();
  return { id, played: true, reason: null };
}
export const sfx = (id, opts) => play(id, opts);

// ---- ambient bed ----
function startAmbient() {
  const A = cfg().ambient;
  if (!A || !ctx || ambient.nodes) return;
  const pad = A.pad;
  const g = ctx.createGain(); g.gain.value = pad.gain;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = pad.lowpass_hz;
  const oscs = pad.freqs.map(f => { const o = ctx.createOscillator(); o.type = pad.wave || 'triangle'; o.frequency.value = f; o.connect(lp); o.start(); return o; });
  lp.connect(g).connect(ambientGain);
  const lfo = ctx.createOscillator(); lfo.frequency.value = pad.lfo_hz;
  const lg = ctx.createGain(); lg.gain.value = pad.gain * pad.lfo_depth;
  lfo.connect(lg).connect(g.gain); lfo.start();
  ambient.nodes = { g, lp, oscs, lfo, lg };
  scheduleChirp();
}
function scheduleChirp() {
  const A = cfg().ambient;
  const [lo, hi] = A.chirp_gap_seconds || [4, 10];
  ambient.chirpTimer = setTimeout(() => {
    if (!ambient.nodes) return;
    const p = { ...A.chirp, freq: Math.max(0.05, Math.min(1, (A.chirp.freq || 0.8) + (Math.random() * 2 - 1) * (A.chirp_freq_jitter || 0))) };
    const pcm = synth(p);
    const b = ctx.createBuffer(1, pcm.length, cfg().sample_rate || 44100);
    b.getChannelData(0).set(pcm);
    playBuffer(b, ambientGain, 1);
    scheduleChirp();
  }, (lo + Math.random() * (hi - lo)) * 1000);
}
function stopAmbient() {
  if (ambient.chirpTimer) clearTimeout(ambient.chirpTimer);
  ambient.chirpTimer = 0;
  const n = ambient.nodes;
  if (!n) return;
  ambient.nodes = null;
  try { for (const o of n.oscs) o.stop(); n.lfo.stop(); n.g.disconnect(); n.lg.disconnect(); n.lp.disconnect(); } catch { /* already stopped */ }
}

// Apply the live settings: master volume, ambient on/off. Called on every state change (cheap).
function applySettings() {
  if (!ctx) return;
  const s = settings();
  master.gain.value = (s.master_volume ?? 0.8) * (cfg().master_gain ?? 0.9);
  if (s.ambient && !ambient.nodes) startAmbient();
  else if (!s.ambient && ambient.nodes) stopAmbient();
}

// ---- unlock + triggers ----
function unlock() {
  if (unlocked) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { ctx = new AC(); } catch { return; }
  master = ctx.createGain(); sfxGain = ctx.createGain(); ambientGain = ctx.createGain();
  sfxGain.connect(master); ambientGain.connect(master); master.connect(ctx.destination);
  unlocked = true;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  applySettings();
  for (const ev of GESTURES) window.removeEventListener(ev, unlock, true);
}
const GESTURES = ['pointerdown', 'keydown', 'click', 'touchstart'];

export function initAudio({ livingActive } = {}) {
  void livingActive; // kept in the signature for main.js; the arrival roar is timed by sim/agents.js now
  for (const ev of GESTURES) window.addEventListener(ev, unlock, { capture: true, passive: true });
  onChange(applySettings);
  // Every button plays the click, unless the button's own handler already made a sound in this same event.
  document.addEventListener('click', e => {
    const b = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!b || b.disabled) return;
    if (now() - lastAnyPlay < 60) return;
    play('ui_click');
  });
  bus.addEventListener('sfx', e => play(e.detail.id, { gain: e.detail.gain ?? 1 }));
  bus.addEventListener('escape', () => play('escape_siren'));
  bus.addEventListener('quarter', () => play('quarter_chime'));
  bus.addEventListener('prize', () => play('prize_fanfare'));
  bus.addEventListener('goal', () => play('milestone_fanfare'));
  bus.addEventListener('report_card', () => play('milestone_fanfare'));
  bus.addEventListener('lose', () => play('foreclosure_sting'));
  // A purchase roars when the animal pops out of its crate in the Park (sim/agents.js queues the delivery from any
  // screen); under Reduce motion agents.js roars at once instead. No roar is played here.
}
export const roarFor = size => (size === 'large' ? 'roar_large' : size === 'small' ? 'roar_small' : 'roar_medium');

export function audioState() {
  const s = settings();
  return {
    unlocked, context: ctx ? ctx.state : 'none',
    master_volume: s.master_volume ?? null, sfx: !!s.sfx, ambient: !!s.ambient, ambient_playing: !!ambient.nodes,
    ids: sfxIds(), plays: plays.slice(), blocked_before_gesture: blocked
  };
}
