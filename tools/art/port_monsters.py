"""지역 5(교역항) 몬스터 5종(16×16 프레임 4개 제자리).

화풍 통일(docs/art-overhaul/style-guide.md §3·§6.2, 기준 구현 forest_monsters.py): 코지 팔레트(cozypal)의 이름 있는 색만
쓰고, monsters.Px로 덩어리마다 3단 음영(빛은 왼쪽 위)을 칠한 뒤 auto_outline(재질 ol)으로 바깥 외곽선을 두른다.
옛 디자인(정체·모양)은 그대로이고, 지역 1~4 몬스터와 실루엣이 겹치지 않게 했다(지역 3 '층층 게'는 정면에 상자를 세로로
쌓았고, 줄 게는 옆모습 소라게 위에 작은 게가 가로로 줄 선다).

| 몬스터 | 정체(문제) | 4프레임 |
|---|---|---|
| 쌍둥이 물고기 | 꼬리가 하나로 붙어 서로 반대쪽을 보는 은빛 물고기 둘(tuple) | 나는 몸 0 → −1 → −2 → −1px, 1·3번에 꼬리지느러미가 접히고 공기방울이 오른다 |
| 장부 갈매기 | 부리에 빨간 장부를 문 흰 갈매기 옆모습(dict) | 뛰는 새: 서기 → 웅크림 → 날개 펴고 2px 뜀 → 1px 내려옴 |
| 구슬 해파리 | 갓 속에 색이 다른 구슬 셋(빨강·초록·금)(set) | 나는 몸 0 → −1 → −2 → −1px, 1·3번에 갓이 오므라들고 촉수가 반대로 흔들림 |
| 눈금 앵무새 | 날개에 새긴 바를 정(正) 눈금(Counter) | 눈금이 2 → 3 → 4 → 5(넷째 뒤 가로 긋기)로 늘고, 몸은 서기 → 웅크림 → 서기 → 부리 벌림 |
| 줄 게 | 소라게 껍데기 위에 한 줄로 선 작은 게 셋(deque) | 다리 두 벌이 번갈아 디딜 때 몸 1px, 작은 게가 앞에서부터 하나씩 1px 뛰어 줄이 물결친다 |
"""
import math

from cozypal import c
from monsters import FLY, Px, ellipse

_DOWN = {"ol": "ol", "shade": "ol", "base": "shade", "hi": "base", "spec": "hi"}


def _darken(p, cells):
    for x, y in cells:
        n = p.get(x, y)
        if n and "." in n:
            r, s = n.split(".")
            p.put(x, y, f"{r}.{_DOWN[s]}")


def _shift(cells, dx=0, dy=0):
    return {(x + dx, y + dy) for x, y in cells}


# ── 쌍둥이 물고기: 꼬리지느러미가 하나로 붙은 은빛 물고기 둘이 서로 반대쪽을 본다(나비넥타이 모양) ─────────
_BUBBLES = (((1, 3), (0, 1)), ((2, 2), (1, 0)), ((1, 1), (2, 0)), ((0, 2), (1, 0)))
# 왼쪽 물고기(왼쪽을 봄, 0~7열). 오른쪽 물고기는 좌우 거울. 7열 f가 둘이 하나로 붙은 꼬리지느러미
_FISH = (
    "...f...f",
    ".BBBB..f",
    "Bebbbbbf",
    "bebbbbff",
    "bkbbbb.f",
    ".LLLL..f",
    "..f....f",
)
_FISH_FOLD = {0: ".", 6: "."}       # 접힌 프레임: 꼬리지느러미 위·아래 끝이 몸 쪽으로 모인다


def _twin_fish(frame):
    dy = FLY[frame]
    flap = frame % 2 == 1
    p = Px()
    oy = 5 + dy
    rows = [r + r[::-1] for r in _FISH]
    if flap:
        for j, ch in _FISH_FOLD.items():
            rows[j] = rows[j][:7] + ch + ch + rows[j][9:]
    body = {(x, oy + j) for j, r in enumerate(rows) for x, ch in enumerate(r) if ch in "bBwekL"}
    p.mass(body, "sky")                                                 # 은빛 비늘(물빛 은색)
    legend = {"B": "blue.base", "w": "white", "e": "eye", "k": "blush", "L": "cloth_white.base"}
    for j, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in legend:
                col = legend[ch]
                if ch == "B" and x >= 8:
                    col = "blue.shade"
                p.put(x, oy + j, col)
            elif ch == "f":
                p.put(x, oy + j, "rust.hi" if x < 8 and j < 3 else "rust.base" if j < 5 else "rust.shade")
    for x, y in ((3, 3), (3, 4), (12, 3), (12, 4)):                     # 아가미 선
        p.put(x, oy + y, "sky.shade")
    p.put(2, oy + 2, "white")
    # 공기방울(외곽선 없이): 왼쪽 물고기는 왼쪽 위, 오른쪽 물고기는 오른쪽 위로
    g = [list(r) for r in p.grid()]
    (bx, by), (sx, sy) = _BUBBLES[frame]
    for x, y, col in ((bx, by + dy, "sky.hi"), (bx + sx, by - 2 + dy, "white"),
                      (15 - bx, by + 1 + dy, "sky.hi"), (15 - bx - sx, by - 1 + dy, "white")):
        if 0 <= y < 16 and g[y][x] == ".":
            g[y][x] = c(col)
    return ["".join(r) for r in g]


# ── 장부 갈매기: 옆모습(왼쪽을 봄)의 흰 갈매기가 노란 부리에 빨간 장부를 물었다 ─────────────────────
# 날개(몸 기준 칸): 접음 → 반쯤 → 활짝(위로 들어 올림)
_GULL_WINGS = {
    "tuck": {(x, y) for x in range(7, 13) for y in (6, 7)} | {(13, 7), (11, 8), (12, 8), (13, 8), (14, 8)},
    "half": {(x, y) for x in range(8, 12) for y in (4, 5, 6)} | {(12, 4), (12, 5), (13, 4), (7, 6), (12, 6)},
    "spread": {(8, 6), (9, 5), (9, 6), (10, 4), (10, 5), (11, 3), (11, 4), (12, 2), (12, 3), (13, 1), (13, 2),
               (14, 1), (10, 6), (11, 5)},
}


def _gull(dy, wings, crouch):
    p = Px()
    oy = 2 + dy
    body = ellipse(8.2, oy + 7.2, 4.6, 2.7 - (0.4 if crouch else 0)) | {(13, oy + 6), (14, oy + 6), (14, oy + 7)}
    head = ellipse(4.6, oy + 3.6, 2.6, 2.4)
    neck = {(4, oy + 5), (5, oy + 5), (5, oy + 6), (6, oy + 5)}
    p.mass(body | head | neck, "cloth_white")
    p.put(4, oy + 2, "cloth_white.spec")
    wing = _shift(_GULL_WINGS[wings], 0, oy - 2 + (1 if crouch else 0))
    p.mass(wing, "stone")
    tips = sorted(wing, key=lambda c: (-c[0], c[1]))[:3]             # 날개 끝은 짙게
    for x, y in tips:
        p.put(x, y, "stone.ol")
    p.put(3, oy + 3, "eye")
    p.put(3, oy + 4, "eye")
    p.put(4, oy + 5, "blush")
    # 부리(노랑)와 문 장부(빨간 표지 + 크림 종이 단면)
    p.put(1, oy + 4, "lamp.base")
    p.put(0, oy + 4, "lamp.shade")
    p.put(1, oy + 5, "lamp.shade")
    for x, y, col in ((0, oy + 5, "cloth_red.hi"), (1, oy + 6, "cloth_red.base"), (0, oy + 6, "cloth_red.base"),
                      (2, oy + 6, "cloth_red.shade"), (0, oy + 7, "cream.hi"), (1, oy + 7, "cream.hi"),
                      (2, oy + 7, "cloth_red.shade")):
        p.put(x, y, col)
    # 다리(주황): 뜀 프레임에는 발을 접는다
    if dy >= 0:
        for x in (7, 10):
            p.put(x, 12, "lamp.shade")
            p.put(x, 13, "lamp.shade")
            p.put(x - 1, 13, "lamp.base")
    else:
        p.put(8, oy + 10, "lamp.shade")
        p.put(9, oy + 10, "lamp.shade")
    return p.grid()


# ── 구슬 해파리: 분홍 갓 속에 색이 다른 구슬 셋, 늘어진 촉수 ───────────────────────────────────────
_MARBLES = (("cloth_red", 4, 5), ("grass", 9, 4), ("lamp", 7, 7))


def _jelly(frame):
    dy = FLY[frame]
    squash = frame % 2 == 1
    p = Px()
    oy = 2 + dy
    rx, ry = (5.4, 5.6) if squash else (6.4, 5.0)
    bell = {(x, y) for x, y in ellipse(8, oy + 5.6, rx, ry) if y <= oy + 7}
    p.mass(bell, "flower")
    for x, y in ellipse(8, oy + 5.0, rx - 2.0, ry - 2.2):           # 비치는 속(갓 안쪽은 밝게)
        if (x, y) in bell and p.get(x, y) == "flower.base":
            p.put(x, y, "flower.hi")
    xs = sorted(x for x, y in bell if y == oy + 7)
    for x in xs:                                                     # 갓 아래 주름(물결 테두리)
        p.put(x, oy + 7, "flower.shade" if x % 2 else "flower.base")
    p.put(xs[0] + 2, oy + 2, "white")
    p.put(xs[0] + 3, oy + 2, "flower.spec")
    for ramp, mx, my in _MARBLES:                                   # 구슬 셋(2×2, 왼쪽 위 반사광)
        my += oy - 2 + (1 if squash else 0)
        p.put(mx, my, "white")
        p.put(mx + 1, my, f"{ramp}.base")
        p.put(mx, my + 1, f"{ramp}.base")
        p.put(mx + 1, my + 1, f"{ramp}.shade")
    # 촉수 넷: 아래로 늘어지며 프레임마다 반대로 흔들린다
    for i, tx in enumerate((4, 7, 9, 12)):
        for k in range(1, 6 if not squash else 5):
            sway = ((k + i + frame) // 2) % 2
            x = tx + (sway if i % 2 else -sway)
            p.put(x, oy + 7 + k, "flower.base" if k < 3 else "flower.shade")
    ey = oy + 5 + (1 if squash else 0)
    p.put(5, ey, "eye")
    p.put(10, ey, "eye")
    p.put(5, ey - 1, "eye")
    p.put(10, ey - 1, "eye")
    p.put(4, ey + 1, "blush")
    p.put(11, ey + 1, "blush")
    return p.grid()


# ── 눈금 앵무새: 옆모습(왼쪽을 봄)의 초록 앵무새, 날개에 바를 정 눈금 ────────────────────────────────
def _parrot(count, bob, beak_open):
    p = Px()
    oy = bob
    body = ellipse(8.2, oy + 8.6, 4.0, 3.6)
    head = ellipse(5.6, oy + 4.2, 3.2, 2.9)
    tail = {(11, oy + 11), (12, oy + 11), (12, oy + 12), (13, oy + 12), (13, oy + 13), (14, oy + 13), (14, oy + 14)}
    tail = {(x, y) for x, y in tail if y <= 15}
    p.mass(body | head, "grass")
    for x, y in tail:                                                 # 긴 꼬리깃: 빨강·파랑 두 갈래
        p.put(x, y, "cloth_red.base" if (x + y) % 2 else "blue.base")
    wing = {(x, y) for x, y in ellipse(9.4, oy + 8.8, 3.8, 2.4)}
    p.mass(wing, "grass")
    _darken(p, wing)
    # 눈금(크림): 세로 금 count개(넷까지), 다섯째는 가로로 긋는다
    for i in range(min(count, 4)):
        for k in range(3):
            p.put(7 + i * 2, oy + 8 + k - 1, "cream.hi")
    if count >= 5:
        for x in range(6, 15):
            if p.get(x, oy + 8):
                p.put(x, oy + 8, "cream.spec")
    # 얼굴: 노란 뺨, 눈, 굽은 상아빛 부리
    for x, y in ((4, oy + 4), (5, oy + 5), (4, oy + 5)):
        p.put(x, y, "lamp.hi")
    p.put(5, oy + 3, "eye")
    p.put(5, oy + 4, "eye")
    p.put(6, oy + 2, "grass.spec")
    p.put(2, oy + 3, "cream.hi")
    p.put(1, oy + 4, "cream.base")
    p.put(2, oy + 4, "cream.base")
    p.put(1, oy + 5, "cream.shade")
    if beak_open:
        p.put(2, oy + 6, "cream.shade")
        p.put(2, oy + 5, "cloth_red.shade")
    else:
        p.put(2, oy + 5, "cream.shade")
    for x in (7, 9):                                                  # 발(쥔 발가락)
        p.put(x, 13, "stone.shade")
        p.put(x + 1, 13, "stone.base")
    p.put(4, oy + 6, "blush")
    return p.grid()


# ── 줄 게: 옆모습(왼쪽을 봄) 소라게, 나선 껍데기 위에 작은 게 셋이 한 줄로 ────────────────────────────
_LEGS = {0: ((3, 0), (5, 1), (7, 0)), 1: ((2, 1), (5, 0), (8, 1))}


def _crab(frame):
    p = Px()
    bob = frame % 2
    # 다리 두 벌(녹빛 코랄): 디딜 때 몸이 1px 내려온다
    for x, lift in _LEGS[frame % 2]:
        p.put(x, 12 + bob, "rust.base")
        p.put(x - 1 if x < 5 else x, 13 + bob - lift, "rust.shade")
        p.put(x - 1 if x < 5 else x, 14, "rust.shade")
    shell = ellipse(10.2, 9.0 + bob, 5.0, 4.2)
    p.mass(shell, "cream")
    cx, cy = 10.6, 9.0 + bob                                          # 나선 무늬(녹 줄): 안에서 밖으로 감기는 선
    for k in range(240):
        t = k / 240 * 3.6 * math.pi
        r = 0.5 + 0.33 * t
        x, y = int(cx + math.cos(t) * r * 1.12), int(cy - math.sin(t) * r * 0.92)
        if (x, y) in shell:
            p.put(x, y, "rust.base" if x + y < 19 + bob else "rust.shade")
    p.put(7, 6 + bob, "cream.spec")
    front = ellipse(4.6, 10.4 + bob, 3.0, 2.2)
    p.mass(front, "rust")
    claw = ellipse(1.8, 9.2 + bob, 1.8, 1.5)
    p.mass(claw, "rust", lift=1)
    p.put(1, 10 + bob, "rust.ol")                                       # 집게 틈
    p.put(0, 8 + bob, "rust.spec")
    for x in (3, 5):                                                  # 눈자루와 눈
        p.put(x, 7 + bob, "rust.shade")
        p.put(x, 5 + bob, "eye")
        p.put(x, 6 + bob, "eye")
    p.put(6, 11 + bob, "blush")
    # 작은 게 셋(빨강, 3×3: 치켜든 밝은 집게 둘, 점 눈이 있는 둥근 몸). 껍데기 위에 한 줄로 서고,
    # 앞에서부터 프레임마다 하나씩 1px 뛴다
    tiny = ("C.C", "ReR", ".r.")
    legend = {"C": "cloth_red.spec", "e": "eye", "R": "cloth_red.base", "r": "cloth_red.shade"}
    for i, tx in enumerate((5, 9, 13)):
        ty = 2 + bob - (1 if i == frame else 0)
        for j, row in enumerate(tiny):
            for k, ch in enumerate(row):
                if ch != ".":
                    p.put(tx + k, ty + j, legend[ch])
    return p.grid()


PORT_MONSTERS = {
    "monster_twin_fish": [_twin_fish(i) for i in range(4)],
    "monster_ledger_gull": [_gull(0, "tuck", False), _gull(1, "half", True), _gull(-2, "spread", False),
                            _gull(-1, "half", False)],
    "monster_bubble_jelly": [_jelly(i) for i in range(4)],
    "monster_tally_parrot": [_parrot(2, 0, False), _parrot(3, 1, False), _parrot(4, 0, False), _parrot(5, -1, True)],
    "monster_queue_crab": [_crab(i) for i in range(4)],
}
