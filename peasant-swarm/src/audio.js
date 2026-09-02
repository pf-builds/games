// Peasant Swarm audio — all synthesized, owned. SFX + battle drum while engaged.
(function () {
  const PS = (window.PS = window.PS || {});
  let ctx = null, master = null, muted = false, silent = false, drumOn = false, drumTimer = null, drumStep = 0;

  function ac() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      } catch (e) { return null; }
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
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

  PS.audio = {
    unlock() { ac(); },
    setMuted(m) { muted = m; if (m) PS.audio.stopDrum(); },
    setSilent(v) { silent = !!v; if (silent) PS.audio.stopDrum(); },
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
