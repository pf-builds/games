// Peasant Swarm audio — all synthesized, owned. SFX + battle drum while engaged, plus the fog tells (SPEC-v2 §12): the distant panned
// clash rumble (the one deliberate off-screen sound), the danger horn (a low war horn) and the ping tone.
(function () {
  const PS = (window.PS = window.PS || {});
  let ctx = null, master = null, muted = false, silent = false, drumOn = false, drumTimer = null, drumStep = 0, unlocked = false;

  // no AudioContext exists until a user gesture unlocks it: creating or resuming one earlier only logs browser warnings (M2 critic BLOCKER-1).
  // iOS/Safari (SPEC-v2 §10, M7): the session is "ambient" where the browser offers it (the ringer switch mutes the game), the context is
  // resumed on every pointerup / touchend (iOS only lets a gesture's END start audio), on return to a visible tab and after an
  // "interrupted" state (a call, Siri), whichever comes first.
  function ac() {
    if (!unlocked) return null;
    if (!ctx) {
      try {
        try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
        ctx.onstatechange = () => { if (ctx.state === "interrupted" || ctx.state === "suspended") resumeSoon = true; };
      } catch (e) { return null; }
    }
    if (ctx.state === "suspended" || ctx.state === "interrupted") { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  let resumeSoon = false;
  const resumeNow = () => { if (unlocked && ctx && ctx.state !== "running" && ctx.state !== "closed") { try { ctx.resume(); } catch (e) {} } resumeSoon = false; };
  window.addEventListener("pointerup", () => { if (!unlocked) { unlocked = true; ac(); } else resumeNow(); }, true);
  window.addEventListener("touchend", () => { if (unlocked) resumeNow(); }, true);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) resumeNow(); else if (murmur) murmur.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); });
  // crowd murmur (SPEC-v2 §12): one looping band-passed noise whose level follows your count (log scale), started with a match
  let murmur = null;
  function tone(f0, f1, dur, type, peak, when, lin) {
    if (silent) return; const c = ac(); if (!c || muted) return;
    const t0 = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(1, f0), t0);
    if (lin) o.frequency.linearRampToValueAtTime(Math.max(1, f1), t0 + dur);
    else o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  let noiseBuf = null;
  function getNoise(c) {
    if (noiseBuf) return noiseBuf;
    const len = c.sampleRate; noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return noiseBuf;
  }
  function noise(dur, peak, when, ff, q) {
    if (silent) return; const c = ac(); if (!c || muted) return;
    const t0 = c.currentTime + (when || 0);
    const src = c.createBufferSource(); src.buffer = getNoise(c);
    src.playbackRate.value = (1 / dur) * (0.9 + Math.random() * 0.2);
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = ff || 2200; f.Q.value = q || 0.7;
    const g = c.createGain(); g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master); src.start(t0); src.stop(t0 + dur + 0.05);
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  // throttles: crowds fire the same sound hundreds of times a second
  const last = {};
  function gate(k, ms) { const n = performance.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }

  let flatNoise = null; // a looping noise buffer without the one-shot decay (the rumble)
  function getFlat(c) { if (flatNoise) return flatNoise; const len = c.sampleRate; flatNoise = c.createBuffer(1, len, c.sampleRate); const d = flatNoise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return flatNoise; }
  // a stereo panner when the browser has one, else straight through
  function panNode(c, pan) { if (!c.createStereoPanner) return null; const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(master); return p; }

  PS.audio = {
    unlock() { unlocked = true; ac(); },
    setMuted(m) { muted = m; if (m) { PS.audio.stopDrum(); PS.audio.murmur(0); } },
    setSilent(v) { silent = !!v; if (silent) { PS.audio.stopDrum(); if (murmur) murmur.g.gain.setTargetAtTime(0.0001, murmur.c.currentTime, 0.05); } },
    state() { return { unlocked, ctx: ctx ? ctx.state : "none", murmur: !!murmur, resumeSoon }; },
    isMuted() { return muted; },
    recruit() { if (!gate("r", 45)) return; tone(rnd(520, 640), rnd(900, 1100), 0.08, "square", 0.05); },
    hit() { if (!gate("h", 40)) return; noise(0.05, 0.09, 0, 1800); tone(rnd(180, 240), 90, 0.06, "square", 0.05); },
    die(mine) { if (!gate("d", 60)) return; tone(mine ? rnd(420, 480) : rnd(300, 360), 120, 0.16, "sawtooth", 0.07); noise(0.08, 0.06, 0, 1200); },
    rout(good) {
      if (good) [196, 262, 330, 392].forEach((f, i) => tone(f, f * 1.01, 0.22, "sawtooth", 0.16, i * 0.09));
      else [330, 262, 196].forEach((f, i) => tone(f, f * 0.97, 0.3, "sawtooth", 0.16, i * 0.12));
      noise(0.5, 0.18, 0, 900);
    },
    power(kind) {
      const base = { speed: 660, armor: 440, frenzy: 330, rally: 262 }[kind] || 500;
      [1, 1.25, 1.5].forEach((m, i) => tone(base * m, base * m, 0.1, "square", 0.08, i * 0.07));
      if (kind === "rally") tone(130, 260, 0.5, "sawtooth", 0.14, 0.2, true);
    },
    eliminated() { tone(240, 60, 0.5, "sawtooth", 0.18); noise(0.4, 0.15, 0, 700); tone(120, 40, 0.6, "square", 0.1, 0.1); },
    huddle(on) { tone(on ? 300 : 420, on ? 420 : 300, 0.07, "square", 0.04); },
    bell() { [880, 880, 880].forEach((f, i) => { tone(f, f * 0.995, 0.35, "triangle", 0.12, i * 0.5); tone(f * 2.01, f * 2, 0.2, "sine", 0.05, i * 0.5); }); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.18, "square", 0.1, i * 0.1)); noise(0.6, 0.1, 0.5, 4000); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.97, 0.3, "sawtooth", 0.12, i * 0.22)); },
    click() { tone(700, 500, 0.04, "square", 0.05); },
    // distant clash through the dark: 3 s of low filtered noise and a few muffled thumps, panned toward it, quieter with distance
    rumble(pan, vol) {
      if (silent || !gate("rb", 600)) return; const c = ac(); if (!c || muted) return;
      const t0 = c.currentTime, dur = 3, peak = 0.16 * Math.max(0.2, Math.min(1, vol || 1)), out = panNode(c, pan || 0) || master;
      const src = c.createBufferSource(); src.buffer = getFlat(c); src.loop = true; src.playbackRate.value = 0.6;
      const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 220; f.Q.value = 0.8;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.5); g.gain.setValueAtTime(peak, t0 + dur - 1); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(out); src.start(t0); src.stop(t0 + dur + 0.05);
      for (let i = 0; i < 5; i++) { const o = c.createOscillator(), h = c.createGain(), t = t0 + 0.3 + i * 0.5 + Math.random() * 0.2; o.type = "sine"; o.frequency.setValueAtTime(70 + Math.random() * 20, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
        h.gain.setValueAtTime(0.0001, t); h.gain.exponentialRampToValueAtTime(peak * 1.2, t + 0.01); h.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(h).connect(out); o.start(t); o.stop(t + 0.25); }
    },
    // danger: an unseen rival is hunting you. A low war horn (the finale horn, lower)
    dangerHorn() { if (!gate("dh", 2000)) return; [[98, 0], [147, 0.02]].forEach(([f, w]) => { tone(f * 0.94, f, 0.25, "sawtooth", 0.1, w, true); tone(f, f * 0.985, 1.0, "sawtooth", 0.12, w + 0.22, true); }); noise(0.9, 0.05, 0.2, 400); },
    // the finale war horn (and Bully's first scent ping, a little quieter): the danger horn's voice a fifth higher, held longer
    warHorn(v) { if (!gate("wh", 1500)) return; const k = v || 1; [[147, 0], [220, 0.03]].forEach(([f, w]) => { tone(f * 0.94, f, 0.3, "sawtooth", 0.12 * k, w, true); tone(f, f * 0.99, 1.4, "sawtooth", 0.14 * k, w + 0.28, true); }); noise(1.2, 0.05 * k, 0.25, 500); },
    // a later scent ping: one short low note (C1: the horn every 25 s would nag)
    scentNote() { if (!gate("sn", 1000)) return; tone(110, 104, 0.35, "triangle", 0.1); },
    // M6 spoils (SPEC-v2 §12): a relic taken (a bright rising chime), a chest opening (a wooden knock and a coin shimmer), a village joining
    // (a crowd cheer: bursts of bright noise over a rising shout; heard within encampments.cheer px through the dark), a muster milestone
    // (a short brass fanfare)
    relic() { if (!gate("rl", 150)) return; [784, 988, 1175, 1568].forEach((f, i) => tone(f, f * 1.005, 0.14, "triangle", 0.09, i * 0.06)); tone(392, 784, 0.25, "sine", 0.05, 0, true); },
    chest() { if (!gate("ch", 200)) return; tone(160, 110, 0.08, "square", 0.08); noise(0.06, 0.08, 0, 900); [1319, 1568, 1976].forEach((f, i) => tone(f, f, 0.1, "sine", 0.05, 0.08 + i * 0.05)); },
    cheer() { if (!gate("cr", 1200)) return; for (let i = 0; i < 5; i++) noise(0.35, 0.07, i * 0.12, 2600 + Math.random() * 1400, 1.4); tone(330, 520, 0.6, "sawtooth", 0.05, 0.05, true); tone(415, 660, 0.55, "sawtooth", 0.04, 0.15, true); },
    fanfare() { if (!gate("ff", 800)) return; [[392, 0], [523, 0.12], [659, 0.24], [784, 0.36], [659, 0.52], [784, 0.62]].forEach(([f, w], i) => tone(f, f * 1.003, i === 5 ? 0.5 : 0.14, "sawtooth", 0.09, w, true)); },
    // ping: a rout you did not see folded into its clash's ping
    ping() { if (!gate("pg", 500)) return; tone(740, 760, 0.22, "triangle", 0.07); tone(1110, 1120, 0.18, "sine", 0.03, 0.05); },
    // M7 (SPEC-v2 §12): a remnant scattering (a rush of footsteps and a falling cry), the crown pulse (each broadcast while it is on you or
    // in the finale), the dawn chime at the bell, a bandit growl when bandits you can see go for your peasants, the crowd murmur by count
    scatter() { if (!gate("sc", 700)) return; for (let i = 0; i < 6; i++) noise(0.05, 0.07, i * 0.06 + Math.random() * 0.02, 1400 + Math.random() * 600, 1.5); tone(520, 260, 0.45, "sawtooth", 0.05, 0.05, true); },
    crownPulse(mine) { if (!gate("cp", 1500)) return; tone(mine ? 392 : 330, mine ? 392 : 330, 0.5, "triangle", 0.07); tone(mine ? 784 : 660, mine ? 790 : 664, 0.4, "sine", 0.03, 0.04); },
    dawn() { if (!gate("dw", 2000)) return; [659, 784, 988, 1319].forEach((f, i) => { tone(f, f, 1.2, "sine", 0.06, i * 0.18); tone(f * 2, f * 2, 0.6, "triangle", 0.015, i * 0.18); }); },
    growl() { if (!gate("gr", 2500)) return; tone(92, 70, 0.6, "sawtooth", 0.09, 0, true); tone(98, 74, 0.6, "square", 0.04, 0.02, true); noise(0.5, 0.05, 0, 300, 2); },
    murmur(n) {
      if (silent || muted || n <= 0) { if (murmur) murmur.g.gain.setTargetAtTime(0.0001, murmur.c.currentTime, 0.2); return; }
      const c = ac(); if (!c) return;
      if (!murmur) { const src = c.createBufferSource(); src.buffer = getFlat(c); src.loop = true; src.playbackRate.value = 0.5; const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 420; f.Q.value = 0.9; const g = c.createGain(); g.gain.value = 0.0001; src.connect(f).connect(g).connect(master); src.start(); murmur = { c, src, f, g }; }
      const v = Math.min(0.09, 0.012 * Math.log2(1 + n / 4)); murmur.g.gain.setTargetAtTime(v, c.currentTime, 0.4); murmur.f.frequency.setTargetAtTime(360 + Math.min(300, n), c.currentTime, 0.5);
    },

    startDrum() {
      if (muted || silent || drumOn || !ac()) return;
      drumOn = true; drumStep = 0;
      drumTimer = setInterval(() => {
        if (muted) return;
        const s = drumStep % 8;
        if (s === 0 || s === 3 || s === 5) { tone(110, 45, 0.18, "sine", 0.22); noise(0.06, 0.06, 0, 500); }
        if (s === 4) { noise(0.12, 0.12, 0, 1500, 1.2); }
        drumStep++;
      }, 170);
    },
    stopDrum() { drumOn = false; if (drumTimer) { clearInterval(drumTimer); drumTimer = null; } },
    drumOn() { return drumOn; }
  };
})();
