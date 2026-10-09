# Sapper's Path Land 1: the 2D retouch of castle sheet 25's top (tools/land-01-notes.md §6). Once Kitten Forest sits above
# the summit the fog no longer hides sheet 25's top: painted mist, a horizon at about row 100, a far tower and the painted
# road bending right to about x = 600, while the layout road (and the forest's road) runs up to x = 384. No image model
# (the GPU is busy and the brief allows none): a plain 2D retouch of the top band only, the rest of the sheet untouched.
#   1. Erase the mist band (rows 0 to TOP), the road's right bend (BEND, within BEND_R px) and their soft edges.
#   2. Fill with the sheet's own sepia ground: the low frequencies from cv2.inpaint (Telea) on a 1/4 size copy, then the
#      watercolour mottling and the paper grain as blurred noise at the strengths measured on a clean patch of plain
#      (DONOR; noise, not a cloned tile, so nothing repeats).
#   3. Paint the road on as the sheet paints it (its profile measured across the painted road below): a pale cream band
#      ROAD_W wide along NEW (from the painted road's turn at its foot up to x = 384 at the top), uneven inside, a sharp
#      darker edge and a faint wash outside.
#   4. Blend into the forest: rows 0 to FOREST take the colour of Kitten Forest sheet A's bottom row (each column, blurred
#      across), fading out downward, so the page's 80 px crossfade lands on matching ground and road.
# The original is in git history (map/sheet-25.jpg before this commit; v7 lane T: the shipped sheet is map/sheet-25.webp). Saved with the original's quantization tables and
# subsampling, so rows below the band change only by the JPEG round trip (measured in the notes).
#   /Users/peter/local-ai/.venv/bin/python tools/map-gen/retouch-25.py ORIG.jpg LAND_A.webp OUT.jpg [PREVIEW.png]
import sys
import numpy as np
import cv2
from PIL import Image, JpegImagePlugin
from scipy.ndimage import gaussian_filter, distance_transform_edt

TOP, FOREST, SOFT = 132, 150, 14              # the mist band, the forest blend's reach, the erase mask's feather (px)
BEND = [(325, 292), (360, 288), (400, 287), (440, 286), (480, 283), (505, 276), (525, 262), (545, 243), (565, 229), (585, 215),
        (597, 197), (598, 180), (585, 165), (570, 155), (575, 145), (600, 133), (615, 120), (612, 100)]
BEND_R = 24                                    # the old road's half width plus its edge wash
TRACK = [(318, 214), (360, 190), (420, 165), (480, 145), (525, 125)]   # a faint track the new road would cross
TRACK_R = 10
NEW = [(354, 342), (334, 330), (318, 316), (310, 300), (312, 280), (325, 250), (345, 215), (365, 180), (379, 150), (387, 120), (386, 95), (384, 70), (384, 0)]
ROAD_W, EDGE = 26, 4                          # the painted road's width (the coded road is 30) and its edge
DONOR = (476, 380, 596, 440)                  # a clean patch of plain below the bend (x0, y0, x1, y1)
STOP = 340                                    # nothing below this row changes (the JPEG round trip aside)

def dense(pts, step=1.0):  # a polyline resampled every `step` px
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, int(np.hypot(x1 - x0, y1 - y0) / step))
        for k in range(n): out.append((x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n))
    out.append(pts[-1]); return np.array(out)

def smooth(pts, k=9):  # a light moving average over a dense polyline (ends kept)
    p = pts.copy()
    for i in range(k, len(p) - k): p[i] = pts[i - k:i + k + 1].mean(0)
    return p

def dist_to(poly, H, W):  # distance of every pixel to a polyline (via a rasterized 1 px line)
    m = np.ones((H, W), np.uint8)
    q = np.round(poly).astype(int)
    for (x0, y0), (x1, y1) in zip(q, q[1:]): cv2.line(m, (int(x0), int(y0)), (int(x1), int(y1)), 0, 1)
    return distance_transform_edt(m)

def main():
    src, land_a, out = sys.argv[1], sys.argv[2], sys.argv[3]
    jp = Image.open(src); im = np.asarray(jp.convert("RGB")).astype(np.float32); H, W = im.shape[:2]
    # 1. the erase mask (1 = rebuild), feathered
    yy = np.arange(H)[:, None] + np.zeros((1, W))
    hard = (yy <= TOP) | (dist_to(dense(BEND), H, W) <= BEND_R) | (dist_to(dense(TRACK), H, W) <= TRACK_R)
    soft = np.clip(1 - (distance_transform_edt(~hard) / SOFT), 0, 1).astype(np.float32)
    soft[STOP:] = 0
    # 2. the fill: low frequencies by inpainting a 1/4 copy, mottling and grain from the donor patch
    q = 4; small = cv2.resize(im, (W // q, H // q), interpolation=cv2.INTER_AREA)
    msk = cv2.resize((soft > 0.02).astype(np.uint8) * 255, (W // q, H // q), interpolation=cv2.INTER_NEAREST)
    low = cv2.inpaint(np.clip(small, 0, 255).astype(np.uint8), msk, 12, cv2.INPAINT_TELEA).astype(np.float32)
    low = cv2.resize(gaussian_filter(low, (3, 3, 0)), (W, H), interpolation=cv2.INTER_CUBIC)
    x0, y0, x1, y1 = DONOR; d = im[y0:y1, x0:x1]
    mot_sd = (gaussian_filter(d, (4, 4, 0)) - gaussian_filter(d, (12, 12, 0))).std((0, 1))      # the watercolour mottling
    grn_sd = (d - gaussian_filter(d, (1.2, 1.2, 0))).std((0, 1))                                  # the paper grain
    rng = np.random.default_rng(25)
    def field(sig):  # gaussian noise blurred to scale sig, unit std (no tiling, so no repeat)
        f = gaussian_filter(rng.normal(0, 1, (H, W)), sig); return f / f.std()
    mot, grn = field(6), field(0.8)
    tex = mot[..., None] * mot_sd * 1.0 + grn[..., None] * grn_sd
    fill = low + tex
    # 3. the road: a pale band with a sharp darker edge and a faint wash outside, as the sheet's painted road
    road = smooth(dense(NEW, 1.0), 6)
    dr = dist_to(road, H, W)
    half = ROAD_W / 2 + field(10) * 1.6                              # the edges wobble about +-2 px
    cream = np.array([212, 202, 185], np.float32); ink = np.array([118, 104, 88], np.float32); wash = np.array([142, 128, 108], np.float32)
    a_in = np.clip(half - dr + 0.5, 0, 1)                            # inside the road
    a_line = np.clip(1 - np.abs(dr - half) / (EDGE / 2), 0, 1) * 0.8 # the sharp darker edge
    a_wash = np.clip(1 - (dr - half) / (EDGE * 2.5), 0, 1) * (dr > half) * 0.25   # a faint wash just outside
    road_c = cream + (mot[..., None] * 9 + grn[..., None] * grn_sd)  # watercolour unevenness inside
    base = im * (1 - soft[..., None]) + fill * soft[..., None]
    rmask = (yy <= STOP - 4)[..., None].astype(np.float32)
    for a, c in ((a_wash, wash), (a_in, road_c), (a_line, ink)): base = base * (1 - a[..., None] * rmask) + c * a[..., None] * rmask
    # 4. the forest blend: sheet A's bottom row per column (blurred across), fading out downward
    A = np.asarray(Image.open(land_a).convert("RGB")).astype(np.float32)
    edge = gaussian_filter(A[-6:].mean(0), (9, 0))                    # W x 3
    t = np.clip(1 - yy / FOREST, 0, 1) ** 1.6
    base = base * (1 - t[..., None]) + (edge[None] + tex * 0.6) * t[..., None]
    res = np.clip(base, 0, 255).astype(np.uint8)
    res[STOP:] = np.asarray(jp.convert("RGB"))[STOP:]                # below the band: the original pixels exactly
    o = Image.fromarray(res)
    o.save(out, qtables=jp.quantization, subsampling=JpegImagePlugin.get_sampling(jp), progressive=True, optimize=True)
    if len(sys.argv) > 4: o.crop((0, 0, W, 460)).save(sys.argv[4])
    print("sheet 25 retouched: rows 0-%d (mist %d, road bend, forest blend %d) -> %s" % (STOP, TOP, FOREST, out))

if __name__ == "__main__":
    main()
