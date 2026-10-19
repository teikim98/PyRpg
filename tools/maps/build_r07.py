#!/usr/bin/env python3
"""지역 7(모래시계 사막) 맵 생성기: 아스키 도면 → Tiled JSON(.tmj).

사용법: python3 tools/maps/build_r07.py [--check] [--print]
  --check  파일을 쓰지 않고 검증만 한다(현재 map.tmj와 내용이 다르면 실패)
  --print  도면과 단계별 도달 범위를 출력한다

명세: docs/phase3/region07-spec.md §6. 레이어·검증 도구는 tools/maps/common.py에 있다.
구역은 서 → 동으로 이어지고(도면은 구역별 블록을 가로로 이어 붙인 것), 구역 출구는 한 칸짜리 길목이며
필수 몬스터(구역 4는 고장 난 다리)가 막는다. 바깥 테두리는 모래 언덕(^), 협곡은 붉은 사암 벽(#)이다.

  1 마른 나루     warp_west·spawn_west·t_desert_intro가 1칸 통로에 나란히 있다(트리거는 피할 수 없음).
                  강이 끝난 모래밭(대상 길잡이 npc_caravan_guide와 상점 shop_desert, campfire_ferry_r07, rune_L7-1,
                  남서쪽에 마지막 물웅덩이와 야자) → 북동쪽 곁길 끝에 연습 m_P0701 → 출구 m_P0702
  2 바람 협곡     사암 협곡(rune_L7-2, board_shadow_r07, sign_canyon) → 남쪽 곁길 끝에 연습 m_P0703 → 출구 m_P0704.
                  숨겨진 길: 북쪽 사암 벽에 지나갈 수 있는 틈(sandstone_gap) 하나. 표지는 명세로 고정:
                  "낙타 해골 바로 북쪽의 사암 벽" — 바로 남쪽에 낙타 해골(camel_skull). camel_skull은 맵 전체에 이 한 칸뿐이다.
                  그 너머 작은 빈터에 chest_hidden_canyon이 있고, 이 칸이 그 빈터의 유일한 입구다
  3 신기루 시장   바깥 시장(rune_L7-3, 모래시계지기 npc_hourglass_keeper, 남쪽 곁길 끝에 연습 m_P0705) → 사암 성벽의 문
                  m_P0706 → 안쪽 시장(오아시스, campfire_bazaar) → 1칸 골목: sign_bazaar_gate 옆에서 t_midboss_intro → 빈칸
                  → m_P0707(중간 보스, 구역 3과 4를 가르는 1칸 길목)
  4 별자리 유적   중간 보스 바로 뒤 campfire_ruins → 별자리 판석 유적(rune_L7-4, 남쪽 곁길 끝에 연습 m_P0708) → 기둥 사이
                  길목 m_P0709 → 모래 수로 앞 빈터 → 수로를 건너는 널다리 가운데의 bridge_r07(고장 난 다리, door.
                  그 칸의 바닥은 지나갈 수 있는 canal_bridge, 양옆 위아래는 sand_canal)
  5 해시계 광장   포석 광장(rune_L7-5, 남쪽 곁길 끝에 연습 m_P0710) → 성벽 길목 m_P0711 → 안쪽 광장(북쪽 곁길 끝에
                  응용 판별형 m_P0713) → 출구 m_P0712(응용 통합형)
  6 스핑크스의 제단  앞마당(sign_altar, campfire_altar) → 1칸 통로: t_boss_intro → 빈칸 → m_P0714(최종 보스) →
                  묻힌 모래시계가 둘러선 금테 제단, 동쪽 끝에 warp_east
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (  # noqa: E402
    D4,
    ROOT,
    RegionSpec,
    check_practice_placement,
    check_runes_before_monsters,
    reachable,
    removed_before,
    run,
    touches,
    validate_stages,
)

REGION_DIR = ROOT / "content" / "regions" / "r07-hourglass-desert"
OUT = REGION_DIR / "map.tmj"
H = 26

# ── 도면(구역별 블록, 높이 26. 비어 있는 아래쪽 줄은 PAD 문자로 채운다) ─────────────────────────────
# 문자: . 모래  : 포석 길  * 별자리 판석  _ 제단 판석  + 수로 널다리  = 모래 수로  ~ 오아시스 물
#       ^ 모래 언덕  # 사암 벽  g 사암 틈(숨겨진 길)  s 낙타 해골  T 야자  y 선인장  I 무너진 기둥  h 묻힌 모래시계
ZONE1 = r"""
^^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^^^^^^^^^
^^^^^T...^^^^^^^^^^^
^^^^...$G..^^^^^^^^^
^^^T........^^^^.a^^
^^^..F.......^^^.:^^
^^^..........y...:^^
^^^^.....1.......:^^
<@!::::::::::::::::b
^^^^...............^
^^^~~....y.........^
^^~~~~T............^
^^~~~~~....T....^^^^
^^^~~~T.......^^^^^^
^^^^^^..y..^^^^^^^^^
"""

ZONE2 = r"""
##################
##################
##################
##################
##################
##########.X.#####
##########...#####
###########g######
######...##s..####
####..2.B#.....###
###.......S......#
::::.......#.....d
###......###....##
####.##.........##
####.###..####..##
####c###..####..##
########........##
#########..y..####
"""

ZONE3 = r"""
^^^^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^^^^^^^^^^^
^^^T..T^^#^^^^^^^^^^^^
^^.3....^#^^T~~T^^^^^^
^.......^#^.~~~~.^^^^^
^..K.....#..~~~~C^^^^^
^.......h#....T..^^^^^
^......y.#.......Q####
:::::::::f:::::::::t:M
^........#.......#####
^^.......#..T....^^^^^
^^^.^^...#.~~~...^^^^^
^^^e^^^..#..~...^^^^^^
^^^^^^^^^#^^^^^^^^^^^^
"""

ZONE4 = r"""
^^^^^^^^^^^^^^^===
^^^^^^^^^^^^^^^===
^^^^^^^^^^^^^^^===
^^^^^^^^^^^^^^^===
^^^^^^^^^^^^^^^===
^^^^^^^^^^^^^^^===
^^^I**I^^^^^^^^===
^^*****4*^^^^^^===
^I*******I^^..^===
^***I***.*I...^===
R*********I...y===
::*******:j::::+|+
^*********I...^===
^I****I**I^^..^===
^^^^^^^**^^^^^^===
^^^^^^^i*^^^^^^===
^^^^^^^^^^^^^^^===
"""

ZONE5 = r"""
^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^^o^^^^^
^^h::::h^^^^:^^^^^
^^:*5**:#^^^:^^^^^
^::****:#h:::::h^^
^:*****:#::***::#^
::*****:m:*****::n
^:*****:#::***::#^
^::****:#h:::::h^^
^^:****:#^^^^^^^^^
^^h::::h^^^^^^^^^^
^^^^^.^^^^^^^^^^^^
^^^^^l^^^^^^^^^^^^
"""

ZONE6 = r"""
^^^^^^^^^^^^^^
^^^^^^^^^^^^^^
^^^^^^^^^^^^^^
^^^^^^^^^^^^^^
^^^^^^^^^^^^^^
^^^^^^^^^^^^^^
^^^^^^^^^^^^^^
^^^^^^^^h__h^^
^^.A.^^^____^^
^....^^h_____^
^.E..^^^h____^
::::::w:Z____>
^....^^^h____^
^^...^^h_____^
^^^^^^^^____^^
^^^^^^^^h__h^^
"""

ZONES = [ZONE1, ZONE2, ZONE3, ZONE4, ZONE5, ZONE6]
# 구역마다 비어 있는 아래쪽 줄을 채우는 문자: 협곡은 사암 벽, 별자리 유적은 오른쪽 세 칸이 수로로 이어진다
PAD = ["^", "#", "^", "^^^^^^^^^^^^^^^===", "^", "^"]


def _block(text: str, k: int) -> list[str]:
    rows = text.strip("\n").split("\n")
    w = len(rows[0])
    if len({len(r) for r in rows}) != 1:
        raise SystemExit(f"zone {k + 1}: rows have different widths {sorted({len(r) for r in rows})}")
    if len(rows) > H:
        raise SystemExit(f"zone {k + 1}: {len(rows)} rows, at most {H}")
    pad = PAD[k] if len(PAD[k]) == w else PAD[k] * w
    return rows + [pad] * (H - len(rows))


RAW = [_block(z, k) for k, z in enumerate(ZONES)]
ROWS = ["".join(b[y] for b in RAW) for y in range(H)]
MAP = "\n".join(ROWS)

# 문자 → (타일 이름, 레이어)
TILES: dict[str, tuple[str, str]] = {
    ".": ("desert_sand", "ground"),
    ":": ("desert_path", "ground"),
    "*": ("star_floor", "ground"),
    "_": ("altar_floor", "ground"),
    "+": ("canal_bridge", "ground"),
    "=": ("sand_canal", "ground"),
    "~": ("oasis_water", "ground"),
    "^": ("desert_dune", "ground"),
    "#": ("sandstone_wall", "ground"),
    "g": ("sandstone_gap", "ground"),  # 숨겨진 길 입구: 사암 벽처럼 보이지만 지나갈 수 있다(manifest에서 막힘 아님)
    "s": ("camel_skull", "deco"),  # 숨겨진 길의 표지(명세 §6): sandstone_gap 바로 남쪽 한 칸뿐
    "T": ("palm_tree", "deco"),
    "y": ("cactus", "deco"),
    "I": ("ruin_pillar", "deco"),
    "h": ("buried_hourglass", "deco"),
}
FLOORS = {"desert_sand", "desert_path", "star_floor", "altar_floor", "canal_bridge"}

# 문자 → (오브젝트 ID, 종류, 속성, 밑바닥 강제(선택)). 속성은 명세 §6 표 그대로
OBJECTS = {
    # 1 마른 나루
    "@": ("spawn_west", "spawn", {}, "desert_path"),
    "<": ("warp_west", "warp", {"target": "r06", "targetSpawn": "warp_east"}, "desert_path"),
    "!": ("t_desert_intro", "trigger", {"dialogue": "desert_intro", "once": True}, "desert_path"),
    "G": ("npc_caravan_guide", "npc", {"dialogue": "npc_caravan_guide", "sprite": "npc_caravan_guide"}, None),
    "$": ("shop_desert", "shop", {}, None),  # 지역 6 shop_lake와 같은 종류
    "F": ("campfire_ferry_r07", "campfire", {}, None),
    "1": ("rune_L7-1", "rune", {"lesson": "L7-1"}, None),
    "a": ("m_P0701", "monster", {"problem": "P0701"}, None),  # 연습: 비석과 m_P0702 사이 곁길 끝
    "b": ("m_P0702", "monster", {"problem": "P0702"}, "desert_path"),  # 구역 출구
    # 2 바람 협곡
    "2": ("rune_L7-2", "rune", {"lesson": "L7-2"}, None),
    "B": ("board_shadow_r07", "board", {}, None),
    "c": ("m_P0703", "monster", {"problem": "P0703"}, "desert_sand"),  # 연습: 비석과 m_P0704 사이 곁길 끝
    "S": ("sign_canyon", "sign", {"dialogue": "sign_canyon"}, None),  # 숨겨진 길 귀띔
    "X": ("chest_hidden_canyon", "chest", {"gold": 100, "dialogue": "chest_hidden_canyon"}, "desert_sand"),
    "d": ("m_P0704", "monster", {"problem": "P0704"}, "desert_sand"),  # 구역 출구
    # 3 신기루 시장
    "3": ("rune_L7-3", "rune", {"lesson": "L7-3"}, None),
    "K": ("npc_hourglass_keeper", "npc", {"dialogue": "npc_hourglass_keeper", "sprite": "npc_hourglass_keeper"}, None),
    "e": ("m_P0705", "monster", {"problem": "P0705"}, "desert_sand"),  # 연습: 비석과 m_P0706 사이 곁길 끝
    "f": ("m_P0706", "monster", {"problem": "P0706"}, "desert_path"),  # 사암 성벽의 문(길목)
    "C": ("campfire_bazaar", "campfire", {}, None),  # 중간 보스 전 회복
    "Q": ("sign_bazaar_gate", "sign", {"dialogue": "sign_bazaar_gate"}, None),  # 명부 검문 예고(풀이 방향 없음)
    "t": ("t_midboss_intro", "trigger", {"dialogue": "midboss_intro", "once": True}, "desert_path"),
    "M": ("m_P0707", "monster", {"problem": "P0707"}, "desert_path"),  # 중간 보스
    # 4 별자리 유적
    "R": ("campfire_ruins", "campfire", {}, "desert_path"),  # 중간 보스 바로 뒤
    "4": ("rune_L7-4", "rune", {"lesson": "L7-4"}, "star_floor"),
    "i": ("m_P0708", "monster", {"problem": "P0708"}, "star_floor"),  # 연습(중간 보스 뒤 짧은 선택 전투를 겸함)
    "j": ("m_P0709", "monster", {"problem": "P0709"}, "desert_path"),  # 기둥 사이 길목
    # 고장 난 다리(명세 §6, §9.1): 그 칸의 바닥은 지나갈 수 있는 canal_bridge, door가 부서진 다리 그림으로 길을 막는다
    "|": ("bridge_r07", "door", {"puzzle": "Z0701", "lockedDialogue": "bridge_broken", "sprite": "obj_bridge_broken"},
          "canal_bridge"),
    # 5 해시계 광장
    "5": ("rune_L7-5", "rune", {"lesson": "L7-5"}, "star_floor"),
    "l": ("m_P0710", "monster", {"problem": "P0710"}, "desert_path"),  # 연습: 비석과 m_P0711 사이 곁길 끝
    "m": ("m_P0711", "monster", {"problem": "P0711"}, "desert_path"),  # 성벽 길목
    "n": ("m_P0712", "monster", {"problem": "P0712"}, "desert_path"),  # 응용 통합형, 구역 출구
    "o": ("m_P0713", "monster", {"problem": "P0713"}, "desert_path"),  # 응용 판별형, 막지 않는 곁길 끝(선택)
    # 6 스핑크스의 제단
    "A": ("sign_altar", "sign", {"dialogue": "sign_altar"}, None),  # 제단의 글(풀이 방향 없음)
    "E": ("campfire_altar", "campfire", {}, None),  # 보스 전 마지막 회복
    "w": ("t_boss_intro", "trigger", {"dialogue": "boss_intro", "once": True}, "desert_path"),
    "Z": ("m_P0714", "monster", {"problem": "P0714"}, "desert_path"),  # 최종 보스
    ">": (
        "warp_east",
        "warp",
        {"requires": "problem:P0714", "lockedDialogue": "east_gate_locked", "openDialogue": "to_be_continued"},
        "altar_floor",
    ),
}

# 진행 순서 검증: (이 단계에서 제거하는 오브젝트, 이 단계에서 닿아야 하는 것, 아직 닿으면 안 되는 것)
STAGES: list[tuple[str | None, list[str], list[str]]] = [
    (None, ["warp_west", "t_desert_intro", "npc_caravan_guide", "shop_desert", "campfire_ferry_r07", "rune_L7-1",
            "m_P0701", "m_P0702"], []),
    ("m_P0702", ["rune_L7-2", "board_shadow_r07", "sign_canyon", "chest_hidden_canyon", "m_P0703", "m_P0704"], []),
    ("m_P0704", ["rune_L7-3", "npc_hourglass_keeper", "m_P0705", "m_P0706"], []),
    ("m_P0706", ["campfire_bazaar", "sign_bazaar_gate", "t_midboss_intro", "m_P0707"], []),
    ("m_P0707", ["campfire_ruins", "rune_L7-4", "m_P0708", "m_P0709"], []),
    ("m_P0709", ["bridge_r07"], []),
    ("bridge_r07", ["rune_L7-5", "m_P0710", "m_P0711"], []),
    ("m_P0711", ["m_P0713", "m_P0712"], []),
    ("m_P0712", ["sign_altar", "campfire_altar", "t_boss_intro", "m_P0714"], []),
    ("m_P0714", ["warp_east"], []),
]
OPTIONAL = {"m_P0701", "m_P0703", "m_P0705", "m_P0708", "m_P0710", "m_P0713"}
MIDBOSS = "m_P0707"
BOSS = "m_P0714"
BRIDGE = "bridge_r07"
APPLIED = ["m_P0712", "m_P0713"]

# 명세 §3 표: 문제의 requires·연습·응용·보스(문제 파일이 아직 없을 때도 비석 순서·연습 몬스터 배치를 검사하려고 둔다.
# 통합 때 실제 problem.json과 다르면 _content_ready()일 때 도는 파일 기준 검사가 잡는다)
SCROLLS = ["scroll.stream", "scroll.complexity", "scroll.lookup", "scroll.sieve", "scroll.remainder"]
RUNE_OF_SCROLL = {s: f"rune_L7-{k + 1}" for k, s in enumerate(SCROLLS)}
REQUIRES = {
    **{p: ["scroll.stream"] for p in ("P0701", "P0702")},
    **{p: ["scroll.complexity"] for p in ("P0703", "P0704")},
    **{p: ["scroll.lookup"] for p in ("P0705", "P0706")},
    "P0707": SCROLLS[:3],
    **{p: ["scroll.sieve"] for p in ("P0708", "P0709")},
    **{p: ["scroll.remainder"] for p in ("P0710", "P0711")},
    **{p: SCROLLS for p in ("P0712", "P0713", "P0714")},
}
PRACTICE = {"P0701", "P0703", "P0705", "P0708", "P0710"}
SPEC_PROBLEMS = {
    pid: {"requires": req, "practice": pid in PRACTICE, "applied": pid in ("P0712", "P0713"),
          "boss": pid in ("P0707", "P0714")}
    for pid, req in REQUIRES.items()
}

# 물체 타일은 바닥을 그림에 품고 있으므로 밑바닥도 그림과 같은 바닥으로 맞춘다
_UNDER = {"camel_skull": "desert_sand", "palm_tree": "desert_sand", "cactus": "desert_sand",
          "ruin_pillar": "star_floor", "buried_hourglass": "desert_sand"}


def _deco_under(name: str, ch: str, rows: list[str], x: int, y: int) -> str:
    return _UNDER[name]


SPEC = RegionSpec(
    region="r07",
    out=OUT,
    map_text=MAP,
    tiles=TILES,
    objects=OBJECTS,
    floors=FLOORS,
    deco_under=_deco_under,
    default_floor="desert_sand",
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


ZONE_OF = {  # 오브젝트 → 구역 번호(1부터), 명세 §6 표
    1: ["spawn_west", "warp_west", "t_desert_intro", "npc_caravan_guide", "shop_desert", "campfire_ferry_r07",
        "rune_L7-1", "m_P0701", "m_P0702"],
    2: ["rune_L7-2", "board_shadow_r07", "m_P0703", "sign_canyon", "chest_hidden_canyon", "m_P0704"],
    3: ["rune_L7-3", "npc_hourglass_keeper", "m_P0705", "m_P0706", "campfire_bazaar", "sign_bazaar_gate",
        "t_midboss_intro", "m_P0707"],
    4: ["campfire_ruins", "rune_L7-4", "m_P0708", "m_P0709", "bridge_r07"],
    5: ["rune_L7-5", "m_P0710", "m_P0711", "m_P0712", "m_P0713"],
    6: ["sign_altar", "campfire_altar", "t_boss_intro", "m_P0714", "warp_east"],
}
# 1칸 길목을 막는 것(필수 몬스터·구역 출구·중간 보스·고장 난 다리·보스)
CHOKEPOINTS = ["m_P0702", "m_P0704", "m_P0706", "m_P0707", "m_P0709", "bridge_r07", "m_P0711", "m_P0712", "m_P0714"]
EDGE_EXITS = {"m_P0702": 1, "m_P0704": 2, "m_P0707": 3, "m_P0712": 5}


def _content_ready() -> bool:
    """이 지역 레슨 5개와 몬스터 문제 파일이 모두 있으면 콘텐츠 기준 공통 검사를 돌린다."""
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


def first_stage(info: dict, oid: str) -> int:
    """oid에 처음 닿는 진행 단계 번호(0 = 처음). 끝까지 닿지 않으면 단계 수."""
    removed: set[str] = set()
    for k, (remove, _, _) in enumerate(STAGES):
        if remove:
            removed.add(remove)
        if touches(info, reachable(info, removed), oid):
            return k
    return len(STAGES)


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
        """그 칸에 보이는 타일(데코가 있으면 데코)."""
        d = info["deco"][y * w + x]
        return names[(d or info["ground"][y * w + x]) - 1]

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
    # 길목을 막는 것은 1칸 길목에 선다: 열린 이웃이 정확히 둘이고 서로 마주 본다(동서 또는 남북)
    for oid in CHOKEPOINTS:
        x, y = pos[oid]
        nb = [(dx, dy) for dx, dy in D4 if open_cell(x + dx, y + dy)]
        if sorted(nb) not in ([(-1, 0), (1, 0)], [(0, -1), (0, 1)]):
            errors.append(f"{oid} should block a 1-tile chokepoint (open neighbours {nb})")
    # 구역 출구 몬스터는 다음 구역과 맞닿은 동쪽 가장자리에 있다(중간 보스는 구역 3과 4를 가른다)
    for oid, z in EDGE_EXITS.items():
        if pos[oid][0] != bounds[z - 1][1] - 1:
            errors.append(f"{oid} should stand at the east edge of zone {z}")
    # 서쪽 시작: spawn 옆에 트리거, 트리거를 밟지 않고는 나루로 들어갈 수 없다
    if dist("spawn_west", "t_desert_intro") != 1:
        errors.append("t_desert_intro must be next to spawn_west")
    if touches(info, reachable(info, set(), {pos["t_desert_intro"]}), "rune_L7-1"):
        errors.append("t_desert_intro can be bypassed")
    if dist("spawn_west", "warp_west") > 2:
        errors.append("warp_west must be near spawn_west")
    if pos["warp_west"][0] > 1:
        errors.append("warp_west must be at the far west")
    if pos["warp_east"][0] < w - 3:
        errors.append("warp_east must be at the far east")
    # 상점: 대상 길잡이가 상점 바로 곁에 서 있다(2칸 이내)
    if dist("shop_desert", "npc_caravan_guide") > 2:
        errors.append("npc_caravan_guide should stand next to shop_desert")
    # 비석은 레슨 번호 순서(L7-1 → L7-5)로 닿는다(design.md §4.1, 명세 §6)
    order = [first_stage(info, f"rune_L7-{k}") for k in range(1, 6)]
    if any(a >= b for a, b in zip(order, order[1:])):
        errors.append(f"runes must be reached in lesson order L7-1..L7-5 (first stages {order})")
    # 보스 앞 트리거(중간 보스·최종 보스): 두 칸 앞, 피할 수 없음
    for boss, trig in ((MIDBOSS, "t_midboss_intro"), (BOSS, "t_boss_intro")):
        if dist(boss, trig) != 2:
            errors.append(f"{trig} must be two tiles in front of {boss}")
        if touches(info, reachable(info, removed_before(STAGES, boss), {pos[trig]}), boss):
            errors.append(f"{trig} can be bypassed")
    # 중간 보스를 치우기 전에는 별자리 유적(구역 4) 이후의 어떤 칸에도 닿지 않는다
    before_mid = reachable(info, removed_before(STAGES, MIDBOSS))
    if any(x >= bounds[3][0] for x, _ in before_mid):
        errors.append("zone 4 and beyond must not be reachable before the mid-boss is cleared")
    # 고장 난 다리(명세 §6, §9.1): door가 수로를 건너는 1칸 널다리를 막고, 그 칸의 바닥은 지나갈 수 있는 canal_bridge,
    # 위아래는 sand_canal. 다리를 고치기 전에는 해시계 광장(구역 5) 이후에 닿지 않고, 퍼즐의 학습 시점인 L7-4 비석은
    # 다리보다 먼저 닿는다
    bx, by = pos[BRIDGE]
    if info["ground"][by * w + bx] == 0 or names[info["ground"][by * w + bx] - 1] != "canal_bridge" \
            or col[by * w + bx] != 0:
        errors.append("bridge_r07 must stand on a passable canal_bridge tile")
    if tile_at(bx, by - 1) != "sand_canal" or tile_at(bx, by + 1) != "sand_canal":
        errors.append("bridge_r07 must have sand_canal right north and south")
    if not bounds[3][1] - 3 <= bx < bounds[3][1]:
        errors.append("bridge_r07 should be in the canal at the east end of zone 4")
    before_bridge = reachable(info, removed_before(STAGES, BRIDGE))
    if any(x >= bounds[4][0] for x, _ in before_bridge):
        errors.append("zone 5 and beyond must not be reachable before the bridge is fixed")
    if not touches(info, before_bridge, "rune_L7-4"):
        errors.append("rune_L7-4 must be reachable before bridge_r07 (puzzle Z0701 needs L7-4)")
    canal_cols = {x for y in range(h) for x in range(w) if tile_at(x, y) == "sand_canal"}
    for x in canal_cols:
        if any(tile_at(x, y) not in ("sand_canal", "canal_bridge") for y in range(h)):
            errors.append(f"sand canal column x={x} must cross the whole map height (bridge cells only)")
            break
    # 응용 전투(명세 §4, §6): rune_L7-5 뒤·m_P0714 앞. 단계마다 응용 몬스터에 닿으면 L7-5 비석에도 닿는다
    removed: set[str] = set()
    for remove, _, _ in [(None, [], [])] + STAGES:
        if remove:
            removed.add(remove)
        area = reachable(info, removed)
        for oid in APPLIED:
            if touches(info, area, oid) and not touches(info, area, "rune_L7-5"):
                errors.append(f"{oid} must not be reachable before rune_L7-5")
        if touches(info, area, BOSS) and "m_P0712" not in removed:
            errors.append("m_P0714 must not be reachable before m_P0712")
    if touches(info, reachable(info, removed_before(STAGES, "m_P0711") - {"m_P0711"}), "m_P0713"):
        errors.append("m_P0713 should be a side path behind m_P0711")
    # 캠프파이어 넷(나루·시장·유적·제단). 시장 쉼터는 성문 m_P0706 뒤·중간 보스 트리거 앞,
    # 유적 쉼터는 중간 보스 바로 뒤(2칸 이내, 중간 보스를 치운 직후 닿음),
    # 보스 전 마지막 쉼터 campfire_altar는 m_P0712 뒤·보스 트리거 앞이고 그 뒤에는 캠프파이어가 없다
    fires = sorted(o["name"] for o in info["objects"] if o["type"] == "campfire")
    if fires != ["campfire_altar", "campfire_bazaar", "campfire_ferry_r07", "campfire_ruins"]:
        errors.append(f"expected four campfires (ferry, bazaar, ruins, altar), got {fires}")
    for fire, gate, trig, boss in (("campfire_bazaar", "m_P0706", "t_midboss_intro", MIDBOSS),
                                   ("campfire_altar", "m_P0712", "t_boss_intro", BOSS)):
        if not touches(info, reachable(info, removed_before(STAGES, boss), {pos[trig]}), fire):
            errors.append(f"{fire} should be reachable before {trig}")
        if touches(info, reachable(info, removed_before(STAGES, gate) - {gate}), fire):
            errors.append(f"{fire} reachable before {gate}")
    if dist(MIDBOSS, "campfire_ruins") > 2:
        errors.append("campfire_ruins must be right behind the mid-boss (within 2 tiles)")
    if touches(info, reachable(info, removed_before(STAGES, MIDBOSS) - {MIDBOSS}), "campfire_ruins"):
        errors.append("campfire_ruins reachable before the mid-boss")
    late = [f for f in fires if f != "campfire_altar" and pos[f][0] >= pos["campfire_altar"][0]]
    if late:
        errors.append(f"no campfire expected after the altar: {late}")
    # 숨겨진 길: 사암 틈은 하나뿐, 바람 협곡 구역의 사암 벽 가운데(동서가 사암 벽) 남북으로 지나가는 칸이다.
    # 표지(명세 §6 고정 "낙타 해골 바로 북쪽의 사암 벽"): 바로 남쪽 칸에 낙타 해골(camel_skull).
    # 낙타 해골은 맵 전체에 그 한 칸뿐이다
    gaps = [(x, y) for y in range(h) for x in range(w) if tile_at(x, y) == "sandstone_gap"]
    if len(gaps) != 1:
        errors.append(f"exactly one sandstone_gap expected, found {gaps}")
        return errors
    gx, gy = gaps[0]
    if col[gy * w + gx] != 0:
        errors.append(f"sandstone_gap at ({gx},{gy}) must be passable")
    if not bounds[1][0] <= gx < bounds[1][1]:
        errors.append("sandstone_gap must be in the wind canyon zone")
    if not (open_cell(gx, gy - 1) and open_cell(gx, gy + 1)) or open_cell(gx - 1, gy) or open_cell(gx + 1, gy):
        errors.append("sandstone_gap must be a north-south gap in a sandstone wall")
    if tile_at(gx - 1, gy) != "sandstone_wall" or tile_at(gx + 1, gy) != "sandstone_wall":
        errors.append("sandstone_gap must sit between two sandstone walls")
    skulls = [(x, y) for y in range(h) for x in range(w) if tile_at(x, y) == "camel_skull"]
    if skulls != [(gx, gy + 1)]:
        errors.append(f"camel_skull must appear exactly once, right south of sandstone_gap ({gx},{gy + 1}); found {skulls}")
    if col[(gy + 1) * w + gx] != 0:
        errors.append("camel_skull must be walkable")
    hidden_area = removed_before(STAGES, "chest_hidden_canyon")
    closed = reachable(info, hidden_area, {(gx, gy)})
    if touches(info, closed, "chest_hidden_canyon"):
        errors.append("chest_hidden_canyon reachable without the sandstone gap")
    if not touches(info, closed, "m_P0704"):
        errors.append("the rest of the canyon should not need the sandstone gap")
    if not touches(info, closed, "m_P0703"):
        errors.append("m_P0703 should not need the sandstone gap")
    # 몬스터가 요구하는 이 지역 주문서의 비석은 그 몬스터보다 먼저 닿아야 한다(명세 표 기준, 콘텐츠가 있으면 파일 기준도)
    errors += check_spec_runes(info)
    # 연습 몬스터 배치(단위 3-E3): 비석 뒤, 같은 주문서 첫 필수 몬스터 앞, 숨겨진 길 끝 아님
    errors += check_practice_placement(info, STAGES, REGION_DIR, {(gx, gy)}, OPTIONAL, SPEC_PROBLEMS, RUNE_OF_SCROLL)
    if _content_ready():
        errors += check_runes_before_monsters(info, STAGES, REGION_DIR)
        errors += check_practice_placement(info, STAGES, REGION_DIR, {(gx, gy)}, OPTIONAL)
    # 바닥이 비지 않았고, 맵 가장자리는 길목(warp)을 빼면 모두 막혀 있다
    if any(v == 0 for v in info["ground"]):
        errors.append("ground layer has empty tiles")
    warps = {pos["warp_west"], pos["warp_east"]}
    for x in range(w):
        for y in range(h):
            if (x in (0, w - 1) or y in (0, h - 1)) and open_cell(x, y) and (x, y) not in warps:
                errors.append(f"map edge ({x},{y}) should be blocked")
    if not 24 <= h <= 28:
        errors.append(f"map height {h} should be 24..28")
    if not 100 <= w <= 110:
        errors.append(f"map width {w} should be 100..110")
    return errors


if __name__ == "__main__":
    sys.exit(run(SPEC, validate, "tools/maps/build_r07.py"))
