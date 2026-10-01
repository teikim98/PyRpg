"""지역 2(갈림길 숲) 확장 팔레트와 그리기 도구.

누리의 새 화풍(nuripal)과 같은 원칙을 쓴다: 재질마다 5~6단계 램프를 두고, 어두운 쪽은 청록·보라 쪽으로,
밝은 쪽은 따뜻한 노랑 쪽으로 색상을 비튼다(hue-shift). 외곽선은 순수 검정 대신 재질에 맞춘 짙은 색을 쓴다.

그리드는 사람이 읽기 쉬운 지역 범례(ASCII 문자 → 색 이름)로 쓰고 paint()로 팔레트 문자 그리드로 바꾼다.
색 이름 → 팔레트 문자는 공용 팔레트·누리 팔레트와 겹치지 않는 문자(한글 자모)로 등록 순서대로 배정하므로
같은 코드면 언제나 같은 바이트가 나온다.
"""
import textwrap

import nuripal  # noqa: F401  누리 팔레트를 먼저 등록해 문자 충돌 검사가 의미 있게 한다
from gridlib import PALETTE, _rgba

COLORS = {
    # 색 외곽선(재질별)
    "ol_leaf": "10262a", "ol_bark": "2a1620", "ol_stone": "1c1a2c", "ol_ice": "112c42",
    "ol_warm": "3e1622", "ol_violet": "1c1030", "ol_skin": "7c3a3c", "ol_cloth": "1a2236",
    # 숲 바닥·이끼(그늘은 청록 쪽, 밝은 쪽은 노랑 쪽)
    "f0": "1b3634", "f1": "25493d", "f2": "305c43", "f3": "3d6e48", "f4": "54864e", "f5": "7ba65a", "f6": "b9d27a",
    # 소나무(더 차갑고 짙은 초록)
    "p0": "0f2530", "p1": "163a40", "p2": "1f5249", "p3": "2c6a52", "p4": "468a5c", "p5": "79b46e",
    # 나무껍질·나무
    "w0": "2c1826", "w1": "472728", "w2": "6b3d2e", "w3": "915d3a", "w4": "b8854e", "w5": "dcb676",
    # 공중에 멈춘 단풍
    "a0": "7a2630", "a1": "b0402c", "a2": "da6a2c", "a3": "f09838", "a4": "fac858", "a5": "fff0a0",
    # 돌
    "s0": "2a2940", "s1": "434659", "s2": "616878", "s3": "868f98", "s4": "b0b8b4", "s5": "dfe3d6",
    # 얼음·멈춘 시간(청록)
    "i0": "143a50", "i1": "1d5a73", "i2": "2b86a0", "i3": "4fb8c9", "i4": "93e2e6", "i5": "e8fcf6",
    # 황동
    "b0": "512b1d", "b1": "87501f", "b2": "ba822d", "b3": "e2b24a", "b4": "f8de82", "b5": "fffbdc",
    # 버섯 빨강
    "m0": "4e1530", "m1": "8a2238", "m2": "c23a44", "m3": "e86a5e", "m4": "f9a98a",
    # 흙(뿌리 바닥)
    "e0": "3e2630", "e1": "5e3e38", "e2": "7e5a44", "e3": "9c7652", "e4": "bc9868",
    # 크림(부엉이 배·달력 종이)
    "c0": "8a6e70", "c1": "bfa592", "c2": "e6d4b8", "c3": "fbf4e2",
    # 보라(고리 뱀)
    "v0": "2a1a40", "v1": "46306a", "v2": "6a4c94", "v3": "9478c0", "v4": "c4abe6",
    # 사람 피부
    "k0": "a24f52", "k1": "cf7a70", "k2": "e9a189", "k3": "f8c3a2", "k4": "fedfc6",
    # 머리카락·수염(갈색)
    "h0": "3e1e1e", "h1": "6a3426", "h2": "95562f", "h3": "bd7e48", "h4": "dea866",
    # 여행자 망토(먼지 낀 청회색)
    "q0": "1f2c44", "q1": "2f4a68", "q2": "45708e", "q3": "6c9ab0", "q4": "a8cdd4",
    # 나무꾼 셔츠(빨강 체크)
    "r0": "5a1a26", "r1": "8e2a2e", "r2": "c2443a", "r3": "e8705a",
    # 기타
    "white": "ffffff", "eye": "1d1a28", "blush": "f0948e",
}

_POOL = "".join(chr(c) for c in range(0x3131, 0x318F))

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
    "f": "ol_leaf", "p": "ol_leaf", "e": "ol_bark", "w": "ol_bark", "a": "ol_warm", "s": "ol_stone", "i": "ol_ice",
    "b": "ol_bark", "m": "ol_warm", "c": "ol_bark", "v": "ol_violet", "k": "ol_skin", "h": "ol_bark",
    "q": "ol_cloth", "r": "ol_warm",
}
# 외곽선 고를 때 우선순위(앞이 이긴다): 피부·옷처럼 형태를 읽게 하는 재질을 먼저
_PRIORITY = "kqrhvmcaiswbpef"


def outline_of(ch: str) -> str:
    """색 문자 → 그 재질의 외곽선 문자(흰색·눈동자 같은 단색은 나무껍질 외곽선)."""
    name = NAME.get(ch, "")
    return CH[_OUTLINE_BY_PREFIX.get(name[:1], "ol_bark") if name[1:2].isdigit() else "ol_bark"]


def paint(text: str, legend: dict, width: int | None = None, height: int | None = None):
    """지역 범례로 쓴 그리드 → 팔레트 문자 그리드. '.'은 투명, 'K'는 외곽선 자리(color_outline이 색을 정함).
    범례에 없는 문자는 오류."""
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
    """투명 칸 중 불투명 칸에 상하좌우로 닿은 칸(또는 mark 문자 칸)을 닿은 재질의 색 외곽선으로 칠한다."""
    h, w = len(g), len(g[0])
    out = [list(r) for r in g]
    for y in range(h):
        for x in range(w):
            if g[y][x] not in (".", mark):
                continue
            nbs = [g[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                   if 0 <= x + dx < w and 0 <= y + dy < h]
            nbs = [c for c in nbs if c in NAME and not NAME[c].startswith("ol_")]
            if g[y][x] == "." and not nbs:
                continue
            if not nbs:
                out[y][x] = CH["ol_bark"]
                continue
            best = min(nbs, key=lambda c: _PRIORITY.find(NAME[c][0]) if NAME[c][0] in _PRIORITY else 99)
            out[y][x] = outline_of(best)
    return ["".join(r) for r in out]


class Rng:
    """결정적 의사 난수(선형 합동). 타일 무늬 흩뿌리기용."""

    def __init__(self, seed: int):
        self.s = seed & 0xFFFFFFFF

    def next(self) -> int:
        self.s = (self.s * 1664525 + 1013904223) & 0xFFFFFFFF
        return self.s >> 8

    def randint(self, a: int, b: int) -> int:
        return a + self.next() % (b - a + 1)
