// Greedy Deep — DOM shell, input, and the frame loop. Click it! Studios, 2026.
// Gameplay runs on a fixed-dt accumulator decoupled from rAF (lessons 12/13).
(function () {
  "use strict";

  var CONFIG_VERSION = 3; // JSON cache-bust, deliberately separate from the script tags (lesson 26)

  var UI = (window.GDUI = {});
  var E = window.GDEngine, GD = window.GD;
  var cfg = null;
  var els = {};
  var rafPending = false;
  var lastFrame = 0;
  var acc = 0;
  var autosaveT = 0;
  var uiT = 0;
  var fpsFrames = 0, fpsT = 0, fps = 0;
  var rows = [];
  var logLines = [];
  var introT = 0;

  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------ boot
  async function boot() {
    var res = await fetch("config/greedy-deep.json?v=" + CONFIG_VERSION, { cache: "no-cache" });
    cfg = await res.json();
    GD.init(cfg);

    els.gold = $("stat-gold");
    els.rate = $("stat-rate");
    els.depth = $("stat-depth");
    els.shop = $("shop");
    els.canvas = $("shaft");
    els.overlay = $("dbg");
    els.hint = $("hint");
    els.intro = $("bandintro");
    els.log = $("log");
    els.welcome = $("welcome");
    els.ending = $("ending");

    GD.hooks.onEvent = onEvent;
    GD.hooks.onBand = onBand;
    GD.hooks.onEnding = onEnding;

    window.GDRender.init(els.canvas, cfg);
    layout();
    buildShop();
    bindInput();

    resolveOffline();

    GD.save();              // a save exists from the first second, not only after 5 s
    lastFrame = performance.now();
    schedule();

    // Hidden tabs starve rAF. The fallback clock advances the sim only; it must never
    // call the frame function or rAF callbacks pile up (lesson 13).
    setInterval(function () {
      if (performance.now() - lastFrame > cfg.debug.staleFrameMs) simOnly();
    }, cfg.debug.fallbackClockMs);

    document.addEventListener("visibilitychange", function () { GD.save(); });
    window.addEventListener("resize", layout);
    if (GD.state.goldEarnedTotal > 0 && els.hint) els.hint.classList.add("gone");
    if (GD.debug) els.overlay.classList.remove("hidden");
    document.body.classList.remove("booting");
    refresh();
  }

  // ------------------------------------------------------------ offline
  function resolveOffline() {
    if (!GD.loadedFromSave || !GD.savedAt) return;
    var elapsed = Date.now() - GD.savedAt;
    var preview = GD.offlinePreview(elapsed);
    if (!(preview.gold > 0)) return;
    var applied = GD.applyOffline(elapsed);
    showWelcome(applied);
  }

  function showWelcome(p) {
    if (!els.welcome) return;
    var lines = (cfg.flavor.welcomeBack || []);
    var line = lines.length ? lines[Math.floor(Math.random() * lines.length)] : "";
    els.welcome.querySelector(".panel-body").innerHTML =
      '<div class="wb-row"><span>Away</span><b>' + E.formatEta(p.seconds) + "</b></div>" +
      '<div class="wb-row"><span>Paid for</span><b>' + E.formatEta(p.cappedSeconds) +
        (p.reason === "capped" ? ' <i class="cap">(cap)</i>' : "") + "</b></div>" +
      '<div class="wb-row"><span>Gold</span><b>+' + GD.format(p.gold) + "</b></div>" +
      '<div class="wb-row"><span>Dug</span><b>+' + p.depth.toFixed(1) + " m</b></div>" +
      '<p class="flavor">' + line + "</p>";
    els.welcome.classList.remove("hidden");
  }

  // ------------------------------------------------------------ hooks
  function onEvent(e) {
    pushLog(E.eventText(cfg, e), e.hazard ? "hazard" : "boon");
    window.GDRender.addFloater(e.hazard ? "!" : "+", e.hazard ? "#ff9a7a" : "#9fe8a4");
  }

  function onBand(b) {
    if (!els.intro) return;
    els.intro.innerHTML = '<b>' + b.name + "</b><span>" + E.bandIntro(cfg, b) + "</span>";
    els.intro.classList.remove("hidden");
    introT = 4.5;
    pushLog(b.name + " — " + E.bandIntro(cfg, b), "band");
  }

  function onEnding(st, m) {
    if (!els.ending) return;
    var f = cfg.flavor.ending || {};
    els.ending.querySelector(".panel-head").textContent = f.title || m.title;
    els.ending.querySelector(".panel-body").innerHTML =
      "<p>" + (f.body || m.body) + "</p>" +
      '<div class="wb-row"><span>Depth</span><b>' + st.depth.toFixed(0) + " m</b></div>" +
      '<div class="wb-row"><span>Gold earned</span><b>' + GD.format(st.goldEarnedTotal) + "</b></div>" +
      '<div class="wb-row"><span>Run time</span><b>' + E.formatEta(st.endingAtSeconds) + "</b></div>" +
      '<div class="score">SCORE ' + GD.format(st.endingScore) + "</div>";
    els.ending.querySelector(".panel-btn").textContent = m.buttonLabel || "KEEP DIGGING";
    els.ending.classList.remove("hidden");
    pushLog("The pick goes through into air. " + GD.format(st.endingScore) + " points.", "band");
  }

  function pushLog(text, kind) {
    logLines.unshift({ text: text, kind: kind || "" });
    var max = (cfg.eventRules && cfg.eventRules.logMax) || 30;
    if (logLines.length > max) logLines.length = max;
    if (!els.log) return;
    var html = "";
    for (var i = 0; i < Math.min(logLines.length, 6); i++) {
      html += '<div class="logline ' + logLines[i].kind + '">' + logLines[i].text + "</div>";
    }
    els.log.innerHTML = html;
  }
  UI.pushLog = pushLog;

  // ------------------------------------------------------------ layout
  function layout() {
    var L = cfg.layout;
    var s = Math.floor(Math.min(window.innerWidth / L.columnBu, window.innerHeight / L.columnHeightBu));
    s = Math.max(L.minScale, Math.min(L.maxScale, s || L.minScale));
    document.documentElement.style.setProperty("--s", s);
    window.GDRender.resize(s);
    if (els.hint) {
      var v = window.GDRender.veinRect();
      els.hint.style.left = ((v.x - 2) * s) + "px";
      els.hint.style.top = ((v.y + v.h / 2) * s) + "px";
    }
  }

  // ------------------------------------------------------------ shop
  // Every track and every dwarf gets a row. A dwarf is a track with a name and a line.
  function buildShop() {
    els.shop.innerHTML = "";
    rows = [];
    var list = E.purchasables(cfg);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var isDwarf = E.isDwarf(cfg, p.id);
      var sub = isDwarf ? (p.job + " — " + E.dwarfLine(cfg, p.id)) : (p.desc || "");
      var row = document.createElement("div");
      row.className = "row";
      row.innerHTML =
        '<div class="row-main">' +
          '<div class="row-name"><span class="tag ' + (isDwarf ? "crew" : "gear") + '">' + (isDwarf ? "CREW" : "GEAR") + "</span>" +
            '<span class="nm"></span><span class="owned"></span></div>' +
          '<div class="row-sub"></div>' +
        "</div>" +
        '<button class="buy" type="button"><span class="price"><span class="cost"></span>' +
          '<span class="unit">g</span></span><span class="eta"></span></button>';
      row.querySelector(".nm").textContent = p.name;
      row.querySelector(".row-sub").textContent = sub;
      els.shop.appendChild(row);
      var btn = row.querySelector(".buy");
      btn.addEventListener("click", (function (id) {
        return function () { onBuy(id); };
      })(p.id));
      rows.push({
        p: p, el: row, btn: btn,
        cost: row.querySelector(".cost"), owned: row.querySelector(".owned"), eta: row.querySelector(".eta")
      });
    }
  }

  function onBuy(id) {
    var r = GD.buy(id);
    var row = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].p.id === id) row = rows[i];
    if (r.ok) {
      if (row) { row.el.classList.remove("bought"); void row.el.offsetWidth; row.el.classList.add("bought"); }
      if (E.isDwarf(cfg, id) && (GD.state.owned[id] === 1)) pushLog("Hired " + E.byId(cfg, id).name + ". " + E.dwarfLine(cfg, id), "hire");
      GD.save();
    } else if (row) {
      row.el.classList.remove("nope"); void row.el.offsetWidth; row.el.classList.add("nope");
    }
    refresh();
  }

  // ------------------------------------------------------------ input
  function bindInput() {
    els.canvas.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      var rect = els.canvas.getBoundingClientRect();
      if (!window.GDRender.hitVein(e.clientX - rect.left, e.clientY - rect.top)) return;
      var g = GD.tap(1);
      if (els.hint) els.hint.classList.add("gone");
      window.GDRender.strike();
      window.GDRender.addFloater("+" + GD.format(g));
      refresh();
    }, { passive: false });
    els.canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    var wb = els.welcome && els.welcome.querySelector(".panel-btn");
    if (wb) wb.addEventListener("click", function () { els.welcome.classList.add("hidden"); });
    var eb = els.ending && els.ending.querySelector(".panel-btn");
    if (eb) eb.addEventListener("click", function () { els.ending.classList.add("hidden"); });
  }

  // ------------------------------------------------------------ clocks
  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(frame);
  }

  function frame(now) {
    rafPending = false;
    var dtReal = Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;
    advance(dtReal);
    window.GDRender.update(dtReal);
    window.GDRender.draw(GD.state, GD.derive());

    if (introT > 0) {
      introT -= dtReal;
      if (introT <= 0 && els.intro) els.intro.classList.add("hidden");
    }

    fpsFrames++; fpsT += dtReal;
    if (fpsT >= 0.5) { fps = Math.round(fpsFrames / fpsT); fpsFrames = 0; fpsT = 0; }

    uiT += dtReal;
    if (uiT >= 0.1) { uiT = 0; refresh(); }
    schedule();
  }

  // Sim-only advance for the hidden-tab fallback clock. No rendering, no rAF.
  function simOnly() {
    var now = performance.now();
    var dtReal = Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;
    advance(dtReal);
    refresh();
  }

  function advance(dtReal) {
    if (GD.paused) return;
    acc += dtReal * (GD.timeScale || 1);
    var dt = cfg.sim.dt;
    var guard = 0;
    while (acc >= dt && guard++ < 600) { E.substep(cfg, GD.state, dt, GD.ctx); acc -= dt; }
    if (guard >= 600) acc = 0; // bounded: never let a long stall spiral (lesson 7)

    autosaveT += dtReal;
    if (autosaveT >= cfg.save.autosaveSeconds) { autosaveT = 0; GD.save(); }
  }

  // ------------------------------------------------------------ HUD
  function refresh() {
    if (!GD.ready || !els.gold) return;
    var st = GD.state, d = GD.derive();
    els.gold.textContent = GD.format(st.gold);
    els.rate.textContent = (d.goldRate > 0 ? "+" + GD.format(d.goldRate) : "+0") + "/s";
    els.depth.textContent = st.depth.toFixed(cfg.format.depthDecimals) + " m";
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var cost = GD.costOf(r.p.id);
      var n = st.owned[r.p.id] || 0;
      r.cost.textContent = GD.format(cost);
      r.owned.textContent = n ? " x" + n : "";
      var afford = st.gold >= cost - 1e-9;
      r.btn.disabled = !afford;
      r.el.classList.toggle("locked", !afford);
      // Locked rows carry the price AND an ETA at the current passive rate.
      // "—" while goldRate is 0, recomputed on every refresh so a rate change shows.
      if (afford) {
        r.eta.textContent = "";
      } else {
        var eta = GD.etaFor(r.p.id);
        r.eta.textContent = isFinite(eta) ? E.formatEta(eta) : "—";
      }
    }
    GD.refreshDbg(fps);
    if (GD.debug && els.overlay) {
      els.overlay.textContent =
        "t " + st.t.toFixed(1) + "  fps " + fps +
        "\ndepth " + st.depth.toFixed(2) + "  band " + d.band.id + " [" + d.band.index + "]" +
        "\ngold " + st.gold.toFixed(2) + "  +" + d.goldRate.toFixed(3) + "/s" +
        "\nm/s " + d.digRate.toFixed(4) + "  tap " + d.goldPerTap.toFixed(2) +
        "\ntotal " + st.goldEarnedTotal.toFixed(1) + "  crew " + d.dwarves +
        "\nreveal +" + d.revealBonus + "  drawn<=" + GD.dbg.maxRenderedBandIndex + "  timed " + st.timed.length +
        "\nev " + st.eventsFired + " last " + (st.lastEvent || "-") +
        "\nowned " + JSON.stringify(st.owned) +
        "\nsave " + GD.dbg.saveSize + "b  err " + GD.dbg.errors + "/" + GD.dbg.warnings +
        "\nFLAVOR-TODO " + GD.dbg.flavorTodoCount;
    }
  }

  // Shape report for selfTest: how many rows, which ids, and whether every locked
  // row is actually printing a price and an ETA.
  UI.rowReport = function () {
    refresh();
    var ids = [], lockedWithoutEta = 0, locked = 0;
    for (var i = 0; i < rows.length; i++) {
      ids.push(rows[i].p.id);
      if (rows[i].el.classList.contains("locked")) {
        locked++;
        if (!rows[i].eta.textContent || !rows[i].cost.textContent) lockedWithoutEta++;
      }
    }
    return { rows: rows.length, ids: ids, locked: locked, lockedWithoutEta: lockedWithoutEta };
  };

  // Rebuild the shop against whatever config GD currently holds. This is what makes a
  // fifth ore / fifth dwarf a pure JSON change: nothing here knows the ids.
  UI.rebuild = function () {
    cfg = GD.config;
    if (!els.shop) return;
    buildShop();
    refresh();
  };

  UI.afterClearSave = function () {
    autosaveT = 0;
    acc = 0;
    logLines = [];
    if (els.log) els.log.innerHTML = "";
    if (els.hint) els.hint.classList.remove("gone");
    if (els.ending) els.ending.classList.add("hidden");
    if (els.welcome) els.welcome.classList.add("hidden");
    refresh();
  };

  UI.refresh = refresh;
  UI.layout = layout;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
