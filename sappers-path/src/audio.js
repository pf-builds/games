// Sapper's Path sound (SPEC §4 "Audio"): WebAudio synthesis only, no files. Every cue is a recipe in config.audio.cues:
// a list of voices {w: wave or "noise", f/f1: start/end Hz, d: seconds, g: gain, at: delay, lp/hp/bp: filter Hz,
// vib/vd: vibrato Hz/depth, step: Hz added per unit of the cue's argument (tick pitch by ring, star by index)}.
// The context is created on the first user gesture only (no autoplay warning). cue() always records the last cue and a
// count per cue (the debug facade reads them), even when muted, when the context isn't up yet, or while selfTest runs.
(function (root, factory) {
  (root.SappersPath = root.SappersPath || {}).audio = factory();
})(window, function () {
  "use strict";
  function create(cfg) { return { cfg, ctx: null, out: null, noise: null, muted: false, quiet: false, last: null, lastAt: -1, counts: {}, tickT: -1e9 }; }

  // Call from a pointerdown / keydown handler: makes (or resumes) the context inside the gesture.
  function unlock(A) {
    try {
      if (!A.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        A.ctx = new AC(); A.out = A.ctx.createGain(); A.out.gain.value = A.cfg.volume; A.out.connect(A.ctx.destination);
        const n = Math.floor(A.ctx.sampleRate * 0.5), buf = A.ctx.createBuffer(1, n, A.ctx.sampleRate), d = buf.getChannelData(0);
        let s = 7; for (let i = 0; i < n; i++) { s = (Math.imul(s, 1103515245) + 12345) | 0; d[i] = ((s >>> 8) & 0xffff) / 32768 - 1; }
        A.noise = buf;
      }
      if (A.ctx.state === "suspended") A.ctx.resume();
    } catch (e) { A.ctx = null; }
  }

  function voice(A, v, t0, arg) {
    const c = A.ctx, t = t0 + (v.at || 0), d = v.d || 0.1, g = c.createGain(), shift = (v.step || 0) * arg;
    let src;
    if (v.w === "noise") { src = c.createBufferSource(); src.buffer = A.noise; src.loop = true; }
    else {
      src = c.createOscillator(); src.type = v.w;
      src.frequency.setValueAtTime((v.f || 440) + shift, t);
      if (v.f1) src.frequency.exponentialRampToValueAtTime(Math.max(20, v.f1 + shift), t + d);
      if (v.vib) { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = v.vib; lg.gain.value = v.vd || 20; lfo.connect(lg); lg.connect(src.frequency); lfo.start(t); lfo.stop(t + d + 0.05); }
    }
    let node = src;
    for (const [k, type] of [["lp", "lowpass"], ["hp", "highpass"], ["bp", "bandpass"]]) {
      if (!v[k]) continue;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = v[k] + (v.w === "noise" ? shift : 0); if (type === "bandpass") f.Q.value = 1.2;
      node.connect(f); node = f;
    }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v.g || 0.2, t + Math.min(0.012, d / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    node.connect(g); g.connect(A.out);
    src.start(t); src.stop(t + d + 0.05);
  }

  // Play a cue by name (arg shifts pitch for recipes with "step"). now: the page's sim clock, for the tick throttle.
  function cue(A, name, arg, now) {
    const R = A.cfg.cues[name];
    if (!R) return false;
    A.last = name; A.lastAt = now; A.counts[name] = (A.counts[name] || 0) + 1;
    if (name === "tick") { if (now - A.tickT < A.cfg.tickGapMs) return false; A.tickT = now; }
    if (A.muted || A.quiet || !A.ctx || A.ctx.state !== "running") return false;
    try { const t0 = A.ctx.currentTime + 0.005; for (const v of R) voice(A, v, t0, arg || 0); return true; } catch (e) { return false; }
  }
  function setMuted(A, on) { A.muted = !!on; if (A.out) A.out.gain.value = on ? 0 : A.cfg.volume; }

  return { create, unlock, cue, setMuted };
});
