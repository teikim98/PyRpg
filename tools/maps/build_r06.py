#!/usr/bin/env python3
"""지역 6(거울 호수) 맵 생성기: 아스키 도면 → Tiled JSON(.tmj).

사용법: python3 tools/maps/build_r06.py [--check] [--print]
  --check  파일을 쓰지 않고 검증만 한다(현재 map.tmj와 내용이 다르면 실패)
  --print  도면과 단계별 도달 범위를 출력한다

명세: docs/phase3/region06-spec.md §4. 레이어·검증 도구는 tools/maps/common.py에 있다.
구역은 서 → 동으로 이어지고(도면은 구역별 블록을 가로로 이어 붙인 것), 구역 출구는 한 칸짜리 길목이며
필수 몬스터가 막는다. 북쪽은 버드나무 숲(T)과 갈대 벽(R), 남쪽은 흐르는 호수 물(~, 군데군데 연잎)이고,
호수 한가운데(거울 다리와 섬 둘레)는 거울처럼 굳은 수면(m)이다.

  1 호숫가 나루  warp_west·spawn_west·t_lake_intro가 1칸 통로에 나란히 있다(트리거는 피할 수 없음).
                 모래 호숫가 바깥 나루(호수 상인 npc_lake_merchant와 상점 shop_lake, rune_L6-1, campfire_ferry,
                 남쪽으로 뻗은 막다른 나무 선착장) → 버드나무 줄의 길목 m_P0601 → 안쪽 나루 → 출구 m_P0602
  2 버드나무 둑  서쪽 풀밭 둑(호수지기 npc_lake_keeper, rune_L6-2, board_shadow_r06) → 버드나무 두 줄 사이 길목
                 m_P0603 → 동쪽 모래 둑(남쪽 징검돌 끝에 선택 m_P0604) → 출구 m_P0605
  3 거울 다리    서쪽 다리목(rune_L6-3, sign_mirror_bridge) → 굳은 거울 수면 위 1칸 다리(양옆 난간)의 길목 m_P0606
                 → 다리 가운데 쉼터 마루(campfire_bridge, 북쪽 막다른 널 끝에 선택 m_P0607) → 다시 1칸 다리:
                 t_midboss_intro → 빈칸 → 다리 끝 m_P0608(중간 보스, 구역 3과 4를 가르는 1칸 길목)
  4 안개 갈대밭  작은 앞마당(rune_L6-4, sign_reeds) → 갈대 벽의 길목 m_P0609 → 갈대 사이 길들 → 출구 m_P0610.
                 남쪽 막다른 길 끝에 선택 m_P0611.
                 숨겨진 길: 북쪽 갈대 벽에 지나갈 수 있는 빈틈(reed_gap) 하나. 표지는 명세로 고정:
                 바로 남쪽에 조약돌 더미(pebble_cairn). pebble_cairn은 맵 전체에 이 한 칸뿐이다. 그 너머 작은 빈터에
                 chest_hidden_reeds가 있고, 이 칸이 그 빈터의 유일한 입구다
  5 메아리 여울  서쪽 모래톱(rune_L6-5, sign_echo_shoal) → 징검돌 길목 m_P0612 → 동쪽 모래톱(보스 전 마지막 쉼터
                 campfire_shoal) → 징검돌 길목 m_P0613 → t_boss_intro → 징검돌 → (6구역) 보스
                 (트리거는 보스 두 칸 앞, 피할 수 없음)
  6 호수 한가운데 섬  징검돌 끝을 막은 보스 m_P0614 뒤로 버드나무가 둘러선 섬, 동쪽 끝에 warp_east
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

REGION_DIR = ROOT / "content" / "regions" / "r06-mirror-lake"
OUT = REGION_DIR / "map.tmj"
H = 26

# ── 도면(구역별 블록, 높이 26. 비어 있는 아래쪽 줄은 구역의 물로 채운다) ─────────────────────────
# 문자: . 모래 호숫가  ; 섬 풀  , 안개 풀  = 다리 널  o 징검돌  ~ 호수 물  m 거울 수면
#       T 버드나무  R 갈대 벽  g 갈대 빈틈  p 조약돌 더미  - 다리 난간  E 메아리 바위
ZONE1 = r"""
TTTTTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTTTT
TTTT;;;;;;;TTTT;;TTT
TTT;k.M...;TTT;;;;TT
TTT;.......T;;....;T
TTT;.......T;......T
TTT;.1.....T;..E...T
TTT........T.......T
TTT...F....A.......T
TTT........T.......T
TTTT.......T..;....T
<@!........T.......B
TTT........T.......T
TTT..E.....T....E..T
TTT........T.......T
TTT;.......T;.....;T
~~~~..==..~T~~~~~~~~
~~~~~~==~~~~~~~~~~~~
~~~~~~==~~~~~~~~~~~~
~~~~~~==~~~~~~~~~~~~
~~~~~~==~~~~~~~~~~~~
"""

ZONE2 = r"""
TTTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTT
TTT;;;;TTTTT;;;TTT
TT;;K;;;;TT;;;;;TT
TT;;;;2;;TT;;...;T
T;;;;;;;;TT;....;T
T;;O;;;;;TT;.....T
T;;;;;;;;C......;H
T;;;;T;;;TT;....;T
T;;;;;;;;TT;;...;T
;;;;;;;;;TT;;.E.;T
T;;;;;;;;TT;....;T
T;;T;;;;;TT;....;T
T;;;;;;;;TT;;..;;T
~~~;;;;;~~TT;;o;;T
~~~~~~~~~~~~~~o~~~
~~~~~~~~~~~~~~o~~~
~~~~~~~~~~~~~~D~~~
"""

ZONE3 = r"""
TTTTTTmmmmmmmmmmmmmmmm
TTTTTTmmmmmmmmmmmmmmmm
TTTTTTmmmmmmmmmmmmmmmm
TTTTTTmmmmmmmmmmmmmmmm
TTTTTTmmmmmmmmmmmmmmmm
TTTTTTmmmmmmmJmmmmmmmm
TT;;;Tmmmmmmm=mmmmmmmm
T;;3;;mmmmm--=--mmmmmm
T;...;mmmmm=f===mmmmmm
;;.S..-----=====------
T;....I============t=Z
T;....-----=====------
T;;...mmmmm=====mmmmmm
TT;;;;mmmmm-----mmmmmm
TTTTTTmmmmmmmmmmmmmmmm
"""

ZONE4 = r"""
RRRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRR
RRRRRRRRRRR,X,RRRR
RRRRRRRRRR,,,,RRRR
RRRRRRRRRRRRgRRRRR
RRRRRR,,,,,,p,,,,R
RRRRRR,RR,RRR,RR,R
RRRRRR,RR,RRR,RR,R
R4,s,R,,,,,,,,,,,R
R,,,,R,,R,,,,,R,,R
,,,,,N,,,,,R,,,,,R
R,,,,R,,RRR,,RRR,R
R,,,,R,,RRR,,RRR,R
RRRRRR,,,,,,R,,,,Q
RRRRRR,,RRRRRRRRRR
RRRRRR,PRRRRRRRRRR
RRRRRRRRRRRRRRRRRR
"""

ZONE5 = r"""
~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~
~~~~~~~~EE.~~~~~
~~~~~~~E..c.~~~~
~E.~~~~.....E~~~
~....~~......Vwo
E.5..~~.....E~~~
..e..Uoo.....~~~
E....~~~E...~~~~
~E..~~~~~~..~~~~
~~~~~~~~~~~~~~~~
"""

ZONE6 = r"""
mmmmmmmmmmmm
mmmmmmmmmmmm
mmmmmmmmmmmm
mmmmmmmmmmmm
mmmmmmmmmmmm
mmmmmmmmmmmm
mmmTTTTTTmmm
mmTT;;;;TTmm
mT;;;;;;;;Tm
mT;;;;;;;;Tm
mT;;;;T;;;Tm
x;;;;;;;;;;>
mT;;;;;;;;Tm
mT;;;;;;;;Tm
mmTT;;;;TTmm
mmmTTTTTTmmm
"""

ZONES = [ZONE1, ZONE2, ZONE3, ZONE4, ZONE5, ZONE6]
# 구역마다 비어 있는 아래쪽 줄을 채우는 물: 호수 한가운데(거울 다리, 섬)는 굳은 거울 수면
PAD = ["~", "~", "m", "~", "~", "m"]


def _block(text: str, k: int) -> list[str]:
    rows = text.strip("\n").split("\n")
    w = len(rows[0])
    if len({len(r) for r in rows}) != 1:
        raise SystemExit(f"zone {k + 1}: rows have different widths")
    if len(rows) > H:
        raise SystemExit(f"zone {k + 1}: {len(rows)} rows, at most {H}")
    return rows + [PAD[k] * w] * (H - len(rows))


def _lilies(rows: list[str]) -> list[str]:
    """흐르는 호수 물에 연잎을 결정적으로 흩뿌린다(둘 다 막힌 칸이라 길은 바뀌지 않는다)."""
    out = []
    for y, r in enumerate(rows):
        out.append("".join("l" if ch == "~" and (x * 7 + y * 13) % 41 == 0 else ch for x, ch in enumerate(r)))
    return out


def _shoreline(rows: list[str]) -> list[str]:
    """흐르는 물(~)과 거울 수면(m)이 구역 경계에서 곧은 세로줄로 갈리지 않게, 경계를 줄마다 -2~+2칸 들쭉날쭉 옮긴다.
    물 칸끼리만 바꾸므로(둘 다 막힘) 길은 바뀌지 않는다."""
    out = [list(r) for r in rows]
    x = 0
    for k in range(len(ZONES) - 1):
        x += len(RAW[k][0])
        left, right = PAD[k], PAD[k + 1]
        if left == right:
            continue
        for y in range(H):
            off = (0, 1, 2, 1, 0, -1, -2, -1)[(y * 3 + x) % 8]
            for xx in range(x - 3, x + 3):
                if out[y][xx] in "~m":
                    out[y][xx] = left if xx < x + off else right
    return ["".join(r) for r in out]


RAW = [_block(z, k) for k, z in enumerate(ZONES)]
ROWS = _lilies(_shoreline(["".join(b[y] for b in RAW) for y in range(H)]))
MAP = "\n".join(ROWS)

# 문자 → (타일 이름, 레이어)
TILES: dict[str, tuple[str, str]] = {
    ".": ("lake_shore", "ground"),
    ";": ("island_grass", "ground"),
    ",": ("mist_grass", "ground"),
    "=": ("lake_bridge", "ground"),
    "o": ("lake_stepping_stone", "ground"),
    "~": ("lake_water", "ground"),
    "m": ("mirror_water", "ground"),
    "T": ("willow_tree", "deco"),
    "R": ("lake_reed", "deco"),
    "g": ("reed_gap", "deco"),  # 숨겨진 길 입구: 갈대처럼 보이지만 지나갈 수 있다(manifest에서 막힘 아님)
    "p": ("pebble_cairn", "deco"),  # 숨겨진 길의 표지(명세 §4): reed_gap 바로 남쪽 한 칸뿐
    "-": ("bridge_rail", "deco"),
    "l": ("lily_pad", "deco"),
    "E": ("echo_rock", "deco"),
}
FLOORS = {"lake_shore", "island_grass", "mist_grass", "lake_bridge", "lake_stepping_stone"}

# 문자 → (오브젝트 ID, 종류, 속성, 밑바닥 강제(선택))
OBJECTS = {
    # 1 호숫가 나루
    "@": ("spawn_west", "spawn", {}, "lake_shore"),
    "<": ("warp_west", "warp", {"target": "r05", "targetSpawn": "warp_east"}, "lake_shore"),
    "!": ("t_lake_intro", "trigger", {"dialogue": "lake_intro", "once": True}, "lake_shore"),
    "1": ("rune_L6-1", "rune", {"lesson": "L6-1"}, None),
    "k": ("shop_lake", "shop", {}, None),  # 호수 상점(메아리 고리를 처음 파는 곳, 명세 §7)
    "M": ("npc_lake_merchant", "npc", {"dialogue": "npc_lake_merchant", "sprite": "npc_merchant"}, None),
    "F": ("campfire_ferry", "campfire", {}, None),
    "A": ("m_P0601", "monster", {"problem": "P0601"}, "lake_shore"),
    "B": ("m_P0602", "monster", {"problem": "P0602"}, "lake_shore"),
    # 2 버드나무 둑
    "2": ("rune_L6-2", "rune", {"lesson": "L6-2"}, None),
    "K": ("npc_lake_keeper", "npc", {"dialogue": "npc_lake_keeper", "sprite": "npc_lake_keeper"}, None),
    "O": ("board_shadow_r06", "board", {}, None),
    "C": ("m_P0603", "monster", {"problem": "P0603"}, "island_grass"),
    "D": ("m_P0604", "monster", {"problem": "P0604"}, "lake_stepping_stone"),
    "H": ("m_P0605", "monster", {"problem": "P0605"}, "island_grass"),
    # 3 거울 다리
    "3": ("rune_L6-3", "rune", {"lesson": "L6-3"}, None),
    "S": ("sign_mirror_bridge", "sign", {"dialogue": "sign_mirror_bridge"}, None),
    "f": ("campfire_bridge", "campfire", {}, "lake_bridge"),  # 중간 보스 전 회복
    "I": ("m_P0606", "monster", {"problem": "P0606"}, "lake_bridge"),
    "J": ("m_P0607", "monster", {"problem": "P0607"}, "lake_bridge"),
    "t": ("t_midboss_intro", "trigger", {"dialogue": "midboss_intro", "once": True}, "lake_bridge"),
    "Z": ("m_P0608", "monster", {"problem": "P0608"}, "lake_bridge"),  # 중간 보스
    # 4 안개 갈대밭
    "4": ("rune_L6-4", "rune", {"lesson": "L6-4"}, None),
    "s": ("sign_reeds", "sign", {"dialogue": "sign_reeds"}, None),
    "X": ("chest_hidden_reeds", "chest", {"gold": 80, "dialogue": "chest_hidden_reeds"}, None),
    "N": ("m_P0609", "monster", {"problem": "P0609"}, "mist_grass"),
    "P": ("m_P0611", "monster", {"problem": "P0611"}, "mist_grass"),
    "Q": ("m_P0610", "monster", {"problem": "P0610"}, "mist_grass"),
    # 5 메아리 여울
    "5": ("rune_L6-5", "rune", {"lesson": "L6-5"}, None),
    "e": ("sign_echo_shoal", "sign", {"dialogue": "sign_echo_shoal"}, None),  # 갈라지는 메아리 이야기
    "c": ("campfire_shoal", "campfire", {}, None),  # 보스 전 마지막 회복 지점
    "U": ("m_P0612", "monster", {"problem": "P0612"}, "lake_stepping_stone"),
    "V": ("m_P0613", "monster", {"problem": "P0613"}, "lake_stepping_stone"),
    "w": ("t_boss_intro", "trigger", {"dialogue": "boss_intro", "once": True}, "lake_stepping_stone"),
    # 6 호수 한가운데 섬
    "x": ("m_P0614", "monster", {"problem": "P0614"}, "island_grass"),
    ">": (
        "warp_east",
        "warp",
        {"requires": "problem:P0614", "lockedDialogue": "east_gate_locked", "openDialogue": "to_be_continued"},
        "island_grass",
    ),
}

# 진행 순서 검증: (이 단계에서 제거하는 오브젝트, 이 단계에서 닿아야 하는 것, 아직 닿으면 안 되는 것)
STAGES: list[tuple[str | None, list[str], list[str]]] = [
    (None, ["warp_west", "t_lake_intro", "rune_L6-1", "shop_lake", "npc_lake_merchant", "campfire_ferry",
            "m_P0601"], []),
    ("m_P0601", ["m_P0602"], []),
    ("m_P0602", ["rune_L6-2", "npc_lake_keeper", "board_shadow_r06", "m_P0603"], []),
    ("m_P0603", ["m_P0604", "m_P0605"], []),
    ("m_P0605", ["rune_L6-3", "sign_mirror_bridge", "m_P0606"], []),
    ("m_P0606", ["campfire_bridge", "m_P0607", "t_midboss_intro", "m_P0608"], []),
    ("m_P0608", ["rune_L6-4", "sign_reeds", "m_P0609"], []),
    ("m_P0609", ["chest_hidden_reeds", "m_P0611", "m_P0610"], []),
    ("m_P0610", ["rune_L6-5", "sign_echo_shoal", "m_P0612"], []),
    ("m_P0612", ["campfire_shoal", "m_P0613"], []),
    ("m_P0613", ["t_boss_intro", "m_P0614"], []),
    ("m_P0614", ["warp_east"], []),
]
OPTIONAL = {"m_P0604", "m_P0607", "m_P0611"}
MIDBOSS = "m_P0608"
BOSS = "m_P0614"

# 명세 §3 표: 몬스터의 문제가 요구하는 주문서(콘텐츠 파일이 아직 없을 때도 비석 순서를 검사하려고 둔다)
SCROLLS = ["scroll.function", "scroll.unpack", "scroll.sort", "scroll.recursion", "scroll.memo"]
RUNE_OF_SCROLL = {s: f"rune_L6-{k + 1}" for k, s in enumerate(SCROLLS)}
REQUIRES = {
    **{p: ["scroll.function"] for p in ("P0601", "P0602")},
    **{p: ["scroll.unpack"] for p in ("P0603", "P0604", "P0605")},
    **{p: ["scroll.sort"] for p in ("P0606", "P0607")},
    "P0608": SCROLLS[:3],
    **{p: ["scroll.recursion"] for p in ("P0609", "P0610", "P0611")},
    **{p: ["scroll.memo"] for p in ("P0612", "P0613")},
    "P0614": SCROLLS,
}

# 물체 타일은 바닥을 그림에 품고 있으므로 밑바닥도 그림과 같은 바닥으로 맞춘다
_UNDER = {"willow_tree": "island_grass", "lake_reed": "mist_grass", "reed_gap": "mist_grass",
          "pebble_cairn": "mist_grass", "bridge_rail": "lake_bridge", "lily_pad": "lake_water",
          "echo_rock": "lake_shore"}


def _deco_under(name: str, ch: str, rows: list[str], x: int, y: int) -> str:
    return _UNDER[name]


SPEC = RegionSpec(
    region="r06",
    out=OUT,
    map_text=MAP,
    tiles=TILES,
    objects=OBJECTS,
    floors=FLOORS,
    deco_under=_deco_under,
    default_floor="lake_shore",
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
    1: ["spawn_west", "warp_west", "t_lake_intro", "rune_L6-1", "shop_lake", "npc_lake_merchant", "campfire_ferry",
        "m_P0601", "m_P0602"],
    2: ["rune_L6-2", "npc_lake_keeper", "board_shadow_r06", "m_P0603", "m_P0604", "m_P0605"],
    3: ["rune_L6-3", "sign_mirror_bridge", "campfire_bridge", "m_P0606", "m_P0607", "t_midboss_intro", "m_P0608"],
    4: ["rune_L6-4", "sign_reeds", "chest_hidden_reeds", "m_P0609", "m_P0611", "m_P0610"],
    5: ["rune_L6-5", "sign_echo_shoal", "campfire_shoal", "m_P0612", "m_P0613", "t_boss_intro"],
    6: ["m_P0614", "warp_east"],
}
# 1칸 길목을 막는 필수 몬스터(구역 출구·중간 보스·보스 포함)
CHOKEPOINTS = ["m_P0601", "m_P0602", "m_P0603", "m_P0605", "m_P0606", "m_P0608", "m_P0609", "m_P0610", "m_P0612",
               "m_P0613", "m_P0614"]
EDGE_EXITS = {"m_P0602": 1, "m_P0605": 2, "m_P0608": 3, "m_P0610": 4}


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
    # 필수 몬스터는 1칸 길목에 선다: 열린 이웃이 정확히 둘이고 서로 마주 본다(동서 또는 남북)
    for oid in CHOKEPOINTS:
        x, y = pos[oid]
        nb = [(dx, dy) for dx, dy in D4 if open_cell(x + dx, y + dy)]
        if sorted(nb) not in ([(-1, 0), (1, 0)], [(0, -1), (0, 1)]):
            errors.append(f"{oid} should block a 1-tile chokepoint (open neighbours {nb})")
    # 구역 출구 몬스터는 다음 구역과 맞닿은 동쪽 가장자리에 있다(중간 보스는 다리 끝에서 구역 3과 4를 가른다)
    for oid, z in EDGE_EXITS.items():
        if pos[oid][0] != bounds[z - 1][1] - 1:
            errors.append(f"{oid} should stand at the east edge of zone {z}")
    # 서쪽 시작: spawn 옆에 트리거, 트리거를 밟지 않고는 나루로 들어갈 수 없다
    if dist("spawn_west", "t_lake_intro") != 1:
        errors.append("t_lake_intro must be next to spawn_west")
    if touches(info, reachable(info, set(), {pos["t_lake_intro"]}), "rune_L6-1"):
        errors.append("t_lake_intro can be bypassed")
    if dist("spawn_west", "warp_west") > 2:
        errors.append("warp_west must be near spawn_west")
    if pos["warp_west"][0] > 1:
        errors.append("warp_west must be at the far west")
    if pos["warp_east"][0] < w - 3:
        errors.append("warp_east must be at the far east")
    # 상점: 호수 상인이 상점 바로 곁에 서 있고(2칸 이내), 둘 다 처음부터 닿는다(단계 검사)
    if dist("shop_lake", "npc_lake_merchant") > 2:
        errors.append("npc_lake_merchant should stand next to shop_lake")
    # 보스 앞 트리거(중간 보스·최종 보스): 두 칸 앞, 피할 수 없음
    for boss, trig in ((MIDBOSS, "t_midboss_intro"), (BOSS, "t_boss_intro")):
        if dist(boss, trig) != 2:
            errors.append(f"{trig} must be two tiles in front of {boss}")
        if touches(info, reachable(info, removed_before(STAGES, boss), {pos[trig]}), boss):
            errors.append(f"{trig} can be bypassed")
    # 중간 보스를 치우기 전에는 안개 갈대밭(구역 4) 이후의 어떤 칸에도 닿지 않는다
    before_mid = reachable(info, removed_before(STAGES, MIDBOSS))
    if any(x >= bounds[3][0] for x, _ in before_mid):
        errors.append("zone 4 and beyond must not be reachable before the mid-boss is cleared")
    # 캠프파이어 셋(나루·다리·여울). 다리 쉼터는 길목 m_P0606 뒤·중간 보스 트리거 앞,
    # 보스 전 마지막 쉼터 campfire_shoal은 갈대밭 출구(m_P0610) 뒤·보스 트리거 앞이고 그 뒤(섬)에는 캠프파이어가 없다
    fires = sorted(o["name"] for o in info["objects"] if o["type"] == "campfire")
    if fires != ["campfire_bridge", "campfire_ferry", "campfire_shoal"]:
        errors.append(f"expected three campfires (ferry, bridge, shoal), got {fires}")
    for fire, gate, trig, boss in (("campfire_bridge", "m_P0606", "t_midboss_intro", MIDBOSS),
                                   ("campfire_shoal", "m_P0610", "t_boss_intro", BOSS)):
        if not touches(info, reachable(info, removed_before(STAGES, boss), {pos[trig]}), fire):
            errors.append(f"{fire} should be reachable before {trig}")
        if touches(info, reachable(info, removed_before(STAGES, gate) - {gate}), fire):
            errors.append(f"{fire} reachable before {gate}")
    late = [f for f in fires if f != "campfire_shoal" and pos[f][0] >= pos["campfire_shoal"][0]]
    if late:
        errors.append(f"no campfire expected after the shoal: {late}")
    # 숨겨진 길: 갈대 빈틈은 하나뿐, 안개 갈대밭 구역의 갈대 벽 가운데(동서가 갈대) 남북으로 지나가는 칸이다.
    # 표지(명세 §4 고정 "조약돌 더미 바로 북쪽의 갈대"): 바로 남쪽 칸에 조약돌 더미(pebble_cairn).
    # 조약돌 더미는 맵 전체에 그 한 칸뿐이다
    gaps = [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == "g"]
    if len(gaps) != 1:
        errors.append("exactly one reed_gap expected")
        return errors
    gx, gy = gaps[0]
    if tile_at(gx, gy) != "reed_gap" or col[gy * w + gx] != 0:
        errors.append(f"reed_gap at ({gx},{gy}) must be a passable reed_gap tile")
    if not bounds[3][0] <= gx < bounds[3][1]:
        errors.append("reed_gap must be in the misty reed zone")
    if not (open_cell(gx, gy - 1) and open_cell(gx, gy + 1)) or open_cell(gx - 1, gy) or open_cell(gx + 1, gy):
        errors.append("reed_gap must be a north-south gap in a reed wall")
    if tile_at(gx - 1, gy) != "lake_reed" or tile_at(gx + 1, gy) != "lake_reed":
        errors.append("reed_gap must sit between two reeds")
    cairns = [(x, y) for y in range(h) for x in range(w) if tile_at(x, y) == "pebble_cairn"]
    if cairns != [(gx, gy + 1)]:
        errors.append(f"pebble_cairn must appear exactly once, right south of reed_gap ({gx},{gy + 1}); found {cairns}")
    if col[(gy + 1) * w + gx] != 0:
        errors.append("pebble_cairn must be walkable")
    hidden = removed_before(STAGES, "chest_hidden_reeds")
    closed = reachable(info, hidden, {(gx, gy)})
    if touches(info, closed, "chest_hidden_reeds"):
        errors.append("chest_hidden_reeds reachable without the reed gap")
    if not touches(info, closed, "m_P0610"):
        errors.append("the rest of the reed field should not need the reed gap")
    if not touches(info, closed, "m_P0611"):
        errors.append("m_P0611 should not need the reed gap")
    # 몬스터가 요구하는 이 지역 주문서의 비석은 그 몬스터보다 먼저 닿아야 한다
    errors += check_spec_runes(info)
    if _content_ready():
        errors += check_runes_before_monsters(info, STAGES, REGION_DIR)
    # 바닥이 비지 않았고, 맵 가장자리는 길목(warp)을 빼면 모두 막혀 있다
    if any(v == 0 for v in info["ground"]):
        errors.append("ground layer has empty tiles")
    warps = {pos["warp_west"], pos["warp_east"]}
    for x in range(w):
        for y in range(h):
            if (x in (0, w - 1) or y in (0, h - 1)) and open_cell(x, y) and (x, y) not in warps:
                errors.append(f"map edge ({x},{y}) should be blocked")
    if not 24 <= h <= 30:
        errors.append(f"map height {h} should be 24..30")
    if not 90 <= w <= 110:
        errors.append(f"map width {w} should be about 100")
    return errors


if __name__ == "__main__":
    sys.exit(run(SPEC, validate, "tools/maps/build_r06.py"))
