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
// P2 (Peter: "you can still hear the static at larger group size"): the synth (SND) takes its bus as a parameter, so the live bus, the QA
// bus and a render bus run the same code; every sound feeds one of six category gains (hit, die, melee, murmur, drum, other) under the
// master; PS.audio.log records every public call with its sim time; PS.audio.renderOffline(log, seconds) replays one into an
// OfflineAudioContext through SND and PS.audio.analyse(buffer) reads it (RMS, crest, spectral flatness, the share above 2 kHz, clipping).
// The analysis found the static: the murmur was band-passed noise growing with your count (half the noise-like energy at 700 agents, all
// of it on a march). So no crowd sound uses noise now: a hit is a square blip and a two-sine click, a death a sawtooth cry with a short
// low-passed tail, both held to a per-second voice and energy budget; one low melee bed (low-passed noise) follows the fighters you see;
// the murmur is a tonal bed (detuned triangles, each drifting on its own); the drum's snare is a low-passed triangle tick. The level bound
// counts audio.lanePeak (the lanes' and beds' clash RMS) instead of the lanes' ceilings, and the limiter sits at the -6 dBFS ceiling.
(function () {
  const PS = (window.PS = window.PS || {});
  let ctx = null, live = null, qa = null, C = null, muted = false, silent = false, unlocked = false, resumeSoon = false, drumWant = false, vol = 1;
  const LAST = {};
  const CATS = ["hit", "die", "melee", "murmur", "drum", "other"], MUTE = { hit: 0, die: 0, melee: 0, murmur: 0, drum: 0, other: 0 }; // the ?debug=1 mixer (never persisted)

  // no AudioContext exists until a user gesture unlocks it: creating or resuming one earlier only logs browser warnings (M2 critic BLOCKER-1).
  // iOS/Safari (SPEC-v2 §10, M7): the session is "ambient" where the browser offers it (the ringer switch mutes the game), the context is
  // resumed on every pointerup / touchend (iOS only lets a gesture's END start audio), on return to a visible tab and after an
  // "interrupted" state (a call, Siri), whichever comes first.
  function ac() {
    if (!unlocked || !C) return null;
    if (!ctx) {
      try {
        try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}
        ctx = new (window.AudioContext || window.webkitAudioContext)(); live = mkBus(ctx, MUTE);
        ctx.onstatechange = () => { if (ctx.state === "interrupted" || ctx.state === "suspended") resumeSoon = true; };
      } catch (e) { return null; }
    }
    if (ctx.state === "suspended" || ctx.state === "interrupted") { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  const resumeNow = () => { if (unlocked && ctx && ctx.state !== "running" && ctx.state !== "closed") { try { ctx.resume(); } catch (e) {} } resumeSoon = false; };
  window.addEventListener("pointerup", () => { if (!unlocked) { unlocked = true; ac(); } else resumeNow(); }, true);
  window.addEventListener("touchend", () => { if (unlocked) resumeNow(); }, true);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) resumeNow(); else if (live) { SND.murmur(live, 0); SND.melee(live, 0); } });

  // the active bus: the QA one, else the live one (created on the first gesture); null while muted or silent (QA ignores both)
  function bus() { if (qa) return qa.b; if (silent || muted || !ac()) return null; return live; }
  const T = (b) => (b.clock ? b.clock() : b.c.currentTime);              // audio clock: scheduling (a QA or render bus runs on sim time)
  const W = (b) => (b.clock ? b.clock() : performance.now() / 1000);     // gate clock
  // throttles: crowds fire the same sound hundreds of times a second
  function gate(b, k, ms) { const L = b.last, n = W(b); if (n - (L[k] || -1e9) < ms / 1000) return false; L[k] = n; return true; }
  let RNG = Math.random; const rnd = (a, b) => a + RNG() * (b - a); // (a render swaps in a seeded generator while it builds and feeds its bus)
  const seeded = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const FLAT = {}; // one looping white-noise buffer per sample rate (the lanes' shared source, the cues' noise, the rumble)
  function getFlat(c) { if (c.quiet) return c.quiet; const sr = c.sampleRate; if (FLAT[sr]) return FLAT[sr]; const nb = c.createBuffer(1, sr, sr), d = nb.getChannelData(0); for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1; return (FLAT[sr] = nb); } // (c.quiet: a render with o.noise false)

  // ---------------------------------------------------------------- the bus: master, limiter, category gains, shared noise, lanes, the cue pool
  // mute: a category map (0/1) for the category gains; noLim: no limiter (a render's A/B); clock: sim-time clock (QA and render buses)
  function mkBus(c, mute, noLim, clock) {
    const A = C, b = { c, clock: clock || null, last: clock ? {} : LAST, fixed: 0, drum: { on: false, next: 0, step: 0 }, st: mkStats(), V: [], sumPk: 0, cues: 0, nodes: 0, cat: {}, lim: null };
    const m = c.createGain(); m.gain.value = A.master * (clock ? 1 : vol); let out = m; b.fixed++;
    if (!noLim && c.createDynamicsCompressor) { const L = A.limiter, k = c.createDynamicsCompressor(); k.threshold.value = L.threshold; k.knee.value = L.knee; k.ratio.value = L.ratio; k.attack.value = L.attack; k.release.value = L.release; m.connect(k); out = k; b.fixed++; b.lim = k; }
    out.connect(c.destination); b.master = m;
    for (const k of CATS) { const g = c.createGain(); g.gain.value = mute && mute[k] ? 0 : 1; g.connect(m); b.cat[k] = g; b.fixed++; }
    const nz = c.createBufferSource(); nz.buffer = getFlat(c); nz.loop = true; nz.start(); b.nz = nz; b.fixed++;
    const lpf = (hz) => { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = hz; f.Q.value = 0.7; b.fixed++; return f; };
    const tl = (type, cat, lp) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; g.gain.value = 0; (lp ? o.connect(lpf(lp)) : o).connect(g).connect(b.cat[cat]); o.start(); b.fixed += 2; return { o, g: g.gain, free: 0 }; };
    const nl = (type, f, q, cat) => { const fl = c.createBiquadFilter(), g = c.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; nz.connect(fl).connect(g).connect(b.cat[cat]); b.fixed += 2; return { f: fl, g: g.gain, free: 0 }; };
    const H = A.hit, D = A.die, K = A.drum, M = A.murmur, E = A.melee;
    // P2: no noise in the hit (a square blip and a click: two sines through one low-pass), the drum (the kick and a low-passed triangle tick)
    // or the murmur (a tonal bed); a death keeps a short low-passed noise tail die.tailDb under its cry; the melee bed is the one noise bed
    b.hitT = tl("square", "hit"); const cf = lpf(H.clickLp), cg = c.createGain(); cg.gain.value = 0; cf.connect(cg).connect(b.cat.hit); b.hitC = { o: [0, 1].map(() => { const o = c.createOscillator(); o.connect(cf); o.start(); return o; }), g: cg.gain, free: 0 }; b.fixed += 3;
    b.dieT = tl("sawtooth", "die"); b.dieN = nl("lowpass", D.tailHz, 0.7, "die"); b.rec = tl("square", "other");
    b.kick = tl("sine", "drum"); b.tick = tl("triangle", "drum", K.tickLp);
    b.me = nl("lowpass", E.hz, E.q, "melee"); b.me.g.value = 0.0001; b.meLvl = 0; b.meT = -1e9;
    const ml = lpf(M.lp), mg = c.createGain(); mg.gain.value = 0.0001; ml.connect(mg).connect(b.cat.murmur); b.fixed++; b.mu = { g: mg.gain, v: [] }; b.muLvl = 0;
    for (const hz of M.hz) { const o = c.createOscillator(), g = c.createGain(), f = hz * (1 + M.detune * rnd(-1, 1)); o.type = "triangle"; o.frequency.value = f; g.gain.value = 0; o.connect(g).connect(ml); o.start(); b.fixed += 2; b.mu.v.push({ o, g: g.gain, hz: f, next: 0 }); }
    b.lanes = C.lanePeak; // the level bound's allowance for the lanes and the beds: their RMS in a 700-agent clash (P2; rarer peaks: the limiter)
    b.bud = { hit: mkBud(), die: mkBud() };
    for (let i = 0; i < A.cueVoices; i++) b.V.push({ on: false, gen: 0, peak: 0, end: 0, n: 0, srcs: 0, done: 0, out: null, nodes: [], pn: 0, P: new Float64Array(96) });
    return b;
  }
  const mkBud = () => ({ t: new Float64Array(16).fill(-1e9), e: new Float64Array(16), i: 0 });
  function mkStats() { return { calls: {}, plays: {}, cues: 0, closed: 0, reaped: 0, dropped: 0, ducked: 0, maxNodes: 0, maxLevel: 0, maxCues: 0 }; }
  const level = (b) => b.lanes + b.sumPk; // pre-master
  function note(b) { const n = b.fixed + b.nodes; if (n > b.st.maxNodes) b.st.maxNodes = n; const l = level(b) * C.master; if (l > b.st.maxLevel) b.st.maxLevel = l; if (b.cues > b.st.maxCues) b.st.maxCues = b.cues; }
  const count = (b, k, plays) => { const o = plays ? b.st.plays : b.st.calls; o[k] = (o[k] || 0) + 1; };
  const pre = (k) => { const b = qa ? qa.b : live; if (b) count(b, k, false); }; // every call, before its gate (the gates' QA)

  // ---------------------------------------------------------------- lanes: retrigger only once the lane's last envelope has ended
  // (floor: the level the fall reaches at dur, 0.0001 unless given; a higher floor is a slower fall, then 10 ms to silence: the kick's body)
  function laneTone(b, L, f0, f1, dur, peak, t, lin, floor) {
    if (t < L.free) return false; const p = L.o.frequency, g = L.g;
    p.setValueAtTime(Math.max(1, f0), t); if (lin) p.linearRampToValueAtTime(Math.max(1, f1), t + dur); else p.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.setValueAtTime(0.0001, t); g.exponentialRampToValueAtTime(peak, t + 0.006); g.exponentialRampToValueAtTime(Math.min(peak, floor || 0.0001), t + dur); g.linearRampToValueAtTime(0, t + dur + 0.01);
    L.free = t + dur + 0.012; return true;
  }
  function laneNoise(b, L, dur, peak, t, hz, q) {
    if (t < L.free) return false; const g = L.g;
    if (hz) { L.f.frequency.setValueAtTime(hz, t); L.f.Q.setValueAtTime(q, t); }
    g.setValueAtTime(peak, t); g.exponentialRampToValueAtTime(0.0001, t + dur); g.setValueAtTime(0, t + dur + 0.002);
    L.free = t + dur + 0.004; return true;
  }

  // the hit's click: both sines retuned, one 1 ms attack and an exponential fall over dur
  function laneClick(b, L, f1, f2, dur, peak, t) {
    if (t < L.free) return false; L.o[0].frequency.setValueAtTime(f1, t); L.o[1].frequency.setValueAtTime(f2, t);
    const g = L.g; g.setValueAtTime(0.0001, t); g.exponentialRampToValueAtTime(peak, t + 0.001); g.exponentialRampToValueAtTime(0.0001, t + dur); g.setValueAtTime(0, t + dur + 0.002);
    L.free = t + dur + 0.004; return true;
  }
  // P2 per-category loudness budget (hits, deaths): at most B.perSec plays in any second, and at most B.energy full-level plays' worth of
  // energy (level squared) in any second; a play gets the level the energy left allows, and is skipped under B.minLevel. Independent of
  // how many agents fight: 700 fighting fill the same budget 60 do. The ring holds the last perSec plays (at most 16).
  function budget(R, B, t) {
    const n = Math.min(16, B.perSec); let used = 0, cnt = 0; for (let j = 0; j < n; j++) if (t - R.t[j] < 1) { used += R.e[j]; cnt++; }
    if (cnt >= n) return 0; const lv = Math.min(1, Math.sqrt(Math.max(0, B.energy - used))); if (lv < B.minLevel) return 0;
    R.t[R.i] = t; R.e[R.i] = lv * lv; R.i = (R.i + 1) % n; return lv;
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
    v.peak = vPeak(v) * C.cueGain; const room = C.ceiling / C.master - b.lanes - b.sumPk, k = v.peak > room ? Math.max(0, room) / v.peak : 1;
    if (k < C.minDuck) { for (let i = 0; i < v.n; i++) { const s = v.nodes[i]; if (s.stop) { s.onended = null; try { s.stop(); } catch (e) {} } } v.peak = 0; vClose(b, v, false); b.st.dropped++; return; } // (never added to sumPk)
    if (k < 1) b.st.ducked++; v.out.gain.value = k * C.cueGain; v.peak *= k; b.sumPk += v.peak; v.out.connect(to || b.cat.other); note(b);
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
  function cue(b, k, ms, build, to) { if (ms && !gate(b, k, ms)) return; const v = vOpen(b, T(b)); if (!v) return; build(b, v); vShip(b, v, to ? to(b, v) : null); count(b, k, true); }
  // a stereo panner when the browser has one (a node of the voice), else straight through
  function panTo(pan) { return (b, v) => { if (!b.c.createStereoPanner) return null; const p = b.c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(b.cat.other); vAdd(b, v, p); return p; }; }

  // ---------------------------------------------------------------- the drum: steps scheduled on the audio clock by pump()
  function drumStep(b, s, t) {
    const K = C.drum, j = s === 4 ? 1 : 0; // steps 0, 3, 5: the kick and a short tick; step 4: the accent tick
    if ((s === 0 || s === 3 || s === 5) && laneTone(b, b.kick, 110, 45, K.kickDur, K.kickPeak, t, false, K.kickPeak * K.kickFloor)) count(b, "kick", true);
    if ((j || s === 0 || s === 3 || s === 5) && laneTone(b, b.tick, K.tickHz[j], K.tickHz[j] * 0.8, K.tickDur[j], K.tickPeak[j], t)) count(b, "tick", true);
  }
  function pumpDrum(b, now) {
    const d = b.drum, K = C.drum; if (!d.on) return;
    if (d.next < now) d.next = now; // a stall skips steps (never a burst to catch up)
    for (let i = 0; i < 8 && d.next < now + K.ahead; i++) { drumStep(b, d.step % 8, d.next); d.step++; d.next += K.step; }
  }

  // the murmur voices' slow life (P2): each voice, every murmur.amSec s (at random), glides to a new level in murmur.am and a pitch within
  // murmur.drift of its own, so the bed swells and shifts like voices, never as one steady chord (called from pump and a render's steps)
  function murmurAM(b, now) {
    const M = C.murmur, V = b.mu.v; if (!(b.muLvl > 0)) return;
    for (let i = 0; i < V.length; i++) { const v = V[i]; if (now < v.next) continue; const d = rnd(M.amSec[0], M.amSec[1]); v.next = now + d;
      v.g.setTargetAtTime(rnd(M.am[0], M.am[1]) / V.length, now, d / 3); v.o.frequency.setTargetAtTime(v.hz * (1 + M.drift * rnd(-1, 1)), now, d / 2); }
  }

  // ---------------------------------------------------------------- SND: every sound, on the bus it is given (live, QA or a render)
  const SND = {
    // the crowd lanes: gated, and never retriggered before the lane's last envelope ends
    recruit(b) { if (!gate(b, "r", C.recruit.gapMs)) return; if (laneTone(b, b.rec, rnd(520, 640), rnd(900, 1100), 0.08, C.recruit.peak, T(b))) count(b, "recruit", true); },
    // hits and deaths (P2): spaced about 1 / perSec apart (+- jitter), under their loudness budget, never before the lane's envelope ends
    hit(b) { const H = C.hit, t = T(b); if (t < b.hitT.free || !gate(b, "h", (1000 / H.perSec) * rnd(1 - H.jitter, 1 + H.jitter))) return; const lv = budget(b.bud.hit, H, t); if (!lv) return;
      laneTone(b, b.hitT, rnd(180, 240), 90, H.toneDur, H.tonePeak * lv, t); laneClick(b, b.hitC, H.clickHz[0] * rnd(0.9, 1.1), H.clickHz[1] * rnd(0.9, 1.1), H.clickDur, H.clickPeak * lv, t); count(b, "hit", true); },
    die(b, mine) { const D = C.die, t = T(b); if (t < b.dieT.free || !gate(b, "d", (1000 / D.perSec) * rnd(1 - D.jitter, 1 + D.jitter))) return; const lv = budget(b.bud.die, D, t); if (!lv) return;
      laneTone(b, b.dieT, mine ? rnd(420, 480) : rnd(300, 360), 120, D.toneDur, D.tonePeak * lv, t); laneNoise(b, b.dieN, D.tailDur, D.tonePeak * lv * Math.pow(10, D.tailDb / 20), t); count(b, "die", true); },
    rout(b, good) { cue(b, "rout", 0, (b, v) => { if (good) [196, 262, 330, 392].forEach((f, i) => tone(b, v, f, f * 1.01, 0.22, "sawtooth", 0.16, i * 0.09)); else [330, 262, 196].forEach((f, i) => tone(b, v, f, f * 0.97, 0.3, "sawtooth", 0.16, i * 0.12)); noise(b, v, 0.5, 0.18, 0, 900); }); },
    power(b, kind) {
      const base = { speed: 660, armor: 440, frenzy: 330, rally: 262 }[kind] || 500;
      cue(b, "power", 0, (b, v) => { [1, 1.25, 1.5].forEach((m, i) => tone(b, v, base * m, base * m, 0.1, "square", 0.08, i * 0.07)); if (kind === "rally") tone(b, v, 130, 260, 0.5, "sawtooth", 0.14, 0.2, true); });
    },
    eliminated(b) { cue(b, "eliminated", 0, (b, v) => { tone(b, v, 240, 60, 0.5, "sawtooth", 0.18); noise(b, v, 0.4, 0.15, 0, 700); tone(b, v, 120, 40, 0.6, "square", 0.1, 0.1); }); },
    huddle(b, on) { cue(b, "huddle", 0, (b, v) => tone(b, v, on ? 300 : 420, on ? 420 : 300, 0.07, "square", 0.04)); },
    bell(b) { cue(b, "bell", 0, (b, v) => { seq(b, v, "triangle", [0, 0.5, 1].map((w) => [w, 880, 880 * 0.995, 0.35, 0.12])); seq(b, v, "sine", [0, 0.5, 1].map((w) => [w, 880 * 2.01, 880 * 2, 0.2, 0.05])); }); },
    win(b) { cue(b, "win", 0, (b, v) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(b, v, f, f, 0.18, "square", 0.1, i * 0.1)); noise(b, v, 0.6, 0.1, 0.5, 4000); }); },
    lose(b) { cue(b, "lose", 0, (b, v) => [392, 330, 262, 196].forEach((f, i) => tone(b, v, f, f * 0.97, 0.3, "sawtooth", 0.12, i * 0.22))); },
    click(b) { cue(b, "click", 0, (b, v) => tone(b, v, 700, 500, 0.04, "square", 0.05)); },
    // distant clash through the dark: 3 s of low filtered noise and a few muffled thumps, panned toward it, quieter with distance
    rumble(b, pan, vol) {
      const peak = 0.16 * Math.max(0.2, Math.min(1, vol || 1));
      cue(b, "rumble", 600, (b, v) => {
        const c = b.c, t0 = T(b), dur = 3, src = c.createBufferSource(); src.buffer = getFlat(c); src.loop = true; src.playbackRate.value = 0.6;
        const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 220; f.Q.value = 0.8;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.5); g.gain.setValueAtTime(peak, t0 + dur - 1); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f).connect(g).connect(v.out); vAdd(b, v, src); vAdd(b, v, f); vAdd(b, v, g); vSrc(b, v, src, t0, t0 + dur + 0.05); vPart(v, t0, t0 + dur, peak);
        const rows = []; for (let i = 0; i < 5; i++) rows.push([0.3 + i * 0.5 + rnd(0, 0.2), rnd(70, 90), 40, 0.22, peak * 1.2]); seq(b, v, "sine", rows);
      }, panTo(pan || 0));
    },
    // danger: an unseen rival is hunting you. A low war horn (the finale horn, lower)
    dangerHorn(b) { cue(b, "dangerHorn", 2000, (b, v) => { [[98, 0], [147, 0.02]].forEach(([f, w]) => { tone(b, v, f * 0.94, f, 0.25, "sawtooth", 0.1, w, true); tone(b, v, f, f * 0.985, 1.0, "sawtooth", 0.12, w + 0.22, true); }); noise(b, v, 0.9, 0.05, 0.2, 400); }); },
    // the finale war horn (and Bully's first scent ping, a little quieter): the danger horn's voice a fifth higher, held longer
    warHorn(b, k) { k = k || 1; cue(b, "warHorn", 1500, (b, v) => { [[147, 0], [220, 0.03]].forEach(([f, w]) => { tone(b, v, f * 0.94, f, 0.3, "sawtooth", 0.12 * k, w, true); tone(b, v, f, f * 0.99, 1.4, "sawtooth", 0.14 * k, w + 0.28, true); }); noise(b, v, 1.2, 0.05 * k, 0.25, 500); }); },
    // a later scent ping: one short low note (C1: the horn every 25 s would nag)
    scentNote(b) { cue(b, "scentNote", 1000, (b, v) => tone(b, v, 110, 104, 0.35, "triangle", 0.1)); },
    // M6 spoils (SPEC-v2 §12): a relic taken (a bright rising chime), a chest opening (a wooden knock and a coin shimmer), a village joining
    // (a crowd cheer: bursts of bright noise over a rising shout; heard within encampments.cheer px through the dark), a muster milestone
    // (a short brass fanfare)
    relic(b) { cue(b, "relic", 150, (b, v) => { [784, 988, 1175, 1568].forEach((f, i) => tone(b, v, f, f * 1.005, 0.14, "triangle", 0.09, i * 0.06)); tone(b, v, 392, 784, 0.25, "sine", 0.05, 0, true); }); },
    chest(b) { cue(b, "chest", 200, (b, v) => { tone(b, v, 160, 110, 0.08, "square", 0.08); noise(b, v, 0.06, 0.08, 0, 900); [1319, 1568, 1976].forEach((f, i) => tone(b, v, f, f, 0.1, "sine", 0.05, 0.08 + i * 0.05)); }); },
    cheer(b) { cue(b, "cheer", 1200, (b, v) => { bursts(b, v, 5, 0.12, 0.35, 0.07, 2600, 4000, 1.4, 0); tone(b, v, 330, 520, 0.6, "sawtooth", 0.05, 0.05, true); tone(b, v, 415, 660, 0.55, "sawtooth", 0.04, 0.15, true); }); },
    fanfare(b) { cue(b, "fanfare", 800, (b, v) => [[392, 0], [523, 0.12], [659, 0.24], [784, 0.36], [659, 0.52], [784, 0.62]].forEach(([f, w], i) => tone(b, v, f, f * 1.003, i === 5 ? 0.5 : 0.14, "sawtooth", 0.09, w, true))); },
    // ping: a rout you did not see folded into its clash's ping
    ping(b) { cue(b, "ping", 500, (b, v) => { tone(b, v, 740, 760, 0.22, "triangle", 0.07); tone(b, v, 1110, 1120, 0.18, "sine", 0.03, 0.05); }); },
    // M7 (SPEC-v2 §12): a remnant scattering (a rush of footsteps and a falling cry), the crown pulse (each broadcast while it is on you or
    // in the finale), the dawn chime at the bell, a bandit growl when bandits you can see go for your peasants, the crowd murmur by count
    scatter(b) { cue(b, "scatter", 700, (b, v) => { bursts(b, v, 6, 0.06, 0.05, 0.07, 1400, 2000, 1.5, 0); tone(b, v, 520, 260, 0.45, "sawtooth", 0.05, 0.05, true); }); },
    crownPulse(b, mine) { cue(b, "crownPulse", 1500, (b, v) => { tone(b, v, mine ? 392 : 330, mine ? 392 : 330, 0.5, "triangle", 0.07); tone(b, v, mine ? 784 : 660, mine ? 790 : 664, 0.4, "sine", 0.03, 0.04); }); },
    dawn(b) { cue(b, "dawn", 2000, (b, v) => [659, 784, 988, 1319].forEach((f, i) => { tone(b, v, f, f, 1.2, "sine", 0.06, i * 0.18); tone(b, v, f * 2, f * 2, 0.6, "triangle", 0.015, i * 0.18); })); },
    growl(b) { cue(b, "growl", 2500, (b, v) => { tone(b, v, 92, 70, 0.6, "sawtooth", 0.09, 0, true); tone(b, v, 98, 74, 0.6, "square", 0.04, 0.02, true); noise(b, v, 0.5, 0.05, 0, 300, 2); }); },
    // crowd murmur (SPEC-v2 §12; P2: tonal, no noise): murmur.hz triangles, each detuned, drifting and swelling on its own (murmurAM), through
    // one low-pass; the bed's level follows your count on a log scale, reaching murmur.max at murmur.full peasants and never more
    murmur(b, n) { const M = C.murmur, t = T(b), v = n > 0 ? M.max * Math.min(1, Math.log2(1 + n / M.k0) / Math.log2(1 + M.full / M.k0)) : 0; b.muLvl = v; b.mu.g.setTargetAtTime(Math.max(0.0001, v), t, v > 0 ? M.tau : 0.2); },
    // the melee bed (P2): one low-passed noise that fades in with the agents fighting where you see (instead of noise on every hit), up to
    // melee.max at melee.full fighters; retargeted at most every melee.every s unless it starts or stops
    melee(b, n) { const E = C.melee, t = T(b), v = n > 0 ? E.max * Math.min(1, Math.log2(1 + n / E.k0) / Math.log2(1 + E.full / E.k0)) : 0;
      if ((v > 0) === (b.meLvl > 0) && (t - b.meT < E.every || Math.abs(v - b.meLvl) < 0.02 * E.max)) return; b.meLvl = v; b.meT = t; b.me.g.setTargetAtTime(Math.max(0.0001, v), t, v > 0 ? E.tau : 0.3); },
    startDrum(b) { if (b.drum.on) return; b.drum.on = true; b.drum.step = 0; b.drum.next = T(b); pumpDrum(b, T(b)); },
    stopDrum(b) { b.drum.on = false; },
  };

  // ---------------------------------------------------------------- the event log (P2): every public call, its sim time and two numeric args
  // (a ring of cap entries; the murmur and the melee bed log only when their count changes, the drum only when it turns on or off)
  const KEYS = ["recruit", "hit", "die", "rout", "power", "eliminated", "huddle", "bell", "win", "lose", "click", "rumble", "dangerHorn", "warHorn", "scentNote", "relic", "chest", "cheer", "fanfare", "ping", "scatter", "crownPulse", "dawn", "growl", "murmur", "melee", "startDrum", "stopDrum"];
  const POW = ["speed", "armor", "frenzy", "rally"], KSTATE = 24; // keys from KSTATE on are state (murmur, melee, the drum on / off)
  const LOG = { on: false, clock: null, cap: 0, n: 0, t: null, k: null, a: null, b: null, mu: -1, me: -1 };
  function rec(k, x, y) { const L = LOG, i = L.n % L.cap; L.t[i] = L.clock(); L.k[i] = k; L.a[i] = typeof x === "string" ? POW.indexOf(x) : +x || 0; L.b[i] = +y || 0; L.n++; }
  // replay one logged call on bus b (a render)
  function replay(b, k, x, y) { const name = KEYS[k]; if (name === "power") SND.power(b, POW[x] || "speed"); else SND[name](b, x, y); }

  // ---------------------------------------------------------------- P2 analysis: a 2048-point FFT (radix 2, Hann), per second of a buffer
  let FF = null;
  const OCT = [250, 500, 1000, 2000, 4000, 8000], AW = [-8.6, -3.2, 0, 1.2, 1.0, -1.1].map((d) => Math.pow(10, d / 10)); // octave centres (Hz) and their A-weights (power)
  function fftInit(N) {
    const lg = Math.round(Math.log2(N)), F = { N, rev: new Uint16Array(N), cs: new Float64Array(N / 2), sn: new Float64Array(N / 2), win: new Float64Array(N), re: new Float64Array(N), im: new Float64Array(N), P: new Float64Array(N / 2 + 1), acc: new Float64Array(N / 2 + 1) };
    for (let i = 0; i < N; i++) { let r = 0; for (let k = 0; k < lg; k++) r |= ((i >> k) & 1) << (lg - 1 - k); F.rev[i] = r; F.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N); }
    for (let i = 0; i < N / 2; i++) { F.cs[i] = Math.cos((2 * Math.PI * i) / N); F.sn[i] = -Math.sin((2 * Math.PI * i) / N); }
    return F;
  }
  function fftPow(F, x, s) { // the power spectrum of x[s, s + N) under the Hann window, into F.P
    const N = F.N, re = F.re, im = F.im, cs = F.cs, sn = F.sn, P = F.P;
    for (let i = 0; i < N; i++) { const j = F.rev[i], v = x[s + i]; re[j] = (v === undefined ? 0 : v) * F.win[i]; im[j] = 0; }
    for (let size = 2; size <= N; size <<= 1) { const h = size >> 1, st = N / size; for (let i = 0; i < N; i += size) for (let j = 0, k = 0; j < h; j++, k += st) { const a = i + j, c = a + h, tr = re[c] * cs[k] - im[c] * sn[k], ti = re[c] * sn[k] + im[c] * cs[k]; re[c] = re[a] - tr; im[c] = im[a] - ti; re[a] += tr; im[a] += ti; } }
    for (let k = 0; k <= N / 2; k++) P[k] = re[k] * re[k] + im[k] * im[k];
  }

  PS.audio = {
    configure(a) { C = a; },
    unlock() { unlocked = true; ac(); },
    setMuted(m) { muted = m; if (m) { PS.audio.stopDrum(); PS.audio.murmur(0); PS.audio.melee(0); } },
    setSilent(v) { silent = !!v; if (silent) { PS.audio.stopDrum(); if (live) { SND.murmur(live, 0); SND.melee(live, 0); } } },
    // nodes.live = the bus's fixed nodes (master, limiter, category gains, shared noise, lanes) + the live cue voices' nodes (the P1 leak check)
    state() { const b = qa ? qa.b : live; return { unlocked, ctx: ctx ? ctx.state : "none", murmur: !!b, resumeSoon, drum: b ? b.drum.on : false,
      nodes: b ? { live: b.fixed + b.nodes, fixed: b.fixed, cues: b.nodes, max: b.st.maxNodes } : null, cues: b ? { live: b.cues, max: b.st.maxCues, made: b.st.cues, closed: b.st.closed, reaped: b.st.reaped, dropped: b.st.dropped, ducked: b.st.ducked } : null,
      level: b ? { now: +(level(b) * C.master).toFixed(3), max: +b.st.maxLevel.toFixed(3), ceiling: C.ceiling, master: b.master.gain.value } : null, calls: b ? { ...b.st.calls } : null, plays: b ? { ...b.st.plays } : null }; },
    isMuted() { return muted; },
    // the crowd murmur: the live bus fades out while muted or silent (QA ignores both)
    murmur(n) { if (LOG.on && n !== LOG.mu) { LOG.mu = n; rec(24, n, 0); } const b = qa ? qa.b : live; if (!b || !C) return; if (!qa && (silent || muted || !ac())) n = 0; SND.murmur(b, n); },
    melee(n) { if (LOG.on && n !== LOG.me) { LOG.me = n; rec(25, n, 0); } const b = qa ? qa.b : live; if (!b || !C) return; if (!qa && (silent || muted || !ac())) n = 0; SND.melee(b, n); },
    // the drum: wanted while you are engaged; pump() starts it on the bus once there is one (after a mute, the silent sandbox, the first gesture)
    startDrum() { if (drumWant) return; drumWant = true; if (LOG.on) rec(26, 0, 0); const b = bus(); if (b) SND.startDrum(b); },
    stopDrum() { if (LOG.on && drumWant) rec(27, 0, 0); drumWant = false; for (const b of [live, qa && qa.b]) if (b) SND.stopDrum(b); },
    drumOn() { return drumWant; },
    // once per sim tick and per frame: the drum's lookahead and the cue reap (both on the audio clock)
    pump() { const b = qa ? qa.b : live; if (!b) return; const now = T(b); reap(b, now); murmurAM(b, now); if (drumWant && !b.drum.on && bus() === b) SND.startDrum(b); if (b.drum.on && (qa || (!silent && !muted))) pumpDrum(b, now); },
    // QA (PS.selfTest "audio"): on = true swaps in an OfflineAudioContext bus and the clock nowFn() (sim seconds) for gates and scheduling;
    // on = false disconnects that bus and restores the live one. Returns false when the browser has no OfflineAudioContext.
    qa(on, nowFn) {
      if (on) { const O = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!O || !C) return false; const c = new O(1, 22050, 22050); qa = { c, b: mkBus(c, null, false, nowFn) }; return true; }
      if (qa) { const b = qa.b; for (const v of b.V) if (v.on) vClose(b, v, false); try { b.nz.stop(); b.master.disconnect(); } catch (e) {} qa = null; }
      return true;
    },
    // P2 event log. log(true, clock, cap): a fresh ring of cap entries, each call stamped clock() (sim seconds); log(false): stop.
    // log(): a copy in time order, { n, keys, t, k, a, b } (typed arrays; a / b: the call's two numeric args, a power kind as its index)
    log(on, clock, cap) {
      const L = LOG;
      if (on === undefined) { const n = Math.min(L.n, L.cap), s = L.n > L.cap ? L.n % L.cap : 0, o = { n, keys: KEYS, t: new Float64Array(n), k: new Uint8Array(n), a: new Float32Array(n), b: new Float32Array(n) };
        for (let i = 0; i < n; i++) { const j = (s + i) % L.cap; o.t[i] = L.t[j]; o.k[i] = L.k[j]; o.a[i] = L.a[j]; o.b[i] = L.b[j]; } return o; }
      L.on = !!on && typeof clock === "function"; L.clock = clock; L.n = 0; L.mu = L.me = -1;
      if (L.on) { L.cap = Math.max(1000, Math.min(1e6, cap | 0 || 200000)); if (!L.t || L.t.length !== L.cap) { L.t = new Float64Array(L.cap); L.k = new Uint8Array(L.cap); L.a = new Float32Array(L.cap); L.b = new Float32Array(L.cap); } }
      return L.on;
    },
    // P2: replay a log into an OfflineAudioContext through SND on a bus of its own (log time - o.t0 = render time; the state calls before
    // t0, murmur / melee / drum, are applied at 0). o: { t0, sr (44100), mute: { category: 1 }, limiter (false: bypassed), noise (false: every noise source silent, the
    // tonal part alone), seed (the synth's random draws: pitches, jitter, the murmur's drift; 1), step (s between
    // the render's suspends, where the calls land and the drum is pumped) }. Resolves to { data (Float32Array), sr, red (the limiter's
    // gain reduction in dB at every step), stats } or null without OfflineAudioContext. Live and QA sound is untouched meanwhile.
    renderOffline(log, seconds, o) {
      o = o || {}; const O = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!O || !C || !log || !(seconds > 0)) return Promise.resolve(null);
      const sr = o.sr || 44100, c = new O(1, Math.ceil(seconds * sr), sr); if (o.noise === false) c.quiet = c.createBuffer(1, sr, sr); const step = o.step || 0.05, t0 = o.t0 || 0, steps = Math.ceil(seconds / step) - 1, red = new Float32Array(steps + 1);
      let clk = 0, i = 0; const rng = seeded(o.seed || 1), live0 = RNG; RNG = rng; const b = mkBus(c, o.mute, o.limiter === false, () => clk); RNG = live0;
      const feed = (t) => { // (synchronous: the seeded generator stands in for Math.random only while it runs, so two renders of a log draw alike)
        const prev = RNG; RNG = rng;
        try { for (; i < log.n && log.t[i] - t0 < t + step; i++) { const at = log.t[i] - t0, k = log.k[i]; if (at < 0 && k < KSTATE) continue; clk = Math.max(t, at); replay(b, k, log.a[i], log.b[i]); }
          clk = t; reap(b, t); murmurAM(b, t); pumpDrum(b, t); } finally { RNG = prev; }
      };
      const at = (k) => c.suspend(k * step).then(() => { red[k] = b.lim ? b.lim.reduction : 0; feed(k * step); if (k < steps) at(k + 1); c.resume(); });
      feed(0); if (steps >= 1) at(1);
      return c.startRendering().then((buf) => { for (const v of b.V) if (v.on) vClose(b, v, false); return { data: buf.getChannelData(0), sr, red, stats: { cues: b.st.cues, dropped: b.st.dropped, ducked: b.st.ducked, maxNodes: b.st.maxNodes, plays: { ...b.st.plays } } }; });
    },
    // P2: per second of x (a rendered buffer at sr): RMS (dBFS), peak, crest factor (dB), spectral flatness over o.flatHz (0 = tonal,
    // 1 = white noise; a 2048-point Hann FFT, hop 1024, power averaged over the second, a -120 dB floor per bin), the share of power at or
    // above o.highHz (of all power above 20 Hz), and noisiness (the flatness inside each octave band 250 Hz - 8 kHz, weighted by the band's
    // A-weighted power: a spectral tilt does not read as noise, only energy spread evenly inside its own band does), aw (dB: the A-weighted
    // level over those bands) and nz (dB: its noise-like part, each band's A-weighted power x its flatness); the clipped samples.
    // o.spec: also a spectrogram, o.spec columns a second x o.rows log-spaced rows (40 Hz to sr / 2, top row highest), each a byte over
    // o.floor..0 dB (full-scale sine = 0 dB)
    analyse(x, sr, o) {
      o = o || {}; const N = 2048; if (!FF) FF = fftInit(N); const F = FF, P = F.P, acc = F.acc, bin = sr / N, fl = o.flatHz || [50, 10000], hi = o.highHz || 2000;
      const k0 = Math.max(1, Math.round(fl[0] / bin)), k1 = Math.min(N / 2, Math.round(fl[1] / bin)), kh = Math.ceil(hi / bin), kl = Math.ceil(20 / bin), eps = 1e-9, secs = Math.floor(x.length / sr), per = [];
      let clip = 0, peakAll = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v >= 1) clip++; if (v > peakAll) peakAll = v; }
      for (let s = 0; s < secs; s++) {
        const a = s * sr, e = a + sr; let ss = 0, pk = 0; for (let i = a; i < e; i++) { const v = x[i]; ss += v * v; const u = Math.abs(v); if (u > pk) pk = u; }
        acc.fill(0); let fr = 0; for (let st = a; st + N <= e; st += N / 2) { fftPow(F, x, st); for (let k = 0; k <= N / 2; k++) acc[k] += P[k]; fr++; }
        let lg = 0, ar = 0, tot = 0, up = 0; for (let k = k0; k <= k1; k++) { const p = acc[k] / fr + eps; lg += Math.log(p); ar += p; } for (let k = kl; k <= N / 2; k++) { tot += acc[k]; if (k >= kh) up += acc[k]; }
        let nw = 0, ne = 0; for (let j = 0; j < OCT.length; j++) { const a0 = Math.ceil((OCT[j] / Math.SQRT2) / bin), a1 = Math.min(N / 2, Math.floor((OCT[j] * Math.SQRT2) / bin)); if (a1 <= a0) continue; let bl = 0, ba = 0; for (let k = a0; k <= a1; k++) { const p = acc[k] / fr + eps; bl += Math.log(p); ba += p; } const m2 = a1 - a0 + 1, e = ba * AW[j]; nw += e * (Math.exp(bl / m2) / (ba / m2)); ne += e; }
        const rms = Math.sqrt(ss / sr), m = k1 - k0 + 1;
        per.push({ s, rms: rms > 0 ? +(20 * Math.log10(rms)).toFixed(2) : -200, peak: +pk.toFixed(4), crest: rms > 0 ? +(20 * Math.log10(pk / rms)).toFixed(2) : 0, flat: +(Math.exp(lg / m) / (ar / m)).toFixed(4), high: tot > 0 ? +(up / tot).toFixed(4) : 0, nois: ne > 0 ? +(nw / ne).toFixed(4) : 0,
          aw: +(10 * Math.log10((16 * ne) / (3 * N * N) + 1e-20)).toFixed(2), nz: +(10 * Math.log10((16 * nw) / (3 * N * N) + 1e-20)).toFixed(2) });
      }
      const out = { sr, seconds: secs, clipped: clip, peak: +peakAll.toFixed(4), per };
      if (o.spec) { // columns o.spec a second, rows o.rows (log-spaced), dB of the loudest bin in the row relative to a full-scale sine
        const cols = Math.floor((x.length - N) / (sr / o.spec)) + 1, rows = o.rows || 128, flo = o.floor || -110, ref = (N / 4) * (N / 4), img = new Uint8Array(rows * cols), f0 = 40, f1 = sr / 2;
        for (let cI = 0; cI < cols; cI++) { fftPow(F, x, Math.round(cI * (sr / o.spec)));
          for (let r = 0; r < rows; r++) { const fa = f0 * Math.pow(f1 / f0, r / rows), fb = f0 * Math.pow(f1 / f0, (r + 1) / rows); let mx = 0; for (let k = Math.floor(fa / bin); k <= Math.max(Math.floor(fa / bin), Math.ceil(fb / bin) - 1) && k <= N / 2; k++) if (P[k] > mx) mx = P[k];
            const db = 10 * Math.log10(mx / ref + 1e-30); img[(rows - 1 - r) * cols + cI] = Math.max(0, Math.min(255, Math.round((255 * (db - flo)) / -flo))); } }
        out.spec = { cols, rows, perSec: o.spec, floor: flo, f0, f1, img };
      }
      return out;
    },
    // P2 ?debug=1 mixer: mute a category (on = false) or not; the master volume (0..1). Neither is persisted.
    mix(cat, on) { if (!(cat in MUTE)) return false; MUTE[cat] = on ? 0 : 1; if (live) live.cat[cat].gain.setTargetAtTime(on ? 1 : 0, live.c.currentTime, 0.02); return true; },
    mixState() { const o = {}; for (const k of CATS) o[k] = !MUTE[k]; o.volume = vol; return o; },
    volume(v) { vol = Math.max(0, Math.min(1, +v || 0)); if (live) live.master.gain.setTargetAtTime(C.master * vol, live.c.currentTime, 0.02); return vol; },
    // the ?debug=1 readout: the limiter's gain reduction now (dB) and the voices sounding (lanes mid-envelope, live cues, the drum)
    meter() { const b = live; if (!b) return null; const t = T(b); let n = b.cues + (b.muLvl > 0 ? 1 : 0) + (b.meLvl > 0 ? 1 : 0); for (const L of [b.hitT, b.hitC, b.dieT, b.dieN, b.rec, b.kick, b.tick]) if (L.free > t) n++;
      return { red: b.lim ? +b.lim.reduction.toFixed(2) : 0, voices: n, cues: b.cues, murmur: +b.muLvl.toFixed(3), melee: +b.meLvl.toFixed(3) }; },
    categories: CATS,
  };
  // the public sound calls: log, count (pre), then SND on the active bus (murmur, melee and the drum have their own above)
  KEYS.forEach((name, k) => { if (PS.audio[name]) return; PS.audio[name] = (x, y) => { if (LOG.on) rec(k, x, y); pre(name); const b = bus(); if (b) SND[name](b, x, y); }; });
})();
