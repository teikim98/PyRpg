"""지역 1(에코 마을) 실제 맵 미리보기: content/regions/r01-echo-village/map.tmj를 지금 타일·스프라이트로 그린다.

게임 에셋이 아니라 검토용이다(그래픽 개편 단계 B, docs/art-overhaul/).

    python tools/art/map_preview.py

- r01-tiles.png   : 지역 1 타일 24종 + 애니메이션 프레임(6배), 바닥 타일 3×3 이어 붙임(이음새 확인, 3배)
- r01-map.png     : 맵 전체(1배)와 구역별 확대(3배). 오브젝트·NPC·몬스터·주인공 일행을 맵 위치에 세운다
- r01-view.png    : 게임 화면 크기(320×180)로 자른 장면 2개(4배)
- r01-anim.gif    : 연못·꽃밭·화단 타일 애니메이션(3배)

오브젝트 → 스프라이트는 src/game/WorldScene.ts와 같다(monster는 problem.json의 enemy.sprite, npc는 sprite 속성).
타일 애니메이션은 manifest `tileAnimations`를 따른다.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import build  # noqa: E402
from build import TILES, sprite_frames, text  # noqa: E402
from gif import write_gif  # noqa: E402
from gridlib import Canvas  # noqa: E402
from png import encode_png  # noqa: E402

ROOT = build.ROOT
OUT = os.path.join(ROOT, "docs", "art-overhaul")
REGION = os.path.join(ROOT, "content", "regions", "r01-echo-village")
TS = 16

BG = (0x2b, 0x24, 0x33, 255)
PANEL = (0x3a, 0x34, 0x46, 255)
HEAD = (0xf6, 0xdc, 0x7c, 255)

OBJ_SPRITE = {"sign": "obj_sign", "chest": "obj_chest", "door": "obj_door", "campfire": "obj_campfire",
              "rune": "obj_rune", "warp": "obj_door", "board": "obj_board", "shop": "obj_shop"}


def save(cv, name):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name)
    with open(p, "wb") as f:
        f.write(encode_png(cv.width, cv.height, cv.rows()))
    return p


def load_map():
    with open(os.path.join(REGION, "map.tmj"), encoding="utf-8") as f:
        return json.load(f)


def tile_names(manifest):
    return manifest["tilesets"]["overworld"]["tiles"]


def anim_frame(manifest, name, t):
    """타일 이름 → 시각 t(초)에 보일 프레임 타일 이름."""
    anim = manifest.get("tileAnimations", {}).get(name)
    if not anim:
        return name
    frames = anim["frames"]
    return frames[int(t * anim["fps"]) % len(frames)]


def actors(tmj):
    """[(스프라이트 이름, 프레임 번호, 타일 x, 타일 y)]"""
    out = []
    objs = next(layer for layer in tmj["layers"] if layer["name"] == "objects")["objects"]
    for o in objs:
        props = {p["name"]: p["value"] for p in o.get("properties", [])}
        x, y = o["x"] // TS, o["y"] // TS
        t = o["type"]
        if t == "spawn":
            out.append(("player", 0, x, y))
            out.append(("nuri", 0, x - 1, y))
            continue
        if t == "monster":
            with open(os.path.join(REGION, "problems", props["problem"], "problem.json"), encoding="utf-8") as f:
                key = json.load(f)["enemy"]["sprite"]
        elif t == "npc":
            key = props["sprite"]
        else:
            key = OBJ_SPRITE.get(t)
        if key:
            out.append((key, 0, x, y))
    return out


def render_map(manifest, tmj, t=0.0, with_actors=True):
    names = tile_names(manifest)
    w, h = tmj["width"], tmj["height"]
    layers = {layer["name"]: layer for layer in tmj["layers"]}
    cv = Canvas(w * TS, h * TS, (0, 0, 0, 255))
    for lname in ("ground", "deco"):
        data = layers[lname]["data"]
        for i, gid in enumerate(data):
            if not gid:
                continue
            n = anim_frame(manifest, names[gid - 1], t)
            cv.draw(TILES[n], (i % w) * TS, (i // w) * TS)
    if with_actors:
        for name, frame, x, y in sorted(actors(tmj), key=lambda a: a[3]):
            g = sprite_frames(name)[frame]
            fw, fh = len(g[0]), len(g)
            cv.draw(g, x * TS + TS // 2 - fw // 2, (y + 1) * TS - fh)
    return cv


def crop(cv, x, y, w, h):
    out = Canvas(w, h)
    for j in range(h):
        for i in range(w):
            if 0 <= x + i < cv.width and 0 <= y + j < cv.height:
                out.px[j][i] = cv.px[y + j][x + i]
    return out


def scaled(cv, s):
    out = Canvas(cv.width * s, cv.height * s)
    out.paste(cv, 0, 0, s)
    return out


def tiles_sheet(manifest):
    names = tile_names(manifest)
    r01 = names[:24] + [n for n in names[24:] if n in set(f for a in manifest.get("tileAnimations", {}).values()
                                                          for f in a["frames"])]
    S = 6
    cell = TS * S + 14
    per = 8
    rows = -(-len(r01) // per)
    ground = ["grass", "grass_flower", "path", "plaza_stone", "water", "house_roof", "house_wall", "wall_stone",
              "floor_stone", "floor_wood", "stairs", "clocktower_wall", "dark_floor"]
    gcell = TS * 3 * 3 + 12
    gper = 7
    grows = -(-len(ground) // gper)
    W = 16 + per * cell + 16
    H = 16 + 20 + rows * (cell + 10) + 24 + grows * (gcell + 14) + 16
    cv = Canvas(W, H, BG)
    text(cv, "region 1 tiles (6x) + animation frames", 16, 16, 2, HEAD)
    y0 = 40
    for i, n in enumerate(r01):
        x = 16 + (i % per) * cell
        y = y0 + (i // per) * (cell + 10)
        cv.fill_rect(x - 2, y - 2, TS * S + 4, TS * S + 4, PANEL)
        cv.paste(Canvas(TS, TS).draw(TILES[n]), x, y, S)
        text(cv, n, x, y + TS * S + 4, 1)
    y0 += rows * (cell + 10) + 4
    text(cv, "ground 3x3 tiled (3x): seams must not show", 16, y0, 2, HEAD)
    y0 += 22
    for i, n in enumerate(ground):
        x = 16 + (i % gper) * gcell
        y = y0 + (i // gper) * (gcell + 14)
        t = Canvas(TS * 3, TS * 3)
        for j in range(3):
            for k in range(3):
                t.draw(TILES[n], k * TS, j * TS)
        cv.paste(t, x, y, 3)
        text(cv, n, x, y + TS * 9 + 3, 1)
    return cv


# 확대해 볼 구역(타일 좌표 x, y, 너비, 높이)
AREAS = [
    ("well & plaza", 0, 0, 22, 20),
    ("market street & alley", 21, 0, 35, 20),
    ("well side & pond", 0, 19, 20, 22),
    ("clocktower", 29, 19, 27, 20),
]
# 게임 화면(320×180 = 20×11.25칸)으로 자른 곳: 시작 지점 근처, 상점 거리
VIEWS = [("spawn", 0, 19 * TS + 4), ("market", 21 * TS, 0), ("plaza", 0, 8 * TS), ("clocktower", 33 * TS, 26 * TS),
         ("alley", 36 * TS, 1 * TS), ("pond", 0, 30 * TS)]


def main():
    manifest = build.load_manifest()
    tmj = load_map()
    full = render_map(manifest, tmj)
    paths = [save(tiles_sheet(manifest), "r01-tiles.png")]

    S = 3
    blocks = []
    for title, x, y, w, h in AREAS:
        blocks.append((title, scaled(crop(full, x * TS, y * TS, w * TS, h * TS), S)))
    W = max(full.width, max(b.width for _, b in blocks[:2]) + 0) + 32
    W = max(W, blocks[0][1].width + blocks[1][1].width + 48)
    # 맵 전체 1배 + 구역 확대를 두 개씩 나란히
    H = 16 + 20 + full.height + 16
    pair_h = []
    for k in range(0, len(blocks), 2):
        hh = max(b.height for _, b in blocks[k:k + 2])
        pair_h.append(hh)
        H += 22 + hh + 12
    cv = Canvas(W, H + 16, BG)
    text(cv, "echo village map (1x)", 16, 16, 2, HEAD)
    cv.paste(full, 16, 36)
    y = 36 + full.height + 16
    for k in range(0, len(blocks), 2):
        x = 16
        for title, b in blocks[k:k + 2]:
            text(cv, f"{title} (3x)", x, y, 2, HEAD)
            cv.paste(b, x, y + 22)
            x += b.width + 16
        y += 22 + pair_h[k // 2] + 12
    paths.append(save(cv, "r01-map.png"))

    vs = []
    for title, x, y in VIEWS:
        vs.append((title, scaled(crop(full, x, y, 320, 180), 4)))
    cv = Canvas(16 + 2 * (1280 + 16), 16 + -(-len(vs) // 2) * (720 + 30) + 16, BG)
    for i, (title, v) in enumerate(vs):
        x = 16 + (i % 2) * (1280 + 16)
        y = 16 + (i // 2) * (720 + 30)
        text(cv, f"{title} 320x180 (4x)", x, y, 2, HEAD)
        cv.paste(v, x, y + 22)
    paths.append(save(cv, "r01-view.png"))

    # 타일 애니메이션: 연못(왼쪽 아래)과 광장 화단
    frames = []
    for k in range(12):
        t = k / 6.0
        m = render_map(manifest, tmj, t, with_actors=False)
        a = crop(m, 2 * TS, 31 * TS, 16 * TS, 9 * TS)
        b = crop(m, 0, 9 * TS, 16 * TS, 9 * TS)
        both = Canvas(a.width * 2 + 8, a.height, BG)
        both.paste(a, 0, 0)
        both.paste(b, a.width + 8, 0)
        frames.append(scaled(both, 2))
    gp = os.path.join(OUT, "r01-anim.gif")
    write_gif(gp, frames, delay_cs=17)
    paths.append(gp)
    for p in paths:
        print(os.path.relpath(p, ROOT))


if __name__ == "__main__":
    main()
