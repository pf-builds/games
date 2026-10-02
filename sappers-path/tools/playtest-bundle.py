#!/usr/bin/env python3
"""Build the Sapper's Path playtest bundle for Peter's private artifact.

Reads every file from a git ref (never the live working tree, which a builder may be editing) and writes
<out>/: index.html with no doctype/html/head/body wrappers, <title> first and no ?v= tags; style.css with no ?v=;
src/*.js with the versioned getJSON("x.json?v=" + V_) calls turned into plain paths; config.json, levels/levels.json,
levels/gallery.json and the font. Also writes <out>/wrap.html, an artifact-style wrapper page for the smoke test
(tools/playtest-smoke.mjs); wrap.html is not published.

  python3 tools/playtest-bundle.py <git-ref> <out-dir> [title]     e.g. HEAD /tmp/sp-bundle "Sapper's Path v4.1 Playtest"

Publish: the Artifact tool with url = the playtest artifact, file_path = <out>/index.html, root = <out>, and files for
every path printed below except index.html and wrap.html.
"""
import os, re, subprocess, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GAME = "sappers-path"
COPY = ["config.json", "levels/levels.json", "levels/gallery.json", "fonts/Jersey10-Regular.ttf"]


def show(ref, path, binary=False):
    out = subprocess.run(["git", "-C", REPO, "show", f"{ref}:{GAME}/{path}"], capture_output=True, check=True).stdout
    return out if binary else out.decode("utf-8")


def ls_src(ref):
    out = subprocess.run(["git", "-C", REPO, "ls-tree", "--name-only", f"{ref}:{GAME}/src"], capture_output=True, check=True)
    return [n for n in out.stdout.decode().split() if n.endswith(".js")]


def write(out, path, data):
    p = os.path.join(out, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "wb") as f:
        f.write(data if isinstance(data, bytes) else data.encode("utf-8"))


def main(ref, out, new_title=None):
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

    pat = re.compile(r'("[^"]+\.json)\?v=" \+ V_')
    for name in ls_src(ref):
        js, n = pat.subn(r'\1"', show(ref, "src/" + name))
        if re.search(r'\?v=" \+ V_', js):
            sys.exit(f"src/{name}: a versioned call the pattern missed")
        write(out, "src/" + name, js)
        if n:
            print(f"src/{name}: {n} versioned fetch(es) -> plain paths")

    for path in COPY:
        write(out, path, show(ref, path, binary=True))

    body = open(os.path.join(out, "index.html"), encoding="utf-8").read()
    write(out, "wrap.html", "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"></head><body>\n" + body + "\n</body></html>\n")
    files = sorted(os.path.relpath(os.path.join(d, f), out) for d, _, fs in os.walk(out) for f in fs)
    print("bundle:", out)
    for f in files:
        print(f"  {f}  {os.path.getsize(os.path.join(out, f)):,} B")


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) == 4 else None)
