// Quick Fox — US QWERTY keyboard model + DOM renderer. Finger map drives colors and hints.
(function () {
  const QF = (window.QF = window.QF || {});
  const F = {
    "`": "Lp", "1": "Lp", "2": "Lr", "3": "Lm", "4": "Li", "5": "Li", "6": "Ri", "7": "Ri", "8": "Rm", "9": "Rr", "0": "Rp", "-": "Rp", "=": "Rp",
    "q": "Lp", "w": "Lr", "e": "Lm", "r": "Li", "t": "Li", "y": "Ri", "u": "Ri", "i": "Rm", "o": "Rr", "p": "Rp", "[": "Rp", "]": "Rp", "\\": "Rp",
    "a": "Lp", "s": "Lr", "d": "Lm", "f": "Li", "g": "Li", "h": "Ri", "j": "Ri", "k": "Rm", "l": "Rr", ";": "Rp", "'": "Rp",
    "z": "Lp", "x": "Lr", "c": "Lm", "v": "Li", "b": "Li", "n": "Ri", "m": "Ri", ",": "Rm", ".": "Rr", "/": "Rp", " ": "T"
  };
  const SHIFTED = { "~": "`", "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0", "_": "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", "\"": "'", "<": ",", ">": ".", "?": "/" };
  const ROWS = [
    [["`", "~"], ["1", "!"], ["2", "@"], ["3", "#"], ["4", "$"], ["5", "%"], ["6", "^"], ["7", "&"], ["8", "*"], ["9", "("], ["0", ")"], ["-", "_"], ["=", "+"], ["Backspace", "⌫", 2]],
    [["Tab", "⇥", 1.5], ["q"], ["w"], ["e"], ["r"], ["t"], ["y"], ["u"], ["i"], ["o"], ["p"], ["[", "{"], ["]", "}"], ["\\", "|", 1.5]],
    [["CapsLock", "caps", 1.8], ["a"], ["s"], ["d"], ["f"], ["g"], ["h"], ["j"], ["k"], ["l"], [";", ":"], ["'", "\""], ["Enter", "⏎", 2.2]],
    [["ShiftLeft", "⇧", 2.4], ["z"], ["x"], ["c"], ["v"], ["b"], ["n"], ["m"], [",", "<"], [".", ">"], ["/", "?"], ["ShiftRight", "⇧", 2.6]],
    [["Space", "", 7]]
  ];
  function decompose(ch) {
    if (ch === " ") return { base: " ", shift: false };
    if (SHIFTED[ch]) return { base: SHIFTED[ch], shift: true };
    const lower = ch.toLowerCase();
    if (lower !== ch) return { base: lower, shift: true };
    return { base: ch, shift: false };
  }
  function finger(ch) { const d = decompose(ch); return F[d.base] || "Ri"; }
  function shiftSide(ch) { const f = finger(ch); return f[0] === "L" ? "ShiftRight" : "ShiftLeft"; } // opposite hand holds Shift

  let root = null, keyEls = {}, colors = {}, dimmed = false;
  function render(container, fingerColors) {
    root = container; colors = fingerColors; keyEls = {}; root.innerHTML = "";
    for (const row of ROWS) {
      const r = document.createElement("div"); r.className = "kb-row";
      for (const def of row) {
        const [base, alt, w] = def;
        const el = document.createElement("div"); el.className = "key";
        el.style.flex = (w || 1) + " 0 0";
        const isCtl = base.length > 1;
        const fcode = isCtl ? (base === "Space" ? "T" : (base === "ShiftLeft" || base === "Tab" || base === "CapsLock") ? "Lp" : "Rp") : F[base];
        el.dataset.key = base; el.dataset.finger = fcode;
        el.style.setProperty("--fc", colors[fcode] || "#888");
        if (isCtl) { el.classList.add("ctl"); el.innerHTML = "<span class='cap'>" + (alt || "") + "</span>"; }
        else el.innerHTML = (alt ? "<span class='alt'>" + alt + "</span>" : "") + "<span class='cap'>" + base.toUpperCase() + "</span>";
        if (base === "f" || base === "j") el.classList.add("bump");
        keyEls[base] = el; r.appendChild(el);
      }
      root.appendChild(r);
    }
    keyEls[" "] = keyEls["Space"]; // typed character is " ", the element is registered as "Space"
    root.classList.toggle("dim", dimmed);
  }
  function clearHighlights() { for (const k in keyEls) keyEls[k].classList.remove("next", "shift-next"); }
  function highlight(ch) {
    clearHighlights();
    if (ch == null) return;
    const d = decompose(ch);
    const el = keyEls[d.base]; if (el) el.classList.add("next");
    if (d.shift) { const s = keyEls[shiftSide(ch)]; if (s) s.classList.add("shift-next"); }
  }
  function flashError(ch) {
    const d = decompose(ch); const el = keyEls[d.base]; if (!el) return;
    el.classList.add("err"); setTimeout(() => el.classList.remove("err"), 260);
  }
  function flashHit(ch) {
    const d = decompose(ch); const el = keyEls[d.base]; if (!el) return;
    el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit");
  }
  function showHeat(errorMap) {
    let max = 0; for (const k in errorMap) max = Math.max(max, errorMap[k]);
    for (const k in keyEls) { const n = errorMap[k] || 0; keyEls[k].style.setProperty("--heat", max ? (n / max).toFixed(2) : 0); keyEls[k].classList.toggle("heat", n > 0); }
  }
  function dim(on) { dimmed = !!on; if (root) root.classList.toggle("dim", dimmed); }
  QF.KB = { F, SHIFTED, ROWS, decompose, finger, shiftSide, render, highlight, clearHighlights, flashError, flashHit, showHeat, dim, isDim: () => dimmed };
})();
