// Greedy Deep — WebAudio synth + ambient drone. Click it! Studios, 2026.
//
// The 13-cue table from R4 §4, four M5 pickup cues, and the depth-reactive ambient
// drone ("the Deep").
// All synthesized through tone()/noise(). Audio context created only on first user
// gesture. Master gain and per-cue gain in config `audio` block.
//
// Core functions ac(), tone(), getNoise(), noise(), gate() and the startDrum()
// interval shape COPIED from peasant-swarm/src/audio.js (Click it! Studios).
(function () {
  "use strict";

  var A = (window.GDAudio = {});
  var ctx = null, master = null, muted = false, cfg = null;
  var amb = { on: false, timer: null, osc1: null, osc2: null, gain: null, lpf: null, step: 0 };

  // ---- Core functions copied from peasant-swarm/src/audio.js ----
  function ac() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : ((cfg && cfg.audio) ? cfg.audio.masterGain : 0.5);
        master.connect(ctx.destination);
      } catch (e) { return null; }
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(f0, f1, dur, type, peak, when) {
    var c = ac(); if (!c || muted) return;
    var t0 = c.currentTime + (when || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(1, f0), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  var noiseBuf = null;
  function getNoise(c) {
    if (noiseBuf) return noiseBuf;
    var len = c.sampleRate; noiseBuf = c.createBuffer(1, len, c.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return noiseBuf;
  }
  function noise(dur, peak, when, ff, q) {
    var c = ac(); if (!c || muted) return;
    var t0 = c.currentTime + (when || 0);
    var src = c.createBufferSource(); src.buffer = getNoise(c);
    src.playbackRate.value = (1 / dur) * (0.9 + Math.random() * 0.2);
    var f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = ff || 2200; f.Q.value = q || 0.7;
    var g = c.createGain(); g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master); src.start(t0); src.stop(t0 + dur + 0.05);
  }
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var last = {};
  function gate(k, ms) {
    var n = performance.now();
    if (n - (last[k] || 0) < ms) return false;
    last[k] = n; return true;
  }
  // ---- end peasant-swarm copy ----

  A.init = function (config) { cfg = config; };
  A.unlock = function () { ac(); };
  A.setMuted = function (m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : ((cfg && cfg.audio) ? cfg.audio.masterGain : 0.5);
    if (m) A.stopAmbient();
  };
  A.isMuted = function () { return muted; };
  A.masterGainValue = function () { return master ? master.gain.value : 0; };
  A.lastCue = null;

  function cg(name) { return (cfg && cfg.audio && cfg.audio.cueGains && cfg.audio.cueGains[name]) || 1.0; }
  function gt2(name, fallback) { return (cfg && cfg.audio && cfg.audio.gates && cfg.audio.gates[name]) || fallback; }

  A.play = function (cue, opts) {
    if (muted) return;
    // Record the REQUESTED cue before any gate/context check (requirement item 1)
    A.lastCue = cue;
    if (window.GD && window.GD.dbg) window.GD.dbg.lastCue = cue;
    if (!ac()) return;
    var fn = CUES[cue];
    if (fn) fn(cg(cue), opts || {});
  };

  var CUES = {};
  CUES.strike = function (g) {
    if (!gate("strike", gt2("strike", 40))) return;
    noise(0.045, 0.08 * g, 0, 1700); tone(rnd(300, 360), 140, 0.05, "square", 0.05 * g);
  };
  CUES.strikeCrit = function (g) {
    if (!gate("strikeCrit", gt2("strikeCrit", 60))) return;
    noise(0.045, 0.08 * g, 0, 1700); tone(rnd(300, 360), 140, 0.05, "square", 0.05 * g);
    tone(520, 180, 0.09, "sawtooth", 0.09 * g);
  };
  CUES.oreCrack = function (g) {
    if (!gate("oreCrack", gt2("oreCrack", 50))) return;
    tone(190, 85, 0.12, "sawtooth", 0.07 * g); noise(0.1, 0.07 * g, 0, 900);
  };
  CUES.orePop = function (g, opts) {
    if (!gate("orePop", gt2("orePop", 40))) return;
    var combo = Math.min(8, (opts && opts.combo) || 0);
    tone(rnd(700, 820) * Math.pow(1.06, combo), 1250, 0.06, "square", 0.06 * g);
  };
  CUES.cartDump = function (g) {
    noise(0.2, 0.13 * g, 0, 600, 1.4); tone(130, 65, 0.22, "sine", 0.1 * g);
  };
  CUES.lift = function (g, opts) {
    var dur = (opts && opts.dur) || 0.5;
    tone(70, 70, dur, "sawtooth", 0.05 * g); noise(dur, 0.04 * g, 0, 400);
  };
  CUES.hire = function (g) {
    [392, 523, 659].forEach(function (f, i) { tone(f, f, 0.12, "triangle", 0.09 * g, i * 0.06); });
    noise(0.06, 0.05 * g, 0.18, 700);
  };
  CUES.buy = function (g) {
    [523, 659, 784].forEach(function (f, i) { tone(f, f, 0.08, "square", 0.06 * g, i * 0.05); });
  };
  CUES.denied = function (g) {
    if (!gate("denied", gt2("denied", 120))) return;
    tone(230, 175, 0.09, "square", 0.06 * g);
  };
  CUES.bandBreak = function (g) {
    [660, 880, 1320].forEach(function (f, i) { tone(f, f, 0.35, "triangle", 0.12 * g, i * 0.12); });
    noise(0.5, 0.1 * g, 0, 3200);
  };
  CUES.hazard = function (g) {
    noise(0.65, 0.16 * g, 0, 400, 2.0); tone(95, 38, 0.7, "sawtooth", 0.14 * g);
  };
  CUES.milestone = function (g) {
    [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, f, 0.18, "square", 0.1 * g, i * 0.1); });
    noise(0.6, 0.1 * g, 0.5, 4000);
  };
  CUES.welcomeBack = function (g) {
    tone(880, 880 * 0.995, 0.35, "triangle", 0.12 * g);
    tone(880 * 2.01, 880 * 2, 0.2, "sine", 0.05 * g);
  };
  CUES.ui = function (g) {
    if (!gate("ui", gt2("ui", 30))) return;
    tone(700, 500, 0.035, "square", 0.045 * g);
  };

  // ---- M5 pickup cues: a bright ping for a gem, a creak and a chord for a chest,
  // a dull knock per geode crack, and a crunch plus a sparkle run when it bursts.
  CUES.gem = function (g) {
    if (!gate("gem", gt2("gem", 40))) return;
    tone(1320, 1320, 0.07, "triangle", 0.09 * g);
    tone(1760, 1980, 0.12, "sine", 0.07 * g, 0.05);
  };
  CUES.chestOpen = function (g) {
    noise(0.12, 0.08 * g, 0, 900, 1.6); tone(160, 110, 0.12, "sawtooth", 0.05 * g);
    [523, 659, 784, 1047].forEach(function (f, i) { tone(f, f, 0.12, "triangle", 0.08 * g, 0.1 + i * 0.07); });
  };
  CUES.geodeCrack = function (g) {
    if (!gate("geodeCrack", gt2("geodeCrack", 50))) return;
    noise(0.06, 0.12 * g, 0, 1400); tone(rnd(150, 180), 70, 0.08, "square", 0.06 * g);
  };
  CUES.geodeBurst = function (g) {
    noise(0.18, 0.14 * g, 0, 2400); tone(210, 60, 0.16, "sawtooth", 0.07 * g);
    [1047, 1319, 1568, 2093].forEach(function (f, i) { tone(f, f * 1.02, 0.08, "sine", 0.06 * g, 0.08 + i * 0.05); });
  };

  // ---- ambient drone: "the Deep" (R4 §4) ----
  A.startAmbient = function (depthFrac) {
    if (muted || amb.on) return;
    var c = ac(); if (!c) return;
    amb.on = true; amb.step = 0;
    var ac2 = cfg.audio.ambient;
    var hz = ac2.droneHz || 55;
    amb.gain = c.createGain(); amb.lpf = c.createBiquadFilter(); amb.lpf.type = "lowpass";
    var df = Math.min(1, depthFrac || 0);
    amb.gain.gain.value = ac2.gainMin + (ac2.gainMax - ac2.gainMin) * df;
    amb.lpf.frequency.value = ac2.lpfHigh - (ac2.lpfHigh - ac2.lpfLow) * df;
    amb.lpf.Q.value = 0.5;
    amb.osc1 = c.createOscillator(); amb.osc1.type = "sine"; amb.osc1.frequency.value = hz;
    amb.osc2 = c.createOscillator(); amb.osc2.type = "sine"; amb.osc2.frequency.value = hz * (ac2.beatRatio || 1.006);
    amb.osc1.connect(amb.lpf); amb.osc2.connect(amb.lpf);
    amb.lpf.connect(amb.gain).connect(master);
    amb.osc1.start(); amb.osc2.start();
    amb.timer = setInterval(function () {
      if (muted || !amb.on) return;
      var r = Math.random();
      if (r < (ac2.tinkChance || 0.3)) {
        tone(rnd(900, 1400), rnd(600, 900), 0.05, "sine", 0.02);
      } else if (r < (ac2.tinkChance || 0.3) + (ac2.dripChance || 0.2)) {
        tone(1250, 640, 0.06, "sine", 0.03);
        tone(1250, 640, 0.06, "sine", 0.015, 0.22);
      }
      amb.step++;
    }, ac2.stepMs || 2200);
  };
  A.updateAmbient = function (depthFrac) {
    if (!amb.on || !amb.gain) return;
    var ac2 = cfg.audio.ambient;
    var df = Math.min(1, depthFrac || 0);
    amb.gain.gain.value = ac2.gainMin + (ac2.gainMax - ac2.gainMin) * df;
    amb.lpf.frequency.value = ac2.lpfHigh - (ac2.lpfHigh - ac2.lpfLow) * df;
  };
  A.stopAmbient = function () {
    amb.on = false;
    if (amb.timer) { clearInterval(amb.timer); amb.timer = null; }
    try { if (amb.osc1) amb.osc1.stop(); } catch (e) {}
    try { if (amb.osc2) amb.osc2.stop(); } catch (e) {}
    try { if (amb.gain) amb.gain.disconnect(); } catch (e) {}
    amb.osc1 = amb.osc2 = amb.gain = amb.lpf = null;
  };
  A.isAmbientOn = function () { return amb.on; };
})();
