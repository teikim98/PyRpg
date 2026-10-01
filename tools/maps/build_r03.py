#!/usr/bin/env python3
"""지역 3(고블린 동굴) 맵 생성기: 아스키 도면 → Tiled JSON(.tmj).

사용법: python3 tools/maps/build_r03.py [--check] [--print]
  --check  파일을 쓰지 않고 검증만 한다(현재 map.tmj와 내용이 다르면 실패)
  --print  도면과 단계별 도달 범위를 출력한다

명세: docs/phase3/region03-spec.md §4. 레이어·검증 도구는 tools/maps/common.py에 있다.
구역은 서 → 동으로 이어지고(도면은 구역별 블록을 가로로 이어 붙인 것), 구역 출구는 한 칸짜리 길목이며
필수 몬스터가 막는다.

벽은 도면에 '#' 하나로 적고, 바로 아래 칸이 벽이 아니면 앞면(cave_wall), 벽이면 윗면(cave_wall_top)으로 바꾼다.
벽 앞면 변형(횃불 f, 벽화 M, 바위 틈 %)은 앞면 자리(아래 칸이 벽이 아닌 곳)에만 둔다.

  1 동굴 입구    warp_west·spawn_west·t_cave_intro가 1칸 통로에 나란히 있다(트리거는 피할 수 없음).
                 입구 굴(rune_L3-1, campfire_entrance) → 길목 m_P0301 → 안쪽 굴(북쪽 막다른 굴 끝에 선택 m_P0303)
                 → 출구 m_P0302
  2 갈림 굴      굴이 갈라지는 곳에 sign_tunnels. 북쪽 굴은 막다른 길(끝에 선택 m_P0305), 가운데 굴에 rune_L3-2,
                 광차 레일이 깔린 동쪽 굴 끝이 출구 m_P0304
  3 보물 창고    창고로 들어가는 1칸 통로 북쪽 벽감에 rune_L3-3(길목 몬스터가 이 주문서를 요구하므로 길목 앞) →
                 길목 m_P0306 → 금화 더미가 줄지어(선반처럼) 쌓인 창고. 고블린 서기,
                 chest_storeroom, 남서쪽 쉼터에 board_shadow_r03 + campfire_storeroom. 출구 m_P0307
  4 거울 웅덩이  가운데 큰 웅덩이를 돌아 rune_L3-4, 출구 m_P0308.
                 숨겨진 길: 북쪽 벽 앞면의 두 얼어붙은 횃불 한가운데(웅덩이 한가운데의 바로 북쪽)에 지나갈 수 있는
                 바위 틈(cave_crack) 하나가 있다. 그 너머 좁은 굴 끝에 chest_hidden_pool과 선택 m_P0309.
                 이 틈이 그 굴의 유일한 입구다.
  5 벽화의 방    북쪽 벽에 바랜 벽화(mural_wall), 그 앞에 sign_mural, rune_L3-5. 동쪽 1칸 통로:
                 m_P0310 → t_boss_intro → 빈칸 → (6구역) 보스(트리거는 보스 두 칸 앞, 피할 수 없음)
  6 족장의 왕좌  1칸 통로를 막은 보스 m_P0311 뒤로 보물이 쌓인 왕좌의 방, 동쪽 끝에 warp_east
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (  # noqa: E402
    D4,
    ROOT,
    RegionSpec,
    reachable,
    removed_before,
    run,
    touches,
    validate_stages,
)

REGION_DIR = ROOT / "content" / "regions" / "r03-goblin-cave"
OUT = REGION_DIR / "map.tmj"
H = 24

# ── 도면(구역별 블록, 높이 24. 비어 있는 아래쪽 줄은 벽으로 채운다) ──────────────────
ZONE1 = r"""
##################
##################
##################
#############j####
#############.####
#############.####
###f###f#####.#f##
###.......#......#
###.*.....#..b...#
###...1...#......#
###.......#....r.#
<@!.......i......#
###.......#......#
###..F....#.$....#
###.......#......k
###r...*..#.....b#
"""

ZONE2 = r"""
##################
##################
##################
##################
##################
##f#####f#########
##..........n*####
##.###############
##.###f#####f#####
##.##.........####
##.##..*...2..####
##...........====p
#f..S..b......####
#.....####...r####
====..####....####
#.....####.$..####
"""

ZONE3 = r"""
####################
####################
####################
####################
####f####f####f#####
###...............C#
###.$$$$..$$$$..$$.#
###.......N........#
###.$$$$..$$$$..$$.#
###................#
3##.====.==========#
..l................#
###.$$$$..$$$$..$$.#
###................o
###.B.....r.....b..#
###..G.............#
"""

ZONE4 = r"""
##################
##################
##################
##u.D...##########
##*.......########
#########.########
####f####%####f###
###.............##
###...~~~~~~~...##
###..~~~~~~~~~..##
###.4~~~~~~~~~...s
###..~~~~~~~~~..##
###...~~~~~~~...##
...............*##
###..b.......r..##
"""

ZONE5 = r"""
################
################
################
################
################
##f#MMMMMM#f####
##..........####
##....A.....####
##..*.....5.####
##..........####
............####
##..b.......####
##...........vV.
##..........####
"""

ZONE6 = r"""
###############
###############
###############
###############
###############
###f######f####
###.$$..$$.####
##..........###
##.b......b.###
##..........###
##..$....$..###
#...........###
X............>#
#...........###
##..........###
##$$......$$###
"""

ZONES = [ZONE1, ZONE2, ZONE3, ZONE4, ZONE5, ZONE6]
WALLISH = set("#TWfM%")


def _block(text: str, k: int) -> list[str]:
    rows = text.strip("\n").split("\n")
    w = len(rows[0])
    if len({len(r) for r in rows}) != 1:
        raise SystemExit(f"zone {k + 1}: rows have different widths")
    if len(rows) > H:
        raise SystemExit(f"zone {k + 1}: {len(rows)} rows, at most {H}")
    return rows + ["#" * w] * (H - len(rows))


def _walls(rows: list[str]) -> list[str]:
    """'#' → 바로 아래가 벽이 아니면 앞면 W, 벽(또는 맵 밖)이면 윗면 T."""
    out = []
    for y, r in enumerate(rows):
        line = []
        for x, ch in enumerate(r):
            if ch == "#":
                below = rows[y + 1][x] if y + 1 < len(rows) else "#"
                ch = "T" if below in WALLISH else "W"
            line.append(ch)
        out.append("".join(line))
    return out


RAW = [_block(z, k) for k, z in enumerate(ZONES)]
ROWS = _walls(["".join(b[y] for b in RAW) for y in range(H)])
MAP = "\n".join(ROWS)

# 문자 → (타일 이름, 레이어)
TILES: dict[str, tuple[str, str]] = {
    ".": ("cave_floor", "ground"),
    "=": ("minecart_rail", "ground"),
    "~": ("cave_pool", "ground"),
    "W": ("cave_wall", "ground"),
    "T": ("cave_wall_top", "ground"),
    "f": ("torch_frozen", "ground"),
    "M": ("mural_wall", "ground"),
    "%": ("cave_crack", "ground"),  # 숨겨진 길 입구: 벽 앞면처럼 보이지만 지나갈 수 있다(manifest에서 막힘 아님)
    "*": ("crystal", "deco"),
    "r": ("rubble", "deco"),
    "$": ("treasure_pile", "deco"),
    "b": ("bone_pile", "deco"),
}
FLOORS = {"cave_floor"}

# 문자 → (오브젝트 ID, 종류, 속성, 밑바닥 강제(선택))
OBJECTS = {
    # 1 동굴 입구
    "@": ("spawn_west", "spawn", {}, None),
    "<": ("warp_west", "warp", {"target": "r02", "targetSpawn": "warp_east"}, None),
    "!": ("t_cave_intro", "trigger", {"dialogue": "cave_intro", "once": True}, None),
    "1": ("rune_L3-1", "rune", {"lesson": "L3-1"}, None),
    "F": ("campfire_entrance", "campfire", {}, None),
    "i": ("m_P0301", "monster", {"problem": "P0301"}, None),
    "j": ("m_P0303", "monster", {"problem": "P0303"}, None),
    "k": ("m_P0302", "monster", {"problem": "P0302"}, None),
    # 2 갈림 굴
    "2": ("rune_L3-2", "rune", {"lesson": "L3-2"}, None),
    "S": ("sign_tunnels", "sign", {"dialogue": "sign_tunnels"}, None),
    "n": ("m_P0305", "monster", {"problem": "P0305"}, None),
    "p": ("m_P0304", "monster", {"problem": "P0304"}, None),
    # 3 보물 창고
    "3": ("rune_L3-3", "rune", {"lesson": "L3-3"}, None),
    "N": ("npc_goblin_clerk", "npc", {"dialogue": "npc_goblin_clerk", "sprite": "npc_goblin"}, None),
    "C": ("chest_storeroom", "chest", {"gold": 50, "dialogue": "chest_storeroom"}, None),
    # 창고 남서쪽 쉼터의 그림자 게시판과 캠프파이어(docs/phase3/plan.md §5.2)
    "B": ("board_shadow_r03", "board", {}, None),
    "G": ("campfire_storeroom", "campfire", {}, None),
    "l": ("m_P0306", "monster", {"problem": "P0306"}, None),
    "o": ("m_P0307", "monster", {"problem": "P0307"}, None),
    # 4 거울 웅덩이
    "4": ("rune_L3-4", "rune", {"lesson": "L3-4"}, None),
    "u": ("m_P0309", "monster", {"problem": "P0309"}, None),
    "D": ("chest_hidden_pool", "chest", {"gold": 70, "dialogue": "chest_hidden_pool"}, None),
    "s": ("m_P0308", "monster", {"problem": "P0308"}, None),
    # 5 벽화의 방
    "5": ("rune_L3-5", "rune", {"lesson": "L3-5"}, None),
    "A": ("sign_mural", "sign", {"dialogue": "sign_mural"}, None),
    "v": ("m_P0310", "monster", {"problem": "P0310"}, None),
    "V": ("t_boss_intro", "trigger", {"dialogue": "boss_intro", "once": True}, None),
    # 6 족장의 왕좌
    "X": ("m_P0311", "monster", {"problem": "P0311"}, None),
    ">": (
        "warp_east",
        "warp",
        {"requires": "problem:P0311", "lockedDialogue": "east_gate_locked", "openDialogue": "to_be_continued"},
        None,
    ),
}

# 진행 순서 검증: (이 단계에서 제거하는 오브젝트, 이 단계에서 닿아야 하는 것, 아직 닿으면 안 되는 것)
STAGES: list[tuple[str | None, list[str], list[str]]] = [
    (None, ["warp_west", "t_cave_intro", "rune_L3-1", "campfire_entrance", "m_P0301"], []),
    ("m_P0301", ["m_P0303", "m_P0302"], []),
    ("m_P0302", ["rune_L3-2", "sign_tunnels", "m_P0305", "m_P0304"], []),
    ("m_P0304", ["rune_L3-3", "m_P0306"], []),
    ("m_P0306", ["npc_goblin_clerk", "chest_storeroom", "board_shadow_r03", "campfire_storeroom", "m_P0307"], []),
    ("m_P0307", ["rune_L3-4", "m_P0309", "chest_hidden_pool", "m_P0308"], []),
    ("m_P0308", ["rune_L3-5", "sign_mural", "m_P0310"], []),
    ("m_P0310", ["t_boss_intro", "m_P0311"], []),
    ("m_P0311", ["warp_east"], []),
]
OPTIONAL = {"m_P0303", "m_P0305", "m_P0309"}


def _deco_under(name: str, ch: str, rows: list[str], x: int, y: int) -> str:
    # 동굴 물체 타일은 동굴 바닥을 그림에 품고 있으므로 밑바닥도 동굴 바닥으로 맞춘다
    return "cave_floor"


SPEC = RegionSpec(
    region="r03",
    out=OUT,
    map_text=MAP,
    tiles=TILES,
    objects=OBJECTS,
    floors=FLOORS,
    deco_under=_deco_under,
    default_floor="cave_floor",
    start="spawn_west",
)


def zone_bounds() -> list[tuple[int, int]]:
    """구역별 x 범위 [시작, 끝)."""
    out, x = [], 0
    for z in ZONES:
        w = len(z.strip("\n").split("\n")[0])
        out.append((x, x + w))
        x += w
    return out


ZONE_OF = {  # 오브젝트 → 구역 번호(1부터), 명세 §4 표
    1: ["spawn_west", "warp_west", "t_cave_intro", "rune_L3-1", "campfire_entrance", "m_P0301", "m_P0303", "m_P0302"],
    2: ["rune_L3-2", "sign_tunnels", "m_P0305", "m_P0304"],
    3: ["rune_L3-3", "npc_goblin_clerk", "chest_storeroom", "board_shadow_r03", "campfire_storeroom", "m_P0306", "m_P0307"],
    4: ["rune_L3-4", "m_P0309", "chest_hidden_pool", "m_P0308"],
    5: ["rune_L3-5", "sign_mural", "m_P0310", "t_boss_intro"],
    6: ["m_P0311", "warp_east"],
}
# 1칸 길목을 막는 필수 몬스터(구역 출구 포함)
CHOKEPOINTS = ["m_P0301", "m_P0302", "m_P0304", "m_P0306", "m_P0307", "m_P0308", "m_P0310", "m_P0311"]
EDGE_EXITS = {"m_P0302": 1, "m_P0304": 2, "m_P0307": 3, "m_P0308": 4}


def validate(info: dict, verbose: bool) -> list[str]:
    errors = validate_stages(info, STAGES, OPTIONAL, verbose)
    pos = info["pos"]
    w, h = info["w"], info["h"]
    rows = info["rows"]
    names = info["names"]
    col = info["collision"]

    def dist(a: str, b: str) -> int:
        return abs(pos[a][0] - pos[b][0]) + abs(pos[a][1] - pos[b][1])

    def tile_at(x: int, y: int) -> str:
        return names[info["ground"][y * w + x] - 1]

    def open_cell(x: int, y: int) -> bool:
        return 0 <= x < w and 0 <= y < h and col[y * w + x] == 0

    # 구역: 오브젝트가 서 → 동 순서의 제 구역 블록 안에 있다
    bounds = zone_bounds()
    for z, ids in ZONE_OF.items():
        x0, x1 = bounds[z - 1]
        for oid in ids:
            if not x0 <= pos[oid][0] < x1:
                errors.append(f"{oid} should be in zone {z} (x {x0}..{x1 - 1}), at x={pos[oid][0]}")
    if sorted(o for ids in ZONE_OF.values() for o in ids) != sorted(pos):
        errors.append("ZONE_OF must list every object exactly once")
    # 필수 몬스터는 1칸 길목에 선다: 열린 이웃이 정확히 둘이고 서로 마주 본다(동서 또는 남북)
    for oid in CHOKEPOINTS:
        x, y = pos[oid]
        nb = [(dx, dy) for dx, dy in D4 if open_cell(x + dx, y + dy)]
        if sorted(nb) not in ([(-1, 0), (1, 0)], [(0, -1), (0, 1)]):
            errors.append(f"{oid} should block a 1-tile chokepoint (open neighbours {nb})")
    # 구역 출구 몬스터는 다음 구역과 맞닿은 동쪽 가장자리에 있다
    for oid, z in EDGE_EXITS.items():
        if pos[oid][0] != bounds[z - 1][1] - 1:
            errors.append(f"{oid} should stand at the east edge of zone {z}")
    # 서쪽 시작: spawn 옆에 트리거, 트리거를 밟지 않고는 동굴로 들어갈 수 없다
    if dist("spawn_west", "t_cave_intro") != 1:
        errors.append("t_cave_intro must be next to spawn_west")
    if touches(info, reachable(info, set(), {pos["t_cave_intro"]}), "rune_L3-1"):
        errors.append("t_cave_intro can be bypassed")
    if dist("spawn_west", "warp_west") > 2:
        errors.append("warp_west must be near spawn_west")
    if pos["warp_west"][0] > 1:
        errors.append("warp_west must be at the far west")
    if pos["warp_east"][0] < w - 3:
        errors.append("warp_east must be at the far east")
    # 보스 앞 트리거: 두 칸 앞, 피할 수 없음
    if dist("m_P0311", "t_boss_intro") != 2:
        errors.append("t_boss_intro must be two tiles in front of the boss")
    pre_boss = removed_before(STAGES, "m_P0311")
    if touches(info, reachable(info, pre_boss, {pos["t_boss_intro"]}), "m_P0311"):
        errors.append("t_boss_intro can be bypassed")
    # 쉼터: 그림자 게시판과 캠프파이어가 보물 창고에 나란히(3칸 이내) 있고, 창고 길목(m_P0306)을 지나야 닿는다
    if dist("board_shadow_r03", "campfire_storeroom") > 3:
        errors.append("board_shadow_r03 should stand next to campfire_storeroom (within 3 tiles)")
    for oid in ("board_shadow_r03", "campfire_storeroom"):
        if touches(info, reachable(info, removed_before(STAGES, "m_P0306") - {"m_P0306"}), oid):
            errors.append(f"{oid} reachable before m_P0306")
    # 벽 앞면 변형(횃불·벽화·틈)은 앞면 자리에만: 아래 칸이 벽이 아니다
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in "fM%" and (y + 1 >= h or rows[y + 1][x] in WALLISH):
                errors.append(f"wall-face tile {ch!r} at ({x},{y}) must have open floor below")
    # 숨겨진 길: 바위 틈은 하나뿐, 거울 웅덩이 구역의 북쪽 벽 앞면에 있고 지나갈 수 있으며,
    # 두 얼어붙은 횃불의 한가운데(같은 줄, 양쪽 같은 거리)에 있다(서기·표지판 대사의 귀띔)
    cracks = [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == "%"]
    if len(cracks) != 1:
        errors.append("exactly one cave_crack expected")
        return errors
    cx, cy = cracks[0]
    if tile_at(cx, cy) != "cave_crack" or col[cy * w + cx] != 0:
        errors.append(f"cave_crack at ({cx},{cy}) must be a passable cave_crack tile")
    if not bounds[3][0] <= cx < bounds[3][1]:
        errors.append("cave_crack must be in the mirror-pool zone")
    if not (open_cell(cx, cy - 1) and open_cell(cx, cy + 1)) or open_cell(cx - 1, cy) or open_cell(cx + 1, cy):
        errors.append("cave_crack must be a north-south gap in a wall line")
    torches = sorted(x for x, ch in enumerate(rows[cy]) if ch == "f" and bounds[3][0] <= x < bounds[3][1])
    if len(torches) != 2 or cx - torches[0] != torches[1] - cx:
        errors.append("cave_crack should sit exactly between the two frozen torches of its wall")
    if not any(rows[cy + 2][x] == "~" for x in range(w)) or cy >= min(y for y, r in enumerate(rows) if "~" in r):
        errors.append("cave_crack should be in the wall north of the mirror pool")
    pool_xs = sorted(x for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == "~")
    if cx != (pool_xs[0] + pool_xs[-1]) // 2:
        errors.append("cave_crack should be straight north of the pool's middle")
    hidden = removed_before(STAGES, "chest_hidden_pool")
    closed = reachable(info, hidden, {(cx, cy)})
    for oid in ("chest_hidden_pool", "m_P0309"):
        if touches(info, closed, oid):
            errors.append(f"{oid} reachable without the cave crack")
    if not touches(info, closed, "m_P0308"):
        errors.append("the rest of the mirror-pool zone should not need the crack")
    # 몬스터가 요구하는 이 지역 주문서의 비석은 그 몬스터보다 먼저(몬스터를 치우기 전에) 닿아야 한다.
    # 아니면 주문서 없이 길목에 막혀 진행할 수 없다(need_scroll)
    rune_of = {}
    for lj in sorted((REGION_DIR / "lessons").glob("*/lesson.json")):
        lesson = json.loads(lj.read_text(encoding="utf-8"))
        rune_of[lesson["scroll"]["id"]] = f"rune_{lesson['id']}"
    for o in info["objects"]:
        if o["type"] != "monster":
            continue
        oid = o["name"]
        pid = next(p["value"] for p in o.get("properties", []) if p["name"] == "problem")
        problem = json.loads((REGION_DIR / "problems" / pid / "problem.json").read_text(encoding="utf-8"))
        area = reachable(info, removed_before(STAGES, oid) - {oid})
        for scroll in problem.get("requires", []):
            rune = rune_of.get(scroll)
            if rune and not touches(info, area, rune):
                errors.append(f"{oid} needs {scroll}, but {rune} is not reachable before {oid}")
    # 바닥이 비지 않았다
    if any(v == 0 for v in info["ground"]):
        errors.append("ground layer has empty tiles")
    if h != H:
        errors.append(f"map height should be {H}")
    return errors


if __name__ == "__main__":
    sys.exit(run(SPEC, validate, "tools/maps/build_r03.py"))
