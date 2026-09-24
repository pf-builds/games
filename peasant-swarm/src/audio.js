// Peasant Swarm audio — all synthesized, owned. SFX + battle drum while engaged, plus the fog tells (SPEC-v2 §12): the distant panned
// clash rumble (the one deliberate off-screen sound), the danger horn (a low war horn) and the ping tone.
// P1 (Peter's first playtest: "a lot of static ... it might have been something that grew over time"). The mix is a fixed graph plus
// short-lived cue voices, every number in config.audio:
// - master gain -> a DynamicsCompressor limiter -> destination. Its threshold sits near full scale: a compressor adds automatic makeup gain
//   (0.6 x the dB its curve takes off at full scale), so a -6 dB threshold made the whole mix ~2.5 dB louder; at -1 dB it is ~0.6 dB.
// - Lanes: the crowd sounds (hit, die, recruit) and the drum are persistent voices fed by one shared looping noise source, retriggered by
//   automation. They never create nodes, so a 600-agent melee cannot pile nodes up, and a lane never retriggers before its last envelope
//   has ended (its own gap, and the audio clock). The murmur is a lane too: one band-passed bed under a fixed ceiling.
// - Cues (everything else) are one-shot voices from a fixed pool. Each has its own output gain; every node disconnects when the voice's
//   last source ends (onended), and pump() reaps any voice audio.reapPad s past its stop time (a suspended context never fires onended).
// - The level bound: master x (the lanes' ceilings + the murmur + the live cues' peaks) stays under audio.ceiling. A cue that would cross
//   it plays quieter; the drum is scheduled on the audio clock by pump() (no timers).
// PS.audio.qa(true, nowFn) swaps in an OfflineAudioContext and a sim-time clock for PS.selfTest's audio part (nothing renders).
(function () {
  const PS = (window.PS = window.PS || {});
  let ctx = null, live = null, qa = null, C = null, muted = false, silent = false, unlocked = false, resumeSoon = false;
  const LAST = {};

  // no AudioContext exists until a user gesture unlocks it: creating or resuming one earlier only logs browser warnings (M2 critic BLOCKER-1).
  // iOS/Safari (SPEC-v2 §10, M7): the session is "ambient" where the browser offers it (the ringer switch mutes the game), the context is
  // resumed on every pointerup / touchend (iOS only lets a gesture's END start audio), on return to a visible tab and after an
  // "interrupted" state (a call, Siri), whichever comes first.
  function ac() {
    if (!unlocked || !C) return null;
    if (!ctx) {
      try {
        try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}
        ctx = new (window.AudioContext || window.webkitAudioContext)(); live = mkBus(ctx);
        ctx.onstatechange = () => { if (ctx.state === "interrupted" || ctx.state === "suspended") resumeSoon = true; };
      } catch (e) { return null; }
    }
    if (ctx.state === "suspended" || ctx.state === "interrupted") { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  const resumeNow = () => { if (unlocked && ctx && ctx.state !== "running" && ctx.state !== "closed") { try { ctx.resume(); } catch (e) {} } resumeSoon = false; };
  window.addEventListener("pointerup", () => { if (!unlocked) { unlocked = true; ac(); } else resumeNow(); }, true);
  window.addEventListener("touchend", () => { if (unlocked) resumeNow(); }, true);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) resumeNow(); else if (live) { live.muLvl = 0; live.mu.g.setTargetAtTime(0.0001, live.c.currentTime, 0.05); } });

  // the active bus: the QA one, else the live one (created on the first gesture); null while muted or silent (QA ignores both)
  function bus() { if (qa) return qa.b; if (silent || muted || !ac()) return null; return live; }
  const T = (b) => (qa ? qa.now() : b.c.currentTime);              // audio clock: scheduling
  const W = () => (qa ? qa.now() : performance.now() / 1000);       // gate clock
  // throttles: crowds fire the same sound hundreds of times a second
  function gate(k, ms) { const L = qa ? qa.last : LAST, n = W(); if (n - (L[k] || -1e9) < ms / 1000) return false; L[k] = n; return true; }
  const rnd = (a, b) => a + Math.random() * (b - a);

  const FLAT = {}; // one looping white-noise buffer per sample rate (the lanes' shared source, the cues' noise, the rumble)
  function getFlat(c) { const sr = c.sampleRate; if (FLAT[sr]) return FLAT[sr]; const nb = c.createBuffer(1, sr, sr), d = nb.getChannelData(0); for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1; return (FLAT[sr] = nb); }

  // ---------------------------------------------------------------- the bus: master, limiter, shared noise, lanes, the cue pool
  function mkBus(c) {
    const A = C, b = { c, fixed: 0, drum: { on: false, next: 0, step: 0 }, st: mkStats(), V: [], sumPk: 0, cues: 0, nodes: 0 };
    const m = c.createGain(); m.gain.value = A.master; let out = m; b.fixed++;
    if (c.createDynamicsCompressor) { const L = A.limiter, k = c.createDynamicsCompressor(); k.threshold.value = L.threshold; k.knee.value = L.knee; k.ratio.value = L.ratio; k.attack.value = L.attack; k.release.value = L.release; m.connect(k); out = k; b.fixed++; b.lim = k; }
    out.connect(c.destination); b.master = m;
    const nz = c.createBufferSource(); nz.buffer = getFlat(c); nz.loop = true; nz.start(); b.nz = nz; b.fixed++;
    const tl = (type) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; g.gain.value = 0; o.connect(g).connect(m); o.start(); b.fixed += 2; return { o, g: g.gain, free: 0 }; };
    const nl = (type, f, q) => { const fl = c.createBiquadFilter(), g = c.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; nz.connect(fl).connect(g).connect(m); b.fixed += 2; return { f: fl, g: g.gain, free: 0 }; };
    const H = A.hit, D = A.die, R = A.recruit, K = A.drum, M = A.murmur;
    b.hitT = tl("square"); b.hitN = nl("lowpass", H.noiseHz, 0.7); b.dieT = tl("sawtooth"); b.dieN = nl("lowpass", D.noiseHz, 0.7); b.rec = tl("square");
    b.kick = tl("sine"); b.snare = nl("lowpass", K.snareHz[0], K.snareQ[0]);
    b.mu = nl("bandpass", M.hz[0], M.q); b.mu.g.value = 0.0001; b.muLvl = 0;
    b.lanes = H.tonePeak + H.noisePeak + D.tonePeak + D.noisePeak + R.peak + K.kickPeak + Math.max(K.snarePeak[0], K.snarePeak[1]); // the lanes' ceilings (pre-master)
    for (let i = 0; i < A.cueVoices; i++) b.V.push({ on: false, gen: 0, peak: 0, end: 0, n: 0, srcs: 0, done: 0, out: null, nodes: [], pn: 0, P: new Float64Array(96) });
    return b;
  }
  function mkStats() { return { calls: {}, plays: {}, cues: 0, closed: 0, reaped: 0, dropped: 0, ducked: 0, maxNodes: 0, maxLevel: 0, maxCues: 0 }; }
  const level = (b) => b.lanes + b.muLvl + b.sumPk; // pre-master
  function note(b) { const n = b.fixed + b.nodes; if (n > b.st.maxNodes) b.st.maxNodes = n; const l = level(b) * C.master; if (l > b.st.maxLevel) b.st.maxLevel = l; if (b.cues > b.st.maxCues) b.st.maxCues = b.cues; }
  const count = (b, k, plays) => { const o = plays ? b.st.plays : b.st.calls; o[k] = (o[k] || 0) + 1; };
  const pre = (k) => { const b = qa ? qa.b : live; if (b) count(b, k, false); }; // every call, before its gate (the gates' QA)

  // ---------------------------------------------------------------- lanes: retrigger only once the lane's last envelope has ended
  function laneTone(b, L, f0, f1, dur, peak, t, lin) {
    if (t < L.free) return false; const p = L.o.frequency, g = L.g;
    p.setValueAtTime(Math.max(1, f0), t); if (lin) p.linearRampToValueAtTime(Math.max(1, f1), t + dur); else p.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.setValueAtTime(0.0001, t); g.exponentialRampToValueAtTime(peak, t + 0.006); g.exponentialRampToValueAtTime(0.0001, t + dur); g.setValueAtTime(0, t + dur + 0.002);
    L.free = t + dur + 0.004; return true;
  }
  function laneNoise(b, L, dur, peak, t, hz, q) {
    if (t < L.free) return false; const g = L.g;
    if (hz) { L.f.frequency.setValueAtTime(hz, t); L.f.Q.setValueAtTime(q, t); }
    g.setValueAtTime(peak, t); g.exponentialRampToValueAtTime(0.0001, t + dur); g.setValueAtTime(0, t + dur + 0.002);
    L.free = t + dur + 0.004; return true;
  }

  // ---------------------------------------------------------------- cue voices: a fixed pool; every node disconnects when the voice ends
  function vOpen(b, now) {
    reap(b, now); let v = null; for (let i = 0; i < b.V.length; i++) if (!b.V[i].on) { v = b.V[i]; break; }
    if (!v) { b.st.dropped++; return null; }
    v.on = true; v.gen++; v.peak = 0; v.end = now; v.n = 0; v.srcs = 0; v.done = 0; v.pn = 0; b.cues++; b.st.cues++;
    v.out = b.c.createGain(); v.nodes[v.n++] = v.out; b.nodes++; return v;
  }
  function vAdd(b, v, node) { v.nodes[v.n++] = node; b.nodes++; }
  // a partial's level over [s, e): the voice's peak is the most its partials sum to at once (a sequence of notes is not a chord)
  function vPart(v, s, e, p) { if (v.pn < 32) { const P = v.P, k = 3 * v.pn++; P[k] = s; P[k + 1] = e; P[k + 2] = p; } else v.peak += p; }
  function vPeak(v) { const P = v.P; let m = 0; for (let i = 0; i < v.pn; i++) { const s = P[3 * i]; let sum = 0; for (let j = 0; j < v.pn; j++) if (P[3 * j] <= s && s < P[3 * j + 1]) sum += P[3 * j + 2]; if (sum > m) m = sum; } return v.peak + m; }
  function vSrc(b, v, src, t0, stop) {
    src.start(t0); src.stop(stop); if (stop > v.end) v.end = stop; v.srcs++;
    const g = v.gen; src.onended = () => { if (v.on && v.gen === g && ++v.done >= v.srcs) vClose(b, v, false); };
  }
  // close: the voice's level bound is applied (a voice that would cross audio.ceiling plays at the headroom left, or not at all)
  function vShip(b, v, to) {
    v.peak = vPeak(v); const room = C.ceiling / C.master - b.lanes - C.murmur.max - b.sumPk, k = v.peak > room ? Math.max(0, room) / v.peak : 1;
    if (k < C.minDuck) { for (let i = 0; i < v.n; i++) { const s = v.nodes[i]; if (s.stop) { s.onended = null; try { s.stop(); } catch (e) {} } } v.peak = 0; vClose(b, v, false); b.st.dropped++; return; } // (never added to sumPk)
    if (k < 1) b.st.ducked++; v.out.gain.value = k; v.peak *= k; b.sumPk += v.peak; v.out.connect(to || b.master); note(b);
  }
  function vClose(b, v, reaped) {
    for (let i = 0; i < v.n; i++) { try { v.nodes[i].disconnect(); } catch (e) {} v.nodes[i] = null; }
    b.nodes -= v.n; v.n = 0; v.on = false; v.out = null; b.cues--; b.sumPk -= v.peak; v.peak = 0; if (b.cues === 0) b.sumPk = 0; b.st.closed++; if (reaped) b.st.reaped++;
  }
  function reap(b, now) { for (let i = 0; i < b.V.length; i++) { const v = b.V[i]; if (v.on && now > v.end + C.reapPad) vClose(b, v, true); } }

  // a tone or a noise burst inside a cue voice (when: seconds from now)
  function tone(b, v, f0, f1, dur, type, peak, when, lin) {
    const c = b.c, t0 = T(b) + (when || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(1, f0), t0);
    if (lin) o.frequency.linearRampToValueAtTime(Math.max(1, f1), t0 + dur); else o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(v.out); vAdd(b, v, o); vAdd(b, v, g); vSrc(b, v, o, t0, t0 + dur + 0.03); vPart(v, t0, t0 + dur, peak);
  }
  function noise(b, v, dur, peak, when, ff, q) {
    const c = b.c, t0 = T(b) + (when || 0), src = c.createBufferSource(); src.buffer = getFlat(c); src.loop = true; src.playbackRate.value = rnd(0.9, 1.1);
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = ff || 2200; f.Q.value = q || 0.7;
    const g = c.createGain(); g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(v.out); vAdd(b, v, src); vAdd(b, v, f); vAdd(b, v, g); vSrc(b, v, src, t0, t0 + dur + 0.05); vPart(v, t0, t0 + dur, peak);
  }
  // bursts of one noise source (a crowd, footsteps): n bumps every gap s, each decaying over dur; the filter moves per bump
  function bursts(b, v, n, gap, dur, peak, ff0, ff1, q, when) {
    const c = b.c, t0 = T(b) + (when || 0), src = c.createBufferSource(); src.buffer = getFlat(c); src.loop = true;
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0);
    for (let i = 0; i < n; i++) { const t = t0 + i * gap; f.frequency.setValueAtTime(rnd(ff0, ff1), t); g.gain.setTargetAtTime(peak, t, 0.004); g.gain.setTargetAtTime(0.0001, t + 0.012, dur / 6.5); } // -57 dB at dur, as an exponential ramp
    src.connect(f).connect(g).connect(v.out); vAdd(b, v, src); vAdd(b, v, f); vAdd(b, v, g); vSrc(b, v, src, t0, t0 + (n - 1) * gap + dur + 0.1); vPart(v, t0, t0 + (n - 1) * gap + dur, peak * 1.1); // a bump lands on the last one's tail
  }
  // notes on one oscillator (never overlapping): [delay, f0, f1, dur, peak] rows
  function seq(b, v, type, rows, when) {
    const c = b.c, t0 = T(b) + (when || 0), o = c.createOscillator(), g = c.createGain(); o.type = type; g.gain.setValueAtTime(0.0001, t0); let end = t0, pk = 0;
    for (const r of rows) { const t = t0 + r[0]; o.frequency.setValueAtTime(r[1], t); o.frequency.exponentialRampToValueAtTime(r[2], t + r[3]); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(r[4], t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + r[3]); if (t + r[3] > end) end = t + r[3]; if (r[4] > pk) pk = r[4]; }
    o.connect(g).connect(v.out); vAdd(b, v, o); vAdd(b, v, g); vSrc(b, v, o, t0, end + 0.03); vPart(v, t0, end, pk);
  }
  // a cue: gate, voice, build, ship (one line per sound below)
  function cue(k, ms, build, to) { pre(k); if (ms && !gate(k, ms)) return; const b = bus(); if (!b) return; const v = vOpen(b, T(b)); if (!v) return; build(b, v); vShip(b, v, to ? to(b, v) : null); count(b, k, true); }
  // a stereo panner when the browser has one (a node of the voice), else straight through
  function panTo(pan) { return (b, v) => { if (!b.c.createStereoPanner) return null; const p = b.c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(b.master); vAdd(b, v, p); return p; }; }

  // ---------------------------------------------------------------- the drum: steps scheduled on the audio clock by pump()
  function drumStep(b, s, t) {
    const K = C.drum;
    if (s === 0 || s === 3 || s === 5) { if (laneTone(b, b.kick, 110, 45, 0.18, K.kickPeak, t)) count(b, "kick", true); if (laneNoise(b, b.snare, 0.06, K.snarePeak[0], t, K.snareHz[0], K.snareQ[0])) count(b, "snare", true); }
    if (s === 4 && laneNoise(b, b.snare, 0.12, K.snarePeak[1], t, K.snareHz[1], K.snareQ[1])) count(b, "snare", true);
  }
  function pumpDrum(b, now) {
    const d = b.drum, K = C.drum; if (!d.on) return;
    if (d.next < now) d.next = now; // a stall skips steps (never a burst to catch up)
    for (let i = 0; i < 8 && d.next < now + K.ahead; i++) { drumStep(b, d.step % 8, d.next); d.step++; d.next += K.step; }
  }

  PS.audio = {
    configure(a) { C = a; },
    unlock() { unlocked = true; ac(); },
    setMuted(m) { muted = m; if (m) { PS.audio.stopDrum(); PS.audio.murmur(0); } },
    setSilent(v) { silent = !!v; if (silent) { PS.audio.stopDrum(); if (live) { live.muLvl = 0; live.mu.g.setTargetAtTime(0.0001, live.c.currentTime, 0.05); } } },
    // nodes.live = the bus's fixed nodes (master, limiter, shared noise, lanes) + the live cue voices' nodes (the P1 leak check)
    state() { const b = qa ? qa.b : live; return { unlocked, ctx: ctx ? ctx.state : "none", murmur: !!b, resumeSoon, drum: b ? b.drum.on : false,
      nodes: b ? { live: b.fixed + b.nodes, fixed: b.fixed, cues: b.nodes, max: b.st.maxNodes } : null, cues: b ? { live: b.cues, max: b.st.maxCues, made: b.st.cues, closed: b.st.closed, reaped: b.st.reaped, dropped: b.st.dropped, ducked: b.st.ducked } : null,
      level: b ? { now: +(level(b) * C.master).toFixed(3), max: +b.st.maxLevel.toFixed(3), ceiling: C.ceiling, master: b.master.gain.value } : null, calls: b ? { ...b.st.calls } : null, plays: b ? { ...b.st.plays } : null }; },
    isMuted() { return muted; },
    // the crowd lanes: gated, and never retriggered before the lane's last envelope ends
    recruit() { pre("recruit"); if (!gate("r", C.recruit.gapMs)) return; const b = bus(); if (!b) return; if (laneTone(b, b.rec, rnd(520, 640), rnd(900, 1100), 0.08, C.recruit.peak, T(b))) count(b, "recruit", true); },
    hit() { const H = C.hit; pre("hit"); if (!gate("h", H.gapMs * rnd(1 - H.jitter, 1 + H.jitter))) return; const b = bus(); if (!b) return; const t = T(b);
      if (laneNoise(b, b.hitN, H.noiseDur, H.noisePeak, t)) count(b, "hit", true); laneTone(b, b.hitT, rnd(180, 240), 90, 0.06, H.tonePeak, t); },
    die(mine) { const D = C.die; pre("die"); if (!gate("d", D.gapMs * rnd(1 - D.jitter, 1 + D.jitter))) return; const b = bus(); if (!b) return; const t = T(b);
      if (laneTone(b, b.dieT, mine ? rnd(420, 480) : rnd(300, 360), 120, D.toneDur, D.tonePeak, t)) count(b, "die", true); laneNoise(b, b.dieN, 0.08, D.noisePeak, t); },
    rout(good) { cue("rout", 0, (b, v) => { if (good) [196, 262, 330, 392].forEach((f, i) => tone(b, v, f, f * 1.01, 0.22, "sawtooth", 0.16, i * 0.09)); else [330, 262, 196].forEach((f, i) => tone(b, v, f, f * 0.97, 0.3, "sawtooth", 0.16, i * 0.12)); noise(b, v, 0.5, 0.18, 0, 900); }); },
    power(kind) {
      const base = { speed: 660, armor: 440, frenzy: 330, rally: 262 }[kind] || 500;
      cue("power", 0, (b, v) => { [1, 1.25, 1.5].forEach((m, i) => tone(b, v, base * m, base * m, 0.1, "square", 0.08, i * 0.07)); if (kind === "rally") tone(b, v, 130, 260, 0.5, "sawtooth", 0.14, 0.2, true); });
    },
    eliminated() { cue("eliminated", 0, (b, v) => { tone(b, v, 240, 60, 0.5, "sawtooth", 0.18); noise(b, v, 0.4, 0.15, 0, 700); tone(b, v, 120, 40, 0.6, "square", 0.1, 0.1); }); },
    huddle(on) { cue("huddle", 0, (b, v) => tone(b, v, on ? 300 : 420, on ? 420 : 300, 0.07, "square", 0.04)); },
    bell() { cue("bell", 0, (b, v) => { seq(b, v, "triangle", [0, 0.5, 1].map((w) => [w, 880, 880 * 0.995, 0.35, 0.12])); seq(b, v, "sine", [0, 0.5, 1].map((w) => [w, 880 * 2.01, 880 * 2, 0.2, 0.05])); }); },
    win() { cue("win", 0, (b, v) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(b, v, f, f, 0.18, "square", 0.1, i * 0.1)); noise(b, v, 0.6, 0.1, 0.5, 4000); }); },
    lose() { cue("lose", 0, (b, v) => [392, 330, 262, 196].forEach((f, i) => tone(b, v, f, f * 0.97, 0.3, "sawtooth", 0.12, i * 0.22))); },
    click() { cue("click", 0, (b, v) => tone(b, v, 700, 500, 0.04, "square", 0.05)); },
    // distant clash through the dark: 3 s of low filtered noise and a few muffled thumps, panned toward it, quieter with distance
    rumble(pan, vol) {
      const peak = 0.16 * Math.max(0.2, Math.min(1, vol || 1));
      cue("rumble", 600, (b, v) => {
        const c = b.c, t0 = T(b), dur = 3, src = c.createBufferSource(); src.buffer = getFlat(c); src.loop = true; src.playbackRate.value = 0.6;
        const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 220; f.Q.value = 0.8;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.5); g.gain.setValueAtTime(peak, t0 + dur - 1); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f).connect(g).connect(v.out); vAdd(b, v, src); vAdd(b, v, f); vAdd(b, v, g); vSrc(b, v, src, t0, t0 + dur + 0.05); vPart(v, t0, t0 + dur, peak);
        const rows = []; for (let i = 0; i < 5; i++) rows.push([0.3 + i * 0.5 + Math.random() * 0.2, 70 + Math.random() * 20, 40, 0.22, peak * 1.2]); seq(b, v, "sine", rows);
      }, panTo(pan || 0));
    },
    // danger: an unseen rival is hunting you. A low war horn (the finale horn, lower)
    dangerHorn() { cue("dangerHorn", 2000, (b, v) => { [[98, 0], [147, 0.02]].forEach(([f, w]) => { tone(b, v, f * 0.94, f, 0.25, "sawtooth", 0.1, w, true); tone(b, v, f, f * 0.985, 1.0, "sawtooth", 0.12, w + 0.22, true); }); noise(b, v, 0.9, 0.05, 0.2, 400); }); },
    // the finale war horn (and Bully's first scent ping, a little quieter): the danger horn's voice a fifth higher, held longer
    warHorn(k) { k = k || 1; cue("warHorn", 1500, (b, v) => { [[147, 0], [220, 0.03]].forEach(([f, w]) => { tone(b, v, f * 0.94, f, 0.3, "sawtooth", 0.12 * k, w, true); tone(b, v, f, f * 0.99, 1.4, "sawtooth", 0.14 * k, w + 0.28, true); }); noise(b, v, 1.2, 0.05 * k, 0.25, 500); }); },
    // a later scent ping: one short low note (C1: the horn every 25 s would nag)
    scentNote() { cue("scentNote", 1000, (b, v) => tone(b, v, 110, 104, 0.35, "triangle", 0.1)); },
    // M6 spoils (SPEC-v2 §12): a relic taken (a bright rising chime), a chest opening (a wooden knock and a coin shimmer), a village joining
    // (a crowd cheer: bursts of bright noise over a rising shout; heard within encampments.cheer px through the dark), a muster milestone
    // (a short brass fanfare)
    relic() { cue("relic", 150, (b, v) => { [784, 988, 1175, 1568].forEach((f, i) => tone(b, v, f, f * 1.005, 0.14, "triangle", 0.09, i * 0.06)); tone(b, v, 392, 784, 0.25, "sine", 0.05, 0, true); }); },
    chest() { cue("chest", 200, (b, v) => { tone(b, v, 160, 110, 0.08, "square", 0.08); noise(b, v, 0.06, 0.08, 0, 900); [1319, 1568, 1976].forEach((f, i) => tone(b, v, f, f, 0.1, "sine", 0.05, 0.08 + i * 0.05)); }); },
    cheer() { cue("cheer", 1200, (b, v) => { bursts(b, v, 5, 0.12, 0.35, 0.07, 2600, 4000, 1.4, 0); tone(b, v, 330, 520, 0.6, "sawtooth", 0.05, 0.05, true); tone(b, v, 415, 660, 0.55, "sawtooth", 0.04, 0.15, true); }); },
    fanfare() { cue("fanfare", 800, (b, v) => [[392, 0], [523, 0.12], [659, 0.24], [784, 0.36], [659, 0.52], [784, 0.62]].forEach(([f, w], i) => tone(b, v, f, f * 1.003, i === 5 ? 0.5 : 0.14, "sawtooth", 0.09, w, true))); },
    // ping: a rout you did not see folded into its clash's ping
    ping() { cue("ping", 500, (b, v) => { tone(b, v, 740, 760, 0.22, "triangle", 0.07); tone(b, v, 1110, 1120, 0.18, "sine", 0.03, 0.05); }); },
    // M7 (SPEC-v2 §12): a remnant scattering (a rush of footsteps and a falling cry), the crown pulse (each broadcast while it is on you or
    // in the finale), the dawn chime at the bell, a bandit growl when bandits you can see go for your peasants, the crowd murmur by count
    scatter() { cue("scatter", 700, (b, v) => { bursts(b, v, 6, 0.06, 0.05, 0.07, 1400, 2000, 1.5, 0); tone(b, v, 520, 260, 0.45, "sawtooth", 0.05, 0.05, true); }); },
    crownPulse(mine) { cue("crownPulse", 1500, (b, v) => { tone(b, v, mine ? 392 : 330, mine ? 392 : 330, 0.5, "triangle", 0.07); tone(b, v, mine ? 784 : 660, mine ? 790 : 664, 0.4, "sine", 0.03, 0.04); }); },
    dawn() { cue("dawn", 2000, (b, v) => [659, 784, 988, 1319].forEach((f, i) => { tone(b, v, f, f, 1.2, "sine", 0.06, i * 0.18); tone(b, v, f * 2, f * 2, 0.6, "triangle", 0.015, i * 0.18); })); },
    growl() { cue("growl", 2500, (b, v) => { tone(b, v, 92, 70, 0.6, "sawtooth", 0.09, 0, true); tone(b, v, 98, 74, 0.6, "square", 0.04, 0.02, true); noise(b, v, 0.5, 0.05, 0, 300, 2); }); },
    // crowd murmur (SPEC-v2 §12): the one bed, band-passed noise whose level follows your count on a log scale up to audio.murmur.max
    murmur(n) {
      const b = qa ? qa.b : live, M = C && C.murmur; if (!b || !M) return;
      if (!qa && (silent || muted || n <= 0 || !ac())) { b.muLvl = 0; b.mu.g.setTargetAtTime(0.0001, b.c.currentTime, 0.2); return; }
      const t = T(b), v = n > 0 ? Math.min(M.max, M.k * Math.log2(1 + n / 4)) : 0.0001; b.muLvl = v; b.mu.g.setTargetAtTime(Math.max(0.0001, v), t, 0.4);
      b.mu.f.frequency.setTargetAtTime(M.hz[0] + Math.min(M.hz[1] - M.hz[0], n * M.hzK), t, 0.5); note(b);
    },
    startDrum() { const b = bus(); if (!b || b.drum.on) return; b.drum.on = true; b.drum.step = 0; b.drum.next = T(b); pumpDrum(b, T(b)); },
    stopDrum() { for (const b of [live, qa && qa.b]) if (b) b.drum.on = false; },
    drumOn() { const b = qa ? qa.b : live; return !!b && b.drum.on; },
    // once per sim tick and per frame: the drum's lookahead and the cue reap (both on the audio clock)
    pump() { const b = qa ? qa.b : live; if (!b) return; const now = T(b); reap(b, now); if (b.drum.on && (qa || (!silent && !muted))) pumpDrum(b, now); },
    // QA (PS.selfTest "audio"): on = true swaps in an OfflineAudioContext bus and the clock nowFn() (sim seconds) for gates and scheduling;
    // on = false disconnects that bus and restores the live one. Returns false when the browser has no OfflineAudioContext.
    qa(on, nowFn) {
      if (on) { const O = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!O || !C) return false; const c = new O(1, 22050, 22050); qa = { c, now: nowFn, last: {}, b: null }; qa.b = mkBus(c); return true; }
      if (qa) { const b = qa.b; for (const v of b.V) if (v.on) vClose(b, v, false); try { b.nz.stop(); b.master.disconnect(); } catch (e) {} qa = null; }
      return true;
    },
  };
})();
