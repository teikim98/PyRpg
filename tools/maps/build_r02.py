#!/usr/bin/env python3
"""지역 2(갈림길 숲) 맵 생성기: 아스키 도면 → Tiled JSON(.tmj).

사용법: python3 tools/maps/build_r02.py [--check] [--print]
  --check  파일을 쓰지 않고 검증만 한다(현재 map.tmj와 내용이 다르면 실패)
  --print  도면과 단계별 도달 범위를 출력한다

명세: docs/phase3/region02-spec.md §4. 레이어·검증 도구는 tools/maps/common.py에 있다.
구역은 서 → 동으로 이어지고(도면은 구역별 블록을 가로로 이어 붙인 것), 구역 출구는 한 칸짜리 길목이며
필수 몬스터가 막는다.

  1 숲 입구      warp_west·spawn_west·t_forest_intro가 1칸 통로에 나란히 있다(트리거는 피할 수 없음).
                 공터 A → 길목 m_P0201 → 공터 B(북쪽 막다른 굴에 선택 m_P0202) → 출구 m_P0203
  2 고리 길      똑같은 고리(가운데 나무 섬을 도는 길) 두 개가 되풀이된다. 고리 입구마다 갈림길 이정표.
                 고리 1 → 길목 m_P0204 → 고리 2(북쪽 굴에 선택 m_P0205, 남쪽 굴에 chest_loop) → 출구 m_P0206
  3 멈춘 개울    얼어붙은 개울이 남북으로 맵을 가른다. 서쪽 기슭(나무꾼, rune_L2-3)에서 디딤돌로 건너는데
                 첫 디딤돌을 m_P0207이 막는다. 동쪽 기슭이 쉼터(rune_L2-4, campfire_stream).
                 숨겨진 길: 서쪽 기슭을 따라 개울 북쪽 끝까지 올라가면 개울에 맞닿은 덤불(H) 하나가 지나갈 수
                 있다(나무꾼 대사의 귀띔: 개울을 따라 북쪽으로, 줄지어 선 덤불 중 잎이 아직 흔들리는 하나). 그 너머 오솔길 끝에
                 chest_hidden_grove와 선택 m_P0208이 있다. 이 덤불이 그 오솔길의 유일한 입구다.
  4 수호목 앞    뿌리 길이 갈라지는 좁은 숲. 출구 m_P0209
  5 수호목의 공터 1칸 통로: t_boss_intro → 빈칸 → 보스 m_P0210(트리거는 보스 두 칸 앞, 피할 수 없음).
                 보스 뒤 공터에서는 뿌리 길이 두 갈래씩 갈라져 퍼지고, 가운데 길 동쪽 끝에 warp_east(→ 지역 3 spawn_west)
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (  # noqa: E402
    ROOT,
    RegionSpec,
    check_runes_before_monsters,
    reachable,
    removed_before,
    run,
    touches,
    validate_stages,
)

REGION_DIR = ROOT / "content" / "regions" / "r02-crossroad-forest"
OUT = REGION_DIR / "map.tmj"

# ── 도면(구역별 블록, 높이 24) ──────────────────────────────────────────────
ZONE1 = r"""
PPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPPP
PPPPPPPPPPPj,PPPPP
PPPPPPPPPPP.gPPPPP
PPPPP..,.PPPrPPPPP
PPPP..m...PP.r..PP
PPP.A......P.rr.,P
PP...r..1..P..r..P
PP..rrr....PB.rr.P
PP..r.S....P...r.P
PPP.r......P.L.r.P
<@!rrrrrrrri.rrr.P
PPP.r......P...r.P
PP..r..F...P.,.r.P
PP..rr.....P..rrrk
PP...rrr..,P.....P
PPP.....g..P.g..,P
PPPP.,...PPP...PPP
PPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPPP
"""

ZONE2 = r"""
PPPPPPPPPPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPnPPPPPPPPP
PPPPPPPPPPPPPPPP,PPPPPPPPP
PPPPPPPPPPPPPPPPgPPPPPPPPP
PPPPPPPPPPPPPPPYrPPPPPPPPP
PPrrrrrrrrPPPrrrrrrrrPPPPP
PPrPPPPPPrPPPrPPPPPPrPPPPP
PPr2PSPPPrPPPrPPSPPPrPPPPP
PPrPPmPPPrPPPrPPmPPPrPPPPP
PPrPPPPPPrrlrrPPPPPPrrrrrp
PPrPPPmPPrPPYrPPPmPPrPPPPP
PYrPLPPPErPPPrPLPPPPrPPPPP
rrrPPPPPPrPPPrPPPPPPrPPPPP
PPrrrNrrrrPPPrrrrrrrrPPPPP
PPPPPPPPPPPPPPPPPrPPPPPPPP
PPPPPPPPPPPPPPPPPCPPPPPPPP
PPPPPPPPPPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPPPPPPPPPPPP
"""

ZONE3 = r"""
PPPPPPPPP~~~PPPPPP
PPPPDPPPP~~~PPPPPP
PPu.,..,.~~~PPPPPP
PPPPhhhhH~~~PPPPPP
PPPPPPPP.~~~PPPPPP
P.,..L...~~~PPPPPP
P..S...,.~~~PPPPPP
P.W..3...~~~P,.PPP
PS......g~~~..4.PP
P..rrr...~~~.G..bP
P..r.rr..~~~..rr.P
rrrr...rrsoorrrrrr
P.,...m..~~~.,.r.P
PB...,...~~~..m..P
P..L..g..~~~P....P
PP.....,P~~~PP..PP
PPP.,..PP~~~PPPPPP
PPPPPPPPP~~~PPPPPP
PPPPPPPPP~~~PPPPPP
PPPPPPPPP~~~PPPPPP
PPPPPPPPP~~~PPPPPP
PPPPPPPPP~~~PPPPPP
PPPPPPPPP~~~PPPPPP
PPPPPPPPP~~~PPPPPP
"""

ZONE4 = r"""
PPPPPPPPPP
PPPPPPPPPP
PPPPPPPPPP
PPPPPPPPPP
PPPPPPPPPP
PPPPPPPPPP
PPPP,..PPP
PP..rr..PP
PP.rr.r.PP
P..r..rr.P
P.rr.g.r.P
rrr..,.rrv
P.,..g...P
PP..,..m.P
PPP.....PP
PPPP..PPPP
PPPPPPPPPP
PPPPPPPPPP
PPPPPPPPPP
PPPPPPPPPP
PPPPPPPPPP
PPPPPPPPPP
PPPPPPPPPP
PPPPPPPPPP
"""

ZONE5 = r"""
PPPPPPPPPPPP
PPPPPPPPPPPP
PPPPPPPPPPPP
PPPPPPPPPPPP
PPPPPPPPPPPP
PPPPP,..rrPP
PPP...,.r.PP
PP.,...rr..P
PP....rr.,.P
PP..,rr....P
PPP.rr..,..P
VrXrrrrrrr>P
PPP.rr..,..P
PP..,rr....P
PP....rr.,.P
PP.,...rr..P
PPP...,.r.PP
PPPPP,..rrPP
PPPPPPPPPPPP
PPPPPPPPPPPP
PPPPPPPPPPPP
PPPPPPPPPPPP
PPPPPPPPPPPP
PPPPPPPPPPPP
"""

ZONES = [ZONE1, ZONE2, ZONE3, ZONE4, ZONE5]


def _join(blocks: list[str]) -> str:
    parts = [b.strip("\n").split("\n") for b in blocks]
    h = len(parts[0])
    for k, p in enumerate(parts):
        if len(p) != h:
            raise SystemExit(f"zone {k + 1}: {len(p)} rows, expected {h}")
        if len({len(r) for r in p}) != 1:
            raise SystemExit(f"zone {k + 1}: rows have different widths")
    return "\n".join("".join(p[y] for p in parts) for y in range(h))


MAP = _join(ZONES)

# 문자 → (타일 이름, 레이어)
TILES: dict[str, tuple[str, str]] = {
    ".": ("forest_floor", "ground"),
    ",": ("fallen_leaves", "ground"),
    "g": ("tall_grass", "ground"),
    "r": ("root_floor", "ground"),
    "~": ("stream", "ground"),
    "o": ("stepping_stone", "ground"),
    "P": ("pine_tree", "deco"),
    "S": ("stump", "deco"),
    "L": ("log", "deco"),
    "m": ("mushroom_patch", "deco"),
    "Y": ("signpost_fork", "deco"),
    "B": ("moss_stone", "deco"),
    "h": ("bush", "deco"),  # 개울 북쪽 끝의 덤불 줄(막힘). 나무꾼 대사의 '줄지어 있는 덤불'
    "H": ("bush", "deco"),  # 숨겨진 길 입구: 줄 끝(개울 쪽)의 덤불 하나만 지나갈 수 있다
}
PASSABLE_OVERRIDE = {"H"}
FLOORS = {"forest_floor", "root_floor", "stepping_stone"}

# 문자 → (오브젝트 ID, 종류, 속성, 밑바닥 강제(선택))
OBJECTS = {
    # 1 숲 입구
    "@": ("spawn_west", "spawn", {}, "root_floor"),
    "<": ("warp_west", "warp", {"target": "r01", "targetSpawn": "warp_east"}, "root_floor"),
    "!": ("t_forest_intro", "trigger", {"dialogue": "forest_intro", "once": True}, "root_floor"),
    "1": ("rune_L2-1", "rune", {"lesson": "L2-1"}, None),
    "A": ("sign_forest", "sign", {"dialogue": "sign_forest"}, None),
    "F": ("campfire_entrance", "campfire", {}, None),
    "i": ("m_P0201", "monster", {"problem": "P0201"}, "root_floor"),
    "j": ("m_P0202", "monster", {"problem": "P0202"}, "forest_floor"),
    "k": ("m_P0203", "monster", {"problem": "P0203"}, "root_floor"),
    # 2 고리 길
    "2": ("rune_L2-2", "rune", {"lesson": "L2-2"}, "forest_floor"),
    "E": ("sign_loop", "sign", {"dialogue": "sign_loop"}, "forest_floor"),
    "N": ("npc_lost_traveler", "npc", {"dialogue": "npc_lost_traveler", "sprite": "npc_traveler"}, "root_floor"),
    "l": ("m_P0204", "monster", {"problem": "P0204"}, "root_floor"),
    "n": ("m_P0205", "monster", {"problem": "P0205"}, "forest_floor"),
    "p": ("m_P0206", "monster", {"problem": "P0206"}, "root_floor"),
    "C": ("chest_loop", "chest", {"gold": 40, "dialogue": "chest_loop"}, "forest_floor"),
    # 3 멈춘 개울
    "3": ("rune_L2-3", "rune", {"lesson": "L2-3"}, None),
    "4": ("rune_L2-4", "rune", {"lesson": "L2-4"}, None),
    "W": ("npc_woodcutter", "npc", {"dialogue": "npc_woodcutter", "sprite": "npc_woodcutter"}, None),
    "G": ("campfire_stream", "campfire", {}, None),
    # 개울 쉼터의 그림자 게시판(docs/phase3/plan.md §5.2)
    "b": ("board_shadow_r02", "board", {}, "forest_floor"),
    "s": ("m_P0207", "monster", {"problem": "P0207"}, "stepping_stone"),
    "u": ("m_P0208", "monster", {"problem": "P0208"}, "forest_floor"),
    "D": ("chest_hidden_grove", "chest", {"gold": 60, "dialogue": "chest_hidden_grove"}, "forest_floor"),
    # 4 수호목 앞
    "v": ("m_P0209", "monster", {"problem": "P0209"}, "root_floor"),
    # 5 수호목의 공터
    "V": ("t_boss_intro", "trigger", {"dialogue": "boss_intro", "once": True}, "root_floor"),
    "X": ("m_P0210", "monster", {"problem": "P0210"}, "root_floor"),
    ">": (
        "warp_east",
        "warp",
        {
            "requires": "problem:P0210",
            "lockedDialogue": "east_gate_locked",
            "openDialogue": "to_be_continued",
            # 지역 간 이동(docs/phase3/region03-spec.md §4): 고블린 동굴 서쪽 입구로
            "target": "r03",
            "targetSpawn": "spawn_west",
        },
        "root_floor",
    ),
}

# 진행 순서 검증: (이 단계에서 제거하는 오브젝트, 이 단계에서 닿아야 하는 것, 아직 닿으면 안 되는 것)
STAGES: list[tuple[str | None, list[str], list[str]]] = [
    (None, ["warp_west", "t_forest_intro", "rune_L2-1", "sign_forest", "campfire_entrance", "m_P0201"], []),
    ("m_P0201", ["m_P0202", "m_P0203"], []),
    ("m_P0203", ["rune_L2-2", "sign_loop", "npc_lost_traveler", "m_P0204"], []),
    ("m_P0204", ["m_P0205", "chest_loop", "m_P0206"], []),
    ("m_P0206", ["rune_L2-3", "npc_woodcutter", "m_P0207", "m_P0208", "chest_hidden_grove"], []),
    ("m_P0207", ["rune_L2-4", "campfire_stream", "board_shadow_r02", "m_P0209"], []),
    ("m_P0209", ["t_boss_intro", "m_P0210"], []),
    ("m_P0210", ["warp_east"], []),
]
OPTIONAL = {"m_P0202", "m_P0205", "m_P0208"}


def _deco_under(name: str, ch: str, rows: list[str], x: int, y: int) -> str:
    # 숲 물체 타일은 숲 바닥을 그림에 품고 있으므로 밑바닥도 숲 바닥으로 맞춘다
    return "forest_floor"


SPEC = RegionSpec(
    region="r02",
    out=OUT,
    map_text=MAP,
    tiles=TILES,
    objects=OBJECTS,
    floors=FLOORS,
    deco_under=_deco_under,
    passable_override=PASSABLE_OVERRIDE,
    floor_alias={"fallen_leaves": "forest_floor", "tall_grass": "forest_floor"},
    default_floor="forest_floor",
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
    1: ["spawn_west", "warp_west", "t_forest_intro", "rune_L2-1", "sign_forest", "campfire_entrance",
        "m_P0201", "m_P0202", "m_P0203"],
    2: ["rune_L2-2", "sign_loop", "npc_lost_traveler", "m_P0204", "m_P0205", "m_P0206", "chest_loop"],
    3: ["rune_L2-3", "rune_L2-4", "npc_woodcutter", "campfire_stream", "board_shadow_r02", "m_P0207", "m_P0208", "chest_hidden_grove"],
    4: ["m_P0209"],
    5: ["t_boss_intro", "m_P0210", "warp_east"],
}


def validate(info: dict, verbose: bool) -> list[str]:
    errors = validate_stages(info, STAGES, OPTIONAL, verbose)
    pos = info["pos"]
    w, h = info["w"], info["h"]

    def dist(a: str, b: str) -> int:
        return abs(pos[a][0] - pos[b][0]) + abs(pos[a][1] - pos[b][1])

    # 구역: 오브젝트가 서 → 동 순서의 제 구역 블록 안에 있다
    bounds = zone_bounds()
    for z, ids in ZONE_OF.items():
        x0, x1 = bounds[z - 1]
        for oid in ids:
            if not x0 <= pos[oid][0] < x1:
                errors.append(f"{oid} should be in zone {z} (x {x0}..{x1 - 1}), at x={pos[oid][0]}")
    # 구역 출구 몬스터는 다음 구역과 맞닿은 한 칸짜리 길목에 있다
    for oid, z in (("m_P0203", 1), ("m_P0206", 2), ("m_P0209", 4)):
        if pos[oid][0] != bounds[z - 1][1] - 1:
            errors.append(f"{oid} should stand at the east edge of zone {z}")
    # 서쪽 시작: spawn 옆에 트리거, 트리거를 밟지 않고는 숲으로 들어갈 수 없다
    if dist("spawn_west", "t_forest_intro") != 1:
        errors.append("t_forest_intro must be next to spawn_west")
    if touches(info, reachable(info, set(), {pos["t_forest_intro"]}), "rune_L2-1"):
        errors.append("t_forest_intro can be bypassed")
    if dist("spawn_west", "warp_west") > 2:
        errors.append("warp_west must be near spawn_west")
    # 동쪽 끝 워프
    if pos["warp_east"][0] < w - 3:
        errors.append("warp_east must be at the far east")
    if pos["warp_west"][0] > 2:
        errors.append("warp_west must be at the far west")
    # 보스 앞 트리거: 두 칸 앞, 피할 수 없음
    if dist("m_P0210", "t_boss_intro") != 2:
        errors.append("t_boss_intro must be two tiles in front of the boss")
    pre_boss = removed_before(STAGES, "m_P0210")
    if touches(info, reachable(info, pre_boss, {pos["t_boss_intro"]}), "m_P0210"):
        errors.append("t_boss_intro can be bypassed")
    # 숨겨진 길: 덤불은 하나뿐이고 지나갈 수 있으며, 나무꾼 대사대로 개울을 따라 북쪽(나무꾼·디딤돌보다 북쪽)에서
    # 개울에 맞닿아 있다
    hidden = [(x, y) for y, r in enumerate(info["rows"]) for x, ch in enumerate(r) if ch == "H"]
    if len(hidden) != 1:
        errors.append("exactly one hidden bush expected")
        return errors
    hx, hy = hidden[0]
    if info["collision"][hy * w + hx] != 0:
        errors.append(f"hidden bush must be passable at ({hx},{hy})")
    if not any(info["rows"][hy + dy][hx + dx] == "~" for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
        errors.append("hidden bush must touch the frozen stream")
    if not hy < pos["npc_woodcutter"][1] or not hy < pos["m_P0207"][1]:
        errors.append("hidden bush must be north of the woodcutter and the stepping stones")
    grove = removed_before(STAGES, "chest_hidden_grove")
    blocked = reachable(info, grove, {(hx, hy)})
    for oid in ("chest_hidden_grove", "m_P0208"):
        if touches(info, blocked, oid):
            errors.append(f"{oid} reachable without the hidden bush")
    # 개울: 디딤돌 줄에서만 건넌다(m_P0207이 첫 디딤돌 위)
    if info["rows"][pos["m_P0207"][1]][pos["m_P0207"][0] + 1] != "o":
        errors.append("m_P0207 should block the stepping-stone crossing")
    # 몬스터가 요구하는 이 지역 주문서의 비석은 그 몬스터보다 먼저 닿아야 한다
    errors += check_runes_before_monsters(info, STAGES, REGION_DIR)
    # 바닥이 비지 않았다
    if any(v == 0 for v in info["ground"]):
        errors.append("ground layer has empty tiles")
    if h != 24:
        errors.append("map height should stay 24")
    return errors


if __name__ == "__main__":
    sys.exit(run(SPEC, validate, "tools/maps/build_r02.py"))
