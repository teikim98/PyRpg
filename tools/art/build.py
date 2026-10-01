"""지역 1 도트 아트 빌드: assets/manifest.json에 적힌 PNG를 모두 만들고 미리보기 시트를 그린다.

    python3 tools/art/build.py            # assets/ 아래 PNG + docs/phase2/art-preview.png 생성
    python3 tools/art/check.py            # 크기·형식 검사 + 다시 빌드한 결과와 바이트 비교

그림은 tools/art/의 tiles.py · characters.py · monsters.py · boss.py · portraits.py에
팔레트 문자 그리드(또는 도형으로 그리는 코드)로 정의되어 있다. 같은 코드면 언제나 같은 바이트가 나온다.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from boss import BOSSES  # noqa: E402
from characters import CHARACTERS  # noqa: E402
from gridlib import Canvas, sheet  # noqa: E402
from monsters import MONSTERS, OBJECTS  # noqa: E402
from png import encode_png  # noqa: E402
from portraits import PORTRAITS  # noqa: E402
from tiles import TILES  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
ASSETS = os.path.join(ROOT, "assets")
PREVIEW = os.path.join(ROOT, "docs", "phase2", "art-preview.png")


def load_manifest():
    with open(os.path.join(ASSETS, "manifest.json"), encoding="utf-8") as f:
        return json.load(f)


def sprite_frames(name: str):
    """논리 이름 → 프레임 그리드 리스트."""
    for table in (CHARACTERS, MONSTERS, OBJECTS, BOSSES):
        if name in table:
            return table[name]
    raise KeyError(f"no art defined for sprite {name!r}")


def portrait_grid(name: str):
    key = name.removeprefix("portrait_")
    if key not in PORTRAITS:
        raise KeyError(f"no art defined for portrait {name!r}")
    return PORTRAITS[key][0]


def render_assets(manifest):
    """{assets 기준 상대 경로: Canvas}"""
    out = {}
    ts = manifest["tileSize"]
    for tname, tset in manifest["tilesets"].items():
        cols = tset["columns"]
        names = tset["tiles"]
        rows = -(-len(names) // cols)
        c = Canvas(cols * ts, rows * ts)
        for i, n in enumerate(names):
            if n not in TILES:
                raise KeyError(f"no art defined for tile {n!r}")
            c.draw(TILES[n], (i % cols) * ts, (i // cols) * ts)
        out[tset["file"]] = c
    for name, spr in manifest["sprites"].items():
        frames = sprite_frames(name)
        out[spr["file"]] = sheet(frames, spr["frameWidth"], spr["frameHeight"])
    for name, por in manifest["portraits"].items():
        g = portrait_grid(name)
        size = por["size"]
        out[por["file"]] = sheet([g], size, size)
    return out


# ── 미리보기용 3×5 픽셀 글꼴 ──────────────────────────────────────────────────────
FONT = {
    "a": "010101111101101", "b": "110101110101110", "c": "011100100100011", "d": "110101101101110",
    "e": "111100110100111", "f": "111100110100100", "g": "011100101101011", "h": "101101111101101",
    "i": "111010010010111", "j": "001001001101010", "k": "101101110101101", "l": "100100100100111",
    "m": "101111111101101", "n": "000110101101101", "o": "010101101101010", "p": "110101110100100",
    "q": "010101101110011", "r": "110101110101101", "s": "011100010001110", "t": "111010010010010",
    "u": "101101101101111", "v": "101101101101010", "w": "101101111111101", "x": "101101010101101",
    "y": "101101010010010", "z": "111001010100111", "0": "111101101101111", "1": "010110010010111",
    "2": "110001010100111", "3": "110001010001110", "4": "101101111001001", "5": "111100110001110",
    "6": "011100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001110",
    "_": "000000000000111", "-": "000000111000000", "/": "001001010100100", ".": "000000000000010",
    ":": "000010000010000", "(": "010100100100010", ")": "010001001001010", " ": "000000000000000",
    "x2": "000101010101000",
}


def text(c: Canvas, s: str, x: int, y: int, scale: int = 1, color=(236, 236, 240, 255)):
    for ch in s.lower():
        glyph = FONT.get(ch, FONT[" "])
        for j in range(5):
            for i in range(3):
                if glyph[j * 3 + i] == "1":
                    c.fill_rect(x + i * scale, y + j * scale, scale, scale, color)
        x += 4 * scale
    return x


BG = (88, 92, 104, 255)
PANEL = (72, 75, 86, 255)
HEAD = (246, 220, 124, 255)


def render_preview(manifest, assets):
    S = 4
    ts = manifest["tileSize"]
    W = 1200
    blocks = []  # (높이, 그리기 함수)
    pad = 16

    def section(title):
        def draw(c, y):
            text(c, title, pad, y, 2, HEAD)
        blocks.append((18, draw))

    # 1) 타일: 이름과 함께 한 칸씩
    tset = manifest["tilesets"]["overworld"]
    section("tiles/overworld.png  (16x16, 4x)")
    names = tset["tiles"]
    cell_w, cell_h = ts * S + 12, ts * S + 14
    per_row = (W - 2 * pad) // cell_w

    def draw_tiles(c, y):
        for i, n in enumerate(names):
            x = pad + (i % per_row) * cell_w
            yy = y + (i // per_row) * cell_h
            t = Canvas(ts, ts).draw(TILES[n])
            c.paste(t, x, yy, S)
            text(c, n, x, yy + ts * S + 3, 1)
    blocks.append((-(-len(names) // per_row) * cell_h + 4, draw_tiles))

    # 2) 캐릭터: 시트 그대로(아래·왼쪽·오른쪽·위 × 2)
    chars = [n for n in manifest["sprites"] if not n.startswith(("monster_", "obj_", "boss_"))]
    section("characters  (down x2, left x2, right x2, up x2)")

    def draw_chars(c, y):
        for j, n in enumerate(chars):
            spr = manifest["sprites"][n]
            yy = y + j * (spr["frameHeight"] * S + 8)
            text(c, n, pad, yy + 28, 2)
            for i, f in enumerate(sprite_frames(n)):
                fr = Canvas(spr["frameWidth"], spr["frameHeight"]).draw(f)
                x = pad + 170 + i * (spr["frameWidth"] * S + 10)
                c.fill_rect(x - 2, yy - 2, spr["frameWidth"] * S + 4, spr["frameHeight"] * S + 4, PANEL)
                c.paste(fr, x, yy, S)
            # 실제 크기(1x)도 함께
            c.paste(assets[spr["file"]], pad + 170 + 8 * (spr["frameWidth"] * S + 10) + 10, yy + 24, 1)
    blocks.append((len(chars) * (ts * S + 8) + 4, draw_chars))

    # 3) 몬스터·오브젝트: 2프레임씩
    small = [n for n in manifest["sprites"] if n.startswith(("monster_", "obj_"))]
    section("monsters / objects  (2 frames)")
    col_w = (W - 2 * pad) // 4
    row_h = ts * S + 24

    def draw_small(c, y):
        for k, n in enumerate(small):
            spr = manifest["sprites"][n]
            x = pad + (k % 4) * col_w
            yy = y + (k // 4) * row_h
            for i, f in enumerate(sprite_frames(n)):
                fr = Canvas(spr["frameWidth"], spr["frameHeight"]).draw(f)
                fx = x + i * (spr["frameWidth"] * S + 10)
                c.fill_rect(fx - 2, yy - 2, spr["frameWidth"] * S + 4, spr["frameHeight"] * S + 4, PANEL)
                c.paste(fr, fx, yy, S)
            c.paste(assets[spr["file"]], x + 2 * (spr["frameWidth"] * S + 10) + 4, yy + 24, 1)
            text(c, n, x, yy + spr["frameHeight"] * S + 6, 1)
    blocks.append((-(-len(small) // 4) * row_h + 4, draw_small))

    # 4) 보스와 초상화
    bosses = [n for n in manifest["sprites"] if n.startswith("boss_")]
    portraits = list(manifest["portraits"])
    section("boss (32x32 x2)")

    def draw_big(c, y):
        x = pad
        for n in bosses:
            spr = manifest["sprites"][n]
            for f in sprite_frames(n):
                fr = Canvas(spr["frameWidth"], spr["frameHeight"]).draw(f)
                c.fill_rect(x - 2, y - 2, spr["frameWidth"] * S + 4, spr["frameHeight"] * S + 4, PANEL)
                c.paste(fr, x, y, S)
                x += spr["frameWidth"] * S + 10
            text(c, n, pad, y + spr["frameHeight"] * S + 6, 1)
    blocks.append((32 * S + 20, draw_big))

    psize = max(p["size"] for p in manifest["portraits"].values())
    PS = 3  # 대화창과 같은 배율
    section(f"portraits ({psize}x{psize}, 3x)  nuri: neutral / happy / worried / surprised / serious")

    def draw_portraits(c, y):
        x = pad
        for n in portraits:
            size = manifest["portraits"][n]["size"]
            g = portrait_grid(n)
            c.fill_rect(x - 2, y - 2, size * PS + 4, size * PS + 4, PANEL)
            c.paste(Canvas(size, size).draw(g), x, y, PS)
            text(c, n.removeprefix("portrait_"), x, y + size * PS + 6, 1)
            x += size * PS + 10
        # 실제 크기(1x)
        for k, n in enumerate(portraits):
            size = manifest["portraits"][n]["size"]
            g = Canvas(size, size).draw(portrait_grid(n))
            c.paste(g, x + 8 + (k % 2) * (size + 6), y + (k // 2) * (size + 6), 1)
    blocks.append((max(psize * PS, 3 * (psize + 6)) + 20, draw_portraits))

    # 5) 장면 예시(2x): 타일 위에 캐릭터·오브젝트를 올려 어울림 확인
    section("sample scene (2x)")
    scene = [
        "TTggDWWWRRRRgg",
        "TgggDWHHRORRgf",
        "ggggDppppppppg",
        "gwgggpPPPPPpgg",
        "ggfggpPlPPcPpg",
        "BBgggpPPPmPPpF",
        "ggggggpppppppg",
        "fffgggggkkkkkk",
    ]
    key = {"g": "grass", "f": "grass_flower", "p": "path", "P": "plaza_stone", "w": "well", "T": "tree",
           "B": "bush", "W": "house_wall", "H": "house_window", "R": "house_roof", "O": "house_door",
           "D": "fence", "l": "lamp_post", "c": "crate", "m": "market_stall", "F": "flower_bed", "k": "water"}
    actors = [("player", 2, 5, 3), ("nuri", 0, 6, 3), ("npc_merchant", 0, 10, 3), ("monster_type_slime", 0, 7, 4),
              ("obj_sign", 0, 3, 2), ("obj_rune", 1, 1, 4), ("obj_campfire", 0, 11, 6), ("obj_chest", 0, 12, 4),
              ("npc_child", 6, 9, 6), ("monster_remainder_bat", 0, 12, 1)]

    def draw_scene(c, y):
        sc = Canvas(len(scene[0]) * ts, len(scene) * ts)
        for j, row in enumerate(scene):
            for i, ch in enumerate(row):
                sc.draw(TILES[key[ch]], i * ts, j * ts)
        for name, frame, tx, ty in actors:
            sc.draw(sprite_frames(name)[frame], tx * ts, ty * ts)
        c.paste(sc, pad, y, 2)
    blocks.append((len(scene) * ts * 2 + 8, draw_scene))

    H = pad + sum(h + 8 for h, _ in blocks) + pad
    c = Canvas(W, H, BG)
    y = pad
    for h, draw in blocks:
        draw(c, y)
        y += h + 8
    return c


def build(write: bool = True):
    """모든 산출물을 {절대 경로: PNG 바이트}로 만든다. write=True면 파일로 쓴다."""
    manifest = load_manifest()
    assets = render_assets(manifest)
    out = {}
    for rel, c in assets.items():
        out[os.path.join(ASSETS, rel)] = encode_png(c.width, c.height, c.rows())
    prev = render_preview(manifest, assets)
    out[PREVIEW] = encode_png(prev.width, prev.height, prev.rows())
    if write:
        for path, data in out.items():
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                f.write(data)
    return out


if __name__ == "__main__":
    files = build(write=True)
    for p in sorted(files):
        print(os.path.relpath(p, ROOT))
    print(f"{len(files)} files written")
