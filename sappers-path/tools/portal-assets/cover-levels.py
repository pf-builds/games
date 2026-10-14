#!/usr/bin/env python3
"""Sapper's Path lane P Stage 5, covers D-F: the cover scenes as real picture-board levels, so the game's own board code
draws them (studs, sappers) at full size. Each scene is laid out per cover size on a grid of interior cells (one cell of
dirt border round it and the camp in the bottom border row, as a picture board must have; both are cropped off), then
written as config selfTest fixtures (`cover<opt>_<size>`) that cover-boards.mjs routes into config.json and plays.
Each size's grid keeps the cover's aspect; the title's band (top) is left as plain sky.

Palette: the game's material look, a little brighter for a cover. Letters: a sky, b cloud, c gold, d goblin green,
e ink, f stone, g stone shade, h red, i banner, k timber, l eye white, m sun (j = iron and n = gilt are rule materials: unused).

  python3 cover-levels.py <out.json> [--print]
"""
import json, sys

PAL = {"a": "#4fb8ff", "b": "#f4f8ff", "c": "#ffcc1f", "d": "#5cc93a", "e": "#1d1a26", "f": "#ddd5c4", "g": "#a89f93",
       "h": "#e8402e", "i": "#8a5cf0", "k": "#d07a2a", "l": "#ffffff", "m": "#ffe45c"}
NAMES = {"a": "sky", "b": "cloud", "c": "gold", "d": "goblin", "e": "ink", "f": "stone", "g": "stone shade", "h": "red", "i": "banner",
         "k": "timber", "l": "eye", "m": "sun"}
STONE, SHADE, BANNER, TIMBER = 6, 7, 9, 11  # material ids of f, g, i, k (the squads' colours)
# Interior cells per option and size (cover px / cells = the cell on the cover; the board draws 66 px cells).
SIZES = {"D": {"land": (30, 17), "port": (16, 24), "square": (16, 16)},
         "E": {"land": (30, 17), "port": (16, 24), "square": (20, 20)},
         "F": {"land": (30, 17), "port": (16, 24), "square": (16, 16)}}

# The Goblin King in blocks, as the boss level builds him. Small (9x9, alarmed: wide eyes, an O mouth, hands up) for a
# wall top; big (13x14) for E.
KING_S = ["..c.c.c..",
          "..ccccc..",
          "d.ddddd.d",
          "ddlldlldd",
          ".dledled.",
          ".ddddddd.",
          "..deeed..",
          ".hhccchh.",
          "hhhhhhhhh"]
KING_B = ["...c..c..c...",
          "...c.ccc.c...",
          "...ccchccc...",
          "dd..ddddd..dd",
          ".ddddddddddd.",
          "..dllldllld..",
          "..dlledlled..",
          "..ddddddddd..",
          "..dddeeeddd..",
          "..dddeeeddd..",
          "...ddddddd...",
          "..hhhcccchh..",
          ".hhhhhhhhhhh.",
          "hhhhhhhhhhhhh"]
CLOUD = ["..bbb...", ".bbbbbb.", "bbbbbbbb"]
SUN = [".mmm.", "mmmmm", "mmmmm", ".mmm."]


class Scene:
    def __init__(s, w, h, fill="a"): s.w, s.h = w, h; s.g = [[fill] * w for _ in range(h)]
    def put(s, x, y, ch):
        if 0 <= x < s.w and 0 <= y < s.h and ch != ".": s.g[y][x] = ch
    def rect(s, x, y, w, h, ch):
        for j in range(h):
            for i in range(w): s.put(x + i, y + j, ch)
    def stamp(s, art, x, y):
        for j, row in enumerate(art):
            for i, ch in enumerate(row): s.put(x + i, y + j, ch)
    def wall(s, top, x0=0, x1=None, gap=1, slits=()):
        """A castle wall from row `top` down: merlons (2 wide, `gap` apart) on its top row, a shade course under them."""
        x1 = s.w if x1 is None else x1
        s.rect(x0, top + 1, x1 - x0, s.h - top - 1, "f")
        for x in range(x0, x1, 2 + gap): s.rect(x, top, 2, 1, "f")
        s.rect(x0, top + 2, x1 - x0, 1, "g")
        for (x, y) in slits: s.rect(x, y, 1, 2, "e")
    def breach(s, cx, top, half):
        """A ragged hole dug up through the wall from the foot: open ground the sappers walk in, wider at the bottom."""
        for y in range(top, s.h):
            k = half + (1 if (y - top) % 3 == 1 else 0) + (1 if y >= s.h - 2 else 0) - (1 if y == top else 0)
            s.rect(cx - k, y, 2 * k, 1, ",")
    def level(s, name, cols, camp=4):
        W, H = s.w + 2, s.h + 2
        x0 = (s.w - camp) // 2 + 1
        rows = ["," * W] + ["," + "".join(r) + "," for r in s.g] + ["".join("#" if x0 <= x < x0 + camp else "," for x in range(W))]
        used = sorted({ch for r in s.g for ch in r if ch.isalpha()} | {chr(96 + cd[0]) for col in cols for cd in col}, key=ord)  # every card's colour too
        return {"name": name, "w": W, "h": H, "grid": rows, "pic": True, "cols": cols,
                "pal": {str(ord(ch) - 96): {"c": PAL[ch], "n": NAMES[ch]} for ch in used}}


DEAL = [[[STONE, 90]], [[SHADE, 60]], [[STONE, 70]], [[SHADE, 50]], [[STONE, 40]]]


def scene_D(size, w, h):
    """The Breach: a wall across the lower part, its timber gate dug through from the foot, banners either side, the King
    alarmed on the battlements. The wall's ends are shade stone, a colour no squad digs, so the dig comes up from the foot
    and through the gate only."""
    S = Scene(w, h)
    def gate(cx, top, half):  # an arched timber gate in a shade-stone frame, half wide each side of cx
        S.rect(cx - half - 1, top - 1, 2 * half + 2, S.h - top + 1, "g"); S.rect(cx - half, top, 2 * half, S.h - top, "k")
        S.rect(cx - half + 1, top - 1, 2 * half - 2, 1, "k")
    if size == "land":  # title: top left over the sky; the King top right; the breach centre
        S.stamp(CLOUD, 12, 5)
        S.wall(8, slits=[(2, 11), (24, 11), (27, 11)])
        S.stamp(KING_S, 20, 2)
        for x in (4, 7): S.rect(x, 10, 2, 4, "i"); S.put(x, 14, "i")
        gate(14, 11, 3); S.breach(14, 12, 2)
    elif size == "port":  # title: top; the King under it on the wall; the breach below him
        S.stamp(CLOUD, 0, 11); S.stamp(CLOUD, 11, 10)
        S.wall(16, slits=[(1, 19), (14, 19)])
        S.stamp(KING_S, 3, 8); S.rect(2, 16, 11, 1, "f")
        for x in (3, 11): S.rect(x, 18, 2, 3, "i"); S.put(x, 21, "i")
        gate(8, 19, 2); S.breach(8, 20, 2)
    else:
        S.stamp(CLOUD, 11, 7)
        S.wall(12, slits=[(1, 15), (14, 15)])
        S.stamp(KING_S, 3, 4)
        for x in (3, 11): S.rect(x, 14, 2, 1, "i")
        gate(8, 14, 2); S.breach(8, 15, 1)
    for y in range(S.h):
        for x in (0, S.w - 1):
            if S.g[y][x] == "f": S.g[y][x] = "g"
    # The foot stays diggable: a sapper goes out per block in reach, so a long dig front is what makes a swarm.
    return S, [[[TIMBER, 40]], [[STONE, 90]], [[TIMBER, 30]], [[STONE, 60]], [[STONE, 50]]]


def scene_E(size, w, h):
    """King on the wall: the big King standing on a fort (timber gate, purple banners) whose foot is being dug away; the
    front squad cards (31, 52, 24: the game's own DOM tiles, cover-boards.mjs) go along the bottom on the cover."""
    S = Scene(w, h)
    def fort(top, gx, banners):
        S.wall(top); S.rect(gx - 2, top + 3, 4, S.h - top - 3, "k"); S.rect(gx - 1, top + 2, 2, 1, "k")
        for x in banners: S.rect(x, top + 1, 2, min(3, S.h - top - 1), "i")
    if size == "land":  # title: top left over the sky; the King right of centre; the cards bottom left
        S.stamp(CLOUD, 2, 9)
        kx = 16; fort(14, 22, (3, 9, 27)); S.stamp(KING_B, kx, 1)
    elif size == "port":  # title: top; the King under it; the cards along the bottom
        S.stamp(CLOUD, 10, 8)
        kx = 1; fort(20, 8, (1, 13)); S.stamp(KING_B, kx, 8)
    else:
        S.stamp(CLOUD, 14, 8)
        kx = 3; fort(17, 10, (1, 17)); S.stamp(KING_B, kx, 6)
    return S, [[[TIMBER, 31]], [[BANNER, 52]], [[STONE, 24]], [[STONE, 40]], [[TIMBER, 30]]]


def scene_F(size, w, h):
    """Half dug: one whole block fort (keep, towers, gate, banner); drawn as dealt and again well into the dig."""
    S = Scene(w, h)
    if size == "land":
        S.stamp(SUN, 25, 1); S.stamp(CLOUD, 1, 1)
        S.rect(10, 4, 10, 13, "f"); [S.rect(x, 3, 2, 1, "f") for x in (10, 14, 18)]; S.rect(10, 6, 10, 1, "g")
        S.rect(14, 0, 1, 3, "e"); S.rect(15, 0, 3, 2, "h")
        for x in (3, 22): S.rect(x, 6, 5, 11, "g"); [S.rect(x + i, 5, 1, 1, "g") for i in (0, 2, 4)]
        S.rect(0, 12, w, 5, "f"); S.rect(0, 11, w, 1, "g"); [S.rect(x, 10, 2, 1, "f") for x in range(0, w, 3)]
        S.rect(13, 12, 4, 5, "k"); S.rect(14, 11, 2, 1, "k")
        for (x, y) in ((12, 8), (17, 8), (5, 8), (24, 8)): S.rect(x, y, 1, 2, "e")
    else:
        top = 9 if size == "port" else 3
        S.stamp(CLOUD, 0, top - 2 if size == "port" else 0)
        S.rect(4, top + 2, 8, h - top - 2, "f"); [S.rect(x, top + 1, 2, 1, "f") for x in (4, 7, 10)]; S.rect(4, top + 4, 8, 1, "g")
        S.rect(7, top - 2, 1, 3, "e"); S.rect(8, top - 2, 3, 2, "h")
        S.rect(0, h - 6, w, 6, "f"); S.rect(0, h - 7, w, 1, "g"); [S.rect(x, h - 8, 2, 1, "f") for x in range(0, w, 3)]
        S.rect(6, h - 4, 4, 4, "k")
        for (x, y) in ((6, top + 6), (9, top + 6)): S.rect(x, y, 1, 2, "e")
    return S, [[[STONE, 90], [SHADE, 60]], [[SHADE, 60]], [[STONE, 70]], [[TIMBER, 20]], [[STONE, 40]]]


SCENES = {"D": (scene_D, "The Breach"), "E": (scene_E, "King on the wall"), "F": (scene_F, "Half dug")}


def main(out, show):
    fx = {}
    for o, (fn, name) in SCENES.items():
        for size, (w, h) in SIZES[o].items():
            S, cols = fn(size, w, h)
            L = S.level(f"Cover {o} {name} ({size})", cols)
            fx[f"cover{o}_{size}"] = L
            if show: print(f"cover{o}_{size} {L['w']}x{L['h']}"); print("\n".join(L["grid"]))
    json.dump(fx, open(out, "w"), indent=0); print(out, len(fx), "scenes")


if __name__ == "__main__":
    main(sys.argv[1], "--print" in sys.argv)
