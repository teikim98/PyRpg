"""누리 초상화(48×48, 표정 5종) — 모에 애니메이션풍.

몸통·머리카락·고글·망토는 도형(타원·다각형·굵은 선)으로 한 번 그려 모든 표정이 공유하고,
표정마다 눈썹·눈·입·홍조·효과(땀방울, 반짝임, 놀람 선)만 바꿔 얹는다(design.md §3 공통).

누리: 주황 포니테일(청록 리본), 정수리의 바보털(아호게), 얼굴을 감싸는 옆머리, 이마에 올린 황동 고글,
옆머리의 나침반 장미 머리핀, 짧은 올리브 망토(황동 걸쇠), 왼쪽 어깨 뒤의 지도통,
가슴을 가로지르는 지도통 끈과 거기 매달린 나침반. 눈은 올리브빛 초록(위는 짙고 아래로 밝아지는 홍채).
머리가 크고 몸이 작은 비율, 둥근 볼과 작은 턱, 큰 눈과 작은 입으로 귀엽게 그린다.
"""
import math

from gridlib import grid, outline

N = 48


class Pix:
    def __init__(self):
        self.g = [["."] * N for _ in range(N)]

    def put(self, x, y, ch):
        if 0 <= x < N and 0 <= y < N:
            self.g[y][x] = ch

    def get(self, x, y):
        if 0 <= x < N and 0 <= y < N:
            return self.g[y][x]
        return "."

    def ellipse(self, cx, cy, rx, ry, ch):
        for y in range(N):
            for x in range(N):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0:
                    self.put(x, y, ch)

    def poly(self, pts, ch):
        n = len(pts)
        for y in range(N):
            py = y + 0.5
            for x in range(N):
                px = x + 0.5
                inside = False
                for i in range(n):
                    x1, y1 = pts[i]
                    x2, y2 = pts[(i + 1) % n]
                    if (y1 > py) != (y2 > py):
                        xi = x1 + (py - y1) * (x2 - x1) / (y2 - y1)
                        if px < xi:
                            inside = not inside
                if inside:
                    self.put(x, y, ch)

    def thick_line(self, x0, y0, x1, y1, w, ch):
        """두께 w의 선분(점과 선분 사이 거리로 판정)."""
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy
        for y in range(N):
            for x in range(N):
                px, py = x + 0.5, y + 0.5
                t = max(0.0, min(1.0, ((px - x0) * dx + (py - y0) * dy) / L2))
                qx, qy = x0 + t * dx, y0 + t * dy
                if math.hypot(px - qx, py - qy) <= w / 2:
                    self.put(x, y, ch)

    def mask(self, chars):
        return {(x, y) for y in range(N) for x in range(N) if self.g[y][x] in chars}

    def edge(self, region, against, ch, dirs=((1, 0), (-1, 0), (0, 1), (0, -1))):
        """region 안의 픽셀 중 against 픽셀에 닿은 것을 ch로 칠한다."""
        hits = [(x, y) for (x, y) in region if any((x + dx, y + dy) in against for dx, dy in dirs)]
        for x, y in hits:
            self.put(x, y, ch)

    def stamp(self, g, x, y):
        for j, row in enumerate(g):
            for i, ch in enumerate(row):
                if ch != ".":
                    self.put(x + i, y + j, ch)

    def rows(self):
        return ["".join(r) for r in self.g]


# 얼굴 윤곽: 넓고 둥근 볼, 작고 둥근 턱(모에 비율). 가운데 축은 x=24.0(픽셀 23|24 사이).
FACE_CX = 24.0


def _face_halfwidth(y):
    yc = y + 0.5
    if yc < 12 or yc > 37:
        return -1
    if yc < 24:
        return 11.8 * math.sqrt(max(0.0, 1 - ((yc - 24) / 13) ** 2))
    if yc <= 28:
        return 11.8 - (yc - 24) * 0.12
    # 볼 아래에서 턱까지 둥글게 좁아진다
    w28 = 11.8 - 4 * 0.12
    t = (yc - 28) / 9.0
    return w28 * math.sqrt(max(0.0, 1 - t ** 2.2)) * (1 - 0.35 * t)


def _base():
    p = Pix()
    # 1) 지도통(왼쪽 어깨 뒤로 비스듬히)
    p.thick_line(5.4, 49, 8.6, 34.5, 4.0, "B")
    p.thick_line(4.2, 49, 7.4, 34.5, 1.2, "n")
    p.thick_line(7.0, 49, 10.0, 35.0, 1.0, "b")
    p.thick_line(8.2, 35.0, 8.8, 32.5, 4.6, "U")
    p.thick_line(7.2, 33.6, 7.6, 32.6, 1.0, "Y")
    tube = p.mask("nNBbUY")
    for x, y in tube:  # 지도통 가운데의 황동 띠
        if y == 40:
            p.put(x, y, "U")
        elif y == 41:
            p.put(x, y, "u")

    # 2) 포니테일(머리 뒤 오른쪽 위에서 흘러내림, 끝은 안쪽으로 말림)
    chain = [(39.4, 6.5, 2.4), (42.0, 8.6, 2.9), (43.8, 12.0, 3.1), (44.6, 16.0, 3.0),
             (44.6, 20.0, 2.7), (44.0, 23.6, 2.3), (43.0, 26.6, 1.8), (41.8, 28.8, 1.3), (40.6, 30.2, 0.8)]
    for cx, cy, r in chain:
        p.ellipse(cx, cy, r, r, "R")
    tail = p.mask("R")
    for x, y in tail:  # 오른쪽(그늘) 가장자리 2px은 어둡게
        if (x + 1, y) not in tail or ((x + 2, y) not in tail and y > 10):
            p.put(x, y, "r")
    for (ax, ay, ar), (bx, by, br) in zip(chain[1:5], chain[2:6]):
        p.thick_line(ax - ar * 0.35, ay, bx - br * 0.35, by, 0.9, "y")

    # 3) 망토(작은 어깨)와 셔츠
    p.poly([(4, 48), (6, 44.5), (11, 41.4), (18, 40.2), (30, 40.2), (37, 41.4), (42, 44.5), (44, 48)], "O")
    cape = p.mask("O")
    p.poly([(21.6, 41.0), (26.4, 41.0), (29.5, 48), (18.5, 48)], "W")
    shirt = p.mask("W") - tube
    p.edge(cape, shirt, "o")
    for x in range(N):
        for y in range(N):
            if p.get(x, y) == "O" and p.get(x, y - 1) in ".nNBbUY":
                p.put(x, y, "Q")
    for x, y0 in ((9, 45), (14, 43), (34, 43), (39, 45)):
        for y in range(y0, 48):
            if p.get(x, y) == "O":
                p.put(x, y, "o")

    # 4) 목(가늘게)
    for y in range(34, 42):
        for x in range(22, 26):
            p.put(x, y, "S")
    neck = p.mask("S")

    # 5) 머리카락 뒷부분(크고 둥근 머리)
    p.ellipse(24, 20.5, 15.6, 16.6, "R")
    head = p.mask("R") - tail
    for x, y in head:  # 얼굴 옆·아래로 보이는 머리 안쪽은 어둡게
        if y >= 18:
            p.put(x, y, "r")

    # 6) 얼굴
    face = set()
    for y in range(N):
        hw = _face_halfwidth(y)
        if hw <= 0.4:
            continue
        for x in range(N):
            if abs(x + 0.5 - FACE_CX) <= hw:
                face.add((x, y))
                p.put(x, y, "s")
    for x, y in neck:
        if (x, y) not in face and y >= 38:
            p.put(x, y, "s")
    for x, y in face:  # 오른쪽·아래 가장자리 음영(빛은 왼쪽 위)
        if (x + 1, y) not in face and y > 22:
            p.put(x, y, "S")
        if (x, y + 1) not in face and y > 33:
            p.put(x, y, "S")

    # 7) 옆머리(얼굴을 감싸고 끝이 가늘어진다)
    locks = Pix()
    locks.poly([(10.0, 14), (16.4, 14), (15.6, 24), (14.8, 31), (13.0, 37.0), (11.2, 33.5), (9.8, 25)], "R")
    locks.poly([(38.0, 14), (31.6, 14), (32.4, 24), (33.2, 31), (35.0, 37.0), (36.8, 33.5), (38.2, 25)], "R")
    # 8) 앞머리: 둥근 머리 안쪽을 채우고 아래로 뾰족한 다발이 내려온다
    bang = Pix()
    bang.poly([(8, 3), (40, 3), (40, 15.6), (8, 15.6)], "R")
    clumps = [
        (10.5, 16.0, 13.0, 22.5),
        (15.0, 20.2, 17.4, 20.0),
        (19.4, 24.6, 21.8, 18.8),
        (23.8, 28.6, 26.4, 17.8),
        (27.8, 33.0, 30.6, 20.0),
        (32.0, 37.5, 35.0, 22.5),
    ]
    for x0, x1, tx, ty in clumps:
        bang.poly([(x0, 15.0), (x1, 15.0), (tx, ty)], "R")
    bmask = {(x, y) for (x, y) in bang.mask("R") if (x, y) in head or (x, y) in face}
    lmask = locks.mask("R")
    for x, y in lmask | bmask:
        p.put(x, y, "R")
    hair = lmask | bmask
    # 옆머리 바깥쪽 결과 안쪽 그림자
    for x, y in lmask:
        if y >= 16 and ((x - 1, y) not in hair or (x + 1, y) not in hair):
            p.put(x, y, "r")
    # 앞머리가 얼굴에 드리우는 그림자
    for x, y in face:
        if (x, y - 1) in hair and (x, y) not in hair:
            p.put(x, y, "S")
    # 광택: 다발마다 짧은 밝은 띠(천사 고리), 빛은 왼쪽 위
    cuts = {int(x0 + 0.5) for x0, _, _, _ in clumps[1:]}
    for x in range(14, 34):
        if x in cuts:
            continue
        p.put(x, 14, "y")
        if x - 1 in cuts or x == 14:
            p.put(x, 15, "y")
        if 15 <= x <= 25 and x - 1 not in cuts and x + 1 not in cuts:
            p.put(x, 14, "z")
    for x in range(15, 34):  # 고글 위 정수리의 광택
        if p.get(x, 5) == "R" and x not in (19, 20, 27, 28):
            p.put(x, 5, "y" if x > 22 else "z")
    # 옆머리 하이라이트
    p.thick_line(11.6, 17, 11.6, 29, 0.9, "y")
    p.thick_line(36.4, 17, 36.4, 27, 0.9, "R")

    # 9) 바보털(아호게): 정수리에서 휘어 올라가는 머리 한 가닥
    for x, y in ((24, 4), (23, 3), (22, 2), (21, 1), (20, 1), (19, 2)):
        p.put(x, y, "R")
    p.put(22, 2, "y")

    # 10) 고글(이마 위로 올림): 가죽 띠 + 황동 테 + 렌즈
    strap = Pix()
    strap.thick_line(8.0, 10.2, 40.0, 10.2, 2.4, "b")
    for x, y in strap.mask("b") & head:
        p.put(x, y, "b")
    for cx in (18.4, 29.6):
        p.ellipse(cx, 9.6, 4.4, 3.6, "U")
        p.ellipse(cx, 9.6, 2.9, 2.2, "t")
        p.ellipse(cx - 0.4, 9.2, 2.4, 1.7, "T")
        p.put(int(cx - 2), 8, "c")
        p.put(int(cx - 1), 8, "W")
        p.put(int(cx - 2), 9, "c")
    for x in range(22, 26):
        p.put(x, 9, "u")
        p.put(x, 10, "U")
    for cx in (18.4, 29.6):
        for x in range(int(cx - 3), int(cx + 4)):
            if p.get(x, 13) == "U":
                p.put(x, 13, "u")
    for y in range(N):
        for x in range(N):
            if p.get(x, y) == "U" and p.get(x + 1, y) not in "Uu" and p.get(x - 1, y) == "U" and y >= 10:
                p.put(x, y, "u")
    for cx in (18.4, 29.6):
        p.put(int(cx - 3), 8, "Y")

    # 11) 포니테일 리본(청록, 고글 렌즈와 같은 색)
    p.stamp(grid("""
        .KKK.KKK.
        KccTKTccK
        KcTTUTTcK
        .KTtUtTK.
        ..KtKtK..
        .KTK.KTK.
        .KK...KK.
    """), 35, 1)

    # 12) 나침반 장미 머리핀(왼쪽 옆머리)
    p.stamp(grid("""
        ..K..
        .KYK.
        KUxUK
        .KUK.
        ..K..
    """), 9, 18)

    # 13) 지도통 끈(왼쪽 어깨 → 오른쪽 옆구리)과 나침반, 망토 걸쇠
    p.thick_line(12.5, 41.0, 31.5, 49.5, 2.2, "B")
    p.thick_line(12.5, 42.3, 31.5, 50.8, 0.9, "b")
    p.ellipse(30.4, 45.4, 2.6, 2.6, "U")
    p.ellipse(30.4, 45.4, 1.5, 1.5, "W")
    p.put(30, 44, "x")
    p.put(30, 45, "K")
    p.put(29, 43, "Y")
    p.put(31, 47, "u")
    p.ellipse(24, 41.4, 1.8, 1.6, "U")
    p.put(23, 41, "Y")

    # 14) 큰 덩어리 사이 경계선
    body = p.mask("OQosSWmBbUYux")
    p.edge(tube - body, p.mask("OQo"), "K")
    p.edge(p.mask("Rry") & tail, p.mask("OQo"), "K")
    return outline(p.rows())


BASE = _base()


def _g(s):
    return grid(s)


def _flip(g):
    return [r[::-1] for r in g]


# 표정 조각의 자리(왼쪽 위 기준). 얼굴 가운데 축이 x=23|24 사이라서 왼쪽 x ↔ 오른쪽 47-x 로 대칭이다.
# 눈 7×8(왼눈 x=15~21, 오른눈 x=26~32), 눈썹 6×2, 입은 짝수 너비로 가운데 정렬, 홍조 6×2.
EYE_Y, LEFT_X, RIGHT_X = 21, 15, 26
BROW_Y, BROW_LX = 18, 15
MOUTH_Y = 31
BLUSH_Y, BLUSH_LX, BLUSH_RX = 29, 13, 29

# 왼눈(바깥 끝이 왼쪽). 오른눈은 좌우 반전(하이라이트도 바깥쪽으로 대칭).
# 아치형 윗 속눈썹(바깥 끝이 두껍게 내려옴), 위는 짙고 아래로 밝아지는 홍채,
# 큰 하이라이트 2×2 + 작은 하이라이트 1, 안쪽 위의 흰자, 바깥 아래 속눈썹 힌트.
EYE_OPEN = """
    .KKKKK.
    KKddddK
    .kWWdKW
    .kWWKdW
    .kdKKd.
    .keKKe.
    .kElWE.
    ..klll.
"""

BLUSH = """
    .jijij
    jijij.
"""

SPARKLE_BIG = """
    ..Y..
    ..Y..
    YYWYY
    ..Y..
    ..Y..
"""
SPARKLE_SMALL = """
    .Y.
    YWY
    .Y.
"""

EXPRESSIONS = {
    # 잔잔한 미소
    "neutral": dict(
        brow=_g("""
            .BBBB.
            B.....
        """),
        eye=_g(EYE_OPEN),
        mouth=_g("""
            X..X
            .XX.
        """),
    ),
    # ^^ 감은 눈 + 활짝 웃는 입 + 반짝임
    "happy": dict(
        brow=_g("""
            .BBBB.
            B....B
        """),
        brow_dy=-1,
        eye=_g("""
            .......
            .......
            ..KKK..
            .KKKKK.
            KK...KK
            K.....K
            .......
            .......
        """),
        mouth=_g("""
            XXXXXX
            XxxxxX
            .XiiX.
            ..XX..
        """),
        blush=_g("""
            jijiji
            ijiji.
        """),
        fx=[(_g(SPARKLE_BIG), 2, 6), (_g(SPARKLE_SMALL), 7, 14)],
    ),
    # 안쪽이 올라간 눈썹, 눈물 맺힌 눈, 물결 입, 땀방울
    "worried": dict(
        brow=_g("""
            ....BB
            BBBB..
        """),
        brow_dy=-1,
        eye=_g("""
            .KKKKK.
            KKddddK
            .kWWdKW
            .kWWKdW
            .kdKKd.
            .kcKKc.
            .kcWcc.
            ..cccc.
        """),
        mouth=_g("""
            X.XX.X
            .X..X.
        """),
        fx=[(_g("""
            ..K..
            .KcK.
            KcccK
            KWccK
            KWccK
            .KKK.
        """), 36, 16)],
    ),
    # 크게 뜬 눈(작은 눈동자), 동그란 입, 놀람 선
    "surprised": dict(
        brow=_g("""
            .BBBB.
            B....B
        """),
        brow_dy=-2,
        eye=_g("""
            .KKKKK.
            KKWWWKK
            kWdddWk
            kWdKdWk
            kWeleWk
            .kWWWk.
            ..kkk..
            .......
        """),
        mouth=_g("""
            .KK.
            KXXK
            KxxK
            .KK.
        """),
        mouth_dy=1,
        fx=[(_g("""
            KKK
            KxK
            KxK
            KxK
            KKK
            KxK
            KKK
        """), 4, 3)],
    ),
    # 가늘게 뜬 결연한 눈, 안쪽으로 내려온 눈썹, 작은 일자 입
    "serious": dict(
        brow=_g("""
            BB....
            ..BBBB
        """),
        brow_dy=1,
        eye=_g("""
            .......
            KK.....
            .KKKKKK
            .kWdKKW
            .kdKKd.
            .keKKe.
            .kElEE.
            ..klll.
        """),
        mouth=_g("""
            XXXX
        """),
        mouth_dy=1,
        blush=_g("""
            ..jj..
            .jj...
        """),
    ),
}


def portrait(expr):
    e = EXPRESSIONS[expr]
    p = Pix()
    p.g = [list(r) for r in BASE]
    blush = e.get("blush", _g(BLUSH))
    p.stamp(blush, BLUSH_LX, BLUSH_Y)
    p.stamp(_flip(blush), BLUSH_RX, BLUSH_Y)
    by = BROW_Y + e.get("brow_dy", 0)
    p.stamp(e["brow"], BROW_LX, by)
    p.stamp(_flip(e["brow"]), N - BROW_LX - len(e["brow"][0]), by)
    p.stamp(e["eye"], LEFT_X, EYE_Y)
    p.stamp(_flip(e["eye"]), RIGHT_X, EYE_Y)
    m = e["mouth"]
    p.stamp(m, N // 2 - len(m[0]) // 2, MOUTH_Y + e.get("mouth_dy", 0))
    for g, x, y in e.get("fx", ()):
        p.stamp(g, x, y)
    return p.rows()


PORTRAITS = {f"nuri_{k}": [portrait(k)] for k in ("neutral", "happy", "worried", "surprised", "serious")}
