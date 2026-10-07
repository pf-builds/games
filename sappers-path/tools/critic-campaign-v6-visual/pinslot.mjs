const { chromium } = await import(process.env.PLAYWRIGHT_MODULE); const b = await chromium.launch();
const c = await b.newContext({viewport:{width:375,height:812},deviceScaleFactor:3,hasTouch:true,isMobile:true}); const p = await c.newPage();
await p.goto("http://127.0.0.1:8472/sappers-path/?debug=1"); await p.waitForFunction(()=>window.SP&&document.fonts.status==="loaded");
await p.evaluate(()=>{SP.unlockTo(63); SP.load("e3-64");}); await p.waitForTimeout(300);
const o = await p.evaluate(()=>SP.hitPlan("e3-64"));
const slots = () => p.evaluate(()=>({head: document.getElementById("line-head").textContent.replace(/\s+/g," ").trim(), slots: Array.from(document.querySelectorAll("#line .slot")).map(s=>s.className+" | "+(s.getAttribute("aria-label")||"")), hits: SP.hits()}));
for (const ch of o) { await p.locator('button.card[data-col="'+ch+'"]').first().tap(); await p.evaluate(()=>{for(let i=0;i<3000&&SP.state().busy;i++)SP.tick(100);}); }
console.log(o, JSON.stringify(await slots(), null, 1));
// extra: are there other stuck squads? tick more
await p.evaluate(()=>{for(let i=0;i<50;i++)SP.tick(100);}); console.log(JSON.stringify(await slots(),null,1));
await b.close();
