# Sapper's Path v5 map: picked paintings -> game sheets, layout and contact sheets.
# Usage: /Users/peter/local-ai/.venv/bin/python assemble.py      (reads picks.json, guide-layout.json, plan.json)
# Writes: ../../map/sheet-NN.jpg, ../../map/layout.json, ./contact.png, ./contact-seams.png, ./fidelity.json
#  1. edge restore: the coded road is laid back over the painting in the top and bottom bands, so the road meets
#     every seam at the centre (the painting can drift a few px there)
#  2. seam crossfade baked into each sheet's bottom `overlap` rows (draw later sheets over earlier ones: no mask needed)
#  3. nodes and the road centreline nudged onto the painted road; eggs found by colour on painted features
import json, math, pathlib, random, io
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

HERE = pathlib.Path(__file__).resolve().parent; GAME = HERE.parent.parent
P = json.load(open(HERE / "plan.json")); GL = json.load(open(HERE / "guide-layout.json")); PICK = json.load(open(HERE / "picks.json"))
A = P["assemble"]; W, H, OV = P["sheet"]["w"], P["sheet"]["h"], P["sheet"]["overlap"]; STEP = H - OV
G, C = pathlib.Path(P["out"]["guides"]), pathlib.Path(P["out"]["candidates"])
MAP = GAME / "map"; MAP.mkdir(exist_ok=True)
N = len(GL["sheets"]); REALMS = {r["realm"]: r for r in P["realms"]}
def ss(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
f32 = lambda im: np.asarray(im.convert("RGB"), np.float32)

# ---- 1. edge restore, 3a. painted-road fidelity
sheets, fid = [], {}
for i in range(N):
    pk = PICK[str(i + 1)]
    src = Image.open(C / pk["sheet"]).convert("RGB")
    for box in P["retouch"].get(str(i + 1), []): src.paste(src.crop(box).filter(ImageFilter.GaussianBlur(6)), box[:2])
    E = P["edgeMirror"].get(str(i + 1), 0)
    if E:
        a = np.asarray(src).copy(); a[:, :E] = a[:, 2 * E - 1:E - 1:-1]; a[:, W - E:] = a[:, W - E - 1:W - 2 * E - 1:-1]
        src = Image.fromarray(a)
    paint = f32(src)
    comp = src.convert("RGBA"); comp.alpha_composite(Image.open(G / f"road-{i + 1:02d}.png").convert("RGBA"))
    comp = f32(comp)                              # the painting with the coded road laid back on top
    d = np.minimum(np.arange(H), H - 1 - np.arange(H)).astype(np.float32)        # distance from the nearer edge
    w = (1 - ss((d - A["restoreHold"]) / (A["restoreBand"] - A["restoreHold"])))[:, None, None]
    if str(i + 1) in P["roadEnd"]: w[:H // 2] = 0                    # the road ends in the fog: no top restore
    out = paint * (1 - w) + comp * w
    road = np.array(GL["sheets"][i]["road"], np.float32)
    inner = road[(road[:, 1] > OV + A["restoreBand"]) & (road[:, 1] < H - OV - A["restoreBand"])]
    xi, yi = inner[:, 0].astype(int).clip(0, W - 1), inner[:, 1].astype(int).clip(0, H - 1)
    dist = np.linalg.norm(paint[yi, xi] - comp[yi, xi], axis=1)
    fid[i + 1] = {"roadSamples": int(len(inner)), "onRoad": round(float((dist < A["roadMatch"]).mean()), 3)}
    sheets.append(out)

# ---- 2. bake the seam crossfade into each sheet's bottom rows (sheet k+1 drawn over sheet k)
final = [s.copy() for s in sheets]
for k in range(1, N):
    t = ss(np.arange(OV, dtype=np.float32) / (OV - 1))[:, None, None]         # 0 at row H-OV, 1 at the bottom row
    final[k][H - OV:] = sheets[k][H - OV:] * (1 - t) + sheets[k - 1][:OV] * t

# ---- 3. nudge nodes and the road centreline onto the painted road; eggs by colour
def roadness(img, road):
    xs, ys = road[:, 0].astype(int).clip(0, W - 1), road[:, 1].astype(int).clip(0, H - 1)
    col = np.median(img[ys, xs], axis=0)
    return np.linalg.norm(img - col, axis=2) < A["roadMatch"], col
def nudge(mask, x, y, r):
    y0, y1, x0, x1 = max(0, int(y) - r), min(H, int(y) + r + 1), max(0, int(x) - r), min(W, int(x) + r + 1)
    yy, xx = np.nonzero(mask[y0:y1, x0:x1]); yy, xx = yy + y0, xx + x0
    keep = np.hypot(xx - x, yy - y) <= r
    if keep.sum() < A["nudgeMinPx"]: return x, y, False
    return float(xx[keep].mean()), float(yy[keep].mean()), True

layout = {"about": "Sapper's Path v5 journey map. Sheets read bottom to top; sheet 1 is the bottom. Coordinates are sheet pixels "
                   "(origin top-left of each sheet). Draw sheet k+1 over sheet k, its top edge `step` px above sheet k's: "
                   "the bottom `overlap` rows of each sheet already hold the crossfade.",
          "w": W, "h": H, "overlap": OV, "step": STEP, "sheets": []}
flags = []
for i in range(N):
    g = GL["sheets"][i]; img = final[i]; rr = np.array(g["road"], np.float32)
    mask, col = roadness(img, rr)
    road = []
    for x, y in g["road"]:
        if OV + 20 < y < H - OV - 20: x, y, _ = nudge(mask, x, y, A["roadNudge"])
        road.append([round(x), round(y)])
    for k in range(1, len(road) - 1):            # light smoothing of the nudged centreline (the ends stay at the seams)
        if OV + 20 < road[k][1] < H - OV - 20:
            road[k] = [round((road[k - 1][j] + 2 * road[k][j] + road[k + 1][j]) / 4) for j in (0, 1)]
    RE = P["roadEnd"].get(str(i + 1))
    if RE: road = [p for p in road if p[1] >= RE["cutAbove"]] + RE["points"]
    lv = []
    for n in g["levels"]:
        x, y, ok = nudge(mask, n["x"], n["y"], A["nodeNudge"])
        if not ok: flags.append(f"sheet {i + 1} level {n['n']}: no painted road within {A['nodeNudge']} px, kept the guide spot")
        lv.append({"n": n["n"], "x": round(x), "y": round(y)})
    rec = {"sheet": i + 1, "file": f"sheet-{i + 1:02d}.jpg", "realm": g["realm"], "realmName": REALMS[g["realm"]]["name"],
           "levels": lv, "quests": [dict(q) for q in g["quests"]], "entry": g["entry"], "exit": road[-1] if RE else g["exit"], "road": road}
    # eggs: colour masks on the painted sheet
    r_, g_, b_ = img[..., 0], img[..., 1], img[..., 2]; lum = img.mean(2); sat = img.max(2) - img.min(2)
    water = (b_ > r_ + 22) & (g_ > r_ + 22)
    water = ndi.binary_opening(water, iterations=3)
    dark = (lum < A["darkLum"]) & ~water
    dark = ndi.binary_opening(dark, iterations=2)
    rock = (sat < 28) & (lum > 90) & (lum < 175) & ~water
    fog = (lum > 185) & (sat < 30)
    roadpx = np.zeros((H, W), bool); rd = Image.new("L", (W, H)); ImageDraw.Draw(rd).line([tuple(p) for p in road], fill=255, width=36)
    for q in rec["quests"]: ImageDraw.Draw(rd).line([tuple(q["branch"]), (q["x"], q["y"])], fill=255, width=30)
    roadpx = np.asarray(rd) > 0
    d_road = ndi.distance_transform_edt(~roadpx)
    d_water_in = ndi.distance_transform_edt(water); d_water = ndi.distance_transform_edt(~water)
    d_dark = ndi.distance_transform_edt(~dark); dens = ndi.uniform_filter(dark.astype(np.float32), 41)
    d_rock_in = ndi.distance_transform_edt(rock)
    gy_, gx_ = np.gradient(lum); busy = ndi.uniform_filter(np.hypot(gx_, gy_), 31)   # ink density: trees, rocks, huts
    calm, crowd = busy < np.percentile(busy, A["calmPct"]), busy > np.percentile(busy, A["busyPct"])
    d_crowd = ndi.distance_transform_edt(~crowd)
    yy, xx = np.mgrid[0:H, 0:W]
    ok = (yy > OV + 40) & (yy < H - OV - 40) & (xx > 40) & (xx < W - 40) & (d_road > A["eggRoadGap"])
    for n in lv + rec["quests"]: ok &= np.hypot(xx - n["x"], yy - n["y"]) > A["eggNodeGap"]
    if "goblinKing" in g: ok &= np.hypot(xx - g["goblinKing"][0], yy - g["goblinKing"][1]) > 90
    HOSTS = {"fish": d_water_in >= 8, "wisp": (d_water_in >= 6) | fog, "reeds": ~water & (d_water < 14) & (d_water > 3),
             "woodpile": calm & (d_crowd > 6) & (d_crowd < 24) & (d_water > 30), "mushrooms": calm & (d_crowd > 4) & (d_crowd < 20) & (d_water > 30),
             "raven": d_rock_in >= 5, "glint": d_rock_in >= 4,
             "grass": calm & ~water & (d_crowd > 30) & (d_water > 25)}
    rnd = random.Random(500 + i); eggs = []
    for e in g["eggs"]:
        kind = e["kind"]
        for k in (kind, "grass"):
            m = HOSTS[k] & ok
            for o in eggs: m &= np.hypot(xx - o["x"], yy - o["y"]) > A["eggEggGap"]
            ys, xs = np.nonzero(m)
            if len(xs): break
        if not len(xs): flags.append(f"sheet {i + 1}: no spot for egg {kind}"); continue
        j = rnd.randrange(len(xs))
        if k != kind: flags.append(f"sheet {i + 1}: egg {kind} found no painted host, placed as grass")
        eggs.append({"kind": k, "x": int(xs[j]), "y": int(ys[j])})
    rec["eggs"] = eggs
    if "goblinKing" in g: rec["goblinKing"] = {"x": g["goblinKing"][0], "y": g["goblinKing"][1]}
    for o in P.get("manual", {}).get(str(i + 1), []):   # hand fixes after the eye check: {"list": "eggs", "i": 0, "x": .., "y": ..}
        rec[o["list"]][o["i"]].update({k: v for k, v in o.items() if k not in ("list", "i", "why")})
    layout["sheets"].append(rec)

# ---- JPEGs (quality stepped down until the file fits the size cap)
sizes = {}
for i in range(N):
    im = Image.fromarray(np.clip(final[i], 0, 255).astype(np.uint8))
    for q in range(A["jpegMax"], A["jpegMin"] - 1, -2):
        buf = io.BytesIO(); im.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
        if buf.tell() <= A["maxKB"] * 1024: break
    (MAP / f"sheet-{i + 1:02d}.jpg").write_bytes(buf.getvalue()); sizes[i + 1] = (q, buf.tell())
json.dump(layout, open(MAP / "layout.json", "w"), separators=(",", ":"))

# ---- contact sheets: the whole stack as the game will draw it (from the JPEGs), with nodes, eggs and the Goblin King
HT = N * H - (N - 1) * OV
tall = Image.new("RGB", (W, HT))
for i in range(N): tall.paste(Image.open(MAP / f"sheet-{i + 1:02d}.jpg"), (0, HT - i * STEP - H))
def marks(dr, s, ox=0, oy=0):
    for rec in layout["sheets"]:
        t0 = HT - (rec["sheet"] - 1) * STEP - H
        dr.line([((x + ox) * s, (y + t0 + oy) * s) for x, y in rec["road"]], fill=(255, 255, 255), width=1)
        for n in rec["levels"]: X, Y = (n["x"] + ox) * s, (n["y"] + t0 + oy) * s; dr.ellipse([X - 4, Y - 4, X + 4, Y + 4], fill=(240, 190, 40), outline=(0, 0, 0))
        for n in rec["quests"]: X, Y = (n["x"] + ox) * s, (n["y"] + t0 + oy) * s; dr.ellipse([X - 5, Y - 5, X + 5, Y + 5], fill=(150, 80, 220), outline=(0, 0, 0))
        for n in rec["eggs"]: X, Y = (n["x"] + ox) * s, (n["y"] + t0 + oy) * s; dr.rectangle([X - 3, Y - 3, X + 3, Y + 3], fill=(230, 40, 40), outline=(255, 255, 255))
        if "goblinKing" in rec:
            X, Y = rec["goblinKing"]["x"] * s, (rec["goblinKing"]["y"] + t0) * s; dr.polygon([(X, Y - 7), (X - 6, Y + 5), (X + 6, Y + 5)], fill=(0, 0, 0))
MARKS = [(240, 190, 40), (150, 80, 220), (230, 40, 40), (255, 255, 255), (0, 0, 0), (255, 0, 0)]
def qsave(img, path):                             # 256-colour PNG that keeps the marker colours exact
    if not A["seamsQuantize"]: img.save(path, optimize=True); return
    pal = Image.new("P", (1, 1)); pal.putpalette(img.quantize(256 - len(MARKS)).getpalette()[:(256 - len(MARKS)) * 3] + [v for c in MARKS for v in c])
    img.quantize(palette=pal, dither=Image.Dither.NONE).save(path, optimize=True)
cw = P["out"]["contactWidth"]; s = cw / W
contact = tall.resize((cw, round(HT * s)), Image.LANCZOS); dr = ImageDraw.Draw(contact)
for k in range(1, N): y = (HT - k * STEP - OV / 2) * s; dr.line([(0, y), (6, y)], fill=(255, 0, 0), width=2); dr.line([(cw - 7, y), (cw, y)], fill=(255, 0, 0), width=2)
marks(dr, s); qsave(contact, HERE / "contact.png")
cr = P["out"]["seamCrop"]; seams = Image.new("RGB", (W, (N - 1) * (2 * cr + 8)), (255, 255, 255))
for k in range(1, N):
    yc = round(HT - k * STEP - OV / 2); crop = tall.crop((0, yc - cr, W, yc + cr)); d2 = ImageDraw.Draw(crop)
    d2.line([(0, cr), (10, cr)], fill=(255, 0, 0), width=2); d2.line([(W - 11, cr), (W, cr)], fill=(255, 0, 0), width=2)
    seams.paste(crop, (0, (k - 1) * (2 * cr + 8)))
qsave(seams, HERE / "contact-seams.png")
json.dump({"fidelity": fid, "jpeg": {k: {"quality": q, "kb": round(b / 1024)} for k, (q, b) in sizes.items()},
           "totalKB": round(sum(b for _, b in sizes.values()) / 1024), "flags": flags}, open(HERE / "fidelity.json", "w"), indent=1)
print("fidelity", {k: v["onRoad"] for k, v in fid.items()})
print("jpeg", {k: f"q{q} {b // 1024}KB" for k, (q, b) in sizes.items()}, "total", sum(b for _, b in sizes.values()) // 1024, "KB")
print("\n".join(flags) or "no flags")
