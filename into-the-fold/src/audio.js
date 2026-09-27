// Into the Fold sound (SPEC §6). WebAudio synth only, no files. The context is created and resumed inside the first
// user gesture (browsers keep audio locked until one). Every sound goes through play(), which counts the call even
// when muted or locked, so selfTest can prove the hook fires on a real swipe path without making a noise.
// All pitches, lengths and gains come from config.audio.
(function () {
  "use strict";
  const NS = (window.IntoTheFold = window.IntoTheFold || {});

  function create(cfg) {
    return { cfg, ctx: null, master: null, noise: null, on: true, silent: false, seq: 0,
      calls: { whistle: 0, bleat: 0, latch: 0, splash: 0, win: 0 } };
  }

  // Call from inside a gesture handler. Idempotent and cheap once running.
  function unlock(A) {
    if (A.ctx && A.ctx.state === "running") return;
    if (!A.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { A.ctx = new AC(); } catch (e) { return; }
      A.master = A.ctx.createGain(); A.master.gain.value = A.cfg.volume; A.master.connect(A.ctx.destination);
    }
    if (A.ctx.state === "suspended" && A.ctx.resume) A.ctx.resume().catch(() => {});
  }

  function live(A) { return A.on && !A.silent && A.ctx && A.ctx.state === "running"; }

  // Deterministic jitter in [-1, 1] (so selfTest runs and replays sound alike).
  function jitter(A) { let h = (++A.seq * 2654435761) | 0; h ^= h >>> 15; return ((h >>> 0) % 2001) / 1000 - 1; }

  function noiseBuffer(A) {
    if (!A.noise) {
      const n = A.ctx.sampleRate, b = A.ctx.createBuffer(1, n, n), d = b.getChannelData(0);
      for (let k = 0; k < n; k++) d[k] = Math.random() * 2 - 1;
      A.noise = b;
    }
    return A.noise;
  }

  // A gain envelope: 0 → peak in `att` s, hold, then down to silence by `len` s. Returns the gain node.
  function env(A, t, peak, att, len) {
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    g.connect(A.master);
    return g;
  }

  function osc(A, type, t, len, out) { const o = A.ctx.createOscillator(); o.type = type; o.connect(out); o.start(t); o.stop(t + len + 0.02); return o; }

  // A shepherd's whistle: a quick rise and a small fall.
  function whistle(A) {
    const C = A.cfg.whistle, t = A.ctx.currentTime, len = C.ms / 1000, g = env(A, t, C.gain, 0.012, len);
    const o = osc(A, "sine", t, len, g);
    o.frequency.setValueAtTime(C.f0, t);
    o.frequency.exponentialRampToValueAtTime(C.f1, t + len * 0.45);
    o.frequency.exponentialRampToValueAtTime(C.f2, t + len);
  }

  // "Baa": a buzzy saw with a fast wobble through a vowel-ish band-pass, sagging in pitch at the end.
  function bleat(A, colour, lift) {
    const C = A.cfg.bleat, t = A.ctx.currentTime, len = C.ms / 1000;
    const f = (colour === "b" ? C.black : C.white) * (1 + C.jitter * jitter(A)) * (lift || 1);
    const bp = A.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = C.formantHz; bp.Q.value = 1.4;
    bp.connect(env(A, t, C.gain, 0.03, len));
    const lfo = A.ctx.createOscillator(), depth = A.ctx.createGain();
    lfo.frequency.value = C.vibratoHz; depth.gain.value = f * C.vibratoDepth; lfo.connect(depth);
    lfo.start(t); lfo.stop(t + len + 0.02);
    for (const detune of [0, 7]) {
      const o = osc(A, "sawtooth", t, len, bp);
      o.detune.value = detune;
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 1.04, t + len * 0.3);
      o.frequency.exponentialRampToValueAtTime(f * 0.86, t + len);
      depth.connect(o.frequency);
    }
  }

  // The pen gate closing: a wooden thunk and a small latch click, a beat after the sheep lands.
  function latch(A) {
    const C = A.cfg.latch, t = A.ctx.currentTime + C.delayMs / 1000, len = C.ms / 1000;
    const o = osc(A, "triangle", t, len, env(A, t, C.gain, 0.004, len));
    o.frequency.setValueAtTime(C.f0, t); o.frequency.exponentialRampToValueAtTime(C.f1, t + len);
    const n = A.ctx.createBufferSource(), bp = A.ctx.createBiquadFilter();
    n.buffer = noiseBuffer(A); bp.type = "bandpass"; bp.frequency.value = C.clickHz; bp.Q.value = 3;
    n.connect(bp); bp.connect(env(A, t, C.gain * 0.6, 0.002, 0.03)); n.start(t); n.stop(t + 0.05);
  }

  // A soft splash: filtered noise closing down, over a falling plop.
  function splash(A) {
    const C = A.cfg.splash, t = A.ctx.currentTime, len = C.ms / 1000;
    const n = A.ctx.createBufferSource(), lp = A.ctx.createBiquadFilter();
    n.buffer = noiseBuffer(A); lp.type = "lowpass";
    lp.frequency.setValueAtTime(C.cut0, t); lp.frequency.exponentialRampToValueAtTime(C.cut1, t + len);
    n.connect(lp); lp.connect(env(A, t, C.gain, 0.01, len)); n.start(t); n.stop(t + len + 0.02);
    const o = osc(A, "sine", t, 0.14, env(A, t, C.gain * 0.8, 0.005, 0.14));
    o.frequency.setValueAtTime(C.plop0, t); o.frequency.exponentialRampToValueAtTime(C.plop1, t + 0.14);
  }

  // A little rising arpeggio, triangle with a sine octave above.
  function win(A) {
    const C = A.cfg.win, t0 = A.ctx.currentTime, len = C.noteMs / 1000;
    for (let k = 0; k < C.notes.length; k++) {
      const t = t0 + (k * C.stepMs) / 1000, g = env(A, t, C.gain, 0.01, len + (k === C.notes.length - 1 ? 0.25 : 0));
      osc(A, "triangle", t, len + 0.25, g).frequency.value = C.notes[k];
      osc(A, "sine", t, len, env(A, t, C.gain * 0.3, 0.01, len)).frequency.value = C.notes[k] * 2;
    }
  }

  const SOUNDS = { whistle, bleat, latch, splash, win };

  // THE audio hook: count it, then play it if sound is on, not silenced, and unlocked. Never throws.
  function play(A, name, a, b) {
    A.calls[name]++;
    if (!live(A)) return false;
    try { SOUNDS[name](A, a, b); return true; } catch (e) { return false; }
  }

  NS.audio = { create, unlock, play };
})();
