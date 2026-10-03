#!/usr/bin/env python3
"""지역 4(무너진 대도서관) 맵 생성기: 아스키 도면 → Tiled JSON(.tmj).

사용법: python3 tools/maps/build_r04.py [--check] [--print]
  --check  파일을 쓰지 않고 검증만 한다(현재 map.tmj와 내용이 다르면 실패)
  --print  도면과 단계별 도달 범위를 출력한다

명세: docs/phase3/region04-spec.md §4. 레이어·검증 도구는 tools/maps/common.py에 있다.
구역은 서 → 동으로 이어지고(도면은 구역별 블록을 가로로 이어 붙인 것), 구역 출구는 한 칸짜리 길목이며
필수 몬스터가 막는다.

벽은 도면에 '#' 하나로 적고, 바로 아래 칸이 벽(또는 책장)이 아니면 앞면(lib_wall), 아니면 윗면(lib_wall_top)으로
바꾼다. 벽 줄 사이사이의 'B'는 벽에 붙여 세운 책장이다.

  1 정문 홀      warp_west·spawn_west·t_library_intro가 1칸 통로에 나란히 있다(트리거는 피할 수 없음).
                 카펫 깔린 바깥 홀(기둥 넷, rune_L4-1, 꺼지지 않는 화로 campfire_hall) → 길목 m_P0401 →
                 안쪽 홀(북쪽 책장 사이 막다른 통로 끝에 선택 m_P0403) → 출구 m_P0402
  2 열람실       열람 책상이 줄지어 선 넓은 방. 입구 옆에 유령 사서와 board_shadow_r04, 카펫 통로,
                 남쪽 책상 줄에 rune_L4-2, 남서쪽 1칸 벽감 끝에 선택 m_P0405, 동쪽 출구 m_P0404
  3 서고 미로    작은 앞방(rune_L4-3, sign_stacks) → 길목 m_P0406 → 책장이 줄지어 선 미로 → 출구 m_P0407.
                 숨겨진 길: 미로 북쪽 책장 벽에 지나갈 수 있는 빈 책장 칸(shelf_gap) 하나. 바로 앞(남쪽) 두 칸에
                 떠 있는 페이지가 모여 있고(틈으로 새는 바람에 끌려온 것), 그 너머 작은 서고에 chest_hidden_stacks.
                 이 칸이 그 서고의 유일한 입구다
  4 필사실       서쪽 방: rune_L4-4, 길목 바로 앞 필수 경로 옆에 chest_archivist(기록관의 안경) → 길목 m_P0408 →
                 동쪽 필사실(필사 책상 줄, 보스 전 마지막 쉼터 campfire_scriptorium) → 출구 m_P0409
  5 봉인 서고    봉인된 책장 앞 sign_sealed_record, 남서쪽 1칸 벽감 끝에 선택 m_P0410.
                 동쪽 1칸 통로: t_boss_intro → 빈칸 → (6구역) 보스(트리거는 보스 두 칸 앞, 피할 수 없음)
  6 골렘의 열람대 1칸 통로를 막은 보스 m_P0411 뒤로 카펫 깔린 열람대 방, 동쪽 끝에 warp_east(교역항으로)
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (  # noqa: E402
    D4,
    ROOT,
    RegionSpec,
    check_runes_before_monsters,
    reachable,
    removed_before,
    run,
    touches,
    validate_stages,
)

REGION_DIR = ROOT / "content" / "regions" / "r04-grand-library"
OUT = REGION_DIR / "map.tmj"
H = 24

# ── 도면(구역별 블록, 높이 24. 비어 있는 아래쪽 줄은 벽으로 채운다) ──────────────────
ZONE1 = r"""
####################
####################
####################
################j###
################.###
################~###
###BBB#BBB#B#BBB.BB#
###.........#......#
###.P..1..P.#..b...#
###.........#......#
###=========#....d.#
<@!=========i......#
###=========#......#
###.........#..c...k
###.P..C..P.#......#
###.........#.F....#
###b.c...c.b#......#
"""

ZONE2 = r"""
##################
##################
##################
##################
##################
##BBB#BBBBB#BBB###
##c.............c#
##..d.d.~..d.d...#
##...............#
##..d.d....d.d...o
##...............#
##...............#
##G===========...#
..============...#
##O===========...#
##...............#
##..d.d..2.d.d...#
##...............#
##.b..~......c..F#
##c.............c#
####.#############
####n#############
"""

ZONE3 = r"""
######################
######################
######################
######################
##############.H.#####
##############...#####
######BBBBBBBBBgBBBB##
#3...S#.....B..~B...##
#.....#.BBB.B.B~B.B.##
......l.B...B.B...B.##
#.....#.B.BBB.BBB.B.##
#..b..#...B.......B.##
#######BB.B.BBBBB.B.##
#######...B.B...B...##
#######.BBB.B.B.BBB.##
#######.....B.B.....##
#######.BBBBB.BBBBB.##
#######..............m
#######c.....P.....c##
"""

ZONE4 = r"""
##################
##################
##################
##################
##################
##################
##################
#########BB#BBBB##
#########........#
#########.d.d.d..#
#########........s
####BBB##.d.d.d..#
#.......#..~.....#
#.4.....#.d.d.d..#
#.......#........#
#.c...c.#...Q....#
#.....A.#........#
........q........#
#.......#.d.d.d..#
#b.....b#..c...c.#
"""

ZONE5 = r"""
############
############
############
############
############
############
############
#BBBB#BBBB##
#....R....##
#.c.....c.##
..........##
#..~...P..##
#.........V.
#.F.....b.##
#.##########
#u##########
"""

ZONE6 = r"""
#############
#############
#############
#############
#############
#############
#############
###B#BBB#B###
##.........##
##.P.....P.##
##....d....##
#..........##
X..========>#
#..........##
##.P.....P.##
##c.......c##
"""

ZONES = [ZONE1, ZONE2, ZONE3, ZONE4, ZONE5, ZONE6]
# 아래 칸이 이것이면 '#'는 윗면(T)이 된다. 벽에 붙인 책장(B)과 빈 책장 칸(g)도 벽처럼 본다
WALLISH = set("#TWBg")


def _block(text: str, k: int) -> list[str]:
    rows = text.strip("\n").split("\n")
    w = len(rows[0])
    if len({len(r) for r in rows}) != 1:
        raise SystemExit(f"zone {k + 1}: rows have different widths")
    if len(rows) > H:
        raise SystemExit(f"zone {k + 1}: {len(rows)} rows, at most {H}")
    return rows + ["#" * w] * (H - len(rows))


def _walls(rows: list[str]) -> list[str]:
    """'#' → 바로 아래가 벽·책장이 아니면 앞면 W, 벽·책장(또는 맵 밖)이면 윗면 T."""
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
    ".": ("lib_floor", "ground"),
    "=": ("lib_carpet", "ground"),
    "~": ("floating_pages", "ground"),
    "W": ("lib_wall", "ground"),
    "T": ("lib_wall_top", "ground"),
    "B": ("bookshelf", "ground"),
    "g": ("shelf_gap", "ground"),  # 숨겨진 길 입구: 책장처럼 보이지만 지나갈 수 있다(manifest에서 막힘 아님)
    "F": ("bookshelf_fallen", "deco"),
    "b": ("book_pile", "deco"),
    "d": ("reading_desk", "deco"),
    "c": ("candle_frozen", "deco"),
    "P": ("broken_pillar", "deco"),
}
FLOORS = {"lib_floor", "lib_carpet"}

# 문자 → (오브젝트 ID, 종류, 속성, 밑바닥 강제(선택))
OBJECTS = {
    # 1 정문 홀
    "@": ("spawn_west", "spawn", {}, "lib_floor"),
    "<": ("warp_west", "warp", {"target": "r03", "targetSpawn": "warp_east"}, "lib_floor"),
    "!": ("t_library_intro", "trigger", {"dialogue": "library_intro", "once": True}, "lib_floor"),
    "1": ("rune_L4-1", "rune", {"lesson": "L4-1"}, None),
    "C": ("campfire_hall", "campfire", {}, None),  # 꺼지지 않는 화로
    "i": ("m_P0401", "monster", {"problem": "P0401"}, "lib_floor"),
    "j": ("m_P0403", "monster", {"problem": "P0403"}, None),
    "k": ("m_P0402", "monster", {"problem": "P0402"}, "lib_floor"),
    # 2 열람실
    "2": ("rune_L4-2", "rune", {"lesson": "L4-2"}, None),
    "G": ("npc_ghost_librarian", "npc", {"dialogue": "npc_ghost_librarian", "sprite": "npc_ghost_librarian"}, None),
    "O": ("board_shadow_r04", "board", {}, None),
    "n": ("m_P0405", "monster", {"problem": "P0405"}, "lib_floor"),
    "o": ("m_P0404", "monster", {"problem": "P0404"}, "lib_floor"),
    # 3 서고 미로
    "3": ("rune_L4-3", "rune", {"lesson": "L4-3"}, None),
    "S": ("sign_stacks", "sign", {"dialogue": "sign_stacks"}, None),
    "H": ("chest_hidden_stacks", "chest", {"gold": 70, "dialogue": "chest_hidden_stacks"}, None),
    "l": ("m_P0406", "monster", {"problem": "P0406"}, "lib_floor"),
    "m": ("m_P0407", "monster", {"problem": "P0407"}, "lib_floor"),
    # 4 필사실
    "4": ("rune_L4-4", "rune", {"lesson": "L4-4"}, None),
    "A": ("chest_archivist", "chest", {"item": "archivist-glasses", "dialogue": "chest_archivist"}, None),
    "Q": ("campfire_scriptorium", "campfire", {}, None),  # 보스 전 마지막 회복 지점
    "q": ("m_P0408", "monster", {"problem": "P0408"}, "lib_floor"),
    "s": ("m_P0409", "monster", {"problem": "P0409"}, "lib_floor"),
    # 5 봉인 서고
    "R": ("sign_sealed_record", "sign", {"dialogue": "sign_sealed_record"}, None),
    "u": ("m_P0410", "monster", {"problem": "P0410"}, "lib_floor"),
    "V": ("t_boss_intro", "trigger", {"dialogue": "boss_intro", "once": True}, "lib_floor"),
    # 6 골렘의 열람대
    "X": ("m_P0411", "monster", {"problem": "P0411"}, "lib_floor"),
    ">": (
        "warp_east",
        "warp",
        {
            "requires": "problem:P0411",
            "lockedDialogue": "east_gate_locked",
            # 지역 간 이동(docs/phase3/region05-spec.md §4): 해안 길을 따라 교역항 서쪽 입구로.
            # 처음 건널 때 누리의 연결 대사(to_be_continued)를 한 번 보여 주고 넘어간다(지역 3 문과 같은 방식)
            "openDialogue": "to_be_continued",
            "target": "r05",
            "targetSpawn": "spawn_west",
        },
        "lib_floor",
    ),
}

# 진행 순서 검증: (이 단계에서 제거하는 오브젝트, 이 단계에서 닿아야 하는 것, 아직 닿으면 안 되는 것)
STAGES: list[tuple[str | None, list[str], list[str]]] = [
    (None, ["warp_west", "t_library_intro", "rune_L4-1", "campfire_hall", "m_P0401"], []),
    ("m_P0401", ["m_P0403", "m_P0402"], []),
    ("m_P0402", ["rune_L4-2", "npc_ghost_librarian", "board_shadow_r04", "m_P0405", "m_P0404"], []),
    ("m_P0404", ["rune_L4-3", "sign_stacks", "m_P0406"], []),
    ("m_P0406", ["chest_hidden_stacks", "m_P0407"], []),
    ("m_P0407", ["rune_L4-4", "chest_archivist", "m_P0408"], []),
    ("m_P0408", ["campfire_scriptorium", "m_P0409"], []),
    ("m_P0409", ["sign_sealed_record", "m_P0410", "t_boss_intro", "m_P0411"], []),
    ("m_P0411", ["warp_east"], []),
]
OPTIONAL = {"m_P0403", "m_P0405", "m_P0410"}

# 명세 §3 표: 몬스터의 문제가 요구하는 주문서(콘텐츠 파일이 아직 없을 때도 비석 순서를 검사하려고 둔다)
SCROLLS = ["scroll.string", "scroll.strmethods", "scroll.splitjoin", "scroll.ascii"]
RUNE_OF_SCROLL = {s: f"rune_L4-{k + 1}" for k, s in enumerate(SCROLLS)}
REQUIRES = {
    **{p: ["scroll.string"] for p in ("P0401", "P0402", "P0403")},
    **{p: ["scroll.strmethods"] for p in ("P0404", "P0405")},
    **{p: ["scroll.splitjoin"] for p in ("P0406", "P0407")},
    **{p: ["scroll.ascii"] for p in ("P0408", "P0409", "P0410")},
    "P0411": SCROLLS,
}


def _deco_under(name: str, ch: str, rows: list[str], x: int, y: int) -> str:
    # 도서관 물체 타일은 마루를 그림에 품고 있으므로 밑바닥도 마루로 맞춘다
    return "lib_floor"


SPEC = RegionSpec(
    region="r04",
    out=OUT,
    map_text=MAP,
    tiles=TILES,
    objects=OBJECTS,
    floors=FLOORS,
    deco_under=_deco_under,
    default_floor="lib_floor",
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
    1: ["spawn_west", "warp_west", "t_library_intro", "rune_L4-1", "campfire_hall", "m_P0401", "m_P0403", "m_P0402"],
    2: ["rune_L4-2", "npc_ghost_librarian", "board_shadow_r04", "m_P0405", "m_P0404"],
    3: ["rune_L4-3", "sign_stacks", "chest_hidden_stacks", "m_P0406", "m_P0407"],
    4: ["rune_L4-4", "chest_archivist", "campfire_scriptorium", "m_P0408", "m_P0409"],
    5: ["sign_sealed_record", "m_P0410", "t_boss_intro"],
    6: ["m_P0411", "warp_east"],
}
# 1칸 길목을 막는 필수 몬스터(구역 출구 포함)
CHOKEPOINTS = ["m_P0401", "m_P0402", "m_P0404", "m_P0406", "m_P0407", "m_P0408", "m_P0409", "m_P0411"]
EDGE_EXITS = {"m_P0402": 1, "m_P0404": 2, "m_P0407": 3, "m_P0409": 4}


def _content_ready() -> bool:
    """이 지역 레슨 4개와 몬스터 문제 파일이 모두 있으면 콘텐츠 기준 공통 검사를 돌린다."""
    lessons = list((REGION_DIR / "lessons").glob("*/lesson.json"))
    problems = [o[2]["problem"] for o in OBJECTS.values() if o[1] == "monster"]
    return len(lessons) >= len(SCROLLS) and all(
        (REGION_DIR / "problems" / p / "problem.json").exists() for p in problems)


def check_spec_runes(info: dict) -> list[str]:
    """명세 §3 표 기준: 몬스터가 요구하는 주문서의 비석은 그 몬스터를 치우기 전에 닿아야 한다."""
    errors = []
    for o in info["objects"]:
        if o["type"] != "monster":
            continue
        oid = o["name"]
        pid = next(p["value"] for p in o["properties"] if p["name"] == "problem")
        area = reachable(info, removed_before(STAGES, oid) - {oid})
        for scroll in REQUIRES[pid]:
            if not touches(info, area, RUNE_OF_SCROLL[scroll]):
                errors.append(f"{oid} needs {scroll}, but {RUNE_OF_SCROLL[scroll]} is not reachable before {oid}")
    return errors


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
    # 서쪽 시작: spawn 옆에 트리거, 트리거를 밟지 않고는 도서관으로 들어갈 수 없다
    if dist("spawn_west", "t_library_intro") != 1:
        errors.append("t_library_intro must be next to spawn_west")
    if touches(info, reachable(info, set(), {pos["t_library_intro"]}), "rune_L4-1"):
        errors.append("t_library_intro can be bypassed")
    if dist("spawn_west", "warp_west") > 2:
        errors.append("warp_west must be near spawn_west")
    if pos["warp_west"][0] > 1:
        errors.append("warp_west must be at the far west")
    if pos["warp_east"][0] < w - 3:
        errors.append("warp_east must be at the far east")
    # 보스 앞 트리거: 두 칸 앞, 피할 수 없음
    if dist("m_P0411", "t_boss_intro") != 2:
        errors.append("t_boss_intro must be two tiles in front of the boss")
    pre_boss = removed_before(STAGES, "m_P0411")
    if touches(info, reachable(info, pre_boss, {pos["t_boss_intro"]}), "m_P0411"):
        errors.append("t_boss_intro can be bypassed")
    # 보스 전 마지막 쉼터: campfire_scriptorium은 필사실 길목(m_P0408) 뒤에 있고 보스 트리거 전에 닿으며,
    # 그 뒤(봉인 서고·열람대)에는 다른 캠프파이어가 없다
    if not touches(info, reachable(info, pre_boss, {pos["t_boss_intro"]}), "campfire_scriptorium"):
        errors.append("campfire_scriptorium should be reachable before t_boss_intro")
    if touches(info, reachable(info, removed_before(STAGES, "m_P0408") - {"m_P0408"}), "campfire_scriptorium"):
        errors.append("campfire_scriptorium reachable before m_P0408")
    late = [o["name"] for o in info["objects"] if o["type"] == "campfire" and pos[o["name"]][0] >= bounds[4][0]]
    if late:
        errors.append(f"no campfire expected after the scriptorium: {late}")
    # 기록관의 안경 상자: 필사실 길목(m_P0408) 앞에서 닿고, 길목 바로 앞 필수 경로 옆(3칸 이내)에 있다
    if not touches(info, reachable(info, removed_before(STAGES, "m_P0408") - {"m_P0408"}), "chest_archivist"):
        errors.append("chest_archivist should be reachable before m_P0408")
    if dist("chest_archivist", "m_P0408") > 3:
        errors.append("chest_archivist should stand next to the main path, within 3 tiles of m_P0408")
    # 숨겨진 길: 빈 책장 칸은 하나뿐, 서고 미로 구역의 책장 줄 가운데(동서가 책장) 남북으로 지나가는 칸이고,
    # 바로 남쪽 두 칸에 떠 있는 페이지가 모여 있다(유령 사서·표지판 대사의 귀띔)
    gaps = [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == "g"]
    if len(gaps) != 1:
        errors.append("exactly one shelf_gap expected")
        return errors
    gx, gy = gaps[0]
    if tile_at(gx, gy) != "shelf_gap" or col[gy * w + gx] != 0:
        errors.append(f"shelf_gap at ({gx},{gy}) must be a passable shelf_gap tile")
    if not bounds[2][0] <= gx < bounds[2][1]:
        errors.append("shelf_gap must be in the stacks-maze zone")
    if not (open_cell(gx, gy - 1) and open_cell(gx, gy + 1)) or open_cell(gx - 1, gy) or open_cell(gx + 1, gy):
        errors.append("shelf_gap must be a north-south gap in a wall line")
    if tile_at(gx - 1, gy) != "bookshelf" or tile_at(gx + 1, gy) != "bookshelf":
        errors.append("shelf_gap must sit between two bookshelves")
    if tile_at(gx, gy + 1) != "floating_pages" or tile_at(gx, gy + 2) != "floating_pages":
        errors.append("the two tiles south of shelf_gap should be floating_pages (the hint)")
    hidden = removed_before(STAGES, "chest_hidden_stacks")
    closed = reachable(info, hidden, {(gx, gy)})
    if touches(info, closed, "chest_hidden_stacks"):
        errors.append("chest_hidden_stacks reachable without the shelf gap")
    if not touches(info, closed, "m_P0407"):
        errors.append("the rest of the stacks maze should not need the shelf gap")
    # 몬스터가 요구하는 이 지역 주문서의 비석은 그 몬스터보다 먼저 닿아야 한다
    errors += check_spec_runes(info)
    if _content_ready():
        errors += check_runes_before_monsters(info, STAGES, REGION_DIR)
    # 바닥이 비지 않았다
    if any(v == 0 for v in info["ground"]):
        errors.append("ground layer has empty tiles")
    if h != H:
        errors.append(f"map height should be {H}")
    return errors


if __name__ == "__main__":
    sys.exit(run(SPEC, validate, "tools/maps/build_r04.py"))
