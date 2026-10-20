"""지역 2(갈림길 숲) 몬스터 6종(16×16 프레임 4개 제자리).

화풍 통일(docs/art-overhaul/style-guide.md §3·§6.2, 기준 구현 monsters.py): 코지 팔레트(cozypal)의 이름 있는 색만 쓰고,
monsters.Px로 덩어리마다 3단 음영(빛은 왼쪽 위)을 칠한 뒤 auto_outline(재질 ol)으로 바깥 외곽선을 두른다.
각 몬스터는 문제 주제를 실루엣으로 읽히게 한다(옛 디자인 유지).

| 몬스터 | 정체(문제) | 4프레임 |
|---|---|---|
| 갈래 새싹 | 줄기가 Y자로 두 갈래(if/else, P0201·P0202) | 통통 튀는 몸: 기본 → 눌림(잎 처짐) → 기본 → 늘어남(잎 듦), 바닥 줄 고정 |
| 달력 부엉이 | 배에 달력 한 장, 빨간 29일(윤년, P0203) | 도약: 서기 → 웅크림 → 날개 펴고 2px 뜀 → 1px 내려옴 |
| 고리 뱀 | 제 꼬리를 문 고리(반복, P0204·P0206) | 비늘 띠가 한 프레임에 1/4칸씩 돌아 고리가 도는 것처럼, 4번째에 눈 깜빡임 |
| 숫자 버섯 | 갓의 숫자가 3 → 2 → 1 → 0(거꾸로 세기, P0205) | 숫자가 한 칸씩 줄고 몸은 기본 → 눌림 → 기본 → 늘어남 |
| 우박 도깨비불 | 얼음빛 불꽃, 둘레의 우박 세 알(우박 수열, P0207) | 나는 몸 0 → −1 → −2 → −1px, 불꽃 끝이 흔들리고 우박이 오르내리며 돈다 |
| 도토리 진드기 | 깍정이 모자 도토리에 다리 여섯(최댓값 찾기, P0209) | 다리 두 벌이 번갈아, 디딜 때 몸 1px 내려옴, 4번째에 눈 깜빡임 |
"""
import math

from monsters import FLY, Px, ellipse


def _body(w, h, bottom=14, cx=8.0):
    """바닥 줄(bottom)에 붙은 반타원 몸(폭 w, 높이 h). 슬라임(monsters._slime)과 같은 모양 규칙."""
    top = bottom + 1 - h
    cells = set()
    for y in range(top, bottom + 1):
        t = (y - top + 0.5) / h
        k = min(1.0, t / 0.6)
        hw = w / 2 * math.sqrt(max(0.0, 1 - (1 - k) ** 2))
        if y == bottom:
            hw -= 0.7
        for x in range(16):
            if abs(x + 0.5 - cx) <= hw:
                cells.add((x, y))
    return cells, top


def _face(p, top, h, x_l=5, x_r=10, blush=True):
    """점 눈 1×2 + 볼터치(눈 아래 줄, 1px 바깥)."""
    ey = top + max(1, (h * 40) // 100)
    for ex in (x_l, x_r):
        p.put(ex, ey, "eye")
        p.put(ex, ey + 1, "eye")
    if blush:
        p.put(x_l - 1, ey + 2, "blush")
        p.put(x_r + 1, ey + 2, "blush")
    return ey


# ── 갈래 새싹: 씨앗 몸에서 줄기가 Y자로 두 갈래로 갈라져 잎 두 장 ───────────────────────────
def _sprout(w, h, leaf_dy):
    p = Px()
    body, top = _body(w, h)
    p.mass(body, "wood", shade_below=13)
    p.put(min(x for x, y in body if y == top + 1) + 1, top + 1, "wood.spec")
    ey = _face(p, top, h)
    p.put(7, ey + 2, "wood.ol")                      # 작은 입
    p.put(8, ey + 2, "wood.ol")
    # 줄기: 정수리에서 위로 2px, 그다음 Y자로 갈라짐
    for y in (top - 1, top - 2):
        p.put(8, y, "moss.base")
    p.put(7, top - 3, "moss.base")
    p.put(9, top - 3, "moss.shade")
    p.put(6, top - 4, "moss.base")
    p.put(10, top - 4, "moss.shade")
    # 잎 두 장(풀빛, 왼쪽 잎은 빛을 받아 밝고 오른쪽 잎은 한 단계 그늘). leaf_dy: 눌릴 때 처지고 늘어날 때 든다
    ly = top - 5 + leaf_dy
    left = ellipse(3.6, ly + 0.5, 2.7, 1.5)
    right = ellipse(12.4, ly + 0.5, 2.7, 1.5)
    p.mass(left, "grass")
    p.mass(right, "grass")
    for x, y in right:
        if p.get(x, y) == "grass.hi":
            p.put(x, y, "grass.base")
    p.put(2, ly, "grass.spec")
    p.put(5, ly + 1, "grass.shade")                  # 잎맥
    p.put(11, ly + 1, "grass.shade")
    return p.grid()


# ── 달력 부엉이: 배에 고리 철 달력 한 장(청록 머리띠, 날짜 점, 빨갛게 표시한 29일) ─────────────
_OWL = """
..t........t..
..tt......tt..
..hhhhhhhhhh..
.hhWWhhhhWWhh.
.hWeWhhhhWeWh.
.hWWWhkkhWWWh.
.hhhhhhkhhhhh.
.hhPPPPPPPPhh.
.hhCoCCCCoChh.
.hhCdCdCdCChh.
.hhCdCdCdRChh.
.hhCCCCCCCChh.
..hhhhhhhhhh..
"""
_OWL_DETAIL = {"W": "cream.spec", "e": "eye", "k": "lamp.base", "P": "teal.base", "C": "cream.hi",
               "o": "stone.hi", "d": "cream.shade", "R": "brick.base"}
_OWL_WINGS = {
    "tuck": ((0, 6), (0, 7), (0, 8), (0, 9), (13, 6), (13, 7), (13, 8), (13, 9)),
    "half": ((-1, 5), (0, 5), (-1, 6), (0, 6), (0, 7), (13, 5), (14, 5), (13, 6), (14, 6), (13, 7)),
    "spread": ((-1, 2), (-1, 3), (0, 3), (-1, 4), (0, 4), (-1, 5), (0, 5), (0, 6), (0, 7),
               (14, 2), (14, 3), (13, 3), (14, 4), (13, 4), (14, 5), (13, 5), (13, 6), (13, 7)),
}


def _owl(dy, wings, feet):
    p = Px()
    ox, oy = 1, 2 + dy
    lines = [ln.strip() for ln in _OWL.strip("\n").splitlines()]
    cells = {(ox + i, oy + j) for j, ln in enumerate(lines) for i, ch in enumerate(ln) if ch != "."}
    p.mass(cells, "hair_brown")
    for j, ln in enumerate(lines):
        for i, ch in enumerate(ln):
            if ch in _OWL_DETAIL:
                p.put(ox + i, oy + j, _OWL_DETAIL[ch])
    p.put(ox + 3, oy + 3, "white")                     # 눈 반사광
    p.put(ox + 2, oy, "hair_brown.hi")                 # 귀깃 끝
    for x, y in _OWL_WINGS[wings]:
        p.put(ox + x, oy + y, "hair_brown.shade" if x > 6 else "hair_brown.base")
    if feet:
        for x in (4, 5, 9, 10):
            p.put(x, oy + 13, "lamp.shade")
    return p.grid()


# ── 고리 뱀: 제 꼬리를 문 보라 고리(우로보로스). 비늘 띠가 돌고, 노란 배 비늘이 안쪽에 ─────────────
def _loop_snake(phase):
    p = Px()
    cx, cy = 7.5, 8.5
    r_out, r_in = 6.9, 3.3
    head_ang = -math.pi / 4                             # 머리는 오른쪽 위
    ring = set()
    for y in range(16):
        for x in range(16):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            r = math.hypot(dx, dy)
            if r_in <= r <= r_out:
                da = (math.atan2(dy, dx) - head_ang + math.pi) % (2 * math.pi) - math.pi
                if not -0.3 < da < 0.5:                 # 머리가 꼬리를 무는 자리는 비운다
                    ring.add((x, y))
    p.mass(ring, "cloth_purple")
    for x, y in ring:
        dx, dy = x + 0.5 - cx, y + 0.5 - cy
        r = math.hypot(dx, dy)
        ang = math.atan2(dy, dx)
        if r < r_in + 1.1:                              # 안쪽 가장자리 = 노란 배 비늘
            p.put(x, y, "lamp.base" if dx + dy > 0 else "lamp.shade")
            continue
        # 비늘 띠: 각도 방향으로 12칸, 프레임마다 1/4칸씩 돈다
        band = int((ang + math.pi) / (2 * math.pi) * 12 + phase * 0.5) % 2
        if band and r < r_out - 1.0 and p.get(x, y) == "cloth_purple.base":
            p.put(x, y, "cloth_purple.shade")
    # 머리: 오른쪽 위에서 고리 쪽을 보며 꼬리 끝을 문다
    head = """
    ...HHHH.
    ..HhhhhH
    .HhwEhhH
    .HhhEhhH
    .mmmmhHH
    Rttm.HH.
    """
    legend = {"H": "cloth_purple.base", "h": "cloth_purple.hi", "w": "white", "E": "eye",
              "m": "cloth_purple.ol", "R": "brick.base", "t": "lamp.hi"}
    p.rows(head, legend, 8, 0)
    if phase == 3:                                      # 눈 깜빡임
        p.put(11, 2, "cloth_purple.hi")
        p.put(12, 2, "cloth_purple.hi")
        p.put(11, 3, "eye")
        p.put(12, 3, "eye")
    return p.grid()


# ── 숫자 버섯: 빨간 갓 한가운데 흰 숫자가 3 → 2 → 1 → 0으로 줄어든다 ───────────────────────────
_DIGITS = {
    "0": ("WWW", "W.W", "W.W", "W.W", "WWW"),
    "1": (".W.", "WW.", ".W.", ".W.", "WWW"),
    "2": ("WW.", "..W", ".W.", "W..", "WWW"),
    "3": ("WW.", "..W", ".W.", "..W", "WW."),
}


def _count_shroom(digit, top, rx):
    p = Px()
    # 줄기(크림, 얼굴이 있다)
    stem = {(x, y) for x in range(5, 11) for y in range(top + 7, 15)} | {(x, 14) for x in (4, 11)}
    p.mass(stem, "cream", shade_below=14)
    _face(p, top + 7, 15 - (top + 7), x_l=6, x_r=9)
    # 갓(빨강): 위가 둥근 반타원 + 아래 주름 그늘
    cap = {(x, y) for x, y in ellipse(8, top + 4.6, rx, 4.6) if y <= top + 6}
    p.mass(cap, "brick")
    for x, y in cap:
        if y == top + 6:
            p.put(x, y, "brick.shade")
    for x, y in ((3, top + 3), (12, top + 4), (5, top + 1)):
        if (x, y) in cap:
            p.put(x, y, "cream.hi")
    for j, row in enumerate(_DIGITS[digit]):
        for i, ch in enumerate(row):
            if ch == "W":
                p.put(7 + i, top + 1 + j, "cream.spec")
    return p.grid()


# ── 우박 도깨비불: 얼음빛 불꽃에 얼굴, 둘레를 도는 우박 세 알 ─────────────────────────────────
_WISP_ROWS = [(7, 7), (7, 8), (6, 8), (5, 9), (4, 10), (4, 11), (3, 11), (3, 11), (3, 11), (4, 10), (5, 9)]
# 우박 세 알(2×2)의 자리: 프레임마다 시계 방향으로 돌면서 오르내린다
_HAIL = (((0, 4), (12, 1), (13, 12)), ((1, 1), (13, 6), (7, 14)), ((4, 0), (13, 11), (0, 10)),
         ((0, 1), (11, 13), (1, 7)))


def _wisp(frame, dy):
    p = Px()
    oy = 3 + dy
    flame = set()
    for j, (x0, x1) in enumerate(_WISP_ROWS):
        lean = 1 if (frame % 2 and j < 3) else 0          # 불꽃 끝이 흔들린다
        flame |= {(x + lean, oy + j) for x in range(x0, x1 + 1)}
    p.mass(flame, "teal", lift=1)
    for x, y in ellipse(7.5, oy + 8.2, 2.2, 1.6):          # 차가운 속불
        if (x, y) in flame:
            p.put(x, y, "sky.spec")
    p.put(5, oy + 4, "white")
    ey = oy + 5
    for ex in (5, 9):
        p.put(ex, ey, "eye")
        p.put(ex, ey + 1, "eye")
    p.put(4, ey + 2, "blush")
    p.put(10, ey + 2, "blush")
    for hx, hy in _HAIL[frame]:
        p.put(hx, hy, "white")
        p.put(hx + 1, hy, "sky.hi")
        p.put(hx, hy + 1, "sky.hi")
        p.put(hx + 1, hy + 1, "sky.shade")
    return p.grid()


# ── 도토리 진드기: 깍정이 모자 도토리에 다리 여섯 ───────────────────────────────────────────
_LEGS = {
    0: ((2, 8, -1), (1, 10, 0), (2, 12, 1)),
    1: ((2, 8, 0), (1, 10, 1), (2, 12, 0)),
}


def _acorn(frame):
    p = Px()
    bob = frame % 2
    blink = frame == 3
    for x, y, d in _LEGS[frame % 2]:                       # 다리(가죽빛, 몸 쪽 기본·바깥 그늘), 오른쪽은 반대 박자
        p.put(x + 1, y + d + bob, "leather.base")
        p.put(x, y + d + bob + (1 if d >= 0 else 0), "leather.shade")
        rd = -d
        p.put(14 - x, y + rd + bob, "leather.base")
        p.put(15 - x, y + rd + bob + (1 if rd >= 0 else 0), "leather.shade")
    nut = ellipse(8, 9.6 + bob, 4.8, 4.4)
    nut = {(x, y) for x, y in nut if y >= 6 + bob}
    p.mass(nut, "rust", shade_below=12 + bob)
    cap = {(x, y) for x in range(3, 13) for y in range(4 + bob, 7 + bob)} - {(3, 4 + bob), (12, 4 + bob)}
    p.mass(cap, "wood")
    for x, y in cap:                                       # 깍정이 비늘 무늬
        if (x + y) % 3 == 0 and p.get(x, y) == "wood.base":
            p.put(x, y, "wood.shade")
    for y in (2 + bob, 3 + bob):
        p.put(8, y, "wood.base")
    p.put(9, 2 + bob, "wood.shade")
    ey = 8 + bob
    for ex in (6, 10):
        if blink:
            p.put(ex, ey + 1, "eye")
            p.put(ex - 1 if ex < 8 else ex + 1, ey + 1, "eye")
        else:
            p.put(ex, ey, "eye")
            p.put(ex, ey + 1, "eye")
    p.put(5, 7 + bob, "rust.spec")                         # 껍질 광택
    p.put(5, ey + 2, "blush")
    p.put(11, ey + 2, "blush")
    return p.grid()


FOREST_MONSTERS = {
    # 통통 튀는 몸: 기본(폭 10·높이 7) → 눌림(12·6, 잎 처짐) → 기본 → 늘어남(9·8, 잎 듦)
    "monster_fork_sprout": [_sprout(10, 7, 0), _sprout(12, 6, 1), _sprout(10, 7, 0), _sprout(9, 8, -1)],
    "monster_leap_owl": [_owl(0, "tuck", True), _owl(1, "half", True), _owl(-2, "spread", False),
                         _owl(-1, "half", False)],
    "monster_loop_snake": [_loop_snake(i) for i in range(4)],
    "monster_count_shroom": [_count_shroom("3", 2, 7.0), _count_shroom("2", 3, 7.6), _count_shroom("1", 2, 7.0),
                             _count_shroom("0", 1, 6.6)],
    "monster_hail_wisp": [_wisp(i, dy) for i, dy in enumerate(FLY)],
    "monster_acorn_mite": [_acorn(i) for i in range(4)],
}
