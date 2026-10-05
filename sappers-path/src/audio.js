// Sapper's Path sound (SPEC §4 "Audio"): WebAudio synthesis only, no files. Every cue is a recipe in config.audio.cues:
// a list of voices {w: wave or "noise", f/f1: start/end Hz, d: seconds, g: gain, at: delay, lp/hp/bp: filter Hz,
// vib/vd: vibrato Hz/depth, step: Hz added per unit of the cue's argument (tick pitch by ring, star by index)}.
// The context is created on the first user gesture only (no autoplay warning). cue() always records the last cue and a
// count per cue (the debug facade reads them), even when muted, when the context isn't up yet, or while selfTest runs.
// Busy cues are throttled per name (config.audio.gaps, ms of sim time): 70 pixels popping in a second make a rattle, not
// a wall of noise. suspend() / unlock() pause and resume the whole context (the page pauses on blur).
// v5.2 (SPEC-v4 §9, the v5.2 entry; tools/v5-2-music-notes.md): music. Three CC0 loops by one composer and a win jingle
// (config.audio.music; files in audio/, made by tools/music-encode.py). Two buses: effects (out, audio.volume) and music
// (mus, music.volume, lower). Two switches, saved by the page: sfx and music; muted is both off (the quick mute buttons
// set both). A loop plays through an AudioBufferSourceNode with loop on between its loopStart and loopEnd (the files are
// written periodic around the loop, so the seam is exact whether or not a decoder trims the AAC priming). want(name)
// asks for a track (pick() chooses it from the screen and the level): the old one fades out and the new one in over
// music.fadeMs on the audio clock (no timers). Nothing is fetched before the first gesture (unlock): then the wanted track
// is fetched at once and the others one at a time in the background (music.order), only while music is on. jingle()
// ducks the loop (music.duck) and plays the win jingle (music.jingle) once. Any failure (no Web Audio, a fetch or decode
// refused) leaves that track silent and says nothing. UMD like save.js, so Node can check pick() and the switches.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).audio = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // url(file): the page's cache tag on a music file (main.js passes it; the playtest bundle strips it).
  function create(cfg, url) {
    return { cfg, M: cfg.music || null, url: url || ((f) => f), ctx: null, out: null, mus: null, noise: null, muted: false, sfx: true, music: true, quiet: false, hush: false,
      last: null, lastAt: -1, counts: {}, tickT: -1e9, gapT: {},
      want: null, cur: null, bufs: {}, loading: {}, failed: {}, fetches: 0, unlockAt: -1, firstFetchAt: -1, switches: 0, jingles: 0, ducked: -1 };
  }
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  // The buses on a context (unlock's, or selfTest's OfflineAudioContext).
  function attach(A, ctx) {
    A.ctx = ctx; A.out = ctx.createGain(); A.out.gain.value = A.sfx ? A.cfg.volume : 0; A.out.connect(ctx.destination);
    A.mus = ctx.createGain(); A.mus.gain.value = musLevel(A); A.mus.connect(ctx.destination);
    const n = Math.floor(ctx.sampleRate * 0.5), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let s = 7; for (let i = 0; i < n; i++) { s = (Math.imul(s, 1103515245) + 12345) | 0; d[i] = ((s >>> 8) & 0xffff) / 32768 - 1; }
    A.noise = buf;
  }
  const musLevel = (A) => (A.music && !A.hush && A.M ? A.M.volume : 0);

  // Call from a pointerdown / keydown / click handler: makes (or resumes) the context inside the gesture; then the music.
  function unlock(A) {
    try {
      if (!A.ctx) {
        const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return;
        attach(A, new AC()); A.unlockAt = now();
      }
      if (A.ctx.state === "suspended") A.ctx.resume();
      kick(A);
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
    const gap = A.cfg.gaps && A.cfg.gaps[name];
    if (gap) { const last = A.gapT[name]; if (last !== undefined && now - last < gap && now >= last) return false; A.gapT[name] = now; }
    if (!A.sfx || A.quiet || !A.ctx || A.ctx.state !== "running") return false;
    try { const t0 = A.ctx.currentTime + 0.005; for (const v of R) voice(A, v, t0, arg || 0); return true; } catch (e) { return false; }
  }
  // The switches. setMuted (the quick mute buttons, and old saves' one flag) sets both; muted is true when both are off.
  const ramp = (p, v, t, s) => { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + s); };
  function setSfx(A, on) { A.sfx = !!on; A.muted = !A.sfx && !A.music; if (A.out) A.out.gain.value = A.sfx ? A.cfg.volume : 0; }
  function setMusic(A, on) {
    A.music = !!on; A.muted = !A.sfx && !A.music;
    if (!A.ctx || !A.mus) return;
    try {
      const t = A.ctx.currentTime, s = (A.M ? A.M.toggleMs : 150) / 1000; ramp(A.mus.gain, musLevel(A), t, s);
      if (!A.music && A.cur) { stopCur(A, t, s); A.cur = null; } // off: the loop stops once faded (it starts again from its top when on)
      kick(A);
    } catch (e) { /* stays as it was */ }
  }
  function setMuted(A, on) { setSfx(A, !on); setMusic(A, !on); }
  // The quick mute buttons: anything on turns both off; both off turns both on. state(): "on", "mixed" (one off) or "off".
  const quick = (A) => (A.sfx || A.music ? { sfx: false, music: false } : { sfx: true, music: true });
  const state = (A) => (A.sfx && A.music ? "on" : A.sfx || A.music ? "mixed" : "off");
  // selfTest: the music bus silent while it runs (switches still happen, unheard).
  function hushed(A, on) { A.hush = !!on; if (!A.mus) return; try { const p = A.mus.gain, t = A.ctx.currentTime; p.cancelScheduledValues(t); p.setValueAtTime(musLevel(A), t); } catch (e) { /* stays as it was */ } }
  function suspend(A) { try { if (A.ctx && A.ctx.state === "running") A.ctx.suspend(); } catch (e) { /* stays as it was */ } }

  // ---- music --------------------------------------------------------------------------------------------------------
  // The track for a screen: music.screens (title and map: the theme; play: the play loop), and a main-campaign level in a
  // realm of music.bossRealms takes music.bossTrack (the Goblin King's Throne, 175-200). Side quests and debug levels
  // keep the play loop. entry: the page's level entry ({era, gallery, debug}) or null.
  function pick(M, screen, entry) {
    if (!M) return null;
    const t = M.screens[screen] || null;
    if (t !== M.screens.play || !entry || entry.gallery || entry.debug) return t;
    return (M.bossRealms || []).indexOf(entry.era | 0) >= 0 ? M.bossTrack : t;
  }
  // Ask for a track (null: silence). Fades the old one out and the new one in when its buffer is ready; else fetches it
  // (after the first gesture, while music is on) and starts it when it lands if it is still wanted.
  function want(A, name) {
    if (!A.M) return false;
    const was = A.want; A.want = name || null;
    if (!A.ctx) return was !== A.want;
    try {
      if (A.cur && A.cur.name === A.want) return false;
      const t = A.ctx.currentTime, s = A.M.fadeMs / 1000;
      if (A.cur) { stopCur(A, t, s); A.cur = null; A.switches++; }
      kick(A);
    } catch (e) { /* silent */ }
    return true;
  }
  function stopCur(A, t, s) { const c = A.cur; ramp(c.g.gain, 0, t, s); try { c.src.stop(t + s + 0.05); } catch (e) { /* already stopped */ } }
  // Start the wanted loop if it can play now; fetch it if not; then one background fetch when nothing is in flight.
  function kick(A) {
    if (!A.ctx || !A.M || !A.music) return;
    const w = A.want, T = w && A.M.tracks[w];
    if (T && !A.cur) { if (A.bufs[w]) startLoop(A, w); else load(A, w); }
    if (Object.keys(A.loading).length) return;
    for (const n of A.M.order) if (!A.bufs[n] && !A.failed[n]) { load(A, n); break; }
  }
  function startLoop(A, name) {
    const c = A.ctx, T = A.M.tracks[name], src = c.createBufferSource(), g = c.createGain(), t = c.currentTime, s = A.M.fadeMs / 1000;
    src.buffer = A.bufs[name]; src.loop = true; src.loopStart = T.loopStart; src.loopEnd = T.loopEnd;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(T.gain, t + s);
    src.connect(g); g.connect(A.mus); src.start(t, T.loopStart);
    A.cur = { name, src, g, at: t };
  }
  // Fetch and decode one file (decodeAudioData's callback form too, for older Safari). Never throws, never logs.
  function load(A, name) {
    const T = A.M.tracks[name];
    if (!T || A.bufs[name] || A.loading[name] || A.failed[name] || !A.ctx || typeof fetch !== "function") return;
    A.loading[name] = true; A.fetches++; if (A.firstFetchAt < 0) A.firstFetchAt = now();
    const ctx = A.ctx, fail = () => { delete A.loading[name]; A.failed[name] = true; kick(A); };
    fetch(A.url(T.file)).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((ab) => new Promise((ok, no) => { const p = ctx.decodeAudioData(ab, ok, no); if (p && p.then) p.then(ok, no); }))
      .then((buf) => { delete A.loading[name]; A.bufs[name] = buf; if (A.ctx === ctx) kick(A); }, fail).catch(fail);
  }
  // The win: the loop ducks to music.duck.gain of its level, the jingle plays once, and the loop comes back up after it.
  function jingle(A) {
    if (!A.M) return false;
    A.jingles++;
    const name = A.M.jingle, J = A.M.tracks[name], buf = A.bufs[name];
    if (!A.ctx || !A.music || !J || !buf) { kick(A); return false; }
    try {
      const c = A.ctx, D = A.M.duck, t = c.currentTime, src = c.createBufferSource(), g = c.createGain();
      src.buffer = buf; g.gain.value = J.gain; src.connect(g); g.connect(A.mus); src.start(t + D.inMs / 1000);
      if (A.cur) { const p = A.cur.g.gain, T = A.M.tracks[A.cur.name], back = t + D.inMs / 1000 + buf.duration + D.holdMs / 1000;
        ramp(p, T.gain * D.gain, t, D.inMs / 1000); p.setValueAtTime(T.gain * D.gain, back); p.linearRampToValueAtTime(T.gain, back + D.outMs / 1000); }
      A.ducked = t; return true;
    } catch (e) { return false; }
  }
  // For the debug facade: what is playing and what has loaded.
  function info(A) {
    return { ctx: A.ctx ? A.ctx.state : "none", want: A.want, cur: A.cur ? A.cur.name : null, loaded: Object.keys(A.bufs), loading: Object.keys(A.loading), failed: Object.keys(A.failed),
      fetches: A.fetches, unlockAt: Math.round(A.unlockAt), firstFetchAt: Math.round(A.firstFetchAt), sfx: A.sfx, music: A.music, state: state(A), switches: A.switches, jingles: A.jingles };
  }
  // The seam check on a decoded buffer (any sample rate): the loop compared with itself one loop later over n samples
  // after loopStart (dB of the difference under the signal; the encoder's own noise is about -16 to -23 dB, a loop one
  // period off is near 0), the same with the period 37 samples off (the check can tell), and the sample step across
  // loopEnd -> loopStart against the biggest step in the 10 ms either side.
  function seam(buf, T) {
    const sr = buf.sampleRate, ls = Math.round(T.loopStart * sr), P = Math.round((T.loopEnd - T.loopStart) * sr), n = Math.min(Math.round(0.2 * sr), buf.length - ls - P - 64);
    const err = (p) => { let e = 0, s = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) { const a = d[ls + i], b = d[ls + p + i]; e += (a - b) * (a - b); s += a * a; } } return 10 * Math.log10(e / Math.max(1e-12, s)); };
    let jump = 0, near = 0; const w = Math.round(0.01 * sr), le = ls + P;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); jump = Math.max(jump, Math.abs(d[ls] - d[le - 1]));
      for (let i = le - w; i < le - 1; i++) near = Math.max(near, Math.abs(d[i + 1] - d[i])); for (let i = ls; i < ls + w; i++) near = Math.max(near, Math.abs(d[i + 1] - d[i])); }
    return { db: +err(P).toFixed(1), off: +err(P + 37).toFixed(1), jump: +jump.toFixed(4), near: +near.toFixed(4), sr, len: buf.length };
  }

  return { create, attach, unlock, cue, setMuted, setSfx, setMusic, quick, state, hushed, suspend, pick, want, kick, jingle, info, seam };
});
