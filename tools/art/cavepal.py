"""지역 3(고블린 동굴) 확장 팔레트와 그리기 도구.

누리·숲 팔레트와 같은 원칙: 재질마다 5~7단계 램프를 두고 어두운 쪽은 청록·남보라 쪽으로, 밝은 쪽은 따뜻한 쪽으로
색상을 비튼다(hue-shift). 외곽선은 순수 검정 대신 재질에 맞춘 짙은 색이다.
동굴은 어둡지만 읽기 쉽게: 바닥은 중간 밝기의 보랏빛 흙, 벽은 그보다 어둡고 윗면에 밝은 가장자리가 있다.
강조색은 멈춘 횃불의 청록 서리와 보물 더미의 금빛 두 가지다.

그리드는 지역 범례(ASCII 문자 → 색 이름)로 쓰고 paint()로 팔레트 문자 그리드로 바꾼다.
색 이름 → 팔레트 문자는 앞선 팔레트들과 겹치지 않는 한글 음절로 등록 순서대로 배정한다(결정적).
"""
import textwrap

import forestpal  # noqa: F401  앞선 팔레트를 먼저 등록해 문자 충돌 검사가 의미 있게 한다
from gridlib import PALETTE, _rgba

COLORS = {
    # 색 외곽선(재질별)
    "ol_stone": "100a18", "ol_ice": "0a2234", "ol_gold": "3a1610", "ol_skin": "0e2018", "ol_violet": "1a0e2e",
    "ol_bone": "3a2830", "ol_red": "3e1222", "ol_wood": "2a1420", "ol_iron": "12121e", "ol_pool": "0a1230",
    "ol_cloth": "1a1a36",
    # 동굴 바닥(보랏빛 흙): 그늘은 남보라, 밝은 쪽은 따뜻한 회갈
    "d0": "1c1626", "d1": "2b2234", "d2": "3a2e40", "d3": "4a3c4c", "d4": "5e4e58", "d5": "7a6868", "d6": "a08e80",
    # 동굴 벽(차가운 돌): 그늘은 남색, 윗면은 따뜻한 회색
    "c0": "120e1c", "c1": "1e1a2c", "c2": "2c283e", "c3": "3e3a52", "c4": "565268", "c5": "76707e", "c6": "a49c9c",
    # 청록 서리(멈춘 시간)
    "i0": "0f2f44", "i1": "18506a", "i2": "2b8098", "i3": "4fb8c9", "i4": "93e2e6", "i5": "e8fcf6",
    # 금(보물): 그늘은 적갈, 밝은 쪽은 연노랑
    "g0": "4a2418", "g1": "7a3e1c", "g2": "b06a24", "g3": "e0a032", "g4": "f8d25a", "g5": "fff2a8",
    # 수정(보라)
    "v0": "2a1a48", "v1": "46306e", "v2": "6a4c9c", "v3": "9478c8", "v4": "c4abea", "v5": "f2e8ff",
    # 고블린 피부(초록): 그늘은 청록 쪽, 밝은 쪽은 노랑 쪽
    "n0": "1a3330", "n1": "264a36", "n2": "3a6a3a", "n3": "5a8c3c", "n4": "88b44a", "n5": "c6dc6e",
    # 뼈·상아
    "b0": "5a4450", "b1": "8a7678", "b2": "bcae9c", "b3": "e4dac0", "b4": "fff8e6",
    # 빨강(게 껍데기·천)
    "r0": "4e1530", "r1": "8a2238", "r2": "c23a44", "r3": "e86a5e", "r4": "f9a98a",
    # 나무(상자·침목)
    "w0": "2c1826", "w1": "472728", "w2": "6b3d2e", "w3": "915d3a", "w4": "b8854e", "w5": "dcb676",
    # 쇠(레일·안경테)
    "m0": "222234", "m1": "3a3a50", "m2": "5c6076", "m3": "8a90a4", "m4": "c4c8d2",
    # 웅덩이(거울처럼 비치는 짙은 물)
    "p0": "0e1630", "p1": "18284e", "p2": "243e70", "p3": "38609a", "p4": "6a9ccc", "p5": "c8ecff",
    # 서기의 조끼(남색 천)
    "q0": "1c1e40", "q1": "2c3264", "q2": "424c8a", "q3": "6474b0",
    # 불꽃(얼어붙은 횃불 속에 멈춘 주황)
    "f0": "8a2a1c", "f1": "d0542a", "f2": "f8963c", "f3": "ffd27a",
    # 기타
    "white": "ffffff", "eye": "1d1a28", "blush": "e07a6a",
}

_POOL = "".join(chr(c) for c in range(0xAC00, 0xAC00 + 400))

CH = {}
for _i, (_name, _hex) in enumerate(COLORS.items()):
    _c = _POOL[_i]
    if _c in PALETTE:
        raise ValueError(f"palette char clash: {_c!r}")
    PALETTE[_c] = _rgba(_hex)
    CH[_name] = _c
NAME = {c: n for n, c in CH.items()}

# 색 이름 접두 → 외곽선 색 이름
_OUTLINE_BY_PREFIX = {
    "d": "ol_stone", "c": "ol_stone", "i": "ol_ice", "g": "ol_gold", "v": "ol_violet", "n": "ol_skin",
    "b": "ol_bone", "r": "ol_red", "w": "ol_wood", "m": "ol_iron", "p": "ol_pool", "q": "ol_cloth", "f": "ol_red",
}
# 외곽선 고를 때 우선순위(앞이 이긴다): 피부·옷처럼 형태를 읽게 하는 재질을 먼저
_PRIORITY = "nqrgbvmwpicdf"


def outline_of(ch: str) -> str:
    name = NAME.get(ch, "")
    return CH[_OUTLINE_BY_PREFIX.get(name[:1], "ol_stone") if name[1:2].isdigit() else "ol_stone"]


def paint(text: str, legend: dict, width: int | None = None, height: int | None = None):
    """지역 범례로 쓴 그리드 → 팔레트 문자 그리드. '.'은 투명, 'K'는 외곽선 자리."""
    rows = [line.strip() for line in textwrap.dedent(text).strip("\n").splitlines()]
    rows = [r for r in rows if r]
    out = []
    for j, r in enumerate(rows):
        line = []
        for ch in r:
            if ch in ".K" and ch not in legend:
                line.append(ch)
            elif ch in legend:
                line.append(CH[legend[ch]])
            else:
                raise ValueError(f"row {j}: {ch!r} not in legend")
        out.append("".join(line))
    w = len(out[0])
    for j, r in enumerate(out):
        if len(r) != w:
            raise ValueError(f"row {j} has width {len(r)}, expected {w}: {rows[j]!r}")
    if width is not None and w != width:
        raise ValueError(f"grid width {w} != {width}")
    if height is not None and len(out) != height:
        raise ValueError(f"grid height {len(out)} != {height}")
    return out


def color_outline(g, mark: str = "K"):
    """투명 칸 중 불투명 칸에 상하좌우로 닿은 칸(또는 mark 칸)을 닿은 재질의 색 외곽선으로 칠한다.
    다른 팔레트의 문자(누리·숲)에 닿은 칸은 동굴 돌 외곽선으로 칠한다."""
    h, w = len(g), len(g[0])
    out = [list(r) for r in g]
    for y in range(h):
        for x in range(w):
            if g[y][x] not in (".", mark):
                continue
            nbs = [g[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                   if 0 <= x + dx < w and 0 <= y + dy < h]
            nbs = [c for c in nbs if c != "." and c != mark and not NAME.get(c, "").startswith("ol_")]
            if g[y][x] == "." and not nbs:
                continue
            ours = [c for c in nbs if c in NAME]
            if not ours:
                out[y][x] = CH["ol_stone"]
                continue
            best = min(ours, key=lambda c: _PRIORITY.find(NAME[c][0]) if NAME[c][0] in _PRIORITY else 99)
            out[y][x] = outline_of(best)
    return ["".join(r) for r in out]


def shade_right(g, from_x: int, skip: tuple = ("eye", "white", "i5", "g5", "r0")):
    """좌우 대칭으로 그린 몸에 왼쪽 위 빛을 준다: from_x부터 오른쪽 칸은 같은 램프에서 한 단계 어둡게."""
    out = []
    for row in g:
        line = list(row)
        for x in range(from_x, len(line)):
            name = NAME.get(line[x], "")
            if not name or name in skip or name.startswith("ol_") or not name[1:].isdigit():
                continue
            k = int(name[1:])
            darker = f"{name[0]}{k - 1}"
            if k > 0 and darker in CH:
                line[x] = CH[darker]
        out.append("".join(line))
    return out
