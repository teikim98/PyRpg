"""지역 7(모래시계 사막) 확장 팔레트와 그리기 도구.

누리·숲·동굴·도서관·항구·호수 팔레트와 같은 원칙: 재질마다 5~7단계 램프를 두고 어두운 쪽은 자주·남색 쪽으로, 밝은 쪽은
따뜻한 노랑 쪽으로 색상을 비튼다(hue-shift). 외곽선은 순수 검정 대신 재질에 맞춘 짙은 색이다.
사막은 한낮의 주황 모래와 붉은 사암이 바탕이고, 강조색은 청록 오아시스와 밤하늘 남색(별자리 유적), 그리고 시계 룬의
청록 서리다. 모래시계 틀과 제단은 금·황동.

그리드는 지역 범례(ASCII 문자 → 색 이름)로 쓰고 paint()로 팔레트 문자 그리드로 바꾼다.
색 이름 → 팔레트 문자는 앞선 팔레트들과 겹치지 않는 한글 음절(U+BC00부터)로 등록 순서대로 배정한다(결정적).
그리기 도구(paint·color_outline·shade_right·sym·ramp_rows)는 lakepal.py와 같다.
"""
import textwrap

import lakepal  # noqa: F401  앞선 팔레트를 먼저 등록해 문자 충돌 검사가 의미 있게 한다
from gridlib import PALETTE, _rgba

COLORS = {
    # 색 외곽선(재질별)
    "ol_sand": "2e1a1c", "ol_rock": "26101a", "ol_water": "061a20", "ol_leaf": "0c2014", "ol_night": "0a0a1e",
    "ol_bone": "2e2026", "ol_gold": "3a1a10", "ol_wood": "1e1014", "ol_ice": "0a2234", "ol_mist": ("1e1430", 225),
    "ol_skin": "3a1418", "ol_cloth": "141a2c", "ol_clay": "2a0e12",
    # 모래(한낮의 주황 모래): 그늘은 자주 갈색, 빛은 크림색
    "d0": "3a2028", "d1": "683830", "d2": "9a5834", "d3": "c67c3c", "d4": "e0a052", "d5": "f0c47a", "d6": "fae4ae",
    # 붉은 사암(협곡 벽·포석)
    "r0": "2a1420", "r1": "4c1e28", "r2": "763030", "r3": "a04634", "r4": "c4643c", "r5": "dc8a58", "r6": "f0b486",
    # 오아시스 물(청록)
    "o0": "0a2030", "o1": "0e3a48", "o2": "145a62", "o3": "1e7e7a", "o4": "38a294", "o5": "74c8ac", "o6": "c2eed2",
    # 야자·선인장 초록
    "e0": "102418", "e1": "1a3c22", "e2": "2a5a2a", "e3": "40782e", "e4": "66983a", "e5": "98b84a", "e6": "cad87a",
    # 밤하늘 남색(별자리 유적 바닥·망토)
    "v0": "0c0c22", "v1": "161a3c", "v2": "222a58", "v3": "323e78", "v4": "4a5a9a", "v5": "7a8cc4", "v6": "c0cce8",
    # 바랜 뼈·흰 돌(해골·기둥·제단)
    "b0": "4a3a3e", "b1": "786660", "b2": "a8968a", "b3": "cec0ae", "b4": "ece2cc", "b5": "fffaee",
    # 금·황동(모래시계 틀, 제단 무늬)
    "g0": "4a2418", "g1": "7a3e1c", "g2": "b06a24", "g3": "e0a032", "g4": "f8d25a", "g5": "fff2a8",
    # 청록 서리(멈춘 시간, 시계 룬)
    "i0": "0f2f44", "i1": "18506a", "i2": "2b8098", "i3": "4fb8c9", "i4": "93e2e6", "i5": "e8fcf6",
    # 신기루 보랏빛(일렁임)
    "u0": "2a1c3e", "u1": "4a2e62", "u2": "704a8a", "u3": "9a70b0", "u4": "c4a0d4", "u5": "eed8f2",
    # 나무(다리 널)
    "w0": "241618", "w1": "40262a", "w2": "603a34", "w3": "845440", "w4": "a87454", "w5": "c89a6e", "w6": "e6c49a",
    # 토기(항아리)
    "a0": "3a1418", "a1": "62261e", "a2": "8e3c24", "a3": "b85a2e", "a4": "d87e44", "a5": "eeaa6c",
    # 짙은 색(전갈 등딱지·그림자)
    "k0": "120a14", "k1": "22121e", "k2": "361c28", "k3": "502a32", "k4": "6e3c3c", "k5": "945a4c",
    # 터번·두건 천(남청)과 흰 천
    "q0": "18183a", "q1": "262a5a", "q2": "36407e", "q3": "4e5ea2", "q4": "7488c4",
    "t0": "6a5e66", "t1": "988c8c", "t2": "c4b8ac", "t3": "e8dece", "t4": "fffaf0",
    # 피부(햇볕에 그을림)
    "c0": "4a2020", "c1": "7a3a2c", "c2": "a85a3c", "c3": "d08456", "c4": "eaae7c",
    # 유령빛(반투명 청백)
    "h1": ("5a8aa0", 170), "h2": ("8cc0d0", 185), "h3": ("bce4ea", 200), "h4": ("e6fafa", 215),
    # 신기루 반투명(도마뱀 몸)
    "m1": ("4a7a7a", 160), "m2": ("6aa4a0", 180), "m3": ("98ccc0", 195), "m4": ("d0f0e0", 210),
    # 기타
    "white": "ffffff", "eye": "1d1a28", "blush": "e07a6a",
}

_POOL = "".join(chr(c) for c in range(0xBC00, 0xBC00 + 400))

CH = {}
for _i, (_name, _val) in enumerate(COLORS.items()):
    _c = _POOL[_i]
    if _c in PALETTE:
        raise ValueError(f"palette char clash: {_c!r}")
    PALETTE[_c] = _rgba(_val[0], _val[1]) if isinstance(_val, tuple) else _rgba(_val)
    CH[_name] = _c
NAME = {c: n for n, c in CH.items()}

# 색 이름 접두 → 외곽선 색 이름
_OUTLINE_BY_PREFIX = {
    "d": "ol_sand", "r": "ol_rock", "o": "ol_water", "e": "ol_leaf", "v": "ol_night", "b": "ol_bone", "g": "ol_gold",
    "i": "ol_ice", "u": "ol_mist", "w": "ol_wood", "a": "ol_clay", "k": "ol_cloth", "q": "ol_cloth", "t": "ol_bone",
    "c": "ol_skin", "h": "ol_mist", "m": "ol_mist",
}
# 외곽선 고를 때 우선순위(앞이 이긴다): 몸통처럼 형태를 읽게 하는 재질을 먼저
_PRIORITY = "kaqtchmbrdgvwueoi"


def outline_of(ch: str) -> str:
    name = NAME.get(ch, "")
    return CH[_OUTLINE_BY_PREFIX.get(name[:1], "ol_rock") if name[1:2].isdigit() else "ol_rock"]


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
    다른 팔레트의 문자에 닿은 칸은 바위 외곽선으로 칠한다."""
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
                out[y][x] = CH["ol_rock"]
                continue
            best = min(ours, key=lambda c: _PRIORITY.find(NAME[c][0]) if NAME[c][0] in _PRIORITY else 99)
            out[y][x] = outline_of(best)
    return ["".join(r) for r in out]


def shade_right(g, from_x: int, skip: tuple = ("eye", "white", "i5", "g5", "b5", "t4", "d6", "o6")):
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


def sym(half: str) -> str:
    """왼쪽 절반 행들 → 좌우 대칭 행들(문자 그대로 거울)."""
    rows = [r.strip() for r in half.strip("\n").splitlines() if r.strip()]
    return "\n".join(r + r[::-1] for r in rows)


def ramp_rows(g, ramp: str):
    """숫자 그리드(2차원 리스트) → 한 램프의 팔레트 문자 그리드."""
    return ["".join(CH[f"{ramp}{v}"] for v in row) for row in g]
