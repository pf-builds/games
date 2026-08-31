// Vector Keep audio — all synthesized, owned. SFX + minimal pulse-loop music.
(function () {
  const VK = (window.VK = window.VK || {});
  let ctx = null, master = null, muted = false, musicOn = false, musicTimer = null, musicStep = 0;

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

  function tone(freq0, freq1, dur, type, peak, when, slideCurve) {
    const c = ac(); if (!c || muted) return;
    const t0 = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, freq0), t0);
    if (slideCurve === "lin") o.frequency.linearRampToValueAtTime(Math.max(1, freq1), t0 + dur);
    else o.frequency.exponentialRampToValueAtTime(Math.max(1, freq1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  // One shared 1s decaying-noise buffer, built once — per-call buffer allocation
  // caused frame spikes when several explosions landed together (wave-20 boss contact).
  let noiseBuf = null;
  function getNoiseBuf(c) {
    if (noiseBuf) return noiseBuf;
    const len = c.sampleRate;
    noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return noiseBuf;
  }

  function noise(dur, peak, when, filterFreq, filterQ) {
    const c = ac(); if (!c || muted) return;
    const t0 = c.currentTime + (when || 0);
    const src = c.createBufferSource();
    src.buffer = getNoiseBuf(c);
    src.playbackRate.value = (1 / dur) * (0.9 + Math.random() * 0.2); // squeeze 1s buffer into dur, slight variance
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filterFreq || 2200; f.Q.value = filterQ || 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // Explosions bunch up in big moments — cap how often the heavy layers fire.
  let lastExplode = 0;
  function explodeThrottled() {
    const now = performance.now();
    if (now - lastExplode < 70) return false;
    lastExplode = now;
    return true;
  }

  const rnd = (a, b) => a + Math.random() * (b - a);

  VK.audio = {
    unlock() { ac(); },
    setMuted(m) { muted = m; if (m) VK.audio.stopMusic(); },
    isMuted() { return muted; },

    shot() { tone(rnd(820, 900), rnd(300, 360), 0.07, "square", 0.05); },
    pop() { tone(rnd(500, 620), 140, 0.1, "triangle", 0.12); noise(0.06, 0.06, 0, 3200); },
    explode(big) {
      if (!explodeThrottled() && !big) return;
      noise(big ? 0.6 : 0.28, big ? 0.4 : 0.2, 0, big ? 900 : 1400);
      tone(big ? 120 : 160, 40, big ? 0.5 : 0.25, "sawtooth", big ? 0.25 : 0.14);
    },
    crack() { tone(700, 1400, 0.06, "square", 0.08); tone(500, 900, 0.06, "square", 0.07, 0.05); },
    novaPulse() { tone(90, 260, 0.22, "sine", 0.22, 0, "lin"); noise(0.18, 0.08, 0, 700); },
    towerHit() { tone(140, 70, 0.14, "sawtooth", 0.2); noise(0.1, 0.1, 0, 800); },
    alarm() { tone(660, 660, 0.09, "square", 0.06); tone(520, 520, 0.09, "square", 0.06, 0.12); },
    coin() { tone(880, 1320, 0.07, "square", 0.045); },
    upgrade() { [523, 659, 784].forEach((f, i) => tone(f, f, 0.1, "square", 0.09, i * 0.06)); },
    deny() { tone(200, 140, 0.12, "square", 0.08); },
    waveStart() { tone(196, 392, 0.18, "sawtooth", 0.14, 0, "lin"); tone(392, 392, 0.12, "square", 0.1, 0.16); },
    bossHorn() { [98, 98, 78].forEach((f, i) => tone(f, f * 0.98, 0.34, "sawtooth", 0.22, i * 0.36)); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.18, "square", 0.11, i * 0.1)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.97, 0.3, "sawtooth", 0.13, i * 0.22)); },

    // Minimal generative pulse loop, only during waves.
    startMusic() {
      if (muted || musicOn || !ac()) return;
      musicOn = true; musicStep = 0;
      const bass = [55, 55, 65.4, 49];
      musicTimer = setInterval(() => {
        if (muted) return;
        const b = bass[Math.floor(musicStep / 4) % 4];
        tone(b, b, 0.16, "triangle", 0.07);
        if (musicStep % 2 === 0) tone(b * 4, b * 4, 0.05, "square", 0.018);
        if (musicStep % 8 === 6) noise(0.05, 0.03, 0, 5000);
        musicStep++;
      }, 220);
    },
    stopMusic() { musicOn = false; if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
  };
})();
