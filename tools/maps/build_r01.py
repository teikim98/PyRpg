#!/usr/bin/env python3
"""지역 1(에코 마을) 맵 생성기: 아스키 도면 → Tiled JSON(.tmj).

사용법: python3 tools/maps/build_r01.py [--check] [--print]
  --check  파일을 쓰지 않고 검증만 한다(현재 map.tmj와 내용이 다르면 실패)
  --print  도면과 구역별 도달 범위를 출력한다

레이어·검증 도구는 tools/maps/common.py에 있다. deco 레이어에는 나무·덤불·가로등·노점·화단·울타리·우물이
들어가고, collision에서는 숨겨진 방 입구 덤불(H)만 뺀다.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (  # noqa: E402
    ROOT,
    RegionSpec,
    neighbor_floor,
    reachable,
    removed_before,
    run,
    touches,
    validate_stages,
)

OUT = ROOT / "content" / "regions" / "r01-echo-village" / "map.tmj"

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
        {"lockedDialogue": "east_gate_locked", "requires": "problem:P0105", "openDialogue": "to_be_continued"},
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


def _deco_under(name: str, ch: str, rows: list[str], x: int, y: int) -> str:
    # 나무·덤불은 늘 풀밭 위에, 나머지 데코는 주변 바닥 위에 놓는다
    return "grass" if name in ("tree", "bush") and ch != "H" else neighbor_floor(SPEC, rows, x, y)


SPEC = RegionSpec(
    region="r01",
    out=OUT,
    map_text=MAP,
    tiles=TILES,
    objects=OBJECTS,
    floors=FLOORS,
    deco_under=_deco_under,
    passable_override=PASSABLE_OVERRIDE,
    floor_alias={"grass_flower": "grass"},
    default_floor="grass",
    # 지역 1 맵은 지역 1 타일 24종만 쓴다. 타일셋 끝에 다른 지역 타일이 붙어도 이 맵 파일은 바뀌지 않는다
    tile_limit=24,
    start="spawn",
)


def validate(info: dict, verbose: bool) -> list[str]:
    errors = validate_stages(info, STAGES, OPTIONAL, verbose)

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
    pre_boss = removed_before(STAGES, "m_P0105")
    if touches(info, reachable(info, pre_boss, {pos["t_boss_intro"]}), "m_P0105"):
        errors.append("t_boss_intro can be bypassed")
    # 숨겨진 방: 표지판에서 동쪽 7칸(len('serpent')), 북쪽 4칸(2 ** 2)
    ex, ey = pos["sign_alley_riddle"]
    hx, hy = ex + len("serpent"), ey - 2**2
    w = info["w"]
    if info["rows"][hy][hx] != "H" or info["collision"][hy * w + hx] != 0:
        errors.append(f"hidden bush must be passable at ({hx},{hy})")
    alley = set(STAGES[i][0] for i in range(1, 6))
    if touches(info, reachable(info, alley, {(hx, hy)}), "chest_hidden"):
        errors.append("hidden room reachable without the hidden bush")
    return errors


if __name__ == "__main__":
    sys.exit(run(SPEC, validate, "tools/maps/build_r01.py"))
