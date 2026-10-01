"""누리 초상화(48×48, 표정 5종).

몸통·머리카락·고글·망토는 도형(타원·다각형·굵은 선)으로 한 번 그려 모든 표정이 공유하고,
표정마다 눈썹·눈·입 영역(작은 그리드)만 바꿔 얹는다(design.md §3 공통).

누리: 주황 포니테일, 이마에 올린 황동 고글, 짧은 올리브 망토(황동 걸쇠), 왼쪽 어깨 뒤의 지도통,
가슴을 가로지르는 지도통 끈과 거기 매달린 나침반. 눈은 올리브빛 초록.
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


# 얼굴 윤곽: 위는 타원, 아래는 턱으로 좁아진다.
FACE_CX = 24.0


def _face_halfwidth(y):
    yc = y + 0.5
    if yc < 11 or yc > 34:
        return -1
    ell = 10.6 * math.sqrt(max(0.0, 1 - ((yc - 22.5) / 12.5) ** 2))
    if yc <= 27:
        return ell
    w27 = 10.6 * math.sqrt(1 - (4.5 / 12.5) ** 2)
    return min(ell, w27 + (yc - 27) * (3.6 - w27) / 7)


def _base():
    p = Pix()
    # 1) 지도통(왼쪽 어깨 뒤로 비스듬히)
    p.thick_line(7.5, 46, 12.5, 26.5, 5.2, "n")
    p.thick_line(6.0, 46, 11.0, 26.5, 1.6, "N")
    p.thick_line(9.2, 46, 14.0, 26.8, 1.4, "B")
    p.thick_line(12.0, 27.5, 13.0, 24.5, 5.4, "U")
    p.thick_line(11.0, 26.0, 12.0, 24.5, 1.4, "Y")
    tube = p.mask("nNBUY")
    for x, y in tube:  # 지도통 가운데의 황동 띠
        if y == 32:
            p.put(x, y, "U")
        elif y == 33:
            p.put(x, y, "u")

    # 2) 포니테일(머리 뒤 오른쪽으로 흘러내림)
    chain = [(37.5, 9.5, 3.4), (40.0, 12.5, 3.8), (41.8, 16.5, 3.9), (42.4, 20.5, 3.7),
             (42.0, 24.5, 3.4), (41.0, 28.0, 3.0), (39.6, 31.0, 2.5), (38.2, 33.6, 1.9), (37.0, 35.4, 1.2)]
    for cx, cy, r in chain:
        p.ellipse(cx, cy, r, r, "R")
    for cx, cy, r in chain[1:7]:
        p.ellipse(cx + r * 0.45, cy + 0.6, r * 0.45, r * 0.55, "r")
    for cx, cy, r in chain[1:5]:
        p.put(int(cx - r * 0.4), int(cy - 0.6), "y")
    tail = p.mask("Rry")

    # 3) 망토(어깨)와 셔츠
    p.poly([(1, 48), (3, 42), (8, 38.2), (16, 36.2), (32, 36.2), (40, 38.2), (45, 42), (47, 48)], "O")
    cape = p.mask("O")
    p.poly([(21.2, 38.5), (26.8, 38.5), (31, 48), (17, 48)], "W")
    shirt = p.mask("W") - tube
    p.edge(cape, shirt, "o")
    # 망토 깃(어깨 위쪽 밝은 테두리)
    for x in range(N):
        for y in range(N):
            if p.get(x, y) == "O" and p.get(x, y - 1) in ".nNBUY":
                p.put(x, y, "Q")
    # 망토 아래쪽 그림자 주름
    for x, y0 in ((7, 43), (12, 41), (36, 41), (41, 43)):
        for y in range(y0, 48):
            if p.get(x, y) == "O":
                p.put(x, y, "o")

    # 4) 목
    for y in range(31, 39):
        for x in range(21, 27):
            p.put(x, y, "S")
    neck = p.mask("S")

    # 5) 머리카락 뒷부분
    p.ellipse(24, 18.5, 13.2, 14.2, "R")

    # 6) 얼굴
    face = set()
    for y in range(N):
        hw = _face_halfwidth(y)
        if hw <= 0:
            continue
        for x in range(N):
            if abs(x + 0.5 - FACE_CX) <= hw:
                face.add((x, y))
                p.put(x, y, "s")
    # 목: 턱 바로 아래는 그림자, 그 아래는 밝게
    for x, y in neck:
        if (x, y) not in face and y >= 36:
            p.put(x, y, "s")
    # 얼굴 오른쪽 가장자리 음영(빛은 왼쪽 위)
    for x, y in face:
        if (x + 1, y) not in face and y > 13:
            p.put(x, y, "S")
    for x, y in face:
        if (x, y + 1) not in face and y > 28:
            p.put(x, y, "S")

    # 7) 옆머리
    p.poly([(12.2, 13), (17.2, 13), (16.4, 22), (15.6, 29.5), (13.2, 31.5), (11.6, 24)], "R")
    p.poly([(35.8, 13), (30.8, 13), (31.6, 22), (32.4, 29.5), (34.8, 31.5), (36.4, 24)], "R")

    # 8) 앞머리(이마를 덮고 끝이 뾰족)
    p.poly([(12.5, 11), (35.5, 11), (35.5, 15.5), (13, 15.5)], "R")
    for tri in (
        [(13.0, 15), (19.0, 15), (14.6, 20.2)],
        [(17.5, 15), (24.0, 15), (20.8, 17.6)],
        [(22.5, 15), (29.0, 15), (26.0, 17.4)],
        [(27.5, 15), (35.0, 15), (32.8, 20.2)],
    ):
        p.poly(tri, "R")
    hair = p.mask("R") - tail
    # 머리카락 결(어두운 가닥)과 하이라이트
    for (x0, y0, x1, y1) in ((19.5, 12, 20.6, 17.0), (25.2, 12, 25.8, 16.6), (15.5, 13, 14.9, 19.6),
                             (31.6, 13, 32.5, 19.4)):
        p.thick_line(x0, y0, x1, y1, 0.9, "r")
    p.edge(hair, face, "r")
    for (x, y) in ((15, 7), (16, 6), (17, 6), (18, 5), (14, 8)):
        p.put(x, y, "y")
    p.thick_line(12.6, 15, 12.2, 26, 1.0, "y")

    # 9) 고글(이마 위로 올림): 가죽 띠 + 황동 테 + 렌즈
    p.thick_line(13.0, 9.6, 35.0, 9.6, 2.6, "b")
    for cx in (18.6, 29.4):
        p.ellipse(cx, 9.6, 4.6, 3.8, "U")
        p.ellipse(cx, 9.6, 3.1, 2.4, "t")
        p.ellipse(cx - 0.4, 9.2, 2.6, 1.9, "T")
        p.put(int(cx - 2), 8, "c")
        p.put(int(cx - 1), 8, "W")
        p.put(int(cx - 2), 9, "c")
    for x in range(22, 27):
        p.put(x, 9, "u")
        p.put(x, 10, "U")
    # 황동 테 아래쪽 음영
    for cx in (18.6, 29.4):
        for x in range(int(cx - 3), int(cx + 4)):
            if p.get(x, 13) == "U":
                p.put(x, 13, "u")
    for y in range(N):
        for x in range(N):
            if p.get(x, y) == "U" and p.get(x + 1, y) not in "Uu" and p.get(x - 1, y) == "U" and y >= 10:
                p.put(x, y, "u")
    # 포니테일 묶음(황동 끈)
    p.ellipse(36.2, 8.6, 1.8, 2.2, "U")
    p.put(35, 8, "Y")

    # 10) 지도통 끈(왼쪽 어깨 → 오른쪽 옆구리)과 나침반, 망토 걸쇠
    p.thick_line(12.5, 38.0, 33.5, 48.5, 2.4, "B")
    p.thick_line(12.5, 39.4, 33.5, 49.9, 0.9, "b")
    p.ellipse(31.2, 43.0, 2.8, 2.8, "U")
    p.ellipse(31.2, 43.0, 1.7, 1.7, "W")
    p.put(31, 42, "x")
    p.put(31, 43, "K")
    p.put(30, 41, "Y")
    p.put(32, 45, "u")
    p.ellipse(24, 38.6, 2.0, 1.8, "U")
    p.put(23, 38, "Y")
    p.put(25, 39, "u")

    # 11) 볼 홍조와 코
    for x, y in ((16, 27), (17, 27), (18, 27), (30, 27), (31, 27), (32, 27)):
        p.put(x, y, "i")
    p.put(24, 26, "S")
    p.put(25, 27, "S")

    # 12) 큰 덩어리 사이 경계선
    body = p.mask("OQosSWmBbUYux")
    p.edge(tube - body, p.mask("OQo"), "K")
    p.edge(p.mask("Rry") & tail, p.mask("OQo"), "K")
    g = outline(p.rows())
    return g


BASE = _base()

# 표정 조각: 눈썹(5×3) · 눈(5×6) · 입(6×4). 왼쪽/오른쪽 눈은 각각 그린다(하이라이트 방향 유지).
BROW_Y, EYE_Y, MOUTH_Y = 17, 20, 29
LEFT_X, RIGHT_X, MOUTH_X = 16, 27, 21


def _g(s):
    return grid(s)


EXPRESSIONS = {
    "neutral": dict(
        brow_l=_g("""
            .....
            .rrrr
            rr...
        """),
        brow_r=_g("""
            .....
            rrrr.
            ...rr
        """),
        eye_l=_g("""
            .KKK.
            KKKKK
            KWddK
            KddeK
            KdeeK
            .KKK.
        """),
        eye_r=_g("""
            .KKK.
            KKKKK
            KWddK
            KddeK
            KdeeK
            .KKK.
        """),
        mouth=_g("""
            ......
            X....X
            .XXXX.
            ......
        """),
    ),
    "happy": dict(
        brow_l=_g("""
            .rrr.
            rr.rr
            .....
        """),
        brow_r=_g("""
            .rrr.
            rr.rr
            .....
        """),
        eye_l=_g("""
            .....
            .....
            .KKK.
            K...K
            .....
            .....
        """),
        eye_r=_g("""
            .....
            .....
            .KKK.
            K...K
            .....
            .....
        """),
        mouth=_g("""
            XXXXXX
            XxxxxX
            .XiiX.
            ..XX..
        """),
    ),
    "worried": dict(
        brow_l=_g("""
            ...rr
            .rrr.
            rr...
        """),
        brow_r=_g("""
            rr...
            .rrr.
            ...rr
        """),
        eye_l=_g("""
            .....
            .KKK.
            KWWdK
            KWddK
            KdeeK
            .KKK.
        """),
        eye_r=_g("""
            .....
            .KKK.
            KWWdK
            KWddK
            KdeeK
            .KKK.
        """),
        mouth=_g("""
            ......
            .XXXX.
            X....X
            ......
        """),
    ),
    "surprised": dict(
        brow_l=_g("""
            .rrr.
            rr.rr
            .....
        """),
        brow_r=_g("""
            .rrr.
            rr.rr
            .....
        """),
        eye_l=_g("""
            .KKK.
            KWWWK
            KWdWK
            KWeWK
            KWWWK
            .KKK.
        """),
        eye_r=_g("""
            .KKK.
            KWWWK
            KWdWK
            KWeWK
            KWWWK
            .KKK.
        """),
        mouth=_g("""
            ..XX..
            .XxxX.
            .XxxX.
            ..XX..
        """),
    ),
    "serious": dict(
        brow_l=_g("""
            rr...
            .rrr.
            ...rr
        """),
        brow_r=_g("""
            ...rr
            .rrr.
            rr...
        """),
        eye_l=_g("""
            .....
            .....
            KKKKK
            KWddK
            KdeeK
            .KKK.
        """),
        eye_r=_g("""
            .....
            .....
            KKKKK
            KWddK
            KdeeK
            .KKK.
        """),
        mouth=_g("""
            ......
            .XXXX.
            ......
            ......
        """),
    ),
}

# 놀람 표정은 눈썹을 1px 더 올린다.
BROW_LIFT = {"surprised": 2, "happy": 1}


def portrait(expr):
    e = EXPRESSIONS[expr]
    p = Pix()
    p.g = [list(r) for r in BASE]
    by = BROW_Y - BROW_LIFT.get(expr, 0)
    p.stamp(e["brow_l"], LEFT_X, by)
    p.stamp(e["brow_r"], RIGHT_X, by)
    p.stamp(e["eye_l"], LEFT_X, EYE_Y)
    p.stamp(e["eye_r"], RIGHT_X, EYE_Y)
    p.stamp(e["mouth"], MOUTH_X, MOUTH_Y)
    return p.rows()


PORTRAITS = {f"nuri_{k}": [portrait(k)] for k in ("neutral", "happy", "worried", "surprised", "serious")}
