# Sapper's Path v5 map: layout guides for SDXL img2img (one tall map, cut into 768x1344 sheets).
# The road is placed here, so node, quest and egg spots are known before any painting.
# Usage: /Users/peter/local-ai/.venv/bin/python guide.py            (all sheets)
# Writes: <out.guides>/sheet-NN.png, <out.guides>/tall-preview.png, ./guide-layout.json
# v5 R4c: sheet-level keys for the top sheet (fogFrom, stopTop, tail: the long tail's own stop after the last level,
# fortress [x, y, r]: the Goblin King's fortress, goblinKing [x, y]; 0 0 = beside the last level, worked out here), new
# realm features (lava, cone, basalt, watch, giant, glade, ring, huts, palisade, fortress) and each river's road crossing.
import json, math, pathlib, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = pathlib.Path(__file__).resolve().parent
GAME = HERE.parent.parent
P = json.load(open(HERE / "plan.json"))
W, H, OV = P["sheet"]["w"], P["sheet"]["h"], P["sheet"]["overlap"]
RX = P["sheet"]["roadX"]
STEP = H - OV                                     # sheet-to-sheet offset in the tall map
SHEETS = [(r, s) for r in P["realms"] for s in r["sheets"]]
N = len(SHEETS); HT = N * H - (N - 1) * OV        # tall map height
GUIDES = pathlib.Path(P["out"]["guides"]); GUIDES.mkdir(parents=True, exist_ok=True)
QUESTS = {g["quest"]["after"]: g for g in json.load(open(GAME / "tools/build-data/levels/gallery.json"))["levels"] if g.get("quest")}

def top(i): return HT - i * STEP - H              # tall-map row of sheet i's top edge (i from 0 at the bottom)
def mix(a, b, t): return tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3))
def ss(t): t = min(1, max(0, t)); return t * t * (3 - 2 * t)
def jitter(c, rnd, d=10): return tuple(max(0, min(255, v + rnd.randint(-d, d))) for v in c)

def lowfreq(h, w, cell, seed):                    # smooth noise in [0,1]
    g = np.random.default_rng(seed).random((h // cell + 2, w // cell + 2)).astype(np.float32)
    im = Image.fromarray((g * 255).astype(np.uint8)).resize((w + 2 * cell, h + 2 * cell), Image.BICUBIC)
    return np.asarray(im, np.float32)[cell:cell + h, cell:cell + w] / 255

def catmull(pts, per=40):                         # dense Catmull-Rom samples through the control points
    out = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(0, i - 1)], pts[i], pts[i + 1], pts[min(len(pts) - 1, i + 2)]
        for k in range(per):
            t = k / per; t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(pts[-1]); return np.array(out, np.float32)

# ---- the road: straight and centred through every seam band, swinging side to side between them
rnd = random.Random(5150)
ctrl = [(RX, HT + 40), (RX, HT)]
for i in range(N):
    t0, a = top(i), top(i) + H                    # sheet rows [t0, a)
    lo = a - (OV if i else 0)                     # bottom of this sheet's own interior
    hi = t0 + OV                                  # top of the interior (below the next seam band)
    ss_ = P["sheet"]["seamStraight"]
    if i: ctrl += [(RX, a - OV - 10), (RX, a - OV - ss_)]
    else: ctrl += [(RX, a - ss_)]
    nb = rnd.randint(*P["road"]["bends"]); side = rnd.choice((-1, 1))
    y0, y1 = (a - OV - ss_) if i else (a - ss_), t0 + OV + ss_
    for b in range(nb):
        y = y0 + (y1 - y0) * (b + 1) / (nb + 1)
        x = RX + side * rnd.randint(*P["road"]["swing"]); side = -side
        ctrl.append((max(110, min(W - 110, x)), y))
    ctrl += [(RX, t0 + OV + ss_), (RX, t0 + OV + 10)]
ctrl += [(RX, -40)]
ROAD = catmull(ctrl)
seg = np.r_[0, np.cumsum(np.hypot(*np.diff(ROAD, axis=0).T))]       # arc length along ROAD

def road_dist(p, skip=None):
    d = np.hypot(ROAD[:, 0] - p[0], ROAD[:, 1] - p[1])
    if skip is not None: d[skip] = 1e9
    return float(d.min())

def at_arc(s):                                    # point and unit tangent at arc length s
    k = int(np.searchsorted(seg, s)); k = max(1, min(len(ROAD) - 1, k))
    t = ROAD[k] - ROAD[k - 1]; t = t / (np.hypot(*t) + 1e-9)
    f = (s - seg[k - 1]) / max(1e-6, seg[k] - seg[k - 1]); p = ROAD[k - 1] + (ROAD[k] - ROAD[k - 1]) * f
    return p, t, k

def arc_at_row(y):                                # arc length where the road crosses row y (road is monotone at seams)
    k = int(np.argmin(np.abs(ROAD[:, 1] - y) + (ROAD[:, 1] > y + 400) * 1e9)); return float(seg[k])

# ---- stops (main levels and quest branch points), spurs to quest clearings
layout = {"tallHeight": HT, "sheets": []}
spurs, clears = [], []
M = P["sheet"]["stopMargin"]
for i, (realm, sh) in enumerate(SHEETS):
    t0 = top(i); a, b = sh["levels"]
    stops = []
    for L in range(a, b + 1):
        stops.append(("level", L))
        if L in QUESTS: stops.append(("quest", L))
    if sh.get("tail"): stops.append(("tail", b))   # v5 R4c: the long tail's node, spaced like any other stop
    ylo = t0 + H - OV - M                         # lowest stop row
    yhi = t0 + OV + M if "fogFrom" not in sh else t0 + int(H * (1 - sh.get("stopTop", 0.45)))
    s0, s1 = arc_at_row(ylo), arc_at_row(yhi)
    rec = {"sheet": i + 1, "realm": realm["realm"], "levels": [], "quests": [], "eggs": []}
    for j, (kind, L) in enumerate(stops):
        p, tan, k = at_arc(s0 + (s1 - s0) * (j + 0.5) / len(stops))
        if kind == "level":
            rec["levels"].append({"n": L, "x": round(float(p[0])), "y": round(float(p[1] - t0))}); continue
        if kind == "tail":
            rec["tail"] = {"x": round(float(p[0])), "y": round(float(p[1] - t0)), "fog": sh.get("tailFog", 0)}; continue
        nrm = np.array([-tan[1], tan[0]]); best = None
        skip = np.abs(seg - seg[k]) < 90
        for sgn in (1, -1):
            e = p + nrm * sgn * P["road"]["spurLen"]
            if not (70 <= e[0] <= W - 70): continue
            sc = road_dist(e, skip)
            if best is None or sc > best[0]: best = (sc, e)
        if best is None: best = (0, p + nrm * (1 if p[0] < RX else -1) * P["road"]["spurLen"])
        e = best[1]; g = QUESTS[L]
        spurs.append((p, e)); clears.append(e)
        rec["quests"].append({"q": g["n"], "id": g["id"], "after": L, "prize": g["quest"]["prize"],
                              "x": round(float(e[0])), "y": round(float(e[1] - t0)),
                              "branch": [round(float(p[0])), round(float(p[1] - t0))]})
    rec["entry"] = [RX, H]; rec["exit"] = [RX, 0]
    sa, sb = arc_at_row(t0 + H), arc_at_row(t0)    # the road's centreline in this sheet, every ~12 px of arc
    rec["road"] = [[round(float(q[0]), 1), round(float(q[1] - t0), 1)] for q in (at_arc(s)[0] for s in np.arange(sa, sb, 12))] + [[RX, 0]]
    layout["sheets"].append(rec)
NODES = [(n["x"], n["y"] + top(r["sheet"] - 1)) for r in layout["sheets"] for n in r["levels"] + r["quests"] + ([r["tail"]] if "tail" in r else [])]
for i, (realm, sh) in enumerate(SHEETS):          # v5 R4c: the summit's fortress and king, beside the last level, away from the road
    if "fortress" not in sh: continue
    rec, t0 = layout["sheets"][i], top(i); L = rec["levels"][-1]; fx, fy, fr = sh["fortress"]
    if not fx:                                    # the biggest clear disc (up to fr) near the last level: off the road, nodes and edges
        best = None
        for cy in range(380, L["y"] + 1, 10):
            for cx in range(120, W - 119, 10):
                r = min(fr, road_dist((cx, t0 + cy)) - 34, cx - 12, W - 12 - cx, min(math.hypot(cx - nx, t0 + cy - ny) for nx, ny in NODES) - 64)
                sc = r - 0.25 * math.hypot(cx - L["x"], cy - L["y"])
                if r >= 0.75 * fr and (best is None or sc > best[0]): best = (sc, cx, cy, r)
        _, fx, fy, fr = best
    sh["fortress"] = [fx, fy, round(fr)]
    kx, ky = sh.get("goblinKing", [0, 0])
    if not kx:                                    # the king between the last level and the fortress gate
        d = math.hypot(fx - L["x"], fy - L["y"]); kx, ky = round(L["x"] + (fx - L["x"]) * 62 / d), round(L["y"] + (fy - L["y"]) * 62 / d)
    sh["goblinKing"] = [kx, ky]

# ---- base colour field (realm palettes blended across realm borders), then features
yy = np.arange(HT, dtype=np.float32)
wts = np.zeros((len(P["realms"]), HT), np.float32)
first = {}
for i, (realm, _) in enumerate(SHEETS): first.setdefault(realm["realm"], i)
bounds = [top(first[r["realm"]] - 1) + OV / 2 for r in P["realms"][1:]]  # realm border rows (seam centres)
for ri in range(len(P["realms"])):
    lo = bounds[ri - 1] if ri else HT + 1e6       # realm ri spans rows (hi, lo]
    hi = bounds[ri] if ri < len(bounds) else -1e6
    B = P["blend"]
    wts[ri] = np.clip((lo - yy) / (2 * B) + 0.5, 0, 1) * np.clip((yy - hi) / (2 * B) + 0.5, 0, 1)
wts /= wts.sum(0, keepdims=True)
n1 = lowfreq(HT, W, 96, 1)[..., None]; n2 = lowfreq(HT, W, 24, 2)[..., None]
img = np.zeros((HT, W, 3), np.float32)
for ri, r in enumerate(P["realms"]):
    c0, c1 = np.array(r["base"][0], np.float32), np.array(r["base"][1], np.float32)
    img += wts[ri][:, None, None] * (c0 + (c1 - c0) * n1)
img *= (0.9 + 0.2 * n2)
im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)); dr = ImageDraw.Draw(im)
realm_of_row = lambda y: P["realms"][int(np.argmax(wts[:, int(min(HT - 1, max(0, y)))]))]

INK = (52, 44, 30)
feats = []
def free(p, r, kind="", road_gap=26):
    if not (0 <= p[0] < W and 0 <= p[1] < HT): return False
    if road_dist(p) < r + road_gap: return False
    if any(math.hypot(p[0] - c[0], p[1] - c[1]) < r + P["road"]["spurClear"] + 24 for c in clears): return False
    if any(math.hypot(p[0] - s[0][0] * 0.5 - s[1][0] * 0.5, p[1] - s[0][1] * 0.5 - s[1][1] * 0.5) < r + 30 for s in spurs): return False
    if kind not in ("marsh", "pond") and any(np.min(np.hypot(f["line"][:, 0] - p[0], f["line"][:, 1] - p[1])) < r * .8 + 30
                                             for f in feats if f["t"] == "river"): return False
    return all(math.hypot(p[0] - f["x"], p[1] - f["y"]) > (r + f["r"]) * 0.75 for f in feats if f["t"] != "river")

def place(kind, r, t0, rnd, tries=300):
    for _ in range(tries):
        p = (rnd.uniform(r * 0.4, W - r * 0.4), rnd.uniform(t0 + 20, t0 + H - 20))
        if free(p, r, kind): f = {"t": kind, "x": p[0], "y": p[1], "r": r}; feats.append(f); return f
    return None

def blob(cx, cy, r, rnd, n=14):
    return [(cx + math.cos(a) * r * rnd.uniform(0.7, 1.15), cy + math.sin(a) * r * rnd.uniform(0.7, 1.15))
            for a in [k * 2 * math.pi / n for k in range(n)]]

RIVER = {"river": [(84, 70, 48), (70, 140, 132), (96, 162, 150)], "lava": [(52, 40, 34), (198, 86, 36), (244, 164, 66)]}
def river(t0, rnd, width, kind="river"):
    for _ in range(80):                           # a bank-to-bank river (or lava); keeps clear of nodes
        ya, yb = rnd.uniform(t0 + 250, t0 + H - 250), rnd.uniform(t0 + 250, t0 + H - 250)
        pts = [(-60, ya), (W * 0.3, ya + rnd.uniform(-180, 180)), (W * 0.7, yb + rnd.uniform(-180, 180)), (W + 60, yb)]
        line = catmull(pts, 30)
        if min(math.hypot(x - nx, y - ny) for x, y in line[::3] for nx, ny in NODES) < 70: continue
        if min(math.hypot(x - c[0], y - c[1]) for x, y in line[::3] for c in clears) < 80: continue
        c = RIVER[kind]
        dr.line([tuple(p) for p in line], fill=c[0], width=width + 10, joint="curve")
        dr.line([tuple(p) for p in line], fill=c[1], width=width, joint="curve")
        dr.line([tuple(p) for p in line], fill=c[2], width=max(4, width // 3), joint="curve")
        feats.append({"t": "river", "kind": kind, "x": float(line[len(line) // 2][0]), "y": float(line[len(line) // 2][1]), "r": 0, "line": line})
        return

DRAW = {}
def draw(kind):
    def deco(fn): DRAW[kind] = fn; return fn
    return deco

@draw("forest")
def _(f, rnd):
    for _ in range(int(f["r"] * f["r"] / 26)):
        a, d = rnd.uniform(0, 6.283), f["r"] * math.sqrt(rnd.random())
        x, y = f["x"] + math.cos(a) * d, f["y"] + math.sin(a) * d * 0.8
        if road_dist((x, y)) < 26: continue
        tree(x, y, rnd.randint(6, 10), rnd)
def tree(x, y, s, rnd, c=(62, 88, 46)):
    dr.line([(x, y + s * .4), (x, y + s * 1.3)], fill=INK, width=2)
    dr.ellipse([x - s, y - s, x + s, y + s * .8], fill=jitter(c, rnd, 12), outline=INK, width=2)
    dr.arc([x - s * .6, y - s * .6, x + s * .3, y + s * .2], 190, 300, fill=(40, 52, 30), width=1)
@draw("pines")
def _(f, rnd):
    for _ in range(int(f["r"] * f["r"] / 30)):
        a, d = rnd.uniform(0, 6.283), f["r"] * math.sqrt(rnd.random())
        x, y = f["x"] + math.cos(a) * d, f["y"] + math.sin(a) * d * 0.8
        if road_dist((x, y)) < 26: continue
        pine(x, y, rnd.randint(6, 10), rnd)
def pine(x, y, s, rnd):
    dr.polygon([(x, y - s * 1.6), (x - s * .8, y + s * .6), (x + s * .8, y + s * .6)], fill=jitter((46, 66, 44), rnd, 8), outline=INK)
@draw("deadtrees")
def _(f, rnd):
    for _ in range(int(f["r"] / 9)):
        x, y = f["x"] + rnd.uniform(-f["r"], f["r"]), f["y"] + rnd.uniform(-f["r"], f["r"]) * .7
        if road_dist((x, y)) < 30: continue
        dr.line([(x, y), (x, y - 26)], fill=INK, width=3)
        for k in (-1, 1): dr.line([(x, y - 14), (x + k * 10, y - 26)], fill=INK, width=2)
@draw("farm")
def _(f, rnd):
    ang = rnd.uniform(-0.5, 0.5); ca, sa = math.cos(ang), math.sin(ang); w = f["r"] * 0.65
    for gx in (-1, 0):
        for gy in (-1, 0):
            c = rnd.choice([(176, 160, 92), (150, 156, 80), (190, 170, 104), (128, 142, 70)])
            q = [(gx * w, gy * w), ((gx + 1) * w, gy * w), ((gx + 1) * w, (gy + 1) * w), (gx * w, (gy + 1) * w)]
            dr.polygon([(f["x"] + u * ca - v * sa, f["y"] + u * sa + v * ca) for u, v in q], fill=c, outline=(96, 80, 50))
            for k in range(1, 7):                 # furrows
                u0, u1, v = gx * w + 3, (gx + 1) * w - 3, gy * w + k * w / 7
                dr.line([(f["x"] + u0 * ca - v * sa, f["y"] + u0 * sa + v * ca), (f["x"] + u1 * ca - v * sa, f["y"] + u1 * sa + v * ca)],
                        fill=(110, 96, 60), width=1)
    dr.rectangle([f["x"] + w * .9, f["y"] - 10, f["x"] + w * .9 + 26, f["y"] + 8], fill=(124, 96, 62), outline=INK, width=2)
@draw("stockade")
def _(f, rnd):
    r = f["r"] * 0.8
    dr.ellipse([f["x"] - r, f["y"] - r, f["x"] + r, f["y"] + r], fill=(150, 128, 86), outline=(96, 70, 40), width=7)
    for k in range(28):                           # palisade posts
        a = k * 6.283 / 28; x, y = f["x"] + math.cos(a) * r, f["y"] + math.sin(a) * r
        dr.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(84, 60, 36), outline=INK)
    dr.rectangle([f["x"] - 16, f["y"] - 12, f["x"] + 18, f["y"] + 10], fill=(118, 90, 58), outline=INK, width=2)
@draw("motte")
def _(f, rnd):
    r = f["r"] * 0.8
    dr.ellipse([f["x"] - r, f["y"] - r, f["x"] + r, f["y"] + r], fill=(70, 140, 132), outline=(84, 70, 48), width=3)
    dr.ellipse([f["x"] - r * .7, f["y"] - r * .7, f["x"] + r * .7, f["y"] + r * .7], fill=(120, 132, 76), outline=INK, width=2)
    dr.rectangle([f["x"] - 9, f["y"] - 12, f["x"] + 9, f["y"] + 8], fill=(118, 90, 58), outline=INK, width=2)
@draw("marsh")
def _(f, rnd):
    dr.polygon(blob(f["x"], f["y"], f["r"], rnd), fill=(118, 128, 78))
    for _ in range(int(f["r"] / 5)):
        x, y = f["x"] + rnd.uniform(-f["r"], f["r"]) * .8, f["y"] + rnd.uniform(-f["r"], f["r"]) * .7
        if rnd.random() < .45: dr.ellipse([x - 12, y - 6, x + 12, y + 6], fill=(80, 136, 128), outline=(70, 70, 50))
        else: dr.line([(x, y), (x + rnd.uniform(-3, 3), y - 9)], fill=(60, 70, 40), width=2)
@draw("pond")
def _(f, rnd):
    dr.polygon(blob(f["x"], f["y"], f["r"] * .7, rnd), fill=(76, 138, 128), outline=(84, 70, 48))
@draw("hills")
def _(f, rnd):
    for k in range(3):
        x, y, r = f["x"] + rnd.uniform(-.4, .4) * f["r"], f["y"] + rnd.uniform(-.3, .3) * f["r"], f["r"] * rnd.uniform(.5, .8)
        dr.ellipse([x - r, y - r * .6, x + r, y + r * .6], fill=jitter((150, 148, 136), rnd, 10), outline=INK, width=2)
        dr.chord([x - r, y - r * .6, x + r, y + r * .6], 10, 170, fill=jitter((112, 110, 104), rnd, 8))
@draw("crag")
def _(f, rnd):
    pts = blob(f["x"], f["y"], f["r"] * .8, rnd, 9)
    dr.polygon(pts, fill=(96, 92, 88), outline=INK, width=2)
    for _ in range(3):
        x, y = f["x"] + rnd.uniform(-.5, .5) * f["r"], f["y"] + rnd.uniform(-.5, .5) * f["r"]
        dr.line([(x, y), (x + rnd.uniform(-20, 20), y + rnd.uniform(8, 22))], fill=(150, 70, 44), width=3)
@draw("keep")
def _(f, rnd):
    s = f["r"] * .45
    dr.rectangle([f["x"] - s, f["y"] - s, f["x"] + s, f["y"] + s], fill=(164, 160, 150), outline=INK, width=3)
    dr.rectangle([f["x"] - s * .45, f["y"] - s * .45, f["x"] + s * .45, f["y"] + s * .45], fill=(120, 116, 110), outline=INK, width=2)
@draw("hold")
def _(f, rnd):
    r = f["r"] * .7
    dr.ellipse([f["x"] - r, f["y"] - r, f["x"] + r, f["y"] + r], fill=(150, 146, 120), outline=(110, 108, 104), width=9)
    for k in (-1, 1):
        x = f["x"] + k * r * .35
        dr.ellipse([x - 11, f["y"] - 11, x + 11, f["y"] + 11], fill=(170, 166, 156), outline=INK, width=3)

# v5 R4c: the new realms' features (Emberwatch Crags, the Shrouded Weald, the Goblin King's Throne)
@draw("cone")
def _(f, rnd):                                    # a cinder cone: ash slopes, a glowing crater, lava runs
    r = f["r"]
    dr.polygon(blob(f["x"], f["y"], r, rnd, 11), fill=jitter((84, 74, 68), rnd, 6), outline=INK)
    dr.ellipse([f["x"] - r * .38, f["y"] - r * .3, f["x"] + r * .38, f["y"] + r * .3], fill=(206, 92, 38), outline=(40, 30, 26), width=3)
    dr.ellipse([f["x"] - r * .18, f["y"] - r * .13, f["x"] + r * .18, f["y"] + r * .13], fill=(246, 176, 72))
    for _ in range(3):
        a = rnd.uniform(0, 6.283); dr.line([(f["x"] + math.cos(a) * r * .38, f["y"] + math.sin(a) * r * .3), (f["x"] + math.cos(a) * r * .9, f["y"] + math.sin(a) * r * .8)], fill=(200, 84, 34), width=4)
@draw("basalt")
def _(f, rnd):                                    # a field of basalt columns: dark hexagons
    for _ in range(int(f["r"] * f["r"] / 90)):
        a, d = rnd.uniform(0, 6.283), f["r"] * math.sqrt(rnd.random()); x, y, s = f["x"] + math.cos(a) * d, f["y"] + math.sin(a) * d * .8, rnd.uniform(7, 11)
        if road_dist((x, y)) < 26: continue
        dr.polygon([(x + s * math.cos(k * 1.047), y + s * math.sin(k * 1.047)) for k in range(6)], fill=jitter((70, 66, 64), rnd, 8), outline=INK)
@draw("watch")
def _(f, rnd):                                    # a dark stone watchtower with an ember-lit top
    s = f["r"] * .4
    dr.ellipse([f["x"] - s, f["y"] - s, f["x"] + s, f["y"] + s], fill=(92, 86, 82), outline=INK, width=3)
    dr.ellipse([f["x"] - s * .5, f["y"] - s * .5, f["x"] + s * .5, f["y"] + s * .5], fill=(214, 120, 52), outline=INK, width=2)
@draw("giant")
def _(f, rnd):                                    # giant trees: big round canopies with inked swirls
    for _ in range(max(1, int(f["r"] / 26))):
        a, d = rnd.uniform(0, 6.283), f["r"] * .6 * math.sqrt(rnd.random()); x, y, s = f["x"] + math.cos(a) * d, f["y"] + math.sin(a) * d * .8, rnd.uniform(24, 38)
        if road_dist((x, y)) < s + 18: continue
        dr.ellipse([x - s + 4, y - s + 8, x + s + 4, y + s + 8], fill=(36, 54, 46))
        dr.ellipse([x - s, y - s, x + s, y + s], fill=jitter((52, 84, 62), rnd, 10), outline=INK, width=3)
        for k in range(3): dr.arc([x - s * (.75 - k * .2), y - s * (.75 - k * .2), x + s * (.6 - k * .2), y + s * (.5 - k * .2)], 200, 320, fill=(34, 52, 40), width=2)
@draw("glade")
def _(f, rnd):                                    # a moonlit glade: pale silver-green grass, ringed with ink stones
    dr.polygon(blob(f["x"], f["y"], f["r"] * .8, rnd), fill=(150, 176, 150), outline=(70, 90, 70))
    for k in range(10):
        a = k * .628; x, y = f["x"] + math.cos(a) * f["r"] * .8, f["y"] + math.sin(a) * f["r"] * .8
        dr.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(196, 206, 196), outline=INK)
@draw("ring")
def _(f, rnd):                                    # a ring of glowing blue mushrooms
    r = f["r"] * .6
    dr.ellipse([f["x"] - r * 1.3, f["y"] - r * 1.3, f["x"] + r * 1.3, f["y"] + r * 1.3], fill=(70, 120, 120))
    for k in range(12):
        a = k * .5236; x, y = f["x"] + math.cos(a) * r, f["y"] + math.sin(a) * r
        dr.ellipse([x - 6, y - 4, x + 6, y + 4], fill=(120, 214, 230), outline=INK)
@draw("huts")
def _(f, rnd):                                    # a goblin village: crooked round huts with spiky roofs, a cook fire
    for _ in range(int(f["r"] / 9)):
        a, d = rnd.uniform(0, 6.283), f["r"] * .85 * math.sqrt(rnd.random()); x, y, s = f["x"] + math.cos(a) * d, f["y"] + math.sin(a) * d * .8, rnd.uniform(12, 18)
        if road_dist((x, y)) < s + 20: continue
        dr.ellipse([x - s, y - s * .9, x + s, y + s * .9], fill=jitter((128, 96, 60), rnd, 10), outline=INK, width=2)
        for k in range(6): b = k * 1.047 + rnd.uniform(-.2, .2); dr.line([(x, y), (x + math.cos(b) * s * 1.25, y + math.sin(b) * s * 1.15)], fill=(70, 52, 34), width=2)
    dr.ellipse([f["x"] - 7, f["y"] - 7, f["x"] + 7, f["y"] + 7], fill=(226, 120, 44), outline=INK, width=2)
@draw("palisade")
def _(f, rnd):                                    # a spiked palisade ring with stakes pointing out
    r = f["r"] * .8
    dr.ellipse([f["x"] - r, f["y"] - r, f["x"] + r, f["y"] + r], fill=(140, 116, 80), outline=(80, 58, 36), width=6)
    for k in range(24):
        a = k * 6.283 / 24; x, y = f["x"] + math.cos(a) * r, f["y"] + math.sin(a) * r
        dr.line([(x, y), (x + math.cos(a) * 12, y + math.sin(a) * 12)], fill=INK, width=3)
    dr.ellipse([f["x"] - 13, f["y"] - 11, f["x"] + 13, f["y"] + 11], fill=(118, 88, 56), outline=INK, width=2)
def fortress(x, y, r, rnd):                       # the Goblin King's crooked fortress: dark walls, leaning towers, spikes
    pts = blob(x, y, r, rnd, 9)
    dr.polygon(pts, fill=(78, 70, 66), outline=INK, width=5)
    dr.polygon(blob(x, y, r * .82, rnd, 9), fill=(112, 98, 84), outline=(50, 42, 38), width=3)
    for (px, py) in pts[::2]:
        s = rnd.uniform(16, 22); dr.ellipse([px - s, py - s, px + s, py + s], fill=(84, 76, 72), outline=INK, width=3)
        for k in range(7): b = k * .898; dr.line([(px + math.cos(b) * s, py + math.sin(b) * s), (px + math.cos(b) * (s + 9), py + math.sin(b) * (s + 9))], fill=INK, width=2)
    k_ = r * .32; dr.polygon([(x - k_, y - k_ * .8), (x + k_ * .9, y - k_), (x + k_, y + k_ * .9), (x - k_ * .8, y + k_)], fill=(64, 58, 56), outline=INK, width=4)
    dr.ellipse([x - k_ * .45, y - k_ * .45, x + k_ * .45, y + k_ * .45], fill=(150, 40, 30), outline=INK, width=2)

SIZES = {"forest": (70, 120), "pines": (60, 110), "deadtrees": (40, 70), "farm": (60, 80), "stockade": (40, 50),
         "motte": (44, 54), "marsh": (70, 120), "pond": (36, 60), "hills": (80, 130), "crag": (45, 75),
         "keep": (40, 50), "hold": (52, 62), "cone": (55, 75), "basalt": (60, 90), "watch": (40, 48), "giant": (80, 130),
         "glade": (50, 70), "ring": (34, 44), "huts": (60, 85), "palisade": (44, 54)}
ORDER = ["marsh", "pond", "farm", "glade", "hills", "crag", "cone", "basalt", "forest", "pines", "giant", "deadtrees", "stockade", "motte",
         "keep", "hold", "watch", "ring", "huts", "palisade"]
for i, (realm, sh) in enumerate(SHEETS):
    t0, frnd = top(i), random.Random(1000 + i)
    if "fortress" in sh:                          # v5 R4c: the fortress first, so nothing else lands on it
        fx, fy, fr = sh["fortress"]; fortress(fx, t0 + fy, fr, frnd); feats.append({"t": "fortress", "x": fx, "y": t0 + fy, "r": fr, "sheet": i})
    for _ in range(realm["features"].get("river", 0)): river(t0, frnd, frnd.randint(32, 44))
    for _ in range(realm["features"].get("lava", 0)): river(t0, frnd, frnd.randint(28, 38), "lava")
    for kind in ORDER:
        for _ in range(realm["features"].get(kind, 0)):
            f = place(kind, frnd.randint(*SIZES[kind]), t0, frnd)
            if f: f["sheet"] = i; DRAW[kind](f, frnd)
    sc = realm.get("scatter", P["scatter"])        # lone trees and ink grass tufts in the open
    for _ in range(sc["trees"]):
        p = (frnd.uniform(10, W - 10), frnd.uniform(t0, t0 + H))
        if free(p, 8, "tree", 18): (tree if sc.get("tree", "tree") == "tree" else pine)(p[0], p[1], frnd.randint(6, 9), frnd)
    for _ in range(sc["tufts"]):
        p = (frnd.uniform(0, W), frnd.uniform(t0, t0 + H))
        if road_dist(p) > 24:
            x, y = p
            for k in (-1, 0, 1): dr.line([(x + k * 2, y), (x + k * 3.5, y - 5 - (k == 0) * 2)], fill=(70, 70, 40), width=1)

# ---- the Mistmoor fog: a fade to pale mist toward the top of its sheet (fog alpha kept to thin the road too)
arr = np.asarray(im, np.float32); fog = np.zeros((HT, W, 1), np.float32)
for i, (realm, sh) in enumerate(SHEETS):
    if "fogFrom" not in sh: continue
    t0 = top(i); fy = t0 + int(H * (1 - sh["fogFrom"]))
    a = np.clip((fy - yy) / (fy - t0), 0, 1)[:, None] ** 0.8
    fog = np.maximum(fog, np.clip(a[:, :, None] * (0.75 + 0.5 * lowfreq(HT, W, 64, 9)[..., None]), 0, 0.96))
arr = arr * (1 - fog) + np.array([226, 224, 214], np.float32) * fog
arr *= (0.94 + 0.12 * lowfreq(HT, W, 4, 3)[..., None])                       # paper grain
base = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))

# ---- the road layer (RGBA, laid over a painted base for the second pass): ink edges, pale dirt, spurs, clearings
R = P["road"]; rw, ew, RC = R["width"], R["edge"], [tuple(c) for c in R["colors"]]   # edge, dirt, centre
road = Image.new("RGBA", (W, HT), (0, 0, 0, 0)); rd = ImageDraw.Draw(road)
pts = [tuple(p) for p in ROAD]
for (p, e) in spurs: rd.line([tuple(p), tuple(e)], fill=RC[0] + (255,), width=R["spurWidth"] + 2 * ew)
for c in clears:
    r = R["spurClear"]; rd.ellipse([c[0] - r - ew, c[1] - r - ew, c[0] + r + ew, c[1] + r + ew], fill=RC[0] + (255,))
rd.line(pts, fill=RC[0] + (255,), width=rw + 2 * ew, joint="curve")
for (p, e) in spurs: rd.line([tuple(p), tuple(e)], fill=RC[1] + (255,), width=R["spurWidth"])
for c in clears:
    r = R["spurClear"]; rd.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=RC[1] + (255,))
rd.line(pts, fill=RC[1] + (255,), width=rw, joint="curve")
rd.line(pts, fill=RC[2] + (255,), width=rw // 3, joint="curve")
ra = np.asarray(road, np.float32)
ra[..., :3] *= (0.9 + 0.2 * lowfreq(HT, W, 3, 4)[..., None])                 # dirt grain
ra[..., 3:] *= (1 - fog * R["fogThin"])
road = Image.fromarray(np.clip(ra, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
im = base.copy(); im.alpha_composite(road) if im.mode == "RGBA" else im.paste(road, (0, 0), road)

# ---- eggs: two per sheet on plausible features, off the road and outside the seam bands
HOST = {"woodpile": ["forest", "pines"], "mushrooms": ["forest", "pines"], "fish": ["river", "pond"], "reeds": ["marsh"],
        "raven": ["hills", "crag", "deadtrees"], "glint": ["crag", "hills"], "wisp": ["pond", "marsh", "deadtrees", "glade"], "grass": [],
        "bubble": ["river"], "ember": ["cone", "basalt", "crag"], "glowcap": ["giant", "ring"], "owl": ["giant"], "lookout": ["huts", "palisade", "hills"]}
def egg_spot(kind, i, rnd):
    t0 = top(i); lo, hi = t0 + OV + 40, t0 + H - OV - 40
    ok = lambda p: lo <= p[1] <= hi and 40 <= p[0] <= W - 40 and road_dist(p) > 46 and \
        all(math.hypot(p[0] - nx, p[1] - ny) > 70 for nx, ny in NODES)
    for f in [f for f in feats if f["t"] in HOST[kind] and f.get("sheet", -1) == i or (f["t"] == "river" and "river" in HOST[kind] and t0 <= f["y"] <= t0 + H
              and (f.get("kind") == "lava") == (kind == "bubble"))]:
        cands = [tuple(p) for p in f["line"][::4]] if f["t"] == "river" else \
            [(f["x"] + math.cos(a) * f["r"] * (0 if kind in ("fish", "reeds", "glint", "wisp", "ember") else 1.05),
              f["y"] + math.sin(a) * f["r"] * (0 if kind in ("fish", "reeds", "glint", "wisp", "ember") else .85)) for a in np.linspace(0, 6.28, 16)]
        rnd.shuffle(cands)
        for p in cands:
            if ok(p): return p
    for _ in range(400):                          # open meadow
        p = (rnd.uniform(60, W - 60), rnd.uniform(lo, hi))
        if ok(p) and all(math.hypot(p[0] - f["x"], p[1] - f["y"]) > f["r"] + 20 for f in feats if f["t"] != "river"): return p
    return None
for i, (realm, sh) in enumerate(SHEETS):
    rec, ernd = layout["sheets"][i], random.Random(77 + i); ks = realm["eggs"]; j = realm["sheets"].index(sh)
    for kind in (ks[j % len(ks)], ks[(j + 1) % len(ks)]):
        p = egg_spot(kind, i, ernd)
        if p is None: kind, p = "grass", egg_spot("grass", i, ernd)
        rec["eggs"].append({"kind": kind, "x": round(p[0]), "y": round(p[1] - top(i))})
    if "goblinKing" in sh: rec["goblinKing"] = sh["goblinKing"]
    if "fortress" in sh: rec["fortress"] = sh["fortress"]
    rec["crossings"], t0 = [], top(i)             # v5 R4c: where each river or lava flow crosses the road (bridge hints)
    for f in feats:
        if f["t"] != "river": continue
        for p in f["line"][::2]:
            if t0 + OV < p[1] < t0 + H - OV and road_dist(p) < 14 and all(math.hypot(p[0] - c[0], p[1] - t0 - c[1]) > 60 for c in rec["crossings"]):
                rec["crossings"].append([round(float(p[0])), round(float(p[1] - t0)), f.get("kind", "river")])

for i in range(N):                                # base (pass 1), road layer (pass 2), both (one-pass guide)
    box = (0, top(i), W, top(i) + H)
    base.crop(box).save(GUIDES / f"base-{i + 1:02d}.png"); road.crop(box).save(GUIDES / f"road-{i + 1:02d}.png")
    im.crop(box).save(GUIDES / f"sheet-{i + 1:02d}.png")
im.resize((W // 4, HT // 4)).save(GUIDES / "tall-preview.png")
json.dump(layout, open(HERE / "guide-layout.json", "w"), indent=1)
print(f"{N} guides, tall {W}x{HT}, road ctrl {len(ctrl)}, feats {len(feats)} -> {GUIDES}")
