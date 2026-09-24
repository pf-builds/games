// Peasant Swarm — the palette (SPEC-v2 §11). Click it! Studios, 2026.
// One PAL object: hue-shifted ramps, dark to light (shadows lean blue, highlights lean yellow). Terrain colours stay at or under 45% HSL
// saturation so the six team colours (the config's, repeated here) own the saturated end. Every sprite and every ground chunk reads its
// colours from here; nothing else in src/ names a terrain or peasant colour. Helpers: rgb(), sat() (HSL saturation), shade() (a
// hue-shifted step darker or lighter), mix(), ramp() (a team's hat ramp from its base colour).
(function () {
  const PS = (window.PS = window.PS || {});
  const rgb = (h) => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hex = (r, g, b) => "#" + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1).toUpperCase();
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  function hsl(h) {
    const [R, G, B] = rgb(h), r = R / 255, g = G / 255, b = B / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let hh = 0; if (d) { if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; } hh *= 60; if (hh < 0) hh += 360;
    return [hh, d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l];
  }
  function fromHsl(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2; let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }
  // k steps darker (k < 0: lighter): lightness moves 0.11 a step, hue leans toward blue (240) going dark and toward yellow (55) going light
  function shade(h, k) {
    let [H, Sa, L] = hsl(h); const toward = k > 0 ? 240 : 55, dh = ((toward - H + 540) % 360) - 180, step = Math.min(Math.abs(dh), 14 * Math.abs(k));
    H = (H + Math.sign(dh) * step + 360) % 360; L = cl(L - 0.11 * k, 0.04, 0.96); Sa = cl(Sa * (k > 0 ? 1.04 : 0.96), 0, 1);
    return fromHsl(H, Sa, L);
  }
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };

  const PAL = {
    ink: "#1C1418", inkSoft: "#2A2230", cream: "#F1EEDF", shadow: "rgba(22,16,30,0.32)",
    // ground: meadow grass, rocky olive-grey, highland, the plateau top, stone (cliff faces, the high rim's top), earth
    // (trails, canyon floors, camp dirt), water deep -> shallow + foam, ford sand, wood (bridges, trunks, poles)
    grass: ["#2B5236", "#3A6E3C", "#4F8442", "#6A9A4A", "#8AB05A"],
    rocky: ["#3E4634", "#535D42", "#6C7552", "#878E66"],
    high: ["#4F6B38", "#6A8746", "#86A055", "#A3B86A"],
    plateau: ["#5A5848", "#747058", "#8F896C", "#ABA384"], // the lower plateau top: khaki stone, never a walkable green
    stone: ["#34313D", "#524E57", "#736D71", "#98908A", "#C2B8A6"],
    earth: ["#4E3A2E", "#6E523A", "#8E6E4C", "#AE8E64"],
    water: ["#24485A", "#2E6674", "#3E8488"], foam: "#D9EDE4",
    sand: ["#9C8A5E", "#B8A676"],
    wood: ["#3E2A1C", "#5C4428", "#855E34", "#A7804C"],
    leaf: ["#1F3E2A", "#2C5934", "#3E763C", "#5C9444"], pine: ["#1B3530", "#264A3A", "#356146"],
    flower: ["#E8D9A8", "#D8A0B0", "#C9C2E0"], fire: ["#C8501E", "#E8902E", "#F6CF6A"],
    // fog (SPEC-v2 §5): unexplored blue-slate, explored desaturated grey, the cloud drift tint. config.fog colours repeat the first two.
    fog: { unex: "#141C2A", exp: "#2B313C", cloud: "#5C6A84" },
    // the minimap's parchment (the map metaphor lives there only, R7): grass, low rock, high rock, water, ford, bridge, props, unexplored
    parch: { grass: "#D6C496", rock: "#9A8468", high: "#786450", water: "#7896A6", ford: "#C6B278", bridge: "#8E683C", prop: "#A08A60", unex: "#18202C", camp: "#6E4F30" },
    // people: skin, hair, legs, boots, the pitchfork; six team colours (player mint first, then the rivals in config order); undyed
    // neutrals with a straw hat; bandits (M6) grey with a kerchief
    skin: ["#C99A5B", "#F1C27D"], hair: "#3E2A20", leg: "#4A3728", boot: "#2B1D12", shaft: "#9C7A46", tine: ["#8C8C96", "#D8D8D8"],
    teams: ["#1FD1A3", "#E8701A", "#2F7BD8", "#F2D23C", "#C8323C", "#9A62E0"],
    neutral: ["#6E6250", "#9A8C70", "#B8A88A"], straw: ["#9C8448", "#C8AE62", "#E2CC84"], bandit: ["#3A3A40", "#56565E", "#76767E"],
    rgb, hex, hsl, sat: (h) => hsl(h)[1], shade, mix,
  };
  // a team's hat ramp [shade, base, light] and its muted tunic [shade, base] (tunic: the team colour pulled halfway to undyed cloth)
  PAL.ramp = (c) => ({ hatD: shade(c, 1.4), hat: String(c).toUpperCase(), hatL: shade(c, -0.9), tun: mix(c, "#6E6456", 0.5), tunD: shade(mix(c, "#6E6456", 0.5), 1.1) });
  PS.PAL = PAL;
})();
