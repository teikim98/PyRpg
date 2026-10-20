"""지역 6(거울 호수) 몬스터 5종(16×16 프레임 4개 제자리).

화풍 통일(docs/art-overhaul/style-guide.md §3·§6.2, 기준 구현 forest_monsters.py): 코지 팔레트(cozypal)의 이름 있는 색만
쓰고, monsters.Px로 덩어리마다 3단 음영(빛은 왼쪽 위)을 칠한 뒤 auto_outline(재질 ol)으로 바깥 외곽선을 두른다.
옛 2프레임 디자인(모양·정체)은 그대로 두고 A·B 프레임의 차이를 4프레임 루프 하나로 펼쳤다.

| 몬스터 | 정체(문제) | 4프레임 |
|---|---|---|
| 부름 개구리 | 혀를 뻗었다가(함수 호출) 금빛 구슬을 물고 되감는다(return) | 땅에 붙은 몸: 앉음 → 웅크림(눌림) → 늘어나며 혀를 길게 뻗음 → 혀를 되감아 금빛 구슬을 묾 |
| 지퍼 장어 | 두 마리가 금빛 이빨로 맞물려 헤엄친다(zip) | 몸통 물결이 한 프레임에 2px씩 꼬리 쪽으로 흐름(고리·바퀴처럼 1/4 주기), 머리는 고정 |
| 람다 왜가리 | 다리가 λ로 꺾인 옆모습 왜가리(lambda·정렬) | 서기 → 목을 움츠림 → 부리로 물을 찌름(물보라) → 움츠림. λ 다리는 고정 |
| 겹연꽃 정령 | 연꽃 안에 연꽃, 그 안에 봉오리(재귀) | 튀는 몸: 기본 → 눌림 → 기본 → 늘어남. 안쪽 겹일수록 더 크게 오르내림(겹마다 메아리) |
| 쪽지 나방 | 날개를 접어 위를 향한 삼각형, 날개마다 핀으로 꽂은 쪽지(메모) | 나는 몸 0 → −1 → −2 → −1, 1·3번에 날개를 벌리고 쪽지가 팔락임 |

지역 1~5와 실루엣이 겹치지 않게: 지퍼 장어는 가로로 긴 두 줄 띠(지역 5 쌍둥이 물고기의 나비넥타이와 다름),
쪽지 나방은 날개를 접은 삼각형 윗모습(지역 4 글자 나방은 날개를 활짝 편 정면).
"""
import math

from monsters import FLY, Px, ellipse


def _body(w, h, bottom=14, cx=8.0):
    """바닥 줄(bottom)에 붙은 반타원 몸(폭 w, 높이 h). forest_monsters._body와 같은 모양 규칙."""
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


def _layer_line(p, cells, under, ramp):
    """겹친 덩어리 둘레 중 아래 덩어리 위에 놓인 칸을 그 덩어리 재질의 외곽선 색으로(안쪽 경계, §3.1)."""
    for x, y in {(x + dx, y + dy) for x, y in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - cells:
        if (x, y) in under:
            p.put(x, y, f"{ramp}.ol")


# ── 부름 개구리: 낮고 넓은 연두 개구리. 혀를 뻗고(호출) 금빛 구슬을 물고 돌아온다(return) ──────────
def _frog(w, h, tongue=False, orb=False):
    p = Px()
    cx = 7.0
    body, top = _body(w, h, cx=cx)
    eyes = ellipse(cx - 3.0, top + 0.4, 2.1, 1.9) | ellipse(cx + 3.0, top + 0.4, 2.1, 1.9)   # 툭 튀어나온 눈두덩
    p.mass(body | eyes, "grass", shade_below=13)
    belly = {(x, y) for x, y in ellipse(cx, 13.2, w / 2 - 2.2, 2.4) if (x, y) in body}
    p.mass(belly, "cream", lift=1)
    for ex in (cx - 3.0, cx + 3.0):                      # 흰 눈 + 점 눈동자
        x0, y0 = int(ex) - 1, top - 1
        p.put(x0, y0, "white")
        p.put(x0 + 1, y0, "white")
        p.put(x0, y0 + 1, "white")
        p.put(x0 + 1, y0 + 1, "eye")
    my = top + 3                                         # 입(가로 외곽선 한 줄, 양끝 살짝 올라감)
    for x in range(int(cx) - 3, int(cx) + 4):
        p.put(x, my, "grass.ol")
    p.put(int(cx) - 4, my - 1, "grass.ol")
    p.put(int(cx) + 4, my - 1, "grass.ol")
    p.put(int(cx) - 4, my + 1, "blush")
    p.put(int(cx) + 4, my + 1, "blush")
    for x in (int(cx) - 5, int(cx) - 4, int(cx) + 4, int(cx) + 5):   # 앞발
        p.put(x, 14, "grass.shade")
    if tongue:                                           # 오른쪽으로 길게 뻗은 분홍 혀, 끝은 둥근 덩이
        for x in range(int(cx) + 4, 14):
            p.put(x, my, "flower.base")
        p.put(14, my - 1, "flower.hi")
        p.put(15, my - 1, "flower.base")
        p.put(14, my, "flower.base")
        p.put(15, my, "flower.shade")
    if orb:                                              # 되감은 혀 끝에 문 금빛 구슬(돌려받은 값)
        ox = int(cx) + 4
        p.put(ox, my, "flower.base")
        p.put(ox + 1, my - 1, "lamp.hi")
        p.put(ox + 2, my - 1, "lamp.base")
        p.put(ox + 1, my, "lamp.base")
        p.put(ox + 2, my, "lamp.shade")
        p.put(ox + 1, my - 2, "lamp.spec")
    return p.grid(skip=("lamp.spec",))


# ── 지퍼 장어: 보라 장어(위)와 물빛 장어(아래)가 금빛 이빨로 맞물렸다. 머리는 왼쪽, 꼬리 쪽은 아직 벌어짐 ──────
def _eel_upper():
    """위 장어(아래 장어는 8행을 축으로 뒤집은 것): 둥근 머리(왼쪽 0~3열, 3~7행) + 3줄 몸통(4~11열, 5~7행)
    + 가늘어지는 꼬리(12~15열, 위로 휘어 벌어짐) + 등지느러미 점."""
    cells = {(x, y) for x in range(0, 4) for y in range(3, 8)} - {(0, 3), (0, 7), (3, 3)}
    cells |= {(x, y) for x in range(3, 12) for y in range(5, 8)}
    cells |= {(12, 5), (12, 6), (13, 4), (13, 5), (14, 3), (14, 4), (15, 2), (15, 3)}
    cells |= {(x, 4) for x in (5, 6, 8, 9)}
    return cells


def _zip_eel(phase):
    """몸통 물결(1px, 8칸 주기)이 프레임마다 2px씩 꼬리 쪽으로 흐른다. 머리 쪽 4열은 고정.
    두 몸 사이 8행은 맞물린 금빛 이빨(위·아래 장어의 이가 번갈아)이라 몸과 이빨 사이에 빈틈이 없다."""
    def wave(x):
        return 0 if x < 4 else round(math.sin((x - 4 - phase * 2) / 8 * 2 * math.pi))

    upper = _eel_upper()
    lower = {(x, 16 - y) for x, y in upper}
    p = Px()
    p.mass({(x, y + wave(x)) for x, y in upper}, "cloth_purple")
    p.mass({(x, y + wave(x)) for x, y in lower}, "water", lift=1)
    for x in range(2, 12):                               # 맞물린 이빨
        p.put(x, 8 + wave(x), "brass.hi" if x % 2 == 0 else "brass.shade")
    for y, ramp in ((5, "cloth_purple"), (11, "water")):  # 눈(흰자 + 점) · 입
        p.put(1, y, "white")
        p.put(2, y, "eye")
        p.put(0, y + (1 if y < 8 else -1), f"{ramp}.ol")
    return p.grid()


# ── 람다 왜가리: 옆모습(왼쪽을 봄)의 흰 왜가리, 짙은 댕기 깃, 긴 노란 부리, λ로 꺾인 다리 ──────────────
_HERON_STAND = """
....kkk.........
...kBBBB........
YYYyBeBB........
....BBBB........
.....BB.........
......BB........
......BB........
.....BBBB.......
.....BBBBBBBG...
......BBBBBBBGG.
.......BBBBGG...
........L.......
.........L......
........l.L.....
.......l...L....
.....lll...LLL..
"""
_HERON_STRIKE = """
................
................
................
................
...kkk..........
..kBBBB.........
..BeBBBB........
.yy...BBB.......
Yy.....BBBBBBG..
Y......BBBBBBBGG
........BBBBGG..
........L.......
.W.......L......
WwW.....l.L.....
.......l...L....
.....lll...LLL..
"""
_HERON_LEGEND = {"B": "cloth_white.base", "k": "hair_ink.base", "Y": "lamp.base", "y": "lamp.shade",
                 "e": "eye", "G": "stone.base", "L": "brass.shade", "l": "brass.ol", "W": "sky.spec", "w": "water.hi"}


def _heron(grid, duck=0):
    lines = [ln.strip() for ln in grid.strip("\n").splitlines()]
    p = Px()
    body = {(i, j + (duck if j < 8 else 0)) for j, ln in enumerate(lines) for i, ch in enumerate(ln) if ch == "B"}
    p.mass(body, "cloth_white")
    for j, ln in enumerate(lines):
        for i, ch in enumerate(ln):
            if ch in _HERON_LEGEND and ch != "B":
                p.put(i, j + (duck if j < 8 else 0), _HERON_LEGEND[ch])
    for j, ln in enumerate(lines):                      # 날개 끝 그늘 줄(몸과 날개 사이)
        for i, ch in enumerate(ln):
            if ch == "G" and p.get(i - 1, j) == "cloth_white.base":
                p.put(i - 1, j, "cloth_white.shade")
    return p.grid(skip=("sky.spec", "water.hi"))


# ── 겹연꽃 정령: 분홍 연꽃 안에 연보라 연꽃(얼굴), 그 안에 흰 봉오리. 연잎 받침 위 ─────────────────
def _petal(cx, cy, w, h):
    """끝이 뾰족한 꽃잎(마름모꼴): |dx|/w + |dy|/h <= 1."""
    return {(x, y) for y in range(16) for x in range(16)
            if abs(x + 0.5 - cx) / w + abs(y + 0.5 - cy) / h <= 1.0}


def _nesting_lily(spread, mid_dy, inner_dy):
    p = Px()
    pad = ellipse(8, 14.4, 6.8, 1.6)
    p.mass(pad, "moss", shade_below=15)
    h = 3.8 - spread * 0.5
    outer = (_petal(4.0 - spread, 10.2 + spread * 0.5, 2.8, h) | _petal(12.0 + spread, 10.2 + spread * 0.5, 2.8, h) |
             ellipse(8, 12.0, 5.4, 2.2))
    outer = {(x, y) for x, y in outer if y <= 13}
    p.mass(outer, "flower")
    middle = (_petal(8, 7.6 + mid_dy, 2.2, 3.4) | _petal(5.4, 9.0 + mid_dy, 1.9, 2.8) |
              _petal(10.6, 9.0 + mid_dy, 1.9, 2.8) | ellipse(8, 10.4 + mid_dy, 3.4, 1.8))
    p.mass(middle, "cloth_purple", lift=1)
    _layer_line(p, middle, outer, "flower")
    ey = int(9 + mid_dy)
    for ex in (6, 9):                                     # 가운데 연꽃의 얼굴
        p.put(ex, ey, "eye")
        p.put(ex, ey + 1, "eye")
    p.put(5, ey + 2, "blush")
    p.put(10, ey + 2, "blush")
    inner = _petal(8, 5.0 + inner_dy, 1.6, 2.6)           # 맨 안쪽 봉오리(끝이 뾰족, 분홍 끝)
    p.mass(inner, "cream", lift=1)
    _layer_line(p, inner, middle, "cloth_purple")
    top = min(y for _, y in inner)
    for x, y in inner:
        if y == top:
            p.put(x, y, "flower.hi")
    return p.grid()


# ── 쪽지 나방: 날개를 접어 위를 향한 삼각형(윗모습), 깃털 더듬이, 날개마다 핀으로 꽂은 쪽지 ────────────
def _moth(dy, open_):
    p = Px()
    oy = 1 + dy
    gap = 1 if open_ else 0
    left, right = set(), set()
    for y in range(oy + 3, oy + 14):                      # 삼각형 날개: 꼭대기(머리 밑)에서 아래로 넓어짐
        hw = 0.8 + (y - oy - 3) * 0.62
        if y == oy + 13:                                  # 날개 끝 바깥 모서리는 둥글게
            hw -= 1.2
        for x in range(16):
            dx = x + 0.5 - 8
            if -hw <= dx < 0:
                left.add((x - gap, y))
            elif 0 <= dx <= hw:
                right.add((x + gap, y))
    p.mass(left, "sky")
    p.mass(right, "sky")
    for x, y in right:                                    # 오른쪽 날개는 한 단계 그늘(빛이 왼쪽 위)
        if p.get(x, y) == "sky.hi":
            p.put(x, y, "sky.base")
    for wing in (left, right):                            # 날개 끝 연보라 띠
        bottom = max(y for _, y in wing)
        for x, y in wing:
            if y == bottom - 1:
                p.put(x, y, "cloth_purple.base")
    for y in range(oy + 3, oy + 13):                      # 가운데 몸통(보송한 크림, 날개 사이)
        p.put(7, y, "cream.base")
        p.put(8, y, "cream.shade")
    head = ellipse(8, oy + 2.6, 1.7, 1.4)
    p.mass(head, "cream")
    p.put(7, oy + 2, "eye")
    p.put(8, oy + 2, "eye")
    for x, y in ((6, oy + 1), (5, oy), (4, oy - 1), (9, oy + 1), (10, oy), (11, oy - 1)):   # 더듬이(바깥으로 뻗음)
        p.put(x, y, "hair_brown.base")
    p.put(4, oy, "hair_brown.shade")                      # 깃털 끝
    p.put(11, oy, "hair_brown.shade")
    # 쪽지(크림 종이 2×3, 위에 황동 핀, 글자 줄 하나): 날개를 벌리면 바깥으로 기운다
    for nx, tilt in ((4 - gap, -gap), (10 + gap, gap)):
        ny = oy + 8
        for j in range(3):
            for i in range(2):
                p.put(nx + i + (tilt if j == 2 else 0), ny + j, "cream.spec")
        p.put(nx, ny + 1, "hair_ink.shade")
        p.put(nx + 1, ny + 1, "hair_ink.shade")
        p.put(nx + (1 if nx < 8 else 0), ny - 1, "brass.hi")
    return p.grid()


LAKE_MONSTERS = {
    # 앉음(12·7) → 웅크림(13·6) → 늘어나며 혀 뻗음(11·8) → 혀를 되감아 구슬을 묾(12·7)
    "monster_call_frog": [_frog(12, 7), _frog(13, 6), _frog(11, 8, tongue=True), _frog(12, 7, orb=True)],
    "monster_zip_eel": [_zip_eel(i) for i in range(4)],
    "monster_lambda_heron": [_heron(_HERON_STAND), _heron(_HERON_STAND, duck=1), _heron(_HERON_STRIKE),
                             _heron(_HERON_STAND, duck=1)],
    # 기본 → 눌림(바깥 꽃잎 벌어짐, 안쪽 겹이 내려앉음) → 기본 → 늘어남(안쪽 겹일수록 더 높이)
    "monster_nesting_lily": [_nesting_lily(0, 0, 0), _nesting_lily(0.6, 1, 1), _nesting_lily(0, 0, 0),
                             _nesting_lily(-0.4, -1, -2)],
    "monster_memo_moth": [_moth(dy, i % 2 == 1) for i, dy in enumerate(FLY)],
}
