// Runs gen.batch tasks across worker threads; results come back in task order, so thread timing never changes output.
// A worker that throws is logged and its task returns empty (callers never see an exception).
"use strict";
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const os = require("os");

if (!isMainThread) {
  const Gen = require("./gen.js");
  const { C, task } = workerData;
  let out; try { out = Gen.batch(C, task.wk, task.seed, task.n, task.mode); } catch (e) { out = { recs: [], fails: { ["error: " + (e && e.message)]: 1 } }; }
  parentPort.postMessage(out);
  return;
}

function run(C, tasks, onDone) {
  const threads = Math.max(2, os.cpus().length - 2), results = new Array(tasks.length);
  let next = 0, running = 0, done = 0;
  return new Promise((resolve) => {
    const pump = () => {
      if (done === tasks.length) { resolve(results); return; }
      while (running < threads && next < tasks.length) {
        const i = next++; running++;
        const wk = new Worker(__filename, { workerData: { C, task: tasks[i] } });
        let got = false;
        wk.on("message", (m) => { got = true; results[i] = m; });
        wk.on("error", (e) => { console.log("worker error (task " + i + "): " + e.message); });
        wk.on("exit", () => { if (!got) results[i] = { recs: [], fails: { "worker-died": 1 } }; running--; done++; if (onDone) onDone(done, tasks.length); pump(); });
      }
    };
    pump();
  });
}

module.exports = { run };
