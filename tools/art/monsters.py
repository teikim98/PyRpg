"""몬스터·오브젝트(16×16)와 그 그리기 도구.

지역 1 몬스터 6종(그래픽 개편, docs/art-overhaul/style-guide.md §3·§6.2)
- 16×16 프레임 4개 제자리 루프. 코지 팔레트(cozypal)의 이름 있는 색만 쓰고, 바깥 외곽선은
  cozypal.auto_outline()이 닿은 재질의 외곽선 색으로 두른다. 빛은 왼쪽 위(밝음 1px), 오른쪽 아래(그늘 1px).
- 통통 튀는 몸(슬라임·두더지): [기본, 눌림(폭 +2·높이 −1), 기본, 늘어남(폭 −2·높이 +1)], 바닥 줄 고정.
- 나는 몸(박쥐·유령·요정): 몸 전체가 0 → −1 → −2 → −1px, 날개는 1·3번 프레임에서 위로 접힌다.
- 눈은 몸과 함께 움직일 때만 같이 옮기고, 4프레임 내내 같은 모양이다.
- 그리기 도구(Px, ellipse)는 보스(boss.py)도 쓴다.

오브젝트(obj_*)는 아직 옛 공용 팔레트(gridlib)로 그린 2프레임이다(그래픽 개편 확장 단계에서 옮긴다).
"""
import math

from cozypal import auto_outline, c, noise
from gridlib import grid, outline, overlay

FLY = (0, -1, -2, -1)        # 나는 몸의 프레임별 높이(style-guide §6.2)
STEP_UP = ("ol", "shade", "base", "hi", "spec")


# ── 그리기 도구: 색 이름으로 칠하는 판 ───────────────────────────────────────────────
class Px:
    """색 이름("moss.base")으로 픽셀을 찍는 판. grid()가 팔레트 문자 그리드로 바꾸고 외곽선을 두른다."""

    def __init__(self, w=16, h=16):
        self.w, self.h = w, h
        self.g = [[None] * w for _ in range(h)]

    def put(self, x, y, name):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.g[y][x] = name

    def get(self, x, y):
        return self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else None

    def rows(self, text, legend, ox=0, oy=0):
        """범례 문자 그리드를 (ox, oy)에 찍는다. '.'은 건너뛴다."""
        lines = [ln.strip() for ln in text.strip("\n").splitlines() if ln.strip()]
        for j, ln in enumerate(lines):
            for i, ch in enumerate(ln):
                if ch != ".":
                    if ch not in legend:
                        raise ValueError(f"{ch!r} not in legend: {ln!r}")
                    self.put(ox + i, oy + j, legend[ch])
        return self

    def mass(self, cells, ramp, shade_below=None, lift=0):
        """덩어리 칠하기(style-guide §3.2): 왼쪽 위로 트인 칸 = 밝음, 오른쪽 아래로 트인 칸 = 그늘, 안쪽 = 기본.

        shade_below: 이 행부터 아래 안쪽도 그늘(땅에 닿는 쪽). lift=1이면 한 단계씩 밝게(그늘→기본→밝음→강조).
        """
        cells = set(cells)
        for x, y in cells:
            light = (x - 1, y - 1) not in cells or (x, y - 1) not in cells
            dark = (x + 1, y + 1) not in cells or (x, y + 1) not in cells
            if dark and not light:
                k = 1
            elif light and not dark:
                k = 3
            elif light and dark:
                k = 3 if (x - 1, y) not in cells or (x, y - 1) not in cells else 1
            else:
                k = 2
            if shade_below is not None and y >= shade_below and k == 2:
                k = 1
            self.put(x, y, f"{ramp}.{STEP_UP[min(4, k + lift)]}")
        return self

    def grid(self, skip=()):
        g = ["".join(c(n) if n else "." for n in row) for row in self.g]
        return auto_outline(g, skip={c(s) for s in skip})


def ellipse(cx, cy, rx, ry, size=16):
    """타원 안의 칸 집합. 픽셀 (x, y)의 가운데는 (x + 0.5, y + 0.5)."""
    return {(x, y) for y in range(size) for x in range(size)
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0}


# ── 타입 슬라임: 'str' 꼬리표를 단 말랑한 젤리. 기본 → 눌림 → 기본 → 늘어남 ─────────────
SLIME_RAMP = "moss"


def _slime(w, h):
    p = Px()
    cx, top = 8.0, 15 - h
    a = w / 2
    body = set()
    for y in range(top, 15):
        t = (y - top + 0.5) / h
        k = min(1.0, t / 0.62)
        hw = a * math.sqrt(max(0.0, 1 - (1 - k) ** 2))
        if y == 14:
            hw -= 0.6
        for x in range(16):
            if abs(x + 0.5 - cx) <= hw:
                body.add((x, y))
    p.mass(body, SLIME_RAMP, shade_below=13, lift=1)
    # 젤리 광택: 왼쪽 위에 흰 점 1px + 강조 2px(풀 위에서도 말랑한 젤리로 읽히게 이끼빛 램프를 한 단계 밝혀 칠함)
    lx = min(x for x, y in body if y == top + 2) + 1
    p.put(lx, top + 2, "white")
    p.put(lx, top + 3, f"{SLIME_RAMP}.spec")
    p.put(lx + 1, top + 1, f"{SLIME_RAMP}.spec")
    # 얼굴: 점 눈 1×2, 볼터치, 작은 입
    ey = top + (h * 45) // 100 + 1
    for ex in (5, 10):
        p.put(ex, ey, "eye")
        p.put(ex, ey + 1, "eye")
    p.put(4, ey + 2, "blush")
    p.put(11, ey + 2, "blush")
    p.put(7, ey + 2, f"{SLIME_RAMP}.ol")
    p.put(8, ey + 2, f"{SLIME_RAMP}.ol")
    # 'str' 꼬리표: 정수리에서 끈이 오른쪽 위로, 구멍 뚫린 크림색 짐표에 글자 줄
    p.put(10, top - 1, "wood.base")
    p.put(11, top - 2, "wood.base")
    tag = """
    .WWWW
    WcWWW
    .wwww
    """
    p.rows(tag, {"W": "cream.spec", "w": "cream.hi", "c": "cream.shade"}, 11, top - 4)
    for x in (13, 14):
        p.put(x, top - 3, "teal.base")      # 글자 줄(청록 잉크)
    return p.grid()


# ── 나머지 박쥐: 나눗셈의 '나머지' 금화 한 닢을 움켜쥔 보라 박쥐 ───────────────────────
_BAT_LEGEND = {"P": "cloth_purple.base", "p": "cloth_purple.shade", "Q": "cloth_purple.hi",
               "S": "cloth_purple.spec", "e": "lamp.hi", "w": "white",
               "U": "brass.base", "u": "brass.shade", "Y": "brass.hi", "!": "brass.spec"}
_BAT_BODY = """
.....Q....p.....
.....QP..Pp.....
.....QPPPPp.....
.....PePPep.....
.....PPwwPp.....
.....pSQQQp.....
.....pQQQpp.....
......pppp......
.......UU.......
......UY!u......
......UUuu......
.......uu.......
"""
_BAT_WINGS = {
    "spread": """
................
.Q............p.
QQP..........PPp
QPPPP......PPPpp
.QppP......PppP.
.Qp.p......p.pp.
.p...........p..
""",
    "up": """
.Q............p.
.QP..........Pp.
.QPP........PPp.
..QPP......PPp..
...PP......Pp...
................
................
""",
    "down": """
................
................
...QP......PPp..
.QPPP......PPPp.
QPppP......PppPp
Qp.p........p.pp
p..............p
""",
}


def _bat(pose, dy):
    p = Px()
    wing_y = {"spread": 3, "up": 1, "down": 4}[pose]
    p.rows(_BAT_WINGS[pose], _BAT_LEGEND, 0, wing_y + dy)
    p.rows(_BAT_BODY, _BAT_LEGEND, 0, 3 + dy)
    return p.grid()


# ── 철갑 두더지: 리벳 박힌 철 투구를 쓰고 흙더미에서 솟아오른다 ─────────────────────
_MOLE_LEGEND = {"H": "stone.hi", "h": "stone.base", "g": "stone.shade", "r": "stone.spec", "S": "stone.spec",
                "M": "hair_brown.hi", "m": "hair_brown.base", "n": "hair_brown.shade", "z": "sand.hi",
                "e": "eye", "i": "flower.base", "I": "flower.hi", "b": "blush",
                "p": "skin.hi", "s": "skin.base", "k": "skin.shade", "W": "cream.spec"}
# 투구: 가운데 솟은 이음띠(밝음) + 챙의 리벳 4개. 얼굴: 실눈, 볼터치, 큼직한 분홍 코와 모래빛 주둥이
_MOLE = """
......SHHhh.....
....HHhHhhhhg...
...HhhhHhhhhhg..
..grggrgggrggrg.
....Mmmmmmmmmn..
....Memmmmmmen..
....MbmzIIzmbn..
....mmmzIizmmn..
....mmmmzzmmmn..
"""
# 땅 파는 앞발(솟아오를 때만 양옆으로 번쩍): 분홍 발바닥 + 흰 발톱 2개
_MOLE_PAWS = """
W.W..........W.W
psk..........psk
.sk...........sk
"""


def _mound():
    """흙더미(바닥 줄 고정): 먼지빛 분홍 흙, 위 가장자리 밝음, 질감 점과 조약돌."""
    p = Px()
    rows = {11: (3, 13), 12: (1, 14), 13: (0, 15), 14: (0, 15)}
    cells = {(x, y) for y, (x0, x1) in rows.items() for x in range(x0, x1 + 1)}
    p.mass(cells, "soil", shade_below=14)
    for x, y in sorted(cells):
        if p.get(x, y) == "soil.base" and noise(x, y, 7) < 0.12:
            p.put(x, y, "soil.shade")
    for x, y in ((4, 13), (11, 12)):
        p.put(x, y, "stone.hi")
        p.put(x + 1, y, "stone.base")
    return p


def _mole(dy, paws_up):
    p = Px()
    p.rows(_MOLE, _MOLE_LEGEND, 0, 3 + dy)
    m = _mound()
    for y in range(16):
        for x in range(16):
            if m.get(x, y):
                p.put(x, y, m.get(x, y))
    if paws_up:
        p.rows(_MOLE_PAWS, _MOLE_LEGEND, 0, 6)
    return p.grid()


# ── 메아리 유령: 하늘빛 유령이 동그란 입으로 외치면 메아리 고리가 퍼져 나간다 ──────────
_RINGS = ("teal.spec", "teal.hi", "teal.base", "teal.shade")
# 물방울 모양 몸(머리는 둥글고 아래로 좁아져 꼬리가 된다). 행마다 (x0, x1)
_GHOST_ROWS = [(3, 6), (1, 8), (0, 9), (0, 9), (0, 9), (0, 9), (0, 9), (1, 9), (1, 8)]
# 꼬리 끝 세 줄: 프레임마다 가운데 → 오른쪽 → 가운데 → 왼쪽으로 흔들린다
_GHOST_TAIL = (((2, 7), (3, 6), (4, 5)), ((2, 7), (4, 8), (7, 9)), ((2, 7), (3, 6), (4, 5)), ((2, 7), (1, 4), (0, 1)))


def _ghost(dy, phase):
    """메아리 유령(P0104 메아리 주문 = 문자열 곱셈): 외친 소리가 ')) '로 거듭 퍼진다."""
    p = Px()
    ox, oy = 1, 3 + dy
    body = set()
    for j, (x0, x1) in enumerate(_GHOST_ROWS):
        body |= {(ox + x, oy + j) for x in range(x0, x1 + 1)}
    for j, (x0, x1) in enumerate(_GHOST_TAIL[phase]):
        body |= {(ox + x, oy + len(_GHOST_ROWS) + j) for x in range(x0, x1 + 1)}
    p.mass(body, "sky", lift=1)
    p.put(ox + 2, oy + 1, "white")
    p.put(ox + 1, oy + 2, "white")
    for ex in (3, 6):
        p.put(ox + ex, oy + 4, "eye")
        p.put(ox + ex, oy + 5, "eye")
    p.put(ox + 2, oy + 6, "blush")
    p.put(ox + 7, oy + 6, "blush")
    # 동그랗게 벌린 입
    for x, y in ((4, 6), (5, 6), (4, 7), (5, 7)):
        p.put(ox + x, oy + y, "sky.ol")
    # 메아리 고리 '))' 두 겹: 프레임마다 바깥으로 1px, 바깥 고리일수록 옅다. 가장자리에선 납작해진다
    my = oy + 6
    for k, rx in enumerate((13 + phase % 2, 15 + phase % 2)):
        col = _RINGS[k * 2 + phase % 2]
        for x, y in ((rx - 1, my - 2), (rx, my - 1), (rx, my), (rx, my + 1), (rx - 1, my + 2)):
            p.put(min(x, 15), y, col)
    return p.grid(skip=_RINGS)


# ── 칸막이 요정: '-' 칸막이 막대를 두 손으로 받쳐 든 작은 요정. 날개 파닥임 ──────────────
_SEP_LEGEND = {"A": "lamp.hi", "a": "lamp.base", "q": "lamp.shade",
               "s": "skin.base", "S": "skin.hi", "z": "skin.shade", "e": "eye", "b": "blush",
               "D": "flower.base", "F": "flower.hi", "d": "flower.shade",
               "W": "cream.spec", "w": "cream.hi", "c": "cream.shade",
               "V": "sky.spec", "v": "sky.hi"}
_SEP_BODY = """
.......Aa.......
.....AAAaaq.....
....AAaaaaaq....
....AsssssSq....
....aesssseq....
....bsSsssSb....
.....zssssz.....
.....FDDDDd.....
..sWWWWWWWWWWs..
..cccccccccccc..
.....FDDDDd.....
....FDDDDDDd....
......s..z......
......d..d......
"""
_SEP_WINGS = {
    "spread": """
VV..........VV
vVV........VVv
vVV........VVv
.vv........vv.
""",
    "up": """
.V..........V.
.VV........VV.
.vV........Vv.
..v........v..
""",
}


def _sep(dy, pose):
    p = Px()
    wy = {"spread": 4, "up": 2}[pose]
    p.rows(_SEP_WINGS[pose], _SEP_LEGEND, 1, wy + dy)
    p.rows(_SEP_BODY, _SEP_LEGEND, 0, 1 + dy)
    return p.grid()


# ── 시계 딱정벌레: 등껍질이 시계 문자판. 분침이 한 프레임에 한 칸씩 돌고 다리가 번갈아 움직인다 ──
_BEETLE_HEAD = """
....i.....i.....
.....i...i......
......HHh.......
.....HeheI......
.....hhhhI......
"""
_BEETLE_LEGEND = {"H": "hair_ink.hi", "h": "hair_ink.base", "I": "hair_ink.shade", "i": "hair_ink.base",
                  "e": "lamp.hi"}
# 다리(가죽빛 갈색, 2px) 왼쪽 칸 좌표: 두 벌이 번갈아 앞뒤로
_LEGS = {
    0: ((1, 6), (0, 9), (1, 12), (13, 7), (14, 10), (13, 13)),
    1: ((1, 7), (0, 10), (1, 13), (13, 6), (14, 9), (13, 12)),
}
# 분침(가운데 (7, 9)에서 2px): 12시 → 3시 → 6시 → 9시
_MINUTE = (((7, 8), (7, 7)), ((8, 9), (9, 9)), ((7, 10), (7, 11)), ((6, 9), (5, 9)))


def _beetle(frame):
    p = Px()
    p.rows(_BEETLE_HEAD, _BEETLE_LEGEND, 0, 0)
    for x, y in _LEGS[frame % 2]:
        inner = 1 if x < 7 else 0          # 몸 쪽 칸은 기본, 바깥 칸은 그늘
        p.put(x + inner, y, "leather.base")
        p.put(x + 1 - inner, y, "leather.shade")
    rim = ellipse(7.5, 9.5, 5.6, 5.1)
    face = ellipse(7.5, 9.5, 4.1, 3.7)
    p.mass(rim - face, "brass")
    for x, y in face:
        edge = (x + 1, y + 1) not in face or (x + 1, y) not in face or (x, y + 1) not in face
        p.put(x, y, "cream.hi" if edge else "cream.spec")
    for x, y in ((7, 6), (10, 9), (7, 12), (4, 9)):      # 눈금 12·3·6·9
        p.put(x, y, "cream.shade")
    p.put(8, 8, "cloth_red.base")                         # 짧은 시침(1시 반쯤, 고정)
    for x, y in _MINUTE[frame]:
        p.put(x, y, "ink")
    p.put(7, 9, "brass.shade")                            # 가운데 축
    return p.grid()


# ── 오브젝트 ──────────────────────────────────────────────────────────────────
_CHEST_CLOSED = grid("""
    ................
    ................
    ................
    ................
    ..BBBBBBBBBBBB..
    .BnnnnnnnnnnnnB.
    .BnUnnnnnnnnUnB.
    .BBUBBBBBBBBUBB.
    .UUUUUUYYUUUUUU.
    .BnUnnnUunnnUnB.
    .BnUnnnUunnnUnB.
    .BnUnnnnnnnnUnB.
    .BbUbbbbbbbbUbB.
    .BBBBBBBBBBBBBB.
    ................
    ................
""", 16, 16)

_CHEST_OPEN = grid("""
    ................
    ..BBBBBBBBBBBB..
    .BbbbbbbbbbbbbB.
    .BbUbbbbbbbbUbB.
    .BnUnnnnnnnnUnB.
    .BbbbbbbbbbbbbB.
    .BkkYkYYkkYkkkB.
    .BYUYYUYYUYYUYB.
    .UUUUUUUUUUUUUU.
    .BnUnnnnnnnnUnB.
    .BnUnnnnnnnnUnB.
    .BnUnnnnnnnnUnB.
    .BbUbbbbbbbbUbB.
    .BBBBBBBBBBBBBB.
    ................
    ................
""", 16, 16)

_SIGN = grid("""
    ................
    ................
    ................
    .nnnnnnnnnnnnnn.
    .nNNNNNNNNNNNNn.
    .nNbbbNbbNbbNBn.
    .nNNNNNNNNNNNBn.
    .nNbbNbbbbNNNBn.
    .nNNNNNNNNNNNBn.
    .nBBBBBBBBBBBBn.
    .nnnnnnBBnnnnnn.
    ......nBBn......
    ......nBBn......
    ......nBBn......
    .....eenBnee....
    ................
""", 16, 16)

_SIGN_B = _SIGN

_FIRE_A = grid("""
    ................
    ................
    ................
    .......x........
    ......xx...x....
    ......xRx..x....
    .....xRRxxxR....
    ....xRRyRxRRx...
    ....xRyYyRRyx...
    ....xRyYYyRyx...
    .....xRYYYyx....
    ...BnnRyyRnnBB..
    ..BnnbBnnBbnnB..
    ..BBnnbBBbnnBB..
    ...GGGGGGGGGG...
    ................
""", 16, 16)

_FIRE_B = grid("""
    ................
    ................
    ................
    .........x......
    ....x...xx......
    ....xx..xRx.....
    ....xRxxRRx.....
    ...xRRxRRyRx....
    ...xyRRyYyRx....
    ....xRyYYyRx....
    .....xyYYyx.....
    ...BnnRyyRnnBB..
    ..BnnbBnnBbnnB..
    ..BBnnbBBbnnBB..
    ...GGGGGGGGGG...
    ................
""", 16, 16)

# 비석: 서펜트 룬(뱀 모양 S)이 청록으로 빛난다. 프레임 B는 더 밝고 반짝임이 떠오른다.
_RUNE_A = grid("""
    ................
    ................
    ......GGGG......
    .....GHHHHG.....
    ....GHHHHHgG....
    ....GHTTTHgG....
    ....GHTHHHgG....
    ....GHTTTHgG....
    ....GHHHTHgG....
    ....GHTTTHgG....
    ....GHHHHHgG....
    ....GHHHHggG....
    ...gGGGGGGGGg...
    ..egggggggggge..
    ................
    ................
""", 16, 16)

_RUNE_B = grid("""
    ................
    ................
    ......GGGG......
    .....GHHHHG.....
    ....GHcccHgG....
    ....GHcTTcgG....
    ....GHcHHHgG....
    ....GHccccgG....
    ....GHHHHcgG....
    ....GHcccTgG....
    ....GHHHHHgG....
    ....GHHHHggG....
    ...gGGGGGGGGg...
    ..egggggggggge..
    ................
    ................
""", 16, 16)

# 문: 돌 문틀의 나무 문. [닫힘, 열림] — 열리면 가운데가 비어 뒤의 바닥이 보인다.
_DOOR_CLOSED = grid("""
    ....GGGGGGGG....
    ..GGHHHHHHHHGG..
    .GHHGGGGGGGGHHg.
    .GHGbBBBBBBbGHg.
    .GHbBnBBnBBBbHg.
    .GHbBnBBnBBBbHg.
    .GHbBnBBnBBBbHg.
    .GHbBnBBnBBBbHg.
    .GHbBnBBnBUYbHg.
    .GHbBnBBnBUubHg.
    .GHbBnBBnBBBbHg.
    .GHbBnBBnBBBbHg.
    .GHbBnBBnBBBbHg.
    .GHbBnBBnBBBbHg.
    .GHbbbbbbbbbbHg.
    .ggg........ggg.
""", 16, 16)

_DOOR_OPEN = grid("""
    ....GGGGGGGG....
    ..GGHHHHHHHHGG..
    .GHHGGGGGGGGHHg.
    .GHGb.......GHg.
    .GHbn.......bHg.
    .GHbn........Hg.
    .GHbn........Hg.
    .GHbn........Hg.
    .GHbU........Hg.
    .GHbn........Hg.
    .GHbn........Hg.
    .GHbn........Hg.
    .GHbn........Hg.
    .GHbn........Hg.
    .GHbb........Hg.
    .ggg........ggg.
""", 16, 16)


def _o(g, extra=None):
    """외곽선을 두르고, extra(외곽선 없이 덧그릴 빛·고리 등)를 위에 얹는다."""
    g = outline(g)
    return overlay(g, extra) if extra else g


_RUNE_GLINT = grid("""
    ................
    .c..............
    .............c..
    ................
    ................
    ..c.............
    ................
    .............c..
    ................
    ...c............
    ................
    ................
    ................
    ................
    ................
    ................
""", 16, 16)



MONSTERS = {
    # 통통 튀는 몸: 기본(폭 12·높이 9) → 눌림(14·8) → 기본 → 늘어남(10·10)
    "monster_type_slime": [_slime(12, 9), _slime(14, 8), _slime(12, 9), _slime(10, 10)],
    "monster_remainder_bat": [_bat(pose, dy) for pose, dy in zip(("spread", "up", "down", "up"), FLY)],
    # 흙더미는 고정, 몸만 기본 → 움츠림(1px 아래) → 기본 → 솟음(1px 위, 발톱 번쩍)
    "monster_iron_mole": [_mole(0, False), _mole(1, False), _mole(0, False), _mole(-1, True)],
    "monster_echo_ghost": [_ghost(dy, i) for i, dy in enumerate(FLY)],
    "monster_sep_sprite": [_sep(dy, pose) for pose, dy in zip(("spread", "up", "spread", "up"), FLY)],
    "monster_clock_beetle": [_beetle(i) for i in range(4)],
}

OBJECTS = {
    "obj_chest": [_o(_CHEST_CLOSED), _o(_CHEST_OPEN)],
    "obj_sign": [_o(_SIGN), _o(_SIGN_B)],
    "obj_campfire": [_o(_FIRE_A), _o(_FIRE_B)],
    "obj_rune": [_o(_RUNE_A), _o(_RUNE_B, _RUNE_GLINT)],
    "obj_door": [_o(_DOOR_CLOSED), _o(_DOOR_OPEN)],
}
