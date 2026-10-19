"""보스(32×32 프레임 4개): 계단 미믹(그래픽 개편, docs/art-overhaul/style-guide.md §6.3).

시계탑 계단인 척하던 미믹이다. 맨 위 칸이 머리이고, 그 앞면의 눈이 이 지역의 시계 룬이다.
계단 한가운데 깔린 빨간 융단은 사실 혀다.

프레임(제자리 루프): 0 노려봄(입 살짝 벌림) → 1 숨 들이쉼(머리 1px 들림) → 2 노려봄(눈의 바늘이 한 칸 돎)
→ 3 위협(머리 2px 들고 입을 크게 벌려 혀를 말아 올림, 눈의 문자판이 환하게 빛남).
코지 팔레트만 쓴다: 돌(stone) 계단, 이끼 낀 틈(moss), 융단·혀(cloth_red), 황동 테(brass), 청록 문자판(teal).
외곽선은 auto_outline()이 1px로 두른다.
"""
from cozypal import noise
from monsters import Px

SIZE = 32
_STEPS = [(5, 26, 16, 21), (3, 28, 22, 26), (1, 30, 27, 30)]   # (x0, x1, 디딤판 행, 챌판 끝 행): 아래 세 칸(턱)
_CARPET = (13, 18)


def _block(p, x0, x1, yt, yb, seed):
    """계단 한 칸: 디딤판(밝음 2줄) + 챌판(기본, 오른쪽 2열·맨 아래 줄 그늘) + 질감 점."""
    for x in range(x0, x1 + 1):
        p.put(x, yt, "stone.spec" if x == x0 else "stone.hi")
        p.put(x, yt + 1, "stone.hi" if x < x0 + 2 else "stone.base")
        for y in range(yt + 2, yb + 1):
            dark = x >= x1 - 1 or y == yb
            p.put(x, y, "stone.shade" if dark else "stone.base")
    for y in range(yt + 2, yb):
        for x in range(x0 + 1, x1 - 1):
            r = noise(x, y, seed)
            if r < 0.08:
                p.put(x, y, "stone.shade")
            elif r < 0.105:
                p.put(x, y, "moss.base")


def _carpet(p, yt, yb):
    """융단(= 혀): 디딤판 줄은 밝음, 양쪽 가장자리는 그늘."""
    a, b = _CARPET
    for y in range(yt, yb + 1):
        for x in range(a, b + 1):
            if y == yt:
                p.put(x, y, "cloth_red.hi")
            elif x in (a, b) or y == yb:
                p.put(x, y, "cloth_red.shade")
            else:
                p.put(x, y, "cloth_red.base")
    p.put(a + 1, yt, "cloth_red.spec")


def _stair_mimic(frame: int):
    p = Px(SIZE, SIZE)
    lift = (0, 1, 0, 2)[frame]
    threat = frame == 3

    # 아래 세 칸(턱)과 융단
    for k, (x0, x1, yt, yb) in enumerate(_STEPS):
        _block(p, x0, x1, yt, yb, 300 + k)
        _carpet(p, yt, yb)
    # 오래 멈춰 있던 계단: 디딤판 모서리에 이끼가 얹혀 아래로 조금 늘어진다(레퍼런스의 넘어오는 풀)
    for x0, row, drips in ((5, 16, (5, 6)), (3, 22, (3,)), (27, 27, (29,)), (24, 16, (25,))):
        for dx in range(3):
            p.put(x0 + dx, row - 1, "moss.hi" if dx == 1 else "moss.base")
        for dx in drips:
            p.put(dx, row, "moss.shade")

    # 머리(맨 위 칸)
    top = 3 - lift
    head_bottom = 11 - lift
    x0, x1 = 6, 25
    _block(p, x0, x1, top, head_bottom, 310)
    # 성난 눈썹(안쪽 선 = 돌의 외곽선 색)
    for dx, dy in ((0, 1), (1, 1), (2, 2), (3, 2), (4, 3), (1, 2), (3, 3)):
        p.put(8 + dx, top + dy + 1, "stone.ol")
        p.put(23 - dx, top + dy + 1, "stone.ol")
    # 시계 룬 눈: 황동 테 + 청록 문자판 + 바늘(프레임 2에서 한 칸 돎, 위협 땐 문자판이 환하게)
    face = "teal.hi" if threat else "teal.base"
    lit = "teal.spec" if threat else "teal.hi"
    turned = frame == 2
    eye = [
        "..UUUU..",
        ".UlffYU.",
        "UffffffU" if turned else "UffkfffU",     # 분침: 12시 → (프레임 2) 3시
        "Uffkkkfu" if turned else "Uffkkffu",
        ".uffffu.",
        "..uuuu..",
    ]
    legend = {"U": "brass.hi", "u": "brass.shade", "Y": "brass.spec", "f": face, "l": lit, "k": "ink"}
    for j, row in enumerate(eye):
        for i, ch in enumerate(row):
            if ch != ".":
                p.put(12 + i, top + 2 + j, legend[ch])

    # 입: 머리와 턱 사이(안쪽은 깊은 그늘, 위아래 이빨)
    m0, m1 = 7, 24
    mouth_top = head_bottom + 1
    mouth_bot = 15
    for y in range(mouth_top, mouth_bot + 1):
        for x in range(m0, m1 + 1):
            p.put(x, y, "brick.ol" if y in (mouth_top, mouth_bot) else "void")
        p.put(x0, y, "stone.shade")
        p.put(x1, y, "stone.shade")
    for x in range(m0, m1 + 1):
        if (x - m0) % 3 != 2:
            p.put(x, mouth_top, "cream.spec")
            if (x - m0) % 3 == 0:
                p.put(x, mouth_top + 1, "cream.hi")
        if not _CARPET[0] <= x <= _CARPET[1] and (x - m0 + 1) % 3 != 2:
            p.put(x, mouth_bot, "cream.hi")
            if (x - m0 + 1) % 3 == 0:
                p.put(x, mouth_bot - 1, "cream.spec")
    # 혀(융단)가 입 안에서 이어져 나온다. 위협 땐 말려 올라간다
    a, b = _CARPET
    tongue_top = mouth_top + 2 if threat else mouth_bot - 1
    for y in range(tongue_top, mouth_bot + 1):
        for x in range(a, b + 1):
            p.put(x, y, "cloth_red.shade" if x in (a, b) else "cloth_red.base")
    if threat:
        for x in range(a + 1, b):
            p.put(x, tongue_top - 1, "cloth_red.hi")
        p.put(a + 2, tongue_top, "cloth_red.spec")
        p.put(15, tongue_top + 1, "cloth_red.shade")
        p.put(16, tongue_top + 1, "cloth_red.shade")
    return p.grid()


BOSSES = {"boss_stair_mimic": [_stair_mimic(i) for i in range(4)]}
