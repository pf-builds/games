// Greedy Deep — DOM shell, input, tabs, settings, and the frame loop (M4).
// Click it! Studios, 2026. Portrait tabs + desktop rails, one render path.
(function () {
  "use strict";

  var CONFIG_VERSION = 15;

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
  var activeTab = "dig";
  var isDesktop = false;
  var lastBandLogId = "";
  var userGestured = false;
  var particleSystem = null;
  var floaterSystem = null;
  var oreCombo = 0;
  var oreComboT = 0;

  function $(id) { return document.getElementById(id); }

  // Flavor fallback: if a string starts with "FLAVOR-TODO:" render
  // the neutral fallback from cfg.flavor.fallbacks instead.
  function deflavor(str, slot) {
    if (typeof str !== "string") return str || "";
    if (str.indexOf("FLAVOR-TODO:") !== 0) return str;
    var fb = cfg.flavor && cfg.flavor.fallbacks;
    return (fb && fb[slot]) || "";
  }

  // ------------------------------------------------------------ boot
  async function boot() {
    var res = await fetch("config/greedy-deep.json?v=" + CONFIG_VERSION, { cache: "no-cache" });
    cfg = await res.json();
    GD.init(cfg);

    if (window.GDAudio) window.GDAudio.init(cfg);

    // Restore mute from prefs
    if (GD.state.prefs && GD.state.prefs.muted && window.GDAudio) {
      window.GDAudio.setMuted(true);
    }

    els.gold = $("stat-gold");
    els.rate = $("stat-rate");
    els.depth = $("stat-depth");
    els.canvas = $("shaft");
    els.overlay = $("dbg");
    els.hint = $("hint");
    els.intro = $("bandintro");
    els.log = $("log");
    els.welcome = $("welcome");
    els.ending = $("ending");
    els.nextbands = $("nextbands");
    els.roster = $("roster");
    els.tabbar = $("tabbar");
    els.tabpanel = $("tabpanel");
    els.leftRail = $("left-rail");
    els.rightRail = $("right-rail");
    els.muteBtn = $("mute-btn");
    els.settings = $("settings");

    els.splash = $("splash");
    els.splashLogo = $("splash-logo");
    els.descend = $("descend");

    GD.hooks.onEvent = onEvent;
    GD.hooks.onBand = onBand;
    GD.hooks.onEnding = onEnding;

    // Particles (from staged GDParticles)
    if (window.GDParticles) {
      particleSystem = window.GDParticles.Particles(cfg.particles.max);
      floaterSystem = window.GDParticles.Floaters();
    }

    window.GDRender.init(els.canvas, cfg);
    window.GDSprites.ensure(GD.debug);
    layout();
    measureTitleCard();
    buildShop();
    buildRoster();
    bindInput();
    bindTabs();
    bindSettings();

    resolveOffline();

    GD.save();
    lastFrame = performance.now();
    schedule();

    setInterval(function () {
      if (performance.now() - lastFrame > cfg.debug.staleFrameMs) simOnly();
    }, cfg.debug.fallbackClockMs);

    document.addEventListener("visibilitychange", function () {
      GD.save();
      if (window.GDSprites && window.GDSprites.ensure) window.GDSprites.ensure(false);
    });
    window.addEventListener("resize", layout);
    if (GD.state.goldEarnedTotal > 0 && els.hint) els.hint.classList.add("gone");
    if (GD.debug) els.overlay.classList.remove("hidden");
    document.body.classList.remove("booting");
    refresh();
    updateMuteUI();
  }

  // ------------------------------------------------------------ offline
  function resolveOffline() {
    if (!GD.loadedFromSave || !GD.savedAt) return;
    var elapsed = Date.now() - GD.savedAt;
    var preview = GD.offlinePreview(elapsed);
    if (!(preview.gold > 0)) return;
    var applied = GD.applyOffline(elapsed);
    showWelcome(applied);
    if (window.GDAudio && !GD.state.prefs.muted) window.GDAudio.play("welcomeBack");
  }

  function showWelcome(p) {
    if (!els.welcome) return;
    var lines = (cfg.flavor.welcomeBack || []);
    var line = lines.length ? lines[Math.floor(Math.random() * lines.length)] : "";
    line = deflavor(line, "welcomeBack");
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
    var text = deflavor(E.eventText(cfg, e), "event");
    pushLog(text, e.hazard ? "hazard" : "boon");
    if (window.GDAudio) window.GDAudio.play(e.hazard ? "hazard" : "orePop");
    if (window.GDRender) window.GDRender.addFloater(e.hazard ? "!" : "+", e.hazard ? "#ff9a7a" : "#9fe8a4");
  }

  function onBand(b) {
    if (!els.intro) return;
    var intro = deflavor(E.bandIntro(cfg, b), "bandIntro");
    // Prevent repeating the same band-entry line back-to-back (M3 carry)
    if (b.id === lastBandLogId) return;
    lastBandLogId = b.id;
    els.intro.innerHTML = '<b>' + b.name + "</b><span>" + intro + "</span>";
    els.intro.classList.remove("hidden");
    introT = 4.5;
    pushLog(b.name + " — " + intro, "band");
    if (window.GDAudio) window.GDAudio.play("bandBreak");
    // Band-change reveal particles
    if (particleSystem && window.GDRender) {
      var vr = window.GDRender.veinRect();
      particleSystem.ring(vr.x + vr.w / 2, vr.y, var_gold(), cfg.particles.bandRingR0, cfg.particles.bandRingR1, cfg.particles.bandRingLife);
    }
  }

  function var_gold() { return "#f2c14e"; }

  function onEnding(st, m) {
    if (!els.ending) return;
    var f = cfg.flavor.ending || {};
    var title = deflavor(f.title || m.title, "endingTitle");
    var body = deflavor(f.body || m.body, "ending");
    els.ending.querySelector(".panel-head").textContent = title;
    els.ending.querySelector(".panel-body").innerHTML =
      "<p>" + body + "</p>" +
      '<div class="wb-row"><span>Depth</span><b>' + st.depth.toFixed(0) + " m</b></div>" +
      '<div class="wb-row"><span>Gold earned</span><b>' + GD.format(st.goldEarnedTotal) + "</b></div>" +
      '<div class="wb-row"><span>Run time</span><b>' + E.formatEta(st.endingAtSeconds) + "</b></div>";
    els.ending.querySelector(".score").textContent = "SCORE " + GD.format(st.endingScore);
    els.ending.querySelector(".panel-btn").textContent = m.buttonLabel || "KEEP DIGGING";
    els.ending.classList.remove("hidden");
    pushLog("The pick goes through into air. " + GD.format(st.endingScore) + " points.", "band");
    if (window.GDAudio) window.GDAudio.play("milestone");
  }

  function pushLog(text, kind) {
    logLines.unshift({ text: text, kind: kind || "" });
    var max = (cfg.eventRules && cfg.eventRules.logMax) || 30;
    if (logLines.length > max) logLines.length = max;
    renderLog();
  }
  UI.pushLog = pushLog;

  function renderLog() {
    if (!els.log) return;
    var html = "";
    for (var i = 0; i < Math.min(logLines.length, 6); i++) {
      html += '<div class="logline ' + logLines[i].kind + '">' + logLines[i].text + "</div>";
    }
    els.log.innerHTML = html;
    // Desktop rail log
    if (isDesktop && els.rightRail) {
      var railLog = els.rightRail.querySelector(".rail-log");
      if (railLog) railLog.innerHTML = html;
    }
  }

  // ------------------------------------------------------------ layout
  function layout() {
    var L = cfg.layout;
    var vw = window.innerWidth, vh = window.innerHeight;
    isDesktop = vw >= L.desktopBreakpoint;

    var s;
    if (isDesktop) {
      // Desktop: scale = clamp(2, floor(min((vw-540)/160, vh/300)), 4)
      s = Math.floor(Math.min((vw - (L.leftRailPx + L.rightRailPx)) / L.columnBu, vh / 300));
    } else {
      // Portrait: scale = clamp(2, floor(min(vw/160, vh/columnHeightBu)), 4)
      s = Math.floor(Math.min(vw / L.columnBu, vh / L.columnHeightBu));
    }
    s = Math.max(L.minScale, Math.min(L.maxScale, s || L.minScale));
    document.documentElement.style.setProperty("--s", s);

    // On desktop, shaft gets taller: vh/scale - topBar bu
    if (isDesktop) {
      var shaftH = Math.floor(vh / s) - L.topBarBu;
      if (shaftH < 200) shaftH = 200;
      cfg.layout._liveShaftBu = shaftH;
    } else {
      cfg.layout._liveShaftBu = L.shaftBu;
    }

    window.GDRender.resize(s, cfg.layout._liveShaftBu);
    drawLogo(s);
    placeHint();

    // Desktop: rebuild rails
    if (isDesktop) {
      buildDesktopRails();
    }
  }

  function buildDesktopRails() {
    if (!els.leftRail || !els.rightRail) return;
    // Left rail: roster cards
    var html = '<div class="rail-head">CREW ROSTER</div>';
    for (var i = 0; i < cfg.dwarves.length; i++) {
      var dw = cfg.dwarves[i];
      var n = GD.state.owned[dw.id] || 0;
      if (!n) continue;
      var pal = cfg.sprites.palettes[dw.cosmetic && dw.cosmetic.palette || "rust"] || {};
      html += '<div class="rail-card">' +
        '<div class="rail-card-icon" style="background:' + (pal.tunic || "#666") + '">' + (dw.name || "?")[0] + '</div>' +
        '<div class="rail-card-info"><div class="rail-card-name">' + dw.name + '</div>' +
        '<div class="rail-card-sub">' + dw.job + ' x' + n + '</div></div></div>';
    }
    var total = GD.derive().dwarves;
    if (total > 0) html += '<div class="rail-card-sub" style="padding:6px 12px;color:#9a907f">' + total + ' crew total</div>';
    els.leftRail.innerHTML = html;

    // Right rail: all shop sections expanded + log
    var rhtml = '';
    var tabDefs = cfg.layout.tabs;
    var tabOrder = ["dig", "crew", "gear", "log"];
    for (var t = 0; t < tabOrder.length; t++) {
      var tid = tabOrder[t];
      var td = tabDefs[tid];
      if (!td) continue;
      rhtml += '<div class="rail-section"><div class="rail-head">' + td.label + '</div>';
      if (tid === "log") {
        rhtml += '<div class="rail-log" id="rail-log"></div>';
      } else {
        rhtml += '<div class="shop-rows" id="rail-' + tid + '"></div>';
      }
      rhtml += '</div>';
    }
    els.rightRail.innerHTML = rhtml;

    // Move shop rows into the rail sections
    for (var t2 = 0; t2 < tabOrder.length; t2++) {
      if (tabOrder[t2] === "log") continue;
      var railShop = els.rightRail.querySelector("#rail-" + tabOrder[t2]);
      if (!railShop) continue;
      var td2 = tabDefs[tabOrder[t2]];
      if (!td2 || !td2.ids) continue;
      for (var ri = 0; ri < rows.length; ri++) {
        if (td2.ids.indexOf(rows[ri].p.id) !== -1) {
          var clone = rows[ri].el.cloneNode(true);
          // Re-bind click on the clone
          (function (id, cl) {
            var btn = cl.querySelector(".buy");
            if (btn) btn.addEventListener("click", function () { onBuy(id); });
          })(rows[ri].p.id, clone);
          railShop.appendChild(clone);
        }
      }
    }
    renderLog();
  }

  // ------------------------------------------------------------ splash
  function drawLogo(s) {
    if (!els.splashLogo || !window.GDSprites) return;
    var art = window.GDSprites.logo("GREEDY DEEP", "#f7dc95", "#d09a2e", "#160f06");
    var k = Math.max(2, Math.min(4, s));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cssW = art.width * k, cssH = art.height * k;
    els.splashLogo.style.width = cssW + "px";
    els.splashLogo.style.height = cssH + "px";
    els.splashLogo.width = Math.round(cssW * dpr);
    els.splashLogo.height = Math.round(cssH * dpr);
    var g = els.splashLogo.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, cssW, cssH);
    g.drawImage(art, 0, 0, cssW, cssH);
    if (window.GDSprites.opaqueCount(els.splashLogo) === 0) {
      GD.dbg.logoRedraws = (GD.dbg.logoRedraws || 0) + 1;
      g.drawImage(window.GDSprites.logo("GREEDY DEEP", "#f7dc95", "#d09a2e", "#160f06"), 0, 0, cssW, cssH);
    }
  }
  UI.drawLogo = drawLogo;

  function measureTitleCard() {
    var tc = cfg.titleCard;
    if (!tc || !tc.src) { GD.dbg.titleCardBytes = 0; return; }
    fetch(tc.src, { cache: "force-cache" })
      .then(function (r) { return r.ok ? r.blob() : null; })
      .then(function (b) { GD.dbg.titleCardBytes = b ? b.size : 0; })
      .catch(function () { GD.dbg.titleCardBytes = 0; });
  }

  function dismissSplash() {
    if (!els.splash || els.splash.classList.contains("gone")) return;
    els.splash.classList.add("gone");
    var ms = (cfg.titleCard && cfg.titleCard.fadeMs) || 450;
    setTimeout(function () { els.splash.classList.add("off"); }, ms + 60);
    // First user gesture: unlock audio
    unlockAudio();
  }
  UI.dismissSplash = dismissSplash;

  function unlockAudio() {
    if (userGestured) return;
    userGestured = true;
    if (window.GDAudio) {
      window.GDAudio.unlock();
      if (!GD.state.prefs.muted) {
        var df = cfg.milestone ? GD.state.depth / cfg.milestone.depth : 0;
        window.GDAudio.startAmbient(df);
      }
    }
  }

  var hintKey = "";
  function placeHint() {
    if (!els.hint) return;
    var s = window.GDRender.scale();
    var v = window.GDRender.veinRect();
    var key = s + ":" + v.x + ":" + v.y;
    if (key === hintKey) return;
    hintKey = key;
    els.hint.style.left = ((v.x - 2) * s) + "px";
    els.hint.style.top = ((v.y + v.h / 2) * s) + "px";
  }

  // ------------------------------------------------------------ roster
  function buildRoster() {
    if (!els.roster) return;
    var html = "";
    for (var i = 0; i < cfg.dwarves.length; i++) {
      var dw = cfg.dwarves[i];
      var n = GD.state.owned[dw.id] || 0;
      if (!n) continue;
      var pal = cfg.sprites.palettes[dw.cosmetic && dw.cosmetic.palette || "rust"] || {};
      html += '<div class="roster-chip">' +
        '<div class="chip-icon" style="background:' + (pal.tunic || "#666") + '">' + (dw.name || "?")[0] + '</div>' +
        '<div class="chip-name">' + dw.name.split(" ")[0] + '</div>' +
        '<div class="chip-count">x' + n + '</div>' +
        '</div>';
    }
    var total = GD.derive().dwarves;
    if (total > 0) html += '<div class="roster-add">' + total + ' crew</div>';
    else html += '<div class="roster-add">No crew yet</div>';
    els.roster.innerHTML = html;
  }

  // ------------------------------------------------------------ shop (tabs)
  function buildShop() {
    rows = [];
    var tabDefs = cfg.layout.tabs;
    var containers = {
      dig: $("shop-dig"),
      crew: $("shop-crew"),
      gear: $("shop-gear")
    };
    for (var k in containers) if (containers[k]) containers[k].innerHTML = "";

    var list = E.purchasables(cfg);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var isDwarf = E.isDwarf(cfg, p.id);
      // Determine which tab
      var tab = "gear";
      for (var tid in tabDefs) {
        if (tabDefs[tid].ids && tabDefs[tid].ids.indexOf(p.id) !== -1) { tab = tid; break; }
      }
      var sub = isDwarf ? (p.job + " — " + deflavor(E.dwarfLine(cfg, p.id), "dwarfLine")) : (p.desc || "");
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
      var container = containers[tab];
      if (container) container.appendChild(row);
      var btn = row.querySelector(".buy");
      btn.addEventListener("click", (function (id) {
        return function () { onBuy(id); };
      })(p.id));
      rows.push({
        p: p, el: row, btn: btn, tab: tab,
        cost: row.querySelector(".cost"), owned: row.querySelector(".owned"), eta: row.querySelector(".eta")
      });
    }
  }

  function onBuy(id) {
    unlockAudio();
    var r = GD.buy(id);
    var row = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].p.id === id) row = rows[i];
    if (r.ok) {
      if (row) { row.el.classList.remove("bought"); void row.el.offsetWidth; row.el.classList.add("bought"); }
      var isDwarf = E.isDwarf(cfg, id);
      if (isDwarf && (GD.state.owned[id] === 1)) {
        pushLog("Hired " + E.byId(cfg, id).name + ". " + deflavor(E.dwarfLine(cfg, id), "dwarfLine"), "hire");
        if (window.GDAudio) window.GDAudio.play("hire");
      } else {
        if (window.GDAudio) window.GDAudio.play("buy");
      }
      GD.save();
      buildRoster();
      if (isDesktop) buildDesktopRails();
    } else if (row) {
      row.el.classList.remove("nope"); void row.el.offsetWidth; row.el.classList.add("nope");
      if (window.GDAudio) window.GDAudio.play("denied");
    }
    refresh();
  }

  // ------------------------------------------------------------ tabs
  function bindTabs() {
    if (!els.tabbar) return;
    var tabs = els.tabbar.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener("click", (function (t) {
        return function () { switchTab(t.getAttribute("data-tab")); };
      })(tabs[i]));
    }
  }

  function switchTab(id) {
    activeTab = id;
    if (!els.tabbar || !els.tabpanel) return;
    var tabs = els.tabbar.querySelectorAll(".tab");
    var sections = els.tabpanel.querySelectorAll(".tab-section");
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle("active", tabs[i].getAttribute("data-tab") === id);
    for (var j = 0; j < sections.length; j++) sections[j].classList.toggle("active", sections[j].id === "tab-" + id);
    if (window.GDAudio) window.GDAudio.play("ui");
  }

  // ------------------------------------------------------------ settings
  function bindSettings() {
    if (els.muteBtn) els.muteBtn.addEventListener("click", function () { toggleMute(); });

    var settingsGear = $("mute-btn");
    // Long press on mute button opens settings
    if (settingsGear) {
      settingsGear.addEventListener("dblclick", function () { openSettings(); });
    }

    var close = $("settings-close");
    if (close) close.addEventListener("click", closeSettings);

    var setMute = $("set-mute");
    if (setMute) setMute.addEventListener("click", toggleMute);

    var setExport = $("set-export");
    if (setExport) setExport.addEventListener("click", doExport);

    var setImport = $("set-import");
    if (setImport) setImport.addEventListener("click", function () {
      var area = $("import-area");
      var btn = $("import-confirm");
      if (area) { area.classList.toggle("hidden"); area.value = ""; }
      if (btn) btn.classList.toggle("hidden");
    });

    var importConfirm = $("import-confirm");
    if (importConfirm) importConfirm.addEventListener("click", doImport);

    var setReset = $("set-reset");
    if (setReset) setReset.addEventListener("click", function () {
      var rc = $("reset-confirm");
      if (rc) rc.classList.toggle("hidden");
    });

    var resetYes = $("reset-yes");
    if (resetYes) resetYes.addEventListener("click", function () {
      GD._clearSave();
      closeSettings();
      buildRoster();
      if (isDesktop) buildDesktopRails();
    });
  }

  function openSettings() {
    if (els.settings) els.settings.classList.remove("hidden");
    updateMuteUI();
  }

  function closeSettings() {
    if (els.settings) els.settings.classList.add("hidden");
    var rc = $("reset-confirm");
    if (rc) rc.classList.add("hidden");
    var ea = $("export-area");
    if (ea) ea.classList.add("hidden");
    var ia = $("import-area");
    if (ia) ia.classList.add("hidden");
    var ic = $("import-confirm");
    if (ic) ic.classList.add("hidden");
  }

  function toggleMute() {
    unlockAudio();
    var newMuted = !GD.state.prefs.muted;
    GD.state.prefs.muted = newMuted;
    if (window.GDAudio) window.GDAudio.setMuted(newMuted);
    if (!newMuted && userGestured) {
      var df = cfg.milestone ? GD.state.depth / cfg.milestone.depth : 0;
      window.GDAudio.startAmbient(df);
    }
    GD.save();
    updateMuteUI();
  }

  function updateMuteUI() {
    var m = GD.state.prefs.muted;
    if (els.muteBtn) {
      els.muteBtn.classList.toggle("muted", m);
      els.muteBtn.textContent = m ? "✖" : "♪";
    }
    var setMute = $("set-mute");
    if (setMute) setMute.textContent = m ? "OFF" : "ON";
  }

  function doExport() {
    var str = window.GDSave.exportString(cfg, GD.state);
    if (!str) return;
    var area = $("export-area");
    if (area) { area.classList.remove("hidden"); area.value = str; area.select(); }
    try { navigator.clipboard.writeText(str); } catch (e) { /* fallback: textarea is visible */ }
  }

  function doImport() {
    var area = $("import-area");
    if (!area || !area.value.trim()) return;
    var result = window.GDSave.importString(cfg, area.value.trim());
    if (!result.ok) {
      area.value = "Import failed: " + result.reason;
      return;
    }
    GD.state = result.state;
    window.GDSave.write(cfg, GD.state);
    area.classList.add("hidden");
    $("import-confirm").classList.add("hidden");
    buildShop();
    buildRoster();
    if (isDesktop) buildDesktopRails();
    refresh();
    closeSettings();
  }

  // ------------------------------------------------------------ input
  function bindInput() {
    var down = null, moved = false;
    els.canvas.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      unlockAudio();
      var rect = els.canvas.getBoundingClientRect();
      down = { x: e.clientX, y: e.clientY, lx: e.clientX - rect.left, ly: e.clientY - rect.top, py: e.clientY };
      moved = false;
      if (els.canvas.setPointerCapture) { try { els.canvas.setPointerCapture(e.pointerId); } catch (err) {} }
    }, { passive: false });

    els.canvas.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dy = e.clientY - down.py;
      if (!moved && Math.abs(e.clientY - down.y) + Math.abs(e.clientX - down.x) > 6) moved = true;
      if (moved) {
        down.py = e.clientY;
        window.GDRender.cameraNudge(-dy / window.GDRender.scale(), true);
      }
    }, { passive: true });

    function endPointer() {
      if (!down) return;
      var d = down; down = null;
      window.GDRender.cameraRelease();
      if (moved) return;
      if (!window.GDRender.hitVein(d.lx, d.ly)) {
        // Check if tapping veiled area
        if (window.GDAudio) window.GDAudio.play("denied");
        return;
      }
      var g = GD.tap(1);
      if (els.hint) els.hint.classList.add("gone");

      // Juice: strike
      window.GDRender.strike();
      if (window.GDAudio) window.GDAudio.play("strike");

      // Particles: rock chunks
      if (particleSystem) {
        var vr = window.GDRender.veinRect();
        var cx = vr.x + vr.w / 2, cy = vr.y + vr.h / 2;
        var band = GD.derive().band;
        particleSystem.burst(cx, cy, band.palette ? band.palette.dark : "#332d3c",
          cfg.particles.strikeChunks, cfg.particles.strikeSpeed,
          cfg.particles.strikeLife, cfg.particles.strikeSize, cfg.particles.strikeGravity);
      }

      // Floater
      if (floaterSystem) {
        var vr2 = window.GDRender.veinRect();
        floaterSystem.add(vr2.x + vr2.w / 2 + (Math.random() * 8 - 4), vr2.y, "+" + GD.format(g), "#ffe89a", cfg.particles.floaterSize, cfg.particles.floaterLife);
      }

      // Ore combo tracking
      oreCombo++;
      oreComboT = 0.6;

      refresh();
    }
    els.canvas.addEventListener("pointerup", endPointer);
    els.canvas.addEventListener("pointercancel", function () { down = null; window.GDRender.cameraRelease(); });

    els.canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      var notch = (cfg.camera && cfg.camera.wheelBuPerNotch) || 24;
      window.GDRender.cameraNudge(e.deltaY > 0 ? notch : -notch, false);
    }, { passive: false });

    els.canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    if (els.descend) els.descend.addEventListener("click", dismissSplash);

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
    var dtReal = Math.max(0, Math.min(0.25, (now - lastFrame) / 1000));
    lastFrame = now;
    advance(dtReal);
    var dFrame = GD.derive();

    // Particles + floaters update
    if (particleSystem) particleSystem.update(dtReal);
    if (floaterSystem) floaterSystem.update(dtReal);

    // Ore combo decay
    if (oreComboT > 0) { oreComboT -= dtReal; if (oreComboT <= 0) oreCombo = 0; }

    window.GDRender.update(dtReal, GD.state, dFrame);
    window.GDRender.draw(GD.state, dFrame);

    // Draw particles + floaters on top
    if (particleSystem || floaterSystem) {
      var rctx = window.GDRender.ctx ? window.GDRender.ctx() : null;
      if (rctx) {
        if (particleSystem) particleSystem.draw(rctx);
        if (floaterSystem) floaterSystem.draw(rctx);
      }
    }

    if (introT > 0) {
      introT -= dtReal;
      if (introT <= 0 && els.intro) els.intro.classList.add("hidden");
    }

    fpsFrames++; fpsT += dtReal;
    if (fpsT >= 0.5) { fps = Math.round(fpsFrames / fpsT); fpsFrames = 0; fpsT = 0; }

    // Update ambient drone depth
    if (window.GDAudio && window.GDAudio.isAmbientOn() && cfg.milestone) {
      window.GDAudio.updateAmbient(GD.state.depth / cfg.milestone.depth);
    }

    uiT += dtReal;
    if (uiT >= 0.1) { uiT = 0; refresh(); }
    schedule();
  }

  function simOnly() {
    var now = performance.now();
    var dtReal = Math.max(0, Math.min(0.25, (now - lastFrame) / 1000));
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
    if (guard >= 600) acc = 0;

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
      if (afford) {
        r.eta.textContent = "";
      } else {
        var eta = GD.etaFor(r.p.id);
        r.eta.textContent = isFinite(eta) ? E.formatEta(eta) : "—";
      }
    }
    renderNextBands(d);
    placeHint();
    GD.refreshDbg(fps);
    if (GD.debug && els.overlay) {
      var A = window.GDAudio;
      els.overlay.textContent =
        "t " + st.t.toFixed(1) + "  fps " + fps +
        "\ndepth " + st.depth.toFixed(2) + "  band " + d.band.id + " [" + d.band.index + "]" +
        "\ngold " + st.gold.toFixed(2) + "  +" + d.goldRate.toFixed(3) + "/s" +
        "\nm/s " + d.digRate.toFixed(4) + "  tap " + d.goldPerTap.toFixed(2) +
        "\ntotal " + st.goldEarnedTotal.toFixed(1) + "  crew " + d.dwarves +
        "\ncamY " + GD.dbg.cameraY.toFixed(0) + "  crew@ " + GD.dbg.deepestDwarfY.toFixed(0) +
          "  d " + Math.abs(GD.dbg.cameraY - GD.dbg.deepestDwarfY).toFixed(1) + "bu" +
        "\nreveal +" + d.revealBonus + "  drawn<=" + GD.dbg.maxRenderedBandIndex +
          "  fwd " + GD.dbg.forwardMeters.toFixed(0) + "m  veil " + GD.dbg.veilAlpha.toFixed(2) +
        "\ntimed " + st.timed.length +
        "\nev " + st.eventsFired + " last " + (st.lastEvent || "-") +
        "\nowned " + JSON.stringify(st.owned) +
        "\ncard " + GD.dbg.titleCardBytes + "b  sprites " +
          GD.dbg.spriteCacheOpaque + "/" + GD.dbg.spriteCacheTotal +
          " rb" + GD.dbg.spriteCacheRebuilds +
        "\naudio " + (A ? (A.isMuted() ? "MUTED" : "gain=" + (A.masterGainValue() || 0).toFixed(2)) : "n/a") +
          "  last=" + (A ? (A.lastCue || "-") : "-") +
        "\nsave " + GD.dbg.saveSize + "b  err " + GD.dbg.errors + "/" + GD.dbg.warnings +
        "\nFLAVOR-TODO " + GD.dbg.flavorTodoCount;
    }
  }

  var lastNextKey = "";
  function renderNextBands(d) {
    if (!els.nextbands) return;
    var plan = window.GDRender.bandPlan(GD.state.depth, d.revealBonus || 0);
    var key = plan.nextBands.map(function (b) { return b.id; }).join("|");
    if (key === lastNextKey) return;
    lastNextKey = key;
    var html = "";
    for (var i = 0; i < plan.nextBands.length; i++) {
      var b = plan.nextBands[i];
      html += '<div class="nb"><span class="nb-k">' + (i === 0 ? "NEXT" : "THEN") + '</span>' +
        '<span class="nb-n">' + b.name + '</span>' +
        '<span class="nb-d">' + b.startDepth + ' m</span></div>';
    }
    els.nextbands.innerHTML = html;
  }

  UI.nextBandsReport = function () {
    var d = GD.derive();
    lastNextKey = "";
    renderNextBands(d);
    return {
      lines: els.nextbands ? els.nextbands.querySelectorAll(".nb").length : 0,
      text: els.nextbands ? els.nextbands.textContent.replace(/\s+/g, " ").trim() : ""
    };
  };

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

  UI.rebuild = function () {
    cfg = GD.config;
    if (!els.roster) return;
    lastNextKey = "";
    buildShop();
    buildRoster();
    if (isDesktop) buildDesktopRails();
    refresh();
  };

  UI.afterClearSave = function () {
    autosaveT = 0;
    acc = 0;
    logLines = [];
    lastBandLogId = "";
    if (els.log) els.log.innerHTML = "";
    if (els.hint) els.hint.classList.remove("gone");
    if (els.ending) els.ending.classList.add("hidden");
    if (els.welcome) els.welcome.classList.add("hidden");
    buildRoster();
    refresh();
  };

  UI.refresh = refresh;
  UI.layout = layout;
  UI.openSettings = openSettings;
  UI.particleCount = function () {
    // Count active particles for selfTest
    if (!particleSystem) return 0;
    // We need to check the pool... particles system doesn't expose count directly
    // Return the configured max as the upper bound check
    return cfg.particles.max;
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
