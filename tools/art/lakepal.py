"""지역 6(거울 호수) 확장 팔레트와 그리기 도구.

누리·숲·동굴·도서관·항구 팔레트와 같은 원칙: 재질마다 5~7단계 램프를 두고 어두운 쪽은 남색·자주 쪽으로, 밝은 쪽은
따뜻한 노랑 쪽으로 색상을 비튼다(hue-shift). 외곽선은 순수 검정 대신 재질에 맞춘 짙은 색이다.
호수는 짙은 청록 물(흐르는 물), 은빛 하늘색 거울 수면(굳은 물), 모래빛 호숫가, 버드나무 초록, 금빛 갈대가 바탕이고,
강조색은 은빛 거울 반사와 옅은 보랏빛 안개, 그리고 시계 룬의 청록 서리다.

그리드는 지역 범례(ASCII 문자 → 색 이름)로 쓰고 paint()로 팔레트 문자 그리드로 바꾼다.
색 이름 → 팔레트 문자는 앞선 팔레트들과 겹치지 않는 한글 음절(U+B800부터)로 등록 순서대로 배정한다(결정적).
그리기 도구(paint·color_outline·shade_right·sym·ramp_rows)는 portpal.py와 같다.
"""
import textwrap

import portpal  # noqa: F401  앞선 팔레트를 먼저 등록해 문자 충돌 검사가 의미 있게 한다
from gridlib import PALETTE, _rgba

COLORS = {
    # 색 외곽선(재질별)
    "ol_water": "081a26", "ol_mirror": "1a2244", "ol_sand": "2e2230", "ol_leaf": "0c2216", "ol_reed": "1a200c",
    "ol_wood": "241a22", "ol_stone": "1a1828", "ol_pink": "3a0e2a", "ol_mist": ("1e1a36", 235), "ol_gold": "3a1a10",
    "ol_frog": "0c2410", "ol_eel": "0c0c24", "ol_bird": "1e2034", "ol_skin": "3a1418", "ol_cloth": "141a2c",
    "ol_ice": "0a2234",
    # 호수 물(흐르는 물): 짙은 청록. 밝은 쪽은 연한 민트
    "n0": "0a1c2e", "n1": "113248", "n2": "184a60", "n3": "236478", "n4": "378490", "n5": "68aeae", "n6": "b2dcd0",
    # 거울 수면(굳은 물): 하늘색 반사와 은빛. 그늘은 남보라
    "m0": "3a4678", "m1": "566ca2", "m2": "7a94c6", "m3": "a2bee4", "m4": "c8dcf4", "m5": "e6f0fc", "m6": "ffffff",
    # 호숫가 모래·조약돌(따뜻한 회갈색)
    "t0": "382e3e", "t1": "584852", "t2": "7c6866", "t3": "a08a7a", "t4": "c2ac92", "t5": "e0ceae", "t6": "f4e8ca",
    # 풀(버드나무 잎·섬 풀): 맑은 초록
    "e0": "0c2822", "e1": "15402c", "e2": "205c38", "e3": "327a3e", "e4": "529c48", "e5": "88c460", "e6": "c4e48c",
    # 안개 낀 풀(회록에 보랏빛)
    "f0": "1e2636", "f1": "2c3c44", "f2": "425450", "f3": "5c7062", "f4": "80927c", "f5": "a8b49c",
    # 안개(옅은 보라)
    "u0": "282240", "u1": "443c66", "u2": "645a8a", "u3": "887eac", "u4": "aea6cc", "u5": "d6d0ea", "u6": "f0ecfa",
    # 갈대(금빛 초록 줄기)
    "r0": "1c220e", "r1": "323e18", "r2": "4c5c22", "r3": "6c7c2c", "r4": "94a03c", "r5": "c0c25c", "r6": "e6e08e",
    # 갈색(부들 이삭·버드나무 줄기·삿대)
    "h0": "22141a", "h1": "3c2022", "h2": "5c3226", "h3": "7c4a30", "h4": "9e683e", "h5": "c48e56",
    # 비바람에 바랜 은회색 나무(다리)
    "w0": "221c2a", "w1": "3a323e", "w2": "584c54", "w3": "7a6a6a", "w4": "9e8c82", "w5": "c2b2a0", "w6": "e2d6c2",
    # 돌(메아리 바위·징검돌·조약돌): 푸른 회보라
    "s0": "1a182a", "s1": "302e46", "s2": "4a4864", "s3": "6a6884", "s4": "908ea6", "s5": "bab8ca", "s6": "e0deea",
    # 분홍(연꽃)
    "p0": "48183a", "p1": "782850", "p2": "ae4872", "p3": "de7898", "p4": "f4acc2", "p5": "ffdeea",
    # 금(테·눈·쪽지 핀)
    "g0": "4a2418", "g1": "7a3e1c", "g2": "b06a24", "g3": "e0a032", "g4": "f8d25a", "g5": "fff2a8",
    # 청록 서리(멈춘 시간, 시계 룬)
    "i0": "0f2f44", "i1": "18506a", "i2": "2b8098", "i3": "4fb8c9", "i4": "93e2e6", "i5": "e8fcf6",
    # 짙은 색
    "k0": "100c18", "k1": "1c1828", "k2": "2c283c", "k3": "443f56", "k4": "666078", "k5": "948ea4",
    # 종이·흰 깃·흰 수염
    "a0": "5e5058", "a1": "8a7e84", "a2": "b4acae", "a3": "d8d2ce", "a4": "f0ece4", "a5": "fffdf6",
    # 밀짚(모자)
    "y0": "4a3418", "y1": "785826", "y2": "a6803a", "y3": "d0aa50", "y4": "ecd078", "y5": "fff0b0",
    # 피부
    "c0": "5a2a2a", "c1": "8a4638", "c2": "be7458", "c3": "e6a27a", "c4": "f8caa0",
    # 개구리(연두 초록)
    "j0": "123826", "j1": "1c5830", "j2": "2c7c36", "j3": "4aa640", "j4": "84ce56", "j5": "c6ee88",
    # 장어(남보라)와 주황 장어
    "z0": "12122e", "z1": "20244e", "z2": "323a72", "z3": "485a98", "z4": "6e86be", "z5": "a6bee2",
    "o0": "4a1a10", "o1": "7e3216", "o2": "b4541c", "o3": "e07e2c", "o4": "f6ac54", "o5": "ffd88c",
    # 호수지기 옷(바랜 남청)
    "q0": "1a2034", "q1": "28324e", "q2": "3a4a6c", "q3": "54668a", "q4": "7a8caa",
    # 기타
    "white": "ffffff", "eye": "1d1a28", "blush": "e07a6a",
}

_POOL = "".join(chr(c) for c in range(0xB800, 0xB800 + 400))

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
    "n": "ol_water", "m": "ol_mirror", "t": "ol_sand", "e": "ol_leaf", "f": "ol_leaf", "u": "ol_mist", "r": "ol_reed",
    "h": "ol_wood", "w": "ol_wood", "s": "ol_stone", "p": "ol_pink", "g": "ol_gold", "i": "ol_ice", "k": "ol_cloth",
    "a": "ol_bird", "y": "ol_gold", "c": "ol_skin", "j": "ol_frog", "z": "ol_eel", "o": "ol_eel", "q": "ol_cloth",
}
# 외곽선 고를 때 우선순위(앞이 이긴다): 몸통처럼 형태를 읽게 하는 재질을 먼저
_PRIORITY = "jzoapcqkyumnehwrsgitf"


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


def shade_right(g, from_x: int, skip: tuple = ("eye", "white", "i5", "g5", "a5", "m6", "y5", "j5", "p5")):
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
