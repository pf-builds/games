// Quick Fox — profiles, LEARN / PLAY / TEST modes, drill engine, results. Click it! Studios, 2026.
(function () {
  const QF = (window.QF = window.QF || {});
  const $ = (id) => document.getElementById(id);
  const KEY = "quickfox.v1";
  const DEBUG = /(\?|&)debug=1/.test(location.search);
  const LS = { get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  let CFG = null, LESSONS = null, WORDS = null, SENT = null, COACH = null;
  const S = { screen: "title", db: null, profile: null, drill: null, lessonIdx: -1, play: null, kbDefaultDim: false, foxTimer: null };
  if (DEBUG) window.QFS = S;
  const now = () => performance.now();
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rnd(arr.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  // ---------------- storage / profiles ----------------
  function loadDb() { const d = LS.get(KEY, null); if (!d || d.v !== 1 || !Array.isArray(d.profiles)) return { v: 1, profiles: [], last: null, muted: false }; d.profiles = d.profiles.filter((p) => p && typeof p.name === "string"); return d; }
  function saveDb() { LS.set(KEY, S.db); }
  function newProfile(name) { return { id: Date.now().toString(36) + rnd(1e6).toString(36), name, created: Date.now(), lessons: {}, tests: [], errors: {}, playBest: 0, keys: 0 }; }
  function profileStars(p) { let s = 0; for (const id in p.lessons) s += p.lessons[id].stars || 0; return s; }
  function lessonsDone(p) { let n = 0; for (const L of LESSONS) if (p.lessons[L.id]) n++; return n; }
  function nextLessonIdx(p) { for (let i = 0; i < LESSONS.length; i++) if (!p.lessons[LESSONS[i].id]) return i; return LESSONS.length - 1; }
  function bestWpm(p) { let b = 0; for (const t of p.tests) b = Math.max(b, t.net); for (const id in p.lessons) b = Math.max(b, p.lessons[id].wpm || 0); return Math.round(b); }
  function avgAcc(p) { const arr = p.tests.slice(-5).map((t) => t.acc); for (const id in p.lessons) arr.push(p.lessons[id].acc); if (!arr.length) return null; return Math.round(100 * arr.reduce((a, b) => a + b, 0) / arr.length); }
  function weakKeys(p, n) { return Object.entries(p.errors).filter(([k, c]) => c >= 3 && /^[a-z;,./']$/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, n || 3); }

  // ---------------- boot ----------------
  async function boot() {
    const V = "?v=2";
    [CFG, LESSONS, WORDS, SENT, COACH] = await Promise.all(["config.json", "lessons.json", "words.json", "sentences.json", "coaching.json"].map((f) => fetch(f + V).then((r) => r.json())));
    LESSONS = LESSONS.lessons; WORDS = WORDS.words; SENT = SENT.sentences;
    S.db = loadDb(); QF.audio.setMuted(!!S.db.muted); syncSound();
    for (const id of ["fox-gate", "fox-title", "fox-hub", "fox-drill", "fox-result"]) QF.paintFox($(id), 0, 6);
    QF.KB.render($("keyboard"), CFG.fingerColors);
    const lg = $("legend"); lg.innerHTML = Object.entries(COACH.fingers).map(([c, n]) => "<span><i style='background:" + CFG.fingerColors[c] + "'></i>" + n + "</span>").join("");
    bindUI(); renderProfiles();
    let idle = 0; S.foxTimer = setInterval(() => { idle ^= 1; if (S.screen === "title") QF.paintFox($("fox-title"), idle, 6); }, 650);
    const coarse = matchMedia("(pointer:coarse)").matches, narrow = innerWidth < 800;
    if ((coarse || narrow) && !sessionStorage.getItem("qf.override")) show("gate"); else show("title");
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || S.drill || (S.play && S.play.running)) return;
      const fresh = loadDb(); if (JSON.stringify(fresh) === JSON.stringify(S.db)) return;
      S.db = fresh; if (S.profile) S.profile = fresh.profiles.find((p) => p.id === S.profile.id) || null;
      if (!S.profile && S.screen !== "title") { renderProfiles(); show("title"); } else if (S.screen === "hub") renderHub();
    });
    if (DEBUG) {
      QF.type = (text) => { for (const ch of text) onKey({ key: ch === "\b" ? "Backspace" : ch, preventDefault() {}, synthetic: true }); };
      QF.step = (sec) => { if (!S.play) return null; const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { if (S.play.running && !S.play.over) playUpdate(1 / 60); } return S.play.over ? "over" : S.play.running ? "play" : "waiting"; };
      QF.dbg = { profile: () => S.profile, db: () => S.db, drill: () => S.drill, unlockAll: () => { for (const L of LESSONS) S.profile.lessons[L.id] = { stars: 3, acc: 1, wpm: 40 }; saveDb(); renderHub(); }, gen: genDrill, finish: finishDrill, startLesson, startTest, startPlay, allowed: allowedChars, lessons: () => LESSONS };
    }
  }

  function show(id) { document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === "s-" + id)); S.screen = id; window.scrollTo(0, 0); }
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 1800); }
  function syncSound() { const m = QF.audio.isMuted(); document.querySelectorAll(".btn-sound").forEach((b) => b.classList.toggle("off", m)); }

  // ---------------- profiles UI ----------------
  function renderProfiles() {
    const box = $("profiles"); box.innerHTML = "";
    for (const p of S.db.profiles) {
      const chip = document.createElement("div"); chip.className = "pchip"; chip.tabIndex = 0;
      chip.innerHTML = "<canvas></canvas><span>" + escapeHtml(p.name) + "</span><span class='del' title='Remove player'>✕</span>";
      QF.paintFox(chip.querySelector("canvas"), 0, 2);
      chip.addEventListener("click", (e) => { if (e.target.classList.contains("del")) { if (confirm("Remove " + p.name + " and all their progress from this browser?")) { S.db.profiles = S.db.profiles.filter((x) => x.id !== p.id); saveDb(); renderProfiles(); } return; } selectProfile(p); });
      chip.addEventListener("keydown", (e) => { if (e.key === "Enter") selectProfile(p); });
      box.appendChild(chip);
    }
  }
  function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function selectProfile(p) { S.profile = p; S.db.last = p.id; saveDb(); QF.audio.unlock(); QF.audio.click(); renderHub(); show("hub"); }

  // ---------------- hub ----------------
  function renderHub() {
    const p = S.profile; if (!p) return;
    $("hub-name").textContent = p.name;
    const done = lessonsDone(p);
    $("hub-sub").textContent = done === 0 ? "Brand new. Start with LEARN." : done + " of " + LESSONS.length + " lessons · " + profileStars(p) + " stars";
    $("learn-progress").textContent = done >= LESSONS.length ? "Graduated. Replay any lesson." : "Next: " + (nextLessonIdx(p) + 1) + ". " + LESSONS[nextLessonIdx(p)].title;
    $("play-best").textContent = p.playBest ? "Best: level " + (p.playLevel || 1) + " · " + p.playBest + " pts" : "No score yet";
    $("test-best").textContent = p.tests.length ? "Last: " + Math.round(p.tests[p.tests.length - 1].net) + " wpm" : "No test yet";
    const bw = bestWpm(p); $("st-wpm").textContent = bw || "–"; $("st-wpm").className = bw ? "" : "none";
    const aa = avgAcc(p); $("st-acc").textContent = aa == null ? "–" : aa + "%"; $("st-acc").className = aa == null ? "none" : accClass(aa / 100);
    $("st-keys").textContent = p.keys.toLocaleString();
    $("st-stars").textContent = profileStars(p); $("st-stars").className = profileStars(p) ? "mid" : "none";
    $("m-learn").classList.toggle("promo", done < LESSONS.length);
    $("m-test").classList.toggle("promo", done >= LESSONS.length);
    QF.paintFox($("fox-hub"), done >= LESSONS.length ? 2 : 0, 6);
    const wk = weakKeys(p, 3); const w = $("weak-keys"); w.innerHTML = "";
    if (wk.length) {
      w.innerHTML = "<span>Keys that trip you up:</span>" + wk.map(([k, c]) => "<span class='k'>" + escapeHtml(k) + " ×" + c + "</span>").join("") + "<button class='small' id='btn-weak'>Drill these</button>";
      $("btn-weak").addEventListener("click", () => startWeakDrill(wk.map(([k]) => k)));
    }
  }

  function accClass(acc) { return acc >= CFG.stars.three ? "good" : acc >= CFG.stars.two ? "mid" : "low"; }

  // ---------------- lessons ----------------
  function letterSetUpTo(idx) { const set = new Set([" "]); for (let i = 0; i <= idx && i < LESSONS.length; i++) for (const k of LESSONS[i].keys) if (k !== "shift") set.add(k); return set; }
  function shiftIdx() { return LESSONS.findIndex((L) => L.type === "shift"); }
  function allowedChars(idx) { return { set: letterSetUpTo(idx), caps: idx >= shiftIdx() && shiftIdx() >= 0 }; }
  function textAllowed(text, allow) { for (const ch of text) { if (ch === " ") continue; const lo = ch.toLowerCase(); if (lo !== ch) { if (!allow.caps || !allow.set.has(lo)) return false; } else if (!allow.set.has(ch)) return false; } return true; }
  function wordsFor(allow) { return WORDS.filter((w) => textAllowed(w, allow)); }
  function genDrill(idx) {
    const L = LESSONS[idx], allow = allowedChars(idx), len = CFG.learn.drillLen[L.type] || 40;
    const newKeys = L.keys.filter((k) => k !== "shift");
    const learned = [...allow.set].filter((c) => c !== " " && !/[0-9'"?!\-]/.test(c));
    let out = [];
    const joinTo = (arr) => { let t = ""; for (const w of arr) { if (t.length >= len) break; t += (t ? " " : "") + w; } return t; };
    if (L.type === "keys") {
      const pool = newKeys.length ? newKeys : learned;
      const groups = [];
      while (joinTo(groups).length < len) {
        const g = [], gl = 2 + rnd(3);
        for (let i = 0; i < gl; i++) g.push(Math.random() < 0.65 || learned.length < 3 ? pick(pool) : pick(learned));
        groups.push(g.join(""));
      }
      return joinTo(groups);
    }
    if (L.type === "numbers") {
      const digits = newKeys.concat([...allow.set].filter((c) => /[0-9]/.test(c) && !newKeys.includes(c)));
      const groups = []; while (joinTo(groups).length < len) { const gl = 2 + rnd(3); let g = ""; for (let i = 0; i < gl; i++) g += Math.random() < 0.7 ? pick(newKeys) : pick(digits); groups.push(g); }
      return joinTo(groups);
    }
    if (L.type === "words") { const pool = wordsFor({ set: allow.set, caps: false }); const ws = []; while (joinTo(ws).length < len) ws.push(pick(pool)); return joinTo(ws); }
    if (L.type === "shift") { const pool = wordsFor({ set: allow.set, caps: false }).filter((w) => w.length >= 3); const ws = []; while (joinTo(ws).length < len) { const w = pick(pool); ws.push(Math.random() < 0.6 ? w[0].toUpperCase() + w.slice(1) : w); } return joinTo(ws); }
    // sentences / punct
    const strict = L.type === "sentences" && idx < LESSONS.length - 1;
    let pool = SENT.filter((s) => textAllowed(s, { set: new Set([...allow.set, ".", ","]), caps: true }));
    if (strict) pool = pool.filter((s) => !/['"?!\-]/.test(s));
    if (L.type === "punct") { const pp = SENT.filter((s) => /['"?!\-]/.test(s)); if (pp.length) pool = pp; }
    if (!pool.length) pool = SENT.slice(0, 6);
    const ss = shuffle(pool); const outS = []; while (joinTo(outS).length < len && outS.length < ss.length) outS.push(ss[outS.length]);
    return joinTo(outS);
  }

  const GROUPS = [["Home row", 0, 5], ["Top row", 6, 11], ["Bottom row", 12, 17], ["Shift and capitals", 18, 19], ["Numbers and punctuation", 20, 23]];
  function renderMap() {
    const p = S.profile, grid = $("lesson-grid"); grid.innerHTML = "";
    const next = nextLessonIdx(p);
    for (const [name, a, b] of GROUPS) {
      const g = document.createElement("div"); g.className = "lgroup"; g.innerHTML = "<h3>" + name + "</h3>"; const row = document.createElement("div"); row.className = "lrow"; g.appendChild(row);
      for (let i = a; i <= b && i < LESSONS.length; i++) {
        const L = LESSONS[i], rec = p.lessons[L.id], locked = i > next;
        const btn = document.createElement("button"); btn.className = "lesson" + (rec ? " done" : "") + (i === next && !rec ? " next" : "") + (locked ? " locked" : "");
        btn.disabled = locked;
        btn.innerHTML = "<span class='ln'>LESSON " + (i + 1) + "</span><span class='lt'>" + escapeHtml(L.title) + "</span><span class='ls'></span>";
        const ls = btn.querySelector(".ls");
        if (rec) { for (let k = 0; k < 3; k++) { const c = document.createElement("canvas"); QF.paintStar(c, 2); if (k >= rec.stars) c.className = "off"; ls.appendChild(c); } ls.appendChild(document.createTextNode(" " + Math.round(rec.wpm) + " wpm")); }
        else ls.textContent = locked ? "🔒" : "▶ Start";
        btn.addEventListener("click", () => openIntro(i));
        row.appendChild(btn);
      }
      grid.appendChild(g);
    }
    $("map-sub").textContent = lessonsDone(p) + " / " + LESSONS.length + " complete";
  }
  function openIntro(i) {
    const L = LESSONS[i]; S.lessonIdx = i;
    $("intro-eyebrow").textContent = "LESSON " + (i + 1) + " OF " + LESSONS.length;
    $("intro-title").textContent = L.title; $("intro-text").textContent = L.intro;
    const c = $("intro-coach"); c.innerHTML = "";
    const lines = []; if (i === 0) lines.push(...COACH.posture); if (L.tip) lines.push(L.tip); if (i === 5) lines.push(COACH.homeRow);
    for (const l of lines) { const li = document.createElement("li"); li.textContent = l; c.appendChild(li); }
    const hk = L.keys.find((k) => k !== "shift"); QF.paintHands($("hands-intro"), CFG.fingerColors, hk ? QF.KB.finger(hk) : "Li", 3);
    show("intro");
  }
  function startLesson(i) {
    const L = LESSONS[i]; S.lessonIdx = i;
    const dimDefault = i >= CFG.learn.dimKeyboardFrom - 1;
    startDrill({ mode: "learn", title: "LESSON " + (i + 1) + " · " + L.title, text: genDrill(i), strict: true, timed: false, dim: dimDefault, lesson: L });
  }
  function startWeakDrill(keys) {
    const idx = Math.max(nextLessonIdx(S.profile) - 1, 0); const allow = allowedChars(idx);
    const learned = [...allow.set].filter((c) => c !== " ");
    const groups = []; let t = ""; while (t.length < 44) { let g = ""; const gl = 2 + rnd(3); for (let k = 0; k < gl; k++) g += Math.random() < 0.7 ? pick(keys) : pick(learned); groups.push(g); t = groups.join(" "); }
    startDrill({ mode: "weak", title: "WEAK KEYS · " + keys.join(" ").toUpperCase(), text: t, strict: true, timed: false, dim: false });
  }
  function startTest() {
    let t = ""; const ss = shuffle(SENT); let i = 0; while (t.length < CFG.test.minChars * 2) { t += (t ? " " : "") + ss[i % ss.length]; i++; }
    startDrill({ mode: "test", title: "TEST · " + CFG.test.seconds + " SECONDS", text: t, strict: false, timed: true, dim: true });
  }

  // ---------------- drill engine ----------------
  function startDrill(o) {
    if (S.drill && S.drill.timerId) { clearInterval(S.drill.timerId); S.drill.timerId = null; }
    S.drill = { mode: o.mode, title: o.title, text: o.text, strict: o.strict, timed: o.timed, lesson: o.lesson || null, pos: 0, marks: new Array(o.text.length).fill(0), keystrokes: 0, correct: 0, errors: 0, backspaces: 0, errKeys: {}, startT: 0, endT: 0, done: false, streak: 0 };
    $("drill-title").textContent = o.title;
    $("drill-timer").textContent = o.timed ? fmtTime(CFG.test.seconds) : "";
    $("drill-acc").textContent = "100%"; $("drill-wpm").textContent = "0 wpm"; $("drill-prog").style.width = "0%";
    QF.KB.dim(!!o.dim); $("btn-kb-toggle").textContent = o.dim ? "Show keyboard" : "Hide keyboard";
    QF.paintFox($("fox-drill"), 0, 6);
    renderText(); updateHint();
    QF.paintHands($("hands-drill"), CFG.fingerColors, null, 3);
    show("drill");
  }
  function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
  function renderText() {
    const d = S.drill, el = $("drill-text");
    // window the text for long tests: show ~160 chars around the cursor
    const start = d.mode === "test" ? Math.max(0, Math.floor(d.pos / 120) * 120 - 40) : 0;
    const end = d.mode === "test" ? Math.min(d.text.length, start + 220) : d.text.length;
    let html = "";
    for (let i = start; i < end; i++) {
      const ch = d.text[i]; const cls = i < d.pos ? (d.marks[i] === 2 ? "bad" : "ok") : i === d.pos ? "cur" + (ch === " " ? " sp" : "") : "";
      html += "<span class='" + cls + "'>" + (ch === " " ? (i === d.pos ? "␣" : " ") : escapeHtml(ch)) + "</span>";
    }
    el.innerHTML = html;
    $("drill-prog").style.width = (100 * d.pos / d.text.length).toFixed(1) + "%";
  }
  function updateHint() {
    const d = S.drill, h = $("drill-hint");
    if (d.done) return;
    const ch = d.text[d.pos];
    if (ch == null) { QF.KB.highlight(null); return; }
    QF.KB.highlight(ch);
    const f = QF.KB.finger(ch), d2 = QF.KB.decompose(ch);
    QF.paintHands($("hands-drill"), CFG.fingerColors, f, 3);
    const name = ch === " " ? "space bar" : d2.shift ? d2.base.toUpperCase() + " with " + (QF.KB.shiftSide(ch) === "ShiftLeft" ? "left" : "right") + " Shift" : ch.toUpperCase();
    const praise = d.streak > 0 && d.streak % 10 === 0 ? " <span class='nice'>" + pick(["Nice!", "Keep going!", "Smooth.", "That's it!"]) + "</span>" : "";
    h.innerHTML = "<span class='f'>" + escapeHtml(name) + "</span> · " + COACH.fingers[f] + (d2.shift ? " · other pinky holds Shift" : "") + (d.startT ? praise : (d.mode === "test" ? " · the clock starts on your first key" : ""));
  }
  function onKey(e) {
    if (S.screen === "drill" && S.drill && !S.drill.done) return drillKey(e);
    if (S.screen === "play" && S.play) return playKey(e);
    if (S.screen === "intro" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); startLesson(S.lessonIdx); }
    if (S.screen === "result" && e.key === "Enter") { e.preventDefault(); $("btn-res-next").click(); }
  }
  function drillKey(e) {
    const d = S.drill;
    if (e.key === "Escape") { e.preventDefault(); quitDrill(); return; }
    if (e.repeat) { e.preventDefault(); return; } // a held key is one press, never thirty errors
    if (e.key === "Backspace") {
      e.preventDefault();
      if (!d.strict && d.pos > 0 && d.startT) { d.pos--; d.marks[d.pos] = 0; d.backspaces++; renderText(); updateHint(); }
      return;
    }
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    if (!d.startT) { d.startT = now(); if (d.timed) d.timerId = setInterval(tickTimer, 200); }
    const expected = d.text[d.pos]; if (expected == null) return;
    d.keystrokes++; S.profile.keys++;
    if (e.key === expected) {
      d.correct++; d.streak++; d.marks[d.pos] = 1; d.pos++;
      if (expected === " ") QF.audio.space(); else QF.audio.key();
      if (!e.synthetic) QF.KB.flashHit(expected);
      if (d.streak % 10 === 0) { QF.paintFox($("fox-drill"), 2, 6); setTimeout(() => { if (S.drill === d && !d.done) QF.paintFox($("fox-drill"), 0, 6); }, 700); }
    } else {
      d.errors++; d.streak = 0; d.errKeys[expected] = (d.errKeys[expected] || 0) + 1;
      QF.audio.error(); QF.KB.flashError(expected);
      QF.paintFox($("fox-drill"), 3, 6); setTimeout(() => { if (S.drill === d && !d.done) QF.paintFox($("fox-drill"), 0, 6); }, 500);
      if (d.strict) { const el = $("drill-text"); el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }
      else { d.marks[d.pos] = 2; d.pos++; }
    }
    if (d.pos >= d.text.length) {
      if (d.mode === "test") { extendTest(); } else { renderText(); finishDrill(); return; }
    }
    renderText(); updateHint(); updateDrillHud();
  }
  function extendTest() { const d = S.drill; const ss = shuffle(SENT); let add = ""; for (let i = 0; i < 6; i++) add += " " + ss[i]; d.text += add; d.marks = d.marks.concat(new Array(add.length).fill(0)); }
  function updateDrillHud() {
    const d = S.drill; const mins = d.startT ? (now() - d.startT) / 60000 : 0;
    $("drill-acc").textContent = d.keystrokes ? Math.round(100 * d.correct / d.keystrokes) + "%" : "100%";
    $("drill-wpm").textContent = (mins > 0.02 ? Math.round((d.correct / 5) / mins) : 0) + " wpm";
  }
  function tickTimer() {
    const d = S.drill; if (!d || d.done || !d.timed || !d.startT) return;
    const left = CFG.test.seconds - (now() - d.startT) / 1000;
    $("drill-timer").textContent = fmtTime(left);
    updateDrillHud();
    if (left <= 0) finishDrill();
  }
  function quitDrill() { const d = S.drill; if (d && d.timerId) clearInterval(d.timerId); S.drill = null; saveDb(); QF.KB.highlight(null); renderHub(); show(S.lessonIdx >= 0 && d && d.mode === "learn" ? "map" : "hub"); if (S.screen === "map") renderMap(); }

  function scoreDrill(d) {
    const mins = Math.max(0.01, ((d.endT || now()) - d.startT) / 60000);
    let uncorrected = 0; for (let i = 0; i < d.pos; i++) if (d.marks[i] === 2) uncorrected++;
    const typed = d.strict ? d.correct : d.pos; // entries that advanced the cursor
    const gross = Math.min(250, (typed / 5) / mins); // 250 caps glitchy timers and pasted input; no human types faster
    const net = Math.max(0, Math.min(250, gross - uncorrected / mins));
    const acc = d.keystrokes ? d.correct / d.keystrokes : 1;
    return { mins, gross, net, acc, uncorrected, typed };
  }
  function finishDrill() {
    const d = S.drill; if (!d || d.done) return;
    d.done = true; d.endT = now(); if (d.timerId) clearInterval(d.timerId);
    QF.KB.highlight(null);
    const sc = scoreDrill(d), p = S.profile;
    for (const k in d.errKeys) p.errors[k] = (p.errors[k] || 0) + d.errKeys[k];
    let stars = 0;
    if (d.mode === "learn") {
      stars = sc.acc >= CFG.stars.three ? 3 : sc.acc >= CFG.stars.two ? 2 : 1;
      const rec = p.lessons[d.lesson.id] || { stars: 0, acc: 0, wpm: 0 };
      p.lessons[d.lesson.id] = { stars: Math.max(rec.stars, stars), acc: Math.max(rec.acc, sc.acc), wpm: Math.max(rec.wpm, sc.net), t: Date.now() };
    } else if (d.mode === "test") {
      p.tests.push({ t: Date.now(), gross: +sc.gross.toFixed(1), net: +sc.net.toFixed(1), acc: +sc.acc.toFixed(3) }); if (p.tests.length > 20) p.tests.shift();
    }
    saveDb();
    showResult(d, sc, stars);
  }
  function tipFor(d, sc) {
    const top = Object.entries(d.errKeys).sort((a, b) => b[1] - a[1])[0];
    if (sc.acc >= CFG.stars.three && d.mode === "learn") return COACH.tips.great;
    if (sc.acc < 0.9) return COACH.tips.lowAcc;
    if (top && top[1] >= 3) return COACH.tips.keyErrors.replace("{key}", top[0] === " " ? "Space" : top[0].toUpperCase()).replace("{n}", top[1]).replace("{finger}", COACH.fingers[QF.KB.finger(top[0])]);
    if (!d.strict && d.backspaces > d.keystrokes * 0.08) return COACH.tips.backspace;
    if (d.lesson && d.lesson.type === "shift" && sc.acc < 0.95) return COACH.tips.shift;
    if (sc.acc >= 0.97) return COACH.tips.highAcc;
    return "";
  }
  function showResult(d, sc, stars) {
    const isLearn = d.mode === "learn", p = S.profile;
    $("res-eyebrow").textContent = isLearn ? "LESSON " + (S.lessonIdx + 1) + " COMPLETE" : d.mode === "test" ? "ONE-MINUTE TEST" : "WEAK KEY DRILL";
    $("res-title").textContent = isLearn ? (stars === 3 ? (d.errors === 0 ? "Perfect!" : "Three stars!") : stars === 2 ? "Nice work!" : "Done!") : d.mode === "test" ? Math.round(sc.net) + " words per minute" : "Drill complete";
    const st = $("res-stars"); st.innerHTML = "";
    if (isLearn) { for (let i = 0; i < 3; i++) { const c = document.createElement("canvas"); QF.paintStar(c, 5); st.appendChild(c); setTimeout(() => { if (i < stars) { c.classList.add("on"); QF.audio.star(i); } }, 350 + i * 260); } }
    QF.paintFox($("fox-result"), isLearn ? (stars >= 2 ? 2 : (stars === 1 ? 3 : 0)) : (sc.acc >= 0.95 ? 2 : 0), 6);
    const stats = [["WPM", Math.round(sc.net), ""], ["Accuracy", Math.round(sc.acc * 100) + "%", accClass(sc.acc)], ["Errors", d.errors, d.errors === 0 ? "good" : ""], ["Time", Math.round(sc.mins * 60) + "s", ""]];
    if (d.mode === "test") stats.splice(1, 0, ["Gross WPM", Math.round(sc.gross), ""]);
    $("res-stats").innerHTML = stats.map(([k, v, c]) => "<div class='stat'><b class='" + c + "'>" + v + "</b><span>" + k + "</span></div>").join("");
    $("res-tip").textContent = tipFor(d, sc);
    const rk = $("res-keyboard"); rk.innerHTML = ""; $("res-kb-label").textContent = "";
    if (Object.keys(d.errKeys).length) { const saved = QF.KB.isDim(); QF.KB.render(rk, CFG.fingerColors); QF.KB.showHeat(d.errKeys); QF.KB.render($("keyboard"), CFG.fingerColors); QF.KB.dim(saved); $("res-kb-label").textContent = "Keys you missed"; }
    const tr = $("res-trend"); tr.classList.toggle("show", d.mode === "test" && p.tests.length >= 2); if (d.mode === "test") drawTrend(tr, p.tests.slice(-10));
    const card = document.querySelector(".result-card"); card.classList.toggle("three", isLearn && stars === 3); card.classList.remove("lost");
    const nb = $("btn-res-next"), ab = $("btn-res-again");
    nb.textContent = isLearn ? (S.lessonIdx + 1 < LESSONS.length ? "Next lesson" : "Lesson map") : d.mode === "test" ? "Test again" : "Hub";
    ab.style.display = isLearn ? "" : "none"; ab.textContent = "Try again";
    setTimeout(() => (isLearn && stars === 3 ? QF.audio.fanfare() : QF.audio.chime()), 200);
    if (isLearn && S.lessonIdx === LESSONS.length - 1) { $("res-eyebrow").textContent = "GRADUATION"; $("res-title").textContent = "You can type!"; }
    show("result");
  }
  function drawTrend(c, tests) {
    c.width = 560; c.height = 160;
    const ctx = c.getContext("2d"); ctx.clearRect(0, 0, c.width, c.height);
    if (tests.length < 2) return;
    const max = Math.max(20, ...tests.map((t) => t.net)) * 1.2, w = c.width, h = c.height, L = 44, R = 16, T = 26, B = 30;
    ctx.strokeStyle = "#343C52"; ctx.lineWidth = 1;
    [0, 0.5, 1].forEach((f) => { const y = h - B - f * (h - T - B); ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - R, y); ctx.stroke(); ctx.fillStyle = "#9AA3B8"; ctx.font = "700 12px Nunito, sans-serif"; ctx.textAlign = "right"; ctx.fillText(Math.round(max * f), L - 8, y + 4); });
    ctx.strokeStyle = "#5CD6FF"; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.beginPath();
    const X = (i) => L + i * (w - L - R) / (tests.length - 1), Yv = (v) => h - B - (v / max) * (h - T - B);
    tests.forEach((t, i) => { i ? ctx.lineTo(X(i), Yv(t.net)) : ctx.moveTo(X(i), Yv(t.net)); });
    ctx.stroke();
    tests.forEach((t, i) => { const last = i === tests.length - 1; ctx.fillStyle = last ? "#FFD75A" : "#5CD6FF"; ctx.beginPath(); ctx.arc(X(i), Yv(t.net), last ? 7 : 5, 0, 7); ctx.fill(); ctx.fillStyle = "#F1EEDF"; ctx.font = "800 13px Nunito, sans-serif"; ctx.textAlign = "center"; ctx.fillText(Math.round(t.net), X(i), Yv(t.net) - 12); });
    ctx.fillStyle = "#C9C4B8"; ctx.font = "800 13px Nunito, sans-serif"; ctx.textAlign = "left"; ctx.fillText("Net WPM, last " + tests.length + " tests", L, h - 8);
  }

  // ---------------- PLAY arcade ----------------
  const AW = 960, AH = 540;
  let arena = null, actx = null;
  function playPool(level) {
    const P = CFG.play, p = S.profile; level = level || 1;
    let idx = Math.max(5, nextLessonIdx(p) - 1);
    if (level >= P.allLettersFromLevel) idx = Math.max(idx, 17); else if (level >= P.topRowFromLevel) idx = Math.max(idx, 11);
    const set = letterSetUpTo(idx);
    const [lo, hi] = P.lengthByLevel[Math.min(level, P.lengthByLevel.length) - 1];
    const all = wordsFor({ set, caps: false });
    let pool = all.filter((w) => w.length >= lo && w.length <= hi);
    for (let floor = lo - 1; pool.length < 10 && floor >= 2; floor--) pool = all.filter((w) => w.length >= floor && w.length <= hi); // back the floor off one letter at a time, never the whole window
    if (pool.length < 10) pool = wordsFor({ set: letterSetUpTo(5), caps: false });
    if (level >= P.capitalsFromLevel) pool = pool.map((w) => (Math.random() < 0.35 ? w[0].toUpperCase() + w.slice(1) : w));
    return pool;
  }
  function startPlay() {
    arena = $("arena"); actx = arena.getContext("2d");
    const dpr = Math.min(2, devicePixelRatio || 1); arena.width = AW * dpr; arena.height = AH * dpr; actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const P = CFG.play;
    S.play = { words: [], active: null, score: 0, combo: 1, bestCombo: 1, hearts: P.hearts, level: 1, zapsInLevel: 0, spawned: 0, freeze: 0, banner: null, running: false, over: false, pool: playPool(1), spawnT: 0.8, spawnEvery: P.spawnEvery, particles: [], lasers: [], floats: [], zapped: 0, keystrokes: 0, errors: 0, shake: 0, flash: 0, foxPose: 0, foxT: 0, t: 0 };
    $("play-timer").textContent = "LEVEL 1"; $("play-score").textContent = "0"; $("play-combo").textContent = "×1";
    $("play-hint").textContent = "Type the words before they reach the fox. Six zaps per level. Gold words freeze the sky. Press any key to start.";
    show("play");
    if (!S.playRaf) { S.playLast = now(); S.playRaf = requestAnimationFrame(playFrame); }
  }
  function playFrame(t) {
    S.playRaf = requestAnimationFrame(playFrame);
    const dt = Math.min(0.05, (t - S.playLast) / 1000); S.playLast = t;
    if (S.screen !== "play" || !S.play) return;
    if (S.play.running && !S.play.over) playUpdate(dt);
    playDraw();
  }
  function spawnWord() {
    const P = CFG.play, g = S.play; const lanes = P.laneCount;
    let lane = rnd(lanes), tries = 0; while (tries++ < lanes && g.words.some((w) => w.lane === lane && w.x > AW - 200)) lane = (lane + 1) % lanes;
    let text = pick(g.pool), tr = 0; while (tr++ < 20 && (g.words.some((w) => w.text[0].toLowerCase() === text[0].toLowerCase() && w.typed === 0) || g.words.some((w) => w.text === text))) text = pick(g.pool);
    const ramp = P.openingRampSec && g.level === 1 ? Math.min(1, 0.6 + 0.4 * g.t / P.openingRampSec) : 1;
    const speed = Math.min(P.maxSpeed, P.baseSpeed * (1 + P.speedPerLevel * (g.level - 1))) * ramp * (0.85 + Math.random() * 0.3);
    g.spawned++;
    const gold = g.level >= P.goldFromLevel && g.spawned % P.goldEvery === 0;
    g.words.push({ text, typed: 0, x: AW + 40, y: 90 + lane * ((AH - 160) / (lanes - 1)), lane, speed, wob: Math.random() * 6, gold });
  }
  function playUpdate(dt) {
    const g = S.play, P = CFG.play;
    if (!g || g.over) return;
    g.t += dt;
    if (g.freeze > 0) g.freeze -= dt;
    g.spawnT -= dt; if (g.spawnT <= 0) { spawnWord(); g.spawnT = g.spawnEvery; }
    for (const w of g.words) { if (g.freeze <= 0) w.x -= w.speed * dt; w.wob += dt * 3; }
    if (g.banner) { g.banner.life -= dt; if (g.banner.life <= 0) g.banner = null; }
    const towerX = 150;
    for (const w of g.words) {
      if (w.x < towerX) { w.dead = true; g.hearts--; g.combo = 1; g.shake = 0.35; QF.audio.hurt(); g.foxPose = 3; g.foxT = 0.8; if (g.active === w) g.active = null; burst(w.x, w.y, "#FF5C7A", 14); }
    }
    g.words = g.words.filter((w) => !w.dead);
    for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; }
    g.particles = g.particles.filter((p) => p.life > 0);
    for (const l of g.lasers) l.life -= dt; g.lasers = g.lasers.filter((l) => l.life > 0);
    for (const f of g.floats) { f.life -= dt; f.y -= 40 * dt; } g.floats = g.floats.filter((f) => f.life > 0);
    if (g.shake > 0) g.shake -= dt; if (g.flash > 0) g.flash -= dt * 3;
    if (g.foxT > 0) { g.foxT -= dt; if (g.foxT <= 0) g.foxPose = 0; }
    $("play-timer").textContent = "LEVEL " + g.level; $("play-score").textContent = g.score; $("play-combo").textContent = "×" + g.combo;
    if (g.hearts <= 0) endPlay();
  }
  function levelUp() {
    const g = S.play, P = CFG.play;
    g.level++; g.zapsInLevel = 0;
    g.spawnEvery = Math.max(P.minSpawn, P.spawnEvery * Math.pow(P.spawnPerLevel, g.level - 1));
    g.pool = playPool(g.level);
    let msg = "LEVEL " + g.level;
    if (g.level % P.heartEveryLevels === 0 && g.hearts < P.hearts) { g.hearts++; msg += "  ♥"; }
    g.banner = { text: msg, life: 1.6 }; g.flash = 0.35; g.foxPose = 2; g.foxT = 1.0;
    QF.audio.fanfare();
  }
  function burst(x, y, color, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = 60 + Math.random() * 160; S.play.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.4 + Math.random() * 0.4, color, s: 2 + Math.random() * 3 }); } }
  function playKey(e) {
    const g = S.play;
    if (e.key === "Escape") { e.preventDefault(); quitPlay(); return; }
    if (g.over) { if (e.key === "Enter") { e.preventDefault(); $("btn-res-next").click(); } return; }
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    e.preventDefault();
    if (!g.running) { g.running = true; g.spawnT = 0.15; $("play-hint").textContent = "Go!"; QF.audio.unlock(); QF.audio.click(); return; } // the starting key is not a guess
    const ch = e.key; if (ch === " ") return;
    let w = g.active;
    if (!w) {
      const cands = g.words.filter((x) => x.text[0] === ch).sort((a, b) => a.x - b.x);
      if (!cands.length) { if (g.words.length) { g.keystrokes++; g.errors++; g.combo = 1; QF.audio.error(); } return; } // a miss with no matching word: no expected key to blame
      w = cands[0]; g.active = w;
    }
    g.keystrokes++; S.profile.keys++;
    if (w.text[w.typed] === ch) {
      w.typed++; QF.audio.key();
      if (w.typed >= w.text.length) {
        g.zapped++; const pts = w.text.length * 10 * g.combo; g.score += pts; g.combo = Math.min(8, g.combo + 1); g.bestCombo = Math.max(g.bestCombo, g.combo);
        g.lasers.push({ x1: 150, y1: AH - 60 - 160 - 40, x2: w.x + 10, y2: w.y, life: 0.3 }); burst(w.x, w.y, "#FFD75A", 22); burst(w.x, w.y, "#7CF29A", 10); QF.audio.zap();
        g.floats.push({ x: w.x, y: w.y - 30, text: "+" + pts + (g.combo > 2 ? "  ×" + (g.combo - 1) : ""), life: 0.9 }); g.flash = 0.25;
        if (w.gold) { g.freeze = CFG.play.freezeSeconds; g.floats.push({ x: AW / 2 - 60, y: AH / 2, text: "FREEZE!", life: 1.2 }); QF.audio.chime(); }
        g.zapsInLevel++;
        if (g.zapsInLevel >= CFG.play.zapsPerLevel) levelUp();
        g.foxPose = 4; g.foxT = 0.3; w.dead = true; g.active = null; g.words = g.words.filter((x) => !x.dead);
      }
    } else { g.errors++; g.combo = 1; QF.audio.error(); const exp = w.text[w.typed]; S.profile.errors[exp] = (S.profile.errors[exp] || 0) + 1; w.flash = 0.25; }
  }
  function playDraw() {
    const g = S.play, c = actx; if (!c) return;
    c.save(); if (g.shake > 0) c.translate((Math.random() - 0.5) * 12 * g.shake, (Math.random() - 0.5) * 12 * g.shake);
    const sky = c.createLinearGradient(0, 0, 0, AH); sky.addColorStop(0, "#0E1120"); sky.addColorStop(0.7, "#1A2038"); sky.addColorStop(1, "#2A2438");
    c.fillStyle = sky; c.fillRect(-20, -20, AW + 40, AH + 40);
    for (let i = 0; i < 70; i++) { const sx = (i * 173 + Math.floor(g.t * (8 + (i % 3) * 6))) % (AW + 20), sy = (i * 97 + i * i) % (AH - 100); const tw = 0.5 + 0.5 * Math.sin(g.t * 2 + i); c.globalAlpha = 0.35 + 0.5 * tw; c.fillStyle = i % 7 === 0 ? "#FFD75A" : "#DCE6F2"; c.fillRect(AW - sx, sy, i % 5 === 0 ? 3 : 2, i % 5 === 0 ? 3 : 2); }
    c.globalAlpha = 1;
    c.fillStyle = "#B9C2D6"; c.beginPath(); c.arc(AW - 120, 70, 26, 0, 7); c.fill(); c.fillStyle = "#1A2038"; c.beginPath(); c.arc(AW - 110, 62, 22, 0, 7); c.fill();
    c.fillStyle = "#1F2536"; for (let i = 0; i < 24; i++) { const bx = i * 42, bh = 30 + ((i * 37) % 50); c.fillRect(bx, AH - 60 - bh, 34, bh); c.fillStyle = "#3A4358"; for (let k = 0; k < 3; k++) if ((i + k) % 3) c.fillRect(bx + 6 + k * 10, AH - 60 - bh + 8, 4, 5); c.fillStyle = "#1F2536"; }
    c.fillStyle = "#232838"; c.fillRect(0, AH - 60, AW, 60); c.fillStyle = "#2E3548"; c.fillRect(0, AH - 60, AW, 3);
    c.imageSmoothingEnabled = false;
    c.drawImage(QF.spr.tower, 60, AH - 60 - 160, 80, 160);
    c.drawImage(QF.spr.foxes[g.foxPose], 70, AH - 60 - 160 - 84, 112, 96);
    for (let i = 0; i < CFG.play.hearts; i++) { c.globalAlpha = i < g.hearts ? 1 : 0.2; c.drawImage(QF.spr.heart, 24 + i * 34, 20, 27, 24); } c.globalAlpha = 1;
    c.font = "700 26px 'JetBrains Mono', monospace"; c.textBaseline = "middle";
    for (const w of g.words) {
      const y = w.y + Math.sin(w.wob) * 4; const tw = c.measureText(w.text).width;
      const act = w === g.active;
      c.fillStyle = act ? "#1F3A2E" : (w.gold ? "#3A2E10" : "#232838"); c.strokeStyle = act ? "#7CF29A" : (w.flash > 0 ? "#FF5C7A" : (w.gold ? "#FFD75A" : "#3A4358")); c.lineWidth = act || w.gold ? 3 : 2;
      if (act || w.gold) { c.shadowColor = act ? "#7CF29A" : "#FFD75A"; c.shadowBlur = 18; }
      roundRect(c, w.x - 12, y - 22, tw + 24, 44, 10); c.fill(); c.stroke(); c.shadowBlur = 0;
      if (w.flash > 0) w.flash -= 0.016;
      const done = w.text.slice(0, w.typed), rest = w.text.slice(w.typed);
      c.textAlign = "left"; c.fillStyle = "#F28C28"; c.fillText(done, w.x, y);
      c.fillStyle = w === g.active ? "#FFFFFF" : (w.gold ? "#FFD75A" : "#E4E0CE"); c.fillText(rest, w.x + c.measureText(done).width, y);
    }
    if (g.freeze > 0) { c.globalAlpha = Math.min(0.25, g.freeze * 0.4); c.fillStyle = "#5CD6FF"; c.fillRect(0, 0, AW, AH); c.globalAlpha = 1; }
    if (g.banner) { const a = Math.min(1, g.banner.life * 2); c.globalAlpha = a; c.fillStyle = "#FFD75A"; c.font = "800 64px 'Baloo 2', sans-serif"; c.textAlign = "center"; c.strokeStyle = "#1E1410"; c.lineWidth = 8; c.strokeText(g.banner.text, AW / 2, AH * 0.42); c.fillText(g.banner.text, AW / 2, AH * 0.42); c.globalAlpha = 1; }
    c.lineCap = "round";
    for (const l of g.lasers) { c.globalAlpha = Math.min(1, l.life * 5); c.strokeStyle = "#FFD75A"; c.lineWidth = 8; c.shadowColor = "#FFD75A"; c.shadowBlur = 16; c.beginPath(); c.moveTo(l.x1, l.y1); c.lineTo(l.x2, l.y2); c.stroke(); c.shadowBlur = 0; c.strokeStyle = "#FFFFFF"; c.lineWidth = 3; c.stroke(); }
    c.globalAlpha = 1;
    c.font = "800 26px 'Baloo 2', sans-serif"; c.textAlign = "center";
    for (const f of g.floats) { c.globalAlpha = Math.min(1, f.life * 2); c.fillStyle = "#FFD75A"; c.strokeStyle = "#1E1410"; c.lineWidth = 4; c.strokeText(f.text, f.x + 30, f.y); c.fillText(f.text, f.x + 30, f.y); }
    c.globalAlpha = 1;
    if (g.flash > 0) { c.globalAlpha = g.flash * 0.5; c.fillStyle = "#FFFFFF"; c.fillRect(0, 0, AW, AH); c.globalAlpha = 1; }
    for (const p of g.particles) { c.globalAlpha = Math.min(1, p.life * 2.5); c.fillStyle = p.color; c.fillRect(p.x, p.y, p.s, p.s); }
    c.globalAlpha = 1;
    if (!g.running && !g.over) { c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(0, 0, AW, AH); c.fillStyle = "#FFD75A"; c.font = "800 44px 'Baloo 2', sans-serif"; c.textAlign = "center"; c.fillText("Press any key to start", AW / 2, AH / 2 - 10); c.fillStyle = "#F1EEDF"; c.font = "700 20px Nunito, sans-serif"; c.fillText("Type each word before it reaches the fox", AW / 2, AH / 2 + 30); }
    c.restore();
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function endPlay() {
    const g = S.play; g.over = true; g.running = false;
    const p = S.profile; const best = g.score > p.playBest; if (best) p.playBest = g.score;
    const bestLevel = g.level > (p.playLevel || 0); if (bestLevel) p.playLevel = g.level; saveDb();
    QF.audio.lose();
    $("res-eyebrow").textContent = "THE WORDS GOT THROUGH · LEVEL " + g.level;
    const card = document.querySelector(".result-card"); card.classList.toggle("lost", g.hearts <= 0); card.classList.remove("three");
    $("btn-res-again").style.display = "none"; $("res-kb-label").textContent = "";
    $("res-title").textContent = "Level " + g.level + " · " + g.score + " points" + (bestLevel ? " · new best level" : best ? " · new best score" : "");
    $("res-stars").innerHTML = "";
    const acc = g.keystrokes ? Math.round(100 * (g.keystrokes - g.errors) / g.keystrokes) : 100;
    $("res-stats").innerHTML = [["Level reached", g.level, "mid"], ["Words zapped", g.zapped, "good"], ["Accuracy", acc + "%", accClass(acc / 100)], ["Best combo", "×" + g.bestCombo, ""], ["Best level", p.playLevel || 1, "mid"]].map(([k, v, c]) => "<div class='stat'><b class='" + c + "'>" + v + "</b><span>" + k + "</span></div>").join("");
    $("res-tip").textContent = acc < 90 ? COACH.tips.lowAcc : g.level < 4 ? "Lock on to the word closest to the fox first." : "Gold words freeze the sky. Save them for a crowded screen.";
    $("res-keyboard").innerHTML = ""; $("res-trend").classList.remove("show");
    QF.paintFox($("fox-result"), g.hearts <= 0 ? 3 : 2, 6);
    $("btn-res-next").textContent = "Play again";
    S.resultMode = "play";
    setTimeout(() => show("result"), 600);
  }
  function quitPlay() { S.play = null; renderHub(); show("hub"); }

  // ---------------- UI wiring ----------------
  function bindUI() {
    $("add-form").addEventListener("submit", (e) => {
      e.preventDefault(); const name = $("add-name").value.trim().slice(0, 12);
      if (!name) return; if (S.db.profiles.some((p) => p.name.toLowerCase() === name.toLowerCase())) { toast("That name is taken"); return; }
      const p = newProfile(name); S.db.profiles.push(p); saveDb(); $("add-name").value = ""; renderProfiles(); selectProfile(p);
    });
    $("btn-gate-override").addEventListener("click", () => { sessionStorage.setItem("qf.override", "1"); show("title"); });
    $("btn-switch").addEventListener("click", () => { S.profile = null; renderProfiles(); show("title"); });
    $("m-learn").addEventListener("click", () => { renderMap(); show("map"); });
    $("m-play").addEventListener("click", () => startPlay());
    $("m-test").addEventListener("click", () => startTest());
    $("btn-map-back").addEventListener("click", () => { renderHub(); show("hub"); });
    $("btn-intro-go").addEventListener("click", () => startLesson(S.lessonIdx));
    $("btn-intro-back").addEventListener("click", () => { renderMap(); show("map"); });
    $("btn-drill-quit").addEventListener("click", quitDrill);
    $("btn-kb-toggle").addEventListener("click", () => { const on = !QF.KB.isDim(); QF.KB.dim(on); $("btn-kb-toggle").textContent = on ? "Show keyboard" : "Hide keyboard"; });
    $("btn-play-quit").addEventListener("click", quitPlay);
    $("btn-res-next").addEventListener("click", () => {
      if (S.resultMode === "play") { S.resultMode = null; startPlay(); return; }
      const d = S.drill;
      if (d && d.mode === "learn") { if (S.lessonIdx + 1 < LESSONS.length) openIntro(S.lessonIdx + 1); else { renderMap(); show("map"); } }
      else if (d && d.mode === "test") startTest();
      else { renderHub(); show("hub"); }
    });
    $("btn-res-again").addEventListener("click", () => { if (S.resultMode === "play") { S.resultMode = null; startPlay(); return; } const d = S.drill; if (d && d.mode === "learn") startLesson(S.lessonIdx); else if (d && d.mode === "test") startTest(); else { renderHub(); show("hub"); } });
    $("btn-res-hub").addEventListener("click", () => { S.resultMode = null; S.play = null; renderHub(); show("hub"); });
    document.querySelectorAll(".btn-sound").forEach((b) => b.addEventListener("click", () => { QF.audio.setMuted(!QF.audio.isMuted()); S.db.muted = QF.audio.isMuted(); saveDb(); syncSound(); }));
  }

  window.addEventListener("DOMContentLoaded", boot);
})();
