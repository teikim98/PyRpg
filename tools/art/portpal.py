"""지역 5(교역항) 확장 팔레트와 그리기 도구.

누리·숲·동굴·도서관 팔레트와 같은 원칙: 재질마다 5~7단계 램프를 두고 어두운 쪽은 남색·자주 쪽으로, 밝은 쪽은
따뜻한 노랑 쪽으로 색상을 비튼다(hue-shift). 외곽선은 순수 검정 대신 재질에 맞춘 짙은 색이다.
항구는 밝은 바다색(청록 파랑), 햇볕에 바랜 나무 부두, 모래빛 자갈길, 흰 돛·천이 바탕이고,
강조색은 굳은 파도와 공중에 걸린 물보라에 낀 청록 서리, 그리고 상인들의 금테다.
해파리는 반투명(알파) 색을 쓴다.

그리드는 지역 범례(ASCII 문자 → 색 이름)로 쓰고 paint()로 팔레트 문자 그리드로 바꾼다.
색 이름 → 팔레트 문자는 앞선 팔레트들과 겹치지 않는 한글 음절(U+B400부터)로 등록 순서대로 배정한다(결정적).
"""
import textwrap

import librarypal  # noqa: F401  앞선 팔레트를 먼저 등록해 문자 충돌 검사가 의미 있게 한다
from gridlib import PALETTE, _rgba

COLORS = {
    # 색 외곽선(재질별)
    "ol_wood": "26141c", "ol_stone": "1e1a2a", "ol_sea": "0a1a34", "ol_ice": "0a2234", "ol_cloth": "2a0a1a",
    "ol_gold": "3a1a10", "ol_rope": "2e1a12", "ol_fish": "0e1c30", "ol_bird": "1e2034", "ol_jelly": ("341048", 235),
    "ol_leaf": "0e2418", "ol_crab": "3a0e14", "ol_skin": "3a1418", "ol_navy": "0a0c22", "ol_paper": "3a2a26",
    # 햇볕에 바랜 나무(부두·상자·통): 그늘은 자주 갈색, 밝은 쪽은 꿀빛
    "w0": "2a1820", "w1": "44282a", "w2": "6a4232", "w3": "8e6040", "w4": "b4844e", "w5": "d6aa6a", "w6": "f0d29a",
    # 밀수선 갑판(짙은 붉은 나무)
    "d0": "22101a", "d1": "3a1a22", "d2": "582a2a", "d3": "783c30", "d4": "9a5838", "d5": "bc7a4a",
    # 자갈길(모래빛 회색): 그늘은 남보라, 밝은 쪽은 따뜻한 상아
    "c0": "3a3042", "c1": "5a4c5a", "c2": "7c6c72", "c3": "a08e88", "c4": "c2b09c", "c5": "e0d2b8", "c6": "f6ecd6",
    # 바다(밝은 청록 파랑)
    "b0": "0c2448", "b1": "143a6c", "b2": "1d5a92", "b3": "2a7cb2", "b4": "46a2d0", "b5": "84cce6", "b6": "d2f2f8",
    # 청록 서리(멈춘 시간)
    "i0": "0f2f44", "i1": "18506a", "i2": "2b8098", "i3": "4fb8c9", "i4": "93e2e6", "i5": "e8fcf6",
    # 돛·천·종이(흰 캔버스)
    "a0": "5e4c4c", "a1": "8c7c74", "a2": "b8aa9c", "a3": "dcd2c2", "a4": "f2ece0", "a5": "fffdf6",
    # 밧줄(삼베)
    "p0": "4a2c1a", "p1": "6e4626", "p2": "98683a", "p3": "c09456", "p4": "e2c07e", "p5": "f8e4ac",
    # 빨강(차양·띠·장부 표지)
    "r0": "3e0c1c", "r1": "6a1628", "r2": "9a2436", "r3": "c84444", "r4": "ea7a62",
    # 남색(차양·선장 외투)
    "q0": "121838", "q1": "1c2858", "q2": "2a3c7e", "q3": "405ca8", "q4": "6a8cd0",
    # 금(테·단추·동전)
    "g0": "4a2418", "g1": "7a3e1c", "g2": "b06a24", "g3": "e0a032", "g4": "f8d25a", "g5": "fff2a8",
    # 은빛 물고기 비늘(푸른 은색)
    "x0": "18283e", "x1": "2c4664", "x2": "486c8e", "x3": "709cb6", "x4": "a6cadc", "x5": "e0f4f8",
    # 산호(지느러미·작은 게·소라게 다리)
    "o0": "5a1a14", "o1": "8e2e18", "o2": "c24e1e", "o3": "ea7c30", "o4": "f8ac5a", "o5": "ffd894",
    # 갈매기(흰 깃·회색 날개)
    "y0": "34364e", "y1": "585c76", "y2": "868ca4", "y3": "b6bccc", "y4": "e0e6ee", "y5": "ffffff",
    # 해파리(반투명 분홍 보라). 알파가 낮을수록 비친다
    "j0": ("4a2068", 225), "j1": ("7a3a9a", 205), "j2": ("a45ac0", 190), "j3": ("cc88dc", 180),
    "j4": ("ecbcf0", 190), "j5": ("fff0ff", 215),
    # 앵무새 초록
    "e0": "0e2c22", "e1": "18482e", "e2": "246c38", "e3": "3a963e", "e4": "6ec24a", "e5": "b2e46e",
    # 피부
    "s0": "5a2a2a", "s1": "8a4638", "s2": "be7458", "s3": "e6a27a", "s4": "f8caa0",
    # 짙은 색(삼각모·장화·안대·쇠테)
    "k0": "100c18", "k1": "1c1828", "k2": "2c283c", "k3": "443f56", "k4": "666078", "k5": "948ea4",
    # 수염·머리(갈색)
    "h0": "2a1410", "h1": "4a2418", "h2": "6e3c22", "h3": "965a30", "h4": "c08448",
    # 길드장 외투(짙은 청록 벨벳)
    "v0": "0e2628", "v1": "143c3c", "v2": "1c5856", "v3": "2a7a72", "v4": "48a092", "v5": "84c8b0",
    # 등대 벽(흰 회벽)
    "l0": "3a3446", "l1": "6a6276", "l2": "9c94a4", "l3": "c8c2c8", "l4": "eae6e2", "l5": "ffffff",
    # 기타
    "white": "ffffff", "eye": "1d1a28", "blush": "e07a6a",
}

_POOL = "".join(chr(c) for c in range(0xB400, 0xB400 + 400))

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
    "w": "ol_wood", "d": "ol_wood", "c": "ol_stone", "b": "ol_sea", "i": "ol_ice", "a": "ol_paper", "p": "ol_rope",
    "r": "ol_cloth", "q": "ol_navy", "g": "ol_gold", "x": "ol_fish", "o": "ol_crab", "y": "ol_bird", "j": "ol_jelly",
    "e": "ol_leaf", "s": "ol_skin", "k": "ol_navy", "h": "ol_wood", "v": "ol_leaf", "l": "ol_stone",
}
# 외곽선 고를 때 우선순위(앞이 이긴다): 몸통처럼 형태를 읽게 하는 재질을 먼저
_PRIORITY = "jxyeoskqvhrapwdgbcli"


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


def shade_right(g, from_x: int, skip: tuple = ("eye", "white", "i5", "g5", "a5", "y5", "b6", "j5")):
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
