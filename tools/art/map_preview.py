"""실제 맵 미리보기: content/regions/<지역>/map.tmj를 지금 타일·스프라이트로 그린다.

게임 에셋이 아니라 검토용이다(그래픽 개편 단계 B, 화풍 통일, docs/art-overhaul/).

    python tools/art/map_preview.py          # 지역 1(에코 마을)
    python tools/art/map_preview.py r02      # 지역 2(갈림길 숲)

- rNN-tiles.png   : 그 지역 타일(6배, 투명 물체는 게임처럼 바닥 위에) + 애니메이션 프레임, 바닥 타일 3×3 이어 붙임
                    (이음새 확인, 3배). 지역 1은 마을 오브젝트(town_objects.py) 모든 프레임(6배)도
- rNN-map.png     : 맵 전체(1배)와 구역별 확대(3배). 오브젝트·NPC·몬스터·주인공 일행을 맵 위치에 세운다
- rNN-view.png    : 게임 화면 크기(320×180)로 자른 장면들(4배)
- r01-anim.gif    : 연못·꽃밭·화단·가로등 타일 애니메이션(2배, 지역 1만)

오브젝트 → 스프라이트는 src/game/WorldScene.ts와 같다(monster는 problem.json의 enemy.sprite, npc는 sprite 속성).
타일 애니메이션은 manifest `tileAnimations`를 따른다.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import build  # noqa: E402
from build import DECO_UNDER, TILES, sprite_frames, text  # noqa: E402
from gif import write_gif  # noqa: E402
from gridlib import Canvas  # noqa: E402
from png import encode_png  # noqa: E402
from town_objects import TOWN_OBJECTS  # noqa: E402

ROOT = build.ROOT
OUT = os.path.join(ROOT, "docs", "art-overhaul")
TS = 16

BG = (0x2b, 0x24, 0x33, 255)
PANEL = (0x3a, 0x34, 0x46, 255)
HEAD = (0xf6, 0xdc, 0x7c, 255)

OBJ_SPRITE = {"sign": "obj_sign", "chest": "obj_chest", "door": "obj_door", "campfire": "obj_campfire",
              "rune": "obj_rune", "warp": "obj_door", "board": "obj_board", "shop": "obj_shop"}

# 지역별 미리보기 설정
# - tiles: 타일셋에서 그 지역 타일 범위(시작, 끝) / ground: 3×3 이어 붙임으로 볼 타일 / mass: 3×3으로 볼 물체 타일(숲 벽 등)
# - areas: 확대해 볼 구역(제목, 타일 x, y, 너비, 높이) / views: 게임 화면(320×180)으로 자를 곳(제목, 픽셀 x, y)
REGIONS = {
    "r01": {
        "dir": "r01-echo-village", "title": "echo village", "tiles": (0, 24), "town": True,
        "ground": ["grass", "grass_flower", "path", "plaza_stone", "water", "house_roof", "house_wall", "wall_stone",
                   "floor_stone", "floor_wood", "stairs", "clocktower_wall", "dark_floor"],
        "mass": [],
        "areas": [("well & plaza", 0, 0, 22, 20), ("market street & alley", 21, 0, 35, 20),
                  ("well side & pond", 0, 19, 20, 22), ("clocktower", 29, 19, 27, 20)],
        "views": [("spawn", 0, 19 * TS + 4), ("market", 21 * TS, 0), ("plaza", 0, 8 * TS),
                  ("clocktower", 33 * TS, 26 * TS), ("alley", 36 * TS, 1 * TS), ("pond", 0, 30 * TS)],
    },
    "r02": {
        "dir": "r02-crossroad-forest", "title": "crossroad forest", "tiles": (24, 36), "town": False,
        "ground": ["forest_floor", "fallen_leaves", "tall_grass", "root_floor", "stream", "stepping_stone"],
        "mass": ["pine_tree"],
        "areas": [("west entrance & loop", 0, 4, 28, 16), ("loop & chest", 24, 6, 22, 16),
                  ("woodcutter & frozen stream", 42, 0, 26, 16), ("boss clearing", 62, 4, 22, 16)],
        "views": [("entrance", 0, 5 * TS), ("traveler", 14 * TS, 9 * TS), ("woodcutter", 37 * TS, 2 * TS),
                  ("stream", 53 * TS, 8 * TS), ("loop", 20 * TS, 7 * TS), ("boss", 63 * TS, 5 * TS)],
    },
    # 지역 3~7: 화풍 통일 병렬 작업에서 그 지역 에이전트가 자기 칸의 ground·mass·areas·views만 채운다
    "r03": {
        "dir": "r03-goblin-cave", "title": "goblin cave", "tiles": (36, 48), "town": False,
        "ground": ["cave_floor", "minecart_rail", "cave_pool", "cave_wall", "torch_frozen", "mural_wall", "cave_crack"],
        "mass": ["cave_wall_top"],
        "areas": [("entrance & tunnels", 0, 2, 34, 14), ("storeroom", 34, 2, 24, 14),
                  ("mirror pool & hidden crack", 55, 1, 22, 15), ("mural & chief's throne", 74, 3, 31, 14)],
        "views": [("entrance", 0, 5 * TS), ("tunnels", 16 * TS, 4 * TS), ("storeroom", 36 * TS, 3 * TS),
                  ("pool & crack", 55 * TS, 2 * TS), ("mural", 74 * TS, 3 * TS), ("boss", 85 * TS, 5 * TS)],
    },
    "r04": {
        "dir": "r04-grand-library", "title": "grand library", "tiles": (48, 60), "town": False,
        "ground": ["lib_floor", "lib_carpet", "floating_pages", "lib_wall"],
        "mass": ["bookshelf", "lib_wall_top"],
        "areas": [("entrance hall", 0, 4, 22, 15), ("reading room & ghost", 19, 4, 22, 18),
                  ("stacks maze & hidden path", 37, 2, 24, 16), ("scriptorium", 58, 5, 22, 16),
                  ("sealed archive", 76, 5, 16, 12), ("golem's lectern", 86, 5, 17, 13)],
        "views": [("entrance hall", 0, 5 * TS), ("reading room", 21 * TS, 6 * TS), ("stacks", 42 * TS, 2 * TS),
                  ("scriptorium", 60 * TS, 7 * TS), ("sealed archive", 74 * TS, 6 * TS), ("boss", 83 * TS, 6 * TS)],
    },
    "r05": {
        "dir": "r05-trade-port", "title": "trade port", "tiles": (60, 74), "town": False,
        "ground": ["port_cobble", "dock_plank", "harbor_water", "frozen_wave", "ship_deck", "lighthouse_wall"],
        "mass": ["port_crate", "ship_rail"],
        "areas": [("coast market & guild", 0, 2, 34, 16), ("warehouse street", 34, 0, 24, 17),
                  ("docks", 56, 4, 24, 14), ("lighthouse & smuggler ship", 76, 0, 26, 17)],
        "views": [("market", 0, 2 * TS), ("guild", 16 * TS, 2 * TS), ("warehouse", 40 * TS, 1 * TS),
                  ("docks", 57 * TS, 5 * TS), ("lighthouse", 72 * TS, 1 * TS), ("ship", 82 * TS, 5 * TS)],
    },
    "r06": {
        "dir": "r06-mirror-lake", "title": "mirror lake", "tiles": (74, 88), "town": False,
        "ground": ["lake_shore", "lake_water", "mirror_water", "mist_grass", "island_grass", "lake_bridge",
                   "lake_stepping_stone"],
        "mass": ["lake_reed", "willow_tree", "bridge_rail"],
        "areas": [("ferry & willow bank", 0, 0, 36, 22), ("mirror bridge", 36, 2, 26, 18),
                  ("mist reeds (hidden path)", 58, 0, 22, 18), ("echo shoal & island", 76, 2, 30, 18)],
        "views": [("ferry", 0, 6 * TS), ("willow bank", 23 * TS, 6 * TS), ("keeper", 15 * TS, 1 * TS),
                  ("mirror bridge", 45 * TS, 5 * TS), ("reeds hidden path", 62 * TS, 0), ("island", 86 * TS, 6 * TS)],
    },
    "r07": {
        "dir": "r07-hourglass-desert", "title": "hourglass desert", "tiles": (88, 103), "town": False,
        "ground": [],
        "mass": [],
        "areas": [],
        "views": [],
    },
}


def save(cv, name):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name)
    with open(p, "wb") as f:
        f.write(encode_png(cv.width, cv.height, cv.rows()))
    return p


def load_map(region):
    with open(os.path.join(ROOT, "content", "regions", REGIONS[region]["dir"], "map.tmj"), encoding="utf-8") as f:
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


def actors(tmj, region):
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
            path = os.path.join(ROOT, "content", "regions", REGIONS[region]["dir"], "problems", props["problem"],
                                "problem.json")
            with open(path, encoding="utf-8") as f:
                key = json.load(f)["enemy"]["sprite"]
        elif t == "npc":
            key = props["sprite"]
        else:
            key = OBJ_SPRITE.get(t)
        if key:
            out.append((key, 0, x, y))
    return out


def render_map(manifest, tmj, region, t=0.0, with_actors=True):
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
        for name, frame, x, y in sorted(actors(tmj, region), key=lambda a: a[3]):
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


def tile_canvas(n, on_floor=True):
    """타일 한 칸. on_floor면 투명 물체 타일을 게임처럼 바닥(build.DECO_UNDER) 위에 그린다."""
    t = Canvas(TS, TS)
    if on_floor and n in DECO_UNDER:
        t.draw(TILES[DECO_UNDER[n]])
    return t.draw(TILES[n])


def tiles_sheet(manifest, region):
    cfg = REGIONS[region]
    names = tile_names(manifest)
    a, b = cfg["tiles"]
    anim = set(f for an in manifest.get("tileAnimations", {}).values() for f in an["frames"])
    mine = names[a:b] + [n for n in names[b:] if n in anim and region == "r01"]
    S = 6
    cell = TS * S + 14
    per = 8
    rows = -(-len(mine) // per)
    tiled = cfg["ground"] + cfg["mass"]
    gcell = TS * 3 * 3 + 12
    gper = 7 if region == "r01" else (16 + per * cell) // gcell   # 지역 1은 예전 배치 그대로
    grows = -(-len(tiled) // gper)
    objs = [(n, i) for n, fr in TOWN_OBJECTS.items() for i in range(len(fr))] if cfg["town"] else []
    orows = -(-len(objs) // per)
    W = 16 + per * cell + 16
    H = 16 + 20 + rows * (cell + 10) + 24 + grows * (gcell + 14) + (24 + orows * (cell + 10) if objs else 0) + 16
    cv = Canvas(W, H, BG)
    text(cv, f"region {int(region[1:])} tiles (6x)" + (" + animation frames" if region == "r01" else ""), 16, 16, 2,
         HEAD)
    y0 = 40
    for i, n in enumerate(mine):
        x = 16 + (i % per) * cell
        y = y0 + (i // per) * (cell + 10)
        cv.fill_rect(x - 2, y - 2, TS * S + 4, TS * S + 4, PANEL)
        cv.paste(tile_canvas(n, on_floor=region != "r01"), x, y, S)   # 지역 1은 예전처럼 물체만(패널 위)
        text(cv, n, x, y + TS * S + 4, 1)
    y0 += rows * (cell + 10) + 4
    text(cv, "ground 3x3 tiled (3x): seams must not show" + ("  /  forest wall 3x3" if cfg["mass"] else ""),
         16, y0, 2, HEAD)
    y0 += 22
    for i, n in enumerate(tiled):
        x = 16 + (i % gper) * gcell
        y = y0 + (i // gper) * (gcell + 14)
        t = Canvas(TS * 3, TS * 3)
        for j in range(3):
            for k in range(3):
                if n in DECO_UNDER:
                    t.draw(TILES[DECO_UNDER[n]], k * TS, j * TS)
                t.draw(TILES[n], k * TS, j * TS)
        cv.paste(t, x, y, 3)
        text(cv, n, x, y + TS * 9 + 3, 1)
    y0 += grows * (gcell + 14) + 4
    if objs:
        text(cv, "town objects (6x, on plaza_stone): every frame", 16, y0, 2, HEAD)
        y0 += 22
        for i, (n, f) in enumerate(objs):
            x = 16 + (i % per) * cell
            y = y0 + (i // per) * (cell + 10)
            t = Canvas(TS, TS).draw(TILES["plaza_stone"]).draw(TOWN_OBJECTS[n][f])
            cv.paste(t, x, y, S)
            text(cv, f"{n[4:]} {f}", x, y + TS * S + 4, 1)
    return cv


def main(region="r01"):
    cfg = REGIONS[region]
    manifest = build.load_manifest()
    tmj = load_map(region)
    full = render_map(manifest, tmj, region)
    paths = [save(tiles_sheet(manifest, region), f"{region}-tiles.png")]

    S = 3
    blocks = []
    for title, x, y, w, h in cfg["areas"]:
        blocks.append((title, scaled(crop(full, x * TS, y * TS, w * TS, h * TS), S)))
    W = max(full.width + 32, blocks[0][1].width + blocks[1][1].width + 48)
    # 맵 전체 1배 + 구역 확대를 두 개씩 나란히
    H = 16 + 20 + full.height + 16
    pair_h = []
    for k in range(0, len(blocks), 2):
        hh = max(b.height for _, b in blocks[k:k + 2])
        pair_h.append(hh)
        H += 22 + hh + 12
    cv = Canvas(W, H + 16, BG)
    text(cv, f"{cfg['title']} map (1x)", 16, 16, 2, HEAD)
    cv.paste(full, 16, 36)
    y = 36 + full.height + 16
    for k in range(0, len(blocks), 2):
        x = 16
        for title, b in blocks[k:k + 2]:
            text(cv, f"{title} (3x)", x, y, 2, HEAD)
            cv.paste(b, x, y + 22)
            x += b.width + 16
        y += 22 + pair_h[k // 2] + 12
    paths.append(save(cv, f"{region}-map.png"))

    vs = []
    for title, x, y in cfg["views"]:
        vs.append((title, scaled(crop(full, x, y, 320, 180), 4)))
    cv = Canvas(16 + 2 * (1280 + 16), 16 + -(-len(vs) // 2) * (720 + 30) + 16, BG)
    for i, (title, v) in enumerate(vs):
        x = 16 + (i % 2) * (1280 + 16)
        y = 16 + (i // 2) * (720 + 30)
        text(cv, f"{title} 320x180 (4x)", x, y, 2, HEAD)
        cv.paste(v, x, y + 22)
    paths.append(save(cv, f"{region}-view.png"))

    if region == "r01":
        # 타일 애니메이션: 연못(왼쪽 아래)과 광장 화단
        frames = []
        for k in range(12):
            t = k / 6.0
            m = render_map(manifest, tmj, region, t, with_actors=False)
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
    main(sys.argv[1] if len(sys.argv) > 1 else "r01")
