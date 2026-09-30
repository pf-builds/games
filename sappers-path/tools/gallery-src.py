# Sapper's Path v4 M4: the Gallery's stored sources. For every picture in levels/gallery-manifest.json, take its
# downloaded or generated file (manifest `raw`, looked up in RAW_DIR) and write tools/gallery-src/<id>.png, the small
# copy the converter reads (tools/convert.js): 8-bit RGBA PNG, not interlaced. Emoji keep their size (72 px Twemoji, 128
# px Noto); our generated pictures go 512 -> 256 px (box filter: flat art stays flat); paintings go to 160 px on the long
# side (Lanczos). Nothing here is fetched or generated: the manifest's url, prompt and seed say where each raw file came
# from. Run with the local-ai venv's Python (Pillow 12):
#   /Users/peter/local-ai/.venv/bin/python tools/gallery-src.py RAW_DIR [ID ...]
import json, os, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man = json.load(open(os.path.join(ROOT, "levels", "gallery-manifest.json")))
raw_dir, only = sys.argv[1], set(sys.argv[2:])
for p in man["pictures"]:
    if only and p["id"] not in only: continue
    src = os.path.join(raw_dir, p["raw"])
    if not os.path.exists(src): print("missing", p["id"], src); continue
    im = Image.open(src).convert("RGBA")
    if p["kind"] == "ours": im = im.resize((256, 256), Image.BOX)
    elif p["kind"] == "painting":
        k = 160 / max(im.size); im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
    out = os.path.join(ROOT, "tools", "gallery-src", p["id"] + ".png")
    im.save(out, optimize=True)
    print(p["id"], im.size, os.path.getsize(out))
