// Quick Fox audio — synthesized, owned. Soft ticks for keys, small chimes for wins.
(function () {
  const QF = (window.QF = window.QF || {});
  let ctx = null, master = null, muted = false;
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.45; master.connect(ctx.destination); } catch (e) { return null; } }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(f0, f1, dur, type, peak, when, lin) {
    const c = ac(); if (!c || muted) return;
    const t0 = c.currentTime + (when || 0); const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(1, f0), t0);
    if (lin) o.frequency.linearRampToValueAtTime(Math.max(1, f1), t0 + dur); else o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  let noiseBuf = null;
  function noise(dur, peak, when, ff) {
    const c = ac(); if (!c || muted) return;
    if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); }
    const t0 = c.currentTime + (when || 0); const src = c.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 1 / dur;
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = ff || 2000;
    const g = c.createGain(); g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master); src.start(t0); src.stop(t0 + dur + 0.05);
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  QF.audio = {
    unlock() { ac(); }, setMuted(m) { muted = m; }, isMuted() { return muted; },
    key() { noise(0.03, 0.05, 0, 3500); tone(rnd(1800, 2200), 900, 0.02, "square", 0.012); },
    space() { noise(0.045, 0.06, 0, 1800); },
    error() { tone(220, 160, 0.12, "square", 0.05); },
    word() { tone(660, 990, 0.08, "square", 0.05); },
    zap() { tone(1400, 200, 0.14, "sawtooth", 0.07); noise(0.08, 0.06, 0, 4000); },
    hurt() { tone(200, 80, 0.25, "sawtooth", 0.09); noise(0.2, 0.08, 0, 900); },
    star(i) { tone(784 * Math.pow(1.25, i), 784 * Math.pow(1.25, i), 0.16, "triangle", 0.1); },
    chime() { [523, 659, 784].forEach((f, i) => tone(f, f, 0.14, "square", 0.07, i * 0.07)); },
    fanfare() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.18, "square", 0.09, i * 0.09)); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, f * 0.97, 0.28, "sawtooth", 0.1, i * 0.2)); },
    click() { tone(700, 500, 0.04, "square", 0.05); }
  };
})();
