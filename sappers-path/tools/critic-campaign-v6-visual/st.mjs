const { chromium } = await import(process.env.PLAYWRIGHT_MODULE); const b = await chromium.launch(); const out=[];
for (const [w,h,d,t] of [[375,812,3,true],[1280,720,1,false]]) { const c = await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:d,hasTouch:t,isMobile:t}); const p = await c.newPage(); const log=[]; p.on("console",m=>log.push(m.type()+": "+m.text()));
await p.goto("http://127.0.0.1:8472/sappers-path/?debug=1"); await p.waitForFunction(()=>window.SP&&document.fonts.status==="loaded",null,{timeout:20000});
const r = await p.evaluate(async()=>{ const x = await SP.selfTest(); return typeof x==="object"? {pass:x.pass,fail:x.fail,fails:(x.fails||x.failures||[]).slice(0,10)}: x; }); out.push([w,h,r,log.length,log.slice(0,5)]); await c.close(); }
console.log(JSON.stringify(out)); await b.close();
