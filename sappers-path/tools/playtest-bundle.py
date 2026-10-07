#!/usr/bin/env python3
"""Build the Sapper's Path playtest bundle for Peter's private artifact.

Reads every file from a git ref (never the live working tree, which a builder may be editing) and writes
<out>/: index.html with no doctype/html/head/body wrappers, <title> first and no ?v= tags; style.css with no ?v=;
src/*.js with the versioned getJSON("x.json?v=" + V_) calls turned into plain paths; config.json, levels/levels.json,
levels/gallery.json, the font, map/ (layout.json and the painted sheets, v5 R3; a land's sheets are WebP), art/ (the home's painting, v5.3) and
audio/ (the music, v5.2: its URLs lose their ?v= with the others). Also writes <out>/wrap.html, an artifact-style wrapper page for the smoke test
(tools/playtest-smoke.mjs); wrap.html is not published.

  python3 tools/playtest-bundle.py <git-ref> <out-dir> [title] [--jump 101,125,150,175,200,z1:1,z1:20,z2:1,z2:25]

--jump (v5 R4, playtest only, never shipped): exposes window.SP without ?debug=1 and adds src/playtest.js, a small
"Jump" chip that marks every level before the chosen one cleared (SP.unlockTo) and reloads, so a playtest can start
deep in the campaign. The artifact can't take ?debug=1 and a phone has no console. v6 lane B: a stop "z<k>:<n>" jumps into Zen
world k at its level n (SP.zenTo: the world's levels before n cleared, Zen the mode played last); its chip reads "Z<k>.<n>".

Publish: the Artifact tool with url = the playtest artifact, file_path = <out>/index.html, root = <out>, and files for
every path printed below except index.html and wrap.html (audio/*.m4a: contentType audio/mp4).
"""
import json, os, re, subprocess, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GAME = "sappers-path"
COPY = ["config.json", "levels/levels.json", "levels/gallery.json", "levels/zen.json", "levels/tutorial.json", "fonts/Jersey10-Regular.ttf"]  # v6 lane B: zen.json; part 2: tutorial.json


def show(ref, path, binary=False):
    out = subprocess.run(["git", "-C", REPO, "show", f"{ref}:{GAME}/{path}"], capture_output=True, check=True).stdout
    return out if binary else out.decode("utf-8")


def ls_src(ref, folder="src", ext=(".js",)):
    out = subprocess.run(["git", "-C", REPO, "ls-tree", "--name-only", f"{ref}:{GAME}/{folder}"], capture_output=True, check=True)
    return [n for n in out.stdout.decode().split() if n.endswith(ext)]


def write(out, path, data):
    p = os.path.join(out, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "wb") as f:
        f.write(data if isinstance(data, bytes) else data.encode("utf-8"))


JUMP_JS = """// Playtest only (tools/playtest-bundle.py --jump): jump to a level by marking every level before it cleared.
(function () {
  var stops = %s, b = document.createElement("button"), m = document.createElement("div");
  b.textContent = "Jump"; b.setAttribute("aria-label", "Playtest: jump to a level");
  b.style.cssText = "position:fixed;left:0;top:38%%;z-index:9999;font:12px system-ui,sans-serif;writing-mode:vertical-rl;padding:10px 3px;border-radius:0 10px 10px 0;border:2px solid #221a26;border-left:0;background:#ffe27a;color:#221a26;opacity:.8";
  m.style.cssText = "position:fixed;left:30px;top:30%%;z-index:9999;display:none;gap:6px;flex-wrap:wrap;justify-content:center;max-width:92vw;background:#2e2935;padding:8px;border-radius:12px;border:2px solid #221a26";
  stops.forEach(function (n) { var x = document.createElement("button"), z = /^z(\\d+):(\\d+)$/.exec(String(n)); x.textContent = z ? "Z" + z[1] + "." + z[2] : n; x.style.cssText = "font:16px system-ui,sans-serif;min-width:52px;min-height:44px;border-radius:10px;border:2px solid #221a26;background:" + (z ? "#cfe9dc" : "#f4ead2");
    x.onclick = function () { if (!window.SP || !window.SP.unlockTo) return; if (z) window.SP.zenTo(+z[1], +z[2] - 1); else window.SP.unlockTo(n - 1); location.reload(); }; m.appendChild(x); });
  b.onclick = function () { m.style.display = m.style.display === "flex" ? "none" : "flex"; };
  document.body.appendChild(m); document.body.appendChild(b);
})();
"""


def main(ref, out, new_title=None, jump=None):
    html = re.sub(r"\?v=\d+", "", show(ref, "index.html"))
    title = re.search(r"<title>.*?</title>\s*", html, re.S)
    if not title:
        sys.exit("no <title> in index.html")
    html = html.replace(title.group(0), "")
    for tag in [r"<!doctype html>\s*", r"<html[^>]*>\s*", r"</html>\s*", r"<head>\s*", r"</head>\s*", r"<body[^>]*>\s*", r"</body>\s*"]:
        html = re.sub(tag, "", html, flags=re.I)
    t = f"<title>{new_title}</title>" if new_title else title.group(0).strip()
    write(out, "index.html", t + "\n" + html)

    write(out, "style.css", re.sub(r"\?v=\d+", "", show(ref, "style.css")))
    if "tutorial.css" in html:  # v6 lane B part 2: the intro tour's styles
        write(out, "tutorial.css", re.sub(r"\?v=\d+", "", show(ref, "tutorial.css")))

    if jump:
        html = open(os.path.join(out, "index.html"), encoding="utf-8").read()
        html = html.replace('<script src="src/main.js"></script>', '<script src="src/main.js"></script>\n<script src="src/playtest.js"></script>')
        if "src/playtest.js" not in html:
            sys.exit("--jump: no main.js script tag to follow")
        write(out, "index.html", html)
        write(out, "src/playtest.js", JUMP_JS % json.dumps(jump))

    pat = re.compile(r'("[^"]+\.json)\?v=" \+ V_')
    for name in ls_src(ref):
        js, n = pat.subn(r'\1"', show(ref, "src/" + name))
        js, m = re.subn(r' \+ "\?v=" \+ V_', "", js)  # v5 R3: the map sheets' image URLs
        n += m
        if jump and name == "main.js":
            js, k = re.subn(r"if \(DEBUG\) window\.SP = SP;", "window.SP = SP; // playtest bundle (--jump)", js)
            if k != 1:
                sys.exit("--jump: main.js SP facade line not found")
        if re.search(r'\?v=" \+ V_', js):
            sys.exit(f"src/{name}: a versioned call the pattern missed")
        write(out, "src/" + name, js)
        if n:
            print(f"src/{name}: {n} versioned fetch(es) -> plain paths")

    for path in COPY:
        write(out, path, show(ref, path, binary=True))
    for name in ls_src(ref, "map", (".json", ".jpg", ".webp")):  # v5 R3: the journey map's layout and painted sheets (lands: WebP)
        write(out, "map/" + name, show(ref, "map/" + name, binary=True))
    for name in ls_src(ref, "art", (".jpg",)):  # v5.3: the home's painting (index.html's <picture>; ?v= stripped above)
        write(out, "art/" + name, show(ref, "art/" + name, binary=True))
    for name in ls_src(ref, "audio", (".m4a",)):  # v5.2: the music (main.js adds ?v= to its URLs; stripped above)
        # The artifact host serves .mp4 but not .m4a (same MP4 container), so the bundle renames them and config follows.
        write(out, "audio/" + name[:-4] + ".mp4", show(ref, "audio/" + name, binary=True))
    cfg = os.path.join(out, "config.json")
    text = open(cfg, encoding="utf-8").read()
    write(out, "config.json", re.sub(r'(audio/[^"]+)\.m4a"', r'\1.mp4"', text))

    body = open(os.path.join(out, "index.html"), encoding="utf-8").read()
    write(out, "wrap.html", "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"></head><body>\n" + body + "\n</body></html>\n")
    files = sorted(os.path.relpath(os.path.join(d, f), out) for d, _, fs in os.walk(out) for f in fs)
    print("bundle:", out)
    for f in files:
        print(f"  {f}  {os.path.getsize(os.path.join(out, f)):,} B")


if __name__ == "__main__":
    args, jump = sys.argv[1:], None
    if "--jump" in args:
        i = args.index("--jump"); jump = [x if x.startswith("z") else int(x) for x in args[i + 1].split(",")]; del args[i:i + 2]
    if len(args) not in (2, 3):
        sys.exit(__doc__)
    main(args[0], args[1], args[2] if len(args) == 3 else None, jump)
