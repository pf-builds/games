// Greedy Deep — DOM shell, input, and the frame loop. Click it! Studios, 2026.
// Gameplay runs on a fixed-dt accumulator decoupled from rAF (lessons 12/13).
(function () {
  "use strict";

  var CONFIG_VERSION = 2; // JSON cache-bust, deliberately separate from the script tags (lesson 26)

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

    window.GDRender.init(els.canvas, cfg);
    layout();
    buildShop();
    bindInput();

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
  function buildShop() {
    els.shop.innerHTML = "";
    rows = [];
    var list = E.purchasables(cfg);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var isDwarf = cfg.dwarves.indexOf(p) !== -1;
      var row = document.createElement("div");
      row.className = "row";
      row.innerHTML =
        '<div class="row-main">' +
          '<div class="row-name"><span class="tag ' + (isDwarf ? "crew" : "gear") + '">' + (isDwarf ? "CREW" : "GEAR") + "</span>" + p.name + '<span class="owned"></span></div>' +
          '<div class="row-sub">' + (p.desc || p.flavor || "") + "</div>" +
        "</div>" +
        '<button class="buy" type="button"><span class="cost"></span><span class="unit">g</span></button>';
      els.shop.appendChild(row);
      var btn = row.querySelector(".buy");
      btn.addEventListener("click", (function (id) {
        return function () { onBuy(id); };
      })(p.id));
      rows.push({ p: p, el: row, btn: btn, cost: row.querySelector(".cost"), owned: row.querySelector(".owned") });
    }
  }

  function onBuy(id) {
    var r = GD.buy(id);
    if (r.ok) {
      var row = null;
      for (var i = 0; i < rows.length; i++) if (rows[i].p.id === id) row = rows[i];
      if (row) { row.el.classList.remove("bought"); void row.el.offsetWidth; row.el.classList.add("bought"); }
      GD.save();
    } else {
      for (var j = 0; j < rows.length; j++) if (rows[j].p.id === id) {
        rows[j].el.classList.remove("nope"); void rows[j].el.offsetWidth; rows[j].el.classList.add("nope");
      }
    }
    refresh();
  }

  // ------------------------------------------------------------ input
  function bindInput() {
    // Pointer events cover mouse and touch with no 300 ms delay.
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
    while (acc >= dt && guard++ < 600) { E.substep(cfg, GD.state, dt); acc -= dt; }
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
    els.depth.textContent = st.depth.toFixed(1) + " m";
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var cost = GD.costOf(r.p.id);
      var n = st.owned[r.p.id] || 0;
      r.cost.textContent = GD.format(cost);
      r.owned.textContent = n ? " x" + n : "";
      var afford = st.gold >= cost - 1e-9;
      r.btn.disabled = !afford;
      r.el.classList.toggle("locked", !afford);
    }
    GD.refreshDbg(fps);
    if (GD.debug && els.overlay) {
      els.overlay.textContent =
        "t " + st.t.toFixed(1) + "  fps " + fps +
        "\ndepth " + st.depth.toFixed(2) + "  band " + d.band.id +
        "\ngold " + st.gold.toFixed(2) + "  +" + d.goldRate.toFixed(3) + "/s" +
        "\nm/s " + d.digRate.toFixed(3) + "  tap " + d.goldPerTap.toFixed(2) +
        "\ntotal " + st.goldEarnedTotal.toFixed(1) + "  dwarves " + d.dwarves +
        "\nowned " + JSON.stringify(st.owned) +
        "\nsave " + GD.dbg.saveSize + "b  err " + GD.dbg.errors + "/" + GD.dbg.warnings;
    }
  }

  // GD._clearSave() calls this: drop the pending autosave and the leftover sim
  // accumulator so nothing from the cleared run can be written back.
  UI.afterClearSave = function () {
    autosaveT = 0;
    acc = 0;
    if (els.hint) els.hint.classList.remove("gone");
    refresh();
  };

  UI.refresh = refresh;
  UI.layout = layout;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
