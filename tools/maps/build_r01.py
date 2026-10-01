#!/usr/bin/env python3
"""지역 1(에코 마을) 맵 생성기: 아스키 도면 → Tiled JSON(.tmj).

사용법: python3 tools/maps/build_r01.py [--check] [--print]
  --check  파일을 쓰지 않고 검증만 한다(현재 map.tmj와 내용이 다르면 실패)
  --print  도면과 구역별 도달 범위를 출력한다

출력 레이어
  ground     바닥·건물 벽 같은 바탕 타일
  deco       나무·덤불·가로등·노점·화단·울타리·우물(바탕 위에 겹쳐 그림)
  collision  막힌 칸(값이 0이 아니면 막힘, 보이지 않는 레이어). manifest의 blocking으로 계산하고
             숨겨진 방 입구 덤불(H)만 뺀다. 엔진은 이 레이어가 있으면 이 레이어를 따른다.
  objects    오브젝트(name = 오브젝트 ID, type = 종류, properties = 명세 §4의 속성)
"""
from __future__ import annotations

import json
import sys
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "assets" / "manifest.json"
OUT = ROOT / "content" / "regions" / "r01-echo-village" / "map.tmj"
TILESET = "overworld"
TS = 16

# ── 도면 ──────────────────────────────────────────────────────────────
# 1 우물가(남서) → 2 마을 광장(북서) → 3 상점 거리(북쪽 가운데) → 4 메아리 골목(북동)
# → 5 시계탑 계단(남동) → 동쪽 문. 구역 출구는 한 칸짜리 길목이고 필수 몬스터(또는 gate_well)가 막는다.
MAP = r"""
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
T.rrrrr.TT.TT.rrrrrr.TTrrrrrrTrrrrrrrrT#######Z%%%%####T
T.rrrrr,l___l,rrrrrr,.TrrrrrrTrrrrrrrrT#######%%%%U####T
T.hwdwh*_____*hwwdwh*.ThwdwwhThwwdwwwhT#######%%%%%####T
T.___________________.Tl3:mKm*xmm:lxmmx#########H######T
Tl___*__________*_____6::::::::7:::::::#--4-N-----#---#T
T.__**____l____**___l.T::::::::x:::::::8----------Q---#T
T.___________________.TlmYm**lxxmml::xl#----------#---#T
T.__l___**___**___l__.TrrrrrrTrrrrr::TT#-E--------#---#T
T.___________________.TrrrrrrTrrrrr::TT#############--#T
Tf**ff**ff*5*ff**ff**fThwwwwhThwwwh::TT#rrrrrrrrrrr#--#T
T9___________________.TTTTTTTTTTTTT0,TT#rrrrrrrrrrr#--#T
T.__M_____l_____F____.TTTTTTTTTTTTTTTTT#hwwhhwwhhwh#--#T
T.___________________.TTTTTTTTTTTTTTTTT#rrrrrrrrrrr#--#T
T.**___2_______B___**.TTTTrrrrTTrrrrTTT#rrrrrrrrrrr#--#T
T.___________________.TTTThwwhTThwwhTTT#hwwhwwhwwhh#--#T
Tmm_x__________x_mm__.TTTT****TT****TTT#bbTbbTbbTbb#--#T
T.__l_____:____l_____.TTTTTTTTTTTTTTTTT#############--#T
T.,,______:________,,.TTTTTTTTTTTTTTTTT##---J---------#T
TfffffffffGffffffffTTTTTTTTTTTTTTTTTTTT##-------------#T
TT.,.....,:..,....TTTTTTTTTTTTTTTTTTTTT###R############T
T.rrrrr...:.rrrrr..TrrrrrTrrrTT*____l_____:_____l____*#T
T.rrrrr.,.:.rrrrr,.TrrrrrTrrrTT___________:___________#T
T.hwdwh.l.:.hwdwhl.ThwwwhThwhTT_______________________#T
T.,*@*....:...:....T*****T***TT:::rrrrrrCCCCCCCCrrrrrr#T
T..:!::::::::::.,..TTTTbTTTTbTT:::rrrrrrCCCCCCCCrrrrrr#T
T.T:....A.:...1...TTTTTTTTTTTTT:::hwwdwhCCCCCCCChwdwwh#T
T.T:..._______.,..TTTTTbTTTTbTT:::**l**TCCCCCCCCT**l**#T
T.T:...___~___..,.TTTTTTTTTTTTT:::TTTTTTCCCCCCCCTTTTTT#T
T.T:...l__W__l....TTTTbTTTTbTTT:::TbTTbTCCCCCCCCTbTTbT#T
T.T::::_______....TTTTTTTTTTTTT:::TTTTTTCCCCCCCCTTTTTT#T
T.T....*_____*,...TTTTTTbTTTTTTl::rrrrrrCCCCCCCCrrrrrr#T
T.T,..............TTTTTTTTTTTTT:::rrrrrrCCCCCCCCrrrrrr#T
T.TT***..TTT..***TTTTTbTTTTbTTT:::hwwwwhCCCCCCCChwwwwh#T
T.T.....~~~~.....TTTTTTTTTTTTTT::l######CCCCCCCC#######T
T.T,...~~~~~~...,TTTTTTTbTTTTTT:::######CCCDCCCC#######T
T.T....~~~~~~....TTTTTTTTTTTTTT:::SSSSSSSSSSSSVSXSSSSSOT
T.T,....~~~~....,TTTTTbTTTTbTTTTTT#####################T
T.TT..,.......,..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
T.TTT*****TT*****TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
"""

# 문자 → (타일 이름, 레이어)
TILES: dict[str, tuple[str, str]] = {
    ".": ("grass", "ground"),
    ",": ("grass_flower", "ground"),
    ":": ("path", "ground"),
    "_": ("plaza_stone", "ground"),
    "~": ("water", "ground"),
    "W": ("well", "deco"),
    "T": ("tree", "deco"),
    "b": ("bush", "deco"),
    "H": ("bush", "deco"),  # 숨겨진 방 입구: 덤불로 보이지만 지나갈 수 있다
    "h": ("house_wall", "ground"),
    "r": ("house_roof", "ground"),
    "d": ("house_door", "ground"),
    "w": ("house_window", "ground"),
    "f": ("fence", "deco"),
    "#": ("wall_stone", "ground"),
    "=": ("floor_wood", "ground"),
    "-": ("floor_stone", "ground"),
    "S": ("stairs", "ground"),
    "C": ("clocktower_wall", "ground"),
    "D": ("clocktower_door", "ground"),
    "l": ("lamp_post", "deco"),
    "x": ("crate", "deco"),
    "m": ("market_stall", "deco"),
    "*": ("flower_bed", "deco"),
    "%": ("dark_floor", "ground"),
}
PASSABLE_OVERRIDE = {"H"}
# 데코·오브젝트 밑에 깔 바닥을 이웃에서 고를 때 후보가 되는 바닥 타일
FLOORS = {"grass", "path", "plaza_stone", "floor_wood", "floor_stone", "dark_floor", "stairs"}

# 문자 → (오브젝트 ID, 종류, 속성, 밑바닥 강제(선택))
OBJECTS: dict[str, tuple[str, str, dict, str | None]] = {
    # 1 우물가
    "@": ("spawn", "spawn", {}, None),
    "!": ("t_prologue", "trigger", {"dialogue": "prologue", "once": True, "joinCompanion": True}, None),
    "1": ("rune_L1-1", "rune", {"lesson": "L1-1"}, None),
    "A": ("sign_well", "sign", {"dialogue": "sign_well"}, None),
    "G": ("gate_well", "door", {"requires": "lesson:L1-1", "lockedDialogue": "gate_well_locked"}, "path"),
    # 2 마을 광장
    "2": ("rune_L1-2", "rune", {"lesson": "L1-2"}, None),
    "B": ("sign_plaza", "sign", {"dialogue": "sign_plaza"}, None),
    "M": ("npc_frozen_merchant", "npc", {"dialogue": "npc_frozen_merchant", "sprite": "npc_merchant"}, None),
    "F": ("campfire_plaza", "campfire", {}, None),
    "5": ("m_P0101", "monster", {"problem": "P0101"}, None),
    "6": ("m_P0106", "monster", {"problem": "P0106"}, None),
    "9": ("m_P0109", "monster", {"problem": "P0109"}, None),
    # 3 상점 거리
    "3": ("rune_L1-3", "rune", {"lesson": "L1-3"}, None),
    "K": ("npc_shopkeeper", "npc", {"dialogue": "npc_shopkeeper", "sprite": "npc_villager"}, None),
    "Y": ("chest_shop", "chest", {"gold": 30, "dialogue": "chest_shop"}, None),
    "7": ("m_P0102", "monster", {"problem": "P0102"}, None),
    "8": ("m_P0103", "monster", {"problem": "P0103"}, "path"),
    "0": ("m_P0108", "monster", {"problem": "P0108"}, None),
    # 4 메아리 골목
    "4": ("rune_L1-4", "rune", {"lesson": "L1-4"}, None),
    "E": ("sign_alley_riddle", "sign", {"dialogue": "sign_alley_riddle"}, None),
    "N": ("npc_echo_child", "npc", {"dialogue": "npc_echo_child", "sprite": "npc_child"}, None),
    "J": ("campfire_alley", "campfire", {}, None),
    "Q": ("m_P0104", "monster", {"problem": "P0104"}, None),
    "R": ("m_P0107", "monster", {"problem": "P0107"}, "floor_stone"),
    "Z": ("chest_hidden", "chest", {"gold": 50, "dialogue": "chest_hidden"}, None),
    "U": ("m_P0110", "monster", {"problem": "P0110"}, None),
    # 5 시계탑 계단
    "V": ("t_boss_intro", "trigger", {"dialogue": "boss_intro", "once": True}, None),
    "X": ("m_P0105", "monster", {"problem": "P0105"}, None),
    "O": (
        "warp_east",
        "warp",
        {
            "lockedDialogue": "east_gate_locked",
            "requires": "problem:P0105",
            "openDialogue": "to_be_continued",
            # 지역 간 이동(docs/phase3/region02-spec.md §4)
            "target": "r02",
            "targetSpawn": "spawn_west",
        },
        "floor_stone",
    ),
}

# 진행 순서 검증: (이 단계에서 제거하는 오브젝트, 이 단계에서 닿아야 하는 것, 아직 닿으면 안 되는 것)
STAGES: list[tuple[str | None, list[str], list[str]]] = [
    (None, ["t_prologue", "rune_L1-1", "sign_well", "gate_well"], ["rune_L1-2", "m_P0101"]),
    ("gate_well", ["rune_L1-2", "sign_plaza", "npc_frozen_merchant", "campfire_plaza", "m_P0109", "m_P0101"], ["m_P0106"]),
    ("m_P0101", ["m_P0106"], ["rune_L1-3"]),
    ("m_P0106", ["rune_L1-3", "npc_shopkeeper", "chest_shop", "m_P0102"], ["m_P0103", "m_P0108"]),
    ("m_P0102", ["m_P0103", "m_P0108"], ["rune_L1-4"]),
    ("m_P0103", ["rune_L1-4", "sign_alley_riddle", "npc_echo_child", "m_P0104", "chest_hidden", "m_P0110"], ["campfire_alley", "m_P0107"]),
    ("m_P0104", ["campfire_alley", "m_P0107"], ["t_boss_intro", "m_P0105"]),
    ("m_P0107", ["t_boss_intro", "m_P0105"], ["warp_east"]),
    ("m_P0105", ["warp_east"], []),
]
OPTIONAL = {"m_P0109", "m_P0108", "m_P0110"}
NON_BLOCKING = {"trigger", "spawn"}


def parse_rows() -> list[str]:
    rows = [r for r in MAP.strip("\n").split("\n")]
    width = len(rows[0])
    for y, r in enumerate(rows):
        if len(r) != width:
            raise SystemExit(f"row {y}: length {len(r)} != {width}")
        for x, ch in enumerate(r):
            if ch not in TILES and ch not in OBJECTS:
                raise SystemExit(f"unknown char {ch!r} at ({x},{y})")
    return rows


def neighbor_floor(rows: list[str], x: int, y: int) -> str:
    """오브젝트·데코 밑에 깔 바닥: 이웃 8칸에서 가장 많은 바닥 타일."""
    counts: dict[str, int] = {}
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            nx, ny = x + dx, y + dy
            if 0 <= ny < len(rows) and 0 <= nx < len(rows[0]):
                ch = rows[ny][nx]
                if ch in TILES:
                    name, layer = TILES[ch]
                    if name == "grass_flower":
                        name = "grass"
                    if layer == "ground" and name in FLOORS:
                        w = 2 if dx == 0 or dy == 0 else 1
                        counts[name] = counts.get(name, 0) + w
    if not counts:
        return "grass"
    return max(sorted(counts), key=lambda k: counts[k])


def build(manifest: dict) -> tuple[dict, list[str], dict]:
    ts = manifest["tilesets"][TILESET]
    names: list[str] = ts["tiles"]
    blocking = set(ts["blocking"])
    rows = parse_rows()
    h, w = len(rows), len(rows[0])
    gid = {n: i + 1 for i, n in enumerate(names)}

    ground = [0] * (w * h)
    deco = [0] * (w * h)
    collision = [0] * (w * h)
    objects: list[dict] = []
    seen: set[str] = set()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            i = y * w + x
            if ch in OBJECTS:
                oid, otype, props, under = OBJECTS[ch]
                if oid in seen:
                    raise SystemExit(f"duplicate object {oid}")
                seen.add(oid)
                ground[i] = gid[under or neighbor_floor(rows, x, y)]
                objects.append(
                    {
                        "id": len(objects) + 1,
                        "name": oid,
                        "type": otype,
                        "x": x * TS,
                        "y": y * TS,
                        "width": TS,
                        "height": TS,
                        "rotation": 0,
                        "visible": True,
                        "properties": [prop(k, v) for k, v in props.items()],
                    }
                )
                continue
            name, layer = TILES[ch]
            if layer == "ground":
                ground[i] = gid[name]
            else:
                # 나무·덤불은 늘 풀밭 위에, 나머지 데코는 주변 바닥 위에 놓는다
                under = "grass" if name in ("tree", "bush") and ch != "H" else neighbor_floor(rows, x, y)
                ground[i] = gid[under]
                deco[i] = gid[name]
            if ch not in PASSABLE_OVERRIDE and name in blocking:
                collision[i] = gid[name]
    missing = [v[0] for v in OBJECTS.values() if v[0] not in seen]
    if missing:
        raise SystemExit(f"objects not placed: {missing}")

    def layer(lid: int, name: str, data: list[int], visible: bool = True) -> dict:
        return {
            "id": lid,
            "name": name,
            "type": "tilelayer",
            "x": 0,
            "y": 0,
            "width": w,
            "height": h,
            "opacity": 1,
            "visible": visible,
            "data": data,
        }

    tmj = {
        "type": "map",
        "version": "1.10",
        "tiledversion": "1.11.2",
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "infinite": False,
        "width": w,
        "height": h,
        "tilewidth": TS,
        "tileheight": TS,
        "compressionlevel": -1,
        "nextlayerid": 5,
        "nextobjectid": len(objects) + 1,
        "properties": [prop("region", "r01")],
        "tilesets": [
            {
                "firstgid": 1,
                "name": TILESET,
                # 엔진은 이 경로를 쓰지 않고 assets/manifest.json의 같은 이름 타일셋을 쓴다(Tiled 편집기용)
                "image": "../../../assets/" + ts["file"],
                "imagewidth": ts["columns"] * TS,
                "imageheight": -(-len(names) // ts["columns"]) * TS,
                "tilewidth": TS,
                "tileheight": TS,
                "tilecount": len(names),
                "columns": ts["columns"],
                "margin": 0,
                "spacing": 0,
                "tiles": [
                    {"id": i, "type": n, "properties": [prop("blocking", n in blocking)]} for i, n in enumerate(names)
                ],
            }
        ],
        "layers": [
            layer(1, "ground", ground),
            layer(2, "deco", deco),
            layer(3, "collision", collision, visible=False),
            {
                "id": 4,
                "name": "objects",
                "type": "objectgroup",
                "draworder": "topdown",
                "x": 0,
                "y": 0,
                "opacity": 1,
                "visible": True,
                "objects": objects,
            },
        ],
    }
    pos = {o["name"]: (o["x"] // TS, o["y"] // TS) for o in objects}
    return tmj, rows, {"pos": pos, "objects": objects, "collision": collision, "w": w, "h": h}


def prop(name: str, value) -> dict:
    t = "bool" if isinstance(value, bool) else "int" if isinstance(value, int) else "string"
    return {"name": name, "type": t, "value": value}


def reachable(info: dict, removed: set[str], extra_block: set[tuple[int, int]] = frozenset()) -> set[tuple[int, int]]:
    w, h = info["w"], info["h"]
    blocked = {(i % w, i // w) for i, v in enumerate(info["collision"]) if v}
    for o in info["objects"]:
        if o["type"] not in NON_BLOCKING and o["name"] not in removed:
            blocked.add(info["pos"][o["name"]])
    blocked |= set(extra_block)
    start = info["pos"]["spawn"]
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < w and 0 <= n[1] < h and n not in blocked and n not in seen:
                seen.add(n)
                q.append(n)
    return seen


def touches(info: dict, area: set, oid: str) -> bool:
    x, y = info["pos"][oid]
    if (x, y) in area:
        return True
    return any((x + dx, y + dy) in area for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))


def validate(info: dict, verbose: bool) -> list[str]:
    errors: list[str] = []
    removed: set[str] = set()
    for k, (remove, must, must_not) in enumerate(STAGES):
        if remove:
            removed.add(remove)
        area = reachable(info, removed)
        for oid in must:
            if not touches(info, area, oid):
                errors.append(f"after removing {remove}: {oid} should be reachable")
        # 뒤 단계의 오브젝트는 전부 아직 닿으면 안 된다
        later = set(must_not) | {o for _, m, _ in STAGES[k + 1 :] for o in m}
        for oid in sorted(later):
            if touches(info, area, oid):
                errors.append(f"after removing {remove}: {oid} should NOT be reachable yet")
        if verbose:
            print(f"  stage remove={remove}: {len(area)} tiles reachable")
    if removed & OPTIONAL:
        errors.append("optional monsters must not be needed on the main path")

    pos = info["pos"]
    sx, sy = pos["spawn"]
    if abs(pos["t_prologue"][0] - sx) + abs(pos["t_prologue"][1] - sy) != 1:
        errors.append("t_prologue must be next to spawn")
    # 프롤로그 트리거를 밟지 않고는 시작 지점을 벗어날 수 없어야 한다
    if touches(info, reachable(info, set(), {pos["t_prologue"]}), "rune_L1-1"):
        errors.append("t_prologue can be bypassed")
    bx, by = pos["m_P0105"]
    tx, ty = pos["t_boss_intro"]
    if abs(bx - tx) + abs(by - ty) != 2:
        errors.append("t_boss_intro must be two tiles in front of the boss")
    pre_boss = set(STAGES[i][0] for i in range(1, 8))
    if touches(info, reachable(info, pre_boss, {pos["t_boss_intro"]}), "m_P0105"):
        errors.append("t_boss_intro can be bypassed")
    # 숨겨진 방: 표지판에서 동쪽 7칸(len('serpent')), 북쪽 4칸(2 ** 2)
    ex, ey = pos["sign_alley_riddle"]
    hx, hy = ex + len("serpent"), ey - 2**2
    w = info["w"]
    if MAP_ROWS[hy][hx] != "H" or info["collision"][hy * w + hx] != 0:
        errors.append(f"hidden bush must be passable at ({hx},{hy})")
    alley = set(STAGES[i][0] for i in range(1, 6))
    if touches(info, reachable(info, alley, {(hx, hy)}), "chest_hidden"):
        errors.append("hidden room reachable without the hidden bush")
    return errors


MAP_ROWS: list[str] = []


def dump(tmj: dict, width: int) -> str:
    """JSON으로 쓰되 타일 데이터는 맵 한 줄을 한 줄로 쓴다(diff를 읽기 쉽게)."""
    rows: dict[str, str] = {}
    for layer in tmj["layers"]:
        if "data" in layer:
            key = f"@@{layer['name']}@@"
            d = layer["data"]
            lines = [",".join(str(v) for v in d[i : i + width]) for i in range(0, len(d), width)]
            rows[key] = "[\n   " + ",\n   ".join(lines) + "\n  ]"
            layer["data"] = key
    text = json.dumps(tmj, ensure_ascii=False, indent=1)
    for key, val in rows.items():
        text = text.replace(f'"{key}"', val)
    return text + "\n"


def main() -> int:
    args = set(sys.argv[1:])
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    tmj, rows, info = build(manifest)
    MAP_ROWS[:] = rows
    if "--print" in args:
        print("\n".join(rows))
        print(f"size {info['w']}x{info['h']}, objects {len(info['objects'])}")
    errors = validate(info, "--print" in args)
    if errors:
        for e in errors:
            print("ERROR:", e, file=sys.stderr)
        return 1
    text = dump(tmj, info["w"])
    if "--check" in args:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print("map.tmj is out of date; run tools/maps/build_r01.py", file=sys.stderr)
            return 1
        print("map.tmj OK")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({info['w']}x{info['h']}, {len(info['objects'])} objects)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
