// Dinosaur Fight! — WebAudio synth SFX + jungle chiptune loop. All original.
window.DF = window.DF || {};

DF.Audio = (function () {
  let ac = null, master = null, musicGain = null, sfxGain = null;
  let enabled = true, musicTimer = null, noiseBuf = null;
  let musicVol = 0.34, sfxVol = 0.8;

  function ensure() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return true; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.connect(ac.destination);
      musicGain = ac.createGain(); musicGain.gain.value = musicVol; musicGain.connect(master);
      sfxGain = ac.createGain(); sfxGain.gain.value = sfxVol; sfxGain.connect(master);
      const len = ac.sampleRate;
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) { return false; }
  }

  function tone(type, f0, f1, t, vol = 0.5, delay = 0) {
    if (!enabled || !ensure()) return;
    const o = ac.createOscillator(), g = ac.createGain();
    const t0 = ac.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + t);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
    o.connect(g); g.connect(sfxGain);
    o.start(t0); o.stop(t0 + t + 0.02);
  }
  function noise(t, vol = 0.4, rate = 1, delay = 0, hp = 0) {
    if (!enabled || !ensure()) return;
    const s = ac.createBufferSource(), g = ac.createGain();
    const t0 = ac.currentTime + delay;
    s.buffer = noiseBuf; s.playbackRate.value = rate;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
    let node = s;
    if (hp) { const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp; s.connect(f); node = f; }
    node.connect(g); g.connect(sfxGain);
    s.start(t0); s.stop(t0 + t + 0.02);
  }

  // ---------------- music: bouncy jungle chiptune, 2 bars, ~112bpm ----------------
  const beat = 60 / 112 / 2; // 8th notes
  // C major pentatonic-ish, kid-happy
  const bass = [130.8, 0, 130.8, 0, 98, 0, 110, 0, 130.8, 0, 130.8, 0, 146.8, 0, 98, 0];
  const lead = [523, 0, 587, 659, 0, 523, 0, 440, 523, 659, 0, 784, 659, 0, 587, 0];
  function musicBar() {
    if (!enabled || !ac) return;
    const t0 = ac.currentTime + 0.05;
    for (let i = 0; i < 16; i++) {
      const t = t0 + i * beat;
      // toms
      if (i % 4 === 0) mtone("sine", 90, 45, beat * 0.9, 0.5, t);
      if (i % 4 === 2) mtone("sine", 70, 40, beat * 0.7, 0.35, t);
      // shaker
      mnoise(0.03, i % 2 ? 0.05 : 0.09, 2.4, t);
      if (bass[i]) mtone("triangle", bass[i], bass[i], beat * 0.85, 0.30, t);
      if (lead[i]) mtone("square", lead[i], lead[i], beat * 0.5, 0.055, t);
    }
  }
  function mtone(type, f0, f1, t, vol, at) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + t);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + t);
    o.connect(g); g.connect(musicGain);
    o.start(at); o.stop(at + t + 0.02);
  }
  function mnoise(t, vol, rate, at) {
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = noiseBuf; s.playbackRate.value = rate;
    const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 6000;
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + t);
    s.connect(f); f.connect(g); g.connect(musicGain);
    s.start(at); s.stop(at + t + 0.02);
  }

  let lastExplode = 0;

  return {
    get enabled() { return enabled; },
    setEnabled(v) {
      enabled = v;
      if (!v && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      if (v) this.startMusic();
    },
    setVols(m, s) { musicVol = m; sfxVol = s; if (musicGain) musicGain.gain.value = m; if (sfxGain) sfxGain.gain.value = s; },
    startMusic() {
      if (!enabled || !ensure()) return;
      if (musicTimer) return;
      musicBar();
      musicTimer = setInterval(musicBar, beat * 16 * 1000 - 20);
    },
    stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
    unlock() { ensure(); },

    jump() { tone("square", 300, 620, 0.14, 0.20); },
    djump() { tone("square", 420, 860, 0.16, 0.20); },
    stomp() {
      const now = performance.now();
      if (now - lastExplode < 60) return;
      lastExplode = now;
      tone("square", 250, 60, 0.16, 0.4); noise(0.12, 0.3, 1.4);
      tone("sine", 700, 1200, 0.1, 0.15, 0.05);
    },
    pounce() { noise(0.14, 0.22, 2.2, 0, 1200); tone("sawtooth", 200, 420, 0.12, 0.12); },
    thump() { tone("sine", 75, 38, 0.16, 0.4); noise(0.07, 0.12, 0.7); },
    shoot() { tone("square", 900, 200, 0.09, 0.18); noise(0.05, 0.15, 2.0); },
    ding() { tone("triangle", 1400, 1200, 0.12, 0.25); tone("triangle", 2100, 1900, 0.1, 0.12, 0.02); },
    hurt() { tone("sawtooth", 300, 90, 0.25, 0.35); tone("square", 150, 60, 0.2, 0.2, 0.03); },
    egg() { tone("sine", 700, 1050, 0.09, 0.3); tone("sine", 1050, 1400, 0.09, 0.22, 0.07); },
    heartPickup() { tone("sine", 523, 523, 0.1, 0.25); tone("sine", 659, 659, 0.1, 0.25, 0.09); tone("sine", 784, 784, 0.14, 0.25, 0.18); },
    grow() { tone("sawtooth", 120, 500, 0.3, 0.3); tone("square", 240, 1000, 0.3, 0.12); },
    shrink() { tone("sawtooth", 500, 120, 0.28, 0.25); tone("square", 1000, 240, 0.28, 0.1); },
    deny() { tone("square", 160, 140, 0.12, 0.2); },
    splash() { noise(0.35, 0.35, 0.8); tone("sine", 300, 90, 0.3, 0.2); },
    netted() { noise(0.2, 0.2, 1.6, 0, 800); tone("triangle", 500, 250, 0.25, 0.2); },
    netThrow() { noise(0.1, 0.15, 2.4, 0, 1500); },
    smash() {
      const now = performance.now();
      if (now - lastExplode < 60) return;
      lastExplode = now;
      noise(0.2, 0.4, 1.0); tone("square", 180, 60, 0.18, 0.3);
    },
    flagOpen() { [523, 659, 784, 1047].forEach((f, i) => tone("square", f, f, 0.14, 0.2, i * 0.09)); },
    checkpoint() { tone("sine", 880, 880, 0.1, 0.22); tone("sine", 1174, 1174, 0.16, 0.22, 0.1); },
    bossRoar() { tone("sawtooth", 90, 45, 0.7, 0.45); noise(0.5, 0.25, 0.6); },
    bossHit() { tone("square", 200, 70, 0.25, 0.4); noise(0.18, 0.35, 1.2); tone("sine", 900, 1400, 0.12, 0.2, 0.06); },
    win() {
      [392, 523, 659, 784, 1047].forEach((f, i) => tone("square", f, f, 0.22, 0.22, i * 0.13));
      [392, 523, 659, 784, 1047].forEach((f, i) => tone("triangle", f * 2, f * 2, 0.22, 0.1, i * 0.13));
    },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone("square", f, f * 0.95, 0.3, 0.2, i * 0.22)); },
    click() { tone("square", 700, 500, 0.05, 0.12); },
    // ---- World 2 ----
    roar(big) {
      tone("sawtooth", big ? 110 : 160, big ? 40 : 70, big ? 0.75 : 0.5, 0.5); noise(big ? 0.5 : 0.3, 0.3, 0.7);
      if (big) tone("sine", 60, 28, 0.8, 0.45, 0.05);
    },
    squeak() { tone("square", 1400, 1900, 0.08, 0.18); tone("square", 1900, 1500, 0.1, 0.14, 0.08); },
    bonk() { tone("triangle", 520, 300, 0.12, 0.3); noise(0.05, 0.2, 2.2, 0, 2500); },
    crumble() { noise(0.35, 0.35, 0.55); tone("square", 130, 45, 0.28, 0.3); },
    wade() { noise(0.1, 0.14, 1.1, 0, 600); tone("sine", 200, 120, 0.08, 0.1); },
    hatch() { [659, 784, 1047, 1319, 1568].forEach((f, i) => tone("sine", f, f, 0.16, 0.22, i * 0.1)); tone("triangle", 2093, 2093, 0.3, 0.12, 0.5); },
    engine() { tone("sawtooth", 55, 170, 0.6, 0.28); tone("square", 110, 340, 0.6, 0.08); },
    skid() { noise(0.35, 0.3, 1.8, 0, 1800); tone("sawtooth", 400, 120, 0.3, 0.12); },
    flip() { tone("square", 220, 60, 0.3, 0.4); noise(0.25, 0.4, 0.9); tone("triangle", 900, 1500, 0.15, 0.2, 0.12); },
  };
})();
