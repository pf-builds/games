// Sapper's Path v6 lane B part 2: the intro tour (tools/tutorial-notes.md; data levels/tutorial.json; config tutorial).
// Offered once over the home on first launch ("New here?": Show me / Skip) and any time from Settings > How to play.
// Eight practice forts played on the REAL engine, board, tray, line, coach band and arrow, win and fail sheets (main.js
// startLevel with entries this file registers), then a closing card that routes to the Campaign's or Zen's map.
// Isolation: while the tour runs, app.save is a practice save (a copy of the Campaign data: progress, coins and lives as
// they are, the inventory the step's practice stock, every power-up marked unlocked so no free-use tip shows) whose
// write() writes nothing but a settings change (sound, colour-blind) through to the real Campaign save; app.meta is a
// copy with lives and the continue off and only the step's practice power-ups open. Finishing or skipping restores both
// and sets the one flag (config tutorial.key, its own localStorage key, so no mode reset clears it).
// main.js hooks (all one-liners): init at boot, step() every frame, panel(e) at the end of showPanel, e.L.coach in
// coachSteps, selfTest(ok, out) at the top of SP.selfTest. Nothing here runs a timer: the done card waits on app.clock.
(function (root) {
  "use strict";
  const NS = (root.SappersPath = root.SappersPath || {});
  NS.tutorial = { init };

  // P (main.js): app, $, v (cache tag), getJSON, storage, startLevel, showScreen, retry, switchMode, renderCoach, SP.
  function init(P) {
    const app = P.app, $ = P.$, E = NS.engine, C = app.cfg.tutorial;
    if (!C || !C.file) return null;
    const T = { data: null, store: P.storage(), seen: false, on: false, k: -1, st: null, e: null, at: 0, doneAt: -1, card: false, closing: false, lineAt: 0, linePlays: 0, cell: 0,
      jammed: false, lastNow: 0, hid0: 0, real: null, offerOn: false, offered: false, el: {} };
    try { T.seen = T.store.getItem(C.key) === "1"; } catch (e) { T.seen = false; }

    // ---- data ------------------------------------------------------------------------------------------------------
    // A "when" string: any of "|", all of "&", each "word" or "word:n". Parsed once into [[{k, m}]], read every frame.
    // A leading "!" negates a word. Fix pass: a line's skip (same words) passes it by when it no longer fits the board.
    const parse = (s) => String(s || "never").split("|").map((a) => a.split("&").map((w) => { const n = w.charAt(0) === "!", [k, m] = (n ? w.slice(1) : w).split(":"); return { k, m: m | 0, n }; }));
    const coachOf = (list) => (list || []).map((s) => Object.assign({ until: "tut" }, s, { _go: parse(s.go), _skip: s.skip ? parse(s.skip) : null })); // until "tut": main.js never moves it on
    function prep(d) {
      d.steps.forEach((st, i) => {
        st.c1 = coachOf(st.coach); st.c2 = st.coach2 ? coachOf(st.coach2) : null; st.doneP = parse(st.done);
        st.entry = { L: Object.assign({}, st.board, { id: st.id, name: st.name, coach: st.c1 }), id: st.id, n: i + 1, era: 0, idx: -1, node: null, tut: true };
      });
      return d;
    }

    // ---- DOM (built once; words from tutorial.json) -------------------------------------------------------------------
    const mk = (tag, cls, html) => { const x = document.createElement(tag); if (cls) x.className = cls; if (html != null) x.innerHTML = html; return x; };
    function build() {
      const D = T.data, U = D.ui, host = $("app");
      // The offer, over the home.
      const of = mk("div", "modal tut-modal", '<div class="sheetcard panel"><div id="tut-o-t" class="p-title"></div><p class="p-line"></p><div class="row"><button class="primary tut-yes"></button><button class="tut-no"></button></div><p class="tut-foot"></p></div>');
      of.id = "tut-offer"; of.hidden = true; of.setAttribute("role", "dialog"); of.setAttribute("aria-modal", "true"); of.setAttribute("aria-labelledby", "tut-o-t");
      of.querySelector(".p-title").textContent = D.offer.title; of.querySelector(".p-line").textContent = D.offer.say; of.querySelector(".tut-foot").textContent = D.offer.foot;
      of.querySelector(".tut-yes").textContent = D.offer.yes; of.querySelector(".tut-no").textContent = D.offer.no;
      of.querySelector(".tut-yes").addEventListener("click", () => start()); of.querySelector(".tut-no").addEventListener("click", () => { hideOffer(); setSeen(); });
      host.append(of); T.el.offer = of;
      // The done card, over the rail and the power-up bar (placed by placeCard).
      const cd = mk("div", "panel tut-card", '<div class="tut-of"></div><p id="tut-say" class="tut-say"></p><ul class="tut-more"></ul><div class="row"><button class="primary tut-next"></button><button class="tut-skip2"></button></div>');
      cd.id = "tut-card"; cd.hidden = true; cd.setAttribute("role", "dialog"); cd.setAttribute("aria-labelledby", "tut-say");
      cd.querySelector(".tut-next").textContent = U.next; cd.querySelector(".tut-skip2").textContent = U.skip;
      cd.querySelector(".tut-next").addEventListener("click", next); cd.querySelector(".tut-skip2").addEventListener("click", () => finish("title"));
      host.append(cd); T.el.card = cd;
      // The closing card: Campaign or Zen.
      const cl = mk("div", "modal tut-modal", '<div class="sheetcard panel"><div id="tut-c-t" class="p-title"></div><p class="p-line"></p><div class="tut-modes"></div><button class="tut-later"></button></div>');
      cl.id = "tut-close"; cl.hidden = true; cl.setAttribute("role", "dialog"); cl.setAttribute("aria-modal", "true"); cl.setAttribute("aria-labelledby", "tut-c-t");
      cl.querySelector(".p-title").textContent = D.close.title; cl.querySelector(".p-line").textContent = D.close.say; cl.querySelector(".tut-later").textContent = D.close.later;
      for (const m of ["campaign", "zen"]) { const b = mk("button", "primary tut-mode" + (m === "zen" ? " zen" : ""), "<b></b><span></span>"); b.dataset.mode = m; b.querySelector("b").textContent = D.close[m].name; b.querySelector("span").textContent = D.close[m].say;
        b.setAttribute("aria-label", D.close[m].name + ": " + D.close[m].say); b.addEventListener("click", () => finish(m)); cl.querySelector(".tut-modes").append(b); }
      cl.querySelector(".tut-later").addEventListener("click", () => finish("title"));
      host.append(cl); T.el.close = cl;
      // Skip tour in the top bar (where the map button sits; body.tut hides that and the speed button).
      const sk = mk("button", "tut-skip"); sk.id = "tut-skip"; sk.textContent = U.skip; sk.addEventListener("click", () => finish("title"));
      T.el.skip = sk; // in the top bar only while the tour runs (start, restore), so the bar's own layout checks never meet it
      // Settings > How to play (a ? in a ring, inline: no image bytes).
      const row = mk("button", "set-row set-act", '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M9.2 9.3a2.9 2.9 0 1 1 4.1 2.6c-.9.5-1.3 1-1.3 2.1" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.4" fill="currentColor"/></svg><span class="sl"></span>');
      row.id = "set-tour"; row.querySelector(".sl").textContent = U.row; row.addEventListener("click", () => start());
      $("set-copy").parentNode.insertBefore(row, $("set-copy")); T.el.row = row;
      // The real sheet during the tour: its second button is Skip tour; on the last fort's win its first is Next.
      $("panel").addEventListener("click", (ev) => {
        if (!T.on || !app.panel) return;
        const t = ev.target, pri = $("p-primary").contains(t), sec = $("p-secondary").contains(t);
        if (sec) { ev.stopPropagation(); finish("title"); } else if (pri && app.panel === "win") { ev.stopPropagation(); next(); }
      }, true);
      // Fix pass m2: under a done card the fort holds: no Retry (top bar or R) and no card keys reset or play it.
      window.addEventListener("keydown", (ev) => { if (T.card && /^[rR1-5 ]$/.test(ev.key)) { ev.stopPropagation(); ev.preventDefault(); } }, true);
      window.addEventListener("click", (ev) => { if (T.card && $("btn-retry").contains(ev.target)) { ev.stopPropagation(); ev.preventDefault(); } }, true);
      document.addEventListener("keydown", (ev) => { if (ev.key !== "Escape") return; if (T.offerOn) { hideOffer(); setSeen(); } else if (T.closing) finish("title"); });
      window.addEventListener("resize", () => { if (T.card) placeCard(); });
    }

    // ---- the offer --------------------------------------------------------------------------------------------------
    const doneIn = (sv) => !!sv && !!sv.data && Object.keys(sv.data.done || {}).length > 0;
    function offerMaybe(force) {
      if (!T.data || T.on || (!force && (T.seen || T.offered))) return false;
      if (app.screen !== "title") return false;
      if (!force && !C.offerIfProgress && (doneIn(P.csave()) || (P.zenOn() && doneIn(P.zsave())))) return false; // a player who has cleared a level is not new
      T.offered = true; T.offerOn = true; T.el.offer.hidden = false; T.el.offer.querySelector(".tut-yes").focus(); return true;
    }
    function hideOffer() { T.offerOn = false; if (T.el.offer) T.el.offer.hidden = true; }
    function setSeen() { T.seen = true; try { T.store.setItem(C.key, "1"); } catch (e) { /* kept for this visit */ } }

    // ---- the tour ---------------------------------------------------------------------------------------------------
    // The practice save (header) and the practice meta: only the step's power-ups open, one use each.
    function practice() {
      const R = P.csave(), d = JSON.parse(JSON.stringify(R.data)); d.settings = R.data.settings; d.got = {}; d.inv = {};
      for (const id of E.POWERS) { d.got[id] = 1; d.inv[id] = 0; }
      let s0 = JSON.stringify(d.settings);
      return { data: d, key: R.key, practice: true, write() { const s = JSON.stringify(d.settings); if (s === s0) return true; s0 = s; return R.write(); } };
    }
    const metaFor = (M0, ids) => Object.assign({}, M0, { lives: false, cont: null,
      powers: M0.powers.map((p) => Object.assign({}, p, (ids || []).indexOf(p.id) >= 0 ? { unlockAt: 1, perLevel: 1 } : { unlockAt: 1e9, perLevel: 0 })) });
    function start() {
      if (!T.data || T.on) return false;
      hideOffer(); T.el.close.hidden = true; T.closing = false;
      T.real = { save: app.save, meta: app.meta }; app.save = practice();
      T.cell = app.cfg.board.maxCellCss; if (C.maxCellCss) app.cfg.board.maxCellCss = C.maxCellCss; // fix pass m5: the small forts fill the board's room
      for (const st of T.data.steps) { app.byId.set(st.id, st.entry); st.meta = metaFor(T.real.meta, st.powers); }
      T.on = true; document.body.classList.add("tut"); $("top").insertBefore(T.el.skip, $("lvl"));
      return load(0);
    }
    function load(k) {
      const st = T.data.steps[k]; if (!st) return false;
      hideCard(); T.k = k; T.st = st; T.e = st.entry; st.entry.L.coach = st.c1; T.jammed = false;
      document.body.classList.toggle("tut-nopw", !(st.powers && st.powers.length)); // no practice power-ups: no bar
      app.meta = st.meta; const inv = app.save.data.inv; for (const id of E.POWERS) inv[id] = (st.powers || []).indexOf(id) >= 0 ? 1 : 0;
      if (!P.startLevel(st.id)) return false;
      fresh(); return true;
    }
    function fresh() { T.at = 0; T.doneAt = -1; T.lastNow = 0; T.hid0 = app.S ? app.S.hiddenLeft : 0; T.lineAt = app.clock; T.linePlays = 0; }
    function next() {
      if (!T.on) return false;
      if (T.k + 1 < T.data.steps.length) return load(T.k + 1);
      return closing();
    }
    // The closing card: the tour is finished (the flag, the real save back); the board stays behind it until a choice.
    function closing() {
      hideCard(); $("panel").hidden = true; restore(); setSeen(); T.closing = true;
      const zb = T.el.close.querySelector(".tut-mode.zen"); zb.hidden = !P.zenOn();
      T.el.close.hidden = false; T.el.close.querySelector(".tut-mode").focus(); return true;
    }
    function restore() {
      const note = document.querySelector("#panel .tut-note"); if (note) note.remove();
      if (!T.on) return; T.on = false; document.body.classList.remove("tut", "tut-nopw"); T.el.skip.remove();
      app.save = T.real.save; app.meta = T.real.meta; T.real = null; app.cfg.board.maxCellCss = T.cell;
      for (const st of T.data.steps) app.byId.delete(st.id);
    }
    // Skip (any step, no confirm), Not now, or a mode chosen on the closing card. Route: "title", "campaign" or "zen".
    function finish(route) {
      hideCard(); hideOffer(); restore(); setSeen(); T.closing = false; T.el.close.hidden = true;
      app.coach = null; app.panel = null; app.ending = null; app.pick = null; app.entry = null; app.S = null; app.B = null; $("panel").hidden = true; P.renderCoach();
      if (route === "campaign" || route === "zen") { P.switchMode(route); P.showScreen("map"); } else P.showScreen("title");
      return true;
    }

    // ---- every frame (main.js step) -----------------------------------------------------------------------------------
    // The words: play (a tap since the line showed), used:m, wait, lineEmpty, full, reveal, shown, pick:k, power:k,
    // clear:m, won, jammed (a jam this step). No allocation.
    function test(p) { return p.n ? !word(p) : word(p); }
    function word(p) {
      const S = app.S;
      switch (p.k) {
        case "canRecall": for (let s = 0; s < S.cap; s++) if (S.canPower(E.PW.RECALL, s)) return true; return false;
        case "play": return S.plays > T.at;
        case "used": return (app.used & (1 << p.m)) !== 0;
        case "wait": for (let s = 0; s < S.cap; s++) if (S.spQ[s] && S.spW[s] > S.reachable(S.spM[s])) return true; return false;
        case "lineEmpty": return S.lineLen === 0 && S.plays > 0;
        case "full": return S.lineLen >= S.open;
        case "reveal": return app.reveals > 0;
        case "shown": return S.hiddenLeft < T.hid0;
        case "pick": return !!app.pick && app.pick.k === p.m;
        case "power": return S.used(p.m) > 0;
        case "clear": return S.left[p.m] === 0;
        case "won": return S.status === E.WON;
        case "jammed": return T.jammed;
      }
      return false;
    }
    function holds(w) { for (let i = 0; i < w.length; i++) { const a = w[i]; let all = true; for (let j = 0; j < a.length && all; j++) all = test(a[j]); if (all) return true; } return false; }
    function step() {
      if (T.offerOn && app.screen !== "title") hideOffer(); // a level started some other way (automation): the offer goes, unseen
      if (!T.on) return;
      if (app.screen !== "play" || app.entry !== T.e) { hideCard(); restore(); setSeen(); return; } // the tour was left some other way (automation's SP.load): a skip, wherever it went
      const S = app.S; if (!S || app.held) return;
      if (S.now < T.lastNow) { fresh(); T.hid0 = S.hiddenLeft; } // a Retry (S.reset): the coach starts over too (main.js coachStart)
      T.lastNow = S.now;
      const co = app.coach; let moved = false;
      for (let g = 0; co && g < 8 && co.i < co.steps.length; g++) { const st = co.steps[co.i]; if (!(holds(st._go) || (st._skip && holds(st._skip)))) break; co.i++; T.at = S.plays; moved = true; }
      if (moved) { T.lineAt = app.clock; T.linePlays = S.plays; P.renderCoach(); }
      if (T.card || T.st.final) return;
      if (T.doneAt < 0 && holds(T.st.doneP)) T.doneAt = app.clock + C.doneMs;
      // The card waits doneMs after the goal, and until the coach line now showing has had dwellMs or a tap (fix pass M1)
      if (T.doneAt >= 0 && app.clock >= T.doneAt && (app.clock - T.lineAt >= C.dwellMs || S.plays > T.linePlays) && app.panel !== "fail") showCard();
    }

    // ---- the done card ------------------------------------------------------------------------------------------------
    function showCard() {
      const st = T.st, U = T.data.ui, cd = T.el.card; T.card = true; document.body.classList.add("tut-carded"); // Retry rests under the card (fix pass m2)
      app.coach = null; app.pick = null; P.renderCoach(); document.body.classList.remove("picking"); $("toast").hidden = true; $("pwtip").hidden = true; app.tip = null; // the card is the only word now
      cd.querySelector(".tut-of").textContent = U.of.replace("{i}", T.k + 1).replace("{n}", T.data.steps.length + 1);
      cd.querySelector(".tut-say").textContent = st.say;
      const ul = cd.querySelector(".tut-more"); ul.textContent = ""; for (const t of st.more || []) { const li = document.createElement("li"); li.textContent = t; ul.append(li); } ul.hidden = !(st.more && st.more.length);
      cd.hidden = false; placeCard(); cd.querySelector(".tut-next").focus();
    }
    function hideCard() { T.card = false; document.body.classList.remove("tut-carded"); if (T.el.card) T.el.card.hidden = true; }
    // Over the rail and the power-up bar (portrait: the bottom of the screen; wide: the side column under the top bar).
    function placeCard() {
      const a = $("rail").getBoundingClientRect(), q = $("powers").getBoundingClientRect(), b = q.height > 0 ? q : a, cd = T.el.card, top = Math.min(a.top, b.top), bot = Math.max(a.bottom, b.bottom); // no bar (a step without practice power-ups): the rail alone
      cd.classList.remove("tight"); cd.style.left = Math.round(a.left) + "px"; cd.style.width = Math.round(a.width) + "px"; cd.style.top = Math.round(top) + "px"; cd.style.height = Math.round(bot - top) + "px";
      if (cd.scrollHeight > cd.clientHeight + 1) cd.classList.add("tight"); // a short screen: smaller words, then the card grows up over the board
      if (cd.scrollHeight > cd.clientHeight + 1) { const h = Math.min(bot - 8, cd.scrollHeight + 6); cd.style.top = Math.round(bot - h) + "px"; cd.style.height = Math.round(h) + "px"; }
    }

    // ---- the real sheet (main.js showPanel calls this last) ---------------------------------------------------------------
    // A win before the last fort, or anything behind the done card: no sheet, the done card. A fail: the game's own words
    // and Retry (one tap retries this step; a jam's Retry brings the step's second coach script), Skip tour beside it. The
    // last fort's win: the game's title, the practice line, Next.
    function panel(e) {
      const note = $("p-line").parentNode.querySelector(".tut-note"); if (note) note.remove();
      if (!T.on || app.entry !== T.e) return;
      if (T.card || (e.won && !T.st.final)) { $("panel").hidden = true; if (!T.card) showCard(); return; }
      $("p-secondary").textContent = T.data.ui.skip;
      if (e.won) { $("p-line").textContent = T.data.ui.winLine; $("p-primary").querySelector(".pl").textContent = T.data.ui.next; return; }
      if (e.reason === "jam") { T.jammed = true; if (T.st.c2) T.e.L.coach = T.st.c2;
        if (T.st.jamNote) { const p = document.createElement("p"); p.className = "tut-note"; p.textContent = T.st.jamNote; $("p-line").after(p); } }
    }

    // ---- selfTest (main.js SP.selfTest calls this first, on its scratch saves) --------------------------------------------
    function selfTest(ok, out) {
      if (!ok(!!T.data, "tour: levels/tutorial.json loaded")) return;
      const was = { store: T.store, seen: T.seen, offered: T.offered, allPw: app.allPw, cell: app.cfg.board.maxCellCss }, mem = {}, store = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
      let real = "?"; try { real = localStorage.getItem(C.key); } catch (e) { /* stays "?" */ }
      const big = (el) => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; };
      const hit = (el) => { const r = el.getBoundingClientRect(); if (!(r.width > 0)) return false; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === el || el.contains(t)); };
      const snap = () => JSON.stringify(P.csave().data) + "|" + (P.zenOn() ? JSON.stringify(P.zsave().data) : "");
      const play = (ord) => { for (const ch of ord) { P.SP.play(+ch); P.SP.settle(); } };
      const until = (f, ms) => { for (let t = 0; t < ms && !f(); t += 16) P.SP.tick(16); return f(); };
      try {
        T.store = store; T.seen = false; T.offered = false; app.allPw = false; P.showScreen("title");
        const s0 = snap();
        // The offer: once, over the home, its buttons hittable and big; Skip sets the flag; never again.
        const o1 = offerMaybe(), oh = hit(T.el.offer.querySelector(".tut-yes")) && hit(T.el.offer.querySelector(".tut-no")) && big(T.el.offer.querySelector(".tut-yes")) && big(T.el.offer.querySelector(".tut-no"));
        T.el.offer.querySelector(".tut-no").click(); const o2 = offerMaybe();
        ok(o1 && oh && mem[C.key] === "1" && T.el.offer.hidden && !o2, "tour: the first-launch offer shows once over the home (Show me and Skip hittable, 44 px), Skip sets the seen flag, it never shows again");
        // Show me (forced): eight forts on the real engine, a done card after each, the jam's real words and a Retry.
        delete mem[C.key]; T.seen = false; T.offered = false; offerMaybe(true); T.el.offer.querySelector(".tut-yes").click();
        const sk = T.el.skip, tb = app.screen === "play" && app.entry && app.entry.id === "tut-1" && document.body.classList.contains("tut") && hit(sk) && big(sk) && $("btn-map").offsetWidth === 0;
        const c1 = P.SP.coach(); ok(tb && c1.on && c1.hand && app.save.practice === true, "tour: Show me opens fort 1 with Skip tour in the top bar (map button hidden), the coach band and its arrow, on the practice save");
        const seen = [];
        for (let k = 0; k < T.data.steps.length; k++) {
          const st = T.data.steps[k], L = st.board; if (!ok(app.entry && app.entry.id === st.id, "tour: step " + (k + 1) + " is " + st.id)) break;
          if (st.board.jam) { // Don't jam: the player's own jam, the game's words, one tap retries this step with the second script
            play(st.board.jam); until(() => app.panel === "fail", 8000);
            const words = $("p-title").textContent + " / " + $("p-line").textContent, retryOK = hit($("p-primary")) && hit($("p-secondary")) && $("p-secondary").textContent === T.data.ui.skip && $("p-cont").hidden;
            $("p-primary").click(); const c2 = P.SP.coach();
            ok(/jammed/.test(words) && T.jammed && retryOK && !app.panel && app.S.plays === 0 && c2.on && c2.text.indexOf(st.coach2[0].say.slice(0, 10)) === 0, "tour: step 4 jams on the player's own taps (" + words + "), Retry and Skip tour on the sheet, one tap retries this step with the second coach script"); }
          if (st.powers) { // Power-ups: yellow waits, a practice Recall on its space, a practice Ladder
            const bad = app.pws.filter((b, i) => !b.hidden !== st.powers.includes(E.POWERS[i])).length;
            play("1"); P.SP.tick(16); const cb = P.SP.coach(), s = app.S.order([])[0]; P.SP.power(3); P.SP.tick(16); const cs = P.SP.coach(), slotOK = app.focusEl === app.slots[s] && cs.kind === "slot";
            app.slots[s].click(); P.SP.settle(); P.SP.tick(16); const cl2 = P.SP.coach(); P.SP.power(0); P.SP.settle();
            ok(!bad && cb.kind === "badge" && cb.hand && slotOK && cl2.kind === "badge" && app.S.used(3) === 1 && app.S.used(0) === 1 && app.S.cap === 6, "tour: on fort 7 (only the practice badges shown) the arrow is on the Recall badge, then on the waiting squad's own space (" + cs.kind + "), then on the Ladder; both work"); }
          else if (st.board.hidden) { // Hidden things: after the red tap the coach keeps an arrow until a ? block shows; the ring line stays readable
            play("0"); P.SP.tick(32); const c2 = P.SP.coach(); play("1"); P.SP.tick(32); const c3 = P.SP.coach(); P.SP.tick(C.doneMs + 200); const held = !T.card; play("023"); // red, then red again as told, then the rest
            ok(c2.hand && c2.kind === "side" && c2.text.indexOf(st.coach[1].say.slice(0, 12)) === 0 && c3.ring && c3.text.indexOf(st.coach[2].say.slice(0, 12)) === 0 && held, "tour: fort 5 points at red again after the ? squad turns over, then rings a ? block with its line, which stays up past doneMs (dwellMs " + C.dwellMs + ")"); }
          else play(L.win.normal);
          until(() => (st.final ? app.panel === "win" : T.card), 30000);
          if (st.final) { const w = $("p-title").textContent + " / " + $("p-line").textContent; seen.push(w); ok($("p-line").textContent === T.data.ui.winLine && $("p-primary").textContent.indexOf(T.data.ui.next) >= 0 && $("p-stats").hidden && hit($("p-primary")), "tour: the last fort's win sheet has the game's title, the practice line and Next, no coins (" + w + ")"); $("p-primary").click(); }
          else { const cd = T.el.card, nx = cd.querySelector(".tut-next"); seen.push(st.id);
            if (k === 0) { const p0 = app.S.plays, n0 = app.S.now; window.dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true })); $("btn-retry").click(); document.dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true }));
              const cell = app.V.cs / Math.min(app.cfg.board.maxDpr, window.devicePixelRatio || 1); out.notes.tourCell = cell.toFixed(1) + " CSS px a cell";
              ok(app.S.plays === p0 && app.S.now >= n0 && T.card && cell > 22, "tour: under a done card R and Retry leave the fort alone; the forts draw at " + cell.toFixed(1) + " CSS px a cell (the game's cap is 22)"); } ok(!cd.hidden && hit(nx) && big(nx) && hit(cd.querySelector(".tut-skip2")) && cd.scrollHeight <= cd.clientHeight + 1, "tour: " + st.id + " ends on its done card (Next and Skip tour hittable, the text fits)"); nx.click(); }
        }
        const cl = T.el.close, mb = Array.from(cl.querySelectorAll(".tut-mode")).filter((b) => !b.hidden);
        ok(!cl.hidden && mb.length === (P.zenOn() ? 2 : 1) && mb.every((b) => hit(b) && big(b)) && mem[C.key] === "1" && !app.save.practice && !document.body.classList.contains("tut"), "tour: finished, the closing card offers " + mb.length + " modes, the flag is set and the real save is back");
        ok(snap() === s0, "tour: the saves are untouched (no coins, inventory, best times, progress, eggs or last)");
        mb[0].click(); ok(app.screen === "map" && app.mode === "campaign" && !app.S && cl.hidden, "tour: Campaign on the closing card opens the Campaign map");
        // Settings > How to play replays it; Skip tour on a step, no confirm: home, the flag, the save untouched.
        P.showScreen("title"); $("btn-settings").click(); const row = T.el.row, rowOK = hit(row) && big(row); row.click();
        const r1 = T.on && app.entry && app.entry.id === "tut-1" && $("settings").hidden; play("0"); T.el.skip.click();
        ok(rowOK && r1 && app.screen === "title" && !T.on && snap() === s0 && app.cfg.board.maxCellCss === was.cell, "tour: Settings > How to play replays it from fort 1; Skip tour goes home at once, the saves and the board's cell cap untouched");
        // Fort 7 green first: the Recall lines pass by (nothing waits), the Ladder's comes up.
        start(); load(6); play("0"); play("1"); P.SP.tick(32); const g7 = P.SP.coach(); T.el.skip.click();
        ok(g7.text.indexOf(T.data.steps[6].coach[3].say.slice(0, 15)) === 0 && g7.kind === "badge", "tour: fort 7 with green first skips the Recall lines (nothing waits) and points at the Ladder (" + g7.text + ")");
        out.notes.tour = seen.join(", ");
      } finally {
        if (T.on || T.closing) finish("title");
        T.store = was.store; T.seen = was.seen; T.offered = was.offered; app.allPw = was.allPw; hideOffer();
        let r2 = "?"; try { r2 = localStorage.getItem(C.key); } catch (e) { /* stays "?" */ }
        ok(r2 === real, "tour: the real seen flag is untouched by selfTest");
      }
    }

    const V_ = P.v; // the cache tag, named as main.js names it (tools/playtest-bundle.py strips the versioned call)
    // Fix pass (the 1280x720 selfTest race): the load is a promise main.js boot awaits before it hands out window.SP, so a
    // test that runs the moment SP exists always finds the tour's data (a failed load still resolves: no tour).
    const ready = P.getJSON(C.file + "?v=" + V_).then((d) => { T.data = prep(d); build(); offerMaybe(); }).catch(() => { /* no tour: the game plays on */ });
    return { ready, step, panel, selfTest, start, offer: offerMaybe, get on() { return T.on; }, get card() { return T.card; }, get k() { return T.k; }, get seen() { return T.seen; } };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
