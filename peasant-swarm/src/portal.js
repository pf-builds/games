// Peasant Swarm portal adapter (SPEC-v2 §10; SPEC-v3 §5.2, R4 §2). One surface, PS.portal.call(ev, arg), for three adapters: none (the
// GitHub Pages build and any page without an SDK), crazygames (HTML5 SDK v3) and poki (PokiSDK v2).
// - Which adapter: <meta name="ps-portal" content="crazygames|poki"> first (tools/portal-build.mjs writes it and the SDK <script> into the
//   portal build, since a portal serves our files from its own URL and we never control its query string), then ?portal= (local QA only:
//   it also loads that portal's SDK script, e.g. ?portal=crazygames&useLocalSdk=true shows CrazyGames' demo ads on localhost), else none.
//   The Pages build has neither, so it requests nothing off-origin.
// - Guards: CrazyGames' SDK throws on any domain it does not know (environment "disabled"): after init that swaps in the no-op adapter.
//   Poki: init().catch() and load anyway. A blocked SDK script (ad blocker, CSP) leaves no global and the adapter is a no-op already.
// - Lifecycle: init, loadingStart / loadingStop around boot, gameplayStart on the first input of a match (not on load), gameplayStop on
//   pause, the end screen and the title (never twice in a row, never a start while playing). pause reasons "hidden" and "blur" skip
//   gameplayStop on CrazyGames (its platform handles focus loss) and send it on Poki.
// - commercialBreak(onStart): a midgame on PLAY AGAIN and on the title's PLAY after the first match (game.js). onStart runs when the ad
//   really starts (CrazyGames adStarted; Poki's own onStart), where game.js mutes through the master gain; the promise resolves when it is
//   over (finished, error or no ad), where game.js unmutes. Never rejects.
// - happytime(kind): kind "win" or "rout". CrazyGames: the win only (it asks for sparing use). Poki: happyTime(0.5) the first rout, 1 a win.
// - Platform mute: CrazyGames game.settings.muteAudio at init and on every settings change -> PS.portal.muted and PS.portal.onMute(m)
//   (game.js: it overrides the M key and the sound button).
// - PS.portal.store: getItem / setItem / removeItem. localStorage behind try/catch (a private window or blocked storage reads null), or
//   CrazyGames SDK.data when the portal build asks for it (<meta name="ps-portal-data" content="sdk">: the C3 Full Launch switch).
// PS.portal.log lists every event sent, in order (QA); PS.portal.skipped counts the focus-loss stops CrazyGames did not get.
(function () {
  const PS = (window.PS = window.PS || {});
  const metaOf = (n) => { const m = document.querySelector('meta[name="' + n + '"]'); return m ? m.getAttribute("content") || "" : ""; };
  const QS = new URLSearchParams(location.search), meta = metaOf("ps-portal"), which = meta || QS.get("portal") || "";
  const SDK_URL = { crazygames: "https://sdk.crazygames.com/crazygames-sdk-v3.js", poki: "https://game-cdn.poki.com/scripts/v2/poki-sdk.js" };
  // ?portal= without the meta (local QA): load that SDK here; init waits for it (a failed load resolves too, and the adapter stays a no-op)
  const sdkReady = !meta && SDK_URL[which] ? new Promise((res) => { const s = document.createElement("script"); s.src = SDK_URL[which]; s.onload = s.onerror = () => res(); document.head.appendChild(s); }) : Promise.resolve();
  const none = { name: "none" };
  function crazy() {
    const sdk = () => window.CrazyGames && window.CrazyGames.SDK, g = () => { const s = sdk(); return s && s.game; };
    return { name: "crazygames", skipFocusStop: true,
      async init() {
        const s = sdk(); if (!s || !s.init) return; await s.init();
        if (s.environment === "disabled") { A = none; P.name = "none(disabled)"; return; } // any unknown domain: every SDK method would throw
        const x = s.game; if (x && x.settings) setMute(!!x.settings.muteAudio);
        if (x && x.addSettingsChangeListener) x.addSettingsChangeListener((st) => setMute(!!(st && st.muteAudio)));
        if (metaOf("ps-portal-data") === "sdk" && s.data && s.data.getItem) P.store = s.data;
      },
      loadingStart() { const x = g(); if (x && x.loadingStart) x.loadingStart(); },
      loadingStop() { const x = g(); if (x && x.loadingStop) x.loadingStop(); },
      gameplayStart() { const x = g(); if (x && x.gameplayStart) x.gameplayStart(); },
      gameplayStop() { const x = g(); if (x && x.gameplayStop) x.gameplayStop(); },
      commercialBreak: (onStart) => new Promise((res) => { const s = sdk(); if (!s || !s.ad || !s.ad.requestAd) return res();
        s.ad.requestAd("midgame", { adStarted() { if (onStart) onStart(); }, adFinished: () => res(), adError: () => res() }); }),
      happytime(kind) { const x = g(); if (kind === "win" && x && x.happytime) x.happytime(); } };
  }
  function poki() {
    const sdk = () => window.PokiSDK;
    return { name: "poki", skipFocusStop: false,
      init() { const s = sdk(); return s && s.init ? Promise.resolve(s.init()).catch(() => {}) : undefined; },
      loadingStop() { const s = sdk(); if (s && s.gameLoadingFinished) s.gameLoadingFinished(); },
      gameplayStart() { const s = sdk(); if (s && s.gameplayStart) s.gameplayStart(); },
      gameplayStop() { const s = sdk(); if (s && s.gameplayStop) s.gameplayStop(); },
      commercialBreak: (onStart) => { const s = sdk(); return s && s.commercialBreak ? s.commercialBreak(() => { if (onStart) onStart(); }) : undefined; },
      happytime(kind) { const s = sdk(); if (s && s.happyTime) s.happyTime(kind === "win" ? 1 : 0.5); } };
  }
  function setMute(m) { if (P.muted === m) return; P.muted = m; try { if (P.onMute) P.onMute(m); } catch (e) {} }
  const lsStore = {
    getItem(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setItem(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    removeItem(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  let A = which === "crazygames" ? crazy() : which === "poki" ? poki() : none, playing = false;
  const log = [];
  const P = (PS.portal = {
    name: A.name, log, skipped: 0, muted: false, onMute: null, store: lsStore,
    // every call returns a promise that never rejects (resolved at once without an SDK); gameplayStart / gameplayStop only on a change of
    // state. arg: gameplayStop's reason ("hidden", "blur", anything else), commercialBreak's onStart, happytime's kind ("win" | "rout": game.js sends a rout only for your first of a match)
    call(ev, arg) {
      if (ev === "init") { log.push(ev); return sdkReady.then(() => (A.init ? A.init() : undefined)).catch(() => {}); }
      if (ev === "gameplayStart") { if (playing) return Promise.resolve(); playing = true; }
      else if (ev === "gameplayStop") { if (!playing) return Promise.resolve(); if ((arg === "hidden" || arg === "blur") && A.skipFocusStop) { P.skipped++; return Promise.resolve(); } playing = false; }
      if (log.length < 500) log.push(ev);
      try { const r = A[ev] ? A[ev](arg) : undefined; return Promise.resolve(r).catch(() => {}); } catch (e) { return Promise.resolve(); }
    },
  });
})();
