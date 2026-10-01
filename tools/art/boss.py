"""보스(32×32 프레임 2개): 계단 미믹.

시계탑 계단인 척하던 미믹이다. 맨 위 칸이 머리이고, 그 앞면의 눈이 이 지역의 시계 룬이다.
계단 한가운데 깔린 빨간 융단은 사실 혀다. 프레임 A는 입을 살짝 벌리고 노려보고,
프레임 B는 머리를 들어 입을 크게 벌리고 혀를 말아 올린다.
"""
from gridlib import outline

SIZE = 32


def _stair_mimic(open_mouth: bool):
    g = [["."] * SIZE for _ in range(SIZE)]

    def put(x, y, ch):
        if 0 <= x < SIZE and 0 <= y < SIZE:
            g[y][x] = ch

    def hline(x0, x1, y, ch):
        for x in range(x0, x1 + 1):
            put(x, y, ch)

    # 아래 세 칸(턱): 디딤판 2줄 + 챌판, 가운데에 융단(혀)
    steps = [(5, 26, 16, 21), (3, 28, 22, 26), (1, 30, 27, 30)]
    for x0, x1, yt, yb in steps:
        hline(x0, x1, yt, "H")
        hline(x0, x1, yt + 1, "G")
        for y in range(yt + 2, yb + 1):
            hline(x0, x1, y, "g")
            put(x1, y, "k")
            put(x1 - 1, y, "k")
        put(x0, yt, "W")
        for y in range(yt, yb + 1):
            for x in range(13, 19):
                put(x, y, "R" if y == yt else ("x" if y == yt + 1 else "X"))
    # 돌 이음매
    for x, y in ((8, 19), (9, 19), (23, 20), (6, 25), (24, 24), (25, 24), (4, 29), (27, 29), (9, 29)):
        put(x, y, "k")

    lift = 2 if open_mouth else 0
    top = 3 - lift  # 머리 디딤판 시작 행
    x0, x1 = 6, 25
    hline(x0, x1, top, "H")
    hline(x0, x1, top + 1, "G")
    put(x0, top, "W")
    head_bottom = 11 - lift
    for y in range(top + 2, head_bottom + 1):
        hline(x0, x1, y, "g")
        put(x1, y, "k")
        put(x1 - 1, y, "k")
    # 성난 눈썹
    for dx, dy in ((0, 1), (1, 1), (2, 2), (3, 2), (4, 3), (1, 2), (3, 3)):
        put(8 + dx, top + dy, "K")
        put(23 - dx, top + dy, "K")
    # 시계 룬 눈(황동 테, 청록 문자판, 바늘)
    eye = [
        "..UUUU..",
        ".UccccU.",
        "UccKcccU",
        "UTcKKKcU" if open_mouth else "UTcKcTcU",
        ".UccccU." if open_mouth else ".UcKKcU.",
        "..uuuu..",
    ]
    ey = top + 2
    for j, row in enumerate(eye):
        for i, ch in enumerate(row):
            if ch != ".":
                put(12 + i, ey + j, ch)

    # 입: 머리와 턱 사이
    m0, m1 = 7, 24
    mouth_top = head_bottom + 1
    mouth_bot = 15
    for y in range(mouth_top, mouth_bot + 1):
        hline(m0, m1, y, "X")
        put(x0, y, "k")
        put(x1, y, "k")
    for y in range(mouth_top + 1, mouth_bot):
        hline(m0 + 2, m1 - 2, y, "K")
    for x in range(m0, m1 + 1):
        if (x - m0) % 3 != 2:
            put(x, mouth_top, "W")
        if (x - m0) % 3 == 0:
            put(x, mouth_top + 1, "H")
        if not 13 <= x <= 18:
            if (x - m0 + 1) % 3 != 2:
                put(x, mouth_bot, "W")
            if (x - m0 + 1) % 3 == 0:
                put(x, mouth_bot - 1, "H")
    # 혀(융단)가 입 안에서 이어져 나온다
    tongue_top = mouth_top + 2 if open_mouth else mouth_bot - 1
    for y in range(tongue_top, mouth_bot + 1):
        for x in range(13, 19):
            put(x, y, "x")
        put(13, y, "R")
    if open_mouth:
        hline(14, 17, tongue_top - 1, "x")
        put(15, tongue_top, "X")
        put(16, tongue_top, "X")
    return outline(["".join(r) for r in g])


BOSSES = {"boss_stair_mimic": [_stair_mimic(False), _stair_mimic(True)]}
