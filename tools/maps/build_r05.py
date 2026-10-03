#!/usr/bin/env python3
"""지역 5(교역항) 맵 생성기: 아스키 도면 → Tiled JSON(.tmj).

사용법: python3 tools/maps/build_r05.py [--check] [--print]
  --check  파일을 쓰지 않고 검증만 한다(현재 map.tmj와 내용이 다르면 실패)
  --print  도면과 단계별 도달 범위를 출력한다

명세: docs/phase3/region05-spec.md §4. 레이어·검증 도구는 tools/maps/common.py에 있다.
구역은 서 → 동으로 이어지고(도면은 구역별 블록을 가로로 이어 붙인 것), 구역 출구는 한 칸짜리 길목이며
필수 몬스터가 막는다. 북쪽은 산처럼 쌓인 화물 상자(C), 남쪽은 바다(~)이고, 바다에는 유리처럼 굳은 파도(w)가
군데군데 서 있다(도면에 적은 것 + 빈 바다에 결정적으로 흩뿌린 것).

  1 해안 시장    warp_west·spawn_west·t_port_intro가 1칸 통로에 나란히 있다(트리거는 피할 수 없음).
                 생선 좌판이 늘어선 바깥 시장(좌판 앞에 항구 상인 npc_port_merchant와 상점 shop_port, rune_L5-1,
                 campfire_market) → 상자 벽의 길목 m_P0501 → 안쪽 시장(북쪽 상자 더미 사이 빈 막다른 골목)
                 → 출구 m_P0502. 남쪽 가장자리는 계선주가 선 부두 널
  2 상인 길드    북쪽에 통을 쌓은 길드 나무 테라스(npc_guild_master, rune_L5-2), 그 앞 자갈 마당에 board_shadow_r05,
                 마당 남서쪽 구석에 선택 m_P0503(시세표 조회는 장부의 주문서가 필요해서 rune_L5-2 뒤),
                 남쪽 바다로 뻗은 막다른 잔교 끝에 선택 m_P0505, 동쪽 출구 m_P0504
  3 창고 거리    작은 앞마당(rune_L5-3, sign_warehouses) → 길목 m_P0506 → 화물 상자 더미 사이 골목들 → 출구 m_P0507.
                 남쪽 막다른 골목 끝에 선택 m_P0508.
                 숨겨진 길: 북쪽 창고 벽(상자 더미 줄)에 지나갈 수 있는 빈 상자 칸(crate_gap) 하나. 표지는 명세로 고정:
                 바로 남쪽에 밧줄 더미(rope_coil). rope_coil은 맵 전체에 이 한 칸뿐이다. 그 너머 작은 창고에
                 chest_hidden_crates가 있고, 이 칸이 그 창고의 유일한 입구다
  4 부두         물 위에 떠 있는 널 부두 셋을 1칸 다리가 잇는다. 첫 부두(rune_L5-4, campfire_docks) → 다리 길목 m_P0509 →
                 가운데 부두 → 다리 길목 m_P0510 → 동쪽 부두 → 출구 m_P0511
  5 등대 앞      줄무늬 등대 탑 아래 자갈 곶. 등대 문 앞 sign_lighthouse, rune_L5-5, 보스 전 마지막 쉼터
                 campfire_lighthouse → 길목 m_P0512 → 1칸 건널판: t_boss_intro → 빈칸 → (6구역) 보스
                 (트리거는 보스 두 칸 앞, 피할 수 없음)
  6 밀수선 갑판  건널판 끝을 막은 보스 m_P0513 뒤로 난간 두른 갑판, 동쪽 끝 난간 틈에 warp_east
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

REGION_DIR = ROOT / "content" / "regions" / "r05-trade-port"
OUT = REGION_DIR / "map.tmj"
H = 24

# ── 도면(구역별 블록, 높이 24. 비어 있는 아래쪽 줄은 바다로 채운다) ──────────────────
ZONE1 = r"""
CCCCCCCCCCCCCCCCCCCC
CCCCCCCCCCCCCCCCCCCC
CCCCCCCCCCCCCCCCCCCC
CCCSSCSSCSSCCCC.CCCC
CCC.M.k....CCCC.CCCC
CCC........C......CC
CCC........C.......C
CCC.1......C..C....C
CCC........C.......C
CCC...F....A.......C
CCC........C.......C
CCCC.......C.......C
<@!........C.......B
CCC........C.......C
CCC..C.....C....C..C
CCC........C.......C
CCC........C.......C
~~~|==|==|=C=|==|==~
~~~~~~~~~~~~~~~~~~~~
~~w~~~~~~~w~~~~~~~~~
"""

ZONE2 = r"""
CCCCCCCCCCCCCCCC
CCCCCCCCCCCCCCCC
CCCCCCCCCCCCCCCC
CCCCCCCCCCCCCCCC
CCbb========bbCC
CC============CC
CC==G=====2===CC
CC============CC
CC....O.......CC
C..............H
C..............C
C..............C
...............C
C..............C
C...C......C...C
C..............C
CD.............C
~~~~~~|=|~~~~~~~
~~~~~~|=|~~~~~~~
~~~~~~|=|~~~w~~~
~~~~~~|E|~~~~~~~
"""

ZONE3 = r"""
CCCCCCCCCCCCCCCCCCCCCC
CCCCCCCCCCCCCCCCCCCCCC
CCCCCCCCCCCCC...XCCCCC
CCCCCCCCCCCCC....CCCCC
CCCCCCCCCCCCCCgCCCCCCC
CCCCCCC.......r.....CC
CCCCCCC.CCC.CCC.CCC.CC
CCCCCCC.CCC.CCC.CCC.CC
C3...TC.............CC
......C..C.......C..CC
C.....I.............CC
C.....C.CCCC..CCCC..CC
C.....C.CCCC..CCCC..CC
CCCCCCC......C.......K
CCCCCCC..CCCCCCCCCCCCC
CCCCCCC.JCCCCCCCCCCCCC
"""

ZONE4 = r"""
~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~
~~w~~~~~~~~~~~w~~~
~~~~~~~~~~~~~~~~~~
~~~~~~~~|==|~~~~~~
~~~~~~~~=b==~~~~~~
~|===|~~====~~~~~~
~=====~~====~|==|~
~=4===~~=n==~====~
~=====~~====~====~
~=====~~====Q====U
~=====~~====~====~
======N=====~|==|~
~=====~~====~~~~~~
~==P==~~====~~~~~~
~|===|~~====~~~~~~
~~~~~~~~|==|~~~~~~
"""

ZONE5 = r"""
~~~~~~~~~~~~~~
~~~~~LLL~~~~~~
~~~~~LLL~~w~~~
~~w~~LLL~~~~~~
~~~~~LLL~~~~~~
~~~~~LLL~~~~~~
~~~~..Y...~~~~
~~~.......C~~~
~~..5......~~~
~~.........~~~
~~....Z...C~~~
...........VW=
~~.........C~~
~~~.......~~~~
"""

ZONE6 = r"""
~~~~~~~~~~~~
~~~~~~~~~~~~
~~~~~~~~~~~~
~~~~~~~~~~~~
~~~~~~~~~~~~
~~~~~~~~~~~~
~RRRRRRRRRR~
~R$$$$$$$$R~
~R$$$$$$$$R~
~R$$$$$$$$R~
~R$$$$$$$$R~
x$$$$$$$$$$>
~R$$$$$$$$R~
~R$$$$$$$$R~
~R$$$$$$$$R~
~RRRRRRRRRR~
"""

ZONES = [ZONE1, ZONE2, ZONE3, ZONE4, ZONE5, ZONE6]


def _block(text: str, k: int) -> list[str]:
    rows = text.strip("\n").split("\n")
    w = len(rows[0])
    if len({len(r) for r in rows}) != 1:
        raise SystemExit(f"zone {k + 1}: rows have different widths")
    if len(rows) > H:
        raise SystemExit(f"zone {k + 1}: {len(rows)} rows, at most {H}")
    return rows + ["~" * w] * (H - len(rows))


def _waves(rows: list[str]) -> list[str]:
    """빈 바다에 굳은 파도를 결정적으로 흩뿌린다(둘 다 막힌 칸이라 길은 바뀌지 않는다)."""
    out = []
    for y, r in enumerate(rows):
        out.append("".join("w" if ch == "~" and (x * 5 + y * 11) % 37 == 0 else ch for x, ch in enumerate(r)))
    return out


RAW = [_block(z, k) for k, z in enumerate(ZONES)]
ROWS = _waves(["".join(b[y] for b in RAW) for y in range(H)])
MAP = "\n".join(ROWS)

# 문자 → (타일 이름, 레이어)
TILES: dict[str, tuple[str, str]] = {
    ".": ("port_cobble", "ground"),
    "=": ("dock_plank", "ground"),
    "$": ("ship_deck", "ground"),
    "~": ("harbor_water", "ground"),
    "w": ("frozen_wave", "ground"),
    "L": ("lighthouse_wall", "ground"),
    "C": ("port_crate", "deco"),
    "g": ("crate_gap", "deco"),  # 숨겨진 길 입구: 상자처럼 보이지만 지나갈 수 있다(manifest에서 막힘 아님)
    "r": ("rope_coil", "deco"),  # 숨겨진 길의 표지(명세 §4): crate_gap 바로 남쪽 한 칸뿐
    "S": ("port_stall", "deco"),
    "b": ("barrel", "deco"),
    "|": ("pier_post", "deco"),
    "n": ("fishing_net", "deco"),
    "R": ("ship_rail", "deco"),
}
FLOORS = {"port_cobble", "dock_plank", "ship_deck"}

# 문자 → (오브젝트 ID, 종류, 속성, 밑바닥 강제(선택))
OBJECTS = {
    # 1 해안 시장
    "@": ("spawn_west", "spawn", {}, "port_cobble"),
    "<": ("warp_west", "warp", {"target": "r04", "targetSpawn": "warp_east"}, "port_cobble"),
    "!": ("t_port_intro", "trigger", {"dialogue": "port_intro", "once": True}, "port_cobble"),
    "1": ("rune_L5-1", "rune", {"lesson": "L5-1"}, None),
    "k": ("shop_port", "shop", {}, None),  # 항구 상점(상점 대사는 npc_port_merchant)
    "M": ("npc_port_merchant", "npc", {"dialogue": "npc_port_merchant", "sprite": "npc_merchant"}, None),
    "F": ("campfire_market", "campfire", {}, None),
    "A": ("m_P0501", "monster", {"problem": "P0501"}, "port_cobble"),
    "D": ("m_P0503", "monster", {"problem": "P0503"}, "port_cobble"),
    "B": ("m_P0502", "monster", {"problem": "P0502"}, "port_cobble"),
    # 2 상인 길드
    "2": ("rune_L5-2", "rune", {"lesson": "L5-2"}, None),
    "G": ("npc_guild_master", "npc", {"dialogue": "npc_guild_master", "sprite": "npc_guild_master"}, None),
    "O": ("board_shadow_r05", "board", {}, None),
    "E": ("m_P0505", "monster", {"problem": "P0505"}, "dock_plank"),
    "H": ("m_P0504", "monster", {"problem": "P0504"}, "port_cobble"),
    # 3 창고 거리
    "3": ("rune_L5-3", "rune", {"lesson": "L5-3"}, None),
    "T": ("sign_warehouses", "sign", {"dialogue": "sign_warehouses"}, None),
    "X": ("chest_hidden_crates", "chest", {"gold": 80, "dialogue": "chest_hidden_crates"}, None),
    "I": ("m_P0506", "monster", {"problem": "P0506"}, "port_cobble"),
    "J": ("m_P0508", "monster", {"problem": "P0508"}, "port_cobble"),
    "K": ("m_P0507", "monster", {"problem": "P0507"}, "port_cobble"),
    # 4 부두
    "4": ("rune_L5-4", "rune", {"lesson": "L5-4"}, None),
    "P": ("campfire_docks", "campfire", {}, None),
    "N": ("m_P0509", "monster", {"problem": "P0509"}, "dock_plank"),
    "Q": ("m_P0510", "monster", {"problem": "P0510"}, "dock_plank"),
    "U": ("m_P0511", "monster", {"problem": "P0511"}, "dock_plank"),
    # 5 등대 앞
    "5": ("rune_L5-5", "rune", {"lesson": "L5-5"}, None),
    "Y": ("sign_lighthouse", "sign", {"dialogue": "sign_lighthouse"}, None),  # 마지막 배의 항해 일지
    "Z": ("campfire_lighthouse", "campfire", {}, None),  # 보스 전 마지막 회복 지점
    "V": ("m_P0512", "monster", {"problem": "P0512"}, "port_cobble"),
    "W": ("t_boss_intro", "trigger", {"dialogue": "boss_intro", "once": True}, "dock_plank"),
    # 6 밀수선 갑판
    "x": ("m_P0513", "monster", {"problem": "P0513"}, "dock_plank"),
    ">": (
        "warp_east",
        "warp",
        {"requires": "problem:P0513", "lockedDialogue": "east_gate_locked", "openDialogue": "to_be_continued"},
        "ship_deck",
    ),
}

# 진행 순서 검증: (이 단계에서 제거하는 오브젝트, 이 단계에서 닿아야 하는 것, 아직 닿으면 안 되는 것)
STAGES: list[tuple[str | None, list[str], list[str]]] = [
    (None, ["warp_west", "t_port_intro", "rune_L5-1", "shop_port", "npc_port_merchant", "campfire_market",
            "m_P0501"], []),
    ("m_P0501", ["m_P0502"], []),
    ("m_P0502", ["rune_L5-2", "npc_guild_master", "board_shadow_r05", "m_P0503", "m_P0505", "m_P0504"], []),
    ("m_P0504", ["rune_L5-3", "sign_warehouses", "m_P0506"], []),
    ("m_P0506", ["chest_hidden_crates", "m_P0508", "m_P0507"], []),
    ("m_P0507", ["rune_L5-4", "campfire_docks", "m_P0509"], []),
    ("m_P0509", ["m_P0510"], []),
    ("m_P0510", ["m_P0511"], []),
    ("m_P0511", ["rune_L5-5", "sign_lighthouse", "campfire_lighthouse", "m_P0512"], []),
    ("m_P0512", ["t_boss_intro", "m_P0513"], []),
    ("m_P0513", ["warp_east"], []),
]
OPTIONAL = {"m_P0503", "m_P0505", "m_P0508"}

# 명세 §3 표: 몬스터의 문제가 요구하는 주문서(콘텐츠 파일이 아직 없을 때도 비석 순서를 검사하려고 둔다)
SCROLLS = ["scroll.tuple", "scroll.dict", "scroll.set", "scroll.counter", "scroll.deque"]
RUNE_OF_SCROLL = {s: f"rune_L5-{k + 1}" for k, s in enumerate(SCROLLS)}
REQUIRES = {
    **{p: ["scroll.tuple"] for p in ("P0501", "P0502")},
    **{p: ["scroll.dict"] for p in ("P0503", "P0504", "P0505")},
    **{p: ["scroll.set"] for p in ("P0506", "P0507", "P0508")},
    **{p: ["scroll.counter"] for p in ("P0509", "P0510", "P0511")},
    "P0512": ["scroll.deque"],
    "P0513": SCROLLS,
}

# 물체 타일은 바닥을 그림에 품고 있으므로 밑바닥도 그림과 같은 바닥으로 맞춘다
_UNDER = {"port_crate": "port_cobble", "crate_gap": "port_cobble", "rope_coil": "port_cobble",
          "port_stall": "port_cobble", "barrel": "dock_plank", "pier_post": "dock_plank",
          "fishing_net": "dock_plank", "ship_rail": "ship_deck"}


def _deco_under(name: str, ch: str, rows: list[str], x: int, y: int) -> str:
    return _UNDER[name]


SPEC = RegionSpec(
    region="r05",
    out=OUT,
    map_text=MAP,
    tiles=TILES,
    objects=OBJECTS,
    floors=FLOORS,
    deco_under=_deco_under,
    default_floor="port_cobble",
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
    1: ["spawn_west", "warp_west", "t_port_intro", "rune_L5-1", "shop_port", "npc_port_merchant", "campfire_market",
        "m_P0501", "m_P0502"],
    2: ["rune_L5-2", "npc_guild_master", "board_shadow_r05", "m_P0503", "m_P0505", "m_P0504"],
    3: ["rune_L5-3", "sign_warehouses", "chest_hidden_crates", "m_P0506", "m_P0508", "m_P0507"],
    4: ["rune_L5-4", "campfire_docks", "m_P0509", "m_P0510", "m_P0511"],
    5: ["rune_L5-5", "sign_lighthouse", "campfire_lighthouse", "m_P0512", "t_boss_intro"],
    6: ["m_P0513", "warp_east"],
}
# 1칸 길목을 막는 필수 몬스터(구역 출구 포함)
CHOKEPOINTS = ["m_P0501", "m_P0502", "m_P0504", "m_P0506", "m_P0507", "m_P0509", "m_P0510", "m_P0511", "m_P0512",
               "m_P0513"]
EDGE_EXITS = {"m_P0502": 1, "m_P0504": 2, "m_P0507": 3, "m_P0511": 4}


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
    # 구역 출구 몬스터는 다음 구역과 맞닿은 동쪽 가장자리에 있다
    for oid, z in EDGE_EXITS.items():
        if pos[oid][0] != bounds[z - 1][1] - 1:
            errors.append(f"{oid} should stand at the east edge of zone {z}")
    # 서쪽 시작: spawn 옆에 트리거, 트리거를 밟지 않고는 항구로 들어갈 수 없다
    if dist("spawn_west", "t_port_intro") != 1:
        errors.append("t_port_intro must be next to spawn_west")
    if touches(info, reachable(info, set(), {pos["t_port_intro"]}), "rune_L5-1"):
        errors.append("t_port_intro can be bypassed")
    if dist("spawn_west", "warp_west") > 2:
        errors.append("warp_west must be near spawn_west")
    if pos["warp_west"][0] > 1:
        errors.append("warp_west must be at the far west")
    if pos["warp_east"][0] < w - 3:
        errors.append("warp_east must be at the far east")
    # 상점: 항구 상인이 상점 바로 곁에 서 있고(2칸 이내), 둘 다 처음부터 닿는다(단계 검사)
    if dist("shop_port", "npc_port_merchant") > 2:
        errors.append("npc_port_merchant should stand next to shop_port")
    # 보스 앞 트리거: 두 칸 앞, 피할 수 없음
    if dist("m_P0513", "t_boss_intro") != 2:
        errors.append("t_boss_intro must be two tiles in front of the boss")
    pre_boss = removed_before(STAGES, "m_P0513")
    if touches(info, reachable(info, pre_boss, {pos["t_boss_intro"]}), "m_P0513"):
        errors.append("t_boss_intro can be bypassed")
    # 캠프파이어 셋(시장·부두·등대). 보스 전 마지막 쉼터 campfire_lighthouse는 부두 출구(m_P0511) 뒤에 있고
    # 보스 트리거 전에 닿으며, 그 뒤(밀수선 갑판)에는 다른 캠프파이어가 없다
    fires = sorted(o["name"] for o in info["objects"] if o["type"] == "campfire")
    if fires != ["campfire_docks", "campfire_lighthouse", "campfire_market"]:
        errors.append(f"expected three campfires (market, docks, lighthouse), got {fires}")
    if not touches(info, reachable(info, pre_boss, {pos["t_boss_intro"]}), "campfire_lighthouse"):
        errors.append("campfire_lighthouse should be reachable before t_boss_intro")
    if touches(info, reachable(info, removed_before(STAGES, "m_P0511") - {"m_P0511"}), "campfire_lighthouse"):
        errors.append("campfire_lighthouse reachable before m_P0511")
    late = [f for f in fires if f != "campfire_lighthouse" and pos[f][0] >= pos["campfire_lighthouse"][0]]
    if late:
        errors.append(f"no campfire expected after the lighthouse: {late}")
    # 숨겨진 길: 빈 상자 칸은 하나뿐, 창고 거리 구역의 상자 더미 줄 가운데(동서가 상자) 남북으로 지나가는 칸이다.
    # 표지(명세 §4 고정): 바로 남쪽 칸에 밧줄 더미(rope_coil). 밧줄 더미는 맵 전체에 그 한 칸뿐이다
    gaps = [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == "g"]
    if len(gaps) != 1:
        errors.append("exactly one crate_gap expected")
        return errors
    gx, gy = gaps[0]
    if tile_at(gx, gy) != "crate_gap" or col[gy * w + gx] != 0:
        errors.append(f"crate_gap at ({gx},{gy}) must be a passable crate_gap tile")
    if not bounds[2][0] <= gx < bounds[2][1]:
        errors.append("crate_gap must be in the warehouse zone")
    if not (open_cell(gx, gy - 1) and open_cell(gx, gy + 1)) or open_cell(gx - 1, gy) or open_cell(gx + 1, gy):
        errors.append("crate_gap must be a north-south gap in a crate line")
    if tile_at(gx - 1, gy) != "port_crate" or tile_at(gx + 1, gy) != "port_crate":
        errors.append("crate_gap must sit between two crates")
    ropes = [(x, y) for y in range(h) for x in range(w) if tile_at(x, y) == "rope_coil"]
    if ropes != [(gx, gy + 1)]:
        errors.append(f"rope_coil must appear exactly once, right south of crate_gap ({gx},{gy + 1}); found {ropes}")
    hidden = removed_before(STAGES, "chest_hidden_crates")
    closed = reachable(info, hidden, {(gx, gy)})
    if touches(info, closed, "chest_hidden_crates"):
        errors.append("chest_hidden_crates reachable without the crate gap")
    if not touches(info, closed, "m_P0507"):
        errors.append("the rest of the warehouse street should not need the crate gap")
    if not touches(info, closed, "m_P0508"):
        errors.append("m_P0508 should not need the crate gap")
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
    if h != H:
        errors.append(f"map height should be {H}")
    if not 90 <= w <= 110:
        errors.append(f"map width {w} should be about 100")
    return errors


if __name__ == "__main__":
    sys.exit(run(SPEC, validate, "tools/maps/build_r05.py"))
