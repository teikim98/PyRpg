"""지역 2 보스(32×32 프레임 4개): 갈림길 수호목.

화풍 통일(docs/art-overhaul/style-guide.md §6.3, 기준 구현 boss.py): 코지 팔레트만 쓰고 monsters.Px로 덩어리마다
3단 음영, auto_outline으로 1px 외곽선. 디자인은 옛 그림 그대로다.
- 굵은 줄기 가운데에 지역 1 보스와 같은 황동 테·청록 문자판의 시계 룬 눈.
- 뿌리는 밑동에서 두 갈래씩 갈라져 사방으로 뻗는 길이 되고, 갈래 끝마다 청록 빛이 맺혀 있다.
- 잎덩이(짙은 잎·이끼)에 멈춘 단풍(빨강·주황) 덩이가 섞이고, 둘레에 낙엽이 공중에 멈춰 떠 있다.

프레임(엔진은 맵·전투 모두 4프레임을 그대로 돌린다. 잠든/깬 상태를 따로 고르지 않으므로 boss_stair_mimic처럼
'노려봄 → 숨 → 바늘 돎 → 위협'의 제자리 루프 안에서 깨어남을 보여 준다):
0 노려봄(눈꺼풀이 반쯤 덮임) → 1 숨 들이쉼(잎덩이 1px 들림) → 2 노려봄(분침이 한 칸 돎)
→ 3 위협(가지를 치켜들어 잎덩이 2px, 눈을 크게 뜨고 문자판이 환하게, 입 틈에 청록 빛, 뿌리 끝 빛이 밝아짐).
"""
import math

from cozypal import c
from monsters import Px, ellipse

SIZE = 32


def _root(p, x0, y0, ang, length, width, depth, tips):
    """뿌리 한 갈래(두께 width)를 그리고 끝에서 두 갈래로 나눈다. 위쪽 가장자리 밝음, 아래쪽 그늘."""
    x1, y1 = x0 + math.cos(ang) * length, y0 + math.sin(ang) * length
    steps = int(length * 3) + 1
    for s in range(steps + 1):
        t = s / steps
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        w = width * (1 - 0.35 * t)
        for yy in range(int(y - w) - 1, int(y + w) + 2):
            for xx in range(int(x - w) - 1, int(x + w) + 2):
                if math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= w:
                    rel = (yy + 0.5 - y) / max(w, 0.5)
                    p.put(xx, yy, "wood.hi" if rel < -0.4 else ("wood.shade" if rel > 0.3 else "wood.base"))
    if depth == 0:
        tips.append((round(x1 - 0.5), round(y1 - 0.5)))
        return
    spread = 0.5 + 0.1 * depth
    for a in (ang - spread, ang + spread):
        _root(p, x1, y1, a, length * 0.72, max(0.5, width * 0.7), depth - 1, tips)


# 잎덩이: (중심 x, 중심 y, 반지름, 램프) 뒤에서 앞으로
_CLUMPS = [(16, 4.5, 5.0, "leaf"), (9, 6.5, 4.8, "moss"), (23, 6.5, 4.8, "leaf"), (4, 10.5, 3.4, "brick"),
           (28, 10.5, 3.4, "rust"), (12, 9.5, 4.4, "leaf"), (20.5, 9.5, 4.4, "moss"), (16, 11, 3.0, "leaf")]


def _crossroad_tree(frame):
    p = Px(SIZE, SIZE)
    lift = (0, 1, 0, 2)[frame]
    threat = frame == 3

    tips = []
    for ang, ln in ((math.pi * 0.97, 7.5), (math.pi * 0.68, 5.0), (math.pi * 0.32, 5.0), (math.pi * 0.03, 7.5)):
        _root(p, 16, 25, ang, ln, 1.7, 1, tips)

    # 줄기: 위는 가늘고 밑동은 뿌리 쪽으로 퍼진다. 왼쪽 밝음, 오른쪽 그늘, 세로 결
    trunk = set()
    for y in range(9, 27):
        half = 4.2 + max(0, y - 19) * 0.55
        trunk |= {(x, y) for x in range(SIZE) if abs(x + 0.5 - 16) <= half}
    p.mass(trunk, "wood", shade_below=25)
    for x, y in trunk:
        if (x * 7 + y // 3) % 5 == 0 and p.get(x, y) == "wood.base":
            p.put(x, y, "wood.shade")
    # 가지 두 개가 잎덩이 속으로(치켜들면 1px 더 올라간다)
    for i in range(6):
        for sx, d in ((11 - i, -1), (20 + i, 1)):
            yy = 11 - i // 2 - (1 if threat else 0)
            p.put(sx, yy, "wood.base")
            p.put(sx, yy + 1, "wood.shade")

    # 잎덩이
    for cx, cy, r, ramp in _CLUMPS:
        p.mass(ellipse(cx, cy - lift, r, r, SIZE), ramp)
    for x, y in ((14, 1), (7, 4), (21, 3), (11, 7)):                 # 잎 끝 강조
        if p.get(x, y - lift):
            p.put(x, y - lift, p.get(x, y - lift).split(".")[0] + ".spec")
    for x, y in ((6, 3), (25, 2), (1, 9), (30, 11), (17, 0)):        # 얼어붙은 서리
        p.put(x, y - lift, "teal.hi")

    # 시계 룬 눈: 황동 테 + 청록 문자판 + 분침. 0~2는 눈꺼풀(껍질)이 위를 덮고, 3은 활짝
    ey = 14
    face = "teal.hi" if threat else "teal.base"
    turned = frame == 2
    eye = [
        "..UUUU..",
        ".UffffU.",
        "UffkfffU" if not turned else "UffffffU",
        "Uffkkffu" if not turned else "Uffkkkfu",
        ".uffffu.",
        "..uuuu..",
    ]
    legend = {"U": "brass.hi", "u": "brass.shade", "f": face, "k": "ink"}
    for j, row in enumerate(eye):
        for i, ch in enumerate(row):
            if ch != ".":
                p.put(12 + i, ey + j, legend[ch])
    if threat:
        p.put(13, ey + 1, "teal.spec")
        p.put(14, ey + 1, "white")
    else:
        for i in range(1, 7):                                       # 반쯤 감은 눈꺼풀
            p.put(12 + i, ey + 1, "wood.shade")
        p.put(12, ey + 2, "wood.shade")
        p.put(19, ey + 2, "wood.shade")
    # 눈썹(옹이 진 껍질): 가운데로 내려온다
    for dx, dy in ((0, 0), (1, 0), (2, 1), (3, 1)):
        p.put(10 + dx, ey - 2 + dy + (0 if threat else 1), "wood.ol")
        p.put(21 - dx, ey - 2 + dy + (0 if threat else 1), "wood.ol")
    # 입: 나무 틈. 위협 때 벌어져 안쪽에 청록 빛
    for x, y in ((13, 22), (14, 21), (15, 22), (16, 21), (17, 22), (18, 21)):
        p.put(x, y, "wood.ol")
        p.put(x, y + 1, "wood.ol")
    if threat:
        for x in range(14, 18):
            p.put(x, 23, "wood.ol")
            p.put(x, 22, "teal.base")
        p.put(15, 22, "teal.hi")

    # 뿌리 끝의 빛(갈래 길의 끝)
    for x, y in tips:
        p.put(x, y, "teal.spec" if threat else "teal.hi")
    g = p.grid()

    # 공중에 멈춘 낙엽(외곽선 없이). 위협 때 1px 들썩인다
    g = [list(r) for r in g]
    for x, y, ramp in ((2, 3, "rust"), (28, 2, "brick"), (1, 18, "lamp"), (29, 16, "rust"), (6, 22, "brick"),
                       (26, 22, "lamp")):
        y -= 1 if threat else 0
        if g[y][x] == "." and g[y][x + 1] == ".":
            g[y][x] = c(f"{ramp}.hi")
            g[y][x + 1] = c(f"{ramp}.shade")
            if g[y + 1][x] == ".":
                g[y + 1][x] = c(f"{ramp}.base")
    if threat:                                                      # 뿌리 끝 하나에 반짝임
        x, y = tips[0]
        if y > 0 and g[y - 1][x] == ".":
            g[y - 1][x] = c("sparkle")
    return ["".join(r) for r in g]


FOREST_BOSSES = {"boss_crossroad_tree": [_crossroad_tree(i) for i in range(4)]}
