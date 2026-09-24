// Peasant Swarm portal adapter (SPEC-v2 §10, R6 portal checklist). No-op by default; ?portal=crazygames|poki picks an adapter that calls that
// portal's SDK global when the portal page has injected it. Nothing is fetched from here: the portal's own loader supplies its SDK, and
// without it every call is a no-op. Lifecycle: init, loadingStart / loadingStop around boot, gameplayStart on the first input of a match
// (not on load), gameplayStop on pause, the end screen and the title, commercialBreak awaited on PLAY AGAIN (audio silent while it runs),
// happytime on a win or your first rout. PS.portal.log lists every call in order (QA).
(function () {
  const PS = (window.PS = window.PS || {});
  const which = new URLSearchParams(location.search).get("portal") || "";
  const none = { name: "none" };
  function crazy() {
    const sdk = () => window.CrazyGames && window.CrazyGames.SDK, g = () => { const s = sdk(); return s && s.game; };
    return { name: "crazygames",
      init: () => { const s = sdk(); return s && s.init ? s.init() : undefined; },
      loadingStart() { const x = g(); if (x && x.loadingStart) x.loadingStart(); },
      loadingStop() { const x = g(); if (x && x.loadingStop) x.loadingStop(); },
      gameplayStart() { const x = g(); if (x && x.gameplayStart) x.gameplayStart(); },
      gameplayStop() { const x = g(); if (x && x.gameplayStop) x.gameplayStop(); },
      commercialBreak: () => new Promise((res) => { const s = sdk(); if (!s || !s.ad || !s.ad.requestAd) return res(); s.ad.requestAd("midgame", { adStarted() {}, adFinished: res, adError: res }); }),
      happytime() { const x = g(); if (x && x.happytime) x.happytime(); } };
  }
  function poki() {
    const sdk = () => window.PokiSDK;
    return { name: "poki",
      init: () => { const s = sdk(); return s && s.init ? s.init() : undefined; },
      loadingStop() { const s = sdk(); if (s && s.gameLoadingFinished) s.gameLoadingFinished(); },
      gameplayStart() { const s = sdk(); if (s && s.gameplayStart) s.gameplayStart(); },
      gameplayStop() { const s = sdk(); if (s && s.gameplayStop) s.gameplayStop(); },
      commercialBreak: () => { const s = sdk(); return s && s.commercialBreak ? s.commercialBreak() : undefined; },
      happytime() { const s = sdk(); if (s && s.happyTime) s.happyTime(1); } };
  }
  const A = which === "crazygames" ? crazy() : which === "poki" ? poki() : none, log = [];
  let playing = false;
  PS.portal = {
    name: A.name, log,
    // every call returns a promise (resolved at once without an SDK); gameplayStart / gameplayStop are sent only on a change of state
    call(ev) {
      if (ev === "gameplayStart") { if (playing) return Promise.resolve(); playing = true; } else if (ev === "gameplayStop") { if (!playing) return Promise.resolve(); playing = false; }
      if (log.length < 500) log.push(ev);
      try { const r = A[ev] ? A[ev]() : undefined; return Promise.resolve(r).catch(() => {}); } catch (e) { return Promise.resolve(); }
    },
  };
})();
