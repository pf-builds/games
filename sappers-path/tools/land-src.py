# Sapper's Path lands foundation: a land's (or the Wandering Gallery's) stored sources, as tools/gallery-src.py makes the
# Gallery's. For every picture in MANIFEST (a land's pictures/manifest.json), take its raw file (`file`, in RAW_DIR) and
# write OUT_DIR/<id>.png, the small copy tools/convert.js reads: 8-bit RGBA PNG, not interlaced. Paintings and photos go
# to 160 px on the long side (Lanczos); our generated pictures ("ours") go to 256 px (box filter: flat art stays flat);
# emoji keep their size. A source already there is kept (resumable). Nothing is fetched or generated here.
#   python3 tools/land-src.py RAW_DIR MANIFEST OUT_DIR [ID ...]   (system python3 or the local-ai venv: Pillow)
import json, os, sys
from PIL import Image
raw_dir, man, out_dir, only = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3], set(sys.argv[4:])
os.makedirs(out_dir, exist_ok=True)
made = kept = missing = 0
for p in man:
    if only and p["id"] not in only: continue
    out = os.path.join(out_dir, p["id"] + ".png")
    if os.path.exists(out): kept += 1; continue
    src = os.path.join(raw_dir, p["file"])
    if not os.path.exists(src): print("missing", p["id"], src); missing += 1; continue
    im = Image.open(src).convert("RGBA")
    if p.get("kind") == "ours": im = im.resize((256, round(256 * im.size[1] / im.size[0])), Image.BOX)
    elif p.get("kind") != "emoji":
        k = 160 / max(im.size); im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
    im.save(out, optimize=True); made += 1
print("sources: %d made, %d kept, %d missing" % (made, kept, missing))
sys.exit(1 if missing else 0)
