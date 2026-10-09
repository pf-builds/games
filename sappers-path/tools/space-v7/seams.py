#!/usr/bin/env python3
# Sapper's Path v7 lane T, stage 2: compose seams.mjs's screenshots, the JPEG build | the WebP build | difference x8,
# into tools/space-v7/seams/join-NN.jpg (the join of sheets NN and NN + 1 sits mid-height in each; the middle 60% of the
# screen at half size, JPEG q92 to keep git light: the difference is taken before that save).
#   python3 tools/space-v7/seams.py OLD_DIR NEW_DIR
import os, sys
import numpy as np
from PIL import Image, ImageDraw
old, new = sys.argv[1], sys.argv[2]; OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seams"); os.makedirs(OUT, exist_ok=True)
for f in sorted(os.listdir(new)):
    a, b = Image.open(os.path.join(old, f)).convert("RGB"), Image.open(os.path.join(new, f)).convert("RGB"); h = a.height
    a, b = a.crop((0, int(h * 0.2), a.width, int(h * 0.8))), b.crop((0, int(h * 0.2), b.width, int(h * 0.8)))
    s = 0.5; a, b = a.resize((int(a.width * s), int(a.height * s)), Image.LANCZOS), b.resize((int(b.width * s), int(b.height * s)), Image.LANCZOS)
    d = Image.fromarray(np.clip(np.abs(np.asarray(a).astype(int) - np.asarray(b).astype(int)) * 8, 0, 255).astype(np.uint8))
    out = Image.new("RGB", (3 * a.width + 40, a.height + 30), (24, 22, 28)); dr = ImageDraw.Draw(out)
    for k, (im, lab) in enumerate([(a, "JPEG sheets (a11e9bf)"), (b, "WebP sheets (v7)"), (d, "difference x8")]):
        out.paste(im, (k * (a.width + 20), 30)); dr.text((k * (a.width + 20) + 4, 8), f.replace(".png", "") + "  " + lab, fill=(240, 236, 220))
    out.save(os.path.join(OUT, f.replace(".png", ".jpg")), quality=92); print("seams/" + f.replace(".png", ".jpg"), "mean |diff|", round(float(np.mean(np.abs(np.asarray(a).astype(int) - np.asarray(b).astype(int)))), 3))
