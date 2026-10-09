// v4.2 visual critic (read-only): which boards draw turned (rotated 90°) on landscape phones; screenshot two.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const OUT = new URL("./visual/", import.meta.url).pathname, b = await chromium.launch(), out = {};
for (const [tag, w, h] of [["812x375", 812, 375], ["844x390", 844, 390], ["667x375", 667, 375]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }), p = await c.newPage();
  await p.goto("http://127.0.0.1:8493/sappers-path/?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded");
  out[tag] = await p.evaluate(async () => { const t = { siege: [], gallery: [], n: 0, g: 0, minCs: 99 };
    for (let n = 1; n <= 100; n++) { SP.load(n, "normal"); t.n++; if (document.body.classList.contains("turned")) t.siege.push(n); t.minCs = Math.min(t.minCs, SP.state().cs / devicePixelRatio); }
    SP.unlockGallery(); for (const e of Array.from(document.querySelectorAll("#gallery .gal-tile")).map((x, i) => i)) {} 
    const gl = await (await fetch("tools/build-data/levels/gallery.json")).json(); for (const L of gl.levels) { SP.load(L.id, "normal"); t.g++; if (document.body.classList.contains("turned")) t.gallery.push(L.title); }
    return { turnedSiege: t.siege.length + "/" + t.n, firstTurned: t.siege.slice(0, 6), turnedGallery: t.gallery.length + "/" + t.g, galEx: t.gallery.slice(0, 6), minCs: +t.minCs.toFixed(2) }; });
  if (tag === "812x375") for (const id of [64, "g-noto-1f431"]) { await p.evaluate((id) => { SP.load(id, "normal"); SP.tick(40); }, id); await p.waitForTimeout(250); await p.screenshot({ path: OUT + "812-turned-" + id + ".png" }); }
  await c.close();
}
await b.close(); console.log(JSON.stringify(out));
