"""지역 4(무너진 대도서관) 지형 타일(16×16). manifest의 overworld 타일셋에서 지역 3 타일 바로 뒤에 이 순서로 붙는다.

화풍 통일(docs/art-overhaul/style-guide.md §4.4, 기준 구현 forest_tiles.py): 코지 팔레트(cozypal)의 이름 있는 색만 쓴다.
지역 강조색은 cloth_indigo(잉크 남색) · cream(양피지) · brick(봉랍 빨강). 강조색은 책등·카펫·낱장처럼 작은 면에만.
- 바닥 색은 공통 `wood`(따뜻한 나무 마루). 강조 램프 셋은 맵 대부분을 덮기에 맞지 않는다: cream.base는 주인공의
  흰 옷(cloth_white.hi)과 명도가 가까워 일행이 묻히고 떠 있는 낱장(cream)도 바닥에 녹으며, cloth_indigo·brick은
  채도가 높아 면적 15% 규칙을 넘는다. wood.base 위에서는 양피지 낱장·남색/빨강 책등이 모두 또렷하다.
- 바닥(lib_floor, lib_carpet, floating_pages)은 불투명하고 가장자리가 이어진다(무늬는 x % 16, y % 16). 마루는
  맵의 대부분을 덮으므로 이음새를 외곽선이 아닌 그늘색으로 낮게 둔다(지역 1 floor_wood보다 차분하게).
- 맵을 덮는 벽은 바닥보다 한 단계 어둡게(§3.4): 벽 윗면(lib_wall_top, 무너진 천장 쪽 두꺼운 벽)은 돌 램프의
  외곽선·그늘 단계, 벽 앞면(lib_wall)은 돌 블록 + 나무 징두리 판벽, 책장(bookshelf)은 그늘진 나무 틀 속 책등.
  같은 책장이 100칸 넘게 이어지므로 한 칸 안의 위·아래 칸에 키·색·기울기가 다른 책을 비대칭으로 꽂아
  가로·세로로 이어도 '같은 칸 × 격자'로 읽히지 않게 한다.
- 숨겨진 길 shelf_gap은 책장과 같은 틀·위 칸에, 아래 칸 가운데 책 네 권이 빠져 뒤판 없는 깊은 어둠(void)이 보이고
  그 바닥에 쓰러진 책 한 권, 어둠 속에서 찬 바람 한 점(청록)이 샌다. 바로 아래 칸이 떠 있는 낱장(floating_pages).
- 물체(bookshelf_fallen, book_pile, reading_desk, candle_frozen, broken_pillar)는 맵의 deco 레이어에 마루 위로
  겹쳐 그려지므로 배경이 투명하다. 바깥 외곽선은 auto_outline(재질 ol), 발치에 반투명 그림자.
- 시간이 멈춘 도서관: 촛불은 불꽃 모양 그대로 청록 서리에 갇혀 있고(애니메이션 없음), 낱장은 공중에 멈춰 떠 있다.
"""
from cozypal import auto_outline, c, noise, speckle
from monsters import Px, ellipse

T = 16


# ── 도구 ─────────────────────────────────────────────────────────────────────────
def _grid(fn):
    return ["".join(fn(x, y) for x in range(T)) for y in range(T)]


def _set(g, x, y, ch):
    """이어지는 바닥용: 좌표를 16으로 감아서 칠한다."""
    x %= T
    y %= T
    g[y] = g[y][:x] + ch + g[y][x + 1:]


def _put(g, x, y, ch):
    """물체용: 칸 밖은 무시한다."""
    if 0 <= x < T and 0 <= y < T:
        g[y] = g[y][:x] + ch + g[y][x + 1:]


def _shadow(g, y, x0, x1, name="shadow"):
    """발치 그림자: y줄의 x0..x1 중 투명한 칸을 반투명 그림자로."""
    for x in range(x0, x1 + 1):
        if 0 <= x < T and g[y][x] == ".":
            _put(g, x, y, c(name))
    return g


def _under(base, top):
    """불투명 바닥 위에 물체 그리드를 얹는다('.'은 바닥이 비침)."""
    return ["".join(t if t != "." else b for b, t in zip(br, tr)) for br, tr in zip(base, top)]


# ── 바닥: 나무 마루 ─────────────────────────────────────────────────────────────
FLOOR = "wood"
# 널(4줄)마다 끝 이음새 자리(None이면 이음새 없이 옆 칸으로 길게 이어지는 널). 널마다 이음새를 두면 칸마다
# 짧은 널이 엇갈려 쌓인 벽돌 벽처럼 읽혀서(게임 화면에서 확인) 두 장에만 둔다
_JOINTS = (5, None, 12, None)


def lib_floor(seed=401):
    """가로 널 네 장(한 장 4줄). 널 사이 줄과 끝 이음새는 그늘색(외곽선 아님) 1px.
    결(그늘 2~3px)과 닳은 점, 먼지 알갱이(밝음)를 드물게. 대비를 낮춰 일행·몬스터가 바닥보다 또렷하게.
    이음새 옆에 밝은 점을 두면 널이 벽돌처럼 읽혀서 두지 않는다."""
    base, sh = c(f"{FLOOR}.base"), c(f"{FLOOR}.shade")
    g = _grid(lambda x, y: sh if y % 4 == 3 else base)
    for band, j in enumerate(_JOINTS):
        y0 = band * 4
        if j is not None:
            for y in range(y0, y0 + 3):
                _set(g, j, y, sh)
        # 결: 널마다 짧은 그늘 결 하나(이음새와 겹치지 않는 자리)
        gx = ((j if j is not None else band * 5) + 4 + int(noise(band, 0, seed) * 6)) % T
        gy = y0 + 1 + int(noise(band, 1, seed) * 2)
        for k in range(2 + (band % 2)):
            _set(g, gx + k, gy, sh)
    g = speckle(g, f"{FLOOR}.base", f"{FLOOR}.shade", 0.035, seed + 2)
    g = speckle(g, f"{FLOOR}.base", f"{FLOOR}.hi", 0.018, seed + 3)
    return g


LIB_FLOOR = lib_floor()


# ── 바닥: 카펫(봉랍 빨강 바탕, 마름모 격자, 양피지 무늬) ───────────────────────────
def lib_carpet(seed=411):
    """빨강(brick) 바탕에 그늘색 마름모 격자. 마름모 가운데에 양피지 꽃 무늬(십자 4px + 가운데 1px),
    격자가 만나는 칸 모서리(네 칸이 모이는 곳)에 작은 남색 점. 닳은 자국은 그늘 점. 사방으로 이어진다."""
    g = []
    for y in range(T):
        row = ""
        for x in range(T):
            d = abs(x + 0.5 - 8) + abs(y + 0.5 - 8)
            if d == 8:
                row += c("brick.shade")
            elif d == 7:
                row += c("brick.hi") if (x + y) % 2 else c("brick.base")
            else:
                row += c("brick.base")
        g.append(row)
    for x, y in ((7, 6), (8, 6), (6, 7), (9, 7), (6, 8), (9, 8), (7, 9), (8, 9)):   # 가운데 무늬 테
        _set(g, x, y, c("cream.shade"))
    for x, y in ((7, 7), (8, 7), (7, 8)):
        _set(g, x, y, c("cream.hi"))
    _set(g, 8, 8, c("cream.base"))
    for x, y in ((0, 0), (15, 0), (0, 15), (15, 15)):                               # 모서리 남색 점(2×2로 이어짐)
        _set(g, x, y, c("cloth_indigo.shade"))
    g = speckle(g, "brick.base", "brick.shade", 0.04, seed)
    return g


LIB_CARPET = lib_carpet()


# ── 벽 앞면: 몰딩, 돌 블록, 난간대, 나무 징두리 판벽, 걸레받이 ──────────────────────
_WALL = """
HHHHHHHHHHHHHHHH
wwwwwwwwwwwwwwww
SSSSSSSoSSSSSSSo
sssssssosssssssx
sssssssossxssssx
oooooooooooooooo
SSSoSSSSSSSoSSSS
sxsossssssxossss
oooooooooooooooo
HHHHHHHHHHHHHHHH
WWWWWWWWWWWWWWWW
ZWbbbbbZZWbbbbbZ
ZWbddddZZWbddddZ
ZWbddddZZWbddddZ
ZWbbbbbZZWbbbbbZ
ZZZZZZZZZZZZZZZZ
"""
_WALL_KEY = {"H": "wood.hi", "w": "wood.shade", "W": "wood.base", "b": "wood.shade", "d": "wood.ol", "Z": "wood.ol",
             "S": "stone.base", "s": "stone.shade", "x": "stone.ol", "o": "stone.ol"}


def lib_wall():
    """도서관 벽 앞면(바닥과 맞닿는 줄): 위 나무 몰딩(밝음 + 그늘), 청회 돌 블록 두 줄(엇갈린 줄눈, 블록 윗줄 밝음,
    얼룩 점), 나무 난간대, 판 두 장의 징두리 판벽(판 안쪽은 그늘 → 외곽선으로 한 단계 들어감), 걸레받이.
    바닥(wood.base)보다 어둡게 둬서 방의 둘레가 읽힌다."""
    rows = [ln for ln in _WALL.strip().splitlines()]
    return ["".join(c(_WALL_KEY[ch]) for ch in r) for r in rows]


LIB_WALL = lib_wall()


# ── 벽 윗면: 무너진 천장 쪽 두꺼운 벽(돌 램프 어두운 단계) ───────────────────────────
def lib_wall_top(seed=421):
    """두꺼운 벽 위를 내려다본 면: 짙은 돌 블록(stone.ol 바탕, 블록마다 윗줄·왼줄에 그늘색 빛), 줄눈은 void.
    블록은 8×6으로 줄마다 엇갈린다(16칸 주기라 이어 붙여도 맞음). 칸 안쪽(가장자리에 닿지 않게)에 무너진 천장의
    부러진 들보 조각 하나와 돌 부스러기. 맵의 절반 이상을 덮으므로 바닥보다 확실히 어둡고 무늬 대비는 낮게."""
    ol, sh, void = c("stone.ol"), c("stone.shade"), c("void")
    g = []
    for y in range(T):
        r = (y // 6) if y < 12 else 2
        yy = y - r * 6
        off = 4 if r % 2 else 0
        row = ""
        for x in range(T):
            xx = (x + off) % 8
            if yy == 0 or xx == 0:
                row += void
            elif (yy == 1 or xx == 1) and noise((x + off) // 8, r, seed) < 0.7:
                row += sh if (yy == 1 and xx != 1) else ol
            else:
                row += ol
        g.append(row)
    # 돌 부스러기·금(칸 안쪽 블록에만, 낮은 대비). 들보처럼 큰 무늬는 1500칸 넘게 반복되면 격자로 읽혀서 넣지 않는다
    for x, y in ((3, 3), (13, 9), (10, 14)):
        _set(g, x, y, c("stone.shade"))
    for x, y in ((5, 9), (6, 10)):
        _set(g, x, y, void)
    return g


LIB_WALL_TOP = lib_wall_top()


# ── 책장 ─────────────────────────────────────────────────────────────────────────
# 책: (x, 폭, 키, 램프, 금박 띠 행 또는 None, 기울기). 위 칸 바닥은 6행, 아래 칸 바닥은 13행.
# 책등은 왼쪽 열 기본·오른쪽 열 그늘(폭 1이면 기본), 맨 윗줄은 한 단계 밝게. 기울기 1이면 오른쪽으로 비스듬히 기댄 책.
_TOP_BOOKS = [
    (1, 2, 5, "brick", 2, 0), (3, 1, 4, "cream", None, 0), (4, 2, 5, "cloth_indigo", 1, 0), (6, 1, 3, "leather", None, 0),
    (7, 2, 4, "cloth_green", None, 0), (9, 1, 5, "cream", 2, 0), (10, 2, 4, "brick", None, 0),
    (13, 2, 5, "cloth_indigo", 2, 0),
]
_BOTTOM_BOOKS = [
    (1, 1, 4, "leather", None, 0), (2, 2, 5, "cloth_indigo", 1, 0), (4, 2, 4, "cream", None, 0),
    (6, 2, 5, "brick", 2, 0), (8, 1, 3, "cloth_green", None, 0), (9, 2, 5, "leather", 1, 0),
    (11, 2, 4, "cloth_indigo", None, 0), (13, 2, 5, "brick", 3, 0),
]
_LEAN = (12, 6, 4, "cream")      # 위 칸 빈자리(11~12열)에 기댄 얇은 양피지 책: (아래 x, 바닥 행, 키, 램프)


def _book(p, x, w, h, ramp, band, floor):
    for dx in range(w):
        for k in range(h):
            y = floor - k
            step = "base" if dx == 0 else "shade"
            if k == h - 1:
                step = "hi" if dx == 0 else "base"
            p.put(x + dx, y, f"{ramp}.{step}")
        if band is not None and h > band + 1:
            p.put(x + dx, floor - h + 1 + band, "brass.base" if dx == 0 else "brass.shade")


def _shelf(gap=False):
    p = Px()
    # 틀: 위 몰딩(밝음) + 그 아래 그늘, 왼쪽 기둥(기본, 빛 받음), 오른쪽 기둥(외곽선), 선반 두 장, 맨 아래 걸레받이
    for x in range(T):
        p.put(x, 0, "wood.base")
        p.put(x, 1, "wood.ol")
        p.put(x, 7, "wood.shade")
        p.put(x, 8, "wood.ol")
        p.put(x, 14, "wood.shade")
        p.put(x, 15, "wood.ol")
    for x in range(0, T, 3):
        p.put(x, 0, "wood.hi")
    for y in range(T):
        p.put(0, y, "wood.shade")
        p.put(15, y, "wood.ol")
    p.put(0, 0, "wood.hi")
    # 칸 안쪽 뒤판(어두운 나무)
    for y in list(range(2, 7)) + list(range(9, 14)):
        for x in range(1, 15):
            p.put(x, y, "wood.ol")
    for b in _TOP_BOOKS:
        _book(p, *b[:5], floor=6)
    lx, ly, lh, lr = _LEAN                                       # 기댄 책(대각선 2px 폭)
    for k in range(lh):
        p.put(lx - 1 + k // 2, ly - k, f"{lr}.base")
        p.put(lx + k // 2, ly - k, f"{lr}.shade")
    p.put(lx - 1 + (lh - 1) // 2, ly - lh + 1, f"{lr}.hi")
    for b in _BOTTOM_BOOKS:
        _book(p, *b[:5], floor=13)
    if gap:
        # 아래 칸 가운데 책 네 권(5~10열)이 빠지고 뒤판도 없어 깊은 어둠이 보인다
        for y in range(9, 14):
            for x in range(5, 11):
                p.put(x, y, "void")
        p.put(4, 9, "wood.ol")                                     # 남은 책 사이의 그늘
        for x in range(5, 10):                                     # 쓰러져 누운 책 한 권(빨강, 바닥에)
            p.put(x, 13, "brick.shade")
        p.put(5, 12, "brick.base")
        p.put(6, 12, "brick.base")
        p.put(7, 12, "cream.shade")                                # 누운 책의 페이지 끝
        p.put(9, 10, "teal.base")                                  # 틈으로 새는 찬 바람 한 점
        p.put(10, 13, "cream.shade")                               # 선반에 쌓인 먼지가 쓸린 자리
    return [
        "".join(c(n) if n else "." for n in row) for row in p.g
    ]


BOOKSHELF = _shelf()
SHELF_GAP = _shelf(gap=True)


# ── 물체: 쓰러진 책장 ─────────────────────────────────────────────────────────────
def bookshelf_fallen():
    """뒤판을 위로 하고 비스듬히 누운 책장(왼쪽 아래 → 오른쪽 위), 판자 이음새와 옆판, 앞쪽으로 쏟아진 책 네 권."""
    p = Px()
    body = set()
    for x in range(1, 14):
        top = 9 - (x - 1) * 5 // 12          # 왼쪽 9행 → 오른쪽 4행
        for y in range(top, top + 5):
            body.add((x, y))
    p.mass(body, "wood", shade_below=None)
    for x, y in body:                                       # 뒤판 판자 이음새(가로로 비스듬히)
        top = 9 - (x - 1) * 5 // 12
        if y == top + 2 and p.get(x, y) == "wood.base":
            p.put(x, y, "wood.shade")
    for x in (5, 9):                                        # 칸막이 자리 못줄
        top = 9 - (x - 1) * 5 // 12
        p.put(x, top + 1, "wood.shade")
        p.put(x, top + 3, "wood.shade")
    for x in range(2, 14):                                  # 옆판(아래쪽 두께)
        top = 9 - (x - 1) * 5 // 12
        p.put(x, top + 5, "wood.ol" if x % 4 else "wood.shade")
    # 쏟아진 책(바닥에 흩어짐)
    for x, y, ramp in ((2, 12, "brick"), (6, 13, "cloth_indigo"), (11, 11, "cream"), (13, 13, "leather")):
        p.put(x, y, f"{ramp}.hi")
        p.put(x + 1, y, f"{ramp}.base")
        p.put(x, y + 1, f"{ramp}.base")
        p.put(x + 1, y + 1, f"{ramp}.shade")
    p.put(12, 11, "cream.base")
    p.put(11, 12, "cream.shade")
    g = p.grid()
    g = _shadow(g, 15, 2, 14)
    return _shadow(g, 14, 1, 1)


BOOKSHELF_FALLEN = bookshelf_fallen()


# ── 물체: 책 더미 ───────────────────────────────────────────────────────────────
# (왼쪽 x, 오른쪽 x, 램프) 아래에서 위로. 책 한 권은 2줄: 표지 윗면 + 옆면(페이지 끝이 오른쪽에 보임)
_PILE = [(2, 13, "brick"), (3, 12, "cloth_indigo"), (4, 12, "cream"), (3, 10, "leather"), (5, 11, "cloth_green"),
         (6, 10, "brick")]


def book_pile():
    """크기·색이 다른 책 여섯 권이 조금씩 엇갈려 쌓였다. 권마다 표지 윗면(밝음) + 옆면(그늘), 오른쪽 끝에
    양피지 페이지 끝. 맨 위 책에 금박 띠, 더미 옆에 떨어진 낱장 하나."""
    p = Px()
    y = 13
    for x0, x1, ramp in _PILE:
        for x in range(x0, x1 + 1):
            p.put(x, y - 1, f"{ramp}.hi" if x == x0 else f"{ramp}.base")
            p.put(x, y, f"{ramp}.shade")
        p.put(x1, y, "cream.hi")                            # 페이지 끝
        p.put(x1 - 1, y, "cream.base")
        y -= 2
    p.put(8, y + 1, "brass.base")                            # 맨 위 책의 금박
    p.put(9, y + 1, "brass.shade")
    g = p.grid()
    for x, y2, col in ((13, 7, "cream.hi"), (14, 7, "cream.base"), (13, 8, "cream.base")):   # 떨어진 낱장(외곽선 없음)
        _put(g, x, y2, c(col))
    return _shadow(g, 15, 2, 14)


BOOK_PILE = book_pile()


# ── 물체: 열람 책상 ─────────────────────────────────────────────────────────────
def reading_desk():
    """나무 책상(3/4 시점: 상판 윗면 밝음, 앞판 그늘, 다리 두 개), 위에 펼쳐진 양피지 책(남색 잉크 글줄),
    오른쪽에 불꽃이 청록 서리에 갇혀 멈춘 작은 초."""
    p = Px()
    top = {(x, y) for x in range(1, 15) for y in range(7, 10)}
    p.mass(top, "wood")
    for x in range(1, 15):                                   # 앞판
        p.put(x, 10, "wood.shade")
        p.put(x, 11, "wood.shade" if x in (1, 2, 13, 14) else "wood.ol")
    for y in (12, 13):                                       # 다리
        for x in (1, 13):
            p.put(x, y, "wood.base")
            p.put(x + 1, y, "wood.shade")
    p.put(7, 10, "brass.base")                               # 서랍 손잡이
    # 펼쳐진 책: 양피지 두 쪽, 가운데 접힘 그늘, 글줄
    for x in range(3, 10):
        for y in (6, 7, 8):
            p.put(x, y, "cream.hi" if x < 6 else "cream.base")
    for x in range(3, 10):
        p.put(x, 9, "brick.shade")                           # 책 표지 가장자리
    p.put(6, 6, "cream.shade")
    p.put(6, 7, "cream.shade")
    p.put(6, 8, "cream.shade")
    for x, y in ((4, 7), (5, 7), (7, 7), (8, 7), (4, 8), (7, 8)):
        p.put(x, y, "cloth_indigo.base")
    # 초(크림 촛농) + 서리에 갇힌 불꽃
    p.put(12, 6, "cream.hi")
    p.put(12, 7, "cream.base")
    p.put(11, 7, "brass.base")
    p.put(13, 7, "brass.shade")
    p.put(12, 5, "teal.base")
    p.put(12, 4, "teal.hi")
    p.put(12, 3, "teal.base")
    p.put(11, 4, "teal.shade")
    p.put(13, 4, "teal.shade")
    g = p.grid()
    _put(g, 12, 4, c("lamp.hi"))                             # 서리 속 멈춘 불씨
    return _shadow(g, 14, 1, 14)


READING_DESK = reading_desk()


# ── 물체: 얼어붙은 촛대 ─────────────────────────────────────────────────────────
def _flame(p, x, y):
    """청록 서리에 갇힌 불꽃(위로 3px): 서리 껍질 teal, 속에 멈춘 불씨 lamp."""
    p.put(x, y - 3, "teal.hi")
    p.put(x - 1, y - 2, "teal.base")
    p.put(x, y - 2, "lamp.hi")
    p.put(x + 1, y - 2, "teal.shade")
    p.put(x - 1, y - 1, "teal.base")
    p.put(x, y - 1, "lamp.base")
    p.put(x + 1, y - 1, "teal.shade")


def candle_frozen():
    """황동 세 가지 촛대(가운데 초가 가장 높음)에 크림 초 세 자루. 불꽃은 일렁이던 모양 그대로 청록 서리에 갇혀
    멈췄다(애니메이션 없음). 받침은 둥근 황동 발, 발치 그림자."""
    p = Px()
    for x, y0, h in ((3, 6, 3), (8, 4, 4), (12, 6, 3)):            # 초
        for k in range(h):
            p.put(x, y0 + k, "cream.hi" if k == 0 else "cream.base")
        p.put(x, y0 + 1, "cream.spec")
        _flame(p, x, y0)
    # 황동 팔: 양쪽 컵(초 밑) → 가운데 기둥으로
    for x in (2, 3, 4, 11, 12, 13):
        p.put(x, 9, "brass.hi" if x in (2, 11) else "brass.base")
    for x in range(4, 12):
        p.put(x, 10, "brass.base")
    p.put(4, 10, "brass.shade")
    p.put(11, 10, "brass.shade")
    for x in (7, 8, 9):
        p.put(x, 8, "brass.base")
    for y in range(11, 13):                                         # 기둥
        p.put(8, y, "brass.base")
        p.put(9, y, "brass.shade")
    for x in range(6, 12):                                          # 받침
        p.put(x, 13, "brass.base" if x < 9 else "brass.shade")
    p.put(6, 13, "brass.hi")
    g = p.grid()
    return _shadow(g, 14, 5, 12)


CANDLE_FROZEN = candle_frozen()


# ── 물체: 부러진 기둥 ───────────────────────────────────────────────────────────
def broken_pillar():
    """홈 파인 청회 돌기둥이 비스듬히 부러졌다: 받침돌(넓음) 위 기둥 몸, 세로 홈(그늘 줄), 부러진 단면은 밝음,
    옆에 떨어진 돌 조각."""
    p = Px()
    shaft = set()
    tops = {4: 5, 5: 3, 6: 4, 7: 1, 8: 2, 9: 4}                     # 들쭉날쭉 부러진 윗면(묘비처럼 둥글지 않게)
    for x, top in tops.items():
        for y in range(top, 12):
            shaft.add((x, y))
    p.mass(shaft, "stone")
    for x in (5, 7):                                                # 세로 홈 두 줄
        for y in range(tops[x] + 1, 11):
            if p.get(x, y) == "stone.base":
                p.put(x, y, "stone.shade")
    for x, top in tops.items():                                     # 부러진 단면(밝음)
        p.put(x, top, "stone.hi")
    p.put(7, 1, "stone.spec")
    for x in range(4, 10):                                          # 아래 고리 띠(기둥으로 읽히게)
        p.put(x, 10, "stone.hi" if x < 7 else "stone.base")
        p.put(x, 11, "stone.shade")
    base = {(x, y) for x in range(2, 12) for y in (12, 13)}          # 넓은 받침돌
    p.mass(base, "stone", shade_below=13)
    cap = {(x, y) for x in range(11, 15) for y in (9, 10, 11)} - {(14, 9)}   # 떨어진 기둥머리 조각
    p.mass(cap, "stone")
    p.put(12, 10, "stone.shade")
    p.put(4, 8, "moss.base")                                        # 틈에 낀 이끼 한 점
    g = p.grid()
    return _shadow(g, 15, 2, 13)


BROKEN_PILLAR = broken_pillar()


# ── 바닥: 떠 있는 낱장 ─────────────────────────────────────────────────────────
# 낱장(왼쪽 위 x, y, 모양): 바닥 가까이 모여 떠 있다. 아래 3px에 그림자(마루 그늘)
# 글줄은 가로 2~3px로 그린다(1px 점은 낱장이 얼굴처럼 읽힌다). 위쪽(빈 책장 칸 쪽)으로 갈수록 작고 높이 떠 있다
_PAGES = [
    (2, 4, ("HHHHb", "HlllH", "HHHHb", "HllHb", ".bbbb")),
    (10, 1, (".HH", "HHb", "Hb.")),
    (8, 9, ("HHHHb", "HllHH", ".bbbb")),
    (13, 11, ("HH", "bH")),
]


def floating_pages():
    """마루 위에 멈춘 채 떠 있는 양피지 낱장 넷(글줄은 남색 잉크), 낱장마다 3px 아래 마루에 그림자 줄,
    한 장 모서리에 청록 서리 한 점. 외곽선 없이 밝은 종이와 그림자 사이 틈으로 '떠 있음'을 읽게 한다."""
    g = list(LIB_FLOOR)
    leg = {"H": "cream.hi", "b": "cream.shade", "l": "cloth_indigo.shade"}
    for x, y, shape in _PAGES:
        w = max(len(r) for r in shape)
        for dx in range(w - 1):                                     # 그림자(1px 오른쪽, 3px 아래)
            _set(g, x + 1 + dx, y + len(shape) + 2, c(f"{FLOOR}.shade"))
    for x, y, shape in _PAGES:
        for j, r in enumerate(shape):
            for i, ch in enumerate(r):
                if ch != ".":
                    _set(g, x + i, y + j, c(leg[ch]))
    _set(g, 12, 1, c("teal.hi"))
    return g


FLOATING_PAGES = floating_pages()


LIBRARY_TILES = {
    "lib_floor": LIB_FLOOR,
    "lib_carpet": LIB_CARPET,
    "lib_wall": LIB_WALL,
    "lib_wall_top": LIB_WALL_TOP,
    "bookshelf": BOOKSHELF,
    "bookshelf_fallen": BOOKSHELF_FALLEN,
    "book_pile": BOOK_PILE,
    "reading_desk": READING_DESK,
    "candle_frozen": CANDLE_FROZEN,
    "broken_pillar": BROKEN_PILLAR,
    "floating_pages": FLOATING_PAGES,
    "shelf_gap": SHELF_GAP,
}

# 미리보기에서 투명 물체 타일 밑에 깔 바닥(게임에서는 맵의 ground 레이어가 깔린다)
DECO_UNDER = {n: "lib_floor" for n in ("bookshelf_fallen", "book_pile", "reading_desk", "candle_frozen",
                                       "broken_pillar")}
