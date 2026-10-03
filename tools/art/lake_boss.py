"""지역 6 보스(32×32 프레임 2개): 거울 쌍둥이(중간 보스)와 호수의 메아리(최종 보스).

- boss_mirror_twins: 왼쪽은 청록 물빛, 오른쪽은 은빛 거울빛인 쌍둥이 물의 정령이 좌우가 뒤집힌 채 마주 서서
  가운데 세로 거울 금에 손바닥을 맞댔다. 머리카락은 바깥으로 흘러내리는 물줄기, 아래는 소용돌이 물결.
  왼쪽 절반(16칸)만 그리고 좌우를 뒤집은 뒤 오른쪽 램프를 거울색으로 바꾼다. 프레임 B는 눈이 청록으로 빛나고
  거울 금이 넓게 번쩍인다. 지역 3 거울 슬라임(낮은 돔)과 달리 키 큰 사람 모양 둘이다.
- boss_lake_echo: 겹겹의 동심원 물결로 된 둥근 메아리 정령. 가운데에 시계 룬(지역 1~5 보스와 같은 청록 문자판과
  금테), 그 위로 두 눈. 몸 아래로 물결이 왼쪽은 둘, 오른쪽은 셋으로 갈라져 작은 메아리 고리가 된다(E(n//2)+E(n//3)).
  프레임 B는 고리가 한 칸 퍼지고 눈과 문자판이 밝아진다.
"""
from gridlib import overlay
from lakepal import CH, NAME, color_outline, paint

SIZE = 32

# ── 거울 쌍둥이 ──────────────────────────────────────────────────────────────
_TWIN_HALF = [
    "................",
    "................",
    "...........343..",
    ".........344443.",
    ".......34444543.",
    "......344445W443",
    ".....34444GGGG43",
    "....3444FFFFFF43",
    "....344FFFFFFF43",
    "...3444FFFFeFF43",
    "...344.FFFFeFF..",
    "..3444..FFFFmF..",
    "..344....FFFF...",
    ".3444....3FF3...",
    ".345...2344443..",
    ".345..234555543.",
    ".34..2345555543F",
    ".34.23455555FFFF",
    ".3..2345555543FF",
    "....23455555432.",
    "....2345555543..",
    "...23455555543..",
    "...234556555432.",
    "..2345565555432.",
    "..23455655554432",
    ".234556555544432",
    ".2345555554443..",
    "..234555544432..",
    "...2344443322...",
    "..2W3..23W32....",
    ".2W32.2W3..2W3..",
    "................",
]


def _twin_key(ramp: str, awake: bool) -> dict:
    face = "n6" if ramp == "n" else "m5"
    key = {str(k): f"{ramp}{k}" for k in range(2, 7)}
    key.update({"F": face, "W": "m6", "e": "i4" if awake else "eye", "G": "g4", "m": f"{ramp}2"})
    return key


def _mirror_twins(awake: bool):
    left = paint("\n".join(_TWIN_HALF), _twin_key("n", awake), 16, SIZE)
    right = paint("\n".join(r[::-1] for r in _TWIN_HALF), _twin_key("m", awake), 16, SIZE)
    body = [a + b for a, b in zip(left, right)]
    g = color_outline(body)
    # 가운데 세로 거울 금: 흰 심이 지그재그로 내려가고 양옆에 짙은 그늘. 손바닥이 닿은 곳은 빛난다
    crack = [["."] * SIZE for _ in range(SIZE)]
    for y in range(1, 31):
        x = 15 if (y // 3) % 2 == 0 else 16
        if 15 <= y <= 18:
            crack[y][15] = crack[y][16] = "m6"
            continue
        crack[y][x] = "m6" if awake or y % 4 else "m4"
        side = 16 if x == 15 else 15
        if body[y][side] == ".":
            crack[y][side] = "m2" if not awake else "m5"
    if awake:
        for x, y in ((13, 14), (18, 14), (12, 20), (19, 20), (15, 0), (16, 31)):
            crack[y][x] = "m6"
    g = overlay(g, ["".join("." if c == "." else CH[c] for c in row) for row in crack])
    return g


# ── 호수의 메아리 ────────────────────────────────────────────────────────────
CX, CY = 15.5, 13.5


def _ring_color(d: float, pulse: int) -> str:
    """중심에서의 거리 → 몸 색(고리마다 밝은 띠, 사이에 안개 보라)."""
    bands = [(12.0 + pulse * 0.6, "u5"), (9.0 + pulse * 0.6, "m4"), (6.3 + pulse * 0.4, "n5")]
    for r, c in bands:
        if abs(d - r) < 0.75:
            return c
    if d > 9.6 + pulse * 0.6:
        return "u3"
    if d > 6.9 + pulse * 0.4:
        return "u2"
    return "n3"


def _lake_echo(awake: bool):
    pulse = 1 if awake else 0
    g = [["."] * SIZE for _ in range(SIZE)]
    radius = 12.8 + pulse * 0.6
    for y in range(SIZE):
        for x in range(SIZE):
            d = ((x - CX) ** 2 + (y - CY) ** 2) ** 0.5
            if d <= radius:
                c = _ring_color(d, pulse)
                # 왼쪽 위 빛: 같은 고리라도 오른쪽 아래는 한 단계 어둡게
                if (x - CX) + (y - CY) > 6 and c[1:].isdigit() and int(c[1:]) > 1:
                    c = f"{c[0]}{int(c[1:]) - 1}"
                g[y][x] = c
    # 갈라지는 메아리: 왼쪽 아래 고리 둘, 오른쪽 아래 고리 셋(작은 동심원)
    echoes = [(6.5, 26.5, 2.6), (2.5, 29.5, 1.6), (22.5, 26.5, 2.0), (27.5, 28.5, 1.5), (29.5, 24.5, 1.3)]
    for ex, ey, r in echoes:
        r += pulse * 0.4
        for y in range(SIZE):
            for x in range(SIZE):
                d = ((x - ex) ** 2 + (y - ey) ** 2) ** 0.5
                if abs(d - r) < 0.55 and g[y][x] == ".":
                    g[y][x] = "m4" if y < ey else "u4"
                elif d < r - 0.55 and g[y][x] == ".":
                    g[y][x] = "u2"
    # 몸에서 메아리로 이어지는 물줄기(둘·셋으로 갈라진다)
    for x, y in ((9, 24), (8, 25), (5, 27), (4, 28), (20, 24), (21, 25), (24, 26), (25, 27), (26, 25), (27, 24)):
        if g[y][x] == ".":
            g[y][x] = "u3"
    # 두 눈
    eye = "i4" if awake else "k1"
    glint = "i5" if awake else "u5"
    for ex in (11, 19):
        g[7][ex] = g[7][ex + 1] = eye
        g[8][ex] = g[8][ex + 1] = eye
        g[7][ex] = glint
    out = ["".join("." if c == "." else CH[c] for c in row) for row in g]
    out = color_outline(out)
    # 가운데 시계 룬(금테, 청록 문자판, 멈춘 바늘)
    dial = paint("""
        ..hGGh..
        .hDDdDh.
        hDDLDDDh
        GDDLDDDG
        GDDLLLDG
        hDDDDDDh
        .hDDDDh.
        ..hGGh..
    """, {"h": "g2", "G": "g4", "D": "i3" if awake else "i2", "d": "i5" if awake else "i4", "L": "i0"}, 8, 8)
    return overlay(out, dial, 12, 10)


LAKE_BOSSES = {
    "boss_mirror_twins": [_mirror_twins(False), _mirror_twins(True)],
    "boss_lake_echo": [_lake_echo(False), _lake_echo(True)],
}

_ = NAME  # (다른 지역 모듈과 같은 가져오기 목록 유지)
