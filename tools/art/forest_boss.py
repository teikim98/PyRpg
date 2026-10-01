"""지역 2 보스(32×32 프레임 2개): 갈림길 수호목.

굵은 줄기 가운데에 지역 1 보스와 같은 황동 테·청록 문자판의 시계 룬 눈이 박힌 수호목이다.
뿌리는 밑동에서 갈라지고 또 갈라져(두 갈래씩) 사방으로 뻗는 길이 된다. 갈래 끝마다 청록 빛이 맺혀 있다.
잎 사이로 단풍이 공중에 멈춰 떠 있다. 프레임 A는 눈을 가늘게 뜨고, 프레임 B는 눈을 크게 뜨며
바늘이 돌고 가지를 치켜든다(잎덩이가 한 칸 올라가고 뿌리 끝 빛이 밝아진다).
"""
import math

from forestpal import CH, color_outline

SIZE = 32
LIGHT = (-0.6, -0.8)


def _crossroad_tree(awake: bool):
    g = [["."] * SIZE for _ in range(SIZE)]

    def put(x, y, name):
        if 0 <= x < SIZE and 0 <= y < SIZE:
            g[y][x] = CH[name]

    def get(x, y):
        return g[y][x] if 0 <= x < SIZE and 0 <= y < SIZE else "."

    # ── 뿌리: 밑동(16, 24)에서 두 갈래씩 갈라지는 길 ─────────────────────────────
    tips = []

    def root(x0, y0, ang, length, width, depth):
        x1 = x0 + math.cos(ang) * length
        y1 = y0 + math.sin(ang) * length
        steps = int(length * 3) + 1
        for s in range(steps + 1):
            t = s / steps
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            w = width * (1 - 0.35 * t)
            for yy in range(int(y - w) - 1, int(y + w) + 2):
                for xx in range(int(x - w) - 1, int(x + w) + 2):
                    d = math.hypot(xx + 0.5 - x, yy + 0.5 - y)
                    if d <= w:
                        # 위쪽 가장자리는 밝게, 아래쪽은 어둡게(빛이 위에서)
                        rel = (yy + 0.5 - y) / max(w, 0.5)
                        put(xx, yy, "w4" if rel < -0.4 else ("w2" if rel > 0.35 else "w3"))
        if depth == 0:
            tips.append((round(x1), round(y1)))
            return
        spread = 0.5 + 0.1 * depth
        root(x1, y1, ang - spread, length * 0.72, max(0.5, width * 0.7), depth - 1)
        root(x1, y1, ang + spread, length * 0.72, max(0.5, width * 0.7), depth - 1)

    for ang, ln in ((math.pi * 0.97, 7.5), (math.pi * 0.68, 5.0), (math.pi * 0.32, 5.0), (math.pi * 0.03, 7.5)):
        root(16, 24, ang, ln, 1.7, 1)

    # ── 줄기: 위는 가늘고 밑동은 뿌리 쪽으로 퍼진다 ─────────────────────────────
    for y in range(8, 27):
        half = 4.2 + max(0, y - 18) * 0.55
        for x in range(SIZE):
            u = (x + 0.5 - 16) / half  # -1 ~ 1
            if abs(u) > 1:
                continue
            if u < -0.6:
                c = "w4"
            elif u < -0.15:
                c = "w3"
            elif u < 0.55:
                c = "w2"
            else:
                c = "w1"
            # 세로 나뭇결
            if (x * 7 + y // 3) % 5 == 0 and c in ("w3", "w2"):
                c = "w2" if c == "w3" else "w1"
            put(x, y, c)
    # 가지 두 개가 잎덩이 속으로
    for i in range(7):
        put(11 - i, 10 - i // 2, "w2")
        put(11 - i, 11 - i // 2, "w1")
        put(20 + i, 10 - i // 2, "w2")
        put(20 + i, 11 - i // 2, "w1")

    # ── 잎덩이: 뒤에서 앞으로 겹쳐 그린 둥근 덩이. 덩이마다 왼쪽 위가 밝고 오른쪽 아래 가장자리가 어둡다 ──
    lift = 1 if awake else 0
    clumps = [  # (중심 x, 중심 y, 반지름, 램프)
        (16, 4, 5.2, "g"), (9, 6, 5.0, "g"), (23, 6, 5.0, "g"),
        (4, 10, 3.6, "a"), (28, 10, 3.6, "g"), (12, 9, 4.6, "g"), (20, 9, 4.6, "a"), (16, 11, 3.2, "g"),
    ]
    ramps = {"g": ["f1", "f2", "f3", "f4", "f5", "f6"], "a": ["a0", "a1", "a2", "a3", "a4", "a5"]}
    for cx, cy, r, rk in clumps:
        cy -= lift
        ramp = ramps[rk]
        for y in range(SIZE):
            for x in range(SIZE):
                d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
                if d > r:
                    continue
                nx, ny = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
                lit = -(nx * 0.6 + ny * 0.8)
                k = 2.4 + lit * 1.8
                if d > r - 1.1 and lit < 0.1:
                    k = 0.6  # 덩이 가장자리 그늘(덩이끼리 갈라 보이게)
                if (x * 3 + y * 5) % 7 == 0 and k < 4.2:
                    k -= 0.7
                put(x, y, ramp[max(0, min(5, int(round(k))))])
    # 얼어붙은 서리(잎 끝의 청록 점)
    for x, y in ((6, 3), (25, 2), (1, 9), (30, 11), (17, 0)):
        put(x, y - lift, "i4")

    # ── 얼굴: 성난 눈썹 + 시계 룬 눈 + 갈라진 입 ───────────────────────────────────
    ey = 14
    eye = [
        "..bbbb..",
        ".bccccb.",
        "bccEcccb",
        "bTcEEEcb" if awake else "bTcEcTcb",
        ".bccccb." if awake else ".bcEEcb.",
        "..BBBB..",
    ] if awake else [
        "........",
        ".bbbbbb.",
        "bccEcccb",
        "bTcEcTcb",
        ".bcEEcb.",
        "..BBBB..",
    ]
    names = {"b": "b3", "B": "b1", "c": "i4", "T": "i3", "E": "w0"}
    for j, row in enumerate(eye):
        for i, ch in enumerate(row):
            if ch != ".":
                put(12 + i, ey + j, names[ch])
    put(13, ey, "b5") if awake else put(13, ey + 1, "b5")
    # 눈썹(옹이 진 껍질): 가운데로 내려온다
    for dx, dy in ((0, 0), (1, 0), (2, 1), (3, 1)):
        put(10 + dx, ey - 2 + dy + (0 if awake else 1), "w0")
        put(21 - dx, ey - 2 + dy + (0 if awake else 1), "w0")
    # 입: 나무 틈, 안쪽에 청록 빛
    mouth = [(13, 22), (14, 21), (15, 22), (16, 21), (17, 22), (18, 21)]
    for x, y in mouth:
        put(x, y, "w0")
        put(x, y + 1, "w0")
    if awake:
        for x in range(14, 18):
            put(x, 23, "i2")
        put(15, 22, "i3")
        put(16, 22, "i3")

    # ── 뿌리 끝의 빛(갈래 길의 끝) ────────────────────────────────────────────
    for x, y in tips:
        put(x, y, "i4" if awake else "i3")
    out = color_outline(["".join(r) for r in g])

    # ── 공중에 멈춘 단풍(외곽선 없이) ─────────────────────────────────────────
    leaves = [(2, 4, "a3"), (29, 3, "a4"), (1, 19, "a2"), (30, 17, "a3"), (6, 22, "a4"), (26, 23, "a2")]
    if awake:
        leaves = [(x, y - 1, c) for x, y, c in leaves]
    out = [list(r) for r in out]
    for x, y, c in leaves:
        if out[y][x] == ".":
            out[y][x] = CH[c]
            if out[y][x + 1] == "." and x + 1 < SIZE:
                out[y][x + 1] = CH["a1"]
            if y > 0 and out[y - 1][x] == ".":
                out[y - 1][x] = CH["i4"]
    return ["".join(r) for r in out]


FOREST_BOSSES = {"boss_crossroad_tree": [_crossroad_tree(False), _crossroad_tree(True)]}
