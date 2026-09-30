// Critic v4-1: the public page (no ?debug=1): no SP, 4 eras, 100 level nodes, no debug row, no console errors.
const PW = await import(process.env.PLAYWRIGHT_MODULE); const { chromium } = PW.default || PW; const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
const errs = []; p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:8492/sappers-path/'); await p.waitForSelector('#btn-tomap'); await p.tap('#btn-tomap'); await p.waitForTimeout(400);
console.log(JSON.stringify(await p.evaluate(() => ({ SP: typeof window.SP, eras: document.querySelectorAll('#eras > *').length, nodes: document.querySelectorAll('#eras button').length, debugRow: /v4 twists/i.test(document.querySelector('#eras').innerText), count: document.querySelector('#map-count').textContent, heads: [...document.querySelectorAll('#eras h3, #eras .era-name, #eras header')].map((h) => h.textContent.trim().slice(0, 30)).slice(0, 8) }))), 'errors', JSON.stringify(errs));
await b.close();
