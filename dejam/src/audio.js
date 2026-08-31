// All sound synthesized with WebAudio — zero audio assets, zero licensing.
(function () {
  const G = (window.DeJam = window.DeJam || {});
  let ctx = null;
  let muted = false;

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function blip(freqStart, freqEnd, dur, type, gainPeak, when) {
    const c = ac(); if (!c || muted) return;
    const t0 = c.currentTime + (when || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freqStart, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gainPeak || 0.15, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  G.audio = {
    setMuted(m) { muted = m; },
    isMuted() { return muted; },
    unlock() { ac(); },
    slide() { blip(520, 300, 0.07, "square", 0.08); },
    thunk() { blip(140, 90, 0.09, "triangle", 0.18); },
    tap() { blip(700, 640, 0.04, "square", 0.05); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => blip(f, f, 0.16, "square", 0.12, i * 0.09));
      blip(1568, 1568, 0.25, "triangle", 0.08, 0.38);
    }
  };
})();
