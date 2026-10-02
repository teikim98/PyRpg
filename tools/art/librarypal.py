"""지역 4(무너진 대도서관) 확장 팔레트와 그리기 도구.

누리·숲·동굴 팔레트와 같은 원칙: 재질마다 5~7단계 램프를 두고 어두운 쪽은 자주·남색 쪽으로, 밝은 쪽은 따뜻한
노랑 쪽으로 색상을 비튼다(hue-shift). 외곽선은 순수 검정 대신 재질에 맞춘 짙은 색이다.
도서관은 따뜻한 나무(책장·마루)와 양피지가 바탕이고, 강조색은 멈춘 촛불과 떠 있는 페이지에 낀 청록 서리,
그리고 책등의 금박이다. 유령 사서는 반투명(알파) 색을 쓴다.

그리드는 지역 범례(ASCII 문자 → 색 이름)로 쓰고 paint()로 팔레트 문자 그리드로 바꾼다.
색 이름 → 팔레트 문자는 앞선 팔레트들과 겹치지 않는 한글 음절(U+B000부터)로 등록 순서대로 배정한다(결정적).
"""
import textwrap

import cavepal  # noqa: F401  앞선 팔레트를 먼저 등록해 문자 충돌 검사가 의미 있게 한다
from gridlib import PALETTE, _rgba

COLORS = {
    # 색 외곽선(재질별)
    "ol_wood": "24101a", "ol_paper": "3a2016", "ol_ice": "0a2234", "ol_ink": "080a1e", "ol_stone": "1a1420",
    "ol_cloth": "2a0a1a", "ol_gold": "3a1a10", "ol_owl": "120f26", "ol_leaf": "102418", "ol_ghost": ("123440", 230),
    # 나무(책장·마루·책상): 그늘은 자주 갈색, 밝은 쪽은 꿀빛
    "w0": "26121c", "w1": "3e1e24", "w2": "5c3028", "w3": "80482e", "w4": "a46636", "w5": "c88a48", "w6": "e6b46c",
    # 양피지(페이지·두루마리·책장 속지)
    "a0": "5e3e36", "a1": "8c6650", "a2": "b8946e", "a3": "dcc090", "a4": "f2e2b8", "a5": "fffbea",
    # 카펫·책 표지(짙은 포도주색)
    "r0": "360c20", "r1": "5a142e", "r2": "84203a", "r3": "ae3a46", "r4": "d86a5c",
    # 금박(책등 글자·액자·안경테)
    "g0": "4a2418", "g1": "7a3e1c", "g2": "b06a24", "g3": "e0a032", "g4": "f8d25a", "g5": "fff2a8",
    # 청록 서리(멈춘 시간)
    "i0": "0f2f44", "i1": "18506a", "i2": "2b8098", "i3": "4fb8c9", "i4": "93e2e6", "i5": "e8fcf6",
    # 돌(벽·기둥): 그늘은 남보라, 밝은 쪽은 따뜻한 회백
    "s0": "1a1422", "s1": "2a2232", "s2": "3e3446", "s3": "564a5a", "s4": "786a72", "s5": "a2928e", "s6": "cec0b0",
    # 잉크(검푸른 슬라임): 그늘은 거의 검정, 밝은 쪽은 하늘빛
    "k0": "0a0c20", "k1": "141c3a", "k2": "222e5a", "k3": "34487e", "k4": "5470a8", "k5": "8aaede",
    # 책 표지 초록
    "e0": "142a24", "e1": "1e4232", "e2": "2e6040", "e3": "4a8450", "e4": "7aac62",
    # 책 표지 파랑
    "u0": "161a3e", "u1": "222c62", "u2": "34468c", "u3": "5068b4", "u4": "7e98d8",
    # 부엉이 깃(밤하늘 남보라)
    "o0": "16142a", "o1": "26223e", "o2": "3a3458", "o3": "564e78", "o4": "7c749e", "o5": "aaa2c6",
    # 유령 사서(반투명 청백). 알파가 낮을수록 비친다
    "h0": ("2c5c6c", 210), "h1": ("4a8696", 200), "h2": ("74b2bc", 190), "h3": ("a8dcdc", 185),
    "h4": ("dcf6f0", 200), "h5": ("ffffff", 215),
    # 불꽃(얼어붙은 촛불 속에 멈춘 주황)
    "f0": "8a2a1c", "f1": "d0542a", "f2": "f8963c", "f3": "ffd27a",
    # 촛농(상아)
    "c0": "6e5a58", "c1": "a8968a", "c2": "d6cab4", "c3": "f4ecd8",
    # 기타
    "white": "ffffff", "eye": "1d1a28", "blush": "e07a6a",
}

_POOL = "".join(chr(c) for c in range(0xB000, 0xB000 + 400))

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
    "w": "ol_wood", "a": "ol_paper", "r": "ol_cloth", "g": "ol_gold", "i": "ol_ice", "s": "ol_stone",
    "k": "ol_ink", "e": "ol_leaf", "u": "ol_ink", "o": "ol_owl", "h": "ol_ghost", "f": "ol_cloth", "c": "ol_paper",
}
# 외곽선 고를 때 우선순위(앞이 이긴다): 몸통처럼 형태를 읽게 하는 재질을 먼저
_PRIORITY = "hokaruewcgsif"


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
    다른 팔레트의 문자에 닿은 칸은 돌 외곽선으로 칠한다."""
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


def shade_right(g, from_x: int, skip: tuple = ("eye", "white", "i5", "g5", "a5", "h5")):
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
